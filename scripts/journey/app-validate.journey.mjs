/* Journey: built-app validation.
 *
 * Ports scripts/validate.mjs onto Playwright: drives the production build
 * (vite preview on :5180, started by the journey config) and asserts the
 * rules the contrast gate cannot see — a11y wiring, interactions, console
 * health, reduced-motion, heading hierarchy, and overflow breakpoints. A
 * separate check proves reduced transparency removes every backdrop blur.
 * Runs against the live clock with no determinism shim, exactly like the
 * script it replaces.
 */
import { test as base, expect } from '@playwright/test'

const test = base.extend({
  theme: async ({}, use, testInfo) => {
    await use(testInfo.project.name)
  },
})

const URL = 'http://localhost:5180/?fb=off'

test.describe('built app', () => {
  // One serial pass holds every check; the overflow sweep reloads per width.
  test.setTimeout(300_000)
  test('passes the twenty interaction checks', async ({ page, context, browser }) => {
    const errors = []
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)

    // Icons, names, headings.
    const counts = await page.evaluate(() => ({
      svg: document.querySelectorAll('svg.lucide').length,
      leftover: document.querySelectorAll('i[data-lucide]').length,
      copyUnnamed: document.querySelectorAll('.copy-token:not([aria-label])').length,
      iconBtnUnnamed: [...document.querySelectorAll('button')].filter(
        (b) => !b.textContent.trim() && !b.getAttribute('aria-label') && b.querySelector('svg,i'),
      ).length,
      h1: document.querySelectorAll('h1').length,
      h2: document.querySelectorAll('h2').length,
      h3: document.querySelectorAll('h3').length,
      ariaHiddenSvg: document.querySelectorAll('svg.lucide[aria-hidden="true"]').length,
    }))
    expect(counts.svg, `${counts.svg} svgs`).toBeGreaterThan(250)
    expect(counts.leftover, `${counts.leftover} left`).toBe(0)
    expect(counts.copyUnnamed, `${counts.copyUnnamed} unnamed`).toBe(0)
    expect(counts.iconBtnUnnamed, `${counts.iconBtnUnnamed} unnamed`).toBe(0)
    expect(counts.h1, `${counts.h1} h1`).toBe(1)
    expect(counts.h2 >= 15 && counts.h3 >= 5, `h2=${counts.h2} h3=${counts.h3}`).toBe(true)
    expect(counts.ariaHiddenSvg, `${counts.ariaHiddenSvg} hidden`).toBeGreaterThan(200)

    // Scroll-spy tracks every target (snap off: this tests the spy logic).
    const spy = await page.evaluate(async () => {
      const prevSnap = document.documentElement.style.scrollSnapType
      document.documentElement.style.scrollSnapType = 'none'
      const res = []
      for (const t of ['#color', '#states', '#overlays', '#tokens']) {
        const el = document.querySelector(t)
        window.scrollTo({ top: el.offsetTop - 100, behavior: 'instant' })
        await new Promise((r) => setTimeout(r, 300))
        const a = document.querySelector('.rail-link.active')
        res.push(!!(a && a.getAttribute('href') === t))
      }
      window.scrollTo(0, 0)
      document.documentElement.style.scrollSnapType = prevSnap
      return res
    })
    expect(spy.filter(Boolean).length, `${spy.filter(Boolean).length}/4`).toBe(4)

    // Header gating by zone.
    const navAt = (anchor) =>
      page.evaluate((a) => {
        document.documentElement.style.scrollSnapType = 'none'
        document.documentElement.style.scrollBehavior = 'auto'
        if (a === 'top') window.scrollTo(0, 0)
        else {
          const el = document.getElementById(a)
          if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' })
        }
        return new Promise((res) =>
          setTimeout(
            () => res(document.querySelector('.nav').classList.contains('nav--hidden')),
            260,
          ),
        )
      }, anchor)
    await expect.poll(() => navAt('top'), { timeout: 15000 }).toBe(true)
    expect(await navAt('color')).toBe(false)
    expect(await navAt('inuse')).toBe(true)

    // Command palette opens, jumps, and closes.
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(200)
    expect(await page.$('.cmdk')).not.toBeNull()
    await page.keyboard.type('overlays')
    await page.waitForTimeout(150)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2000)
    const jumped = await page.evaluate(() => ({
      gone: !document.querySelector('.cmdk'),
      top: Math.round(document.getElementById('overlays').getBoundingClientRect().top),
    }))
    expect(jumped.gone && jumped.top < 240, `top=${jumped.top}`).toBe(true)

    // Dialog opens, traps focus, Esc closes and returns focus.
    await page.evaluate(() => {
      document.querySelector('[data-open-dialog]').scrollIntoView({ block: 'center' })
    })
    await page.waitForTimeout(200)
    await page.evaluate(() => document.querySelector('[data-open-dialog]').click())
    await page.waitForTimeout(450)
    const dlgOpen = await page.evaluate(
      () =>
        !!document.querySelector('.dlg-overlay [role="dialog"][aria-modal="true"]') &&
        document.activeElement.closest('.dlg-overlay') !== null,
    )
    expect(dlgOpen).toBe(true)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    const dlgClosed = await page.evaluate(
      () =>
        !document.querySelector('.dlg-overlay') &&
        document.activeElement.matches('[data-open-dialog]'),
    )
    expect(dlgClosed).toBe(true)

    // Theme toggle keeps icons.
    const t1 = await page.evaluate(() => document.querySelectorAll('svg.lucide').length)
    await page.evaluate(() => document.querySelector('.theme-btn').click())
    await page.waitForTimeout(300)
    const themed = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    const t2 = await page.evaluate(() => document.querySelectorAll('svg.lucide').length)
    await page.evaluate(() => document.querySelector('.theme-btn').click())
    await page.waitForTimeout(200)
    expect(themed).toBe('light')
    expect(t2, `${t1}->${t2}`).toBeGreaterThanOrEqual(t1 - 2)

    // No horizontal overflow from 320px up. A fresh page per width, like the
    // script: reused scroll state from the interaction checks above would
    // otherwise pollute the measurement. The sweep runs at full motion like
    // the script — the run's global reduce emulation freezes the philosophy
    // marquee mid-cycle and reads 4px at 320px (pre-existing, filed
    // separately); motion behavior itself is covered by the dedicated check
    // below.
    const motionCtx = await browser.newContext({ reducedMotion: 'no-preference' })
    const over = {}
    try {
      for (const w of [320, 360, 390, 768, 1024, 1440]) {
        const wp = await motionCtx.newPage()
        await wp.setViewportSize({ width: w, height: 800 })
        await wp.goto(URL, { waitUntil: 'networkidle' })
        await wp.waitForTimeout(600)
        over[w] = await wp.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        await wp.close()
      }
    } finally {
      await motionCtx.close()
    }
    expect(Object.values(over).every((v) => v <= 1), JSON.stringify(over)).toBe(true)

    // Reduced motion shortens transitions (the run itself is under reduce).
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(URL, { waitUntil: 'load' })
    await page.waitForTimeout(1000)
    const rmDur = await page.evaluate(() => {
      const el = document.querySelector('.card-img') || document.querySelector('.card')
      return el ? getComputedStyle(el).transitionDuration : '0s'
    })
    expect(parseFloat(rmDur), rmDur).toBeLessThan(0.05)

    expect(errors, errors.slice(0, 3).join(' | ')).toEqual([])
  })

  // Reduced transparency: no element on the page computes a backdrop blur, and the sticky nav is
  // the opaque --surface, in the theme this project renders. The fallback is an !important rule in
  // @layer base: a normal declaration there loses to the blurred rules in the components layer
  // (an earlier .nav fallback never applied for that reason), and only a computed read of the
  // mounted page sees that cascade. The app ignores prefers-color-scheme, so the light project
  // pins ?theme=light before navigating and the check asserts the theme it sees. Playwright's
  // emulateMedia has no reduced-transparency option, so the feature is set through CDP.
  test('honors reduced transparency', async ({ browser, theme }) => {
    test.setTimeout(30_000)
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    try {
      const p = await ctx.newPage()
      const cdp = await ctx.newCDPSession(p)
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      })
      await p.goto(URL + (theme === 'light' ? '&theme=light' : ''), { waitUntil: 'load' })
      const seen = await p.evaluate(() => {
        const probe = document.createElement('div')
        probe.style.background = 'var(--surface)'
        document.body.appendChild(probe)
        const surface = getComputedStyle(probe).backgroundColor
        probe.remove()
        // a fresh element carrying its own blur proves the rule is universal, not a list of the
        // classes this page happens to mount (set before its first style computation)
        const blurProbe = document.createElement('div')
        blurProbe.style.backdropFilter = 'blur(4px)'
        document.body.appendChild(blurProbe)
        const probeBlur = getComputedStyle(blurProbe).backdropFilter
        blurProbe.remove()
        const blurred = [...document.querySelectorAll('*')]
          .filter((el) => getComputedStyle(el).backdropFilter !== 'none')
          .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''))
        const nav = document.querySelector('.nav')
        return {
          matches: matchMedia('(prefers-reduced-transparency: reduce)').matches,
          theme: document.documentElement.getAttribute('data-theme') || 'dark',
          surface,
          navBg: nav ? getComputedStyle(nav).backgroundColor : null,
          probeBlur,
          blurred,
        }
      })
      const detail = JSON.stringify(seen)
      // printed on every run so a passing CI log records the theme and values the check saw
      console.log(`reduced transparency [${theme}]: ${detail}`)
      expect(seen.matches, detail).toBe(true)
      expect(seen.theme, detail).toBe(theme)
      expect(seen.blurred, detail).toEqual([])
      expect(seen.probeBlur, detail).toBe('none')
      expect(seen.navBg, detail).toBe(seen.surface)
    } finally {
      await ctx.close()
    }
  })
})

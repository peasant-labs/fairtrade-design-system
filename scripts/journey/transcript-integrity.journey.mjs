import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { loadFixturePair, loadStrictYaml, ROOT } from '../mounted-parts.mjs'
import { integrityFlagged } from '../../src/mockups/inuse/integrity-fixture.js'
import { INTEGRITY_COPY } from '../../src/ui/transcript/integrity.js'

/* The integrity badge and the flagged-turn marks on the built in-use demo, on a desktop and a
   390px touch screen, in both themes (the Playwright project name is the theme).
   Cases: scripts/testdata/transcript-integrity-journey.yaml (+ .manifest.yaml).
   INTEGRITY_CAPTURE_DIR, when set, also writes <dir>/<name>-<theme>.png of the mounted #inuse
   region (panel open in the phone cases). Leave it unset in CI. */
const { fixture } = loadFixturePair('scripts/testdata/transcript-integrity-journey.yaml', 'scripts/testdata/transcript-integrity-journey.manifest.yaml', { cases: 'requiredCaseNames' })
const KINDS = ['header-desktop', 'classic-turns', 'header-phone', 'folded-mark', 'axe-panel']
const requiredKinds = loadStrictYaml('scripts/testdata/transcript-integrity-journey.manifest.yaml').requiredCaseKinds ?? {}
for (const row of fixture.cases) {
  if (requiredKinds[row.name] !== row.kind) throw new Error(`${row.name}: must run kind ${JSON.stringify(requiredKinds[row.name])}, received ${JSON.stringify(row.kind)}`)
  if (!KINDS.includes(row.kind)) throw new Error(`${row.name}: unknown kind ${JSON.stringify(row.kind)}`)
}
const FLAGGED_COUNT = integrityFlagged.flagged_turns.length

/* the newest source the build reads: a dist older than this is not this branch's build */
const newestSource = (() => {
  let newest = statSync(`${ROOT}/src/index.css`).mtimeMs
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(`${dir}/${entry.name}`)
      else if (/\.(jsx?|css)$/.test(entry.name) && !/\.stories\./.test(entry.name)) newest = Math.max(newest, statSync(`${dir}/${entry.name}`).mtimeMs)
    }
  }
  walk(`${ROOT}/src/ui/transcript`)
  walk(`${ROOT}/src/mockups/inuse`)
  return newest
})()
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`
const captureDir = process.env.INTEGRITY_CAPTURE_DIR
const GUTTER = 16

for (const row of fixture.cases) {
  test(`transcript integrity ${row.name}`, async ({ browser }, info) => {
    const theme = info.project.name
    const context = `${row.name} (${theme})`
    const ctx = await browser.newContext({
      viewport: row.viewport,
      colorScheme: theme,
      reducedMotion: 'reduce',
      ...(row.touch ? { hasTouch: true, isMobile: true } : {}),
    })
    const page = await ctx.newPage()
    const servedScripts = []
    page.on('response', (response) => { if (/\.js(\?|$)/.test(response.url()) && response.url().startsWith(origin)) servedScripts.push(response) })
    await page.goto(`${origin}/?fb=off&transcript=${row.query}&theme=${theme}#inuse`)
    await page.locator('#inuse').scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready)

    /* provenance: the served stylesheet is the build that carries the badge, not a stale dist */
    const served = await page.evaluate(async () => {
      const hrefs = [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href)
      const texts = await Promise.all(hrefs.map((href) => fetch(href).then((response) => response.text())))
      return texts.some((text) => text.includes('txn-integrity-badge'))
    })
    expect(served, `${context}: the served stylesheet must carry the integrity badge rules`).toBe(true)

    /* provenance of the scripts: every served bundle is byte-identical to this worktree's dist, and
       that dist is not older than the sources it was built from */
    expect(servedScripts.length, `${context}: the page loaded no script`).toBeGreaterThan(0)
    for (const response of servedScripts) {
      const file = `${ROOT}/dist${new URL(response.url()).pathname}`
      const served = await response.body()
      expect(served.equals(readFileSync(file)), `${context}: ${response.url()} is not this worktree's dist build`).toBe(true)
    }
    const distNewest = Math.max(...readdirSync(`${ROOT}/dist/assets`).map((name) => statSync(`${ROOT}/dist/assets/${name}`).mtimeMs))
    expect(distNewest, `${context}: dist is older than the sources, so rebuild before the journey`).toBeGreaterThanOrEqual(newestSource)

    const badge = page.locator('#inuse .txn-integrity-badge')
    const help = page.locator('#inuse .txn-integrity-help')
    const panel = page.locator('#inuse .txn-integrity-panel')
    const capture = async (suffix = '') => {
      if (!captureDir) return
      mkdirSync(captureDir, { recursive: true })
      await page.locator('#inuse').screenshot({ path: `${captureDir}/${row.name}${suffix}-${theme}.png` })
    }
    const horizontalFit = () => page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }))

    if (row.kind === 'header-desktop') {
      await expect(badge).toBeVisible()
      const m = await page.evaluate(() => {
        const b = document.querySelector('#inuse .txn-integrity-badge')
        const top = document.querySelector('#inuse .txn-header-top')
        const root = getComputedStyle(document.documentElement)
        const probe = document.createElement('i')
        probe.style.color = 'var(--warning)'
        document.body.append(probe)
        const warning = getComputedStyle(probe).color
        probe.remove()
        return {
          badgeRight: b.getBoundingClientRect().right,
          clusterRight: b.closest('.txn-integrity').getBoundingClientRect().right,
          topRight: top.getBoundingClientRect().right,
          sp4: parseFloat(root.getPropertyValue('--sp-4')) * (root.getPropertyValue('--sp-4').trim().endsWith('rem') ? parseFloat(root.fontSize) : 1),
          border: getComputedStyle(b).borderTopColor,
          warning,
          icons: b.querySelectorAll('svg').length,
          text: b.textContent.trim(),
          inFooter: !!b.closest('.txn-footer'),
        }
      })
      expect(m.inFooter, `${context}: the badge belongs in the header, not the footer`).toBe(false)
      /* the (?) follows the badge inside one cluster, so the cluster's right edge is the badge's
         right edge plus the control: it must end at the row's right edge, within one --sp-4 */
      expect(m.topRight - m.clusterRight, `${context}: the badge cluster ends within one --sp-4 of the header row's right edge ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.sp4 + 0.5)
      expect(m.topRight - m.badgeRight, `${context}: the badge stays inside the row ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(-0.5)
      expect(m.border, `${context}: the badge border is the warning color ${JSON.stringify(m)}`).toBe(m.warning)
      expect(m.icons, `${context}: the badge has an icon`).toBeGreaterThanOrEqual(1)
      expect(m.text, `${context}: the badge names the flag`).toBe(INTEGRITY_COPY.badgeLabel)
      /* ledger: the flagged turns (the prose turn and the folded tool-only turn) each draw one outline */
      const outlines = await page.evaluate(() => {
        const dashed = [...document.querySelectorAll('#inuse *')].filter((el) => getComputedStyle(el).outlineStyle === 'dashed')
        return { count: dashed.length, flagged: document.querySelectorAll('#inuse .is-flagged').length, outlined: dashed.map((el) => el.className) }
      })
      expect(outlines.count, `${context}: one dashed outline per flagged turn: the prose turn's card and the folded tool-only turn's row ${JSON.stringify(outlines)}`).toBe(FLAGGED_COUNT)
    }

    if (row.kind === 'classic-turns') {
      const marks = page.locator('#inuse .txn-integrity-mark')
      await expect(marks).toHaveCount(FLAGGED_COUNT)
      for (const mark of await marks.all()) await expect(mark).toBeVisible()
      const cards = await page.evaluate(() =>
        [...document.querySelectorAll('#inuse .txn-turnwrap.is-flagged')].map((wrap) => {
          const card = wrap.querySelector(':scope > .txn-turn')
          return { style: getComputedStyle(card).outlineStyle, width: getComputedStyle(card).outlineWidth }
        }))
      expect(cards.length, `${context}: one flagged card per flagged turn`).toBe(FLAGGED_COUNT)
      for (const card of cards) expect(card.style, `${context}: a flagged card outlines dashed ${JSON.stringify(cards)}`).toBe('dashed')
      /* one outline per flagged turn: no element on the mounted page other than the two cards draws one */
      const dashed = await page.evaluate(() => [...document.querySelectorAll('#inuse *')].filter((el) => getComputedStyle(el).outlineStyle === 'dashed').length)
      expect(dashed, `${context}: exactly one dashed outline per flagged turn`).toBe(FLAGGED_COUNT)
    }

    if (row.kind === 'header-phone') {
      await expect(badge).toBeVisible()
      await expect(help).toBeVisible()
      const m = await page.evaluate(() => {
        const b = document.querySelector('#inuse .txn-integrity-badge')
        const h = document.querySelector('#inuse .txn-integrity-help')
        const top = document.querySelector('#inuse .txn-header-top')
        return {
          badgeInTop: top.contains(b), helpInTop: top.contains(h),
          badgeInFooter: !!b.closest('.txn-footer'), helpInFooter: !!h.closest('.txn-footer'),
          badgeMid: (b.getBoundingClientRect().top + b.getBoundingClientRect().bottom) / 2,
          helpMid: (h.getBoundingClientRect().top + h.getBoundingClientRect().bottom) / 2,
          help: { w: h.getBoundingClientRect().width, h: h.getBoundingClientRect().height },
          coarse: matchMedia('(pointer: coarse)').matches,
        }
      })
      expect(m.coarse, `${context}: the context is a coarse pointer`).toBe(true)
      expect(m.badgeInTop && m.helpInTop, `${context}: badge and (?) sit in the header's top row ${JSON.stringify(m)}`).toBe(true)
      expect(m.badgeInFooter || m.helpInFooter, `${context}: neither sits in the footer`).toBe(false)
      /* the badge is chip height and the (?) is 44px, so their tops differ by design; one line means one centre */
      expect(Math.abs(m.badgeMid - m.helpMid), `${context}: badge and (?) share a line ${JSON.stringify(m)}`).toBeLessThanOrEqual(1)
      expect(m.help.w, `${context}: the (?) is 44px wide`).toBeGreaterThanOrEqual(44)
      expect(m.help.h, `${context}: the (?) is 44px tall`).toBeGreaterThanOrEqual(44)
      const closed = await horizontalFit()
      expect(closed.scrollWidth, `${context}: no horizontal scroll with the panel closed`).toBeLessThanOrEqual(closed.innerWidth)
      await expect(panel).toBeHidden()

      await help.tap()
      await expect(panel).toBeVisible()
      await expect(help).toHaveAttribute('aria-expanded', 'true')
      const open = await page.evaluate(() => {
        const p = document.querySelector('#inuse .txn-integrity-panel')
        const r = p.getBoundingClientRect()
        const link = p.querySelector('.txn-integrity-link')
        const lr = link?.getBoundingClientRect()
        /* every text-bearing child fits the panel's own box: nothing clipped or scrolled sideways */
        const clipped = [...p.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > r.right + 0.5 || el.getBoundingClientRect().left < r.left - 0.5).length
        return {
          left: r.left, right: r.right, innerWidth, scrollWidth: document.documentElement.scrollWidth,
          panelScroll: p.scrollWidth - p.clientWidth, clipped,
          link: lr ? { w: lr.width, h: lr.height } : null,
          text: p.textContent,
        }
      })
      expect(open.left, `${context}: the panel keeps the left gutter ${JSON.stringify(open)}`).toBeGreaterThanOrEqual(GUTTER - 0.5)
      expect(open.right, `${context}: the panel keeps the right gutter ${JSON.stringify(open)}`).toBeLessThanOrEqual(open.innerWidth - GUTTER + 0.5)
      expect(open.scrollWidth, `${context}: the open panel adds no horizontal scroll`).toBeLessThanOrEqual(open.innerWidth)
      expect(open.panelScroll, `${context}: the panel's text does not scroll sideways`).toBeLessThanOrEqual(0)
      expect(open.clipped, `${context}: nothing inside the panel overflows its box`).toBe(0)
      expect(open.text, `${context}: the panel carries its explanation`).toContain(INTEGRITY_COPY.panelBody)
      expect(open.text, `${context}: the panel carries the highlight line`).toContain(INTEGRITY_COPY.panelHighlights)
      expect(open.link, `${context}: the demo's panel carries its help link`).not.toBeNull()
      expect(open.link.h, `${context}: the panel link keeps the 44px reach`).toBeGreaterThanOrEqual(44)
      await capture()

      await help.tap()
      await expect(panel).toBeHidden()
      await expect(help).toHaveAttribute('aria-expanded', 'false')
    }

    if (row.kind === 'folded-mark') {
      const head = page.locator('#inuse .txn-modelactions-head').filter({ has: page.locator('.txn-integrity-mark') }).first()
      await expect(head).toBeVisible()
      /* the group opens by default; the mark must also show once the reader folds it */
      if ((await head.getAttribute('aria-expanded')) === 'true') await head.tap()
      await expect(head).toHaveAttribute('aria-expanded', 'false')
      const mark = head.locator('.txn-integrity-mark')
      await expect(mark).toBeVisible()
      await expect(mark).toHaveText(INTEGRITY_COPY.groupMark)
      const fit = await horizontalFit()
      expect(fit.scrollWidth, `${context}: the folded mark adds no horizontal scroll`).toBeLessThanOrEqual(fit.innerWidth)
      await capture()
    }

    if (row.kind === 'axe-panel') {
      await help.tap()
      await expect(panel).toBeVisible()
      const results = await new AxeBuilder({ page }).include('#inuse .txn-header').analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), `${context}: axe on the open panel`).toEqual([])
      await capture()
    }

    if (row.kind !== 'header-phone' && row.kind !== 'folded-mark' && row.kind !== 'axe-panel') await capture()
    await ctx.close()
  })
}

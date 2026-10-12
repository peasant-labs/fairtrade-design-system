import { test, expect } from '@playwright/test'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { loadAccessibilityMountedFixtures } from '../accessibility-mounted-fixtures.mjs'
import { ROOT } from '../css-source.mjs'
import { scanAxe, seriousViolations } from './lib/assertions.mjs'
import { PRODUCT_A11Y_BASELINE } from '../fairtest/fairtrade-targets.mjs'

const spec = loadAccessibilityMountedFixtures()
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || '5180'}`

async function assertPinnedTheme(page, theme) {
  expect(new URL(page.url()).searchParams.get('theme'), 'each row must explicitly pin its theme in the URL').toBe(theme)
  expect(await page.locator('html').getAttribute('data-theme'), 'the scanned theme must be the actual rendered theme').toBe(theme)
}

async function assertMinimumTarget(control, name) {
  const bounds = await control.evaluate(el => ({ height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width, minimum: parseFloat(getComputedStyle(el).getPropertyValue('--target-min')) }))
  expect(bounds.height, `${name}: minimum target height`).toBeGreaterThanOrEqual(bounds.minimum)
  expect(bounds.width, `${name}: minimum target width`).toBeGreaterThanOrEqual(bounds.minimum)
}

for (const surface of spec.surfaces) for (const width of spec.widths) {
  test(`accessibility ${surface.name} ${width}`, async ({ page }, info) => {
    const theme = info.project.name
    expect(spec.themes).toContain(theme)
    await page.setViewportSize({width, height:900})
    await page.goto(`${origin}/?fb=off&${surface.query}&theme=${theme}#inuse`, {waitUntil:'networkidle'})
    await assertPinnedTheme(page, theme)
    await expect(page.locator(surface.mounted).first()).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    // A different worktree's server must not supply this row's evidence.
    const assets = await page.locator('link[rel="stylesheet"][href^="/assets/"], script[type="module"][src^="/assets/"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href') || node.getAttribute('src')))
    expect(assets.length).toBeGreaterThan(0)
    const provenance = []
    for (const asset of assets) {
      const bytes = await (await page.request.get(new URL(asset, origin).href)).body()
      expect(bytes, `served asset ${asset} must match this checkout`).toEqual(readFileSync(join(ROOT, 'dist', asset.slice(1))))
      if (asset.endsWith('.js')) expect(bytes.toString()).toContain('txn-turn-heading')
      provenance.push({asset, sha256:createHash('sha256').update(bytes).digest('hex')})
    }
    const scan = await scanAxe(page, {root:surface.root})
    expect(scan.passes, 'the mounted scan must not be empty').toBeGreaterThan(0)
    expect(PRODUCT_A11Y_BASELINE.points.initial).toEqual(spec.baseline)
    expect(PRODUCT_A11Y_BASELINE.points['after-action']).toEqual(spec.baseline)
    expect(seriousViolations(scan), `${surface.name}/${width}/${theme} has a zero critical/serious baseline`).toEqual(spec.baseline)
    if (surface.outcomeSelector && width === 1440) {
      const outcome = page.locator(surface.outcomeSelector).first()
      await expect(outcome).toHaveCSS('white-space', 'nowrap')
      await expect(outcome).toHaveCSS('flex-shrink', '0')
    }
    const evidence = {surface:surface.name, width, theme, url:page.url(), head:process.env.CAPTURE_HEAD, provenance, baseline:spec.baseline, scan}
    await info.attach('accessibility.json', {body:JSON.stringify(evidence, null, 2), contentType:'application/json'})

    if (surface.keyboard === 'tree') {
      const tree = page.getByRole('tree', {name:'code areas'})
      const first = tree.locator('[role="treeitem"][tabindex="0"]')
      await first.focus()
      const before = await first.textContent()
      await page.keyboard.press('ArrowDown')
      await expect(tree.locator('[role="treeitem"][tabindex="0"]')).toBeFocused()
      expect(await tree.locator('[role="treeitem"][tabindex="0"]').textContent()).not.toBe(before)
      await page.keyboard.press('Enter')
      await expect(tree.locator('[role="treeitem"][tabindex="0"]')).toHaveAttribute('aria-selected','true')
    } else if (surface.keyboard === 'turn') {
      const disclosure = page.locator('.txn-turn-disclosure').first()
      await disclosure.focus()
      await disclosure.press('Enter')
      await expect(disclosure).toHaveAttribute('aria-expanded','false')
      await disclosure.press('Space')
      await expect(disclosure).toHaveAttribute('aria-expanded','true')
      await expect(page.locator('article.txn-turnwrap .txn-turn-heading').first()).toBeAttached()
      // Open real tool content and Tab into its horizontal scroller.
      const tool = page.locator('.txn-tc-head').first()
      await tool.press('Enter')
      const code = page.locator('pre.txn-code').first()
      await expect(code).toBeVisible()
      await tool.press('Tab')
      await expect(code).toBeFocused()
      await page.keyboard.press('ArrowRight')
    } else if (surface.keyboard === 'drilldown') {
      const summary = page.locator('.gan-tile summary').first()
      await summary.focus()
      await summary.press('Enter')
      await expect(summary.locator('..')).toHaveAttribute('open','')
      await summary.press('Enter')
    } else {
      await expect(page.locator('.srow-announcement')).toHaveCount(1)
      await expect(page.locator('.srow-status[aria-live]')).toHaveCount(0)
      const setting = page.locator('.srow .sw').first()
      await setting.focus()
      await setting.press('Space')
      await expect(page.locator('.srow-announcement')).toContainText('saved')
    }
    for (const selector of surface.prose || []) {
      const prose = page.locator(selector).first()
      await expect(prose).toBeAttached()
      const spacing = await prose.evaluate(el => {
        const style = getComputedStyle(el)
        const reference = document.createElement('span')
        reference.style.cssText = 'font-size:inherit;letter-spacing:var(--tracking-prose);word-spacing:var(--word-spacing-prose)'
        el.appendChild(reference)
        const expected = getComputedStyle(reference)
        const result = { actual: [style.letterSpacing, style.wordSpacing], expected: [expected.letterSpacing, expected.wordSpacing] }
        reference.remove()
        return result
      })
      expect(spacing.actual, `${selector} uses canonical prose spacing`).toEqual(spacing.expected)
    }
    if (process.env.A11Y_CAPTURE_DIR) {
      const dir = process.env.A11Y_CAPTURE_DIR
      mkdirSync(dir, {recursive:true})
      const name = `${surface.name.replaceAll(' ','-')}-${theme}-${width}`
      await page.locator('#inuse').screenshot({path:join(dir, `${name}.png`)})
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(evidence, null, 2))
    }
  })
}

for (const width of spec.widths) {
  test(`accessibility minimum targets ${width}`, async ({ page }, info) => {
    const theme = info.project.name
    for (const target of spec.targets) {
      if (target.desktopOnly && width < 1440) continue
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${origin}/?fb=off&${target.query}&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
      await assertPinnedTheme(page, theme)
      const control = page.locator(target.selector).first()
      await expect(control, target.name).toBeVisible()
      await assertMinimumTarget(control, target.name)
    }
  })
}

test('accessibility mutations fail for their declared reason', async ({ page }, info) => {
  const theme = info.project.name
  await page.goto(`${origin}/?fb=off&app=graph&section=map&theme=${theme}#inuse`, {waitUntil:'networkidle'})
  await expect(page.locator('.gmp-navigator-tree')).toBeVisible()
  for (const mutation of spec.mutations) {
    if (mutation.kind === 'theme-pin') {
      await page.evaluate(() => { const url = new URL(location.href); url.searchParams.delete('theme'); history.replaceState(null,'',url) })
      await expect(assertPinnedTheme(page,theme), mutation.name).rejects.toThrow(/pin its theme/)
      await page.evaluate(theme => { const url = new URL(location.href); url.searchParams.set('theme',theme); history.replaceState(null,'',url) },theme)
    } else if (mutation.kind === 'rendered-theme') {
      await page.locator('html').evaluate((el, theme) => el.setAttribute('data-theme',theme === 'dark' ? 'light' : 'dark'),theme)
      await expect(assertPinnedTheme(page,theme),mutation.name).rejects.toThrow(/actual rendered theme/)
      await page.locator('html').evaluate((el,theme) => el.setAttribute('data-theme',theme),theme)
    } else if (mutation.kind === 'outcome-wrap') {
      const outcome = page.locator('.gmp-outcome').first()
      await outcome.evaluate(el => { el.style.whiteSpace = 'normal'; el.style.flexShrink = '1' })
      await expect(expect(outcome).toHaveCSS('white-space', 'nowrap', { timeout: 100 })).rejects.toThrow()
      await expect(expect(outcome).toHaveCSS('flex-shrink', '0', { timeout: 100 })).rejects.toThrow()
      await outcome.evaluate(el => el.removeAttribute('style'))
    } else if (mutation.kind === 'minimum-target') {
      await page.goto(`${origin}/?fb=off&app=transcript&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
      const anchor = page.locator('.txn-anchor').first()
      await expect(anchor).toBeVisible()
      await anchor.evaluate(el => { el.style.width = '22px'; el.style.height = '22px' })
      await expect(assertMinimumTarget(anchor, mutation.name)).rejects.toThrow(/minimum target/)
    } else {
      await page.evaluate(kind => {
        if (kind === 'tree-children') document.querySelector('.gmp-navigator-disclosure').removeAttribute('aria-hidden')
        else { const button = document.createElement('button'); button.dataset.a11yMutation = ''; document.querySelector('.iu-view').appendChild(button) }
      },mutation.kind)
      const scan = await scanAxe(page,{root:'.iu-view'})
      expect(seriousViolations(scan).map(v => v.id),mutation.name).toContain(mutation.violation)
      expect(seriousViolations(scan),mutation.name).not.toEqual(spec.baseline)
      await page.evaluate(() => { document.querySelector('.gmp-navigator-disclosure').setAttribute('aria-hidden','true'); document.querySelector('[data-a11y-mutation]')?.remove() })
    }
  }
})

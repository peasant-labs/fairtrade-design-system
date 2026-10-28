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

/* the one minimum-target rule, applied to measured bounds */
function checkMinimumTarget(bounds, name) {
  expect(bounds.height, `${name}: minimum target height`).toBeGreaterThanOrEqual(bounds.minimum)
  expect(bounds.width, `${name}: minimum target width`).toBeGreaterThanOrEqual(bounds.minimum)
}

async function assertMinimumTarget(control, name) {
  checkMinimumTarget(await control.evaluate(el => ({ height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width, minimum: parseFloat(getComputedStyle(el).getPropertyValue('--target-min')) })), name)
}

for (const surface of spec.surfaces) for (const width of spec.widths) for (const theme of spec.themes) {
  test(`accessibility ${surface.name} ${width} ${theme}`, async ({ page }, info) => {
    // The fixture row owns theme meaning; the project only selects its matching row.
    test.skip(info.project.name !== theme)
    await page.setViewportSize({width, height:900})
    await page.goto(`${origin}/?fb=off&${surface.query}&theme=${theme}#inuse`, {waitUntil:'networkidle'})
    await assertPinnedTheme(page, theme)
    await expect(page.locator(surface.mounted).first()).toBeVisible()
    if (surface.passiveStickySelector) {
      const sticky = page.locator(surface.passiveStickySelector).first()
      await expect(sticky).toHaveCSS('pointer-events', 'none')
    }
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
    const insightReadings = []
    for (const row of spec.insightReadings.filter(row => row.surface === surface.name)) {
      const readings = page.locator(row.selector)
      expect(await readings.count(), `${row.name}: nonempty production mount`).toBeGreaterThan(0)
      for (const reading of await readings.all()) {
        await expect(reading, row.name).toBeVisible()
        expect((await reading.textContent()).trim(), `${row.name}: nonempty reading text`).not.toBe('')
        const measure = () => reading.evaluate((el, row) => {
          const style = getComputedStyle(el)
          const panel = el.closest(row.panel)
          const item = el.closest(row.item)
          const bounds = node => {
            const box = node.getBoundingClientRect()
            return {left:box.left, right:box.right, top:box.top, bottom:box.bottom, width:box.width, height:box.height}
          }
          const reference = document.createElement('span')
          reference.style.fontSize = `var(${row.fontToken})`
          el.appendChild(reference)
          const tokenPx = parseFloat(getComputedStyle(reference).fontSize)
          reference.remove()
          const range = document.createRange()
          range.selectNodeContents(el)
          const textRects = [...range.getClientRects()].map(box => ({left:box.left, right:box.right, top:box.top, bottom:box.bottom}))
          return {fontPx:parseFloat(style.fontSize), tokenPx, lineHeight:parseFloat(style.lineHeight), whiteSpace:style.whiteSpace, lineClamp:style.webkitLineClamp, panel:bounds(panel), item:bounds(item), panelClientWidth:panel.clientWidth, panelScrollWidth:panel.scrollWidth, panelClientHeight:panel.clientHeight, panelScrollHeight:panel.scrollHeight, textRects}
        }, row)
        const observed = await measure()
        expect(observed.fontPx, `${row.name}: canonical body token`).toBe(observed.tokenPx)
        expect(observed.fontPx, `${row.name}: reading floor`).toBe(row.expectedPx)
        expect(observed.lineHeight / observed.fontPx, `${row.name}: wrapping leading`).toBeGreaterThanOrEqual(row.minimumLeading)
        expect(observed.whiteSpace, `${row.name}: no forced single line`).not.toBe('nowrap')
        expect(observed.lineClamp, `${row.name}: no clipped lines`).toBe('none')
        expect(observed.panel.width, `${row.name}: nonzero panel`).toBeGreaterThan(0)
        expect(observed.panelScrollWidth, `${row.name}: panel horizontal reflow`).toBeLessThanOrEqual(observed.panelClientWidth + row.tolerancePx)
        expect(observed.panelScrollHeight, `${row.name}: panel vertical reflow`).toBeLessThanOrEqual(observed.panelClientHeight + row.tolerancePx)
        expect(observed.textRects.length, `${row.name}: painted text geometry`).toBeGreaterThan(0)
        for (const rect of observed.textRects) {
          expect(rect.left, `${row.name}: text inside item left`).toBeGreaterThanOrEqual(observed.item.left - row.tolerancePx)
          expect(rect.right, `${row.name}: text inside item right`).toBeLessThanOrEqual(observed.item.right + row.tolerancePx)
          expect(rect.top, `${row.name}: text inside item top`).toBeGreaterThanOrEqual(observed.item.top - row.tolerancePx)
          expect(rect.bottom, `${row.name}: text inside item bottom`).toBeLessThanOrEqual(observed.item.bottom + row.tolerancePx)
        }
        expect(await measure(), `${row.name}: stable mounted panel and text geometry`).toEqual(observed)
        insightReadings.push({name:row.name, selector:row.selector, ...observed})
      }
    }
    const evidence = {surface:surface.name, width, theme, url:page.url(), head:process.env.CAPTURE_HEAD, provenance, insightReadings, baseline:spec.baseline, scan}
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
      // Ledger is scanned above; classic separately retains the keyboard disclosure contract.
      await page.goto(`${origin}/?fb=off&app=transcript&transcript=classic&theme=${theme}#inuse`)
      const disclosure = page.locator('.txn-turn-disclosure').first()
      await disclosure.focus()
      await disclosure.press('Enter')
      await expect(disclosure).toHaveAttribute('aria-expanded','false')
      await disclosure.press('Space')
      await expect(disclosure).toHaveAttribute('aria-expanded','true')
      await expect(page.locator('article.txn-turnwrap .txn-turn-heading').first()).toBeAttached()
      // Open real tool content and Tab into its horizontal scroller.
      // a thinking row shares the tool-row head, so select a real tool call's head
      const tool = page.locator('.txn-toolcall .txn-tc-head').first()
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
      if (insightReadings.length) await page.locator(spec.insightReadings.find(row => row.surface === surface.name).panel).first().screenshot({path:join(dir, `${name}-insights.png`)})
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(evidence, null, 2))
    }
  })
}

for (const width of spec.widths) for (const theme of spec.themes) {
  test(`accessibility minimum targets ${width} ${theme}`, async ({ page }, info) => {
    test.skip(info.project.name !== theme)
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

for (const theme of spec.themes) test(`accessibility mutations fail for their declared reason ${theme}`, async ({ page }, info) => {
  test.skip(info.project.name !== theme)
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
    } else if (mutation.kind === 'sticky-pointer') {
      await page.goto(`${origin}/?fb=off&app=transcript&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
      const sticky = page.locator('.txn-phase').first()
      await expect(sticky).toHaveCSS('pointer-events', 'none')
      await sticky.evaluate(el => { el.style.pointerEvents = 'auto' })
      await expect(expect(sticky).toHaveCSS('pointer-events', 'none', { timeout: 100 })).rejects.toThrow()
      await sticky.evaluate(el => el.style.removeProperty('pointer-events'))
    } else if (mutation.kind === 'minimum-target') {
      await page.goto(`${origin}/?fb=off&app=transcript&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
      const anchor = page.locator('.txn-anchor').first()
      await expect(anchor).toBeVisible()
      // shrink and measure the same node in one step. the anchor transitions its size, so the new box
      // only lands once those transitions finish; measure after that. the shrink must have taken, and
      // the one rule must reject it
      const shrunk = await anchor.evaluate(async el => {
        el.style.width = '22px'
        el.style.height = '22px'
        await Promise.all(el.getAnimations().map(animation => animation.finished))
        const box = el.getBoundingClientRect()
        return { connected: el.isConnected, height: box.height, width: box.width, minimum: parseFloat(getComputedStyle(el).getPropertyValue('--target-min')) }
      })
      expect(shrunk.connected && shrunk.width === 22 && shrunk.height === 22, `${mutation.name}: the anchor must be shrunk to 22px ${JSON.stringify(shrunk)}`).toBe(true)
      expect(() => checkMinimumTarget(shrunk, mutation.name)).toThrow(/minimum target/)
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

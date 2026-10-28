import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { loadDenseTypeFixtures } from '../dense-type-fixtures.mjs'
import { ROOT } from '../css-source.mjs'

const spec = loadDenseTypeFixtures()
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || '5180'}`

async function openTranscript(page, info, row) {
  const theme = spec.themes.find(theme => theme === info.project.name)
  expect(theme).toBeTruthy()
  await page.setViewportSize({ width: row.width, height: 900 })
  await page.goto(`${origin}/?fb=off&${row.query}&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  expect(await page.locator('html').getAttribute('data-theme') || 'dark').toBe(theme)
  const assets = await page.locator('link[rel="stylesheet"][href^="/assets/"], script[type="module"][src^="/assets/"]').evaluateAll(nodes => nodes.map(el => el.getAttribute('href') || el.getAttribute('src')))
  const provenance = []
  for (const asset of assets) {
    const response = await page.request.get(new URL(asset, origin).href)
    const bytes = await response.body()
    expect(bytes).toEqual(readFileSync(join(ROOT, 'dist', asset.replace(/^\//, ''))))
    if (asset.endsWith('.js')) expect(bytes.toString()).toContain('revealRequest')
    provenance.push({ asset, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  expect(provenance).toHaveLength(2)
  if (process.env.DENSE_FOCUSED_CAPTURE_DIR) {
    mkdirSync(process.env.DENSE_FOCUSED_CAPTURE_DIR, { recursive: true })
    writeFileSync(join(process.env.DENSE_FOCUSED_CAPTURE_DIR, `provenance-${theme}.json`), JSON.stringify({ head: process.env.CAPTURE_HEAD, origin, theme, assets: provenance }, null, 2))
  }
  return theme
}

async function captureTranscript(page, theme, state) {
  const capture = process.env.DENSE_FOCUSED_CAPTURE_DIR
  if (!capture) return
  mkdirSync(capture, { recursive: true })
  await page.locator('#inuse').screenshot({ path: join(capture, `${state}-${theme}-390.png`) })
}

test(spec.expandedTools.name, async ({ page }, info) => {
  const row = spec.expandedTools
  const theme = await openTranscript(page, info, row)
  for (const reading of row.readings) {
    const button = page.locator('.txn-tc-head').filter({ hasText: reading.buttonText }).first()
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await button.click()
    const text = button.locator('..').locator(reading.selector).filter({ hasText: reading.text }).first()
    await expect(text).toBeVisible()
    expect(await text.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(reading.minimumPx)
    await text.scrollIntoViewIfNeeded()
    await captureTranscript(page, theme, reading.selector === '.txn-tc-desc' ? 'expanded-description' : 'expanded-task')
  }
})

test(spec.collapsedSearch.name, async ({ page }, info) => {
  const row = spec.collapsedSearch
  const theme = await openTranscript(page, info, row)
  const turn = page.locator(`#turn-${row.turn}`)
  const disclosure = turn.locator('.txn-turn-disclosure')
  const body = page.locator(`[id="${await disclosure.getAttribute('aria-controls')}"]`)
  const other = page.locator(`#turn-${row.otherTurn} .txn-turn-disclosure`)
  await disclosure.click()
  await other.click()
  await expect(body).toBeHidden()
  // Passive scroll tracking can change the active turn, but must not reveal it.
  await page.locator('.txn-stream').evaluate(el => { el.scrollTop = el.scrollHeight })
  await expect.poll(() => page.locator('.txn-active').evaluate(el => el.closest('.txn-turnwrap').getAttribute('data-turn'))).not.toBe(String(row.turn))
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  await expect(other).toHaveAttribute('aria-expanded', 'false')
  await page.locator('.txn-search-trigger').click()
  await page.getByRole('textbox', { name: 'search transcript' }).fill(row.text)
  await expect(page.locator('.txn-search-count')).toHaveText(row.count)
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  await expect(body).toBeVisible()
  await expect(body.getByText(row.text, { exact: false })).toBeVisible()
  await expect(other).toHaveAttribute('aria-expanded', 'false')
  // Navigating the same single result is still an explicit reveal request.
  await disclosure.click()
  await page.getByRole('button', { name: 'next match', exact: true }).click()
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  await expect(other).toHaveAttribute('aria-expanded', 'false')
  await captureTranscript(page, theme, 'search-reveal')
})

// Measure the actual mounted elements, not a synthetic stand-in for their CSS.
function inspect({ row, mutation }) {
  const elements = [...document.querySelectorAll(row.selector)].filter(el => el.getClientRects().length)
  const errors = elements.length ? [] : ['not mounted']
  for (const el of elements) {
    const saved = el.style.cssText
    if (mutation) {
      el.style.setProperty('transition', 'none', 'important')
      if (row.reflowMutation === 'zero-width') {
        el.style.setProperty('flex', '0 0 0px', 'important')
        el.style.setProperty('max-width', '0px', 'important')
      } else if (row.reflowMutation === 'overlay') {
        el.style.setProperty('position', 'absolute', 'important')
        el.style.setProperty('bottom', '0px', 'important')
      } else if (row.reflow) el.style.setProperty('min-width', '10000px', 'important')
      else {
        el.style.setProperty('font-size', '11px', 'important')
        if (row.paragraphGap) el.style.setProperty('margin-top', '0', 'important')
        if (row.wrap) el.style.setProperty('white-space', 'nowrap', 'important')
      }
    }
    const cs = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    if (parseFloat(cs.fontSize) < row.minimumPx) errors.push(`font ${cs.fontSize} < ${row.minimumPx}`)
    if (row.wrap && (cs.whiteSpace === 'nowrap' || cs.webkitLineClamp !== 'none' || parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) < 1.4)) errors.push('text does not wrap with comfortable leading')
    if (row.familyToken) {
      const family = getComputedStyle(document.documentElement).getPropertyValue(row.familyToken).trim().split(',')[0].replace(/["']/g, '')
      if (!cs.fontFamily.includes(family)) errors.push(`wrong family ${cs.fontFamily}`)
    }
    if (row.paragraphGap && el.previousElementSibling?.matches('.txn-md-prose')) {
      const gap = box.top - el.previousElementSibling.getBoundingClientRect().bottom
      if (Math.abs(parseFloat(cs.marginTop) - parseFloat(cs.lineHeight)) > 1 || Math.abs(gap - parseFloat(cs.lineHeight)) > 1) errors.push('paragraph gap is not one line')
    }
    if (row.headingGap && parseFloat(cs.marginTop) < 2 * parseFloat(cs.fontSize) - 1) errors.push('heading gap is less than two em')
    if (row.reflow && (box.width <= 0 || box.right > el.parentElement.getBoundingClientRect().right + 1 || el.scrollWidth > el.clientWidth + 1)) errors.push('dense row overflows')
    if (row.reflowMutation === 'overlay' && box.top < document.querySelector('.txn-body-grid').getBoundingClientRect().bottom - 1) errors.push('footer overlaps reading content')
    el.style.cssText = saved
  }
  return errors
}

test('dense text, reflow and disclosure on the built product', async ({ page }, info) => {
  test.setTimeout(180_000)
  const theme = spec.themes.find(theme => theme === info.project.name)
  expect(theme, 'project must select a named theme fixture').toBeTruthy()
  const capture = process.env.DENSE_CAPTURE_DIR
  const observations = []
  if (capture) mkdirSync(capture, { recursive: true })
  for (const width of spec.widths) {
    await page.setViewportSize({ width, height: 900 })
    for (const [query, rows] of Map.groupBy(spec.measurements.filter(row => !row.desktopOnly || width === 1440), row => row.query)) {
      await page.goto(`${origin}/?fb=off&${query}&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
      await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
      await page.evaluate(() => document.fonts.ready)
      expect(await page.locator('html').getAttribute('data-theme')).toBe(theme)
      const asset = await page.locator('link[rel="stylesheet"][href^="/assets/"]').first().getAttribute('href')
      const response = await page.request.get(new URL(asset, origin).href)
      expect(await response.text(), 'served build must equal the exact local production asset').toBe(readFileSync(join(ROOT, 'dist', asset.replace(/^\//, '')), 'utf8'))
      expect(readFileSync(join(ROOT, 'dist', asset.replace(/^\//, '')), 'utf8')).toContain('txn-turn-disclosure')
      for (const row of rows) {
        expect(await page.evaluate(inspect, { row }), `${row.name} at ${width}/${theme}`).toEqual([])
        expect((await page.evaluate(inspect, { row, mutation: true })).length, row.mutation).toBeGreaterThan(0)
        observations.push({ name: row.name, width, theme, computed: await page.locator(row.selector).evaluateAll(elements => elements.filter(el => el.getClientRects().length).map(el => {
          const style = getComputedStyle(el)
          return { fontSize: style.fontSize, fontFamily: style.fontFamily, lineHeight: style.lineHeight, marginTop: style.marginTop, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }
        })) })
      }
      if (query === spec.case.query) {
        const marker = page.locator(spec.case.selector).first()
        await expect(marker).toBeAttached()
        const original = await marker.textContent()
        // Substitute mixed-case fixture input only at the rendered content node. This tests
        // the production CSS inheritance boundary without changing the real demo's data.
        await marker.evaluate((el, text) => { el.textContent = text }, spec.case.text)
        const rendered = await marker.evaluate(el => ({ text: el.textContent, transform: getComputedStyle(el).textTransform }))
        expect(rendered).toEqual({ text: spec.case.text, transform: 'none' })
        await marker.evaluate(el => el.style.textTransform = 'lowercase')
        expect(await marker.evaluate(el => getComputedStyle(el).textTransform), spec.case.mutation).not.toBe('none')
        await marker.evaluate((el, text) => { el.style.removeProperty('text-transform'); el.textContent = text }, original)
        await page.goto(`${origin}/?fb=off&app=transcript&transcript=classic&theme=${theme}#inuse`, { waitUntil: 'networkidle' })
        const disclosure = page.locator('.txn-turn-disclosure').first()
        const bodyId = await disclosure.getAttribute('aria-controls')
        const body = page.locator(`[id="${bodyId}"]`)
        await expect(body).toBeVisible()
        await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
        await disclosure.click()
        await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
        await expect(body).toBeHidden()
        await disclosure.click()
        await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
        await expect(body).toBeVisible()
        await expect(page.locator('.txn-tc-head[aria-expanded="true"]')).toHaveCount(0)
        if (width === 1440) {
          const toolGroups = page.locator('.txn-toolcat-toggle')
          await expect(toolGroups).toHaveAttribute('aria-expanded', 'false')
          await toolGroups.click()
          for (const label of spec.toolGroupLabels) await expect(page.locator('.txn-toolgroups').getByText(label, { exact: true })).toBeVisible()
          await page.reload({ waitUntil: 'networkidle' })
          await expect(toolGroups).toHaveAttribute('aria-expanded', 'true')
          for (const label of spec.toolGroupLabels) await expect(page.locator('.txn-toolgroups').getByText(label, { exact: true })).toBeVisible()
          await toolGroups.click()
        }
      }
      if (query.includes('analytics')) {
        const tile = page.locator('.gan-tile details').first()
        await expect(tile).not.toHaveAttribute('open', '')
        await tile.locator('summary').click()
        await expect(tile).toHaveAttribute('open', '')
        await expect(tile.locator('.gan-tile-detail')).toBeVisible()
        await tile.locator('summary').click()
      }
      if (capture) {
        const params = new URLSearchParams(query)
        const surface = params.get('section') ?? params.get('commons') ?? params.get('app')
        if (surface === 'transcript') {
          await page.locator('.txn-stream').evaluate(el => { el.scrollTop = 120 })
          await expect(page.locator('.txn-app')).toHaveClass(/txn-app-condensed/)
        }
        await page.locator('#inuse').screenshot({ path: join(capture, `${surface}-${theme}-${width}.png`) })
      }
    }
  }
  await info.attach('dense-computed-styles', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' })
})

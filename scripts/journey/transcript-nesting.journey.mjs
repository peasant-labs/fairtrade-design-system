/* Geometry belongs to the mounted viewer: source/JSDOM cannot measure an inset. */
import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'

const fixture = loadStrictYaml('scripts/testdata/transcript-nesting.yaml')
const manifest = loadStrictYaml('scripts/testdata/transcript-nesting.manifest.yaml')
assertExactNames(fixture.cases.map(row => row.name), manifest.requiredCases, 'nested turns')
assertExactNames(fixture.themes, manifest.requiredThemes, 'nesting themes')
assertExactNames(fixture.presentations, manifest.requiredPresentations, 'nesting presentations')
assertExactNames(fixture.viewports.map(row => row.name), manifest.requiredViewports, 'nesting viewports')
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`

for (const viewport of fixture.viewports) test(`nested agent insets ${viewport.name}`, async ({ page }, info) => {
  expect(fixture.themes).toContain(info.project.name)
  await page.setViewportSize(viewport)
  await page.goto(`${origin}/?app=transcript&transcript=ledger-nesting&fb=off&theme=${info.project.name}#inuse`)
  await expect(page.locator('.txn-app')).toHaveAttribute('data-theme', info.project.name)
  await page.evaluate(async () => { await document.fonts.ready; document.getElementById('inuse').scrollIntoView({ block: 'start', behavior: 'instant' }) })
  for (const row of fixture.cases) {
    const article = page.locator(`#turn-${row.index}`)
    await expect(article).toHaveAttribute('data-source-entry-ref', `nested-entry-${row.index}`)
    const geometry = await article.evaluate(el => {
      const style = getComputedStyle(el)
      return { padding: parseFloat(style.paddingInlineStart), border: parseFloat(style.borderInlineStartWidth), before: getComputedStyle(el, '::before').content, width: el.getBoundingClientRect().width, stream: el.closest('.txn-stream').clientWidth }
    })
    expect(geometry.padding, row.name).toBe(row.inset * viewport.step)
    expect(geometry.border, 'no connector border').toBe(0)
    expect(geometry.before, 'no connector pseudo-element').toMatch(/^(none|normal)$/)
    expect(geometry.width).toBeLessThanOrEqual(geometry.stream)
  }
  const child = page.locator('#turn-3 .txn-turn')
  await child.click()
  await expect(child).toHaveClass(/txn-active/)
  await page.locator('#turn-1').evaluate(el => { const stream = el.closest('.txn-stream'); stream.scrollTop += el.getBoundingClientRect().top - stream.getBoundingClientRect().top })
  await info.attach('nested-agent-reading', { body: await page.screenshot(), contentType: 'image/png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})

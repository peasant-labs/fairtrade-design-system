/* Journey: the transcript's scrolling columns never scroll sideways, on the built demo, both themes,
 * desktop and phone.
 *
 * Reads scripts/testdata/transcript-columns.yaml (+ .manifest.yaml). Every visible scrolling column
 * (the trace stream, the filters rail) must have scrollWidth equal to clientWidth: a closed
 * definition bubble, or anything else hidden, may not widen it, so a sideways swipe never slides the
 * conversation off its edge. A named CSS mutation proves the gate fails for that reason.
 */
import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'

const FIXTURE = 'scripts/testdata/transcript-columns.yaml'
const MANIFEST = 'scripts/testdata/transcript-columns.manifest.yaml'
const spec = loadStrictYaml(FIXTURE)
const manifest = loadStrictYaml(MANIFEST)
assertExactNames(spec.screens.map((s) => s.name), manifest.requiredScreenNames, `${FIXTURE} screens`)
assertExactNames(spec.viewports.map((v) => v.name), manifest.requiredViewportNames, `${FIXTURE} viewports`)
assertExactNames(spec.columns.map((c) => c.name), manifest.requiredColumnNames, `${FIXTURE} columns`)
assertExactNames(spec.mutations.map((m) => m.name), manifest.requiredMutationNames, `${FIXTURE} mutations`)

const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`
const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

/** In the page: each visible column's scroll and client widths. */
const measure = (columns) => columns.map(({ name, selector }) => {
  const el = document.querySelector(selector)
  if (!el || el.getClientRects().length === 0) return { name, visible: false }
  return { name, visible: true, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
})

const failuresFor = (measured, where) => measured
  .filter((column) => column.visible && column.scrollWidth > column.clientWidth)
  .map((column) => `${where} ${column.name}: ${column.scrollWidth - column.clientWidth}px wider than its box (scrollWidth ${column.scrollWidth}, clientWidth ${column.clientWidth})`)

const open = async (page, screen, viewport, theme) => {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.goto(`${origin}/${screen.path}&fb=off&theme=${theme}#inuse`)
  await expect(page.locator(spec.columns[0].selector)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(settle)
}

for (const viewport of spec.viewports) {
  for (const screen of spec.screens) {
    test(`transcript columns ${screen.name} ${viewport.name}`, async ({ page }, info) => {
      await open(page, screen, viewport, info.project.name)
      const measured = await page.evaluate(measure, spec.columns)
      await info.attach(`${screen.name}-${viewport.name}-columns`, { body: JSON.stringify(measured, null, 2), contentType: 'application/json' })
      expect(measured.some((column) => column.visible), `${screen.name}: a column must be measured`).toBe(true)
      const failures = failuresFor(measured, `${screen.name} ${viewport.name}`)
      expect(failures, failures.join('\n')).toEqual([])
    })
  }
}

test('transcript columns mutations', async ({ page }, info) => {
  const viewport = spec.viewports.find((row) => row.name === spec.mutationViewport)
  await open(page, spec.screens[0], viewport, info.project.name)
  for (const mutation of spec.mutations) {
    const style = await page.addStyleTag({ content: mutation.css })
    await page.evaluate(settle)
    const failures = failuresFor(await page.evaluate(measure, spec.columns), 'mutated')
    await style.evaluate((node) => node.remove())
    await page.evaluate(settle)
    expect(failures.some((line) => line.includes(mutation.expect)), `${mutation.name}: the gate must report "${mutation.expect}", received:\n${failures.join('\n')}`).toBe(true)
  }
})

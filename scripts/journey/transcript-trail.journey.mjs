/* Journey: the transcript trail at every width, on the built Storybook, both themes.
 *
 * Reads scripts/testdata/transcript-trail.yaml (+ .manifest.yaml). Each case is a host's trail at
 * 1440, 1280 or a 390 touch screen: the trail keeps the rule in scripts/transcript-trail-rule.mjs (one
 * line, whole while it fits, the current crumb gives way first down to its floor, every cut ends in an
 * ellipsis, nothing below its floor, nothing cut with room to spare), and exactly the case's `cut`
 * crumbs shorten. Named CSS mutations prove the gate fails for each reason.
 */
import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'
import { measureTrail, trailRuleFailures } from '../transcript-trail-rule.mjs'

const FIXTURE = 'scripts/testdata/transcript-trail.yaml'
const MANIFEST = 'scripts/testdata/transcript-trail.manifest.yaml'
const spec = loadStrictYaml(FIXTURE)
const manifest = loadStrictYaml(MANIFEST)
assertExactNames(spec.viewports.map((row) => row.name), manifest.requiredViewportNames, `${FIXTURE} viewports`)
assertExactNames(spec.cases.map((row) => row.name), manifest.requiredCaseNames, `${FIXTURE} cases`)
assertExactNames(spec.mutations.map((row) => row.name), manifest.requiredMutationNames, `${FIXTURE} mutations`)
const viewportNames = new Set(spec.viewports.map((row) => row.name))
for (const row of spec.cases) for (const name of row.viewports) if (!viewportNames.has(name)) throw new Error(`${FIXTURE}: case "${row.name}" names an unknown viewport "${name}"`)
for (const row of spec.mutations) {
  const target = spec.cases.find((candidate) => candidate.name === row.case)
  if (!target || !target.viewports.includes(row.viewport)) throw new Error(`${FIXTURE}: mutation "${row.name}" must name a case and one of its viewports`)
}

const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

const failuresFor = (row, viewport, trail) => {
  const label = `${row.name} at ${viewport}`
  const failures = trailRuleFailures(label, trail)
  const texts = trail.crumbs.map((crumb) => crumb.text)
  if (JSON.stringify(texts) !== JSON.stringify(row.crumbs)) failures.push(`${label}: the trail must be ${JSON.stringify(row.crumbs)}, received ${JSON.stringify(texts)}`)
  trail.crumbs.forEach((crumb, index) => {
    if (row.cut.includes(index) && !crumb.cut) failures.push(`${label}: "${crumb.text}" must shorten with an ellipsis`)
    if (!row.cut.includes(index) && crumb.cut) failures.push(`${label}: "${crumb.text}" must read whole, it is cut`)
  })
  return failures
}

const open = async (page, row, theme) => {
  await page.goto(`/iframe.html?id=${row.story}&viewMode=story&globals=theme:${theme}`)
  await expect(page.locator('.txn-crumb').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(settle)
}

for (const viewport of spec.viewports) {
  test.describe(`transcript trail at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch })

    for (const row of spec.cases.filter((candidate) => candidate.viewports.includes(viewport.name))) {
      test(row.name, async ({ page }, info) => {
        await open(page, row, info.project.name)
        const failures = failuresFor(row, viewport.name, await page.evaluate(measureTrail, '.txn-crumb'))
        expect(failures, failures.join('\n')).toEqual([])
      })
    }

    for (const mutation of spec.mutations.filter((candidate) => candidate.viewport === viewport.name)) {
      test(`mutation: ${mutation.name}`, async ({ page }, info) => {
        const row = spec.cases.find((candidate) => candidate.name === mutation.case)
        await open(page, row, info.project.name)
        await page.addStyleTag({ content: mutation.css })
        await page.evaluate(settle)
        const failures = failuresFor(row, viewport.name, await page.evaluate(measureTrail, '.txn-crumb'))
        expect(failures.some((line) => line.includes(mutation.expect)), `${mutation.name}: the gate must report "${mutation.expect}", received:\n${failures.join('\n')}`).toBe(true)
      })
    }
  })
}

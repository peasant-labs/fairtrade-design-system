/* Journey: the transcript trail reads whole on a wide screen, on the built Storybook, both themes.
 *
 * Reads scripts/testdata/transcript-trail.yaml (+ .manifest.yaml). At 1440 and 1280 a host's trail of
 * a collective, its name and the transcript's title that fits the header row shows every crumb whole
 * (its text no wider than its box); a trail longer than the row shortens only its last crumb, the
 * title. Named CSS mutations prove the gate fails for each reason.
 */
import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'

const FIXTURE = 'scripts/testdata/transcript-trail.yaml'
const MANIFEST = 'scripts/testdata/transcript-trail.manifest.yaml'
const spec = loadStrictYaml(FIXTURE)
const manifest = loadStrictYaml(MANIFEST)
assertExactNames(spec.viewports.map((row) => row.name), manifest.requiredViewportNames, `${FIXTURE} viewports`)
assertExactNames(spec.cases.map((row) => row.name), manifest.requiredCaseNames, `${FIXTURE} cases`)
assertExactNames(spec.mutations.map((row) => row.name), manifest.requiredMutationNames, `${FIXTURE} mutations`)

const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

/** In the page: each crumb's text and whether its text is cut short. */
const measure = () => [...document.querySelectorAll('.txn-crumb > :not(svg)')].map((el) => ({
  text: el.textContent.trim(),
  cut: el.scrollWidth > el.clientWidth + 1,
}))

const failuresFor = (row, crumbs) => {
  const failures = []
  const texts = crumbs.map((crumb) => crumb.text)
  if (JSON.stringify(texts) !== JSON.stringify(row.crumbs)) failures.push(`${row.name}: the trail must be ${JSON.stringify(row.crumbs)}, received ${JSON.stringify(texts)}`)
  crumbs.forEach((crumb, index) => {
    const last = index === crumbs.length - 1
    if (!crumb.cut || (last && row.lastMayCut)) return
    failures.push(row.lastMayCut ? `${row.name}: "${crumb.text}" is cut short before the title` : `${row.name}: "${crumb.text}" is cut short with room on the row`)
  })
  return failures
}

const open = async (page, story, theme, viewport) => {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.goto(`/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`)
  await expect(page.locator('.txn-crumb').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(settle)
}

for (const viewport of spec.viewports) {
  for (const row of spec.cases) {
    test(`transcript trail ${row.name} ${viewport.name}`, async ({ page }, info) => {
      await open(page, row.story, info.project.name, viewport)
      const failures = failuresFor(row, await page.evaluate(measure))
      expect(failures, failures.join('\n')).toEqual([])
    })
  }
}

test('transcript trail mutations', async ({ page }, info) => {
  for (const mutation of spec.mutations) {
    const row = spec.cases.find((candidate) => candidate.story === mutation.story)
    await open(page, mutation.story, info.project.name, spec.viewports[0])
    await page.addStyleTag({ content: mutation.css })
    await page.evaluate(settle)
    const failures = failuresFor(row, await page.evaluate(measure))
    expect(failures.some((line) => line.includes(mutation.expect)), `${mutation.name}: the gate must report "${mutation.expect}", received:\n${failures.join('\n')}`).toBe(true)
  }
})

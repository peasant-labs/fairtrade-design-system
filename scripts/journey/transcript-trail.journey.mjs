/* Journey: the transcript trail reads whole when the row has room, on the built Storybook, both themes.
 *
 * Reads scripts/testdata/transcript-trail.yaml (+ .manifest.yaml). At 1440 a host's trail of a
 * collective, its name and the transcript's title fits the header row, so no crumb may be cut by an
 * ellipsis (its text no wider than its box). The trail's caps on its first and last crumbs are shares
 * of the room it has; sized to its own content they cut crumbs short even with room to spare. A named
 * CSS mutation proves the gate fails for that reason.
 */
import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'

const FIXTURE = 'scripts/testdata/transcript-trail.yaml'
const MANIFEST = 'scripts/testdata/transcript-trail.manifest.yaml'
const spec = loadStrictYaml(FIXTURE)
const manifest = loadStrictYaml(MANIFEST)
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
  for (const crumb of crumbs) if (crumb.cut) failures.push(`${row.name}: "${crumb.text}" is cut short with room on the row`)
  return failures
}

const open = async (page, story, theme) => {
  await page.setViewportSize(spec.viewport)
  await page.goto(`/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`)
  await expect(page.locator('.txn-crumb').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(settle)
}

for (const row of spec.cases) {
  test(`transcript trail ${row.name}`, async ({ page }, info) => {
    await open(page, row.story, info.project.name)
    const failures = failuresFor(row, await page.evaluate(measure))
    expect(failures, failures.join('\n')).toEqual([])
  })
}

test('transcript trail mutations', async ({ page }, info) => {
  for (const mutation of spec.mutations) {
    const row = spec.cases.find((candidate) => candidate.story === mutation.story)
    await open(page, mutation.story, info.project.name)
    await page.addStyleTag({ content: mutation.css })
    await page.evaluate(settle)
    const failures = failuresFor(row, await page.evaluate(measure))
    expect(failures.some((line) => line.includes(mutation.expect)), `${mutation.name}: the gate must report "${mutation.expect}", received:\n${failures.join('\n')}`).toBe(true)
  }
})

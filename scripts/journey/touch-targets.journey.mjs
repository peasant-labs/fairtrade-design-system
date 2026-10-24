/* Journey: on a touch screen every control reaches 44px, on the built Storybook, both themes, 390.
 *
 * Reads scripts/testdata/touch-targets.yaml (+ .manifest.yaml). Each target story opens with touch
 * on (pointer: coarse), and every visible match of the target's selector must offer a hit box at
 * least the fixture's size: its own box, or the positioned ::before / ::after reach a small control
 * (a switch) draws around itself. A switch keeps its small track, and a mouse keeps the desktop
 * size. Named CSS mutations prove the gate fails for each reason.
 */
import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'

const FIXTURE = 'scripts/testdata/touch-targets.yaml'
const MANIFEST = 'scripts/testdata/touch-targets.manifest.yaml'
const spec = loadStrictYaml(FIXTURE)
const manifest = loadStrictYaml(MANIFEST)
assertExactNames(spec.targets.map((t) => t.name), manifest.requiredTargetNames, `${FIXTURE} targets`)
assertExactNames(spec.mutations.map((m) => m.name), manifest.requiredMutationNames, `${FIXTURE} mutations`)

const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

/** In the page: the smallest hit box and the tallest drawn box among a target's visible matches. */
const measure = ({ name, selector }) => {
  const matches = [...document.querySelectorAll(selector)].filter((el) => el.getClientRects().length > 0)
  if (matches.length === 0) return { name, found: 0 }
  const boxes = matches.map((el) => {
    const box = el.getBoundingClientRect()
    let height = box.height
    let width = box.width
    for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(el, pseudo)
      if (style.content === 'none' || style.content === 'normal' || style.position !== 'absolute') continue
      height = Math.max(height, parseFloat(style.height) || 0)
      width = Math.max(width, parseFloat(style.width) || 0)
    }
    return { height, width, drawn: box.height }
  })
  const round = (value) => Math.round(value * 10) / 10
  return {
    name,
    found: matches.length,
    coarse: matchMedia('(pointer: coarse)').matches,
    hitHeight: round(Math.min(...boxes.map((b) => b.height))),
    hitWidth: round(Math.min(...boxes.map((b) => b.width))),
    drawn: round(Math.max(...boxes.map((b) => b.drawn))),
  }
}

const failuresFor = (target, measured) => {
  const failures = []
  if (!measured.found) return [`${target.name}: no visible ${target.selector}`]
  const touch = target.pointer !== 'fine'
  if (measured.coarse !== touch) failures.push(`${target.name}: expected pointer: ${touch ? 'coarse' : 'fine'}, the page reports the other`)
  if (target.minHeight && measured.hitHeight < target.minHeight) failures.push(`${target.name}: hit box ${measured.hitHeight}px tall, under ${target.minHeight}px`)
  if (target.minWidth && measured.hitWidth < target.minWidth) failures.push(`${target.name}: hit box ${measured.hitWidth}px wide, under ${target.minWidth}px`)
  if (target.maxVisual && measured.drawn > target.maxVisual) failures.push(`${target.name}: drawn ${measured.drawn}px tall, over ${target.maxVisual}px`)
  return failures
}

const open = async (browser, story, theme, touch, viewport = spec.viewport) => {
  const context = await browser.newContext({ hasTouch: touch, viewport, colorScheme: theme, reducedMotion: 'reduce', baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  await page.goto(`/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`)
  await page.locator('#storybook-root > *').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(settle)
  return { context, page }
}

for (const target of spec.targets) {
  test(`touch targets ${target.name}`, async ({ browser }, info) => {
    const { context, page } = await open(browser, target.story, info.project.name, target.pointer !== 'fine', target.viewport)
    try {
      await expect(page.locator(target.selector).first()).toBeVisible()
      const measured = await page.evaluate(measure, { name: target.name, selector: target.selector })
      await info.attach(`${target.name}-touch-target`, { body: JSON.stringify(measured, null, 2), contentType: 'application/json' })
      const failures = failuresFor(target, measured)
      expect(failures, failures.join('\n')).toEqual([])
    } finally {
      await context.close()
    }
  })
}

test('touch targets mutations', async ({ browser }, info) => {
  for (const mutation of spec.mutations) {
    const { context, page } = await open(browser, mutation.story, info.project.name, true, mutation.viewport)
    try {
      await page.addStyleTag({ content: mutation.css })
      await page.evaluate(settle)
      const failures = []
      for (const target of spec.targets.filter((row) => row.story === mutation.story && row.pointer !== 'fine')) {
        failures.push(...failuresFor(target, await page.evaluate(measure, { name: target.name, selector: target.selector })))
      }
      expect(failures.some((line) => line.includes(mutation.expect)), `${mutation.name}: the gate must report "${mutation.expect}", received:\n${failures.join('\n')}`).toBe(true)
    } finally {
      await context.close()
    }
  }
})

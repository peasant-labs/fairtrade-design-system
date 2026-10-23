import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { loadFixturePair } from '../mounted-parts.mjs'

/* AppSidebar motion on the built Storybook: the current-item indicator rests on the current item
   (desktop after a choice, and inside the phone drawer mid-stagger), the drawer opens to the left
   edge and closes out of view, reduced motion leaves nothing running, and axe finds every part of
   the sidebar inside a landmark. region is a page-level rule, so axe scans the whole page and only
   the findings inside the sidebar count (the story's placeholder page is not a product surface).
   Cases: scripts/testdata/app-sidebar-motion.yaml (+ .manifest.yaml). */
const { fixture } = loadFixturePair('scripts/testdata/app-sidebar-motion.yaml', 'scripts/testdata/app-sidebar-motion.manifest.yaml', { cases: 'requiredCaseNames', motions: 'requiredMotionNames' })

const settle = (page) => page.evaluate(async () => {
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  await Promise.allSettled(document.getAnimations().map((animation) => animation.finished))
})
// motion longer than a millisecond (the base layer's reduce rule clamps every transition to .01ms)
const perceptible = (page) => page.evaluate(() => document.getAnimations()
  .filter((animation) => animation.playState === 'running')
  .map((animation) => ({ timing: animation.effect.getTiming(), target: animation.effect.target?.className?.baseVal ?? animation.effect.target?.className, property: animation.transitionProperty }))
  .filter(({ timing }) => Number(timing.duration) + Number(timing.delay) > 1)
  .map(({ target, property, timing }) => `${target} ${property} ${timing.duration}ms+${timing.delay}ms`))
// the indicator's box against the current item's box, in viewport pixels
const alignment = (page) => page.evaluate(() => {
  const bar = document.querySelector('.asb-indicator')
  const item = document.querySelector('.asb-panel nav:not(.asb-apps) .asb-item[aria-current="page"]')
  const a = bar.getBoundingClientRect()
  const b = item.getBoundingClientRect()
  return { placed: bar.dataset.placed, label: item.querySelector('.asb-label')?.textContent, dx: Math.abs(a.left - b.left), dy: Math.abs(a.top - b.top), dw: Math.abs(a.width - b.width), dh: Math.abs(a.height - b.height) }
})
// axe over the whole page, keeping the findings inside the sidebar: every part of it must sit in
// a landmark, and no other rule may fail there
const expectAxeClean = async (page, context) => {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const findings = []
  for (const violation of violations) {
    for (const node of violation.nodes) {
      const selector = node.target[node.target.length - 1]
      const inside = await page.evaluate((sel) => !!document.querySelector(sel)?.closest('.asb'), selector)
      if (inside) findings.push(`${violation.id}: ${selector}`)
    }
  }
  expect(findings, `${context}: axe findings inside the sidebar`).toEqual([])
}
const expectAligned = async (page, label, context) => {
  const at = await alignment(page)
  expect(at.placed, `${context}: the indicator must be placed`).toBe('true')
  expect(at.label, `${context}: the current item`).toBe(label)
  expect(Math.max(at.dx, at.dy, at.dw, at.dh), `${context}: the indicator must rest on ${label} ${JSON.stringify(at)}`).toBeLessThanOrEqual(1)
}

for (const motion of fixture.motions) for (const row of fixture.cases) {
  test(`app sidebar ${row.name} ${motion.name}`, async ({ page }, info) => {
    const context = `${row.name} (${motion.name}, ${info.project.name})`
    await page.emulateMedia({ reducedMotion: motion.value })
    await page.setViewportSize(row.viewport)
    await page.goto(`/iframe.html?id=${row.story}&viewMode=story&globals=theme:${info.project.name}`)
    await expect(page.locator('.asb-indicator[data-placed="true"]')).toHaveCount(1)
    await page.evaluate(() => document.fonts.ready)
    if (row.kind === 'desktop') {
      await settle(page)
      await expectAligned(page, row.first, `${context} at rest`)
      await expectAxeClean(page, `${context} at rest`)
      await page.getByRole('link', { name: row.choose, exact: true }).click()
      await expect(page.getByRole('link', { name: row.choose, exact: true })).toHaveAttribute('aria-current', 'page')
      if (motion.value === 'reduce') expect(await perceptible(page), `${context}: nothing may move perceptibly under reduced motion`).toEqual([])
      await settle(page)
      await expectAligned(page, row.choose, `${context} after choosing`)
    } else {
      const menu = page.getByRole('button', { name: 'open the menu' })
      const panel = page.locator('aside.asb-panel')
      await expect(panel).toBeHidden()
      await expectAxeClean(page, `${context} with the drawer closed`)
      await menu.click()
      await expect(page.getByRole('button', { name: 'close the menu' })).toHaveAttribute('aria-expanded', 'true')
      if (motion.value === 'reduce') expect(await perceptible(page), `${context}: nothing may move perceptibly under reduced motion`).toEqual([])
      await settle(page)
      await expect(panel).toBeVisible()
      expect(Math.round((await panel.boundingBox()).x), `${context}: the open drawer must sit on the left edge`).toBe(0)
      await expectAligned(page, row.first, `${context} in the open drawer`)
      await expectAxeClean(page, `${context} with the drawer open`)
      await page.getByRole('button', { name: 'close the menu' }).click()
      await settle(page)
      await expect(panel).toBeHidden()
      await expect(page.getByRole('button', { name: 'open the menu' })).toHaveAttribute('aria-expanded', 'false')
    }
  })
}

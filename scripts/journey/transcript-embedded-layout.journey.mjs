/* Real embedded layout and focus scrolling need a browser: jsdom cannot observe
 * painted widths, native modal focus, or the clipping boundary around a tab. */
import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'

const fixture = loadStrictYaml('scripts/testdata/transcript-embedded-layout.yaml')
const manifest = loadStrictYaml('scripts/testdata/transcript-embedded-layout.manifest.yaml')
assertExactNames(fixture.cases.map(row => row.name), manifest.requiredCases, 'embedded cases')
assertExactNames(fixture.themes, manifest.requiredThemes, 'embedded themes')
assertExactNames(fixture.motion, manifest.requiredMotion, 'embedded motion')
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`

for (const row of fixture.cases) for (const motion of fixture.motion) {
  test(`embedded transcript ${row.name} ${motion}`, async ({ page }, info) => {
    expect(fixture.themes).toContain(info.project.name)
    await page.setViewportSize({ width: row.viewport, height: 1000 })
    await page.emulateMedia({ reducedMotion: motion })
    await page.goto(`${origin}/?app=transcript&transcript=ledger-actions&fb=off&theme=${info.project.name}#inuse`)
    const viewer = page.locator('.txn-app')
    await expect(viewer).toHaveAttribute('data-theme', info.project.name)
    await page.evaluate(() => document.fonts.ready)
    // The owning app supplies the embed's width; canonical viewer styles stay untouched.
    await viewer.evaluate((element, width) => { element.parentElement.style.maxWidth = `${width}px` }, row.hostWidth)
    await expect.poll(() => viewer.evaluate(element => element.clientWidth)).toBe(row.hostWidth)
    await expect.poll(() => viewer.evaluate(element => element.classList.contains('txn-compact'))).toBe(row.compact)
    const body = viewer.locator('.txn-body:visible').first()
    await expect(body).toBeVisible()
    const proseWidth = () => body.evaluate(element => element.getBoundingClientRect().width)
    expect(await proseWidth(), 'actual prose retains a readable width').toBeGreaterThanOrEqual(row.minimumProse)
    const grid = viewer.locator('.txn-body-grid')
    const storedLayout = await grid.evaluate(element => ({ left: element.dataset.leftRail, right: element.dataset.rightRail }))
    const beforeWidth = await proseWidth()
    if (row.compact) {
      const tools = viewer.getByRole('button', { name: 'transcript tools', exact: true })
      await expect(tools).toBeVisible()
      await tools.click()
      await viewer.locator('.txn-mobile-controls').getByRole('button', { name: 'filters', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'filters', exact: true })
      await expect(dialog).toBeVisible()
      const bounds = await dialog.boundingBox()
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.y).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(row.viewport)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height)
      await dialog.locator('button:visible:not([disabled]), input:visible:not([disabled])').last().focus()
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate(element => element.contains(document.activeElement)), 'native modal focus stays inside its drawer').toBe(true)
      await expect(dialog.getByRole('checkbox', { name: /^responses/ })).toBeChecked()
      await dialog.getByRole('checkbox', { name: /^responses/ }).uncheck()
      await expect(dialog.getByRole('checkbox', { name: /^responses/ })).not.toBeChecked()
      expect(await proseWidth(), 'opening filters does not squeeze the trace').toBe(beforeWidth)
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      await expect(tools).toBeFocused()
      await expect.poll(() => grid.evaluate(element => ({ left: element.dataset.leftRail, right: element.dataset.rightRail }))).toEqual(storedLayout)
      await tools.click()
      await viewer.locator('.txn-mobile-controls').getByRole('button', { name: 'filters', exact: true }).click()
      await expect(dialog.getByRole('checkbox', { name: /^responses/ })).not.toBeChecked()
      await dialog.getByRole('checkbox', { name: /^responses/ }).check()
      await dialog.getByRole('button', { name: 'close drawer', exact: true }).click()
      await expect(tools).toBeFocused()
    } else {
      await expect(viewer.getByRole('button', { name: 'collapse filters', exact: true })).toBeVisible()
      await expect(viewer.getByRole('button', { name: 'transcript tools', exact: true })).toHaveCount(0)
    }
    const tabs = viewer.getByRole('tablist', { name: 'session views' })
    await tabs.getByRole('tab').first().evaluate(element => element.focus({ preventScroll: true }))
    const pagePosition = await page.evaluate(() => ({ x: scrollX, y: scrollY }))
    await page.keyboard.press('End')
    await expect(tabs.getByRole('tab', { name: /^annotations/ })).toBeFocused()
    await expect.poll(() => tabs.evaluate(strip => {
      const tab = document.activeElement, box = tab.getBoundingClientRect(), clip = strip.getBoundingClientRect()
      const style = getComputedStyle(tab), extent = Math.max(0, parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth))
      return box.left - extent >= clip.left - 1 && box.right + extent <= clip.right + 1 && box.top - extent >= clip.top - 1 && box.bottom + extent <= clip.bottom + 1
    }), 'the focused tab and its ring are inside the scrolling strip').toBe(true)
    expect(await page.evaluate(() => ({ x: scrollX, y: scrollY })), 'tab navigation does not scroll the host page').toEqual(pagePosition)
    await page.keyboard.press('Home')
    await expect(tabs.getByRole('tab', { name: /^highlights/ })).toBeFocused()
    await expect.poll(() => tabs.evaluate(strip => document.activeElement.getBoundingClientRect().left >= strip.getBoundingClientRect().left - 1)).toBe(true)
    expect(await viewer.evaluate(element => element.scrollWidth - element.clientWidth), 'the viewer does not overflow horizontally').toBe(0)
    if (row.resizeHostWidth) {
      await tabs.getByRole('tab', { name: /^full trace/ }).click()
      await viewer.getByRole('button', { name: 'transcript tools', exact: true }).click()
      await viewer.locator('.txn-mobile-controls').getByRole('button', { name: 'filters', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'filters', exact: true })).toBeVisible()
      await viewer.evaluate((element, width) => { element.parentElement.style.maxWidth = `${width}px` }, row.resizeHostWidth)
      await expect.poll(() => viewer.evaluate(element => element.classList.contains('txn-compact'))).toBe(false)
      await expect(page.locator('.txn-mobile-drawer[open]')).toHaveCount(0)
      await expect(viewer.getByRole('button', { name: 'collapse filters', exact: true })).toBeFocused()
      await expect.poll(() => grid.evaluate(element => ({ left: element.dataset.leftRail, right: element.dataset.rightRail }))).toEqual(storedLayout)
      await viewer.getByRole('button', { name: 'collapse filters', exact: true }).click()
      await expect(grid).toHaveAttribute('data-right-rail', 'closed')
    }
  })
}

assertExactNames(fixture.zenCases.map(row => row.name), manifest.requiredZenCases, 'retained zen cases')
for (const row of fixture.zenCases) for (const motion of fixture.motion) {
  test(`embedded transcript ${row.name} ${motion}`, async ({ page }, info) => {
    expect(fixture.themes).toContain(info.project.name)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ reducedMotion: motion })
    await page.goto(`${origin}/?app=transcript&transcript=ledger-actions&fb=off&theme=${info.project.name}#inuse`)
    const viewer = page.locator('.txn-app'), grid = viewer.locator('.txn-body-grid')
    await expect(viewer).toHaveAttribute('data-theme', info.project.name)
    await page.evaluate(() => document.fonts.ready)
    for (const name of row.collapse) await viewer.getByRole('button', { name, exact: true }).click()
    const layout = () => viewer.evaluate(element => ({
      left: element.querySelector('.txn-body-grid').dataset.leftRail,
      right: element.querySelector('.txn-body-grid').dataset.rightRail,
      host: element.dataset.hostVisible,
    }))
    const saved = await layout()
    const zen = viewer.getByRole('button', { name: 'zen mode', exact: true })
    await zen.click()
    await expect(zen).toHaveAttribute('aria-pressed', 'true')
    await expect(viewer).toHaveAttribute('data-host-visible', 'false')
    await viewer.evaluate((element, width) => { element.parentElement.style.maxWidth = `${width}px` }, row.hostWidth)
    await page.setViewportSize({ width: row.viewport, height: 1000 })
    await expect.poll(() => viewer.evaluate(element => element.clientWidth)).toBe(row.hostWidth)
    await expect(viewer).toHaveClass(/txn-compact/)
    await expect(grid).toHaveAttribute('data-zen', 'true')
    await expect(zen).toBeVisible()
    await expect(zen).toHaveAttribute('aria-pressed', 'true')
    await expect(viewer.locator('.txn-foot-tabs').getByRole('button', { name: 'zen mode', exact: true })).toHaveCount(1)
    const geometry = await zen.evaluate(control => {
      const frame = control.closest('.txn-app'), stream = frame.querySelector('.txn-stream')
      const body = [...frame.querySelectorAll('.txn-body')].find(element => element.getBoundingClientRect().width > 0)
      const button = control.getBoundingClientRect(), reader = stream.getBoundingClientRect(), owner = frame.getBoundingClientRect()
      return { prose: body.getBoundingClientRect().width, controlBelowReader: button.top >= reader.bottom - 1,
        inside: button.left >= owner.left && button.right <= owner.right && button.top >= owner.top && button.bottom <= owner.bottom,
        overflow: frame.scrollWidth - frame.clientWidth }
    })
    expect(geometry.prose, 'retained zen keeps the reading width').toBeGreaterThanOrEqual(row.minimumProse)
    expect(geometry.controlBelowReader, 'the zen exit does not cover conversation text').toBe(true)
    expect(geometry.inside, 'the exit stays inside the viewer').toBe(true)
    expect(geometry.overflow).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await zen.click()
    await expect(grid).toHaveAttribute('data-zen', 'false')
    await expect.poll(layout, 'leaving zen restores the exact saved rails and host state').toEqual(saved)
    await expect(viewer.getByRole('button', { name: 'transcript tools', exact: true })).toBeFocused()
    await expect(zen, 'the default compact footer has no extra zen action').toHaveCount(0)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await viewer.evaluate(element => { element.parentElement.style.maxWidth = '' })
    await expect(viewer).not.toHaveClass(/txn-compact/)
    await expect.poll(layout, 'the saved state also survives returning to desktop').toEqual(saved)
    await expect(zen).toHaveAttribute('aria-pressed', 'false')
  })
}

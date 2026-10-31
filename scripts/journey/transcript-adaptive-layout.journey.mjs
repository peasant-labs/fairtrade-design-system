/* The built in-use app is the subject, including its real rails and width control. */
import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'

const fixture = loadStrictYaml('scripts/testdata/transcript-adaptive-layout.yaml')
const manifest = loadStrictYaml('scripts/testdata/transcript-adaptive-layout.manifest.yaml')
assertExactNames(fixture.cases.map(row => row.name), manifest.requiredCases, 'adaptive cases')
assertExactNames(fixture.themes, manifest.requiredThemes, 'adaptive themes')
assertExactNames(fixture.motion, manifest.requiredMotion, 'adaptive motion')
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`

for (const row of fixture.cases) for (const motion of fixture.motion) {
  test(`adaptive transcript ${row.name} ${motion}`, async ({ page }, info) => {
    expect(fixture.themes).toContain(info.project.name)
    await page.setViewportSize({ width: row.width, height: 1000 })
    await page.emulateMedia({ reducedMotion: motion })
    await page.goto(`${origin}/?app=transcript&transcript=ledger-actions&fb=off&theme=${info.project.name}#inuse`)
    await expect(page.locator('.txn-app')).toHaveAttribute('data-theme', info.project.name)
    await page.locator('.txn-turnwrap-ledger').first().waitFor()
    await page.evaluate(async () => { await document.fonts.ready; document.getElementById('inuse').scrollIntoView({ block: 'start', behavior: 'instant' }) })
    if (row.behavior === 'drawer') {
      await page.getByRole('button', { name: 'transcript tools', exact: true }).click()
      await page.getByRole('button', { name: 'user turns', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'user turns' })).toBeVisible()
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'transcript tools', exact: true }).click()
      await page.locator('.txn-app').getByRole('button', { name: 'filters', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'filters' })).toBeVisible()
      return
    }
    const grid = page.locator('.txn-body-grid')
    const reader = page.locator('.txn-turnwrap-ledger').first()
    const rect = async () => { const r = await reader.boundingBox(); return { x: r.x, width: r.width } }
    if (row.behavior === 'boundary') {
      const left = page.locator('.txn-rail-left')
      const right = page.locator('.txn-rail-right')
      if (row.rails) {
        await expect(left).toBeVisible()
        await expect(right).toBeVisible()
        await expect(page.getByRole('button', { name: 'zen mode' })).toBeVisible()
      } else {
        await expect(left).toBeHidden()
        await expect(right).toBeHidden()
        await expect(page.getByRole('button', { name: 'zen mode' })).toBeHidden()
        const r = await rect(), g = await grid.boundingBox()
        expect(Math.abs(r.x + r.width / 2 - (g.x + g.width / 2)), 'reader stays centered without rails').toBeLessThan(1)
      }
      return
    }
    const available = () => grid.evaluate(el => {
      const stream = el.querySelector('.txn-stream'), style = getComputedStyle(stream)
      const box = stream.getBoundingClientRect()
      return { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight) }
    })
    const toggle = async name => {
      await page.getByRole('button', { name, exact: true }).click()
      await grid.evaluate(async el => {
        await new Promise(requestAnimationFrame)
        await Promise.allSettled(el.getAnimations({ subtree: true }).map(a => a.finished))
      })
    }
    const both = await rect()
    await toggle('collapse user turns outline')
    await expect(page.getByRole('button', { name: 'expand user turns outline', exact: true })).toBeFocused()
    const right = await rect()
    const rightBounds = await available()
    await toggle('collapse filters')
    const neither = await rect()
    await toggle('expand user turns outline')
    const left = await rect()
    if (row.behavior === 'stable') {
      await expect(grid).toHaveAttribute('data-reader-room', 'true')
      for (const current of [right, neither, left]) {
        expect(Math.abs(current.x - both.x), 'wide reader x').toBeLessThan(1)
        expect(Math.abs(current.width - both.width), 'wide reader width').toBeLessThan(1)
      }
    } else if (row.behavior === 'intermediate') {
      for (const current of [right, neither, left]) expect(Math.abs(current.width - neither.width), 'one rail preserves width').toBeLessThan(1)
      expect(both.width).toBeLessThan(neither.width)
      const gridBox = await grid.boundingBox()
      const center = gridBox.x + gridBox.width / 2
      const offset = current => current.x + current.width / 2 - center
      expect(Math.abs(offset(neither)), 'no rail is centered').toBeLessThan(1)
      expect(offset(right), 'right rail shifts reader only as needed').toBeLessThanOrEqual(0)
      expect(offset(left), 'left rail shifts reader only as needed').toBeGreaterThanOrEqual(0)
      const bounds = await available()
      expect(Math.abs(left.x - bounds.left), 'left rail clamps reader at available edge').toBeLessThan(2)
      expect(Math.abs(right.x + right.width - rightBounds.right), 'right rail clamps reader at available edge').toBeLessThan(2)
    } else {
      expect(both.width).toBeLessThan(right.width)
      expect(right.width).toBeLessThan(neither.width)
    }
    await page.keyboard.press('Control+f')
    await page.getByRole('textbox', { name: 'search transcript' }).fill('transcript')
    await expect(page.locator('.txn-search-count')).not.toHaveText('0 matches')
    await page.keyboard.press('Escape')
    const handle = page.getByRole('separator', { name: 'reading width' })
    const hasWidthRange = async () => {
      const bounds = await available()
      return bounds.right - bounds.left > fixture.minimumReaderWidth
    }
    const collapsedForWidth = !(await hasWidthRange())
    if (collapsedForWidth) {
      await expect(handle, 'a viewport-bound reader has no adjustable width').toHaveCount(0)
      await toggle('collapse user turns outline')
      expect(await hasWidthRange(), 'collapsing the rail exposes an adjustable range').toBe(true)
      await expect(handle, 'the width control returns when room is available').toBeVisible()
    }
    await handle.focus()
    await page.keyboard.press('End')
    await expect(handle).toHaveAttribute('aria-valuetext', 'full width')
    await expect(grid).not.toHaveAttribute('data-reader-room', 'true')
    await grid.evaluate(async el => { await Promise.allSettled(el.getAnimations().map(a => a.finished)) })
    await expect.poll(() => reader.evaluate(el => {
      const stream = el.closest('.txn-stream'), style = getComputedStyle(stream)
      return Math.abs(el.getBoundingClientRect().width - (stream.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)))
    })).toBeLessThan(2)
    const fullBefore = await rect()
    await toggle('expand filters')
    if (await hasWidthRange()) await expect(handle).toHaveAttribute('aria-valuetext', 'full width')
    else await expect(handle, 'the width control leaves when the rail removes its range').toHaveCount(0)
    await expect.poll(async () => (await rect()).width).toBeLessThan(fullBefore.width - 1)
    if (!collapsedForWidth) await toggle('collapse user turns outline')
    await toggle('collapse filters')
    await expect(handle, 'the width control is restored before keyboard and drag input').toBeVisible()
    await handle.focus()
    await page.keyboard.press('Home')
    await expect(handle).toHaveAttribute('aria-valuenow', '600')
    const beforeDrag = Number(await handle.getAttribute('aria-valuenow'))
    const box = await handle.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 })
    await page.mouse.up()
    await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(beforeDrag)
  })
}

for (const motion of fixture.motion) test(`adaptive transcript preserves reading point ${motion}`, async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1000 })
  await page.emulateMedia({ reducedMotion: motion })
  await page.goto(`${origin}/?app=transcript&transcript=ledger-reading&fb=off&theme=${info.project.name}#inuse`)
  await expect(page.locator('.txn-app')).toHaveAttribute('data-theme', info.project.name)
  await page.evaluate(async () => { await document.fonts.ready; document.getElementById('inuse').scrollIntoView({ block: 'start', behavior: 'instant' }) })
  const paragraph = page.locator('#turn-50 .txn-body p').first()
  await paragraph.click()
  await paragraph.evaluate(el => { const stream = el.closest('.txn-stream'); stream.scrollTop += el.getBoundingClientRect().top - stream.getBoundingClientRect().top - stream.clientHeight * 0.4 })
  await expect(page.locator('#turn-50 .txn-turn')).toHaveClass(/txn-active/)
  await page.locator('.txn-header').evaluate(async el => { await new Promise(requestAnimationFrame); await Promise.allSettled(el.getAnimations({ subtree: true }).map(a => a.finished)) })
  const initial = await paragraph.evaluate(el => {
    const target = el.closest('.txn-turnwrap'), stream = el.closest('.txn-stream')
    const view = stream.getBoundingClientRect(), box = target.getBoundingClientRect()
    const y = Math.max(Math.max(view.top, box.top) + 1, Math.min(Math.min(view.bottom, box.bottom) - 1, view.top + view.height * 0.4))
    const pos = document.caretPositionFromPoint((Math.max(view.left, box.left) + Math.min(view.right, box.right)) / 2, y)
    if (!pos || pos.offsetNode.nodeType !== Node.TEXT_NODE || !target.contains(pos.offsetNode)) throw new Error('no visible text point in selected source')
    const range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true)
    window.__adaptiveReaderRange = range
    return range.getBoundingClientRect().top
  })
  const check = async () => expect(Math.abs(await page.evaluate(() => window.__adaptiveReaderRange.getBoundingClientRect().top) - initial)).toBeLessThan(3)
  for (const name of ['collapse user turns outline', 'collapse filters', 'expand user turns outline', 'expand filters']) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.locator('.txn-body-grid').evaluate(async el => { await new Promise(requestAnimationFrame); await Promise.allSettled(el.getAnimations({ subtree: true }).map(a => a.finished)) })
    await check()
  }
  const handle = page.getByRole('separator', { name: 'reading width' })
  await handle.evaluate(el => el.focus({ preventScroll: true }))
  for (const key of ['Home', 'ArrowRight', 'End']) { await page.keyboard.press(key); await check() }
})

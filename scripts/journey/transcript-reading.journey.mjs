import { test, expect } from '@playwright/test'
import { loadFixturePair } from '../mounted-parts.mjs'

// Pixels, real overflow and post-animation visibility cannot be proved in JSDOM.
// Reuse the existing built app/runner and small shared demo fixture; no extra service.
const { fixture } = loadFixturePair('scripts/testdata/transcript-reading-browser.yaml', 'scripts/testdata/transcript-reading-browser.manifest.yaml', {
  navigation: 'requiredNavigationNames', initial: 'requiredInitialNames', rail: 'requiredRailNames', mobile: 'requiredMobileNames', width: 'requiredWidthNames', widthAction: 'requiredWidthActionNames',
})
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`
test.describe('touch transcript', () => {
test.use({ hasTouch: true })
for (const row of fixture.mobile) test(`transcript mobile drawers ${row.name}`, async ({ page }, info) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin })
  await page.setViewportSize({ width: row.width, height: row.height })
  await page.emulateMedia({ reducedMotion: row.motion })
  await page.goto(`${origin}/?app=transcript&transcript=ledger-reading&fb=off&theme=${info.project.name}#inuse`, { waitUntil: 'domcontentloaded' })
  await page.locator('#inuse').scrollIntoViewIfNeeded()
  const viewer = page.locator('.txn-app')
  await expect(viewer).toBeVisible()
  await expect(viewer.locator('.txn-header').getByRole('button', { name: 'publish', exact: true })).toBeVisible()
  await expect(viewer.locator('.txn-footer').getByRole('button', { name: 'publish', exact: true })).toHaveCount(0)
  await viewer.locator('.txn-footer').getByRole('button', { name: 'copy transcript', exact: true }).click()
  await expect(viewer.getByRole('status').filter({ hasText: 'transcript copied' })).toBeVisible()
  expect((await viewer.locator('.txn-footer').boundingBox()).height).toBeLessThanOrEqual(row.footerMaxHeight)
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Reading request 0')
  await expect(viewer.locator('.txn-footer').getByRole('button', { name: 'more', exact: true })).toBeVisible()
  await viewer.locator('.txn-footer').getByRole('button', { name: 'more', exact: true }).click()
  await expect(viewer.getByRole('menuitem', { name: 'copy as markdown' })).toBeVisible()
  await viewer.getByRole('menuitem', { name: 'copy as markdown' }).click()
  await expect(viewer.getByRole('status').filter({ hasText: 'transcript copied' })).toBeVisible()
  await viewer.locator('.txn-footer').getByRole('button', { name: 'more', exact: true }).click()
  await viewer.getByRole('menuitem', { name: 'copy link' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('transcript=ledger-reading')
  const outline = viewer.getByRole('button', { name: 'user turns', exact: true })
  const filters = viewer.getByRole('button', { name: 'filters', exact: true })
  const views = viewer.getByRole('combobox', { name: 'session views' })
  const search = viewer.getByRole('button', { name: 'search transcript', exact: true })
  const controls = [outline, filters, views, search, viewer.locator('.txn-footer').getByRole('button', { name: 'copy transcript', exact: true }), viewer.locator('.txn-footer').getByRole('button', { name: 'more', exact: true })]
  const centers = await Promise.all(controls.map(async control => { const b = await control.boundingBox(); return b.y + b.height / 2 }))
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(2)
  for (const control of controls.slice(-2)) {
    const border = await control.evaluate(el => ({ width: parseFloat(getComputedStyle(el).borderTopWidth), style: getComputedStyle(el).borderTopStyle, color: getComputedStyle(el).borderTopColor }))
    expect(border.width).toBeGreaterThan(0)
    expect(border.style).toBe('solid')
    expect(border.color).not.toBe('rgba(0, 0, 0, 0)')
  }
  await views.selectOption('files')
  await expect(viewer.getByRole('tabpanel', { name: 'files' })).toBeVisible()
  await views.selectOption('trace')
  await search.click()
  await expect(viewer.getByRole('textbox', { name: 'search transcript' })).toBeVisible()
  await viewer.getByRole('button', { name: 'close search' }).click()
  const spacing = () => viewer.evaluate(el => {
    const first = el.querySelector('#turn-0'), second = el.querySelector('#turn-1')
    const head = first.querySelector('.txn-turnhead').getBoundingClientRect(), body = first.querySelector('.txn-body').getBoundingClientRect()
    return { head: body.top - head.bottom, turn: second.querySelector('.txn-turnhead').getBoundingClientRect().top - body.bottom }
  })
  const mobileSpacing = await spacing()
  for (const button of [outline, filters, viewer.locator('.txn-footer').getByRole('button', { name: 'copy transcript', exact: true }), viewer.locator('.txn-footer').getByRole('button', { name: 'more', exact: true })]) {
    const box = await button.boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  const code = page.locator('#turn-1 .txn-md-code-wrap')
  expect(await page.locator('.txn-stream').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await code.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
  expect(await code.evaluate(el => getComputedStyle(el).overflowX)).toBe('auto')
  expect(await page.locator('#turn-1 .txn-body').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
  await outline.click()
  await expect(viewer.getByRole('dialog', { name: 'user turns' })).toBeVisible()
  await expect(viewer.getByRole('dialog')).toHaveCount(1)
  expect(await viewer.getByRole('dialog').evaluate(el => el.matches(':modal'))).toBe(true)
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab')
    expect(await viewer.getByRole('dialog').evaluate(el => el.contains(document.activeElement))).toBe(true)
  }
  await page.screenshot({ path: `/tmp/opencode/mobile-proof-revision/${info.project.name}-${row.width}-drawer.png` })
  await viewer.getByRole('dialog').getByRole('button', { name: 'filters', exact: true }).click()
  await expect(viewer.getByRole('dialog', { name: 'filters' })).toBeVisible()
  await expect(viewer.getByRole('dialog')).toHaveCount(1)
  const prompts = viewer.getByRole('dialog').getByRole('checkbox', { name: /prompts/ })
  await prompts.uncheck()
  await expect(page.locator('#turn-0')).toHaveCount(0)
  await prompts.check()
  await expect(page.locator('#turn-0')).toHaveCount(1)
  const compact = viewer.getByRole('dialog').getByRole('switch', { name: 'compact mode' })
  await compact.click()
  await expect(compact).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('#turn-1 .txn-modelactions-head')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#turn-1')).toContainText('First response owns the action list.')
  await compact.click()
  await page.keyboard.press('Escape')
  await expect(filters).toBeFocused()
  await outline.click()
  await viewer.getByRole('dialog').getByRole('button', { name: /Reading request 23/ }).click()
  await expect(viewer.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.locator('.txn-stream').evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  const stream = viewer.locator('.txn-stream')
  await stream.evaluate(el => { el.scrollTop = el.scrollHeight })
  const last = viewer.getByText(`Response for reading request 23, paragraph ${fixture.lastResponseParagraphs}.`, { exact: false })
  await expect(last).toBeVisible()
  const lastGeometry = await last.evaluate(el => ({ bottom: el.getBoundingClientRect().bottom, streamBottom: el.closest('.txn-stream').getBoundingClientRect().bottom }))
  expect(lastGeometry.bottom).toBeLessThanOrEqual(lastGeometry.streamBottom)
  await filters.click()
  await expect(viewer.getByRole('dialog', { name: 'filters' })).toBeVisible()
  await expect(viewer.getByRole('dialog')).toHaveCount(1)
  await page.locator('.txn-mobile-drawer').click({ position: { x: row.width - 4, y: 10 } })
  await expect(filters).toBeFocused()
  await outline.click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(viewer.getByRole('dialog')).toHaveCount(0)
  await expect(viewer.locator('.txn-header').getByRole('button', { name: 'more', exact: true })).toBeVisible()
  await expect(viewer.locator('.txn-header').getByRole('button', { name: 'copy transcript', exact: true })).toBeVisible()
  const desktopSpacing = await spacing()
  expect(mobileSpacing.head).toBeLessThan(desktopSpacing.head)
  expect(mobileSpacing.turn).toBeLessThan(desktopSpacing.turn)
  await info.attach('desktop-view', { body: await page.screenshot({ path: `/tmp/opencode/mobile-proof-revision/${info.project.name}-${row.width}-desktop.png` }), contentType: 'image/png' })
  await page.setViewportSize({ width: row.width, height: row.height })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await info.attach('mobile-view', { body: await page.screenshot({ path: `/tmp/opencode/mobile-proof-revision/${info.project.name}-${row.width}-mobile.png` }), contentType: 'image/png' })
  await page.goto(`${origin}/?app=transcript&transcript=ledger-reading-short&fb=off&theme=${info.project.name}#inuse`, { waitUntil: 'domcontentloaded' })
  await page.locator('#inuse').scrollIntoViewIfNeeded()
  await expect(viewer.locator('.txn-footer').getByRole('button', { name: 'copy transcript' })).toBeVisible()
  expect((await viewer.locator('.txn-footer').boundingBox()).height).toBeLessThanOrEqual(row.footerMaxHeight)
  await page.screenshot({ path: `/tmp/opencode/mobile-proof-revision/${info.project.name}-${row.width}-short.png` })
  await filters.click()
  await page.goto(`${origin}/?fb=off`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('dialog', { name: 'filters' })).toHaveCount(0)
})
})
const open = async (page, theme, turn) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${origin}/?app=transcript&transcript=ledger-reading&fb=off&theme=${theme}${turn == null ? '' : `&turn=${turn}`}#inuse`)
  await expect(page.locator('.txn-app')).toHaveAttribute('data-theme', theme)
  await page.evaluate(async () => { await document.fonts.ready; document.getElementById('inuse').scrollIntoView({ block: 'start', behavior: 'instant' }) })
}
const action = (page, row) => row.kind === 'body'
  ? page.locator(`#turn-${row.turn} .txn-turn`)
  : row.kind === 'thinking' ? page.locator('.txn-thinking') : page.locator('.txn-toolcall').filter({ has: page.locator('.path', { hasText: row.command }) })
const inside = locator => locator.evaluate(el => {
  const stream = el.closest('.txn-stream')
  const box = el.getBoundingClientRect(), view = stream.getBoundingClientRect()
  return { top: box.top, bottom: box.bottom, viewTop: view.top, viewBottom: view.bottom, shown: !el.closest('[hidden], [inert]') }
})
for (const row of fixture.width) test(`transcript reading width ${row.name}`, async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: row.motion })
  await open(page, info.project.name)
  const stream = page.locator('.txn-stream')
  const paragraph = page.locator(`#turn-${row.turn} .txn-body p`).nth(row.paragraph)
  await paragraph.click()
  await paragraph.evaluate(el => {
    const stream = el.closest('.txn-stream')
    stream.scrollTop += el.getBoundingClientRect().top - stream.getBoundingClientRect().top - stream.clientHeight * 0.4
  })
  await expect.poll(() => paragraph.evaluate(el => {
    const r = el.getBoundingClientRect(), s = el.closest('.txn-stream').getBoundingClientRect()
    return r.top > s.top && r.top < s.bottom
  })).toBe(true)
  await expect(page.locator(`#turn-${row.turn} .txn-turn`)).toHaveClass(/txn-active/)
  if (row.turn === 50) {
    const geometry = await page.locator(`#turn-${row.turn}`).evaluate(el => {
      const box = el.getBoundingClientRect(), view = el.closest('.txn-stream').getBoundingClientRect()
      return { top: box.top, bottom: box.bottom, viewTop: view.top, viewBottom: view.bottom }
    })
    expect(geometry.top).toBeLessThan(geometry.viewTop)
    expect(geometry.bottom).toBeGreaterThan(geometry.viewBottom)
  }
  const handle = page.getByRole('separator', { name: 'reading width' })
  await handle.evaluate(el => el.focus({ preventScroll: true }))
  const initial = await paragraph.evaluate(el => {
    const target = el.closest('.txn-turnwrap'), stream = el.closest('.txn-stream')
    const view = stream.getBoundingClientRect(), box = target.getBoundingClientRect()
    const y = Math.max(Math.max(view.top, box.top) + 1, Math.min(Math.min(view.bottom, box.bottom) - 1, view.top + view.height * 0.4))
    const left = Math.max(view.left, box.left), right = Math.min(view.right, box.right)
    const pos = document.caretPositionFromPoint(left + (right - left) * 0.5, y)
    if (!pos || pos.offsetNode.nodeType !== Node.TEXT_NODE || !target.contains(pos.offsetNode)) throw new Error('no visible text point in selected source')
    const range = document.createRange()
    range.setStart(pos.offsetNode, pos.offset)
    range.collapse(true)
    window.__readerTestRange = range
    return range.getBoundingClientRect().top
  })
  const positions = [{ event: 'before', y: initial }]
  if (process.env.READER_WIDTH_PROOF_DIR && row.gesture === 'keyboard' && row.turn === 50) await page.screenshot({ path: `${process.env.READER_WIDTH_PROOF_DIR}/${info.project.name}-before.png` })
  const check = async () => {
    const point = await page.evaluate(() => window.__readerTestRange.getBoundingClientRect().top)
    positions.push({ event: 'width update', y: point, scrollTop: await stream.evaluate(el => el.scrollTop) })
    expect(Math.abs(point - initial)).toBeLessThan(3)
    await expect(page.locator(`#turn-${row.turn} .txn-turn`)).toHaveClass(/txn-active/)
  }
  if (row.gesture === 'keyboard') {
    for (const key of ['Home', 'ArrowRight', 'ArrowLeft', 'End']) {
      await page.keyboard.press(key); await check()
      if (key === 'Home' && process.env.READER_WIDTH_PROOF_DIR && row.turn === 50) await page.screenshot({ path: `${process.env.READER_WIDTH_PROOF_DIR}/${info.project.name}-after.png` })
    }
  } else {
    const box = await handle.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2
    await page.mouse.move(x, y); await page.mouse.down()
    for (const dx of [-60, -30, -70]) { await page.mouse.move(x + dx, y); await check() }
    if (row.gesture === 'cancel') await handle.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', button: 0 })
    await page.mouse.up(); await check()
  }
  const beforeScroll = await stream.evaluate(el => el.scrollTop)
  const streamBox = await stream.boundingBox()
  await page.mouse.move(streamBox.x + streamBox.width / 2, streamBox.y + streamBox.height / 2)
  await page.mouse.wheel(0, -180)
  await expect.poll(() => stream.evaluate(el => el.scrollTop)).toBeLessThan(beforeScroll)
  await info.attach('reader-position', { body: JSON.stringify(positions), contentType: 'application/json' })
})
for (const row of fixture.widthAction) test(`transcript reading width ${row.name}`, async ({ page }, info) => {
  await open(page, info.project.name)
  await page.locator('.txn-stream').focus()
  await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'search transcript' }).fill(row.query)
  const target = page.locator('.txn-toolcall').filter({ has: page.locator('.path', { hasText: row.command }) })
  await expect(target.locator('button').first()).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(async () => { const m = await inside(target); return m.shown && m.top >= m.viewTop && m.top < m.viewBottom }).toBe(true)
  const handle = page.getByRole('separator', { name: 'reading width' })
  await handle.evaluate(el => el.focus({ preventScroll: true }))
  const before = await target.evaluate(el => el.getBoundingClientRect().top)
  await page.keyboard.press('Home')
  expect(Math.abs(await target.evaluate(el => el.getBoundingClientRect().top) - before)).toBeLessThan(3)
})
for (const row of fixture.navigation) test(`transcript rendered navigation ${row.name}`, async ({ page }, info) => {
  await open(page, info.project.name)
  if (row.compact) await page.getByRole('switch', { name: 'compact mode', exact: true }).click()
  await page.locator('.txn-stream').focus()
  await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'search transcript', exact: true }).fill(row.query)
  const target = action(page, row)
  if (row.kind !== 'body') await expect(target.locator('button').first()).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(async () => { const m = await inside(target); return m.shown && m.top >= m.viewTop - 1 && m.top < m.viewBottom }).toBe(true)
  if (row.kind !== 'body') {
    const separation = await target.evaluate(el => el.getBoundingClientRect().top - el.closest('article').getBoundingClientRect().top)
    expect(separation).toBeGreaterThan(await page.locator('.txn-stream').evaluate(el => el.clientHeight))
    // A fresh reveal reopens an explicitly collapsed ancestor even if its child was already open.
    const head = page.locator('#turn-1 .txn-modelactions-head')
    await head.click()
    await expect(head).toHaveAttribute('aria-expanded', 'false')
    await page.getByRole('button', { name: 'next match', exact: true }).click()
    await expect(head).toHaveAttribute('aria-expanded', 'true')
    await expect.poll(async () => { const m = await inside(target); return m.shown && m.top >= m.viewTop - 1 && m.top < m.viewBottom }).toBe(true)
  }
  expect(await page.locator(`#turn-${row.turn}`).count()).toBe(1)
  await info.attach('rendered-destination', { body: JSON.stringify(await inside(target)), contentType: 'application/json' })
})
for (const row of fixture.initial) test(`transcript rendered initial ${row.name}`, async ({ page }, info) => {
  await open(page, info.project.name, row.turn)
  const target = action(page, row)
  await expect(target.locator('button').first()).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(async () => { const m = await inside(target); return m.shown && m.top >= m.viewTop - 1 && m.top < m.viewBottom }).toBe(true)
})
test('transcript real overflow user rail follows reading in both directions', async ({ page }, info) => {
  await open(page, info.project.name)
  const stream = page.locator('.txn-stream'), rail = page.locator('#txn-rail-left-body')
  expect(await rail.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  await stream.focus()
  for (const row of fixture.rail) {
    const requested = await page.locator(`#turn-${row.turn}`).evaluate(el => {
      const stream = el.closest('.txn-stream')
      stream.scrollTop += el.getBoundingClientRect().top - stream.getBoundingClientRect().top
      return stream.scrollTop
    })
    const current = rail.locator('.txn-rail-turn[aria-current="true"]')
    await expect(current).toHaveAttribute('title', row.prompt)
    await expect.poll(async () => current.evaluate(el => {
      const view = el.closest('#txn-rail-left-body').getBoundingClientRect(), card = el.getBoundingClientRect()
      return card.top >= view.top - 1 && card.bottom <= view.bottom + 1
    })).toBe(true)
    expect(await stream.evaluate(el => el.scrollTop), row.name).toBe(requested)
    await expect(stream).toBeFocused()
  }
})

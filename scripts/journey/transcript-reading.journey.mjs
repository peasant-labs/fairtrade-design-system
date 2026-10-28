import { test, expect } from '@playwright/test'
import { loadFixturePair } from '../mounted-parts.mjs'

// Pixels, real overflow and post-animation visibility cannot be proved in JSDOM.
// Reuse the existing built app/runner and small shared demo fixture; no extra service.
const { fixture } = loadFixturePair('scripts/testdata/transcript-reading-browser.yaml', 'scripts/testdata/transcript-reading-browser.manifest.yaml', {
  navigation: 'requiredNavigationNames', initial: 'requiredInitialNames', rail: 'requiredRailNames', mobile: 'requiredMobileNames', width: 'requiredWidthNames', widthAction: 'requiredWidthActionNames', movingHeader: 'requiredMovingHeaderNames',
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
  const viewer = page.locator('.txn-app'), footer = viewer.locator('.txn-footer')
  if (row.width === 320) {
    const durations = viewer.locator('#turn-1 .txn-tc-dur')
    for (const [index, { label }] of fixture.toolDurations.entries()) {
      const item = durations.nth(index)
      await expect(item).toHaveText(label)
      const geometry = await item.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); return { rects: range.getClientRects().length, whiteSpace: getComputedStyle(el).whiteSpace, width: el.getBoundingClientRect().width, scrollWidth: el.scrollWidth } })
      expect(geometry.rects).toBe(1); expect(geometry.whiteSpace).toBe('nowrap'); expect(geometry.width).toBeGreaterThanOrEqual(geometry.scrollWidth)
    }
  }
  const menu = footer.getByRole('button', { name: 'transcript tools', exact: true })
  const shot = async state => { if (row.width === 320) await page.screenshot({ path: `/tmp/opencode/mobile-proof-expandable/${info.project.name}-${state}.png` }) }
  await expect(viewer.getByRole('tablist', { name: 'session views' })).toBeVisible()
  const active = viewer.getByRole('tab', { selected: true })
  await active.focus(); await page.keyboard.press('End')
  const lastTab = viewer.getByRole('tab', { name: /annotations/ })
  await expect(lastTab).toHaveAttribute('aria-selected', 'true')
  expect(await lastTab.evaluate(el => { const a = el.getBoundingClientRect(), b = el.parentElement.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1 })).toBe(true)
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight')
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  const closedHeight = (await footer.boundingBox()).height
  expect(closedHeight).toBeLessThanOrEqual(row.footerMaxHeight)
  await shot('closed')
  await menu.click()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  const copy = footer.getByRole('button', { name: 'copy transcript', exact: true })
  const more = footer.getByRole('button', { name: 'more', exact: true })
  const outline = footer.getByRole('button', { name: 'user turns', exact: true })
  const filters = footer.getByRole('button', { name: 'filters', exact: true })
  await expect(copy).toBeVisible()
  const boxes = await Promise.all([copy, more, outline, filters].map(el => el.boundingBox()))
  for (const box of boxes) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44) }
  for (const control of [copy, more, outline, filters]) {
    const border = await control.evaluate(el => ({ width: parseFloat(getComputedStyle(el).borderTopWidth), style: getComputedStyle(el).borderTopStyle }))
    expect(border.width).toBeGreaterThan(0); expect(border.style).toBe('solid')
  }
  for (let i = 1; i < boxes.length; i++) expect(Math.abs(boxes[i].x - (boxes[i-1].x + boxes[i-1].width))).toBeLessThanOrEqual(1)
  expect((await footer.boundingBox()).height).toBeLessThanOrEqual(closedHeight + 52)
  await shot('expanded')
  await copy.click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Reading request 0')
  await expect(page.getByRole('status').filter({ hasText: 'transcript copied' })).toBeVisible()
  await more.click(); await page.getByRole('menuitem', { name: 'copy link' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('transcript=ledger-reading')
  await expect(page.getByRole('status').filter({ hasText: 'link copied' })).toBeVisible()
  await expect(viewer.locator('.txn-header').getByText('link copied')).toHaveCount(0)
  await expect(more).toBeFocused()
  await shot('toast')
  await page.locator('#turn-1 .txn-turn').click()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#turn-1 .txn-turn')).toHaveClass(/txn-active/)
  await menu.click()
  await filters.click()
  await expect(viewer.getByRole('dialog', { name: 'filters' })).toBeVisible()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await shot('filters')
  const prompts = viewer.getByRole('dialog').getByRole('checkbox', { name: /prompts/ })
  await prompts.uncheck(); await expect(page.locator('#turn-0')).toHaveCount(0)
  await prompts.check(); await expect(page.locator('#turn-0')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await menu.click(); await outline.click()
  await expect(viewer.getByRole('dialog', { name: 'user turns' })).toBeVisible()
  await shot('turns')
  await page.keyboard.press('Escape')
  await menu.click(); await page.keyboard.press('Escape')
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
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
  // Wait for the actual finite header transitions already triggered by selection.
  await page.locator('.txn-header').evaluate(async el => {
    await new Promise(requestAnimationFrame)
    const running = el.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime))
    let timer
    try { await Promise.race([Promise.all(running.map(a => a.finished.catch(() => {}))), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('header transitions did not settle within 2s')), 2000) })]) } finally { clearTimeout(timer) }
  })
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
for (const row of fixture.movingHeader) test(`transcript reading width ${row.name}`, async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await open(page, info.project.name)
  const stream = page.locator('.txn-stream'), header = page.locator('.txn-header')
  const turn = page.locator(`#turn-${row.turn} .txn-turn`)
  await turn.click()
  await expect(turn).toHaveClass(/txn-active/)
  const handle = page.getByRole('separator', { name: 'reading width' })
  await handle.evaluate(el => el.focus({ preventScroll: true }))
  await stream.evaluate((el, top) => { el.scrollTop = top }, row.scrollTop)
  await expect.poll(() => header.evaluate(el => el.getAnimations({ subtree: true }).some(a => a.playState === 'running'))).toBe(true)
  await handle.evaluate(el => {
    el.addEventListener('keydown', () => {
      const stream = document.querySelector('.txn-stream'), target = document.querySelector('#turn-0')
      const view = stream.getBoundingClientRect(), box = target.getBoundingClientRect()
      const y = Math.max(Math.max(view.top, box.top) + 1, Math.min(Math.min(view.bottom, box.bottom) - 1, view.top + view.height * 0.4))
      const pos = document.caretPositionFromPoint((Math.max(view.left, box.left) + Math.min(view.right, box.right)) / 2, y)
      if (!pos || pos.offsetNode.nodeType !== Node.TEXT_NODE || !target.contains(pos.offsetNode)) throw new Error('no visible selected text at gesture start')
      const range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true)
      window.__movingWidth = { range, frames: [], running: document.querySelector('.txn-header').getAnimations({ subtree: true }).some(a => a.playState === 'running') }
      const record = () => window.__movingWidth.frames.push({ y: range.getBoundingClientRect().top, streamTop: stream.getBoundingClientRect().top })
      record()
      const sample = () => { setTimeout(() => { record(); if (document.querySelector('.txn-header').getAnimations({ subtree: true }).some(a => a.playState === 'running')) requestAnimationFrame(sample) }, 0) }
      requestAnimationFrame(sample)
    }, { capture: true, once: true })
  })
  await handle.press('Home')
  await header.evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))); await new Promise(requestAnimationFrame) })
  const evidence = await page.evaluate(() => ({ running: window.__movingWidth.running, frames: window.__movingWidth.frames }))
  await info.attach('moving-header-position', { body: JSON.stringify(evidence), contentType: 'application/json' })
  expect(evidence.running).toBe(true)
  expect(evidence.frames.length).toBeGreaterThan(1)
  for (const frame of evidence.frames) expect(Math.abs(frame.y - evidence.frames[0].y)).toBeLessThan(3)
  await expect(turn).toHaveClass(/txn-active/)
  const box = await stream.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -200)
  await expect.poll(() => stream.evaluate(el => el.scrollTop)).toBe(0)
  await expect(page.locator('.txn-app')).not.toHaveClass(/txn-app-condensed/)
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

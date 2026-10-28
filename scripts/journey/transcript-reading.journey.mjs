import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import { loadFixturePair } from '../mounted-parts.mjs'

// Pixels, real overflow and post-animation visibility cannot be proved in JSDOM.
// Reuse the existing built app/runner and small shared demo fixture; no extra service.
const { fixture } = loadFixturePair('scripts/testdata/transcript-reading-browser.yaml', 'scripts/testdata/transcript-reading-browser.manifest.yaml', {
  navigation: 'requiredNavigationNames', initial: 'requiredInitialNames', rail: 'requiredRailNames', mobile: 'requiredMobileNames', width: 'requiredWidthNames', widthAction: 'requiredWidthActionNames', movingHeader: 'requiredMovingHeaderNames', widthLifecycle: 'requiredWidthLifecycleNames', drawerMotion: 'requiredDrawerMotionNames', disclosures: 'requiredDisclosureNames',
})
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`
const cmykFlowchart = YAML.parse(readFileSync(new URL('../testdata/transcript-mermaid.yaml', import.meta.url), 'utf8')).accepted.find(row => row.name === 'cmyk-user-flowchart').source

for (const row of fixture.disclosures) test(`tool disclosure ${row.name}`, async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: row.motion })
  await page.goto(`${origin}/?app=transcript&transcript=ledger-disclosure&fb=off&theme=${info.project.name}#inuse`, { waitUntil: 'domcontentloaded' })
  const tool = page.locator('#turn-1 .txn-tc-head').filter({ has: page.locator('.kind', { hasText: row.tool }) }).filter({ hasText: row.preview })
  await expect(tool).toBeAttached()
  const result = await tool.evaluate(async (button, selector) => {
    const original = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      if (this.classList.contains('txn-disclosure')) {
        const until = performance.now() + 100
        while (performance.now() < until) { /* model a slow mount before animation creation */ }
      }
      return original.apply(this, args)
    }
    try {
      const disclosure = button.parentElement.querySelector('.txn-disclosure')
      const capture = async () => {
        button.click()
        await new Promise(requestAnimationFrame)
        const animation = disclosure.getAnimations()[0]
        return { time: animation?.currentTime ?? null, duration: animation?.effect.getComputedTiming().duration ?? null, height: disclosure.getBoundingClientRect().height, hidden: disclosure.hidden }
      }
      const opening = await capture()
      await new Promise(resolve => setTimeout(resolve, 300))
      const fullHeight = disclosure.getBoundingClientRect().height
      const body = disclosure.querySelector(selector)
      const text = body?.textContent ?? ''
      const rows = body?.querySelectorAll('.dl').length ?? 0
      const closing = await capture()
      await new Promise(resolve => setTimeout(resolve, 300))
      return { opening, closing, fullHeight, text, rows, hidden: disclosure.hidden }
    } finally {
      Element.prototype.animate = original
    }
  }, row.selector)
  expect(result.text).toContain(`${fixture.disclosureLinePrefix} ${fixture.disclosureLineCount}`)
  if (row.tool === 'Write') expect(result.rows).toBe(fixture.disclosureLineCount)
  if (row.motion === 'reduce') {
    expect(result.opening.time).toBeNull()
    expect(result.opening.hidden).toBe(false)
    expect(result.closing.time).toBeNull()
    expect(result.closing.hidden).toBe(true)
  } else {
    expect(result.opening.duration).toBe(200)
    expect(result.opening.time).not.toBeNull()
    expect(result.opening.time).toBeLessThanOrEqual(17)
    expect(result.opening.height).toBeLessThan(result.fullHeight * 0.1)
    expect(result.closing.duration).toBe(200)
    expect(result.closing.time).not.toBeNull()
    expect(result.closing.time).toBeLessThanOrEqual(17)
    expect(result.closing.hidden).toBe(false)
    expect(result.closing.height).toBeGreaterThan(result.fullHeight * 0.9)
  }
  expect(result.hidden).toBe(true)
})

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
      expect(geometry.rects).toBe(1); expect(geometry.whiteSpace).toBe('nowrap'); expect(Math.round(geometry.width)).toBeGreaterThanOrEqual(geometry.scrollWidth)
    }
  }
  if (row.width === 320) {
    const stream = viewer.locator('.txn-stream')
    await stream.evaluate(el => { el.scrollTop = 700 })
    await expect(viewer).toHaveClass(/txn-app-condensed/)
    const title = viewer.locator('.txn-crumb [aria-current=page]')
    await expect(title).toBeVisible()
    expect((await title.boundingBox()).width).toBeGreaterThan(0)
    await expect(viewer.locator('.txn-header').getByRole('button', { name: 'publish', exact: true })).toBeVisible()
    await stream.evaluate(el => { el.scrollTop = 0 })
    await expect(viewer).not.toHaveClass(/txn-app-condensed/)
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
for (const row of fixture.drawerMotion) test(`transcript drawer motion ${row.name}`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.emulateMedia({ reducedMotion: row.motion })
  await page.goto(`${origin}/?app=transcript&transcript=ledger-reading&fb=off&theme=${info.project.name}#inuse`)
  await page.locator('#inuse').scrollIntoViewIfNeeded()
  const viewer = page.locator('.txn-app'), footer = viewer.locator('.txn-footer'), stream = viewer.locator('.txn-stream')
  const scroll = await stream.evaluate(el => el.scrollTop)
  const menu = footer.getByRole('button', { name: 'transcript tools' })
  await menu.click()
  const armTransition = () => viewer.evaluate(el => {
    window.__drawerTransition = new Promise(resolve => { const onRun = event => {
      if (event.propertyName !== 'transform' || !event.target.matches('.txn-mobile-drawer-panel')) return
      const animation = event.target.getAnimations().find(a => a.transitionProperty === 'transform')
      if (animation) {
        el.removeEventListener('transitionrun', onRun)
        const dialog = event.target.closest('dialog')
        for (const item of dialog.getAnimations({ subtree: true })) item.pause()
        resolve(true)
      }
    }; el.addEventListener('transitionrun', onRun) })
  })
  if (row.motion === 'no-preference') await armTransition()
  await footer.getByRole('button', { name: row.drawer, exact: true }).click()
  const dialog = viewer.locator('.txn-mobile-drawer'), panel = dialog.locator('.txn-mobile-drawer-panel')
  await expect(dialog).toHaveAttribute('open', '')
  if (row.motion === 'no-preference') {
    await page.evaluate(() => window.__drawerTransition)
    const entrance = await panel.evaluate(el => el.getAnimations().some(a => a.transitionProperty === 'transform'))
    expect(entrance).toBe(true)
    const middle = await panel.evaluate(el => { const a = el.getAnimations().find(item => item.transitionProperty === 'transform'); a.currentTime = a.effect.getTiming().duration / 2; const x = new DOMMatrix(getComputedStyle(el).transform).m41; for (const item of el.closest('dialog').getAnimations({ subtree: true })) item.play(); return { x, width: el.getBoundingClientRect().width } })
    expect(middle.x).toBeLessThan(0); expect(middle.x).toBeGreaterThan(-middle.width)
    await panel.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))) })
  } else expect(await panel.evaluate(el => el.getAnimations().length)).toBe(0)
  if (row.motion === 'no-preference') await armTransition()
  await dialog.getByRole('button', { name: 'close drawer' }).click()
  await expect(menu).toBeFocused()
  await expect(dialog).not.toHaveAttribute('open', '')
  if (row.motion === 'no-preference') {
    await page.evaluate(() => window.__drawerTransition)
    expect(await panel.evaluate(el => el.inert)).toBe(true)
    expect(await panel.evaluate(el => el.getAnimations().some(a => a.transitionProperty === 'transform'))).toBe(true)
    const middle = await panel.evaluate(el => { const a = el.getAnimations().find(item => item.transitionProperty === 'transform'); a.currentTime = a.effect.getTiming().duration / 2; const x = new DOMMatrix(getComputedStyle(el).transform).m41; for (const item of el.closest('dialog').getAnimations({ subtree: true })) item.play(); return { x, width: el.getBoundingClientRect().width } })
    expect(middle.x).toBeLessThan(0); expect(middle.x).toBeGreaterThan(-middle.width)
    await panel.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))) })
  }
  await expect(panel).toHaveCount(0)
  await menu.click(); await footer.getByRole('button', { name: row.drawer, exact: true }).click()
  await expect(dialog).toHaveAttribute('open', '')
  const other = row.drawer === 'filters' ? 'user turns' : 'filters'
  await dialog.getByRole('button', { name: other, exact: true }).click()
  await expect(dialog).toHaveAttribute('aria-label', other)
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
  expect(await stream.evaluate(el => el.scrollTop)).toBe(scroll)
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
  await page.evaluate(() => {
    const animate = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args)
      if (this.classList.contains('txn-header-details')) { animation.pause(); Element.prototype.animate = animate }
      return animation
    }
  })
  await stream.evaluate((el, top) => { el.scrollTop = top }, row.scrollTop)
  await expect.poll(() => header.evaluate(el => el.getAnimations({ subtree: true }).some(a => a.playState === 'paused'))).toBe(true)
  await handle.evaluate(el => {
    const app = el.closest('.txn-app'), stream = app.querySelector('.txn-stream')
    window.__chromeChanges = []
    const observer = new MutationObserver(() => window.__chromeChanges.push({ condensed: app.classList.contains('txn-app-condensed'), scrollTop: stream.scrollTop }))
    observer.observe(app, { attributes: true, attributeFilter: ['class'] })
    el.addEventListener('keydown', () => {
      for (const animation of app.querySelector('.txn-header').getAnimations({ subtree: true })) if (animation.playState === 'paused') animation.play()
      const stream = document.querySelector('.txn-stream'), target = document.querySelector('#turn-0')
      const view = stream.getBoundingClientRect(), box = target.getBoundingClientRect()
      const y = Math.max(Math.max(view.top, box.top) + 1, Math.min(Math.min(view.bottom, box.bottom) - 1, view.top + view.height * 0.4))
      const pos = document.caretPositionFromPoint((Math.max(view.left, box.left) + Math.min(view.right, box.right)) / 2, y)
      if (!pos || pos.offsetNode.nodeType !== Node.TEXT_NODE || !target.contains(pos.offsetNode)) throw new Error('no visible selected text at gesture start')
      const range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true)
      window.__movingWidth = { range, frames: [], running: document.querySelector('.txn-header').getAnimations({ subtree: true }).some(a => a.playState === 'running') }
      const record = () => window.__movingWidth.frames.push({ y: range.getBoundingClientRect().top, streamTop: stream.getBoundingClientRect().top, scrollTop: stream.scrollTop })
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
  for (const frame of evidence.frames) {
    if (Math.abs(frame.y - evidence.frames[0].y) >= 3) expect(frame.scrollTop, 'a shifted range must be at the top clamp').toBeLessThanOrEqual(1)
  }
  await expect(turn).toHaveClass(/txn-active/)
  const state = await page.evaluate(() => ({ y: window.__movingWidth.range.getBoundingClientRect().top, scrollTop: document.querySelector('.txn-stream').scrollTop, condensed: document.querySelector('.txn-app').classList.contains('txn-app-condensed'), header: document.querySelector('.txn-header').getBoundingClientRect().height }))
  console.log('settled width chrome', JSON.stringify(state))
  await expect(page.locator('.txn-app')).not.toHaveClass(/txn-app-condensed/)
  await header.evaluate(async el => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); await Promise.all(el.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))); await new Promise(requestAnimationFrame) })
  const changes = await page.evaluate(() => window.__chromeChanges)
  expect(changes.some(change => !change.condensed && change.scrollTop <= 56)).toBe(true)
  const settled = await page.evaluate(() => ({ y: window.__movingWidth.range.getBoundingClientRect().top, scrollTop: document.querySelector('.txn-stream').scrollTop, condensed: document.querySelector('.txn-app').classList.contains('txn-app-condensed') }))
  console.log('post-reconcile', JSON.stringify(settled))
  expect(settled.condensed).toBe(false)
  if (Math.abs(settled.y - evidence.frames[0].y) >= 3) expect(settled.scrollTop).toBeLessThanOrEqual(1)
})
for (const row of fixture.widthLifecycle) test(`transcript reading width ${row.name}`, async ({ page }, info) => {
  await open(page, info.project.name)
  if (row.kind === 'short') {
    await page.goto(`${origin}/?app=transcript&transcript=ledger-reading-short&fb=off&theme=${info.project.name}#inuse`)
    await page.locator('#inuse').scrollIntoViewIfNeeded()
    const stream = page.locator('.txn-stream')
    await stream.evaluate(el => { el.scrollTop = 0 })
    const handle = page.getByRole('separator', { name: 'reading width' })
    await handle.focus(); await handle.press('Home'); await handle.press('End')
    await expect(page.locator('.txn-app')).not.toHaveClass(/txn-app-condensed/)
    expect(await stream.evaluate(el => el.scrollTop)).toBe(0)
    return
  }
  const stream = page.locator('.txn-stream'), target = page.locator(row.kind === 'top' ? '#turn-0 .txn-turn' : '#turn-49 .txn-turn')
  await target.click()
  if (row.kind === 'top') await stream.evaluate(el => { el.scrollTop = 0 })
  const topY = row.kind === 'top' ? await target.evaluate(el => el.getBoundingClientRect().top) : null
  const handle = page.getByRole('separator', { name: 'reading width' })
  await handle.evaluate(el => { el.addEventListener('pointerdown', e => { window.__widthPointerId = e.pointerId }, { once: true }) })
  const box = await handle.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2
  await page.mouse.move(x, y); await page.mouse.down()
  await expect.poll(() => handle.evaluate(el => el.hasPointerCapture(window.__widthPointerId))).toBe(true)
  await page.mouse.move(x - 40, y)
  await expect.poll(() => handle.evaluate(el => el.hasPointerCapture(window.__widthPointerId))).toBe(true)
  if (row.kind === 'top') {
    await expect(target).toHaveClass(/txn-active/)
    expect(await stream.evaluate(el => el.scrollTop)).toBe(0)
    await page.mouse.up()
    await expect(page.locator('.txn-app')).not.toHaveClass(/txn-app-condensed/)
    expect(await stream.evaluate(el => el.scrollTop)).toBe(0)
    await expect(target).toHaveClass(/txn-active/)
    const position = await target.evaluate(el => el.getBoundingClientRect().top)
    expect(Math.abs(position - topY)).toBeLessThan(3)
    return
  }
  const view = await stream.boundingBox()
  await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2)
  await expect.poll(() => handle.evaluate(el => el.hasPointerCapture(window.__widthPointerId))).toBe(true)
  const before = await stream.evaluate(el => el.scrollTop)
  if (row.kind === 'keyboard') { await stream.focus(); await page.keyboard.press('PageUp') }
  else await page.mouse.wheel(0, -180)
  await expect.poll(() => stream.evaluate(el => el.scrollTop)).toBeLessThan(before)
  await expect.poll(() => handle.evaluate(el => el.hasPointerCapture(window.__widthPointerId))).toBe(true)
  const after = await stream.evaluate(el => el.scrollTop)
  await page.mouse.up()
  await expect.poll(() => stream.evaluate(el => el.scrollTop)).toBeLessThanOrEqual(after)
  if (row.kind === 'interrupt') {
    await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame) })
    expect(await stream.evaluate(el => el.scrollTop)).toBeLessThanOrEqual(after)
  }

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
  // Inspect the real range, not the containing card: a long card can be on screen while its hit is not.
  await expect.poll(() => page.locator('.txn-search-highlight').count()).toBeGreaterThan(0)
  await expect.poll(() => target.evaluate((el, query) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode()) && !node.data.toLowerCase().includes(query.toLowerCase())) {}
    if (!node) return false
    const range = document.createRange(), at = node.data.toLowerCase().indexOf(query.toLowerCase())
    range.setStart(node, at); range.setEnd(node, at + query.length)
    const stream = el.closest('.txn-stream'), r = range.getBoundingClientRect(), s = stream.getBoundingClientRect()
    const unclamped = stream.scrollTop > 1 && stream.scrollTop < stream.scrollHeight - stream.clientHeight - 1
    const painted = [...document.querySelectorAll('.txn-search-highlight')].some(mark => { const m = mark.getBoundingClientRect(); return Math.abs(m.top - r.top) < 2 && Math.abs(m.left - r.left) < 2 })
    return painted && r.top >= s.top && r.top < s.bottom && (!unclamped || Math.abs((r.top - s.top) / stream.clientHeight - 0.4) < 0.05)
  }, row.query)).toBe(true)
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
  await page.getByRole('button', { name: 'close search', exact: true }).click()
  await expect(page.locator('.txn-search-highlight')).toHaveCount(0)
  await info.attach('rendered-destination', { body: JSON.stringify(await inside(target)), contentType: 'application/json' })
})
test('search excludes filtered thinking and restores it without changing the filter', async ({ page }, info) => {
  const row = fixture.navigation.find(item => item.kind === 'thinking')
  await open(page, info.project.name)
  const thinking = page.locator('.txn-filters').getByRole('checkbox', { name: /thinking/ })
  await thinking.uncheck()
  await page.locator('.txn-stream').focus()
  await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'search transcript' }).fill(row.query)
  await expect(page.locator('.txn-search-count')).toHaveText('0 matches')
  await expect(thinking).not.toBeChecked()
  await thinking.check()
  await expect(page.locator('.txn-search-count')).toHaveText('1/1')
  await page.getByRole('button', { name: 'next match', exact: true }).click()
  await expect(page.locator('.txn-thinking-toggle')).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(() => page.locator('.txn-search-highlight').count()).toBeGreaterThan(0)
})
test('search identifies a source-only markdown match', async ({ page }, info) => {
  await open(page, info.project.name)
  await page.locator('.txn-stream').focus()
  await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'search transcript' }).fill(fixture.searchSourceOnly)
  await expect(page.locator('.txn-search-count')).toHaveText('1/1')
  await expect(page.getByRole('status').filter({ hasText: 'match in source, not visible in rendered content' })).toBeVisible()
  await expect(page.locator('.txn-search-highlight')).toHaveCount(0)
})
test('source-only markdown occurrence does not displace the rendered occurrence', async ({ page }, info) => {
  await open(page, info.project.name)
  await page.locator('.txn-stream').focus(); await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'search transcript' }).fill(fixture.searchMixed.query)
  await expect(page.locator('.txn-search-count')).toHaveText('1/2')
  await expect(page.locator('.txn-search-highlight.is-current')).toHaveCount(1)
  await expect(page.getByRole('status').filter({ hasText: 'match in source, not visible' })).toHaveCount(0)
  await page.getByRole('button', { name: 'next match', exact: true }).click()
  await expect(page.locator('.txn-search-count')).toHaveText('2/2')
  await expect(page.getByRole('status').filter({ hasText: 'match in source, not visible' })).toBeVisible()
  await expect(page.locator('.txn-search-highlight.is-current')).toHaveCount(0)
})
test('search reveals a hit beyond the code block horizontal viewport', async ({ page }, info) => {
  await open(page, info.project.name)
  await page.locator('.txn-stream').focus(); await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'search transcript' }).fill(fixture.searchHorizontal)
  const code = page.locator('#turn-1 .txn-md-code-wrap')
  await expect.poll(() => code.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
  await expect.poll(() => code.evaluate((el, query) => {
    const node = el.querySelector('code').firstChild, at = node.data.indexOf(query), range = document.createRange()
    range.setStart(node, at); range.setEnd(node, at + query.length)
    const r = range.getBoundingClientRect(), c = el.getBoundingClientRect()
    return r.left >= c.left && r.right <= c.right
  }, fixture.searchHorizontal)).toBe(true)
  await expect(page.locator('.txn-search-highlight.is-current')).toHaveCount(1)
})
test('selected search highlight has a non-colour marker and readable contrast', async ({ page }, info) => {
  await open(page, info.project.name)
  await page.locator('.txn-stream').focus(); await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'search transcript' }).fill(fixture.navigation.find(item => item.kind === 'body').query)
  const mark = page.locator('.txn-search-highlight.is-current')
  await expect(mark).toHaveCount(1)
  const result = await mark.evaluate(el => {
    const markStyle = getComputedStyle(el), body = document.querySelector('#turn-2 .txn-body p'), style = getComputedStyle(body)
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true })
    canvas.width = 1; canvas.height = 1
    const sample = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3) }
    const ink = sample(style.color)
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = style.getPropertyValue('--canvas'); ctx.fillRect(0, 0, 1, 1); ctx.fillStyle = markStyle.backgroundColor; ctx.fillRect(0, 0, 1, 1)
    const background = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
    const luminance = rgb => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
    const values = [luminance(ink), luminance(background)].sort((a, b) => a - b)
    return { ratio: (values[1] + 0.05) / (values[0] + 0.05), outline: markStyle.outlineStyle, width: parseFloat(markStyle.outlineWidth) }
  })
  expect(result.outline).toBe('solid'); expect(result.width).toBeGreaterThan(0); expect(result.ratio).toBeGreaterThanOrEqual(4.5)
})
test('frequent search culls offscreen highlights during scrolling', async ({ page }, info) => {
  const row = fixture.searchFrequent
  await open(page, info.project.name)
  await page.locator('.txn-stream').focus(); await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'search transcript' }).fill(row.query)
  const count = Number((await page.locator('.txn-search-count').innerText()).split('/')[1])
  expect(count).toBeGreaterThan(row.minimum)
  const elapsed = await page.locator('.txn-stream').evaluate(async (el, step) => {
    el.scrollTop = el.scrollHeight - el.clientHeight - step * 2
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame)
    const start = performance.now(); el.scrollTop += step
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame)
    return performance.now() - start
  }, row.scrollStep)
  await expect.poll(() => page.locator('.txn-search-highlight').count()).toBeGreaterThan(0)
  expect(await page.locator('.txn-search-highlight').count()).toBeLessThan(count)
  expect(elapsed).toBeLessThan(row.maxFrameMs)
  await info.attach('search-scroll-frame', { body: JSON.stringify({ matches: count, elapsedMs: elapsed }), contentType: 'application/json' })
})
test('search highlights without the CSS Highlight API and leaves the host registry alone', async ({ page }, info) => {
  await page.addInitScript(() => { Object.defineProperty(CSS, 'highlights', { configurable: true, value: undefined }) })
  await open(page, info.project.name)
  await page.locator('.txn-stream').focus(); await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'search transcript' }).fill(fixture.navigation.find(item => item.kind === 'body').query)
  await expect.poll(() => page.locator('.txn-search-highlight').count()).toBeGreaterThan(0)
  await expect(page.locator('.txn-search-highlights')).toHaveAttribute('aria-hidden', 'true')
  await page.getByRole('button', { name: 'close search' }).click()
  await expect(page.locator('.txn-search-highlight')).toHaveCount(0)
})
test('search does not replace a host custom highlight', async ({ page }, info) => {
  await open(page, info.project.name)
  await page.evaluate(() => { const range = document.createRange(); range.selectNodeContents(document.querySelector('#inuse')); CSS.highlights.set('txn-search-match', new Highlight(range)) })
  await page.locator('.txn-stream').focus(); await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'search transcript' }).fill(fixture.navigation.find(item => item.kind === 'body').query)
  await expect.poll(() => page.locator('.txn-search-highlight').count()).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'close search' }).click()
  expect(await page.evaluate(() => CSS.highlights.get('txn-search-match')?.size)).toBe(1)
})
test('search navigates repeated occurrences in one long section', async ({ page }, info) => {
  const row = fixture.searchRepeated
  await open(page, info.project.name)
  await page.locator('.txn-stream').focus(); await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'search transcript' }).fill(row.query)
  await expect(page.locator('.txn-search-count')).toHaveText('1/2')
  const paragraphs = page.locator(`#turn-${row.turn} .txn-body p`)
  const position = n => paragraphs.nth(n - 1).evaluate(el => { const s = el.closest('.txn-stream'); return (el.getBoundingClientRect().top - s.getBoundingClientRect().top) / s.clientHeight })
  await expect.poll(() => position(row.paragraphs[0])).toBeGreaterThan(0.2)
  await expect.poll(() => position(row.paragraphs[0])).toBeLessThan(0.6)
  await page.getByRole('button', { name: 'next match', exact: true }).click()
  await expect(page.locator('.txn-search-count')).toHaveText('2/2')
  await expect.poll(() => position(row.paragraphs[1])).toBeGreaterThan(0.2)
  await expect.poll(() => position(row.paragraphs[1])).toBeLessThan(0.6)
  await expect.poll(() => page.locator('.txn-search-highlight').count()).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'previous match', exact: true }).click()
  await expect(page.locator('.txn-search-count')).toHaveText('1/2')
  await expect.poll(() => position(row.paragraphs[0])).toBeGreaterThan(0.2)
  await expect.poll(() => position(row.paragraphs[0])).toBeLessThan(0.6)
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

test('mermaid diagrams stay local, readable and inert', async ({ page }, info) => {
  const requests = []
  page.on('request', request => { if (request.url().includes('evil.example') || request.url().includes('mermaid-probe-image')) requests.push(request.url()) })
  await page.addInitScript(() => {
    window.malicious = () => { window.__maliciousCalled = true }
    window.__compilerForeignObjects = 0
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType === 1) window.__compilerForeignObjects += (node.localName === 'foreignObject' ? 1 : 0) + node.querySelectorAll('foreignObject').length
        }
      }).observe(document.body, { childList: true, subtree: true })
    })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(`${origin}/?app=transcript&transcript=mermaid-reading&fb=off&theme=${info.project.name}#inuse`)
  const diagrams = page.locator('.txn-mermaid')
  await expect(diagrams).toHaveCount(17)
  for (const button of await diagrams.first().locator('.txn-mermaid-toolbar button').all()) {
    const box = await button.boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(36)
    expect(box.height).toBeGreaterThanOrEqual(36)
  }
  for (let i = 0; i < 2; i++) {
    await diagrams.nth(i).getByRole('button', { name: 'view diagram' }).click()
    await expect(diagrams.nth(i).locator('svg')).toBeVisible()
  }
  for (let i = 3; i < 8; i++) {
    await diagrams.nth(i).getByRole('button', { name: 'view diagram' }).click()
    await expect(diagrams.nth(i).locator('svg')).toBeVisible()
  }
  await page.evaluate(() => { window.__compilerForeignObjects = 0 })
  for (let i = 9; i < 12; i++) {
    await diagrams.nth(i).getByRole('button', { name: 'view diagram' }).click()
    await expect(diagrams.nth(i).locator('svg')).toBeVisible()
    await expect(diagrams.nth(i).locator('foreignObject')).toHaveCount(0)
  }
  expect(await page.evaluate(() => window.__compilerForeignObjects)).toBe(0)
  for (let i = 12; i < 14; i++) {
    await diagrams.nth(i).getByRole('button', { name: 'view diagram' }).click()
    await expect(diagrams.nth(i).getByRole('status')).toContainText('not supported')
  }
  await diagrams.nth(14).getByRole('button', { name: 'view diagram' }).click()
  await expect(diagrams.nth(14).getByRole('status')).toContainText('diagram unavailable')
  await diagrams.nth(15).getByRole('button', { name: 'view diagram' }).click()
  await expect(diagrams.nth(15).locator('.txn-mermaid-stage svg')).toBeVisible()
  await expect(diagrams.nth(15).locator('.txn-mermaid-stage')).toContainText('First')
  await expect(diagrams.nth(15).locator('.txn-mermaid-stage')).toContainText('Second')
  await expect(diagrams.nth(16).locator('pre code')).toHaveText(`${cmykFlowchart}\n`)
  await diagrams.nth(16).getByRole('button', { name: 'view diagram' }).click()
  await expect(diagrams.nth(16).locator('.txn-mermaid-stage svg')).toBeVisible()
  await expect(diagrams.nth(16).locator('.txn-mermaid-stage')).toContainText('apply_values(v)')
  await expect(diagrams.nth(16).locator('.txn-mermaid-stage')).toContainText('60/51/53/59')
  await diagrams.nth(8).getByRole('button', { name: 'view diagram' }).click()
  await expect(diagrams.nth(8).getByRole('status')).toContainText('diagram unavailable')
  await diagrams.nth(2).getByRole('button', { name: 'view diagram' }).click()
  await expect(diagrams.nth(2).getByRole('status')).toContainText('not supported')
  expect(requests).toEqual([])
  expect(await page.evaluate(() => window.__maliciousCalled === true)).toBe(false)
  const ids = await page.locator('.txn-mermaid-stage svg [id]').evaluateAll(els => els.map(el => el.id))
  expect(new Set(ids).size).toBe(ids.length)
  const fontSize = await diagrams.first().locator('svg text').first().evaluate(el => getComputedStyle(el).fontSize)
  expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(16)
  const stage = diagrams.first().locator('.txn-mermaid-stage')
  expect(await stage.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
  await stage.evaluate(el => { el.scrollLeft = el.scrollWidth })
  expect(await stage.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
  await diagrams.first().getByRole('button', { name: 'copy source' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('flowchart LR\nA[Source Case] --> B[Destination]\n')
  await diagrams.first().getByRole('button', { name: 'view source' }).click()
  await expect(diagrams.first().locator('pre')).toContainText('A[Source Case] --> B[Destination]')
})

test.describe('touch mermaid controls', () => {
  test.use({ hasTouch: true })
  test('mermaid toolbar uses comfortable targets', async ({ page }, info) => {
    await page.setViewportSize({ width: fixture.mobile[0].width, height: fixture.mobile[0].height })
    await page.goto(`${origin}/?app=transcript&transcript=mermaid-reading&fb=off&theme=${info.project.name}#inuse`)
    const buttons = page.locator('.txn-mermaid').first().locator('.txn-mermaid-toolbar button')
    await expect(buttons.first()).toBeVisible()
    for (const button of await buttons.all()) {
      const box = await button.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
})

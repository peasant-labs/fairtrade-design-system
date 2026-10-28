import { test, expect } from '@playwright/test'
import { loadFixturePair } from '../mounted-parts.mjs'

// Pixels, real overflow and post-animation visibility cannot be proved in JSDOM.
// Reuse the existing built app/runner and small shared demo fixture; no extra service.
const { fixture } = loadFixturePair('scripts/testdata/transcript-reading-browser.yaml', 'scripts/testdata/transcript-reading-browser.manifest.yaml', {
  navigation: 'requiredNavigationNames', initial: 'requiredInitialNames', rail: 'requiredRailNames',
})
const origin = `http://localhost:${process.env.JOURNEY_APP_PORT || 5180}`
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

test('mermaid diagrams stay local, readable and inert', async ({ page }, info) => {
  const requests = []
  page.on('request', request => { if (request.url().includes('evil.example')) requests.push(request.url()) })
  await page.addInitScript(() => { window.malicious = () => { window.__maliciousCalled = true } })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(`${origin}/?app=transcript&transcript=mermaid-reading&fb=off&theme=${info.project.name}#inuse`)
  const diagrams = page.locator('.txn-mermaid')
  await expect(diagrams).toHaveCount(3)
  for (let i = 0; i < 2; i++) {
    await diagrams.nth(i).getByRole('button', { name: 'view diagram' }).click()
    await expect(diagrams.nth(i).locator('svg')).toBeVisible()
  }
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

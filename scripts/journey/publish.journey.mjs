import { test, expect } from '@playwright/test'
import { loadStrictYaml, assertExactNames } from '../css-source.mjs'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { scanAxe, seriousViolations } from './lib/assertions.mjs'

const spec = loadStrictYaml('scripts/testdata/publish-mounted.yaml')
const manifest = loadStrictYaml('scripts/testdata/publish-mounted.manifest.yaml')
assertExactNames(spec.cases.map((row) => row.name), manifest.requiredCaseNames, 'mounted publish rows')
assertExactNames([spec.pending.name],manifest.requiredPendingNames,'host-held publication cases')
const consent = loadStrictYaml('scripts/testdata/publish-consent.yaml')
const appURL = `http://localhost:${process.env.JOURNEY_APP_PORT || '5180'}`
// This marker is unique to the repaired production path, not a test-only DOM flag.
const marker = "updates to already-published sessions, redacted, without review"
const asset = readdirSync('dist/assets').find((file) => file.endsWith('.js') && readFileSync(join('dist/assets', file), 'utf8').includes(marker))
if (!asset) throw new Error('publish journey: dist/assets lacks mandatory consent; rebuild this checkout before capturing the mounted path')

async function heldPublication(page,row) {
  const pending=spec.pending
  let release
  const completion=new Promise(resolve=>{release=resolve})
  const requests=[]
  await page.route(pending.endpoint,async(route)=>{
    requests.push(route.request().method())
    await completion
    await route.fulfill({status:pending.response.status,body:pending.response.body,headers:{'access-control-allow-origin':'*'}})
  })
  try {
    await page.goto(`/iframe.html?id=${pending.story}&viewMode=story&globals=theme:${row.theme}`)
    const opener=page.locator('.pub-bar-action')
    await opener.press('Enter')
    const dialog=page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const request=page.waitForRequest(request=>request.url()===pending.endpoint&&request.method()===pending.method)
    await dialog.getByRole('button',{name:pending.primaryLabel,exact:true}).press('Enter')
    await request
    const primary=dialog.locator('.pub-primary[aria-busy="true"]')
    await expect(primary).toBeFocused()
    await expect(dialog.locator('.pub-rescan')).toBeDisabled()
    await primary.press('Escape')
    expect(await page.getByLabel('host close calls').textContent(),'pending publication must ignore Escape').toBe(pending.expectedPendingCloseCalls)
    await expect(dialog,'pending publication must ignore Escape').toBeVisible()
    await expect(primary).toHaveAttribute('aria-busy','true')
    await primary.press('Enter')
    const bounds=await primary.boundingBox()
    await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2)
    expect(await page.getByLabel('host publish calls').textContent(),'pending duplicate activation must not resubmit').toBe(pending.expectedPublishCalls)
    expect(requests,'only the original publication request may start').toEqual(Array(pending.expectedRequests).fill(pending.method))
    release()
    const done=dialog.getByRole('button',{name:pending.doneLabel,exact:true})
    await expect(done).toBeFocused()
    await done.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    await expect(page.getByLabel('host publish calls')).toHaveText(pending.expectedPublishCalls)
    await expect(page.getByLabel('host close calls')).toHaveText(pending.expectedCompletedCloseCalls)
  } finally {
    release()
    await page.unrouteAll({behavior:'wait'})
  }
}

for (const row of spec.cases) {
  test(`mounted publish ${row.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: row.width, height: 900 })
    const response = await page.request.get(`${appURL}/assets/${asset}`)
    expect(await response.text()).toBe(readFileSync(join('dist/assets', asset), 'utf8'))
    await page.goto(`${appURL}/?fb=off&theme=${row.theme}#inuse`)
    expect(new URL(page.url()).searchParams.get('theme')).toBe(row.theme)
    await expect(page.locator('html')).toHaveAttribute('data-theme', row.theme)
    const split = page.locator(spec.mobile.splitSelector)
    await expect(split).toBeVisible()
    const columns = await split.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(columns).toBe(row.width < spec.mobile.splitBoundary ? 1 : 2)
    await expect(page.locator(spec.mobile.columnSelector)).toHaveCSS('border-left-width', row.width < spec.mobile.splitBoundary ? '0px' : '1px')
    const opener = page.locator('#inuse .pub-bar-action').first()
    await opener.press('Enter')
    const dialog = page.locator('.pub-dialog[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.pub-primary')).toBeVisible()
    await expect(dialog.locator('.dlg-head button')).toBeFocused()
    const primary = dialog.locator('.pub-primary')
    await expect(primary).toBeEnabled()
    // Stress the real mounted layout with a fixture repository label. The host
    // note is text, so no alternate component or rendering implementation is used.
    await dialog.locator(spec.mobile.labelSelector).first().evaluate((el, text) => { el.textContent = text }, spec.mobile.longRepositoryLabel)
    const target = await opener.evaluate((el) => ({ height: el.getBoundingClientRect().height, token: parseFloat(getComputedStyle(el).getPropertyValue('--control-h')) }))
    expect(target.height).toBeGreaterThanOrEqual(target.token)
    await dialog.locator('.pub-auto input').check()
    await expect(dialog.locator('.pub-auto .pub-hint')).toHaveText(consent.checkedSentence)
    await dialog.locator('.pub-auto .pub-hint').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`consent-${row.theme}-${row.width}.png`), fullPage: false })
    await dialog.locator('.pub-toggle').click()
    await expect(dialog.locator('.rdx-badge-cat').first()).toHaveText('CREDENTIAL')
    await expect(dialog.getByText('confidence', { exact: true }).first()).toBeVisible()
    await expect(dialog.locator(spec.mobile.chromeSelector).first()).toHaveCSS('font-size', `${spec.mobile.chromeSize}px`)
    await dialog.getByText('confidence', { exact: true }).first().focus()
    await expect(dialog.getByText('how sure the scanner is that this is a real match', { exact: true }).first()).toBeVisible()
    const layout = await dialog.evaluate((el) => {
      const label = el.querySelector('.pub-access-note')
      const style = getComputedStyle(label)
      const bounds = el.getBoundingClientRect()
      return {
        overflow: el.scrollWidth - el.clientWidth,
        labelOverflow: label.scrollWidth - label.clientWidth,
        nowrap: style.whiteSpace === 'nowrap',
        clamp: style.webkitLineClamp,
        controlsContained: [...el.querySelectorAll('button, input')].every((control) => {
          const rect = control.getBoundingClientRect()
          return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
        }),
      }
    })
    expect(layout.overflow).toBeLessThanOrEqual(1)
    expect(layout.labelOverflow).toBeLessThanOrEqual(1)
    expect(layout.nowrap).toBe(false)
    expect(layout.clamp).toBe('none')
    expect(layout.controlsContained).toBe(true)
    await primary.focus()
    await primary.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(primary).toBeFocused()
    const ring = await primary.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(ring).not.toBe('none')
    await page.screenshot({ path: testInfo.outputPath(`publish-${row.theme}-${row.width}.png`), fullPage: false })
    const scan = await scanAxe(page, { root: '.pub-dialog' })
    expect(scan.passes).toBeGreaterThan(0)
    expect(seriousViolations(scan), 'publish has no critical or serious accessibility exceptions').toEqual([])
    await testInfo.attach('publish-accessibility.json', { body: JSON.stringify({ width: row.width, theme: row.theme, scan }), contentType: 'application/json' })
    await primary.press('Enter')
    // This real product host completes on a short timer. Pending-only interaction invariants
    // run below against the same public dialog with a held ordinary async host dependency.
    // Here the observable contract is the completed production flow, not winning that timer.
    const done = dialog.locator('.dlg-foot .btn-primary')
    await expect(done).toHaveText('done')
    await expect(done).toBeFocused()
    await done.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    await expect(opener).toHaveText('update')

    // Hold only the menu's scheduled focus frame. Discrete React key events still
    // commit normally, so Escape is tested before the real handoff can run.
    const menu = page.locator('#inuse .pub-bar .menu-trigger').first()
    await menu.focus()
    await page.evaluate(() => {
      window.__publishFrames = { request: window.requestAnimationFrame, cancel: window.cancelAnimationFrame, queue: new Map(), next: 1 }
      window.requestAnimationFrame = (fn) => { const id = window.__publishFrames.next++; window.__publishFrames.queue.set(id, fn); return id }
      window.cancelAnimationFrame = (id) => window.__publishFrames.queue.delete(id)
    })
    try {
      await menu.press('ArrowDown')
      await expect(menu).toHaveAttribute('aria-expanded', 'true')
      await expect(menu).toBeFocused()
      await menu.press('Escape')
      await expect(menu).toHaveAttribute('aria-expanded', 'false')
      await expect(menu).toBeFocused()
    } finally {
      await page.evaluate(() => {
        const frames = window.__publishFrames
        window.requestAnimationFrame = frames.request
        window.cancelAnimationFrame = frames.cancel
        for (const fn of frames.queue.values()) fn(performance.now())
        delete window.__publishFrames
      })
    }
    await expect(menu).toBeFocused()
    await heldPublication(page,row)
  })
}

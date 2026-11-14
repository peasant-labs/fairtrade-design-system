#!/usr/bin/env node
/* Browser-only risks: the built full wizard's reflow, token contrast, and local-preview side
   effects. Point WIZARD_PREVIEW_ORIGIN at an independently built app; optional WIZARD_CAPTURE_DIR
   captures the entire mounted shell. No server, build directory or browser process is shared. */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertExactNames, loadFixturePair } from './mounted-parts.mjs'

const { fixture, manifest } = loadFixturePair('scripts/testdata/kickstart-preview-browser.yaml', 'scripts/testdata/kickstart-preview-browser.manifest.yaml')
assertExactNames([fixture.race.name], manifest.requiredRaceNames, 'browser preview races')
const origin = process.env.WIZARD_PREVIEW_ORIGIN || 'http://127.0.0.1:5180'
const build = process.env.WIZARD_BUILD_DIR || 'dist'
const output = process.env.WIZARD_CAPTURE_DIR
if (output) mkdirSync(output, { recursive: true })
const options = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
const browser = await chromium.launch(options)
const evidence = []
try {
  for (const row of fixture.cases) {
    const page = await browser.newPage({ viewport: { width: row.width, height: row.height }, reducedMotion: 'reduce' })
    try {
      const requests = [], messages = [], failures = [], sockets = []
      page.on('request', request => requests.push({ url: request.url(), body: request.postData() }))
      page.on('console', message => messages.push(message.text()))
      page.on('pageerror', error => failures.push(error.message))
      page.on('websocket', socket => sockets.push(socket.url()))
      await page.route('**/*', route => route.request().url().includes(fixture.probe.imageHost) ? route.abort() : route.continue())
      await page.addInitScript(() => {
        window.previewObservations = { writes: [], clipboard: [], topics: [], sends: [] }
        const storageWrite = Storage.prototype.setItem
        Storage.prototype.setItem = function (key, value) { window.previewObservations.writes.push([key, value]); return storageWrite.call(this, key, value) }
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.previewObservations.clipboard.push(value) } } })
        for (const name of ['WebSocket', 'EventSource', 'BroadcastChannel']) {
          if (!window[name]) continue
          const Native = window[name]
          window[name] = new Proxy(Native, { construct(target, args, newTarget) { window.previewObservations.topics.push([name, ...args]); return Reflect.construct(target, args, newTarget) } })
        }
        const sendBeacon = navigator.sendBeacon?.bind(navigator)
        if (sendBeacon) navigator.sendBeacon = (...args) => { window.previewObservations.sends.push(args.map(String)); return sendBeacon(...args) }
      })
      await page.goto(`${origin}/?fb=off&app=graph&view=kickstart&theme=${row.theme}#inuse`, { waitUntil: 'networkidle' })
      await page.locator('#inuse').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }))
      const item = page.locator(`[data-node-id="${fixture.probe.node}"]`)
      const check = item.locator('input[type=checkbox]')
      const before = await check.isChecked()
      await item.locator('.st-title').click()
      assert.equal(await check.isChecked(), before, `${row.name}: title changed selection`)
      assert.equal(await item.locator('.st-title').getAttribute('aria-pressed'), 'true')
      const viewer = page.locator('.iu-ks-preview .txn-app')
      await viewer.locator('[data-highlighted="true"]').waitFor({ state: 'attached' })
      await page.evaluate(() => document.fonts.ready)
      assert.equal(await viewer.getAttribute('data-theme'), row.theme)
      assert.equal(await viewer.locator('h4.txn-title').innerText(), fixture.probe.title)
      assert.match(await page.locator('.iu-ks-preview').innerText(), /sample transcript, no local session was read/)
      assert.equal(await viewer.locator('img[src*="preview.invalid"]').count(), 0)
      assert.equal(await viewer.locator('[data-txn-image-blocked]').count(), 1)
      assert.match(await viewer.locator('[data-highlighted="true"]').innerText(), /retentionDays = 30/)
      assert.equal(await viewer.locator('.txn-body-grid').getAttribute('data-left-rail'), 'closed')
      assert.equal(await viewer.locator('.txn-body-grid').getAttribute('data-right-rail'), 'closed')
      const layout = await page.evaluate(() => {
        const tree = document.querySelector('.iu-ks-tree').getBoundingClientRect()
        const preview = document.querySelector('.iu-ks-preview').getBoundingClientRect()
        const treeEl = document.querySelector('.iu-ks-tree')
        const source = document.querySelector('.iu-ks-preview [data-highlighted="true"]')
        const parse = value => (value.match(/[\d.]+/g) || []).map(Number)
        const backgroundOf = el => {
          for (let node = el; node; node = node.parentElement) {
            const rgba = parse(getComputedStyle(node).backgroundColor)
            if (rgba.length === 3 || rgba[3] > 0) return rgba.slice(0, 3)
          }
          return [255, 255, 255]
        }
        const luminance = rgb => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
        const background = backgroundOf(source)
        const contrast = [...source.querySelectorAll('span')].filter(el => el.textContent.trim()).map(el => {
          const color = parse(getComputedStyle(el).color).slice(0, 3)
          const a = luminance(color), b = luminance(background)
          return { className: el.className, ratio: (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05) }
        })
        return { tree: { x:tree.x, y:tree.y, width:tree.width, height:tree.height }, preview: { x:preview.x, y:preview.y, width:preview.width }, treeScroll: treeEl.scrollWidth, treeWidth: treeEl.clientWidth, documentScroll: document.documentElement.scrollWidth, documentWidth: document.documentElement.clientWidth, contrast, background }
      })
      assert.ok(layout.documentScroll <= layout.documentWidth, `${row.name}: page overflows horizontally`)
      assert.ok(layout.treeScroll <= layout.treeWidth, `${row.name}: a tree row overflows its pane`)
      assert.ok(row.layout === 'stacked' ? layout.preview.y >= layout.tree.y + layout.tree.height : layout.preview.x > layout.tree.x + layout.tree.width, `${row.name}: incorrect pane layout`)
      assert.ok(layout.contrast.length > 0 && layout.contrast.every(token => token.ratio >= 4.5), `${row.name}: code token contrast below 4.5:1: ${JSON.stringify(layout.contrast)}`)
      const assets = await page.locator('link[rel="stylesheet"][href^="/assets/"],script[type="module"][src^="/assets/"]').evaluateAll(els => els.map(el => el.getAttribute('href') || el.getAttribute('src')))
      assert.ok(assets.length >= 2, `${row.name}: no built app assets found`)
      const hashes = []
      let containsProbe = false
      for (const asset of assets) {
        const served = Buffer.from(await (await page.request.get(new URL(asset, origin).href)).body())
        assert.ok(served.equals(readFileSync(join(build, asset.slice(1)))), `${row.name}: served ${asset} is not this build`)
        if (asset.endsWith('.js') && served.includes(fixture.probe.secret)) containsProbe = true
        hashes.push({ asset, sha256: createHash('sha256').update(served).digest('hex') })
      }
      assert.ok(containsProbe, `${row.name}: served build does not contain the secret-bearing synthetic fixture`)
      if (output) {
        await page.locator('#inuse').screenshot({ path: join(output, `${row.theme}-${row.layout === 'stacked' ? 'narrow' : 'desktop'}-top.png`), animations: 'disabled' })
      }
      await viewer.getByRole('button', { name: /copy link to turn/i }).first().click()
      if (output) {
        await viewer.locator('.txn-stream').evaluate(el => { el.scrollTop = el.scrollHeight })
        await page.locator('#inuse').screenshot({ path: join(output, `${row.theme}-${row.layout === 'stacked' ? 'narrow' : 'desktop'}-code.png`), animations: 'disabled' })
      }
      await viewer.getByRole('button', { name: 'transcript tools' }).click()
      await viewer.getByRole('button', { name: 'user turns', exact: true }).click()
      const drawer = viewer.locator('dialog[open]')
      await drawer.waitFor()
      assert.equal(await drawer.getAttribute('aria-label'), 'user turns', `${row.name}: outline drawer must open`)
      await drawer.getByRole('button', { name: 'filters', exact: true }).click()
      assert.equal(await drawer.getAttribute('aria-label'), 'filters', `${row.name}: filters drawer must open`)
      await drawer.locator('.txn-toolcat-toggle').click()
      await drawer.getByRole('button', { name: 'close drawer' }).click()
      await page.keyboard.press('Control+f')
      await viewer.getByRole('textbox', { name: 'search transcript' }).fill(fixture.probe.search)
      await page.waitForFunction(() => document.querySelector('.iu-ks-preview .txn-search-count')?.textContent !== '0 matches')
      await page.locator('.txn-search-highlight.is-current').first().waitFor()
      assert.equal(await viewer.locator('.txn-search-unrendered').count(), 0, `${row.name}: search must find text across token spans`)
      await page.keyboard.press('Escape')
      const observations = await page.evaluate(() => window.previewObservations)
      assert.equal(observations.clipboard.length, 1, `${row.name}: explicit turn link was not copied`)
      const raw = [fixture.probe.secret, fixture.probe.source, fixture.probe.excerpt]
      for (const value of raw) {
        assert.ok(!JSON.stringify([observations, requests, messages]).includes(value), `${row.name}: transcript content escaped through storage, clipboard, log or network`)
      }
      assert.ok(!requests.some(request => request.url.includes(fixture.probe.imageHost)), `${row.name}: the blocked Markdown image initiated a request`)
      assert.deepEqual(observations.topics, [], `${row.name}: a live topic was opened`)
      const disclosure = observations.writes.filter(([key]) => key === 'fairtrade.transcript.tool-groups-open')
      assert.equal(disclosure.length, 1, `${row.name}: tool disclosure writes its preference only on interaction`)
      assert.ok(['true', 'false'].includes(disclosure[0][1]), `${row.name}: tool disclosure must store only a boolean`)
      assert.deepEqual(sockets, [], `${row.name}: a websocket was opened`)
      assert.deepEqual(failures, [], `${row.name}: browser error`)
      evidence.push({ name: row.name, origin, layout, hashes, clipboard: observations.clipboard, writes: observations.writes, requests: requests.length })
    } finally { await page.close() }
  }
  const race = fixture.race
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, reducedMotion: 'reduce' })
  let release
  try {
    const gate = new Promise(resolve => { release = resolve })
    const grammarPattern = /\/assets\/typescript-[^/]+\.js$/
    await page.route(grammarPattern, async route => { await gate; await route.continue() })
    await page.goto(`${origin}/?fb=off&app=graph&view=kickstart&theme=dark#inuse`, { waitUntil: 'networkidle' })
    const requested = page.waitForRequest(grammarPattern)
    await page.locator(`[data-node-id="${race.firstNode}"] .st-title`).click()
    await requested
    await page.locator(`[data-node-id="${race.secondNode}"] .st-title`).click()
    const done = page.waitForResponse(grammarPattern)
    release()
    await (await done).finished()
    await page.waitForFunction(title => document.querySelector('.iu-ks-preview .txn-title')?.textContent === title, race.secondTitle)
    assert.ok(!(await page.locator('.iu-ks-preview').innerText()).includes(fixture.probe.source), `${race.name}: stale tokens replaced the new session`)
    evidence.push({ name: race.name, origin })
  } finally { release?.(); await page.close() }
} finally { await browser.close() }
if (output) writeFileSync(join(output, 'evidence.json'), JSON.stringify(evidence, null, 2))
console.log(`kickstart preview: ${evidence.length} built-app browser cases passed`)

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
assertExactNames([fixture.resize.name], manifest.requiredResizeNames, 'browser resize checks')
assertExactNames([fixture.shortViewport.name], manifest.requiredShortViewportNames, 'short phone checks')
assertExactNames(fixture.cases.filter(row => 'minVisibleTrace' in row).map(row => row.name), manifest.requiredViewportNames, 'short viewport checks')
for (const row of fixture.cases.filter(row => 'minVisibleTrace' in row)) {
  assert.ok(Number.isFinite(row.minVisibleTrace) && row.minVisibleTrace > 0, `${row.name}: the minimum visible transcript height must be positive`)
}
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
      assert.equal(await page.locator('.iu-ks-selection .iu-ks-stop').textContent(), 'choose sessions to import', `${row.name}: selection heading must be in the tree pane`)
      assert.equal(await page.locator('.iu-ks-preview-note').count(), 0, `${row.name}: the bottom-left notice is removed`)
      assert.equal(await viewer.locator('img[src*="preview.invalid"]').count(), 0)
      assert.equal(await viewer.locator('[data-txn-image-blocked]').count(), 1)
      assert.match(await viewer.locator('[data-highlighted="true"]').innerText(), /retentionDays = 30/)
      assert.equal(await viewer.locator('.txn-body-grid').getAttribute('data-left-rail'), 'closed')
      assert.equal(await viewer.locator('.txn-body-grid').getAttribute('data-right-rail'), 'closed')
      if (row.minVisibleTrace) {
        await viewer.getByRole('tab', { name: /full trace/ }).click()
        await page.locator('#inuse-stage').evaluate(el => { el.scrollTop = 0 })
      }
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
        const trace = document.querySelector('.iu-ks-preview .txn-stream')?.getBoundingClientRect()
        const stage = document.querySelector('#inuse-stage').getBoundingClientRect()
        const foot = document.querySelector('.iu-ks .swz-foot').getBoundingClientRect()
        const tabs = document.querySelector('.iu-ks-preview .txn-foot-tabs').getBoundingClientRect()
        const count = document.querySelector('.iu-ks-selection .iu-ks-counts').getBoundingClientRect()
        const title = document.querySelector('.iu-ks-page-title').getBoundingClientRect()
        const clearOfFoot = rect => rect.top >= stage.top && rect.bottom <= Math.min(stage.bottom, foot.top) + 1
        const visibleTrace = trace ? Math.max(0, Math.min(trace.bottom, stage.bottom, foot.top, innerHeight) - Math.max(trace.top, stage.top, 0)) : 0
        return { tree: { x:tree.x, y:tree.y, width:tree.width, height:tree.height }, preview: { x:preview.x, y:preview.y, width:preview.width }, treeScroll: treeEl.scrollWidth, treeWidth: treeEl.clientWidth, documentScroll: document.documentElement.scrollWidth, documentWidth: document.documentElement.clientWidth, visibleTrace, tabsVisible: clearOfFoot(tabs), countVisible: clearOfFoot(count), titleVisible: clearOfFoot(title), contrast, background }
      })
      assert.ok(layout.documentScroll <= layout.documentWidth, `${row.name}: page overflows horizontally`)
      assert.ok(layout.treeScroll <= layout.treeWidth, `${row.name}: a tree row overflows its pane`)
      assert.ok(row.layout === 'stacked' ? layout.preview.y >= layout.tree.y + layout.tree.height : layout.preview.x > layout.tree.x + layout.tree.width, `${row.name}: incorrect pane layout`)
      if (row.minVisibleTrace) {
        assert.ok(layout.visibleTrace >= row.minVisibleTrace, `${row.name}: only ${layout.visibleTrace}px of the transcript is visible above the wizard footer; need ${row.minVisibleTrace}px`)
        assert.ok(layout.tabsVisible && layout.countVisible && layout.titleVisible, `${row.name}: the footer obscures viewer tabs, selection count or page title: ${JSON.stringify(layout)}`)
      }
      assert.ok(layout.contrast.length > 0 && layout.contrast.every(token => token.ratio >= 4.5), `${row.name}: code token contrast below 4.5:1: ${JSON.stringify(layout.contrast)}`)
      const rail = page.locator('.iu-ks .swz-foot > .swz-rail')
      const footer = page.locator('.iu-ks .swz-foot')
      const previous = footer.getByRole('button', { name: 'prev' })
      const next = footer.getByRole('button', { name: 'continue' })
      assert.equal(await page.locator('.iu-subnav .iu-ks-page-title').textContent(), 'set up peasant', `${row.name}: the title is in the top row`)
      assert.equal(await page.locator('.iu-ks > .swz').getAttribute('aria-label'), 'set up peasant')
      assert.equal(await rail.locator('.swz-step').count(), 10)
      await rail.getByRole('button', { name: 'step 2 of 10, choose sessions to import' }).waitFor({ state: row.width < 768 ? 'hidden' : 'visible' })
      assert.equal(await previous.evaluate(el => getComputedStyle(el).borderTopStyle), 'solid', `${row.name}: prev is outlined`)
      assert.equal(await page.locator('.iu-ks .swz-count .swz-sr-only').textContent(), 'step 2 of 10')
      const railGeometry = await rail.evaluate(el => {
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width, height: r.height, y: r.y } }
        const labels = [...el.querySelectorAll('.swz-label')].map(label => ({ ...rect(label), text: label.textContent.trim(), scrollWidth: label.scrollWidth, clientWidth: label.clientWidth, lineHeight: parseFloat(getComputedStyle(label).lineHeight) }))
        return { display: getComputedStyle(el).display, rail: rect(el), labels }
      })
      const labels = railGeometry.labels.filter(label => label.width > 1 && label.height > 1)
      if (row.width >= 768) {
        const names = await rail.ariaSnapshot()
        for (const [index, name] of fixture.stopLabels.entries()) {
          assert.ok(names.includes(`step ${index + 1} of ${fixture.stopLabels.length}, ${name}`), `${row.name}: marker must keep the full name ${name}: ${names}`)
        }
        assert.ok(labels.length === 0 || labels.length === 10, `${row.name}: labels must hide together`)
        if (row.labelsVisible !== undefined) assert.equal(labels.length, row.labelsVisible ? 10 : 0, `${row.name}: label fallback must respond to the complete text width`)
        assert.ok(labels.every(label => label.text.split(/\s+/).length <= 3 && label.height <= label.lineHeight + 1 && label.scrollWidth <= label.clientWidth + 1), `${row.name}: label is wrapped or clipped: ${JSON.stringify(labels)}`)
        assert.ok(labels.every((label, i) => i === 0 || label.x >= labels[i - 1].right - 0.5), `${row.name}: step labels overlap`)
        const [prevBox, nextBox] = await Promise.all([previous.boundingBox(), next.boundingBox()])
        assert.ok(railGeometry.rail.x - (prevBox.x + prevBox.width) >= 31 && nextBox.x - railGeometry.rail.right >= 31, `${row.name}: the rail needs separation from both actions`)
      } else {
        assert.equal(railGeometry.display, 'none', `${row.name}: phone rail must not leave invisible tab stops`)
        const snapshot = await page.locator('.iu-ks > .swz').ariaSnapshot()
        assert.ok(snapshot.includes('step 2 of 10') && snapshot.includes('choose sessions to import') && snapshot.includes('3 sessions chosen'), `${row.name}: mobile position and selection context missing: ${snapshot}`)
        assert.ok(!snapshot.includes('10 sessions found') && !snapshot.includes('navigation "set up peasant progress"'), `${row.name}: hidden phone chrome leaked into the accessibility tree`)
        assert.equal(await page.locator('.iu-ks-counts').innerText(), '3 sessions chosen')
        const count = await page.locator('.iu-ks-counts-mobile').evaluate(el => ({ width: el.parentElement.clientWidth, scroll: el.parentElement.scrollWidth, height: el.parentElement.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) }))
        assert.ok(count.scroll <= count.width + 1 && count.height <= count.line + 1, `${row.name}: count is not a complete single line: ${JSON.stringify(count)}`)
      }
      const assets = await page.locator('link[rel="stylesheet"][href^="/assets/"],script[type="module"][src^="/assets/"]').evaluateAll(els => els.map(el => el.getAttribute('href') || el.getAttribute('src')))
      assert.ok(assets.length >= 2, `${row.name}: no built app assets found`)
      const servedHtml = Buffer.from(await (await page.request.get(origin)).body())
      assert.ok(servedHtml.equals(readFileSync(join(build, 'index.html'))), `${row.name}: served HTML is not this build`)
      const hashes = []
      let containsProbe = false
      let layoutJs = false, layoutCss = false
      for (const asset of assets) {
        const served = Buffer.from(await (await page.request.get(new URL(asset, origin).href)).body())
        assert.ok(served.equals(readFileSync(join(build, asset.slice(1)))), `${row.name}: served ${asset} is not this build`)
        if (asset.endsWith('.js') && served.includes(fixture.probe.secret)) containsProbe = true
        if (asset.endsWith('.js') && served.includes(fixture.probe.layoutMarker)) layoutJs = true
        if (asset.endsWith('.css') && served.includes(fixture.probe.layoutMarker)) layoutCss = true
        hashes.push({ asset, sha256: createHash('sha256').update(served).digest('hex') })
      }
      assert.ok(containsProbe, `${row.name}: served build does not contain the secret-bearing synthetic fixture`)
      assert.ok(layoutJs && layoutCss, `${row.name}: served scripts and stylesheet do not contain the current footer layout`)
      const capture = row.capture ?? row.name
      if (output) {
        await page.mouse.move(0, 0)
        await page.locator('#inuse').screenshot({ path: join(output, `${capture}-top.png`), animations: 'disabled' })
      }
      let mobileLayout = null
      if (row.phone) {
        await page.locator('#inuse-stage').evaluate(stage => {
          const preview = stage.querySelector('.iu-ks-preview').getBoundingClientRect()
          const footer = stage.querySelector('.iu-ks .swz-foot').getBoundingClientRect()
          stage.scrollTop += Math.max(0, preview.bottom - footer.top + 12)
        })
        const mobile = await page.evaluate(() => {
          const rect = selector => document.querySelector(selector).getBoundingClientRect()
          const preview = rect('.iu-ks-preview'), nav = rect('.iu-subnav'), footer = rect('.iu-ks .swz-foot')
          const tabs = rect('.iu-ks-preview .txn-foot-tabs')
          const buttons = [...document.querySelectorAll('.iu-ks .swz-foot-start button, .iu-ks .swz-foot-end button')]
          const exposed = buttons.every(button => {
            const r = button.getBoundingClientRect()
            const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
            return target === button || button.contains(target)
          })
          return { previewTop: preview.top, previewBottom: preview.bottom, navBottom: nav.bottom, footerTop: footer.top, tabsBottom: tabs.bottom, readerHeight: rect('.iu-ks-preview .txn-stream').height, exposed }
        })
        assert.ok(mobile.previewTop >= mobile.navBottom - 1 && mobile.previewTop - mobile.navBottom <= 24 && mobile.previewBottom <= mobile.footerTop + 1 && mobile.footerTop - mobile.previewBottom <= 24 && mobile.tabsBottom <= mobile.footerTop && mobile.exposed, `${row.name}: preview must fill the space between chrome with hittable footer: ${JSON.stringify(mobile)}`)
        assert.ok(mobile.readerHeight >= row.minReaderHeight, `${row.name}: the transcript reader is too short: ${JSON.stringify(mobile)}`)
        mobileLayout = mobile
        const streamScroll = await viewer.locator('.txn-stream').evaluate(el => {
          const before = el.scrollTop
          el.scrollTop = el.scrollHeight
          return { before, after: el.scrollTop, max: el.scrollHeight - el.clientHeight }
        })
        assert.ok(streamScroll.max <= 0 || streamScroll.after > streamScroll.before, `${row.name}: transcript stream must scroll before testing footer hit targets: ${JSON.stringify(streamScroll)}`)
        assert.ok(await footer.locator('.swz-foot-start button, .swz-foot-end button').evaluateAll(buttons => buttons.filter(button => !button.disabled).every(button => {
          const r = button.getBoundingClientRect(), target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return target === button || button.contains(target)
        })), `${row.name}: a sticky transcript phase must not cover footer controls`)
        await page.mouse.move(0, 0)
        if (output) await page.screenshot({ path: join(output, `${row.name}-preview.png`), animations: 'disabled' })
        await check.focus()
        await check.press('Space')
        assert.equal(await page.locator('.iu-ks-counts').innerText(), '4 sessions chosen', `${row.name}: keyboard selection updates the count`)
        assert.equal(await viewer.locator('.txn-title').innerText(), fixture.probe.title, `${row.name}: selecting does not change the preview`)
        await check.press('Space')
        assert.equal(await page.locator('.iu-ks-counts').innerText(), '3 sessions chosen', `${row.name}: keyboard can undo the selection`)
      }
      await viewer.getByRole('button', { name: /copy link to turn/i }).first().click()
      if (output) {
        await viewer.locator('.txn-stream').evaluate(el => { el.scrollTop = el.scrollHeight })
        await page.locator('#inuse').screenshot({ path: join(output, `${capture}-code.png`), animations: 'disabled' })
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
      if (row.minVisibleTrace) {
        const last = page.locator(`[data-node-id="${fixture.scrollProbe.node}"]`)
        const lastCheck = last.locator('input[type=checkbox]')
        const wasChecked = await lastCheck.isChecked()
        const count = await page.locator('.iu-ks-counts').innerText()
        const wasOutside = await last.locator('.st-title').evaluate(el => {
          const r = el.getBoundingClientRect(), pane = el.closest('.iu-ks-tree').getBoundingClientRect()
          return (r.top + r.bottom) / 2 > pane.bottom || (r.top + r.bottom) / 2 < pane.top
        })
        await last.locator('.st-title').click()
        const treeScroll = await page.locator('.iu-ks-tree').evaluate(el => ({ top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight }))
        assert.ok(!wasOutside || treeScroll.top > 0, `${row.name}: an obscured last session must scroll into view: ${JSON.stringify(treeScroll)}`)
        assert.equal(await lastCheck.isChecked(), wasChecked, `${row.name}: previewing the last session must not select it`)
        assert.equal(await page.locator('.iu-ks-counts').innerText(), count, `${row.name}: previewing must not change the selection count`)
        assert.equal(await viewer.locator('.txn-title').innerText(), fixture.scrollProbe.title, `${row.name}: the last session must open in the viewer`)
      }
      const continueBox = await next.boundingBox()
      await previous.focus()
      await previous.press('Enter')
      assert.equal(await page.locator('.iu-ks .swz-count .swz-sr-only').textContent(), 'step 1 of 10', `${row.name}: keyboard prev changes the step`)
      const answerGroup = footer.getByRole('group', { name: 'connect to peasant online?' })
      const no = answerGroup.getByRole('button', { name: 'no', exact: true })
      const yes = answerGroup.getByRole('button', { name: 'yes', exact: true })
      assert.equal(await footer.getByRole('button', { name: 'continue' }).count(), 0, `${row.name}: answer stop does not have continue`)
      assert.match(await page.locator('.iu-ks .swz-body').innerText(), /demo only: neither choice connects or signs in/)
      const [noBox, yesBox] = await Promise.all([no.boundingBox(), yes.boundingBox()])
      assert.ok(noBox.x < yesBox.x && Math.abs(yesBox.x + yesBox.width - continueBox.x - continueBox.width) <= 1, `${row.name}: no then yes, with yes at the continue edge`)
      assert.ok((await yes.getAttribute('class')).includes('btn-primary'), `${row.name}: yes is primary`)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      if (row.width >= 768) {
        const [previousBox, answerRail] = await Promise.all([previous.boundingBox(), rail.boundingBox()])
        assert.ok(answerRail.x - previousBox.x - previousBox.width >= 31 && noBox.x - answerRail.x - answerRail.width >= 31, `${row.name}: answer controls must stay separated from the timeline`)
        const answerLabels = await rail.locator('.swz-label').evaluateAll(elements => elements.map(el => {
          const r = el.getBoundingClientRect()
          return { x: r.x, right: r.right, width: r.width, height: r.height, line: parseFloat(getComputedStyle(el).lineHeight), client: el.clientWidth, scroll: el.scrollWidth }
        }).filter(label => label.width > 1 && label.height > 1))
        assert.ok(answerLabels.length === 0 || answerLabels.length === fixture.stopLabels.length, `${row.name}: answer-state labels must hide together`)
        assert.ok(answerLabels.every((label, i) => label.height <= label.line + 1 && label.scroll <= label.client + 1 && (i === 0 || label.x >= answerLabels[i - 1].right - 0.5)), `${row.name}: an answer-state label wraps, overlaps or clips`)
      }
      if (output) await page.screenshot({ path: join(output, `${row.name}-answers.png`), animations: 'disabled' })
      await answerGroup.getByRole('button', { name: row.answer ?? 'no', exact: true }).focus()
      await page.keyboard.press('Enter')
      assert.equal(await page.locator('.iu-ks .swz-count .swz-sr-only').textContent(), 'step 2 of 10', `${row.name}: a demo answer returns to selection`)
      if (row.railJump) {
        const marker = rail.getByRole('button', { name: 'step 1 of 10, peasant online' })
        await marker.focus()
        await marker.press('Enter')
        assert.equal(await page.locator('.iu-ks .swz-count .swz-sr-only').textContent(), 'step 1 of 10', `${row.name}: a completed marker supports keyboard jump`)
        await footer.getByRole('button', { name: 'no', exact: true }).press('Enter')
        assert.equal(await page.locator('.iu-ks .swz-count .swz-sr-only').textContent(), 'step 2 of 10', `${row.name}: the answer returns from the keyboard jump`)
      }
      await footer.getByRole('button', { name: 'continue' }).focus()
      await page.keyboard.press('Enter')
      assert.equal(await page.locator('.iu-ks .swz-count .swz-sr-only').textContent(), 'step 3 of 10', `${row.name}: keyboard continue advances the wizard`)
      await previous.focus()
      await previous.press('Enter')
      assert.equal(await page.locator('.iu-ks .swz-count .swz-sr-only').textContent(), 'step 2 of 10', `${row.name}: keyboard prev returns from the next step`)
      evidence.push({ name: row.name, origin, layout, rail: railGeometry, mobile: mobileLayout, hashes, clipboard: observations.clipboard, writes: observations.writes, requests: requests.length })
    } finally { await page.close() }
  }
  const resize = fixture.resize
  const resizePage = await browser.newPage({ viewport: { width: resize.wide, height: resize.height }, reducedMotion: 'reduce' })
  try {
    await resizePage.goto(`${origin}/?fb=off&app=graph&view=kickstart&theme=${resize.theme}#inuse`, { waitUntil: 'networkidle' })
    await resizePage.evaluate(() => document.fonts.ready)
    const visibleLabels = () => resizePage.locator('.iu-ks .swz-rail .swz-label').evaluateAll(labels => labels.filter(label => label.getBoundingClientRect().width > 1 && label.getBoundingClientRect().height > 1).length)
    const waitForLabels = count => resizePage.waitForFunction(n => [...document.querySelectorAll('.iu-ks .swz-rail .swz-label')].filter(label => label.getBoundingClientRect().width > 1 && label.getBoundingClientRect().height > 1).length === n, count)
    await waitForLabels(fixture.stopLabels.length)
    await resizePage.setViewportSize({ width: resize.narrow, height: resize.height })
    await waitForLabels(0)
    await resizePage.getByRole('button', { name: 'step 1 of 10, peasant online' }).focus()
    await resizePage.setViewportSize({ width: resize.phone, height: resize.height })
    await resizePage.waitForFunction(() => getComputedStyle(document.querySelector('.iu-ks .swz-rail')).display === 'none' && !document.activeElement.closest('.swz-rail'))
    await resizePage.setViewportSize({ width: resize.wide, height: resize.height })
    await waitForLabels(fixture.stopLabels.length)
    assert.equal(await visibleLabels(), fixture.stopLabels.length, `${resize.name}: labels return when the full text fits`)
    evidence.push({ name: resize.name, origin })
  } finally { await resizePage.close() }
  const short = fixture.shortViewport
  const shortPage = await browser.newPage({ viewport: { width: short.width, height: short.height }, reducedMotion: 'reduce' })
  try {
    await shortPage.goto(`${origin}/?fb=off&app=graph&view=kickstart&theme=dark#inuse`, { waitUntil: 'networkidle' })
    await shortPage.locator(`[data-node-id="${fixture.probe.node}"] .st-title`).click()
    const shortViewer = shortPage.locator('.iu-ks-preview .txn-app')
    await shortViewer.locator('[data-highlighted="true"]').waitFor({ state: 'attached' })
    const shortGeometry = await shortPage.locator('.iu-ks-preview').evaluate(el => ({
      height: el.getBoundingClientRect().height,
      reader: el.querySelector('.txn-stream').getBoundingClientRect().height,
      control: parseFloat(getComputedStyle(el).getPropertyValue('--control-h')),
    }))
    assert.ok(shortGeometry.height >= shortGeometry.control * 8 - 1 && shortGeometry.reader > 0, `${short.name}: a short viewport must not collapse the preview: ${JSON.stringify(shortGeometry)}`)
    evidence.push({ name: short.name, origin, shortGeometry })
  } finally { await shortPage.close() }
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

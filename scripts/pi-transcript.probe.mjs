import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve, extname } from 'node:path'
import YAML from 'yaml'
import puppeteer from 'puppeteer-core'
import { SurfaceGate } from './surface-gate.mjs'

// Serve only this worktree's built production app. No external backend or data.
const root = resolve('dist')
const docs = YAML.parseAllDocuments(await readFile('scripts/testdata/pi-transcript.yaml', 'utf8'), { strict: true, uniqueKeys: true })
assert.equal(docs.length, 1)
assert.deepEqual(docs[0].errors, [])
const { probe, payload } = docs[0].toJS()
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== ''
assert.ok(!dirty || process.env.ALLOW_DIRTY_CAPTURE === '1', 'Commit the verified sources before final capture; dirty captures are development evidence only.')
const output = resolve(process.env.PI_CAPTURE_DIR ?? `/tmp/opencode/pi-fairtrade-${revision.slice(0, 8)}${dirty ? '-dirty' : ''}`)
await mkdir(output, { recursive: true })
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp4': 'video/mp4' }
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'))
    assert.ok(path.startsWith(root + '/'))
    res.setHeader('content-type', mime[extname(path)] ?? 'application/octet-stream')
    res.end(await readFile(path))
  } catch { res.writeHead(404); res.end('not found') }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true })
const evidence = { revision, dirty, package: JSON.parse(await readFile('package.json', 'utf8')), origin, probes: [], assets: {} }
try {
  const index = await (await fetch(origin)).text()
  const scripts = [...index.matchAll(/src="([^"]+\.js)"/g)].map(match => match[1])
  assert.ok(scripts.length)
  for (const asset of scripts) {
    const served = Buffer.from(await (await fetch(origin + asset)).arrayBuffer())
    assert.deepEqual(served, await readFile(resolve(root, '.' + asset)))
    evidence.assets[asset] = createHash('sha256').update(served).digest('hex')
  }
  assert.ok((await Promise.all(scripts.map(async path => (await fetch(origin + path)).text()))).some(text => text.includes(probe.toolName) && text.includes('recorded harness estimate')), 'served app must include the new production fixture and usage renderer')
  for (const theme of probe.themes) {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewport(probe.viewport)
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.goto(`${origin}/?app=transcript&transcript=pi#inuse`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.txn-turnwrap[data-turn="2"] .txn-toolcall')
    await page.evaluate(theme => {
      document.documentElement.dataset.theme = theme
      document.querySelectorAll('[data-theme]').forEach(element => { element.dataset.theme = theme })
    }, theme)
    await page.evaluate(() => document.fonts.ready)
    const viewer = await page.$('.txn-app')
    assert.ok(viewer)
    const gate = new SurfaceGate(page)
    const shot = async name => {
      await page.evaluate(() => document.getElementById('inuse-stage').scrollIntoView({ block: 'center' }))
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const path = `${output}/${theme}-${name}.png`
      await viewer.screenshot({ path, captureBeyondViewport: false })
      await gate.assert(name, path, { sel: '.txn-app', where: 'pi-transcript.probe.mjs' })
    }
    await shot('overview')
    const turn = await page.$('[data-turn="2"]')
    const heads = await turn.$$('.txn-tc-head')
    for (const head of heads) if (await head.evaluate(node => node.getAttribute('aria-expanded') === 'false')) await head.click()
    const thinking = await turn.$('.txn-thinking-toggle')
    if (thinking) await thinking.click()
    // Activate the real native disclosure controls, never inject substitute DOM.
    for (const summary of await turn.$$('.txn-native-details > summary')) await summary.click()
    await turn.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await shot('tools')
    await (await turn.$('.txn-native-details')).evaluate(element => element.scrollIntoView({ block: 'center' }))
    await shot('results')
    for (const summary of await turn.$$('.txn-usage > summary')) await summary.click()
    await (await turn.$('.txn-usage summary')).focus()
    await page.keyboard.press('Tab')
    await page.keyboard.down('Shift')
    await page.keyboard.press('Tab')
    await page.keyboard.up('Shift')
    const observed = await page.evaluate(({ probe, payload }) => {
      const turn = document.querySelector('[data-turn="2"]')
      const text = turn.innerText
      const mark = turn.querySelector('[data-brand="pi"]')
      const role = turn.querySelector('.txn-rolelabel')
      const code = turn.querySelector('.txn-generic .txn-code')
      const data = turn.querySelector('.txn-usage dd')
      const summary = turn.querySelector('.txn-usage summary')
      summary.focus()
      const summaryStyle = getComputedStyle(summary)
      const style = getComputedStyle(role)
      const rootStyle = getComputedStyle(document.documentElement)
      const swatch = document.createElement('span')
      swatch.style.color = rootStyle.getPropertyValue('--mauve')
      document.body.append(swatch)
      const mauve = getComputedStyle(swatch).color
      swatch.remove()
      return {
        text, contentCount: [...document.querySelectorAll('.txn-turnwrap')].length,
        context: document.querySelector('[data-turn="1"] .txn-md')?.textContent ?? document.querySelector('[data-turn="1"]').innerText,
        metadataHidden: !document.body.innerText.includes(probe.hidden),
        thinkingCount: text.split(probe.thinking).length - 1,
        usage: [...turn.querySelectorAll('.txn-usage summary')].map(node => node.textContent),
        pending: text.includes('no result recorded'),
        viewBox: mark.getAttribute('viewBox'), path: mark.querySelector('path').getAttribute('d'), fillRule: mark.querySelector('path').getAttribute('fill-rule'),
        accent: style.color, mauve,
        bodyFont: getComputedStyle(code).fontFamily, bodySize: getComputedStyle(code).fontSize,
        tabular: getComputedStyle(data).fontVariantNumeric,
        focus: summaryStyle.outlineStyle, target: summary.getBoundingClientRect().height,
        radius: summaryStyle.borderRadius, motion: summaryStyle.transitionDuration,
        toolCase: getComputedStyle(turn.querySelector('.txn-tc-head .kind')).textTransform,
        expectedTurns: payload.turns.length,
      }
    }, { probe, payload })
    assert.equal(observed.contentCount, observed.expectedTurns)
    assert.ok(observed.context.includes(payload.turns[1].content))
    assert.equal(observed.thinkingCount, 1)
    assert.ok(observed.metadataHidden)
    assert.ok(observed.pending)
    for (const key of ['args', 'result', 'details', 'cost']) assert.ok(observed.text.includes(probe[key]), key)
    assert.deepEqual({ viewBox: observed.viewBox, path: observed.path }, probe.mark)
    assert.equal(observed.fillRule, 'evenodd')
    assert.equal(observed.accent, observed.mauve)
    assert.ok(observed.bodyFont.includes('Atkinson Hyperlegible Mono'))
    assert.ok(parseFloat(observed.bodySize) >= 16)
    assert.ok(observed.tabular.includes('tabular-nums'))
    assert.notEqual(observed.focus, 'none')
    assert.ok(observed.target >= 24)
    assert.equal(observed.radius, '0px')
    assert.equal(observed.toolCase, 'none')
    assert.ok(parseFloat(observed.motion) <= probe.maxReducedMotionSeconds)
    await shot('usage')
    await (await turn.$('.txn-usage-note')).evaluate(element => element.scrollIntoView({ block: 'center' }))
    await shot('cost')
    const scopeSummary = await page.$('.txn-usage-scopes > summary')
    await scopeSummary.click()
    assert.ok(await page.$eval('.txn-usage-scopes', element => element.textContent.includes('0 (partial)') && element.textContent.includes('unknown (unknown)')))
    await shot('scopes')
    await scopeSummary.click()
    await page.keyboard.down('Control')
    await page.keyboard.press('f')
    await page.keyboard.up('Control')
    const search = await page.waitForSelector('.txn-search-input')
    await search.type(probe.hidden)
    await page.waitForFunction(() => document.querySelector('.txn-search-count').textContent === '0 matches')
    await search.focus()
    await page.keyboard.down('Control')
    await page.keyboard.press('a')
    await page.keyboard.up('Control')
    await search.type(payload.turns[1].content)
    await page.waitForFunction(() => document.querySelector('.txn-search-count').textContent === '1/1')
    observed.contextSearch = '1/1'
    observed.metadataSearch = '0 matches'
    assert.deepEqual(errors, [])
    evidence.probes.push({ theme, ...observed })
    await page.close()
  }
  await writeFile(`${output}/provenance.json`, JSON.stringify(evidence, null, 2) + '\n')
  console.log(output)
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }

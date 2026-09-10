import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve, extname } from 'node:path'
import YAML from 'yaml'
import puppeteer from 'puppeteer-core'
import { buildContextFixture } from '../src/mockups/inuse/context-fixture.js'

// Serve and assert only this checkout's built production demo and mounted viewer.
// The same YAML drives the pure adapter assertions, this demo, and these controls.
const root = resolve('dist')
const fixture = YAML.parse(await readFile('scripts/testdata/transcript_provenance_retention.yaml', 'utf8'), { strict: true, uniqueKeys: true })
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== ''
assert.ok(!dirty || process.env.ALLOW_DIRTY_CAPTURE === '1', 'Commit the verified sources before final capture; dirty captures are development evidence only.')
const output = resolve(process.env.CONTEXT_CAPTURE_DIR ?? `/tmp/opencode/context-fairtrade-${revision.slice(0, 8)}${dirty ? '-dirty' : ''}`)
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
const evidence = { revision, dirty, origin, package: JSON.parse(await readFile('package.json', 'utf8')), assets: {}, checks: [] }
let browser
try {
  const index = await (await fetch(origin)).text()
  const assets = [...index.matchAll(/src="([^"]+\.js)"/g)].map(match => match[1])
  assert.ok(assets.length, 'Build the production app before running the context probe.')
  const bodies = []
  for (const asset of assets) {
    const bytes = Buffer.from(await (await fetch(origin + asset)).arrayBuffer())
    assert.deepEqual(bytes, await readFile(resolve(root, '.' + asset)))
    evidence.assets[asset] = createHash('sha256').update(bytes).digest('hex')
    bodies.push(bytes.toString())
  }
  assert.ok(bodies.some(text => text.includes('txn-context-source') && text.includes('context-retention-demo')), 'The served build does not contain this branch’s context renderer and fixture. Rebuild this checkout, then retry.')
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true })
  for (const theme of fixture.themes) {
    const page = await browser.newPage()
    const errors = []
    const requests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => requests.push(request.url()))
    await page.setViewport(fixture.viewport)
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    async function controlKey(key) {
      await page.keyboard.down('Control')
      await page.keyboard.press(key)
      await page.keyboard.up('Control')
    }
    async function open(query = {}) {
      const params = new URLSearchParams({ app: 'transcript', transcript: 'context', ...query })
      await page.goto(`${origin}/?${params}#inuse`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('.txn-app .txn-stream')
      await page.evaluate(theme => {
        document.documentElement.dataset.theme = theme
        document.querySelectorAll('[data-theme]').forEach(node => { node.dataset.theme = theme })
      }, theme)
      await page.evaluate(() => document.fonts.ready)
    }
    for (const testCase of fixture.cases.filter(item => !item.invalid)) {
      for (const partition of fixture.partitions) {
        await open({ contextCase: testCase.name, contextPartition: partition })
        const input = buildContextFixture(fixture, testCase.name, partition)
        const mainIndices = partition === 'earlier' ? [] : testCase.expectedIndices
        assert.deepEqual(await page.$$eval('.txn-turnwrap[data-partition="main"]', nodes => nodes.map(node => Number(node.dataset.turn))), mainIndices)
        assert.equal(await page.$$eval('.txn-turnwrap[data-partition="earlier-0"]', nodes => nodes.length), 0, 'earlier defaults collapsed')
        if (partition !== 'main') {
          const disclosure = await page.$('.txn-earlier-toggle')
          const beforeRequests = requests.length
          await disclosure.focus()
          await page.keyboard.press('Enter')
          await page.waitForSelector('.txn-earlier-toggle[aria-expanded="true"]')
          assert.equal(requests.length, beforeRequests, 'earlier disclosure must not fetch a source session')
          assert.deepEqual(await page.$$eval('.txn-turnwrap[data-partition="earlier-0"]', nodes => nodes.map(node => Number(node.id.split('-').at(-1)))), testCase.expectedIndices)
          assert.equal(await page.$$eval('.txn-earlier [data-turn], .txn-earlier [data-turn-control]', nodes => nodes.length), 0, 'earlier must not alias main navigation')
        }
        for (const button of await page.$$('.txn-thinking-toggle[aria-expanded="false"], .txn-tc-head[aria-expanded="false"]')) await button.click()
        for (const summary of await page.$$('.txn-native-details > summary')) await summary.click()
        const domains = partition === 'main' ? [{ id: 'main', turns: input.turns }] : partition === 'earlier'
          ? [{ id: 'earlier-0', turns: input.earlierHistory[0].turns }]
          : [{ id: 'main', turns: input.turns }, { id: 'earlier-0', turns: input.earlierHistory[0].turns }]
        for (const domain of domains) {
          for (const index of testCase.expectedIndices) {
            const source = domain.turns.find(turn => turn.index === index)
            const selector = domain.id === 'main' ? `[data-turn="${index}"]` : `#${domain.id}-turn-${index}`
            const card = await page.$(selector)
            assert.ok(card)
            if (source.sourceEntryRef) assert.equal(await card.evaluate(node => node.dataset.sourceEntryRef), source.sourceEntryRef)
            if (source.entryType === 'thinking') assert.equal(await card.$eval('.txn-thinking-body', node => node.textContent), source.content)
            else if (!testCase.legacy && source.content) assert.ok((await card.evaluate(node => node.textContent)).includes(source.content), `${testCase.name}: literal content missing`)
            for (const tool of source.toolCalls ?? []) if (tool.result) {
              const outputs = await card.$$eval('.txn-code', nodes => nodes.map(node => node.textContent))
              assert.ok(outputs.includes(tool.result), `${testCase.name}: exact result missing`)
            }
          }
        }
        if (testCase.name === 'pi-native-attachments') assert.ok((await page.$eval('.txn-stream', node => node.textContent)).includes('NativeAttachmentRetained'))
        assert.ok((await page.$eval('.txn-header', node => node.textContent)).includes(`${input.inputSubmissionCount ?? 'unknown'} input submissions`))
        if (partition === 'both' && fixture.captures.includes(testCase.name)) {
          await page.evaluate(() => document.getElementById('inuse-stage').scrollIntoView({ block: 'center' }))
          const viewer = await page.$('.txn-app')
          for (const domain of domains) {
            const anchor = domain.turns.find(turn => turn.index === fixture.longResult.turnIndex && turn.toolCalls?.some(tool => tool.id.endsWith(fixture.longResult.toolId))) ?? domain.turns[0]
            const selector = domain.id === 'main' ? `[data-turn="${anchor.index}"]` : `#${domain.id}-turn-${anchor.index}`
            await (await page.$(selector)).evaluate(node => node.scrollIntoView({ block: 'start' }))
            const path = `${output}/${theme}-${testCase.name}-${domain.id}.png`
            await viewer.screenshot({ path, captureBeyondViewport: false })
            evidence.checks.push({ theme, name: testCase.name, partition: domain.id, path })
          }
        }
      }
    }
    for (const testCase of fixture.navigationCases) {
      await open({ contextNavigation: testCase.name })
      assert.equal(await page.$$eval('.txn-context-link', nodes => nodes.length), testCase.expectedTargets.length)
      const labels = await page.$$eval('.txn-context-row > span:first-of-type', nodes => nodes.map(node => node.textContent))
      assert.deepEqual(labels, testCase.expectedLabels)
      for (let i = 0; i < testCase.expectedTargets.length; i++) {
        await controlKey('f')
        await page.waitForSelector('.txn-search-input')
        await (await page.$('.txn-search-input')).type(fixture.navigationSearch)
        await page.keyboard.press('Escape')
        await (await page.$('.txn-earlier-toggle')).click()
        const beforeIndices = await page.$$eval('[data-partition="main"]', nodes => nodes.map(node => node.dataset.turn))
        const link = (await page.$$('.txn-context-link'))[i]
        await link.focus()
        const before = await page.$eval('.txn-stream', node => node.scrollTop)
        await page.keyboard.press('Enter')
        await page.waitForFunction(target => new URLSearchParams(location.search).get('contextTarget') === target, {}, testCase.expectedTargets[i])
        if (i === 0 && testCase.exact) assert.equal(new URL(page.url()).hash, '#turn-0')
        assert.ok((await page.$eval('.txn-app', node => node.textContent)).includes(fixture.sources[testCase.expectedTargets[i]].content))
        await page.goBack()
        await page.waitForSelector('.txn-earlier-toggle[aria-expanded="true"]')
        assert.equal(await page.$eval('.txn-stream', node => node.scrollTop), before)
        assert.deepEqual(await page.$$eval('[data-partition="main"]', nodes => nodes.map(node => node.dataset.turn)), beforeIndices)
        await controlKey('f')
        await page.waitForSelector('.txn-search-input')
        assert.equal(await page.$eval('.txn-search-input', node => node.value), fixture.navigationSearch)
        await (await page.$('.txn-search-input')).focus()
        await controlKey('a')
        await page.keyboard.press('Backspace')
        await page.keyboard.press('Escape')
        // Restore the pre-click state for the second independent source control.
        await (await page.$('.txn-earlier-toggle')).click()
      }
    }
    for (const testCase of fixture.countCases) {
      await open({ contextCount: testCase.name })
      assert.ok((await page.$eval('.txn-header', node => node.textContent)).includes(`${testCase.expected} input submissions`))
    }
    await open()
    const styles = await page.evaluate(() => {
      const link = document.querySelector('.txn-context-link')
      const note = document.querySelector('.txn-context-note')
      const chrome = getComputedStyle(link)
      const body = getComputedStyle(note)
      return { bodyFamily: body.fontFamily, bodySize: body.fontSize, chromeFamily: chrome.fontFamily,
        chromeSize: chrome.fontSize, radius: chrome.borderRadius, height: link.getBoundingClientRect().height,
        numberVariant: getComputedStyle(document.querySelector('.txn-header .tnum')).fontVariantNumeric,
        transition: chrome.transitionDuration, fontLinks: [...document.querySelectorAll('head link')].some(node => node.href.includes('Atkinson')) }
    })
    assert.ok(styles.bodyFamily.includes('Atkinson Hyperlegible') && !styles.bodyFamily.includes('Mono'))
    assert.ok(styles.chromeFamily.includes('Atkinson Hyperlegible Mono'))
    assert.ok(parseFloat(styles.bodySize) >= 16)
    assert.equal(styles.chromeSize, '14px')
    assert.equal(styles.radius, '0px')
    assert.ok(styles.height >= 24)
    assert.ok(styles.numberVariant.includes('tabular-nums'))
    assert.ok(styles.fontLinks)
    // The reduced-motion guard in src/index.css forces transition-duration to
    // .01ms; current Chrome serializes that computed value as "1e-05s", so an
    // exact-zero comparison rejects the guard itself. Anything at or below a
    // 100-microsecond ceiling is still static-first; real motion stays a failure.
    assert.ok(parseFloat(styles.transition) <= 0.0001, `expected static-first transition, got ${styles.transition}`)
    assert.deepEqual(errors, [])
    evidence.checks.push({ theme, styles, navigation: fixture.navigationCases.map(item => item.name), counts: fixture.countCases.map(item => item.name) })
    await page.close()
  }
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2))
  console.log(`mounted provenance controls and captures passed: ${output}`)
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}

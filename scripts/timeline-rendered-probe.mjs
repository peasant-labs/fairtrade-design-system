#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { preview } from 'vite'
import YAML from 'yaml'
import { SurfaceGate } from './surface-gate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CHROME = process.env.CHROME_PATH
const SHOT_DIR = process.env.TIMELINE_PROBE_SHOT_DIR
const CASE_FILTER = process.env.TIMELINE_PROBE_CASE
const fixture = loadFixture(resolve(HERE, 'testdata/timeline-rendered-probe.yaml'))
const cases = CASE_FILTER ? fixture.cases.filter((testCase) => testCase.name.includes(CASE_FILTER)) : fixture.cases
const VIEWPORTS = Object.freeze({
  desktop: Object.freeze({ width: 1460, height: 1000, deviceScaleFactor: 1 }),
  mobile: Object.freeze({ width: 390, height: 844, deviceScaleFactor: 1 }),
})

if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true })
if (cases.length === 0) throw new Error(`timeline rendered probe case filter ${JSON.stringify(CASE_FILTER)} matched no fixture case`)

if (!CHROME || !existsSync(CHROME)) {
  throw new Error('timeline rendered probe failed: what went wrong: CHROME_PATH does not name an existing browser; why: the probe requires a real Linux Chrome or Chromium process; where: scripts/timeline-rendered-probe.mjs startup; when: browser preflight; what it means: mounted theme and motion styles were not verified; how to fix: set CHROME_PATH to the Chrome or Chromium executable and rerun pnpm test:timeline-rendered.')
}

const assetDir = resolve(ROOT, 'dist/assets')
if (!existsSync(assetDir)) {
  throw new Error('timeline rendered probe failed: what went wrong: dist/assets is absent; why: the production app has not been built; where: dist/assets; when: build provenance preflight; what it means: the probe has no production artifact to inspect; how to fix: run pnpm build before pnpm test:timeline-rendered.')
}
const builtJavaScript = readdirSync(assetDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(resolve(assetDir, name), 'utf8'))
  .join('\n')
if (!builtJavaScript.includes(fixture.buildMarker)) {
  throw new Error(`timeline rendered probe failed: what went wrong: the production bundle lacks ${JSON.stringify(fixture.buildMarker)}; why: dist was built from stale or unrelated source; where: dist/assets; when: build provenance preflight; what it means: browser results would not verify the current timeline implementation; how to fix: rebuild this worktree with pnpm build and rerun the probe.`)
}

const server = await preview({
  root: ROOT,
  configFile: false,
  logLevel: 'silent',
  preview: { host: '127.0.0.1', port: 0, strictPort: true },
})
const address = server.httpServer.address()
if (!address || typeof address === 'string') throw new Error('timeline rendered probe could not resolve the preview server address')
const origin = `http://127.0.0.1:${address.port}`

let browser
try {
  for (const testCase of cases) {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      defaultViewport: VIEWPORTS[testCase.viewport],
    })
    const page = await browser.newPage()
    const errors = []
    page.on('console', (message) => { if (message.type() === 'error' && !/favicon/.test(message.text())) errors.push(message.text()) })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: testCase.motion }])
    const query = new URLSearchParams({ fb: 'off', app: 'graph' })
    if (testCase.theme === 'light') query.set('theme', 'light')
    await page.goto(`${origin}/?${query}`, { waitUntil: 'networkidle0' })
    await page.evaluate(() => document.getElementById('inuse-stage')?.scrollIntoView({ block: 'start' }))
    await page.waitForSelector('#inuse-stage .iu-subnav')
    const openedMap = await page.evaluate(() => {
      const button = [...document.querySelectorAll('#inuse-stage .iu-subnav-item')].find((candidate) => candidate.textContent.trim() === 'code map')
      button?.click()
      return Boolean(button)
    })
    assert.equal(openedMap, true, `${testCase.name}: code map navigation`)
    await page.waitForSelector('.tlp-session-lane')
    const selectedSession = await page.evaluate(() => {
      const lane = [...document.querySelectorAll('.tlp-session-lane')].find((candidate) => candidate.textContent.includes('Add DOI ranking to the code map'))
      lane?.click()
      return Boolean(lane)
    })
    assert.equal(selectedSession, true, `${testCase.name}: session lane selection`)
    await page.waitForSelector('.tlp-highlight-edge-primary')

    const result = await page.evaluate(() => {
      const root = document.documentElement
      const timeline = document.querySelector('[aria-label="peasant timeline demo"]')
      const edges = [...document.querySelectorAll('.tlp-highlight-edge-primary')]
      const dot = document.querySelector('.cg-dot-highlight-primary')
      const edgeStyle = edges[0] ? getComputedStyle(edges[0]) : null
      const dotStyle = dot ? getComputedStyle(dot) : null
      const box = timeline?.getBoundingClientRect()
      const selectedLaneBox = timeline?.querySelector('.tlp-session-lane-sel')?.getBoundingClientRect()
      const edgeSource = edges[0] && edges[0].getScreenCTM()
        ? new DOMPoint(Number(edges[0].getAttribute('x1')), Number(edges[0].getAttribute('y1'))).matrixTransform(edges[0].getScreenCTM())
        : null
      return {
        themeAttribute: root.getAttribute('data-theme'),
        timelineWidth: box?.width ?? 0,
        timelineHeight: box?.height ?? 0,
        edgeHashes: edges.map((edge) => edge.getAttribute('data-commit-hash')).sort(),
        edgeSessions: edges.map((edge) => edge.getAttribute('data-session-id')),
        edgeStroke: edgeStyle?.stroke ?? '',
        edgeStrokeWidth: edgeStyle?.strokeWidth ?? '',
        emphasisWidth: getComputedStyle(root).getPropertyValue('--stroke-emphasis').trim(),
        animationName: edgeStyle?.animationName ?? '',
        animationIterationCount: edgeStyle?.animationIterationCount ?? '',
        dotBoxShadow: dotStyle?.boxShadow ?? '',
        sourceDistance: edgeSource && selectedLaneBox
          ? Math.hypot(edgeSource.x - (selectedLaneBox.left + selectedLaneBox.width / 2), edgeSource.y - selectedLaneBox.bottom)
          : Number.POSITIVE_INFINITY,
        targetGeometry: edges.map((edge) => {
          const matrix = edge.getScreenCTM()
          const row = timeline?.querySelector(`.cg-history-row[data-commit-hash="${CSS.escape(edge.getAttribute('data-commit-hash'))}"]`)
          const dotBox = row?.querySelector('.cg-dot')?.getBoundingClientRect()
          if (!matrix || !dotBox) return { distance: Number.POSITIVE_INFINITY }
          const target = new DOMPoint(Number(edge.getAttribute('x2')), Number(edge.getAttribute('y2'))).matrixTransform(matrix)
          return {
            distance: Math.hypot(target.x - (dotBox.left + dotBox.width / 2), target.y - (dotBox.top + dotBox.height / 2)),
            target: { x: target.x, y: target.y },
            dot: { x: dotBox.left + dotBox.width / 2, y: dotBox.top + dotBox.height / 2 },
            attributes: { x2: edge.getAttribute('x2'), y2: edge.getAttribute('y2') },
            matrix: { a: matrix.a, d: matrix.d, e: matrix.e, f: matrix.f },
          }
        }),
        providerLabels: [...(timeline?.querySelectorAll('.cg-session .pv-name-label') ?? [])].map((label) => ({
          height: label.getBoundingClientRect().height,
          whiteSpace: getComputedStyle(label).whiteSpace,
        })),
      }
    })

    assert.equal(result.themeAttribute, testCase.expectedThemeAttribute, `${testCase.name}: theme attribute`)
    assert.ok(result.timelineWidth > 100 && result.timelineHeight > 100, `${testCase.name}: mounted timeline must have visible geometry`)
    assert.deepEqual(result.edgeHashes, fixture.expectedCommitHashes, `${testCase.name}: selected-session commit edges`)
    assert.ok(result.edgeSessions.every((sessionId) => sessionId === fixture.expectedSessionId), `${testCase.name}: selected-session edge identity`)
    assert.ok(result.edgeStroke && result.edgeStroke !== 'none', `${testCase.name}: semantic edge stroke`)
    assert.equal(result.edgeStrokeWidth, result.emphasisWidth, `${testCase.name}: motion-independent width step`)
    assert.ok(result.dotBoxShadow && result.dotBoxShadow !== 'none', `${testCase.name}: motion-independent dot width step`)
    assert.equal(result.animationName, testCase.expectedAnimationName, `${testCase.name}: motion animation policy`)
    assert.ok(result.sourceDistance <= 16, `${testCase.name}: selected-session edge source is ${result.sourceDistance.toFixed(2)}px from the lane anchor`)
    assert.ok(result.targetGeometry.every(({ distance }) => distance <= 16), `${testCase.name}: commit edge target geometry is ${JSON.stringify(result.targetGeometry)}`)
    assert.ok(result.providerLabels.length > 0 && result.providerLabels.every(({ height, whiteSpace }) => height <= 24 && whiteSpace === 'nowrap'), `${testCase.name}: provider labels must remain one line; received ${JSON.stringify(result.providerLabels)}`)
    if (testCase.motion === 'no-preference') {
      assert.equal(result.animationIterationCount, fixture.expectedAnimationIterationCount, `${testCase.name}: one-shot animation`)
    }
    assert.deepEqual(errors, [], `${testCase.name}: browser console and page errors`)
    if (SHOT_DIR) {
      const timeline = await page.$('[aria-label="peasant timeline demo"]')
      if (!timeline) throw new Error(`${testCase.name}: timeline disappeared before screenshot capture`)
      await timeline.evaluate((element) => element.scrollIntoView({ block: 'start' }))
      await new Promise((resolvePaint) => setTimeout(resolvePaint, 100))
      const visible = await timeline.evaluate((element) => {
        const box = element.getBoundingClientRect()
        return box.width > 100 && box.height > 100 && box.top < window.innerHeight && box.bottom > 0
      })
      if (!visible) throw new Error(`${testCase.name}: timeline is outside the visible viewport before screenshot capture`)
      const shotPath = resolve(SHOT_DIR, `${testCase.viewport}-${testCase.theme}-${testCase.motion}.png`)
      await page.screenshot({ path: shotPath, captureBeyondViewport: false })
      await new SurfaceGate(page).assert(testCase.name, shotPath, { sel: '[aria-label="peasant timeline demo"]', where: 'timeline-rendered-probe.mjs' })
    }

    const openedChanges = await page.evaluate(() => {
      const button = [...document.querySelectorAll('#inuse-stage .iu-subnav-item')].find((candidate) => candidate.textContent.trim() === 'changes')
      button?.click()
      return Boolean(button)
    })
    assert.equal(openedChanges, true, `${testCase.name}: changes navigation`)
    await page.waitForSelector(`.cg-history-row[data-commit-hash="${fixture.changesOverflow.commitHash}"] .tlp-overflow-toggle`)

    const initialOverflow = await page.evaluate(({ commitHash, toggleLabel, thirdSessionTitle }) => {
      const row = document.querySelector(`.cg-history-row[data-commit-hash="${CSS.escape(commitHash)}"]`)
      const toggle = row?.querySelector('.tlp-overflow-toggle')
      return {
        found: Boolean(row && toggle),
        expanded: toggle?.getAttribute('aria-expanded'),
        label: toggle?.getAttribute('aria-label'),
        thirdSessionVisible: [...(row?.querySelectorAll('.tlp-overflow-item') ?? [])].some((item) => item.textContent.includes(thirdSessionTitle)),
      }
    }, fixture.changesOverflow)
    assert.equal(initialOverflow.found, true, `${testCase.name}: overflow control mounts in the Changes view`)
    assert.equal(initialOverflow.expanded, 'false', `${testCase.name}: overflow starts collapsed`)
    assert.equal(initialOverflow.label, fixture.changesOverflow.toggleLabel, `${testCase.name}: overflow reports its hidden session count`)
    assert.equal(initialOverflow.thirdSessionVisible, false, `${testCase.name}: third session starts hidden`)

    const expandedOverflow = await page.evaluate(async ({ commitHash, thirdSessionTitle }) => {
      const row = document.querySelector(`.cg-history-row[data-commit-hash="${CSS.escape(commitHash)}"]`)
      row?.querySelector('.tlp-overflow-toggle')?.click()
      await new Promise((resolvePaint) => requestAnimationFrame(() => requestAnimationFrame(resolvePaint)))
      const updatedRow = document.querySelector(`.cg-history-row[data-commit-hash="${CSS.escape(commitHash)}"]`)
      return {
        expanded: updatedRow?.querySelector('.tlp-overflow-toggle')?.getAttribute('aria-expanded'),
        thirdSessionVisible: [...(updatedRow?.querySelectorAll('.tlp-overflow-item') ?? [])].some((item) => item.textContent.includes(thirdSessionTitle)),
      }
    }, fixture.changesOverflow)
    assert.equal(expandedOverflow.expanded, 'true', `${testCase.name}: overflow expands`)
    assert.equal(expandedOverflow.thirdSessionVisible, true, `${testCase.name}: third session becomes visible`)

    const sessionDestination = await page.evaluate(async ({ commitHash, sessionId, sourceText }) => {
      const row = document.querySelector(`.cg-history-row[data-commit-hash="${CSS.escape(commitHash)}"]`)
      const thirdSession = row?.querySelector(`.tlp-overflow-item[data-session-id="${CSS.escape(sessionId)}"]`)
      thirdSession?.click()
      await new Promise((resolvePaint) => requestAnimationFrame(() => requestAnimationFrame(resolvePaint)))
      return {
        thirdSessionFound: Boolean(thirdSession),
        changesStillMounted: Boolean(document.querySelector('[aria-label="default-branch commit history"]')),
        destinationSessionId: document.querySelector('.gmp-session-destination')?.getAttribute('data-session-id'),
        destinationTitle: document.querySelector('#gmp-session-destination-title')?.textContent,
        destinationSource: document.querySelector('.gmp-session-destination [data-session-source]')?.textContent,
        providerName: document.querySelector('[data-session-provider] .pv-name-label')?.textContent,
        providerBrandMark: Boolean(document.querySelector('[data-session-provider] svg.brand')),
        unknownProvider: Boolean(document.querySelector('[data-session-provider-unknown]')),
      }
    }, fixture.changesOverflow)
    assert.equal(sessionDestination.thirdSessionFound, true, `${testCase.name}: third session can be selected`)
    assert.equal(sessionDestination.changesStillMounted, true, `${testCase.name}: session selection preserves the canonical Changes composition`)
    assert.equal(sessionDestination.destinationSessionId, fixture.changesOverflow.sessionId, `${testCase.name}: session destination preserves the selected session identity`)
    assert.equal(sessionDestination.destinationTitle, fixture.changesOverflow.thirdSessionTitle, `${testCase.name}: session destination renders the selected session title`)
    assert.equal(sessionDestination.destinationSource, fixture.changesOverflow.sourceText, `${testCase.name}: session destination preserves commit provenance`)
    assert.equal(sessionDestination.providerName, fixture.changesOverflow.providerHarness, `${testCase.name}: session destination renders the canonical provider name`)
    assert.equal(sessionDestination.providerBrandMark, true, `${testCase.name}: session destination renders the canonical provider brand mark`)
    assert.equal(sessionDestination.unknownProvider, false, `${testCase.name}: resolved provider does not use the unknown fallback`)
    if (SHOT_DIR) {
      const destination = await page.$('.gmp-session-destination')
      if (!destination) throw new Error(`${testCase.name}: session destination disappeared before screenshot capture`)
      await destination.evaluate((element) => element.scrollIntoView({ block: 'start' }))
      const destinationShotPath = resolve(SHOT_DIR, `${testCase.viewport}-${testCase.theme}-${testCase.motion}-session-destination.png`)
      await page.screenshot({ path: destinationShotPath, captureBeyondViewport: false })
      await new SurfaceGate(page).assert(testCase.name, destinationShotPath, { sel: '.gmp-session-destination', where: 'timeline-rendered-probe.mjs' })
    }

    const returnedChanges = await page.evaluate(async ({ commitHash, sessionId }) => {
      const back = document.querySelector('.iu-subnav-back')
      back?.click()
      await new Promise((resolvePaint) => requestAnimationFrame(() => requestAnimationFrame(resolvePaint)))
      const history = document.querySelector('[aria-label="default-branch commit history"]')
      const row = document.querySelector(`.cg-history-row[data-commit-hash="${CSS.escape(commitHash)}"]`)
      const toggle = row?.querySelector('.tlp-overflow-toggle')
      const thirdSession = row?.querySelector(`.tlp-overflow-item[data-session-id="${CSS.escape(sessionId)}"]`)
      return {
        backFound: Boolean(back),
        destinationStillMounted: Boolean(document.querySelector('.gmp-session-destination')),
        historyHashes: [...(history?.querySelectorAll('.cg-history-row[data-commit-hash]') ?? [])].map((item) => item.getAttribute('data-commit-hash')),
        historyMounted: Boolean(history),
        overflowLabel: toggle?.getAttribute('aria-label'),
        overflowExpanded: toggle?.getAttribute('aria-expanded'),
        thirdSessionId: thirdSession?.getAttribute('data-session-id'),
        thirdSessionVisible: Boolean(thirdSession),
      }
    }, fixture.changesOverflow)
    assert.equal(returnedChanges.backFound, true, `${testCase.name}: session destination provides a Changes back control`)
    assert.equal(returnedChanges.destinationStillMounted, false, `${testCase.name}: back unmounts the session destination`)
    assert.equal(returnedChanges.historyMounted, true, `${testCase.name}: back remounts the Changes history`)
    assert.deepEqual(returnedChanges.historyHashes, fixture.changesOverflow.expectedHistoryHashes, `${testCase.name}: back restores the exact Changes history`)
    assert.equal(returnedChanges.overflowLabel, fixture.changesOverflow.toggleLabel, `${testCase.name}: back restores the overflow control`)
    assert.equal(returnedChanges.overflowExpanded, String(fixture.changesOverflow.returnedExpanded), `${testCase.name}: back restores the overflow's initial expansion state`)
    assert.equal(returnedChanges.thirdSessionId, fixture.changesOverflow.sessionId, `${testCase.name}: back restores the same third session identity`)
    assert.equal(returnedChanges.thirdSessionVisible, true, `${testCase.name}: back restores the expanded third session`)

    await page.close()
    await browser.close()
    browser = undefined
  }
} finally {
  await browser?.close()
  await new Promise((resolveClose, rejectClose) => server.httpServer.close((error) => error ? rejectClose(error) : resolveClose()))
}

console.log(`timeline rendered probe: ${cases.length} production-build theme and motion cases passed in Chrome${CASE_FILTER ? ' (filtered)' : ''}`)

function loadFixture(path) {
  const documents = YAML.parseAllDocuments(readFileSync(path, 'utf8'), { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (documents.length !== 1 || errors.length) throw new Error(`timeline rendered probe fixture is invalid: ${errors.map((error) => error.message).join('; ')}`)
  const value = documents[0].toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('timeline rendered probe fixture root must be an object')
  if (!Array.isArray(value.cases) || value.cases.length !== value.expectedCaseCount) throw new Error('timeline rendered probe fixture case count is invalid')
  const names = value.cases.map((testCase) => testCase.name)
  if (!Array.isArray(value.requiredNames) || value.requiredNames.length !== value.expectedCaseCount || new Set(names).size !== names.length || names.some((name) => !value.requiredNames.includes(name)) || value.requiredNames.some((name) => !names.includes(name))) throw new Error('timeline rendered probe fixture names do not match their independent inventory')
  if (value.cases.some((testCase) => !['desktop', 'mobile'].includes(testCase.viewport) || !['dark', 'light'].includes(testCase.theme) || !['no-preference', 'reduce'].includes(testCase.motion) || !['tlp-glow', 'none'].includes(testCase.expectedAnimationName))) throw new Error('timeline rendered probe fixture contains an unsupported viewport, theme, motion mode, or animation')
  if (!Array.isArray(value.expectedCommitHashes) || value.expectedCommitHashes.length === 0 || new Set(value.expectedCommitHashes).size !== value.expectedCommitHashes.length) throw new Error('timeline rendered probe expectedCommitHashes must be unique and nonempty')
  if (!value.changesOverflow || typeof value.changesOverflow !== 'object' || !['commitHash', 'toggleLabel', 'thirdSessionTitle', 'sessionId', 'sourceText', 'providerHarness'].every((key) => typeof value.changesOverflow[key] === 'string' && value.changesOverflow[key].length > 0) || !Array.isArray(value.changesOverflow.expectedHistoryHashes) || value.changesOverflow.expectedHistoryHashes.length === 0 || value.changesOverflow.expectedHistoryHashes.some((hash) => typeof hash !== 'string' || hash.length === 0) || typeof value.changesOverflow.returnedExpanded !== 'boolean') throw new Error('timeline rendered probe changesOverflow must identify its branded destination and exact Changes return state')
  return value
}

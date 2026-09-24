#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
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
const INJECTED_DIST_ROOT = process.env.TIMELINE_PROBE_DIST_ROOT
const DIST_ROOT = INJECTED_DIST_ROOT
  ? resolve(INJECTED_DIST_ROOT)
  : resolve(ROOT, 'dist')
const INJECTED_ORIGIN = process.env.TIMELINE_PROBE_ORIGIN
const fixture = loadFixture(resolve(HERE, 'testdata/timeline-rendered-probe.yaml'))
const cases = CASE_FILTER ? fixture.cases.filter((testCase) => testCase.name.includes(CASE_FILTER)) : fixture.cases
const VIEWPORTS = Object.freeze({
  desktop: Object.freeze({ width: 1460, height: 1000, deviceScaleFactor: 1 }),
  mobile: Object.freeze({ width: 390, height: 844, deviceScaleFactor: 1 }),
})
const actionableMessage = ({ what, why, where, when, impact, remedy, expected, observed }) => `timeline rendered probe failed: what: ${what}; why: ${why}; where: ${where}; when: ${when}; impact: ${impact}; remedy: ${remedy}; expected: ${JSON.stringify(expected)}; observed: ${JSON.stringify(observed)}.`

if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true })
if (cases.length === 0) throw new Error(`timeline rendered probe case filter ${JSON.stringify(CASE_FILTER)} matched no fixture case`)

if (!CHROME || !existsSync(CHROME)) {
  throw new Error('timeline rendered probe failed: what went wrong: CHROME_PATH does not name an existing browser; why: the probe requires a real Linux Chrome or Chromium process; where: scripts/timeline-rendered-probe.mjs startup; when: browser preflight; what it means: mounted theme and motion styles were not verified; how to fix: set CHROME_PATH to the Chrome or Chromium executable and rerun pnpm test:timeline-rendered.')
}

if (INJECTED_ORIGIN && !INJECTED_DIST_ROOT) {
  throw new Error('timeline rendered probe failed: what went wrong: TIMELINE_PROBE_ORIGIN was supplied without a dist root; why: served-byte provenance needs the exact injected artifact; where: scripts/timeline-rendered-probe.mjs startup; when: mutation preflight; what it means: the browser could inspect bytes without identifying them; how to fix: set both TIMELINE_PROBE_DIST_ROOT and TIMELINE_PROBE_ORIGIN.')
}

let server
let browser
let origin = INJECTED_ORIGIN

try {
  if (!origin) {
    server = await preview({
      root: ROOT,
      configFile: false,
      logLevel: 'silent',
      preview: { host: '127.0.0.1', port: 0, strictPort: true },
    })
    const address = server.httpServer.address()
    if (!address || typeof address === 'string') throw new Error('timeline rendered probe could not resolve the preview server address')
    origin = `http://127.0.0.1:${address.port}`
  }

  const provenance = await verifyProvenance(origin, DIST_ROOT, fixture.fullShell.provenance.requiredMarkers)
  console.log(`timeline rendered probe provenance: ${JSON.stringify(provenance)}`)

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
    await page.waitForSelector('#inuse-stage .iu-subnav', { timeout: 15000 })
    await clickNavItem(page, 'peasant sections', 'code map')
    await page.waitForSelector('.tlp-session-lane', { timeout: 15000 })
    const selectedSession = await page.evaluate(() => {
      const lane = [...document.querySelectorAll('.tlp-session-lane')].find((candidate) => candidate.textContent.includes('Add DOI ranking to the code map'))
      lane?.click()
      return Boolean(lane)
    })
    assert.equal(selectedSession, true, `${testCase.name}: session lane selection`)
    await page.waitForSelector('.tlp-highlight-edge-primary', { timeout: 15000 })

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

    await clickNavItem(page, 'peasant sections', 'changes')
    await page.waitForSelector(`.cg-history-row[data-commit-hash="${fixture.changesOverflow.commitHash}"] .tlp-overflow-toggle`, { timeout: 15000 })

    const initialOverflow = await page.evaluate(({ commitHash, toggleLabel, thirdSessionTitle }) => {
      const row = document.querySelector(`.cg-history-row[data-commit-hash="${CSS.escape(commitHash)}"]`)
      const toggle = row?.querySelector('.tlp-overflow-toggle')
      return {
        found: Boolean(row && toggle),
        expanded: toggle?.getAttribute('aria-expanded'),
        label: toggle?.getAttribute('aria-label'),
        thirdSessionVisible: [...(row?.querySelectorAll('.tlp-overflow-item') ?? [])].some((item) => item.textContent.trim() === thirdSessionTitle),
      }
    }, fixture.changesOverflow)
    assert.equal(initialOverflow.found, true, `${testCase.name}: overflow control mounts in the Changes view`)
    assert.equal(initialOverflow.expanded, 'false', `${testCase.name}: overflow starts collapsed`)
    assert.equal(initialOverflow.label, fixture.changesOverflow.toggleLabel, `${testCase.name}: overflow reports its hidden session count`)
    assert.equal(initialOverflow.thirdSessionVisible, false, `${testCase.name}: third session starts hidden`)

    await page.click(`.cg-history-row[data-commit-hash="${fixture.changesOverflow.commitHash}"] .tlp-overflow-toggle`)
    await page.waitForFunction(({ commitHash, thirdSessionTitle }) => {
      const row = document.querySelector(`.cg-history-row[data-commit-hash="${CSS.escape(commitHash)}"]`)
      return row?.querySelector('.tlp-overflow-toggle')?.getAttribute('aria-expanded') === 'true' && [...(row?.querySelectorAll('.tlp-overflow-item') ?? [])].some((item) => item.textContent.trim() === thirdSessionTitle)
    }, { timeout: 15000 }, fixture.changesOverflow)
    const expandedOverflow = await page.evaluate(({ commitHash, thirdSessionTitle }) => {
      const row = document.querySelector(`.cg-history-row[data-commit-hash="${CSS.escape(commitHash)}"]`)
      return {
        expanded: row?.querySelector('.tlp-overflow-toggle')?.getAttribute('aria-expanded'),
        thirdSessionVisible: [...(row?.querySelectorAll('.tlp-overflow-item') ?? [])].some((item) => item.textContent.trim() === thirdSessionTitle),
      }
    }, fixture.changesOverflow)
    assert.equal(expandedOverflow.expanded, 'true', `${testCase.name}: overflow expands`)
    assert.equal(expandedOverflow.thirdSessionVisible, true, `${testCase.name}: third session becomes visible`)

    const thirdSession = await page.evaluateHandle(({ commitHash, thirdSessionTitle }) => [...document.querySelectorAll(`.cg-history-row[data-commit-hash="${CSS.escape(commitHash)}"] .tlp-overflow-item`)].find((item) => item.textContent.trim() === thirdSessionTitle) ?? null, fixture.changesOverflow)
    const thirdSessionElement = thirdSession.asElement()
    assert.ok(thirdSessionElement, `${testCase.name}: exact Verify map session links control is missing from the expanded Changes disclosure`)
    await thirdSessionElement.click()
    await page.waitForSelector('#gmp-session-destination-title', { timeout: 15000 })
    const sessionDestination = await page.evaluate(() => ({
      thirdSessionFound: Boolean(document.querySelector('.gmp-session-destination')),
      changesStillMounted: Boolean(document.querySelector('[aria-label="default-branch commit history"]')),
      destinationSessionId: document.querySelector('.gmp-session-destination')?.getAttribute('data-session-id'),
      destinationTitle: document.querySelector('#gmp-session-destination-title')?.textContent,
      destinationSource: document.querySelector('.gmp-session-destination [data-session-source]')?.textContent,
      providerName: document.querySelector('[data-session-provider] .pv-name-label')?.textContent,
      providerBrandMark: Boolean(document.querySelector('[data-session-provider] svg.brand')),
      unknownProvider: Boolean(document.querySelector('[data-session-provider-unknown]')),
    }))
    assert.equal(sessionDestination.thirdSessionFound, true, `${testCase.name}: third session can be selected`)
    assert.equal(sessionDestination.changesStillMounted, true, `${testCase.name}: session selection preserves the canonical Changes composition`)
    assert.equal(sessionDestination.destinationSessionId, fixture.changesOverflow.sessionId, `${testCase.name}: session destination preserves the selected session identity`)
    assert.equal(sessionDestination.destinationTitle, fixture.changesOverflow.thirdSessionTitle, `${testCase.name}: session destination renders the selected session title`)
    assert.equal(sessionDestination.destinationSource, fixture.changesOverflow.sourceText, `${testCase.name}: session destination preserves commit provenance`)
    assert.equal(sessionDestination.providerName, fixture.changesOverflow.providerHarness, `${testCase.name}: session destination renders the canonical provider name`)
    assert.equal(sessionDestination.providerBrandMark, true, `${testCase.name}: session destination renders the canonical provider brand mark`)
    assert.equal(sessionDestination.unknownProvider, false, `${testCase.name}: resolved provider does not use the unknown fallback`)
    await assertComputedHeading(page, fixture.headingCase.graphSession, testCase.name)
    await assertFullShell(page, fixture, fixture.headingCase.graphSession, testCase.name)

    if (SHOT_DIR) {
      const destination = await page.$('.gmp-session-destination')
      if (!destination) throw new Error(`${testCase.name}: session destination disappeared before screenshot capture`)
      await destination.evaluate((element) => element.scrollIntoView({ block: 'start' }))
      const destinationShotPath = resolve(SHOT_DIR, `${testCase.viewport}-${testCase.theme}-${testCase.motion}-session-destination.png`)
      await page.screenshot({ path: destinationShotPath, captureBeyondViewport: false })
      await new SurfaceGate(page).assert(testCase.name, destinationShotPath, { sel: '.gmp-session-destination', where: 'timeline-rendered-probe.mjs' })
    }

    const back = await page.$('.iu-subnav-back')
    assert.ok(back, `${testCase.name}: session destination provides a Changes back control`)
    await back.click()
    await page.waitForSelector(`[aria-label="default-branch commit history"]`, { timeout: 15000 })
    const returnedChanges = await page.evaluate(({ commitHash, sessionId }) => {
      const history = document.querySelector('[aria-label="default-branch commit history"]')
      const row = document.querySelector(`.cg-history-row[data-commit-hash="${CSS.escape(commitHash)}"]`)
      const toggle = row?.querySelector('.tlp-overflow-toggle')
      const third = row?.querySelector(`.tlp-overflow-item[data-session-id="${CSS.escape(sessionId)}"]`)
      return {
        destinationStillMounted: Boolean(document.querySelector('.gmp-session-destination')),
        historyHashes: [...(history?.querySelectorAll('.cg-history-row[data-commit-hash]') ?? [])].map((item) => item.getAttribute('data-commit-hash')),
        historyMounted: Boolean(history),
        overflowLabel: toggle?.getAttribute('aria-label'),
        overflowExpanded: toggle?.getAttribute('aria-expanded'),
        thirdSessionId: third?.getAttribute('data-session-id'),
        thirdSessionVisible: Boolean(third),
      }
    }, fixture.changesOverflow)
    assert.equal(returnedChanges.destinationStillMounted, false, `${testCase.name}: back unmounts the session destination`)
    assert.equal(returnedChanges.historyMounted, true, `${testCase.name}: back remounts the Changes history`)
    assert.deepEqual(returnedChanges.historyHashes, fixture.changesOverflow.expectedHistoryHashes, `${testCase.name}: back restores the exact Changes history`)
    assert.equal(returnedChanges.overflowLabel, fixture.changesOverflow.toggleLabel, `${testCase.name}: back restores the overflow control`)
    assert.equal(returnedChanges.overflowExpanded, String(fixture.changesOverflow.returnedExpanded), `${testCase.name}: back restores the overflow's initial expansion state`)
    assert.equal(returnedChanges.thirdSessionId, fixture.changesOverflow.sessionId, `${testCase.name}: back restores the same third session identity`)
    assert.equal(returnedChanges.thirdSessionVisible, true, `${testCase.name}: back restores the expanded third session`)

    await page.click('#iu-tab-commons')
    await waitForApp(page, 'commons', 'village sections')
    await clickNavItem(page, 'village sections', 'publish')
    await page.waitForFunction((expectedText) => [...document.querySelectorAll('h2.cmg-title')].some((heading) => heading.textContent.trim() === expectedText), { timeout: 15000 }, fixture.headingCase.publish.expectedText)
    await assertComputedHeading(page, fixture.headingCase.publish, testCase.name)
    await assertFullShell(page, fixture, fixture.headingCase.publish, testCase.name)

    await clickNavItem(page, 'village sections', 'collectives')
    await page.waitForSelector('.cmg-col-card', { timeout: 15000 })
    const collectiveCard = await page.evaluateHandle((name) => [...document.querySelectorAll('.cmg-col-card')].find((card) => [...card.querySelectorAll('.cmg-col-name')].some((item) => item.textContent.trim() === name)) ?? null, fixture.headingCase.detail.expectedText)
    const collectiveCardElement = collectiveCard.asElement()
    assert.ok(collectiveCardElement, `${testCase.name}: exact AI Research Team collective card is missing`)
    await collectiveCardElement.click()
    await page.waitForSelector('.cmg-detail', { timeout: 15000 })
    await assertComputedHeading(page, fixture.headingCase.detail, testCase.name)
    const providerShare = await readExactTextInfo(page, '.cmg-sub', 'provider share')
    assert.equal(providerShare.textTransform, 'lowercase', `${testCase.name}: provider share computed transform`)
    await assertFullShell(page, fixture, fixture.headingCase.detail, testCase.name)

    await clickExactText(page, '.cmg-roleseg', 'contributor')
    await page.waitForFunction(() => [...document.querySelectorAll('.cmg-roleseg')].find((button) => button.textContent.trim() === 'contributor')?.getAttribute('aria-pressed') === 'true', { timeout: 15000 })
    await clickExactText(page, '.cmg-d-actions button', 'contribute')
    await page.waitForSelector('.cmg-contribute', { timeout: 15000 })
    await assertComputedHeading(page, fixture.headingCase.contribute, testCase.name)
    const projectName = await readExactTextInfo(page, '.cmg-proj-name', 'Village Core')
    assert.equal(projectName.textTransform, 'none', `${testCase.name}: Village Core computed transform`)
    await assertFullShell(page, fixture, fixture.headingCase.contribute, testCase.name)

    assert.deepEqual(errors, [], `${testCase.name}: browser console and page errors after mounted heading checks`)
    await page.close()
    await browser.close()
    browser = undefined
  }
} finally {
  await browser?.close()
  if (server) {
    await new Promise((resolveClose, rejectClose) => server.httpServer.close((error) => error ? rejectClose(error) : resolveClose()))
  }
}

console.log(`timeline rendered probe: ${cases.length} production-build theme and motion cases passed in Chrome${CASE_FILTER ? ' (filtered)' : ''}`)

async function waitForNavActive(page, navLabel, itemLabel) {
  try {
    await page.waitForFunction(({ navLabel, itemLabel }) => {
      const nav = document.querySelector(`#inuse-stage nav[aria-label="${navLabel}"]`)
      return [...(nav?.querySelectorAll('button.iu-subnav-item') ?? [])].some((button) => button.textContent.trim() === itemLabel && button.classList.contains('active'))
    }, { timeout: 15000 }, { navLabel, itemLabel })
  } catch {
    const observed = await page.evaluate(({ navLabel, itemLabel }) => {
      const nav = document.querySelector(`#inuse-stage nav[aria-label="${navLabel}"]`)
      const buttons = [...(nav?.querySelectorAll('button.iu-subnav-item') ?? [])].map((button) => ({ text: button.textContent.trim(), active: button.classList.contains('active') }))
      return { navPresent: Boolean(nav), buttons }
    }, { navLabel, itemLabel })
    throw new Error(actionableMessage({
      what: `navigation item ${JSON.stringify(`${navLabel} > ${itemLabel}`)} did not become active`,
      why: 'the mounted click did not settle into the requested section, so later checks could inspect stale content',
      where: 'timeline-rendered-probe.mjs clickNavItem',
      when: 'after the mounted navigation click and 15s bounded wait',
      impact: 'the production-path case cannot prove its requested section',
      remedy: 'verify the exact feature preview, selected app, and production section label; update the probe only for a deliberate UI contract change',
      expected: `an active button with exact text ${JSON.stringify(itemLabel)} in ${JSON.stringify(navLabel)}`,
      observed,
    }))
  }
}

async function clickNavItem(page, navLabel, itemLabel) {
  const handle = await page.evaluateHandle(({ navLabel, itemLabel }) => {
    const nav = document.querySelector(`#inuse-stage nav[aria-label="${navLabel}"]`)
    return [...(nav?.querySelectorAll('button.iu-subnav-item') ?? [])].find((button) => button.textContent.trim() === itemLabel) ?? null
  }, { navLabel, itemLabel })
  const element = handle.asElement()
  assert.ok(element, actionableMessage({
    what: `mounted navigation control ${JSON.stringify(`${navLabel} > ${itemLabel}`)} is missing`,
    why: 'the probe must follow the same mounted navigation control used by a user',
    where: 'timeline-rendered-probe.mjs clickNavItem',
    when: 'while navigating to the production-path target',
    impact: `the ${itemLabel} case cannot be proven from the mounted shell`,
    remedy: 'verify the exact feature preview and update the selector only if the production control label changed',
    expected: `a visible button in ${JSON.stringify(navLabel)} with exact text ${JSON.stringify(itemLabel)}`,
    observed: element ? 'the matching element was found after the state check' : 'no matching navigation button was found in the mounted DOM',
  }))
  await element.click()
  await waitForNavActive(page, navLabel, itemLabel)
}

async function clickExactText(page, selector, text) {
  const handle = await page.evaluateHandle(({ selector, text }) => [...document.querySelectorAll(selector)].find((element) => element.textContent.trim() === text) ?? null, { selector, text })
  const element = handle.asElement()
  assert.ok(element, actionableMessage({
    what: `mounted control ${JSON.stringify(`${selector} > ${text}`)} is missing`,
    why: 'the probe must click the production control rather than a test-only selector',
    where: 'timeline-rendered-probe.mjs clickExactText',
    when: 'while driving the mounted heading-case path',
    impact: `the ${text} path cannot be proven from the production shell`,
    remedy: 'verify the exact feature preview and update the selector only if the production control label changed',
    expected: `a visible element matching ${JSON.stringify(selector)} with exact text ${JSON.stringify(text)}`,
    observed: element ? 'the matching element was found after the state check' : 'no matching control was found in the mounted DOM',
  }))
  await element.click()
}

async function waitForApp(page, appId, navLabel) {
  try {
    await page.waitForFunction(({ appId, navLabel }) => {
      const tab = document.querySelector(`#iu-tab-${appId}`)
      const stage = document.querySelector('#inuse-stage')
      return tab?.getAttribute('aria-selected') === 'true' && stage?.getAttribute('aria-labelledby') === tab?.id && Boolean(document.querySelector(`#inuse-stage nav[aria-label="${navLabel}"]`))
    }, { timeout: 15000 }, { appId, navLabel })
  } catch {
    const observed = await page.evaluate(({ appId, navLabel }) => ({
      selectedTab: document.querySelector(`#iu-tab-${appId}`)?.getAttribute('aria-selected') ?? null,
      stageLabelledBy: document.querySelector('#inuse-stage')?.getAttribute('aria-labelledby') ?? null,
      navPresent: Boolean(document.querySelector(`#inuse-stage nav[aria-label="${navLabel}"]`)),
    }), { appId, navLabel })
    throw new Error(actionableMessage({
      what: `app ${JSON.stringify(appId)} did not settle with the expected shell`,
      why: 'the mounted app transition must select the requested app and publish its section navigation before heading checks',
      where: 'timeline-rendered-probe.mjs waitForApp',
      when: 'after app navigation and a 15s bounded wait',
      impact: 'later section and target assertions would inspect the wrong or incomplete app',
      remedy: 'verify the exact feature preview, app tab, stage label, and production navigation label',
      expected: { appId, navLabel, ariaSelected: 'true', stageLabelledBy: `iu-tab-${appId}`, navPresent: true },
      observed,
    }))
  }
}

async function readExactTextInfo(page, selector, expectedText) {
  const result = await page.evaluate(({ selector, expectedText }) => {
    const element = [...document.querySelectorAll(selector)].find((candidate) => candidate.textContent.trim() === expectedText) ?? null
    return element
      ? { found: true, text: element.textContent.trim(), textTransform: getComputedStyle(element).textTransform, hasChromeAttribute: element.hasAttribute('data-chrome-heading') }
      : { found: false, text: null, textTransform: null, hasChromeAttribute: false }
  }, { selector, expectedText })
  assert.equal(result.found, true, actionableMessage({
    what: `mounted heading ${JSON.stringify(`${selector} > ${expectedText}`)} is missing`,
    why: 'the case must inspect the exact mounted heading that represents its user or chrome contract',
    where: 'timeline-rendered-probe.mjs readExactTextInfo',
    when: 'after the production click path settled',
    impact: 'the case cannot prove the expected heading text or its computed transform',
    remedy: 'verify the exact feature preview and update the selector only if the production heading changed',
    expected: `a visible element matching ${JSON.stringify(selector)} with exact text ${JSON.stringify(expectedText)}`,
    observed: { found: result.found, text: result.text },
  }))
  assert.equal(result.text, expectedText, actionableMessage({
    what: `mounted heading text for ${JSON.stringify(`${selector} > ${expectedText}`)} changed`,
    why: 'the heading-case contract must compare against the exact mounted production value',
    where: 'timeline-rendered-probe.mjs readExactTextInfo',
    when: 'after finding the matching heading selector',
    impact: 'the case could silently verify a different user or chrome value',
    remedy: 'verify the production fixture and update the expected value only for a deliberate content change',
    expected: expectedText,
    observed: result.text,
  }))
  return result
}

async function assertComputedHeading(page, headingCase, testCaseName) {
  const result = await readExactTextInfo(page, headingCase.targetSelector, headingCase.expectedText)
  assert.equal(result.textTransform, headingCase.expectedTextTransform, `${testCaseName}: ${headingCase.expectedTextTransform === 'none' ? 'user' : 'chrome'} heading computed transform expected ${headingCase.expectedTextTransform}, received ${result.textTransform}`)
  if (headingCase.expectedAttribute) assert.equal(result.hasChromeAttribute, true, `${testCaseName}: ${headingCase.name} unexpectedly lost ${headingCase.expectedAttribute}`)
  else assert.equal(result.hasChromeAttribute, false, `${testCaseName}: ${headingCase.name} unexpectedly carries data-chrome-heading`)
}

async function assertFullShell(page, fixtureValue, surface, testCaseName) {
  const expectedSections = surface.app === 'graph' ? fixtureValue.fullShell.graphSections : fixtureValue.fullShell.villageSections
  const result = await page.evaluate(({ rootSelector, barSelector, stageSelector, appTabs, expectedApp, expectedSections, targetSelector, targetText, bodySelector, requireAriaCurrent }) => {
    const visible = (element) => {
      if (!element) return false
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0
    }
    const intersects = (left, right) => left && right && left.bottom > right.top && left.top < right.bottom && left.right > right.left && left.left < right.right
    const root = document.querySelector(rootSelector)
    const bar = document.querySelector(barSelector)
    const stage = document.querySelector(stageSelector)
    const tablist = document.querySelector('[role="tablist"][aria-label="apps"]')
    const tabs = appTabs.map((id) => document.getElementById(id))
    const selectedTabs = tabs.filter((tab) => tab?.getAttribute('aria-selected') === 'true')
    const nav = document.querySelector(`#inuse-stage nav[aria-label="${expectedSections === undefined ? '' : expectedApp === 'graph' ? 'peasant sections' : 'village sections'}"]`)
    const sectionButtons = [...(nav?.querySelectorAll('button.iu-subnav-item') ?? [])]
    const activeSections = sectionButtons.filter((button) => button.classList.contains('active'))
    const target = [...document.querySelectorAll(targetSelector)].find((candidate) => candidate.textContent.trim() === targetText) ?? null
    const body = document.querySelector(bodySelector)
    const rootBox = root?.getBoundingClientRect()
    const targetBox = target?.getBoundingClientRect()
    const bodyBox = body?.getBoundingClientRect()
    return {
      rootVisible: visible(root),
      barVisible: visible(bar),
      stageVisible: visible(stage),
      tablistVisible: visible(tablist),
      tabsMounted: tabs.every((tab) => visible(tab) && tab?.getAttribute('role') === 'tab'),
      selectedCount: selectedTabs.length,
      selectedApp: selectedTabs[0]?.id === `iu-tab-${expectedApp}` ? expectedApp : selectedTabs[0]?.id ?? null,
      stageLabelledBy: stage?.getAttribute('aria-labelledby') ?? null,
      sectionLabels: sectionButtons.map((button) => button.textContent.trim()),
      activeSectionCount: activeSections.length,
      activeSection: activeSections[0]?.textContent.trim() ?? null,
      ariaCurrent: activeSections[0]?.getAttribute('aria-current') ?? null,
      targetVisible: visible(target),
      targetIntersectsShell: intersects(targetBox, rootBox),
      bodyVisible: visible(body),
      bodyIntersectsShell: intersects(bodyBox, rootBox),
      targetText: target?.textContent.trim() ?? null,
    }
  }, {
    rootSelector: fixtureValue.fullShell.rootSelector,
    barSelector: fixtureValue.fullShell.barSelector,
    stageSelector: fixtureValue.fullShell.stageSelector,
    appTabs: fixtureValue.fullShell.appTabs,
    expectedApp: surface.app,
    expectedSections,
    targetSelector: surface.targetSelector,
    targetText: surface.expectedText,
    bodySelector: surface.bodySelector,
    requireAriaCurrent: surface.requireAriaCurrent === true,
  })
  const shellMessage = (property, expected, observed) => actionableMessage({
    what: `${testCaseName} ${surface.name} full-shell ${property} is invalid`,
    why: 'the case must prove the mounted app chrome and target body before completing its production-path check',
    where: 'timeline-rendered-probe.mjs assertFullShell',
    when: 'after real navigation and computed heading checks',
    impact: `the ${surface.name} case cannot prove the complete mounted shell`,
    remedy: 'verify the exact feature preview, selected app, section navigation, and target state; update the fixture only for a deliberate production contract change',
    expected,
    observed,
  })
  assert.equal(result.rootVisible, true, shellMessage('root visibility', true, result.rootVisible))
  assert.equal(result.barVisible, true, shellMessage('banner visibility', true, result.barVisible))
  assert.equal(result.stageVisible, true, shellMessage('stage visibility', true, result.stageVisible))
  assert.equal(result.tablistVisible, true, shellMessage('app tablist visibility', true, result.tablistVisible))
  assert.equal(result.tabsMounted, true, shellMessage('three app tabs mounted and visible', true, result.tabsMounted))
  assert.equal(result.selectedCount, 1, shellMessage('selected app count', 1, result.selectedCount))
  assert.equal(result.selectedApp, surface.app, shellMessage('selected app identity', surface.app, result.selectedApp))
  assert.equal(result.stageLabelledBy, `iu-tab-${surface.app}`, shellMessage('stage aria-labelledby', `iu-tab-${surface.app}`, result.stageLabelledBy))
  assert.deepEqual(result.sectionLabels, expectedSections, shellMessage('section navigation labels', expectedSections, result.sectionLabels))
  assert.equal(result.activeSectionCount, 1, shellMessage('active owning section count', 1, result.activeSectionCount))
  assert.equal(result.activeSection, surface.section, shellMessage('active owning section', surface.section, result.activeSection))
  if (surface.requireAriaCurrent) assert.equal(result.ariaCurrent, 'page', shellMessage('top-level aria-current', 'page', result.ariaCurrent))
  assert.equal(result.targetVisible, true, shellMessage('target visibility', true, result.targetVisible))
  assert.equal(result.targetIntersectsShell, true, shellMessage('target intersection with shell', true, result.targetIntersectsShell))
  assert.equal(result.bodyVisible, true, shellMessage('representative body visibility', true, result.bodyVisible))
  assert.equal(result.bodyIntersectsShell, true, shellMessage('representative body intersection with shell', true, result.bodyIntersectsShell))
  assert.equal(result.targetText, surface.expectedText, shellMessage('target text', surface.expectedText, result.targetText))
}

async function verifyProvenance(originValue, distRoot, requiredMarkers) {
  const assets = collectJavaScriptAssets(distRoot)
  if (assets.length === 0) throw new Error(`timeline rendered probe provenance failed: no JavaScript assets were found beneath ${distRoot}; where: scripts/timeline-rendered-probe.mjs; when: build preflight; how to fix: build the app before running the probe`)
  const records = []
  const allBytes = []
  for (const asset of assets) {
    const diskBytes = readFileSync(resolve(distRoot, asset))
    const response = await fetch(`${originValue}/${asset}`)
    if (!response.ok) throw new Error(`timeline rendered probe provenance failed: served JavaScript ${asset} returned HTTP ${response.status}; where: ${originValue}/${asset}; when: served-byte verification; how to fix: serve the exact injected dist root`)
    const servedBytes = Buffer.from(await response.arrayBuffer())
    assert.deepEqual(servedBytes, diskBytes, `timeline rendered probe provenance failed: served JavaScript ${asset} differs from injected dist bytes`)
    allBytes.push(Buffer.from(diskBytes))
    records.push({ path: asset, sha256: createHash('sha256').update(diskBytes).digest('hex') })
  }
  const builtJavaScript = Buffer.concat(allBytes).toString('utf8')
  for (const marker of requiredMarkers) {
    if (!builtJavaScript.includes(marker)) throw new Error(`timeline rendered probe provenance failed: served JavaScript lacks required independent marker ${JSON.stringify(marker)}; where: ${distRoot}; when: build preflight; how to fix: rebuild from the current feature source`)
  }
  const manifest = records.map(({ path, sha256 }) => `${path}\0${sha256}\n`).join('')
  const manifestSha256 = createHash('sha256').update(manifest).digest('hex')
  assert.match(manifestSha256, /^[a-f0-9]{64}$/, 'timeline rendered probe provenance manifest SHA must be 64 lowercase hexadecimal characters')
  return { origin: originValue, markers: requiredMarkers, assets: records, manifestSha256 }
}

function collectJavaScriptAssets(root) {
  if (!existsSync(root)) throw new Error(`timeline rendered probe provenance failed: dist root ${root} is absent; where: scripts/timeline-rendered-probe.mjs; when: build preflight; how to fix: run pnpm build before the probe`)
  const files = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() && path.endsWith('.js')) files.push(relative(root, path).replaceAll('\\', '/'))
    }
  }
  visit(root)
  return files.sort()
}

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
  const headingCases = ['graphSession', 'publish', 'detail', 'contribute']
  if (!value.headingCase || headingCases.some((key) => !value.headingCase[key] || typeof value.headingCase[key] !== 'object')) throw new Error('timeline rendered probe headingCase must name graph, publish, detail, and contribute surfaces')
  for (const key of headingCases) {
    const headingCase = value.headingCase[key]
    for (const field of ['name', 'app', 'section', 'targetSelector', 'expectedText', 'expectedTextTransform', 'bodySelector']) {
      if (typeof headingCase[field] !== 'string' || headingCase[field].length === 0) throw new Error(`timeline rendered probe headingCase.${key}.${field} must be a nonempty string`)
    }
    if (!['graph', 'commons'].includes(headingCase.app) || !['none', 'lowercase'].includes(headingCase.expectedTextTransform)) throw new Error(`timeline rendered probe headingCase.${key} has unsupported app or transform`)
  }
  if (value.headingCase.publish.expectedAttribute !== 'data-chrome-heading' || value.headingCase.publish.requireAriaCurrent !== true) throw new Error('timeline rendered probe publish heading must require the public chrome annotation and aria-current')
  if (!value.fullShell || !['rootSelector', 'barSelector', 'stageSelector'].every((key) => typeof value.fullShell[key] === 'string' && value.fullShell[key].length > 0) || !Array.isArray(value.fullShell.appTabs) || value.fullShell.appTabs.length !== 3 || !Array.isArray(value.fullShell.graphSections) || !Array.isArray(value.fullShell.villageSections)) throw new Error('timeline rendered probe fullShell contract is incomplete')
  if (!value.fullShell.provenance || !Array.isArray(value.fullShell.provenance.requiredMarkers) || value.fullShell.provenance.requiredMarkers.length !== 2 || value.fullShell.provenance.requiredMarkers.includes('data-chrome-heading')) throw new Error('timeline rendered probe provenance must require two independent markers and never data-chrome-heading')
  if (!value.mutations || value.mutations.expectedMutationCount !== 2 || !Array.isArray(value.mutations.requiredMutationNames) || value.mutations.requiredMutationNames.length !== 2 || !Array.isArray(value.mutations.cases) || value.mutations.cases.length !== 2) throw new Error('timeline rendered probe mutation inventory is incomplete')
  const mutationNames = value.mutations.cases.map((mutation) => mutation.name)
  if (new Set(mutationNames).size !== mutationNames.length || value.mutations.requiredMutationNames.some((name) => !mutationNames.includes(name)) || mutationNames.some((name) => !value.mutations.requiredMutationNames.includes(name))) throw new Error('timeline rendered probe mutation names do not match their required inventory')
  for (const mutation of value.mutations.cases) {
    for (const field of ['name', 'file', 'find', 'replace', 'expectedFailure']) if (typeof mutation[field] !== 'string' || mutation[field].length === 0) throw new Error(`timeline rendered probe mutation ${mutation.name ?? '(unnamed)'} field ${field} must be a nonempty string`)
  }
  return value
}

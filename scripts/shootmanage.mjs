/* Screenshot the mounted in-use Manage surfaces from the fairtrade shell.
 *
 * usage: CHROME_PATH=/path/to/chrome node scripts/shootmanage.mjs <theme> <outdir>
 *      theme  = dark | light
 *      outdir = directory to write manage-*.png into
 *
 * The existing live-compositor SurfaceGate is used for every image. Navigation
 * follows the same mounted controls as the product: app tabs, section tabs,
 * the collectives table, overflow menus, and action buttons. Surfaces that left
 * the nav but kept their routes are opened by route. */
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import { SurfaceGate } from './surface-gate.mjs'
import { assertServedBuildProvenance, observeServedBuildAssets } from './served-build-provenance.mjs'
import { resolveFeatureGitIdentity } from './feature-git-identity.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const featureIdentity = resolveFeatureGitIdentity({ sourceRoot: ROOT })
const DIST_ROOT = resolve(process.env.BREADCRUMB_DIST_ROOT || resolve(ROOT, 'dist'))
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const theme = process.argv[2] || 'dark'
const out = process.argv[3] || `/tmp/manage-${theme}`
const PORT = Number(process.env.DEMO_PORT) || 5180

mkdirSync(out, { recursive: true })

if (!existsSync(CHROME)) {
  console.error(`ERROR [shootmanage.mjs] Chrome binary not found at: ${CHROME}`)
  process.exit(1)
}

if (!existsSync(resolve(DIST_ROOT, 'index.html'))) {
  throw new Error(`ERROR [shootmanage.mjs] exact dist is missing at ${DIST_ROOT}. Build the app before capturing.`)
}

const server = await preview({ root: resolve(DIST_ROOT, '..'), configFile: false, logLevel: 'silent', preview: { host: '127.0.0.1', port: PORT, strictPort: true } })
const address = server.httpServer.address()
if (!address || typeof address === 'string') throw new Error('ERROR [shootmanage.mjs] Vite preview did not expose a TCP address')
const url = `http://127.0.0.1:${address.port}/?fb=off${theme === 'light' ? '&theme=light' : ''}`
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1460, height: 1000, deviceScaleFactor: 1 }, args: typeof process.getuid === 'function' && process.getuid() === 0 ? ['--no-sandbox'] : [] })
const page = await browser.newPage()
const observer = observeServedBuildAssets(page, url)
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
const errs = []
page.on('console', (message) => { if (message.type() === 'error' && !/favicon/.test(message.text())) errs.push(message.text()) })
page.on('pageerror', (error) => errs.push('pageerr: ' + error.message))

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const gate = new SurfaceGate(page)
const actionableMessage = ({ what, why, where, when, impact, remedy, expected, observed }) => `ERROR [shootmanage.mjs] what: ${what}; why: ${why}; where: ${where}; when: ${when}; impact: ${impact}; remedy: ${remedy}; expected: ${JSON.stringify(expected)}; observed: ${JSON.stringify(observed)}.`
const waitFor = async (selector, timeoutMs = 8000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const element = await page.$(selector)
    if (element) return element
    await pause(80)
  }
  throw new Error(actionableMessage({
    what: `mounted selector ${JSON.stringify(selector)} is missing`,
    why: 'Manage capture navigation cannot reach the requested mounted surface without this element',
    where: 'shootmanage.mjs waitFor',
    when: `after ${timeoutMs}ms of bounded polling`,
    impact: 'the capture cannot prove the requested production surface',
    remedy: 'verify the exact feature build serves the expected in-use shell before recapturing',
    expected: `one element matching ${JSON.stringify(selector)}`,
    observed: 'no matching element was returned before the timeout',
  }))
}

const clickExactText = async (selector, text) => {
  const handle = await page.evaluateHandle(({ selector, text }) => [...document.querySelectorAll(selector)].find((element) => element.textContent.trim() === text) ?? null, { selector, text })
  const element = handle.asElement()
  assert.ok(element, actionableMessage({
    what: `mounted control ${JSON.stringify(`${selector} > ${text}`)} is missing`,
    why: 'the capture must follow the same mounted production control used by a user',
    where: 'shootmanage.mjs clickExactText',
    when: 'while navigating to the requested Manage surface',
    impact: `the ${text} path cannot be captured from the production shell`,
    remedy: 'verify the exact feature preview and update the selector only if the production control label changed',
    expected: `a visible element matching ${JSON.stringify(selector)} with exact text ${JSON.stringify(text)}`,
    observed: element ? 'the matching element was found after the state check' : 'no matching element was found in the mounted DOM',
  }))
  await element.click()
}

const waitForNavActive = async (navLabel, itemLabel) => {
  try {
    await page.waitForFunction(({ navLabel, itemLabel }) => [...document.querySelectorAll(`#inuse-stage nav[aria-label="${navLabel}"] button.iu-subnav-item`)].some((button) => button.textContent.trim() === itemLabel && button.classList.contains('active')), { timeout: 15000 }, { navLabel, itemLabel })
  } catch {
    const observed = await page.evaluate(({ navLabel, itemLabel }) => {
      const nav = document.querySelector(`#inuse-stage nav[aria-label="${navLabel}"]`)
      const buttons = [...(nav?.querySelectorAll('button.iu-subnav-item') ?? [])].map((button) => ({ text: button.textContent.trim(), active: button.classList.contains('active') }))
      return { navPresent: Boolean(nav), buttons }
    }, { navLabel, itemLabel })
    throw new Error(actionableMessage({
      what: `navigation item ${JSON.stringify(`${navLabel} > ${itemLabel}`)} did not become active`,
      why: 'the mounted click did not settle into the requested section, so later checks could target stale content',
      where: 'shootmanage.mjs clickNavItem',
      when: 'after the mounted navigation click and 15s bounded wait',
      impact: 'the capture cannot prove the requested Manage section',
      remedy: 'verify the exact feature preview, selected app, and production section label; update the capture only for a deliberate UI contract change',
      expected: `an active button with exact text ${JSON.stringify(itemLabel)} in ${JSON.stringify(navLabel)}`,
      observed,
    }))
  }
}

const clickNavItem = async (navLabel, itemLabel) => {
  await clickExactText(`#inuse-stage nav[aria-label="${navLabel}"] button.iu-subnav-item`, itemLabel)
  await waitForNavActive(navLabel, itemLabel)
}

const waitForApp = async (app, navLabel) => {
  try {
    await page.waitForFunction(({ app, navLabel }) => document.querySelector(`#iu-tab-${app}`)?.getAttribute('aria-selected') === 'true' && document.querySelector('#inuse-stage')?.getAttribute('aria-labelledby') === `iu-tab-${app}` && Boolean(document.querySelector(`#inuse-stage nav[aria-label="${navLabel}"]`)), { timeout: 15000 }, { app, navLabel })
  } catch {
    const observed = await page.evaluate(({ app, navLabel }) => ({
      selectedTab: document.querySelector(`#iu-tab-${app}`)?.getAttribute('aria-selected') ?? null,
      stageLabelledBy: document.querySelector('#inuse-stage')?.getAttribute('aria-labelledby') ?? null,
      navPresent: Boolean(document.querySelector(`#inuse-stage nav[aria-label="${navLabel}"]`)),
    }), { app, navLabel })
    throw new Error(actionableMessage({
      what: `app ${JSON.stringify(app)} did not settle with the expected shell`,
      why: 'the mounted app transition must select the requested app and publish its section navigation before capture',
      where: 'shootmanage.mjs waitForApp',
      when: 'after app navigation and a 15s bounded wait',
      impact: 'later section and target assertions would inspect the wrong or incomplete app',
      remedy: 'verify the exact feature preview, app tab, stage label, and production navigation label',
      expected: { app, navLabel, ariaSelected: 'true', stageLabelledBy: `iu-tab-${app}`, navPresent: true },
      observed,
    }))
  }
}

const assertFullShell = async ({ app, section, targetSelector, targetText, bodySelector, requireAriaCurrent = false }) => {
  const result = await page.evaluate(({ app, section, targetSelector, targetText, bodySelector, requireAriaCurrent }) => {
    const visible = (element) => {
      if (!element) return false
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0
    }
    const intersects = (left, right) => left && right && left.bottom > right.top && left.top < right.bottom && left.right > right.left && left.left < right.right
    const root = document.querySelector('#inuse')
    const bar = document.querySelector('.iu-bar')
    const stage = document.querySelector('#inuse-stage')
    const tablist = document.querySelector('[role="tablist"][aria-label="apps"]')
    const tabs = ['iu-tab-transcript', 'iu-tab-commons', 'iu-tab-graph'].map((id) => document.getElementById(id))
    const selectedTabs = tabs.filter((tab) => tab?.getAttribute('aria-selected') === 'true')
    const navLabel = app === 'graph' ? 'peasant sections' : 'village sections'
    const nav = document.querySelector(`#inuse-stage nav[aria-label="${navLabel}"]`)
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
      selectedApp: selectedTabs[0]?.id === `iu-tab-${app}` ? app : selectedTabs[0]?.id ?? null,
      stageLabelledBy: stage?.getAttribute('aria-labelledby') ?? null,
      sectionLabels: sectionButtons.map((button) => button.textContent.trim()),
      activeSectionCount: activeSections.length,
      activeSection: activeSections[0]?.textContent.trim() ?? null,
      ariaCurrent: activeSections[0]?.getAttribute('aria-current') ?? null,
      targetVisible: visible(target),
      targetIntersectsShell: intersects(targetBox, rootBox),
      bodyVisible: visible(body),
      bodyIntersectsShell: intersects(bodyBox, rootBox),
    }
  }, { app, section, targetSelector, targetText, bodySelector, requireAriaCurrent })
  // the home-first registries: peasant shows home and settings (analytics, changes and code map open by
  // route), village shows home and collectives with the account link at the end of its nav
  const expectedSections = app === 'graph' ? ['home', 'settings'] : ['home', 'collectives', '@alice-dev']
  const shellMessage = (property, expected, observed) => actionableMessage({
    what: `${app}/${section} full-shell ${property} is invalid`,
    why: 'the capture must prove the mounted app chrome and target body before saving a production-path image',
    where: 'shootmanage.mjs assertFullShell',
    when: 'after real navigation and immediately before screenshot capture',
    impact: `the ${app}/${section} image cannot prove the complete mounted shell`,
    remedy: 'verify the exact feature preview, selected app, section navigation, and target state; recapture after the production shell settles',
    expected,
    observed,
  })
  assert.equal(result.rootVisible, true, shellMessage('root visibility', true, result.rootVisible))
  assert.equal(result.barVisible, true, shellMessage('banner visibility', true, result.barVisible))
  assert.equal(result.stageVisible, true, shellMessage('stage visibility', true, result.stageVisible))
  assert.equal(result.tablistVisible, true, shellMessage('app tablist visibility', true, result.tablistVisible))
  assert.equal(result.tabsMounted, true, shellMessage('three app tabs mounted and visible', true, result.tabsMounted))
  assert.equal(result.selectedCount, 1, shellMessage('selected app count', 1, result.selectedCount))
  assert.equal(result.selectedApp, app, shellMessage('selected app identity', app, result.selectedApp))
  assert.equal(result.stageLabelledBy, `iu-tab-${app}`, shellMessage('stage aria-labelledby', `iu-tab-${app}`, result.stageLabelledBy))
  assert.deepEqual(result.sectionLabels, expectedSections, shellMessage('section navigation labels', expectedSections, result.sectionLabels))
  assert.equal(result.activeSectionCount, 1, shellMessage('active owning section count', 1, result.activeSectionCount))
  assert.equal(result.activeSection, section, shellMessage('active owning section', section, result.activeSection))
  if (requireAriaCurrent) assert.equal(result.ariaCurrent, 'page', shellMessage('top-level aria-current', 'page', result.ariaCurrent))
  assert.equal(result.targetVisible, true, shellMessage('target visibility', true, result.targetVisible))
  assert.equal(result.targetIntersectsShell, true, shellMessage('target intersection with shell', true, result.targetIntersectsShell))
  assert.equal(result.bodyVisible, true, shellMessage('representative body visibility', true, result.bodyVisible))
  assert.equal(result.bodyIntersectsShell, true, shellMessage('representative body intersection with shell', true, result.bodyIntersectsShell))
}

const shot = async (name, shell) => {
  if (shell) await assertFullShell(shell)
  const root = await waitFor('#inuse')
  const box = await root.boundingBox()
  if (!box || box.width < 4 || box.height < 4) throw new Error(`ERROR [shootmanage.mjs] #inuse blank/zero-size for ${name}: ${JSON.stringify(box)}; where: ${name} capture; how to fix: verify the mounted shell before capture.`)
  const shotPath = `${out}/${name}.png`
  await root.screenshot({ path: shotPath, captureBeyondViewport: false })
  const result = await gate.assert(name, shotPath, { sel: '#inuse', where: 'shootmanage.mjs' })
  console.log('shot', name.padEnd(24), `${Math.round(box.width)}x${Math.round(box.height)}`.padEnd(11), `nonbg=${(result.nonbgRatio * 100).toFixed(1)}% colors=${result.distinctColors}`)
}

const prove = async () => {
  await assertServedBuildProvenance({ mode: 'feature', origin: url, distRoot: DIST_ROOT, observedJavaScriptPaths: [...observer.paths], observedForeignOrigins: [...observer.foreignOrigins], marker: 'crumb-item-chrome', base: featureIdentity.base, expectedHead: featureIdentity.expectedHead, expectedBranch: featureIdentity.expectedBranch })
}

const gotoApp = async (app, navLabel, query = '') => {
  await page.goto(`${url}&app=${app}${query}`, { waitUntil: 'networkidle0' })
  await waitForApp(app, navLabel)
}

const openCollective = async (purpose) => {
  await gotoApp('commons', 'village sections')
  await clickNavItem('village sections', 'collectives')
  await page.waitForSelector('.cmg-table-link', { timeout: 15000 })
  const link = await page.evaluateHandle(() => [...document.querySelectorAll('.cmg-table-link')].find((candidate) => candidate.textContent.trim() === 'Acme Platform') ?? null)
  const linkElement = link.asElement()
  assert.ok(linkElement, actionableMessage({
    what: `exact Acme Platform collective link is missing for the ${purpose} capture`,
    why: 'the capture must follow the production link a user clicks in the collectives table',
    where: `shootmanage.mjs ${purpose} capture`,
    when: 'after the collectives section is active',
    impact: 'the requested collective surface cannot be captured from the production shell',
    remedy: 'verify the exact feature preview and update the capture only if the production collective fixture changed',
    expected: 'a visible .cmg-table-link with exact text Acme Platform',
    observed: 'no matching .cmg-table-link was mounted',
  }))
  await linkElement.click()
  await page.waitForSelector('.cmg-policies', { timeout: 15000 })
}

try {
  // changes is route-only in the home-first registry, so the session destination is reached by route
  await gotoApp('graph', 'peasant sections', '&section=changes')
  await page.waitForSelector('.cg-history-row[data-commit-hash="c1d4a3"] .tlp-overflow-toggle', { timeout: 15000 })
  await page.click('.cg-history-row[data-commit-hash="c1d4a3"] .tlp-overflow-toggle')
  await page.waitForFunction(() => [...document.querySelectorAll('.cg-history-row[data-commit-hash="c1d4a3"] .tlp-overflow-item')].some((item) => item.textContent.trim() === 'Verify map session links'), { timeout: 15000 })
  await clickExactText('.cg-history-row[data-commit-hash="c1d4a3"] .tlp-overflow-item', 'Verify map session links')
  await page.waitForSelector('#gmp-session-destination-title', { timeout: 15000 })
  await shot('graph-session-heading', { app: 'graph', section: 'home', targetSelector: '#gmp-session-destination-title', targetText: 'Verify map session links', bodySelector: '.gmp-session-destination' })

  await gotoApp('commons', 'village sections')
  await page.waitForSelector('.cmg-home', { timeout: 15000 })
  await shot('village-home', { app: 'commons', section: 'home', targetSelector: 'h2.iu-page-title', targetText: 'your transcripts', bodySelector: '.cmg-home', requireAriaCurrent: true })

  await clickNavItem('village sections', 'collectives')
  await page.waitForSelector('.cmg-table-link', { timeout: 15000 })
  await shot('manage-collectives', { app: 'commons', section: 'collectives', targetSelector: 'h2.iu-page-title', targetText: 'collectives', bodySelector: '.iu-page', requireAriaCurrent: true })

  await openCollective('detail')
  await shot('manage-detail', { app: 'commons', section: 'collectives', targetSelector: 'h2.iu-page-title', targetText: 'Acme Platform', bodySelector: '.cmg-policies' })

  // the publishing dashboard left the nav but keeps its route
  await gotoApp('commons', 'village sections', '&commons=publish')
  await page.waitForFunction(() => [...document.querySelectorAll('h2.cmg-title')].some((heading) => heading.textContent.trim() === 'publishing dashboard'), { timeout: 15000 })
  await shot('manage-publish', { app: 'commons', section: 'home', targetSelector: 'h2.cmg-title', targetText: 'publishing dashboard', bodySelector: '.cmg-page' })

  // bulk contribute moved into the collective's overflow menu
  await openCollective('contribute')
  await page.click('.cmg-actions .menu-trigger')
  await clickExactText('[role="menuitem"]', 'publish several transcripts')
  await page.waitForSelector('.cmg-contribute', { timeout: 15000 })
  await shot('manage-contribute', { app: 'commons', section: 'collectives', targetSelector: 'h2.cmg-title', targetText: 'contribute to AI Research Team', bodySelector: '.cmg-page' })

  await openCollective('settings')
  await clickExactText('.cmg-actions button', 'settings')
  await page.waitForSelector('.cmg-settings', { timeout: 15000 })
  {
    const stageHeight = await page.evaluate(() => {
      const stage = document.querySelector('.iu-stage')
      const bar = document.querySelector('.iu-bar')
      return Math.ceil((stage?.scrollHeight ?? 0) + (bar?.getBoundingClientRect().height ?? 0)) + 24
    })
    await page.setViewport({ width: 1460, height: Math.max(stageHeight, 1000), deviceScaleFactor: 1 })
    try {
      await pause(200)
      const stillScrolls = await page.evaluate(() => {
        const stage = document.querySelector('.iu-stage')
        return {
          needsScroll: stage ? stage.scrollHeight > stage.clientHeight + 2 : true,
          scrollHeight: stage?.scrollHeight ?? null,
          clientHeight: stage?.clientHeight ?? null,
        }
      })
      if (stillScrolls.needsScroll) {
        throw new Error(actionableMessage({
          what: 'manage-settings still needs internal scrolling after viewport growth',
          why: 'the settings capture must include the full mounted #inuse surface, including the lower DangerZone controls',
          where: 'shootmanage.mjs full-height manage-settings capture',
          when: 'after the computed stage height, viewport resize, and 200ms settle',
          impact: 'the saved settings image would omit below-fold production content and could falsely pass a clipped-viewport gate',
          remedy: 're-check the .iu-stage scrollHeight computation for another vh-based ancestor; do not capture or accept a clipped settings image',
          expected: { needsScroll: false, viewportHeight: Math.max(stageHeight, 1000), stageHeight },
          observed: stillScrolls,
        }))
      }
      await shot('manage-settings')
    } finally {
      await page.setViewport({ width: 1460, height: 1000, deviceScaleFactor: 1 })
    }
  }

  await prove()
  console.log('console errors:', errs.length ? errs.slice(0, 5) : 'none')
} finally {
  observer.stop()
  await browser.close()
  await new Promise((resolveClose, rejectClose) => server.httpServer.close((error) => error ? rejectClose(error) : resolveClose()))
}

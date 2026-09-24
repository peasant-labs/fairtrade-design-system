/* Screenshot the mounted in-use Manage surfaces from the fairtrade shell.
 *
 * usage: CHROME_PATH=/path/to/chrome node scripts/shootmanage.mjs <theme> <outdir>
 *      theme  = dark | light
 *      outdir = directory to write manage-*.png into
 *
 * The existing live-compositor SurfaceGate is used for every image. Navigation
 * follows the same mounted controls as the product: app tabs, section tabs,
 * collective cards, role controls, and action buttons. */
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'
import { mkdirSync, existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { SurfaceGate } from './surface-gate.mjs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const theme = process.argv[2] || 'dark'
const out = process.argv[3] || `/tmp/manage-${theme}`
const PORT = Number(process.env.DEMO_PORT) || 5180

mkdirSync(out, { recursive: true })

if (!existsSync(CHROME)) {
  console.error(`ERROR [shootmanage.mjs] Chrome binary not found at: ${CHROME}`)
  process.exit(1)
}

const probePort = (host) => new Promise((resolve) => {
  const socket = createConnection({ port: PORT, host })
  socket.on('connect', () => { socket.destroy(); resolve(true) })
  socket.on('error', () => resolve(false))
})
if (!(await probePort('localhost')) && !(await probePort('::1')) && !(await probePort('127.0.0.1'))) {
  console.error(`ERROR [shootmanage.mjs] Demo server is not listening on port ${PORT}. Start the exact feature build or canonical demo first.`)
  process.exit(1)
}

const baseUrl = `http://localhost:${PORT}/?fb=off${theme === 'light' ? '&theme=light' : ''}`
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1460, height: 1000, deviceScaleFactor: 1 } })
const page = await browser.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
const errs = []
page.on('console', (message) => { if (message.type() === 'error' && !/favicon/.test(message.text())) errs.push(message.text()) })
page.on('pageerror', (error) => errs.push('pageerr: ' + error.message))

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const gate = new SurfaceGate(page)
const waitFor = async (selector, timeoutMs = 8000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const element = await page.$(selector)
    if (element) return element
    await pause(80)
  }
  throw new Error(`ERROR [shootmanage.mjs] selector ${selector} never mounted within ${timeoutMs}ms; where: Manage capture navigation; how to fix: verify the exact feature build serves the expected in-use shell.`)
}

const clickExactText = async (selector, text) => {
  const handle = await page.evaluateHandle(({ selector, text }) => [...document.querySelectorAll(selector)].find((element) => element.textContent.trim() === text) ?? null, { selector, text })
  const element = handle.asElement()
  assert.ok(element, `ERROR [shootmanage.mjs] mounted control ${JSON.stringify(`${selector} > ${text}`)} is missing; where: Manage capture navigation; how to fix: update the capture only if the production control label changed.`)
  await element.click()
}

const clickNavItem = async (navLabel, itemLabel) => {
  await clickExactText(`#inuse-stage nav[aria-label="${navLabel}"] button.iu-subnav-item`, itemLabel)
  await page.waitForFunction(({ navLabel, itemLabel }) => [...document.querySelectorAll(`#inuse-stage nav[aria-label="${navLabel}"] button.iu-subnav-item`)].some((button) => button.textContent.trim() === itemLabel && button.classList.contains('active')), { timeout: 15000 }, { navLabel, itemLabel })
}

const waitForApp = async (app, navLabel) => {
  await page.waitForFunction(({ app, navLabel }) => document.querySelector(`#iu-tab-${app}`)?.getAttribute('aria-selected') === 'true' && document.querySelector('#inuse-stage')?.getAttribute('aria-labelledby') === `iu-tab-${app}` && Boolean(document.querySelector(`#inuse-stage nav[aria-label="${navLabel}"]`)), { timeout: 15000 }, { app, navLabel })
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
  const expectedSections = app === 'graph' ? ['analytics', 'changes', 'code map'] : ['explore', 'collectives', 'publish', 'profile']
  assert.equal(result.rootVisible, true, `ERROR [shootmanage.mjs] ${app}/${section} capture has no visible #inuse root`)
  assert.equal(result.barVisible, true, `ERROR [shootmanage.mjs] ${app}/${section} capture has no visible .iu-bar`)
  assert.equal(result.stageVisible, true, `ERROR [shootmanage.mjs] ${app}/${section} capture has no visible #inuse-stage`)
  assert.equal(result.tablistVisible, true, `ERROR [shootmanage.mjs] ${app}/${section} capture has no visible app tablist`)
  assert.equal(result.tabsMounted, true, `ERROR [shootmanage.mjs] ${app}/${section} capture is missing one of the three app tabs`)
  assert.equal(result.selectedCount, 1, `ERROR [shootmanage.mjs] ${app}/${section} capture must have exactly one selected app`)
  assert.equal(result.selectedApp, app, `ERROR [shootmanage.mjs] ${app}/${section} capture selected the wrong app`)
  assert.equal(result.stageLabelledBy, `iu-tab-${app}`, `ERROR [shootmanage.mjs] ${app}/${section} stage aria-labelledby is wrong`)
  assert.deepEqual(result.sectionLabels, expectedSections, `ERROR [shootmanage.mjs] ${app}/${section} section navigation labels are wrong`)
  assert.equal(result.activeSectionCount, 1, `ERROR [shootmanage.mjs] ${app}/${section} must have exactly one active section`)
  assert.equal(result.activeSection, section, `ERROR [shootmanage.mjs] ${app}/${section} active section is wrong`)
  if (requireAriaCurrent) assert.equal(result.ariaCurrent, 'page', `ERROR [shootmanage.mjs] ${app}/${section} top-level section lacks aria-current=page`)
  assert.equal(result.targetVisible, true, `ERROR [shootmanage.mjs] ${app}/${section} target heading is not visible`)
  assert.equal(result.targetIntersectsShell, true, `ERROR [shootmanage.mjs] ${app}/${section} target heading does not intersect the shell`)
  assert.equal(result.bodyVisible, true, `ERROR [shootmanage.mjs] ${app}/${section} representative body is not visible`)
  assert.equal(result.bodyIntersectsShell, true, `ERROR [shootmanage.mjs] ${app}/${section} representative body does not intersect the shell`)
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

const gotoApp = async (app, navLabel) => {
  await page.goto(`${baseUrl}&app=${app}`, { waitUntil: 'networkidle0' })
  await waitForApp(app, navLabel)
}

try {
  await gotoApp('graph', 'peasant sections')
  await clickNavItem('peasant sections', 'changes')
  await page.waitForSelector('.cg-history-row[data-commit-hash="c1d4a3"] .tlp-overflow-toggle', { timeout: 15000 })
  await page.click('.cg-history-row[data-commit-hash="c1d4a3"] .tlp-overflow-toggle')
  await page.waitForFunction(() => [...document.querySelectorAll('.cg-history-row[data-commit-hash="c1d4a3"] .tlp-overflow-item')].some((item) => item.textContent.trim() === 'Verify map session links'), { timeout: 15000 })
  await clickExactText('.cg-history-row[data-commit-hash="c1d4a3"] .tlp-overflow-item', 'Verify map session links')
  await page.waitForSelector('#gmp-session-destination-title', { timeout: 15000 })
  await shot('graph-session-heading', { app: 'graph', section: 'changes', targetSelector: '#gmp-session-destination-title', targetText: 'Verify map session links', bodySelector: '.gmp-session-destination' })

  await gotoApp('commons', 'village sections')
  await clickNavItem('village sections', 'collectives')
  await page.waitForSelector('.cmg-col-card', { timeout: 15000 })
  await shot('manage-collectives', { app: 'commons', section: 'collectives', targetSelector: 'h2.cmg-title', targetText: 'collectives', bodySelector: '.cmg-grid' })

  const collectiveCard = await page.evaluateHandle(() => [...document.querySelectorAll('.cmg-col-card')].find((card) => [...card.querySelectorAll('.cmg-col-name')].some((name) => name.textContent.trim() === 'AI Research Team')) ?? null)
  const collectiveCardElement = collectiveCard.asElement()
  assert.ok(collectiveCardElement, 'ERROR [shootmanage.mjs] exact AI Research Team card is missing; where: Manage detail capture; how to fix: update the capture only if the production collective fixture changed.')
  await collectiveCardElement.click()
  await page.waitForSelector('.cmg-detail', { timeout: 15000 })
  await shot('manage-detail', { app: 'commons', section: 'collectives', targetSelector: 'h2.cmg-title', targetText: 'AI Research Team', bodySelector: '.cmg-detail' })

  await page.click('#iu-tab-commons')
  await waitForApp('commons', 'village sections')
  await clickNavItem('village sections', 'publish')
  await page.waitForFunction(() => [...document.querySelectorAll('h2.cmg-title')].some((heading) => heading.textContent.trim() === 'publishing dashboard'), { timeout: 15000 })
  await shot('manage-publish', { app: 'commons', section: 'publish', targetSelector: 'h2.cmg-title', targetText: 'publishing dashboard', bodySelector: '.cmg-page', requireAriaCurrent: true })

  await gotoApp('commons', 'village sections')
  await clickNavItem('village sections', 'collectives')
  await page.waitForSelector('.cmg-col-card', { timeout: 15000 })
  const contributeCard = await page.evaluateHandle(() => [...document.querySelectorAll('.cmg-col-card')].find((card) => [...card.querySelectorAll('.cmg-col-name')].some((name) => name.textContent.trim() === 'AI Research Team')) ?? null)
  const contributeCardElement = contributeCard.asElement()
  assert.ok(contributeCardElement, 'ERROR [shootmanage.mjs] exact AI Research Team card is missing for contribute capture')
  await contributeCardElement.click()
  await page.waitForSelector('.cmg-detail', { timeout: 15000 })
  await clickExactText('.cmg-roleseg', 'contributor')
  await page.waitForFunction(() => [...document.querySelectorAll('.cmg-roleseg')].find((button) => button.textContent.trim() === 'contributor')?.getAttribute('aria-pressed') === 'true', { timeout: 15000 })
  await clickExactText('.cmg-d-actions button', 'contribute')
  await page.waitForSelector('.cmg-contribute', { timeout: 15000 })
  await shot('manage-contribute', { app: 'commons', section: 'collectives', targetSelector: 'h2.cmg-title', targetText: 'contribute to AI Research Team', bodySelector: '.cmg-page' })

  await gotoApp('commons', 'village sections')
  await clickNavItem('village sections', 'collectives')
  await page.waitForSelector('.cmg-col-card', { timeout: 15000 })
  const settingsCard = await page.evaluateHandle(() => [...document.querySelectorAll('.cmg-col-card')].find((card) => [...card.querySelectorAll('.cmg-col-name')].some((name) => name.textContent.trim() === 'AI Research Team')) ?? null)
  const settingsCardElement = settingsCard.asElement()
  assert.ok(settingsCardElement, 'ERROR [shootmanage.mjs] exact AI Research Team card is missing for settings capture')
  await settingsCardElement.click()
  await page.waitForSelector('.cmg-detail', { timeout: 15000 })
  await clickExactText('.cmg-d-actions button', 'settings')
  await page.waitForSelector('.cmg-settings', { timeout: 15000 })
  await page.setViewport({ width: 1460, height: 1000, deviceScaleFactor: 1 })
  await shot('manage-settings')

  console.log('console errors:', errs.length ? errs.slice(0, 5) : 'none')
} finally {
  await browser.close()
}

/* Screenshot the in-use Commons Manage surfaces from the exact production dist.
   Start the built app through Vite preview so the feature capture has the same
   served bytes as the mounted gate. */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import { SurfaceGate } from './surface-gate.mjs'
import { assertServedBuildProvenance, observeServedBuildAssets } from './served-build-provenance.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()) })
page.on('pageerror', (e) => errs.push('pageerr: ' + e.message))

const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const gate = new SurfaceGate(page)
const waitFor = async (sel, timeoutMs = 8000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const el = await page.$(sel)
    if (el) return el
    await pause(80)
  }
  throw new Error(`selector ${sel} never mounted`)
}
const shot = async (name, sel) => {
  const el = await waitFor(sel)
  const box = await el.boundingBox()
  if (!box || box.width < 4 || box.height < 4) throw new Error(`${sel} blank/zero-size: ${JSON.stringify(box)}`)
  await el.screenshot({ path: `${out}/${name}.png`, captureBeyondViewport: false })
  const result = await gate.assert(name, `${out}/${name}.png`, { sel, where: 'shootmanage.mjs' })
  console.log('shot', name.padEnd(20), `${Math.round(box.width)}x${Math.round(box.height)}`.padEnd(11), `nonbg=${(result.nonbgRatio * 100).toFixed(1)}% colors=${result.distinctColors}`)
}
const clickText = async (selector, text) => {
  const clicked = await page.evaluate(({ selector, text }) => {
    const element = [...document.querySelectorAll(selector)].find((candidate) => candidate.textContent.trim() === text || candidate.textContent.includes(text))
    element?.click()
    return Boolean(element)
  }, { selector, text })
  if (!clicked) throw new Error(`ERROR [shootmanage.mjs] control path did not find ${text} in ${selector}`)
}
const prove = async () => {
  observer.stop()
  await assertServedBuildProvenance({ mode: 'feature', origin: url, distRoot: DIST_ROOT, observedJavaScriptPaths: [...observer.paths], observedForeignOrigins: [...observer.foreignOrigins], marker: 'crumb-item-chrome', base: process.env.BREADCRUMB_BASE, expectedHead: process.env.BREADCRUMB_HEAD, expectedBranch: process.env.BREADCRUMB_BRANCH })
}
const gotoCommons = async (search = '') => {
  await page.goto(`${url}${search}`, { waitUntil: 'networkidle0' })
  await pause(800)
}

try {
  // Preserve the established query-driven collectives-list capture lifecycle.
  await gotoCommons('&app=commons&commons=collectives')
  await waitFor('#inuse-stage .cmg-root', 8000)
  await shot('manage-collectives', '#inuse')

  // Only manage-detail uses the real in-use control path to reach the public Breadcrumb.
  await gotoCommons('')
  await clickText('[role="tab"]', 'village')
  await waitFor('#inuse-stage .iu-subnav')
  await clickText('#inuse-stage .iu-subnav-item', 'collectives')
  await waitFor('#inuse-stage .cmg-grid')
  await clickText('#inuse-stage .cmg-col-card', 'AI Research Team')
  await waitFor('#inuse-stage .cmg-detail')
  await prove()
  await shot('manage-detail', '#inuse')

  await gotoCommons('&app=commons&commons=collective-settings')
  await waitFor('.cmg-settings', 8000)
  // Full-height settings evidence remains intentionally separate from the other captures.
  {
    const stageHeight = await page.evaluate(() => {
      const stage = document.querySelector('.iu-stage')
      const bar = document.querySelector('.iu-bar')
      return Math.ceil((stage?.scrollHeight ?? 0) + (bar?.getBoundingClientRect().height ?? 0)) + 24
    })
    await page.setViewport({ width: 1460, height: Math.max(stageHeight, 1000), deviceScaleFactor: 1 })
    await pause(200)
    const stillScrolls = await page.evaluate(() => {
      const stage = document.querySelector('.iu-stage')
      return stage ? stage.scrollHeight > stage.clientHeight + 2 : true
    })
    if (stillScrolls) throw new Error(`ERROR [shootmanage.mjs] manage-settings still needs internal scroll after resizing the viewport to ${stageHeight}px; where: shootmanage.mjs full-height manage-settings capture; fix: re-check .iu-stage scrollHeight and vh-based layout.`)
    await shot('manage-settings', '#inuse')
    await page.setViewport({ width: 1460, height: 1000, deviceScaleFactor: 1 })
  }

  console.log('console errors:', errs.length ? errs.slice(0, 5) : 'none')
} finally {
  observer.stop()
  await browser.close()
  await new Promise((resolveClose, rejectClose) => server.httpServer.close((error) => error ? rejectClose(error) : resolveClose()))
}

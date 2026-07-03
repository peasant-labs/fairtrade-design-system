/* Screenshot the in-use commons Manage demo: capture the collectives list, collective detail, and
   collective settings surfaces from the fairtrade in-use shell so the village app can be compared
   against the same demo.

   usage: CHROME_PATH=/path/to/chrome node scripts/shootmanage.mjs <theme> <outdir>
     theme  = dark | light
     outdir = directory to write manage-*.png into
*/
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
  const s = createConnection({ port: PORT, host })
  s.on('connect', () => { s.destroy(); resolve(true) })
  s.on('error', () => resolve(false))
})
if (!(await probePort('localhost')) && !(await probePort('::1')) && !(await probePort('127.0.0.1'))) {
  console.error(`ERROR [shootmanage.mjs] Demo server is not listening on port ${PORT}. Start pnpm dev first.`)
  process.exit(1)
}

const url = `http://localhost:${PORT}/?fb=off${theme === 'light' ? '&theme=light' : ''}`
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1460, height: 1000, deviceScaleFactor: 1 } })
const page = await browser.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
const errs = []
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()) })
page.on('pageerror', (e) => errs.push('pageerr: ' + e.message))
await page.goto(url, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 800))

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
  const r = await gate.assert(name, `${out}/${name}.png`, { sel, where: 'shootmanage.mjs' })
  console.log('shot', name.padEnd(20), `${Math.round(box.width)}x${Math.round(box.height)}`.padEnd(11), `nonbg=${(r.nonbgRatio * 100).toFixed(1)}% colors=${r.distinctColors}`)
}

const gotoCommons = async (search) => {
  await page.goto(`${url}${search}`, { waitUntil: 'networkidle0' })
  await pause(1500)
}

await gotoCommons('&app=commons&commons=collectives')
await waitFor('.cmg-root', 8000)
await shot('manage-collectives', '#inuse')
await gotoCommons('&app=commons&commons=collective-detail')
await waitFor('.cmg-detail', 8000)
await shot('manage-detail', '#inuse')
await gotoCommons('&app=commons&commons=collective-settings')
await waitFor('.cmg-settings', 8000)
// full height: .iu-stage is a FIXED-height (100vh), internally-scrolling container, so a normal
// element/viewport screenshot never included the DangerZone sitting below the settings form's
// fold (M12: "danger zone is below-fold in the current capture"). Rather than override the CSS
// (tried first -- it broke the .iu-screen{height:100%} flex chain and rendered blank), grow the
// puppeteer VIEWPORT to the stage's actual scrollHeight so 100vh resolves tall enough that the
// internal scroller needs no scrolling at all, then shoot the now-fully-visible element normally.
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
  if (stillScrolls) {
    throw new Error(
      `ERROR [shootmanage.mjs] manage-settings still needs internal scroll after resizing the viewport to ${stageHeight}px.\n` +
      `  Where: shootmanage.mjs full-height manage-settings capture.\n` +
      `  Fix: re-check .iu-stage's scrollHeight computation -- something else may also be vh-based and growing along with the viewport.`
    )
  }
  await shot('manage-settings', '#inuse')
  await page.setViewport({ width: 1460, height: 1000, deviceScaleFactor: 1 })
}

console.log('console errors:', errs.length ? errs.slice(0, 5) : 'none')
await browser.close()

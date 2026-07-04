/* check-map-pointer — REAL-input gate for the map canvas zoom cluster.
 *
 * The canvas pans by capturing pointerdown on the viewport. If that capture
 * doesn't exclude pointers born on interactive controls, setPointerCapture
 * retargets the following pointerup to the viewport and the browser composes
 * NO click on the control — the zoom buttons render, style, and wire
 * correctly yet never fire. Storybook play() tests CANNOT catch this class:
 * user-event dispatches synthetic events that skip pointer-capture
 * retargeting, so only a genuine mouse (CDP) reproduces it. This gate drives
 * the built MapCanvas story with puppeteer's real mouse and asserts the
 * stage transform actually changes.
 *
 * Env: CHROME_PATH (required) — the Chrome binary to drive.
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'storybook-static')
const STORY = 'in-use-mapcanvas--default'
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
}

if (!existsSync(join(DIR, 'iframe.html'))) {
  console.error('check-map-pointer: storybook-static missing — run storybook:build first')
  process.exit(1)
}
const CHROME = process.env.CHROME_PATH
if (!CHROME) {
  console.error('check-map-pointer: CHROME_PATH is required')
  process.exit(1)
}

const server = createServer((req, res) => {
  const path = join(DIR, req.url.split('?')[0].replace(/^\//, '') || 'index.html')
  if (!existsSync(path)) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' })
  res.end(readFileSync(path))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', defaultViewport: { width: 1400, height: 900 },
})
let failed = false
try {
  const page = await browser.newPage()
  await page.goto(
    `http://127.0.0.1:${server.address().port}/iframe.html?id=${STORY}&viewMode=story`,
    { waitUntil: 'domcontentloaded', timeout: 30000 },
  )
  await page.waitForSelector('.mc-zoom-btn', { timeout: 20000 })
  const stageTransform = () =>
    page.evaluate(() => getComputedStyle(document.querySelector('.mc-stage')).transform)

  const before = await stageTransform()
  const box = await (await page.$('.mc-zoom-btn')).boundingBox()
  // a REAL mouse click — hit-testing + pointer capture semantics included
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await new Promise((r) => setTimeout(r, 500))
  const after = await stageTransform()

  if (before === after) {
    console.error(
      `check-map-pointer: FAIL — real mouse click on the zoom control did not change the stage transform (${before}). ` +
      'The viewport pan handler is likely capturing pointers born on controls again.',
    )
    failed = true
  } else {
    console.log(`map-pointer gate: zoom control responds to a real mouse click (${before} → ${after}).`)
  }
} finally {
  await browser.close()
  server.close()
}
process.exit(failed ? 1 : 0)

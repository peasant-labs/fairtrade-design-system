/* storybook render + play smoke: serve storybook-static, load every story's iframe (which auto-runs
   its play() function), and report any story that logs a console/page error. usage: node scripts/sbsmoke.mjs */
import puppeteer from 'puppeteer-core'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = 'storybook-static'
const PORT = 6017
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.mp4':'video/mp4', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf' }
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'
    const fp = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''))
    if (!existsSync(fp)) { res.writeHead(404); return res.end('nf') }
    const buf = await readFile(fp)
    res.writeHead(200, { 'content-type': MIME[extname(fp)] || 'application/octet-stream' })
    res.end(buf)
  } catch { res.writeHead(500); res.end('err') }
})
await new Promise((r) => server.listen(PORT, r))

const idx = JSON.parse(await readFile(join(ROOT, 'index.json'), 'utf8'))
const ids = Object.values(idx.entries || idx.stories || {}).filter((e) => e.type !== 'docs').map((e) => e.id)
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 900, height: 700 } })
const bad = []
const noise = []
let n = 0
for (const id of ids) {
  const page = await browser.newPage()
  const errs = []
  const res404 = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('requestfailed', (r) => res404.push(r.url().split('/').pop() + ' (' + (r.failure()?.errorText || 'failed') + ')'))
  page.on('response', (r) => { if (r.status() === 404) res404.push(r.url().split('/').pop() + ' (404)') })
  try {
    // domcontentloaded (not networkidle0): stories whose play() drives heavy re-renders
    // (e.g. the TanStack DataTable sort/select interactions) never settle to network-idle even
    // with 0 in-flight requests, so networkidle0 false-times-out. errors are caught by the
    // console/pageerror listeners regardless of the wait strategy; the settle delay lets play() run.
    await page.goto(`http://localhost:${PORT}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise((r) => setTimeout(r, 1200)) // let fonts paint + play() run
    const rootEmpty = await page.evaluate(() => { const r = document.querySelector('#storybook-root,#root'); return !r || r.childElementCount === 0 })
    // real failures = JS / assertion errors (play() throws are logged here); resource 404s are reported
    // separately (deliberate broken-image fallback demos + framework noise are not test failures)
    const isResourceNoise = (t) => /Failed to load resource|ERR_NAME_NOT_RESOLVED|net::ERR|favicon|Download the React DevTools|preload/i.test(t)
    const real = errs.filter((t) => !isResourceNoise(t))
    if (real.length || rootEmpty) bad.push({ id, rootEmpty, errs: real.slice(0, 2) })
    if (res404.length) noise.push({ id, res: [...new Set(res404)].slice(0, 3) })
  } catch (e) { bad.push({ id, errs: ['goto: ' + e.message] }) }
  await page.close(); n++
}
await browser.close(); server.close()
console.log(`\nstorybook smoke: ${n} stories loaded, ${bad.length} with REAL errors, ${noise.length} with resource noise`)
for (const b of bad) console.log('  FAIL', b.id, b.rootEmpty ? '(empty root)' : '', JSON.stringify(b.errs))
for (const x of noise) console.log('  note', x.id, JSON.stringify(x.res))
process.exit(bad.length ? 1 : 0)

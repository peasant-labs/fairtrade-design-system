/* storybook screenshot QA: serve storybook-static and capture a PNG per story in one or both themes,
   tight-cropped to the rendered component so each crop is readable. usage:
     node scripts/sbshot.mjs [theme] [outdir] [filter...]
       theme  = dark | light | both        (default both)
       outdir = directory root under shots/ (default shots/sb)
       filter = substring(s) matched against the story id; omit for every story
   writes shots/<outdir>/<theme>/<id>.png and prints one line per shot. */
import puppeteer from 'puppeteer-core'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = 'storybook-static'
const PORT = 6018
const themeArg = (process.argv[2] || 'both').toLowerCase()
const outdir = process.argv[3] || 'shots/sb'
const filters = process.argv.slice(4)
const themes = themeArg === 'both' ? ['dark', 'light'] : [themeArg]
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
let ids = Object.values(idx.entries || idx.stories || {}).filter((e) => e.type !== 'docs').map((e) => e.id)
if (filters.length) ids = ids.filter((id) => filters.some((f) => id.includes(f.toLowerCase())))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1000, height: 760, deviceScaleFactor: 2 } })
for (const theme of themes) {
  const dir = join(outdir, theme)
  mkdirSync(dir, { recursive: true })
  const bg = theme === 'light' ? '#fbfaf7' : '#070706'
  for (const id of ids) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1000, height: 760, deviceScaleFactor: 2 })
    // reduced-motion so entrance transitions don't leave a component mid-fade
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    const url = `http://localhost:${PORT}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}&args=`
    try {
      // domcontentloaded (not networkidle0): interaction-heavy stories (e.g. the TanStack table)
      // never settle to network-idle even with 0 in-flight requests; the fixed delay covers paint + play().
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.evaluate((bg) => { document.documentElement.style.background = bg; document.body.style.background = bg }, bg)
      await new Promise((r) => setTimeout(r, 900))
      // crop = the union of #storybook-root and any OPEN overlay (dialog/menu/popover/tooltip/
      // calendar/listbox), which are position:fixed/absolute and sit OUTSIDE the root box. without
      // this an open dialog captures as a blank strip and a menu popout gets clipped.
      const box = await page.evaluate(() => {
        const sel = '#storybook-root,#root,[role="dialog"],[role="menu"],[role="listbox"],.menu-pop,.cp-panel,.dr-pop,.tip-bubble,.pop-panel,.tooltip'
        const els = [...document.querySelectorAll(sel)].filter((e) => {
          const r = e.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'
        })
        if (!els.length) return null
        let l = Infinity, t = Infinity, rt = -Infinity, bt = -Infinity
        for (const e of els) {
          const r = e.getBoundingClientRect()
          l = Math.min(l, r.left); t = Math.min(t, window.scrollY + r.top)
          rt = Math.max(rt, r.right); bt = Math.max(bt, window.scrollY + r.bottom)
        }
        const m = 16
        return {
          x: Math.max(0, Math.floor(l - m)),
          y: Math.max(0, Math.floor(t - m)),
          w: Math.max(8, Math.min(1400, Math.ceil(rt - l + m * 2))),
          h: Math.max(8, Math.min(3000, Math.ceil(bt - t + m * 2))),
        }
      })
      const ok = box && Number.isFinite(box.w) && Number.isFinite(box.h) && box.w > 8 && box.h > 8
      const clip = ok ? { clip: { x: box.x, y: box.y, width: box.w, height: box.h } } : {}
      await page.screenshot({ path: join(dir, id + '.png'), ...clip })
      console.log('shot', theme, id, box ? Math.round(box.h) + 'px' : '(full)')
    } catch (e) { console.log('FAIL', theme, id, e.message) }
    await page.close()
  }
}
await browser.close(); server.close()

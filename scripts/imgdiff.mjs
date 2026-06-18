/* precise pixel diff between two screenshot sets, with no extra deps.
   reads each baseline/after PNG in node, hands them to a headless page as data: URLs
   (data: images don't taint the canvas), draws both, and counts differing pixels.
   usage: node scripts/imgdiff.mjs <theme> [id1 id2 ...]
     compares shots/baseline-<theme>/<id>.png vs shots/after-<theme>/<id>.png */
import puppeteer from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SAVE = process.env.SAVE === '1'
const theme = process.argv[2] || 'dark'
const ids = process.argv.slice(3)
const BASE = process.env.BASE || `shots/baseline-${theme}`
const AFT = process.env.AFT || `shots/after-${theme}`
if (SAVE) mkdirSync(`shots/diff-${theme}`, { recursive: true })
const all = ids.length ? ids : ['color', 'typography', 'spacing', 'icons', 'controls', 'states', 'badges', 'trails', 'conversation', 'canvas', 'forms', 'overlays', 'a11y', 'tokens']
const TOL = 16 // per-channel tolerance to ignore sub-pixel AA shimmer

const dataUrl = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64')

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.goto('about:blank')

let worst = 0
for (const id of all) {
  const a = `${BASE}/${id}.png`
  const b = `${AFT}/${id}.png`
  if (!existsSync(a) || !existsSync(b)) { console.log(`SKIP  ${id} (missing png)`); continue }
  const r = await page.evaluate(
    async (au, bu, tol, save) => {
      const load = (u) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = u })
      const [ia, ib] = await Promise.all([load(au), load(bu)])
      if (ia.width !== ib.width || ia.height !== ib.height) return { dim: true, aw: ia.width, ah: ia.height, bw: ib.width, bh: ib.height }
      const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height
      const x = c.getContext('2d')
      x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data
      x.clearRect(0, 0, c.width, c.height)
      x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data
      let diff = 0, minY = 1e9, maxY = -1
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i] - db[i]) > tol || Math.abs(da[i + 1] - db[i + 1]) > tol || Math.abs(da[i + 2] - db[i + 2]) > tol) {
          diff++
          const y = (i / 4 / c.width) | 0
          if (y < minY) minY = y
          if (y > maxY) maxY = y
          if (save) { db[i] = 255; db[i + 1] = 0; db[i + 2] = 255; db[i + 3] = 255 }
        }
      }
      let url = null
      if (save) { x.putImageData(new ImageData(db, c.width, c.height), 0, 0); url = c.toDataURL('image/png') }
      return { dim: false, total: c.width * c.height, diff, minY: maxY < 0 ? 0 : minY, maxY, url }
    },
    dataUrl(a), dataUrl(b), TOL, SAVE
  )
  if (r.dim) { console.log(`DIM!  ${id}  baseline ${r.aw}x${r.ah}  after ${r.bw}x${r.bh}`); worst = 100; continue }
  const pct = (100 * r.diff) / r.total
  worst = Math.max(worst, pct)
  const tag = pct === 0 ? 'IDENTICAL' : pct < 0.05 ? 'ok~' : pct < 0.5 ? 'CHECK' : 'DIFF!'
  const yspan = r.maxY >= 0 ? `  y[${r.minY}..${r.maxY}]` : ''
  console.log(`${tag.padEnd(10)} ${id.padEnd(13)} ${pct.toFixed(4)}% (${r.diff}/${r.total})${yspan}`)
  if (SAVE && r.url) writeFileSync(`shots/diff-${theme}/${id}.png`, Buffer.from(r.url.split(',')[1], 'base64'))
}
console.log(`\nworst: ${worst.toFixed(4)}%`)
await browser.close()

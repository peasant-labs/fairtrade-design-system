/* focused screenshot tool for review QA. captures clipped crops of named sections (or the real hero)
   in a theme, so each crop is small enough to read directly.
   usage: node scripts/shoot.mjs <theme> <outdir> [id1 id2 ...]
     theme  = dark | light
     outdir = directory under shots/ to write into
     ids    = section ids to crop; "hero" captures #top with NO ?cap; default = a representative set */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const theme = process.argv[2] || 'dark'
const outdir = process.argv[3] || `shots/review-${theme}`
const ids = process.argv.slice(4)
const targets = ids.length ? ids : ['hero', 'intro', 'principles', 'voice', 'color', 'typography', 'spacing', 'icons', 'controls', 'states', 'forms', 'overlays', 'tokens']
mkdirSync(outdir, { recursive: true })

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 } })

for (const id of targets) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
  // reduced-motion disables the scroll-reveal (sections render visible immediately) and the hero
  // animation, so a static capture isn't stuck at opacity:0
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  const useCap = id !== 'hero' && id !== 'intro'
  const url = `http://localhost:5180/?fb=off&theme=${theme}${useCap ? '&cap=1' : ''}`
  await page.goto(url, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 900))
  const sel = id === 'hero' ? '#top' : '#' + id
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    el.scrollIntoView({ block: 'start' })
    const r = el.getBoundingClientRect()
    return { x: 0, y: Math.max(0, window.scrollY + r.top - 8), w: Math.min(1440, document.documentElement.clientWidth), h: Math.min(3800, r.height + 16) }
  }, sel)
  if (!box) { console.log('MISSING', id); await page.close(); continue }
  await page.screenshot({ path: `${outdir}/${id}.png`, clip: { x: box.x, y: box.y, width: box.w, height: box.h } })
  console.log('shot', id, Math.round(box.h) + 'px')
  await page.close()
}
await browser.close()

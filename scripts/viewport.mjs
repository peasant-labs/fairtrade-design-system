/* full-viewport captures at specific anchors (the real, non-?cap view) for QA of the
   full-screen sections + header gating. usage: node scripts/viewport.mjs <theme> <outdir> [anchor...]
   anchor "top" = scroll 0; others scroll the element to the top. */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const theme = process.argv[2] || 'dark'
const outdir = process.argv[3] || `shots/vp-${theme}`
const anchors = process.argv.slice(4)
const targets = anchors.length ? anchors : ['top', 'manifesto', 'color', 'inuse']
mkdirSync(outdir, { recursive: true })

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 } })
for (const a of targets) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await page.goto(`http://localhost:5180/?fb=off&theme=${theme}`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1600)) // let the wheat video + fonts settle
  await page.evaluate((a) => {
    // deterministic capture: kill snap + smooth so we land exactly where we scroll
    document.documentElement.style.scrollSnapType = 'none'
    document.documentElement.style.scrollBehavior = 'auto'
    if (a === 'top') { window.scrollTo(0, 0); return }
    const el = document.getElementById(a)
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, a)
  await new Promise((r) => setTimeout(r, 700))
  const navVisible = await page.evaluate(() => {
    const n = document.querySelector('.nav'); if (!n) return null
    const r = n.getBoundingClientRect(); const hidden = n.classList.contains('nav--hidden')
    return { hidden, top: Math.round(r.top) }
  })
  await page.screenshot({ path: `${outdir}/${a}.png` })
  console.log('shot', a, 'nav', JSON.stringify(navVisible))
  await page.close()
}
await browser.close()

/* responsive QA capture: viewport screenshots of the key surfaces at each breakpoint width, in a
   theme, for desktop-first responsive review. usage: node scripts/responsive.mjs <theme> [w1 w2 ...]
   widths default to the token scale floors (xs/sm/md/lg/xl). anchors: top, color, data-table, inuse. */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const theme = process.argv[2] || 'dark'
const widths = (process.argv.slice(3).map(Number).filter(Boolean))
const WIDTHS = widths.length ? widths : [360, 768, 1024]
const ANCHORS = ['top', 'color', 'data-table', 'inuse']
const out = `shots/resp-${theme}`
mkdirSync(out, { recursive: true })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
for (const w of WIDTHS) {
  for (const a of ANCHORS) {
    const page = await browser.newPage()
    await page.setViewport({ width: w, height: 780, deviceScaleFactor: 1 })
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.goto(`http://localhost:5180/?fb=off&theme=${theme}`, { waitUntil: 'networkidle0' })
    await new Promise((r) => setTimeout(r, 1100))
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-in')))
    await page.evaluate((a) => {
      document.documentElement.style.scrollBehavior = 'auto'
      if (a === 'top') { window.scrollTo(0, 0); return }
      const el = document.getElementById(a)
      if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' })
    }, a)
    await new Promise((r) => setTimeout(r, 500))
    // horizontal overflow check at this width
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    await page.screenshot({ path: `${out}/${a}-${w}.png` })
    console.log(`${a} @ ${w}px  overflowX=${overflow}`)
    await page.close()
  }
}
await browser.close()

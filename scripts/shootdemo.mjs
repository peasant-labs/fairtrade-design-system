/* screenshot the in-use demos: drive the app-switcher + sub-nav, capture the window. usage: node scripts/shootdemo.mjs <theme> <outdir> */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const theme = process.argv[2] || 'dark'
const out = process.argv[3] || `/tmp/demo-${theme}`
mkdirSync(out, { recursive: true })
const url = `http://localhost:5180/?fb=off${theme === 'light' ? '&theme=light' : ''}`
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1460, height: 1000, deviceScaleFactor: 1 } })
const page = await browser.newPage()
const errs = []
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()) })
page.on('pageerror', (e) => errs.push('pageerr: ' + e.message))
await page.goto(url, { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 800))
await page.evaluate(() => document.getElementById('inuse-stage')?.scrollIntoView({ block: 'center' }))
await new Promise(r => setTimeout(r, 400))
const shot = async (name) => {
  const el = await page.$('.iu-win')
  if (!el) { console.log('NO .iu-win'); return }
  await el.screenshot({ path: `${out}/${name}.png` })
  console.log('shot', name)
}
// click an app in the rail by index (0 transcript,1 commons,2 graph)
const app = async (i) => { await page.evaluate((i) => document.querySelectorAll('.iu-app')[i]?.click(), i); await new Promise(r => setTimeout(r, 500)) }
// click a sub-nav item by visible text
const sub = async (txt) => { await page.evaluate((t) => { const b=[...document.querySelectorAll('.iu-subnav-item')].find(x=>x.textContent.trim()===t); b&&b.click() }, txt); await new Promise(r => setTimeout(r, 450)) }

await app(0); await shot('1-transcript')
await app(1); await shot('2-commons-explore'); await sub('collectives'); await shot('3-commons-collectives'); await sub('publish'); await shot('4-commons-publish')
await app(2); await shot('5-graph-map'); await sub('analytics'); await shot('6-graph-analytics'); await sub('changes'); await shot('7-graph-changes')
console.log('console errors:', errs.length ? errs.slice(0,5) : 'none')
await browser.close()

import puppeteer from 'puppeteer-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const theme = process.argv[2] || 'dark'
const out = process.argv[3] || `shots/full-${theme}.png`
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1440, height: 1200, deviceScaleFactor: 1 } })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 })
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await p.goto(`http://localhost:5180/?fb=off&theme=${theme}&cap=1`, { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 1500))
// force-reveal any remaining hidden sections
await p.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-in')))
await new Promise(r => setTimeout(r, 400))
await p.screenshot({ path: out, fullPage: true })
console.log('wrote', out)
await b.close()

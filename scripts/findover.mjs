import puppeteer from 'puppeteer-core'
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const w = +process.argv[2] || 390
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const p = await b.newPage()
await p.setViewport({ width: w, height: 800 })
await p.goto('http://localhost:5180/?fb=off', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 800))
const offenders = await p.evaluate(() => {
  const vw = document.documentElement.clientWidth
  const clipped = (el) => {
    let n = el.parentElement
    while (n && n !== document.body) {
      const o = getComputedStyle(n).overflowX
      if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') return true
      n = n.parentElement
    }
    return false
  }
  const out = []
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 && r.width > 24 && !clipped(el)) {
      out.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 60), right: Math.round(r.right), w: Math.round(r.width), sec: (el.closest('section[id]') || {}).id || '' })
    }
  }
  return out.sort((a, b) => b.right - a.right).slice(0, 10)
})
console.log(JSON.stringify(offenders))
await b.close()

/* interactive diagnostic harness — drives the real page via puppeteer-core + system Chrome.
   reproduces the interactive bugs (overflow, scroll-spy, nav reveal, search, icons) and prints JSON.
   usage: node scripts/diag.mjs [url]   (default dev server) */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.argv[2] || 'http://localhost:5180/?fb=off'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars=false', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1440, height: 900 },
})
const page = await browser.newPage()
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise((r) => setTimeout(r, 1200)) // let lucide + effects settle

const report = {}

// 1) horizontal overflow: is the doc wider than the viewport? which elements overflow?
report.overflow = await page.evaluate(() => {
  const de = document.documentElement
  const vw = de.clientWidth
  const culprits = []
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) {
      if (r.width > 40 && r.right - vw > 2) {
        culprits.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 50), right: Math.round(r.right), width: Math.round(r.width) })
      }
    }
  })
  // dedupe-ish: keep widest 12
  culprits.sort((a, b) => b.right - a.right)
  return { scrollWidth: de.scrollWidth, clientWidth: vw, overflowing: de.scrollWidth > vw, culprits: culprits.slice(0, 12) }
})

// 2) icons: painted svgs vs leftover placeholders
report.icons = await page.evaluate(() => ({
  svgLucide: document.querySelectorAll('svg.lucide').length,
  leftoverPlaceholders: document.querySelectorAll('i[data-lucide]').length,
  brandSvgs: document.querySelectorAll('svg.brand').length,
}))

// 3) scroll-spy: at several scroll depths, which rail-link is active + which section is centered
report.scrollSpy = await page.evaluate(async () => {
  const ids = Array.from(document.querySelectorAll('.rail-link')).map((a) => a.getAttribute('href'))
  const out = []
  const targets = ['#color', '#controls', '#states', '#conversation', '#overlays', '#tokens']
  for (const t of targets) {
    const el = document.querySelector(t)
    if (!el) { out.push({ target: t, found: false }); continue }
    window.scrollTo({ top: el.offsetTop - 100, behavior: 'instant' })
    await new Promise((r) => setTimeout(r, 350))
    const active = document.querySelector('.rail-link.active')
    const navActive = document.querySelector('.nav-links a.active')
    out.push({
      target: t,
      activeRail: active ? active.getAttribute('href') : null,
      activeNav: navActive ? navActive.getAttribute('data-spy') : null,
      correct: active ? active.getAttribute('href') === t : false,
    })
  }
  return { railCount: ids.length, results: out }
})

// 4) nav reveal: does the nav hide on scroll down / show on scroll up?
report.nav = await page.evaluate(async () => {
  const nav = document.querySelector('.nav')
  const read = () => {
    const cs = getComputedStyle(nav)
    return { transform: cs.transform, position: cs.position, top: cs.top, transition: cs.transition.slice(0, 40) }
  }
  window.scrollTo({ top: 0, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 200))
  const atTop = read()
  window.scrollTo({ top: 2500, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 300))
  const scrolledDown = read()
  window.scrollTo({ top: 1500, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 300))
  const scrolledUp = read()
  return { atTop, scrolledDown, scrolledUp, hidesOnScroll: atTop.transform !== scrolledDown.transform }
})

// 5) search: is the nav search interactive? does cmd-k do anything?
report.search = await page.evaluate(async () => {
  const pill = document.querySelector('.navctl.bx')
  const before = document.querySelectorAll('.cp-panel, .cmdk, [data-palette], .cp-root').length
  let clickable = false
  if (pill) {
    pill.click()
    await new Promise((r) => setTimeout(r, 250))
  }
  const afterClick = document.querySelectorAll('.cp-panel, .cmdk, [data-palette], .cp-root').length
  // cmd-k
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
  await new Promise((r) => setTimeout(r, 250))
  const afterKey = document.querySelectorAll('.cp-panel, .cmdk, [data-palette], .cp-root').length
  return {
    pillTag: pill ? pill.tagName.toLowerCase() : null,
    pillIsButton: pill ? pill.tagName === 'BUTTON' : false,
    hasClickHandler: false,
    paletteBefore: before, afterClick, afterKey,
    opensOnClick: afterClick > before, opensOnCmdK: afterKey > before,
  }
})

report.consoleErrors = consoleErrors.slice(0, 20)

console.log(JSON.stringify(report, null, 2))
await browser.close()

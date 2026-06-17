/* comprehensive interactive validation gate. drives the real page via puppeteer-core and asserts
   the rules that the contrast gate (scripts/contrast.mjs) can't see: a11y wiring, interactions,
   console health, reduced-motion, heading hierarchy, and overflow across breakpoints.
   usage: node scripts/validate.mjs [url] */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.argv[2] || 'http://localhost:5180/?fb=off'
const checks = []
const ok = (name, pass, detail = '') => checks.push({ name, pass, detail })

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1440, height: 900 } })
const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
await page.goto(URL, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1200))

// icons + console
const base = await page.evaluate(() => ({
  svg: document.querySelectorAll('svg.lucide').length,
  leftover: document.querySelectorAll('i[data-lucide]').length,
  copyUnnamed: document.querySelectorAll('.copy-token:not([aria-label])').length,
  iconBtnUnnamed: [...document.querySelectorAll('button')].filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label') && b.querySelector('svg,i')).length,
  h1: document.querySelectorAll('h1').length,
  h2: document.querySelectorAll('h2').length,
  h3: document.querySelectorAll('h3').length,
  dialogRole: document.querySelectorAll('[role="dialog"]').length,
  ariaHiddenSvg: document.querySelectorAll('svg.lucide[aria-hidden="true"]').length,
}))
ok('icons painted', base.svg > 250, `${base.svg} svgs`)
ok('no leftover icon placeholders', base.leftover === 0, `${base.leftover} left`)
ok('all copy-tokens named', base.copyUnnamed === 0, `${base.copyUnnamed} unnamed`)
ok('no unnamed icon-only buttons', base.iconBtnUnnamed === 0, `${base.iconBtnUnnamed} unnamed`)
ok('exactly one h1', base.h1 === 1, `${base.h1} h1`)
ok('heading outline present', base.h2 >= 15 && base.h3 >= 5, `h2=${base.h2} h3=${base.h3}`)
ok('decorative icons aria-hidden', base.ariaHiddenSvg > 200, `${base.ariaHiddenSvg} hidden`)

// scroll-spy
const spy = await page.evaluate(async () => {
  const res = []
  for (const t of ['#color', '#states', '#overlays', '#tokens']) {
    const el = document.querySelector(t)
    window.scrollTo({ top: el.offsetTop - 100, behavior: 'instant' })
    await new Promise((r) => setTimeout(r, 300))
    const a = document.querySelector('.rail-link.active')
    res.push(a && a.getAttribute('href') === t)
  }
  window.scrollTo(0, 0)
  return res
})
ok('scroll-spy tracks every target', spy.every(Boolean), `${spy.filter(Boolean).length}/4`)

// nav reveal — driven with REAL wheel events on a fresh page (matches how a user scrolls; the
// direction detection is reliable with continuous deltas, unlike coalesced programmatic scrollTo)
const navPage = await browser.newPage()
await navPage.setViewport({ width: 1440, height: 900 })
await navPage.goto(URL, { waitUntil: 'networkidle0' }); await new Promise((r) => setTimeout(r, 900))
await navPage.mouse.move(700, 450)
const navRead = () => navPage.evaluate(() => document.querySelector('.nav').classList.contains('nav--hidden'))
for (let i = 0; i < 7; i++) { await navPage.mouse.wheel({ deltaY: 300 }); await new Promise((r) => setTimeout(r, 60)) }
await new Promise((r) => setTimeout(r, 350)); const navDown = await navRead()
for (let i = 0; i < 5; i++) { await navPage.mouse.wheel({ deltaY: -300 }); await new Promise((r) => setTimeout(r, 60)) }
await new Promise((r) => setTimeout(r, 350)); const navUp = await navRead()
await navPage.close()
const nav = { down: navDown, up: navUp }
ok('nav hides on scroll-down', nav.down === true)
ok('nav restores on scroll-up', nav.up === false)

// command palette
await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta')
await new Promise((r) => setTimeout(r, 200))
const pOpen = await page.$('.cmdk')
ok('palette opens on cmd-k', !!pOpen)
await page.keyboard.type('overlays'); await new Promise((r) => setTimeout(r, 150))
await page.keyboard.press('Enter'); await new Promise((r) => setTimeout(r, 2000)) // allow the smooth jump to settle
const jumped = await page.evaluate(() => ({ gone: !document.querySelector('.cmdk'), top: Math.round(document.getElementById('overlays').getBoundingClientRect().top) }))
ok('palette jumps + closes', jumped.gone && jumped.top < 240, `top=${jumped.top}`)

// interactive dialog: opens, traps focus, Esc closes + returns focus
await page.evaluate(() => { document.querySelector('[data-open-dialog]').scrollIntoView({ block: 'center' }) })
await new Promise((r) => setTimeout(r, 200))
await page.evaluate(() => document.querySelector('[data-open-dialog]').click())
await new Promise((r) => setTimeout(r, 450))
const dlgOpen = await page.evaluate(() => !!document.querySelector('.dlg-overlay [role="dialog"][aria-modal="true"]') && document.activeElement.closest('.dlg-overlay') !== null)
ok('dialog opens + traps focus', dlgOpen)
await page.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 400))
const dlgClosed = await page.evaluate(() => !document.querySelector('.dlg-overlay') && document.activeElement.matches('[data-open-dialog]'))
ok('dialog Esc-closes + returns focus', dlgClosed)

// theme toggle keeps icons
const t1 = await page.evaluate(() => document.querySelectorAll('svg.lucide').length)
await page.evaluate(() => document.querySelector('.theme-btn').click()); await new Promise((r) => setTimeout(r, 300))
const themed = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
const t2 = await page.evaluate(() => document.querySelectorAll('svg.lucide').length)
await page.evaluate(() => document.querySelector('.theme-btn').click()); await new Promise((r) => setTimeout(r, 200))
ok('theme toggles', themed === 'light')
ok('icons persist across theme toggle', t2 >= t1 - 2, `${t1}->${t2}`)

// overflow across breakpoints
const widths = [360, 390, 768, 1024, 1440]
const over = {}
for (const w of widths) {
  const pp = await browser.newPage(); await pp.setViewport({ width: w, height: 800 })
  await pp.goto(URL, { waitUntil: 'networkidle0' }); await new Promise((r) => setTimeout(r, 600))
  over[w] = await pp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await pp.close()
}
ok('no overflow >= 390px', Object.entries(over).filter(([w]) => +w >= 390).every(([, v]) => v <= 1), JSON.stringify(over))

// reduced-motion disables animation
const rm = await browser.newPage()
await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await rm.goto(URL, { waitUntil: 'networkidle0' }); await new Promise((r) => setTimeout(r, 800))
const rmDur = await rm.evaluate(() => {
  const el = document.querySelector('.card-img') || document.querySelector('.card')
  return el ? getComputedStyle(el).transitionDuration : '0s'
})
await rm.close()
ok('reduced-motion shortens transitions', parseFloat(rmDur) < 0.05, rmDur) // .01ms (1e-05s) under reduce

ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()

let fail = 0
for (const c of checks) { if (!c.pass) fail++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`) }
console.log(`\n${checks.length - fail}/${checks.length} checks pass`)
process.exit(fail ? 1 : 0)

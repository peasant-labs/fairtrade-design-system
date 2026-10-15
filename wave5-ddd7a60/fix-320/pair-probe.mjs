// TRANSIENT paired overflow probe (this run's verification only; never committed).
// For each of the six swept surfaces at 320px, both themes, both motion settings,
// measures documentElement.scrollWidth - clientWidth on the pre-fix tree and on the
// fixed tree at two scroll states: page top (the sweep's own measurement point) and
// with the pagination band scrolled into view (the site adds .is-in, which drops the
// reveal transform). Also records the causal control's computed position and the
// hidden label's used offset plus its nearest positioned ancestor, so the
// containing-block change is inspectable rather than inferred.
import { createRequire } from 'node:module'
import { serveDist } from '/home/minttea/dev/peasant-labs/fairtrade-design-system/fairtrade-design-system-116--wave5/scripts/fairtest/capture-driver.mjs'

const root = '/home/minttea/dev/peasant-labs/fairtrade-design-system/fairtrade-design-system-116--wave5'
const require = createRequire(`${root}/package.json`)
const { chromium } = require('@playwright/test')

const before = process.argv[2]
const after = process.argv[3]
const surfaces = [
  { id: 'transcript', query: 'app=transcript' },
  { id: 'settings', query: 'app=commons&commons=collective-settings' },
  { id: 'publish', query: 'app=transcript&publish=ready&bar=published' },
  { id: 'home', query: 'app=graph&section=home' },
  { id: 'apptab', query: 'app=graph&section=home', element: '.iu-bar' },
  { id: 'commons', query: 'app=commons' },
]
const themes = ['dark', 'light']
const motions = ['reduce', 'no-preference']

const MEASURE = (elementSelector) => {
  const doc = document.documentElement
  const edge = document.querySelector('.pgn-edge:last-child')
  const label = edge ? edge.querySelector('span') : null
  const edgeStyle = edge ? getComputedStyle(edge) : null
  const labelStyle = label ? getComputedStyle(label) : null
  const band = document.querySelector('#pagination')
  const bandStyle = band ? getComputedStyle(band) : null
  return {
    overflow: doc.scrollWidth - doc.clientWidth,
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    edge: edgeStyle ? { position: edgeStyle.position, right: +edge.getBoundingClientRect().right.toFixed(1) } : null,
    label: labelStyle ? {
      position: labelStyle.position,
      usedLeft: labelStyle.left,
      rectRight: +label.getBoundingClientRect().right.toFixed(1),
      containingBlock: (() => {
        for (let node = label.parentElement; node; node = node.parentElement) {
          const s = getComputedStyle(node)
          if (s.position !== 'static' || s.transform !== 'none') {
            const classes = typeof node.className === 'string' && node.className ? '.' + node.className.trim().split(/\s+/).join('.') : ''
            return `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}${classes}`
          }
        }
        return 'none (initial containing block)'
      })(),
    } : null,
    band: band ? { classes: typeof band.className === 'string' ? band.className.trim() : '', transform: bandStyle.transform } : null,
    barOverflow: elementSelector ? (document.querySelector(elementSelector)?.scrollWidth ?? 0) - (document.querySelector(elementSelector)?.clientWidth ?? 0) : null,
  }
}

const rows = []
for (const dist of [{ state: 'before', dir: before }, { state: 'after', dir: after }]) {
  const server = await serveDist(dist.dir)
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 1100 } })
    page.setDefaultNavigationTimeout(25000)
    for (const theme of themes) {
      for (const motion of motions) {
        await page.emulateMedia({ reducedMotion: motion })
        for (const surface of surfaces) {
          for (const scrollState of ['top', 'revealed']) {
            await page.goto(`${server.origin}/?fb=off&theme=${theme}&${surface.query}`, { waitUntil: 'domcontentloaded' })
            await page.evaluate(() => document.fonts.ready)
            await page.waitForTimeout(450)
            if (scrollState === 'revealed') {
              await page.evaluate(() => document.querySelector('#pagination').scrollIntoView({ block: 'start', behavior: 'instant' }))
              await page.waitForTimeout(1400)
            }
            const read = await page.evaluate(MEASURE, surface.element ?? null)
            rows.push({ state: dist.state, theme, motion, surface: surface.id, scrollState, ...read })
          }
        }
      }
    }
    await page.close()
  } finally {
    await browser.close()
    await server.close()
  }
}
const summary = []
for (const scrollState of ['top', 'revealed']) {
  summary.push({ scrollState, failing: rows.filter((r) => r.scrollState === scrollState && r.overflow > 1).map((r) => `${r.state}/${r.theme}/${r.motion}/${r.surface} ${r.scrollWidth}/${r.clientWidth}`) })
}
console.log(JSON.stringify({ width: 320, surfaces: surfaces.map((s) => s.id), summary, rows }, null, 1))

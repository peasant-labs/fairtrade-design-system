// TRANSIENT scope check (this run's verification only; never committed): the fix adds a
// single declaration scoped to `.pgn-edge` (the numbered-pagination edge control) inside
// the narrow-viewport media block. This probe answers whether that element exists inside
// any captured surface root of the standing set or of the band annex, which decides
// whether any captured shot can be affected at all.
import { createRequire } from 'node:module'
import { serveDist } from '/home/minttea/dev/peasant-labs/fairtrade-design-system/fairtrade-design-system-116--wave5/scripts/fairtest/capture-driver.mjs'

const root = '/home/minttea/dev/peasant-labs/fairtrade-design-system/fairtrade-design-system-116--wave5'
const require = createRequire(`${root}/package.json`)
const { chromium } = require('@playwright/test')

const dist = process.argv[2]
const surfaces = [
  { id: 'controls-checkbox', query: '', root: '#controls' },
  { id: 'states-toggle', query: '', root: '#states' },
  { id: 'badges-chip', query: '', root: '#badges' },
  { id: 'inuse-apptab', query: 'app=graph&section=home', root: '#inuse' },
  { id: 'inuse-seg', query: 'app=graph&section=home', root: '#inuse' },
  { id: 'inuse-analytics', query: 'app=graph&section=analytics', root: '#inuse' },
  { id: 'inuse-transcript', query: 'app=transcript', root: '#inuse' },
  { id: 'inuse-settings-switch', query: 'app=commons&commons=collective-settings', root: '#inuse' },
  { id: 'publish-update', query: 'app=transcript&publish=update', root: '.pub-dialog' },
  { id: 'publish-ready', query: 'app=transcript&publish=ready&bar=published', root: '.pub-dialog' },
  { id: 'inuse-home', query: 'app=graph&section=home', root: '.iu-page' },
  { id: 'commons-home (annex)', query: 'app=commons', root: '.iu-page' },
  { id: 'site-chrome (annex)', query: '', root: '.nav' },
]
const server = await serveDist(dist)
const browser = await chromium.launch({ headless: true })
const rows = []
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 1100 }, reducedMotion: 'reduce' })
  for (const surface of surfaces) {
    await page.goto(`${server.origin}/?fb=off&theme=light&${surface.query}`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(400)
    rows.push(await page.evaluate(({ id, selector }) => {
      const root = document.querySelector(selector)
      const inRoot = root ? root.querySelectorAll('.pgn, .pgn-edge').length : null
      const pgnEdges = [...document.querySelectorAll('.pgn-edge')]
      const containers = pgnEdges.map((node) => {
        const section = node.closest('section')
        const classes = typeof section?.className === 'string' ? section.className.trim().split(/\s+/).join('.') : ''
        return `${section ? `${section.tagName.toLowerCase()}${section.id ? '#' + section.id : ''}${classes ? '.' + classes : ''}` : 'no section'}`
      })
      return {
        surface: id, rootSelector: selector, rootFound: Boolean(root),
        pgnOrEdgeInsideRoot: inRoot,
        documentPgnEdges: pgnEdges.length,
        documentPgn: document.querySelectorAll('.pgn').length,
        containers: [...new Set(containers)],
      }
    }, { id: surface.id, selector: surface.root }))
  }
  await page.close()
} finally {
  await browser.close()
  await server.close()
}
console.log(JSON.stringify({ dist: dist.replace(/^.*\//, '…/'), width: 320, rows }, null, 1))

// TRANSIENT diagnosis probe (this run only; never committed).
// Reproduces the 320px overflow and dumps the real geometry / computed styles
// around the named causal element, comparing `reduce` with `no-preference` on
// the SAME served dist.
//
// The probe drives the capture driver, so it has to know which checkout owns it: that
// checkout is read from FAIRTRADE_ROOT (never a hardcoded absolute path), and the
// payload binds the run to the served bytes (the real dist root, the worktree head,
// and the sha256 of each dist asset as actually served) instead of eliding the path.
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.env.FAIRTRADE_ROOT
if (!root) {
  throw new Error(
    'diagnosis-probe: missing value for environment variable FAIRTRADE_ROOT at path process.env; ' +
      'repair: run as FAIRTRADE_ROOT=<fairtrade checkout> node diagnosis-probe.mjs <dist> [query] [theme] [width] [head], ' +
      'where the checkout holds scripts/fairtest/capture-driver.mjs.',
  )
}
const driverPath = join(root, 'scripts/fairtest/capture-driver.mjs')
if (!existsSync(driverPath)) {
  throw new Error(
    `diagnosis-probe: no capture driver at ${driverPath} for environment variable FAIRTRADE_ROOT=${JSON.stringify(root)}; ` +
      'repair: point FAIRTRADE_ROOT at a fairtrade checkout that holds scripts/fairtest/capture-driver.mjs.',
  )
}
const { readDistAssets, resolveBuildInfo, serveDist, servedMatchesDist } = await import(
  pathToFileURL(driverPath).href
)
const require = createRequire(join(root, 'package.json'))
const { chromium } = require('@playwright/test')

const dist = process.argv[2]
if (!dist) {
  throw new Error(
    'diagnosis-probe: missing a served tree at path process.argv[2]; ' +
      'repair: pass a built dist tree: diagnosis-probe.mjs <dist> [query] [theme] [width] [head].',
  )
}
const query = process.argv[3] ?? 'app=graph&section=home'
const theme = process.argv[4] ?? 'light'
const width = Number(process.argv[5] ?? 320)
// A preserved copy of a build made outside its git worktree carries no head of
// its own, so its source commit is passed explicitly and recorded as the label.
const headLabel = process.argv[6]

const info = resolveBuildInfo('probe', dist, headLabel)
const server = await serveDist(dist)
const browser = await chromium.launch({ headless: true })
const out = {
  binding: {
    root: dist,
    head: info.head,
    dirty: info.dirty,
    distAssets: readDistAssets(dist),
    served: await servedMatchesDist(server.origin, dist),
  },
  width,
  theme,
  query,
  runs: {},
}
try {
  for (const motion of ['reduce', 'no-preference']) {
    const page = await browser.newPage({ viewport: { width, height: 1100 } })
    await page.emulateMedia({ reducedMotion: motion })
    await page.goto(`${server.origin}/?fb=off&theme=${theme}&${query}`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(900)
    out.runs[motion] = await page.evaluate(() => {
      const round = (n) => Number(n.toFixed(3))
      const box = (r) => r ? { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height), right: round(r.right) } : null
      const doc = document.documentElement
      const chain = (node) => {
        const out = []
        for (let n = node; n && n !== document.documentElement.parentNode; n = n.parentElement) {
          const s = getComputedStyle(n)
          out.push({
            sel: `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).join('.') : ''}`,
            rect: box(n.getBoundingClientRect()),
            position: s.position, overflow: s.overflow, overflowX: s.overflowX, overflowY: s.overflowY,
            contain: s.contain, transform: s.transform, translate: s.translate, willChange: s.willChange,
            maxWidth: s.maxWidth, width: s.width, animation: s.animationName, clipPath: s.clipPath,
          })
        }
        return out
      }
      const describe = (node) => {
        if (!node) return null
        const s = getComputedStyle(node)
        return {
          sel: `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}${typeof node.className === 'string' && node.className ? '.' + node.className.trim().split(/\s+/).join('.') : ''}`,
          rect: box(node.getBoundingClientRect()),
          scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, offsetWidth: node.offsetWidth,
          position: s.position, inset: `${s.top} ${s.right} ${s.bottom} ${s.left}`, margin: s.margin,
          padding: s.padding, width: s.width, minWidth: s.minWidth, maxWidth: s.maxWidth, display: s.display,
          overflow: s.overflow, overflowX: s.overflowX, clip: s.clip, clipPath: s.clipPath,
          transform: s.transform, transition: s.transitionProperty, transitionDuration: s.transitionDuration,
          boxSizing: s.boxSizing, whiteSpace: s.whiteSpace, textTransform: s.textTransform, fontSize: s.fontSize,
          justifyContent: s.justifyContent, flexWrap: s.flexWrap, gap: s.gap, visibility: s.visibility,
          content: s.content,
        }
      }
      const pgns = [...document.querySelectorAll('.pgn')]
      const edges = [...document.querySelectorAll('.pgn-edge')]
      const spans = [...document.querySelectorAll('.pgn-edge > span')]
      const widest = []
      for (const node of document.querySelectorAll('body *')) {
        const s = getComputedStyle(node)
        if (s.display === 'none' || s.visibility === 'hidden') continue
        const r = node.getBoundingClientRect()
        if (r.right + window.scrollX > window.innerWidth + 1) {
          widest.push({
            sel: `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}${typeof node.className === 'string' && node.className ? '.' + node.className.trim().split(/\s+/).join('.') : ''}`,
            rect: box(r), position: s.position, overflow: s.overflow, clip: s.clip,
          })
        }
      }
      widest.sort((a, b) => b.rect.right - a.rect.right)
      return {
        html: { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, overflow: doc.scrollWidth - doc.clientWidth, scrollLeft: doc.scrollLeft },
        body: { scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth, scrollLeft: document.body.scrollLeft },
        innerWidth: window.innerWidth,
        pgnCount: pgns.length,
        pgns: pgns.map(describe),
        edges: edges.map(describe),
        spans: spans.map(describe),
        spanChains: spans.map(chain),
        widestPassers: widest.slice(0, 12),
        scrollableNodes: [...document.querySelectorAll('body *')].filter((n) => n.scrollWidth - n.clientWidth > 1 && n.clientWidth > 0).slice(0, 12).map((n) => ({
          sel: `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).join('.') : ''}`,
          scrollWidth: n.scrollWidth, clientWidth: n.clientWidth, overflowX: getComputedStyle(n).overflowX,
        })),
      }
    })
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(JSON.stringify(out, null, 1))

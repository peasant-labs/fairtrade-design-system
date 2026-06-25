/* graph node-visual theme oracle — the graph half of the parity gate.

   The whole-app trajectory graph is captured by the parity harness (shootdemo's txn-graph
   surface), but its node LAYOUT (xyflow positions/topology) lives in the host engine and is
   carved out of strict pixel parity. What fairtrade owns is the node AESTHETIC. This oracle
   pins that aesthetic, free of engine layout, by screenshotting the layout-free GraphNodes
   catalog story (GraphTurnNode + GraphToolNode + GraphSubagentBranch + GraphLegend in one
   frame) in BOTH themes and asserting:

     (1) NON-EMPTY   — each render carries real content. Reuses the shared SurfaceGate (the same
                       non-empty assertion the capture harness runs), so a blank render fails.
     (2) THEME-DELTA — the dark and light renders must DIFFER by at least MIN_THEME_DELTA of
                       their pixels. A DOM/box presence check passes even when a node hardcodes
                       a colour (a literal hex instead of a token), because the node still mounts;
                       but a hardcoded colour does NOT flip between themes, so the dark-vs-light
                       delta collapses toward zero. Only this cross-theme diff makes the graph
                       half genuinely bite on a theme-token regression.

   usage: CHROME_PATH=/path/to/chrome node scripts/graph-oracle.mjs [outdir]
     outdir defaults to shots/graph-oracle. Requires a built storybook-static (pnpm build-storybook).

   The gate logic (GraphThemeGate) is exported and exercised RED/GREEN by check-graph-oracle.mjs —
   one implementation, no test-only copy. */
import puppeteer from 'puppeteer-core'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SurfaceGate } from './surface-gate.mjs'
import { diffPixels, dataUrl } from './png-diff.mjs'

/* the captured frame holds the page background CONSTANT across both themes, so the cross-theme
   delta is the node-content flip RATIO: changed node-content pixels / node-content footprint. A
   correctly tokenised node set flips its surface + ink + rule, so essentially all node content
   moves dark<->light. CALIBRATED against the REAL styled GraphNodes catalog (page bg held constant):
     correct render .............................. ~1.01  (all content flips; slightly >1 at AA edges)
     hardcode the card surface (var(--surface)) ..  0.52  (the dominant body fill stops flipping)
     hardcode the head bg (var(--surface-hover)) .  0.80
   A floor of 0.85 FAILS a single-colour hardcode of either dominant filled node surface while the
   correct render clears it with margin — so the gate bites a realistic single-colour theme
   regression, not only near-total theme-blindness. (A lower floor — e.g. the old 0.30 — passed a
   single hardcoded surface at 0.52 and was effectively blind to it.) */
export const MIN_THEME_DELTA = 0.85
/* per-channel tolerance (matches imgdiff): ignores sub-pixel AA shimmer so the delta reflects
   real colour flips, not font-edge noise. */
export const THEME_TOL = 16
/* fixed neutral page background painted under BOTH themes so the delta isolates the node visuals
   (see capture()). Far from every node surface/ink token in both themes, so the cards read as
   non-background content in each. */
export const ORACLE_BG = '#808080'

/* GraphThemeGate — the graph node-visual assertion. Construct one per run with a puppeteer Page
   (used as a dependency-free PNG decoder, exactly like SurfaceGate). assert() enforces non-empty
   on each theme + the cross-theme delta; throws an actionable error on any blank / near-empty /
   theme-blind (hardcoded-colour) render. */
export class GraphThemeGate {
  constructor(page) {
    this.page = page
    // one SurfaceGate instance: its duplicate guard also catches a fully theme-blind pair whose
    // two themes render byte-identical (the most degenerate hardcoded-colour regression).
    this.surface = new SurfaceGate(page)
  }

  /* measure both renders + the content-relative cross-theme delta. Throws on a blank/near-empty
     render (non-empty is non-negotiable) or a size mismatch. The delta is normalised by the node
     CONTENT footprint (the larger theme's non-background share), NOT the whole frame, so it is
     independent of how much empty canvas the crop includes and reflects "what fraction of the node
     visuals flipped". Returns { dark, light, themeDelta, diffPx, contentPx, total }. */
  async measure(darkFile, lightFile, { where = 'graph-oracle' } = {}) {
    const dark = await this.surface.assert('graphnodes-dark', darkFile, { where })
    const light = await this.surface.assert('graphnodes-light', lightFile, { where })
    const d = await diffPixels(this.page, dataUrl(darkFile), dataUrl(lightFile), THEME_TOL)
    if (d.dim) {
      throw new Error(
        `ERROR [${where}] Graph node-visual theme oracle: dark and light renders differ in SIZE.\n` +
        `  What failed: dark is ${d.aw}x${d.ah} but light is ${d.bw}x${d.bh}.\n` +
        `  Why: a per-pixel cross-theme diff needs both themes captured at the same crop.\n` +
        `  Where: graph-oracle.mjs GraphThemeGate.measure("${darkFile}", "${lightFile}").\n` +
        `  Means: the theme-delta cannot be computed, so the graph oracle cannot bite.\n` +
        `  Fix: capture both themes at one fixed clip (this script does so by default); re-run after a clean build-storybook.`,
      )
    }
    const contentPx = Math.max(dark.nonbgRatio, light.nonbgRatio) * d.total
    const themeDelta = contentPx > 0 ? d.diff / contentPx : 0
    return { dark, light, themeDelta, diffPx: d.diff, contentPx, total: d.total }
  }

  /* enforce the full gate: non-empty (via measure) + content-relative delta >= MIN_THEME_DELTA. */
  async assert(darkFile, lightFile, { where = 'graph-oracle' } = {}) {
    const r = await this.measure(darkFile, lightFile, { where })
    if (r.themeDelta < MIN_THEME_DELTA) {
      throw new Error(
        `ERROR [${where}] Graph node-visual theme assertion failed.\n` +
        `  What failed: node-content flip ratio ${r.themeDelta.toFixed(2)} between the dark and light renders\n` +
        `       (need >= ${MIN_THEME_DELTA.toFixed(2)}); the page background was held constant, so this is the node visuals alone.\n` +
        `  Why: the node visuals are not responding to the theme tokens. A dark<->light flip must repaint the\n` +
        `       node surface/ink/rule, so a real render moves most of the content; a near-static pair means a\n` +
        `       colour was hardcoded (a literal hex/rgb) instead of referencing a CSS variable.\n` +
        `  Where: graph-oracle.mjs GraphThemeGate.assert("${darkFile}", "${lightFile}") — ${r.diffPx} changed of ~${Math.round(r.contentPx)} content px.\n` +
        `  Means: a DOM/box presence check would still pass (the nodes render), but a theme-token regression\n` +
        `         has slipped in and the graph half of the parity oracle would not catch it.\n` +
        `  Fix: ensure every graph node colour (GraphTurnNode/GraphToolNode/GraphSubagentBranch/GraphLegend +\n` +
        `       graph/graph-visuals.css) references a token (var(--surface)/var(--ink)/var(--rule)…) that\n` +
        `       flips on [data-theme="light"]; never hardcode a hex/rgb in a node visual.`,
      )
    }
    return r
  }
}

/* ── production capture path (runs only when invoked directly, not when imported) ───────────── */

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' }

async function main() {
  const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const ROOT = 'storybook-static'
  const PORT = Number(process.env.SB_PORT) || 6019
  const outdir = process.argv[2] || 'shots/graph-oracle'

  if (!existsSync(CHROME)) {
    console.error(
      `ERROR [graph-oracle.mjs] Chrome binary not found at: ${CHROME}\n` +
      `  What failed: puppeteer could not locate the browser used to render + decode PNGs.\n` +
      `  Why: CHROME_PATH is unset or points to a missing file.\n` +
      `  Where: graph-oracle.mjs startup, binary check.\n` +
      `  Means: the graph node-visual oracle cannot run.\n` +
      `  Fix: set CHROME_PATH to your Chrome/Chromium binary, e.g.\n` +
      `    CHROME_PATH=/home/you/.nix-profile/bin/google-chrome node scripts/graph-oracle.mjs`,
    )
    process.exit(1)
  }
  if (!existsSync(join(ROOT, 'index.json'))) {
    console.error(
      `ERROR [graph-oracle.mjs] Built storybook not found at ${ROOT}/index.json.\n` +
      `  What failed: the static storybook the oracle screenshots is not present.\n` +
      `  Why: storybook-static has not been built in this tree.\n` +
      `  Where: graph-oracle.mjs startup, storybook check.\n` +
      `  Means: the GraphNodes catalog story cannot be rendered for the both-themes diff.\n` +
      `  Fix: run pnpm build-storybook first, then re-run this script.`,
    )
    process.exit(1)
  }

  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'
      const fp = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''))
      if (!existsSync(fp)) { res.writeHead(404); return res.end('nf') }
      res.writeHead(200, { 'content-type': MIME[extname(fp)] || 'application/octet-stream' })
      res.end(await readFile(fp))
    } catch { res.writeHead(500); res.end('err') }
  })
  await new Promise((r) => server.listen(PORT, r))

  // locate the GraphNodes catalog story — the comprehensive node-visual anchor (all four families
  // in one frame). Its absence is a coverage regression the oracle must fail loud on.
  const idx = JSON.parse(await readFile(join(ROOT, 'index.json'), 'utf8'))
  const entries = Object.values(idx.entries || idx.stories || {})
  const story = entries.find((e) => e.type !== 'docs' && /graphnodes/i.test(e.id) && /catalog/i.test(e.id))
  if (!story) {
    server.close()
    console.error(
      `ERROR [graph-oracle.mjs] GraphNodes "Catalog" story not found in the built storybook.\n` +
      `  What failed: no story id matched /graphnodes/ + /catalog/ in ${ROOT}/index.json.\n` +
      `  Why: the graph node-visual catalog story (the oracle anchor) is missing or was renamed.\n` +
      `  Where: graph-oracle.mjs, story lookup.\n` +
      `  Means: the both-themes node-visual oracle has no surface to diff — graph coverage regressed.\n` +
      `  Fix: keep src/ui/transcript/graph/graph.stories.jsx exporting the 'Catalog' story under title 'in use/transcript/GraphNodes'.`,
    )
    process.exit(1)
  }

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1000, height: 1000, deviceScaleFactor: 2 } })
  mkdirSync(outdir, { recursive: true })

  /* render one theme of the catalog story and screenshot it at `clip` (when given, so both themes
     share one crop -> identical dimensions). Forces the theme via the storybook theme global AND an
     explicit [data-theme] attribute. Crucially it holds the OUTER page background CONSTANT (a fixed
     neutral) across both themes: the cross-theme delta must isolate the NODE visuals (surface / ink
     / rule, all token-driven), not the page canvas — which flips trivially and would otherwise swamp
     a node-level regression. A node that hardcodes a colour does NOT flip against this fixed backdrop,
     so the delta collapses and the gate bites. Returns the clip used. */
  const capture = async (theme, file, clip) => {
    const page = await browser.newPage()
    await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 2 })
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    const url = `http://localhost:${PORT}/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}&args=`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.evaluate((t, bg) => {
      document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : '')
      for (const el of [document.documentElement, document.body, document.querySelector('#storybook-root,#root')]) {
        if (el) el.style.background = bg
      }
    }, theme, ORACLE_BG)
    await new Promise((r) => setTimeout(r, 700))
    let box = clip
    if (!box) {
      box = await page.evaluate(() => {
        const el = document.querySelector('#storybook-root,#root')
        if (!el) return null
        const r = el.getBoundingClientRect(); const m = 12
        return { x: Math.max(0, Math.floor(r.left - m)), y: Math.max(0, Math.floor(window.scrollY + r.top - m)), width: Math.ceil(r.width + m * 2), height: Math.ceil(r.height + m * 2) }
      })
    }
    const opts = box && box.width > 8 && box.height > 8 ? { clip: box } : {}
    await page.screenshot({ path: file, ...opts })
    await page.close()
    return box
  }

  const darkFile = join(outdir, 'graphnodes-dark.png')
  const lightFile = join(outdir, 'graphnodes-light.png')
  const clip = await capture('dark', darkFile)          // crop computed from the dark render…
  await capture('light', lightFile, clip)               // …reused for light so dimensions match exactly
  console.log('captured', darkFile, '+', lightFile, clip ? `(${clip.width}x${clip.height} @2x)` : '(full page)')

  // decode + gate on a fresh page parked on about:blank
  const decoder = await browser.newPage()
  await decoder.goto('about:blank')
  let failed = false
  try {
    const gate = new GraphThemeGate(decoder)
    const r = await gate.assert(darkFile, lightFile, { where: 'graph-oracle.mjs' })
    console.log(
      `\nOK graph node-visual oracle GREEN:\n` +
      `  both themes non-empty; node-content flip ratio ${r.themeDelta.toFixed(2)} ` +
      `(>= ${MIN_THEME_DELTA.toFixed(2)} floor) — the node visuals re-theme.\n` +
      `  ${r.diffPx} of ~${Math.round(r.contentPx)} node-content px changed dark<->light (page background held constant).\n` +
      `  dark : ${(r.dark.nonbgRatio * 100).toFixed(1)}% nonbg, ${r.dark.distinctColors} colours, ${(r.dark.bytes / 1024).toFixed(1)}KB\n` +
      `  light: ${(r.light.nonbgRatio * 100).toFixed(1)}% nonbg, ${r.light.distinctColors} colours, ${(r.light.bytes / 1024).toFixed(1)}KB`,
    )
  } catch (e) {
    console.error('\n' + e.message)
    failed = true
  }
  await browser.close()
  server.close()
  if (failed) process.exit(1)
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
if (isMain) await main()

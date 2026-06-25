/* precise pixel diff between two screenshot sets, with no extra deps.
   reads each baseline/after PNG in node, hands them to a headless page as data: URLs
   (data: images don't taint the canvas), draws both, and counts differing pixels.
   usage: node scripts/imgdiff.mjs <theme> [id1 id2 ...]
     compares shots/baseline-<theme>/<id>.png vs shots/after-<theme>/<id>.png

   EXIT CODES: 0 = all compared surfaces are within tolerance; 1 = any SKIP (missing
   png in either set), DIM (size mismatch), hard DIFF, or an empty id list. A run that
   matches zero surfaces is a FAILURE, not 0.0000%.

   TOL semantics: TOL=16 means "no pixel differs by more than 16/255 per channel" — it
   tolerates sub-pixel anti-aliasing shimmer. It does NOT mean "pixel-identical"; a pixel
   is counted as differing only when at least one channel exceeds the threshold. A result
   of "0 diff px" means no pixel exceeded the tolerance — it is reported as IDENTICAL. */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { diffPixels, dataUrl } from './png-diff.mjs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SAVE = process.env.SAVE === '1'
const theme = process.argv[2] || 'dark'
const ids = process.argv.slice(3)
const BASE = process.env.BASE || `shots/baseline-${theme}`
const AFT = process.env.AFT || `shots/after-${theme}`
if (SAVE) mkdirSync(`shots/diff-${theme}`, { recursive: true })
const all = ids.length ? ids : ['color', 'typography', 'spacing', 'icons', 'controls', 'states', 'badges', 'trails', 'conversation', 'canvas', 'forms', 'overlays', 'a11y', 'tokens']

/* fail closed: if no ids were given AND no default surface pngs exist in BASE, the run is vacuous */
if (all.length === 0) {
  console.error(
    `ERROR [imgdiff.mjs] No surface ids to compare.\n` +
    `  What failed: the id list is empty (no positional args and the default list is empty).\n` +
    `  Why: either no ids were provided or all defaults were filtered out.\n` +
    `  Where: imgdiff.mjs startup.\n` +
    `  Means: zero surfaces would be compared, making the gate vacuously pass.\n` +
    `  Fix: pass explicit surface ids, e.g. node scripts/imgdiff.mjs dark txn-highlights-dark txn-graph-dark`
  )
  process.exit(1)
}
const TOL = 16 // per-channel tolerance to ignore sub-pixel AA shimmer

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.goto('about:blank')

let worst = 0
let skipped = 0
let dimCount = 0
for (const id of all) {
  const a = `${BASE}/${id}.png`
  const b = `${AFT}/${id}.png`
  if (!existsSync(a) || !existsSync(b)) {
    console.log(`SKIP  ${id} (missing png — baseline: ${existsSync(a)}, after: ${existsSync(b)})`)
    skipped++
    continue
  }
  const r = await diffPixels(page, dataUrl(a), dataUrl(b), TOL, SAVE)
  if (r.dim) { console.log(`DIM!  ${id}  baseline ${r.aw}x${r.ah}  after ${r.bw}x${r.bh}`); worst = 100; dimCount++; continue }
  const pct = (100 * r.diff) / r.total
  worst = Math.max(worst, pct)
  const tag = pct === 0 ? 'IDENTICAL' : pct < 0.05 ? 'ok~' : pct < 0.5 ? 'CHECK' : 'DIFF!'
  const yspan = r.maxY >= 0 ? `  y[${r.minY}..${r.maxY}]` : ''
  console.log(`${tag.padEnd(10)} ${id.padEnd(13)} ${pct.toFixed(4)}% (${r.diff}/${r.total})${yspan}`)
  if (SAVE && r.url) writeFileSync(`shots/diff-${theme}/${id}.png`, Buffer.from(r.url.split(',')[1], 'base64'))
}
const compared = all.length - skipped - dimCount
console.log(`\nworst: ${worst.toFixed(4)}%  compared: ${compared}/${all.length}  skipped: ${skipped}  dim: ${dimCount}`)
await browser.close()

/* fail closed: any skip, dim, or zero-comparisons is a gate failure */
if (skipped > 0 || dimCount > 0 || compared === 0) {
  console.error(
    `\nFAIL [imgdiff.mjs] Gate did not pass cleanly.\n` +
    `  skipped (missing png): ${skipped}  dim (size mismatch): ${dimCount}  compared: ${compared}\n` +
    `  A skip means the after-set is missing a surface that the baseline defines — either the\n` +
    `  post-refactor run did not capture it (regression) or the id list is wrong.\n` +
    `  Fix: ensure the post-lift shootdemo run produces all surfaces in the AFT directory,\n` +
    `  then re-run with matching id lists.`
  )
  process.exit(1)
}
if (worst > 0.5) {
  console.error(
    `\nFAIL [imgdiff.mjs] Pixel difference exceeds threshold (worst ${worst.toFixed(4)}% > 0.5%).\n` +
    `  What failed: at least one surface differs visually between the baseline and the after-set.\n` +
    `  Fix: inspect the DIFF! rows above, use SAVE=1 to write diff-highlight PNGs,\n` +
    `  and check the corresponding source changes for unintended visual regressions.`
  )
  process.exit(1)
}

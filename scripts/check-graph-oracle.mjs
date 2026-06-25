/* self-check for the graph node-visual theme oracle — exercises the SAME GraphThemeGate the
   oracle runs in production (graph-oracle.mjs), so this is a real test of the gate, not a parallel
   re-implementation.

   It proves the gate:
     - is GREEN on a real theme flip   : a dark-canvas/light-ink render vs a light-canvas/dark-ink
                                         render (what a correctly-tokenised node set produces);
     - is RED on a theme-blind pair    : two renders with the SAME colours (a hardcoded-colour node
                                         that ignored the theme) but NOT byte-identical — so ONLY the
                                         cross-theme delta check can catch it (proves it bites);
     - is RED on a byte-identical pair : the most degenerate theme-blind case (dark === light);
     - is RED on a blank pair          : the non-empty half still applies to the graph oracle.

   A non-zero exit means the gate would NOT catch a graph theme-token regression.

   usage: CHROME_PATH=/path/to/chrome node scripts/check-graph-oracle.mjs */
import puppeteer from 'puppeteer-core'
import { writeFileSync, mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GraphThemeGate, MIN_THEME_DELTA, THEME_TOL } from './graph-oracle.mjs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

if (!existsSync(CHROME)) {
  console.error(
    `ERROR [check-graph-oracle.mjs] Chrome binary not found at: ${CHROME}\n` +
    `  What failed: puppeteer could not locate the browser used to synthesize + decode PNGs.\n` +
    `  Why: CHROME_PATH is unset or points to a missing file.\n` +
    `  Where: check-graph-oracle.mjs startup, binary check.\n` +
    `  Means: the gate self-check cannot run.\n` +
    `  Fix: set CHROME_PATH to your Chrome/Chromium binary, e.g.\n` +
    `    CHROME_PATH=/home/you/.nix-profile/bin/google-chrome node scripts/check-graph-oracle.mjs`,
  )
  process.exit(1)
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.goto('about:blank')

let failures = 0
const expect = async (label, wantThrow, fn) => {
  let err = null
  try { await fn() } catch (e) { err = e }
  const ok = wantThrow ? !!err : !err
  if (!ok) failures++
  let detail = ''
  if (err && wantThrow) detail = '  (rejected: ' + (err.message.split('\n')[1] || '').trim() + ')'
  if (err && !wantThrow) detail = '  (UNEXPECTED reject: ' + (err.message.split('\n')[1] || err.message.split('\n')[0]).trim() + ')'
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail}`)
}

const writePng = (file, dataUrl) => { writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64')); return file }
const tmp = mkdtempSync(join(tmpdir(), 'graph-oracle-'))

/* draw a node-catalog-like frame the way the oracle captures it: a CONSTANT neutral page background
   (held the same in both themes) with filled "node cards" whose surface + ink come from the theme.
   The cards are the non-background CONTENT the delta is measured against. `shift` nudges the card
   surface + ink by a sub-tolerance amount (< THEME_TOL) so two frames can be byte-DIFFERENT yet
   pixel-IDENTICAL under the diff tolerance — the exact shape of a hardcoded-colour (theme-blind)
   regression that the dup guard must NOT short-circuit. */
const GRAY = [128, 128, 128] // the constant page background (matches the oracle's ORACLE_BG)
const drawFrame = (surfaceRGB, inkRGB, shift = 0) =>
  page.evaluate((bg, surf, ink, sh) => {
    const w = 900, h = 660
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d')
    const s = (a) => `rgb(${Math.max(0, Math.min(255, a[0] + sh))},${Math.max(0, Math.min(255, a[1] + sh))},${Math.max(0, Math.min(255, a[2] + sh))})`
    x.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`; x.fillRect(0, 0, w, h)       // constant bg (never shifted)
    for (let row = 0; row < 6; row++) {
      const cy = 18 + row * 106
      x.fillStyle = s(surf); x.fillRect(40, cy, w - 80, 92)                       // card SURFACE (the dominant flipping area)
      x.strokeStyle = s(ink); x.lineWidth = 2; x.strokeRect(40, cy, w - 80, 92)   // border (ink)
      x.fillStyle = s(ink)
      for (let r2 = 0; r2 < 3; r2++) for (let t = 0; t < 17; t++) x.fillRect(56 + t * 48, cy + 14 + r2 * 22, 32, 8) // dense ink text bars
      // 6 distinct accent hues (theme-independent; one per card) — keeps the frame above the non-empty
      // distinct-colour floor even on a frozen-surface regression render, so the THEME-DELTA (not the
      // non-empty check) is what rejects the hardcode case. Small, so they barely dilute the flip ratio.
      const accents = [[196, 142, 36], [150, 110, 160], [122, 122, 60], [178, 90, 70], [80, 140, 150], [120, 90, 160]]
      const a = accents[row % accents.length]
      x.fillStyle = `rgb(${a[0]},${a[1]},${a[2]})`; x.fillRect(56, cy + 72, 130, 12)
    }
    return c.toDataURL('image/png')
  }, GRAY, surfaceRGB, inkRGB, shift)

const SURF_DARK = [19, 19, 19], SURF_LIGHT = [245, 243, 238]
const INK_LIGHT = [232, 228, 218], INK_DARK = [25, 25, 21]

console.log(`\n— GREEN: a correctly-tokenised node set re-themes (surface+ink flip on a constant bg) —`)
const themedDark = writePng(join(tmp, 'themed-dark.png'), await drawFrame(SURF_DARK, INK_LIGHT))
const themedLight = writePng(join(tmp, 'themed-light.png'), await drawFrame(SURF_LIGHT, INK_DARK))
await expect('green: dark-surface/light-ink vs light-surface/dark-ink', false,
  () => new GraphThemeGate(page).assert(themedDark, themedLight, { where: 'check-graph-oracle.mjs' }))

console.log(`\n— RED: single-colour hardcode / theme-blind / identical / blank renders must be rejected —`)
// single-colour hardcode (the realistic regression): the dominant card SURFACE is frozen to the dark
// literal in BOTH themes (a hardcoded var(--surface)); only the ink flips. The content-flip ratio
// collapses to ~0.5 — exactly the regression a low floor (e.g. 0.30) was blind to. The >= MIN_THEME_DELTA
// floor must reject it even though most other content still flips.
const hcDark = writePng(join(tmp, 'hc-dark.png'), await drawFrame(SURF_DARK, INK_LIGHT))
const hcLight = writePng(join(tmp, 'hc-light.png'), await drawFrame(SURF_DARK, INK_DARK)) // surface NOT flipped
await expect(`red on single-colour hardcode (frozen surface, ratio < ${MIN_THEME_DELTA.toFixed(2)})`, true,
  () => new GraphThemeGate(page).assert(hcDark, hcLight, { where: 'check-graph-oracle.mjs' }))

// theme-blind: identical node colours in both, but a sub-tolerance shift makes them byte-DIFFERENT, so
// the SurfaceGate dup guard does NOT fire and ONLY the content-relative delta check can reject it.
const blindA = writePng(join(tmp, 'blind-a.png'), await drawFrame(SURF_DARK, INK_LIGHT, 0))
const blindB = writePng(join(tmp, 'blind-b.png'), await drawFrame(SURF_DARK, INK_LIGHT, 8))
await expect(`red on theme-blind (nothing flips, ratio ~0)`, true,
  () => new GraphThemeGate(page).assert(blindA, blindB, { where: 'check-graph-oracle.mjs' }))

// byte-identical: the most degenerate theme-blind case (dark === light) — the dup guard catches it.
const dup = writePng(join(tmp, 'blind-dup.png'), 'data:image/png;base64,' + readFileSync(blindA).toString('base64'))
await expect('red on byte-identical pair (dark === light)', true,
  () => new GraphThemeGate(page).assert(blindA, dup, { where: 'check-graph-oracle.mjs' }))

// blank: a solid fill in both — the non-empty half rejects before any delta is considered.
const blank = writePng(join(tmp, 'blank.png'), await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 760; c.height = 560
  const x = c.getContext('2d'); x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}))
await expect('red on blank pair (non-empty assertion)', true,
  () => new GraphThemeGate(page).assert(blank, blank, { where: 'check-graph-oracle.mjs' }))

await browser.close()

if (failures) {
  console.error(
    `\nFAIL [check-graph-oracle.mjs] ${failures} gate self-check(s) failed.\n` +
    `  What failed: the graph node-visual theme gate did not behave as required above.\n` +
    `  Means: a theme-blind (hardcoded-colour) or blank graph render could slip through the parity oracle.\n` +
    `  Fix: inspect the FAIL rows — a green failure means the THEME_TOL/MIN_THEME_DELTA thresholds in\n` +
    `       graph-oracle.mjs are too strict (a real flip is being rejected); a red failure means they are\n` +
    `       too loose (a theme-blind pair is passing). Current floor: delta >= ${(MIN_THEME_DELTA * 100).toFixed(0)}%, tol ${THEME_TOL}/255.`,
  )
  process.exit(1)
}
console.log(`\nOK graph-oracle self-check passed: green on a real theme flip, red on theme-blind + identical + blank.`)

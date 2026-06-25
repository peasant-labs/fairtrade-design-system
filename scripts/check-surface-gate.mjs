/* self-check for the non-empty-surface gate — exercises the SAME SurfaceGate the capture harness runs
   in production (surface-gate.mjs), so this is a real test of the gate, not a parallel re-implementation.

   It proves the gate:
     - is GREEN on real captures   : every committed baseline PNG in <dir> passes (and is distinct);
     - is RED on a blank surface    : a synthesized solid-fill PNG is rejected;
     - is RED on a near-empty surface: a mostly-background PNG (below the nonbg ratio) is rejected;
     - is RED on a duplicate        : a byte-identical copy of a real surface is rejected.

   A non-zero exit means the gate would NOT catch the silent-blank / duplicate-surface regression.

   usage: CHROME_PATH=/path/to/chrome node scripts/check-surface-gate.mjs [dir]
     dir defaults to baselines/prelift (the committed golden baselines). */
import puppeteer from 'puppeteer-core'
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SurfaceGate } from './surface-gate.mjs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const dir = process.argv[2] || 'baselines/prelift'

if (!existsSync(CHROME)) {
  console.error(
    `ERROR [check-surface-gate.mjs] Chrome binary not found at: ${CHROME}\n` +
    `  What failed: puppeteer could not locate the browser used to decode PNGs.\n` +
    `  Why: CHROME_PATH is unset or points to a missing file.\n` +
    `  Where: check-surface-gate.mjs startup, binary check.\n` +
    `  Means: the gate self-check cannot run.\n` +
    `  Fix: set CHROME_PATH to your Chrome/Chromium binary, e.g.\n` +
    `    CHROME_PATH=/home/you/.nix-profile/bin/google-chrome node scripts/check-surface-gate.mjs`
  )
  process.exit(1)
}
if (!existsSync(dir)) {
  console.error(
    `ERROR [check-surface-gate.mjs] Baseline directory not found: ${dir}\n` +
    `  What failed: the directory of captured surfaces to validate does not exist.\n` +
    `  Where: check-surface-gate.mjs startup.\n` +
    `  Means: there are no real captures to prove the gate is green on.\n` +
    `  Fix: pass the directory of captured PNGs, e.g. node scripts/check-surface-gate.mjs baselines/prelift`
  )
  process.exit(1)
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.goto('about:blank')

let failures = 0
/* run `fn`; PASS when its throw-behaviour matches `wantThrow` */
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

/* write a base64 data-URL (produced by a page canvas) to a PNG file; returns the path */
const writePng = (file, dataUrl) => { writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64')); return file }

const tmp = mkdtempSync(join(tmpdir(), 'surface-gate-'))

console.log(`\n— GREEN: every captured surface in ${dir} must pass —`)
const pngs = readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
if (pngs.length === 0) {
  console.error(`ERROR [check-surface-gate.mjs] No .png files in ${dir} — nothing to validate.`)
  await browser.close(); process.exit(1)
}
const greenGate = new SurfaceGate(page) // shared instance also proves all baselines are mutually distinct
for (const f of pngs) {
  await expect(`green: ${f}`, false, () => greenGate.assert(f.replace(/\.png$/, ''), join(dir, f), { where: 'check-surface-gate.mjs' }))
}

console.log(`\n— RED: blank / near-empty / duplicate surfaces must be rejected —`)
// blank: a full-size solid fill (what the bug produced — uniform background, ~5.9KB)
const blank = writePng(join(tmp, 'blank.png'), await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 1396; c.height = 943
  const x = c.getContext('2d'); x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}))
await expect('red on blank (solid fill)', true, () => new SurfaceGate(page).assert('blank', blank, { where: 'check-surface-gate.mjs' }))

// near-empty: inflate the PNG well past the byte floor with faint dither, but keep the off-background
// share below the nonbg ratio — so ONLY the nonbg-ratio check can catch it (proves that check bites)
const nearEmpty = writePng(join(tmp, 'near-empty.png'), await page.evaluate(() => {
  const w = 1396, h = 943
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d'); x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, w, h)
  const img = x.getImageData(0, 0, w, h); const d = img.data
  // dither ~70% of pixels within +-8 of background (sub-threshold: stays < the 24-level nonbg cutoff)
  // so the file is large (clears the byte floor) yet nonbg ratio stays ~0
  for (let i = 0; i < d.length; i += 4) { if (Math.random() < 0.7) { const v = 4 + ((Math.random() * 14) | 0); d[i] = v; d[i + 1] = v; d[i + 2] = v } }
  x.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}))
await expect('red on near-empty (below nonbg ratio)', true, () => new SurfaceGate(page).assert('near-empty', nearEmpty, { where: 'check-surface-gate.mjs' }))

// duplicate: register a synthesized content-ful surface (self-contained, independent of the baselines),
// then feed a byte-identical copy under a different name — the dup guard must reject the second.
const real = writePng(join(tmp, 'real.png'), await page.evaluate(() => {
  const w = 600, h = 400
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d'); x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, w, h)
  for (let i = 0; i < 4000; i++) { x.fillStyle = `hsl(${(i * 37) % 360},70%,${30 + (i % 50)}%)`; x.fillRect((i * 53) % w, (i * 29) % h, 6, 6) }
  return c.toDataURL('image/png')
}))
const dupGate = new SurfaceGate(page)
await expect('green: synthesized content surface (dup-test fixture)', false, () => dupGate.assert('surface-one', real, { where: 'check-surface-gate.mjs' }))
const dup = writePng(join(tmp, 'dup.png'), 'data:image/png;base64,' + readFileSync(real).toString('base64'))
await expect('red on duplicate (byte-identical surface)', true, () => dupGate.assert('surface-two', dup, { where: 'check-surface-gate.mjs' }))

await browser.close()

if (failures) {
  console.error(
    `\nFAIL [check-surface-gate.mjs] ${failures} gate self-check(s) failed.\n` +
    `  What failed: the non-empty-surface gate did not behave as required above.\n` +
    `  Means: a blanked or duplicated capture could slip through and make the parity diff vacuous.\n` +
    `  Fix: inspect the FAIL rows — a green failure means a committed baseline is blank/empty/duplicated\n` +
    `       (re-capture it); a red failure means the gate thresholds in surface-gate.mjs are too loose.`
  )
  process.exit(1)
}
console.log(`\nOK surface gate self-check passed: green on all ${pngs.length} captured surfaces, red on blank + near-empty + duplicate.`)

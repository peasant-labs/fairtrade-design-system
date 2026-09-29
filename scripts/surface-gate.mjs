/* non-empty-surface gate — the parity oracle's content assertion.

   ONE implementation, imported by BOTH the capture harness (shootdemo.mjs, the production path that
   writes the baselines) and its self-check (check-surface-gate.mjs). There is no test-only copy.

   This file is a THIN app-owned compatibility facade over the browser-neutral Fairtest policy core.
   The generic pass/fail evaluation (byte floor, selected fraction, distinct-sample count) is
   delegated to the neutral core through the single app-side source route; a digest and a
   per-instance duplicate scope come from the same core. What stays app-owned here is exactly the
   Fairtrade-specific material:
     - the PNG decode (a headless-page canvas, so there is no extra dependency);
     - the per-surface floor NAMES (`txn-scrubber`), which generic policy must never learn;
     - the legacy return keys and the actionable `sel` / `where` diagnostics every current consumer
       reads.

   A blank / near-empty capture has a perfectly valid bounding box but paints only the background
   colour, so a box-size check cannot catch it — that is the silent-blank hole this gate closes.
   The gate decodes the PNG and FAILS unless the capture carries real content:
     - byte size      >= a per-surface floor (a full-size background-only PNG is ~5.9KB);
     - non-background  >= a minimum share of pixels differ from the dominant (background) colour;
     - distinct colour >= a minimum (a flat fill resolves to a single colour);
     - uniqueness      : no two DISTINCT surfaces may be byte-identical (the old bug produced seven
                         identical 5,891-byte blanks across totally different surfaces).

   Thresholds are calibrated against measured populations (both themes):
     blank capture : nonbg 0.00%, 1 distinct colour, ~5.9KB full-size  (what the bug produced)
     real content  : nonbg 2.46%..23.2%, 9..161 colours, 35KB..176KB full / 491..645B scrubber
   each bound sits strictly between the two populations, so the gate fails every blank and passes
   every real surface. */

import { readFileSync } from 'node:fs'
import { importFairtestSource } from './fairtest-source.mjs'

/* the neutral, browser-free policy core: generic measurement policy, a caller-chosen digest, and a
   caller-scoped duplicate set. Loaded through the single app-side source route; this wrapper is the
   only place that binds Fairtrade names and floors to it. */
const core = await importFairtestSource('src/core/index.mjs')
const { checkDuplicate, createDuplicateSet, createMeasurementPolicy, digestHex, evaluateMeasurement } = core

export const DEFAULT_MIN_BYTES = 16 * 1024 // a full-size background-only PNG is ~5.9KB; the smallest real full surface (scorecard) is ~35KB
export const BYTE_FLOORS = { 'txn-scrubber': 400 } // the scrubber is a genuinely tiny 697x22 tick bar (~0.5-0.65KB real); its content signal is the nonbg ratio + colour count, not byte size
export const MIN_NONBG_RATIO = 0.012 // blank = 0.00%; the least-busy real surface diverges from its background by >= 2.46%
export const MIN_DISTINCT_COLORS = 6 // a flat fill resolves to 1 colour; the sparsest real surface (the scrubber) has 9

/* decode a PNG and measure: non-background-pixel ratio, dominant-colour share, distinct colours.
   the dominant colour is the mode over a 4-bit-per-channel quantization — for a blank capture that is
   ~100% of the image; for a real capture the background still wins, but a real fraction of pixels
   diverge from it. `page` is any puppeteer Page (used only as a dependency-free PNG decoder). */
export const measurePng = (page, dataUrl) =>
  page.evaluate(async (url) => {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('PNG decode failed')); i.src = url })
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height
    const x = c.getContext('2d'); x.drawImage(im, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data
    const n = d.length / 4
    const hist = new Map()
    for (let i = 0; i < d.length; i += 4) {
      const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4) // 4-bit/channel bucket
      hist.set(key, (hist.get(key) || 0) + 1)
    }
    let bgKey = 0, bgCount = -1
    for (const [k, v] of hist) if (v > bgCount) { bgCount = v; bgKey = k }
    const bgR = ((bgKey >> 8) & 0xf) << 4, bgG = ((bgKey >> 4) & 0xf) << 4, bgB = (bgKey & 0xf) << 4
    let nonbg = 0
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - bgR) > 24 || Math.abs(d[i + 1] - bgG) > 24 || Math.abs(d[i + 2] - bgB) > 24) nonbg++
    }
    return { w: im.width, h: im.height, pixels: n, nonbgRatio: nonbg / n, bgShare: bgCount / n, distinctColors: hist.size }
  }, dataUrl)

/* the app-owned policy for one surface: the Fairtrade floor names live HERE, never in core. Surfaces
   are captured as "<surface>" (per-theme dir) and stored as "<surface>-<theme>"; accept either form. */
const floorFor = (name) => {
  const baseName = name.replace(/-(dark|light)$/, '')
  return BYTE_FLOORS[name] ?? BYTE_FLOORS[baseName] ?? DEFAULT_MIN_BYTES
}
const policyFor = (name) => createMeasurementPolicy({
  version: 1,
  minBytes: floorFor(name),
  minDistinct: MIN_DISTINCT_COLORS,
  minFraction: MIN_NONBG_RATIO,
})

/* SurfaceGate tracks the per-run set of accepted captures so it can reject byte-identical duplicates.
   construct one per capture run; call assert() after writing each surface PNG. */
export class SurfaceGate {
  constructor(page) {
    this.page = page
    this.seen = new Map() // md5(file bytes) -> surface name
    this.duplicates = createDuplicateSet('surface-gate') // neutral caller-scoped duplicate set
  }

  /* measure a PNG without enforcing — returns { bytes, md5, w, h, pixels, nonbgRatio, bgShare, distinctColors }.
     the legacy keys are mapped explicitly (not spread) so the preserved return contract is visible and
     guarded here rather than hidden behind the decoder. */
  async measure(file) {
    const buf = readFileSync(file)
    const m = await measurePng(this.page, 'data:image/png;base64,' + buf.toString('base64'))
    return {
      bytes: buf.length,
      md5: digestHex(buf, 'md5'),
      w: m.w,
      h: m.h,
      pixels: m.pixels,
      nonbgRatio: m.nonbgRatio,
      bgShare: m.bgShare,
      distinctColors: m.distinctColors,
    }
  }

  /* enforce the gate for one surface; throws an actionable error on any blank/near-empty/duplicate.
     `where` names the caller (e.g. "shootdemo.mjs") so the error points at the right place. */
  async assert(name, file, { sel = '', where = 'surface-gate' } = {}) {
    const r = await this.measure(file)
    const fail = (what, why, fix) => {
      throw new Error(
        `ERROR [${where}] Non-empty-surface assertion failed for "${name}".\n` +
        `  What failed: ${what}\n` +
        `  Why: ${why}\n` +
        `  Where: surface-gate.mjs SurfaceGate.assert("${name}", "${file}")${sel ? ` — selector "${sel}"` : ''}.\n` +
        `  Means: the captured PNG is blank/near-empty/duplicated, so the pre/post parity diff would\n` +
        `         compare an empty surface and pass vacuously (the failure mode this gate exists to stop).\n` +
        `  Fix: ${fix}`
      )
    }
    const policy = policyFor(name)
    /* the caller-owned neutral policy evaluates every generic bound; this facade maps a violated
       bound back to its legacy, actionable message in the original threshold order. */
    const verdict = evaluateMeasurement({ bytes: r.bytes, distinct: r.distinctColors, fraction: r.nonbgRatio, digest: r.md5 }, policy)
    const violated = (needle) => verdict.failures.find((entry) => entry.includes(needle))
    if (violated('measurement.bytes')) fail(
      `PNG is ${r.bytes} bytes (< ${policy.minBytes} floor for "${name}").`,
      `a background-only capture of this size compresses to ~5.9KB; the surface did not paint content.`,
      `confirm the navigation step that reveals "${name}" ran, and that the live-compositor capture (captureBeyondViewport:false) saw it on-screen.`)
    if (violated('measurement.fraction')) fail(
      `only ${(r.nonbgRatio * 100).toFixed(2)}% of pixels differ from the background (need >= ${(MIN_NONBG_RATIO * 100).toFixed(1)}%); background fills ${(r.bgShare * 100).toFixed(1)}%.`,
      `the capture is a near-uniform fill — the surface rendered blank even though its box was valid.`,
      `ensure the surface actually mounted with content before capture (check the preceding nav/interaction step).`)
    if (violated('measurement.distinct')) fail(
      `only ${r.distinctColors} distinct colours (need >= ${MIN_DISTINCT_COLORS}).`,
      `a real surface (text, icons, borders) resolves to many colours; a flat fill resolves to a few.`,
      `confirm the surface rendered real UI, not an empty/placeholder state.`)
    const duplicate = checkDuplicate(this.duplicates, r.md5)
    if (duplicate.duplicate) fail(
      `byte-identical (md5 ${r.md5.slice(0, 12)}) to an already-captured surface "${this.seen.get(r.md5)}".`,
      `two distinct surfaces produced the exact same PNG — at least one captured the wrong (or a blank) view.`,
      `verify the navigation between "${this.seen.get(r.md5)}" and "${name}" actually changed what is on screen.`)
    this.duplicates = duplicate.updated
    this.seen.set(r.md5, name)
    return r
  }
}

// Preservation guard for SurfaceGate and the specialized Puppeteer probes.
//
// This work does not migrate, weaken, or delete the surface gate or any
// specialized probe. This module proves preservation instead of asserting it:
// - the public API of scripts/surface-gate.mjs keeps its exact exports,
//   thresholds, and legacy measure()/assert() return keys; any disappearance
//   or change fails;
// - every specialized probe file still exists, still parses, and still has
//   at least one live wiring (a static import of the shared gate, a root
//   script invocation, a workflow invocation, or a named pointer in the gate
//   header). Reference counts are reported; nothing is deleted.
// Runs with node --test and starts no browser: the fake page stands in for
// the Puppeteer PNG decoder, which the pinned browser job covers.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const gate = await import('./surface-gate.mjs')

/** Specialized probe files under protection. Exact set, frozen. */
const PROBE_FILES = [
  'scripts/shootdemo.mjs',
  'scripts/shootmanage.mjs',
  'scripts/timeline-rendered-probe.mjs',
  'scripts/pi-transcript.probe.mjs',
  'scripts/graph-oracle.mjs',
  'scripts/check-surface-gate.mjs',
  'scripts/check-graph-oracle.mjs',
]

/**
 * Build a fake page whose PNG decode returns one canned measurement, so
 * measure()/assert() policy is proven without a browser.
 * @param {object} decode canned decode result
 */
function fakeDecodePage(decode) {
  return {
    evaluate: async () => ({ ...decode }),
  }
}

/** Write a temp file with exactly size bytes and return its path. */
function tempBytes(dir, name, size) {
  const path = join(dir, name)
  writeFileSync(path, randomBytes(size))
  return path
}

describe('surface gate public surface', () => {
  it('keeps the exact export set with no additions or removals', () => {
    assert.deepEqual(
      Object.keys(gate).sort(),
      ['BYTE_FLOORS', 'DEFAULT_MIN_BYTES', 'MIN_DISTINCT_COLORS', 'MIN_NONBG_RATIO', 'SurfaceGate', 'measurePng'],
      'surface-gate public exports must stay exact at path surface-gate.exports; repair: restore the removed export or remove the added one.',
    )
    assert.equal(typeof gate.measurePng, 'function', 'measurePng must stay exported')
    assert.equal(typeof gate.SurfaceGate, 'function', 'SurfaceGate must stay exported')
  })

  it('keeps every threshold byte-identical', () => {
    assert.equal(gate.DEFAULT_MIN_BYTES, 16 * 1024, 'DEFAULT_MIN_BYTES must stay 16KB at path surface-gate.DEFAULT_MIN_BYTES; repair: restore the 16KB floor.')
    assert.deepEqual(gate.BYTE_FLOORS, { 'txn-scrubber': 400 }, 'BYTE_FLOORS must keep exactly the scrubber exception at path surface-gate.BYTE_FLOORS; repair: restore the scrubber floor.')
    assert.equal(gate.MIN_NONBG_RATIO, 0.012, 'MIN_NONBG_RATIO must stay 0.012 at path surface-gate.MIN_NONBG_RATIO; repair: restore the ratio floor.')
    assert.equal(gate.MIN_DISTINCT_COLORS, 6, 'MIN_DISTINCT_COLORS must stay 6 at path surface-gate.MIN_DISTINCT_COLORS; repair: restore the colour floor.')
  })

  it('keeps the legacy measure() return keys', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fairtest-surface-measure-'))
    const file = tempBytes(dir, 'real.png', 20 * 1024)
    const page = fakeDecodePage({ w: 800, h: 600, pixels: 480000, nonbgRatio: 0.05, bgShare: 0.9, distinctColors: 20 })
    const measured = await new gate.SurfaceGate(page).measure(file)
    assert.deepEqual(
      Object.keys(measured).sort(),
      ['bgShare', 'bytes', 'distinctColors', 'h', 'md5', 'nonbgRatio', 'pixels', 'w'],
      'measure() must keep its legacy return keys at path surface-gate.measure; repair: restore the missing key.',
    )
    assert.equal(measured.bytes, 20 * 1024)
    assert.match(measured.md5, /^[0-9a-f]{32}$/, 'measure() must keep reporting the md5 digest')
  })

  it('still fails blank, near-empty, and duplicate captures and passes real ones', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fairtest-surface-assert-'))
    const real = tempBytes(dir, 'real.png', 20 * 1024)
    const tiny = tempBytes(dir, 'tiny.png', 100)
    const lush = { w: 800, h: 600, pixels: 480000, nonbgRatio: 0.05, bgShare: 0.9, distinctColors: 20 }
    const passed = await new gate.SurfaceGate(fakeDecodePage(lush)).assert('probe-real', real, { where: 'surface-preservation' })
    assert.equal(passed.bytes, 20 * 1024, 'passing assert() must return the measurement')
    await assert.rejects(
      () => new gate.SurfaceGate(fakeDecodePage(lush)).assert('probe-tiny', tiny, { where: 'surface-preservation' }),
      /bytes.*floor/,
      'a tiny capture must fail the byte floor',
    )
    await assert.rejects(
      () => new gate.SurfaceGate(fakeDecodePage({ ...lush, nonbgRatio: 0.0 })).assert('probe-blank', real, { where: 'surface-preservation' }),
      /differ from the background/,
      'a blank capture must fail the non-background ratio',
    )
    await assert.rejects(
      () => new gate.SurfaceGate(fakeDecodePage({ ...lush, distinctColors: 2 })).assert('probe-flat', real, { where: 'surface-preservation' }),
      /distinct colours/,
      'a flat capture must fail the colour count',
    )
    const dupGate = new gate.SurfaceGate(fakeDecodePage(lush))
    await dupGate.assert('probe-first', real, { where: 'surface-preservation' })
    await assert.rejects(
      () => dupGate.assert('probe-second', real, { where: 'surface-preservation' }),
      /byte-identical/,
      'a duplicate capture must fail the uniqueness scope',
    )
  })
})

describe('specialized probe preservation', () => {
  it('keeps every probe file present, parsing, and live-wired', () => {
    const packageText = readFileSync(join(ROOT, 'package.json'), 'utf8')
    const gateText = readFileSync(join(HERE, 'surface-gate.mjs'), 'utf8')
    let workflowText = ''
    try {
      workflowText = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')
    } catch {
      workflowText = ''
    }
    const scriptTexts = {}
    for (const file of PROBE_FILES) {
      scriptTexts[file] = readFileSync(join(ROOT, file), 'utf8')
    }
    for (const file of PROBE_FILES) {
      const base = file.split('/').pop().replace(/\.mjs$/, '')
      const text = scriptTexts[file]
      execFileSync('node', ['--check', file], { cwd: ROOT, stdio: 'pipe' })
      assert.ok(text.trim().length > 500, `${file}: probe body looks gutted at path ${file}; repair: restore the probe implementation.`)
      const importsGate = /from '\.\/(surface-gate|graph-oracle)\.mjs'/.test(text)
      const scriptHits = packageText.split(`${base}.mjs`).length - 1
      const workflowHits = workflowText.split(base).length - 1
      const headerPointers = gateText.split(base).length - 1
      let crossRefs = 0
      for (const [other, otherText] of Object.entries(scriptTexts)) {
        if (other !== file && otherText.includes(`${base}.mjs`)) crossRefs += 1
      }
      const wired = importsGate || scriptHits > 0 || workflowHits > 0 || headerPointers > 0 || crossRefs > 0
      console.log(`PROBE ${file} :: importsGate=${importsGate} scripts=${scriptHits} workflows=${workflowHits} gateHeader=${headerPointers} crossRefs=${crossRefs}`)
      assert.ok(wired, `${file}: probe has no live wiring at path ${file}; repair: keep at least one import, script, workflow, or gate-header reference before any follow-up decision.`)
    }
  })
})

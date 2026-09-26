// Preservation guard for SurfaceGate and the specialized Puppeteer probes.
//
// This work does not migrate, weaken, or delete the surface gate or any
// specialized probe. This module proves preservation instead of asserting it:
// - the public API of scripts/surface-gate.mjs keeps its exact exports,
//   thresholds, and legacy measure()/assert() return keys; any disappearance
//   or change fails;
// - every declared specialized probe file (the required-name inventory in
//   scripts/testdata/probe-preservation.testdata.yaml) still exists, still
//   parses, and still has at least one live wiring (a static import of the
//   shared gate, a root script invocation, a workflow invocation, or a named
//   pointer in the gate header). Reference counts are reported; nothing is
//   deleted. The inventory is closed in both directions against the
//   scripts/ directory, so a planted probe file, a dropped inventory row, or
//   a deleted probe file each turns the guard red for its own reason.
// Runs with node --test and starts no browser: the fake page stands in for
// the Puppeteer PNG decoder, which the pinned browser job covers.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const PROBE_CORPUS_REL = 'scripts/testdata/probe-preservation.testdata.yaml'
const PROBE_MANIFEST_REL = 'scripts/testdata/probe-preservation.testdata.manifest.yaml'

const gate = await import('./surface-gate.mjs')

/**
 * Parse exactly one YAML document, refusing trailing documents and non-record
 * roots.
 * @param {string} source YAML text
 * @param {string} label diagnostic label naming the file
 * @returns {Record<string, unknown>} the parsed record
 */
function loadSingleDocument(source, label) {
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  if (documents.length !== 1) {
    throw new Error(`${label}: fixture must hold exactly one document at path document; repair: remove every trailing document from ${label}.`)
  }
  const [parsed] = documents
  if (parsed.errors.length > 0) {
    throw new Error(`${label}: invalid YAML at path document; ${parsed.errors.map((entry) => entry.message).join('; ')}; repair: fix the YAML syntax in ${label}.`)
  }
  const value = parsed.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}: document root must be a record at path document; repair: restore the mapping root in ${label}.`)
  }
  return value
}

/** Assert the record holds exactly the declared fields. */
function checkKeys(value, fields, tag, label, path) {
  const where = path ? ` at path ${path}` : ''
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${tag}: record is missing or malformed${where} in ${label}; repair: restore the record with exactly: ${fields.join(', ')}.`)
  }
  for (const field of fields) {
    if (!(field in value)) {
      throw new Error(`${tag}: missing required field "${field}"${where} in ${label}; repair: restore "${field}" in ${label}.`)
    }
  }
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) {
      throw new Error(`${tag}: unknown field "${key}"${where} in ${label}; repair: remove "${key}" from ${label}.`)
    }
  }
}

/** Assert the actual names match the required inventory exactly, with no duplicates. */
function checkRequiredNames(actual, required, label, kind) {
  if (new Set(actual).size !== actual.length) {
    throw new Error(`${label}: duplicate ${kind} name at path ${kind}s; repair: give every ${kind} a unique required name.`)
  }
  for (const name of required) {
    if (!actual.includes(name)) {
      throw new Error(`${label}: required ${kind} inventory mismatch at path ${kind}s; missing required ${kind} "${name}"; repair: restore the "${name}" row or update the manifest required names.`)
    }
  }
  for (const name of actual) {
    if (!required.includes(name)) {
      throw new Error(`${label}: required ${kind} inventory mismatch at path ${kind}s; unknown ${kind} "${name}"; repair: remove the "${name}" row or register it in the manifest required names.`)
    }
  }
}

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

/**
 * The name patterns that make a scripts/ file a specialized probe on sight.
 * A file matching either pattern must be declared in the probe inventory, so
 * a planted probe cannot sit beside the guarded copies ungoverned.
 * @type {RegExp[]}
 */
const PROBE_NAME_PATTERNS = Object.freeze([/\.probe\.mjs$/, /-probe\.mjs$/])

/**
 * Derive the specialized-probe names under a scripts directory: every .mjs
 * file whose name matches a probe pattern, as repository-relative paths.
 * @param {string} scriptsDir directory holding the probe scripts
 * @returns {string[]} repository-relative probe names, sorted
 */
function deriveProbeNames(scriptsDir) {
  return readdirSync(scriptsDir)
    .filter((name) => name.endsWith('.mjs') && PROBE_NAME_PATTERNS.some((pattern) => pattern.test(name)))
    .map((name) => `scripts/${name}`)
    .sort()
}

/**
 * Validate the probe manifest: exact keys, a required-name inventory that is
 * unique and matches the declared count, and executable mutations of a
 * declared kind.
 * @param {Record<string, unknown>} manifest parsed manifest
 */
function validateProbeManifest(manifest) {
  checkKeys(manifest, ['expectedProbeCount', 'requiredProbeNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'probe manifest record', PROBE_MANIFEST_REL, 'manifest')
  const names = /** @type {string[]} */ (manifest.requiredProbeNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(names).size, names.length, `${PROBE_MANIFEST_REL}: required probe names must be unique at path manifest.requiredProbeNames; repair: list every guarded probe once.`)
  assert.equal(manifest.expectedProbeCount, names.length, `${PROBE_MANIFEST_REL}: probe count must equal the required-name inventory at path manifest.expectedProbeCount; repair: align expectedProbeCount with requiredProbeNames.`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${PROBE_MANIFEST_REL}: mutation count must equal the mutation inventory at path manifest.expectedMutationCount; repair: align expectedMutationCount with mutations.`)
  checkRequiredNames(mutations.map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredMutationNames), PROBE_MANIFEST_REL, 'mutation')
  for (const mutation of mutations) {
    if (mutation.kind === 'delete-record') {
      checkKeys(mutation, ['name', 'kind', 'target', 'expectedField'], 'probe mutation record', PROBE_MANIFEST_REL, `manifest.mutations.${String(mutation.name)}`)
      assert.ok(names.includes(String(mutation.target)), `${PROBE_MANIFEST_REL}: mutation ${String(mutation.name)} targets an unknown probe at path manifest.mutations.${String(mutation.name)}.target; repair: target one of the required probe names.`)
    } else if (mutation.kind === 'planted-probe-file') {
      checkKeys(mutation, ['name', 'kind', 'value', 'expectedField'], 'probe mutation record', PROBE_MANIFEST_REL, `manifest.mutations.${String(mutation.name)}`)
      assert.ok(/\.probe\.mjs$/.test(String(mutation.value)), `${PROBE_MANIFEST_REL}: mutation ${String(mutation.name)} must plant a name matching a probe pattern at path manifest.mutations.${String(mutation.name)}.value; repair: plant a *.probe.mjs name.`)
    } else {
      throw new Error(`${PROBE_MANIFEST_REL}: mutation ${String(mutation.name)} names an unknown kind ${JSON.stringify(mutation.kind)} at path manifest.mutations.${String(mutation.name)}.kind; repair: use delete-record or planted-probe-file.`)
    }
  }
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
  const manifest = /** @type {Record<string, unknown>} */ (loadSingleDocument(readFileSync(resolve(ROOT, PROBE_MANIFEST_REL), 'utf8'), PROBE_MANIFEST_REL))
  const corpus = /** @type {Record<string, unknown>} */ (loadSingleDocument(readFileSync(resolve(ROOT, PROBE_CORPUS_REL), 'utf8'), PROBE_CORPUS_REL))

  it('holds a valid probe manifest inventory', () => {
    validateProbeManifest(manifest)
  })

  it('keeps the declared inventory closed against the scripts directory', () => {
    const declared = /** @type {string[]} */ (corpus.requiredProbeNames)
    assert.ok(Array.isArray(declared) && declared.length > 0, `${PROBE_CORPUS_REL}: record holds no probe names at path requiredProbeNames; repair: restore the required-name probe inventory.`)
    assert.equal(declared.length, manifest.expectedProbeCount, `${PROBE_CORPUS_REL}: probe count must match the manifest at path expectedProbeCount; repair: align the probe list with the manifest.`)
    checkRequiredNames(declared, /** @type {string[]} */ (manifest.requiredProbeNames), PROBE_CORPUS_REL, 'probe')
    // Two-way directory closure. A planted or renamed probe file that no row
    // declares is ungoverned; a declared row the directory no longer holds is
    // a phantom. Either way the repair names the file.
    const derived = deriveProbeNames(HERE)
    const unclassified = derived.filter((name) => !declared.includes(name))
    assert.deepEqual(
      unclassified,
      [],
      `${PROBE_CORPUS_REL}: probe ${JSON.stringify(unclassified[0])} matches a probe-name pattern but is not declared in the required inventory at path requiredProbeNames; repair: add ${JSON.stringify(unclassified[0])} to the inventory or rename it out of the probe namespace.`,
    )
    const missing = declared.filter((name) => !existsSync(resolve(ROOT, name)))
    assert.deepEqual(
      missing,
      [],
      `${PROBE_CORPUS_REL}: declared probe ${JSON.stringify(missing[0])} does not exist under scripts/ at path requiredProbeNames; repair: restore the probe file or drop its row.`,
    )
  })

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
    for (const file of /** @type {string[]} */ (corpus.requiredProbeNames)) {
      scriptTexts[file] = readFileSync(join(ROOT, file), 'utf8')
    }
    for (const file of /** @type {string[]} */ (corpus.requiredProbeNames)) {
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

  it('fails every probe-inventory mutation for its intended field', () => {
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'delete-record') {
          const declared = /** @type {string[]} */ (corpus.requiredProbeNames).filter((name) => name !== mutation.target)
          checkRequiredNames(declared, /** @type {string[]} */ (manifest.requiredProbeNames), PROBE_CORPUS_REL, 'probe')
        } else if (mutation.kind === 'planted-probe-file') {
          // The closure runs against a scratch copy of the directory, so the
          // planted name never touches the real tree.
          const scratch = mkdtempSync(join(tmpdir(), 'fairtest-probe-plant-'))
          try {
            const planted = String(mutation.value)
            writeFileSync(join(scratch, planted), '// planted uncatalogued probe\n')
            const derived = deriveProbeNames(scratch)
            const declared = /** @type {string[]} */ (corpus.requiredProbeNames)
            const unclassified = derived.filter((name) => !declared.includes(name))
            assert.deepEqual(
              unclassified,
              [],
              `${PROBE_CORPUS_REL}: probe ${JSON.stringify(unclassified[0])} matches a probe-name pattern but is not declared in the required inventory at path requiredProbeNames; repair: add ${JSON.stringify(unclassified[0])} to the inventory or rename it out of the probe namespace.`,
            )
          } finally {
            rmSync(scratch, { recursive: true, force: true })
          }
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${String(mutation.name)}: mutated inventory passed instead of failing`)
      assert.ok(message.includes(String(mutation.expectedField)), `${String(mutation.name)}: diagnostic names the wrong field; expected ${String(mutation.expectedField)}, received ${message}`)
    }
  })
})

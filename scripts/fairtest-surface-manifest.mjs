#!/usr/bin/env node
// Exact SurfaceGate / GraphThemeGate consumer and export manifest guard.
//
// scripts/surface-gate.mjs is a protected tool with live importer families. This
// guard proves the app-owned compatibility facade still exposes the exact public
// surface every consumer reads, still binds the Fairtrade floor names only in the
// facade, and still holds exactly the six current importer families. Every
// export, importer, floor, threshold, return key, graph export, and neutral probe
// lives in scripts/testdata/fairtest-surface-consumers.yaml plus its required-name
// manifest; this file owns no case data. Each named source-drift mutation is
// executed against a scratch copy of the real facade and must fail for its own
// field. Browser-free: node builtins plus the declared yaml developer dependency;
// no service and no browser.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { importFairtestSource } from './fairtest-source.mjs'
import { loadSingleDocument } from './fairtest-single-document.mjs'

const HERE = dirname(fileURLToPath(import.meta.url)) // scripts/
const ROOT = resolve(HERE, '..')
const CORPUS_REL = 'scripts/testdata/fairtest-surface-consumers.yaml'
const MANIFEST_REL = 'scripts/testdata/fairtest-surface-consumers.manifest.yaml'
const SURFACE_GATE_REL = 'surface-gate.mjs'
const SOURCE_ROUTE_MARKER = "'./fairtest-source.mjs'"
const MUTATION_KINDS = ['source-runtime', 'source-text', 'importer-drop', 'importer-plant', 'importer-binding', 'importer-classification', 'neutral-name']
const EXPORT_KINDS = ['value', 'function', 'class']
// Closed consumer disposition vocabulary. `required-gate` is the cheap
// importer/signature/policy gate a bounded command runs; `protected-specialized`
// is the expensive screenshot compatibility evidence that stays present,
// un-migrated, and OUT of the required CI job unless a bounded check is
// explicitly wired for it. No third disposition exists.
const REQUIRED_GATE = 'required-gate'
const PROTECTED_SPECIALIZED = 'protected-specialized'
const CLASSIFICATIONS = [REQUIRED_GATE, PROTECTED_SPECIALIZED]
const REQUIRED_CI_REL = '.github/workflows/ci.yml'
const THRESHOLD_EXPORTS = { 'min-nonbg-ratio': 'MIN_NONBG_RATIO', 'min-distinct-colors': 'MIN_DISTINCT_COLORS' }
const LUSH = { w: 800, h: 600, pixels: 480000, nonbgRatio: 0.05, bgShare: 0.9, distinctColors: 20 }
const IMPORT_RE = /from\s+'\.\/surface-gate\.mjs'/
const BINDING_RE = /import\s*\{([^}]*)\}\s*from\s+'\.\/surface-gate\.mjs'/

/** @param {unknown} value */
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

/** @param {string} message @returns {never} */
function fail(message) {
  throw new Error(message)
}

/** @param {unknown} value @param {string[]} fields @param {string} tag @param {string} label @param {string} [path] */
function checkKeys(value, fields, tag, label, path = '') {
  const where = path ? ` at path ${path}` : ''
  if (!isRecord(value)) {
    fail(`${tag}: record is missing or malformed${where} in ${label}; repair: restore the record with exactly: ${fields.join(', ')}.`)
  }
  for (const field of fields) {
    if (!(field in value)) fail(`${tag}: missing required field "${field}"${where}; repair: restore "${field}" in ${label}.`)
  }
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) fail(`${tag}: unknown field "${key}"${where}; repair: remove "${key}" from ${label}.`)
  }
}

/** @param {unknown} value @param {string} field @param {string} path @param {string} label */
function checkText(value, field, path, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${label}: missing or invalid field "${field}" at path ${path}; repair: restore a non-empty "${field}".`)
  }
}

/** @param {string[]} actual @param {string[]} required @param {string} label @param {string} kind @param {string} path */
function checkRequiredNames(actual, required, label, kind, path) {
  if (new Set(actual).size !== actual.length) {
    fail(`${label}: duplicate ${kind} name at path ${path}; repair: give every ${kind} a unique required name.`)
  }
  for (const name of required) {
    if (!actual.includes(name)) {
      fail(`${label}: required ${kind} inventory mismatch at path ${path}; missing required ${kind} "${name}"; repair: restore the "${name}" row or update the manifest required names.`)
    }
  }
  for (const name of actual) {
    if (!required.includes(name)) {
      fail(`${label}: required ${kind} inventory mismatch at path ${path}; unknown ${kind} "${name}"; repair: remove the "${name}" row or register it in the manifest required names.`)
    }
  }
}

/** @param {Record<string, unknown>} manifest @param {string} label */
function validateManifest(manifest, label) {
  checkKeys(manifest, ['expectedExportCount', 'requiredExportNames', 'expectedImporterCount', 'requiredImporterPaths', 'expectedRequiredGateImporterCount', 'requiredGateImporterPaths', 'expectedFloorCount', 'requiredFloorNames', 'expectedThresholdCount', 'requiredThresholdNames', 'expectedReturnKeyCount', 'requiredReturnKeys', 'expectedGraphExportCount', 'requiredGraphExportNames', 'expectedNeutralProbeCount', 'requiredNeutralProbeNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'manifest', label)
  const groups = [
    ['expectedExportCount', 'requiredExportNames'],
    ['expectedImporterCount', 'requiredImporterPaths'],
    ['expectedRequiredGateImporterCount', 'requiredGateImporterPaths'],
    ['expectedFloorCount', 'requiredFloorNames'],
    ['expectedThresholdCount', 'requiredThresholdNames'],
    ['expectedReturnKeyCount', 'requiredReturnKeys'],
    ['expectedGraphExportCount', 'requiredGraphExportNames'],
    ['expectedNeutralProbeCount', 'requiredNeutralProbeNames'],
  ]
  for (const [countField, namesField] of groups) {
    const names = manifest[namesField]
    assert.ok(Array.isArray(names) && names.length > 0, `${label}: ${namesField} must be a non-empty list at path manifest.${namesField}; repair: restore the required-name inventory.`)
    assert.equal(manifest[countField], names.length, `${label}: ${countField} must equal ${namesField}.length at path manifest.${countField}; repair: align the count with the required-name inventory.`)
    assert.equal(new Set(names).size, names.length, `${label}: ${namesField} must be unique at path manifest.${namesField}; repair: list every name once.`)
  }
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.ok(Array.isArray(mutations) && mutations.length > 0, `${label}: mutations must be a non-empty list at path manifest.mutations; repair: restore the mutation inventory.`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${label}: expectedMutationCount must equal mutations.length; repair: align expectedMutationCount.`)
  checkRequiredNames(mutations.map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredMutationNames), label, 'mutation', 'manifest.requiredMutationNames')
  for (const [index, mutation] of mutations.entries()) {
    const path = `manifest.mutations.${String(mutation.name)}`
    const fields = ['name', 'kind', 'expectedField']
    if (mutation.kind === 'source-runtime' || mutation.kind === 'source-text') fields.push('find', 'replace')
    if (mutation.kind === 'importer-drop' || mutation.kind === 'importer-binding' || mutation.kind === 'importer-classification') fields.push('target')
    if (mutation.kind === 'importer-plant' || mutation.kind === 'importer-binding' || mutation.kind === 'importer-classification' || mutation.kind === 'neutral-name') fields.push('value')
    checkKeys(mutation, fields, `mutation ${index}`, label, path)
    assert.ok(MUTATION_KINDS.includes(/** @type {string} */ (mutation.kind)), `${label}: unknown mutation kind ${JSON.stringify(mutation.kind)} at path ${path}.kind; repair: use one of ${MUTATION_KINDS.join(', ')}.`)
    assert.ok(typeof mutation.expectedField === 'string' && mutation.expectedField.length > 0, `${label}: mutation ${String(mutation.name)} must name its intended field at path ${path}.expectedField; repair: name the field the mutation must fail on.`)
    if (mutation.kind === 'importer-drop') {
      assert.ok(/** @type {string[]} */ (manifest.requiredImporterPaths).includes(/** @type {string} */ (mutation.target)), `${label}: mutation ${String(mutation.name)} targets an unknown importer at path ${path}.target; repair: target one of the required importer paths.`)
    }
    if (mutation.kind === 'importer-binding') {
      assert.ok(/** @type {string[]} */ (manifest.requiredImporterPaths).includes(/** @type {string} */ (mutation.target)), `${label}: mutation ${String(mutation.name)} targets an unknown importer at path ${path}.target; repair: target one of the required importer paths.`)
    }
    if (mutation.kind === 'importer-classification') {
      assert.ok(/** @type {string[]} */ (manifest.requiredImporterPaths).includes(/** @type {string} */ (mutation.target)), `${label}: mutation ${String(mutation.name)} targets an unknown importer at path ${path}.target; repair: target one of the required importer paths.`)
      assert.ok(CLASSIFICATIONS.includes(/** @type {string} */ (mutation.value)), `${label}: mutation ${String(mutation.name)} names an unknown classification at path ${path}.value; repair: use one of ${CLASSIFICATIONS.join(', ')}.`)
    }
  }
}

/** @param {Record<string, unknown>} corpus @param {string} label */
function validateCorpus(corpus, label) {
  checkKeys(corpus, ['exports', 'floors', 'thresholds', 'returnKeys', 'graphGate', 'importers', 'neutralPolicy'], 'document', label)
  const exports = /** @type {Record<string, unknown>[]} */ (corpus.exports)
  assert.ok(Array.isArray(exports) && exports.length > 0, `${label}: document holds no exports at path exports; repair: restore the named export list.`)
  for (const [index, entry] of exports.entries()) {
    checkKeys(entry, ['name', 'kind'], `export ${index}`, label, `exports[${index}]`)
    checkText(entry.name, 'name', `exports[${index}].name`, label)
    if (!EXPORT_KINDS.includes(/** @type {string} */ (entry.kind))) {
      fail(`${label}: invalid value ${JSON.stringify(entry.kind)} for field "kind" at path exports[${index}].kind; repair: use one of ${EXPORT_KINDS.join(', ')}.`)
    }
  }
  const floors = /** @type {Record<string, unknown>[]} */ (corpus.floors)
  assert.ok(Array.isArray(floors) && floors.length > 0, `${label}: document holds no floors at path floors; repair: restore the named floor list.`)
  for (const [index, entry] of floors.entries()) {
    checkKeys(entry, ['name', 'bytes'], `floor ${index}`, label, `floors[${index}]`)
    checkText(entry.name, 'name', `floors[${index}].name`, label)
    if (!Number.isInteger(entry.bytes) || /** @type {number} */ (entry.bytes) < 0) {
      fail(`${label}: invalid value ${JSON.stringify(entry.bytes)} for field "bytes" at path floors[${index}].bytes; repair: use a non-negative integer byte floor.`)
    }
  }
  const thresholds = /** @type {Record<string, unknown>[]} */ (corpus.thresholds)
  assert.ok(Array.isArray(thresholds) && thresholds.length > 0, `${label}: document holds no thresholds at path thresholds; repair: restore the named threshold list.`)
  for (const [index, entry] of thresholds.entries()) {
    checkKeys(entry, ['name', 'value'], `threshold ${index}`, label, `thresholds[${index}]`)
    checkText(entry.name, 'name', `thresholds[${index}].name`, label)
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
      fail(`${label}: invalid value ${JSON.stringify(entry.value)} for field "value" at path thresholds[${index}].value; repair: use a finite threshold value.`)
    }
    if (!(/** @type {string} */ (entry.name) in THRESHOLD_EXPORTS)) {
      fail(`${label}: unknown threshold ${JSON.stringify(entry.name)} at path thresholds[${index}].name; repair: use one of ${Object.keys(THRESHOLD_EXPORTS).join(', ')}.`)
    }
  }
  const returnKeys = /** @type {unknown[]} */ (corpus.returnKeys)
  if (!Array.isArray(returnKeys) || returnKeys.length === 0 || returnKeys.some((key) => typeof key !== 'string' || key.length === 0)) {
    fail(`${label}: expected a non-empty string list at path returnKeys; repair: restore the legacy measure() return keys.`)
  }
  checkKeys(corpus.graphGate, ['path', 'exports', 'requiresSurfaceGate'], 'graphGate', label, 'graphGate')
  const graphExports = /** @type {Record<string, unknown>} */ (corpus.graphGate).exports
  if (!Array.isArray(graphExports) || graphExports.length === 0 || graphExports.some((name) => typeof name !== 'string' || name.length === 0)) {
    fail(`${label}: expected a non-empty export string list at path graphGate.exports; repair: restore the graph oracle export inventory.`)
  }
  if (/** @type {Record<string, unknown>} */ (corpus.graphGate).requiresSurfaceGate !== true) {
    fail(`${label}: invalid value for field "requiresSurfaceGate" at path graphGate.requiresSurfaceGate; repair: GraphThemeGate must wrap one SurfaceGate instance.`)
  }
  const importers = /** @type {Record<string, unknown>[]} */ (corpus.importers)
  assert.ok(Array.isArray(importers) && importers.length > 0, `${label}: document holds no importers at path importers; repair: restore the named importer list.`)
  for (const [index, entry] of importers.entries()) {
    checkKeys(entry, ['path', 'family', 'binding', 'classification'], `importer ${index}`, label, `importers[${index}]`)
    checkText(entry.path, 'path', `importers[${index}].path`, label)
    checkText(entry.family, 'family', `importers[${index}].family`, label)
    checkText(entry.binding, 'binding', `importers[${index}].binding`, label)
    if (!CLASSIFICATIONS.includes(/** @type {string} */ (entry.classification))) {
      fail(`${label}: invalid value ${JSON.stringify(entry.classification)} for field "classification" at path importers[${index}].classification; repair: use one of ${CLASSIFICATIONS.join(', ')}.`)
    }
  }
  checkKeys(corpus.neutralPolicy, ['module', 'probeNames', 'forbiddenNames'], 'neutralPolicy', label, 'neutralPolicy')
  checkText(/** @type {Record<string, unknown>} */ (corpus.neutralPolicy).module, 'module', 'neutralPolicy.module', label)
  for (const field of ['probeNames', 'forbiddenNames']) {
    const list = /** @type {Record<string, unknown>} */ (corpus.neutralPolicy)[field]
    if (!Array.isArray(list) || list.length === 0 || list.some((name) => typeof name !== 'string' || name.length === 0)) {
      fail(`${label}: expected a non-empty string list at path neutralPolicy.${field}; repair: restore the neutral policy names.`)
    }
  }
}

/** @param {string} dir @param {string} prefix @returns {string[]} */
function deriveSurfaceImporters(dir, prefix) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.mjs'))
    .filter((name) => IMPORT_RE.test(readFileSync(join(dir, name), 'utf8')))
    .map((name) => `${prefix}${name}`)
    .sort()
}

/** @param {string[]} importers @param {string[]} required @param {string} label */
function assertImporterClosure(importers, required, label) {
  const missing = required.filter((path) => !importers.includes(path))
  if (missing.length > 0) {
    fail(`${label}: required surface importer ${JSON.stringify(missing[0])} is missing from the scripts/ importer inventory at path importer.path; repair: restore the "${missing[0]}" import of ./surface-gate.mjs or update the manifest required importer paths.`)
  }
  const unknown = importers.filter((path) => !required.includes(path))
  if (unknown.length > 0) {
    fail(`${label}: unknown surface importer ${JSON.stringify(unknown[0])} at path importer.path; repair: remove the "${unknown[0]}" import of ./surface-gate.mjs or register it in the manifest required importer paths.`)
  }
}

/** @param {string} path @param {string} expectedBinding @param {string} label */
function assertImporterBinding(path, expectedBinding, label) {
  const text = readFileSync(join(ROOT, path), 'utf8')
  const match = BINDING_RE.exec(text)
  const names = match ? match[1].split(',').map((name) => name.trim()) : []
  if (!names.includes(expectedBinding)) {
    fail(`${label}: importer ${JSON.stringify(path)} no longer binds "${expectedBinding}" from ./surface-gate.mjs at path ${path}.binding; repair: restore the "${expectedBinding}" named import in ${path}.`)
  }
}

/** @param {Record<string, unknown>[]} importers @param {string[]} requiredGate @param {string} label */
function assertRequiredGateSet(importers, requiredGate, label) {
  const actual = importers.filter((entry) => entry.classification === REQUIRED_GATE).map((entry) => entry.path)
  const unknown = actual.filter((path) => !requiredGate.includes(path))
  if (unknown.length > 0) {
    fail(`${label}: consumer ${JSON.stringify(unknown[0])} is classified required-gate at path importers.classification; repair: classify the expensive specialized consumer as ${PROTECTED_SPECIALIZED}, or add it to the manifest required-gate paths.`)
  }
  const missing = requiredGate.filter((path) => !actual.includes(path))
  if (missing.length > 0) {
    fail(`${label}: required-gate consumer ${JSON.stringify(missing[0])} is missing at path importers.classification; repair: classify "${missing[0]}" as ${REQUIRED_GATE} or drop it from the manifest required-gate paths.`)
  }
}

/**
 * Assert the protected-specialized set is non-empty and exactly the consumers
 * the required-gate manifest does NOT name. A widened required-gate inventory
 * that promotes every expensive consumer is refused here even when the
 * required-gate set matches itself, so the protected class can never silently
 * disappear.
 * @param {Record<string, unknown>[]} importers @param {string[]} requiredGate @param {string} label
 * @returns {string[]} the protected-specialized consumer paths
 */
export function assertProtectedSpecializedSet(importers, requiredGate, label) {
  const protectedPaths = importers.filter((entry) => entry.classification === PROTECTED_SPECIALIZED).map((entry) => /** @type {string} */ (entry.path))
  if (protectedPaths.length === 0) {
    fail(`${label}: no ${PROTECTED_SPECIALIZED} consumer remains at path importers.classification; repair: keep the expensive screenshot consumers classified ${PROTECTED_SPECIALIZED}, never claim them as required CI, and add any genuinely bounded check to the manifest required-gate paths.`)
  }
  const expected = importers.map((entry) => /** @type {string} */ (entry.path)).filter((path) => !requiredGate.includes(path))
  const unknown = protectedPaths.filter((path) => !expected.includes(path))
  if (unknown.length > 0) {
    fail(`${label}: consumer ${JSON.stringify(unknown[0])} is classified ${PROTECTED_SPECIALIZED} but is named in the required-gate paths at path importers.classification; repair: remove it from the manifest required-gate paths or classify it ${REQUIRED_GATE}.`)
  }
  return protectedPaths
}

/**
 * Assert every protected-specialized consumer is absent from the required CI
 * workflow, so an omitted expensive capture is never claimed as CI coverage.
 * The cheap required-gate command may appear; the protected probes may not.
 * @param {string[]} protectedPaths protected-specialized consumer paths
 * @param {string} workflowText required CI workflow source
 * @param {string} label owning corpus used in diagnostics
 * @returns {void}
 */
export function assertSpecializedAbsentFromRequiredCi(protectedPaths, workflowText, label) {
  for (const path of protectedPaths) {
    if (workflowText.includes(path)) {
      fail(`${label}: protected specialized consumer ${JSON.stringify(path)} is invoked by the required CI workflow at path ${REQUIRED_CI_REL}; repair: remove the expensive capture from required CI and keep it as protected periodic/manual evidence, or add an explicit bounded check and reclassify it ${REQUIRED_GATE}.`)
    }
  }
}

/**
 * Inspect the whole consumer disposition: the required-gate set is exact, the
 * protected-specialized set is non-empty and disjoint, no protected consumer
 * is invoked by required CI, and every protected consumer is still present.
 * Shared by the guard's own run and by the mutation suite, so both exercise one
 * owner.
 * @param {{ importers: Record<string, unknown>[], requiredGateImporterPaths: string[], workflowText: string, specializedPresent: (path: string) => boolean, label: string }} input
 * @returns {void}
 */
export function inspectConsumerClassification(input) {
  const { importers, requiredGateImporterPaths, workflowText, specializedPresent, label } = input
  assertRequiredGateSet(importers, requiredGateImporterPaths, label)
  const protectedPaths = assertProtectedSpecializedSet(importers, requiredGateImporterPaths, label)
  assertSpecializedAbsentFromRequiredCi(protectedPaths, workflowText, label)
  for (const path of protectedPaths) {
    if (!specializedPresent(path)) {
      fail(`${label}: protected specialized consumer ${JSON.stringify(path)} is missing from the checkout at path importers.path; repair: restore the protected probe so a future named-risk migration decision still has evidence to protect.`)
    }
  }
}

/** @param {object} mod @param {string} label @param {Record<string, unknown>} corpus */
function inspectSurfaceExports(mod, label, corpus) {
  const expected = /** @type {string[]} */ (corpus.exports.map((entry) => entry.name)).sort()
  const actual = Object.keys(mod).sort()
  assert.deepEqual(actual, expected, `${label}: SurfaceGate export set drifted at path surface-gate.exports; got [${actual.join(', ')}] want [${expected.join(', ')}]; repair: restore the exact named export set.`)
  for (const entry of /** @type {Record<string, unknown>[]} */ (corpus.exports)) {
    const kind = entry.kind === 'function' ? 'function' : entry.kind === 'class' ? 'function' : 'undefined'
    const value = /** @type {Record<string, unknown>} */ (mod)[/** @type {string} */ (entry.name)]
    if ((kind === 'function' && typeof value !== 'function') || (kind === 'undefined' && value === undefined)) {
      fail(`${label}: export "${entry.name}" must stay a ${entry.kind} at path surface-gate.exports.${entry.name}; repair: restore the ${entry.kind} export.`)
    }
  }
}

/** @param {object} mod @param {string} label @param {Record<string, unknown>} corpus */
function inspectSurfaceFloors(mod, label, corpus) {
  const floorNames = /** @type {Record<string, unknown>[]} */ (corpus.floors).map((entry) => entry.name)
  for (const entry of /** @type {Record<string, unknown>[]} */ (corpus.floors)) {
    if (entry.name === 'default') {
      if (mod.DEFAULT_MIN_BYTES !== entry.bytes) {
        fail(`${label}: default byte floor drifted at path surface-gate.DEFAULT_MIN_BYTES; expected ${entry.bytes}, observed ${mod.DEFAULT_MIN_BYTES}; repair: restore DEFAULT_MIN_BYTES to ${entry.bytes}.`)
      }
    } else if (mod.BYTE_FLOORS[entry.name] !== entry.bytes) {
      fail(`${label}: per-surface floor "${entry.name}" drifted at path surface-gate.BYTE_FLOORS.${entry.name}; expected ${entry.bytes}, observed ${mod.BYTE_FLOORS[entry.name]}; repair: restore the "${entry.name}" byte floor to ${entry.bytes}.`)
    }
  }
  const extra = Object.keys(mod.BYTE_FLOORS).filter((name) => !floorNames.includes(name))
  if (extra.length > 0) {
    fail(`${label}: unexpected per-surface floor ${JSON.stringify(extra[0])} at path surface-gate.BYTE_FLOORS.${extra[0]}; repair: remove the "${extra[0]}" floor or register it in the manifest required floor names.`)
  }
}

/** @param {object} mod @param {string} label @param {Record<string, unknown>} corpus */
function inspectSurfaceThresholds(mod, label, corpus) {
  for (const entry of /** @type {Record<string, unknown>[]} */ (corpus.thresholds)) {
    const exportName = THRESHOLD_EXPORTS[/** @type {string} */ (entry.name)]
    if (mod[exportName] !== entry.value) {
      fail(`${label}: threshold "${entry.name}" drifted at path surface-gate.${exportName}; expected ${entry.value}, observed ${mod[exportName]}; repair: restore ${exportName} to ${entry.value}.`)
    }
  }
}

/** @param {object} mod @param {string} label @param {Record<string, unknown>} corpus */
async function inspectSurfaceRuntime(mod, label, corpus) {
  const dir = mkdtempSync(join(tmpdir(), 'fairtest-surface-manifest-'))
  const decode = (measured) => ({ evaluate: async () => ({ ...measured }) })
  try {
    const file = join(dir, 'real.png')
    const bytes = Buffer.alloc(20 * 1024, 7)
    writeFileSync(file, bytes)
    const module = mod
    const gate = new module.SurfaceGate(decode(LUSH))
    const measured = await gate.measure(file)
    const expectedMd5 = createHash('md5').update(bytes).digest('hex')
    if (measured.md5 !== expectedMd5) {
      fail(`${label}: legacy md5 digest drifted at path surface-gate.measure.md5; expected ${expectedMd5}, observed ${measured.md5}; repair: digest file bytes with md5 through the neutral core.`)
    }
    const expectedKeys = /** @type {string[]} */ (corpus.returnKeys)
    const actualKeys = Object.keys(measured)
    assert.deepEqual(actualKeys, expectedKeys, `${label}: legacy measure() return keys drifted at path surface-gate.measure; got [${actualKeys.join(', ')}] want [${expectedKeys.join(', ')}]; repair: restore the exact legacy return keys, including "bgShare".`)
    const tiny = join(dir, 'tiny.png')
    writeFileSync(tiny, Buffer.alloc(100, 7))
    await assert.rejects(
      () => new module.SurfaceGate(decode(LUSH)).assert('real', tiny, { where: 'surface-manifest' }),
      /bytes.*floor/,
      `${label}: byte floor no longer rejects a tiny capture at path surface-gate.assert; repair: restore the per-surface byte floor check.`,
    )
    await assert.rejects(
      () => new module.SurfaceGate(decode({ ...LUSH, nonbgRatio: 0, bgShare: 1 })).assert('blank', file, { where: 'surface-manifest' }),
      /differ from the background/,
      `${label}: non-background ratio no longer rejects a blank capture at path surface-gate.assert; repair: restore the fraction bound.`,
    )
    await assert.rejects(
      () => new module.SurfaceGate(decode({ ...LUSH, distinctColors: 2 })).assert('flat', file, { where: 'surface-manifest' }),
      /distinct colours/,
      `${label}: distinct-colour bound no longer rejects a flat capture at path surface-gate.assert; repair: restore the distinct-sample bound.`,
    )
    const dup = new module.SurfaceGate(decode(LUSH))
    await dup.assert('first', file, { where: 'surface-manifest' })
    await assert.rejects(
      () => dup.assert('second', file, { where: 'surface-manifest' }),
      /byte-identical/,
      `${label}: per-instance duplicate scope no longer rejects a byte-identical capture at path surface-gate.assert; repair: restore the per-instance duplicate check.`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** @param {string} source @param {string} label */
function inspectSurfaceSource(source, label) {
  if (!source.includes(SOURCE_ROUTE_MARKER)) {
    fail(`${label}: the facade no longer imports the neutral core through the single source route at path surface-gate.import; repair: import "./fairtest-source.mjs" and resolve src/core/index.mjs through it.`)
  }
  if (!source.includes('createMeasurementPolicy(') || !source.includes('evaluateMeasurement(')) {
    fail(`${label}: the facade no longer delegates generic policy to the neutral core at path surface-gate.policy; repair: build the caller policy with createMeasurementPolicy and evaluate it with evaluateMeasurement.`)
  }
}

/** @param {object} mod @param {object} surfaceModule @param {string} label @param {Record<string, unknown>} corpus */
function inspectGraphModule(mod, surfaceModule, label, corpus) {
  const expected = /** @type {string[]} */ (/** @type {Record<string, unknown>} */ (corpus.graphGate).exports).slice().sort()
  const actual = Object.keys(mod).sort()
  assert.deepEqual(actual, expected, `${label}: graph oracle export set drifted at path ${/** @type {Record<string, unknown>} */ (corpus.graphGate).path}.exports; got [${actual.join(', ')}] want [${expected.join(', ')}]; repair: restore the exact named graph export set.`)
  if (/** @type {Record<string, unknown>} */ (corpus.graphGate).requiresSurfaceGate) {
    const gate = new mod.GraphThemeGate({ evaluate: async () => ({ ...LUSH }) })
    if (!(gate.surface instanceof surfaceModule.SurfaceGate)) {
      fail(`${label}: GraphThemeGate no longer wraps a SurfaceGate at path graph-oracle.GraphThemeGate.surface; repair: construct one SurfaceGate inside the GraphThemeGate constructor.`)
    }
  }
}

/** @param {object} manifest @param {Record<string, unknown>} corpus @param {string} source */
async function runMutations(manifest, corpus, source) {
  const requiredImporterPaths = /** @type {string[]} */ (manifest.requiredImporterPaths)
  const importerBindings = Object.fromEntries(/** @type {Record<string, unknown>[]} */ (corpus.importers).map((entry) => [entry.path, entry.binding]))
  const realImporters = deriveSurfaceImporters(HERE, 'scripts/')
  for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
    let message = null
    try {
      if (mutation.kind === 'source-runtime' || mutation.kind === 'source-text') {
        const mutated = applySourceMutation(source, mutation)
        if (mutation.kind === 'source-text') {
          inspectSurfaceSource(mutated, `${String(mutation.name)} mutant`)
        } else {
          const mod = await importMutantSource(mutated, mutation)
          inspectSurfaceExports(mod, `${String(mutation.name)} mutant`, corpus)
          inspectSurfaceFloors(mod, `${String(mutation.name)} mutant`, corpus)
          inspectSurfaceThresholds(mod, `${String(mutation.name)} mutant`, corpus)
          await inspectSurfaceRuntime(mod, `${String(mutation.name)} mutant`, corpus)
        }
      } else if (mutation.kind === 'importer-drop') {
        assertImporterClosure(realImporters.filter((path) => path !== mutation.target), requiredImporterPaths, MANIFEST_REL)
      } else if (mutation.kind === 'importer-plant') {
        assertImporterClosure([...realImporters, /** @type {string} */ (mutation.value)], requiredImporterPaths, MANIFEST_REL)
      } else if (mutation.kind === 'importer-binding') {
        const target = /** @type {string} */ (mutation.target)
        const value = /** @type {string} */ (mutation.value)
        if (value === importerBindings[target]) fail(`${String(mutation.name)}: mutation did not change the binding`)
        assertImporterBinding(target, value, MANIFEST_REL)
      } else if (mutation.kind === 'importer-classification') {
        const entries = /** @type {Record<string, unknown>[]} */ (corpus.importers).map((entry) => entry.path === mutation.target ? { ...entry, classification: mutation.value } : entry)
        assertRequiredGateSet(entries, /** @type {string[]} */ (manifest.requiredGateImporterPaths), MANIFEST_REL)
      } else if (mutation.kind === 'neutral-name') {
        assertNeutralProbeNames([/** @type {string} */ (mutation.value)], /** @type {string[]} */ (/** @type {Record<string, unknown>} */ (corpus.neutralPolicy).forbiddenNames), MANIFEST_REL)
      }
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, `${String(mutation.name)}: mutated input passed validation instead of failing`)
    assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${String(mutation.name)}: diagnostic names the wrong field; expected ${String(mutation.expectedField)}, received ${message}`)
    assert.ok(message.includes('at path'), `${String(mutation.name)}: diagnostic is missing path context: ${message}`)
    assert.ok(message.includes('repair:'), `${String(mutation.name)}: diagnostic is missing repair guidance: ${message}`)
  }
}

/** @param {string} source @param {Record<string, unknown>} mutation @returns {string} */
function applySourceMutation(source, mutation) {
  const find = /** @type {string} */ (mutation.find)
  const count = source.split(find).length - 1
  assert.equal(count, 1, `${MANIFEST_REL}: mutation ${String(mutation.name)} find string must appear exactly once in ${SURFACE_GATE_REL}; observed ${count}; repair: keep the mutation target unique.`)
  return source.replace(find, /** @type {string} */ (mutation.replace))
}

/**
 * Import a scratch copy of the real facade with one drift applied, resolved
 * against a symlink to the single source route so the mutant still reaches the
 * neutral core. Returns the mutant module namespace.
 * @param {string} mutated
 * @param {Record<string, unknown>} mutation
 */
async function importMutantSource(mutated, mutation) {
  const dir = mkdtempSync(join(tmpdir(), 'fairtest-surface-mutant-'))
  try {
    symlinkSync(join(HERE, 'fairtest-source.mjs'), join(dir, 'fairtest-source.mjs'))
    const file = join(dir, 'surface-gate.mjs')
    writeFileSync(file, mutated)
    return await import(`${pathToFileURL(file).href}?mutation=${encodeURIComponent(String(mutation.name))}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** @param {string[]} probeNames @param {string[]} forbidden @param {string} label */
function assertNeutralProbeNames(probeNames, forbidden, label) {
  for (const name of probeNames) {
    if (forbidden.includes(name)) {
      fail(`${label}: neutral probe name ${JSON.stringify(name)} is a Fairtrade surface name at path neutralPolicy.probeNames; repair: keep Fairtrade floor names out of core-only seams; use a neutral probe name.`)
    }
  }
}

/** @param {Record<string, unknown>} neutralPolicy @param {string} label */
async function assertNeutralSeam(neutralPolicy, label) {
  const probeNames = /** @type {string[]} */ (neutralPolicy.probeNames)
  assertNeutralProbeNames(probeNames, /** @type {string[]} */ (neutralPolicy.forbiddenNames), label)
  const core = await importFairtestSource(/** @type {string} */ (neutralPolicy.module))
  const common = { bytes: 2048, distinct: 8, fraction: 0.5 }
  const passing = core.evaluateMeasurement(common, core.createMeasurementPolicy({ version: 1, minBytes: 1024, minDistinct: 6, minFraction: 0.012 }))
  const failing = core.evaluateMeasurement(common, core.createMeasurementPolicy({ version: 1, minBytes: 4096, minDistinct: 9, minFraction: 0.9 }))
  assert.equal(passing.pass, true, `${label}: neutral policy rejected a measurement above its caller bounds at path neutralPolicy; repair: keep generic policy evaluable for any caller bounds.`)
  assert.equal(failing.pass, false, `${label}: neutral policy passed a measurement below its caller bounds at path neutralPolicy; repair: keep generic policy caller-owned and bound-checking.`)
}

async function main() {
  const manifestSource = readFileSync(resolve(ROOT, MANIFEST_REL), 'utf8')
  const corpusSource = readFileSync(resolve(ROOT, CORPUS_REL), 'utf8')
  const manifest = loadSingleDocument(manifestSource, MANIFEST_REL)
  validateManifest(manifest, MANIFEST_REL)
  const corpus = loadSingleDocument(corpusSource, CORPUS_REL)
  validateCorpus(corpus, CORPUS_REL)
  // A legal leading `---` start marker is still exactly one document.
  loadSingleDocument(`---\n${corpusSource}`, CORPUS_REL)

  const exportNames = /** @type {Record<string, unknown>[]} */ (corpus.exports).map((entry) => entry.name)
  const floorNames = /** @type {Record<string, unknown>[]} */ (corpus.floors).map((entry) => entry.name)
  const thresholdNames = /** @type {Record<string, unknown>[]} */ (corpus.thresholds).map((entry) => entry.name)
  const importerPaths = /** @type {Record<string, unknown>[]} */ (corpus.importers).map((entry) => entry.path)
  checkRequiredNames(exportNames, /** @type {string[]} */ (manifest.requiredExportNames), CORPUS_REL, 'export', 'exports')
  checkRequiredNames(floorNames, /** @type {string[]} */ (manifest.requiredFloorNames), CORPUS_REL, 'floor', 'floors')
  checkRequiredNames(thresholdNames, /** @type {string[]} */ (manifest.requiredThresholdNames), CORPUS_REL, 'threshold', 'thresholds')
  checkRequiredNames(importerPaths, /** @type {string[]} */ (manifest.requiredImporterPaths), CORPUS_REL, 'importer', 'importers')
  const corpusImporters = /** @type {Record<string, unknown>[]} */ (corpus.importers)
  const workflowText = readFileSync(resolve(ROOT, REQUIRED_CI_REL), 'utf8')
  inspectConsumerClassification({
    importers: corpusImporters,
    requiredGateImporterPaths: /** @type {string[]} */ (manifest.requiredGateImporterPaths),
    workflowText,
    specializedPresent: (path) => existsSync(resolve(ROOT, path)),
    label: CORPUS_REL,
  })
  checkRequiredNames(/** @type {string[]} */ (corpus.returnKeys), /** @type {string[]} */ (manifest.requiredReturnKeys), CORPUS_REL, 'return key', 'returnKeys')
  checkRequiredNames(/** @type {string[]} */ (/** @type {Record<string, unknown>} */ (corpus.graphGate).exports), /** @type {string[]} */ (manifest.requiredGraphExportNames), CORPUS_REL, 'graph export', 'graphGate.exports')
  checkRequiredNames(/** @type {string[]} */ (/** @type {Record<string, unknown>} */ (corpus.neutralPolicy).probeNames), /** @type {string[]} */ (manifest.requiredNeutralProbeNames), CORPUS_REL, 'neutral probe', 'neutralPolicy.probeNames')

  const source = readFileSync(join(HERE, SURFACE_GATE_REL), 'utf8')
  const surfaceModule = await import('./surface-gate.mjs')
  const graphModule = await import('./graph-oracle.mjs')

  inspectSurfaceExports(surfaceModule, SURFACE_GATE_REL, corpus)
  inspectSurfaceFloors(surfaceModule, SURFACE_GATE_REL, corpus)
  inspectSurfaceThresholds(surfaceModule, SURFACE_GATE_REL, corpus)
  inspectSurfaceSource(source, SURFACE_GATE_REL)
  await inspectSurfaceRuntime(surfaceModule, SURFACE_GATE_REL, corpus)
  inspectGraphModule(graphModule, surfaceModule, /** @type {string} */ (/** @type {Record<string, unknown>} */ (corpus.graphGate).path), corpus)

  const derived = deriveSurfaceImporters(HERE, 'scripts/')
  assertImporterClosure(derived, /** @type {string[]} */ (manifest.requiredImporterPaths), CORPUS_REL)
  for (const entry of /** @type {Record<string, unknown>[]} */ (corpus.importers)) {
    assertImporterBinding(/** @type {string} */ (entry.path), /** @type {string} */ (entry.binding), CORPUS_REL)
  }

  await assertNeutralSeam(/** @type {Record<string, unknown>} */ (corpus.neutralPolicy), CORPUS_REL)

  await runMutations(manifest, corpus, source)

  console.log(
    `surface manifest: ${exportNames.length} exports, ${importerPaths.length} importer families, ${floorNames.length} floors, ` +
    `${thresholdNames.length} thresholds, ${/** @type {string[]} */ (corpus.returnKeys).length} legacy return keys, and ` +
    `${/** @type {string[]} */ (manifest.requiredGraphExportNames).length} graph exports passed; ` +
    `${/** @type {string[]} */ (manifest.requiredGateImporterPaths).length} consumers stay required while the rest stay protected specialized and out of required CI; all ` +
    `${/** @type {Record<string, unknown>[]} */ (manifest.mutations).length} named source-drift mutations failed for their intended field.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

// @ts-check

// Neutral served-build record and the served-versus-dist comparison.
//
// One served-build record names the state, the built tree root it served, the
// worktree head and dirty flag the tree was built from, the asset digests the
// built tree holds, and the asset digests actually read back over the served
// origin. `assertServedMatchesDist` proves the two sets are the same refs and
// that every served digest equals the built tree, so a served origin that is not
// this build fails closed instead of certifying someone else's bytes.
//
// The file and process I/O that produced the record stays app-side; this module
// validates the record shape and the byte correspondence only. It executes no
// page code and names no runner, document object, or scheme address.

import { assertExactFields, assertNonEmptyString, freezeRecord } from '../core/values.mjs'
import { assertArtifactDigest } from '../evidence/digest.mjs'
import { assertCaptureName } from './values.mjs'

const HEAD_PATTERN = /^[0-9a-f]{7,64}$/

/**
 * @typedef {object} ServedAssetDigest
 * @property {string} asset asset reference the built page names
 * @property {string} sha256 lowercase 64-character hex SHA-256 digest of the built asset bytes
 */

/**
 * @typedef {object} ServedAssetComparison
 * @property {string} asset asset reference the built page names
 * @property {string} sha256 lowercase 64-character hex SHA-256 digest of the bytes served
 * @property {boolean} servedEqualsDist whether the served bytes equal the built tree bytes
 */

/**
 * @typedef {object} ServedBuild
 * @property {string} state state id
 * @property {string} root built tree root
 * @property {string} head worktree head the tree was built from
 * @property {boolean} dirty whether the worktree was dirty at capture time
 * @property {ServedAssetDigest[]} assets built tree asset digests
 * @property {ServedAssetComparison[]} served served asset comparisons
 */

/**
 * @typedef {object} ServedBuildInput
 * @property {string} state state id
 * @property {string} root built tree root
 * @property {string} head worktree head
 * @property {boolean} dirty whether the worktree was dirty
 * @property {{ asset: string, sha256: string }[]} assets built tree asset digests
 * @property {{ asset: string, sha256: string, servedEqualsDist: boolean }[]} served served asset comparisons
 */

/**
 * Validate one asset digest list and assert every reference appears once.
 * @param {unknown} value
 * @param {string} field field name used in diagnostics
 * @param {string} label owning document used in diagnostics
 * @returns {ServedAssetDigest[]}
 */
function validateAssets(value, field, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}: expected a non-empty asset list for field "${field}" at path build.${field}; repair: record at least one asset digest.`)
  }
  const seen = new Set()
  /** @type {ServedAssetDigest[]} */
  const assets = []
  for (const [index, entry] of value.entries()) {
    const where = `build.${field}[${index}]`
    assertExactFields(entry, ['asset', 'sha256'], label, where)
    const record = /** @type {Record<string, unknown>} */ (entry)
    assertNonEmptyString(record.asset, 'asset', `${where}.asset`)
    assertArtifactDigest(record.sha256, `${where}.sha256`)
    if (seen.has(record.asset)) {
      throw new Error(`${label}: duplicate asset ${JSON.stringify(record.asset)} at path ${where}.asset; repair: list every asset reference once.`)
    }
    seen.add(record.asset)
    assets.push(freezeRecord({ asset: record.asset, sha256: record.sha256 }))
  }
  return assets
}

/**
 * Validate one served comparison list and assert every reference appears once.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {ServedAssetComparison[]}
 */
function validateServed(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}: expected a non-empty served asset list at path build.served; repair: record the served asset comparisons.`)
  }
  const seen = new Set()
  /** @type {ServedAssetComparison[]} */
  const served = []
  for (const [index, entry] of value.entries()) {
    const where = `build.served[${index}]`
    assertExactFields(entry, ['asset', 'sha256', 'servedEqualsDist'], label, where)
    const record = /** @type {Record<string, unknown>} */ (entry)
    assertNonEmptyString(record.asset, 'asset', `${where}.asset`)
    assertArtifactDigest(record.sha256, `${where}.sha256`)
    if (typeof record.servedEqualsDist !== 'boolean') {
      throw new Error(`${label}: invalid value ${JSON.stringify(record.servedEqualsDist)} for field "servedEqualsDist" at path ${where}.servedEqualsDist; repair: record whether the served bytes equal the built tree.`)
    }
    if (seen.has(record.asset)) {
      throw new Error(`${label}: duplicate served asset ${JSON.stringify(record.asset)} at path ${where}.asset; repair: list every served asset reference once.`)
    }
    seen.add(record.asset)
    served.push(freezeRecord({ asset: record.asset, sha256: record.sha256, servedEqualsDist: record.servedEqualsDist }))
  }
  return served
}

/**
 * Validate an unknown value as a served-build record and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {ServedBuild}
 */
export function validateServedBuild(value, label) {
  assertExactFields(value, ['state', 'root', 'head', 'dirty', 'assets', 'served'], label, 'build')
  const record = /** @type {Record<string, unknown>} */ (value)
  assertCaptureName(record.state, 'state', 'build.state')
  assertNonEmptyString(record.root, 'root', 'build.root')
  assertNonEmptyString(record.head, 'head', 'build.head')
  if (!HEAD_PATTERN.test(/** @type {string} */ (record.head))) {
    throw new Error(`${label}: invalid value ${JSON.stringify(record.head)} for field "head" at path build.head; repair: use a lowercase hex worktree head, or pass the same lowercase hex value as the explicit build label.`)
  }
  if (typeof record.dirty !== 'boolean') {
    throw new Error(`${label}: invalid value ${JSON.stringify(record.dirty)} for field "dirty" at path build.dirty; repair: record whether the worktree was dirty as a boolean.`)
  }
  const assets = validateAssets(record.assets, 'assets', label)
  const served = validateServed(record.served, label)
  return freezeRecord({
    state: record.state,
    root: record.root,
    head: record.head,
    dirty: record.dirty,
    assets,
    served,
  })
}

/**
 * Create a frozen served-build record. Throws when any part is invalid.
 * @param {ServedBuildInput} input
 * @returns {ServedBuild}
 */
export function createServedBuild(input) {
  return validateServedBuild(input, 'build')
}

/**
 * Assert the served bytes are exactly the built tree: the served references are
 * the recorded asset references, and every served comparison is true. Returns
 * the frozen record.
 * @param {unknown} value candidate served-build record
 * @param {string} [label] owning document used in diagnostics
 * @returns {ServedBuild}
 */
export function assertServedMatchesDist(value, label = 'build') {
  const record = validateServedBuild(value, label)
  const assets = record.assets.map((entry) => entry.asset)
  const served = record.served.map((entry) => entry.asset)
  const missing = assets.filter((asset) => !served.includes(asset))
  const extra = served.filter((asset) => !assets.includes(asset))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${label}: served asset set differs from the built tree at path build.served; ` +
      `built ${JSON.stringify(assets)} served ${JSON.stringify(served)} missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}; ` +
      'repair: serve the exact built tree so the served references match its assets.',
    )
  }
  for (const entry of record.served) {
    if (entry.servedEqualsDist !== true) {
      throw new Error(
        `${label}: served bytes differ from the built tree for ${JSON.stringify(entry.asset)} at path build.served; ` +
        `the served digest ${JSON.stringify(entry.sha256)} does not equal the built tree bytes; ` +
        'repair: serve the exact built tree (rebuild it and make sure no other server holds the loopback port).',
      )
    }
  }
  return record
}

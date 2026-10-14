// @ts-check

// Neutral capture observation record.
//
// One capture record is the certified payload of a row: the state, surface,
// host kind, width, and theme it observed, the served asset digests it read,
// and one entry per captured target. Every target entry carries either a shot
// reference `{file, sha256}` or an explicit non-empty unshootable reason, never
// both and never neither, so a record can show an unshootable target but can
// never silently omit one and can never claim a shot without a file.
//
// This module also owns the canonical serialization and digest of a record and
// the reconciliation invariants the producer runs before a row is written. It
// executes no page code and names no runner, document object, or scheme
// address.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord, isPlainRecord } from '../core/values.mjs'
import { THEME_NAMES, assertHostKind } from '../host-contract/kinds.mjs'
import { artifactDigest, assertArtifactDigest } from '../evidence/digest.mjs'
import { CAPTURE_MAX_MILLISECONDS, CAPTURE_MAX_WIDTH, CAPTURE_TARGET_KINDS, assertCaptureName } from './values.mjs'
import { captureRowKey } from './cases.mjs'

export { CAPTURE_TARGET_KINDS }

/**
 * @typedef {object} CaptureShotRef
 * @property {string} file capture-root-relative shot path
 * @property {string} sha256 lowercase 64-character hex SHA-256 digest of the shot bytes
 */

/**
 * @typedef {object} CaptureUnshootable
 * @property {string} reason non-empty explicit reason the target has no shot
 */

/**
 * @typedef {object} CaptureTarget
 * @property {string} target caller-owned target name
 * @property {string} kind one of CAPTURE_TARGET_KINDS
 * @property {string} selector selector the target read
 * @property {Record<string, unknown> | null} read observed read payload, or null
 * @property {Record<string, unknown> | null} contrast observed contrast ratios, or null
 * @property {CaptureShotRef | null} shot shot reference, or null
 * @property {CaptureUnshootable | null} unshootable explicit reason, or null
 */

/**
 * @typedef {object} CaptureRecord
 * @property {string} state state id
 * @property {string} surface surface id
 * @property {string} kind shared host kind
 * @property {number} width viewport width
 * @property {string} theme theme name the row was asked to render
 * @property {string} observedTheme theme name the host rendered, read back from the page
 * @property {number} observedAtMs observation time in whole milliseconds
 * @property {{ asset: string, sha256: string }[]} servedAssets served asset digests
 * @property {CaptureTarget[]} targets captured targets
 */

/**
 * Validate one served asset digest entry.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @param {string} where value path used in diagnostics
 * @returns {{ asset: string, sha256: string }}
 */
function validateServedAsset(value, label, where) {
  assertExactFields(value, ['asset', 'sha256'], label, where)
  const record = /** @type {Record<string, unknown>} */ (value)
  assertNonEmptyString(record.asset, 'asset', `${where}.asset`)
  assertArtifactDigest(record.sha256, `${where}.sha256`)
  return freezeRecord({ asset: record.asset, sha256: record.sha256 })
}

/**
 * Validate one shot reference.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @param {string} where value path used in diagnostics
 * @returns {CaptureShotRef}
 */
function validateShotRef(value, label, where) {
  assertExactFields(value, ['file', 'sha256'], label, where)
  const record = /** @type {Record<string, unknown>} */ (value)
  assertNonEmptyString(record.file, 'file', `${where}.file`)
  assertArtifactDigest(record.sha256, `${where}.sha256`)
  return freezeRecord({ file: record.file, sha256: record.sha256 })
}

/**
 * Validate one explicit unshootable reason.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @param {string} where value path used in diagnostics
 * @returns {CaptureUnshootable}
 */
function validateUnshootable(value, label, where) {
  assertExactFields(value, ['reason'], label, where)
  const record = /** @type {Record<string, unknown>} */ (value)
  assertNonEmptyString(record.reason, 'reason', `${where}.reason`)
  return freezeRecord({ reason: record.reason })
}

/**
 * Validate one capture target and return a frozen copy. Exactly one of shot
 * and unshootable must be present; both or neither fails closed.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {CaptureTarget}
 */
export function validateCaptureTarget(value, label) {
  assertExactFields(value, ['target', 'kind', 'selector', 'read', 'contrast', 'shot', 'unshootable'], label, 'target')
  const record = /** @type {Record<string, unknown>} */ (value)
  assertNonEmptyString(record.target, 'target', 'target.target')
  if (!/** @type {readonly string[]} */ (CAPTURE_TARGET_KINDS).includes(/** @type {string} */ (record.kind))) {
    throw new Error(
      `${label}: invalid value ${JSON.stringify(record.kind)} for field "kind" at path target.kind; ` +
      `repair: use one of ${CAPTURE_TARGET_KINDS.join(', ')} for "kind".`,
    )
  }
  assertNonEmptyString(record.selector, 'selector', 'target.selector')
  if (record.read !== null && !isPlainRecord(record.read)) {
    throw new Error(`${label}: invalid value ${JSON.stringify(record.read)} for field "read" at path target.read; repair: provide the observed read record or null.`)
  }
  if (record.contrast !== null && !isPlainRecord(record.contrast)) {
    throw new Error(`${label}: invalid value ${JSON.stringify(record.contrast)} for field "contrast" at path target.contrast; repair: provide the observed contrast record or null.`)
  }
  const shot = record.shot === null ? null : validateShotRef(record.shot, label, 'target.shot')
  const unshootable = record.unshootable === null ? null : validateUnshootable(record.unshootable, label, 'target.unshootable')
  if (shot !== null && unshootable !== null) {
    throw new Error(
      `${label}: target ${JSON.stringify(record.target)} carries both a shot and an unshootable reason at path target.unshootable; ` +
      'repair: record exactly one of a shot reference or an unshootable reason.',
    )
  }
  if (shot === null && unshootable === null) {
    throw new Error(
      `${label}: target ${JSON.stringify(record.target)} carries neither a shot nor an unshootable reason at path target.shot; ` +
      'repair: record the shot reference or the explicit reason the target could not be shot.',
    )
  }
  return freezeRecord({
    target: record.target,
    kind: /** @type {string} */ (record.kind),
    selector: record.selector,
    read: record.read,
    contrast: record.contrast,
    shot,
    unshootable,
  })
}

/**
 * Classify one target entry as shootable or unshootable. Returns the decision
 * rather than only the record, so a producer or sheet planner can branch on the
 * classification without re-reading the fields.
 * @param {unknown} value candidate target entry
 * @param {string} [label] owning document used in diagnostics
 * @returns {{ target: string, kind: string, shootable: true, file: string, sha256: string } | { target: string, kind: string, shootable: false, reason: string }}
 */
export function classifyCaptureTarget(value, label = 'target') {
  const target = validateCaptureTarget(value, label)
  if (target.shot !== null) {
    return freezeRecord({ target: target.target, kind: target.kind, shootable: true, file: target.shot.file, sha256: target.shot.sha256 })
  }
  return freezeRecord({ target: target.target, kind: target.kind, shootable: false, reason: /** @type {CaptureUnshootable} */ (target.unshootable).reason })
}

/**
 * Validate an unknown value as a capture record and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {CaptureRecord}
 */
export function validateCaptureRecord(value, label) {
  assertExactFields(value, ['state', 'surface', 'kind', 'width', 'theme', 'observedTheme', 'observedAtMs', 'servedAssets', 'targets'], label, 'capture')
  const record = /** @type {Record<string, unknown>} */ (value)
  assertCaptureName(record.state, 'state', 'capture.state')
  assertCaptureName(record.surface, 'surface', 'capture.surface')
  assertHostKind(record.kind, 'capture.kind')
  assertIntegerInRange(record.width, 'width', 'capture.width', { min: 1, max: CAPTURE_MAX_WIDTH })
  if (!/** @type {readonly string[]} */ (THEME_NAMES).includes(/** @type {string} */ (record.theme))) {
    throw new Error(`invalid value ${JSON.stringify(record.theme)} for field "theme" at path capture.theme; repair: use one of ${THEME_NAMES.join(', ')} for "theme".`)
  }
  if (!/** @type {readonly string[]} */ (THEME_NAMES).includes(/** @type {string} */ (record.observedTheme))) {
    throw new Error(`invalid value ${JSON.stringify(record.observedTheme)} for field "observedTheme" at path capture.observedTheme; repair: record the rendered theme read back from the page as one of ${THEME_NAMES.join(', ')} for "observedTheme".`)
  }
  assertIntegerInRange(record.observedAtMs, 'observedAtMs', 'capture.observedAtMs', { min: 0, max: CAPTURE_MAX_MILLISECONDS })
  if (!Array.isArray(record.servedAssets) || record.servedAssets.length === 0) {
    throw new Error(`${label}: expected a non-empty served asset list at path capture.servedAssets; repair: record at least one served asset digest.`)
  }
  const servedAssets = record.servedAssets.map((entry, index) => validateServedAsset(entry, label, `capture.servedAssets[${index}]`))
  if (!Array.isArray(record.targets) || record.targets.length === 0) {
    throw new Error(`${label}: expected a non-empty target list at path capture.targets; repair: record at least one captured target.`)
  }
  const targets = record.targets.map((entry, index) => validateCaptureTarget(entry, `${label}.targets[${index}]`))
  const names = new Set()
  for (const [index, target] of targets.entries()) {
    const identity = `${target.kind}:${target.target}`
    if (names.has(identity)) {
      throw new Error(`${label}: duplicate target ${JSON.stringify(target.target)} of kind ${JSON.stringify(target.kind)} at path capture.targets[${index}]; repair: record every target name and kind once.`)
    }
    names.add(identity)
  }
  return freezeRecord({
    state: record.state,
    surface: record.surface,
    kind: record.kind,
    width: record.width,
    theme: /** @type {string} */ (record.theme),
    observedTheme: /** @type {string} */ (record.observedTheme),
    observedAtMs: record.observedAtMs,
    servedAssets,
    targets,
  })
}

/**
 * Create a frozen capture record. Throws when any part is invalid.
 * @param {CaptureRecord} input
 * @returns {CaptureRecord}
 */
export function createCaptureRecord(input) {
  return validateCaptureRecord(input, 'capture')
}

/**
 * Canonical serialization of one capture record: validated, then rendered as
 * two-space JSON with a trailing newline. The field order is the factory's, so
 * the same observation always serializes to the same bytes.
 * @param {unknown} value
 * @param {string} [label] owning document used in diagnostics
 * @returns {string}
 */
export function serializeCaptureRecord(value, label = 'capture') {
  return `${JSON.stringify(validateCaptureRecord(value, label), null, 2)}\n`
}

/**
 * SHA-256 digest of the canonical serialization of one capture record.
 * @param {unknown} value
 * @param {string} [label] owning document used in diagnostics
 * @returns {string}
 */
export function captureRecordDigest(value, label = 'capture') {
  return artifactDigest(serializeCaptureRecord(value, label))
}

/**
 * The row key of a capture record: surface, width, and theme.
 * @param {CaptureRecord} record capture record
 * @returns {string}
 */
export function captureRecordKey(record) {
  const validated = validateCaptureRecord(record, 'capture')
  return captureRowKey(validated.surface, validated.width, validated.theme)
}

/**
 * Reconcile one record against the shot-file inventory the producer wrote:
 * every shot reference must name a file that exists, and every target must
 * already carry a shot or a reason. Returns the number of shot references.
 * @param {unknown} value candidate capture record
 * @param {string[]} files capture-root-relative files the producer wrote
 * @param {string} [label] owning document used in diagnostics
 * @returns {number}
 */
export function reconcileCaptureRecord(value, files, label = 'capture') {
  const record = validateCaptureRecord(value, label)
  if (!Array.isArray(files)) {
    throw new Error(`${label}: invalid value for field "files" at path capture.files; repair: provide the shot-file inventory the producer wrote.`)
  }
  const present = new Set(files)
  let shots = 0
  for (const target of record.targets) {
    if (target.shot === null) continue
    shots += 1
    if (!present.has(target.shot.file)) {
      throw new Error(
        `${label}: shot reference ${JSON.stringify(target.shot.file)} for target ${JSON.stringify(target.target)} has no file at path capture.targets; ` +
        'repair: write the shot file before certifying the record, or record the target as unshootable with its reason.',
      )
    }
  }
  return shots
}

/**
 * Assert every shot reference in a record matches the digest of its bytes. The
 * producer runs this after writing the shots and before writing the row, so a
 * record can never bind a stale or forged digest.
 * @param {unknown} value candidate capture record
 * @param {Record<string, string | Uint8Array>} bytesByFile capture-root-relative shot bytes
 * @param {string} [label] owning document used in diagnostics
 * @returns {number} the number of shot references re-hashed
 */
export function assertCaptureShotsDigest(value, bytesByFile, label = 'capture') {
  const record = validateCaptureRecord(value, label)
  if (!isPlainRecord(bytesByFile)) {
    throw new Error(`${label}: invalid value for field "bytesByFile" at path capture.bytesByFile; repair: provide the shot bytes keyed by capture-root-relative path.`)
  }
  let verified = 0
  for (const target of record.targets) {
    if (target.shot === null) continue
    const bytes = bytesByFile[target.shot.file]
    if (bytes === undefined) {
      throw new Error(
        `${label}: missing shot bytes for ${JSON.stringify(target.shot.file)} at path capture.shots; ` +
        'repair: read the shot file the record references before re-hashing its digest.',
      )
    }
    const recomputed = artifactDigest(bytes)
    if (recomputed !== target.shot.sha256) {
      throw new Error(
        `${label}: shot digest mismatch for ${JSON.stringify(target.shot.file)} at path capture.shots; ` +
        `expected ${JSON.stringify(target.shot.sha256)} observed ${JSON.stringify(recomputed)}; ` +
        'repair: re-write the shot and record its digest beside the row.',
      )
    }
    verified += 1
  }
  return verified
}

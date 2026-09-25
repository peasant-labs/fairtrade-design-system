// Duplicate and freshness primitives for portable evidence. A duplicate set
// tracks observed digests inside one caller-chosen scope id so two scopes
// never share duplicate state. Freshness compares whole-millisecond clocks
// against a caller-owned ceiling. Sets are immutable: every check returns a
// new frozen set and never mutates its input.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord } from './values.mjs'

/**
 * @typedef {object} DuplicateSet
 * @property {string} scopeId caller-chosen scope holding the digest inventory
 * @property {string[]} seen observed lowercase hex digests in first-seen order
 */

/**
 * @typedef {object} DuplicateCheck
 * @property {boolean} duplicate true when the digest was already seen in scope
 * @property {DuplicateSet} updated frozen set holding the digest afterwards
 */

/**
 * @typedef {object} EvidenceRecordInput
 * @property {string} identityId owning identity id
 * @property {string} digest lowercase hex digest of the observed bytes
 * @property {number} observedAtMs observation time in whole milliseconds
 * @property {string} scopeId caller-chosen duplicate scope
 */

/**
 * @typedef {object} EvidenceRecord
 * @property {string} identityId
 * @property {string} digest
 * @property {number} observedAtMs
 * @property {string} scopeId
 */

const SCOPE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const DIGEST_PATTERN = /^[0-9a-f]{32}$|^[0-9a-f]{64}$/
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const MAX_SAFE = 9007199254740991

/**
 * Validate a hex digest shape shared by sets and records.
 * @param {unknown} digest
 * @param {string} path value path used in diagnostics
 * @returns {asserts digest is string}
 */
function assertDigest(digest, path) {
  assertNonEmptyString(digest, 'digest', path)
  if (!DIGEST_PATTERN.test(/** @type {string} */ (digest))) {
    throw new Error(`invalid value ${JSON.stringify(digest)} for field "digest" at path ${path}; repair: use a 32 or 64 character lowercase hex digest for "digest".`)
  }
}

/**
 * Validate a scope id shape shared by sets and records.
 * @param {unknown} scopeId
 * @param {string} path value path used in diagnostics
 * @returns {asserts scopeId is string}
 */
function assertScopeId(scopeId, path) {
  assertNonEmptyString(scopeId, 'scopeId', path)
  if (!SCOPE_PATTERN.test(/** @type {string} */ (scopeId))) {
    throw new Error(`invalid value ${JSON.stringify(scopeId)} for field "scopeId" at path ${path}; repair: use a lowercase scope id up to 64 characters for "scopeId".`)
  }
}

/**
 * Create an empty frozen duplicate set for one caller-chosen scope.
 * @param {string} scopeId
 * @returns {DuplicateSet}
 */
export function createDuplicateSet(scopeId) {
  assertScopeId(scopeId, 'set.scopeId')
  return freezeRecord({ scopeId, seen: [] })
}

/**
 * Check one digest against a set and return whether it duplicates plus the
 * updated frozen set. The input set is never mutated.
 * @param {DuplicateSet} set
 * @param {string} digest
 * @returns {DuplicateCheck}
 */
export function checkDuplicate(set, digest) {
  assertExactFields(set, ['scopeId', 'seen'], 'set', 'set')
  assertScopeId(set.scopeId, 'set.scopeId')
  if (!Array.isArray(set.seen)) {
    throw new Error(`invalid value for field "seen" at path set.seen; repair: provide the observed digest list for "seen".`)
  }
  assertDigest(digest, 'digest')
  const duplicate = set.seen.includes(digest)
  const updated = duplicate ? set : freezeRecord({ scopeId: set.scopeId, seen: [...set.seen, digest] })
  return freezeRecord({ duplicate, updated })
}

/**
 * Return true when the observation is fresh: observed at or before now and
 * no older than the caller ceiling. Invalid, future, or stale clocks read
 * as not fresh rather than throwing.
 * @param {number} observedAtMs
 * @param {number} nowMs
 * @param {number} maxAgeMs
 * @returns {boolean}
 */
export function isFresh(observedAtMs, nowMs, maxAgeMs) {
  if (!Number.isInteger(observedAtMs) || !Number.isInteger(nowMs) || !Number.isInteger(maxAgeMs)) return false
  if (observedAtMs < 0 || nowMs < 0 || maxAgeMs < 0) return false
  if (observedAtMs > nowMs) return false
  return nowMs - observedAtMs <= maxAgeMs
}

/**
 * Assert an observation is fresh with an actionable diagnostic on failure.
 * @param {number} observedAtMs
 * @param {number} nowMs
 * @param {number} maxAgeMs
 * @param {string} label owning record used in diagnostics
 * @returns {void}
 */
export function assertFresh(observedAtMs, nowMs, maxAgeMs, label) {
  if (!isFresh(observedAtMs, nowMs, maxAgeMs)) {
    throw new Error(`${label}: stale or invalid observation at path observedAtMs; observed ${JSON.stringify(observedAtMs)} against now ${JSON.stringify(nowMs)} with ceiling ${JSON.stringify(maxAgeMs)}; repair: re-observe the entry and persist a current observedAtMs in ${label}.`)
  }
}

/**
 * Create a frozen evidence record binding an identity to one digest, one
 * observation time, and one duplicate scope.
 * @param {EvidenceRecordInput} input
 * @returns {EvidenceRecord}
 */
export function createEvidenceRecord(input) {
  assertExactFields(input, ['identityId', 'digest', 'observedAtMs', 'scopeId'], 'record', 'record')
  assertNonEmptyString(input.identityId, 'identityId', 'record.identityId')
  if (!ID_PATTERN.test(input.identityId)) {
    throw new Error(`invalid value ${JSON.stringify(input.identityId)} for field "identityId" at path record.identityId; repair: use a lowercase identity id up to 64 characters for "identityId".`)
  }
  assertDigest(input.digest, 'record.digest')
  assertIntegerInRange(input.observedAtMs, 'observedAtMs', 'record.observedAtMs', { min: 0, max: MAX_SAFE })
  assertScopeId(input.scopeId, 'record.scopeId')
  return freezeRecord({ identityId: input.identityId, digest: input.digest, observedAtMs: input.observedAtMs, scopeId: input.scopeId })
}

/**
 * Validate an unknown value as an evidence record and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {EvidenceRecord}
 */
export function validateEvidenceRecord(value, label) {
  assertExactFields(value, ['identityId', 'digest', 'observedAtMs', 'scopeId'], label, 'record')
  return createEvidenceRecord(/** @type {EvidenceRecordInput} */ (value))
}

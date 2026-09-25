// Immutable identity helpers. An identity names one run, record, or set with a
// caller-chosen kind, a stable id, and a creation timestamp. Identities are
// frozen at creation so sharing a reference can never mutate the named entry.
// Uses only language builtins. No caller kind list lives here; the caller
// supplies and owns its kind vocabulary.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord } from './values.mjs'

/**
 * @typedef {object} IdentityInput
 * @property {string} kind caller-owned kind label
 * @property {string} id stable identifier
 * @property {number} createdAtMs creation time in whole milliseconds
 */

/**
 * @typedef {object} Identity
 * @property {string} kind caller-owned kind label
 * @property {string} id stable identifier
 * @property {number} createdAtMs creation time in whole milliseconds
 */

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const KIND_PATTERN = /^[a-z][a-z0-9-]{0,31}$/
const MAX_CREATED_AT_MS = 9007199254740991

/**
 * Create a frozen identity record. Throws when any field is invalid.
 * @param {IdentityInput} input
 * @returns {Identity}
 */
export function createIdentity(input) {
  assertExactFields(input, ['kind', 'id', 'createdAtMs'], 'identity', 'identity')
  assertNonEmptyString(input.kind, 'kind', 'identity.kind')
  if (!KIND_PATTERN.test(input.kind)) {
    throw new Error(`invalid value ${JSON.stringify(input.kind)} for field "kind" at path identity.kind; repair: use a lowercase kind label up to 32 characters for "kind".`)
  }
  assertNonEmptyString(input.id, 'id', 'identity.id')
  if (!ID_PATTERN.test(input.id)) {
    throw new Error(`invalid value ${JSON.stringify(input.id)} for field "id" at path identity.id; repair: use a lowercase id up to 64 characters for "id".`)
  }
  assertIntegerInRange(input.createdAtMs, 'createdAtMs', 'identity.createdAtMs', { min: 0, max: MAX_CREATED_AT_MS })
  return freezeRecord({ kind: input.kind, id: input.id, createdAtMs: input.createdAtMs })
}

/**
 * Validate an unknown value as an identity and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {Identity}
 */
export function validateIdentity(value, label) {
  assertExactFields(value, ['kind', 'id', 'createdAtMs'], label, 'identity')
  return createIdentity(/** @type {IdentityInput} */ (value))
}

/**
 * Return true when both identities name the same kind and id entry.
 * @param {Identity} first
 * @param {Identity} second
 * @returns {boolean}
 */
export function sameIdentity(first, second) {
  validateIdentity(first, 'identity')
  validateIdentity(second, 'identity')
  return first.kind === second.kind && first.id === second.id
}

// @ts-check

// Adapter-seam target declarations: kind, identity branch, capabilities,
// named fixtures, and named actions.
//
// A declaration states what one host target offers before anything is
// observed. Capabilities use a closed per-kind vocabulary; fixture and action
// entries are caller-owned names only, never fixture data. Identity kind must
// match the declaration kind, so a product identity can never authorize a
// component target and vice versa. This module describes the seam only: it
// executes no browser code and names no runner, document object, named route,
// selector, port, vendored fixture, or product threshold.

import { assertExactFields, assertNonEmptyString, freezeRecord } from '../core/values.mjs'
import { validateIdentity } from '../core/identity.mjs'
import { assertHostKind } from './kinds.mjs'

/**
 * @typedef {object} TargetDeclaration
 * @property {string} kind host kind, product or component
 * @property {import('../core/identity.mjs').Identity} identity identity on the matching kind branch
 * @property {string[]} capabilities non-empty capability inventory for the kind
 * @property {string[]} fixtures named fixtures the target serves
 * @property {string[]} actions named actions the target offers, possibly none
 */

/**
 * Closed capability vocabulary for product targets.
 */
export const PRODUCT_CAPABILITIES = freezeRecord(/** @type {const} */ ([
  'observe-chrome',
  'observe-body',
  'observe-route',
  'observe-section',
  'observe-view',
  'observe-theme',
  'perform-action',
]))

/** @typedef {(typeof PRODUCT_CAPABILITIES)[number]} ProductCapability */

/**
 * Closed capability vocabulary for component targets.
 */
export const COMPONENT_CAPABILITIES = freezeRecord(/** @type {const} */ ([
  'observe-root',
  'observe-interaction',
  'observe-theme',
  'perform-action',
]))

/** @typedef {(typeof COMPONENT_CAPABILITIES)[number]} ComponentCapability */

/**
 * Capabilities a product target must declare.
 */
export const PRODUCT_REQUIRED_CAPABILITIES = freezeRecord(/** @type {const} */ ([
  'observe-chrome',
  'observe-body',
  'observe-route',
  'observe-section',
  'observe-view',
  'observe-theme',
]))

/** @typedef {(typeof PRODUCT_REQUIRED_CAPABILITIES)[number]} ProductRequiredCapability */

/**
 * Capabilities a component target must declare.
 */
export const COMPONENT_REQUIRED_CAPABILITIES = freezeRecord(/** @type {const} */ (['observe-root', 'observe-theme']))

/** @typedef {(typeof COMPONENT_REQUIRED_CAPABILITIES)[number]} ComponentRequiredCapability */

/**
 * @typedef {object} TargetValue
 * @property {import('./kinds.mjs').HostKind} kind host kind the target declares
 * @property {string} id caller-owned target id
 * @property {string[]} capabilities declared capability inventory for the kind
 * @property {string[]} fixtures named fixtures the target serves
 * @property {string[]} actions named actions the target offers, possibly none
 */

const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

/**
 * Return the closed capability vocabulary for a host kind.
 * @param {string} kind
 * @returns {readonly string[]}
 */
export function capabilitiesFor(kind) {
  assertHostKind(kind, 'target.kind')
  return kind === 'product' ? PRODUCT_CAPABILITIES : COMPONENT_CAPABILITIES
}

/**
 * Return the required capabilities for a host kind.
 * @param {string} kind
 * @returns {readonly string[]}
 */
export function requiredCapabilitiesFor(kind) {
  assertHostKind(kind, 'target.kind')
  return kind === 'product' ? PRODUCT_REQUIRED_CAPABILITIES : COMPONENT_REQUIRED_CAPABILITIES
}

/**
 * Validate an unknown value as an identity on the expected kind branch and
 * return a frozen copy. A kind mismatch fails: identities never cross kinds.
 * @param {unknown} value
 * @param {string} expectedKind product or component
 * @param {string} label owning document used in diagnostics
 * @returns {import('../core/identity.mjs').Identity}
 */
export function validateTargetIdentity(value, expectedKind, label) {
  assertHostKind(expectedKind, 'target.kind')
  const identity = validateIdentity(value, label)
  if (identity.kind !== expectedKind) {
    throw new Error(`${label}: identity branch ${JSON.stringify(identity.kind)} does not match target kind ${JSON.stringify(expectedKind)} at path identity.kind; repair: declare the identity under kind ${JSON.stringify(expectedKind)} or change the target kind.`)
  }
  return identity
}

/**
 * Validate a capability inventory for a host kind and return a frozen copy.
 * The list must be non-empty, unique, drawn from the kind vocabulary, and
 * must include every required capability.
 * @param {unknown} value
 * @param {string} kind product or component
 * @param {string} label owning document used in diagnostics
 * @param {string} path value path used in diagnostics
 * @returns {string[]}
 */
export function validateCapabilityList(value, kind, label, path) {
  const allowed = capabilitiesFor(kind)
  const required = requiredCapabilitiesFor(kind)
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}: missing capabilities at path ${path}; repair: declare at least ${JSON.stringify(required[0])} in ${path}.`)
  }
  const seen = new Set()
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || !allowed.includes(entry)) {
      throw new Error(`${label}: unknown capability ${JSON.stringify(entry)} for kind ${JSON.stringify(kind)} at path ${path}[${index}]; repair: use one of ${allowed.join(', ')} in ${path}.`)
    }
    if (seen.has(entry)) {
      throw new Error(`${label}: duplicate capability ${JSON.stringify(entry)} at path ${path}[${index}]; repair: list every capability once in ${path}.`)
    }
    seen.add(entry)
  }
  for (const name of required) {
    if (!value.includes(name)) {
      throw new Error(`${label}: missing required capability ${JSON.stringify(name)} for kind ${JSON.stringify(kind)} at path ${path}; repair: add ${JSON.stringify(name)} to ${path}.`)
    }
  }
  return freezeRecord([...value])
}

/**
 * Validate a named fixture or action inventory and return a frozen copy.
 * Entries are caller-owned names only. Fixture inventories must be
 * non-empty; action inventories may be empty.
 * @param {unknown} value
 * @param {string} field fixture or action, used in diagnostics
 * @param {string} label owning document used in diagnostics
 * @param {string} path value path used in diagnostics
 * @param {boolean} allowEmpty true when an empty inventory is accepted
 * @returns {string[]}
 */
export function validateNameList(value, field, label, path, allowEmpty) {
  if (!Array.isArray(value)) {
    throw new Error(`${label}: invalid ${field} list at path ${path}; repair: provide a list of ${field} names in ${path}.`)
  }
  if (value.length === 0 && !allowEmpty) {
    throw new Error(`${label}: missing named ${field} at path ${path}; repair: declare at least one ${field} name in ${path}.`)
  }
  const seen = new Set()
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || entry.trim().length === 0 || !NAME_PATTERN.test(entry)) {
      throw new Error(`${label}: invalid ${field} name ${JSON.stringify(entry)} at path ${path}[${index}]; repair: use a lowercase ${field} name up to 64 characters in ${path}.`)
    }
    if (seen.has(entry)) {
      throw new Error(`${label}: duplicate ${field} name ${JSON.stringify(entry)} at path ${path}[${index}]; repair: list every ${field} name once in ${path}.`)
    }
    seen.add(entry)
  }
  return freezeRecord([...value])
}

/**
 * Create a frozen target value: the declaration-time identity of a target,
 * independent of any run. The capability inventory is validated against the
 * closed per-kind vocabulary and the required subset for the declared kind, so
 * a target missing a required capability cannot be constructed. Fixtures are
 * caller-owned names and must be non-empty; actions may be empty.
 * @param {unknown} input
 * @param {string} label owning document used in diagnostics
 * @returns {TargetValue}
 */
export function createTargetValue(input, label) {
  assertExactFields(input, ['kind', 'id', 'capabilities', 'fixtures', 'actions'], label, 'target')
  const record = /** @type {Record<string, unknown>} */ (input)
  assertHostKind(record.kind, 'target.kind')
  assertNonEmptyString(record.id, 'id', 'target.id')
  const capabilities = validateCapabilityList(record.capabilities, record.kind, label, 'target.capabilities')
  const fixtures = validateNameList(record.fixtures, 'fixture', label, 'target.fixtures', false)
  const actions = validateNameList(record.actions, 'action', label, 'target.actions', true)
  return freezeRecord({ kind: record.kind, id: record.id, capabilities, fixtures, actions })
}

/**
 * Create a frozen target declaration. Throws when any part is invalid.
 * @param {TargetDeclaration} input
 * @returns {TargetDeclaration}
 */
export function createTargetDeclaration(input) {
  assertExactFields(input, ['kind', 'identity', 'capabilities', 'fixtures', 'actions'], 'target', 'target')
  assertHostKind(input.kind, 'target.kind')
  const identity = validateTargetIdentity(input.identity, /** @type {string} */ (input.kind), 'target')
  const capabilities = validateCapabilityList(input.capabilities, /** @type {string} */ (input.kind), 'target', 'target.capabilities')
  const fixtures = validateNameList(input.fixtures, 'fixture', 'target', 'target.fixtures', false)
  const actions = validateNameList(input.actions, 'action', 'target', 'target.actions', true)
  return freezeRecord({ kind: input.kind, identity, capabilities, fixtures, actions })
}

/**
 * Validate an unknown value as a target declaration and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {TargetDeclaration}
 */
export function validateTargetDeclaration(value, label) {
  assertExactFields(value, ['kind', 'identity', 'capabilities', 'fixtures', 'actions'], label, 'target')
  return createTargetDeclaration(/** @type {TargetDeclaration} */ (value))
}

/**
 * Return true when a validated declaration carries a capability.
 * @param {TargetDeclaration} declaration
 * @param {string} name
 * @returns {boolean}
 */
export function requiresCapability(declaration, name) {
  const validated = validateTargetDeclaration(declaration, 'target')
  assertNonEmptyString(name, 'name', 'capability.name')
  return validated.capabilities.includes(name)
}

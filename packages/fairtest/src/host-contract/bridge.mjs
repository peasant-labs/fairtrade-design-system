// Local bridge and process lifecycle contract records: identity,
// readiness, and cleanup receipts.
//
// A bridge identity names one local or process participant before anything
// runs. A readiness record states which host and numeric channel the
// participant reports, and a cleanup record states which stop signal was
// observed and whether the participant was reaped and its channel released.
// All three are plain value records with exact fields, frozen copies, and
// path plus repair diagnostics. This module describes the contract only: it
// starts no service, opens no channel, spawns no process, executes no
// browser code, and names no runner, live document handle, named route,
// selector, vendored fixture, or caller threshold.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord } from '../core/values.mjs'
import { validateIdentity } from '../core/identity.mjs'

/**
 * @typedef {object} BridgeIdentity
 * @property {string} kind bridge participant kind, local or process
 * @property {string} id participant id
 * @property {number} createdAtMs creation time in whole milliseconds
 */

/**
 * @typedef {object} BridgeDeclaration
 * @property {string} kind bridge participant kind, local or process
 * @property {BridgeIdentity} identity identity on the matching kind branch
 * @property {string[]} capabilities non-empty capability inventory for the kind
 */

/**
 * @typedef {object} BridgeReadiness
 * @property {string} identityId owning bridge identity id
 * @property {string} host caller-owned host note for the reported endpoint
 * @property {number} port numeric channel the participant reports
 * @property {boolean} ready true when the participant reports itself ready
 * @property {number} observedAtMs observation time in whole milliseconds
 */

/**
 * @typedef {object} BridgeCleanup
 * @property {string} identityId owning bridge identity id
 * @property {string} signal stop signal observed for the participant
 * @property {boolean} reaped true when the participant was reaped
 * @property {boolean} portReleased true when the channel was released
 * @property {number} observedAtMs observation time in whole milliseconds
 */

/**
 * Closed bridge participant kinds.
 * @type {string[]}
 */
export const BRIDGE_IDENTITY_KINDS = freezeRecord(['local', 'process'])

/**
 * Closed capability vocabulary every bridge participant shares.
 * @type {string[]}
 */
export const BRIDGE_CAPABILITIES = freezeRecord(['describe-target', 'report-readiness', 'cleanup-process'])

/**
 * Capabilities every bridge declaration must carry.
 * @type {string[]}
 */
export const BRIDGE_REQUIRED_CAPABILITIES = freezeRecord(['report-readiness', 'cleanup-process'])

/**
 * Closed stop signals a cleanup receipt may report.
 * @type {string[]}
 */
export const BRIDGE_SIGNALS = freezeRecord(['completed', 'terminated', 'interrupted'])

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const MAX_SAFE = 9007199254740991
const MIN_PORT = 1
const MAX_PORT = 65535

/**
 * Assert the value names a known bridge participant kind.
 * @param {unknown} value
 * @param {string} path value path used in diagnostics
 * @returns {asserts value is string}
 */
export function assertBridgeKind(value, path) {
  if (!BRIDGE_IDENTITY_KINDS.includes(/** @type {string} */ (value))) {
    throw new Error(`invalid bridge kind ${JSON.stringify(value)} at path ${path}; repair: use one of ${BRIDGE_IDENTITY_KINDS.join(', ')} for the bridge kind.`)
  }
}

/**
 * Validate an unknown value as a bridge identity and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {BridgeIdentity}
 */
export function validateBridgeIdentity(value, label) {
  assertExactFields(value, ['kind', 'id', 'createdAtMs'], label, 'bridge.identity')
  const record = /** @type {Record<string, unknown>} */ (value)
  assertBridgeKind(record.kind, 'bridge.identity.kind')
  assertNonEmptyString(record.id, 'id', 'bridge.identity.id')
  if (!ID_PATTERN.test(/** @type {string} */ (record.id))) {
    throw new Error(`${label}: invalid bridge id ${JSON.stringify(record.id)} at path bridge.identity.id; repair: use a lowercase bridge id up to 64 characters in bridge.identity.id.`)
  }
  assertIntegerInRange(record.createdAtMs, 'createdAtMs', 'bridge.identity.createdAtMs', { min: 0, max: MAX_SAFE })
  return freezeRecord({ kind: record.kind, id: record.id, createdAtMs: record.createdAtMs })
}

/**
 * Validate a bridge capability inventory and return a frozen copy. The list
 * must be non-empty, unique, drawn from the shared vocabulary, and must
 * include every required capability.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @param {string} path value path used in diagnostics
 * @returns {string[]}
 */
export function validateBridgeCapabilities(value, label, path) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}: missing bridge capabilities at path ${path}; repair: declare at least ${JSON.stringify(BRIDGE_REQUIRED_CAPABILITIES[0])} in ${path}.`)
  }
  const seen = new Set()
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || !BRIDGE_CAPABILITIES.includes(entry)) {
      throw new Error(`${label}: unknown bridge capability ${JSON.stringify(entry)} at path ${path}[${index}]; repair: use one of ${BRIDGE_CAPABILITIES.join(', ')} in ${path}.`)
    }
    if (seen.has(entry)) {
      throw new Error(`${label}: duplicate bridge capability ${JSON.stringify(entry)} at path ${path}[${index}]; repair: list every bridge capability once in ${path}.`)
    }
    seen.add(entry)
  }
  for (const name of BRIDGE_REQUIRED_CAPABILITIES) {
    if (!value.includes(name)) {
      throw new Error(`${label}: missing required bridge capability ${JSON.stringify(name)} at path ${path}; repair: add ${JSON.stringify(name)} to ${path}.`)
    }
  }
  return freezeRecord([...value])
}

/**
 * Create a frozen bridge declaration. The identity branch must match the
 * declaration kind so a local identity can never authorize a process
 * participant and vice versa.
 * @param {BridgeDeclaration} input
 * @returns {BridgeDeclaration}
 */
export function createBridgeDeclaration(input) {
  assertExactFields(input, ['kind', 'identity', 'capabilities'], 'bridge', 'bridge')
  assertBridgeKind(input.kind, 'bridge.kind')
  const identity = validateBridgeIdentity(input.identity, 'bridge')
  if (identity.kind !== input.kind) {
    throw new Error(`bridge: identity branch ${JSON.stringify(identity.kind)} does not match bridge kind ${JSON.stringify(input.kind)} at path bridge.identity.kind; repair: declare the identity under kind ${JSON.stringify(input.kind)} or change the bridge kind.`)
  }
  const capabilities = validateBridgeCapabilities(input.capabilities, 'bridge', 'bridge.capabilities')
  return freezeRecord({ kind: input.kind, identity, capabilities })
}

/**
 * Validate an unknown value as a bridge declaration and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {BridgeDeclaration}
 */
export function validateBridgeDeclaration(value, label) {
  assertExactFields(value, ['kind', 'identity', 'capabilities'], label, 'bridge')
  return createBridgeDeclaration(/** @type {BridgeDeclaration} */ (value))
}

/**
 * Return true when a validated bridge declaration carries a capability.
 * @param {BridgeDeclaration} declaration
 * @param {string} name
 * @returns {boolean}
 */
export function requiresBridgeCapability(declaration, name) {
  const validated = validateBridgeDeclaration(declaration, 'bridge')
  assertNonEmptyString(name, 'name', 'bridge.capability.name')
  return validated.capabilities.includes(name)
}

/**
 * Validate an unknown value as a bridge readiness record and return a frozen
 * copy. The host is a caller-owned note only; the channel is a numeric range
 * with no pinned endpoint literal at this layer.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {BridgeReadiness}
 */
export function validateBridgeReadiness(value, label) {
  assertExactFields(value, ['identityId', 'host', 'port', 'ready', 'observedAtMs'], label, 'bridge.readiness')
  const record = /** @type {Record<string, unknown>} */ (value)
  assertNonEmptyString(record.identityId, 'identityId', 'bridge.readiness.identityId')
  if (!ID_PATTERN.test(/** @type {string} */ (record.identityId))) {
    throw new Error(`${label}: invalid bridge identity id ${JSON.stringify(record.identityId)} at path bridge.readiness.identityId; repair: use a lowercase bridge id up to 64 characters in bridge.readiness.identityId.`)
  }
  assertNonEmptyString(record.host, 'host', 'bridge.readiness.host')
  if (/** @type {string} */ (record.host).includes('://')) {
    throw new Error(`${label}: invalid bridge host ${JSON.stringify(record.host)} at path bridge.readiness.host; repair: use a plain host note without a scheme in bridge.readiness.host.`)
  }
  assertIntegerInRange(record.port, 'port', 'bridge.readiness.port', { min: MIN_PORT, max: MAX_PORT })
  if (typeof record.ready !== 'boolean') {
    throw new Error(`${label}: invalid readiness flag ${JSON.stringify(record.ready)} at path bridge.readiness.ready; repair: use true or false for readiness in bridge.readiness.ready.`)
  }
  assertIntegerInRange(record.observedAtMs, 'observedAtMs', 'bridge.readiness.observedAtMs', { min: 0, max: MAX_SAFE })
  return freezeRecord({
    identityId: record.identityId,
    host: record.host,
    port: record.port,
    ready: record.ready,
    observedAtMs: record.observedAtMs,
  })
}

/**
 * Validate an unknown value as a bridge cleanup receipt and return a frozen
 * copy. A receipt must name a closed stop signal and report both the reap
 * and the channel release as explicit booleans.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {BridgeCleanup}
 */
export function validateBridgeCleanup(value, label) {
  assertExactFields(value, ['identityId', 'signal', 'reaped', 'portReleased', 'observedAtMs'], label, 'bridge.cleanup')
  const record = /** @type {Record<string, unknown>} */ (value)
  assertNonEmptyString(record.identityId, 'identityId', 'bridge.cleanup.identityId')
  if (!ID_PATTERN.test(/** @type {string} */ (record.identityId))) {
    throw new Error(`${label}: invalid bridge identity id ${JSON.stringify(record.identityId)} at path bridge.cleanup.identityId; repair: use a lowercase bridge id up to 64 characters in bridge.cleanup.identityId.`)
  }
  if (!BRIDGE_SIGNALS.includes(/** @type {string} */ (record.signal))) {
    throw new Error(`${label}: unknown bridge signal ${JSON.stringify(record.signal)} at path bridge.cleanup.signal; repair: use one of ${BRIDGE_SIGNALS.join(', ')} in bridge.cleanup.signal.`)
  }
  for (const field of ['reaped', 'portReleased']) {
    if (typeof record[field] !== 'boolean') {
      throw new Error(`${label}: invalid cleanup flag ${JSON.stringify(record[field])} at path bridge.cleanup.${field}; repair: use true or false for cleanup in bridge.cleanup.${field}.`)
    }
  }
  assertIntegerInRange(record.observedAtMs, 'observedAtMs', 'bridge.cleanup.observedAtMs', { min: 0, max: MAX_SAFE })
  return freezeRecord({
    identityId: record.identityId,
    signal: record.signal,
    reaped: record.reaped,
    portReleased: record.portReleased,
    observedAtMs: record.observedAtMs,
  })
}

/**
 * Validate a core identity value on the bridge participant vocabulary. Core
 * identities carry their own kind branch; this helper proves a core identity
 * is never mistaken for a bridge identity without an explicit bridge check.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {import('../core/identity.mjs').Identity}
 */
export function validateCoreIdentityForBridge(value, label) {
  return validateIdentity(value, label)
}

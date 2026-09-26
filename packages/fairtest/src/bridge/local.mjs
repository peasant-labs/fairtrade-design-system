// Neutral local invocation contract for the optional local bridge handoff.
//
// A local invocation identity names one already-served local participant
// before anything runs: an owning run, a distinct invocation id, the project,
// the exact adapter-selected target, and the local purpose. It is a bridge
// participant of kind `local` only. A process participant, a producer evidence
// row, or any other purpose is refused before a service starts, so a local
// participant can never masquerade as producer evidence. The scenario,
// provenance, and readout records carry caller-owned values only, and readiness
// and cleanup reuse the shared bridge contract with local ownership enforced,
// so this module names no runner, route, selector, fixture, port, host, or app
// literal.
//
// This module describes the contract only: it starts no service, opens no
// channel, and executes no page code. The bridge identity, readiness, cleanup,
// and declaration vocabulary is reused from the host-contract bridge module
// rather than redeclared here.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord, isPlainRecord } from '../core/values.mjs'
import { HOST_KINDS } from '../host-contract/kinds.mjs'
import {
  createBridgeDeclaration,
  validateBridgeCleanup,
  validateBridgeDeclaration,
  validateBridgeIdentity,
  validateBridgeReadiness,
} from '../host-contract/bridge.mjs'

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const MAX_SAFE = 9007199254740991

/**
 * The one purpose a local invocation identity may carry. Any other purpose is
 * a producer or process identity and is refused before service startup.
 * @type {string}
 */
export const LOCAL_INVOCATION_PURPOSE = 'local'

/**
 * Closed local invocation purposes. Exactly one: a local participant is local
 * and nothing else.
 * @type {string[]}
 */
export const LOCAL_INVOCATION_PURPOSES = freezeRecord(['local'])

/**
 * Exact fields of one local invocation identity.
 * @type {string[]}
 */
export const LOCAL_INVOCATION_IDENTITY_FIELDS = freezeRecord([
  'purpose',
  'runId',
  'invocationId',
  'project',
  'targetId',
  'createdAtMs',
])

/**
 * Exact fields of one local scenario: the served route, the named fixture the
 * target serves, and the named action the target offers. All three are
 * caller-owned names, never app data embedded at this layer.
 * @type {string[]}
 */
export const LOCAL_SCENARIO_FIELDS = freezeRecord(['route', 'fixture', 'action'])

/**
 * Exact fields of one local provenance record.
 * @type {string[]}
 */
export const LOCAL_PROVENANCE_FIELDS = freezeRecord(['source', 'root', 'commit', 'dirty', 'producedAtMs'])

/**
 * Exact fields of one local readout: the local identity, the matching bridge
 * declaration, the scenario, the provenance, and the served URL.
 * @type {string[]}
 */
export const LOCAL_READOUT_FIELDS = freezeRecord(['identity', 'declaration', 'scenario', 'provenance', 'url'])

/**
 * Refuse a value that tries to claim producer or process identity where a
 * local invocation identity is required. A non-local purpose or a producer
 * evidence row marker fails with a purpose-scoped diagnostic, so the
 * distinction is named at the boundary instead of surfacing as a generic shape
 * error.
 * @param {unknown} value candidate identity
 * @param {string} label owning record used in diagnostics
 * @returns {true} always true when the value is not a producer or process identity
 */
export function assertLocalInvocationNotProducer(value, label) {
  if (isPlainRecord(value)) {
    const purpose = /** @type {Record<string, unknown>} */ (value).purpose
    if (purpose !== undefined && purpose !== LOCAL_INVOCATION_PURPOSE) {
      throw new Error(
        `${label}: refused non-local purpose ${JSON.stringify(purpose)} for field "purpose" at path local.identity.purpose; ` +
        `repair: use ${JSON.stringify(LOCAL_INVOCATION_PURPOSE)} for a local invocation; a producer or process identity is refused here.`,
      )
    }
    const record = /** @type {Record<string, unknown>} */ (value)
    if (HOST_KINDS.includes(/** @type {string} */ (record.kind)) || 'key' in record || 'theme' in record || 'artifacts' in record) {
      throw new Error(
        `${label}: refused producer evidence identity for field "purpose" at path local.identity.purpose; ` +
        'repair: pass a local invocation identity carrying purpose "local" here; producer rows are read only by the evidence verifier.',
      )
    }
  }
  return true
}

/**
 * Validate an unknown value as a local invocation identity and return a frozen
 * copy. The identity is validated as a bridge identity of kind `local`, so it
 * shares the bridge id shape and can be handed to the bridge declaration,
 * readiness, and cleanup validators without a second identity shape.
 * @param {unknown} value
 * @param {string} label owning record used in diagnostics
 * @returns {{ purpose: string, runId: string, invocationId: string, project: string, targetId: string, createdAtMs: number }}
 */
export function validateLocalInvocationIdentity(value, label) {
  assertLocalInvocationNotProducer(value, label)
  assertExactFields(value, [...LOCAL_INVOCATION_IDENTITY_FIELDS], label, 'local.identity')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (record.purpose !== LOCAL_INVOCATION_PURPOSE) {
    throw new Error(
      `${label}: invalid purpose ${JSON.stringify(record.purpose)} for field "purpose" at path local.identity.purpose; ` +
      `repair: use ${JSON.stringify(LOCAL_INVOCATION_PURPOSE)} for "purpose".`,
    )
  }
  for (const field of ['runId', 'invocationId', 'project', 'targetId']) {
    assertNonEmptyString(record[field], field, `local.identity.${field}`)
  }
  for (const field of ['runId', 'invocationId']) {
    if (!ID_PATTERN.test(/** @type {string} */ (record[field]))) {
      throw new Error(
        `${label}: invalid value ${JSON.stringify(record[field])} for field "${field}" at path local.identity.${field}; ` +
        `repair: use a lowercase id up to 64 characters for "${field}".`,
      )
    }
  }
  assertIntegerInRange(record.createdAtMs, 'createdAtMs', 'local.identity.createdAtMs', { min: 0, max: MAX_SAFE })
  // Reuse the shared bridge identity on the local branch so the id shape and
  // kind membership are the host contract's, not a second local copy.
  validateBridgeIdentity({ kind: 'local', id: record.invocationId, createdAtMs: record.createdAtMs }, label)
  return freezeRecord({
    purpose: LOCAL_INVOCATION_PURPOSE,
    runId: record.runId,
    invocationId: record.invocationId,
    project: record.project,
    targetId: record.targetId,
    createdAtMs: record.createdAtMs,
  })
}

/**
 * Create a frozen local invocation identity from an explicit input.
 * @param {object} input identity fields
 * @returns {{ purpose: string, runId: string, invocationId: string, project: string, targetId: string, createdAtMs: number }}
 */
export function createLocalInvocationIdentity(input) {
  return validateLocalInvocationIdentity(input, 'local invocation')
}

/**
 * Build the matching local bridge declaration. The identity is validated on
 * the local branch and the declaration is created through the shared bridge
 * contract, which enforces that the identity kind matches the declaration
 * kind. A producer or process identity therefore cannot authorize a local
 * declaration.
 * @param {unknown} identity candidate local invocation identity
 * @param {string[]} capabilities declared bridge capability inventory
 * @returns {object} the frozen bridge declaration on the local kind
 */
export function createLocalBridgeDeclaration(identity, capabilities) {
  const local = validateLocalInvocationIdentity(identity, 'local bridge')
  return createBridgeDeclaration({
    kind: 'local',
    identity: { kind: 'local', id: local.invocationId, createdAtMs: local.createdAtMs },
    capabilities,
  })
}

/**
 * Validate an unknown value as a local scenario and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning record used in diagnostics
 * @returns {{ route: string, fixture: string, action: string }}
 */
export function validateLocalScenario(value, label) {
  assertExactFields(value, [...LOCAL_SCENARIO_FIELDS], label, 'local.scenario')
  const record = /** @type {Record<string, unknown>} */ (value)
  for (const field of LOCAL_SCENARIO_FIELDS) {
    assertNonEmptyString(record[field], field, `local.scenario.${field}`)
  }
  return freezeRecord({ route: record.route, fixture: record.fixture, action: record.action })
}

/**
 * Create a frozen local scenario from an explicit input.
 * @param {object} input scenario fields
 * @returns {{ route: string, fixture: string, action: string }}
 */
export function createLocalScenario(input) {
  return validateLocalScenario(input, 'local scenario')
}

/**
 * Validate an unknown value as a local provenance record and return a frozen
 * copy. The values are caller-owned: this layer names no built tree, commit
 * command, or served byte.
 * @param {unknown} value
 * @param {string} label owning record used in diagnostics
 * @returns {{ source: string, root: string, commit: string, dirty: boolean, producedAtMs: number }}
 */
export function validateLocalProvenance(value, label) {
  assertExactFields(value, [...LOCAL_PROVENANCE_FIELDS], label, 'local.provenance')
  const record = /** @type {Record<string, unknown>} */ (value)
  for (const field of ['source', 'root', 'commit']) {
    assertNonEmptyString(record[field], field, `local.provenance.${field}`)
  }
  if (typeof record.dirty !== 'boolean') {
    throw new Error(
      `${label}: invalid value ${JSON.stringify(record.dirty)} for field "dirty" at path local.provenance.dirty; ` +
      'repair: use true or false for "dirty".',
    )
  }
  assertIntegerInRange(record.producedAtMs, 'producedAtMs', 'local.provenance.producedAtMs', { min: 0, max: MAX_SAFE })
  return freezeRecord({
    source: record.source,
    root: record.root,
    commit: record.commit,
    dirty: record.dirty,
    producedAtMs: record.producedAtMs,
  })
}

/**
 * Create a frozen local provenance record from an explicit input.
 * @param {object} input provenance fields
 * @returns {{ source: string, root: string, commit: string, dirty: boolean, producedAtMs: number }}
 */
export function createLocalProvenance(input) {
  return validateLocalProvenance(input, 'local provenance')
}

/**
 * Validate an unknown value as a local readout and return a frozen copy. The
 * declaration must be the local bridge declaration for the readout identity,
 * so a readout can never pair one participant's identity with another's
 * declaration.
 * @param {unknown} value
 * @param {string} label owning record used in diagnostics
 * @returns {object} the frozen readout
 */
export function validateLocalReadout(value, label) {
  assertExactFields(value, [...LOCAL_READOUT_FIELDS], label, 'local.readout')
  const record = /** @type {Record<string, unknown>} */ (value)
  const identity = validateLocalInvocationIdentity(record.identity, label)
  const declaration = validateBridgeDeclaration(record.declaration, label)
  if (declaration.kind !== 'local' || declaration.identity.id !== identity.invocationId) {
    throw new Error(
      `${label}: declaration does not belong to the readout identity for field "declaration" at path local.readout.declaration; ` +
      `expected the local declaration for ${JSON.stringify(identity.invocationId)} observed ${JSON.stringify(declaration.identity.id)} under kind ${JSON.stringify(declaration.kind)}; ` +
      'repair: build the declaration from the same local identity in the readout.',
    )
  }
  const scenario = validateLocalScenario(record.scenario, label)
  const provenance = validateLocalProvenance(record.provenance, label)
  assertNonEmptyString(record.url, 'url', 'local.readout.url')
  return freezeRecord({ identity, declaration, scenario, provenance, url: record.url })
}

/**
 * Create a frozen local readout from an explicit input.
 * @param {object} input readout fields
 * @returns {object} the frozen readout
 */
export function createLocalReadout(input) {
  return validateLocalReadout(input, 'local readout')
}

/**
 * Validate a readiness receipt for one local identity. The shared bridge
 * readiness record is validated first, then its owning identity must be this
 * local invocation, so a readiness record cannot be reported for another
 * participant.
 * @param {unknown} value candidate readiness record
 * @param {unknown} identity owning local invocation identity
 * @param {string} label owning record used in diagnostics
 * @returns {object} the frozen bridge readiness record
 */
export function validateLocalReadiness(value, identity, label) {
  const local = validateLocalInvocationIdentity(identity, label)
  const readiness = validateBridgeReadiness(value, label)
  if (readiness.identityId !== local.invocationId) {
    throw new Error(
      `${label}: readiness names another participant for field "identityId" at path bridge.readiness.identityId; ` +
      `expected ${JSON.stringify(local.invocationId)} observed ${JSON.stringify(readiness.identityId)}; ` +
      'repair: report readiness for the local invocation identity that owns the running service.',
    )
  }
  return readiness
}

/**
 * Validate a cleanup receipt for one local identity. The shared bridge cleanup
 * record is validated first, then its owning identity must be this local
 * invocation, so a cleanup cannot be credited to another participant.
 * @param {unknown} value candidate cleanup record
 * @param {unknown} identity owning local invocation identity
 * @param {string} label owning record used in diagnostics
 * @returns {object} the frozen bridge cleanup record
 */
export function validateLocalCleanup(value, identity, label) {
  const local = validateLocalInvocationIdentity(identity, label)
  const cleanup = validateBridgeCleanup(value, label)
  if (cleanup.identityId !== local.invocationId) {
    throw new Error(
      `${label}: cleanup names another participant for field "identityId" at path bridge.cleanup.identityId; ` +
      `expected ${JSON.stringify(local.invocationId)} observed ${JSON.stringify(cleanup.identityId)}; ` +
      'repair: report cleanup for the local invocation identity that owned the running service.',
    )
  }
  return cleanup
}

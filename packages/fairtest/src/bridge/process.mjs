// @ts-check

// Neutral process invocation contract for the Fairtest CI process supervisor.
//
// A process invocation identity names one supervised process case before any
// child starts: an owning run, a distinct invocation id, the project, the exact
// process case id, and the process purpose. It is a bridge participant of kind
// `process` only. A local identity, a producer evidence row, or any other
// purpose is refused before a service starts, so a process participant can
// never masquerade as a matrix producer or local evidence.
//
// The module also owns the neutral case-spec, deadline, and cleanup-receipt
// vocabulary every supervised case shares: the closed scenario and outcome
// names, the case deadline limits (readiness, internal supervisor, grace, and
// the outer fail-safe), and the durable receipt that records the observed PID,
// listener, process group, signal, reap, and port postconditions of all four
// named cases. The receipt validator refuses a partial case set, so a supervisor
// killed before it observed a case can never be credited with that case's
// cleanup.
//
// This module describes the contract only: it starts no service, opens no
// channel, spawns no process, and executes no page code. Identity, readiness,
// cleanup, and declaration vocabulary is reused from the host-contract bridge
// module rather than redeclared here. The supervisor and its app-owned fixtures
// live in the app script layer.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord, isPlainRecord } from '../core/values.mjs'
import { HOST_KINDS } from '../host-contract/kinds.mjs'
import {
  BRIDGE_SIGNALS,
  createBridgeDeclaration,
  validateBridgeCleanup,
  validateBridgeDeclaration,
  validateBridgeIdentity,
  validateBridgeReadiness,
} from '../host-contract/bridge.mjs'

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const MAX_SAFE = 9007199254740991
const MIN_PORT = 1
const MAX_PORT = 65535

/**
 * One validated process invocation identity.
 * @typedef {object} ProcessInvocationIdentity
 * @property {string} purpose always the process purpose
 * @property {string} runId owning run identity id
 * @property {string} invocationId distinct process invocation id
 * @property {string} project caller-owned project label
 * @property {string} processCaseId one of the named process cases
 * @property {number} createdAtMs creation time in whole milliseconds
 */

/**
 * One validated process case deadline limits record.
 * @typedef {object} ProcessLimits
 * @property {number} readinessDeadlineMs readiness wait in whole milliseconds
 * @property {number} supervisorDeadlineMs internal supervisor deadline in whole milliseconds
 * @property {number} outerDeadlineMs caller-owned outer fail-safe in whole milliseconds
 * @property {number} graceMs observed cleanup grace in whole milliseconds
 */

/**
 * One validated process case spec.
 * @typedef {object} ProcessCaseSpec
 * @property {string} name one of the named process cases
 * @property {string} scenario one of the closed process scenarios
 * @property {ProcessLimits} limits case deadline limits
 * @property {string} outcome one of the closed process outcomes
 * @property {boolean} expectReady whether the case is expected to report ready
 * @property {boolean} deadlineExceeded whether the case is expected to outlive its deadline
 */

/**
 * One validated case entry inside a durable cleanup receipt.
 * @typedef {object} ProcessCaseReceipt
 * @property {string} caseId one of the named process cases
 * @property {string} scenario one of the closed process scenarios
 * @property {string} outcome one of the closed process outcomes
 * @property {string} signal one of the closed bridge stop signals
 * @property {boolean} reaped whether the case child was reaped
 * @property {boolean} portReleased whether the case channel was released
 * @property {number} pid observed child process id
 * @property {number} port observed listener port
 * @property {string} processGroup observed process group note
 * @property {boolean} deadlineExceeded whether the case outlived its deadline
 * @property {number} observedAtMs observation time in whole milliseconds
 */

/**
 * The one purpose a process invocation identity may carry. Any other purpose
 * is a local or producer identity and is refused before service startup.
 * @type {string}
 */
export const PROCESS_INVOCATION_PURPOSE = 'process'

/**
 * Closed process invocation purposes. Exactly one: a process participant is a
 * process and nothing else.
 * @type {string[]}
 */
export const PROCESS_INVOCATION_PURPOSES = freezeRecord(['process'])

/**
 * Exact fields of one process invocation identity.
 * @type {string[]}
 */
export const PROCESS_INVOCATION_IDENTITY_FIELDS = freezeRecord([
  'purpose',
  'runId',
  'invocationId',
  'project',
  'processCaseId',
  'createdAtMs',
])

/**
 * The four named process cases the CI command supervises, in declared order.
 * The receipt must name exactly these, so a missing case is observable.
 * @type {string[]}
 */
export const PROCESS_CASE_IDS = freezeRecord([
  'process-normal-stop',
  'process-partial-start',
  'process-bounded-timeout',
  'process-sigterm-interruption',
])

/**
 * Closed process scenario vocabulary. One scenario names one fixture child
 * lifecycle the supervisor drives; an unknown scenario is refused.
 * @type {string[]}
 */
export const PROCESS_SCENARIOS = freezeRecord(['normal', 'partial-start', 'timeout', 'interruption'])

/**
 * Closed process outcome vocabulary. `stopped` is a clean requested stop,
 * `readiness-failed` is a partial start that never reported ready,
 * `deadline-exceeded` is a case that outlived its internal deadline, and
 * `interrupted` is a case stopped by the supervisor's own interruption.
 * @type {string[]}
 */
export const PROCESS_OUTCOMES = freezeRecord(['stopped', 'readiness-failed', 'deadline-exceeded', 'interrupted'])

/**
 * Exact fields of one case deadline limits record. `outerDeadlineMs` is the
 * caller-owned fail-safe that must stay longer than `supervisorDeadlineMs`, so
 * the internal supervisor always has room to observe cleanup before the outer
 * bound gives up.
 * @type {string[]}
 */
export const PROCESS_LIMITS_FIELDS = freezeRecord([
  'readinessDeadlineMs',
  'supervisorDeadlineMs',
  'outerDeadlineMs',
  'graceMs',
])

/**
 * Exact fields of one durable cleanup receipt.
 * @type {string[]}
 */
export const PROCESS_RECEIPT_FIELDS = freezeRecord([
  'version',
  'runId',
  'project',
  'purpose',
  'invocationId',
  'cases',
  'observedAtMs',
])

/**
 * Exact fields of one case entry inside a cleanup receipt. The observed PID,
 * listener port, process group, signal, reap, and port release are recorded
 * together so a claimed cleanup can be checked field by field.
 * @type {string[]}
 */
export const PROCESS_CASE_RECEIPT_FIELDS = freezeRecord([
  'caseId',
  'scenario',
  'outcome',
  'signal',
  'reaped',
  'portReleased',
  'pid',
  'port',
  'processGroup',
  'deadlineExceeded',
  'observedAtMs',
])

/**
 * Exact fields of one process case spec, as declared in the process case
 * fixture family.
 * @type {string[]}
 */
export const PROCESS_CASE_SPEC_FIELDS = freezeRecord([
  'name',
  'scenario',
  'limits',
  'outcome',
  'expectReady',
  'deadlineExceeded',
])

/**
 * Receipt schema version written into every durable cleanup receipt.
 * @type {number}
 */
export const PROCESS_RECEIPT_VERSION = 1

/**
 * Refuse a value that tries to claim a local or producer identity where a
 * process invocation identity is required. A non-process purpose or a producer
 * evidence row marker fails with a purpose-scoped diagnostic, so the
 * distinction is named at the boundary instead of surfacing as a generic shape
 * error.
 * @param {unknown} value candidate identity
 * @param {string} label owning record used in diagnostics
 * @returns {true} always true when the value is not a local or producer identity
 */
export function assertProcessInvocationNotProducer(value, label) {
  if (isPlainRecord(value)) {
    const purpose = /** @type {Record<string, unknown>} */ (value).purpose
    if (purpose !== undefined && purpose !== PROCESS_INVOCATION_PURPOSE) {
      throw new Error(
        `${label}: refused non-process purpose ${JSON.stringify(purpose)} for field "purpose" at path process.identity.purpose; ` +
        `repair: use ${JSON.stringify(PROCESS_INVOCATION_PURPOSE)} for a process invocation; a local or producer identity is refused here.`,
      )
    }
    const record = /** @type {Record<string, unknown>} */ (value)
    if (/** @type {readonly string[]} */ (HOST_KINDS).includes(/** @type {string} */ (record.kind)) || 'key' in record || 'theme' in record || 'artifacts' in record) {
      throw new Error(
        `${label}: refused producer evidence identity for field "purpose" at path process.identity.purpose; ` +
        'repair: pass a process invocation identity carrying purpose "process" here; producer rows are read only by the evidence verifier.',
      )
    }
  }
  return true
}

/**
 * Validate an unknown value as a process invocation identity and return a
 * frozen copy. The identity is validated as a bridge identity of kind
 * `process`, so it shares the bridge id shape and can be handed to the bridge
 * declaration, readiness, and cleanup validators without a second identity
 * shape.
 * @param {unknown} value
 * @param {string} label owning record used in diagnostics
 * @returns {ProcessInvocationIdentity}
 */
export function validateProcessInvocationIdentity(value, label) {
  assertProcessInvocationNotProducer(value, label)
  assertExactFields(value, [...PROCESS_INVOCATION_IDENTITY_FIELDS], label, 'process.identity')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (record.purpose !== PROCESS_INVOCATION_PURPOSE) {
    throw new Error(
      `${label}: invalid purpose ${JSON.stringify(record.purpose)} for field "purpose" at path process.identity.purpose; ` +
      `repair: use ${JSON.stringify(PROCESS_INVOCATION_PURPOSE)} for "purpose".`,
    )
  }
  for (const field of ['runId', 'invocationId', 'project', 'processCaseId']) {
    assertNonEmptyString(record[field], field, `process.identity.${field}`)
  }
  for (const field of ['runId', 'invocationId']) {
    if (!ID_PATTERN.test(/** @type {string} */ (record[field]))) {
      throw new Error(
        `${label}: invalid value ${JSON.stringify(record[field])} for field "${field}" at path process.identity.${field}; ` +
        `repair: use a lowercase id up to 64 characters for "${field}".`,
      )
    }
  }
  if (!PROCESS_CASE_IDS.includes(/** @type {string} */ (record.processCaseId))) {
    throw new Error(
      `${label}: unknown process case ${JSON.stringify(record.processCaseId)} for field "processCaseId" at path process.identity.processCaseId; ` +
      `repair: use one of ${PROCESS_CASE_IDS.join(', ')} for "processCaseId".`,
    )
  }
  assertIntegerInRange(record.createdAtMs, 'createdAtMs', 'process.identity.createdAtMs', { min: 0, max: MAX_SAFE })
  // Reuse the shared bridge identity on the process branch so the id shape and
  // kind membership are the host contract's, not a second process copy.
  validateBridgeIdentity({ kind: 'process', id: record.invocationId, createdAtMs: record.createdAtMs }, label)
  return /** @type {ProcessInvocationIdentity} */ (freezeRecord({
    purpose: PROCESS_INVOCATION_PURPOSE,
    runId: record.runId,
    invocationId: record.invocationId,
    project: record.project,
    processCaseId: record.processCaseId,
    createdAtMs: record.createdAtMs,
  }))
}

/**
 * Create a frozen process invocation identity from an explicit input.
 * @param {object} input identity fields
 * @returns {ProcessInvocationIdentity}
 */
export function createProcessInvocationIdentity(input) {
  return validateProcessInvocationIdentity(input, 'process invocation')
}

/**
 * Build the matching process bridge declaration. The identity is validated on
 * the process branch and the declaration is created through the shared bridge
 * contract, which enforces that the identity kind matches the declaration
 * kind. A local or producer identity therefore cannot authorize a process
 * declaration.
 * @param {unknown} identity candidate process invocation identity
 * @param {string[]} capabilities declared bridge capability inventory
 * @returns {object} the frozen bridge declaration on the process kind
 */
export function createProcessBridgeDeclaration(identity, capabilities) {
  const processIdentity = validateProcessInvocationIdentity(identity, 'process bridge')
  return createBridgeDeclaration({
    kind: 'process',
    identity: { kind: 'process', id: processIdentity.invocationId, createdAtMs: processIdentity.createdAtMs },
    capabilities,
  })
}

/**
 * Validate a readiness receipt for one process identity. The shared bridge
 * readiness record is validated first, then its owning identity must be this
 * process invocation, so a readiness record cannot be reported for another
 * participant.
 * @param {unknown} value candidate readiness record
 * @param {unknown} identity owning process invocation identity
 * @param {string} label owning record used in diagnostics
 * @returns {object} the frozen bridge readiness record
 */
export function validateProcessReadiness(value, identity, label) {
  const processIdentity = validateProcessInvocationIdentity(identity, label)
  const readiness = validateBridgeReadiness(value, label)
  if (readiness.identityId !== processIdentity.invocationId) {
    throw new Error(
      `${label}: readiness names another participant for field "identityId" at path bridge.readiness.identityId; ` +
      `expected ${JSON.stringify(processIdentity.invocationId)} observed ${JSON.stringify(readiness.identityId)}; ` +
      'repair: report readiness for the process invocation identity that owns the running child.',
    )
  }
  return readiness
}

/**
 * Validate a cleanup receipt for one process identity. The shared bridge
 * cleanup record is validated first, then its owning identity must be this
 * process invocation, so a cleanup cannot be credited to another participant.
 * @param {unknown} value candidate cleanup record
 * @param {unknown} identity owning process invocation identity
 * @param {string} label owning record used in diagnostics
 * @returns {object} the frozen bridge cleanup record
 */
export function validateProcessCleanup(value, identity, label) {
  const processIdentity = validateProcessInvocationIdentity(identity, label)
  const cleanup = validateBridgeCleanup(value, label)
  if (cleanup.identityId !== processIdentity.invocationId) {
    throw new Error(
      `${label}: cleanup names another participant for field "identityId" at path bridge.cleanup.identityId; ` +
      `expected ${JSON.stringify(processIdentity.invocationId)} observed ${JSON.stringify(cleanup.identityId)}; ` +
      'repair: report cleanup for the process invocation identity that owned the running child.',
    )
  }
  return cleanup
}

/**
 * Validate the deadline limits of one process case and return a frozen copy.
 * The readiness interval must fit inside the internal supervisor deadline and the
 * outer fail-safe must stay strictly longer than the internal deadline, so a
 * supervisor always has room to observe cleanup before the outer bound fires.
 * @param {unknown} value candidate limits record
 * @param {string} label owning record used in diagnostics
 * @returns {ProcessLimits}
 */
export function validateProcessLimits(value, label) {
  assertExactFields(value, [...PROCESS_LIMITS_FIELDS], label, 'process.limits')
  const record = /** @type {Record<string, unknown>} */ (value)
  assertIntegerInRange(record.readinessDeadlineMs, 'readinessDeadlineMs', 'process.limits.readinessDeadlineMs', { min: 1, max: MAX_SAFE })
  assertIntegerInRange(record.supervisorDeadlineMs, 'supervisorDeadlineMs', 'process.limits.supervisorDeadlineMs', { min: 1, max: MAX_SAFE })
  assertIntegerInRange(record.outerDeadlineMs, 'outerDeadlineMs', 'process.limits.outerDeadlineMs', { min: 1, max: MAX_SAFE })
  assertIntegerInRange(record.graceMs, 'graceMs', 'process.limits.graceMs', { min: 0, max: MAX_SAFE })
  if (record.readinessDeadlineMs > record.supervisorDeadlineMs) {
    throw new Error(
      `${label}: readiness interval does not fit inside the internal supervisor deadline for field "readinessDeadlineMs" at path process.limits.readinessDeadlineMs; ` +
      `expected <= ${record.supervisorDeadlineMs} observed ${record.readinessDeadlineMs}; ` +
      'repair: keep the readiness deadline at or below the internal supervisor deadline.',
    )
  }
  if (record.outerDeadlineMs <= record.supervisorDeadlineMs) {
    throw new Error(
      `${label}: outer fail-safe deadline does not exceed the internal supervisor deadline for field "outerDeadlineMs" at path process.limits.outerDeadlineMs; ` +
      `expected > ${record.supervisorDeadlineMs} observed ${record.outerDeadlineMs}; ` +
      'repair: keep the outer fail-safe strictly longer than the internal supervisor deadline so the supervisor can observe cleanup first.',
    )
  }
  return freezeRecord({
    readinessDeadlineMs: record.readinessDeadlineMs,
    supervisorDeadlineMs: record.supervisorDeadlineMs,
    outerDeadlineMs: record.outerDeadlineMs,
    graceMs: record.graceMs,
  })
}

/**
 * Validate one process case spec and return a frozen copy. The scenario and the
 * expected outcome are drawn from the closed vocabularies, the limits carry the
 * deadline invariant, and the readiness/deadline expectations stay explicit
 * booleans so a case can never leave its postcondition unstated.
 * @param {unknown} value candidate case spec
 * @param {string} label owning record used in diagnostics
 * @returns {ProcessCaseSpec}
 */
export function validateProcessCaseSpec(value, label) {
  assertExactFields(value, [...PROCESS_CASE_SPEC_FIELDS], label, 'process.caseSpec')
  const record = /** @type {Record<string, unknown>} */ (value)
  assertNonEmptyString(record.name, 'name', 'process.caseSpec.name')
  if (!PROCESS_CASE_IDS.includes(/** @type {string} */ (record.name))) {
    throw new Error(
      `${label}: unknown process case ${JSON.stringify(record.name)} for field "name" at path process.caseSpec.name; ` +
      `repair: use one of ${PROCESS_CASE_IDS.join(', ')} for "name".`,
    )
  }
  if (!PROCESS_SCENARIOS.includes(/** @type {string} */ (record.scenario))) {
    throw new Error(
      `${label}: unknown process scenario ${JSON.stringify(record.scenario)} for field "scenario" at path process.caseSpec.scenario; ` +
      `repair: use one of ${PROCESS_SCENARIOS.join(', ')} for "scenario".`,
    )
  }
  const limits = validateProcessLimits(record.limits, label)
  if (!PROCESS_OUTCOMES.includes(/** @type {string} */ (record.outcome))) {
    throw new Error(
      `${label}: unknown process outcome ${JSON.stringify(record.outcome)} for field "outcome" at path process.caseSpec.outcome; ` +
      `repair: use one of ${PROCESS_OUTCOMES.join(', ')} for "outcome".`,
    )
  }
  for (const field of ['expectReady', 'deadlineExceeded']) {
    if (typeof record[field] !== 'boolean') {
      throw new Error(
        `${label}: invalid flag ${JSON.stringify(record[field])} for field "${field}" at path process.caseSpec.${field}; ` +
        `repair: use true or false for "${field}".`,
      )
    }
  }
  return /** @type {ProcessCaseSpec} */ (freezeRecord({
    name: record.name,
    scenario: record.scenario,
    limits,
    outcome: record.outcome,
    expectReady: record.expectReady,
    deadlineExceeded: record.deadlineExceeded,
  }))
}

/**
 * Validate one case entry inside a durable receipt and return a frozen copy.
 * @param {unknown} value candidate case entry
 * @param {string} label owning record used in diagnostics
 * @returns {ProcessCaseReceipt} the frozen case entry
 */
export function validateProcessCaseReceipt(value, label) {
  assertExactFields(value, [...PROCESS_CASE_RECEIPT_FIELDS], label, 'process.case')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (!PROCESS_CASE_IDS.includes(/** @type {string} */ (record.caseId))) {
    throw new Error(
      `${label}: unknown process case ${JSON.stringify(record.caseId)} for field "caseId" at path process.case.caseId; ` +
      `repair: use one of ${PROCESS_CASE_IDS.join(', ')} for "caseId".`,
    )
  }
  if (!PROCESS_SCENARIOS.includes(/** @type {string} */ (record.scenario))) {
    throw new Error(
      `${label}: unknown process scenario ${JSON.stringify(record.scenario)} for field "scenario" at path process.case.scenario; ` +
      `repair: use one of ${PROCESS_SCENARIOS.join(', ')} for "scenario".`,
    )
  }
  if (!PROCESS_OUTCOMES.includes(/** @type {string} */ (record.outcome))) {
    throw new Error(
      `${label}: unknown process outcome ${JSON.stringify(record.outcome)} for field "outcome" at path process.case.outcome; ` +
      `repair: use one of ${PROCESS_OUTCOMES.join(', ')} for "outcome".`,
    )
  }
  if (!BRIDGE_SIGNALS.includes(/** @type {string} */ (record.signal))) {
    throw new Error(
      `${label}: unknown process signal ${JSON.stringify(record.signal)} for field "signal" at path process.case.signal; ` +
      `repair: use one of ${BRIDGE_SIGNALS.join(', ')} for "signal".`,
    )
  }
  for (const field of ['reaped', 'portReleased', 'deadlineExceeded']) {
    if (typeof record[field] !== 'boolean') {
      throw new Error(
        `${label}: invalid flag ${JSON.stringify(record[field])} for field "${field}" at path process.case.${field}; ` +
        `repair: use true or false for "${field}".`,
      )
    }
  }
  assertIntegerInRange(record.pid, 'pid', 'process.case.pid', { min: 0, max: MAX_SAFE })
  assertIntegerInRange(record.port, 'port', 'process.case.port', { min: MIN_PORT, max: MAX_PORT })
  assertNonEmptyString(record.processGroup, 'processGroup', 'process.case.processGroup')
  assertIntegerInRange(record.observedAtMs, 'observedAtMs', 'process.case.observedAtMs', { min: 0, max: MAX_SAFE })
  return /** @type {ProcessCaseReceipt} */ (freezeRecord({
    caseId: record.caseId,
    scenario: record.scenario,
    outcome: record.outcome,
    signal: record.signal,
    reaped: record.reaped,
    portReleased: record.portReleased,
    pid: record.pid,
    port: record.port,
    processGroup: record.processGroup,
    deadlineExceeded: record.deadlineExceeded,
    observedAtMs: record.observedAtMs,
  }))
}

/**
 * Validate a durable cleanup receipt and return a frozen copy. The case set
 * must be exactly the four named cases with no duplicate, missing, or extra
 * entry, so a receipt written before every case was observed fails closed and a
 * supervisor killed mid-run cannot be credited with cleanup it did not observe.
 * @param {unknown} value candidate receipt
 * @param {string} label owning record used in diagnostics
 * @returns {object} the frozen receipt
 */
export function validateProcessCleanupReceipt(value, label) {
  assertExactFields(value, [...PROCESS_RECEIPT_FIELDS], label, 'process.receipt')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (record.version !== PROCESS_RECEIPT_VERSION) {
    throw new Error(
      `${label}: unsupported receipt version ${JSON.stringify(record.version)} for field "version" at path process.receipt.version; ` +
      `repair: write receipt version ${PROCESS_RECEIPT_VERSION}.`,
    )
  }
  assertNonEmptyString(record.runId, 'runId', 'process.receipt.runId')
  if (!ID_PATTERN.test(/** @type {string} */ (record.runId))) {
    throw new Error(
      `${label}: invalid run id ${JSON.stringify(record.runId)} for field "runId" at path process.receipt.runId; ` +
      'repair: use the lowercase run id the run envelope carries.',
    )
  }
  assertNonEmptyString(record.project, 'project', 'process.receipt.project')
  if (record.purpose !== PROCESS_INVOCATION_PURPOSE) {
    throw new Error(
      `${label}: invalid receipt purpose ${JSON.stringify(record.purpose)} for field "purpose" at path process.receipt.purpose; ` +
      `repair: use ${JSON.stringify(PROCESS_INVOCATION_PURPOSE)} for "purpose".`,
    )
  }
  assertNonEmptyString(record.invocationId, 'invocationId', 'process.receipt.invocationId')
  if (!ID_PATTERN.test(/** @type {string} */ (record.invocationId))) {
    throw new Error(
      `${label}: invalid invocation id ${JSON.stringify(record.invocationId)} for field "invocationId" at path process.receipt.invocationId; ` +
      'repair: use a lowercase process invocation id up to 64 characters.',
    )
  }
  if (!Array.isArray(record.cases)) {
    throw new Error(
      `${label}: expected the four observed cases for field "cases" at path process.receipt.cases; ` +
      `repair: record exactly ${JSON.stringify([...PROCESS_CASE_IDS])} in "cases".`,
    )
  }
  const cases = record.cases.map((entry, index) => validateProcessCaseReceipt(entry, `${label} cases[${index}]`))
  const ids = cases.map((entry) => entry.caseId)
  const missing = PROCESS_CASE_IDS.filter((id) => !ids.includes(id))
  const extra = ids.filter((id) => !PROCESS_CASE_IDS.includes(id))
  if (missing.length > 0 || extra.length > 0 || new Set(ids).size !== ids.length) {
    throw new Error(
      `${label}: incomplete process receipt case set for field "cases" at path process.receipt.cases; ` +
      `expected exactly ${JSON.stringify([...PROCESS_CASE_IDS])} observed ${JSON.stringify(ids)} ` +
      `missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}; ` +
      'repair: run all four supervised cases to completion and observe each cleanup before writing the durable receipt.',
    )
  }
  assertIntegerInRange(record.observedAtMs, 'observedAtMs', 'process.receipt.observedAtMs', { min: 0, max: MAX_SAFE })
  return freezeRecord({
    version: PROCESS_RECEIPT_VERSION,
    runId: record.runId,
    project: record.project,
    purpose: PROCESS_INVOCATION_PURPOSE,
    invocationId: record.invocationId,
    cases,
    observedAtMs: record.observedAtMs,
  })
}

/**
 * Create a frozen durable cleanup receipt from an explicit input.
 * @param {object} input receipt fields
 * @returns {object} the frozen receipt
 */
export function createProcessCleanupReceipt(input) {
  return validateProcessCleanupReceipt(input, 'process receipt')
}

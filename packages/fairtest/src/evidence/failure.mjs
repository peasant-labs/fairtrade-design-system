// Typed evidence failures. A failure names one closed code, the value path it
// was raised at, the expected and observed values, and an actionable repair
// hint. The code vocabulary is declared once here so a verifier report, a
// fixture case, and a negative mutation all speak the same closed set. No
// runner, service, route, selector, port, or product threshold is named here.

import { assertExactFields, assertNonEmptyString, freezeRecord } from '../core/values.mjs'

/**
 * Closed evidence failure-code vocabulary. Every rejection the neutral
 * verifier can raise is one of these names, so a report can be read and a
 * fixture case can assert the exact code without a second string table.
 * @type {string[]}
 */
export const EVIDENCE_FAILURE_CODES = freezeRecord([
  'run-identity-mismatch',
  'unsupported-mode',
  'missing-row',
  'unexpected-row',
  'kind-mismatch',
  'theme-mismatch',
  'missing-artifact',
  'unexpected-artifact',
  'digest-mismatch',
  'stale-record',
  'output-cap',
  'missing-provenance',
  'cross-root',
  'unproven',
  'duplicate-same-key',
  'duplicate-cross-row',
  'duplicate-cross-theme',
])

/**
 * @typedef {object} EvidenceFailureInput
 * @property {string} code one of EVIDENCE_FAILURE_CODES
 * @property {string} path value path the failure was raised at
 * @property {unknown} expected expected value or name
 * @property {unknown} observed observed value
 * @property {string} repair actionable repair hint
 */

/**
 * @typedef {object} EvidenceFailure
 * @property {string} code
 * @property {string} path
 * @property {unknown} expected
 * @property {unknown} observed
 * @property {string} repair
 */

/**
 * Create a frozen typed failure. The code must be declared and the path and
 * repair must be non-empty so a report never carries an unreadable entry.
 * @param {EvidenceFailureInput} input
 * @returns {EvidenceFailure}
 */
export function createEvidenceFailure(input) {
  assertExactFields(input, ['code', 'path', 'expected', 'observed', 'repair'], 'failure', 'failure')
  if (!EVIDENCE_FAILURE_CODES.includes(/** @type {string} */ (input.code))) {
    throw new Error(
      `failure: unknown code ${JSON.stringify(input.code)} for field "code" at path failure.code; ` +
      `repair: use one of ${EVIDENCE_FAILURE_CODES.join(', ')} for "code".`,
    )
  }
  assertNonEmptyString(input.path, 'path', 'failure.path')
  assertNonEmptyString(input.repair, 'repair', 'failure.repair')
  return freezeRecord({
    code: input.code,
    path: input.path,
    expected: input.expected,
    observed: input.observed,
    repair: input.repair,
  })
}

/**
 * Validate an unknown value as a typed failure and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {EvidenceFailure}
 */
export function validateEvidenceFailure(value, label) {
  assertExactFields(value, ['code', 'path', 'expected', 'observed', 'repair'], label, 'failure')
  return createEvidenceFailure(/** @type {EvidenceFailureInput} */ (value))
}

/**
 * Return the sorted unique failure codes present in a failure list.
 * @param {EvidenceFailure[]} failures
 * @returns {string[]}
 */
export function uniqueFailureCodes(failures) {
  if (!Array.isArray(failures)) {
    throw new Error('failure: invalid failure list at path failures; repair: provide the typed failure list for "failures".')
  }
  return Object.freeze([...new Set(failures.map((entry) => /** @type {EvidenceFailure} */ (entry).code))].sort())
}

// Neutral evidence verdict and report. A report carries the run id, the mode,
// the typed failures, the sorted unique failure codes, the per-row duplicate
// outcomes, and a `complete` flag that is true only when the failure list is
// empty. `verdict` is the readable form of `complete`, so a reader that only
// looks at one field still cannot read a partial run as green. No runner,
// route, selector, port, or product threshold is named here.

import { assertExactFields, freezeRecord, isPlainRecord } from '../core/values.mjs'
import { uniqueFailureCodes } from './failure.mjs'

/**
 * @typedef {object} EvidenceRowOutcome
 * @property {string} key caller-owned row key
 * @property {string} kind product or component
 * @property {string} theme dark or light
 * @property {number} artifactCount number of artifact observations the row carries
 * @property {number} bytes total artifact byte count for the row
 * @property {{ sameKey: boolean, crossRow: boolean, crossTheme: boolean }} duplicate per-row duplicate outcome
 */

/**
 * @typedef {object} EvidenceReportInput
 * @property {number} policyVersion policy schema version the run was checked against
 * @property {string} runId run identity id the report covers
 * @property {string} mode evidence mode the report covers
 * @property {import('./failure.mjs').EvidenceFailure[]} failures typed failures in check order
 * @property {EvidenceRowOutcome[]} rows per-row outcomes
 * @property {string[]} artifactClasses artifact classes the policy declared
 */

/**
 * Create a frozen evidence report. `complete` is derived from the failure
 * list, never passed in, so a report can never claim a green verdict beside a
 * non-empty failure list.
 * @param {EvidenceReportInput} input
 * @returns {object} the frozen report
 */
export function createEvidenceReport(input) {
  assertExactFields(
    input,
    ['policyVersion', 'runId', 'mode', 'failures', 'rows', 'artifactClasses'],
    'report',
    'report',
  )
  const record = /** @type {Record<string, unknown>} */ (input)
  if (!Array.isArray(record.failures)) {
    throw new Error('report: invalid failure list at path report.failures; repair: provide the typed failure list for "failures".')
  }
  if (!Array.isArray(record.rows)) {
    throw new Error('report: invalid row outcome list at path report.rows; repair: provide the per-row outcome list for "rows".')
  }
  const failures = /** @type {import('./failure.mjs').EvidenceFailure[]} */ (record.failures)
  const complete = failures.length === 0
  return freezeRecord({
    policyVersion: record.policyVersion,
    runId: record.runId,
    mode: record.mode,
    complete,
    verdict: complete ? 'pass' : 'fail',
    failureCodes: [...uniqueFailureCodes(failures)],
    failures: failures.map((entry) => ({ ...entry })),
    rows: record.rows.map((entry) => ({ .../** @type {EvidenceRowOutcome} */ (entry), duplicate: { .../** @type {EvidenceRowOutcome} */ (entry).duplicate } })),
    artifactClasses: [.../** @type {string[]} */ (record.artifactClasses)],
  })
}

/**
 * Validate an unknown value as an evidence report and return it unchanged.
 * The report is the durable verifier output, so this reader refuses a report
 * whose `complete` flag contradicts its failure list.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {object}
 */
export function validateEvidenceReport(value, label) {
  assertExactFields(
    value,
    ['policyVersion', 'runId', 'mode', 'complete', 'verdict', 'failureCodes', 'failures', 'rows', 'artifactClasses'],
    label,
    'report',
  )
  if (!isPlainRecord(value)) {
    throw new Error(`${label}: expected a report record at path report; repair: restore the evidence report in ${label}.`)
  }
  const record = /** @type {Record<string, unknown>} */ (value)
  const failures = /** @type {unknown[]} */ (record.failures)
  const expectedComplete = failures.length === 0
  if (record.complete !== expectedComplete || record.verdict !== (expectedComplete ? 'pass' : 'fail')) {
    throw new Error(
      `${label}: report verdict contradicts its failure list at path report.complete; ` +
      `complete ${JSON.stringify(record.complete)} verdict ${JSON.stringify(record.verdict)} with ${failures.length} failures; ` +
      'repair: derive complete and verdict from the failure list.',
    )
  }
  return value
}

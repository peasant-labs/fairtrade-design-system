// Generic caller-owned evidence policy. The caller supplies the expected run
// id, the closed mode, the artifact class set, the required row inventory with
// each row's kind, theme, and built-tree root, the duplicate scopes to check,
// and the freshness and output ceilings. No default id, class, scope, or
// threshold lives here, so two callers can hold different expectations over
// the same run. No runner, route, selector, port, or product threshold is
// named here.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord } from '../core/values.mjs'
import { THEME_NAMES, assertHostKind } from '../host-contract/kinds.mjs'
import { EVIDENCE_MODES } from './record.mjs'

/**
 * Evidence policy schema version.
 * @type {number}
 */
export const EVIDENCE_POLICY_VERSION = 1

/**
 * Closed duplicate-scope vocabulary. Same-key compares whole rows by their
 * caller-owned row key; cross-row compares artifact digests across rows of
 * different kinds; cross-theme compares artifact digests across rows of the
 * same kind whose themes differ.
 * @type {string[]}
 */
export const DUPLICATE_SCOPES = freezeRecord(['same-key', 'cross-row', 'cross-theme'])

const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const MAX_SAFE = 9007199254740991

/**
 * @typedef {object} RequiredRow
 * @property {string} key caller-owned row key
 * @property {string} kind product or component
 * @property {string} theme dark or light
 * @property {string} root built tree the row's provenance must name
 */

/**
 * @typedef {object} EvidencePolicyInput
 * @property {number} version policy schema version, currently 1
 * @property {string} runId expected run identity id
 * @property {string} mode expected evidence mode, single-capture
 * @property {string[]} artifactClasses closed artifact class set every row must carry
 * @property {RequiredRow[]} requiredRows expected mounted rows
 * @property {string[]} duplicateScopes duplicate scopes to check
 * @property {number} maxAgeMs largest accepted row age in milliseconds
 * @property {number} maxOutputBytes largest accepted total artifact byte count
 */

/**
 * Validate one required-row declaration.
 * @param {unknown} value
 * @param {number} index index used in diagnostics
 * @returns {RequiredRow}
 */
function validateRequiredRow(value, index) {
  const path = `policy.requiredRows[${index}]`
  assertExactFields(value, ['key', 'kind', 'theme', 'root'], 'requiredRow', path)
  const row = /** @type {Record<string, unknown>} */ (value)
  assertNonEmptyString(row.key, 'key', `${path}.key`)
  if (!KEY_PATTERN.test(/** @type {string} */ (row.key))) {
    throw new Error(
      `invalid value ${JSON.stringify(row.key)} for field "key" at path ${path}.key; ` +
      'repair: use a lowercase row key up to 64 characters for "key".',
    )
  }
  assertHostKind(row.kind, `${path}.kind`)
  if (!THEME_NAMES.includes(/** @type {string} */ (row.theme))) {
    throw new Error(
      `invalid value ${JSON.stringify(row.theme)} for field "theme" at path ${path}.theme; ` +
      `repair: use one of ${THEME_NAMES.join(', ')} for "theme".`,
    )
  }
  assertNonEmptyString(row.root, 'root', `${path}.root`)
  return freezeRecord({ key: row.key, kind: row.kind, theme: row.theme, root: row.root })
}

/**
 * Validate a caller-supplied evidence policy and return it frozen. Every
 * id, class, scope, and threshold is required and caller-owned.
 * @param {EvidencePolicyInput} input
 * @returns {EvidencePolicyInput}
 */
export function createEvidencePolicy(input) {
  assertExactFields(
    input,
    ['version', 'runId', 'mode', 'artifactClasses', 'requiredRows', 'duplicateScopes', 'maxAgeMs', 'maxOutputBytes'],
    'policy',
    'policy',
  )
  const record = /** @type {Record<string, unknown>} */ (input)
  assertIntegerInRange(record.version, 'version', 'policy.version', { min: EVIDENCE_POLICY_VERSION, max: EVIDENCE_POLICY_VERSION })
  assertNonEmptyString(record.runId, 'runId', 'policy.runId')
  if (!KEY_PATTERN.test(/** @type {string} */ (record.runId))) {
    throw new Error(
      `invalid value ${JSON.stringify(record.runId)} for field "runId" at path policy.runId; ` +
      'repair: use a lowercase run id up to 64 characters for "runId".',
    )
  }
  if (!EVIDENCE_MODES.includes(/** @type {string} */ (record.mode))) {
    throw new Error(
      `invalid value ${JSON.stringify(record.mode)} for field "mode" at path policy.mode; ` +
      `repair: use one of ${EVIDENCE_MODES.join(', ')} for "mode".`,
    )
  }
  if (!Array.isArray(record.artifactClasses) || record.artifactClasses.length === 0) {
    throw new Error(
      `invalid value ${JSON.stringify(record.artifactClasses)} for field "artifactClasses" at path policy.artifactClasses; ` +
      'repair: list the non-empty artifact class set for "artifactClasses".',
    )
  }
  const classes = new Set()
  for (const [index, name] of (/** @type {unknown[]} */ (record.artifactClasses)).entries()) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error(
        `invalid value ${JSON.stringify(name)} for field "artifactClasses" at path policy.artifactClasses[${index}]; ` +
        'repair: use a non-empty artifact class name for "artifactClasses".',
      )
    }
    if (classes.has(name)) {
      throw new Error(
        `policy: duplicate artifact class ${JSON.stringify(name)} at path policy.artifactClasses[${index}]; ` +
        'repair: list every artifact class once for "artifactClasses".',
      )
    }
    classes.add(name)
  }
  if (!Array.isArray(record.requiredRows) || record.requiredRows.length === 0) {
    throw new Error(
      `invalid value ${JSON.stringify(record.requiredRows)} for field "requiredRows" at path policy.requiredRows; ` +
      'repair: list the non-empty required row inventory for "requiredRows".',
    )
  }
  const rows = (/** @type {unknown[]} */ (record.requiredRows)).map((entry, index) => validateRequiredRow(entry, index))
  const keys = new Set()
  for (const [index, row] of rows.entries()) {
    if (keys.has(row.key)) {
      throw new Error(
        `policy: duplicate required row ${JSON.stringify(row.key)} at path policy.requiredRows[${index}].key; ` +
        'repair: list every required row once for "requiredRows".',
      )
    }
    keys.add(row.key)
  }
  if (!Array.isArray(record.duplicateScopes)) {
    throw new Error(
      `invalid value ${JSON.stringify(record.duplicateScopes)} for field "duplicateScopes" at path policy.duplicateScopes; ` +
      'repair: list duplicate scopes for "duplicateScopes".',
    )
  }
  const scopes = new Set()
  for (const [index, scope] of (/** @type {unknown[]} */ (record.duplicateScopes)).entries()) {
    if (!DUPLICATE_SCOPES.includes(/** @type {string} */ (scope))) {
      throw new Error(
        `invalid value ${JSON.stringify(scope)} for field "duplicateScopes" at path policy.duplicateScopes[${index}]; ` +
        `repair: use one of ${DUPLICATE_SCOPES.join(', ')} for "duplicateScopes".`,
      )
    }
    if (scopes.has(scope)) {
      throw new Error(
        `policy: duplicate scope ${JSON.stringify(scope)} at path policy.duplicateScopes[${index}]; ` +
        'repair: list every duplicate scope once for "duplicateScopes".',
      )
    }
    scopes.add(scope)
  }
  assertIntegerInRange(record.maxAgeMs, 'maxAgeMs', 'policy.maxAgeMs', { min: 0, max: MAX_SAFE })
  assertIntegerInRange(record.maxOutputBytes, 'maxOutputBytes', 'policy.maxOutputBytes', { min: 0, max: MAX_SAFE })
  return freezeRecord({
    version: EVIDENCE_POLICY_VERSION,
    runId: record.runId,
    mode: record.mode,
    artifactClasses: [...classes],
    requiredRows: rows,
    duplicateScopes: [...scopes],
    maxAgeMs: record.maxAgeMs,
    maxOutputBytes: record.maxOutputBytes,
  })
}

/**
 * Validate an unknown value as an evidence policy and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {EvidencePolicyInput}
 */
export function validateEvidencePolicy(value, label) {
  assertExactFields(
    value,
    ['version', 'runId', 'mode', 'artifactClasses', 'requiredRows', 'duplicateScopes', 'maxAgeMs', 'maxOutputBytes'],
    label,
    'policy',
  )
  return createEvidencePolicy(/** @type {EvidencePolicyInput} */ (value))
}

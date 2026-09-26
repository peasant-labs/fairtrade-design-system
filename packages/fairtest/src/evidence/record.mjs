// Neutral evidence run model: a run identity, one single-capture mode, and the
// mounted rows a verifier reads. A row binds one caller-owned row key to the
// shared host kind, the shared rendered theme name, the shared identity and
// theme-observation shapes, one resolution proof, one provenance reference,
// and the artifact observations the run root carries. This module reuses the
// shared kind, identity, theme, and resolution types instead of inventing a
// second shape. It executes no page code and names no runner, route, selector,
// port, or product threshold.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord } from '../core/values.mjs'
import { validateIdentity } from '../core/identity.mjs'
import { THEME_NAMES, assertHostKind, validateThemeObservation } from '../host-contract/kinds.mjs'
import { validateTargetIdentity } from '../host-contract/targets.mjs'
import { validateResolution } from '../host-contract/resolution.mjs'
import { artifactByteLength, assertArtifactDigest } from './digest.mjs'

/**
 * Closed evidence modes. The MVP is single capture only: a side-by-side,
 * reference, or baseline record belongs to no supported mode and is refused.
 * @type {string[]}
 */
export const EVIDENCE_MODES = freezeRecord(['single-capture'])

const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const MAX_SAFE = 9007199254740991

/**
 * @typedef {object} ArtifactObservationInput
 * @property {string} name caller-owned artifact class name
 * @property {string | Uint8Array} content observed artifact bytes
 * @property {string} digest recorded lowercase 64-character hex SHA-256 digest
 */

/**
 * @typedef {object} ArtifactObservation
 * @property {string} name
 * @property {string | Uint8Array} content
 * @property {string} digest
 */

/**
 * @typedef {object} EvidenceProvenance
 * @property {string} root built tree the evidence was read from
 * @property {string} servedFrom tree label the recorded digests were compared against
 */

/**
 * @typedef {object} EvidenceRowInput
 * @property {string} key caller-owned row key
 * @property {string} kind product or component
 * @property {string} theme dark or light
 * @property {import('../core/identity.mjs').Identity} identity identity on the matching kind branch
 * @property {import('../host-contract/resolution.mjs').ProductResolution | import('../host-contract/resolution.mjs').ComponentResolution | null} proof resolution proof, or null when unproven
 * @property {import('../host-contract/kinds.mjs').ThemeObservation} themeObservation normalized theme observation
 * @property {EvidenceProvenance | null} provenance provenance reference, or null when absent
 * @property {ArtifactObservation[]} artifacts observed artifact classes
 * @property {number} observedAtMs row observation time in whole milliseconds
 */

/**
 * @typedef {object} EvidenceRunInput
 * @property {import('../core/identity.mjs').Identity} identity run identity
 * @property {string} mode caller-declared evidence mode
 * @property {EvidenceRowInput[]} rows mounted rows in the run
 */

/**
 * Assert a caller-owned row key shape.
 * @param {unknown} value
 * @param {string} path value path used in diagnostics
 * @returns {asserts value is string}
 */
function assertRowKey(value, path) {
  assertNonEmptyString(value, 'key', path)
  if (!KEY_PATTERN.test(/** @type {string} */ (value))) {
    throw new Error(
      `invalid value ${JSON.stringify(value)} for field "key" at path ${path}; ` +
      'repair: use a lowercase row key up to 64 characters for "key".',
    )
  }
}

/**
 * Create a frozen artifact observation. The recorded digest is validated as a
 * SHA-256 shape here; whether it matches the content is the verifier's check.
 * @param {ArtifactObservationInput} input
 * @returns {ArtifactObservation}
 */
export function createArtifactObservation(input) {
  assertExactFields(input, ['name', 'content', 'digest'], 'artifact', 'artifact')
  assertNonEmptyString(input.name, 'name', 'artifact.name')
  if (typeof input.content !== 'string' && !(input.content instanceof Uint8Array)) {
    throw new Error(
      `invalid value ${JSON.stringify(typeof input.content)} for field "content" at path artifact.content; ` +
      'repair: provide a string or Uint8Array for "content".',
    )
  }
  assertArtifactDigest(input.digest, 'artifact.digest')
  return freezeRecord({ name: input.name, content: input.content, digest: input.digest })
}

/**
 * Validate an unknown value as an artifact observation and return a frozen copy.
 * @param {unknown} value
 * @param {string} path value path used in diagnostics
 * @returns {ArtifactObservation}
 */
export function validateArtifactObservation(value, path) {
  assertExactFields(value, ['name', 'content', 'digest'], 'artifact', path)
  return createArtifactObservation(/** @type {ArtifactObservationInput} */ (value))
}

/**
 * Validate provenance as a root plus the tree label it was compared against.
 * @param {unknown} value
 * @param {string} path value path used in diagnostics
 * @returns {EvidenceProvenance}
 */
export function validateEvidenceProvenance(value, path) {
  assertExactFields(value, ['root', 'servedFrom'], 'provenance', path)
  const record = /** @type {Record<string, unknown>} */ (value)
  assertNonEmptyString(record.root, 'root', `${path}.root`)
  assertNonEmptyString(record.servedFrom, 'servedFrom', `${path}.servedFrom`)
  return freezeRecord({ root: record.root, servedFrom: record.servedFrom })
}

/**
 * Create a frozen evidence row. The identity is validated on the row kind
 * branch, the theme observation and the proof are validated through the shared
 * host contract, and the artifacts are validated as an observation list. This
 * factory deliberately does NOT enforce that the proof matches the row or that
 * the artifacts cover a policy set: those are the verifier's decisions, so a
 * tampered run can be rejected with a typed failure instead of throwing.
 * @param {EvidenceRowInput} input
 * @returns {EvidenceRowInput}
 */
export function createEvidenceRow(input) {
  assertExactFields(
    input,
    ['key', 'kind', 'theme', 'identity', 'proof', 'themeObservation', 'provenance', 'artifacts', 'observedAtMs'],
    'row',
    'row',
  )
  const record = /** @type {Record<string, unknown>} */ (input)
  assertRowKey(record.key, 'row.key')
  assertHostKind(record.kind, 'row.kind')
  if (!THEME_NAMES.includes(/** @type {string} */ (record.theme))) {
    throw new Error(
      `invalid value ${JSON.stringify(record.theme)} for field "theme" at path row.theme; ` +
      `repair: use one of ${THEME_NAMES.join(', ')} for "theme".`,
    )
  }
  const identity = validateTargetIdentity(record.identity, /** @type {string} */ (record.kind), 'row')
  const themeObservation = validateThemeObservation(record.themeObservation, 'row')
  const proof = record.proof === null ? null : validateResolution(record.proof, 'row.proof')
  const provenance = record.provenance === null ? null : validateEvidenceProvenance(record.provenance, 'row.provenance')
  if (!Array.isArray(record.artifacts)) {
    throw new Error(
      `invalid value ${JSON.stringify(record.artifacts)} for field "artifacts" at path row.artifacts; ` +
      'repair: provide the observed artifact list for "artifacts".',
    )
  }
  const artifacts = record.artifacts.map((entry, index) => validateArtifactObservation(entry, `row.artifacts[${index}]`))
  const names = new Set()
  for (const [index, artifact] of artifacts.entries()) {
    if (names.has(artifact.name)) {
      throw new Error(
        `row: duplicate artifact ${JSON.stringify(artifact.name)} at path row.artifacts[${index}].name; ` +
        'repair: list every artifact class once for the row.',
      )
    }
    names.add(artifact.name)
  }
  assertIntegerInRange(record.observedAtMs, 'observedAtMs', 'row.observedAtMs', { min: 0, max: MAX_SAFE })
  return freezeRecord({
    key: record.key,
    kind: record.kind,
    theme: record.theme,
    identity,
    proof,
    themeObservation,
    provenance,
    artifacts,
    observedAtMs: record.observedAtMs,
  })
}

/**
 * Validate an unknown value as an evidence row and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {EvidenceRowInput}
 */
export function validateEvidenceRow(value, label) {
  assertExactFields(
    value,
    ['key', 'kind', 'theme', 'identity', 'proof', 'themeObservation', 'provenance', 'artifacts', 'observedAtMs'],
    label,
    'row',
  )
  return createEvidenceRow(/** @type {EvidenceRowInput} */ (value))
}

/**
 * Create a frozen evidence run. The mode is a caller-declared string so an
 * unsupported mode reaches the verifier and is rejected with a typed failure
 * instead of a constructor throw. Extra top-level fields are refused, which is
 * how a side-by-side reference or baseline record is kept out of the MVP.
 * @param {EvidenceRunInput} input
 * @returns {{ identity: import('../core/identity.mjs').Identity, mode: string, rows: EvidenceRowInput[] }}
 */
export function createEvidenceRun(input) {
  assertExactFields(input, ['identity', 'mode', 'rows'], 'run', 'run')
  const record = /** @type {Record<string, unknown>} */ (input)
  const identity = validateIdentity(record.identity, 'run.identity')
  assertNonEmptyString(record.mode, 'mode', 'run.mode')
  if (!Array.isArray(record.rows)) {
    throw new Error(
      `invalid value ${JSON.stringify(record.rows)} for field "rows" at path run.rows; ` +
      'repair: provide the mounted evidence rows for "rows".',
    )
  }
  const rows = record.rows.map((entry, index) => validateEvidenceRow(entry, `run.rows[${index}]`))
  return freezeRecord({ identity, mode: record.mode, rows })
}

/**
 * Validate an unknown value as an evidence run and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {{ identity: import('../core/identity.mjs').Identity, mode: string, rows: EvidenceRowInput[] }}
 */
export function validateEvidenceRun(value, label) {
  assertExactFields(value, ['identity', 'mode', 'rows'], label, 'run')
  return createEvidenceRun(/** @type {EvidenceRunInput} */ (value))
}

/**
 * Byte total of one row's artifact observations.
 * @param {EvidenceRowInput} row evidence row
 * @returns {number}
 */
export function rowByteTotal(row) {
  return row.artifacts.reduce((total, artifact) => total + artifactByteLength(artifact.content), 0)
}

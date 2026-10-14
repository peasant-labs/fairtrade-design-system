// @ts-check

// Capture records and build descriptors into one neutral evidence run.
//
// One single-capture run per served build. Every row is one surface, width, and
// theme; its key, host kind, theme, identity, mounted-root proof, and provenance
// come from the certified capture record, and its artifacts are the three
// capture artifact classes the caller wrote. The proof is a component-branch
// mounted-root proof, the only proof a capture pass honestly observes: a
// product-branch proof needs the adapter lifecycle's chrome, body, route,
// section, and view observations, so a product-kind record is refused here
// rather than given a proof the capture pass never saw.
//
// This module composes the shared neutral evidence factories; it executes no
// page code and names no runner, document object, or scheme address.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord, isPlainRecord } from '../core/values.mjs'
import { createIdentity, validateIdentity } from '../core/identity.mjs'
import { validateThemeObservation } from '../host-contract/kinds.mjs'
import { artifactDigest } from '../evidence/digest.mjs'
import { createArtifactObservation, createEvidenceRow, createEvidenceRun } from '../evidence/record.mjs'
import { captureRowKey } from './cases.mjs'
import { reconcileCaptureRecord, validateCaptureRecord } from './record.mjs'

const MAX_SAFE = 9007199254740991

/**
 * The closed capture artifact class set every capture row writes: the canonical
 * record, the full-surface shot, and the served-build provenance. No silent
 * extras.
 * @type {readonly string[]}
 */
export const CAPTURE_ARTIFACT_CLASSES = freezeRecord(['capture.json', 'surface.png', 'provenance.json'])

/**
 * The one evidence mode a capture run declares.
 * @type {string}
 */
export const CAPTURE_RUN_MODE = 'single-capture'

/**
 * The provenance source label a capture row records.
 * @type {string}
 */
export const CAPTURE_PROVENANCE_SOURCE = 'capture-dist'

/**
 * @typedef {object} CaptureRunInput
 * @property {import('../core/identity.mjs').Identity} identity run identity
 * @property {string} state state id
 * @property {string} root built tree label every row provenance names
 * @property {string} themeSource caller-owned note naming where the theme came from
 * @property {unknown[]} records certified capture records for this state
 * @property {Record<string, Record<string, string | Uint8Array>>} artifacts row-key to artifact bytes, keyed by class
 * @property {string[]} shotFiles capture-root-relative shot files the producer wrote
 * @property {number} observedAtMs observation time in whole milliseconds
 */

/**
 * Build one single-capture evidence run from the certified capture records of
 * one state.
 * @param {CaptureRunInput} input capture run inputs
 * @returns {{ identity: import('../core/identity.mjs').Identity, mode: string, rows: import('../evidence/record.mjs').EvidenceRowInput[] }}
 */
export function buildCaptureRun(input) {
  assertExactFields(
    input,
    ['identity', 'state', 'root', 'themeSource', 'records', 'artifacts', 'shotFiles', 'observedAtMs'],
    'captureRun',
    'captureRun',
  )
  const record = /** @type {Record<string, unknown>} */ (input)
  const identity = validateIdentity(record.identity, 'captureRun.identity')
  const state = record.state
  assertNonEmptyString(state, 'state', 'captureRun.state')
  const root = record.root
  assertNonEmptyString(root, 'root', 'captureRun.root')
  const themeSource = record.themeSource
  assertNonEmptyString(themeSource, 'themeSource', 'captureRun.themeSource')
  const observedAtMs = record.observedAtMs
  assertIntegerInRange(observedAtMs, 'observedAtMs', 'captureRun.observedAtMs', { min: 0, max: MAX_SAFE })
  if (!Array.isArray(record.records) || record.records.length === 0) {
    throw new Error('captureRun: expected a non-empty record list at path captureRun.records; repair: build the run from at least one certified capture record.')
  }
  if (!Array.isArray(record.shotFiles)) {
    throw new Error('captureRun: invalid value for field "shotFiles" at path captureRun.shotFiles; repair: provide the shot-file inventory the producer wrote.')
  }
  if (!isPlainRecord(record.artifacts)) {
    throw new Error('captureRun: invalid value for field "artifacts" at path captureRun.artifacts; repair: provide the artifact bytes keyed by row key and class.')
  }
  const records = record.records.map((entry, index) => validateCaptureRecord(entry, `captureRun.records[${index}]`))
  const known = new Set(records.map((entry) => captureRowKey(entry.surface, entry.width, entry.theme)))
  for (const key of Object.keys(record.artifacts)) {
    if (!known.has(key)) {
      throw new Error(`captureRun: unexpected artifact row ${JSON.stringify(key)} at path captureRun.artifacts; repair: provide artifact bytes for exactly the certified row keys.`)
    }
  }

  const rows = records.map((entry) => {
    const key = captureRowKey(entry.surface, entry.width, entry.theme)
    if (entry.state !== state) {
      throw new Error(
        `captureRun: record ${JSON.stringify(key)} belongs to state ${JSON.stringify(entry.state)} at path captureRun.records; ` +
        `expected ${JSON.stringify(state)}; repair: build one run per state from that state's records only.`,
      )
    }
    if (entry.kind !== 'component') {
      throw new Error(
        `captureRun: record ${JSON.stringify(key)} declares host kind ${JSON.stringify(entry.kind)} at path captureRun.records; ` +
        'repair: capture runs prove a component-branch mounted root; a product-branch row needs the adapter lifecycle proof from the mounted product producer.',
      )
    }
    reconcileCaptureRecord(entry, /** @type {string[]} */ (record.shotFiles), `captureRun.records.${key}`)
    const artifacts = /** @type {Record<string, Record<string, string | Uint8Array>>} */ (record.artifacts)[key]
    if (!artifacts) {
      throw new Error(`captureRun: missing artifact bytes for row ${JSON.stringify(key)} at path captureRun.artifacts; repair: provide the three capture artifact classes for every certified row.`)
    }
    const rowIdentity = createIdentity({ kind: entry.kind, id: key, createdAtMs: observedAtMs })
    const themeObservation = validateThemeObservation({
      expected: entry.theme,
      observed: entry.observedTheme,
      source: themeSource,
      observedAtMs,
    }, `captureRun.rows.${key}`)
    const proof = /** @type {import('../host-contract/resolution.mjs').ComponentResolution} */ ({
      kind: 'component',
      identity: rowIdentity,
      root: { mounted: true, observedAtMs },
      theme: themeObservation,
    })
    const observed = CAPTURE_ARTIFACT_CLASSES.map((name) => {
      const bytes = artifacts[name]
      if (bytes === undefined) {
        throw new Error(`captureRun: missing ${JSON.stringify(name)} for row ${JSON.stringify(key)} at path captureRun.artifacts; repair: write every capture artifact class before building the run.`)
      }
      return createArtifactObservation({ name, content: bytes, digest: artifactDigest(bytes) })
    })
    for (const name of Object.keys(artifacts)) {
      if (!/** @type {readonly string[]} */ (CAPTURE_ARTIFACT_CLASSES).includes(name)) {
        throw new Error(`captureRun: unexpected artifact class ${JSON.stringify(name)} for row ${JSON.stringify(key)} at path captureRun.artifacts; repair: write exactly ${CAPTURE_ARTIFACT_CLASSES.join(', ')}.`)
      }
    }
    return createEvidenceRow({
      key,
      kind: entry.kind,
      theme: entry.theme,
      identity: rowIdentity,
      proof,
      themeObservation,
      provenance: freezeRecord({ root, servedFrom: CAPTURE_PROVENANCE_SOURCE }),
      artifacts: observed,
      observedAtMs,
    })
  })

  return createEvidenceRun({ identity, mode: CAPTURE_RUN_MODE, rows })
}

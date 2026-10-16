// @ts-check

// App-owned Fairtrade capture evidence policy values.
//
// This is the one place the capture-run policy ids and thresholds live; the
// neutral child verifier receives them as caller-owned input and names none of
// them itself. The required row inventory is derived from the capture-case
// document through the child capture model, so the policy and the producer row
// keys cannot drift. Plain data plus pure functions only: nothing here serves a
// tree, reads host state, or touches host globals.

import { importFairtestSource } from '../fairtest-source.mjs'

const capture = await importFairtestSource('src/capture/index.mjs')

/**
 * Largest accepted capture-row age for one run. A run root must be verified
 * close to the capture it describes; a previous run root reused later fails as
 * stale.
 * @type {number}
 */
export const CAPTURE_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * Largest accepted total artifact byte count across one capture run. A
 * full-surface shot per row dominates this budget; the ceiling stays well above
 * the capture case set's observed size so the cap fails only on a real runaway.
 * @type {number}
 */
export const CAPTURE_EVIDENCE_MAX_OUTPUT_BYTES = 512 * 1024 * 1024

/**
 * The duplicate scopes a capture run checks. Only same-key is meaningful: a
 * capture run holds one row per key, and cross-theme or cross-row byte equality
 * is expected between near-identical captures and is not a defect here.
 * @type {readonly string[]}
 */
export const CAPTURE_DUPLICATE_SCOPES = Object.freeze(['same-key'])

/**
 * The three capture artifact classes, read from the child model so the policy
 * and the producer share one declaration.
 * @type {readonly string[]}
 */
export const CAPTURE_EVIDENCE_ARTIFACT_CLASSES = Object.freeze([...capture.CAPTURE_ARTIFACT_CLASSES])

/**
 * Build the caller-owned evidence policy input for one capture run.
 * @param {object} input policy inputs
 * @param {string} input.runId expected run identity id
 * @param {unknown} input.cases capture-case document
 * @param {string} input.state state id the run covers
 * @param {string} input.root built tree label every row provenance names
 * @returns {{ version: number, runId: string, mode: string, artifactClasses: string[], requiredRows: { key: string, kind: string, theme: string, root: string }[], duplicateScopes: string[], maxAgeMs: number, maxOutputBytes: number }} the policy input for the neutral verifier
 */
export function capturePolicyInput({ runId, cases, state, root }) {
  const targets = capture.captureRowTargets(cases, state)
  return {
    version: 1,
    runId,
    mode: capture.CAPTURE_RUN_MODE,
    artifactClasses: [...CAPTURE_EVIDENCE_ARTIFACT_CLASSES],
    requiredRows: targets.map((/** @type {{ key: string, kind: string, theme: string }} */ target) => ({ key: target.key, kind: target.kind, theme: target.theme, root })),
    duplicateScopes: [...CAPTURE_DUPLICATE_SCOPES],
    maxAgeMs: CAPTURE_EVIDENCE_MAX_AGE_MS,
    maxOutputBytes: CAPTURE_EVIDENCE_MAX_OUTPUT_BYTES,
  }
}

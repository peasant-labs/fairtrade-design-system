// App-owned Fairtrade evidence policy values. This is the one place the
// Fairtrade-specific ids, roots, and thresholds live; the neutral child
// verifier receives them as caller-owned input and names none of them itself.
// Row keys match the producer row directories the mounted producers write.
// Plain data plus pure functions only: nothing here starts a service, reads
// host state, or touches host globals.

import { ARTIFACT_CLASSES } from './fairtest-artifacts.mjs'
import { PRODUCT_PROVENANCE_SOURCE } from './fairtrade-targets.mjs'
import { COMPONENT_PROVENANCE_SOURCE } from './fairtrade-component-target.mjs'

/**
 * Expected mounted row keys, one per producer theme row. The key is the
 * producer row directory name, so the verifier and the producer agree on the
 * run shape without a second mapping.
 * @type {string[]}
 */
export const FAIRTEST_EVIDENCE_ROW_KEYS = Object.freeze([
  'product-dark',
  'product-light',
  'component-dark',
  'component-light',
])

/**
 * Largest accepted row age for one run. A run root must be verified close to
 * the run it describes; a previous run root reused later fails as stale.
 * @type {number}
 */
export const FAIRTEST_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * Largest accepted total artifact byte count across one run.
 * @type {number}
 */
export const FAIRTEST_EVIDENCE_MAX_OUTPUT_BYTES = 64 * 1024 * 1024

/**
 * Build the caller-owned evidence policy input for one run. The run id is
 * supplied by the caller (the run envelope or the run environment) so the
 * verifier can refuse a run root that does not belong to the expected run.
 * @param {string} runId expected run identity id
 * @returns {object} the policy input for the neutral verifier
 */
export function fairtestEvidencePolicyInput(runId) {
  return {
    version: 1,
    runId,
    mode: 'single-capture',
    artifactClasses: [...ARTIFACT_CLASSES],
    requiredRows: [
      { key: 'product-dark', kind: 'product', theme: 'dark', root: PRODUCT_PROVENANCE_SOURCE.root },
      { key: 'product-light', kind: 'product', theme: 'light', root: PRODUCT_PROVENANCE_SOURCE.root },
      { key: 'component-dark', kind: 'component', theme: 'dark', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-light', kind: 'component', theme: 'light', root: COMPONENT_PROVENANCE_SOURCE.root },
    ],
    duplicateScopes: ['same-key', 'cross-row', 'cross-theme'],
    maxAgeMs: FAIRTEST_EVIDENCE_MAX_AGE_MS,
    maxOutputBytes: FAIRTEST_EVIDENCE_MAX_OUTPUT_BYTES,
  }
}

// @ts-check

// App-owned Fairtrade evidence policy values. This is the one place the
// Fairtrade-specific ids, roots, and thresholds live; the neutral child
// verifier receives them as caller-owned input and names none of them itself.
// Row keys match the producer row directories the mounted producers write.
// Plain data plus pure functions only: nothing here starts a service, reads
// host state, or touches host globals.

import { ARTIFACT_CLASSES } from './fairtest-artifacts.mjs'
import { PRODUCT_PROVENANCE_SOURCE, PRODUCT_ROUTES } from './fairtrade-targets.mjs'
import { COMPONENT_PROVENANCE_SOURCE, COMPONENT_STORIES } from './fairtrade-component-target.mjs'

/**
 * Expected mounted row keys, one per producer theme row: every product route
 * and every component story, each in both themes. The key is the producer row
 * directory name, so the verifier and the producer agree on the run shape
 * without a second mapping.
 * @type {readonly string[]}
 */
export const FAIRTEST_EVIDENCE_ROW_KEYS = Object.freeze([
  'product-dark',
  'product-light',
  'product-offline-dark',
  'product-offline-light',
  'component-dark',
  'component-light',
  'component-transcript-header-dark',
  'component-transcript-header-light',
  'component-offline-banner-dark',
  'component-offline-banner-light',
  'component-digest-split-dark',
  'component-digest-split-light',
  'component-stats-strip-dark',
  'component-stats-strip-light',
  'component-publish-bar-dark',
  'component-publish-bar-light',
  'component-access-list-dark',
  'component-access-list-light',
  'component-setting-groups-dark',
  'component-setting-groups-light',
  'component-publish-dialog-dark',
  'component-publish-dialog-light',
])

/**
 * The rows the mounted producers write, derived from the two target
 * registries: one row per product route and per component story, in each
 * theme, keyed by the directory the producer names. The declared row keys and
 * the policy's required rows are both held against this list by the run
 * envelope suite, so a registry entry without a declared row, or a declared
 * row no producer writes, fails there.
 * @returns {{ key: string, kind: string, theme: string, root: string }[]} the registry-derived rows, product rows first
 */
export function fairtestRegistryRows() {
  const themes = ['dark', 'light']
  return [
    ...PRODUCT_ROUTES.flatMap((route) => themes.map((theme) => ({ key: `${route.key}-${theme}`, kind: 'product', theme, root: PRODUCT_PROVENANCE_SOURCE.root }))),
    ...COMPONENT_STORIES.flatMap((story) => themes.map((theme) => ({ key: `${story.rowPrefix}-${theme}`, kind: 'component', theme, root: COMPONENT_PROVENANCE_SOURCE.root }))),
  ]
}

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
 * @returns {{ version: number, runId: string, mode: string, artifactClasses: string[], requiredRows: { key: string, kind: string, theme: string, root: string }[], duplicateScopes: string[], maxAgeMs: number, maxOutputBytes: number }} the policy input for the neutral verifier
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
      { key: 'product-offline-dark', kind: 'product', theme: 'dark', root: PRODUCT_PROVENANCE_SOURCE.root },
      { key: 'product-offline-light', kind: 'product', theme: 'light', root: PRODUCT_PROVENANCE_SOURCE.root },
      { key: 'component-dark', kind: 'component', theme: 'dark', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-light', kind: 'component', theme: 'light', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-transcript-header-dark', kind: 'component', theme: 'dark', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-transcript-header-light', kind: 'component', theme: 'light', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-offline-banner-dark', kind: 'component', theme: 'dark', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-offline-banner-light', kind: 'component', theme: 'light', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-digest-split-dark', kind: 'component', theme: 'dark', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-digest-split-light', kind: 'component', theme: 'light', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-stats-strip-dark', kind: 'component', theme: 'dark', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-stats-strip-light', kind: 'component', theme: 'light', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-publish-bar-dark', kind: 'component', theme: 'dark', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-publish-bar-light', kind: 'component', theme: 'light', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-access-list-dark', kind: 'component', theme: 'dark', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-access-list-light', kind: 'component', theme: 'light', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-setting-groups-dark', kind: 'component', theme: 'dark', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-setting-groups-light', kind: 'component', theme: 'light', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-publish-dialog-dark', kind: 'component', theme: 'dark', root: COMPONENT_PROVENANCE_SOURCE.root },
      { key: 'component-publish-dialog-light', kind: 'component', theme: 'light', root: COMPONENT_PROVENANCE_SOURCE.root },
    ],
    duplicateScopes: ['same-key', 'cross-row', 'cross-theme'],
    maxAgeMs: FAIRTEST_EVIDENCE_MAX_AGE_MS,
    maxOutputBytes: FAIRTEST_EVIDENCE_MAX_OUTPUT_BYTES,
  }
}

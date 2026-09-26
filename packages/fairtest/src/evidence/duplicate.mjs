// Neutral duplicate-scope evaluation for evidence rows. Three scopes are
// supported, each disjoint:
//
// - same-key: two rows share one caller-owned row key;
// - cross-row: two rows of different host kinds share one artifact digest;
// - cross-theme: two rows of the same host kind with different themes share
//   one artifact digest.
//
// The caller selects which scopes run and which artifact classes participate.
// Every failure carries the artifact name, the shared digest, both row keys,
// and a repair. No runner, route, selector, port, or product threshold is
// named here.

import { createEvidenceFailure } from './failure.mjs'

const ARTIFACT_CLASS_HINT = 'compare only the caller-declared artifact classes for duplication'

/**
 * Evaluate the caller-selected duplicate scopes over the run rows. Returns the
 * typed failures plus one duplicate outcome per row index, so a report can
 * carry the per-record duplicate decision beside the failure list.
 * @param {import('./record.mjs').EvidenceRowInput[]} rows evidence rows in run order
 * @param {import('./policy.mjs').EvidencePolicyInput} policy caller-owned policy
 * @returns {{ failures: import('./failure.mjs').EvidenceFailure[], outcomes: { sameKey: boolean, crossRow: boolean, crossTheme: boolean }[] }}
 */
export function evaluateDuplicateScopes(rows, policy) {
  const scopes = new Set(policy.duplicateScopes)
  const classes = new Set(policy.artifactClasses)
  const failures = []
  const outcomes = rows.map(() => ({ sameKey: false, crossRow: false, crossTheme: false }))

  if (scopes.has('same-key')) {
    const firstSeen = new Map()
    for (const [index, row] of rows.entries()) {
      if (firstSeen.has(row.key)) {
        outcomes[index].sameKey = true
        outcomes[firstSeen.get(row.key)].sameKey = true
        failures.push(createEvidenceFailure({
          code: 'duplicate-same-key',
          path: `rows[${index}].key`,
          expected: `one row for key ${JSON.stringify(row.key)}`,
          observed: `rows ${firstSeen.get(row.key)} and ${index} share key ${JSON.stringify(row.key)}`,
          repair: `remove the duplicate ${JSON.stringify(row.key)} row or give the second row its own caller-owned key; ${ARTIFACT_CLASS_HINT}`,
        }))
      } else {
        firstSeen.set(row.key, index)
      }
    }
  }

  /** @type {Map<string, { index: number, key: string, kind: string, theme: string, name: string }[]>} */
  const byDigest = new Map()
  for (const [index, row] of rows.entries()) {
    for (const artifact of row.artifacts) {
      if (!classes.has(artifact.name)) continue
      const entries = byDigest.get(artifact.digest) ?? []
      entries.push({ index, key: row.key, kind: row.kind, theme: row.theme, name: artifact.name })
      byDigest.set(artifact.digest, entries)
    }
  }

  for (const [digest, entries] of byDigest) {
    if (entries.length < 2) continue
    if (scopes.has('cross-row')) {
      const kinds = new Set(entries.map((entry) => entry.kind))
      if (kinds.size > 1) {
        for (const entry of entries) outcomes[entry.index].crossRow = true
        const keys = [...new Set(entries.map((entry) => entry.key))]
        const names = [...new Set(entries.map((entry) => entry.name))]
        failures.push(createEvidenceFailure({
          code: 'duplicate-cross-row',
          path: `rows[].artifacts[].digest`,
          expected: `distinct bytes per kind for ${JSON.stringify(names[0])}`,
          observed: `rows ${JSON.stringify(keys)} across kinds ${JSON.stringify([...kinds])} share digest ${JSON.stringify(digest)}`,
          repair: `re-capture the ${JSON.stringify(names[0])} artifact for each kind instead of copying one row's bytes across kinds`,
        }))
      }
    }
    if (scopes.has('cross-theme')) {
      for (const kind of new Set(entries.map((entry) => entry.kind))) {
        const group = entries.filter((entry) => entry.kind === kind)
        const themes = new Set(group.map((entry) => entry.theme))
        if (themes.size > 1) {
          for (const entry of group) outcomes[entry.index].crossTheme = true
          const keys = [...new Set(group.map((entry) => entry.key))]
          const names = [...new Set(group.map((entry) => entry.name))]
          failures.push(createEvidenceFailure({
            code: 'duplicate-cross-theme',
            path: `rows[].artifacts[].digest`,
            expected: `distinct bytes per theme for ${JSON.stringify(names[0])}`,
            observed: `rows ${JSON.stringify(keys)} in kind ${JSON.stringify(kind)} share digest ${JSON.stringify(digest)} across themes ${JSON.stringify([...themes])}`,
            repair: `re-capture the ${JSON.stringify(names[0])} artifact for each theme instead of reusing one theme's bytes`,
          }))
        }
      }
    }
  }

  return { failures, outcomes }
}

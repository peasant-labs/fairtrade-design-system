// @ts-check

import {
  AllInsightKinds,
  AllInsightProvenances,
  AllReadAttributionStates,
  AllReadStateGrades,
  isInsightKind,
  isInsightProvenance,
  isReadAttributionState,
  isReadStateGrade,
} from '@peasant-labs/schema'

/** @typedef {import('@peasant-labs/schema').InsightKind} InsightKind */
/** @typedef {import('@peasant-labs/schema').InsightProvenance} InsightProvenance */
/** @typedef {import('@peasant-labs/schema').ReadAttributionState} ReadAttributionState */
/** @typedef {import('@peasant-labs/schema').ReadStateGrade} ReadStateGrade */
/** @typedef {{markerClass:string}} InsightProvenancePresentation */

/* Labels are presentation vocabulary, while the possible kinds are owned by the
 * published schema contract. The startup assertion deliberately fails closed if
 * that contract widens before Fairtrade chooses a readable label. */
export const INSIGHT_KIND_LABELS = Object.freeze(/** @type {Readonly<Record<InsightKind, string>>} */ ({
  decision: 'decisions',
  friction: 'friction',
  unusual: 'unusual signals',
  retry_loop: 'retry loops',
}))

/* Provenance is wire meaning. Its visible marker remains Fairtrade-owned so a
 * schema widening cannot fall through to an ambiguous generic CSS treatment. */
export const INSIGHT_PROVENANCE_PRESENTATIONS = Object.freeze(/** @type {Readonly<Record<InsightProvenance, InsightProvenancePresentation>>} */ ({
  mechanical: Object.freeze({ markerClass: 'tlp-insight-provenance-mechanical' }),
  mined: Object.freeze({ markerClass: 'tlp-insight-provenance-mined' }),
}))

assertInsightKindLabels()
assertInsightProvenancePresentations()

/** @param {Array<{kind:string, provenance:string}>} insights */
export function assertInsightContractValues(insights) {
  const invalidIndex = insights.findIndex((insight) => !isInsightKind(insight.kind) || !isInsightProvenance(insight.provenance))
  if (invalidIndex === -1) return
  throw actionable(
    'validate insight values',
    `insights[${invalidIndex}]`,
    `the insight kind or provenance is outside the canonical @peasant-labs/schema value domain (kinds: ${AllInsightKinds.join(', ')}; provenances: ${AllInsightProvenances.join(', ')})`,
    'validate and normalize the local API response to the published @peasant-labs/schema contract before rendering',
  )
}

/** @param {Array<{readAttribution:string, readState:string}>} nodes */
export function assertRankingContractValues(nodes) {
  const invalidIndex = nodes.findIndex((node) => !isReadAttributionState(node.readAttribution) || !isReadStateGrade(node.readState))
  if (invalidIndex === -1) return
  throw actionable(
    'validate ranking values',
    `nodes[${invalidIndex}]`,
    `the read-attribution state or read-state grade is outside the canonical @peasant-labs/schema value domain (attribution states: ${AllReadAttributionStates.join(', ')}; read-state grades: ${AllReadStateGrades.join(', ')})`,
    'validate and normalize the local API response to the published @peasant-labs/schema contract before ranking',
  )
}

function assertInsightKindLabels() {
  const labels = Object.keys(INSIGHT_KIND_LABELS)
  const missing = AllInsightKinds.filter((kind) => typeof INSIGHT_KIND_LABELS[kind] !== 'string' || INSIGHT_KIND_LABELS[kind].trim() === '')
  const unknown = labels.filter((kind) => !isInsightKind(kind))
  if (missing.length === 0 && unknown.length === 0 && labels.length === AllInsightKinds.length) return
  throw actionable(
    'validate insight labels',
    'INSIGHT_KIND_LABELS',
    `the Fairtrade label map does not exactly cover the canonical @peasant-labs/schema insight kinds (missing: ${missing.join(', ') || 'none'}; unknown: ${unknown.join(', ') || 'none'})`,
    'add one non-empty Fairtrade UI label for each published insight kind and remove labels that are no longer in the schema contract',
  )
}

function assertInsightProvenancePresentations() {
  const provenances = Object.keys(INSIGHT_PROVENANCE_PRESENTATIONS)
  const missing = AllInsightProvenances.filter((provenance) => {
    const presentation = INSIGHT_PROVENANCE_PRESENTATIONS[provenance]
    return !presentation || typeof presentation.markerClass !== 'string' || presentation.markerClass.trim() === ''
  })
  const unknown = provenances.filter((provenance) => !isInsightProvenance(provenance))
  if (missing.length === 0 && unknown.length === 0 && provenances.length === AllInsightProvenances.length) return
  throw actionable(
    'validate insight provenance presentations',
    'INSIGHT_PROVENANCE_PRESENTATIONS',
    `the Fairtrade provenance presentation map does not exactly cover the canonical @peasant-labs/schema insight provenances (missing: ${missing.join(', ') || 'none'}; unknown: ${unknown.join(', ') || 'none'})`,
    'add one explicit Fairtrade marker class for each published insight provenance and remove presentations that are no longer in the schema contract',
  )
}

/** @param {string} operation @param {string} where @param {string} why @param {string} fix */
function actionable(operation, where, why, fix) {
  return new Error(`Fairtrade graph contract ${operation} failed: what went wrong: invalid ${where}; why: ${why}; where: src/ui/graph/graphContractPolicy.js ${where}; when: ${operation}; what it means: Fairtrade cannot render the graph value without guessing; how to fix: ${fix}.`)
}

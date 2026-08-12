// @ts-check
/* Contract type-test for the ONE transcript adapter + shared analytics util. It
   imports the ACTUAL production surface (the same `./index.js` barrel a
   downstream consumer imports) and asserts, at the type level, the load-bearing
   guarantees of `adaptTranscript()` and the analytics helpers. Enforced by:
     pnpm test:contract
   which runs `tsc -p tsconfig.contract.json` (checkJs, strict, noImplicitAny,
   noEmit) over this file. A red error here means the adapter/analytics contract
   changed incompatibly and must be fixed before downstream
   component work can depend on it. */

/** @typedef {import('./index.js').TranscriptWireInput} TranscriptWireInput */
/** @typedef {import('./index.js').TranscriptViewModel} TranscriptViewModel */
/** @typedef {import('./index.js').TranscriptAnalyticsVM} TranscriptAnalyticsVM */
/** @typedef {import('./index.js').TurnDetail} TurnDetail */
/** @typedef {import('./index.js').AnnotationSummary} AnnotationSummary */
/** @typedef {import('./index.js').ToolCallVM} ToolCallVM */
/** @typedef {import('./index.js').TaskGroup} TaskGroup */
/** @typedef {import('./index.js').WaterfallSegment} WaterfallSegment */
/** @typedef {import('./index.js').TranscriptAnnotation} TranscriptAnnotation */
/** @typedef {import('./index.js').PersonalMedians} PersonalMedians */
/** @typedef {import('./index.js').PhaseVM} PhaseVM */
/** @typedef {import('./index.js').ScorecardBandVM} ScorecardBandVM */
/** @typedef {import('./index.js').SessionScorecard} SessionScorecard */

import {
  adaptTranscript,
  prefilterTurns,
  computeTasks,
  computeTurnLabels,
  buildTaskWaterfall,
  annotateTranscript,
  computePersonalMedians,
  detectPhases,
  assessScorecard,
  computeAnalytics,
  computeTaskGroups,
} from './index.js'

/* ── A representative wire payload (flat Go git shape) ──────────────────────── */
/** @type {TranscriptWireInput} */
const wire = {
  id: 's-contract',
  harness: 'claude-code',
  startTime: '2026-06-24T00:00:00Z',
  endTime: '2026-06-24T00:10:00Z',
  durationMins: 10,
  totalTokens: 200,
  tokensIn: 120,
  tokensOut: 80,
  turnCount: 2,
  toolCallCount: 1,
  turns: [
    { index: 0, role: 'user', content: 'edit the file', timestamp: '2026-06-24T00:00:00Z', depth: 0 },
    {
      index: 1,
      role: 'assistant',
      content: 'editing',
      model: 'Claude Opus 4.7',
      timestamp: '2026-06-24T00:01:00Z',
      depth: 0,
      entryType: 'tool_use',
      toolCalls: [
        {
          id: 't1',
          name: 'Edit',
          arguments: '{"file_path":"a.ts","old_string":"x","new_string":"y"}',
          result: '"ok"',
          toolKind: 'edit',
        },
      ],
    },
  ],
  gitBranch: 'main',
  gitRemote: 'origin',
}
void wire

/* The optional model is a canonical generated-schema field, not a Fairtrade-local
   wire extension. The released package must expose this same field before the
   consumer contract can pass in continuous integration. */
/** @param {TurnDetail} turn */
function readCanonicalTurnModel(turn) {
  return turn.model
}
void readCanonicalTurnModel

/* ── (1) adaptTranscript(payload) → TranscriptViewModel ─────────────────────── */
/** @type {TranscriptViewModel} */
const vm1 = adaptTranscript(wire)
/** @type {string | undefined} */
const effectiveModel = vm1.turns[1].model
void effectiveModel
// toolCallsById is a Map (parsed once)
/** @type {ToolCallVM | undefined} */
const tc = vm1.toolCallsById.get('t1')
void tc
// core arrays are always present (never undefined)
void vm1.diffs.length
void vm1.files.length
void vm1.tasks.length
void vm1.highlights.length
void vm1.turns[0].annotations.length
void vm1.filterIndex.totalTurns
// git is cooked + optional; render-when-present
void vm1.session.git?.branch
// analytics is render-when-present on the VM
void vm1.analytics?.phases?.length

/* ── (2) adaptTranscript ALSO accepts the retired nested git shape ──────────── */
/** @type {TranscriptWireInput} */
const nestedWire = {
  ...wire,
  gitBranch: undefined,
  gitRemote: undefined,
  gitContext: {
    branch: 'feat',
    workingDirectory: '/legacy/project',
    commits: [
      { hash: 'abcdef1', message: 'init', authorName: 'a', authorEmail: 'a@b.c', commitTime: BigInt(1), authorTime: BigInt(1) },
    ],
  },
}
void adaptTranscript(nestedWire)

/* ── (3) the full 3-arg form: payload + annotations + precomputed analytics ──── */
/** @type {AnnotationSummary[]} */
const annotations = [
  {
    id: 'a1',
    targetKind: 'entry',
    targetEntryIndex: 1,
    isPrimary: true,
    annotatorKind: 'human',
    annotatorName: 'me',
    typeId: 'user.note',
    typeName: 'Note',
    value: 'looks good',
    createdAt: BigInt(1),
  },
]
/** @type {TranscriptAnalyticsVM} */
const precomputed = computeAnalytics(prefilterTurns(wire.turns ?? []), { scorecard: wire.scorecard ?? undefined })
/** @type {TranscriptViewModel} */
const vm3 = adaptTranscript(wire, annotations, precomputed)
void vm3

/* ── (4) back-compat analytics signatures (re-exported by the browser migration) ── */
/** @type {TaskGroup[]} */
const tasks = computeTasks(wire.turns ?? [])
/** @type {string[]} */
const labels = computeTurnLabels(wire.turns ?? [])
/** @type {WaterfallSegment[]} */
const waterfall = buildTaskWaterfall(tasks)
/** @type {TranscriptAnnotation[]} */
const patterns = annotateTranscript(wire.turns ?? [])
/** @type {PersonalMedians} */
const medians = computePersonalMedians([
  { totalTokens: 100, retryTokensWasted: 10, specQualityScore: 60, withinSessionReverts: 1 },
])
void labels
void waterfall
void patterns
void medians

/* ── (5) cooked analytics producers ─────────────────────────────────────────── */
/** @type {PhaseVM[]} */
const phases = detectPhases(wire.turns ?? [])
/** @type {ScorecardBandVM[]} */
const bands = assessScorecard(/** @type {SessionScorecard} */ ({ specQualityScore: 30 }), medians)
/** @type {import('./index.js').TaskGroupVM[]} */
const taskGroups = computeTaskGroups(wire.turns ?? [])
void phases
void bands
void taskGroups

/* ── (6) prefilterTurns is a WIRE→wire transform (returns TurnDetail[]) ──────── */
/** @type {TurnDetail[]} */
const filtered = prefilterTurns(wire.turns ?? [])
void filtered

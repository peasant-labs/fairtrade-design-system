/* transcript sub-barrel — the single import surface for the lifted transcript
   components, schema-backed wire types, and the cooked TranscriptViewModel.
   Re-exported from the top-level src/ui/index.js as `@peasant-labs/fairtrade/ui`.

   The component primitives + the composite TranscriptViewer are appended here as
   they are built. Graph node visuals live in the ./graph sub-barrel, NOT here.

   What ships today (the integration spine):
     • the schema-backed wire contract (wire-types.js) — canonical generated
       types plus the adapter's one legacy compatibility shape;
     • the cooked TranscriptViewModel contract (view-model.js) — every
       component's prop contract.
   Both files emit their types into the published .d.ts because the runtime
   enum-value arrays below pull them into the tsc declaration-emit program.

   The wire->view-model binding contract (per-field provenance + the parse-enforcement
   stack) is documented in ./DATA-BINDING.md. */

/* ── canonical schema enum-value arrays (runtime) ───────────────────────────── */
export {
  ROLES,
  ENTRY_TYPES,
  TOOL_CALL_KINDS,
  STOP_REASONS,
  SESSION_OUTCOMES,
  HARNESSES,
} from './wire-types.js'

/* ── view-model enum-value array (runtime) ───────────────────────────────────── */
export { TOOL_GROUPS } from './view-model.js'

/* ── transcript adapter + shared analytics util (runtime) ─────────────────────────
   The ONE wire→view-model projection (`adaptTranscript`) — the sole JSON.parse +
   legacy-git normalisation site — plus the single-session analytics util. The
   analytics helpers keep their canonical wire-shaped signatures so the
   transcript-browser migration can re-export them for peasant's back-compat
   imports without change. Pure-render derivations live in the adapter. ─────────── */
export { adaptTranscript, prefilterTurns, diffLines } from './adapter.js'
export {
  computeTasks,
  computeTurnLabels,
  buildTaskWaterfall,
  annotateTranscript,
  computePersonalMedians,
  detectPhases,
  assessScorecard,
  computeAnalytics,
  computeTaskGroups,
  phaseLabel,
} from './analytics.js'

/* ── standalone transcript helpers (runtime) ───────────────────────────────────
   Lifted from transcript-browser (turnNav / time / title): keyboard-nav index
   math and the session-detail header's time + title formatters. Pure,
   framework-agnostic functions — no fairtrade equivalent existed. ──────────── */
export { nextNavTurn } from './turnNav.js'
export { formatRelative, formatDurationMins, formatDateLong } from './time.js'
export { summarizePrompt, composeSessionTitle, projectLabel } from './title.js'

/* ── lifted transcript rendering primitives + composite (runtime) ─────────────────
   The dumb single-transcript components, lifted verbatim from the canonical mockup.
   Each renders the cooked TranscriptViewModel (TurnVM / ToolCallVM / ThinkingVM /
   DiffEntryVM …) and NEVER parses wire.

   Every PUBLIC export carries the consistent `Transcript*` convention so the surface
   is collision-safe before downstream consumers (transcript-browser, peasant, village)
   import it — `TranscriptToolCall` stays distinct from the top-level barrel's Timeline
   `ToolCall`, `TranscriptMarkdown` from any host markdown, etc. (Internal file +
   component names are unchanged; it is the exported identifiers that are namespaced.)
   `TranscriptDiffHunks` is the shared `.txn-diff` hunk renderer the edit body +
   DiffEntryCard both draw. */
export { default as TranscriptTurnCard } from './TurnCard.jsx'
export { default as TranscriptThinking } from './Thinking.jsx'
export { default as TranscriptMarkdown } from './Markdown.jsx'
export { default as TranscriptToolCall } from './ToolCall.jsx'
export { default as TranscriptToolBody } from './ToolBody.jsx'
export { default as TranscriptTaskBody } from './TaskBody.jsx'
export { default as TranscriptDiffEntryCard, DiffHunks as TranscriptDiffHunks } from './DiffEntryCard.jsx'
export { default as TranscriptOutcomeChip } from './OutcomeChip.jsx'

/* the composite single-transcript surface + the view chrome it assembles (rails,
   scrubber, scorecard, label popover). The composite is the drop-in `TranscriptViewer`;
   the rest are exported for peasant/village shells that assemble their own layout. */
export { default as TranscriptViewer } from './TranscriptViewer.jsx'
export { default as TranscriptOutlineRail } from './OutlineRail.jsx'
export { default as TranscriptFiltersRail } from './FiltersRail.jsx'
export { default as TranscriptFilterSection } from './FilterSection.jsx'
export { default as TranscriptCheckRow } from './CheckRow.jsx'
export { default as TranscriptViewSwitch } from './ViewSwitch.jsx'
export { default as TranscriptScrubber } from './Scrubber.jsx'
export { default as TranscriptScorecard } from './Scorecard.jsx'
export { default as TranscriptLabelPopover } from './LabelPopover.jsx'
export {
  advanceTranscriptInitialPositionConsumption,
  normalizeTranscriptInitialPosition,
  resolveTranscriptInitialPosition,
  shouldApplyTranscriptInitialPosition,
  transcriptInitialPositionReadiness,
  transcriptInitialPositionToken,
} from './initial-position.js'
export { default as useTranscriptInitialPosition } from './useTranscriptInitialPosition.jsx'

/* ── adapter + analytics types (JSDoc re-exports; erased at build) ────────────── */
/** @typedef {import('./analytics.js').TaskGroup} TaskGroup */
/** @typedef {import('./analytics.js').WaterfallSegment} WaterfallSegment */
/** @typedef {import('./analytics.js').TranscriptAnnotation} TranscriptAnnotation */
/** @typedef {import('./analytics.js').PersonalMedians} PersonalMedians */
/** @typedef {import('./analytics.js').PersonalMedianSession} PersonalMedianSession */
/** @typedef {import('./analytics.js').PhaseType} PhaseType */

/* ── schema-backed wire types (JSDoc re-exports; erased at build) ─────────────── */
/** @typedef {import('./wire-types.js').Role} Role */
/** @typedef {import('./wire-types.js').EntryType} EntryType */
/** @typedef {import('./wire-types.js').ToolCallKind} ToolCallKind */
/** @typedef {import('./wire-types.js').StopReason} StopReason */
/** @typedef {import('./wire-types.js').SessionOutcome} SessionOutcome */
/** @typedef {import('./wire-types.js').Harness} Harness */
/** @typedef {import('./wire-types.js').ToolCallDetail} ToolCallDetail */
/** @typedef {import('./wire-types.js').TurnDetail} TurnDetail */
/** @typedef {import('./wire-types.js').ChildSessionRef} ChildSessionRef */
/** @typedef {import('./wire-types.js').SessionScorecard} SessionScorecard */
/** @typedef {import('./wire-types.js').CommitInfo} CommitInfo */
/** @typedef {import('./wire-types.js').AnnotationSummary} AnnotationSummary */
/** @typedef {import('./wire-types.js').SessionDetailPayload} SessionDetailPayload */
/** @typedef {import('./wire-types.js').TranscriptWireInput} TranscriptWireInput */

/* ── state + capabilities types (JSDoc re-exports; erased at build) ──────────────
   The composite TranscriptViewer's required-capabilities + callback +
   controllable-state contract. Type-only (state-capabilities.js emits
   `export {}`); listed here so consumers import the contract from the sub-barrel
   and so it lands in the published `.d.ts`. ───────────────────────────────────── */
/** @typedef {import('./state-capabilities.js').TranscriptViewerProps} TranscriptViewerProps */
/** @typedef {import('./state-capabilities.js').TranscriptInitialPosition} TranscriptInitialPosition */
/** @typedef {import('./state-capabilities.js').BreadcrumbItem} BreadcrumbItem */
/** @typedef {import('./state-capabilities.js').ViewerCapabilities} ViewerCapabilities */
/** @typedef {import('./state-capabilities.js').ViewerCallbacks} ViewerCallbacks */
/** @typedef {import('./state-capabilities.js').GraphSlotContext} GraphSlotContext */
/** @typedef {import('./state-capabilities.js').TranscriptFilters} TranscriptFilters */
/** @typedef {import('./state-capabilities.js').SavedLabel} SavedLabel */
/** @typedef {import('./state-capabilities.js').Theme} Theme */
/** @typedef {import('./state-capabilities.js').TranscriptTab} TranscriptTab */
/** @typedef {import('./state-capabilities.js').ViewMode} ViewMode */

/* ── cooked view-model types (JSDoc re-exports; erased at build) ──────────────── */
/** @typedef {import('./view-model.js').TranscriptViewModel} TranscriptViewModel */
/** @typedef {import('./view-model.js').SessionVM} SessionVM */
/** @typedef {import('./view-model.js').SessionGitVM} SessionGitVM */
/** @typedef {import('./view-model.js').CommitVM} CommitVM */
/** @typedef {import('./view-model.js').TurnVM} TurnVM */
/** @typedef {import('./view-model.js').ThinkingVM} ThinkingVM */
/** @typedef {import('./view-model.js').ToolCallVM} ToolCallVM */
/** @typedef {import('./view-model.js').ToolGroup} ToolGroup */
/** @typedef {import('./view-model.js').DiffLineVM} DiffLineVM */
/** @typedef {import('./view-model.js').DiffHunkVM} DiffHunkVM */
/** @typedef {import('./view-model.js').DiffEntryVM} DiffEntryVM */
/** @typedef {import('./view-model.js').FileEntryVM} FileEntryVM */
/** @typedef {import('./view-model.js').TaskGroupVM} TaskGroupVM */
/** @typedef {import('./view-model.js').HighlightVM} HighlightVM */
/** @typedef {import('./view-model.js').AnnotationVM} AnnotationVM */
/** @typedef {import('./view-model.js').TurnLabel} TurnLabel */
/** @typedef {import('./view-model.js').FilterIndexVM} FilterIndexVM */
/** @typedef {import('./view-model.js').PhaseVM} PhaseVM */
/** @typedef {import('./view-model.js').ScorecardBandVM} ScorecardBandVM */
/** @typedef {import('./view-model.js').TranscriptAnalyticsVM} TranscriptAnalyticsVM */

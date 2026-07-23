/* graph sub-barrel — the single import surface for the peasant code-graph
   surfaces (Changes, ChangeDetail, CodeMap): their cooked prop-payload contracts
   plus (as they land) the lifted surface components.

   Consumed as `@peasant-labs/fairtrade/graph` — a per-surface entry point kept
   separate from `./commons` so a peasant app importing the graph surfaces never
   bundles the village commons surfaces (intra-package bundle isolation). The
   matching stylesheet ships as `@peasant-labs/fairtrade/graph.css`.

   What ships today (the contract seam): the surface payload typedefs + the
   canonical enum-value arrays consumers iterate (the runtime exports below pull
   types.js into the tsc declaration-emit program, so the contract lands in the
   published .d.ts). Lifted surface components are appended here as they are built.

   Mirrors the transcript sub-barrel pattern (src/ui/transcript/index.js). */

/* ── lifted surface components (runtime) ─────────────────────────────────────── */
export { default as Changes } from './Changes.jsx'
export { default as ChangeDetail } from './ChangeDetail.jsx'
export { default as CodeMap, codeMapPayloadToMapData } from './CodeMap.jsx'
export { default as CodeMapComposition, DefaultMapLegend } from './CodeMapComposition.jsx'
export { default as CodeMapNavigator } from './CodeMapNavigator.jsx'
export { CODE_MAP_STATE_VERSION, CODE_MAP_VIEWPORT_SCALE, isCodeMapViewportScale, codeMapStatesEqual, createCodeMapState, reduceCodeMapState, deriveCodeMapView } from './codeMapState.js'
export { assertTimelineNavigationAction } from './timelineNavigation.js'
export { GraphAppShell, GraphSectionNav, GRAPH_APP_SECTIONS } from '../inuse/InUseShell.jsx'

/* ── derivation helper (runtime) — ChangesPayload → kit CommitGraph dataset ────── */
export { buildChangesGraph, humanizeAge } from './changeGraph.js'

/* ── canonical enum-value arrays (runtime) ───────────────────────────────────── */
export {
  assertChangeDetailPayloadEnums,
  assertChangeDiffPayloadEnums,
  assertCodeMapPayloadEnums,
  MAP_NODE_KINDS,
  CHANGE_BINDINGS,
  EDGE_VIOLATION_KINDS,
  FILE_CHANGE_STATUSES,
  DIFF_LINE_KINDS,
} from './types.js'

/* Canonical runtime enum objects, ordered inventories, and predicates. */
export {
  MapNodeKind,
  AllMapNodeKinds,
  isMapNodeKind,
  ChangeBinding,
  AllChangeBindings,
  isChangeBinding,
  EdgeViolationKind,
  AllEdgeViolationKinds,
  isEdgeViolationKind,
  FileChangeStatus,
  AllFileChangeStatuses,
  isFileChangeStatus,
  DiffLineKind,
  AllDiffLineKinds,
  isDiffLineKind,
} from '@peasant-labs/schema'

/* ── enum types (JSDoc re-exports; erased at build) ──────────────────────────────
   The checkJs typedef-re-export pattern has no `export type` syntax in .js files,
   so each type downstream consumers import from the sub-barrel is listed here
   explicitly (same hand-maintained pattern as the transcript sub-barrel). */
/** @typedef {import('./types.js').MapNodeKind} MapNodeKind */
/** @typedef {import('./types.js').ChangeBinding} ChangeBinding */
/** @typedef {import('./types.js').EdgeViolationKind} EdgeViolationKind */
/** @typedef {import('./types.js').FileChangeStatus} FileChangeStatus */
/** @typedef {import('./types.js').DiffLineKind} DiffLineKind */

/* ── shared sub-type payloads (JSDoc re-exports; erased at build) ─────────────── */
/** @typedef {import('./types.js').CommitRefPayload} CommitRefPayload */
/** @typedef {import('./types.js').TimelineSessionPayload} TimelineSessionPayload */
/** @typedef {import('./types.js').MapEdgePayload} MapEdgePayload */
/** @typedef {import('./types.js').ActivityEdgePayload} ActivityEdgePayload */
/** @typedef {import('./types.js').EdgeViolationPayload} EdgeViolationPayload */
/** @typedef {import('./types.js').MapNodePayload} MapNodePayload */
/** @typedef {import('./types.js').MapSlicePayload} MapSlicePayload */

/* ── Changes surface payloads (JSDoc re-exports; erased at build) ─────────────── */
/** @typedef {import('./types.js').ChangeSummaryPayload} ChangeSummaryPayload */
/** @typedef {import('./types.js').ChangesPayload} ChangesPayload */

/* ── ChangeDetail surface payloads (JSDoc re-exports; erased at build) ────────── */
/** @typedef {import('./types.js').TaskSummaryPayload} TaskSummaryPayload */
/** @typedef {import('./types.js').ChangeSessionPayload} ChangeSessionPayload */
/** @typedef {import('./types.js').UnusualSignalPayload} UnusualSignalPayload */
/** @typedef {import('./types.js').FrictionClusterPayload} FrictionClusterPayload */
/** @typedef {import('./types.js').FileChangePayload} FileChangePayload */
/** @typedef {import('./types.js').ChangeDetailPayload} ChangeDetailPayload */

/* ── ChangeDiff (lazy per-file diff) payloads (JSDoc re-exports; erased at build) ── */
/** @typedef {import('./types.js').DiffLinePayload} DiffLinePayload */
/** @typedef {import('./types.js').DiffHunkPayload} DiffHunkPayload */
/** @typedef {import('./types.js').ChangeDiffPayload} ChangeDiffPayload */

/* ── CodeMap surface payload (JSDoc re-export; erased at build) ───────────────── */
/** @typedef {import('./types.js').CodeMapPayload} CodeMapPayload */
/** @typedef {import('./codeMapState.js').CodeMapPresentation} CodeMapPresentation */
/** @typedef {import('./codeMapState.js').CodeMapGrain} CodeMapGrain */
/** @typedef {import('./codeMapState.js').CodeMapViewport} CodeMapViewport */
/** @typedef {import('./codeMapState.js').CodeMapState} CodeMapState */
/** @typedef {import('./codeMapState.js').CodeMapAction} CodeMapAction */
/** @typedef {import('./codeMapState.js').CodeMapNavigatorRow} CodeMapNavigatorRow */
/** @typedef {import('./codeMapState.js').CodeMapCanvasView} CodeMapCanvasView */
/** @typedef {import('./codeMapState.js').CodeMapView} CodeMapView */
/** @typedef {import('./timelineNavigation.js').TimelineNavigationAction} TimelineNavigationAction */

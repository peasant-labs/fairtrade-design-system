/* graph sub-barrel: the single import surface for the peasant code-graph
   surfaces (Changes, ChangeDetail, CodeMap): their cooked prop-payload contracts
   plus (as they land) the lifted surface components.

   Consumed as `@peasant-labs/fairtrade/graph`, a per-surface entry point kept
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
export { CODE_MAP_STATE_VERSION, CODE_MAP_VIEWPORT_SCALE, isCodeMapViewportScale, codeMapStatesEqual, createCodeMapState, reduceCodeMapState, deriveCodeMapView, deriveTimelineHighlight, resolveEscapeAction } from './codeMapState.js'
export { assertTimelineNavigationAction } from './timelineNavigation.js'
export { GraphAppShell, GraphSectionNav, GRAPH_APP_SECTIONS } from '../inuse/InUseShell.jsx'

/* ── derivation helper (runtime) — ChangesPayload → kit CommitGraph dataset ────── */
export { buildChangesGraph, humanizeAge } from './changeGraph.js'

/* timeline and ranked-list primitives */
export { default as SessionLane } from './SessionLane.jsx'
export { default as GhostCommitNode } from './GhostCommitNode.jsx'
export { default as GhostGroup } from './GhostGroup.jsx'
export { default as HighlightEdge } from './HighlightEdge.jsx'
export { default as SessionOverflowDisclosure } from './SessionOverflowDisclosure.jsx'
export { default as RankedRow } from './RankedRow.jsx'
export { default as ScentTag } from './ScentTag.jsx'
export { default as RankModeControl } from './RankModeControl.jsx'
export { default as InsightPanel } from './InsightPanel.jsx'
export { default as TouchedFileCluster } from './TouchedFileCluster.jsx'

/* ── ranking + comprehension-debt module ───────────────────── */
export {
  DOI_WEIGHTS,
  DEBT_VIEWED,
  COVERAGE_CAP,
  RECENCY_HALF_LIFE_DAYS,
  RANK_FLOOR,
  RANK_CAP,
  SCENT_TAGS,
  debtState,
  debt,
  coverage,
  hunkClears,
  partialReadHoverText,
  debtHoverText,
  scentTagsFor,
  rankMapNodesIntrinsic,
  deriveRankedRows,
  rankMapNodes,
  gateRankedRows,
} from './ranking.js'

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
  InsightKind,
  AllInsightKinds,
  isInsightKind,
  InsightProvenance,
  AllInsightProvenances,
  isInsightProvenance,
  ReadAttributionState,
  AllReadAttributionStates,
  isReadAttributionState,
  ReadStateGrade,
  AllReadStateGrades,
  isReadStateGrade,
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
/** @typedef {import('@peasant-labs/schema').InsightKind} InsightKind */
/** @typedef {import('@peasant-labs/schema').InsightProvenance} InsightProvenance */
/** @typedef {import('@peasant-labs/schema').ReadAttributionState} ReadAttributionState */
/** @typedef {import('@peasant-labs/schema').ReadStateGrade} ReadStateGrade */

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
/** @typedef {import('./codeMapState.js').CodeMapRankMode} CodeMapRankMode */
/** @typedef {import('./codeMapState.js').TimelineHighlight} TimelineHighlight */
/** @typedef {import('./ranking.js').RankInputNode} RankInputNode */
/** @typedef {import('./ranking.js').RankedRow} RankedRowData */
/** @typedef {import('./ranking.js').DebtState} DebtState */

/* ── trajectory graph (the @xyflow engine + the node visuals it wraps) ────────────
   The engine renders a transcript as a node-link trajectory. It reaches
   `@xyflow/react`, an OPTIONAL peer dependency, so it ships behind THIS per-surface
   entry only — never from `./ui`. The presentation-only node visuals it wraps are
   re-exported alongside it, so one `./graph` import gives a host the full set.
   Stylesheet: `@peasant-labs/fairtrade/graph.css` plus the host's one-time
   `@xyflow/react/dist/style.css` import. ──────────────────────────────────────── */
export {
  TrajectoryGraph,
  GraphControls,
  TrajectoryGraphLegend,
  TurnCardNode,
  ToolPillNode,
  SubagentBranchNode,
  useCanvasSync,
  turnsToFlow,
  computeLaneHeaders,
  NODE_DIMENSIONS,
  EDGE_DEFAULTS,
} from '../transcript/graph/engine/index.js'
export { GraphTurnNode, GraphToolNode, GraphSubagentBranch, GraphLegend, GRAPH_LEGEND_ITEMS } from '../transcript/graph/index.js'

/* ── trajectory-graph contracts (JSDoc re-exports; erased at build) ───────────── */
/** @typedef {import('../transcript/graph/engine/index.js').TrajectoryGraphProps} TrajectoryGraphProps */
/** @typedef {import('../transcript/graph/engine/index.js').GraphControlsProps} GraphControlsProps */
/** @typedef {import('../transcript/graph/engine/index.js').TrajectoryGraphLegendProps} TrajectoryGraphLegendProps */
/** @typedef {import('../transcript/graph/engine/index.js').TurnsToFlowOptions} TurnsToFlowOptions */
/** @typedef {import('../transcript/graph/engine/index.js').TrajectoryCanvasProps} TrajectoryCanvasProps */
/** @typedef {import('../transcript/graph/engine/index.js').TurnNodeData} TurnNodeData */
/** @typedef {import('../transcript/graph/engine/index.js').ToolCallNodeData} ToolCallNodeData */
/** @typedef {import('../transcript/graph/engine/index.js').SubagentLaneData} SubagentLaneData */
/** @typedef {import('../transcript/graph/engine/index.js').NavCommand} NavCommand */
/** @typedef {import('../transcript/graph/engine/index.js').EdgeType} EdgeType */
/** @typedef {import('../transcript/graph/engine/index.js').CanvasEdgeData} CanvasEdgeData */
/** @typedef {import('../transcript/graph/engine/index.js').FlowNode} FlowNode */
/** @typedef {import('../transcript/graph/engine/index.js').FlowEdge} FlowEdge */
/** @typedef {import('../transcript/graph/engine/index.js').FlowGraph} FlowGraph */

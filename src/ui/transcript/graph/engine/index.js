/* trajectory-graph ENGINE sub-barrel — the @xyflow layer that wraps this
   package's presentation-only graph node visuals (the siblings one directory up).

   Consumed as `@peasant-labs/fairtrade/graph`. It is deliberately NOT re-exported
   from `src/ui/transcript/graph/index.js` (and therefore not from `./ui`), because
   everything here reaches `@xyflow/react` — an OPTIONAL peer dependency. Keeping
   the engine behind the `./graph` entry is what lets an app that imports only
   `./ui` stay free of `@xyflow/react`; the packed-bundle guard
   (scripts/assert-pack-contents.mjs) asserts that boundary by name.

   The matching stylesheet ships as `@peasant-labs/fairtrade/graph.css`, and a host
   must also import `@xyflow/react/dist/style.css` once. */

/* ── engine components (runtime) ─────────────────────────────────────────────── */
export { TrajectoryGraph } from './TrajectoryGraph.jsx'
export { GraphControls } from './GraphControls.jsx'
export { TrajectoryGraphLegend } from './TrajectoryGraphLegend.jsx'
export { TurnCardNode } from './nodes/TurnCardNode.jsx'
export { ToolPillNode } from './nodes/ToolPillNode.jsx'
export { SubagentBranchNode } from './nodes/SubagentBranchNode.jsx'

/* ── engine primitives (runtime) ─────────────────────────────────────────────── */
export { useCanvasSync } from './useCanvasSync.js'
export { turnsToFlow, computeLaneHeaders } from './turnsToFlow.js'
export { NODE_DIMENSIONS, EDGE_DEFAULTS } from './constants.js'

/* ── engine contracts (JSDoc re-exports; erased at build) ─────────────────────────
   Hand-maintained for the same reason as the other sub-barrels: checkJs `.js`
   files have no `export type`, so each downstream-importable type is listed
   explicitly. This pulls the contracts into the tsc declaration-emit program so
   they ship in the published `.d.ts`. ────────────────────────────────────────── */
/** @typedef {import('./TrajectoryGraph.jsx').TrajectoryGraphProps} TrajectoryGraphProps */
/** @typedef {import('./GraphControls.jsx').GraphControlsProps} GraphControlsProps */
/** @typedef {import('./TrajectoryGraphLegend.jsx').TrajectoryGraphLegendProps} TrajectoryGraphLegendProps */
/** @typedef {import('./turnsToFlow.js').TurnsToFlowOptions} TurnsToFlowOptions */
/** @typedef {import('./types.js').TrajectoryCanvasProps} TrajectoryCanvasProps */
/** @typedef {import('./types.js').TurnNodeData} TurnNodeData */
/** @typedef {import('./types.js').ToolCallNodeData} ToolCallNodeData */
/** @typedef {import('./types.js').SubagentLaneData} SubagentLaneData */
/** @typedef {import('./types.js').NavCommand} NavCommand */
/** @typedef {import('./types.js').EdgeType} EdgeType */
/** @typedef {import('./types.js').CanvasEdgeData} CanvasEdgeData */
/** @typedef {import('./types.js').FlowNode} FlowNode */
/** @typedef {import('./types.js').FlowEdge} FlowEdge */
/** @typedef {import('./types.js').FlowGraph} FlowGraph */

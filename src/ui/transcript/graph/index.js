/* transcript graph sub-barrel — fairtrade owns the graph NODE VISUALS only
   (the aesthetic projection); the @xyflow engine, topology, layout and
   pan/zoom stay in transcript-browser. Re-exported from the top-level
   src/ui/index.js as part of `@peasant-labs/fairtrade/ui`.

   These four components are PRESENTATION-ONLY. They have NO `@xyflow` dependency
   and never parse wire JSON — each takes a flat, engine-agnostic projection of
   the cooked view model (TurnVM / ToolCallVM) plus the engine's per-node display
   state. An engine host (TB's custom @xyflow nodes) wraps each with its own
   <Handle>s and feeds it cooked props; the mockup's SVG graph feeds the same
   props — so both render identical node visuals (aesthetic parity by shared
   component) even though their topology engines differ.

   The accompanying aesthetics ship via `graph-visuals.css`, colocated into the
   lib CSS bundle through `src/lib-components.css`. */

/* ── node-visual components (runtime) ─────────────────────────────────────────── */
export { GraphTurnNode } from './GraphTurnNode.jsx'
export { GraphToolNode } from './GraphToolNode.jsx'
export { GraphSubagentBranch } from './GraphSubagentBranch.jsx'
export { GraphLegend, GRAPH_LEGEND_ITEMS } from './GraphLegend.jsx'

/* ── node-visual prop types (JSDoc re-exports; erased at build) ────────────────────
   Hand-maintained for the same reason as the transcript sub-barrel: checkJs `.js`
   files have no `export type`, so each downstream-importable type is listed here
   explicitly. This pulls the contracts into the tsc declaration-emit program so
   they ship in the published `.d.ts`. ──────────────────────────────────────────── */
/** @typedef {import('./GraphTurnNode.jsx').GraphTurnNodeProps} GraphTurnNodeProps */
/** @typedef {import('./GraphToolNode.jsx').GraphToolNodeProps} GraphToolNodeProps */
/** @typedef {import('./GraphToolNode.jsx').GraphToolItem} GraphToolItem */
/** @typedef {import('./GraphSubagentBranch.jsx').GraphSubagentBranchProps} GraphSubagentBranchProps */
/** @typedef {import('./GraphLegend.jsx').GraphLegendProps} GraphLegendProps */
/** @typedef {import('./GraphLegend.jsx').GraphLegendItem} GraphLegendItem */

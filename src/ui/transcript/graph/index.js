/* transcript graph sub-barrel: the graph NODE VISUALS (the aesthetic
   projection). Fairtrade owns the full trajectory graph: this sub-barrel's
   node visuals AND the `@xyflow` engine (topology, layout, pan/zoom) that
   wraps them. Re-exported from the top-level src/ui/index.js as part of
   `@peasant-labs/fairtrade/ui`.

   These four components are PRESENTATION-ONLY. They have NO `@xyflow` dependency
   and never parse wire JSON; each takes a flat, engine-agnostic projection of
   the cooked view model (TurnVM / ToolCallVM) plus the engine's per-node display
   state. The engine (`./engine`, published only via the separate `@peasant-labs/
   fairtrade/graph` entry, never `./ui`, so an app that imports only `./ui` never
   pulls in `@xyflow/react`) wraps each with its own <Handle>s and feeds it cooked
   props; the mockup's SVG graph feeds the same props, so both render identical
   node visuals (aesthetic parity by shared component) even though their
   topology engines differ. A consuming app (peasant, village) imports the
   engine + node visuals together from `@peasant-labs/fairtrade/graph`;
   `@xyflow/react` is that entry's optional peer dependency.

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

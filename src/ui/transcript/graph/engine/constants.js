// @ts-check
/* Node dimensions, spacing, and edge style constants for the trajectory graph.

   Ported from the transcript viewer's graph engine. The engine positions nodes in
   absolute canvas coordinates, so these are LAYOUT GEOMETRY (canvas units), not
   spacing-scale tokens: they must stay numeric for the mapper's arithmetic.

   Edge colours are CSS custom properties resolved on `.tb-graph`
   (see the trajectory-graph slice of graph.css), so both themes flip correctly. */

/**
 * Canvas geometry for the trajectory graph, in canvas units.
 * @type {Readonly<{
 *   turnWidth: number, turnBaseHeight: number, toolCallWidth: number,
 *   toolCallHeight: number, laneGap: number, verticalGap: number,
 *   toolSideGap: number, subagentIndent: number, phasePadding: number,
 * }>}
 */
export const NODE_DIMENSIONS = Object.freeze({
  turnWidth: 320,
  turnBaseHeight: 120,
  toolCallWidth: 200,
  toolCallHeight: 48,
  laneGap: 40,
  verticalGap: 24,
  /** Horizontal gap between a turn card and its tool-call node on the right. */
  toolSideGap: 24,
  /** Horizontal indent per subagent depth level. */
  subagentIndent: 48,
  phasePadding: 12,
})

/**
 * Default edge stroke roles. Colours are token-backed custom properties
 * (`--edge` / `--edge-error`) declared on the `.tb-graph` root.
 * @type {Readonly<{
 *   sequentialColor: string, sequentialColorDark: string, sequentialWidth: number,
 *   phaseTransitionWidth: number, subagentSpawnColor: string,
 *   subagentReturnColor: string, errorColor: string,
 * }>}
 */
export const EDGE_DEFAULTS = Object.freeze({
  sequentialColor: 'var(--edge)',
  sequentialColorDark: 'var(--edge)',
  sequentialWidth: 1.5,
  phaseTransitionWidth: 2,
  subagentSpawnColor: 'var(--edge)',
  subagentReturnColor: 'var(--edge)',
  errorColor: 'var(--edge-error)',
})

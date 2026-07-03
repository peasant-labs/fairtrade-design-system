/* analytics sub-barrel — the single import surface for the analytics dashboard
   (ProjectOverview + its card/table pieces, the pure metric functions, and the
   cooked prop-payload contract).

   Consumed as `@peasant-labs/fairtrade/analytics` — a per-surface entry point
   kept separate from `./graph` and `./commons` so an app importing only the
   analytics dashboard never bundles the code-graph or commons surfaces
   (intra-package bundle isolation). The matching stylesheet ships as
   `@peasant-labs/fairtrade/analytics.css` (import it alongside the shared
   `tokens.css` + `base.css` + `components.css`).

   The metric functions are genuine runtime exports: hosts that only need the
   numbers (CLIs, reports, server endpoints) can import them without React.

   Mirrors the graph/commons sub-barrel pattern (src/ui/graph/index.js). */

/* ── surface components (runtime) ────────────────────────────────────────────── */
export { default as ProjectOverview } from './ProjectOverview.jsx'
export { default as ChartCard } from './ChartCard.jsx'
export { default as ContributorTable } from './ContributorTable.jsx'

/* ── pure metric functions (runtime) ─────────────────────────────────────────── */
export {
  computeProjectAnalytics,
  sessionHasCommit,
  sessionsPerWeek,
  weeklyActiveContributors,
  returningContributorRate,
  longestStreak,
  newContributorVelocity,
  sessionToCommitRate,
  avgDurationPerActiveWeek,
  outcomeDistribution,
  resolvedRate,
  sessionStats,
  perContributorBreakdown,
} from './metrics.js'
export { median, percentile, medianAndP90 } from './stats.js'
export { weekKey, dayKey, daysBetween, parseTime, isoDate } from './time.js'

/* ── canonical enum-value arrays (runtime) ───────────────────────────────────── */
export {
  ANALYTICS_SESSION_OUTCOMES,
  PROJECT_OVERVIEW_SECTION_DEFS,
  PROJECT_OVERVIEW_SECTION_KEYS,
} from './types.js'

/* ── enum types (JSDoc re-exports; erased at build) ──────────────────────────────
   The checkJs typedef-re-export pattern has no `export type` syntax in .js files,
   so each type downstream consumers import from the sub-barrel is listed here
   explicitly (same hand-maintained pattern as the graph/commons sub-barrels). */
/** @typedef {import('./types.js').AnalyticsSessionOutcome} AnalyticsSessionOutcome */
/** @typedef {import('./types.js').ProjectOverviewSectionKey} ProjectOverviewSectionKey */

/* ── payload + record types (JSDoc re-exports; erased at build) ───────────────── */
/** @typedef {import('./types.js').AnalyticsSessionRecord} AnalyticsSessionRecord */
/** @typedef {import('./types.js').AnalyticsOverviewPayload} AnalyticsOverviewPayload */
/** @typedef {import('./types.js').ProjectOverviewSections} ProjectOverviewSections */

/* ── computed metric shapes (JSDoc re-exports; erased at build) ───────────────── */
/** @typedef {import('./types.js').WeekCount} WeekCount */
/** @typedef {import('./types.js').WeekContributors} WeekContributors */
/** @typedef {import('./types.js').ReturningContributorRate} ReturningContributorRate */
/** @typedef {import('./types.js').LongestStreak} LongestStreak */
/** @typedef {import('./types.js').WeekNewContributors} WeekNewContributors */
/** @typedef {import('./types.js').SessionToCommitRate} SessionToCommitRate */
/** @typedef {import('./types.js').WeekAvgDuration} WeekAvgDuration */
/** @typedef {import('./types.js').OutcomeDistribution} OutcomeDistribution */
/** @typedef {import('./types.js').MedianP90} MedianP90 */
/** @typedef {import('./types.js').SessionStats} SessionStats */
/** @typedef {import('./types.js').ContributorBreakdown} ContributorBreakdown */
/** @typedef {import('./types.js').ProjectAnalytics} ProjectAnalytics */

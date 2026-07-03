// @ts-check
/* Cooked prop-payload contract for the analytics surface (ProjectOverview).
   ─────────────────────────────────────────────────────────────────────────────
   SOURCE OF TRUTH: fairtrade owns this contract. The dashboard consumes an
   `AnalyticsOverviewPayload` — either raw per-session records (the surface
   computes every metric itself via metrics.js) or a pre-computed
   `ProjectAnalytics` bundle (host computed them, e.g. server-side).

   An app-side adapter cooks its own wire shape into `AnalyticsSessionRecord[]`
   ONCE; the surface never fetches, never sees wire types, and never learns
   host identities or routes (contributor rendering is a host-owned slot).

   Worked adapter example — peasant's quality stream
   (QualitySession, web/src/lib/quality/types.ts) → AnalyticsSessionRecord
   (PRESENT = identity/same-name pass-through; TRANSFORM = renamed or reshaped):
     PRESENT:        id              → id
     TRANSFORM:      date            → startTime = `${date}T00:00:00Z` (reshape)
     TRANSFORM:      project         → projectKey (rename)
     TEMPORARY:      contributorFields(qs) → contributorId/hasCommit/commitCount
                                       until the quality stream exposes linkage
     TRANSFORM:      durationMinutes → durationMins (rename)
     PRESENT:        totalTokens     → totalTokens
     PRESENT:        turnCount       → turnCount
     TRANSFORM:      toolCalls       → toolCallCount (rename)
     PRESENT:        outcome         → outcome
     NOT MAPPED (wire fields the dashboard does not read):
       inputTokens, outputTokens, retryLoops, explorationRatio, scopeBreadth,
       discoveryTurns, effectiveAnnotations, signalDensity, specQualityScore,
       retryTokensWasted, withinSessionReverts, filesTouched, linesChanged

   The @typedef blocks below are erased at build; the small frozen arrays are
   genuine runtime exports (canonical iteration order + tsc declaration-emit
   anchors). See transcript/wire-types.js for the full pattern.
   ─────────────────────────────────────────────────────────────────────────── */

/* ── Session records (the raw payload path) ─────────────────────────────────── */

/**
 * How a recorded session ended.
 * @typedef {'resolved' | 'partial' | 'failed'} AnalyticsSessionOutcome
 */

/** Canonical AnalyticsSessionOutcome values. @type {readonly AnalyticsSessionOutcome[]} */
export const ANALYTICS_SESSION_OUTCOMES = Object.freeze(['resolved', 'partial', 'failed'])

/**
 * One recorded agent session, as the analytics dashboard consumes it. This is
 * the fairtrade-owned record shape — apps map their own wire types onto it.
 * Only the fields the dashboard actually reads are part of the contract.
 * @typedef {object} AnalyticsSessionRecord
 * @property {string} [id] Stable session id (not read by the dashboard; kept
 *   for adapter round-tripping and keying host-side lists).
 * @property {string} startTime ISO-8601 timestamp; all week/day bucketing is
 *   done in UTC against this.
 * @property {string} projectKey Opaque project key (repo, collective, …).
 * @property {string} contributorId Opaque contributor key; empty ids are
 *   skipped by the contributor metrics.
 * @property {number} durationMins Session duration in minutes.
 * @property {number} totalTokens Total tokens across the session.
 * @property {number} turnCount Conversation turns.
 * @property {number} toolCallCount Tool invocations.
 * @property {AnalyticsSessionOutcome} [outcome] Unset buckets as "unknown".
 * @property {boolean} [hasCommit] Fallback commit flag when `commitCount` is
 *   absent.
 * @property {number} [commitCount] Preferred commit linkage; `> 0` wins over
 *   `hasCommit`.
 */

/* ── Computed metric shapes (the pre-computed payload path) ─────────────────── */

/**
 * One bucket of the per-week session-count series (`week` = Monday-of-week UTC
 * date key, `YYYY-MM-DD`).
 * @typedef {object} WeekCount
 * @property {string} week
 * @property {number} count
 */

/**
 * One bucket of the per-week unique-contributor series.
 * @typedef {object} WeekContributors
 * @property {string} week
 * @property {number} contributors Distinct contributor ids active that week.
 */

/**
 * Result of the returning-contributor calculation.
 * @typedef {object} ReturningContributorRate
 * @property {number} total Distinct contributors with ≥1 session.
 * @property {number} returning Distinct contributors active in ≥2 distinct weeks.
 * @property {number} rate returning / total, in [0, 1]; 0 when no contributors.
 */

/**
 * Result of a streak calculation.
 * @typedef {object} LongestStreak
 * @property {number} weeks Length of the longest run of consecutive active weeks.
 * @property {string | null} startWeek First Monday-key of that run, or null.
 * @property {string | null} endWeek Last Monday-key of that run, or null.
 */

/**
 * One bucket of the new-contributor series.
 * @typedef {object} WeekNewContributors
 * @property {string} week
 * @property {number} newContributors Contributors whose FIRST-EVER session
 *   falls in this week.
 */

/**
 * Result of the session→commit calculation.
 * @typedef {object} SessionToCommitRate
 * @property {number} total Total sessions considered.
 * @property {number} withCommit Sessions that produced ≥1 commit.
 * @property {number} rate withCommit / total, in [0, 1]; 0 when no sessions.
 */

/**
 * One bucket of the per-active-week average-duration series.
 * @typedef {object} WeekAvgDuration
 * @property {string} week
 * @property {number} avgDurationMins Mean session duration (minutes) that week.
 * @property {number} sessions Number of sessions that fed the average.
 */

/**
 * Distribution of session outcomes; the four buckets always sum to `total`
 * (sessions with no `outcome` bucket under `unknown`).
 * @typedef {object} OutcomeDistribution
 * @property {number} resolved
 * @property {number} partial
 * @property {number} failed
 * @property {number} unknown
 * @property {number} total
 */

/**
 * Median + 90th-percentile pair for a numeric distribution.
 * @typedef {object} MedianP90
 * @property {number} count Number of (finite) samples that fed the statistic.
 * @property {number | null} median 50th percentile; null for an empty input.
 * @property {number | null} p90 90th percentile; null for an empty input.
 */

/**
 * Median + p90 for the four core numeric session fields ("typical vs. tail").
 * @typedef {object} SessionStats
 * @property {MedianP90} durationMins
 * @property {MedianP90} totalTokens
 * @property {MedianP90} turnCount
 * @property {MedianP90} toolCallCount
 */

/**
 * Per-contributor rolled-up summary (one contributor-table row).
 * @typedef {object} ContributorBreakdown
 * @property {string} contributorId
 * @property {number} sessions Total sessions by this contributor.
 * @property {number} activeWeeks Distinct ISO weeks this contributor was active.
 * @property {number} totalTokens
 * @property {number} totalDurationMins
 * @property {number} totalTurns
 * @property {number} totalToolCalls
 * @property {number} sessionsWithCommit Sessions that produced ≥1 commit.
 * @property {number} totalCommits Total linked commits (sum of `commitCount`;
 *   a session carrying only `hasCommit: true` counts as 1, so this is a lower
 *   bound when the host exposes the flag but not the count).
 * @property {OutcomeDistribution} outcomes Outcome tally for this contributor.
 * @property {string | null} firstSeen Earliest session day-key (`YYYY-MM-DD`).
 * @property {string | null} lastSeen Latest session day-key (`YYYY-MM-DD`).
 */

/**
 * The fully-computed analytics bundle. `ProjectOverview` accepts either this
 * (pre-computed by the host) or raw `AnalyticsSessionRecord[]` it computes
 * itself via `computeProjectAnalytics`.
 * @typedef {object} ProjectAnalytics
 * @property {number} totalSessions Distinct sessions considered.
 * @property {number} totalContributors Distinct contributors.
 * @property {number} totalProjects Distinct projects (`projectKey` values).
 * @property {WeekCount[]} sessionsPerWeek
 * @property {WeekContributors[]} weeklyActiveContributors
 * @property {ReturningContributorRate} returningContributorRate
 * @property {LongestStreak} longestStreak
 * @property {WeekNewContributors[]} newContributorVelocity
 * @property {SessionToCommitRate} sessionToCommitRate
 * @property {WeekAvgDuration[]} avgDurationPerActiveWeek
 * @property {OutcomeDistribution} outcomeDistribution
 * @property {SessionStats} sessionStats
 * @property {ContributorBreakdown[]} perContributorBreakdown
 */

/* ── Dashboard payload + section keys ───────────────────────────────────────── */

/**
 * The cooked payload `<ProjectOverview payload={…}>` consumes. Provide exactly
 * one of the two fields; `analytics` wins when both are given.
 * @typedef {object} AnalyticsOverviewPayload
 * @property {AnalyticsSessionRecord[]} [sessions] Raw path — the surface
 *   computes every metric itself.
 * @property {ProjectAnalytics} [analytics] Pre-computed path (host computed
 *   the bundle, e.g. server-side).
 */

/**
 * The dashboard's toggleable sections.
 * @typedef {'summary' | 'sessionsPerWeek' | 'weeklyActiveContributors'
 *   | 'newContributorVelocity' | 'avgDurationPerActiveWeek'
 *   | 'outcomeDistribution' | 'sessionStats' | 'contributorTable'
 * } ProjectOverviewSectionKey
 */

/**
 * The dashboard's sections: canonical keys paired with their visible chip
 * labels, in render order. Single source of truth — the KEYS array below and
 * the component's chip row both derive from this, so key set, order and
 * labels cannot drift apart.
 * @type {ReadonlyArray<{ key: ProjectOverviewSectionKey, label: string }>}
 */
export const PROJECT_OVERVIEW_SECTION_DEFS = Object.freeze([
  { key: 'summary', label: 'summary' },
  { key: 'sessionsPerWeek', label: 'sessions/week' },
  { key: 'weeklyActiveContributors', label: 'active' },
  { key: 'newContributorVelocity', label: 'new' },
  { key: 'avgDurationPerActiveWeek', label: 'duration' },
  { key: 'outcomeDistribution', label: 'outcomes' },
  { key: 'sessionStats', label: 'typical' },
  { key: 'contributorTable', label: 'table' },
])

/** Canonical section keys, in render order (derived). @type {readonly ProjectOverviewSectionKey[]} */
export const PROJECT_OVERVIEW_SECTION_KEYS = Object.freeze(
  PROJECT_OVERVIEW_SECTION_DEFS.map((def) => def.key),
)

/**
 * Host-level section visibility. Every flag defaults to ON; set one to `false`
 * to hide that section. The built-in visible-section control can hide sections
 * at runtime, but it cannot re-enable a host-hidden section.
 * @typedef {Partial<Record<ProjectOverviewSectionKey, boolean>>} ProjectOverviewSections
 */

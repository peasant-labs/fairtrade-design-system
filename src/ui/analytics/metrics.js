// @ts-check
/* Pure metric functions over `AnalyticsSessionRecord[]`.

   Every function here is side-effect free: same input → same output, no React,
   no I/O, no global state. They form the computational core of the analytics
   surface; the `ProjectOverview` component is a thin presentation shell over
   `computeProjectAnalytics`, which calls these. Hosts that only need numbers
   (CLIs, reports, server endpoints) can import these directly without React. */

import { dayKey, weekKey } from './time.js'
import { medianAndP90 } from './stats.js'

/** @typedef {import('./types.js').AnalyticsSessionRecord} AnalyticsSessionRecord */
/** @typedef {import('./types.js').WeekCount} WeekCount */
/** @typedef {import('./types.js').WeekContributors} WeekContributors */
/** @typedef {import('./types.js').ReturningContributorRate} ReturningContributorRate */
/** @typedef {import('./types.js').LongestStreak} LongestStreak */
/** @typedef {import('./types.js').WeekNewContributors} WeekNewContributors */
/** @typedef {import('./types.js').SessionToCommitRate} SessionToCommitRate */
/** @typedef {import('./types.js').WeekAvgDuration} WeekAvgDuration */
/** @typedef {import('./types.js').OutcomeDistribution} OutcomeDistribution */
/** @typedef {import('./types.js').SessionStats} SessionStats */
/** @typedef {import('./types.js').ContributorBreakdown} ContributorBreakdown */
/** @typedef {import('./types.js').ProjectAnalytics} ProjectAnalytics */

/**
 * Does this session have at least one linked commit? `commitCount > 0` wins
 * when present, else the `hasCommit` flag.
 * @param {AnalyticsSessionRecord} s
 * @returns {boolean}
 */
export function sessionHasCommit(s) {
  if (typeof s.commitCount === 'number') return s.commitCount > 0
  return s.hasCommit === true
}

/**
 * sessionsPerWeek — number of sessions per ISO week, sorted ascending by week.
 * Weeks with no sessions are omitted (callers can densify if they want a gap-
 * free axis). Sessions with an unparseable `startTime` are dropped.
 * @param {AnalyticsSessionRecord[]} sessions
 * @returns {WeekCount[]}
 */
export function sessionsPerWeek(sessions) {
  /** @type {Map<string, number>} */
  const byWeek = new Map()
  for (const s of sessions) {
    const wk = weekKey(s.startTime)
    if (wk === null) continue
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1)
  }
  return [...byWeek.entries()]
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

/**
 * weeklyActiveContributors — distinct contributor ids active in each ISO week,
 * sorted ascending by week. The host's `contributorId` is treated as an opaque
 * key; empty ids are ignored.
 * @param {AnalyticsSessionRecord[]} sessions
 * @returns {WeekContributors[]}
 */
export function weeklyActiveContributors(sessions) {
  /** @type {Map<string, Set<string>>} */
  const byWeek = new Map()
  for (const s of sessions) {
    if (!s.contributorId) continue
    const wk = weekKey(s.startTime)
    if (wk === null) continue
    let set = byWeek.get(wk)
    if (!set) {
      set = new Set()
      byWeek.set(wk, set)
    }
    set.add(s.contributorId)
  }
  return [...byWeek.entries()]
    .map(([week, set]) => ({ week, contributors: set.size }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

/**
 * returningContributorRate — fraction of contributors who were active in two
 * or more distinct ISO weeks. A single-week contributor is "new/one-off"; a
 * multi-week contributor is "returning".
 * @param {AnalyticsSessionRecord[]} sessions
 * @returns {ReturningContributorRate}
 */
export function returningContributorRate(sessions) {
  /** @type {Map<string, Set<string>>} */
  const weeksByContributor = new Map()
  for (const s of sessions) {
    if (!s.contributorId) continue
    const wk = weekKey(s.startTime)
    if (wk === null) continue
    let set = weeksByContributor.get(s.contributorId)
    if (!set) {
      set = new Set()
      weeksByContributor.set(s.contributorId, set)
    }
    set.add(wk)
  }
  const total = weeksByContributor.size
  let returning = 0
  for (const weeks of weeksByContributor.values()) {
    if (weeks.size >= 2) returning += 1
  }
  return { total, returning, rate: total === 0 ? 0 : returning / total }
}

const MS_PER_WEEK = 7 * 86_400_000

/**
 * longestStreak — the longest run of consecutive active ISO weeks across all
 * sessions (project-wide, not per contributor). "Consecutive" means each active
 * week's Monday is exactly 7 days after the previous active week's Monday.
 * @param {AnalyticsSessionRecord[]} sessions
 * @returns {LongestStreak}
 */
export function longestStreak(sessions) {
  /** @type {Set<string>} */
  const weekSet = new Set()
  for (const s of sessions) {
    const wk = weekKey(s.startTime)
    if (wk !== null) weekSet.add(wk)
  }
  const weeks = [...weekSet].sort((a, b) => a.localeCompare(b))

  if (weeks.length === 0) return { weeks: 0, startWeek: null, endWeek: null }

  let bestLen = 1
  let bestStart = weeks[0]
  let bestEnd = weeks[0]
  let curLen = 1
  let curStart = weeks[0]

  for (let i = 1; i < weeks.length; i++) {
    const prev = Date.parse(`${weeks[i - 1]}T00:00:00Z`)
    const cur = Date.parse(`${weeks[i]}T00:00:00Z`)
    if (cur - prev === MS_PER_WEEK) {
      curLen += 1
    } else {
      curLen = 1
      curStart = weeks[i]
    }
    if (curLen > bestLen) {
      bestLen = curLen
      bestStart = curStart
      bestEnd = weeks[i]
    }
  }
  return { weeks: bestLen, startWeek: bestStart, endWeek: bestEnd }
}

/**
 * newContributorVelocity — count of contributors making their first-ever
 * appearance in each ISO week, sorted ascending. A contributor is counted once,
 * in the week of their earliest session. Useful as an acquisition / growth
 * signal for a project or collective.
 * @param {AnalyticsSessionRecord[]} sessions
 * @returns {WeekNewContributors[]}
 */
export function newContributorVelocity(sessions) {
  // Earliest day-key per contributor.
  /** @type {Map<string, string>} */
  const firstDay = new Map()
  for (const s of sessions) {
    if (!s.contributorId) continue
    const dk = dayKey(s.startTime)
    if (dk === null) continue
    const cur = firstDay.get(s.contributorId)
    if (cur === undefined || dk < cur) firstDay.set(s.contributorId, dk)
  }
  /** @type {Map<string, number>} */
  const byWeek = new Map()
  for (const dk of firstDay.values()) {
    const wk = weekKey(`${dk}T00:00:00Z`)
    if (wk === null) continue
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1)
  }
  return [...byWeek.entries()]
    .map(([week, newContributors]) => ({ week, newContributors }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

/**
 * sessionToCommitRate — fraction of sessions that produced at least one commit.
 * Uses `commitCount > 0` when present, else the `hasCommit` flag. A session
 * with neither set counts as "no commit".
 * @param {AnalyticsSessionRecord[]} sessions
 * @returns {SessionToCommitRate}
 */
export function sessionToCommitRate(sessions) {
  const total = sessions.length
  let withCommit = 0
  for (const s of sessions) if (sessionHasCommit(s)) withCommit += 1
  return { total, withCommit, rate: total === 0 ? 0 : withCommit / total }
}

/**
 * avgDurationPerActiveWeek — mean session duration (minutes) for each ISO week
 * that had at least one session, sorted ascending. Inactive weeks are omitted
 * (hence "per ACTIVE week"). Non-finite durations are ignored.
 * @param {AnalyticsSessionRecord[]} sessions
 * @returns {WeekAvgDuration[]}
 */
export function avgDurationPerActiveWeek(sessions) {
  /** @type {Map<string, { sum: number, n: number }>} */
  const acc = new Map()
  for (const s of sessions) {
    const wk = weekKey(s.startTime)
    if (wk === null) continue
    if (!Number.isFinite(s.durationMins)) continue
    const cur = acc.get(wk) ?? { sum: 0, n: 0 }
    cur.sum += s.durationMins
    cur.n += 1
    acc.set(wk, cur)
  }
  return [...acc.entries()]
    .map(([week, { sum, n }]) => ({
      week,
      avgDurationMins: n === 0 ? 0 : sum / n,
      sessions: n,
    }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

/**
 * outcomeDistribution — counts of sessions per outcome. Sessions with no
 * outcome are bucketed under `unknown`, so the four buckets always sum to
 * `total`.
 * @param {AnalyticsSessionRecord[]} sessions
 * @returns {OutcomeDistribution}
 */
export function outcomeDistribution(sessions) {
  /** @type {OutcomeDistribution} */
  const dist = {
    resolved: 0,
    partial: 0,
    failed: 0,
    unknown: 0,
    total: sessions.length,
  }
  for (const s of sessions) {
    switch (s.outcome) {
      case 'resolved':
        dist.resolved += 1
        break
      case 'partial':
        dist.partial += 1
        break
      case 'failed':
        dist.failed += 1
        break
      default:
        dist.unknown += 1
    }
  }
  return dist
}

/**
 * perContributorBreakdown — one rolled-up row per contributor, sorted by
 * session count descending (ties broken by contributor id). Powers the
 * contributor table in `ProjectOverview`. Sessions with an empty
 * `contributorId` are skipped.
 * @param {AnalyticsSessionRecord[]} sessions
 * @returns {ContributorBreakdown[]}
 */
export function perContributorBreakdown(sessions) {
  /** @type {Map<string, ContributorBreakdown>} */
  const byId = new Map()
  /** @type {Map<string, Set<string>>} */
  const weeksById = new Map()

  for (const s of sessions) {
    if (!s.contributorId) continue
    let row = byId.get(s.contributorId)
    let weeks = weeksById.get(s.contributorId)
    if (!row || !weeks) {
      row = {
        contributorId: s.contributorId,
        sessions: 0,
        activeWeeks: 0,
        totalTokens: 0,
        totalDurationMins: 0,
        totalTurns: 0,
        totalToolCalls: 0,
        sessionsWithCommit: 0,
        totalCommits: 0,
        outcomes: { resolved: 0, partial: 0, failed: 0, unknown: 0, total: 0 },
        firstSeen: null,
        lastSeen: null,
      }
      weeks = new Set()
      byId.set(s.contributorId, row)
      weeksById.set(s.contributorId, weeks)
    }
    row.sessions += 1
    row.outcomes.total += 1
    if (Number.isFinite(s.totalTokens)) row.totalTokens += s.totalTokens
    if (Number.isFinite(s.durationMins)) row.totalDurationMins += s.durationMins
    if (Number.isFinite(s.turnCount)) row.totalTurns += s.turnCount
    if (Number.isFinite(s.toolCallCount)) row.totalToolCalls += s.toolCallCount
    if (sessionHasCommit(s)) row.sessionsWithCommit += 1
    // True commit count: prefer commitCount; a hasCommit-only session counts
    // as 1 (lower bound when the host exposes the flag but not the count).
    if (typeof s.commitCount === 'number' && Number.isFinite(s.commitCount)) {
      row.totalCommits += Math.max(0, s.commitCount)
    } else if (s.hasCommit === true) {
      row.totalCommits += 1
    }

    switch (s.outcome) {
      case 'resolved':
        row.outcomes.resolved += 1
        break
      case 'partial':
        row.outcomes.partial += 1
        break
      case 'failed':
        row.outcomes.failed += 1
        break
      default:
        row.outcomes.unknown += 1
    }

    const wk = weekKey(s.startTime)
    if (wk !== null) weeks.add(wk)

    const dk = dayKey(s.startTime)
    if (dk !== null) {
      if (row.firstSeen === null || dk < row.firstSeen) row.firstSeen = dk
      if (row.lastSeen === null || dk > row.lastSeen) row.lastSeen = dk
    }
  }

  return [...byId.values()]
    .map((row) => ({
      ...row,
      activeWeeks: weeksById.get(row.contributorId)?.size ?? 0,
    }))
    .sort(
      (a, b) =>
        b.sessions - a.sessions || a.contributorId.localeCompare(b.contributorId),
    )
}

/**
 * resolvedRate — the share of a contributor's KNOWN-outcome sessions that
 * resolved. Unknown-outcome sessions are excluded from the denominator (an
 * unrecorded outcome is not a non-resolution); `null` when no session has a
 * known outcome, so callers can render a placeholder instead of a false 0%.
 * @param {OutcomeDistribution} outcomes
 * @returns {number | null}
 */
export function resolvedRate(outcomes) {
  const known = outcomes.total - outcomes.unknown
  if (known <= 0) return null
  return outcomes.resolved / known
}

/**
 * sessionStats — median + p90 of the four core numeric session fields across
 * the input. A convenience wrapper around `medianAndP90` for the "typical vs.
 * tail" card in `ProjectOverview`.
 * @param {AnalyticsSessionRecord[]} sessions
 * @returns {SessionStats}
 */
export function sessionStats(sessions) {
  return {
    durationMins: medianAndP90(sessions.map((s) => s.durationMins)),
    totalTokens: medianAndP90(sessions.map((s) => s.totalTokens)),
    turnCount: medianAndP90(sessions.map((s) => s.turnCount)),
    toolCallCount: medianAndP90(sessions.map((s) => s.toolCallCount)),
  }
}

/**
 * computeProjectAnalytics — run every metric over a session list and assemble
 * the `ProjectAnalytics` bundle. Pure: no React, no I/O. This is what
 * `ProjectOverview` calls internally when handed raw records.
 * @param {AnalyticsSessionRecord[]} sessions
 * @returns {ProjectAnalytics}
 */
export function computeProjectAnalytics(sessions) {
  /** @type {Set<string>} */
  const contributors = new Set()
  /** @type {Set<string>} */
  const projects = new Set()
  for (const s of sessions) {
    if (s.contributorId) contributors.add(s.contributorId)
    if (s.projectKey) projects.add(s.projectKey)
  }
  return {
    totalSessions: sessions.length,
    totalContributors: contributors.size,
    totalProjects: projects.size,
    sessionsPerWeek: sessionsPerWeek(sessions),
    weeklyActiveContributors: weeklyActiveContributors(sessions),
    returningContributorRate: returningContributorRate(sessions),
    longestStreak: longestStreak(sessions),
    newContributorVelocity: newContributorVelocity(sessions),
    sessionToCommitRate: sessionToCommitRate(sessions),
    avgDurationPerActiveWeek: avgDurationPerActiveWeek(sessions),
    outcomeDistribution: outcomeDistribution(sessions),
    sessionStats: sessionStats(sessions),
    perContributorBreakdown: perContributorBreakdown(sessions),
  }
}

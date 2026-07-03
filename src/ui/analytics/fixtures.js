// @ts-check
/* Shared fixtures for the analytics surface: the metric tests, the Storybook
   stories and the demo all render from this deterministic session set. A
   small, hand-checkable fixture with known time buckets, contributors,
   outcomes and commit linkage, plus a builder so tests can stamp out
   variations without re-declaring the whole shape inline.

   Week buckets used below (UTC, Monday-of-week keys):
     2026-01-05 ← Mon 2026-01-05 .. Sun 2026-01-11
     2026-01-12 ← Mon 2026-01-12 .. Sun 2026-01-18
     2026-01-19 ← Mon 2026-01-19 .. Sun 2026-01-25 */

/** @typedef {import('./types.js').AnalyticsSessionRecord} AnalyticsSessionRecord */

/**
 * Stamp an AnalyticsSessionRecord, overriding only the fields a caller cares
 * about.
 * @param {Partial<AnalyticsSessionRecord> & { id: string }} over
 * @returns {AnalyticsSessionRecord}
 */
export function makeSession(over) {
  return {
    startTime: '2026-01-05T10:00:00Z',
    projectKey: 'proj-a',
    contributorId: 'alice',
    durationMins: 30,
    totalTokens: 10_000,
    turnCount: 12,
    toolCallCount: 8,
    outcome: 'resolved',
    hasCommit: false,
    ...over,
  }
}

/**
 * A deterministic 8-session fixture spanning three consecutive weeks with three
 * contributors. Hand-derived expectations live next to the tests.
 *
 * | id | week start  | contributor | outcome   | commit |
 * |----|-------------|-------------|-----------|--------|
 * | s1 | 2026-01-05  | alice       | resolved  | yes(2) |
 * | s2 | 2026-01-05  | bob         | failed    | no     |
 * | s3 | 2026-01-12  | alice       | partial   | yes(1) |
 * | s4 | 2026-01-12  | carol       | resolved  | no     |
 * | s5 | 2026-01-12  | bob         | resolved  | yes(3) |
 * | s6 | 2026-01-19  | alice       | resolved  | no     |
 * | s7 | 2026-01-19  | alice       | (none)    | yes(1) |
 * | s8 | 2026-01-19  | carol       | failed    | no     |
 *
 * @type {AnalyticsSessionRecord[]}
 */
export const SAMPLE_SESSIONS = [
  makeSession({ id: 's1', startTime: '2026-01-05T09:00:00Z', contributorId: 'alice', outcome: 'resolved', commitCount: 2, durationMins: 20, totalTokens: 5_000, turnCount: 10, toolCallCount: 4 }),
  makeSession({ id: 's2', startTime: '2026-01-07T15:00:00Z', contributorId: 'bob', outcome: 'failed', hasCommit: false, durationMins: 40, totalTokens: 20_000, turnCount: 25, toolCallCount: 18 }),
  makeSession({ id: 's3', startTime: '2026-01-13T11:00:00Z', contributorId: 'alice', outcome: 'partial', commitCount: 1, durationMins: 60, totalTokens: 30_000, turnCount: 30, toolCallCount: 22 }),
  makeSession({ id: 's4', startTime: '2026-01-14T11:00:00Z', contributorId: 'carol', outcome: 'resolved', hasCommit: false, durationMins: 15, totalTokens: 8_000, turnCount: 6, toolCallCount: 3 }),
  makeSession({ id: 's5', startTime: '2026-01-15T18:00:00Z', contributorId: 'bob', outcome: 'resolved', commitCount: 3, durationMins: 35, totalTokens: 12_000, turnCount: 14, toolCallCount: 9 }),
  makeSession({ id: 's6', startTime: '2026-01-19T08:00:00Z', contributorId: 'alice', outcome: 'resolved', hasCommit: false, durationMins: 25, totalTokens: 9_000, turnCount: 11, toolCallCount: 7 }),
  makeSession({ id: 's7', startTime: '2026-01-21T08:00:00Z', contributorId: 'alice', outcome: undefined, commitCount: 1, durationMins: 50, totalTokens: 18_000, turnCount: 20, toolCallCount: 15 }),
  makeSession({ id: 's8', startTime: '2026-01-22T20:00:00Z', contributorId: 'carol', outcome: 'failed', hasCommit: false, durationMins: 10, totalTokens: 4_000, turnCount: 5, toolCallCount: 2 }),
]

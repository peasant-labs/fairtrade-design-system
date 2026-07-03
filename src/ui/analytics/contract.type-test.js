// @ts-check
/* Contract type-test for the analytics surface payload (ProjectOverview). It
   imports the ACTUAL production sub-barrel (the surface every adapter + host
   imports) and asserts, at the type level, the load-bearing guarantees of the
   cooked prop payload. Enforced by:
     pnpm test:contract
   which runs: tsc -p tsconfig.contract.json (strict:true, noImplicitAny:true,
   noEmit). This file + types.js are wired into that program, so a contract
   leak — or a SYNTAX error in types.js — FAILS the build gate. */

/** @typedef {import('./index.js').AnalyticsSessionOutcome} AnalyticsSessionOutcome */
/** @typedef {import('./index.js').ProjectOverviewSectionKey} ProjectOverviewSectionKey */
/** @typedef {import('./index.js').AnalyticsSessionRecord} AnalyticsSessionRecord */
/** @typedef {import('./index.js').AnalyticsOverviewPayload} AnalyticsOverviewPayload */
/** @typedef {import('./index.js').ProjectOverviewSections} ProjectOverviewSections */
/** @typedef {import('./index.js').ProjectAnalytics} ProjectAnalytics */

import { ANALYTICS_SESSION_OUTCOMES, PROJECT_OVERVIEW_SECTION_KEYS, computeProjectAnalytics } from './index.js'

/* ── (1) enum-value arrays are genuine runtime exports, typed by the union ────── */

/** @type {AnalyticsSessionOutcome} */
const firstOutcome = ANALYTICS_SESSION_OUTCOMES[0]
void firstOutcome
/** @type {ProjectOverviewSectionKey} */
const firstSection = PROJECT_OVERVIEW_SECTION_KEYS[0]
void firstSection

/* ── (2) POSITIVE: a valid raw-records payload ────────────────────────────────── */
/** @type {AnalyticsSessionRecord} */
const record = {
  id: 's1',
  startTime: '2026-01-05T09:00:00Z',
  projectKey: 'proj-a',
  contributorId: 'alice',
  durationMins: 20,
  totalTokens: 5_000,
  turnCount: 10,
  toolCallCount: 4,
  outcome: 'resolved',
  commitCount: 2,
}

/** @type {AnalyticsOverviewPayload} */
const rawPayload = { sessions: [record] }
void rawPayload

/* ── (3) POSITIVE: a pre-computed payload (host ran the metrics itself) ───────── */
/** @type {ProjectAnalytics} */
const bundle = computeProjectAnalytics([record])
/** @type {AnalyticsOverviewPayload} */
const cookedPayload = { analytics: bundle }
void cookedPayload

/* ── (4) POSITIVE: host-level section visibility uses the typed keys ──────────── */
/** @type {ProjectOverviewSections} */
const sections = { contributorTable: false, newContributorVelocity: false }
void sections

/* ── (5) NEGATIVE: contract violations must FAIL the gate ─────────────────────── */

/** @type {AnalyticsSessionRecord} */
const badOutcome = {
  ...record,
  // @ts-expect-error — 'succeeded' is not an AnalyticsSessionOutcome ('resolved' | 'partial' | 'failed')
  outcome: 'succeeded',
}
void badOutcome

/** @type {AnalyticsSessionRecord} */
const badTime = {
  ...record,
  // @ts-expect-error — startTime is an ISO string, not epoch millis
  startTime: 1_700_000_000_000,
}
void badTime

/** @type {ProjectOverviewSections} */
const badSection = {
  // @ts-expect-error — 'kpis' is not a ProjectOverviewSectionKey
  kpis: false,
}
void badSection

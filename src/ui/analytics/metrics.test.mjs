#!/usr/bin/env node
/* Re-runnable teeth-tests for the analytics metric core (metrics.js, stats.js,
   time.js, format.js). These pure functions power every number the
   ProjectOverview dashboard shows, so their behavior is asserted against the
   named YAML case corpus in testdata/metrics-cases.yaml — the same
   testdata-with-named-cases fixture pattern as the peasant repo's
   pkg/schema/testdata/ suites — so a regression cannot silently reshape a
   chart, and new cases are data, not code.

   Run: `pnpm test:analytics` (also wired into build:lib). Runner is
   dependency-light (node:assert + the yaml parser); the case shapes are
   documented at the top of the YAML file. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import {
  avgDurationPerActiveWeek,
  computeProjectAnalytics,
  longestStreak,
  newContributorVelocity,
  outcomeDistribution,
  perContributorBreakdown,
  resolvedRate,
  returningContributorRate,
  sessionHasCommit,
  sessionStats,
  sessionToCommitRate,
  sessionsPerWeek,
  weeklyActiveContributors,
} from './metrics.js'
import { medianAndP90, median, percentile } from './stats.js'
import { weekKey, dayKey, daysBetween } from './time.js'
import { formatNumberPair, formatTokenPair, formatTokens } from './format.js'
import { PROJECT_OVERVIEW_SECTION_DEFS, PROJECT_OVERVIEW_SECTION_KEYS } from './types.js'
import { SAMPLE_SESSIONS, makeSession } from './fixtures.js'

let failed = 0
const check = (name, fn) => {
  try {
    fn()
    console.log('PASS', name)
  } catch (e) {
    console.error('FAIL', name, '—', e.message)
    failed++
  }
}

/* ── the YAML case harness ─────────────────────────────────────────────────────
   Functions addressable from a case's `fn`, and the named session corpora a
   case's args may reference via `{ corpus: <name> }`. */

const FNS = {
  weekKey, dayKey, daysBetween,
  median, percentile, medianAndP90,
  sessionHasCommit, sessionsPerWeek, weeklyActiveContributors,
  returningContributorRate, longestStreak, newContributorVelocity,
  sessionToCommitRate, avgDurationPerActiveWeek, outcomeDistribution,
  resolvedRate, sessionStats, perContributorBreakdown, computeProjectAnalytics,
  formatTokens, formatNumberPair, formatTokenPair,
}

const CORPORA = {
  sample: SAMPLE_SESSIONS,
  empty: [],
}

/* Resolve one YAML arg: `{ corpus }` → shared corpus; `{ sessions: [...] }` →
   partial rows through makeSession defaults; `{ session: {...} }` → one record. */
const resolveArg = (arg) => {
  if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
    if ('corpus' in arg) {
      assert.ok(arg.corpus in CORPORA, `unknown corpus "${arg.corpus}"`)
      return CORPORA[arg.corpus]
    }
    if ('sessions' in arg) return arg.sessions.map((partial) => makeSession(partial))
    if ('session' in arg) return makeSession(arg.session)
  }
  return arg
}

const isApprox = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && 'approx' in v

/* Structural matcher. Exact mode (`expected`) checks key sets; subset mode
   (`expect` / `rows[].expect`) checks only the listed keys. Any expected leaf
   may be `{ approx, eps? }` for float comparison. */
const matchValue = (actual, expected, subset, path) => {
  if (isApprox(expected)) {
    const eps = expected.eps ?? 1e-6
    assert.ok(
      typeof actual === 'number' && Math.abs(actual - expected.approx) < eps,
      `${path}: ${actual} !≈ ${expected.approx}`,
    )
    return
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path}: expected an array, got ${typeof actual}`)
    assert.equal(actual.length, expected.length, `${path}: length ${actual.length} !== ${expected.length}`)
    expected.forEach((item, i) => matchValue(actual[i], item, subset, `${path}[${i}]`))
    return
  }
  if (expected !== null && typeof expected === 'object') {
    assert.ok(actual !== null && typeof actual === 'object', `${path}: expected an object, got ${actual}`)
    if (!subset) {
      assert.deepEqual(
        Object.keys(actual).sort(),
        Object.keys(expected).sort(),
        `${path}: key sets differ`,
      )
    }
    for (const [key, value] of Object.entries(expected)) {
      matchValue(actual[key], value, subset, `${path}.${key}`)
    }
    return
  }
  assert.strictEqual(actual, expected, `${path}: ${actual} !== ${expected}`)
}

const CASES = parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'testdata', 'metrics-cases.yaml'), 'utf8'),
)

for (const testCase of CASES.cases) {
  check(testCase.name, () => {
    const fn = FNS[testCase.fn]
    assert.ok(fn, `unknown fn "${testCase.fn}" — add it to the FNS registry`)
    const result = fn(...(testCase.args ?? []).map(resolveArg))
    let asserted = false
    if ('expected' in testCase) {
      matchValue(result, testCase.expected, false, '$')
      asserted = true
    }
    if ('expect' in testCase) {
      matchValue(result, testCase.expect, true, '$')
      asserted = true
    }
    if ('expected_length' in testCase) {
      assert.equal(result.length, testCase.expected_length, `$.length: ${result.length} !== ${testCase.expected_length}`)
      asserted = true
    }
    for (const row of testCase.rows ?? []) {
      matchValue(result[row.index], row.expect, true, `$[${row.index}]`)
      asserted = true
    }
    assert.ok(asserted, 'case has no expectation (expected / expect / expected_length / rows)')
  })
}

/* ── structural + property checks (relationships between exports — these stay
      code because they compare live values to each other, not to data) ─────── */

check('section KEYS derive from DEFS — same set, same order, labelled, unique', () => {
  assert.deepEqual(
    [...PROJECT_OVERVIEW_SECTION_KEYS],
    PROJECT_OVERVIEW_SECTION_DEFS.map((def) => def.key),
  )
  assert.equal(PROJECT_OVERVIEW_SECTION_KEYS.length, 8)
  assert.equal(new Set(PROJECT_OVERVIEW_SECTION_KEYS).size, 8)
  for (const def of PROJECT_OVERVIEW_SECTION_DEFS) {
    assert.ok(typeof def.label === 'string' && def.label.length > 0, `label missing for ${def.key}`)
  }
})

check('outcomeDistribution buckets always sum to total', () => {
  const dist = outcomeDistribution(SAMPLE_SESSIONS)
  assert.equal(dist.resolved + dist.partial + dist.failed + dist.unknown, dist.total)
})

check('computeProjectAnalytics assembles every metric + the totals', () => {
  const bundle = computeProjectAnalytics(SAMPLE_SESSIONS)
  assert.equal(bundle.totalSessions, 8)
  assert.equal(bundle.totalContributors, 3)
  assert.equal(bundle.totalProjects, 1)
  assert.deepEqual(bundle.sessionsPerWeek, sessionsPerWeek(SAMPLE_SESSIONS))
  assert.deepEqual(bundle.outcomeDistribution, outcomeDistribution(SAMPLE_SESSIONS))
  assert.deepEqual(bundle.perContributorBreakdown, perContributorBreakdown(SAMPLE_SESSIONS))
})

if (failed > 0) {
  console.error(`\n${failed} analytics metric test(s) FAILED`)
  process.exit(1)
}
console.log('\nall analytics metric tests passed')

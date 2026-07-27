#!/usr/bin/env node
/* Fixture-backed ranking performance gate. It generates the declared payload,
   discards warmups, compares median-of-nine measurements with user-facing
   absolute budgets, then proves the evaluator rejects deliberate over-budget
   intrinsic and interaction work. The computation split itself is covered by
   the ranking fixture and its source-mutation gate. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import YAML from 'yaml'
import { deriveRankedRows, rankMapNodesIntrinsic } from '../src/ui/graph/ranking.js'

const fixture = parseOne(readFileSync(new URL('./testdata/code-map-ranking-bench.yaml', import.meta.url), 'utf8'), 'ranking benchmark fixture')
const manifest = parseOne(readFileSync(new URL('./testdata/code-map-ranking-bench.manifest.yaml', import.meta.url), 'utf8'), 'ranking benchmark manifest')

const EXPECTED_GUARD_NAMES = [
  'intrinsic absolute ceiling',
  'rederivation absolute ceiling',
  'deliberate intrinsic over-budget rejection',
  'deliberate rederivation over-budget rejection',
]

assert.deepEqual(Object.keys(fixture).sort(), ['cases', 'expectedCaseCount'], 'benchmark fixture root shape')
assert.deepEqual(Object.keys(manifest).sort(), ['caseNames', 'expectedCaseCount', 'expectedGuardCount', 'guardNames'], 'benchmark manifest root shape')
assert.equal(fixture.cases.length, fixture.expectedCaseCount, 'benchmark fixture case count')
assert.equal(manifest.caseNames.length, manifest.expectedCaseCount, 'benchmark manifest case count')
assert.deepEqual(fixture.cases.map((testCase) => testCase.name), manifest.caseNames, 'benchmark fixture and manifest names')
assert.equal(manifest.expectedGuardCount, EXPECTED_GUARD_NAMES.length, 'benchmark manifest expected guard count')
assert.deepEqual(manifest.guardNames, EXPECTED_GUARD_NAMES, 'benchmark manifest guard names')

const testCase = fixture.cases[0]
assert.deepEqual(Object.keys(testCase).sort(), ['ceilingsMs', 'deliberateSlowdownFactor', 'generator', 'measurement', 'name'], 'benchmark case shape')
assert.equal(testCase.ceilingsMs.intrinsic, 100, 'intrinsic ceiling must remain the 100ms user-facing budget')
assert.equal(testCase.ceilingsMs.rederivation, 16, 'interaction re-derivation ceiling must remain the 16ms user-facing budget')
assert.equal(testCase.measurement.discardedWarmups, 2, 'benchmark discards exactly two warmups')
assert.equal(testCase.measurement.measuredRuns, 9, 'benchmark takes exactly nine measured runs')
assert.equal(testCase.measurement.statistic, 'median', 'benchmark uses the median')

const nodes = generateNodes(testCase.generator)
assert.equal(nodes.length, 10000, 'benchmark payload must contain exactly 10,000 nodes')

let intrinsic
const intrinsicMs = measure(() => {
  intrinsic = rankMapNodesIntrinsic(nodes, { rankMode: 'relevance', nowMs: testCase.generator.nowMs })
  return intrinsic.rows.length
}, testCase.measurement)
assert.ok(intrinsic, 'intrinsic ranking must be available for re-derivation')
assert.equal(intrinsic.rows.length, nodes.length, 'intrinsic ranking must return one row per generated node')
const interactionOptions = {
  focusId: 'node-05000',
  hoveredOrSelectedSessionId: 'active-session',
}
const firstDerivedRows = deriveRankedRows(intrinsic, interactionOptions)
const secondDerivedRows = deriveRankedRows(intrinsic, interactionOptions)
assert.equal(firstDerivedRows.length, nodes.length, 'interaction re-derivation must return one row per generated node')
assert.deepEqual(firstDerivedRows, secondDerivedRows, 'interaction re-derivation output must be deterministic')
const rederivationMs = measure(() => deriveRankedRows(intrinsic, interactionOptions).length, testCase.measurement)

assertWithinBudgets({ intrinsicMs, rederivationMs }, testCase)
assert.throws(() => assertWithinBudgets({
  intrinsicMs: testCase.ceilingsMs.intrinsic * testCase.deliberateSlowdownFactor,
  rederivationMs: 0,
}, testCase), /intrinsic median .* exceeds/, 'intrinsic over-budget proof')
assert.throws(() => assertWithinBudgets({
  intrinsicMs: 0,
  rederivationMs: testCase.ceilingsMs.rederivation * testCase.deliberateSlowdownFactor,
}, testCase), /re-derivation median .* exceeds/, 're-derivation over-budget proof')

console.log(`code-map ranking benchmark: intrinsic ${intrinsicMs.toFixed(3)}ms, re-derivation ${rederivationMs.toFixed(3)}ms; 2 warmups discarded, median of 9; both deliberate over-budget ceilings rejected`)

function generateNodes(generator) {
  return Array.from({ length: generator.nodeCount }, (_, index) => {
    const id = `node-${String(index).padStart(5, '0')}`
    const parentIndex = index === 0 ? null : Math.floor((index - 1) / generator.branchFactor)
    return {
      id,
      name: `${id}.go`,
      parent: parentIndex === null ? null : `node-${String(parentIndex).padStart(5, '0')}`,
      touchCount: (index * 37) % 211,
      effortDensity: ((index * 17) % 100) / 100,
      agentEditedCount: index % 5 === 0 ? 0 : 4,
      readCount: index % 7,
      readAttribution: index % 19 === 0 ? 'unavailable' : index % 11 === 0 ? 'partial' : 'complete',
      readState: index % 23 === 0 ? 'viewed' : index % 29 === 0 ? 'reviewed' : 'none',
      changedRegionCount: index % 6,
      attributedRegionCount: index % 6 === 0 ? 0 : (index % 6) - 1,
      reviewedRegionCount: index % 6 < 3 ? 0 : 1,
      lastTouchMs: generator.nowMs - (index % 365) * 86400000,
      recentSessionId: index % generator.activeSessionEvery === 0 ? 'active-session' : 'other-session',
    }
  })
}

function measure(operation, discipline) {
  for (let index = 0; index < discipline.discardedWarmups; index += 1) operation()
  const samples = []
  let sink = 0
  for (let index = 0; index < discipline.measuredRuns; index += 1) {
    const started = performance.now()
    sink += operation()
    samples.push(performance.now() - started)
  }
  if (sink < 0) throw new Error('unreachable benchmark sink')
  samples.sort((left, right) => left - right)
  return samples[Math.floor(samples.length / 2)]
}

function assertWithinBudgets(measured, configured) {
  assert.ok(measured.intrinsicMs <= configured.ceilingsMs.intrinsic, `intrinsic median ${measured.intrinsicMs.toFixed(3)}ms exceeds ${configured.ceilingsMs.intrinsic}ms`)
  assert.ok(measured.rederivationMs <= configured.ceilingsMs.rederivation, `re-derivation median ${measured.rederivationMs.toFixed(3)}ms exceeds ${configured.ceilingsMs.rederivation}ms`)
}

function parseOne(text, label) {
  const documents = YAML.parseAllDocuments(text, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (errors.length) throw new Error(`${label} has invalid strict YAML or a duplicate key: ${errors.map((error) => error.message).join('; ')}`)
  if (documents.length !== 1) throw new Error(`${label} must contain exactly one YAML document`)
  return documents[0].toJS()
}

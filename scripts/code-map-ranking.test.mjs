#!/usr/bin/env node
/* Fixture-driven coverage for src/ui/graph/ranking.js:
   the debt/coverage/hunkClears comprehension-debt formula, the three
   path-conditioned partial-read hover renderings, DOI ordering +
   the degenerate/tie-break cases, threshold gating (floor 5 / cap 25), and
   the SCENT_TAGS exhaustiveness guard. Fixture-based, non-vacuous: every
   guard below is exercised by scripts/code-map-ranking.mutations.mjs. */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import {
  debtState, debt, coverage, hunkClears, partialReadHoverText, debtHoverText, scentTagsFor,
  rankMapNodesIntrinsic, deriveRankedRows, rankMapNodes, gateRankedRows, SCENT_TAGS,
} from '../src/ui/graph/ranking.js'

const fixtureSource = readFileSync(new URL('./testdata/code-map-ranking.yaml', import.meta.url), 'utf8')
const manifestSource = readFileSync(new URL('./testdata/code-map-ranking.manifest.yaml', import.meta.url), 'utf8')
const fixture = parseOne(fixtureSource, 'code-map ranking fixture')
const manifest = parseOne(manifestSource, 'code-map ranking manifest')

const allNames = [
  ...fixture.debtCases.map((c) => c.name),
  ...fixture.hoverCases.map((c) => c.name),
  ...fixture.tooltipCases.map((c) => c.name),
  ...fixture.rankingCases.map((c) => c.name),
  ...fixture.gatingCases.map((c) => c.name),
  ...fixture.splitCases.map((c) => c.name),
  ...fixture.adapterCases.map((c) => c.name),
  fixture.scentExhaustiveness.name,
  fixture.literalPin.name,
]
if (manifest.expectedCaseCount !== allNames.length) {
  throw new Error(`manifest expectedCaseCount (${manifest.expectedCaseCount}) does not match the fixture's actual case count (${allNames.length})`)
}
if (fixture.expectedCaseCount !== allNames.length) {
  throw new Error(`fixture expectedCaseCount (${fixture.expectedCaseCount}) does not match its own case count (${allNames.length})`)
}
const nameSet = new Set(allNames)
if (nameSet.size !== allNames.length) throw new Error('fixture has a duplicate case name')
for (const name of manifest.caseNames) if (!nameSet.has(name)) throw new Error(`manifest declares a case name absent from the fixture: ${name}`)
for (const name of allNames) if (!manifest.caseNames.includes(name)) throw new Error(`fixture declares a case name absent from the manifest: ${name}`)

for (const testCase of fixture.debtCases) {
  const state = debtState(testCase.node)
  assert.equal(state, testCase.expectDebtState, `${testCase.name}: debtState`)
  assert.equal(debt(testCase.node, state), testCase.expectDebt, `${testCase.name}: debt`)
  assert.equal(coverage(testCase.node), testCase.expectCoverage, `${testCase.name}: coverage`)
  assert.equal(hunkClears(testCase.node), testCase.expectHunkClears, `${testCase.name}: hunkClears`)
  if (testCase.expectScentTags) {
    assert.deepEqual(scentTagsFor(testCase.node, state), testCase.expectScentTags, `${testCase.name}: scent tags`)
  }
}

for (const testCase of fixture.hoverCases) {
  assert.equal(partialReadHoverText(testCase.node), testCase.expectHover, testCase.name)
}

for (const testCase of fixture.tooltipCases) {
  const state = debtState(testCase.node)
  assert.equal(state, testCase.expectDebtState, `${testCase.name}: debt state`)
  assert.equal(debtHoverText(testCase.node, state), testCase.expectTooltip, `${testCase.name}: tooltip`)
}

for (const testCase of fixture.rankingCases) {
  const rows = rankMapNodes(testCase.nodes, testCase.options)
  if (testCase.expectOrder) assert.deepEqual(rows.map((row) => row.id), testCase.expectOrder, `${testCase.name}: order`)
  if (testCase.expectAllDOIZero) assert.ok(rows.every((row) => row.doi === 0), `${testCase.name}: every row's DOI must be 0`)
  if (testCase.expectDOI) {
    assert.deepEqual(Object.fromEntries(rows.map((row) => [row.id, row.doi])), testCase.expectDOI, `${testCase.name}: exact DOI terms`)
  }
}

for (const testCase of fixture.gatingCases) {
  let rows = testCase.rows
  if (testCase.nodes) rows = rankMapNodes(testCase.nodes, testCase.rankOptions)
  if (!rows) {
    const nodes = []
    for (let i = 0; i < testCase.count; i += 1) {
      const padded = String(i).padStart(3, '0')
      nodes.push(testCase.doi === 'uniform-high'
        ? {
          id: `n${padded}`, name: `n${padded}`, touchCount: 0, effortDensity: 0, agentEditedCount: 1, readCount: 0,
          readAttribution: 'complete', readState: 'none', changedRegionCount: 0, attributedRegionCount: 0, reviewedRegionCount: 0,
        }
        : {
          id: `n${padded}`, name: `n${padded}`, touchCount: 0, effortDensity: 0, agentEditedCount: 0, readCount: 0,
          readAttribution: 'complete', readState: 'none', changedRegionCount: 0, attributedRegionCount: 0, reviewedRegionCount: 0,
        })
    }
    rows = rankMapNodes(nodes)
  }
  const gated = gateRankedRows(rows, testCase.options)
  if (testCase.expectVisibleCount !== undefined) assert.equal(gated.visible.length, testCase.expectVisibleCount, `${testCase.name}: visible count`)
  if (testCase.expectOverflowCount !== undefined) assert.equal(gated.overflowCount, testCase.expectOverflowCount, `${testCase.name}: overflow count`)
  if (testCase.expectVisibleIds) assert.deepEqual(gated.visible.map((row) => row.id), testCase.expectVisibleIds, `${testCase.name}: visible ids`)
}

const graphMapSource = readFileSync(new URL('../src/mockups/inuse/GraphMap.jsx', import.meta.url), 'utf8')
for (const testCase of fixture.splitCases) {
  const intrinsic = rankMapNodesIntrinsic(testCase.nodes, testCase.intrinsicOptions)
  const before = intrinsic.rows.map((row) => row.intrinsic)
  const first = deriveRankedRows(intrinsic, testCase.firstOptions)
  const second = deriveRankedRows(intrinsic, testCase.secondOptions)
  assert.deepEqual(intrinsic.rows.map((row) => row.intrinsic), before, `${testCase.name}: intrinsic terms stay unchanged`)
  assert.deepEqual(tagsById(first, testCase.expectFirstTags), testCase.expectFirstTags, `${testCase.name}: first context tags`)
  assert.deepEqual(tagsById(second, testCase.expectSecondTags), testCase.expectSecondTags, `${testCase.name}: second context tags`)
  for (const needle of testCase.sourceMustContain) assert.ok(graphMapSource.includes(needle), `${testCase.name}: GraphMap must contain ${JSON.stringify(needle)}`)
}

for (const testCase of fixture.adapterCases) {
  let thrown
  try {
    rankMapNodesIntrinsic([testCase.node])
  } catch (error) {
    thrown = error
  }
  assert.ok(thrown, `${testCase.name}: invalid adapter value must throw`)
  for (const needle of testCase.expectErrorContains) assert.ok(thrown.message.includes(needle), `${testCase.name}: error must contain ${JSON.stringify(needle)}`)
}

{
  const derivedTags = new Set()
  for (const derivation of fixture.scentExhaustiveness.derivations) {
    const context = { ...(derivation.context ?? {}) }
    if (context.parentOf) context.parentOf = new Map(Object.entries(context.parentOf))
    const state = debtState(derivation.node)
    const tags = scentTagsFor(derivation.node, state, context)
    assert.ok(tags.includes(derivation.tag), `${fixture.scentExhaustiveness.name}: expected tag ${JSON.stringify(derivation.tag)}, got ${JSON.stringify(tags)}`)
    derivedTags.add(derivation.tag)
  }
  for (const tag of SCENT_TAGS) {
    assert.ok(derivedTags.has(tag), `SCENT_TAGS exhaustiveness: ${JSON.stringify(tag)} has no derivation case in the fixture`)
  }
  assert.equal(SCENT_TAGS.length, 7, 'SCENT_TAGS must have exactly 7 members')
}

{
  const { node, expectDebtLiteral } = fixture.literalPin
  const state = debtState(node)
  assert.equal(debt(node, state), expectDebtLiteral, 'literal pin: unattributable-hunk-excluded-blocks-hunk-clear debt magnitude')
  assert.equal(expectDebtLiteral, 0.1, 'the fixture itself must pin the literal 0.1, not a re-derivation of COVERAGE_CAP')
}

console.log(`code-map ranking: ${allNames.length} fixture cases (${fixture.debtCases.length} debt, ${fixture.hoverCases.length} path copy, ${fixture.tooltipCases.length} honesty tooltip, ${fixture.rankingCases.length} ordering, ${fixture.gatingCases.length} gating, ${fixture.splitCases.length} computation split, ${fixture.adapterCases.length} adapter, 1 scent-exhaustiveness, 1 literal-pin) passed`)

function tagsById(rows, expected) {
  return Object.fromEntries(Object.keys(expected).map((id) => [id, rows.find((row) => row.id === id)?.scentTags ?? null]))
}

function parseOne(text, label) {
  const documents = YAML.parseAllDocuments(text, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (errors.length) throw new Error(`${label} has invalid strict YAML or a duplicate key: ${errors.map((error) => error.message).join('; ')}`)
  if (documents.length !== 1) throw new Error(`${label} must contain exactly one YAML document`)
  return documents[0].toJS()
}

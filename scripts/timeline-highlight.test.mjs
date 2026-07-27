#!/usr/bin/env node
/* Hover/select agreement matrix for
   deriveTimelineHighlight/resolveEscapeAction: hover-only, select-only,
   hover-over-selection (returned independently, selection never cleared by
   hover), the Escape sequence (clears hover then selection), the keyboard
   path (focus drives the same hover action as pointer hover), and deep-link
   hydration of a selected session. Fixture-based, mutation-proved.

   Run: `node scripts/timeline-highlight.test.mjs` (wired into build:lib). */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import YAML from 'yaml'
import { createCodeMapState, reduceCodeMapState, deriveTimelineHighlight, resolveEscapeAction } from '../src/ui/graph/codeMapState.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CODE_MAP_STATE_PATH = resolve(ROOT, 'src/ui/graph/codeMapState.js')
const GRAPH_DIR = resolve(ROOT, 'src/ui/graph')

const fixture = parseOne(readFileSync(resolve(HERE, 'testdata/timeline-highlight.yaml'), 'utf8'), 'timeline-highlight fixture')
const manifest = parseOne(readFileSync(resolve(HERE, 'testdata/timeline-highlight.manifest.yaml'), 'utf8'), 'timeline-highlight manifest')

if (manifest.expectedCaseCount !== manifest.caseNames.length) throw new Error('manifest expectedCaseCount does not match its own caseNames length')
if (fixture.expectedCaseCount !== manifest.expectedCaseCount) throw new Error('fixture expectedCaseCount does not match the manifest')
if (fixture.cases.length !== fixture.expectedCaseCount) throw new Error(`fixture must contain exactly ${fixture.expectedCaseCount} cases`)
const fixtureNames = new Set(fixture.cases.map((c) => c.name))
if (fixtureNames.size !== fixture.cases.length) throw new Error('fixture has a duplicate case name')
for (const name of manifest.caseNames) if (!fixtureNames.has(name)) throw new Error(`manifest declares a case name absent from the fixture: ${name}`)
for (const name of fixtureNames) if (!manifest.caseNames.includes(name)) throw new Error(`fixture declares a case name absent from the manifest: ${name}`)

/** @param {ReturnType<typeof deriveTimelineHighlight>['selected']} actual @param {object} expected */
function assertHighlight(actual, expected, label) {
  assert.equal(actual.sessionId, expected.sessionId, `${label}: sessionId`)
  assert.deepEqual(actual.commitHashes, expected.commitHashes, `${label}: commitHashes`)
  assert.deepEqual(actual.ghostHashes, expected.ghostHashes, `${label}: ghostHashes`)
}

function runCase(testCase, { deriveTimelineHighlight: derive, resolveEscapeAction: escape, reduceCodeMapState: reduce, createCodeMapState: create }, sources) {
  if (testCase.expect) {
    const state = create(testCase.state)
    const highlight = derive(fixture.payload, state)
    assertHighlight(highlight.selected, testCase.expect.selected, `${testCase.name}: selected`)
    assertHighlight(highlight.hovered, testCase.expect.hovered, `${testCase.name}: hovered`)
    return
  }
  if (testCase.steps) {
    let state = create(testCase.initial)
    for (const [index, step] of testCase.steps.entries()) {
      const action = escape(state)
      assert.deepEqual(action, step.expectAction, `${testCase.name}: step ${index} action`)
      if (action) state = reduce(state, action)
      assert.equal(state.hoveredSessionId, step.expectAfter.hoveredSessionId, `${testCase.name}: step ${index} hoveredSessionId`)
      assert.equal(state.selectedSessionId, step.expectAfter.selectedSessionId, `${testCase.name}: step ${index} selectedSessionId`)
    }
    return
  }
  if (testCase.sourceCheck) {
    const text = sources[testCase.sourceCheck.file]
    for (const needle of testCase.sourceCheck.mustContainAll) {
      assert.ok(text.includes(needle), `${testCase.name}: ${testCase.sourceCheck.file} must contain ${JSON.stringify(needle)}`)
    }
    return
  }
  if (testCase.hydrateState) {
    const state = create(testCase.hydrateState)
    assert.equal(state.selectedSessionId, testCase.expectSelectedSessionId, `${testCase.name}: selectedSessionId survives createCodeMapState hydration`)
    // A deep link is a round-trip through JSON (route state / URL), not just
    // an object literal -- prove hydration survives that boundary too.
    const rehydrated = create(JSON.parse(JSON.stringify(state)))
    assert.equal(rehydrated.selectedSessionId, testCase.expectSelectedSessionId, `${testCase.name}: selectedSessionId survives a JSON round-trip`)
    return
  }
  throw new Error(`${testCase.name}: fixture case has no recognized shape`)
}

const liveSources = { 'SessionLane.jsx': readFileSync(resolve(GRAPH_DIR, 'SessionLane.jsx'), 'utf8') }
for (const testCase of fixture.cases) runCase(testCase, { deriveTimelineHighlight, resolveEscapeAction, reduceCodeMapState, createCodeMapState }, liveSources)
console.log(`timeline highlight: ${fixture.cases.length} fixture cases passed`)

// ── mutation guards ──────────────────────────────────────────────────────────
let killed = 0
for (const mutation of manifest.mutationCases) {
  const testCase = fixture.cases.find((c) => c.name === mutation.case)
  if (!testCase) throw new Error(`mutation ${JSON.stringify(mutation.name)} references an unknown case ${JSON.stringify(mutation.case)}`)
  if (mutation.file) {
    // Source-text mutation, checked against the SessionLane.jsx snapshot -- no
    // module import needed for this case (it only ever runs a sourceCheck).
    const original = liveSources[mutation.file]
    const occurrences = original.split(mutation.find).length - 1
    if (occurrences !== 1) throw new Error(`mutation ${JSON.stringify(mutation.name)}: find text must occur exactly once in ${mutation.file}, found ${occurrences}`)
    const mutatedSources = { ...liveSources, [mutation.file]: original.replace(mutation.find, mutation.replace) }
    let threw = false
    try {
      runCase(testCase, { deriveTimelineHighlight, resolveEscapeAction, reduceCodeMapState, createCodeMapState }, mutatedSources)
    } catch {
      threw = true
    }
    if (!threw) throw new Error(`mutation ${JSON.stringify(mutation.name)} survived`)
    killed += 1
    continue
  }
  // codeMapState.js mutation: patch the file on disk, dynamically import the
  // mutant module (ESM bindings from the real file are read-only, so a live
  // const/function can't be monkeypatched from outside), then restore it.
  const original = readFileSync(CODE_MAP_STATE_PATH, 'utf8')
  const occurrences = original.split(mutation.find).length - 1
  if (occurrences !== 1) throw new Error(`mutation ${JSON.stringify(mutation.name)}: find text must occur exactly once in codeMapState.js, found ${occurrences}`)
  const { writeFileSync } = await import('node:fs')
  writeFileSync(CODE_MAP_STATE_PATH, original.replace(mutation.find, mutation.replace))
  let threw = false
  try {
    const mutant = await import(CODE_MAP_STATE_PATH + `?t=${Date.now()}`)
    try {
      runCase(testCase, mutant, liveSources)
    } catch {
      threw = true
    }
  } finally {
    writeFileSync(CODE_MAP_STATE_PATH, original)
  }
  if (!threw) throw new Error(`mutation ${JSON.stringify(mutation.name)} survived`)
  killed += 1
}
console.log(`timeline highlight: ${killed} mutation(s) killed (each named guard genuinely reddens)`)

function parseOne(text, label) {
  const documents = YAML.parseAllDocuments(text, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (errors.length) throw new Error(`${label} has invalid strict YAML or a duplicate key: ${errors.map((error) => error.message).join('; ')}`)
  if (documents.length !== 1) throw new Error(`${label} must contain exactly one YAML document`)
  return documents[0].toJS()
}

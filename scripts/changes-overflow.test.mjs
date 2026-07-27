#!/usr/bin/env node
/* Mounted production-path verification for the Changes -> CommitGraph linked
 * session overflow. Fixture-owned payloads cover the controlled disclosure,
 * navigation action, and safe state pruning when a commit loses its overflow. */

import assert from 'node:assert/strict'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import YAML from 'yaml'
import { Changes } from '../dist/lib/graph.js'
import { assertTimelineNavigationAction } from '../src/ui/graph/timelineNavigation.js'

const fixture = loadStrictYaml('testdata/changes-overflow.yaml')
const manifest = loadStrictYaml('testdata/changes-overflow.manifest.yaml')
validateManifest(manifest)
validateFixture(fixture, manifest)

for (const testCase of fixture.cases) {
  const mutated = structuredClone(fixture)
  mutated.cases.find((candidate) => candidate.name === testCase.name).name = `removed_${testCase.name}`
  assert.throws(() => validateFixture(mutated, manifest), /missing required behavior family/, `${testCase.name}: fixture name mutation must be rejected`)
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://fairtrade.invalid/changes' })
const previousGlobals = new Map()
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver,
  MouseEvent: dom.window.MouseEvent,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
})) {
  previousGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

try {
  for (const testCase of fixture.cases) await assertOverflowCase(testCase)
  console.log(`changes overflow: ${fixture.cases.length} mounted fixture case passed against the built production Changes composition`)
} finally {
  dom.window.close()
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor === undefined) delete globalThis[key]
    else Object.defineProperty(globalThis, key, descriptor)
  }
}

async function assertOverflowCase(testCase) {
  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  const actions = []
  let replacePayload
  const { expect: expectation } = testCase

  function Harness() {
    const [payload, setPayload] = React.useState(testCase.payload)
    replacePayload = setPayload
    return React.createElement(Changes, {
      payload,
      nowMs: 1770001000000,
      onNavigate: (action) => actions.push(action),
    })
  }

  try {
    await act(async () => root.render(React.createElement(Harness)))
    assertVisibleSessionState(container, expectation, false, testCase.name)

    const disclosure = overflowToggle(container, expectation, testCase.name)
    await act(async () => disclosure.click())
    assertVisibleSessionState(container, expectation, true, testCase.name)

    const thirdSession = sessionButton(container, expectation.thirdSessionTitle)
    await act(async () => thirdSession.click())
    assert.deepEqual(actions, [expectation.expectedNavigation], `${testCase.name}: third linked session navigation`)

    await act(async () => overflowToggle(container, expectation, testCase.name).click())
    assertVisibleSessionState(container, expectation, false, testCase.name)

    await act(async () => overflowToggle(container, expectation, testCase.name).click())
    assertVisibleSessionState(container, expectation, true, testCase.name)
    await act(async () => replacePayload(testCase.afterPayload))
    await act(async () => {})
    assert.equal(findOverflowToggle(container, expectation), undefined, `${testCase.name}: overflow control must disappear when the commit no longer overflows`)

    await act(async () => replacePayload(testCase.payload))
    await act(async () => {})
    assertVisibleSessionState(container, expectation, false, testCase.name)
  } finally {
    await act(async () => root.unmount())
  }
}

function assertVisibleSessionState(container, expectation, expanded, label) {
  const disclosure = overflowToggle(container, expectation, label)
  assert.equal(disclosure.getAttribute('aria-expanded'), String(expanded), `${label}: overflow aria-expanded`)
  for (const title of expectation.inlineTitles) {
    assert.ok(sessionButton(container, title), `${label}: inline session ${JSON.stringify(title)} must remain visible`)
  }
  const third = findSessionButton(container, expectation.thirdSessionTitle)
  assert.equal(Boolean(third), expanded, `${label}: third linked session visibility`)
}

function overflowToggle(container, expectation, label) {
  const toggle = findOverflowToggle(container, expectation)
  if (!toggle) throw new Error(`${label}: missing overflow toggle ${JSON.stringify(expectation.toggleLabel)}`)
  return toggle
}

function findOverflowToggle(container, expectation) {
  const row = container.querySelector(`.cg-history-row[data-commit-hash="${expectation.commitHash}"]`)
  return [...(row?.querySelectorAll('.tlp-overflow-toggle') ?? [])].find((button) => button.getAttribute('aria-label') === expectation.toggleLabel)
}

function sessionButton(container, title) {
  const button = findSessionButton(container, title)
  if (!button) throw new Error(`Changes overflow fixture could not find linked session ${JSON.stringify(title)}`)
  return button
}

function findSessionButton(container, title) {
  return [...container.querySelectorAll('.cg-session, .tlp-overflow-item')].find((button) => button.textContent.includes(title))
}

function validateManifest(value) {
  assertExactFields(value, ['expectedCaseCount', 'caseNames'], 'manifest')
  assert.equal(value.expectedCaseCount, value.caseNames.length, 'manifest expectedCaseCount')
  assert.equal(new Set(value.caseNames).size, value.caseNames.length, 'manifest case names must be unique')
}

function validateFixture(value, manifestValue) {
  assertExactFields(value, ['expectedCaseCount', 'cases'], 'fixture')
  assert.equal(value.expectedCaseCount, manifestValue.expectedCaseCount, 'fixture expectedCaseCount')
  assert.equal(value.cases.length, value.expectedCaseCount, 'fixture case count')
  const names = new Set()
  for (const [index, testCase] of value.cases.entries()) {
    const label = `fixture.cases[${index}]`
    assertExactFields(testCase, ['name', 'payload', 'afterPayload', 'expect'], label)
    assert.equal(typeof testCase.name, 'string', `${label}: name must be a string`)
    assert.ok(testCase.name.length > 0 && !names.has(testCase.name), `${label}: name must be non-empty and unique`)
    names.add(testCase.name)
    validatePayload(testCase.payload, `${label}.payload`)
    validatePayload(testCase.afterPayload, `${label}.afterPayload`)
    validateExpectation(testCase.expect, `${label}.expect`)
  }
  for (const required of manifestValue.caseNames) assert.ok(names.has(required), `fixture: missing required behavior family ${required}`)
}

function validatePayload(payload, label) {
  assertExactFields(payload, ['repoFound', 'defaultBranch', 'changes', 'recentCommits', 'sessions'], label)
  assert.ok(Array.isArray(payload.changes) && Array.isArray(payload.recentCommits) && Array.isArray(payload.sessions), `${label}: graph collections must be arrays`)
  for (const [index, commit] of payload.recentCommits.entries()) {
    assertExactFields(commit, ['hash', 'subject', 'timeMs', 'hasSession', 'sessionIds'], `${label}.recentCommits[${index}]`)
    assert.ok(Array.isArray(commit.sessionIds), `${label}.recentCommits[${index}]: sessionIds must be an array`)
  }
  for (const [index, session] of payload.sessions.entries()) {
    assertExactFields(session, ['sessionId', 'title', 'harness', 'startMs', 'hasCommitBinding'], `${label}.sessions[${index}]`)
  }
}

function validateExpectation(value, label) {
  assertExactFields(value, ['commitHash', 'toggleLabel', 'inlineTitles', 'thirdSessionTitle', 'expectedNavigation'], label)
  assert.ok(Array.isArray(value.inlineTitles) && value.inlineTitles.length === 2, `${label}: exactly two inline titles are required`)
  assertTimelineNavigationAction(value.expectedNavigation)
}

function assertExactFields(value, fields, label) {
  const actual = Object.keys(value ?? {}).sort()
  const expected = fields.slice().sort()
  assert.deepEqual(actual, expected, `${label}: fields must be exact`)
}

function loadStrictYaml(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) throw new Error(`${relativePath}: expected one strict YAML document with unique keys`)
  return document.toJS()
}

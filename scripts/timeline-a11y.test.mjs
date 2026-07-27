#!/usr/bin/env node
/* Per-new-control keyboard/aria parity guard: an
   accessible name, native (Enter/Space) activation, aria-expanded/aria-pressed/
   aria-checked where applicable, and an aria-live announcement on state
   change. Renders the REAL production components from dist/lib/graph.js
   (renderToStaticMarkup, same convention as smoke-map.mjs) at two controlled
   prop states per control, so "on state change" is asserted as a genuine
   before/after comparison, not a single snapshot.

   Run: `node scripts/timeline-a11y.test.mjs` (wired into build:lib, after the lib build). */

import assert from 'node:assert/strict'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import YAML from 'yaml'
import { SessionLane, GhostGroup, SessionOverflowDisclosure, RankModeControl, ScentTag } from '../dist/lib/graph.js'

const h = React.createElement

const fixture = parseOne(readFileSync(new URL('./testdata/timeline-a11y.yaml', import.meta.url), 'utf8'), 'timeline-a11y fixture')
const manifest = parseOne(readFileSync(new URL('./testdata/timeline-a11y.manifest.yaml', import.meta.url), 'utf8'), 'timeline-a11y manifest')

if (manifest.expectedCaseCount !== manifest.caseNames.length) throw new Error('manifest expectedCaseCount does not match its own caseNames length')
if (fixture.expectedCaseCount !== manifest.expectedCaseCount) throw new Error('fixture expectedCaseCount does not match the manifest')
if (fixture.cases.length !== fixture.expectedCaseCount) throw new Error(`fixture must contain exactly ${fixture.expectedCaseCount} cases`)
const fixtureNames = new Set(fixture.cases.map((c) => c.name))
if (fixtureNames.size !== fixture.cases.length) throw new Error('fixture has a duplicate case name')
for (const name of manifest.caseNames) if (!fixtureNames.has(name)) throw new Error(`manifest declares a case name absent from the fixture: ${name}`)
for (const name of fixtureNames) if (!manifest.caseNames.includes(name)) throw new Error(`fixture declares a case name absent from the manifest: ${name}`)
assertNamedCases(fixture.eventCases, fixture.expectedEventCaseCount, manifest.eventCaseNames, manifest.expectedEventCaseCount, 'event')
assertNamedCases(fixture.demoCases, fixture.expectedDemoCaseCount, manifest.demoCaseNames, manifest.expectedDemoCaseCount, 'demo')

/** Builds the two controlled-prop-state markups for a control. Pure rendering, no events. */
function renderStates(control) {
  if (control === 'session-lane') {
    const props = { sessionId: 'sess-doi', title: 'Add DOI ranking to the code map', harness: 'claude-code', onHover: () => {}, onSelect: () => {} }
    return {
      unselected: render(h(SessionLane, { ...props, selected: false })),
      selected: render(h(SessionLane, { ...props, selected: true })),
    }
  }
  if (control === 'ghost-group') {
    const ghosts = [
      { ghostHash: 'a1b2c3d4e5f6', subject: 'wip: draft', resolution: 'rewritten', method: 'patch_id', confidence: 'high' },
      { ghostHash: 'g7h8i9j0k1l2', subject: 'wip: fix', resolution: 'rewritten', method: 'author_identity', confidence: 'medium' },
    ]
    const props = { successorHash: 'a1b2c3d4e5f6789', ghosts, onToggle: () => {} }
    return {
      collapsed: render(h(GhostGroup, { ...props, expanded: false })),
      expanded: render(h(GhostGroup, { ...props, expanded: true })),
    }
  }
  if (control === 'session-overflow-disclosure') {
    const overflow = [
      { sessionId: 's1', title: 'session one', harness: 'gemini-cli' },
      { sessionId: 's2', title: 'session two', harness: 'codex' },
    ]
    const props = { commitHash: 'c1', overflow, onToggle: () => {}, itemLabel: 'sessions' }
    return {
      collapsed: render(h(SessionOverflowDisclosure, { ...props, expanded: false })),
      expanded: render(h(SessionOverflowDisclosure, { ...props, expanded: true })),
    }
  }
  if (control === 'rank-mode-control') {
    return {
      relevance: render(h(RankModeControl, { rankMode: 'relevance', onChange: () => {} })),
      debt: render(h(RankModeControl, { rankMode: 'debt', onChange: () => {} })),
    }
  }
  if (control === 'scent-tag-filter') {
    const props = { tag: 'heavy churn', onToggle: () => {} }
    return {
      inactive: render(h(ScentTag, { ...props, active: false })),
      active: render(h(ScentTag, { ...props, active: true })),
    }
  }
  throw new Error(`timeline-a11y fixture: unknown control ${JSON.stringify(control)}`)
}

function runCase(testCase) {
  const states = renderStates(testCase.control)
  for (const [stateName, assertions] of Object.entries(testCase)) {
    if (stateName === 'name' || stateName === 'control') continue
    const markup = states[stateName]
    if (markup === undefined) throw new Error(`${testCase.name}: fixture declares an unknown state ${JSON.stringify(stateName)} for control ${testCase.control}`)
    for (const needle of assertions.mustContain ?? []) assert.ok(markup.includes(needle), `${testCase.name} (${stateName}): markup must contain ${JSON.stringify(needle)}`)
    for (const needle of assertions.mustNotContain ?? []) assert.ok(!markup.includes(needle), `${testCase.name} (${stateName}): markup must NOT contain ${JSON.stringify(needle)}`)
  }
}

for (const testCase of fixture.cases) runCase(testCase)
console.log(`timeline a11y: ${fixture.cases.length} fixture cases passed against the built production components`)

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://fairtrade.invalid/map' })
const previousGlobals = new Map()
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver,
  KeyboardEvent: dom.window.KeyboardEvent,
  MouseEvent: dom.window.MouseEvent,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
})) {
  previousGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

for (const testCase of fixture.eventCases) await assertRankModeEvent(RankModeControl, testCase)
console.log(`timeline a11y: ${fixture.eventCases.length} fixture-backed rank-mode events passed`)

// ── mutation guards: patch the REAL source on disk, rebuild ONLY the graph
// entry with vite's own programmatic build() (the same toolchain that
// produces dist/lib/graph.js -- no extra bundler dependency), import the
// mutant build, and prove the same case reddens -- then restore the file. ──
const { build, createServer } = await import('vite')
const react = (await import('@vitejs/plugin-react')).default
const { readFileSync: readSrc, writeFileSync, rmSync } = await import('node:fs')
const { resolve, dirname } = await import('node:path')
const { fileURLToPath } = await import('node:url')
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const GRAPH_DIR = resolve(HERE, '../src/ui/graph')

let killed = 0
for (const mutation of manifest.mutationCases) {
  const testCase = mutation.case ? fixture.cases.find((c) => c.name === mutation.case) : null
  const eventCase = mutation.eventCase ? fixture.eventCases.find((c) => c.name === mutation.eventCase) : null
  if (!testCase && !eventCase) {
    throw new Error(`mutation ${JSON.stringify(mutation.name)} must reference one known static or event case`)
  }
  const realPath = resolve(GRAPH_DIR, mutation.file)
  const original = readSrc(realPath, 'utf8')
  const occurrences = original.split(mutation.find).length - 1
  if (occurrences !== 1) throw new Error(`mutation ${JSON.stringify(mutation.name)}: find text must occur exactly once in ${mutation.file}, found ${occurrences}`)
  const outDir = resolve(HERE, `.timeline-a11y-mutant-${mutation.name.replace(/[^a-z0-9]+/gi, '-')}`)
  writeFileSync(realPath, original.replace(mutation.find, mutation.replace))
  let threw = false
  try {
    await build({
      root: ROOT,
      logLevel: 'silent',
      plugins: [react()],
      build: {
        outDir,
        emptyOutDir: true,
        lib: { entry: resolve(GRAPH_DIR, 'index.js'), formats: ['es'], fileName: () => 'mutant.mjs' },
        rollupOptions: { external: ['@peasant-labs/schema', '@tanstack/react-table', 'lucide-react', 'react', 'react-dom', 'react/jsx-runtime', 'recharts'] },
        minify: false,
      },
    })
    const mutantModule = await import(resolve(outDir, 'mutant.mjs') + `?t=${Date.now()}`)
    try {
      if (eventCase) {
        await assertRankModeEvent(mutantModule.RankModeControl, eventCase)
      } else {
        const mutantStates = renderMutantStates(mutantModule, testCase.control)
        for (const [stateName, assertions] of Object.entries(testCase)) {
          if (stateName === 'name' || stateName === 'control') continue
          const markup = mutantStates[stateName]
          for (const needle of assertions.mustContain ?? []) assert.ok(markup.includes(needle))
          for (const needle of assertions.mustNotContain ?? []) assert.ok(!markup.includes(needle))
        }
      }
    } catch {
      threw = true
    }
    rmSync(outDir, { recursive: true, force: true })
  } finally {
    writeFileSync(realPath, original)
  }
  if (!threw) throw new Error(`mutation ${JSON.stringify(mutation.name)} survived its fixture-backed assertion`)
  killed += 1
}
console.log(`timeline a11y: ${killed} mutation(s) killed (each named guard genuinely reddens)`)

const server = await createServer({
  appType: 'custom',
  configFile: false,
  logLevel: 'silent',
  plugins: [react()],
  root: ROOT,
  server: { middlewareMode: true },
})
try {
  const { TimelineView } = await server.ssrLoadModule('/src/mockups/inuse/GraphMap.jsx')
  for (const testCase of fixture.demoCases) await assertMountedDemoCase(TimelineView, testCase)
  console.log(`timeline a11y: ${fixture.demoCases.length} mounted GraphMap interaction cases passed`)
} finally {
  await server.close()
  dom.window.close()
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor === undefined) delete globalThis[key]
    else Object.defineProperty(globalThis, key, descriptor)
  }
}

function renderMutantStates(mod, control) {
  if (control === 'session-lane') {
    const props = { sessionId: 'sess-doi', title: 'Add DOI ranking to the code map', harness: 'claude-code', onHover: () => {}, onSelect: () => {} }
    return { unselected: render(h(mod.SessionLane, { ...props, selected: false })), selected: render(h(mod.SessionLane, { ...props, selected: true })) }
  }
  if (control === 'ghost-group') {
    const ghosts = [
      { ghostHash: 'a1b2c3d4e5f6', subject: 'wip: draft', resolution: 'rewritten', method: 'patch_id', confidence: 'high' },
      { ghostHash: 'g7h8i9j0k1l2', subject: 'wip: fix', resolution: 'rewritten', method: 'author_identity', confidence: 'medium' },
    ]
    const props = { successorHash: 'a1b2c3d4e5f6789', ghosts, onToggle: () => {} }
    return { collapsed: render(h(mod.GhostGroup, { ...props, expanded: false })), expanded: render(h(mod.GhostGroup, { ...props, expanded: true })) }
  }
  if (control === 'session-overflow-disclosure') {
    const overflow = [
      { sessionId: 's1', title: 'session one', harness: 'gemini-cli' },
      { sessionId: 's2', title: 'session two', harness: 'codex' },
    ]
    const props = { commitHash: 'c1', overflow, onToggle: () => {}, itemLabel: 'sessions' }
    return { collapsed: render(h(mod.SessionOverflowDisclosure, { ...props, expanded: false })), expanded: render(h(mod.SessionOverflowDisclosure, { ...props, expanded: true })) }
  }
  if (control === 'rank-mode-control') {
    return { relevance: render(h(mod.RankModeControl, { rankMode: 'relevance', onChange: () => {} })), debt: render(h(mod.RankModeControl, { rankMode: 'debt', onChange: () => {} })) }
  }
  if (control === 'scent-tag-filter') {
    const props = { tag: 'heavy churn', onToggle: () => {} }
    return { inactive: render(h(mod.ScentTag, { ...props, active: false })), active: render(h(mod.ScentTag, { ...props, active: true })) }
  }
  throw new Error(`unknown control ${control}`)
}

async function assertRankModeEvent(Component, testCase) {
  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  const changes = []
  function Harness() {
    const [mode, setMode] = React.useState(testCase.initialMode)
    return h(Component, {
      rankMode: mode,
      onChange: (nextMode) => {
        changes.push(nextMode)
        setMode(nextMode)
      },
    })
  }
  try {
    await act(async () => root.render(h(Harness)))
    const initial = rankModeButton(container, testCase.initialMode)
    initial.focus()
    await act(async () => {
      initial.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: testCase.key, bubbles: true, cancelable: true }))
    })
    assert.equal(changes.at(-1), testCase.expectMode, `${testCase.name}: key event must activate the expected mode`)
    const active = rankModeButton(container, testCase.expectMode)
    assert.equal(active.getAttribute('aria-checked'), 'true', `${testCase.name}: expected mode must be checked`)
    assert.equal(dom.window.document.activeElement, rankModeButton(container, testCase.expectFocus), `${testCase.name}: focus must move with activation`)
    const tabStops = [...container.querySelectorAll('[role="radio"]')].filter((button) => button.tabIndex === 0)
    assert.deepEqual(tabStops.map((button) => button.textContent), [testCase.expectMode], `${testCase.name}: exactly the active mode must remain tabbable`)
  } finally {
    await act(async () => root.unmount())
  }
}

async function assertMountedDemoCase(TimelineView, testCase) {
  const container = dom.window.document.getElementById('root')
  const root = createRoot(container)
  try {
    await act(async () => root.render(h(TimelineView, { theme: 'dark' })))
    if (testCase.interaction === 'rank-mode-key') {
      const initial = rankModeButton(container, 'relevance')
      initial.focus()
      await act(async () => {
        initial.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: testCase.key, bubbles: true, cancelable: true }))
      })
      assert.equal(rankModeButton(container, testCase.expectMode).getAttribute('aria-checked'), 'true', `${testCase.name}: mounted mode must activate`)
      assert.equal(dom.window.document.activeElement, rankModeButton(container, testCase.expectFocus), `${testCase.name}: mounted focus must move`)
      return
    }
    if (testCase.interaction === 'session-filter') {
      const lane = [...container.querySelectorAll('.tlp-session-lane')].find((button) => button.textContent.includes(testCase.sessionTitle))
      if (!lane) throw new Error(`${testCase.name}: mounted demo is missing session lane ${JSON.stringify(testCase.sessionTitle)}`)
      await act(async () => {
        if (testCase.sessionGesture === 'hover') {
          lane.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true, cancelable: true }))
        } else {
          lane.click()
        }
      })
      const filter = [...container.querySelectorAll('.tlp-scent-filter')].find((button) => button.textContent.includes('edited this session'))
      if (!filter) throw new Error(`${testCase.name}: mounted demo is missing the edited-this-session filter`)
      await act(async () => filter.click())
      await act(async () => new Promise((resolveDelay) => setTimeout(resolveDelay, 75)))
      assert.equal(filter.getAttribute('aria-pressed'), 'true', `${testCase.name}: session scent filter must be active`)
      const rankedList = container.querySelector('[role="list"][aria-label="ranked files"]')
      if (!rankedList) throw new Error(`${testCase.name}: mounted demo is missing the ranked files list`)
      for (const row of testCase.expectRows) assert.ok(rankedList.textContent.includes(row), `${testCase.name}: expected ranked row ${row}`)
      for (const row of testCase.expectAbsentRows) assert.ok(!rankedList.textContent.includes(row), `${testCase.name}: unexpected ranked row ${row}`)
      return
    }
    if (testCase.interaction === 'highlight-edges') {
      const lane = [...container.querySelectorAll('.tlp-session-lane')].find((button) => button.textContent.includes(testCase.sessionTitle))
      if (!lane) throw new Error(`${testCase.name}: mounted demo is missing session lane ${JSON.stringify(testCase.sessionTitle)}`)
      await act(async () => lane.click())
      const edges = [...container.querySelectorAll(`.tlp-highlight-edge-${testCase.expectWeight}`)]
      assert.deepEqual(edges.map((edge) => edge.getAttribute('data-commit-hash')).sort(), testCase.expectCommitHashes)
      assert.ok(edges.every((edge) => edge.getAttribute('data-session-id') === 'sess-doi'), `${testCase.name}: every edge must retain its derived session id`)
      return
    }
    if (testCase.interaction === 'touched-files') {
      const commitRow = [...container.querySelectorAll('.cg-history-row')].find((row) => row.textContent.includes(testCase.commitMessage))
      if (!commitRow) throw new Error(`${testCase.name}: mounted demo is missing commit ${JSON.stringify(testCase.commitMessage)}`)
      const cluster = commitRow.querySelector('.tlp-file-cluster')
      if (!cluster) throw new Error(`${testCase.name}: mounted commit is missing its touched-file cluster`)
      const itemTexts = () => [...cluster.querySelectorAll('.tlp-file-cluster-item, .tlp-overflow-item')].map((item) => item.textContent)
      assert.deepEqual(itemTexts(), testCase.expectInline, `${testCase.name}: intrinsic order and inline cap`)
      const disclosure = cluster.querySelector('.tlp-overflow-toggle')
      assert.equal(disclosure?.getAttribute('aria-expanded'), 'false')
      await act(async () => disclosure.click())
      assert.equal(disclosure.getAttribute('aria-expanded'), 'true')
      assert.deepEqual(itemTexts(), [...testCase.expectInline, ...testCase.expectOverflow], `${testCase.name}: disclosed order`)
      return
    }
    if (testCase.interaction === 'ranked-show-all') {
      const list = container.querySelector('[role="list"][aria-label="ranked files"]')
      const disclosure = container.querySelector('[aria-controls="timeline-ranked-files"]')
      if (!list || !disclosure) throw new Error(`${testCase.name}: mounted ranked disclosure is missing`)
      assert.equal(list.children.length, testCase.expectCollapsedCount)
      assert.equal(disclosure.getAttribute('aria-expanded'), 'false')
      await act(async () => disclosure.click())
      assert.equal(list.children.length, testCase.expectExpandedCount)
      assert.equal(disclosure.getAttribute('aria-expanded'), 'true')
      await act(async () => disclosure.click())
      assert.equal(list.children.length, testCase.expectCollapsedCount)
      assert.equal(disclosure.getAttribute('aria-expanded'), 'false')
      return
    }
    if (testCase.interaction === 'honesty-tooltips') {
      const list = container.querySelector('[role="list"][aria-label="ranked files"]')
      for (const [file, tooltip] of Object.entries(testCase.expectations)) {
        const row = [...list.children].find((candidate) => candidate.textContent.includes(file))
        if (!row) throw new Error(`${testCase.name}: mounted ranked list is missing ${file}`)
        assert.equal(row.querySelector('.tlp-scent')?.getAttribute('title'), tooltip, `${testCase.name}: ${file}`)
      }
      return
    }
    throw new Error(`${testCase.name}: unknown mounted demo interaction ${JSON.stringify(testCase.interaction)}`)
  } finally {
    await act(async () => root.unmount())
  }
}

function rankModeButton(container, mode) {
  const button = [...container.querySelectorAll('[role="radio"]')].find((candidate) => candidate.textContent === mode)
  if (!button) throw new Error(`rank-mode fixture could not find ${JSON.stringify(mode)}`)
  return button
}

function assertNamedCases(cases, fixtureCount, manifestNames, manifestCount, label) {
  if (fixtureCount !== cases.length) throw new Error(`${label} fixture count does not match its cases`)
  if (manifestCount !== manifestNames.length || fixtureCount !== manifestCount) throw new Error(`${label} fixture count does not match its manifest`)
  const names = cases.map((testCase) => testCase.name)
  if (new Set(names).size !== names.length) throw new Error(`${label} fixture has a duplicate case name`)
  assert.deepEqual(names, manifestNames, `${label} fixture names must match the manifest in order`)
}

function parseOne(text, label) {
  const documents = YAML.parseAllDocuments(text, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (errors.length) throw new Error(`${label} has invalid strict YAML or a duplicate key: ${errors.map((error) => error.message).join('; ')}`)
  if (documents.length !== 1) throw new Error(`${label} must contain exactly one YAML document`)
  return documents[0].toJS()
}

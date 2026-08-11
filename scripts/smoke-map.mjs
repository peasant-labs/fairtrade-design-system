#!/usr/bin/env node
/* ───────────────────────────────────────────────────────────────────────────
   smoke-map — behavioral smoke for the lifted CodeMap / MapCanvas surface
   ─────────────────────────────────────────────────────────────────────────
   fairtrade has NO unit-test runner; its convention is node smoke scripts (see
   smoke-transcript-ui.mjs). This one imports the PRODUCTION `CodeMap` from the
   BUILT bundle (dist/lib/graph.js — the exact surface peasant/village import)
   and asserts per-behavior contract, not just "renders without throwing":

     • layer/order CONTRACT: a node payload carrying an explicit
       `layer` that diverges from its tree (parent-chain) depth lays out in
       that layer's ROW, not its depth's row; siblings sharing a row order by
       the explicit `order` field, not by payload/array position. Exercised
       with a SHUFFLED input array (so an input-order fallback would produce
       the WRONG rank) and a non-depth layer (a child pinned to the root row).
     • controlled grain (CodeMap's `zoom.level`) renders the matching MapCanvas
       grain (project→overview, package→folders, file→files).
     • expandedIds (`zoom.expanded`) widens the visible set past the grain's
       base depth.
     • highlightedIds marks the matching node `data-highlighted`.
     • nodeDeltas marks the matching node `data-delta`.
     • shared toolbar ownership: CodeMap renders the SAME MapCanvas toolbar
       (grain segmented control + node search) demo and app both mount — no
       app-local or demo-local reimplementation.
     • keyboard/roving-focus infrastructure (role=application, the aria-live
       region) is present on the rendered markup. Real key-press interaction
       (arrow-key roving focus, click-to-select) is executed and asserted by
       the MapCanvas Default/Overview/Violations Storybook play() functions,
       run for real in a browser by `pnpm sbsmoke` (wired into `build:lib`) —
       SSR (this script) cannot dispatch DOM events, so it asserts the STATIC
       contract; sbsmoke asserts the INTERACTIVE one. Together they are the
       executed package-level behavior gate for controlled grain/onGrainChange,
       expandedIds/onExpandedIdsChange, highlightedIds, nodeDeltas, keyboard
       nav, and shared toolbar ownership.

   Every assertion is written to BITE: breaking the corresponding production
   behavior turns its line red. Requires a prior `vite build` (same as
   smoke-lib.mjs); `build:lib` runs it after the bundle exists.

   Run: `node scripts/smoke-map.mjs` (or `pnpm smoke:map`).
   ─────────────────────────────────────────────────────────────────────────── */

import React from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import YAML from 'yaml'
import {
  CODE_MAP_STATE_VERSION,
  CODE_MAP_VIEWPORT_SCALE,
  CodeMap,
  CodeMapNavigator,
  codeMapStatesEqual,
  createCodeMapState,
  deriveCodeMapView,
  reduceCodeMapState,
} from '../dist/lib/graph.js'

/* The built UI export includes the browser-side character-reference decoder used by
   react-markdown. Install its minimal DOM before importing MapCanvas from that export. */
const importDom = new JSDOM('<!doctype html><html><body></body></html>')
for (const [key, value] of Object.entries({ window: importDom.window, document: importDom.window.document, navigator: importDom.window.navigator })) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
const { MapCanvas } = await import('../dist/lib/ui.js')

const h = React.createElement
const canonicalFixtureSource = readFileSync(new URL('./testdata/code-map-canonical.yaml', import.meta.url), 'utf8')
const canonicalFixtureDocument = YAML.parseDocument(canonicalFixtureSource, { strict: true, uniqueKeys: true })
if (canonicalFixtureDocument.errors.length) throw new Error(`canonical code-map fixture is invalid: ${canonicalFixtureDocument.errors.map((error) => error.message).join('; ')}`)
const canonicalFixture = canonicalFixtureDocument.toJS()
const interactionFixtureSource = readFileSync(new URL('./testdata/code-map-interactions.yaml', import.meta.url), 'utf8')
const interactionFixtureDocument = YAML.parseDocument(interactionFixtureSource, { strict: true, uniqueKeys: true })
if (interactionFixtureDocument.errors.length) throw new Error(`code-map interaction fixture is invalid: ${interactionFixtureDocument.errors.map((error) => error.message).join('; ')}`)
const interactionFixture = interactionFixtureDocument.toJS()

/** @type {{id:string, desc:string, ok:boolean}[]} */
const results = []
/** @param {string} id @param {string} desc @param {boolean} cond */
function assert(id, desc, cond) {
  results.push({ id, desc, ok: !!cond })
}

/** Render CodeMap to static markup; a throw yields '' so the assertion fails cleanly (red). */
function html(props) {
  try {
    return render(h(CodeMap, props))
  } catch (e) {
    console.error('  (render threw)', e.message)
    return ''
  }
}

function canvasHtml(props) {
  try {
    return render(h(MapCanvas, props))
  } catch (e) {
    console.error('  (canonical canvas render threw)', e.message)
    return ''
  }
}

/* find every `.mc-node` button's [left, top] position keyed by a caller-chosen unique
   substring of its aria-label (the leaf name), by scanning the raw SSR markup. Mirrors
   how a real consumer would locate a node without a DOM (grep the rendered attributes). */
function nodePositions(markup) {
  const positions = new Map()
  const buttonRe = /<button[^>]*class="mc-node"[^>]*>/g
  let m
  while ((m = buttonRe.exec(markup))) {
    const tag = m[0]
    const label = /aria-label="([^"]*)"/.exec(tag)?.[1]
    const style = /style="([^"]*)"/.exec(tag)?.[1]
    if (!label || !style) continue
    const left = /left:([\d.]+)px/.exec(style)?.[1]
    const top = /top:([\d.]+)px/.exec(style)?.[1]
    if (left === undefined || top === undefined) continue
    positions.set(label, { left: Number(left), top: Number(top) })
  }
  return positions
}
function posFor(positions, leafSubstring) {
  for (const [label, pos] of positions) if (label.startsWith(leafSubstring)) return pos
  return undefined
}

const NAVIGATOR_REQUIRED_CASE_NAMES = [
  'package grain is progressively disclosed',
  'file grain reaches a selected file',
  'filter retains the matching path and its ancestors',
  'disconnected node remains a discoverable root',
  'stale URL selection offers explicit recovery',
  'dense file filter retains a deep matching ancestry',
]
const NAVIGATOR_NODE_COUNT = 11
const NAVIGATOR_EDGE_COUNT = 7

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`)
  }
  return value
}

function requireFields(value, required, allowed, path) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknown.length) throw new Error(`${path} has unknown fields: ${unknown.join(', ')}`)
  const missing = required.filter((key) => !(key in value))
  if (missing.length) throw new Error(`${path} is missing required fields: ${missing.join(', ')}`)
}

function validateNavigatorFixture(source) {
  if ((source.match(/^---\s*$/gm) ?? []).length) {
    throw new Error('navigator fixture must contain exactly one YAML document')
  }
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length) {
    throw new Error(`navigator fixture is invalid YAML: ${document.errors.map((error) => error.message).join('; ')}`)
  }
  const fixture = requireObject(document.toJS(), 'navigator fixture root')
  const rootFields = ['expectedCaseCount', 'expectedNodeCount', 'expectedEdgeCount', 'cases', 'nodes', 'structureEdges', 'viewport']
  requireFields(fixture, rootFields, rootFields, 'navigator fixture root')
  if (fixture.expectedCaseCount !== NAVIGATOR_REQUIRED_CASE_NAMES.length) {
    throw new Error(`navigator fixture expectedCaseCount must equal independently defined ${NAVIGATOR_REQUIRED_CASE_NAMES.length}`)
  }
  if (fixture.expectedNodeCount !== NAVIGATOR_NODE_COUNT) {
    throw new Error(`navigator fixture expectedNodeCount must equal independently defined ${NAVIGATOR_NODE_COUNT}`)
  }
  if (fixture.expectedEdgeCount !== NAVIGATOR_EDGE_COUNT) {
    throw new Error(`navigator fixture expectedEdgeCount must equal independently defined ${NAVIGATOR_EDGE_COUNT}`)
  }
  if (!Array.isArray(fixture.cases) || fixture.cases.length !== NAVIGATOR_REQUIRED_CASE_NAMES.length) {
    throw new Error(`navigator fixture must contain ${NAVIGATOR_REQUIRED_CASE_NAMES.length} cases`)
  }
  const caseNames = new Set()
  const caseAllowed = ['name', 'grain', 'expandedIds', 'selectedId', 'filter', 'focusedId', 'expectedVisible', 'expectedHidden', 'expectedTabbable', 'expectShowChildren', 'expectMissingStatus']
  const caseRequired = ['name', 'grain', 'expectedVisible', 'expectedHidden', 'expectedTabbable', 'expectShowChildren', 'expectMissingStatus']
  for (const [index, rawCase] of fixture.cases.entries()) {
    const testCase = requireObject(rawCase, `navigator fixture cases[${index}]`)
    requireFields(testCase, caseRequired, caseAllowed, `navigator fixture cases[${index}]`)
    if (typeof testCase.name !== 'string' || testCase.name === '') throw new Error(`navigator fixture cases[${index}].name must be non-empty`)
    if (caseNames.has(testCase.name)) throw new Error(`navigator fixture duplicates case name ${JSON.stringify(testCase.name)}`)
    caseNames.add(testCase.name)
    if (!['project', 'package', 'file'].includes(testCase.grain)) throw new Error(`navigator fixture ${testCase.name} has invalid grain`)
    if (!Array.isArray(testCase.expectedVisible) || !Array.isArray(testCase.expectedHidden)) throw new Error(`navigator fixture ${testCase.name} requires visibility arrays`)
    if (typeof testCase.expectedTabbable !== 'string' || typeof testCase.expectShowChildren !== 'boolean' || typeof testCase.expectMissingStatus !== 'boolean') {
      throw new Error(`navigator fixture ${testCase.name} has incomplete behavior expectations`)
    }
  }
  for (const name of NAVIGATOR_REQUIRED_CASE_NAMES) {
    if (!caseNames.has(name)) throw new Error(`navigator fixture is missing required behavior ${JSON.stringify(name)}`)
  }

  if (!Array.isArray(fixture.nodes) || fixture.nodes.length !== NAVIGATOR_NODE_COUNT) {
    throw new Error(`navigator fixture must contain ${NAVIGATOR_NODE_COUNT} nodes`)
  }
  const nodeIds = new Set()
  const nodeRequired = ['id', 'name', 'kind', 'loc', 'recordedFiles', 'totalFiles', 'order']
  const nodeAllowed = [...nodeRequired, 'parent']
  for (const [index, rawNode] of fixture.nodes.entries()) {
    const node = requireObject(rawNode, `navigator fixture nodes[${index}]`)
    requireFields(node, nodeRequired, nodeAllowed, `navigator fixture nodes[${index}]`)
    if (typeof node.id !== 'string' || node.id === '' || nodeIds.has(node.id)) throw new Error(`navigator fixture nodes[${index}] has an empty or duplicate id`)
    nodeIds.add(node.id)
  }
  for (const [index, node] of fixture.nodes.entries()) {
    if (node.parent != null && !nodeIds.has(node.parent)) throw new Error(`navigator fixture nodes[${index}] references missing parent ${node.parent}`)
  }

  if (!Array.isArray(fixture.structureEdges) || fixture.structureEdges.length !== NAVIGATOR_EDGE_COUNT) {
    throw new Error(`navigator fixture must contain ${NAVIGATOR_EDGE_COUNT} edges`)
  }
  const edgeIds = new Set()
  for (const [index, rawEdge] of fixture.structureEdges.entries()) {
    const edge = requireObject(rawEdge, `navigator fixture structureEdges[${index}]`)
    requireFields(edge, ['from', 'to', 'count'], ['from', 'to', 'count'], `navigator fixture structureEdges[${index}]`)
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) throw new Error(`navigator fixture structureEdges[${index}] references a missing node`)
    const identity = `${edge.from}->${edge.to}`
    if (edgeIds.has(identity)) throw new Error(`navigator fixture duplicates edge ${identity}`)
    edgeIds.add(identity)
  }
  const viewport = requireObject(fixture.viewport, 'navigator fixture viewport')
  requireFields(viewport, ['scale', 'panX', 'panY'], ['scale', 'panX', 'panY'], 'navigator fixture viewport')
  return fixture
}

function navigatorFixtureRejects(source) {
  try {
    validateNavigatorFixture(source)
    return false
  } catch {
    return true
  }
}

/* ── layer/order contract ───────────────────────────────────────────────────
   `internal` (module) parents `internal/pinned` (package) — normal tree depth would
   put internal/pinned a row BELOW the root row. `internal/pinned.layer = 0` pins it
   into the root row instead (the backend's deterministic layer, not tree depth).
   `web`/`cmd`/`internal/pinned` share layer 0; their `order` fields (3, 2, 1) rank
   them RIGHT to LEFT of their INPUT-ARRAY position (0, 3, 2) — an input-order
   fallback would rank them [web, pinned, cmd]; the order-field contract ranks them
   [pinned, cmd, web]. The input array itself is shuffled (web, internal, pinned, cmd)
   so array index cannot coincidentally produce the right answer either. */
const LAYER_ORDER_PAYLOAD = {
  repoFound: true,
  nodes: [
    { id: 'web', parent: undefined, kind: 'module', name: 'web-root', loc: 100, recordedFiles: 1, totalFiles: 2, order: 3 },
    { id: 'internal', parent: undefined, kind: 'module', name: 'internal-root', loc: 200, recordedFiles: 1, totalFiles: 2, order: 0 },
    { id: 'internal/pinned', parent: 'internal', kind: 'package', name: 'pinned-leaf', loc: 50, recordedFiles: 1, totalFiles: 1, layer: 0, order: 1 },
    { id: 'cmd', parent: undefined, kind: 'module', name: 'cmd-root', loc: 30, recordedFiles: 0, totalFiles: 1, order: 2 },
  ],
  structureEdges: [],
  violations: [],
}
{
  // grain=folders (zoom.level='package'): `internal` has one child, so it collapses
  // (renders internal/pinned instead); web/cmd have none, so they render themselves.
  const out = html({ payload: LAYER_ORDER_PAYLOAD, zoom: { level: 'package', expanded: [] }, ariaLabel: 'layer/order smoke' })
  const positions = nodePositions(out)
  const web = posFor(positions, 'web-root')
  const cmd = posFor(positions, 'cmd-root')
  const pinned = posFor(positions, 'pinned-leaf')
  assert('LAYER-all-present', 'all three visible nodes rendered', !!web && !!cmd && !!pinned)
  if (web && cmd && pinned) {
    assert(
      'LAYER-pinned-row',
      'internal/pinned.layer=0 pins it into the ROOT row (same top as web/cmd), not its tree-depth row',
      pinned.top === web.top && pinned.top === cmd.top,
    )
    assert(
      'ORDER-rank',
      'siblings in the row rank by the explicit `order` field (pinned < cmd < web), not input-array position (web < internal < pinned < cmd)',
      pinned.left < cmd.left && cmd.left < web.left,
    )
  }
}

/* ── row wrapping: a wide layer packs into stacked shelves, not one endless row ──
   Real projects routinely have 20-40+ siblings sharing a single tree depth (a
   repo's top-level folders, or a package's files); confirmed against real repos
   in the field, an unwrapped row degenerates into a single, unreadably wide
   canvas row (this is the user-reported "one very long row" failure). The fix
   packs a layer's siblings into stacked shelves once they would exceed the
   canvas's fixed shelf-width budget, so the map grows vertically instead. Eight
   equal-width root siblings (order 0..7, each pinned to the max node width via
   an identical high `loc`) forces exactly two shelves at the current geometry
   constants (4 nodes/shelf); three siblings comfortably fit in one. */
const WRAP_MANY_DATA = {
  nodes: Array.from({ length: 8 }, (_, i) => ({
    id: `wrap-${i}`, label: `wrap-${i}`, kind: 'folder', loc: 999999, coverage: 0, order: i,
  })),
  edges: [],
}
const WRAP_FEW_DATA = {
  nodes: Array.from({ length: 3 }, (_, i) => ({
    id: `few-${i}`, label: `few-${i}`, kind: 'folder', loc: 999999, coverage: 0, order: i,
  })),
  edges: [],
}
{
  const manyMarkup = canvasHtml({ data: WRAP_MANY_DATA, grain: 'overview', ariaLabel: 'wrap-many smoke' })
  const positions = nodePositions(manyMarkup)
  const tops = new Set(Array.from({ length: 8 }, (_, i) => posFor(positions, `wrap-${i}`)?.top).filter((t) => t !== undefined))
  assert('WRAP-many-shelves', 'eight equal-width siblings exceeding the shelf budget wrap into more than one shelf (top row), not one endless row',
    tops.size > 1)
  const shelf1 = posFor(positions, 'wrap-0')
  const shelf2Candidate = [...Array(8).keys()].map((i) => posFor(positions, `wrap-${i}`)).find((p) => p && shelf1 && p.top !== shelf1.top)
  assert('WRAP-shelf-stacks-vertically', 'a later shelf stacks strictly below the first shelf (top increases by a whole row), not beside it',
    !!shelf1 && !!shelf2Candidate && shelf2Candidate.top > shelf1.top)
  assert('WRAP-order-preserved-within-shelf', 'siblings packed into the SAME shelf still rank left-to-right by their explicit order',
    (() => {
      const p0 = posFor(positions, 'wrap-0')
      const p1 = posFor(positions, 'wrap-1')
      return !!p0 && !!p1 && p0.top === p1.top && p0.left < p1.left
    })())
}
{
  const fewMarkup = canvasHtml({ data: WRAP_FEW_DATA, grain: 'overview', ariaLabel: 'wrap-few smoke' })
  const positions = nodePositions(fewMarkup)
  const tops = new Set(Array.from({ length: 3 }, (_, i) => posFor(positions, `few-${i}`)?.top).filter((t) => t !== undefined))
  assert('WRAP-few-stays-one-shelf', 'three siblings well under the shelf budget stay on a single shelf (unaffected by wrapping)',
    tops.size === 1)
}

/* ── navigator-first progressive disclosure ────────────────────────────────── */
{
  const source = readFileSync(new URL('./testdata/code-map-navigator.yaml', import.meta.url), 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  assert('NAV-yaml-valid', 'navigator fixture is one strict YAML document with unique mapping keys', document.errors.length === 0 && !(source.match(/^---\s*$/gm) ?? []).length)
  const fixture = validateNavigatorFixture(source)
  const rootKeys = new Set(['expectedCaseCount', 'expectedNodeCount', 'expectedEdgeCount', 'cases', 'nodes', 'structureEdges', 'viewport'])
  const unknownRoot = Object.keys(fixture).filter((key) => !rootKeys.has(key))
  assert('NAV-known-root-fields', 'navigator fixture root uses only supported fields', unknownRoot.length === 0)
  const caseKeys = new Set(['name', 'grain', 'expandedIds', 'selectedId', 'filter', 'focusedId', 'expectedVisible', 'expectedHidden', 'expectedTabbable', 'expectShowChildren', 'expectMissingStatus'])
  const requiredCaseNames = NAVIGATOR_REQUIRED_CASE_NAMES
  const caseNames = new Set()
  for (const [index, testCase] of fixture.cases.entries()) {
    const unknown = Object.keys(testCase).filter((key) => !caseKeys.has(key))
    assert(`NAV-${index}-known-fields`, `navigator fixture case ${index} uses only supported fields`, unknown.length === 0)
    assert(`NAV-${index}-complete`, `navigator fixture case ${index} has a name, grain, and visibility expectations`,
      typeof testCase.name === 'string' && ['project', 'package', 'file'].includes(testCase.grain)
      && Array.isArray(testCase.expectedVisible) && Array.isArray(testCase.expectedHidden)
      && typeof testCase.expectedTabbable === 'string'
      && typeof testCase.expectShowChildren === 'boolean'
      && typeof testCase.expectMissingStatus === 'boolean')
    assert(`NAV-${index}-unique-name`, `navigator fixture case ${index} has a unique stable name`, !caseNames.has(testCase.name))
    caseNames.add(testCase.name)
  }
  assert('NAV-exact-case-count', 'navigator fixture declares exactly the required semantic families', fixture.expectedCaseCount === requiredCaseNames.length)
  for (const required of requiredCaseNames) {
    assert(`NAV-required-${required}`, `navigator fixture retains required behavior family ${required}`, caseNames.has(required))
    const mutatedSource = source.replace(`name: ${required}`, `name: removed ${required}`)
    assert(`NAV-mutation-${required}`, `renaming required behavior family ${required} is rejected by the production fixture validator`, navigatorFixtureRejects(mutatedSource))
  }
  const nodeKeys = new Set(['id', 'name', 'kind', 'parent', 'loc', 'recordedFiles', 'totalFiles', 'order'])
  const nodeIds = new Set()
  for (const [index, node] of fixture.nodes.entries()) {
    assert(`NAV-node-${index}-known-fields`, `navigator node ${index} uses only supported fields`, Object.keys(node).every((key) => nodeKeys.has(key)))
    assert(`NAV-node-${index}-unique-id`, `navigator node ${index} has a unique identity`, typeof node.id === 'string' && node.id !== '' && !nodeIds.has(node.id))
    nodeIds.add(node.id)
  }
  for (const [index, node] of fixture.nodes.entries()) {
    assert(`NAV-node-${index}-parent`, `navigator node ${index} references an existing parent`, node.parent == null || nodeIds.has(node.parent))
  }
  const edgeKeys = new Set(['from', 'to', 'count'])
  const edgeIds = new Set()
  for (const [index, edge] of fixture.structureEdges.entries()) {
    const identity = `${edge.from}->${edge.to}`
    assert(`NAV-edge-${index}-known-fields`, `navigator edge ${index} uses only supported fields`, Object.keys(edge).every((key) => edgeKeys.has(key)))
    assert(`NAV-edge-${index}-references`, `navigator edge ${index} references existing nodes`, nodeIds.has(edge.from) && nodeIds.has(edge.to))
    assert(`NAV-edge-${index}-unique`, `navigator edge ${index} is not duplicated`, !edgeIds.has(identity))
    edgeIds.add(identity)
  }
  const payload = { repoFound: true, nodes: fixture.nodes, structureEdges: fixture.structureEdges, violations: [] }
  const defaultState = createCodeMapState()
  const openedState = reduceCodeMapState(defaultState, { type: 'open-in-map', id: 'internal/ingest' })
  const stateView = deriveCodeMapView(payload, openedState)
  assert('STATE-version-export', 'the graph bundle exports the versioned code-map state contract', CODE_MAP_STATE_VERSION === 1 && defaultState.version === 1)
  assert('STATE-open-atomic', 'open-in-map atomically shares presentation, selection, and focus', openedState.presentation === 'canvas' && openedState.selectedId === 'internal/ingest' && openedState.navigatorFocusedId === 'internal/ingest')
  assert('STATE-derived-public-node', 'derived selected nodes contain no private navigator indexes', stateView.selected?.id === 'internal/ingest' && !('_index' in stateView.selected) && !('_depth' in stateView.selected))
  assert('NAV-fixture-count', 'navigator fixture executes every declared progressive-disclosure state', fixture.cases.length === fixture.expectedCaseCount)
  assert('NAV-node-count', 'navigator fixture executes the declared dense graph', fixture.nodes.length === fixture.expectedNodeCount)
  assert('NAV-edge-count', 'navigator fixture executes the declared dense edge set', fixture.structureEdges.length === fixture.expectedEdgeCount && fixture.structureEdges.length >= 6)
  const edgeBearing = html({ payload, zoom: { level: 'file', expanded: fixture.nodes.map((node) => node.id) } })
  const edgeRemoved = html({ payload: { ...payload, structureEdges: [] }, zoom: { level: 'file', expanded: fixture.nodes.map((node) => node.id) } })
  assert('NAV-edge-mutation', 'removing the fixture edge set changes the mounted production graph output', edgeBearing !== edgeRemoved)
  for (const testCase of fixture.cases) {
    const out = render(h(CodeMapNavigator, {
      payload,
      grain: testCase.grain,
      expandedIds: testCase.expandedIds ?? [],
      selectedId: testCase.selectedId ?? null,
      focusedId: testCase.focusedId ?? undefined,
      filter: testCase.filter ?? '',
    }))
    for (const id of testCase.expectedVisible) {
      assert(`NAV-${testCase.name}-${id}-visible`, `${testCase.name}: ${id} is visible`, out.includes(`>${id.split('/').at(-1)}<`))
    }
    for (const id of testCase.expectedHidden) {
      assert(`NAV-${testCase.name}-${id}-hidden`, `${testCase.name}: ${id} is hidden`, !out.includes(`>${id.split('/').at(-1)}<`))
    }
    const tabStops = out.match(/role="treeitem"[^>]*tabindex="0"/g) ?? []
    assert(`NAV-${testCase.name}-one-tabstop`, `${testCase.name}: exactly one visible tree row is tabbable`, tabStops.length === 1)
    const tabbableRow = /<div[^>]*role="treeitem"[^>]*tabindex="0"[^>]*>([\s\S]*?)<\/div>/.exec(out)?.[1] ?? ''
    assert(`NAV-${testCase.name}-focus-fallback`, `${testCase.name}: the expected visible row owns the tab stop`,
      tabbableRow.includes(`>${testCase.expectedTabbable.split('/').at(-1)}<`))
    assert(`NAV-${testCase.name}-grain-action`, `${testCase.name}: visible branches expose explicit child disclosure controls`,
      /(?:show|hide) children/.test(out) === Boolean(testCase.expectShowChildren))
    assert(`NAV-${testCase.name}-missing-status`, `${testCase.name}: stale selection recovery status matches the fixture`,
      out.includes('the selected code area is not present in this map') === testCase.expectMissingStatus)
  }
  const baseline = render(h(CodeMapNavigator, { payload }))
  assert('NAV-tree-semantics', 'the navigator exposes a tree with real treeitems', baseline.includes('role="tree"') && baseline.includes('role="treeitem"'))
  assert('NAV-filter-control', 'the navigator exposes a labeled filter input', baseline.includes('filter code areas'))
  const restoredCanvas = html({ payload, zoom: { level: 'file', expanded: ['internal', 'internal/ingest'] }, viewport: fixture.viewport })
  assert(
    'VIEWPORT-restored',
    'the canvas restores controlled scale and pan on its first render',
    restoredCanvas.includes(`translate(${fixture.viewport.panX}px, ${fixture.viewport.panY}px) scale(${fixture.viewport.scale})`),
  )
}

/* ── controlled grain (CodeMap.zoom.level → MapCanvas grain) ──────────────────── */
const GRAIN_PAYLOAD = {
  repoFound: true,
  nodes: [
    { id: 'mod', kind: 'module', name: 'mod', loc: 10, recordedFiles: 0, totalFiles: 1, order: 0 },
    { id: 'mod/pkg', parent: 'mod', kind: 'package', name: 'pkg', loc: 10, recordedFiles: 0, totalFiles: 1, order: 0 },
    { id: 'mod/pkg/leaf.go', parent: 'mod/pkg', kind: 'file', name: 'leaf.go', loc: 10, recordedFiles: 0, totalFiles: 1, order: 0 },
  ],
  structureEdges: [],
  violations: [],
}

/* Canonical state owns null as a real value. Contradictory legacy props must not
   reintroduce selection or a controlled viewport into the built consumer path. */
{
  const fixture = canonicalFixture.canonicalPrecedence
  const out = html({
    payload: fixture.payload,
    state: fixture.canonicalState,
    selectedId: fixture.contradictoryLegacy.selectedId,
    viewport: fixture.contradictoryLegacy.viewport,
  })
  assert('STATE-null-selection-precedence', 'canonical selectedId null overrides a contradictory legacy selection', !out.includes(fixture.expected.selectedMarkerAbsent))
  assert('STATE-null-viewport-automatic', 'canonical viewport null uses the automatic default transform', out.includes(fixture.expected.automaticTransform))
  assert('STATE-null-viewport-precedence', 'canonical viewport null ignores the contradictory legacy transform', !out.includes(fixture.expected.legacyTransformAbsent))
  assert('STATE-viewport-policy-export', 'the built graph bundle exports the shared viewport endpoint policy', CODE_MAP_VIEWPORT_SCALE.min === 0.35 && CODE_MAP_VIEWPORT_SCALE.max === 2.4)
}

{
  const fixture = canonicalFixture.hierarchyConflict
  const data = { nodes: fixture.nodes, edges: fixture.edges }
  const layoutMarkup = canvasHtml({
    data,
    hierarchy: fixture.hierarchy,
    visibleIds: fixture.layoutVisibleIds,
    grain: 'files',
  })
  const positions = nodePositions(layoutMarkup)
  const child = posFor(positions, fixture.expected.deeperNode)
  const other = posFor(positions, fixture.expected.shallowerNode)
  const orderedBefore = posFor(positions, fixture.expected.orderedBefore)
  const orderedAfter = posFor(positions, fixture.expected.orderedAfter)
  assert('STATE-canonical-depth', 'canonical hierarchy depth overrides contradictory raw layer values', !!child && !!other && child.top > other.top)
  assert('STATE-canonical-order', 'canonical orderedIds override contradictory raw order values', !!orderedBefore && !!orderedAfter && orderedBefore.left < orderedAfter.left)

  const resolutionMarkup = canvasHtml({
    data,
    hierarchy: fixture.hierarchy,
    visibleIds: fixture.resolutionVisibleIds,
    highlightedIds: fixture.highlightedIds,
    grain: 'files',
  })
  assert('STATE-canonical-parent-highlight', 'canonical parentage lifts a hidden child highlight to its derived parent', resolutionMarkup.includes('data-highlighted="true"'))
  assert('STATE-canonical-parent-violation', 'canonical parentage lifts hidden child violations to its derived parent', new RegExp(`aria-label="root:[^"]*${fixture.expected.violationCount} violations`).test(resolutionMarkup))
  assert('STATE-canonical-parent-edge', 'canonical parentage lifts the hidden child edge to one visible canonical edge', (resolutionMarkup.match(/<g class="mc-edge"/g) ?? []).length === 1)
}

{
  const parentDouble = interactionFixture.cases.find((testCase) => testCase.name === 'canvas parent double click selects then expands')
  const leafDouble = interactionFixture.cases.find((testCase) => testCase.name === 'canvas leaf double click selects once without expansion')
  const disclosureKeys = interactionFixture.cases.filter((testCase) => testCase.action.type === 'disclosure-key')
  const filterCase = interactionFixture.cases.find((testCase) => testCase.name === 'navigator deep filter forces open without persisted expansion')
  const parentOnly = interactionFixture.cases.find((testCase) => testCase.name === 'navigator parent only filter is not forced open')
  const selected = reduceCodeMapState(parentDouble.initialState, { type: 'select', id: parentDouble.action.targets[0] })
  const repeatedSelection = reduceCodeMapState(selected, { type: 'select', id: parentDouble.action.targets[0] })
  const expanded = reduceCodeMapState(repeatedSelection, { type: 'set-expanded', ids: [parentDouble.action.targets[0]] })
  assert('INTERACTION-immediate-selection', 'the built canonical reducer selects immediately on the first pointer semantic action', JSON.stringify(selected) === JSON.stringify(parentDouble.expectedStates[0]))
  assert('INTERACTION-equal-selection-suppressed', 'the built state equality contract identifies a repeated selection as non-publishable', codeMapStatesEqual(selected, repeatedSelection))
  assert('INTERACTION-double-click-sequence', 'the built compatibility sequence is exactly selection followed by expansion', JSON.stringify([selected, expanded]) === JSON.stringify(parentDouble.expectedStates))
  const leafSelected = reduceCodeMapState(leafDouble.initialState, { type: 'select', id: leafDouble.action.targets[0] })
  assert('INTERACTION-leaf-double-click', 'the built leaf compatibility sequence collapses to one selection and no expansion', codeMapStatesEqual(leafSelected, reduceCodeMapState(leafSelected, { type: 'select', id: leafDouble.action.targets[0] })) && JSON.stringify([leafSelected]) === JSON.stringify(leafDouble.expectedStates))

  const disclosureMarkup = html({ payload: interactionFixture.payload, state: parentDouble.initialState })
  assert('INTERACTION-public-disclosure', 'the built public CodeMap path renders a sibling canvas disclosure control', disclosureMarkup.includes('aria-label="show children for internal"'))
  const disclosureStart = disclosureMarkup.indexOf('<button type="button" class="mc-node-disclosure"')
  const nodeStart = disclosureMarkup.lastIndexOf('<button', disclosureStart - 1)
  const nodeTag = disclosureMarkup.slice(nodeStart, disclosureMarkup.indexOf('>', nodeStart) + 1)
  const disclosureTag = disclosureMarkup.slice(disclosureStart, disclosureMarkup.indexOf('>', disclosureStart) + 1)
  const nodeGeometry = inlineGeometry(nodeTag)
  const disclosureGeometry = inlineGeometry(disclosureTag)
  assert('INTERACTION-canvas-disclosure-sibling', 'the built canvas disclosure immediately follows its node instead of nesting inside it', /<\/button><button type="button" class="mc-node-disclosure"/.test(disclosureMarkup))
  assert('INTERACTION-canvas-disclosure-geometry', 'the built canvas disclosure is anchored at the node boundary so CSS owns its token-sized offset', nodeGeometry !== null && disclosureGeometry !== null && [nodeGeometry.left, nodeGeometry.top, nodeGeometry.width, nodeGeometry.height, disclosureGeometry.left, disclosureGeometry.top].every(Number.isFinite) && disclosureGeometry.left === nodeGeometry.left + nodeGeometry.width && disclosureGeometry.top === nodeGeometry.top + nodeGeometry.height)
  assert('INTERACTION-disclosure-key-states', 'all four fixture-backed native disclosure key paths reduce to their exact complete state', disclosureKeys.length === 4 && disclosureKeys.every((testCase) => {
    const next = reduceCodeMapState(testCase.initialState, { type: 'set-expanded', ids: [testCase.action.targets[0]] })
    return JSON.stringify([next]) === JSON.stringify(testCase.expectedStates) && testCase.expectedLegacy.select.length === 0
  }))

  const navigatorMarkup = render(h(CodeMapNavigator, {
    payload: interactionFixture.payload,
    grain: 'file',
    expandedIds: [],
    selectedId: 'web',
    focusedId: 'internal',
    filter: '',
  }))
  const treeItemBodies = [...navigatorMarkup.matchAll(/<div role="treeitem"[^>]*>([\s\S]*?)<\/div>/g)].map((match) => match[1])
  assert('INTERACTION-navigator-disclosure-sibling', 'built navigator disclosure controls are outside every treeitem', navigatorMarkup.includes('role="none" class="gmp-navigator-row-wrap"') && treeItemBodies.every((body) => !body.includes('children for')))
  assert('INTERACTION-navigator-disclosure-tab-order', 'built navigator disclosure controls stay outside the roving tree tab order', /class="gmp-navigator-disclosure" tabindex="-1"/.test(navigatorMarkup) && (navigatorMarkup.match(/role="treeitem"[^>]*tabindex="0"/g) ?? []).length === 1)

  const filteredView = deriveCodeMapView(interactionFixture.payload, filterCase.initialState)
  const filteredParent = filteredView.rows.find((row) => row.node.id === 'internal')
  const filteredChild = filteredView.rows.find((row) => row.node.id === 'internal/ingest')
  const filteredMarkup = render(h(CodeMapNavigator, {
    payload: interactionFixture.payload,
    grain: filterCase.initialState.grain,
    expandedIds: filterCase.initialState.expandedIds,
    selectedId: filterCase.initialState.selectedId,
    focusedId: filterCase.initialState.navigatorFocusedId,
    filter: filterCase.initialState.navigatorFilter,
  }))
  assert('INTERACTION-filter-derived-navigation', 'the built filtered hierarchy exposes immediate child and parent navigation without persisted expansion', filteredParent?.forcedOpen === true && filteredParent.childIds[0] === 'internal/ingest' && filteredChild?.parentId === 'internal' && filteredView.state.expandedIds.length === 0)
  assert('INTERACTION-filter-aria', 'the built filtered navigator renders effective expanded truth and an unavailable collapse affordance', filteredMarkup.includes('aria-expanded="true"') && filteredMarkup.includes('aria-disabled="true"'))
  const parentOnlyView = deriveCodeMapView(interactionFixture.payload, parentOnly.initialState)
  const solo = parentOnlyView.rows.find((row) => row.node.id === 'solo')
  assert('INTERACTION-parent-only-filter', 'a matching parent with no visible matching child is not forced open', solo?.forcedOpen === false && solo.expanded === false && solo.childIds.length === 0)
}

function inlineGeometry(tag) {
  const style = /style="([^"]*)"/.exec(tag)?.[1]
  if (!style) return null
  const number = (property) => Number.parseFloat(new RegExp(`${property}:([\\d.]+)px`).exec(style)?.[1] ?? '')
  const value = { left: number('left'), top: number('top'), width: number('width'), height: number('height') }
  return value
}
{
  const project = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'project', expanded: [] } })
  const pkg = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'package', expanded: [] } })
  const file = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'file', expanded: [] } })
  const fileExpanded = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'file', expanded: ['mod/pkg'] } })
  assert('GRAIN-project', "zoom.level='project' renders the overview grain (only the module root)", project.includes('mod') && !project.includes('leaf.go'))
  assert('GRAIN-package', "zoom.level='package' renders the folders grain (mod's package, not its file)", pkg.includes('>pkg<') || pkg.includes('pkg:'))
  // File grain bases at the SAME depth as package grain -- it reaches leaf.go
  // only through explicit expansion (zoom.expanded), never by auto-descending
  // unexpanded. This is the fix for the "one very long row" regression: file
  // grain previously rendered the entire tree unbounded with zero expansion,
  // which degenerates on any real project with hundreds of files.
  assert('GRAIN-file-stays-bounded', "zoom.level='file' with no expansion stays bounded (does NOT auto-descend to leaf.go)", !file.includes('leaf.go'))
  assert('GRAIN-file-reaches-via-expansion', "zoom.level='file' reaches leaf.go once its parent is explicitly expanded", fileExpanded.includes('leaf.go'))
  assert(
    'GRAIN-toggle-differs',
    'project hides pkg (grain controls visibility) while package/file-unexpanded agree on visibility, and explicit expansion at file grain reaches strictly deeper',
    !project.includes('leaf.go') && !project.includes('>pkg<') && !pkg.includes('leaf.go') && !file.includes('leaf.go') && fileExpanded.includes('leaf.go'),
  )
}

/* ── expandedIds (CodeMap.zoom.expanded widens past the grain's base depth) ───── */
{
  const collapsed = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'package', expanded: [] } })
  const expanded = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'package', expanded: ['mod/pkg'] } })
  assert('EXPAND-collapsed-hides-file', 'zoom.expanded=[] at package grain does NOT show the file leaf', !collapsed.includes('leaf.go'))
  assert('EXPAND-widens', "zoom.expanded=['mod/pkg'] shows the file leaf even at package grain", expanded.includes('leaf.go'))
}

/* ── highlightedIds + nodeDeltas (hover-relay + review-diff overlays) ─────────── */
{
  const base = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'package', expanded: [] } })
  const highlighted = html({
    payload: GRAIN_PAYLOAD,
    zoom: { level: 'package', expanded: [] },
    highlightedIds: ['mod/pkg'],
  })
  assert('HIGHLIGHT-off', 'no highlightedIds ⇒ no data-highlighted node', !base.includes('data-highlighted="true"'))
  assert('HIGHLIGHT-on', "highlightedIds=['mod/pkg'] marks that node data-highlighted", highlighted.includes('data-highlighted="true"'))

  const delta = html({
    payload: GRAIN_PAYLOAD,
    zoom: { level: 'package', expanded: [] },
    nodeDeltas: { 'mod/pkg': 'new' },
  })
  assert('DELTA-off', 'no nodeDeltas ⇒ no data-delta node', !base.includes('data-delta='))
  assert('DELTA-on', "nodeDeltas={'mod/pkg':'new'} marks that node data-delta=\"new\"", delta.includes('data-delta="new"'))
}

/* ── shared toolbar ownership ───────────────────────────────────────────────
   CodeMap must compose the SAME MapCanvas toolbar (grain segmented control + node
   search) demo and app both mount — not a per-host reimplementation. */
{
  const out = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'package', expanded: [] } })
  assert('TOOLBAR-grain', 'CodeMap renders the shared grain segmented control (role=radiogroup, 3 radios)', out.includes('role="radiogroup"') && (out.match(/role="radio"/g) || []).length === 3)
  assert('TOOLBAR-search', 'CodeMap renders the shared node-search combobox', out.includes('role="combobox"'))
}

/* ── keyboard / roving-focus infrastructure ────────────────────────────────────
   Static contract only (SSR cannot dispatch key events); the INTERACTIVE arrow-key
   roving-focus + click-to-select behavior is exercised by MapCanvas.stories.jsx's
   Default play() function, executed for real by `pnpm sbsmoke` (wired into
   build:lib — see package.json). */
{
  const out = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'package', expanded: [] }, ariaLabel: 'keyboard smoke' })
  assert('KBD-application', 'the canvas root is a real application landmark (role=application) — the roving-focus keyboard scope', out.includes('role="application"'))
  assert('KBD-live-region', 'an aria-live=polite status region announces the roving-focus node', /role="status"[^>]*aria-live="polite"/.test(out))
  assert('KBD-real-buttons', 'nodes are real <button> elements (native Tab/Enter semantics, not div+onClick)', /<button[^>]*class="mc-node"/.test(out))
}

/* ── report ──────────────────────────────────────────────────────────────────── */
const fails = results.filter((r) => !r.ok)
for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.id + ' — ' + r.desc)
if (fails.length) {
  console.error(
    [
      '',
      `map behavioral smoke FAILED: ${fails.length}/${results.length} assertion(s) red.`,
      'What went wrong: the lifted CodeMap/MapCanvas surface no longer produces its expected behavior.',
      'Why it matters: this is the executed package-level gate for controlled grain, expandedIds,',
      '  highlightedIds, nodeDeltas, and layer/order — peasant/village consume this exact built bundle.',
      'Where: scripts/smoke-map.mjs — ' + fails.map((f) => f.id).join(', '),
      'How to fix: inspect src/ui/graph/CodeMap.jsx and src/ui/MapCanvas.jsx for the named behavior.',
    ].join('\n'),
  )
  process.exit(1)
}
console.log(`\nmap behavioral smoke: all ${results.length} assertions passed.`)

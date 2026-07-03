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
import { CodeMap } from '../dist/lib/graph.js'

const h = React.createElement

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
{
  const project = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'project', expanded: [] } })
  const pkg = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'package', expanded: [] } })
  const file = html({ payload: GRAIN_PAYLOAD, zoom: { level: 'file', expanded: [] } })
  assert('GRAIN-project', "zoom.level='project' renders the overview grain (only the module root)", project.includes('mod') && !project.includes('leaf.go'))
  assert('GRAIN-package', "zoom.level='package' renders the folders grain (mod's package, not its file)", pkg.includes('>pkg<') || pkg.includes('pkg:'))
  assert('GRAIN-file', "zoom.level='file' renders the files grain (down to leaf.go)", file.includes('leaf.go'))
  assert('GRAIN-toggle-differs', 'the three grains render DIFFERENT node sets (grain is actually controlling visibility)', project !== pkg && pkg !== file)
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

import { useMemo, useRef, useState, useCallback } from 'react'
import {
  Plus,
  Minus,
  Maximize,
  Search,
  TriangleAlert,
  X,
  ArrowRight,
  Box,
  Folder,
  FileCode,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  Share2,
  RotateCw,
  CircleDot,
  Coins,
  Link2,
  CornerDownRight,
  ChevronDown,
  ChevronRight,
  Tag,
  Check,
  MessageSquare,
  FileDiff,
  Layers,
} from 'lucide-react'

/* ============================================================================
   GraphMap.jsx — peasant's code-MAP + changes git-graph, hand-rolled in the
   caves-of-qud terminal identity. NO chart/graph libraries: every node, edge,
   lane, elbow, commit dot, sparkline bar and diff hunk is drawn by hand in
   svg/css with design tokens, so both themes re-skin for free.

   three self-contained views, each owns its mock data + state + fills 100%:
     MapView         — the square-node code-graph map + selection rail + timestrip
     ChangesView     — the lane-based git graph (square 90° elbows only)
     ChangeDetailView— one change's story: caption, lines of work, lazy diffs

   strict-monochrome: amber is scarce (selection + the single live accent), red
   (--danger/--clay) appears ONLY on tangle violations. coverage owns the fill
   channel via a 5-step surface ramp. lowercase chrome, content keeps its case.
============================================================================ */

const fmt = (n) => n.toLocaleString('en-US')

/* coverage fill ramp (recorded / total). bright = built-with-AI-on-record,
   dim = predates recording. deliberately on surface tokens (not the intensity
   ramp) to hold WCAG AA in both themes — coverage owns the fill exclusively. */
const FILL = [
  'var(--canvas)',
  'var(--surface)',
  'var(--surface-2)',
  'var(--surface-hover)',
  'var(--surface-elev)',
]
function fillFor(cov) {
  // cov 0..1 -> 0..4
  const lvl = Math.min(4, Math.max(0, Math.round(cov * 4)))
  return FILL[lvl]
}

/* ====================================================================== */
/* === MAP VIEW ========================================================== */
/* ====================================================================== */

/* the code graph at "Folders" grain (the default). geometry is in svg-ish px;
   the canvas scales the whole field via a transform (zoom). each node carries
   loc (→ width), coverage (→ fill), language, a NEW/removed delta state, and a
   contained-violation count (→ red ⚠ badge). */
const MAP_NODES = {
  folders: [
    { id: 'internal/ingest', name: 'internal/ingest', kind: 'package', lang: 'go', loc: 1240, recorded: 3, files: 5, x: 70, y: 60, w: 150, h: 78, violations: 0 },
    { id: 'internal/codegraph', name: 'internal/codegraph', kind: 'package', lang: 'go', loc: 2180, recorded: 9, files: 11, x: 300, y: 44, w: 176, h: 92, violations: 1, delta: 'new' },
    { id: 'internal/store', name: 'internal/store', kind: 'package', lang: 'go', loc: 840, recorded: 2, files: 6, x: 560, y: 70, w: 128, h: 66, violations: 0 },
    { id: 'web/src/lib/api', name: 'web/src/lib/api', kind: 'package', lang: 'ts', loc: 1530, recorded: 8, files: 9, x: 120, y: 232, w: 160, h: 80, violations: 0 },
    { id: 'web/src/map', name: 'web/src/map', kind: 'package', lang: 'tsx', loc: 1980, recorded: 7, files: 12, x: 360, y: 248, w: 172, h: 88, violations: 2 },
    { id: 'cmd/peasant', name: 'cmd/peasant', kind: 'package', lang: 'go', loc: 360, recorded: 0, files: 4, x: 600, y: 250, w: 110, h: 60, violations: 0, delta: 'removed' },
  ],
  overview: [
    { id: 'internal', name: 'internal', kind: 'module', lang: 'go', loc: 4260, recorded: 14, files: 22, x: 110, y: 70, w: 200, h: 100, violations: 1 },
    { id: 'web', name: 'web', kind: 'module', lang: 'tsx', loc: 3510, recorded: 15, files: 21, x: 380, y: 110, w: 188, h: 96, violations: 2 },
    { id: 'cmd', name: 'cmd', kind: 'module', lang: 'go', loc: 360, recorded: 0, files: 4, x: 620, y: 90, w: 110, h: 60, violations: 0 },
  ],
  files: [
    { id: 'ingest/pipeline.go', name: 'pipeline.go', kind: 'file', lang: 'go', loc: 240, recorded: 1, files: 1, x: 60, y: 50, w: 116, h: 56, violations: 0 },
    { id: 'ingest/replay.go', name: 'replay.go', kind: 'file', lang: 'go', loc: 132, recorded: 1, files: 1, x: 60, y: 150, w: 100, h: 50, violations: 0 },
    { id: 'codegraph/build.go', name: 'build.go', kind: 'file', lang: 'go', loc: 410, recorded: 1, files: 1, x: 250, y: 44, w: 140, h: 66, violations: 1, delta: 'new' },
    { id: 'codegraph/layout.go', name: 'layout.go', kind: 'file', lang: 'go', loc: 318, recorded: 1, files: 1, x: 270, y: 168, w: 128, h: 60, violations: 0 },
    { id: 'map/Canvas.tsx', name: 'Canvas.tsx', kind: 'file', lang: 'tsx', loc: 520, recorded: 1, files: 1, x: 470, y: 60, w: 150, h: 70, violations: 2 },
    { id: 'map/Rail.tsx', name: 'Rail.tsx', kind: 'file', lang: 'tsx', loc: 286, recorded: 1, files: 1, x: 500, y: 188, w: 124, h: 58, violations: 0 },
  ],
}

/* solid import "structure" edges (a→b, with arrowhead) + dashed co-edit
   "activity" edges. keyed per grain so they lift cleanly to visible nodes. */
const MAP_EDGES = {
  folders: [
    { from: 'web/src/lib/api', to: 'internal/store', kind: 'import' },
    { from: 'web/src/map', to: 'web/src/lib/api', kind: 'import' },
    { from: 'internal/ingest', to: 'internal/store', kind: 'import' },
    { from: 'internal/codegraph', to: 'internal/ingest', kind: 'import' },
    { from: 'cmd/peasant', to: 'internal/ingest', kind: 'import' },
    { from: 'internal/codegraph', to: 'web/src/map', kind: 'coedit' },
    { from: 'internal/ingest', to: 'web/src/lib/api', kind: 'coedit' },
    { from: 'web/src/map', to: 'internal/codegraph', kind: 'tangle' },
  ],
  overview: [
    { from: 'web', to: 'internal', kind: 'import' },
    { from: 'cmd', to: 'internal', kind: 'import' },
    { from: 'internal', to: 'web', kind: 'coedit' },
    { from: 'web', to: 'internal', kind: 'tangle' },
  ],
  files: [
    { from: 'codegraph/build.go', to: 'ingest/pipeline.go', kind: 'import' },
    { from: 'codegraph/layout.go', to: 'codegraph/build.go', kind: 'import' },
    { from: 'ingest/replay.go', to: 'ingest/pipeline.go', kind: 'import' },
    { from: 'map/Canvas.tsx', to: 'map/Rail.tsx', kind: 'import' },
    { from: 'map/Canvas.tsx', to: 'codegraph/build.go', kind: 'tangle' },
  ],
}

/* per-node selection-rail facts. depends/used reference other node ids at the
   same grain; conversations interleave tasks + commits; coupling is co-edit. */
const NODE_DETAIL = {
  'internal/ingest': {
    path: 'internal/ingest',
    lang: 'go',
    depends: ['internal/store'],
    used: ['internal/codegraph', 'cmd/peasant'],
    convos: [
      { kind: 'task', id: 'a3f9c1d4', title: 'Refactor ingest pipeline to stream', outcome: 'resolved', mods: ['pipeline.go', 'replay.go'], requests: 12, retries: true, labels: ['good handoff'] },
      { kind: 'commit', hash: 'a3f9c1', msg: 'stream ingest, constant memory' },
      { kind: 'task', id: '7b21e0aa', title: 'Add backpressure to the reader', outcome: 'partial', mods: ['pipeline.go'], requests: 6, retries: false, labels: [] },
      { kind: 'commit', hash: 'b7e220', msg: 'stream replay path, share reader' },
    ],
    coupling: [
      { id: 'web/src/lib/api', shared: 4 },
      { id: 'internal/store', shared: 2 },
    ],
    effort: { retries: 4, reEdits: 7, files: 5, spend: 1.32 },
    sessions: 3,
  },
  'internal/codegraph': {
    path: 'internal/codegraph',
    lang: 'go',
    depends: ['internal/ingest'],
    used: ['web/src/map'],
    convos: [
      { kind: 'task', id: 'c1d4a3f9', title: 'Build deterministic node layout', outcome: 'resolved', mods: ['build.go', 'layout.go'], requests: 21, retries: true, labels: ['tricky'] },
      { kind: 'commit', hash: 'c1d4a3', msg: 'squarify treemap + lane gutter' },
    ],
    coupling: [{ id: 'web/src/map', shared: 6 }],
    effort: { retries: 9, reEdits: 14, files: 11, spend: 3.07 },
    sessions: 5,
  },
}

/* sessions/day sparkline (≈42 local days) — heights are intensity levels 0..4.
   right-anchored so clipping eats history, not "now". */
const SPARK = [0, 1, 0, 2, 1, 0, 0, 3, 4, 2, 1, 0, 1, 2, 0, 0, 1, 3, 2, 4, 4, 3, 1, 0, 0, 2, 1, 0, 1, 4, 3, 2, 0, 1, 0, 2, 3, 4, 2, 1, 3, 2]
const SPARK_DATES = SPARK.map((_, i) => {
  const d = new Date(2026, 4, 6 + i) // arbitrary local-day anchor
  return d.toISOString().slice(0, 10)
})
const BRANCH_CHIPS = [
  { name: 'feat/map-review-contribute', ahead: 8 },
  { name: 'fix--kickstart-config', ahead: 2 },
]

/* recent + all conversations for the project (unselected) rail panel. */
const RECENT_TASKS = [
  { id: 'a3f9c1d4', title: 'Refactor ingest pipeline to stream', when: '2d ago', lights: ['internal/ingest', 'internal/store'], outcome: 'resolved' },
  { id: 'c1d4a3f9', title: 'Build deterministic node layout', when: '5h ago', lights: ['internal/codegraph', 'web/src/map'], outcome: 'resolved' },
  { id: '7b21e0aa', title: 'Tune redaction rules for API keys', when: '1d ago', lights: ['web/src/lib/api'], outcome: 'partial' },
]
const ALL_TASKS = [
  ...RECENT_TASKS,
  { id: 'e8a0ff21', title: 'Wire the dialog focus return', when: '3d ago', lights: ['web/src/map'], outcome: 'resolved' },
  { id: 'd4c1a3f9', title: 'Add FTS5 search to the commons', when: '4d ago', lights: ['web/src/lib/api'], outcome: 'partial' },
  { id: 'ff21e8a0', title: 'Fix pipeline bug on empty source', when: '6d ago', lights: ['internal/ingest'], outcome: 'failed' },
]

const GRAINS = [
  { id: 'overview', label: 'overview', Icon: Box },
  { id: 'folders', label: 'folders', Icon: Folder },
  { id: 'files', label: 'files', Icon: FileCode },
]

const ZOOMS = [0.7, 0.85, 1, 1.2, 1.45]

function OutcomeDot({ outcome }) {
  const tone =
    outcome === 'resolved' ? 'var(--olive)' : outcome === 'partial' ? 'var(--amber)' : 'var(--clay)'
  return (
    <span
      className="gmp-odot"
      style={{ background: tone }}
      aria-label={outcome}
      title={outcome}
    />
  )
}

export function MapView({ theme }) {
  void theme
  const [grain, setGrain] = useState('folders')
  const [selected, setSelected] = useState(null) // node id
  const [hotNode, setHotNode] = useState(null) // hover-lit node id (from rail)
  const [zoomIx, setZoomIx] = useState(2)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [taskFilter, setTaskFilter] = useState('')
  const [scrub, setScrub] = useState(null) // sparkline index, null = "now"
  const svgRef = useRef(null)

  const nodes = MAP_NODES[grain]
  const edges = MAP_EDGES[grain]
  const zoom = ZOOMS[zoomIx]

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])

  // node-search matches (combobox suggestions)
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return nodes.filter((n) => n.id.toLowerCase().includes(q)).slice(0, 5)
  }, [query, nodes])

  // edge endpoint centers (drawn in svg user units)
  const center = useCallback(
    (id) => {
      const n = nodeById[id]
      if (!n) return null
      return { x: n.x + n.w / 2, y: n.y + n.h / 2 }
    },
    [nodeById],
  )

  function selectNode(id) {
    setSelected(id)
    setQuery('')
  }

  const detail = selected ? NODE_DETAIL[selected] : null
  const selNode = selected ? nodeById[selected] : null

  const tasks = showAll ? ALL_TASKS : RECENT_TASKS
  const filteredTasks = useMemo(() => {
    const q = taskFilter.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter((t) => t.title.toLowerCase().includes(q))
  }, [tasks, taskFilter])

  // which canvas nodes light up from a hovered rail row
  const litSet = useMemo(() => {
    if (!hotNode) return null
    const t = ALL_TASKS.find((x) => x.id === hotNode)
    if (!t) return new Set([hotNode])
    return new Set(t.lights)
  }, [hotNode])

  const scrubbed = scrub != null

  return (
    <div className="gmp-root">
      {/* ---- toolbar: grain control + node search ---- */}
      <div className="gmp-toolbar">
        <div className="gmp-seg" role="group" aria-label="detail grain">
          {GRAINS.map((g) => {
            const on = grain === g.id
            return (
              <button
                key={g.id}
                type="button"
                className="gmp-seg-btn"
                aria-pressed={on}
                onClick={() => {
                  setGrain(g.id)
                  setSelected(null)
                }}
              >
                <g.Icon size={14} aria-hidden="true" /> {g.label}
              </button>
            )
          })}
        </div>

        <div className="gmp-find">
          <div className="input-ico">
            <Search size={14} aria-hidden="true" className="lucide" />
            <input
              className="input"
              type="text"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-label="find a node"
              placeholder="find a node…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {matches.length > 0 && (
            <ul className="gmp-find-list" role="listbox" aria-label="matches">
              {matches.map((m) => (
                <li key={m.id} role="option" aria-selected={false}>
                  <button type="button" className="gmp-find-opt" onClick={() => selectNode(m.id)}>
                    <span className="mono">{m.id}</span>
                    <span className="gmp-find-meta tnum">{fmt(m.loc)} loc</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="gmp-toolbar-spacer" />
        <span className="gmp-conn" title="connected — receiving live updates">
          <span className="dot" aria-hidden="true" /> live
        </span>
      </div>

      {/* ---- canvas + rail ---- */}
      <div className="gmp-body">
        <div className="gmp-canvas-wrap">
          <div
            className={'canvas gmp-canvas' + (scrubbed ? ' gmp-scrubbed' : '')}
            role="application"
            aria-label={`code map, ${grain} grain, ${nodes.length} areas`}
          >
            {/* edges first so they sit behind nodes */}
            <svg
              ref={svgRef}
              className="edges gmp-edges"
              viewBox="0 0 780 360"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            >
              <defs>
                <marker id="gmp-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L8 4 L0 8 z" fill="var(--ink-4)" />
                </marker>
                <marker id="gmp-arrow-tangle" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L8 4 L0 8 z" fill="var(--danger)" />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const a = center(e.from)
                const b = center(e.to)
                if (!a || !b) return null
                const tangle = e.kind === 'tangle'
                const coedit = e.kind === 'coedit'
                const stroke = tangle ? 'var(--danger)' : 'var(--ink-4)'
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={stroke}
                    strokeWidth={tangle ? 1.5 : 1}
                    strokeDasharray={coedit ? '5 4' : tangle ? '3 3' : undefined}
                    markerEnd={tangle ? 'url(#gmp-arrow-tangle)' : coedit ? undefined : 'url(#gmp-arrow)'}
                    vectorEffect="non-scaling-stroke"
                    opacity={litSet ? 0.25 : tangle ? 0.95 : 0.7}
                  />
                )
              })}
            </svg>

            {/* nodes: square, loc-sized, coverage-dimmed fill */}
            <div
              className="gmp-nodes"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
              onClick={(e) => {
                if (e.currentTarget === e.target) setSelected(null)
              }}
            >
              {nodes.map((n) => {
                const cov = n.recorded / n.files
                const on = selected === n.id
                const lit = litSet ? litSet.has(n.id) : false
                const removed = n.delta === 'removed'
                const isNew = n.delta === 'new'
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={
                      'gmp-node' +
                      (on ? ' gmp-node-sel' : '') +
                      (lit ? ' gmp-node-lit' : '') +
                      (removed ? ' gmp-node-removed' : '') +
                      (isNew ? ' gmp-node-new' : '')
                    }
                    style={{
                      left: (n.x / 780) * 100 + '%',
                      top: (n.y / 360) * 100 + '%',
                      width: (n.w / 780) * 100 + '%',
                      minHeight: n.h * 0.62,
                      background: removed ? 'transparent' : fillFor(cov),
                    }}
                    aria-pressed={on}
                    aria-label={`${n.id}, ${n.kind}, ${n.recorded} of ${n.files} files recorded, ${fmt(n.loc)} lines${n.violations ? `, ${n.violations} contained violations` : ''}${isNew ? ', new' : ''}${removed ? ', removed' : ''}`}
                    onClick={() => selectNode(n.id)}
                  >
                    {isNew && <span className="gmp-node-eyebrow">new</span>}
                    {removed && <span className="gmp-node-eyebrow gmp-node-eyebrow-rm">removed</span>}
                    <span className="gmp-node-name">
                      {n.kind === 'file' ? (
                        <FileCode size={12} aria-hidden="true" />
                      ) : n.kind === 'package' ? (
                        <Folder size={12} aria-hidden="true" />
                      ) : (
                        <Box size={12} aria-hidden="true" />
                      )}
                      <span className="gmp-node-label">{n.name}</span>
                      {n.violations > 0 && (
                        <span className="gmp-node-warn" title={`${n.violations} tangle violations`}>
                          <TriangleAlert size={12} aria-hidden="true" />
                          <span className="tnum">{n.violations}</span>
                        </span>
                      )}
                    </span>
                    <span className="gmp-node-meta tnum">
                      {n.recorded}/{n.files} · {fmt(n.loc)} loc
                    </span>
                    <span className="gmp-node-lang">{n.lang}</span>
                    {/* effort intensity bottom-bar */}
                    {!removed && (
                      <span
                        className="gmp-node-eff"
                        style={{ opacity: 0.35 + cov * 0.55 }}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* on-canvas zoom controls (reuse .canvas-ctrls) */}
            <div className="canvas-ctrls" role="group" aria-label="zoom">
              <button
                type="button"
                aria-label="zoom in"
                title="zoom in"
                onClick={() => setZoomIx((i) => Math.min(ZOOMS.length - 1, i + 1))}
              >
                <Plus size={14} aria-hidden="true" className="lucide" />
              </button>
              <button
                type="button"
                aria-label="zoom out"
                title="zoom out"
                onClick={() => setZoomIx((i) => Math.max(0, i - 1))}
              >
                <Minus size={14} aria-hidden="true" className="lucide" />
              </button>
              <button type="button" aria-label="fit to view" title="fit to view" onClick={() => setZoomIx(2)}>
                <Maximize size={14} aria-hidden="true" className="lucide" />
              </button>
            </div>

            {/* persistent minimap */}
            <div className="minimap" aria-hidden="true">
              {nodes.map((n) => (
                <i
                  key={n.id}
                  style={{
                    left: (n.x / 780) * 100 + '%',
                    top: (n.y / 360) * 100 + '%',
                    width: Math.max(4, (n.w / 780) * 100) + '%',
                    height: Math.max(3, (n.h / 360) * 100) + '%',
                    background: selected === n.id ? 'var(--amber)' : 'var(--ink-5)',
                  }}
                />
              ))}
            </div>

            {scrubbed && (
              <div className="gmp-scrub-note" role="status">
                showing the map as it stood on <b>{SPARK_DATES[scrub]}</b> (commit{' '}
                <span className="mono">a3f9c1d4</span>) ·{' '}
                <button type="button" className="gmp-link" onClick={() => setScrub(null)}>
                  back to now
                </button>
              </div>
            )}
          </div>

          {/* persistent legend */}
          <div className="gmp-legend" aria-label="legend">
            <span className="gmp-legend-item">
              <span className="gmp-legend-ramp" aria-hidden="true">
                {FILL.map((f, i) => (
                  <i key={i} style={{ background: f }} />
                ))}
              </span>
              coverage (dim → built with ai)
            </span>
            <span className="gmp-legend-item">
              <svg width="26" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="20" y2="4" stroke="var(--ink-4)" strokeWidth="1" markerEnd="url(#gmp-arrow)" />
              </svg>
              imports
            </span>
            <span className="gmp-legend-item">
              <svg width="26" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="24" y2="4" stroke="var(--ink-4)" strokeWidth="1" strokeDasharray="5 4" />
              </svg>
              co-edits
            </span>
            <span className="gmp-legend-item gmp-legend-warn">
              <TriangleAlert size={13} aria-hidden="true" /> tangle
            </span>
            <span className="gmp-legend-item gmp-legend-dim">double-click a folder to expand</span>
          </div>

          {/* time-strip sparkline with branch chips + scrub playhead */}
          <div className="gmp-timestrip-wrap">
            <div
              className="timestrip gmp-timestrip"
              role="group"
              aria-label={`session activity, ${SPARK.reduce((a, b) => a + b, 0)} sessions over ${SPARK.length} days`}
            >
              {SPARK.map((lvl, i) => {
                const pct = [4, 25, 45, 70, 100][lvl]
                const on = scrub === i
                return (
                  <button
                    key={i}
                    type="button"
                    className={'gmp-spark-bar' + (on ? ' gmp-spark-on' : '')}
                    style={{ height: pct + '%' }}
                    title={`${SPARK_DATES[i]} — ${lvl === 0 ? 'no' : lvl} sessions`}
                    aria-label={`${SPARK_DATES[i]}, ${lvl} sessions`}
                    onClick={() => setScrub(i)}
                  >
                    {on && <span className="gmp-spark-head" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
            <div className="gmp-branch-chips">
              {BRANCH_CHIPS.map((b) => (
                <button key={b.name} type="button" className="chip gmp-branch-chip" title={`open ${b.name}`}>
                  <GitBranch size={13} aria-hidden="true" />
                  <span className="gmp-branch-name">{b.name}</span>
                  <span className="tnum gmp-branch-ahead">+{b.ahead}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- selection rail ---- */}
        <aside className="gmp-rail" aria-label={detail ? 'node detail' : 'project'}>
          {detail ? (
            <NodeRail
              node={selNode}
              detail={detail}
              onClose={() => setSelected(null)}
              onSelectNode={(id) => MAP_NODES[grain].some((n) => n.id === id) && selectNode(id)}
            />
          ) : (
            <ProjectRail
              tasks={filteredTasks}
              total={ALL_TASKS.length}
              showAll={showAll}
              onShowAll={() => setShowAll(true)}
              filter={taskFilter}
              onFilter={setTaskFilter}
              onHover={setHotNode}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

/* project (unselected) rail: coverage line, recent + all conversations. */
function ProjectRail({ tasks, total, showAll, onShowAll, filter, onFilter, onHover }) {
  const recordedPct = 35
  return (
    <div className="sidebar gmp-rail-inner">
      <div className="sb-sec">
        <div className="sb-head">project · peasant-labs/peasant</div>
        <div className="gmp-rail-pad">
          <div className="gmp-coverage">
            <div className="gmp-coverage-top">
              <span className="label">files built with ai</span>
              <span className="tnum gmp-coverage-pct">{recordedPct}%</span>
            </div>
            <div className="gmp-coverage-bar" aria-hidden="true">
              <span style={{ width: recordedPct + '%' }} />
            </div>
            <div className="gmp-coverage-sub mono">1,240 of 3,540 files</div>
          </div>
        </div>
      </div>

      <div className="sb-sec">
        <div className="sb-head">recent ai conversations</div>
        <ul className="gmp-tasklist">
          {tasks.slice(0, showAll ? tasks.length : 3).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="gmp-task-row"
                onMouseEnter={() => onHover(t.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(t.id)}
                onBlur={() => onHover(null)}
              >
                <OutcomeDot outcome={t.outcome} />
                <span className="gmp-task-title">{t.title}</span>
                <span className="gmp-task-when tnum">{t.when}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sb-sec">
        <div className="sb-head">all conversations</div>
        <div className="gmp-rail-pad">
          <div className="input-ico gmp-rail-filter">
            <Search size={14} aria-hidden="true" className="lucide" />
            <input
              className="input"
              type="text"
              value={filter}
              onChange={(e) => onFilter(e.target.value)}
              placeholder="filter conversations…"
              aria-label="filter conversations"
            />
          </div>
        </div>
        {!showAll && (
          <button type="button" className="gmp-showall" onClick={onShowAll}>
            show all {total} conversations <ArrowRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

/* node (selected) rail: path+lang, depends/used, ai-built files, conversations
   that built this (tasks interleaved with commits), coupling, effort + $ spend. */
function NodeRail({ node, detail, onClose, onSelectNode }) {
  const cov = node.recorded / node.files
  return (
    <div className="sidebar gmp-rail-inner">
      <div className="sb-sec gmp-rail-node-head">
        <div className="gmp-rail-nh-top">
          <span className="label">code area</span>
          <button type="button" className="gmp-rail-close" aria-label="clear selection" onClick={onClose}>
            <X size={14} aria-hidden="true" className="lucide" />
          </button>
        </div>
        <div className="gmp-rail-name mono">{detail.path}</div>
        <div className="gmp-rail-meta">
          <span className="metaitem">
            <Folder size={14} aria-hidden="true" /> {node.kind}
          </span>
          <span className="metaitem">
            <FileCode size={14} aria-hidden="true" /> {detail.lang}
          </span>
          <span className="metaitem tnum">
            <Layers size={14} aria-hidden="true" /> {fmt(node.loc)} loc
          </span>
        </div>
      </div>

      <div className="sb-sec">
        <div className="sb-head">what this area connects to</div>
        <div className="gmp-rail-pad gmp-connects">
          <div className="gmp-connect-grp">
            <span className="label">depends on</span>
            <div className="chips gmp-connect-chips">
              {detail.depends.map((d) => (
                <button key={d} type="button" className="chip gmp-connect-chip" onClick={() => onSelectNode(d)}>
                  <ArrowRight size={12} aria-hidden="true" /> <span className="mono">{d}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="gmp-connect-grp">
            <span className="label">used by</span>
            <div className="chips gmp-connect-chips">
              {detail.used.map((u) => (
                <button key={u} type="button" className="chip gmp-connect-chip" onClick={() => onSelectNode(u)}>
                  <Link2 size={12} aria-hidden="true" /> <span className="mono">{u}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sb-sec">
        <div className="sb-head">ai-built files</div>
        <div className="gmp-rail-pad">
          <div className="gmp-coverage">
            <div className="gmp-coverage-top">
              <span className="mono">
                {node.recorded} of {node.files} files
              </span>
              <span className="tnum gmp-coverage-pct">{Math.round(cov * 100)}%</span>
            </div>
            <div className="gmp-coverage-bar" aria-hidden="true">
              <span style={{ width: Math.round(cov * 100) + '%' }} />
            </div>
            <div className="gmp-coverage-sub mono">
              {detail.sessions} conversations · {detail.convos.filter((c) => c.kind === 'task').reduce((s, c) => s + c.requests, 0)} requests · last touch 5h ago
            </div>
          </div>
        </div>
      </div>

      <div className="sb-sec">
        <div className="sb-head">conversations that built this</div>
        <ul className="gmp-convos">
          {detail.convos.map((c, i) =>
            c.kind === 'commit' ? (
              <li key={i} className="gmp-convo-commit">
                <GitCommitHorizontal size={14} aria-hidden="true" />
                <span className="mono gmp-commit-hash">{c.hash}</span>
                <span className="gmp-commit-msg">{c.msg}</span>
              </li>
            ) : (
              <li key={i} className="gmp-convo-task">
                <button type="button" className="gmp-convo-task-btn">
                  <span className="gmp-convo-task-top">
                    <OutcomeDot outcome={c.outcome} />
                    <span className="gmp-convo-task-title">{c.title}</span>
                    {c.retries && (
                      <span className="gmp-retry" title="took several attempts">
                        <RotateCw size={12} aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="gmp-convo-task-sub mono">
                    {c.mods.join(', ')} · {c.requests} requests
                  </span>
                  {c.labels.length > 0 && (
                    <span className="gmp-label-chips">
                      {c.labels.map((l) => (
                        <span key={l} className="gmp-label-chip">
                          <Tag size={11} aria-hidden="true" /> {l}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="sb-sec">
        <div className="sb-head">usually changed alongside</div>
        <ul className="gmp-coupling">
          {detail.coupling.map((c) => (
            <li key={c.id}>
              <button type="button" className="gmp-coupling-row" onClick={() => onSelectNode(c.id)}>
                <CornerDownRight size={13} aria-hidden="true" />
                <span className="mono gmp-coupling-id">{c.id}</span>
                <span className="tnum gmp-coupling-shared">{c.shared} shared tasks</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sb-sec">
        <div className="sb-head">effort totals</div>
        <div className="gmp-rail-pad gmp-effort">
          <div className="gmp-effort-row">
            <span className="metaitem">
              <RotateCw size={14} aria-hidden="true" /> times the ai retried
            </span>
            <b className="tnum">{detail.effort.retries}</b>
          </div>
          <div className="gmp-effort-row">
            <span className="metaitem">
              <FileDiff size={14} aria-hidden="true" /> files re-edited
            </span>
            <b className="tnum">{detail.effort.reEdits}</b>
          </div>
          <div className="gmp-effort-row">
            <span className="metaitem">
              <FileCode size={14} aria-hidden="true" /> files in area
            </span>
            <b className="tnum">{detail.effort.files}</b>
          </div>
          <div className="gmp-effort-row gmp-effort-spend">
            <span className="metaitem">
              <Coins size={14} aria-hidden="true" /> estimated ai spend
            </span>
            <b className="tnum">${detail.effort.spend.toFixed(2)}</b>
          </div>
        </div>
        <button type="button" className="gmp-contribute">
          <Share2 size={14} aria-hidden="true" /> contribute these {detail.sessions} sessions
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/* ====================================================================== */
/* === CHANGES VIEW (lane-based git graph) ============================== */
/* ====================================================================== */

/* a hand-rolled git graph. time flows DOWN. lane 0 = default branch (develop).
   commits are square dots (filled = recorded AI session behind it, hollow =
   none). open branches fork out to tip cards; merged branches rejoin as dimmed
   chips. 90° square elbows ONLY — no curves, no color. */
const LANE_W = 64
const ROW_H = 52
const DOT = 11

/* commits down lane 0, plus fork/merge events. y = row index. */
const COMMITS = [
  { id: 'k1', row: 0, lane: 0, filled: true, hash: 'f1a920', msg: 'Add redaction tests', recorded: true },
  { id: 'k2', row: 1, lane: 0, filled: false, hash: '8c0e41', msg: 'Bump deps', recorded: false },
  { id: 'k3', row: 2, lane: 0, filled: true, hash: 'a3f9c1', msg: 'Fix pipeline bug', recorded: true, fork: 1 },
  { id: 'k4', row: 3, lane: 0, filled: true, hash: 'b7e220', msg: 'stream replay path', recorded: true, fork: 2 },
  { id: 'k5', row: 4, lane: 0, filled: false, hash: 'd14c0a', msg: 'Merge fix--kickstart-config', recorded: false, mergeFrom: 2 },
  { id: 'k6', row: 5, lane: 0, filled: true, hash: 'c1d4a3', msg: 'squarify treemap', recorded: true },
]
/* open branches forking from a commit row, on their own lane. */
const BRANCHES = [
  {
    id: 'b1',
    lane: 1,
    forkRow: 2,
    tipRow: 2,
    name: 'feat/map-review-contribute',
    human: 'Map review contribute',
    raw: 'feat/map-review-contribute',
    life: 'active',
    last: 'last worked 5h ago',
    facts: '8 new updates · 136 files · 70 conversations · 98 requests · +39/−22 connections',
    violations: 3,
    filled: true,
  },
]
/* merged branches that rejoined — dimmed chips at their merge commit. */
const MERGED = [
  { id: 'm1', mergeRow: 4, lane: 2, name: 'fix--kickstart-config', human: 'Kickstart config', kind: 'folded', when: '3d ago' },
]
const REVERTED = [{ id: 'r1', name: 'feat/experimental-cache', human: 'Experimental cache', when: '1wk ago' }]

const LIFE = {
  active: { label: 'active', sub: '< 3 days', cls: 'gmp-life-active' },
  idle: { label: 'idle', sub: '3–14 days', cls: 'gmp-life-idle' },
  stale: { label: 'stale', sub: '> 2 weeks', cls: 'gmp-life-stale' },
}

export function ChangesView({ theme }) {
  void theme
  const [selected, setSelected] = useState('b1')
  const [showOlder, setShowOlder] = useState(false)

  const laneCount = 3
  const gutterW = laneCount * LANE_W + 24
  const gutterH = (COMMITS.length + 1) * ROW_H

  const laneX = (lane) => 20 + lane * LANE_W
  const rowY = (row) => 26 + row * ROW_H

  return (
    <div className="gmp-root gmp-changes-root">
      <div className="gmp-changes-head">
        <div>
          <span className="label">lines of work · peasant-labs/peasant</span>
          <div className="gmp-changes-sub mono">default branch develop · 1 open · 1 merged</div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm">
          <Box size={14} aria-hidden="true" /> open the map
        </button>
      </div>

      <div className="gmp-changes-body">
        {showOlder && (
          <button type="button" className="gmp-older" onClick={() => setShowOlder(false)}>
            <ChevronDown size={13} aria-hidden="true" /> hide older
          </button>
        )}

        <div className="gmp-graph" role="list" aria-label="branches and commits">
          {/* SVG lane gutter: verticals + 90° elbows, square dots as html */}
          <div className="gmp-gutter" style={{ width: gutterW, minHeight: gutterH }}>
            <svg
              className="gmp-gutter-svg"
              viewBox={`0 0 ${gutterW} ${gutterH}`}
              width={gutterW}
              height={gutterH}
              aria-hidden="true"
            >
              {/* lane 0 vertical (default branch) */}
              <line
                x1={laneX(0)}
                y1={rowY(0)}
                x2={laneX(0)}
                y2={rowY(COMMITS.length - 1)}
                stroke="var(--ink-4)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              {/* dashed tail above (started before this view) */}
              <line
                x1={laneX(0)}
                y1={4}
                x2={laneX(0)}
                y2={rowY(0)}
                stroke="var(--ink-5)"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              {/* branch b1: fork elbow out + vertical (square 90°) */}
              <polyline
                points={`${laneX(0)},${rowY(2)} ${laneX(1)},${rowY(2)} ${laneX(1)},${rowY(2) + 18}`}
                fill="none"
                stroke="var(--rule-strong)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              {/* merged m1: fork out earlier + merge elbow back in (dashed join) */}
              <polyline
                points={`${laneX(0)},${rowY(2)} ${laneX(2)},${rowY(2)} ${laneX(2)},${rowY(4)} ${laneX(0)},${rowY(4)}`}
                fill="none"
                stroke="var(--ink-5)"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* square commit dots on lane 0 */}
            {COMMITS.map((c) => (
              <span
                key={c.id}
                className={'gmp-dot' + (c.filled ? ' gmp-dot-filled' : '')}
                style={{ left: laneX(c.lane) - DOT / 2, top: rowY(c.row) - DOT / 2 }}
                title={`${c.hash} — ${c.msg}${c.recorded ? ' (recorded session)' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>

          {/* the rows: commit captions + tip cards + merged chips */}
          <div className="gmp-rows">
            {COMMITS.map((c) => (
              <div key={c.id} className="gmp-commit-row" style={{ height: ROW_H }}>
                <span className="mono gmp-commit-row-hash">{c.hash}</span>
                <span className="gmp-commit-row-msg">{c.msg}</span>
                {c.recorded && (
                  <span className="gmp-commit-row-rec" title="a recorded AI session is behind this commit">
                    <CircleDot size={12} aria-hidden="true" /> recorded
                  </span>
                )}
              </div>
            ))}

            {/* open-branch tip card, absolutely placed at its fork row, lane 1 */}
            {BRANCHES.map((b) => {
              const on = selected === b.id
              const life = LIFE[b.life]
              return (
                <button
                  key={b.id}
                  type="button"
                  role="listitem"
                  className={'gmp-tip-card' + (on ? ' gmp-tip-sel' : '')}
                  style={{ top: rowY(b.tipRow) + 24, left: laneX(b.lane) + 26 }}
                  aria-pressed={on}
                  onClick={() => setSelected(b.id)}
                >
                  <span className="gmp-tip-top">
                    <GitBranch size={14} aria-hidden="true" />
                    <span className="gmp-tip-human">{b.human}</span>
                    <span className={'gmp-life ' + life.cls} title={life.sub}>
                      {life.label}
                    </span>
                  </span>
                  <span className="mono gmp-tip-raw">{b.raw}</span>
                  <span className="gmp-tip-facts mono">{b.facts}</span>
                  <span className="gmp-tip-foot">
                    {b.violations > 0 && (
                      <span className="gmp-tip-warn">
                        <TriangleAlert size={12} aria-hidden="true" /> <span className="tnum">{b.violations}</span> rule breaks
                      </span>
                    )}
                    <span className="gmp-tip-last">{b.last}</span>
                    <span className="gmp-tip-view">
                      view <ArrowRight size={12} aria-hidden="true" />
                    </span>
                  </span>
                </button>
              )
            })}

            {/* merged chip at its merge commit */}
            {MERGED.map((m) => (
              <button
                key={m.id}
                type="button"
                role="listitem"
                className="gmp-merged-chip"
                style={{ top: rowY(m.mergeRow) - 10, left: laneX(m.lane) + 26 }}
                onClick={() => setSelected(m.id)}
              >
                <GitMerge size={13} aria-hidden="true" /> folded in · {m.human} · {m.when}
              </button>
            ))}
          </div>
        </div>

        {/* already-merged + reverted section */}
        <div className="gmp-merged-sec">
          <div className="sb-head gmp-merged-head">already merged in</div>
          <div className="gmp-merged-list">
            {REVERTED.map((r) => (
              <button key={r.id} type="button" className="gmp-merged-chip gmp-merged-revert" onClick={() => setSelected(r.id)}>
                <GitMerge size={13} aria-hidden="true" /> reverted · {r.human} · then undone · {r.when}
              </button>
            ))}
            {!showOlder && (
              <button type="button" className="gmp-older" onClick={() => setShowOlder(true)}>
                <ChevronRight size={13} aria-hidden="true" /> show older
              </button>
            )}
          </div>
        </div>

        {/* legend / explainer */}
        <div className="gmp-changes-legend">
          <span className="gmp-legend-item">
            <span className="gmp-dot gmp-dot-filled gmp-dot-static" aria-hidden="true" /> recorded commit
          </span>
          <span className="gmp-legend-item">
            <span className="gmp-dot gmp-dot-static" aria-hidden="true" /> no session captured
          </span>
          <span className="gmp-legend-item gmp-legend-dim">tip cards = open lines of work · chips = merged</span>
        </div>
      </div>
    </div>
  )
}

/* ====================================================================== */
/* === CHANGE DETAIL VIEW =============================================== */
/* ====================================================================== */

/* one line of work, told in full. a deterministic caption with clickable
   font-mono fragments; the lines-of-work footnotes; per-file lazy diffs with
   per-hunk conversation attribution; an inline annotation chip. */
const CAP_FRAGS = {
  files: '136 files',
  conversations: '70 conversations',
  requests: '98 requests',
  conn: '+39/−22 connections',
}

const CHANGE_FILES = [
  {
    path: 'internal/codegraph/build.go',
    dir: 'internal/codegraph',
    status: 'added',
    convos: 3,
    hunks: [
      {
        attrib: { id: 'c1d4a3f9', title: 'Build deterministic node layout', hash: 'c1d4a3' },
        lines: [
          { sign: 'ctx', gut: '1', t: 'package codegraph' },
          { sign: 'add', gut: '2', t: '' },
          { sign: 'add', gut: '3', t: 'func Build(g *Graph) *Layout {' },
          { sign: 'add', gut: '4', t: '  nodes := squarify(g.Nodes())' },
          { sign: 'add', gut: '5', t: '  return &Layout{Nodes: nodes}' },
          { sign: 'add', gut: '6', t: '}' },
        ],
      },
    ],
  },
  {
    path: 'internal/ingest/pipeline.go',
    dir: 'internal/ingest',
    status: 'changed',
    convos: 2,
    hunks: [
      {
        attrib: { id: 'a3f9c1d4', title: 'Refactor ingest pipeline to stream', hash: 'a3f9c1' },
        lines: [
          { sign: 'ctx', gut: '211', t: 'func (p *Pipeline) Run(ctx context.Context) error {' },
          { sign: 'del', gut: '212', t: '  sessions, err := loadAll(ctx, p.src)' },
          { sign: 'add', gut: '212', t: '  stream, err := openStream(ctx, p.src)' },
          { sign: 'ctx', gut: '213', t: '  if err != nil { return err }' },
        ],
      },
      {
        attrib: { id: '7b21e0aa', title: 'Add backpressure to the reader', hash: 'b7e220' },
        lines: [
          { sign: 'ctx', gut: '240', t: '  for s := range stream {' },
          { sign: 'add', gut: '241', t: '    sem <- struct{}{}' },
          { sign: 'add', gut: '242', t: '    go p.process(s, sem)' },
          { sign: 'ctx', gut: '243', t: '  }' },
        ],
      },
    ],
  },
  {
    path: 'cmd/peasant/main.go',
    dir: 'cmd/peasant',
    status: 'deleted',
    convos: 1,
    hunks: [
      {
        attrib: { id: 'ff21e8a0', title: 'Drop the legacy entrypoint', hash: 'ff21e8' },
        lines: [
          { sign: 'del', gut: '1', t: 'package main' },
          { sign: 'del', gut: '2', t: 'func main() { legacy.Run() }' },
        ],
      },
    ],
  },
]

const STATUS_TONE = {
  added: 'chip-ok',
  changed: '',
  deleted: 'chip-err',
  renamed: 'chip-warn',
}

/* one file's lazy diff. closed by default; opens to render hunks with per-hunk
   conversation attribution. */
function DiffFile({ file, open, onToggle }) {
  return (
    <div className="gmp-file">
      <button type="button" className="gmp-file-head" aria-expanded={open} onClick={onToggle}>
        {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        <span className="mono gmp-file-path">{file.path}</span>
        <span className={'chip gmp-file-status ' + STATUS_TONE[file.status]}>{file.status}</span>
        <span className="gmp-file-convos metaitem">
          <MessageSquare size={13} aria-hidden="true" /> <span className="tnum">{file.convos}</span>
        </span>
      </button>
      {open && (
        <div className="gmp-file-body">
          {file.hunks.map((h, i) => (
            <div key={i} className="gmp-hunk">
              <div className="gmp-hunk-attrib">
                <CornerDownRight size={13} aria-hidden="true" />
                <span className="gmp-hunk-from">from</span>
                <button type="button" className="gmp-hunk-link">
                  {h.attrib.title}
                </button>
                <span className="mono gmp-hunk-hash">{h.attrib.hash}</span>
              </div>
              <div className="diff">
                {h.lines.map((d, j) => (
                  <div className={'dl ' + d.sign} key={j}>
                    <span className="rail" />
                    <span className="gut tnum">{d.gut}</span>
                    <span className="sign">{d.sign === 'add' ? '+' : d.sign === 'del' ? '−' : ''}</span>
                    <span className="t">{d.t || ' '}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ChangeDetailView({ theme }) {
  void theme
  const [openFiles, setOpenFiles] = useState({ 'internal/ingest/pipeline.go': true })
  const [jumpTarget, setJumpTarget] = useState(null)
  const [annotation, setAnnotation] = useState('good handoff')
  const [annotOpen, setAnnotOpen] = useState(false)
  const [annotDraft, setAnnotDraft] = useState('')
  const fileRefs = useRef({})
  const scrollRef = useRef(null)

  function toggleFile(path) {
    setOpenFiles((o) => ({ ...o, [path]: !o[path] }))
  }

  function jumpTo(fragKey, filePath) {
    setJumpTarget(fragKey)
    if (filePath) {
      setOpenFiles((o) => ({ ...o, [filePath]: true }))
      const el = fileRefs.current[filePath]
      const scroller = scrollRef.current
      if (el && scroller) {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        scroller.scrollTo({ top: el.offsetTop - 12, behavior: reduce ? 'auto' : 'smooth' })
      }
    }
  }

  function saveAnnotation(e) {
    e.preventDefault()
    if (annotDraft.trim()) setAnnotation(annotDraft.trim())
    setAnnotOpen(false)
    setAnnotDraft('')
  }

  return (
    <div className="gmp-root gmp-detail-root" ref={scrollRef}>
      <div className="gmp-detail-head">
        <div className="crumb">
          review <ChevronRight size={13} aria-hidden="true" /> peasant{' '}
          <ChevronRight size={13} aria-hidden="true" />{' '}
          <span className="cur">feat/map-review-contribute</span>
        </div>
        <div className="gmp-detail-title">Map review contribute</div>

        {/* deterministic caption with clickable proof-jump fragments */}
        <p className="gmp-caption">
          this line of work touched{' '}
          <button type="button" className={'gmp-frag' + (jumpTarget === 'files' ? ' gmp-frag-on' : '')} onClick={() => jumpTo('files', 'internal/codegraph/build.go')}>
            {CAP_FRAGS.files}
          </button>{' '}
          across{' '}
          <button type="button" className={'gmp-frag' + (jumpTarget === 'conversations' ? ' gmp-frag-on' : '')} onClick={() => jumpTo('conversations')}>
            {CAP_FRAGS.conversations}
          </button>{' '}
          and{' '}
          <button type="button" className={'gmp-frag' + (jumpTarget === 'requests' ? ' gmp-frag-on' : '')} onClick={() => jumpTo('requests')}>
            {CAP_FRAGS.requests}
          </button>
          , reshaping{' '}
          <button type="button" className={'gmp-frag' + (jumpTarget === 'conn' ? ' gmp-frag-on' : '')} onClick={() => jumpTo('conn')}>
            {CAP_FRAGS.conn}
          </button>
          .
        </p>
        <span className="gmp-caption-hint mono">click any number to jump to its proof</span>
      </div>

      {/* signal band (renders with friction) */}
      <div className="gmp-signals">
        <span className="gmp-signal">
          <RotateCw size={14} aria-hidden="true" /> retry loop · <b className="tnum">4×</b> in pipeline.go
        </span>
        <span className="gmp-signal gmp-signal-warn">
          <TriangleAlert size={14} aria-hidden="true" /> <b className="tnum">3</b> rule breaks
        </span>
        <span className="gmp-signal">
          recurring friction · <span className="mono">build.go</span> — unparsed import <b className="tnum">2×</b> across 2 conversations
        </span>
      </div>

      {/* lines of work footnotes / totals */}
      <div className="gmp-totals">
        <span className="metaitem tnum">
          <FileDiff size={14} aria-hidden="true" /> 136 files touched
        </span>
        <span className="metaitem tnum">
          <span className="gmp-add">+39</span>/<span className="gmp-del">−22</span> connections
        </span>
        <span className="metaitem tnum">
          <Hash size={14} aria-hidden="true" /> ai wrote ≈12.4k tokens
        </span>
        <span className="metaitem tnum">
          <Coins size={14} aria-hidden="true" /> est. spend $4.81
        </span>
      </div>

      {/* files changed with lazy per-file diffs + per-hunk attribution */}
      <div className="gmp-detail-sec">
        <div className="sb-head gmp-detail-sechead">files changed · click a path to open its diff</div>
        <div className="gmp-files">
          {CHANGE_FILES.map((f) => (
            <div key={f.path} ref={(el) => (fileRefs.current[f.path] = el)}>
              <DiffFile file={f} open={!!openFiles[f.path]} onToggle={() => toggleFile(f.path)} />
            </div>
          ))}
        </div>
      </div>

      {/* inline annotation chip + popover */}
      <div className="gmp-detail-sec">
        <div className="sb-head gmp-detail-sechead">your annotation</div>
        <div className="gmp-annot">
          {annotation && (
            <span className="gmp-label-chip gmp-annot-chip">
              <Tag size={12} aria-hidden="true" /> {annotation}
              <button type="button" className="gmp-annot-x" aria-label="remove annotation" onClick={() => setAnnotation('')}>
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          )}
          <button
            type="button"
            className="gmp-annot-add"
            aria-expanded={annotOpen}
            onClick={() => setAnnotOpen((o) => !o)}
          >
            <Tag size={13} aria-hidden="true" /> {annotation ? 'change label' : 'add a label'}
          </button>
          {annotOpen && (
            <form className="gmp-annot-pop" onSubmit={saveAnnotation}>
              <span className="label">user.custom_label</span>
              <input
                className="input"
                type="text"
                autoFocus
                value={annotDraft}
                onChange={(e) => setAnnotDraft(e.target.value)}
                placeholder="e.g. good handoff"
                aria-label="annotation value"
              />
              <div className="gmp-annot-pop-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAnnotOpen(false)}>
                  cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  <Check size={13} aria-hidden="true" /> save
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* exits */}
      <div className="gmp-exits">
        <button type="button" className="btn btn-secondary btn-sm">
          <Box size={14} aria-hidden="true" /> see this work on the code map
        </button>
        <button type="button" className="btn btn-secondary btn-sm">
          <Share2 size={14} aria-hidden="true" /> share 70 conversations…
        </button>
        <button type="button" className="btn btn-secondary btn-sm">
          <FileText size={14} aria-hidden="true" /> copy recap
        </button>
        <code className="gmp-gitdiff mono">git diff develop...feat/map-review-contribute</code>
      </div>
      <p className="gmp-boundary mono">
        shows what changed and the recorded work behind it — not whether the change is correct or secure.
      </p>
    </div>
  )
}

import { useMemo, useState } from 'react'
import {
  Search,
  X,
  ArrowRight,
  Box,
  Folder,
  FileCode,
  GitCommitHorizontal,
  Share2,
  RotateCw,
  Coins,
  Link2,
  CornerDownRight,
  Tag,
  FileDiff,
  Layers,
} from 'lucide-react'
import { RailSection, TimeStrip, ConnectionPill, DataState, TeachingEmptyState } from '../../ui'
import { Changes, ChangeDetail, CodeMap, CodeMapComposition } from '../../ui/graph/index.js'

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

/* ---- kit adapter: ONE parent-linked tree fed to the REAL <CodeMap> ------------
   full-lift: this fixture is now shaped as a CodeMapPayload (the
   SAME cooked prop contract peasant's map adapter produces from GET
   /api/v1/map/{projectHash} — src/ui/graph/types.js MapNodePayload), not a raw
   MapCanvas dataset. The demo renders through the real <CodeMapComposition>, so
   this mockup and the peasant app exercise byte-identical composition + adapter
   code, not two parallel implementations.

   the three per-grain MAP_NODES sets become tree LAYERS: overview modules are
   layer 0, folders layer 1 (parented by path prefix), files layer 2 (parented by
   the folder their id's first segment names). `order` is the set's array index —
   MapCanvas's layer/order contract positions rows/order from these
   fields, not tree depth / payload position (exercised with shuffled/non-depth
   fixtures in fairtrade's own scripts/smoke-map.mjs + MapCanvas.stories.jsx).

   ids are the SAME strings NODE_DETAIL keys on, so selecting a node still
   resolves the bespoke rail. */
const FILE_PARENT = {
  'ingest/pipeline.go': 'internal/ingest',
  'ingest/replay.go': 'internal/ingest',
  'codegraph/build.go': 'internal/codegraph',
  'codegraph/layout.go': 'internal/codegraph',
  'map/Canvas.tsx': 'web/src/map',
  'map/Rail.tsx': 'web/src/map',
}

const CODE_MAP_PAYLOAD = (() => {
  const roots = MAP_NODES.overview.map((n, order) => ({
    id: n.id,
    kind: 'module',
    name: n.name,
    loc: n.loc,
    recordedFiles: n.recorded,
    totalFiles: n.files,
    layer: 0,
    order,
  }))
  // folders parent under the overview module that prefixes their id
  // (internal/ingest → internal, web/src/map → web, cmd/peasant → cmd).
  const folders = MAP_NODES.folders.map((n, order) => ({
    id: n.id,
    kind: 'package',
    name: n.name,
    loc: n.loc,
    recordedFiles: n.recorded,
    totalFiles: n.files,
    parent: n.id.split('/')[0],
    layer: 1,
    order,
  }))
  const files = MAP_NODES.files.map((n, order) => ({
    id: n.id,
    kind: 'file',
    name: n.name,
    loc: n.loc,
    recordedFiles: n.recorded,
    totalFiles: n.files,
    parent: FILE_PARENT[n.id],
    layer: 2,
    order,
  }))

  // structureEdges: the import-kind edges only (CodeMapPayload has no activityEdges —
  // co-edit coupling surfaces via the rail's "usually changed alongside" rows instead,
  // matching the real wire contract).
  const structureEdges = [...MAP_EDGES.folders, ...MAP_EDGES.files]
    .filter((e) => e.kind === 'import')
    .map((e) => ({ from: e.from, to: e.to, count: e.weight ?? 1 }))

  // violations: edge-pair records (EdgeViolationPayload), aggregated onto each
  // endpoint by the shared CodeMap adapter (countViolationsByEndpoint) — chosen so
  // the resulting per-node counts match the DEMO's original fixture (codegraph 1,
  // build.go 1, web/src/map 2, Canvas.tsx 2).
  const violations = [
    { kind: 'cycle', from: 'internal/codegraph', to: 'codegraph/build.go' },
    { kind: 'wrongway', from: 'web/src/map', to: 'map/Canvas.tsx' },
    { kind: 'cycle', from: 'web/src/map', to: 'map/Canvas.tsx' },
  ]

  return { repoFound: true, nodes: [...roots, ...folders, ...files], structureEdges, violations }
})()

/* ---- kit adapter: the session sparkline → TimeStrip buckets ----------------
   SPARK levels (0..4) carry both the bar HEIGHT (via value) and the FILL
   intensity; SPARK_DATES label each bucket. oldest → newest, so the rightmost
   is "now" exactly as before. */
const SPARK_BUCKETS = SPARK.map((lvl, i) => ({
  label: SPARK_DATES[i],
  value: lvl,
  intensity: lvl,
}))

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
  const [selected, setSelected] = useState(null) // node id (keys NODE_DETAIL)
  const [showAll, setShowAll] = useState(false)
  const [taskFilter, setTaskFilter] = useState('')
  const [scrub, setScrub] = useState(1) // TimeStrip playhead fraction 0..1
  // MOCK connection feed — there is no backend; the toolbar button cycles the
  // state so the ConnectionPill + DataState lost-program panel can be seen live.
  const [conn, setConn] = useState('live')
  // controlled CodeMap zoom (grain + per-node expansion) — F16: open to Folders
  // (package) grain, same default as the peasant app.
  const [zoom, setZoom] = useState({ level: 'package', expanded: [] })

  // the selected node, looked up in the ORIGINAL MAP_NODES (all grains
  // flattened) so the bespoke rail still reads recorded/files/kind/loc. ids are
  // unique across grains and match both NODE_DETAIL and the MapCanvas tree.
  const nodeById = useMemo(() => {
    const m = {}
    for (const set of Object.values(MAP_NODES)) for (const n of set) m[n.id] = n
    return m
  }, [])
  const detail = selected ? NODE_DETAIL[selected] : null
  const selNode = selected ? nodeById[selected] : null

  const tasks = showAll ? ALL_TASKS : RECENT_TASKS
  const filteredTasks = useMemo(() => {
    const q = taskFilter.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter((t) => t.title.toLowerCase().includes(q))
  }, [tasks, taskFilter])

  // cycle the mock connection so the disconnected panel + retry are reachable.
  const CONN_CYCLE = { live: 'connecting', connecting: 'disconnected', disconnected: 'live' }
  const nextConn = CONN_CYCLE[conn]

  const toolbar = (
    <>
      <ConnectionPill status={conn} />
      <span className="gmp-toolbar-spacer" />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setConn(nextConn)}
        title={`simulate connection: ${nextConn}`}
      >
        <RotateCw size={13} aria-hidden="true" /> simulate {nextConn}
      </button>
    </>
  )

  const rail = detail ? (
    <RailSection
      title="code area"
      icon={Folder}
      meta={
        <button type="button" className="gmp-rail-close" aria-label="clear selection" onClick={() => setSelected(null)}>
          <X size={14} aria-hidden="true" className="lucide" />
        </button>
      }
    >
      <NodeRail
        node={selNode}
        detail={detail}
        onSelectNode={(id) => nodeById[id] && setSelected(id)}
      />
    </RailSection>
  ) : (
    <RailSection title="project" icon={Box} meta={<span className="mono">peasant</span>}>
      <ProjectRail
        tasks={filteredTasks}
        total={ALL_TASKS.length}
        showAll={showAll}
        onShowAll={() => setShowAll(true)}
        filter={taskFilter}
        onFilter={setTaskFilter}
      />
    </RailSection>
  )

  return (
    <div className="gmp-root">
      {/* full-lift: the shell (toolbar + rail + legend + canvas), not
          just the canvas, is the shared <CodeMapComposition> — the SAME
          composition the peasant app mounts at /map/{project}. `rail`/`toolbar`
          stay host-specific slots (this demo's mock data vs. peasant's real API
          data); `canvasSlot` substitutes this demo's MOCK connection-state
          simulation for the default plain <CodeMap> render (peasant instead
          slots its own WS/REST loading-state machine here). CodeMapComposition
          renders its own nested `.gmp-root` frame (the shared shell); this outer
          one groups it with the page-level TimeStrip below, exactly as before. */}
      <CodeMapComposition
        rail={rail}
        toolbar={toolbar}
        sheetTitle="node detail"
        sheetMeta={selected ?? 'project'}
        height={480}
        ariaLabel="peasant code map"
        canvasSlot={
          <DataState
            status={conn}
            empty={false}
            onRetry={() => setConn('live')}
            emptyState={
              <TeachingEmptyState
                title="no map yet"
                body="record a session with the local program, then the code map fills in."
                command="peasant ingest"
              />
            }
          >
            <CodeMap
              payload={CODE_MAP_PAYLOAD}
              zoom={zoom}
              onZoomChange={setZoom}
              selectedId={selected}
              onSelect={(id) => setSelected(id)}
              height={480}
              ariaLabel="peasant code map"
            />
          </DataState>
        }
      />

      <div style={{ flex: 'none' }}>
        <TimeStrip
          buckets={SPARK_BUCKETS}
          value={scrub}
          onScrub={setScrub}
          branches={BRANCH_CHIPS.map((b) => ({ label: `${b.name} +${b.ahead}` }))}
          label="session activity"
        />
      </div>
    </div>
  )
}

/* project (unselected) rail: coverage line, recent + all conversations. */
function ProjectRail({ tasks, total, showAll, onShowAll, filter, onFilter }) {
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
              <button type="button" className="gmp-task-row">
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
function NodeRail({ node, detail, onSelectNode }) {
  const cov = node.recorded / node.files
  return (
    <div className="sidebar gmp-rail-inner">
      <div className="sb-sec gmp-rail-node-head">
        {/* the "code area" label + clear-selection control now live in the
            enclosing RailSection's title + meta; this head keeps the identity. */}
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

/* the develop history as a ChangesPayload fixture (the cooked adapter-output shape the lifted
   <Changes> takes). lane 0 = develop's recent commits; an open feature change forks at a3f9c1 and
   sits at its tip; a fix change merged back at d14c0a; an experimental change was merged then
   reverted. The lifted component derives the lane geometry (buildChangesGraph) and draws it on the
   kit CommitGraph — so this demo and the peasant app render byte-identically from the same payload.
   times are pinned to a fixed reference so the relative labels are stable. hashes / messages /
   branch names are USER CONTENT — case preserved. */
const CHANGES_NOW = Date.UTC(2026, 5, 27, 12, 0, 0)
const H = 3600e3
const D = 24 * H
/** @type {import('../../ui/graph/index.js').ChangesPayload} */
const CHANGES_FIXTURE = {
  repoFound: true,
  defaultBranch: 'develop',
  recentCommits: [
    { hash: 'c1d4a3', subject: 'squarify treemap', timeMs: CHANGES_NOW - 5 * H, hasSession: true },
    { hash: 'd14c0a', subject: 'Merge fix--kickstart-config', timeMs: CHANGES_NOW - 3 * D, hasSession: false },
    { hash: 'b7e220', subject: 'stream replay path', timeMs: CHANGES_NOW - 1 * D, hasSession: true },
    { hash: 'a3f9c1', subject: 'Fix pipeline bug', timeMs: CHANGES_NOW - 2 * D, hasSession: true },
    { hash: '8c0e41', subject: 'Bump deps', timeMs: CHANGES_NOW - 2 * D, hasSession: false },
    { hash: 'f1a920', subject: 'Add redaction tests', timeMs: CHANGES_NOW - 3 * D, hasSession: true },
  ],
  changes: [
    { branch: 'feat/map-review-contribute', merged: false, baseHash: 'a3f9c1', tipCommitMs: CHANGES_NOW - 5 * H, sessionCount: 2, aheadCount: 3, behindCount: 0, filesChanged: 136, taskCount: 70, newEdges: 39, removedEdges: 22, violations: 3 },
    { branch: 'fix--kickstart-config', merged: true, baseHash: 'a3f9c1', mergeCommitHash: 'd14c0a', mergedAtMs: CHANGES_NOW - 3 * D, sessionCount: 0, aheadCount: 1, behindCount: 0, filesChanged: 4, taskCount: 2, newEdges: 0, removedEdges: 0, violations: 0 },
    { branch: 'feat/experimental-cache', merged: true, reverted: true, mergedAtMs: CHANGES_NOW - 7 * D, sessionCount: 0, aheadCount: 0, behindCount: 0, filesChanged: 0, taskCount: 0, newEdges: 0, removedEdges: 0, violations: 0 },
  ],
}

export function ChangesView({ theme, onNavigate }) {
  void theme
  const [selectedId, setSelectedId] = useState('tip:feat/map-review-contribute')
  return (
    <Changes
      payload={CHANGES_FIXTURE}
      projectLabel="peasant-labs/peasant"
      nowMs={CHANGES_NOW}
      selectedId={selectedId}
      onSelectChange={(c) => { setSelectedId(c.id); onNavigate?.('change-detail') }}
      onOpenMap={() => onNavigate?.('map')}
    />
  )
}

/* ====================================================================== */
/* === CHANGE DETAIL VIEW =============================================== */
/* ====================================================================== */

/* one line of work, told in full — the demo's ChangeDetailView is now a thin wrapper over the lifted
   <ChangeDetail>, fed a ChangeDetailPayload fixture + a per-file ChangeDiffPayload (the lazy diff,
   resolved on expand). The same component the peasant app mounts → byte-identical render. */

/* the lazy per-file diffs (ChangeDiffPayload), keyed by path. each hunk carries the recorded session
   that wrote it (sessionId/sessionTitle = the per-hunk attribution). */
const DETAIL_BRANCH = 'feat/map-review-contribute'
const DIFF_BY_FILE = {
  'internal/codegraph/build.go': {
    branch: DETAIL_BRANCH, file: 'internal/codegraph/build.go', status: 'A', binary: false, truncated: false,
    hunks: [{
      oldStart: 1, oldLines: 1, newStart: 1, newLines: 6,
      sessionId: 'c1d4a3f9', sessionTitle: 'Build deterministic node layout',
      lines: [
        { kind: 'context', text: 'package codegraph' },
        { kind: 'add', text: '' },
        { kind: 'add', text: 'func Build(g *Graph) *Layout {' },
        { kind: 'add', text: '  nodes := squarify(g.Nodes())' },
        { kind: 'add', text: '  return &Layout{Nodes: nodes}' },
        { kind: 'add', text: '}' },
      ],
    }],
  },
  'internal/ingest/pipeline.go': {
    branch: DETAIL_BRANCH, file: 'internal/ingest/pipeline.go', status: 'M', binary: false, truncated: false,
    hunks: [
      {
        oldStart: 211, oldLines: 3, newStart: 211, newLines: 3,
        sessionId: 'a3f9c1d4', sessionTitle: 'Refactor ingest pipeline to stream',
        lines: [
          { kind: 'context', text: 'func (p *Pipeline) Run(ctx context.Context) error {' },
          { kind: 'del', text: '  sessions, err := loadAll(ctx, p.src)' },
          { kind: 'add', text: '  stream, err := openStream(ctx, p.src)' },
          { kind: 'context', text: '  if err != nil { return err }' },
        ],
      },
      {
        oldStart: 240, oldLines: 2, newStart: 240, newLines: 4,
        sessionId: '7b21e0aa', sessionTitle: 'Add backpressure to the reader',
        lines: [
          { kind: 'context', text: '  for s := range stream {' },
          { kind: 'add', text: '    sem <- struct{}{}' },
          { kind: 'add', text: '    go p.process(s, sem)' },
          { kind: 'context', text: '  }' },
        ],
      },
    ],
  },
  'cmd/peasant/main.go': {
    branch: DETAIL_BRANCH, file: 'cmd/peasant/main.go', status: 'D', binary: false, truncated: false,
    hunks: [{
      oldStart: 1, oldLines: 2, newStart: 0, newLines: 0,
      sessionId: 'ff21e8a0', sessionTitle: 'Drop the legacy entrypoint',
      lines: [
        { kind: 'del', text: 'package main' },
        { kind: 'del', text: 'func main() { legacy.Run() }' },
      ],
    }],
  },
}

const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i))
/** @type {import('../../ui/graph/index.js').ChangeDetailPayload} */
const CHANGE_DETAIL_FIXTURE = {
  branch: DETAIL_BRANCH,
  baseRef: 'a3f9c1',
  defaultBranch: 'develop',
  files: [
    { path: 'internal/codegraph/build.go', status: 'A', linesAdded: 5, linesRemoved: 0 },
    { path: 'internal/ingest/pipeline.go', status: 'M', linesAdded: 3, linesRemoved: 1 },
    { path: 'cmd/peasant/main.go', status: 'D', linesAdded: 0, linesRemoved: 2 },
  ],
  slice: { nodes: [], structureEdges: [], activityEdges: [] },
  newEdges: rep(39, (i) => ({ from: `n${i}`, to: `m${i}`, count: 1 })),
  removedEdges: rep(22, (i) => ({ from: `r${i}`, to: `s${i}`, count: 1 })),
  newNodes: [],
  removedNodes: [],
  violations: rep(3, (i) => ({ kind: 'cycle', from: `c${i}`, to: `d${i}` })),
  work: rep(70, (i) => ({ sessionId: `sess-${i}`, title: `conversation ${i}`, harness: 'claude-code', binding: 'bound', tasks: [] })),
  unrecordedCommits: [],
  unusual: [],
  frictions: [
    { kind: 'retryLoop', label: 'retry loop', file: 'pipeline.go', count: 4, sessions: 2 },
    { kind: 'recurring', label: 'unparsed import', file: 'build.go', count: 2, sessions: 2 },
  ],
  filesChanged: 136,
  linesAdded: 8,
  linesRemoved: 3,
  outputTokens: 12400,
  costUsd: 4.81,
}

export function ChangeDetailView({ theme }) {
  void theme
  const [annotation, setAnnotation] = useState('good handoff')
  return (
    <ChangeDetail
      payload={CHANGE_DETAIL_FIXTURE}
      getDiff={(f) => DIFF_BY_FILE[f.path] ?? null}
      initialOpenFiles={{ 'internal/ingest/pipeline.go': true }}
      annotation={annotation}
      onSaveAnnotation={setAnnotation}
      onRemoveAnnotation={() => setAnnotation('')}
    />
  )
}

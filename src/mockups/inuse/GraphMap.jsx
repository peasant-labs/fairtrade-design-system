import { useMemo, useRef, useState } from 'react'
import {
  Search,
  TriangleAlert,
  X,
  ArrowRight,
  Box,
  Folder,
  FileCode,
  GitCommitHorizontal,
  GitMerge,
  Share2,
  RotateCw,
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
  Hash,
  FileText,
} from 'lucide-react'
import { CommitGraph, MapCanvas, RailShell, RailSection, TimeStrip, ConnectionPill, DataState, TeachingEmptyState } from '../../ui'

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

/* ---- kit adapter: ONE parent-linked tree fed to MapCanvas ----------------
   the three per-grain MAP_NODES sets become tree DEPTHS: overview modules are
   the roots, folders parent under them by path prefix, files parent under the
   folder whose path-leaf opens their id. MapCanvas owns the semantic-zoom
   (overview/folders/files) + edge-lift + violation-aggregate from this one
   set, so we no longer keep a node set per grain.

   coverage(0..4) = round(recorded / files * 4). kind package|module → folder,
   else file. ids are the SAME strings NODE_DETAIL keys on, so selecting a node
   still resolves the bespoke rail. */
const covOf = (recorded, files) =>
  files > 0 ? Math.min(4, Math.max(0, Math.round((recorded / files) * 4))) : 0

const MAP_DATA = (() => {
  // roots: the overview modules.
  const roots = MAP_NODES.overview.map((n) => ({
    id: n.id,
    label: n.name,
    kind: 'folder',
    loc: n.loc,
    coverage: covOf(n.recorded, n.files),
    violations: n.violations,
  }))
  // folders parent under the overview module that prefixes their id
  // (internal/ingest → internal, web/src/map → web, cmd/peasant → cmd).
  const folders = MAP_NODES.folders.map((n) => ({
    id: n.id,
    label: n.name,
    kind: 'folder',
    loc: n.loc,
    coverage: covOf(n.recorded, n.files),
    violations: n.violations,
    parent: n.id.split('/')[0],
  }))
  // files parent under the folder their id's first segment names
  // (ingest/pipeline.go → internal/ingest, codegraph/build.go →
  // internal/codegraph, map/Canvas.tsx → web/src/map).
  const FILE_PARENT = {
    'ingest/pipeline.go': 'internal/ingest',
    'ingest/replay.go': 'internal/ingest',
    'codegraph/build.go': 'internal/codegraph',
    'codegraph/layout.go': 'internal/codegraph',
    'map/Canvas.tsx': 'web/src/map',
    'map/Rail.tsx': 'web/src/map',
  }
  const files = MAP_NODES.files.map((n) => ({
    id: n.id,
    label: n.name,
    kind: 'file',
    loc: n.loc,
    coverage: covOf(n.recorded, n.files),
    violations: n.violations,
    parent: FILE_PARENT[n.id],
  }))

  // author edges at the leaf grains; MapCanvas lifts them to visible ancestors.
  // import → structure, coedit → activity. `tangle` has no MapCanvas equivalent:
  // we render it as an activity edge AND rely on the target's violation badge to
  // carry the tangle signal (accepted regression — no bespoke red tangle edge).
  const edgeKind = (k) => (k === 'import' ? 'structure' : 'activity')
  const edges = [...MAP_EDGES.folders, ...MAP_EDGES.files].map((e) => ({
    from: e.from,
    to: e.to,
    kind: edgeKind(e.kind),
  }))

  return { nodes: [...roots, ...folders, ...files], edges }
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
      <RailShell
        toolbar={toolbar}
        sheetTitle="node detail"
        sheetMeta={selected ?? 'project'}
        rail={rail}
      >
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
          <MapCanvas
            data={MAP_DATA}
            grain="folders"
            selectedId={selected}
            onSelect={(id) => setSelected(id)}
            height={480}
            ariaLabel="peasant code map"
          />
        </DataState>
      </RailShell>

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

/* the develop history as a CommitGraph dataset (newest-first, lane 0 = develop). a feature lane (1)
   forks at a3f9c1 and is still open (tip); a short fix lane (2) forked + folded back at the merge
   commit d14c0a. `session` = a recorded AI session sits behind the commit (filled dot + sparkle).
   hashes / messages / branch names are USER CONTENT — case preserved. (was a hand-rolled lane graph;
   now the kit CommitGraph, which owns the same square-dot / 90° elbow / amber-scarce language.) */
const HISTORY = [
  { id: 'c1d4a3', lane: 0, parents: ['d14c0a'], message: 'squarify treemap', branch: 'develop', session: true, time: '5h ago' },
  { id: 'd14c0a', lane: 0, parents: ['b7e220', 'k-fix'], message: 'Merge fix--kickstart-config', branch: 'develop', merged: true, time: '3d ago' },
  { id: 'k-fix', lane: 2, parents: ['a3f9c1'], message: 'kickstart config defaults', branch: 'fix--kickstart-config', tip: true, time: '3d ago' },
  { id: 'mrc1', lane: 1, parents: ['a3f9c1'], message: 'wire map review + contribute', branch: 'feat/map-review-contribute', tip: true, session: true, time: '5h ago' },
  { id: 'b7e220', lane: 0, parents: ['a3f9c1'], message: 'stream replay path', branch: 'develop', session: true, time: '1d ago' },
  { id: 'a3f9c1', lane: 0, parents: ['8c0e41'], message: 'Fix pipeline bug', branch: 'develop', session: true, time: '2d ago' },
  { id: '8c0e41', lane: 0, parents: ['f1a920'], message: 'Bump deps', branch: 'develop', time: '2d ago' },
  { id: 'f1a920', lane: 0, parents: [], message: 'Add redaction tests', branch: 'develop', session: true, time: '3d ago' },
]
/* reverted lines of work, listed under the graph (kept from the bespoke view). */
const REVERTED = [{ id: 'r1', name: 'feat/experimental-cache', human: 'Experimental cache', when: '1wk ago' }]

export function ChangesView({ theme, onNavigate }) {
  void theme
  const [selectedId, setSelectedId] = useState('mrc1')
  const [showOlder, setShowOlder] = useState(false)

  return (
    <div className="gmp-root gmp-changes-root">
      <div className="gmp-changes-head">
        <div>
          <span className="label">lines of work · peasant-labs/peasant</span>
          <div className="gmp-changes-sub mono">default branch develop · 1 open · 1 merged</div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate?.('map')}>
          <Box size={14} aria-hidden="true" /> open the map
        </button>
      </div>

      <div className="gmp-changes-body">
        {/* the kit CommitGraph (square dots, 90° elbows, filled = recorded session + sparkle); selecting
            a commit opens the change detail. */}
        <CommitGraph
          className="gmp-cg"
          commits={HISTORY}
          selectedId={selectedId}
          label="develop commit history"
          onSelect={(c) => { setSelectedId(c.id); onNavigate?.('change-detail') }}
          hasMore={!showOlder}
          onShowOlder={() => setShowOlder(true)}
        />

        {/* already-merged + reverted section (kept) */}
        <div className="gmp-merged-sec">
          <div className="sb-head gmp-merged-head">already merged in</div>
          <div className="gmp-merged-list">
            {REVERTED.map((r) => (
              <button key={r.id} type="button" className="gmp-merged-chip gmp-merged-revert" onClick={() => setSelectedId(r.id)}>
                <GitMerge size={13} aria-hidden="true" /> reverted · {r.human} · then undone · {r.when}
              </button>
            ))}
          </div>
        </div>

        {/* legend — the kit's filled = has-session semantics */}
        <div className="gmp-changes-legend">
          <span className="gmp-legend-item">
            <span className="cg-dot cg-dot-filled" style={{ position: 'static', width: 9, height: 9, display: 'inline-block' }} aria-hidden="true" /> commit with a recorded session
          </span>
          <span className="gmp-legend-item">
            <span className="cg-dot cg-dot-hollow" style={{ position: 'static', width: 9, height: 9, display: 'inline-block' }} aria-hidden="true" /> no session captured
          </span>
          <span className="gmp-legend-item gmp-legend-dim">a filled dot also flies a sparkle · select a commit to open it</span>
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

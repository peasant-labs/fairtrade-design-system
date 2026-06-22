import { useMemo, useState } from 'react'
import { Boxes, MessagesSquare, GitFork, Activity } from 'lucide-react'
import {
  MapCanvas,
  RailShell,
  RailSection,
  TimeStrip,
  ConnectionPill,
} from '../ui'

/* 84-app-map: ONE assembled "app shell" showcase — the peasant code map, rebuilt from the system's
   own tier-3 composites. it stitches MapCanvas (the spatial surface), RailShell + RailSection (the
   sticky inspector rail), TimeStrip (the bottom activity scrubber) and a ConnectionPill into a single
   real app, the way peasant's web/src/components/map/ lays it out: a toolbar row above, a canvas
   beside a sticky rail (node details + "conversations that built this"), and a time strip below.

   the only wiring is what makes it read as one app: selecting a node in the canvas drives the rail's
   node panel (deps / coverage / the conversations that touched it). the canvas pans/zooms on user
   input only (no always-on animation). the whole app is bounded to a fixed height so it never
   dominates the page, and every surface clips/scrolls within itself so there is no horizontal
   overflow at 360px. tokens-only inline styles; square, hairline, amber-scarce. */

/* the same realistic peasant repo the MapCanvas story ships — five top folders with their files,
   coverage decoupled from loc, store/ owning the one violation — so the map reads as a real tree. */
const NODES = [
  { id: 'ingest', label: 'ingest', kind: 'folder' },
  { id: 'store', label: 'store', kind: 'folder' },
  { id: 'api', label: 'api', kind: 'folder' },
  { id: 'tui', label: 'tui', kind: 'folder' },
  { id: 'cmd', label: 'cmd', kind: 'folder' },

  { id: 'ingest/stream.go', label: 'ingest/stream.go', kind: 'file', loc: 320, coverage: 3, parent: 'ingest' },
  { id: 'ingest/parse.go', label: 'ingest/parse.go', kind: 'file', loc: 180, coverage: 2, parent: 'ingest' },
  { id: 'ingest/stream_test.go', label: 'ingest/stream_test.go', kind: 'file', loc: 96, coverage: 4, parent: 'ingest' },

  { id: 'store/sqlite.go', label: 'store/sqlite.go', kind: 'file', loc: 210, coverage: 2, parent: 'store', violations: 1 },
  { id: 'store/cache.go', label: 'store/cache.go', kind: 'file', loc: 130, coverage: 1, parent: 'store' },
  { id: 'store/migrations.sql', label: 'store/migrations.sql', kind: 'file', loc: 64, coverage: 0, parent: 'store' },

  { id: 'api/handlers.go', label: 'api/handlers.go', kind: 'file', loc: 140, coverage: 4, parent: 'api' },
  { id: 'api/router.go', label: 'api/router.go', kind: 'file', loc: 88, coverage: 3, parent: 'api' },

  { id: 'tui/dashboard.go', label: 'tui/dashboard.go', kind: 'file', loc: 90, coverage: 1, parent: 'tui' },
  { id: 'tui/widgets.go', label: 'tui/widgets.go', kind: 'file', loc: 72, coverage: 2, parent: 'tui' },

  { id: 'cmd/peasant/main.go', label: 'cmd/peasant/main.go', kind: 'file', loc: 60, coverage: 4, parent: 'cmd' },
]

const EDGES = [
  { from: 'cmd/peasant/main.go', to: 'api/router.go', kind: 'structure', weight: 1 },
  { from: 'api/router.go', to: 'api/handlers.go', kind: 'structure', weight: 3 },
  { from: 'api/handlers.go', to: 'store/sqlite.go', kind: 'structure', weight: 4 },
  { from: 'store/sqlite.go', to: 'ingest/stream.go', kind: 'structure', weight: 2 },
  { from: 'store/cache.go', to: 'store/sqlite.go', kind: 'structure', weight: 2 },
  { from: 'tui/dashboard.go', to: 'api/handlers.go', kind: 'structure', weight: 2 },
  { from: 'tui/widgets.go', to: 'tui/dashboard.go', kind: 'structure', weight: 1 },
  { from: 'ingest/parse.go', to: 'ingest/stream.go', kind: 'structure', weight: 3 },

  { from: 'ingest/stream.go', to: 'store/sqlite.go', kind: 'activity', weight: 5 },
  { from: 'api/handlers.go', to: 'tui/dashboard.go', kind: 'activity', weight: 3 },
]

const DATA = { nodes: NODES, edges: EDGES }

/* the leaf of a slash path, so "ingest/stream.go" shows its filename where the rail wants it short. */
const leaf = (id) => {
  const s = String(id ?? '')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}

/* per-node inspector facts the rail shows: the deps it imports / is imported by (derived from the
   edges), and the conversations that touched it. keyed by node id; only the files carry a record,
   so selecting a folder falls back to a "pick a file" hint. */
const DEPS = (() => {
  const out = {}
  for (const n of NODES) {
    if (n.kind !== 'file') continue
    out[n.id] = {
      imports: EDGES.filter((e) => e.from === n.id && e.kind === 'structure').map((e) => leaf(e.to)),
      importedBy: EDGES.filter((e) => e.to === n.id && e.kind === 'structure').map((e) => leaf(e.from)),
      coupled: EDGES.filter(
        (e) => e.kind === 'activity' && (e.from === n.id || e.to === n.id),
      ).map((e) => leaf(e.from === n.id ? e.to : e.from)),
    }
  }
  return out
})()

/* "conversations that built this" — a small, deterministic per-file history (what + when), the
   transcript provenance peasant pins to every node. a couple of files share rows so the panel is
   never empty for a real file. */
const CONVERSATIONS = {
  'ingest/stream.go': [
    ['refactor the loader into a channel-backed stream', '2h ago'],
    ['add a null-guard under strict mode, re-run', 'yesterday'],
    ['port the eager reader to streaming', '4d ago'],
  ],
  'store/sqlite.go': [
    ['add the migrations table + version pragma', '6h ago'],
    ['wrap writes in a single transaction', '3d ago'],
  ],
  'api/handlers.go': [
    ['split the ingest handler from the query path', 'yesterday'],
    ['return 409 on a duplicate session id', '5d ago'],
  ],
}

/* the node detail panel body for the rail. a folder (or nothing) selected => a quiet hint; a file
   => its path, loc, coverage and the derived dependency lists. coverage carries the % AND the word,
   never colour alone. */
function NodeFacts({ node }) {
  const labelCss = { color: 'var(--ink-4)' }
  const valCss = { margin: 0, color: 'var(--ink)' }

  if (!node || node.kind !== 'file') {
    return (
      <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: 'var(--fs-label)' }}>
        {node ? `${node.label}/ — a folder. select a file to inspect its deps and coverage.` : 'select a node on the map to inspect it.'}
      </p>
    )
  }

  const d = DEPS[node.id] ?? { imports: [], importedBy: [], coupled: [] }
  const covPct = Math.round(((node.coverage ?? 0) / 4) * 100)
  const list = (arr) => (arr.length ? arr.join(', ') : '—')

  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 'var(--sp-1) var(--sp-3)',
        margin: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-label)',
        minWidth: 0,
      }}
    >
      <dt style={labelCss}>path</dt>
      <dd style={{ ...valCss, overflowWrap: 'anywhere' }}>{node.label}</dd>
      <dt style={labelCss}>lines</dt>
      <dd style={valCss} className="tnum">{node.loc}</dd>
      <dt style={labelCss}>coverage</dt>
      <dd style={{ ...valCss, color: 'var(--amber)' }}>
        {covPct}% <span style={{ color: 'var(--ink-4)' }}>· {node.coverage} of 4</span>
      </dd>
      <dt style={labelCss}>imports</dt>
      <dd style={{ ...valCss, overflowWrap: 'anywhere' }}>{list(d.imports)}</dd>
      <dt style={labelCss}>imported by</dt>
      <dd style={{ ...valCss, overflowWrap: 'anywhere' }}>{list(d.importedBy)}</dd>
      <dt style={labelCss}>co-edited</dt>
      <dd style={{ ...valCss, overflowWrap: 'anywhere' }}>{list(d.coupled)}</dd>
      {node.violations ? (
        <>
          <dt style={labelCss}>violations</dt>
          <dd style={{ ...valCss, color: 'var(--clay)', fontWeight: 600 }}>
            {node.violations} open
          </dd>
        </>
      ) : null}
    </dl>
  )
}

/* the rail payload: a "node" inspector over the "conversations that built this" provenance — the two
   things a canvas-node inspector shows in peasant. both react to the selected node. */
function NodeRail({ node }) {
  const convos = node && node.kind === 'file' ? CONVERSATIONS[node.id] : null
  const sel = node ? leaf(node.label) : 'none'

  return (
    <>
      <RailSection title="node" icon={Boxes} meta={node ? (node.kind === 'file' ? 'file' : 'folder') : 'none'}>
        <NodeFacts node={node} />
      </RailSection>

      <RailSection
        title="conversations that built this"
        icon={MessagesSquare}
        meta={convos ? String(convos.length) : '0'}
        collapsible
        defaultOpen
      >
        {convos && convos.length ? (
          <ul style={{ display: 'grid', gap: 'var(--sp-2)', margin: 0, padding: 0, listStyle: 'none' }}>
            {convos.map(([what, when]) => (
              <li
                key={what}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-3)', minWidth: 0 }}
              >
                <span style={{ color: 'var(--ink)', fontSize: 'var(--fs-label)', minWidth: 0 }}>{what}</span>
                <span
                  style={{
                    flex: 'none',
                    color: 'var(--ink-4)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--fs-micro)',
                  }}
                >
                  {when}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: 'var(--fs-label)' }}>
            no transcript touched <span style={{ fontFamily: 'var(--font-mono)' }}>{sel}</span> yet.
          </p>
        )}
      </RailSection>
    </>
  )
}

/* 14 buckets of session activity for the bottom strip (oldest → newest), plus the two open branches
   the map was last built on. mirrors the TimeStrip story's shape. */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
function dayLabel(daysAgo) {
  const d = new Date(2026, 5, 22) // jun 22 2026 — the project "today"
  d.setDate(d.getDate() - daysAgo)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}
const ACTIVITY = [2, 5, 1, 0, 3, 8, 11, 6, 4, 9, 14, 7, 12, 28]
const BUCKETS = ACTIVITY.map((value, i) => ({ label: dayLabel(ACTIVITY.length - 1 - i), value }))

export function MapAppSection() {
  // the one piece of cross-component wiring: the selected map node drives the rail. seed it with the
  // biggest file so the rail reads as full on first paint.
  const [selectedId, setSelectedId] = useState('ingest/stream.go')
  const [scrub, setScrub] = useState(11 / 13)

  const selected = useMemo(() => NODES.find((n) => n.id === selectedId) ?? null, [selectedId])

  return (
    <section className="band" id="app-map">
      <h2 className="label">rebuilt: the code map</h2>
      <div className="sub">the peasant code map, assembled from the system's own composites</div>
      <p className="prose">
        one screen, four tier-3 components stitched into a single real app: a MapCanvas beside a sticky
        RailShell inspector, a ConnectionPill in the toolbar, and a TimeStrip scrubbing activity below —
        the same layout peasant ships. select a node and the rail follows it.
      </p>

      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">peasant · code map</span></div>
        <div className="specimen-body" style={{ padding: 0 }}>
          {/* bound the whole app to a fixed height so it never dominates the page, and clip so no
              inner surface can cause horizontal overflow at 360px. */}
          <div
            style={{
              height: 560,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              maxWidth: '100%',
            }}
          >
            {/* toolbar row: connection pill + the map title + a quiet grain/detail hint. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                flexWrap: 'wrap',
                padding: 'var(--sp-2) var(--sp-3)',
                borderBottom: 'var(--bd)',
                background: 'var(--surface-2)',
                minWidth: 0,
              }}
            >
              <ConnectionPill status="live" showNote={false} />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-label)',
                  color: 'var(--ink)',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                ingest-pipeline
              </span>
              <span style={{ flex: '1 1 0', minWidth: 0 }} />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--sp-1)',
                  flex: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-micro)',
                  color: 'var(--ink-4)',
                }}
              >
                <GitFork size={12} aria-hidden="true" /> 14 nodes
                <span aria-hidden="true" style={{ color: 'var(--ink-5)' }}>·</span>
                <Activity size={12} aria-hidden="true" /> grain: folders
              </span>
            </div>

            {/* the shell: scrolling canvas main + sticky node-inspector rail. bounded so it fills the
                remaining height above the time strip; its own overflow keeps it contained. */}
            <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'auto' }}>
              <RailShell
                rail={<NodeRail node={selected} />}
                sheetTitle="node details"
                sheetMeta={selected ? leaf(selected.label) : 'none'}
              >
                <MapCanvas
                  data={DATA}
                  grain="folders"
                  selectedId={selectedId}
                  onSelect={(id) => setSelectedId(id)}
                  height={420}
                  ariaLabel="peasant code map"
                />
              </RailShell>
            </div>

            {/* the bottom activity strip — full width, the same scrubber peasant pins under the map. */}
            <div style={{ flex: 'none', borderTop: 'var(--bd)', padding: 'var(--sp-3)', background: 'var(--surface)', minWidth: 0 }}>
              <TimeStrip
                buckets={BUCKETS}
                value={scrub}
                onScrub={(next) => setScrub(next)}
                branches={[{ label: 'feat/ingest-stream' }, { label: 'fix/null-guard' }]}
                label="session activity"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

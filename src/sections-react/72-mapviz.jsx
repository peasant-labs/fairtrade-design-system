import { useState } from 'react'
import { FileText, Coins, Users, MessagesSquare, Clock, Lock, GitPullRequest, UserCog } from 'lucide-react'
import {
  MapCanvas,
  MapNode,
  RampLegend,
  Heatmap,
  IntensityScope,
  Treemap,
  TimeStrip,
  StatGrid,
  GovTile,
  ProviderBars,
} from '../ui'

/* 72-mapviz: the map / canvas viz family — the spatial surfaces peasant + village use to
   read a repo or a collective at a glance. each demo COPIES its component's primary story
   example (props + realistic data) so the specimen renders the real thing, not a stub.
   nothing auto-animates in the resting state: MapCanvas pans/zooms on user input only,
   TimeStrip scrubs on drag/keys. wide demos are wrapped so they cannot overflow the page
   at 360px. tokens-only inline styles; all chrome lowercase. */

/* ── MapCanvas data (copied from MapCanvas.stories Default) ─────────────────── */
const MAP_NODES = [
  // top-level folders
  { id: 'ingest', label: 'ingest', kind: 'folder' },
  { id: 'store', label: 'store', kind: 'folder' },
  { id: 'api', label: 'api', kind: 'folder' },
  { id: 'tui', label: 'tui', kind: 'folder' },
  { id: 'cmd', label: 'cmd', kind: 'folder' },
  // ingest/
  { id: 'ingest/stream.go', label: 'ingest/stream.go', kind: 'file', loc: 320, coverage: 3, parent: 'ingest' },
  { id: 'ingest/parse.go', label: 'ingest/parse.go', kind: 'file', loc: 180, coverage: 2, parent: 'ingest' },
  { id: 'ingest/stream_test.go', label: 'ingest/stream_test.go', kind: 'file', loc: 96, coverage: 4, parent: 'ingest' },
  // store/
  { id: 'store/sqlite.go', label: 'store/sqlite.go', kind: 'file', loc: 210, coverage: 2, parent: 'store', violations: 1 },
  { id: 'store/cache.go', label: 'store/cache.go', kind: 'file', loc: 130, coverage: 1, parent: 'store' },
  { id: 'store/migrations.sql', label: 'store/migrations.sql', kind: 'file', loc: 64, coverage: 0, parent: 'store' },
  // api/
  { id: 'api/handlers.go', label: 'api/handlers.go', kind: 'file', loc: 140, coverage: 4, parent: 'api' },
  { id: 'api/router.go', label: 'api/router.go', kind: 'file', loc: 88, coverage: 3, parent: 'api' },
  // tui/
  { id: 'tui/dashboard.go', label: 'tui/dashboard.go', kind: 'file', loc: 90, coverage: 1, parent: 'tui' },
  { id: 'tui/widgets.go', label: 'tui/widgets.go', kind: 'file', loc: 72, coverage: 2, parent: 'tui' },
  // cmd/
  { id: 'cmd/peasant/main.go', label: 'cmd/peasant/main.go', kind: 'file', loc: 60, coverage: 4, parent: 'cmd' },
]

const MAP_EDGES = [
  // structure (imports): cmd -> api -> store -> ingest, plus tui -> api.
  { from: 'cmd/peasant/main.go', to: 'api/router.go', kind: 'structure', weight: 1 },
  { from: 'api/router.go', to: 'api/handlers.go', kind: 'structure', weight: 3 },
  { from: 'api/handlers.go', to: 'store/sqlite.go', kind: 'structure', weight: 4 },
  { from: 'store/sqlite.go', to: 'ingest/stream.go', kind: 'structure', weight: 2 },
  { from: 'store/cache.go', to: 'store/sqlite.go', kind: 'structure', weight: 2 },
  { from: 'tui/dashboard.go', to: 'api/handlers.go', kind: 'structure', weight: 2 },
  { from: 'tui/widgets.go', to: 'tui/dashboard.go', kind: 'structure', weight: 1 },
  { from: 'ingest/parse.go', to: 'ingest/stream.go', kind: 'structure', weight: 3 },
  // activity (co-edit), heavier = tighter coupling = wider dashed edge.
  { from: 'ingest/stream.go', to: 'store/sqlite.go', kind: 'activity', weight: 5 },
  { from: 'api/handlers.go', to: 'tui/dashboard.go', kind: 'activity', weight: 3 },
]

/* ── Intensity data (copied from Intensity.stories Nodes + Heatmap) ─────────── */
const INTENSITY_TREE = [
  { label: 'api/handlers.go', loc: 880, coverage: 4, effortPct: 70 },
  { label: 'ingest/stream.go', loc: 420, coverage: 3, selected: true, effortPct: 45 },
  { label: 'store/', loc: 1600, coverage: 2 },
  { label: 'auth/middleware.go', loc: 240, coverage: 1, violation: 2 },
  { label: 'cmd/main.go', loc: 90, coverage: 4 },
  { label: 'internal/cache.go', loc: 310, coverage: 0, violation: 1, effortPct: 20 },
]

const HEAT_VALUES = [0, 1, 1, 3, 5, 8, 6, 2, 0, 4, 7, 9, 3, 1]

/* ── Treemap data (copied from Treemap.stories Default change-set) ──────────── */
const CHANGE_SET = [
  { id: 'ingest/stream.go', label: 'ingest/stream.go', value: 320, intensity: 4 },
  { id: 'store/sqlite.go', label: 'store/sqlite.go', value: 210, intensity: 2 },
  { id: 'api/handlers.go', label: 'api/handlers.go', value: 140, intensity: 3 },
  { id: 'tui/dashboard.go', label: 'tui/dashboard.go', value: 90, intensity: 1 },
  { id: 'cmd/peasant/main.go', label: 'cmd/peasant/main.go', value: 60, intensity: 4 },
  { id: 'store/migrations.sql', label: 'store/migrations.sql', value: 48, intensity: 0 },
  { id: 'ingest/stream_test.go', label: 'ingest/stream_test.go', value: 36, intensity: 2 },
  { id: 'config/peasant.toml', label: 'config/peasant.toml', value: 22, intensity: 1 },
  { id: 'api/handlers_test.go', label: 'api/handlers_test.go', value: 18, intensity: 3 },
  { id: 'docs/architecture.md', label: 'docs/architecture.md', value: 12, intensity: 0 },
  { id: 'go.mod', label: 'go.mod', value: 6, intensity: 2 },
]

/* ── TimeStrip data (copied from TimeStrip.stories Default) ─────────────────── */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
function dayLabel(daysAgo) {
  const d = new Date(2026, 5, 22) // jun 22 2026 — the project "today"
  d.setDate(d.getDate() - daysAgo)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}
const ACTIVITY = [2, 5, 1, 0, 3, 8, 11, 6, 4, 9, 14, 7, 12, 28]
const BUCKETS = ACTIVITY.map((value, i) => ({
  label: dayLabel(ACTIVITY.length - 1 - i),
  value,
}))

/* controlled wrapper so the playhead drags/keyboards — the story's Scrubbable pattern. */
function ActivityStrip() {
  const [value, setValue] = useState(11 / 13) // land near "now", a couple buckets back
  return (
    <TimeStrip
      buckets={BUCKETS}
      value={value}
      onScrub={setValue}
      branches={[{ label: 'fix/auth-redirect' }, { label: 'feat/strip' }]}
      label="session activity"
    />
  )
}

/* ── StatTiles data (copied from StatTiles.stories) ─────────────────────────── */
const KPI_TILES = [
  { key: 'transcripts', label: 'transcripts', value: '1,284', icon: FileText },
  { key: 'tokens', label: 'tokens', value: '4.2M', icon: Coins },
  { key: 'contributors', label: 'contributors', value: '38', icon: Users },
  { key: 'turns', label: 'turns', value: '9,610', icon: MessagesSquare },
  { key: 'duration', label: 'avg duration', value: '14m', sub: 'per session', icon: Clock },
]
const PROVIDERS = [
  { label: 'claude-code', value: 62 },
  { label: 'gemini-cli', value: 18 },
  { label: 'codex', value: 11 },
  { label: 'opencode', value: 6 },
  { label: 'cursor', value: 3 },
]

const h3Style = { marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }
/* keep any wide demo from pushing the page sideways at 360px */
const wide = { overflow: 'auto', maxWidth: '100%' }

export function MapVizSection() {
  return (
    <section className="band" id="ds-mapviz">
      <h2 className="label">map &amp; canvas</h2>
      <div className="sub">spatial surfaces for reading a repo or a collective at a glance</div>
      <p className="prose">these are the views that turn a pile of files or sessions into something you can see: an interactive code map, a monochrome intensity ramp that encodes magnitude by fill weight (never hue), a churn treemap, an activity scrubber, and the governance tiles a collective leads with. nothing animates on its own. the map pans and zooms on your input, the strip scrubs on drag or arrow keys.</p>

      <h3 className="label" style={h3Style}>map canvas</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">interactive · pan + zoom on input</span></div>
        <div className="specimen-body" style={wide}>
          <div style={{ height: 420, overflow: 'hidden' }}>
            <MapCanvas
              data={{ nodes: MAP_NODES, edges: MAP_EDGES }}
              grain="folders"
              height={420}
              ariaLabel="peasant code map"
            />
          </div>
        </div>
      </div>

      <h3 className="label" style={h3Style}>intensity ramp</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={wide}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            <RampLegend title="fill = coverage" />
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>nodes: size ∝ loc, fill ∝ coverage</span>
              <IntensityScope className="ir-grid">
                {INTENSITY_TREE.map((n) => (
                  <MapNode key={n.label} {...n} />
                ))}
              </IntensityScope>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <span className="label">heatmap: commits / day · store/</span>
              <Heatmap
                values={HEAT_VALUES}
                max={9}
                ariaLabel="commits per day for store/, last 14 days"
                labels={HEAT_VALUES.map((_, i) => `day ${i + 1}`)}
              />
            </div>
          </div>
        </div>
      </div>

      <h3 className="label" style={h3Style}>treemap</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">area ∝ churn · fill ∝ recency</span></div>
        <div className="specimen-body" style={wide}>
          <Treemap
            data={CHANGE_SET}
            height={320}
            ariaLabel="changed files sized by churn, shaded by recency"
          />
        </div>
      </div>

      <h3 className="label" style={h3Style}>time strip</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">interactive · drag / arrow keys to scrub</span></div>
        <div className="specimen-body" style={wide}>
          <ActivityStrip />
        </div>
      </div>

      <h3 className="label" style={h3Style}>stat tiles</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={wide}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>kpi row</span>
              <StatGrid tiles={KPI_TILES} />
            </div>
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>governance tiles</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-4)' }}>
                <GovTile label="access" value="members only" icon={Lock} tone="amber" />
                <GovTile label="contributions" value="curated" icon={GitPullRequest} tone="olive" />
                <GovTile label="your role" value="contributor" icon={UserCog} tone="teal" />
              </div>
            </div>
            <div>
              <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>provider distribution</span>
              <ProviderBars data={PROVIDERS} total={100} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import { useId, useMemo, useState } from 'react'
import {
  Activity,
  Users,
  Hash,
  GitCommitHorizontal,
  CircleCheck,
  TrendingUp,
  UserPlus,
  Timer,
  PieChart,
  BarChart3,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react'

/* MOCKUP - GRAPH / ANALYTICS (namespace .gan-*).
   the @peasant-labs/analytics <ProjectOverview> dashboard, hand-rolled. every chart is
   drawn in raw svg in the Chart.jsx house style: hairline axes/gridlines via --rule, the
   primary series in scarce --amber, secondary series in the earth palette, tabular-num
   labels, lowercase chrome, reduced-motion honoured. all geometry is token-driven inline
   so the whole dashboard re-themes light/dark for free.

   layout (fills its container, internal scroll):
   - 6 KPI stat tiles (label + big tabular value + hint)
   - a 5-chart grid in titled cards (title + subtitle + right-aligned aside figure):
     sessions/week BAR, weekly-active-contributors AREA, new-contributors/week BAR,
     avg-duration/active-week LINE, outcome-distribution DONUT
   - a median.p90 "typical vs tail" stat grid (duration / tokens / turns / tool calls)
   - a 7-column contributor table (sorted by sessions desc), reuses .tbl-* DataTable
   - a section-toggle control (the 8 toggleable ProjectOverview sections)
*/

/* ---- the baked fixture (the analytics agent's exampleData) -------------------------- */

/* sessions/week (ISO mondays). weeks with 0 sessions omitted upstream. */
const WEEKS = [
  { week: '2026-01-05', label: '01-05', sessions: 2, active: 2, newC: 2, avgMins: 30 },
  { week: '2026-01-12', label: '01-12', sessions: 3, active: 3, newC: 1, avgMins: 41 },
  { week: '2026-01-19', label: '01-19', sessions: 3, active: 2, newC: 0, avgMins: 28 },
]

/* outcome distribution (always sums to total; unknown = no-outcome sessions) */
const OUTCOMES = [
  { key: 'resolved', label: 'resolved', value: 4, tone: 'var(--olive)' },
  { key: 'partial', label: 'partial', value: 1, tone: 'var(--amber)' },
  { key: 'failed', label: 'failed', value: 2, tone: 'var(--clay)' },
  { key: 'unknown', label: 'unknown', value: 1, tone: 'var(--ink-3)' },
]

/* median.p90 distribution shape for the four core numeric fields */
const TYPICAL = [
  { key: 'duration', label: 'duration', median: '35m', p90: '58m' },
  { key: 'tokens', label: 'tokens', median: '14.0k', p90: '28.4k' },
  { key: 'turns', label: 'turns', median: '12.0', p90: '27.0' },
  { key: 'tools', label: 'tool calls', median: '8.0', p90: '21.0' },
]

/* per-contributor rollup (raw numbers; formatted at render) */
const CONTRIBUTORS = [
  { id: 'alice', sessions: 4, weeks: 3, tokens: 62000, durationMin: 155, commits: 3, resolved: 3, withOutcome: 4 },
  { id: 'bob', sessions: 2, weeks: 2, tokens: 30400, durationMin: 48, commits: 3, resolved: 1, withOutcome: 2 },
  { id: 'carol', sessions: 2, weeks: 2, tokens: 18900, durationMin: 62, commits: 0, resolved: 1, withOutcome: 2 },
]

/* the 8 toggleable ProjectOverview sections (all default ON) */
const SECTION_DEFS = [
  { key: 'summary', label: 'summary' },
  { key: 'sessionsPerWeek', label: 'sessions/week' },
  { key: 'weeklyActiveContributors', label: 'active' },
  { key: 'newContributorVelocity', label: 'new' },
  { key: 'avgDurationPerActiveWeek', label: 'duration' },
  { key: 'outcomeDistribution', label: 'outcomes' },
  { key: 'sessionStats', label: 'typical' },
  { key: 'contributorTable', label: 'table' },
]

/* ---- compact formatters (the analytics package's number language) ------------------- */
const fmtTokens = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}
const fmtDuration = (mins) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}
const fmtRate = (n, d) => (d ? Math.round((n / d) * 100) + '%' : '—')
const fmtNum = (n) => n.toLocaleString('en-US')

/* ===================================================================================== */

export function AnalyticsView({ theme }) {
  void theme // re-themes via tokens; prop kept for parity with the other in-use views
  const [sections, setSections] = useState(() =>
    Object.fromEntries(SECTION_DEFS.map((s) => [s.key, true]))
  )
  const toggle = (k) => setSections((s) => ({ ...s, [k]: !s[k] }))

  const totalSessions = useMemo(() => CONTRIBUTORS.reduce((a, c) => a + c.sessions, 0), [])
  const outcomeTotal = useMemo(() => OUTCOMES.reduce((a, o) => a + o.value, 0), [])

  return (
    <div className="gan-root">
      {/* ---- header + section toggle --------------------------------------------- */}
      <div className="gan-head">
        <div className="gan-head-titles">
          <h2 className="gan-h2">project overview</h2>
          <div className="gan-sub">peasant-labs/peasant &middot; 3 contributors &middot; 8 sessions across 3 weeks</div>
        </div>
        <SectionToggle sections={sections} onToggle={toggle} />
      </div>

      <div className="gan-scroll">
        {/* ---- 6 KPI stat tiles ------------------------------------------------- */}
        {sections.summary && (
          <div className="gan-kpis" role="list" aria-label="headline metrics">
            <StatTile icon={Activity} label="sessions" value="8" hint="recorded" />
            <StatTile icon={Users} label="contributors" value="3" hint="alice, bob, carol" />
            <StatTile icon={TrendingUp} label="returning rate" value="67%" hint="2 of 3" />
            <StatTile icon={GitCommitHorizontal} label="session → commit" value="38%" hint="3 of 8" />
            <StatTile icon={CircleCheck} label="longest streak" value="3 wk" hint="from 2026-01-05" />
            <StatTile icon={Hash} label="projects" value="1" hint="peasant" />
          </div>
        )}

        {/* ---- 5-chart grid ----------------------------------------------------- */}
        <div className="gan-grid">
          {sections.sessionsPerWeek && (
            <SessionsBar
              title="sessions per week"
              subtitle="agent sessions bucketed by iso week"
              aside={`${totalSessions} total`}
            />
          )}
          {sections.weeklyActiveContributors && <ActiveArea />}
          {sections.newContributorVelocity && <NewContributorsBar />}
          {sections.avgDurationPerActiveWeek && <AvgDurationLine />}
          {sections.outcomeDistribution && <OutcomeDonut total={outcomeTotal} />}
          {sections.sessionStats && <TypicalGrid />}
        </div>

        {/* ---- contributor table ------------------------------------------------ */}
        {sections.contributorTable && <ContributorTable />}

        {/* every metric paints from --tb-* equivalents (our --ink/--amber/--olive/--clay
            tokens) and re-resolves on theme flip; this is the dashboard's signature. */}
        <p className="gan-foot">
          every tile and every chart paints from design tokens, so the whole dashboard
          re-themes light/dark live. hover any bar, slice, point or area to read its value.
        </p>
      </div>
    </div>
  )
}

/* ---- section-toggle control (the 8 ProjectOverview sections) ------------------------ */
function SectionToggle({ sections, onToggle }) {
  const on = Object.values(sections).filter(Boolean).length
  return (
    <div className="gan-toggle" role="group" aria-label="visible sections">
      <span className="gan-toggle-lab">
        <SlidersHorizontal size={14} aria-hidden="true" /> sections
        <b className="tnum">{on}/{SECTION_DEFS.length}</b>
      </span>
      <div className="gan-toggle-chips">
        {SECTION_DEFS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={'gan-seg' + (sections[s.key] ? ' is-on' : '')}
            aria-pressed={sections[s.key]}
            onClick={() => onToggle(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---- KPI stat tile ------------------------------------------------------------------ */
function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="gan-tile" role="listitem">
      <span className="gan-tile-lab">
        <Icon size={13} aria-hidden="true" /> {label}
      </span>
      <span className="gan-tile-val tnum">{value}</span>
      {hint && <span className="gan-tile-hint">{hint}</span>}
    </div>
  )
}

/* ---- chart card shell (title + subtitle + right-aligned aside figure) --------------- */
function ChartCard({ icon: Icon, title, subtitle, aside, span, children }) {
  return (
    <section className={'gan-card' + (span ? ' gan-card--wide' : '')}>
      <div className="gan-card-head">
        <div className="gan-card-titles">
          <h3 className="gan-card-title">
            {Icon && <Icon size={14} aria-hidden="true" />} {title}
          </h3>
          {subtitle && <span className="gan-card-sub">{subtitle}</span>}
        </div>
        {aside != null && <span className="gan-card-figure tnum">{aside}</span>}
      </div>
      <div className="gan-card-body">{children}</div>
    </section>
  )
}

/* ===================================================================================== */
/* CHART 1 - sessions per week (vertical BAR) + hover tooltip                            */
/* ===================================================================================== */
function SessionsBar({ title, subtitle, aside }) {
  const [hot, setHot] = useState(null)
  const uid = useId()
  const W = 520, H = 200
  const pad = { l: 30, r: 12, t: 14, b: 28 }
  const plotW = W - pad.l - pad.r
  const plotH = H - pad.t - pad.b
  const ceil = 4 // clean 0..4 ceiling for 0,1,2,3 sessions
  const ticks = [0, 1, 2, 3, 4]
  const slot = plotW / WEEKS.length
  const bw = Math.min(64, slot - 28)
  const bars = WEEKS.map((w, i) => {
    const h = (w.sessions / ceil) * plotH
    const x = pad.l + i * slot + (slot - bw) / 2
    const y = pad.t + plotH - h
    return { ...w, i, x, y, w: bw, h }
  })
  const hb = hot != null ? bars[hot] : null

  return (
    <ChartCard icon={BarChart3} title={title} subtitle={subtitle} aside={aside}>
      <div className="gan-plot">
        <svg className="gan-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, ${aside}`}>
          {ticks.map((v) => {
            const y = pad.t + plotH - (v / ceil) * plotH
            return <line key={v} x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          })}
          <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="var(--ink-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {bars.map((b) => (
            <rect
              key={b.week}
              x={b.x} y={b.y} width={b.w} height={b.h}
              fill="var(--amber)"
              opacity={hot == null || hot === b.i ? 1 : 0.42}
              tabIndex={0} role="img"
              aria-label={`week of ${b.label}, ${b.sessions} sessions`}
              className="gan-bar"
              onMouseEnter={() => setHot(b.i)} onMouseLeave={() => setHot((h) => (h === b.i ? null : h))}
              onFocus={() => setHot(b.i)} onBlur={() => setHot((h) => (h === b.i ? null : h))}
            />
          ))}
        </svg>
        {/* y ticks as html for crisp type */}
        <div className="gan-yaxis" aria-hidden="true" style={{ width: (pad.l / W) * 100 + '%' }}>
          {ticks.map((v) => (
            <span key={v} className="gan-ylab tnum" style={{ top: ((pad.t + plotH - (v / ceil) * plotH) / H) * 100 + '%' }}>{v}</span>
          ))}
        </div>
        {/* x ticks: MM-DD week labels */}
        <div className="gan-xaxis" aria-hidden="true">
          {bars.map((b) => (
            <span key={b.week} className={'gan-xlab tnum' + (hot === b.i ? ' is-hot' : '')} style={{ left: ((b.x + b.w / 2) / W) * 100 + '%' }}>{b.label}</span>
          ))}
        </div>
        {hb && (
          <div className="gan-tip" id={uid + '-tip'} aria-hidden="true" style={{ left: ((hb.x + hb.w / 2) / W) * 100 + '%', top: (hb.y / H) * 100 + '%' }}>
            <span className="gan-tip-k">{hb.label}</span>
            <span className="gan-tip-v tnum">{hb.sessions} sessions</span>
          </div>
        )}
      </div>
    </ChartCard>
  )
}

/* ===================================================================================== */
/* CHART 2 - weekly active contributors (AREA) + a series toggle (the interactivity demo)*/
/* ===================================================================================== */
function ActiveArea() {
  const [series, setSeries] = useState('active') // 'active' | 'new'
  const [hot, setHot] = useState(null)
  const W = 520, H = 200
  const pad = { l: 30, r: 12, t: 14, b: 28 }
  const plotW = W - pad.l - pad.r
  const plotH = H - pad.t - pad.b
  const key = series === 'active' ? 'active' : 'newC'
  const tone = series === 'active' ? 'var(--teal)' : 'var(--olive)'
  const ceil = 4
  const ticks = [0, 2, 4]
  const pts = WEEKS.map((w, i) => {
    const x = pad.l + (WEEKS.length === 1 ? plotW / 2 : (i / (WEEKS.length - 1)) * plotW)
    const y = pad.t + plotH - (w[key] / ceil) * plotH
    return { ...w, i, x, y, v: w[key] }
  })
  const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y).join(' ')
  const area = `M${pts[0].x} ${pad.t + plotH} ` + pts.map((p) => `L${p.x} ${p.y}`).join(' ') + ` L${pts[pts.length - 1].x} ${pad.t + plotH} Z`
  const hp = hot != null ? pts[hot] : null
  const total = WEEKS.reduce((a, w) => a + w[key], 0)

  return (
    <ChartCard icon={Users} title="weekly active contributors" subtitle={series === 'active' ? 'distinct contributors active each week' : 'first-ever appearance per week'} aside={`${total} ${series === 'active' ? 'active' : 'new'}`}>
      <div className="gan-card-toolbar" role="group" aria-label="series">
        <button type="button" className={'gan-mini' + (series === 'active' ? ' is-on' : '')} aria-pressed={series === 'active'} onClick={() => { setSeries('active'); setHot(null) }}>active</button>
        <button type="button" className={'gan-mini' + (series === 'new' ? ' is-on' : '')} aria-pressed={series === 'new'} onClick={() => { setSeries('new'); setHot(null) }}>new</button>
      </div>
      <div className="gan-plot">
        <svg className="gan-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`weekly ${series} contributors`}>
          {ticks.map((v) => {
            const y = pad.t + plotH - (v / ceil) * plotH
            return <line key={v} x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          })}
          <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="var(--ink-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={area} fill={tone} opacity="0.18" />
          <path d={line} fill="none" stroke={tone} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {pts.map((p) => (
            <g key={p.week}>
              <circle cx={p.x} cy={p.y} r={hot === p.i ? 4 : 3} fill={tone} stroke="var(--surface)" strokeWidth="1.5" />
              <circle
                cx={p.x} cy={p.y} r="11" fill="transparent"
                tabIndex={0} role="img"
                aria-label={`week of ${p.label}, ${p.v} ${series === 'active' ? 'active' : 'new'}`}
                className="gan-pt"
                onMouseEnter={() => setHot(p.i)} onMouseLeave={() => setHot((h) => (h === p.i ? null : h))}
                onFocus={() => setHot(p.i)} onBlur={() => setHot((h) => (h === p.i ? null : h))}
              />
            </g>
          ))}
        </svg>
        <div className="gan-yaxis" aria-hidden="true" style={{ width: (pad.l / W) * 100 + '%' }}>
          {ticks.map((v) => (<span key={v} className="gan-ylab tnum" style={{ top: ((pad.t + plotH - (v / ceil) * plotH) / H) * 100 + '%' }}>{v}</span>))}
        </div>
        <div className="gan-xaxis" aria-hidden="true">
          {pts.map((p) => (<span key={p.week} className={'gan-xlab tnum' + (hot === p.i ? ' is-hot' : '')} style={{ left: (p.x / W) * 100 + '%' }}>{p.label}</span>))}
        </div>
        {hp && (
          <div className="gan-tip" aria-hidden="true" style={{ left: (hp.x / W) * 100 + '%', top: (hp.y / H) * 100 + '%' }}>
            <span className="gan-tip-k">{hp.label}</span>
            <span className="gan-tip-v tnum">{hp.v} {series === 'active' ? 'active' : 'new'}</span>
          </div>
        )}
      </div>
    </ChartCard>
  )
}

/* ===================================================================================== */
/* CHART 3 - new contributors per week (vertical BAR)                                    */
/* ===================================================================================== */
function NewContributorsBar() {
  const [hot, setHot] = useState(null)
  const W = 520, H = 200
  const pad = { l: 30, r: 12, t: 14, b: 28 }
  const plotW = W - pad.l - pad.r
  const plotH = H - pad.t - pad.b
  const ceil = 3
  const ticks = [0, 1, 2, 3]
  const slot = plotW / WEEKS.length
  const bw = Math.min(64, slot - 28)
  const bars = WEEKS.map((w, i) => {
    const h = (w.newC / ceil) * plotH
    const x = pad.l + i * slot + (slot - bw) / 2
    const y = pad.t + plotH - h
    return { ...w, i, x, y, w: bw, h }
  })
  const hb = hot != null ? bars[hot] : null
  const total = WEEKS.reduce((a, w) => a + w.newC, 0)

  return (
    <ChartCard icon={UserPlus} title="new contributors per week" subtitle="acquisition signal &middot; first appearance" aside={`${total} new`}>
      <div className="gan-plot">
        <svg className="gan-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`new contributors per week, ${total} new`}>
          {ticks.map((v) => {
            const y = pad.t + plotH - (v / ceil) * plotH
            return <line key={v} x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          })}
          <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="var(--ink-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {bars.map((b) => (
            b.h > 0 ? (
              <rect
                key={b.week}
                x={b.x} y={b.y} width={b.w} height={b.h}
                fill="var(--olive)"
                opacity={hot == null || hot === b.i ? 1 : 0.42}
                tabIndex={0} role="img"
                aria-label={`week of ${b.label}, ${b.newC} new contributors`}
                className="gan-bar"
                onMouseEnter={() => setHot(b.i)} onMouseLeave={() => setHot((h) => (h === b.i ? null : h))}
                onFocus={() => setHot(b.i)} onBlur={() => setHot((h) => (h === b.i ? null : h))}
              />
            ) : null
          ))}
        </svg>
        <div className="gan-yaxis" aria-hidden="true" style={{ width: (pad.l / W) * 100 + '%' }}>
          {ticks.map((v) => (<span key={v} className="gan-ylab tnum" style={{ top: ((pad.t + plotH - (v / ceil) * plotH) / H) * 100 + '%' }}>{v}</span>))}
        </div>
        <div className="gan-xaxis" aria-hidden="true">
          {bars.map((b) => (<span key={b.week} className={'gan-xlab tnum' + (hot === b.i ? ' is-hot' : '')} style={{ left: ((b.x + b.w / 2) / W) * 100 + '%' }}>{b.label}</span>))}
        </div>
        {hb && (
          <div className="gan-tip" aria-hidden="true" style={{ left: ((hb.x + hb.w / 2) / W) * 100 + '%', top: (hb.y / H) * 100 + '%' }}>
            <span className="gan-tip-k">{hb.label}</span>
            <span className="gan-tip-v tnum">{hb.newC} new</span>
          </div>
        )}
      </div>
    </ChartCard>
  )
}

/* ===================================================================================== */
/* CHART 4 - avg duration per active week (LINE)                                         */
/* ===================================================================================== */
function AvgDurationLine() {
  const [hot, setHot] = useState(null)
  const W = 520, H = 200
  const pad = { l: 34, r: 12, t: 14, b: 28 }
  const plotW = W - pad.l - pad.r
  const plotH = H - pad.t - pad.b
  const ceil = 60
  const ticks = [0, 20, 40, 60]
  const pts = WEEKS.map((w, i) => {
    const x = pad.l + (WEEKS.length === 1 ? plotW / 2 : (i / (WEEKS.length - 1)) * plotW)
    const y = pad.t + plotH - (w.avgMins / ceil) * plotH
    return { ...w, i, x, y }
  })
  const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y).join(' ')
  const hp = hot != null ? pts[hot] : null
  const overall = Math.round(WEEKS.reduce((a, w) => a + w.avgMins, 0) / WEEKS.length)

  return (
    <ChartCard icon={Timer} title="avg duration per active week" subtitle="minutes" aside={`${overall}m avg`}>
      <div className="gan-plot">
        <svg className="gan-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="avg duration per active week in minutes">
          {ticks.map((v) => {
            const y = pad.t + plotH - (v / ceil) * plotH
            return <line key={v} x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          })}
          <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="var(--ink-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={line} fill="none" stroke="var(--amber)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {pts.map((p) => (
            <g key={p.week}>
              <circle cx={p.x} cy={p.y} r={hot === p.i ? 4 : 3} fill="var(--amber)" stroke="var(--surface)" strokeWidth="1.5" />
              <circle
                cx={p.x} cy={p.y} r="11" fill="transparent"
                tabIndex={0} role="img"
                aria-label={`week of ${p.label}, ${p.avgMins} minutes average`}
                className="gan-pt"
                onMouseEnter={() => setHot(p.i)} onMouseLeave={() => setHot((h) => (h === p.i ? null : h))}
                onFocus={() => setHot(p.i)} onBlur={() => setHot((h) => (h === p.i ? null : h))}
              />
            </g>
          ))}
        </svg>
        <div className="gan-yaxis" aria-hidden="true" style={{ width: (pad.l / W) * 100 + '%' }}>
          {ticks.map((v) => (<span key={v} className="gan-ylab tnum" style={{ top: ((pad.t + plotH - (v / ceil) * plotH) / H) * 100 + '%' }}>{v}</span>))}
        </div>
        <div className="gan-xaxis" aria-hidden="true">
          {pts.map((p) => (<span key={p.week} className={'gan-xlab tnum' + (hot === p.i ? ' is-hot' : '')} style={{ left: (p.x / W) * 100 + '%' }}>{p.label}</span>))}
        </div>
        {hp && (
          <div className="gan-tip" aria-hidden="true" style={{ left: (hp.x / W) * 100 + '%', top: (hp.y / H) * 100 + '%' }}>
            <span className="gan-tip-k">{hp.label}</span>
            <span className="gan-tip-v tnum">{hp.avgMins} mins</span>
          </div>
        )}
      </div>
    </ChartCard>
  )
}

/* ===================================================================================== */
/* CHART 5 - outcome distribution (DONUT) + center total + legend aside                  */
/* ===================================================================================== */
function OutcomeDonut({ total }) {
  const [hot, setHot] = useState(null)
  const slices = OUTCOMES.filter((o) => o.value > 0)
  const empty = total === 0
  const cx = 90, cy = 90, rOuter = 78, rInner = 49
  const gap = 0.045 // radians of padding between slices

  // build the donut arcs
  let acc = -Math.PI / 2
  const arcs = slices.map((o) => {
    const frac = o.value / total
    const start = acc + gap / 2
    const end = acc + frac * Math.PI * 2 - gap / 2
    acc += frac * Math.PI * 2
    const large = end - start > Math.PI ? 1 : 0
    const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
    const [x1, y1] = p(rOuter, start)
    const [x2, y2] = p(rOuter, end)
    const [x3, y3] = p(rInner, end)
    const [x4, y4] = p(rInner, start)
    const d = `M${x1} ${y1} A${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`
    return { ...o, d, frac }
  })

  return (
    <ChartCard icon={PieChart} title="outcome distribution" subtitle="share of session outcomes" aside={`${total} total`}>
      {empty ? (
        <div className="gan-donut-empty">no outcome data.</div>
      ) : (
        <div className="gan-donut">
          <svg viewBox="0 0 180 180" className="gan-donut-svg" role="img" aria-label={`outcome distribution across ${total} sessions`}>
            {arcs.map((a, i) => (
              <path
                key={a.key}
                d={a.d}
                fill={a.tone}
                stroke="var(--surface)"
                strokeWidth="1.5"
                opacity={hot == null || hot === i ? 1 : 0.4}
                tabIndex={0} role="img"
                aria-label={`${a.label}, ${a.value} sessions, ${Math.round(a.frac * 100)}%`}
                className="gan-slice"
                onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot((h) => (h === i ? null : h))}
                onFocus={() => setHot(i)} onBlur={() => setHot((h) => (h === i ? null : h))}
              />
            ))}
            <text x="90" y="84" className="gan-donut-num tnum" textAnchor="middle">{hot != null ? slices[hot].value : total}</text>
            <text x="90" y="104" className="gan-donut-lab" textAnchor="middle">{hot != null ? slices[hot].label : 'sessions'}</text>
          </svg>
          <ul className="gan-legend">
            {OUTCOMES.map((o, i) => {
              const idx = slices.findIndex((s) => s.key === o.key)
              return (
                <li
                  key={o.key}
                  className={'gan-legend-row' + (hot === idx && idx >= 0 ? ' is-hot' : '')}
                  onMouseEnter={() => idx >= 0 && setHot(idx)}
                  onMouseLeave={() => setHot(null)}
                >
                  <span className="gan-legend-sw" style={{ background: o.tone }} aria-hidden="true" />
                  <span className="gan-legend-nm">{o.label}</span>
                  <span className="gan-legend-v tnum">{o.value}</span>
                  <span className="gan-legend-pct tnum">{fmtRate(o.value, total)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </ChartCard>
  )
}

/* ===================================================================================== */
/* median.p90 "typical vs tail" stat grid                                                */
/* ===================================================================================== */
function TypicalGrid() {
  return (
    <ChartCard icon={Activity} title="typical vs. tail" subtitle="median &middot; p90" aside="per session">
      <div className="gan-typical">
        {TYPICAL.map((t) => (
          <div className="gan-typrow" key={t.key}>
            <span className="gan-typlab">{t.label}</span>
            <span className="gan-typvals">
              <span className="gan-typmed tnum">{t.median}</span>
              <span className="gan-typsep" aria-hidden="true">&middot;</span>
              <span className="gan-typp90 tnum">{t.p90}</span>
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

/* ===================================================================================== */
/* contributor table - 7 columns, sortable (default sessions desc), reuses .tbl-*        */
/* ===================================================================================== */
const COLS = [
  { key: 'id', label: 'contributor', align: 'left', sort: (a, b) => a.id.localeCompare(b.id) },
  { key: 'sessions', label: 'sessions', align: 'right', num: true, sort: (a, b) => a.sessions - b.sessions },
  { key: 'weeks', label: 'active wks', align: 'right', num: true, sort: (a, b) => a.weeks - b.weeks },
  { key: 'tokens', label: 'tokens', align: 'right', num: true, sort: (a, b) => a.tokens - b.tokens },
  { key: 'duration', label: 'duration', align: 'right', num: true, sort: (a, b) => a.durationMin - b.durationMin },
  { key: 'commits', label: 'commits', align: 'right', num: true, sort: (a, b) => a.commits - b.commits },
  { key: 'resolved', label: 'resolved', align: 'right', num: true, sort: (a, b) => (a.withOutcome ? a.resolved / a.withOutcome : -1) - (b.withOutcome ? b.resolved / b.withOutcome : -1) },
]

function ContributorTable() {
  const [sortKey, setSortKey] = useState('sessions')
  const [dir, setDir] = useState('desc') // default sessions desc

  const rows = useMemo(() => {
    const col = COLS.find((c) => c.key === sortKey)
    const sorted = [...CONTRIBUTORS].sort((a, b) => {
      const r = col.sort(a, b)
      return dir === 'desc' ? -r : r
    })
    // stable tie-break by contributorId
    return sorted.sort((a, b) => {
      const col2 = COLS.find((c) => c.key === sortKey)
      const r = col2.sort(a, b)
      if (r !== 0) return dir === 'desc' ? -r : r
      return a.id.localeCompare(b.id)
    })
  }, [sortKey, dir])

  const onSort = (key) => {
    if (key === sortKey) setDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setDir(key === 'id' ? 'asc' : 'desc') }
  }

  return (
    <section className="gan-tablecard">
      <div className="gan-card-head">
        <div className="gan-card-titles">
          <h3 className="gan-card-title"><Users size={14} aria-hidden="true" /> contributors</h3>
          <span className="gan-card-sub">rolled up &middot; sorted by session volume</span>
        </div>
        <span className="gan-card-figure tnum">{CONTRIBUTORS.length} people</span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {COLS.map((c) => {
                const sorted = sortKey === c.key
                const Ic = !sorted ? ChevronsUpDown : dir === 'desc' ? ChevronDown : ChevronUp
                return (
                  <th
                    key={c.key}
                    className={'tbl-th' + (c.align === 'right' ? ' tbl-right' : '')}
                    aria-sort={sorted ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}
                  >
                    <button type="button" className={'tbl-sort' + (sorted ? ' is-sorted' : '')} onClick={() => onSort(c.key)}>
                      <span className="tbl-th-label">{c.label}</span>
                      <Ic className="tbl-sort-ic lucide" aria-hidden="true" />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr className="tbl-row" key={r.id}>
                <td className="tbl-td">
                  <span className="gan-contrib">
                    <span className="avatar" aria-hidden="true">{r.id[0].toUpperCase()}</span>
                    {r.id}
                  </span>
                </td>
                <td className="tbl-td tbl-right"><span className="tnum">{r.sessions}</span></td>
                <td className="tbl-td tbl-right"><span className="tnum">{r.weeks}</span></td>
                <td className="tbl-td tbl-right"><span className="tnum">{fmtTokens(r.tokens)}</span></td>
                <td className="tbl-td tbl-right"><span className="tnum">{fmtDuration(r.durationMin)}</span></td>
                <td className="tbl-td tbl-right"><span className="tnum">{r.commits}</span></td>
                <td className="tbl-td tbl-right"><span className="tnum">{r.withOutcome ? fmtRate(r.resolved, r.withOutcome) : '—'}</span></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="tbl-empty" colSpan={COLS.length}>no contributor data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="gan-table-foot">
        <span className="metaitem"><Hash size={13} aria-hidden="true" /> totals <b>{fmtNum(CONTRIBUTORS.reduce((a, c) => a + c.sessions, 0))}</b> sessions</span>
        <span className="metaitem"><Hash size={13} aria-hidden="true" /> <b>{fmtTokens(CONTRIBUTORS.reduce((a, c) => a + c.tokens, 0))}</b> tokens</span>
        <span className="metaitem"><GitCommitHorizontal size={13} aria-hidden="true" /> <b>{fmtNum(CONTRIBUTORS.reduce((a, c) => a + c.commits, 0))}</b> commits</span>
      </div>
    </section>
  )
}

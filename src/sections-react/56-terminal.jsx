import { useState, Fragment } from 'react'
import { LayoutDashboard, List, TrendingUp, ChevronRight, CornerDownRight } from 'lucide-react'

/* 56-terminal: the peasant TUI (a bubbletea/lipgloss terminal app: dashboard / sessions / trends)
   recreated faithfully in fairtrade. the flow, screens, metrics and keybindings mirror
   `peasant/internal/tui/*` (app.go tab bar; dashboard.go metric cards + sparklines + trend arrows;
   session.go table + detail + quality metrics + turns; trends.go 7-day bar charts). re-skinned from
   the tui's tokyo-night palette onto the system tokens (square, amber, mono, earth accents), so a
   terminal surface reads as the same design language as every other peasant app. */

const TABS = [
  { id: 'dashboard', label: 'dashboard', icon: LayoutDashboard },
  { id: 'sessions', label: 'sessions', icon: List },
  { id: 'trends', label: 'trends', icon: TrendingUp },
]

/* ---- shared: a unicode block sparkline / bar, faithful to dashboard.go renderSparkline ---- */
const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
function Spark({ data, tone }) {
  const s = data.map((v) => BLOCKS[Math.max(0, Math.min(7, Math.round(v * 7)))]).join('')
  return <span className="tui-spark" style={tone ? { color: `var(--${tone})` } : undefined}>{s}</span>
}
/* trend arrow + pct; invert => down is good (olive), up is bad (clay) — faithful to renderTrend */
function Trend({ pct, invert }) {
  if (Math.abs(pct) < 0.5) return <span className="tui-trend tui-trend-flat">─ 0%</span>
  const up = pct > 0
  const good = invert ? !up : up
  return (
    <span className={'tui-trend ' + (good ? 'tui-trend-up' : 'tui-trend-down')}>
      {up ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

/* ---- dashboard ---- three labelled sections of metric cards (buildSections) ---- */
const DASH = [
  {
    title: 'cost & efficiency', tone: 'clay',
    cards: [
      { title: 'tokens trend', value: '42.3K', sec: 'avg per session', tone: 'clay', spark: [.9, .8, .85, .7, .65, .6, .55], pct: -8, invert: true },
      { title: 'cost-of-pass', value: '58.1K', sec: 'per resolved task', tone: 'amber', spark: [.7, .75, .7, .68, .6, .58, .55], pct: -4, invert: true },
    ],
  },
  {
    title: 'behavioral patterns', tone: 'mauve',
    cards: [
      { title: 'avg turns', value: '18', sec: 'per session', tone: 'teal', spark: [.8, .7, .75, .6, .55, .5, .5], pct: -6, invert: true },
      { title: 'retry loops', value: '3/wk', sec: '~12.4K wasted', tone: 'amber', spark: [.6, .8, .5, .7, .4, .3, .35], pct: -11, invert: true },
      { title: 'signal density', value: '71%', sec: 'of context is signal', tone: 'mauve', spark: [.5, .55, .6, .58, .65, .68, .71], pct: 5, invert: false },
    ],
  },
  {
    title: 'quality outcomes', tone: 'olive',
    cards: [
      { title: 'revert rate', value: '0.4/session', sec: 'within-session reverts', tone: 'clay', spark: [.7, .6, .65, .5, .45, .4, .35], pct: -9, invert: true },
      { title: 'spec score', value: '82', sec: 'composite 0–100', tone: 'olive', spark: [.6, .65, .7, .72, .78, .8, .82], pct: 3, invert: false },
    ],
  },
]
function Dashboard() {
  return (
    <div className="tui-dash">
      {DASH.map((sec) => (
        <div className="tui-sec" key={sec.title}>
          <div className="tui-sec-head" style={{ color: `var(--${sec.tone})` }}>{sec.title}</div>
          <div className="tui-cards">
            {sec.cards.map((c) => (
              <div className="tui-card" key={c.title}>
                <div className="tui-card-title">{c.title}</div>
                <div className="tui-card-val tnum">{c.value}</div>
                <div className="tui-card-sec">{c.sec}</div>
                <div className="tui-card-spark"><Spark data={c.spark} tone={c.tone} /> <Trend pct={c.pct} invert={c.invert} /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---- sessions ---- table -> enter -> detail (faithful to session.go) ---- */
const SESSIONS = [
  { id: 'd41a8e', provider: 'claude-code', outcome: 'resolved', date: 'jun 15 14:32', dur: '2h 14m', tokens: 42318, turns: 18 },
  { id: '7c2b90', provider: 'claude-code', outcome: 'partial', date: 'jun 14 09:11', dur: '1h 02m', tokens: 28104, turns: 11 },
  { id: '9a14d2', provider: 'gemini-cli', outcome: 'resolved', date: 'jun 12 16:48', dur: '0h 38m', tokens: 15920, turns: 7 },
  { id: 'b21c44', provider: 'gemini-cli', outcome: 'failed', date: 'jun 11 11:23', dur: '0h 21m', tokens: 9210, turns: 5 },
  { id: '3f8e02', provider: 'opencode', outcome: 'resolved', date: 'jun 10 13:05', dur: '1h 47m', tokens: 36740, turns: 14 },
]
const OUTCOME_TONE = { resolved: 'olive', partial: 'amber', failed: 'clay' }
const DETAIL_META = [
  ['id', 'd41a8e3c-9f02-4b71-a8e1-6c0d2f5b4a90'],
  ['provider', 'claude-code'],
  ['start', '2026-06-15 14:32:08'],
  ['end', '2026-06-15 16:46:22'],
  ['duration', '2h 14m'],
  ['tokens', '30,210 in / 12,108 out / 42,318 total'],
]
const DETAIL_QUALITY = [
  ['outcome', 'resolved', 'olive'],
  ['changes', '8 files, 214 lines'],
  ['retries', '1 loop (1,240 tokens wasted)'],
  ['signal density', '71%'],
  ['reverts', '0 within session'],
  ['spec score', '82 / 100'],
  ['exploration', '34%'],
  ['scope breadth', '5 directories'],
  ['discovery', '3 turns'],
]
const DETAIL_TURNS = [
  { n: 1, role: 'user', text: 'refactor the ingest loader into a channel-backed stream so sessions process at constant memory.', cursor: true },
  { n: 2, role: 'assistant', text: 'reading the eager loader and its callers, then converting it to a streaming reader.', tools: ['read(packages/ingest/loader.go)', 'edit(packages/ingest/stream.go)'] },
  { n: 3, role: 'assistant', text: 'race detector is green; wiring the stream into the session pipeline.', tools: ['bash(go test -race ./...)'], mark: true },
  { n: 4, role: 'user', text: 'add a null-guard on the index access under strict mode, then re-run.' },
]
function Sessions() {
  const [openId, setOpenId] = useState(null)
  if (openId) {
    return (
      <div className="tui-detail">
        <div className="tui-detail-h">session detail</div>
        <div className="tui-kv">
          {DETAIL_META.map(([k, v]) => (
            <Fragment key={k}><span className="tui-kv-k">{k}</span><span className="tui-kv-v">{v}</span></Fragment>
          ))}
        </div>
        <div className="tui-detail-h">quality metrics</div>
        <div className="tui-kv">
          {DETAIL_QUALITY.map(([k, v, tone]) => (
            <Fragment key={k}><span className="tui-kv-k">{k}</span><span className="tui-kv-v" style={tone ? { color: `var(--${tone})`, fontWeight: 600 } : undefined}>{v}</span></Fragment>
          ))}
        </div>
        <div className="tui-detail-h">turns</div>
        <div className="tui-turns">
          {DETAIL_TURNS.map((t) => (
            <div className="tui-turn" key={t.n}>
              <div className="tui-turn-line">
                <span className="tui-turn-cur">{t.cursor ? '>' : ' '}</span>
                <span className="tui-turn-mark">{t.mark ? '*' : ' '}</span>
                <span className="tui-turn-n">turn {t.n}</span>
                <span className="tui-turn-role">[{t.role}]</span>
                <span className="tui-turn-text">{t.text}</span>
              </div>
              {t.tools && t.tools.map((tc) => (
                <div className="tui-turn-tool" key={tc}><CornerDownRight size={12} aria-hidden="true" /> {tc}</div>
              ))}
            </div>
          ))}
        </div>
        <button type="button" className="tui-back" onClick={() => setOpenId(null)}>esc · back to sessions</button>
      </div>
    )
  }
  return (
    <table className="tui-table">
      <thead>
        <tr><th>id</th><th>provider</th><th>outcome</th><th>date</th><th>duration</th><th className="tui-num">tokens</th><th className="tui-num">turns</th><th aria-hidden="true"></th></tr>
      </thead>
      <tbody>
        {SESSIONS.map((s, i) => (
          <tr key={s.id} className={i === 0 ? 'tui-row-sel' : undefined}>
            <td className="tui-mono">{s.id}</td>
            <td>{s.provider}</td>
            <td><span style={{ color: `var(--${OUTCOME_TONE[s.outcome]})`, fontWeight: 600 }}>{s.outcome}</span></td>
            <td>{s.date}</td>
            <td className="tnum">{s.dur}</td>
            <td className="tui-num tnum">{s.tokens.toLocaleString()}</td>
            <td className="tui-num tnum">{s.turns}</td>
            <td className="tui-row-act"><button type="button" className="tui-open" onClick={() => setOpenId(s.id)} aria-label={`open session ${s.id}`}><ChevronRight size={14} aria-hidden="true" /></button></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---- trends ---- horizontal 7-day bar charts (faithful to trends.go) ---- */
const DAYS = ['mon jun 09', 'tue jun 10', 'wed jun 11', 'thu jun 12', 'fri jun 13', 'sat jun 14', 'sun jun 15']
const TREND_CHARTS = [
  { title: 'tokens per day (last 7 days)', tone: 'teal', vals: [38, 52, 21, 16, 0, 28, 42], unit: (v) => v ? `${v}K tokens` : '' },
  { title: 'sessions per day', tone: 'mauve', vals: [2, 3, 1, 1, 0, 1, 2], unit: (v) => v ? `${v} sessions` : '' },
  { title: 'spec score per day', tone: 'olive', vals: [78, 80, 0, 71, 0, 76, 82], unit: (v) => v ? `${v}` : '' },
]
function Bars({ chart }) {
  const max = Math.max(...chart.vals, 1)
  return (
    <div className="tui-bars">
      {chart.vals.map((v, i) => {
        const w = v > 0 ? Math.max(2, Math.round((v / max) * 100)) : 0
        return (
          <div className="tui-bar-row" key={DAYS[i]}>
            <span className="tui-bar-label">{DAYS[i]}</span>
            <span className="tui-bar-track"><span className="tui-bar-fill" style={{ width: w + '%', background: `var(--${chart.tone})` }} /></span>
            <span className="tui-bar-val tnum">{chart.unit(v)}</span>
          </div>
        )
      })}
    </div>
  )
}
function Trends() {
  return (
    <div className="tui-trends">
      {TREND_CHARTS.map((c) => (
        <div className="tui-chart" key={c.title}>
          <div className="tui-sec-head" style={{ color: `var(--${c.tone})` }}>{c.title}</div>
          <Bars chart={c} />
        </div>
      ))}
      <div className="tui-trends-foot">7-day total: 197K tokens across 10 sessions</div>
    </div>
  )
}

const HELP = {
  dashboard: 'tab/shift-tab: switch • 1-3: jump • q: quit',
  sessions: 'enter: open • ↑↓: move • tab: switch • q: quit',
  trends: '↑↓/j/k: scroll • tab/shift-tab: switch • q: quit',
}

/* ---- flow B: the `peasant kickstart` first-run wizard (internal/tui/ftue) ----
   a 9-page bubbletea wizard in one frame with a "step N of M" header; here the core pages, re-skinned
   from the tui's lilac onto the system tokens. radios are interactive; the summary reflects choices. */
function Radio({ options, value, onChange, name }) {
  return (
    <div className="tuiw-radio" role="radiogroup" aria-label={name}>
      {options.map((o) => {
        const on = value === o.id
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} className={'tuiw-opt' + (on ? ' tuiw-opt-on' : '')} onClick={() => onChange(o.id)}>
            <span className="tuiw-cur">{on ? '▸' : ' '}</span>
            <span className="tuiw-dot">{on ? '●' : '○'}</span>
            <span className="tuiw-opt-main">
              <span className="tuiw-opt-label">{o.label}</span>
              {o.desc && <span className="tuiw-opt-desc">{o.desc}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const WIZ_PROVIDERS = [
  { id: 'claude-code', label: 'claude code', n: 128, on: true },
  { id: 'codex', label: 'codex', n: 12, on: true },
  { id: 'gemini-cli', label: 'gemini cli', n: 12, on: false },
  { id: 'opencode', label: 'opencode', n: 0, on: false },
]
const REDACTION = [
  { id: 'minimal', label: 'minimal', desc: 'redacts only detected secrets (api keys, tokens, passwords).' },
  { id: 'standard', label: 'standard (recommended)', desc: 'redacts secrets and pii — emails, file paths.' },
  { id: 'maximum', label: 'maximum', desc: 'full anonymization including code identifiers.' },
]
const RETENTION = [
  { id: '30d', label: '30 days', desc: 'claude code default — deleted after 30 days of inactivity.' },
  { id: '90d', label: '90 days', desc: 'keep transcripts for 3 months.' },
  { id: '1y', label: '1 year', desc: 'keep transcripts for a full year.' },
  { id: 'never', label: 'never expire (recommended)', desc: 'transcripts are never automatically deleted.' },
]
const INGEST_STAGES = [
  { label: 'discover', state: 'done', n: 152, m: 152 },
  { label: 'diff', state: 'active', n: 76, m: 152 },
  { label: 'filter', state: 'pending', n: 0, m: 152 },
  { label: 'extract', state: 'pending', n: 0, m: 152 },
  { label: 'db insert', state: 'pending', n: 0, m: 152 },
  { label: 'index', state: 'pending', n: 0, m: 152 },
]

function TuiWizard() {
  const [page, setPage] = useState(0)
  const [village, setVillage] = useState('connect')
  const [redaction, setRedaction] = useState('standard')
  const [retention, setRetention] = useState('never')

  const pages = [
    {
      title: 'welcome to peasant',
      body: (
        <>
          <p className="tuiw-lede">connect to the peasant village for shared analytics, or stay local for private-only usage.</p>
          <Radio name="village" value={village} onChange={setVillage} options={[
            { id: 'connect', label: 'connect to peasant village', desc: 'share anonymized session analytics with the community' },
            { id: 'local', label: 'stay local', desc: 'all data stays on your machine' },
          ]} />
        </>
      ),
    },
    {
      title: 'select providers',
      body: (
        <>
          <p className="tuiw-lede">discovered 152 transcripts. select providers to import from.</p>
          <div className="tuiw-checks">
            {WIZ_PROVIDERS.map((p) => (
              <div key={p.id} className={'tuiw-check' + (p.n === 0 ? ' tuiw-check-off' : '')}>
                <span className="tuiw-box">{p.on ? '[✓]' : '[ ]'}</span> {p.label} <span className="tuiw-check-n">({p.n} sessions)</span>
                {p.on && <span className="tuiw-sub">▸ ● import all   ○ select sessions</span>}
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      title: 'privacy preference',
      body: (
        <>
          <p className="tuiw-lede">choose your default redaction level. this controls what is redacted before transcripts leave your machine.</p>
          <Radio name="redaction" value={redaction} onChange={setRedaction} options={REDACTION} />
        </>
      ),
    },
    {
      title: 'transcript retention',
      body: (
        <>
          <p className="tuiw-lede">claude code deletes conversation history after a period of inactivity; peasant needs these to analyze your sessions.</p>
          <Radio name="retention" value={retention} onChange={setRetention} options={RETENTION} />
        </>
      ),
    },
    {
      title: 'summary',
      body: (
        <div className="tuiw-kv">
          <span className="tuiw-kv-k">village</span><span className="tuiw-kv-v">{village === 'connect' ? 'connected' : 'local only'}</span>
          <span className="tuiw-kv-k">redaction</span><span className="tuiw-kv-v">{REDACTION.find((r) => r.id === redaction).label.replace(' (recommended)', '')}</span>
          <span className="tuiw-kv-k">retention</span><span className="tuiw-kv-v">{RETENTION.find((r) => r.id === retention).label.replace(' (recommended)', '')}</span>
          <span className="tuiw-kv-k">import</span><span className="tuiw-kv-v">claude code (all), codex (all)</span>
          <span className="tuiw-kv-k">selected</span><span className="tuiw-kv-v tnum">140 sessions</span>
        </div>
      ),
    },
    {
      title: 'importing transcripts',
      body: (
        <div className="tuiw-stages">
          {INGEST_STAGES.map((s) => {
            const pct = Math.round((s.n / s.m) * 100)
            const icon = s.state === 'done' ? '✔' : s.state === 'active' ? '●' : '○'
            return (
              <div key={s.label} className={'tuiw-stage tuiw-stage-' + s.state}>
                <span className="tuiw-stage-icon">{icon}</span>
                <span className="tuiw-stage-label">{s.label}</span>
                <span className="tuiw-stage-bar"><span className="tuiw-stage-fill" style={{ width: pct + '%' }} /></span>
                <span className="tuiw-stage-n tnum">{s.n > 0 ? `${s.n}/${s.m}` : ''}</span>
              </div>
            )
          })}
        </div>
      ),
    },
  ]
  const isLast = page === pages.length - 1
  return (
    <div className="tui tuiw">
      <div className="tuiw-head">
        <span className="tuiw-step">step {page + 1} of {pages.length}</span>
        <span className="tuiw-title">{pages[page].title}</span>
      </div>
      <div className="tuiw-body">{pages[page].body}</div>
      <div className="tuiw-foot">
        <div className="tuiw-foot-btns">
          <button type="button" className="tuiw-btn" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>back</button>
          <button type="button" className="tuiw-btn tuiw-btn-primary" onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))} disabled={isLast}>{page === 4 ? 'save & import' : 'continue'}</button>
        </div>
        <span className="tuiw-keys">b: back • enter: continue • r: restart • q: quit</span>
      </div>
    </div>
  )
}

export function TerminalSection() {
  const [tab, setTab] = useState('dashboard')
  return (
    <section className="band" id="terminal">
      <h2 className="label">terminal &amp; tui</h2>
      <div className="sub">the peasant tui, rebuilt in fairtrade</div>
      <p className="prose">peasant ships a terminal ui (bubbletea + lipgloss): a tabbed dashboard, a sessions table that drills into a transcript, and seven-day trend charts. the same flow re-skinned onto the system tokens shows the language reaches a terminal surface too: square, mono, amber-scarce, earth accents instead of the original tokyo-night pastels.</p>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">peasant · tui</span></div>
        <div className="specimen-body" style={{ padding: 0 }}>
          <div className="tui" role="group" aria-label="peasant tui recreation">
            <div className="tui-tabs" role="tablist" aria-label="tui tabs">
              {TABS.map((t) => {
                const Icon = t.icon
                const on = tab === t.id
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={on} className={'tui-tab' + (on ? ' tui-tab-on' : '')} onClick={() => setTab(t.id)}>
                    <Icon size={14} aria-hidden="true" /> {t.label}
                  </button>
                )
              })}
              <span className="tui-tabs-spacer" />
              <span className="tui-status">peasant · 10 sessions · on this computer</span>
            </div>
            <div className="tui-screen">
              {tab === 'dashboard' && <Dashboard />}
              {tab === 'sessions' && <Sessions />}
              {tab === 'trends' && <Trends />}
            </div>
            <div className="tui-help">{HELP[tab]}</div>
          </div>
        </div>
      </div>
      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>first-run wizard (peasant kickstart)</h3>
      <p className="prose" style={{ marginTop: 0 }}>the second tui flow: a nine-page setup wizard in one frame with a step header. the core pages, interactive — pick a redaction level or retention and the summary updates.</p>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">peasant · kickstart</span></div>
        <div className="specimen-body" style={{ padding: 0 }}><TuiWizard /></div>
      </div>
      <div className="callout" style={{ marginTop: 'var(--sp-6)' }}><TrendingUp size={16} aria-hidden="true" /><div>one design language across surfaces: the tui reuses the same tokens, square chrome and earth accents as the web apps. state never rides on color alone (outcomes carry a word; trends carry an arrow).</div></div>
    </section>
  )
}

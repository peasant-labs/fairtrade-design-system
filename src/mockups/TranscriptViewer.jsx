import { useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Clock,
  GitBranch,
  Hash,
  ShieldCheck,
  Flag,
  User,
  FileText,
  Search,
  SquarePen,
  Terminal,
  GitFork,
  Brain,
  Check,
  GitCommitHorizontal,
  Star,
  FileDiff,
  ListTree,
  CornerDownRight,
} from 'lucide-react'

/* MOCKUP 1, transcript viewer. a working mini transcript browser: a left rail that
   switches between trace / highlights / diffs / files and lists the turns, and a
   reading window on the right. selecting a turn in the rail scrolls to and highlights
   it in the window; tool-call headers expand on demand; tabs switch the rail content.
   all interactive state lives in react; chrome stays lowercase, content keeps its case. */

/* a claude-code session: refactor the ingest pipeline to stream. turns are the unit the
   rail lists and the window renders. tool calls collapse to a summary and open on click. */
const TURNS = [
  {
    n: 1,
    role: 'user',
    summary: 'refactor request',
    body: 'Can you refactor the ingest pipeline so it streams sessions instead of loading everything into memory? Keep the tests green.',
  },
  {
    n: 2,
    role: 'asst',
    summary: 'plan the stream boundary',
    body: "I'll convert loadAll into a streaming reader so sessions are processed one at a time. Let me map where it's used, then swap the eager load for a channel-backed stream.",
    thinking: 'thought for 6s, planning the stream boundary',
    tools: [
      { id: 't2a', kind: 'read', icon: 'read', path: 'internal/ingest/pipeline.go', right: '240 lines', body: { type: 'lines', text: 'func (p *Pipeline) Run(ctx context.Context) error {\n  sessions, err := loadAll(ctx, p.src)\n  if err != nil { return err }\n  for _, s := range sessions {\n    p.process(s)\n  }\n}' } },
    ],
  },
  {
    n: 3,
    role: 'sub',
    summary: 'explore loadAll call sites',
    subAgent: 'Explore',
    subTitle: 'explore loadAll call sites',
    body: 'Searched the pipeline for loadAll. Found 3 call sites, all reachable from Run. Safe to replace with a streaming reader.',
    tools: [
      { id: 't3a', kind: 'grep', icon: 'grep', path: 'loadAll in internal/ingest', right: '3 matches', body: { type: 'lines', text: 'internal/ingest/pipeline.go:212  sessions, err := loadAll(ctx, p.src)\ninternal/ingest/replay.go:44     all := loadAll(ctx, src)\ninternal/ingest/export.go:91      for _, s := range loadAll(ctx, p.src) {' } },
    ],
  },
  {
    n: 4,
    role: 'asst',
    summary: 'swap eager load for stream',
    body: 'Confirmed. Swapping the eager load for openStream and running the race detector.',
    tools: [
      {
        id: 't4a',
        kind: 'edit',
        icon: 'edit',
        path: 'internal/ingest/pipeline.go',
        right: '+1 -1',
        body: {
          type: 'diff',
          hunk: [
            { sign: 'ctx', gut: '211', t: 'func (p *Pipeline) Run(ctx context.Context) error {' },
            { sign: 'del', gut: '212', t: '  sessions, err := loadAll(ctx, p.src)' },
            { sign: 'add', gut: '212', t: '  stream, err := openStream(ctx, p.src)' },
            { sign: 'ctx', gut: '213', t: '  if err != nil { return err }' },
          ],
        },
      },
      { id: 't4b', kind: 'bash', icon: 'bash', path: 'go test -race ./internal/ingest/', right: 'ok', ok: true, body: { type: 'lines', text: 'ok  \tinternal/ingest\t1.284s\nrace detector: no data races found' } },
    ],
    commit: { hash: 'a3f9c1', msg: 'stream ingest, constant memory' },
  },
  {
    n: 5,
    role: 'user',
    summary: 'check the replay path',
    body: 'Good. Now check the replay path uses the same stream so memory stays flat there too.',
  },
  {
    n: 6,
    role: 'asst',
    summary: 'reuse openStream in replay',
    body: 'replay.go still called loadAll. Pointing it at openStream as well so both paths share the constant-memory reader.',
    thinking: 'thought for 3s, reusing the reader in replay',
    tools: [
      {
        id: 't6a',
        kind: 'edit',
        icon: 'edit',
        path: 'internal/ingest/replay.go',
        right: '+2 -2',
        body: {
          type: 'diff',
          hunk: [
            { sign: 'ctx', gut: '43', t: 'func Replay(ctx context.Context, src Source) error {' },
            { sign: 'del', gut: '44', t: '  all := loadAll(ctx, src)' },
            { sign: 'del', gut: '45', t: '  for _, s := range all {' },
            { sign: 'add', gut: '44', t: '  stream := openStream(ctx, src)' },
            { sign: 'add', gut: '45', t: '  for s := range stream {' },
            { sign: 'ctx', gut: '46', t: '    replay(s)' },
          ],
        },
      },
    ],
  },
  {
    n: 7,
    role: 'user',
    summary: 'run the full suite',
    body: 'Run the full suite once more before you commit.',
  },
  {
    n: 8,
    role: 'asst',
    summary: 'full suite green, commit',
    body: 'Full suite is green and the race detector is clean. Committing the replay change.',
    tools: [
      { id: 't8a', kind: 'bash', icon: 'bash', path: 'go test ./...', right: 'ok', ok: true, body: { type: 'lines', text: 'ok  \tinternal/ingest\t1.301s\nok  \tinternal/store\t0.442s\nok  \tcmd/ingest\t0.118s' } },
    ],
    commit: { hash: 'b7e220', msg: 'stream replay path, share reader' },
  },
]

/* turns that earned a star, by turn number (drives the highlights rail tab) */
const STARRED = [2, 4, 8]

const TOOL_ICON = { read: FileText, grep: Search, edit: SquarePen, bash: Terminal }

const ROLE_META = {
  user: { label: 'user', Icon: User },
  asst: { label: 'claude', Icon: null },
  sub: { label: 'subagent', Icon: GitFork },
}

/* the inline claude brand mark (svg symbol lives in the defs partial, document-global) */
function ClaudeMark() {
  return (
    <svg className="brand" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <use href="#b-claude" />
    </svg>
  )
}

/* a tool call: header is a real button toggling aria-expanded; the body (lines or a
   unified diff) reveals on open. open state is owned by the parent so it persists. */
function ToolCall({ tool, open, onToggle }) {
  const Icon = TOOL_ICON[tool.icon] || FileText
  return (
    <div className="toolcall">
      <button
        type="button"
        className="tc-head mock-tc-btn"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="kind"><Icon size={14} aria-hidden="true" /> {tool.kind}</span>
        <span className="path">{tool.path}</span>
        <span className="right" style={tool.ok ? { color: 'var(--olive)' } : undefined}>
          {tool.ok ? <Check size={14} aria-hidden="true" /> : null}
          <span className="tnum">{tool.right}</span>
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </span>
      </button>
      {open && tool.body.type === 'lines' && (
        <pre className="mock-tc-body">{tool.body.text}</pre>
      )}
      {open && tool.body.type === 'diff' && (
        <div className="diff">
          {tool.body.hunk.map((d, i) => (
            <div className={'dl ' + d.sign} key={i}>
              <span className="rail" />
              <span className="gut tnum">{d.gut}</span>
              <span className="sign">{d.sign === 'add' ? '+' : d.sign === 'del' ? '−' : ''}</span>
              <span className="t">{d.t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* one turn in the reading window. user/asst/sub are tinted + led by a role icon and a
   tabular turn number. the subagent turn is wrapped in a bracketed nested thread. */
function Turn({ turn, selected, openTools, toggleTool, registerRef }) {
  const meta = ROLE_META[turn.role]
  const Icon = meta.Icon

  const head = (
    <div className="turn-head">
      {turn.role === 'asst' ? <ClaudeMark /> : <Icon size={14} aria-hidden="true" />}
      {meta.label}
      <span className="meta tnum">turn {turn.n}</span>
    </div>
  )

  const bodyInner = (
    <>
      <div className="body">{turn.body}</div>
      {turn.thinking && (
        <div className="thinking"><Brain size={14} aria-hidden="true" /> {turn.thinking}</div>
      )}
      {turn.tools &&
        turn.tools.map((t) => (
          <ToolCall key={t.id} tool={t} open={!!openTools[t.id]} onToggle={() => toggleTool(t.id)} />
        ))}
    </>
  )

  if (turn.role === 'sub') {
    return (
      <div
        className={'mock-turn-wrap' + (selected ? ' mock-sel' : '')}
        ref={(el) => registerRef(turn.n, el)}
        data-turn={turn.n}
      >
        <div className="subtask">
          <div className="subtask-head">
            <GitFork size={14} aria-hidden="true" /> <span className="who">{turn.subAgent}</span> {turn.subTitle}
            <span className="elbow" style={{ marginLeft: 'auto' }}>
              <CornerDownRight size={13} aria-hidden="true" /> spawned subagent
            </span>
          </div>
          <div className="turn sub">
            {head}
            {bodyInner}
          </div>
          <div className="subtask-foot">
            <span className="elbow"><CornerDownRight size={13} aria-hidden="true" /> returned to claude</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={'mock-turn-wrap' + (selected ? ' mock-sel' : '')}
      ref={(el) => registerRef(turn.n, el)}
      data-turn={turn.n}
    >
      <div className={'turn ' + turn.role}>
        {head}
        {bodyInner}
      </div>
      {turn.commit && (
        <div className="marker">
          <span className="r" />
          <span className="mc">
            <GitCommitHorizontal size={14} aria-hidden="true" /> commit <span className="hash mono">{turn.commit.hash}</span> {turn.commit.msg}
          </span>
          <span className="r" />
        </div>
      )}
    </div>
  )
}

const RAIL_TABS = [
  { id: 'trace', label: 'trace', count: TURNS.length },
  { id: 'highlights', label: 'highlights', count: STARRED.length },
  { id: 'diffs', label: 'diffs', count: TURNS.filter((t) => t.tools?.some((x) => x.body.type === 'diff')).length },
  { id: 'files', label: 'files', count: 3 },
]

const FILES = [
  { path: 'internal/ingest/pipeline.go', change: '+1 -1' },
  { path: 'internal/ingest/replay.go', change: '+2 -2' },
  { path: 'cmd/ingest/main.go', change: 'read' },
]

export default function TranscriptViewer() {
  const [tab, setTab] = useState('trace')
  const [selected, setSelected] = useState(1)
  /* tool calls in turn 2, 4 (the diff) start open so the diff and a tool body are visible
     on first paint; the rest collapse to their summary line. */
  const [openTools, setOpenTools] = useState({ t2a: true, t4a: true })

  const turnRefs = useRef({})
  const scrollRef = useRef(null)
  const tabRefs = useRef({})

  const registerRef = (n, el) => {
    if (el) turnRefs.current[n] = el
  }

  function toggleTool(id) {
    setOpenTools((o) => ({ ...o, [id]: !o[id] }))
  }

  /* select a turn from the rail: highlight it and scroll the window to it. scrolls the
     inner scroll container (not the page), so the sticky header stays put. */
  function selectTurn(n) {
    setSelected(n)
    const el = turnRefs.current[n]
    const scroller = scrollRef.current
    if (el && scroller) {
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const top = el.offsetTop - 8
      scroller.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
    }
  }

  /* arrow-key roving across the rail tablist */
  function onTabKey(e) {
    const i = RAIL_TABS.findIndex((t) => t.id === tab)
    let j = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % RAIL_TABS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + RAIL_TABS.length) % RAIL_TABS.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = RAIL_TABS.length - 1
    else return
    e.preventDefault()
    const next = RAIL_TABS[j].id
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  /* the rail list for the active tab. trace lists every turn; highlights only starred
     turns; diffs and files list the changed surfaces. each row selects/scrolls a turn. */
  const railRows = useMemo(() => {
    if (tab === 'trace') {
      return TURNS.map((t) => ({ n: t.n, role: t.role, primary: t.summary }))
    }
    if (tab === 'highlights') {
      return TURNS.filter((t) => STARRED.includes(t.n)).map((t) => ({ n: t.n, role: t.role, primary: t.summary, star: true }))
    }
    if (tab === 'diffs') {
      const rows = []
      for (const t of TURNS) {
        for (const tool of t.tools || []) {
          if (tool.body.type === 'diff') rows.push({ n: t.n, role: t.role, primary: tool.path, change: tool.right })
        }
      }
      return rows
    }
    return null // files handled separately (no turn link)
  }, [tab])

  return (
    <section className="band" id="mock-viewer">
      <h2 className="label">transcript viewer</h2>
      <div className="sub">a working reading view: switch the rail, jump to a turn, open a tool call</div>
      <p className="prose">a recorded claude-code session, read end to end. the left rail switches between the full trace, the starred highlights, the diffs and the touched files; selecting any row scrolls the window to that turn and marks it. tool calls collapse to a summary line and open on demand, so a long run still scans in a glance. everything is keyboard reachable.</p>

      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">live</span></div>
        <div className="specimen-body">
          <div className="window framed mock-viewer">
            <div className="win-head">
              <div className="crumb">
                village <ChevronRight size={13} aria-hidden="true" /> vitor-hw <ChevronRight size={13} aria-hidden="true" /> <span className="cur">refactor ingest pipeline</span>
              </div>
              <div className="win-title">refactor ingest pipeline to stream</div>
              <div className="win-meta">
                <span className="metaitem"><span className="g-claude"><ClaudeMark /></span> claude-code</span>
                <span className="metaitem"><Clock size={14} aria-hidden="true" /> <b className="tnum">2h 14m</b></span>
                <span className="metaitem"><GitBranch size={14} aria-hidden="true" /> <b className="tnum">8</b> turns</span>
                <span className="metaitem"><Hash size={14} aria-hidden="true" /> <b className="tnum">42,318</b> tokens</span>
                <span className="chip chip-ok"><ShieldCheck size={14} aria-hidden="true" /> redacted</span>
              </div>
            </div>

            <div className="mock-viewer-body">
              {/* LEFT RAIL: tabs + the list they switch */}
              <aside className="mock-rail" aria-label="transcript views">
                <div className="tabs mock-rail-tabs" role="tablist" aria-label="transcript views" onKeyDown={onTabKey}>
                  {RAIL_TABS.map((t) => {
                    const on = tab === t.id
                    return (
                      <button
                        key={t.id}
                        ref={(el) => (tabRefs.current[t.id] = el)}
                        type="button"
                        role="tab"
                        id={'mock-tab-' + t.id}
                        aria-controls={'mock-panel-' + t.id}
                        aria-selected={on}
                        tabIndex={on ? 0 : -1}
                        className={'tab' + (on ? ' active' : '')}
                        onClick={() => setTab(t.id)}
                      >
                        {t.label} <span className="cnt tnum">{t.count}</span>
                      </button>
                    )
                  })}
                </div>

                <div
                  className="mock-rail-panel"
                  id={'mock-panel-' + tab}
                  role="tabpanel"
                  aria-labelledby={'mock-tab-' + tab}
                  tabIndex={0}
                >
                  {tab === 'files' ? (
                    <ul className="mock-tree" aria-label="touched files">
                      {FILES.map((f) => (
                        <li key={f.path} className="mock-tree-row">
                          <FileText size={14} aria-hidden="true" />
                          <span className="mock-tree-path mono">{f.path}</span>
                          <span className="mock-tree-meta tnum">{f.change}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="mock-turnlist" aria-label={tab + ' turns'}>
                      {railRows.map((r, i) => {
                        const RIcon = r.role === 'asst' ? null : r.role === 'sub' ? GitFork : User
                        return (
                          <li key={r.n + '-' + i}>
                            <button
                              type="button"
                              className={'mock-turnlist-row' + (selected === r.n ? ' mock-on' : '')}
                              aria-current={selected === r.n ? 'true' : undefined}
                              onClick={() => selectTurn(r.n)}
                            >
                              <span className={'mock-turnlist-role mock-role-' + r.role}>
                                {RIcon ? <RIcon size={13} aria-hidden="true" /> : <ClaudeMark />}
                              </span>
                              <span className="mock-turnlist-text">
                                {tab === 'diffs' ? (
                                  <span className="mono">{r.primary}</span>
                                ) : (
                                  r.primary
                                )}
                              </span>
                              {r.star && <Star size={13} aria-hidden="true" className="mock-star" />}
                              {r.change ? (
                                <span className="mock-turnlist-meta tnum">{r.change}</span>
                              ) : (
                                <span className="mock-turnlist-n tnum">{r.n}</span>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </aside>

              {/* RIGHT: the reading window */}
              <div className="mock-stream" ref={scrollRef} tabIndex={-1}>
                <div className="phase">
                  <span className="lbl"><Flag size={14} aria-hidden="true" /> phase: streaming refactor</span>
                  <span className="rng tnum">turns 1-8</span>
                </div>
                {TURNS.map((t) => (
                  <Turn
                    key={t.n}
                    turn={t}
                    selected={selected === t.n}
                    openTools={openTools}
                    toggleTool={toggleTool}
                    registerRef={registerRef}
                  />
                ))}
              </div>
            </div>

            <div className="win-foot">
              <span className="chip chip-ok"><Check size={14} aria-hidden="true" /> tests green</span>
              <span className="chip"><FileDiff size={14} aria-hidden="true" /> +3 -3 in 2 files</span>
              <span className="chip"><ListTree size={14} aria-hidden="true" /> <span className="tnum">2</span> commits</span>
            </div>
          </div>
        </div>
      </div>

      <div className="callout">
        <ShieldCheck size={16} aria-hidden="true" />
        <div>role is carried by an icon and a label, never tint alone; transcript bodies and code keep their original case while the chrome stays lowercase. selecting a rail row scrolls the window, not the page, so the sticky header holds. tool-call headers are real buttons that toggle aria-expanded.</div>
      </div>
    </section>
  )
}

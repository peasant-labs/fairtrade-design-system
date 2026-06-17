import { useMemo, useRef, useState } from 'react'
import {
  Search,
  Check,
  Clock,
  GitBranch,
  Hash,
  Eye,
  Users,
  FileText,
  Compass,
  ArrowLeft,
  ShieldCheck,
  BadgeCheck,
  CircleDot,
} from 'lucide-react'
import { AsciiImage } from '../effects.jsx'
import peasantWoman from '../img/peasant-woman.jpg'
import peasantMan from '../img/peasant-man.jpg'

/* provider brand marks (svg symbols live in the document-global defs partial).
   color comes from the .g-* wrapper class, matching the rest of the system. */
function ProviderMark({ id }) {
  const cls = { 'claude-code': 'g-claude', 'gemini-cli': 'g-gemini', opencode: 'g-opencode' }[id]
  const sym = { 'claude-code': '#b-claude', 'gemini-cli': '#b-gemini', opencode: '#b-opencode' }[id]
  return (
    <span className={cls}>
      <svg className="brand" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <use href={sym} />
      </svg>
    </span>
  )
}

/* mock data: ~9 transcripts and collectives. user content (titles, summaries,
   author handles) keeps its original case; chrome stays lowercase. */
const DATA = [
  {
    id: '9f3c',
    provider: 'claude-code',
    title: 'Refactor ingest pipeline to stream',
    summary: 'Converted the eager loader into a channel-backed stream so sessions process at constant memory.',
    turns: 18,
    tokens: 42318,
    durMin: 134,
    author: 'vitor-hw',
    date: '2026-06-15',
    state: 'verified',
    portrait: 'woman',
  },
  {
    id: '7b21',
    provider: 'gemini-cli',
    title: 'Tune redaction rules for API keys',
    summary: 'Widened the secret patterns and added a review pass so nothing leaks before publish.',
    turns: 9,
    tokens: 11204,
    durMin: 63,
    author: 'mara-s',
    date: '2026-06-14',
    state: 'open',
  },
  {
    id: 'a3f9',
    provider: 'opencode',
    title: 'Add FTS5 search index to the commons',
    summary: 'Built a full-text index over titles and summaries so the browse view filters as you type.',
    turns: 24,
    tokens: 58740,
    durMin: 211,
    author: 'otho-q',
    date: '2026-06-13',
    state: 'verified',
    portrait: 'man',
  },
  {
    id: 'c1d4',
    provider: 'claude-code',
    title: 'Wire the dialog focus return',
    summary: 'The join dialog now returns focus to its trigger on close and traps tab while open.',
    turns: 6,
    tokens: 8430,
    durMin: 41,
    author: 'liss-m',
    date: '2026-06-12',
    state: 'open',
  },
  {
    id: 'e8a0',
    provider: 'gemini-cli',
    title: 'Migrate tokens to two themes',
    summary: 'Split the palette into dark and a truly white light theme, both driven by the same tokens.',
    turns: 31,
    tokens: 73650,
    durMin: 298,
    author: 'veil-t',
    date: '2026-06-11',
    state: 'verified',
  },
  {
    id: 'b5f7',
    provider: 'opencode',
    title: 'Fix race in the publish queue',
    summary: 'Found and closed a data race where two contributors could claim the same draft slot.',
    turns: 14,
    tokens: 26980,
    durMin: 97,
    author: 'mara-s',
    date: '2026-06-10',
    state: 'open',
  },
  {
    id: 'd2e9',
    provider: 'claude-code',
    title: 'Generate the ascii hero from the wheat clip',
    summary: 'Sampled the source video to a glyph grid at runtime so the hero stays crisp at any size.',
    turns: 21,
    tokens: 49120,
    durMin: 176,
    author: 'vitor-hw',
    date: '2026-06-09',
    state: 'verified',
  },
  {
    id: 'f0c3',
    provider: 'gemini-cli',
    title: 'Audit border contrast across tiers',
    summary: 'Raised functional borders to a 3:1 ratio and kept dividers subtle, verified by the gate.',
    turns: 12,
    tokens: 19870,
    durMin: 84,
    author: 'otho-q',
    date: '2026-06-08',
    state: 'open',
  },
  {
    id: 'a7b2',
    provider: 'opencode',
    title: 'Add a snap-scroll use-case walkthrough',
    summary: 'A one-column flow that snaps through the publish path, with a static fallback for reduced motion.',
    turns: 17,
    tokens: 35640,
    durMin: 121,
    author: 'liss-m',
    date: '2026-06-07',
    state: 'verified',
  },
]

const ORDER = [
  { id: 'recent', label: 'most recent' },
  { id: 'turns', label: 'most turns' },
  { id: 'tokens', label: 'most tokens' },
]
const PROVIDERS = [
  { id: 'claude-code', label: 'claude-code' },
  { id: 'gemini-cli', label: 'gemini-cli' },
  { id: 'opencode', label: 'opencode' },
]
const ACCEPT = [
  { id: 'open', label: 'open' },
  { id: 'verified', label: 'verified' },
]

const fmtTokens = (n) => n.toLocaleString('en-US')
const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`)

/* a single transcript card. the whole card is one target (a button); the ascii
   thumbnail is decorative and the title carries the meaning. */
function CommonsCard({ t, onOpen, theme }) {
  const portrait = t.portrait === 'woman' ? peasantWoman : t.portrait === 'man' ? peasantMan : null
  return (
    <div
      className="card card-img mock-card"
      role="button"
      tabIndex={0}
      aria-label={`open preview: ${t.title}`}
      onClick={() => onOpen(t.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(t.id)
        }
      }}
    >
      {portrait && (
        <div className="card-thumb">
          <AsciiImage
            src={portrait}
            cols={224}
            aspect={0.6}
            isolated
            contrast={1.16}
            gamma={0.76}
            black={0.18}
            white={0.82}
            vignette={0.16}
            ink="#ece7dd"
            theme={theme}
            className="thumb-ascii"
          />
        </div>
      )}
      <div className="card-body">
        <div className="card-head">
          <span className="metaitem">
            <ProviderMark id={t.provider} /> {t.provider}
          </span>
          <Eye size={14} style={{ color: 'var(--ink-3)' }} aria-hidden="true" />
        </div>
        <h3>{t.title}</h3>
        <p className="desc">{t.summary}</p>
        <div className="mock-card-state">
          {t.state === 'verified' ? (
            <span className="chip chip-ok">
              <BadgeCheck size={14} aria-hidden="true" /> verified
            </span>
          ) : (
            <span className="chip">
              <CircleDot size={14} aria-hidden="true" /> open
            </span>
          )}
        </div>
        <div className="card-foot">
          <span className="metaitem">
            <GitBranch size={14} aria-hidden="true" /> <b className="tnum">{t.turns}</b> turns
          </span>
          <span className="metaitem">
            <Hash size={14} aria-hidden="true" /> <b className="tnum">{fmtTokens(t.tokens)}</b>
          </span>
          <span className="metaitem">
            <Clock size={14} aria-hidden="true" /> <b className="tnum">{fmtDur(t.durMin)}</b>
          </span>
        </div>
      </div>
    </div>
  )
}

/* a sidebar option row. reuses .sb-opt + .on; the amber check carries the
   active state alongside the bold ink, never color alone. */
function FilterOpt({ on, onToggle, children }) {
  return (
    <div className={'sb-opt mock-opt' + (on ? ' on' : '')} role="button" tabIndex={0} aria-pressed={on}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      <span>{children}</span>
      {on && <Check size={14} aria-hidden="true" />}
    </div>
  )
}

export default function Commons({ theme }) {
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('recent')
  const [providers, setProviders] = useState(() => new Set()) // empty = all providers
  const [accept, setAccept] = useState(() => new Set()) // empty = any acceptance
  const [openId, setOpenId] = useState(null)
  const searchRef = useRef(null)

  function toggleSet(setter, key) {
    setter((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function reset() {
    setQuery('')
    setOrder('recent')
    setProviders(new Set())
    setAccept(new Set())
  }

  /* sort + filter + search compose here, recomputed only when an input changes. */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = DATA.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false
      if (providers.size && !providers.has(t.provider)) return false
      if (accept.size && !accept.has(t.state)) return false
      return true
    })
    rows = rows.slice().sort((a, b) => {
      if (order === 'turns') return b.turns - a.turns
      if (order === 'tokens') return b.tokens - a.tokens
      return b.date.localeCompare(a.date) // recent
    })
    return rows
  }, [query, order, providers, accept])

  const open = openId ? DATA.find((t) => t.id === openId) : null

  return (
    <section className="band" id="mock-commons">
      <h2 className="label">commons</h2>
      <div className="sub">a browsable shelf of redacted transcripts, filtered and sorted in place</div>
      <p className="prose">
        the commons is where shared sessions live. order, provider and acceptance compose with a live title
        search, the result count reads tabular, and an empty shelf says what to broaden. open any card to preview
        the run before reaching for the full reading view.
      </p>

      <div className="specimen">
        <div className="specimen-bar">
          <span className="specimen-cap">example</span>
        </div>
        <div className="specimen-body">
          {open ? (
            /* ---- preview state ---- the hook for the full transcript viewer. */
            <div className="window framed mock-preview">
              <div className="win-head">
                <div className="crumb">
                  commons <span className="cur">{open.author}</span>
                </div>
                <div className="mock-preview-top">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenId(null)}>
                    <ArrowLeft size={14} aria-hidden="true" /> back to commons
                  </button>
                </div>
                <div className="win-title">{open.title}</div>
                <div className="win-meta">
                  <span className="metaitem">
                    <ProviderMark id={open.provider} /> {open.provider}
                  </span>
                  <span className="metaitem">
                    <Clock size={14} aria-hidden="true" /> <b className="tnum">{fmtDur(open.durMin)}</b>
                  </span>
                  <span className="metaitem">
                    <GitBranch size={14} aria-hidden="true" /> <b className="tnum">{open.turns}</b> turns
                  </span>
                  <span className="metaitem">
                    <Hash size={14} aria-hidden="true" /> <b className="tnum">{fmtTokens(open.tokens)}</b> tokens
                  </span>
                  {open.state === 'verified' ? (
                    <span className="chip chip-ok">
                      <BadgeCheck size={14} aria-hidden="true" /> verified
                    </span>
                  ) : (
                    <span className="chip">
                      <CircleDot size={14} aria-hidden="true" /> open
                    </span>
                  )}
                </div>
              </div>
              <div className="mock-preview-body">
                <p className="desc">{open.summary}</p>
                {/* TODO: open the full transcript viewer (the conversation window in
                    section #conversation) seeded with this run's id. this inline
                    panel is the lightweight preview that precedes it. */}
                <div className="btn-row">
                  <button type="button" className="btn btn-primary btn-sm">
                    <FileText size={14} aria-hidden="true" /> read the transcript
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenId(null)}>
                    close preview
                  </button>
                </div>
                <div className="callout">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <div>
                    this preview reads the run meta only. the full viewer opens phases, tool calls and diffs, and
                    every shared transcript stays redacted.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ---- browse state ---- filter rail + search + result grid. */
            <div className="mock-commons-layout">
              <div className="sidebar mock-commons-rail" aria-label="filters">
                <div className="sb-sec">
                  <div className="sb-head">order</div>
                  {ORDER.map((o) => (
                    <FilterOpt key={o.id} on={order === o.id} onToggle={() => setOrder(o.id)}>
                      {o.label}
                    </FilterOpt>
                  ))}
                </div>
                <div className="sb-sec">
                  <div className="sb-head">provider</div>
                  {PROVIDERS.map((p) => (
                    <FilterOpt key={p.id} on={providers.has(p.id)} onToggle={() => toggleSet(setProviders, p.id)}>
                      <ProviderMark id={p.id} /> {p.label}
                    </FilterOpt>
                  ))}
                </div>
                <div className="sb-sec">
                  <div className="sb-head">acceptance</div>
                  {ACCEPT.map((a) => (
                    <FilterOpt key={a.id} on={accept.has(a.id)} onToggle={() => toggleSet(setAccept, a.id)}>
                      {a.id === 'verified' ? (
                        <>
                          <BadgeCheck size={14} aria-hidden="true" /> {a.label}
                        </>
                      ) : (
                        <>
                          <CircleDot size={14} aria-hidden="true" /> {a.label}
                        </>
                      )}
                    </FilterOpt>
                  ))}
                </div>
              </div>

              <div className="mock-results">
                <div className="mock-toolbar">
                  <div className="input-ico mock-search">
                    <Search size={16} aria-hidden="true" className="lucide" />
                    <input
                      ref={searchRef}
                      className="input"
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="search transcripts by title..."
                      aria-label="search transcripts by title"
                    />
                  </div>
                  <span className="mock-count tnum" role="status" aria-live="polite">
                    {visible.length} of {DATA.length}
                  </span>
                </div>

                {visible.length === 0 ? (
                  <div className="empty">
                    <div className="ring">
                      <Compass size={20} aria-hidden="true" />
                    </div>
                    <h3>the commons is quiet</h3>
                    <p>no transcripts match these filters yet. broaden the search or clear the filters to see the whole shelf.</p>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
                      clear filters
                    </button>
                  </div>
                ) : (
                  <div className="grid-cards mock-grid">
                    {visible.map((t) => (
                      <CommonsCard key={t.id} t={t} onOpen={setOpenId} theme={theme} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="callout">
        <ShieldCheck size={16} aria-hidden="true" />
        <div>
          order, provider and acceptance compose with the title search, all in a single memoized pass. the active
          set is carried by bold ink and an amber check, never color alone, and the result count reads tabular.
        </div>
      </div>
    </section>
  )
}

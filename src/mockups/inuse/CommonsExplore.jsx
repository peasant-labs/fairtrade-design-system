import { useMemo, useRef, useState, useEffect } from 'react'
import {
  Search,
  X,
  Check,
  Clock,
  GitBranch,
  Hash,
  Eye,
  EyeOff,
  Users,
  FileText,
  Compass,
  SearchX,
  ArrowLeft,
  ShieldCheck,
  Tag,
  Flag,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Link2,
  Download,
  Share2,
  Pencil,
  Trash2,
  Brain,
  Terminal,
  FilePen,
  FileDiff,
  FilePlus2,
  ListTree,
  GitFork,
  GitCommitHorizontal,
  CircleDot,
  CircleCheck,
  CircleSlash,
  RotateCcw,
  Star,
  AlertTriangle,
  User,
  Folder,
  FolderGit2,
  Layers,
  Upload,
} from 'lucide-react'
import { StatGrid, DangerZone, ConfirmInline, ApprovalBar } from '../../ui'

/* =====================================================================
   CommonsExplore — the COMMONS browse/discovery half of Village.
   three self-contained views, each owns its mock data + state and fills
   its container. reuses the design-system classes (card, row, chip, sidebar,
   sb, tabs, turn, toolcall, diff, empty, menu, tip, pgn families) and only
   adds namespaced cex- css. chrome stays lowercase; titles/code keep case.
===================================================================== */

/* ---- provider brand marks (symbols live in the document-global defs) ---- */
function ProviderMark({ id, size = 14 }) {
  if (id === 'codex') {
    return (
      <span className="g-codex" aria-hidden="true">
        <svg className="brand" width={size} height={size} viewBox="0 0 24 24">
          <path d="M12 1.5 2.5 6.75v10.5L12 22.5l9.5-5.25V6.75ZM12 4.2l6.9 3.8v7.9L12 19.8l-6.9-3.8V8Zm0 3.3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 2.4a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2Z" />
        </svg>
      </span>
    )
  }
  const cls = { 'claude-code': 'g-claude', 'gemini-cli': 'g-gemini', opencode: 'g-opencode' }[id]
  const sym = { 'claude-code': '#b-claude', 'gemini-cli': '#b-gemini', opencode: '#b-opencode' }[id]
  return (
    <span className={cls} aria-hidden="true">
      <svg className="brand" width={size} height={size} viewBox="0 0 24 24">
        <use href={sym} />
      </svg>
    </span>
  )
}

const PROVIDER_COLOR = {
  'claude-code': 'g-claude',
  'gemini-cli': 'g-gemini',
  opencode: 'g-opencode',
  codex: 'g-codex',
}

const fmtTokens = (n) => n.toLocaleString('en-US')
const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}min`)
const fmtDate = (iso) => {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const d = new Date(iso + 'T00:00:00')
  return `${M[d.getMonth()]} ${d.getDate()}`
}
const initials = (name) =>
  name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

/* a small visibility eye with a hover/focus tooltip naming the exact mode */
function VisibilityEye({ visibility, sharedWith }) {
  const [open, setOpen] = useState(false)
  const label =
    visibility === 'public'
      ? 'visible to everyone'
      : visibility === 'shared'
        ? `shared with: ${(sharedWith || []).join(', ')}`
        : 'only visible to you'
  const Icon = visibility === 'private' ? EyeOff : Eye
  return (
    <span
      className="cex-eye tip-anchor"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      role="img"
      aria-label={label}
    >
      <Icon size={14} aria-hidden="true" />
      {open && (
        <span className="tip-bubble" role="tooltip">
          {label}
        </span>
      )}
    </span>
  )
}

/* author cluster: avatar + handle, or the anon ? tile for non-discoverable owners */
function Author({ author }) {
  if (!author.discoverable) {
    return (
      <span className="cex-author">
        <span className="avatar" aria-hidden="true">
          ?
        </span>
        <span className="cex-handle cex-anon">anon</span>
      </span>
    )
  }
  return (
    <span className="cex-author">
      <span className="avatar" aria-hidden="true">
        {initials(author.name)}
      </span>
      <span className="cex-handle mono">@{author.handle}</span>
    </span>
  )
}

/* =====================================================================
   shared mock corpus for explore + profile
===================================================================== */
const AUTHORS = {
  'alice-dev': { handle: 'alice-dev', name: 'Alice Developer', discoverable: true },
  'bob-ai': { handle: 'bob-ai', name: 'Bob AI', discoverable: true },
  'charlie-ml': { handle: 'charlie-ml', name: 'Charlie ML', discoverable: true },
  anon: { handle: '', name: '', discoverable: false },
}

const TRANSCRIPTS = [
  {
    id: 'd41a8e',
    provider: 'claude-code',
    model: 'claude-opus-4-5-20251101',
    modelName: 'Claude Opus 4.5',
    project: 'go-rest-api',
    title: 'Building a REST API from scratch',
    desc: 'A complete greenfield session building a Go REST API.',
    tags: ['greenfield', 'claude-code'],
    collectives: ['AI Research Team', 'Verified Contributors'],
    author: 'alice-dev',
    durMin: 80,
    tools: 37,
    turns: 128,
    attest: 2,
    tokens: 412300,
    visibility: 'public',
    date: '2026-06-15',
  },
  {
    id: '7c2b90',
    provider: 'claude-code',
    model: 'claude-sonnet-4-5-20250930',
    modelName: 'Claude Sonnet 4.5',
    project: 'village',
    title: 'Debugging auth middleware with Claude Code',
    desc: 'Tracing a 401 through the JWT middleware and fixing the clock-skew check.',
    tags: ['debugging', 'claude-code'],
    collectives: ['AI Research Team'],
    author: 'alice-dev',
    durMin: 45,
    tools: 19,
    turns: 64,
    attest: 1,
    tokens: 138400,
    visibility: 'shared',
    sharedWith: ['AI Research Team'],
    date: '2026-06-14',
  },
  {
    id: 'b9f33c',
    provider: 'gemini-cli',
    model: 'gemini-2.5-pro',
    modelName: 'Gemini 2.5 Pro',
    project: 'api-server',
    title: 'Refactoring database queries with Gemini',
    desc: 'Killed the N+1 hot path and added a covering index; p95 dropped 4x.',
    tags: ['refactoring', 'gemini-cli'],
    collectives: ['Verified Contributors'],
    author: 'charlie-ml',
    durMin: 96,
    tools: 28,
    turns: 91,
    attest: 1,
    tokens: 221700,
    visibility: 'public',
    date: '2026-06-13',
  },
  {
    id: 'e2107a',
    provider: 'opencode',
    model: 'opencode-default',
    modelName: 'OpenCode',
    project: 'frontend-app',
    title: 'Greenfield React app setup',
    desc: 'Scaffolding a Vite + React app with routing, tokens and a CI gate.',
    tags: ['greenfield', 'iterative-refinement'],
    collectives: ['Curated Showcase'],
    author: 'bob-ai',
    durMin: 38,
    tools: 14,
    turns: 47,
    attest: 1,
    tokens: 96200,
    visibility: 'public',
    date: '2026-06-12',
  },
  {
    id: 'a5d8c1',
    provider: 'claude-code',
    model: 'claude-opus-4-5-20251101',
    modelName: 'Claude Opus 4.5',
    project: 'platform',
    title: 'Multi-agent debugging session',
    desc: 'Using multiple agents to diagnose a production issue.',
    tags: ['multi-agent', 'debugging'],
    collectives: ['AI Research Team', 'Curated Showcase'],
    author: 'charlie-ml',
    durMin: 211,
    tools: 64,
    turns: 203,
    attest: 1,
    tokens: 688900,
    visibility: 'public',
    date: '2026-06-11',
  },
  {
    id: 'f0b412',
    provider: 'codex',
    model: 'codex-mini',
    modelName: 'Codex',
    project: 'scratch',
    title: 'Untitled transcript',
    desc: 'A short exploratory session with no description set.',
    tags: ['iterative-refinement'],
    collectives: [],
    author: 'anon',
    durMin: 12,
    tools: 5,
    turns: 18,
    attest: 0,
    tokens: 21400,
    visibility: 'private',
    date: '2026-06-10',
  },
  {
    id: 'c83e07',
    provider: 'gemini-cli',
    model: 'gemini-2.5-pro',
    modelName: 'Gemini 2.5 Pro',
    project: 'api-server',
    title: 'Optimizing N+1 query issues using Gemini CLI',
    desc: 'Batched the loader and benchmarked against the production dataset.',
    tags: ['refactoring', 'gemini-cli'],
    collectives: ['Verified Contributors'],
    author: 'bob-ai',
    durMin: 73,
    tools: 22,
    turns: 78,
    attest: 1,
    tokens: 184500,
    visibility: 'shared',
    sharedWith: ['Verified Contributors'],
    date: '2026-06-09',
  },
  {
    id: '9a14d2',
    provider: 'claude-code',
    model: 'claude-sonnet-4-5-20250930',
    modelName: 'Claude Sonnet 4.5',
    project: 'village',
    title: 'Wire the share-dialog focus return',
    desc: 'The contribute dialog now traps tab and returns focus to its trigger.',
    tags: ['debugging', 'iterative-refinement'],
    collectives: ['AI Research Team'],
    author: 'alice-dev',
    durMin: 41,
    tools: 11,
    turns: 52,
    attest: 0,
    tokens: 74800,
    visibility: 'public',
    date: '2026-06-08',
  },
]

const COLLECTIVES = [
  {
    id: 'ai-research-team',
    name: 'AI Research Team',
    desc: 'Sharing transcripts related to AI research',
    members: 12,
    transcripts: 48,
    org: 'anthropic-labs',
  },
  {
    id: 'verified-contributors',
    name: 'Verified Contributors',
    desc: 'Only verified org members can share here',
    members: 31,
    transcripts: 126,
    org: 'data-collective',
  },
  {
    id: 'curated-showcase',
    name: 'Curated Showcase',
    desc: 'Owner-approved transcripts only',
    members: 8,
    transcripts: 19,
    org: 'openai-research',
  },
]

const ORDER = [
  { id: 'recent', label: 'most recent' },
  { id: 'turns', label: 'most turns' },
  { id: 'tokens', label: 'most tokens' },
]
const PROVIDERS = [
  { id: 'all', label: 'all providers' },
  { id: 'claude-code', label: 'claude' },
  { id: 'gemini-cli', label: 'gemini' },
  { id: 'opencode', label: 'opencode' },
]
const TOPICS = [
  { id: 'claude-code', count: 41 },
  { id: 'gemini-cli', count: 28 },
  { id: 'debugging', count: 33 },
  { id: 'greenfield', count: 17 },
  { id: 'multi-agent', count: 9 },
  { id: 'refactoring', count: 24 },
  { id: 'iterative-refinement', count: 14 },
]

const PAGE_SIZE = 4 /* small so pagination is visible on the mock corpus */

/* a single radio-like sidebar option (single-select group) */
function OptionRow({ on, onSelect, children }) {
  return (
    <div
      className={'sb-opt cex-opt' + (on ? ' on' : '')}
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <span>{children}</span>
      {on && <Check size={14} aria-hidden="true" />}
    </div>
  )
}

/* ---- a TranscriptCard (grid item) ---- */
function TranscriptCard({ t, onOpen }) {
  const author = AUTHORS[t.author]
  return (
    <button type="button" className="card cex-tcard" onClick={() => onOpen(t.id)}>
      <div className="card-head">
        <span className="metaitem cex-model">
          <ProviderMark id={t.provider} />
          <b className={PROVIDER_COLOR[t.provider]}>{t.modelName}</b>
          <span className="cex-proj mono">{t.project}</span>
        </span>
        <VisibilityEye visibility={t.visibility} sharedWith={t.sharedWith} />
      </div>
      <h3 className="cex-title">{t.title || 'Untitled transcript'}</h3>
      <p className="desc cex-desc">{t.desc}</p>
      <div className="cex-tags">
        {t.tags.map((tag) => (
          <span className="tag" key={tag}>
            #{tag}
          </span>
        ))}
      </div>
      {t.collectives.length > 0 && (
        <div className="cex-coll-line">
          <Layers size={13} aria-hidden="true" /> {t.collectives.slice(0, 3).join(' · ')}
        </div>
      )}
      <div className="card-foot cex-foot">
        <Author author={author} />
        <span className="metaitem">
          <Clock size={13} aria-hidden="true" /> <b className="tnum">{fmtDur(t.durMin)}</b>
        </span>
        <span className="metaitem">
          <ListTree size={13} aria-hidden="true" /> <b className="tnum">{t.tools}</b> tools
        </span>
        <span className="metaitem">
          <GitBranch size={13} aria-hidden="true" /> <b className="tnum">{t.turns}</b> turns
        </span>
        {t.attest > 0 && (
          <span className="metaitem cex-attest">
            <ShieldCheck size={13} aria-hidden="true" /> <b className="tnum">{t.attest}</b>
          </span>
        )}
        <span className="metaitem cex-date">{fmtDate(t.date)}</span>
      </div>
    </button>
  )
}

/* ---- a TranscriptRow (list item) ---- */
function TranscriptRow({ t, onOpen }) {
  const author = AUTHORS[t.author]
  return (
    <button type="button" className="row cex-trow" onClick={() => onOpen(t.id)}>
      <span className="cex-trow-model">
        <ProviderMark id={t.provider} />
        <b className={PROVIDER_COLOR[t.provider]}>{t.modelName}</b>
      </span>
      <span className="cex-trow-title">{t.title || 'Untitled transcript'}</span>
      <span className="cex-trow-stats">
        <span className="metaitem">
          <Clock size={13} aria-hidden="true" /> <b className="tnum">{fmtDur(t.durMin)}</b>
        </span>
        <span className="metaitem">
          <GitBranch size={13} aria-hidden="true" /> <b className="tnum">{t.turns}</b>
        </span>
        <span className="metaitem">
          <ListTree size={13} aria-hidden="true" /> <b className="tnum">{t.tools}</b>
        </span>
      </span>
      <span className="cex-trow-date mono tnum">{fmtDate(t.date)}</span>
      <Author author={author} />
      <VisibilityEye visibility={t.visibility} sharedWith={t.sharedWith} />
    </button>
  )
}

/* ---- a CollectiveCard (search results strip) ---- */
function CollectiveCard({ c }) {
  return (
    <button type="button" className="card cex-ccard">
      <div className="card-head">
        <span className="metaitem cex-cname">
          <Users size={14} aria-hidden="true" /> <b>{c.name}</b>
        </span>
        <span className="tag cex-org">@{c.org}</span>
      </div>
      <p className="desc cex-desc">{c.desc}</p>
      <div className="cex-cfoot mono tnum">
        {c.members} members · {c.transcripts} transcripts
      </div>
    </button>
  )
}

/* =====================================================================
   EXPLORE VIEW — the discovery feed.
===================================================================== */
export function ExploreView({ theme } = {}) {
  void theme
  const [rawQuery, setRawQuery] = useState('')
  const [query, setQuery] = useState('') // debounced
  const [order, setOrder] = useState('recent')
  const [provider, setProvider] = useState('all')
  const [topics, setTopics] = useState(() => new Set())
  const [layout, setLayout] = useState('grid') // 'grid' | 'list'
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)
  const firstRun = useRef(true)

  /* debounced live search (250ms); first run skips the delay */
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      setQuery(rawQuery)
      return
    }
    const id = setTimeout(() => setQuery(rawQuery), 250)
    return () => clearTimeout(id)
  }, [rawQuery])

  /* page resets to 1 on any search/filter/sort change */
  useEffect(() => {
    setPage(1)
  }, [query, order, provider, topics])

  function toggleTopic(id) {
    setTopics((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = TRANSCRIPTS.filter((t) => {
      if (provider !== 'all' && t.provider !== provider) return false
      if (topics.size && !t.tags.some((tag) => topics.has(tag))) return false
      if (q) {
        const hay = `${t.title} ${t.desc} ${t.modelName} ${t.project} ${t.tags.join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    rows = rows.slice().sort((a, b) => {
      if (order === 'turns') return b.turns - a.turns
      if (order === 'tokens') return b.tokens - a.tokens
      return b.date.localeCompare(a.date)
    })
    return rows
  }, [query, order, provider, topics])

  const collectiveHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return COLLECTIVES.filter((c) => `${c.name} ${c.desc} ${c.org}`.toLowerCase().includes(q))
  }, [query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const opened = openId ? TRANSCRIPTS.find((t) => t.id === openId) : null
  if (opened) {
    return (
      <div className="cex-root">
        <div className="cex-detail-back">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenId(null)}>
            <ArrowLeft size={14} aria-hidden="true" /> back to explore
          </button>
        </div>
        <TranscriptDetailView seedId={openId} embedded />
      </div>
    )
  }

  function reset() {
    setRawQuery('')
    setQuery('')
    setOrder('recent')
    setProvider('all')
    setTopics(new Set())
  }

  return (
    <div className="cex-root">
      <header className="cex-explore-head">
        <h2 className="cex-h2">explore transcripts</h2>
        <p className="cex-deck">search redacted ai agent transcripts shared by the community.</p>
        <div className="input-ico cex-searchbar">
          <Search size={16} aria-hidden="true" className="lucide" />
          <input
            className="input"
            type="text"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="search transcripts, collectives, projects, models..."
            aria-label="search transcripts, collectives, projects, models"
          />
          {rawQuery && (
            <button
              type="button"
              className="cex-clear"
              aria-label="clear search"
              onClick={() => {
                setRawQuery('')
                setQuery('')
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div className="cex-explore-body">
        {/* LEFT FILTER RAIL */}
        <aside className="sidebar cex-rail" aria-label="filters">
          <div className="sb-sec" role="radiogroup" aria-label="order">
            <div className="sb-head">order</div>
            {ORDER.map((o) => (
              <OptionRow key={o.id} on={order === o.id} onSelect={() => setOrder(o.id)}>
                {o.label}
              </OptionRow>
            ))}
          </div>
          <div className="sb-sec" role="radiogroup" aria-label="provider">
            <div className="sb-head">provider</div>
            {PROVIDERS.map((p) => (
              <OptionRow key={p.id} on={provider === p.id} onSelect={() => setProvider(p.id)}>
                {p.id !== 'all' && <ProviderMark id={p.id} />} {p.label}
              </OptionRow>
            ))}
          </div>
          <div className="sb-sec">
            <div className="sb-head">topics</div>
            <div className="cex-topics">
              {TOPICS.map((tp) => {
                const on = topics.has(tp.id)
                return (
                  <button
                    key={tp.id}
                    type="button"
                    className="chip chip-toggle cex-topic"
                    aria-pressed={on}
                    onClick={() => toggleTopic(tp.id)}
                  >
                    <Check size={13} aria-hidden="true" className="chipx-tick" />
                    <span className="cex-topic-label" title={`#${tp.id}`}>#{tp.id}</span>
                    <span className="cex-topic-n tnum">{tp.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        {/* RESULTS */}
        <div className="cex-results">
          {/* COLLECTIVES strip (only when a query is present) */}
          {collectiveHits && (
            <section className="cex-coll-results" aria-label="matching collectives">
              <div className="cex-results-head">
                <span className="cex-eyebrow">
                  collectives <span className="cex-count tnum">{collectiveHits.length}</span>
                </span>
              </div>
              {collectiveHits.length === 0 ? (
                <p className="cex-nomatch-inline mono">no matching collectives.</p>
              ) : (
                <div className="cex-coll-grid">
                  {collectiveHits.map((c) => (
                    <CollectiveCard key={c.id} c={c} />
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="cex-results-head">
            <span className="cex-eyebrow">
              transcripts <span className="cex-count tnum" role="status" aria-live="polite">{filtered.length}</span>
            </span>
            <div className="bs-seg cex-viewseg" role="group" aria-label="view mode">
              <button
                type="button"
                className="bs-seg-opt"
                aria-pressed={layout === 'grid'}
                aria-label="grid view"
                onClick={() => setLayout('grid')}
              >
                <LayoutGridIcon /> grid
              </button>
              <button
                type="button"
                className="bs-seg-opt"
                aria-pressed={layout === 'list'}
                aria-label="list view"
                onClick={() => setLayout('list')}
              >
                <ListIcon /> list
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            query.trim() || provider !== 'all' || topics.size ? (
              <div className="empty cex-empty">
                <div className="ring">
                  <SearchX size={20} aria-hidden="true" />
                </div>
                <h3>no matches</h3>
                <p>no transcripts match your search and filters. broaden the query or clear the filters.</p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
                  clear filters
                </button>
              </div>
            ) : (
              <div className="empty cex-empty">
                <div className="ring">
                  <Compass size={20} aria-hidden="true" />
                </div>
                <h3>the commons is empty</h3>
                <p>no transcripts have been shared yet. once contributors publish, they show up here.</p>
              </div>
            )
          ) : layout === 'grid' ? (
            <div className="cex-grid">
              {pageRows.map((t) => (
                <TranscriptCard key={t.id} t={t} onOpen={setOpenId} />
              ))}
            </div>
          ) : (
            <div className="cex-list">
              {pageRows.map((t) => (
                <TranscriptRow key={t.id} t={t} onOpen={setOpenId} />
              ))}
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <nav className="pgn cex-pgn" aria-label="pagination">
              <button
                type="button"
                className="pgn-btn pgn-edge"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ArrowLeft size={14} aria-hidden="true" /> <span>prev</span>
              </button>
              <ul className="pgn-list">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <li key={n}>
                    <button
                      type="button"
                      className="pgn-btn pgn-num"
                      aria-current={page === n ? 'page' : undefined}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="pgn-btn pgn-edge"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <span>next</span> <ChevronRight size={14} aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  )
}

/* small inline glyphs for the grid/list toggle (lucide LayoutGrid / List) */
function LayoutGridIcon() {
  return (
    <svg className="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}
function ListIcon() {
  return (
    <svg className="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

/* =====================================================================
   TRANSCRIPT DETAIL VIEW — the commons embed of a shared transcript.
   a compact viewer (hero + chips + tab strip + a few turns) plus commons
   chrome: ActionMenu, per-turn TurnLabelPopover, PendingApprovalBar.
===================================================================== */

const DETAIL_META = {
  d41a8e: {
    provider: 'claude-code',
    modelName: 'Claude Opus 4.5',
    model: 'claude-opus-4-5',
    title: 'Building a REST API from scratch',
    desc: 'A complete greenfield session building a Go REST API.',
    project: 'go-rest-api',
    author: 'alice-dev',
    branch: 'main',
    cwd: '~/Projects/go-rest-api',
    startCommit: 'e1f0a9',
    tokens: 412300,
    tokensIn: 301200,
    tokensOut: 111100,
    turns: 128,
    tools: 37,
    durMin: 80,
    outcome: 'Resolved',
    visibility: 'public',
  },
}

const OUTLINE = [
  { n: 1, label: 'project goal + constraints', role: 'user' },
  { n: 2, label: 'plan the package layout', role: 'asst' },
  { n: 3, label: 'scaffold module + router', role: 'asst' },
  { n: 5, label: 'add the handler test', role: 'asst' },
  { n: 7, label: 'failing test: 500 on POST', role: 'user' },
  { n: 8, label: 'fix the json decode path', role: 'asst' },
]

const DETAIL_TURNS = [
  {
    n: 1,
    role: 'user',
    body: 'Build me a small REST API in Go for a todo service. Keep the package layout idiomatic and write a test for the create handler.',
  },
  {
    n: 2,
    role: 'asst',
    body: "I'll lay out cmd/, internal/api and internal/store, wire a chi router, then add a table-driven test for the create handler.",
    thinking: 'thought for 5s, planning the package layout',
    tools: [
      {
        id: 'd2a',
        kind: 'write',
        icon: 'write',
        path: 'internal/api/router.go',
        right: '+34',
        body: {
          type: 'lines',
          text: 'func NewRouter(s *store.Store) http.Handler {\n  r := chi.NewRouter()\n  r.Post("/todos", createTodo(s))\n  r.Get("/todos", listTodos(s))\n  return r\n}',
        },
      },
    ],
  },
  {
    n: 3,
    role: 'sub',
    subAgent: 'Explore',
    subTitle: 'find existing store interface',
    body: 'Searched internal/store for an existing interface. Found Store with Create/List; the handler can depend on it directly.',
    tools: [
      {
        id: 'd3a',
        kind: 'grep',
        icon: 'grep',
        path: 'type Store in internal/store',
        right: '1 match',
        body: { type: 'lines', text: 'internal/store/store.go:14  type Store struct { db *sql.DB }' },
      },
    ],
  },
  {
    n: 5,
    role: 'asst',
    body: 'Added the create-handler test as a table of cases, including the empty-title rejection.',
    tools: [
      {
        id: 'd5a',
        kind: 'read',
        icon: 'read',
        path: 'internal/api/handlers_test.go',
        right: '120 lines',
        body: {
          type: 'lines',
          text: 'func TestCreateTodo(t *testing.T) {\n  cases := []struct{ name, body string; want int }{\n    {"ok", `{"title":"buy milk"}`, 201},\n    {"empty", `{"title":""}`, 400},\n  }\n}',
        },
      },
      {
        id: 'd5b',
        kind: 'bash',
        icon: 'bash',
        path: 'go test ./internal/api/',
        right: 'FAIL',
        ok: false,
        body: { type: 'lines', text: '--- FAIL: TestCreateTodo/ok (0.00s)\n    handlers_test.go:41: got 500, want 201' },
      },
    ],
    commit: null,
  },
  {
    n: 8,
    role: 'asst',
    body: 'The decoder returned io.EOF on an empty body path. Guarding the decode and returning 400 fixes the create flow.',
    thinking: 'thought for 3s, tracing the 500',
    tools: [
      {
        id: 'd8a',
        kind: 'edit',
        icon: 'edit',
        path: 'internal/api/handlers.go',
        right: '+3 -1',
        body: {
          type: 'diff',
          hunk: [
            { sign: 'ctx', gut: '52', t: 'func createTodo(s *store.Store) http.HandlerFunc {' },
            { sign: 'del', gut: '53', t: '  json.NewDecoder(r.Body).Decode(&in)' },
            { sign: 'add', gut: '53', t: '  if err := json.NewDecoder(r.Body).Decode(&in); err != nil {' },
            { sign: 'add', gut: '54', t: '    http.Error(w, "bad json", 400); return' },
            { sign: 'add', gut: '55', t: '  }' },
          ],
        },
      },
      {
        id: 'd8b',
        kind: 'bash',
        icon: 'bash',
        path: 'go test ./...',
        right: 'ok',
        ok: true,
        body: { type: 'lines', text: 'ok  \tinternal/api\t0.214s\nok  \tinternal/store\t0.088s' },
      },
    ],
    commit: { hash: 'a3f9c1', msg: 'guard json decode, return 400', files: 1, ins: 3, del: 1 },
  },
]

const TOOL_ICON = { read: FileText, grep: Search, edit: FilePen, bash: Terminal, write: FilePlus2, task: GitFork }

const LABEL_TYPES = [
  { id: 'turn_outcome', label: 'outcome', values: [
    { id: 'good', label: 'good', tone: 'ok' },
    { id: 'neutral', label: 'neutral', tone: '' },
    { id: 'bad', label: 'bad', tone: 'err' },
  ] },
  { id: 'turn_flag', label: 'flag', values: [
    { id: 'error', label: 'error', tone: 'err' },
    { id: 'retry', label: 'retry loop', tone: 'warn' },
    { id: 'revert', label: 'revert', tone: 'warn' },
    { id: 'highlight', label: 'highlight', tone: 'ok' },
  ] },
]

const LABEL_ICON = { good: CircleCheck, neutral: CircleDot, bad: CircleSlash, error: AlertTriangle, retry: RotateCcw, revert: RotateCcw, highlight: Star }

/* a per-turn label popover: pick type -> value -> save -> chip appears on the turn */
function TurnLabelPopover({ onSave, onClose }) {
  const [type, setType] = useState('turn_outcome')
  const [value, setValue] = useState('good')
  const [saving, setSaving] = useState(false)
  const typeDef = LABEL_TYPES.find((t) => t.id === type)

  function save() {
    setSaving(true)
    setTimeout(() => {
      const v = typeDef.values.find((x) => x.id === value)
      onSave({ type, typeLabel: typeDef.label, value, valueLabel: v.label, tone: v.tone })
      setSaving(false)
    }, 350)
  }

  return (
    <div className="pop-card cex-labelpop" role="dialog" aria-label="add a turn label">
      <div className="pop-head">
        <Tag size={14} aria-hidden="true" />
        <span className="pop-title">add label</span>
      </div>
      <div className="pop-body">
        <div className="field cex-popfield">
          <span className="label">label type</span>
          <div className="select-wrap">
            <select
              className="select"
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                setValue(LABEL_TYPES.find((t) => t.id === e.target.value).values[0].id)
              }}
            >
              {LABEL_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="lucide" aria-hidden="true" />
          </div>
        </div>
        <div className="field cex-popfield">
          <span className="label">value</span>
          <div className="select-wrap">
            <select className="select" value={value} onChange={(e) => setValue(e.target.value)}>
              {typeDef.values.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="lucide" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="pop-foot">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          cancel
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} aria-busy={saving}>
          {saving && <span className="bs-spin" aria-hidden="true" />} save
        </button>
      </div>
    </div>
  )
}

/* a saved-label chip rendered on the turn */
function SavedLabel({ label }) {
  const Icon = LABEL_ICON[label.value] || Tag
  const cls = label.tone === 'ok' ? 'chip-ok' : label.tone === 'err' ? 'chip-err' : label.tone === 'warn' ? 'chip-warn' : ''
  return (
    <span className={'chip chip-sm ' + cls}>
      <Icon size={13} aria-hidden="true" /> {label.valueLabel}
    </span>
  )
}

/* a tool call: header toggles, body reveals (lines or diff) */
function DetailToolCall({ tool, open, onToggle }) {
  const Icon = TOOL_ICON[tool.icon] || FileText
  return (
    <div className="toolcall">
      <button type="button" className="tc-head cex-tc-btn" aria-expanded={open} onClick={onToggle}>
        <span className="kind">
          <Icon size={14} aria-hidden="true" /> {tool.kind}
        </span>
        <span className="path">{tool.path}</span>
        <span className="right" style={tool.ok === false ? { color: 'var(--clay)' } : tool.ok ? { color: 'var(--olive)' } : undefined}>
          {tool.ok === true ? <Check size={14} aria-hidden="true" /> : tool.ok === false ? <X size={14} aria-hidden="true" /> : null}
          <span className="tnum">{tool.right}</span>
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </span>
      </button>
      {open && tool.body.type === 'lines' && <pre className="cex-tc-body">{tool.body.text}</pre>}
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

function ClaudeMark() {
  return (
    <svg className="brand" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <use href="#b-claude" />
    </svg>
  )
}

const DETAIL_TABS = [
  { id: 'list', label: 'list' },
  { id: 'highlights', label: 'highlights' },
  { id: 'diffs', label: 'diffs' },
  { id: 'files', label: 'files' },
  { id: 'annotations', label: 'annotations' },
  { id: 'graph', label: 'graph' },
]

const DETAIL_FILES = [
  { path: 'internal/api/router.go', change: '+34' },
  { path: 'internal/api/handlers.go', change: '+3 -1' },
  { path: 'internal/api/handlers_test.go', change: 'read' },
]

export function TranscriptDetailView({ theme, seedId = 'd41a8e', embedded = false }) {
  const meta = DETAIL_META[seedId] || DETAIL_META.d41a8e
  const [tab, setTab] = useState('list')
  const [openTools, setOpenTools] = useState({ d8a: true, d5b: true })
  const [selected, setSelected] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [visibility, setVisibility] = useState(meta.visibility)
  const [labelTurn, setLabelTurn] = useState(null) // turn n with open popover
  const [labels, setLabels] = useState({}) // { turnN: [label, ...] }
  const [pending, setPending] = useState([
    { collective: 'Curated Showcase', status: 'pending' },
  ])
  const [toast, setToast] = useState(null)
  const tabRefs = useRef({})
  const streamRef = useRef(null)
  const turnRefs = useRef({})
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(id)
  }, [toast])

  function toggleTool(id) {
    setOpenTools((o) => ({ ...o, [id]: !o[id] }))
  }

  function selectTurn(n) {
    setSelected(n)
    const el = turnRefs.current[n]
    const scroller = streamRef.current
    if (el && scroller) {
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      scroller.scrollTo({ top: el.offsetTop - 8, behavior: reduce ? 'auto' : 'smooth' })
    }
  }

  function onTabKey(e) {
    const i = DETAIL_TABS.findIndex((t) => t.id === tab)
    let j = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % DETAIL_TABS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + DETAIL_TABS.length) % DETAIL_TABS.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = DETAIL_TABS.length - 1
    else return
    e.preventDefault()
    const next = DETAIL_TABS[j].id
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  function saveLabel(turnN, label) {
    setLabels((prev) => ({ ...prev, [turnN]: [...(prev[turnN] || []), label] }))
    setLabelTurn(null)
  }

  function resolvePending(idx, status) {
    setPending((prev) => prev.map((p, i) => (i === idx ? { ...p, status } : p)))
  }

  function menuAction(action) {
    setMenuOpen(false)
    if (action === 'copy') setToast('link copied to clipboard.')
    else if (action === 'contribute') setToast('contributed to AI Research Team.')
    else if (action.startsWith('download')) setToast(`download started (${action.split(':')[1]}).`)
    else if (action === 'visibility') {
      const next = visibility === 'public' ? 'private' : 'public'
      setVisibility(next)
      setToast(`visibility set to ${next}.`)
    }
  }

  const annotatedCount = Object.values(labels).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className={'cex-root cex-detail' + (embedded ? ' cex-detail-embedded' : '')}>
      {/* PENDING APPROVAL BAR (owner of a collective the transcript is pending in).
          one kit ApprovalBar per pending entry — each owns its own resolved state. */}
      {pending.length > 0 && (
        <div className="cex-pending" role="region" aria-label="pending shares">
          {pending.map((p, i) => (
            <ApprovalBar
              key={p.collective}
              subject={<>pending review in <b>{p.collective}</b></>}
              onApprove={() => resolvePending(i, 'approved')}
              onReject={() => resolvePending(i, 'rejected')}
            />
          ))}
        </div>
      )}

      <div className="window cex-viewer">
        {/* HERO + STICKY HEADER */}
        <div className="win-head cex-viewer-head">
          <div className="cex-head-top">
            <div className="crumb">
              dashboard <ChevronRight size={13} aria-hidden="true" /> projects <ChevronRight size={13} aria-hidden="true" /> {meta.project}{' '}
              <ChevronRight size={13} aria-hidden="true" /> <span className="cur mono">{seedId}</span>
            </div>
            {/* ACTION MENU */}
            <div className="menu-anchor cex-actions" ref={menuRef}>
              <button
                type="button"
                className="btn btn-secondary btn-sm menu-trigger"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <MoreHorizontal size={14} aria-hidden="true" /> actions
                <ChevronDown size={13} aria-hidden="true" className="menu-caret" />
              </button>
              {menuOpen && (
                <div className="menu-pop menu-float" role="menu" aria-label="transcript actions">
                  <ul className="menu-list">
                    <li>
                      <button type="button" role="menuitem" className="menu-item" onClick={() => menuAction('copy')}>
                        <Link2 size={14} aria-hidden="true" /> <span className="menu-text">copy link</span>
                      </button>
                    </li>
                    <li>
                      <button type="button" role="menuitem" className="menu-item" onClick={() => menuAction('contribute')}>
                        <Share2 size={14} aria-hidden="true" /> <span className="menu-text">contribute to a collective</span>
                      </button>
                    </li>
                    <hr className="menu-sep" />
                    <li className="menu-cap">download</li>
                    <li>
                      <button type="button" role="menuitem" className="menu-item" onClick={() => menuAction('download:JSON')}>
                        <Download size={14} aria-hidden="true" /> <span className="menu-text">json</span>
                      </button>
                    </li>
                    <li>
                      <button type="button" role="menuitem" className="menu-item" onClick={() => menuAction('download:JSONL')}>
                        <Download size={14} aria-hidden="true" /> <span className="menu-text">jsonl</span>
                      </button>
                    </li>
                    <li>
                      <button type="button" role="menuitem" className="menu-item" onClick={() => menuAction('download:Markdown')}>
                        <Download size={14} aria-hidden="true" /> <span className="menu-text">markdown</span>
                      </button>
                    </li>
                    <hr className="menu-sep" />
                    <li>
                      <button type="button" role="menuitem" className="menu-item" onClick={() => menuAction('edit')}>
                        <Pencil size={14} aria-hidden="true" /> <span className="menu-text">edit</span>
                      </button>
                    </li>
                    <li>
                      <button type="button" role="menuitem" className="menu-item" onClick={() => menuAction('visibility')}>
                        {visibility === 'public' ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                        <span className="menu-text">make {visibility === 'public' ? 'private' : 'public'}</span>
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="cex-hero-title">
            <h2 className="win-title cex-vtitle">{meta.title}</h2>
            <VisibilityEye visibility={visibility} sharedWith={['Curated Showcase']} />
          </div>
          <p className="cex-vdesc">{meta.desc}</p>

          {/* METADATA CHIPS */}
          <div className="win-meta cex-vmeta">
            <span className="metaitem">
              <ProviderMark id={meta.provider} /> <span className={PROVIDER_COLOR[meta.provider]}>{meta.modelName}</span>
            </span>
            <span className="metaitem">
              <Hash size={14} aria-hidden="true" /> <b className="tnum">{fmtTokens(meta.tokens)}</b> tokens
            </span>
            <span className="metaitem cex-meta-faint">
              <span className="tnum">{fmtTokens(meta.tokensIn)} in</span> · <span className="tnum">{fmtTokens(meta.tokensOut)} out</span>
            </span>
            <span className="metaitem">
              <GitBranch size={14} aria-hidden="true" /> <b className="tnum">{meta.turns}</b> turns
            </span>
            <span className="metaitem">
              <ListTree size={14} aria-hidden="true" /> <b className="tnum">{meta.tools}</b> tools
            </span>
            <span className="metaitem">
              <Clock size={14} aria-hidden="true" /> <b className="tnum">{fmtDur(meta.durMin)}</b>
            </span>
            <span className="metaitem mono">
              <Folder size={14} aria-hidden="true" /> {meta.cwd}
            </span>
            <span className="metaitem mono">
              <GitBranch size={14} aria-hidden="true" /> {meta.branch}
            </span>
            <span className="metaitem mono">
              <GitCommitHorizontal size={14} aria-hidden="true" /> {meta.startCommit}
            </span>
            <span className="chip chip-ok">
              <Check size={14} aria-hidden="true" /> {meta.outcome}
            </span>
          </div>

          {/* TAB STRIP */}
          <div className="tabs cex-vtabs" role="tablist" aria-label="transcript views" onKeyDown={onTabKey}>
            {DETAIL_TABS.map((t) => {
              const on = tab === t.id
              const count =
                t.id === 'list' ? meta.turns : t.id === 'diffs' ? 1 : t.id === 'files' ? DETAIL_FILES.length : t.id === 'highlights' ? OUTLINE.length : t.id === 'annotations' ? annotatedCount : null
              return (
                <button
                  key={t.id}
                  ref={(el) => (tabRefs.current[t.id] = el)}
                  type="button"
                  role="tab"
                  id={'cex-tab-' + t.id}
                  aria-controls="cex-tabpanel"
                  aria-selected={on}
                  tabIndex={on ? 0 : -1}
                  className={'tab' + (on ? ' active' : '')}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {count != null && <span className="cnt tnum">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* BODY: stream + right rail */}
        <div className="cex-viewer-body">
          <div className="cex-stream" id="cex-tabpanel" role="tabpanel" aria-labelledby={'cex-tab-' + tab} ref={streamRef} tabIndex={-1}>
            {tab === 'list' && (
              <>
                {/* PHASE DIVIDER */}
                <div className="phase">
                  <span className="lbl">
                    <Flag size={14} aria-hidden="true" /> phase: planning <span className="cex-microphase">1 exploration</span>
                  </span>
                  <span className="rng tnum">turns 1-3</span>
                </div>
                {DETAIL_TURNS.slice(0, 2).map((t) => (
                  <DetailTurn
                    key={t.n}
                    turn={t}
                    selected={selected === t.n}
                    openTools={openTools}
                    toggleTool={toggleTool}
                    registerRef={(n, el) => el && (turnRefs.current[n] = el)}
                    labels={labels[t.n] || []}
                    labelOpen={labelTurn === t.n}
                    onLabelToggle={() => setLabelTurn((x) => (x === t.n ? null : t.n))}
                    onLabelSave={(l) => saveLabel(t.n, l)}
                    onLabelClose={() => setLabelTurn(null)}
                  />
                ))}
                {DETAIL_TURNS.slice(2, 3).map((t) => (
                  <DetailTurn
                    key={t.n}
                    turn={t}
                    selected={selected === t.n}
                    openTools={openTools}
                    toggleTool={toggleTool}
                    registerRef={(n, el) => el && (turnRefs.current[n] = el)}
                    labels={labels[t.n] || []}
                    labelOpen={labelTurn === t.n}
                    onLabelToggle={() => setLabelTurn((x) => (x === t.n ? null : t.n))}
                    onLabelSave={(l) => saveLabel(t.n, l)}
                    onLabelClose={() => setLabelTurn(null)}
                  />
                ))}
                <div className="phase">
                  <span className="lbl">
                    <Flag size={14} aria-hidden="true" /> phase: implementation
                  </span>
                  <span className="rng tnum">turns 4-6</span>
                </div>
                {DETAIL_TURNS.slice(3, 4).map((t) => (
                  <DetailTurn
                    key={t.n}
                    turn={t}
                    selected={selected === t.n}
                    openTools={openTools}
                    toggleTool={toggleTool}
                    registerRef={(n, el) => el && (turnRefs.current[n] = el)}
                    labels={labels[t.n] || []}
                    labelOpen={labelTurn === t.n}
                    onLabelToggle={() => setLabelTurn((x) => (x === t.n ? null : t.n))}
                    onLabelSave={(l) => saveLabel(t.n, l)}
                    onLabelClose={() => setLabelTurn(null)}
                  />
                ))}
                <div className="phase">
                  <span className="lbl">
                    <Flag size={14} aria-hidden="true" /> phase: debug <span className="cex-microphase">1 retry-loop</span>
                  </span>
                  <span className="rng tnum">turns 7-8</span>
                </div>
                {DETAIL_TURNS.slice(4).map((t) => (
                  <DetailTurn
                    key={t.n}
                    turn={t}
                    selected={selected === t.n}
                    openTools={openTools}
                    toggleTool={toggleTool}
                    registerRef={(n, el) => el && (turnRefs.current[n] = el)}
                    labels={labels[t.n] || []}
                    labelOpen={labelTurn === t.n}
                    onLabelToggle={() => setLabelTurn((x) => (x === t.n ? null : t.n))}
                    onLabelSave={(l) => saveLabel(t.n, l)}
                    onLabelClose={() => setLabelTurn(null)}
                  />
                ))}
              </>
            )}

            {tab === 'highlights' && (
              <ul className="cex-curated" aria-label="highlights">
                {OUTLINE.map((o) => (
                  <li key={o.n}>
                    <button type="button" className="cex-curated-row" onClick={() => { setTab('list'); setTimeout(() => selectTurn(o.n), 0) }}>
                      <Star size={14} aria-hidden="true" className="cex-star" />
                      <span className="cex-curated-label">{o.label}</span>
                      <span className="cex-curated-n tnum">turn {o.n}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {tab === 'diffs' && (
              <div className="cex-curated-block">
                <div className="cex-diff-anchor mono">internal/api/handlers.go · turn 8 · +3 -1</div>
                <div className="toolcall">
                  <div className="diff">
                    {DETAIL_TURNS.find((t) => t.n === 8).tools.find((x) => x.body.type === 'diff').body.hunk.map((d, i) => (
                      <div className={'dl ' + d.sign} key={i}>
                        <span className="rail" />
                        <span className="gut tnum">{d.gut}</span>
                        <span className="sign">{d.sign === 'add' ? '+' : d.sign === 'del' ? '−' : ''}</span>
                        <span className="t">{d.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'files' && (
              <ul className="cex-curated" aria-label="touched files">
                {DETAIL_FILES.map((f) => (
                  <li key={f.path}>
                    <div className="cex-curated-row cex-file-row">
                      <FileDiff size={14} aria-hidden="true" />
                      <span className="cex-curated-label mono">{f.path}</span>
                      <span className="cex-curated-n tnum">{f.change}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {tab === 'annotations' && (
              annotatedCount === 0 ? (
                <div className="empty cex-empty">
                  <div className="ring">
                    <Tag size={20} aria-hidden="true" />
                  </div>
                  <h3>no annotations yet</h3>
                  <p>open the tag control on any turn (in the list view) to label its outcome or flag it.</p>
                </div>
              ) : (
                <ul className="cex-curated" aria-label="annotations">
                  {Object.entries(labels).flatMap(([n, arr]) =>
                    arr.map((l, i) => (
                      <li key={n + '-' + i}>
                        <button type="button" className="cex-curated-row" onClick={() => { setTab('list'); setTimeout(() => selectTurn(Number(n)), 0) }}>
                          <SavedLabel label={l} />
                          <span className="cex-curated-label">{l.typeLabel}</span>
                          <span className="cex-curated-n tnum">turn {n}</span>
                        </button>
                      </li>
                    )),
                  )}
                </ul>
              )
            )}

            {tab === 'graph' && <TrajectoryGraph onPick={(n) => { setTab('list'); setTimeout(() => selectTurn(n), 0) }} />}
          </div>

          {/* RIGHT RAIL: outline + filters */}
          <aside className="cex-rrail" aria-label="outline and filters">
            <div className="sb-sec">
              <div className="sb-head">outline</div>
              <ul className="cex-outline">
                {OUTLINE.map((o) => (
                  <li key={o.n}>
                    <button
                      type="button"
                      className={'cex-outline-row' + (selected === o.n ? ' cex-on' : '')}
                      aria-current={selected === o.n ? 'true' : undefined}
                      onClick={() => { setTab('list'); setTimeout(() => selectTurn(o.n), 0) }}
                    >
                      <span className={'cex-outline-role cex-role-' + o.role}>
                        {o.role === 'user' ? <User size={12} aria-hidden="true" /> : <ClaudeMark />}
                      </span>
                      <span className="cex-outline-label">{o.label}</span>
                      <span className="cex-outline-n tnum">{o.n}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <RailFilters />
          </aside>
        </div>

        {/* FOOT */}
        <div className="win-foot cex-vfoot">
          <span className="chip chip-ok">
            <Check size={14} aria-hidden="true" /> tests green
          </span>
          <span className="chip">
            <FileDiff size={14} aria-hidden="true" /> +37 -2 in 3 files
          </span>
          <span className="chip">
            <GitCommitHorizontal size={14} aria-hidden="true" /> <span className="tnum">1</span> commit
          </span>
          {annotatedCount > 0 && (
            <span className="chip chip-warn">
              <Tag size={14} aria-hidden="true" /> <span className="tnum">{annotatedCount}</span> labels
            </span>
          )}
        </div>
      </div>

      {toast && (
        <div className="fb-toast is-ok cex-toast" role="status">
          <span className="fb-toast-ico">
            <Check size={16} aria-hidden="true" />
          </span>
          <div className="fb-toast-body">
            <div className="fb-toast-title">{toast}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* the SessionScorecard could go in the right rail, but the FilterSection is the
   inventory's must-have; render it with live counts */
function RailFilters() {
  const [filters, setFilters] = useState(() => new Set())
  const ROWS = [
    { id: 'errors', label: 'errors', count: 1, Icon: AlertTriangle },
    { id: 'retries', label: 'retries', count: 1, Icon: RotateCcw },
    { id: 'reverts', label: 'reverts', count: 0, Icon: RotateCcw },
    { id: 'subagents', label: 'subagents', count: 1, Icon: GitFork },
  ]
  const ROLES = [
    { id: 'assistant', label: 'assistant', count: 4 },
    { id: 'user', label: 'user', count: 2 },
    { id: 'tool', label: 'tool', count: 7 },
    { id: 'system', label: 'system', count: 1 },
  ]
  function toggle(id) {
    setFilters((p) => {
      const n = new Set(p)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  return (
    <>
      <div className="sb-sec">
        <div className="sb-head">filter turns</div>
        {ROWS.map((r) => (
          <div className={'sb-opt cex-opt' + (filters.has(r.id) ? ' on' : '')} key={r.id} role="checkbox" aria-checked={filters.has(r.id)} tabIndex={0}
            onClick={() => toggle(r.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(r.id) } }}
          >
            <span><r.Icon size={13} aria-hidden="true" /> {r.label}</span>
            <span className="cex-fcount tnum">{r.count}</span>
          </div>
        ))}
      </div>
      <div className="sb-sec">
        <div className="sb-head">roles</div>
        {ROLES.map((r) => (
          <div className={'sb-opt cex-opt' + (filters.has(r.id) ? ' on' : '')} key={r.id} role="checkbox" aria-checked={filters.has(r.id)} tabIndex={0}
            onClick={() => toggle(r.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(r.id) } }}
          >
            <span>{r.label}</span>
            <span className="cex-fcount tnum">{r.count}</span>
          </div>
        ))}
        <div className="cex-rail-reset">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilters(new Set())}>
            reset
          </button>
        </div>
      </div>
    </>
  )
}

/* one turn in the embedded viewer: role-tinted, optional thinking, tool calls,
   git checkpoint, the per-turn label popover trigger + saved chips */
function DetailTurn({ turn, selected, openTools, toggleTool, registerRef, labels, labelOpen, onLabelToggle, onLabelSave, onLabelClose }) {
  const isUser = turn.role === 'user'
  const isSub = turn.role === 'sub'

  const head = (
    <div className="turn-head">
      {turn.role === 'asst' ? <ClaudeMark /> : isSub ? <GitFork size={14} aria-hidden="true" /> : <User size={14} aria-hidden="true" />}
      {turn.role === 'asst' ? 'claude' : isSub ? turn.subAgent : 'user'}
      <span className="cex-turn-tools">
        <span className="tip-anchor cex-label-anchor">
          <button type="button" className="cex-label-btn" aria-label="add a label to this turn" aria-expanded={labelOpen} onClick={onLabelToggle}>
            <Tag size={13} aria-hidden="true" />
          </button>
          {labelOpen && <TurnLabelPopover onSave={onLabelSave} onClose={onLabelClose} />}
        </span>
      </span>
      <span className="meta tnum">turn {turn.n}</span>
    </div>
  )

  const body = (
    <>
      <div className="body">{turn.body}</div>
      {turn.thinking && (
        <div className="thinking">
          <Brain size={14} aria-hidden="true" /> {turn.thinking}
        </div>
      )}
      {labels.length > 0 && (
        <div className="cex-turn-labels">
          {labels.map((l, i) => (
            <SavedLabel key={i} label={l} />
          ))}
        </div>
      )}
      {turn.tools && turn.tools.map((t) => <DetailToolCall key={t.id} tool={t} open={!!openTools[t.id]} onToggle={() => toggleTool(t.id)} />)}
    </>
  )

  if (isSub) {
    return (
      <div className={'cex-turn-wrap' + (selected ? ' cex-sel' : '')} ref={(el) => registerRef(turn.n, el)}>
        <div className="subtask">
          <div className="subtask-head">
            <GitFork size={14} aria-hidden="true" /> <span className="who">{turn.subAgent}</span> {turn.subTitle}
          </div>
          <div className="turn sub">
            {head}
            {body}
          </div>
          <div className="subtask-foot">returned to claude</div>
        </div>
      </div>
    )
  }

  return (
    <div className={'cex-turn-wrap' + (selected ? ' cex-sel' : '')} ref={(el) => registerRef(turn.n, el)}>
      <div className={'turn ' + (isUser ? 'user' : 'asst')}>
        {head}
        {body}
      </div>
      {turn.commit && (
        <div className="marker">
          <span className="r" />
          <span className="mkc">
            <GitCommitHorizontal size={14} aria-hidden="true" /> commit <span className="hash mono">{turn.commit.hash}</span> <span className="mkc-msg">{turn.commit.msg}</span>
            <span className="cex-commit-stat tnum"> · {turn.commit.files} file · +{turn.commit.ins} −{turn.commit.del}</span>
          </span>
          <span className="r" />
        </div>
      )}
    </div>
  )
}

/* a hand-rolled trajectory graph (no library): nodes laid on a lane grid, edges
   drawn as svg polylines, hover/click a node to highlight + jump */
function TrajectoryGraph({ onPick }) {
  const [hot, setHot] = useState(null)
  const NODES = [
    { n: 1, role: 'user', x: 60, y: 130, label: 'goal' },
    { n: 2, role: 'asst', x: 190, y: 70, label: 'plan' },
    { n: 3, role: 'sub', x: 320, y: 130, label: 'explore' },
    { n: 5, role: 'asst', x: 450, y: 70, label: 'test' },
    { n: 7, role: 'user', x: 450, y: 190, label: 'fail' },
    { n: 8, role: 'asst', x: 580, y: 130, label: 'fix' },
  ]
  const EDGES = [
    [1, 2], [2, 3], [3, 5], [5, 7], [7, 8],
  ]
  const byN = Object.fromEntries(NODES.map((d) => [d.n, d]))
  const tone = (role) => (role === 'user' ? 'var(--teal)' : role === 'sub' ? 'var(--mauve)' : 'var(--amber)')
  return (
    <div className="cex-graph">
      <div className="cex-graph-head">
        <span className="cex-graph-title mono">trajectory</span>
        <span className="cex-graph-legend">
          <span className="cex-graph-key"><span className="cex-graph-sw" style={{ background: 'var(--amber)' }} aria-hidden="true" /> assistant</span>
          <span className="cex-graph-key"><span className="cex-graph-sw" style={{ background: 'var(--teal)' }} aria-hidden="true" /> user</span>
          <span className="cex-graph-key"><span className="cex-graph-sw" style={{ background: 'var(--mauve)' }} aria-hidden="true" /> subagent</span>
        </span>
      </div>
      <div className="canvas cex-graph-canvas">
        <svg className="edges" viewBox="0 0 640 260" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {EDGES.map(([a, b], i) => {
            const A = byN[a]
            const B = byN[b]
            return (
              <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--rule-strong)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            )
          })}
        </svg>
        <svg className="edges" viewBox="0 0 640 260" preserveAspectRatio="xMidYMid meet" role="img" aria-label="session trajectory, 6 turns">
          {NODES.map((d) => {
            const on = hot === d.n
            return (
              <g key={d.n} className="cex-graph-node" tabIndex={0} role="button" aria-label={`turn ${d.n}, ${d.label}`}
                onMouseEnter={() => setHot(d.n)} onMouseLeave={() => setHot((h) => (h === d.n ? null : h))}
                onFocus={() => setHot(d.n)} onBlur={() => setHot((h) => (h === d.n ? null : h))}
                onClick={() => onPick(d.n)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(d.n) } }}
              >
                <rect x={d.x - 26} y={d.y - 14} width="52" height="28" fill="var(--surface-2)" stroke={on ? 'var(--amber)' : 'var(--rule-strong)'} strokeWidth={on ? 2 : 1} vectorEffect="non-scaling-stroke" />
                <rect x={d.x - 26} y={d.y + 11} width="52" height="3" fill={tone(d.role)} />
                <text x={d.x} y={d.y + 1} textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill="var(--ink)">{d.label}</text>
                <text x={d.x} y={d.y - 18} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--ink-4)">{d.n}</text>
              </g>
            )
          })}
        </svg>
      </div>
      {/* a horizontal scrubber synced to the canvas */}
      <div className="cex-graph-scrub" aria-hidden="true">
        {NODES.map((d) => (
          <button key={d.n} type="button" className={'cex-scrub-tick' + (hot === d.n ? ' cex-on' : '')} style={{ background: tone(d.role) }}
            onMouseEnter={() => setHot(d.n)} onMouseLeave={() => setHot(null)} onClick={() => onPick(d.n)} aria-label={`turn ${d.n}`} />
        ))}
      </div>
      <p className="cex-graph-foot mono">hover a node to highlight it; click to jump to the turn in the list view.</p>
    </div>
  )
}

/* =====================================================================
   PROFILE VIEW — a contributor's public identity + published library.
===================================================================== */

const PROFILE = {
  handle: 'alice-dev',
  name: 'Alice Developer',
  discoverable: true,
  isOwner: true,
  transcripts: 4,
  projects: 3,
  tokens: 698800,
  attestations: [
    { id: 'a1', type: 'Used in training', org: 'anthropic-labs', note: 'Used as a training example for auth-related debugging patterns', by: 'bob-ai' },
    { id: 'a2', type: 'Referenced', org: 'data-collective', note: 'Referenced in our Go API best practices guide', by: 'charlie-ml' },
    { id: 'a3', type: 'Evaluated', org: 'openai-research', note: 'Benchmarked query optimization patterns against our dataset', by: 'charlie-ml' },
  ],
}

const PROFILE_PROJECTS = [
  {
    id: 'go-rest-api',
    name: 'go-rest-api',
    transcripts: [
      { id: 'd41a8e', provider: 'claude-code', modelName: 'Claude Opus 4.5', title: 'Building a REST API from scratch', date: '2026-06-15', visibility: 'public' },
    ],
  },
  {
    id: 'village',
    name: 'village',
    transcripts: [
      { id: '7c2b90', provider: 'claude-code', modelName: 'Claude Sonnet 4.5', title: 'Debugging auth middleware with Claude Code', date: '2026-06-14', visibility: 'shared', sharedWith: ['AI Research Team'] },
      { id: '9a14d2', provider: 'claude-code', modelName: 'Claude Sonnet 4.5', title: 'Wire the share-dialog focus return', date: '2026-06-08', visibility: 'public' },
    ],
  },
  {
    id: 'neurondle',
    name: 'Neurondle',
    transcripts: [
      { id: 'b21c44', provider: 'gemini-cli', modelName: 'Gemini 2.5 Pro', title: 'Greenfield React app setup', date: '2026-06-05', visibility: 'private' },
    ],
  },
]

export function ProfileView({ theme }) {
  const [projects, setProjects] = useState(PROFILE_PROJECTS)
  const [renaming, setRenaming] = useState(null) // project id
  const [renameValue, setRenameValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null) // transcript id
  const [discoverable, setDiscoverable] = useState(PROFILE.discoverable)
  const [discToggling, setDiscToggling] = useState(false)
  const renameRef = useRef(null)

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renaming])

  function startRename(p) {
    setRenaming(p.id)
    setRenameValue(p.name)
  }
  function commitRename() {
    if (renaming && renameValue.trim()) {
      setProjects((prev) => prev.map((p) => (p.id === renaming ? { ...p, name: renameValue.trim().slice(0, 255) } : p)))
    }
    setRenaming(null)
  }
  function deleteTranscript(projectId, tid) {
    setProjects((prev) =>
      prev
        .map((p) => (p.id === projectId ? { ...p, transcripts: p.transcripts.filter((t) => t.id !== tid) } : p))
        .filter((p) => p.transcripts.length > 0),
    )
    setConfirmDelete(null)
  }
  function toggleDiscoverable() {
    setDiscToggling(true)
    setTimeout(() => {
      setDiscoverable((d) => !d)
      setDiscToggling(false)
    }, 400)
  }

  const totalTranscripts = projects.reduce((s, p) => s + p.transcripts.length, 0)

  return (
    <div className="cex-root cex-profile">
      <div className="crumb cex-profile-crumb">
        commons <ChevronRight size={13} aria-hidden="true" /> <span className="cur mono">@{PROFILE.handle}</span>
      </div>

      {/* HERO */}
      <header className="cex-phero">
        <div className="cex-phero-av" aria-hidden="true">
          {initials(PROFILE.name)}
        </div>
        <div className="cex-phero-id">
          <h2 className="cex-h2 cex-pname">{PROFILE.name}</h2>
          <span className="cex-phandle mono">@{PROFILE.handle}</span>
          {!discoverable && (
            <span className="cex-disc-note mono">
              <EyeOff size={13} aria-hidden="true" /> not discoverable — you appear as <b>anon</b> to others
            </span>
          )}
        </div>
      </header>

      {/* KPI TILES (kit StatGrid) */}
      <StatGrid
        tiles={[
          { key: 'transcripts', label: 'transcripts', value: totalTranscripts },
          { key: 'projects', label: 'projects', value: projects.length },
          { key: 'tokens', label: 'tokens', value: fmtTokens(PROFILE.tokens) },
        ]}
      />

      {/* PUBLISHED LIBRARY */}
      <section className="cex-psec" aria-label="published library">
        <div className="cex-psec-head">
          <h3 className="cex-psec-title">published library</h3>
          {PROFILE.isOwner && (
            <button type="button" className="btn btn-secondary btn-sm">
              <Upload size={14} aria-hidden="true" /> import
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="empty cex-empty">
            <div className="ring">
              <FolderGit2 size={20} aria-hidden="true" />
            </div>
            <h3>your library is empty</h3>
            <p>publish your first transcript with the peasant cli to see it grouped here by project.</p>
          </div>
        ) : (
          <div className="cex-projects">
            {projects.map((p) => (
              <div className="cex-project" key={p.id}>
                <div className="cex-project-head">
                  <span className="cex-project-name">
                    <FolderGit2 size={14} aria-hidden="true" />
                    {renaming === p.id ? (
                      <input
                        ref={renameRef}
                        className="input cex-rename"
                        value={renameValue}
                        maxLength={255}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          else if (e.key === 'Escape') setRenaming(null)
                        }}
                        aria-label={`rename project ${p.name}`}
                      />
                    ) : (
                      <b>{p.name}</b>
                    )}
                  </span>
                  <span className="cex-project-cnt mono tnum">
                    {p.transcripts.length} session{p.transcripts.length === 1 ? '' : 's'}
                  </span>
                  {PROFILE.isOwner && renaming !== p.id && (
                    <button type="button" className="cex-icon-btn" aria-label={`rename project ${p.name}`} onClick={() => startRename(p)}>
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="cex-lib-rows">
                  {p.transcripts.map((t) => (
                    <div className="row cex-lib-row" key={t.id}>
                      <span className="cex-trow-model">
                        <ProviderMark id={t.provider} />
                        <b className={PROVIDER_COLOR[t.provider]}>{t.modelName}</b>
                      </span>
                      <span className="cex-lib-title grow">{t.title}</span>
                      <span className="cex-trow-date mono tnum">{fmtDate(t.date)}</span>
                      <VisibilityEye visibility={t.visibility} sharedWith={t.sharedWith} />
                      {PROFILE.isOwner && (
                        <span className="cex-lib-actions">
                          {confirmDelete === t.id ? (
                            <>
                              <span className="cex-confirm mono">delete?</span>
                              <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteTranscript(p.id, t.id)}>
                                yes
                              </button>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                                cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="cex-icon-btn" aria-label={`edit ${t.title}`}>
                                <Pencil size={13} aria-hidden="true" />
                              </button>
                              <button type="button" className="cex-icon-btn cex-danger" aria-label={`delete ${t.title}`} onClick={() => setConfirmDelete(t.id)}>
                                <Trash2 size={13} aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ATTESTATIONS */}
      <section className="cex-psec" aria-label="attestations">
        <h3 className="cex-psec-title">attestations</h3>
        <div className="cex-attests">
          {PROFILE.attestations.map((a) => (
            <div className="row cex-attest-row" key={a.id}>
              <span className="cex-attest-type">
                <ShieldCheck size={14} aria-hidden="true" className="cex-attest-ic" /> <b>{a.type}</b>
              </span>
              <span className="cex-attest-note grow">{a.note}</span>
              <span className="tag cex-org">@{a.org}</span>
            </div>
          ))}
        </div>
      </section>

      {/* OWNER-ONLY: PRIVACY + DANGER */}
      {PROFILE.isOwner && (
        <>
          <section className="cex-psec" aria-label="privacy">
            <h3 className="cex-psec-title">privacy</h3>
            <div className="cex-priv-card">
              <div className="cex-priv-row">
                <div className="cex-priv-text">
                  <span className="cex-priv-k">discoverable profile</span>
                  <span className="cex-priv-d mono">
                    when off you appear as anon and are hidden from member and contributor lists.
                  </span>
                </div>
                <div className="cex-priv-ctrl">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={discoverable}
                    aria-busy={discToggling}
                    aria-label="discoverable profile"
                    className="sw"
                    onClick={toggleDiscoverable}
                    style={discToggling ? { cursor: 'progress' } : undefined}
                  />
                  <span className="sw-state">{discToggling ? 'saving…' : discoverable ? 'on' : 'off'}</span>
                </div>
              </div>
            </div>
          </section>

          {/* danger zone (kit DangerZone wrapping a kit ConfirmInline delete) */}
          <section className="cex-psec" aria-label="danger zone">
            <DangerZone title="danger zone">
              <div className="cex-priv-row">
                <div className="cex-priv-text">
                  <span className="cex-priv-k">delete account</span>
                  <span className="cex-priv-d mono">removes all your transcripts and any collectives you own. this cannot be undone.</span>
                </div>
                <ConfirmInline
                  label="delete account"
                  confirmLabel="delete"
                  icon={<Trash2 size={14} aria-hidden="true" />}
                  aria-label="delete account"
                  onConfirm={() => {}}
                />
              </div>
            </DangerZone>
          </section>
        </>
      )}
    </div>
  )
}

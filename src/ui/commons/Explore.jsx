import { useEffect, useMemo, useRef, useState } from 'react'
import { Compass, FileText, LayoutGrid, List, SearchX, User } from 'lucide-react'
import FacetRail from '../FacetRail.jsx'
import { StatGrid } from '../StatTiles.jsx'
import Pagination from '../Pagination.jsx'
import { ProviderTag } from '../ProviderIcon.jsx'
import { VisibilityEye } from '../VisibilityControl.jsx'

const PAGE_SIZE = 4

const FALLBACK_EXPLORE_DATA = Object.freeze({
  transcripts: {
    transcripts: [
      {
        id: 'd41a8e',
        title: 'building a rest api from scratch',
        visibility: 'public',
        modelProvider: 'claude-code',
        modelName: 'Claude Opus 4.5',
        harnessVersion: '2026.06',
        sessionStart: '2026-06-15T00:00:00Z',
        sessionEnd: '2026-06-15T01:20:00Z',
        turnCount: 128,
        tokenCount: 412300,
        toolCallCount: 37,
        durationMs: 4800000,
        gitBranch: 'main',
        projectName: 'go-rest-api',
        tags: [
          { id: 'greenfield', name: 'greenfield' },
          { id: 'claude-code', name: 'claude-code' },
        ],
        owner: {
          githubUsername: 'alice-dev',
          displayName: 'Alice Developer',
          avatarUrl: null,
        },
      },
      {
        id: '7c2b90',
        title: 'debugging auth middleware with claude code',
        visibility: 'shared',
        modelProvider: 'claude-code',
        modelName: 'Claude Sonnet 4.5',
        harnessVersion: '2026.06',
        sessionStart: '2026-06-14T00:00:00Z',
        sessionEnd: '2026-06-14T00:45:00Z',
        turnCount: 64,
        tokenCount: 138400,
        toolCallCount: 19,
        durationMs: 2700000,
        gitBranch: 'develop',
        projectName: 'village',
        tags: [
          { id: 'debugging', name: 'debugging' },
          { id: 'claude-code', name: 'claude-code' },
        ],
        owner: {
          githubUsername: 'alice-dev',
          displayName: 'Alice Developer',
          avatarUrl: null,
        },
      },
      {
        id: 'b9f33c',
        title: 'refactoring database queries with gemini',
        visibility: 'public',
        modelProvider: 'gemini-cli',
        modelName: 'Gemini 2.5 Pro',
        harnessVersion: '2026.06',
        sessionStart: '2026-06-13T00:00:00Z',
        sessionEnd: '2026-06-13T01:36:00Z',
        turnCount: 91,
        tokenCount: 221700,
        toolCallCount: 28,
        durationMs: 5760000,
        gitBranch: 'develop',
        projectName: 'api-server',
        tags: [
          { id: 'refactoring', name: 'refactoring' },
          { id: 'gemini-cli', name: 'gemini-cli' },
        ],
        owner: {
          githubUsername: 'charlie-ml',
          displayName: 'Charlie ML',
          avatarUrl: null,
        },
      },
      {
        id: 'e2107a',
        title: 'greenfield react app setup',
        visibility: 'public',
        modelProvider: 'opencode',
        modelName: 'OpenCode',
        harnessVersion: '2026.06',
        sessionStart: '2026-06-12T00:00:00Z',
        sessionEnd: '2026-06-12T00:38:00Z',
        turnCount: 47,
        tokenCount: 96200,
        toolCallCount: 14,
        durationMs: 2280000,
        gitBranch: 'feature/lift',
        projectName: 'frontend-app',
        tags: [
          { id: 'greenfield', name: 'greenfield' },
          { id: 'iterative-refinement', name: 'iterative-refinement' },
        ],
        owner: {
          githubUsername: 'bob-ai',
          displayName: 'Bob AI',
          avatarUrl: null,
        },
      },
    ],
    total: 4,
    page: 0,
    limit: PAGE_SIZE,
  },
  collectives: [
    { id: 'ai-research-team', name: 'AI Research Team', description: 'Sharing transcripts related to AI research', linkedGithubOrg: 'anthropic-labs', memberCount: 12, transcriptCount: 48 },
    { id: 'verified-contributors', name: 'Verified Contributors', description: 'Only verified org members can share here', linkedGithubOrg: 'data-collective', memberCount: 31, transcriptCount: 126 },
  ],
  popularTags: [
    { id: 'claude-code', name: 'claude-code', usageCount: 41 },
    { id: 'debugging', name: 'debugging', usageCount: 33 },
    { id: 'gemini-cli', name: 'gemini-cli', usageCount: 28 },
    { id: 'refactoring', name: 'refactoring', usageCount: 24 },
  ],
})

const fmtTokens = (n) => n.toLocaleString('en-US')
const fmtDur = (ms) => {
  const mins = Math.max(0, Math.round(ms / 60000))
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` : `${mins}min`
}
const fmtDate = (iso) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
const initials = (name = '') =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?'

const normalize = (value) => value.trim().toLowerCase()

function titleize(value) {
  if (!value) return ''
  return value.length ? value[0].toUpperCase() + value.slice(1) : value
}

function groupedBy(items, keyFn) {
  const groups = new Map()
  for (const item of items) {
    const key = keyFn(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return groups
}

function openOrNavigate(event, onOpen, value) {
  if (!onOpen) return
  event.preventDefault()
  onOpen(value)
}

function pickFallbackData(data) {
  return data ?? FALLBACK_EXPLORE_DATA
}

function TranscriptPreviewCard({ transcript, href, onOpen }) {
  const card = (
    <>
      <div className="card-head">
        <span className="metaitem cex-model">
          <ProviderTag harness={transcript.modelProvider} accent />
          <span className="mono">{transcript.modelName || transcript.modelProvider}</span>
        </span>
        <VisibilityEye visibility={transcript.visibility} />
      </div>
      <h3 className="cex-title">{titleize(transcript.title || 'untitled transcript')}</h3>
      {transcript.projectName && <p className="cex-proj">{transcript.projectName}</p>}
      <p className="cex-desc">{transcript.tags.map((tag) => `#${tag.name}`).join(' ')}</p>
      <div className="cex-foot row">
        <span className="cex-author">
          <span className="avatar" aria-hidden="true">
            {initials(transcript.owner.displayName || transcript.owner.githubUsername)}
          </span>
          <span className="cex-handle mono">@{transcript.owner.githubUsername}</span>
        </span>
        <span className="cex-date tnum">{fmtDate(transcript.sessionStart || transcript.sessionEnd || '')}</span>
      </div>
    </>
  )
  if (href) {
    return (
      <a href={href} className="card cex-tcard" onClick={(event) => openOrNavigate(event, onOpen, transcript)}>
        {card}
      </a>
    )
  }
  return (
    <button type="button" className="card cex-tcard" onClick={() => onOpen?.(transcript)}>
      {card}
    </button>
  )
}

function TranscriptRow({ transcript, href, onOpen }) {
  const row = (
    <>
      <span className="cex-trow-model">
        <ProviderTag harness={transcript.modelProvider} />
        <b>{transcript.modelName || transcript.modelProvider}</b>
      </span>
      <span className="cex-trow-title">{titleize(transcript.title || 'untitled transcript')}</span>
      <span className="cex-trow-stats mono tnum">
        {transcript.durationMs != null && <span>{fmtDur(transcript.durationMs)}</span>}
        {transcript.turnCount != null && <span>{transcript.turnCount} turns</span>}
        {transcript.toolCallCount != null && <span>{transcript.toolCallCount} tools</span>}
      </span>
      <span className="cex-trow-date mono tnum">{fmtDate(transcript.sessionStart || transcript.sessionEnd || '')}</span>
      <VisibilityEye visibility={transcript.visibility} />
    </>
  )
  if (href) {
    return (
      <a href={href} className="row cex-trow" onClick={(event) => openOrNavigate(event, onOpen, transcript)}>
        {row}
      </a>
    )
  }
  return (
    <button type="button" className="row cex-trow" onClick={() => onOpen?.(transcript)}>
      {row}
    </button>
  )
}

function CollectiveCard({ collective, href, onOpen }) {
  const card = (
    <>
      <div className="cex-cname">
        <span className="avatar" aria-hidden="true">C</span>
        <b>{collective.name}</b>
      </div>
      {collective.description && <p className="cex-desc">{collective.description}</p>}
      <div className="cex-cfoot mono tnum">
        {collective.memberCount} members · {collective.transcriptCount} transcripts
      </div>
    </>
  )
  if (href) {
    return (
      <a href={href} className="card cex-ccard" onClick={(event) => openOrNavigate(event, onOpen, collective)}>
        {card}
      </a>
    )
  }
  return (
    <button type="button" className="card cex-ccard" onClick={() => onOpen?.(collective)}>
      {card}
    </button>
  )
}

/**
 * @typedef {import('./types.js').ExploreSurfaceProps} ExploreSurfaceProps
 */

/** @param {ExploreSurfaceProps} props */
export default function Explore({
  data,
  className = '',
  onFiltersChange,
  onOpenTranscript,
  onOpenProfile,
  onOpenCollective,
  transcriptHref,
  profileHref,
  collectiveHref,
}) {
  const payload = pickFallbackData(data)
  const transcriptRows = payload.transcripts.transcripts

  const [rawQuery, setRawQuery] = useState('')
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('recent')
  const [provider, setProvider] = useState('all')
  const [topics, setTopics] = useState(() => new Set())
  const [layout, setLayout] = useState('grid')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('browse')
  const firstRun = useRef(true)

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      setQuery(rawQuery)
      return
    }
    const id = setTimeout(() => setQuery(rawQuery), 250)
    return () => clearTimeout(id)
  }, [firstRun, rawQuery])

  useEffect(() => {
    setPage(1)
  }, [query, order, provider, topics])

  useEffect(() => {
    onFiltersChange?.({
      query,
      provider,
      topics: [...topics],
      order,
      page,
    })
  }, [order, onFiltersChange, page, provider, query, topics])

  useEffect(() => {
    if (payload.transcripts.page && payload.transcripts.page !== page) {
      setPage(payload.transcripts.page)
    }
  }, [page, payload.transcripts.page])

  const selectedTranscript = transcriptRows.find((t) => t.id === selectedId) ?? transcriptRows[0] ?? null
  const selectedOwner = selectedTranscript?.owner ?? null
  const ownerTranscripts = selectedOwner
    ? transcriptRows.filter((t) => t.owner.githubUsername === selectedOwner.githubUsername)
    : []

  const providerOptions = useMemo(() => {
    const counts = new Map()
    for (const transcript of transcriptRows) {
      counts.set(transcript.modelProvider, (counts.get(transcript.modelProvider) || 0) + 1)
    }
    return [
      { slug: 'all', count: transcriptRows.length },
      ...[...counts.entries()].map(([slug, count]) => ({ slug, count })),
    ]
  }, [transcriptRows])

  useEffect(() => {
    if (selectedId && !transcriptRows.some((row) => row.id === selectedId)) {
      setSelectedId(null)
      setMode('browse')
    }
  }, [selectedId, transcriptRows])

  const collectiveHits = useMemo(() => {
    const q = normalize(query)
    if (!q) return null
    return payload.collectives.filter((collective) => {
      const hay = [collective.name, collective.description, collective.linkedGithubOrg].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [payload.collectives, query])

  const pageRows = transcriptRows
  const activeTopics = topics.size
  const totalItems = payload.transcripts.total ?? transcriptRows.length
  const currentPage = payload.transcripts.page || page
  const currentLimit = payload.transcripts.limit || transcriptRows.length || 1

  const openTranscript = (transcript) => {
    if (onOpenTranscript) {
      onOpenTranscript(transcript)
      return
    }
    setSelectedId(transcript.id)
    setMode('detail')
  }

  const openProfile = () => {
    if (onOpenProfile && selectedOwner) {
      onOpenProfile(selectedOwner)
      return
    }
    if (selectedTranscript) {
      setSelectedId(selectedTranscript.id)
      setMode('profile')
    } else if (transcriptRows[0]) {
      setSelectedId(transcriptRows[0].id)
      setMode('profile')
    }
  }

  const reset = () => {
    setRawQuery('')
    setQuery('')
    setOrder('recent')
    setProvider('all')
    setTopics(new Set())
    setPage(1)
  }

  const profileProjects = useMemo(() => {
    if (!selectedOwner) return []
    return [...groupedBy(ownerTranscripts, (t) => t.projectName || 'untitled project').entries()].map(([project, items]) => ({ project, items }))
  }, [ownerTranscripts, selectedOwner])

  const profileStats = useMemo(() => {
    const tokens = ownerTranscripts.reduce((sum, t) => sum + (t.tokenCount || 0), 0)
    return {
      transcripts: ownerTranscripts.length,
      projects: profileProjects.length,
      tokens,
    }
  }, [ownerTranscripts, profileProjects.length])

  if (mode === 'detail' && selectedTranscript) {
    return (
      <div className={`cex-root cex-detail ${className}`.trim()}>
        <div className="cex-detail-back">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode('browse')}>
            <FileText size={14} aria-hidden="true" /> back to explore
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={openProfile}>
            <User size={14} aria-hidden="true" /> profile
          </button>
        </div>

        <div className="window cex-viewer">
          <div className="win-head cex-viewer-head">
            <div className="cex-head-top">
              <div className="crumb">
                commons <span aria-hidden="true">›</span> explore <span aria-hidden="true">›</span> <span className="cur mono">{selectedTranscript.id}</span>
              </div>
            </div>
            <div className="cex-hero-title">
              <h2 className="win-title cex-vtitle">{titleize(selectedTranscript.title || 'untitled transcript')}</h2>
              <VisibilityEye visibility={selectedTranscript.visibility} />
            </div>
            <p className="cex-vdesc">
              {selectedTranscript.projectName || 'shared transcript'} · {selectedTranscript.owner.displayName || selectedTranscript.owner.githubUsername}
            </p>
            <div className="cex-vmeta win-meta">
              <span className="metaitem">
                <ProviderTag harness={selectedTranscript.modelProvider} accent />
                <span>{selectedTranscript.modelName || selectedTranscript.modelProvider}</span>
              </span>
              <span className="metaitem mono tnum">
                <FileText size={14} aria-hidden="true" /> {selectedTranscript.turnCount ?? 0} turns
              </span>
              <span className="metaitem mono tnum">
                <span aria-hidden="true">#</span> {fmtTokens(selectedTranscript.tokenCount || 0)} tokens
              </span>
              <span className="metaitem mono tnum">
                {selectedTranscript.toolCallCount ?? 0} tools
              </span>
            </div>
          </div>

          <div className="cex-viewer-body">
            <div className="cex-stream" role="tabpanel" tabIndex={-1}>
              <div className="phase">
                <span className="lbl">about</span>
                <span className="meta mono tnum">{fmtDate(selectedTranscript.sessionStart || selectedTranscript.sessionEnd || '')}</span>
              </div>
              <div className="turn">
                <div className="head">
                  <span className="name">session summary</span>
                </div>
                <div className="body">
                  <p>
                    This view surfaces the loaded transcript metadata, then lets the user move to the owner profile without leaving the shared surface.
                  </p>
                  {selectedTranscript.tags.length > 0 && (
                    <div className="cex-tags">
                      {selectedTranscript.tags.map((tag) => (
                        <span key={tag.id} className="chip">#{tag.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <aside className="cex-psec" aria-label="owner snapshot">
              <h3 className="cex-psec-title">owner snapshot</h3>
              <div className="cex-phero">
                <div className="cex-phero-av" aria-hidden="true">
                  {initials(selectedTranscript.owner.displayName || selectedTranscript.owner.githubUsername)}
                </div>
                <div className="cex-phero-id">
                  <h2 className="cex-h2 cex-pname">{selectedTranscript.owner.displayName || selectedTranscript.owner.githubUsername}</h2>
                  <span className="cex-phandle mono">@{selectedTranscript.owner.githubUsername}</span>
                </div>
              </div>
              <StatGrid
                tiles={[
                  { key: 'transcripts', label: 'transcripts', value: profileStats.transcripts },
                  { key: 'projects', label: 'projects', value: profileStats.projects },
                  { key: 'tokens', label: 'tokens', value: fmtTokens(profileStats.tokens) },
                ]}
              />
            </aside>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'profile' && selectedOwner) {
    return (
      <div className={`cex-root cex-profile ${className}`.trim()}>
        <div className="cex-detail-back">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode('detail')}>
            <FileText size={14} aria-hidden="true" /> back to transcript
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode('browse')}>
            <Compass size={14} aria-hidden="true" /> back to explore
          </button>
        </div>

        <div className="crumb cex-profile-crumb">
          commons <span aria-hidden="true">›</span> <span className="cur mono">@{selectedOwner.githubUsername}</span>
        </div>

        <header className="cex-phero">
          <div className="cex-phero-av" aria-hidden="true">
            {initials(selectedOwner.displayName || selectedOwner.githubUsername)}
          </div>
          <div className="cex-phero-id">
            <h2 className="cex-h2 cex-pname">{selectedOwner.displayName || selectedOwner.githubUsername}</h2>
            <span className="cex-phandle mono">@{selectedOwner.githubUsername}</span>
          </div>
        </header>

        <StatGrid
          tiles={[
            { key: 'transcripts', label: 'transcripts', value: profileStats.transcripts },
            { key: 'projects', label: 'projects', value: profileStats.projects },
            { key: 'tokens', label: 'tokens', value: fmtTokens(profileStats.tokens) },
          ]}
        />

        <section className="cex-psec" aria-label="published library">
          <h3 className="cex-psec-title">published library</h3>
          {profileProjects.length === 0 ? (
            <div className="empty cex-empty">
              <div className="ring">
                <Compass size={20} aria-hidden="true" />
              </div>
              <h3>no transcripts yet</h3>
              <p>this profile has not shared any transcripts in the commons.</p>
            </div>
          ) : (
            <div className="cex-projects">
              {profileProjects.map(({ project, items }) => (
                <div key={project} className="cex-project">
                  <div className="cex-project-head">
                    <span className="cex-project-name">
                      <span aria-hidden="true">▣</span>
                      <b>{project}</b>
                    </span>
                    <span className="cex-project-cnt mono tnum">{items.length} session{items.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="cex-lib-rows">
                    {items.map((item) => (
                      <TranscriptRow
                        key={item.id}
                        transcript={item}
                        href={transcriptHref?.(item)}
                        onOpen={openTranscript}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className={`cex-root ${className}`.trim()}>
      <header className="cex-explore-head">
        <h2 className="cex-h2">explore transcripts</h2>
        <p className="cex-deck">search redacted ai agent transcripts shared by the community.</p>
        <div className="input-ico cex-searchbar">
          <input
            className="input"
            type="text"
            value={rawQuery}
            onChange={(event) => setRawQuery(event.target.value)}
            placeholder="search transcripts, collectives, projects, models..."
            aria-label="search transcripts, collectives, projects, models"
          />
          {rawQuery && (
            <button type="button" className="cex-clear" aria-label="clear search" onClick={() => setRawQuery('')}>
              <SearchX size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div className="cex-explore-body">
        <FacetRail
          order={order}
          onOrder={(next) => setOrder(next)}
          providers={providerOptions}
          activeProviders={provider === 'all' ? new Set() : new Set([provider])}
          onProvider={(slug) => setProvider((prev) => (prev === slug ? 'all' : slug))}
          topics={payload.popularTags.map((tag) => ({ tag: tag.name, count: tag.usageCount }))}
          activeTopics={topics}
          onTopic={(tag) => {
            setTopics((prev) => {
              const next = new Set(prev)
              if (next.has(tag)) next.delete(tag)
              else next.add(tag)
              return next
            })
          }}
          onClear={reset}
          className="cex-rail"
        />

        <div className="cex-results">
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
                  {collectiveHits.map((collective) => (
                    <CollectiveCard
                      key={collective.id}
                      collective={collective}
                      href={collectiveHref?.(collective)}
                      onOpen={onOpenCollective}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="cex-results-head">
            <span className="cex-eyebrow">
              transcripts <span className="cex-count tnum" role="status" aria-live="polite">{totalItems}</span>
            </span>
            <div className="bs-seg cex-viewseg" role="group" aria-label="view mode">
              <button type="button" className="bs-seg-opt" aria-pressed={layout === 'grid'} aria-label="grid view" onClick={() => setLayout('grid')}>
                <LayoutGrid size={14} /> grid
              </button>
              <button type="button" className="bs-seg-opt" aria-pressed={layout === 'list'} aria-label="list view" onClick={() => setLayout('list')}>
                <List size={14} /> list
              </button>
              <button type="button" className="bs-seg-opt" aria-pressed={mode === 'profile'} aria-label="profile view" onClick={openProfile} disabled={!pageRows.length}>
                <User size={14} /> profile
              </button>
            </div>
          </div>

          {pageRows.length === 0 ? (
            query.trim() || provider !== 'all' || activeTopics ? (
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
              {pageRows.map((transcript) => (
                <TranscriptPreviewCard
                  key={transcript.id}
                  transcript={transcript}
                  href={transcriptHref?.(transcript)}
                  onOpen={openTranscript}
                />
              ))}
            </div>
          ) : (
            <div className="cex-list">
              {pageRows.map((transcript) => (
                <TranscriptRow
                  key={transcript.id}
                  transcript={transcript}
                  href={transcriptHref?.(transcript)}
                  onOpen={openTranscript}
                />
              ))}
            </div>
          )}

          {totalItems > currentLimit && (
            <Pagination page={currentPage} totalItems={totalItems} pageSize={currentLimit} onChange={setPage} className="cex-pgn" />
          )}
        </div>
      </div>
    </div>
  )
}

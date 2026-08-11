import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight, ChevronDown, ChevronUp, Clock, Coins, ShieldCheck, FileText,
  Search, Pencil, ListTree, LayoutList, SlidersHorizontal, Share2, Users, User, Wrench,
  Link as LinkIcon, MoreHorizontal, Download, MessageSquareText, AlertTriangle,
  GitCommitHorizontal, List, Network, Eye,
  Filter as FilterIcon, FileSearch, Sparkles, Flag, Play, RefreshCw, RotateCcw,
  CornerDownRight, Check, X, PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen,
} from 'lucide-react'
import ProviderIcon from '../ProviderIcon.jsx'
import { formatDuration } from '../StepsWaterfall.jsx'
import { TOOL_GROUPS } from './view-model.js'
import TurnCard from './TurnCard.jsx'
import DiffEntryCard from './DiffEntryCard.jsx'
import OutlineRail from './OutlineRail.jsx'
import FiltersRail from './FiltersRail.jsx'
import Scrubber from './Scrubber.jsx'
import Scorecard from './Scorecard.jsx'
import LabelPopover from './LabelPopover.jsx'
import useTranscriptInitialPosition from './useTranscriptInitialPosition.jsx'
import { transcriptInitialPositionReadiness } from './initial-position.js'

/* ───────────────────────────────────────────────────────────────────────────
   TranscriptViewer — the composite single-transcript surface (the headline)
   ─────────────────────────────────────────────────────────────────────────
   Lifted from the canonical mockup's `TranscriptApp` (src/mockups/inuse/
   TranscriptApp.jsx:880) into an EXPORTED, DUMB composite. It assembles the
   chrome + the canvas (the S3 turn cards, or the consumer's `graphSlot` in graph
   mode) + the rails + scrubber + scorecard + the between-turn markers, ALL from a
   single cooked `TranscriptViewModel`. It never parses wire and never reads a git
   wire field — only `vm`.

   STATE: every view-state prop is `{value?, onChange?}`-controllable with a
   canonical default, so `<TranscriptViewer viewModel={vm} capabilities={caps} />`
   works fully unmanaged. THEME is optional (default dark). CAPABILITIES are
   REQUIRED (the type contract errors if omitted — state-capabilities.contract.type-test.js).
   CALLBACKS are capability-GATED: each affordance + its callback is wired ONLY
   when the matching capability is true, so a gated callback can never fire.

   GRAPH: the composite owns NO graph engine. In `viewMode:'graph'` it hands
   the `graphSlot` render-prop a cooked context and renders whatever it returns
   (transcript-browser plugs @xyflow; the mockup plugs SVG) — no `@xyflow` dependency here.

   CHECKPOINTS: S3 relocated commits off the per-turn card; the composite draws
   them between turns from the cooked `session.git.commits` (render-when-present),
   anchored to a turn when the cooked commit carries one, else clustered at the end.
   ─────────────────────────────────────────────────────────────────────────── */

/** @typedef {import('./state-capabilities.js').TranscriptViewerProps} TranscriptViewerProps */
/** @typedef {import('./state-capabilities.js').TranscriptFilters} TranscriptFilters */
/** @typedef {{sourceView: 'trace', sourceMode: 'list', scrollTop: number, focusOrigin: {kind: 'tab', tab: 'trace'} | {kind: 'scroller'}, requestKey: string}} TranscriptReturnTarget */

const fmtTokens = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n))

/** controllable-with-default: use `value` when provided (controlled), else internal state seeded
    by `defaultValue`; `onChange` fires in both modes so the host always hears the change. */
function useControllable(value, onChange, defaultValue) {
  const [internal, setInternal] = useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : internal
  const set = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(isControlled ? value : internal) : next
      if (!isControlled) setInternal(resolved)
      if (onChange) onChange(resolved)
    },
    [isControlled, onChange, value, internal],
  )
  return [current, set]
}

/* the five session views (count badges come off the cooked VM). */
const TAB_ORDER = /** @type {const} */ (['highlights', 'trace', 'diffs', 'files', 'annotations'])
const TAB_LABEL = { highlights: 'highlights', trace: 'full trace', diffs: 'diffs', files: 'files', annotations: 'annotations' }

/* phase id/key → glyph (PhaseVM carries a semantic key, not a component). */
const PHASE_ICON = { exploration: FileSearch, debugging: AlertTriangle, implementation: Pencil, planning: ListTree, review: ShieldCheck }
/* highlight kind → glyph. */
const HIGHLIGHT_ICON = { request: Play, phase: Flag, error: AlertTriangle, checkpoint: GitCommitHorizontal, final: Sparkles }
/* annotation kind → label + glyph + tooltip. */
const ANNOTATION_META = {
  error: { label: 'error', icon: AlertTriangle, chip: 'chip-err', tip: 'a tool returned an error or a non-zero exit code' },
  retry: { label: 'retry', icon: RefreshCw, chip: 'chip-warn', tip: 'the same tool ran 3+ times within 5 turns' },
  revert: { label: 'reverted edit', icon: RotateCcw, chip: 'chip-warn', tip: 'a file was edited again after an earlier change' },
  subagent: { label: 'subagent', icon: CornerDownRight, chip: '', tip: 'a Task spawned a nested subagent at depth > 0' },
}

/* the canonical default view-state (so the viewer "just works" unmanaged). */
const DEFAULT_FILTERS = Object.freeze({
  categories: { prompts: true, responses: true, thinking: true, toolcalls: true },
  toolGroups: Object.fromEntries(TOOL_GROUPS.map((id) => [id, true])),
  tags: { errors: false, retries: false, revert: false },
  views: { hidden: true, expandAll: false, compact: false },
  checkpoint: 'all',
})

/* ── between-turn markers (lifted from the mockup's inline trace markup so the .txn-* CSS matches
   exactly; the composite draws them, not the per-turn TurnCard) ─────────────────────────────── */

function PhaseDivider({ phase }) {
  const Icon = PHASE_ICON[phase.icon] ?? PHASE_ICON[phase.id] ?? Flag
  return (
    <div className="phase txn-phase">
      <span className="lbl"><Icon size={14} aria-hidden="true" /> {phase.label}</span>
      <span className="rng tnum">turns {phase.from}–{phase.to}{phase.errors ? ` · ${phase.errors} error` : ''}</span>
    </div>
  )
}

function TaskBoundary({ task }) {
  const meta = [
    task.durationMs ? formatDuration(task.durationMs) : null,
    task.tools != null ? `${task.tools} tools` : null,
    task.stat || null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="txn-taskboundary">
      <span className="txn-tb-chip">user turn {task.index}</span>
      {meta && <span className="txn-tb-meta tnum">{meta}</span>}
    </div>
  )
}

function CheckpointMarker({ commit }) {
  // render the +adds −dels · N files stat when the cooked commit carries churn (render-when-present:
  // the adapter populates it from the input commit's churn when available, else hash + message only).
  const stat = commit.adds != null || commit.dels != null || commit.files != null
    ? `+${commit.adds ?? 0} −${commit.dels ?? 0}${commit.files != null ? ` · ${commit.files} files` : ''}`
    : null
  return (
    <div className="marker txn-checkpoint">
      <span className="r" />
      <span className="mkc">
        <GitCommitHorizontal size={14} aria-hidden="true" />
        <span className="hash mono">{commit.shortHash ?? commit.hash}</span>
        <span className="txn-cp-msg">{commit.message}</span>
        {stat && <span className="txn-cp-stat tnum">{stat}</span>}
      </span>
      <span className="r" />
    </div>
  )
}

/**
 * @param {TranscriptViewerProps} props
 */
export default function TranscriptViewer({
  viewModel,
  capabilities,
  callbacks = {},
  theme: themeProp,
  onThemeChange,
  graphSlot,
  activeTab: activeTabProp,
  onTabChange,
  viewMode: viewModeProp,
  onViewModeChange,
  leftRailOpen: leftRailOpenProp,
  onLeftRailOpenChange,
  rightRailOpen: rightRailOpenProp,
  onRightRailOpenChange,
  openTools: openToolsProp,
  onOpenToolsChange,
  initialPosition: initialPositionProp,
  activeTurn: activeTurnProp,
  onActiveTurnChange,
  search: searchProp,
  onSearchChange,
  filters: filtersProp,
  onFiltersChange,
  savedLabels: savedLabelsProp,
  onSavedLabelsChange,
  shareOpen: shareOpenProp,
  onShareOpenChange,
  moreOpen: moreOpenProp,
  onMoreOpenChange,
  breadcrumb,
  LinkComponent,
  renderTurnPanel,
  renderTurnActions,
  anchorHref,
  headerActions,
  streamPrelude,
}) {
  const vm = viewModel
  const caps = capabilities ?? {}

  /* ── controllable view state (each works unmanaged via its default) ─────────── */
  const [theme] = useControllable(themeProp, onThemeChange, 'dark')
  const [tab, setTab] = useControllable(activeTabProp, onTabChange, 'trace')
  const [viewMode, setViewMode] = useControllable(viewModeProp, onViewModeChange, 'list')
  const [leftRailOpen, setLeftRailOpen] = useControllable(leftRailOpenProp, onLeftRailOpenChange, true)
  const [rightRailOpen, setRightRailOpen] = useControllable(rightRailOpenProp, onRightRailOpenChange, true)
  const [openTools, setOpenTools] = useControllable(openToolsProp, onOpenToolsChange, {})
  const [activeTurn, setActiveTurn] = useControllable(activeTurnProp, onActiveTurnChange, vm?.turns?.[0]?.index ?? 0)
  const [query, setQuery] = useControllable(searchProp, onSearchChange, '')
  const [filters, setFilters] = useControllable(filtersProp, onFiltersChange, DEFAULT_FILTERS)
  const [savedLabels, setSavedLabels] = useControllable(savedLabelsProp, onSavedLabelsChange, {})
  // the action-menu disclosures are view-state too (controllable; default CLOSED).
  const [shareOpen, setShareOpen] = useControllable(shareOpenProp, onShareOpenChange, false)
  const [moreOpen, setMoreOpen] = useControllable(moreOpenProp, onMoreOpenChange, false)

  /* ── local (non-exposed) UI state ───────────────────────────────────────────── */
  const [copiedTurn, setCopiedTurn] = useState(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [labelFor, setLabelFor] = useState(null)
  const [sticky, setSticky] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [matchIdx, setMatchIdx] = useState(0)
  const [diffMode, setDiffMode] = useState('file')
  const [diffGroupsOpen, setDiffGroupsOpen] = useState({}) // path -> open? (default open)
  const [fileSort, setFileSort] = useState({ key: 'path', dir: 'asc' })
  /** @type {[TranscriptReturnTarget | null, (value: TranscriptReturnTarget | null) => void]} */
  const [returnTarget, setReturnTarget] = useState(null)

  const turnRefs = useRef({})
  const scrollRef = useRef(null)
  const searchInputRef = useRef(null)
  const draggingRef = useRef(false)
  const tabRefs = useRef({})
  const returnTargetIdRef = useRef(0)

  const registerRef = useCallback((id, el) => {
    if (el) turnRefs.current[id] = el
    else delete turnRefs.current[id]
  }, [])

  const toggleTool = (id) => setOpenTools({ ...openTools, [id]: !openTools[id] })

  /* ── cooked slices off the VM ───────────────────────────────────────────────── */
  const session = vm?.session ?? {}
  const turns = vm?.turns ?? []
  const phases = vm?.analytics?.phases ?? []
  const tasks = vm?.tasks ?? []
  const files = vm?.files ?? []
  const diffs = vm?.diffs ?? []
  const highlights = vm?.highlights ?? []
  const scorecardBands = vm?.analytics?.scorecardBands ?? []
  const commits = session?.git?.commits ?? []
  const annotations = vm?.analytics?.patternAnnotations ?? turns.flatMap((t) => t.annotations ?? [])
  const toolGroupCounts = vm?.filterIndex?.toolGroupCounts ?? {}

  /* user-prompt → its task (a task's first turn is its user prompt). */
  const taskByFirstTurn = useMemo(() => {
    const m = new Map()
    for (const t of tasks) { const first = t.turnIndices?.[0]; if (first != null) m.set(first, t) }
    return m
  }, [tasks])

  /* ── capability-gated callbacks (an affordance is wired ONLY when its flag is true) ── */
  const canLabel = !!caps.canLabel
  const labelTurn = canLabel ? (idx) => setLabelFor(idx) : undefined

  /* ── filtered turn set (categories gate kinds; tags AND; checkpoint scopes) ──── */
  const visibleTurns = useMemo(() => {
    const { categories, tags, checkpoint } = filters
    const selCommit = checkpoint !== 'all' ? commits.find((c) => c.shortHash === checkpoint || c.hash === checkpoint) : null
    const cpTurn = selCommit?.turn // the adapter-joined turn anchor (optional); scopes only when present
    return turns.filter((t) => {
      if (t.role === 'user' && !categories.prompts) return false
      if (t.role === 'assistant' && !categories.responses) return false
      if (tags.errors && !t.isError && !(t.toolCalls && t.toolCalls.some((x) => x.isError))) return false
      if (cpTurn != null && t.index > cpTurn) return false
      return true
    })
  }, [turns, filters, commits])

  const captureTraceReturnTarget = useCallback(() => {
    if (tab !== 'trace' || viewMode !== 'list') return
    const sc = scrollRef.current
    if (!sc) return
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null
    const focusOrigin = activeElement && sc.contains(activeElement)
      ? { kind: 'scroller' }
      : { kind: 'tab', tab: 'trace' }
    returnTargetIdRef.current += 1
    setReturnTarget({
      sourceView: 'trace',
      sourceMode: 'list',
      scrollTop: sc.scrollTop,
      focusOrigin,
      requestKey: `trace-return-${returnTargetIdRef.current}`,
    })
  }, [tab, viewMode])

  const selectTab = useCallback((nextTab) => {
    if (nextTab === 'files' || nextTab === 'diffs') captureTraceReturnTarget()
    setTab(nextTab)
  }, [captureTraceReturnTarget, setTab])

  const applyInitialPosition = useCallback((position) => {
    const sc = scrollRef.current
    const el = position.kind === 'turn' ? turnRefs.current[position.turnIndex] : null
    const result = transcriptInitialPositionReadiness(position, {
      authoritativeTurnIndices: turns.map((turn) => turn.index),
      renderedTurnIndices: visibleTurns.map((turn) => turn.index),
      viewReady: tab === 'trace' && viewMode === 'list',
      scrollerReady: sc != null,
      targetReady: position.kind === 'top' || el != null,
    })
    if (result !== 'applied') return result

    if (position.kind === 'top') {
      sc.scrollTo({ top: 0, behavior: 'auto' })
      return 'applied'
    }

    el.scrollIntoView({ block: 'start', behavior: 'auto' })
    return 'applied'
  }, [tab, turns, viewMode, visibleTurns])

  const applyReturnPosition = useCallback((position) => {
    const target = returnTarget
    if (!target || position.requestKey !== target.requestKey) return 'discarded'
    const sc = scrollRef.current
    const result = transcriptInitialPositionReadiness(position, {
      authoritativeTurnIndices: turns.map((turn) => turn.index),
      renderedTurnIndices: visibleTurns.map((turn) => turn.index),
      viewReady: tab === target.sourceView && viewMode === target.sourceMode,
      scrollerReady: sc != null,
      targetReady: true,
    })
    if (result !== 'applied') return result

    sc.scrollTo({ top: target.scrollTop, behavior: 'auto' })
    if (target.focusOrigin.kind === 'scroller') sc.focus({ preventScroll: true })
    else tabRefs.current[target.focusOrigin.tab]?.focus({ preventScroll: true })
    return 'applied'
  }, [returnTarget, tab, turns, viewMode, visibleTurns])

  useTranscriptInitialPosition({
    sessionId: session?.id,
    initialPosition: initialPositionProp,
    legacyInitialPosition: activeTurnProp == null ? null : { kind: 'turn', turnIndex: activeTurnProp },
    readiness: [tab, viewMode, turns, visibleTurns],
    apply: applyInitialPosition,
  })

  useTranscriptInitialPosition({
    sessionId: session?.id,
    initialPosition: returnTarget ? { kind: 'top', requestKey: returnTarget.requestKey } : null,
    readiness: [returnTarget?.requestKey, tab, viewMode, turns, visibleTurns],
    apply: applyReturnPosition,
  })

  /* category + tool-group counts the FiltersRail shows. */
  const counts = useMemo(() => ({
    categories: {
      prompts: turns.filter((t) => t.role === 'user').length,
      responses: turns.filter((t) => t.role === 'assistant').length,
      thinking: turns.filter((t) => t.thinking).length,
      toolcalls: turns.reduce((n, t) => n + (t.toolCalls ? t.toolCalls.length : 0), 0),
    },
    toolGroups: toolGroupCounts,
  }), [turns, toolGroupCounts])

  const filtersActive =
    (filters.categories.prompts ? 0 : 1) +
    (filters.categories.responses ? 0 : 1) +
    (filters.categories.thinking ? 0 : 1) +
    (filters.categories.toolcalls ? 0 : 1) +
    (filters.tags.errors ? 1 : 0) +
    (filters.tags.retries ? 1 : 0) +
    (filters.tags.revert ? 1 : 0) +
    Object.values(filters.toolGroups).filter((v) => !v).length

  /* search matches: substring across turn content + tool previews/output. */
  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const found = []
    for (const t of turns) {
      if ((t.content || '').toLowerCase().includes(q)) found.push({ turn: t.index, where: 'body' })
      for (const tc of t.toolCalls || []) {
        const out = typeof tc.output === 'string' ? tc.output : tc.output != null ? JSON.stringify(tc.output) : ''
        const hay = [tc.preview, out].filter(Boolean).join(' ').toLowerCase()
        if (hay.includes(q)) found.push({ turn: t.index, where: tc.id })
      }
    }
    return found
  }, [query, turns])

  const progress = useMemo(() => {
    const idx = visibleTurns.findIndex((t) => t.index === activeTurn)
    return { cur: Math.max(1, idx + 1), total: visibleTurns.length }
  }, [activeTurn, visibleTurns])

  /* ── navigation + interactions (effects/handlers only; safe under static render) ── */
  function jumpTo(idx, { switchTab = true } = {}) {
    if (switchTab && tab !== 'trace') setTab('trace')
    setViewMode('list')
    setActiveTurn(idx)
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        const el = turnRefs.current[idx]
        const sc = scrollRef.current
        if (el && sc) {
          const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
          sc.scrollTo({ top: el.offsetTop - 12, behavior: reduce ? 'auto' : 'smooth' })
        }
      })
    }
  }
  function stepTurn(dir) {
    const ids = visibleTurns.map((t) => t.index)
    const cur = ids.indexOf(activeTurn)
    const next = Math.max(0, Math.min(ids.length - 1, cur + dir))
    if (ids[next] != null) jumpTo(ids[next], { switchTab: false })
  }
  function copyAnchor(idx) {
    setCopiedTurn(idx)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      // Hosts with real routes supply anchorHref so a copied turn link is a
      // working permalink; a root-relative return is absolutized against the
      // page so the clipboard always holds something shareable. The bare
      // '#turn-N' default is the demo's (no router to link into).
      let text = '#turn-' + idx
      if (anchorHref) {
        const href = anchorHref(idx)
        text = href.startsWith('/') && typeof window !== 'undefined'
          ? window.location.origin + href
          : href
      }
      navigator.clipboard.writeText(text).catch(() => {})
    }
    setTimeout(() => setCopiedTurn((c) => (c === idx ? null : c)), 1500)
  }
  function copyLink() {
    setCopiedLink(true)
    callbacks.onCopyLink && callbacks.onCopyLink()
    setTimeout(() => setCopiedLink(false), 1500)
  }
  function saveLabel(outcome, flag) {
    if (labelFor == null) return
    const label = { outcome, flag }
    setSavedLabels({ ...savedLabels, [labelFor]: label })
    callbacks.onLabel && callbacks.onLabel(labelFor, label)
    setLabelFor(null)
  }
  function onScroll() {
    const sc = scrollRef.current
    if (!sc) return
    setSticky(sc.scrollTop > 56)
    let best = visibleTurns[0]?.index ?? 0
    for (const t of visibleTurns) {
      const el = turnRefs.current[t.index]
      if (el && el.offsetTop - sc.scrollTop <= sc.clientHeight * 0.4) best = t.index
    }
    setActiveTurn(best)
  }

  function openFile(file) {
    if (file.edited) selectTab('diffs')
    else jumpTo(file.turn ?? 0)
  }

  function onFileKeyDown(event, file) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openFile(file)
  }

  function returnToSource() {
    if (!returnTarget) return
    setTab(returnTarget.sourceView)
    setViewMode(returnTarget.sourceMode)
  }
  function seekScrub(clientX, track) {
    const rect = track.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const last = turns.length - 1
    const i = last > 0 ? Math.round(frac * last) : 0
    const t = turns[i]
    if (!t) return
    const el = turnRefs.current[t.index]
    const sc = scrollRef.current
    if (el && sc) { sc.scrollTo({ top: el.offsetTop - 12, behavior: 'auto' }); setActiveTurn(t.index) }
  }
  const onTabKey = (e) => {
    const i = TAB_ORDER.indexOf(tab)
    if (i < 0) return
    let j = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % TAB_ORDER.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + TAB_ORDER.length) % TAB_ORDER.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = TAB_ORDER.length - 1
    else return
    e.preventDefault()
    selectTab(TAB_ORDER[j])
    tabRefs.current[TAB_ORDER[j]]?.focus()
  }

  /* cmd/ctrl+F search + j/k step (browser only; no-op under static render). */
  useEffect(() => {
    function onKey(e) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault(); setSearchOpen(true); setTab('trace')
        setTimeout(() => searchInputRef.current?.focus(), 0); return
      }
      if (e.key === 'Escape' && searchOpen) { setSearchOpen(false); return }
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')
      if (searchOpen || typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (tab !== 'trace' || viewMode !== 'list') return
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); stepTurn(1) }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); stepTurn(-1) }
    }
    if (typeof window === 'undefined') return undefined
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen, tab, viewMode, activeTurn, visibleTurns])

  /* scroll the active match into view (browser only). */
  useEffect(() => {
    if (!searchOpen || matches.length === 0) return
    const m = matches[Math.min(matchIdx, matches.length - 1)]
    const el = turnRefs.current[m.turn]
    const sc = scrollRef.current
    if (el && sc) {
      const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      sc.scrollTo({ top: el.offsetTop - 12, behavior: reduce ? 'auto' : 'smooth' })
      setActiveTurn(m.turn)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIdx, matches, searchOpen])

  /* files / diffs derived. */
  const sortedFiles = useMemo(() => {
    const arr = [...files]
    arr.sort((a, b) => {
      const cmp = fileSort.key === 'path' ? a.path.localeCompare(b.path) : a.adds + a.dels - (b.adds + b.dels)
      return fileSort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [files, fileSort])
  const diffsByPath = useMemo(() => {
    const m = new Map()
    for (const d of diffs) { if (!m.has(d.path)) m.set(d.path, []); m.get(d.path).push(d) }
    return [...m.entries()]
  }, [diffs])

  /* commits split into per-turn-anchored (the adapter joined commitTime→turn) vs end-cluster
     (no anchor available — e.g. turns without parseable timestamps). */
  const anchoredCommits = commits.filter((c) => c.turn != null)
  const looseCommits = commits.filter((c) => c.turn == null)

  // prefer a curated session title (editorial summary); else derive one from the first task / prompt.
  // Session titles are frequently a whole first prompt — bound the hero to
  // 160 characters so a run-on title cannot swallow the header (the
  // pre-composite viewers truncated; consumers rely on it).
  const rawTitle = session.title ?? tasks[0]?.prompt ?? turns.find((t) => t.role === 'user')?.content ?? session.id ?? 'transcript'
  // codePointAt guard: never slice through a surrogate pair (mojibake before the ellipsis).
  const cut = (rawTitle.codePointAt(158) ?? 0) > 0xffff ? 158 : 159
  const title = rawTitle.length > 160 ? rawTitle.slice(0, cut).trimEnd() + '…' : rawTitle

  return (
    <div className={'txn-app' + (theme === 'light' ? ' txn-light' : '')} data-theme={theme}>
      {/* ===================== HEADER ===================== */}
      <header className="txn-header">
        <div className="txn-header-top">
          {/* Host-routable trail: pass `breadcrumb` (+ a router LinkComponent) to
              replace the demo's static sessions/{project}/{id} crumb — hosts have
              real routes and origin-aware trails (map · node > project > id). */}
          <nav className="crumb txn-crumb" aria-label="breadcrumb">
            {(breadcrumb ?? [
              { label: 'sessions', href: '#' },
              { label: session.project ?? 'session', href: '#' },
              { label: session.id },
            ]).map((item, i, items) => {
              const CrumbLink = LinkComponent ?? 'a'
              const last = i === items.length - 1
              return (
                <Fragment key={`${item.label}-${i}`}>
                  {i > 0 && <ChevronRight size={13} aria-hidden="true" />}
                  {!last && item.href != null
                    ? <CrumbLink className="link" href={item.href}>{item.label}</CrumbLink>
                    : <span className={last ? 'cur' : 'link'}>{item.label}</span>}
                </Fragment>
              )
            })}
          </nav>

          <div className="txn-actions">
            {/* host session-level actions (attest etc.) lead the row — the
                composite's fixed capability set stays the shared tail */}
            {headerActions}
            <div className="menu-anchor">
              <button
                type="button"
                className="btn btn-secondary btn-sm menu-trigger"
                aria-expanded={shareOpen}
                aria-haspopup="menu"
                onClick={() => { setShareOpen((o) => !o); setMoreOpen(false) }}
              >
                <Share2 size={14} aria-hidden="true" /> share
                <ChevronDown size={13} aria-hidden="true" className="menu-caret" />
              </button>
              {shareOpen && (
                <div className="menu-pop menu-float" data-align="end" role="menu" aria-label="share">
                  <ul className="menu-list">
                    {caps.canContribute && (
                      <li><button type="button" className="menu-item" role="menuitem" onClick={() => { setShareOpen(false); callbacks.onContribute && callbacks.onContribute() }}><Users size={14} aria-hidden="true" /><span className="menu-text">contribute</span></button></li>
                    )}
                    <li>
                      <button type="button" className="menu-item" role="menuitem" onClick={() => { setShareOpen(false); copyLink() }}>
                        {copiedLink ? <Check size={14} aria-hidden="true" /> : <LinkIcon size={14} aria-hidden="true" />}
                        <span className="menu-text">{copiedLink ? 'copied' : 'copy link'}</span>
                      </button>
                    </li>
                    {caps.canChangeVisibility && (
                      <li><button type="button" className="menu-item" role="menuitem" onClick={() => { setShareOpen(false); callbacks.onChangeVisibility && callbacks.onChangeVisibility() }}><Eye size={14} aria-hidden="true" /><span className="menu-text">visibility</span></button></li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="menu-anchor">
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-icon menu-trigger"
                aria-label="more actions"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => { setMoreOpen((o) => !o); setShareOpen(false) }}
              >
                <MoreHorizontal size={14} aria-hidden="true" />
              </button>
              {moreOpen && (
                <div className="menu-pop menu-float txn-more-pop" data-align="end" role="menu" aria-label="more actions">
                  <ul className="menu-list">
                    {caps.canEdit && (
                      <li><button type="button" className="menu-item" role="menuitem" onClick={() => { setMoreOpen(false); callbacks.onEdit && callbacks.onEdit() }}><Pencil size={14} aria-hidden="true" /><span className="menu-text">edit</span></button></li>
                    )}
                    {caps.canExport && (
                      <>
                        {caps.canEdit && <li role="separator"><hr className="menu-sep" /></li>}
                        <li className="menu-cap">download</li>
                        {['json', 'jsonl', 'markdown'].map((fmt) => (
                          <li key={fmt}><button type="button" className="menu-item" role="menuitem" onClick={() => { setMoreOpen(false); callbacks.onExport && callbacks.onExport(/** @type {'json'|'jsonl'|'markdown'} */ (fmt)) }}><Download size={14} aria-hidden="true" /><span className="menu-text">{fmt}</span></button></li>
                        ))}
                      </>
                    )}
                    <li role="separator"><hr className="menu-sep" /></li>
                    <li><button type="button" className="menu-item" role="menuitem" onClick={() => setMoreOpen(false)}><MessageSquareText size={14} aria-hidden="true" /><span className="menu-text">chat with trace</span></button></li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <h2 className="txn-title" title={title}>{title}</h2>

        <div className="txn-meta chips">
          {session.outcome && <span className="chip chip-ok" title={'outcome · ' + session.outcome}><ShieldCheck size={14} aria-hidden="true" /> {session.outcome}</span>}
          {session.harness && <span className="chip"><ProviderIcon harness={session.harness} accent /> {String(session.harness).replace(/-/g, ' ')}</span>}
          {session.model && <span className="chip mono">{session.model}</span>}
          {session.git?.author && <span className="metaitem" title="author"><User size={14} aria-hidden="true" /> {session.git.author}</span>}
          {session.durationMins != null && <span className="metaitem" title="session duration"><Clock size={14} aria-hidden="true" /> <b className="tnum">{session.durationMins}m</b></span>}
          {session.turnCount != null && <span className="metaitem"><ListTree size={14} aria-hidden="true" /> <b className="tnum">{session.turnCount}</b> turns</span>}
          {session.toolCallCount != null && <span className="metaitem"><Wrench size={14} aria-hidden="true" /> <b className="tnum">{session.toolCallCount}</b> tools</span>}
          {session.totalTokens != null && <span className="metaitem" title={fmtTokens(session.tokensIn ?? 0) + ' in · ' + fmtTokens(session.tokensOut ?? 0) + ' out'}><Coins size={14} aria-hidden="true" /> <b className="tnum">{fmtTokens(session.totalTokens)}</b> tokens</span>}
          {commits.length > 0 && <span className="metaitem"><GitCommitHorizontal size={14} aria-hidden="true" /> <b className="tnum">{commits.length}</b> {commits.length === 1 ? 'commit' : 'commits'}</span>}
          {session.git?.filesChanged != null && <span className="metaitem"><FileText size={14} aria-hidden="true" /> <b className="tnum">{session.git.filesChanged}</b> {session.git.filesChanged === 1 ? 'file' : 'files'}</span>}
          {session.git && (session.git.insertions != null || session.git.deletions != null) && (
            <span className="metaitem txn-churn-meta tnum"><span className="txn-churn-add">+{session.git.insertions ?? 0}</span> <span className="txn-churn-del">−{session.git.deletions ?? 0}</span></span>
          )}
        </div>
      </header>

      {/* ===================== TAB STRIP ===================== */}
      <div className="tabs txn-tabs" role="tablist" aria-label="session views" onKeyDown={onTabKey}>
        {TAB_ORDER.map((id) => {
          const on = tab === id
          const count = id === 'highlights' ? highlights.length
            : id === 'trace' ? turns.length
            : id === 'diffs' ? diffs.length
            : id === 'files' ? files.length
            : annotations.length
          return (
            <button
              key={id}
              ref={(el) => (tabRefs.current[id] = el)}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              className={'tab txn-tab' + (on ? ' active' : '')}
              onClick={() => selectTab(id)}
            >
              {TAB_LABEL[id]} <span className="cnt tnum">{count}</span>
            </button>
          )
        })}
      </div>

      {/* ===================== BODY ===================== */}
      <div className="txn-body-grid" data-left-rail={leftRailOpen ? 'open' : 'closed'} data-right-rail={rightRailOpen ? 'open' : 'closed'}>
        {/* LEFT: outline */}
        {leftRailOpen ? (
          <aside className="txn-rail txn-rail-left" aria-label="user turns outline">
            <div className="txn-rail-head">
              <LayoutList size={13} aria-hidden="true" /> user turns
              <button type="button" className="txn-rail-collapse" aria-label="collapse user turns outline" title="collapse" onClick={() => setLeftRailOpen(false)}>
                <PanelLeftClose size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="txn-rail-body" id="txn-rail-left-body">
              <OutlineRail viewModel={vm} tab={tab} onJump={(idx) => jumpTo(idx, { switchTab: false })} />
            </div>
          </aside>
        ) : (
          <div className="txn-rail-strip txn-rail-strip-left">
            <button type="button" className="txn-rail-reopen" aria-label="expand user turns outline" title="expand user turns" onClick={() => setLeftRailOpen(true)}>
              <PanelLeftOpen size={14} aria-hidden="true" />
              <span className="txn-rail-strip-label">user turns</span>
            </button>
          </div>
        )}

        {/* CENTER */}
        <section className="txn-center" role="tabpanel" aria-label={tab}>
          {tab === 'trace' && (
            <div className={'txn-trace' + (sticky && viewMode === 'list' ? ' txn-trace-pinned' : '')}>
              {sticky && viewMode === 'list' && (
                <div className="txn-sticky">
                  {session.harness && <ProviderIcon harness={session.harness} accent />}
                  {session.model && <span className="txn-sticky-model mono">{session.model}</span>}
                  <Scrubber turns={turns} active={activeTurn} onSeek={seekScrub} draggingRef={draggingRef} />
                </div>
              )}
              <div className="txn-trace-head">
                <span className="txn-trace-count tnum">
                  {visibleTurns.length === turns.length ? `${turns.length} turns` : `${visibleTurns.length} of ${turns.length} turns`}
                </span>
                <div className="bs-seg txn-viewtoggle" role="group" aria-label="view mode">
                  <button type="button" className="bs-seg-opt" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}><List size={14} aria-hidden="true" /> list</button>
                  <button type="button" className="bs-seg-opt" aria-pressed={viewMode === 'graph'} onClick={() => setViewMode('graph')}><Network size={14} aria-hidden="true" /> graph</button>
                </div>
              </div>

              {viewMode === 'graph' ? (
                <div className="txn-graphslot">
                  {graphSlot
                    ? graphSlot({ viewModel: vm, activeTurn, onSelectTurn: (idx) => setActiveTurn(idx) })
                    : <div className="empty"><div className="ring"><Network size={20} aria-hidden="true" /></div><h3>no graph engine</h3><p>pass a <code>graphSlot</code> render-prop to plug a trajectory graph.</p></div>}
                </div>
              ) : (
                <div className="txn-streamwrap">
                  <div className="txn-stream" ref={scrollRef} onScroll={onScroll} tabIndex={-1}>
                    {streamPrelude != null && (
                      <div className="txn-stream-prelude">{streamPrelude}</div>
                    )}
                    {visibleTurns.length === 0 && (
                      <div className="empty"><div className="ring"><FilterIcon size={20} aria-hidden="true" /></div><h3>no turns to display</h3><p>every turn is filtered out. clear a filter to bring them back.</p></div>
                    )}
                    {visibleTurns.map((t, i) => {
                      const prev = visibleTurns[i - 1]
                      const phase = phases.find((p) => t.index >= p.from && t.index <= p.to)
                      const prevPhase = prev ? phases.find((p) => prev.index >= p.from && prev.index <= p.to) : null
                      const showPhase = filters.views.hidden && phase && (!prevPhase || prevPhase.id !== phase.id)
                      const task = taskByFirstTurn.get(t.index)
                      const turnCommits = anchoredCommits.filter((c) => c.turn === t.index)
                      return (
                        <div key={t.index}>
                          {showPhase && <PhaseDivider phase={phase} />}
                          {t.role === 'user' && task && <TaskBoundary task={task} />}
                          <TurnCard
                            turn={t}
                            active={activeTurn === t.index}
                            openTools={openTools}
                            toggleTool={toggleTool}
                            onCopyAnchor={copyAnchor}
                            copied={copiedTurn === t.index}
                            registerRef={registerRef}
                            onLabel={labelTurn}
                            renderActions={renderTurnActions}
                            savedLabel={savedLabels[t.index]}
                            compact={filters.views.compact}
                            expandAll={filters.views.expandAll}
                          />
                          {/* host per-turn extension (touched-files panels etc.) —
                              rendered under the card, inside the turn's anchor block */}
                          {renderTurnPanel ? renderTurnPanel(t) : null}
                          {turnCommits.map((c) => <CheckpointMarker key={c.hash} commit={c} />)}
                        </div>
                      )
                    })}
                    {looseCommits.map((c) => <CheckpointMarker key={c.hash} commit={c} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'highlights' && (
            <div className="txn-highlights">
              <Scorecard bands={scorecardBands} />
              <div className="txn-hl-cards">
                {highlights.map((h) => {
                  const Icon = HIGHLIGHT_ICON[h.kind] ?? Sparkles
                  const isStatic = h.kind === 'checkpoint'
                  return (
                    <button key={h.id} type="button" className={'txn-hl-card' + (isStatic ? ' txn-hl-static' : '')} disabled={isStatic} onClick={() => !isStatic && jumpTo(h.turn)}>
                      <span className={'txn-hl-ico' + (h.err ? ' txn-hl-err' : '')}>
                        {h.kind === 'final' && session.harness ? <ProviderIcon harness={session.harness} accent /> : <Icon size={15} aria-hidden="true" />}
                      </span>
                      <span className="txn-hl-text">
                        <span className="txn-hl-title">{h.title}{h.tag && <span className="txn-hl-tag">{h.tag}</span>}</span>
                        {h.sub && <span className="txn-hl-sub">{h.sub}</span>}
                        {h.stat && <span className="txn-hl-stat tnum">{h.stat}</span>}
                      </span>
                      <span className="txn-hl-side">
                        {h.err && <span className="chip chip-err txn-pill"><AlertTriangle size={12} aria-hidden="true" /> failed</span>}
                        {h.tokens && <span className="txn-tokbadge tnum"><Coins size={12} aria-hidden="true" /> {h.tokens}</span>}
                        {h.time && <span className="txn-hl-time">{h.time}</span>}
                        {!isStatic && <ChevronRight size={14} aria-hidden="true" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'diffs' && (
            <div className="txn-diffs">
              <div className="txn-diffs-head">
                <span className="txn-diffs-count tnum">{diffs.length} {diffs.length === 1 ? 'edit' : 'edits'} across {diffsByPath.length} {diffsByPath.length === 1 ? 'file' : 'files'}</span>
                <div className="txn-diffs-actions">
                  <div className="bs-seg" role="group" aria-label="group diffs by">
                    <button type="button" className="bs-seg-opt" aria-pressed={diffMode === 'file'} onClick={() => setDiffMode('file')}>by file</button>
                    <button type="button" className="bs-seg-opt" aria-pressed={diffMode === 'turn'} onClick={() => setDiffMode('turn')}>by turn</button>
                  </div>
                  {returnTarget && (
                    <button type="button" className="txn-return" aria-label="return to trace" onClick={returnToSource}>
                      <RotateCcw size={13} aria-hidden="true" /> return to trace
                    </button>
                  )}
                </div>
              </div>
              {diffMode === 'file' ? (
                diffsByPath.map(([path, entries]) => {
                  const adds = entries.reduce((n, d) => n + d.adds, 0)
                  const dels = entries.reduce((n, d) => n + d.dels, 0)
                  const open = diffGroupsOpen[path] ?? true // file groups default open
                  return (
                    <div className="txn-filegroup" key={path}>
                      <button type="button" className="txn-fg-head" aria-expanded={open} onClick={() => setDiffGroupsOpen((m) => ({ ...m, [path]: !(m[path] ?? true) }))}>
                        {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                        <Pencil size={14} aria-hidden="true" />
                        <span className="mono txn-fg-path">{path}</span>
                        <span className="chipx-count">{entries.length} {entries.length === 1 ? 'edit' : 'edits'}</span>
                        <span className="txn-churn tnum"><span className="txn-churn-add">+{adds}</span> <span className="txn-churn-del">−{dels}</span></span>
                      </button>
                      {open && entries.map((d, i) => <DiffEntryCard key={i} entry={d} onJump={() => d.turn != null && jumpTo(d.turn)} />)}
                    </div>
                  )
                })
              ) : (
                <div className="txn-difflist">
                  {diffs.map((d, i) => <DiffEntryCard key={i} entry={d} byTurn onJump={() => d.turn != null && jumpTo(d.turn)} />)}
                </div>
              )}
            </div>
          )}

          {tab === 'files' && (
            <div className="txn-files">
              <div className="txn-files-head">
                <span className="txn-files-count tnum">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
                {returnTarget && (
                  <button type="button" className="txn-return" aria-label="return to trace" onClick={returnToSource}>
                    <RotateCcw size={13} aria-hidden="true" /> return to trace
                  </button>
                )}
              </div>
              <table className="dtable txn-filetable">
                <thead>
                  <tr>
                    <th><button type="button" className="txn-sort" onClick={() => setFileSort((s) => ({ key: 'path', dir: s.key === 'path' && s.dir === 'asc' ? 'desc' : 'asc' }))}>file {fileSort.key === 'path' ? (fileSort.dir === 'asc' ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />) : null}</button></th>
                    <th className="txn-files-churn-col"><button type="button" className="txn-sort" onClick={() => setFileSort((s) => ({ key: 'churn', dir: s.key === 'churn' && s.dir === 'asc' ? 'desc' : 'asc' }))}>lines +/− {fileSort.key === 'churn' ? (fileSort.dir === 'asc' ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />) : null}</button></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiles.map((f) => (
                    <tr
                      key={f.path}
                      className="txn-filerow"
                      tabIndex={0}
                      onClick={() => openFile(f)}
                      onKeyDown={(event) => onFileKeyDown(event, f)}
                      aria-label={f.edited ? `${f.path}, jump to diffs` : `${f.path}, jump to last read`}
                      title={f.edited ? 'jump to diffs' : 'jump to last read'}
                    >
                      <td>
                        <span className="txn-file-cell">
                          {f.edited ? <Pencil size={13} aria-hidden="true" /> : <FileText size={13} aria-hidden="true" />}
                          <span className="mono txn-file-path">…/{f.leaf}</span>
                          <span className="txn-file-counts tnum">{f.reads ? `${f.reads}r ` : ''}{f.edits ? `${f.edits}e ` : ''}{f.writes ? `${f.writes}w` : ''}</span>
                        </span>
                      </td>
                      <td className="txn-files-churn-col">
                        {f.adds || f.dels ? (
                          <span className="txn-churn tnum"><span className="txn-churn-add">+{f.adds}</span> <span className="txn-churn-del">−{f.dels}</span></span>
                        ) : (<span className="txn-readonly tnum" title="read-only, no edits">—</span>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'annotations' && (
            <div className="txn-annotations">
              <p className="txn-anno-intro">auto-detected friction moments: tool errors and non-zero exits, retry loops, edits that re-touch a file, and subagent spawns. click a row to jump to the turn.</p>
              {annotations.map((a) => {
                const meta = ANNOTATION_META[a.kind] ?? { label: a.kind, icon: AlertTriangle, chip: '', tip: a.kind }
                const Icon = meta.icon
                // the annotated turn's role is derived from the VM (not carried on the annotation).
                const annoRole = turns.find((t) => t.index === a.turn)?.role
                return (
                  <button key={a.id} type="button" className="txn-anno-row" onClick={() => jumpTo(a.turn)}>
                    <span className="txn-anno-turn tnum">turn {a.turn}{annoRole ? ' · ' + annoRole : ''}</span>
                    <span className={'chip txn-pill ' + meta.chip} title={meta.tip}><Icon size={12} aria-hidden="true" /> {meta.label}</span>
                    <span className="txn-anno-label">{a.label}</span>
                    {a.preview && <span className="txn-anno-preview mono">{a.preview}</span>}
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* RIGHT: filters */}
        {rightRailOpen ? (
          <aside className="txn-rail txn-rail-right" aria-label="filters">
            <div className="txn-rail-head">
              <SlidersHorizontal size={13} aria-hidden="true" /> filters
              {filtersActive > 0 && <span className="chipx-count unread tnum">{filtersActive}</span>}
              <button type="button" className="txn-rail-collapse" aria-label="collapse filters" title="collapse" onClick={() => setRightRailOpen(false)}>
                <PanelRightClose size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="txn-rail-body" id="txn-rail-right-body">
              <FiltersRail
                tab={tab}
                filters={filters}
                onFiltersChange={setFilters}
                counts={counts}
                checkpoints={commits}
                filtersActive={filtersActive}
                onClear={() => setFilters({ ...DEFAULT_FILTERS, toolGroups: Object.fromEntries(TOOL_GROUPS.map((id) => [id, true])) })}
                onJumpStart={() => jumpTo(visibleTurns[0]?.index ?? 0, { switchTab: false })}
                onJumpLatest={() => jumpTo(visibleTurns[visibleTurns.length - 1]?.index ?? 0, { switchTab: false })}
              />
            </div>
          </aside>
        ) : (
          <div className="txn-rail-strip txn-rail-strip-right">
            <button type="button" className="txn-rail-reopen" aria-label="expand filters" title="expand filters" onClick={() => setRightRailOpen(true)}>
              <PanelRightOpen size={14} aria-hidden="true" />
              <span className="txn-rail-strip-label">filters{filtersActive > 0 ? <span className="chipx-count unread tnum">{filtersActive}</span> : null}</span>
            </button>
          </div>
        )}
      </div>

      {/* ===================== OVERLAYS ===================== */}
      {searchOpen && (
        <div className="txn-search">
          <Search size={15} aria-hidden="true" className="txn-search-ico" />
          <input
            ref={searchInputRef}
            className="txn-search-input"
            placeholder="search across turns, tool args, and results…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setMatchIdx(0) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); setMatchIdx((i) => (matches.length ? (e.shiftKey ? (i - 1 + matches.length) % matches.length : (i + 1) % matches.length) : 0)) }
              if (e.key === 'Escape') setSearchOpen(false)
            }}
            aria-label="search transcript"
          />
          <span className="txn-search-count tnum">{matches.length ? `${matchIdx + 1}/${matches.length}` : '0 matches'}</span>
          <button type="button" className="txn-search-nav" aria-label="previous match" disabled={!matches.length} onClick={() => setMatchIdx((i) => (i - 1 + matches.length) % matches.length)}><ChevronUp size={14} aria-hidden="true" /></button>
          <button type="button" className="txn-search-nav" aria-label="next match" disabled={!matches.length} onClick={() => setMatchIdx((i) => (i + 1) % matches.length)}><ChevronDown size={14} aria-hidden="true" /></button>
          <kbd className="kbd-key txn-search-esc">esc</kbd>
          <button type="button" className="txn-search-x" aria-label="close search" onClick={() => setSearchOpen(false)}><X size={14} aria-hidden="true" /></button>
        </div>
      )}

      {tab === 'trace' && viewMode === 'list' && visibleTurns.length > 0 && (
        <div className="txn-progress tnum" aria-hidden="true">{progress.cur} of {progress.total}</div>
      )}

      {/* per-turn label popover — rendered ONLY when canLabel (capability-gated). */}
      {canLabel && labelFor != null && (
        <LabelPopover turnId={labelFor} current={savedLabels[labelFor]} onSave={saveLabel} onClose={() => setLabelFor(null)} />
      )}

      <div className="txn-hint">
        <kbd className="kbd-key">⌘</kbd><kbd className="kbd-key">f</kbd> search · <kbd className="kbd-key">j</kbd>/<kbd className="kbd-key">k</kbd> step turns
      </div>
    </div>
  )
}

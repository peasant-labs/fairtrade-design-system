import { formatCount } from '../format.js'
import { headingTag, pageHeadingLevel } from '../heading.js'
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight, ChevronDown, ChevronUp, Clock, Coins, ShieldCheck, FileText,
  Search, Pencil, ListTree, LayoutList, SlidersHorizontal, Share2, Users, User, Wrench,
  Link as LinkIcon, MoreHorizontal, Download, MessageSquareText, AlertTriangle,
  GitCommitHorizontal, List, Network, Eye,
  Filter as FilterIcon, FileSearch, Sparkles, Flag, Play, RefreshCw, RotateCcw,
  CornerDownRight, Check, X, PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen, Menu as MenuIcon,
} from 'lucide-react'
import ProviderIcon from '../ProviderIcon.jsx'
import { formatDurationMins, formatDurationMs } from './time.js'
import { TOOL_GROUPS } from './view-model.js'
import { categoryCounts, projectTurn } from './filters.js'
import { actionGroups } from './action-groups.js'
import { turnAtReadingLine } from './scroll-position.js'
import useReaderWidthAnchor from './useReaderWidthAnchor.js'
import TurnCard from './TurnCard.jsx'
import Collapsible from './Collapsible.jsx'
import TranscriptContext from './TranscriptContext.jsx'
import { UsageScopes } from './UsageDisclosure.jsx'
import DiffEntryCard from './DiffEntryCard.jsx'
import OutlineRail from './OutlineRail.jsx'
import FiltersRail from './FiltersRail.jsx'
import TranscriptMinimap from './Minimap.jsx'
import Scrubber from './Scrubber.jsx'
import Scorecard from './Scorecard.jsx'
import LabelPopover from './LabelPopover.jsx'
import TranscriptOutcomeChip from './OutcomeChip.jsx'
import useTranscriptInitialPosition from './useTranscriptInitialPosition.jsx'
import { transcriptInitialPositionReadiness } from './initial-position.js'
import { transcriptTitle } from './title.js'
import { Term } from '../Explainer.jsx'
import Tooltip from '../Tooltip.jsx'
import { toolStateKey } from './tool-state-key.js'
import { renderedSearchRanges, searchExpression } from './search-highlights.js'
import SearchHighlights from './SearchHighlights.jsx'

/* ───────────────────────────────────────────────────────────────────────────
   TranscriptViewer — the composite single-transcript surface (the headline)
   ─────────────────────────────────────────────────────────────────────────
   Lifted from the canonical mockup's `TranscriptApp` (src/mockups/inuse/
   TranscriptApp.jsx:880) into an EXPORTED, DUMB composite. It assembles the
   chrome + the canvas (the turn cards, or the consumer's `graphSlot` in graph
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
   (a consuming app plugs fairtrade's own `/graph` @xyflow engine; the mockup
   plugs SVG); no `@xyflow` dependency here.

   CHECKPOINTS: commits live outside the per-turn card; the composite draws
   them between turns from the cooked `session.git.commits` (render-when-present),
   anchored to a turn when the cooked commit carries one, else clustered at the end.

   PRESENTATION: `classic` is the report-style surface. `ledger` (the default) keeps
   the same state, callbacks and gating but swaps the chrome: a subtitle under the
   title, a title + visible-turns minimap in the pinned trace header instead of the
   provider/model + scrubber, and user-turn task cards in the left rail instead of the
   duration waterfall.
   ─────────────────────────────────────────────────────────────────────────── */

/** @typedef {import('./state-capabilities.js').TranscriptViewerProps} TranscriptViewerProps */
/** @typedef {import('./state-capabilities.js').TranscriptFilters} TranscriptFilters */
/** @typedef {{sessionId: string, scrollTop: number, focusOrigin: {kind: 'tab'} | {kind: 'scroller'} | {kind: 'descendant', turnIndex: number, control: 'anchor'}}} TraceReadingSnapshot */
/** @typedef {{sessionId: string, scrollTop: number, focusOrigin: {kind: 'tab'} | {kind: 'scroller'} | {kind: 'descendant', turnIndex: number, control: 'anchor'}, requestKey: string, restoreRequested: boolean}} TraceReadingPosition */


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

/* trace scroll offset past which the condensed scrubber header pins and the session
   header leaves; the slack is the extra stream overflow required before the header's
   height is released so the scroller cannot clamp back under the threshold. */
const STICKY_SCROLL_THRESHOLD = 56
const HERO_RELEASE_SLACK = 24

/* the reading column's width: any width from 600 to `full`, the whole content width of the
   stream (up to the lane that holds the zen control and the handle). There are no snaps: a drag
   rests wherever it is released, and the keyboard moves in READER_STEP increments. `full` is
   measured, so it follows a window resize or a rail opening and closing; a width dragged to the
   end is stored as `full` so it keeps following, while a narrower width stays the pixels chosen
   and renders at the space it has when that space shrinks below it. */
export const READER_FULL = 'full'
const READER_MIN = 600
const READER_STEP = 40
const DEFAULT_READER_WIDTH = 840
const DEFAULT_SIDEBAR_LAYOUT = Object.freeze({ outline: true, filters: true, host: true })

/** the widest the column can be: the measured full width, or the default before layout. */
function readerMaxPx(fullPx) {
  return Math.max(READER_MIN, fullPx ?? DEFAULT_READER_WIDTH)
}

/** clamp a pixel width to 600..full. Before layout only the minimum applies. */
function clampReaderPx(px, fullPx) {
  if (!Number.isFinite(px)) return DEFAULT_READER_WIDTH
  return Math.max(READER_MIN, fullPx == null ? px : Math.min(readerMaxPx(fullPx), px))
}

/** the pixel width a stored width renders at: `full` is the measured width (null before
    layout); a number is clamped to the space it has. */
function readerPxOf(width, fullPx) {
  if (width === READER_FULL) return fullPx
  return clampReaderPx(width, fullPx)
}

/** the width to store once a drag or a key lands: the end of the range is `full`, so it keeps
    following the space; anything narrower is the pixels themselves. */
function restingReaderWidth(px, fullPx) {
  const clamped = clampReaderPx(px, fullPx)
  return fullPx != null && clamped >= readerMaxPx(fullPx) ? READER_FULL : clamped
}

/** a host-supplied readerWidth: `full` stays full, a number is used as given (clamped when it
    renders), and a non-finite value falls back to the default. */
function normaliseReaderWidth(width) {
  if (width === READER_FULL) return READER_FULL
  return Number.isFinite(width) ? width : DEFAULT_READER_WIDTH
}

/** the stream's content width: its inner width less the inline padding that reserves the
    control lanes. Null when nothing has been laid out (a server render, jsdom). */
function measureReaderFull(stream) {
  if (!stream) return null
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(stream) : null
  const pad = (parseFloat(style?.paddingLeft) || 0) + (parseFloat(style?.paddingRight) || 0)
  const width = Math.floor((stream.clientWidth || 0) - pad)
  return width > 0 ? width : null
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
  categories: { prompts: true, responses: true, thinking: true, toolcalls: true, system: true },
  toolGroups: Object.fromEntries(TOOL_GROUPS.map((id) => [id, true])),
  tags: { errors: false, retries: false, revert: false },
  views: { hidden: true, expandAll: false, compact: false },
  checkpoint: 'all',
})

// Controlled hosts may recreate equivalent filter objects on every render.
const filterFingerprint = (filters) => JSON.stringify([
  ...['categories', 'toolGroups', 'tags', 'views'].map((key) => Object.entries(filters[key] ?? {}).sort(([a], [b]) => a.localeCompare(b))),
  filters.checkpoint,
])

/* ── between-turn markers (lifted from the mockup's inline trace markup so the .txn-* CSS matches
   exactly; the composite draws them, not the per-turn TurnCard) ─────────────────────────────── */

// Native focus and explicit turn navigation reserve the same sticky-heading space.
function turnScrollTop(scroller, turn) {
  const padding = Number.parseFloat(getComputedStyle(scroller).scrollPaddingTop)
  return turn.offsetTop - (Number.isFinite(padding) ? padding : 12)
}

function PhaseDivider({ phase, heading: Heading = 'h3' }) {
  const Icon = PHASE_ICON[phase.icon] ?? PHASE_ICON[phase.id] ?? Flag
  return (
    <div className="phase txn-phase">
      <Heading className="lbl"><Icon size={14} aria-hidden="true" /> {phase.label}</Heading>
      <span className="rng tnum">turns {phase.from + 1}–{phase.to + 1}{phase.errors ? `, ${phase.errors} error` : ''}</span>
    </div>
  )
}

function TaskBoundary({ task }) {
  const meta = [
    formatDurationMs(task.durationMs) || null,
    task.tools != null ? `${task.tools} tools` : null,
    task.stat || null,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <div className="txn-taskboundary">
      <span className="txn-tb-chip">user turn {task.index}</span>
      {meta && <span className="txn-tb-meta tnum">{meta}</span>}
    </div>
  )
}

function CheckpointMarker({ commit }) {
  // render the +adds −dels, N files stat when the cooked commit carries churn (render-when-present:
  // the adapter populates it from the input commit's churn when available, else hash + message only).
  const stat = commit.adds != null || commit.dels != null || commit.files != null
    ? `+${commit.adds ?? 0} −${commit.dels ?? 0}${commit.files != null ? `, ${commit.files} files` : ''}`
    : null
  return (
    <div className="marker txn-checkpoint">
      <span className="r" />
      <span className="mkc">
        <GitCommitHorizontal size={14} aria-hidden="true" />
        <span className="hash mono">{commit.shortHash ?? commit.hash}</span>
        <span className="txn-cp-msg mkc-msg">{commit.message}</span>
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
  sidebarLayout: sidebarLayoutProp,
  onSidebarLayoutChange,
  zen: zenProp,
  onZenChange,
  readerWidth: readerWidthProp,
  onReaderWidthChange,
  leftRailOpen: leftRailOpenProp,
  onLeftRailOpenChange,
  rightRailOpen: rightRailOpenProp,
  onRightRailOpenChange,
  openTools: openToolsProp,
  onOpenToolsChange,
  earlierHistoryOpen: earlierHistoryOpenProp,
  onEarlierHistoryOpenChange,
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
  breadcrumbContext,
  beforeHeader,
  LinkComponent,
  renderTurnPanel,
  renderTurnActions,
  anchorHref,
  headerActions,
  utilityActions,
  streamPrelude,
  showTail = false,
  showOutcome = true,
  showSearchTrigger = false,
  footer,
  presentation = 'ledger',
  subtitle,
  pullRequests,
  headingLevel,
}) {
  if (breadcrumb != null && breadcrumbContext != null) {
    throw new TypeError('TranscriptViewer cannot use breadcrumb and breadcrumbContext together; pass either a complete breadcrumb or ancestor context, not both.')
  }
  // the transcript's title is the page's h1 when the host mounts the viewer as the whole page; the
  // phases and the turns move up one level with it
  const pageLevel = pageHeadingLevel(headingLevel, 'TranscriptViewer')
  const TitleHeading = headingTag(pageLevel, 0)
  const PhaseHeading = headingTag(pageLevel, 1)
  const EmptyHeading = headingTag(pageLevel, 1)
  const vm = viewModel
  const tabsId = useId()
  const caps = capabilities ?? {}
  /* the ledger presentation is a CHROME switch only: same view state, same capabilities,
     same callbacks; the root class scopes the ledger CSS block. */
  const ledger = presentation === 'ledger'

  /* ── controllable view state (each works unmanaged via its default) ─────────── */
  const [theme] = useControllable(themeProp, onThemeChange, 'dark')
  const [tab, setTab] = useControllable(activeTabProp, onTabChange, 'trace')
  const [viewMode, setViewMode] = useControllable(viewModeProp, onViewModeChange, 'list')
  const [zen, setZen] = useControllable(zenProp, onZenChange, false)
  /* zen is a ledger reading mode; a host that passes the prop to classic changes nothing. */
  const zenActive = ledger && zen
  const [rawReaderWidth, setReaderWidth] = useControllable(readerWidthProp, onReaderWidthChange, DEFAULT_READER_WIDTH)
  /* the width the column and the separator actually report. A supplied readerWidth is
     normalised ONCE at this boundary and clamped to 600..full when it renders, never drawn
     raw; a live drag keeps its own pixel preview so the column follows the pointer.
     `readerFullPx` is the measured full width; `readerPx` is what the column renders at. */
  const [readerDragWidth, setReaderDragWidth] = useState(null)
  const [readerFullPx, setReaderFullPx] = useState(null)
  const readerStored = normaliseReaderWidth(rawReaderWidth)
  const readerPx = readerDragWidth ?? readerPxOf(readerStored, readerFullPx)
  const [openTools, setOpenTools] = useControllable(openToolsProp, onOpenToolsChange, {})
  const [earlierHistoryOpen, setEarlierHistoryOpen] = useControllable(earlierHistoryOpenProp, onEarlierHistoryOpenChange, {})
  const [activeTurn, setActiveTurn] = useControllable(activeTurnProp, onActiveTurnChange, vm?.turns?.[0]?.index ?? 0)
  const [query, setQuery] = useControllable(searchProp, onSearchChange, '')
  const [filters, setFilters] = useControllable(filtersProp, onFiltersChange, DEFAULT_FILTERS)
  const [savedLabels, setSavedLabels] = useControllable(savedLabelsProp, onSavedLabelsChange, {})
  // the action-menu disclosures are view-state too (controllable; default CLOSED).
  const [shareOpen, setShareOpen] = useControllable(shareOpenProp, onShareOpenChange, false)
  const [moreOpen, setMoreOpen] = useControllable(moreOpenProp, onMoreOpenChange, false)
  // Mobile overlays are transient and never update the persisted desktop rail layout.
  const [mobile, setMobile] = useState(false)
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const [mobileDrawer, setMobileDrawer] = useState(null)
  const [exitingMobileDrawer, setExitingMobileDrawer] = useState(null)
  const mobileDialogRef = useRef(null)
  const mobileOpenerRef = useRef(null)
  const mobileOutlineRef = useRef(null)
  const mobileFiltersRef = useRef(null)
  const mobileToolsRef = useRef(null)
  const mobileDrawerId = useId()
  const closeMobileDrawer = useCallback(() => {
    setExitingMobileDrawer(mobileDrawer)
    setMobileDrawer(null)
    requestAnimationFrame(() => mobileOpenerRef.current?.focus())
  }, [mobileDrawer])
  useEffect(() => {
    const dialog = mobileDialogRef.current
    if (!dialog) return
    if (mobileDrawer && !dialog.open) { setExitingMobileDrawer(null); dialog.showModal() }
    if (!mobileDrawer && dialog.open) {
      dialog.close()
    }
  }, [mobileDrawer])
  useEffect(() => {
    if (mobileDrawer || !exitingMobileDrawer) return
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      const panel = mobileDialogRef.current?.querySelector('.txn-mobile-drawer-panel')
      const animations = panel?.getAnimations().filter(a => a.transitionProperty === 'transform') ?? []
      Promise.all(animations.map(a => a.finished.catch(() => {}))).then(() => { if (!cancelled) setExitingMobileDrawer(null) })
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [mobileDrawer, exitingMobileDrawer])
  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 768px)')
    if (!media) return
    const onResize = () => { setMobile(!media.matches); if (media.matches) { setMobileDrawer(null); setMobileToolsOpen(false) } }
    onResize()
    media.addEventListener('change', onResize)
    return () => media.removeEventListener('change', onResize)
  }, [])
  useEffect(() => { setMobileDrawer(null); setMobileToolsOpen(false) }, [vm?.session?.id])
  useEffect(() => {
    if (!mobileToolsOpen) return
    const onKey = (event) => { if (event.key === 'Escape' && !event.defaultPrevented) { setMobileToolsOpen(false); mobileToolsRef.current?.focus() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileToolsOpen])
  useEffect(() => {
    if (!mobile) return
    const item = tabRefs.current[tab], strip = item?.parentElement
    if (!item || !strip) return
    const view = strip.getBoundingClientRect(), box = item.getBoundingClientRect()
    if (box.left < view.left) strip.scrollLeft -= view.left - box.left
    else if (box.right > view.right) strip.scrollLeft += box.right - view.right
  }, [mobile, tab])

  /* ── the sidebar layout view model ──────────────────────────────────────────
     Openness is USER STATE, never a function of the reading width. `sidebarLayout`
     is the single view model when supplied (it wins for `outline`, `filters` and
     `host`); the legacy left/right rail props remain per-rail aliases that win for
     their own rail. With neither supplied the internal default opens everything.
     Reading width never writes any of this: only an explicit rail action, or zen's
     own collapse/restore, does. */
  const [internalSidebarLayout, setInternalSidebarLayout] = useState(DEFAULT_SIDEBAR_LAYOUT)
  const sidebarLayout = useMemo(() => ({
    outline: leftRailOpenProp !== undefined ? leftRailOpenProp : (sidebarLayoutProp?.outline ?? internalSidebarLayout.outline),
    filters: rightRailOpenProp !== undefined ? rightRailOpenProp : (sidebarLayoutProp?.filters ?? internalSidebarLayout.filters),
    host: sidebarLayoutProp?.host ?? internalSidebarLayout.host,
  }), [leftRailOpenProp, rightRailOpenProp, sidebarLayoutProp, internalSidebarLayout])
  const leftRailOpen = sidebarLayout.outline
  const rightRailOpen = sidebarLayout.filters

  /* The layout an explicit action starts from. Event handlers are recreated each render,
     so the current render's layout is the truth; the ref exists for the zen layout effect,
     whose deps are the zen value alone (a width change must never re-run that snapshot). */
  const sidebarLayoutRef = useRef(sidebarLayout)
  sidebarLayoutRef.current = sidebarLayout
  const zenSnapshotRef = useRef(DEFAULT_SIDEBAR_LAYOUT)
  /* starts false so a host that MOUNTS the viewer already in zen still gets the collapse. */
  const previousZenRef = useRef(false)

  /** emit the FULL layout for one explicit rail action (or zen), and own the internal copy. */
  function commitSidebarLayout(partial) {
    const current = sidebarLayoutRef.current
    const next = { ...current, ...partial }
    if (sidebarLayoutProp === undefined) setInternalSidebarLayout(next)
    if (next.outline !== current.outline && onLeftRailOpenChange) onLeftRailOpenChange(next.outline)
    if (next.filters !== current.filters && onRightRailOpenChange) onRightRailOpenChange(next.filters)
    if (onSidebarLayoutChange) onSidebarLayoutChange(next)
  }

  /* Zen snapshots the exact layout on entry, collapses all three, and restores that same
     object on exit. Driven by the VALUE change, so an uncontrolled click and a controlled
     host prop both take this one path. A width change never touches the snapshot. */
  useLayoutEffect(() => {
    if (!ledger) return
    if (previousZenRef.current === zen) return
    previousZenRef.current = zen
    if (zen) {
      zenSnapshotRef.current = { ...sidebarLayoutRef.current }
      commitSidebarLayout({ outline: false, filters: false, host: false })
    } else {
      commitSidebarLayout(zenSnapshotRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zen, ledger])

  // Unmanaged disclosure state is session-local. Controlled hosts restore their
  // own saved map on Back and are not reset by this default behavior.
  useEffect(() => {
    if (earlierHistoryOpenProp === undefined) setEarlierHistoryOpen({})
  }, [vm?.session?.id])

  /* ── local (non-exposed) UI state ───────────────────────────────────────────── */
  const [copiedTurn, setCopiedTurn] = useState(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [labelFor, setLabelFor] = useState(null)
  const [sticky, setSticky] = useState(false)
  // The session header condenses to its breadcrumb + actions row once the trace is
  // scrolled past the sticky threshold: the title and meta chips leave, so the
  // condensed scrubber header does not stack under the full hero. It only condenses
  // when the stream keeps enough overflow after the released height reaches the
  // scroller; otherwise the browser would clamp scrollTop back under the threshold
  // and the hero would flicker.
  const [heroHidden, setHeroHidden] = useState(false)
  const heroCondensed = heroHidden && tab === 'trace' && viewMode === 'list'
  const [searchOpen, setSearchOpen] = useState(false)
  const [matchIdx, setMatchIdx] = useState(0)
  const [searchNavigation, setSearchNavigation] = useState(0)
  const [searchReveal, setSearchReveal] = useState(null)
  const [searchUnrendered, setSearchUnrendered] = useState(false)
  const [diffMode, setDiffMode] = useState('file')
  const [diffGroupsOpen, setDiffGroupsOpen] = useState({}) // path -> open? (default open)
  const [fileSort, setFileSort] = useState({ key: 'path', dir: 'asc' })
  /** @type {[TraceReadingPosition | null, (value: TraceReadingPosition | null) => void]} */
  const [traceReadingPosition, setTraceReadingPosition] = useState(null)

  const session = vm?.session ?? {}
  const turns = vm?.turns ?? []

  const turnRefs = useRef({})
  const actionRefs = useRef(new Map())
  const revealSequence = useRef(0)
  const scrollRef = useRef(null)
  const headerRef = useRef(null)
  const heroHeightRef = useRef(0)
  const searchInputRef = useRef(null)
  const draggingRef = useRef(false)
  const readerDragRef = useRef(null)
  const bodyGridRef = useRef(null)
  const railFocusRef = useRef(null)
  useLayoutEffect(() => {
    const side = railFocusRef.current
    if (!side) return
    railFocusRef.current = null
    const rail = bodyGridRef.current?.querySelector(`.txn-rail-${side}[aria-hidden="false"], .txn-rail-strip-${side}[aria-hidden="false"]`)
    rail?.querySelector('.txn-rail-collapse, .txn-rail-reopen')?.focus({ preventScroll: true })
  }, [leftRailOpen, rightRailOpen, zenActive])
  const activeTurnRef = useRef(activeTurn)
  const navigationTargetRef = useRef(null)
  useLayoutEffect(() => { activeTurnRef.current = activeTurn }, [activeTurn])
  useLayoutEffect(() => { navigationTargetRef.current = null }, [session.id])
  /* keep the `full` snap's width current: the stream's content width changes with the window
     and with every rail opening or closing, and a reader resting at full must follow it. */
  useEffect(() => {
    if (!ledger || tab !== 'trace' || viewMode !== 'list') return undefined
    const stream = scrollRef.current
    if (!stream) return undefined
    const update = () => setReaderFullPx((prev) => measureReaderFull(stream) ?? prev)
    update()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    observer?.observe(stream)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [ledger, tab, viewMode])
  const tabRefs = useRef({})
  const traceReadingPositionIdRef = useRef(0)
  /** @type {import('react').MutableRefObject<TraceReadingSnapshot | null>} */
  const latestTraceReadingSnapshotRef = useRef(null)
  const traceReadingPositionRef = useRef(null)
  const skipTraceRestoreRef = useRef(false)
  const previousTabRef = useRef(tab)
  const readingPositionSessionRef = useRef(session?.id ?? '')

  const registerRef = useCallback((id, el) => {
    if (el) turnRefs.current[id] = el
    else delete turnRefs.current[id]
  }, [])

  const toggleTool = (id) => setOpenTools(previous => ({ ...previous, [id]: !previous[id] }))
  const registerActionRef = useCallback((turn, where, el) => {
    const key = `${turn}:${where}`
    if (el) actionRefs.current.set(key, el)
    else actionRefs.current.delete(key)
  }, [])
  function revealAction(turn, where, { select = true, search = false, occurrence = 0 } = {}) {
    if (where !== 'body' && where !== 'thinking') {
      const call = turns.find(item => item.index === turn)?.toolCalls?.find(tool => tool.id === where || `source:${tool.sourceIndex}` === where)
      if (call) setOpenTools(previous => ({ ...previous, [toolStateKey(turn, call)]: true }))
    }
    setSearchReveal({ turn, where, select, search, occurrence, sequence: ++revealSequence.current })
  }

  /* ── cooked slices off the VM ───────────────────────────────────────────────── */
  const phases = vm?.analytics?.phases ?? []
  const tasks = vm?.tasks ?? []
  const files = vm?.files ?? []
  const diffs = vm?.diffs ?? []
  const highlights = vm?.highlights ?? []
  const scorecardBands = vm?.analytics?.scorecardBands ?? []
  const commits = session?.git?.commits ?? []
  const annotations = vm?.analytics?.patternAnnotations ?? turns.flatMap((t) => t.annotations ?? [])
  const toolGroupCounts = vm?.filterIndex?.toolGroupCounts ?? {}
  const activeModel = turns.find((turn) => turn.index === activeTurn)?.effectiveModel

  /* user-prompt → its task (a task's first turn is its user prompt). */
  const taskByFirstTurn = useMemo(() => {
    const m = new Map()
    for (const t of tasks) { const first = t.turnIndices?.[0]; if (first != null) m.set(first, t) }
    return m
  }, [tasks])

  /* ── capability-gated callbacks (an affordance is wired ONLY when its flag is true) ── */
  const canLabel = !!caps.canLabel
  const labelTurn = canLabel ? (idx) => setLabelFor(idx) : undefined

  /* ── filtered turn set. Each entry is the turn PROJECTED through the filters:
        a category hides its part kind inside the turn (tool cards, the thinking
        block, the text) and the turn leaves only when no part survives; tags and
        the checkpoint anchor act on the whole turn. The rules live in filters.js
        so the rail's controls and the trace cannot drift apart. ──────────────── */
  const visibleTurns = useMemo(() => {
    const { checkpoint } = filters
    const selCommit = checkpoint !== 'all' ? commits.find((c) => c.shortHash === checkpoint || c.hash === checkpoint) : null
    const ctx = {
      annotationsByTurn: vm?.filterIndex?.annotationsByTurn ?? {},
      checkpointTurn: selCommit?.turn ?? null, // adapter-joined anchor; scopes only when present
    }
    const sourceFiltersMatch = searchReveal?.sourceIndex != null && searchReveal.filterFingerprint === filterFingerprint(filters)
    return turns.map((t) => {
      const projected = projectTurn(t, filters, ctx)
      // A deliberate source jump may temporarily reveal exactly its readable
      // call without changing the reader's persisted filter choices. A later
      // filter change or session switch ends that exception.
      if (!sourceFiltersMatch || searchReveal.sessionId !== session.id || searchReveal.turn !== t.index || !t.sourceIndexUnique) return projected
      const call = t.toolCalls?.find((tool) => tool.sourceIndex === searchReveal.sourceIndex)
      if (!call || !call.sourceIdUnique || (searchReveal.toolCallId !== undefined && searchReveal.toolCallId !== call.id)) return projected
      if (projected?.toolCalls?.some((tool) => tool.sourceIndex === call.sourceIndex)) return projected
      const base = projected ?? { ...t, content: '', displayContent: '', thinking: undefined, toolCalls: [] }
      return { ...base, toolCalls: [...(base.toolCalls ?? []), call].sort((a, b) => a.sourceIndex - b.sourceIndex) }
    }).filter((t) => t != null)
  }, [turns, filters, commits, vm, searchReveal, session.id])
  const actionLayout = useMemo(() => actionGroups(turns, visibleTurns), [turns, visibleTurns])
  const readerAnchor = useReaderWidthAnchor({ readerPx, scrollRef, activeTurnRef, turnRefs, actionRefs, actionLayout, visibleTurns, ledger, sessionId: session.id, tab, viewMode, onSettle: () => { if (scrollRef.current) syncScrollChrome(scrollRef.current) } })
  useEffect(() => {
    readerDragRef.current = null
    setReaderDragWidth(null)
    return () => { readerDragRef.current = null }
  }, [session.id, tab, viewMode])

  const readTraceReadingSnapshot = useCallback(() => {
    const sc = scrollRef.current
    if (!sc) return null
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null
    const focusedAnchor = activeElement instanceof Element ? activeElement.closest('.txn-anchor[data-turn-control]') : null
    return {
      sessionId: session?.id ?? '',
      scrollTop: sc.scrollTop,
      focusOrigin: focusedAnchor && sc.contains(focusedAnchor)
        ? { kind: 'descendant', turnIndex: Number(focusedAnchor.getAttribute('data-turn-control')), control: 'anchor' }
        : activeElement === sc
          ? { kind: 'scroller' }
          : { kind: 'tab' },
    }
  }, [session?.id])

  const armTraceReadingPosition = useCallback((snapshot) => {
    if (!snapshot || snapshot.sessionId !== (session?.id ?? '') || traceReadingPositionRef.current != null) return
    traceReadingPositionIdRef.current += 1
    const nextPosition = {
      ...snapshot,
      requestKey: `trace-reading-position-${traceReadingPositionIdRef.current}`,
      restoreRequested: false,
    }
    traceReadingPositionRef.current = nextPosition
    setTraceReadingPosition(nextPosition)
  }, [session?.id])

  const captureTraceReadingPosition = useCallback(() => {
    if (tab !== 'trace' || viewMode !== 'list') return
    // A deliberate turn jump may temporarily remount the trace at another
    // location. Keep the original reading position until the user explicitly
    // selects full trace; an intermediate tab departure must not replace it.
    armTraceReadingPosition(readTraceReadingSnapshot())
  }, [armTraceReadingPosition, readTraceReadingSnapshot, tab, viewMode])

  const requestTraceReadingPosition = useCallback(() => {
    const savedPosition = traceReadingPositionRef.current
    if (!savedPosition || savedPosition.sessionId !== (session?.id ?? '') || savedPosition.restoreRequested) return
    const requestedPosition = { ...savedPosition, restoreRequested: true }
    traceReadingPositionRef.current = requestedPosition
    setTraceReadingPosition(requestedPosition)
    setViewMode('list')
  }, [session?.id, setViewMode])

  // Reading position is ephemeral to one transcript. Clear every mutable copy
  // before a newly supplied session can arm or request restoration.
  useLayoutEffect(() => {
    const sessionId = session?.id ?? ''
    if (readingPositionSessionRef.current === sessionId) return
    readingPositionSessionRef.current = sessionId
    latestTraceReadingSnapshotRef.current = null
    traceReadingPositionRef.current = null
    traceReadingPositionIdRef.current = 0
    skipTraceRestoreRef.current = false
    previousTabRef.current = tab
    setTraceReadingPosition(null)
  }, [session?.id, tab])

  // Keep a last-known trace snapshot so a controlled parent can change tabs
  // without giving this component a pointer or keyboard event to intercept.
  useLayoutEffect(() => {
    if (tab !== 'trace' || viewMode !== 'list') return
    const snapshot = readTraceReadingSnapshot()
    if (snapshot) latestTraceReadingSnapshotRef.current = snapshot
  }, [readTraceReadingSnapshot, tab, viewMode, visibleTurns])

  // Internal activation captures before the tab unmounts the trace. This
  // layout fallback covers the public controlled-tab path, where a parent can
  // replace activeTab without an event originating inside this component.
  useLayoutEffect(() => {
    if (previousTabRef.current === 'trace' && tab !== 'trace') {
      armTraceReadingPosition(latestTraceReadingSnapshotRef.current)
    } else if (previousTabRef.current !== 'trace' && tab === 'trace' && activeTabProp !== undefined) {
      if (skipTraceRestoreRef.current) skipTraceRestoreRef.current = false
      else requestTraceReadingPosition()
    }
    previousTabRef.current = tab
  }, [activeTabProp, armTraceReadingPosition, requestTraceReadingPosition, tab])

  const selectTab = useCallback((nextTab) => {
    if (nextTab === 'trace') {
      requestTraceReadingPosition()
    } else {
      captureTraceReadingPosition()
    }
    setTab(nextTab)
  }, [captureTraceReadingPosition, requestTraceReadingPosition, setTab])

  const applyInitialPosition = useCallback((position) => {
    if (position.kind === 'tool-call') {
      const owners = turns.filter(turn => turn.index === position.turnIndex)
      const owner = owners[0]
      const tool = owner?.toolCalls?.find(call => call.sourceIndex === position.toolCallIndex)
      if (owners.length !== 1 || !owner.sourceIndexUnique || !tool || !tool.sourceIdUnique || (position.toolCallId !== undefined && position.toolCallId !== tool.id)) return 'discarded'
      const key = toolStateKey(owner.index, tool)
      if (!tool.id && turns.some(turn => turn.toolCalls?.some(call => call.id === key))) return 'discarded'
      if (tab !== 'trace') { skipTraceRestoreRef.current = true; setTab('trace'); return 'pending' }
      if (viewMode !== 'list') { setViewMode('list'); return 'pending' }
      if (!scrollRef.current) return 'pending'
      selectTurn(owner.index)
      setOpenTools(previous => ({ ...previous, [key]: true }))
      setSearchReveal({ turn: owner.index, where: `source:${position.toolCallIndex}`, sourceIndex: position.toolCallIndex, toolCallId: position.toolCallId, sessionId: session.id, filterFingerprint: filterFingerprint(filters), select: false, focus: true, sequence: ++revealSequence.current })
      return 'applied'
    }
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
      latestTraceReadingSnapshotRef.current = readTraceReadingSnapshot()
      return 'applied'
    }

    const projected = visibleTurns.find(turn => turn.index === position.turnIndex)
    const location = ledger && !String(projected?.displayContent ?? projected?.content ?? '').trim() ? actionLayout.locations.get(position.turnIndex) : null
    if (location) revealAction(position.turnIndex, location.where, { select: false })
    else el.scrollIntoView({ block: 'start', behavior: 'auto' })
    latestTraceReadingSnapshotRef.current = readTraceReadingSnapshot()
    return 'applied'
  }, [readTraceReadingSnapshot, tab, turns, viewMode, visibleTurns, ledger, actionLayout, setTab, setViewMode, setOpenTools, filters, session.id])

  const applyTraceReadingPosition = useCallback((position) => {
    const target = traceReadingPositionRef.current ?? traceReadingPosition
    if (!target || target.sessionId !== (session?.id ?? '') || position.requestKey !== target.requestKey) return 'discarded'
    const sc = scrollRef.current
    const result = transcriptInitialPositionReadiness(position, {
      authoritativeTurnIndices: turns.map((turn) => turn.index),
      renderedTurnIndices: visibleTurns.map((turn) => turn.index),
      viewReady: tab === 'trace' && viewMode === 'list',
      scrollerReady: sc != null,
      targetReady: true,
    })
    if (result !== 'applied') return result

    sc.scrollTo({ top: target.scrollTop, behavior: 'auto' })
    if (target.focusOrigin.kind === 'scroller') sc.focus({ preventScroll: true })
    else if (target.focusOrigin.kind === 'descendant') {
      const turn = turnRefs.current[target.focusOrigin.turnIndex]
      const control = turn?.querySelector?.(`.txn-anchor[data-turn-control="${target.focusOrigin.turnIndex}"]`)
      ;(control ?? tabRefs.current.trace)?.focus({ preventScroll: true })
    } else tabRefs.current.trace?.focus({ preventScroll: true })
    latestTraceReadingSnapshotRef.current = {
      scrollTop: target.scrollTop,
      focusOrigin: target.focusOrigin,
    }
    traceReadingPositionRef.current = null
    setTraceReadingPosition(null)
    return 'applied'
  }, [session?.id, tab, traceReadingPosition, turns, viewMode, visibleTurns])

  useTranscriptInitialPosition({
    sessionId: session?.id,
    initialPosition: initialPositionProp,
    legacyInitialPosition: activeTurnProp == null ? null : { kind: 'turn', turnIndex: activeTurnProp },
    readiness: [tab, viewMode, turns, visibleTurns],
    apply: applyInitialPosition,
  })

  useTranscriptInitialPosition({
    sessionId: session?.id,
    initialPosition: traceReadingPosition?.restoreRequested ? { kind: 'top', requestKey: traceReadingPosition.requestKey } : null,
    readiness: [traceReadingPosition?.restoreRequested, traceReadingPosition?.requestKey, tab, viewMode, turns, visibleTurns],
    apply: applyTraceReadingPosition,
  })

  /* Category + tool-group counts the FiltersRail shows. Category counts are
     turn-based and disjoint (see filters.js) so each badge counts exactly the
     turns its own checkbox hides. */
  const counts = useMemo(() => ({
    categories: categoryCounts(turns),
    toolGroups: toolGroupCounts,
  }), [turns, toolGroupCounts])

  /* The "clear (N)" badge counts filters the user can still undo. Tool groups
     count only while `tool calls` is on: once the umbrella is off it has already
     cascaded every group to false, and counting those would report 8 active
     filters for one click. */
  const filtersActive =
    (filters.categories.prompts ? 0 : 1) +
    (filters.categories.responses ? 0 : 1) +
    (filters.categories.thinking ? 0 : 1) +
    (filters.categories.toolcalls ? 0 : 1) +
    (filters.categories.system === false ? 1 : 0) +
    (filters.tags.errors ? 1 : 0) +
    (filters.tags.retries ? 1 : 0) +
    (filters.tags.revert ? 1 : 0) +
    (filters.categories.toolcalls ? Object.values(filters.toolGroups).filter((v) => !v).length : 0)

  /* search matches: substring across turn content + tool previews/output. */
  const matches = useMemo(() => {
    if (!query.trim()) return []
    const found = []
    const append = (turn, where, text) => {
      let occurrence = 0
      for (const _match of text.matchAll(searchExpression(query))) found.push({ turn, where, occurrence: occurrence++ })
    }
    for (const t of visibleTurns) {
      append(t.index, 'body', t.displayContent ?? t.content ?? '')
      append(t.index, 'thinking', t.thinking?.text || '')
      for (const tc of t.toolCalls || []) {
        const out = typeof tc.output === 'string' ? tc.output : tc.output != null ? JSON.stringify(tc.output) : ''
        const hay = [tc.preview, out].filter(Boolean).join(' ')
        if (tc.id || tc.sourceIndex != null) append(t.index, tc.id || `source:${tc.sourceIndex}`, hay)
      }
    }
    return found
  }, [query, visibleTurns])

  const progress = useMemo(() => {
    const idx = visibleTurns.findIndex((t) => t.index === activeTurn)
    return { cur: Math.max(1, idx + 1), total: visibleTurns.length }
  }, [activeTurn, visibleTurns])
  /* The bottom bar's quiet row is host opt-in: a host that wants the shortcut hint or the position
     counter passes `footer` with that flag; both stay out of the surface by default. */
  const footerHints = footer?.hints === true
  const footerProgress = footer?.progress === true && tab === 'trace' && viewMode === 'list' && visibleTurns.length > 0

  /* ── navigation + interactions (effects/handlers only; safe under static render) ── */
  function selectTurn(idx) {
    readerAnchor.clear()
    activeTurnRef.current = idx
    navigationTargetRef.current = idx
    setActiveTurn(idx)
  }
  function releaseTurnNavigation() {
    readerAnchor.clear()
    navigationTargetRef.current = null
  }
  function jumpTo(idx, { switchTab = true } = {}) {
    if (switchTab && tab !== 'trace') {
      skipTraceRestoreRef.current = true
      setTab('trace')
    }
    setViewMode('list')
    selectTurn(idx)
    const projected = visibleTurns.find(turn => turn.index === idx)
    const location = ledger && !String(projected?.displayContent ?? projected?.content ?? '').trim() ? actionLayout.locations.get(idx) : null
    if (location) { revealAction(idx, location.where); return }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        if (navigationTargetRef.current !== idx) return
        const el = turnRefs.current[idx]
        const sc = scrollRef.current
        if (el && sc) {
          const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
          sc.scrollTo({ top: turnScrollTop(sc, el), behavior: reduce ? 'auto' : 'smooth' })
        }
      })
    }
  }
  function stepTurn(dir) {
    const ids = (cardTurns.length ? cardTurns : visibleTurns).map((t) => t.index)
    const cur = ids.indexOf(activeTurnRef.current)
    if (cur < 0) {
      // Search may select a wordless source whose actions render in another card.
      // Step around that source in transcript order, never around its group owner.
      const source = turns.findIndex(turn => turn.index === activeTurnRef.current)
      const eligible = new Set(ids)
      const candidates = dir > 0 ? turns.slice(source + 1) : turns.slice(0, source).reverse()
      const next = candidates.find(turn => eligible.has(turn.index))?.index ?? ids[dir > 0 ? ids.length - 1 : 0]
      if (next != null && next !== activeTurnRef.current) jumpTo(next, { switchTab: false })
      return
    }
    const next = Math.max(0, Math.min(ids.length - 1, cur + dir))
    if (ids[next] != null && ids[next] !== activeTurnRef.current) jumpTo(ids[next], { switchTab: false })
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
  function syncScrollChrome(sc) {
    const pinned = sc.scrollTop > STICKY_SCROLL_THRESHOLD
    setSticky(pinned)
    const header = headerRef.current
    // Measure the EXPANDED hero only: while condensed the header still has the
    // breadcrumb row's height, and adopting that smaller figure would loosen the
    // release guard mid-flight. Using the full expanded height is deliberately
    // conservative (only the title + chips actually leave), which can never
    // reintroduce the clamp-flicker.
    const headerMoving = header?.getAnimations?.({ subtree: true }).some(animation => animation.playState === 'running')
    if (header && header.offsetHeight > 0 && !header.closest('.txn-app-condensed') && !headerMoving) {
      heroHeightRef.current = header.offsetHeight
    }
    const overflowAfterRelease = sc.scrollHeight - sc.clientHeight - heroHeightRef.current
    const focusInHeader = !!header && typeof document !== 'undefined' && header.contains(document.activeElement)
    setHeroHidden(pinned && !focusInHeader && overflowAfterRelease > STICKY_SCROLL_THRESHOLD + HERO_RELEASE_SLACK)
  }
  /* A model-actions block is not a turn: only a turn that draws a card (prose, or the system
     row) owns the reading position and the keyboard step. */
  const cardTurns = useMemo(
    () => visibleTurns.filter((t) => t.role === 'system' || String(t.displayContent ?? t.content ?? '').trim() !== ''),
    [visibleTurns],
  )

  function onScroll() {
    const sc = scrollRef.current
    if (!sc) return
    latestTraceReadingSnapshotRef.current = readTraceReadingSnapshot()
    if (readerAnchor.skipScroll(sc)) return
    syncScrollChrome(sc)
    // A requested turn may never reach the reading line at a scroll boundary. Keep that
    // selection through the smooth scroll; a real wheel, touch or scrollbar gesture releases it.
    if (navigationTargetRef.current != null && visibleTurns.some(t => t.index === navigationTargetRef.current)) return
    navigationTargetRef.current = null
    setActiveTurn(turnAtReadingLine(cardTurns,
      index => turnRefs.current[index]?.offsetTop ?? Infinity,
      sc.scrollTop + sc.clientHeight * 0.4))
  }

  function openFile(file) {
    if (file.edited) selectTab('diffs')
    else jumpTo(file.turn ?? 0)
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
    if (el && sc) { sc.scrollTo({ top: turnScrollTop(sc, el), behavior: 'auto' }); setActiveTurn(t.index) }
  }

  /* ── reading width: the drag handle changes ONLY --txn-reader-width ───────────
     The column is centred, so the trailing edge moves half as far as the width: two
     pixels of pointer travel per pixel of width. A drag adjusts live (clamped to the
     measured full width) and rests wherever it is released; the keyboard moves in
     READER_STEP increments, Home to the minimum and End to full. No handler here reads or
     writes the sidebar layout. A press can end without a pointerup (capture loss, the
     pointer leaving the handle, a window blur), so every end path clears the drag and
     keeps the width it reached; a mouse move with no button held never resizes. Each
     press re-measures, so a drag never clamps to a stale width. */
  function endReaderDrag(clientX) {
    const drag = readerDragRef.current
    if (!drag) return
    readerDragRef.current = null
    setReaderDragWidth(null)
    const released = typeof clientX === 'number' && clientX > 0 ? drag.startWidth + (clientX - drag.startX) * 2 : (readerPx ?? drag.startWidth)
    setReaderWidth(restingReaderWidth(released, drag.fullPx))
    readerAnchor.finish()
  }
  useEffect(() => {
    const onBlur = () => {
      if (readerDragRef.current) endReaderDrag()
      else readerAnchor.clear()
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  })
  function remeasureReaderFull() {
    const full = measureReaderFull(scrollRef.current) ?? readerFullPx
    if (full !== readerFullPx) setReaderFullPx(full)
    return full
  }
  function onReaderPointerDown(e) {
    if (e.button !== 0 && e.pointerType !== 'touch') return
    const fullPx = remeasureReaderFull()
    readerAnchor.begin()
    readerDragRef.current = { startX: e.clientX, startWidth: readerPxOf(readerStored, fullPx) ?? readerMaxPx(fullPx), fullPx }
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic pointer ids cannot be captured */ }
    }
  }
  function onReaderPointerMove(e) {
    const drag = readerDragRef.current
    if (!drag) return
    /* a mouse move with no button held is a hover, not a drag: an interrupted press must not
       leave the next pass over the handle resizing the column. */
    if (e.pointerType !== 'touch' && e.buttons === 0) return
    readerAnchor.ensure()
    const next = clampReaderPx(drag.startWidth + (e.clientX - drag.startX) * 2, drag.fullPx)
    setReaderDragWidth(next)
    setReaderWidth(next)
  }
  function onReaderPointerUp(e) {
    const drag = readerDragRef.current
    if (!drag) return
    if (typeof e.currentTarget.releasePointerCapture === 'function' && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* capture may already be gone */ }
    }
    endReaderDrag(e.clientX)
  }
  function onReaderPointerLeave(e) {
    if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) endReaderDrag()
  }
  function onReaderLostPointerCapture() {
    endReaderDrag()
  }
  function onReaderKeyDown(e) {
    const fullPx = remeasureReaderFull()
    const current = readerPxOf(readerStored, fullPx) ?? readerMaxPx(fullPx)
    let next
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = restingReaderWidth(current - READER_STEP, fullPx)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = restingReaderWidth(current + READER_STEP, fullPx)
    else if (e.key === 'Home') next = READER_MIN
    else if (e.key === 'End') next = READER_FULL
    else return
    e.preventDefault()
    readerAnchor.begin()
    setReaderWidth(next)
    readerAnchor.finish()
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
    captureTraceReadingPosition()
    selectTab(TAB_ORDER[j])
    tabRefs.current[TAB_ORDER[j]]?.focus()
  }

  /* the one way search opens: the ⌘F shortcut and the optional header trigger share it, so the
     trigger does exactly what the shortcut does (open the bar on the trace tab, focus its field). */
  function openSearch() {
    setSearchOpen(true); selectTab('trace')
    setSearchNavigation(sequence => sequence + 1)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  function navigateSearch(delta) {
    setMatchIdx(i => matches.length ? (i + delta + matches.length) % matches.length : 0)
    setSearchNavigation(sequence => sequence + 1)
  }

  /* cmd/ctrl+F search + j/k step (browser only; no-op under static render). */
  useEffect(() => {
    function onKey(e) {
      if (e.defaultPrevented) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault(); openSearch(); return
      }
      if (e.key === 'Escape' && searchOpen) { setSearchOpen(false); return }
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')
      if (searchOpen || typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (tab !== 'trace' || viewMode !== 'list') return
      if (['PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) releaseTurnNavigation()
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); stepTurn(1) }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); stepTurn(-1) }
    }
    if (typeof window === 'undefined') return undefined
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen, tab, viewMode, activeTurn, visibleTurns, selectTab])

  /* Only deliberate search input/navigation reveals a turn, never passive activation. */
  useLayoutEffect(() => {
    if (!searchOpen || matches.length === 0) return
    const m = matches[Math.min(matchIdx, matches.length - 1)]
    revealAction(m.turn, m.where, { search: true, occurrence: m.occurrence })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchNavigation])

  /* The matching card opens in its layout effect before this scroll action. */
  useEffect(() => {
    if (!searchReveal) return
    let cancelled = false
    const scroll = async () => {
      // Child layout effects reveal the list/output before measuring its actual row.
      // Wait for their real disclosure motion so a far-down match ends on screen.
      const sc = scrollRef.current
      if (!sc) return
      const animations = sc.getAnimations?.({ subtree: true }).filter(animation => animation.effect?.target?.classList?.contains('txn-disclosure')) ?? []
      await Promise.allSettled(animations.map(animation => animation.finished))
      if (cancelled) return
      const sourceTarget = searchReveal.where.startsWith('source:')
      const el = (ledger || sourceTarget || searchReveal.search) && searchReveal.where !== 'body'
        ? actionRefs.current.get(`${searchReveal.turn}:${searchReveal.where}`)
        : turnRefs.current[searchReveal.turn]
      if (!el || el.closest('[hidden], [inert]')) return
      const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const padding = Number.parseFloat(getComputedStyle(sc).scrollPaddingTop) || 12
      const scope = searchReveal.where === 'body' ? el.querySelector('.txn-body') : el
      const match = searchReveal.search ? renderedSearchRanges(scope, query)[searchReveal.occurrence] : null
      if (searchReveal.search) setSearchUnrendered(!match)
      const top = match
        ? sc.scrollTop + match.getBoundingClientRect().top - sc.getBoundingClientRect().top - sc.clientHeight * 0.4
        : (ledger || sourceTarget || searchReveal.search) && searchReveal.where !== 'body'
        ? sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - padding
        : turnScrollTop(sc, el)
      sc.scrollTo({ top, behavior: !searchReveal.select || reduce ? 'auto' : 'smooth' })
      if (searchReveal.focus) el.querySelector('button')?.focus({ preventScroll: true })
      if (searchReveal.select) selectTurn(searchReveal.turn)
    }
    const frame = requestAnimationFrame(scroll)
    return () => { cancelled = true; cancelAnimationFrame(frame) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchReveal, ledger])

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

  // prefer a curated session title (editorial summary); else derive one from the first task / prompt,
  // bounded to 160 characters so a run-on title cannot swallow the header (the pre-composite
  // viewers truncated; consumers rely on it). The share card uses the same rule.
  const title = transcriptTitle({
    title: session.title,
    hasNormalizedEvidence: session.hasNormalizedEvidence,
    firstTaskPrompt: tasks[0]?.prompt,
    firstUserContent: turns.find((t) => t.role === 'user')?.content,
    id: session.id,
  })

  /* The default trail ends on the transcript itself, so it reads as the title, not an opaque id.
     A host-supplied breadcrumb still wins unchanged (it carries the host's own routes). */
  const derivedTrail = breadcrumb == null
  const trail = breadcrumb ?? (breadcrumbContext != null ? [...breadcrumbContext, { label: title }] : [
    { label: 'sessions', href: '#' },
    { label: session.project ?? 'session', href: '#' },
    { label: title },
  ])

  const tabHasFilters = tab === 'trace' || tab === 'highlights'
  const tabStrip = (
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
            id={`${tabsId}-${id}`}
            aria-controls={`${tabsId}-panel`}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={'tab txn-tab' + (on ? ' active' : '')}
            onMouseDown={(event) => {
              // Capture before the browser moves focus from the stream to a
              // clicked alternate tab. The click handler remains the
              // fallback for programmatic activation and keyboard clicks.
              if (event.button === 0 && id !== 'trace') captureTraceReadingPosition()
            }}
            onClick={() => selectTab(id)}
          >
            {TAB_LABEL[id]} <span className="cnt tnum">{count}</span>
          </button>
        )
      })}
    </div>
  )

  const moreActions = (caps.canEdit || caps.canExport) && (
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
                  </ul>
                </div>
              )}
            </div>
            )

  return (
    <div
      className={'txn-app' + (theme === 'light' ? ' txn-light' : '') + (ledger ? ' txn-ledger' : '') + (ledger && zen ? ' txn-zen' : '') + (heroCondensed ? ' txn-app-condensed' : '')}
      data-theme={theme}
      data-host-visible={!zenActive && sidebarLayout.host ? 'true' : 'false'}
      style={ledger ? { '--txn-reader-width': readerPx != null ? `${readerPx}px` : '100%' } : undefined}
    >
      <SearchHighlights scrollRef={scrollRef} query={query} enabled={searchOpen && tab === 'trace' && viewMode === 'list'} revision={visibleTurns} />
      {/* The session views live in the bottom bar, which comes after the whole panel in DOM order.
          This control keeps them one keystroke from the top of the viewer, and only shows itself
          while focused. */}
      <button
        type="button"
        className="txn-skip"
        onClick={() => { const target = tabRefs.current[tab]; if (target) target.focus() }}
      >
        skip to session views
      </button>
      {beforeHeader != null && <div className="txn-before-header">{beforeHeader}</div>}
      {/* ===================== HEADER ===================== */}
      <header className="txn-header" ref={headerRef}>
        <div className="txn-header-top">
          {/* Host-routable trail: pass `breadcrumb` (+ a router LinkComponent) to
              replace the demo's static sessions/{project}/{title} crumb — hosts have
              real routes and origin-aware trails (map, node > project > id). */}
          <nav className={'crumb txn-crumb' + (derivedTrail ? ' txn-crumb-derived' : '')} aria-label="breadcrumb">
            {trail.map((item, i, items) => {
              const CrumbLink = LinkComponent ?? 'a'
              const last = i === items.length - 1
              return (
                <Fragment key={`${item.label}-${i}`}>
                  {i > 0 && <ChevronRight size={14} aria-hidden="true" />}
                  {/* a crumb with somewhere to go is a link, the last one too; only a crumb
                      without an href is the current place */}
                  {item.href != null
                    ? <CrumbLink className="link" href={item.href}>{item.label}</CrumbLink>
                    : <span className={last ? 'cur' : 'link'} aria-current={last ? 'page' : undefined}>{item.label}</span>}
                </Fragment>
              )
            })}
          </nav>

          <div className="txn-actions">
            {/* host session-level actions (attest etc.) lead the row — the
                composite's fixed capability set stays the shared tail */}
            {headerActions}
            {!mobile && utilityActions}
            {showTail && (<>
            <div className="menu-anchor">
              <button
                type="button"
                className="btn btn-secondary btn-sm menu-trigger"
                aria-expanded={shareOpen}
                aria-haspopup="menu"
                onClick={() => { setShareOpen((o) => !o); setMoreOpen(false) }}
              >
                <Share2 size={14} aria-hidden="true" /> share
                <ChevronDown size={14} aria-hidden="true" className="menu-caret" />
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

            {!mobile && moreActions}
            </>)}
          </div>
        </div>

        <Collapsible open={!heroCondensed} keepMounted className="txn-header-details">
        <TitleHeading className="txn-title" title={title}>{title}</TitleHeading>
        {/* an optional one-line deck under the title (ledger reads it as the transcript's
            provenance line); render-when-supplied so classic is untouched. A div, not a
            paragraph: the prop takes a node, and a composed deck may hold block content. */}
        {subtitle != null && <div className="txn-sub">{subtitle}</div>}

        <div className="txn-meta chips" tabIndex={0} role="region" aria-label="session metadata">
          {showOutcome && session.outcome && <TranscriptOutcomeChip outcome={session.outcome} />}
          {session.harness && <span className="chip"><ProviderIcon harness={session.harness} accent /> {String(session.harness).replace(/-/g, ' ')}</span>}
          {session.model && <span className="chip mono">{session.model}</span>}
          {session.git?.author && <Term className="metaitem" def="git author"><User size={14} aria-hidden="true" /> {session.git.author}</Term>}
          {formatDurationMins(session.durationMins) && <span className="metaitem"><Clock size={14} aria-hidden="true" /> <b className="tnum">{formatDurationMins(session.durationMins)}</b></span>}
          {session.turnCount != null && <span className="metaitem"><ListTree size={14} aria-hidden="true" /> <b className="tnum">{session.turnCount}</b> turns</span>}
          {/* a figure that was not measured is left out, never shown as unknown or as zero */}
          {session.inputSubmissionCount != null && <span className="metaitem"><MessageSquareText size={14} aria-hidden="true" /> <b className="tnum">{session.inputSubmissionCount}</b> {session.inputSubmissionCount === 1 ? 'prompt' : 'prompts'}</span>}
          {session.toolCallCount != null && <span className="metaitem"><Wrench size={14} aria-hidden="true" /> <b className="tnum">{session.toolCallCount}</b> tools</span>}
          {!vm.usageScopes?.length && session.totalTokens != null && <Term className="metaitem" def={formatCount(session.tokensIn ?? 0) + ' input tokens, ' + formatCount(session.tokensOut ?? 0) + ' output tokens'}><Coins size={14} aria-hidden="true" /> <b className="tnum">{formatCount(session.totalTokens)}</b> tokens</Term>}
          {commits.length > 0 && <span className="metaitem"><GitCommitHorizontal size={14} aria-hidden="true" /> <b className="tnum">{commits.length}</b> {commits.length === 1 ? 'commit' : 'commits'}</span>}
          {/* the line counts ride with the file count as one unit, so "+11 −4" never wraps onto a
              line of its own */}
          {(() => {
            const churn = session.git && (session.git.insertions != null || session.git.deletions != null)
              ? <span className="txn-churn-meta tnum"><span className="txn-churn-add">+{session.git.insertions ?? 0}</span> <span className="txn-churn-del">−{session.git.deletions ?? 0}</span></span>
              : null
            if (session.git?.filesChanged != null) {
              return <span className="metaitem txn-files-meta"><FileText size={14} aria-hidden="true" /> <b className="tnum">{session.git.filesChanged}</b> {session.git.filesChanged === 1 ? 'file' : 'files'}{churn ? <> {churn}</> : null}</span>
            }
            return churn ? <span className="metaitem">{churn}</span> : null
          })()}
        </div>
        {/* host-owned pull request list: the host supplies the rows and any "show all" control;
            the composite only gives it a place under the meta row. */}
        {pullRequests != null && <div className="txn-prs">{pullRequests}</div>}
        </Collapsible>
        <UsageScopes scopes={vm.usageScopes} />
      </header>

      {/* Search is anchored after the context header on narrow screens. */}
      {searchOpen && (
        <div className="txn-search">
          <Search size={15} aria-hidden="true" className="txn-search-ico" />
          <input
            ref={searchInputRef}
            className="txn-search-input"
            placeholder="search across turns, tool args, and results…"
            value={query}
            onChange={(e) => { setSearchUnrendered(false); setQuery(e.target.value); setMatchIdx(0); setSearchNavigation(sequence => sequence + 1) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); navigateSearch(e.shiftKey ? -1 : 1) }
              if (e.key === 'Escape') setSearchOpen(false)
            }}
            aria-label="search transcript"
          />
          <span className="txn-search-count tnum" role="status" aria-live="polite" aria-label={matches.length ? `match ${Math.min(matchIdx, matches.length - 1) + 1} of ${matches.length}` : undefined}>{matches.length ? `${Math.min(matchIdx, matches.length - 1) + 1}/${matches.length}` : '0 matches'}</span>
          {searchUnrendered && matches.length > 0 && <span className="txn-search-unrendered" role="status">match in source, not visible in rendered content</span>}
          <button type="button" className="txn-search-nav" aria-label="previous match" disabled={!matches.length} onClick={() => navigateSearch(-1)}><ChevronUp size={14} aria-hidden="true" /></button>
          <button type="button" className="txn-search-nav" aria-label="next match" disabled={!matches.length} onClick={() => navigateSearch(1)}><ChevronDown size={14} aria-hidden="true" /></button>
          <kbd className="kbd-key txn-search-esc">esc</kbd>
          <button type="button" className="txn-search-x" aria-label="close search" onClick={() => setSearchOpen(false)}><X size={14} aria-hidden="true" /></button>
        </div>
      )}

      {/* ===================== BODY ===================== */}
      {/* only the trace and the highlights have filters; any other tab leaves the right rail out.
          Zen collapses both viewer rails and hides their strips, so its body grid holds the center
          alone and the zen control is the one way back out. */}
      <div
        className="txn-body-grid"
        ref={bodyGridRef}
        data-left-rail={zenActive ? 'none' : leftRailOpen ? 'open' : 'closed'}
        data-right-rail={zenActive ? 'none' : !tabHasFilters ? 'none' : rightRailOpen ? 'open' : 'closed'}
        data-zen={ledger ? (zenActive ? 'true' : 'false') : undefined}
      >
        {/* LEFT: outline */}
          <Collapsible as="aside" className="txn-rail txn-rail-left" aria-label="user turns outline"
            open={!zenActive && leftRailOpen} keepMounted animateSize={false}>
            <div className="txn-rail-head">
              <LayoutList size={14} aria-hidden="true" /> <span className="txn-rail-title">user turns</span>
              <button type="button" className="txn-rail-collapse" aria-label="collapse user turns outline" title="collapse" onClick={() => { railFocusRef.current = 'left'; commitSidebarLayout({ outline: false }) }}>
                <PanelLeftClose size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="txn-rail-body" id="txn-rail-left-body">
              <OutlineRail viewModel={vm} tab={tab} presentation={presentation} activeTurn={activeTurn} onJump={(idx) => jumpTo(idx, { switchTab: false })} />
            </div>
          </Collapsible>
          <Collapsible className="txn-rail-strip txn-rail-strip-left"
            open={!zenActive && !leftRailOpen} keepMounted animateSize={false}>
            <button type="button" className="txn-rail-reopen" aria-label="expand user turns outline" title="expand user turns" onClick={() => { railFocusRef.current = 'left'; commitSidebarLayout({ outline: true }) }}>
              <PanelLeftOpen size={14} aria-hidden="true" />
              <span className="txn-rail-strip-label">user turns</span>
            </button>
          </Collapsible>

        {/* CENTER */}
        <section className="txn-center" role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`} onClickCapture={() => { if (mobileToolsOpen) setMobileToolsOpen(false) }}>
          {tab === 'trace' && (
            <div className={'txn-trace' + (sticky && viewMode === 'list' ? ' txn-trace-pinned' : '')}>
              <Collapsible open={sticky && viewMode === 'list'} className="txn-sticky-disclosure">
                <div className="txn-sticky">
                  {ledger ? (
                    /* the pinned bar is the timeline alone: the title already sits in the
                       breadcrumb and the page header above the trace. */
                    <TranscriptMinimap
                      turns={visibleTurns}
                      activeTurn={activeTurn}
                      onJump={(idx) => jumpTo(idx, { switchTab: false })}
                    />
                  ) : (
                    <>
                      {session.harness && <ProviderIcon harness={session.harness} accent />}
                      {activeModel && <span className="txn-sticky-model mono">{activeModel}</span>}
                      <Scrubber turns={turns} active={activeTurn} onSeek={seekScrub} draggingRef={draggingRef} />
                    </>
                  )}
                </div>
              </Collapsible>
              <div className={"txn-trace-head" + (viewMode === 'graph' ? ' txn-trace-head-graph' : '')}>
                <span className="txn-trace-count tnum">
                  {visibleTurns.length === turns.length ? `${turns.length} turns` : `${visibleTurns.length} of ${turns.length} turns`}
                </span>
                <div className="txn-trace-actions">
                  <div className="bs-seg txn-viewtoggle" role="group" aria-label="view mode">
                    <button type="button" className="bs-seg-opt" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}><List size={14} aria-hidden="true" /> list</button>
                    <button type="button" className="bs-seg-opt" aria-pressed={viewMode === 'graph'} onClick={() => setViewMode('graph')}><Network size={14} aria-hidden="true" /> graph</button>
                  </div>
                </div>
              </div>

              {viewMode === 'graph' ? (
                <div className="txn-graphslot">
                  {graphSlot
                    ? graphSlot({ viewModel: vm, activeTurn, onSelectTurn: (idx) => setActiveTurn(idx) })
                    : <div className="empty"><div className="ring"><Network size={20} aria-hidden="true" /></div><EmptyHeading>no graph engine</EmptyHeading><p>pass a <code>graphSlot</code> render-prop to plug a trajectory graph.</p></div>}
                </div>
              ) : (
                <div className="txn-streamwrap">
                  <div className="txn-stream" ref={scrollRef} role="region" aria-label="full trace turns"
                    onWheel={releaseTurnNavigation} onTouchStart={releaseTurnNavigation} onPointerDown={releaseTurnNavigation}
                    onFocusCapture={() => {
                    const snapshot = readTraceReadingSnapshot()
                    if (snapshot) latestTraceReadingSnapshotRef.current = snapshot
                  }} onScroll={onScroll} tabIndex={0}>
                    {streamPrelude != null && (
                      <div className="txn-stream-prelude">{streamPrelude}</div>
                    )}
                    <TranscriptContext
                      key={session.id}
                      relationships={vm.relationships}
                      earlierHistory={vm.earlierHistory}
                      onNavigate={callbacks.onNavigateRelationship}
                      open={earlierHistoryOpen}
                      toggle={id => setEarlierHistoryOpen(previous => ({ ...previous, [id]: !previous[id] }))}
                      openTools={openTools}
                      toggleTool={toggleTool}
                    />
                    {visibleTurns.length === 0 && (
                      <div className="empty"><div className="ring"><FilterIcon size={20} aria-hidden="true" /></div><EmptyHeading>no turns to display</EmptyHeading><p>every turn is filtered out. clear a filter to bring them back.</p></div>
                    )}
                    {(() => {
                      /* In the ledger every action the model takes for one user turn shares one
                         block. A user turn closes the group; system rows stay where they are and
                         do not split it. The block sits after the group's first prose turn, or on
                         its first turn with work when the group has no prose, and every other
                         turn in the group draws no work of its own, so no action renders twice. */
                      const groups = ledger ? actionLayout.groups : new Map()
                      const foldedWork = ledger ? actionLayout.folded : new Set()
                      return visibleTurns.map((t, i) => {
                      const prev = visibleTurns[i - 1]
                      const actionRun = groups.get(t.index)
                      const suppressWork = foldedWork.has(t.index)
                      const phase = phases.find((p) => t.index >= p.from && t.index <= p.to)
                      const prevPhase = prev ? phases.find((p) => prev.index >= p.from && prev.index <= p.to) : null
                      const showPhase = filters.views.hidden && phase && (!prevPhase || prevPhase.id !== phase.id)
                      const task = taskByFirstTurn.get(t.index)
                      const turnCommits = anchoredCommits.filter((c) => c.turn === t.index)
                      return (
                        <div key={t.identity ?? t.index} className={ledger ? 'txn-turnrow' : undefined}>
                          {showPhase && <PhaseDivider phase={phase} heading={PhaseHeading} />}
                          {/* in ledger a faint rule marks where the role changes; classic gains none */}
                          {ledger && prev && prev.role !== t.role && <hr className="txn-turn-rule" aria-hidden="true" />}
                          {/* in ledger the rail card carries the task identity and duration and
                              the turn head carries the per-turn identity, so the classic
                              boundary would repeat both before the first line of prose. */}
                          {!ledger && t.role === 'user' && task && <TaskBoundary task={task} />}
                          <TurnCard
                            headingLevel={pageLevel + 2}
                            presentation={presentation}
                            turn={t}
                            active={activeTurn === t.index}
                            onSelect={ledger ? selectTurn : undefined}
                            revealRequest={searchReveal?.turn === t.index ? searchReveal.sequence : 0}
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
                            modelActions={actionRun}
                            actionReveal={searchReveal && (ledger ? (actionLayout.locations.get(searchReveal.turn)?.owner ?? searchReveal.turn) === t.index : searchReveal.turn === t.index) ? searchReveal : undefined}
                            registerActionRef={registerActionRef}
                            suppressWork={suppressWork}
                          />
                          {/* host per-turn extension (touched-files panels etc.) —
                              rendered under the card, inside the turn's anchor block */}
                          {renderTurnPanel ? renderTurnPanel(t) : null}
                          {turnCommits.map((c) => <CheckpointMarker key={c.hash} commit={c} />)}
                        </div>
                      )
                    })
                    })()}
                    {looseCommits.map((c) => <CheckpointMarker key={c.hash} commit={c} />)}
                  </div>
                </div>
              )}
              {/* the reader's trailing edge: the one width control. It lives inside the trace
                  (not the header) so it tracks the column, and only ever writes the width. */}
              {ledger && viewMode === 'list' && (
                <div
                  className="txn-reader-handle"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="reading width"
                  aria-valuemin={READER_MIN}
                  aria-valuemax={readerMaxPx(readerFullPx)}
                  aria-valuenow={readerPx ?? readerMaxPx(readerFullPx)}
                  aria-valuetext={readerDragWidth == null && readerStored === READER_FULL ? 'full width' : `${readerPx} pixels wide`}
                  tabIndex={0}
                  onPointerDown={onReaderPointerDown}
                  onPointerMove={onReaderPointerMove}
                  onPointerUp={onReaderPointerUp}
                  onPointerCancel={onReaderPointerUp}
                  onPointerLeave={onReaderPointerLeave}
                  onLostPointerCapture={onReaderLostPointerCapture}
                  onKeyDown={onReaderKeyDown}
                />
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
                        {h.err && <span className="chip chip-err txn-pill"><AlertTriangle size={14} aria-hidden="true" /> failed</span>}
                        {h.tokens && <span className="txn-tokbadge tnum"><Coins size={14} aria-hidden="true" /> {h.tokens}</span>}
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
              </div>
              <table className="dtable txn-filetable">
                <thead>
                  <tr>
                    <th><button type="button" className="txn-sort" onClick={() => setFileSort((s) => ({ key: 'path', dir: s.key === 'path' && s.dir === 'asc' ? 'desc' : 'asc' }))}>file {fileSort.key === 'path' ? (fileSort.dir === 'asc' ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />) : null}</button></th>
                    <th className="txn-files-churn-col"><button type="button" className="txn-sort" onClick={() => setFileSort((s) => ({ key: 'churn', dir: s.key === 'churn' && s.dir === 'asc' ? 'desc' : 'asc' }))}>lines +/− {fileSort.key === 'churn' ? (fileSort.dir === 'asc' ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />) : null}</button></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiles.map((f) => (
                    <tr key={f.path} className="txn-filerow">
                      <td>
                        <button
                          type="button"
                          className="txn-file-cell"
                          onClick={() => openFile(f)}
                          aria-label={f.edited ? `${f.path}, jump to diffs` : `${f.path}, jump to last read`}
                          title={f.edited ? 'jump to diffs' : 'jump to last read'}
                        >
                          {f.edited ? <Pencil size={14} aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
                          <span className="mono txn-file-path">…/{f.leaf}</span>
                          <span className="txn-file-counts tnum">{f.reads ? `${f.reads}r ` : ''}{f.edits ? `${f.edits}e ` : ''}{f.writes ? `${f.writes}w` : ''}</span>
                        </button>
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
                  <Tooltip key={a.id} content={meta.tip}><button type="button" className="txn-anno-row" onClick={() => jumpTo(a.turn)}>
                    <span className="txn-anno-turn tnum">turn {a.turn}{annoRole ? ', ' + annoRole : ''}</span>
                    <span className={'chip txn-pill ' + meta.chip}><Icon size={14} aria-hidden="true" /> {meta.label}</span>
                    <span className="txn-anno-label">{a.label}</span>
                    {a.preview && <span className="txn-anno-preview mono">{a.preview}</span>}
                    <ChevronRight size={14} aria-hidden="true" />
                  </button></Tooltip>
                )
              })}
            </div>
          )}

          {/* ===================== ZEN ===================== */}
          {/* ledger only: the reading layout is the surface zen belongs to, so classic gains no
              control, no mode class and no reserved gutter. The only way out of zen. It lives in
              the center column, and the ledger stream reserves its gutter, so it never covers
              the reader. It is one stable toggle: the word "zen" never changes, the switch tracks
              the pressed state, and its accessible name stays "zen mode" in both states. */}
          {ledger && (
            <button
              type="button"
              className="txn-zen-control"
              aria-pressed={zen}
              aria-label="zen mode"
              onClick={() => setZen(!zen)}
            >
              <span className="txn-zen-label">zen</span>
              <span className="txn-zen-switch" aria-hidden="true" />
            </button>
          )}
        </section>

        {/* RIGHT: filters */}
          <Collapsible as="aside" className="txn-rail txn-rail-right" aria-label="filters"
            open={!zenActive && tabHasFilters && rightRailOpen} keepMounted animateSize={false}>
            <div className="txn-rail-head">
              <SlidersHorizontal size={14} aria-hidden="true" /> <span className="txn-rail-title">filters</span>
              {filtersActive > 0 && <span className="chipx-count unread tnum">{filtersActive}</span>}
              <button type="button" className="txn-rail-collapse" aria-label="collapse filters" title="collapse" onClick={() => { railFocusRef.current = 'right'; commitSidebarLayout({ filters: false }) }}>
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
          </Collapsible>
          <Collapsible className="txn-rail-strip txn-rail-strip-right"
            open={!zenActive && tabHasFilters && !rightRailOpen} keepMounted animateSize={false}>
            <button type="button" className="txn-rail-reopen" aria-label="expand filters" title="expand filters" onClick={() => { railFocusRef.current = 'right'; commitSidebarLayout({ filters: true }) }}>
              <PanelRightOpen size={14} aria-hidden="true" />
              <span className="txn-rail-strip-label">filters{filtersActive > 0 ? <span className="chipx-count unread tnum">{filtersActive}</span> : null}</span>
            </button>
          </Collapsible>
      </div>

      {/* ===================== OVERLAYS ===================== */}
      <dialog
        id={mobileDrawerId}
        ref={mobileDialogRef}
        className="txn-mobile-drawer"
        aria-label={mobileDrawer === 'outline' ? 'user turns' : 'filters'}
        onTransitionEnd={(event) => { if (event.target === event.currentTarget && event.propertyName === 'display' && !mobileDrawer) setExitingMobileDrawer(null) }}
        onCancel={(event) => { event.preventDefault(); closeMobileDrawer() }}
        onClick={(event) => { if (event.target === event.currentTarget) closeMobileDrawer() }}
      >
        {(mobileDrawer || exitingMobileDrawer) && <div className="txn-mobile-drawer-panel" inert={!mobileDrawer} onTransitionEnd={(event) => { if (event.target === event.currentTarget && event.propertyName === 'transform' && !mobileDrawer) setExitingMobileDrawer(null) }}>
          <div className="txn-mobile-drawer-head">
            <button type="button" aria-pressed={mobileDrawer === 'outline'} onClick={() => { mobileOpenerRef.current = mobileToolsRef.current; if (mobileDrawer === 'outline') closeMobileDrawer(); else setMobileDrawer('outline') }}>user turns</button>
            {tabHasFilters && <button type="button" aria-pressed={mobileDrawer === 'filters'} onClick={() => { mobileOpenerRef.current = mobileToolsRef.current; if (mobileDrawer === 'filters') closeMobileDrawer(); else setMobileDrawer('filters') }}>filters</button>}
            <button type="button" aria-label="close drawer" onClick={closeMobileDrawer}><X size={14} aria-hidden="true" /></button>
          </div>
          <div className="txn-mobile-drawer-body">
            {(mobileDrawer || exitingMobileDrawer) === 'outline'
              ? <OutlineRail viewModel={vm} tab={tab} presentation={presentation} activeTurn={activeTurn} onJump={(idx) => { jumpTo(idx, { switchTab: false }); closeMobileDrawer() }} />
              : <FiltersRail tab={tab} filters={filters} onFiltersChange={setFilters} counts={counts} checkpoints={commits} filtersActive={filtersActive}
                onClear={() => setFilters({ ...DEFAULT_FILTERS, toolGroups: Object.fromEntries(TOOL_GROUPS.map((id) => [id, true])) })}
                onJumpStart={() => { jumpTo(visibleTurns[0]?.index ?? 0, { switchTab: false }); closeMobileDrawer() }}
                onJumpLatest={() => { jumpTo(visibleTurns[visibleTurns.length - 1]?.index ?? 0, { switchTab: false }); closeMobileDrawer() }} />}
          </div>
        </div>}
      </dialog>
      {/* per-turn label popover — rendered ONLY when canLabel (capability-gated). */}
      {canLabel && labelFor != null && (
        <LabelPopover turnId={labelFor} current={savedLabels[labelFor]} onSave={saveLabel} onClose={() => setLabelFor(null)} />
      )}

      {/* The bottom bar carries the session views as its first row and the (keyboard-only) hint
          and position as a smaller second one. The tab row never leaves — a touch screen has no
          keyboard, but it still needs to reach every view. */}
      <footer className="txn-footer">
        <Collapsible open={mobile && mobileToolsOpen} keepMounted className="txn-mobile-utilities">
        <div className="txn-mobile-controls">
          {mobile && utilityActions}
          {mobile && showTail && moreActions}
          <button className="txn-mobile-rail-button" ref={mobileOutlineRef} type="button" aria-label="user turns" title="user turns" aria-controls={mobileDrawerId} aria-expanded={mobileDrawer === 'outline'} onClick={() => { mobileOpenerRef.current = mobileToolsRef.current; setMobileToolsOpen(false); setMobileDrawer('outline') }}><LayoutList size={14} aria-hidden="true" /></button>
          {tabHasFilters && <button className="txn-mobile-rail-button" ref={mobileFiltersRef} type="button" aria-label="filters" title="filters" aria-controls={mobileDrawerId} aria-expanded={mobileDrawer === 'filters'} onClick={() => { mobileOpenerRef.current = mobileToolsRef.current; setMobileToolsOpen(false); setMobileDrawer('filters') }}><SlidersHorizontal size={14} aria-hidden="true" /></button>}
        </div>
        </Collapsible>
        <div className="txn-foot-tabs">
          {tabStrip}
          {showSearchTrigger && (
            <button
              type="button"
              className="btn btn-secondary txn-search-trigger"
              aria-keyshortcuts="Meta+F Control+F"
              onClick={openSearch}
            >
              <Search size={14} aria-hidden="true" />
              <span className="txn-search-trigger-text">search transcript</span>{' '}
              <kbd className="txn-search-key">⌘F</kbd>
            </button>
          )}
          {mobile && <button ref={mobileToolsRef} type="button" className="txn-mobile-tools-toggle" aria-label="transcript tools" title="transcript tools" aria-expanded={mobileToolsOpen} onClick={() => setMobileToolsOpen(open => !open)}><MenuIcon size={14} aria-hidden="true" /></button>}
        </div>
        {(footerHints || footerProgress) && (
          <div className="txn-foot-meta">
            {footerHints && (
              <div className="txn-hint">
                <kbd className="kbd-key">⌘</kbd><kbd className="kbd-key">f</kbd> search, <kbd className="kbd-key">j</kbd>/<kbd className="kbd-key">k</kbd> step turns
              </div>
            )}
            {footerProgress && (
              <div className="txn-progress tnum" aria-hidden="true">{progress.cur} of {progress.total}</div>
            )}
          </div>
        )}
      </footer>
    </div>
  )
}

import { formatCount, formatInteger } from '../format.js'
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
import { isConversationTurn } from '@peasant-labs/schema'
import ProviderIcon from '../ProviderIcon.jsx'
import { formatDurationMins, formatDurationMs } from './time.js'
import { DEFAULT_TRANSCRIPT_FILTERS, categoryCounts, filtersActive as countActiveFilters, projectTurn } from './filters.js'
import { actionGroups } from './action-groups.js'
import {
  formatByteExtent,
  isWordlessAssistant,
  loadedRegions,
  loadedScope,
  loadedFiles,
  loadedToolGroupCounts,
  mountedCardBound,
  normaliseSegments,
  regionBoundaries,
  scrubberTicks,
  turnsFromSegments,
  windowCoverage,
  windowFailureCaption,
} from './segments.js'
import TranscriptBoundary from './TranscriptBoundary.jsx'
import { turnAtReadingLine } from './scroll-position.js'
import useReaderWidthAnchor from './useReaderWidthAnchor.js'
import TurnCard from './TurnCard.jsx'
import IntegrityBadge from './IntegrityBadge.jsx'
import { integrityView } from './integrity.js'
import Collapsible from './Collapsible.jsx'
import TranscriptContext from './TranscriptContext.jsx'
import { UsageScopes } from './UsageDisclosure.jsx'
import DiffEntryCard from './DiffEntryCard.jsx'
import OutlineRail from './OutlineRail.jsx'
import FiltersRail from './FiltersRail.jsx'
import TranscriptSystemGroup from './SystemGroup.jsx'
import { systemGroups as groupSystemTurns } from './system-groups.js'
import { systemGroupFacetKinds, filterSystemGroupMembers, systemGroupFacetKey, systemGroupFacetSelected, toggleSystemGroupFacet } from './system-group-facet.js'
import { hasImageParts } from './image-parts.js'
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
  const grid = stream.closest('.txn-body-grid')
  let width = (stream.clientWidth || 0) - pad
  if (grid?.dataset.readerRoom === 'true') {
    const sideWidth = side => {
      const state = grid.dataset[`${side}Rail`]
      if (state === 'none') return 0
      return grid.querySelector(`.txn-rail${state === 'closed' ? '-strip' : ''}-${side}`)?.getBoundingClientRect().width ?? 0
    }
    width = grid.clientWidth - sideWidth('left') - sideWidth('right') - pad
  }
  width = Math.floor(width)
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

/* the canonical default view-state lives in filters.js so the rail's fallback, this
   viewer's unmanaged state, and every host's onClear reset cannot disagree. */
const DEFAULT_FILTERS = DEFAULT_TRANSCRIPT_FILTERS

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
      {(phase.turnCount != null || phase.errors) && <span className="rng tnum">{phase.turnCount != null ? `${formatInteger(phase.turnCount)} ${phase.turnCount === 1 ? 'turn' : 'turns'}` : ''}{phase.errors ? `${phase.turnCount != null ? ', ' : ''}${formatInteger(phase.errors)} error` : ''}</span>}
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
  attachmentUrl,
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
  integrity,
  transcriptContentHash,
  contentHash,
  directory,
  segments: segmentsProp,
  window: windowProp,
  onLoadSegment,
  onLoadWindow,
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
  const segmentMode = segmentsProp != null
  const loadedSegments = useMemo(() => (segmentMode ? normaliseSegments(segmentsProp) : []), [segmentMode, segmentsProp])
  const windowKey = segmentMode && windowProp
    ? `${viewModel?.session?.id ?? ''}:${windowProp.revision ?? ''}:${windowProp.anchorTurn}:${(windowProp.segments ?? []).join(',')}`
    : ''
  const [windowFailure, setWindowFailure] = useState(null)
  const [windowRetry, setWindowRetry] = useState(0)
  const activeFailure = windowFailure && windowFailure.sessionId === viewModel?.session?.id && (!windowKey || !windowFailure.key || windowFailure.key === windowKey) ? windowFailure : null
  const rawCoverage = useMemo(() => (segmentMode ? windowCoverage(windowProp, loadedSegments) : null), [segmentMode, windowProp, loadedSegments])
  const coverage = activeFailure ? null : rawCoverage
  /* A window renders only once every covering segment is in hand. A partly loaded
     window is held back, so the reader never meets a false boundary inside it. */
  const heldWindow = !!(segmentMode && coverage?.required && !coverage.complete)
  const heldSegments = heldWindow ? loadedSegments.filter((segment) => coverage.indexes.includes(segment.index)) : []
  const heldRegions = loadedRegions(directory, heldSegments)
  const renderedSegments = useMemo(
    () => (segmentMode
      ? (heldWindow ? loadedSegments.filter((segment) => !coverage.indexes.includes(segment.index)) : loadedSegments)
      : []),
    [segmentMode, heldWindow, loadedSegments, coverage],
  )
  const segmentTurns = useMemo(() => (segmentMode ? turnsFromSegments(renderedSegments) : null), [segmentMode, renderedSegments])
  const allSegmentTurns = useMemo(() => (segmentMode ? turnsFromSegments(loadedSegments) : null), [segmentMode, loadedSegments])
  const vm = useMemo(() => (segmentMode ? { ...viewModel, turns: segmentTurns } : viewModel), [segmentMode, viewModel, segmentTurns])
  /* The region model is the segments in hand, including a window run that is still
     arriving: a loaded segment is never reported as unloaded just because its window
     is incomplete. The trace mounts only `renderedSegments`; the boundary and scope
     describe what the host has actually loaded. */
  const regions = useMemo(() => (segmentMode ? loadedRegions(directory, loadedSegments) : []), [segmentMode, directory, loadedSegments])
  const boundaries = useMemo(() => (segmentMode ? regionBoundaries(directory, regions) : []), [segmentMode, directory, regions])
  const scope = useMemo(() => (segmentMode ? loadedScope(directory, regions) : null), [segmentMode, directory, regions])
  const scrubTicks = useMemo(() => (segmentMode ? scrubberTicks(directory) : []), [segmentMode, directory])
  const loadedTurnBound = useMemo(() => (segmentMode ? mountedCardBound(loadedSegments) : 0), [segmentMode, loadedSegments])
  const tabsId = useId()
  /* the served integrity flag: null draws nothing; otherwise the badge draws, and the listed
     positions are marked only when the rendered content is the content the flag refers to */
  const integrityState = useMemo(() => integrityView(integrity, transcriptContentHash, contentHash), [integrity, transcriptContentHash, contentHash])
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
  const activeSegmentTick = useMemo(
    () => (segmentMode ? (regions.find((region) => region.turns.some((turn) => turn.index === activeTurn))?.firstSegment ?? 0) : 0),
    [segmentMode, regions, activeTurn],
  )
  const [query, setQuery] = useControllable(searchProp, onSearchChange, '')
  const [filters, setFilters] = useControllable(filtersProp, onFiltersChange, DEFAULT_FILTERS)
  const [savedLabels, setSavedLabels] = useControllable(savedLabelsProp, onSavedLabelsChange, {})
  // the action-menu disclosures are view-state too (controllable; default CLOSED).
  const [shareOpen, setShareOpen] = useControllable(shareOpenProp, onShareOpenChange, false)
  const [moreOpen, setMoreOpen] = useControllable(moreOpenProp, onMoreOpenChange, false)
  // Compact overlays follow the viewer's own width, including a narrow embed on a
  // wide screen. They never update the persisted desktop rail layout.
  const viewerRef = useRef(null)
  const [mobile, setMobile] = useState(false)
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const [mobileDrawer, setMobileDrawer] = useState(null)
  const [exitingMobileDrawer, setExitingMobileDrawer] = useState(null)
  const mobileDialogRef = useRef(null)
  const mobileOpenerRef = useRef(null)
  const mobileOutlineRef = useRef(null)
  const mobileFiltersRef = useRef(null)
  const mobileToolsRef = useRef(null)
  const mobileDrawerKindRef = useRef(null)
  if (mobileDrawer) mobileDrawerKindRef.current = mobileDrawer
  const mobileDrawerId = useId()
  const closeMobileDrawer = useCallback(() => {
    setExitingMobileDrawer(mobileDrawer)
    setMobileDrawer(null)
    requestAnimationFrame(() => mobileOpenerRef.current?.focus())
  }, [mobileDrawer])
  const onDrawerKey = event => {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length > 0 && !element.closest('[inert]'))
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus({ preventScroll: true })
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus({ preventScroll: true })
    }
  }
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
  useLayoutEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return undefined
    const update = () => {
      // The established two-rail fit width is the laptop token plus one large inset.
      const style = getComputedStyle(viewer)
      const railFit = parseFloat(style.getPropertyValue('--bp-lg')) + parseFloat(style.getPropertyValue('--sp-8'))
      // Server/test renders without layout keep their desktop presentation.
      if (!viewer.clientWidth || !Number.isFinite(railFit)) return
      const compact = viewer.clientWidth < railFit
      setMobile(compact)
      if (!compact) { setMobileDrawer(null); setMobileToolsOpen(false) }
    }
    update()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    observer?.observe(viewer)
    window.addEventListener('resize', update)
    return () => { observer?.disconnect(); window.removeEventListener('resize', update) }
  }, [])
  useEffect(() => { setMobileDrawer(null); setMobileToolsOpen(false) }, [vm?.session?.id])
  // Open groups and a temporary system reveal belong to one transcript. Reset on a session
  // CHANGE only: a passive reset on mount would close a group an initial position just opened.
  const groupStateSessionRef = useRef(vm?.session?.id ?? '')
  useEffect(() => {
    const sessionId = vm?.session?.id ?? ''
    if (groupStateSessionRef.current === sessionId) return
    groupStateSessionRef.current = sessionId
    setOpenSystemGroups({})
    setSystemFacet({})
    setSystemReveal(null)
  }, [vm?.session?.id])
  useEffect(() => {
    if (!mobileToolsOpen) return
    const onKey = (event) => { if (event.key === 'Escape' && !event.defaultPrevented) { setMobileToolsOpen(false); mobileToolsRef.current?.focus() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileToolsOpen])
  useEffect(() => {
    revealTab(tabRefs.current[tab])
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
  /* a session-scoped temporary reveal for a turn hidden ONLY by the system category: a
     search hit or a copied anchor must be able to land on it without writing the reader's
     persisted filter choice. Ended by any filter change (the fingerprint stops matching)
     or a session switch. */
  const [systemReveal, setSystemReveal] = useState(null)
  const [openSystemGroups, setOpenSystemGroups] = useState({})
  /* Ephemeral per-kind facet selection for a system-entry group, keyed by group id. It is
     reader state for one reading: never persisted, and a group whose id changes starts
     unfiltered. */
  const [systemFacet, setSystemFacet] = useState({})
  const [searchUnrendered, setSearchUnrendered] = useState(false)
  const [searchMeasurements, setSearchMeasurements] = useState({ query: '', sections: {} })
  const [selectedSearchRange, setSelectedSearchRange] = useState(null)
  const [diffMode, setDiffMode] = useState('file')
  const [diffGroupsOpen, setDiffGroupsOpen] = useState({}) // path -> open? (default open)
  const [fileSort, setFileSort] = useState({ key: 'path', dir: 'asc' })
  /** @type {[TraceReadingPosition | null, (value: TraceReadingPosition | null) => void]} */
  const [traceReadingPosition, setTraceReadingPosition] = useState(null)

  const session = vm?.session ?? {}
  const turns = vm?.turns ?? []

  /* ── segmented window loading ──────────────────────────────────────────────────
     A window descriptor names its covering segments in order. The viewer asks for
     each one it does not hold, in descriptor order, exactly once; once all are in
     hand the region renders whole. A window whose turns are already mounted asks
     for nothing. */
  const pendingJumpRef = useRef(null)
  const pendingSeekRef = useRef(null)
  const ackScrollRef = useRef(null)
  const windowAttemptRef = useRef({ sessionId: session.id, sequence: 0 })
  if (windowAttemptRef.current.sessionId !== session.id) windowAttemptRef.current = { sessionId: session.id, sequence: 0 }
  const [loadingSegment, setLoadingSegment] = useState(null)
  const windowRequestRef = useRef({ key: '', indexes: new Set() })
  const loadedIndexKey = loadedSegments.map((segment) => segment.index).join(',')
  const previousWindowRef = useRef(null)
  useEffect(() => {
    const previous = previousWindowRef.current
    if (windowKey && rawCoverage?.complete && activeFailure?.key === windowKey) setWindowFailure(null)
    if (!windowKey && previous?.key && previous.incomplete && previous.sessionId === session.id) {
      setWindowFailure(current => current ?? { ...previous, kind: 'window' })
    }
    if (windowKey && activeFailure?.kind === 'window' && (!previous || previous.key !== windowKey) && windowProp.anchorTurn === activeFailure.anchor) setWindowFailure(null)
    previousWindowRef.current = windowKey ? { key: windowKey, anchor: windowProp.anchorTurn, segments: windowProp.segments ?? [], sessionId: session.id, incomplete: !rawCoverage?.complete, missing: rawCoverage?.missing ?? [] } : null
  }, [windowKey, rawCoverage?.complete, session.id, windowProp, activeFailure])
  useEffect(() => {
    if (!segmentMode || !windowKey) {
      windowRequestRef.current = { key: '', indexes: new Set() }
      return
    }
    if (activeFailure) return
    if (typeof onLoadSegment !== 'function') return
    if (windowRequestRef.current.key !== windowKey) windowRequestRef.current = { key: windowKey, indexes: new Set() }
    const request = windowRequestRef.current
    const held = new Set(loadedSegments.map((segment) => segment.index))
    for (const index of windowProp.segments ?? []) {
      if (held.has(index) || windowRequestRef.current.indexes.has(index)) continue
      windowRequestRef.current.indexes.add(index)
      const fail = () => {
        if (windowRequestRef.current === request) setWindowFailure({ key: windowKey, anchor: windowProp.anchorTurn, segments: windowProp.segments ?? [], sessionId: session.id, kind: 'segment' })
      }
      try {
        const result = onLoadSegment(index)
        if (result && typeof result.then === 'function') Promise.resolve(result).catch(fail)
      } catch {
        fail()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentMode, windowKey, loadedIndexKey, onLoadSegment, activeFailure, windowRetry])

  function requestWindow(anchor) {
    const attempt = ++windowAttemptRef.current.sequence
    const fail = () => {
      if (windowAttemptRef.current.sessionId === session.id && windowAttemptRef.current.sequence === attempt) setWindowFailure({ key: '', anchor, sessionId: session.id, kind: 'window' })
    }
    try {
      const result = onLoadWindow(anchor)
      if (result && typeof result.then === 'function') Promise.resolve(result).catch(fail)
    } catch {
      fail()
    }
  }

  function retryWindow() {
    if (!activeFailure) return
    const failure = activeFailure
    setWindowFailure(null)
    if (failure.kind === 'segment' && windowKey) {
      windowRequestRef.current = { key: '', indexes: new Set() }
      setWindowRetry(value => value + 1)
    } else if (typeof onLoadWindow === 'function') {
      requestWindow(failure.anchor)
    } else if (typeof onLoadSegment === 'function') {
      for (const index of failure.missing ?? []) {
        const fail = () => setWindowFailure(failure)
        try {
          const result = onLoadSegment(index)
          if (result && typeof result.then === 'function') Promise.resolve(result).catch(fail)
        } catch {
          fail()
        }
      }
    }
  }

  useEffect(() => {
    setSearchMeasurements({ query: '', sections: {} })
    setSelectedSearchRange(null)
  }, [turns, session.id])

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
  const [readerRoom, setReaderRoom] = useState(false)
  useLayoutEffect(() => {
    const grid = bodyGridRef.current
    if (!ledger || tab !== 'trace' || viewMode !== 'list' || !grid || readerStored === READER_FULL) { setReaderRoom(false); return undefined }
    const update = () => {
      const style = getComputedStyle(grid)
      const measure = name => {
        const probe = document.createElement('div')
        probe.style.cssText = `position:absolute;visibility:hidden;width:var(${name});`
        grid.appendChild(probe)
        const width = probe.getBoundingClientRect().width
        probe.remove()
        return width
      }
      const rail = Math.max(measure('--txn-outline-w'), measure('--txn-filters-w'))
      const lane = measure('--txn-reader-lane')
      setReaderRoom(grid.clientWidth >= Math.max(READER_MIN, readerStored) + 2 * (rail + lane))
    }
    update()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    observer?.observe(grid)
    window.addEventListener('resize', update)
    return () => { observer?.disconnect(); window.removeEventListener('resize', update) }
  }, [ledger, readerStored, tab, viewMode])
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
  }, [ledger, tab, viewMode, readerRoom, leftRailOpen, rightRailOpen])
  const tabRefs = useRef({})
  // Scroll only the strip: scrollIntoView would also move the host/page. The
  // canonical inset focus ring stays inside the revealed tab's border box.
  function revealTab(item) {
    const strip = item?.parentElement
    if (!item || !strip) return
    const view = strip.getBoundingClientRect(), box = item.getBoundingClientRect()
    if (box.left < view.left) strip.scrollLeft -= view.left - box.left
    else if (box.right > view.right) strip.scrollLeft += box.right - view.right
  }
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
  function revealAction(turn, where, { select = true, search = false, occurrence = 0, sourceOnly = false } = {}) {
    if (where !== 'body' && where !== 'thinking') {
      const call = turns.find(item => item.index === turn)?.toolCalls?.find(tool => tool.id === where || `source:${tool.sourceIndex}` === where)
      if (call) setOpenTools(previous => ({ ...previous, [toolStateKey(turn, call)]: true }))
    }
    setSearchReveal({ turn, where, select, search, occurrence, sourceOnly, sequence: ++revealSequence.current })
  }

  /* ── cooked slices off the VM ───────────────────────────────────────────────── */
  const phases = vm?.analytics?.phases ?? []
  /* A segmented viewer reads only what it has loaded. The VM's task/file/highlight
     slices may describe the whole session (the host supplies the header projection),
     so keep the entries whose turns are in the rendered regions. */
  const loadedTurnIndexes = useMemo(() => new Set(allSegmentTurns?.map((turn) => turn.index) ?? []), [allSegmentTurns])
  const inLoadedTurns = useCallback((turnIndex) => !segmentMode || loadedTurnIndexes.has(turnIndex), [segmentMode, loadedTurnIndexes])
  const tasks = useMemo(
    () => (segmentMode
      ? (vm?.tasks ?? []).filter((task) => (task.turnIndices ?? []).some((index) => loadedTurnIndexes.has(index)))
      : vm?.tasks ?? []),
    [segmentMode, vm?.tasks, loadedTurnIndexes],
  )
  const files = useMemo(
    () => (segmentMode ? loadedFiles(allSegmentTurns ?? []) : vm?.files ?? []),
    [segmentMode, allSegmentTurns, vm?.files],
  )
  const diffs = useMemo(
    () => (segmentMode ? (vm?.diffs ?? []).filter((diff) => inLoadedTurns(diff.turn)) : vm?.diffs ?? []),
    [segmentMode, vm?.diffs, inLoadedTurns],
  )
  const highlights = useMemo(
    () => (segmentMode ? (vm?.highlights ?? []).filter((highlight) => inLoadedTurns(highlight.turn)) : vm?.highlights ?? []),
    [segmentMode, vm?.highlights, inLoadedTurns],
  )
  const scorecardBands = vm?.analytics?.scorecardBands ?? []
  const commits = session?.git?.commits ?? []
  const annotations = useMemo(
    () => (segmentMode
      ? (allSegmentTurns ?? []).flatMap((turn) => turn.annotations ?? [])
      : vm?.analytics?.patternAnnotations ?? turns.flatMap((t) => t.annotations ?? [])),
    [segmentMode, vm?.analytics?.patternAnnotations, turns, allSegmentTurns],
  )
  const toolGroupCounts = useMemo(
    () => (segmentMode ? loadedToolGroupCounts(allSegmentTurns ?? []) : vm?.filterIndex?.toolGroupCounts ?? {}),
    [segmentMode, allSegmentTurns, vm?.filterIndex?.toolGroupCounts],
  )
  const activeModel = turns.find((turn) => turn.index === activeTurn)?.effectiveModel
  /* The left rail reads the same loaded regions the trace does: its tasks, files and
     annotations come from the turns the viewer actually holds, never a whole-session
     projection. */
  const railViewModel = useMemo(
    () => (segmentMode
      ? { ...vm, tasks, files, diffs, highlights, analytics: { ...(vm?.analytics ?? {}), patternAnnotations: annotations } }
      : vm),
    [segmentMode, vm, tasks, files, diffs, highlights, annotations],
  )

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
    const systemRevealMatch = systemReveal != null && systemReveal.sessionId === session.id && systemReveal.filterFingerprint === filterFingerprint(filters)
    return turns.map((t) => {
      // A temporary system reveal projects exactly its one turn with the system category
      // on; every other filter dimension stays the reader's, so nothing else appears.
      const effectiveFilters = systemRevealMatch && systemReveal.turn === t.index && t.role === 'system'
        ? { ...filters, categories: { ...filters.categories, system: true } }
        : filters
      const projected = projectTurn(t, effectiveFilters, ctx)
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
  }, [turns, filters, commits, vm, searchReveal, systemReveal, session.id])
  const actionLayout = useMemo(() => actionGroups(turns, visibleTurns), [turns, visibleTurns])

  /* Conversation turns. Every turn COUNT reports this set, and the contract owns the
     rule (`isConversationTurn`): a top-level user or assistant entry of text or image.
     System entries, tool rows and thinking rows are not conversation turns. The filters
     still reveal them, and each category's badge keeps its own entry count. */
  const conversationTurns = useMemo(() => turns.filter(isConversationTurn), [turns])
  const visibleConversationCount = useMemo(() => visibleTurns.filter(isConversationTurn).length, [visibleTurns])
  /* The trace header's count. With a directory total the header stays in one unit while
     segments load: the total alone once every segment is held and no filter hides a held
     conversation turn, otherwise the visible count against it. Neither client count is
     compared with the total, because the adapter can drop or merge legacy turns. */
  const traceCountText = useMemo(() => {
    const total = scope?.totalConversationTurns
    const unit = (count) => (count === 1 ? 'turn' : 'turns')
    if (total != null) {
      return scope.complete && visibleConversationCount === conversationTurns.length
        ? `${formatInteger(total)} ${unit(total)}`
        : `${formatInteger(visibleConversationCount)} of ${formatInteger(total)} ${unit(total)}`
    }
    if (segmentMode && scope && !scope.complete) return `${formatInteger(visibleConversationCount)} of ${formatInteger(scope.totalTurns)} turns`
    return visibleConversationCount === conversationTurns.length
      ? `${formatInteger(conversationTurns.length)} turns`
      : `${formatInteger(visibleConversationCount)} of ${formatInteger(conversationTurns.length)} turns`
  }, [segmentMode, scope, visibleConversationCount, conversationTurns.length])

  /* Runs of consecutive visible system turns. Ledger-only: classic keeps its full cards, so
     there is nothing to fold there. */
  const systemGroups = useMemo(() => (ledger ? groupSystemTurns(visibleTurns) : new Map()), [ledger, visibleTurns])

  /* Where each boundary renders. A folded system-group member is not its own row. A
     between boundary normally follows the last rendered turn before the gap; when a
     held window leaves none, it renders before the first rendered turn after the gap
     so a counted boundary can never be missing from the DOM. */
  const boundaryPlacement = useMemo(() => {
    if (!segmentMode) return { leading: null, trailing: null, after: new Map(), before: new Map(), count: 0 }
    const isRenderedRow = (turn) => {
      const group = systemGroups.get(turn.index)
      return !group || group.owner.index === turn.index
    }
    const rows = visibleTurns.filter(isRenderedRow)
    const lastVisibleBefore = (turnIndex) => [...rows].reverse().find((turn) => turn.index < turnIndex)
    const firstVisibleAfter = (turnIndex) => rows.find((turn) => turn.index > turnIndex)
    const after = new Map()
    const before = new Map()
    for (const boundary of boundaries) {
      if (boundary.side !== 'between') continue
      const preceding = lastVisibleBefore(boundary.firstTurn)
      if (preceding) after.set(preceding.index, boundary)
      else {
        const following = firstVisibleAfter(boundary.lastTurn)
        if (following) before.set(following.index, boundary)
      }
    }
    const leading = boundaries.find((boundary) => boundary.side === 'older' || boundary.side === 'all') ?? null
    const trailing = boundaries.find((boundary) => boundary.side === 'newer') ?? null
    return { leading, trailing, after, before, count: after.size + before.size + (leading ? 1 : 0) + (trailing ? 1 : 0) }
  }, [segmentMode, boundaries, visibleTurns, systemGroups])


  /* A model-actions block is not a turn: only a turn that draws a card (prose, an image, or the
     system row) owns the reading position and the keyboard step. */
  const cardTurns = useMemo(
    () => visibleTurns.filter((t) => t.role === 'system' || hasImageParts(t) || String(t.displayContent ?? t.content ?? '').trim() !== ''),
    [visibleTurns],
  )

  /* The kinds each group offers, derived from that group's own (unfiltered) members. A run of
     one kind gets no facet: the head summary already names it. */
  const systemGroupFacets = useMemo(() => {
    /** @type {Map<string, Array<{ id: string, label: string, count: number }>>} */
    const byGroup = new Map()
    for (const group of new Set(systemGroups.values())) byGroup.set(group.id, systemGroupFacetKinds(group.members))
    return byGroup
  }, [systemGroups])

  /* The navigable list: the drawn cards, with a system-entry group collapsed to one stop at
     its owner plus the members of groups the reader has opened AND the facet still shows.
     Progress, the keyboard step, the reading line, the minimap and jump-latest all read this
     one list, so a closed group is one stop and opening it adds only its visible members. */
  const navigableTurns = useMemo(() => {
    if (systemGroups.size === 0) return cardTurns
    return cardTurns.filter((turn) => {
      const group = systemGroups.get(turn.index)
      if (!group) return true
      if (group.owner.index === turn.index) return true
      if (openSystemGroups[group.id] !== true) return false
      return systemGroupFacetSelected(systemFacet[group.id], systemGroupFacetKey(turn))
    })
  }, [cardTurns, systemGroups, openSystemGroups, systemFacet])

  /* Turns hidden ONLY by the system category: re-project with system on and every other
     filter unchanged. Search enumerates this set so a hit can never exist that no reveal can
     show, and an initial position can reveal one of these without writing the reader's filters. */
  const systemHiddenTurns = useMemo(() => {
    if (filters.categories?.system === true) return []
    const { checkpoint } = filters
    const selCommit = checkpoint !== 'all' ? commits.find((c) => c.shortHash === checkpoint || c.hash === checkpoint) : null
    const ctx = {
      annotationsByTurn: vm?.filterIndex?.annotationsByTurn ?? {},
      checkpointTurn: selCommit?.turn ?? null,
    }
    const revealFilters = { ...filters, categories: { ...filters.categories, system: true } }
    const shown = new Set(visibleTurns.map((turn) => turn.index))
    return turns.map((turn) => projectTurn(turn, revealFilters, ctx)).filter((turn) => turn != null && !shown.has(turn.index))
  }, [turns, filters, commits, vm, visibleTurns])
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
    /* A deep link to a turn in an unloaded segment asks for that turn's window. */
    if (position.kind === 'turn' && segmentMode && !turns.some((turn) => turn.index === position.turnIndex) && typeof onLoadWindow === 'function') {
      if (pendingJumpRef.current !== position.turnIndex) {
        pendingJumpRef.current = position.turnIndex
        requestWindow(position.turnIndex)
      }
      return 'pending'
    }
    // A turn hidden only by the system category is not mounted; reveal it temporarily and
    // let the readiness pass retry once it is present. The reader's filters are untouched.
    if (position.kind === 'turn' && systemHiddenTurns.some((turn) => turn.index === position.turnIndex)) {
      setSystemReveal({ turn: position.turnIndex, sessionId: session.id, filterFingerprint: filterFingerprint(filters), sequence: ++revealSequence.current })
      return 'pending'
    }
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
    const group = openGroupForTurn(position.turnIndex)
    if (location) revealAction(position.turnIndex, location.where, { select: false })
    else if (group) {
      // The member's own anchor, after the fold commits. The fold's own height motion
      // changes the scroller's anchor while it runs, so measure and scroll once that
      // motion settles; scrolling on the first frame lands the member one fold-height off.
      requestAnimationFrame(() => {
        const memberEl = turnRefs.current[position.turnIndex]
        if (!memberEl) return
        const scrollToMember = () => {
          if (!memberEl.isConnected) return
          sc.scrollTo({ top: turnScrollTop(sc, memberEl), behavior: 'auto' })
          latestTraceReadingSnapshotRef.current = readTraceReadingSnapshot()
        }
        const fold = memberEl.closest('.txn-systemgroup')?.querySelector('.txn-disclosure')
        const motion = fold?.getAnimations?.() ?? []
        if (motion.length) Promise.allSettled(motion.map((animation) => animation.finished)).then(scrollToMember)
        else scrollToMember()
      })
    }
    // Only the reading stream moves; scrollIntoView also scrolls clipped layout ancestors.
    else sc.scrollTo({ top: turnScrollTop(sc, el), behavior: 'auto' })
    latestTraceReadingSnapshotRef.current = readTraceReadingSnapshot()
    return 'applied'
  }, [readTraceReadingSnapshot, tab, turns, viewMode, visibleTurns, systemHiddenTurns, ledger, actionLayout, setTab, setViewMode, setOpenTools, filters, session.id, systemGroups])

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
      const idx = target.focusOrigin.turnIndex
      const group = openGroupForTurn(idx)
      const focusAnchor = () => {
        const turn = turnRefs.current[idx]
        const control = turn?.querySelector?.(`.txn-anchor[data-turn-control="${idx}"]`)
        ;(control ?? tabRefs.current.trace)?.focus({ preventScroll: true })
      }
      // A grouped member is inert until its group opens; focus on the next frame.
      if (group) requestAnimationFrame(focusAnchor)
      else focusAnchor()
    } else tabRefs.current.trace?.focus({ preventScroll: true })
    latestTraceReadingSnapshotRef.current = {
      scrollTop: target.scrollTop,
      focusOrigin: target.focusOrigin,
    }
    traceReadingPositionRef.current = null
    setTraceReadingPosition(null)
    return 'applied'
  }, [session?.id, tab, traceReadingPosition, turns, viewMode, visibleTurns, segmentMode, onLoadWindow])

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

  /* The "clear (N)" badge counts how many choices deviate from the canonical default.
     The rule lives in filters.js beside the default it compares against, so the rail's
     fallback and this count cannot drift. */
  const filtersActive = countActiveFilters(filters)

  /* search matches: substring across turn content + tool previews/output. */
  const matches = useMemo(() => {
    if (!query.trim()) return []
    const found = []
    const append = (turn, where, text, hiddenSystem = false) => {
      let raw = 0
      for (const _match of text.matchAll(searchExpression(query))) raw++
      if (!raw) return
      const measured = searchMeasurements.query === query ? searchMeasurements.sections[`${turn}:${where}`] : undefined
      const rendered = measured ?? raw
      for (let occurrence = 0; occurrence < rendered; occurrence++) found.push({ turn, where, occurrence, sourceOnly: false, hiddenSystem })
      if (measured !== undefined) for (let occurrence = 0; occurrence < Math.max(0, raw - rendered); occurrence++) found.push({ turn, where, occurrence, sourceOnly: true, hiddenSystem })
    }
    const appendTurn = (t, hiddenSystem) => {
      append(t.index, 'body', t.displayContent ?? t.content ?? '', hiddenSystem)
      append(t.index, 'thinking', t.thinking?.text || '', hiddenSystem)
      for (const tc of t.toolCalls || []) {
        const out = typeof tc.output === 'string' ? tc.output : tc.output != null ? JSON.stringify(tc.output) : ''
        const hay = [tc.preview, out].filter(Boolean).join(' ')
        if (tc.id || tc.sourceIndex != null) append(t.index, tc.id || `source:${tc.sourceIndex}`, hay, hiddenSystem)
      }
    }
    for (const t of visibleTurns) appendTurn(t, false)
    // A hit the system category hides is revealable by the session-scoped temporary reveal;
    // a turn hidden by any other dimension stays out, exactly as before.
    for (const t of systemHiddenTurns) appendTurn(t, true)
    return found
  }, [query, visibleTurns, systemHiddenTurns, searchMeasurements])

  const progress = useMemo(() => {
    const idx = navigableTurns.findIndex((t) => t.index === activeTurn)
    return { cur: Math.max(1, idx + 1), total: navigableTurns.length }
  }, [activeTurn, navigableTurns])
  /* The bottom bar's quiet row is host opt-in: a host that wants the shortcut hint or the position
     counter passes `footer` with that flag; both stay out of the surface by default. */
  const footerHints = footer?.hints === true
  const footerProgress = footer?.progress === true && tab === 'trace' && viewMode === 'list' && navigableTurns.length > 0

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
  /* A member of a system-entry group resolves to its owner for selection and readiness, but a
     landing still targets the member's own anchor.
     Landing on a folded member also releases a facet that would hide it: the reader asked to
     reach THAT record (a search hit, a copied anchor, an initial position), so a remembered
     per-group narrowing must not make the target unreachable. */
  function openGroupForTurn(idx) {
    const group = systemGroups.get(idx)
    // The owner IS the group's one stop, so landing on it leaves the group closed; landing on
    // a folded member opens the group so that member can be reached.
    if (group && group.owner.index !== idx) {
      setOpenSystemGroups((previous) => (previous[group.id] ? previous : { ...previous, [group.id]: true }))
      setSystemFacet((previous) => (previous[group.id] ? { ...previous, [group.id]: {} } : previous))
    }
    return group
  }
  function jumpTo(idx, { switchTab = true } = {}) {
    if (switchTab && tab !== 'trace') {
      skipTraceRestoreRef.current = true
      setTab('trace')
    }
    setViewMode('list')
    /* A jump to a turn the viewer has not loaded asks the host for that turn's window
       descriptor. The window's covering segments arrive through onLoadSegment; the
       pending effect below lands the reader once they are mounted. */
    if (segmentMode && !turns.some((turn) => turn.index === idx) && typeof onLoadWindow === 'function') {
      pendingJumpRef.current = idx
      selectTurn(idx)
      requestWindow(idx)
      return
    }
    const group = openGroupForTurn(idx)
    // A closed group is one stop at its owner; once opened, its members are stops of their own.
    const groupOpen = group ? openSystemGroups[group.id] === true : false
    const owner = group && !groupOpen ? group.owner.index : idx
    selectTurn(owner)
    const projected = visibleTurns.find(turn => turn.index === owner)
    const location = ledger && !String(projected?.displayContent ?? projected?.content ?? '').trim() ? actionLayout.locations.get(owner) : null
    if (location) { revealAction(owner, location.where); return }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        if (navigationTargetRef.current !== owner) return
        // The group's fold commits before this frame, so a member inside it is laid out now.
        const el = turnRefs.current[idx] ?? turnRefs.current[owner]
        const sc = scrollRef.current
        if (el && sc) {
          const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
          sc.scrollTo({ top: turnScrollTop(sc, el), behavior: reduce ? 'auto' : 'smooth' })
        }
      })
    }
  }
  /* Land a jump once its window's covering segments are mounted. */
  useEffect(() => {
    const target = pendingJumpRef.current
    if (target == null) return
    if (!turns.some((turn) => turn.index === target)) return
    pendingJumpRef.current = null
    jumpTo(target, { switchTab: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns])
  /* A requested segment (boundary, scrubber, window) arrives as new props. Hold the
     reader's turn when content is prepended: remember the reading line, then correct
     the scroll offset against the same turn after layout. */
  useLayoutEffect(() => {
    const pending = ackScrollRef.current
    if (!pending) return
    ackScrollRef.current = null
    const sc = scrollRef.current
    if (!sc || tab !== 'trace' || viewMode !== 'list') return
    const el = turnRefs.current[pending.turnIndex]
    if (!el) return
    sc.scrollTop = el.offsetTop - pending.offset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedIndexKey, turns])
  useEffect(() => { setLoadingSegment(null) }, [loadedIndexKey])
  function captureReadingAnchor() {
    const sc = scrollRef.current
    if (!sc || typeof document === 'undefined') return null
    const anchor = navigableTurns.find((turn) => {
      const el = turnRefs.current[turn.index]
      return el && el.offsetTop + el.offsetHeight > sc.scrollTop
    }) ?? navigableTurns[0]
    const el = anchor ? turnRefs.current[anchor.index] : null
    /* the anchor's distance from the viewport top; restoring `offsetTop - offset`
       puts the same turn back at the same place after the prepend shifts the offsets */
    return el ? { turnIndex: anchor.index, offset: el.offsetTop - sc.scrollTop } : null
  }
  function loadSegmentAt(index, { prepend = false } = {}) {
    if (typeof onLoadSegment !== 'function' || index == null || index < 0) return
    if (prepend) {
      const anchor = captureReadingAnchor()
      if (anchor) ackScrollRef.current = anchor
    }
    const result = onLoadSegment(index)
    if (result && typeof result.then === 'function') {
      setLoadingSegment(index)
      const clear = () => setLoadingSegment((current) => (current === index ? null : current))
      Promise.resolve(result).then(clear, clear)
    }
  }
  function loadBoundary(boundary) {
    loadSegmentAt(boundary?.loadSegment, { prepend: boundary?.side === 'older' || boundary?.side === 'between' })
  }
  function seekScrubTick(tick) {
    if (!tick) return
    if (turns.some((turn) => turn.index === tick.firstTurn)) {
      jumpTo(tick.firstTurn, { switchTab: false })
      return
    }
    pendingSeekRef.current = tick
    onLoadSegment?.(tick.index)
  }
  useEffect(() => {
    const pending = pendingSeekRef.current
    if (!pending) return
    if (!turns.some((turn) => turn.index === pending.firstTurn)) return
    pendingSeekRef.current = null
    jumpTo(pending.firstTurn, { switchTab: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns])
  function stepTurn(dir) {
    const ids = (navigableTurns.length ? navigableTurns : visibleTurns).map((t) => t.index)
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
    setActiveTurn(turnAtReadingLine(navigableTurns,
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
    tabRefs.current[TAB_ORDER[j]]?.focus({ preventScroll: true })
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
    if (m.hiddenSystem) {
      // Temporary, session-scoped reveal: it never writes onFiltersChange, and any filter
      // change ends it (the fingerprint stops matching).
      setSystemReveal({ turn: m.turn, sessionId: session.id, filterFingerprint: filterFingerprint(filters), sequence: ++revealSequence.current })
    }
    revealAction(m.turn, m.where, { search: true, occurrence: m.occurrence, sourceOnly: m.sourceOnly })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchNavigation])

  /* A reveal that lands on a grouped member opens its group first, so the member is laid out
     and no longer inert before the scroll measures it. */
  useLayoutEffect(() => {
    if (!searchReveal) return
    const group = systemGroups.get(searchReveal.turn)
    if (group && group.owner.index !== searchReveal.turn) {
      setOpenSystemGroups((previous) => (previous[group.id] ? previous : { ...previous, [group.id]: true }))
      setSystemFacet((previous) => (previous[group.id] ? { ...previous, [group.id]: {} } : previous))
    }
  }, [searchReveal, systemGroups])

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
      const scope = searchReveal.where === 'body' ? el.querySelector('.txn-body') : searchReveal.where === 'thinking' ? el.querySelector('.txn-thinking-box') : el
      const ranges = searchReveal.search ? renderedSearchRanges(scope, query) : []
      const match = searchReveal.search && !searchReveal.sourceOnly ? ranges[searchReveal.occurrence] : null
      if (searchReveal.search) {
        const key = `${searchReveal.turn}:${searchReveal.where}`
        setSearchMeasurements(previous => previous.query === query && previous.sections[key] === ranges.length ? previous : { query, sections: { ...(previous.query === query ? previous.sections : {}), [key]: ranges.length } })
        setSearchUnrendered(!match)
        setSelectedSearchRange(match ?? null)
      }
      if (match) {
        // Bring the text into every inner scrolling viewport before positioning the outer stream.
        for (let ancestor = match.startContainer.parentElement; ancestor && ancestor !== sc; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor)
          const hit = match.getClientRects()[0] ?? match.getBoundingClientRect(), box = ancestor.getBoundingClientRect()
          if (/(auto|scroll)/.test(style.overflowX) && ancestor.scrollWidth > ancestor.clientWidth && (hit.left < box.left || hit.right > box.right)) ancestor.scrollLeft += hit.left - box.left - ancestor.clientWidth * 0.4
          if (/(auto|scroll)/.test(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight && (hit.top < box.top || hit.bottom > box.bottom)) ancestor.scrollTop += hit.top - box.top - ancestor.clientHeight * 0.4
        }
      }
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
  const zenControl = ledger && (
    <button
      type="button"
      className="txn-zen-control"
      aria-pressed={zen}
      aria-label="zen mode"
      onClick={() => {
        setZen(!zen)
        // The compact exit leaves once zen is off, so keep keyboard focus in
        // the persistent footer controls instead of dropping it on the page.
        if (mobile && zen) requestAnimationFrame(() => mobileToolsRef.current?.focus({ preventScroll: true }))
      }}
    >
      <span className="txn-zen-label">zen</span>
      <span className="txn-zen-switch" aria-hidden="true" />
    </button>
  )
  const tabStrip = (
    <div className="tabs txn-tabs" role="tablist" aria-label="session views" onKeyDown={onTabKey} onFocusCapture={event => revealTab(event.target)}>
      {TAB_ORDER.map((id) => {
        const on = tab === id
        const count = id === 'highlights' ? highlights.length
          : id === 'trace' ? conversationTurns.length
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
      ref={viewerRef}
      className={'txn-app' + (theme === 'light' ? ' txn-light' : '') + (ledger ? ' txn-ledger' : '') + (ledger && zen ? ' txn-zen' : '') + (mobile ? ' txn-compact' : '') + (heroCondensed ? ' txn-app-condensed' : '')}
      data-theme={theme}
      data-host-visible={!zenActive && sidebarLayout.host ? 'true' : 'false'}
      style={ledger ? { '--txn-reader-width': readerPx != null ? `${readerPx}px` : '100%' } : undefined}
    >
      <SearchHighlights scrollRef={scrollRef} query={query} enabled={searchOpen && tab === 'trace' && viewMode === 'list'} revision={visibleTurns} selected={selectedSearchRange} />
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
        {/* a served integrity flag draws its badge on the title's line, one step after the text, and
            wraps under it when the title fills the line or the screen is narrow; never in the
            actions row, so the host's actions hold their place. It folds away with the title. */}
        {integrityState
          ? (
            <div className="txn-title-row">
              <TitleHeading className="txn-title" title={title}>{title}</TitleHeading>
              <IntegrityBadge headingLevel={pageLevel + 1} folded={heroCondensed} />
            </div>
          )
          : <TitleHeading className="txn-title" title={title}>{title}</TitleHeading>}
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
          {(session.conversationTurnCount ?? session.turnCount) != null && <span className="metaitem"><ListTree size={14} aria-hidden="true" /> <b className="tnum">{session.conversationTurnCount ?? session.turnCount}</b> turns</span>}
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
            onChange={(e) => { setSelectedSearchRange(null); setSearchUnrendered(false); setQuery(e.target.value); setMatchIdx(0); setSearchNavigation(sequence => sequence + 1) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); navigateSearch(e.shiftKey ? -1 : 1) }
              if (e.key === 'Escape') setSearchOpen(false)
            }}
            aria-label="search transcript"
          />
          <span className="txn-search-count tnum" role="status" aria-live="polite" aria-label={matches.length ? `match ${Math.min(matchIdx, matches.length - 1) + 1} of ${matches.length}` : undefined}>{matches.length ? `${Math.min(matchIdx, matches.length - 1) + 1}/${matches.length}` : '0 matches'}</span>
          {query.trim() && <abbr className="txn-search-estimate" title="Search uses source text. Counts can change when sections open, and rendered-only text may not be found." aria-label="source search; counts can change when sections open and rendered-only text may not be found">approx.</abbr>}
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
        data-reader-fixed={ledger && tab === 'trace' && viewMode === 'list' && readerStored !== READER_FULL ? 'true' : undefined}
        data-reader-room={ledger && readerRoom && !zenActive ? 'true' : undefined}
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
              <OutlineRail viewModel={railViewModel} tab={tab} presentation={presentation} activeTurn={activeTurn} onJump={(idx) => jumpTo(idx, { switchTab: false })} />
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
                    segmentMode ? (
                      /* the ledger timeline is the same bounded segment sample: the
                         transcript never mounts one tick per turn in either presentation */
                      <Scrubber
                        ticks={scrubTicks}
                        activeTick={activeSegmentTick}
                        onSeekTick={seekScrubTick}
                        draggingRef={draggingRef}
                      />
                    ) : (
                      /* the pinned bar is the timeline alone: the title already sits in the
                         breadcrumb and the page header above the trace. */
                      <TranscriptMinimap
                        turns={navigableTurns}
                        activeTurn={activeTurn}
                        onJump={(idx) => jumpTo(idx, { switchTab: false })}
                      />
                    )
                  ) : (
                    <>
                      {session.harness && <ProviderIcon harness={session.harness} accent />}
                      {activeModel && <span className="txn-sticky-model mono">{activeModel}</span>}
                      <Scrubber
                        turns={turns}
                        ticks={segmentMode ? scrubTicks : undefined}
                        active={activeTurn}
                        activeTick={segmentMode ? activeSegmentTick : 0}
                        onSeek={seekScrub}
                        onSeekTick={seekScrubTick}
                        draggingRef={draggingRef}
                      />
                    </>
                  )}
                </div>
              </Collapsible>
              <div className={"txn-trace-head" + (viewMode === 'graph' ? ' txn-trace-head-graph' : '')}>
                <span className="txn-trace-count tnum">{traceCountText}</span>
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
                    data-mounted-turn-bound={segmentMode ? loadedTurnBound : undefined}
                    data-segment-boundaries={segmentMode ? boundaryPlacement.count : undefined}
                    data-segment-mode={segmentMode ? 'true' : undefined}
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
                      attachmentUrl={attachmentUrl}
                    />
                    {activeFailure && (
                      <div className="txn-held-window" role="alert">
                        <span>{windowFailureCaption(directory, activeFailure)}</span>{' '}
                        {(typeof onLoadWindow === 'function' || (typeof onLoadSegment === 'function' && (windowKey || activeFailure.missing?.length))) && (
                          <button type="button" className="txn-segboundary-load" onClick={retryWindow}>try again</button>
                        )}
                      </div>
                    )}
                    {segmentMode && (directory?.totalSegments ?? 0) === 0 && (
                      <div className="empty txn-not-indexed" data-not-indexed="true">
                        <div className="ring"><FileText size={20} aria-hidden="true" /></div>
                        <EmptyHeading>not indexed</EmptyHeading>
                        <p>this transcript has no segments yet. its turns are not available to read.</p>
                      </div>
                    )}
                    {visibleTurns.length === 0 && !(segmentMode && (directory?.totalSegments ?? 0) === 0) && (
                      <div className="empty"><div className="ring"><FilterIcon size={20} aria-hidden="true" /></div><EmptyHeading>no turns to display</EmptyHeading>
                        {filters.categories.system !== true && counts.categories.system > 0 ? (
                          <>
                            <p>
                              {counts.categories.system === 1
                                ? '1 system entry is hidden by the system filter.'
                                : `${counts.categories.system} system entries are hidden by the system filter.`}
                            </p>
                            {/* The one control that makes the hidden records reachable. It writes the
                                reader's filters because this is the reader asking to see them. */}
                            <button
                              type="button"
                              className="txn-empty-show-system"
                              onClick={() => setFilters({ ...filters, categories: { ...filters.categories, system: true } })}
                            >
                              show system entries
                            </button>
                          </>
                        ) : (
                          <p>{segmentMode && boundaries.length > 0
                            ? 'no turn in the loaded segments matches this view. the session continues past the loaded regions.'
                            : 'every turn is filtered out. clear a filter to bring them back.'}</p>
                        )}
                        {segmentMode && boundaries.length > 0 && (
                          <button type="button" className="txn-empty-load" onClick={() => loadBoundary(boundaries[0])}>
                            load more
                          </button>
                        )}
                      </div>
                    )}
                    {(() => {
                      /* In the ledger each prose turn starts its own run of actions. A wordless
                         turn appends to the current run; a user turn closes it; a system row
                         stays where it is and does not split it. A run with no prose of its own
                         anchors at its first work turn, and a run whose source prose anchor is
                         hidden anchors at its first visible work turn, so work never moves
                         forward across a prose boundary. Every other turn in the run draws no
                         work of its own, so no action renders twice. */
                      const groups = ledger ? actionLayout.groups : new Map()
                      const foldedWork = ledger ? actionLayout.folded : new Set()
                      const renderTurn = (t) => (
                        <>
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
                            attachmentUrl={attachmentUrl}
                            savedLabel={savedLabels[t.index]}
                            compact={filters.views.compact}
                            expandAll={filters.views.expandAll}
                            modelActions={groups.get(t.index)}
                            actionReveal={searchReveal && (ledger ? (actionLayout.locations.get(searchReveal.turn)?.owner ?? searchReveal.turn) === t.index : searchReveal.turn === t.index) ? searchReveal : undefined}
                            registerActionRef={registerActionRef}
                            suppressWork={foldedWork.has(t.index)}
                            flagged={integrityState?.positions.has(t.sourcePosition) ?? false}
                            flaggedPositions={integrityState?.positions}
                          />
                          {t.truncated && (
                            <div className="txn-truncation" role="note">
                              <span className="txn-truncation-copy">this turn's text is truncated; {formatByteExtent(t.byteLength)} in full.</span>
                              {callbacks.onLoadFullTurn && (
                                <button type="button" className="txn-truncation-load" onClick={() => callbacks.onLoadFullTurn(t.index)}>
                                  load this turn in full
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )
                      /* One gap boundary, placed once: after the last rendered turn
                         before it, or before the first rendered turn after it when a
                         held window leaves no preceding row. */
                      const isRenderedRow = (turn) => {
                        const group = systemGroups.get(turn.index)
                        return !group || group.owner.index === turn.index
                      }
                      const firstVisibleAfter = (turnIndex) => visibleTurns.find((turn) => turn.index > turnIndex && isRenderedRow(turn))
                      const firstRendered = visibleTurns.find(isRenderedRow)
                      const { leading, trailing, after: internalAfter, before: internalBefore } = boundaryPlacement
                      const continuation = (where) => (
                        <div className="txn-action-continuation" role="note">
                          <span className="txn-action-continuation-rule" aria-hidden="true" />
                          <span>actions continue {where}</span>
                        </div>
                      )
                      let heldPosition = 0
                      const heldBefore = (turnIndex) => {
                        const notes = []
                        while (heldPosition < heldRegions.length && heldRegions[heldPosition].firstTurn < turnIndex) {
                          const region = heldRegions[heldPosition++]
                          notes.push(<div key={region.key} className="txn-held-window" role="status">these turns are hidden because surrounding turns are not loaded</div>)
                        }
                        return notes
                      }
                      return (
                        <>
                          {leading && heldBefore(leading.firstTurn)}
                          {leading && <TranscriptBoundary boundary={leading} loading={loadingSegment === leading.loadSegment} onLoadMore={() => loadBoundary(leading)} />}
                          {segmentMode && leading && firstRendered && !internalBefore.has(firstRendered.index) && isWordlessAssistant(firstRendered) && continuation('from the unloaded turn above')}
                          {visibleTurns.map((t, i) => {
                          const group = systemGroups.get(t.index)
                          /* members 2..N render inside the owner's fold, never as their own row */
                          if (group && group.owner.index !== t.index) return null
                          const prev = visibleTurns[i - 1]
                          const phase = phases.find((p) => t.index >= p.from && t.index <= p.to)
                          const prevPhase = prev ? phases.find((p) => prev.index >= p.from && prev.index <= p.to) : null
                          const showPhase = filters.views.hidden && phase && (!prevPhase || prevPhase.id !== phase.id)
                          const task = taskByFirstTurn.get(t.index)
                          const turnCommits = anchoredCommits.filter((c) => c.turn === t.index)
                          const groupReveal = group && searchReveal && group.owner.index !== searchReveal.turn && group.members.some((member) => member.index === searchReveal.turn) ? searchReveal.sequence : 0
                          const internal = segmentMode ? internalAfter.get(t.index) ?? null : null
                          const internalBeforeThis = segmentMode ? internalBefore.get(t.index) ?? null : null
                          return (
                            <Fragment key={t.identity ?? t.index}>
                              {heldBefore(internalBeforeThis?.firstTurn ?? t.index)}
                              {internalBeforeThis && (
                                <>
                                  <TranscriptBoundary boundary={internalBeforeThis} loading={loadingSegment === internalBeforeThis.loadSegment} onLoadMore={() => loadBoundary(internalBeforeThis)} />
                                  {segmentMode && isWordlessAssistant(firstVisibleAfter(internalBeforeThis.lastTurn)) && continuation('from the unloaded turns between')}
                                </>
                              )}
                              {heldBefore(t.index)}
                              <div className={ledger ? 'txn-turnrow' : undefined}>
                                {showPhase && <PhaseDivider phase={phase} heading={PhaseHeading} />}
                                {/* in ledger a faint rule marks where the role changes; classic gains none */}
                                {ledger && !showPhase && prev && prev.role !== t.role && <hr className="txn-turn-rule" aria-hidden="true" />}
                                {/* in ledger the rail card carries the task identity and duration and
                                    the turn head carries the per-turn identity, so the classic
                                    boundary would repeat both before the first line of prose. */}
                                {!ledger && t.role === 'user' && task && <TaskBoundary task={task} />}
                                {group ? (
                                  <TranscriptSystemGroup
                                    group={group}
                                    open={openSystemGroups[group.id] === true}
                                    onToggle={(open) => setOpenSystemGroups((previous) => ({ ...previous, [group.id]: open }))}
                                    owner={renderTurn(t)}
                                    revealRequest={groupReveal}
                                    facetKinds={systemGroupFacets.get(group.id) ?? []}
                                    facetSelection={systemFacet[group.id]}
                                    onFacetToggle={(id) => setSystemFacet((previous) => ({
                                      ...previous,
                                      [group.id]: toggleSystemGroupFacet(previous[group.id], id),
                                    }))}
                                  >
                                    {filterSystemGroupMembers(group.members.slice(1), systemFacet[group.id]).map((member) => (
                                      <div key={member.identity ?? member.index}>{renderTurn(member)}</div>
                                    ))}
                                  </TranscriptSystemGroup>
                                ) : renderTurn(t)}
                                {/* host per-turn extension (touched-files panels etc.) —
                                    rendered under the card, inside the turn's anchor block */}
                                {renderTurnPanel ? renderTurnPanel(t) : null}
                                {turnCommits.map((c) => <CheckpointMarker key={c.hash} commit={c} />)}
                              </div>
                              {internal && heldBefore(internal.firstTurn)}
                              {internal && <TranscriptBoundary boundary={internal} loading={loadingSegment === internal.loadSegment} onLoadMore={() => loadBoundary(internal)} />}
                              {segmentMode && internal && isWordlessAssistant(firstVisibleAfter(internal.lastTurn)) && continuation('from the unloaded turns between')}
                            </Fragment>
                          )
                        })}
                          {heldBefore(trailing?.firstTurn ?? Infinity)}
                          {trailing && <TranscriptBoundary boundary={trailing} loading={loadingSegment === trailing.loadSegment} onLoadMore={() => loadBoundary(trailing)} />}
                        </>
                      )
                    })()}
                    {looseCommits.map((c) => <CheckpointMarker key={c.hash} commit={c} />)}
                  </div>
                </div>
              )}
              {/* the reader's trailing edge: the one width control. It lives inside the trace
                  (not the header) so it tracks the column, and only ever writes the width.
                  A viewport-bound column has no adjustable range, so it has no handle. */}
              {ledger && viewMode === 'list' && readerFullPx != null && readerFullPx > READER_MIN && (
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
              {scope && <p className="txn-scope" role="status">{scope.filesText}. a file that appears only in an unloaded segment is not listed.</p>}
              {scope && !scope.complete && files.length === 0 && (
                <p className="txn-scope txn-scope-unloaded">no file appears in the loaded turns. load more to widen the read.</p>
              )}
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
              control, no mode class and no reserved gutter. The only way out of zen normally lives
              in the center column, with a reserved gutter. A compact retained zen session puts
              this same control in the footer until zen is off. It is one stable toggle: the word "zen" never changes, the switch tracks
              the pressed state, and its accessible name stays "zen mode" in both states. */}
          {!(mobile && zenActive) && zenControl}
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
                onClear={() => setFilters(DEFAULT_FILTERS)}
                onJumpStart={() => jumpTo(navigableTurns[0]?.index ?? 0, { switchTab: false })}
                onJumpLatest={() => jumpTo(navigableTurns[navigableTurns.length - 1]?.index ?? 0, { switchTab: false })}
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
        onClose={() => {
          // Resizing out of compact mode removes its opener. Return to the
          // corresponding desktop rail instead of leaving focus on the page body.
          if (!mobile) {
            const side = mobileDrawerKindRef.current === 'outline' ? 'left' : 'right'
            viewerRef.current?.querySelector(`.txn-rail-${side}[aria-hidden="false"] .txn-rail-collapse, .txn-rail-strip-${side}[aria-hidden="false"] .txn-rail-reopen`)?.focus({ preventScroll: true })
          }
        }}
        onCancel={(event) => { event.preventDefault(); closeMobileDrawer() }}
        onKeyDown={onDrawerKey}
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
              ? <OutlineRail viewModel={railViewModel} tab={tab} presentation={presentation} activeTurn={activeTurn} onJump={(idx) => { jumpTo(idx, { switchTab: false }); closeMobileDrawer() }} />
              : <FiltersRail tab={tab} filters={filters} onFiltersChange={setFilters} counts={counts} checkpoints={commits} filtersActive={filtersActive}
                onClear={() => setFilters(DEFAULT_FILTERS)}
                onJumpStart={() => { jumpTo(navigableTurns[0]?.index ?? 0, { switchTab: false }); closeMobileDrawer() }}
                onJumpLatest={() => { jumpTo(navigableTurns[navigableTurns.length - 1]?.index ?? 0, { switchTab: false }); closeMobileDrawer() }} />}
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
          {mobile && zenActive && zenControl}
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

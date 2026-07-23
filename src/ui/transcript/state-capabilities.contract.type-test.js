// @ts-check
/* Contract type-test for the TranscriptViewer state + capabilities API.
   It imports the ACTUAL production sub-barrel (the surface
   every consumer imports) and asserts, at the type level, the load-bearing
   guarantee of the API: CAPABILITIES ARE REQUIRED (no default), every flag
   included, while THEME + every view-state prop are optional (defaulted). Enforced
   by:
     pnpm test:contract        (tsc -p tsconfig.contract.json; checkJs+strict, noEmit)
   and wired into `build:lib`, so a capabilities-contract leak FAILS the build gate.

   The negative pins use `@ts-expect-error`: each one MUST surface a real tsc error
   to be suppressed. If `capabilities` (or any flag) were made optional, the missing
   error turns the `@ts-expect-error` itself into TS2578 (unused) — so these pins
   BITE: relaxing the contract turns this file red. */

/** @typedef {import('./index.js').TranscriptViewerProps} TranscriptViewerProps */
/** @typedef {import('./index.js').TranscriptInitialPosition} TranscriptInitialPosition */
/** @typedef {import('./index.js').ViewerCapabilities} ViewerCapabilities */
/** @typedef {import('./index.js').ViewerCallbacks} ViewerCallbacks */
/** @typedef {import('./index.js').TranscriptFilters} TranscriptFilters */
/** @typedef {import('./index.js').SavedLabel} SavedLabel */
/** @typedef {import('./index.js').Theme} Theme */
/** @typedef {import('./index.js').TranscriptTab} TranscriptTab */

/* a stand-in cooked VM: the VM contract is pinned in contract.type-test.js; here we
   only exercise the PROPS shape, so the viewModel value is cast through `any`. */
const vm = /** @type {import('./index.js').TranscriptViewModel} */ (/** @type {any} */ ({}))

/* a complete, valid capability surface — every flag present + boolean. */
/** @type {ViewerCapabilities} */
const caps = {
  canEdit: true,
  canLabel: true,
  canContribute: false,
  canChangeVisibility: false,
  canExport: true,
}

/* ── (1) POSITIVE: minimal props (viewModel + capabilities only) compile ─────────
   Proves THEME + every view-state prop is optional/defaulted: the viewer "just
   works" unmanaged with only the two required props. */
/** @type {TranscriptViewerProps} */
const minimal = { viewModel: vm, capabilities: caps }
void minimal

/* ── (2) POSITIVE: fully-controlled props compile ────────────────────────────────
   Every controllable view-state value+onChange pair, theme, callbacks, graphSlot. */
/** @type {SavedLabel} */
const savedLabel = { outcome: 'good', flag: 'clean' }
/** @type {TranscriptFilters} */
const filters = {
  categories: { prompts: true, responses: true, thinking: true, toolcalls: true },
  toolGroups: { edits: true, bash: true, read: true, search: true, fetch: true, tasks: true, other: true },
  tags: { errors: false, retries: false, revert: false },
  views: { hidden: true, expandAll: false, compact: false },
  checkpoint: 'all',
}
/** @type {ViewerCallbacks} */
const callbacks = {
  onEdit: () => {},
  onLabel: (turnIndex, label) => void [turnIndex, label.outcome],
  onContribute: () => {},
  onCopyLink: () => {},
  onChangeVisibility: () => {},
  onExport: (format) => void format,
}
/** @type {TranscriptViewerProps} */
const controlled = {
  viewModel: vm,
  capabilities: caps,
  callbacks,
  theme: 'light',
  graphSlot: (ctx) => void [ctx.activeTurn, ctx.viewModel, ctx.onSelectTurn],
  activeTab: 'trace',
  onTabChange: (tab) => void tab,
  viewMode: 'list',
  onViewModeChange: (mode) => void mode,
  leftRailOpen: true,
  onLeftRailOpenChange: (open) => void open,
  rightRailOpen: false,
  onRightRailOpenChange: (open) => void open,
  openTools: { t1: true },
  onOpenToolsChange: (m) => void m,
  initialPosition: /** @type {TranscriptInitialPosition} */ ({ kind: 'turn', turnIndex: 42 }),
  activeTurn: 0,
  onActiveTurnChange: (i) => void i,
  search: '',
  onSearchChange: (q) => void q,
  filters,
  onFiltersChange: (f) => void f,
  savedLabels: { 0: savedLabel },
  onSavedLabelsChange: (m) => void m,
  shareOpen: false,
  onShareOpenChange: (open) => void open,
  moreOpen: false,
  onMoreOpenChange: (open) => void open,
  streamPrelude: 'host transcript controls',
}
void controlled

/* the three negative pins use the typed-parameter call idiom (matching
   contract.type-test.js): the bad value is an ARGUMENT, so the `@ts-expect-error`
   sits directly above the failing call — never separated from it by a JSDoc cast. */

/** @param {TranscriptViewerProps} _p */
function _acceptViewerProps(_p) { void _p }
/** @param {ViewerCapabilities} _c */
function _acceptCapabilities(_c) { void _c }
/** @param {Theme} _t */
function _acceptTheme(_t) { void _t }
/** @param {TranscriptInitialPosition} _p */
function _acceptInitialPosition(_p) { void _p }

/* ── (3) NEGATIVE: omitting `capabilities` is a COMPILE ERROR ─────────────────────
   The headline guarantee. `capabilities` has no `?` on TranscriptViewerProps, so a
   props object without it fails assignability (property missing). Making
   capabilities optional removes the error and turns this @ts-expect-error red (TS2578). */
// @ts-expect-error — capabilities is REQUIRED on TranscriptViewerProps (no default)
_acceptViewerProps({ viewModel: vm })

/* ── (4) NEGATIVE: a partial capability surface is a COMPILE ERROR ────────────────
   Every flag is required, so a consumer cannot pass some flags and silently leave
   the rest unset. Dropping `canExport` here must error. */
// @ts-expect-error — every ViewerCapabilities flag is required; canExport is missing
_acceptCapabilities({ canEdit: true, canLabel: true, canContribute: true, canChangeVisibility: true })

/* ── (5) NEGATIVE: theme is a closed union ───────────────────────────────────────
   Guards against a stringly-typed theme leaking in. */
// @ts-expect-error — theme is the closed 'dark' | 'light' union, not an arbitrary string
_acceptTheme('midnight')

// @ts-expect-error — a turn position requires a numeric sparse turn identity
_acceptInitialPosition({ kind: 'turn', turnIndex: '42' })

// @ts-expect-error — the initial-position union is closed
_acceptInitialPosition({ kind: 'middle', turnIndex: 42 })

/* ── (6) POSITIVE: a capability flag is genuinely boolean ─────────────────────────
   A bare read does not bite under strictNullChecks, so dereference through a use. */
/** @param {ViewerCapabilities} c */
function _pinFlagsBoolean(c) {
  return c.canEdit && c.canLabel && c.canContribute && c.canChangeVisibility && c.canExport
}
void _pinFlagsBoolean

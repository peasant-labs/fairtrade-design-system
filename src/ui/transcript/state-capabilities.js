/* ───────────────────────────────────────────────────────────────────────────
   state-capabilities — the TranscriptViewer state + capabilities contract
   ─────────────────────────────────────────────────────────────────────────
   The required-capabilities + callback contract the composite TranscriptViewer
   binds to, following the `ViewerCapabilities` / `ViewerCallbacks` opt-in
   pattern established in transcript-browser.

   The single rule that makes this contract load-bearing:

     • CAPABILITIES are REQUIRED (no default). A consumer MUST pass them, so it
       can never silently ship the wrong permission surface. `canEdit:true` is a
       deliberate decision a peasant-local shell makes; village derives the flags
       from authn/authz. Omitting `capabilities` is a COMPILE ERROR
       (enforced by state-capabilities.contract.type-test.js under the contract gate).
     • THEME is optional with a sane default (dark).
     • EVERY view-state prop is optional + controllable (`value?` + `onChange?`)
       with a canonical internal default, so the viewer "just works" unmanaged.
     • CALLBACKS are optional and capability-GATED: the composite only wires a
       callback's affordance when its matching capability is true, so a gated
       callback can never fire.

   This file is type-only at runtime (`export {}`); the transcript barrel
   re-exports its types via JSDoc `import(...)`, which pulls it into the tsc
   declaration-emit program so the contract ships in the published `.d.ts`.

   No React types are referenced here on purpose — the project ships no
   @types/react, so the data/prop contract stays React-agnostic (the render-prop
   slot + callbacks are plain function signatures; the JSX consumer supplies the
   nodes). ─────────────────────────────────────────────────────────────────── */

/* ── primitive view-state value types ────────────────────────────────────────── */

/**
 * The five session views. `highlights` is backed by `vm.highlights`; the rest
 * read their cooked slices off the same `TranscriptViewModel`.
 * @typedef {'highlights' | 'trace' | 'diffs' | 'files' | 'annotations'} TranscriptTab
 */

/** The trace canvas render mode: the lifted turn-card list, or the graph slot. @typedef {'list' | 'graph'} ViewMode */

/** The optional theme; defaults to `dark` when unset. @typedef {'dark' | 'light'} Theme */

/**
 * How the composite presents: `classic` (the bordered-turn reading surface) or
 * `ledger` (the default reading-first surface: role-led turns with one grouped work panel,
 * system turns as single rows, and the ledger chrome). @typedef {'classic' | 'ledger'} Presentation
 */

/**
 * A per-turn saved label (the LabelPopover's output). `outcome` is the verdict
 * band; `flag` is an optional friction tag. Keyed by turn index in `savedLabels`.
 * @typedef {object} SavedLabel
 * @property {'good' | 'neutral' | 'bad'} outcome
 * @property {string} [flag]
 */

/**
 * The expanded/collapsed configuration of the viewer's surroundings: the left user-turns
 * outline, the right filters rail, and the host-owned sidebar (which the viewer never
 * renders, but which the host hides and restores from this same object). The host may
 * persist it; the viewer reports every explicit change through `onSidebarLayoutChange`.
 * Reading width never changes it. Zen collapses it and restores the exact snapshot.
 * `host` defaults to `true` when neither the prop nor an explicit action supplies it; the
 * viewer never renders that sidebar, so the value only relays the host's own state.
 * @typedef {object} TranscriptSidebarLayout
 * @property {boolean} outline  the left user-turns rail
 * @property {boolean} filters  the right filters rail
 * @property {boolean} host     the host-owned sidebar
 */

/**
 * The cooked filter state the FiltersRail drives. Categories gate turn KINDS;
 * `toolGroups` gate tool-call groups (keyed by the cooked `ToolGroup` ids);
 * `tags` gate semantic friction tags; `views` are display toggles; `checkpoint`
 * scopes the trace to a commit (`'all'` = unscoped).
 * @typedef {object} TranscriptFilters
 * @property {{ prompts: boolean, responses: boolean, thinking: boolean, toolcalls: boolean, system?: boolean }} categories  system defaults to true when absent from saved or host-controlled state
 * @property {Partial<Record<import('./view-model.js').ToolGroup, boolean>>} toolGroups
 * @property {{ errors: boolean, retries: boolean, revert: boolean }} tags
 * @property {{ hidden: boolean, expandAll: boolean, compact: boolean }} views
 * @property {string} checkpoint
 */

/* ── capabilities (REQUIRED — no default) ────────────────────────────────────── */

/**
 * The consumer/auth-derived permission surface — REQUIRED on TranscriptViewer
 * (no default). Every flag is required (not optional) so a consumer cannot pass
 * a partial surface and silently leave a permission unset; the host decides each
 * one explicitly. The composite gates each capability's affordance + callback on
 * its flag, so a `false` capability removes the affordance entirely.
 *
 * @typedef {object} ViewerCapabilities
 * @property {boolean} canEdit              show the "edit" action + wire `onEdit`
 * @property {boolean} canLabel             show the per-turn "label" affordance + the LabelPopover
 * @property {boolean} canContribute        show the "contribute" share action + wire `onContribute`
 * @property {boolean} canChangeVisibility  show the visibility control + wire `onChangeVisibility`
 * @property {boolean} canExport            show the download (json/jsonl/markdown) actions + wire `onExport`
 */

/* ── callbacks (optional, capability-gated) ──────────────────────────────────── */

/**
 * The host callbacks. All optional; each is wired ONLY when its matching
 * capability is true (see ViewerCapabilities). `onLabel` carries the popover's
 * cooked result; `onExport` carries the requested format. The viewer never
 * mutates the host's data — it reports intent through these.
 * Relationship navigation is gated by authorized read evidence rather than a
 * mutation capability; no usable target or no callback means no active control.
 *
 * @typedef {object} ViewerCallbacks
 * @property {() => void} [onEdit]
 * @property {(turnIndex: number, label: SavedLabel) => void} [onLabel]
 * @property {() => void} [onContribute]
 * @property {() => void} [onCopyLink]
 * @property {() => void} [onChangeVisibility]
 * @property {(format: 'json' | 'jsonl' | 'markdown') => void} [onExport]
 * @property {(navigation: import('@peasant-labs/schema').SessionRelationshipNavigation) => void} [onNavigateRelationship] authorized read target only; host owns current route and Back restoration
 */

/* ── graph slot (render-prop; the graph-engine seam) ─────────────────────────── */

/**
 * What the `graphSlot` render-prop receives. The composite owns NO graph engine
 * (no `@xyflow` dependency); in `viewMode: 'graph'` it hands the consumer this
 * cooked context and renders whatever the consumer returns (a consuming app plugs
 * fairtrade's own `/graph` @xyflow engine; the mockup plugs its SVG graph).
 * `onSelectTurn` keeps the graph's selection in lockstep with the rest of the viewer.
 *
 * @typedef {object} GraphSlotContext
 * @property {import('./view-model.js').TranscriptViewModel} viewModel
 * @property {number} activeTurn
 * @property {(turnIndex: number) => void} onSelectTurn
 */

/* ── the composite prop contract ─────────────────────────────────────────────── */

/**
 * A one-time position applied when a transcript target is first presented.
 * This is deliberately separate from `activeTurn`, which represents ongoing
 * selection while the user reads or navigates the transcript.
 *
 * @typedef {{kind: 'top', requestKey?: string} | {kind: 'turn', turnIndex: number, requestKey?: string} | {kind: 'tool-call', turnIndex: number, toolCallIndex: number, toolCallId?: string, requestKey?: string}} TranscriptInitialPosition
 */

/**
 * Every TranscriptViewer prop. `viewModel` + `capabilities` are the only required
 * props; everything else is optional with a sane internal default, so
 * `<TranscriptViewer viewModel={vm} capabilities={caps} />` renders the whole
 * surface unmanaged. Each view-state prop is the `value?` half of a controllable
 * pair whose `onChange?` half sits beside it (React's controlled-component
 * convention): pass neither ⇒ internal default; pass both ⇒ fully controlled.
 *
 * @typedef {object} TranscriptViewerBaseProps
 * @property {import('./view-model.js').TranscriptViewModel} viewModel   the cooked VM (the adapter's output)
 * @property {ViewerCapabilities} capabilities                          REQUIRED — no default
 * @property {ViewerCallbacks} [callbacks]
 * @property {Theme} [theme]                                            optional; defaults to 'dark'
 * @property {(ctx: GraphSlotContext) => unknown} [graphSlot]          render-prop for the graph engine
 * @property {TranscriptTab} [activeTab]
 * @property {(tab: TranscriptTab) => void} [onTabChange]
 * @property {ViewMode} [viewMode]
 * @property {(mode: ViewMode) => void} [onViewModeChange]
 * @property {TranscriptSidebarLayout} [sidebarLayout]                 the single rail + host-sidebar view model; supplied, it is the source of truth for `outline`, `filters` and `host`
 * @property {(layout: TranscriptSidebarLayout) => void} [onSidebarLayoutChange]  fires the FULL layout object on every explicit rail action and on zen entry and exit
 * @property {boolean} [zen]                                           ledger only: reading mode collapses both viewer rails to nothing (their strips leave too) and `host` reports false; ignored in classic; defaults false
 * @property {(zen: boolean) => void} [onZenChange]
 * @property {number | 'full'} [readerWidth]                            ledger only: the reader column width in CSS pixels, or `'full'` (exported as `READER_FULL`), the stream's whole measured content width, which follows the space as it changes. There are no snaps: a supplied number renders clamped to 600..full, so the column and `aria-valuenow` always report a width the column can draw; defaults 840
 * @property {(width: number | 'full') => void} [onReaderWidthChange]      a drag or a key reports pixel widths, and `'full'` once the column reaches the end
 * @property {boolean} [leftRailOpen]                                  alias for `sidebarLayout.outline`; when supplied it wins for that rail and still calls `onLeftRailOpenChange`
 * @property {(open: boolean) => void} [onLeftRailOpenChange]
 * @property {boolean} [rightRailOpen]                                 alias for `sidebarLayout.filters`; when supplied it wins for that rail and still calls `onRightRailOpenChange`
 * @property {(open: boolean) => void} [onRightRailOpenChange]
 * @property {Record<string, boolean>} [openTools]                     tool id → open?
 * @property {(openTools: Record<string, boolean>) => void} [onOpenToolsChange]
 * @property {Record<string, boolean>} [earlierHistoryOpen] section id to disclosure state, default closed
 * @property {(open: Record<string, boolean>) => void} [onEarlierHistoryOpenChange] persist with host route state for Back
 * @property {TranscriptInitialPosition | null} [initialPosition]     one-time position; null clears, and session/target/requestKey changes rearm
 * @property {number} [activeTurn]
 * @property {(turnIndex: number) => void} [onActiveTurnChange]
 * @property {string} [search]
 * @property {(query: string) => void} [onSearchChange]
 * @property {TranscriptFilters} [filters]
 * @property {(filters: TranscriptFilters) => void} [onFiltersChange]
 * @property {Record<number, SavedLabel>} [savedLabels]                turn index → saved label
 * @property {(savedLabels: Record<number, SavedLabel>) => void} [onSavedLabelsChange]
 * @property {boolean} [shareOpen]                                     share action-menu disclosure (default closed)
 * @property {(open: boolean) => void} [onShareOpenChange]
 * @property {boolean} [moreOpen]                                      more action-menu disclosure (default closed)
 * @property {(open: boolean) => void} [onMoreOpenChange]
 * @property {import('react').ElementType} [LinkComponent]            router link for crumb items (e.g. next/link); defaults to 'a'
 * @property {import('react').ReactNode} [beforeHeader]                in-flow content before the session header
 * @property {(turn: import('./view-model.js').TurnVM) => unknown} [renderTurnPanel]  host per-turn extension rendered under each turn card
 * @property {(turn: import('./view-model.js').TurnVM) => unknown} [renderTurnActions]  host-owned per-turn actions; replaces the built-in label affordance (hosts with typed label models keep their own popovers)
 * @property {(turnIndex: number) => string} [anchorHref]              host permalink for a turn's copy-anchor action; a root-relative return is absolutized against the page origin. Omitted, the demo copies its bare '#turn-N' placeholder
 * @property {unknown} [headerActions]                                 host session-level actions rendered at the head of the hero action row (attest etc.); the composite's own actions stay the shared tail
 * @property {import('react').ReactNode} [utilityActions]                host secondary actions, in the header on desktop and the bottom bar on phones
 * @property {unknown} [streamPrelude]                                 host controls or context rendered at the start of the list-mode transcript scroller; omitted in graph mode
 * @property {boolean} [showTail]                                      default false: hosts opt in with true to retain the legacy share/contribute and more menus after `headerActions`
 * @property {boolean} [showOutcome]                                   default true: render the session outcome chip in the meta row when the session carries an outcome
 * @property {boolean} [showSearchTrigger]                             default false: render a `search transcript` button at the end of the session views in the bottom bar that opens search exactly as ⌘F does; independent of `showTail`
 * @property {{ hints?: boolean, progress?: boolean }} [footer]      default omitted: both stay off. `hints` renders the shortcut line, `progress` the visible-turn position counter, in the bottom bar beside the session views. A host opts in per part, so a reading surface can stay quiet without losing the views. The shortcut hint is keyboard-only, so it leaves a coarse pointer below the phone breakpoint; the counter exists only on the trace view in list mode with a visible turn. The session views themselves live in the bottom bar, after the panel in DOM order, which is why the viewer opens with a `skip to session views` control
 * @property {1|2} [headingLevel]                                      default 2: the transcript's title is an h2 in a host page; 1 when the host mounts the viewer as the whole page, so the title is the page's h1 and the phase and turn headings move up one level
 * @property {Presentation} [presentation]                            chrome presentation; defaults to 'ledger'. `classic` retains the report-style surface. An unrecognized runtime value fails closed to classic.
 * @property {import('react').ReactNode} [subtitle]                    optional deck under the session title; rendered in either presentation when supplied
 * @property {unknown} [pullRequests]                                  host-owned node rendered under the meta row (a pull request list and its own "show all" control); omitted renders nothing
 * @property {import('@peasant-labs/schema').VillageTranscriptIntegrity | null} [integrity]  the served integrity value, passed through untouched. Present and well formed means flagged: the header shows the badge in every presentation and width. Absent, null or malformed renders nothing
 * @property {string | null} [transcriptContentHash]                   the detail response's `transcript.content_hash`, the content `integrity.flagged_turns` refer to
 * @property {string | null} [contentHash]                             the bare hash of the content `viewModel` was cooked from (the content route's `Village-Content-Hash` header). Turns are marked only when it equals `transcriptContentHash` and both are non-empty
 * @property {string} [integrityHelpHref]                              optional link inside the badge's explanation panel
 */

/**
 * The full legacy trail and the ancestor-only context are alternative contracts.
 * @typedef {TranscriptViewerBaseProps & ({breadcrumb?: BreadcrumbItem[], breadcrumbContext?: never} | {breadcrumb?: never, breadcrumbContext?: BreadcrumbItem[]})} TranscriptViewerProps
 */

/**
 * One breadcrumb segment. The last item renders as the current page (no link).
 * @typedef {object} BreadcrumbItem
 * @property {string} label
 * @property {string} [href]
 */

export {}

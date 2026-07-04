/* ───────────────────────────────────────────────────────────────────────────
   state-capabilities — the TranscriptViewer state + capabilities contract
   ─────────────────────────────────────────────────────────────────────────
   The required-capabilities + callback contract the composite TranscriptViewer
   binds to, mirroring transcript-browser's existing `ViewerCapabilities` /
   `ViewerCallbacks` opt-in pattern.

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
 * A per-turn saved label (the LabelPopover's output). `outcome` is the verdict
 * band; `flag` is an optional friction tag. Keyed by turn index in `savedLabels`.
 * @typedef {object} SavedLabel
 * @property {'good' | 'neutral' | 'bad'} outcome
 * @property {string} [flag]
 */

/**
 * The cooked filter state the FiltersRail drives. Categories gate turn KINDS;
 * `toolGroups` gate tool-call groups (keyed by the cooked `ToolGroup` ids);
 * `tags` gate semantic friction tags; `views` are display toggles; `checkpoint`
 * scopes the trace to a commit (`'all'` = unscoped).
 * @typedef {object} TranscriptFilters
 * @property {{ prompts: boolean, responses: boolean, thinking: boolean, toolcalls: boolean }} categories
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
 *
 * @typedef {object} ViewerCallbacks
 * @property {() => void} [onEdit]
 * @property {(turnIndex: number, label: SavedLabel) => void} [onLabel]
 * @property {() => void} [onContribute]
 * @property {() => void} [onCopyLink]
 * @property {() => void} [onChangeVisibility]
 * @property {(format: 'json' | 'jsonl' | 'markdown') => void} [onExport]
 */

/* ── graph slot (render-prop; the graph-engine seam) ─────────────────────────── */

/**
 * What the `graphSlot` render-prop receives. The composite owns NO graph engine
 * (no `@xyflow` dependency); in `viewMode: 'graph'` it hands the consumer this
 * cooked context and renders whatever the consumer returns (TB plugs its @xyflow
 * engine; the mockup plugs its SVG graph). `onSelectTurn` keeps the graph's
 * selection in lockstep with the rest of the viewer.
 *
 * @typedef {object} GraphSlotContext
 * @property {import('./view-model.js').TranscriptViewModel} viewModel
 * @property {number} activeTurn
 * @property {(turnIndex: number) => void} onSelectTurn
 */

/* ── the composite prop contract ─────────────────────────────────────────────── */

/**
 * Every TranscriptViewer prop. `viewModel` + `capabilities` are the only required
 * props; everything else is optional with a sane internal default, so
 * `<TranscriptViewer viewModel={vm} capabilities={caps} />` renders the whole
 * surface unmanaged. Each view-state prop is the `value?` half of a controllable
 * pair whose `onChange?` half sits beside it (React's controlled-component
 * convention): pass neither ⇒ internal default; pass both ⇒ fully controlled.
 *
 * @typedef {object} TranscriptViewerProps
 * @property {import('./view-model.js').TranscriptViewModel} viewModel   the cooked VM (the adapter's output)
 * @property {ViewerCapabilities} capabilities                          REQUIRED — no default
 * @property {ViewerCallbacks} [callbacks]
 * @property {Theme} [theme]                                            optional; defaults to 'dark'
 * @property {(ctx: GraphSlotContext) => unknown} [graphSlot]          render-prop for the graph engine
 * @property {TranscriptTab} [activeTab]
 * @property {(tab: TranscriptTab) => void} [onTabChange]
 * @property {ViewMode} [viewMode]
 * @property {(mode: ViewMode) => void} [onViewModeChange]
 * @property {boolean} [leftRailOpen]
 * @property {(open: boolean) => void} [onLeftRailOpenChange]
 * @property {boolean} [rightRailOpen]
 * @property {(open: boolean) => void} [onRightRailOpenChange]
 * @property {Record<string, boolean>} [openTools]                     tool id → open?
 * @property {(openTools: Record<string, boolean>) => void} [onOpenToolsChange]
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
 * @property {BreadcrumbItem[]} [breadcrumb]                           host-routable trail; omit for the demo's static crumb
 * @property {import('react').ElementType} [LinkComponent]            router link for crumb items (e.g. next/link); defaults to 'a'
 * @property {(turn: import('./view-model.js').TurnVM) => unknown} [renderTurnPanel]  host per-turn extension rendered under each turn card
 * @property {(turn: import('./view-model.js').TurnVM) => unknown} [renderTurnActions]  host-owned per-turn actions; replaces the built-in label affordance (hosts with typed label models keep their own popovers)
 * @property {(turnIndex: number) => string} [anchorHref]              host permalink for a turn's copy-anchor action; a root-relative return is absolutized against the page origin. Omitted, the demo copies its bare '#turn-N' placeholder
 * @property {unknown} [headerActions]                                 host session-level actions rendered at the head of the hero action row (attest etc.); the composite's own actions stay the shared tail
 */

/**
 * One breadcrumb segment. The last item renders as the current page (no link).
 * @typedef {object} BreadcrumbItem
 * @property {string} label
 * @property {string} [href]
 */

export {}

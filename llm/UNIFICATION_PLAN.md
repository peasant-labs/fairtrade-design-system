# fairtrade design system - cross-repo rollout plan (deferred)

> **This is the future cross-repo program, not the current state.** Everything in
> `unified-identity` itself (the docs site as a real React component library, the contrast/a11y
> remediation, the `src/ui/*` primitives, the gates) is **done** and lives in
> [`HANDOFF.md`](./HANDOFF.md) / [`DESIGN.md`](./DESIGN.md) / [`PRESENTATION.md`](./PRESENTATION.md).
> This file only tracks the work that touches the **other** repos and has **not started**. It is
> **gated on owner approval**; stay inside `unified-identity` until then.
>
> Source: a 2026-06-16 inventory + audit pass over peasant/web, village/frontend,
> transcript-browser/packages, and this repo. The component catalog below is the rollout target.

## what is deferred (the not-started scope)

- **`@peasant-labs/ui`** - a shared cross-repo primitive package. Does not exist yet. The `src/ui/*`
  components in this repo are docs-site components that would seed it, not a published library.
- **`@peasant-labs/theme` as the single source of truth** - this repo's tokens are local; they have
  not been reconciled with the other repos.
- **Three-token-namespace reconciliation** - the `--ink`/`--amber` (this DS, hex, dark-default) vs
  `--tb-*` (`@peasant-labs/theme`, hsl, light-default `.tb-dark`) vs hsl-triplet `--ink`/`--mark`
  (apps) fork, with three different dark-mode polarities. This repo has **no** `--tb-*` and **no**
  `--mark`, so the bridge/mirror still has to be designed, not assumed.
- **Vendored-tarball plumbing** - village consumes the viewer via pinned `vendor/*.tgz`; switching it
  to workspace / `file:` consumption is future work.
- **Screen-by-screen reskin** of peasant / village / viewer.

The apps are **structurally already aligned** (radius-0, hairline, token-driven, lowercase-chrome,
shadcn-shaped), so the gap is **consolidation and contract, not redesign**: collapse three duplicate
primitive sets into one package, reconcile one token namespace, then reflavor values + fonts to the
Caves-of-Qud identity (amber-on-near-black + warm-paper; Atkinson Hyperlegible (Mono)).

## the core blocker: token reconciliation

The rollout's founding premise ("only values + fonts change, names are preserved") is **false today**.
Three live token namespaces with three dark-mode polarities, and the viewer paints decoupled from app
themes because neither app overrides `--tb-*`. Phase 0 must:

- pick one canonical token form; generate the `--tb-*` mirror + the app form from it.
- reconcile the dark-default polarity (DS is dark-default; theme + apps are light-default `.tb-dark`).
- add the missing shared semantic groups: `success`/`warning`/`danger` (+`-fg`/`-soft`),
  `--mark`/`--mark-fg`, `--surface-elev`, `--intensity-0..4`, `--edge`/`--edge-strong`, `--rail`,
  `--code-bg`, `--role-user`/`--role-assistant`, `--provider-*`.
- make `@peasant-labs/theme`'s `preset.ts` a real Tailwind v4 preset.

Validation: because names are preserved, swapping values should reflavor existing app components in
place with no markup change; visual-regression snapshot each app's key screens before/after.

## missing-components catalog (the rollout target)

What the three apps + shared viewer ship (~90+ distinct components) that the shared package must
absorb. The DS documented ~10 families; the viewer package alone
(`@peasant-labs/transcript-browser`) contributes ~63. Priorities: P0 (blocks rollout) / P1 (high
reuse) / P2 (app-specific or niche). "Shared" = used by 2+ apps or the viewer.

### A. primitives (overlays, controls, feedback)
| P | Component | Source | What it is | Scope |
|---|---|---|---|---|
| **P0** | **Tooltip** | peasant/village/tb (3 incompatible impls: Radix / CSS-only / manual-portal) | hover/focus hint bubble | shared |
| **P0** | **Popover** | peasant `ui/popover`, tb `ui/popover` | anchored floating panel; foundation for menus/facets/labels | shared |
| **P0** | **Dropdown Menu** | tb `header/ActionMenu`, village UserMenu, peasant (3+ hand-rolled) | menu surface on Popover | shared |
| **P0** | **Select (listbox)** | peasant/tb `ui/select`, village native `<select>` | open-state listbox | shared |
| **P0** | **Checkbox (real)** | peasant/tb `ui/checkbox` | real `<input>` w/ indeterminate/disabled/keyboard | shared |
| **P0** | **Skeleton family** | peasant `ui/skeleton` (Skeleton/Text/Row/List), tb atom | loading placeholders | shared |
| **P0** | **Collapsible** | peasant/tb `ui/collapsible` | powers thinking blocks, tool rows, rail sections | shared |
| **P0** | **States: InlineError / BlankSlate** | peasant `ui/states` | danger strip + teaching empty-state | shared |
| **P1** | **Table** | peasant/tb `ui/table`, tb `views/FilesView` (sortable) | tabular data | shared |
| **P1** | **Pagination** | village `ui/Pagination` | prev/next + numbered page counter | shared |
| **P1** | **Segmented control** | tb DiffsView/ViewModeToggle, village (~5x hand-rolled) | 2-3-way toggle | shared |
| **P1** | **Kbd** | tb `primitives/Kbd` | keycap indicator for palette/search | shared |
| **P1** | **Chip (parametric)** | tb `primitives/Chip` | one chip w/ default/subtle/outline/success/danger/warning | shared |
| **P1** | **ProgressIndicator** | tb `overlays/ProgressIndicator` | floating "X of Y" pill, aria-live | shared |
| **P2** | **Switch** | tb `rails/ViewOptions` | toggle distinct from checkbox | shared |
| **P2** | **Avatar (+group/fallback/status)** | village card avatars | identity tile | shared |
| **P2** | **Combobox / typeahead** | village `ui/GitHubUserSearch` | input + results popover + keyboard nav (shell only) | village |

### B. chrome / layout
| P | Component | Source | What it is | Scope |
|---|---|---|---|---|
| **P0** | **Dialog primitive** | village x5 hand-rolled shells, tb ShareDialog, peasant | portal + scrim + focus-trap + Esc + header/footer (highest dedup value) | shared |
| **P1** | **Breadcrumb** | tb `header/Breadcrumb` (canonical), peasant (2+ impls) | consolidate to one | shared |
| **P1** | **TabStrip (tabs + count + panel)** | tb `header/TabStrip`, peasant SessionFilterBar | tabs w/ panel region, disabled/overflow | shared |
| **P1** | **Panel / Section (bordered + header)** | village FilterSidebar/TranscriptList, tb FilterSection | ubiquitous bordered-card shell | shared |
| **P1** | **AppShell / provider composition** | peasant/village `LayoutShell` | nav + palette + tour + providers; fixed-navbar offset | shared |
| **P1** | **TopNav (+ theme toggle, user menu)** | peasant `TopNavbar`, village `Navbar` | nav + theme toggle + avatar dropdown + auth | shared |
| **P2** | **IconButton** | recurs (rail, graph-controls, dialog close) | square icon-only button w/ accessible name | shared |
| **P2** | **PendingApprovalBar / sticky action banner** | village `PendingApprovalBar` | sticky top warning bar w/ inline actions | village |

### C. transcript viewer (lives in `@peasant-labs/transcript-browser`)
The DS "conversation window" family is implemented entirely in the viewer package; SessionDetailV2 in
peasant/village is only the data/scoping adapter. These are the real components the rollout absorbs by
reference. Source paths are `packages/browser/src/...`.

| P | Component | Source | What it is | Scope |
|---|---|---|---|---|
| **P0** | **SessionDetail composer + capability/callback contract** | `SessionDetail.tsx`, `canvas/types.ts` | orchestration spine both apps mount (`ViewerCapabilities`/`ViewerCallbacks`/`renderGraph`/`renderTurnActions`/`renderTurnPanel`/`linkBuilder`) | shared |
| **P0** | **TranscriptCanvas + TurnRow + TurnContent** | `canvas/*` | root list view, role-tinted turns, copy-deep-link, collapse-show-more, search-highlight | shared |
| **P0** | **CodeBlock (Shiki)** | `primitives/CodeBlock` | dual-themed syntax highlighting (heavy dep) | shared |
| **P0** | **Markdown (`.tb-prose`)** | `primitives/Markdown` | GFM renderer; the key neuroinclusive prose surface | shared |
| **P0** | **DiffView** | `primitives/DiffView` | computed unified diff; the only chroma surface (`--tb-diff-*`) | shared |
| **P0** | **ToolCallRow + ToolCallList** | `canvas/*` | collapsible tool invocation w/ arg-preview, exit-code/error, renderer delegation | shared |
| **P1** | **ThinkingBlock** | `canvas/ThinkingBlock` | collapsible reasoning, word-count toggle | shared |
| **P1** | **PhaseDivider** | `canvas/PhaseDivider` | sticky phase section header | shared |
| **P1** | **CheckpointMarker + TaskBoundary** | `canvas/*` | git-commit chip + per-task summary divider | shared |
| **P1** | **RoleGlyph** | `primitives/RoleGlyph` | semantic role indicators (reconcile w/ "real icons" principle) | shared |
| **P1** | **OutcomeChip, ErrorPill, DurationBadge, TokenBadge** | `primitives/*` | outcome normalization + why-tooltip; inline error pill; token/duration badges | shared |

### D. per-tool renderers (the single largest gap - viewer package, `canvas/tool-renderers/`)
| P | Component | What it is | Scope |
|---|---|---|---|
| **P0** | **rendererFor dispatcher** (`index.ts`) | name/kind -> renderer registry; makes tool rendering pluggable | shared |
| **P0** | **Read / Edit / Write / Bash / Grep / WebFetch / Task / Default renderers** (8 files) | per-tool layouts (file excerpt, diff, terminal+exit-code, search results, fetched prose, task kv, JSON fallback) | shared |
| **P1** | **ToolIcon registry** (`primitives/ToolIcon`) | tool name/kind -> Lucide; stays in sync w/ rendererFor | shared |

### E. rails (viewer package, `rails/*`)
| P | Component | What it is | Scope |
|---|---|---|---|
| **P0** | **RightRail / RailColumn system** | tab+collapse shell, per-tab body switching, two layouts (tabs/split) | shared |
| **P1** | **Outline family** (`{Outline,Highlights,Diffs,Files,Annotations}List`) | 5 navigator lists; 3 row shapes to unify | shared |
| **P1** | **FilterSection / FilterCheckbox / ViewOptions** | collapsible rail section + filter rows + toggle list | shared |
| **P1** | **CheckpointSelector** | commit picker dropdown (needs Popover) | shared |
| **P1** | **HorizontalScrubber / TimeStrip** (+ peasant `map/TimeStrip`) | density timeline + drag bracket; session sparkline | shared |
| **P1** | **RailShell / RailSection** (peasant `map/RailShell`) | 320px sticky card -> bottom-sheet | shared |

### F. graph (trajectory - viewer + peasant)
| P | Component | What it is | Scope |
|---|---|---|---|
| **P1** | **TrajectoryGraph** (tb `graph/*`) | ReactFlow integration (peer dep via `renderGraph`), node types, minimap, focus-sync | shared |
| **P1** | **TurnCardNode / ToolPillNode / SubagentBranchNode** | the 3 graph node types | shared |
| **P1** | **GraphControls / GraphLegend** | zoom cluster + glyph legend | shared |
| **P1** | **MapCanvas + MapSquareNode + edges** (peasant `map/*`) | code-map canvas | shared |

### G. overlays / flows / app-specific
| P | Component | What it is | Scope |
|---|---|---|---|
| **P0** | **Command Palette** (peasant `command/CommandPalette`) | cmd-k nav/action/FTS palette | shared |
| **P1** | **SearchBar overlay (find-in-page)** (tb `overlays/SearchBar` + `useSearchHotkey`) | cmd-f overlay w/ match nav, Kbd hints | shared |
| **P1** | **ShareDialog** (tb `overlays/ShareDialog`) | copy-link + visibility segmented + redaction note (rebuild on Dialog) | shared |
| **P1** | **Step wizard** (peasant `share/StepIndicator` + steps) | 4-step square wizard | peasant |
| **P1** | **RedactionDiffView** (peasant + village) | line-numbered redaction review diff | shared |
| **P1** | **TourOverlay + TourProvider** (peasant `tour/*`) | spotlight onboarding coachmark | peasant |
| **P1** | **Explainer / Term** (peasant) | collapsible help block + glossary tooltip term | peasant |
| **P1** | **SessionScorecard** (tb `views/SessionScorecard`) | healthy/caution/risk bands (reconcile onto the desaturated palette) | shared |
| **P1** | **HighlightsView / DiffsView / FilesView / AnnotationsView** (tb `views/*`) | the 4 per-tab content views | shared |
| **P2** | **ProviderIcon** (peasant + village + tb, 3 copies) | provider brand SVGs + `--provider-*` tokens | shared |
| **P2** | **SignInProviders / UsernameGate / auth flows** (village `auth/*`) | split-button OAuth + onboarding guard | village |
| **P2** | **CollectiveAnalytics -> @peasant-labs/analytics** (village) | separate shared layer (25 chart types) | village |

## the shared package (`@peasant-labs/ui`)

New package in the `transcript-browser` pnpm workspace (`packages/ui`, alongside `theme`, `browser`,
`types`, `analytics`). `@peasant-labs/theme` (tokens + Tailwind v4 preset) is the single source of
truth; `@peasant-labs/ui` holds primitives; consumers are unified-identity (docs), peasant/web,
village/frontend, and `packages/browser` (viewer composites build on ui primitives). The viewer's
`src/ui/*` primitive copy collapses into `@peasant-labs/ui`, re-exported from `primitives` during
migration.

**API conventions:** dependency-free internals (the tb context-based checkbox/select/popover/tooltip/
collapsible with click-outside+Esc is the canonical base, no Radix); one variant taxonomy (the shadcn
`variant: default|secondary|outline|ghost|destructive|link`, `size: default|sm|lg|icon` that peasant+tb
share, with a village `primary->default` / `danger->destructive` compat shim); token-driven, radius-0,
hairline, lowercase chrome; real states on every primitive (`:hover/:active/:disabled/[aria-busy]/
aria-invalid`); a11y at the primitive level; slots / render-props for host injection (mirror the
viewer's `renderTurnActions`/`renderTurnPanel`/`linkBuilder` contract).

**Extraction order (dependency-first):** (1) tokens reconciliation - blocks everything. (2) leaf
primitives (Button -> Input/Select/Checkbox/Switch/Field -> Chip/Badge/ProviderMark -> Kbd -> Skeleton
-> InlineError/BlankSlate). (3) overlays (Popover -> Menu -> Tooltip -> Dialog/Drawer -> Command
Palette). (4) compounds (Card/Panel/Row -> Breadcrumb/Tabs+Panel/Steps/Pagination/Segmented -> Table).
(5) viewer primitives (CodeBlock -> Markdown -> DiffView -> RoleGlyph -> ErrorPill/DurationBadge/
TokenBadge/OutcomeChip). (6) viewer composites (ToolCallRow + rendererFor + 8 renderers ->
TurnRow/TranscriptCanvas -> PhaseDivider/Checkpoint/TaskBoundary -> RightRail/Outlines -> Graph ->
Views -> SessionDetail composer).

## rollout phases (clothing the three apps)

The old `peasant/web/DESIGN_SYSTEM.md` "monochrome-editorial" system shares the same bones (radius-0,
hairline, monochrome-with-semantics, square steps, intensity ramp, edge tokens), so this is a re-skin.

- **Phase 0 - token reflavor through `@peasant-labs/theme`** (unblocks everything). Reconcile the
  namespaces (see "the core blocker" above); reflavor values + fonts to the identity; ship a bridge so
  `--tb-*` resolves from canonical names and `.dark <-> .tb-dark` is wired. Validate: values-only swap
  should reflavor app components in place; visual-regression snapshot before/after.
- **Phase 1 - swap shared primitives to `@peasant-labs/ui`.** Publish it; point
  `packages/browser/src/ui` at it. peasant: replace `src/components/ui/*` imports, delete duplicates,
  fix raw `<input>`/checkbox/breadcrumb inconsistencies. village: switch off vendored tarballs; apply
  the compat map; replace 5x hand-rolled modal shells with one Dialog, 3x compact-rows + 3x
  click-outside menus, and lift domain badges to Chip variants. Payoff: every app deletes its primitive
  copy.
- **Phase 2 - migrate composites / viewer.** Adopt the viewer composites (TranscriptCanvas,
  tool-renderers, rails, graph, views) via the `SessionDetail` capability/callback contract both
  adapters already consume (largely a version bump + token reflavor). Reconcile SessionScorecard's
  bands onto the desaturated palette. Validate: screenshot-QA loop on fixed real transcripts.
- **Phase 3 - screen-by-screen.** Sweep each app's flows (peasant: map/review/contribute; village:
  explore/publish/collectives/auth; viewer: all tabs). Lowercase remaining Title-Case chrome, replace
  bespoke panels with `Panel`, unify confirm-vs-modal on one destructive-confirm pattern, replace the 3
  ProviderIcon copies. Validate per screen: axe + contrast gate + visual snapshot + screenshot QA.

**Sequencing:** Phase 0 gates 1-3; Phase 1 gates 2.

## risks

- **village vendored-tarball pinning** - village won't see package changes until that seam is switched
  to workspace consumption. Fix it early.
- **the `--tb-*` vs `--ink` namespace fork** silently decoupling the viewer from app themes - close in
  Phase 0.
- **dark-default-polarity mismatch** (DS dark-default; theme + apps light-default) - pick one.
- **heavy deps** (Shiki, react-markdown, diff, @xyflow) if CodeBlock/Markdown/Graph are published -
  keep @xyflow behind the `renderGraph` peer-dep isolation.
- **highest-leverage move** remains **Dialog** (replaces 5+ hand-rolled village modals); the largest
  uncovered territory is the **per-tool renderer system** (dispatcher + 8 renderers in
  `packages/browser`).
</content>
</invoke>

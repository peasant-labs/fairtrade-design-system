<!-- Produced 2026-06-16 by a 12-agent inventory + audit + synthesis pass over
     peasant/web, village/frontend, transcript-browser/packages, and this repo.
     Inventory of ~90 app components + 6-dimension quality audit of the DS. -->

# fairtrade design system — unification & rollout plan

## 1. executive summary

**Quality verdict.** The fairtrade design system has a genuinely strong *visual* foundation but is not yet a *system you can ship*. The audit scores it: tokens-theming **3/5**, a11y **3/5**, componentization **2/5**, consistency-craft **4/5**, coverage-gaps **2/5**, code-build **2/5**. The identity is coherent and the token layer is disciplined and theme-complete, but three structural defects dominate: (1) ~95% of components exist only as static HTML strings injected via `dangerouslySetInnerHTML` — there is nothing importable, no props, no types, no states; (2) the central "names preserved, only values change" rollout thesis is **false today** — there are four token files across three incompatible namespaces (`--ink/--amber` in the DS, `--tb-*` in `@peasant-labs/theme`, hsl-triplet `--ink`/`--mark` in the apps) with three different dark-mode polarities; (3) the doc claims neuroinclusive a11y compliance that the markup and several token values do not deliver (all four border tokens fail 3:1 in both themes; `--ink-4` ships as body text below 4.5:1; section titles are `<span>` not headings; "interactive" primitives are inert divs).

**Size of the gap.** The three apps + shared viewer ship roughly **90+ distinct components**; the DS documents ~10 families and four of those only partially. The viewer package alone (`@peasant-labs/transcript-browser`) contributes ~63 components the DS barely touches — the entire tool-renderer system (dispatcher + 8 renderers), the right-rail system, the trajectory graph, the overlays, and the per-tab views. Critically, the apps are **structurally already aligned** (radius-0, hairline, token-driven, lowercase-chrome, shadcn-shaped), so the gap is one of *consolidation and contract*, not redesign: collapse three duplicate primitive sets into one package, reconcile one token namespace, convert the DS from docs-of-HTML into a real library, then reflavor values + fonts. This is a months-long but well-scoped program with a clear critical path.

---

## 2. missing-components catalog

Grouped by category, prioritized P0 (must — blocks rollout / apps cannot ship without) / P1 (should — high reuse, not blocking) / P2 (could — app-specific or niche). "Shared" = used by 2+ apps or the viewer package.

### A. primitives (overlays, controls, feedback)
| P | Component | Source | What it is | New / Variant | Scope |
|---|---|---|---|---|---|
| **P0** | **Tooltip** | peasant `ui/tooltip.tsx`, village `ui/Tooltip.tsx`, tb `ui/tooltip.tsx` + `internal/Tooltip` | hover/focus hint bubble — **3 incompatible impls** (Radix / CSS-only / manual-portal) | NEW family | shared |
| **P0** | **Popover** | peasant `ui/popover.tsx`, tb `ui/popover.tsx` | anchored floating panel; foundational for menus/facets/labels | NEW family | shared |
| **P0** | **Dropdown Menu / Menu** | tb `header/ActionMenu` (internal Menu/MenuItem), village UserMenu/SignInProviders, peasant — 3+ hand-rolled click-outside menus | menu surface on top of Popover | NEW family | shared |
| **P0** | **Select (listbox)** | peasant `ui/select.tsx`, tb `ui/select.tsx`, village native `<select>` | open-state listbox; DS only documents resting control | Extend `controls` → add open state | shared |
| **P0** | **Checkbox (real)** | peasant `ui/checkbox.tsx`, tb `ui/checkbox.tsx` | DS `.check` is a fake styled label, no real `<input>`, no indeterminate/disabled/keyboard | Fix existing `controls` | shared |
| **P0** | **Skeleton family** | peasant `ui/skeleton.tsx` (Skeleton/Text/Row/List), tb `ui/skeleton.tsx` (atom) | loading placeholders; DS has none | NEW family (adopt peasant's richer set) | shared |
| **P0** | **Collapsible** | peasant `ui/collapsible.tsx`, tb `ui/collapsible.tsx` | show/hide region; powers thinking blocks, tool rows, rail sections | NEW family | shared |
| **P0** | **States: InlineError / BlankSlate** | peasant `ui/states.tsx` | danger strip + teaching empty-state | Extend `forms/empty` → real primitives | shared (peasant today) |
| **P1** | **Table** | peasant `ui/table.tsx`, tb `ui/table.tsx`, tb `views/FilesView` (sortable) | tabular data; DS only has `.dtable` docs-spec table | NEW family | shared |
| **P1** | **Pagination** | village `ui/Pagination.tsx` | prev/next + page counter | Extend `trails/pager` → numbered variant | village (consolidate) |
| **P1** | **Segmented control** | tb `views/DiffsView`, `ViewModeToggle`, village CommitTimeline/TranscriptEditDialog | 2–3-way toggle; recurs ~5× hand-rolled | NEW (under `controls`) | shared |
| **P1** | **Kbd** | tb `primitives/Kbd.tsx` | keycap indicator (⌘F, ⎋) for palette/search | NEW (tiny) | shared |
| **P1** | **Chip (parametric)** | tb `primitives/Chip.tsx` | one chip primitive w/ default/subtle/outline/success/danger/warning + baked tooltip | Consolidate `badges` → parametric base | shared |
| **P1** | **ProgressIndicator** | tb `overlays/ProgressIndicator.tsx` | floating "X of Y" position pill, aria-live | NEW | shared (viewer) |
| **P2** | **Switch** | tb `rails/ViewOptions` (styled as check — inconsistency) | toggle switch distinct from checkbox | NEW (under `controls`) | shared |
| **P2** | **Avatar (+group/fallback/status)** | village card avatars, DS `.avatar` undocumented | identity tile | NEW | village/shared |
| **P2** | **Combobox / typeahead** | village `ui/GitHubUserSearch` | input + results popover + keyboard nav (shell only; data stays app-side) | NEW shell | village |

### B. chrome / layout
| P | Component | Source | What it is | New / Variant | Scope |
|---|---|---|---|---|---|
| **P0** | **Dialog primitive** | village ×5 hand-rolled modal shells, tb `ShareDialog`, peasant — | portal + scrim + focus-trap + Esc + header/footer; DS dialog has no `role`/trap/aria | Fix existing `dialog` → real primitive | shared (highest dedup value) |
| **P1** | **Breadcrumb** | tb `header/Breadcrumb` (canonical), peasant `Breadcrumbs.tsx` + inline CrumbTrail | DS documents it; 2+ impls to consolidate to one | Consolidate `trails` | shared |
| **P1** | **TabStrip (tabs + count + panel)** | tb `header/TabStrip`, peasant SessionFilterBar | DS tabs render tablist only — no panel region, no disabled/overflow | Extend `trails/tabs` | shared |
| **P1** | **Panel / Section (bordered + eyebrow header)** | recurs in village FilterSidebar/TranscriptList/LinkedRepositories, tb FilterSection | the ubiquitous "bordered card with eyebrow header + body" shell | NEW layout primitive | shared |
| **P1** | **AppShell / provider composition** | peasant `LayoutShell`, village `LayoutShell` | nav + palette + tour + providers; fixed-navbar offset contract | NEW (documented pattern) | shared |
| **P1** | **TopNav (+ theme toggle, user menu)** | peasant `TopNavbar`, village `Navbar` | DS documents nav; apps add theme toggle + avatar dropdown + auth links | Extend `nav` | shared |
| **P2** | **IconButton** | recurs (rail icon-btn, graph-controls-btn, dialog close) | square icon-only button w/ accessible name | NEW (under `controls`) | shared |
| **P2** | **PendingApprovalBar / sticky action banner** | village `PendingApprovalBar` | sticky top warning bar w/ inline actions | NEW (overlaps toast gap) | village |

### C. transcript viewer (the conversation window — lives in `@peasant-labs/transcript-browser`)
> The DS "conversation window" family is **implemented entirely in the viewer package**, not the apps. SessionDetailV2 in peasant/village is only the data/scoping adapter. These are the real components the DS must absorb-by-reference.

| P | Component | Source (`packages/browser/src/...`) | What it is | New / Variant | Scope |
|---|---|---|---|---|---|
| **P0** | **SessionDetail composer + capability/callback contract** | `SessionDetail.tsx`, `canvas/types.ts` | the orchestration spine both apps mount; `ViewerCapabilities`/`ViewerCallbacks`/`renderGraph`/`renderTurnActions`/`renderTurnPanel`/`linkBuilder` | NEW (document the *contract*) | shared (both apps) |
| **P0** | **TranscriptCanvas + TurnRow + TurnContent** | `canvas/*` | root list view, role-tinted turns, copy-deep-link, collapse-show-more, search-highlight | Extend `conversation` | shared |
| **P0** | **CodeBlock (Shiki)** | `primitives/CodeBlock.tsx` | dual-themed syntax highlighting, theme-follows-`.tb-dark` | NEW (heavy dep) | shared |
| **P0** | **Markdown (`.tb-prose`)** | `primitives/Markdown.tsx` | GFM renderer; the key neuroinclusive prose surface | NEW | shared |
| **P0** | **DiffView** | `primitives/DiffView.tsx` | computed unified diff; the ONLY chroma surface; `--tb-diff-*` contract | Extend `conversation/diff` → real renderer | shared |
| **P0** | **ToolCallRow + ToolCallList** | `canvas/*` | collapsible tool invocation w/ arg-preview heuristics, exit-code/error state, renderer delegation | Extend `conversation/tool-call` | shared |
| **P1** | **ThinkingBlock** | `canvas/ThinkingBlock.tsx` | collapsible reasoning, word-count toggle (host-wired, not in canvas) | Extend `conversation/thinking` | shared |
| **P1** | **PhaseDivider** | `canvas/PhaseDivider.tsx` | native-CSS-sticky phase section header | Extend `conversation/phase` | shared |
| **P1** | **CheckpointMarker + TaskBoundary** | `canvas/*` | git-commit chip + per-task summary divider (shared `tb-marker`) | Extend / NEW | shared |
| **P1** | **RoleGlyph** | `primitives/RoleGlyph.tsx` | semantic SVG role indicators (shape-over-chroma) | NEW (reconcile w/ "real icons" principle) | shared |
| **P1** | **OutcomeChip + collectOutcomeReasons** | `primitives/OutcomeChip.tsx` | multi-shape outcome normalization + why-tooltip | Extend `badges` | shared |
| **P1** | **ErrorPill, DurationBadge, TokenBadge** | `primitives/*` | inline tool-error pill; token/duration badges + formatters | Extend `badges` | shared |

### D. per-tool renderers (the single largest gap)
| P | Component | Source (`canvas/tool-renderers/`) | What it is | Scope |
|---|---|---|---|---|
| **P0** | **rendererFor dispatcher** | `index.ts` | name/kind → renderer registry; makes tool rendering pluggable | shared |
| **P0** | **Read / Edit / Write / Bash / Grep / WebFetch / Task / Default renderers** | 8 files | per-tool layouts (file excerpt, diff, terminal+exit-code, search results, fetched prose, task/todo kv, JSON fallback) | shared |
| **P1** | **ToolIcon registry** | `primitives/ToolIcon.tsx` | tool name/kind → Lucide; must stay in sync w/ rendererFor (drift risk) | shared |

### E. rails
| P | Component | Source | What it is | Scope |
|---|---|---|---|---|
| **P0** | **RightRail / RailColumn system** | tb `rails/RightRail.tsx` | tab+collapse shell, per-tab body switching (outline/filters), two layouts (tabs/split) | shared (viewer) |
| **P1** | **Outline family** | tb `rails/{Outline,Highlights,Diffs,Files,Annotations}List.tsx` | 5 navigator lists; 3 row shapes to unify | shared |
| **P1** | **FilterSection / FilterCheckbox / ViewOptions** | tb `rails/*` | collapsible rail section + filter rows + toggle list | shared |
| **P1** | **CheckpointSelector** | tb `rails/CheckpointSelector.tsx` | commit picker dropdown (3rd hand-rolled dropdown → needs Popover) | shared |
| **P1** | **HorizontalScrubber / TimeStrip** | tb `rails/HorizontalScrubber.tsx`, peasant `map/TimeStrip.tsx` | density timeline + drag bracket; session sparkline | shared |
| **P1** | **RailShell / RailSection** | peasant `map/RailShell.tsx` | 320px sticky card → bottom-sheet (canvas surfaces) | shared (peasant) |

### F. graph (trajectory)
| P | Component | Source | What it is | Scope |
|---|---|---|---|---|
| **P1** | **TrajectoryGraph** | tb `graph/TrajectoryGraph.tsx` | ReactFlow integration (peer dep via `renderGraph`), node types, minimap, focus-sync | shared (viewer) |
| **P1** | **TurnCardNode / ToolPillNode / SubagentBranchNode** | tb `graph/nodes/*` | the 3 graph node types (`tb-gnode` family) | shared |
| **P1** | **GraphControls / GraphLegend** | tb `graph/*` | zoom cluster + glyph legend | shared |
| **P1** | **MapCanvas + MapSquareNode + edges** | peasant `map/*` | code-map canvas (the richest DS "canvas" realization; pure, no fetch) | shared (peasant) |

### G. overlays / flows / wizards / app-specific
| P | Component | Source | What it is | Scope |
|---|---|---|---|---|
| **P0** | **Command Palette** | peasant `command/CommandPalette.tsx` | ⌘K nav/action/FTS palette (nav already advertises ⌘K) | shared (peasant) |
| **P1** | **SearchBar overlay (find-in-page)** | tb `overlays/SearchBar.tsx` + `useSearchHotkey` | ⌘F overlay w/ match nav, Kbd hints | shared (viewer) |
| **P1** | **ShareDialog** | tb `overlays/ShareDialog.tsx` | copy-link + visibility segmented + redaction note | shared (rebuild on Dialog) |
| **P1** | **Step wizard (Contribute)** | peasant `share/StepIndicator.tsx` + LabelsStep/RedactionStep/PushStep | 4-step square wizard + flow steps | peasant (StepIndicator → `trails`) |
| **P1** | **RedactionDiffView** | peasant + village `RedactionDiffView.tsx` | line-numbered redaction review diff (category/confidence/opt-out) | shared (2 apps) |
| **P1** | **TourOverlay + TourProvider** | peasant `tour/*` | spotlight onboarding coachmark | peasant (reusable pattern) |
| **P1** | **Explainer / Term** | peasant `Explainer.tsx`, `Term.tsx` | collapsible help block + glossary tooltip term (neuroinclusive) | peasant (cross-app candidate) |
| **P1** | **SessionScorecard** | tb `views/SessionScorecard.tsx` | healthy/caution/risk band system — **introduces new semantic bands** to reconcile w/ palette | shared (viewer) |
| **P1** | **HighlightsView / DiffsView / FilesView / AnnotationsView** | tb `views/*` | the 4 per-tab content views (FilesView = canonical table) | shared (viewer) |
| **P2** | **ProviderIcon** | peasant + village + tb (3 copies) | provider brand SVGs + `--provider-*` tokens; ship as real React icons not `<use href>` | shared |
| **P2** | **SignInProviders / UsernameGate / auth flows** | village `auth/*` | split-button OAuth + onboarding guard | village |
| **P2** | **MultiSelectPopover / SessionFilterBar** | peasant `*` | faceted filter shell | peasant |
| **P2** | **CollectiveAnalytics → @peasant-labs/analytics** | village `group/CollectiveAnalytics.tsx` | a whole separate shared layer (25 chart types) the DS doesn't cover | village/shared |

---

## 3. coverage gaps within existing documented families

For the ~10 families the DS already documents, these states/variants/sizes are missing (the half-built happy-path problem):

- **Button (`controls`).** No real `:disabled` (faked inline `opacity:.5`), no `loading`/busy spinner+`aria-busy`, no `aria-pressed`/toggle, no link-button, no split-button, no button-group/segmented. Sizes: apps ship `xs`, `icon-xs/sm/lg`, `lg` beyond the DS `sm/md/icon` baseline.
- **Input / Select / Checkbox (`controls`).** No error/invalid (`aria-invalid`), no disabled, no read-only, no helper/hint/error-message slot. No textarea (orphan CSS exists, undocumented), radio group, switch, range/slider, addon/prefix-suffix, multi-select, clearable. Checkbox is a fake label — no real `<input>`, no indeterminate/disabled/keyboard.
- **Badges/Chips (`badges`).** Semantic outcome/status/provider chips are **hand-rolled inline** across SessionPicker, RedactionDiffView, LabelsStep, PushStep, TimeStrip rather than badge variants. No removable/dismissible chip (×), no toggle/selected filter chip, no numeric notification badge, no status dot, no size variants, no disabled chip.
- **Cards & rows.** Only resting state. No card `:hover`, `:focus-visible` (the whole-card link has no documented focus), no `selected`/`active`, no skeleton card, no disabled/archived, no card-with-actions-menu, no selectable (checkbox) row, no density toggle. The documented card-with-header idiom is rebuilt by hand per surface (thin `Card` primitive).
- **Trails.** Tabs render the tablist only — **no panel/content region**, no disabled/overflow/scrollable tabs. Step wizard: no error step, no visited affordance, no vertical orientation. Breadcrumb: no overflow/truncation. Pager: no numbered pagination, page-size selector, or jump-to.
- **Conversation window.** Deepest family, but missing: inline loading state ("loading transcript…"), error/failed-to-load surface, the copy-deep-link affordance, subagent rail treatment, depth indicator, saved-label chips, host action/panel render slots (all shipped in the viewer, undocumented in DS).
- **Dialog.** Single variant only. No drawer/sheet (apps need for filters/details), no alert vs form-modal distinction, no size variants, no submitting/disabled footer state, no `role=dialog`/`aria-modal`/focus-trap (a11y blocker).
- **Canvas.** Resting visuals only. No node hover, multi-select, edge hover/highlight, drag/connect, empty-canvas, loading, or node-error states; minimap viewport rect and timestrip scrubber not documented as interactive states.
- **Forms/filters/empty.** Only one empty state. No loading or error surfaces anywhere; no no-data vs no-results vs offline variants; no first-run zero-state.
- **System-wide.** No loading/disabled/error axis across *any* family — the biggest cross-cutting coverage gap.

---

## 4. componentization plan (HTML partials → real shared React library)

### 4.1 Target architecture
Create **`@peasant-labs/ui`** — a new package in the `transcript-browser` pnpm workspace (`packages/ui`, alongside `packages/theme`, `packages/browser`, `packages/types`, `packages/analytics`).

```
@peasant-labs/theme   (tokens + REAL Tailwind v4 preset) — single source of truth
        ▲                         ▲
        │ consumes tokens         │ consumes tokens
        │                         │
@peasant-labs/ui  ◀── primitives  │   (Button, Input, Dialog, Tooltip, Popover, Menu,
        ▲           Select, Checkbox, Table, Pagination, Segmented, Skeleton,
        │           Collapsible, Chip, Card, Breadcrumb, Tabs, Panel, Kbd, States…)
        │
   consumed by ──┬── unified-identity (docs site = first consumer, living docs)
                 ├── peasant/web
                 ├── village/frontend
                 └── packages/browser (viewer composites build ON ui primitives)
```

The viewer package (`packages/browser`) keeps its **composite** components (TranscriptCanvas, tool-renderers, rails, graph, views) but its `src/ui/*` primitive copy **collapses into `@peasant-labs/ui`** and is re-exported from the existing `primitives` namespace for backward compat during migration.

### 4.2 Package structure (`packages/ui`)
```
packages/ui/
  package.json          # exports: "." (JS), "./styles.css" (scoped component CSS)
  tsup.config.ts        # mirror packages/theme + packages/browser build
  src/
    index.ts            # barrel
    primitives/         # Button, Input, Select, Checkbox, Switch, Radio,
                        # Dialog, Drawer, Tooltip, Popover, Menu, Select,
                        # Table, Pagination, Segmented, Skeleton, Collapsible,
                        # Chip, Badge, Card, Panel, Breadcrumb, Tabs, Kbd,
                        # InlineError, BlankSlate, IconButton, ProviderIcon
    icons/              # ProviderMark React components (Claude/Gemini/…), RoleGlyph
    internal/           # cn (clsx, no twMerge — classes are ours), useDismiss, Portal
    styles.css          # ONE scoped sheet, namespaced .ft-* (or reuse .tb-*) classes
  tests/                # Vitest + RTL smoke + a11y (axe) per primitive
```

### 4.3 API conventions
- **Dependency-free internals** (follow `packages/browser/src/ui` precedent): no Radix, no portals where avoidable — tb already reimplemented checkbox/select/popover/tooltip/collapsible context-based with click-outside+Esc. This is the canonical base; it ships into any host with zero peer-dep risk.
- **One variant taxonomy.** Adopt the shadcn taxonomy peasant+tb share (`variant: default|secondary|outline|ghost|destructive|link`, `size: default|sm|lg|icon` + the extra icon sizes). Provide a **village name-map** (`primary→default`, `danger→destructive`) as a thin compat shim so village migrates without a rename storm. Use CVA for the variant matrix (apps already do).
- **Token-driven, radius-0, hairline.** Every primitive references semantic role tokens (`--accent`, `--ink`, `--rule`, `--danger`), never literal hues. No `--amber` in component code.
- **Lowercase chrome** baked into the component, not the call site (current shell uses Title Case — must lowercase on extraction).
- **Real states.** Every primitive ships real `:hover/:active/:disabled[aria-disabled]/[aria-busy]/aria-invalid` selectors. The "states matrix" (default/hover/focus/active/disabled/loading/empty/error/skeleton) is part of each component's contract — no inline-styled fakes.
- **A11y at the primitive level.** Real `<button role=tab>`/`role=tablist`, `<input type=checkbox>`, `aria-expanded/controls` on collapsibles, `role=dialog aria-modal` + focus-trap on Dialog, accessible names on every icon-only button, decorative SVGs `aria-hidden`. Fix once in the primitive → propagates to all three apps.
- **Slots / render-props for host injection** (mirror the viewer's proven contract): `renderTurnActions`, `renderTurnPanel`, `linkBuilder`, `ViewerCapabilities`/`ViewerCallbacks`. This is the integration pattern the rollout depends on — document it as a first-class API.

### 4.4 Docs site becomes living docs
Rewrite `unified-identity/App.jsx` to **import the real components** from `@peasant-labs/ui` and render specimens, killing three anti-patterns at once: `dangerouslySetInnerHTML` HTML-string partials, the unpkg-lucide CDN + `setInterval` hydration poll, and the global `<symbol>` defs block. The partial-to-JSX conversion is mechanical (static markup). The feedback annotator and docs chrome (Rail, scroll-spy, specimen/dtable) **stay in the docs app — they never enter `@peasant-labs/ui`**. Add a props table to each FULL component section (currently 6/7 of the documented anatomy).

### 4.5 Collapsing the 3 shadcn copies into one
1. Promote tb's `packages/browser/src/ui/*` (most complete, dependency-free, already token-driven) as the **base** of `@peasant-labs/ui`.
2. Backfill from peasant before promotion: richer **Skeleton** (Text/Row/List + reduced-motion) and **states.tsx** (InlineError/BlankSlate); from village: **Pagination**.
3. Reconcile button/badge to one taxonomy + village compat map; lift village's domain badges (visibility/org/collective/attestation) into semantic **Chip** variants.
4. `packages/browser/src/ui` → re-export from `@peasant-labs/ui` (keep `primitives` namespace stable). peasant `src/components/ui/*` and village `src/components/ui/*` → delete, import from `@peasant-labs/ui`. **This deletion is the concrete payoff that justifies the package.**

### 4.6 Build / publish
- tsup build (matches theme + browser). Exports `.` (JS/types) + `./styles.css`.
- In-repo: consumed `workspace:*`. **Fix the consumption seams:** peasant consumes browser/analytics via `file:../../transcript-browser/packages/*` (needs tsup rebuild to propagate); **village consumes vendored tarballs** (`vendor/*.tgz`) so it's pinned to a snapshot — switch village to `workspace:*`/`file:` or automate re-vendoring, else village won't see changes.
- CI gate (currently absent): ESLint + `react-hooks`, Vitest render+axe smoke, **contrast gate** (every text pair ≥4.5:1, every functional border/icon/ring ≥3:1, both themes), typecheck. No publish without green.

### 4.7 Extraction order (dependency-first)
1. **Tokens reconciliation** (blocks everything — see §6).
2. Leaf primitives: **Button → Input/Select/Checkbox/Switch/Field → Chip/Badge/ProviderMark → Kbd → Skeleton → InlineError/BlankSlate**.
3. Overlay primitives: **Popover → Menu → Tooltip → Dialog/Drawer → Command Palette**.
4. Compounds: **Card/Panel/Row → Breadcrumb/Tabs+Panel/Steps/Pagination/Segmented → Table**.
5. Viewer primitives (in `packages/browser`, building on ui): **CodeBlock → Markdown → DiffView → RoleGlyph → ErrorPill/DurationBadge/TokenBadge/OutcomeChip**.
6. Viewer composites: **ToolCallRow + rendererFor + 8 renderers → TurnRow/TranscriptCanvas → PhaseDivider/Checkpoint/TaskBoundary → RightRail/Outlines → Graph → Views → SessionDetail composer**.

---

## 5. rollout plan (clothing the three apps)

> The old `peasant/web/DESIGN_SYSTEM.md` "monochrome-editorial" system is being **replaced** by fairtrade. It shares the same *bones* (radius-0, hairline, monochrome-with-semantics, square steps, intensity ramp, edge tokens), so this is a re-skin, not a teardown.

### Phase 0 — Token reflavor through `@peasant-labs/theme` (unblocks everything)
- Make `@peasant-labs/theme` the single source of truth. Reconcile the **four token files / three namespaces / three dark polarities** into one canonical contract (see §6). Re-flavor values to the Caves-of-Qud identity (amber-on-near-black + warm-paper) and fonts (Chivo/JetBrains → **Atkinson Hyperlegible (Mono)**). Add the missing semantic groups (success/warning/danger, role-*, provider-*, surface-elev, rail, code-bg, edge, intensity ramp) + neuroinclusive tokens.
- Ship a **bridge** so the package's `--tb-*` vars resolve from the canonical names and `.dark ↔ .tb-dark` is wired (today neither app overrides `--tb-*`, so the viewer paints in its own decoupled monochrome palette — this is the central rollout defect).
- **Validation:** because names are preserved, swapping values should reflavor existing app components *in place* with no markup change. Visual-regression snapshot each app's key screens before/after. This is the cheapest, highest-leverage phase.

### Phase 1 — Swap shared primitives to `@peasant-labs/ui`
- Publish `@peasant-labs/ui`; point `packages/browser/src/ui` at it.
- peasant: replace `src/components/ui/*` imports → `@peasant-labs/ui`; delete duplicates. Consolidate the inconsistencies flagged (raw `<input>` in CommandPalette/ProjectPicker, raw checkbox in SessionFilterBar, two breadcrumb impls, inline SVGs in TopNavbar/MultiSelectPopover → lucide).
- village: switch off vendored tarballs; map `primary→default`/`danger→destructive`; replace the 5× hand-rolled modal shells with one `Dialog`; replace 3× compact-row impls and 3× click-outside menus; lift domain badges to Chip variants.
- **Unblocks:** every app deletes its primitive copy. **Risk:** village's vendored-snapshot consumption and two-token-namespace split (`--tb-*` vs `--ink`) — must be resolved in Phase 0 first.

### Phase 2 — Migrate composite / viewer components
- Adopt the new viewer composites (TranscriptCanvas, tool-renderers, rails, graph, views) via the `SessionDetail` capability/callback contract — which both SessionDetailV2 adapters already consume, so this is largely a version bump + token reflavor.
- Reconcile **SessionScorecard's healthy/caution/risk bands** onto the desaturated palette (don't introduce new green/amber/red).
- **Validation:** the QA-on-screenshots loop on a fixed set of real transcripts (read-only viewer renders deterministically with no callbacks — ideal for visual regression).

### Phase 3 — Screen-by-screen
- Sweep each app's flows (peasant: map/review/contribute wizard; village: explore/publish/collectives/auth; viewer: all tabs). Lowercase remaining Title-Case chrome, replace bespoke panels with `Panel`, replace inline-confirm vs modal inconsistency with one destructive-confirm pattern, replace ProviderIcon's 3 copies + inline `providerMarkClass` with the shared component.
- **Validation per screen:** axe + contrast gate + visual snapshot + the screenshot QA loop.

### Sequencing & risks
- Phase 0 **gates** 1–3 (no point swapping primitives that paint from an unreconciled namespace). Phase 1 **gates** 2 (composites build on primitives). 
- **Top risks:** (a) village vendored-tarball pinning — fix consumption seam early; (b) the `--tb-*` vs `--ink` namespace fork silently decoupling the viewer — close in Phase 0; (c) dark-default-polarity mismatch (DS dark-default, theme+apps light-default) — pick one and document; (d) heavy deps (Shiki, react-markdown, diff, @xyflow) if CodeBlock/Markdown/Graph are published — keep @xyflow behind the `renderGraph` render-prop peer-dep isolation that already exists.

---

## 6. quality remediation backlog

Deduped across the audit, grouped by area, prioritized.

### Tokens / theming
- **[BLOCKER] Border contrast.** All four border tokens fail 3:1 non-text floor in both themes (dark `--rule` #2e2b24 ≈1.4:1, `--rule-strong` #4d483e ≈2.2:1; light `--rule` #cfc8b9 ≈1.6:1, `--rule-strong` ≈2.2:1) — yet borders are functional (cards/inputs/tables/turns/dividers). Raise lightness to clear 3:1, keep 1px. Targets ≈ dark `--rule` #46423a / `--rule-strong` #5e5849; light `--rule` #b4ab98 / `--rule-strong` #938b78. The doc *claims* this was fixed; it was not.
- **[MAJOR] `--ink-4` as text.** Documented "faint/placeholder" but used as real text (turn meta, tab counts, phase ranges, tool meta, diff line numbers, code comments). Dark #534e45 ≈2.4:1, light #837d72 ≈3.9:1 — both fail 4.5:1 reading floor. Split: add decoration-only `--ink-5`, re-point text usages to a text-safe `--ink-4` (dark ≈#8a8478, light ≈#6f695e).
- **[MAJOR] Rollout token contract.** DS (`--ink`/`--amber`, hex, dark-default `[data-theme=light]`) vs theme package (`--tb-*`, hsl, light-default `.tb-dark`) vs apps (hsl-triplet `--ink`/`--mark`). Pick one canonical form; have DS generate the `--tb-*` mirror + app hsl-triplet form; reconcile dark-default polarity; make `preset.ts` a **real** Tailwind v4 preset or stop implying it is one (it's a name-map stub today).
- **[MAJOR] Missing semantic tokens.** Add `success/warning/danger` (+`-fg`/`-soft`), `--mark`/`--mark-fg`, `--surface-elev`, `--intensity-0..4`, `--edge`/`--edge-strong`, `--rail`, `--code-bg`, `--role-user`/`--role-assistant` (+soft), `--provider-*` — using the apps' existing names so they map 1:1. Replace the DS's ad-hoc `color-mix()` role/state tints with these.
- **[MINOR] `--amber-dim` active-marker** fails 3:1 in light (#b09a63 ≈2.6:1) on the `>` orientation glyph — use `--amber`/`--amber-bright` for the marker.
- **[MINOR] Missing scales:** add `--z-*` (nav/sticky/dropdown/dialog/toast/tooltip — overlay families have nothing to inherit), `--dur-*`/`--ease-*` (durations/easing are inline literals), one `--shadow-sticky` for the permitted frozen-header edge.

### A11y / semantics (fix at the primitive level — propagates to all 3 apps)
- **[BLOCKER] Heading hierarchy.** No `<h1>`; section titles are `<span class="label">`. Promote to `<h2>`/`<h3>`, add a real page `<h1>` (CSS targets by class → zero visual change).
- **[BLOCKER] Inert interactive primitives.** Tabs/steps/filter-options/canvas-nodes/collapsible-headers are non-focusable divs/spans. Make real controls: `role=tab`/`tablist`, `aria-current=step`, real checkboxes, `aria-expanded/controls` on collapsibles, focusable nodes.
- **[MAJOR] Accessible names.** Icon-only buttons (canvas zoom/fit, dialog close, pager prev/next, ~57 copy-token buttons) lack `aria-label`; decorative lucide icons need `aria-hidden`.
- **[MAJOR] Form labelling.** Labels are `<span>` not `<label for>`; search inputs rely on placeholder; select has no label; checkbox has no real `<input>`.
- **[MAJOR] Live region + dialog semantics.** Zero `aria-live` anywhere (toasts/copy silent to AT); dialog has no `role=dialog`/`aria-modal`/`aria-labelledby`/focus-trap/Esc/return-focus.
- **[MINOR] Lists not marked up** as `<ul>`/`<ol>` (rows, breadcrumb-as-`<nav><ol>`, chip groups).

### Consistency / craft
- **[MAJOR] Color specimen bug** (`24-color.html`): swatches show wrong hex (ink shows `--ink-strong`, surface shows `--surface-2`, rule shows `--rule-strong`) and an invented `amber-hi` name (should be `amber-bright`). Drive specimen + table from one source array.
- **[MAJOR] Motion contradiction:** doc says "≤200ms" but ships 900ms reveals/hero. Either carve out one-time entrance motion explicitly or tighten the `.reveal` (it runs on doc body).
- **[MINOR]** PRESENTATION.md §4 names primitives (`.token-table`/`.spec-table`/`.props-table`) that don't exist (collapsed to `.dtable`); add the missing props tables; two em-dashes in App.jsx comments violate the system's own anti-slop rule.

### Code / build
- **[BLOCKER] Drop unpkg-lucide CDN** (`index.html:14`, all partials) — unpinned `@latest` third-party runtime dep + `setInterval` hydration poll + lucide shipped twice. Convert partials to JSX using bundled `lucide-react`.
- **[MAJOR] Partial-loader architecture** — 20 `?raw` HTML strings via `dangerouslySetInnerHTML` defeat React (no props/types/reuse). Port to JSX (the core §4 refactor).
- **[MAJOR] No quality gates** — no tests/lint/typecheck/CI verification; deploy can ship a blank page. Add ESLint + render smoke + the promised contrast gate.
- **[MAJOR] Dead code** — delete `src/gallery.html` (26KB), 8 unused `src/img/*` (~1.2MB), unused effects exports (AsciiArt/Halftone/AsciiText/GlyphField).
- **[MINOR]** Pull the ~250-line feedback tool out of the production bundle (lazy-load/env-gate); split App.jsx into modules; document the deploy base-path contract (repo `unified-identity` / package `peasant-design-system` / base `/peasant-design-system/` all differ).

---

## 7. recommended first sprint

Ordered, concrete, ~13 items. The theme is "reconcile the contract and prove one component end-to-end before fanning out."

1. **Wire the contrast CI gate** (script over both themes: text pairs ≥4.5:1, functional borders/icons/rings ≥3:1, APCA tags). It catches items 2–3 immediately and is the gate everything else proves against.
2. **Fix the two contrast blockers:** raise `--rule`/`--rule-strong` to clear 3:1; split `--ink-4` into a text-safe value + decoration-only `--ink-5`. Re-point the `--ink-4`-as-text usages.
3. **Reconcile the token contract** in `@peasant-labs/theme`: pick canonical names, add the missing semantic groups (success/warning/danger, role-*, provider-*, surface-elev, rail, code-bg, edge, intensity, z-*, dur-*/ease-*) using the apps' names, add the `--tb-*` mirror + bridge, reconcile dark-default polarity, and either make `preset.ts` a real Tailwind v4 preset or rename it.
4. **Reflavor theme values + fonts** to Caves-of-Qud (amber-on-near-black + warm-paper, Atkinson Hyperlegible/Mono) on the reconciled names — this is Phase 0 of rollout.
5. **Drop the unpkg-lucide CDN** and the `setInterval` poll; switch all icons to bundled `lucide-react`; delete the global `<symbol>` defs pattern.
6. **Scaffold `packages/ui`** (`@peasant-labs/ui`): package.json + exports + tsup + `internal/cn` + namespaced `styles.css`, promoting tb's `src/ui/*` as the base; add Vitest+axe harness and a CI gate (lint/typecheck/test/contrast).
7. **Extract `Button`** end-to-end as the reference: CVA variant/size matrix (shadcn taxonomy + village name-map), **real** `:disabled`/`loading`(`aria-busy`)/`aria-pressed` states, typed props, props table, axe-clean, lowercase chrome.
8. **Make the docs site consume `<Button>`** from `@peasant-labs/ui` (first real downstream consumer) — replace that partial with the imported component, proving the API is reusable and killing `dangerouslySetInnerHTML` for one section.
9. **Build the `Dialog` primitive** (highest dedup value: replaces village's 5 hand-rolled modal shells + tb ShareDialog) with `role=dialog aria-modal`, focus-trap, Esc, scrim-dismiss, return-focus, size variants, submitting footer state.
10. **Fix the heading hierarchy + add one `aria-live` toast region** across the docs partials (promote `<span class="label">` → `<h2>`/`<h3>`, add `<h1>`) — restores the AT outline at zero visual cost.
11. **Script `aria-label` onto all ~57 copy-token buttons** from their `data-copy` value and `aria-hidden` decorative icons.
12. **Make the real checkbox/select/collapsible/tooltip/popover** keyboard- and AT-operable in `@peasant-labs/ui` (replace the fake `.check` label with a real `<input>`; `aria-expanded/controls` on collapsibles).
13. **Purge dead code** (gallery.html, 8 unused images, unused effects exports) and fix the `24-color.html` swatch hex/`amber-hi` bug by driving specimen + table from one source array.

**Critical path:** items 1–4 unblock all rollout phases; 6–9 prove the library shape; the rest harden the docs site into living docs. After this sprint the "names preserved, values swap" thesis holds, one primitive is proven end-to-end, and the deletion of the three duplicate `ui/` copies (the concrete payoff) is unblocked.

---

**Key findings worth flagging to the user:**
- The rollout's foundational premise ("only values + fonts change") is **false today** — verified three live token namespaces with three dark-mode polarities; the viewer currently paints decoupled from app themes because neither app overrides `--tb-*`. This must be fixed in Phase 0 or nothing else lands cleanly.
- The DS's own neuroinclusive/a11y claims are **contradicted by the shipped values** (borders, ink-4) and markup (no headings, inert controls) — the most damaging debt to fan out into three apps.
- The single highest-leverage componentization move is **Dialog** (replaces 5+ hand-rolled village modals) and the largest *uncovered* territory is the **per-tool renderer system** (dispatcher + 8 renderers in `packages/browser`).
- Plumbing risk: **village consumes the viewer via vendored tarballs** (pinned snapshot) — it won't see package changes until that seam is switched to workspace consumption.
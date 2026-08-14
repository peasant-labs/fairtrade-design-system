# Changelog

All notable changes to `@peasant-labs/fairtrade` are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this
package is pre-1.0, so minor/patch semantics are best-effort.

## 0.0.14 — 2026-08-14

### Fixed

- **Stable Explore pagination intent.** The commons `Explore` pager now treats
  response page metadata as descriptive after using the initial payload to seed
  its starting page. Stale or out-of-order payloads can no longer overwrite a
  newer user or filter page choice, and filter changes reset to page 1 exactly
  once while preserving the existing public props and pagination accessibility.

## 0.0.13 — 2026-08-14

### Added

- **Constrained redaction levels.** `RedactionReview` accepts `availableLevels`
  to limit which redaction levels render. Subsets render in canonical order; a
  single available level removes the level selector, its label, and its
  description entirely, so absent levels never reach the DOM. Validation fails
  closed: an empty or unknown set, or a controlled `level` outside the set,
  throws an actionable error, and `onLevel` only ever receives a rendered
  available level.

### Fixed

- **Neutral kept originals.** Keeping a match un-redacted now neutralizes the
  original row (neutral surface and rail, no strike-through, an eye cue instead
  of the deletion minus) while the unused replacement stays phased out, in both
  themes, with matching screen-reader labels.
- **Narrow review composition.** The review surface reflows from 320px up via a
  component container query: the level selector stacks, card heads wrap, and
  content stays contained without page-level horizontal overflow. Desktop
  layout is unchanged.

## 0.0.12 — 2026-08-12

This release restores transcript content fidelity across the shared viewer. It
depends on `@peasant-labs/schema@0.1.1-rc1` for the canonical
`observedModel` contract and runtime validation.

### Added

- **Safe structured transcript content.** Transcript bodies now render GFM
  tables and lists, fenced code, bold text, inline code, and every source
  newline through structured React nodes. Wide tables and code blocks scroll
  independently while prose keeps its readable measure. Raw HTML and unsafe
  links remain inert, syntax highlighting remains structured, and the enforced
  `codeToHtml()` ban is preserved.
- **Sticky observed-model attribution.** The adapter consumes the canonical
  `observedModel` contract over the complete ordered transcript before
  filtering or projection. `effectiveModel` carries the latest root-assistant
  observation across omitted values, and `modelChangedFrom` marks only real
  observed transitions. Repeats do not create markers, switchbacks do, and
  inline subagent observations do not mutate root state.

### Changed

- **Full-trace reading restoration.** Leaving full trace through file or diff
  navigation now preserves the internal reading position and meaningful focus,
  then restores both when full trace is selected again. The existing full-trace
  tab is the return action; no dedicated return button is added.
- **Exact assistant model chrome.** Turn headers use the semantic `assistant`
  role while provider branding stays separate and accessible. Every
  attributable assistant turn renders its exact effective model, observed
  changes render one in-flow `model changed` marker, and sticky active-turn
  chrome follows the current effective model rather than the session seed.

## 0.0.11 — 2026-08-03

### Changed

- Pinned `@peasant-labs/schema` to the final `0.1.0` contract release. This is
  a dependency-only update with no UI or behavioral changes.

## 0.0.10 — 2026-07-29

Strike becomes a first-class provider: it now carries a real brand mark and a
canonical identity everywhere a provider is named.

### Added

- **Strike provider identity.** `strike` joins the canonical provider policy
  with the display name `Strike`, its own brand mark, and the `clay` accent
  (shared with `cursor` — the mark and written name remain the identity, never
  colour alone). `providerDisplayName`, `providerBrand`, and `providerAccent`
  resolve it like any other harness, and unknown values still fail closed.
- **`<BrandMark name="strike">`.** The path is Strike's official favicon
  geometry, copied byte-for-byte. Because that geometry occupies only a 10x20
  area of its source 32x32 canvas, the mark is shown through a crop window
  centred on the glyph so it matches its peers' optical weight rather than
  rendering at roughly half their size. The canonical Strike project is
  Apache-2.0 licensed and has granted permission for this use of its brand mark;
  the mark is used only for nominative provider identification.
- **`data-brand` on every brand mark**, so consumers and gates can assert which
  mark mounted rather than merely that one did.

### Changed

- Provider gates now derive their inventory from the canonical schema enum
  instead of a duplicated manifest list, so a schema bump alone turns the
  fixture red until the display policy is completed for the new provider.
- Pinned `@peasant-labs/schema` to `0.1.0-rc10`, which carries the Strike
  harness in the wire contract.

## 0.0.6 — 2026-07-04

The transcript composite becomes the one viewer every consumer renders, and
charts stay legible at live data scale.

### Added

- **TranscriptViewer host seams** — apps mount the composite directly instead
  of sibling composers: `breadcrumb` + `LinkComponent` (host-routable,
  origin-aware trails through the app router), `renderTurnPanel` (host
  content under each turn card), `renderTurnActions` (replaces the built-in
  label affordance so hosts with typed label models keep their own popovers),
  `anchorHref` (copied turn anchors become real permalinks; root-relative
  returns absolutized), and `headerActions` (host session-level actions —
  village's attest — lead the hero action row instead of floating in their
  own strip). Every seam renders the demo
  byte-identically when unused. `BreadcrumbItem` joins the published types.

### Fixed

- **Chart axes at live data scale.** X ticks thin automatically instead of
  overlapping (27 iso-weeks of labels were illegible under the old
  every-tick layout); y ticks compact thousands (3000 → 3k, overridable via
  the new `yFormatter` prop) in a wider gutter instead of clipping to their
  trailing digits. A live-scale fixture story gates the regressions.
- **Map zoom controls receive real clicks.** The canvas pan handler captured
  pointers born on its own buttons; pointer capture retargeted the pointerup
  so no click was ever composed. Pointers born on interactive controls are
  excluded from the pan capture, and a real-input CI gate (CDP mouse) keeps
  the class dead — synthetic-event tests cannot see it.

## 0.0.5 — 2026-07-03

Patch: the analytics surface renders correctly inside consuming apps.

### Fixed

- **Analytics cards un-clamped in consumer contexts.** The presentation site's
  bare `section` reading-measure rule (`max-width` in `ch`, centered margins,
  gutter padding) ships inside `components.css`'s `@layer base`; a consumer
  bundle may declare `@layer analytics` before `@layer base`, and the
  later-declared layer wins — so the site rule clamped the dashboard's cards
  in the apps (the mono-font cards shrank to ~360px and centered; card
  vertical padding collapsed). Same collision the commons surfaces guard
  against with `.cmg-page section` and the demo stage with `.iu section` —
  `analytics.css` now carries an UNLAYERED `.gan-root section` un-clamp
  (order-robust: unlayered beats every layer) and re-asserts the card box,
  including the ≤560px compact variant.
- **Deterministic dashboard header.** The header is a column (title block,
  then the section-chip row below it, left-aligned) instead of a
  width-dependent flex-row wrap — chip placement no longer changes between
  the demo stage and app pages.
- **Weekly active|new toggle returns to the card-head aside** (chips,
  top-right — the arrangement the consuming apps shipped with, confirmed at
  UAT), with the current series' total merged back into the card subtitle;
  the body toolbar chrome is retired.
- **Chart gridlines are legible again**: `--chart-grid` moves from `--rule`
  (decorative-tier, ~1.8:1 on canvas) to `--rule-strong` (~3.6:1) — applies
  to every chart consumer.

## 0.0.4 — 2026-07-02

The **consumer-adoption** release. `@peasant-labs/fairtrade` now exports the
composite **commons** (Explore, Manage), **graph** (Code Map, Changes,
Change Detail) and **analytics** (Project Overview dashboard) surfaces — plus
the shared in-use app **shell** — so consuming apps (peasant, village) compose
the real design-system surfaces from the library instead of hand-rolling
look-alikes. Ships with per-surface bundle isolation, a typed prop-payload
contract per surface, and a batch of governance-component (RoleRoster /
RailShell / settings-form) fixes surfaced by the village adoption UAT.

Consumed by peasant `web` and village `frontend` (their
`fairtrade-1--breaking--adopt-fairtrade-design-system` branches). No breaking
changes to the 0.0.3 transcript exports.

### Added

- **Commons surfaces (`@peasant-labs/fairtrade/commons`)**
  - `Explore` — the shared discovery surface (facet rail: order / provider /
    topics, search, grid/list/profile toggle, transcript cards with BrandMark
    provider chips). Consumers feed real data via an adapter.
  - `Manage` — the collective governance surface, composing `RoleRoster`,
    `ModerationQueue`, `PolicySelect`, `DangerZone`, provider-share `ProviderBars`,
    and the GovTile stat tiles.
  - Typed prop-payload contracts for both (`ExplorePayload`, `ManagePayload`, and
    the member/transcript/stats/contributor sub-payloads) + the canonical enum
    arrays (`DATA_ACCESS_POLICIES`, `ACCEPTANCE_MODES`, `COLLECTIVE_ROLES`, …).
- **Graph surfaces (`@peasant-labs/fairtrade/graph`)**
  - `CodeMap` + `CodeMapComposition` — the full code-topology surface over the
    shared `MapCanvas` (toolbar, minimap, zoom, find-node, square nodes,
    orthogonal edges, violation badges, legend inside the canvas column).
  - `Changes` — the git-graph review surface (`CommitGraph` lane derivation
    ported into the package) and `ChangeDetail` lifted onto the kit `DiffView`
    (git hunk headers, per-hunk attribution, diff-error state).
  - Typed graph prop-payload contracts (`47f7b91`) + a pinned
    `ChangeDiffPayload` host-side error sentinel in the contract.
- **Analytics surface (`@peasant-labs/fairtrade/analytics`)**
  - `ProjectOverview` — the configurable analytics dashboard (KPI stat tiles,
    the chart grid on the shared `ChartBar`/`ChartLine` primitives, outcome
    donut, typical-vs-tail median·p90 grid, and a sortable 7-column contributor
    table on the shared `.tbl-*` family), with the visible-section chip row and
    the weekly active|new series toggle. Previously the standalone
    `@peasant-labs/analytics` package — now lifted in-repo, fully re-tokenized
    (both themes from fairtrade tokens, lowercase chrome at the source; the
    per-app theming patches consumers carried become unnecessary).
  - `ChartCard` + `ContributorTable` as composable pieces, and the pure metric
    core (`computeProjectAnalytics` + the per-metric functions, `median`/`p90`
    stats, UTC ISO-week bucketing) — importable without React for hosts that
    only need the numbers.
  - Typed prop-payload contract (`AnalyticsOverviewPayload` — raw
    `AnalyticsSessionRecord[]` the surface computes itself, or a pre-computed
    `ProjectAnalytics` bundle) + canonical enum arrays
    (`ANALYTICS_SESSION_OUTCOMES`, `PROJECT_OVERVIEW_SECTION_KEYS`), enforced by
    a contract type-test and dependency-free metric teeth-tests in `build:lib`.
- **In-use app shell (`inuse/InUseShell`)** — shared shell primitives
  (`GraphSectionNav`, subnav, the `.iu-` chrome) so consumers get the demo's
  lowercase amber-pill navigation, back control, avatar, and sign-in layout.
- **`RoleRoster.filterSlot`** — an optional caller-supplied row rendered inside
  the roster's own bordered box (used for an in-list "show / filter by org" row).
- **`RoleRoster.canManage`** (default `true`, backward-compatible) —
  viewer-permission-gated inline role editing: owners get the editable role
  `Select` + remove; non-owners get read-only role text; owner rows stay locked.
- **`.sw-stack`** switch layout (label → mono hint → `[toggle] {on/off}` on its
  own line) for stacked form toggles.
- **Build:** per-surface entry points (`/graph`, `/commons`, `/analytics`) with
  intra-package bundle isolation (a consumer of one surface family never bundles
  another's) + their matching `graph.css` / `commons.css` / `analytics.css`; a
  CSS-token lint, a per-surface contract gate, and the analytics metric
  teeth-tests added to `build:lib`.

### Changed

- **Graph shell nav order** is now `analytics · changes · code map` (canonical).
- **The demo's analytics view renders the in-repo `ProjectOverview`** — the
  `@peasant-labs/analytics` import and the out-of-tree Vite aliases that served
  it are gone, so the library no longer depends (via its own demo) on a package
  that depends back on the library, and the isolated CI builds the demo from
  in-repo sources only.
- **Settings-form typography** unified onto the DS tiers: field titles at the
  `--ink-2` (distinctive) tier, hints/descriptions at `--ink-3` (faint) — a real
  two-tier hierarchy — with mono lowercase notice/danger bodies and the
  `.cmg-settings-form` scoping so it doesn't ripple to other surfaces.
- **`DataAccess` typedef renamed to `DataAccessPolicy`** for array-name parity
  with the other enum contracts.
- **Neuroinclusive:** removed the dot-grid "technical terminal backdrop" from the
  base `body` rule — it sat behind text/data, violating the DS's own
  "one flat background behind reading content" rule (`NEUROINCLUSIVE.md §2`). The
  texture remains available on non-text chrome (`.canvas` decorative box). All
  consumers now inherit a flat background by default.
- **`show-members` Switch** renders toggle + label + state inline in the demo,
  matching consumers.
- Dropped unused React imports left by the surface lift/rewire.

### Fixed

- **RoleRoster / governance blocks — narrow-rail containment.** Wide governance
  blocks (`RoleRoster` / `ModerationQueue`) are wrapped `overflow:auto;
  max-width:100%` per the DS spec so they can't bleed past their box; the
  `RoleRoster` row is now a **size-query container** whose fixed `15ch/16ch`
  tracks shrink/stack below the rail width (labels stay fully visible, no clip,
  no page bleed), the remove trigger is **right-aligned** and clay/red, and rows
  are width-responsive (compact vs. 3-tier).
- **RailShell** — rail sections are constrained to the rail's width
  (`width:100%; min-width:0`) so long titles ellipsis instead of widening the
  rail box.
- **Map legend** is positioned inside the canvas column (a sibling of the canvas
  region), not after `RailShell`, so its vertical position no longer follows the
  rail's content height.
- **ChangeDetail** — exit buttons wired, git hunk headers preserved, a diff-error
  state added.
- **`css-token-lint`** named-colour check ignores `var()` token names (no false
  positives); corrected an activity-edge element type + strengthened the surface
  enums; rephrased diff-hunk JSDoc to avoid a `checkJs` tag-parse error.
- **Storybook smoke is signal-driven and concurrent** (`scripts/sbsmoke.mjs`):
  story readiness now comes from Storybook's render-phase channel events
  (`completed`/`errored`/`aborted`, thrown story/play exceptions) instead of a
  fixed per-story sleep, stories run through a 4-tab pool (CI runners have 2-4
  vCPUs), and per-tab CDP focus emulation keeps focus-dependent `play()`
  assertions valid in background tabs. Full 410-story catalog: ~8 min → ~40 s.
  A story-id substring arg enables fast local runs (loudly marked as filtered).

### Notes for consumers

- Import surfaces from the per-surface entry points and ship the matching CSS:
  `@peasant-labs/fairtrade/commons` + `commons.css`,
  `@peasant-labs/fairtrade/graph` + `graph.css`,
  `@peasant-labs/fairtrade/analytics` + `analytics.css`. A consumer that renders
  a surface **must import its stylesheet** or the surface ships unstyled. The
  analytics dashboard also composes the shared table/chart chrome, so import it
  alongside `tokens.css` + `base.css` + `components.css`.
- Migrating off `@peasant-labs/analytics`: the import moves to
  `@peasant-labs/fairtrade/analytics`, the component takes one cooked
  `payload` prop (`{ sessions }` or `{ analytics }`) instead of loose
  `sessions`/`analytics` props, and the app-side adapter keeps mapping its wire
  data to the (now fairtrade-owned) session-record shape.
- Fonts: load Atkinson via a self-hosted `<link>` / `next/font/local`, not a
  remote `@import` (Next production CSS drops remote `@import` → whole-app mono
  fallback).

### Known follow-ups (tracked; not blocking)

- `<Button>` is not `forwardRef`-wrapped (ref-based popover anchoring uses a
  `:scope > button` workaround).
- DS voice cleanup: the demo commits middots `·` and em-dashes `—` its own docs
  ban; provider chips in the Manage data-table use a generic glyph rather than
  `<BrandMark>`.
- A DS "styling recipes + self-consistency" pass (a single field-label primitive;
  reconcile `.label`/`.sw-label`/`.is-radio` for the same role).

---

## 0.0.3 — 2026-06-25

Transcript component-lift release: extracted the ~17 in-use transcript
components into the exported `/ui` library (composite `TranscriptViewer` +
primitives + graph node-visuals), consumed via the `adaptTranscript` adapter.
First release consumed by `transcript-browser` (`^0.0.3`).

## 0.0.2 — earlier

Token + base-style groundwork (pre-changelog).

## 0.0.1 — earlier

Initial published skeleton (tokens, base CSS, first component exports).

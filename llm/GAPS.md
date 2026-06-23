# rebuilding the peasant apps with fairtrade — coverage map

Goal: fairtrade carries everything needed to rebuild peasant's apps from scratch — **peasant web**
(local code-map + change review + contribute), **village** (the commons), the **transcript browser**
(shared viewer), and the **peasant TUI** (two terminal flows). Derived from a full scout of all four
sibling repos. As of 2026-06-22 the component coverage, the app-level integration (§3), AND the
feedback round-3 component polish are all **complete** — the in-use mockups are wired onto the kit and
the redundant "rebuilt apps" doc bands were removed (superseded by the in-use stage). No pending backlog.

Legend: **[have]** pre-existing · **[new]** added this pass · **[wire]** component exists, app
integration is the remaining work.

---

## 1. foundations

- **[have]** tokens (color/ink/rule/amber/earth, 4/8 spacing, one control height, radius 0), two themes,
  WCAG gate both themes; typography (atkinson mono chrome+code / atkinson proportional prose).
- **[have]** primitive library (`src/ui/*`): Button/Segmented, Input/Select/Checkbox/Radio, Switch,
  Chip/FilterChip/StatusDot/CountBadge, Card/Row, Tabs, Breadcrumb/Steps, Pager, Pagination, Menu,
  Tooltip/Popover, Avatar/Kbd/Tag, BrandMark, EmptyState, Skeleton/Progress/Spinner/Toast, DataTable,
  ChartBar/ChartLine/Sparkline, Accordion, Timeline/ToolCall/ThinkingBlock, ToastHost, DateRange,
  Dialog, CommandPalette.
- **[new]** `--amber-fill` / `--amber-fill-ink` — golden amber FILL split from accent-text amber, so
  selected/toggled controls read amber (not amber-dark) in the light theme.
- **[new]** monochrome **intensity ramp (0–4)** shipped as a component (Intensity) + reused across
  MapNode fill, Treemap, StepsWaterfall bars, TimeStrip, MapCanvas. (Optionally promote `--ir-0..4` to
  `:root` so it themes centrally without the `<IntensityScope>` wrapper.)

## 2. tier-3 "in use" composites — built this pass

All self-contained: `src/ui/<Name>.jsx` + colocated `<Name>.css` + `<Name>.stories.jsx` (title
`in use/<Name>`), tokens-only, exported from `src/ui/index.js`. See [[tier3-component-convention]].

**viz / canvas**
- **Intensity** — 0–4 ramp, IntensitySwatch, RampLegend, Heatmap, **MapNode** (size=loc, fill=coverage,
  amber border+marker=selected, clay badge=violation, effort bar; channels orthogonal).
- **MapCanvas** — the P0 interactive code-map: dot-grid pan/zoom (no scroll-hijack), metric-encoded
  square nodes, structure vs weighted-activity edges, **semantic-zoom grain** (overview/folders/files
  with edge-lifting to nearest visible ancestor), on-canvas zoom controls, minimap, node search, full
  keyboard roving-nav + aria-live.
- **Treemap** — squarified (BHvW), area=churn, monochrome intensity, contrast-aware label ink.
- **CommitGraph** — commit lane graph: fork/merge elbows, lanes by ink weight, filled dot = has session.
- **TimeStrip** — activity sparkline-scrubber, right-anchored, keyboard playhead, branch chips.
- **StatTiles** — StatTile/StatGrid, GovTile (governance tiles), **ProviderBars** (distribution bars).

**code / transcript**
- **DiffView** — unified hunk diff (rails + +/− gutter, no highlight) + a redaction variant.
- **ToolRenderers** — `<ToolCall>` dispatching to 8 tool bodies (read/edit/write/bash/grep/task/
  webfetch/default), collapsible, status icon+word.
- **TranscriptMarkers** — sticky **PhaseDivider** (`<Phase>`), **TaskBoundary** (churn rollup),
  **CheckpointMarker**, **TurnContextBar** (sticky active-prompt strip).
- **StepsWaterfall** — per-task duration-bar timeline.
- **EvidenceCaption** — click-to-evidence recap; fragments are buttons that scroll to `<EvidenceTarget>`.
- **ProviderIcon** — ProviderIcon/ProviderTag/ProviderName + a per-provider accent map + AccentLegend
  (the 5 harnesses: claude-code/gemini-cli/codex/opencode/cursor).

**flows / shells / onboarding**
- **StepWizard** + **StepIndicator** — reachability-gated multi-step flow.
- **RailShell** + **RailSection** + **SplitRail** — canvas+sticky-rail app shell → mobile bottom-sheet.
- **GroupedMultiSelect** — tri-state project→session selection tree + token tallies.
- **Tour** — backdrop-cutout spotlight coachmark, progress dots, focus-trap.
- **Explainer** + **Term** — in-place "what am i looking at?" + glossary tooltip.
- **ConnectionState** — ConnectionPill + **DataState** (disconnected ≠ empty) + **TeachingEmptyState**
  (CLI command chip).
- **CliOnboard** — CommandBlock (copy) + CliSteps + dismissible GettingStarted.
- **SignIn** — multi-provider OAuth split-button + HandleClaim + OnboardingCard.
- **FacetRail** — faceted filter rail (order / provider / topic tag cloud with counts).

**governance / consent (village)**
- **ConsentDialog** + **ConsentSummary** — the axes summary + join/contribute/leave consent dialogs
  (identity reveal scoped to owners; private→shared default; retention-on-leave).
- **PolicySelect** — enum + one-line rationale rows (data-access / acceptance / retention).
- **ModerationQueue** + **ApprovalBar** — approve/reject queues + sticky bar, optimistic resolve.
- **RoleRoster** + **ConfirmInline** + **DangerZone** — role roster, inline destructive-confirm, danger zone.
- **VisibilityControl** — VisibilityEye + VisibilitySegmented + ScopeChip + FocusedModeToggle.
- **Redaction** + **WhereDoesThisGo** — redaction review + "what's sent / what stays private" panel.

**terminal (peasant TUI, both flows — page showcase in `sections-react/56-terminal.jsx`)**
- **Flow A** — the analytics TUI (dashboard metric cards + sparklines/trends, sessions table → detail,
  7-day trend bars), interactive tabs, re-skinned onto the tokens.
- **Flow B** — the `peasant kickstart` FTUE wizard (welcome+oauth → providers → privacy → retention →
  summary → staged ingestion), interactive, one frame with a "step N of M" header.

## 3. integration — DONE (shipped in `9bb1ef5`)

The in-use mockups now consume the kit (they were bespoke re-implementations):
- **[done]** transcript: assistant icon + accent keyed off the session `HARNESS` via `ProviderIcon` +
  `PROVIDER_ACCENT` (user=teal / assistant=amber default; re-themes per provider).
- **[done]** commons governance: PolicySelect + RoleRoster + StatTiles/GovTile + ProviderBars +
  ModerationQueue + ConsentDialog + DangerZone in `CommonsManage`/`CommonsExplore`.
- **[done]** changes view: the kit `CommitGraph` bound to a SHA-keyed `HISTORY` dataset (select → detail).
- **[done]** map app: `MapView` = `RailShell` + `MapCanvas` + `TimeStrip` + `ConnectionPill`/`DataState`
  with a mock connection feed (accepted regressions: tangle edge → activity + violation badge,
  delta/lit-hover/time-scrub-coupling dropped, auto-row layout).

The composites are showcased as the doc bands `70`–`80` (the earlier `82`–`86` "rebuilt apps" bands
were removed — the in-use stage carries the better, kit-wired versions). Feedback round 3 (component
polish) is complete; no pending backlog.

### governance vocabulary (for the wired surfaces)
Identity visibility: joining reveals your profile to OWNERS ONLY; other members see `anon`. Data access:
`members_only` / `contributors` / `public`. Acceptance: `open` / `verified_only` / `curated` (curated →
owner review queue); transcripts private by default, contributing flips private→shared. Retention on
leave: `user_choice` / `mandatory`. Roles: owner / member / contributor (join lands as contributor).

### gates
`pnpm build` (contrast, both themes) · `node scripts/sbsmoke.mjs` (every story) · `node
scripts/validate.mjs` (interactive). Keep radius 0, amber scarce, meaning never on color alone, motion
behind `prefers-reduced-motion`, 16px text floor / mono-14 chrome.

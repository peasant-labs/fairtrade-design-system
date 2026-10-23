# Changelog

All notable changes to `@peasant-labs/fairtrade` are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this
package is pre-1.0, so minor/patch semantics are best-effort.

## 0.0.32 - 2026-10-23

### Added

- Export `AppSidebar`, `AppSidebarLayout` and `APP_SIDEBAR_APPS` from `/ui`: the
  shared sidebar for every app screen (online, local and docs). It collapses to
  an icon rail, resizes by pointer or by arrow keys, Home and End, remembers its
  collapse and width, lists groups of icon or swatch items with a current item
  and an outside-the-app marker, carries the online / local / docs app switcher
  and an account row, and becomes a top bar with an opaque drawer below 768px.
- Add `--amber-fill-hover`, the primary button's hover fill, and
  `--ease-in-out`, the curve for moving something already on screen.

### Changed

- Dark theme: one flat ground. `--surface` equals `--canvas` (`#0b0b0a`), so
  panels are told apart by an edge, never by a grey on black; `--surface-2`
  (`#1c1b18`) is kept for selected rows and inset wells. Dividers (`--rule`)
  read 2.24:1 and panel edges and control borders (`--rule-strong`) 4.95:1 on
  the ground; `--ink-3` reads 8.81:1 and `--ink-4` 7.12:1. The accents lift with
  the inks.
- Light theme: `--surface` equals `--canvas`; `--rule` reads 2.19:1,
  `--rule-strong` 4.26:1 and `--ink-4` 6.35:1 on the ground.
- The primary button is filled with `--amber-fill` and labelled with
  `--amber-fill-ink` in both themes, and hovers to `--amber-fill-hover`. Buttons
  scale to 0.97 on press when motion is allowed, and button hover styles apply
  only to a fine hovering pointer. `--ease-out` is now
  `cubic-bezier(.23, 1, .32, 1)`.
- The local app registry labels its hosted-app entry `online`; its id and route
  stay `village`. The observations panel heading, the publish copy and the
  manage breadcrumb say online or peasant online.

### Compatibility

- No API, prop, id or wire change. A host that matches the local nav by its
  visible label `village` should match the id instead.

### Tests

- The contrast gate fails below the new floors: muted inks 6.3:1, panel edges
  4:1 and dividers 2:1 on the ground, plus the primary hover label.
- A mounted fixture gate with production mutations covers the app sidebar.

## 0.0.31

### Fixed

- Keep absolute accessibility labels inside the Village evidence panel when
  reduced motion disables animation transforms. Bounded hosts no longer gain
  document overflow from offscreen catalog rows; all evidence stays reachable
  through the existing native scroller.

### Tests

- Verify static and motion-allowed panel containment in both themes and viewport
  sizes, including positioned hosts, complete row retention and keyboard focus.
- Hold ordinary async publication completion during native dismissal and
  duplicate-activation checks, retaining the production demo's full completion
  flow without depending on its short pending-state timer.

## 0.0.30

### Added

- Export `VillageObservations` and its cooked presentation types from `/ui` and
  `/graph`, with an interactive local Village demo.
- Add `village` between `home` and `settings` in the canonical local navigation.
  Existing route-only sections, settings flows, open section props and the
  deprecated three-entry graph registry remain supported.
- Keep scope, fetch and view/category controls available while evidence scrolls.
  Show independently dated catalog, history and association results, retained
  errors, and separately controlled contribution-evidence pages.
- Support controlled selection callbacks, explicit category restart and native
  unavailable-action states without implicit fetching or permission decisions.

### Compatibility

- Preserve the published opt-in table controls, natural-height table defaults,
  typed redaction categories and publication recovery behavior.
- Hosts upgrading the expanded local registry must map `village` to a mounted
  body. Hosts retain networking, routing, account scope and authorization.

## 0.0.29 - 2026-10-17

### Fixed

- Restore plain `DataTable` behavior: render all supplied rows without injecting
  search, filters, pagination, or a vertical height cap. Existing importers retain
  their own paging and session-family presentation without new props.
- Pagination is enabled only by explicit `pagination` or `defaultPagination`
  settings. `maxHeight` explicitly enables bounded vertical scrolling; wrapped
  rows expand naturally otherwise.
- Allow npm registry processing time before requiring the published provenance
  result; an accepted upload is not treated as immediately registry-visible.
- Restore shared feedback-overlay styles to the published component CSS; moving
  presentation styles out must not leave consuming applications unstyled.

### Added

- Public `DataTableToolbar` and `DataTablePaginationControls` components, with
  optional `toolbar` and `footer` render callbacks. Importers can opt into search
  and column filters independently and add their own toolbar actions.

## 0.0.28 - 2026-10-17

### Added

- Re-export Schema's canonical frozen redaction category and label bindings,
  same-name types, inventories, parsers, guard, and typed conversions from `/ui`.
- `PublishDialog` accepts `onRecover` for prerequisite reads and sign-in recovery,
  separately from publication retry. Invalid reviews and ambiguous callbacks
  remain blocked, including retained callbacks after state changes.

### Changed

- Keep `prepack` focused on building and validating the package. Run library
  behavior, mutation, and built-rendering tests separately in CI with `test:lib`.
- Pin published Schema 0.29.1 and use its engine-derived category conversion
  instead of a private mapping, preserving exact labels and unsupported-category
  refusal in redaction review and publication.

## 0.0.27 - 2026-10-16

Replacement npm release for 0.0.26: its GitHub Release exists, but npm publication
failed during the mounted Pi transcript check. This version includes all quality
improvements documented under 0.0.26 below: typography and phone layout, publish
consent and state truth, DataTable filtering and host totals, accessibility,
performance, and the consolidated design record.

### Fixed

- Release pull requests now run the full canonical `pnpm prepack` chain in the
  required library CI job, including the mounted Pi transcript check, instead of
  only `build:lib`. Title edits re-run CI so changing a PR to a release title
  selects the release checks; ordinary PR and push builds remain unchanged.
- Mounted Pi usage-label assertions now select the existing production label
  element and retain exact, nonempty owner-label checks. This repairs the stale
  selectors that blocked 0.0.26 npm publication without changing the UI.

## 0.0.26 - 2026-10-15

The in-use demo's quality remediation in one release: the five merged layers of fairtrade#116 (typography and phone layout, publish consent, accessibility and performance, demo truth and the decision register, and the final wave).

### Added

- The single design record (`DESIGN.md` with a generated frontmatter) and the product record (`PRODUCT.md`), with all 28 recorded demo/record conflicts decided and resolved.
- `DataTable` host totals and local filtering: a persistent `showing X of N` (and `showing X of Y loaded` on a partial window, never an invented global total), local search and column filters with removable chips, a sticky header and a frozen identifier column.
- Accessibility semantics for the graph and transcript composites: valid tree/list structure, heading navigation for turns and phases, keyboard-reachable horizontal scrollers, labeled token badges, outcome chips that pair icon with word, and target sizes on the 24px floor.
- The publish dialog's complete state truth: engine-rendered redaction labels (`CREDENTIAL`, `PII`, `PATH`, `INTERNAL`), the auto-publish consent naming its consequence, and an update mode that no longer labels existing readers as suggestions.
- Provider marks leading provider names in the canonical transcript footers on both routes.

### Changed

- Reading text sits on the 16px floor and chrome on mono 14 throughout the transcript, analytics, changes and code map; the 11px `--fs-micro` token is retired.
- Phone layout: 320/390 wrap-not-clamp with overflow probes, a compact app switcher, restored gutters, and a search that never overlaps.
- Every viewport media query now uses the documented breakpoint scale (480/768/1024/1440), with one declared exception (the transcript rails below 1080) and a build gate that enforces the rule.
- Bounded transcript scroll reads (a logarithmic active-turn lookup), transform-based progress fills, and a non-overshooting `--ease-spring`; markdown rendering is externalized and an unused dependency is gone (library JS about 25.8% smaller).
- `llm/NEUROINCLUSIVE.md` is cut to one line per rule so it cannot drift from `DESIGN.md`; the #102/#103/#104 prose port is recorded with content identity.

### Fixed

- The pre-existing 320px reduced-motion side-scroll in the pagination specimen; the overflow sweep is clean (456/456) across widths, themes and motions.
- Reduced transparency now gates every glass surface with an opaque fallback; the dialog close button keeps its square and long titles wrap instead of pushing it out.
- Commit messages keep their case in the transcript checkpoint marker; the offline home marks its data stale with search and filters disabled while the table scroll region stays keyboard reachable.

## 0.0.25 - 2026-10-13

### Added

- `SessionGroupDisclosure` accepts `showActionHint={false}` to omit the visible
  show/hide hint while retaining its chevron, count and accessible disclosure
  control. The option defaults to `true`, preserving existing consumers.

## 0.0.24 - 2026-10-01

- Distinguish full redaction occurrence counts from representative examples in the publish dialog.

### Fixed

- `PublishDialog` allows updates that revoke the final collective, while a first
  publish still requires a collective and a successful scan. A completed update
  with no collective readers states that explicitly; pending-only publications
  name the collective awaiting approval.
- A stopped publish no longer claims that nothing changed on village. Recovery
  offers retry only when the host provides it. Re-scan and access changes are
  held while publication runs, and keyboard focus stays inside the popup through
  publication and its result.
- `LocalOfflineBanner` reserves the busy label's width so retry does not move
  under the pointer or change the banner's height on narrow screens.

## 0.0.23 — 2026-10-01

### Fixed

- **`SettingRow`** settles its writes under React StrictMode. Its unmount
  flag was cleared by the effect cleanup and never set again, so StrictMode's
  development double run left every row at `saving`: it never showed `saved`,
  the failure, or the restored value. Production builds were not affected.
  (#144, #145)

## 0.0.22 — 2026-09-29

### Added

- **`PublishDialog`, `PublishBar`, `PublishStateLabel`, `AccessList`, `CollectivePicker`.**
  The one publish popup, for a first publish and an update: what leaves the
  machine (a read-only redaction review with re-scan), who can read it (the
  collectives, each with a named remove button, plus search and suggestions),
  the `publish this repo automatically on git push` checkbox, and the done state
  with the village link and the pull request hint. Every state the flow reaches
  is covered. A failed scan, or no scan yet, keeps publish off and re-scan on; a
  match the host marks kept is stated as kept and sent, never as redacted.
  `PublishBar` pairs the state label (not published, publishing, published and
  up to date, new turns, auto-publish on, outside your saved lists) with the one
  action for it. All parts are controlled and hold no network code. (#3, #125)
- **`SettingRow`, `SettingGroup`, `RepoPicker`.** Settings that save per field:
  switches, selects and checkboxes apply at once and show saving, saved, or not
  saved with the previous value restored and the error announced; a text value is
  read-only until `edit`. `SettingGroup` is a native `details` with its count.
  `RepoPicker` picks many repositories under owner headings that carry the
  owner's identity and saves only the difference. (#115, #125)
- **`LocalOfflineBanner`.** The page-level notice for a stopped local app: the
  internet is fine, `peasant web start` in the command chip, `try again` with a
  busy state, and the last checked time outside the status region. No wifi
  glyph. (#120, #124)
- **`CopyIconButton`, `StatsStrip`, `OverflowList`.** An icon-only copy button
  that hides without a clipboard, one inline row of stat pairs with tabular
  numbers, and a short inline list that folds the rest behind `+N`. (#122, #124,
  #125)
- **`LOCAL_APP_SECTIONS`.** The home-first local app section registry: `home`
  and `settings` in the nav, then `analytics`, `changes` and `map` by route only,
  each entry `{ id, label, inNav }`. (#119, #124)
- **`PUBLISH_STATES`, `PUBLISH_DIALOG_STATES`, `SETTING_ROW_STATES`.** The
  frozen state sets the publish and settings parts accept. (#3, #115, #125)

### Changed

- **`TranscriptViewer`** gains `showTail` (default `true`), `showOutcome`
  (default `true`), `showSearchTrigger` (default `false`, a `search this
  transcript ⌘F` button at the end of the tab strip) and a `pullRequests` slot
  under the meta row. The meta row names the count `prompts`; the dead `chat with
  trace` item is gone, and the more menu renders only when a capability gives it
  an item, so a host without edit or export capabilities no longer shows an
  empty `...` button. (#118, #124)
- **`GraphAppShell` and `GraphSectionNav`** list only entries whose `inNav` is
  not `false`, and `GraphAppShell` gains a `notice` slot. Their `sections`
  default changes from the three-section list to `LOCAL_APP_SECTIONS`; a host
  that passes its own list sees no change, and any `{ id, label }` list still
  type-checks. `GRAPH_APP_SECTIONS` stays as a deprecated alias with its earlier
  value. (#119, #124)
- **`PromptDigest`** gains `layout="split"`: the sessions beside a reading pane,
  `j`/`k` and the arrow keys to move, controllable selection. Stacked stays the
  default. (#123, #124)
- **`RedactionReview`** gains `readOnly`; **`Dialog`** gains `size="wide"` on the
  new `--dialog-w-wide` token (a full-width sheet below md) and `dismissible`
  (false holds it open: Escape and the scrim do nothing and the close button is
  disabled); **`Menu`** gains an icon-only trigger; **`GroupedMultiSelect`**
  gains `searchable`; **`SignInProviders`** defaults to GitHub only
  (`PROVIDERS` still lists all five). (#3, #115, #122, #124, #125)
- **`CollectivesView`, `CollectiveDetailView`, `CollectiveSettingsView`** ship
  the simpler village pages under their existing names, from
  `@peasant-labs/fairtrade/commons` with typed `data` and `actions`. The list is
  a table (cards are gone): a row's `desc` and `since` show under its name and
  role, the github org column shows only when rows carry `org`, `crumb` still
  renders, the caption reads `collectives N` unless `data.caption` says
  otherwise, and the find-a-collective search shows only with
  `onSearchCollectives`. A collective shows who can read, who can publish and
  your role, a github orgs rail and members; the earlier
  `{ name, description, linkedGithubOrg }` shape still renders. Settings show
  the collective's own `mode`, `access` and `memberLeaves` (on the wire's
  `user_choice`/`mandatory`), or `not set`, and `onCommit` receives the field it
  writes (`mode`, `access`, `memberLeaves`, ...). One pull request toggle, no
  public access. Links render only where `data.hrefFor` names a destination;
  with only a callback they render as buttons. Nothing is demo data. (#122,
  #125)
- **`SettingRow`** labels keep their case, since a label can be a path or a
  login, and a select option can be `disabled`. **`OverflowList`** moves focus
  to the first item `+N` reveals. (#115, #122, #125)
- The subagent elbow in transcript turns uses a text-safe ink. (#124)
- Fairtest's mounted rows (the product routes and the new part stories, each
  in both themes) come from one registry; fairtest stays private and outside the
  npm package. (#124, #125)

## 0.0.21 — 2026-09-24

### Added

- **`SessionGroupDisclosure`.** One collapsed count control for a session list,
  exported from `@peasant-labs/fairtrade/ui`: a leading chevron, the group's
  membership count, and trailing `show`/`hide` over a real `<button>` with
  `aria-expanded` and `aria-controls`. An `indent` step marks a group nested in
  a list, and `bare` drops the outer border inside an already-bordered panel.
  The saved helper-group chip renders through it, so the design system holds
  one implementation instead of two. (#97)
- **Element journeys on Playwright.** The story smoke, the twenty built-app
  checks, and the disclosure interaction run as `pnpm journey:ci` in the
  pinned official Playwright container — the same image village journeys use.
  The puppeteer story smoke, app validator, and map-pointer CI steps retire
  (their scripts stay for local use); the timeline probes read the container
  browser from `CHROME_PATH`. (#99)

## 0.0.20 — 2026-09-14

### Added

- **Session provenance and grouped helper reads.** The canonical transcript
  adapter cooks native parser evidence: per-turn origin, actor, delivery,
  ownership, and evidence, input modalities, submission references, and an
  independently counted input submission total (absent means unknown, a recorded
  zero means measured none). Saved helper threads render as one owner-anchored
  tree under the session that owns them: collapsed by default, one count chip
  between owner and members (`N helper thread(s)`, `, M selected`, show/hide), a
  single measured rail traced through every mounted row, and explicit per-member
  selection that never widens to the owner or siblings. Member paging is
  host-owned and now has a canonical slot after the member rows; an expired
  member scope fails closed with a refresh of the originating list only, and
  unsupported evidence is refused instead of stripped. (#84)
- **`PromptDigest`.** One read-only component family renders the schema
  `PromptDigest` type for the prompts behind a pull request: a header with
  session, prompt, and commit counts, the harness leading with its real brand
  mark, the recorded redaction level and one link out to the whole digest, a
  skills row that keeps recorded names exactly, and per-prompt rows that link out
  instead of re-implementing transcript rendering. (#86)

### Changed

- Pinned `@peasant-labs/schema` to published version `0.20.0`, a strict superset
  of `0.19.0`. The package keeps the canonical wire contract for session
  provenance and grouped reads; no local link or replacement stands in for the
  published package.
- Release pull requests validate native stack merges, and the required
  release-guard scenarios stay protected by fixture-backed tests. (#82, #83)
- The packed-artifact roundtrip and fail-closed refusals now run as part of
  `build:lib`, so release readiness is reproduced against the exact tarball at
  the shipping commit.

## 0.0.19 — 2026-09-07

### Added

- **Pi transcript presentation.** Pi joins the canonical harness policy with
  its official mauve OAuth mark and the upstream MIT license notice. The
  transcript adapter preserves full active history and context, renders each
  thinking block once, and carries generic tool arguments, results, errors,
  pending state, and recorded details through the shared `TurnCard` →
  `ToolCall` → `ToolBody` path.
- **Detailed usage disclosure.** Assistant, tool, and summary usage stays
  attributed to separate recorded owners. Token fields and recorded harness
  cost estimates are aggregated independently, retain exact decimal strings,
  distinguish a recorded zero from missing evidence, and label partial sums
  without presenting estimates as verified billing.

### Changed

- Pinned `@peasant-labs/schema` to published version `0.18.0`. The adapter now
  preserves a tool namespace separately from its name, including a recorded
  empty namespace, and renders both identity fields without concatenating
  them. The updated contract also accepts metadata strings up to its 64 KiB
  per-string limit. Native metadata remains non-conversational transcript
  detail rather than a generated message or model observation.
- The package and release workflows now require Node.js 26 or newer. Release
  tags also produce GitHub Releases from exact matching changelog sections,
  alongside the existing npm publication flow.
- Transcript documentation now identifies Fairtrade as the canonical owner of
  the viewer, adapter, and graph engine and removes stale transcript-browser
  provenance wording.

## 0.0.18 — 2026-08-28

### Added

- **The trajectory-graph engine ships from the `/graph` entry.** `TrajectoryGraph`,
  `GraphControls`, `TrajectoryGraphLegend`, `turnsToFlow`, `useCanvasSync`, and
  the three node wrappers now live in this package next to the node visuals
  they wrap, so an app renders a transcript as a node-link graph from one
  package. `@xyflow/react` is an optional peer dependency scoped to `/graph`;
  the packed `ui`, `commons`, and `analytics` bundles are guarded against
  loading it, and the CSS isolation guard now enforces the graph namespace.
  (#54, #61)
- **The remaining transcript helpers ship from `/ui`.** `nextNavTurn`,
  `formatRelative`, `formatDurationMins`, `formatDateLong`, `summarizePrompt`,
  `composeSessionTitle`, `projectLabel`, the `TranscriptOutcomeChip` component,
  and the `TurnLabel` type. The viewer header renders its outcome chip through
  `TranscriptOutcomeChip`, which gives partial and failed outcomes their own
  tone instead of always showing the ok chip. (#55, #60)

## 0.0.17 — 2026-08-28

### Fixed

- **Every transcript filter control now changes the trace, and filters act on
  parts inside a turn.** Eleven of the rail's fourteen controls (thinking,
  tool calls, the seven tool groups, retries, re-edit) rendered and counted
  but changed nothing. The rules now live in one module (`filters.js`), and
  the unit is the part: unchecking `tool calls` removes the tool cards from
  inside each turn and keeps the text, a group off removes only that group's
  calls, `thinking` off removes the thinking block, and a turn leaves the
  trace only when none of its parts survive. The tool-calls umbrella cascades
  to its groups and shows a tri-state when only some are on. Badges count the
  turns that contain each part kind, so the `responses` badge no longer counts
  every assistant turn. (#51, #53)

## 0.0.16 — 2026-08-24

### Changed

- **The condensed transcript header keeps its breadcrumb + actions row.**
  User-ratified refinement of 0.0.15's condense-on-scroll: only the session
  title and the meta chips leave once the full trace is scrolled; the
  breadcrumb trail and the session actions stay as one slim pinned row (a
  single truncating line on narrow viewports), so orientation and
  share/details remain reachable while reading. Scrolling back to the top
  still restores the full header, and consumers still need no code change.

## 0.0.15 — 2026-08-22

### Changed

- **The transcript session header leaves on scroll.** Once the full trace is
  scrolled past the sticky threshold, `TranscriptViewer` hides the session
  header (breadcrumb, title, chips, actions) and the condensed scrubber header
  takes its place; the tab strip, the scrubber header, and the turns bar stay
  as the persistent navigation, and scrolling back to the top restores the
  header. The header only hides while the stream keeps enough overflow after
  its height is released, never while focus is inside it, on other tabs, or in
  graph view. Consumers need no code change; the root gains `txn-app-condensed`
  while condensed.

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

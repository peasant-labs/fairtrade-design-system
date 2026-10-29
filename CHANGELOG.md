# Changelog

All notable changes to `@peasant-labs/fairtrade` are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this
package is pre-1.0, so minor/patch semantics are best-effort.

## 0.0.50 - 2026-10-28

### Fixed

- Render Mermaid flowcharts with safe line breaks while retaining unsafe-content checks.
- Highlight transcript search matches and reveal results inside nested scrollable content.
- Start tool disclosure transitions from their initial frame.
- Adapt fixed-width transcript readers to available sidebar space while preserving live resize anchoring.

## 0.0.49 - 2026-10-27

### Added

- A viewport-bounded app frame with in-flow host notices and a transcript header slot.
- Contextual transcript breadcrumbs that retain the transcript title.
- A presentation for unverified pull requests recorded in a transcript.
- Exact source navigation to the recorded tool call and its result, including calls without IDs.

### Changed

- Standalone transcripts default to the ledger presentation; classic remains available explicitly.
- The shared app frame follows the transcript's existing host-sidebar visibility in zen mode.
- The coordinated session header and timeline exchange uses a shorter transition while retaining reduced-motion behavior.
- Transcript demo surfaces use ledger by default; classic remains an explicit example. Mobile rails slide with reduced-motion support, and desktop rails retain painted content while their frame collapses.
- Mermaid diagrams render through structured SVG, and reader-width changes preserve the reading context.

## 0.0.48 - 2026-10-27

### Added

- A system-turn category in the transcript filters. Older saved filter state keeps
  system turns enabled until the reader explicitly hides them.

### Changed

- Model actions are grouped once per user turn, after its first model prose card.
  Lists start expanded with individual outputs closed; compact mode collapses the
  lists. Summaries omit the redundant call count.
- Thinking uses a `Think` action row with its word count, available duration, and
  boxed output. Bash input keeps its input label and prompt without a second icon.
- Action lists, tool outputs, thinking, session-header details, and transcript
  sidebars share reversible ease-in/out motion with an immediate reduced-motion
  path. Closing content stays painted until its exit finishes and becomes inert
  immediately.
- The reader-width handle rests where released without snapping and reaches the
  middle column's available width. User-turn rail cards run to the rail edges,
  and the rail follows the turn being read without moving the main scroller.

### Fixed

- Host panels and commit markers align with the reading column rather than the
  far edge of the transcript stream. The width handle hugs the reader's edge and
  drags in both directions.
- Clicking prose selects its amber marker; hover fades match the reading
  reference. Rapid turn navigation no longer gets stuck at either scroll limit.
- The title and pinned timeline exchange their occupied space together, avoiding
  the extra downward jump before the header collapses.
- Disclosure and sidebar contents no longer flash at the animation-to-hidden
  handoff. Sidebar exit painting does not depend on CSS display transitions.
- The mounted transcript demo follows the page's initial theme and theme changes
  without resetting the reader's open output or scroll position.

## 0.0.47 - 2026-10-27

### Changed

- A ledger turn's work is its own row after the turn card. The prose ends the
  turn, and the tool and thinking lines follow as a separate block, so the
  summary is never read as the turn's footer. The summary line is the click
  target that opens the rows, and collapsing it closes any tool left open
  inside, so the block always reopens.
- Tool rows and the thinking line are inline detail, one line each with the
  kind icon: no disclosure chevron on the row, no rule between the prose and
  the work, and the thinking text lines up with a tool output's first line.
- Only a turn with words gets a card. A turn that is only thinking or tool work
  renders inline with no role well, no number and no time, keeping its heading
  for assistive tech. A subagent turn is a ledger turn too, not the classic
  subtask box.
- The ledger's pinned bar is the timeline alone; the session title stays in the
  breadcrumb and the page header. The reader centres in the space it has, with
  the reserved control lane mirrored on both sides, and the turn rule and phase
  heading stay inside the reading column.
- The timeline's tick kind follows the role: a user turn fills the bar, an
  agent turn is the amber band, and a system notice is the short neutral mark.
  A tool call no longer demotes an agent turn, so a run of agent turns reads
  amber again.
- The checkpoint marker is the chip alone, with no whiskers running out to
  either side.
- The in-use demo's switcher names the apps `transcript`, `village` and
  `peasant`.

### Fixed

- The publish bar's action reads `publish` in every state. The popup still
  opens in update mode for a published transcript, so the distinction lives in
  the dialog, not the button.
- The work summary counts a file only for a read; an edit already counts as an
  edit, so one edit no longer reads "1 file, 1 edit".
- Classic keeps a turn's thinking disclosure when the turn also has tool calls.

## 0.0.46 - 2026-10-26

### Added

- `TranscriptViewer` gains an opt-in `presentation="ledger"` reading surface. A
  turn becomes a role-led line: a square role well, the role word, the turn
  number, the time and the copy anchor, with prose first and one grouped work
  panel over the turn's tool calls. A system turn collapses to one compact row
  whose preview reads plain text, with its own disclosure, copy anchor and host
  actions. Classic stays the default and renders as before.
- The ledger reading layer: a `sidebarLayout` view model (`outline`, `filters`,
  `host`) with `onSidebarLayoutChange`, a reader-width handle with 600, 840 and
  936 snaps and keyboard support, and a zen mode that snapshots the exact rail
  configuration and restores it. Width never changes the sidebar layout, and the
  prose follows the reader width under one recorded `DESIGN.md` exception.
- `footer` takes `{ hints, progress }`, both off by default, so a host opts in
  per part to the shortcut line and the visible-turn counter. A `skip to session
  views` control opens the viewer, because the session views now sit at the end.

### Changed

- The session views and the search trigger move into one bottom bar under the
  body, replacing the strip above it. The bar keeps its tablist semantics,
  arrow-key navigation, counts and the tab panel's `aria-controls`.
- The default breadcrumb's last crumb is the transcript title, on one line, cut
  with an ellipsis when the row is full; a host-supplied trail still wins.
- The zen control is a stable `zen` toggle with a switch, never an icon that
  reads "exit zen". The width handle reads as a slim grip outside the text
  measure, and both leave surfaces that cannot use them: zen below the two-rail
  width, the handle below the phone breakpoint.
- A phone drops the turns bar in the reading view (graph mode keeps it), hides
  the breadcrumb that would repeat the title, clamps the title to two lines, and
  keeps the chips on one scrollable line.

### Fixed

- The ledger timeline draws the 6/4/2 shape ladder for user, agent and tool
  time, so the segments differ by shape as well as hue.
- The ledger phase heading takes the reader column instead of the whole stream.
- A width drag interrupted by a lost capture or a pointer leave no longer
  resizes on the next move.
- A controlled reader width normalises once at the render boundary and drives
  `aria-valuenow` with the same value.
- The host's pull-request list and the usage disclosure stay on a phone; the
  shortcut hint is the only footer part that leaves a touch surface.

## 0.0.45 - 2026-10-24

### Fixed

- `TranscriptViewer`'s trail follows one rule at every width, on one line on
  a phone too. Every crumb reads whole while it fits. When the row is full the
  last crumb, the current page, gives way first, down to an eight-character
  floor; then the middle crumbs, the longest taking most of the cut; the
  trail's root last. Every cut ends in an ellipsis, and no crumb goes below its
  floor or is cut while the row has room. In 0.0.44 a crumb longer than the
  whole row (a long repository name) stayed at its full width, clipped with no
  ellipsis, and the current crumb collapsed to nothing; and since 0.0.40 a
  phone capped the first and last crumbs at a share of the row, so a pull
  request trail was cut with room to spare.

## 0.0.44 - 2026-10-24

### Fixed

- `TranscriptViewer`'s trail reads whole on a wide screen. Since 0.0.40 its
  first and last crumbs were capped at a share of the trail's own content
  width, so at 1440 a host's trail cut "collectives" and "AI Research
  Collective" short with most of the row free. From 768px every crumb now
  reads whole while it fits, and only the last, the current page's title,
  shortens when the row is full. On a phone the trail still keeps to one line
  with its middle crumbs shortened.

## 0.0.43 - 2026-10-24

### Added

- `Explore` and `TranscriptViewer` take `headingLevel: 1 | 2` (2 by default,
  a section of a host page). With 1 the composite's title is the page's h1 and
  every heading under it moves up one level: the viewer's phases to h2 and its
  turns to h3, Explore's cards, sections and empty states to h2. A host that
  mounts either as its whole page gets one h1 with no skipped level and no
  visually hidden heading. Same classes and look. An invalid level throws.
- `AppSidebar`'s `account` takes `avatarUrl`: the person's picture in the
  avatar square (cropped, square corners, empty alt since the handle sits
  beside it). The initial shows when it is missing or fails to load.

### Fixed

- The published `AppSidebarAccount` type now carries `href`, `items` and
  `avatarUrl`. A word in the handle's description began with an at sign and
  ended the typedef, so the type held only `handle`.
- Code map navigator:
  - A folder whose children the grain shows starts open (`aria-expanded`
    true, "hide children", chevron down), and its disclosure really hides and
    shows its children. Before, it read collapsed over visible children and
    pressing it only flipped the chevron. A folder past the grain's depth gets
    a working disclosure and ArrowRight, where only a double-click opened it.
  - Every chevron changes what shows; none is disabled. While filtering, the
    filter alone decides which rows show, so no row draws a chevron.
  - The chevron centres on the folder name's line, so at 390 it no longer
    sits between the name and its "% recorded" line.
  - Rows are 37px tall on a fine pointer (was 44px) and keep a 44px reach on
    a touch screen.
- In Explore's transcript view, the owner's name in the "owner snapshot"
  aside is a heading one level under the transcript's title (h3 by default),
  not at the title's own level.

### Compatibility

- New props only. A host that widened `AppSidebarAccount` itself can drop
  that. A host reading the navigator's root disclosures as collapsed on load
  now sees them open.

## 0.0.42 - 2026-10-24

### Added

- `CodeMapComposition` and `CodeMapNavigator` take `lineCounts: 'measured' |
  'unknown'` ('measured' by default). With 'unknown' (the host could not read
  the project's languages, so every line count is an unmeasured 0) no
  navigator row states a line count, instead of "0 lines" on every row. A
  measured 0 still reads "0 lines".
- `AppSidebar`'s `account` takes `items` (menu items). The account row becomes
  its own menu: the same flat row, avatar and @handle with no caret, so the
  handle keeps the default row's width ("@alicedev" is no longer cut at 1440),
  and the menu opens above the footer. A host that put a `Menu` in
  `accountSlot` for this can pass `items` instead.
- `Menu` takes `side="top"` to open above its trigger, and `triggerClassName`
  for a host-drawn trigger without the caret.

### Compatibility

- New props only; nothing changes for a host that leaves them out.

## 0.0.41 - 2026-10-24

### Added

- `@peasant-labs/fairtrade/share`: the transcript share card, for link previews and for showing one in a page.
  - `shareCardFromPayload(payload)` returns the card's data from a transcript payload, or `null` if the payload does
    not parse. The data holds the title, the harness chip (`Claude Code (Opus 5.5)`) and the first prompt.
    - Prompts and tokens show both or neither, by the transcript page's own rules, so the card never states a
      figure the page does not.
    - A first prompt that is a slash command shows its arguments, not its tags.
  - `shareCardDescription(card)` and `shareCardAlt(card)` give the link text and the image's alt text.
  - `ShareCard({ card, height })` draws the card at 1200 × 600 (X) or 1200 × 630 (other sites).
    - It uses inline styles only, so it renders in Next's `ImageResponse` and in the DOM.
    - `card: null` draws the generic card, a lock chip reading "limited visibility", with no transcript data.
    - Wide numbers shrink to fit their tile.
  - `SHARE_CARD_FONTS`, with static Atkinson Hyperlegible and Atkinson Hyperlegible Mono TTFs at
    `@peasant-labs/fairtrade/share/fonts/*`, because `ImageResponse` cannot read woff2 (OFL; see
    `THIRD_PARTY_NOTICES.md`).
  - The `ShareCardData` type.
  - The entry imports no React hooks and no `react-dom`, so a Next server route can use it.

### Changed

- Brand-mark and wheat-logo geometry live in one plain module that `BrandMark`, the logo symbol and the share card
  all draw from. `BrandMark`'s output is unchanged.
- The transcript title rule is one helper (`transcriptTitle`) shared by `TranscriptViewer` and the share card, with
  no change in behaviour.

## 0.0.40 - 2026-10-23

### Changed

- `PublishDialog`:
  - The stopped box says only where it stopped. "review who can read it." no
    longer repeats in the box and the footer, and the footer has no note
    while stopped.
  - Each line's words wrap while its one action stays on the first line, on
    the words' baseline, so "show N examples" stays beside the match count
    at 390. Each icon centres on its line's first line of words.
  - Re-scan and show-examples set their words on the section's right edge.
  - A long session title stops at two lines with an ellipsis. The whole
    title is the tooltip and stays in the dialog's accessible name.
- `PublishStateLabel` (and `PublishBar`): "published to 2 collectives",
  "needs update" when new turns wait, and no "up to date", the default.
  "published, public" and "published, private" come only from the new
  `visibility` prop; without it, a transcript no collective reads is just
  "published".
- `Switch`: on is the inverted neutral (an `--ink-strong` track and a
  `--canvas` thumb), never the amber fill, and the on word is ink.
- `SettingRow`:
  - Its switch shows no on/off word; the row's status mark and the track
    say the state.
  - Below 768px a text value and its edit button sit under the label, at
    its left edge.
  - A host's own action row (words and a button) puts the button on its own
    line under the words, at the right padding.
- `DiffView` in redaction mode shows only the engine's category label
  (CREDENTIAL, PII, PATH, INTERNAL). A match whose category the engine does
  not know blocks the view with one alert and no original line, the way
  `RedactionReview` does.
- The demo and the stories name the hosted product "peasant online" in
  user-facing copy, for example "delete your peasant online account. this
  cannot be undone."
- Every number on screen goes through one formatter. Costs read "$0.30", or
  "<$0.01" under a cent, never "0.30000000000000004" or "1e-7". Large counts
  read "66.7B", and a missing or unreadable number reads "—". The usage
  panels, the meta row, turn and graph token labels, ChangeDetail, StatsStrip,
  the collectives table, the select tallies and the redaction confidence all
  use it. Analytics millions read one decimal ("1.2M").
- A usage figure the host did not report reads "—" once, not "unknown
  (unknown)".
- `CommandBlock` wrap: words are inline, so a wrapped address no longer
  pushes the next word down. A line breaks at spaces and after "//" and path
  slashes, a hyphenated piece never splits, and "| bash" stays together.
  Copy still gives the exact command.
- `TranscriptViewer` on a phone: the search trigger is one 44px icon beside
  the tabs, with no "⌘F" on a touch screen. The trail stays on one line at
  every width, its middle crumbs shortened with an ellipsis.
- `ProjectOverview` on a phone: the section chips are one scrolling row with
  the tabs' edge fade, starting on the page inset.

### Added

- `PublishDialog`:
  - `stoppedDetail`: the host's actionable detail behind a "details"
    disclosure in the stopped box.
  - `accessFailure: { line, detail?, onRetry?, busy? }`: a collectives read
    failure shown inside "who can read it" in place of the list and the
    picker, with its own retry (named "retry loading your collectives") and
    details. Publishing stays off.
  - `scan.note: { line, detail? }`: a quiet line under a finished scan's
    count, with its detail behind a "details" disclosure. It is not an alert,
    and publishing stays on.
- `PublishStateLabel` and `PublishBar` take `visibility: 'public' | 'private'`.
- `Switch` takes `stateMarker={false}` for hosts that state the setting
  themselves.
- `formatCount`, `formatInteger`, `formatCost`, `formatDecimal` and
  `MISSING_NUMBER` are exported from `/ui`.

### Compatibility

- New props only. `DiffView`'s redaction `matches[].category` must be an
  engine category (`RedactionCategory`): a rule name such as `api-key` now
  blocks the view instead of showing as a label.
- A host test that read "published, 2 collectives, up to date" or "published,
  2 collectives, 6 new turns" needs the new copy.
- A host that stacked SettingRow text values or action buttons on a phone,
  or styled the switch's on state, can drop those rules.
- Hosts that format costs or counts themselves can switch to the shared
  formatter. The website can drop its CommandBlock override (d3bd100) and
  DocCommand's own token grouping.

## 0.0.39 - 2026-10-23

### Changed

- On a coarse pointer every control reaches 44px. `--control-h` and
  `--control-h-sm` rise to `--target-comfortable`, so tabs, segments, page
  buttons, inputs and small buttons grow for a finger; a fine pointer keeps
  36px and 28px. The new `--chip-h` keeps chips, tags, badges and the switch
  track at their small size. A switch, a chip button, a crumb link and a table
  sort header take an invisible 44px hit box instead.
- `TranscriptViewer` on a phone:
  - Tabs and segments stay on one line, and the tab strip fades at its end.
  - Keyboard hints are hidden on a touch screen.
  - The meta row wraps with each item whole, and "+11 −4" sits with the
    files count.
  - Diff lines wrap instead of being clipped.
  - A closed definition bubble no longer widens a column sideways.
- `TranscriptViewer` everywhere:
  - Thinking reads "30 words".
  - A model change reads "claude-fable-5 → claude-opus-4-8".
  - Diff +/− counts come from the diff's own lines, so "+0 −0" no longer
    shows on a real change. A task's churn in the trace outline ("1 file,
    +A −D") counts from the same lines.
  - The filters rail is gone on tabs that have no filters.
  - A Cursor prompt shows without its `<user_query>` wrapper or the context
    tags before it. Display only: a Cursor user turn gets `displayContent` (and
    its task `displayPrompt`), which the turn and the trace outline render;
    `content` stays as recorded, and other harnesses are untouched.
- The last breadcrumb is a link when it has an `href`. One without an `href`
  carries `aria-current="page"`.
- `RedactionReview` and `DiffView` keep the badge comma against the category
  label ("CREDENTIAL, confidence 0.98").
- `VillageObservations` has no explainer sentences, and its empty states read
  "no collectives saved yet", "nothing saved on this page" and "no
  contribution history saved yet".
- `ProjectOverview`'s typical vs. tail reads "2m, 5m", with the p90 in AA ink.
- `.iu-page` takes the `.asb-page` inset: 32px top and sides and 48px bottom
  from 768px, 16px sides below, and `.iu-page-title` the hero size from 768px.
  A `.iu-view` that holds a page, or the analytics overview, adds no inset of
  its own, and the overview keeps its 16px sides on a phone.
- `AppSidebar` never stays scrolled sideways, so a focus can no longer cut the
  labels at the left edge.

### Added

- `cleanSessionTitle(text)` shows a stored session title as written: it drops
  Cursor's `<user_query>` wrapper (and an unclosed one) and collapses
  whitespace, and keeps every word, its case, its dots and a trailing "…".
  `summarizePrompt` applies the same rule first. `unwrapUserQuery(text)` is
  the rule on its own.

### Compatibility

- No props removed. A host that set its own 44px touch sizes, `.iu-page`
  padding or a 40px page title can drop those overrides. A host test that read
  the old explainer sentences or the "median / p90" separator needs the new
  copy.

## 0.0.38 - 2026-10-23

### Changed

- `AppSidebar` enforces one order in every app:
  1. the brand row;
  2. the shortcuts under it: search, the docs and community, then the app's
     links that leave it;
  3. the app's own pages;
  4. the footer row: the account on the left, then a settings gear and the
     theme toggle on the right.

  The component moves a host's items into place itself. An `external` item in
  `groups` (or one passed in the new `elsewhere` prop) moves up to the
  shortcuts. A `settings` item in `groups` (or the new `settingsHref`) becomes
  the footer gear, current on the settings page; settings is never a page. A
  visible label carries no tooltip (a host `title` is ignored). Tooltips belong
  to the collapsed rail, which shows each label, and to icon-only buttons.
- `TranscriptViewer`:
  - Durations read short ("4m 30s", "1h 12m", "12s") from one formatter.
  - A missing, zero, epoch or Go zero-time timestamp shows nothing; the
    adapter fails closed on it, so "739912d ago" cannot appear.
  - A zero or unknown per-turn duration is hidden, so no "0s" shows.
  - Claude Code's session records ("custom-title", "agent name", "session
    title") are not listed or counted as turns.
  - A relative time becomes a date after seven days.
  - `isSessionMetadataTurn` is exported.
- `ProjectOverview`:
  - The last x-axis tick is no longer clipped.
  - KPI labels hold two lines, so every value sits at one height.
  - Typical vs. tail reads "median / p90" with an AA separator.
  - A shown section chip is a neutral on-state, not amber.
  - The contributors count says "1 person".
  - The page takes the 32px app inset.
- On a coarse pointer, small buttons are 44px tall, and switches and crumb links
  take a 44px reach.

### Added

- `Changes` and `ChangeDetail` take `headerActions`, the host's own controls in
  the head row (a docs link beside "open the map").

### Compatibility

- New props only (`elsewhere`, `settingsHref`, `headerActions`); nothing
  removed. A host that listed settings or an outside link among its pages sees
  them move on re-pin, with no change of its own. A host can drop its own
  `title` descriptions.

## 0.0.37 - 2026-10-23

### Added

- `--card-pad`, the one inner padding of card-like boxes: 24px, 16px below
  768px. Setting rows and group summaries take it on the left and the right,
  and cards, dialog parts and empty states take it all round. A row's label
  starts at the left padding and its control group ends at the right padding;
  setting rows keep a 48px minimum height. Stacked on a phone, the control
  group takes its own line and ends at the right padding. A switch's on/off
  word takes a fixed width, so tracks line up from row to row.
- `scripts/journey/card-insets.journey.mjs`: a computed-geometry gate over the
  demo's local, account and collective settings at 1440 and 390 in both
  themes. Every card row's content must start and end the same distance from
  its edges, at least the padding floor, with nothing crossing its content box.
  The label, help and a stacked value share one left edge, and a divider spans
  the card's inner width. Seven named CSS mutations prove that it fails for the
  reason it names. On the 0.0.36 CSS it fails (16px and 12px insets).
- `AppSidebar` switcher entries take `soon: true`: the entry shows as text,
  marked `aria-disabled`, with a quiet "soon" note in the trailing slot and no
  hover or press. Every switcher now ends with community as soon by itself; an
  app that passes its own `community` entry gets that entry instead.
- `CommandBlock` takes `wrap` (break only at spaces: each token stays whole, so a
  flag or a date never splits after a hyphen; only a token wider than the line,
  like a URL, breaks inside it) and `compact` (an icon-only copy button whose
  name stays "copy <command>"). Copy always uses the raw command.

- `AppSidebar`'s footer is one compact row pinned under the nav: the account on
  the left (avatar and handle at the nav icons' inset, or the host's signed-out
  slot) and an icon-only square theme toggle on the right. Its tip sits above it,
  never over the account. In the collapsed rail the account sits on top of the
  theme toggle; the phone drawer keeps the row. The footer is outside the nav's
  scroller, so it stays put.
- `SettingRow` is one grid: the label and its help line share the left column's
  left edge, and the value or control ends at the right padding. A long text
  value (over 40 characters, or `stack`) stacks under its label at the same left
  edge. An idle save status takes no room, so the control sits at the right
  padding and never moves when a status appears. On a phone the row stays on one
  line where it fits; a select drops to its own line at the right padding.
- The in-use demo's local settings drop their "not in peasant config" chips.
- `AppSidebar`'s switcher never lists online or local, in any app.
  `APP_SIDEBAR_APPS` is now docs only; community as soon follows on its own,
  and the app the reader is in is never listed.
- `PublishDialog` takes `checking` (`{ stage, note?, progress? }`). While
  checking, it shows the step being done in place of "checking for sensitive
  content", a determinate count ("120 of 468") and a quiet note on why publish
  waits, all inside the status region.
- `PublishDialog`: the scan-failure box spans the section's full width with the
  card padding. An optional `scan.failureAction` (`{ label, onSelect, busy? }`)
  renders a button in the box, and an optional `scan.failureDetail` (the
  actionable detail) shows as pre-wrapped mono text behind a "details"
  disclosure. The unchecked auto-publish line
  shows only the host's `hint`; with none, nothing ("off, change it in
  settings" is gone). The checked consent sentence is unchanged.
- `CollectiveSettingsView` drops the free sentence under the pull requests row
  ("automatic linking is now a personal setting").

### Changed

- `CommandBlock`'s command is set at the 16px code size. When it scrolls
  sideways, the scroll region is focusable (`tabindex="0"`, `role="region"`,
  named "command: <label or command>") with the inset focus ring. The block can
  shrink inside a grid or flex column, so a long command no longer pushes the
  copy button out of view.
- `Explore`'s search placeholder is "search transcripts", so it fits a phone;
  its accessible name still lists everything it searches.
- `SettingRow` on a phone keeps the save status before the control, as on
  desktop, so the control ends on the row's padding.

### Compatibility

- One new token and new props only; nothing removed. `.srow` is now a grid; a
  host row built from `.srow` puts its first child on the left and the rest on
  the right. A host theme button beside its account slot goes: the footer owns
  the toggle. A consumer that passed
  `{ id: 'community', label: 'community', tag: 'soon' }` can drop it, since the
  component adds community itself.
- Card-like boxes grow from 16px to 24px of padding on desktop.

## 0.0.36 - 2026-10-23

### Added

- `AppSidebar` keeps one order in every app: the brand row (the mark and the
  collapse control), the app's nav groups, search, the switcher to the other
  apps, then the footer with the theme toggle and the account. Two new parts
  fill it:
  - `search` (`{ onOpen, label?, shortcut?, keyShortcuts? }`): one item after
    the nav groups with a quiet mono key hint (`aria-keyshortcuts` from
    `keyShortcuts`). Choosing it closes the phone drawer and calls `onOpen`.
  - `theme` with `onThemeChange`: the footer leads with one toggle that names
    the theme it switches to ("switch to dark mode", label "dark mode", the moon
    icon), then the account. Without `onThemeChange` there is no toggle.
  The collapsed rail shows both as icons with titles; the phone drawer keeps the
  order.
- A switcher entry can carry a `tag`, a short note after its label. A tagged
  entry with no `href` (`{ id: 'community', label: 'community', tag: 'soon' }`)
  shows as text with its note instead of being left out, so a place that does
  not exist yet can sit next to docs.

### Changed

- App heads lead with the title alone. Explainer sentences are gone from the
  shipped views: the collective settings head ("changes save right away."), the
  "find a collective" and github rail notes, the explore head, the collective
  detail fallback deck, the code map navigator head (its kicker and note), the
  analytics card subtitles that described the chart (unit and count subtitles
  stay), and VillageObservations' offline note (its permission warnings stay).
  `CollectivesView` no longer has a default `deck`; a host that passes one still
  sees it. The in-use demo screens drop theirs. DESIGN.md records the rule.
- `PublishBar`'s more trigger matches the action beside it: the control height,
  44px on a coarse pointer.
- The transcript header's search trigger takes the header control height, and
  its shortcut is quiet mono text instead of a boxed key in a small button.
- The transcript meta row uses one figure style (icon, tabular number in the
  ink, word in ink-3). Duration is a plain figure, the author and token figures
  keep their definitions without a dotted underline, and an unmeasured prompt
  count is left out instead of reading "unknown prompts".

### Compatibility

- New `AppSidebar` props only (`search`, `theme`, `onThemeChange`); none
  removed. A consumer that rendered search or a theme item in its own group
  moves them into these props; one that rendered a theme button beside its
  account slot drops it.
- `.asb-me` no longer carries the footer's top rule and auto margin; the new
  `.asb-foot` wraps the theme toggle and the account.
- `.gmp-navigator-kicker` and `.gmp-navigator-note` are gone.

## 0.0.35 - 2026-10-23

### Added

- `SettingsNav` and `SettingsLayout`: the settings section bar. It lists one
  settings page's sections inside the page body, so a settings page never takes
  over the app sidebar. Beside the sections when the body is at least 44rem
  wide (a sticky column, the current section on the `--surface-2` fill with the
  amber inset bar), above them when narrower (one row that scrolls sideways,
  the current section underlined in amber, kept in view). A section is a route
  link, an in-page anchor or a button, with `aria-current` `page`, `location` or
  `true`; `spy` marks the section being read on one long page of anchors;
  `LinkComponent` takes a router link. The shipped `CollectiveSettingsView` and
  the in-use demo's account and local settings use it.
- `AppPage`: the frame for one app page inside `AppSidebarLayout`. It takes the
  full width of the main column with the same padding on the left and the
  right (32px, 16px below 768px), so a page is never a capped, centred column
  with an uneven gap beside the sidebar.

### Changed

- `AppSidebar` shows the wheat mark alone, in the column and in the phone top
  bar; `brand` stays the accessible name and the tooltip. The full logo with
  the wordmark belongs to the landing page only. Brand text is `peasant`.
- `AppSidebar`'s collapse control is a small square handle seated on the
  column's right edge, level with the mark. Its chevron turns to point the way
  the column will go (only after a user toggle, only when motion is allowed).
  It keeps its names (`collapse the sidebar` / `expand the sidebar`),
  `aria-expanded`, `aria-controls` and its place right after the brand in the
  tab order, and takes a 44px target on a coarse pointer.
- `AppSidebar`'s switcher lists only the other apps: the app the reader is in
  is left out (it is not a destination and no longer reads as the current
  page). Each entry opens in a new tab (`target="_blank"`,
  `rel="noopener noreferrer"`, spoken ", opens in a new tab") unless it names
  its own `target`.
- Floating surfaces sit on the flat ground: `--surface-elev` now equals
  `--surface` in both themes (`#0b0b0a` dark, `#fbfaf7` light), so a menu, a
  popover, a tooltip, a toast, the date range panel and a select's option list
  are told apart by their strong edge and the dark theme's overlay lift, not by
  a grey or beige slab. The few selected states that used `--surface-elev` as a
  fill use `--surface-2`.
- The page declares `color-scheme` per theme, so a native select's option list,
  scrollbars and pickers follow the theme; `.select` options take the overlay
  fill and inks. A `.select-wrap` that brings no chevron icon draws one.
- `.iu-page` takes the full width of its column (no 1184px cap).
- `SettingRow`'s status slot sits before its control on a wide row, so the
  control ends on the row's padding; stacked below 768px, the status follows
  the control as before.

### Compatibility

- New exports: `SettingsNav`, `SettingsLayout`, `AppPage` (with
  `SettingsNavSection`, `SettingsNavProps`, `SettingsLayoutProps` and
  `AppPageProps` types). No prop was removed.
- A consumer that rendered a settings page's sections as `AppSidebar` groups
  moves them into `SettingsLayout` in the page body and keeps the sidebar's
  normal groups there.
- A consumer that passed its own app with an `href` in `apps` no longer sees it
  in the switcher; one that set `target`/`rel` on an entry keeps them.
- A consumer page that capped and centred itself beside the sidebar adopts
  `AppPage` (or drops its own max-width) to get equal padding.
- `.asb-wordmark` is gone; the brand's name is in a visually hidden span.

## 0.0.34 - 2026-10-23

### Changed

- `LOCAL_APP_SECTIONS`: the online entry (id `village`, label `online`) is now
  `inNav: false`. The local app's section nav lists home and settings; the
  online page keeps its id, label and route and is reached by route only, like
  analytics, changes and code map. The local app linked to the hosted app twice
  (this nav entry and its app switcher), so the duplicate leaves the nav.
- The in-use demo derives this from the registry: its nav lists home and
  settings, and `?section=village` opens the online page with a back to home.

### Compatibility

- No export, prop or token change. A consumer that derives its nav from the
  registry drops the online entry on re-pin and keeps its `/village` route.

## 0.0.33 - 2026-10-23

### Changed

- `AppSidebar` moves, only when motion is allowed and only on transform and
  opacity, and every transition can be interrupted. The phone drawer slides in
  from its edge and out faster, the scrim fades, and the drawer's items stagger
  in. The menu glyph turns into a cross and the menu button becomes the
  drawer's one close control. One indicator slides between current items
  instead of jumping. Expanding the rail fades its labels in from a 4px offset
  while the width snaps. Nav items press to 0.98. The resize edge shows a
  faint line under a hovering pointer and firms up when pressed.
- Reduced motion makes every one of these changes instant.

### Fixed

- Every part of `AppSidebar` now sits inside a landmark, so axe's `region` rule
  passes on a page that mounts it. The resize separator moves inside the aside,
  whose content scrolls in an inner `.asb-scroll` column, and the narrow top bar
  is a `nav` named after the sidebar's label (default "peasant menu").

### Compatibility

- No API or prop change. The separate close button inside the drawer is gone;
  the menu button (named "close the menu" while the drawer is open) closes it.
- The aside's content scrolls in `.asb-scroll`, and the aside itself no longer
  scrolls or carries the padding.

### Tests

- A Playwright journey checks, in both themes and both motion preferences,
  that the indicator rests on the current item on desktop and inside the phone
  drawer, that the drawer opens to the edge and closes out of view, and that
  reduced motion moves nothing perceptibly. It also runs axe over the page and
  fails on any finding inside the sidebar.
- The mounted sidebar gate covers the close control, the stagger order and when
  the indicator may slide, with three new production mutations.

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

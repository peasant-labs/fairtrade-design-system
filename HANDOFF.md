# HANDOFF — next phase

This captures the work to do in a **fresh context** (run `/clear` first — see "ready to clear" at the
bottom). Everything already on `main` is listed under "shipped"; everything below the line is the
backlog, written so a new session can pick it up against the repo alone.

## shipped (this session, on `main`)
- `d2c7be0` feedback round 1 + 27 in-use components + both peasant TUI flows (analytics + kickstart wizard)
- `e817a87` all 27 components showcased on the presentation page (6 thematic doc bands)
- `088e753` three assembled "rebuilt apps" showcases (the commons, the code map, the transcript viewer)
- gates green at each step: `pnpm build` (contrast, both themes), `validate.mjs` 20/20, `sbsmoke` 347 stories 0 errors.

Component kit (all `src/ui/<Name>.jsx` + colocated `.css` + `.stories.jsx`, tokens-only, see
[[tier3-component-convention]] / `llm/GAPS.md`): MapCanvas, Intensity/MapNode, Treemap, CommitGraph,
TimeStrip, StatTiles, DiffView, ToolRenderers, TranscriptMarkers, StepsWaterfall, EvidenceCaption,
ProviderIcon, StepWizard, RailShell, GroupedMultiSelect, Tour, Explainer, ConnectionState, CliOnboard,
SignIn, FacetRail, ConsentDialog, PolicySelect, ModerationQueue, RoleRoster, VisibilityControl, Redaction.

---

# BACKLOG (do these in the next context)

## A. feedback.md round 2 — six concrete fixes
The reviewer's six in-page comments (`feedback.md` at repo root has the exact CSS targets + text):

1. **states · skeleton has a "weird border"** — target `span.fb-skel-block.fb-skel-av`. The skeleton
   avatar block carries an unwanted border. Fix in `src/index.css` (`.fb-skel-av` / `.fb-skel-block`):
   remove/justify the border so the skeleton reads as a plain shimmer block.
2. **cards & rows · "weird line cutting through the image on bigger screens"** — target
   `canvas.thumb-ascii` (the `AsciiImage` card thumbnail). At large widths a seam/line crosses the ascii
   render. Investigate `src/effects.jsx` `AsciiImage` (the seam band / column-join artifact) and the
   `.card-thumb` sizing; likely a canvas-scaling or row-join seam.
3. **canvas & dialog · the `.axes` consent summary is "very unaligned, do better"** — target
   `ul.axes` in the `50-canvas.jsx` static dialog (and the live one in `App.jsx`). In the narrow dialog
   the `grid-template-columns: var(--ic-md) max-content 1fr` collapses (keys/values run together:
   "group membershippublic visibility…"). Fix `.axes` in `src/index.css`: give the key a fixed,
   aligned column (e.g. a `ch` width or a definition-list), make the value wrap cleanly under/next to
   it, and reconsider the `@media (max-width: 420px)` fallback — the dialog is narrow enough to hit it.
4. **transcript in-use doesn't use the timeline/trail-on-left view from the docs** — target the in-use
   `TranscriptApp` (`src/mockups/inuse/TranscriptApp.jsx`, `.txn-trace`/`.txn-stream`). The documentation
   (`48-conversation.jsx`) shows a trail/timeline on the left; the in-use viewer doesn't. Align the in-use
   viewer with the documented pattern (left trail/outline rail), OR use the new `TranscriptMarkers` +
   `StepsWaterfall` to provide the left trail.
5. **graph map is right-aligned, not centered/filling** — target `#inuse-stage … .gmp-body`
   (`src/mockups/inuse/GraphMap.jsx` + `.gmp-*` in `src/index.css` ~line 3118+). The map content sits
   right-aligned instead of centered/filling. Check `--gmp-map-pad-x` and `.gmp-body`
   (`grid-template-columns: minmax(0,1fr) 264px`). **"review other demos sizes as well, fix."** — audit
   ALL three in-use apps (Graph, Commons, Transcript) for centering/fill consistency.
6. **hero wordmark too big on bigger screens** — target `#brand .hero-word` ("fairtrade"). Cap it with a
   `max`/`clamp` so it doesn't blow up past a sensible size on wide viewports. In `src/index.css`
   (`.hero-word` sizing).

## B. TUI authenticity — keyboard-driven, not buttons (technical feasibility)
The reviewer is right: peasant's TUI is **keyboard-driven** (bubbletea renders a text buffer; NO mouse,
NO clickable buttons). My recreation (`src/sections-react/56-terminal.jsx`) uses web `<button onClick>`
for tab switching (line ~390 `.tui-tab`), session open (line ~169 `.tui-open`), back (line ~150
`.tui-back`), the wizard radios (line ~230 `.tuiw-opt`), and wizard nav (lines ~365 `.tuiw-btn`). That
reads as a web UI, not a terminal.

**Peasant's real input model** (from the scout / `peasant/internal/tui` + `peasant/docs/TUI.md`):
tab/shift-tab/1/2/3 = switch tabs · enter = open session · esc/backspace = back · h/l/space/arrows/j/k =
navigate · q = quit. The wizard: ↑↓ + number keys to pick, enter = continue, b = back, r = restart.

**Feasibility + recommended fix (do this):** make the TUI a **focusable keyboard region** that reads as a
terminal, while staying accessible (the system is neuroinclusive — a keyboard-only widget with no
focusable control is NOT acceptable, so don't just delete the buttons):
- Wrap each TUI (`.tui`, `.tuiw`) as `role="application"` (or a labelled `group`), `tabIndex={0}`, with a
  visible focus ring and a one-line hint ("focus, then use the keys below"). Add a `keydown` handler
  wired to the REAL keybindings (tab/1/2/3/enter/esc/j/k/↑↓/b/r) that drives the existing `useState`.
- Visually drop the web-button chrome so tabs/rows/options read as terminal text: the active tab is just
  highlighted (the amber fill is fine), the selected session row shows the `▸` cursor (no chevron
  button), the wizard option shows `▸ ●`/`○` driven by ↑↓ — matching how the real TUI shows selection.
- Keep them as **semantic `<button>`s under the hood** (so click + screen-reader still work) but strip
  the visual button affordance — i.e., authentic-looking terminal, still operable by keyboard AND click.
  This satisfies both authenticity and a11y. The help bars already list the keys; make them real.
- Apply to BOTH flows (the analytics TUI tabs/sessions, and the kickstart wizard radios/nav).

## C. design review — broader QA (the reviewer asked to "review the TUI, ALL designs")
Do a full pass over the new bands + app shells for craft. Known items found this session:
- **app-shell layouts clip on narrow/medium widths** (see D) — the commons sidebar "approve" buttons get
  cut at the section edge; the page is contained via `#app-commons/#app-map/#app-viewer { overflow-x: clip }`
  (`src/index.css`, bottom) but the real fix is responsive stacking (D).
- audit each new doc band (`70`–`80`) and app shell (`82`–`86`) in BOTH themes at 1440 / 768 / 390 via
  `node scripts/shoot.mjs` + the reveal trick (emulate `prefers-reduced-motion: reduce` and add `.reveal`
  to `.band` to bypass the scroll-reveal `opacity:0`, since programmatic scroll fights the page's
  scroll-snap — see this session's screenshot scripts).
- check that wide components (StepsWaterfall, ModerationQueue, RoleRoster, TranscriptMarkers `Phase`,
  ToolRenderers code) shrink gracefully in narrow containers — several have a large min-content and only
  fit at ~600px+, which is what forces the app-shell clipping.

## D. app-shell responsive refinement
The three app sections (`82-app-commons`, `84-app-map`, `86-app-viewer`) compose full-width app layouts
into the ~700–1040px docs column, so their multi-column grids squeeze components below their min-content
and spill (currently clipped by the `overflow-x: clip` rule). Refine: make each app layout **stack to a
single column** below ~900px (so each component gets full width), and/or give sidebars more room on
desktop. Then the `overflow-x: clip` becomes a belt-and-suspenders rather than the thing hiding content.

## E. remaining integration (lower priority)
`llm/GAPS.md` §3 lists the app-level integration that is component-complete but not wired to live data:
provider-accent keying in the real transcript viewer, the live collective-hub/settings pages, the
commit-timeline SHA overlay, the live map app + local-program connection. These are real-app wiring, not
design-system work — do only if the scope calls for it.

---

## how to verify (every change)
`pnpm build` (contrast gate, both themes) · `node scripts/validate.mjs` (20/20: one h1, heading outline,
scroll-spy, 0 overflow 320–1440, no console errors) · `node scripts/sbsmoke.mjs` (every story, 0 real
errors) · screenshot changed surfaces in BOTH themes. Keep radius 0, amber scarce, meaning never on
colour alone, motion behind `prefers-reduced-motion`, 16px text floor / mono-14 chrome, tokens only.

## ready to clear
Yes — you can run `/clear` now. Everything is committed + pushed to `main` (`088e753`), all gates green.
Start the next context with: "address HANDOFF.md" — work A→B→C→D in order; A and B are the reviewer's
explicit asks.

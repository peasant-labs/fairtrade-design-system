# handoff — peasant design system

## current stack (migrated 2026-06-16) — supersedes stale references below

This is now a **Vite + React + Tailwind v4** app run with **pnpm** (not a single static html file):
- `pnpm install && pnpm dev` → http://localhost:5173. `?theme=light` deep-links light; `?fb=off` hides the feedback tool. `pnpm build` → `dist/`.
- **styling = Tailwind v4** (`src/index.css`): design tokens in `@theme` (aliased to the `--token` vars so dark/light re-theme), base + reused primitives as `@apply` component classes (hybrid). the 4/8 spacing values map onto Tailwind's default numeric scale.
- **gallery markup** lives in `src/gallery.html` (raw HTML blob, injected via `dangerouslySetInnerHTML` — "not componentized yet"). **`src/App.jsx`** injects it and runs the **feedback tool** as React: annotate any element → comment → auto-saved to gitignored `feedback.md` via the `/feedback` middleware in `vite.config.js`. `serve.py` was removed (the middleware replaces it).
- **type: Atkinson Hyperlegible Mono** (display + chrome + code, the "looks ascii" face) + **Atkinson Hyperlegible** (reading prose), via Google Fonts in `index.html`. (Iosevka Etoile was replaced.)
- docs now live in **`llm/`**. icons: lucide CDN `createIcons()` for the gallery blob, **lucide-react** for the feedback tool.
- DONE since last handoff: conversation-window reorg (inline role tag per turn, subagent bracketed as a nested thread with box-drawing elbows, `>` prompt mark, grid-aligned tool-call headers), footer `position:sticky`, `.box`→`.check-tick`, en-dash/buzzword cleanup, type-comparison section removed.
- To render for review: `pnpm dev`, then headless Chrome against `http://localhost:5173/?theme=dark&fb=off` (swap the file:// url in the command below for that).
- STILL OPEN (Pass 2): the missing transcript-viewer components (scrubber, right rail, per-tool renderers, session hero, turn-context bar, search bar, share dialog, graph nodes, kbd/error-pill/etc — see open issues #2) and more Caves-of-Qud flavor (#6).

---

_(historical notes below; some paths/claims predate the migration above. design rules + the Pass-2 component scout remain valid.)_

For the next agent picking this up: read this, then `DESIGN.md` (the system spec) and run the app.

## what this is

A single unified visual identity for three sibling apps:
- **peasant** — `/Users/vitorhugo/Documents/Projects/peasant/web` (Next 15, Tailwind v4)
- **village** — `/Users/vitorhugo/Documents/Projects/village/frontend` (Next 16, Tailwind v4)
- **transcript-browser** — `/Users/vitorhugo/Documents/Projects/transcript-browser/packages` (shared React viewer both apps embed; has `@peasant-labs/theme`)

All three currently share an old "monochrome editorial" system (Chivo + JetBrains Mono, paper-white) that is being **fully replaced**.

## where things live

- Repo: **https://github.com/peasant-labs/peasant-design-system.git** (branch `main`, `gh` authed as vitorhw). This folder (`/Users/vitorhugo/Documents/Projects/unified-identity`) IS the git repo.
- `index.html` — the living component gallery / demo. Single self-contained file.
- `DESIGN.md` — philosophy + full system spec.
- `README.md`, `HANDOFF.md` (this).
- `shots/` — screenshots (gitignored).
- `icons/` — real brand SVGs (reference; index.html inlines them).

## how to view / render / test

- View: `open index.html`. Toggle dark/light with the top-right button. Deep-link a theme with `?theme=light`.
- Render for review (headless Chrome):
  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
    --hide-scrollbars --force-device-scale-factor=2 --window-size=2240,8400 \
    --virtual-time-budget=16000 --run-all-compositor-stages-before-draw \
    --default-background-color=070706ff --screenshot=shots/out.png \
    "file://$PWD/index.html?theme=dark&v=1"
  ```
  Then crop with PIL and inspect. **Gotcha:** `--force-device-scale-factor` divides the CSS viewport (window/scale), so render WIDE (CSS width ≥ 1100) or the nav overflows; and the page is long (~8000 CSS px) so use a tall window and re-measure crop offsets each time (the page height changes as you edit — bad offsets give blank/mislabeled crops).
- The user reviews in their own browser. **Tell them to hard-refresh (⌘⇧R)** — file:// caching has repeatedly made them see stale versions (e.g. "typography section missing" when it was present).

## LOCKED design decisions (do not relitigate)

- **typeface: Iosevka Etoile** (quasi-proportional slab serif) for display + body; **Iosevka** (mono) for code ONLY. Final. The "typography: compare & choose" section in index.html can now be removed (it was a chooser; the user picked iosevka etoile).
- **themes: two only** — dark (default, sharp near-black `--canvas:#070706`) + light (pure white `--canvas:#ffffff`). `--ink-strong` for titles (near-white dark / near-black light). Palette is desaturated/earthy (amber primary `#cba35c`; teal/olive/clay/mauve accents). Glow is dark-only.
- **all-lowercase UI chrome**; never lowercase user content.
- **icons are vector, never ASCII** (ASCII art was tried repeatedly and retired — it never aligns): Lucide for UI/tools/status/nav, Simple Icons for brand marks (claude/gemini/opencode/cursor, inlined), the real peasant **wheat logo** for the brand mark. EVERY inline `<svg>` MUST carry a `viewBox` + `width`/`height` or it defaults to 300×150 and stretches its container (this bit us on the provider chips).
- **standardized tokens:** one 4/8 spacing scale, one type scale, one border token, one control height (`--control-h` 36 / `--control-h-sm` 28), radius 0.
- **architecture:** single shared `@peasant-labs/theme` token package as source of truth. Token NAMES are preserved across apps (`--ink/--rule/--surface/--mark/--canvas`; `--tb-*` mirror in the viewer) so only VALUES + fonts change and components reflavor in place.

## the user's rules (they enforce these hard — violating them is the #1 source of churn)

1. **no decorative cruft.** No em dashes (—), no `·` middots, no buzzwords, no "not X, but Y". No decorative icons on nav items or section headers. No accent bars on titles (I added one; they made me remove it — "you're getting lost at our own rules"). When in doubt, remove it.
2. **real icons only**, consistent sizes, never unicode glyphs/dots as functional icons.
3. **everything aligned, left-aligned**, on the grid. They catch staircased left edges immediately.
4. **equal heights** for controls sitting next to each other (buttons, chips, inputs). They caught share/contribute and a full-size `+` next to small buttons.
5. **sharp tones / contrast** — they rejected soft bg/text; dark must be deep, light must be white, titles crisp.
6. **caves of qud flavor** in styling/organization, but **never at the cost of readability** (keep the colors). Current Qud touches: amber corner-bracket HUD frames on windows/canvas/dialog (`.framed`). They want MORE Qud (see open items) but tasteful.
7. **review everything yourself, thoroughly, via screenshots** before declaring done. They keep catching glitches I shipped. Consider spawning parallel QA-reviewer agents on the rendered crops (it caught real defects: unequal card heights, the staircased form, text-vs-filled button pairs).
8. **avoid generic CSS class names** — `.box` (nav search) collided with `.box` (checkbox, amber bg) and glitched the search field. Namespace classes.

## current state (done)

- Full gallery in `index.html`: nav, hero, principles, typography comparison, palette, controls, badges/providers/states, trails (breadcrumb/steps/tabs/pager), cards & rows, conversation window, canvas+dialog, forms/filters/empty states. Organized into `foundations` + `components` groups.
- Sharp two-theme palette; iosevka etoile + iosevka; real icons + wheat logo.
- Fixed/sticky nav (top) + fixed footer status bar (bottom); both now **full screen width** (`.nav-in`/`.foot-in` no longer max-width-capped). Body content stays `--maxw` 1040 centered.
- Conversation window: phase divider → user (icon, no "you") → assistant → subagent task (indented, mauve) → assistant with diff/bash → checkpoint commit marker; role-tinted backgrounds (user=teal, assistant=amber, subagent=mauve).
- Qud corner-frames on windows/canvas/dialog. Recurring flex-measurement bug worked around with `min-width:max-content` (nav brand, nav-right, nav-left — apply this anywhere an inline-flex of icon+text collapses/overlaps).

## OPEN ISSUES / TODO (what the user still wants — prioritized)

1. **Conversation turns are "all messed, not well organized, not everything working."** Re-examine the turn layout/organization. The role-tint + icon-only `who` column may read awkward; tighten the visual hierarchy and spacing. Verify in the user's browser (they may have seen a stale cache, but treat as real).
2. **MISSING transcript-viewer components** the user explicitly named:
   - **scrubber window** — `HorizontalScrubber` (`transcript-browser/packages/browser/src/rails/HorizontalScrubber.tsx`, styles `.tb-scrubber*`): a compact density bar with ticks (error/user/flag) + a draggable viewport window.
   - **side menus / right rail** — `RightRail` (outline / filters / checkpoint / scrubber tabs), `OutlineList`, `FilterSection`, `ViewOptions`, `CheckpointSelector` (`transcript-browser/.../rails/`).
   - "**among other stuff**" — RE-SCOUT the transcript viewer (`transcript-browser/packages/browser/src`) for anything else missing (per-tool renderers Bash/Read/Edit/Write/Grep/WebFetch, ThinkingBlock variants, TabStrip counts, StickyHeader, TurnContextBar, ShareDialog, the trajectory graph nodes, ErrorPill, OutcomeChip, Kbd, ProgressIndicator). There are earlier detailed scout specs in this conversation's history; re-run an Explore pass to be safe.
3. **Section title alignment** — the group (`foundations`) vs section (`principles`) titles looked misaligned to the user. Bars are now removed; verify group `.group` and section `section.band` labels share the exact same left edge as body content; fix if not.
4. **Footer sticky** — currently `position:fixed; bottom:0`. The user said "the footer should be sticky." Confirm it stays visible and doesn't overlap content (body has `padding-bottom:44px`). If they want `position:sticky` behavior instead, adjust.
5. **Top actions** — search/connected/theme were glitched (the `.box` collision, now fixed). Re-verify the three are consistent height, transparent backgrounds, no white/amber fills.
6. **More Caves of Qud** — push the flavor further if they want (heavier framing, a status-bar HUD, bracketed labels) but keep it organized and readable. Last instruction was measured corner-frames; gauge appetite.
7. Remove the now-obsolete **typography comparison** section (decision made: iosevka etoile) — or keep one specimen as reference.

## phase 2 (the actual rollout, once the gallery is approved)

Build the shared `@peasant-labs/theme` token package as the source of truth (the file is `transcript-browser/packages/theme/src/tokens.css` — it already mirrors the app token names via `--tb-*`). Swap values + fonts to the new system, retarget the three apps' `globals.css` (`peasant/web/src/app/globals.css`, `village/frontend/src/app/globals.css`) and the viewer's `styles.css`. Because token NAMES are preserved, most components reflavor in place; then fan out screen-by-screen. The user wants this done with workflows / agent teams (ultracode session).

## memory

Project + preferences are also in the agent's persistent memory: `project_design_unification_qud.md` and `feedback_design_craft.md`.

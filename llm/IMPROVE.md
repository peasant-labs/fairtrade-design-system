# improve the design system — working backlog (quality + coverage)

> **▶ Current priority lives in [`NEXT_PHASE.md`](./NEXT_PHASE.md)** (set 2026-06-17: ascii hero,
> snap-scroll, value-prop art, 1-column layout, spacing/hierarchy cleanup, interactive use-case mockups).
> This file is the underlying **quality + component-coverage** backlog: tiers 1 and 2 are largely DONE
> (see the session logs below); tier 2b and the JSX port remain. The unification + rollout
> ([`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md)) stays **deferred**. Stay inside `unified-identity`.

This is the prioritized, actionable backlog. Items are verified against the code (a 12-agent audit on
2026-06-16). Read [`HANDOFF.md`](./HANDOFF.md) for the stack + the render/QA loop, and
[`PRESENTATION.md`](./PRESENTATION.md) for the section anatomy + doc-primitives. Work in small passes,
render dark+light (`?cap`), and self-review screenshots before declaring done (owner rule #7).

---

## session log — 2026-06-16 (interactive dialog + first JSX components)

- **Interactive dialog (completes item 8):** new reusable `Dialog.jsx` - real `role=dialog` + `aria-modal`,
  focus-trap (Tab cycles inside), Escape + scrim-click close, focus returns to the trigger, background
  scroll locked, animated entrance. Triggered from the canvas section ("join collective" button) via the
  existing click-delegation; the static open-state preview stays as the anatomy. `scripts/validate.mjs`
  now covers it (19/19). The fully-interactive trap/return-focus that tier-1 deferred is now shipped.
- **Root-cause fix: `Raw` is now `memo`-ized.** The partial injectors were re-rendering on every
  scroll-spy `setActive`, which made React reset their `innerHTML` and clobber the lucide `<svg>`s that
  `createIcons` had painted in - and detach any captured DOM ref (that broke the dialog's focus-return).
  Memoizing `Raw` (its `html` prop is a stable import) renders each partial exactly once: icons stay
  put and refs stay valid. Also a perf win (partials no longer reconcile on scroll).
- **Dialog effect depends only on `[open]`** (onClose/returnFocusRef via refs); depending on the
  fresh-every-render `onClose` made the effect re-run mid-open and its cleanup yank focus to the trigger.
- **Interactive tabs (tier-2a "tabs panel/content region"):** the trails-section tabs are now a real
  `role=tablist` of `<button role=tab>`s with `role=tabpanel` content; App.jsx wires click + arrow/Home/End
  keyboard nav with a roving tabindex and toggles `[hidden]` on the panels (animated). Verified
  interactively (click + ArrowRight switch selection, focus, and the visible panel).
- **Interactive dropdown menu:** the overlays-section menu is now one live `role=menu` that the trigger
  toggles (click or Down/Up), with arrow/Home/End roving focus that SKIPS the disabled item, Esc/Tab/
  outside-click close, and focus return to the trigger; the float menu overlays content (not in-flow)
  with an animated entrance. Verified (ArrowDown from "copy share link" skips disabled "archive" to "delete").

So the showcase is now genuinely interactive end-to-end: command palette (⌘k), modal dialog (focus-trap),
tablist, and dropdown menu - all keyboard-accessible. `scripts/validate.mjs` = 19/19.

---

## session log — 2026-06-16 (overnight: tier-2 batch 1 + bug fixes)

Built **tier-2 batch 1** (states + overlays + chip depth) via a 9-agent design fan-out, then a deep
interactive bug-fix pass. All verified with a new puppeteer harness (`scripts/diag.mjs`) + screenshot QA.

**New showcase sections** (2 new partials, wired into `App.jsx` + rail): `36-states.html` (button
states: real disabled/loading/toggle/link/icon-sizes/button-group/segmented; input states:
error+message/disabled/read-only/helper/textarea/radio; a real switch; feedback: skeleton/progress/
spinner/toast/loading+error+no-results) and `54-overlays.html` (tooltip+popover, dropdown menu,
command palette, avatar/kbd/tag). Chip depth (removable/filter/status-dot/notification/sizes) added to
`42-badges`. All namespaced CSS, no new color tokens, gate still green.

**Bugs fixed (reported + found), all verified interactively:**
- **icons disappearing** → dropped the flaky unpkg lucide CDN; now bundled (`src/icons.js`, 67 used
  icons) painted by `paintIcons()` + a MutationObserver. Icons persist across theme toggles. Fixed the
  removed `github` icon (→ `book-marked`). Completes IMPROVE item 10.
- **left rail active link not updating** → replaced the stuck IntersectionObserver band with a
  deterministic rAF scroll-spy (last section past a fold line). Verified correct at every section.
- **nav not revealing** → nav now hides on scroll-down, restores on scroll-up (`.nav--hidden`,
  transform transition), in the same scroll handler. Verified.
- **search not working** → built a real interactive `CommandPalette.jsx` (opens on ⌘k / search-pill
  click, filters sections+actions, arrow/enter/esc keyboard, smooth-scroll jump) reusing the `.cp-*`
  styling. Nav search is now a real `<button>`.
- **horizontal overflow** → the `100vw` hero/intro (scrollbar gutter) replaced with full-bleed via
  `max-width:none`; nav sheds non-essential items on narrow widths; principles/swatches grids collapse;
  wide tables wrapped in `.dtable-wrap`; footer + type-scale wrap on mobile. Overflow 0 at 390/768/1440.
- **weird section below hero** → intro headline resized so "receipts for agentic work," holds line 1
  (highlight no longer split), mono tracking relaxed.
- **hero** → "fairtrade" now rendered as amber **ASCII** (`AsciiText`) on a bordered canvas plate (the
  gap/border dividing video and name), with a left-to-right reveal; the ascii wheat video stays.
- **animation/fluidity** → restrained interaction-motion block (hover lift on cards, press dips,
  shared transitions, rail-marker slide, palette enter), all under `prefers-reduced-motion: no-preference`,
  ≤200ms, nothing loops. Smooth scroll on jumps.
- **tier-2 QA fixes**: popover no longer overlaps its table (reserved height); avatar large slot uses a
  real image (`public/avatars/otho.jpg`); avatar group no longer clips initials (z-order + -6px);
  command-palette active-row fill strengthened in light; kbd note typo + glyph (`├`→`↳`) fixed.
- favicon added (wheat mark) to silence the 404; em-dashes purged from `index.css` comments.

**New dev tooling:** `scripts/diag.mjs` (puppeteer-core interactive harness: overflow, scroll-spy, nav,
search, icons across viewports). `puppeteer-core` + `lucide` added as deps.

---

## session log — 2026-06-16 (tier-1 pass)

**Done & verified (build green, contrast gate passing in both themes, screenshot-QA'd):**
- **12 contrast gate** — `scripts/contrast.mjs` parses the live tokens, checks every required
  text pair ≥4.5:1 and functional border/ring ≥3:1 in both themes, exits nonzero on failure. Wired
  into `pnpm build` (`"build": "node scripts/contrast.mjs && vite build"`) + a `pnpm contrast` script.
- **1 borders** — owner decided (functional 3:1, dividers subtle): `--rule-strong` (control/input
  borders) raised to dark `#6f6a5f` / light `#8b836d` (clears 3:1 vs every surface); `--rule`
  (structural dividers) raised to dark `#3c382f` / light `#c4bca8` but kept intentionally sub-3:1 as
  decorative separators. Doc hex synced in 24-color, 64-tokens, 34-controls; NEUROINCLUSIVE claim made true.
- **2 ink-4 split** — `--ink-4` is now text-safe (dark `#8a8478` / light `#6f695e`, ≥4.5:1);
  `--ink-5` holds the old decoration value; decorative usages (bullets, separators, diff sign,
  minimap, elbow) re-pointed to `--ink-5`; text usages stay on `--ink-4`. New `--color-ink-5`.
- **3 headings** — direct-child `.band` titles → `<h2 class="label">`, direct subheads → `<h3>`
  (zero visual change; nested caption labels left as spans on purpose). Cards title in App.jsx too.
- **4 icon-button names** — JS pass in App.jsx names the 57 unlabeled `.copy-token` buttons from
  `data-copy` and sets `aria-hidden`/`focusable=false` on decorative glyphs; explicit aria-labels on
  the canvas zoom/fit, pager prev/next, and dialog close buttons.
- **5 swatch hex** — 24-color swatch strip corrected (surface/ink/rule literal hex; `amber-hi`→`amber-bright`).
- **6 em-dashes** — the 3 stray `—` (index.css:531, App.jsx:160/171) → `-`; src is clean.
- **7 real checkbox** — `.check` now wraps a real `<input type=checkbox class=check-box>`
  (appearance:none, css tick); native keyboard/focus-visible/disabled. Updated in controls, canvas, forms.
- **8 dialog (partial)** — the canvas dialog specimen got `role="dialog"` + `aria-labelledby` +
  `aria-describedby` + a named close button. Intentionally NO `aria-modal`/focus-trap: it is a static,
  always-visible specimen, so a trap would be wrong; the interactive trap/Esc/return-focus lands with
  the JSX component port (tier 2.5).
- **9 motion** — interaction transitions wired to `--dur-1`; the one-time hero/reveal entrance wired
  to `--dur-entrance`/`--ease-out`/`--ease-spring`; docs (32-motion, 64-tokens, NEUROINCLUSIVE) now
  carve out the entrance as an explicit, reduced-motion-disabled exception to the ≤200ms rule.
- **11 tokens** — added `--success/--warning/--danger` (+`-fg`/`-soft`), `--surface-elev`, `--z-*`,
  `--dur-*`, `--ease-*`; exposed semantic + ink-5 + surface-elev as Tailwind colors.
- **13 dead code (partial)** — deleted `src/gallery.html` (unambiguously superseded). LEFT the unused
  `src/img/*` portraits and the extra `effects.jsx` exports in place: they are curated art / a reusable
  toolkit (and tree-shaken already), so deleting them unprompted wasn't warranted — owner to confirm.

**Deferred (with reason):**
- **10 drop lucide CDN** — 198 `data-lucide` icons depend on the UMD + `createIcons` poll. Explicitly
  paired with the tier-2.5 JSX port; too risky to swap to `lucide-react` before that. Still open.

**Newly found this pass (add to the backlog):**
- **66-resources uses `data-lucide="github"`**, a brand icon lucide REMOVED — it renders blank
  (violates "real icons only"). Needs a valid replacement icon; left as a design choice for the owner.

---

## tier 1 — quality fixes (make the shipped system honest + correct)

These are real defects that contradict the system's own claims. Mostly mechanical; do these first.

1. **Functional borders fail 3:1 in both themes.** `--rule`/`--rule-strong` are too low-contrast for
   functional borders (inputs, tables, dividers, turns). Verified: dark `--rule` #2e2b24 ≈1.4:1,
   `--rule-strong` #4d483e ≈2.2:1; light `--rule` #cfc8b9 ≈1.6:1, `--rule-strong` #b3ab9a ≈2.2:1.
   Raise lightness to clear 3:1, keep 1px. Suggested: dark `--rule` ~#46423a / `--rule-strong` ~#5e5849;
   light `--rule` ~#b4ab98 / `--rule-strong` ~#938b78. (`NEUROINCLUSIVE.md` claims this was fixed — it
   wasn't; update the doc to match reality after fixing.) Add the contrast check (item 12).
2. **`--ink-4` used as readable text below 4.5:1** (turn meta, tab counts, phase ranges, diff line
   numbers, code comments). Split: keep a decoration-only token (rename to `--ink-5`) and add a
   text-safe `--ink-4` (dark ~#8a8478, light ~#6f695e); re-point the text usages.
3. **Heading hierarchy is broken** — section titles are `<span class="label">`, there is no `<h1>`.
   Promote section titles to `<h2>`, group openers stay/`<h2>`, in-section sub-heads `<h3>`, and give
   the page a real `<h1>` (can be visually-hidden or the intro headline). CSS targets by class, so this
   is **zero visual change** but restores the assistive-tech outline.
4. **Icon-only buttons lack accessible names.** Script `aria-label` onto the ~57 `.copy-token` buttons
   from their `data-copy` value, and the canvas/pager/dialog-close icon buttons; add `aria-hidden="true"`
   to decorative Lucide icons.
5. **`24-color.html` swatch specimen is wrong.** The `.swatches` strip shows mislabeled hex (the "ink"
   chip uses `--ink-strong` #f8f5ed, "surface" uses `--surface-2`, "rule" uses `--rule-strong`) and an
   invented name "amber-hi" (should be `amber-bright`). Drive the specimen strip + the token table from
   one source array so they agree.
6. **Em-dashes in `App.jsx` comments** (lines ~160, ~171) violate the system's own anti-slop rule —
   replace with `-`. Grep the whole src for stray `—`/`·` while there.
7. **Real checkbox.** `.check` is a styled `<label>` with no real `<input>` — no keyboard, no
   indeterminate, no disabled. Make it a real `<input type=checkbox>` (visually styled) in the controls
   section; same for select open-state and the rest of the fake "interactive" doc bits.
8. **Dialog a11y.** The showcased dialog has no `role="dialog"`/`aria-modal`/`aria-labelledby`, no
   focus-trap, no Esc/return-focus. Make the specimen a correct dialog (it's the pattern the apps copy).
9. **Motion contradiction.** Docs say "≤200ms" but the hero/reveals run ~900ms. Either carve out the
   one-time entrance motion as an explicit exception in `NEUROINCLUSIVE.md` + `motion` section, or
   tighten `.reveal`.
10. **Drop the unpkg-lucide CDN** (`index.html` + the `setInterval` hydration poll). Bundle icons via
    `lucide-react` instead (lucide is already a dep). This also removes an external runtime dependency
    and the double-shipped icon set. (Pairs naturally with porting partials to JSX — item 14.)
11. **Add missing semantic + scale tokens** the system gestures at but lacks: `--success/--warning/--danger`
    (+`-fg`/`-soft`), `--surface-elev`, `--z-*` (nav/sticky/dropdown/dialog/toast/tooltip), `--dur-*` /
    `--ease-*` (durations/easing are inline literals today). Keep names aligned with the apps for later.
12. **Add a contrast gate** (a small script, run locally + in the deploy CI): every text/surface pair
    ≥4.5:1, every functional border/icon/ring ≥3:1, in **both** themes; APCA tags on dark. This is the
    backstop that keeps items 1–2 from regressing.
13. **Purge dead code** — delete `src/gallery.html` (now unused, superseded by `src/sections/`), the
    unused `src/img/*` not referenced by `App.jsx`, and the unused `effects.jsx` exports
    (AsciiArt/Halftone/AsciiText/GlyphField) if truly unused.

---

## tier 2 — component coverage (document more, document the real states)

The system shows ~10 families, mostly happy-path. The biggest cross-cutting gap is **no
loading/disabled/error axis** anywhere. Add states first, then new components — to the **showcase**
(sections + doc-primitives), since the goal is improving the DS, not the apps yet.

### 2a. states for existing families
- **button:** real `:disabled` (not faked opacity), `loading`/busy (`aria-busy` + spinner), toggle
  (`aria-pressed`), link-button, icon sizes; a button-group / segmented control.
- **input/select/checkbox:** error/invalid (`aria-invalid` + message slot), disabled, read-only,
  helper/hint text, textarea (CSS exists, undocumented), radio group, switch.
- **badges/chips:** removable (×), selected/toggle filter chip, status dot, numeric notification badge,
  size variants — and a single parametric `chip` base (the apps hand-roll these everywhere).
- **cards & rows:** hover, `:focus-visible` (the whole-card link has no focus today), selected/active,
  skeleton card, card-with-actions-menu, selectable row.
- **trails:** tabs **panel/content** region (tabs only render the tablist now), disabled/overflow tabs;
  numbered pagination; breadcrumb truncation; step error state.
- **conversation window:** loading + error-to-load surfaces; the copy-deep-link affordance; per-tool
  renderer specimens (see 2b).
- **dialog:** drawer/sheet variant, alert-vs-form distinction, size variants, submitting footer state.
- **forms/empty:** loading + error + no-results vs no-data vs first-run variants (only one empty state
  exists).

### 2b. new components to add to the showcase (high reuse first)
From the apps' inventory (see `UNIFICATION_PLAN.md` §2 for sources):
- **overlays/controls:** tooltip, popover, dropdown menu, command palette (⌘K — the nav already
  advertises it), collapsible, skeleton, table, pagination, segmented control, kbd, switch, progress
  indicator, toast / `aria-live` region, avatar.
- **transcript viewer depth** (the single largest uncovered area): the per-tool renderer system
  (read / edit / write / bash / grep / webfetch / task / default), thinking-block variants,
  checkpoint + task-boundary, role glyph, outcome chip, error pill, duration/token badges, code block
  (syntax), markdown prose surface, diff renderer.
- **rails:** right-rail (tabs + collapse), outline lists, filter section/checkbox, view options,
  checkpoint selector, horizontal scrubber.
- **graph:** trajectory graph nodes (turn-card / tool-pill / subagent-branch), controls, legend.
- **overlays/flows:** find-in-page search, share dialog, the contribute step-wizard, redaction-diff
  review, tour/coachmark, explainer/glossary term.

> When adding these, keep them as **showcase specimens** with the full section anatomy (overview →
> specimen → anatomy/do-don't → specs/tokens → a11y note). Real states, real data, lowercase chrome,
> radius 0, hairlines, amber scarce.

---

## tier 2.5 — optional: port partials to real React components (improves the DS itself)

The 20 `src/sections/*.html` partials are injected via `dangerouslySetInnerHTML` (no props, no types,
no reuse). Porting them to JSX components **inside this app** improves maintainability and is a
prerequisite for adding interactive states (loading/disabled/open). This is a DS improvement, not
unification — keep it in `unified-identity` (do **not** spin up the `@peasant-labs/ui` package yet).
Pairs with item 10 (drop the lucide CDN, use `lucide-react`).

---

## tier 3 — DEFERRED: unification + rollout

The shared `@peasant-labs/ui` package, the token-namespace reconciliation across the three apps, and
the screen-by-screen app rollout are documented in [`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md).
**Do not start these** until the owner re-prioritizes. The one fact to remember: the rollout's
"names-preserved, values-only" premise is false today (three token namespaces / three dark polarities),
so any future rollout starts with reconciling tokens in `@peasant-labs/theme`.

---

## suggested first pass (small, verifiable, all tier 1)

contrast gate (12) → fix borders (1) + ink-4 (2) → headings (3) → copy-button aria-labels (4) →
swatch-hex + amber-hi (5) → em-dash comments (6) → render dark+light, screenshot-QA, update
`NEUROINCLUSIVE.md` to match the now-true contrast claims. Then move to tier-2 states.

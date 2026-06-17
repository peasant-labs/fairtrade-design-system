# improve the design system — working backlog (START HERE)

> **Priority (set 2026-06-16): improve the design system itself — quality + component coverage —
> over unifying it with the apps.** The full unification + rollout plan exists in
> [`UNIFICATION_PLAN.md`](./UNIFICATION_PLAN.md), but the `@peasant-labs/ui` package extraction and
> the app rollout are **deferred** until the owner says otherwise. Stay inside `unified-identity`.

This is the prioritized, actionable backlog. Items are verified against the code (a 12-agent audit on
2026-06-16). Read [`HANDOFF.md`](./HANDOFF.md) for the stack + the render/QA loop, and
[`PRESENTATION.md`](./PRESENTATION.md) for the section anatomy + doc-primitives. Work in small passes,
render dark+light (`?cap`), and self-review screenshots before declaring done (owner rule #7).

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

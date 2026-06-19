# AGENTS.md - fairtrade design system

Guidance for AI agents working in this repo. Humans: see `README.md`, plus the design reference in
`llm/DESIGN.md` and `llm/NEUROINCLUSIVE.md`.

## what this is
A single-page presentation site for the **fairtrade** design system plus the component library
it documents. Stack: Vite 8 + React 19 + Tailwind v4 (CSS-first `@theme`) + Storybook 10. Package
manager: **pnpm**. Source is **JS/JSX only - no TypeScript**. Icons: `lucide-react`. Tables:
`@tanstack/react-table` (headless). Charts: `recharts` (wrapped, never raw).

## where things live
- `src/ui/*.jsx` - the component library; one component family per file, with a colocated
  `*.stories.jsx`. Import from the barrel: `import { Button } from './ui'`.
- `src/index.css` - the single source of truth for design tokens (`:root` dark + `[data-theme="light"]`)
  and every component's namespaced classes. Components emit class names; styling lives here.
- `src/sections-react/*.jsx`, `src/App.jsx` - the presentation page (not the library).
- `public/tokens.json`, `public/components.json` - generated machine-readable token + component
  manifests (DTCG-ish). Do not hand-edit; run `node scripts/gen-llm-artifacts.mjs`.
- `llm/DESIGN.md` - the design system reference (tokens, principles, voice, component families).
  `llm/NEUROINCLUSIVE.md` - the neuroinclusive defaults baked into the tokens, with their research sources.

## commands
- `pnpm dev` - run the page (Vite, http://localhost:5180).
- `pnpm build` - generate llm artifacts + contrast gate (WCAG, both themes) + Vite build. Must pass.
- `pnpm storybook` / `pnpm build-storybook` - the component reference.
- `node scripts/sbsmoke.mjs` - load every story incl. `play()`; 0 real errors required.
- `node scripts/sbshot.mjs both shots/x <story-id-substr>` - screenshot stories (both themes) for QA.

## hard invariants (do not violate; the build gate enforces contrast)
- **Tokens only.** Never hardcode a hex/px - reference a token (`var(--amber)`, `var(--sp-4)`).
  Spacing is the 4/8 scale (`--sp-1..8`); icon sizes are `--ic-sm/md/lg`; controls share `--control-h`.
- **Radius 0** everywhere (square). **Amber is a scarce accent.** Palette is desaturated/earthy.
- **Two themes**, both must pass WCAG AA; everything re-themes by swapping CSS vars on `[data-theme]`.
- **16px floor** for readable body text; chrome/labels are mono 14. **All-lowercase UI chrome**;
  never lowercase user content (names, code, data values). **Tabular numbers** on counts/durations.
- **Neuroinclusive by default**: 1.5 line-height, >=24px hit targets, global focus ring,
  static-first motion (guard transitions with `prefers-reduced-motion`). See `llm/NEUROINCLUSIVE.md`.
- **Semantic meaning is never carried by colour alone** - always pair an icon or text label.
- **Real brand logos**: when naming a company/provider (claude, gemini, openai, cursor, opencode),
  lead with `<BrandMark name="..." />` (or `<Tag brand="...">`), never a generic glyph.
- **No AI-slop** in copy or UI: no em dashes, no buzzwords, no `//` markers, no eyebrow labels,
  no `>` prefixes (except the nav active marker). Namespaced classes; no generic collisions.

## before declaring done
Run `pnpm build`, `node scripts/sbsmoke.mjs`, and screenshot the changed components in BOTH
themes (`scripts/sbshot.mjs`) and look at them. Keep every gate green.

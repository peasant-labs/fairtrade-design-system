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
- **Real brand logos**: when naming a company/provider (claude, gemini, openai, cursor, opencode, strike),
  lead with `<BrandMark name="..." />` (or `<Tag brand="...">`), never a generic glyph.
- **No AI-slop** in copy or UI: no em dashes, no buzzwords, no `//` markers, no eyebrow labels,
  no `>` prefixes (except the nav active marker). Namespaced classes; no generic collisions.

## before declaring done
Run `pnpm build`, `node scripts/sbsmoke.mjs`, and screenshot the changed components in BOTH
themes (`scripts/sbshot.mjs`) and look at them. Keep every gate green.

## visual / screenshot harness

`scripts/` — the DS's OWN capture + fidelity tooling (the source of truth the consumer
harnesses mirror; the shared cross-repo model lives in the poly-repo root `AGENTS.md` →
"Visual / screenshot UI harness"). Puppeteer capture: `shoot.mjs` / `shootdemo.mjs` /
`shootmanage.mjs`. Storybook: `sbshot.mjs` / `sbsmoke.mjs`. Regression: `imgdiff.mjs` /
`png-diff.mjs`. Gates: `surface-gate.mjs` / `check-surface-gate.mjs`. Graph SxS oracle:
`graph-oracle.mjs` / `check-graph-oracle.mjs`. WCAG contrast gate: `contrast.mjs`.
Smokes: `smoke-{lib,map,transcript,transcript-ui,tarball}.mjs`. The in-use **demo**
(`#inuse` at fairtrade.peasantlabs.org) is the fidelity oracle consumers gate against —
when a DS component changes, consumers re-shoot their surfaces SxS against it. Consumers
(peasant/village) each carry a PARALLEL harness mirroring these primitives;
consolidation into one shared parameterized toolkit is a tracked followup (beads IDs in the polyrepo-root `.agents.local/`).

## release & npm publication

The release ceremony: squash the epoch branch to one `release(vX.Y.Z): <summary>` commit,
`merge --no-ff` into `main`, bump `package.json` to the same version in that release commit,
tag the merge `fairtrade-vX.Y.Z` (lightweight), push `main` + the tag. **Pushing the tag
publishes**: `.github/workflows/npm-publish.yml` re-runs the full gate chain (`prepack` =
`build:lib`) against the exact tarball and publishes `@peasant-labs/fairtrade` via **npm
Trusted Publishing (OIDC)** - no `NPM_TOKEN` secret exists. `pnpm
test:package-provenance` keeps the package's canonical repository metadata exact. npm
generates provenance automatically only when this source repository is public; private
source repositories remain unattested even though OIDC authentication succeeds. A
prerelease version (`-rcN` etc.) lands under dist-tag `next`; a final under `latest`. The
workflow refuses a tag whose version does not match `package.json`, reports the expected
missing attestation while this repository is private, and hard-fails after publication if
a public-source release lacks the SLSA provenance predicate.

One-time maintainer registrations (already-registered state lives on npmjs.com/GitHub, not
in-repo): (1) a `npm-publish` GitHub Actions **environment** on this repo; (2) on npmjs.com,
this repo + `npm-publish.yml` + that environment registered as the package's **Trusted
Publisher**. Never add a token secret as a fallback; if OIDC exchange fails, fix the
registration.

# contributing

thanks for helping improve fairtrade.

## setup

use Node.js 26 or newer and pnpm 10.33.2.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

## checks

run the checks that cover your change before opening a pull request:

```bash
pnpm gen:check
pnpm build
pnpm build:lib
pnpm pack:check
pnpm build-storybook
node scripts/sbsmoke.mjs
```

`pnpm build` regenerates the machine-readable artifacts, checks WCAG contrast in both themes, then builds the Vite app. `pnpm build:lib` validates the publishable library and its contracts, runtime behavior, styles, contrast, exports, and package contents. CI also runs the built-app interaction validator, rendered timeline checks, Storybook smoke tests, and the real-pointer map check. browser checks use Chrome and may require `CHROME_PATH` outside the usual local setup.

for visual changes, inspect the affected stories in both themes and use the repository's screenshot and fidelity scripts documented in `AGENTS.md`.

## design rules

keep changes aligned with `AGENTS.md`, `llm/DESIGN.md`, and `llm/NEUROINCLUSIVE.md`. in brief:

- use tokens only, never hardcoded hex or px values; keep radius at 0 and amber scarce
- support dark and light themes, both at WCAG AA contrast
- keep readable body text at 16px or larger and chrome at mono 14
- write UI chrome in lowercase, but preserve the case of user content
- use tabular numbers for counts and durations
- lead provider names with `<BrandMark>`
- preserve 1.5 line-height, at least 24px hit targets, a visible focus ring, and reduced-motion behavior
- keep copy plain, without em dashes or AI-slop

do not hand-edit `public/tokens.json`, `public/components.json`, or files under `packages/tokens/`. they are produced by `node scripts/gen-llm-artifacts.mjs`; use `pnpm gen:check` to confirm they are fresh.

## changes

keep pull requests focused and explain user-visible or API effects. use the repository's conventional-commit style, such as `feat(ui): add a component`, `fix(test): correct an assertion`, or `docs: clarify setup`.

by contributing, you agree that your contributions are licensed under the Apache License 2.0.

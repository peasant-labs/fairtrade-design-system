# Fairtrade journey harness (Playwright)

The canonical, app-agnostic layer for the Playwright **journey** harness, plus
fairtrade's own element journeys. A journey is a scripted, agent-runnable
feature flow that produces motion evidence and machine-readable validation; it
is the interaction arm alongside the screenshot harness in `scripts/`.

`lib/` owns the **shared** pieces. Consumers (peasant, village) vendor `lib/`
into their own journey harness and own everything app-specific: the Playwright
config, the authenticated/theme-pinned fixtures, and the journeys themselves.
This is the same vendoring model as `scripts/surface-gate.mjs`. Fairtrade's own
element journeys (Storybook-driven component interactions, the built-app
checks) live next to `lib/` and run in CI through the official Playwright
container, so no system Chrome and no sandbox-helper dance.

## What `lib/` provides

| File | Role |
|---|---|
| `lib/determinism-constants.mjs` | The pinned epoch and PRNG seed |
| `lib/determinism.mjs` | Frozen clock + seeded PRNG, installed via `context.addInitScript` |
| `lib/assertions.mjs` | axe scan, computed design-token checks, theme assertion |
| `lib/fixtures.mjs` | Theme-pinned context with determinism (fairtrade's own fixture) |

## Element journeys

| File | Replaces | Covers |
|---|---|---|
| `storybook-smoke.journey.mjs` | `scripts/sbsmoke.mjs` | Every story renders, play() runs, no JS errors |
| `app-validate.journey.mjs` | `scripts/validate.mjs` | The twenty built-app interaction checks |
| `session-group-disclosure.journey.mjs` | — | The shared disclosure: expand, count, tokens, axe |

The smoke journey also absorbs `scripts/check-map-pointer.mjs`: Playwright
clicks are trusted input events, which is what that script proved separately
with a raw CDP mouse. The retired scripts stay for local use. The timeline
probes (`test:timeline-rendered`, `test:timeline-session-route:mutations`)
still drive puppeteer-core; in the container they read Playwright's bundled
Chromium from `CHROME_PATH` and launch unsandboxed when root, matching
Playwright's own default.

## Run

```sh
pnpm build-storybook # storybook-static must exist first
pnpm journey         # both themes, artifacts under scripts/journey/.artifacts
pnpm journey:ci      # CI shape: JSON report, no HTML report copy
```

## Conventions a consumer harness follows

- **Two theme projects.** One Playwright project per theme, named `dark` and
  `light`; the consumer's `theme` fixture reads the project name and pins the
  app's theme control before the first navigation.
- **Reduced motion at the context level.** Set `use.reducedMotion = 'reduce'` in
  the consumer config; the determinism shim cannot express it.
- **Assert values, not class strings.** Use `expectComputedTokens` and role-based
  locators; a class that stopped resolving to a token is still in the markup.
- **Evidence on every run.** Write the ARIA tree and the axe report to the test's
  output directory (not only attach them), so a passing run is still inspectable
  by an agent.
- **Browser.** Point Playwright at the platform browser (on NixOS, the packaged
  Chrome via `CHROME_PATH`); do not download browsers.

## Vendoring

Copy `lib/*.mjs` into the consumer's journey harness, prepending the vendor
banner. The consumer's `vendor-guard` test fails when the vendored body drifts
from the copy here. When changing a shared file, change it here first, re-vendor,
then update consumers.

Fairtrade's own element journeys (Storybook-driven component interactions) will
live here as well; this slice establishes the shared layer only. The
`fixtures.mjs` theme helper reads the Playwright project name; element
journeys that assume a live clock (story play() functions, the built-app
checks) skip the determinism shim, matching the unshimmed scripts they port.
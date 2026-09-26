# Fairtrade journey harness (Playwright)

The canonical, app-agnostic layer for the Playwright **journey** harness, plus
fairtrade's own element journeys. A journey is a scripted, agent-runnable
feature flow that produces motion evidence and machine-readable validation; it
is the interaction arm alongside the screenshot harness in `scripts/`.

`lib/` owns the **shared workspace source** pieces, never published runtime code.
Consumers (peasant, village) vendor `lib/` into their own journey harness and
own everything app-specific: the Playwright config, the authenticated/theme-pinned
fixtures, and the journeys themselves. This is the same vendoring model as
`scripts/surface-gate.mjs`. Fairtrade's own element journeys (Storybook-driven
component interactions, the built-app checks) live next to `lib/` and run in CI
through the official Playwright container, so no system Chrome and no
sandbox-helper dance.

Playwright is the required repeatable runner and the sole required full-catalog
path. Puppeteer stays focused compatibility and local evidence only, never an
unfiltered full catalog. An optional local attach target (agent-browser, when
installed) is local exploration only, never a dependency, install step, CI
dependency, or CI oracle.

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

The smoke journey is the sole required full-catalog path: every story renders,
play() runs, no JS errors. It also absorbs `scripts/check-map-pointer.mjs`:
Playwright clicks are trusted input events, which is what that script proved
separately with a raw CDP mouse. The retired scripts stay for local use. The
timeline probes (`test:timeline-rendered`,
`test:timeline-session-route:mutations`) are focused compatibility checks that
still drive puppeteer-core; in the container they read Playwright's bundled
Chromium from `CHROME_PATH` and launch unsandboxed when root, matching
Playwright's own default. Do not run an unfiltered Puppeteer full catalog.

## Run

```sh
pnpm build-storybook # storybook-static must exist first
pnpm journey         # both themes, artifacts under scripts/journey/.artifacts
pnpm journey:ci      # CI shape: JSON report, no HTML report copy
```

## Conventions a consumer harness follows

- **Bind theme by row key, not by project name.** Mounted rows use one project
  with one-theme row keys; the row setup pins the app theme control before the
  first navigation and records the observed theme. The existing catalog keeps
  its current projects; do not infer theme from a project name in new rows.
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

A vendored body loads in the consumer's own tree, so `lib/assertions.mjs`
depends on nothing but its own directory plus `@playwright/test` and
`@axe-core/playwright`. It is a byte-vendored shared source, never an app-owned
one: an app that renders one theme as an absent or empty `data-theme` value owns
that normalization in its own target or adapter, and the Fairtrade row theme
contract lives in `scripts/fairtest/fairtrade-targets.mjs`. The
helper-ownership inventory carries a `shared-vendored-source` owner that refuses
any import reaching out of `lib/`, and the compatibility test loads a copy of the
helpers into a tree holding only the shared bodies, so a product semantic cannot
reach a vendored body again. `scanAxe(page, { root })` returns the one compact
report shape declared by `AXE_RESULT_FIELDS`, whether it ran page-wide or scoped.

`scanAxe` takes one second-argument shape: an options object, or nothing. The
positional tag list and positional root selector the old signature accepted are
**refused with a `TypeError`**: destructuring them yields no recognized field, so
the parameter default would scan the whole page with the default tags, which is
a silent wrong answer inside an accessibility gate. A consumer re-vendoring this
body must move its call sites in the same commit, as `scanAxe(page, { tags })`
or `scanAxe(page, { root: "#view" })`; the refusal is the migration signal. The
per-shape inventory in `scripts/journey/lib/journey-compat.testdata.yaml` pins
which shapes are accepted and which must fail before any axe run starts.

Fairtrade's own element journeys (Storybook-driven component interactions) will
live here as well; this slice establishes the shared layer only. The
`fixtures.mjs` theme fixture reads the Playwright project name for the broad
catalog; the retired row-scoped helper must stay deleted, so Fairtest rows
bind their theme through the app-owned target instead. Element
journeys that assume a live clock (story play() functions, the built-app
checks) skip the determinism shim, matching the unshimmed scripts they port.
# pre-lift transcript baseline

Canonical screenshots of the in-use mockup rendering its own fixtures across every
transcript surface, captured BEFORE the inline transcript components were extracted
into the shared `/ui` library. The post-extraction render is diffed against these to
prove the refactor changed no pixels (graph layout is exempt from pixel parity).

Every baseline carries real, rendered content (no blank captures) and every surface is
byte-distinct from every other — both invariants are machine-enforced (see
[Non-empty + distinctness gate](#non-empty--distinctness-gate-gate-e) below).

> **Capture method (load-bearing).** The in-use stage nests each surface inside a CSS
> scroll-snap section whose inner stage is `overflow:auto` with a `position:sticky`
> banner. Puppeteer's default element screenshot (`captureBeyondViewport:true`) re-rasters
> the page OFF the live compositor; that raster does not paint the snap/overflow-clipped
> subtree, so every surface came out as a uniform background rectangle — the silent-blank
> failure these baselines previously exhibited. `shootdemo.mjs` now captures with
> `captureBeyondViewport:false` (the on-screen composited pixels, i.e. exactly what a user
> sees), which is why the surfaces render with content.

Files are named `<surface>-<theme>.png`. Themes: `dark` (default) and `light`
(`?theme=light`). Surfaces:

| surface | selector clipped | what it covers |
|---|---|---|
| `app-1-transcript` / `app-2-village` / `app-3-peasant` | `.iu-screen` | the three in-use apps via the switcher banner (overview) |
| `txn-highlights` | `.txn-app` | highlights tab (full app frame) |
| `txn-scorecard` | `.txn-scorecard` | the scorecard sub-region only (token efficiency / prompt quality / loop efficiency bands) — distinct clip from `txn-highlights` |
| `txn-trace-canvas` | `.txn-app` (full stream) | the WHOLE full-trace list, captured at full stream height (via `shotTall`, which grows the viewport so every turn is in one frame) with "expand all tool calls" on — every turn card, both thinking blocks, all five exercised per-kind tool renderers (read / edit / bash / grep / task), the exploration + implementation phase markers, the user-turn task boundaries, the checkpoint divider, and the nested subagent turn |
| `txn-scrubber` | `.txn-scrub` | the condensed scrubber tick-track element only, revealed by scrolling the trace stream — distinct clip from `txn-rails` |
| `txn-rails` | `.txn-app` | the left user-turns outline rail + the right filters rail, stream scrolled back to top |
| `txn-label-popover` | `.txn-app` | the per-turn label popover overlay |
| `txn-graph` | `.txn-app` | the trajectory graph view (turn nodes, tool pills, subagent lane, legend, minimap) |
| `txn-diffs` | `.txn-app` | diffs tab |
| `txn-files` | `.txn-app` | files tab |
| `txn-annotations` | `.txn-app` | annotations tab |

## Non-empty + distinctness gate (gate e)

`scripts/surface-gate.mjs` is the non-empty-surface assertion. A blank/near-empty capture
has a valid bounding box but paints only the background colour, so a box-size check cannot
catch it — that was the silent-blank hole. The gate decodes each PNG (in a headless page
canvas, no extra deps) and FAILS the run unless the capture carries real content:

| check | threshold | blank measures | real measures |
|---|---|---|---|
| byte size | `>= 16KB` (full) / `>= 400B` (scrubber) | ~5.9KB full | 35–176KB full, 0.5–0.65KB scrubber |
| non-background-pixel ratio | `>= 1.2%` | 0.00% | 2.5–23% |
| distinct colours | `>= 6` | 1 | 9–161 |
| byte-uniqueness | no two distinct surfaces share an md5 | 7 identical 5,891B blanks | all 26 distinct |

`shootdemo.mjs` runs this gate on every capture (so a regression that blanks a surface
fails the capture run). `scripts/check-surface-gate.mjs` proves the gate is GREEN on every
committed baseline here and RED on a synthesized blank, a near-empty (sub-ratio) surface,
and a byte-identical duplicate:

```sh
CHROME_PATH=/path/to/chrome node scripts/check-surface-gate.mjs baselines/prelift
```

## Graph node-visual theme oracle (gate c-graph)

The whole-app `txn-graph` surface is diffed pre/post like every other surface, but the graph node
**layout** (the xyflow node positions / topology) lives in the host engine and is **carved out of
strict pixel parity** — fairtrade owns the node **aesthetic**, not the engine layout. To pin that
aesthetic on its own, `scripts/graph-oracle.mjs` screenshots the layout-free **GraphNodes "Catalog"
story** (`GraphTurnNode` + `GraphToolNode` + `GraphSubagentBranch` + `GraphLegend` in one frame) in
**both themes** and asserts two things:

| check | what it catches |
|---|---|
| **non-empty** (reuses `scripts/surface-gate.mjs`) | a blank / near-empty / duplicate node render |
| **cross-theme delta** (reuses the shared `scripts/png-diff.mjs` primitive) | a **theme-token regression** — a node that hardcodes a colour instead of a token |

The delta is the discriminating half. A DOM/box presence check passes even when a node hardcodes a
hex (the node still mounts), so only a **dark-vs-light pixel diff** can prove the node visuals
actually re-theme. The oracle holds the **page background constant** across both themes, so the
delta is measured against the **node content** (the non-background pixels), not the trivially
flipping page canvas — a hardcoded node colour does not change against the fixed backdrop, so the
content-relative flip ratio drops and the gate fails. The floor (`MIN_THEME_DELTA` = **0.85**) is
calibrated against the real styled catalog: a correct render flips **~1.01** of its node content,
while hardcoding the dominant card surface (`var(--surface)`) drops it to **0.52** and the head
background (`var(--surface-hover)`) to **0.80** — so a single-colour hardcode of a dominant node
surface is caught, not only near-total theme-blindness.

> The node visuals must be **styled** for this to mean anything: `graph-visuals.css` is loaded via
> `src/index.css`, so the app, the mockup, and storybook all render the real `.ft-gnode` styling
> (the same npm lib-consumers get via `lib-components.css`). Without that import the story renders
> unstyled and the oracle measures inherited text colour — a blind gate.

```sh
# the gate (needs a built storybook-static + a Chrome/Chromium binary)
pnpm build-storybook
CHROME_PATH=/path/to/chrome node scripts/graph-oracle.mjs        # = pnpm oracle:graph

# the self-check: proves the gate is GREEN on a real theme flip and RED on a theme-blind
# (hardcoded-colour) pair, a byte-identical pair, and a blank pair — no storybook needed
CHROME_PATH=/path/to/chrome node scripts/check-graph-oracle.mjs  # = pnpm oracle:graph:check
```

`graph-oracle.mjs` exits non-zero on a blank render, a size mismatch, a missing Catalog story, or a
sub-floor cross-theme delta. The `GraphThemeGate` it enforces is the **same** class the self-check
exercises (one implementation, no test-only copy), exactly as `shootdemo.mjs` and
`check-surface-gate.mjs` share `surface-gate.mjs`.

## Tool renderer coverage (5 of 6)

The trace canvas exercises **5 of 6** tool renderers:
`read` / `edit` / `bash` / `grep` / `task` — all exercised by the fixture turns.

The **webfetch** renderer (`ToolBody` branch `kind === 'webfetch'`) is **NOT** covered.
The fixture's `fetch` tool group has `count: 0`; no turn uses `kind: 'webfetch'`. This is
a known oracle-scope gap: webfetch has no app-render anchor in the mockup fixtures and is
story-only. The canonical mockup and fixtures were left exactly as-is — no fixture was
added to force this renderer. The post-extraction gate therefore covers 5/6 renderers on
the trace canvas; webfetch coverage requires a dedicated story.

## Reproduce

With the demo dev server running on `:5180` (`pnpm dev`) and a Chrome/Chromium binary:

```sh
# capture per-theme into a temp dir (script output: <surface>.png per theme)
CHROME_PATH=/path/to/chrome node scripts/shootdemo.mjs dark  out/dark
CHROME_PATH=/path/to/chrome node scripts/shootdemo.mjs light out/light
```

`shootdemo.mjs` writes `<surface>.png` per theme; these baselines flatten that to
`<surface>-<theme>.png` (via `cp "$f" "baselines/prelift/${base}-${theme}.png"`).

## Pre/post imgdiff invocation (exact)

Run AFTER the post-extraction `shootdemo` run has written after-sets. The `AFT` directory
must be structured as `<surface>-<theme>.png` (same naming as this baseline dir):

```sh
# dark surfaces
BASE=baselines/prelift AFT=<path/to/after> CHROME_PATH=/path/to/chrome \
  node scripts/imgdiff.mjs dark \
  app-1-transcript-dark txn-highlights-dark txn-scorecard-dark \
  txn-trace-canvas-dark txn-scrubber-dark txn-rails-dark \
  txn-label-popover-dark txn-graph-dark txn-diffs-dark \
  txn-files-dark txn-annotations-dark

# light surfaces
BASE=baselines/prelift AFT=<path/to/after> CHROME_PATH=/path/to/chrome \
  node scripts/imgdiff.mjs light \
  app-1-transcript-light txn-highlights-light txn-scorecard-light \
  txn-trace-canvas-light txn-scrubber-light txn-rails-light \
  txn-label-popover-light txn-graph-light txn-diffs-light \
  txn-files-light txn-annotations-light
```

`imgdiff.mjs` exits non-zero on any SKIP (missing png in AFT), DIM (dimension mismatch),
hard DIFF (worst > 0.5%), or zero-compared run — so a passing gate requires all 11
surfaces to compare cleanly in both themes.

## imgdiff TOL semantics

`TOL=16` means "no pixel differs by more than 16/255 per channel" — it tolerates
sub-pixel anti-aliasing shimmer from font rendering. A result of `0 diff px` (reported
as IDENTICAL) means **no pixel exceeded the tolerance**; it is NOT a byte-identical
comparison. Whole-row shifts or layout changes produce many differing pixels and will
exceed the 0.5% hard-fail threshold. The `prefers-reduced-motion` emulation in
`shootdemo.mjs` eliminates CSS animation jitter, making captures deterministic across
runs on the same machine.

## Output path convention

`shootdemo.mjs` default output is `/tmp/demo-<theme>` (matches the other screenshot
scripts). The committed baselines use a flat `<surface>-<theme>.png` layout under
`baselines/prelift/`. `imgdiff.mjs` default paths (`shots/baseline-<theme>/`) are for
the design-token shot pairs; the transcript gate uses `BASE=baselines/prelift` and a
flat `<surface>-<theme>.png` naming in the AFT dir (see invocation above).

# Test gate: parallel lanes and the Vitest pilot

`pnpm test:lib` is the required library gate. It preserves the ordered command
list in `scripts['test:lib:serial']` and executes the expanded leaves through
`scripts/run-test-lib.mjs` in bounded parallel lanes.

## Running

```sh
pnpm test:lib                 # keep going and report every failure locally
pnpm test:lib -- --fail-fast  # stop scheduling after the first failure (CI default)
pnpm test:lib -- --lane pure  # one lane, for focused debugging
pnpm test:lib -- --list       # print the expanded lanes without running
pnpm test:lib -- --json out.json
```

The runner expands every nested `pnpm <script>` in `test:lib:serial`, deduplicates
exact duplicate leaves, and classifies each leaf from the command shape and the
real test file's imports. A gate that is added to the serial chain is picked up
without a second hand list.

## Lanes

| lane | concurrency | weight | gates |
| --- | --- | --- | --- |
| `contract` | 2 | 1 | `tsc` contract programs |
| `guard` | 3 | 1 | source, token, contrast, and provenance scans |
| `pure` | 6 | 1 | Node-only fixture and source tests |
| `ssr` | 3 | 1 | built-export and static-render tests |
| `mounted` | 2 | 3 | Vite + jsdom mounts and browser probes |
| `mutation` | 3 | 2 | mutation orchestrators in their own child processes |
| `source-mutation` | 1 | 8 | gates that rewrite a tracked source file and restore it |
| `pack` | 1 | 1 | tarball and packed-content checks (shared pnpm store) |
| `bench` | 1 | 8 | the timing benchmark (absolute ceilings, so it runs alone) |
| `vitest` | 1 | 1 | the Vitest pilot project |

A weighted semaphore (capacity 8) bounds total memory across lanes. The
`source-mutation` lane holds the whole budget, so `timeline-a11y`,
`timeline-ghosts`, and `timeline-highlight` cannot expose a half-applied
`src/ui/graph` mutation to a reader such as `insight-panel`. A post-run `src/`
snapshot also fails the gate if a timed-out mutation left a tracked file
changed. `scripts/run-test-lib.test.mjs` keeps that inventory honest and pins
the lane classification.

## Fairtest mounted rows

`playwright.fairtest.config.mjs` is now `fullyParallel: true` with
`FAIRTEST_MOUNTED_WORKERS` workers (default
`FAIRTEST_DEFAULT_MOUNTED_WORKERS`, 4). Each Playwright worker starts its own
adapter-managed static server on an OS-assigned loopback port, so workers do not
share an origin and a foreign local server cannot occupy a worker's port. The
config declares no `use.baseURL`: rows navigate by the running worker's absolute
`driver.baseUrl`, so a relative navigation cannot attach to a fixed port no
worker owns. The run root is still one immutable envelope: every row writes a
row-keyed `producer/<row-key>/` directory, so no worker can overwrite another
worker's evidence.

`pnpm test:fairtest:mounted -- --target=all` runs both journeys in one
invocation. `--target=product` and `--target=component` remain for focused local
runs. The required CI step uses `--target=all`; the verifier reads all 24 rows.
The declared Fairtest budget dropped from 24 to 12 minutes, and the mounted-row
stage from 18.5 to 6.5 minutes, after the measurements below.

## Vitest pilot

`vitest.config.mjs` runs three files:

- `src/ui/closed-value.test.js`: the ordinary Node test, now a native Vitest
  file.
- `vitest/mounted/outcome-chip.test.jsx`: a real jsdom mount of
  `TranscriptOutcomeChip.jsx` through Vitest's Vite React transform.
- `vitest/mutation/page-headings.test.mjs`: the mutation orchestrator as a
  subprocess, proving the run keeps its per-mutant process isolation.

The rest of the library gate still runs as subprocesses. Most remaining fixture
scripts call `process.exit()` and are spawned by the mutation orchestrators, so
they must keep their standalone entrypoints until the mutation harness itself
moves. That is the follow-up milestone, not this pilot. `pnpm test:gates` also
includes `pnpm test:vitest`, so the focused aggregate still covers the
closed-value test after it moved off `node --test`. The mutation pilot
deliberately re-runs one mutation gate; that duplicate cost is the pilot's only
overhead.

## Measurements

Measured on a Linux workstation on 2026-11-10. The pre-change `test:lib` baseline is
the integrated `test:lib` time recorded in fairtrade-design-system#205; the
Fairtest serial comparison was re-run on the same checkout and build.

| run | wall clock | notes |
| --- | --- | --- |
| `test:lib`, pre-change | 14m31s | recorded in #205; different machine |
| `test:lib`, parallel lanes | 6m38s | 146 gates, 0 failed |
| Fairtest mounted, serial (1 worker, product then component) | 2m32s | 1:42 + 49s |
| Fairtest mounted, parallel (`--target=all`, 4 workers) | 43-49s | 24/24 rows, verifier pass |

The product rows are the long pole at roughly 25-32 seconds each; four workers
let all four product routes overlap, while the twenty component rows fill the
remaining capacity.

## Known limitation

`scripts/journey/lib/journey-compat.test.mjs` asserts the literal
`http://localhost:5180/?fb=off`, while `scripts/journey/app-validate.journey.mjs`
builds that URL from a template literal. The assertion fails on `main` before
this change and is not part of required CI. It is left untouched here to keep
this gate change scoped.

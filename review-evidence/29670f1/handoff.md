# Frozen final navigation correction

**Head: `29670f1f3c79010b3d2b57d9fe31413c80fc287c`**, parent `507b40c35117506061810e091e98e688df28962a`.
Local commit: `fix(transcript): separate positioning from action selection`.
Clean sole-owned worktree: `/home/minttea/dev/peasant-labs/fairtrade-design-system/fairtrade-201--fix--release-validation`.

Integrate only into **existing PR200** (`fix--turn-row-column`). No push, merge, tag, replacement PR, consumer change, child agent, task/finding closure or fabricated assignment operation was performed. Candidate is frozen for fresh **round 3 of the maximum 3**; no automatic fourth wave. Supervisor owns integration, evidence publication, independent review, exact integrated-head CI, merge and automated release verification. No implementation blocker remains; review is still required, not claimed passed.

## Exactly two repairs

1. `https://github.com/peasant-labs/fairtrade-design-system/01a17fa4-f8cc-71cb-b6ca-25caa7688f6a`: internal reveal requests carry `select` (default true). `applyInitialPosition` passes `select:false`; the existing shared effect still resolves/reveals/waits for/scrolls the rendered row, but uses automatic scrolling and skips `selectTurn` and its navigation lock for positioning. Deliberate search/jumps still select the original source. No public prop, route/history policy or new owner was added; existing scroll-spy/initial-position machinery is unchanged.
   - Existing named tool/Think initial cases now record callback `[]`, history `[]`, automatic scroll, output/list disclosure and independently controlled active turn 0. Ordinary prose has the same assertions. Existing search identity/destination assertions remain.
   - Meaningful RED before production change: relocated initial tool emits `[3]` instead of `[]` (`initial-red.log`). GREEN: `initial-green.log` and final `focused.log`/`library.log`. New production mutant removing the selection guard is killed at `positioning must not select`.
2. `https://github.com/peasant-labs/fairtrade-design-system/01a17fa7-224d-7cce-bb2e-8e9938d54fae`: only when the active source is absent from eligible cards, step in original transcript insertion order and choose the directional eligible neighbor, with the existing boundary clamp. Original action selection is retained until the keypress. No group-owner substitution, restored blank card or normal-card path change.
   - Six small named sequences in the existing YAML exercise actual search -> Escape -> stream focus -> j/k/arrows. Source7 forward8/backward6, source3 forward5/backward2, Think source4 in both directions, normal reversal, first/last clamps and filtered prompts are covered.
   - Meaningful RED before the absent-card branch: first j from source7 selects0 instead of8 (`keyboard-red.log`). GREEN: `ownership-green.log` and final gates. New production mutant disabling the branch is killed at `selects directional eligible neighbor`.

The only production file is `TranscriptViewer.jsx`: 20 changed lines, including the 10-line absent-card branch. No CSS, adapter, grouping/disclosure lifecycle, motion/rail, public schema/API, package metadata or dependency changes. **B4/B5 remain explicitly user-deferred release obligations.** No new B4/B5 effort, browser test, runner, fixture project or capture matrix was added in this correction; retained existing tests ran normally.

## Five changed files

- `src/ui/transcript/TranscriptViewer.jsx`: the two internal navigation fixes.
- `scripts/transcript-action-ownership.test.mjs`: extend existing mounted-source initial assertions and execute named keyboard sequences through real production events.
- `scripts/testdata/transcript-action-ownership.yaml`: initial expectations/prose parity and six small keyboard sequences, sharing the existing payload.
- `scripts/testdata/transcript-action-ownership.manifest.yaml`: required names for those cases.
- `scripts/testdata/transcript-ledger-turns.manifest.yaml`: two designated production mutants plus their required names. Existing mutation targets/assertions remain unchanged.

`changed-files.txt` is the machine-readable inventory. No source changes after the full gates or commit. Working tree remains clean.

## Final-byte checks

Logs are under `/tmp/opencode/txn-ledger/worker-round3/`. Node v26.3.0, pinned pnpm11.24.0; no install needed. All artifact writers were serialized and awaited to actual completion. Every final canonical gate passed first attempt; only the intentionally failing RED regressions failed. No gate, retry, Axe, contrast, contract, breakpoint, structured-highlighter or provenance assertion was weakened.

| Command | Result | Seconds | Receipt |
| --- | --- | ---: | --- |
| Focused chain below | PASS | 165 | `focused.log`, `focused-time.txt` |
| `pnpm prepack` | PASS, types/library build and all20 exports in217 packed files | 6 | `prepack.log` |
| `pnpm test:lib` | PASS complete canonical suite/mutations/package checks | 762 | `library.log` |
| `pnpm build` | PASS canonical root dist, both-theme contrast | 2 | `app.log` |
| `pnpm build-storybook` | PASS | 6 | `storybook.log` |
| `CI=1 JOURNEY_APP_PORT=15358 JOURNEY_SB_PORT=16358 pnpm journey:ci --workers=4` | **316 passed,56 expected skips,0 flaky,0 unexpected** | 317 | `journeys.log`, `journey-report.json`, `journey-summary.json` |
| `git diff --check`, changed-file internal-taxonomy grep | PASS | <1 | precommit inspection |
| Impeccable context/harden + final mechanical detector on Viewer | incumbent visuals preserved; detector `[]` | bounded | `impeccable-detect.json` |

Focused chain, in exact order: `pnpm test:transcript-ledger-turns`; `pnpm test:transcript-ledger-turns:mutations` (**27 killed**, including both new mutants); `pnpm test:transcript-initial-position`; `pnpm test:transcript-initial-position:render` (positioning plus12 trace-tab cases); `pnpm test:transcript-initial-position:mutations` (**41 killed**); `pnpm test:timeline-navigation` (6 action families); `pnpm test:contract`.

The 56 skips are the unchanged nonmatching-theme cross-product exclusions, not absent theme coverage; exact inventory is in `journey-summary.json`. Existing Node localStorage/npm environment warnings and documented report-only supplementary amber-dim contrast warnings remain visible; all required contrast pairs pass. No gate was cancelled or repeated after success for unchanged source.

Manual production-path inspection: initial-position readiness -> internal nonselecting reveal -> mounted ModelActions/Thinking output -> existing disclosure settlement -> rendered action ref -> automatic scroll, without selecting. Search -> same path with selecting default -> source identity -> Escape/stream key handler -> absent-card source-order neighbor -> existing `jumpTo`/`selectTurn` and navigation lock. Normal card stepping and manual-scroll release are unchanged. No TODO/test-only production export or fake dependency path was introduced.

## Refreshed mounted evidence

Reused the existing external capture script with only its output directory changed. Same18 states: dark/light, desktop1440x1000/phone390x844; reading, retained Think/two tools after parent hide/reopen (desktop compact on/off), Bash and relocated search; desktop also collapsed sidebars. Captured canonical `dist` after the exact committed head at preview `http://127.0.0.1:15359`; preview stopped afterward. No DOM/CSS/theme rewriting, masks or flagged-control hiding.

All18 PNGs were individually inspected. Full persistent chrome/footer/body, boxed outputs and actual root/viewer themes are present. Search shows the actual relocated gamma command/output and retained later prose card. **All18 images are byte-identical to the independently reviewed prior captures**, now backed by the new served bundle/head (`prior-capture-comparison.json`). This is retained-visual evidence, not a claim static shots prove selection callbacks or temporal behavior; direct production-event regressions and canonical journeys supply those checks.

`/tmp/opencode/txn-ledger/worker-round3/captures/{dark,light}-{desktop-{reading,thinking,bash,sidebar,search},phone-{reading,thinking,bash,search}}.png`

`captures/provenance.json` records exact source head/worktree, canonical build directory, real rendered themes/computed metrics, browser, URLs and served/local byte-equal hashes; errors `[]`. `captures.sha256`, `capture.mjs`, `capture.log` and `capture-server.log` are external/untracked. Build provenance:

- HTML: `fe384716f83fcacea795d36eac5f10458455a3e16d2db94d3339e10b8fe9bc1f`.
- `/assets/index-Bud8vKb0.js`: `263461775d9f8ea2953dfd0ccb30cf495045740a1cd26abc3ea84ea893e06d79`.
- `/assets/index-CS6ELrNR.css`: `9569a899655f6337777f38843420b5fb1e1918366a216f49bc5f430e2d42ab22` (unchanged CSS).

No physical-phone or additional browser-engine claim; phone is the existing emulated bundled Chromium viewport/touch capture. No new browser matrix or deferred proof obligation.

## Live preflight / handoff limits

Read-only preflight2026-10-27 23:48Z (`preflight-final.log`): existing PR200 OPEN at prior remote head507b40c, base main7157a73efad002f03cca9ca281ffe98e1368dcb5. Latest release/npm0.0.47; candidate npm0.0.48 and tag fairtrade-v0.0.48 absent (expected404), no collision. These are timestamped observations, not publication claims.

Ready for integration and final fresh round3 review; not self-approved. Supervisor owns durable screenshot hosting, current integrated-head CI, existing-PR merge and automated release/npm verification. Peasant/Village still wait for publication; no local links or consumer edits. Findings/tasks remain open for supervisor closure only. Candidate is frozen; worker remains available for feedback without unrequested edits.

# Corrected Fairtrade candidate for fresh review

Final head: **507b40c35117506061810e091e98e688df28962a**. Parent: f4370ad3e559c1529414aa6253be2d3d8d5dc31d.
Commit: `fix(transcript): preserve action state ownership and reveal destinations`.
Clean sole-owned checkout: `/home/minttea/dev/peasant-labs/fairtrade-design-system/fairtrade-201--fix--release-validation`.
Integrate into the original **PR200**, branch `fix--turn-row-column`, for fresh round 2 of 3. No replacement PR, push, merge, tag, consumer edit, task/finding closure, or child agent was performed.

## Authoritative scope amendment

The user's latest amendment makes only disclosure, stable source grouping, rendered-target navigation and cheap distinct-action conservation release obligations. **B4 interrupted-height/accessibility and B5 real-overflow rail proof are explicitly user-deferred, not release requirements.** Both had already been implemented and validated before that amendment arrived, including the completed canonical gate chain. Their completed additions are retained rather than spending time undoing them for appearances, as the amendment allows. No further B4/B5 implementation, proof expansion or special capture was undertaken after the amendment. Supervisor owns recording deferral/follow-up and must not hold this release for additional B4/B5 proof.

## Required finding-to-fix mapping

- `https://github.com/peasant-labs/fairtrade-design-system/01a17f65-333a-7ac2-8630-a6b4bd9cd984` (A1/B1/C1): `ModelActions` and the standalone work panel have authoritative parent state. Parent hiding/compact changes no longer loop over captured tool maps, and stale child/expand-all state cannot force them open. New deliberate host-open/search events can reveal the ancestor. Lightweight row shells remain mounted while hidden, preserving local Think choices; never-opened expensive output remains lazy. Direct named regressions open two distinct tools plus Think, hide/reopen, exercise compact and expand-all, assert retained choices and no host child-state callbacks caused by hiding. Fresh same-match search reopens an explicitly collapsed list.
- `https://github.com/peasant-labs/fairtrade-design-system/01a17f65-33a5-73a8-8e28-29dc0af534cd` (A2/B2/C2): small internal `action-groups.js` walks original cooked turns for user boundaries, then assembles only visible projected members and anchors. Prompt/response/tag filtering cannot merge ownership or restore hidden content. Projected `displayContent` is cleared together with hidden response text. YAML cases retain three genuinely distinct groups, including an all-wordless group, through filters and restoration.
- `https://github.com/peasant-labs/fairtrade-design-system/01a17f65-3432-7954-a27f-878e70fab3ac` (A3/C3): source-index/action refs resolve the actual rendered tool/Think row. Deliberate reveal opens its list/output, waits for real disclosure motion, and scrolls that row, not just its owner or empty source article. Search includes Think. Public source identity/callbacks and existing unique turn IDs remain original; ordinary prose still navigates to its own card. Wordless `initialPosition`/host deep-link targets use the same mapping. No browser routing/history ownership was added to the library. Direct source tests plus bounded existing-runner app tests cover later-prose tools, wordless tools/Think, compact lists, repeat reveal, initial positions and more-than-a-viewport separation.
- `https://github.com/peasant-labs/fairtrade-design-system/01a17f66-9190-78ee-8678-4b8b6d44d59e` (B3): copied inline grouping data was replaced by the shared named YAML corpus. Distinct commands, output and Think markers are compared by exact per-group and global membership/multiplicity. Required-name manifests guard group/case deletion. Equal-kind/equal-duration wrong-action substitution preserves headers/counts but is killed by the content oracle. All 25 ledger production mutations pass their intended failure checks.

No CSS, wire/schema, dependency/version, host capability, consumer policy, or public routing contract change. No redesign or new test runner/service. Existing initial-position mutation anchors were updated for the new conditional destination branch, preserving their exact selection/history failure assertions.

## Checks and receipts

All paths here are relative to `/tmp/opencode/txn-ledger/worker-round2/`.
Runtime: Node v26.3.0 (repository major 26), pinned pnpm 11.24.0; existing frozen dependency tree unchanged.

| Check | Result | Time | Evidence |
| --- | --- | ---: | --- |
| New direct ownership regression on old implementation | Meaningful RED: parent with multiple open outputs refuses close | bounded | `ownership-red.log` |
| `pnpm test:transcript-ledger-turns` | PASS: 210 existing checks plus named ownership/filter/conservation/search/initial cases | bounded | `ledger-final.log` |
| `pnpm test:transcript-ledger-turns:mutations` | PASS: 25 production mutations killed, including lost source boundaries, wrong destination and count-preserving substitution | bounded | `ledger-mutations.log`; final full `library.log` |
| `pnpm prepack` | PASS: library/types, all 20 exports in 217 files | 5s | `prepack.log` |
| `pnpm test:lib` final canonical run | PASS, all types/tests/mutations/built package checks | 724s | `library.log` |
| `pnpm build` | PASS, canonical root `dist`, both-theme contrast | 2s | `app.log` |
| `pnpm build-storybook` | PASS | 6s | `storybook.log` |
| `CI=1 JOURNEY_APP_PORT=15348 JOURNEY_SB_PORT=16348 pnpm journey:ci --workers=4` | PASS: **316 passed, 56 expected theme-row skips, 0 flaky, 0 unexpected** | 314s | `journeys.log`, `journey-report.json`, `journey-summary.json` |
| `git diff --check`, changed-file taxonomy grep | PASS | bounded | inspected before commit |
| Focused Impeccable deterministic scan on changed transcript JSX | `[]` | bounded | `impeccable-detect.json` |

All artifact writers ran serially; final gates execute the exact source bytes in the committed head. Prepack's inputs are unchanged by the subsequent mutation-manifest-only anchor repair. No current-candidate gate was cancelled, bypassed, or repeated after success. Existing retries, Axe, structured-Shiki, breakpoint, contract and provenance checks remain intact. The 56 skips are the pre-existing theme/project cross-product exclusions (32 accessibility, 24 demo-truth), not omitted product themes.

### Honest failures and already-completed optional work

- First canonical library attempt failed in 18s because two initial-position mutation `find` strings still matched the old unconditional scroll line. Updated only those anchors for `else el.scrollIntoView`, keeping the same mutants and required errors. Preserved `library-stale-mutation-anchor.log`; the full retry passes.
- First focused browser run had 50 passes and two rail expectation failures: the short last response could not place the last task on the normal 40% reading line at scroll maximum. The real fixture's final response now contains named, distinct paragraphs so the terminal task can actually be read there; production geometry/styles are not forced. Final tests use the original last task and reverse to the first task. `browser-focused.log` preserves the initial diagnostic; `rail-final-green.log` proves the final terminal-task scenario.
- Optional B4 work, completed before deferral: existing height journeys now pause/reverse title, list, Bash and Think at midpoint and inspect first/mid closing painted/inert/aria-hidden/nonfocusability in both themes/preferences. A temporary production endpoint-reversal mutation failed at the intended painted-height check (42px discrepancy); delayed exit accessibility failed at first/mid `aria-hidden`. Logs: `reversal-mutation-red.log`, `inert-mutation-red.log`. These source mutations were fully restored; `Collapsible.jsx` is unchanged in this commit.
- Optional B5 work, completed before deferral: real 24-task rail overflow follows down/up without main scroll/focus changes; disabling production following fails the actual in-view assertion in both themes (`rail-mutation-red.log`). Mutation fully restored; `OutlineRail.jsx` is unchanged. The shared app fixture also supplies the required long-distance navigation test; no second runner/service or fake browser geometry.
- Existing localStorage experimental and supplementary amber-dim report-only contrast warnings remain disclosed in logs. All required contrast pairs pass. Final browser run has **no Axe retries/flakes**.

## Exact-head mounted captures

Eighteen current-head PNGs were captured and individually inspected: dark/light, desktop 1440x1000 and phone 390x844; reading, retained Think/two open tool choices after parent hide/reopen (desktop also compact on/off), Bash, actual relocated search result; desktop additionally both sidebars collapsed. Full persistent switcher/header/publish controls, selected transcript footer and mounted reading/action bodies remain present. Search screenshots visibly show `printf target-gamma` and its unique output at the real relocated row, with the later prose card still at its source. No theme forcing, masks, hidden flagged controls or CSS/DOM replacement. Static shots are not claimed as motion proof.

`/tmp/opencode/txn-ledger/worker-round2/captures/{dark,light}-{desktop-{reading,thinking,bash,sidebar,search},phone-{reading,thinking,bash,search}}.png`

`captures/provenance.json` records exact source head, absolute canonical worktree `dist`, actual rendered themes/font/grid/body metrics, browser, URLs and served/local hashes. Preview served root `dist` at `http://127.0.0.1:15349` and was stopped after capture; no separately built output. `capture.mjs`, `capture.log`, `capture-server.log`, and `captures.sha256` are external/untracked evidence.

- HTML SHA256: `80468efa238613c795b49965c039a1cf49b3843146cb3558fe4809c65747a903`.
- `/assets/index-4ll5sbKQ.js`: `5c724474d52077029bb66ca7dd2c5e80b665c7ee9b1fd8be606832b2ec2bb124`.
- `/assets/index-CS6ELrNR.css`: `9569a899655f6337777f38843420b5fb1e1918366a216f49bc5f430e2d42ab22`.
- Served/local HTML and assets match byte-for-byte; current production disclosure/sidebar/Think markers verified; no page errors. CSS hash is unchanged from the reviewed prior head.

## Exact files changed

`changed-files.txt` records the same 19 paths:

- `scripts/journey/transcript-motion.journey.mjs`
- `scripts/journey/transcript-reading.journey.mjs`
- `scripts/testdata/transcript-action-ownership.manifest.yaml`
- `scripts/testdata/transcript-action-ownership.yaml`
- `scripts/testdata/transcript-initial-position.render.manifest.yaml`
- `scripts/testdata/transcript-ledger-turns.manifest.yaml`
- `scripts/testdata/transcript-reading-browser.manifest.yaml`
- `scripts/testdata/transcript-reading-browser.yaml`
- `scripts/transcript-action-ownership.test.mjs`
- `scripts/transcript-ledger-turns.test.mjs`
- `src/mockups/inuse/TranscriptApp.jsx`
- `src/mockups/inuse/reading-fixture.js`
- `src/ui/transcript/Thinking.jsx`
- `src/ui/transcript/ToolCall.jsx`
- `src/ui/transcript/TranscriptViewer.jsx`
- `src/ui/transcript/TurnCard.jsx`
- `src/ui/transcript/WorkGroup.jsx`
- `src/ui/transcript/action-groups.js`
- `src/ui/transcript/filters.js`

## Preflight and remaining ownership

Live read-only preflight at 2026-10-27 23:00Z (`preflight-final.log`): PR200 remains OPEN at prior remote head f4370ad, title `release(v0.0.48): improve transcript reading and reversible motion`, base/main `7157a73efad002f03cca9ca281ffe98e1368dcb5`. Latest GitHub release/npm is 0.0.47; candidate npm 0.0.48 and tag fairtrade-v0.0.48 remain absent (expected 404), no collision.

No required implementation blocker remains. Supervisor integrates this local commit into existing PR200, publishes fresh durable screenshot evidence, runs fresh independent round 2 of 3 and exact integrated-head CI, then handles merge and automated release/npm verification. Workers/reviewers must use the latest narrowed required scope; already-completed optional B4/B5 work is not a reason to expand the release gate. Peasant re-pin plus release stays one later PR; Village re-pin only, both after published npm. Worker remains available for review fixes and has closed nothing.

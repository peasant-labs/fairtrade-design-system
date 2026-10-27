# Fairtrade release validation handoff

## Local result and landing target

- Final source head: `f4370ad3e559c1529414aa6253be2d3d8d5dc31d`.
- Local commit: `test: restore transcript release validation coverage`.
- Parent: `561cdb97c750a08ff79edf9d1d707648075f865f`, the already accepted mounted-demo theme fix.
- Sole-owned worktree: `/home/minttea/dev/peasant-labs/fairtrade-design-system/fairtrade-201--fix--release-validation`.
- Clean working tree after commit and captures. No production UI/CSS changes, no package metadata changes, no consumer edits.
- Integrate this local commit into existing PR200 branch `fix--turn-row-column`, retaining its local parent theme fix. This isolation branch is NOT a new PR or publication target.
- No push, merge, tag, release, task closure, or subagent launch performed by this worker. Supervisor owns independent review, durable screenshot upload, integration, current-head CI, and existing-PR publication.

## Changed files

1. `scripts/testdata/breakpoints.yaml`: one exact-condition exception for `@media (prefers-reduced-motion: no-preference) and (width >= 1080px)`, complementary to the existing rail layout boundary.
2. `scripts/testdata/breakpoints.manifest.yaml`: its required exception name; exact-name deletion protection remains intact.
3. `scripts/transcript-turn-model.test.mjs`: bind JSDOM's real `getComputedStyle` into the existing mounted globals, matching the shared mounted harness. No assertion or mutation was removed.

## Checks and timing

All logs below are under `/tmp/opencode/txn-ledger/worker-release/`.

| Command | Result | Seconds | Log |
| --- | --- | ---: | --- |
| `pnpm install --frozen-lockfile` | PASS, pinned pnpm 11.24.0, Node v26.7.0 | <1 | `install.log` |
| `node scripts/breakpoint-scale.mjs` before repair | Expected RED, exact new condition rejected | <1 | `breakpoint-red.log` |
| `node scripts/breakpoint-scale.mjs && node scripts/breakpoint-scale.test.mjs` | PASS, 15 cases, 5 source mutations killed, 44 sheets | 1 | `focused.log` |
| `pnpm prepack` | PASS, 20 export targets in 216 packed files; library type declarations built | 5 | `prepack.log` |
| `node scripts/transcript-turn-model.test.mjs && node scripts/transcript-turn-model.mutations.mjs` | PASS, 10 strict cases, 12 designated mutations killed | 21 | `turn-model.log` |
| `pnpm test:lib` final complete run | PASS, all canonical checks/types/mutations/built-package smoke | 701 | `library.log` |
| `pnpm build` | PASS, both-theme contrast and canonical root `dist` | 2 | `app.log` |
| `pnpm build-storybook` | PASS | 6 | `storybook.log` |
| `CI=1 JOURNEY_APP_PORT=15328 JOURNEY_SB_PORT=16328 pnpm journey:ci --workers=4` | Exit 0; 300 passed, 2 flaky, 56 skipped, 0 unexpected | 294 | `journeys.log` |
| `git diff --check` and changed-file taxonomy grep | PASS | <1 | inspected before commit |

Final library/app/Storybook/browser checks ran serially against the exact bytes committed in the final head. Prepack completed before the test-only JSDOM binding change; its production/build/package inputs are unchanged in the final commit. Fresh generators left no tracked diff. `gates.tsv` carries timestamped receipts.

### Disclosed interruptions, failure, flakes and skips

- First library run was cancelled by the host server restart, not treated as success. Preserved in `library-interrupted.log`; no exit status was captured. Its earlier focused/prepack successes were not rerun unnecessarily.
- Resumed library run failed after 763s at the mounted turn-model test: `getComputedStyle is not defined`. Preserved in `library-missing-computed-style.log`. The one-line harness repair fixed it; the final full canonical run passes.
- Browser first-attempt flakes: both light-project AppSidebar phone-drawer motion cases encountered `Axe is already running` from concurrent Storybook addon and explicit Axe scans. Both passed their configured retry. This is not a transcript behavior or provenance failure. No retry policy or accessibility assertion was weakened; the exact errors remain in `journey-report.json` and `journeys.log`.
- All 56 skips are the existing fixture-theme/project cross-product exclusions: 32 accessibility rows and 24 demo-truth rows skip the nonmatching project. Their matching theme rows run. Full inventories and flaky names are in `journey-summary.json`.
- Report-only contrast warnings remain the documented supplementary amber-dim tint; all required contrast pairs pass. Existing Node localStorage experimental and npm environment-config warnings remain visible in logs.

## Mounted evidence and provenance

- Route: `/?app=transcript&transcript=ledger-actions&fb=off&theme=<theme>#inuse`.
- Canonical Vite preview served this worktree's `dist` at `http://127.0.0.1:15329`; it was shut down after capture.
- Captured final committed head with bundled Chromium 153.0.8010.12: desktop 1440x1000 and phone 390x844, real dark and light root/viewer themes.
- Four desktop states per theme: reading, boxed Think, Bash input/stdout, both sidebars collapsed. Three phone states per theme: reading, boxed Think, Bash input/stdout. Fourteen PNGs, all visually inspected; the four reading images are byte-identical to the earlier inspected originals.
- Persistent product switcher, publish/header controls, selected transcript view/footer and actual transcript body are visible. Code output owns horizontal overflow on phone. Think stays boxed; Bash has `input` and one `$`, without a redundant input-box icon. Provider marks and proportional Atkinson prose are painted. Both actual rendered themes match the root theme.
- Capture alignment scrolls only `.txn-stream`, not hidden chrome ancestors. No source DOM/style/theme rewriting, screenshot masks, or hidden flagged controls. Earlier alignment-only captures in `captures-initial/` are NOT the final review set.
- `captures/provenance.json` records source head, absolute canonical build directory, URLs, browser, rendered themes/fonts/grid/body geometry, and served/local asset hashes; `errors` is empty.
- HTML SHA256: `60f564683b1dba3e7eb7c255cb6d4a0cdb17f21982c00358928ca634a218cde4`.
- `/assets/index-Ch-thQ_j.js`: `b56cf3b99ccb3fba7d138d812e8f447d5db15ccab8f64eecbef009634a7d271e`.
- `/assets/index-CS6ELrNR.css`: `9569a899655f6337777f38843420b5fb1e1918366a216f49bc5f430e2d42ab22`.
- Served/local HTML and both assets match byte-for-byte. Current sticky disclosure, sidebar-title and thinking-box production markers were verified in that served bundle. PNG hashes are in `captures.sha256`; final source hashes in `final-source-hashes.sha256`.
- Capture script is outside tracked source at `capture.mjs`; `capture.log` and `capture-server.log` retain its result and server provenance. Screenshots remain untracked for supervisor upload to a durable screenshot side branch.

`/tmp/opencode/txn-ledger/worker-release/captures/{dark,light}-{desktop-{reading,thinking,bash,sidebar},phone-{reading,thinking,bash}}.png`

## Standing regression checklist

Read the complete standing transcript checklist and task's verbatim sidebar first-frame feedback. Final canonical library fixtures/mutations cover once-per-user-turn grouping and distinct actions; default-expanded lists/closed outputs/compact restoration; boxed Think, Bash input and header borders; hover/selection and rapid keyboard limits; unsnapped width, rail/zen state and outline following; system-filter saved-state compatibility; retained host callbacks, panels, tabs, anchors and initial positioning. No production behavior was changed by this repair.

Final built-app motion journeys passed both motion preferences and themes: disclosure interpolation/reversal, painted exit contents, immediate inert/aria-hidden semantics, first-frame sidebar content, grid-owned width, exact zen restoration and coupled title/timeline occupied space. The mounted page-theme regression passed both starting themes without resetting open Think/reader position. Screenshots supplement, not replace, those checks; static shots do not themselves prove motion. Physical-phone touch hardware was not exercised; phone evidence is emulated Chromium viewport/touch.

## Live release preflight and remaining work

At 2026-10-27 21:49Z, read-only GitHub/npm checks still showed PR200 OPEN, title `release(v0.0.48): improve transcript reading and reversible motion`, remote head `b2a46498d029f969b248ac7a44943c58e6c6ff35`, base `main`, current remote default head `7157a73efad002f03cca9ca281ffe98e1368dcb5`, latest release/npm `0.0.47`. Candidate npm `0.0.48` and tag `fairtrade-v0.0.48` remain absent (expected 404s, no collision). Exact responses and final check timestamp are in `preflight-final.log`; earlier snapshot in `preflight.log`.

No implementation blocker remains. The two disclosed unrelated Axe concurrency flakes merit supervisor/reviewer awareness. Independent review, durable screenshot hosting, integration into existing PR200, exact integrated-head CI, merge and automated release/npm verification remain supervisor obligations. Only after publication should consumers re-pin: Peasant re-pin plus release in ONE PR; Village re-pin only. No unpublished/local-link consumer shortcut was used.

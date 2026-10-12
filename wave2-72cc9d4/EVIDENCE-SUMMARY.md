# Matched published baseline versus final candidate

- BEFORE: 4ee5362e0e53942675d7ced8bfb778b447a17531, isolated git archive, app-only Vite build using workspace Nix Node 26.3.0 and the existing installed dependencies. No library/Storybook/catalog build.
- AFTER: 72cc9d4a71d39f7f6968e669b13efa463b02f8b2, clean source worktree and existing final dist. Port 5198 was no longer listening, so fresh owned preview servers 5267/5268 served the two explicit dist directories; both were terminated in finally.
- Every served index and CSS/JS asset equalled its local artifact bytes. AFTER CSS/JS hashes also equalled the prior final-head provenance in wave2-candidate-fix, not the earlier candidate. Full hashes and exact routes/states/scroll positions/font readbacks are in manifest.json.
- Same actual rendered dark/light themes, 390/1440 widths, 900px viewport height, existing journey frozen clock/randomness, reduced motion, real fixture data, real interactions. Fonts awaited. Four comparisons, with initial/filter table states: 40 original PNGs and 20 labeled side-by-side PNGs.

## Observed differences

- Expanded Bash description and task reading text: measured 14px before, 16px after, all four theme/width pairs. Larger output/chrome, calmer action highlights, turn disclosure controls and collapsed tool-filter subgroup are visible in the final transcript. At phone width the named app-switcher and wrapped transcript chrome consume more vertical space than before; this is visible, not hidden from evidence.
- Checked automatic-publish consent: before the host hint reads `same collectives · change it in settings`; after the explicit canonical sentence includes new sessions, updates to already-published sessions, redaction and publishing without review. Both captures wait for the real scan-complete state (9 matches, all redacted) before checking the checkbox.
- Collective table: same five actual rows; final persistent footer shows `showing 5 of 248`. Search `flaky` leaves one real row and shows `showing 1 of 5 loaded`; clearing the chip restores the host-total count (asserted).

## Limits and inspection

- BEFORE has no table search/filter controls. The filtered pair labels it `filter absent` and retains the original unfiltered table. No fake before DOM or synthetic feature was introduced.
- Scroll alignment is semantic: the same expanded reading and the same table start, using the same scrollIntoViewIfNeeded action. Numerical stream offsets differ because typography/reflow changed; the manifest records them. These are not pixel-identical content positions, nor pixel-diff scores.
- Full mounted in-use shell plus body is captured; presentation-site navigation outside that shell is not the comparison subject. On mobile the larger sticky transcript header means task/tool context above the reading target can be outside the reading viewport. Horizontal code/tool-data clipping remains visible rather than disguised.
- All 20 final labeled pairs were inspected individually. The four filter pairs were re-inspected after adding the explicit absent-feature label. Both expected themes, genuine states and shell/body were present; no blank capture. This focused evidence does not substitute for the previously completed gate catalog or constitute approval to publish/merge.
- No collapsed-search comparison was fabricated: that capability did not exist in the published baseline. No earlier 5e8490 build/capture is labeled final.

## Execution record

- Initial pnpm exec app-build invocation refused the reused node_modules symlink through pnpm's safe-directory check. Nothing was removed; direct pinned Node invocation of the existing Vite CLI built the archive successfully once.
- Two initial capture attempts stopped on capture-script shell-selector assumptions (transcript has the shared app bar, not section subnav; active-tab selector must scope to that app bar). Only the temporary capture script was corrected, not production DOM/styles/tests. Final focused run passed.
- One bounded publish-only recapture waited for real scan completion and corrected composition labels. No full build or full gates repeated.
- Final source git status --porcelain empty; git diff --check passed; HEAD unchanged. No tracked files changed, no commit, push, merge, release, GitHub upload or task closure. All artifacts are transient local files in this directory.

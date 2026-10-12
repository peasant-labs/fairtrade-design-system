# Phone composition — final worker handoff

Prior blocker resolved under the supervisor's explicit authorization. No remaining focused verification blocker. Ready for supervisor consolidation with the CI leaf and the ONE authorized full reviewer-openai round; no review dispatched by worker, no task closed, no UAT/publication-green assertion.

## Commits and files
Worktree `/home/minttea/dev/peasant-labs/fairtrade-design-system/fairtrade-design-system-116--wave2-visual-fix`, final HEAD `4e169442613b8f74a94ff4f6aa76772347018911`, clean.
- `ade67fe8c2b676a2869af409d362be69b3f23194`: compact accessible phone chrome and authorized mobile-layout contract.
- `2bfddf53ccbbb797046100c8c55ecc99ba393fb6`: conditional narrow map scroll-row correction, activated by fresh regression probe.
- `cc0fee0378cd14262cc12a9cd4cedb592f124941`: map stylesheet-order sizing specificity.
- `4e169442613b8f74a94ff4f6aa76772347018911`: authorized responsive pagination journey contract, test-only.
Changed files: `src/index.css`, `src/ui/transcript/TranscriptViewer.jsx`, `scripts/testdata/mobile-layout-invariants.yaml`, `scripts/testdata/mobile-layout-invariants.manifest.yaml`, `scripts/journey/datatable.journey.mjs`.

Final journey change retains every row, count and filter/restore assertion. The real DOM buttons remain asserted disabled and page state remains `page 1 of 1` in ALL widths. At <=720, footer has exactly one visible child with role=status and no exposed previous/next controls. Desktop still asserts visible disabled navigation. A phantom enabled button, extra visible page/navigation, incorrect count, or page state now fails explicitly; no muted rows or fixture deletions.

## Exact commands and results
All repo commands below run from the isolated worktree. DevShell prefix is required.
```
nix develop /home/minttea/dev/peasant-labs --command sh -c 'pnpm test:datatable && pnpm test:mobile-layout && pnpm exec tsc -p tsconfig.lib.json && pnpm journey:ci --grep "host total"'
```
PASS: focused DataTable source/render checks; mobile-layout required-name guard; library typecheck; **all six formerly failing host-total journey rows** (three consumer routes x both themes) pass across fixture widths. Log: `/tmp/opencode/phone-composition/contract-rows.log`.
```
nix develop /home/minttea/dev/peasant-labs --command pnpm journey:ci --grep 'dense|publish|datatable'
```
PASS: **46/46**, both themes, 3.0m. Log: `/tmp/opencode/phone-composition/contract-focused.log`. An initial 180s attempt timed out after 45 rows; the complete 300s-budget rerun finished green from the committed checkout. No suppressed error or partial-pass claim.
```
nix develop /home/minttea/dev/peasant-labs --command sh -c 'pnpm build && pnpm gen:check && pnpm test:mobile-layout && pnpm test:transcript-header-condense && pnpm test:datatable && pnpm lint:css && pnpm exec tsc -p tsconfig.lib.json'
nix develop /home/minttea/dev/peasant-labs --command node /tmp/opencode/phone-composition/capture.mjs
nix develop /home/minttea/dev/peasant-labs --command node /tmp/opencode/phone-composition/inspect.mjs
nix develop /home/minttea/dev/peasant-labs --command node /tmp/opencode/phone-composition/probe.mjs
git diff --check
git status --short
```
Earlier production-build/generation/contrast, mobile/header/table/CSS/type gates passed (`final-checks.log`). Capture passed 96 originals/48 matched pairs; computed/real-interaction probes passed (`capture.log`, `confirm.log`, `probes.json`). Named mutation `metadata scroll row wraps` killed by `txn-meta-scrolls-on-mobile`, source restored. Final diff whitespace and tree checks pass. Full catalog was not rerun (focused-only scope); build-storybook succeeded for focused mounted component journeys.

## Evidence and preserved invariants
Fresh fix BEFORE = archived/built `72cc9d4a71d39f7f6968e669b13efa463b02f8b2`, including 320; actual final production AFTER = `cc0fee0378cd14262cc12a9cd4cedb592f124941`. The new HEAD adds only a test contract and does NOT change served production bytes or screenshots; no reinspection necessitated by a rendering change. Prior final inspection covers every changed surface at 320/390 actual dark/light and 1440 controls. Provenance manifest records byte-verified served HTML/JS/CSS hashes, route/theme, deterministic clock/random and fonts-ready; current built assets verified unchanged against recorded hashes. W1 `4ee5362` remains separate under `/tmp/opencode/wave2-before-after`, with fresh `map-oracle-*` reference probes, never mislabeled as fix BEFORE.

Worker assessment: targeted phone cases better; desktop preserved except intentional improved consent separation. Full title remains 22px and wraps, no shrink/clamp; reading16/mono14 retained, named compact app tiles and scroll-row keyboard reachability retained; table filters work with truthful loaded-subset counts and total restored on removal. Search real trigger places bar below header before/after query, no overlap. >=24px compact tiles and primary actions verified; existing coarse-pointer primary 44px floors verified in both themes at 320/390. Consent gap 8px, head/body/foot insets unchanged at16px. No new API, source harness, design-record edit, consumer edit, or other worktree edit.

Capture set (one path expression, every expansion exists):
`/tmp/opencode/phone-composition/{transcript-tool,transcript-task,transcript-header,transcript-search,publish-consent,table-initial,table-filter,map-spatial}-pair-{dark,light}-{320,390,1440}.png`

Artifacts transient/untracked; supervisor owns durable PR-hosted publication and consolidated-build verification. These focused Chromium captures do not claim Safari/physical-device proof, independent review acceptance, or a whole-CI green result. No push, merge, task closure, review budget use, or publication operation.

## Per-case inspection checklist
The following unchanged 48-row checklist is carried forward from the inspected final production build. It includes every matched route/state, viewport, theme, BEFORE/AFTER image and verdict; app-bar composition inspected in each case. Desktop controls honestly marked unchanged where appropriate.
| surface/state | route | width | theme | BEFORE | AFTER | verdict |
|---|---|---:|---|---|---|---|
| transcript-tool | ?fb=off&app=transcript&theme=dark#inuse | 320 | dark | /tmp/opencode/phone-composition/transcript-tool-before-dark-320.png | /tmp/opencode/phone-composition/transcript-tool-after-dark-320.png | better (targeted phone composition) |
| transcript-task | ?fb=off&app=transcript&theme=dark#inuse | 320 | dark | /tmp/opencode/phone-composition/transcript-task-before-dark-320.png | /tmp/opencode/phone-composition/transcript-task-after-dark-320.png | better (targeted phone composition) |
| transcript-search | ?fb=off&app=transcript&theme=dark#inuse | 320 | dark | /tmp/opencode/phone-composition/transcript-search-before-dark-320.png | /tmp/opencode/phone-composition/transcript-search-after-dark-320.png | better (targeted phone composition) |
| transcript-header | ?fb=off&app=transcript&theme=dark#inuse | 320 | dark | /tmp/opencode/phone-composition/transcript-header-before-dark-320.png | /tmp/opencode/phone-composition/transcript-header-after-dark-320.png | better (targeted phone composition) |
| publish-consent | ?fb=off&&theme=dark#inuse | 320 | dark | /tmp/opencode/phone-composition/publish-consent-before-dark-320.png | /tmp/opencode/phone-composition/publish-consent-after-dark-320.png | better (targeted phone composition) |
| table-initial | ?fb=off&app=commons&commons=collective-detail&theme=dark#inuse | 320 | dark | /tmp/opencode/phone-composition/table-initial-before-dark-320.png | /tmp/opencode/phone-composition/table-initial-after-dark-320.png | better (targeted phone composition) |
| table-filter | ?fb=off&app=commons&commons=collective-detail&theme=dark#inuse | 320 | dark | /tmp/opencode/phone-composition/table-filter-before-dark-320.png | /tmp/opencode/phone-composition/table-filter-after-dark-320.png | better (targeted phone composition) |
| map-spatial | ?fb=off&app=graph&section=map&theme=dark#inuse | 320 | dark | /tmp/opencode/phone-composition/map-spatial-before-dark-320.png | /tmp/opencode/phone-composition/map-spatial-after-dark-320.png | better (targeted phone composition) |
| transcript-tool | ?fb=off&app=transcript&theme=light#inuse | 320 | light | /tmp/opencode/phone-composition/transcript-tool-before-light-320.png | /tmp/opencode/phone-composition/transcript-tool-after-light-320.png | better (targeted phone composition) |
| transcript-task | ?fb=off&app=transcript&theme=light#inuse | 320 | light | /tmp/opencode/phone-composition/transcript-task-before-light-320.png | /tmp/opencode/phone-composition/transcript-task-after-light-320.png | better (targeted phone composition) |
| transcript-search | ?fb=off&app=transcript&theme=light#inuse | 320 | light | /tmp/opencode/phone-composition/transcript-search-before-light-320.png | /tmp/opencode/phone-composition/transcript-search-after-light-320.png | better (targeted phone composition) |
| transcript-header | ?fb=off&app=transcript&theme=light#inuse | 320 | light | /tmp/opencode/phone-composition/transcript-header-before-light-320.png | /tmp/opencode/phone-composition/transcript-header-after-light-320.png | better (targeted phone composition) |
| publish-consent | ?fb=off&&theme=light#inuse | 320 | light | /tmp/opencode/phone-composition/publish-consent-before-light-320.png | /tmp/opencode/phone-composition/publish-consent-after-light-320.png | better (targeted phone composition) |
| table-initial | ?fb=off&app=commons&commons=collective-detail&theme=light#inuse | 320 | light | /tmp/opencode/phone-composition/table-initial-before-light-320.png | /tmp/opencode/phone-composition/table-initial-after-light-320.png | better (targeted phone composition) |
| table-filter | ?fb=off&app=commons&commons=collective-detail&theme=light#inuse | 320 | light | /tmp/opencode/phone-composition/table-filter-before-light-320.png | /tmp/opencode/phone-composition/table-filter-after-light-320.png | better (targeted phone composition) |
| map-spatial | ?fb=off&app=graph&section=map&theme=light#inuse | 320 | light | /tmp/opencode/phone-composition/map-spatial-before-light-320.png | /tmp/opencode/phone-composition/map-spatial-after-light-320.png | better (targeted phone composition) |
| transcript-tool | ?fb=off&app=transcript&theme=dark#inuse | 390 | dark | /tmp/opencode/phone-composition/transcript-tool-before-dark-390.png | /tmp/opencode/phone-composition/transcript-tool-after-dark-390.png | better (targeted phone composition) |
| transcript-task | ?fb=off&app=transcript&theme=dark#inuse | 390 | dark | /tmp/opencode/phone-composition/transcript-task-before-dark-390.png | /tmp/opencode/phone-composition/transcript-task-after-dark-390.png | better (targeted phone composition) |
| transcript-search | ?fb=off&app=transcript&theme=dark#inuse | 390 | dark | /tmp/opencode/phone-composition/transcript-search-before-dark-390.png | /tmp/opencode/phone-composition/transcript-search-after-dark-390.png | better (targeted phone composition) |
| transcript-header | ?fb=off&app=transcript&theme=dark#inuse | 390 | dark | /tmp/opencode/phone-composition/transcript-header-before-dark-390.png | /tmp/opencode/phone-composition/transcript-header-after-dark-390.png | better (targeted phone composition) |
| publish-consent | ?fb=off&&theme=dark#inuse | 390 | dark | /tmp/opencode/phone-composition/publish-consent-before-dark-390.png | /tmp/opencode/phone-composition/publish-consent-after-dark-390.png | better (targeted phone composition) |
| table-initial | ?fb=off&app=commons&commons=collective-detail&theme=dark#inuse | 390 | dark | /tmp/opencode/phone-composition/table-initial-before-dark-390.png | /tmp/opencode/phone-composition/table-initial-after-dark-390.png | better (targeted phone composition) |
| table-filter | ?fb=off&app=commons&commons=collective-detail&theme=dark#inuse | 390 | dark | /tmp/opencode/phone-composition/table-filter-before-dark-390.png | /tmp/opencode/phone-composition/table-filter-after-dark-390.png | better (targeted phone composition) |
| map-spatial | ?fb=off&app=graph&section=map&theme=dark#inuse | 390 | dark | /tmp/opencode/phone-composition/map-spatial-before-dark-390.png | /tmp/opencode/phone-composition/map-spatial-after-dark-390.png | better (targeted phone composition) |
| transcript-tool | ?fb=off&app=transcript&theme=light#inuse | 390 | light | /tmp/opencode/phone-composition/transcript-tool-before-light-390.png | /tmp/opencode/phone-composition/transcript-tool-after-light-390.png | better (targeted phone composition) |
| transcript-task | ?fb=off&app=transcript&theme=light#inuse | 390 | light | /tmp/opencode/phone-composition/transcript-task-before-light-390.png | /tmp/opencode/phone-composition/transcript-task-after-light-390.png | better (targeted phone composition) |
| transcript-search | ?fb=off&app=transcript&theme=light#inuse | 390 | light | /tmp/opencode/phone-composition/transcript-search-before-light-390.png | /tmp/opencode/phone-composition/transcript-search-after-light-390.png | better (targeted phone composition) |
| transcript-header | ?fb=off&app=transcript&theme=light#inuse | 390 | light | /tmp/opencode/phone-composition/transcript-header-before-light-390.png | /tmp/opencode/phone-composition/transcript-header-after-light-390.png | better (targeted phone composition) |
| publish-consent | ?fb=off&&theme=light#inuse | 390 | light | /tmp/opencode/phone-composition/publish-consent-before-light-390.png | /tmp/opencode/phone-composition/publish-consent-after-light-390.png | better (targeted phone composition) |
| table-initial | ?fb=off&app=commons&commons=collective-detail&theme=light#inuse | 390 | light | /tmp/opencode/phone-composition/table-initial-before-light-390.png | /tmp/opencode/phone-composition/table-initial-after-light-390.png | better (targeted phone composition) |
| table-filter | ?fb=off&app=commons&commons=collective-detail&theme=light#inuse | 390 | light | /tmp/opencode/phone-composition/table-filter-before-light-390.png | /tmp/opencode/phone-composition/table-filter-after-light-390.png | better (targeted phone composition) |
| map-spatial | ?fb=off&app=graph&section=map&theme=light#inuse | 390 | light | /tmp/opencode/phone-composition/map-spatial-before-light-390.png | /tmp/opencode/phone-composition/map-spatial-after-light-390.png | better (targeted phone composition) |
| transcript-tool | ?fb=off&app=transcript&theme=dark#inuse | 1440 | dark | /tmp/opencode/phone-composition/transcript-tool-before-dark-1440.png | /tmp/opencode/phone-composition/transcript-tool-after-dark-1440.png | unchanged desktop control (no regression) |
| transcript-task | ?fb=off&app=transcript&theme=dark#inuse | 1440 | dark | /tmp/opencode/phone-composition/transcript-task-before-dark-1440.png | /tmp/opencode/phone-composition/transcript-task-after-dark-1440.png | unchanged desktop control (no regression) |
| transcript-search | ?fb=off&app=transcript&theme=dark#inuse | 1440 | dark | /tmp/opencode/phone-composition/transcript-search-before-dark-1440.png | /tmp/opencode/phone-composition/transcript-search-after-dark-1440.png | unchanged desktop control (no regression) |
| transcript-header | ?fb=off&app=transcript&theme=dark#inuse | 1440 | dark | /tmp/opencode/phone-composition/transcript-header-before-dark-1440.png | /tmp/opencode/phone-composition/transcript-header-after-dark-1440.png | unchanged desktop control (no regression) |
| publish-consent | ?fb=off&&theme=dark#inuse | 1440 | dark | /tmp/opencode/phone-composition/publish-consent-before-dark-1440.png | /tmp/opencode/phone-composition/publish-consent-after-dark-1440.png | better consent separation; desktop control retained |
| table-initial | ?fb=off&app=commons&commons=collective-detail&theme=dark#inuse | 1440 | dark | /tmp/opencode/phone-composition/table-initial-before-dark-1440.png | /tmp/opencode/phone-composition/table-initial-after-dark-1440.png | unchanged desktop control (no regression) |
| table-filter | ?fb=off&app=commons&commons=collective-detail&theme=dark#inuse | 1440 | dark | /tmp/opencode/phone-composition/table-filter-before-dark-1440.png | /tmp/opencode/phone-composition/table-filter-after-dark-1440.png | unchanged desktop control (no regression) |
| map-spatial | ?fb=off&app=graph&section=map&theme=dark#inuse | 1440 | dark | /tmp/opencode/phone-composition/map-spatial-before-dark-1440.png | /tmp/opencode/phone-composition/map-spatial-after-dark-1440.png | unchanged desktop control (no regression) |
| transcript-tool | ?fb=off&app=transcript&theme=light#inuse | 1440 | light | /tmp/opencode/phone-composition/transcript-tool-before-light-1440.png | /tmp/opencode/phone-composition/transcript-tool-after-light-1440.png | unchanged desktop control (no regression) |
| transcript-task | ?fb=off&app=transcript&theme=light#inuse | 1440 | light | /tmp/opencode/phone-composition/transcript-task-before-light-1440.png | /tmp/opencode/phone-composition/transcript-task-after-light-1440.png | unchanged desktop control (no regression) |
| transcript-search | ?fb=off&app=transcript&theme=light#inuse | 1440 | light | /tmp/opencode/phone-composition/transcript-search-before-light-1440.png | /tmp/opencode/phone-composition/transcript-search-after-light-1440.png | unchanged desktop control (no regression) |
| transcript-header | ?fb=off&app=transcript&theme=light#inuse | 1440 | light | /tmp/opencode/phone-composition/transcript-header-before-light-1440.png | /tmp/opencode/phone-composition/transcript-header-after-light-1440.png | unchanged desktop control (no regression) |
| publish-consent | ?fb=off&&theme=light#inuse | 1440 | light | /tmp/opencode/phone-composition/publish-consent-before-light-1440.png | /tmp/opencode/phone-composition/publish-consent-after-light-1440.png | better consent separation; desktop control retained |
| table-initial | ?fb=off&app=commons&commons=collective-detail&theme=light#inuse | 1440 | light | /tmp/opencode/phone-composition/table-initial-before-light-1440.png | /tmp/opencode/phone-composition/table-initial-after-light-1440.png | unchanged desktop control (no regression) |
| table-filter | ?fb=off&app=commons&commons=collective-detail&theme=light#inuse | 1440 | light | /tmp/opencode/phone-composition/table-filter-before-light-1440.png | /tmp/opencode/phone-composition/table-filter-after-light-1440.png | unchanged desktop control (no regression) |
| map-spatial | ?fb=off&app=graph&section=map&theme=light#inuse | 1440 | light | /tmp/opencode/phone-composition/map-spatial-before-light-1440.png | /tmp/opencode/phone-composition/map-spatial-after-light-1440.png | unchanged desktop control (no regression) |

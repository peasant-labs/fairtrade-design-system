# Final consolidated evidence: complete

Exact candidate fed1e6f4f5a54844ce0b6e103461c9db23064f77, tree08d0c54357447c232d206c0e81224d9d28f52476; base ec4a7ee572b3911a4e2b82e4216368ab88b84af9. 24 motion pairs /48PNGs plus2 transcript pairs /4PNGs complete. No reproduced structural or visible regression. All prior attempts/control records retained, not replaced or concealed.

## Final matrix (existing tol16)

| Theme | Width | Motion | Surface | Geometry | Pixels | Max width delta px | Result |
|---|---:|---|---|---|---:|---:|---|
|dark|390|default|redaction|exact|0|0|pass|
|dark|390|default|providers|fill width only|16|.0124969482421875|fill-edge note|
|dark|390|default|switch|exact|0|0|pass|
|dark|390|reduce|redaction|exact|0|0|pass|
|dark|390|reduce|providers|fill width only|16|.0124969482421875|fill-edge note|
|dark|390|reduce|switch|exact|0|0|pass|
|dark|1440|default|redaction|exact|0|0|pass|
|dark|1440|default|providers|fill width only|20|.0150146484375|fill-edge note|
|dark|1440|default|switch|exact|0|0|pass|
|dark|1440|reduce|redaction|exact|0|0|pass|
|dark|1440|reduce|providers|fill width only|20|.0150146484375|fill-edge note|
|dark|1440|reduce|switch|exact|0|0|pass|
|light|390|default|redaction|exact|0|0|pass|
|light|390|default|providers|fill width only|16|.0124969482421875|fill-edge note|
|light|390|default|switch|exact|0|0|pass|
|light|390|reduce|redaction|exact|0|0|pass|
|light|390|reduce|providers|fill width only|16|.0124969482421875|fill-edge note|
|light|390|reduce|switch|exact|0|0|pass|
|light|1440|default|redaction|exact|0|0|pass|
|light|1440|default|providers|fill width only|20|.0150146484375|fill-edge note|
|light|1440|default|switch|exact|0|0|pass|
|light|1440|reduce|redaction|exact|0|0|pass|
|light|1440|reduce|providers|fill width only|20|.0150146484375|fill-edge note|
|light|1440|reduce|switch|exact|0|0|pass|
|dark|390|default|transcript scroll|exact|0|0|parity pass; model mobile-hidden in both|
|light|390|default|transcript scroll|exact|0|0|parity pass; model mobile-hidden in both|

Provider pixels are ALL within1px of fill right edges; every width delta<.02px across all5fills. Track/layout/spacing/text/data/ARIA unchanged. This is the supervisor-characterized non-blocking transform-versus-percentage-width sub-pixel rasterization note, not exact-pixel identity and not a finding. No tolerance change, crop, masking or hidden flagged elements.

## Motion and phase stabilization

Before EVERY final motion screenshot, in BOTH builds, verbatim:

`document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0 })`

Then assert no animations have playState running. This symmetric Web Animations phase stabilizer changes no production CSS, layout, control state or static styling; all controls/values remain mounted. Computed motion observations and real switch interaction are measured BEFORE the pause. Final48motion captures verified running count0. Transcript screenshots use the equivalent variant: pause all, infinite animations currentTime0, finite entrance animations currentTime=effect.getComputedTiming().endTime. This keeps the already-entered sticky header/tab content at its final static position instead of moving it back to an offscreen entrance start; both builds use identical treatment, running count0. All52 freeze observations retained.

Served CSS busy rules byte-identical across builds (exact extraction/equality in provenance.json): `.sw-busy-spin{transform-origin:50%;animation:.9s linear infinite busy-spin}` and `@keyframes busy-spin{to{transform:rotate(360deg)}}`. No phase stabilizer implementation shipped.

Progress fills retain full layout widths; default only transform200ms; reduced0.01ms; drawn proportions1/.62 remain data-correct. Redaction roleprogressbar now12/min0/max12 intact. Switch real click false→true/ARIA preserved, candidate thumb will-changeauto versus base transform; reduce0.01ms. Static screenshots taken after settling and phase pause, not at an intermediate progress value.

Transcript first assistant turn1 targeted using its real offset and existing production reading-line rule; stream scrollTop195 in both themes/builds. Sticky header/scrubber and session tabs visible, exact geometry and0pixels difference. Sticky model DOM mounted with anthropic/claude-fable-5, but preexisting phone rule `.txn-sticky-model { display: none }` in BOTH builds. No visible mobile-model claim; preserved baseline phone composition, no layout shift. Initial observation-script assumptions120px/model-visible failed before screenshots and were corrected without production edits; logs retained.

## Earlier events, fully retained

- Dark390reduce redaction82 scattered glyph pixels did not reproduce: diagnostic2runs/build, all6matrix comparisons0, fourPNGs byte-identical. Cause unproven, not a blanket glyph tolerance.
- Pending provider reduce dark390 first199pixels outside fill class → one retry16 entirely in approved fill edges. Non-fill portion transient; both attempts retained.
- Desktop default switch first104→retry112 pixels, solely adjacent saving spinner x612–625/y870–883. Source/served-rule equality confirms unchanged infinite busy-spin; symmetric freeze now produces0. Capture-phase variance, not a switch regression. No image discarded or overwritten.
- First observation-script mistakes before captures (ROOT-relative fixture path, overly broad1.12 token search, border-inclusive drawn ratio) recorded in initial-stop report. All prior stop reports/provenance, retries and diagnostic preserved.

## Provenance, commands, inspection

Fresh candidate and base pnpm builds passed. Candidatepreview5311/base5312 served CSS/JS EXACTLY equal respective dist bytes, checked percontext; hashes unchanged:

| Build | Asset | SHA256 |
|---|---|---|
|fed1e6f|index-BggrwM9v.js|4e38dbde73cdc6d69f95077a3825ad490d2aca034db768c84a25c78324f36d4b|
|fed1e6f|index-DQcMloqA.css|4c4e53dab52b256913e50ccb01d522b141aec18a2d83d4e5248ec5812fd19e63|
|ec4a7ee|index-BAM01EhN.js|d93e7c065b1122cb2a1438f0c9af8325342d2f3744a2d3778fa85539d21c47e0|
|ec4a7ee|index-AF2BH4Re.css|87ff578e6f3c1317a299955a20c3327980a968ef43d5312be689d4c7a96664a1|

Served corrected spring curve cubic-bezier(.16,1,.3,1), old spring overshoot absent; legitimate line-height1.12 retained. Source checks confirm unusedlucide removal/Markdown externals; apppreview is not emitted-library externalization proof.

Supplied Node26.10.0/pnpm11.24.0 PATH. Commands: candidate `pnpm build`; `git worktree add --detach /tmp/opencode/w3-base ec4a7ee572b3911a4e2b82e4216368ab88b84af9`; symlink candidate node_modules; `pnpm_config_verify_deps_before_run=false pnpm --dir /tmp/opencode/w3-base build`; candidate `pnpm exec vite preview --port 5311 --strictPort`; base `pnpm_config_verify_deps_before_run=false pnpm exec vite preview --port 5312 --strictPort`; `node /tmp/opencode/wave3-fed1e6f/capture.mjs`; narrowly rerun corrected transcript observation with `TRANSCRIPT_ONLY=1 node /tmp/opencode/wave3-fed1e6f/capture.mjs` (EXIT0). Exact commands/URLs/observations inprovenance.json; logs *-freeze.log and transcript-freeze-r2.log. Existing token-measure YAML/selectors/props and png-diff reused, no repository harness.

Final filenames have `-freeze.png`; prior PNGs unchanged. Four uncropped contact sheets `inspection-{390,1440}-{dark,light}.png` inspected covering all48motion images; both candidate transcript images inspected individually, base parity0. No styling/spacing regression observed. All artifacts transient under this directory.

## Scope and cleanup

Validation/evidence for UAT only; not formal review, UAT acceptance, publication or release. Independent formal one-round review already0/0/0 and closed. Does not prove emitted-library pack/export behavior or full-product end-to-end sharing; existing implementation gates own those claims. No fullcatalog/test-suite rerun for this evidence pass.

Motion matrix and scoped transcript parity complete, with explicit hidden-model baseline limitation. Both owned previews stopped; tempbase worktree removed; candidate exacthead/tree retained and gitstatusclean. Repository fileschangedNONE/commitsNONE. No fixes, push, merge, task closures or publication.

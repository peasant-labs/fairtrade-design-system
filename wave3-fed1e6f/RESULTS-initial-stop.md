# Validation / evidence only — stopped

REGRESSION: static provider-bar parity is not identical at 390px, dark, default motion.
Candidate fed1e6f4f5a54844ce0b6e103461c9db23064f77 (tree 08d0c54357447c232d206c0e81224d9d28f52476), versus base ec4a7ee572b3911a4e2b82e4216368ab88b84af9.

Both builds passed. Served candidate JS/CSS and base JS/CSS matched their respective dist bytes exactly; SHA256 and URLs are in provenance.json. The served candidate spring token is cubic-bezier(.16,1,.3,1); the old spring overshoot is absent. Unrelated line-height 1.12 remains legitimately present.

Captured 3 surfaces for each build at dark/default/390 (6 PNGs). No image was retaken after the parity finding. The redaction pair has exact geometry and zero pixels differing at the existing tol16. Provider distribution has 16 of 351000 pixels differing at tol16, in y450–548, at progress-fill edges. The first 62% fill is 43.399993896484375px (scaleX) versus 43.390625px (percentage width), a 0.009368896484375px difference. Track geometry, text and data match. Both images were visually inspected: no obvious overall styling degradation, but literal identical geometry/appearance is not proved. This looks consistent with transform-versus-layout subpixel rasterization, not changed data or spacing; no waiver is assumed.

Candidate progress fills retain full layout width (240/240 and 70/70), transition only transform for 200ms, and draw the fixture proportions 1 and .62. Redaction ARIA remains progressbar, now12/min0/max12. Switch real click changes aria-checked false→true, thumb will-change auto versus base transform. Switch screenshots exist, but comparison was not reached.

STOP honored: no remaining themes, reduced-motion modes, desktop widths or transcript scroll spot-check were run. This is partial evidence, not M4 fulfillment, UAT acceptance, a formal review or a review verdict. The separate formal review runs independently.

Toolchain: Node26.10.0/pnpm11.24.0 via the supplied PATH. Candidate install frozen passed, pnpm build passed. Base reused candidate node_modules symlink as requested; pnpm's automatic dependency verification initially refused the symlink, then pnpm_config_verify_deps_before_run=false pnpm build passed. No engine bypass. Transient script reused the existing token-measure YAML selectors/props and png-diff primitive; no repository harness or production files changed. Initial observation-script errors before screenshots: absolute path supplied to ROOT-relative fixture loader; overly broad 1.12 check included legitimate line-height; drawn ratio initially included track borders. Corrected observation mistakes only, no production edits; all happened before the first capture set.

Source checks confirm unused lucide removed and react-markdown/remark-breaks/remark-gfm added to shared library externals. Those are library-build changes, not meaningful markers in application JS; no emitted-library externalization claim is made from the application preview. Candidate served CSS shows transform progress mechanics. Exact commands, asset hashes, observations and parity result are in provenance.json; build/install/capture logs and transient capture script are alongside it.

Cleanup: both owned previews stopped and detached base worktree removed. Candidate git status clean; no committed files, commits, push, merge or task closure.

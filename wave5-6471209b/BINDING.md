# Binding to head `6471209b` — what this revision recaptured, and what it kept

The evidence bundle prefix `wave5-6471209b` is a **delta** over the accepted prefix
`wave5-ddd7a60`: it carries only the artifacts this revision corrected or recaptured, plus this note
and the corrected `RESULTS.md`. Everything else in the accepted prefix remains valid for this head
**by dist byte-identity**, which is proven below. Nothing in the accepted prefix was modified.

## 1. The head and why the dist is unchanged

| | value |
|---|---|
| final head N | `6471209b423c50ca8d6e900dc3ecfe9c5e074053` |
| base (wave 4 / PR #157) | `fbdcd0d30f5595b752eaa3e7d8c1fa11a15f6dd7` |
| PR | `#158` (draft, top of stack `#157`) |
| commits added | `b243412` built-app overflow guard (both motions, band revealed); `98fc6df` in-use home capture probes scoped under `.iu-page`; `6471209` whole-rule literal in the mobile-layout guard |
| files touched | `scripts/journey/app-validate.journey.mjs`, `scripts/fairtest/capture-cases.testdata.yaml`, `scripts/testdata/mobile-layout-invariants.yaml` — **no `src/**` file changed** |

The head adds only test/guard/evidence-scoping changes, so the built tree is the `ddd7a60` build
byte-for-byte. Asserted after `pnpm build` (exit 0) on a clean worktree:

| artifact | sha256 | identical to `ddd7a60` |
|---|---|---|
| `dist/assets/index-Dr3SWh4l.css` | `6d7ab0316ac40f44b8e98d8893327c779cdb921b2ef90d88712108d24d557154` | yes |
| `dist/assets/index-bvmS1ugF.js` | `c03328f6ee5c892aca1afd9144b97347b553701fbdd768717a4d1552ef433549` | yes |

The fix marker `pgn-edge{width:var(--control-h-sm);padding:0;position:relative}` is present exactly
once in the built CSS (0 times in the pre-fix build), and the same assets are the ones both served
states of this bundle record.

## 2. Recaptured at head N

The in-use home surface (`inuse-home`, root `.iu-page`) was recaptured with the fairtest capture
capability after its `tbl-count` and `tbl-search` probes were scoped under `.iu-page`. The standing
probes matched the docs page's own demo table (which mounts the same `.tbl-footer`/`.tbl-tools`
classes) and recorded `showing 4 of 4`; the scoped probes resolve inside the captured region and
record the in-use home table's own `showing 7 of 1284`.

- Run: one single-surface capture run with the capability (`capture-fairtest.mjs --cases` a transient
  copy limited to this surface), before = the published `fbdcd0d` tree, after = the head N
  dist, 2 states x 3 widths x 2 themes x 4 targets = 48 shots, both verdicts `pass`, 0 failure codes.
- Replaced in the bundle: 12 row records (`rows/{before,after}/inuse-home--*`), 36 element shots
  (`shots/{before,after}/inuse-home-*`), and the regenerated `sheets/sheet-inuse-home.png` (its
  digest in `sheets/manifest.json` was updated with it).
- `iu-search` shots (12) and row surface-region shots (12) are **byte-identical** to the accepted
  ones: scoping is a no-op for the elements that already resolved inside the region. Only the 24
  `tbl-count`/`tbl-search` shots changed.
- Each recaptured `rows/after/inuse-home--*/provenance.json` records `head 6471209b…`, `dirty
  false`, and `servedEqualsDist true` for both assets. The `before` provenance is unchanged
  (`fbdcd0d`, same two assets), so those six files are byte-identical to the accepted prefix.

## 3. Re-run at head N (same trees, corrected probes)

- `fix-320/pair-probe.mjs` now resolves the checkout that owns the capture driver from
  `FAIRTRADE_ROOT` (a missing or wrong value fails with a repair line) and binds both states in its
  payload: `binding.{before,after}` carry the real dist `root`, worktree `head` and `dirty`, and the
  `served` sha256 of each asset as actually fetched. Numbers are unchanged: pre-fix 12/24 overflow at
  page top and 24/24 revealed; fixed 0/24 and 0/24.
- `fix-320/diagnosis-probe.mjs` no longer elides the dist path and records the same binding for both
  payloads (the pre-fix `b75b79d` copy, whose head is passed explicitly because a preserved copy sits
  outside its worktree, and the published `fbdcd0d` tree resolved from git). Their `runs` blocks are
  still byte-identical.
- `fix-320/guard-negative-control.log` is new in this revision: the extended built-app overflow guard
  run against a copy of the dist with `position: relative` deleted from that one rule. It **fails,
  exit 1**, reporting `{"no-preference/320":{"top":0,"revealed":4},…,"reduce/320":{"top":4,"revealed":4}}`
  and zeros everywhere else; the same guard passes, exit 0, against the committed dist.

## 4. Kept from `ddd7a60` (valid here by byte-identity)

Everything else: the other ten surfaces' rows and shots in both states, `build/{before,after}.json`,
`evidence/{before,after}.json`, the other ten sheets, the `bands/` annex and the `fix-320/{reduce,normal}`
focused runs. A full tree comparison of this bundle against the accepted prefix found exactly:

- **1 file present only in this bundle**: `fix-320/guard-negative-control.log`.
- **0 files present only in the accepted prefix**.
- **49 files differing**, all of them this revision's corrections: 5 under `fix-320/`
  (`pair-probe.mjs`, `pair-probe.json`, `diagnosis-probe.mjs`, and the two diagnosis payloads), 12
  `rows/{before,after}/inuse-home--*/capture.json`, 6 `rows/after/inuse-home--*/provenance.json`
  (the `before` provenance is unchanged), 24 `inuse-home` element shots, `sheets/sheet-inuse-home.png`
  and `sheets/manifest.json`.

The bundle's own fail-closed verifier, run on a clean copy root holding exactly the declared files,
reports **PASS, 0 failures**: 132 rows, 744 targets, 720 shots, 24 unshootable with non-empty
reasons, 11 sheet digests matching their PNGs, `served==dist` for both builds, 1001 observed files,
0 stray, 0 missing.

## 5. What this prefix does not claim

The same honesty limits as `RESULTS.md`: the capture capability core was user-accepted without
re-review, and the post-fix state of this branch has not been independently re-reviewed. This
prefix is the writer's evidence package for the applied, user-approved scope — not a second review
round and not a 0/0/0 claim.

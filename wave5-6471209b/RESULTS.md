# Final consolidated evidence — fairtrade #116 delivery stack (wave 5, final head `ddd7a60`)

This document is anchored to head `ddd7a60` and carries a **delta for head `6471209b`** (§10): that
head adds only test-side changes, the built tree is byte-identical, and the delta recaptures one
surface plus the corrected probes. `BINDING.md` in the same bundle enumerates exactly which artifacts
are recaptured and which are kept.

Produced by the fairtest capture capability (`scripts/fairtest/capture-fairtest.mjs`), not by an
ad-hoc script. Output tree: `/tmp/opencode/fairtest-final-evidence` (transient; not committed);
the band annex lives under `bands/` inside it and the 320px overflow-fix pair under `fix-320/`.
The run that preceded the 320px fix (`b75b79d`) is preserved beside it at
`/tmp/opencode/fairtest-final-evidence-b75b79d` so every byte this revision claims is re-readable.

Honest state of the review record, stated up front:

- The fairtest **capture capability core** (the neutral capture/evidence/sheet child plus its
  app-owned adapter) was **accepted by the user WITHOUT re-review**. That waiver is recorded; this
  document makes **no clean 0/0/0 claim** for it.
- The **post-fix state of this branch was NOT independently re-reviewed**. The wave-5 review round
  ran on the accepted candidate `080d9b3`; the user then chose the apply option ("Apply the fix
  scope") rather than apply-plus-focused-recheck, so the fix commits above it (`61946bf`, `2fed9ec`,
  `b75b79d`) carry the architect-consolidated scope and this evidence, not a second review round.
- The **320px reduced-motion overflow fix (`ddd7a60`) is applied under the user's "FIX-NOW"
  decision and the same apply-only ruling**: it is diagnosed, fixed, guarded and re-captured here,
  and it has **not been independently re-reviewed** either. It is also **not a reduce-only defect**
  (see §7), which is a correction of the earlier record rather than a restatement of it.

## 1. Runs, heads, builds

| | before | after |
|---|---|---|
| state id / run id | `before` / `fix-ddd7a60-before` | `after` / `fix-ddd7a60-after` |
| worktree head label | `fbdcd0d30f5595b752eaa3e7d8c1fa11a15f6dd7` | `ddd7a60158f8a8a42ac8c436e9d792ee9474fbe2` |
| dirty | false | false |
| served tree | `/home/minttea/.../fairtrade-design-system-116--fix--amber-selected/dist` (published W4 head) | `/home/minttea/.../fairtrade-design-system-116--wave5/dist` |
| js asset | `index-C7TroAbe.js` sha256 `70535b8d3563f7656d98ce56ff5e0a0fc96010e03a8f7c27dd4e7f87c2bc0296` | `index-bvmS1ugF.js` sha256 `c03328f6ee5c892aca1afd9144b97347b553701fbdd768717a4d1552ef433549` |
| css asset | `index-CMB0VUbW.css` sha256 `f84e24b849499e7f8694c816afabb29d702801462d47aedba8b85ec3937a06ae` | `index-Dr3SWh4l.css` sha256 `6d7ab0316ac40f44b8e98d8893327c779cdb921b2ef90d88712108d24d557154` |

The `--before-dir` is the published W4 tree; it was re-validated before use against the recorded
`fbdcd0d` provenance and both asset hashes match the served tree byte-for-byte, so no before tree
had to be rebuilt. The after dist was rebuilt at the final head `ddd7a60` (`pnpm build`, exit 0) and
the run's `build/after.json` matches it exactly (`index-bvmS1ugF.js`, `index-Dr3SWh4l.css`). The JS
**content** is byte-identical to the previous head's build (`c03328f6…`; only the file-name hash
moved, because the entry chunk carries its CSS asset name); the CSS moved from `a5cd9cb1…` to
`6d7ab031…` for the single declaration the 320px fix adds. Both hashes and the fix marker were
re-confirmed after the later gate rebuilds (`pnpm build:lib`, `pnpm build`, `pnpm journey:ci`).

Capture elapsed **418.2 s** (log `/tmp/opencode/wave5-capture-main-final.log`). Verdicts:
`before=pass`, `after=pass`, 0 failure codes each. 66 rows per state, **132 rows** total;
**720 shots**; **24 unshootable** (explicit reasons); **11 contact sheets**. The run's own
fail-closed inventory walk ran in a clean root: `bands/` and `fix-320/` were staged aside for the
run and restored afterwards, the same convention the accepted run used when it added the annex.

Independent re-verification (separate script, `/tmp/opencode/verify-evidence.mjs`, not the
producer's own check; report `/tmp/opencode/verify-main-final.json`): **PASS, 0 failures** —
per-target exactly one of shot/reason (0 fabricated, 0 missing, 0 both); 720/720 shot files present
with matching sha256; 24/24 unshootable carry a non-empty reason; `served==dist` true for every
asset of both builds; sheet manifest `order` = `width-theme-state` with run ids
`fix-ddd7a60-before` / `fix-ddd7a60-after`; all 11 sheet digests match their PNGs; 1,000 files
observed, 0 stray, 0 missing. That check reads the run's own declared artifacts (the same bytes,
copied to a clean root) because the canonical root now also holds the `bands/` annex, the `fix-320/`
pair and this document: run against the canonical root the same script reports exactly one failure
and it is that file-set check (`stray 1027`, `missing 0`, everything else green,
`/tmp/opencode/verify-main-canonical.json`) — the annex and the fix pair are separate self-contained
roots and are re-verified on their own in §6 and §7.

## 2. What the fix commits changed on this head (no-visible-change proofs)

`2fed9ec` restores the transcript rail boundary as a **declared exception** (`@media (width <
1080px)` in `src/index.css`, registered in `scripts/testdata/breakpoints.yaml` + manifest). The D1
claim is that the restored boundary is a **no-visible-change** against the accepted build at every
width the standing capture set covers.

- **Byte comparison of the whole capture against the accepted candidate's own run**
  (`/tmp/opencode/fairtest-final-evidence` vs `/tmp/opencode/fairtest-final-evidence-prev`, run
  `final-*`, head `080d9b3`, same before tree): `shots/` — **5 files differ**;
  `sheets/` — **3 sheet PNGs + `sheets/manifest.json`** differ (the manifest only because the run
  ids changed to `fix-b75b79d-*`, the run ids the canonical root carried when that comparison was
  written).
- That is not the "none" the plan expected, so each difference was measured pixel-by-pixel with the
  repo's own tolerance semantics (tol 16/255, `/tmp/opencode/pngdiff.mjs`,
  `/tmp/opencode/pngdiff-pairs.json`):

  | file | state | hard (tol 0) | soft (tol 16) | measured cause |
  |---|---|---|---|---|
  | `shots/after/inuse-transcript-320-light-txn-search-trigger.png` | after | 2 px / 2,204 | 0 | AA-only |
  | `shots/after/inuse-transcript-320-light-txn-tabbar.png` | after | 159 px / 11,544 | 0 | AA-only |
  | `shots/before/publish-ready-390-light-pub-access-row.png` | **before** | 428 px / 37,736 | 4 | before-state capture shimmer |
  | `shots/before/publish-ready-390-light-pub-body.png` | **before** | 2,379 px / 257,400 | 41 | before-state capture shimmer |
  | `shots/before/publish-ready-390-light-pub-consent-column.png` | **before** | 385 px / 26,492 | 12 | before-state capture shimmer |
  | `sheets/sheet-controls-checkbox.png` | – | 160 px / 393,990 | 0 | sheet renderer AA — **no embedded shot differs**, so it cannot be an embedding effect |
  | `sheets/sheet-inuse-transcript.png` | – | 755 px / 1,636,992 | 0 | AA-only; embeds the two after-state transcript-320-light shots above, so embedding and the sheet's own render are both consistent with it |
  | `sheets/sheet-publish-ready.png` | – | 1,434 px / 1,193,985 | 0 | AA-only; embeds the three before-state publish-ready-390-light shots above |
  | `sheets/manifest.json` | – | not an image | – | run ids changed (`final-*` -> `fix-b75b79d-*`; that is the historical comparison, before the final-head run took the same root); the 11 sheet digests are otherwise identical except the three sheets listed above |

  Nothing in this list is unexplained: four of the eight images are AA-only (0 pixels above the
  16/255 tolerance), and the last three of the five shot differences are attributed — and can only
  be attributed — to render nondeterminism between capture runs, because they are in the **before**
  state whose served tree is byte-identical between the two runs (same head `fbdcd0d`, same asset
  hashes, `dirty:false`, `served==dist`). A difference in a state whose inputs did not change cannot
  be caused by the fix. They are 41 / 12 / 4 pixels above tolerance out of 257,400 / 26,492 /
  37,736 (<=0.02 %); I do not fold them into "AA-only", because they exceed the repo's own
  tolerance.
- **D1 at the captured widths is a no-visible-change**: every shot the standing set captures at
  320 / 390 / 1440 is byte-identical between the accepted candidate's run and the `b75b79d` run,
  except the five files above (three of them in the unchanged before state) — and §2b shows the
  final-head run reproduces the `b75b79d` run byte-for-byte, so the claim holds at `ddd7a60` too.
  The direct width-level proof is the band annex in §6 (`sheet-transcript-clip`, 1060: rails
  unshootable with the identical reason in **both** states).
- **One honest exception to "zero visible change":** the retired form was
  `@media (max-width: 1080px)` (active at exactly 1080 px); the restored canonical single-sided form
  is `@media (width < 1080px)` (inactive at exactly 1080 px). At **exactly 1080 px** the fixed
  build therefore shows the rails where the accepted build hid them, and at every other width the
  two agree. The band annex captures 1080 explicitly and records that one-width difference
  (`bands/targeted-1060-1080-1300-1450`), rather than rounding it away.

### 2b. The 320px overflow fix (`ddd7a60`) changes no captured pixel

Two independent byte comparisons, both on the same before tree, the same case document and the same
widths and themes:

1. **Fresh main run at `ddd7a60` vs the preserved run at `b75b79d`** (the head this document
   previously described, kept at `/tmp/opencode/fairtest-final-evidence-b75b79d`):

   | artifact class | files | byte-identical | differing |
   |---|---|---|---|
   | `shots/before/**` | 294 | 294 | 0 |
   | `shots/after/**` | 294 | 294 | 0 |
   | `sheets/*.png` | 11 | 11 | 0 |
   | `sheets/manifest.json` | 1 | – | run ids only (`fix-b75b79d-*` -> `fix-ddd7a60-*`) |

   This pass reproduced the previous run's bytes exactly (no capture-run nondeterminism at all),
   which is a stronger statement than the accepted candidate's own accounting above. The comparison
   is the run **as captured at `ddd7a60`**: this revision later recaptured the in-use home surface at
   head `6471209b` to replace its mis-scoped probes (§10), so that surface's 24 element shots and 12
   row artifacts in this bundle are the recaptured ones. Every file the recapture replaced is
   preserved byte-for-byte at `/tmp/opencode/fairtest-final-evidence-premerge-inuse-home/`.
2. **Pair identity inside the fresh run**: the same computation, extended to count the two classes
   separately (`/tmp/opencode/fix320-pair-identity.mjs`,
   `/tmp/opencode/fix320-pair-identity-new.json`): of the 294 element/focus shot pairs **230 are
   byte-identical and 64 differ**, and of the 66 row surface-region pairs **42 are byte-identical and
   24 differ** — **272 identical, 88 differing of 360**. The preserved `b75b79d` root returns
   **274/86** (232/62 + 42/24), so the two runs differ by exactly two pairs, both
   `inuse-home-390-{dark,light}-tbl-count`; §5 explains why rescoping that probe moved them.

So the fix's visible change across the whole standing capture set is **none**, and both the D1
no-visible-change claim and §5's mapping carry over to the final head unchanged. The claim is also
structural: the fix adds one declaration (`position: relative`) scoped to `.pgn-edge` inside the
narrow-viewport media block, and no captured root contains that element at all (§7.4).

## 3. Surfaces and per-surface counts (per width, themes deduped)

Every `(surface, width)` cell below is counted **once**: the two themes render the same counts and
the two states render the same counts, both verified from the records (all 33 cells agree across
theme and state). Multiply by 4 for the run totals (132 rows, 744 targets, 720 shots, 24
unshootable).

| surface | root | 320 targets/shots/unshootable | 390 | 1440 |
|---|---|---|---|---|
| controls-checkbox | `#controls` | 4 / 4 / 0 | 4 / 4 / 0 | 4 / 4 / 0 |
| states-toggle | `#states` | 12 / 12 / 0 | 12 / 12 / 0 | 12 / 12 / 0 |
| badges-chip | `#badges` | 5 / 5 / 0 | 5 / 5 / 0 | 5 / 5 / 0 |
| inuse-apptab | `#inuse` | 7 / 7 / 0 | 7 / 7 / 0 | 7 / 7 / 0 |
| inuse-seg | `#inuse` | 3 / 3 / 0 | 3 / 3 / 0 | 3 / 3 / 0 |
| inuse-analytics | `#inuse` | 5 / 5 / 0 | 5 / 5 / 0 | 5 / 5 / 0 |
| inuse-transcript | `#inuse` | 10 / 7 / 3 | 10 / 7 / 3 | 10 / 10 / 0 |
| inuse-settings-switch | `#inuse` | 3 / 3 / 0 | 3 / 3 / 0 | 3 / 3 / 0 |
| publish-update | `.pub-dialog` | 5 / 5 / 0 | 5 / 5 / 0 | 5 / 5 / 0 |
| publish-ready | `.pub-dialog` | 4 / 4 / 0 | 4 / 4 / 0 | 4 / 4 / 0 |
| inuse-home | `.iu-page` | 4 / 4 / 0 | 4 / 4 / 0 | 4 / 4 / 0 |

The 24 unshootable (3 per state x 2 themes x 2 states at each of 320 and 390) are the transcript
right-rail probes (`txn-viewsw-state`, `txn-viewsw-on-state`, `txn-viewsw-focus`), each with the
recorded reason `nearest ancestor whose computed display is none: aside.txn-rail.txn-rail-right`.
They are captured at 1440.

## 4. Standing-checklist coverage

| checklist item | surface / probe | sheet | observation on the final head |
|---|---|---|---|
| mobile gutters | inuse-transcript, inuse-settings-switch, controls-checkbox at 320/390 | transcript, settings-switch, controls-checkbox | the page gutter steps to 12 px below 480 (`--gutter: var(--sp-3)`); the transcript tab strip starts at x=12 at both 320 and 390, its content reaches 308 px in a 320 px viewport, and no surface shot or sheet shows text against the frame or a horizontal scroll region |
| compact switcher | inuse-apptab probes `.iu-opt-on`, `.iu-opt`, `.iu-opt-on .iu-opt-key` | inuse-apptab | the app-tab tiles render icon-only at 320/390 (the `.iu-opt-label` is visually hidden, the key hint and the accessible name stay) and labelled at 1440 |
| publish consent padding | publish-update / publish-ready probes `pub-consent-column` (`.pub-auto`), `pub-body` (`.dlg-body`) | publish-update, publish-ready | at 320 the dialog body is the full 320 px sheet and the consent column keeps its 16 px insets (`x=16`, 288 px wide) with the off-hint line intact (`publish this repo automatically on git push / off, change it in settings`) |
| DataTable count truth | inuse-home probe `tbl-count` (`.iu-page .tbl-footer [role=status]`) | inuse-home | renders `showing 7 of 1284` - the in-use home table's own status line (7 rows shown of the host's 1,284), once, at every captured width and in both themes and states. Before this revision rescoped the probe (§10) it read `showing 4 of 4` from the docs page's own demo table, which mounts the same `.tbl-footer` class |
| amber selected/on controls | controls-checkbox, states-toggle, badges-chip, inuse-apptab, inuse-seg, inuse-analytics, inuse-settings-switch, inuse-transcript | matching sheets | checked boxes `rgb(184,132,26)` (light) / `rgb(203,163,92)` (dark) on the amber fill, switches on the same amber, button/segment/chip toggles and the selected app tab amber; unchecked/off neutral; hover and focus rings present |
| non-overlapping search | inuse-home `tbl-search` (`.iu-page .tbl-tools`), `iu-search` (`.iu-page-search`); inuse-transcript `txn-search-trigger`, `txn-tabbar` | inuse-home, inuse-transcript | the in-use table's tools bar is a 272x61 flex column at `x=24` at 320 (342x61 at 390, 1152x36 at 1440) carrying the `search rows` control and the column-filters row without overlapping the table's columns; the transcript search trigger sits at the tab-strip end (75x28 at `x=221` inside a 296 px strip at `x=12`, inside the 320 px viewport) and below 480 it keeps its icon and the `⌘F` shortcut badge, with the words (`search this transcript`) in the accessible name only |
| readable type floors | every captured probe's `read.fontSize` across all 132 rows; `node scripts/dense-type.test.mjs` | - | the dense-type gate exits 0 (no dense font literal below the chrome floor; 0 deferred consumers); the captured probe distribution is **276 targets at 14px** (chrome, labels, keys) and **168 at 16px** (reading), with **0 of 444 under 14px** - the floors hold on the mounted build the sheets come from, not only in the source scan |
| this wave — #131/6 update-mode rows | publish-update / publish-ready `pub-access-row` | publish-update, publish-ready | update mode: before reads `Acme Platform, suggested, repo acme/ingest-api is linked, 12 members` (286x124 at 320), after reads `Acme Platform, 12 members` (286x64); first publish keeps the note in both builds |
| this wave — b75b79d mid-update picker note | — | — | **not captured, judged from source** (see §8): the capture model navigates and reads only, and the row appears only after an `add` click. The demo-truth mutation pair covers it (both planted mutations killed) |
| this wave — #132/7 media-query consolidation | site-chrome probes `.page-rail`, `.nav-links`, `.sb-label`; every surface shot at 740/940 | `bands/full-740-940/sheets/*`, `bands/targeted-1060-1080-1300-1450/sheets/*` | the band annex now captures the site chrome and the two added widths; see §6 |
| this wave — 320px document overflow (FIX-NOW) | site pagination specimen `#pagination` (probes `.pgn`, both `.pgn-edge` controls, the amber current page) at 320, both themes | `fix-320/reduce/sheets/sheet-site-pagination.png`, `fix-320/normal/sheets/sheet-site-pagination.png` | after the fix `html` is 320/320 in all 48 measurements (6 surfaces x 2 themes x 2 motions x page-top/revealed); before it was 324/320 in 12 of the 24 page-top measurements and in all 24 revealed ones; the edge controls' shots are byte-identical before vs after (8/8 per motion setting), so the mobile composition is unchanged; see §7 |

## 5. Identity mapping to the retained W4 evidence where unchanged

The comparison is the 360 `(surface, width, theme, target)` pairs that carry a shot in both states:
294 element/focus shot pairs (the files under `shots/`) and 66 row surface-region pairs (one
`rows/<state>/<key>/surface.png` per row).

Accepted-candidate accounting (`080d9b3` after vs `fbdcd0d` before, the bundle the review round
walked), **corrected**: 267 of 360 pairs are byte-identical and **93 differ**, which resolves
exactly as **66 at width 390 + 24 on publish-update (320/390/1440) + 3 sub-pixel = 93**. The
previous record said "72 at width 390" and then also counted the six 390 publish-update pairs inside
its own 24, which is what broke the arithmetic (72 + 24 + 3 = 99, not 93); the 390 figure is 66 once
the publish-update pairs are counted once, in their own bucket.

- **66 at width 390** — the consolidated page gutter now steps at the scale (`width < 480px` -> 12 px)
  where the retired off-scale value kept 16 px at 381-479. **Corrected rect (inuse-transcript, 390
  dark, `.txn-tabbar`)**: `x 16 / 358x38` before, `x 12 / 366x38` after (the earlier record had the
  height as 39). Anything padded off `--gutter` is 8 px wider there.
- **24 on publish-update** (8 at 320, 6 at 390, 10 at 1440) — the #131/6 note removal changed the
  reader row height. **Corrected rect (publish-update, 320 dark, `.pub-access-row`)**: `286x124`
  before, `286x64` after (the earlier record had these as 125 and 65).
- **3 sub-pixel** — `inuse-transcript` 320 light (`txn-search-trigger`, `txn-tabbar`, the surface
  region). Same 320x1101 region; 3,907 pixels differ at all and 181 of them exceed the 16/255
  tolerance (<=1.4 % edge pixels); the trigger and tab strip alone are AA-only.

Fresh measurement on the **final head** (`6471209b` after vs the same `fbdcd0d` before, the bundle
this revision carries after the in-use home recapture in §10), same 360 pairs, recomputed on this
revision's own bundle (`/tmp/opencode/fix320-pair-identity.mjs`,
`/tmp/opencode/fix320-pair-identity-new.json`), with the two classes counted separately: the **294
element/focus shot pairs** are **230 byte-identical and 64 differing** (6 at 320, 50 at 390, 8 at
1440), and the **66 row surface-region pairs** are **42 byte-identical and 24 differing** (2 at 320,
20 at 390, 2 at 1440) - **272 identical, 88 differing of 360**. The same computation on the preserved
`b75b79d` root returns **274/86** (232/62 + 42/24), the identity mapping reported there, so this
bundle differs from that run in exactly two pairs: `inuse-home-390-{dark,light}-tbl-count`. Those two
moved because this revision rescoped the in-use home probes under `.iu-page` and recaptured that
surface (§10): the probe used to read the docs page's own demo table, whose status text did not shift
with the accepted 390 gutter change, and now reads the in-use home table, whose status text sits at
`x 28` in the before tree and `x 24` at the fixed head - the same 390 bucket as the other 48 pairs.
The delta from the accepted accounting is therefore **5 pairs** (the 3 transcript-320-light pairs plus
2 of the 390 pairs), which are byte-identical in these runs. That is capture-run render nondeterminism
at the byte level, the same class documented in §2 (an accepted-candidate comparison in which two runs
of one unchanged build differed in 5 shots and 3 sheets), not a change in band behaviour: the 390
gutter rects and the 320 publish row rects above are the final head's own measurements. The 320px
overflow fix moves none of these pairs (§2b).

## 6. Consolidated-width band consequences (full old-to-new table)

50 viewport `@media` conditions were replaced in the consolidation commit `be34e92`; `2fed9ec` then
reverted one of them to the declared exception. The current tree carries 56 viewport width
conditions: 31 `width < 768px`, 11 `width < 480px`, 11 `width < 1024px`, 2 `width < 1440px`, and the
single declared exception `width < 1080px`. Grouped by the interval in which the rule's activation
actually changes:

**A. No band change — canonical form only (3 conditions).** The old inclusive `max-width: X` and
the new `width < X+1` are active over the same widths. *Disposition: intended (form only,
zero band change).*

| old -> new | file / rule |
|---|---|
| `max-width: 767px` -> `width < 768px` | `src/index.css` `.dlg-overlay:has(> .dialog-wide)` wide dialog becomes a full-width sheet |
| `max-width: 767px` -> `width < 768px` | `src/index.css` `.cmg-policies`, `.cmg-signin-card` |
| `max-width: 1023px` -> `width < 1024px` | `src/index.css` `.cmg-home` single column |

**B. One-pixel normalisation — the inclusive bound is dropped (8 conditions).** The old form was
active at exactly the bound, the canonical single-sided form is not; the change is one pixel wide
and no other width is affected. *Disposition: intended (canonical single-sided form), except the
transcript rails, which are the **declared exception (D1)**.*

| old -> new | file / rule | changed width |
|---|---|---|
| `max-width: 480px` -> `width < 480px` | `src/index.css` toast host `.tsx-host` | exactly 480 |
| `max-width: 480px` -> `width < 480px` | `src/index.css` `.iu-bar-brand span` | exactly 480 |
| `max-width: 480px` -> `width < 480px` | `src/index.css` `.txn-checkpoint` phone wrap | exactly 480 |
| `max-width: 480px` -> `width < 480px` | `src/index.css` `.iu-view`, `.iu-page`, `.iu-page-summary` phone padding | exactly 480 |
| `max-width: 480px` -> `width < 480px` | `src/index.css` `.cmg-tiles`, `.cmg-tx-row` | exactly 480 |
| `max-width: 480px` -> `width < 480px` | `src/site.css` `.sb-link { display: none }`, `.navctl.bx` collapse | exactly 480 |
| `max-width: 480px` -> `width < 480px` | `src/ui/ConnectionState.css` `.cx-offline` | exactly 480 |
| `max-width: 1080px` -> `width < 1080px` | `src/index.css` transcript rails (`.txn-body-grid`, `.txn-rail-*`, `.txn-center`) | exactly 1080 — **restored exception (D1)** |

The D1 exception is registered as `the transcript rails need more than the tablet token` in
`scripts/testdata/breakpoints.yaml` (file `src/index.css`, condition `@media (width < 1080px)`,
with the ~448 px reading-column reason) and is a required name in `breakpoints.manifest.yaml`, so
the guard keeps proving every other query sits on the scale.

**C. Widened rule coverage — the rule now applies over an interval it previously did not (37
conditions).** *Disposition: intended (#132/7 - a retired off-scale value folded onto the nearest
scale value), except the 1200 -> 1440 row, which is kept decision (D3).* These are the
consumer-visible band changes; see the release-cut line below.

| old -> new | newly covered interval | count | file / rule |
|---|---|---|---|
| `max-width: 380px` -> `width < 480px` | 381-479 | 1 | `src/index.css` `:root { --gutter: var(--sp-3) }` |
| `max-width: 560px` -> `width < 768px` | 561-767 | 7 | `src/index.css` `.dr-grids`; `.cex-kpis`; `src/lib-analytics.css` `.gan-card-head`/`.gan-kpis`/`.gan-donut`; `src/lib-analytics.css` `.gan-root .gan-tablecard`; `src/site.css` `.swatches`/`.tip-demo`; `src/site.css` `.tui-bar-row`/`.tui-bar-val`/`.tui-status`; `src/ui/CommitGraph.css` `.cg-row` |
| `max-width: 600px` -> `width < 768px` | 601-767 | 3 | `src/lib-graph.css` `.gmp-toolbar-spacer`; `.gmp-session-destination-summary`; `.gmp-changes-body` |
| `max-width: 620px` -> `width < 768px` | 621-767 | 3 | `src/index.css` narrow guards `.bs-seg`, `.bs-group`, `.steps`, `.pager`, `.cp-keys`; `src/index.css` `.foot-in`; `src/site.css` `.ts-sample`/`.specimen-body` |
| `max-width: 640px` -> `width < 768px` | 641-767 | 2 | `src/index.css` `:root { --gutter: var(--sp-4) }`; `src/site.css` `.res` |
| `max-width: 719px` -> `width < 768px` | 720-767 | 1 | `src/index.css` `.cex-coll-grid` |
| `max-width: 720px` -> `width < 768px` | 721-767 | 9 | `src/index.css` `.iu-bar` compact/`.iu-opt-label`; `.txn-header` mobile; `.mc .mc-toolbar`; `.cex-trow-stats`/`.cex-trow-date`; `.cex-explore-body`; `.cmg-page`/`.cmg-detail` narrow guards; `src/lib-graph.css` `.gmp-navigator-head`/`.gmp-navigator-search`/`.gmp-navigator-body`; `src/site.css` `.cmp`/`.start-jump`/`.icongrid`; `src/ui/MapCanvas.css` `.mc-toolbar` |
| `max-width: 759px` -> `width < 768px` | 760-767 | 1 | `src/index.css` `.cex-grid` |
| `max-width: 860px` -> `width < 1024px` | 861-1023 | 1 | `src/index.css` `.txn-sc-grid`, `.txn-sc-card` stacked |
| `max-width: 880px` -> `width < 1024px` | 881-1023 | 5 | `src/index.css` `.pgn-edge`; `.cex-viewer-body`; `.cex-stream`; `src/site.css` `.cols-2`/`.grid-cards`/`.type-faces`/`.principles`/`.ts-row`; `src/site.css` `.fb-grid`/`.fb-panels` |
| `max-width: 900px` -> `width < 1024px` | 901-1023 | 2 | `src/index.css` `.iu-bar { gap, padding }`; `src/site.css` `.nav-links { display: none }` |
| `max-width: 920px` -> `width < 1024px` | 921-1023 | 1 | `src/lib-analytics.css` `.gan-kpis`, `.gan-grid` |
| `max-width: 1200px` -> `width < 1440px` | 1201-1439 | 1 | `src/site.css` `.sb-link .sb-label { display: none }`, `.sb-link` square — **kept decision (D3)**: the rule now hides the label across the whole laptop band, so the label returns only from 1440 (it returned from 1200 before) |

**D. Narrowed rule coverage — the rule now stops earlier (2 conditions).** *Disposition: kept band
decisions (D2, D3), recorded in the source as decision comments.*

| old -> new | no longer covered | file / rule | disposition |
|---|---|---|---|
| `max-width: 1100px` -> `width < 1024px` | 1024-1100 | `src/site.css` `.nav-in`, `.docs` single column, `.page-rail { display: none }`, `.navctl` nav shed | **kept decision (D2)**: the docs rail is present from 1024 px |
| `max-width: 1460px` -> `width < 1440px` | 1440-1460 | `src/lib-graph.css` `.gmp-merged-chip` drops into flow | **kept decision (D3)**: floating merged chips return from 1440; the retired 1460 was not a scale value |

### Band annex (`bands/`)

Six widths that the standing set does not cover (740, 940, 1060, 1080, 1300, 1450) were captured
with the same capability, from a `/tmp` copy of the case document
(`/tmp/opencode/annex-fixtures/*`, transient; the committed fixture keeps 320/390/1440), against
the same two trees (before `fbdcd0d`, after `b75b79d`), both themes, interleaved before-beside-after
in the default `width-theme-state` order with labelled columns:

**Final-head status of the annex: identity, claimed by construction and re-verified, not
recaptured.** The annex artifacts are the `b75b79d` run retained unchanged (captured at widths
740/940/1060/1080/1300/1450, none of which the 320px fix touches). The fix adds exactly one
declaration scoped to `.pgn-edge`, and **no annex root contains that element**: a bounded DOM check
at 320 over every standing and annex root
(`/tmp/opencode/fairtest-final-evidence/fix-320/annex-scope-check.json`,
`/tmp/opencode/fix320-scope-check.mjs`) reads `pgnOrEdgeInsideRoot: 0` for **12 of the 13 roots**; the
thirteenth, `publish-update` (root `.pub-dialog`), was **not mounted at check time**, so its row is
`null` (`rootFound: false`) rather than a zero, and that one root's absence is recorded here instead
of being counted as a clean result. All six of the document's `.pgn-edge` controls sit inside
`section#pagination.band`, which is not a captured region in any run. The byte-identity result in §2b
is the matching evidence for the standing surfaces. Both annex roots were **re-verified, PASS, 0 failures** on this revision
(`/tmp/opencode/verify-full-740-940.json`, `/tmp/opencode/verify-targeted-1060-1080-1300-1450.json`):
the annex's recorded after-tree was the live `...--wave5/dist` path, which has since been rebuilt at
the final head, so the verifier's byte re-read of those two recorded assets was done with the
preserved `b75b79d` build restored byte-for-byte at that recorded path (the digests match the
recorded `index-ywkUu4lV.js` / `index-3_aa8TVZ.css` hashes) and the final-head dist was put back
afterwards, with both hashes re-confirmed unchanged.

1. `/tmp/opencode/fairtest-final-evidence/bands/full-740-940` — the **full 13-surface set** (the 11
   standing surfaces plus the commons landing view and the site chrome) at **740** and **940**, run
   `annex-bands-full`, verdicts `before=pass` / `after=pass`, 104 rows, 522 shots, 46 unshootable,
   **13 sheets**, elapsed 381.4 s. Independent re-verification: PASS, 0 failures
   (`/tmp/opencode/verify-full-740-940.json`).
2. `/tmp/opencode/fairtest-final-evidence/bands/targeted-1060-1080-1300-1450` — the targeted pairs
   at **1060**, **1080**, **1300** and **1450**, run `annex-bands-targeted`, verdicts
   `before=pass` / `after=pass`, 32 rows, 134 shots, 26 unshootable, **2 sheets**, elapsed 144.3 s.
   Independent re-verification: PASS, 0 failures
   (`/tmp/opencode/verify-targeted-1060-1080-1300-1450.json`).

Sheet files and what each proves:

| sheet (absolute path) | proof |
|---|---|
| `bands/targeted-1060-1080-1300-1450/sheets/sheet-transcript-clip.png` | **D1**: at 1060 `.txn-rail-right` and `.txn-viewsw-state` are unshootable with the identical `display: none` reason in **both** columns; at 1080 they are unshootable before and shot after (the one-pixel consequence of the canonical form); at 1300 and 1450 they are shot in both |
| `bands/targeted-1060-1080-1300-1450/sheets/sheet-site-chrome.png` | **D2**: `.page-rail` is unshootable (`display: none`) before and shot after at 1060 and 1080, shot in both at 1300 and 1450. **D3**: `.sb-label` is absent in both columns at 1060 and 1080, shot before and absent after at 1300 (icon-only from the laptop band down), shot in both at 1450 |
| `bands/full-740-940/sheets/sheet-site-chrome.png` | the 901-1023 widening: at 940 `.nav-links` is shot before and unshootable (`display: none`) after |
| `bands/full-740-940/sheets/sheet-commons-home.png`, and the 12 other full-run sheets | the 641-767 widening: at 740 every region shot is 32 px wider in the fixed build (the page gutter steps to 16 px at 740 instead of only below 641); and the 901-1023 widening: at 940 the in-use bar tightens, shifting stage content by 1-2 px |
| `bands/full-740-940/sheets/sheet-publish-update.png` | the mounted publish dialog at 740/940, including the #131/6 reader-row height change and the picker row |

Measured on the annex records (no pixel counts from the sheets themselves): at 740 the surface
regions widen (`controls-checkbox` 676x2716 -> 708x2810, `states-toggle` 676x6399 -> 708x6253), the
app-tab tiles collapse (`apptab-on` 140x35 -> 69x35, `apptab-off` 240x35 -> 70x35), the transcript
tab strip loses its wrap (`txn-tabbar` 676x116 -> 708x39) and the table tools wrap
(`tbl-search` 626x37 -> 658x62). At 940 only the 901-1023 rules move: the in-use bar's gap/padding
(`apptab-on` `x=651,y=11` -> `x=649,y=12`), the analytics grid, the stacked transcript cards and the
publish reader rows (`pub-access-row` `684x62` -> `684x44`). 260 before/after pairs are comparable
in the full run: 126 byte-identical, 134 differing, of which 79 exceed the AA tolerance and 52
differ in element size.

**Release-cut checklist line (consumer-visible band changes).** The next fairtrade release note must
name: (1) the page gutter now steps at `width < 768px` / `width < 480px` (it used to step at 640 /
380), so content is 8 px wider across 381-479 and 641-767; (2) the compact component bands moved
from 560/600/620/640/720/759 to `width < 768px` and from 860/880/900/920/1023 to `width < 1024px`;
(3) the presentation nav sheds its controls at `width < 1024px` (was 1100) and the storybook link
is icon-only below 1440 (was 1200); (4) the transcript drops its two rails below `width < 1080px`,
a declared exception to the `--bp-*` scale (restores the pre-consolidation behaviour); (5) the graph
merged chips drop into flow below 1440 (was 1460).

## 7. Supplementary viewport sweep and the 320px overflow (FIX-NOW)

### 7.1 The sweep, before and after

The sweep started as 13 widths (320, 360, 390, 480, 560, 640, 700, 768, 880, 1024, 1200, 1440,
1500) x {dark, light} x {reduce, no-preference} x 5 surfaces = 260 checks on the served after tree,
then widened to the 456-check form below; both use the same assertion.

19 widths (320, 360, 380, 390, 480, 560, 640, 700, 740, 768, 880, 940, 1024, 1060, 1200, 1300,
1440, 1450, 1500) x {dark, light} x {`prefers-reduced-motion: reduce`, `no-preference`} x 6
surfaces (transcript, settings, publish popup, home, the in-use app switcher — where the `.iu-bar`
strip itself must also not overflow — and commons) = **456 checks** on the served after tree, each
asserting `documentElement.scrollWidth <= clientWidth + 1` (`/tmp/opencode/overflow-sweep.mjs`).

| head | result | failures |
|---|---|---|
| `b75b79d` (pre-fix) | 444 / 456 clean | **12**, all at exactly 320 px under `reduce`, all six surfaces, both themes: `html 324 / 320` (4 px), does not settle (`/tmp/opencode/overflow-sweep-after.json`) |
| `ddd7a60` (final) | **456 / 456 clean** | 0 (`/tmp/opencode/overflow-sweep-fixed.json`); every other width was already clean and stays clean |

The assertion was not weakened, moved, or re-scoped for this revision: same script, same widths,
same themes, same motion settings, same six surfaces, same `scrollWidth <= clientWidth + 1`.

### 7.2 Diagnosis: the real mechanism, and a correction to the record

A causal hide-and-remeasure test (`/tmp/opencode/overflow-hide-test.mjs`) had named the mounted
pagination specimen's edge button `button.pgn-btn.pgn-edge` (right edge 337 px) and its visually
hidden `span` (right edge 323.5 px). A computed-style and geometry probe
(`/tmp/opencode/diag-pgn.mjs`, kept as
`fix-320/diagnosis-probe.mjs`, run against the pre-fix head and the published before tree, payloads
at `fix-320/diagnosis-probe-b75b79d-build.json` and `fix-320/diagnosis-probe-fbdcd0d-build.json`) then
read the actual boxes rather than assuming them. Both probes now resolve the checkout that owns the
capture driver from `FAIRTRADE_ROOT` (no hardcoded absolute import path; a missing or wrong value
fails with a repair line naming the expected file) and bind every payload to the served bytes - the
real dist root, the worktree head and dirty flag, and the sha256 of each dist asset **as served**
(`servedMatchesDist` re-fetches and re-hashes them, so a server answering from a different tree fails
closed). The pre-fix payload names its preserved tree (`/tmp/opencode/fix320-before-dist`, an explicit
`b75b79d` head label because a preserved copy sits outside its worktree) and the before payload names
the published `fbdcd0d` tree resolved from git; their `runs` blocks remain byte-identical to each
other:

- The `.pgn` row, both edge buttons and the hidden `span` have **identical geometry in both motion
  settings**. What differs is the **containing block of the absolutely positioned span**:
  - under `no-preference`, `section#pagination.band` carries `.reveal` and a computed
    `transform: matrix(1, 0, 0, 1, 0, 26)` — a scroll-reveal lift (`src/site.css`
    `.reveal:not(.philos) { opacity: 0; transform: translateY(26px) }`, inside a
    `@media (prefers-reduced-motion: no-preference)` block). That transform makes the section the
    span's containing block, and `.pds-root { overflow-x: clip }` (the site's phone no-side-scroll
    guard) then contains the 1px box;
  - under `reduce` the rule never applies, the section's transform is `none`, and the span's
    containing block falls back to the **initial containing block**. A clip only applies to
    descendants whose containing block chain passes through it, so the 1px box at `x 322.5`
    (`right 323.5`) is no longer clipped by `.pds-root` and becomes part of the document's
    scrollable overflow: `324 / 320`. The button's own 337 px right edge is clipped as before; only
    the escaped span sets the document width.
- **Correction: this is not a reduced-motion-only defect.** The transform that masks it is also
  dropped when a section reveals (`transform: none`), so under normal motion the same 4 px appears
  as soon as the pagination band is scrolled into view. Measured with a paired probe
  (`/tmp/opencode/fix320-pair-probe.mjs` -> `/tmp/opencode/fairtest-final-evidence/fix-320/pair-probe.json`,
  re-run for this revision; its payload now binds both states by root, worktree head and the served
  sha256 of each dist asset),
  320 px, all six surfaces, both themes, at two scroll states (24 measurements per state): at page
  top the pre-fix tree overflows in **12 of 24**, and with the band scrolled into view it overflows
  in **24 of 24** — both `no-preference` combinations included. The sweep's motion axis is measured
  at page top, which is why it saw only the reduce half. After the fix the same probe reads **0 of
  24 at page top and 0 of 24 revealed** (`fix-320/pair-probe.json`).
- **Pre-existing: confirmed, not corrected**, and now byte-evidenced rather than asserted: the same
  probe against the published before tree (`fbdcd0d`) and against the pre-fix head (`b75b79d`)
  produced **byte-identical payloads** (same `html 324 / 320`, same span `right 323.5`, same edge
  button `right 337`, same containing-block reads), and the CSS rule involved (`.pgn-edge > span`
  visually hidden below 1024 px) predates this stack.
- **Product defect, not a harness artifact.** The document really was 324 px wide in a 320 px
  viewport (a real 4 px horizontal side-scroll on a phone), so the assertion was right to fail. No
  part of the sweep is a measurement artifact.

### 7.3 The fix

One declaration, in the same narrow-viewport rule block that hides the label
(`src/index.css`, `@media (width < 1024px)`):

```css
.pgn-edge { padding: 0; width: var(--control-h-sm); position: relative; }
```

Declaring the control a positioning context makes the absolutely positioned label resolve inside
the control's own box, which is inside `.pds-root`'s clip chain, so the document stays 320 px wide in
every motion and scroll state. This:

- does not blanket-disable motion, and does not touch any `prefers-reduced-motion` block;
- does not weaken the sweep, and adds no media query (the breakpoint guard still scans 42 sheets;
  the touched query is the existing on-scale `width < 1024px`);
- does not change the accepted mobile composition at any width: the control's box, size, colours and
  the label's 1x1 clipped box are unchanged (`position: relative` with no offsets), which §2b and
  the focused pair below prove byte-wise;
- is guarded durably for the next reader: the `mobile-layout` source-text fixture gained the
  required-NAME row `pgn-edge-contains-its-hidden-label` (fixture + manifest), and removing the
  declaration fails that guard with the row named (verified by the mutation). The row now matches
  the whole rule as one literal
  (`.pgn-edge { padding: 0; width: var(--control-h-sm); position: relative; }`), so dropping any
  declaration in it fails the row by name rather than leaving another literal green;
- is guarded by the built-app journey itself: the overflow sweep in
  `scripts/journey/app-validate.journey.mjs` now measures **every** swept width (320, 360, 390, 768,
  1024, 1440) at page top **and** with the `#pagination` band revealed, under **both** motion settings
  (16 measurements, up from 6), and asserts `scrollWidth <= clientWidth + 1` on every one of them.
  **Negative control**: a copy of the built dist with `position: relative` deleted from that one rule
  and nothing else (`/tmp/opencode/neg-dist`, served on its own port) makes the extended guard
  **fail, exit 1**, reporting
  `{"no-preference/320":{"top":0,"revealed":4},… ,"reduce/320":{"top":4,"revealed":4}}` and zeros
  everywhere else (`fix-320/guard-negative-control.log`), while the same guard passes, exit 0, against
  the committed dist. The stale comment attributing a 4px reduce-only reading to the philosophy
  marquee is replaced with the real mechanism above, and the reduce pass at 320 is now asserted
  rather than excluded.

### 7.4 Focused evidence (`fix-320/`)

Both runs use the capture capability, the same two trees (before = the `b75b79d` build kept
byte-for-byte, after = the final head), 320 px, both themes, interleaved before-beside-after, one
surface (`site-pagination`, root `#pagination`) whose probes are the pagination row, both edge
controls and the amber current page:

| run | motion | verdicts | rows | shots | unshootable | sheet |
|---|---|---|---|---|---|---|
| `fix-320/reduce` | `reduce` (the failing condition) | `before=pass`, `after=pass`, 0 failure codes | 4 | 20 | 0 | `sheets/sheet-site-pagination.png` |
| `fix-320/normal` | `no-preference` (control) | `before=pass`, `after=pass`, 0 failure codes | 4 | 20 | 0 | `sheets/sheet-site-pagination.png` |

- In both runs the before and after probe shots are **byte-identical 8/8**: the edge control renders
  identically at 320 px in both themes under both motion settings, so the fix is not a visual
  change (it is a containing-block change).
- The quantitative anchor is `fix-320/pair-probe.json` (paired measurement of
  `documentElement` overflow for all six sweep surfaces at 320, both themes, both motions, at page
  top and revealed, bound to both served trees) and `fix-320/annex-scope-check.json` (no mounted
  captured root contains `.pgn-edge`; 12 roots read 0 and the unmounted `publish-update` root reads
  `null`, §6).
- Independent re-verification (`/tmp/opencode/verify-evidence.mjs`): `fix-320/reduce` **PASS, 0
  failures** (`/tmp/opencode/verify-fix-320-reduce.json`). `fix-320/normal` reports **one** finding
  and it is `after: dirty true` (`/tmp/opencode/verify-fix-320-normal.json`): the control pair needed
  the site's scroll-reveal resolved to be legible, because the driver's own `pauseAnimations` freezes
  an in-flight entrance transition at its first frame (opacity 0) — the capture driver was
  instrumented for that one run (add `.is-in`, wait out the 900 ms entrance), the repo file was
  restored byte-for-byte (`git diff` empty) and the served tree is the committed head's own build
  (asset hashes match §1), so the label records the instrumented driver, not a different product
  tree. The uninstrumented control run produces the same before/after byte identity with the band
  hidden by that paused entrance transition.

### 7.5 Honest accounting: pre-existing vs fixed

| | before `b75b79d` | after `ddd7a60` |
|---|---|---|
| sweep (456 checks, page top) | 444 clean / 12 overflow (320 + reduce) | **456 clean / 0** |
| paired probe at page top (24 measurements) | 12 overflow (320 + reduce, 6 surfaces x 2 themes) | **0** |
| paired probe with the band revealed (24 measurements) | 24 overflow (320, both motions) | **0** |
| captured edge-control shots | – | byte-identical before/after (8/8 per motion) |
| standing capture set | – | byte-identical to the `b75b79d` run (588 shots, 11 sheets) |

What the fix does **not** claim: independent re-review (the apply-only ruling stands, §"Honest state"
above); a clean 0/0/0 across the branch; any change in the accepted mobile composition, reduced-motion
semantics, or the sweep's assertion. One prior statement in this record is corrected rather than
restated: "only under `prefers-reduced-motion: reduce`" was true of the sweep's measurement point and
is false of the defect (§7.2).

## 8. Honest gaps

- **No site-chrome sheet in the standing capture set**; the band consequences in §6 come from the
  annex, and the docs-rail/storybook-label evidence is a probe shot plus its recorded unshootable
  reason, not a full-page documentation capture.
- **The b75b79d mid-update picker note has no captured surface** — not captured, judged from
  source. The capture model navigates and reads only, and the `pending: 'adding'` row only appears
  after an `add` click; the change is covered by the demo-truth mutation pair (both killed) and by
  the source line `readerRows = published ? access.map(... pending === 'adding' || 'approval' ...)`.
  Byte-wise it changed nothing in any captured surface at 320/390/1440.
- **Graph merged-chip band (D3, `lib-graph.css` 1460 -> 1440) is not captured** — not captured,
  judged from source; the graph "changes" view is not in the capture case set.
- **The 24 unshootable transcript right-rail targets at 320/390** are a real width behaviour (the
  rail is `display: none` there), recorded with reasons rather than fabricated.
- The transcript search **bar** (opened by the trigger) is not captured: the capture model
  navigates and reads only. Its overlap behaviour is covered by the journey rows, not by sheets.
- **The 320 px overflow is fixed (`ddd7a60`), not left open**: §7 carries the diagnosis, the single
  declaration, the sweep before/after (444/456 -> 456/456) and the focused pair. Two honest limits
  on that fix: it was applied under the user's FIX-NOW/apply-only ruling and has **not been
  independently re-reviewed**, and the `fix-320/normal` control pair carries `dirty: true` because
  its capture ran with a transiently instrumented driver (§7.4).
- The 320 px fix is **not** claimed to be a reduce-only bug fix: the record's earlier
  "only under reduced motion" statement described the sweep's measurement point and is corrected in
  §7.2; the same 4 px occurred under normal motion once the pagination band revealed.
- The band annex is carried over from the `b75b79d` run without a re-capture for the final head;
  identity is claimed by construction plus the DOM scope check and the standing-set byte identity
  (§6, §2b), not by a fresh annex run. Its two recorded after-tree assets had to be restored
  byte-for-byte at their recorded path for the independent verifier's byte re-read (§6).
- **Exactly 1080 px** differs from the accepted build (rails visible in the fixed build); recorded
  and captured rather than smoothed over (§2, §6-B).
- The delta between the accepted accounting and the fresh one in §5, and the 5-shot/3-sheet
  delta in §2, are capture-run byte nondeterminism; sheet digests are reproducible for the same
  tree but are not a cross-run byte-equality contract. (Two of the §5 pairs are not nondeterminism
  but this revision's own probe rescope; §5 and §10 name them.)
- The fairtest capture capability core was **user-accepted without re-review**, and **the post-fix
  state of this branch was not independently re-reviewed**; this document is the writer's evidence
  package for the applied scope, not a second review round and not a 0/0/0 claim.
- The two `CHROME_PATH`-gated gates (`test:timeline-rendered`, `test:timeline-session-route:mutations`)
  were not part of this run's gate battery; the previous record ran them with `CHROME_PATH` set to
  the Playwright chromium (exit 0, environmental first attempt 1).

### Follow-ups recorded (not fixed here)

Each of these was surfaced by this revision's work and is deliberately left alone: none is a
regression this revision introduces, and fixing one would widen the delivered scope beyond the
approved applied set.

1. **Latent same-pattern hidden labels.** The `.pgn-edge` defect is one instance of a visual-hiding
   pattern that positions a 1x1 box absolutely inside a media block; two more instances carry the
   same latent containing-block escape: `src/index.css:1889` (`.iu-opt-label`, hidden below 768px)
   and `src/index.css:2583` (`.txn-search-trigger-text`, hidden below 480px). Neither is inside a
   capture root that can escape the site root's clip today, and neither is fixed here (a source
   change is out of this task's scope).
2. **`fix-320/normal` instrumented-driver residual.** That control pair's capture ran with a
   transiently instrumented driver (added `.is-in`, waited out the entrance transition) because the
   driver's own `pauseAnimations` freezes an in-flight entrance at opacity 0; the repo file was
   restored byte-for-byte and the run is recorded as `dirty: true` (§7.4). The residual is the
   driver's interaction with in-flight entrance transitions, not the product.
3. **`packages/fairtest/test/isolation.test.mjs` count residual.** Recorded while `test:capture` was
   added to the boundary fixture: the required-script names are derived from the fixture, but a
   count expectation in that file was flagged as still not fully derived from it.
4. **Dead dense-type fixture blocks.** After the last deferred consumer was retired the gate reports
   `0 deferred consumers; retirement will require zero`, so the fixture's `deferredConsumers` block
   (and its manifest name list) is scaffolding that no longer describes a consumer.
5. **Home count formatting.** The in-use home table renders `showing 7 of 1284` with no locale digit
   grouping (`src/ui/DataTable.jsx:211-213` builds the label from the raw host total); pre-existing,
   cosmetic, not changed here.
6. **Raw NUL byte in `src/ui/DataTable.jsx`.** The selection-key separator is a literal `\0` byte at
   line 358 (`selectedKey` joins the sorted keys with it); pre-existing, and out of this task's scope.

## 9. Gate battery exit codes (one run, head `6471209b`, clean worktree)

The same battery the `ddd7a60` record carried, re-run on this head; every exit code and count is
unchanged except the two rows this revision adds (`pnpm journey:ci`, whose guard is now both wider
and negative-controlled, and the bundle verifier).

| gate | exit |
|---|---|
| `node scripts/breakpoint-scale.test.mjs` | 0 (15 cases, 5 mutations killed, 42 sheets scanned) |
| `node scripts/dense-type.test.mjs` | 0 |
| `node scripts/port-record.test.mjs` | 0 (3 sources, 10 mutations killed) |
| `node scripts/mobile-layout.test.mjs` | 0 (14 invariants) |
| `pnpm test:demo-truth` | 0 (18 production mutations killed) |
| `pnpm test:design-decisions` | 0 |
| `pnpm --filter @peasant-labs/fairtest test:capture` | 0 (26 tests) |
| `pnpm gen:check` | 0 (zero-diff; worktree clean afterwards) |
| `git diff --check` | 0 |
| `pnpm build:lib` | 0 (the `mobile-layout` guard inside it now runs 14 invariants, up from 13) |
| `pnpm build` | 0 |
| `pnpm journey:ci` | 0 (122 passed, 54 skipped, 12.1 min; the built-app overflow guard now runs 24 measurements per project) |
| bundle verifier (`/tmp/opencode/verify-evidence.mjs`, clean copy root) | 0 (PASS, 0 failures: 132 rows, 744 targets, 720 shots, 24 unshootable, 11 sheets, 1001 files, 0 stray, 0 missing) |

| added/mutated guard (this revision) | exit |
|---|---|
| `node scripts/mobile-layout.test.mjs` with the new declaration removed | **1**, failing the named row `pgn-edge-contains-its-hidden-label` (`/tmp/opencode/mutation-mobile.log`; restored run `/tmp/opencode/restored-mobile.log`, exit 0) |
| `pnpm journey:ci`'s built-app test against the negative control (`/tmp/opencode/neg-dist`) | **1**, reporting the 320px overflows and nothing else (`fix-320/guard-negative-control.log`) |

The dist hashes and the fix marker were re-checked after these rebuilds
(`dist/assets/index-Dr3SWh4l.css` `6d7ab031…`, `dist/assets/index-bvmS1ugF.js` `c03328f6…`,
`pgn-edge{width:var(--control-h-sm);padding:0;position:relative}` present exactly once, zero times in
the pre-fix build), and the worktree is clean at `ddd7a60` with no untracked files.

### 9b. The extended guard (head `6471209b`)

The overflow sweep this revision extends runs inside the same built-app journey test; measured on
this head, dark project, one run each:

| run | shape | test wall time | exit |
|---|---|---|---|
| guard before this revision | 6 widths, page top, full motion only (6 measurements) | 22.8 s | 0 |
| guard after this revision | 6 widths x page top + revealed x both motions (24 measurements) | 40.7 s | 0 |
| extended guard, **negative control** (`/tmp/opencode/neg-dist`, `position: relative` deleted from the one rule) | same 24 measurements | 39.6 s | **1** |

Added wall time per project run: **+17.9 s** (22.8 s -> 40.7 s), i.e. about +36 s across the journey's
two projects, for 18 extra measurements and the bounded wait that lets each section's reveal
transform resolve (15 s cap; immediate under reduce, ~900 ms otherwise). Full-suite timing on this
head is in §9's `pnpm journey:ci` row.

## 10. Binding to this revision's head (`6471209b`)

This revision's head is `6471209b423c50ca8d6e900dc3ecfe9c5e074053` (base = the wave 4 branch
`fbdcd0d30f5595b752eaa3e7d8c1fa11a15f6dd7`, PR `#158`, top of stack `#157`). It adds three
test-side commits and **no `src/**` change**, so the built tree is the `ddd7a60` build byte-for-byte:
`dist/assets/index-Dr3SWh4l.css` `6d7ab031…` and `dist/assets/index-bvmS1ugF.js` `c03328f6…` after a
clean `pnpm build`, and the fix marker present exactly once. Every artifact this document keeps from
`ddd7a60` is therefore valid for this head unchanged.

**Recaptured at this head:** the `inuse-home` surface only, after its `tbl-count`/`tbl-search` probes
were scoped under `.iu-page`. The recaptured records read the in-use home table's own
`showing 7 of 1284` (the unscoped probes read the docs demo table's `showing 4 of 4`), and its
`iu-search` and row surface-region shots are byte-identical to the accepted ones, so scoping is a
no-op where the probes already resolved inside the region. That recapture is why §5's split is
272/88 here against the preserved run's 274/86; the two moved pairs are named there and are the
rescoped `tbl-count` pairs, not the 320px fix.

**Re-run at this head:** both `fix-320` probes (now resolving their checkout from `FAIRTRADE_ROOT`
and binding each payload to the real root, head and served asset digests) and the extended guard's
negative control. The probes' numbers are unchanged; the negative control fails as §7.3 records.

The durable mirror is the new prefix `wave5-6471209b` on the screenshots branch, carrying only the
corrected/recaptured pieces plus this document and `BINDING.md`; the accepted prefix `wave5-ddd7a60`
is untouched. `BINDING.md` enumerates the delta (1 added file, 49 changed files, 0 removed) and
records the merged bundle's own verifier result.


Logs and raw outputs: `/tmp/opencode/g320-breakpoint.log`, `g320-densetype.log`,
`g320-portrecord.log`, `g320-demotruth.log`, `g320-decisions.log`, `g320-gencheck.log`,
`g320-buildlib.log`, `g320-build.log`, `g320-journeyci.log`, `wave5-capture-main-final.log`,
`fix320-reduce.log`, `fix320-normal.log`; verification and diff outputs
`verify-main-final.json`, `verify-main-canonical.json`, `verify-fix-320-reduce.json`,
`verify-fix-320-normal.json`, `verify-full-740-940.json`,
`verify-targeted-1060-1080-1300-1450.json`, `fix320-pair-identity-new.json`,
`fix320-pair-identity-prev.json`, `pngdiff-pairs.json` + `pngdiff` output,
`annex-full-diff-pairs.json` + `annex-full-diffout.json`, `overflow-sweep-after.json`,
`overflow-sweep-fixed.json`; the three `node scripts/*.test.mjs` runs and `git diff --check`
printed to the run transcript (exit codes captured above).

Added by this revision (head `6471209b`): `gate-breakpoint-scale.log`, `gate-dense-type.log`,
`gate-port-record.log`, `gate-mobile-layout.log`, `gate-demo-truth.log`, `gate-design-decisions.log`,
`gate-fairtest-capture.log`, `gate-gen-check.log`, `gate-git-diff-check.log`, `gate-build-lib.log`,
`gate-build.log`, `gate-journey-ci.log`, `mutation-mobile.log`, `restored-mobile.log`,
`guard-iterate.log`, `guard-old-timing.log`, `inuse-home-recapture/recapture.log` +
`inuse-home-recapture/out/**`, `merge-inuse-home.json`, `merge-inuse-home.mjs`,
`verify-main-merged.json`, `fix320-pair-identity.mjs`, and
`fix-320/guard-negative-control.log`; the pre-recapture copies of every replaced file are preserved
at `/tmp/opencode/fairtest-final-evidence-premerge-inuse-home/`.

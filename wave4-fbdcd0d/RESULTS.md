# Focused evidence: amber restoration + offline scroll region (candidate fbdcd0d)

Local mounted UAT evidence only. No review verdict, no publication, no push/merge/closure.
Worktree `/home/minttea/dev/peasant-labs/fairtrade-design-system/fairtrade-design-system-116--fix--amber-selected`
verified clean at `fbdcd0d30f5595b752eaa3e7d8c1fa11a15f6dd7` before any step (base/published
`a718f764532dcd0e67cccb99723c61d0dc7d6943`). No repository source, fixture, lockfile or doc was
changed, so no commit was needed. The bundle-local capture tooling, captures, sheets, provenance
and this file were revised in place by the evidence-record repair recorded in section 2; the
pre-repair bundle is preserved byte-for-byte in `superseded-pre-repair-2026-10-14/`.

## 1. Fairtest evidence bound to fbdcd0d

Env: `FAIRTEST_RUN_ID=amber-fbdcd0d`, `FAIRTEST_RUN_ROOT=/tmp/opencode/amber-restore-fbdcd0d/fairtest/amber-fbdcd0d`,
`FAIRTEST_APP_PORT=5289`, `FAIRTEST_STORYBOOK_PORT=6118`, `JOURNEY_HTML=0`. Fresh run root (no reused subtree).
`pnpm build` (exit 0, dist hashes identical to the a6fe178 build: `assets/index-C7TroAbe.js`,
`assets/index-CMB0VUbW.css`), `pnpm build-storybook` (exit 0).

Producers ran in SEPARATE commands:

| command | exit |
|---|---|
| `node scripts/fairtest/init-fairtest.mjs` | 0 |
| `node scripts/fairtest/list-fairtest.mjs --mode=ci` | 0 |
| `node scripts/fairtest/list-fairtest.mjs --mode=local` | 0 |
| `node scripts/fairtest/select-fairtest.mjs` | 0 |
| `node scripts/fairtest/selection-receipt.mjs` | 0 |
| `FAIRTEST_CI_PROCESS=1 pnpm test:fairtest:process` | 0 (18/18) |
| `pnpm test:fairtest:mounted -- --target=product` | 0 (4/4 rows) |
| `pnpm test:fairtest:mounted -- --target=component` | 0 (20/20 rows) |
| `pnpm test:fairtest:verify` | 0 (24 of 24 required rows, 6 artifact classes, verdict pass, 0 failure codes) |
| `pnpm test:fairtest:preflight` | 0 (run root complete and ready for durable upload) |

`components-promptdigest--split` dark and light both passed; the producer asserts the actual
`count=2` options under the corrected `DIGEST_LIST` (`ul[role="listbox"][aria-label="transcripts"]`),
the keyboard transition and the selection state, not a mount-only check.

Logs: `fairtest-envelope.log`, `fairtest-process.log`, `fairtest-product.log`, `fairtest-component.log`,
`fairtest-verify-preflight.log`. Evidence report: `fairtest/amber-fbdcd0d/evidence/evidence.json`
(`complete: true`, `verdict: "pass"`).

Provenance (from the producer records): every row names commit
`fbdcd0d30f5595b752eaa3e7d8c1fa11a15f6dd7`, `dirty: false`, `servedFrom: run-root-dist`
(product) / `storybook-static` (component), with served asset digests byte-equal to the rebuilt dist.
These producers were NOT re-run during the evidence-record repair.

## 2. Matched, inspected before/after captures

Both builds served from loopback static servers (`serve.mjs`, 5381 = fbdcd0d dist, 5382 = a718f764 dist);
served bytes were asserted byte-equal to each build's `dist` before any capture. Post-repair
inventory, reconciled against disk by `analyze.mjs` (`analyze.log`): 96 region shots (8 surfaces x
320/390/1440 x dark/light x before/after); 360 probe records (28 probe names / 21 selectors); 72
selected-hover probes; 96 keyboard-focus records (88 shots, 8 explicit unshootable); 0 errors; 360
of 360 probe reads in viewport at read time. Shot honesty: 600 PNG files written and 600 recorded
shot references, so **0 recorded references without a file**; 24 targets are recorded explicitly as
`unshootable` with a reason (16 narrow-width transcript records + 8 narrow-width ViewSwitch focus
records) and are never counted as shots; 11 explicit gaps cover unmounted / unshootable cases.
Element-clipped shots only; theme asserted per row; fonts awaited; animations paused.

Full report: `captures/probe-report.json`. Contact sheets (built from the originals): `sheets/`
(`sheet-focus.png` is new). Pixel comparison over all 264 before/after pairs:
`pixel-report.json`, `pixel-compare.log`.

Observed before -> after computed values (desktop; all widths agree):

| family | element | before (dark / light) | after (dark / light) |
|---|---|---|---|
| checkbox checked | `.check-box:checked` bg | `#141413` / `#f4f2ec` (neutral) | `#cba35c` / `#b8841a` (amber-fill) |
| switch on track | `.sw[aria-checked="true"]` bg | `#141413` / `#f4f2ec` | `#cba35c` / `#b8841a` |
| switch on thumb | `.sw::before` | `#e9e5db` (ink) / `#27241f` | `#141003` / `#1a1206` (amber-fill-ink) |
| bs-toggle on | `.bs-toggle[aria-pressed="true"]` | `#141413`/`#e9e5db` / `#f4f2ec`/`#27241f` | `#cba35c`/`#141003` / `#b8841a`/`#1a1206` |
| bs-seg-opt on | `.bs-seg-opt[aria-pressed="true"]` | neutral | amber-fill / amber-fill-ink |
| chip-toggle on | `button.chip-toggle[aria-pressed="true"]` | neutral | amber-fill / amber-fill-ink |
| analytics segment on | `.gan-seg.is-on` | neutral | amber-fill / amber-fill-ink |
| app tab on | `.iu-opt-on::before` bar | `#6f6a5f` / `#8b836d` (rule-strong) | `#cba35c` / `#8a5f1f` (amber) |
| app tab on icon/key | `.iu-opt-ico`, `.iu-opt-key` | `#e9e5db` / `#27241f` | `#cba35c` / `#8a5f1f` |
| transcript switch label | `.txn-viewsw-on-state` | `#b8b3a4` / `#4a463e` | `#cba35c` / `#8a5f1f` |

Unselected states: the earlier "byte-identical" wording was an overclaim and is corrected here.
Over the 54 off/unselected before-after pairs (`pixel-report.json`), **50 are byte-identical**.
For every off probe the measured background, foreground, border, thumb and opacity are identical
before vs after, with one precise exception: the unchecked checkbox's `::after` tick stroke reads
differently in the computed style (dark `#e9e5db` -> `#141003`, light `#27241f` -> `#1a1206`)
because it shares the restored token, but no tick is painted while unchecked, so those PNGs are
byte-identical. Four pairs still differ at their edge: `bs-seg-off` at 390 dark/light, 36 px each,
all in the outer column `x=0`, max channel delta 183 / 210 - that column is the 1px clip edge and
samples the adjacent **selected** option (before: neutral `#141413`/`#f4f2ec`; after: the restored
`#cba35c`/`#b8841a` amber-fill); excluding the outer 1px frame those pairs are identical
(`innerDiffPx=0`). `bs-seg-off` at 320 dark/light keeps 4 px of subpixel anti-aliasing on the shared
boundary with the adjacent selected option (max delta 24 / 2). The original shots carried a
pointer-hover bleed on that same edge (the captured edge pixel was `#e6c483` amber-bright, the
hover fill); the 7 contaminated combos were re-taken with the pointer parked outside the control
group, which changed that edge to the non-hover fill in both builds. No not-authorized surface
moved: the off controls' own pixels are unchanged.

Selected-hover (the authorized contrast-safe pair) measured live at 320/390/1440, both themes:

| family | dark | light |
|---|---|---|
| bs-toggle on hover | 11.39:1 | 7.63:1 |
| bs-seg-opt on hover (presentation + in-use) | 11.39:1 | 7.63:1 |
| chip-toggle on hover | 11.39:1 | 7.63:1 |
| gan-seg on hover (no amber-bright hover rule) | 8.08:1 | 5.61:1 |
| inuse-seg on hover | 11.39:1 | 7.63:1 |

`.cmg-roleseg` has no reachable mounted instance in the served demo. The live
`?app=commons&commons=collective-detail` view is the shipped `CollectiveDetailView` from
`src/ui/commons/Collectives.jsx` (it renders the Acme Platform fixture and mounts no
`.cmg-roleseg` / `.cmg-roleswitch` at all, not even a read-only indicator). The interactive
`aria-pressed` switcher lives in `src/ui/commons/Manage.jsx`, which has no mounted consumer
(`src/mockups/inuse/CommonsManage.jsx` is the only demo that uses it, and it is reachable solely
through `?commons=publish` / `?commons=contribute`). On both builds `?commons=contribute` throws
pre-existing `ProviderMark is not defined` and `?commons=publish` throws pre-existing
`Terminal is not defined`. Its rule was reviewed in the diff, not mounted-captured. This is
recorded as gap `commons-manage` in `captures/probe-report.json`.

Responsive note: at 320/390 the element's own `display` is `block`, and its nearest ancestor with
`display: none` is the transcript right rail `aside.txn-rail-right` (hidden at <=1080px), so the
whole ViewSwitch (switch + label + state) is unrendered at those widths in both builds. The
visible `.sw` probes at those widths are other switch instances on the page. The 16 affected
targets (`txn-viewsw-state`, `txn-viewsw-on-state` at 320/390, both themes, both builds) are
recorded as explicit `unshootable` records with that exact reason - not as shots. The state label
is captured at 1440 in both themes and both states.

### Disabled and keyboard-focus representatives (added by the repair)

The only mounted native-disabled instances among the restored families are the two locked switches
in `#states`; both are captured at 320/390/1440 in both themes and both builds.

| probe | build | disabled | opacity | track bg | `::before` thumb | adjacent `.sw-state` |
|---|---|---|---|---|---|---|
| `.sw[aria-checked="false"][disabled]` | before | true | 0.5 | `rgb(20,20,19)` | `rgb(154,148,136)` | `rgb(154,148,136)` |
| `.sw[aria-checked="false"][disabled]` | after | true | 0.5 | `rgb(20,20,19)` | `rgb(154,148,136)` | `rgb(154,148,136)` |
| `.sw[aria-checked="true"][disabled]` | before | true | 0.5 | `rgb(20,20,19)` | `rgb(233,229,219)` | `rgb(154,148,136)` |
| `.sw[aria-checked="true"][disabled]` | after | true | 0.5 | `rgb(203,163,92)` | `rgb(20,16,3)` | `rgb(154,148,136)` |

The disabled off switch is byte-identical before/after (0 differing px). The disabled on switch
moved from the neutral track to the restored amber-fill track (1456 px, max channel delta 109 dark
/ 105 light) at 50% opacity - the checked treatment is restored even while disabled. No other
restored family has a mounted native-disabled instance; each is recorded as an explicit gap with
the reason (checkbox, bs-toggle, chip-toggle, iu-opt, txn-viewsw: none; bs-seg-opt: only the
runtime conditional `disabled={!pageRows.length}` in `src/ui/commons/Explore.jsx:682`, enabled with
the demo fixture; gan-seg: only the runtime conditionals `disabled={!hostEnabled}` /
`disabled={!canShowNew}` in `src/ui/analytics/ProjectOverview.jsx:373,409`).

Keyboard `:focus-visible` representatives were captured per family with real key events
(script-focus, leave with Shift+Tab, return with Tab); at shot time `document.activeElement === el`
and `el.matches(':focus-visible')` were both asserted, and all 88 written focus shots satisfy both.
Focus shots are padded so the ring is visible. At 1440 dark (outline 3px, offset 0px, style shown):

| family | before ring / bg | after ring / bg | `:focus-visible` |
|---|---|---|---|
| `.check-box:checked` | `rgb(184,179,164)` / `rgb(20,20,19)` | `rgb(184,179,164)` / `rgb(203,163,92)` | true |
| `.sw[aria-checked="true"]:not([disabled])` | `rgb(233,229,219)` / `rgb(20,20,19)` | `rgb(233,229,219)` / `rgb(203,163,92)` | true |
| `.bs-toggle[aria-pressed="true"]` | `rgb(233,229,219)` / `rgb(20,20,19)` | `rgb(20,16,3)` / `rgb(203,163,92)` | true |
| `.bs-seg-opt[aria-pressed="true"]` | `rgb(233,229,219)` / `rgb(20,20,19)` | `rgb(20,16,3)` / `rgb(203,163,92)` | true |
| `button.chip-toggle[aria-pressed="true"]` | `rgb(233,229,219)` / `rgb(20,20,19)` | `rgb(20,16,3)` / `rgb(203,163,92)` | true |
| `.iu-opt-on` (`button[role=tab]`) | `rgb(248,245,237)` / `rgb(27,26,23)` | `rgb(248,245,237)` / `rgb(27,26,23)` | true |
| `.gan-seg.is-on` | `rgb(233,229,219)` / `rgb(20,20,19)` | `rgb(20,16,3)` / `rgb(203,163,92)` | true |
| `.txn-viewsw .sw` (1440 only) | `rgb(233,229,219)` / `rgb(20,20,19)` | `rgb(233,229,219)` / `rgb(203,163,92)` | true |

The `.txn-viewsw .sw` focus representative is unshootable at 320/390 (the whole ViewSwitch is in
the hidden right rail) and is recorded as such rather than skipped or faked.

Chip count child gap: `button.chip-toggle[aria-pressed="true"] .cex-topic-n` is **unmounted in both
builds**. Its only source usage is the dead-code `ExploreView`
(`src/mockups/inuse/CommonsExplore.jsx:671-684`), which is exported but never imported - the live
explore route renders the shipped `Explore` from `src/ui/commons/Explore.jsx`. The class string is
absent from both built bundles (`grep -o cex-topic` = 0 in each dist) and the live query count is 0
on `#badges` and on `?app=commons&commons=explore` in both builds. The served explore rail renders
a different, pre-existing chip-with-count family (`.fr-topic` / `.fr-count` from
`src/ui/FacetRail.jsx`, 12-19 and 17-29 live) that this diff does not touch. Recorded as gap
`badges-chip` with the full evidence chain.

### Repair record (2026-10-14)

Four evidence-record findings on this bundle were repaired on the user's directive without a new
review wave. They were evidence-record-only: (1) disabled-state and keyboard `:focus-visible`
representatives plus the chip-count probe were missing, and `focus` was `[]`; (2) the section-2
counts claimed "0 missing shots" while 16 referenced shots had no file; (3) the "byte-identical
unselected states" wording was contradicted by a pointer-hover bleed in the off-state PNGs; (4) the
`.cmg-roleseg` note named the wrong live view and the wrong publish-route error. The repair changed
only bundle-local tooling (`capture.mjs`, `analyze.mjs`, `sheets.mjs`, `provenance.mjs`, new
`pixel-compare.mjs`), the captures it re-took or added, the sheets, provenance and this file.
**No independent re-review was performed (user-waived), so this is not a clean 0/0/0 claim and not a
claim that the evidence was independently re-verified after repair.** The candidate product code is
unchanged at `fbdcd0d`; nothing was published. The pre-repair bundle, including all 488 original
PNGs and the original `probe-report.json`, is preserved in `superseded-pre-repair-2026-10-14/`.

## 3. Offline home keyboard proof

`offline-keyboard/offline-keyboard.json`; shots `offline-keyboard/*.png`; the axe delta is
`offline-keyboard/axe-compare.json`, produced by the repo's own shared primitive
(`scripts/journey/lib/assertions.mjs` `scanAxe` / `seriousViolations`, tags `wcag2a,wcag2aa`).
These were NOT re-run during the evidence-record repair.

| observation | before a718f764 | after fbdcd0d |
|---|---|---|
| named region | `div[aria-label="sessions on this computer"]`, role=region, tabIndex=0 | same |
| disabled-fieldset ancestor | `fieldset[aria-label="session table"]` (DISABLED) | none |
| Tab reaches the region (320/390/1440) | yes (stop 8-9) | yes (stop 8-9) |
| ArrowDown/PageDown moves `scrollTop` | yes (0 -> 105) | yes (0 -> 111) |
| disabled controls in scope | 8 inputs, 7 buttons, 1 select (16) | identical 16 |

Scoped (`#inuse`) axe serious violations, all six width/theme combinations:

- before: `scrollable-region-focusable` on `div[aria-label="sessions on this computer"]` at every width,
  plus `div[aria-label="publish state"]` at 320/390.
- after: `sessions on this computer` is CLEARED at every width. `div[aria-label="publish state"]`
  remains at 320/390.

The `publish state` region violation is a PRE-EXISTING narrow-width finding, present identically in
both builds and outside this fix's scope. Chromium allowed keyboard focus and arrow scrolling of the
`sessions` region in both builds; the difference the fix makes to the mounted DOM is that the region
is no longer inside a disabled fieldset (which is exactly what the fixture asserts), and the scoped
axe violation on that region clears. Page-wide axe still reports the same 7 pre-existing villa-wide
serious ids in both builds (unchanged population, not gated page-wide by the product rows).

## 4. Scoped Storybook smoke

`node scripts/sbsmoke.mjs controls` (`CHROME_PATH` = playwright chromium-1243) exit 0:
44 of 524 stories matched, 44 loaded, 0 with real errors, 3 with `favicon.ico (404)` resource noise.
The existing smoke filters by ONE id substring, so this single scoped run covers the
controls/* stories (Checkbox, Switch, Button incl. segmented control and disabled states); the
remaining affected stories (components/Chip, in use/transcript/TranscriptViewSwitch,
TranscriptCheckRow, TranscriptFiltersRail, analytics/ProjectOverview) are covered mounted by the
before/after captures above, not by a second smoke. Log: `storybook-smoke.log`. Not re-run during
the repair.

## Honest state

The one authorized reviewer-mini-deepseek three-lens round has since run against `fbdcd0d`: Axis C
ACCEPT with no findings; Axes A and B returned REVISE with four MINOR findings, all of them
evidence-record-only (this bundle's inventory, wording and representative coverage) and
independently confirmed to contain no product defect. Those four MINOR findings were repaired here
on user directive with NO independent re-review, so the round is not a clean 0/0/0 and the repaired
bundle has not been independently re-verified. The producers, verifier, preflight, the offline
Tab/arrow proof and the scoped Storybook smoke were preserved and not re-run. No authorized
behaviour changed: the eight approved amber families are restored, the contrast-safe hover pair is
measured at 11.39/7.63, the offline region is out of the disabled scope with every control still
disabled, and the type/gutter/target floors are untouched. Next step is renewed user visual UAT
before any PR156 update. Nothing published; PR #156 head unchanged.

# Wave 2 visual-fix evidence — mapping and provenance (explicit)

Accepted by the user: "ACCEPT corrected mobile styling", feedback "No additional feedback".
Source published: PR #153 branch `fairtrade-design-system-116--wave2` at final head `7da5bcb05ac455cb01792243971a4d2e63b85d75` (before `72cc9d4a71d39f7f6968e669b13efa463b02f8b2`).

## Capture-head identity (do not mislabel)
- `pairs-final/` — captured at the TRUE FINAL head `7da5bcb05ac455cb01792243971a4d2e63b85d75`. Tables at 320/390, both themes (8 pairs). This is the authoritative set for the phone table cases and for the visible search cue.
- `pairs-phone/` — captured at the phone-fix head `cc0fee0378cd14262cc12a9cd4cedb592f124941` (earlier than the final head). All surfaces at 320/390/1440, both themes (48 pairs), BEFORE `72cc9d4`.
- `styling oracle` — published W1 `4ee5362` pairs live separately (wave1-4ee5362 / wave2-before-after); they are NOT the fix comparison.

## Unchanged-source accounting (capture head `cc0fee0` -> final `7da5bcb`)
Commits between them: `4e16944` (test-only contract update), merges `52b2c05`/`02aaff5` (tree-preserving; message-only reword), `bbe6cce` (fairtest evidence fixture; not rendered), `7da5bcb` (visible search cue — affects the table search control only). Therefore:
- For every surface except the table search control, the `pairs-phone/` images are visually identical to the final head (same rendered source; test-only + fixture + message changes).
- For table cases at 320/390, `pairs-final/` supersedes the corresponding `pairs-phone/` table images (the search cue merged at `7da5bcb`).
- Table images at 1440 remain in `pairs-phone/` with the capture-head `cc0fee0` label; treat `pairs-final/` as authoritative wherever a table case at 320/390 is needed.

## Provenance files
- `pairs-final/provenance-manifest.json` — candidate `7da5bcb`; served-asset hashes recorded at capture time.
- `pairs-phone/provenance-manifest.json` — baseline `72cc9d4`, candidate `cc0fee0`; served-asset hashes recorded at capture time.

## Inspection
All accepted images were inspected (worker reports on `plabs-facf4r.1`, `plabs-cmdkdx`, `plabs-yvrcd2`; verification round `plabs-bqpuxe` re-inspected the refreshed pairs and the unchanged set). No content is hidden in any capture.

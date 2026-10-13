# Mounted before/after evidence

Local evidence for UAT only. No review verdict, acceptance, publication, merge, push, or task closure is claimed.

- Before: `248ba87deb136b462a29051afdf7e932cb8a015b`, detached build served on 5322.
- After: `a718f764532dcd0e67cccb99723c61d0dc7d6943`, consolidated build served on 5321.
- Eleven surfaces; actual dark/light themes; 390 and 1440 widths; 1100 viewport height. 88 primary images plus 56 supplemental detail images. Every original is represented in an inspected contact sheet (all 18 sheets inspected). Supplemental images scroll real mounted content into view; no CSS overrides, hidden elements, or capture-only content changes.
- Both builds passed `pnpm build` (contrast included); frozen install passed on after. Before reused after node_modules via symlink with dependency verification disabled for the build invocation only. Build logs: `/tmp/opencode/w4-{before,after}-build.log`.
- `provenance.json` records each URL, actual theme, surface selector, mounted text, root/shell bounds, scroll position, provider marks, asset sha256, full source head, and served-byte equality with each build's dist. Primary screenshots verify mounted shell/body, not presentation hero. Detail frames supplement rather than replace primary context.
- Fonts ready before capture; reduced motion and symmetric animation pause/currentTime=0 applied to both builds. Existing product UI state/fixture used. No full-catalog tests repeated in this evidence-only pass; independent reviews/gate records remain separate.

## What the pairs show

| Surface | Visible change / evidence boundary |
|---|---|
| offline-home | New stale-data body line with last-loaded time; search now accurately searches session titles; disabled search/filter appearance; weeks-with-sessions statistic replaces longest streak. Both widths show mounted stale state and normal gutters. |
| folder-settings | Publishing-plan explanation now points to folder rules; detail shows the acme/worker exception and pre-push-hook preservation instead of saying the whole company rule is blocked. Long copy wraps, without capture-side padding adjustments. |
| project-analytics | New sessions, contributors in multiple weeks, sessions linked to commits, weeks with sessions replace the previous overstated labels. Metadata separators are commas. Longer labels wrap at 390; existing card arrangement remains. |
| changes-legend | Primary shows singular +1 more session and full lowercase calendar dates. Detail proves literal star explanation in mobile and desktop, replacing the sparkle claim; comma replaces the old separator. |
| local-transcript | fairtrade-design-system replaces archived project name; 9 turns replaces 8 in metadata; one-based phase labels. Detail shows canonical returned-to-claude footer now has Claude mark immediately before provider name, retaining elbow. |
| village-transcript | Canonical transcript title replaces the false Fix flaky ingest test override; count and phase corrections. Detail shows the same canonical footer mark on the village-mounted route. Longer real title increases mobile header height as expected; no title hiding or typography shrink. |
| village-account | GitHub mark now leads github; account row uses comma rather than middot. Primary and detail show real connection row. |
| published-pull-request-digest | sessions becomes transcripts in counts/list, view on village becomes open pull request digest. Mounted digest with genuine app chrome in both widths/themes. |
| published-completion | Completion dialog itself shows no material layout/copy change. Background publish status is now genuinely published/up-to-date instead of not published; project/phase/separator corrections remain visible behind the existing modal blur. This is state-truth evidence, not a dialog redesign claim. |
| returned-provider | Separate CommonsExplore detail has new Claude mark before returned provider, and token magnitude now 412.3k rather than 412,300. Detail makes footer visible; primary shows actual transcript route, counts and chrome. |
| village-calendar-dates | Detail shows lowercase calendar chrome in real cards. Dates also move one day forward from locale/time-zone rendering to canonical date-only display (first card Jun 14 -> jun 15, second Jun 13 -> jun 14). Mobile primary has cards below the fold; use detail for date evidence, not primary alone. |

No unexpected visual regression identified in the inspected before/after set. Existing phone horizontal metadata/tabs and compact app switcher remain; changed copy wraps without blanket control growth or changed outer gutters. This observation is not an independent review verdict or user acceptance.

## Capture execution history

Initial capture invocation stopped on an after-only folder exception selector being absent in BEFORE. Selector was made symmetric using the shared acme/worker text (account likewise uses shared github text rather than after-only mark selector). Later invocations stopped on changes overflow text because innerText separates +1 and more session with a newline. The final invocation preserves that content assertion and normalizes whitespace; it completed successfully. These were harness matching errors, not inspected product regressions; no visual finding was hidden by retaking. Final full set was inspected after capture. Additional legend/calendar details were added, not substituted for primaries, to expose offscreen changed content.

Capture scripts are outside the repository: `/tmp/opencode/w4-capture.mjs` and `/tmp/opencode/w4-supplement.mjs`. No shipped source, tests, lockfile, or tracked docs changed; no commit created. Preview servers stopped and temporary before worktree removed after verification. After worktree remains clean at the exact supplied head. Nothing published; supervisor owns any durable PR upload and UAT presentation.

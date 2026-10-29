# transcript data-binding contract

The canonical reference for how the transcript **wire** maps to the cooked **view model** that every
presentational component renders. It tells each consumer (the lifted fairtrade components, and
peasant / village) per field: what the backend provides, what the one adapter cooks, what is
fixture-fed today pending a backend surface, and what is already shipped.

Two seams own this contract end to end:

- **`@peasant-labs/schema`** — the generated canonical wire types and runtime enum objects. Fairtrade
  imports them through `wire-types.js`; it does not maintain a second copy of the contract.
- **`wire-types.js`** — schema-backed re-exports plus the explicitly named `LegacyGitContext` and
  `LegacyCommit` accepted only by `TranscriptWireInput`. No component binds a wire type directly.
- **`view-model.js`** — `TranscriptViewModel`, the cooked output of `adaptTranscript`. Field-for-field
  it is every component's prop contract.

`adapter.js` (`adaptTranscript`) is the only code that reads the wire and the only legacy-compatibility
boundary. Canonical flat `gitBranch`, `gitRemote`, and `workingDirectory` win when both shapes are
present; nullable canonical `turns` becomes an empty list. Both data modules carry `// @ts-check` and are pinned by `tsc -p tsconfig.contract.json`
(`pnpm test:contract`).

## normalized evidence, current sources, and earlier history

`adaptTranscript(durablePayload, annotations, analytics, options)` validates the complete
evidence-bearing value with schema's `parseSessionDetailPayloadValue` before filtering. Hosts
must still use the canonical text parser at the network boundary for lexical JSON validation.
Do not pass the flat read DTO as durable content: separate `relationshipNavigation` into
`options.relationshipNavigation`. Village supplies this option from metadata, not from `/content`.

The adapter protects turns with source refs, present provenance (including unknown evidence),
or folded call/result evidence. Protected rows bypass legacy noise removal, equal-text collapse,
and leading `<thinking>` inference. Only normalized `entryType: thinking` cooks a protected
`ThinkingVM`. Truly legacy rows retain their old filter and wrapper behavior. The exported
`prefilterTurns` uses canonical field validators; full cross-partition identity/attachment checks
belong to the complete-payload adapter boundary, never a synthetic partial payload.
The adapter cooks the canonical parser's returned value, including its optional-empty-ref
normalization, while retaining the explicitly supported legacy `gitContext` extension.
Optional empty refs do not weaken required usage-owner/source or attachment validation.

Cooked `TurnVM.identity` is scoped by `partition` (`main` or `earlier-N`) plus source ref, falling
back to the index only for legacy rows. Refs/provenance and folded refs/provenance are retained.
`vm.earlierHistory` contains independently cooked turns, usage scopes and native metadata. Main
indices, filters, annotations, totals and tool lookup maps never incorporate an earlier section.
The viewer renders earlier history collapsed before the first current turn; expanding reads
already-captured data and never fetches a parent. Earlier DOM anchors are scoped and never alias
the main `turn-N` anchors or main active-turn observer.

`vm.relationships` cooks labels and unavailable/conflict states. A durable target is not permission
to navigate. Only a separately authorized read target is supplied to
`callbacks.onNavigateRelationship(navigation)`. Without that callback, the viewer displays
`navigation unavailable`, never a dummy link. The host builds the current-target route and owns
authorization, query/scroll/selection restoration and Back. Source/starter labels combine only
when their known targets and read navigation agree. An exact anchor is passed only when the
authorized read result confirms the durable entry and public revision; otherwise the callback
receives a general current-source link and the viewer explains the unverified earlier state.

`earlierHistoryOpen` and `onEarlierHistoryOpenChange` form a controllable section-ID disclosure
map for host Back restoration. Default is closed. Hosts scope that saved map to the session.
Earlier turns deliberately do not invoke legacy numeric main-turn label/copy-link callbacks.

`session.inputSubmissionCount` preserves optional presence exactly. The header meta row labels it
`prompts` (`prompt` for exactly one); omitted displays `unknown`, present zero displays `0`.
Helper-group rows keep their own `input submissions` wording. Filtering, expanding and navigation
never recount it. `session.turnCount` remains the producer's main-record count,
and helper-thread counts remain the independent saved-identity metric. Normalized evidence also
disables the viewer's legacy first-prompt title guess; hosts may supply their already-authoritative
title through `vm.session.title` without lowercasing it.

The mounted canonical example is `?app=transcript&transcript=context#inuse`.
`contextCase`, `contextPartition`, `contextNavigation` and `contextCount` select named synthetic
YAML fixture states. They exercise the same production adapter and composite as consumers.
Run `pnpm test:transcript-provenance` for all retention/invalid/count/navigation cases, then
build the production app and run `pnpm test:transcript-provenance:mounted` for keyboard
disclosures, current-target callbacks, Back restoration, both-theme style probes and captures.
The mounted gate refuses a build without this renderer and fixture; it records exact served
asset hashes and the source revision. These fixtures are not native harness decoders.

## header chrome a host controls

The header's action row always starts with the host's `headerActions`. Optional props shape
the rest; each default keeps the long-standing header.

| prop | default | effect |
|---|---|---|
| `showTail` | `false` | hosts explicitly opt in with `showTail={true}` to retain the legacy `share` (including capability-gated `contribute`) and `more actions` menus after `headerActions`. By default a host owns publish and overflow through `headerActions`. The opt-in `more actions` menu renders only when `canEdit` or `canExport` gives it an item. |
| `utilityActions` | omitted | host secondary actions render beside primary header actions on desktop and in the bottom bar on phones. Supply compact icon controls here; place status messages with `headerActions` so feedback does not expand the phone toolbar. Primary actions remain in `headerActions` at every width. |
| `showOutcome` | `true` | renders the outcome chip when `session.outcome` is present. `false` hides it without touching the cooked outcome. |
| `showSearchTrigger` | `false` | renders a `search transcript` button with its `⌘F` hint at the end of the session views in the bottom bar. It opens the search bar exactly as the shortcut does, and it stays when `showTail` is `false`. |
| `footer` | omitted | `{ hints, progress }`, both off by default. `hints` renders the `⌘f search, j/k step turns` line and `progress` the visible-turn position counter, in the bottom bar beside the session views. A host opts in per part. The hint leaves a coarse pointer below the phone breakpoint, since it names keys a touch screen does not have; the counter exists only on the trace view in list mode. |
| `pullRequests` | omitted | a host node rendered under the meta row. The host owns the list, its data and any "show all" control; the composite renders nothing when it is omitted and hides it with the title while the header is condensed. |

The combinations and the controls each one must show or omit are fixtured in
`scripts/testdata/transcript-viewer-chrome.yaml`; `pnpm test:transcript-viewer-chrome` mounts
the real viewer for every case. No wire field is involved.

## integrity

The viewer takes a served integrity flag and draws it; it never decides one.

| prop | meaning |
|---|---|
| `integrity` | the served `VillageTranscriptIntegrity`, passed through untouched. A well formed value means the transcript is flagged and the header shows the badge in every presentation and at every width. Absent, `null` or malformed renders nothing. |
| `transcriptContentHash` | the detail response's `transcript.content_hash`: the content `flagged_turns` refer to. |
| `contentHash` | the bare hash of the content `viewModel` was cooked from, from the content route's `Village-Content-Hash` header. |
| `integrityHelpHref` | an optional link inside the badge's explanation panel. |

Position binding: each entry of `flagged_turns` is a position in the wire `turns` array. The adapter
records it on every main turn as `sourcePosition`, before any turn is dropped or merged, so a served
position finds its turn even when the cooked list is shorter than the wire list. Earlier history
carries no position and is never marked. A position with no visible turn draws nothing.

Hash rule: turns are marked only when `contentHash` equals `transcriptContentHash` and both are
non-empty. Any other combination draws the badge alone, because positions of other content point at
other turns. The viewer never derives integrity from the turns it renders. The behaviour is fixtured
in `scripts/testdata/transcript-integrity-viewer.yaml`; `pnpm test:transcript-integrity-viewer`
mounts the real viewer for every case.

## observed model resolution

`TurnDetail.observedModel` is source evidence from assistant output. The adapter resolves it over the
complete ordered payload before noise filtering or an optional host projection. Root assistant
observations update root state; omissions inherit that state. Inline subagent observations attribute
only their own turn and never mutate root state. Child sessions are separate payloads and therefore
separate resolver scopes.

The cooked `TurnVM.effectiveModel` is the model attributable to that assistant turn.
`TurnVM.modelChangedFrom` is present only on a visible observed transition and drives the normal-flow
change marker. Legacy payloads without observations inherit the stable session seed without inventing
transitions. Invalid or non-assistant observations are ignored defensively while their turn content
remains renderable. Hosts that need a subset pass `visibleTurnIndices` as the fourth adapter argument;
this is a post-resolution projection and cannot alter sticky state.

## provenance — a closed classification

Each cooked field is classified once, statically, rather than ad hoc:

| provenance | meaning |
|---|---|
| `BACKEND_READY` | computed + persisted by the backend today; needs only wire **surfacing**. |
| `BACKEND_SMALL_EXT` | the compute primitive exists (`gitops.DiffStats`); needs a small ingest extension + column + migration. |
| `ADAPTER_DERIVED` | a pure projection in the one fairtrade adapter; no backend dependency. |
| `RENDER_WHEN_PRESENT` | fed by fixtures / the retired nested shape today; the real source is one of the above once surfaced. Absent ⇒ the field is simply not rendered. |

**Status** — `IMPLEMENTED` = present in the cooked view model today (no new frontend code needed);
`SURFACE` = waiting on a backend follow-up (see [deferred follow-ups](#deferred-backend-follow-ups)).

## the git-cluster binding table

The git cluster is the contract's worked example: mostly built server-side, fully shaped client-side,
with a thin backend surfacing seam still deferred. The view-model fields below already exist and are
populated from fixtures / the retired nested shape; when the backend surfaces commits on the wire, the
adapter binds them with **no frontend change** (the field names already align — the source merely
flips fixture → wire).

| view-model field (cooked) | backend source of truth | provenance | status |
|---|---|---|---|
| `session.git.branch` | `sessions.git_branch` / `meta.Git.Branch` (on wire as `gitBranch`) | `BACKEND_READY` | IMPLEMENTED — adapter binds |
| `session.git.remote` | `host_slugs.git_remote` / `meta.Git.Remote` (on wire as `gitRemote`) | `BACKEND_READY` | IMPLEMENTED |
| `session.git.author` | legacy `gitContext.user`; absent on the canonical flat wire | `RENDER_WHEN_PRESENT` | IMPLEMENTED (`cookGit` binds the legacy field at the adapter boundary) |
| `session.git.commits[]` | `session_commits` / `GitContext.Commits` (metadata v4+) | `BACKEND_READY` + `RENDER_WHEN_PRESENT` | IMPLEMENTED (fixture); SURFACE on wire |
| `commit.hash` / `message` / `author` / `commitTime` | `session_commits` columns | `BACKEND_READY` | IMPLEMENTED (`cookCommit`); SURFACE on wire |
| `commit.shortHash` | — (`hash.slice(0, 7)`) | `ADAPTER_DERIVED` | IMPLEMENTED |
| `commit.session` (bool) | a `session_commits` row ⇒ produced in-session by construction | `BACKEND_READY` (implied) | IMPLEMENTED |
| `commit.adds` / `dels` / `files` (per-commit churn) | `gitops.DiffStats` per commit — not yet joined to session commits | `BACKEND_SMALL_EXT` + `RENDER_WHEN_PRESENT` | IMPLEMENTED (fixture / legacy shape); SURFACE = ingest ext + columns + migration |
| `commit.turn` (anchor) | — (`commitTime` → nearest turn at/before it) | `ADAPTER_DERIVED` | IMPLEMENTED (`anchorCommitsToTurns`) |
| `session.git.{filesChanged,insertions,deletions}` (aggregate) | sum of per-commit churn | `ADAPTER_DERIVED` | IMPLEMENTED (`cookGit`) |
| `task.stat` / `highlight.stat` (string, e.g. `"+312 −24, 7 files"`) | cooked from churn at the render edge | `ADAPTER_DERIVED` | IMPLEMENTED |

The same pattern generalises to every cooked field: a component reads `TranscriptViewModel`, never the
wire; anything optional is **render-when-present** (absent ⇒ the chip / region degrades, never an empty
`+0 −0, 0 files`).

## parse enforcement — why "no wire parse in components" holds

`ToolCallDetail.arguments` and `.result` are JSON-encoded **strings** on the wire. The invariant that
no presentational component ever parses one is **not** a lint hack — it is a three-layer structural
stack, strongest first:

1. **Type contract (primary).** Components are typed to receive the **cooked** `ToolCallVM`
   (`.args` / `.output` already parsed, plus `preview` and diff hunks). There is structurally no raw
   wire string in a component's props to parse. `adapter.contract.type-test.js` pins this under
   `tsc` (strict, `noImplicitAny`); the `// @ts-check` hardening of `view-model.js` + `wire-types.js`
   strengthens it by strict-checking the data modules' own definitions.
2. **Module boundary.** `adapter.parse.js` is a **leaf** holding the SOLE `JSON.parse` of tool
   args/result (`parseJson`; `parseArgs` / `parseResult` wrap it). It imports nothing from
   `adapter.js` / `analytics.js`, and the only importers are those two data modules (plus the
   type-test) — **never a presentational component**. `adaptTranscript` is the one wire-touching seam.
3. **Audit (backstop).** transcript-browser carries a committed test that comment-strips the lifted
   source and asserts zero wire-parse outside the adapter — catching a regression the type system
   cannot express ("exactly one parse site"), since `JSON.parse` returns `any` and JSX here is not
   strictly checked.

This design relies on the static analysis already in place: no new bespoke parse gate and no ESLint
(neither repo runs it). Layers 1–3 are the enforcement; the `// @ts-check` hardening is the
complement to layer 1, not a replacement for it.

## deferred backend follow-ups

These are intentionally **not** in scope here; the cooked view model already tolerates them via
render-when-present, so they land with no frontend change:

- **git-cluster wire surfacing** (a tracked backend follow-up) — surface `Commits []CommitInfo` onto the
  `session_detail` payload from the existing `session_commits` table / metadata, plus the small
  per-commit churn ingest extension (reusing `gitops.DiffStats`) + columns + migration. When it lands,
  `cookCommit` / `cookGit` bind it unchanged — the source flips fixture → wire.
- **tool-sibling thinking emission** — surfacing the per-turn thinking/“reasoning” content as a
  first-class sibling of tool calls is a separate follow-up effort; today the adapter derives inline
  thinking from folded turn content as a forward/demo convention.

# transcript data-binding contract

The canonical reference for how the transcript **wire** maps to the cooked **view model** that every
presentational component renders. It tells each consumer — the lifted fairtrade components, the
transcript-browser host, and future peasant / village consumers — per field: what the backend
provides, what the one adapter cooks, what is fixture-fed today pending a backend surface, and what
is already shipped.

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

## observed model and sticky state

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
| `task.stat` / `highlight.stat` (string, e.g. `"+312 −24 · 7 files"`) | cooked from churn at the render edge | `ADAPTER_DERIVED` | IMPLEMENTED |

The same pattern generalises to every cooked field: a component reads `TranscriptViewModel`, never the
wire; anything optional is **render-when-present** (absent ⇒ the chip / region degrades, never an empty
`+0 −0 · 0 files`).

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

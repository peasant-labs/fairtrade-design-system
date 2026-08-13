// @ts-check
/* ───────────────────────────────────────────────────────────────────────────
   view-model — TranscriptViewModel: the single most load-bearing seam
   ─────────────────────────────────────────────────────────────────────────
   The adapter's OUTPUT is, field-for-field, EVERY presentational component's
   prop contract. The one transcript adapter (`adaptTranscript`) maps the
   schema-backed wire (wire-types.js) ONCE into this cooked model; every
   primitive + the composite read from it and NEVER touch wire.

   Three invariants this model enforces (the whole reason it exists):
     1. ZERO JSON.parse downstream — the adapter parses `ToolCallDetail.arguments`
        / `.result` once into `ToolCallVM` (parsed payload + preview + diff hunks).
     2. ZERO git wire fields downstream — canonical flat git fields and the
        retired nested `gitContext` are normalized into cooked `SessionVM.git`
        (render-when-present). No component sees a git wire field.
     3. ANALYTICS are render-when-present — `phases`, `scorecardBands`,
        `patternAnnotations`, `taskGroups` are optional; absent ⇒ the consuming
        surface degrades cleanly (no error, just an unadorned transcript).

   Naming: the *VM suffix marks a COOKED shape (adapter output). Wire shapes
   (no suffix) live in wire-types.js and never appear in a component prop type.

   This file is type-only at runtime (`export {}`); the barrel re-exports its
   types via JSDoc `import(...)`, which pulls it into the tsc declaration-emit
   program so the contract ships in the published `.d.ts`.
   ─────────────────────────────────────────────────────────────────────────── */

/* ── Git (cooked, render-when-present) ─────────────────────────────────────── */

/**
 * Cooked git chrome for the session header. Produced by the adapter from
 * whichever wire shape is present — canonical flat git fields OR retired nested
 * `gitContext` (see TranscriptWireInput in wire-types.js). Absent on the model
 * ⇒ the git chips are omitted entirely (clean degrade). Every field is optional
 * because the canonical session-detail wire carries only branch + remote today;
 * the rest arrive only via legacy inputs and fixtures.
 *
 * @typedef {object} SessionGitVM
 * @property {string} [branch]
 * @property {string} [remote]
 * @property {string} [author]              cooked from legacy gitContext.user; absent on the canonical flat wire
 * @property {CommitVM[]} [commits]
 * @property {number} [filesChanged]
 * @property {number} [insertions]
 * @property {number} [deletions]
 */

/**
 * A cooked commit for the git chrome / commit chips. Mirrors CommitInfo
 * (wire-types.js) with display-ready fields. The churn (`adds`/`dels`/`files`)
 * and `turn` anchor are render-when-present: canonical CommitInfo carries
 * no churn and commits are not on the session_detail payload (the deferred
 * backend follow-up), so these light up from fixtures / the retired nested shape now
 * and from the canonical wire when that follow-up lands.
 *
 * @typedef {object} CommitVM
 * @property {string} hash
 * @property {string} shortHash             abbreviated hash for the chip label
 * @property {string} message               first line
 * @property {string} [author]
 * @property {number} [commitTime]          Unix millis
 * @property {boolean} [session]            true if produced during this session
 * @property {number} [adds]                insertions for the checkpoint stat (render-when-present)
 * @property {number} [dels]                deletions for the checkpoint stat (render-when-present)
 * @property {number} [files]               files changed for the checkpoint stat (render-when-present)
 * @property {number} [turn]                turn index this checkpoint attaches to (adapter joins commitTime→nearest turn)
 */

/* ── Session ───────────────────────────────────────────────────────────────── */

/**
 * The cooked session header / meta / outcome / scorecard, plus optional git.
 * The scorecard is passed through largely as-is (the wire scorecard is already
 * flat numeric signals); the analytics util derives display BANDS from it
 * separately (see `scorecardBands` on the analytics block).
 *
 * @typedef {object} SessionVM
 * @property {string} id
 * @property {import('./wire-types.js').Harness} harness
 * @property {string} startTime
 * @property {string} endTime
 * @property {number} durationMins
 * @property {number} totalTokens
 * @property {number} tokensIn
 * @property {number} tokensOut
 * @property {number} turnCount
 * @property {number} toolCallCount
 * @property {string} [title]               editorial session title/summary (render-when-present; else the consumer derives one from the first prompt). Not a wire field — supplied by a curated consumer.
 * @property {string} [project]
 * @property {string} [model]
 * @property {string} [workingDirectory]
 * @property {import('./wire-types.js').SessionOutcome} [outcome]
 * @property {import('./wire-types.js').SessionScorecard | null} [scorecard]
 * @property {SessionGitVM} [git]           render-when-present; never a wire field
 */

/* ── Tool calls ────────────────────────────────────────────────────────────── */

/**
 * A logical grouping for the filters rail, derived from `ToolCallKind`. The
 * adapter classifies every tool call into exactly one group; counts roll up in
 * `FilterIndexVM.toolGroupCounts`.
 * @typedef {'edits' | 'bash' | 'read' | 'search' | 'fetch' | 'tasks' | 'other'} ToolGroup
 */

/** Canonical ToolGroup ids, in the filters-rail display order. @type {readonly ToolGroup[]} */
export const TOOL_GROUPS = Object.freeze([
  'edits',
  'bash',
  'read',
  'search',
  'fetch',
  'tasks',
  'other',
])

/**
 * One line of a rendered diff hunk (cooked from a parsed edit/write result).
 * @typedef {object} DiffLineVM
 * @property {'add' | 'del' | 'ctx'} sign
 * @property {string} [oldNo]               old-file line number (gutter); absent for adds
 * @property {string} [newNo]               new-file line number (gutter); absent for dels
 * @property {string} text
 */

/**
 * A contiguous diff hunk for one file change.
 * @typedef {object} DiffHunkVM
 * @property {string} [header]              the hunk range header line, when present
 * @property {DiffLineVM[]} lines
 */

/**
 * A fully cooked tool call. The adapter has ALREADY parsed the wire
 * `arguments`/`result` JSON strings into `args`/`output`, derived a one-line
 * `preview`, classified the `kind`/`group`, and (for edit/write) computed
 * `diff`. Components render these fields directly — they NEVER JSON.parse.
 *
 * @typedef {object} ToolCallVM
 * @property {string} id
 * @property {string} name                  display name (e.g. "Read", "Bash")
 * @property {import('./wire-types.js').ToolCallKind} kind
 * @property {ToolGroup} group              filters-rail grouping
 * @property {string} preview               the one-line summary shown collapsed
 * @property {unknown} [args]               parsed `arguments` (shape varies by tool)
 * @property {unknown} [output]            parsed `result` (shape varies by tool)
 * @property {string} [filePath]
 * @property {number} [durationMs]
 * @property {number} [exitCode]
 * @property {boolean} [isError]
 * @property {DiffHunkVM[]} [diff]          present for edit/write kinds
 * @property {number} [adds]                churn for edit/write
 * @property {number} [dels]
 */

/* ── Turns ─────────────────────────────────────────────────────────────────── */

/**
 * Cooked thinking content for a turn. The adapter extracts thinking from the
 * folded `turn.content` (render-when-present); absent ⇒ no thinking block.
 * @typedef {object} ThinkingVM
 * @property {string} text
 * @property {number} [words]               precomputed word count for the toggle badge
 */

/**
 * One cooked turn. `toolCalls` here are the same `ToolCallVM` objects indexed in
 * `toolCallsById` (shared identity — index once, reference everywhere).
 *
 * @typedef {object} TurnVM
 * @property {number} index
 * @property {import('./wire-types.js').Role} role
 * @property {string} label                 display label, e.g. "1a" / "2"
 * @property {string} content               markdown body (thinking already extracted)
 * @property {number} depth                 subagent nesting depth (0 = top level)
 * @property {string} [effectiveModel]       sticky model effective for this assistant turn; resolved over the complete ordered wire before projection
 * @property {string} [modelChangedFrom]     prior root model when this turn carries the observation that changed it
 * @property {import('@peasant-labs/schema').Harness} [provider] canonical provider identity for a top-level assistant turn
 * @property {string} [agentName]           subagent name when depth > 0
 * @property {ThinkingVM} [thinking]
 * @property {ToolCallVM[]} toolCalls
 * @property {import('./wire-types.js').EntryType} [entryType]
 * @property {import('./wire-types.js').StopReason | null} [stopReason]
 * @property {boolean} [isError]
 * @property {boolean} [isFinal]
 * @property {{ in: number, out: number }} [tokens]
 * @property {string} [timestamp]            RFC3339 absolute time (drives commit anchoring); the visible label prefers `time`
 * @property {string} [time]                 editorial display time, e.g. "8m ago" (render-when-present; else `timestamp`). Not derivable from the wire (relative to now) — a curated consumer supplies it.
 * @property {string} [timeTitle]            editorial absolute time for the hover title (render-when-present; else `timestamp`)
 * @property {AnnotationVM[]} annotations    annotations targeting this turn (may be empty)
 */

/* ── Annotations (cooked, per-turn) ──────────────────────────────────────────── */

/**
 * A cooked annotation, already resolved to the turn it targets. The adapter maps
 * the wire `AnnotationSummary` half-open entry range onto turn indices.
 * @typedef {object} AnnotationVM
 * @property {string} id
 * @property {string} kind                  e.g. "error" / "retry" / "revert" / "subagent"
 * @property {number} turn                  target turn index
 * @property {string} label
 * @property {string} [preview]
 * @property {boolean} [isPrimary]
 */

/* ── Files & diffs ──────────────────────────────────────────────────────────── */

/**
 * One file in the Files tab, with cooked churn. The adapter aggregates per-file
 * reads/writes/edits/deletes across all tool calls.
 * @typedef {object} FileEntryVM
 * @property {string} path
 * @property {string} leaf                  basename for compact display
 * @property {number} reads
 * @property {number} writes
 * @property {number} edits
 * @property {number} deletes
 * @property {number} adds                  total insertions
 * @property {number} dels                  total deletions
 * @property {boolean} edited               true if writes + edits > 0
 * @property {number} [turn]                first turn that touched the file
 */

/**
 * One diff entry in the Diffs tab — a file change with its rendered hunks.
 * @typedef {object} DiffEntryVM
 * @property {string} path
 * @property {string} leaf
 * @property {number} adds
 * @property {number} dels
 * @property {DiffHunkVM[]} hunks
 * @property {number} [turn]                turn the edit happened on
 * @property {string} [toolCallId]          back-reference into toolCallsById
 */

/* ── Tasks ─────────────────────────────────────────────────────────────────── */

/**
 * One task group for the trace outline / waterfall — a user-prompt boundary plus
 * its derived per-task summary. The adapter computes boundaries off the turn
 * stream; the optional analytics util can enrich this further.
 * @typedef {object} TaskGroupVM
 * @property {string} id
 * @property {number} index                 1-based task number
 * @property {string} prompt                user content for the task (case preserved)
 * @property {number[]} turnIndices         turns belonging to this task
 * @property {number} [durationMs]
 * @property {number} [tools]               tool-call count in the task
 * @property {'ok' | 'error'} [outcome]
 * @property {string} [error]               short error label when outcome === 'error'
 * @property {string} [stat]                cooked churn/files summary, e.g. "2 files · +316 −25" (render-when-present)
 */

/* ── Highlights (the HIGHLIGHTS tab) ─────────────────────────────────────────── */

/**
 * One curated key-moment for the HIGHLIGHTS tab. `vm.highlights` BACKS this tab
 * directly; the tab must render non-empty from it.
 * @typedef {object} HighlightVM
 * @property {string} id
 * @property {'request' | 'phase' | 'error' | 'checkpoint' | 'final' | (string & {})} kind
 * @property {number} turn                  turn index this highlight points at
 * @property {string} title
 * @property {string} [sub]
 * @property {string} [icon]                semantic icon key (consumer maps to a glyph)
 * @property {string} [stat]                e.g. "+312 −24 · 7 files"
 * @property {string} [time]
 * @property {string} [tokens]
 * @property {boolean} [err]                error styling
 * @property {string} [tag]                 e.g. a phase id
 */

/* ── Filter index (powers the filters rail + search) ─────────────────────────── */

/**
 * Precomputed indices the filters rail + search read, so no component recomputes
 * counts or scans turns. Keyed maps are plain records (turn index / group id →
 * value) for cheap, stable lookup.
 *
 * @typedef {object} FilterIndexVM
 * @property {Record<ToolGroup, number>} toolGroupCounts   tool-group id → count
 * @property {Record<number, AnnotationVM[]>} annotationsByTurn  turn index → annotations
 * @property {string[]} tags                                semantic-tag ids present
 * @property {Record<string, number>} tagCounts            tag id → count
 * @property {number} totalTurns
 */

/* ── Analytics (render-when-present) ─────────────────────────────────────────── */

/**
 * One scorecard axis band — the display verdict the analytics util derives from
 * the raw `SessionScorecard` numeric signals.
 * @typedef {object} ScorecardBandVM
 * @property {string} id                    axis id (e.g. token-efficiency)
 * @property {string} label
 * @property {'good' | 'ok' | 'watch' | 'bad' | (string & {})} band
 * @property {string} [value]               formatted headline value
 * @property {string} [detail]              single cooked sub-line (the lean analytics shape)
 * @property {string} [icon]                semantic axis-icon key the consumer maps to a glyph (render-when-present)
 * @property {string[]} [flags]             the per-axis flag LIST (render-when-present; richer than `detail` — a curated/backend nicety)
 * @property {{ dir: 'up' | 'down', text: string }} [delta]   trend-vs-median delta (render-when-present)
 */

/**
 * One phase spanning a turn range, drawn as a divider in the trace.
 * @typedef {object} PhaseVM
 * @property {string} id
 * @property {string} label
 * @property {number} from                  first turn index (inclusive)
 * @property {number} to                    last turn index (inclusive)
 * @property {string} [icon]                semantic icon key
 * @property {number} [errors]              error count attributed to the phase
 */

/**
 * The optional analytics block. The adapter accepts a precomputed
 * `TranscriptAnalytics` (produced separately) OR derives it; when no
 * analytics are available the WHOLE block is absent and every analytics-fed
 * surface degrades cleanly. Each field is independently optional.
 *
 * @typedef {object} TranscriptAnalyticsVM
 * @property {PhaseVM[]} [phases]
 * @property {ScorecardBandVM[]} [scorecardBands]
 * @property {AnnotationVM[]} [patternAnnotations]   detected patterns (errors/retries/reverts/subagents)
 * @property {TaskGroupVM[]} [taskGroups]            analytics-enriched task grouping
 */

/* ── The view model ──────────────────────────────────────────────────────────── */

/**
 * The cooked transcript view model — the adapter's sole output and every
 * component's prop contract. `analytics` and the git cluster are the only
 * render-when-present pieces; everything else is always populated (possibly with
 * empty arrays) so components never branch on existence for the core surfaces.
 *
 * @typedef {object} TranscriptViewModel
 * @property {SessionVM} session
 * @property {TurnVM[]} turns
 * @property {Map<string, ToolCallVM>} toolCallsById   parsed once; turns reference the same objects
 * @property {DiffEntryVM[]} diffs
 * @property {FileEntryVM[]} files
 * @property {TaskGroupVM[]} tasks
 * @property {HighlightVM[]} highlights                BACKS the HIGHLIGHTS tab (non-empty when present)
 * @property {FilterIndexVM} filterIndex
 * @property {TranscriptAnalyticsVM} [analytics]       render-when-present
 */

export {}

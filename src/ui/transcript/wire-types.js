// @ts-check
/* ───────────────────────────────────────────────────────────────────────────
   wire-types — the canonical transcript wire contract (the integration spine)
   ─────────────────────────────────────────────────────────────────────────
   These are the EXACT shapes the peasant Go backend sends over the local
   WebSocket `session_detail` channel (and promotes into the versioned `peasant
   push` body). They are the SOLE input the one transcript adapter touches; no
   presentational component ever binds to a wire type directly.

   SOURCE OF TRUTH = the Go schema at schema/develop (NOT the hand-ported TS
   `@peasant-labs/types`, which has DRIFTED — see the git-cluster note below).
   Every field below is grounded line-for-line in:
     • SessionDetailPayload  — schema/develop/local_api.go:92-123
     • TurnDetail            — schema/develop/local_api.go:50-66
     • ToolCallDetail        — schema/develop/local_api.go:69-79
     • SessionScorecard      — schema/develop/local_api.go:131-150
     • ChildSessionRef       — schema/develop/local_api.go:153-157
     • AnnotationSummary     — schema/develop/annotation.go:46-66
     • CommitInfo / GitContext — schema/develop/metadata.go:88-105 (metadata.json
                                 only; NOT on the session_detail wire — see note)
     • enums (Role/EntryType/ToolCallKind/StopReason/SessionOutcome) — types.go
     • Harness               — bestiary.Harness (claude-code/gemini-cli/codex/
                               opencode/cursor/antigravity)

   ── the git-cluster drift (the ONE place wire and TS are exact inverses) ──────
   The Go runtime wire carries FLAT `gitBranch` / `gitRemote` (strings) and has
   NO `gitContext` and NO commits array on the SessionDetailPayload
   (local_api.go:111-112). The drifted TS `@peasant-labs/types` counterpart
   declares ONLY a nested `gitContext?` and NEITHER flat field. CommitInfo and
   GitContext.Commits live in metadata.json (v4+), not on this payload.

   The adapter — and ONLY the adapter — absorbs this: its INPUT type widens the
   payload with BOTH shapes (see `TranscriptWireInput`) so it compiles against
   either runtime, and it normalizes whichever is present into the cooked,
   optional `vm.session.git`. No component ever references gitBranch / gitRemote
   / gitContext. The flat-vs-nested reconciliation on the real payload is the
   downstream #125/#126 codegen-drift fix, out of scope here.

   ── parentIndex ──────────────────────────────────────────────────────────────
   The Go TurnDetail HAS `parentIndex *int` (nullable, present; local_api.go:57),
   so it is typed here for fidelity. But the drifted TS shape OMITS it, and the
   graph engine keys subagent spawn/return purely off `depth`. So consumers MUST
   NOT rely on parentIndex; it is `?` (may be absent) and `| null` (may be null).

   ── runtime exports ──────────────────────────────────────────────────────────
   The `@typedef`s below are erased at build; the small frozen enum-value arrays
   are the genuine runtime exports. They double as (a) the canonical iteration
   order for any consumer that needs the full enum set and (b) the import anchor
   that pulls this file into the `tsc` declaration-emit program (the barrel
   re-exports them), so the types ship in the published `.d.ts`.
   ─────────────────────────────────────────────────────────────────────────── */

/* ── Enums (string-literal unions; grounded in schema/develop/types.go) ────── */

/**
 * Sender role of a turn. schema/develop/types.go:425-430.
 * @typedef {'user' | 'assistant' | 'tool' | 'system'} Role
 */

/** Canonical Role values, in schema order. @type {readonly Role[]} */
export const ROLES = Object.freeze(['user', 'assistant', 'tool', 'system'])

/**
 * Classification of a single transcript entry. schema/develop/types.go:464-472.
 * `thinking` (468) is a first-class entry type: a standalone thinking entry is
 * its own `entryType=thinking` turn, rendered from `turn.content`.
 * @typedef {'text' | 'tool_use' | 'tool_result' | 'thinking' | 'system' | 'error' | 'result'} EntryType
 */

/** Canonical EntryType values, in schema order. @type {readonly EntryType[]} */
export const ENTRY_TYPES = Object.freeze([
  'text',
  'tool_use',
  'tool_result',
  'thinking',
  'system',
  'error',
  'result',
])

/**
 * Tool-call classification, ACP-aligned. schema/develop/types.go:336-346.
 * The mockup's demo tool kinds map onto these canonical kinds: bash→execute,
 * grep→search, task→other (subagent), webfetch→fetch.
 * @typedef {'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'think' | 'fetch' | 'other'} ToolCallKind
 */

/** Canonical ToolCallKind values, in schema order. @type {readonly ToolCallKind[]} */
export const TOOL_CALL_KINDS = Object.freeze([
  'read',
  'edit',
  'delete',
  'move',
  'search',
  'execute',
  'think',
  'fetch',
  'other',
])

/**
 * Why a turn (or session) ended. schema/develop/types.go:383-389.
 * @typedef {'end_turn' | 'cancelled' | 'max_tokens' | 'max_turn_requests' | 'refusal'} StopReason
 */

/** Canonical StopReason values, in schema order. @type {readonly StopReason[]} */
export const STOP_REASONS = Object.freeze([
  'end_turn',
  'cancelled',
  'max_tokens',
  'max_turn_requests',
  'refusal',
])

/**
 * Heuristic resolution status of a session. schema/develop/types.go:193-195.
 * @typedef {'resolved' | 'partial' | 'failed'} SessionOutcome
 */

/** Canonical SessionOutcome values, in schema order. @type {readonly SessionOutcome[]} */
export const SESSION_OUTCOMES = Object.freeze(['resolved', 'partial', 'failed'])

/**
 * The coding tool / AI-assisted environment that produced the session.
 * bestiary.Harness (the ingestion-supported set peasant emits). The string
 * union is the wire contract; bestiary may know a superset, so consumers MUST
 * tolerate an unknown harness string (degrade, never throw).
 * @typedef {'claude-code' | 'gemini-cli' | 'codex' | 'opencode' | 'cursor' | 'antigravity' | (string & {})} Harness
 */

/** Canonical Harness values peasant ingests, in display order. @type {readonly Harness[]} */
export const HARNESSES = Object.freeze([
  'claude-code',
  'gemini-cli',
  'codex',
  'opencode',
  'cursor',
  'antigravity',
])

/* ── Tool call ─────────────────────────────────────────────────────────────── */

/**
 * A single tool call inside a turn. schema/develop/local_api.go:69-79.
 *
 * `arguments` and `result` are JSON-ENCODED STRINGS on the wire. The adapter is
 * the SOLE site that `JSON.parse`s them; components receive the parsed,
 * preview-cooked `ToolCallVM` (see view-model.js), never these raw strings.
 *
 * @typedef {object} ToolCallDetail
 * @property {string} id
 * @property {string} name
 * @property {string} arguments            JSON-encoded string (parse in the adapter only)
 * @property {string} result               JSON-encoded string (parse in the adapter only)
 * @property {number} [durationMs]         ms; absent when not measured
 * @property {number} [exitCode]           process exit code, when applicable
 * @property {string} [filePath]           target path for file-oriented tools
 * @property {boolean} [isError]           true when the call failed
 * @property {ToolCallKind} [toolKind]     ACP-aligned classification; may be omitted
 */

/* ── Turn ──────────────────────────────────────────────────────────────────── */

/**
 * One turn with full content, as folded server-side. schema/develop/local_api.go:50-66.
 *
 * `content` already contains any folded thinking text (the server only
 * suppresses a redundant depth=1 thinking/text sibling whose parent already
 * carries the text). Components render thinking from `turn.content`.
 *
 * `parentIndex` is present on the Go wire but OMITTED by the drifted TS shape;
 * consumers MUST NOT depend on it (the graph keys nesting off `depth`). Typed
 * here as optional-and-nullable for fidelity only.
 *
 * @typedef {object} TurnDetail
 * @property {number} index
 * @property {Role} role
 * @property {string} content              folded text (incl. thinking) for this turn
 * @property {ToolCallDetail[]} [toolCalls] omitempty on the wire
 * @property {string} timestamp            RFC3339 (Go time.Time marshals to a string)
 * @property {number} depth                subagent nesting depth (0 = top level)
 * @property {number | null} [parentIndex] DO NOT rely on this — use `depth`. May be absent or null.
 * @property {string} [agentName]
 * @property {EntryType} [entryType]       enrichment, propagated from session_entries
 * @property {boolean} [hasThinking]
 * @property {StopReason | null} [stopReason]
 * @property {number | null} [tokensIn]
 * @property {number | null} [tokensOut]
 */

/* ── Child sessions ──────────────────────────────────────────────────────────── */

/**
 * Lightweight reference to a child (subagent) session. schema/develop/local_api.go:153-157.
 * @typedef {object} ChildSessionRef
 * @property {string} id
 * @property {string} startTime            RFC3339
 * @property {string} [project]
 */

/* ── Scorecard ─────────────────────────────────────────────────────────────── */

/**
 * Deterministic per-session quality signals for the "How this session went"
 * self-assessment card. schema/develop/local_api.go:131-150. All numeric fields
 * are nullable so a consumer can distinguish "not computed" (absent/null) from a
 * real zero before applying threshold bands.
 *
 * @typedef {object} SessionScorecard
 * @property {number | null} [m2TokenOutcomeRatio]
 * @property {number | null} [m5ContextUtilizationPct]
 * @property {number | null} [m6OutputSurvivalPct]
 * @property {number | null} [retryTokensWasted]
 * @property {number | null} [totalTokens]
 * @property {number | null} [costTotalUsd]
 * @property {number | null} [specQualityScore]
 * @property {number | null} [signalDensity]
 * @property {boolean | null} [m7SpecHasExamples]
 * @property {boolean | null} [m7SpecHasConstraints]
 * @property {number | null} [m4ConsecutiveErrorMax]
 * @property {number | null} [withinSessionReverts]
 * @property {SessionOutcome} [outcome]    echoes the session outcome for band triggers
 */

/* ── Git cluster (metadata.json only — NOT on the session_detail wire) ───────── */

/**
 * A single git commit linked to a session. schema/develop/metadata.go:89-96.
 * Lives on GitContext.Commits in metadata.json (v4+); absent from the
 * session_detail payload. Reaches components only after the adapter cooks it
 * into `vm.session.git.commits`.
 *
 * @typedef {object} CommitInfo
 * @property {string} hash                 commit SHA-1 (full or abbreviated)
 * @property {string} message              first line of the commit message
 * @property {string} authorName
 * @property {string} authorEmail
 * @property {number} commitTime           committer date, Unix millis
 * @property {number} authorTime           author date, Unix millis
 */

/**
 * Git repository state captured for a session. schema/develop/metadata.go:99-105.
 * This is the NESTED shape the drifted TS `@peasant-labs/types` exposes and the
 * shape the mockup fixtures / TB's sample-session hand-populate. It is NOT on
 * the real Go session_detail wire (which carries only flat gitBranch/gitRemote).
 * The adapter tolerates this shape too (see `TranscriptWireInput`).
 *
 * @typedef {object} GitContext
 * @property {string | null} [branch]
 * @property {string | null} [remote]
 * @property {string | null} [worktree]
 * @property {string | null} [tracking]
 * @property {CommitInfo[]} [commits]      produced during this session (v4+)
 */

/* ── Annotation (the adapter's SECOND input, separately fetched) ─────────────── */

/**
 * Wire format for an annotation. schema/develop/annotation.go:46-66. Fetched
 * separately from the payload (WS `annotations` / GET /api/v1/annotations?
 * session_id=) and passed to the adapter alongside the payload.
 * `targetEntryEndIndex` is half-open: the range is [targetEntryIndex, end).
 *
 * @typedef {object} AnnotationSummary
 * @property {string} id
 * @property {string} targetKind
 * @property {string} [targetSessionId]
 * @property {number} [targetEntryIndex]
 * @property {number} [targetEntryEndIndex]  half-open [start, end)
 * @property {string} [targetAnnotationId]
 * @property {string} [targetProjectHash]
 * @property {boolean} isPrimary
 * @property {string} annotatorKind
 * @property {string} annotatorName
 * @property {string} typeId
 * @property {string} typeName
 * @property {string} value
 * @property {number} [confidence]
 * @property {string} [reason]
 * @property {object} [provenance]
 * @property {string} [contentHash]
 * @property {number} createdAt            Unix millis
 * @property {string} [supersededBy]
 */

/* ── Session detail payload (the adapter's PRIMARY input) ─────────────────────── */

/**
 * The full single-session detail payload. schema/develop/local_api.go:92-123.
 * This is the actual local WebSocket `session_detail` wire body. Note: it
 * carries FLAT `gitBranch` / `gitRemote` (strings) and NO `gitContext` / commits
 * (local_api.go:111-112). Turns are already folded server-side.
 *
 * @typedef {object} SessionDetailPayload
 * @property {string} [schemaVersion]      embedded push-contract version (advisory; omitempty)
 * @property {string} id
 * @property {Harness} harness
 * @property {string} startTime            RFC3339
 * @property {string} endTime              RFC3339
 * @property {number} durationMins
 * @property {number} totalTokens
 * @property {number} tokensIn
 * @property {number} tokensOut
 * @property {number} turnCount
 * @property {number} toolCallCount
 * @property {TurnDetail[]} turns
 * @property {string} [source]
 * @property {string} [status]
 * @property {string} [project]
 * @property {string} [model]
 * @property {string} [workingDirectory]
 * @property {string} [gitBranch]          FLAT string on the Go wire (NOT gitContext)
 * @property {string} [gitRemote]          FLAT string on the Go wire (NOT gitContext)
 * @property {ChildSessionRef[]} [childSessions]
 * @property {SessionOutcome} [outcome]
 * @property {SessionScorecard | null} [scorecard]
 */

/* ── Adapter input (the SINGLE drift-absorption seam) ────────────────────────── */

/**
 * The transcript adapter's input type. It is the canonical `SessionDetailPayload`
 * WIDENED with the nested `gitContext?` so the one adapter compiles against BOTH
 * runtime shapes — the Go wire (flat gitBranch/gitRemote) AND the drifted TS
 * `@peasant-labs/types` shape (gitContext? only) — and normalizes whichever is
 * present into the cooked, optional `vm.session.git`. This widening is the ONLY
 * place both git shapes coexist; it MUST NOT leak past the adapter into any
 * component prop contract.
 *
 * @typedef {SessionDetailPayload & { gitContext?: GitContext }} TranscriptWireInput
 */

export {}

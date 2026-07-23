// @ts-check
/* Contract type-test for the graph surface payloads (Changes, ChangeDetail,
   CodeMap). It imports the ACTUAL production sub-barrel (the surface every
   adapter + surface slice imports) and asserts, at the type level, the
   load-bearing guarantees of the cooked prop payloads. Enforced by:
     pnpm test:contract
   which runs: tsc -p tsconfig.contract.json (strict:true, noImplicitAny:true,
   noEmit). This file + types.js are wired into that program, so a contract
   leak — or a SYNTAX error in types.js — FAILS the build gate (the standalone
   checkJs probe is no longer the only safety net). */

/** @typedef {import('./index.js').MapNodeKind} MapNodeKind */
/** @typedef {import('./index.js').FileChangeStatus} FileChangeStatus */
/** @typedef {import('./index.js').DiffLineKind} DiffLineKind */
/** @typedef {import('./index.js').ChangeBinding} ChangeBinding */
/** @typedef {import('./index.js').MapEdgePayload} MapEdgePayload */
/** @typedef {import('./index.js').ActivityEdgePayload} ActivityEdgePayload */
/** @typedef {import('./index.js').MapSlicePayload} MapSlicePayload */
/** @typedef {import('./index.js').ChangesPayload} ChangesPayload */
/** @typedef {import('./index.js').ChangeDetailPayload} ChangeDetailPayload */
/** @typedef {import('./index.js').ChangeDiffPayload} ChangeDiffPayload */
/** @typedef {import('./index.js').CodeMapPayload} CodeMapPayload */
/** @typedef {import('./index.js').CodeMapState} CodeMapState */
/** @typedef {import('./index.js').CodeMapAction} CodeMapAction */

import {
  MAP_NODE_KINDS,
  CHANGE_BINDINGS,
  EDGE_VIOLATION_KINDS,
  FILE_CHANGE_STATUSES,
  DIFF_LINE_KINDS,
  CODE_MAP_STATE_VERSION,
  createCodeMapState,
  reduceCodeMapState,
  deriveCodeMapView,
} from './index.js'

/** @type {CodeMapState} */
const codeMapState = createCodeMapState({ grain: 'file', expandedIds: ['web'] })
/** @type {1} */
const stateVersion = CODE_MAP_STATE_VERSION
void stateVersion
void reduceCodeMapState(codeMapState, { type: 'open-in-map', id: 'web' })
void deriveCodeMapView({ repoFound: true, nodes: [], structureEdges: [], violations: [] }, codeMapState)
// @ts-expect-error — the canonical grain is a closed union
createCodeMapState({ grain: 'directory' })
// @ts-expect-error — viewport scale and pan coordinates are numeric
createCodeMapState({ viewport: { scale: '1', panX: 0, panY: 0 } })
/** @param {CodeMapAction} action */
function acceptsCodeMapAction(action) { void action }
// @ts-expect-error — unknown reducer actions are rejected at the public boundary
acceptsCodeMapAction({ type: 'teleport' })

/* ── (1) enum-value arrays are genuine runtime exports, typed by the union ────── */

/** @type {MapNodeKind} */
const firstKind = MAP_NODE_KINDS[0]
void firstKind
/** @type {FileChangeStatus} */
const firstStatus = FILE_CHANGE_STATUSES[0]
void firstStatus
/** @type {DiffLineKind} */
const firstLineKind = DIFF_LINE_KINDS[0]
void firstLineKind
/** @type {ChangeBinding} */
const firstBinding = CHANGE_BINDINGS[0]
void firstBinding
void EDGE_VIOLATION_KINDS

/* ── (2) POSITIVE: a valid ChangesPayload (CLEAN wire pass-through) ───────────── */
/** @type {ChangesPayload} */
const changes = {
  repoFound: true,
  defaultBranch: 'main',
  changes: [
    {
      branch: 'feature/x',
      aheadCount: 3,
      behindCount: 0,
      filesChanged: 4,
      sessionCount: 2,
      taskCount: 5,
      newEdges: 1,
      removedEdges: 0,
      violations: 0,
      merged: false,
      baseHash: 'abc123',
      tipCommitMs: 1_700_000_000_000,
    },
  ],
  recentCommits: [{ hash: 'def456', subject: 'init', timeMs: 1, hasSession: true, sessionIds: ['session-1'] }],
  sessions: [{ sessionId: 'session-1', title: 'Build the feature', harness: 'codex', startMs: 1, hasCommitBinding: true }],
}
void changes

/* ── (3) POSITIVE: a CodeMapPayload (topology-only; geometry derived in-component) ── */
/** @type {CodeMapPayload} */
const codeMap = {
  repoFound: true,
  nodes: [
    {
      id: 'internal/ingest',
      kind: 'module',
      name: 'ingest',
      layer: 0,
      order: 0,
      loc: 1200,
      fileCount: 8,
      recordedFiles: 5,
      totalFiles: 8,
      touchCount: 12,
      effortDensity: 0.3,
    },
  ],
  structureEdges: [{ from: 'a', to: 'b', count: 2 }],
  violations: [{ kind: 'cycle', from: 'a', to: 'b' }],
}
void codeMap

/* ── (4) POSITIVE: MapSlice.activityEdges uses the ActivityEdge shape (taskCount) ──
   The activity (co-edit) edge's count channel is `taskCount`, NOT MapEdge's
   `count`. A valid activity edge has taskCount. */
/** @type {ActivityEdgePayload} */
const activityEdge = { from: 'a', to: 'b', taskCount: 4 }
/** @type {MapSlicePayload} */
const slice = {
  nodes: [],
  structureEdges: [{ from: 'a', to: 'b', count: 1 }],
  activityEdges: [activityEdge],
}
void slice

/* ── (5) NEGATIVE: an activity edge must NOT be a MapEdge (count ≠ taskCount) ─────
   This pins the distinct-element-type contract: an edge carrying `count` (the
   import-edge channel) is NOT assignable where an ActivityEdgePayload is required.
   Regressing activityEdges back to MapEdgePayload[] would make this compile. */
/** @param {ActivityEdgePayload} _e */
function _takesActivityEdge(_e) {}
/** @type {MapEdgePayload} */
const _importEdge = { from: 'a', to: 'b', count: 9 }
// @ts-expect-error — a MapEdge (count) is not an ActivityEdge (taskCount)
_takesActivityEdge(_importEdge)

/* ── (6) NEGATIVE: FileChangeStatus rejects an out-of-contract status string ───── */
/** @param {FileChangeStatus} _s */
function _takesStatus(_s) {}
// @ts-expect-error — "X" is not one of "M"|"A"|"D"|"R"
_takesStatus('X')

/* ── (7) NEGATIVE: a ChangeDiffPayload line kind is constrained ─────────────────
   DiffLinePayload.kind is "context"|"add"|"del"; a free string must not satisfy it. */
{
  /** @type {ChangeDiffPayload} */
  const diff = {
    branch: 'b',
    file: 'f.ts',
    status: 'M',
    binary: false,
    truncated: false,
    hunks: [
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [
          // @ts-expect-error — "changed" is not a DiffLineKind ("context"|"add"|"del")
          { kind: 'changed', text: 'x' },
        ],
      },
    ],
  }
  void diff
}

/* ── (8) POSITIVE: ChangeDetail carries the lifted-surface display stats ─────────
   outputTokens + filesChanged were un-carved (they back the demo's "ai wrote ≈N
   tokens" + "N files touched"); both are present and non-optional — outputTokens
   is the schema's wire int64 (bigint), filesChanged a plain number. */
{
  /** @type {ChangeDetailPayload} */
  const detail = /** @type {any} */ ({})
  /** @type {bigint} */
  const tokens = detail.outputTokens
  /** @type {number} */
  const files = detail.filesChanged
  void tokens
  void files
}

/* ── (9) NEGATIVE: ChangeDetail must not accept an unknown top-level field ─────── */
{
  /** @type {ChangeDetailPayload} */
  const detail = /** @type {any} */ ({})
  // @ts-expect-error — there is no per-caption "requests" count on the payload (no wire backing)
  void detail.requests
}

/* ── (10) POSITIVE: ChangeDiffPayload carries the optional HOST-SIDE error sentinel ─
   The host sets `error` (with empty hunks) when its lazy diff fetch fails, so the surface
   renders an error row instead of a perpetual spinner. It is NOT a wire field — the adapter
   must never map it from the REST payload — but the typedef must DECLARE it so a strict
   consumer's getDiff can return the sentinel without a type leak. */
{
  /** @type {ChangeDiffPayload} */
  const failed = {
    branch: 'b',
    file: 'f.ts',
    status: 'M',
    binary: false,
    truncated: false,
    hunks: [],
    error: 'could not load this file’s diff.',
  }
  /** @type {string | undefined} */
  const msg = failed.error
  void msg
}

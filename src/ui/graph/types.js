// @ts-check
/* ─────────────────────────────────────────────────────────────────────────────
   graph/types — peasant lifted-surface prop payload contracts (the adapter seam)
   ─────────────────────────────────────────────────────────────────────────────
   Three data-bearing surfaces lifted from peasant into fairtrade/ui:
     • Changes     — review change list (GET /api/v1/review/{projectHash})
     • ChangeDetail— one branch's full change detail + lazy per-file diff
     • CodeMap     — code topology + dependency graph (GET /api/v1/map/{projectHash})

   A thin adapter in the app converts the REST wire payload once into these
   cooked prop payloads; the lifted components never touch the wire shapes
   directly. This mirrors the transcript surface's wire-types/view-model split.

   SOURCE OF TRUTH for field names = peasant Go backend:
     ReviewListPayload / ChangeSummary / ChangeDetailPayload / FileChange /
     MapSlice / ChangeSession / TaskSummary / UnusualSignal / FrictionCluster /
     ChangeDiffPayload / DiffHunk / DiffLine / MapGraphPayload / MapNode /
     MapEdge / EdgeViolation — all in github.com/peasant-labs/schema.

   ── Fixture↔API delta tables ─────────────────────────────────────────────────

   ── CHANGES (CLEAN) ──────────────────────────────────────────────────────────
   Wire: ReviewListPayload (GET /api/v1/review/{projectHash}) → ChangesPayload
   Strategy: the wire maps 1:1; the adapter is nearly an identity function.

     PRESENT (repoFound, defaultBranch — page-level signals the component needs):
       repoFound, defaultBranch
     PRESENT (change list):
       changes[].branch, aheadCount, behindCount, filesChanged, sessionCount,
       taskCount, newEdges, removedEdges, violations (integer count), merged,
       lastWorkMs, mergedAtMs, reverted
       changes[].baseHash    — graph anchor: merge-base hash (fork point, open branches)
       changes[].tipCommitMs — graph anchor: branch tip time (row Y-position, open branches)
       changes[].mergeCommitHash — graph anchor: merge commit (join point, merged rows)
     PRESENT (time strip):
       recentCommits[].hash, subject, timeMs, hasSession
     ABSENT:
       projectHash — routing metadata; not needed as a prop inside the component

   ── CHANGE DETAIL (CLEAN) ────────────────────────────────────────────────────
   Wire: ChangeDetailPayload (GET /api/v1/review/{hash}/change?branch=) → ChangeDetailPayload
   Strategy: wire maps 1:1; the lazy per-file diff (ChangeDiffPayload) arrives
   separately via GET /diff?branch=&file= and is mounted via a slot/callback on
   the ChangeDetail surface — it is NOT embedded in this payload.

     PRESENT:
       branch, baseRef, defaultBranch
       files[].path, status (M/A/D/R), oldPath, linesAdded, linesRemoved
       slice.nodes[], slice.structureEdges[] (MapEdge: count)
       slice.activityEdges[] (ActivityEdge: taskCount — DISTINCT element type from
         structureEdges; the wire ActivityEdge has taskCount, NOT count)
       newEdges[], removedEdges[], newNodes[], removedNodes[]
       violations[].kind, from, to
       work[].sessionId, title, harness, startMs, binding, tasks[]
       work[].tasks[].sessionId, entryIndex, title, startMs, outcome, editedFiles,
         readCount, retryLoop, labels[]
       unrecordedCommits[].hash, subject, timeMs, hasSession
       unusual[].kind, label, perChange, perProject
       frictions[].kind, label, file, count, sessions
       linesAdded, linesRemoved
       filesChanged — authoritative changed-file count (passed through from the
         matching ChangeSummary row; backs the caption/totals "N files touched")
       outputTokens — SUM of output_tokens over bound sessions (backs "ai wrote ≈N tokens")
     PRESENT (optional):
       costUsd
     DERIVED (in the component, from the payload — no extra field):
       "N conversations" = work.length (each bound session is one conversation)
       "+N/−M connections" = newEdges.length / removedEdges.length
     ABSENT (no wire backing — the lifted component drops these demo affordances):
       per-caption "requests" count, per-file "conversations" count, per-hunk commit
         hash (the hunk carries the recorded session's id/title, not a commit hash)

   LAZY COMPANION — CHANGE DIFF (CLEAN):
   Wire: ChangeDiffPayload (GET /api/v1/review/{hash}/diff?branch=&file=) → ChangeDiffPayload
   Strategy: wire maps 1:1. Fetched lazily when the user opens a file's diff.

     PRESENT:
       branch, file, oldPath, status, binary, truncated
       hunks[].oldStart, oldLines, newStart, newLines, header
       hunks[].lines[].kind ("context"|"add"|"del"), text
       hunks[].sessionId, sessionTitle (conversation attribution via git blame)

   ── CODE MAP (TRANSFORM + interaction-parity) ────────────────────────────────
   Wire: MapGraphPayload (GET /api/v1/map/{projectHash}) → CodeMapPayload
   Strategy: TRANSFORM — topology passes through; the lifted <CodeMap> component
   carries layout.ts internally and computes geometry (x/y + width) from
   layer/order. The adapter calls mapGraphToData() (web/src/app/map/lib/mapData.ts)
   to produce the topology datums.

     PRESENT (topology nodes — field-for-field from MapNode):
       nodes[].id, parent, kind, name, language, layer, order, loc, fileCount,
       recordedFiles, totalFiles, touchCount, effortDensity
     PRESENT (structure edges — field-for-field):
       structureEdges[].from, to, count
     PRESENT (violations — field-for-field):
       violations[].kind, from, to
     TRANSFORM (geometry):
       x/y pixel positions + width — derived internally by the lifted component
       via computePositions(nodes, zoom) from layout.ts; NOT in the wire
     ABSENT from wire → excluded from payload:
       activityEdges — feeds the node rail's "often edited with" rows, not the
         canvas; the app wires them as separate node-detail data
     ABSENT (page-level metadata; not prop concerns for the canvas):
       projectHash, repoPath, parsedLanguages, generatedAtMs, atCommit
     INTERACTION-PARITY (not data fields — interaction props on <CodeMap>):
       onExpand, highlightedIds hover-relay, zoom + onZoomChange,
       Review changed-slice overlays (newNodes/violations), rail effort detail,
       keyboard accessibility — defined by <CodeMap>'s host-facing props

   ── ANALYTICS ────────────────────────────────────────────────────────────────
   The analytics view in the graph in-use shell mounts the real <ProjectOverview>
   from the in-repo analytics surface (src/ui/analytics/, shipped as its own
   per-surface entry `@peasant-labs/fairtrade/analytics`, isolated from
   ./graph). Its cooked payload contract (AnalyticsOverviewPayload /
   AnalyticsSessionRecord) and the app-adapter field-mapping table live in
   src/ui/analytics/types.js — not here.

   ── Runtime exports ──────────────────────────────────────────────────────────
   The @typedef blocks below are erased at build; the small frozen arrays are
   genuine runtime exports (canonical iteration order + tsc declaration-emit
   anchors). See transcript/wire-types.js for the full pattern.
   ─────────────────────────────────────────────────────────────────────────── */

import {
  AllChangeBindings,
  AllDiffLineKinds,
  AllEdgeViolationKinds,
  AllFileChangeStatuses,
  AllMapNodeKinds,
  isChangeBinding,
  isDiffLineKind,
  isEdgeViolationKind,
  isFileChangeStatus,
  isMapNodeKind,
} from '@peasant-labs/schema'

/* ── Shared enums ───────────────────────────────────────────────────────────── */

/**
 * Classification of a map node within the path-derived tree.
 * @typedef {import('@peasant-labs/schema').MapNodeKind} MapNodeKind
 */

/** Canonical MapNodeKind values, in schema order. @type {readonly MapNodeKind[]} */
export const MAP_NODE_KINDS = AllMapNodeKinds

/**
 * How strongly a recorded session is bound to a change.
 * @typedef {import('@peasant-labs/schema').ChangeBinding} ChangeBinding
 */

/** Canonical ChangeBinding values. @type {readonly ChangeBinding[]} */
export const CHANGE_BINDINGS = AllChangeBindings

/**
 * Kind of structural violation on the map.
 * @typedef {import('@peasant-labs/schema').EdgeViolationKind} EdgeViolationKind
 */

/** Canonical EdgeViolationKind values. @type {readonly EdgeViolationKind[]} */
export const EDGE_VIOLATION_KINDS = AllEdgeViolationKinds

/**
 * Per-file change status (branch vs merge-base). Git rename detection strips the
 * similarity score, so "R100"/"R087" normalize to "R".
 * @typedef {import('@peasant-labs/schema').FileChangeStatus} FileChangeStatus
 */

/** Canonical FileChangeStatus values, in schema order. @type {readonly FileChangeStatus[]} */
export const FILE_CHANGE_STATUSES = AllFileChangeStatuses

/**
 * Classification of one line within a unified-diff hunk.
 * @typedef {import('@peasant-labs/schema').DiffLineKind} DiffLineKind
 */

/** Canonical DiffLineKind values, in schema order. @type {readonly DiffLineKind[]} */
export const DIFF_LINE_KINDS = AllDiffLineKinds

/* ── Shared sub-types ────────────────────────────────────────────────────────── */

/** Lightweight commit reference used in the timeline. @typedef {import('@peasant-labs/schema').CommitRef} CommitRefPayload */

/** A recorded session available to annotate the Git timeline. @typedef {import('@peasant-labs/schema').TimelineSessionRef} TimelineSessionPayload */

/** A structure dependency edge. @typedef {import('@peasant-labs/schema').MapEdge} MapEdgePayload */

/** A co-edit observation edge. @typedef {import('@peasant-labs/schema').ActivityEdge} ActivityEdgePayload */

/** The generated wire currently widens kind; the cooked boundary narrows it. @typedef {Omit<import('@peasant-labs/schema').EdgeViolation, 'kind'> & {kind: EdgeViolationKind}} EdgeViolationPayload */

/** Topology-only map node with the generated kind narrowed canonically. @typedef {Omit<import('@peasant-labs/schema').MapNode, 'kind'> & {kind: MapNodeKind}} MapNodePayload */

/** Cooked sub-map with normalized non-null arrays. @typedef {Omit<import('@peasant-labs/schema').MapSlice, 'nodes'|'structureEdges'|'activityEdges'> & {nodes: MapNodePayload[], structureEdges: MapEdgePayload[], activityEdges: ActivityEdgePayload[]}} MapSlicePayload */

/* ── Changes surface ─────────────────────────────────────────────────────────── */

/**
 * One row in the Changes list: a local branch measured against the default
 * branch. Graph anchors (baseHash/tipCommitMs/mergeCommitHash) tie this row
 * to the time strip lane.
 * Mirrors ChangeSummary from github.com/peasant-labs/schema.
 *
 * @typedef {import('@peasant-labs/schema').ChangeSummary} ChangeSummaryPayload
 */

/**
 * The Changes surface prop payload. The adapter maps ReviewListPayload (CLEAN)
 * onto this shape — field-for-field, no reshaping required.
 *
 * @typedef {Omit<import('@peasant-labs/schema').ReviewListPayload, 'projectHash'>} ChangesPayload
 */

/* ── ChangeDetail surface ────────────────────────────────────────────────────── */

/**
 * One task within a change's bound sessions.
 * Mirrors TaskSummary from github.com/peasant-labs/schema.
 *
 * @typedef {Omit<import('@peasant-labs/schema').TaskSummary, 'editedFiles'|'labels'> & {editedFiles: string[], labels: string[]}} TaskSummaryPayload
 */

/**
 * One recorded session bound to a change, with its tasks.
 * Mirrors ChangeSession from github.com/peasant-labs/schema.
 *
 * @typedef {Omit<import('@peasant-labs/schema').ChangeSession, 'binding'|'harness'|'tasks'> & {binding: ChangeBinding, harness: import('@peasant-labs/schema').Harness, tasks: TaskSummaryPayload[]}} ChangeSessionPayload
 */

/**
 * One neutral rate-elevation observation: a metric that runs above the project
 * baseline for this change. Factual, never a grade.
 * Mirrors UnusualSignal from github.com/peasant-labs/schema.
 *
 * @typedef {import('@peasant-labs/schema').UnusualSignal} UnusualSignalPayload
 */

/**
 * A neutral count of a recurring friction signal keyed to a file.
 * Mirrors FrictionCluster from github.com/peasant-labs/schema.
 *
 * @typedef {import('@peasant-labs/schema').FrictionCluster} FrictionClusterPayload
 */

/**
 * One changed file within a branch (branch vs its merge-base).
 * Mirrors FileChange from github.com/peasant-labs/schema.
 *
 * @typedef {Omit<import('@peasant-labs/schema').FileChange, 'status'> & {status: FileChangeStatus}} FileChangePayload
 */

/**
 * The ChangeDetail surface prop payload. The adapter maps the wire
 * ChangeDetailPayload (CLEAN) onto this shape — field-for-field.
 * The lazy per-file diff (ChangeDiffPayload) is fetched separately and wired
 * via a callback/slot on the ChangeDetail surface; it is NOT embedded here.
 *
 * @typedef {Omit<import('@peasant-labs/schema').ChangeDetailPayload, 'files'|'slice'|'newEdges'|'removedEdges'|'newNodes'|'removedNodes'|'violations'|'work'|'unrecordedCommits'|'unusual'|'frictions'> & {files: FileChangePayload[], slice: MapSlicePayload, newEdges: MapEdgePayload[], removedEdges: MapEdgePayload[], newNodes: string[], removedNodes: string[], violations: EdgeViolationPayload[], work: ChangeSessionPayload[], unrecordedCommits: CommitRefPayload[], unusual: UnusualSignalPayload[], frictions: FrictionClusterPayload[], filesChanged: number}} ChangeDetailPayload
 */

/* ── ChangeDiff surface (lazy per-file diff companion) ───────────────────────── */

/**
 * One line within a diff hunk. `kind` uses the unified-diff convention.
 * Mirrors DiffLine from github.com/peasant-labs/schema.
 *
 * @typedef {Omit<import('@peasant-labs/schema').DiffLine, 'kind'> & {kind: DiffLineKind}} DiffLinePayload
 */

/**
 * One unified-diff hunk (the `-old +new` range line). May carry conversation
 * attribution when the hunk's added lines trace to a recorded session via git blame.
 * Mirrors DiffHunk from github.com/peasant-labs/schema.
 *
 * @typedef {Omit<import('@peasant-labs/schema').DiffHunk, 'lines'> & {lines: DiffLinePayload[]}} DiffHunkPayload
 */

/**
 * The lazy per-file diff payload — fetched on demand when the user opens a
 * file's diff inside the ChangeDetail surface. Adapter maps the wire
 * ChangeDiffPayload (CLEAN) onto this shape — field-for-field.
 *
 * @typedef {Omit<import('@peasant-labs/schema').ChangeDiffPayload, 'status'|'hunks'> & {status: FileChangeStatus, hunks: DiffHunkPayload[], error?: string}} ChangeDiffPayload
 */

/* ── CodeMap surface ─────────────────────────────────────────────────────────── */

/**
 * The CodeMap surface prop payload. The adapter maps MapGraphPayload
 * (TRANSFORM) onto this shape: topology passes through field-for-field via
 * mapGraphToData() (web/src/app/map/lib/mapData.ts); the lifted <CodeMap>
 * component derives pixel geometry (x/y + width) from layer/order internally
 * using layout.ts — geometry is NOT a field in this payload.
 *
 * activityEdges are excluded here: they feed the node-detail rail's
 * "often edited with" rows, not the canvas. The surface slice wires them
 * separately as a node-detail prop.
 *
 * Interaction-parity props (onExpand, highlightedIds, zoom, onZoomChange,
 * Review changed-slice overlays, effort overlay, keyboard) are component-level
 * props defined in the surface slice, not data fields in this payload.
 *
 * @typedef {Omit<import('@peasant-labs/schema').MapGraphPayload, 'projectHash'|'repoPath'|'parsedLanguages'|'generatedAtMs'|'atCommit'|'activityEdges'|'nodes'|'structureEdges'|'violations'> & {nodes: MapNodePayload[], structureEdges: MapEdgePayload[], violations: EdgeViolationPayload[]}} CodeMapPayload
 */

/**
 * @param {(value: unknown) => boolean} predicate
 * @param {unknown} value
 * @param {string} path
 * @param {string} operation
 * @param {readonly string[]} allowed
 */
function assertCanonical(predicate, value, path, operation, allowed) {
  if (predicate(value)) return
  let rendered
  try {
    rendered = JSON.stringify(value)
  } catch {
    rendered = String(value)
  }
  throw new TypeError(
    `Graph contract validation failed for ${rendered} at src/ui/graph/types.js during ${operation}: ` +
    `${path} is outside the canonical @peasant-labs/schema value domain (${allowed.join(', ')}), so Fairtrade cannot safely render this graph payload; ` +
    'the caller must validate and normalize the local API response before passing it to the cooked graph surface.',
  )
}

/** @param {CodeMapPayload} payload */
export function assertCodeMapPayloadEnums(payload) {
  for (const [index, node] of payload.nodes.entries()) {
    assertCanonical(isMapNodeKind, node.kind, `nodes[${index}].kind`, 'code-map payload rendering', AllMapNodeKinds)
  }
  for (const [index, violation] of payload.violations.entries()) {
    assertCanonical(isEdgeViolationKind, violation.kind, `violations[${index}].kind`, 'code-map payload rendering', AllEdgeViolationKinds)
  }
}

/** @param {ChangeDetailPayload} payload */
export function assertChangeDetailPayloadEnums(payload) {
  for (const [index, file] of payload.files.entries()) {
    assertCanonical(isFileChangeStatus, file.status, `files[${index}].status`, 'change-detail payload rendering', AllFileChangeStatuses)
  }
  for (const [index, session] of payload.work.entries()) {
    assertCanonical(isChangeBinding, session.binding, `work[${index}].binding`, 'change-detail payload rendering', AllChangeBindings)
  }
  for (const [index, node] of payload.slice.nodes.entries()) {
    assertCanonical(isMapNodeKind, node.kind, `slice.nodes[${index}].kind`, 'change-detail payload rendering', AllMapNodeKinds)
  }
  for (const [index, violation] of payload.violations.entries()) {
    assertCanonical(isEdgeViolationKind, violation.kind, `violations[${index}].kind`, 'change-detail payload rendering', AllEdgeViolationKinds)
  }
}

/** @param {ChangeDiffPayload} payload */
export function assertChangeDiffPayloadEnums(payload) {
  assertCanonical(isFileChangeStatus, payload.status, 'status', 'change-diff payload rendering', AllFileChangeStatuses)
  for (const [hunkIndex, hunk] of payload.hunks.entries()) {
    for (const [lineIndex, line] of hunk.lines.entries()) {
      assertCanonical(isDiffLineKind, line.kind, `hunks[${hunkIndex}].lines[${lineIndex}].kind`, 'change-diff payload rendering', AllDiffLineKinds)
    }
  }
}

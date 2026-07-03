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
     MapEdge / EdgeViolation — all in pkg/schema/map_api.go.

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

/* ── Shared enums ───────────────────────────────────────────────────────────── */

/**
 * Classification of a map node within the path-derived tree.
 * pkg/schema/map_api.go — MapNodeKind constants.
 * @typedef {'module' | 'package' | 'file'} MapNodeKind
 */

/** Canonical MapNodeKind values, in schema order. @type {readonly MapNodeKind[]} */
export const MAP_NODE_KINDS = Object.freeze(['module', 'package', 'file'])

/**
 * How strongly a recorded session is bound to a change.
 * pkg/schema/map_api.go — ChangeBinding constants.
 * @typedef {'bound' | 'candidate'} ChangeBinding
 */

/** Canonical ChangeBinding values. @type {readonly ChangeBinding[]} */
export const CHANGE_BINDINGS = Object.freeze(['bound', 'candidate'])

/**
 * Kind of structural violation on the map.
 * pkg/schema/map_api.go — EdgeViolationKind constants.
 * @typedef {'cycle' | 'wrong_way'} EdgeViolationKind
 */

/** Canonical EdgeViolationKind values. @type {readonly EdgeViolationKind[]} */
export const EDGE_VIOLATION_KINDS = Object.freeze(['cycle', 'wrong_way'])

/**
 * Per-file change status (branch vs merge-base). Git rename detection strips the
 * similarity score, so "R100"/"R087" normalize to "R".
 * Grounded in internal/gitops/repo.go — FileStatus{Modified,Added,Deleted,Renamed}
 * ("M"/"A"/"D"/"R"); carried verbatim onto FileChange.Status / ChangeDiffPayload.Status
 * in pkg/schema/map_api.go.
 * @typedef {'M' | 'A' | 'D' | 'R'} FileChangeStatus
 */

/** Canonical FileChangeStatus values, in schema order. @type {readonly FileChangeStatus[]} */
export const FILE_CHANGE_STATUSES = Object.freeze(['M', 'A', 'D', 'R'])

/**
 * Classification of one line within a unified-diff hunk.
 * Grounded in internal/gitops/repo.go — DiffLine{Context,Added,Removed}
 * ("context"/"add"/"del"); carried onto DiffLine.Kind in pkg/schema/map_api.go.
 * @typedef {'context' | 'add' | 'del'} DiffLineKind
 */

/** Canonical DiffLineKind values, in schema order. @type {readonly DiffLineKind[]} */
export const DIFF_LINE_KINDS = Object.freeze(['context', 'add', 'del'])

/* ── Shared sub-types ────────────────────────────────────────────────────────── */

/**
 * Lightweight commit reference used in the time strip and unrecorded commits.
 * Mirrors CommitRef from pkg/schema/map_api.go.
 *
 * @typedef {object} CommitRefPayload
 * @property {string} hash        commit SHA
 * @property {string} subject     first line of the commit message
 * @property {number | null} [timeMs]   committer date, Unix millis; absent when unknown
 * @property {boolean} hasSession true when a recorded session is bound to this commit
 */

/**
 * A structure (import) dependency edge between two map nodes.
 * Mirrors MapEdge from pkg/schema/map_api.go.
 *
 * @typedef {object} MapEdgePayload
 * @property {string} from  source node ID (repo-relative path)
 * @property {string} to    target node ID
 * @property {number} count underlying import count (aggregated)
 */

/**
 * A co-edit (activity) observation edge: two nodes repeatedly edited by the
 * same tasks. DISTINCT from MapEdgePayload — the count channel is `taskCount`
 * (distinct tasks that edited both endpoints), NOT the import `count`.
 * Mirrors ActivityEdge from pkg/schema/map_api.go.
 *
 * @typedef {object} ActivityEdgePayload
 * @property {string} from      source node ID
 * @property {string} to        target node ID
 * @property {number} taskCount distinct tasks that edited both endpoints
 */

/**
 * A structural violation — a cycle or wrong-way import — on the map.
 * Mirrors EdgeViolation from pkg/schema/map_api.go.
 *
 * @typedef {object} EdgeViolationPayload
 * @property {EdgeViolationKind} kind
 * @property {string} from  source node ID
 * @property {string} to    target node ID
 */

/**
 * One node on the code map (module, package, or file). Topology-only: the
 * lifted <CodeMap> component derives pixel positions from layer/order using
 * layout.ts internally; consumers supply raw topology.
 * Mirrors MapNode from pkg/schema/map_api.go (field-for-field).
 *
 * @typedef {object} MapNodePayload
 * @property {string} id               repo-relative path, e.g. "internal/ingest" or "web/src/lib/api.ts"
 * @property {string} [parent]         ID of parent node; absent for top-level modules
 * @property {MapNodeKind} kind
 * @property {string} name             display leaf, e.g. "ingest"
 * @property {string} [language]       e.g. "go" or "typescript"; absent for activity-only nodes
 * @property {number} layer            0 = top row; deterministic, server-assigned
 * @property {number} order            stable sort within layer; server-assigned
 * @property {number} loc              size metric (lines of code)
 * @property {number} fileCount        1 for file nodes
 * @property {number} recordedFiles    files whose last edit traces to a recorded session
 * @property {number} totalFiles
 * @property {number} touchCount       recorded edits in the activity window (activity size metric)
 * @property {number} effortDensity    0..1 per-file re-edit/error density rollup (0 when unknown)
 */

/**
 * A scoped sub-map: the touched nodes plus their one-hop neighborhood, with
 * layer/order preserved from the full map. Used inside ChangeDetailPayload.
 * Mirrors MapSlice from pkg/schema/map_api.go.
 *
 * @typedef {object} MapSlicePayload
 * @property {MapNodePayload[]} nodes               topology-only; layer/order from the full map
 * @property {MapEdgePayload[]} structureEdges      parsed import edges within the slice (count = import count)
 * @property {ActivityEdgePayload[]} activityEdges  co-edit observations within the slice (taskCount, NOT count)
 */

/* ── Changes surface ─────────────────────────────────────────────────────────── */

/**
 * One row in the Changes list: a local branch measured against the default
 * branch. Graph anchors (baseHash/tipCommitMs/mergeCommitHash) tie this row
 * to the time strip lane.
 * Mirrors ChangeSummary from pkg/schema/map_api.go.
 *
 * @typedef {object} ChangeSummaryPayload
 * @property {string} branch
 * @property {number} aheadCount        commits ahead of the default branch
 * @property {number} behindCount
 * @property {number} filesChanged
 * @property {number} sessionCount      recorded sessions bound to this change
 * @property {number} taskCount         distinct tasks across bound sessions
 * @property {number} newEdges          new import edges introduced
 * @property {number} removedEdges
 * @property {number} violations        count of structural violations introduced
 * @property {number | null} [lastWorkMs]   most-recent recorded-session activity, Unix millis
 * @property {boolean} merged
 * @property {number | null} [mergedAtMs]
 * @property {boolean} [reverted]       true when this merged change was later git-reverted
 * @property {string} [baseHash]        graph anchor: merge-base commit hash (fork point; open branches)
 * @property {number | null} [tipCommitMs]  graph anchor: branch tip committer time (row position; open branches)
 * @property {string} [mergeCommitHash] graph anchor: merge commit hash (join point; merged rows)
 */

/**
 * The Changes surface prop payload. The adapter maps ReviewListPayload (CLEAN)
 * onto this shape — field-for-field, no reshaping required.
 *
 * @typedef {object} ChangesPayload
 * @property {boolean} repoFound               false when the project root is not a git repo
 * @property {string} [defaultBranch]
 * @property {ChangeSummaryPayload[]} changes  open branches first, then merged (reverse-chron within each)
 * @property {CommitRefPayload[]} recentCommits default-branch commits for the time strip, cap 200
 */

/* ── ChangeDetail surface ────────────────────────────────────────────────────── */

/**
 * One task within a change's bound sessions.
 * Mirrors TaskSummary from pkg/schema/map_api.go.
 *
 * @typedef {object} TaskSummaryPayload
 * @property {string} sessionId
 * @property {number} entryIndex       depth-0 user-turn index (task identity)
 * @property {string} title            first ~80 chars of the user turn
 * @property {number | null} [startMs] task start, Unix millis
 * @property {string} [outcome]        session-level outcome string
 * @property {string[]} editedFiles    repo-relative paths touched by this task
 * @property {number} readCount        reads within this task's range
 * @property {boolean} retryLoop       true when an error streak ≥2 occurs inside this task
 * @property {string[]} labels         effective auto/manual annotation values
 */

/**
 * One recorded session bound to a change, with its tasks.
 * Mirrors ChangeSession from pkg/schema/map_api.go.
 *
 * @typedef {object} ChangeSessionPayload
 * @property {string} sessionId
 * @property {string} title
 * @property {string} harness
 * @property {number | null} [startMs]
 * @property {ChangeBinding} binding  "bound" = commit-in-branch AND file overlap; "candidate" = one arm only
 * @property {TaskSummaryPayload[]} tasks
 */

/**
 * One neutral rate-elevation observation: a metric that runs above the project
 * baseline for this change. Factual, never a grade.
 * Mirrors UnusualSignal from pkg/schema/map_api.go.
 *
 * @typedef {object} UnusualSignalPayload
 * @property {string} kind       stable slug, e.g. "retryLoops"
 * @property {string} label      plain, neutral description
 * @property {number} perChange  this change's per-conversation rate
 * @property {number} perProject project baseline rate
 */

/**
 * A neutral count of a recurring friction signal keyed to a file.
 * Mirrors FrictionCluster from pkg/schema/map_api.go.
 *
 * @typedef {object} FrictionClusterPayload
 * @property {string} kind     signal slug, e.g. "retryLoop"
 * @property {string} label    plain, neutral, e.g. "retry loops"
 * @property {string} file     repo-relative path
 * @property {number} count    occurrences (retry-loop tasks touching this file)
 * @property {number} sessions distinct conversations the occurrences span
 */

/**
 * One changed file within a branch (branch vs its merge-base).
 * Mirrors FileChange from pkg/schema/map_api.go.
 *
 * @typedef {object} FileChangePayload
 * @property {string} path
 * @property {FileChangeStatus} status  modified / added / deleted / renamed
 * @property {string | null} [oldPath]  present for renames
 * @property {number} linesAdded        0 for binary files or when numstat is unavailable
 * @property {number} linesRemoved
 */

/**
 * The ChangeDetail surface prop payload. The adapter maps the wire
 * ChangeDetailPayload (CLEAN) onto this shape — field-for-field.
 * The lazy per-file diff (ChangeDiffPayload) is fetched separately and wired
 * via a callback/slot on the ChangeDetail surface; it is NOT embedded here.
 *
 * @typedef {object} ChangeDetailPayload
 * @property {string} branch
 * @property {string} baseRef           merge-base commit hash
 * @property {string} defaultBranch
 * @property {FileChangePayload[]} files          changed files (branch vs merge-base)
 * @property {MapSlicePayload} slice              touched nodes + 1-hop neighborhood
 * @property {MapEdgePayload[]} newEdges          new import edges introduced
 * @property {MapEdgePayload[]} removedEdges
 * @property {string[]} newNodes                  new node IDs
 * @property {string[]} removedNodes
 * @property {EdgeViolationPayload[]} violations  structural violations INTRODUCED by this change
 * @property {ChangeSessionPayload[]} work        bound sessions, with tasks (each = one "conversation"; count = work.length)
 * @property {CommitRefPayload[]} unrecordedCommits  commits on the branch with no recorded session
 * @property {UnusualSignalPayload[]} unusual     neutral rate-elevation observations
 * @property {FrictionClusterPayload[]} frictions neutral recurring-friction counts
 * @property {number} filesChanged    authoritative changed-file count (from the matching ChangeSummary; files[] may be capped)
 * @property {number} linesAdded
 * @property {number} linesRemoved
 * @property {number} outputTokens    SUM of output_tokens over bound sessions (the "ai wrote ≈N tokens" stat)
 * @property {number | null} [costUsd]
 */

/* ── ChangeDiff surface (lazy per-file diff companion) ───────────────────────── */

/**
 * One line within a diff hunk. `kind` uses the unified-diff convention.
 * Mirrors DiffLine from pkg/schema/map_api.go.
 *
 * @typedef {object} DiffLinePayload
 * @property {DiffLineKind} kind  context / add / del
 * @property {string} text     line text, WITHOUT the leading +/-/space marker
 */

/**
 * One unified-diff hunk (the `-old +new` range line). May carry conversation
 * attribution when the hunk's added lines trace to a recorded session via git blame.
 * Mirrors DiffHunk from pkg/schema/map_api.go.
 *
 * @typedef {object} DiffHunkPayload
 * @property {number} oldStart
 * @property {number} oldLines
 * @property {number} newStart
 * @property {number} newLines
 * @property {string} [header]         hunk range header line, when present
 * @property {DiffLinePayload[]} lines
 * @property {string} [sessionId]      conversation attribution: recorded session that wrote most of the hunk's new lines
 * @property {string} [sessionTitle]
 */

/**
 * The lazy per-file diff payload — fetched on demand when the user opens a
 * file's diff inside the ChangeDetail surface. Adapter maps the wire
 * ChangeDiffPayload (CLEAN) onto this shape — field-for-field.
 *
 * @typedef {object} ChangeDiffPayload
 * @property {string} branch
 * @property {string} file         the new (or only) file path
 * @property {string | null} [oldPath]  present for renames
 * @property {FileChangeStatus} status  modified / added / deleted / renamed
 * @property {boolean} binary      true for binary files (no hunks)
 * @property {boolean} truncated   true when the file exceeds the size cap
 * @property {DiffHunkPayload[]} hunks
 * @property {string} [error]      HOST-SIDE error sentinel — NOT a wire field. The adapter
 *                                 must never map this from the REST payload; the host sets it
 *                                 (with empty `hunks`) when its lazy diff fetch FAILED, so the
 *                                 surface renders an error row instead of a perpetual spinner.
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
 * @typedef {object} CodeMapPayload
 * @property {boolean} repoFound             false when the project root is not a git repo; the component degrades to activity-only
 * @property {MapNodePayload[]} nodes        topology nodes for all zoom levels; parent links form the tree
 * @property {MapEdgePayload[]} structureEdges  parsed import edges (aggregated per node pair)
 * @property {EdgeViolationPayload[]} violations  structural violations (cycles + wrong-way imports)
 */

export {}

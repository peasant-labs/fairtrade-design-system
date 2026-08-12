// @ts-check
/* ───────────────────────────────────────────────────────────────────────────
   adapter — adaptTranscript(): the ONE fairtrade transcript projection
   ─────────────────────────────────────────────────────────────────────────
   `adaptTranscript` is the SOLE code that touches the canonical wire and the
   SOLE legacy-compatibility boundary. It maps a `SessionDetailPayload` (folded turns)
   ONCE into the cooked `TranscriptViewModel` every dumb component renders. It:

     • parses each tool call's JSON-string `arguments` / `result` exactly once
       (via the leaf `adapter.parse.js`, the one JSON.parse site) into
       `toolCallsById`;
     • normalises BOTH git wire shapes — the canonical flat `gitBranch` /
       `gitRemote` / `workingDirectory` fields and the retired nested
       `gitContext` shape — into the optional cooked
       `session.git`, so NO component ever references a git wire field;
     • cooks turns (labels, thinking, accents, per-turn annotations), diffs,
       files, tasks, highlights, and the filter index;
     • embeds the shared single-session analytics (phases / scorecard bands /
       pattern annotations / task groups) — accepting a precomputed block or
       computing it on demand (analytics.js).

   It imports only the leaf parse primitives (`adapter.parse.js`) and the shared
   analytics util (`analytics.js`); neither imports back, so there is no cycle.
   Pure-render derivations (previews, diff hunks) live here; genuine analytics
   live in analytics.js.
   ─────────────────────────────────────────────────────────────────────────── */

import { parseArgs, parseResult, extractPath, editPairs, writeContent, countDiff } from './adapter.parse.js'
import { computeAnalytics, computeTurnLabels, computeTaskGroups } from './analytics.js'
import { zObservedModelID } from '@peasant-labs/schema'

/** @typedef {import('./wire-types.js').TranscriptWireInput} TranscriptWireInput */
/** @typedef {import('./wire-types.js').SessionDetailPayload} SessionDetailPayload */
/** @typedef {import('./wire-types.js').TurnDetail} TurnDetail */
/** @typedef {import('./wire-types.js').ToolCallDetail} ToolCallDetail */
/** @typedef {import('./wire-types.js').AnnotationSummary} AnnotationSummary */
/** @typedef {import('./wire-types.js').CommitInfo} CommitInfo */
/** @typedef {import('./wire-types.js').LegacyCommit} LegacyCommit */
/** @typedef {import('./wire-types.js').LegacyGitContext} LegacyGitContext */
/** @typedef {import('./view-model.js').TranscriptViewModel} TranscriptViewModel */
/** @typedef {import('./view-model.js').TranscriptAnalyticsVM} TranscriptAnalyticsVM */
/** @typedef {import('./view-model.js').SessionVM} SessionVM */
/** @typedef {import('./view-model.js').SessionGitVM} SessionGitVM */
/** @typedef {import('./view-model.js').CommitVM} CommitVM */
/** @typedef {import('./view-model.js').TurnVM} TurnVM */
/** @typedef {import('./view-model.js').ToolCallVM} ToolCallVM */
/** @typedef {import('./view-model.js').ToolGroup} ToolGroup */
/** @typedef {import('./view-model.js').DiffLineVM} DiffLineVM */
/** @typedef {import('./view-model.js').DiffHunkVM} DiffHunkVM */
/** @typedef {import('./view-model.js').DiffEntryVM} DiffEntryVM */
/** @typedef {import('./view-model.js').FileEntryVM} FileEntryVM */
/** @typedef {import('./view-model.js').AnnotationVM} AnnotationVM */
/** @typedef {import('./view-model.js').HighlightVM} HighlightVM */
/** @typedef {import('./view-model.js').FilterIndexVM} FilterIndexVM */
/** @typedef {import('./view-model.js').PhaseVM} PhaseVM */

/* ── Small pure string helpers (no wire parsing) ─────────────────────────────── */

/** Collapse whitespace and bound a string for one-line previews. @param {string | undefined} s @param {number} [max] @returns {string} */
function preview(s, max = 80) {
  if (!s) return ''
  const oneLine = s.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? oneLine.slice(0, max - 1) + '…' : oneLine
}

/** Basename of a path. @param {string | undefined} path @returns {string} */
function basename(path) {
  if (!path) return ''
  const noTrail = path.replace(/\/+$/, '')
  const idx = noTrail.lastIndexOf('/')
  return idx === -1 ? noTrail : noTrail.slice(idx + 1)
}

/** Word count for a thinking toggle badge. @param {string} s @returns {number} */
function wordCount(s) {
  const m = s.trim().match(/\S+/g)
  return m ? m.length : 0
}

/** Compact token count, e.g. 1700 → "1.7k". @param {number} n @returns {string} */
function formatTokens(n) {
  if (!n || n <= 0) return '0'
  if (n < 1000) return String(n)
  const k = n / 1000
  return (k >= 10 ? Math.round(k) : Math.round(k * 10) / 10) + 'k'
}

/** Narrow an arbitrary parsed value to a string-keyed record. @param {unknown} v @returns {Record<string, unknown> | undefined} */
function recordOf(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : undefined
}

/* ── Turn prefilter (noise filter + consecutive dedup) ───────────────────────── */

/**
 * Default turn prefilter the adapter applies to `payload.turns`: drop turns with
 * neither content nor tool calls (and short tool-less system banners), then
 * collapse adjacent same-role turns with identical content (a streaming
 * artifact), preferring the tool-bearing copy. Pure, order-preserving. Exported
 * so a host that pre-scopes turns can run the SAME filter.
 * @param {TurnDetail[]} turns
 * @returns {TurnDetail[]}
 */
export function prefilterTurns(turns) {
  const filtered = turns.filter((t) => {
    const hasContent = !!t.content?.trim()
    const hasTools = (t.toolCalls?.length ?? 0) > 0
    if (!hasContent && !hasTools) return false
    if (t.role === 'system' && !hasTools && (!t.content || t.content.trim().length < 8)) return false
    return true
  })
  /** @type {TurnDetail[]} */
  const deduped = []
  for (const curr of filtered) {
    const prev = deduped[deduped.length - 1]
    if (prev && prev.role === curr.role && prev.content === curr.content && prev.content.trim() !== '') {
      const prevHasTools = (prev.toolCalls?.length ?? 0) > 0
      const currHasTools = (curr.toolCalls?.length ?? 0) > 0
      if (currHasTools && !prevHasTools) deduped[deduped.length - 1] = curr
      continue
    }
    deduped.push(curr)
  }
  return deduped
}

/* ── Sticky model resolution (complete wire, before projection/filtering) ────── */

/**
 * A canonical observation is exact source evidence: accepted bytes are preserved,
 * while empty/edge-whitespace values and observations on non-assistant output are
 * ignored defensively. Producer validation remains the primary enforcement seam.
 * @param {TurnDetail} turn
 * @returns {string | undefined}
 */
function validObservedModel(turn) {
  if (turn.role !== 'assistant') return undefined
  const parsed = zObservedModelID.safeParse(turn.observedModel)
  return parsed.success ? parsed.data : undefined
}

/**
 * Resolve effective sticky model state over the COMPLETE canonical turn order.
 * Root assistant observations update root state. Inline subagent observations
 * attribute their own turn only and never carry into the root session.
 * @param {TurnDetail[]} turns
 * @param {string | undefined} seed
 * @returns {Map<number, { effectiveModel?: string, modelChangedFrom?: string }>}
 */
function resolveStickyModels(turns, seed) {
  /** @type {Map<number, { effectiveModel?: string, modelChangedFrom?: string }>} */
  const resolved = new Map()
  let activeRoot = typeof seed === 'string' && seed.length > 0 ? seed : undefined

  for (const turn of turns) {
    const depth = turn.depth ?? 0
    const observed = validObservedModel(turn)
    if (turn.role !== 'assistant') {
      resolved.set(turn.index, {})
      continue
    }
    if (depth > 0) {
      resolved.set(turn.index, observed === undefined ? {} : { effectiveModel: observed })
      continue
    }

    const before = activeRoot
    if (observed !== undefined) activeRoot = observed
    /** @type {{ effectiveModel?: string, modelChangedFrom?: string }} */
    const model = activeRoot === undefined ? {} : { effectiveModel: activeRoot }
    if (observed !== undefined && before !== undefined && observed !== before) model.modelChangedFrom = before
    resolved.set(turn.index, model)
  }
  return resolved
}

/**
 * @typedef {object} AdaptTranscriptOptions
 * @property {readonly number[]} [visibleTurnIndices] post-resolution projection by canonical turn index
 */

/* ── Tool-call cooking ───────────────────────────────────────────────────────── */

/**
 * Classify a tool call into its ACP-aligned `ToolCallKind`, preferring the wire
 * `toolKind` and falling back to name heuristics.
 * @param {ToolCallDetail} call
 * @returns {import('./wire-types.js').ToolCallKind}
 */
function classifyKind(call) {
  if (call.toolKind) return call.toolKind
  const n = call.name.toLowerCase()
  if (n === 'read' || n === 'notebookread') return 'read'
  if (n === 'edit' || n === 'multiedit' || n === 'notebookedit' || n === 'write') return 'edit'
  if (n === 'bash' || n === 'runcommand' || n === 'run_command' || n === 'shell') return 'execute'
  if (n === 'grep' || n === 'glob' || n === 'globsearch' || n === 'websearch' || n === 'web_search') return 'search'
  if (n === 'webfetch' || n === 'web_fetch' || n === 'fetch' || n === 'readwebsite') return 'fetch'
  if (n === 'delete' || n === 'remove') return 'delete'
  if (n === 'move' || n === 'rename') return 'move'
  return 'other'
}

/**
 * Classify a tool call into its filters-rail `ToolGroup`.
 * @param {ToolCallDetail} call
 * @returns {ToolGroup}
 */
function groupFor(call) {
  const n = call.name.toLowerCase()
  if (n === 'read' || n === 'notebookread') return 'read'
  if (n === 'edit' || n === 'multiedit' || n === 'notebookedit' || n === 'write') return 'edits'
  if (n === 'bash' || n === 'runcommand' || n === 'run_command' || n === 'shell') return 'bash'
  if (n === 'grep' || n === 'glob' || n === 'globsearch' || n === 'websearch' || n === 'web_search') return 'search'
  if (n === 'webfetch' || n === 'web_fetch' || n === 'fetch' || n === 'readwebsite') return 'fetch'
  if (n === 'task' || n === 'taskcreate' || n === 'taskupdate' || n === 'task_create' || n === 'task_update' || n === 'todowrite' || n === 'agent') return 'tasks'
  switch (call.toolKind) {
    case 'read': return 'read'
    case 'edit': return 'edits'
    case 'execute': return 'bash'
    case 'search': return 'search'
    case 'fetch': return 'fetch'
    default: return 'other'
  }
}

/**
 * One-line collapsed summary of a tool call's arguments — the shortest
 * meaningful field, by precedence.
 * @param {ToolCallDetail} call
 * @returns {string}
 */
function makePreview(call) {
  const a = recordOf(parseArgs(call.arguments))
  // file-oriented tools → the located path. The wire carries the full path, so the head shows it
  // (the canonical reference shows the located file, not just its leaf — the leaf alone loses the dir).
  const filePath = call.filePath ?? (a && typeof a.file_path === 'string' ? a.file_path : undefined)
  if (filePath) return filePath
  if (!a) return preview(call.arguments, 80)
  if (typeof a.command === 'string') return preview(a.command, 100)
  // search / grep → "pattern · scope · N matches": scope is in the wire args, the count comes off the
  // wire result. All three are real wire signals a consumer wants surfaced (not just the bare pattern).
  if (typeof a.pattern === 'string') {
    const scope = typeof a.path === 'string' ? a.path : typeof a.glob === 'string' ? a.glob : undefined
    const out = parseResult(call.result)
    const n = Array.isArray(out)
      ? out.length
      : typeof out === 'string' && out.trim() !== ''
        ? out.split('\n').filter((l) => l.trim() !== '').length
        : undefined
    return [a.pattern, scope, n != null ? `${n} ${n === 1 ? 'match' : 'matches'}` : undefined]
      .filter(Boolean)
      .join(' · ')
  }
  if (typeof a.url === 'string') return a.url
  if (typeof a.query === 'string') return preview(a.query, 100)
  // task / subagent → "agent · description" (both are wire args)
  const agent =
    typeof a.subagent_type === 'string' ? a.subagent_type
      : typeof a.subagent === 'string' ? a.subagent
        : typeof a.agent === 'string' ? a.agent : undefined
  if (agent && typeof a.description === 'string') return `${agent} · ${a.description}`
  if (typeof a.description === 'string') return preview(a.description, 100)
  if (typeof a.subject === 'string') return preview(a.subject, 100)
  if (typeof a.prompt === 'string') return preview(a.prompt, 100)
  return preview(call.arguments, 80)
}

/**
 * Dependency-free line diff (LCS) → cooked `DiffLineVM[]`. fairtrade ships no
 * `diff` package, so the adapter computes hunks itself. Line numbers are 1-based
 * within the supplied snippet (the wire carries the edit snippet, not the file
 * offset). Deterministic — no clock/randomness — so it is screenshot-stable.
 * @param {string} oldText
 * @param {string} newText
 * @returns {DiffLineVM[]}
 */
export function diffLines(oldText, newText) {
  const a = oldText === '' ? [] : oldText.split('\n')
  const b = newText === '' ? [] : newText.split('\n')
  const m = a.length
  const n = b.length
  /** @type {number[][]} */
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  /** @type {DiffLineVM[]} */
  const out = []
  let i = 0
  let j = 0
  let oldNo = 1
  let newNo = 1
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ sign: 'ctx', oldNo: String(oldNo++), newNo: String(newNo++), text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ sign: 'del', oldNo: String(oldNo++), text: a[i] })
      i++
    } else {
      out.push({ sign: 'add', newNo: String(newNo++), text: b[j] })
      j++
    }
  }
  while (i < m) out.push({ sign: 'del', oldNo: String(oldNo++), text: a[i++] })
  while (j < n) out.push({ sign: 'add', newNo: String(newNo++), text: b[j++] })
  return out
}

/**
 * Compute the cooked diff hunks + churn for an edit-family / write tool call, or
 * undefined for any other kind.
 * @param {ToolCallDetail} call
 * @returns {{ hunks: DiffHunkVM[], adds: number, dels: number } | undefined}
 */
function buildDiffHunks(call) {
  const n = call.name.toLowerCase()
  if (n === 'write') {
    const content = writeContent(call)
    return { hunks: [{ lines: diffLines('', content) }], adds: content ? content.split('\n').length : 0, dels: 0 }
  }
  if (n === 'edit' || n === 'multiedit' || n === 'notebookedit') {
    const pairs = editPairs(call)
    if (pairs.length === 0) return undefined
    const hunks = pairs.map((p) => ({ lines: diffLines(p.old_string, p.new_string) }))
    const { adds, dels } = countDiff(call)
    return { hunks, adds, dels }
  }
  return undefined
}

/**
 * Cook a wire tool call into a fully render-ready `ToolCallVM`: parsed args /
 * output (once), preview, kind / group classification, and (for edits / writes)
 * diff hunks + churn.
 * @param {ToolCallDetail} call
 * @returns {ToolCallVM}
 */
function buildToolCallVM(call) {
  /** @type {ToolCallVM} */
  const vm = { id: call.id, name: call.name, kind: classifyKind(call), group: groupFor(call), preview: makePreview(call) }
  const args = parseArgs(call.arguments)
  if (args !== undefined) vm.args = args
  const output = parseResult(call.result)
  if (output !== undefined) vm.output = output
  const filePath = extractPath(call)
  if (filePath) vm.filePath = filePath
  if (call.durationMs != null) vm.durationMs = call.durationMs
  if (call.exitCode != null) vm.exitCode = call.exitCode
  if (call.isError) vm.isError = true
  const diff = buildDiffHunks(call)
  if (diff) {
    vm.diff = diff.hunks
    vm.adds = diff.adds
    vm.dels = diff.dels
  }
  return vm
}

/* ── Git normalisation (the single legacy-compatibility point) ──────────────── */

/** @param {CommitInfo | LegacyCommit} c @returns {CommitVM} */
function cookCommit(c) {
  const hash = c.hash
  const firstLine = c.message.split('\n')[0]
  /** @type {CommitVM} */
  const vm = { hash, shortHash: hash.slice(0, 7), message: firstLine }
  if ('authorName' in c) vm.author = c.authorName
  // CommitInfo.commitTime is the schema's wire int64 (bigint); Date.parse
  // returns a plain number. Normalize to number here — vm.commitTime is
  // matched against Date.parse-derived turn timestamps below, and commit
  // times never approach Number.MAX_SAFE_INTEGER.
  const commitTime = 'commitTime' in c ? Number(c.commitTime) : Date.parse(c.timestamp)
  if (Number.isFinite(commitTime)) vm.commitTime = commitTime
  if ('session' in c && c.session === true) vm.session = true
  // Per-commit churn is available only on the retired nested shape. The
  // canonical CommitInfo still contributes identity, author, and timestamps.
  if ('insertions' in c) vm.adds = c.insertions
  if ('deletions' in c) vm.dels = c.deletions
  if ('filesChanged' in c) vm.files = c.filesChanged
  return vm
}

/**
 * Join each cooked commit to the turn it attaches to, by matching its `commitTime` to the
 * nearest turn at/before that time (a commit follows the turn that produced it). Client-side:
 * the anchor is NOT on the wire, so it is derived once here off the cooked turn timestamps,
 * keeping the CheckpointMarker dumb. Turns without a parseable timestamp are skipped; a commit
 * that matches nothing stays unanchored and the viewer clusters it at the stream end.
 * @param {CommitVM[]} commits
 * @param {TurnVM[]} turnVMs
 */
function anchorCommitsToTurns(commits, turnVMs) {
  const stamped = turnVMs
    .map((t) => ({ index: t.index, ms: t.timestamp ? Date.parse(t.timestamp) : NaN }))
    .filter((x) => Number.isFinite(x.ms))
    .sort((a, b) => a.ms - b.ms)
  if (stamped.length === 0) return
  for (const c of commits) {
    if (typeof c.commitTime !== 'number') continue
    let anchor = stamped[0].index
    for (const s of stamped) {
      if (s.ms <= c.commitTime) anchor = s.index
      else break
    }
    c.turn = anchor
  }
}

/**
 * Normalise whichever git wire shape is present into the optional cooked
 * `session.git`, summing per-commit churn from the retired nested shape. Returns
 * undefined when no git signal exists at all (the chips degrade cleanly).
 * @param {TranscriptWireInput} payload
 * @returns {SessionGitVM | undefined}
 */
function cookGit(payload) {
  const gc = payload.gitContext
  const branch = payload.gitBranch ?? gc?.branch ?? undefined
  const remote = payload.gitRemote ?? gc?.remote ?? undefined
  const author = gc?.user
  const rawCommits = Array.isArray(gc?.commits) ? gc.commits : []

  /** @type {CommitVM[]} */
  const commits = []
  let filesChanged = 0
  let insertions = 0
  let deletions = 0
  for (const raw of rawCommits) {
    commits.push(cookCommit(raw))
    if ('filesChanged' in raw) filesChanged += raw.filesChanged
    if ('insertions' in raw) insertions += raw.insertions
    if ('deletions' in raw) deletions += raw.deletions
  }

  /** @type {SessionGitVM} */
  const git = {}
  if (branch) git.branch = branch
  if (remote) git.remote = remote
  if (author) git.author = author
  if (commits.length) git.commits = commits
  if (filesChanged > 0) git.filesChanged = filesChanged
  if (insertions > 0) git.insertions = insertions
  if (deletions > 0) git.deletions = deletions
  return Object.keys(git).length > 0 ? git : undefined
}

/**
 * Cook the session header / meta / outcome / scorecard, plus optional git.
 * @param {TranscriptWireInput} payload
 * @param {SessionGitVM | undefined} git
 * @returns {SessionVM}
 */
function cookSession(payload, git) {
  /** @type {SessionVM} */
  const session = {
    id: payload.id,
    harness: payload.harness,
    startTime: payload.startTime,
    endTime: payload.endTime,
    durationMins: payload.durationMins,
    totalTokens: payload.totalTokens,
    tokensIn: payload.tokensIn,
    tokensOut: payload.tokensOut,
    turnCount: payload.turnCount,
    toolCallCount: payload.toolCallCount,
  }
  if (payload.project) session.project = payload.project
  if (payload.model) session.model = payload.model
  const workingDirectory = payload.workingDirectory ?? payload.gitContext?.workingDirectory
  if (workingDirectory) session.workingDirectory = workingDirectory
  if (payload.outcome) session.outcome = payload.outcome
  if (payload.scorecard !== undefined) session.scorecard = payload.scorecard
  if (git) session.git = git
  return session
}

/* ── Annotations (pattern + fetched entry labels), keyed by wire turn index ──── */

/**
 * Map separately-fetched entry annotations onto cooked `AnnotationVM`s keyed by
 * the targeted wire entry index.
 * @param {AnnotationSummary[]} annotations
 * @returns {AnnotationVM[]}
 */
function mapEntryAnnotations(annotations) {
  /** @type {AnnotationVM[]} */
  const out = []
  for (const a of annotations) {
    if (a.targetEntryIndex == null) continue
    /** @type {AnnotationVM} */
    const vm = { id: a.id, kind: a.typeName, turn: a.targetEntryIndex, label: a.value || a.typeName }
    if (a.isPrimary) vm.isPrimary = true
    out.push(vm)
  }
  return out
}

/**
 * Index annotations (auto-detected patterns + fetched entry labels) by wire turn
 * index for O(1) per-turn lookup.
 * @param {AnnotationVM[]} patternAnns
 * @param {AnnotationVM[]} entryAnns
 * @returns {Record<number, AnnotationVM[]>}
 */
function indexAnnotations(patternAnns, entryAnns) {
  /** @type {Record<number, AnnotationVM[]>} */
  const byTurn = {}
  for (const a of patternAnns) {
    const list = byTurn[a.turn] ?? []
    list.push(a)
    byTurn[a.turn] = list
  }
  for (const a of entryAnns) {
    const list = byTurn[a.turn] ?? []
    list.push(a)
    byTurn[a.turn] = list
  }
  return byTurn
}

/* ── Diffs, files, highlights, filter index (from cooked turns) ──────────────── */

/** @param {TurnVM[]} turnVMs @returns {DiffEntryVM[]} */
function buildDiffs(turnVMs) {
  /** @type {DiffEntryVM[]} */
  const out = []
  for (const turn of turnVMs) {
    for (const tc of turn.toolCalls) {
      if (!tc.diff) continue
      const path = tc.filePath ?? '(unknown)'
      /** @type {DiffEntryVM} */
      const entry = { path, leaf: basename(path) || path, adds: tc.adds ?? 0, dels: tc.dels ?? 0, hunks: tc.diff, turn: turn.index, toolCallId: tc.id }
      out.push(entry)
    }
  }
  return out
}

/** @param {TurnVM[]} turnVMs @returns {FileEntryVM[]} */
function buildFiles(turnVMs) {
  /** @type {Map<string, FileEntryVM>} */
  const map = new Map()
  for (const turn of turnVMs) {
    for (const tc of turn.toolCalls) {
      const path = tc.filePath
      if (!path) continue
      let e = map.get(path)
      if (!e) {
        e = { path, leaf: basename(path) || path, reads: 0, writes: 0, edits: 0, deletes: 0, adds: 0, dels: 0, edited: false, turn: turn.index }
        map.set(path, e)
      }
      const n = tc.name.toLowerCase()
      if (n === 'read' || n === 'notebookread') e.reads++
      else if (n === 'edit' || n === 'multiedit' || n === 'notebookedit') {
        e.edits++
        e.adds += tc.adds ?? 0
        e.dels += tc.dels ?? 0
      } else if (n === 'write') {
        e.writes++
        e.adds += tc.adds ?? 0
      } else if (n === 'delete' || n === 'remove') e.deletes++
    }
  }
  const files = Array.from(map.values())
  for (const e of files) e.edited = e.writes + e.edits > 0
  return files
}

/**
 * Curated key-moment highlights backing the HIGHLIGHTS tab: initial request,
 * phase transitions, up to three errors, commit checkpoints, and the final
 * response. Every `turn` is a wire index so the tab can jump into the trace.
 * @param {TurnVM[]} turnVMs
 * @param {PhaseVM[]} phases
 * @param {SessionGitVM | undefined} git
 * @returns {HighlightVM[]}
 */
function buildHighlights(turnVMs, phases, git) {
  /** @type {HighlightVM[]} */
  const out = []

  const firstUser = turnVMs.find((t) => t.role === 'user' && t.content.trim() !== '')
  if (firstUser) {
    out.push({ id: 'hl-request', kind: 'request', turn: firstUser.index, icon: 'request', title: 'initial request', sub: preview(firstUser.content, 160) })
  }

  phases.slice(1).forEach((p, i) => {
    const t = turnVMs.find((x) => x.index === p.from)
    /** @type {HighlightVM} */
    const h = { id: `hl-phase-${i}`, kind: 'phase', turn: p.from, icon: 'phase', title: `${p.label} begins`, tag: p.label }
    const sub = preview(t ? t.content : '', 200)
    if (sub) h.sub = sub
    out.push(h)
  })

  let errCount = 0
  for (const t of turnVMs) {
    if (errCount >= 3) break
    const errCall = t.toolCalls.find((c) => c.isError)
    if (!t.isError && !errCall) continue
    /** @type {HighlightVM} */
    const h = { id: `hl-error-${t.index}`, kind: 'error', turn: t.index, icon: 'error', title: errCall ? `${errCall.name} failed` : 'Error', err: true }
    const body = errCall && typeof errCall.output === 'string' ? errCall.output : t.content
    const sub = preview(body, 200)
    if (sub) h.sub = sub
    out.push(h)
    errCount++
  }

  const lastTurn = turnVMs[turnVMs.length - 1]
  const anchor = lastTurn ? lastTurn.index : 0
  for (const c of git?.commits ?? []) {
    out.push({ id: `hl-commit-${c.hash}`, kind: 'checkpoint', turn: anchor, icon: 'commit', title: c.shortHash || c.hash || 'checkpoint', sub: c.message })
  }

  const lastAssistant = [...turnVMs].reverse().find((t) => t.role === 'assistant' && t.depth === 0 && t.content.trim() !== '')
  if (lastAssistant) {
    /** @type {HighlightVM} */
    const h = { id: 'hl-final', kind: 'final', turn: lastAssistant.index, icon: 'final', title: 'final response', sub: preview(lastAssistant.content, 200) }
    if (lastAssistant.tokens) h.tokens = formatTokens(lastAssistant.tokens.in + lastAssistant.tokens.out)
    out.push(h)
  }

  return out
}

/** Map a pattern/tag annotation kind onto its filters-rail tag id. @param {string} kind @returns {string | undefined} */
function tagForKind(kind) {
  if (kind === 'error') return 'errors'
  if (kind === 'retry') return 'retries'
  if (kind === 'revert') return 're-edit'
  if (kind === 'subagent') return 'subagent'
  return undefined
}

/**
 * @param {TurnVM[]} turnVMs
 * @param {Record<number, AnnotationVM[]>} annotationsByTurn
 * @returns {FilterIndexVM}
 */
function buildFilterIndex(turnVMs, annotationsByTurn) {
  /** @type {Record<ToolGroup, number>} */
  const toolGroupCounts = { edits: 0, bash: 0, read: 0, search: 0, fetch: 0, tasks: 0, other: 0 }
  for (const turn of turnVMs) for (const tc of turn.toolCalls) toolGroupCounts[tc.group]++

  /** @type {Record<string, number>} */
  const tagCounts = {}
  for (const key of Object.keys(annotationsByTurn)) {
    const anns = annotationsByTurn[/** @type {number} */ (/** @type {unknown} */ (key))] ?? []
    /** @type {Set<string>} */
    const tagsHere = new Set()
    for (const a of anns) {
      const tag = tagForKind(a.kind)
      if (tag) tagsHere.add(tag)
    }
    for (const tag of tagsHere) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
  }

  return { toolGroupCounts, annotationsByTurn, tags: Object.keys(tagCounts), tagCounts, totalTurns: turnVMs.length }
}

/* ── The adapter ─────────────────────────────────────────────────────────────── */

/**
 * Project the canonical wire payload (folded turns) into the cooked
 * `TranscriptViewModel` every dumb transcript component renders. The SOLE
 * wire-parse + legacy-git normalisation site.
 *
 * @param {TranscriptWireInput} payload          canonical wire plus legacy git compatibility
 * @param {AnnotationSummary[]} [annotations]     separately-fetched entry annotations
 * @param {TranscriptAnalyticsVM} [analytics]     precomputed analytics; else derived on demand
 * @param {AdaptTranscriptOptions} [options]      optional post-resolution visible-turn projection
 * @returns {TranscriptViewModel}
 */
export function adaptTranscript(payload, annotations, analytics, options) {
  const completeTurns = payload.turns ?? []
  const stickyModels = resolveStickyModels(completeTurns, payload.model)
  const filteredTurns = prefilterTurns(completeTurns)
  const visibleTurnIndices = options?.visibleTurnIndices === undefined ? null : new Set(options.visibleTurnIndices)
  const turns = visibleTurnIndices === null ? filteredTurns : filteredTurns.filter((turn) => visibleTurnIndices.has(turn.index))
  const labels = computeTurnLabels(turns)
  const provider = payload.harness

  // Genuine analytics — accepted precomputed, else derived once and reused below.
  const an = analytics ?? computeAnalytics(turns, { scorecard: payload.scorecard ?? undefined })

  const patternAnns = an.patternAnnotations ?? []
  const entryAnns = mapEntryAnnotations(annotations ?? [])
  const annotationsByTurn = indexAnnotations(patternAnns, entryAnns)

  // Last top-level assistant turn carries the `isFinal` marker.
  let finalPos = -1
  for (let p = 0; p < turns.length; p++) {
    const t = turns[p]
    if (t.role === 'assistant' && (t.depth ?? 0) === 0 && t.content?.trim()) finalPos = p
  }

  /** @type {Map<string, ToolCallVM>} */
  const toolCallsById = new Map()
  /** @type {TurnVM[]} */
  const turnVMs = []
  for (let p = 0; p < turns.length; p++) {
    const t = turns[p]
    const toolCalls = (t.toolCalls ?? []).map(buildToolCallVM)
    for (const tc of toolCalls) toolCallsById.set(tc.id, tc)

    let content = t.content ?? ''
    /** @type {import('./view-model.js').ThinkingVM | undefined} */
    let thinking
    if (t.entryType === 'thinking' && content.trim() !== '') {
      // STANDALONE thinking entry: the whole turn IS the thinking. This path is LIVE on the real wire —
      // peasant emits a standalone entryType=thinking turn — so a real consumer renders it today.
      thinking = { text: content, words: wordCount(content) }
      content = ''
    } else {
      // TOOL-SIBLING (inline) thinking, folded into the parent turn's content as a leading
      // <thinking>…</thinking> block: extract it into ThinkingVM (render-when-present) and leave the
      // response as content. RENDER-WHEN-PRESENT, pending a backend follow-up: peasant does NOT currently
      // fold tool-sibling thinking into content this way — it suppresses the redundant tool-sibling
      // thinking entry (transcript.go:154,164) and the text lives in the parent's ContentPreview / a
      // separate field, so this block is absent on today's wire (no regression; the transcript browser never rendered inline
      // thinking either). It lights up when peasant emits thinking in content (or the adapter is extended
      // to read ContentPreview) — same deferral pattern as the commit-churn binding.
      const m = content.match(/^\s*<thinking>([\s\S]*?)<\/thinking>\s*/)
      if (m) {
        const text = m[1].trim()
        if (text !== '') {
          thinking = { text, words: wordCount(text) }
          content = content.slice(m[0].length)
        }
      }
    }

    const depth = t.depth ?? 0
    const isError = t.entryType === 'error' || toolCalls.some((c) => c.isError)
    /** @type {TurnVM} */
    const turnVM = {
      index: t.index,
      role: t.role,
      label: labels[p] ?? String(p + 1),
      content,
      depth,
      toolCalls,
      annotations: annotationsByTurn[t.index] ?? [],
    }
    if (depth === 0 && t.role === 'assistant') turnVM.provider = provider
    if (t.agentName) turnVM.agentName = t.agentName
    if (thinking) turnVM.thinking = thinking
    if (t.entryType) turnVM.entryType = t.entryType
    if (t.stopReason !== undefined && t.stopReason !== null) turnVM.stopReason = t.stopReason
    if (isError) turnVM.isError = true
    if (p === finalPos) turnVM.isFinal = true
    if (t.tokensIn != null || t.tokensOut != null) turnVM.tokens = { in: t.tokensIn ?? 0, out: t.tokensOut ?? 0 }
    if (t.timestamp) turnVM.timestamp = t.timestamp
    const model = stickyModels.get(t.index)
    if (model?.effectiveModel !== undefined) turnVM.effectiveModel = model.effectiveModel
    if (model?.modelChangedFrom !== undefined) turnVM.modelChangedFrom = model.modelChangedFrom
    turnVMs.push(turnVM)
  }

  const git = cookGit(payload)
  if (git?.commits) anchorCommitsToTurns(git.commits, turnVMs)
  const phases = an.phases ?? []

  /** @type {TranscriptViewModel} */
  const vm = {
    session: cookSession(payload, git),
    turns: turnVMs,
    toolCallsById,
    diffs: buildDiffs(turnVMs),
    files: buildFiles(turnVMs),
    tasks: an.taskGroups ?? computeTaskGroups(turns),
    highlights: buildHighlights(turnVMs, phases, git),
    filterIndex: buildFilterIndex(turnVMs, annotationsByTurn),
    analytics: an,
  }
  return vm
}

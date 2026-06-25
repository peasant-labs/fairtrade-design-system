// @ts-check
/* ───────────────────────────────────────────────────────────────────────────
   analytics — the ONE shared single-session analytics util
   ─────────────────────────────────────────────────────────────────────────
   Genuinely-DERIVED single-session signals that are NOT on the wire and NOT pure
   formatting: phase detection, scorecard verdict bands, pattern / auto-annotation
   (error / retry / revert / subagent), and task / waterfall grouping. These were
   re-derived per consumer (peasant `web/src/lib/insights/*`, transcript-browser
   `lib/{tasks,pattern-detection,scorecard,waterfall}.ts`); this module is the
   single home so all three consumers share ONE implementation, rendered when
   present.

   Two surfaces:
     • `computeAnalytics(turns, …)` → the cooked `TranscriptAnalyticsVM` the
       adapter embeds (or accepts precomputed).
     • the standalone helpers `computeTasks` / `computeTurnLabels` /
       `buildTaskWaterfall` / `annotateTranscript` / `computePersonalMedians`
       (+ `detectPhases` / `assessScorecard`), kept on their canonical
       wire-shaped signatures so the transcript-browser migration can re-export
       them verbatim for peasant's back-compat imports.

   Pure-render derivations (preview one-liners, diff hunks) live in the adapter,
   NOT here. This module imports only the leaf wire-parse primitives
   (`adapter.parse.js`) — never the adapter — so there is no import cycle.
   ─────────────────────────────────────────────────────────────────────────── */

import { extractPath, countDiff } from './adapter.parse.js'

/** @typedef {import('./wire-types.js').TurnDetail} TurnDetail */
/** @typedef {import('./wire-types.js').ToolCallDetail} ToolCallDetail */
/** @typedef {import('./wire-types.js').SessionScorecard} SessionScorecard */
/** @typedef {import('./view-model.js').PhaseVM} PhaseVM */
/** @typedef {import('./view-model.js').ScorecardBandVM} ScorecardBandVM */
/** @typedef {import('./view-model.js').AnnotationVM} AnnotationVM */
/** @typedef {import('./view-model.js').TaskGroupVM} TaskGroupVM */
/** @typedef {import('./view-model.js').TranscriptAnalyticsVM} TranscriptAnalyticsVM */

/* ═══════════════════════════════════════════════════════════════════════════
   Tasks — user-prompt spans + per-task summary (back-compat: computeTasks,
   computeTurnLabels, buildTaskWaterfall)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A "task" is the span from a top-level user prompt up to (but not including)
 * the next one — one turn of human↔agent collaboration. The shape is the
 * canonical `TaskGroup` the transcript-browser already exports, kept stable for
 * back-compat re-export.
 * @typedef {object} TaskGroup
 * @property {number} startIndex          display position of the starting prompt
 * @property {number} endIndex            display position of the last turn (inclusive)
 * @property {number} promptEntryIndex    wire entry index of the prompt (anchor)
 * @property {number} [finalEntryIndex]   wire entry index of the final assistant turn
 * @property {string} prompt              untruncated user prompt
 * @property {number} toolCallCount
 * @property {string[]} filesTouched
 * @property {number} insertions
 * @property {number} deletions
 * @property {number} durationMs
 * @property {boolean} hasErrors
 * @property {number} tokens
 */

/**
 * Split a turn list into task groups. Each top-level (depth-0) user turn starts
 * a new task; depth-1+ user turns are content blocks, NOT boundaries. A session
 * that starts without a user prompt is a single task spanning everything.
 * @param {TurnDetail[]} turns
 * @returns {TaskGroup[]}
 */
export function computeTasks(turns) {
  if (turns.length === 0) return []

  /** @type {number[]} */
  const boundaries = []
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]
    if (t.role === 'user' && (t.depth ?? 0) === 0 && t.content?.trim()) boundaries.push(i)
  }
  if (boundaries.length === 0 || boundaries[0] !== 0) boundaries.unshift(0)

  /** @type {TaskGroup[]} */
  const tasks = []
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]
    const end = (i + 1 < boundaries.length ? boundaries[i + 1] : turns.length) - 1
    tasks.push(summarizeTask(turns, start, end))
  }
  return tasks
}

/**
 * @param {TurnDetail[]} turns
 * @param {number} start
 * @param {number} end
 * @returns {TaskGroup}
 */
function summarizeTask(turns, start, end) {
  const startTurn = turns[start]
  let toolCallCount = 0
  const files = new Set()
  let insertions = 0
  let deletions = 0
  let hasErrors = false
  let tokens = 0
  /** @type {number | undefined} */
  let finalEntryIndex

  for (let i = start; i <= end; i++) {
    const t = turns[i]
    tokens += (t.tokensIn ?? 0) + (t.tokensOut ?? 0)
    if (t.role === 'assistant' && (t.depth ?? 0) === 0) finalEntryIndex = t.index
    for (const c of t.toolCalls ?? []) {
      toolCallCount++
      if (c.isError) hasErrors = true
      const path = extractPath(c)
      if (path) files.add(path)
      const { adds, dels } = countDiff(c)
      insertions += adds
      deletions += dels
    }
  }

  const startTs = new Date(startTurn.timestamp).getTime()
  const endTs = new Date(turns[end].timestamp).getTime()
  const durationMs = Number.isFinite(startTs) && Number.isFinite(endTs) ? Math.max(0, endTs - startTs) : 0

  /** @type {TaskGroup} */
  const task = {
    startIndex: start,
    endIndex: end,
    promptEntryIndex: startTurn.index,
    prompt: startTurn.content ?? '',
    toolCallCount,
    filesTouched: Array.from(files),
    insertions,
    deletions,
    durationMs,
    hasErrors,
    tokens,
  }
  if (finalEntryIndex !== undefined) task.finalEntryIndex = finalEntryIndex
  return task
}

/**
 * Per-turn display labels: `"1"`, `"2"` for the prompts that open a task, and
 * `"2a"`, `"2b"` for the follow-ups within it.
 * @param {TurnDetail[]} turns
 * @returns {string[]}
 */
export function computeTurnLabels(turns) {
  if (turns.length === 0) return []
  const tasks = computeTasks(turns)
  /** @type {Map<number, number>} */
  const taskByPos = new Map()
  for (let i = 0; i < tasks.length; i++) taskByPos.set(tasks[i].startIndex, i + 1)

  /** @type {string[]} */
  const labels = new Array(turns.length)
  let currentTask = 0
  let subIndex = 0
  for (let i = 0; i < turns.length; i++) {
    const started = taskByPos.get(i)
    if (started !== undefined) {
      currentTask = started
      subIndex = 0
      labels[i] = `${currentTask}`
    } else if (currentTask === 0) {
      labels[i] = `${i + 1}`
    } else {
      subIndex += 1
      labels[i] = `${currentTask}${letterFor(subIndex)}`
    }
  }
  return labels
}

/** 1→'a', 2→'b' … 27→'aa'. @param {number} n @returns {string} */
function letterFor(n) {
  let out = ''
  let x = n
  while (x > 0) {
    out = String.fromCharCode(97 + ((x - 1) % 26)) + out
    x = Math.floor((x - 1) / 26)
  }
  return out
}

/**
 * One segment of the proportional task waterfall: a task's share of the total
 * work time and the cumulative share before it (segments tile back-to-back).
 * @typedef {object} WaterfallSegment
 * @property {number} promptEntryIndex
 * @property {number} offsetPct
 * @property {number} widthPct
 * @property {number} durationMs
 */

/**
 * Turn task groups into a relative-duration lane. When the total duration is 0
 * (untimed transcript) every segment is zero-width at offset 0 — the caller
 * renders the task list without bars rather than dividing by zero.
 * @param {TaskGroup[]} tasks
 * @returns {WaterfallSegment[]}
 */
export function buildTaskWaterfall(tasks) {
  const total = tasks.reduce((s, t) => s + Math.max(0, t.durationMs), 0)
  let acc = 0
  return tasks.map((t) => {
    const d = Math.max(0, t.durationMs)
    const offsetPct = total > 0 ? (acc / total) * 100 : 0
    const widthPct = total > 0 ? (d / total) * 100 : 0
    acc += d
    return { promptEntryIndex: t.promptEntryIndex, offsetPct, widthPct, durationMs: d }
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   Pattern / auto-annotation — error / retry / revert / subagent (back-compat:
   annotateTranscript)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A client-side detected pattern moment. Canonical `TranscriptAnnotation` shape
 * kept stable for back-compat re-export.
 * @typedef {object} TranscriptAnnotation
 * @property {number} turnIndex                       display position
 * @property {'retry' | 'error' | 'revert' | 'subagent'} type
 * @property {string} label
 * @property {'info' | 'warning' | 'error'} severity
 */

const SUBAGENT_TOOLS = new Set(['Task', 'EnterWorktree', 'SendMessage', 'TeamCreate'])
const FILE_CHANGE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit'])

/**
 * Walk a transcript and surface error / retry / revert / subagent moments,
 * sorted by display position.
 * @param {TurnDetail[]} turns
 * @returns {TranscriptAnnotation[]}
 */
export function annotateTranscript(turns) {
  /** @type {TranscriptAnnotation[]} */
  const annotations = []
  /** @type {{ name: string, index: number }[]} */
  const recent = []
  /** @type {Map<string, number[]>} */
  const fileEditTurns = new Map()

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    if (!turn.toolCalls) continue

    for (const tc of turn.toolCalls) {
      if (tc.isError || (tc.exitCode !== undefined && tc.exitCode !== null && tc.exitCode !== 0)) {
        annotations.push({ turnIndex: i, type: 'error', label: `${tc.name} failed`, severity: 'error' })
      }
      if (SUBAGENT_TOOLS.has(tc.name)) {
        annotations.push({ turnIndex: i, type: 'subagent', label: `Subagent: ${tc.name}`, severity: 'info' })
      }
      if (FILE_CHANGE_TOOLS.has(tc.name)) {
        const path = extractPath(tc)
        if (path) {
          const list = fileEditTurns.get(path) ?? []
          list.push(i)
          fileEditTurns.set(path, list)
        }
      }
      const repeats = recent.filter((r) => i - r.index <= 5 && r.name === tc.name)
      if (repeats.length >= 2) {
        annotations.push({ turnIndex: i, type: 'retry', label: 'Retry loop', severity: 'warning' })
        recent.length = 0
      }
      recent.push({ name: tc.name, index: i })
    }
  }

  for (const [path, indices] of fileEditTurns) {
    if (indices.length > 1) {
      const last = indices[indices.length - 1]
      const fileName = path.split('/').pop() ?? path
      annotations.push({ turnIndex: last, type: 'revert', label: `Re-edit: ${fileName}`, severity: 'warning' })
    }
  }

  return annotations.sort((a, b) => a.turnIndex - b.turnIndex)
}

/* ═══════════════════════════════════════════════════════════════════════════
   Phase detection — rule-based transcript segmentation
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {'planning' | 'exploration' | 'implementation' | 'testing' | 'error'
 *   | 'debug' | 'retry-loop' | 'user-correction' | 'recovery' | 'abandonment'} PhaseType
 */

/**
 * @typedef {object} PhaseSegment
 * @property {PhaseType} type
 * @property {number} startTurn          display position (inclusive)
 * @property {number} endTurn            display position (inclusive)
 * @property {{ type: PhaseType, count: number }[]} badges
 */

/** @type {Record<PhaseType, string>} */
const PHASE_LABELS = {
  planning: 'Planning',
  exploration: 'Exploration',
  implementation: 'Implementation',
  testing: 'Testing',
  error: 'Errors',
  debug: 'Debugging',
  'retry-loop': 'Retry loop',
  'user-correction': 'User correction',
  recovery: 'Recovery',
  abandonment: 'Abandonment',
}

/** Display label for a phase type, falling back to the raw value. @param {string} type @returns {string} */
export function phaseLabel(type) {
  return PHASE_LABELS[/** @type {PhaseType} */ (type)] ?? String(type)
}

const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'])
const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit'])
const TEST_PATTERNS = [
  /\btest\b/i, /\bjest\b/i, /\bpytest\b/i, /\bgo\s+test\b/i, /\bnpm\s+test\b/i,
  /\bmake\s+check\b/i, /\bcargo\s+test\b/i, /\bvitest\b/i, /\bplaywright\b/i, /\bmocha\b/i, /\brspec\b/i,
]

/** @param {TurnDetail} turn @param {Set<string>} tools @returns {boolean} */
function hasTools(turn, tools) {
  return turn.toolCalls?.some((tc) => tools.has(tc.name)) ?? false
}
/** @param {TurnDetail} turn @param {Set<string>} tools @returns {boolean} */
function hasOnlyTools(turn, tools) {
  if (!turn.toolCalls?.length) return false
  return turn.toolCalls.every((tc) => tools.has(tc.name))
}
/** @param {TurnDetail} turn @returns {boolean} */
function turnHasError(turn) {
  for (const tc of turn.toolCalls ?? []) {
    if (tc.isError) return true
    if (tc.exitCode !== undefined && tc.exitCode !== null && tc.exitCode !== 0) return true
  }
  return false
}
/** @param {TurnDetail} turn @returns {boolean} */
function isTesting(turn) {
  for (const tc of turn.toolCalls ?? []) {
    if (tc.name !== 'Bash') continue
    if (TEST_PATTERNS.some((p) => p.test(tc.arguments))) return true
  }
  return false
}

/**
 * @typedef {object} FailedAttempt
 * @property {string[]} tools
 * @property {[number, number]} turnRange
 */

/** @param {TurnDetail[]} turns @returns {FailedAttempt[]} */
function extractFailedAttempts(turns) {
  /** @type {FailedAttempt[]} */
  const attempts = []
  /** @type {string[]} */
  let currentTools = []
  let startIdx = -1

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    if (turn.role === 'user') {
      if (currentTools.length > 0 && startIdx >= 0) {
        currentTools = []
        startIdx = -1
      }
      continue
    }
    if (!turn.toolCalls?.length) continue
    if (startIdx < 0) startIdx = i

    for (const tc of turn.toolCalls) {
      currentTools.push(tc.name)
      const failed = tc.isError || (tc.exitCode !== undefined && tc.exitCode !== null && tc.exitCode !== 0)
      if (failed && currentTools.length > 0) {
        if (currentTools.some((t) => WRITE_TOOLS.has(t) || t === 'Bash')) {
          attempts.push({ tools: [...currentTools], turnRange: [startIdx, i] })
        }
        currentTools = []
        startIdx = -1
      }
    }
  }
  return attempts
}

/** @param {string[]} a @param {string[]} b @returns {number} */
function toolOverlap(a, b) {
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = [...setA].filter((t) => setB.has(t)).length
  const union = new Set([...setA, ...setB]).size
  return union > 0 ? intersection / union : 0
}

/** @param {TurnDetail[]} turns @returns {[number, number][]} */
function detectRetryRanges(turns) {
  const attempts = extractFailedAttempts(turns)
  /** @type {[number, number][]} */
  const ranges = []
  let i = 0
  while (i < attempts.length) {
    let j = i + 1
    while (j < attempts.length && toolOverlap(attempts[i].tools, attempts[j].tools) >= 0.5) j++
    if (j - i >= 2) ranges.push([attempts[i].turnRange[0], attempts[j - 1].turnRange[1]])
    i = j
  }
  return ranges
}

const CORRECTION_SIGNALS = [
  /\bi already said\b/i, /\bi told you\b/i, /\bno,?\s+not that\b/i, /\bthat'?s not what i\b/i,
  /\bnot what i asked\b/i, /\bwrong,?\s+i\b/i, /\bplease (re-?read|read again)\b/i,
]
const TASK_SWITCH = /\b(let'?s move on|forget it|different approach|never mind)\b/i

/**
 * @param {TurnDetail} turn
 * @param {number} displayIndex
 * @param {PhaseType | null} prevPhase
 * @param {number} recentErrorCount
 * @param {[number, number][]} retryRanges
 * @returns {PhaseType}
 */
function classifyTurn(turn, displayIndex, prevPhase, recentErrorCount, retryRanges) {
  for (const [start, end] of retryRanges) {
    if (displayIndex >= start && displayIndex <= end) return 'retry-loop'
  }
  if (turn.role === 'user') {
    if (CORRECTION_SIGNALS.some((p) => p.test(turn.content))) return 'user-correction'
    return prevPhase ?? 'planning'
  }
  if (turnHasError(turn)) return 'error'
  if (isTesting(turn)) return 'testing'
  if (recentErrorCount > 0 && hasOnlyTools(turn, READ_TOOLS)) return 'debug'
  if (hasTools(turn, WRITE_TOOLS)) {
    if (prevPhase === 'retry-loop' || prevPhase === 'user-correction') return 'recovery'
    return 'implementation'
  }
  if (hasOnlyTools(turn, READ_TOOLS) && recentErrorCount === 0) return 'exploration'
  if (turn.role === 'assistant' && !turn.toolCalls?.length && turn.content.length > 100) return 'planning'
  return prevPhase ?? 'planning'
}

const SIGNIFICANT_PHASES = new Set(['error', 'user-correction', 'retry-loop', 'abandonment'])

/** @param {PhaseSegment[]} segments @returns {PhaseSegment[]} */
function mergePhases(segments) {
  if (segments.length <= 1) return segments
  /** @type {PhaseSegment[]} */
  const merged = []
  for (let idx = 0; idx < segments.length; idx++) {
    const seg = segments[idx]
    const len = seg.endTurn - seg.startTurn + 1
    const prev = merged[merged.length - 1]

    if (prev && prev.type === seg.type) {
      prev.endTurn = seg.endTurn
      continue
    }
    if (len < 3 && !SIGNIFICANT_PHASES.has(seg.type) && prev) {
      prev.endTurn = seg.endTurn
      const badge = prev.badges.find((b) => b.type === seg.type)
      if (badge) badge.count += len
      else prev.badges.push({ type: seg.type, count: len })
      continue
    }
    if (seg.type === 'error' && len === 1 && prev) {
      const next = segments[idx + 1]
      if (next && next.type === prev.type) {
        prev.endTurn = seg.endTurn
        const badge = prev.badges.find((b) => b.type === 'error')
        if (badge) badge.count++
        else prev.badges.push({ type: 'error', count: 1 })
        continue
      }
    }
    merged.push({ ...seg, badges: [...seg.badges] })
  }
  return merged
}

/** @param {TurnDetail[]} turns @returns {PhaseSegment[]} */
function detectPhaseSegments(turns) {
  if (turns.length === 0) return []
  const retryRanges = detectRetryRanges(turns)

  /** @type {{ type: PhaseType, turn: number }[]} */
  const raw = []
  const errorWindow = 3
  for (let i = 0; i < turns.length; i++) {
    let recentErrors = 0
    for (let j = Math.max(0, i - errorWindow); j < i; j++) if (turnHasError(turns[j])) recentErrors++
    const prevPhase = raw.length > 0 ? raw[raw.length - 1].type : null
    raw.push({ type: classifyTurn(turns[i], i, prevPhase, recentErrors, retryRanges), turn: i })
  }

  /** @type {PhaseSegment[]} */
  const segments = []
  /** @type {PhaseSegment | null} */
  let current = null
  for (const { type, turn } of raw) {
    if (current && current.type === type) current.endTurn = turn
    else {
      if (current) segments.push(current)
      current = { type, startTurn: turn, endTurn: turn, badges: [] }
    }
  }
  if (current) segments.push(current)

  if (segments.length > 0) {
    const lastTurn = turns[turns.length - 1]
    const lastSegment = segments[segments.length - 1]
    const hasEndError = turnHasError(lastTurn) && lastTurn.role === 'assistant'
    const hasTaskSwitch = lastTurn.role === 'user' && TASK_SWITCH.test(lastTurn.content)
    const lastQuarter = turns.slice(Math.floor(turns.length * 0.8))
    const noWritesLate = !lastQuarter.some((t) => hasTools(t, WRITE_TOOLS))
    if (hasEndError || hasTaskSwitch || (noWritesLate && lastSegment.type !== 'planning')) {
      const totalErrors = turns.filter(turnHasError).length
      if ((totalErrors > 0 || hasTaskSwitch) && lastSegment.type !== 'abandonment') {
        const last = turns.length - 1
        segments.push({ type: 'abandonment', startTurn: last, endTurn: last, badges: [] })
      }
    }
  }

  return mergePhases(segments)
}

/**
 * Segment a transcript into rendered phases. `from` / `to` are WIRE turn indices
 * (matching `TurnVM.index`), so a divider component can anchor by them directly.
 * @param {TurnDetail[]} turns
 * @returns {PhaseVM[]}
 */
export function detectPhases(turns) {
  const segments = detectPhaseSegments(turns)
  return segments.map((seg, i) => {
    let errors = 0
    for (let p = seg.startTurn; p <= seg.endTurn; p++) if (turns[p] && turnHasError(turns[p])) errors++
    /** @type {PhaseVM} */
    const vm = {
      id: `phase-${i + 1}`,
      label: phaseLabel(seg.type),
      from: turns[seg.startTurn]?.index ?? seg.startTurn,
      to: turns[seg.endTurn]?.index ?? seg.endTurn,
      icon: seg.type,
    }
    if (errors > 0) vm.errors = errors
    return vm
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   Scorecard verdict bands + personal medians (back-compat: computePersonalMedians)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {object} PersonalMedians
 * @property {number} [retryShare]
 * @property {number} [specQualityScore]
 * @property {number} [withinSessionReverts]
 */

/**
 * A session sample for personal-median computation — the QualitySession subset
 * the medians read. Kept structural so the transcript-browser `QualitySession`
 * is assignable for back-compat.
 * @typedef {object} PersonalMedianSession
 * @property {number} totalTokens
 * @property {number} retryTokensWasted
 * @property {number} specQualityScore
 * @property {number} withinSessionReverts
 */

/** Median of a numeric sample, or undefined when empty. @param {number[]} values @returns {number | undefined} */
function median(values) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (xs.length === 0) return undefined
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid]
}

/**
 * Per-metric medians across the user's sessions, each field undefined when the
 * sample yields no value (so the comparison line degrades rather than fabricate
 * a baseline). The host supplies the sessions; the viewer never fetches them.
 * @param {PersonalMedianSession[] | undefined} sessions
 * @returns {PersonalMedians}
 */
export function computePersonalMedians(sessions) {
  if (!sessions || sessions.length === 0) return {}
  /** @type {number[]} */ const shares = []
  /** @type {number[]} */ const specs = []
  /** @type {number[]} */ const reverts = []
  for (const s of sessions) {
    if (s.totalTokens > 0 && Number.isFinite(s.retryTokensWasted)) shares.push(s.retryTokensWasted / s.totalTokens)
    if (Number.isFinite(s.specQualityScore) && s.specQualityScore > 0) specs.push(s.specQualityScore)
    if (Number.isFinite(s.withinSessionReverts)) reverts.push(s.withinSessionReverts)
  }
  /** @type {PersonalMedians} */
  const out = {}
  const rs = median(shares)
  const sq = median(specs)
  const rv = median(reverts)
  if (rs !== undefined) out.retryShare = rs
  if (sq !== undefined) out.specQualityScore = sq
  if (rv !== undefined) out.withinSessionReverts = rv
  return out
}

// Product-locked thresholds (no composite score, by design).
const RETRY_SHARE_RISK = 0.2
const CONTEXT_FILL_RISK = 70
const OUTPUT_SURVIVAL_RISK = 50
const SPEC_SCORE_RISK = 40
const SIGNAL_DENSITY_RISK = 30
const CONSEC_ERROR_RISK = 4
const REVERTS_RISK = 3

/** True when a scorecard signal was computed (not null/undefined). @param {unknown} v @returns {boolean} */
function present(v) {
  return v !== null && v !== undefined
}

/** Map the internal healthy/caution/risk severity onto the cooked band id. @param {'good'|'watch'|'bad'} b */
function bandRank(b) {
  return b === 'bad' ? 2 : b === 'watch' ? 1 : 0
}

/** @param {('good'|'watch'|'bad')[]} bands @returns {'good'|'watch'|'bad'} */
function worstBand(bands) {
  return bands.reduce((acc, b) => (bandRank(b) > bandRank(acc) ? b : acc), /** @type {'good'|'watch'|'bad'} */ ('good'))
}

/**
 * Derive the three scorecard axis verdict bands (token / prompt / loop
 * efficiency) from the raw numeric signals. Returns `[]` when the scorecard
 * carries no usable signal, so the card is omitted cleanly.
 * @param {SessionScorecard | null | undefined} sc
 * @param {PersonalMedians} [medians]
 * @returns {ScorecardBandVM[]}
 */
export function assessScorecard(sc, medians = {}) {
  if (!sc) return []
  /** @type {ScorecardBandVM[]} */
  const out = []

  // — Token efficiency —
  {
    /** @type {('good'|'watch'|'bad')[]} */
    const bands = []
    /** @type {string[]} */
    const flags = []
    const share =
      present(sc.totalTokens) && (sc.totalTokens ?? 0) > 0 && present(sc.retryTokensWasted)
        ? (sc.retryTokensWasted ?? 0) / (sc.totalTokens ?? 1)
        : undefined
    if (share !== undefined) {
      bands.push(share > RETRY_SHARE_RISK ? 'bad' : 'good')
      if (share > RETRY_SHARE_RISK) flags.push(`${Math.round(share * 100)}% of tokens spent on retries`)
    }
    if (present(sc.m5ContextUtilizationPct)) {
      const v = sc.m5ContextUtilizationPct ?? 0
      bands.push(v > CONTEXT_FILL_RISK ? 'watch' : 'good')
      if (v > CONTEXT_FILL_RISK) flags.push(`Context ${Math.round(v)}% full`)
    }
    if (present(sc.m6OutputSurvivalPct)) {
      const v = sc.m6OutputSurvivalPct ?? 0
      bands.push(v < OUTPUT_SURVIVAL_RISK ? 'watch' : 'good')
      if (v < OUTPUT_SURVIVAL_RISK) flags.push(`Only ${Math.round(v)}% of output survived`)
    }
    if (
      sc.outcome === 'failed' && present(sc.costTotalUsd) && share !== undefined &&
      medians.retryShare !== undefined && share > medians.retryShare
    ) {
      bands.push('bad')
      flags.push('Failed outcome with above-median spend')
    }
    const hasData = share !== undefined || present(sc.m5ContextUtilizationPct) || present(sc.m6OutputSurvivalPct)
    if (hasData) {
      out.push(makeBand('token', 'Token efficiency',
        share !== undefined ? `${Math.round(share * 100)}% retry tokens`
          : present(sc.m5ContextUtilizationPct) ? `${Math.round(sc.m5ContextUtilizationPct ?? 0)}% context used` : '—',
        worstBand(bands), flags))
    }
  }

  // — Prompt quality —
  {
    /** @type {('good'|'watch'|'bad')[]} */
    const bands = []
    /** @type {string[]} */
    const flags = []
    if (present(sc.specQualityScore)) {
      const v = sc.specQualityScore ?? 0
      bands.push(v < SPEC_SCORE_RISK ? 'bad' : 'good')
      if (v < SPEC_SCORE_RISK) flags.push(`Spec quality low (${Math.round(v)}/100)`)
    }
    if (present(sc.signalDensity)) {
      const v = sc.signalDensity ?? 0
      bands.push(v < SIGNAL_DENSITY_RISK ? 'watch' : 'good')
      if (v < SIGNAL_DENSITY_RISK) flags.push(`Sparse direction (${Math.round(v)}% signal)`)
    }
    if (sc.m7SpecHasExamples === false) { bands.push('watch'); flags.push('No examples in the prompt') }
    if (sc.m7SpecHasConstraints === false) { bands.push('watch'); flags.push('No constraints in the prompt') }
    const hasData = present(sc.specQualityScore) || present(sc.signalDensity)
      || present(sc.m7SpecHasExamples) || present(sc.m7SpecHasConstraints)
    if (hasData) {
      out.push(makeBand('prompt', 'Prompt quality',
        present(sc.specQualityScore) ? `Spec ${Math.round(sc.specQualityScore ?? 0)}/100`
          : present(sc.signalDensity) ? `${Math.round(sc.signalDensity ?? 0)}% signal` : '—',
        worstBand(bands), flags))
    }
  }

  // — Loop efficiency —
  {
    /** @type {('good'|'watch'|'bad')[]} */
    const bands = []
    /** @type {string[]} */
    const flags = []
    if (present(sc.m4ConsecutiveErrorMax)) {
      const v = sc.m4ConsecutiveErrorMax ?? 0
      bands.push(v >= CONSEC_ERROR_RISK ? 'bad' : 'good')
      if (v >= CONSEC_ERROR_RISK) flags.push(`${v} errors in a row`)
    }
    if (present(sc.withinSessionReverts)) {
      const v = sc.withinSessionReverts ?? 0
      bands.push(v >= REVERTS_RISK ? 'bad' : 'good')
      if (v >= REVERTS_RISK) flags.push(`${v} reverts mid-session`)
    }
    const hasData = present(sc.m4ConsecutiveErrorMax) || present(sc.withinSessionReverts)
    if (hasData) {
      out.push(makeBand('loop', 'Loop efficiency',
        present(sc.m4ConsecutiveErrorMax) ? `${sc.m4ConsecutiveErrorMax ?? 0} max error streak`
          : present(sc.withinSessionReverts) ? `${sc.withinSessionReverts ?? 0} reverts` : '—',
        worstBand(bands), flags))
    }
  }

  return out
}

/**
 * @param {string} id
 * @param {string} label
 * @param {string} value
 * @param {'good'|'watch'|'bad'} band
 * @param {string[]} flags
 * @returns {ScorecardBandVM}
 */
function makeBand(id, label, value, band, flags) {
  /** @type {ScorecardBandVM} */
  // emit the structured per-axis chrome (icon key + the flag LIST) so a consumer's DERIVED bands
  // render the rich scorecard, not just a joined sub-line. `icon` is the axis id (the consumer maps
  // it to a glyph); `detail` is kept as the joined fallback for a lean renderer.
  const out = { id, label, band, value, icon: id }
  if (flags.length) {
    out.flags = flags
    out.detail = flags.join(' · ')
  }
  return out
}

/* ═══════════════════════════════════════════════════════════════════════════
   Top-level — the cooked TranscriptAnalyticsVM the adapter embeds
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Map a detected pattern (display-position keyed) onto a cooked `AnnotationVM`
 * keyed by the WIRE turn index, so it aligns with `TurnVM.index`.
 * @param {TranscriptAnnotation} a
 * @param {TurnDetail[]} turns
 * @returns {AnnotationVM}
 */
function patternToVM(a, turns) {
  const wireIndex = turns[a.turnIndex]?.index ?? a.turnIndex
  return { id: `pattern-${a.type}-${a.turnIndex}`, kind: a.type, turn: wireIndex, label: a.label }
}

/**
 * Map a raw `TaskGroup` onto the cooked `TaskGroupVM` (1-based index, wire turn
 * indices, ok/error outcome).
 * @param {TaskGroup} tg
 * @param {number} i
 * @param {TurnDetail[]} turns
 * @returns {TaskGroupVM}
 */
function taskToVM(tg, i, turns) {
  /** @type {number[]} */
  const turnIndices = []
  for (let p = tg.startIndex; p <= tg.endIndex; p++) {
    const t = turns[p]
    if (t) turnIndices.push(t.index)
  }
  /** @type {TaskGroupVM} */
  const vm = { id: `task-${i + 1}`, index: i + 1, prompt: tg.prompt, turnIndices, outcome: tg.hasErrors ? 'error' : 'ok' }
  if (tg.durationMs) vm.durationMs = tg.durationMs
  if (tg.toolCallCount) vm.tools = tg.toolCallCount
  // cooked churn/files summary for the task boundary chip, e.g. "2 files · +316 −25"
  // (render-when-present: omitted for a read-only task with no files touched).
  const fileCount = tg.filesTouched.length
  const stat = []
  if (fileCount > 0) stat.push(`${fileCount} ${fileCount === 1 ? 'file' : 'files'}`)
  if (tg.insertions > 0 || tg.deletions > 0) stat.push(`+${tg.insertions} −${tg.deletions}`)
  if (stat.length) vm.stat = stat.join(' · ')
  return vm
}

/**
 * The cooked task groups for a turn list (`computeTasks` mapped onto
 * `TaskGroupVM`). Exported so the adapter can populate the always-present
 * `vm.tasks` from the same single computation `computeAnalytics` uses.
 * @param {TurnDetail[]} turns
 * @returns {TaskGroupVM[]}
 */
export function computeTaskGroups(turns) {
  return computeTasks(turns).map((tg, i) => taskToVM(tg, i, turns))
}

/**
 * Compute the cooked single-session analytics block from a (prefiltered) turn
 * list. Each field is omitted when empty so the block is genuinely
 * render-when-present. The adapter calls this on demand when no precomputed
 * analytics is supplied, and reuses the returned `patternAnnotations` /
 * `taskGroups` so nothing is derived twice.
 * @param {TurnDetail[]} turns
 * @param {{ scorecard?: SessionScorecard | null, medians?: PersonalMedians }} [opts]
 * @returns {TranscriptAnalyticsVM}
 */
export function computeAnalytics(turns, opts = {}) {
  const phases = detectPhases(turns)
  const patternAnnotations = annotateTranscript(turns).map((a) => patternToVM(a, turns))
  const taskGroups = computeTaskGroups(turns)
  const scorecardBands = assessScorecard(opts.scorecard, opts.medians)

  /** @type {TranscriptAnalyticsVM} */
  const analytics = {}
  if (phases.length) analytics.phases = phases
  if (scorecardBands.length) analytics.scorecardBands = scorecardBands
  if (patternAnnotations.length) analytics.patternAnnotations = patternAnnotations
  if (taskGroups.length) analytics.taskGroups = taskGroups
  return analytics
}

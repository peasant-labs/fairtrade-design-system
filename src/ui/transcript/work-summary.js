// @ts-check
/* work-summary — the counts a ledger turn's work panel reads over one turn's tool calls.
   Pure: it takes the cooked `ToolCallVM` list and derives a small summary plus the two labels
   the panel prints. No JSX, no wire parsing, no component state, so the same numbers can be
   asserted directly and the panel never recomputes them per row.

   The rule the labels follow:
     • a command is a `bash` tool, an edit is an `edits` tool;
     • a file is one distinct non-empty `filePath` on a tool that reads one; an edit already
       counts as an edit, so it never adds a second "file" for the same change. The adapter
       also fills `filePath` from a
       search tool's `path` scope, which is a directory or a glob rather than a file the turn
       touched, so `search`, `fetch`, `tasks`, `bash` and `other` contribute no file;
     • a failure is a tool flagged `isError`, or a `bash` call whose recorded exit code is
       non-zero (the two ways a failed run reaches the cooked model);
     • the duration is the sum of the recorded, finite tool durations;
     • zero parts are left out of a label, so a turn never reads "0 edits"; when commands, files
       and edits are all zero the count falls back to the turn's call count, and the meta then
       leaves the call count out, so one number is never printed in both slots.
   ─────────────────────────────────────────────────────────────────────────────── */

import { formatDurationMs } from './time.js'

/** @typedef {import('./view-model.js').ToolCallVM} ToolCallVM */

/**
 * The counts one turn's work panel shows.
 * @typedef {object} WorkSummary
 * @property {number} calls     every tool the turn ran
 * @property {number} commands  `bash` group calls
 * @property {number} files     distinct non-empty file paths the turn touched
 * @property {number} edits     `edits` group calls
 * @property {number} failed    errored tools plus non-zero exit codes
 * @property {number} durationMs  sum of the finite recorded durations
 */

/**
 * ``n`` + the singular or plural word: "1 command", "4 commands".
 * @param {number} n
 * @param {string} one
 * @param {string} many
 * @returns {string}
 */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * The tool groups whose `filePath` names a file the turn touched. A search/fetch `filePath` is a
 * scope (a directory or glob), and a bash/task call has no file, so neither counts.
 * @type {ReadonlyArray<import('./view-model.js').ToolGroup>}
 */
const FILE_GROUPS = ['read']

/**
 * The counted parts of the leading label: commands, files and edits, in that order, with zero
 * parts left out. An empty list means the count label falls back to the call count, and the meta
 * must leave the calls out so the panel never prints the same number twice.
 * @param {Partial<WorkSummary>} [summary]
 * @returns {string[]}
 */
function countedParts(summary = {}) {
  /** @type {string[]} */
  const parts = []
  if ((summary.commands ?? 0) > 0) parts.push(plural(summary.commands ?? 0, 'command', 'commands'))
  if ((summary.files ?? 0) > 0) parts.push(plural(summary.files ?? 0, 'file', 'files'))
  if ((summary.edits ?? 0) > 0) parts.push(plural(summary.edits ?? 0, 'edit', 'edits'))
  return parts
}

/**
 * True when a turn has words of its own, so it draws a card (a turn that is only work is inline detail).
 * @param {{ displayContent?: unknown, content?: unknown } | null | undefined} turn
 * @returns {boolean}
 */
export function turnHasProse(turn) {
  return String(turn?.displayContent ?? turn?.content ?? '').trim().length > 0
}

/**
 * Summarize one turn's tool calls.
 * @param {ToolCallVM[]} [tools]
 * @returns {WorkSummary}
 */
export function workSummary(tools = []) {
  /** @type {WorkSummary} */
  const summary = { calls: 0, commands: 0, files: 0, edits: 0, failed: 0, durationMs: 0 }
  /** @type {Set<string>} */
  const paths = new Set()
  for (const tool of tools) {
    if (!tool) continue
    summary.calls += 1
    if (tool.group === 'bash') summary.commands += 1
    if (tool.group === 'edits') summary.edits += 1
    if (FILE_GROUPS.includes(tool.group) && typeof tool.filePath === 'string' && tool.filePath !== '') paths.add(tool.filePath)
    if (tool.isError || (tool.group === 'bash' && tool.exitCode != null && tool.exitCode !== 0)) summary.failed += 1
    if (typeof tool.durationMs === 'number' && Number.isFinite(tool.durationMs)) summary.durationMs += tool.durationMs
  }
  summary.files = paths.size
  return summary
}

/**
 * The panel's leading count: "4 commands, 3 files, 1 edit"; zero parts are omitted and a turn
 * with no commands, files or edits falls back to "N calls".
 * @param {Partial<WorkSummary>} [summary]
 * @returns {string}
 */
export function workCountLabel(summary = {}) {
  const parts = countedParts(summary)
  if (parts.length > 0) return parts.join(', ')
  return plural(summary.calls ?? 0, 'call', 'calls')
}

/**
 * The ledger action block's header: "6 actions: 4 commands, 3 files, 1 edit, 29s". It counts the
 * block's tool runs as actions, then the counted parts and the recorded duration; zero parts and
 * an unrecorded duration are left out, so a block of searches reads "2 actions, 1.2s".
 * @param {Partial<WorkSummary>} [summary]
 * @returns {string}
 */
export function workActionsLabel(summary = {}) {
  const parts = countedParts(summary)
  const duration = formatDurationMs(summary.durationMs)
  let label = plural(summary.calls ?? 0, 'action', 'actions')
  if (parts.length > 0) label += ': ' + parts.join(', ')
  if (duration) label += ', ' + duration
  return label
}

/**
 * The panel's trailing meta: "8 calls, 1 failed, 29s". The failure count is omitted when zero and
 * the duration is omitted when nothing was recorded. The leading call count is omitted when the
 * count label already fell back to it (no commands, files or edits).
 * @param {Partial<WorkSummary>} [summary]
 * @returns {string}
 */
export function workMetaLabel(summary = {}) {
  /** @type {string[]} */
  const parts = []
  if (countedParts(summary).length > 0) parts.push(plural(summary.calls ?? 0, 'call', 'calls'))
  if ((summary.failed ?? 0) > 0) parts.push(plural(summary.failed ?? 0, 'failed', 'failed'))
  const duration = formatDurationMs(summary.durationMs)
  if (duration) parts.push(duration)
  return parts.join(', ')
}

// @ts-check
/* work-summary — the counts a ledger turn's work panel reads over one turn's tool calls.
   Pure: it takes the cooked `ToolCallVM` list and derives a small summary plus the two labels
   the panel prints. No JSX, no wire parsing, no component state, so the same numbers can be
   asserted directly and the panel never recomputes them per row.

   The rule the labels follow:
     • a command is a `bash` tool, an edit is an `edits` tool;
     • a file is one distinct non-empty `filePath` on a tool that actually touches a file
       (`read` and `edits`; a write cooks to `edits`). The adapter also fills `filePath` from a
       search tool's `path` scope, which is a directory or a glob rather than a file the turn
       touched, so `search`, `fetch`, `tasks`, `bash` and `other` contribute no file;
     • a failure is a tool flagged `isError`, or a `bash` call whose recorded exit code is
       non-zero (the two ways a failed run reaches the cooked model);
     • the duration is the sum of the recorded, finite tool durations;
     • zero parts are left out of a label, so a turn never reads "0 edits"; when commands, files
       and edits are all zero the count falls back to the turn's call count. ───────────────── */

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
const FILE_GROUPS = ['read', 'edits']

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
  /** @type {string[]} */
  const parts = []
  if ((summary.commands ?? 0) > 0) parts.push(plural(summary.commands ?? 0, 'command', 'commands'))
  if ((summary.files ?? 0) > 0) parts.push(plural(summary.files ?? 0, 'file', 'files'))
  if ((summary.edits ?? 0) > 0) parts.push(plural(summary.edits ?? 0, 'edit', 'edits'))
  if (parts.length > 0) return parts.join(', ')
  return plural(summary.calls ?? 0, 'call', 'calls')
}

/**
 * The panel's trailing meta: "8 calls, 1 failed, 29s"; the failure count is omitted when zero
 * and the duration is omitted when nothing was recorded.
 * @param {Partial<WorkSummary>} [summary]
 * @returns {string}
 */
export function workMetaLabel(summary = {}) {
  /** @type {string[]} */
  const parts = [plural(summary.calls ?? 0, 'call', 'calls')]
  if ((summary.failed ?? 0) > 0) parts.push(plural(summary.failed ?? 0, 'failed', 'failed'))
  const duration = formatDurationMs(summary.durationMs)
  if (duration) parts.push(duration)
  return parts.join(', ')
}

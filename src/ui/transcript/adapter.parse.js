// @ts-check
/* ───────────────────────────────────────────────────────────────────────────
   adapter.parse — the ONE wire-parse boundary for tool arguments / result
   ─────────────────────────────────────────────────────────────────────────
   `ToolCallDetail.arguments` and `.result` are JSON-ENCODED STRINGS on the wire
   (schema/develop/local_api.go:69-79). The de-facto adapter in transcript-browser
   parsed them in TEN scattered places (1 shared `parseArgs` + 9 inline
   `JSON.parse` call-sites across the tool renderers, the diffs/files views, the
   task summary, the file rollup, and SessionDetail) and re-defined `extractPath`
   / `countDiff` THREE times each. This module consolidates every one of those
   into a SINGLE leaf with the SOLE `JSON.parse` of tool args/result in the lifted
   code (`parseJson` below).

   It is a LEAF: it imports nothing from `adapter.js` or `analytics.js`, so both
   of those can depend on it with no import cycle. The cooked render path
   (`adaptTranscript`) and the shared analytics util both call these primitives;
   no presentational component ever parses wire.
   ─────────────────────────────────────────────────────────────────────────── */

/** @typedef {import('./wire-types.js').ToolCallDetail} ToolCallDetail */

/**
 * The SOLE `JSON.parse` of a wire-encoded tool string in the lifted code. Every
 * other parse helper here, the adapter, and the analytics util route through it,
 * so a grep for `JSON.parse` of tool args/result yields exactly one hit. Returns
 * `undefined` for empty or malformed input — callers degrade rather than throw.
 *
 * @param {string | undefined | null} raw
 * @returns {unknown}
 */
export function parseJson(raw) {
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * Parse a tool call's `arguments` JSON string. Thin named entry point over the
 * one `parseJson` site; the cooked `ToolCallVM.args` is this value (shape varies
 * by tool, hence `unknown`).
 * @param {string | undefined | null} raw
 * @returns {unknown}
 */
export function parseArgs(raw) {
  return parseJson(raw)
}

/**
 * Parse a tool call's `result` JSON string. Thin named entry point over the one
 * `parseJson` site; the cooked `ToolCallVM.output` is this value.
 * @param {string | undefined | null} raw
 * @returns {unknown}
 */
export function parseResult(raw) {
  return parseJson(raw)
}

/**
 * Narrow an arbitrary parsed value to a plain string-keyed record, or undefined.
 * @param {unknown} v
 * @returns {Record<string, unknown> | undefined}
 */
function asRecord(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? /** @type {Record<string, unknown>} */ (v)
    : undefined
}

/** @param {unknown} v @returns {string | undefined} */
function asString(v) {
  return typeof v === 'string' ? v : undefined
}

/**
 * Extract the file path a tool call targets, preferring the wire `filePath`
 * field and falling back to the common `file_path` / `path` / `notebook_path`
 * argument keys. Consolidates the THREE duplicate `extractPath` definitions
 * (tasks.ts, FilesView.tsx, file-rollup.ts) into one.
 * @param {ToolCallDetail} call
 * @returns {string | undefined}
 */
export function extractPath(call) {
  if (call.filePath) return call.filePath
  const a = asRecord(parseArgs(call.arguments))
  if (!a) return undefined
  return asString(a.file_path) ?? asString(a.path) ?? asString(a.notebook_path)
}

/**
 * One old→new replacement inside an Edit / MultiEdit / NotebookEdit call.
 * @typedef {object} EditPair
 * @property {string} old_string
 * @property {string} new_string
 */

/**
 * The list of old→new replacements for an edit-family tool call: the `edits[]`
 * array for MultiEdit, else the single `old_string` / `new_string` pair. Used by
 * BOTH the diff-hunk builder (adapter) and the churn counter (`countDiff`), so
 * the argument shape is parsed in exactly one place.
 * @param {ToolCallDetail} call
 * @returns {EditPair[]}
 */
export function editPairs(call) {
  const a = asRecord(parseArgs(call.arguments))
  if (!a) return []
  if (Array.isArray(a.edits)) {
    /** @type {EditPair[]} */
    const pairs = []
    for (const raw of a.edits) {
      const e = asRecord(raw)
      if (!e) continue
      pairs.push({ old_string: asString(e.old_string) ?? '', new_string: asString(e.new_string) ?? '' })
    }
    if (pairs.length) return pairs
  }
  const single = asString(a.old_string)
  const replacement = asString(a.new_string)
  if (single !== undefined || replacement !== undefined) {
    return [{ old_string: single ?? '', new_string: replacement ?? '' }]
  }
  return []
}

/**
 * The full-file body a Write tool call lays down (its `content` argument).
 * @param {ToolCallDetail} call
 * @returns {string}
 */
export function writeContent(call) {
  const a = asRecord(parseArgs(call.arguments))
  return (a && asString(a.content)) ?? ''
}

/**
 * Lines inserted / removed for an edit-family or write tool call. Consolidates
 * the THREE duplicate `countDiff` definitions. Pure: depends only on the parsed
 * arguments, never a clock or the file system.
 * @param {ToolCallDetail} call
 * @returns {{ adds: number, dels: number }}
 */
export function countDiff(call) {
  const name = call.name.toLowerCase()
  if (name === 'write') {
    const content = writeContent(call)
    return { adds: content ? content.split('\n').length : 0, dels: 0 }
  }
  if (name === 'edit' || name === 'multiedit' || name === 'notebookedit') {
    let adds = 0
    let dels = 0
    for (const pair of editPairs(call)) {
      const a = (pair.new_string || '').split('\n').length
      const b = (pair.old_string || '').split('\n').length
      if (a > b) adds += a - b
      if (b > a) dels += b - a
    }
    return { adds, dels }
  }
  return { adds: 0, dels: 0 }
}

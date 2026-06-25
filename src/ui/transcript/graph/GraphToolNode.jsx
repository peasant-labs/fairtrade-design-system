/* GraphToolNode — the tool-cluster pill VISUAL that sits beside a turn card in
   the trajectory graph (presentation-only). The engine half (TB's @xyflow custom
   node) owns the <Handle> and edge wiring; this renders the monochrome cluster.

   It NEVER parses tool wire JSON — the no-JSON.parse-downstream invariant of the
   cooked view model holds here. Each tool item is already cooked: a one-line
   `preview` string is supplied by the caller (the adapter / engine seam), so the
   pill never touches `ToolCallDetail.arguments`. Failed rows are derived from the
   cooked `isError` / `exitCode` only. Up to four rows show, then "+ N more".

   Projection from the cooked ToolCallVM:
     tools[].id/name/kind/filePath/isError/exitCode ⇐ ToolCallVM fields
     tools[].preview ⇐ ToolCallVM.preview (the cooked one-liner; NO parse here)
     totalDurationMs ⇐ Σ ToolCallVM.durationMs
     hasError        ⇐ any cooked isError / nonzero exitCode */

/**
 * One cooked tool entry for the cluster. A strict presentational subset of
 * ToolCallVM — note the absence of any raw wire `arguments`/`result` string, by
 * design, so the visual cannot parse wire JSON.
 *
 * @typedef {object} GraphToolItem
 * @property {string} id
 * @property {string} name                     display name (e.g. "Read", "Bash")
 * @property {string} [kind]                    tool kind (decorative grouping hint)
 * @property {string} [filePath]               cooked path; basename is the preview fallback
 * @property {string} [preview]                cooked one-line arg summary (NEVER parsed here)
 * @property {boolean} [isError]
 * @property {number} [exitCode]
 */

/**
 * @typedef {object} GraphToolNodeProps
 * @property {GraphToolItem[]} tools           the cooked tool calls for this turn
 * @property {number} [totalDurationMs]        summed duration → header badge
 * @property {boolean} [hasError]              cluster carries a failed call
 * @property {boolean} [isFilteredOut]         engine: dimmed by an active filter
 * @property {number} [max]                    rows before collapsing to "+ N more" (default 4)
 * @property {string} [className]
 */

/** Compact duration label (ms → "820ms" / "1.2s"); empty when there is none. */
function fmtDuration(ms) {
  if (ms == null || ms <= 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`
}

/** basename of a slash path, without parsing anything. */
function baseName(path) {
  if (!path) return ''
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function rowFailed(t) {
  return !!t.isError || (t.exitCode != null && t.exitCode !== 0)
}

/**
 * The trajectory-graph tool-cluster pill visual.
 * @param {GraphToolNodeProps} props
 * @returns {JSX.Element}
 */
export function GraphToolNode({
  tools,
  totalDurationMs,
  hasError = false,
  isFilteredOut = false,
  max = 4,
  className = '',
}) {
  const visible = tools.slice(0, max)
  const remaining = tools.length - visible.length
  const duration = fmtDuration(totalDurationMs)
  const count = tools.length

  const cls = [
    'ft-gnode',
    'ft-gnode-tools',
    hasError && 'ft-gnode-error',
    isFilteredOut && 'ft-gnode-dimmed',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls}>
      <header className="ft-gnode-tools-head">
        <span className="ft-gnode-tools-count">
          {count === 1 ? 'tool call' : `${count} tool calls`}
        </span>
        {duration && <span className="ft-gnode-tools-dur">{duration}</span>}
      </header>

      <ul className="ft-gnode-tools-list">
        {visible.map((t) => {
          const failed = rowFailed(t)
          const arg = t.preview || baseName(t.filePath)
          return (
            <li
              key={t.id}
              className={`ft-gnode-tools-row${failed ? ' ft-gnode-tools-row-failed' : ''}`}
            >
              <span className="ft-gnode-tools-name">{t.name}</span>
              {arg && <span className="ft-gnode-tools-arg">{arg}</span>}
              {failed && <span className="ft-gnode-tools-err">error</span>}
            </li>
          )
        })}
        {remaining > 0 && <li className="ft-gnode-tools-more">+ {remaining} more</li>}
      </ul>
    </div>
  )
}

export default GraphToolNode

import ToolCall from './ToolCall.jsx'
import { workCountLabel, workMetaLabel, workSummary } from './work-summary.js'

/* TranscriptWorkGroup — one turn's tool activity as a single panel. In the ledger presentation
   a turn shows its prose first and then this panel: the computed summary over its tool calls
   ("4 commands, 3 files, 1 edit" / "8 calls, 1 failed, 29s") above the same collapsible tool
   rows the classic card draws flat. DUMB: it renders the cooked `ToolCallVM` list and the
   turn's own open-tool map; it never parses wire and owns no state. A turn without tools
   renders nothing.

   The panel is a plain group, not a landmark: one region named "tool activity" per turn would
   fill a screen reader's landmark list with duplicates, and the panel's own head text already
   names it in content. */

/** @typedef {import('./view-model.js').ToolCallVM} ToolCallVM */

/**
 * @param {object} props
 * @param {ToolCallVM[]} [props.tools]      the turn's cooked tool calls
 * @param {Record<string, boolean>} [props.openTools]  tool id -> open?
 * @param {(id: string) => void} [props.onToggle]
 * @param {boolean} [props.expandAll]
 */
export default function TranscriptWorkGroup({ tools = [], openTools = {}, onToggle = () => {}, expandAll = false }) {
  if (!tools.length) return null
  const summary = workSummary(tools)
  const count = workCountLabel(summary)
  /* the helper drops the leading call count when the count label already fell back to it, so
     the same number is never printed twice; the meta span renders only when it has text. */
  const meta = workMetaLabel(summary)
  return (
    <div className="txn-work">
      <div className="txn-work-head">
        <span className="txn-work-count">{count}</span>
        {meta && <span className="txn-work-meta tnum">{meta}</span>}
      </div>
      <div className="txn-work-rows">
        {tools.map((tool) => (
          <ToolCall
            key={tool.id}
            tool={tool}
            open={expandAll || !!openTools[tool.id]}
            onToggle={() => onToggle(tool.id)}
          />
        ))}
      </div>
    </div>
  )
}

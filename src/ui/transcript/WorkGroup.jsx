import { useId, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ToolCall from './ToolCall.jsx'
import Thinking from './Thinking.jsx'
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
export default function TranscriptWorkGroup({ tools = [], thinking, openTools = {}, onToggle = () => {}, expandAll = false }) {
  /* One line per turn: the computed summary is the panel, and the tool rows open on request.
     A host filter ("expand all tool calls"), a host-opened tool, or a search reveal opens it. */
  const [open, setOpen] = useState(false)
  const rowsId = `txn-work-${useId()}`
  if (!tools.length) return null
  const summary = workSummary(tools)
  const count = workCountLabel(summary)
  /* the helper drops the leading call count when the count label already fell back to it, so
     the same number is never printed twice; the meta span renders only when it has text. */
  const meta = workMetaLabel(summary)
  const shown = expandAll || open || tools.some((tool) => !!openTools[tool.id])
  return (
    <div className="txn-work">
      <div className="txn-work-head">
        <button
          type="button"
          className="txn-work-toggle"
          aria-expanded={shown}
          aria-controls={rowsId}
          onClick={() => setOpen((value) => !value)}
        >
          {shown ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          <span className="txn-work-count">{count}</span>
          {meta && <span className="txn-work-meta tnum">{meta}</span>}
        </button>
      </div>
      {shown && (
        <div className="txn-work-rows" id={rowsId}>
          {tools.map((tool) => (
            <ToolCall
              key={tool.id}
              tool={tool}
              open={expandAll || !!openTools[tool.id]}
              onToggle={() => onToggle(tool.id)}
            />
          ))}
          {/* the turn's thinking closes the same branch list, one line like a tool call */}
          {thinking && <Thinking block={thinking} />}
        </div>
      )}
    </div>
  )
}

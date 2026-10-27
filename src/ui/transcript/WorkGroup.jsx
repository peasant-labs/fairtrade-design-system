import { useEffect, useId, useRef, useState } from 'react'
import ToolCall from './ToolCall.jsx'
import Thinking from './Thinking.jsx'
import { workActionsLabel, workCountLabel, workMetaLabel, workSummary } from './work-summary.js'

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
export default function TranscriptWorkGroup({ tools = [], thinking, openTools = {}, onToggle = () => {}, expandAll = false, bare = false }) {
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
  /* A bare panel is the ledger's: the turn's work is inline detail lines, not a summary footer
     that has to be opened. Classic keeps the summary because its rows sit flat on the card. */
  const anyToolOpen = tools.some((tool) => !!openTools[tool.id])
  const shown = expandAll || open || anyToolOpen
  /* a search reveal or a host-opened tool opens the panel; the head closes both again */
  useEffect(() => {
    if (anyToolOpen) setOpen(true)
  }, [anyToolOpen])
  const togglePanel = () => {
    if (shown) {
      setOpen(false)
      for (const tool of tools) if (openTools[tool.id]) onToggle(tool.id)
    } else {
      setOpen(true)
    }
  }
  return (
    <div className={'txn-work' + (bare ? ' txn-work-bare' : '')}>
      {!bare && (
        <div className="txn-work-head">
          <button
            type="button"
            className="txn-work-toggle"
            aria-expanded={shown}
            aria-controls={rowsId}
            onClick={togglePanel}
          >
            <span className="txn-work-count">{count}</span>
            {meta && <span className="txn-work-meta tnum">{meta}</span>}
          </button>
        </div>
      )}
      {shown && (
        <div className="txn-work-rows" id={rowsId}>
          {tools.map((tool) => (
            <ToolCall
              key={tool.id}
              tool={tool}
              showChevron={false}
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

/* ModelActions — every action the model took for one user turn, grouped into one quiet block.
   The ledger never prints a summary row per call; the turns of one user turn share this block,
    whose header states their work and toggles the rows. Rows start visible with their contents
    closed; compact mode collapses the list. A block with no tools is only thinking,
   so it draws its thinking lines without a header to open. */
export function ModelActions({ turns = [], openTools = {}, onToggle = () => {}, expandAll = false, compact = false }) {
  const [open, setOpen] = useState(!compact)
  const previousCompact = useRef(compact)
  const tools = turns.flatMap((turn) => turn.toolCalls ?? [])
  const toolsOpen = tools.some((tool) => !!openTools[tool.id])
  const shown = open || (!compact && (expandAll || toolsOpen))
  // A search reveal or host-opened tool remains reachable even in compact mode.
  useEffect(() => {
    if (toolsOpen) setOpen(true)
  }, [toolsOpen])
  useEffect(() => {
    if (previousCompact.current === compact) return
    previousCompact.current = compact
    setOpen(!compact)
    if (compact) for (const tool of tools) if (openTools[tool.id]) onToggle(tool.id)
  }, [compact, tools, openTools, onToggle])
  const label = workActionsLabel(workSummary(tools))
  if (!tools.length) {
    return (
      <div className="txn-modelactions txn-modelactions-bare">
        {turns.map((turn) => turn.thinking && <Thinking key={turn.identity ?? turn.index} block={turn.thinking} />)}
      </div>
    )
  }
  const closeAll = () => {
    if (shown) {
      setOpen(false)
      for (const tool of tools) if (openTools[tool.id]) onToggle(tool.id)
    } else {
      setOpen(true)
    }
  }
  return (
    <div className={'txn-modelactions' + (shown ? ' is-open' : '')}>
      <button type="button" className="txn-modelactions-head" aria-expanded={shown} onClick={closeAll}>
        <span className="txn-modelactions-summary tnum">{label}</span>
      </button>
      {shown && (
        <div className="txn-modelactions-rows">
          {turns.map((turn) => (
            <div key={turn.identity ?? turn.index} className="txn-modelactions-turn">
              {(turn.toolCalls ?? []).map((tool) => (
                <ToolCall
                  key={tool.id}
                  tool={tool}
                  showChevron={false}
                  open={expandAll || !!openTools[tool.id]}
                  onToggle={() => onToggle(tool.id)}
                />
              ))}
              {turn.thinking && <Thinking block={turn.thinking} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

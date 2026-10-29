import { useLayoutEffect, useId, useRef, useState } from 'react'
import ToolCall from './ToolCall.jsx'
import Thinking from './Thinking.jsx'
import Collapsible from './Collapsible.jsx'
import { workActionsLabel, workCountLabel, workMetaLabel, workSummary } from './work-summary.js'
import { toolStateKey } from './tool-state-key.js'
import { IntegrityMark } from './IntegrityBadge.jsx'
import { INTEGRITY_COPY } from './integrity.js'

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
  const previous = useRef({ openTools: {}, expandAll: false })
  useLayoutEffect(() => {
    if ((!previous.current.expandAll && expandAll) || tools.some(tool => openTools[tool.id] && !previous.current.openTools[tool.id])) setOpen(true)
    previous.current = { openTools, expandAll }
  }, [tools, openTools, expandAll])
  if (!tools.length) return null
  const summary = workSummary(tools)
  const count = workCountLabel(summary)
  /* the helper drops the leading call count when the count label already fell back to it, so
     the same number is never printed twice; the meta span renders only when it has text. */
  const meta = workMetaLabel(summary)
  /* A bare panel is the ledger's: the turn's work is inline detail lines, not a summary footer
     that has to be opened. Classic keeps the summary because its rows sit flat on the card. */
  const shown = open
  const togglePanel = () => setOpen(value => !value)
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
      <Collapsible open={shown} keepMounted>
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
      </Collapsible>
    </div>
  )
}

/* ModelActions — every action the model took for one user turn, grouped into one quiet block.
   The ledger never prints a summary row per call; the turns of one user turn share this block,
    whose header states their work and toggles the rows. Rows start visible with their contents
    closed; compact mode collapses the list. A block with no tools is only thinking,
   so it draws its thinking lines without a header to open. `flaggedPositions` holds the source
   positions the integrity check marked: each such turn's row is outlined and led by a mark, and
   the summary shows a mark while the group is folded. `cardTurn` is the turn whose own card
   carries the mark and the outline: its row is not marked a second time. */
export function ModelActions({ turns = [], openTools = {}, onToggle = () => {}, expandAll = false, compact = false, flaggedPositions, cardTurn, reveal, registerActionRef = () => {} }) {
  const [open, setOpen] = useState(!compact)
  const previous = useRef({ compact, expandAll: false, openTools: {}, reveal: null })
  const tools = turns.flatMap((turn) => turn.toolCalls ?? [])
  const shown = open
  // Parent visibility is a choice, not a consequence of a stale open child. Only
  // a new host-open/reveal event reopens it; hiding never writes host-owned tools.
  useLayoutEffect(() => {
    const before = previous.current
    if (before.compact !== compact) setOpen(!compact)
    else if ((reveal && reveal !== before.reveal) || (!before.expandAll && expandAll) || tools.some(tool => openTools[tool.id] && !before.openTools[tool.id])) setOpen(true)
    previous.current = { compact, expandAll, openTools, reveal }
  }, [compact, expandAll, openTools, reveal, tools])
  const label = workActionsLabel(workSummary(tools))
  /* a turn whose own card carries the mark and the outline is not marked a second time in its row */
  const isCard = (turn) => !!cardTurn && (cardTurn.identity ?? cardTurn.index) === (turn.identity ?? turn.index)
  const isFlagged = (turn) => flaggedPositions?.has(turn.sourcePosition) === true && !isCard(turn)
  const anyFlagged = turns.some(isFlagged)
  const rowClass = (turn) => 'txn-modelactions-turn' + (isFlagged(turn) ? ' is-flagged' : '')
  if (!tools.length) {
    return (
      <div className="txn-modelactions txn-modelactions-bare">
        {turns.map((turn) => turn.thinking && (
          <div key={turn.identity ?? turn.index} className={rowClass(turn)}>
            {isFlagged(turn) && <IntegrityMark decorative={false} />}
            <Thinking block={turn.thinking} actionRef={el => registerActionRef(turn.index, 'thinking', el)} revealRequest={reveal?.turn === turn.index ? reveal.sequence : 0} />
          </div>
        ))}
      </div>
    )
  }
  const closeAll = () => setOpen(value => !value)
  return (
    <div className={'txn-modelactions' + (shown ? ' is-open' : '')}>
      <button type="button" className="txn-modelactions-head" aria-expanded={shown} onClick={closeAll}>
        <span className="txn-modelactions-summary tnum">{label}</span>
        {anyFlagged ? <IntegrityMark text={INTEGRITY_COPY.groupMark} decorative={false} /> : null}
      </button>
      <Collapsible open={shown} keepMounted>
        <div className="txn-modelactions-rows">
          {turns.map((turn) => (
            <div key={turn.identity ?? turn.index} className={rowClass(turn)}>
              {isFlagged(turn) ? <IntegrityMark decorative={false} /> : null}
              {(turn.toolCalls ?? []).map((tool) => (
                <ToolCall
                  key={toolStateKey(turn.index, tool)}
                  tool={tool}
                  actionRef={el => { registerActionRef(turn.index, tool.id, el); if (tool.sourceIndex != null) registerActionRef(turn.index, `source:${tool.sourceIndex}`, el) }}
                  showChevron={false}
                  open={expandAll || !!openTools[toolStateKey(turn.index, tool)]}
                  onToggle={() => onToggle(toolStateKey(turn.index, tool))}
                />
              ))}
              {turn.thinking && <Thinking block={turn.thinking} actionRef={el => registerActionRef(turn.index, 'thinking', el)} revealRequest={reveal?.turn === turn.index && reveal.where === 'thinking' ? reveal.sequence : 0} />}
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  )
}

/* Turn card as an @xyflow node. A thin ENGINE wrapper: it owns the connection
   <Handle>s and the node's DOM identity (`data-turn-index`), and maps its cooked
   `TurnNodeData` onto the presentation-only `GraphTurnNode`, which renders the
   body and every aesthetic (role accent, flags, footer). No node markup or
   styling lives here, so the graph and the mockup render the same visual. */

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { GraphTurnNode } from '../../GraphTurnNode.jsx'
import { NODE_DIMENSIONS } from '../constants.js'

/** @typedef {import('../types.js').TurnNodeData} TurnNodeData */

/**
 * Truncate content to a single line for the card preview.
 * @param {string} content
 * @param {number} max
 * @returns {string}
 */
function contentPreview(content, max) {
  if (!content) return ''
  const oneLine = content.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

/**
 * @param {{ data: TurnNodeData, selected?: boolean }} props
 * @returns {JSX.Element}
 */
function TurnCardNodeImpl({ data, selected }) {
  const { turn, annotations, isSearchMatch, isFilteredOut, isSelected, turnNumber, provider } = data

  const depth = turn.depth ?? 0
  const isSubagent = turn.role === 'assistant' && depth > 0
  const hasError = annotations.some((a) => a.type === 'error')
  const hasRetry = annotations.some((a) => a.type === 'retry')
  const hasRevert = annotations.some((a) => a.type === 'revert')

  return (
    // Width MUST match NODE_DIMENSIONS.turnWidth so the right source-handle aligns
    // with the edge endpoint the mapper computed; the card fills this shell.
    <div
      data-turn-index={turn.index}
      data-harness={isSubagent ? undefined : turn.role === 'assistant' ? provider : undefined}
      style={{ width: NODE_DIMENSIONS.turnWidth }}
    >
      <Handle type="target" position={Position.Top} className="tb-gnode-handle tb-gnode-handle-top" />

      <GraphTurnNode
        role={turn.role}
        agentName={isSubagent ? turn.agentName : undefined}
        turnNumber={turnNumber}
        contentPreview={contentPreview(turn.content, 160)}
        toolCount={turn.toolCalls?.length ?? 0}
        totalTokens={(turn.tokensIn ?? 0) + (turn.tokensOut ?? 0)}
        tokensIn={turn.tokensIn ?? undefined}
        tokensOut={turn.tokensOut ?? undefined}
        hasError={hasError}
        hasRetry={hasRetry}
        hasRevert={hasRevert}
        isSearchMatch={isSearchMatch}
        isFilteredOut={isFilteredOut}
        isSelected={selected || isSelected}
        provider={provider}
      />

      <Handle type="source" position={Position.Bottom} className="tb-gnode-handle tb-gnode-handle-bottom" />
      <Handle type="source" id="tool-source" position={Position.Right} className="tb-gnode-handle tb-gnode-handle-right" />
    </div>
  )
}

export const TurnCardNode = memo(TurnCardNodeImpl)

/* Compact tool-call cluster as an @xyflow node. A thin ENGINE wrapper: it owns
   the connection <Handle> and maps its cooked `ToolCallNodeData` onto the
   presentation-only `GraphToolNode`, which renders the cluster (rows, duration,
   "+ N more", failed styling).

   The one-line arg `preview` is the adapter's cooked `ToolCallVM.preview`,
   threaded in via `data.previewById`. This node NEVER parses
   `ToolCallDetail.arguments` itself: all wire parsing lives in the adapter. */

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { GraphToolNode } from '../../GraphToolNode.jsx'
import { NODE_DIMENSIONS } from '../constants.js'

/** @typedef {import('../types.js').ToolCallNodeData} ToolCallNodeData */

/**
 * @param {{ data: ToolCallNodeData }} props
 * @returns {JSX.Element}
 */
function ToolPillNodeImpl({ data }) {
  const { toolCalls, previewById, totalDurationMs, hasError, isFilteredOut } = data

  const tools = toolCalls.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.toolKind,
    filePath: c.filePath,
    isError: c.isError,
    exitCode: c.exitCode ?? undefined,
    preview: previewById[c.id] ?? '',
  }))

  return (
    // Width MUST match NODE_DIMENSIONS.toolCallWidth so the left target-handle
    // aligns with the turn's right source-handle.
    <div style={{ width: NODE_DIMENSIONS.toolCallWidth }}>
      <Handle type="target" id="tool-target" position={Position.Left} className="tb-gnode-handle tb-gnode-handle-left" />
      <GraphToolNode tools={tools} totalDurationMs={totalDurationMs} hasError={hasError} isFilteredOut={isFilteredOut} />
    </div>
  )
}

export const ToolPillNode = memo(ToolPillNodeImpl)

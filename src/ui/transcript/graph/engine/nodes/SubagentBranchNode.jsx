/* Branch header for a subagent swimlane, as an @xyflow node. The lane header has
   no handles, so this wrapper only maps its `SubagentLaneData` onto the
   presentation-only `GraphSubagentBranch`. The engine still places the lane. */

import { memo } from 'react'
import { GraphSubagentBranch } from '../../GraphSubagentBranch.jsx'

/** @typedef {import('../types.js').SubagentLaneData} SubagentLaneData */

/**
 * @param {{ data: SubagentLaneData }} props
 * @returns {JSX.Element}
 */
function SubagentBranchNodeImpl({ data }) {
  const { agentName, depth } = data
  return <GraphSubagentBranch agentName={agentName} depth={depth} />
}

export const SubagentBranchNode = memo(SubagentBranchNodeImpl)

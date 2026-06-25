/* GraphSubagentBranch — the swimlane header VISUAL that marks where a nested
   subagent's turns begin in the trajectory graph (presentation-only). The engine
   positions it above the first turn of a depth lane; this just renders the label.

   Projection: agentName ⇐ TurnVM.agentName, depth ⇐ TurnVM.depth (the lane's
   nesting level). Mauve eyebrow — the subagent accent — with the agent name as
   user content beside it and the depth as mono chrome. */

/**
 * @typedef {object} GraphSubagentBranchProps
 * @property {string} agentName                the nested agent's name (user content)
 * @property {number} depth                    nesting depth (1 = first level under the main lane)
 * @property {string} [className]
 */

/**
 * The subagent swimlane header visual.
 * @param {GraphSubagentBranchProps} props
 * @returns {JSX.Element}
 */
export function GraphSubagentBranch({ agentName, depth, className = '' }) {
  const cls = ['ft-gnode-lane', className].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      <span className="ft-gnode-lane-eyebrow">subagent</span>
      <span className="ft-gnode-lane-name">{agentName}</span>
      <span className="ft-gnode-lane-depth">d{depth}</span>
    </div>
  )
}

export default GraphSubagentBranch

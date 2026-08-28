// @ts-check
/* Bidirectional sync between the trajectory-graph viewport and external controls.

   Phase startTurn/endTurn are DISPLAY POSITIONS (indices into `turns`); graph
   nodes are keyed by `turn.index` (the entry index). The `turns` array bridges
   the two, so both spaces stay explicit and never get conflated. */

import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { NODE_DIMENSIONS } from './constants.js'

/** @typedef {import('./types.js').TurnDetail} TurnDetail */
/** @typedef {import('./types.js').Phase} Phase */
/** @typedef {import('./types.js').TurnNodeData} TurnNodeData */

/**
 * Focus helpers bound to the enclosing `<ReactFlowProvider>`.
 * @param {Phase[]} phases
 * @param {TurnDetail[]} turns
 * @param {(phaseIndex: number) => void} [onPhaseActivate]
 * @returns {{ focusPhase: (phaseIndex: number) => void, focusTurn: (turnIndex: number) => void }}
 */
export function useCanvasSync(phases, turns, onPhaseActivate) {
  const reactFlow = useReactFlow()

  const focusPhase = useCallback(
    /** @param {number} phaseIndex */
    (phaseIndex) => {
      const phase = phases[phaseIndex]
      if (!phase) return

      /** @type {Set<number>} */
      const entryIndices = new Set()
      for (let di = phase.startTurn; di <= phase.endTurn; di++) {
        if (turns[di]) entryIndices.add(turns[di].index)
      }

      const nodes = reactFlow.getNodes()
      const phaseNodes = nodes.filter((n) => {
        if (n.type !== 'turn') return false
        const data = /** @type {TurnNodeData} */ (/** @type {unknown} */ (n.data))
        return entryIndices.has(data.turn.index)
      })

      if (phaseNodes.length === 0) return

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const n of phaseNodes) {
        minX = Math.min(minX, n.position.x)
        minY = Math.min(minY, n.position.y)
        maxX = Math.max(maxX, n.position.x + NODE_DIMENSIONS.turnWidth)
        maxY = Math.max(maxY, n.position.y + NODE_DIMENSIONS.turnBaseHeight)
      }

      reactFlow.fitBounds(
        { x: minX - 20, y: minY - 20, width: maxX - minX + 40, height: maxY - minY + 40 },
        { padding: 0.1, duration: 400 },
      )

      onPhaseActivate?.(phaseIndex)
    },
    [phases, turns, reactFlow, onPhaseActivate],
  )

  const focusTurn = useCallback(
    /** @param {number} turnIndex a DISPLAY position */
    (turnIndex) => {
      const entryIdx = turns[turnIndex]?.index ?? turnIndex
      const nodes = reactFlow.getNodes()
      const node = nodes.find(
        (n) => n.type === 'turn' && /** @type {TurnNodeData} */ (/** @type {unknown} */ (n.data)).turn.index === entryIdx,
      )
      if (node) {
        reactFlow.setCenter(
          node.position.x + NODE_DIMENSIONS.turnWidth / 2,
          node.position.y + NODE_DIMENSIONS.turnBaseHeight / 2,
          { zoom: 1, duration: 300 },
        )
      }
    },
    [reactFlow, turns],
  )

  return { focusPhase, focusTurn }
}

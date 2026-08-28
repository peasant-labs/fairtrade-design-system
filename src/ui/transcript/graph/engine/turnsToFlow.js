/* Transform a turn list into a `{ nodes, edges }` graph for the trajectory graph.

   A PURE data transform: no DOM, no CSS, and no `@xyflow/react` import, so the
   topology can be verified without the optional peer dependency. The emitted
   node/edge shapes are structurally assignable to `@xyflow/react`'s Node / Edge. */

import { NODE_DIMENSIONS, EDGE_DEFAULTS } from './constants.js'

/** @typedef {import('./types.js').TurnDetail} TurnDetail */
/** @typedef {import('./types.js').Phase} Phase */
/** @typedef {import('./types.js').PhaseType} PhaseType */
/** @typedef {import('./types.js').TranscriptAnnotation} TranscriptAnnotation */
/** @typedef {import('./types.js').ToolCallVM} ToolCallVM */
/** @typedef {import('./types.js').TurnNodeData} TurnNodeData */
/** @typedef {import('./types.js').ToolCallNodeData} ToolCallNodeData */
/** @typedef {import('./types.js').FlowNode} FlowNode */
/** @typedef {import('./types.js').FlowEdge} FlowEdge */
/** @typedef {import('./types.js').FlowGraph} FlowGraph */

/* All phases resolve to the neutral edge role except error / retry-loop, which
   use the danger role. Both are token-backed custom properties on `.tb-graph`. */
/** @type {Record<PhaseType, string>} */
const PHASE_EDGE_COLOR = {
  planning: 'var(--edge)',
  exploration: 'var(--edge)',
  implementation: 'var(--edge)',
  testing: 'var(--edge)',
  error: 'var(--edge-error)',
  debug: 'var(--edge)',
  'retry-loop': 'var(--edge-error)',
  'user-correction': 'var(--edge)',
  recovery: 'var(--edge)',
  abandonment: 'var(--edge)',
}

/**
 * Group annotations by the display position they attach to.
 * @param {TranscriptAnnotation[]} annotations
 * @returns {Map<number, TranscriptAnnotation[]>}
 */
function buildAnnotationMap(annotations) {
  /** @type {Map<number, TranscriptAnnotation[]>} */
  const map = new Map()
  for (const ann of annotations) {
    const existing = map.get(ann.turnIndex) ?? []
    existing.push(ann)
    map.set(ann.turnIndex, existing)
  }
  return map
}

/**
 * Expand phase ranges into a display-position to phase-type lookup.
 * @param {Phase[]} phases
 * @returns {Map<number, PhaseType>}
 */
function buildPhaseLookup(phases) {
  /** @type {Map<number, PhaseType>} */
  const map = new Map()
  for (const phase of phases) {
    for (let i = phase.startTurn; i <= phase.endTurn; i++) map.set(i, phase.type)
  }
  return map
}

/**
 * @typedef {object} TurnsToFlowOptions
 * @property {TurnDetail[]} turns
 * @property {Map<number, ToolCallVM[]>} [toolVMsByTurn] cooked tool calls by turn index; supplies each tool node's preview
 * @property {Phase[]} phases
 * @property {TranscriptAnnotation[]} annotations
 * @property {number[]} searchMatches
 * @property {Set<number>} filteredIndices
 * @property {string} [searchQuery]
 * @property {Set<number>} [selectedTurns]
 */

/**
 * Build the trajectory graph's nodes and edges from a turn list.
 * @param {TurnsToFlowOptions} options
 * @returns {FlowGraph}
 */
export function turnsToFlow({
  turns,
  toolVMsByTurn,
  phases,
  annotations,
  searchMatches,
  filteredIndices,
  searchQuery,
  selectedTurns,
}) {
  const annotationMap = buildAnnotationMap(annotations)
  const phaseLookup = buildPhaseLookup(phases)
  const searchSet = new Set(searchMatches)

  /** @type {FlowNode[]} */
  const nodes = []
  /** @type {FlowEdge[]} */
  const edges = []

  let currentY = 0
  let cumulativeTokens = 0
  /** @type {string | null} */
  let prevNodeId = null
  /** @type {PhaseType | undefined} */
  let prevPhaseType
  let prevDepth = 0
  let prevFilteredOut = false

  for (let ti = 0; ti < turns.length; ti++) {
    const turn = turns[ti]
    // Skip empty system turns (no content, no tools) — they would render as blank cards.
    const hasContent = !!turn.content?.trim()
    const hasTools = (turn.toolCalls?.length ?? 0) > 0
    if (!hasContent && !hasTools) continue
    if (turn.role === 'system' && !hasTools && (!turn.content || turn.content.trim().length < 8)) continue

    const depth = turn.depth ?? 0
    // Phase lookup, search matches, and filtered indices all use display positions (ti).
    const phaseType = phaseLookup.get(ti)
    const turnAnnotations = annotationMap.get(ti) ?? []
    const isSearchMatch = searchSet.has(ti)
    const isFilteredOut = filteredIndices.size > 0 && !filteredIndices.has(ti)

    cumulativeTokens += (turn.tokensIn ?? 0) + (turn.tokensOut ?? 0)

    const x = depth * NODE_DIMENSIONS.subagentIndent
    const y = currentY

    const turnNodeId = `turn-${turn.index}`
    /** @type {TurnNodeData} */
    const turnNodeData = {
      turn,
      annotations: turnAnnotations,
      phaseType,
      isSearchMatch,
      isFilteredOut,
      isSelected: selectedTurns?.has(turn.index) ?? false,
      turnNumber: turn.index + 1,
      tokensCumulative: cumulativeTokens,
      searchQuery: isSearchMatch ? searchQuery : undefined,
    }

    nodes.push({
      id: turnNodeId,
      type: 'turn',
      position: { x, y },
      data: turnNodeData,
      style: { width: NODE_DIMENSIONS.turnWidth },
    })

    const toolCalls = turn.toolCalls ?? []
    if (toolCalls.length > 0) {
      const toolNodeId = `tools-${turn.index}`
      const totalDuration = toolCalls.reduce((sum, tc) => sum + (tc.durationMs ?? 0), 0)
      const hasError = toolCalls.some((tc) => tc.isError || (tc.exitCode !== undefined && tc.exitCode !== 0))

      // Cooked one-line previews for this turn's tools (no wire parse in the node).
      /** @type {Record<string, string>} */
      const previewById = {}
      for (const tc of toolVMsByTurn?.get(turn.index) ?? []) previewById[tc.id] = tc.preview

      /** @type {ToolCallNodeData} */
      const toolNodeData = {
        turnIndex: turn.index,
        toolCalls,
        previewById,
        totalDurationMs: totalDuration,
        hasError,
        isFilteredOut,
        phaseType,
      }

      const toolX = x + NODE_DIMENSIONS.turnWidth + NODE_DIMENSIONS.toolSideGap
      const toolY = y + (NODE_DIMENSIONS.turnBaseHeight - NODE_DIMENSIONS.toolCallHeight) / 2

      nodes.push({
        id: toolNodeId,
        type: 'toolCall',
        position: { x: toolX, y: toolY },
        data: toolNodeData,
        style: { width: NODE_DIMENSIONS.toolCallWidth },
      })

      edges.push({
        id: `e-${turnNodeId}-${toolNodeId}`,
        source: turnNodeId,
        sourceHandle: 'tool-source',
        target: toolNodeId,
        targetHandle: 'tool-target',
        type: 'straight',
        style: {
          stroke: 'var(--edge)',
          strokeWidth: 1,
          strokeDasharray: '4 4',
          ...(isFilteredOut ? { opacity: 0.2 } : {}),
        },
        data: { edgeType: 'turn-to-tool' },
      })
    }

    if (prevNodeId) {
      const isPhaseTransition = phaseType !== prevPhaseType && phaseType !== undefined
      const isCrossLane = depth !== prevDepth

      /** @type {import('./types.js').EdgeType} */
      let edgeType = 'sequential'
      let strokeColor = EDGE_DEFAULTS.sequentialColor
      let strokeWidth = EDGE_DEFAULTS.sequentialWidth
      /** @type {string | undefined} */
      let strokeDasharray

      if (isCrossLane && depth > prevDepth) {
        edgeType = 'spawn'
        strokeColor = EDGE_DEFAULTS.subagentSpawnColor
        strokeWidth = 2
        strokeDasharray = '6 4'
      } else if (isCrossLane && depth < prevDepth) {
        edgeType = 'return'
        strokeColor = EDGE_DEFAULTS.subagentReturnColor
        strokeWidth = 1.5
        strokeDasharray = '2 3'
      } else if (isPhaseTransition && phaseType) {
        edgeType = 'phase-transition'
        strokeColor = PHASE_EDGE_COLOR[phaseType] ?? EDGE_DEFAULTS.sequentialColor
        strokeWidth = EDGE_DEFAULTS.phaseTransitionWidth
      }

      const hasErrors = turnAnnotations.some((a) => a.type === 'error')
      if (hasErrors) {
        edgeType = 'error'
        strokeColor = EDGE_DEFAULTS.errorColor
        strokeWidth = 2
      }

      const edgeDimmed = isFilteredOut || prevFilteredOut
      edges.push({
        id: `e-${prevNodeId}-${turnNodeId}`,
        source: prevNodeId,
        target: turnNodeId,
        type: 'smoothstep',
        animated: edgeType === 'error' && !edgeDimmed,
        style: {
          stroke: strokeColor,
          strokeWidth,
          ...(strokeDasharray ? { strokeDasharray } : {}),
          ...(edgeDimmed ? { opacity: 0.15 } : {}),
        },
        data: {
          edgeType,
          phaseColor: phaseType ? PHASE_EDGE_COLOR[phaseType] : undefined,
        },
      })
    }

    currentY = y + NODE_DIMENSIONS.turnBaseHeight + NODE_DIMENSIONS.verticalGap

    prevNodeId = turnNodeId
    prevPhaseType = phaseType
    prevDepth = depth
    prevFilteredOut = isFilteredOut
  }

  return { nodes, edges }
}

/**
 * Compute the lane-header nodes for the subagent swimlanes. The main lane
 * (depth 0) carries no header.
 * @param {FlowNode[]} turnNodes
 * @returns {FlowNode[]}
 */
export function computeLaneHeaders(turnNodes) {
  /** @type {Map<number, { agentName: string, x: number, minY: number }>} */
  const lanes = new Map()

  for (const node of turnNodes) {
    if (node.type !== 'turn') continue
    const turnData = /** @type {TurnNodeData} */ (/** @type {unknown} */ (node.data))
    const depth = turnData.turn.depth ?? 0
    if (depth === 0) continue

    const existing = lanes.get(depth)
    if (!existing || node.position.y < existing.minY) {
      lanes.set(depth, {
        agentName: turnData.turn.agentName ?? `Agent ${depth}`,
        x: node.position.x,
        minY: node.position.y,
      })
    }
  }

  /** @type {FlowNode[]} */
  const headers = []
  for (const [depth, { agentName, x, minY }] of lanes) {
    headers.push({
      id: `lane-header-${depth}`,
      type: 'subagentLane',
      position: { x, y: minY - 32 },
      data: { depth, agentName },
      selectable: false,
      draggable: false,
    })
  }

  return headers
}

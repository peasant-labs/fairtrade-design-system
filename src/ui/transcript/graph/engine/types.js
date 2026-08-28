/* Graph node + canvas prop types for the trajectory graph.

   Pure data shapes. Deliberately NO `@xyflow/react` import here, so the mapper
   (turnsToFlow.js) stays importable and testable without the optional peer
   dependency installed. The flow node/edge shapes are declared structurally
   below and are assignable to `@xyflow/react`'s `Node` / `Edge`. */

/** @typedef {import('@peasant-labs/schema').TurnDetail} TurnDetail */
/** @typedef {import('@peasant-labs/schema').ToolCallDetail} ToolCallDetail */
/** @typedef {import('@peasant-labs/schema').Harness} Harness */
/** @typedef {import('../../analytics.js').TranscriptAnnotation} TranscriptAnnotation */
/** @typedef {import('../../analytics.js').PhaseSegment} Phase */
/** @typedef {import('../../analytics.js').PhaseType} PhaseType */
/** @typedef {import('../../view-model.js').ToolCallVM} ToolCallVM */

/* ── structural flow shapes (assignable to @xyflow/react Node / Edge) ────────── */

/**
 * A positioned graph node in canvas coordinates.
 * @typedef {object} FlowNode
 * @property {string} id
 * @property {string} [type]                     custom node type key ('turn' | 'toolCall' | 'subagentLane')
 * @property {{ x: number, y: number }} position canvas coordinates
 * @property {Record<string, unknown>} data      the node's cooked payload
 * @property {Record<string, unknown>} [style]
 * @property {boolean} [selectable]
 * @property {boolean} [draggable]
 */

/**
 * A connector between two `FlowNode`s.
 * @typedef {object} FlowEdge
 * @property {string} id
 * @property {string} source
 * @property {string} target
 * @property {string} [sourceHandle]
 * @property {string} [targetHandle]
 * @property {string} [type]
 * @property {boolean} [animated]
 * @property {Record<string, unknown>} [style]
 * @property {CanvasEdgeData} [data]
 */

/**
 * How an edge came about. Drives stroke colour, width, and dash pattern.
 * @typedef {'sequential' | 'phase-transition' | 'spawn' | 'return' | 'turn-to-tool' | 'error'} EdgeType
 */

/**
 * @typedef {object} CanvasEdgeData
 * @property {EdgeType} edgeType
 * @property {string} [phaseColor]
 */

/**
 * The mapper's output: a complete node-link graph.
 * @typedef {object} FlowGraph
 * @property {FlowNode[]} nodes
 * @property {FlowEdge[]} edges
 */

/* ── node data payloads (passed as `data` to the custom nodes) ───────────────── */

/**
 * @typedef {object} TurnNodeData
 * @property {TurnDetail} turn
 * @property {TranscriptAnnotation[]} annotations
 * @property {PhaseType | undefined} phaseType
 * @property {boolean} isSearchMatch
 * @property {boolean} isFilteredOut
 * @property {boolean} isSelected
 * @property {number} turnNumber
 * @property {number} tokensCumulative
 * @property {string} [searchQuery]
 * @property {Harness} [provider]  threaded in by the graph so the card accent matches the host
 */

/**
 * @typedef {object} ToolCallNodeData
 * @property {number} turnIndex
 * @property {ToolCallDetail[]} toolCalls
 * @property {Record<string, string>} previewById
 *   cooked one-line previews keyed by tool-call id (the adapter's `ToolCallVM.preview`),
 *   threaded in so the node renders the same arg summary as the list view WITHOUT
 *   parsing wire (`ToolCallDetail.arguments`) in the node
 * @property {number} totalDurationMs
 * @property {boolean} hasError
 * @property {boolean} isFilteredOut
 * @property {PhaseType | undefined} phaseType
 */

/**
 * @typedef {object} SubagentLaneData
 * @property {number} depth
 * @property {string} agentName
 */

/* ── canvas props ───────────────────────────────────────────────────────────── */

/**
 * A navigation command carrying a nonce, so the same target can be re-triggered.
 * @typedef {object} NavCommand
 * @property {number} target
 * @property {number} seq
 */

/**
 * @typedef {object} TrajectoryCanvasProps
 * @property {TurnDetail[]} turns
 * @property {Map<number, ToolCallVM[]>} [toolVMsByTurn]
 *   cooked tool calls keyed by turn index; absent means tool nodes render without arg previews
 * @property {TurnDetail[]} filteredTurns
 * @property {Phase[]} phases
 * @property {TranscriptAnnotation[]} annotations
 * @property {number[]} searchMatches
 * @property {string} [searchQuery]
 * @property {number} [activeMatchIndex]
 * @property {NavCommand} [focusTurn]   external command to pan the canvas to a turn index
 * @property {NavCommand} [focusPhase]  external command to fit the canvas to a phase index
 * @property {(phaseIndex: number) => void} [onPhaseActivate]
 * @property {(range: { start: number, end: number }) => void} [onViewportChange]
 * @property {Set<number>} [selectedTurns]  selected turn indices, for marquee highlighting
 * @property {(indices: number[]) => void} [onMarqueeSelect]
 */

export {}

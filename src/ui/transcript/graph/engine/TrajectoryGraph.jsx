/* The trajectory graph view: the @xyflow engine that lays out a transcript as a
   node-link trajectory and renders each node with this package's presentation-only
   graph visuals.

   It reuses the `turnsToFlow` mapper, so the topology stays consistent with the
   list view, while every visual element comes from the design system.

   `@xyflow/react` is an OPTIONAL PEER DEPENDENCY of this package. A host installs
   it (and imports `@xyflow/react/dist/style.css` once) only if it mounts this
   graph; an app that imports only `@peasant-labs/fairtrade/ui` never pulls it in. */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import { turnsToFlow, computeLaneHeaders } from './turnsToFlow.js'
import { useCanvasSync } from './useCanvasSync.js'
import { NODE_DIMENSIONS, EDGE_DEFAULTS } from './constants.js'
import { TurnCardNode } from './nodes/TurnCardNode.jsx'
import { ToolPillNode } from './nodes/ToolPillNode.jsx'
import { SubagentBranchNode } from './nodes/SubagentBranchNode.jsx'
import { GraphControls } from './GraphControls.jsx'
import { TrajectoryGraphLegend } from './TrajectoryGraphLegend.jsx'

/** @typedef {import('./types.js').TurnNodeData} TurnNodeData */

/** The custom node registry the engine renders each node type through. */
const nodeTypes = {
  turn: TurnCardNode,
  toolCall: ToolPillNode,
  subagentLane: SubagentBranchNode,
}

/**
 * @typedef {import('./types.js').TrajectoryCanvasProps & {
 *   provider?: import('@peasant-labs/schema').Harness,
 *   className?: string,
 * }} TrajectoryGraphProps
 */

/**
 * The trajectory graph. Owns its own `<ReactFlowProvider>`, so a host can mount
 * it directly (for example into the transcript viewer's graph slot).
 * @param {TrajectoryGraphProps} props
 * @returns {JSX.Element}
 */
export function TrajectoryGraph(props) {
  return (
    <ReactFlowProvider>
      <TrajectoryGraphCanvas {...props} />
    </ReactFlowProvider>
  )
}

/**
 * The canvas itself. Split out because the @xyflow hooks it uses require an
 * enclosing provider.
 * @param {TrajectoryGraphProps} props
 * @returns {JSX.Element}
 */
function TrajectoryGraphCanvas({
  turns,
  toolVMsByTurn,
  filteredTurns,
  phases,
  annotations,
  searchMatches,
  searchQuery,
  activeMatchIndex,
  focusTurn: focusTurnCmd,
  focusPhase: focusPhaseCmd,
  onPhaseActivate,
  onViewportChange,
  selectedTurns,
  provider,
  className = '',
}) {
  const rf = useReactFlow()
  const { focusTurn, focusPhase } = useCanvasSync(phases, turns, onPhaseActivate)

  const filteredIndices = useMemo(() => {
    if (filteredTurns.length === turns.length) return new Set()
    const filteredSet = new Set(filteredTurns)
    /** @type {Set<number>} */
    const positions = new Set()
    for (let i = 0; i < turns.length; i++) {
      if (filteredSet.has(turns[i])) positions.add(i)
    }
    return positions
  }, [turns, filteredTurns])

  const flowGraph = useMemo(
    () =>
      turnsToFlow({
        turns,
        toolVMsByTurn,
        phases,
        annotations,
        searchMatches,
        filteredIndices,
        searchQuery,
        selectedTurns,
      }),
    [turns, toolVMsByTurn, phases, annotations, searchMatches, filteredIndices, searchQuery, selectedTurns],
  )

  const nodesWithProvider = useMemo(
    () => flowGraph.nodes.map((n) => (n.type === 'turn' ? { ...n, data: { ...n.data, provider } } : n)),
    [flowGraph.nodes, provider],
  )

  const laneHeaderNodes = useMemo(() => computeLaneHeaders(nodesWithProvider), [nodesWithProvider])

  const edges = useMemo(
    () =>
      flowGraph.edges.map((e) => {
        const isToolEdge = e.sourceHandle === 'tool-source'
        return {
          ...e,
          style: {
            ...e.style,
            ...(isToolEdge ? { stroke: 'var(--edge)', strokeWidth: 1 } : {}),
          },
          animated: isToolEdge ? false : e.animated,
        }
      }),
    [flowGraph.edges],
  )

  const allNodes = useMemo(() => [...laneHeaderNodes, ...nodesWithProvider], [laneHeaderNodes, nodesWithProvider])

  const [nodes, setNodes, onNodesChange] = useNodesState(allNodes)
  const [edgeState, setEdges, onEdgesChange] = useEdgesState(edges)

  const prevTurnsLen = useRef(turns.length)
  const prevSearchQuery = useRef(searchQuery)
  const prevFilteredLen = useRef(filteredTurns.length)
  useEffect(() => {
    const changed =
      turns.length !== prevTurnsLen.current ||
      searchQuery !== prevSearchQuery.current ||
      filteredTurns.length !== prevFilteredLen.current
    if (changed) {
      setNodes(allNodes)
      setEdges(edges)
      prevTurnsLen.current = turns.length
      prevSearchQuery.current = searchQuery
      prevFilteredLen.current = filteredTurns.length
    }
  }, [allNodes, edges, turns.length, searchQuery, filteredTurns.length, setNodes, setEdges])

  useEffect(() => {
    if (activeMatchIndex === undefined) return
    const entryIdx = turns[activeMatchIndex]?.index
    if (entryIdx === undefined) return
    const match = nodes.find((n) => n.type === 'turn' && /** @type {TurnNodeData} */ (n.data).turn.index === entryIdx)
    if (match) {
      rf.setCenter(
        match.position.x + NODE_DIMENSIONS.turnWidth / 2,
        match.position.y + NODE_DIMENSIONS.turnBaseHeight / 2,
        { zoom: 1, duration: 350 },
      )
    }
  }, [activeMatchIndex, nodes, rf, turns])

  const prevFocusTurnSeq = useRef(-1)
  useEffect(() => {
    if (!focusTurnCmd || focusTurnCmd.seq === prevFocusTurnSeq.current) return
    prevFocusTurnSeq.current = focusTurnCmd.seq
    focusTurn(focusTurnCmd.target)
  }, [focusTurnCmd, focusTurn])

  const prevFocusPhaseSeq = useRef(-1)
  useEffect(() => {
    if (!focusPhaseCmd || focusPhaseCmd.seq === prevFocusPhaseSeq.current) return
    prevFocusPhaseSeq.current = focusPhaseCmd.seq
    focusPhase(focusPhaseCmd.target)
  }, [focusPhaseCmd, focusPhase])

  const fitted = useRef(false)
  useEffect(() => {
    if (nodes.length > 0 && !fitted.current) {
      fitted.current = true
      setTimeout(() => {
        const first = nodes.find((n) => n.type === 'turn')
        if (first) {
          rf.setCenter(
            first.position.x + NODE_DIMENSIONS.turnWidth / 2,
            first.position.y + NODE_DIMENSIONS.turnBaseHeight,
            { zoom: 1.05, duration: 300 },
          )
        } else {
          rf.fitView({ padding: 0.1, duration: 300 })
        }
      }, 100)
    }
  }, [nodes.length, rf, nodes])

  const minimapNodeColor = useCallback(
    /** @param {{ type?: string, data: Record<string, unknown> }} n */
    (n) => {
      if (n.type === 'turn') {
        const d = /** @type {TurnNodeData} */ (/** @type {unknown} */ (n.data))
        const hasErr = d.annotations?.some?.((a) => a.type === 'error')
        if (hasErr) return 'var(--danger)'
        if (d.isFilteredOut) return 'var(--rule)'
        if (d.turn.role === 'user') return 'var(--teal)'
        if (d.turn.role === 'assistant') return 'var(--amber)'
        return 'var(--ink-2)'
      }
      if (n.type === 'toolCall') return 'var(--ink-3)'
      return 'var(--rule)'
    },
    [],
  )

  const onNodeClick = useCallback(
    /**
     * @param {import('react').MouseEvent} _e
     * @param {{ type?: string, data: Record<string, unknown> }} n
     */
    (_e, n) => {
      if (n.type !== 'turn') return
      const d = /** @type {TurnNodeData} */ (/** @type {unknown} */ (n.data))
      onViewportChange?.({ start: d.turn.index, end: d.turn.index })
    },
    [onViewportChange],
  )

  const cls = ['tb-root', 'tb-graph', className].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      <div className="tb-graph-flow">
        <ReactFlow
          nodes={nodes}
          edges={edgeState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView={false}
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{
            style: { stroke: EDGE_DEFAULTS.sequentialColor, strokeWidth: EDGE_DEFAULTS.sequentialWidth },
          }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          selectNodesOnDrag={false}
          panOnDrag
          panOnScroll
          zoomOnScroll
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--rule)" />
          <MiniMap
            zoomable
            pannable
            nodeColor={minimapNodeColor}
            nodeStrokeColor="var(--rule)"
            nodeBorderRadius={0}
            maskColor="color-mix(in srgb, var(--canvas) 70%, transparent)"
            className="tb-graph-minimap"
          />
        </ReactFlow>
        <GraphControls />
        <TrajectoryGraphLegend provider={provider} />
      </div>
    </div>
  )
}

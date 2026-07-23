import { useMemo, useRef } from 'react'
import MapCanvas from '../MapCanvas.jsx'
import { codeMapStatesEqual, createCodeMapState, deriveCodeMapView, reduceCodeMapState } from './codeMapState.js'
import { assertCodeMapPayloadEnums } from './types.js'

const CODE_MAP_ZOOM_TO_GRAIN = Object.freeze({
  project: 'overview',
  package: 'folders',
  file: 'files',
})

const CODE_MAP_GRAIN_TO_ZOOM = Object.freeze({
  overview: 'project',
  folders: 'package',
  files: 'file',
})

/**
 * CodeMap — the lifted code-topology surface over the shared MapCanvas.
 *
 * The payload remains the cooked topology contract from @peasant-labs/fairtrade/graph:
 * geometry stays derived here, activity edges stay in the host rail, and the host
 * feeds interaction state through props so demo and app render the same behavior.
 *
 * @param {object} props
 * @param {import('./types.js').CodeMapPayload} props.payload
 * @param {{level:'project'|'package'|'file', expanded?: Iterable<string>}} [props.zoom]
 * @param {(zoom:{level:'project'|'package'|'file', expanded:string[]})=>void} [props.onZoomChange]
 * @param {string|null} [props.selectedId]
 * @param {(id:string|null, node:import('./types.js').MapNodePayload|null)=>void} [props.onSelect]
 * @param {(id:string)=>void} [props.onExpand]
 * @param {Iterable<string>} [props.highlightedIds]
 * @param {Record<string,'new'|'removed'>} [props.nodeDeltas]
 * @param {Record<string,'new'|'removed'>} [props.structureEdgeDeltas]
 * @param {number|string} [props.height]
 * @param {string} [props.ariaLabel]
 * @param {string} [props.className]
 * @param {{scale:number, panX:number, panY:number}|null} [props.viewport]
 * @param {(viewport:{scale:number, panX:number, panY:number})=>void} [props.onViewportChange]
 * @param {import('./codeMapState.js').CodeMapState} [props.state]
 * @param {(state:import('./codeMapState.js').CodeMapState)=>void} [props.onStateChange]
 */
export default function CodeMap({
  payload,
  zoom,
  onZoomChange,
  selectedId,
  onSelect,
  onExpand,
  highlightedIds,
  nodeDeltas,
  structureEdgeDeltas,
  height = 520,
  ariaLabel = 'code map',
  className = '',
  viewport,
  onViewportChange,
  state,
  onStateChange,
}) {
  const nodesById = useMemo(() => {
    const out = new Map()
    for (const node of payload?.nodes ?? []) out.set(node.id, node)
    return out
  }, [payload?.nodes])

  const canonicalState = useMemo(
    () => state === undefined ? null : createCodeMapState(state),
    [state],
  )
  const derived = useMemo(
    () => canonicalState ? deriveCodeMapView(payload, canonicalState) : null,
    [payload, canonicalState],
  )
  const data = useMemo(
    () => codeMapPayloadToMapData(payload ? { ...payload, nodes: derived?.canvas.allNodes ?? payload.nodes } : payload),
    [payload, derived?.canvas.allNodes],
  )
  const grain = derived ? CODE_MAP_ZOOM_TO_GRAIN[derived.canvas.grain] ?? 'folders' : CODE_MAP_ZOOM_TO_GRAIN[zoom?.level ?? 'package']
  const expanded = derived?.canvas.expandedIds ?? zoom?.expanded
  const latestGrainRef = useRef(grain)
  latestGrainRef.current = grain

  function publishAction(action) {
    if (!canonicalState) return
    const next = reduceCodeMapState(canonicalState, action)
    if (!codeMapStatesEqual(canonicalState, next)) onStateChange?.(next)
  }

  return (
    <MapCanvas
      data={data}
      grain={grain}
      expandedIds={expanded}
      visibleIds={derived?.canvas.visibleIds}
      hierarchy={derived?.canvas.hierarchy}
      selectedId={derived ? derived.canvas.selectedId : selectedId}
      highlightedIds={highlightedIds}
      nodeDeltas={nodeDeltas}
      edgeDeltas={structureEdgeDeltas}
      onSelect={(id) => {
        onSelect?.(id, id ? nodesById.get(id) ?? null : null)
      }}
      onExpand={onExpand}
      onGrainChange={(nextGrain) => {
        latestGrainRef.current = nextGrain
        onZoomChange?.({
          level: CODE_MAP_GRAIN_TO_ZOOM[nextGrain] ?? 'package',
          expanded: [],
        })
      }}
      onExpandedIdsChange={(ids) => {
        onZoomChange?.({
          level: CODE_MAP_GRAIN_TO_ZOOM[latestGrainRef.current] ?? 'package',
          expanded: ids,
        })
      }}
      height={height}
      ariaLabel={ariaLabel}
      className={className}
      viewport={derived ? derived.canvas.viewport : viewport}
      onViewportChange={(nextViewport) => {
        onViewportChange?.(nextViewport)
      }}
      onStateAction={canonicalState ? publishAction : undefined}
      canonicalControlled={canonicalState !== null}
    />
  )
}

/**
 * @param {import('./types.js').CodeMapPayload | undefined} payload
 * @returns {{nodes: Array<object>, edges: Array<object>}}
 */
export function codeMapPayloadToMapData(payload) {
  if (payload) assertCodeMapPayloadEnums(payload)
  const nodes = payload?.nodes ?? []
  const violationsByNode = countViolationsByEndpoint(payload?.violations ?? [])
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      label: node.name || node.id,
      kind: node.kind === 'file' ? 'file' : 'folder',
      loc: node.loc ?? 0,
      coverage: coverageStep(node.recordedFiles, node.totalFiles),
      parent: node.parent || undefined,
      violations: violationsByNode.get(node.id) ?? 0,
      // carry the backend's deterministic layer/order contract through to
      // MapCanvas — the payload's MapNodePayload.layer/order come straight from
      // peasant/codegraph's layering (pkg/schema/map_api.go MapNode), so the
      // shared canvas positions real maps by the SAME rows/order the backend
      // computed instead of re-deriving them from parent depth / payload order.
      layer: node.layer,
      order: node.order,
    })),
    edges: (payload?.structureEdges ?? []).map((edge) => ({
      from: edge.from,
      to: edge.to,
      kind: 'structure',
      weight: edge.count ?? 1,
    })),
  }
}

function coverageStep(recordedFiles, totalFiles) {
  const total = Number(totalFiles) || 0
  if (total <= 0) return 0
  const ratio = Math.max(0, Math.min(1, (Number(recordedFiles) || 0) / total))
  return Math.max(0, Math.min(4, Math.round(ratio * 4)))
}

function countViolationsByEndpoint(violations) {
  const counts = new Map()
  for (const violation of violations) {
    increment(counts, violation.from)
    increment(counts, violation.to)
  }
  return counts
}

function increment(counts, id) {
  if (!id) return
  counts.set(id, (counts.get(id) ?? 0) + 1)
}

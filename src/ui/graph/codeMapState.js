// @ts-check

/** @typedef {'navigator'|'canvas'} CodeMapPresentation */
/** @typedef {'project'|'package'|'file'} CodeMapGrain */
/** @typedef {{scale:number, panX:number, panY:number}} CodeMapViewport */
import { assertCodeMapPayloadEnums } from './types.js'

/** @typedef {import('./types.js').MapNodePayload} MapNodePayload */
/** @typedef {{type:'replace'|'hydrate', state:Partial<CodeMapState>} | {type:'set-presentation', presentation:CodeMapPresentation} | {type:'select'|'toggle-expanded'|'open-in-map', id:string} | {type:'focus', id:string|null} | {type:'clear-selection'} | {type:'set-filter', filter:string} | {type:'set-expanded', ids:Iterable<string>} | {type:'set-grain', grain:CodeMapGrain} | {type:'set-viewport', viewport:CodeMapViewport|null} | {type:'reveal', id:string, grain:CodeMapGrain, expandedIds:Iterable<string>}} CodeMapAction */
/**
 * @typedef {object} CodeMapState
 * @property {1} version
 * @property {CodeMapPresentation} presentation
 * @property {string|null} selectedId
 * @property {CodeMapGrain} grain
 * @property {string[]} expandedIds
 * @property {string} navigatorFilter
 * @property {string|null} navigatorFocusedId
 * @property {CodeMapViewport|null} viewport
 */
/** @typedef {{node:import('./types.js').MapNodePayload, depth:number, parentId:string|null, childIds:string[], hasChildren:boolean, canExpand:boolean, forcedOpen:boolean, expanded:boolean}} CodeMapNavigatorRow */
/** @typedef {{orderedIds:string[], rootIds:string[], childIdsByParent:Record<string,string[]>, depthById:Record<string,number>}} CodeMapHierarchy */
/** @typedef {{allNodes:import('./types.js').MapNodePayload[], nodes:import('./types.js').MapNodePayload[], visibleIds:string[], selectedId:string|null, grain:CodeMapGrain, expandedIds:string[], viewport:CodeMapViewport|null, hierarchy:CodeMapHierarchy}} CodeMapCanvasView */
/** @typedef {{state:CodeMapState, rows:CodeMapNavigatorRow[], focusedId:string|null, selected:import('./types.js').MapNodePayload|null, staleSelectedId:string|null, canvas:CodeMapCanvasView}} CodeMapView */

export const CODE_MAP_STATE_VERSION = 1
export const CODE_MAP_VIEWPORT_SCALE = Object.freeze({ min: 0.35, max: 2.4 })

/** @param {unknown} value @returns {value is number} */
export function isCodeMapViewportScale(value) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= CODE_MAP_VIEWPORT_SCALE.min
    && value <= CODE_MAP_VIEWPORT_SCALE.max
}

const DEFAULT_STATE = Object.freeze({
  version: CODE_MAP_STATE_VERSION,
  presentation: 'navigator',
  selectedId: null,
  grain: 'package',
  expandedIds: Object.freeze([]),
  navigatorFilter: '',
  navigatorFocusedId: null,
  viewport: null,
})

/** @type {ReadonlySet<CodeMapPresentation>} */
const PRESENTATIONS = new Set(['navigator', 'canvas'])
/** @type {ReadonlySet<CodeMapGrain>} */
const GRAINS = new Set(['project', 'package', 'file'])
// `file` ALSO bases at depth 1 — file grain is reached only through explicit
// per-node expansion (`expandedIds`), never by auto-descending the whole tree.
// The canvas must never lay out every file in the repo at once: a large real
// project (hundreds of files) would degenerate into an unreadable wall of
// boxes. Collapsed folders stay aggregate until a caller expands them.
//
// THE single source of truth for this depth rule: MapCanvas.jsx's own
// uncontrolled/legacy path (used whenever no canonicalState is supplied --
// Storybook, or any caller that hasn't adopted the canonical state contract)
// derives its canvas-vocabulary depth map FROM this export, rather than
// hardcoding a second copy. Two constants that happen to agree today is how
// `files: Infinity` silently drifted back in once already (the legacy copy
// kept the old unbounded value after this one was capped) -- see
// CODE_MAP_GRAIN_DEPTH's consumer in MapCanvas.jsx for the derivation.
const GRAIN_DEPTH = Object.freeze({ project: 0, package: 1, file: 1 })
export const CODE_MAP_GRAIN_DEPTH = GRAIN_DEPTH
const STATE_FIELDS = Object.freeze(['version', 'presentation', 'selectedId', 'grain', 'expandedIds', 'navigatorFilter', 'navigatorFocusedId', 'viewport'])
/** @type {Readonly<Record<string, readonly string[]>>} */
const ACTION_FIELDS = Object.freeze({
  replace: ['type', 'state'],
  hydrate: ['type', 'state'],
  'set-presentation': ['type', 'presentation'],
  select: ['type', 'id'],
  'clear-selection': ['type'],
  focus: ['type', 'id'],
  'set-filter': ['type', 'filter'],
  'set-expanded': ['type', 'ids'],
  'toggle-expanded': ['type', 'id'],
  'set-grain': ['type', 'grain'],
  'set-viewport': ['type', 'viewport'],
  'open-in-map': ['type', 'id'],
  reveal: ['type', 'id', 'grain', 'expandedIds'],
})

/**
 * Creates a canonical, JSON-safe code-map interaction state.
 * @param {Partial<CodeMapState>|null} [seed]
 * @returns {CodeMapState}
 */
export function createCodeMapState(seed = null) {
  if (seed !== null && !isRecord(seed)) {
    throw actionable('create state', 'seed', 'the seed is not an object', 'pass an object or omit the seed')
  }
  const source = seed ?? {}
  requireKnownKeys(source, STATE_FIELDS, 'create state', 'seed')
  if (source.version !== undefined && source.version !== CODE_MAP_STATE_VERSION) {
    throw actionable('create state', 'version', `version ${String(source.version)} is unsupported`, `use version ${CODE_MAP_STATE_VERSION}`)
  }
  return {
    version: CODE_MAP_STATE_VERSION,
    presentation: enumValue(source.presentation, PRESENTATIONS, DEFAULT_STATE.presentation, 'presentation'),
    selectedId: optionalId(source.selectedId, 'selectedId'),
    grain: enumValue(source.grain, GRAINS, DEFAULT_STATE.grain, 'grain'),
    expandedIds: idList(source.expandedIds, 'expandedIds'),
    navigatorFilter: stringValue(source.navigatorFilter, '', 'navigatorFilter'),
    navigatorFocusedId: optionalId(source.navigatorFocusedId, 'navigatorFocusedId'),
    viewport: viewportValue(source.viewport),
  }
}

/** @param {CodeMapState} left @param {CodeMapState} right */
export function codeMapStatesEqual(left, right) {
  const a = createCodeMapState(left)
  const b = createCodeMapState(right)
  return a.version === b.version
    && a.presentation === b.presentation
    && a.selectedId === b.selectedId
    && a.grain === b.grain
    && a.expandedIds.length === b.expandedIds.length
    && a.expandedIds.every((id, index) => id === b.expandedIds[index])
    && a.navigatorFilter === b.navigatorFilter
    && a.navigatorFocusedId === b.navigatorFocusedId
    && viewportEquals(a.viewport, b.viewport)
}

/**
 * Applies one semantic interaction and returns a fresh canonical state.
 * @param {CodeMapState} state
 * @param {CodeMapAction} action
 * @returns {CodeMapState}
 */
export function reduceCodeMapState(state, action) {
  const current = createCodeMapState(state)
  requireAction(action)
  switch (action.type) {
    case 'replace':
    case 'hydrate':
      return createCodeMapState(action.state)
    case 'set-presentation':
      return createCodeMapState({ ...current, presentation: requiredEnum(action.presentation, PRESENTATIONS, 'presentation') })
    case 'select':
      return createCodeMapState({ ...current, selectedId: requiredId(action.id, 'id'), navigatorFocusedId: requiredId(action.id, 'id') })
    case 'clear-selection':
      return createCodeMapState({ ...current, selectedId: null })
    case 'focus':
      return createCodeMapState({ ...current, navigatorFocusedId: optionalId(action.id, 'id') })
    case 'set-filter':
      return createCodeMapState({ ...current, navigatorFilter: stringValue(action.filter, '', 'filter') })
    case 'set-expanded':
      return createCodeMapState({ ...current, expandedIds: idList(action.ids, 'ids') })
    case 'toggle-expanded': {
      const id = requiredId(action.id, 'id')
      const ids = new Set(current.expandedIds)
      if (ids.has(id)) ids.delete(id)
      else ids.add(id)
      return createCodeMapState({ ...current, expandedIds: [...ids] })
    }
    case 'set-grain':
      return createCodeMapState({ ...current, grain: requiredEnum(action.grain, GRAINS, 'grain'), expandedIds: [] })
    case 'set-viewport':
      return createCodeMapState({ ...current, viewport: viewportValue(action.viewport) })
    case 'open-in-map': {
      const id = requiredId(action.id, 'id')
      return createCodeMapState({ ...current, presentation: 'canvas', selectedId: id, navigatorFocusedId: id })
    }
    case 'reveal': {
      const id = requiredId(action.id, 'id')
      return createCodeMapState({
        ...current,
        grain: requiredEnum(action.grain, GRAINS, 'grain'),
        expandedIds: idList(action.expandedIds, 'expandedIds'),
        selectedId: id,
        navigatorFocusedId: id,
      })
    }
    default:
      throw actionable('reduce state', 'action.type', 'the action is unsupported', 'use a documented CodeMapAction')
  }
}

/**
 * Derives the complete navigator and canvas inputs from payload plus canonical state.
 * Returned nodes are plain public payload data; no private indexes or depths are attached.
 * @param {import('./types.js').CodeMapPayload|undefined|null} payload
 * @param {CodeMapState} state
 * @returns {CodeMapView}
 */
export function deriveCodeMapView(payload, state) {
  if (payload) assertCodeMapPayloadEnums(payload)
  const canonical = createCodeMapState(state)
  const rawNodes = payload?.nodes ?? []
  if (!Array.isArray(rawNodes)) {
    throw actionable('derive view', 'payload.nodes', 'nodes is not an array', 'provide a CodeMapPayload with a nodes array')
  }

  /** @type {Map<string, MapNodePayload>} */
  const byId = new Map()
  /** @type {Map<string, number>} */
  const inputOrder = new Map()
  rawNodes.forEach((raw, index) => {
    if (!isRecord(raw)) throw actionable('derive view', `payload.nodes[${index}]`, 'the node is not an object', 'provide a node object')
    const id = requiredId(raw.id, `payload.nodes[${index}].id`)
    if (byId.has(id)) throw actionable('derive view', `payload.nodes[${index}].id`, `duplicate node id ${JSON.stringify(id)}`, 'give every node one unique nonempty id')
    const node = /** @type {MapNodePayload} */ ({ ...raw, id })
    if (node.parent !== undefined && node.parent !== null && node.parent !== '') node.parent = requiredId(node.parent, `payload.nodes[${index}].parent`)
    else delete node.parent
    byId.set(id, node)
    inputOrder.set(id, index)
  })

  for (const node of byId.values()) {
    if (node.parent && !byId.has(node.parent)) {
      throw actionable('derive view', `node ${JSON.stringify(node.id)} parent`, `parent ${JSON.stringify(node.parent)} does not exist`, 'add the parent node or remove the parent reference to make this node a root')
    }
  }

  /** @type {Map<string, MapNodePayload[]>} */
  const children = new Map()
  /** @type {MapNodePayload[]} */
  const roots = []
  for (const node of byId.values()) {
    if (node.parent) {
      const list = children.get(node.parent) ?? []
      list.push(node)
      children.set(node.parent, list)
    } else roots.push(node)
  }
  /** @param {MapNodePayload} a @param {MapNodePayload} b */
  const compare = (a, b) => {
    const ao = Number.isFinite(a.order) ? Number(a.order) : inputOrder.get(a.id) ?? 0
    const bo = Number.isFinite(b.order) ? Number(b.order) : inputOrder.get(b.id) ?? 0
    return ao - bo || codePointCompare(a.id, b.id)
  }
  roots.sort(compare)
  for (const list of children.values()) list.sort(compare)

  /** @type {Map<string, number>} */
  const depthById = new Map()
  /** @type {string[]} */
  const orderedIds = []
  /** @type {Set<string>} */
  const visiting = new Set()
  /** @type {Set<string>} */
  const visited = new Set()
  /** @param {MapNodePayload} node @param {number} depth */
  function visit(node, depth) {
    if (visiting.has(node.id)) throw actionable('derive view', `node ${JSON.stringify(node.id)}`, 'the parent graph contains a cycle', 'remove the cyclic parent reference')
    if (visited.has(node.id)) return
    visiting.add(node.id)
    orderedIds.push(node.id)
    depthById.set(node.id, depth)
    for (const child of children.get(node.id) ?? []) visit(child, depth + 1)
    visiting.delete(node.id)
    visited.add(node.id)
  }
  for (const root of roots) visit(root, 0)
  if (visited.size !== byId.size) {
    const cyclic = [...byId.keys()].find((id) => !visited.has(id))
    // A component without a root can only be a parent cycle after missing parents were rejected.
    const cyclicNode = cyclic ? byId.get(cyclic) : undefined
    if (cyclicNode) visit(cyclicNode, 0)
  }

  const expanded = new Set(canonical.expandedIds.filter((id) => byId.has(id)))
  const query = canonical.navigatorFilter.trim().toLowerCase()
  /** @type {Set<string>} */
  const matchingContext = new Set()
  if (query) {
    for (const node of byId.values()) {
      if (!node.id.toLowerCase().includes(query) && !String(node.name ?? '').toLowerCase().includes(query)) continue
      /** @type {MapNodePayload|null|undefined} */
      let cursor = node
      while (cursor) {
        matchingContext.add(cursor.id)
        cursor = cursor.parent ? byId.get(cursor.parent) : null
      }
    }
  }

  const maxDepth = GRAIN_DEPTH[canonical.grain]
  /** @type {CodeMapNavigatorRow[]} */
  const rows = []
  /** @param {MapNodePayload} node @param {number} depth @param {string|null} [parentId] */
  function appendRow(node, depth, parentId = null) {
    if (query && !matchingContext.has(node.id)) return
    const derivedChildren = children.get(node.id) ?? []
    const visibleChildIds = derivedChildren
      .filter((child) => !query || matchingContext.has(child.id))
      .map((child) => child.id)
    const hasChildren = derivedChildren.length > 0
    // A node is expandable whenever it has children AND either the grain's base
    // depth already reaches it OR it is explicitly in `expandedIds` — the SAME
    // depth-cap-OR-explicit-expansion rule the canvas uses (appendCanvas below),
    // so a caller can always manually drill deeper than the current grain (e.g.
    // reveal a deeply nested selected file at file grain) without losing the
    // disclosure control or keyboard toggling on the way down.
    const canExpand = hasChildren && (depth < maxDepth || expanded.has(node.id))
    const forcedOpen = !!query && visibleChildIds.length > 0
    rows.push({
      node: { ...node },
      depth,
      parentId,
      childIds: visibleChildIds,
      hasChildren,
      canExpand,
      forcedOpen,
      expanded: forcedOpen || (canExpand && expanded.has(node.id)),
    })
    if (query || depth < maxDepth || expanded.has(node.id)) {
      for (const child of derivedChildren) appendRow(child, depth + 1, node.id)
    }
  }
  for (const root of roots) appendRow(root, 0)

  /** @type {MapNodePayload[]} */
  const canvasNodes = []
  /** @param {MapNodePayload} node @param {number} depth */
  function appendCanvas(node, depth) {
    const kids = children.get(node.id) ?? []
    const descend = kids.length > 0 && (depth < maxDepth || expanded.has(node.id))
    if (descend) for (const child of kids) appendCanvas(child, depth + 1)
    else canvasNodes.push({ ...node })
  }
  for (const root of roots) appendCanvas(root, 0)

  const selected = canonical.selectedId ? byId.get(canonical.selectedId) ?? null : null
  const visibleRowIds = new Set(rows.map((row) => row.node.id))
  const focusedId = canonical.navigatorFocusedId && visibleRowIds.has(canonical.navigatorFocusedId)
    ? canonical.navigatorFocusedId
    : rows[0]?.node.id ?? null

  return {
    state: canonical,
    rows,
    focusedId,
    selected: selected ? { ...selected } : null,
    staleSelectedId: canonical.selectedId && !selected ? canonical.selectedId : null,
    canvas: {
      allNodes: [...byId.values()].map((node) => ({ ...node })),
      nodes: canvasNodes,
      visibleIds: canvasNodes.map((node) => node.id),
      selectedId: selected?.id ?? null,
      grain: canonical.grain,
      expandedIds: [...expanded].sort(codePointCompare),
      viewport: canonical.viewport ? { ...canonical.viewport } : null,
      hierarchy: {
        orderedIds,
        rootIds: roots.map((node) => node.id),
        childIdsByParent: Object.fromEntries([...children].map(([parent, nodes]) => [parent, nodes.map((node) => node.id)])),
        depthById: Object.fromEntries(depthById),
      },
    },
  }
}

/** @param {CodeMapAction} action */
function requireAction(action) {
  if (!isRecord(action) || typeof action.type !== 'string') {
    throw actionable('reduce state', 'action.type', 'the action has no string type', 'pass a supported action object')
  }
  const fields = ACTION_FIELDS[action.type]
  if (!fields) throw actionable('reduce state', 'action.type', `action ${JSON.stringify(action.type)} is not supported`, `use one of ${Object.keys(ACTION_FIELDS).join(', ')}`)
  requireExactKeys(action, fields, 'reduce state', `action ${action.type}`)
  switch (action.type) {
    case 'replace':
    case 'hydrate':
      requiredRecord(action.state, 'state')
      break
    case 'set-presentation':
      requiredEnum(action.presentation, PRESENTATIONS, 'presentation')
      break
    case 'select':
    case 'toggle-expanded':
    case 'open-in-map':
      requiredId(action.id, 'id')
      break
    case 'focus':
      nullableId(action.id, 'id')
      break
    case 'set-filter':
      requiredString(action.filter, 'filter')
      break
    case 'set-expanded':
      requiredIdList(action.ids, 'ids')
      break
    case 'set-grain':
      requiredEnum(action.grain, GRAINS, 'grain')
      break
    case 'set-viewport':
      nullableViewport(action.viewport, 'viewport')
      break
    case 'reveal':
      requiredId(action.id, 'id')
      requiredEnum(action.grain, GRAINS, 'grain')
      requiredIdList(action.expandedIds, 'expandedIds')
      break
    case 'clear-selection':
      break
  }
}

/** @param {string} operation @param {string} where @param {string} why @param {string} fix */
function actionable(operation, where, why, fix) {
  return new Error(`Code map ${operation} failed: what went wrong: invalid ${where}; why: ${why}; where: @peasant-labs/fairtrade/graph ${where}; when: ${operation}; what it means: the requested code-map state cannot be used safely; how to fix: ${fix}.`)
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** @param {object} value @param {readonly string[]} allowed @param {string} operation @param {string} where */
function requireKnownKeys(value, allowed, operation, where) {
  const allowedSet = new Set(allowed)
  const unknown = Object.keys(value).find((key) => !allowedSet.has(key))
  if (unknown) throw actionable(operation, `${where}.${unknown}`, `field ${JSON.stringify(unknown)} is not allowed`, `remove ${JSON.stringify(unknown)} and use only ${allowed.join(', ')}`)
}

/** @param {object} value @param {readonly string[]} expected @param {string} operation @param {string} where */
function requireExactKeys(value, expected, operation, where) {
  requireKnownKeys(value, expected, operation, where)
  const missing = expected.find((key) => !(key in value))
  if (missing) throw actionable(operation, `${where}.${missing}`, `required field ${JSON.stringify(missing)} is missing`, `provide ${JSON.stringify(missing)} for this action`)
}

/** @param {string} a @param {string} b */
function codePointCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

/** @param {unknown} value @param {string} field @returns {string} */
function requiredId(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw actionable('normalize state', field, 'the id is not a nonempty string', 'provide a nonempty string id')
  return value
}

/** @param {unknown} value @param {string} field @returns {string|null} */
function nullableId(value, field) {
  if (value === null) return null
  return requiredId(value, field)
}

/** @param {unknown} value @param {string} field @returns {string|null} */
function optionalId(value, field) {
  if (value === undefined || value === null) return null
  return requiredId(value, field)
}

/** @param {unknown} value @param {string} field @returns {string[]} */
function idList(value, field) {
  if (value === undefined) return []
  if (value === null || typeof value === 'string' || typeof /** @type {any} */ (value)[Symbol.iterator] !== 'function') {
    throw actionable('normalize state', field, 'the value is not an iterable of ids', 'provide an array or other iterable of nonempty string ids')
  }
  const values = [.../** @type {Iterable<unknown>} */ (value)]
  return [...new Set(values.map((id, index) => requiredId(id, `${field}[${index}]`)))].sort(codePointCompare)
}

/** @param {unknown} value @param {string} field @returns {string[]} */
function requiredIdList(value, field) {
  if (value === undefined) throw actionable('normalize action', field, 'the required id iterable is undefined', 'provide a non-string iterable of nonempty ids')
  return idList(value, field)
}

/** @param {unknown} value @param {string} field @returns {Record<string, any>} */
function requiredRecord(value, field) {
  if (!isRecord(value)) throw actionable('normalize action', field, 'the required value is not an object', 'provide an object')
  return value
}

/** @param {unknown} value @param {string} field @returns {string} */
function requiredString(value, field) {
  if (typeof value !== 'string') throw actionable('normalize action', field, 'the required value is not a string', 'provide a string')
  return value
}

/** @param {unknown} value @param {string} fallback @param {string} field @returns {string} */
function stringValue(value, fallback, field) {
  if (value === undefined) return fallback
  if (typeof value !== 'string') throw actionable('normalize state', field, 'the value is not a string', 'provide a string')
  return value
}

/** @template {string} T @param {unknown} value @param {ReadonlySet<T>} allowed @param {T} fallback @param {string} field @returns {T} */
function enumValue(value, allowed, fallback, field) {
  if (value === undefined) return fallback
  return requiredEnum(value, allowed, field)
}

/** @template {string} T @param {unknown} value @param {ReadonlySet<T>} allowed @param {string} field @returns {T} */
function requiredEnum(value, allowed, field) {
  if (typeof value !== 'string' || !allowed.has(/** @type {T} */ (value))) throw actionable('normalize state', field, `value ${JSON.stringify(value)} is unsupported`, `use one of ${[...allowed].join(', ')}`)
  return /** @type {T} */ (value)
}

/** @param {unknown} value @returns {CodeMapViewport|null} */
function viewportValue(value) {
  if (value === undefined || value === null) return null
  if (!isRecord(value)) throw actionable('normalize state', 'viewport', 'the viewport is not an object or null', 'provide {scale, panX, panY} or null')
  const { scale, panX, panY } = value
  if (!isCodeMapViewportScale(scale) || typeof panX !== 'number' || typeof panY !== 'number'
      || !Number.isFinite(panX) || !Number.isFinite(panY)) {
    throw actionable('normalize state', 'viewport', `scale must be within ${CODE_MAP_VIEWPORT_SCALE.min}..${CODE_MAP_VIEWPORT_SCALE.max} and pan values must be finite`, `provide finite panX and panY values and a scale within ${CODE_MAP_VIEWPORT_SCALE.min}..${CODE_MAP_VIEWPORT_SCALE.max}`)
  }
  return { scale, panX, panY }
}

/** @param {unknown} value @param {string} field @returns {CodeMapViewport|null} */
function nullableViewport(value, field) {
  if (value === null) return null
  if (value === undefined) throw actionable('normalize action', field, 'the required viewport is undefined', 'provide null or a bounded viewport object')
  return viewportValue(value)
}

/** @param {CodeMapViewport|null} left @param {CodeMapViewport|null} right */
function viewportEquals(left, right) {
  if (left === null || right === null) return left === right
  return left.scale === right.scale && left.panX === right.panX && left.panY === right.panY
}

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Folder,
  FileCode,
  Plus,
  Minus,
  Maximize,
  TriangleAlert,
  Search,
  Check,
  ChevronRight,
} from 'lucide-react'
import { CODE_MAP_GRAIN_DEPTH, CODE_MAP_VIEWPORT_SCALE, isCodeMapViewportScale } from './graph/codeMapState.js'
import './MapCanvas.css'

/* MapCanvas (.mc-*): the flagship spatial component — an interactive code-structure
   map, modelled on peasant's MapCanvas + MapSquareNode + edges.tsx + MapToolbar.
   self-contained (its own namespaced css, tokens only) and dependency-free: no
   react-flow, no force physics — just plain SVG + divs + React state. the picture is
   a PURE function of the data + view state (same input => identical layout on every
   render and machine; no clock, no random), ported faithfully from peasant's
   layout.ts / keyboard.ts / intensity.ts into plain JS.

   the encoding (peasant spec §4/§5), four ORTHOGONAL channels so meaning is never
   colour-only:
     - WIDTH      hints at LOC (linear, clamped) — "how big"
     - FILL       the monochrome coverage ramp 0..4 (ink mixed over surface, NO hue)
                  — "how covered". the channel's sole owner.
     - ICON       folder vs file (a glyph, never colour)
     - SELECTION  amber border + a corner marker (not colour alone)
     - VIOLATION  a clay badge with a count + a warning glyph (the ONLY red here)
   edges are square (90° orthogonal joins, radius 0): structure = solid hairline,
   activity = dashed; stroke WIDTH ∝ weight (never hue).

   semantic zoom: a segmented control (overview / folders / files) changes which
   nodes are visible; edges LIFT to the nearest visible ancestor so coupling is never
   lost when a subtree collapses. pan = drag the canvas; zoom = the on-canvas square
   controls, +/- keys, or a MODIFIER-gated wheel/trackpad-pinch (ctrl/cmd+wheel,
   anchored under the cursor) — a plain wheel is NEVER hijacked, so the page keeps
   scrolling normally over the canvas. full keyboard model: roving focus across
   nodes (arrows move, enter selects), an aria-live region naming the focused
   node + its coverage/violations. */

/* ------------------------------------------------------------------ geometry */
/* px constants, lifted from peasant/layout.ts. exposed shapes stay deterministic. */
const NODE_HEIGHT = 56
const MIN_NODE_WIDTH = 104
const MAX_NODE_WIDTH = 248
const ROW_HEIGHT = 132 // > NODE_HEIGHT so orthogonal edges have a routing band
const NODE_GAP = 28
const PADDING = 48 // breathing room around the laid-out graph, inside the viewBox
/* a row (all nodes sharing a layer) wraps into multiple stacked SHELVES once it
   would exceed this width, instead of growing into one endless horizontal row.
   Real projects routinely have 20-40+ siblings at a single tree depth (a repo's
   top-level folders, or a package's files) -- confirmed against real projects in
   the field: even the simplest "overview" zoom (root folders only) can overflow
   a normal viewport several times over with no wrap. Wrapping keeps the map
   readable by growing vertically (more shelves) instead of horizontally (one
   unreadable row); this constant is independent of any live viewport size (the
   canvas is pannable/zoomable) -- it is a fixed, deterministic packing width so
   layout stays a pure function of (nodes, grain, expanded), not window size. */
const SHELF_MAX_WIDTH = 1200
/* manual-zoom clamp (the inner-group scale). fit picks a scale inside this band. */
const ZOOM_STEP = 1.25 // multiplicative per +/- press

/* the three semantic-zoom grains, in the CANVAS vocabulary (overview/folders/
   files) vs. codeMapState's STATE vocabulary (project/package/file) -- the
   same three depths, just named for this component's own toolbar. */
const CANVAS_GRAIN_TO_STATE_GRAIN = { overview: 'project', folders: 'package', files: 'file' }
// SINGLE SOURCE OF TRUTH for the depth rule: derived from codeMapState.js's
// CODE_MAP_GRAIN_DEPTH via the mapping above, not a second hand-maintained
// copy. This is the uncontrolled/legacy path's own depth cap -- reached
// whenever no canonicalState is supplied (Storybook, or any caller that
// hasn't adopted the canonical state contract; CodeMap.jsx falls back to
// this exact path whenever its `state` prop is absent) -- so it must track
// the canonical rule exactly, not just "happen to agree" with it. `files`
// previously hardcoded `Infinity` here independently of the canonical
// `file: 1` cap; that drift alone reproduced the "one very long row"
// regression for any consumer on the uncontrolled path even after the
// canonical path was fixed.
const GRAIN_DEPTH = Object.fromEntries(
  Object.entries(CANVAS_GRAIN_TO_STATE_GRAIN).map(([canvasGrain, stateGrain]) => [canvasGrain, CODE_MAP_GRAIN_DEPTH[stateGrain]]),
)
/* `depth` is the base tree depth rendered before any per-node expansion:
   overview shows only roots (folders), folders opens one level, files opens
   one level too (deeper only via explicit expansion) -- see GRAIN_DEPTH
   above, the actual source of truth; this array only drives the toolbar's
   labels/order. */
const GRAINS = [
  { id: 'overview', label: 'overview' },
  { id: 'folders', label: 'folders' },
  { id: 'files', label: 'files' },
]

/* how long a released drag/zoom's local preview waits for the canonicalControlled
   owner to reconcile the proposal (see the `viewport` prop doc) before giving up
   and falling back to the canonical prop unconditionally. Long enough to absorb
   a same-tick/next-render `useState` owner (the reference case) or a modest
   debounce; short enough that a non-reconciling owner's snap-back reads as "my
   change didn't stick" rather than a multi-second hang. */
const DRAG_RECONCILE_TIMEOUT_MS = 500

/* Belt-and-braces staleness bound on dragRef itself (distinct from
   DRAG_RECONCILE_TIMEOUT_MS above, which bounds the RENDER preview after a
   drag ends). onPointerDown's single-pointer guard ignores a second pointer
   while dragRef is populated; onLostPointerCapture is the real, spec-
   guaranteed safety net for a pointer whose up/cancel never arrives, but
   this timeout is a second, independent line of defense against the same
   "permanently wedged" failure mode should capture itself never have been
   established (e.g. the viewport ref was somehow not yet mounted). Long
   enough that it can never fire during a real human drag; short enough that
   a genuinely stuck ref recovers well within a single user session. */
const DRAG_STALE_TIMEOUT_MS = 10_000

/* ------------------------------------------------------------------ intensity */
/* coverage 0..4 -> the monochrome fill ramp (peasant/intensity.ts NODE_FILL idiom,
   here a single color-mix ladder driven from --mc-cov on the node). NO hue: the ink
   is mixed into the surface at a rising weight. levels >= INK_FLIPS_AT get dark
   enough that --ink fails contrast, so the label flips to --canvas (the readable
   inverse in BOTH themes by construction of the ramp — same trick as Treemap). */
const INK_FLIPS_AT = 3

function clampCoverage(n) {
  const v = Math.round(Number(n) || 0)
  return v < 0 ? 0 : v > 4 ? 4 : v
}

/* the leaf of a slash path, so "ingest/stream.go" labels as "stream.go". */
function leaf(label) {
  const s = String(label ?? '')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}

/* ------------------------------------------------------------------ tree model */
/* parent links form the tree; everything below is a pure function of (nodes, grain,
   expanded). ported from peasant/layout.ts. */

function compareOrder(a, b) {
  if (a._order !== b._order) return a._order - b._order
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/* index nodes by id, children by parent (sorted), roots (sorted). `_order` prefers the
   caller's explicit `order` field (the backend's deterministic layer/order contract,
   peasant/codegraph's layering); when a node carries no explicit `order`, `_order` falls
   back to its input-array index so mock/story data without the contract still lays out
   deterministically. */
function buildTree(nodes) {
  const byId = new Map()
  nodes.forEach((n, i) => {
    const order = Number.isFinite(n.order) ? n.order : i
    byId.set(n.id, { ...n, _order: order })
  })
  const children = new Map()
  const parentIdByChild = new Map()
  const roots = []
  for (const n of byId.values()) {
    const parent = n.parent && byId.has(n.parent) ? n.parent : null
    if (parent) {
      parentIdByChild.set(n.id, parent)
      const list = children.get(parent)
      if (list) list.push(n)
      else children.set(parent, [n])
    } else {
      roots.push(n)
    }
  }
  for (const list of children.values()) list.sort(compareOrder)
  roots.sort(compareOrder)
  const depthById = new Map()
  const orderedIds = []
  const visit = (node, depth) => {
    depthById.set(node.id, depth)
    orderedIds.push(node.id)
    for (const child of children.get(node.id) ?? []) visit(child, depth + 1)
  }
  for (const root of roots) visit(root, 0)
  return { byId, children, roots, parentIdByChild, depthById, orderedIds, canonical: false }
}

/* The unified code-map path supplies hierarchy that was already validated and
   ordered by deriveCodeMapView. This adapter only joins those IDs to the cooked
   canvas nodes; it does not rediscover parentage or ordering. */
function treeFromHierarchy(nodes, hierarchy) {
  const orderById = new Map(hierarchy.orderedIds.map((id, index) => [id, index]))
  const byId = new Map(nodes.map((node) => [node.id, { ...node, _order: orderById.get(node.id) ?? Number.MAX_SAFE_INTEGER }]))
  const children = new Map()
  const parentIdByChild = new Map()
  for (const [parent, ids] of Object.entries(hierarchy.childIdsByParent)) {
    children.set(parent, ids.map((id) => byId.get(id)).filter(Boolean))
    for (const id of ids) parentIdByChild.set(id, parent)
  }
  return {
    byId,
    children,
    roots: hierarchy.rootIds.map((id) => byId.get(id)).filter(Boolean),
    parentIdByChild,
    depthById: new Map(Object.entries(hierarchy.depthById)),
    orderedIds: [...hierarchy.orderedIds],
    canonical: true,
  }
}

/* Canonical state owns layout depth. Raw `layer` remains a legacy-only contract for
   callers that do not supply a derived hierarchy. */
function layerOf(node, tree) {
  if (tree.canonical) return tree.depthById.get(node.id) ?? 0
  return Number.isFinite(node.layer) ? node.layer : tree.depthById.get(node.id) ?? 0
}

/* which nodes render at the current grain + expansion set. a node descends (shows
   its children instead of itself) when it has children AND (its depth is shallower
   than the grain's base depth OR it is explicitly expanded). leaves always render.
   collapsed siblings stay aggregate. (peasant/visibleNodes.) */
function visibleNodes(tree, grainDepth, expanded) {
  const { children, roots } = tree
  const out = []
  const visit = (node, depth) => {
    const kids = children.get(node.id)
    const descend = !!kids && kids.length > 0 && (depth < grainDepth || expanded.has(node.id))
    if (descend) for (const kid of kids) visit(kid, depth + 1)
    else out.push(node)
  }
  for (const root of roots) visit(root, 0)
  return out
}

/* ------------------------------------------------------------------ layout */
/* layer/order -> x/y + a LOC-scaled width, in the fixed viewBox space. distinct
   depths present among the visible nodes compact to consecutive rows (no empty
   bands), each row centred against the widest. (peasant/computePositions.) */
function layout(visible, tree) {
  if (visible.length === 0) return { positioned: [], width: 0, height: 0 }

  let maxLoc = 0
  for (const n of visible) maxLoc = Math.max(maxLoc, Math.max(0, Number(n.loc) || 0))
  const widthOf = (n) => {
    if (maxLoc <= 0) return MIN_NODE_WIDTH
    const ratio = Math.max(0, Number(n.loc) || 0) / maxLoc
    return Math.round(MIN_NODE_WIDTH + ratio * (MAX_NODE_WIDTH - MIN_NODE_WIDTH))
  }

  // group by layer (the row; server-assigned when present, else tree depth), sort
  // within row by (order, id) — see layerOf/compareOrder.
  const rows = new Map()
  for (const n of visible) {
    const d = layerOf(n, tree)
    const row = rows.get(d)
    if (row) row.push(n)
    else rows.set(d, [n])
  }
  const depths = Array.from(rows.keys()).sort((a, b) => a - b)
  for (const d of depths) rows.get(d).sort(compareOrder)

  const rowWidth = (row) =>
    row.reduce((s, n) => s + widthOf(n), 0) + NODE_GAP * (row.length - 1)

  // pack each layer's (already order-sorted) siblings into shelves: a greedy
  // left-to-right fill that starts a new shelf once the next node would push
  // the running width past SHELF_MAX_WIDTH. Deterministic (depends only on the
  // sorted row + fixed widths/gap), and a shelf always holds AT LEAST one node
  // (a single very-wide node never gets stuck / dropped). A row that already
  // fits in one shelf (the common case for small trees) produces exactly one
  // shelf, so this is a superset of the prior one-row-per-depth behavior.
  const packShelves = (row) => {
    const shelves = []
    let current = []
    let currentWidth = 0
    for (const n of row) {
      const w = widthOf(n)
      const additional = current.length === 0 ? w : w + NODE_GAP
      if (current.length > 0 && currentWidth + additional > SHELF_MAX_WIDTH) {
        shelves.push(current)
        current = [n]
        currentWidth = w
      } else {
        current.push(n)
        currentWidth += additional
      }
    }
    if (current.length > 0) shelves.push(current)
    return shelves
  }

  const shelvesByDepth = new Map()
  for (const d of depths) shelvesByDepth.set(d, packShelves(rows.get(d)))

  let maxRowWidth = 0
  for (const d of depths) {
    for (const shelf of shelvesByDepth.get(d)) maxRowWidth = Math.max(maxRowWidth, rowWidth(shelf))
  }

  const positioned = []
  let shelfIndex = 0
  for (const d of depths) {
    for (const shelf of shelvesByDepth.get(d)) {
      let x = PADDING + (maxRowWidth - rowWidth(shelf)) / 2
      const y = PADDING + shelfIndex * ROW_HEIGHT
      for (const n of shelf) {
        const w = widthOf(n)
        positioned.push({ node: n, x, y, w, h: NODE_HEIGHT })
        x += w + NODE_GAP
      }
      shelfIndex += 1
    }
  }

  const width = maxRowWidth + PADDING * 2
  const height = (shelfIndex - 1) * ROW_HEIGHT + NODE_HEIGHT + PADDING * 2
  return { positioned, width, height }
}

/* ------------------------------------------------------------------ edge lift */
/* walk an id up its parent chain to the nearest VISIBLE ancestor (memoised). this is
   what makes collapsed coupling survive: a file->file edge under two collapsed
   folders becomes a folder->folder edge. (peasant/makeAncestorResolver.) */
function makeResolver(parentIdByChild, visibleIds) {
  const memo = new Map()
  return (id) => {
    if (memo.has(id)) return memo.get(id)
    let cur = id
    while (cur !== undefined && cur !== null && !visibleIds.has(cur)) {
      cur = parentIdByChild.get(cur) ?? null
    }
    memo.set(id, cur ?? null)
    return cur ?? null
  }
}

/* aggregate edges up to visible ancestor pairs, summing weight. intra-aggregate
   edges (both ends collapse into the same node) and unknown ends drop. deterministic
   order. (peasant/aggregateEdges.) */
function aggregateEdges(edges, parentIdByChild, visibleIds) {
  const resolve = makeResolver(parentIdByChild, visibleIds)
  const acc = new Map()
  for (const e of edges) {
    const from = resolve(e.from)
    const to = resolve(e.to)
    if (!from || !to || from === to) continue
    const kind = e.kind === 'activity' ? 'activity' : 'structure'
    const key = `${kind}|${from}→${to}`
    const weight = Math.max(0, Number(e.weight) || 1)
    const existing = acc.get(key)
    if (existing) existing.weight += weight
    else acc.set(key, { from, to, kind, weight })
  }
  return Array.from(acc.values()).sort((a, b) =>
    a.from !== b.from
      ? a.from < b.from
        ? -1
        : 1
      : a.to < b.to
        ? -1
        : a.to > b.to
          ? 1
          : 0
  )
}

/* per-visible-node count of violations whose owning node is hidden inside it — so a
   violation buried in a collapsed subtree still badges the visible aggregate (the
   alarm never silently vanishes). a node's own violations always count. */
function aggregateViolations(nodes, parentIdByChild, visibleIds) {
  const resolve = makeResolver(parentIdByChild, visibleIds)
  const counts = new Map()
  for (const n of nodes) {
    const v = Math.max(0, Number(n.violations) || 0)
    if (v <= 0) continue
    const owner = resolve(n.id)
    if (!owner) continue
    counts.set(owner, (counts.get(owner) || 0) + v)
  }
  return counts
}

/* ------------------------------------------------------------------ keyboard */
/* roving-focus reducer (peasant/reduceMapKey): left/right move within a row by order,
   up/down jump to the nearest row landing on the nearest x. returns the SAME id on a
   no-op so the host can tell handled keys from passes. */
function firstInReading(positioned) {
  let best
  for (const p of positioned) {
    if (!best || p.y < best.y || (p.y === best.y && p.x < best.x)) best = p
  }
  return best
}

function rowSibling(positioned, cur, dir) {
  const row = positioned.filter((p) => p.y === cur.y).sort((a, b) => a.x - b.x)
  const idx = row.findIndex((p) => p.node.id === cur.node.id)
  if (idx === -1) return undefined
  return row[idx + dir]
}

function nearestAcrossRows(positioned, cur, dir) {
  let targetY
  for (const p of positioned) {
    const delta = (p.y - cur.y) * dir
    if (delta <= 0) continue
    if (targetY === undefined || (p.y - targetY) * dir < 0) targetY = p.y
  }
  if (targetY === undefined) return undefined
  const curCx = cur.x + cur.w / 2
  let best
  for (const p of positioned) {
    if (p.y !== targetY) continue
    if (!best) {
      best = p
      continue
    }
    const dp = Math.abs(p.x + p.w / 2 - curCx)
    const db = Math.abs(best.x + best.w / 2 - curCx)
    if (dp < db) best = p
  }
  return best
}

/* ------------------------------------------------------------------ component */

/**
 * @typedef {Object} MapNode
 * @property {string} id                       stable key (repo-relative path)
 * @property {string} label                    display label (leaf of a path is shown)
 * @property {'folder'|'file'} kind            folder vs file — distinguished by ICON
 * @property {number} [loc=0]                   lines of code — node WIDTH ∝ loc
 * @property {number} [coverage=0]             0..4 monochrome coverage ramp (the FILL)
 * @property {string} [parent]                 parent id (forms the tree)
 * @property {number} [violations=0]           violation count — a clay badge
 * @property {number} [layer]                  server-assigned row (0 = top row); when
 *   present, positions this node's ROW instead of tree depth (peasant/codegraph's
 *   deterministic layer/order contract). Falls back to tree depth when absent.
 * @property {number} [order]                  server-assigned stable sort key within a
 *   layer; when present, orders siblings/row-mates instead of input-array position.
 *   Falls back to input order when absent.
 */

/**
 * @typedef {Object} MapEdge
 * @property {string} from
 * @property {string} to
 * @property {'structure'|'activity'} [kind='structure']  solid vs dashed
 * @property {number} [weight=1]               stroke WIDTH ∝ weight (never hue)
 */

/**
 * MapCanvas — an interactive code-structure map. Pan (drag), zoom (square controls /
 * +/- keys / ctrl-or-cmd+wheel — a plain wheel always just scrolls the page),
 * semantic zoom (overview / folders / files) with edge
 * ancestor-lifting, a minimap, and a node search combobox. Square metric-encoded
 * nodes (width ∝ LOC, monochrome coverage fill, folder/file icon, amber selection +
 * marker, clay violation badge) and square orthogonal edges (solid structure /
 * dashed activity, width ∝ weight). Full roving-focus keyboard nav with an aria-live
 * region. Pure: no data fetching, deterministic layout.
 *
 * @param {Object} props
 * @param {{nodes: MapNode[], edges?: MapEdge[]}} [props.data]   the graph
 * @param {'overview'|'folders'|'files'} [props.grain='folders'] initial semantic zoom
 * @param {Iterable<string>} [props.expandedIds]                 expanded node ids
 * @param {Iterable<string>} [props.visibleIds]                  canonical derived visible node ids
 * @param {import('./graph/codeMapState.js').CodeMapHierarchy} [props.hierarchy] canonical validated hierarchy
 * @param {string|null} [props.selectedId]                       selected node id
 * @param {Iterable<string>} [props.highlightedIds]              host hover/relay ids
 * @param {Record<string,'new'|'removed'>} [props.nodeDeltas]    per-node review deltas
 * @param {Record<string,'new'|'removed'>} [props.edgeDeltas]    per-edge review deltas
 * @param {(id:string|null, node:MapNode|null)=>void} [props.onSelect]  selection cb
 * @param {(grain:'overview'|'folders'|'files')=>void} [props.onGrainChange]
 * @param {(ids:string[])=>void} [props.onExpandedIdsChange]
 * @param {(id:string)=>void} [props.onExpand]
 * @param {number|string} [props.height=520]                     canvas height
 * @param {string} [props.ariaLabel='code map']                  application label
 * @param {string} [props.className]                             extra container class
 * @param {{scale:number, panX:number, panY:number}|null} [props.viewport] controlled/restorable spatial viewport.
 *   In `canonicalControlled` mode this is the SOLE source of truth once a
 *   gesture ends: MapCanvas renders it directly and does not keep its own
 *   copy. CONTRACT: when a pan/zoom gesture ends, MapCanvas calls
 *   `onViewportChange`/`onStateAction` with the proposed viewport, and the
 *   owner is expected to feed that value straight back through this prop
 *   PROMPTLY (a same-tick/next-render `useState` update, as peasant's real
 *   integration does, is the reference case — not a debounce, network
 *   round-trip, or anything else that can take an unbounded amount of time).
 *   During the gesture itself MapCanvas tracks the pointer locally so the
 *   drag/zoom stays smooth without waiting on this round-trip; it holds that
 *   local preview for up to ~500ms after the gesture ends waiting for
 *   `viewport` to reflect (or nearly reflect — the owner may legitimately
 *   clamp scale/pan bounds) the proposal, THEN falls back to whatever this
 *   prop says. An owner that never updates `viewport` in response (rejects
 *   the change, or simply never wires the callback) will see the gesture
 *   held for that ~500ms window and then discarded — a visible snap-back to
 *   the pre-gesture position, not a smooth revert. An owner that reconciles
 *   slower than ~500ms (e.g. a debounce or a network-backed proposal) will
 *   see the SAME snap-back-then-jump-to-late-value symptom the pointer-drag
 *   fix in this file exists to prevent — reconcile synchronously.
 * @param {(viewport:{scale:number, panX:number, panY:number})=>void} [props.onViewportChange]
 * @param {(action:import('./graph/codeMapState.js').CodeMapAction)=>void} [props.onStateAction] one semantic canvas gesture
 * @param {boolean} [props.canonicalControlled=false] canonical values render directly; gestures emit proposals only.
 *   See the `viewport` prop doc above for the synchronous-reconciliation
 *   contract this mode requires of its owner.
 */
export default function MapCanvas({
  data = { nodes: [], edges: [] },
  grain: grainProp = 'folders',
  expandedIds,
  visibleIds: canonicalVisibleIds,
  hierarchy: canonicalHierarchy,
  selectedId: selectedIdProp,
  highlightedIds,
  nodeDeltas = {},
  edgeDeltas = {},
  onSelect,
  onGrainChange,
  onExpandedIdsChange,
  onExpand,
  height = 520,
  ariaLabel = 'code map',
  className = '',
  viewport,
  onViewportChange,
  onStateAction,
  canonicalControlled = false,
}) {
  const nodes = data?.nodes ?? []
  const edges = data?.edges ?? []

  const baseId = useId().replace(/[:]/g, '')
  const liveId = `${baseId}-live`
  const listId = `${baseId}-list`

  /* ----- view state ----- */
  const [localGrain, setLocalGrain] = useState(
    GRAIN_DEPTH[grainProp] !== undefined ? grainProp : 'folders'
  )
  // initialise synchronously from the controlled `expandedIds` prop (matching
  // `grain`/`selectedId` below) so the FIRST render already reflects it — not
  // just renders after the sync effect runs post-mount. Matters for SSR/initial
  // paint (the effect never runs server-side) and avoids a one-frame flash of
  // the collapsed grain-base tree before the effect widens it.
  const [localExpanded, setLocalExpanded] = useState(() => toIdSet(expandedIds))
  const [localSelectedId, setLocalSelectedId] = useState(selectedIdProp ?? null)
  const [focusedId, setFocusedId] = useState(null)
  const [localScale, setLocalScale] = useState(() => validScale(viewport?.scale) ? viewport.scale : 1)
  const [localPan, setLocalPan] = useState(() => ({
    x: finiteNumber(viewport?.panX, 0),
    y: finiteNumber(viewport?.panY, 0),
  })) // translate of the inner group, px
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const viewportRef = useRef(null)
  const dragRef = useRef(null) // { startX, startY, panX, panY, moved, nextPan }
  // Live pan/scale while a drag gesture is in progress, in CANONICAL-CONTROLLED
  // mode only. Canonical mode renders `scale`/`pan` straight from the owner's
  // `viewport` prop so a proposal round-trip stays authoritative — but a
  // continuous gesture (pointer drag) can't wait a render for that round-trip
  // without visibly stalling: onPointerMove used to skip applying anything at
  // all in this mode, so the canvas didn't move until pointerup. This preview
  // is the local-first half of "local-first with reconciliation on release":
  // it tracks the pointer every frame; the owner still only gets ONE `set-
  // viewport` proposal, on release (unchanged), and once that reconciles the
  // preview is cleared so the canonical prop takes back over.
  const [dragPreview, setDragPreview] = useState(null)
  // Bounded wait for the owner to reconcile a just-released proposal before
  // dragPreview gives up control back to the canonical prop unconditionally.
  // See DRAG_RECONCILE_TIMEOUT_MS below for why this exists.
  const reconcileTimerRef = useRef(null)
  const didInitFit = useRef(false)
  const preserveRestoredViewport = useRef(viewport !== undefined && viewport !== null)
  const initialViewportKey = viewport && validScale(viewport.scale)
    ? `${viewport.scale}|${finiteNumber(viewport.panX, 0)}|${finiteNumber(viewport.panY, 0)}`
    : ''
  const reportedViewportRef = useRef(initialViewportKey)
  const hydratedViewportKeyRef = useRef(initialViewportKey)
  const userViewportChangeRef = useRef(false)
  const grainPropRef = useRef(grainProp)
  const selectedIdPropRef = useRef(selectedIdProp)
  // live mirrors of scale/pan so callbacks can read the latest values without a
  // nested-setState (calling setPan inside a setScale updater warns in StrictMode).
  const expandedIdsKey = idsKey(expandedIds)
  const highlightedIdsKey = idsKey(highlightedIds)
  const grain = canonicalControlled
    ? GRAIN_DEPTH[grainProp] !== undefined ? grainProp : 'folders'
    : localGrain
  const expanded = useMemo(
    () => canonicalControlled ? toIdSet(expandedIds) : localExpanded,
    [canonicalControlled, expandedIdsKey, localExpanded],
  )
  const selectedId = canonicalControlled ? selectedIdProp ?? null : localSelectedId
  const hasCanonicalViewport = canonicalControlled && viewport !== null && viewport !== undefined && validScale(viewport.scale)
  // The in-gesture preview wins over the canonical prop so a drag tracks the
  // pointer immediately; once released (dragPreview cleared) the canonical
  // prop is authoritative again.
  const scale = dragPreview ? dragPreview.scale : hasCanonicalViewport ? viewport.scale : localScale
  const pan = dragPreview
    ? { x: dragPreview.panX, y: dragPreview.panY }
    : hasCanonicalViewport
      ? { x: finiteNumber(viewport.panX, 0), y: finiteNumber(viewport.panY, 0) }
      : localPan
  const scaleRef = useRef(scale)
  const panRef = useRef(pan)
  scaleRef.current = scale
  panRef.current = pan

  // Reconcile (or time out) a released drag/zoom's local preview against the
  // canonicalControlled owner's viewport prop. onPointerUp sets dragPreview to
  // the proposed value and emits ONE proposal; this effect is what actually
  // releases dragPreview — either because the owner's `viewport` prop now
  // reflects that proposal (the common case: a synchronous owner reconciles
  // within a render or two), or, failing that, after DRAG_RECONCILE_TIMEOUT_MS
  // — so an owner that clamps to a different value, rejects the change, or
  // never wires the callback still gets control back instead of pinning the
  // preview forever (see the `viewport` prop doc for the contract this
  // assumes of the owner).
  useEffect(() => {
    if (!dragPreview) return undefined
    // Only ever (re-)arm the reconcile-or-timeout window once the gesture is
    // actually over — i.e. dragRef has been cleared by onPointerUp/abortDrag.
    // This effect also reruns on every onPointerMove-driven dragPreview update
    // WHILE the gesture is still active (dragRef.current still set); gating on
    // that is what stops a normal in-gesture PAUSE (pointer held down, simply
    // not moving for a beat) from racing this timer and snapping the preview
    // back to a stale canonical position mid-drag, then resuming on the next
    // move — a real regression a user pausing a drag would actually hit.
    // onPointerUp forces a fresh dragPreview object at release specifically so
    // this effect reruns (and this gate then reads false) exactly once the
    // gesture ends, restoring the original release-time reconcile/timeout.
    if (dragRef.current) return undefined
    const reconciled = hasCanonicalViewport
      && viewport.scale === dragPreview.scale
      && finiteNumber(viewport.panX, 0) === dragPreview.panX
      && finiteNumber(viewport.panY, 0) === dragPreview.panY
    if (reconciled) {
      setDragPreview(null)
      return undefined
    }
    reconcileTimerRef.current = setTimeout(() => setDragPreview(null), DRAG_RECONCILE_TIMEOUT_MS)
    return () => clearTimeout(reconcileTimerRef.current)
  }, [dragPreview, hasCanonicalViewport, viewport?.scale, viewport?.panX, viewport?.panY])

  useEffect(() => {
    if (canonicalControlled) return
    if (grainProp === grainPropRef.current) return
    grainPropRef.current = grainProp
    if (GRAIN_DEPTH[grainProp] !== undefined) setLocalGrain(grainProp)
  }, [canonicalControlled, grainProp])

  useEffect(() => {
    if (!canonicalControlled && expandedIds !== undefined) setLocalExpanded(toIdSet(expandedIds))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalControlled, expandedIdsKey])

  useEffect(() => {
    if (canonicalControlled) return
    if (selectedIdProp === selectedIdPropRef.current) return
    selectedIdPropRef.current = selectedIdProp
    if (selectedIdProp !== undefined) setLocalSelectedId(selectedIdProp)
  }, [canonicalControlled, selectedIdProp])

  useEffect(() => {
    if (canonicalControlled) {
      if (!viewport && hydratedViewportKeyRef.current !== '') {
        hydratedViewportKeyRef.current = ''
        preserveRestoredViewport.current = false
        didInitFit.current = false
        setLocalScale(1)
        setLocalPan({ x: 0, y: 0 })
      } else if (viewport && validScale(viewport.scale)) {
        // The canonical `viewport` PROP is a fresh object literal on every
        // derive (see CodeMap.jsx / deriveCodeMapView), even when its VALUE
        // is unchanged -- e.g. a reducer action that only touched
        // expandedIds, not the viewport, still produces a new `{...}` object
        // downstream. Without this value-equality guard (already present in
        // the non-canonical branch below), that reference churn alone would
        // re-arm preserveRestoredViewport on every unrelated state change,
        // permanently swallowing the very next visible-set-driven auto-fit
        // (a collapse right after a descent-triggered fit, for example) --
        // found via real-app verification of the descent-feedback breadcrumb
        // (collapsing back out silently kept the zoomed-in transform).
        const key = `${viewport.scale}|${finiteNumber(viewport.panX, 0)}|${finiteNumber(viewport.panY, 0)}`
        if (key !== hydratedViewportKeyRef.current) {
          hydratedViewportKeyRef.current = key
          preserveRestoredViewport.current = true
        }
      }
      return
    }
    if (!viewport) {
      if (hydratedViewportKeyRef.current === '') return
      hydratedViewportKeyRef.current = ''
      reportedViewportRef.current = '1|0|0'
      preserveRestoredViewport.current = false
      setLocalScale(1)
      setLocalPan({ x: 0, y: 0 })
      return
    }
    if (!validScale(viewport.scale)) return
    const key = `${viewport.scale}|${finiteNumber(viewport.panX, 0)}|${finiteNumber(viewport.panY, 0)}`
    if (key === hydratedViewportKeyRef.current) return
    hydratedViewportKeyRef.current = key
    preserveRestoredViewport.current = true
    reportedViewportRef.current = key
    setLocalScale(viewport.scale)
    setLocalPan({ x: finiteNumber(viewport.panX, 0), y: finiteNumber(viewport.panY, 0) })
  }, [canonicalControlled, viewport, viewport?.scale, viewport?.panX, viewport?.panY])

  useEffect(() => {
    if (canonicalControlled) return
    if (!onViewportChange && !onStateAction) return
    const key = `${scale}|${pan.x}|${pan.y}`
    if (reportedViewportRef.current === key) return
    reportedViewportRef.current = key
    onViewportChange?.({ scale, panX: pan.x, panY: pan.y })
    if (userViewportChangeRef.current) {
      userViewportChangeRef.current = false
      onStateAction?.({ type: 'set-viewport', viewport: { scale, panX: pan.x, panY: pan.y } })
    }
  }, [canonicalControlled, onStateAction, onViewportChange, pan.x, pan.y, scale])

  /* ----- derived: tree, visible set, layout, edges, violations ----- */
  const tree = useMemo(
    () => canonicalHierarchy ? treeFromHierarchy(nodes, canonicalHierarchy) : buildTree(nodes),
    [nodes, canonicalHierarchy],
  )

  const canonicalVisibleKey = idsKey(canonicalVisibleIds)
  const visible = useMemo(() => {
    if (canonicalVisibleIds === undefined) return visibleNodes(tree, GRAIN_DEPTH[grain], expanded)
    return Array.from(canonicalVisibleIds, (id) => tree.byId.get(id)).filter(Boolean)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, grain, expanded, canonicalVisibleKey])
  const visibleIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible])

  const { positioned, width: graphW, height: graphH } = useMemo(
    () => layout(visible, tree),
    [visible, tree]
  )
  const posById = useMemo(() => {
    const m = new Map()
    for (const p of positioned) m.set(p.node.id, p)
    return m
  }, [positioned])

  const childCount = useMemo(() => {
    const m = new Map()
    for (const [parent, kids] of tree.children) m.set(parent, kids.length)
    return m
  }, [tree])

  const liftedEdges = useMemo(
    () => aggregateEdges(edges, tree.parentIdByChild, visibleIds),
    [edges, tree.parentIdByChild, visibleIds]
  )
  const maxWeight = useMemo(
    () => liftedEdges.reduce((m, e) => Math.max(m, e.weight), 1),
    [liftedEdges]
  )
  const violationCounts = useMemo(
    () => aggregateViolations(nodes, tree.parentIdByChild, visibleIds),
    [nodes, tree.parentIdByChild, visibleIds]
  )
  const highlightedVisibleIds = useMemo(() => {
    const source = toIdSet(highlightedIds)
    if (source.size === 0) return source
    const resolve = makeResolver(tree.parentIdByChild, visibleIds)
    const out = new Set()
    for (const id of source) {
      const visibleId = resolve(id)
      if (visibleId) out.add(visibleId)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedIdsKey, tree.parentIdByChild, visibleIds])

  /* ----- search matches (a path-substring combobox) ----- */
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return nodes
      .filter((n) => n.id.toLowerCase().includes(q) || (n.label || '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [nodes, query])

  const emitViewportProposal = useCallback((next) => {
    onViewportChange?.(next)
    onStateAction?.({ type: 'set-viewport', viewport: next })
  }, [onStateAction, onViewportChange])

  const applyViewport = useCallback((next, publish) => {
    if (canonicalControlled && publish) {
      emitViewportProposal(next)
      return
    }
    if (publish) userViewportChangeRef.current = true
    setLocalScale(next.scale)
    setLocalPan({ x: next.panX, y: next.panY })
  }, [canonicalControlled, emitViewportProposal])

  /* ----- fit: pick the scale + pan that frames the whole graph, clamped ----- */
  const fit = useCallback((publish = false) => {
    const vp = viewportRef.current
    if (!vp || graphW <= 0 || graphH <= 0) return
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    if (vw <= 0 || vh <= 0) return
    const raw = Math.min(vw / graphW, vh / graphH)
    const next = Math.max(CODE_MAP_VIEWPORT_SCALE.min, Math.min(CODE_MAP_VIEWPORT_SCALE.max, raw))
    applyViewport({ scale: next, panX: (vw - graphW * next) / 2, panY: (vh - graphH * next) / 2 }, publish)
  }, [applyViewport, graphW, graphH])

  /* ----- fit scoped to a SUBSET of nodes (a just-opened folder's own subtree),
     not the whole graph. Returns true if it found geometry to frame, false if
     the caller should fall back to fit(). Reuses the same applyViewport path
     as fit()/zoomBy -- no new viewport-ownership semantics. */
  const fitToIds = useCallback((ids, publish = false) => {
    const vp = viewportRef.current
    if (!vp) return false
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    if (vw <= 0 || vh <= 0) return false
    const subset = positioned.filter((p) => ids.has(p.node.id))
    if (subset.length === 0) return false
    const minX = Math.min(...subset.map((p) => p.x))
    const minY = Math.min(...subset.map((p) => p.y))
    const maxX = Math.max(...subset.map((p) => p.x + p.w))
    const maxY = Math.max(...subset.map((p) => p.y + p.h))
    const bw = maxX - minX
    const bh = maxY - minY
    if (bw <= 0 || bh <= 0) return false
    const raw = Math.min(vw / bw, vh / bh)
    const next = Math.max(CODE_MAP_VIEWPORT_SCALE.min, Math.min(CODE_MAP_VIEWPORT_SCALE.max, raw))
    applyViewport({
      scale: next,
      panX: vw / 2 - (minX + bw / 2) * next,
      panY: vh / 2 - (minY + bh / 2) * next,
    }, publish)
    return true
  }, [applyViewport, positioned])

  // The transform is deliberately NOT transitioned during drag/zoom (it must
  // track the pointer/wheel 1:1 with no lag), but a DISCRETE, programmatic
  // descent-fit reads better with a brief eased transition -- so this class
  // is applied only for the short window around that one transition, timed
  // to the CSS duration, then removed (CSS itself no-ops the transition
  // under prefers-reduced-motion, so this class is inert there too).
  const [autoFitAnimating, setAutoFitAnimating] = useState(false)
  useEffect(() => {
    if (!autoFitAnimating) return undefined
    const id = window.setTimeout(() => setAutoFitAnimating(false), 200)
    return () => window.clearTimeout(id)
  }, [autoFitAnimating])

  // initial fit once the viewport is measured; refit when the visible set changes.
  const visKey = useMemo(() => positioned.map((p) => p.node.id).join('|'), [positioned])
  const viewportOwnershipKey = hasCanonicalViewport
    ? `canonical|${viewport.scale}|${finiteNumber(viewport.panX, 0)}|${finiteNumber(viewport.panY, 0)}`
    : canonicalControlled ? 'canonical|auto-fit' : 'legacy'
  const prevExpandedForFitRef = useRef(expanded)
  useEffect(() => {
    const prevExpanded = prevExpandedForFitRef.current
    prevExpandedForFitRef.current = expanded
    if (preserveRestoredViewport.current) {
      preserveRestoredViewport.current = false
      didInitFit.current = true
      return
    }
    if (!didInitFit.current) {
      didInitFit.current = true
      // Publish when a canonical viewport is ALREADY established (so this
      // fit can actually override it -- see the note below the fallback
      // fit() call for why an unpublished fit is otherwise a silent no-op
      // in canonical mode); the very first fit before any viewport exists
      // stays local/unpublished, matching the pre-existing behavior.
      fit(hasCanonicalViewport)
      return
    }
    // Prefer a fit scoped to the just-opened folder's own subtree over the
    // default whole-graph fit -- descending into one folder should not yank
    // the camera out to reframe the entire map, which is disorienting and
    // gives no sense of where the newly-revealed content actually is. Any
    // OTHER visible-set change (a collapse, a grain change, a filter) keeps
    // the prior whole-graph fit.
    let newlyOpened = null
    for (const id of expanded) {
      if (!prevExpanded.has(id)) { newlyOpened = id; break }
    }
    if (newlyOpened) {
      const descendantIds = new Set([newlyOpened])
      const stack = [newlyOpened]
      while (stack.length > 0) {
        const cur = stack.pop()
        for (const child of tree.children.get(cur) ?? []) {
          descendantIds.add(child.id)
          stack.push(child.id)
        }
      }
      const scoped = [...descendantIds].filter((id) => visibleIds.has(id))
      setAutoFitAnimating(true)
      if (scoped.length > 0 && fitToIds(new Set(scoped), true)) return
    }
    // Same publish rule as above: once a canonical viewport exists (e.g. the
    // scoped descent-fit above already established one, or the user has
    // manually panned/zoomed), a plain unpublished fit() only updates LOCAL
    // scale/pan state that canonical mode never reads for rendering --
    // `scale`/`pan` prefer the canonical `viewport` prop whenever
    // hasCanonicalViewport is true, so the recomputed fit would be silently
    // dropped and the stage would visibly stay frozen at the stale
    // transform. Found via real-app verification: collapsing a folder back
    // out via the breadcrumb left the canvas zoomed into the now-closed
    // folder's old scoped-fit framing instead of reframing the wider view.
    fit(hasCanonicalViewport)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visKey, viewportOwnershipKey])

  /* ----- zoom about the viewport centre (so +/- feel anchored) ----- */
  const zoomBy = useCallback((factor) => {
    const vp = viewportRef.current
    const cx = vp ? vp.clientWidth / 2 : 0
    const cy = vp ? vp.clientHeight / 2 : 0
    const prev = scaleRef.current
    const next = Math.max(CODE_MAP_VIEWPORT_SCALE.min, Math.min(CODE_MAP_VIEWPORT_SCALE.max, prev * factor))
    if (next === prev) return
    const p = panRef.current
    // keep the viewport-centre point fixed under the scale change.
    applyViewport({
      scale: next,
      panX: cx - ((cx - p.x) / prev) * next,
      panY: cy - ((cy - p.y) / prev) * next,
    }, true)
  }, [applyViewport])

  /* ----- modifier-gated wheel/trackpad-pinch zoom, anchored under the cursor -----
     A PLAIN wheel is never hijacked (no preventDefault, no handling at all) so the
     page keeps scrolling normally when the canvas happens to be under the cursor.
     Only ctrl/cmd+wheel zooms -- the same signal browsers already use for
     trackpad pinch-zoom (a two-finger pinch fires wheel events with ctrlKey=true
     even without a physical Ctrl key held), so this also covers pinch for free. */
  const onWheel = useCallback((e) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const prev = scaleRef.current
    // continuous, deltaY-proportional zoom (negative deltaY = zoom in), clamped
    // to at most one ZOOM_STEP per event so a single fast wheel/pinch burst can't
    // jump past a sane per-tick step.
    const rawFactor = Math.exp(-e.deltaY * 0.01)
    const factor = Math.max(1 / ZOOM_STEP, Math.min(ZOOM_STEP, rawFactor))
    const next = Math.max(CODE_MAP_VIEWPORT_SCALE.min, Math.min(CODE_MAP_VIEWPORT_SCALE.max, prev * factor))
    if (next === prev) return
    const p = panRef.current
    applyViewport({
      scale: next,
      panX: cx - ((cx - p.x) / prev) * next,
      panY: cy - ((cy - p.y) / prev) * next,
    }, true)
  }, [applyViewport])

  // React's synthetic onWheel is registered PASSIVE by default (the same
  // browser optimization that makes touchstart/touchmove passive), so
  // e.preventDefault() inside a React onWheel prop silently no-ops in a real
  // browser — Chrome logs "Unable to preventDefault inside passive event
  // listener invocation" and, worse, the browser's OWN native ctrl/cmd+wheel
  // page-zoom fires at the same time as our canvas zoom (found via real-app
  // verification, not caught by a jsdom-only unit test). A native listener
  // attached with { passive: false } is required to actually block it.
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return undefined
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [onWheel])

  /* ----- centre + select a node (search jump, also used after a grain change) ----- */
  const focusNode = useCallback(
    (id) => {
      const p = posById.get(id)
      const vp = viewportRef.current
      if (!p || !vp) return
      const s = Math.max(scale, 1) // don't zoom out to reveal; nudge in if tiny
      applyViewport({
        scale: s,
        panX: vp.clientWidth / 2 - (p.x + p.w / 2) * s,
        panY: vp.clientHeight / 2 - (p.y + p.h / 2) * s,
      }, true)
    },
    [applyViewport, posById, scale]
  )

  /* ----- selection ----- */
  const select = useCallback(
    (id) => {
      if (canonicalControlled && id === selectedId) return
      if (!canonicalControlled) setLocalSelectedId(id)
      onStateAction?.(id ? { type: 'select', id } : { type: 'clear-selection' })
      const node = id ? tree.byId.get(id) : null
      onSelect?.(id, node ? stripInternal(node) : null)
    },
    [canonicalControlled, onSelect, onStateAction, selectedId, tree.byId]
  )

  /* ----- grain change: reset per-node expansions (the base depth changes) ----- */
  const changeGrain = useCallback((id) => {
    if (!canonicalControlled) {
      setLocalGrain(id)
      setLocalExpanded(new Set())
    }
    onStateAction?.({ type: 'set-grain', grain: CANVAS_GRAIN_TO_STATE_GRAIN[id] })
    onGrainChange?.(id)
    if (!canonicalControlled) onExpandedIdsChange?.([])
  }, [canonicalControlled, onExpandedIdsChange, onGrainChange, onStateAction])

  // "Where am I" state for the breadcrumb strip + aria-live descent
  // announcement: the most recently OPENED folder id (not a stack -- if its
  // ancestor collapses independently, or it collapses itself, this walks up
  // to the nearest still-expanded ancestor, or clears to the root).
  const [lastOpenedId, setLastOpenedId] = useState(null)
  const [descentAnnounce, setDescentAnnounce] = useState('')
  // Guards against staleness from ANY external expandedIds change that
  // didn't go through toggleExpand/collapseToBreadcrumb below (a grain
  // change, a `reveal` action, a caller-supplied expandedIds prop) -- if the
  // tracked id is no longer actually expanded, it can no longer anchor a
  // breadcrumb.
  useEffect(() => {
    if (lastOpenedId && !expanded.has(lastOpenedId)) setLastOpenedId(null)
  }, [lastOpenedId, expanded])

  /* ----- expand a folder in place (double-click / E / shift+enter) ----- */
  const toggleExpand = useCallback(
    (id) => {
      if ((childCount.get(id) || 0) === 0) return
      const node = tree.byId.get(id)
      const next = new Set(expanded)
      if (next.has(id)) {
        next.delete(id)
        setLastOpenedId((prev) => {
          if (prev !== id) return prev
          const parent = tree.parentIdByChild.get(id) ?? null
          return parent && next.has(parent) ? parent : null
        })
        setDescentAnnounce(`closed ${leaf(node?.label || id)}`)
      } else {
        next.add(id)
        onExpand?.(id)
        setLastOpenedId(id)
        const count = childCount.get(id) || 0
        setDescentAnnounce(`opened ${leaf(node?.label || id)}, showing ${count} item${count === 1 ? '' : 's'}`)
      }
      if (!canonicalControlled) setLocalExpanded(next)
      onStateAction?.({ type: 'set-expanded', ids: Array.from(next) })
      onExpandedIdsChange?.(Array.from(next))
    },
    [canonicalControlled, childCount, expanded, onExpand, onExpandedIdsChange, onStateAction, tree.byId, tree.parentIdByChild]
  )

  /* ----- breadcrumb: the ancestor chain of the currently-drilled-into folder ----- */
  const breadcrumb = useMemo(() => {
    if (!lastOpenedId) return []
    const chain = []
    let cursor = lastOpenedId
    while (cursor) {
      const node = tree.byId.get(cursor)
      if (!node) break
      chain.unshift(node)
      cursor = tree.parentIdByChild.get(cursor) ?? null
    }
    return chain
  }, [lastOpenedId, tree])

  const collapseToRoot = useCallback(() => {
    if (!canonicalControlled) setLocalExpanded(new Set())
    onStateAction?.({ type: 'set-expanded', ids: [] })
    onExpandedIdsChange?.([])
    setLastOpenedId(null)
    setDescentAnnounce('back to the top level')
  }, [canonicalControlled, onExpandedIdsChange, onStateAction])

  const collapseToBreadcrumb = useCallback((index) => {
    const kept = breadcrumb.slice(0, index + 1)
    const ids = kept.map((n) => n.id)
    const next = new Set(ids)
    if (!canonicalControlled) setLocalExpanded(next)
    onStateAction?.({ type: 'set-expanded', ids })
    onExpandedIdsChange?.(ids)
    const landedOn = kept[kept.length - 1] ?? null
    setLastOpenedId(landedOn?.id ?? null)
    setDescentAnnounce(landedOn ? `back to ${leaf(landedOn.label || landedOn.id)}` : 'back to the top level')
  }, [breadcrumb, canonicalControlled, onExpandedIdsChange, onStateAction])

  /* ----- keyboard model on the application wrapper ----- */
  const onKeyDown = useCallback(
    (e) => {
      const key = e.key
      // zoom keys: +/- (and =); a plain wheel still just scrolls the page (see onWheel).
      if (key === '+' || key === '=') {
        e.preventDefault()
        zoomBy(ZOOM_STEP)
        return
      }
      if (key === '-' || key === '_') {
        e.preventDefault()
        zoomBy(1 / ZOOM_STEP)
        return
      }
      if (key === '0') {
        e.preventDefault()
        fit(true)
        return
      }
      const isArrow =
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        key === 'ArrowUp' ||
        key === 'ArrowDown'
      if (isArrow) {
        e.preventDefault()
        const cur = focusedId ? posById.get(focusedId) : undefined
        if (!cur) {
          const first = firstInReading(positioned)
          if (first) setFocusedId(first.node.id)
          return
        }
        let next
        if (key === 'ArrowLeft') next = rowSibling(positioned, cur, -1)
        else if (key === 'ArrowRight') next = rowSibling(positioned, cur, 1)
        else if (key === 'ArrowUp') next = nearestAcrossRows(positioned, cur, -1)
        else next = nearestAcrossRows(positioned, cur, 1)
        if (next) {
          setFocusedId(next.node.id)
          ensureInView(next, viewportRef.current, scale, pan, (nextPan) => {
            applyViewport({ scale, panX: nextPan.x, panY: nextPan.y }, true)
          })
        }
        return
      }
      if (key === 'Enter') {
        if (!focusedId) return
        e.preventDefault()
        if (e.shiftKey) toggleExpand(focusedId)
        else if (canonicalControlled) {
          if (selectedId !== focusedId) select(focusedId)
        } else select(selectedId === focusedId ? null : focusedId)
        return
      }
      if (key === 'e' || key === 'E') {
        if (!focusedId) return
        e.preventDefault()
        toggleExpand(focusedId)
        return
      }
      if (key === 'Escape') {
        if (selectedId) {
          e.preventDefault()
          select(null)
        }
      }
    },
    [
      focusedId,
      positioned,
      posById,
      selectedId,
      scale,
      pan,
      canonicalControlled,
      applyViewport,
      zoomBy,
      fit,
      toggleExpand,
      select,
    ]
  )

  /* ----- pan via pointer drag on the canvas background ----- */
  // Shared "abort and release state" path for pointercancel AND
  // lostpointercapture (see onLostPointerCapture below for why the latter
  // exists): clears the drag ref, best-effort releases pointer capture (a
  // no-op if capture is already gone — which it always is by the time
  // lostpointercapture fires — so this must never throw on a stale
  // release), and drops any held canonicalControlled preview WITHOUT
  // committing a proposal. Not a "release" — a discard.
  const abortDrag = useCallback((pointerId) => {
    const d = dragRef.current
    if (!d || pointerId !== d.pointerId) return
    dragRef.current = null
    const vp = viewportRef.current
    try { vp?.releasePointerCapture?.(pointerId) } catch { /* already released — expected for lostpointercapture */ }
    if (canonicalControlled) setDragPreview(null)
  }, [canonicalControlled])
  const onPointerDown = useCallback(
    (e) => {
      // only the canvas surface pans; nodes/controls handle their own pointers.
      if (e.button !== 0) return
      // A pointer born on an interactive control must never be captured:
      // setPointerCapture retargets the following pointerup to the viewport,
      // so the browser composes NO click on the control — the zoom cluster
      // was rendered, styled, wired … and unclickable.
      if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea')) return
      // Single-pointer only, by design (a mouse-driven code map, not a
      // multi-touch gesture surface): a SECOND pointer going down while one
      // drag is already active must not hijack it. Ignoring it outright
      // (rather than tracking a second concurrent drag) is the minimal fix —
      // this is not multi-touch gesture support, just a guard against a
      // silent rebase onto whichever pointer fired last.
      //
      // BUT that guard must never be permanent: if the pointer that started
      // a drag never delivers pointerup/pointercancel/lostpointercapture —
      // every real-world path is covered below, but defense in depth costs
      // little here — a stale drag older than DRAG_STALE_TIMEOUT_MS is
      // abandoned and this new pointer takes over, so no dropped-event
      // sequence can wedge the canvas permanently.
      if (dragRef.current) {
        if (Date.now() - dragRef.current.startedAt < DRAG_STALE_TIMEOUT_MS) return
        abortDrag(dragRef.current.pointerId)
      }
      const vp = viewportRef.current
      if (vp) vp.setPointerCapture?.(e.pointerId)
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
        moved: false,
        nextPan: null,
        startedAt: Date.now(),
      }
    },
    [pan, abortDrag]
  )
  const onPointerMove = useCallback((e) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    if (d.moved) {
      d.nextPan = {
        scale: scaleRef.current,
        panX: d.panX + dx,
        panY: d.panY + dy,
      }
      if (canonicalControlled) {
        // Local-first: track the pointer every frame so the drag feels
        // smooth. The owner still only gets ONE proposal, on release.
        setDragPreview(d.nextPan)
      } else {
        applyViewport(d.nextPan, true)
      }
    }
  }, [applyViewport, canonicalControlled])
  const onPointerUp = useCallback(
    (e) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      dragRef.current = null
      const vp = viewportRef.current
      try { vp?.releasePointerCapture?.(e.pointerId) } catch { /* ignore — already released */ }
      // dragPreview is intentionally NOT cleared here: the reconciliation
      // effect above releases it once the owner's `viewport` prop reflects
      // this proposal (or after DRAG_RECONCILE_TIMEOUT_MS if it never does),
      // so a slow-but-eventually-consistent owner doesn't see the gesture
      // snap back before it's had a chance to catch up.
      if (d.moved && canonicalControlled && d.nextPan) {
        applyViewport(d.nextPan, true)
        // Force a fresh dragPreview object (same values, new reference) so
        // the reconcile-or-timeout effect — gated on dragRef.current being
        // null, which it now is — actually reruns and arms its window HERE,
        // at true release. Without this, the last onPointerMove's dragPreview
        // reference is unchanged by release alone, so the effect wouldn't
        // rerun until some OTHER dependency changed (e.g. the owner's
        // viewport prop), which a non-reconciling owner never does — pinning
        // the preview forever instead of falling back after the timeout.
        setDragPreview({ ...d.nextPan })
      }
      // a clean click (no drag) on the empty pane clears the selection.
      if (!d.moved && e.target === e.currentTarget) select(null)
    },
    [applyViewport, canonicalControlled, select]
  )
  // pointercancel is an ABORT, not a release: the browser is telling us this
  // pointer's gesture is no longer valid (e.g. the OS took over for a
  // system gesture) — the correct response is to drop the drag WITHOUT
  // committing whatever partial pan it had reached, unlike onPointerUp which
  // commits a real release. Local-only, non-canonical dragging also just
  // discards its in-progress (uncommitted-until-move) local state the same
  // way onPointerMove drove it: nothing further to revert there since each
  // move already applied directly.
  const onPointerCancel = useCallback((e) => abortDrag(e.pointerId), [abortDrag])
  // lostpointercapture is the browser's OWN safety net, fired reliably per
  // spec whenever a captured pointer's capture is released — explicitly (our
  // own releasePointerCapture calls above) OR implicitly (focus loss, the
  // element being removed, the OS taking the pointer over for a system
  // gesture, a disconnected device, or any other reason a pointerup/
  // pointercancel never arrives). Wiring it to the SAME abort path as
  // pointercancel is what actually closes the "single un-keyed drag ref"
  // guard's escape hatch: without this, a lost release event would leave
  // dragRef populated forever and onPointerDown's single-pointer guard would
  // then silently ignore every future pointerdown — a permanent lockup, not
  // just a missed reconciliation. (The DRAG_STALE_TIMEOUT_MS check in
  // onPointerDown is deliberately redundant with this — belt and braces so
  // no sequence of dropped events, however unlikely, can wedge the canvas.)
  const onLostPointerCapture = useCallback((e) => abortDrag(e.pointerId), [abortDrag])

  /* ----- the focused node's spoken label (identity + coverage + violations) ----- */
  const focusedAnnounce = useMemo(() => {
    if (!focusedId) return ''
    const n = tree.byId.get(focusedId)
    if (!n) return ''
    return nodeAriaLabel(n, {
      selected: selectedId === focusedId,
      expanded: expanded.has(focusedId),
      violations: violationCounts.get(focusedId) || 0,
    })
  }, [focusedId, tree.byId, selectedId, expanded, violationCounts])

  /* ----- minimap geometry: the viewport rect projected over the graph bbox ----- */
  const minimap = useMemo(() => {
    const vp = viewportRef.current
    if (!vp || graphW <= 0 || graphH <= 0) return null
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    // the slice of graph-space currently framed (invert the group transform).
    const viewX = -pan.x / scale
    const viewY = -pan.y / scale
    const viewW = vw / scale
    const viewH = vh / scale
    return { graphW, graphH, viewX, viewY, viewW, viewH }
  }, [pan, scale, graphW, graphH])

  const empty = positioned.length === 0
  const segId = (g) => `${baseId}-grain-${g}`

  return (
    <div
      className={['mc', className].filter(Boolean).join(' ')}
      style={{ height }}
      role="application"
      aria-label={ariaLabel}
      aria-roledescription="code structure map"
    >
      {/* visually-hidden live region: announces the roving-focus node. */}
      <div id={liveId} className="mc-sr" role="status" aria-live="polite">
        {focusedAnnounce}
      </div>

      {/* ---- toolbar: grain segmented control + node search combobox ---- */}
      <div className="mc-toolbar">
        <div
          className="mc-seg"
          role="radiogroup"
          aria-label="detail grain"
        >
          {GRAINS.map((g) => (
            <button
              key={g.id}
              id={segId(g.id)}
              type="button"
              role="radio"
              aria-checked={grain === g.id}
              className="mc-seg-btn mono"
              data-active={grain === g.id ? 'true' : undefined}
              onClick={() => changeGrain(g.id)}
            >
              {grain === g.id && <Check className="lucide" aria-hidden="true" />}
              {g.label}
            </button>
          ))}
        </div>

        <div
          className="mc-search"
          role="combobox"
          aria-expanded={searchOpen && matches.length > 0}
          aria-haspopup="listbox"
          aria-owns={listId}
        >
          <Search className="lucide mc-search-ico" aria-hidden="true" />
          <input
            className="mc-search-input mono"
            type="text"
            placeholder="find a node"
            aria-label="find a node"
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => {
              // delay so a click on a result lands before the list unmounts.
              window.setTimeout(() => setSearchOpen(false), 120)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) {
                e.preventDefault()
                jumpTo(matches[0])
              } else if (e.key === 'Escape') {
                setSearchOpen(false)
              }
            }}
          />
          {searchOpen && matches.length > 0 && (
            <ul className="mc-results" id={listId} role="listbox" aria-label="search results">
              {matches.map((m) => (
                <li
                  key={m.id}
                  role="option"
                  aria-selected={m.id === selectedId}
                  className="mc-result mono"
                  // onMouseDown (not click): fire before the input's blur.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    jumpTo(m)
                  }}
                >
                  {m.kind === 'folder' ? (
                    <Folder className="lucide" aria-hidden="true" />
                  ) : (
                    <FileCode className="lucide" aria-hidden="true" />
                  )}
                  <span className="mc-result-path">{m.id}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* visually-hidden live region: announces folder open/close, distinct
          from the roving-focus announcement above so "what changed" (a
          discrete event) never gets lost inside "what's focused" (ambient
          state that updates on every arrow-key move). */}
      <div className="mc-sr" role="status" aria-live="polite">
        {descentAnnounce}
      </div>

      {/* ---- breadcrumb: "where am I" feedback for the folder you've drilled
          into on the canvas -- each crumb is clickable to collapse back up
          to that level. Only rendered once something is expanded; the
          navigator-first browse view is unaffected (this lives in the
          canvas only). ---- */}
      {breadcrumb.length > 0 && (
        <nav className="mc-breadcrumb mono" aria-label="folder path">
          <button type="button" className="mc-breadcrumb-crumb" onClick={collapseToRoot}>
            top level
          </button>
          {breadcrumb.map((node, index) => (
            <Fragment key={node.id}>
              <ChevronRight className="lucide mc-breadcrumb-sep" aria-hidden="true" />
              {index === breadcrumb.length - 1 ? (
                <span className="mc-breadcrumb-crumb mc-breadcrumb-current" aria-current="location">
                  {leaf(node.label || node.id)}
                </span>
              ) : (
                <button type="button" className="mc-breadcrumb-crumb" onClick={() => collapseToBreadcrumb(index)}>
                  {leaf(node.label || node.id)}
                </button>
              )}
            </Fragment>
          ))}
        </nav>
      )}

      {/* ---- the canvas viewport (dot-grid bg, pannable, focusable app surface) ---- */}
      <div
        className="mc-viewport"
        ref={viewportRef}
        tabIndex={0}
        role="group"
        aria-label="map canvas: arrow keys move focus, enter selects, plus and minus zoom, ctrl or cmd plus wheel to zoom"
        aria-activedescendant={
          focusedId && visibleIds.has(focusedId) ? `${baseId}-node-${cssId(focusedId)}` : undefined
        }
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
      >
        {empty ? (
          <p className="mc-empty mono">no nodes to map</p>
        ) : (
          <>
            {/* the transformed stage: a single translate+scale over the fixed
                graph-space coordinates, so edges + nodes share one coordinate frame. */}
            <div
              className={['mc-stage', autoFitAnimating ? 'mc-stage--auto-fit' : ''].filter(Boolean).join(' ')}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                width: graphW,
                height: graphH,
              }}
            >
              {/* edges: one SVG sized to the graph bbox; orthogonal (90°) routing. */}
              <svg
                className="mc-edges"
                width={graphW}
                height={graphH}
                viewBox={`0 0 ${graphW} ${graphH}`}
                aria-hidden="true"
              >
                {liftedEdges.map((e) => {
                  const a = posById.get(e.from)
                  const b = posById.get(e.to)
                  if (!a || !b) return null
                  const delta = edgeDeltas[edgeKey(e.from, e.to)] ?? edgeDeltas[edgeKey(e.from, e.to, 'arrow')]
                  return (
                    <Edge
                      key={`${e.kind}:${e.from}->${e.to}`}
                      a={a}
                      b={b}
                      kind={e.kind}
                      weight={e.weight}
                      maxWeight={maxWeight}
                      delta={delta}
                    />
                  )
                })}
              </svg>

              {/* nodes */}
              {positioned.map((p) => {
                const expandable = (childCount.get(p.node.id) || 0) > 0
                const isExpanded = expanded.has(p.node.id)
                return (
                  <Fragment key={p.node.id}>
                    <Node
                      domId={`${baseId}-node-${cssId(p.node.id)}`}
                      p={p}
                      selected={selectedId === p.node.id}
                      focused={focusedId === p.node.id}
                      highlighted={highlightedVisibleIds.has(p.node.id)}
                      delta={nodeDeltas[p.node.id]}
                      expandable={expandable}
                      expanded={isExpanded}
                      violations={violationCounts.get(p.node.id) || 0}
                      onClick={(detail) => {
                        if (detail >= 2) return
                        setFocusedId(p.node.id)
                        if (canonicalControlled) {
                          if (selectedId !== p.node.id) select(p.node.id)
                        } else select(selectedId === p.node.id ? null : p.node.id)
                      }}
                      onDoubleClick={() => {
                        if (expandable) toggleExpand(p.node.id)
                      }}
                    />
                    {expandable ? (
                      <button
                        type="button"
                        className="mc-node-disclosure"
                        aria-label={`${isExpanded ? 'hide' : 'show'} children for ${leaf(p.node.label || p.node.id)}`}
                        aria-expanded={isExpanded}
                        style={{ left: p.x + p.w, top: p.y + p.h }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleExpand(p.node.id)
                        }}
                      >
                        <ChevronRight aria-hidden="true" />
                      </button>
                    ) : null}
                  </Fragment>
                )
              })}
            </div>

            {/* ---- on-canvas square zoom controls ---- */}
            <div className="mc-zoom" role="group" aria-label="map zoom">
              <button type="button" className="mc-zoom-btn" aria-label="zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
                <Plus className="lucide" aria-hidden="true" />
              </button>
              <button type="button" className="mc-zoom-btn" aria-label="zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>
                <Minus className="lucide" aria-hidden="true" />
              </button>
              <button type="button" className="mc-zoom-btn" aria-label="fit map to view" onClick={() => fit(true)}>
                <Maximize className="lucide" aria-hidden="true" />
              </button>
            </div>

            {/* ---- minimap: a scaled overview with the viewport rectangle ---- */}
            {minimap && (
              <div className="mc-minimap" aria-hidden="true">
                <svg
                  className="mc-minimap-svg"
                  viewBox={`0 0 ${minimap.graphW} ${minimap.graphH}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {positioned.map((p) => (
                    <rect
                      key={p.node.id}
                      className="mc-mini-node"
                      data-cov={clampCoverage(p.node.coverage)}
                      x={p.x}
                      y={p.y}
                      width={p.w}
                      height={p.h}
                    />
                  ))}
                  <rect
                    className="mc-mini-view"
                    x={minimap.viewX}
                    y={minimap.viewY}
                    width={minimap.viewW}
                    height={minimap.viewH}
                  />
                </svg>
              </div>
            )}

            {/* ---- legend: keeps the four channels self-describing, text-only ---- */}
            <div className="mc-legend mono" aria-hidden="true">
              <span className="mc-legend-item">
                <Folder className="lucide" /> folder
              </span>
              <span className="mc-legend-item">
                <FileCode className="lucide" /> file
              </span>
              <span className="mc-legend-item mc-legend-ramp">
                <span className="mc-ramp-sw" data-cov="0" />
                <span className="mc-ramp-sw" data-cov="1" />
                <span className="mc-ramp-sw" data-cov="2" />
                <span className="mc-ramp-sw" data-cov="3" />
                <span className="mc-ramp-sw" data-cov="4" />
                coverage
              </span>
              <span className="mc-legend-item mc-legend-viol">
                <TriangleAlert className="lucide" /> violation
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )

  /* search-result jump: open the matched node's ancestors, select + centre it. */
  function jumpTo(node) {
    // Every grain now caps at the SAME base depth and reaches deeper only
    // through explicit expansion (see GRAIN_DEPTH above), so switching grain
    // is no longer what makes a buried file visible -- the ancestor-expansion
    // loop below does that unconditionally, at any grain. Flipping to
    // 'files' grain here is purely a UX preference: landing on a file result
    // while browsing at folders/overview grain switches the toolbar to the
    // file-oriented vocabulary for whatever comes next.
    const targetGrain = node.kind === 'file' && grain !== 'files' ? 'files' : grain
    // expand the node's ancestors so it (or its visible ancestor) is on-canvas.
    const nextExpanded = new Set(targetGrain !== grain ? [] : expanded)
    let cur = tree.parentIdByChild.get(node.id)
    while (cur && tree.byId.has(cur)) {
      if (!nextExpanded.has(cur)) {
        nextExpanded.add(cur)
        onExpand?.(cur)
      }
      cur = tree.parentIdByChild.get(cur)
    }
    const expandedList = Array.from(nextExpanded)
    if (!canonicalControlled) {
      setLocalGrain(targetGrain)
      setLocalExpanded(nextExpanded)
    }
    onStateAction?.({
      type: 'reveal',
      id: node.id,
      grain: CANVAS_GRAIN_TO_STATE_GRAIN[targetGrain],
      expandedIds: expandedList,
    })
    if (targetGrain !== grain) onGrainChange?.(targetGrain)
    onExpandedIdsChange?.(expandedList)
    setQuery('')
    setSearchOpen(false)
    setFocusedId(node.id)
    if (!canonicalControlled) setLocalSelectedId(node.id)
    onSelect?.(node.id, stripInternal(node))
    // centre after layout settles (grain/expansion just changed the positions).
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => focusNode(node.id))
    })
  }
}

/* drop the internal _order key before handing a node back to onSelect. */
function stripInternal(node) {
  const { _order, ...rest } = node
  void _order
  return rest
}

function toIdSet(ids) {
  if (!ids) return new Set()
  return ids instanceof Set ? new Set(ids) : new Set(Array.from(ids))
}

function validScale(value) {
  return isCodeMapViewportScale(value)
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

function idsKey(ids) {
  if (!ids) return ''
  return Array.from(ids).map(String).sort().join('\u0000')
}

function edgeKey(from, to, style = 'plain') {
  return style === 'arrow' ? `${from}->${to}` : `${from}→${to}`
}

/* sanitize an id into a css/dom-safe token for the node element id. */
function cssId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_')
}

/* the node's accessible name: identity + coverage, then violations + state. shared by
   the node's aria-label and the live-region announcement so the two never drift.
   (peasant/mapNodeAriaLabel.) */
function nodeAriaLabel(node, state = {}) {
  const { selected, expanded, violations = 0 } = state
  const cov = clampCoverage(node.coverage)
  let label = `${leaf(node.label || node.id)}: ${node.kind} · coverage ${cov} of 4`
  if (node.loc) label += ` · ${node.loc} loc`
  if (violations > 0) label += ` · ${violations} violation${violations === 1 ? '' : 's'}`
  if (selected) label += ' · selected'
  if (expanded) label += ' · expanded'
  return label
}

/* nudge the pan so a node sits inside the viewport (used after keyboard moves). */
function ensureInView(p, vp, scale, pan, setPan) {
  if (!vp) return
  const left = p.x * scale + pan.x
  const top = p.y * scale + pan.y
  const right = (p.x + p.w) * scale + pan.x
  const bottom = (p.y + p.h) * scale + pan.y
  const m = 24 // keep a margin off the edge
  let dx = 0
  let dy = 0
  if (left < m) dx = m - left
  else if (right > vp.clientWidth - m) dx = vp.clientWidth - m - right
  if (top < m) dy = m - top
  else if (bottom > vp.clientHeight - m) dy = vp.clientHeight - m - bottom
  if (dx !== 0 || dy !== 0) setPan({ x: pan.x + dx, y: pan.y + dy })
}

/* ------------------------------------------------------------------ Node */
/* the square map node (peasant/MapSquareNode): hairline border, the monochrome
   coverage fill (the ONLY channel that moves the fill), a folder/file icon, mono
   counts, an amber selection outline + corner marker (never colour alone), and a clay
   violation badge with a count + glyph. */
function Node({
  domId,
  p,
  selected,
  focused,
  highlighted,
  delta,
  expandable,
  expanded,
  violations,
  onClick,
  onDoubleClick,
}) {
  const node = p.node
  const cov = clampCoverage(node.coverage)
  const inkFlip = cov >= INK_FLIPS_AT
  return (
    <button
      id={domId}
      type="button"
      className="mc-node"
      data-cov={cov}
      data-selected={selected ? 'true' : undefined}
      data-focused={focused ? 'true' : undefined}
      data-highlighted={highlighted ? 'true' : undefined}
      data-delta={delta || undefined}
      data-ink-flip={inkFlip ? 'true' : undefined}
      aria-label={nodeAriaLabel(node, { selected, expanded, violations })}
      aria-pressed={selected}
      aria-expanded={expandable ? expanded : undefined}
      style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
      // stop the pointerdown from starting a canvas pan.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick(e.detail)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onDoubleClick()
      }}
    >
      {/* selection marker: a small amber corner square — meaning is not colour-only,
          it's a discrete shape that appears, paired with the amber outline. */}
      {selected && <span className="mc-node-marker" aria-hidden="true" />}

      <span className="mc-node-head">
        {node.kind === 'folder' ? (
          <Folder className="lucide mc-node-ico" aria-hidden="true" />
        ) : (
          <FileCode className="lucide mc-node-ico" aria-hidden="true" />
        )}
        <span className="mc-node-name mono">{leaf(node.label || node.id)}</span>
        {violations > 0 && (
          <span className="mc-node-viol mono tnum" aria-hidden="true">
            <TriangleAlert className="lucide" aria-hidden="true" />
            {violations}
          </span>
        )}
      </span>

      <span className="mc-node-meta mono tnum">
        {node.kind === 'folder' && expandable ? (expanded ? 'open' : 'folder') : 'file'}
        {node.loc ? ` · ${node.loc} loc` : ''}
        {` · cov ${cov}/4`}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ Edge */
/* a square orthogonal edge between two node rects. structure = solid hairline
   (--rule-strong), activity = dashed; stroke WIDTH scales with weight (never hue).
   routing: down out of `a`'s bottom edge, an L through the mid-band, into `b`'s top
   edge — three segments, all 90° joins, radius 0. (peasant/edges.tsx, plain SVG.) */
function Edge({ a, b, kind, weight, maxWeight, delta }) {
  const x1 = a.x + a.w / 2
  const y1 = a.y + a.h
  const x2 = b.x + b.w / 2
  const y2 = b.y
  // route through the vertical midpoint of the gap (square L). when the two nodes
  // sit on the same row the mid still produces a clean staple.
  const midY = (y1 + y2) / 2
  const d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
  // weight -> width: 1px..3px, mapped by the visible max so the heaviest reads clearly.
  const w = 1 + (Math.min(weight, maxWeight) / maxWeight) * 2
  return (
    <g className="mc-edge" data-kind={kind} data-delta={delta || undefined}>
      <path className="mc-edge-path" d={d} style={{ strokeWidth: w }} />
      {/* structure edges carry a square arrowhead at the target; activity is
          symmetric (co-work), so no marker. drawn as a path so it stays square. */}
      {kind === 'structure' && (
        <path className="mc-edge-head" d={`M ${x2 - 4} ${y2 - 6} L ${x2 + 4} ${y2 - 6} L ${x2} ${y2} Z`} />
      )}
    </g>
  )
}

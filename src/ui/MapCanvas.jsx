import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Folder,
  FileCode,
  Plus,
  Minus,
  Maximize,
  TriangleAlert,
  Search,
  Check,
} from 'lucide-react'
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
   controls or +/- keys (NEVER wheel — the page must keep scrolling over the canvas).
   full keyboard model: roving focus across nodes (arrows move, enter selects), an
   aria-live region naming the focused node + its coverage/violations. */

/* ------------------------------------------------------------------ geometry */
/* px constants, lifted from peasant/layout.ts. exposed shapes stay deterministic. */
const NODE_HEIGHT = 56
const MIN_NODE_WIDTH = 104
const MAX_NODE_WIDTH = 248
const ROW_HEIGHT = 132 // > NODE_HEIGHT so orthogonal edges have a routing band
const NODE_GAP = 28
const PADDING = 48 // breathing room around the laid-out graph, inside the viewBox

/* manual-zoom clamp (the inner-group scale). fit picks a scale inside this band. */
const MIN_SCALE = 0.35
const MAX_SCALE = 2.4
const ZOOM_STEP = 1.25 // multiplicative per +/- press

/* the three semantic-zoom grains. `depth` is the base tree depth rendered before any
   per-node expansion: overview shows only roots (folders), folders opens one level,
   files opens everything. (peasant's BASE_DEPTH, simplified to a flat folder/file
   tree.) */
const GRAINS = [
  { id: 'overview', label: 'overview', depth: 0 },
  { id: 'folders', label: 'folders', depth: 1 },
  { id: 'files', label: 'files', depth: Infinity },
]
const GRAIN_DEPTH = { overview: 0, folders: 1, files: Infinity }

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

/* index nodes by id, children by parent (sorted), roots (sorted). `_order` is a
   stable index assigned from input order so siblings keep a deterministic layout. */
function buildTree(nodes) {
  const byId = new Map()
  nodes.forEach((n, i) => byId.set(n.id, { ...n, _order: i }))
  const children = new Map()
  const roots = []
  for (const n of byId.values()) {
    const parent = n.parent && byId.has(n.parent) ? n.parent : null
    if (parent) {
      const list = children.get(parent)
      if (list) list.push(n)
      else children.set(parent, [n])
    } else {
      roots.push(n)
    }
  }
  for (const list of children.values()) list.sort(compareOrder)
  roots.sort(compareOrder)
  return { byId, children, roots }
}

/* depth of every node from its root (roots = 0). used to lay rows out by depth so a
   subtree's files always sit a row below their folder. */
function depthOf(node, byId) {
  let d = 0
  let cur = node
  while (cur && cur.parent && byId.has(cur.parent)) {
    cur = byId.get(cur.parent)
    d += 1
  }
  return d
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
function layout(visible, byId) {
  if (visible.length === 0) return { positioned: [], width: 0, height: 0 }

  let maxLoc = 0
  for (const n of visible) maxLoc = Math.max(maxLoc, Math.max(0, Number(n.loc) || 0))
  const widthOf = (n) => {
    if (maxLoc <= 0) return MIN_NODE_WIDTH
    const ratio = Math.max(0, Number(n.loc) || 0) / maxLoc
    return Math.round(MIN_NODE_WIDTH + ratio * (MAX_NODE_WIDTH - MIN_NODE_WIDTH))
  }

  // group by depth (the row), sort within row by (order, id).
  const rows = new Map()
  for (const n of visible) {
    const d = depthOf(n, byId)
    const row = rows.get(d)
    if (row) row.push(n)
    else rows.set(d, [n])
  }
  const depths = Array.from(rows.keys()).sort((a, b) => a - b)
  for (const d of depths) rows.get(d).sort(compareOrder)

  const rowWidth = (row) =>
    row.reduce((s, n) => s + widthOf(n), 0) + NODE_GAP * (row.length - 1)
  let maxRowWidth = 0
  for (const d of depths) maxRowWidth = Math.max(maxRowWidth, rowWidth(rows.get(d)))

  const positioned = []
  depths.forEach((d, rowIndex) => {
    const row = rows.get(d)
    let x = PADDING + (maxRowWidth - rowWidth(row)) / 2
    const y = PADDING + rowIndex * ROW_HEIGHT
    for (const n of row) {
      const w = widthOf(n)
      positioned.push({ node: n, x, y, w, h: NODE_HEIGHT })
      x += w + NODE_GAP
    }
  })

  const width = maxRowWidth + PADDING * 2
  const height = (depths.length - 1) * ROW_HEIGHT + NODE_HEIGHT + PADDING * 2
  return { positioned, width, height }
}

/* ------------------------------------------------------------------ edge lift */
/* walk an id up its parent chain to the nearest VISIBLE ancestor (memoised). this is
   what makes collapsed coupling survive: a file->file edge under two collapsed
   folders becomes a folder->folder edge. (peasant/makeAncestorResolver.) */
function makeResolver(byId, visibleIds) {
  const memo = new Map()
  return (id) => {
    if (memo.has(id)) return memo.get(id)
    let cur = id
    while (cur !== undefined && cur !== null && !visibleIds.has(cur)) {
      const n = byId.get(cur)
      cur = n ? n.parent || null : null
    }
    memo.set(id, cur ?? null)
    return cur ?? null
  }
}

/* aggregate edges up to visible ancestor pairs, summing weight. intra-aggregate
   edges (both ends collapse into the same node) and unknown ends drop. deterministic
   order. (peasant/aggregateEdges.) */
function aggregateEdges(edges, byId, visibleIds) {
  const resolve = makeResolver(byId, visibleIds)
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
function aggregateViolations(nodes, byId, visibleIds) {
  const resolve = makeResolver(byId, visibleIds)
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
 * +/- keys, never wheel), semantic zoom (overview / folders / files) with edge
 * ancestor-lifting, a minimap, and a node search combobox. Square metric-encoded
 * nodes (width ∝ LOC, monochrome coverage fill, folder/file icon, amber selection +
 * marker, clay violation badge) and square orthogonal edges (solid structure /
 * dashed activity, width ∝ weight). Full roving-focus keyboard nav with an aria-live
 * region. Pure: no data fetching, deterministic layout.
 *
 * @param {Object} props
 * @param {{nodes: MapNode[], edges?: MapEdge[]}} [props.data]   the graph
 * @param {'overview'|'folders'|'files'} [props.grain='folders'] initial semantic zoom
 * @param {string} [props.selectedId]                            initial selection
 * @param {(id:string|null, node:MapNode|null)=>void} [props.onSelect]  selection cb
 * @param {number} [props.height=520]                            canvas height (px)
 * @param {string} [props.ariaLabel='code map']                  application label
 * @param {string} [props.className]                             extra container class
 */
export default function MapCanvas({
  data = { nodes: [], edges: [] },
  grain: initialGrain = 'folders',
  selectedId: initialSelected = null,
  onSelect,
  height = 520,
  ariaLabel = 'code map',
  className = '',
}) {
  const nodes = data?.nodes ?? []
  const edges = data?.edges ?? []

  const baseId = useId().replace(/[:]/g, '')
  const liveId = `${baseId}-live`
  const listId = `${baseId}-list`

  /* ----- view state ----- */
  const [grain, setGrain] = useState(
    GRAIN_DEPTH[initialGrain] !== undefined ? initialGrain : 'folders'
  )
  const [expanded, setExpanded] = useState(() => new Set())
  const [selectedId, setSelectedId] = useState(initialSelected)
  const [focusedId, setFocusedId] = useState(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 }) // translate of the inner group, px
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const viewportRef = useRef(null)
  const dragRef = useRef(null) // { startX, startY, panX, panY, moved }
  const didInitFit = useRef(false)
  // live mirrors of scale/pan so callbacks can read the latest values without a
  // nested-setState (calling setPan inside a setScale updater warns in StrictMode).
  const scaleRef = useRef(scale)
  const panRef = useRef(pan)
  scaleRef.current = scale
  panRef.current = pan

  /* ----- derived: tree, visible set, layout, edges, violations ----- */
  const tree = useMemo(() => buildTree(nodes), [nodes])

  const visible = useMemo(
    () => visibleNodes(tree, GRAIN_DEPTH[grain], expanded),
    [tree, grain, expanded]
  )
  const visibleIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible])

  const { positioned, width: graphW, height: graphH } = useMemo(
    () => layout(visible, tree.byId),
    [visible, tree.byId]
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
    () => aggregateEdges(edges, tree.byId, visibleIds),
    [edges, tree.byId, visibleIds]
  )
  const maxWeight = useMemo(
    () => liftedEdges.reduce((m, e) => Math.max(m, e.weight), 1),
    [liftedEdges]
  )
  const violationCounts = useMemo(
    () => aggregateViolations(nodes, tree.byId, visibleIds),
    [nodes, tree.byId, visibleIds]
  )

  /* ----- search matches (a path-substring combobox) ----- */
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return nodes
      .filter((n) => n.id.toLowerCase().includes(q) || (n.label || '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [nodes, query])

  /* ----- fit: pick the scale + pan that frames the whole graph, clamped ----- */
  const fit = useCallback(() => {
    const vp = viewportRef.current
    if (!vp || graphW <= 0 || graphH <= 0) return
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    if (vw <= 0 || vh <= 0) return
    const raw = Math.min(vw / graphW, vh / graphH)
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, raw))
    setScale(next)
    setPan({ x: (vw - graphW * next) / 2, y: (vh - graphH * next) / 2 })
  }, [graphW, graphH])

  // initial fit once the viewport is measured; refit when the visible set changes.
  const visKey = useMemo(() => positioned.map((p) => p.node.id).join('|'), [positioned])
  useEffect(() => {
    if (!didInitFit.current) {
      didInitFit.current = true
      fit()
      return
    }
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visKey])

  /* ----- zoom about the viewport centre (so +/- feel anchored) ----- */
  const zoomBy = useCallback((factor) => {
    const vp = viewportRef.current
    const cx = vp ? vp.clientWidth / 2 : 0
    const cy = vp ? vp.clientHeight / 2 : 0
    const prev = scaleRef.current
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev * factor))
    if (next === prev) return
    const p = panRef.current
    // keep the viewport-centre point fixed under the scale change.
    setScale(next)
    setPan({
      x: cx - ((cx - p.x) / prev) * next,
      y: cy - ((cy - p.y) / prev) * next,
    })
  }, [])

  /* ----- centre + select a node (search jump, also used after a grain change) ----- */
  const focusNode = useCallback(
    (id) => {
      const p = posById.get(id)
      const vp = viewportRef.current
      if (!p || !vp) return
      const s = Math.max(scale, 1) // don't zoom out to reveal; nudge in if tiny
      setScale(s)
      setPan({
        x: vp.clientWidth / 2 - (p.x + p.w / 2) * s,
        y: vp.clientHeight / 2 - (p.y + p.h / 2) * s,
      })
    },
    [posById, scale]
  )

  /* ----- selection ----- */
  const select = useCallback(
    (id) => {
      setSelectedId(id)
      const node = id ? tree.byId.get(id) : null
      onSelect?.(id, node ? stripInternal(node) : null)
    },
    [onSelect, tree.byId]
  )

  /* ----- grain change: reset per-node expansions (the base depth changes) ----- */
  const changeGrain = useCallback((id) => {
    setGrain(id)
    setExpanded(new Set())
  }, [])

  /* ----- expand a folder in place (double-click / E / shift+enter) ----- */
  const toggleExpand = useCallback(
    (id) => {
      if ((childCount.get(id) || 0) === 0) return
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [childCount]
  )

  /* ----- keyboard model on the application wrapper ----- */
  const onKeyDown = useCallback(
    (e) => {
      const key = e.key
      // zoom keys: +/- (and =). never wheel — the page keeps scrolling.
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
        fit()
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
          ensureInView(next, viewportRef.current, scale, pan, setPan)
        }
        return
      }
      if (key === 'Enter') {
        if (!focusedId) return
        e.preventDefault()
        if (e.shiftKey) toggleExpand(focusedId)
        else select(selectedId === focusedId ? null : focusedId)
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
      zoomBy,
      fit,
      toggleExpand,
      select,
    ]
  )

  /* ----- pan via pointer drag on the canvas background ----- */
  const onPointerDown = useCallback(
    (e) => {
      // only the canvas surface pans; nodes/controls handle their own pointers.
      if (e.button !== 0) return
      const vp = viewportRef.current
      if (vp) vp.setPointerCapture?.(e.pointerId)
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
        moved: false,
      }
    },
    [pan]
  )
  const onPointerMove = useCallback((e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    if (d.moved) setPan({ x: d.panX + dx, y: d.panY + dy })
  }, [])
  const onPointerUp = useCallback(
    (e) => {
      const d = dragRef.current
      dragRef.current = null
      const vp = viewportRef.current
      if (vp) vp.releasePointerCapture?.(e.pointerId)
      // a clean click (no drag) on the empty pane clears the selection.
      if (d && !d.moved && e.target === e.currentTarget) select(null)
    },
    [select]
  )

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

      {/* ---- the canvas viewport (dot-grid bg, pannable, focusable app surface) ---- */}
      <div
        className="mc-viewport"
        ref={viewportRef}
        tabIndex={0}
        role="group"
        aria-label="map canvas: arrow keys move focus, enter selects, plus and minus zoom"
        aria-activedescendant={
          focusedId && visibleIds.has(focusedId) ? `${baseId}-node-${cssId(focusedId)}` : undefined
        }
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {empty ? (
          <p className="mc-empty mono">no nodes to map</p>
        ) : (
          <>
            {/* the transformed stage: a single translate+scale over the fixed
                graph-space coordinates, so edges + nodes share one coordinate frame. */}
            <div
              className="mc-stage"
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
                  return (
                    <Edge
                      key={`${e.kind}:${e.from}->${e.to}`}
                      a={a}
                      b={b}
                      kind={e.kind}
                      weight={e.weight}
                      maxWeight={maxWeight}
                    />
                  )
                })}
              </svg>

              {/* nodes */}
              {positioned.map((p) => (
                <Node
                  key={p.node.id}
                  domId={`${baseId}-node-${cssId(p.node.id)}`}
                  p={p}
                  selected={selectedId === p.node.id}
                  focused={focusedId === p.node.id}
                  expandable={(childCount.get(p.node.id) || 0) > 0}
                  expanded={expanded.has(p.node.id)}
                  violations={violationCounts.get(p.node.id) || 0}
                  onClick={() => {
                    setFocusedId(p.node.id)
                    select(selectedId === p.node.id ? null : p.node.id)
                  }}
                  onDoubleClick={() => toggleExpand(p.node.id)}
                />
              ))}
            </div>

            {/* ---- on-canvas square zoom controls ---- */}
            <div className="mc-zoom" role="group" aria-label="map zoom">
              <button type="button" className="mc-zoom-btn" aria-label="zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
                <Plus className="lucide" aria-hidden="true" />
              </button>
              <button type="button" className="mc-zoom-btn" aria-label="zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>
                <Minus className="lucide" aria-hidden="true" />
              </button>
              <button type="button" className="mc-zoom-btn" aria-label="fit map to view" onClick={fit}>
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
    // ensure the node will be visible: at file grain everything renders, so flip
    // grain to files if the match is a file buried under collapsed folders.
    let nextGrain = grain
    if (node.kind === 'file' && GRAIN_DEPTH[grain] < Infinity) {
      nextGrain = 'files'
      setGrain('files')
    }
    // expand the node's ancestors so it (or its visible ancestor) is on-canvas.
    setExpanded((prev) => {
      const next = new Set(prev)
      let cur = node.parent
      while (cur && tree.byId.has(cur)) {
        next.add(cur)
        cur = tree.byId.get(cur).parent
      }
      return next
    })
    setQuery('')
    setSearchOpen(false)
    setFocusedId(node.id)
    select(node.id)
    // centre after layout settles (grain/expansion just changed the positions).
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => focusNode(node.id))
    })
    void nextGrain
  }
}

/* drop the internal _order key before handing a node back to onSelect. */
function stripInternal(node) {
  const { _order, ...rest } = node
  void _order
  return rest
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
      data-ink-flip={inkFlip ? 'true' : undefined}
      aria-label={nodeAriaLabel(node, { selected, expanded, violations })}
      aria-pressed={selected}
      aria-expanded={expandable ? expanded : undefined}
      style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
      // stop the pointerdown from starting a canvas pan.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
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
function Edge({ a, b, kind, weight, maxWeight }) {
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
    <g className="mc-edge" data-kind={kind}>
      <path className="mc-edge-path" d={d} style={{ strokeWidth: w }} />
      {/* structure edges carry a square arrowhead at the target; activity is
          symmetric (co-work), so no marker. drawn as a path so it stays square. */}
      {kind === 'structure' && (
        <path className="mc-edge-head" d={`M ${x2 - 4} ${y2 - 6} L ${x2 + 4} ${y2 - 6} L ${x2} ${y2} Z`} />
      )}
    </g>
  )
}

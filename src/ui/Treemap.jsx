import { useMemo } from 'react'
import './Treemap.css'

/* treemap (.tm-*): a NEW tier-2 component shipping its own namespaced css file
   (the first in src/ui to do so — every earlier family appended to index.css, but
   this one is fully self-contained) while reusing the shared tokens, fonts, border,
   focus-ring + intensity idiom. it is the spatial sibling of the charts: a
   SQUARIFIED treemap (Bruls–Huizing–van Wijk) modelled on peasant's ChangeTreemap —
   one tile per item, AREA proportional to `value` (e.g. file churn), and a strict
   MONOCHROME intensity ramp (faint -> strong over --surface, never hue) encoding a
   SECOND metric. area answers "how big", intensity answers "how hot"; colour never
   carries meaning, so every tile is labelled. each tile is a real <button> with an
   aria-label "<label> — N lines", a focus-visible ring, and a title so even the
   sliver tiles (whose label is suppressed) stay identifiable. the layout is a pure
   function computed once in a fixed coordinate space and positioned by percentage,
   so it scales with the container and needs no DOM measurement (deterministic). */

/* ---------------------------------------------------------------- squarify */
/* the pure geometry, lifted from peasant/changeTreemapLayout.ts (same algorithm,
   plain JS). a pure function of its inputs: same items + rect => identical tiles,
   no clock/random. items sort by value desc, ties broken by id asc, so shuffling
   tied-value input yields identical output. each tile's area is proportional to
   its value; the squarify rule fills rows along the shorter side and starts a new
   row when adding a tile would worsen the row's worst aspect ratio, keeping every
   tile as close to square as the data allows. */

/* worst (largest) aspect ratio in a row of `areas` laid along a side of `side`. */
function worstRatio(areas, side) {
  if (areas.length === 0) return Infinity
  let sum = 0
  let rmax = -Infinity
  let rmin = Infinity
  for (const a of areas) {
    sum += a
    if (a > rmax) rmax = a
    if (a < rmin) rmin = a
  }
  if (sum <= 0 || rmin <= 0) return Infinity
  const side2 = side * side
  const sum2 = sum * sum
  return Math.max((side2 * rmax) / sum2, sum2 / (side2 * rmin))
}

/* place a committed row into `rect` along its shorter side, returning the tiles and
   mutating `rect` to the leftover sub-rectangle. */
function layoutRow(row, rect) {
  const rowSum = row.reduce((s, r) => s + r.area, 0)
  const tiles = []
  if (rect.w <= rect.h) {
    // horizontal band across the top; tiles split the width.
    const thickness = rowSum / rect.w // band height
    let x = rect.x
    for (const r of row) {
      const w = thickness > 0 ? r.area / thickness : 0
      tiles.push({ id: r.id, x, y: rect.y, w, h: thickness })
      x += w
    }
    rect.y += thickness
    rect.h -= thickness
  } else {
    // vertical band down the left; tiles split the height.
    const thickness = rowSum / rect.h // band width
    let y = rect.y
    for (const r of row) {
      const h = thickness > 0 ? r.area / thickness : 0
      tiles.push({ id: r.id, x: rect.x, y, w: thickness, h })
      y += h
    }
    rect.x += thickness
    rect.w -= thickness
  }
  return tiles
}

/**
 * Lay `items` out as a squarified treemap filling [0,0,width,height]. Returns one
 * tile per item (input length preserved). Zero/negative-value items get zero-size
 * tiles (no area, so they never overlap). When every value is 0, values fall back
 * to equal (so a no-churn set still tiles legibly). A non-positive width or height
 * yields all-zero tiles (no NaN/Infinity).
 *
 * @param {Array<{id:string, value:number}>} items
 * @param {number} width
 * @param {number} height
 * @returns {Array<{id:string, x:number, y:number, w:number, h:number}>}
 */
export function squarify(items, width, height) {
  if (items.length === 0) return []

  // deterministic order: value desc, then id asc.
  const sorted = [...items].sort(
    (a, b) => b.value - a.value || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )

  if (width <= 0 || height <= 0) {
    return sorted.map((it) => ({ id: it.id, x: 0, y: 0, w: 0, h: 0 }))
  }

  const totalValue = sorted.reduce((s, it) => s + Math.max(0, it.value), 0)
  const totalArea = width * height
  // all-zero fallback -> equal areas.
  const scaled = sorted.map((it) => ({
    id: it.id,
    area:
      totalValue > 0
        ? (Math.max(0, it.value) / totalValue) * totalArea
        : totalArea / sorted.length,
  }))

  const positive = scaled.filter((s) => s.area > 0)
  const zero = scaled.filter((s) => s.area <= 0)

  const tiles = []
  const rect = { x: 0, y: 0, w: width, h: height }
  let row = []
  let i = 0
  while (i < positive.length) {
    const next = positive[i]
    const side = Math.min(rect.w, rect.h)
    const rowAreas = row.map((r) => r.area)
    if (
      row.length === 0 ||
      worstRatio(rowAreas, side) >= worstRatio([...rowAreas, next.area], side)
    ) {
      row.push(next)
      i += 1
    } else {
      tiles.push(...layoutRow(row, rect))
      row = []
    }
  }
  if (row.length > 0) tiles.push(...layoutRow(row, rect))

  for (const z of zero) tiles.push({ id: z.id, x: 0, y: 0, w: 0, h: 0 })
  return tiles
}

/* ---------------------------------------------------------------- intensity */
/* the sanctioned monochrome ramp: five levels (0..4) mixing the foreground ink
   into --surface at a rising weight, so faint -> strong reads as cool -> hot with
   NO hue shift. driven entirely from tokens by color-mix in the css (one custom
   property --tm-mix per level on the tile). levels 3+ get dark enough that --ink
   would fail contrast, so those tiles flip their label ink to --canvas (the
   readable inverse). the threshold is luminance-by-construction: it is a property
   of the ramp, not of any per-instance colour, so it can be a static lookup. */
const INK_FLIPS_AT = 3 // levels >= this take --canvas ink, below take --ink

/* clamp + round an arbitrary intensity into the 0..4 band (tolerates bad input). */
function clampLevel(n) {
  const v = Math.round(Number(n) || 0)
  return v < 0 ? 0 : v > 4 ? 4 : v
}

/* the leaf of a slash-path, so "ingest/stream.go" labels as "stream.go". non-paths
   pass through untouched. */
function leaf(label) {
  const s = String(label ?? '')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}

/* ---------------------------------------------------------------- component */
// fixed layout space; tiles are positioned as a % of these, so the grid is
// resolution-independent and the same tiles render at any container size.
const LAYOUT_W = 400
const LAYOUT_H = 300
// below these thresholds (% of the container) a tile's label would truncate to
// noise, so it is suppressed — the tile still carries a title + aria-label, so it
// stays identifiable and keyboard-reachable. (mirrors peasant's MIN_LABEL_*.)
const MIN_LABEL_W_PCT = 9
const MIN_LABEL_H_PCT = 9

/**
 * @typedef {Object} TreemapDatum
 * @property {string} id                 stable key (also the default selection token)
 * @property {string} label              human label, e.g. "ingest/stream.go" (leaf shown)
 * @property {number} value              non-negative sizing weight; tile AREA ∝ value
 * @property {number} [intensity=0]      0..4 monochrome ramp level (a SECOND metric)
 * @property {string} [unit='lines']     noun for the aria-label, e.g. "lines", "calls"
 */

/**
 * Treemap — a squarified, strict-monochrome treemap. One tile per datum, AREA
 * proportional to `value`, an optional 0..4 grayscale `intensity` reinforcing a
 * second metric. No hue, no verdict — facts for orientation. Each tile is a real
 * <button> (label + aria-label "<label> — N <unit>"), focus-visible ring, and a
 * title, so sliver tiles whose label is suppressed stay identifiable. Clicking a
 * tile fires `onSelect(id, datum)`.
 *
 * Emits a `role="group"` container so the interactive tiles stay in the a11y tree
 * (role="img" would make them presentational). Renders nothing for an empty set.
 *
 * @param {Object} props
 * @param {TreemapDatum[]} [props.data=[]]              the tiles (area ∝ value)
 * @param {(id:string, datum:TreemapDatum)=>void} [props.onSelect]  fired on tile click
 * @param {number} [props.height=320]                   container height in px
 * @param {string} [props.ariaLabel]                    label for the group landmark
 * @param {string} [props.className]                    extra class on the container
 */
export default function Treemap({
  data = [],
  onSelect,
  height = 320,
  ariaLabel,
  className = '',
}) {
  const { tiles, byId, total } = useMemo(() => {
    const byId = new Map()
    let total = 0
    const items = data.map((d) => {
      const value = Math.max(0, Number(d.value) || 0)
      total += value
      byId.set(d.id, d)
      return { id: d.id, value }
    })
    return { tiles: squarify(items, LAYOUT_W, LAYOUT_H), byId, total }
  }, [data])

  if (!data.length) return null

  const label =
    ariaLabel || `${data.length} tile${data.length === 1 ? '' : 's'} sized by value`

  return (
    <div
      className={['tm', className].filter(Boolean).join(' ')}
      style={{ height }}
      role="group"
      aria-label={label}
    >
      {tiles.map((t) => {
        const wPct = (t.w / LAYOUT_W) * 100
        const hPct = (t.h / LAYOUT_H) * 100
        if (wPct <= 0 || hPct <= 0) return null // zero-value: no tile
        const d = byId.get(t.id)
        if (!d) return null
        const level = clampLevel(d.intensity)
        const unit = d.unit || 'lines'
        const value = Math.max(0, Number(d.value) || 0)
        const showLabel = wPct >= MIN_LABEL_W_PCT && hPct >= MIN_LABEL_H_PCT
        const inkFlipped = level >= INK_FLIPS_AT
        return (
          <button
            key={t.id}
            type="button"
            className={'tm-tile' + (inkFlipped ? ' tm-tile--ink-flip' : '')}
            data-level={level}
            aria-label={`${d.label} — ${value} ${unit}`}
            title={`${d.label} · ${value} ${unit}`}
            onClick={() => onSelect?.(t.id, d)}
            style={{
              left: `${(t.x / LAYOUT_W) * 100}%`,
              top: `${(t.y / LAYOUT_H) * 100}%`,
              width: `${wPct}%`,
              height: `${hPct}%`,
            }}
          >
            {showLabel && <span className="tm-tile-label mono">{leaf(d.label)}</span>}
          </button>
        )
      })}
      {/* a one-line legend keeps the encoding self-describing: area = size, the
          ramp swatch = the second metric. text-only, so it never relies on hue. */}
      <span className="tm-meta tnum" aria-hidden="true">
        {data.length} tiles · {total} total
      </span>
    </div>
  )
}

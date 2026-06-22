/* ───────────────────────────────────────────────────────────────────────────
   Intensity — fairtrade "in use" component family
   ─────────────────────────────────────────────────────────────────────────
   a monochrome intensity ramp (0–4) vocabulary + a metric-encoded square node,
   ported from peasant's code-map. magnitude is read from FILL WEIGHT, never hue.

   exports:
     • IntensitySwatch  — one ramp chip at a level (the atomic unit)
     • RampLegend       — the 0–4 ramp, labelled "none → full" (self-documenting)
     • Heatmap          — a row of ramp cells (magnitude-as-sparkline)
     • MapNode          — the square node: size=loc, fill=coverage, border+marker
                          =selected, badge=violation (4 orthogonal channels)
     • quantize/coverageLevel/effortLevel — pure data → 0..4 ramp-level helpers

   all visual styling lives in Intensity.css (token-driven, namespaced `ir-`).
   ─────────────────────────────────────────────────────────────────────────── */
import { Check, TriangleAlert } from 'lucide-react'
import './Intensity.css'

/* ── ramp-level helpers (pure, deterministic — peasant's intensity.ts) ─────── */

/** clamp any number into the 0..4 ramp domain (integers only). */
export function clampLevel(level) {
  const n = Math.round(Number(level) || 0)
  return Math.max(0, Math.min(4, n))
}

/**
 * coverage ratio (recorded / total) → ramp level. 0 / unknown = none; ≥ 0.9
 * reads as fully covered. mirrors peasant's traceabilityLevel quantiles.
 */
export function coverageLevel(recorded, total) {
  if (!total || total <= 0 || recorded <= 0) return 0
  const ratio = Math.min(recorded / total, 1)
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.9) return 3
  return 4
}

/** density (0..1) → ramp level for the bottom-edge effort bar. */
export function effortLevel(density) {
  if (!density || density <= 0) return 0
  const d = Math.min(density, 1)
  if (d <= 0.25) return 1
  if (d <= 0.5) return 2
  if (d <= 0.75) return 3
  return 4
}

/** generic value-vs-max quantization (heatmap cells, sparklines). */
export function quantize(value, max) {
  if (value <= 0 || max <= 0) return 0
  const ratio = Math.min(value / max, 1)
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/** loc → node size class. small files are compact; large ones get real estate. */
export function locSize(loc) {
  const n = Number(loc) || 0
  if (n < 60) return 'xs'
  if (n < 200) return 'sm'
  if (n < 600) return 'md'
  if (n < 1500) return 'lg'
  return 'xl'
}

const LEVEL_WORDS = ['none', 'low', 'some', 'most', 'full']

/* ── IntensitySwatch ───────────────────────────────────────────────────────
   one ramp chip. monochrome by default; accent="amber" for the scarce variant. */
export function IntensitySwatch({ level = 0, accent, size, label, className = '', ...rest }) {
  const lv = clampLevel(level)
  return (
    <span
      className={`ir-swatch${size === 'lg' ? ' ir-swatch--lg' : ''}${className ? ` ${className}` : ''}`}
      data-level={lv}
      data-accent={accent || undefined}
      role="img"
      aria-label={label || `intensity ${lv} of 4 (${LEVEL_WORDS[lv]})`}
      {...rest}
    />
  )
}

/* ── RampLegend ────────────────────────────────────────────────────────────
   the ramp made glanceable: every step shown with its number + word, bracketed
   by "none → full" so the encoding documents itself. wrap consumers in the
   ramp scope (see <IntensityScope>) so --ir-* resolve. */
export function RampLegend({ title = 'coverage', words = LEVEL_WORDS, className = '' }) {
  return (
    <div className={`ir-scope ir-legend${className ? ` ${className}` : ''}`}>
      <span className="ir-legend__title">{title}</span>
      <div className="ir-legend__steps">
        {[0, 1, 2, 3, 4].map((lv) => (
          <div key={lv} className="ir-legend__step">
            <span className="ir-legend__cell" data-level={lv} aria-hidden="true" />
            <span className="ir-legend__num">{lv}</span>
            <span className="ir-legend__label">{words[lv]}</span>
          </div>
        ))}
      </div>
      <div className="ir-legend__ends">
        <span>none</span>
        <span>full</span>
      </div>
    </div>
  )
}

/* ── Heatmap ───────────────────────────────────────────────────────────────
   a row of ramp cells. pass raw `values` + `max` (auto-quantized) or pre-baked
   `levels`. titles each cell for hover/SR readout. */
export function Heatmap({ values, levels, max, labels, ariaLabel = 'intensity heatmap', className = '' }) {
  const cells = levels
    ? levels.map(clampLevel)
    : (values || []).map((v) => quantize(v, max ?? Math.max(1, ...(values || [1]))))
  return (
    <div
      className={`ir-scope ir-heatmap${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={ariaLabel}
    >
      {cells.map((lv, i) => (
        <span
          key={i}
          className="ir-heatmap__cell"
          data-level={lv}
          title={`${labels?.[i] ?? `cell ${i + 1}`}: ${LEVEL_WORDS[lv]} (${lv}/4)`}
        />
      ))}
    </div>
  )
}

/* ── MapNode ───────────────────────────────────────────────────────────────
   the square code-map node. FOUR orthogonal encodings, never collapsed:
     size      = loc       (size class)
     fill      = coverage  (0..4 ramp — its only consumer)
     selection = amber border + corner check marker (icon, not colour alone)
     violation = clay warning badge with icon + count (not colour alone)
   plus an optional bottom effort bar (a second magnitude on the amber ramp). */
export function MapNode({
  label,
  loc,
  coverage = 0,
  recorded,
  total,
  selected = false,
  violation = 0,
  effortPct,
  size,
  as = 'button',
  onClick,
  className = '',
  ...rest
}) {
  // coverage can come pre-quantized (0..4) or be derived from recorded/total.
  const cov = total != null ? coverageLevel(recorded ?? 0, total) : clampLevel(coverage)
  const sizeClass = size || locSize(loc)
  const violations = Math.max(0, Math.round(Number(violation) || 0))
  const hasEffort = effortPct != null && effortPct > 0
  const effortLv = hasEffort ? effortLevel(effortPct > 1 ? effortPct / 100 : effortPct) : 0

  // a complete, drift-free accessible name (peasant's mapNodeAriaLabel pattern).
  const counts = total != null ? `${recorded ?? 0} of ${total} recorded` : `coverage ${cov} of 4`
  const ariaLabel = [
    label,
    counts,
    loc != null ? `${loc} loc` : null,
    violations > 0 ? `${violations} violation${violations === 1 ? '' : 's'}` : null,
    selected ? 'selected' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const Tag = as
  const interactive = Tag === 'button'

  return (
    <Tag
      className={`ir-node ir-node--${sizeClass}${className ? ` ${className}` : ''}`}
      data-coverage={cov}
      data-selected={selected ? 'true' : undefined}
      type={interactive ? 'button' : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      {...rest}
    >
      <span className="ir-node__head">
        <span className="ir-node__label">{label}</span>
        {violations > 0 && (
          <span className="ir-node__badge" aria-hidden="true">
            <TriangleAlert aria-hidden="true" />
            <span className="tnum">{violations}</span>
          </span>
        )}
      </span>
      <span className="ir-node__count">
        {total != null ? `${recorded ?? 0}/${total}` : `cov ${cov}/4`}
        {loc != null ? ` · ${loc} loc` : ''}
      </span>
      {selected && (
        <span className="ir-node__mark" aria-hidden="true">
          <Check aria-hidden="true" />
        </span>
      )}
      {hasEffort && <span className="ir-node__effort" data-level={effortLv} aria-hidden="true" />}
    </Tag>
  )
}

/* ── IntensityScope ────────────────────────────────────────────────────────
   defines the --ir-* ramp custom properties for any subtree. MapNode/Heatmap/
   RampLegend self-scope, but wrap a free-standing grid of nodes in this so the
   ramp resolves once for the whole region. */
export function IntensityScope({ children, className = '', ...rest }) {
  return (
    <div className={`ir-scope${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </div>
  )
}

export default MapNode

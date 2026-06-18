/* shared chart chrome + theming for the Recharts-backed chart family (ChartBar, ChartLine,
   Sparkline). every chart is wrapped so the engine's defaults never leak: colour comes from
   tokens via currentColor (so it re-themes on [data-theme]), corners are square, type is mono
   tabular, motion is off by default (static-first), and the legend pairs a swatch WITH a text
   label so meaning never rides on colour alone. see the .chart-* / .recharts-* block in index.css. */

/* a named token colour -> the css series class that paints it (fill/stroke/color all set, so
   passing fill|stroke="currentColor" to a Recharts series resolves to the token). amber is the
   scarce emphasis series; the four earth accents are the default categorical ramp. */
export const SERIES_CLASS = {
  teal: 'chart-s1', olive: 'chart-s2', clay: 'chart-s3', mauve: 'chart-s4', amber: 'chart-samber',
  1: 'chart-s1', 2: 'chart-s2', 3: 'chart-s3', 4: 'chart-s4',
  '1': 'chart-s1', '2': 'chart-s2', '3': 'chart-s3', '4': 'chart-s4',
}
/* the css var each series class resolves to (for swatches + the tooltip dot, which live OUTSIDE
   a series <g> so they can't inherit currentColor). */
export const SERIES_VAR = {
  teal: 'var(--chart-1)', olive: 'var(--chart-2)', clay: 'var(--chart-3)', mauve: 'var(--chart-4)', amber: 'var(--chart-amber)',
  1: 'var(--chart-1)', 2: 'var(--chart-2)', 3: 'var(--chart-3)', 4: 'var(--chart-4)',
  '1': 'var(--chart-1)', '2': 'var(--chart-2)', '3': 'var(--chart-3)', '4': 'var(--chart-4)',
}
/* the default categorical ramp, in order, for series that don't name a colour. */
export const RAMP = ['teal', 'olive', 'clay', 'mauve', 'amber']

export const seriesClass = (color) => SERIES_CLASS[color] || 'chart-s1'
export const seriesVar = (color) => SERIES_VAR[color] || 'var(--chart-1)'

/* common Recharts cartesian props: tight square margins, the accessibility layer (keyboard
   nav + ARIA, a neuroinclusive win), and static-first animation. */
export const cartesianProps = () => ({
  accessibilityLayer: true,
  // right margin clears the last x-tick label (line series sit point-to-edge); left is small
  // because the YAxis carries its own width.
  margin: { top: 8, right: 18, bottom: 4, left: 4 },
})
export const noAnim = { isAnimationActive: false }

/**
 * ChartFrame - the hairline card chrome shared by ChartBar + ChartLine: an optional head
 * (lucide icon + lowercase title + tabular aside), an optional sub line, the plot, and an
 * optional swatch+label legend.
 */
export function ChartFrame({ icon: Icon, title, aside, sub, legend, className = '', children }) {
  const cls = ['chart', className].filter(Boolean).join(' ')
  return (
    <figure className={cls}>
      {(title || aside) && (
        <figcaption className="chart-head">
          {title && (
            <span className="chart-title">
              {Icon && <Icon className="lucide" aria-hidden="true" />}
              {title}
            </span>
          )}
          {aside && <span className="chart-aside">{aside}</span>}
        </figcaption>
      )}
      {sub && <p className="chart-sub">{sub}</p>}
      <div className="chart-plot">{children}</div>
      {legend && legend.length > 1 && (
        <ul className="chart-legend">
          {legend.map((s) => (
            <li className="chart-legend-item" key={s.key}>
              <span className="chart-legend-sw" style={{ background: seriesVar(s.color) }} aria-hidden="true" />
              {s.name || s.key}
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}

/**
 * ChartTooltip - the custom Recharts tooltip content: a square bordered chip, lowercase mono
 * key, tabular values, each row prefixed by its series swatch (colour + label, never colour alone).
 */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }) {
  if (!active || !payload || !payload.length) return null
  const fmtV = valueFormatter || ((v) => v)
  const fmtL = labelFormatter || ((l) => l)
  return (
    <div className="chart-tip" role="status">
      {label != null && <span className="chart-tip-k">{fmtL(label)}</span>}
      {payload.map((p, i) => (
        <span className="chart-tip-row" key={i}>
          <span className="chart-tip-sw" style={{ background: seriesVar(p.payload?.__color?.[p.dataKey] || p.color) }} aria-hidden="true" />
          {p.name}: <span className="chart-tip-v">{fmtV(p.value)}</span>
        </span>
      ))}
    </div>
  )
}

/* normalise the `series` prop: assign each series a colour off the ramp when it doesn't name one. */
export function resolveSeries(series) {
  return series.map((s, i) => ({ ...s, color: s.color || RAMP[i % RAMP.length] }))
}

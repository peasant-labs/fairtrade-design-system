import { LineChart, Line, BarChart, Bar, ResponsiveContainer } from 'recharts'
import { seriesClass } from './chart-shared.jsx'

/* Sparkline - a bare inline trend (no axes, grid, labels, or tooltip) for a line of text, a
   table cell, or a stat tile. Recharts-backed, token colour via currentColor, square (bar mode
   has no radius), static. it conveys shape only, so it must carry a text `label` to be meaningful
   on its own (role=img) - never let a sparkline be the sole carrier of a value. */

/**
 * @param {Object} props
 * @param {Array<number|Object>} props.data     numbers, or objects with a `value` key.
 * @param {'line'|'bar'} [props.type='line']     line or mini-bar.
 * @param {'teal'|'olive'|'clay'|'mauve'|'amber'|1|2|3|4} [props.color='teal']  token colour.
 * @param {number} [props.width=88]              px width.
 * @param {number} [props.height=24]             px height.
 * @param {string} props.label                   accessible name (e.g. "sessions, last 8 weeks, trending up"). required.
 * @param {string} [props.className]             extra class.
 */
export default function Sparkline({ data, type = 'line', color = 'teal', width = 88, height = 24, label, className = '' }) {
  const rows = (data || []).map((d, i) => (typeof d === 'number' ? { i, value: d } : { i, ...d }))
  const cls = seriesClass(color)
  return (
    <span
      className={['spark', className].filter(Boolean).join(' ')}
      style={{ width, height }}
      role="img"
      aria-label={label}
    >
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' ? (
          <BarChart data={rows} margin={{ top: 1, right: 0, bottom: 1, left: 0 }} barCategoryGap="18%">
            <Bar dataKey="value" className={cls} fill="currentColor" radius={0} isAnimationActive={false} />
          </BarChart>
        ) : (
          <LineChart data={rows} margin={{ top: 2, right: 1, bottom: 2, left: 1 }}>
            <Line dataKey="value" className={`${cls} chart-line`} stroke="currentColor" strokeWidth={1.75} dot={false} isAnimationActive={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </span>
  )
}

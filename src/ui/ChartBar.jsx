import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartFrame, ChartTooltip, cartesianProps, noAnim, seriesClass, resolveSeries, compactTick } from './chart-shared.jsx'

/* ChartBar - a vertical bar chart, Recharts-backed but forced onto the system: square bars
   (radius 0), token colour via currentColor (re-themes on the toggle), hairline grid, mono
   tabular ticks, the keyboard accessibility layer, static-first (no entrance animation).
   one or more series; pass stacked to stack them. */

/**
 * @typedef {Object} BarSeries
 * @property {string} key                 the data key this series reads from each row.
 * @property {string} [name]              legend/tooltip label (defaults to key); lowercased by css.
 * @property {'teal'|'olive'|'clay'|'mauve'|'amber'|1|2|3|4} [color]  series colour; defaults along the earth ramp.
 */

/**
 * @param {Object} props
 * @param {Object[]} props.data                 row objects.
 * @param {string} props.xKey                   the category key on the x axis.
 * @param {BarSeries[]} props.series            one or more bar series.
 * @param {boolean} [props.stacked=false]       stack series instead of grouping them.
 * @param {React.ComponentType} [props.icon]    a lucide icon for the head.
 * @param {React.ReactNode} [props.title]       chart title (lowercase chrome).
 * @param {React.ReactNode} [props.aside]       a tabular summary shown at the head's right.
 * @param {React.ReactNode} [props.sub]         a sub line under the head.
 * @param {number} [props.height=200]           plot height in px.
 * @param {number[]} [props.yTicks]             explicit y ticks; omit to auto-pick integers.
 * @param {(v:any)=>React.ReactNode} [props.xFormatter]     format x tick + tooltip label.
 * @param {(v:any)=>React.ReactNode} [props.yFormatter]     format y ticks; defaults to thousands-compaction (3000 → 3k).
 * @param {(v:any)=>React.ReactNode} [props.valueFormatter] format the tooltip value.
 * @param {string} [props.className]            extra class on the chart frame.
 */
export default function ChartBar({
  data, xKey, series, stacked = false, icon, title, aside, sub,
  height = 200, yTicks, xFormatter, yFormatter = compactTick, valueFormatter, className = '',
}) {
  const s = resolveSeries(series)
  return (
    <ChartFrame icon={icon} title={title} aside={aside} sub={sub} legend={s} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barCategoryGap="22%" {...cartesianProps()}>
          <CartesianGrid vertical={false} />
          {/* interval="preserveStartEnd" + a real minTickGap lets recharts thin
              x labels when the series outgrows the plot (27 iso-weeks of live
              data overlapped into illegibility under the old interval={0}). */}
          <XAxis dataKey={xKey} tickLine={false} interval="preserveStartEnd" tickFormatter={xFormatter} tickMargin={8} minTickGap={28} />
          <YAxis width={40} tickLine={false} axisLine={false} ticks={yTicks} allowDecimals={false} tickMargin={4} tickFormatter={yFormatter} />
          <Tooltip
            cursor={{ className: 'chart-cursor' }}
            content={<ChartTooltip valueFormatter={valueFormatter} labelFormatter={xFormatter} />}
          />
          {s.map((ser) => (
            <Bar
              key={ser.key}
              dataKey={ser.key}
              name={ser.name || ser.key}
              className={seriesClass(ser.color)}
              fill="currentColor"
              stackId={stacked ? 'stack' : undefined}
              maxBarSize={64}
              radius={0}
              {...noAnim}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

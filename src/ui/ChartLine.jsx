import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartFrame, ChartTooltip, cartesianProps, noAnim, seriesClass, resolveSeries } from './chart-shared.jsx'

/* ChartLine - a line / area trend chart, Recharts-backed but on the system: token colour via
   currentColor (re-themes), the area fill is the same token at low opacity under a full-strength
   line, square dots ringed in the surface colour, hairline grid, mono tabular ticks, keyboard
   accessibility layer, static-first. set `area: true` on a series to fill under its line. */

/**
 * @typedef {Object} LineSeries
 * @property {string} key                 data key.
 * @property {string} [name]              legend/tooltip label (defaults to key).
 * @property {'teal'|'olive'|'clay'|'mauve'|'amber'|1|2|3|4} [color]  series colour; defaults along the earth ramp.
 * @property {boolean} [area]             fill the region under the line.
 */

/**
 * @param {Object} props
 * @param {Object[]} props.data                 row objects.
 * @param {string} props.xKey                   the x-axis key.
 * @param {LineSeries[]} props.series           one or more line/area series.
 * @param {React.ComponentType} [props.icon]    a lucide icon for the head.
 * @param {React.ReactNode} [props.title]       chart title (lowercase chrome).
 * @param {React.ReactNode} [props.aside]       a tabular summary at the head's right.
 * @param {React.ReactNode} [props.sub]         a sub line under the head.
 * @param {number} [props.height=200]           plot height in px.
 * @param {number[]} [props.yTicks]             explicit y ticks; omit to auto-pick integers.
 * @param {(v:any)=>React.ReactNode} [props.xFormatter]     format x tick + tooltip label.
 * @param {(v:any)=>React.ReactNode} [props.valueFormatter] format the tooltip value.
 * @param {string} [props.className]            extra class on the chart frame.
 */
export default function ChartLine({
  data, xKey, series, icon, title, aside, sub,
  height = 200, yTicks, xFormatter, valueFormatter, className = '',
}) {
  const s = resolveSeries(series)
  return (
    <ChartFrame icon={icon} title={title} aside={aside} sub={sub} legend={s} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} {...cartesianProps()}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} interval={0} tickFormatter={xFormatter} tickMargin={8} minTickGap={0} />
          <YAxis width={28} tickLine={false} axisLine={false} ticks={yTicks} allowDecimals={false} tickMargin={4} />
          <Tooltip
            cursor={{ className: 'chart-cursor', strokeWidth: 0 }}
            content={<ChartTooltip valueFormatter={valueFormatter} labelFormatter={xFormatter} />}
          />
          {s.map((ser) =>
            ser.area ? (
              <Area
                key={ser.key}
                dataKey={ser.key}
                name={ser.name || ser.key}
                className={`${seriesClass(ser.color)} chart-area`}
                fill="currentColor"
                stroke="currentColor"
                strokeWidth={2}
                dot={{ className: `${seriesClass(ser.color)} chart-dot`, r: 3, fill: 'currentColor' }}
                activeDot={{ className: `${seriesClass(ser.color)} chart-dot`, r: 4, fill: 'currentColor' }}
                {...noAnim}
              />
            ) : (
              <Line
                key={ser.key}
                dataKey={ser.key}
                name={ser.name || ser.key}
                className={`${seriesClass(ser.color)} chart-line`}
                stroke="currentColor"
                strokeWidth={2}
                dot={{ className: `${seriesClass(ser.color)} chart-dot`, r: 3, fill: 'currentColor' }}
                activeDot={{ className: `${seriesClass(ser.color)} chart-dot`, r: 4, fill: 'currentColor' }}
                {...noAnim}
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

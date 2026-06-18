import { expect, within } from 'storybook/test'
import ChartBar from './ChartBar.jsx'
import ChartLine from './ChartLine.jsx'
import Sparkline from './Sparkline.jsx'
import { BarChart3, Users, Clock } from 'lucide-react'

/* the chart family is Recharts-backed but rendered through bespoke wrappers that force the
   system aesthetic (square, token colour, mono tabular ticks, hairline grid, static-first,
   keyboard accessibility layer). these stories prove it themes correctly in BOTH the dark and
   light toolbar modes. charts need a width-bearing parent (ResponsiveContainer), so each story
   is framed at a fixed width. */

const WEEKS = [
  { week: '04-29', label: '04-29', sessions: 2, active: 3, newC: 3 },
  { week: '05-06', label: '05-06', sessions: 1, active: 4, newC: 1 },
  { week: '05-13', label: '05-13', sessions: 3, active: 4, newC: 2 },
  { week: '05-20', label: '05-20', sessions: 2, active: 3, newC: 1 },
  { week: '05-27', label: '05-27', sessions: 4, active: 4, newC: 2 },
  { week: '06-03', label: '06-03', sessions: 2, active: 3, newC: 0 },
]

const frame = (w) => [(Story) => <div style={{ width: w, maxWidth: '100%' }}><Story /></div>]

export default {
  title: 'data/Charts',
  parameters: { layout: 'centered' },
}

export const Bar = {
  decorators: frame(520),
  render: () => (
    <ChartBar
      icon={BarChart3}
      title="sessions per week"
      aside="14 total"
      data={WEEKS}
      xKey="label"
      series={[{ key: 'sessions', name: 'sessions', color: 'amber' }]}
      yTicks={[0, 1, 2, 3, 4]}
      valueFormatter={(v) => `${v} sessions`}
    />
  ),
  play: async ({ canvasElement }) => {
    // the bars render as token-coloured rects inside the themed series group.
    await new Promise((r) => setTimeout(r, 200))
    const rects = canvasElement.querySelectorAll('.recharts-bar-rectangle')
    expect(rects.length).toBeGreaterThan(0)
  },
}

export const GroupedBars = {
  decorators: frame(520),
  render: () => (
    <ChartBar
      icon={Users}
      title="active vs new contributors"
      data={WEEKS}
      xKey="label"
      series={[
        { key: 'active', name: 'active', color: 'teal' },
        { key: 'newC', name: 'new', color: 'olive' },
      ]}
      yTicks={[0, 2, 4]}
    />
  ),
}

export const StackedBars = {
  decorators: frame(520),
  render: () => (
    <ChartBar
      icon={Users}
      title="contributors by kind"
      data={WEEKS}
      xKey="label"
      stacked
      series={[
        { key: 'active', name: 'active', color: 'teal' },
        { key: 'newC', name: 'new', color: 'olive' },
      ]}
    />
  ),
}

export const LineArea = {
  name: 'line + area',
  decorators: frame(520),
  render: () => (
    <ChartLine
      icon={Users}
      title="weekly active contributors"
      aside="21 active"
      sub="distinct contributors active each week"
      data={WEEKS}
      xKey="label"
      series={[{ key: 'active', name: 'active', color: 'teal', area: true }]}
      yTicks={[0, 2, 4]}
    />
  ),
  play: async ({ canvasElement }) => {
    await new Promise((r) => setTimeout(r, 200))
    expect(canvasElement.querySelector('.recharts-area-area, .recharts-line')).not.toBeNull()
  },
}

export const MultiLine = {
  name: 'multi-line',
  decorators: frame(520),
  render: () => (
    <ChartLine
      icon={Clock}
      title="active and new, by week"
      data={WEEKS}
      xKey="label"
      series={[
        { key: 'active', name: 'active', color: 'teal' },
        { key: 'newC', name: 'new', color: 'clay' },
      ]}
      yTicks={[0, 2, 4]}
    />
  ),
}

export const Sparklines = {
  decorators: frame(320),
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        <Sparkline data={WEEKS.map((w) => w.sessions)} color="teal" label="sessions, last 6 weeks" />
        sessions
        <span className="tnum" style={{ marginLeft: 'auto' }}>14</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        <Sparkline data={WEEKS.map((w) => w.active)} type="bar" color="olive" label="active contributors, last 6 weeks" />
        active
        <span className="tnum" style={{ marginLeft: 'auto' }}>21</span>
      </span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const imgs = canvasElement.querySelectorAll('[role="img"]')
    expect(imgs.length).toBeGreaterThanOrEqual(2)
  },
}

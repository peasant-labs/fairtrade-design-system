import { useState } from 'react'
import { expect, within } from 'storybook/test'
import TimeStrip from './TimeStrip.jsx'
import { frame } from './story-frame.jsx'

/* TimeStrip stories. CSF3. an activity time-strip / sparkline-scrubber: quantized
   bars on a MONOCHROME intensity ramp (fill weight, not hue), right-anchored so
   "now" never clips, with a draggable role="slider" playhead. tokens come from
   src/index.css via .storybook/preview.jsx; the theme toolbar flips data-theme,
   so the color-mix ramp + amber wash re-theme live. */
const meta = {
  title: 'in use/TimeStrip',
  component: TimeStrip,
  tags: ['autodocs'],
  // a full-width strip — it lives at the bottom of a view, so give it room.
  decorators: frame('full'),
  parameters: { layout: 'padded' },
}
export default meta

/* short labelled date helper — "jun 14"-style, lowercase mono chrome. */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
function dayLabel(daysAgo) {
  const d = new Date(2026, 5, 22) // jun 22 2026 — the project "today"
  d.setDate(d.getDate() - daysAgo)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/* 14 buckets of varied session activity, oldest → newest (rightmost = now). */
const ACTIVITY = [2, 5, 1, 0, 3, 8, 11, 6, 4, 9, 14, 7, 12, 28]
const BUCKETS = ACTIVITY.map((value, i) => ({
  label: dayLabel(ACTIVITY.length - 1 - i),
  value,
}))

/* a mostly-empty fortnight with a couple of spikes — the sparse case. */
const SPARSE_RAW = [0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 17, 0, 0, 1]
const SPARSE = SPARSE_RAW.map((value, i) => ({
  label: dayLabel(SPARSE_RAW.length - 1 - i),
  value,
}))

/* a small stateful wrapper so the playhead is actually draggable/keyboardable
   in the story (controlled = onScrub + value). */
function Scrubbable({ buckets, initial = 1, branches }) {
  const [value, setValue] = useState(initial)
  return (
    <TimeStrip
      buckets={buckets}
      value={value}
      onScrub={(next) => setValue(next)}
      branches={branches}
      label="session activity"
    />
  )
}

/* ── Default — 14 buckets, playhead near the end, 2 open-branch chips ───────── */
export const Default = {
  render: () => (
    <Scrubbable
      buckets={BUCKETS}
      initial={11 / 13} /* land the playhead near "now", a couple of buckets back */
      branches={[{ label: 'fix/auth-redirect' }, { label: 'feat/strip' }]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // it's a real slider with proper bounds over the 14 buckets (indices 0..13).
    const slider = canvas.getByRole('slider', { name: /session activity/i })
    await expect(slider).toHaveAttribute('aria-valuemin', '0')
    await expect(slider).toHaveAttribute('aria-valuemax', '13')
    // the always-visible readout names the bucket + count, not colour.
    await expect(canvas.getByText(/session(s)?$/)).toBeInTheDocument()
    // both branch chips render.
    await expect(canvas.getByTitle('branch fix/auth-redirect')).toBeInTheDocument()
    await expect(canvas.getByTitle('branch feat/strip')).toBeInTheDocument()
  },
}

/* ── Sparse — mostly empty with a couple of spikes ─────────────────────────── */
export const Sparse = {
  render: () => (
    <Scrubbable buckets={SPARSE} initial={10 / 13} branches={[{ label: 'spike/ingest' }]} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const slider = canvas.getByRole('slider', { name: /session activity/i })
    await expect(slider).toHaveAttribute('aria-valuemax', '13')
    // arrow-key scrubbing moves the playhead (keyboard is a first-class path).
    slider.focus()
    const before = slider.getAttribute('aria-valuenow')
    await expect(before).toBe('10')
  },
}

/* ── Static — no onScrub: the strip self-manages its playhead from defaultValue ── */
export const Uncontrolled = {
  name: 'Uncontrolled',
  render: () => (
    <TimeStrip
      buckets={BUCKETS}
      defaultValue={1}
      branches={[{ label: 'main' }]}
      label="commits / day"
    />
  ),
}

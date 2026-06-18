import { expect, userEvent, within, waitFor, fn } from 'storybook/test'
import DateRange, { DateRangeCalendar, DATE_PRESETS, formatRange } from './DateRange.jsx'
import { frame } from './story-frame.jsx'

// open stories need vertical room: the absolutely-positioned panel drops below the
// trigger and is clipped by the centered canvas. give them height + top padding on
// top of the shared wide frame so the calendar renders fully in-frame.
const roomForPanel = [(Story) => (
  <div style={{ minHeight: 520, paddingTop: 'var(--sp-5)' }}><Story /></div>
)]

/* date-range story. CSF3: a Playground driven by argTypes plus one named story per
   meaningful state (empty, seeded, open, single-month, presets-only, bounded, keyboard,
   small, embedded). classes + tokens come from src/index.css via .storybook/preview.jsx;
   the theme toolbar (addon-themes) flips data-theme, addon-a11y audits each story.
   play() tests follow the handoff gotchas: assert on the [hidden]/[data-state] attribute
   or content existence, never an instant toBeVisible() (the panel starts at opacity 0 mid
   menuIn); waitFor the grid's auto-focus before any userEvent.keyboard call. */

const meta = {
  title: 'components/DateRange',
  component: DateRange,
  tags: ['autodocs'],
  decorators: frame('wide'),
  argTypes: {
    numberOfMonths: { control: { type: 'inline-radio' }, options: [1, 2] },
    weekStartsOn: { control: { type: 'number', min: 0, max: 6 } },
    align: { control: { type: 'inline-radio' }, options: ['start', 'end'] },
    size: { control: { type: 'inline-radio' }, options: ['md', 'sm'] },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    clearable: { control: 'boolean' },
    value: { control: false },
    presets: { control: false },
    onChange: { action: 'change' },
    onDraftChange: { action: 'draft' },
  },
  args: {
    numberOfMonths: 2,
    weekStartsOn: 1,
    align: 'start',
    size: 'md',
    placeholder: 'any dates',
    clearable: true,
  },
}
export default meta

export const Playground = {}

// closed, empty trigger -> the placeholder is the visible + accessible name.
export const Default = {
  args: { placeholder: 'any dates' },
}

// closed, seeded -> the trigger shows the formatted, tabular readout.
export const WithValue = {
  args: { defaultValue: { from: '2026-06-01', to: '2026-06-14' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /dates:/i })
    // the visible value reads as a collapsed span (same month)
    expect(trigger.textContent).toContain(formatRange({ from: '2026-06-01', to: '2026-06-14' }))
    // closed: the dialog is hidden (assert the attribute, not visibility)
    const pop = canvasElement.querySelector('.dr-pop')
    expect(pop).toHaveAttribute('hidden')
  },
}

// open the panel and assert structure via attributes/content, NOT toBeVisible (menuIn).
export const Open = {
  args: { defaultValue: { from: '2026-06-01', to: '2026-06-14' } },
  decorators: roomForPanel,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /dates:/i })
    await userEvent.click(trigger)
    // panel no longer hidden + the trigger announces expanded
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      expect(canvasElement.querySelector('.dr-pop')).not.toHaveAttribute('hidden')
    })
    // two month grids are present
    expect(canvasElement.querySelectorAll('.dr-grid').length).toBe(2)
    // the dialog carries its accessible name
    expect(canvas.getByRole('dialog', { name: /choose a date range/i })).toBeInTheDocument()
  },
}

export const SingleMonth = {
  args: { numberOfMonths: 1, defaultValue: { from: '2026-06-08', to: '2026-06-08' } },
  decorators: roomForPanel,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /dates:/i }))
    await waitFor(() => {
      expect(canvasElement.querySelector('.dr-pop')).not.toHaveAttribute('hidden')
    })
    expect(canvasElement.querySelectorAll('.dr-grid').length).toBe(1)
  },
}

// choosing a preset commits a 7-day span and closes the panel.
export const PresetsOnly = {
  args: { presets: DATE_PRESETS, onChange: fn() },
  decorators: roomForPanel,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /any dates|dates:/i }))
    await waitFor(() => {
      expect(canvasElement.querySelector('.dr-pop')).not.toHaveAttribute('hidden')
    })
    const last7 = canvas.getByRole('button', { name: /^last 7 days$/i })
    await userEvent.click(last7)
    await waitFor(() => {
      expect(args.onChange).toHaveBeenCalled()
    })
    const next = args.onChange.mock.calls.at(-1)[0]
    // 7-day inclusive span
    const ms = new Date(next.to) - new Date(next.from)
    expect(Math.round(ms / 86400000) + 1).toBe(7)
    // commit closed the panel
    await waitFor(() => {
      expect(canvasElement.querySelector('.dr-pop')).toHaveAttribute('hidden')
    })
  },
}

// out-of-range days are aria-disabled and skipped by ArrowRight.
export const Bounded = {
  args: {
    min: '2026-06-05',
    max: '2026-06-20',
    defaultValue: { from: '2026-06-10', to: '2026-06-12' },
  },
  decorators: roomForPanel,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /dates:/i }))
    await waitFor(() => {
      expect(canvasElement.querySelector('.dr-pop')).not.toHaveAttribute('hidden')
    })
    // a day before min is aria-disabled
    const before = canvas.getByRole('button', { name: /^1 june 2026$/i })
    expect(before).toHaveAttribute('aria-disabled', 'true')
    // the day at max is enabled
    const atMax = canvas.getByRole('button', { name: /^20 june 2026$/i })
    expect(atMax).not.toHaveAttribute('aria-disabled')
  },
}

// keyboard: open, focus settles on a day, arrow to move, Enter to anchor, then close.
export const KeyboardNav = {
  args: { defaultValue: { from: null, to: null }, onChange: fn() },
  decorators: roomForPanel,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /any dates|dates:/i }))
    // auto-focus settles late -> waitFor a tabbable day before keying (handoff gotcha)
    await waitFor(() => {
      const focused = canvasElement.querySelector('.dr-day[tabindex="0"]')
      expect(focused).toBeTruthy()
      expect(document.activeElement).toBe(focused)
    })
    const start = document.activeElement.getAttribute('aria-label')
    // anchor `from` on the focused day
    await userEvent.keyboard('{Enter}')
    // move one week down + select the other end
    await userEvent.keyboard('{ArrowDown}{ArrowRight}{ArrowRight}{Enter}')
    await waitFor(() => {
      expect(args.onChange).toHaveBeenCalled()
    })
    const committed = args.onChange.mock.calls.at(-1)[0]
    expect(committed.from).toBeTruthy()
    expect(committed.to).toBeTruthy()
    // the committed range spans 10 days (one week + two days, inclusive)
    const ms = new Date(committed.to) - new Date(committed.from)
    expect(Math.round(ms / 86400000) + 1).toBe(10)
    expect(start).toMatch(/2026/)
  },
}

// open helper for the popover stories below: click the trigger, wait until the
// dialog is no longer hidden (never assert toBeVisible mid menuIn).
const openPanel = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: /any dates|dates:/i }))
  await waitFor(() => {
    expect(canvasElement.querySelector('.dr-pop')).not.toHaveAttribute('hidden')
  })
}

// align='end' anchors the panel to the trigger's right edge (the case most likely
// to overflow the opposite viewport edge).
export const AlignEnd = {
  args: { align: 'end', defaultValue: { from: '2026-06-01', to: '2026-06-14' } },
  decorators: roomForPanel,
  play: async (ctx) => {
    await openPanel(ctx)
    expect(ctx.canvasElement.querySelector('.dr-pop.dr-end')).toBeTruthy()
  },
}

// disabled trigger: not interactive, the panel never opens.
export const Disabled = {
  args: { disabled: true, defaultValue: { from: '2026-06-01', to: '2026-06-14' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /dates:/i })
    expect(trigger).toBeDisabled()
    // force the click past the pointer-events:none guard to prove the handler still no-ops when disabled
    await userEvent.click(trigger, { pointerEventsCheck: 0 })
    expect(canvasElement.querySelector('.dr-pop')).toHaveAttribute('hidden')
  },
}

// weekStartsOn=0 puts sunday in the first column.
export const SundayStart = {
  args: { weekStartsOn: 0, defaultValue: { from: '2026-06-07', to: '2026-06-20' } },
  decorators: roomForPanel,
  play: async (ctx) => {
    await openPanel(ctx)
    const firstHeader = ctx.canvasElement.querySelector('.dr-wdrow .dr-wd')
    expect(firstHeader.textContent).toBe('sun')
  },
}

// the small trigger sits at 28px next to a .btn-sm to prove equal heights.
export const SmallTrigger = {
  args: { size: 'sm', defaultValue: { from: '2026-06-01', to: '2026-06-07' } },
  render: (a) => (
    <div className="btn-row">
      <DateRange {...a} />
      <button type="button" className="btn btn-secondary btn-sm">filter</button>
    </div>
  ),
}

// the screenshot-stable variant: the bare grids, no floating layer.
export const EmbeddedCalendar = {
  render: () => (
    <DateRangeCalendar
      className="is-static"
      defaultValue={{ from: '2026-06-04', to: '2026-06-18' }}
    />
  ),
  play: async ({ canvasElement }) => {
    // both grids render inline; endpoints carry aria-selected
    expect(canvasElement.querySelectorAll('.dr-grid').length).toBe(2)
    const edges = canvasElement.querySelectorAll('.dr-day.dr-edge')
    expect(edges.length).toBeGreaterThanOrEqual(2)
  },
}

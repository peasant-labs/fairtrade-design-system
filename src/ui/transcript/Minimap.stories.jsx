import { useState } from 'react'
import { expect, within, fireEvent } from 'storybook/test'
import TranscriptMinimap from './Minimap.jsx'

/* TranscriptMinimap story (exported as TranscriptMinimap). One focusable slider over the visible
   turns, in turn order: the decorative ticks carry the kind (user the teal role colour and the
   tallest bar, agent the middle bar in ink-2, tool the shortest bar in ink-4) and an amber cursor
   marks the active position however narrow the ticks get. Wrapped in a bar (the minimap is
   `flex:1` inside the pinned trace header). The play function runs in a real browser, so it also
   reads the computed heights and the cursor's paint, which jsdom cannot. */

const turns = [
  { index: 0, role: 'user', label: '1', toolCalls: [] },
  { index: 1, role: 'assistant', label: '1a', toolCalls: [{ id: 't1' }] },
  { index: 2, role: 'assistant', label: '1b', toolCalls: [] },
  { index: 3, role: 'user', label: '2', toolCalls: [] },
  { index: 4, role: 'assistant', label: '2a', toolCalls: [] },
  { index: 5, role: 'assistant', label: '2b', toolCalls: [] },
]

function Bar({ active, theme, onJump }) {
  return (
    <div
      data-theme={theme}
      style={{ display: 'flex', alignItems: 'center', width: 480, padding: '6px 12px', background: 'var(--surface-2)', border: 'var(--bd)' }}
    >
      <TranscriptMinimap turns={turns} activeTurn={active} onJump={onJump} />
    </div>
  )
}

/* the story drives a controlled active turn, so the keyboard and pointer paths are observable. */
function Controlled({ theme, start = 2 }) {
  const [active, setActive] = useState(turns[start].index)
  return <Bar active={active} theme={theme} onJump={setActive} />
}

const meta = {
  title: 'in use/transcript/TranscriptMinimap',
  component: TranscriptMinimap,
  tags: ['autodocs'],
}
export default meta

export const Default = {
  render: () => <Controlled />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const slider = canvas.getByRole('slider', { name: 'transcript timeline' })
    // the set-position state the classic scrubber carries: one control, the active position, the total.
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', String(turns.length - 1))
    expect(slider).toHaveAttribute('aria-valuenow', '2')
    expect(slider).toHaveAttribute('aria-valuetext', `turn ${turns[2].label} of ${turns.length}`)
    // the ticks are decorative: no per-turn focusable control inside the slider.
    expect(within(slider).queryAllByRole('button')).toHaveLength(0)
    expect(slider.querySelectorAll('.txn-minimap-seg')).toHaveLength(turns.length)
    for (const kind of ['user', 'agent', 'tool']) {
      expect(slider.querySelectorAll('.txn-minimap-' + kind).length).toBeGreaterThan(0)
    }
    // kind is encoded by bar height as well as colour, and this is the layer where heights exist.
    const height = (kind) => parseFloat(getComputedStyle(slider.querySelector('.txn-minimap-' + kind)).height)
    expect(height('user')).toBeGreaterThan(height('agent'))
    expect(height('agent')).toBeGreaterThan(height('tool'))
    // the position cursor is painted in both themes, not a transparent box.
    const cursor = getComputedStyle(slider.querySelector('.txn-minimap-cursor'))
    expect(cursor.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(cursor.backgroundColor).not.toBe('transparent')
    // keyboard seek: one turn per arrow, Home/End to the ends.
    await fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider).toHaveAttribute('aria-valuenow', '3')
    expect(slider).toHaveAttribute('aria-valuetext', `turn ${turns[3].label} of ${turns.length}`)
    await fireEvent.keyDown(slider, { key: 'End' })
    expect(slider).toHaveAttribute('aria-valuenow', String(turns.length - 1))
    await fireEvent.keyDown(slider, { key: 'Home' })
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    // pointer seek: the middle of the track selects the middle turn.
    const rect = slider.getBoundingClientRect()
    await fireEvent.pointerDown(slider, { clientX: rect.left + rect.width / 2 })
    expect(slider).toHaveAttribute('aria-valuenow', String(Math.round((turns.length - 1) / 2)))
  },
}

export const LightTheme = { render: () => <Controlled theme="light" /> }

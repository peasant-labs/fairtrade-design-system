import { useState } from 'react'
import { expect, within, fireEvent } from 'storybook/test'
import TranscriptMinimap from './Minimap.jsx'

/* TranscriptMinimap story (exported as TranscriptMinimap). One focusable slider over the visible
   turns, in turn order: the decorative ticks form one filled 6px bar on a three-step shape
   ladder — a user turn fills the 6px bar (teal), an agent turn is a 4px centred band (amber), and
   a system notice is a 2px centred band (ink-4) — with an ink-strong cursor marking the active
   position however narrow the ticks get. Wrapped in a bar (the minimap is `flex:1` inside the
   pinned trace header). The play function runs in a real browser, so it reads the computed
   geometry and the token paint, which jsdom cannot. */

const turns = [
  { index: 0, role: 'user', label: '1', toolCalls: [] },
  { index: 1, role: 'assistant', label: '1a', toolCalls: [{ id: 't1' }] },
  { index: 2, role: 'assistant', label: '1b', toolCalls: [] },
  { index: 3, role: 'user', label: '2', toolCalls: [] },
  { index: 4, role: 'assistant', label: '2a', toolCalls: [] },
  { index: 5, role: 'assistant', label: '2b', toolCalls: [] },
  { index: 6, role: 'system', label: '3', toolCalls: [] },
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

/* the play function is shared by both theme stories, so the geometry and the token paint are
   asserted in both. */
async function play({ canvasElement }) {
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
  // the bar is one filled 6px track, and a kind is read by a three-step shape ladder as well as by
  // hue: a user turn fills the bar, an agent turn is a 4px centred band, a tool turn is the
  // shortest 2px centred band. This is the layer where geometry exists, so the shape cue is
  // asserted here rather than in jsdom.
  const track = slider.querySelector('.txn-minimap-track')
  const trackHeight = parseFloat(getComputedStyle(track).height)
  expect(trackHeight).toBe(6)
  const segment = (kind) => slider.querySelector('.txn-minimap-' + kind)
  const height = (kind) => parseFloat(getComputedStyle(segment(kind)).height)
  expect(height('user')).toBe(trackHeight)
  expect(height('agent')).toBe(4)
  expect(height('tool')).toBe(2)
  // the ladder is strictly descending, so user and agent are never told apart by hue alone.
  expect(height('user')).toBeGreaterThan(height('agent'))
  expect(height('agent')).toBeGreaterThan(height('tool'))
  // every step of the ladder is a visible bar, never a collapsed or clipped tick.
  for (const kind of ['user', 'agent', 'tool']) {
    expect(height(kind), `the ${kind} turn must render a visible bar`).toBeGreaterThan(0)
  }
  // the position cursor is a painted ink-strong line that stands taller than the bar, so it reads
  // against both the teal and the amber fills in either theme. The probe sits in the same themed
  // subtree as the slider, so it resolves the same token value.
  const cursor = getComputedStyle(slider.querySelector('.txn-minimap-cursor'))
  const probe = canvasElement.ownerDocument.createElement('span')
  probe.style.background = 'var(--ink-strong)'
  slider.parentElement.appendChild(probe)
  const inkStrong = getComputedStyle(probe).backgroundColor
  probe.remove()
  expect(cursor.backgroundColor).toBe(inkStrong)
  expect(cursor.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  // a 1px ground halo, so the cursor's adjacent colour is the bar's surface where it crosses the
  // teal and amber fills (both themes).
  expect(cursor.boxShadow).not.toBe('none')
  expect(parseFloat(cursor.height)).toBeGreaterThan(trackHeight)
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
}

export const Default = { render: () => <Controlled />, play }

export const LightTheme = { render: () => <Controlled theme="light" />, play }

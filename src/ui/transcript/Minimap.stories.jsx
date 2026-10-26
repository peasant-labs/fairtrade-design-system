import { expect, within } from 'storybook/test'
import TranscriptMinimap from './Minimap.jsx'

/* TranscriptMinimap story (exported as TranscriptMinimap). One segment per visible turn, in turn
   order: user segments carry the teal role colour and the tallest bar, agent turns the amber
   accent and a middle bar, tool turns the faint rule ink and the shortest bar. The turn currently
   in view is outlined in ink around its cell, so its position never depends on colour. Wrapped in
   a bar (the minimap is `flex:1` inside the pinned trace header). */

const turns = [
  { index: 0, role: 'user', label: '1', toolCalls: [] },
  { index: 1, role: 'assistant', label: '1a', toolCalls: [{ id: 't1' }] },
  { index: 2, role: 'assistant', label: '1b', toolCalls: [] },
  { index: 3, role: 'user', label: '2', toolCalls: [] },
  { index: 4, role: 'assistant', label: '2a', toolCalls: [] },
  { index: 5, role: 'assistant', label: '2b', toolCalls: [] },
]

const Bar = (active, theme) => (
  <div
    data-theme={theme}
    style={{ display: 'flex', alignItems: 'center', width: 480, padding: '6px 12px', background: 'var(--surface-2)', border: 'var(--bd)' }}
  >
    <TranscriptMinimap turns={turns} activeTurn={active} />
  </div>
)

const meta = {
  title: 'in use/transcript/TranscriptMinimap',
  component: TranscriptMinimap,
  tags: ['autodocs'],
}
export default meta

export const Default = {
  render: () => Bar(2),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('navigation', { name: 'transcript timeline' })
    const segments = within(nav).getAllByRole('button')
    expect(segments).toHaveLength(turns.length)
    // the active turn marks exactly one segment current, and it is the third one.
    expect(segments.filter((segment) => segment.getAttribute('aria-current') === 'true')).toHaveLength(1)
    expect(segments[2]).toHaveAttribute('aria-current', 'true')
    // each turn kind has its own segment class, so the strip is not one flat colour.
    expect(nav.querySelectorAll('.txn-minimap-user').length).toBeGreaterThan(0)
    expect(nav.querySelectorAll('.txn-minimap-agent').length).toBeGreaterThan(0)
    expect(nav.querySelectorAll('.txn-minimap-tool').length).toBeGreaterThan(0)
  },
}

export const LightTheme = { render: () => Bar(2, 'light') }

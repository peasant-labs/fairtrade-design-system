import { expect, within } from 'storybook/test'
import Scrubber from './Scrubber.jsx'

/* Scrubber story (exported as TranscriptScrubber). One tick per cooked TurnVM in turn-index space;
   user ticks teal, error ticks clay, the active tick amber with the tracking bracket. Wrapped in a
   flex bar (the scrubber is `flex:1` inside the pinned trace header). */

const turns = [
  { index: 0, role: 'user' },
  { index: 1, role: 'assistant' },
  { index: 2, role: 'assistant', isError: true },
  { index: 3, role: 'assistant' },
  { index: 4, role: 'user' },
  { index: 5, role: 'assistant' },
]

const Bar = (active) => (
  <div style={{ display: 'flex', alignItems: 'center', width: 480, padding: '6px 12px', background: 'var(--surface-2)', border: 'var(--bd)' }}>
    <Scrubber turns={turns} active={active} />
  </div>
)

const meta = {
  title: 'in use/transcript/TranscriptScrubber',
  component: Scrubber,
  tags: ['autodocs'],
}
export default meta

export const Default = {
  render: () => Bar(2),
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole('slider')
    // turn-index space: aria-valuemax === turn count, valuenow === active index + 1.
    expect(slider).toHaveAttribute('aria-valuemax', String(turns.length))
    expect(slider).toHaveAttribute('aria-valuenow', '3')
  },
}

export const AtStart = { render: () => Bar(0) }
export const AtEnd = { render: () => Bar(5) }

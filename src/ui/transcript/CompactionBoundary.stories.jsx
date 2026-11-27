import { expect, userEvent, within } from 'storybook/test'
import TranscriptCompactionBoundary from './CompactionBoundary.jsx'
import { frame } from '../story-frame.jsx'

/* TranscriptCompactionBoundary story (exported as TranscriptCompactionBoundary). A producer
   context-compaction boundary as its own ledger row: the boundary label, the recorded trigger,
   the token delta, the duration when recorded, and the recorded notice behind a disclosure.
   The story args are real cooked shapes, so the row can also be inspected in both themes. */

const turn = {
  index: 3,
  role: 'system',
  label: '3',
  depth: 0,
  content: 'Context compacted (auto): 168104 -> 24000 tokens',
  compaction: {
    label: 'context compacted',
    trigger: 'auto',
    preTokens: 168104,
    postTokens: 24000,
    text: 'Context compacted (auto): 168104 -> 24000 tokens',
  },
  time: '8m ago',
  toolCalls: [],
  annotations: [],
}

const durationTurn = {
  ...turn,
  content: 'Context compacted: 120000 -> 40000 tokens in 1200ms',
  compaction: {
    label: 'context compacted',
    preTokens: 120000,
    postTokens: 40000,
    durationMs: 1200,
    text: 'Context compacted: 120000 -> 40000 tokens in 1200ms',
  },
}

const beforeTurn = {
  ...turn,
  content: 'Context compacted: 120000 tokens before',
  compaction: { label: 'context compacted', preTokens: 120000, text: 'Context compacted: 120000 tokens before' },
}

const afterTurn = {
  ...turn,
  content: 'Context compacted: 120000 tokens after',
  compaction: { label: 'context compacted', postTokens: 120000, text: 'Context compacted: 120000 tokens after' },
}

const labelTurn = {
  ...turn,
  content: 'Conversation compacted',
  compaction: { label: 'conversation compacted', text: 'Conversation compacted' },
}

const Anchor = () => (
  <button type="button" className="txn-anchor" aria-label="copy link to turn 3" title="copy link to this turn">
    anchor
  </button>
)

const meta = {
  title: 'in use/transcript/TranscriptCompactionBoundary',
  component: TranscriptCompactionBoundary,
  tags: ['autodocs'],
  decorators: frame('wide'),
}
export default meta

export const TriggerAndDelta = {
  args: { turn, actions: <Anchor /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const head = canvasElement.querySelector('.txn-compaction-head')
    const body = canvasElement.querySelector('.txn-compaction-body')
    await expect(canvas.getByText('context compacted')).toBeVisible()
    await expect(canvas.getByText('(auto)')).toBeVisible()
    await expect(canvasElement.querySelector('.txn-compaction-delta')).toHaveTextContent(/168\.1k.*24k.*tokens/)
    await expect(head).toHaveAttribute('aria-expanded', 'false')
    await expect(head.getAttribute('aria-label')).toMatch(/context compacted, auto, 168,104 tokens before, 24,000 tokens after/)
    await expect(body).toHaveAttribute('hidden')
    await userEvent.click(head)
    await expect(head).toHaveAttribute('aria-expanded', 'true')
    await expect(body).not.toHaveAttribute('hidden')
    await expect(body).toHaveTextContent('Context compacted (auto): 168104 -> 24000 tokens')
  },
}

export const Duration = { args: { turn: durationTurn, actions: <Anchor /> } }
export const BeforeOnly = { args: { turn: beforeTurn, actions: <Anchor /> } }
export const AfterOnly = { args: { turn: afterTurn, actions: <Anchor /> } }
export const BoundaryWithoutCounts = { args: { turn: labelTurn, actions: <Anchor /> } }

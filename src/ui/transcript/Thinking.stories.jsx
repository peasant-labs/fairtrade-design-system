import { expect, within, userEvent } from 'storybook/test'
import Thinking from './Thinking.jsx'
import { frame } from '../story-frame.jsx'

/* Thinking story. CSF3, title 'in use/transcript/Thinking'. One row in the tool-call shape: the
   kind "Think", the word count, and the time spent; opening it reveals the cooked thinking text. */

const meta = {
  title: 'in use/transcript/TranscriptThinking',
  component: Thinking,
  tags: ['autodocs'],
  decorators: frame('panel'),
}
export default meta

export const Default = {
  args: {
    block: {
      text: 'The renderer lives under canvas/. I should read TurnRow.tsx before moving anything, then run a typecheck across the workspace before committing files.',
      words: 24,
      durationMs: 4200,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // collapsed: the kind, the word count and the time show, the body does not.
    expect(canvasElement.querySelector('.txn-thinking .kind')).toHaveTextContent('Think')
    expect(canvasElement.querySelector('.txn-thinking-wc')).toHaveTextContent('24 words')
    expect(canvasElement.querySelector('.txn-thinking .txn-tc-dur')).toHaveTextContent('4.2s')
    // opening reveals the cooked thinking text.
    await userEvent.click(canvas.getByRole('button', { name: /think/i }))
    expect(canvas.getByText(/run a typecheck across the workspace/)).toBeInTheDocument()
  },
}

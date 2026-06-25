import { expect, within, userEvent } from 'storybook/test'
import Thinking from './Thinking.jsx'
import { frame } from '../story-frame.jsx'

/* Thinking story. CSF3, title 'in use/transcript/Thinking'. A collapsed disclosure carrying a
   word-count badge; expanding reveals the cooked thinking text. */

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
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // collapsed: the word-count badge shows, the body does not.
    expect(canvas.getByText('24w')).toBeInTheDocument()
    // expanding reveals the cooked thinking text.
    await userEvent.click(canvas.getByRole('button', { name: /thinking/i }))
    expect(canvas.getByText(/run a typecheck across the workspace/)).toBeInTheDocument()
  },
}

import { expect, userEvent, within } from 'storybook/test'
import TranscriptSystemRow from './SystemRow.jsx'
import { frame } from '../story-frame.jsx'

/* TranscriptSystemRow story (exported as TranscriptSystemRow). A system turn in the ledger
   presentation: one compact row with its glyph, the "system" label, a one-line preview, the
   turn's time, and the turn's copy-anchor beside the disclosure. The recorded text stays
   collapsed until the reader asks for it. */

const turn = {
  index: 2,
  role: 'system',
  label: '2',
  depth: 0,
  content: 'session resumed, worktree changed on disk\nno transcript text was rewritten.',
  time: '8m ago',
  toolCalls: [],
  annotations: [],
}

const Anchor = () => (
  <button type="button" className="txn-anchor" aria-label="copy link to turn 2" title="copy link to this turn">
    anchor
  </button>
)

const meta = {
  title: 'in use/transcript/TranscriptSystemRow',
  component: TranscriptSystemRow,
  tags: ['autodocs'],
  decorators: frame('wide'),
}
export default meta

export const Default = {
  args: { turn, actions: <Anchor /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the row names itself, keeps user content as recorded, and collapses the body by default.
    await expect(canvas.getByText('system')).toBeVisible()
    await expect(canvas.getByText('session resumed, worktree changed on disk no transcript text was rewritten.')).toBeVisible()
    await expect(canvas.getByText('8m ago')).toBeVisible()
    const head = canvasElement.querySelector('.txn-systemrow-head')
    await expect(head).toHaveAttribute('aria-expanded', 'false')
    // the turn anchor sits beside the disclosure, not inside it.
    await expect(canvasElement.querySelector('.txn-anchor')).not.toBeNull()
    await userEvent.click(head)
    await expect(head).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByText('no transcript text was rewritten.')).toBeVisible()
  },
}

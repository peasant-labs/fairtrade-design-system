import { expect, userEvent, waitFor, within } from 'storybook/test'
import CopyIconButton from './CopyIconButton.jsx'

/* components/CopyIconButton: icon only, named for what it copies, a short copied state, and
   nothing at all without a clipboard. */
const meta = { title: 'components/CopyIconButton', component: CopyIconButton, tags: ['autodocs'], args: { value: 'https://village.peasantlabs.org/transcripts/3f9c0a17', label: 'copy link' } }
export default meta

export const Idle = {}

export const Copied = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'copy link' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: 'copied' })).toBeVisible())
  },
}

export const NoClipboard = {
  name: 'no clipboard',
  beforeEach: () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    return () => { delete navigator.clipboard }
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull()
  },
}

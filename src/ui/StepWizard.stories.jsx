import { expect, userEvent, within, waitFor } from 'storybook/test'
import StepWizard, { StepIndicator } from './StepWizard.jsx'
import { frame } from './story-frame.jsx'

/* CSF3 stories for the multi-step wizard. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. Default drives a real "contribute
   to the commons" flow (choose → labels → redact → submit) with working next/back and a
   reachability gate; the Indicator story shows the rail alone in mixed states. */

const STEPS = [
  { id: 'choose', label: 'choose' },
  { id: 'labels', label: 'labels' },
  { id: 'redact', label: 'redact' },
  { id: 'submit', label: 'submit' },
]

const meta = {
  title: 'in use/StepWizard',
  component: StepWizard,
  tags: ['autodocs'],
  decorators: frame('wide'),
}
export default meta

/* the full flow: four steps, placeholder bodies, working continue/back. continue marks the step
   complete and unlocks the next; the play test walks choose → labels and asserts the gate opens. */
export const Default = {
  render: () => (
    <StepWizard
      steps={STEPS}
      aria-label="contribute to the commons"
      onComplete={() => {}}
    >
      <p>pick the transcripts you want to contribute to the commons.</p>
      <p>apply labels so others can find the right examples.</p>
      <p>review and redact anything sensitive before it leaves your machine.</p>
      <p>submit your contribution. thank you for feeding the collective.</p>
    </StepWizard>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // step 1 is current; the rest are visible. "labels" starts locked (aria-disabled).
    const labels = canvas.getByRole('button', { name: /labels/i })
    await expect(labels).toHaveAttribute('aria-disabled', 'true')

    // continue marks "choose" complete and unlocks "labels".
    await userEvent.click(canvas.getByRole('button', { name: 'continue' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: /labels/i })).toHaveAttribute('aria-current', 'step'))

    // back returns to a now-complete "choose" (a check glyph, jump-back enabled).
    await userEvent.click(canvas.getByRole('button', { name: 'back' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: /choose/i })).toHaveAttribute('aria-current', 'step'))
  },
}

/* the rail alone, in mixed states: 2 complete (olive + check), 1 current (amber), 1 locked
   (hairline + dim, aria-disabled). controlled — onJump is a no-op here. */
export const Indicator = {
  render: () => (
    <StepIndicator
      steps={STEPS}
      current="redact"
      completed={new Set(['choose', 'labels'])}
      reachable={new Set(['choose', 'labels', 'redact'])}
      onJump={() => {}}
      aria-label="contribute progress"
    />
  ),
}

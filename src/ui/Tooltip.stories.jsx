import { useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import Tooltip, { Popover } from './Tooltip.jsx'
import Button from './Button.jsx'
import { Info, Shield, EyeOff, Users } from 'lucide-react'

/* overlays story: Tooltip (primary) shows a role=tooltip .tip-bubble on hover/focus and links it to
   an already-named trigger via aria-describedby; Popover (sibling, via render fn) toggles a role=dialog
   .pop-card. classes + tokens come from src/index.css via .storybook/preview.jsx. */
const meta = {
  title: 'overlays/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  argTypes: {
    content: { control: 'text' },
    id: { control: 'text' },
  },
  args: {
    content: 'redacts names, emails and tokens before the transcript is published',
    children: <Button variant="secondary" size="sm">redact pii</Button>,
  },
}
export default meta

export const Playground = {}

export const OnButton = {
  args: {
    content: 'visible to everyone in the commons',
    children: <Button variant="primary" size="sm">publish to collective</Button>,
  },
}

export const OnIconButton = {
  args: {
    content: 'this transcript is shared under the fairtrade commons license',
    children: (
      <button type="button" className="btn btn-ghost btn-sm" aria-label="license info">
        <Info size={16} aria-hidden="true" />
      </button>
    ),
  },
}

export const LongContent = {
  args: {
    content:
      'provider runs locally (claude-code); no transcript text leaves your machine until you opt in',
    children: <Button variant="secondary" size="sm">provider: claude-code</Button>,
  },
}

/* primary story with the play test: focus the already-named trigger, assert the role=tooltip
   bubble appears and is wired via aria-describedby, then Escape hides it. */
export const FocusReveals = {
  args: {
    content: 'tokens and api keys are stripped on publish',
    children: <Button variant="secondary" size="sm">redact secrets</Button>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /redact secrets/i })

    // no tooltip before interaction
    expect(canvas.queryByRole('tooltip')).not.toBeInTheDocument()

    // focusing the trigger reveals the .tip-bubble
    await userEvent.tab()
    expect(trigger).toHaveFocus()

    const tip = await canvas.findByRole('tooltip')
    expect(tip).toHaveTextContent(/tokens and api keys are stripped on publish/i)

    // the trigger describes itself via the bubble id (aria-describedby links them)
    const describedBy = trigger.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(describedBy.split(' ')).toContain(tip.getAttribute('id'))

    // Escape hides the tooltip
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(canvas.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  },
}

/* sibling overlay: Popover renders its own trigger button (aria-expanded + aria-controls) and a
   titled role=dialog .pop-card; dismisses on Escape or outside click. */
export const PopoverBasic = {
  render: () => (
    <Popover
      label="redaction settings"
      icon={Shield}
      content={
        <p>choose what to strip before this transcript joins the commons.</p>
      }
      footer={
        <>
          <Button variant="ghost" size="sm">cancel</Button>
          <Button variant="primary" size="sm">apply</Button>
        </>
      }
    >
      <EyeOff size={14} aria-hidden="true" />
      redaction
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /redaction/i })

    // closed by default
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()

    // click opens the role=dialog .pop-card
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const dialog = await canvas.findByRole('dialog', { name: /redaction settings/i })
    expect(dialog).toBeInTheDocument()

    // the trigger controls the card
    expect(trigger.getAttribute('aria-controls')).toBe(dialog.getAttribute('id'))

    // Escape closes it and returns focus to the trigger
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(trigger).toHaveFocus()
  },
}

/* a popover with a stateful host, mirroring how an app would drive selectable content. */
export const PopoverWithState = {
  render: () => {
    const [provider, setProvider] = useState('claude-code')
    const providers = ['claude-code', 'gemini-cli', 'codex-cli']
    return (
      <Popover
        label="select provider"
        title="provider"
        icon={Users}
        content={
          <div role="radiogroup" aria-label="provider">
            {providers.map((p) => (
              <label key={p} style={{ display: 'block' }}>
                <input
                  type="radio"
                  name="provider"
                  value={p}
                  checked={provider === p}
                  onChange={() => setProvider(p)}
                />{' '}
                {p}
              </label>
            ))}
          </div>
        }
      >
        provider: {provider}
      </Popover>
    )
  },
}

import { useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import Tooltip, { Popover } from './Tooltip.jsx'
import Button from './Button.jsx'
import BrandMark from './BrandMark.jsx'
import { frame } from './story-frame.jsx'
import { Info, Shield, EyeOff, Users } from 'lucide-react'

/* overlays story: Tooltip (primary) shows a role=tooltip .tip-bubble on hover/focus and links it to
   an already-named trigger via aria-describedby; Popover (sibling, via render fn) toggles a role=dialog
   .pop-card. classes + tokens come from src/index.css via .storybook/preview.jsx. */
const meta = {
  title: 'overlays/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  decorators: frame('panel'),
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

/* hover the trigger and leave the bubble open so the captured frame shows the real .tip-bubble
   surface (its border, the square nub, its theming) rather than a bare trigger. */
const hoverOpen = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const trigger = canvas.getAllByRole('button')[0]
  await userEvent.hover(trigger)
  await canvas.findByRole('tooltip')
}

/* the bubble floats above its trigger and the card drops below it; reserve vertical headroom on top
   of the meta panel frame so an opened overlay never clips the captured canvas. merges with the
   meta-level frame('panel') decorator. */
const headroom = [(Story) => (
  <div style={{ paddingTop: 'var(--sp-8)', minHeight: 220 }}>
    <Story />
  </div>
)]

export const Playground = { decorators: headroom, play: hoverOpen }

export const OnButton = {
  args: {
    content: 'visible to everyone in the commons',
    children: <Button variant="primary" size="sm">publish to collective</Button>,
  },
  decorators: headroom,
  play: hoverOpen,
}

export const OnIconButton = {
  args: {
    content: 'this transcript is shared under the fairtrade commons license',
    children: (
      <button type="button" className="btn btn-ghost btn-sm" aria-label="license info">
        <Info aria-hidden="true" />
      </button>
    ),
  },
  decorators: headroom,
  play: hoverOpen,
}

export const LongContent = {
  args: {
    content:
      'provider runs locally (claude-code); no transcript text leaves your machine until you opt in',
    children: (
      <Button variant="secondary" size="sm">
        <BrandMark name="claude-code" /> provider: claude-code
      </Button>
    ),
  },
  decorators: headroom,
  play: hoverOpen,
}

/* primary story with the play test: focus the already-named trigger, assert the role=tooltip
   bubble appears and is wired via aria-describedby, then Escape hides it. */
export const FocusReveals = {
  args: {
    content: 'tokens and api keys are stripped on publish',
    children: <Button variant="secondary" size="sm">redact secrets</Button>,
  },
  decorators: headroom,
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

/* a non-button trigger: the child must still be a single focusable, already-named element. an anchor
   carries its own accessible name and receives aria-describedby, so focus reveals the bubble exactly
   as it does for a button. proves the supported contract beyond the button specimen. */
export const OnLink = {
  args: {
    content: 'opens the published transcript in the commons',
    children: (
      <a href="#commons" className="btn btn-ghost btn-sm">
        view in commons
      </a>
    ),
  },
  decorators: headroom,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('link', { name: /view in commons/i })

    expect(canvas.queryByRole('tooltip')).not.toBeInTheDocument()

    await userEvent.tab()
    expect(trigger).toHaveFocus()

    const tip = await canvas.findByRole('tooltip')
    const describedBy = trigger.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(describedBy.split(' ')).toContain(tip.getAttribute('id'))
  },
}

/* sibling overlay: Popover renders its own trigger button (aria-expanded + aria-controls) and a
   titled role=dialog .pop-card; dismisses on Escape or outside click. */
export const PopoverBasic = {
  decorators: headroom,
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
      <EyeOff aria-hidden="true" />
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

/* the open popover, left open in the captured frame so baselines show the real .pop-card surface:
   its border, the titled head with its brand-free shield mark, the body, and the footer actions. */
export const PopoverOpen = {
  decorators: headroom,
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
      <EyeOff aria-hidden="true" />
      redaction
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /redaction/i })
    await userEvent.click(trigger)
    await canvas.findByRole('dialog', { name: /redaction settings/i })
  },
}

/* a popover with a stateful host, mirroring how an app would drive selectable content. each provider
   slug leads with its real brand mark and the rows use token spacing instead of inline magic. the play
   opens the dialog so the captured frame shows the card and its selectable content. */
export const PopoverWithState = {
  decorators: headroom,
  render: () => {
    const [provider, setProvider] = useState('claude-code')
    const providers = ['claude-code', 'gemini-cli', 'codex-cli']
    return (
      <Popover
        label="select provider"
        title="provider"
        icon={Users}
        content={
          <div
            role="radiogroup"
            aria-label="provider"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}
          >
            {providers.map((p) => (
              <label
                key={p}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p}
                  checked={provider === p}
                  onChange={() => setProvider(p)}
                />
                <BrandMark name={p} /> {p}
              </label>
            ))}
          </div>
        }
      >
        <BrandMark name={provider} /> provider: {provider}
      </Popover>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /provider:/i })
    await userEvent.click(trigger)
    await canvas.findByRole('dialog', { name: /select provider/i })
  },
}

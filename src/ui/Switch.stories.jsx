import { useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import { EyeOff } from 'lucide-react'
import Switch from './Switch.jsx'
import { frame } from './story-frame.jsx'

/* CSF3 story for the accessible toggle. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. the control is a real
   <button role="switch"> with aria-checked — the play test flips it and asserts. */
const meta = {
  title: 'controls/Switch',
  component: Switch,
  tags: ['autodocs'],
  decorators: frame('panel'),
  argTypes: {
    checked: { control: 'boolean' },
    defaultChecked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    busy: { control: 'boolean' },
    label: { control: 'text' },
    onText: { control: 'text' },
    offText: { control: 'text' },
    onChange: { action: 'changed' },
  },
  args: {
    label: 'redact participant names',
    defaultChecked: false,
    disabled: false,
    busy: false,
    onText: 'on',
    offText: 'off',
  },
}
export default meta

export const Playground = {}

export const On = {
  args: { label: 'auto-publish to commons', defaultChecked: true },
}

export const Off = {
  args: { label: 'share with collective', defaultChecked: false },
}

export const Disabled = {
  args: { label: 'sync from claude-code (locked)', defaultChecked: true, disabled: true },
}

export const Busy = {
  args: {
    label: 'syncing gemini-cli transcripts',
    defaultChecked: true,
    busy: true,
    onText: 'syncing',
  },
}

export const CustomStateIcon = {
  args: {
    label: 'hide redacted spans',
    stateIcon: EyeOff,
    onText: 'hidden',
    offText: 'shown',
  },
}

/* label-less layout: the empty `auto` label track collapses to 0 so the control
   still left-aligns on the grid. */
export const NoLabel = {
  args: { label: undefined },
}

export const DisabledOff = {
  args: { label: 'export raw transcripts', defaultChecked: false, disabled: true },
}

/* controlled wrapper so the play test can toggle a live <button role="switch">
   and assert aria-checked flips from false to true. */
export const Toggles = {
  render: () => {
    const [on, setOn] = useState(false)
    return <Switch label="redact participant names" checked={on} onChange={setOn} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sw = canvas.getByRole('switch', { name: 'redact participant names' })

    await expect(sw).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(sw)

    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'))
  },
}

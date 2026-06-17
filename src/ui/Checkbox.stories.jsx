import { useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import Checkbox, { Radio, RadioGroup } from './Checkbox.jsx'

/* checkbox primary; radio + radiogroup shown via render fns. CSF3: a Playground driven by argTypes
   plus one named story per meaningful state. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. */
const meta = {
  title: 'controls/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    checked: { control: 'boolean' },
    defaultChecked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: { children: 'redact participant names', defaultChecked: false, disabled: false },
}
export default meta

export const Playground = {}

export const Checked = {
  args: { defaultChecked: true, children: 'include provider metadata' },
}

export const Disabled = {
  args: { disabled: true, defaultChecked: true, children: 'verified by collective (locked)' },
}

export const Group = {
  render: () => (
    <div className="check-stack">
      <Checkbox defaultChecked>publish to the commons</Checkbox>
      <Checkbox>redact participant names</Checkbox>
      <Checkbox defaultChecked>attach claude-code session log</Checkbox>
      <Checkbox disabled>share raw tokens (disabled)</Checkbox>
    </div>
  ),
}

export const SingleRadio = {
  render: () => (
    <Radio name="license" value="cc-by-sa" defaultChecked>
      cc-by-sa 4.0
    </Radio>
  ),
}

export const RadioGroupProviders = {
  render: () => (
    <RadioGroup
      name="provider"
      ariaLabel="transcript provider"
      defaultValue="claude-code"
      options={[
        { value: 'claude-code', label: 'claude-code' },
        { value: 'gemini-cli', label: 'gemini-cli' },
        { value: 'manual-paste', label: 'manual paste' },
        { value: 'internal-tool', label: 'internal tool (disabled)', disabled: true },
      ]}
    />
  ),
}

export const RadioGroupControlled = {
  render: () => {
    const [value, setValue] = useState('public')
    return (
      <div className="check-stack">
        <RadioGroup
          name="visibility"
          ariaLabel="transcript visibility"
          value={value}
          onChange={(v) => setValue(v)}
          options={[
            { value: 'public', label: 'public to the commons' },
            { value: 'collective', label: 'collective members only' },
            { value: 'private', label: 'private draft' },
          ]}
        />
        <p className="muted">selected: {value}</p>
      </div>
    )
  },
}

export const ClicksToCheck = {
  args: { children: 'redact participant names' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const box = canvas.getByRole('checkbox', { name: /redact participant names/i })
    await expect(box).not.toBeChecked()
    await userEvent.click(box)
    await waitFor(() => expect(box).toBeChecked())
  },
}

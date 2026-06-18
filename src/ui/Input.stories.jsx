import Input, { Field, Textarea, Select } from './Input.jsx'
import { Search, Lock } from 'lucide-react'
import { frame } from './story-frame.jsx'

/* input-states stories. CSF3: a Playground driven by argTypes plus one named story per meaningful
   state (label / hint / error / readonly / disabled / icon) and render-fn sections for the Textarea
   and Select siblings. classes + tokens come from src/index.css via .storybook/preview.jsx; the
   theme toolbar flips data-theme. Input is the primary export/component; Field/Textarea/Select are
   shown via render functions under the single meta below. */
const meta = {
  title: 'controls/Input',
  component: Input,
  tags: ['autodocs'],
  decorators: frame('panel'),
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    error: { control: 'text' },
    type: { control: 'select', options: ['text', 'email', 'password', 'search', 'url'] },
    invalid: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    disabled: { control: 'boolean' },
    defaultValue: { control: 'text' },
  },
  args: {
    label: 'collective slug',
    defaultValue: 'fairtrade-commons',
    type: 'text',
  },
}
export default meta

export const Playground = {}

export const WithLabel = {
  args: { label: 'transcript title', defaultValue: 'onboarding a new provider' },
}

export const Hint = {
  args: {
    label: 'provider id',
    defaultValue: 'claude-code',
    hint: 'one of: claude-code, gemini-cli, codex-cli',
  },
}

export const Error = {
  args: {
    label: 'collective slug',
    defaultValue: 'fairtrade commons',
    error: 'slug may only contain lowercase letters, numbers and dashes',
  },
}

export const Invalid = {
  args: {
    label: 'collective slug',
    defaultValue: 'bad value',
    invalid: true,
    hint: 'must be a known collective; this one is not registered',
  },
}

export const ReadOnly = {
  args: {
    label: 'transcript id',
    lock: Lock,
    defaultValue: 'tx_8f31c0_redacted',
    readOnly: true,
    hint: 'assigned at ingest, cannot be changed',
  },
}

export const Disabled = {
  args: {
    label: 'redaction key',
    defaultValue: 'unavailable until review',
    disabled: true,
  },
}

export const WithIcon = {
  args: {
    label: 'search transcripts',
    iconLeft: Search,
    type: 'search',
    defaultValue: 'redaction',
    placeholder: 'search the commons',
  },
}

export const IconError = {
  args: {
    label: 'search transcripts',
    iconLeft: Search,
    type: 'search',
    defaultValue: 'redaction',
    error: 'no transcripts match',
  },
}

export const IconReadOnly = {
  args: {
    label: 'indexed query',
    iconLeft: Search,
    type: 'search',
    defaultValue: 'redaction',
    readOnly: true,
    hint: 'the saved query that built this view',
  },
}

export const SelectStory = {
  name: 'Select',
  render: () => (
    <Select
      label="provider"
      defaultValue="claude-code"
      hint="filters the transcript feed by source agent"
      options={[
        { value: 'claude-code', label: 'claude-code' },
        { value: 'gemini-cli', label: 'gemini-cli' },
        { value: 'codex-cli', label: 'codex-cli' },
      ]}
    />
  ),
}

export const TextareaStory = {
  name: 'Textarea',
  render: () => (
    <Textarea
      label="redaction note"
      rows={4}
      defaultValue="redacted two api keys and one email address before sharing with the collective."
      hint="explain what was removed and why; visible to reviewers"
    />
  ),
}

export const FieldComposed = {
  name: 'Field (raw composition)',
  render: () => (
    <Field label="contributor handle" hint="shown on the public ledger" id="contributor">
      {({ id, describedBy }) => (
        <input
          id={id}
          className="input is-input"
          defaultValue="@cooperative-weaver"
          aria-describedby={describedBy}
        />
      )}
    </Field>
  ),
}

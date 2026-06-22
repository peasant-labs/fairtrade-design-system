import { useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import PolicySelect from './PolicySelect.jsx'
import { frame } from './story-frame.jsx'

/* CSF3 stories for the governance policy selector. tokens + classes come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. story data is the three real village
   collective policies (data access, acceptance mode, transcript retention on leave) with the
   verbatim rationale copy from the village create/settings forms. */
const meta = {
  title: 'in use/PolicySelect',
  component: PolicySelect,
  tags: ['autodocs'],
  decorators: frame('panel'),
  argTypes: {
    variant: { control: 'inline-radio', options: ['radio', 'select'] },
    label: { control: 'text' },
    hint: { control: 'text' },
    onChange: { action: 'changed' },
  },
}
export default meta

/* ── the three real village policies ─────────────────────────────────────── */

const DATA_ACCESS = [
  {
    value: 'members_only',
    label: 'members only',
    rationale: 'full members can browse data',
  },
  {
    value: 'contributors',
    label: 'contributors',
    rationale: 'anyone who contributes can browse',
  },
  {
    value: 'public',
    label: 'public',
    rationale: 'anyone can browse the dataset',
  },
]

const ACCEPTANCE = [
  {
    value: 'open',
    label: 'open',
    rationale: 'anyone can share, auto-approved',
  },
  {
    value: 'verified_only',
    label: 'verified only',
    rationale: 'requires org affiliation',
  },
  {
    value: 'curated',
    label: 'curated',
    rationale: 'owner must approve each share',
  },
]

const RETENTION = [
  {
    value: 'user_choice',
    label: "user's choice",
    rationale: 'each leaving member decides whether to retract their contributions.',
  },
  {
    value: 'mandatory',
    label: 'mandatory',
    rationale: "all of a leaving member's contributions are auto-retracted from the collective.",
  },
]

/* ── radio variant: one story per real policy ─────────────────────────────── */

export const DataAccess = {
  args: {
    label: 'data access policy',
    name: 'data-access',
    variant: 'radio',
    options: DATA_ACCESS,
    defaultValue: 'members_only',
  },
}

export const Acceptance = {
  args: {
    label: 'acceptance mode',
    name: 'acceptance-mode',
    variant: 'radio',
    options: ACCEPTANCE,
    defaultValue: 'open',
  },
}

export const Retention = {
  args: {
    label: 'transcript retention on leave',
    name: 'retention',
    variant: 'radio',
    hint: "what happens to a member's shared transcripts when they leave the collective.",
    options: RETENTION,
    defaultValue: 'user_choice',
  },
}

/* ── select variant ──────────────────────────────────────────────────────── */

export const Select = {
  args: {
    label: 'data access policy',
    name: 'data-access-select',
    variant: 'select',
    options: DATA_ACCESS,
    defaultValue: 'members_only',
  },
}

/* a disabled option still renders its rationale but is unselectable + skipped by arrow nav */
export const WithDisabledOption = {
  args: {
    label: 'acceptance mode',
    name: 'acceptance-disabled',
    variant: 'radio',
    options: [
      ACCEPTANCE[0],
      ACCEPTANCE[1],
      { ...ACCEPTANCE[2], rationale: 'owner must approve each share (upgrade to enable)', disabled: true },
    ],
    defaultValue: 'open',
  },
}

/* controlled wrapper so the play test can select a live role=radio and assert aria-checked
   moves to the clicked row and off the previously checked one. */
export const Selects = {
  args: {
    label: 'data access policy',
    name: 'data-access-controlled',
    variant: 'radio',
    options: DATA_ACCESS,
  },
  render: (args) => {
    const [value, setValue] = useState('members_only')
    return <PolicySelect {...args} value={value} onChange={setValue} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const members = canvas.getByRole('radio', { name: /members only/i })
    const publicRow = canvas.getByRole('radio', { name: /public/i })

    await expect(members).toHaveAttribute('aria-checked', 'true')
    await expect(publicRow).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(publicRow)

    await waitFor(() => expect(publicRow).toHaveAttribute('aria-checked', 'true'))
    await expect(members).toHaveAttribute('aria-checked', 'false')
  },
}

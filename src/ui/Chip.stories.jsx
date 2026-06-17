import { useState } from 'react'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import { Hash, Tag, Filter, Bot, ShieldCheck } from 'lucide-react'
import Chip, { FilterChip, StatusDot, CountBadge } from './Chip.jsx'

/* chip family stories. CSF3: a Playground driven by argTypes plus one named story per
   meaningful state / sibling. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. */
const meta = {
  title: 'components/Chip',
  component: Chip,
  tags: ['autodocs'],
  argTypes: {
    tone: { control: 'inline-radio', options: [undefined, 'ok', 'warn', 'err'] },
    size: { control: 'inline-radio', options: [undefined, 'sm'] },
    removable: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: { children: 'claude-code', tone: undefined, size: undefined, removable: false },
}
export default meta

export const Playground = {}

export const WithIcon = { args: { icon: Hash, children: 'transcript-0042' } }

export const ToneOk = { args: { tone: 'ok', icon: ShieldCheck, children: 'redacted' } }
export const ToneWarn = { args: { tone: 'warn', children: 'review pending' } }
export const ToneErr = { args: { tone: 'err', children: 'consent revoked' } }

export const Small = { args: { size: 'sm', icon: Tag, children: 'gemini-cli' } }

export const Tones = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      <Chip icon={Bot}>claude-code</Chip>
      <Chip tone="ok" icon={ShieldCheck}>redacted</Chip>
      <Chip tone="warn">review pending</Chip>
      <Chip tone="err">consent revoked</Chip>
    </div>
  ),
}

export const Removable = {
  args: {
    removable: true,
    icon: Tag,
    children: 'collective: open-commons',
    onRemove: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const x = canvas.getByRole('button', { name: 'remove collective: open-commons' })
    await userEvent.click(x)
    await expect(args.onRemove).toHaveBeenCalledTimes(1)
  },
}

export const Filter_ = {
  name: 'FilterChip',
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      <FilterChip icon={Filter} defaultPressed>claude-code</FilterChip>
      <FilterChip icon={Filter}>gemini-cli</FilterChip>
      <FilterChip icon={Filter}>redacted only</FilterChip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: 'gemini-cli' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'))
    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'false'))
  },
}

export const FilterControlled = {
  name: 'FilterChip (controlled)',
  render: () => {
    const [on, setOn] = useState(false)
    return <FilterChip icon={Filter} pressed={on} onChange={setOn}>redacted only</FilterChip>
  },
}

export const Status = {
  name: 'StatusDot',
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      <StatusDot label="published" color="var(--ok, #6aa84f)" />
      <StatusDot label="awaiting consent" color="var(--warn, #e0a800)" />
      <StatusDot label="withdrawn" color="var(--err, #c0392b)" />
    </div>
  ),
}

export const Count = {
  name: 'CountBadge',
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      <Chip icon={Hash}>transcripts <CountBadge count={128} /></Chip>
      <Chip icon={Bot}>unread <CountBadge count={7} unread /></Chip>
    </div>
  ),
}

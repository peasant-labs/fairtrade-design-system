import { useState } from 'react'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import { Hash, Tag, Filter, Mail, ShieldCheck } from 'lucide-react'
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
    brand: { control: 'inline-radio', options: [undefined, 'claude', 'gemini', 'openai', 'cursor', 'opencode'] },
    chrome: { control: 'boolean' },
    removable: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: { children: 'claude-code', brand: 'claude', tone: undefined, size: undefined, chrome: false, removable: false },
}
export default meta

export const Playground = {}

export const WithIcon = { args: { brand: undefined, icon: Hash, children: 'transcript-0042' } }

export const ToneOk = { args: { brand: undefined, tone: 'ok', icon: ShieldCheck, chrome: true, children: 'redacted' } }
export const ToneWarn = { args: { brand: undefined, tone: 'warn', chrome: true, children: 'review pending' } }
export const ToneErr = { args: { brand: undefined, tone: 'err', chrome: true, children: 'consent revoked' } }

export const Small = { args: { size: 'sm', brand: 'gemini', children: 'gemini-cli' } }

export const SmallTones = {
  render: () => (
    <div className="chips">
      <Chip size="sm" tone="ok" icon={ShieldCheck} chrome>redacted</Chip>
      <Chip size="sm" tone="warn" chrome>review pending</Chip>
      <Chip size="sm" tone="err" chrome>consent revoked</Chip>
    </div>
  ),
}

export const RemovableSmall = {
  args: {
    brand: undefined,
    size: 'sm',
    removable: true,
    icon: Tag,
    children: 'collective: open-commons',
    removeLabel: 'remove collective: open-commons',
    onRemove: fn(),
  },
}

export const Tones = {
  render: () => (
    <div className="chips">
      <Chip brand="claude">claude-code</Chip>
      <Chip tone="ok" icon={ShieldCheck} chrome>redacted</Chip>
      <Chip tone="warn" chrome>review pending</Chip>
      <Chip tone="err" chrome>consent revoked</Chip>
    </div>
  ),
}

export const Removable = {
  args: {
    brand: undefined,
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
    <div className="chips">
      <FilterChip brand="claude" defaultPressed>claude-code</FilterChip>
      <FilterChip brand="gemini">gemini-cli</FilterChip>
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
    <div className="chips">
      <StatusDot label="published" color="var(--olive)" />
      <StatusDot label="awaiting consent" color="var(--amber)" />
      <StatusDot label="withdrawn" color="var(--clay)" />
    </div>
  ),
}

export const StatusDotBare = {
  name: 'StatusDot (bare)',
  render: () => (
    <div className="chips">
      <StatusDot bare label="published" color="var(--olive)" />
      <StatusDot bare label="awaiting consent" color="var(--amber)" />
      <StatusDot bare label="withdrawn" color="var(--clay)" />
    </div>
  ),
}

export const Count = {
  name: 'CountBadge',
  render: () => (
    <div className="chips">
      <Chip icon={Hash} chrome>transcripts <CountBadge count={128} /></Chip>
      <Chip icon={Mail} chrome>unread <CountBadge count={7} unread /></Chip>
    </div>
  ),
}

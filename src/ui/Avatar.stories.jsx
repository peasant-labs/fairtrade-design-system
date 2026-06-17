import Avatar, { AvatarGroup, Kbd, KbdChord, Tag } from './Avatar.jsx'
import { Command, ArrowUp, CornerDownLeft, EyeOff, Bot, GitBranch } from 'lucide-react'

/* identity primitives from the overlays specimen (avatar / kbd / tag). classes + tokens
   come from src/index.css via .storybook/preview.jsx; the theme toolbar flips data-theme.
   CSF3: a Playground driven by argTypes plus one named story per meaningful state, with
   the sibling primitives (AvatarGroup / Kbd / KbdChord / Tag) shown via render fns. */
const meta = {
  title: 'overlays/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    name: { control: 'text' },
    initials: { control: 'text' },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    src: { control: 'text' },
    more: { control: 'boolean' },
  },
  args: { name: 'veil tinker', size: 'md' },
}
export default meta

export const Playground = {}

export const Base = {
  args: { size: undefined },
  parameters: {
    docs: { description: { story: 'the bare 18px tile used inline in transcript meta rows.' } },
  },
}

export const Sizes = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Avatar name="claude code" size="sm" />
      <Avatar name="gemini cli" size="md" />
      <Avatar name="veil tinker" size="lg" />
    </div>
  ),
}

export const ExplicitInitials = {
  args: { name: 'open commons collective', initials: 'CC', size: 'lg' },
}

export const Photo = {
  args: {
    name: 'mara redshift',
    size: 'lg',
    src: 'https://i.pravatar.cc/88?img=47',
  },
  parameters: {
    docs: { description: { story: 'a photo tile with the initials beneath as the decorative fallback.' } },
  },
}

export const PhotoFallback = {
  args: {
    name: 'mara redshift',
    size: 'lg',
    // an inline data: uri that is not decodable as an image: it fires the <img> onError
    // (so the initials fallback triggers) with NO dns/network request, unlike a remote
    // or .invalid url which logs net::ERR_NAME_NOT_RESOLVED resource noise.
    src: 'data:image/png;base64,not-a-real-image',
  },
  parameters: {
    docs: { description: { story: 'a broken src falls back to the initials automatically.' } },
  },
}

export const More = {
  args: { name: '5 more contributors', initials: '+5', more: true, size: 'lg' },
}

export const Group = {
  render: () => (
    <AvatarGroup label="9 contributors">
      <Avatar name="veil tinker" size="md" />
      <Avatar name="mara redshift" size="md" />
      <Avatar name="claude code" initials="CC" size="md" />
      <Avatar name="gemini cli" initials="GC" size="md" />
      <Avatar name="4 more contributors" initials="+4" more size="md" />
    </AvatarGroup>
  ),
}

export const Keys = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      <Kbd>esc</Kbd>
      <Kbd>K</Kbd>
      <Kbd icon={ArrowUp} />
      <Kbd icon={CornerDownLeft} />
    </div>
  ),
}

export const Chord = {
  render: () => (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
      <KbdChord label="command k">
        <Kbd icon={Command} />
        <Kbd>K</Kbd>
      </KbdChord>
      <KbdChord label="control shift p">
        <Kbd>ctrl</Kbd>
        <Kbd>shift</Kbd>
        <Kbd>P</Kbd>
      </KbdChord>
    </div>
  ),
}

export const Tags = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <Tag>transcript</Tag>
      <Tag dot="var(--accent, #d6953b)">commons</Tag>
      <Tag icon={Bot}>claude-code</Tag>
      <Tag icon={GitBranch}>gemini-cli</Tag>
      <Tag icon={EyeOff}>redacted</Tag>
    </div>
  ),
}

export const TagSelected = {
  render: () => <Tag selected dot="var(--accent, #d6953b)">fairtrade</Tag>,
}

export const TagRemovable = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
      <Tag onRemove={() => {}} removeLabel="remove provider filter: claude-code" icon={Bot}>
        claude-code
      </Tag>
      <Tag onRemove={() => {}} removeLabel="remove tag: collective" dot="var(--accent, #d6953b)">
        collective
      </Tag>
    </div>
  ),
}

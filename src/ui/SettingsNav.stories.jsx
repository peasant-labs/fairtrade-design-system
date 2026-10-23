import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { EyeOff, Folder, GitPullRequest, KeyRound, Plug, Send, SlidersHorizontal, UserRound, Users } from 'lucide-react'
import { SettingsLayout, SettingsNav } from './SettingsNav.jsx'
import { SettingGroup, SettingRow } from './Settings.jsx'

/* CSF3 stories for the settings section bar. Sections switches between a collective's settings
   sections the way a routed page does (each a button here; a host passes hrefs); Anchors is one
   long page whose bar follows the reader; Phone runs the same page at 390px, where the bar is one
   row above the sections. the nav data is example data. */

const meta = {
  title: 'in use/SettingsNav',
  component: SettingsNav,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
}
export default meta

const lands = () => new Promise((resolve) => setTimeout(resolve, 400))

const COLLECTIVE_SECTIONS = [
  { id: 'general', label: 'general', icon: SlidersHorizontal },
  { id: 'access', label: 'access', icon: KeyRound },
  { id: 'members', label: 'members', icon: Users },
  { id: 'pull-requests', label: 'pull requests', icon: GitPullRequest },
]

const SECTION_ROWS = {
  general: [
    { label: 'name', control: 'text', value: 'eval-crowd' },
    { label: 'purpose', control: 'text', value: 'shared agent evals for the reading group' },
  ],
  access: [
    { label: 'who can publish', control: 'select', value: 'verified_only', options: [{ value: 'open', label: 'open' }, { value: 'verified_only', label: 'verified only' }, { value: 'curated', label: 'curated' }] },
    { label: 'who can read', control: 'select', value: 'members_only', options: [{ value: 'members_only', label: 'members only' }, { value: 'contributors', label: 'members and contributors' }] },
  ],
  members: [{ label: 'when a member leaves', help: 'what happens to the transcripts they published here.', control: 'select', value: 'user_choice', options: [{ value: 'user_choice', label: 'they choose' }, { value: 'mandatory', label: 'take them out' }] }],
  'pull-requests': [{ label: 'show transcripts on pull requests', help: 'adds a comment and a check listing which commits have transcripts. it never blocks merging.', control: 'switch', value: true }],
}

/* the page the bar sits in: the same frame an app page has, with equal padding on both sides */
function Page({ children }) {
  return <div style={{ padding: 'var(--sp-6)', display: 'grid', gap: 'var(--sp-5)' }}>{children}</div>
}

function Rows({ id }) {
  return SECTION_ROWS[id].map((row) => <SettingRow key={row.label} {...row} onCommit={lands} />)
}

function Routed() {
  const [current, setCurrent] = useState('general')
  const section = COLLECTIVE_SECTIONS.find((entry) => entry.id === current)
  return (
    <Page>
      <h1 style={{ fontSize: 'var(--fs-xl)' }}>eval-crowd, settings</h1>
      <SettingsLayout sections={COLLECTIVE_SECTIONS} currentId={current} onSelect={setCurrent}>
        <SettingGroup label={section.label} defaultOpen>
          <Rows id={current} />
        </SettingGroup>
      </SettingsLayout>
    </Page>
  )
}

export const Sections = {
  render: () => <Routed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nav = canvas.getByRole('navigation', { name: 'settings sections' })
    await expect(within(nav).getByRole('button', { name: 'general' })).toHaveAttribute('aria-current', 'true')
    await userEvent.click(within(nav).getByRole('button', { name: 'access' }))
    await expect(within(nav).getByRole('button', { name: 'access' })).toHaveAttribute('aria-current', 'true')
    await expect(within(nav).getByRole('button', { name: 'general' })).not.toHaveAttribute('aria-current')
    canvasElement.ownerDocument.activeElement?.blur()
  },
}

const ACCOUNT_SECTIONS = [
  { id: 'profile', label: 'profile', icon: UserRound },
  { id: 'redaction', label: 'redaction', icon: EyeOff },
  { id: 'projects', label: 'projects', icon: Folder },
  { id: 'publishing', label: 'automatic publishing', icon: Send },
  { id: 'sources', label: 'sources', icon: Plug },
].map((section) => ({ ...section, href: `#story-settings-${section.id}` }))

function LongPage() {
  return (
    <Page>
      <h1 style={{ fontSize: 'var(--fs-xl)' }}>settings</h1>
      <SettingsLayout sections={ACCOUNT_SECTIONS} currentId="profile" spy>
        <SettingGroup id="story-settings-profile" label="profile" defaultOpen>
          <SettingRow label="handle" control="text" value="mira" onCommit={lands} />
          <SettingRow label="discoverable profile" help="on: your handle shows on your transcripts and in member lists. off: you show as anon." control="switch" value onCommit={lands} />
        </SettingGroup>
        <SettingGroup id="story-settings-redaction" label="redaction" defaultOpen>
          <SettingRow label="level" help="hides secrets, pii, paths and project details." control="select" value="standard" options={[{ value: 'standard', label: 'standard' }]} onCommit={lands} />
        </SettingGroup>
        <SettingGroup id="story-settings-projects" label="projects" defaultOpen>
          <SettingRow label="include new branches automatically" help="only in projects you selected in full." control="switch" value onCommit={lands} />
          <SettingRow label="track new projects automatically" control="switch" value={false} onCommit={lands} />
        </SettingGroup>
        <SettingGroup id="story-settings-publishing" label="automatic publishing" defaultOpen>
          <SettingRow label="~/work/acme/**" help="publishes to acme platform on git push." control="switch" value onCommit={lands} />
        </SettingGroup>
        <SettingGroup id="story-settings-sources" label="sources" defaultOpen>
          <SettingRow label="claude code" help="~/.claude/projects" control="switch" value onCommit={lands} />
          <SettingRow label="codex" help="~/.codex/sessions" control="switch" value onCommit={lands} />
        </SettingGroup>
      </SettingsLayout>
    </Page>
  )
}

export const Anchors = {
  render: () => <LongPage />,
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'settings sections' })
    await expect(within(nav).getByRole('link', { name: 'profile' })).toHaveAttribute('aria-current', 'location')
    await expect(within(nav).getByRole('link', { name: 'sources' })).toHaveAttribute('href', '#story-settings-sources')
  },
}

export const Phone = {
  render: () => <LongPage />,
  parameters: {
    viewport: {
      defaultViewport: 'phone390',
      options: { phone390: { name: 'phone, 390', styles: { width: '390px', height: '780px' } } },
    },
  },
}

import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { PublishStateLabel, PublishBar, AccessList, CollectivePicker, PublishDialog, PUBLISH_STATES } from './Publish.jsx'
import { frame } from './story-frame.jsx'

/* in use/Publish: the parts of the one outward action. Every part is controlled; these stories
   hold the state a host would. One story per label value and per popup state the fixture names
   (scripts/testdata/publish-states.yaml). */
const meta = {
  title: 'in use/Publish',
  component: PublishDialog,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen', controls: { include: [] } },
}
export default meta

const SCAN = {
  total: 37,
  matches: [
    { id: 'm1', category: 'CREDENTIAL', confidence: 0.99, before: 'AKIAIOSFODNN7EXAMPLE', after: '<AWS_ACCESS_KEY>' },
    { id: 'm2', category: 'PII', confidence: 0.97, before: 'alice@acme.dev', after: '<EMAIL>' },
    { id: 'm3', category: 'PATH', confidence: 0.91, before: '/Users/alice/work/acme/ingest-api', after: '/Users/<USER>/work/acme/ingest-api' },
  ],
}
const ACCESS = [
  { id: 'platform', name: 'Acme Platform', members: 12, note: 'suggested · repo acme/ingest-api is linked' },
  { id: 'company', name: 'Acme Company', members: 87, note: 'suggested · github org acme' },
]
const DONE = { url: 'https://village.peasantlabs.org/transcripts/3f9c0a17', collectives: ['Acme Platform', 'Acme Company'], pullRequest: { number: 42, branch: 'fix/flaky-ingest' } }

function Popup({ state, mode = 'publish', access = ACCESS, done = DONE, ...rest }) {
  const [auto, setAuto] = useState(false)
  const [items, setItems] = useState(access)
  return (
    <PublishDialog
      open
      onClose={fn()}
      title="Fix flaky ingest test"
      mode={mode}
      state={state}
      scan={SCAN}
      onRescan={fn()}
      access={items}
      onRemove={(id) => setItems((list) => list.filter((item) => item.id !== id))}
      picker={{ suggestions: [{ id: 'ml', name: 'ML Reading Group', members: 21, note: 'curated · waits for the owner’s approval' }], onAdd: fn() }}
      autoPublish={{ checked: auto, onChange: setAuto }}
      onPublish={fn()}
      onConnect={fn()}
      joinHref="#collectives"
      stoppedAt="setting who can read it"
      onRetry={fn()}
      done={done}
      {...rest}
    />
  )
}

/* every label value, as the bar shows it */
export const BarStates = {
  name: 'bar, every state',
  decorators: frame('wide'),
  parameters: { layout: 'centered' },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--sp-4)' }}>
      {PUBLISH_STATES.map((state) => (
        <PublishBar key={state} state={state} collectives={2} newTurns={6} collective="Acme Platform" onAction={fn()} moreItems={[{ label: 'copy link' }]} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('published · 2 collectives · 6 new turns')).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: 'update' })).toHaveLength(1)
    await expect(canvas.getAllByRole('button', { name: 'manage' })).toHaveLength(2)
  },
}

export const Label = {
  name: 'state label',
  decorators: frame('panel'),
  parameters: { layout: 'padded' },
  render: () => <PublishStateLabel state="auto-publish" collective="Acme Platform" />,
}

export const PopupConnect = { name: 'popup, connect to village first', render: () => <Popup state="connect" /> }
export const PopupWaitingGithub = { name: 'popup, waiting for github', render: () => <Popup state="waiting-github" /> }
export const PopupChecking = { name: 'popup, checking for sensitive content', render: () => <Popup state="checking" /> }
export const PopupScanFailed = {
  name: 'popup, the scan failed',
  render: () => <Popup state="scan-failed" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByRole('button', { name: 'publish to 2 collectives' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 're-scan' })).toBeEnabled()
    await expect(canvas.getByRole('alert')).toHaveTextContent('the scan failed, so publish is off.')
  },
}
export const PopupNoCollective = { name: 'popup, not in a collective yet', render: () => <Popup state="no-collective" access={[]} /> }
export const PopupReady = {
  name: 'popup, ready to publish',
  render: () => <Popup state="ready" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: 'show matches' }))
    await expect(canvas.getAllByText('redacted').length).toBeGreaterThan(0)
    await expect(canvas.queryByRole('button', { name: 'keep' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'remove Acme Company' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: 'publish to 1 collective' })).toBeEnabled())
  },
}
export const PopupPublishing = { name: 'popup, publishing', render: () => <Popup state="publishing" /> }
export const PopupStopped = { name: 'popup, stopped at a step', render: () => <Popup state="stopped" /> }
export const PopupDone = { name: 'popup, done', render: () => <Popup state="done" /> }
export const PopupWaitsApproval = {
  name: 'popup, waits for approval',
  render: () => <Popup state="waits-approval" done={{ ...DONE, collectives: ['Acme Platform'], pending: ['ML Reading Group'] }} />,
}
export const PopupUpdate = {
  name: 'popup, update',
  render: () => (
    <Popup
      state="ready"
      mode="update"
      onRestore={fn()}
      changes={{ summary: '6 new turns since you published · 1 new match, redacted' }}
      access={[{ id: 'platform', name: 'Acme Platform', members: 12 }, { id: 'company', name: 'Acme Company', members: 87 }, { id: 'ml', name: 'ML Reading Group', members: 21, pending: 'approval' }]}
      accessSummary="adds ML Reading Group · removes nothing"
    />
  ),
}

export const Access = {
  name: 'access list',
  decorators: frame('panel'),
  parameters: { layout: 'centered' },
  render: () => (
    <AccessList
      items={[...ACCESS, { id: 'ml', name: 'ML Reading Group', members: 21, pending: 'removal' }]}
      onRemove={fn()}
      onRestore={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'remove Acme Platform' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'keep ML Reading Group' })).toBeVisible()
    await expect(canvas.getByText(/removing · loses access when you update/)).toBeVisible()
  },
}

export const Picker = {
  name: 'collective picker',
  decorators: frame('panel'),
  parameters: { layout: 'padded' },
  render: function PickerStory() {
    const all = [
      { id: 'platform', name: 'Acme Platform', members: 12, note: 'suggested · repo acme/ingest-api is linked' },
      { id: 'ml', name: 'ML Reading Group', members: 21, note: 'curated · waits for the owner’s approval' },
    ]
    const [query, setQuery] = useState('')
    const [added, setAdded] = useState([])
    const suggestions = all.filter((c) => !added.includes(c.id) && c.name.toLowerCase().includes(query.toLowerCase()))
    return <CollectivePicker query={query} onQueryChange={setQuery} suggestions={suggestions} onAdd={(id) => setAdded((list) => [...list, id])} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('searchbox', { name: 'add a collective' }), 'ml')
    await userEvent.click(canvas.getByRole('button', { name: 'add ML Reading Group' }))
    await expect(canvas.getByText('no collective matches that name.')).toBeVisible()
  },
}

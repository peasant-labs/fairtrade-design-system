import { expect, userEvent, waitFor, within } from 'storybook/test'
import { SettingRow, SettingGroup } from './Settings.jsx'
import { frame } from './story-frame.jsx'

/* in use/Settings: rows that save per field and groups that collapse. Each row gets `onCommit`, an
   async write; these stories stand in for the host with timed promises. One story per case the
   fixture names (scripts/testdata/setting-row.yaml). */
const meta = {
  title: 'in use/Settings',
  component: SettingRow,
  tags: ['autodocs'],
  decorators: frame('wide'),
  parameters: { controls: { include: [] } },
}
export default meta

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const lands = () => wait(400)
const holds = () => new Promise(() => {})
const fails = async () => { await wait(300); throw new Error('village did not answer. your setting is unchanged.') }

export const Idle = { render: () => <SettingRow label="include new branches automatically" help="only in projects you selected in full." control="switch" value onCommit={lands} /> }

export const Pending = {
  render: () => <SettingRow label="include new branches automatically" control="switch" value={false} onCommit={holds} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch'))
    await expect(canvas.getByText('saving')).toBeVisible()
  },
}

export const Settled = {
  render: () => <SettingRow label="track new projects automatically" control="switch" value={false} onCommit={lands} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch'))
    await waitFor(() => expect(canvas.getByText('saved')).toBeVisible())
  },
}

export const Failed = {
  render: () => <SettingRow label="discoverable profile" help="on: your handle shows on your transcripts." control="switch" value onCommit={fails} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch'))
    await waitFor(() => expect(canvas.getByRole('alert')).toHaveTextContent('village did not answer.'))
    await expect(canvas.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    await expect(canvas.getByText('not saved')).toBeVisible()
  },
}

export const Select = {
  render: () => <SettingRow label="publishing plan" help="picked at setup. it never publishes on its own." control="select" value="keep-local" options={[{ value: 'keep-local', label: 'keep local' }, { value: 'publish-later', label: 'publish later' }]} onCommit={lands} />,
}

export const Checkbox = {
  render: () => <SettingRow label="send the project name" control="checkbox" value onCommit={lands} />,
}

export const TextEdit = {
  name: 'text, edit and save',
  render: () => <SettingRow label="purpose" control="text" value="Transcripts behind the ingest service." onCommit={lands} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'edit purpose' }))
    const field = canvas.getByRole('textbox', { name: 'purpose' })
    await userEvent.clear(field)
    await userEvent.type(field, 'Transcripts behind the ingest and web services.{Enter}')
    await waitFor(() => expect(canvas.getByText('saved')).toBeVisible())
    await expect(canvas.getByText('Transcripts behind the ingest and web services.')).toBeVisible()
  },
}

export const TextCancel = {
  name: 'text, edit and cancel',
  render: () => <SettingRow label="your email" control="text" value="alice@acme.dev" onCommit={lands} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'edit your email' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'your email' }), 'x{Escape}')
    await expect(canvas.getByText('alice@acme.dev')).toBeVisible()
  },
}

export const Tagged = {
  name: 'with the tag',
  render: () => <SettingRow label="track new projects automatically" control="switch" value tag="not in peasant config" onCommit={lands} />,
}

export const Groups = {
  name: 'open and collapsed groups',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <SettingGroup label="village" defaultOpen>
        <SettingRow label="publishing plan" help="picked at setup. it never publishes on its own." control="select" value="keep-local" options={[{ value: 'keep-local', label: 'keep local' }, { value: 'publish-later', label: 'publish later' }]} onCommit={lands} />
        <SettingRow label="track new projects automatically" control="switch" value={false} tag="not in peasant config" onCommit={lands} />
      </SettingGroup>
      <SettingGroup label="advanced">
        <SettingRow label="your email" control="text" value="alice@acme.dev" onCommit={lands} />
      </SettingGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const groups = canvasElement.querySelectorAll('details')
    await expect(groups[0]).toHaveAttribute('open')
    await expect(groups[1]).not.toHaveAttribute('open')
  },
}

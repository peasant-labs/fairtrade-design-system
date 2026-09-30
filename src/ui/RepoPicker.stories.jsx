import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import RepoPicker from './RepoPicker.jsx'

/* in use/RepoPicker: pick many repositories at once. Owners carry their identity (an organisation
   icon or a user's avatar, plus the word); save reports the difference from the starting set. */
const OWNERS = [
  {
    id: 'acme', login: 'acme', kind: 'org', repos: [
      { id: 'acme/ingest-api', name: 'acme/ingest-api', private: true },
      { id: 'acme/web', name: 'acme/web' },
      { id: 'acme/worker', name: 'acme/worker', note: '3 members publish from it' },
      { id: 'acme/cli', name: 'acme/cli', note: '1 member publishes from it' },
      { id: 'acme/sdk-js', name: 'acme/sdk-js' },
      { id: 'acme/sdk-go', name: 'acme/sdk-go' },
    ],
  },
  { id: 'vitor', login: 'vitor', kind: 'user', repos: [{ id: 'vitor/notes', name: 'vitor/notes' }] },
]

const meta = {
  title: 'in use/RepoPicker',
  component: RepoPicker,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen', controls: { include: [] } },
}
export default meta

export const Default = {
  render: function Picker() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>manage</button>
        <RepoPicker open={open} onClose={() => setOpen(false)} owners={OWNERS} initialSelected={['acme/ingest-api', 'acme/web']} title="link repositories from acme" description="pull requests in linked repos show the transcripts published to Acme Platform." onSave={fn()} />
      </>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    const count = canvasElement.ownerDocument.querySelector('.rpk-count')
    await expect(count).toHaveTextContent('2 of 7 selected')
    await userEvent.type(canvas.getByRole('searchbox', { name: 'search repos' }), 'sdk')
    await userEvent.click(canvas.getByRole('button', { name: 'select all' }))
    await expect(count).toHaveTextContent('4 of 7 selected')
    await expect(canvas.getByRole('button', { name: 'save: link 2 repositories' })).toBeEnabled()
  },
}

export const EmptySearch = {
  name: 'empty search result',
  render: () => <RepoPicker open onClose={fn()} owners={OWNERS} initialSelected={[]} onSave={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.type(canvas.getByRole('searchbox', { name: 'search repos' }), 'zzz')
    await expect(canvas.getByText('no repository matches “zzz”.')).toBeVisible()
  },
}

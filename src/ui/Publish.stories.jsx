import { useEffect, useRef, useState } from 'react'
import { RedactionCategory } from '@peasant-labs/schema'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { PublishStateLabel, PublishBar, AccessList, CollectivePicker, PublishDialog, PUBLISH_STATES } from './Publish.jsx'
import { frame } from './story-frame.jsx'
import YAML from 'yaml'
import mountedSource from '../../scripts/testdata/publish-mounted.yaml?raw'

const mountedFixture = YAML.parse(mountedSource)

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
    { id: 'm1', category: RedactionCategory.Secrets, confidence: 0.99, before: 'AKIAIOSFODNN7EXAMPLE', after: '<AWS_ACCESS_KEY>' },
    { id: 'm2', category: RedactionCategory.PII, confidence: 0.97, before: 'alice@acme.dev', after: '<EMAIL>' },
    { id: 'm3', category: RedactionCategory.Paths, confidence: 0.91, before: '/Users/alice/work/acme/ingest-api', after: '/Users/<USER>/work/acme/ingest-api' },
  ],
}
const ACCESS = [
  { id: 'platform', name: 'Acme Platform', members: 12, note: 'suggested, repo acme/ingest-api is linked' },
  { id: 'company', name: 'Acme Company', members: 87, note: 'suggested, github org acme' },
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
      picker={{ suggestions: [{ id: 'ml', name: 'ML Reading Group', members: 21, note: 'curated, waits for the owner’s approval' }], onAdd: fn() }}
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
    await expect(canvas.getByText('published, 2 collectives, 6 new turns')).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: 'update' })).toHaveLength(3)
    await expect(canvas.queryByRole('button', { name: 'manage' })).toBeNull()
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
  /* the popup is fixed to the viewport; the root takes the viewport's height so a capture of the
     story root holds it */
  decorators: [(Story) => <div style={{ minHeight: '100vh' }}><Story /></div>],
  render: () => <Popup state="scan-failed" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByRole('button', { name: 'publish to 2 collectives' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 're-scan' })).toBeEnabled()
    await expect(canvas.getByRole('alert')).toHaveTextContent('the scan failed, so publish is off.')
  },
}

/* while checking: the step being done, the count so far and, when a step runs long, why publish waits */
export const PopupCheckingStage = {
  name: 'popup, checking, with its stage',
  decorators: [(Story) => <div style={{ minHeight: '100vh' }}><Story /></div>],
  render: () => <Popup state="checking" checking={{ stage: 'scanning 468 turns…', progress: { done: 120, total: 468 }, note: 'taking longer than usual (12s): every turn is checked for secrets and personal details on this computer before anything is sent. publish waits for it.' }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    const status = canvas.getByRole('status')
    await expect(status).toHaveTextContent('scanning 468 turns…')
    await expect(status).toHaveTextContent('120 of 468')
    await expect(status).toHaveTextContent('publish waits for it.')
  },
}

/* the host's one plain line, its one fixing action and its actionable detail, all in the same box */
export const PopupScanFailedDetail = {
  name: 'popup, the scan failed, with a detail',
  decorators: [(Story) => <div style={{ minHeight: '100vh' }}><Story /></div>],
  render: () => <Popup state="scan-failed" scan={{ ...SCAN, failure: 'this session needs a quick re-index before it can be published', failureAction: { label: 're-index and retry', onSelect: fn() }, failureDetail: 'index out of date: 3 turns changed since the last index.\nre-index ran: no; another index update was running on this computer.\nfix: re-index this session, then scan again.' }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByRole('alert')).toHaveTextContent('this session needs a quick re-index')
    await expect(canvas.getByRole('button', { name: 're-index and retry' })).toBeEnabled()
    await userEvent.click(canvas.getByText('details'))
    await expect(canvas.getByText(/index out of date: 3 turns changed/)).toBeVisible()
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
export const PopupKept = {
  name: 'popup, a match kept un-redacted',
  render: () => <Popup state="ready" scan={{ ...SCAN, matches: SCAN.matches.map((match) => ({ ...match, kept: match.id === 'm2' })) }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByText(/kept un-redacted, will be sent/)).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'hide matches' })).toHaveAttribute('aria-expanded', 'true')
  },
}
export const PopupUnscanned = {
  name: 'popup, not scanned yet',
  render: () => <Popup state="ready" scan={undefined} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByText(/not scanned yet, so publish is off/)).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'publish to 2 collectives' })).toBeDisabled()
  },
}
export const PopupPublishing = { name: 'popup, publishing', render: () => <Popup state="publishing" /> }
export const PopupStopped = { name: 'popup, stopped at a step', render: () => <Popup state="stopped" /> }
export const PopupStoppedDetail = {
  name: 'popup, stopped, with a detail',
  render: () => (
    <Popup
      state="stopped"
      stoppedAt="reading your collectives"
      stoppedDetail={'list collectives: reach peasant online: Get "http://127.0.0.1:3001/api/v1/collectives": dial tcp 127.0.0.1:3001: connect: connection refused'}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByText('stopped while reading your collectives.')).toBeInTheDocument()
    await expect(canvas.queryAllByText(/review who can read it/)).toHaveLength(0)
    await userEvent.click(canvas.getByText('details'))
    await expect(canvas.getByText(/connect: connection refused/)).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: /retry/ })).toHaveLength(1)
  },
}
export const PopupCollectivesFailed = {
  name: 'popup, collectives cannot load',
  render: () => (
    <Popup
      state="ready"
      access={[]}
      accessFailure={{ line: 'can’t load your collectives right now', detail: 'list collectives: reach peasant online: connection refused', onRetry: fn() }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByText('can’t load your collectives right now')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'retry loading your collectives' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'publish' })).toBeDisabled()
  },
}
export const PopupScanNote = {
  name: 'popup, a note on the scanned copy',
  render: () => (
    <Popup
      state="ready"
      scan={{ ...SCAN, note: { line: 'one line in this session couldn’t be read, so the copy being published stops before it.', detail: 'line 50 of the recording: unexpected end of JSON input' } }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByText(/copy being published stops before it/)).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'publish to 2 collectives' })).toBeEnabled()
  },
}
export const PopupLongTitle = {
  name: 'popup, a long session title',
  render: () => <Popup state="ready" title="step 0: benchmark the transfer handler and mail the numbers to <EMAIL>, then compare them with last week's run and write up where the time goes" />,
}
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
      changes={{ summary: '6 new turns since you published, 1 new match, redacted' }}
      access={[{ id: 'platform', name: 'Acme Platform', members: 12 }, { id: 'company', name: 'Acme Company', members: 87 }, { id: 'ml', name: 'ML Reading Group', members: 21, pending: 'approval' }]}
      accessSummary="adds ML Reading Group, removes nothing"
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
    await expect(canvas.getByText(/removing, loses access when you update/)).toBeVisible()
  },
}

export const Picker = {
  name: 'collective picker',
  decorators: frame('panel'),
  parameters: { layout: 'padded' },
  render: function PickerStory() {
    const all = [
      { id: 'platform', name: 'Acme Platform', members: 12, note: 'suggested, repo acme/ingest-api is linked' },
      { id: 'ml', name: 'ML Reading Group', members: 21, note: 'curated, waits for the owner’s approval' },
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

/* A host-controlled flow, driven by the mounted keyboard row rather than play(). */
export const KeyboardWalk = {
  render: function KeyboardWalkStory() {
    const [open, setOpen] = useState(false)
    const [state, setState] = useState('ready')
    const [bar, setBar] = useState('not-published')
    const [auto, setAuto] = useState(false)
    const timer = useRef(null)
    useEffect(() => () => clearTimeout(timer.current), [])
    return (
      <div style={{ padding: 'var(--sp-5)' }}>
        <p>publish your redacted transcript to its collectives, then return to the transcript.</p>
        <PublishBar state={bar} collectives={2} onAction={() => { setState('ready'); setOpen(true) }} />
        <PublishDialog
          open={open} onClose={() => setOpen(false)} title="Fix flaky ingest test" state={state}
          scan={SCAN} access={ACCESS} done={DONE} onRescan={() => setState('checking')}
          autoPublish={{ checked: auto, onChange: setAuto, hint: 'selected collectives, overlapping rules still apply, change them in settings' }}
          onPublish={() => {
            setState('publishing')
            setBar('publishing')
            timer.current = setTimeout(() => { setState('done'); setBar('published') }, 3000)
          }}
        />
      </div>
    )
  },
}

/* An ordinary async host callback. The native journey controls its remote dependency, not
   the dialog's implementation or state: pending lasts until the response actually arrives. */
export const HeldCompletion = {
  render: function HeldCompletionStory() {
    const [open,setOpen]=useState(false)
    const [state,setState]=useState('ready')
    const [publishCalls,setPublishCalls]=useState(0)
    const [closeCalls,setCloseCalls]=useState(0)
    const requests=useRef(new Set())
    useEffect(()=>()=>{for(const request of requests.current)request.abort()},[])
    const publish=async()=>{
      setPublishCalls(value=>value+1)
      setState('publishing')
      const request=new AbortController()
      requests.current.add(request)
      try {
        const response=await fetch(mountedFixture.pending.endpoint,{method:mountedFixture.pending.method,signal:request.signal})
        if(!response.ok)throw new Error('The fixture publication was refused.')
        setState('done')
      } catch(error) {if(!request.signal.aborted)setState('stopped')}
      finally {requests.current.delete(request)}
    }
    return <div style={{padding:'var(--sp-5)'}}>
      <output aria-label="host publish calls">{publishCalls}</output>
      <output aria-label="host close calls">{closeCalls}</output>
      <PublishBar state="not-published" onAction={()=>{setState('ready');setOpen(true)}} />
      <PublishDialog open={open} state={state} title="Recorded session" scan={SCAN} access={ACCESS} done={DONE}
        onRescan={()=>{}} onPublish={publish} onClose={()=>{setCloseCalls(value=>value+1);setOpen(false)}} />
    </div>
  },
}

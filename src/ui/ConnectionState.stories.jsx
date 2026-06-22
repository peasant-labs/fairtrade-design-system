import { Compass } from 'lucide-react'
import { expect, within } from 'storybook/test'
import { ConnectionPill, DataState, TeachingEmptyState } from './ConnectionState.jsx'
import { frame } from './story-frame.jsx'

/* ConnectionState story. CSF3, title 'in use/ConnectionState'. the local-program connection
   family, modeled on peasant's ConnectionState / ConnectionStatus + IngestTeach / BlankSlate:

   - Pills:        the three glanceable states side by side (live / connecting / disconnected).
                   each reads without color — dot tone + icon + word — with the local-first note.
   - Disconnected: the calm content-area panel for when a dropped local socket is why the body is
                   empty (the key rule: disconnected != empty), wired through DataState with retry.
   - TeachingEmpty: the empty-that-teaches — "run peasant ingest", a copy-able $ command chip, and
                   the privacy line. wired through DataState's `empty` slot (connected, but empty).
   - Loading:      DataState's skeleton, so "empty" is never shown before the answer is in.

   the theme toolbar flips data-theme; LightTheme pins light. chrome (the pill word, the chip, the
   buttons) is mono + lowercase; the command is code (mono, not lowercased); guidance is body prose.
   cx-* rules + tokens live in ConnectionState.css (imported by the component). */

// the teaching empty used across the empty + the DataState stories — one copy, one voice: what the
// command does, in plain words, then the local-first promise.
const INGEST_TEACH = (
  <TeachingEmptyState
    title="no ai work recorded yet"
    body="run the command below in your terminal. it scans this computer for your ai coding conversations — claude code, codex, and others — and shows what it finds here."
    command="peasant ingest"
  />
)

const meta = {
  title: 'in use/ConnectionState',
  component: ConnectionPill,
  tags: ['autodocs'],
  decorators: frame('wide'),
  argTypes: {
    status: { control: 'inline-radio', options: ['live', 'connecting', 'disconnected'] },
    showNote: { control: 'boolean' },
  },
}
export default meta

// ── Pills: the three glanceable states ───────────────────────────────────────
// stacked so the dot tone + icon + word read down the column; none rides on color alone.
export const Pills = {
  parameters: { controls: { include: [] } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
      <ConnectionPill status="live" />
      <ConnectionPill status="connecting" />
      <ConnectionPill status="disconnected" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // each state is announced (role=status) and names itself in words, not color alone.
    expect(canvas.getByText('live')).toBeInTheDocument()
    expect(canvas.getByText('connecting')).toBeInTheDocument()
    expect(canvas.getByText('disconnected')).toBeInTheDocument()

    // the local-first note leads the live pill.
    expect(canvas.getByText('on this computer · no internet')).toBeInTheDocument()
  },
}

// a single pill, driven by the controls — flip status / toggle the note.
export const SinglePill = {
  render: (args) => <ConnectionPill {...args} />,
  args: { status: 'live', showNote: true },
}

// ── Disconnected: the lost-connection panel ──────────────────────────────────
// DataState with status='disconnected' resolves to the calm panel + retry, NOT the empty slot —
// even though an empty slot is provided. that is the whole point: a dropped socket is not "empty".
export const Disconnected = {
  parameters: { controls: { include: [] } },
  render: () => (
    <DataState
      status="disconnected"
      empty
      emptyState={INGEST_TEACH}
      onRetry={() => {}}
    >
      <p>this content never shows while disconnected.</p>
    </DataState>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // the panel — not the empty teach state — wins, and it reads plainly.
    expect(canvas.getByText(/lost connection to the local program/i)).toBeInTheDocument()
    expect(canvas.getByText(/may have stopped/i)).toBeInTheDocument()

    // disconnected != empty: the "no ai work recorded yet" teach copy must NOT be on screen.
    expect(canvas.queryByText(/no ai work recorded yet/i)).not.toBeInTheDocument()

    // a retry is offered.
    expect(canvas.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  },
}

// ── TeachingEmpty: the empty-that-teaches ────────────────────────────────────
// connected, request resolved, genuinely nothing here → the teaching slot, with the copy-able
// command chip + the privacy line.
export const TeachingEmpty = {
  parameters: { controls: { include: [] } },
  render: () => (
    <DataState status="live" empty emptyState={INGEST_TEACH}>
      <p>real content goes here when there is some.</p>
    </DataState>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // the teach state names the mechanism + shows the command as code.
    expect(canvas.getByText('no ai work recorded yet')).toBeInTheDocument()
    expect(canvas.getByText('peasant ingest')).toBeInTheDocument()

    // the privacy line — the local-first promise.
    expect(canvas.getByText('nothing leaves your machine')).toBeInTheDocument()
  },
}

// a standalone teach state with a different icon + command, driven plainly (no DataState wrapper).
export const TeachingStandalone = {
  parameters: { controls: { include: [] } },
  render: () => (
    <TeachingEmptyState
      icon={Compass}
      title="no map yet"
      body="build a map of this project's ai work from what's already on disk — no upload, no account."
      command="peasant map ./my-project"
    />
  ),
}

// ── Loading: the skeleton ────────────────────────────────────────────────────
// while loading, DataState shows a skeleton — never "empty" before the answer is in.
export const Loading = {
  parameters: { controls: { include: [] } },
  render: () => (
    <DataState status="connecting" loading empty emptyState={INGEST_TEACH}>
      <p>content, once loaded.</p>
    </DataState>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // the skeleton is busy + announced, and the empty teach copy is NOT shown yet.
    const skel = canvas.getByRole('status')
    expect(skel).toHaveAttribute('aria-busy', 'true')
    expect(canvas.queryByText(/no ai work recorded yet/i)).not.toBeInTheDocument()
  },
}

export const LightTheme = {
  parameters: { controls: { include: [] } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
      <ConnectionPill status="live" />
      <ConnectionPill status="connecting" />
      <ConnectionPill status="disconnected" />
      {INGEST_TEACH}
    </div>
  ),
  globals: { theme: 'light', backgrounds: { value: 'light' } },
}

import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'
import TranscriptViewer from './TranscriptViewer.jsx'
import { frame } from '../story-frame.jsx'
import { piPayload } from '../../mockups/inuse/pi-fixture.js'
import { adaptTranscript } from './adapter.js'
import { readingPayload } from '../../mockups/inuse/reading-fixture.js'
import { integrityBoundProps, integrityOtherHash } from '../../mockups/inuse/integrity-fixture.js'
import { INTEGRITY_COPY } from './integrity.js'

export const Pi = {
  args: { viewModel: adaptTranscript(piPayload) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tool = canvas.getByRole('button', { name: /Orchard.CheckPlan/ })
    await userEvent.click(tool)
    /* the tool body opens with a height animation, so wait for it to be shown rather than assert on the first frame */
    await waitFor(() => expect(canvas.getByText('error result')).toBeVisible())
    await waitFor(() => expect(canvas.getByText('recorded tool details')).toBeVisible())
    await expect(canvas.queryByText('MetadataOnlyNeedle')).toBeNull()
  },
}

/* TranscriptViewer story — the composite single-transcript surface. CSF3, title
   'in use/transcript/TranscriptViewer'. It renders EVERY surface from one cooked
   TranscriptViewModel: chrome + tabs + rails + scrubber + scorecard + the trace canvas
   (turn cards + phase/task/checkpoint markers) + the highlights/diffs/files/annotations tabs.
   The play functions document the two contractually-required behaviours:
     • state DEFAULTS — unmanaged, the viewer opens on the trace tab in dark theme;
     • capability GATING — the per-turn "label" affordance renders only when canLabel is true. */

const readTool = {
  id: 't1a', name: 'Read', kind: 'read', group: 'read', preview: 'TurnRow.tsx',
  filePath: 'src/canvas/TurnRow.tsx', args: { file_path: 'src/canvas/TurnRow.tsx' },
  output: 'export function TurnRow() {}',
}
const bashFail = {
  id: 't4a', name: 'Bash', kind: 'execute', group: 'bash', preview: 'pnpm -r typecheck',
  exitCode: 2, isError: true, durationMs: 4100, args: { command: 'pnpm -r typecheck' },
  output: "src/lib/tasks.ts(48,9): error TS2532: Object is possibly 'undefined'.",
}
const editTool = {
  id: 't5a', name: 'Edit', kind: 'edit', group: 'edits', preview: 'tasks.ts', filePath: 'src/lib/tasks.ts',
  adds: 3, dels: 1, args: { file_path: 'src/lib/tasks.ts' },
  diff: [{ lines: [
    { sign: 'ctx', oldNo: '46', newNo: '46', text: '  const groups = groupByTask(turns)' },
    { sign: 'del', oldNo: '47', text: '  const first = groups[0]' },
    { sign: 'add', newNo: '47', text: '  const first = groups[0]' },
    { sign: 'add', newNo: '48', text: '  if (!first) return null' },
  ] }],
}

const turns = [
  { index: 0, role: 'user', label: '1', depth: 0, content: 'Port the transcript canvas into the shared package. Read the renderer first.', toolCalls: [], annotations: [], tokens: { in: 280, out: 0 }, timestamp: '8m ago' },
  { index: 1, role: 'assistant', label: '1a', depth: 0, provider: 'claude-code', effectiveModel: 'anthropic/claude-fable-5', content: 'Reading **TurnRow.tsx** before extracting it.', thinking: { text: 'The renderer lives under canvas/. Read TurnRow.tsx first.', words: 16 }, toolCalls: [readTool], annotations: [], tokens: { in: 1840, out: 920 }, timestamp: '8m ago' },
  { index: 2, role: 'assistant', label: '2a', depth: 0, provider: 'claude-code', effectiveModel: 'anthropic/claude-opus-4-8', modelChangedFrom: 'anthropic/claude-fable-5', isError: true, content: 'Running the workspace typecheck first.', toolCalls: [bashFail], annotations: [{ id: 'a1', kind: 'error', turn: 2, label: 'typecheck failed', preview: 'TS2532' }], tokens: { in: 2400, out: 1180 }, timestamp: '6m ago' },
  { index: 3, role: 'assistant', label: '2b', depth: 0, provider: 'claude-code', effectiveModel: 'anthropic/claude-opus-4-8', content: 'The index access is unguarded; adding a null-guard.', toolCalls: [editTool], annotations: [], tokens: { in: 2600, out: 1320 }, timestamp: '5m ago' },
  { index: 4, role: 'assistant', label: '2c', depth: 1, agentName: 'docs-writer', effectiveModel: 'anthropic/claude-opus-4-8', content: 'Documenting the props/callback/capability contract.', toolCalls: [], annotations: [], tokens: { in: 1700, out: 1140 }, timestamp: '3m ago' },
]

const viewModel = {
  session: {
    id: 'sess_dem', harness: 'claude-code', startTime: '', endTime: '', durationMins: 8,
    totalTokens: 18400, tokensIn: 12200, tokensOut: 6200, turnCount: 5, toolCallCount: 3,
    project: 'transcript-browser', model: 'anthropic/claude-fable-5', outcome: 'resolved',
    git: { branch: 'main', insertions: 312, deletions: 24, commits: [{ hash: '9f3c1ad0', shortHash: '9f3c1ad', message: 'feat(canvas): port TurnRow + tool renderers', turn: 3, adds: 312, dels: 24, files: 7 }] },
  },
  turns,
  toolCallsById: new Map([[readTool.id, readTool], [bashFail.id, bashFail], [editTool.id, editTool]]),
  diffs: [{ path: 'src/lib/tasks.ts', leaf: 'tasks.ts', adds: 3, dels: 1, turn: 3, toolCallId: 't5a', hunks: editTool.diff }],
  files: [
    { path: 'src/lib/tasks.ts', leaf: 'tasks.ts', reads: 0, writes: 0, edits: 1, deletes: 0, adds: 3, dels: 1, edited: true, turn: 3 },
    { path: 'src/canvas/TurnRow.tsx', leaf: 'TurnRow.tsx', reads: 1, writes: 0, edits: 0, deletes: 0, adds: 0, dels: 0, edited: false, turn: 1 },
  ],
  tasks: [
    { id: 't0', index: 1, prompt: 'Port the transcript canvas into the shared package.', turnIndices: [0, 1], durationMs: 300000, tools: 1, outcome: 'ok' },
  ],
  highlights: [
    { id: 'h1', kind: 'request', turn: 0, title: 'initial request', sub: 'Port the transcript canvas…', time: '8m ago' },
    { id: 'h3', kind: 'error', turn: 2, title: 'pnpm -r typecheck failed', sub: '1 failed, exit 2', err: true },
    { id: 'h4', kind: 'checkpoint', turn: 3, title: '9f3c1ad', sub: 'feat(canvas): port TurnRow', stat: '+312 −24, 7 files' },
  ],
  filterIndex: { toolGroupCounts: { edits: 1, bash: 1, read: 1, search: 0, fetch: 0, tasks: 0, other: 0 }, annotationsByTurn: { 2: [{ id: 'a1', kind: 'error', turn: 2, label: 'typecheck failed' }] }, tags: ['errors'], tagCounts: { errors: 1 }, totalTurns: 5 },
  analytics: {
    phases: [
      { id: 'exploration', label: 'exploration', from: 0, to: 1 },
      { id: 'debugging', label: 'debugging', from: 2, to: 2, errors: 1 },
      { id: 'implementation', label: 'implementation', from: 3, to: 4 },
    ],
    scorecardBands: [
      { id: 'token', label: 'token efficiency', band: 'watch', value: '8% retry tokens', detail: '1,300 tokens spent on the retry after typecheck' },
      { id: 'prompt', label: 'prompt quality', band: 'ok', value: 'spec 72/100', detail: 'has examples, no explicit constraints' },
      { id: 'loop', label: 'loop efficiency', band: 'good', value: '1 max error streak', detail: 'recovered in 1 turn' },
    ],
    patternAnnotations: [
      { id: 'a1', kind: 'error', turn: 2, label: 'pnpm -r typecheck, exit 2', preview: "src/lib/tasks.ts(48,9): error TS2532" },
      { id: 'a2', kind: 'revert', turn: 3, label: 'tasks.ts edited after a failed run', preview: 'strict-mode index guard added' },
      { id: 'a3', kind: 'subagent', turn: 4, label: 'docs-writer, depth 1', preview: 'Task spawned a nested subagent' },
    ],
  },
}

/* a peasant-local shell grants everything; a read-only public viewer grants nothing. */
const fullCaps = { canEdit: true, canLabel: true, canContribute: true, canChangeVisibility: true, canExport: true }
const readOnlyCaps = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }

const meta = {
  title: 'in use/transcript/TranscriptViewer',
  component: TranscriptViewer,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: frame('full'),
}
export default meta

/* Unmanaged: only the two required props. Proves the state defaults (trace tab, dark theme). */
export const Default = {
  args: { viewModel, capabilities: fullCaps, callbacks: { onLabel: fn() } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    expect(canvas.getAllByText('#1').length).toBeGreaterThan(0)
    // Turn labelling is intentionally absent in the ledger presentation.
    expect(canvas.queryByRole('button', { name: 'label', exact: true })).toBeNull()
    const turn = canvasElement.querySelector('#turn-1 .txn-turn')
    await userEvent.click(turn)
    expect(turn).toHaveClass('txn-active')
    expect(within(turn).getByRole('button', { name: 'copy link to turn 1a' })).toBeVisible()
    expect(args.callbacks.onLabel).not.toHaveBeenCalled()
  },
}

export const ClassicLabel = {
  args: { viewModel, capabilities: fullCaps, presentation: 'classic', callbacks: { onLabel: fn() } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    expect(canvas.getAllByText('#1').length).toBeGreaterThan(0)
    expect(canvas.getAllByText('label').length).toBeGreaterThan(0)
    await userEvent.click(within(canvasElement.querySelector('#turn-0')).getByRole('button', { name: 'label', exact: true }))
    expect(canvas.getByText('label turn 0')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'save label' }))
    expect(args.callbacks.onLabel).toHaveBeenCalledWith(0, { outcome: 'neutral', flag: '' })
  },
}

// a host's trail, as online passes it for a transcript opened from a collective: with room on the row
// every crumb reads whole
export const HostTrail = {
  args: {
    viewModel,
    capabilities: readOnlyCaps,
    breadcrumb: [{ label: 'collectives', href: '#collectives' }, { label: 'AI Research Collective', href: '#collective' }, { label: 'Port the transcript canvas into the shared package' }],
  },
}

// a trail longer than the row: the title gives way first; on a phone, once it is down to its floor, the
// collective shortens too
export const HostTrailLong = {
  args: {
    viewModel,
    capabilities: readOnlyCaps,
    breadcrumb: [
      { label: 'collectives', href: '#collectives' },
      { label: 'The Distributed Systems and Agent Reliability Research Collective of the Northern Valley', href: '#collective' },
      { label: 'Port the transcript canvas into the shared package, then rewire every consumer of the old renderer and delete it once the last import is gone' },
    ],
  },
}

// one crumb longer than the whole row (a long repository name): it shortens with an ellipsis and the
// current crumb, the session id, reads whole
export const HostTrailOverlong = {
  args: {
    viewModel,
    capabilities: readOnlyCaps,
    breadcrumb: [
      { label: 'sessions', href: '#sessions' },
      { label: 'github.com:peasant-demo/a-project-with-a-deliberately-long-repository-name-that-has-to-wrap-on-small-screens-and-still-goes-on-past-the-widest-desktop-header-row', href: '#project' },
      { label: '0f3c2a10' },
    ],
  },
}

// a host's trail for a transcript opened from a pull request, as online passes it: two links that fit a
// phone's row with room to spare on any platform's text rendering, and read whole
export const HostTrailPull = {
  args: {
    viewModel,
    capabilities: readOnlyCaps,
    breadcrumb: [{ label: 'pull requests', href: '#pulls' }, { label: 'peasant-labs/village#7', href: '#pull' }],
  },
}

// a long collective name as the current crumb: it reads whole while the row has room and shortens only
// when the row is full
export const HostTrailCollectiveLong = {
  args: {
    viewModel,
    capabilities: readOnlyCaps,
    breadcrumb: [
      { label: 'collectives', href: '#collectives' },
      { label: 'The Distributed Systems and Agent Reliability Research Collective of the Northern Valley', href: '#collective' },
    ],
  },
}

export const Highlights = { args: { viewModel, capabilities: fullCaps, activeTab: 'highlights' } }
export const Diffs = { args: { viewModel, capabilities: fullCaps, activeTab: 'diffs' } }
export const Files = { args: { viewModel, capabilities: fullCaps, activeTab: 'files' } }
export const Annotations = { args: { viewModel, capabilities: fullCaps, activeTab: 'annotations' } }
export const LightTheme = { args: { viewModel, capabilities: fullCaps, theme: 'light' } }

/* ── ledger presentation ──────────────────────────────────────────────────────
   The opt-in reading surface: a subtitle under the title, the pinned header's title +
   visible-turns minimap in place of the provider/model + scrubber, and one card per
   user-turn task in the left rail (its #turn, duration, prompt) in place of the duration
   waterfall. Two tasks and seven turns here so both cards and both rail states are real. */
const ledgerTurns = [
  { ...turns[0], label: '1' },
  { ...turns[1], label: '1a' },
  { ...turns[2], label: '1b' },
  { ...turns[3], label: '1c', toolCalls: [editTool, readTool] },
  { ...turns[4], label: '1d' },
  { index: 5, role: 'user', label: '2', depth: 0, content: 'Run the next check and show me the result.', toolCalls: [], annotations: [], tokens: { in: 120, out: 0 }, timestamp: '2m ago' },
  { index: 6, role: 'assistant', label: '2a', depth: 0, provider: 'claude-code', effectiveModel: 'anthropic/claude-opus-4-8', content: 'Running the workspace check.', toolCalls: [readTool], annotations: [], tokens: { in: 400, out: 300 }, timestamp: '1m ago' },
  /* a system notice reads as one compact row in the ledger, not a full card */
  { index: 7, role: 'system', label: '3', depth: 0, time: '1m ago', content: 'session resumed, worktree changed on disk', toolCalls: [], annotations: [] },
]

const ledgerViewModel = {
  ...viewModel,
  session: { ...viewModel.session, turnCount: ledgerTurns.length, toolCallCount: 5 },
  turns: ledgerTurns,
  tasks: [
    { id: 't0', index: 1, prompt: 'Port the transcript canvas into the shared package. Read the renderer first.', turnIndices: [0, 1, 2, 3, 4], durationMs: 300000, tools: 3, outcome: 'ok' },
    { id: 't1', index: 2, prompt: 'Run the next check and show me the result.', turnIndices: [5, 6], durationMs: 35000, tools: 1, outcome: 'ok' },
  ],
}

const ledgerArgs = {
  viewModel: ledgerViewModel,
  capabilities: fullCaps,
  presentation: 'ledger',
  subtitle: 'a public transcript from fairtrade, read as a ledger.',
}

// The ledger chrome lives in the pinned trace header, so its stories need the viewer to fill a
// real height and the trace to actually scroll (a story height of `auto` leaves the stream with
// nothing to scroll, and the pinned header is a scroll state).
const ledgerFrame = (Story) => (
  <div style={{ height: '100vh', minHeight: 640, display: 'flex' }}>
    <Story />
  </div>
)

export const Ledger = {
  decorators: [ledgerFrame],
  args: ledgerArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the subtitle renders under the session title.
    await expect(canvas.getByText(ledgerArgs.subtitle)).toBeVisible()
    // the rail lists one card per task, and the classic duration waterfall is gone.
    await expect(canvasElement.querySelectorAll('.txn-rail-turn')).toHaveLength(ledgerViewModel.tasks.length)
    expect(canvasElement.querySelector('.txn-ol-waterfall')).toBeNull()
    // the classic per-task identity chip would repeat the rail card and the turn head.
    expect(canvasElement.querySelector('.txn-taskboundary')).toBeNull()
    // the pinned header appears once the trace scrolls, with the title and one position slider.
    // each user turn's actions share one block after its first prose turn; no turn keeps its own.
    await expect(canvasElement.querySelectorAll('.txn-modelactions')).toHaveLength(2)
    expect(canvasElement.querySelector('.txn-work')).toBeNull()
    await expect(canvas.getByText('4 actions: 1 command, 1 file, 1 edit, 4.1s')).toBeVisible()
    await expect(canvas.getByText('1 action: 1 file')).toBeVisible()
    // a system turn is a compact row, and its recorded text opens on request.
    const systemHead = canvasElement.querySelector('.txn-systemrow-head')
    await expect(systemHead).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(systemHead)
    await expect(systemHead).toHaveAttribute('aria-expanded', 'true')
    // the pinned header appears once the trace scrolls, with the title and the minimap.
    const stream = canvasElement.querySelector('.txn-stream')
    stream.scrollTop = stream.scrollHeight
    await fireEvent.scroll(stream)
    const slider = await canvas.findByRole('slider', { name: 'transcript timeline' })
    expect(slider.querySelectorAll('.txn-minimap-seg')).toHaveLength(ledgerTurns.length)
    expect(within(slider).queryAllByRole('button')).toHaveLength(0)
    expect(slider).toHaveAttribute('aria-valuemax', String(ledgerTurns.length - 1))
    expect(slider.getAttribute('aria-valuetext')).toMatch(new RegExp(`^turn .+ of ${ledgerTurns.length}$`))
    expect(canvasElement.querySelector('.txn-sticky .txn-scrub')).toBeNull()
  },
}

export const LedgerLightTheme = { name: 'ledger light theme', decorators: [ledgerFrame], args: { ...ledgerArgs, theme: 'light' }, play: readingLayoutPlay }

/* The reading layout: a width handle on the reader's trailing edge and the floating zen
   control. The frame is compact so both stay in view. Width only moves the column; openness
   is user state, so tightening or widening never reopens a collapsed rail, and zen returns
   the exact rail configuration it found. The same play runs in both themes: it also measures
   the two geometry claims jsdom cannot see (the collapsed strip width and the shared work
   grid edge). */
const readingFrame = (Story) => (
  <div style={{ height: 720, display: 'flex' }}>
    <Story />
  </div>
)

/** the left edge of an element's TEXT, not its padded box (the summary carries the offset as padding). */
function textLeft(element) {
  const range = document.createRange()
  range.selectNodeContents(element)
  return range.getBoundingClientRect().left
}

/** the rendered geometry the stylesheet rows can only describe: a strip's computed width and
    the work summary's left edge against the first tool name's. */
async function assertReadingGeometry(canvasElement) {
  const block = canvasElement.querySelector('.txn-modelactions')
  expect(block).not.toBeNull()
  // the action block is its own row after the card, its counts on the same reading edge as the prose.
  const summary = block.querySelector('.txn-modelactions-summary')
  expect(summary).not.toBeNull()
  const prose = canvasElement.querySelector('.txn-turnwrap-ledger .txn-body > .txn-md-prose')
  expect(prose).not.toBeNull()
  expect(Math.abs(textLeft(summary) - textLeft(prose))).toBeLessThanOrEqual(2)
  // the ledger prose follows the reader width instead of a fixed ch cap.
  expect(getComputedStyle(prose).maxInlineSize).toBe('none')
}

async function readingLayoutPlay({ canvasElement }) {
  const canvas = within(canvasElement)
  const handle = canvas.getByRole('separator', { name: 'reading width' })
  expect(handle).toHaveAttribute('aria-valuemin', '600')
  // the widest snap is the stream's whole content width, measured, not a fixed number.
  const stream = canvasElement.querySelector('.txn-stream')
  const streamStyle = getComputedStyle(stream)
  const fullWidth = Math.floor(stream.clientWidth - parseFloat(streamStyle.paddingLeft) - parseFloat(streamStyle.paddingRight))
  await waitFor(() => expect(handle).toHaveAttribute('aria-valuemax', String(Math.max(600, fullWidth))))
  // the default 840 renders at the space it has when the stream is narrower than that.
  expect(handle).toHaveAttribute('aria-valuenow', String(Math.max(600, Math.min(840, fullWidth))))
  expect(handle).toHaveAttribute('aria-orientation', 'vertical')
  expect(handle).toHaveAttribute('tabindex', '0')
  await assertReadingGeometry(canvasElement)
  // there are no snaps: the arrows step by 40px, Home reaches the minimum and End reaches full.
  handle.focus()
  await userEvent.keyboard('{Home}')
  expect(handle).toHaveAttribute('aria-valuenow', '600')
  await userEvent.keyboard('{ArrowRight}')
  expect(handle).toHaveAttribute('aria-valuenow', String(Math.min(640, Number(handle.getAttribute('aria-valuemax')))))
  await userEvent.keyboard('{End}')
  expect(handle).toHaveAttribute('aria-valuetext', 'full width')
  expect(handle).toHaveAttribute('aria-valuenow', handle.getAttribute('aria-valuemax'))
  // at full the column runs to the stream's content edge, up to the zen lane.
  const row = canvasElement.querySelector('.txn-ledger .txn-turnrow')
  const contentRight = stream.getBoundingClientRect().right - parseFloat(streamStyle.paddingRight) - (stream.offsetWidth - stream.clientWidth)
  expect(Math.abs(row.getBoundingClientRect().right - contentRight)).toBeLessThanOrEqual(2)
  await userEvent.keyboard('{ArrowLeft}')
  expect(handle).toHaveAttribute('aria-valuenow', String(Math.max(600, Number(handle.getAttribute('aria-valuemax')) - 40)))
  await userEvent.keyboard('{Home}')
  expect(handle).toHaveAttribute('aria-valuenow', '600')
  // collapse the outline, then change the width both ways: the strip must stay closed.
  // (the rail controls drop below the two-rail breakpoint, so the story drives the mounted
  // control directly rather than through the accessibility tree.)
  const collapse = canvasElement.querySelector('.txn-rail-left .txn-rail-collapse')
  expect(collapse).not.toBeNull()
  await userEvent.click(collapse)
  // the collapse is a committed re-render, so wait for the strip the collapsed grid produces
  // before measuring it: reading the computed width on the same tick intermittently observes the
  // pre-collapse 240px grid column.
  await waitFor(() => {
    expect(canvasElement.querySelector('.txn-rail-strip-left')).not.toBeNull()
    const strip = canvasElement.querySelector('.txn-rail-strip')
    expect(strip).not.toBeNull()
    // below the transcript's two-rail breakpoint the strips are dropped entirely; the story's
    // frame is desktop, where the collapsed strip measures the square hit target.
    if (getComputedStyle(strip).display !== 'none') expect(getComputedStyle(strip).width).toBe('32px')
  })
  handle.focus()
  await userEvent.keyboard('{End}')
  await waitFor(() => expect(canvasElement.querySelector('.txn-rail-strip-left')).not.toBeNull())
  await userEvent.keyboard('{Home}')
  await waitFor(() => expect(canvasElement.querySelector('.txn-rail-strip-left')).not.toBeNull())
  // zen hides both rails and their strips; exiting restores the snapshot exactly.
  await userEvent.click(canvas.getByRole('button', { name: 'zen mode' }))
  await waitFor(() => {
    expect(canvasElement.querySelector('.txn-rail')).toBeNull()
    expect(canvasElement.querySelector('.txn-rail-strip')).toBeNull()
  })
  expect(canvas.getByRole('button', { name: 'zen mode' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(canvas.getByRole('button', { name: 'zen mode' }))
  await waitFor(() => {
    expect(canvasElement.querySelector('.txn-rail-left')).toBeNull()
    expect(canvasElement.querySelector('.txn-rail-strip-left')).not.toBeNull()
    expect(canvasElement.querySelector('.txn-rail-right')).not.toBeNull()
  })
}

export const LedgerReadingLayout = {
  name: 'ledger reading layout',
  decorators: [readingFrame],
  args: ledgerArgs,
  play: readingLayoutPlay,
}

/* The phone header: the derived trail leaves (its last crumb is the title, so it repeats the h1),
   the title clamps to two lines at the reading size, the chips share one scrollable line, and the
   keybind hint row leaves a touch surface. The session views stay: they are the bottom bar's first
   row, with the search trigger reduced to its icon.
   Storybook's viewport is a manager control that resizes the preview iframe; the headless smoke
   loads iframe.html directly at its own width, so this story measures the rendered header when the
   preview really is a phone and otherwise proves the phone breakpoint's declarations from the
   parsed stylesheet. The 390x844 rendering itself is captured by the review harness. */
export const PhoneHeader = {
  name: 'phone header',
  decorators: [readingFrame],
  parameters: { viewport: { defaultViewport: 'phone' } },
  args: { ...ledgerArgs, showSearchTrigger: true },
  play: async ({ canvasElement }) => {
    const title = canvasElement.querySelector('.txn-title')
    const crumb = canvasElement.querySelector('.txn-crumb')
    const hint = canvasElement.querySelector('.txn-hint')
    const tabs = canvasElement.querySelector('.txn-footer .txn-foot-tabs [role="tablist"]')
    expect(title).not.toBeNull()
    expect(crumb).not.toBeNull()
    expect(tabs).not.toBeNull()
    expect(canvasElement.querySelectorAll('.txn-footer [role="tab"]').length).toBe(5)
    if (window.innerWidth < 768) {
      const titleStyle = getComputedStyle(title)
      expect(titleStyle.webkitLineClamp).toBe('2')
      // two lines at most, measured against the rendered line box
      const lineHeight = parseFloat(titleStyle.lineHeight)
      expect(title.getBoundingClientRect().height).toBeLessThanOrEqual(lineHeight * 2 + 1)
      expect(getComputedStyle(crumb).display).toBe('none')
      expect(hint === null || getComputedStyle(hint.closest('.txn-foot-meta')).display).toBe('none')
      expect(getComputedStyle(tabs.closest('.txn-foot-tabs')).display).not.toBe('none')
    } else {
      // the phone breakpoint: the title clamps at two lines, the derived trail and the hint row leave.
      const flat = (list) => [...list].flatMap((rule) => {
        if (rule.cssRules) return [rule, ...flat(rule.cssRules)]
        return [rule]
      })
      const rules = [...document.styleSheets].flatMap((sheet) => {
        try { return flat(sheet.cssRules) } catch { return [] }
      })
      const phone = rules.filter((rule) => typeof rule.conditionText === 'string' && rule.conditionText.includes('768px') && rule.conditionText.includes('width'))
      expect(phone.length).toBeGreaterThan(0)
      const cssText = phone.map((rule) => rule.cssText).join('\n')
      expect(cssText).toMatch(/\.txn-title\s*{[^}]*-webkit-line-clamp:\s*2/)
      expect(cssText).toMatch(/\.txn-crumb-derived\s*{\s*display:\s*none/)
      // the built sheet may merge this selector into an :is(...) list, so match inside the rule body
      expect(cssText).toMatch(/\.txn-hint[^{}]*{[^}]*display:\s*none/)
    }
  },
}

/* ── integrity flag ───────────────────────────────────────────────────────────
   A served integrity flag draws one outlined badge button at the top right of the title row, which
   opens a short explanation, and a mark on each flagged turn (a glyph and a word, never a fill).
   The reading session flags two turns: an assistant prose turn and the tool-only turn the ledger
   folds into its action block. Without a bound content hash the badge draws alone. There is no
   clean or verified state: a transcript with no flag draws nothing. */
const integrityArgs = {
  viewModel: adaptTranscript(readingPayload()),
  capabilities: fullCaps,
  presentation: 'ledger',
  subtitle: 'a public transcript from fairtrade, read as a ledger.',
  ...integrityBoundProps,
}

export const IntegrityFlagged = {
  decorators: [ledgerFrame],
  args: integrityArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const help = canvas.getByRole('button', { name: INTEGRITY_COPY.helpName })
    expect(canvasElement.querySelectorAll('.txn-integrity-badge')).toHaveLength(1)
    expect(canvasElement.querySelectorAll('.txn-integrity-mark').length).toBeGreaterThan(0)
    expect(help).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(help)
    expect(help).toHaveAttribute('aria-expanded', 'true')
    // the panel fades in, so wait for it to settle before asserting it is visible
    await waitFor(() => expect(canvas.getByRole('region', { name: INTEGRITY_COPY.panelHeading })).toBeVisible())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(help).toHaveAttribute('aria-expanded', 'false'))
    expect(help).toHaveFocus()
  },
}

export const IntegrityFlaggedLight = { name: 'integrity flagged light', decorators: [ledgerFrame], args: { ...integrityArgs, theme: 'light' } }

export const IntegrityFlaggedClassic = {
  name: 'integrity flagged classic',
  decorators: [ledgerFrame],
  args: { ...integrityArgs, presentation: 'classic', subtitle: undefined },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('.txn-integrity-badge')).toHaveLength(1)
    expect(canvasElement.querySelectorAll('.txn-integrity-mark').length).toBeGreaterThan(0)
  },
}

export const IntegrityHashMismatch = {
  name: 'integrity hash mismatch',
  decorators: [ledgerFrame],
  args: { ...integrityArgs, contentHash: integrityOtherHash },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('.txn-integrity-badge')).toHaveLength(1)
    expect(canvasElement.querySelectorAll('.txn-integrity-mark')).toHaveLength(0)
  },
}

export const IntegrityPhone = {
  name: 'integrity phone',
  decorators: [readingFrame],
  parameters: { viewport: { defaultViewport: 'phone' } },
  args: integrityArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: INTEGRITY_COPY.helpName }))
    const panel = await canvas.findByRole('region', { name: INTEGRITY_COPY.panelHeading })
    const rect = panel.getBoundingClientRect()
    const frame = canvasElement.getBoundingClientRect()
    expect(rect.left).toBeGreaterThanOrEqual(frame.left - 1)
    expect(rect.right).toBeLessThanOrEqual(frame.right + 1)
  },
}

export const ReadingPositionTraceTab = {
  args: { viewModel, capabilities: fullCaps },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /files/ }))
    await expect(canvas.queryByRole('button', { name: /return to trace/i })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /tasks\.ts, jump to diffs/ }))
    await expect(canvas.getByRole('tab', { name: /diffs/ })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(canvas.getByRole('tab', { name: /full trace/ }))
    await expect(canvas.getByRole('tab', { name: /full trace/ })).toHaveAttribute('aria-selected', 'true')
  },
}

export const ReadOnlyFileTraceTab = {
  args: { viewModel, capabilities: fullCaps },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /files/ }))
    await userEvent.click(canvas.getByRole('button', { name: /TurnRow\.tsx, jump to last read/ }))
    const fullTrace = canvas.getByRole('tab', { name: /full trace/ })
    await expect(fullTrace).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.queryByRole('button', { name: /return to trace/i })).toBeNull()
    await userEvent.click(fullTrace)
    await expect(fullTrace).toHaveAttribute('aria-selected', 'true')
  },
}

export const HostControlsScrollWithTranscript = {
  args: {
    viewModel,
    capabilities: fullCaps,
    streamPrelude: (
      <section style={{ border: 'var(--bd)', padding: 'var(--sp-3)', color: 'var(--ink-2)' }}>
        host transcript controls scroll away before the first turn
      </section>
    ),
  },
}

/* Read-only public viewer: every capability off. Proves the gating — NO per-turn label affordance,
   so the onLabel callback can never fire. */
export const ReadOnly = {
  args: { viewModel, capabilities: readOnlyCaps },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getAllByText('#1').length).toBeGreaterThan(0)
    // canLabel:false → the label affordance is gone.
    expect(canvas.queryByText('label')).toBeNull()
  },
}

/* Graph mode plugs a consumer render-prop (fairtrade's own `/graph` @xyflow engine in production);
   the composite has no graph engine of its own. */
export const GraphSlot = {
  args: {
    viewModel,
    capabilities: fullCaps,
    viewMode: 'graph',
    graphSlot: ({ activeTurn }) => (
      <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--ink-3)' }}>
        consumer graph engine, active turn {activeTurn}
      </div>
    ),
  },
}

/* A host that owns its header row: the composite's share and more menus leave (showTail false),
   the outcome chip leaves (showOutcome false), the search trigger joins the session views in the
   bottom bar, and the host's pull request list sits under the meta row. The trigger opens search
   by click and by Enter, exactly as ⌘F does. */
export const HostOwnedHeader = {
  name: 'host owned header',  args: {
    viewModel,
    capabilities: fullCaps,
    showTail: false,
    showOutcome: false,
    showSearchTrigger: true,
    headerActions: <button type="button" className="btn btn-primary btn-sm">publish</button>,
    utilityActions: <button type="button" className="btn btn-secondary btn-sm">copy transcript</button>,
    pullRequests: (
      <ul className="chips" aria-label="pull requests" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        <li><a className="chip mono" href="#pr-42">acme/ingest-api #42</a></li>
        <li><a className="chip mono" href="#pr-45">acme/ingest-api #45</a></li>
      </ul>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: /^share/ })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'more actions' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'publish' })).toBeVisible()
    const trigger = canvas.getByRole('button', { name: 'search transcript ⌘F' })
    await userEvent.click(trigger)
    await expect(canvas.getByRole('textbox', { name: 'search transcript' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect(canvas.queryByRole('textbox', { name: 'search transcript' })).toBeNull()
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByRole('textbox', { name: 'search transcript' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
  },
}

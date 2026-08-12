import { expect, userEvent, within } from 'storybook/test'
import TranscriptViewer from './TranscriptViewer.jsx'
import { frame } from '../story-frame.jsx'

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
  { index: 1, role: 'assistant', label: '1a', depth: 0, provider: 'claude-code', content: 'Reading **TurnRow.tsx** before extracting it.', thinking: { text: 'The renderer lives under canvas/. Read TurnRow.tsx first.', words: 16 }, toolCalls: [readTool], annotations: [], tokens: { in: 1840, out: 920 }, timestamp: '8m ago' },
  { index: 2, role: 'assistant', label: '2a', depth: 0, provider: 'claude-code', isError: true, content: 'Running the workspace typecheck first.', toolCalls: [bashFail], annotations: [{ id: 'a1', kind: 'error', turn: 2, label: 'typecheck failed', preview: 'TS2532' }], tokens: { in: 2400, out: 1180 }, timestamp: '6m ago' },
  { index: 3, role: 'assistant', label: '2b', depth: 0, provider: 'claude-code', content: 'The index access is unguarded; adding a null-guard.', toolCalls: [editTool], annotations: [], tokens: { in: 2600, out: 1320 }, timestamp: '5m ago' },
  { index: 4, role: 'assistant', label: '2c', depth: 1, agentName: 'docs-writer', content: 'Documenting the props/callback/capability contract.', toolCalls: [], annotations: [], tokens: { in: 1700, out: 1140 }, timestamp: '3m ago' },
]

const viewModel = {
  session: {
    id: 'sess_dem', harness: 'claude-code', startTime: '', endTime: '', durationMins: 8,
    totalTokens: 18400, tokensIn: 12200, tokensOut: 6200, turnCount: 5, toolCallCount: 3,
    project: 'transcript-browser', model: 'claude-opus-4-7', outcome: 'resolved',
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
    { id: 'h3', kind: 'error', turn: 2, title: 'pnpm -r typecheck failed', sub: '1 failed · exit 2', err: true },
    { id: 'h4', kind: 'checkpoint', turn: 3, title: '9f3c1ad', sub: 'feat(canvas): port TurnRow', stat: '+312 −24 · 7 files' },
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
      { id: 'prompt', label: 'prompt quality', band: 'ok', value: 'spec 72/100', detail: 'has examples · no explicit constraints' },
      { id: 'loop', label: 'loop efficiency', band: 'good', value: '1 max error streak', detail: 'recovered in 1 turn' },
    ],
    patternAnnotations: [
      { id: 'a1', kind: 'error', turn: 2, label: 'pnpm -r typecheck · exit 2', preview: "src/lib/tasks.ts(48,9): error TS2532" },
      { id: 'a2', kind: 'revert', turn: 3, label: 'tasks.ts edited after a failed run', preview: 'strict-mode index guard added' },
      { id: 'a3', kind: 'subagent', turn: 4, label: 'docs-writer · depth 1', preview: 'Task spawned a nested subagent' },
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
  args: { viewModel, capabilities: fullCaps },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // state default → the trace tab is active and the turn cards render.
    expect(canvas.getAllByText('#1').length).toBeGreaterThan(0)
    // canLabel:true → the per-turn label affordance is wired.
    expect(canvas.getAllByText('label').length).toBeGreaterThan(0)
  },
}

export const Highlights = { args: { viewModel, capabilities: fullCaps, activeTab: 'highlights' } }
export const Diffs = { args: { viewModel, capabilities: fullCaps, activeTab: 'diffs' } }
export const Files = { args: { viewModel, capabilities: fullCaps, activeTab: 'files' } }
export const Annotations = { args: { viewModel, capabilities: fullCaps, activeTab: 'annotations' } }
export const LightTheme = { args: { viewModel, capabilities: fullCaps, theme: 'light' } }

export const ReadingPositionTraceTab = {
  args: { viewModel, capabilities: fullCaps },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /files/ }))
    await expect(canvas.queryByRole('button', { name: /return to trace/i })).toBeNull()
    await userEvent.click(canvas.getByRole('row', { name: /tasks\.ts/ }))
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
    await userEvent.click(canvas.getByRole('row', { name: /TurnRow\.tsx/ }))
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

/* Graph mode plugs a consumer render-prop (transcript-browser's @xyflow engine in production); the composite has
   no graph engine of its own. */
export const GraphSlot = {
  args: {
    viewModel,
    capabilities: fullCaps,
    viewMode: 'graph',
    graphSlot: ({ activeTurn }) => (
      <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--ink-3)' }}>
        consumer graph engine · active turn {activeTurn}
      </div>
    ),
  },
}

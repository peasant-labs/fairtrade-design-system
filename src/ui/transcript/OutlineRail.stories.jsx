import { expect, within } from 'storybook/test'
import OutlineRail from './OutlineRail.jsx'
import { frame } from '../story-frame.jsx'

/* OutlineRail story (exported as TranscriptOutlineRail). Reads the cooked slices off the view
   model and projects a different outline per tab (trace waterfall / diffs / files / highlights /
   annotations). */

const viewModel = {
  turns: [
    { index: 0, role: 'user', annotations: [] },
    { index: 1, role: 'assistant', annotations: [] },
  ],
  files: [
    { path: 'src/lib/tasks.ts', leaf: 'tasks.ts', reads: 0, writes: 0, edits: 1, deletes: 0, adds: 3, dels: 1, edited: true, turn: 1 },
    { path: 'src/canvas/TurnRow.tsx', leaf: 'TurnRow.tsx', reads: 1, writes: 0, edits: 0, deletes: 0, adds: 0, dels: 0, edited: false, turn: 0 },
  ],
  highlights: [
    { id: 'h1', kind: 'request', turn: 0, title: 'initial request' },
    { id: 'h3', kind: 'error', turn: 1, title: 'typecheck failed', err: true },
  ],
  tasks: [{ id: 't0', index: 1, prompt: 'Port the transcript canvas into the shared package.', turnIndices: [0], durationMs: 300000, tools: 1, outcome: 'ok' }],
  analytics: {
    patternAnnotations: [
      { id: 'a1', kind: 'error', turn: 1, label: 'typecheck failed', preview: 'TS2532' },
      { id: 'a3', kind: 'subagent', turn: 1, label: 'docs-writer · depth 1' },
    ],
  },
}

const meta = {
  title: 'in use/transcript/TranscriptOutlineRail',
  component: OutlineRail,
  tags: ['autodocs'],
  decorators: frame('narrow'),
}
export default meta

export const Trace = { args: { viewModel, tab: 'trace' } }
export const Diffs = { args: { viewModel, tab: 'diffs' } }
export const Files = { args: { viewModel, tab: 'files' } }
export const Highlights = {
  args: { viewModel, tab: 'highlights' },
  play: async ({ canvasElement }) => {
    // vm.highlights backs the highlights outline.
    expect(within(canvasElement).getByText('initial request')).toBeInTheDocument()
  },
}
export const Annotations = { args: { viewModel, tab: 'annotations' } }

import { expect, within } from 'storybook/test'
import ToolBody from './ToolBody.jsx'
import { frame } from '../story-frame.jsx'

/* ToolBody story. CSF3, title 'in use/transcript/ToolBody'. One story per cooked ToolGroup so
   all six lifted renderers — read / edit / bash / grep (search) / webfetch (fetch) / task — plus
   the catch-all render from a ToolCallVM. WebFetch has NO fixture in the canonical mockup, so
   its story is the only render anchor for that renderer (it has no canonical app-render anchor). */

const read = {
  id: 'r', name: 'Read', kind: 'read', group: 'read',
  preview: 'TurnRow.tsx', filePath: 'src/canvas/TurnRow.tsx',
  args: { file_path: 'src/canvas/TurnRow.tsx', offset: 1, limit: 3 },
  output: 'export function TurnRow() {\n  return null\n}',
}

// an edit whose final diff line is a TRAILING EMPTY (the LCS \n artifact) — DiffHunks trims it.
const edit = {
  id: 'e', name: 'Edit', kind: 'edit', group: 'edits',
  preview: 'tasks.ts', filePath: 'packages/browser/src/lib/tasks.ts', adds: 1, dels: 0,
  args: { file_path: 'packages/browser/src/lib/tasks.ts' },
  diff: [
    {
      lines: [
        { sign: 'ctx', oldNo: '46', newNo: '46', text: 'const first = groups[0]' },
        { sign: 'add', newNo: '47', text: '  if (!first) return null' },
        { sign: 'ctx', oldNo: '47', newNo: '48', text: 'return first.turns[0].index' },
        { sign: 'add', text: '' },
      ],
    },
  ],
}

const bash = {
  id: 'b', name: 'Bash', kind: 'execute', group: 'bash',
  preview: 'pnpm -r typecheck', exitCode: 2, isError: true, durationMs: 4200,
  args: { command: 'pnpm -r typecheck', description: 'workspace typecheck before moving files' },
  output: 'tasks.ts(47,9): error TS2532: Object is possibly undefined.',
}

const grep = {
  id: 'g', name: 'Grep', kind: 'search', group: 'search',
  preview: '"rendererFor"',
  args: { pattern: 'rendererFor', path: 'src', type: 'ts' },
  output: 'src/canvas/rendererFor.ts:12\nsrc/canvas/ToolCallRow.tsx:40\nsrc/canvas/index.ts:3\nweb/v2/TurnRow.tsx:88',
}

const webfetch = {
  id: 'w', name: 'WebFetch', kind: 'fetch', group: 'fetch',
  preview: 'https://react.dev/reference/react/useMemo',
  args: { url: 'https://react.dev/reference/react/useMemo', prompt: 'summarize when to reach for useMemo' },
  output: 'useMemo caches a calculation result between re-renders until its dependencies change.',
}

const task = {
  id: 'k', name: 'Task', kind: 'other', group: 'tasks',
  preview: 'verify exports',
  args: { subagent_type: 'researcher', description: 'verify every export resolves', prompt: 'Check the barrel re-exports all lifted primitives.' },
  output: 'all 7 primitives resolve from the sub-barrel.',
}

const other = {
  id: 'o', name: 'TodoWrite', kind: 'other', group: 'other',
  preview: '3 todos',
  args: { todos: [{ content: 'lift the rendering primitives', status: 'in_progress' }] },
  output: 'noop',
}

const meta = {
  title: 'in use/transcript/TranscriptToolBody',
  component: ToolBody,
  tags: ['autodocs'],
  decorators: frame('wide'),
}
export default meta

export const Read = { args: { tool: read } }
export const Edit = { args: { tool: edit } }
export const Bash = {
  args: { tool: bash },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // a non-zero exit reads the exit code (never colour alone).
    expect(canvas.getByText('exit 2')).toBeInTheDocument()
  },
}
export const Grep = { args: { tool: grep } }
// webfetch has no canonical app-render anchor — this story is its render gate.
export const WebFetch = {
  args: { tool: webfetch },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText(/react\.dev\/reference\/react\/useMemo/)).toBeInTheDocument()
  },
}
export const Task = { args: { tool: task } }
export const Default = { args: { tool: other } }

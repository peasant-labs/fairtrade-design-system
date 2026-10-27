import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import TranscriptWorkGroup from './WorkGroup.jsx'
import { frame } from '../story-frame.jsx'

/* TranscriptWorkGroup story (exported as TranscriptWorkGroup). One turn's tool activity as a
   single panel: the computed summary line above the same collapsible tool rows the classic card
   draws flat. The summary counts commands, distinct files and edits, and keeps a failure count
   beside the total calls and duration. A turn without tools renders nothing. */

const tools = [
  {
    id: 'w1', name: 'Bash', kind: 'execute', group: 'bash', preview: 'pnpm -r typecheck',
    exitCode: 0, durationMs: 8200, args: { command: 'pnpm -r typecheck' }, output: 'all packages pass',
  },
  {
    id: 'w2', name: 'Bash', kind: 'execute', group: 'bash', preview: 'pnpm test',
    exitCode: 1, isError: true, durationMs: 4100, args: { command: 'pnpm test' }, output: '1 test failed',
  },
  {
    id: 'w3', name: 'Read', kind: 'read', group: 'read', preview: 'TurnRow.tsx',
    filePath: 'src/canvas/TurnRow.tsx', durationMs: 200, args: { file_path: 'src/canvas/TurnRow.tsx' }, output: 'export function TurnRow() {}',
  },
  {
    id: 'w4', name: 'Edit', kind: 'edit', group: 'edits', preview: 'tasks.ts',
    filePath: 'src/lib/tasks.ts', adds: 3, dels: 1, durationMs: 300, args: { file_path: 'src/lib/tasks.ts' }, output: 'ok',
  },
]

function Controlled({ list = tools, expandAll = false }) {
  const [openTools, setOpenTools] = useState({})
  return (
    <TranscriptWorkGroup
      tools={list}
      openTools={openTools}
      onToggle={(id) => setOpenTools((previous) => ({ ...previous, [id]: !previous[id] }))}
      expandAll={expandAll}
    />
  )
}

const meta = {
  title: 'in use/transcript/TranscriptWorkGroup',
  component: TranscriptWorkGroup,
  tags: ['autodocs'],
  decorators: frame('wide'),
}
export default meta

export const Default = {
  render: () => <Controlled />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the summary counts commands, distinct files and edits; meta keeps calls, failures, duration.
    await expect(canvas.getByText('2 commands, 1 file, 1 edit')).toBeVisible()
    await expect(canvas.getByText('4 calls, 1 failed, 13s')).toBeVisible()
    // the summary line opens the rows; each row then opens on its own.
    await userEvent.click(canvasElement.querySelector('.txn-work-toggle'))
    const rows = canvasElement.querySelectorAll('.txn-work .txn-tc-head')
    await expect(rows).toHaveLength(tools.length)
    await expect(rows[0]).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(rows[0])
    await expect(rows[0]).toHaveAttribute('aria-expanded', 'true')
  },
}

export const Expanded = { render: () => <Controlled expandAll /> }

export const Empty = {
  render: () => <TranscriptWorkGroup tools={[]} />,
  play: async ({ canvasElement }) => {
    // no tools means no panel at all, never an empty summary shell.
    await expect(canvasElement.querySelector('.txn-work')).toBeNull()
  },
}

import { useState } from 'react'
import { expect, within, userEvent } from 'storybook/test'
import ToolCall from './ToolCall.jsx'
import { frame } from '../story-frame.jsx'

/* ToolCall story. CSF3, title 'in use/transcript/ToolCall'. The collapsible tool-call row is
   CONTROLLED (open / onToggle owned by the parent), matching the canonical mockup. The barrel
   exports this component as `TranscriptToolCall` (distinct from Timeline's ToolCall). */

const read = {
  id: 'r', name: 'Read', kind: 'read', group: 'read',
  preview: 'src/canvas/TurnRow.tsx', filePath: 'src/canvas/TurnRow.tsx', durationMs: 120,
  args: { file_path: 'src/canvas/TurnRow.tsx' }, output: 'export function TurnRow() {}',
}

const bash = {
  id: 'b', name: 'Bash', kind: 'execute', group: 'bash',
  preview: 'pnpm -r typecheck', exitCode: 2, isError: true, durationMs: 4200,
  args: { command: 'pnpm -r typecheck' }, output: 'error TS2532: Object is possibly undefined.',
}

const meta = {
  title: 'in use/transcript/TranscriptToolCall',
  component: ToolCall,
  tags: ['autodocs'],
  decorators: frame('wide'),
}
export default meta

export const Collapsed = { args: { tool: read, open: false } }
export const Expanded = { args: { tool: read, open: true } }
// a failed bash surfaces the exit-code pill on the collapsed row.
export const FailedBash = { args: { tool: bash, open: true } }

// a self-contained controlled wrapper so the disclosure actually toggles in the story.
function Controlled(args) {
  const [open, setOpen] = useState(false)
  return <ToolCall {...args} open={open} onToggle={() => setOpen((o) => !o)} />
}
export const Toggle = {
  render: (args) => <Controlled {...args} />,
  args: { tool: read },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByRole('button', { name: /Read/ })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(canvas.getByText('export function TurnRow() {}')).toBeInTheDocument()
  },
}

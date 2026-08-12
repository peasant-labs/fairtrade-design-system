import { expect, within } from 'storybook/test'
import TurnCard from './TurnCard.jsx'
import { frame } from '../story-frame.jsx'

/* TurnCard story. CSF3, title 'in use/transcript/TurnCard'. The composite turn lifted from the
   canonical mockup: it renders a cooked TurnVM and composes Markdown + Thinking + ToolCall.
   user / assistant / subagent variants; expandAll opens every tool body inline. */

const readTool = {
  id: 't2a', name: 'Read', kind: 'read', group: 'read',
  preview: 'TurnRow.tsx', filePath: 'src/canvas/TurnRow.tsx',
  args: { file_path: 'src/canvas/TurnRow.tsx' }, output: 'export function TurnRow() {}',
}

const userTurn = {
  index: 0, role: 'user', label: '1', depth: 0,
  content: 'Port the transcript canvas into the shared package. Read the renderer first.',
  toolCalls: [], annotations: [], tokens: { in: 280, out: 0 }, timestamp: '8m ago',
}

const assistantTurn = {
  index: 2, role: 'assistant', label: '2', depth: 0, provider: 'claude-code',
  model: 'Claude Opus 4.7',
  content: 'Reading the current renderer before extracting it.',
  thinking: { text: 'The renderer lives under canvas/. I should read TurnRow.tsx before moving anything.', words: 16 },
  toolCalls: [readTool], annotations: [], tokens: { in: 2100, out: 640 }, timestamp: '7m ago',
}

const subagentTurn = {
  index: 7, role: 'assistant', label: '5a', depth: 1, agentName: 'researcher',
  content: 'Verifying the exports across the workspace.',
  toolCalls: [], annotations: [], tokens: { in: 800, out: 300 }, timestamp: '4m ago',
}

const meta = {
  title: 'in use/transcript/TranscriptTurnCard',
  component: TurnCard,
  tags: ['autodocs'],
  decorators: frame('wide'),
}
export default meta

export const UserTurn = { args: { turn: userTurn } }

export const AssistantTurn = {
  args: { turn: assistantTurn, expandAll: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the turn number + the tool name render; expandAll reveals the tool body.
    expect(canvas.getByText('#2')).toBeInTheDocument()
    expect(canvas.getByText('Read')).toBeInTheDocument()
    expect(canvas.getByText('export function TurnRow() {}')).toBeInTheDocument()
  },
}

export const SubagentTurn = { args: { turn: subagentTurn } }

export const ErrorTurn = { args: { turn: { ...assistantTurn, isError: true } } }

// the optional, controllable saved-label chip (a view-state prop with a sane default of none).
export const WithSavedLabel = { args: { turn: assistantTurn, savedLabel: { outcome: 'good', flag: 'clean' } } }

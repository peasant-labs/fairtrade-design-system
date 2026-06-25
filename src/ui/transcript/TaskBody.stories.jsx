import TaskBody from './TaskBody.jsx'
import { frame } from '../story-frame.jsx'

/* TaskBody story. CSF3, title 'in use/transcript/TaskBody'. The task / subagent body renders
   the cooked ToolCallVM args (subagent + description + prompt) and the result behind a toggle.
   Rows are render-when-present, so a sparse wire task degrades cleanly. */

const task = {
  id: 'k1',
  name: 'Task',
  kind: 'other',
  group: 'tasks',
  preview: 'verify exports',
  args: {
    subagent_type: 'researcher',
    description: 'verify every lifted primitive resolves from the barrel',
    prompt:
      'Check the transcript sub-barrel re-exports TurnCard, Thinking, Markdown, TranscriptToolCall, ToolBody, TaskBody, and DiffEntryCard.',
  },
  output: 'all primitives resolve from @peasant-labs/fairtrade/ui.',
}

const meta = {
  title: 'in use/transcript/TranscriptTaskBody',
  component: TaskBody,
  tags: ['autodocs'],
  decorators: frame('wide'),
}
export default meta

export const Default = { args: { tool: task } }

// a sparse wire task (only a subagent + description) — owner / explicit status absent.
export const Sparse = {
  args: {
    tool: { id: 'k2', name: 'Task', kind: 'other', group: 'tasks', preview: 'sweep', args: { subagent_type: 'verifier', description: 'sweep the build' }, output: 'done' },
  },
}

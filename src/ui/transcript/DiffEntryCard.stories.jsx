import { expect, within } from 'storybook/test'
import DiffEntryCard from './DiffEntryCard.jsx'
import { frame } from '../story-frame.jsx'

/* DiffEntryCard story. CSF3, title 'in use/transcript/DiffEntryCard'. A Diffs-tab file-change
   card over a cooked DiffEntryVM. The Write fixture ends in a trailing empty diff line (the
   adapter's faithful-to-npm-diff LCS artifact) to prove DiffHunks trims it. */

const editEntry = {
  path: 'packages/browser/src/lib/tasks.ts',
  leaf: 'tasks.ts',
  adds: 1,
  dels: 0,
  turn: 5,
  toolCallId: 't5a',
  hunks: [
    {
      lines: [
        { sign: 'ctx', oldNo: '46', newNo: '46', text: 'const first = groups[0]' },
        { sign: 'add', newNo: '47', text: '  if (!first) return null' },
        { sign: 'ctx', oldNo: '47', newNo: '48', text: 'return first.turns[0].index' },
      ],
    },
  ],
}

// a Write: pure additions, and a TRAILING EMPTY line that DiffHunks must trim.
const writeEntry = {
  path: 'packages/browser/README.md',
  leaf: 'README.md',
  adds: 2,
  dels: 0,
  turn: 7,
  toolCallId: 't7a',
  hunks: [
    {
      lines: [
        { sign: 'add', newNo: '1', text: '# transcript-browser' },
        { sign: 'add', newNo: '2', text: 'the shared transcript canvas, lifted into fairtrade.' },
        { sign: 'add', newNo: '3', text: '' },
      ],
    },
  ],
}

const meta = {
  title: 'in use/transcript/TranscriptDiffEntryCard',
  component: DiffEntryCard,
  tags: ['autodocs'],
  decorators: frame('wide'),
}
export default meta

export const Edit = {
  args: { entry: editEntry, byTurn: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText('+1')).toBeInTheDocument()
    expect(canvas.getByText('packages/browser/src/lib/tasks.ts')).toBeInTheDocument()
  },
}

// byTurn labels by the turn the edit happened on; the trailing empty line is trimmed.
export const Write = { args: { entry: writeEntry, byTurn: true } }

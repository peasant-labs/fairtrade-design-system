import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import SelectionTree from './SelectionTree.jsx'
import { SelectionNodeKind, SelectionNodeState } from './selection-tree-values.js'
import { frame } from './story-frame.jsx'

const kind = (member) => member.wire
const state = (member) => member.wire

const FOREST = [
  { id: 'project-a', parentId: '', kind: kind(SelectionNodeKind.Project), state: state(SelectionNodeState.Some), label: 'IngestPipeline', childCount: 1 },
  { id: 'group-a', parentId: 'project-a', kind: kind(SelectionNodeKind.Group), state: state(SelectionNodeState.None), label: 'local clone', childCount: 1 },
  { id: 'branch-a', parentId: 'group-a', kind: kind(SelectionNodeKind.Branch), state: state(SelectionNodeState.All), label: 'main', childCount: 1284 },
  { id: 'session-a', parentId: 'branch-a', kind: kind(SelectionNodeKind.Session), state: state(SelectionNodeState.All), label: 'Parse raw events', harness: 'claude' },
  { id: 'session-locked', parentId: 'branch-a', kind: kind(SelectionNodeKind.Session), state: state(SelectionNodeState.None), label: 'Ambiguous branch', locked: true },
]

const KEYBOARD_NODES = [
  { id: 'project-ingest', parentId: '', kind: kind(SelectionNodeKind.Project), state: state(SelectionNodeState.Some), label: 'IngestPipeline', childCount: 2 },
  { id: 'group-clone', parentId: 'project-ingest', kind: kind(SelectionNodeKind.Group), state: state(SelectionNodeState.None), label: 'local clone' },
  { id: 'branch-main', parentId: 'group-clone', kind: kind(SelectionNodeKind.Branch), state: state(SelectionNodeState.All), label: 'main' },
  { id: 'session-parse', parentId: 'branch-main', kind: kind(SelectionNodeKind.Session), state: state(SelectionNodeState.None), label: 'Parse raw events', harness: 'claude' },
  { id: 'session-locked', parentId: 'branch-main', kind: kind(SelectionNodeKind.Session), state: state(SelectionNodeState.All), label: 'Ambiguous branch', locked: true },
]

const meta = {
  title: 'in use/SelectionTree',
  component: SelectionTree,
  tags: ['autodocs'],
  decorators: frame('wide'),
  args: {
    ariaLabel: 'sessions',
    nodes: FOREST,
  },
}
export default meta

/**
 * Visual reference: four kinds, three states, a locked row, a host child count,
 * and a label that keeps its case. The host supplies state. The tree does not roll it up.
 */
export const Forest = {
  render: (args) => <RecordingTree {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText('IngestPipeline')).toBeInTheDocument()
    expect(canvas.getByText('local clone')).toBeInTheDocument()
    expect(canvas.getByText('main')).toBeInTheDocument()
    expect(canvas.getByText('Parse raw events')).toBeInTheDocument()
    expect([...canvasElement.querySelectorAll('.st-kind')].map((node) => node.textContent))
      .toEqual(['project', 'group', 'branch', 'session', 'session'])
    expect(canvas.getByText('1,284')).toBeInTheDocument()
    expect(canvas.getByText('locked')).toBeInTheDocument()

    const project = canvas.getByRole('checkbox', { name: 'IngestPipeline' })
    expect(project).toHaveAttribute('aria-checked', 'mixed')
    const clear = canvas.getByRole('checkbox', { name: 'local clone' })
    expect(clear).toHaveAttribute('aria-checked', 'false')
    const full = canvas.getByRole('checkbox', { name: 'main' })
    expect(full).toHaveAttribute('aria-checked', 'true')
    const locked = canvas.getByRole('checkbox', { name: 'Ambiguous branch, locked' })
    expect(locked).toBeDisabled()
    expect(locked).toHaveAttribute('aria-checked', 'false')
  },
}

/**
 * One session checkbox. Space selects it. The story updates that row's host
 * state from the reported ids; the component does not roll the project up.
 */
export const KeyboardToggle = {
  render: () => <KeyboardForest />,
}

/* the preview contract: with `onPreview` a row has three controls and each does one thing. the
   caret folds, the checkbox selects, and the title previews. a title click never changes the
   selection, a checkbox click never previews, and the previewed row is marked on its title
   (`aria-pressed`) and on the row (the amber selection inset over a quiet fill), not by colour
   alone. the long title wraps and its row carries no count; every other row keeps its count.
   both themes are captured from this story by scripts/sbshot.mjs, and on a coarse pointer the
   title and the checkbox hit rise to --target-comfortable with the rest of the controls. */
const PREVIEW_FOREST = [
  { id: 'project-pipeline', parentId: '', kind: kind(SelectionNodeKind.Project), state: state(SelectionNodeState.Some), label: 'IngestPipeline', childCount: 2 },
  { id: 'branch-main', parentId: 'project-pipeline', kind: kind(SelectionNodeKind.Branch), state: state(SelectionNodeState.Some), label: 'main', childCount: 2 },
  { id: 'session-scan', parentId: 'branch-main', kind: kind(SelectionNodeKind.Session), state: state(SelectionNodeState.All), label: 'Parse raw events', harness: 'claude' },
  { id: 'session-long', parentId: 'branch-main', kind: kind(SelectionNodeKind.Session), state: state(SelectionNodeState.None), label: 'Explain why the daemon ignores the config file when it starts before the first scan' },
  { id: 'branch-feat', parentId: 'project-pipeline', kind: kind(SelectionNodeKind.Branch), state: state(SelectionNodeState.None), label: 'feat/kickstart', childCount: 1 },
  { id: 'session-stops', parentId: 'branch-feat', kind: kind(SelectionNodeKind.Session), state: state(SelectionNodeState.None), label: 'Draft the stops' },
]
const LONG_TITLE = 'Explain why the daemon ignores the config file when it starts before the first scan'

export const Preview = {
  render: () => <PreviewForest />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getAllByRole('button', { name: /^preview / })).toHaveLength(PREVIEW_FOREST.length)

    const title = canvas.getByRole('button', { name: `preview ${LONG_TITLE}` })
    await userEvent.click(title)
    expect(title).toHaveAttribute('aria-pressed', 'true')
    expect(canvas.getByTestId('preview-id')).toHaveTextContent(/^previewed: session-long$/)
    expect(canvas.getByTestId('selection-ids')).toHaveTextContent(/^selected: session-scan$/)

    const checkbox = canvas.getByRole('checkbox', { name: LONG_TITLE })
    await userEvent.click(checkbox)
    expect(canvas.getByTestId('selection-ids')).toHaveTextContent(/^selected: session-scan, session-long$/)
    expect(canvas.getByTestId('preview-id')).toHaveTextContent(/^previewed: session-long$/)

    // the caret folds: a folded row mounts no children, so its rows leave the page and the tree.
    await userEvent.click(canvas.getByRole('button', { name: 'hide main' }))
    expect(canvas.queryByRole('checkbox', { name: LONG_TITLE })).not.toBeInTheDocument()
    expect(canvas.getByTestId('selection-ids')).toHaveTextContent(/^selected: session-scan, session-long$/)
  },
}

function PreviewForest() {
  const [ids, setIds] = useState(['session-scan'])
  const [previewId, setPreviewId] = useState(null)
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
      <SelectionTree
        ariaLabel="sessions to import"
        nodes={PREVIEW_FOREST}
        value={ids}
        onSelectionChange={setIds}
        onPreview={setPreviewId}
        previewId={previewId}
      />
      <output data-testid="selection-ids">selected: {ids.join(', ')}</output>
      <output data-testid="preview-id">previewed: {previewId ?? 'none'}</output>
    </div>
  )
}

function RecordingTree({ nodes, ...props }) {
  const [ids, setIds] = useState(['session-a'])
  return (
    <div>
      <SelectionTree
        {...props}
        nodes={nodes}
        value={ids}
        onSelectionChange={setIds}
      />
      <output data-testid="selection-ids">{ids.join(',')}</output>
    </div>
  )
}

function KeyboardForest() {
  const [nodes, setNodes] = useState(KEYBOARD_NODES)
  const [value, setValue] = useState(['session-locked'])
  return (
    <SelectionTree
      ariaLabel="sessions"
      nodes={nodes}
      value={value}
      onSelectionChange={(ids) => {
        setValue(ids)
        const selected = new Set(ids)
        setNodes((current) => current.map((node) => (
          node.kind === SelectionNodeKind.Session.wire
            ? { ...node, state: selected.has(node.id) ? SelectionNodeState.All.wire : SelectionNodeState.None.wire }
            : node
        )))
      }}
    />
  )
}

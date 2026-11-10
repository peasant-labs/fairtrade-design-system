import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import SelectionTree from './SelectionTree.jsx'
import { SelectionNodeKind, SelectionNodeState } from './selection-tree-values.js'
import { frame } from './story-frame.jsx'

const kind = (member) => member.wire
const state = (member) => member.wire

const FOREST = [
  { id: 'project-a', parentId: '', kind: kind(SelectionNodeKind.Project), state: state(SelectionNodeState.Some), label: 'IngestPipeline', childCount: 1284 },
  { id: 'group-a', parentId: 'project-a', kind: kind(SelectionNodeKind.Group), state: state(SelectionNodeState.None), label: 'local clone', childCount: 1 },
  { id: 'branch-a', parentId: 'group-a', kind: kind(SelectionNodeKind.Branch), state: state(SelectionNodeState.All), label: 'main', childCount: 2 },
  { id: 'session-a', parentId: 'branch-a', kind: kind(SelectionNodeKind.Session), state: state(SelectionNodeState.All), label: 'Parse raw events', harness: 'claude' },
  { id: 'session-locked', parentId: 'branch-a', kind: kind(SelectionNodeKind.Session), state: state(SelectionNodeState.None), label: 'Ambiguous branch', locked: true },
]

const KEYBOARD_NODES = [
  { id: 'project-ingest', parentId: '', kind: kind(SelectionNodeKind.Project), state: state(SelectionNodeState.None), label: 'IngestPipeline', childCount: 1 },
  { id: 'session-parse', parentId: 'project-ingest', kind: kind(SelectionNodeKind.Session), state: state(SelectionNodeState.None), label: 'Parse raw events', harness: 'claude' },
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
    expect(canvas.getByText('project')).toBeInTheDocument()
    expect(canvas.getByText('group')).toBeInTheDocument()
    expect(canvas.getByText('branch')).toBeInTheDocument()
    expect(canvas.getAllByText('session').length).toBeGreaterThan(0)
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

    await userEvent.click(project)
    await expect(canvas.getByTestId('selection-ids')).toHaveTextContent('session-a')
    expect(canvas.queryByText('page')).not.toBeInTheDocument()
  },
}

/**
 * One session checkbox. Space selects it. The story updates that row's host
 * state from the reported ids; the component does not roll the project up.
 */
export const KeyboardToggle = {
  render: () => <KeyboardForest />,
}

function RecordingTree(props) {
  const [ids, setIds] = useState([])
  return (
    <div>
      <SelectionTree
        {...props}
        value={ids}
        onSelectionChange={setIds}
      />
      <output data-testid="selection-ids">{ids.join(',')}</output>
    </div>
  )
}

function KeyboardForest() {
  const [nodes, setNodes] = useState(KEYBOARD_NODES)
  return (
    <SelectionTree
      ariaLabel="sessions"
      nodes={nodes}
      onSelectionChange={(ids) => {
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

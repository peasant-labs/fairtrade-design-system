import React, { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import CodeMapNavigator from './CodeMapNavigator.jsx'

const payload = {
  repoFound: true,
  nodes: [
    { id: 'internal', name: 'internal', kind: 'module', loc: 820, recordedFiles: 5, totalFiles: 8, order: 0 },
    { id: 'internal/ingest', name: 'ingest', kind: 'package', parent: 'internal', loc: 510, recordedFiles: 3, totalFiles: 5, order: 0 },
    { id: 'internal/ingest/pipeline.go', name: 'pipeline.go', kind: 'file', parent: 'internal/ingest', loc: 220, recordedFiles: 1, totalFiles: 1, order: 0 },
    { id: 'web', name: 'web', kind: 'module', loc: 460, recordedFiles: 2, totalFiles: 6, order: 1 },
  ],
  structureEdges: [],
  violations: [],
}

function ControlledNavigator({ onSelect, onOpenMap }) {
  const [selectedId, setSelectedId] = useState(null)
  const [expandedIds, setExpandedIds] = useState(['internal'])
  const [filter, setFilter] = useState('')
  return (
    <CodeMapNavigator
      payload={payload}
      grain="file"
      expandedIds={expandedIds}
      onExpandedIdsChange={setExpandedIds}
      selectedId={selectedId}
      onSelect={(id, node) => {
        setSelectedId(id)
        onSelect?.(id, node)
      }}
      filter={filter}
      onFilterChange={setFilter}
      onOpenMap={(id) => {
        setSelectedId(id)
        onOpenMap?.(id)
      }}
    />
  )
}

export default { title: 'in use/CodeMapNavigator', component: CodeMapNavigator }
export const Default = {
  args: { onSelect: fn(), onOpenMap: fn() },
  render: (args) => <ControlledNavigator {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const internal = await canvas.findByRole('treeitem', { name: /^internal/i })
    await userEvent.click(internal)
    await waitFor(() => expect(args.onSelect).toHaveBeenCalledTimes(1))
    const selectedNode = args.onSelect.mock.calls[0][1]
    expect(selectedNode).not.toHaveProperty('_index')
    expect(selectedNode).not.toHaveProperty('_depth')

    internal.focus()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(args.onSelect).toHaveBeenCalledTimes(2))
    expect(args.onSelect.mock.calls[1][0]).toBe('internal/ingest')

    const filter = canvas.getByRole('textbox', { name: /filter code areas/i })
    await userEvent.clear(filter)
    await userEvent.type(filter, 'pipeline')
    await expect(canvas.findByRole('treeitem', { name: /pipeline\.go/i })).resolves.toBeInTheDocument()
    expect(canvas.queryByRole('treeitem', { name: /^web/i })).toBeNull()

    await userEvent.clear(filter)
    await userEvent.click(canvas.getByRole('button', { name: /open in map/i }))
    await waitFor(() => expect(args.onOpenMap).toHaveBeenCalledTimes(1))
  },
}

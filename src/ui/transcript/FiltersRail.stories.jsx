import { useState } from 'react'
import FiltersRail from './FiltersRail.jsx'
import { frame } from '../story-frame.jsx'

/* FiltersRail story (exported as TranscriptFiltersRail). Controlled via filters + onFiltersChange;
   counts + checkpoints come cooked off the view model. The trace tab shows the full surface; the
   highlights tab shows only the outcome section; other tabs show the placeholder. */

const counts = {
  categories: { prompts: 2, responses: 6, thinking: 2, toolcalls: 5 },
  toolGroups: { edits: 1, bash: 3, read: 1, search: 1, fetch: 0, tasks: 1, other: 0 },
}
const checkpoints = [{ hash: '9f3c1ad0', shortHash: '9f3c1ad', message: 'port TurnRow + tool renderers' }]
const baseFilters = {
  categories: { prompts: true, responses: true, thinking: true, toolcalls: true },
  toolGroups: { edits: true, bash: true, read: true, search: true, fetch: true, tasks: true, other: true },
  tags: { errors: false, retries: false, revert: false },
  views: { hidden: true, expandAll: false, compact: false },
  checkpoint: 'all',
}

const meta = {
  title: 'in use/transcript/TranscriptFiltersRail',
  component: FiltersRail,
  tags: ['autodocs'],
  decorators: frame('panel'),
}
export default meta

export const Trace = {
  args: { tab: 'trace', counts, checkpoints, filtersActive: 0 },
  render: (args) => {
    const [filters, setFilters] = useState(baseFilters)
    const active =
      Object.values(filters.categories).filter((v) => !v).length +
      Object.values(filters.tags).filter(Boolean).length +
      Object.values(filters.toolGroups).filter((v) => !v).length
    return <FiltersRail {...args} filters={filters} onFiltersChange={setFilters} filtersActive={active} onClear={() => setFilters(baseFilters)} />
  },
}

export const Highlights = { args: { tab: 'highlights', filters: baseFilters, counts } }
export const Unavailable = { args: { tab: 'files', filters: baseFilters, counts } }

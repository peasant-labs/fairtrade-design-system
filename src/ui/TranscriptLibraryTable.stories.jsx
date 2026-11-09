import { useState } from 'react'
import { PageSize } from '@peasant-labs/schema'
import { closed } from './closed-value.js'
import { ColumnAlign } from './table/column-align.js'
import { TranscriptLibraryTable } from './TranscriptLibraryTable.jsx'

/* the canonical transcript library table, grouped by project with numbered pages.
   classes + tokens come from src/index.css via .storybook/preview.jsx; the theme
   toolbar flips data-theme. the rows are published transcripts across two
   projects, so a group header reads as the project name and a session title keeps
   its own case. */

const GroupBy = Object.freeze({
  Project: closed('project', 'project'),
  None: closed('none', 'nothing'),
})
const GROUP_BY_OPTIONS = [GroupBy.Project, GroupBy.None]
const ColumnId = Object.freeze({
  Transcript: closed('transcript', 'transcript'),
  Provider: closed('provider', 'provider'),
  Turns: closed('turns', 'turns'),
})

const COLUMNS = [
  { id: ColumnId.Transcript, label: 'transcript', align: ColumnAlign.Start, render: (row) => row.title },
  { id: ColumnId.Provider, label: 'provider', align: ColumnAlign.Start, render: (row) => row.provider },
  { id: ColumnId.Turns, label: 'turns', align: ColumnAlign.Decimal, numeric: true, render: (row) => row.turns },
]

const ROWS = [
  { id: 's-01', title: 'refactoring the ledger', provider: 'claude-code', turns: 48, projects: ['peasant-labs'] },
  { id: 's-02', title: 'porting tokens to css vars', provider: 'gemini-cli', turns: 21, projects: ['peasant-labs'] },
  { id: 's-03', title: 'debugging the redaction pass', provider: 'claude-code', turns: 94, projects: ['fairtrade-design-system'] },
  { id: 's-04', title: 'a11y audit of the library', provider: 'gemini-cli', turns: 37, projects: ['fairtrade-design-system'] },
]

const LABELS = new Map([
  ['project:peasant-labs', 'peasant-labs'],
  ['project:fairtrade-design-system', 'fairtrade-design-system'],
])

const PAGE = { index: 2, size: PageSize.P25, total: 120 }

const baseArgs = {
  caption: 'your transcripts',
  rows: ROWS,
  rowKey: (row) => row.id,
  columns: COLUMNS,
  groupBy: GroupBy.Project,
  groupByOptions: GROUP_BY_OPTIONS,
  groupKeys: (row) => row.projects,
  groupLabel: (id) => LABELS.get(id) ?? id,
  nextGroupKeys: null,
  continuedGroupKeys: null,
  page: PAGE,
  viewState: null,
  onViewStateChange: () => {},
  onPageChange: () => {},
  onPageSizeChange: () => {},
}

/* The controlled saved view a host composes: `groupBy` from the URL and
   `visibleColumns` and `open` from the device. The story plays the host and keeps
   the three parts in local state, so the pickers and group toggles report their
   changes back the way a real page would. */
function SavedViewExample({ initialOpen = ['project:peasant-labs'], ...args }) {
  const [view, setView] = useState({
    groupBy: GroupBy.Project,
    visibleColumns: [ColumnId.Transcript, ColumnId.Provider, ColumnId.Turns],
    open: initialOpen,
  })
  return (
    <TranscriptLibraryTable
      {...args}
      groupBy={view.groupBy}
      groupKeys={(row) => (view.groupBy.wire === GroupBy.None.wire ? [] : row.projects)}
      viewState={view}
      onViewStateChange={setView}
    />
  )
}

const meta = {
  title: 'components/TranscriptLibraryTable',
  component: TranscriptLibraryTable,
  tags: ['autodocs'],
  args: baseArgs,
  argTypes: {
    caption: { control: 'text' },
    page: { control: 'object' },
    rows: { control: 'object' },
    nextGroupKeys: { control: 'object' },
    continuedGroupKeys: { control: 'object' },
  },
}
export default meta

/** page two opens inside the first project: one compact continuation row, then its sessions. */
export const ContinuingGroupPageTwo = {
  args: { continuedGroupKeys: ['peasant-labs'] },
}

/** a project that starts on this page keeps the full header. */
export const FullHeaderOnPage = {
  args: { continuedGroupKeys: null },
}

/** a project with rows on the next page is marked in text at the end of its block. */
export const ContinuesOnNextPage = {
  args: { nextGroupKeys: ['fairtrade-design-system'] },
}

/** a project that ends exactly at the page boundary is not marked. */
export const ExactPageBoundary = {
  args: { nextGroupKeys: ['another-project'] },
}

/** page one: no previous page is known, so every group keeps its full header. */
export const FirstPage = {
  args: { page: { ...PAGE, index: 1 }, continuedGroupKeys: null },
}

/** a complete list passes page={null}: every row renders and the pager is absent. */
export const CompleteList = {
  args: { page: null },
}

/** the controlled saved view: the group-by and column pickers, the open group, and a collapsed group. */
export const SavedView = {
  render: (args) => <SavedViewExample {...args} />,
  args: { page: { ...PAGE, index: 1 }, continuedGroupKeys: null },
}

/** a saved view holding no open group renders every group collapsed, with its toggle announcing collapsed. */
export const SavedViewCollapsed = {
  render: (args) => <SavedViewExample {...args} />,
  args: { page: { ...PAGE, index: 1 }, continuedGroupKeys: null, initialOpen: [] },
}

/** an empty page keeps the caption and the table semantics. */
export const Empty = {
  args: { rows: [], page: { index: 1, size: PageSize.P25, total: 0 } },
}

/** below 880px the pager wraps under the grouping status instead of crowding it. */
export const Narrow = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
}

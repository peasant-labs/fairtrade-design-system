// @ts-check
/* Contract type-test for the shared transcript library table
   (src/ui/TranscriptLibraryTable.jsx). It imports the ACTUAL production module and
   asserts the prop contract a host depends on at the type level:

     - a host GroupBy and ColumnId closed set type the table's props, so two hosts
       never share a member type by accident;
     - the saved view is `groupBy` from the URL plus `visibleColumns` and `open`
       from the device, and `visibleColumns` holds closed-set members, never wires;
     - `page.size` is the schema `PageSize` set, not a bare number;
     - `groupPageRows` and `groupKeysFor` keep their generics.

   Enforced by `pnpm test:contract` (tsc -p tsconfig.contract.json, strict,
   noImplicitAny, noEmit). The file carries `// @ts-check` because that program
   sets `checkJs: false`. */

import { closed } from './closed-value.js'
import { ColumnAlign } from './table/column-align.js'
import { groupKeysFor, groupPageRows } from './groupPageRows.js'

const GroupBy = Object.freeze({
  Project: closed('project', 'project'),
  None: closed('none', 'none'),
})
const OtherGroupBy = Object.freeze({ Agent: closed('agent', 'agent') })

const ColumnId = Object.freeze({
  Transcript: closed('transcript', 'transcript'),
  Turns: closed('turns', 'turns'),
})

/** @typedef {{ title: string, turns: number, projects: readonly string[] }} Row */
/** @typedef {(typeof ColumnId)[keyof typeof ColumnId]} HostColumnId */
/** @typedef {(typeof GroupBy)[keyof typeof GroupBy]} HostGroupBy */

/** @type {readonly Row[]} */
const rows = [{ title: 'alpha one', turns: 3, projects: ['alpha'] }]

/** @type {import('@peasant-labs/schema').PageSize} */
const size = 25

/** @type {readonly import('./TranscriptLibraryTable.jsx').TranscriptLibraryColumn<Row, HostColumnId>[]} */
const columns = [
  { id: ColumnId.Transcript, label: 'transcript', align: ColumnAlign.Start, render: (row) => row.title },
  { id: ColumnId.Turns, label: 'turns', align: ColumnAlign.End, numeric: true, render: (row) => row.turns },
]

/** @type {import('./TranscriptLibraryTable.jsx').SavedView<HostGroupBy, HostColumnId>} */
const viewState = {
  groupBy: GroupBy.Project,
  visibleColumns: [ColumnId.Transcript, ColumnId.Turns],
  open: ['project:alpha'],
}

/** @type {import('./TranscriptLibraryTable.jsx').TranscriptLibraryTableProps<Row, HostGroupBy, HostColumnId>} */
const props = {
  caption: 'your transcripts',
  rows,
  rowKey: (row) => row.title,
  columns,
  groupBy: GroupBy.Project,
  groupByOptions: [GroupBy.Project, GroupBy.None],
  groupKeys: (row) => row.projects,
  groupLabel: (id) => id,
  nextGroupKeys: [],
  continuedGroupKeys: null,
  page: { index: 1, size, total: 3 },
  viewState,
  onViewStateChange: (next) => {
    /** @type {'project' | 'none'} */
    const grouping = next.groupBy.wire
    void grouping
    /** @type {readonly HostColumnId[]} */
    const shown = next.visibleColumns
    void shown
  },
  onPageChange: (index) => {
    /** @type {number} */
    const page = index
    void page
  },
  onPageSizeChange: (next) => {
    /** @type {import('@peasant-labs/schema').PageSize} */
    const perPage = next
    void perPage
  },
}
void props

/* the grouping helpers keep their generic row type and their bare-key contract */
/** @type {readonly import('./groupPageRows.js').TranscriptLibraryGroup<Row>[]} */
const groups = groupPageRows(rows, GroupBy.Project, (row) => row.projects, (id) => id, null, null)
void groups
/** @type {readonly string[]} */
const keys = groupKeysFor(rows, (row) => row.projects)
void keys

// @ts-expect-error - visibleColumns holds closed-set members, never a bare wire string
const wiresOnly = /** @type {import('./TranscriptLibraryTable.jsx').SavedView<HostGroupBy, HostColumnId>} */ ({
  groupBy: GroupBy.Project,
  visibleColumns: ['turns'],
  open: [],
})
void wiresOnly

// @ts-expect-error - another host's GroupBy member is not this host's member
const foreignGroupBy = /** @type {import('./TranscriptLibraryTable.jsx').SavedView<HostGroupBy, HostColumnId>} */ ({
  groupBy: OtherGroupBy.Agent,
  visibleColumns: [ColumnId.Turns],
  open: [],
})
void foreignGroupBy

// @ts-expect-error - a page size outside the schema PageSize set is refused at the boundary
const badPage = /** @type {import('./TranscriptLibraryTable.jsx').TranscriptLibraryPage} */ ({ index: 1, size: 26, total: 3 })
void badPage

// @ts-expect-error - groupKeys returns bare strings, never numbers
groupKeysFor(rows, (row) => row.turns)

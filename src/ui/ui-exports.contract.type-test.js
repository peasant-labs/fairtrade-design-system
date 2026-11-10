// @ts-check
/* Contract type-test for the public ./ui barrel (src/ui/index.js).

   The library table's contract lives deep in `TranscriptLibraryTable.jsx`, but a
   host imports it from `@peasant-labs/fairtrade/ui`. This file imports the BARREL,
   not the deep module, and asserts every type a host needs resolves through it:

     - `SavedView` for the host's composed URL grouping + device columns/collapsed;
     - `TranscriptLibraryTableProps` for the mounted component;
     - `TranscriptLibraryColumn` for a host column;
     - `TranscriptLibraryPage` for the offset page;
     - `TranscriptLibraryGroup` for a host using `groupPageRows`.

   Enforced by `pnpm test:contract` (tsc -p tsconfig.contract.json). The file
   carries `// @ts-check` because that program sets `checkJs: false`. */

import { closed } from './closed-value.js'
import { ColumnAlign, TranscriptLibraryTable } from './index.js'

/** @typedef {{ title: string, project: string }} Row */

const GroupBy = closed('project', 'project')
const OtherGroupBy = closed('agent', 'agent')
const ColumnId = closed('transcript', 'transcript')

/** @type {import('./index.js').SavedView<typeof GroupBy, typeof ColumnId>} */
const view = { groupBy: GroupBy, visibleColumns: [ColumnId], collapsed: [] }
void view

// @ts-expect-error - collapsed is required; an empty list means every group is open
const viewWithoutCollapsed = /** @type {import('./index.js').SavedView<typeof GroupBy, typeof ColumnId>} */ ({ groupBy: GroupBy, visibleColumns: [ColumnId] })
void viewWithoutCollapsed

/** @type {readonly import('./index.js').TranscriptLibraryColumn<Row, typeof ColumnId>[]} */
const columns = [{ id: ColumnId, label: 'transcript', align: ColumnAlign.Start, render: (row) => row.title }]
void columns

/** @type {import('./index.js').TranscriptLibraryPage} */
const page = { index: 1, size: 25, total: 3 }
void page

/** @type {readonly import('./index.js').TranscriptLibraryGroup<Row>[]} */
const groups = [{ id: 'project:alpha', label: 'alpha', rows: [{ title: 'one', project: 'alpha' }], continued: false, continues: false }]
void groups

/** @type {import('./index.js').TranscriptLibraryTableProps<Row, typeof GroupBy, typeof ColumnId>} */
const props = {
  caption: 'your transcripts',
  rows: [{ title: 'one', project: 'alpha' }],
  rowKey: (row) => row.title,
  columns: [{ id: ColumnId, label: 'transcript', align: ColumnAlign.Start, render: (row) => row.title }],
  groupBy: GroupBy,
  groupKeys: (row) => [row.project],
  groupLabel: (id) => id,
  nextGroupKeys: null,
  continuedGroupKeys: null,
  page,
  viewState: view,
  onViewStateChange: (next) => {
    /** @type {'project'} */
    const grouping = next.groupBy.wire
    void grouping
  },
  onPageChange: () => {},
  onPageSizeChange: () => {},
}
void props
void TranscriptLibraryTable

// @ts-expect-error - the barrel carries a nominal closed-set member, not a bare wire
const bareGroupBy = /** @type {import('./index.js').SavedView<typeof GroupBy, typeof ColumnId>} */ ({
  groupBy: 'project',
  visibleColumns: [ColumnId],
})
void bareGroupBy

// @ts-expect-error - another host's GroupBy member is not this host's member
const foreignGroupBy = /** @type {import('./index.js').SavedView<typeof GroupBy, typeof ColumnId>} */ ({
  groupBy: OtherGroupBy,
  visibleColumns: [ColumnId],
})
void foreignGroupBy

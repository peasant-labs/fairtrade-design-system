import { useState } from 'react'
import { fn } from 'storybook/test'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import DataTable from './DataTable.jsx'
import { DataTableToolbar, DataTablePaginationControls } from './DataTableControls.jsx'
import BrandMark from './BrandMark.jsx'
import { frame } from './story-frame.jsx'
import YAML from 'yaml'
import viewFixture from '../../scripts/testdata/datatable.yaml?raw'

const viewData = YAML.parse(viewFixture)
const toolbar = (controls) => <DataTableToolbar {...controls} />
const footer = (controls) => <DataTablePaginationControls {...controls} />
const legacyRows = viewData.cases.find((row) => row.controls === false).rows

/* lead a provider cell with the real brand mark (claude-code -> claude, gemini-cli -> gemini
   resolve inside BrandMark). the mark sits beside its visible id, so it is decorative. the
   value stays the real id (never force-lowercased). */
const providerCell = (v) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
    <BrandMark name={v} size={16} />
    {v}
  </span>
)

/* a sortable + selectable table. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. on-brand mock
   content: published transcripts across collectives + providers. */

const COLUMNS = [
  { key: 'title', label: 'transcript', sortable: true },
  { key: 'provider', label: 'provider', sortable: true, render: providerCell, width: '12rem' },
  { key: 'collective', label: 'collective', sortable: true, width: '12rem' },
  { key: 'redactions', label: 'redactions', sortable: true, align: 'right', width: '8rem' },
  { key: 'turns', label: 'turns', sortable: true, align: 'right', width: '6rem' },
]

const ROWS = [
  { id: 't-01', title: 'refactoring the ledger', provider: 'claude-code', collective: 'commons weavers', redactions: 3, turns: 48 },
  { id: 't-02', title: 'porting tokens to css vars', provider: 'gemini-cli', collective: 'open looms', redactions: 0, turns: 21 },
  { id: 't-03', title: 'debugging the redaction pass', provider: 'claude-code', collective: 'fair harvest', redactions: 12, turns: 94 },
  { id: 't-04', title: 'a11y audit of the table', provider: 'gemini-cli', collective: 'commons weavers', redactions: 1, turns: 37 },
  { id: 't-05', title: 'snapshotting the archive', provider: 'claude-code', collective: 'open looms', redactions: 7, turns: 63 },
]

const meta = {
  title: 'components/DataTable',
  component: DataTable,
  tags: ['autodocs'],
  decorators: frame('wide'),
  argTypes: {
    selectable: { control: 'boolean' },
    caption: { control: 'text' },
    columns: { control: false },
    rows: { control: false },
    defaultSort: { control: false },
    sort: { control: false },
    selectedKeys: { control: false },
    defaultSelectedKeys: { control: false },
    onSortChange: { action: 'sort-change' },
    onSelectionChange: { action: 'selection-change' },
    search: { control: 'text' },
    defaultSearch: { control: 'text' },
    onSearchChange: { action: 'search-change' },
    columnFilters: { control: false },
    defaultColumnFilters: { control: false },
    onColumnFiltersChange: { action: 'column-filters-change' },
    pagination: { control: false },
    defaultPagination: { control: false },
    onPaginationChange: { action: 'pagination-change' },
    rowCount: { control: 'number' },
  },
  args: {
    columns: COLUMNS,
    rows: ROWS,
    selectable: true,
    caption: 'published transcripts, this commons',
    onSortChange: fn(),
    onSelectionChange: fn(),
    onSearchChange: fn(),
    onColumnFiltersChange: fn(),
    onPaginationChange: fn(),
    toolbar,
    footer,
  },
  parameters: { docs: { description: { component: `The host owns URL synchronization. Map search to q, columnFilters (TanStack id/value pairs) to repeated filter parameters, and pagination.pageIndex/pageSize to page/size. Parse and validate those parameters in the host, pass controlled values, then update the host route in onSearchChange/onColumnFiltersChange/onPaginationChange. Callbacks emit values, not TanStack updater functions. The table never accesses routing or storage. With rowCount the host supplies its total for the rows it gives: pagination stays manual (the page count comes from rowCount) and existing sorting stays local, while local search and column filters still apply to the given rows; when a filter is active on a partial window the count reports the loaded rows, never the host total. Without rowCount, filtering and pagination run locally. Search and column filters reset pageIndex to zero on user changes. Decimal alignment supports plain dot-separated numeric values and reserves the largest fractional width on the visible page; custom renderers, currency and locale-formatted strings fall back to right alignment with tabular figures. No values are rounded or rewritten.` } } },
}
export default meta

export const Playground = {}
export const LegacyDefaults = { args: { rows: legacyRows, selectable: false, toolbar: undefined, footer: undefined } }
export const BoundedScrolling = { args: { ...LegacyDefaults.args, maxHeight: 'calc(var(--row-h-comfortable) * 8)' } }

function ViewExample({ hostSliced = false }) {
  const [columnFilters, setFilters] = useState(hostSliced ? [] : [{ id: 'title', value: 'Ledger' }])
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 2 })
  const [lastFilters, setLastFilters] = useState(null)
  const [lastSearch, setLastSearch] = useState(null)
  const [lastPagination, setLastPagination] = useState(null)
  const hostRows = viewData.rows.filter((row) => row.title.toLowerCase().includes(search.toLowerCase()) && columnFilters.every((filter) => String(row[filter.id] ?? '').toLowerCase().includes(String(filter.value).toLowerCase())))
  const visibleRows = hostSliced ? hostRows.slice(pagination.pageIndex * pagination.pageSize, (pagination.pageIndex + 1) * pagination.pageSize) : viewData.rows
  return <>
    <DataTable columns={viewData.columns} rows={visibleRows} caption="ledger records" selectable
      toolbar={toolbar} footer={footer}
      columnFilters={columnFilters}
      onColumnFiltersChange={(next) => { setLastFilters(next); setFilters(next) }}
      {...(hostSliced ? { rowCount: hostRows.length, search, onSearchChange: (next) => { setLastSearch(next); setSearch(next) }, pagination, onPaginationChange: (next) => { setLastPagination(next); setPagination(next) } } : {})} />
    <div style={{ display: 'grid', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-label)', color: 'var(--ink-3)' }}>
      <span>column filters: <output className="tbl-callback-filters">{lastFilters === null ? 'no change' : JSON.stringify(lastFilters)}</output></span>
      <span>search: <output className="tbl-callback-search">{lastSearch === null ? 'no change' : JSON.stringify(lastSearch)}</output></span>
      <span>pagination: <output className="tbl-callback-pagination">{lastPagination === null ? 'no change' : JSON.stringify(lastPagination)}</output></span>
    </div>
  </>
}

export const ViewDefaults = { render: () => <ViewExample /> }
export const HostSliced = { render: () => <ViewExample hostSliced /> }
export const UncontrolledView = { args: { columns: viewData.columns, rows: viewData.rows, defaultPagination: { pageIndex: 1, pageSize: 2 }, caption: 'local ledger records' } }

export const ReadOnly = {
  name: 'read-only (no selection)',
  args: { selectable: false },
}

export const SortedAscending = {
  name: 'sorted by turns',
  args: { defaultSort: { key: 'turns', dir: 'asc' } },
}

export const SomeSelected = {
  name: 'some rows selected',
  args: { defaultSelectedKeys: ['t-01', 't-03'] },
}

export const AllSelected = {
  name: 'all rows selected',
  args: { defaultSelectedKeys: ROWS.map((r) => r.id) },
}

export const Empty = {
  name: 'empty (no rows)',
  args: { rows: [], caption: 'no transcripts published yet' },
}

export const CustomRenderers = {
  name: 'custom cell renderers',
  args: {
    selectable: false,
    caption: 'transcripts with rendered cells',
    columns: [
      { key: 'title', label: 'transcript', sortable: true },
      { key: 'provider', label: 'provider', sortable: true, render: providerCell },
      {
        key: 'redactions',
        label: 'redactions',
        sortable: true,
        align: 'right',
        render: (value) => (value === 0 ? 'clean' : `${value} redacted`),
      },
    ],
  },
}

/* a center-aligned column (the .tbl-center modifier on th + td). status reads as text, never
   colour alone, and stays the real value (not force-lowercased chrome). */
export const CenterAligned = {
  name: 'center-aligned column',
  args: {
    selectable: false,
    caption: 'transcripts with a centered status',
    columns: [
      { key: 'title', label: 'transcript', sortable: true },
      { key: 'provider', label: 'provider', sortable: true, render: providerCell },
      { key: 'status', label: 'status', sortable: true, align: 'center' },
      { key: 'turns', label: 'turns', sortable: true, align: 'right' },
    ],
    rows: [
      { id: 's-01', title: 'refactoring the ledger', provider: 'claude-code', status: 'published', turns: 48 },
      { id: 's-02', title: 'porting tokens to css vars', provider: 'gemini-cli', status: 'draft', turns: 21 },
      { id: 's-03', title: 'debugging the redaction pass', provider: 'claude-code', status: 'review', turns: 94 },
    ],
  },
}

/* the fully-controlled path: parent owns sort + selection via state, passes both value props
   and both change callbacks. exercises the most bug-prone branch (controlled, not uncontrolled). */
export const Controlled = {
  name: 'controlled sort + selection',
  args: { caption: 'controlled by the parent' },
  render: (args) => {
    const [sort, setSort] = useState({ key: 'turns', dir: 'desc' })
    const [selectedKeys, setSelectedKeys] = useState(['t-02'])
    return (
      <DataTable
        {...args}
        sort={sort}
        onSortChange={setSort}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
      />
    )
  },
}

/* interaction test on the canonical story: sort a column, then select-all. */
export const Interactions = {
  name: 'sort + select all (test)',
  args: { defaultSort: null },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    /* before sorting: source order -> first body row is "refactoring the ledger" */
    const firstRowBefore = canvas.getAllByRole('row')[1]
    await expect(within(firstRowBefore).getByText('refactoring the ledger')).toBeInTheDocument()

    /* click the sortable "transcript" header button -> ascending by title */
    const titleHeaderBtn = canvas.getByRole('button', { name: /transcript/i })
    await userEvent.click(titleHeaderBtn)

    /* aria-sort lands on the <th>, and onSortChange fired with the next state */
    const titleHeader = canvas.getByRole('columnheader', { name: /transcript/i })
    await waitFor(() => expect(titleHeader).toHaveAttribute('aria-sort', 'ascending'))
    await expect(args.onSortChange).toHaveBeenCalledWith({ key: 'title', dir: 'asc' })

    /* first body row changed: "a11y audit..." sorts ahead alphabetically */
    await waitFor(() => {
      const firstRowAfter = canvas.getAllByRole('row')[1]
      expect(within(firstRowAfter).getByText('a11y audit of the table')).toBeInTheDocument()
    })

    /* toggle select-all -> every body row gains is-selected + callback gets all keys */
    const selectAll = canvas.getByRole('checkbox', { name: /select all rows/i })
    await userEvent.click(selectAll)

    await waitFor(() => {
      const bodyRows = canvas.getAllByRole('row').slice(1)
      bodyRows.forEach((row) => expect(row).toHaveClass('is-selected'))
    })
    await expect(args.onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining(ROWS.map((r) => r.id)),
    )
    await expect(selectAll).toBeChecked()
  },
}

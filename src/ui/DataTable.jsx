import { useCallback, useId, useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/react-table'

/**
 * a sortable + selectable data table. square, hairline, mono headers; both themes
 * via tokens. sort + selection state/logic are powered by TanStack Table
 * (@tanstack/react-table, headless) while this component still renders its own markup
 * + token classes. Search, column filters and pagination can each be host-controlled
 * or seeded by defaults. Sorting cycles none -> asc -> desc -> none on a
 * sortable header (a real <button>, so it is keyboard-operable), exposes aria-sort on the
 * <th>, and shows a lucide chevron indicator. selection reuses the existing .check-box control:
 * a header checkbox selects/clears all (with an indeterminate middle state) and
 * each row carries its own. selected rows get a subtle highlight.
 *
 * sort + selection are each independently controlled OR uncontrolled:
 *  - sort: pass `sort` + `onSortChange` to control; otherwise `defaultSort` seeds it.
 *  - selection: pass `selectedKeys` + `onSelectionChange` to control; otherwise
 *    `defaultSelectedKeys` seeds it.
 *
 * @typedef {Object} DataTableColumn
 * @property {string} key            object key this column reads from each row.
 * @property {React.ReactNode} label header text (kept as passed; not forced-lowercase).
 * @property {boolean} [sortable]    when true the header sorts; default false.
 * @property {'left'|'right'|'center'|'decimal'} [align] default left. Decimal aligns plain dot-separated numbers; custom renderers and other formats fall back to right + tabular nums.
 * @property {string} [width] optional fixed column width (any css length, e.g. '12rem'); emits a <colgroup> entry so columns stay put as cell content changes.
 * @property {(value: any, row: Object) => React.ReactNode} [render] custom cell renderer; falls back to row[key].
 *
 * @typedef {{ key: string, dir: 'asc'|'desc' } | null} DataTableSort
 * @typedef {{ id: string, value: string }[]} DataTableColumnFilters
 * @typedef {{ pageIndex: number, pageSize: number }} DataTablePagination
 *
 * @param {Object} props
 * @param {DataTableColumn[]} props.columns                column definitions.
 * @param {Object[]} props.rows                            row objects.
 * @param {boolean} [props.selectable=false]              render the selection column.
 * @param {boolean} [props.disabled=false]                disable table controls while retaining keyboard scrolling.
 * @param {(row: Object, index: number) => (string|number)} [props.rowKey] stable key per row; defaults to row.id ?? index.
 * @param {DataTableSort} [props.defaultSort=null]        initial sort (uncontrolled).
 * @param {DataTableSort} [props.sort]                    controlled sort.
 * @param {(next: DataTableSort) => void} [props.onSortChange] called with the next sort state.
 * @param {Array<string|number>} [props.defaultSelectedKeys=[]] initial selection (uncontrolled).
 * @param {Array<string|number>} [props.selectedKeys]    controlled selection.
 * @param {(keys: Array<string|number>) => void} [props.onSelectionChange] called with the next selection.
 * @param {string} [props.caption]                       accessible <caption> for the table (visually present, mono/quiet).
 * @param {string} [props.className]                      extra class on the scroll wrapper.
 * @param {string} [props.search] controlled search.
 * @param {string} [props.defaultSearch=''] initial search.
 * @param {(next: string) => void} [props.onSearchChange] next search value.
 * @param {DataTableColumnFilters} [props.columnFilters] controlled column filters (TanStack id/value shape).
 * @param {DataTableColumnFilters} [props.defaultColumnFilters=[]] initial column filters.
 * @param {(next: DataTableColumnFilters) => void} [props.onColumnFiltersChange] next filters.
 * @param {DataTablePagination} [props.pagination] controlled pagination (zero-based pageIndex).
 * @param {DataTablePagination} [props.defaultPagination] defaults to pageIndex 0, pageSize 10.
 * @param {(next: DataTablePagination) => void} [props.onPaginationChange] next pagination.
 * @param {number} [props.rowCount] host total for host-sliced data: pagination stays manual (the page count comes from rowCount) and sorting stays local, while search and column filters still apply to the rows given; with a partial window and an active filter the footer reports the loaded rows, never the host total.
 */
export default function DataTable({
  columns,
  rows,
  selectable = false,
  disabled = false,
  rowKey,
  defaultSort = null,
  sort: sortProp,
  onSortChange,
  defaultSelectedKeys = [],
  selectedKeys: selectedProp,
  onSelectionChange,
  caption,
  className = '',
  search: searchProp,
  defaultSearch = '',
  onSearchChange,
  columnFilters: filtersProp,
  defaultColumnFilters = [],
  onColumnFiltersChange,
  pagination: paginationProp,
  defaultPagination = { pageIndex: 0, pageSize: 10 },
  onPaginationChange,
  rowCount,
}) {
  const baseId = useId()
  const [searchState, setSearchState] = useState(defaultSearch)
  const search = searchProp !== undefined ? searchProp : searchState
  const [filtersState, setFiltersState] = useState(defaultColumnFilters)
  const columnFilters = filtersProp !== undefined ? filtersProp : filtersState
  const [paginationState, setPaginationState] = useState(defaultPagination)
  const pagination = paginationProp !== undefined ? paginationProp : paginationState
  const setPagination = (next) => {
    if (paginationProp === undefined) setPaginationState(next)
    onPaginationChange?.(next)
  }
  const resetPage = () => {
    if (pagination.pageIndex !== 0) setPagination({ ...pagination, pageIndex: 0 })
  }
  const setSearch = (next) => {
    if (searchProp === undefined) setSearchState(next)
    onSearchChange?.(next)
    resetPage()
  }
  const setFilters = (next) => {
    if (filtersProp === undefined) setFiltersState(next)
    onColumnFiltersChange?.(next)
    resetPage()
  }
  /* stable references so TanStack doesn't treat these as changed options every render */
  const keyOf = useCallback((row, i) => (rowKey ? rowKey(row, i) : row.id ?? i), [rowKey])
  const getRowId = useCallback((row, i) => String(keyOf(row, i)), [keyOf])

  /* sort: controlled if `sort` prop is supplied, else internal state seeded by defaultSort.
     the public shape stays {key,dir}|null; TanStack drives the cycle + row order under it. */
  const [sortState, setSortState] = useState(defaultSort)
  const sort = sortProp !== undefined ? sortProp : sortState
  const setSort = (next) => {
    if (sortProp === undefined) setSortState(next)
    onSortChange?.(next)
  }

  /* selection: controlled if `selectedKeys` prop is supplied, else internal Set seeded by defaults.
     the public shape stays an array of the original row keys. */
  const [selState, setSelState] = useState(() => new Set(defaultSelectedKeys))
  const selected = selectedProp !== undefined ? new Set(selectedProp) : selState
  const setSelected = (nextSet) => {
    if (selectedProp === undefined) setSelState(nextSet)
    onSelectionChange?.([...nextSet])
  }

  /* TanStack column defs derived from the public `columns`: sorting only (we render our own
     markup below, so no header/cell defs are needed). compare() stays the comparator so the
     none -> asc -> desc -> none cycle and null-last ordering are byte-for-byte the old behaviour. */
  const tsColumns = useMemo(
    () =>
      columns.map((col) => ({
        id: col.key,
        accessorFn: (row) => row[col.key],
        enableSorting: !!col.sortable,
        sortingFn: nullsLast,
        sortDescFirst: false,
        filterFn: 'includesString',
      })),
    [columns],
  )

  /* TanStack keys rows by a string id; map it back to the original key type so the public
     selection callbacks keep emitting the caller's own keys (numbers stay numbers). */
  const keyByRowId = useMemo(() => {
    const m = new Map()
    rows.forEach((row, i) => m.set(String(keyOf(row, i)), keyOf(row, i)))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rowKey])

  /* fully-controlled adapters: our public state -> TanStack state, and back on change.
     these MUST be memoized to stable references. TanStack compares the `state` it receives
     against the value its onChange updater produced; if we hand it a brand-new `sorting`
     array / `rowSelection` object on every render (even with identical contents), a toggle
     can re-emit onRowSelectionChange -> setSelected -> re-render -> new object -> re-emit,
     i.e. the "Maximum update depth exceeded" freeze. memoizing on the actual contents keeps
     the reference identical whenever the selection/sort is unchanged, breaking that loop. */
  const sorting = useMemo(
    () => (sort ? [{ id: sort.key, desc: sort.dir === 'desc' }] : []),
    [sort?.key, sort?.dir],
  )
  const rowSelection = useMemo(() => {
    const sel = {}
    rows.forEach((row, i) => {
      if (selected.has(keyOf(row, i))) sel[String(keyOf(row, i))] = true
    })
    return sel
    // selected is a fresh Set when controlled; depend on its stable serialization instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, keyOf, selectedKey(selected)])

  const table = useReactTable({
    data: rows,
    columns: tsColumns,
    state: { sorting, rowSelection, globalFilter: search, columnFilters, pagination },
    globalFilterFn: 'includesString',
    manualPagination: rowCount !== undefined,
    rowCount,
    autoResetPageIndex: false,
    onPaginationChange: (updater) => setPagination(typeof updater === 'function' ? updater(pagination) : updater),
    getRowId,
    enableSortingRemoval: true, // the none-state at the end of the cycle
    enableMultiSort: false,
    sortDescFirst: false, // first click is ascending
    enableRowSelection: selectable,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      const s = next[0]
      setSort(s ? { key: s.id, dir: s.desc ? 'desc' : 'asc' } : null)
    },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater
      const set = new Set()
      for (const rid of Object.keys(next)) if (next[rid]) set.add(keyByRowId.get(rid) ?? rid)
      setSelected(set)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const sortedRows = table.getRowModel().rows
  const filteredRows = table.getFilteredRowModel().rows.length
  const filtersActive = Boolean(search) || columnFilters.length > 0
  const partialWindow = rowCount !== undefined && rowCount > rows.length
  const total = rowCount ?? filteredRows
  const countLabel = partialWindow && filtersActive
    ? `showing ${sortedRows.length} of ${rows.length} loaded`
    : `showing ${sortedRows.length} of ${total}`
  // Reserve an equal fractional width in every plain numeric cell in a decimal column.
  // React nodes and locale/currency strings retain the right-aligned tabular fallback.
  const decimalWidths = new Map(columns.filter((c) => c.align === 'decimal' && !c.render).map((c) => [c.key,
    Math.max(0, ...sortedRows.map((r) => decimalParts(r.original[c.key])?.fraction.length ?? 0)),
  ]))
  const colCount = columns.length + (selectable ? 1 : 0)

  return (
    <div className={`tbl-wrap${selectable ? ' tbl-has-selection' : ''}${className ? ' ' + className : ''}`}>
      <div className="tbl-tools">
        <label htmlFor={`${baseId}-search`}>search rows</label>
        <input id={`${baseId}-search`} className="input" type="search" disabled={disabled} value={search} onChange={(e) => setSearch(e.target.value)} />
        <details className="tbl-filters">
          <summary>column filters</summary>
          <div className="tbl-filter-fields">
            {columns.map((col) => <label key={col.key}>
              <span>{col.label}</span>
              <input className="input" disabled={disabled} aria-label={`filter ${typeof col.label === 'string' ? col.label : col.key}`} value={columnFilters.find((f) => f.id === col.key)?.value ?? ''} onChange={(e) => setFilters([
                ...columnFilters.filter((f) => f.id !== col.key),
                ...(e.target.value ? [{ id: col.key, value: e.target.value }] : []),
              ])} />
            </label>)}
          </div>
        </details>
        {(search || columnFilters.length > 0) && <span className="tbl-filter-active">filters active</span>}
      </div>
      <div className="tbl-chips">
        {search && <button type="button" disabled={disabled} className="tbl-chip" aria-label="remove search filter" onClick={() => setSearch('')}>search: {search}<X aria-hidden="true" /></button>}
        {columnFilters.map((filter) => <button key={filter.id} type="button" disabled={disabled} className="tbl-chip" aria-label={`remove ${filter.id} filter`} onClick={() => setFilters(columnFilters.filter((f) => f.id !== filter.id))}>
          {columns.find((c) => c.key === filter.id)?.label ?? filter.id}: {String(filter.value)}<X aria-hidden="true" />
        </button>)}
      </div>
      <div className="tbl-scroll" tabIndex={0} role="region" aria-label={caption || 'data table'}>
      <table className="tbl">
        {caption && <caption className="tbl-caption">{caption}</caption>}
        {(selectable || columns.some((c) => c.width)) && (
          <colgroup>
        {selectable && <col style={{ width: 'var(--tbl-sel-w)' }} />}
            {columns.map((col) => (
              <col key={col.key} style={col.width ? { width: col.width } : undefined} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="tbl-sel">
                <label className="tbl-sel-hit">
                  <input
                    type="checkbox"
                    className="check-box"
                    disabled={disabled}
                    checked={table.getIsAllRowsSelected()}
                    ref={(el) => el && (el.indeterminate = table.getIsSomeRowsSelected())}
                    onChange={table.getToggleAllRowsSelectedHandler()}
                    aria-label={table.getIsAllRowsSelected() ? 'clear selection' : 'select all rows'}
                  />
                </label>
              </th>
            )}
            {columns.map((col) => {
              const isSorted = sort?.key === col.key
              const ariaSort = isSorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
              const Indicator = !isSorted ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={alignClass('tbl-th', col.align)}
                  aria-sort={col.sortable ? ariaSort : undefined}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      disabled={disabled}
                      className={`tbl-sort${isSorted ? ' is-sorted' : ''}`}
                      onClick={table.getColumn(col.key)?.getToggleSortingHandler()}
                    >
                      <span className="tbl-th-label">{col.label}</span>
                      <Indicator className="tbl-sort-ic" aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="tbl-th-label">{col.label}</span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td className="tbl-empty" colSpan={colCount}>no rows</td>
            </tr>
          ) : (
            sortedRows.map((r, i) => {
              const row = r.original
              const isSel = r.getIsSelected()
              return (
                <tr key={r.id} className={isSel ? 'tbl-row is-selected' : 'tbl-row'}>
                  {selectable && (
                    <td className="tbl-sel">
                      <label className="tbl-sel-hit">
                        <input
                          id={`${baseId}-row-${r.id}`}
                          type="checkbox"
                          className="check-box"
                          disabled={disabled}
                          checked={isSel}
                          onChange={r.getToggleSelectedHandler()}
                          aria-label={`select row ${i + 1}`}
                        />
                      </label>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={alignClass('tbl-td', col.align)}>
                      {col.align === 'decimal' && !col.render && decimalParts(row[col.key]) ? <DecimalValue value={row[col.key]} places={decimalWidths.get(col.key)} /> :
                        <span className={col.align === 'right' || col.align === 'decimal' ? 'tnum' : undefined}>
                          {col.render ? col.render(row[col.key], row) : row[col.key]}
                        </span>}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
      </div>
      <div className="tbl-footer">
        <span className="tnum" role="status">{countLabel}</span>
        <button className="btn" type="button" disabled={disabled || !table.getCanPreviousPage()} onClick={() => table.previousPage()}>previous page</button>
        <span className="tnum">page {pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
        <button className="btn" type="button" disabled={disabled || !table.getCanNextPage()} onClick={() => table.nextPage()}>next page</button>
      </div>
    </div>
  )
}

/* a stable, order-independent fingerprint of a selection Set so a memo keyed on it only
   recomputes when the *contents* change, not when a controlled caller hands us a brand-new
   Set instance with the same keys. */
function selectedKey(set) {
  return [...set].map(String).sort().join(' ')
}

/* align -> alignment modifier class (right and decimal values also carry .tnum) */
function alignClass(base, align) {
  if (align === 'right' || align === 'decimal') return `${base} tbl-right`
  if (align === 'center') return `${base} tbl-center`
  return base
}

function decimalParts(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const match = String(value).match(/^(-?\d+)(?:\.(\d+))?$/)
  return match ? { integer: match[1], fraction: match[2] ?? '', dot: match[2] !== undefined } : null
}

function DecimalValue({ value, places }) {
  const parts = decimalParts(value)
  return <span className="tbl-decimal tnum">
    <span>{parts.integer}</span>
    <span className="tbl-decimal-point" aria-hidden={!parts.dot}>{parts.dot ? '.' : <span className="tbl-decimal-spacer">.</span>}</span>
    <span className="tbl-decimal-fraction" style={{ width: `${places}ch` }}>{parts.fraction}</span>
  </span>
}

/* a stable comparator: numbers numerically, everything else as locale strings;
   null/undefined sort last regardless of direction's later sign flip. */
function compare(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/* TanStack sortingFn signature: ascending order by the column's accessor value, reusing the
   comparator above so ordering (incl. null-last) is identical to the pre-library table. */
function nullsLast(rowA, rowB, columnId) {
  return compare(rowA.getValue(columnId), rowB.getValue(columnId))
}

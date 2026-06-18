import { useId, useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useReactTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table'

/**
 * a sortable + selectable data table. square, hairline, mono headers; both themes
 * via tokens. sort + selection state/logic are powered by TanStack Table
 * (@tanstack/react-table, headless) while this component still renders its own markup
 * + token classes, so the look is unchanged and growth (filtering, pagination, column
 * sizing/visibility) is a config away. sorting cycles none -> asc -> desc -> none on a
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
 * @property {'left'|'right'|'center'} [align] cell alignment; 'right' also gets tabular nums. default 'left'.
 * @property {string} [width] optional fixed column width (any css length, e.g. '12rem'); emits a <colgroup> entry so columns stay put as cell content changes.
 * @property {(value: any, row: Object) => React.ReactNode} [render] custom cell renderer; falls back to row[key].
 *
 * @typedef {{ key: string, dir: 'asc'|'desc' } | null} DataTableSort
 *
 * @param {Object} props
 * @param {DataTableColumn[]} props.columns                column definitions.
 * @param {Object[]} props.rows                            row objects.
 * @param {boolean} [props.selectable=false]              render the selection column.
 * @param {(row: Object, index: number) => (string|number)} [props.rowKey] stable key per row; defaults to row.id ?? index.
 * @param {DataTableSort} [props.defaultSort=null]        initial sort (uncontrolled).
 * @param {DataTableSort} [props.sort]                    controlled sort.
 * @param {(next: DataTableSort) => void} [props.onSortChange] called with the next sort state.
 * @param {Array<string|number>} [props.defaultSelectedKeys=[]] initial selection (uncontrolled).
 * @param {Array<string|number>} [props.selectedKeys]    controlled selection.
 * @param {(keys: Array<string|number>) => void} [props.onSelectionChange] called with the next selection.
 * @param {string} [props.caption]                       accessible <caption> for the table (visually present, mono/quiet).
 * @param {string} [props.className]                      extra class on the scroll wrapper.
 */
export default function DataTable({
  columns,
  rows,
  selectable = false,
  rowKey,
  defaultSort = null,
  sort: sortProp,
  onSortChange,
  defaultSelectedKeys = [],
  selectedKeys: selectedProp,
  onSelectionChange,
  caption,
  className = '',
}) {
  const baseId = useId()
  const keyOf = (row, i) => (rowKey ? rowKey(row, i) : row.id ?? i)

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

  /* fully-controlled adapters: our public state -> TanStack state, and back on change. */
  const sorting = sort ? [{ id: sort.key, desc: sort.dir === 'desc' }] : []
  const rowSelection = {}
  rows.forEach((row, i) => {
    if (selected.has(keyOf(row, i))) rowSelection[String(keyOf(row, i))] = true
  })

  const table = useReactTable({
    data: rows,
    columns: tsColumns,
    state: { sorting, rowSelection },
    getRowId: (row, i) => String(keyOf(row, i)),
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
  })

  const sortedRows = table.getSortedRowModel().rows
  const colCount = columns.length + (selectable ? 1 : 0)

  return (
    <div className={`tbl-wrap${className ? ' ' + className : ''}`}>
      <table className="tbl">
        {caption && <caption className="tbl-caption">{caption}</caption>}
        {(selectable || columns.some((c) => c.width)) && (
          <colgroup>
            {selectable && <col style={{ width: '1%' }} />}
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
                          checked={isSel}
                          onChange={r.getToggleSelectedHandler()}
                          aria-label={`select row ${i + 1}`}
                        />
                      </label>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={alignClass('tbl-td', col.align)}>
                      <span className={col.align === 'right' ? 'tnum' : undefined}>
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </span>
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

/* align -> alignment modifier class (right cells also carry .tnum on the value span) */
function alignClass(base, align) {
  if (align === 'right') return `${base} tbl-right`
  if (align === 'center') return `${base} tbl-center`
  return base
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

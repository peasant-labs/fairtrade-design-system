import { useId, useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

/**
 * a sortable + selectable data table. square, hairline, mono headers; both themes
 * via tokens. sorting cycles asc -> desc -> none on a sortable header (a real
 * <button>, so it is keyboard-operable), exposes aria-sort on the <th>, and shows
 * a lucide chevron indicator. selection reuses the existing .check-box control:
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

  /* sort: controlled if `sort` prop is supplied, else internal state seeded by defaultSort */
  const [sortState, setSortState] = useState(defaultSort)
  const sort = sortProp !== undefined ? sortProp : sortState
  const setSort = (next) => {
    if (sortProp === undefined) setSortState(next)
    onSortChange?.(next)
  }

  /* selection: controlled if `selectedKeys` prop is supplied, else internal Set seeded by defaults */
  const [selState, setSelState] = useState(() => new Set(defaultSelectedKeys))
  const selected = selectedProp !== undefined ? new Set(selectedProp) : selState
  const setSelected = (nextSet) => {
    if (selectedProp === undefined) setSelState(nextSet)
    onSelectionChange?.([...nextSet])
  }

  /* sorted view: never mutate the rows prop. 'none' sort keeps source order. */
  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => sign * compare(a[sort.key], b[sort.key]))
  }, [rows, columns, sort])

  /* cycle a header: none -> asc -> desc -> none */
  const cycleSort = (key) => {
    if (!sort || sort.key !== key) return setSort({ key, dir: 'asc' })
    if (sort.dir === 'asc') return setSort({ key, dir: 'desc' })
    return setSort(null)
  }

  const allKeys = sortedRows.map((row, i) => keyOf(row, i))
  const selectedCount = allKeys.filter((k) => selected.has(k)).length
  const allSelected = allKeys.length > 0 && selectedCount === allKeys.length
  const someSelected = selectedCount > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) return setSelected(new Set())
    setSelected(new Set(allKeys))
  }
  const toggleRow = (key) => {
    const next = new Set(selected)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelected(next)
  }

  const colCount = columns.length + (selectable ? 1 : 0)

  return (
    <div className={`tbl-wrap${className ? ' ' + className : ''}`}>
      <table className="tbl">
        {caption && <caption className="tbl-caption">{caption}</caption>}
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="tbl-sel">
                <input
                  type="checkbox"
                  className="check-box"
                  checked={allSelected}
                  ref={(el) => el && (el.indeterminate = someSelected)}
                  onChange={toggleAll}
                  aria-label={allSelected ? 'clear selection' : 'select all rows'}
                />
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
                      onClick={() => cycleSort(col.key)}
                    >
                      <span className="tbl-th-label">{col.label}</span>
                      <Indicator className="tbl-sort-ic" size={14} aria-hidden="true" />
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
            sortedRows.map((row, i) => {
              const k = keyOf(row, i)
              const isSel = selected.has(k)
              const cbId = `${baseId}-row-${k}`
              return (
                <tr key={k} className={isSel ? 'tbl-row is-selected' : 'tbl-row'}>
                  {selectable && (
                    <td className="tbl-sel">
                      <input
                        id={cbId}
                        type="checkbox"
                        className="check-box"
                        checked={isSel}
                        onChange={() => toggleRow(k)}
                        aria-label={`select row ${i + 1}`}
                      />
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

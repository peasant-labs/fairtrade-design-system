import { useId } from 'react'
import { X } from 'lucide-react'

/**
 * Optional table controls. Omit search or columnFilters to leave that control out;
 * children extend the toolbar with importer-owned actions.
 * @param {Object} props
 * @param {{ value: string, onChange: (value: string) => void }} [props.search]
 * @param {{ columns: import('./DataTable.jsx').DataTableColumn[], value: import('./DataTable.jsx').DataTableColumnFilters, onChange: (value: import('./DataTable.jsx').DataTableColumnFilters) => void }} [props.columnFilters]
 * @param {boolean} [props.disabled=false]
 * @param {React.ReactNode} [props.children]
 */
export function DataTableToolbar({ search, columnFilters, disabled = false, children }) {
  const id = useId()
  const filters = columnFilters?.value ?? []
  return <>
    <div className="tbl-tools">
      {search && <>
        <label htmlFor={`${id}-search`}>search rows</label>
        <input id={`${id}-search`} className="input" type="search" disabled={disabled} value={search.value} onChange={(event) => search.onChange(event.target.value)} />
      </>}
      {columnFilters && <details className="tbl-filters">
        <summary>column filters</summary>
        <div className="tbl-filter-fields">
          {columnFilters.columns.map((column) => <label key={column.key}>
            <span>{column.label}</span>
            <input className="input" disabled={disabled} aria-label={`filter ${typeof column.label === 'string' ? column.label : column.key}`} value={filters.find((filter) => filter.id === column.key)?.value ?? ''} onChange={(event) => columnFilters.onChange([
              ...filters.filter((filter) => filter.id !== column.key),
              ...(event.target.value ? [{ id: column.key, value: event.target.value }] : []),
            ])} />
          </label>)}
        </div>
      </details>}
      {(search?.value || filters.length > 0) && <span className="tbl-filter-active">filters active</span>}
      {children}
    </div>
    {(search?.value || filters.length > 0) && <div className="tbl-chips">
      {search?.value && <button type="button" disabled={disabled} className="tbl-chip" aria-label="remove search filter" onClick={() => search.onChange('')}>search: {search.value}<X aria-hidden="true" /></button>}
      {columnFilters && filters.map((filter) => <button key={filter.id} type="button" disabled={disabled} className="tbl-chip" aria-label={`remove ${filter.id} filter`} onClick={() => columnFilters.onChange(filters.filter((item) => item.id !== filter.id))}>
        {columnFilters.columns.find((column) => column.key === filter.id)?.label ?? filter.id}: {String(filter.value)}<X aria-hidden="true" />
      </button>)}
    </div>}
  </>
}

/**
 * Optional pagination/footer presentation, independent of the table's row markup.
 * @param {Object} props
 * @param {string} props.countLabel
 * @param {number} props.pageIndex
 * @param {number} props.pageCount
 * @param {boolean} props.canPreviousPage
 * @param {boolean} props.canNextPage
 * @param {() => void} props.onPreviousPage
 * @param {() => void} props.onNextPage
 * @param {boolean} [props.disabled=false]
 */
export function DataTablePaginationControls({ countLabel, pageIndex, pageCount, canPreviousPage, canNextPage, onPreviousPage, onNextPage, disabled = false }) {
  return <div className="tbl-footer">
    <span className="tnum" role="status">{countLabel}</span>
    <button className="btn" type="button" disabled={disabled || !canPreviousPage} onClick={onPreviousPage}>previous page</button>
    <span className="tnum">page {pageIndex + 1} of {Math.max(1, pageCount)}</span>
    <button className="btn" type="button" disabled={disabled || !canNextPage} onClick={onNextPage}>next page</button>
  </div>
}

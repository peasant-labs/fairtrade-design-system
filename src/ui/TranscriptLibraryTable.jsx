/**
 * TranscriptLibraryTable - the one shared transcript library table: a real table
 * with a caption, host columns, group header rows, the compact continuation row
 * for a group that began earlier, and numbered pages.
 */
import { Fragment } from 'react'
import { isPageSize } from '@peasant-labs/schema'
import { groupPageRows } from './groupPageRows.js'
import { ALL_COLUMN_ALIGNS, ColumnAlign } from './table/column-align.js'
import Pagination from './Pagination.jsx'

/* the grouping helpers live in their own module so a host can count without
   mounting the table; re-export them from the table module the barrel names. */
export { groupPageRows, groupKeysFor } from './groupPageRows.js'

/**
 * A host column.
 *
 * `id` is the host's closed-set member, so the table keys the column by `.wire`
 * and never by a raw string. `render(row)` returns the cell content; the table
 * owns only the cell and its alignment.
 *
 * @template Row
 * @template {import('./closed-value.js').ClosedValue<string, string>} ColumnId
 * @typedef {object} TranscriptLibraryColumn
 * @property {ColumnId} id
 * @property {string} label
 * @property {import('./table/column-align.js').ColumnAlign} align
 * @property {boolean} [numeric] pair counts and durations with tabular figures.
 * @property {(row: Row) => import('react').ReactNode} render
 */

/**
 * One composed saved view: `groupBy` from the URL and `visibleColumns`/`open`
 * from the device. The host composes it; the table receives it and reports
 * changes back, never reading a URL or storage itself.
 *
 * @template {import('./closed-value.js').ClosedValue<string, string>} GroupBy
 * @template {import('./closed-value.js').ClosedValue<string, string>} ColumnId
 * @typedef {object} SavedView
 * @property {GroupBy} groupBy
 * @property {readonly ColumnId[]} visibleColumns
 * @property {readonly string[]} open
 */

/**
 * A host offset page. `index` is the 1-based page the server returns (`page` on
 * the wire), `size` is a schema `PageSize` member, and `total` counts
 * transcripts, not rendered rows. `null` means the host renders a complete list:
 * the table hides the pager and renders every row.
 *
 * @typedef {object} TranscriptLibraryPage
 * @property {number} index
 * @property {import('@peasant-labs/schema').PageSize} size
 * @property {number} total
 */

/**
 * @template Row
 * @template {import('./closed-value.js').ClosedValue<string, string>} GroupBy
 * @template {import('./closed-value.js').ClosedValue<string, string>} ColumnId
 * @typedef {object} TranscriptLibraryTableProps
 * @property {string} caption
 * @property {readonly Row[]} rows
 * @property {(row: Row) => string} rowKey required: the host supplies a stable key; the table never derives one.
 * @property {readonly TranscriptLibraryColumn<Row, ColumnId>[]} columns
 * @property {GroupBy} groupBy
 * @property {(row: Row) => readonly string[]} groupKeys bare keys, such as [row.projectHash].
 * @property {(groupId: string) => string} groupLabel receives `${groupBy.wire}:${key}`.
 * @property {readonly string[] | null} nextGroupKeys bare keys from `page.nextItems`, or null.
 * @property {readonly string[] | null} continuedGroupKeys bare keys from the previous page, or null.
 * @property {TranscriptLibraryPage | null} page
 * @property {SavedView<GroupBy, ColumnId> | null} [viewState] the host's composed grouping, columns, and open groups.
 * @property {(view: SavedView<GroupBy, ColumnId>) => void} [onViewStateChange]
 * @property {(index: number) => void} [onPageChange]
 * @property {(size: import('@peasant-labs/schema').PageSize) => void} [onPageSizeChange]
 * @property {import('react').ReactNode} [emptyState]
 */

/**
 * The canonical transcript library table: one real table with a caption, host
 * columns, group header rows, a compact continuation row for a group that began
 * on an earlier page, a numbered pager, and an end-of-page marker for a group
 * that continues.
 *
 * The table is controlled. It renders the rows, page, and view it is given and
 * reports changes; it holds no storage, reads no URL, and never resets a page.
 *
 * @template Row
 * @template {import('./closed-value.js').ClosedValue<string, string>} GroupBy
 * @template {import('./closed-value.js').ClosedValue<string, string>} ColumnId
 * @param {TranscriptLibraryTableProps<Row, GroupBy, ColumnId>} props
 */
export function TranscriptLibraryTable({
  caption,
  rows,
  rowKey,
  columns,
  groupBy,
  groupKeys,
  groupLabel,
  nextGroupKeys = null,
  continuedGroupKeys = null,
  page = null,
  emptyState,
  onPageChange,
}) {
  assertCaption(caption)
  assertRows(rows)
  assertColumns(columns)
  assertRowKey(rowKey)
  const safePage = readPage(page)
  if (safePage && typeof onPageChange !== 'function') throw refusePageCallback()

  const groups = groupPageRows(rows, groupBy, groupKeys, groupLabel, nextGroupKeys, continuedGroupKeys)
  const columnCount = columns.length
  const totalPages = safePage ? Math.max(1, Math.ceil(safePage.total / safePage.size)) : 1
  const currentPage = safePage ? Math.min(Math.max(1, safePage.index), totalPages) : 1

  return (
    <div className="libt">
      <div className="tbl-scroll" tabIndex={0} role="region" aria-label={caption}>
        <table className="tbl libt-table" role="table">
          <caption className="tbl-caption">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => {
                const align = dataTableAlign(column)
                return (
                  <th key={column.id.wire} scope="col" className={alignClass('tbl-th', align)}>
                    <span className="tbl-th-label">{column.label}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr data-row-kind="empty">
                <td className="tbl-empty" colSpan={columnCount}>{emptyState ?? 'no transcripts'}</td>
              </tr>
            ) : (
              groups.map((group) => (
                <Fragment key={group.id || '__ungrouped'}>
                  {group.id !== '' && (group.continued
                    ? continuationRow(group, columnCount)
                    : headerRow(group, columnCount))}
                  {group.rows.map((row) => {
                    const key = readRowKey(rowKey, row)
                    return (
                      <tr key={`${group.id}::${key}`} className="libt-row" data-row-kind="row" data-row-key={key}>
                        {columns.map((column) => {
                          const align = dataTableAlign(column)
                          const content = column.render(row)
                          return (
                            <td key={column.id.wire} className={alignClass('tbl-td', align)}>
                              {column.numeric || align === 'right' || align === 'decimal'
                                ? <span className="tnum">{content}</span>
                                : content}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {group.continues && continuesRow(group, columnCount, safePage, currentPage)}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      {safePage && (
        <div className="libt-footer">
          <span className="libt-page-status tnum" role="status">{`page ${currentPage} of ${totalPages}`}</span>
          <span className="libt-page-size tnum">{`${safePage.size} per page`}</span>
          <Pagination
            page={currentPage}
            totalItems={safePage.total}
            pageSize={safePage.size}
            onChange={(next) => onPageChange(next)}
            label="transcript pages"
          />
        </div>
      )}
    </div>
  )
}

/**
 * A group header row: the full header a group keeps when it starts on the page.
 *
 * @param {{ id: string, label: string }} group
 * @param {number} columnCount
 */
function headerRow(group, columnCount) {
  return (
    <tr className="libt-group" data-row-kind="group">
      <th scope="rowgroup" colSpan={columnCount}>{group.label}</th>
    </tr>
  )
}

/**
 * The compact continuation row: the one line a group opens with when it began on
 * an earlier page. The text is the marker, never a colour.
 *
 * @param {{ label: string }} group
 * @param {number} columnCount
 */
function continuationRow(group, columnCount) {
  return (
    <tr className="libt-continuation" data-row-kind="continuation">
      <th scope="rowgroup" colSpan={columnCount}>{`${group.label}, continued`}</th>
    </tr>
  )
}

/**
 * The end-of-page marker: a group that has rows on the next page. The text names
 * the continuation page, never a colour.
 *
 * @param {{ label: string }} group
 * @param {number} columnCount
 * @param {TranscriptLibraryPage | null} page
 * @param {number} currentPage
 */
function continuesRow(group, columnCount, page, currentPage) {
  const where = page ? `on page ${currentPage + 1}` : 'on the next page'
  return (
    <tr className="libt-continues" data-row-kind="continues">
      <td colSpan={columnCount}>{`${group.label} continues ${where}`}</td>
    </tr>
  )
}

/**
 * The two alignment vocabularies meet here and nowhere else.
 *
 * @param {{ align: import('./table/column-align.js').ColumnAlign }} column
 * @returns {'left' | 'right' | 'center' | 'decimal'}
 */
function dataTableAlign(column) {
  const wire = column.align?.wire
  const member = ALL_COLUMN_ALIGNS.find((candidate) => candidate.wire === wire)
  if (member === ColumnAlign.Start) return 'left'
  if (member === ColumnAlign.End) return 'right'
  if (member === ColumnAlign.Center) return 'center'
  if (member === ColumnAlign.Decimal) return 'decimal'
  throw new TypeError(
    `TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: column ${JSON.stringify(column.id?.wire)} has an unknown align ${JSON.stringify(wire)}. ` +
      'Alignment is a closed set, so the table refuses to render an unaligned cell. ' +
      'Pass ColumnAlign.Start, ColumnAlign.End, ColumnAlign.Center, or ColumnAlign.Decimal.',
  )
}

/**
 * @param {string} base
 * @param {'left' | 'right' | 'center' | 'decimal'} align
 * @returns {string}
 */
function alignClass(base, align) {
  if (align === 'right') return `${base} tbl-right`
  if (align === 'center') return `${base} tbl-center`
  if (align === 'decimal') return `${base} tbl-right tbl-decimal`
  return base
}

/**
 * @param {unknown} caption
 * @returns {asserts caption is string}
 */
function assertCaption(caption) {
  if (typeof caption === 'string' && caption.length > 0) return
  throw new TypeError(
    'TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: caption must be a non-empty string. ' +
      'The caption is the table\'s accessible name and only visible description, so an empty one leaves the table unnamed. ' +
      'Pass a lowercase chrome caption such as "your transcripts".',
  )
}

/**
 * @param {unknown} rows
 * @returns {asserts rows is readonly unknown[]}
 */
function assertRows(rows) {
  if (Array.isArray(rows)) return
  throw new TypeError(
    'TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: rows must be an array. ' +
      'The table renders exactly the page rows the host gives it and never fetches. ' +
      'Pass the page rows (or an empty array for a complete-list surface).',
  )
}

/**
 * @param {unknown} columns
 * @returns {asserts columns is readonly { id: { wire: string }, label: string, align: unknown, render: Function }[]}
 */
function assertColumns(columns) {
  if (!Array.isArray(columns) || columns.length === 0) throw refuseColumns('must be a non-empty array')
  for (const column of columns) {
    if (!column || typeof column !== 'object') throw refuseColumns('every column must be an object')
    if (typeof column.id?.wire !== 'string' || column.id.wire.length === 0) throw refuseColumns('every column id must be a closed-set member with a non-empty string wire')
    if (typeof column.label !== 'string') throw refuseColumns('every column label must be a string')
    if (typeof column.render !== 'function') throw refuseColumns('every column render must be a function')
  }
}

/**
 * @param {string} reason
 * @returns {TypeError}
 */
function refuseColumns(reason) {
  return new TypeError(
    `TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: columns ${reason}. ` +
      'A column is { id: ClosedValue, label, align: ColumnAlign, render(row) }; the table keys and renders it, so a malformed column would leave a gap. ' +
      'Pass the host column definitions as an array with at least one column.',
  )
}

/**
 * @param {unknown} rowKey
 * @returns {asserts rowKey is (row: any) => string}
 */
function assertRowKey(rowKey) {
  if (typeof rowKey === 'function') return
  throw new TypeError(
    'TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: rowKey must be a function. ' +
      'The table renders one row per group membership, so it cannot derive a stable key from row content; a missing key would remount rows on every page. ' +
      'Pass rowKey={row => row.sync.id}.',
  )
}

/**
 * @param {(row: any) => string} rowKey
 * @param {any} row
 * @returns {string}
 */
function readRowKey(rowKey, row) {
  const key = rowKey(row)
  if (typeof key === 'string' && key.length > 0) return key
  throw new TypeError(
    `TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: rowKey(row) must return a non-empty string, received ${describe(key)}. ` +
      'Every rendered row is keyed by its group id plus this value, so an empty key makes two rows indistinguishable. ' +
      'Return the host stable identifier for this row.',
  )
}

/**
 * @param {unknown} page
 * @returns {TranscriptLibraryPage | null}
 */
function readPage(page) {
  if (page == null) return null
  if (typeof page !== 'object') throw refusePage('page must be an object or null')
  const { index, size, total } = /** @type {{ index?: unknown, size?: unknown, total?: unknown }} */ (page)
  if (!Number.isInteger(index) || index < 1) throw refusePage('page.index must be the 1-based page the server returns')
  if (!isPageSize(size)) throw refusePage('page.size must be a @peasant-labs/schema PageSize member (25, 50, or 100)')
  if (!Number.isInteger(total) || total < 0) throw refusePage('page.total must be a non-negative integer transcript count')
  return { index, size, total }
}

/**
 * @param {string} reason
 * @returns {TypeError}
 */
function refusePage(reason) {
  return new TypeError(
    `TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: ${reason}. ` +
      'The table divides no page itself: it renders the one offset page the host requested and reports page changes. ' +
      'Pass { index, size, total } from the server page, or null for a complete list.',
  )
}

/** @returns {TypeError} */
function refusePageCallback() {
  return new TypeError(
    'TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: onPageChange must be a function when page is not null. ' +
      'A paged table renders page controls, and a control that cannot report a change is a dead control. ' +
      'Pass onPageChange(index) that requests the page, or pass page={null} for a complete list.',
  )
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function describe(value) {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return `a ${typeof value}`
}

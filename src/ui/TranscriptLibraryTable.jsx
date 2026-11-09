/**
 * TranscriptLibraryTable - the one shared transcript library table: a real table
 * with a caption, host columns, group header rows, the compact continuation row
 * for a group that began earlier, and numbered pages.
 */
import { Fragment, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { AllPageSizes, isPageSize } from '@peasant-labs/schema'
import { groupPageRows } from './groupPageRows.js'
import { ALL_COLUMN_ALIGNS, ColumnAlign } from './table/column-align.js'
import { alignClass } from './table/align-class.js'
import { ColumnPicker, GroupByPicker } from './table/library-pickers.jsx'
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
 * One composed saved view: `groupBy` from the URL and `visibleColumns`/`collapsed`
 * from the device. The host composes it; the table receives it and reports
 * changes back, never reading a URL or storage itself.
 *
 * `visibleColumns` holds the known column members the table shows; the first
 * declared column is the row identity and always shows. An unknown member is
 * dropped when the view is reported back, so the host can rewrite its stored
 * value. `collapsed` lists the qualified group ids the reader closed; an empty
 * list opens every group. The list is page-independent: a collapse recorded on
 * one page is the same qualified id on every page, so it never closes an
 * unrelated group. The host composes both fields from the device and clears
 * `collapsed` when `groupBy` changes; the table reports it unchanged.
 *
 * @template {import('./closed-value.js').ClosedValue<string, string>} GroupBy
 * @template {import('./closed-value.js').ClosedValue<string, string>} ColumnId
 * @typedef {object} SavedView
 * @property {GroupBy} groupBy
 * @property {readonly ColumnId[]} visibleColumns
 * @property {readonly string[]} collapsed
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
 * @property {readonly TranscriptLibraryColumn<Row, ColumnId>[]} columns every host column, in declaration order; the first column is the row identity and always shows.
 * @property {GroupBy} groupBy the host default grouping, used when no saved view names a known member.
 * @property {readonly GroupBy[]} [groupByOptions] the grouping members the picker offers; defaults to `[groupBy]`.
 * @property {(row: Row) => readonly string[]} groupKeys bare keys, such as [row.projectHash].
 * @property {(groupId: string) => string} groupLabel receives `${groupBy.wire}:${key}`.
 * @property {readonly string[] | null} nextGroupKeys bare keys from `page.nextItems`, or null.
 * @property {readonly string[] | null} continuedGroupKeys bare keys from the previous page, or null.
 * @property {TranscriptLibraryPage | null} page
 * @property {SavedView<GroupBy, ColumnId> | null} [viewState] the host's composed grouping, columns, and collapsed groups; a known saved view wins over the host default.
 * @property {(view: SavedView<GroupBy, ColumnId>) => void} [onViewStateChange]
 * @property {(index: number) => void} [onPageChange]
 * @property {(size: import('@peasant-labs/schema').PageSize) => void} [onPageSizeChange]
 * @property {import('react').ReactNode} [emptyState]
 */

/**
 * The resolved saved view the table renders: the host's saved view read against
 * the columns and grouping members this table actually knows. An unknown member
 * falls back to the host default rather than rendering an empty or broken view.
 *
 * @template {import('./closed-value.js').ClosedValue<string, string>} GroupBy
 * @template {import('./closed-value.js').ClosedValue<string, string>} ColumnId
 * @typedef {object} ResolvedSavedView
 * @property {GroupBy} groupBy
 * @property {readonly GroupBy[]} groupByOptions
 * @property {readonly ColumnId[]} visibleColumns
 * @property {readonly string[]} collapsed the qualified group ids the reader closed.
 */

/**
 * The canonical transcript library table: one real table with a caption, host
 * columns, group header rows, a compact continuation row for a group that began
 * on an earlier page, a numbered pager, and an end-of-page marker for a group
 * that continues.
 *
 * The table is controlled. It renders the rows, page, and view it is given and
 * reports changes; it holds no storage, reads no URL, and never resets a page.
 * A saved view (when given) supplies the grouping, the visible columns, and the
 * collapsed groups; without one every column shows, every group is open, and the two
 * pickers are absent because they would have nothing to report to.
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
  groupByOptions,
  groupKeys,
  groupLabel,
  nextGroupKeys = null,
  continuedGroupKeys = null,
  page = null,
  viewState = null,
  onViewStateChange,
  emptyState,
  onPageChange,
  onPageSizeChange,
}) {
  assertCaption(caption)
  assertRows(rows)
  assertColumns(columns)
  assertRowKey(rowKey)
  const safePage = readPage(page)
  if (safePage && typeof onPageChange !== 'function') throw refusePageCallback()
  if (safePage && typeof onPageSizeChange !== 'function') throw refusePageSizeCallback()
  const view = readView(viewState, groupBy, groupByOptions, columns)
  if (view && typeof onViewStateChange !== 'function') throw refuseViewCallback()

  const activeGroupBy = view ? view.groupBy : groupBy
  const groups = groupPageRows(rows, activeGroupBy, groupKeys, groupLabel, nextGroupKeys, continuedGroupKeys)
  const shownColumns = view
    ? columns.filter((column) => view.visibleColumns.some((id) => id.wire === column.id.wire))
    : columns
  const columnCount = shownColumns.length
  const totalPages = safePage ? Math.max(1, Math.ceil(safePage.total / safePage.size)) : 1
  const currentPage = safePage ? Math.min(Math.max(1, safePage.index), totalPages) : 1
  const continues = !safePage || currentPage < totalPages

  // A stale URL grouping resolves to the host default for rendering. Report that
  // resolution once so the host rewrites its own value instead of keeping an
  // unknown member forever. The ref keeps an ignoring host from being told on
  // every render.
  const reportedFallback = useRef('')
  useEffect(() => {
    if (!view || viewState == null) return
    const given = readMemberWire(readField(viewState, 'groupBy')) ?? ''
    if (given === view.groupBy.wire) return
    const key = `${given}\u0000${view.groupBy.wire}`
    if (reportedFallback.current === key) return
    reportedFallback.current = key
    if (typeof onViewStateChange === 'function') {
      onViewStateChange({ groupBy: view.groupBy, visibleColumns: view.visibleColumns, collapsed: view.collapsed })
    }
  }, [view, viewState, onViewStateChange])

  /**
   * Report one composed view. The host owns the reset: a `groupBy` change keeps
   * `collapsed` as given, and the host clears it when it writes the new grouping.
   *
   * @param {{ groupBy: GroupBy, visibleColumns: readonly ColumnId[], collapsed: readonly string[] }} next
   */
  const reportView = (next) => {
    if (typeof onViewStateChange === 'function') {
      onViewStateChange({ groupBy: next.groupBy, visibleColumns: next.visibleColumns, collapsed: next.collapsed })
    }
  }

  /** @param {string} groupId */
  const toggleGroup = (groupId) => {
    if (!view) return
    const collapsed = view.collapsed.includes(groupId)
      ? view.collapsed.filter((id) => id !== groupId)
      : [...view.collapsed, groupId]
    reportView({ groupBy: view.groupBy, visibleColumns: view.visibleColumns, collapsed })
  }

  return (
    <div className="libt">
      {view && (
        <div className="libt-tools">
          <GroupByPicker
            options={view.groupByOptions}
            value={view.groupBy}
            onChange={(next) => reportView({ groupBy: next, visibleColumns: view.visibleColumns, collapsed: view.collapsed })}
          />
          <ColumnPicker
            columns={columns}
            visibleColumns={view.visibleColumns}
            onChange={(column, wasVisible) => {
              const next = columns
                .filter((candidate) => (candidate.id.wire === column.id.wire ? !wasVisible : view.visibleColumns.some((id) => id.wire === candidate.id.wire)))
                .map((candidate) => candidate.id)
              if (next.length === 0) return
              reportView({ groupBy: view.groupBy, visibleColumns: next, collapsed: view.collapsed })
            }}
          />
        </div>
      )}
      <div className="tbl-scroll" tabIndex={0} role="region" aria-label={caption}>
        <table className="tbl libt-table">
          <caption className="tbl-caption">{caption}</caption>
          <thead>
            <tr>
              {shownColumns.map((column) => {
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
              groups.map((group) => {
                const expanded = group.id === '' || view === null || !view.collapsed.includes(group.id)
                const toggle = view === null ? null : toggleGroup
                return (
                  <Fragment key={group.id || '__ungrouped'}>
                    {group.id !== '' && (group.continued
                      ? continuationRow(group, columnCount, expanded, toggle)
                      : headerRow(group, columnCount, expanded, toggle))}
                    {expanded && group.rows.map((row) => {
                      const key = readRowKey(rowKey, row)
                      return (
                        <tr key={`${group.id}::${key}`} className="libt-row" data-row-kind="row" data-row-key={key}>
                          {shownColumns.map((column) => {
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
                    {group.continues && continues && continuesRow(group, columnCount, safePage, currentPage)}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {safePage && (
        <div className="libt-footer">
          <span className="libt-page-status tnum" role="status">{`page ${currentPage} of ${totalPages}`}</span>
          <label className="libt-page-size">
            <span>per page</span>
            <span className="select-wrap">
              <select
                className="select"
                aria-label="page size"
                value={safePage.size}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!isPageSize(next)) throw refusePageSize(next)
                  onPageSizeChange(next)
                }}
              >
                {AllPageSizes.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </span>
          </label>
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
 * With a saved view the header carries the group's expand toggle and its
 * `aria-expanded` state; without one it is the plain header.
 *
 * @param {{ id: string, label: string, rows: readonly unknown[] }} group
 * @param {number} columnCount
 * @param {boolean} expanded
 * @param {((groupId: string) => void) | null} onToggle null when the table has no saved view to report to.
 */
function headerRow(group, columnCount, expanded, onToggle) {
  return (
    <tr className="libt-group" data-row-kind="group">
      <th scope="rowgroup" colSpan={columnCount}>
        <GroupToggle groupId={group.id} label={group.label} expanded={expanded} onToggle={onToggle} />
      </th>
    </tr>
  )
}

/**
 * The compact continuation row: the one line a group opens with when it began on
 * an earlier page. The text is the marker, never a colour, and the row keeps the
 * group's toggle and `aria-expanded` state so the header stays operable.
 *
 * @param {{ id: string, label: string, rows: readonly unknown[] }} group
 * @param {number} columnCount
 * @param {boolean} expanded
 * @param {((groupId: string) => void) | null} onToggle
 */
function continuationRow(group, columnCount, expanded, onToggle) {
  return (
    <tr className="libt-continuation" data-row-kind="continuation">
      <th scope="rowgroup" colSpan={columnCount}>
        <GroupToggle groupId={group.id} label={`${group.label}, continued`} expanded={expanded} onToggle={onToggle} />
      </th>
    </tr>
  )
}

/**
 * The group header content: a real toggle button that announces expanded and
 * collapsed beside the group label. It falls back to plain text when the table
 * has no saved view to report to. The label is the only text, so the same group
 * never reads two ways depending on whether a saved view is attached.
 *
 * @param {object} props
 * @param {string} props.groupId
 * @param {string} props.label
 * @param {boolean} props.expanded
 * @param {((groupId: string) => void) | null} props.onToggle
 */
function GroupToggle({ groupId, label, expanded, onToggle }) {
  if (onToggle === null) return label
  return (
    <button
      type="button"
      className="libt-group-toggle"
      aria-expanded={expanded}
      onClick={() => onToggle(groupId)}
    >
      <ChevronDown className="libt-group-chev" aria-hidden="true" />
      <span className="libt-group-label">{label}</span>
    </button>
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
  const index = readField(page, 'index')
  const size = readField(page, 'size')
  const total = readField(page, 'total')
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 1) throw refusePage('page.index must be the 1-based page the server returns')
  if (!isPageSize(size)) throw refusePage('page.size must be a @peasant-labs/schema PageSize member (25, 50, or 100)')
  if (typeof total !== 'number' || !Number.isInteger(total) || total < 0) throw refusePage('page.total must be a non-negative integer transcript count')
  return { index, size, total }
}

/**
 * Read the host's saved view against the columns and grouping members this table
 * knows. A saved view wins when its members resolve; an unknown grouping member
 * falls back to the host default, and an unknown or empty column list falls back
 * to every column. The first column is the row identity, so it always shows.
 *
 * @template {import('./closed-value.js').ClosedValue<string, string>} GroupBy
 * @template {import('./closed-value.js').ClosedValue<string, string>} ColumnId
 * @param {SavedView<GroupBy, ColumnId> | null} viewState
 * @param {GroupBy} defaultGroupBy
 * @param {readonly GroupBy[] | undefined} groupByOptions
 * @param {readonly TranscriptLibraryColumn<any, ColumnId>[]} columns
 * @returns {ResolvedSavedView<GroupBy, ColumnId> | null}
 */
function readView(viewState, defaultGroupBy, groupByOptions, columns) {
  if (viewState == null) return null
  if (typeof viewState !== 'object') throw refuseView('viewState must be an object or null')
  const options = readGroupByOptions(groupByOptions, defaultGroupBy)
  const requested = readMember(readField(viewState, 'groupBy'), 'viewState.groupBy')
  const fallback = options.find((option) => option.wire === defaultGroupBy.wire) ?? options[0]
  const groupBy = options.find((option) => option.wire === requested.wire) ?? fallback
  const savedColumns = readField(viewState, 'visibleColumns')
  const defaultColumns = columns.map((column) => column.id)
  const knownColumns = Array.isArray(savedColumns)
    ? columns
        .filter((column) => savedColumns.some((id) => readMemberWire(id) === column.id.wire))
        .map((column) => column.id)
    : []
  const visibleColumns = knownColumns.length > 0
    ? [columns[0].id, ...knownColumns.filter((id) => id.wire !== columns[0].id.wire)]
    : defaultColumns
  // `collapsed` is page-independent: the qualified id of a group the reader
  // closed. An empty (or missing) list opens every group; an unknown id simply
  // matches no rendered group, so a stale value is harmless until the host
  // clears it on a grouping change.
  const savedCollapsed = readField(viewState, 'collapsed')
  const collapsed = Array.isArray(savedCollapsed)
    ? savedCollapsed.filter((id) => typeof id === 'string' && id.length > 0)
    : []
  return { groupBy, groupByOptions: options, visibleColumns, collapsed }
}

/**
 * The grouping members the picker may offer. The host default is included even
 * when the host omits it, so the table always has one member to render.
 *
 * @template {import('./closed-value.js').ClosedValue<string, string>} GroupBy
 * @param {readonly GroupBy[] | undefined} groupByOptions
 * @param {GroupBy} defaultGroupBy
 * @returns {readonly GroupBy[]}
 */
function readGroupByOptions(groupByOptions, defaultGroupBy) {
  const requested = groupByOptions == null ? [defaultGroupBy] : groupByOptions
  if (!Array.isArray(requested) || requested.length === 0) {
    throw refuseView('groupByOptions must be a non-empty array of grouping members when given')
  }
  /** @type {GroupBy[]} */
  const options = []
  for (const member of requested) {
    const read = readMember(member, 'groupByOptions[]')
    if (!options.some((option) => option.wire === read.wire)) options.push(/** @type {GroupBy} */ (read))
  }
  const fallback = readMember(defaultGroupBy, 'groupBy')
  if (!options.some((option) => option.wire === fallback.wire)) options.push(/** @type {GroupBy} */ (fallback))
  return options
}

/**
 * Read a closed-set member from a boundary value: it must carry a non-empty
 * string wire. The label is chrome and never identity.
 *
 * @param {unknown} member
 * @param {string} name
 * @returns {{ wire: string, label?: string }}
 */
function readMember(member, name) {
  const wire = readMemberWire(member)
  if (wire !== null) return member
  throw refuseView(`${name} must be a closed-set member with a non-empty string wire`)
}

/**
 * @param {unknown} member
 * @returns {string | null}
 */
function readMemberWire(member) {
  if (typeof member !== 'object' || member === null) return null
  const wire = Reflect.get(member, 'wire')
  return typeof wire === 'string' && wire.length > 0 ? wire : null
}

/**
 * Read one property from a record without asserting its type; every field is
 * validated below the boundary.
 *
 * @param {object} record
 * @param {string} key
 * @returns {unknown}
 */
function readField(record, key) {
  return Reflect.get(record, key)
}

/**
 * @param {string} reason
 * @returns {TypeError}
 */
function refuseView(reason) {
  return new TypeError(
    `TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: ${reason}. ` +
      'The saved view is one composed value: groupBy from the URL and visibleColumns and collapsed from the device. ' +
      'Pass a resolved SavedView, or null to render every column and every group open with no pickers.',
  )
}

/** @returns {TypeError} */
function refuseViewCallback() {
  return new TypeError(
    'TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: onViewStateChange must be a function when viewState is not null. ' +
      'A saved view renders pickers and group toggles, and a control that cannot report a change is a dead control. ' +
      'Pass onViewStateChange(view) that writes the URL grouping and the stored columns and collapsed groups, or pass viewState={null}.',
  )
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

/** @returns {TypeError} */
function refusePageSizeCallback() {
  return new TypeError(
    'TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: onPageSizeChange must be a function when page is not null. ' +
      'A paged table renders a page-size control, and a control that cannot report a change is a dead control. ' +
      'Pass onPageSizeChange(size) that requests the page size, or pass page={null} for a complete list.',
  )
}

/**
 * @param {unknown} size
 * @returns {TypeError}
 */
function refusePageSize(size) {
  return new TypeError(
    `TranscriptLibraryTable failed in src/ui/TranscriptLibraryTable.jsx: the page-size control received ${describe(size)}. ` +
      'A page size is the schema PageSize set (25, 50, or 100); any other value would request a page the server does not serve. ' +
      'Let the control choose one of the offered sizes.',
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

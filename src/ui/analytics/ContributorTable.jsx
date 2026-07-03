/* ContributorTable — the 7-column contributor rollup on the analytics surface.
   Reuses the shared `.tbl-*` table family (components.css) so it sorts, hovers
   and themes exactly like every other fairtrade table. Sortable by any column
   (default: sessions desc, ties broken by contributor id); rows arrive
   pre-sorted from `perContributorBreakdown` and re-sort locally.

   The host controls how each contributor is displayed via `renderContributor`
   (name / avatar / link) — the surface never assumes an identity or a route;
   the default cell is an initial-letter avatar plus the opaque id. */

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { formatDuration, formatRate, formatTokens } from './format.js'
import { resolvedRate } from './metrics.js'

/** @typedef {import('./types.js').ContributorBreakdown} ContributorBreakdown */

/* Column model: `value` feeds the sort comparator (cells render explicitly in
   the tbody). A missing resolve-rate (no outcomes recorded) sorts below 0%. */
const COLS = [
  { key: 'contributor', label: 'contributor', numeric: false, value: (row) => row.contributorId },
  { key: 'sessions', label: 'sessions', numeric: true, value: (row) => row.sessions },
  { key: 'activeWeeks', label: 'active wks', numeric: true, value: (row) => row.activeWeeks },
  { key: 'tokens', label: 'tokens', numeric: true, value: (row) => row.totalTokens },
  { key: 'duration', label: 'duration', numeric: true, value: (row) => row.totalDurationMins },
  { key: 'commits', label: 'commits', numeric: true, value: (row) => row.totalCommits },
  {
    key: 'resolved',
    label: 'resolved',
    numeric: true,
    // Share of KNOWN outcomes that resolved; a no-known-outcome row ("—")
    // sorts below 0%.
    value: (row) => resolvedRate(row.outcomes) ?? -1,
  },
]

/**
 * @param {Object} props
 * @param {ContributorBreakdown[]} props.rows Pre-sorted rollup rows (sessions desc).
 * @param {(row: ContributorBreakdown) => import('react').ReactNode} [props.renderContributor]
 *   Host-owned renderer for the contributor cell. Defaults to an
 *   initial-letter avatar + the raw id.
 * @param {number} [props.limit] Cap the number of rows shown; omit for all.
 * @param {string} [props.className]
 */
export default function ContributorTable({ rows, renderContributor, limit, className }) {
  const [sortKey, setSortKey] = useState('sessions')
  const [dir, setDir] = useState('desc')

  const shown = useMemo(() => {
    const col = COLS.find((c) => c.key === sortKey) ?? COLS[1]
    const sorted = [...rows].sort((a, b) => {
      const va = col.value(a)
      const vb = col.value(b)
      const r = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb))
      if (r !== 0) return dir === 'desc' ? -r : r
      return a.contributorId.localeCompare(b.contributorId)
    })
    return typeof limit === 'number' ? sorted.slice(0, limit) : sorted
  }, [rows, sortKey, dir, limit])

  const onSort = (key) => {
    if (key === sortKey) {
      setDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setDir(key === 'contributor' ? 'asc' : 'desc')
    }
  }

  return (
    <div className={['tbl-wrap', className].filter(Boolean).join(' ')}>
      <table className="tbl">
        <thead>
          <tr>
            {COLS.map((col) => {
              const sorted = sortKey === col.key
              const Ic = !sorted ? ChevronsUpDown : dir === 'desc' ? ChevronDown : ChevronUp
              return (
                <th
                  key={col.key}
                  className={['tbl-th', col.numeric && 'tbl-right'].filter(Boolean).join(' ')}
                  aria-sort={sorted ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}
                >
                  <button
                    type="button"
                    className={['tbl-sort', sorted && 'is-sorted'].filter(Boolean).join(' ')}
                    onClick={() => onSort(col.key)}
                  >
                    <span className="tbl-th-label">{col.label}</span>
                    <Ic className="tbl-sort-ic lucide" aria-hidden="true" />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr className="tbl-row" key={row.contributorId}>
              <td className="tbl-td">
                {renderContributor ? (
                  renderContributor(row)
                ) : (
                  <span className="gan-contrib">
                    <span className="avatar" aria-hidden="true">
                      {row.contributorId.slice(0, 1).toUpperCase()}
                    </span>
                    {row.contributorId}
                  </span>
                )}
              </td>
              <td className="tbl-td tbl-right"><span className="tnum">{row.sessions}</span></td>
              <td className="tbl-td tbl-right"><span className="tnum">{row.activeWeeks}</span></td>
              <td className="tbl-td tbl-right"><span className="tnum">{formatTokens(row.totalTokens)}</span></td>
              <td className="tbl-td tbl-right"><span className="tnum">{formatDuration(row.totalDurationMins)}</span></td>
              <td className="tbl-td tbl-right"><span className="tnum">{row.totalCommits}</span></td>
              <td className="tbl-td tbl-right">
                <span className="tnum">
                  {resolvedRate(row.outcomes) == null ? '—' : formatRate(resolvedRate(row.outcomes))}
                </span>
              </td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td className="tbl-empty" colSpan={COLS.length}>no contributor data.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

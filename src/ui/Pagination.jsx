import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/* numbered pagination (the richer sibling of the simple .pager / <Pager>). a row of real
   <button> page numbers with ellipsis truncation when there are many pages, flanked by
   lowercase prev/next controls with chevron icons. the current page is marked with
   aria-current="page" and the scarce amber. prev/next disable at the ends. supports
   controlled (page + onChange) and uncontrolled (defaultPage) use, and either an explicit
   `total` page count or `totalItems` + `pageSize` to derive it. new namespaced .pgn-* css
   (see the .pgn-* block appended to index.css) — reuses tokens, square, hairline, tabular. */

/**
 * build the windowed page list: first + last page always shown, a window of
 * `siblingCount` pages on each side of the current page, and 'gap' markers where
 * a run of pages is collapsed. returns an array of page numbers and 'gap-l' / 'gap-r'
 * sentinels (kept distinct so the two ellipses get stable react keys).
 *
 * @param {number} page    current 1-based page
 * @param {number} total   total page count (>= 1)
 * @param {number} sibling pages to show on each side of the current page
 * @returns {(number | 'gap-l' | 'gap-r')[]}
 */
function pageRange(page, total, sibling) {
  // first, last, current +/- sibling, and the two pages adjacent to the ends so a
  // single hidden page never becomes a gap (an ellipsis hiding one page wastes a slot)
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
  const left = Math.max(2, page - sibling)
  const right = Math.min(total - 1, page + sibling)
  const showLeftGap = left > 3
  const showRightGap = right < total - 2

  if (total <= 1) return [1]
  // how many fixed slots: first + last + current window + (gaps or the single page each gap would hide)
  if (!showLeftGap && !showRightGap) return range(1, total)
  if (showLeftGap && !showRightGap) return [1, 'gap-l', ...range(left, total)]
  if (!showLeftGap && showRightGap) return [...range(1, right), 'gap-r', total]
  return [1, 'gap-l', ...range(left, right), 'gap-r', total]
}

/**
 * @typedef {Object} PaginationProps
 * @property {number} [page]            controlled current page (1-based); pair with onChange.
 * @property {number} [defaultPage=1]   initial page when uncontrolled.
 * @property {number} [total]           total number of pages. if omitted it is derived from
 *                                      totalItems / pageSize.
 * @property {number} [totalItems]      total item count, used with pageSize to derive `total`.
 * @property {number} [pageSize=10]     items per page, used with totalItems to derive `total`.
 * @property {(nextPage: number) => void} [onChange] called with the new 1-based page on any change.
 * @property {number} [siblingCount=1]  page buttons shown on each side of the current page.
 * @property {string} [label='pagination'] aria-label for the <nav>.
 *
 * @param {PaginationProps} props
 */
export default function Pagination({
  page,
  defaultPage = 1,
  total,
  totalItems,
  pageSize = 10,
  onChange,
  siblingCount = 1,
  label = 'pagination',
}) {
  const isControlled = page !== undefined
  // uncontrolled state; the controlled value (when given) drives `current` directly below
  const [internal, setInternal] = useState(defaultPage)
  const derivedTotal =
    total ?? (totalItems != null ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1)
  const count = Math.max(1, derivedTotal)

  const current = clamp(isControlled ? page : internal, 1, count)

  const go = (next) => {
    const target = clamp(next, 1, count)
    if (target === current) return
    if (!isControlled) setInternal(target)
    onChange?.(target)
  }

  const atStart = current <= 1
  const atEnd = current >= count
  const items = pageRange(current, count, Math.max(0, siblingCount))

  return (
    <nav className="pgn" aria-label={label}>
      <button
        type="button"
        className="pgn-btn pgn-edge"
        aria-label="previous page"
        disabled={atStart}
        onClick={() => go(current - 1)}
      >
        <ChevronLeft size={14} aria-hidden="true" />
        <span>prev</span>
      </button>
      <ul className="pgn-list">
        {items.map((it) =>
          typeof it === 'number' ? (
            <li key={it}>
              <button
                type="button"
                className="pgn-btn pgn-num tnum"
                aria-label={`page ${it}`}
                aria-current={it === current ? 'page' : undefined}
                onClick={() => go(it)}
              >
                {it}
              </button>
            </li>
          ) : (
            <li key={it} className="pgn-gap" aria-hidden="true">
              …
            </li>
          )
        )}
      </ul>
      <button
        type="button"
        className="pgn-btn pgn-edge"
        aria-label="next page"
        disabled={atEnd}
        onClick={() => go(current + 1)}
      >
        <span>next</span>
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </nav>
  )
}

/* clamp keeps the page within [1, total] for both controlled and uncontrolled values. */
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

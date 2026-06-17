import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * the simple prev/next pager (the .pager specimen). a label naming the current page,
 * flanked by previous/next icon buttons. reuses .pager + .btn.btn-secondary.btn-sm.btn-icon
 * with no new css. for numbered pagination use a separate component.
 *
 * @typedef {Object} PagerProps
 * @property {number} page - the current (1-based) page number. default 1.
 * @property {number} total - the total number of pages. default 1.
 * @property {() => void} [onPrev] - called when the previous button is clicked.
 * @property {() => void} [onNext] - called when the next button is clicked.
 * @property {(nextPage: number) => void} [onChange] - called with the new page number on either button (fallback when onPrev/onNext are not given).
 * @property {string} [label] - aria-label for the whole pager nav. default 'pagination'.
 *
 * @param {PagerProps} props
 */
export default function Pager({ page = 1, total = 1, onPrev, onNext, onChange, label = 'pagination' }) {
  const atStart = page <= 1
  const atEnd = page >= total

  const goPrev = () => {
    if (atStart) return
    if (onPrev) onPrev()
    else if (onChange) onChange(page - 1)
  }
  const goNext = () => {
    if (atEnd) return
    if (onNext) onNext()
    else if (onChange) onChange(page + 1)
  }

  return (
    <nav className="pager" aria-label={label}>
      <button
        className="btn btn-secondary btn-sm btn-icon"
        aria-label="previous page"
        onClick={goPrev}
        disabled={atStart}
      >
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      <span>
        page <span className="tnum">{page}</span> / <span className="tnum">{total}</span>
      </span>
      <button
        className="btn btn-secondary btn-sm btn-icon"
        aria-label="next page"
        onClick={goNext}
        disabled={atEnd}
      >
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </nav>
  )
}

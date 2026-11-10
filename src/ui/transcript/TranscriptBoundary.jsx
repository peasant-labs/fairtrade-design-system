import { ChevronDown, ChevronUp } from 'lucide-react'
import { boundaryCaption } from './segments.js'

/* TranscriptBoundary — the faded dotted rule that stands where the document continues.

   DUMB: it renders one boundary descriptor from the loaded-region model and reports
   the adjacent segment to load. The rule is vertical because the transcript is a
   column of turns; the caption and the one control sit at the rule's end where the
   next content appears. There is no numbered pager and no page size: a boundary is a
   place in a document, not a page coordinate.

   Exported as `TranscriptSegmentBoundary` from the transcript barrel. */

/** @typedef {import('./segments.js').SegmentBoundaryVM} SegmentBoundaryVM */

/**
 * @param {object} props
 * @param {SegmentBoundaryVM} props.boundary
 * @param {(segmentIndex: number) => void} [props.onLoadMore]
 * @param {boolean} [props.loading]        the host is fetching the adjacent segment
 */
export default function TranscriptBoundary({ boundary, onLoadMore, loading = false }) {
  const older = boundary.side === 'older'
  const Icon = older ? ChevronUp : ChevronDown
  const label = boundary.side === 'all' ? 'load the transcript' : 'load more'
  return (
    <div
      className={`txn-segboundary txn-segboundary-${boundary.side}`}
      data-segment-boundary={boundary.side}
      data-segment-count={boundary.segmentCount}
    >
      <span className="txn-segboundary-rule" aria-hidden="true" />
      <div className="txn-segboundary-controls">
        <span className="txn-segboundary-caption tnum">{boundaryCaption(boundary)}</span>
        <button
          type="button"
          className="txn-segboundary-load"
          onClick={() => onLoadMore?.(boundary.loadSegment)}
          disabled={loading || typeof onLoadMore !== 'function'}
          aria-label={`${label}, ${boundary.segmentCount === 1 ? 'segment' : `${boundary.segmentCount} segments`}, ${boundaryCaption(boundary)}`}
        >
          <Icon size={14} aria-hidden="true" /> {label}
        </button>
      </div>
    </div>
  )
}

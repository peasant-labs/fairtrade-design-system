// @ts-check
/* Typed scroll-restore handle for TranscriptViewer.

   Hosts use this imperative handle via `<TranscriptViewer ref={...} />` to
   measure, check, restore, and observe scroll on the main transcript stream by
   served row position without querying Fairtrade's private DOM classes or
   attributes. */

/** Why a transcript stream scroll notification fired. Closed. */
export const TranscriptScrollCause = Object.freeze({
  ReaderInput: 'reader-input',
  Other: 'other',
})

/** @typedef {(typeof TranscriptScrollCause)[keyof typeof TranscriptScrollCause]} TranscriptScrollCauseValue */

/** @type {Set<string>} */
const SCROLL_CAUSES = new Set(Object.values(TranscriptScrollCause))

/** @param {unknown} value @returns {value is TranscriptScrollCauseValue} */
export function isTranscriptScrollCause(value) {
  return SCROLL_CAUSES.has(/** @type {string} */ (value))
}

/**
 * @typedef {object} TranscriptScrollEvent
 * @property {TranscriptScrollCauseValue} cause
 */

/** @typedef {(event: TranscriptScrollEvent) => void} TranscriptScrollListener */

/**
 * @typedef {object} TranscriptScrollHandle
 * @property {(position: number) => number | undefined} getRowOffset
 *   Read the main row's top offset relative to the stream's top, in pixels.
 *   Returns undefined when the stream or row is not rendered, or when the row
 *   belongs to earlier history.
 * @property {(position: number) => boolean} isRowInView
 *   Whether the main row intersects the stream's visible viewport. Returns
 *   false when the stream or row is not rendered or belongs to earlier history.
 * @property {(position: number, savedOffset: number) => boolean} restoreRowOffset
 *   Adjust the stream's scrollTop so the main row sits at `savedOffset` pixels
 *   below the stream's top. Returns true when applied, false when the row is
 *   not rendered or `savedOffset` is not finite.
 * @property {(listener: TranscriptScrollListener) => () => void} subscribeScroll
 *   Subscribe to stream scroll notifications classified by `TranscriptScrollCause`.
 *   Returns an unsubscribe function.
 */

const EARLIER_HISTORY_SELECTOR = '.txn-earlier'

/**
 * Resolve a rendered main-partition row element for `position`. Never returns
 * rows inside earlier history or disconnected elements.
 *
 * @param {HTMLElement | null | undefined} stream
 * @param {HTMLElement | null | undefined} row
 * @param {number} position
 * @returns {{ stream: HTMLElement, row: HTMLElement } | undefined}
 */
function resolveMainRow(stream, row, position) {
  if (!Number.isInteger(position) || position < 0) return undefined
  if (!stream || !stream.isConnected) return undefined
  if (!row || !row.isConnected || !stream.contains(row)) return undefined
  if (row.closest(EARLIER_HISTORY_SELECTOR)) return undefined
  return { stream, row }
}

/**
 * Build the imperative scroll-restore handle backed by the viewer's live
 * stream and main-row refs.
 *
 * @param {object} deps
 * @param {() => HTMLElement | null} deps.getStream
 * @param {(position: number) => HTMLElement | null | undefined} deps.getRow
 * @param {(listener: TranscriptScrollListener) => () => void} deps.subscribe
 * @returns {TranscriptScrollHandle}
 */
export function createTranscriptScrollHandle({ getStream, getRow, subscribe }) {
  /** @param {number} position @returns {number | undefined} */
  function getRowOffset(position) {
    const resolved = resolveMainRow(getStream(), getRow(position), position)
    if (!resolved) return undefined
    return resolved.row.getBoundingClientRect().top - resolved.stream.getBoundingClientRect().top
  }

  /** @param {number} position @returns {boolean} */
  function isRowInView(position) {
    const resolved = resolveMainRow(getStream(), getRow(position), position)
    if (!resolved) return false
    const streamRect = resolved.stream.getBoundingClientRect()
    const rowRect = resolved.row.getBoundingClientRect()
    return streamRect.bottom > streamRect.top && rowRect.bottom > streamRect.top && rowRect.top < streamRect.bottom
  }

  /** @param {number} position @param {number} savedOffset @returns {boolean} */
  function restoreRowOffset(position, savedOffset) {
    if (!Number.isFinite(savedOffset)) return false
    const resolved = resolveMainRow(getStream(), getRow(position), position)
    if (!resolved) return false
    const offsetNow = resolved.row.getBoundingClientRect().top - resolved.stream.getBoundingClientRect().top
    resolved.stream.scrollTop += offsetNow - savedOffset
    return true
  }

  /** @param {TranscriptScrollListener} listener @returns {() => void} */
  function subscribeScroll(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('TranscriptScrollHandle.subscribeScroll requires a listener function.')
    }
    return subscribe(listener)
  }

  return Object.freeze({
    getRowOffset,
    isRowInView,
    restoreRowOffset,
    subscribeScroll,
  })
}

/**
 * Attach DOM listeners on a mounted `.txn-stream` element and classify reader
 * input (`wheel`, `touchstart`, `keydown`) separately from `scroll` events.
 *
 * @param {HTMLElement} stream
 * @param {(event: TranscriptScrollEvent) => void} notify
 * @returns {() => void}
 */
export function attachStreamScrollObserver(stream, notify) {
  const onReaderInput = () => notify({ cause: TranscriptScrollCause.ReaderInput })
  const onOtherScroll = () => notify({ cause: TranscriptScrollCause.Other })
  stream.addEventListener('wheel', onReaderInput, { passive: true })
  stream.addEventListener('touchstart', onReaderInput, { passive: true })
  stream.addEventListener('keydown', onReaderInput)
  stream.addEventListener('scroll', onOtherScroll, { passive: true })
  return () => {
    stream.removeEventListener('wheel', onReaderInput)
    stream.removeEventListener('touchstart', onReaderInput)
    stream.removeEventListener('keydown', onReaderInput)
    stream.removeEventListener('scroll', onOtherScroll)
  }
}

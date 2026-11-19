/** Values accepted by the host-owned continuation control. */
export const TranscriptContinuationState = Object.freeze({
  More: 'more',
  Loading: 'loading',
  End: 'end',
  Cut: 'cut',
  Failed: 'failed',
})

/** Whether a loaded transcript contains its final response. */
export const TranscriptTail = Object.freeze({
  Complete: 'complete',
  Incomplete: 'incomplete',
})

/** Accessible copy owned by the continuation control. */
export const TranscriptContinuationLabels = Object.freeze({
  LoadMore: 'load more of this session',
})

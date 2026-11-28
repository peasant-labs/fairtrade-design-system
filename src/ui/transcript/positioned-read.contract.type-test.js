// @ts-check
/* Contract type-test for the positioned reader's host contract. It imports the ACTUAL
   sub-barrel a host imports and pins, at the type level, what a host writes against: the
   transport it supplies, the response each method resolves, the target, the failure it reads
   back, the closed landing set, and the hook's { viewerProps, controls } shape. Enforced by
     pnpm test:contract        (tsc -p tsconfig.contract.json; checkJs+strict, noEmit)
   Each @ts-expect-error must surface a real error: relaxing the contract turns it into TS2578. */

/** @typedef {import('./index.js').PositionedReadTransport} PositionedReadTransport */
/** @typedef {import('./index.js').PositionedHostResponse} PositionedHostResponse */
/** @typedef {import('./index.js').PositionedTarget} PositionedTarget */
/** @typedef {import('./index.js').PositionedReadFailure} PositionedReadFailure */
/** @typedef {import('./index.js').PositionedReaderOptions} PositionedReaderOptions */
/** @typedef {import('./index.js').PositionedTranscript} PositionedTranscript */
/** @typedef {import('./index.js').PositionedLandingValue} PositionedLandingValue */
/** @typedef {import('./index.js').PositionedReadFailureKindValue} PositionedReadFailureKindValue */
/** @typedef {import('./index.js').PositionedReadStatusValue} PositionedReadStatusValue */
/** @typedef {import('./index.js').PositionedReadDataValue} PositionedReadDataValue */
/** @typedef {import('./index.js').TranscriptScrollHandle} TranscriptScrollHandle */
/** @typedef {import('./index.js').TranscriptScrollCauseValue} TranscriptScrollCauseValue */
/** @typedef {import('./index.js').TranscriptScrollEvent} TranscriptScrollEvent */
/** @typedef {import('./index.js').TranscriptScrollListener} TranscriptScrollListener */

import { TranscriptScrollCause, historySectionId, isTranscriptScrollCause, parseHistorySectionId } from './index.js'

/** @type {string} */
const sectionId = historySectionId(0)
// @ts-expect-error historySectionId requires a numeric section index
const badSectionId = historySectionId('0')
/** @type {number | undefined} */
const parsedSection = parseHistorySectionId(sectionId)

/** @type {PositionedHostResponse} */
const busy = { status: 503, retryAfterSeconds: 2, body: null }
/** @param {object} _request @param {AbortSignal} _signal @returns {Promise<PositionedHostResponse>} */
const answer = (_request, _signal) => Promise.resolve(busy)

/** @type {PositionedReadTransport} */
const transport = { directory: answer, segment: answer, window: answer, header: answer }
// @ts-expect-error a transport without its segment read is not a transport
/** @type {PositionedReadTransport} */ const partial = { directory: answer, window: answer }

/** @type {PositionedTarget} */
const target = { transport: { kind: 'village_transcript', transcriptId: '0b9a3e7c-5d41-4c1f-9a7e-2f6b8c1d4e50' }, turn: 12 }

/** @type {PositionedLandingValue} */
const exact = 'exact'
// @ts-expect-error landing is the closed set, never any string
/** @type {PositionedLandingValue} */ const nearest = 'nearest'

/** @type {PositionedReaderOptions} */
const options = { transport, target, landing: exact }
// @ts-expect-error the reader's options take the closed landing set
/** @type {PositionedReaderOptions} */ const loose = { transport, target, landing: 'nearest' }

/** @type {PositionedReadFailure} */
const failure = { kind: 'busy', operation: 'segment', retryAfterSeconds: 2 }
// @ts-expect-error a failure kind outside the closed set is refused
/** @type {PositionedReadFailureKindValue} */ const timeout = 'timeout'

/** @type {PositionedReadStatusValue} */
const ready = 'ready'
/** @type {PositionedReadDataValue} */
const dataValue = 'busy'
// @ts-expect-error the DOM value is limited to statuses and failure kinds
/** @type {PositionedReadDataValue} */ const unknownDataValue = 'unknown'

/** @param {PositionedTranscript} read */
function host(read) {
  const { viewerProps, controls } = read
  /** @type {import('./index.js').TranscriptViewerProps} */
  const props = { ...viewerProps, capabilities: { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false } }
  /** @type {Promise<unknown>} */ const again = controls.retry()
  controls.openSection(0)
  controls.closeSection(0)
  /** @type {boolean | undefined} */ const snapped = controls.landing?.snapped
  /** @type {import('./index.js').TranscriptViewModel | undefined} */ const vm = viewerProps.viewModel
  /** @type {import('react').RefObject<TranscriptScrollHandle | null>} */
  const viewerRef = { current: null }
  /** @type {import('./index.js').TranscriptViewerProps} */
  const propsWithRef = { ...props, ref: viewerRef }
  /** @type {TranscriptScrollCauseValue} */
  const readerInputCause = TranscriptScrollCause.ReaderInput
  /** @type {boolean} */
  const causeCheck = isTranscriptScrollCause(readerInputCause)
  // @ts-expect-error scroll cause is a closed set, never an arbitrary DOM event name
  /** @type {TranscriptScrollCauseValue} */ const invalidCause = 'wheel'
  if (viewerRef.current) {
    /** @type {number | undefined} */ const offset = viewerRef.current.getRowOffset(0)
    /** @type {boolean} */ const inView = viewerRef.current.isRowInView(0)
    /** @type {boolean} */ const restored = viewerRef.current.restoreRowOffset(0, offset ?? 0)
    /** @type {() => void} */ const unsubscribe = viewerRef.current.subscribeScroll((event) => {
      /** @type {TranscriptScrollCauseValue} */ const cause = event.cause
      void cause
    })
    void inView
    void restored
    unsubscribe()
  }
  return { again, snapped, vm, props: propsWithRef, causeCheck, invalidCause }
}

export { partial, nearest, loose, failure, timeout, ready, dataValue, unknownDataValue, options, host, sectionId, badSectionId, parsedSection }

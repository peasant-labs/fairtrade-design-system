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



/** @param {PositionedTranscript} read */
function host(read) {
  const { viewerProps, controls } = read
  /** @type {Promise<unknown>} */ const again = controls.retry()
  controls.openSection(0)
  controls.closeSection(0)
  /** @type {boolean | undefined} */ const snapped = controls.landing?.snapped
  /** @type {import('./index.js').TranscriptViewModel | undefined} */ const vm = viewerProps.viewModel
  return { again, snapped, vm }
}

export { partial, nearest, loose, failure, timeout, options, host }

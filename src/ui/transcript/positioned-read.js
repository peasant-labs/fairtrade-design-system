/* The positioned reader: the one controller for positioned (v2) segmented transcript reads.

   A host supplies transport only: five request functions that resolve the raw HTTP status and the
   decoded body, or reject when the network failed. Everything else is decided here, once, for every
   host: which segments to read (the fetch set F), in what order, how a status maps to a failure
   kind, how a body is parsed (Schema's z* parsers), how the read context is checked, which segments
   stay resident, and how history sections open and close.

   The fetch set. With W_d the default window (no `turn`) and W_t the window at the deep link's
   recorded index, the segment requests are exactly F = ordinals(W_d) ∪ ordinals(W_t), each once,
   the target's run first. No segment is read to number a row and nothing between the two runs is
   read until the reader asks for it.

   No fallback. A failure shows a failure state; nothing here reads or re-renders a whole document. */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  isPositionedDirectoryPositionsValid,
  Role,
  TranscriptSegmentPartitionKind,
  TranscriptUsagePresence,
  zPositionedDirectory,
  zPositionedSegment,
  zPositionedWindow,
  zTranscriptContentHeader,
  zTranscriptEntryMatch,
} from '@peasant-labs/schema'
import { adaptTranscript, positionedPartitionId } from './adapter.js'
import { createUsageAccumulator } from './usage.js'
import { parseEarlierHistoryState } from './earlier-history-state.js'
import { positionedIntegrity } from './integrity.js'

/** Why a positioned read did not produce content. Closed. */
export const PositionedReadFailureKind = Object.freeze({
  Stale: 'stale',
  Busy: 'busy',
  Denied: 'denied',
  Unavailable: 'unavailable',
  Failed: 'failed',
  Malformed: 'malformed',
  Network: 'network',
})

/** Which row a deep link lands on: the requested row (exact), or the window's anchor turn (snapped). Closed. */
export const PositionedLanding = Object.freeze({
  Exact: 'exact',
  Snapped: 'snapped',
})

/** Where a positioned read, or one history section of it, stands. Closed. */
export const PositionedReadStatus = Object.freeze({
  Closed: 'closed',
  Loading: 'loading',
  Ready: 'ready',
  Failed: 'failed',
})

/** @typedef {(typeof PositionedReadFailureKind)[keyof typeof PositionedReadFailureKind]} PositionedReadFailureKindValue */
/** @typedef {(typeof PositionedLanding)[keyof typeof PositionedLanding]} PositionedLandingValue */
/** @typedef {(typeof PositionedReadStatus)[keyof typeof PositionedReadStatus]} PositionedReadStatusValue */
/** @typedef {PositionedReadStatusValue | PositionedReadFailureKindValue} PositionedReadDataValue */

const FAILURE_KINDS = new Set(Object.values(PositionedReadFailureKind))
const LANDINGS = new Set(Object.values(PositionedLanding))
const STATUSES = new Set(Object.values(PositionedReadStatus))

/** @param {unknown} value @returns {value is PositionedReadFailureKindValue} */
export function isPositionedReadFailureKind(value) { return FAILURE_KINDS.has(/** @type {string} */ (value)) }
/** @param {unknown} value @returns {value is PositionedLandingValue} */
export function isPositionedLanding(value) { return LANDINGS.has(/** @type {string} */ (value)) }
/** @param {unknown} value @returns {value is PositionedReadStatusValue} */
export function isPositionedReadStatus(value) { return STATUSES.has(/** @type {string} */ (value)) }

/** The resident segment budget when the host names none. Internal: a host may pass `residency`, but
    the default is this reader's to tune. */
const DEFAULT_RESIDENCY = 24
/** The wait a busy answer gets when it names none, or names one that is not a non-negative number. */
const DEFAULT_BUSY_SECONDS = 1

/** Every string the reader's states show. The one place to edit that wording. */
export const POSITIONED_READ_COPY = Object.freeze({
  loading: 'loading transcript',
  busy: (seconds) => `the server is busy and asked for ${seconds} s. this reader tries again after that.`,
  busyAction: 'try now',
  stale: 'this transcript changed since it was opened. reload to read the current version.',
  staleAction: 'reload transcript',
  staleHeading: 'transcript changed',
  failedHeading: 'could not load the transcript',
  untitled: 'transcript',
  deniedHeading: 'transcript not found',
  deniedBody: 'it may not exist, or you may not have access to it.',
  unavailableHeading: 'content unavailable',
  unavailableBody: "this transcript's stored content has been lost and cannot be loaded. there is no copy to restore.",
  failed: 'could not load that part of the transcript.',
  malformed: 'the server sent a response this reader could not use, so it was discarded.',
  network: 'could not reach the server. check the connection and try again.',
  retryAction: 'try again',
  historyLoading: 'loading earlier history',
  historyRecorded: (count) => `${count} recorded ${count === 1 ? 'turn' : 'turns'}`,
  historyExact: (count) => `${count} ${count === 1 ? 'turn' : 'turns'}`,
})

/** The sentence a failure kind shows in a notice. Busy names its wait. */
export function positionedFailureSentence(kind, retryAfterSeconds) {
  switch (kind) {
    case PositionedReadFailureKind.Busy: return POSITIONED_READ_COPY.busy(retryAfterSeconds ?? DEFAULT_BUSY_SECONDS)
    case PositionedReadFailureKind.Stale: return POSITIONED_READ_COPY.stale
    case PositionedReadFailureKind.Denied: return `${POSITIONED_READ_COPY.deniedHeading}. ${POSITIONED_READ_COPY.deniedBody}`
    case PositionedReadFailureKind.Unavailable: return POSITIONED_READ_COPY.unavailableBody
    case PositionedReadFailureKind.Malformed: return POSITIONED_READ_COPY.malformed
    case PositionedReadFailureKind.Network: return POSITIONED_READ_COPY.network
    default: return POSITIONED_READ_COPY.failed
  }
}

/**
 * The status → kind table, defined once. 2xx is not a failure and never reaches here.
 * @param {number} status
 */
function failureKindOfStatus(status) {
  if (status === 409) return PositionedReadFailureKind.Stale
  if (status === 503) return PositionedReadFailureKind.Busy
  if (status === 404) return PositionedReadFailureKind.Denied
  if (status === 410) return PositionedReadFailureKind.Unavailable
  return PositionedReadFailureKind.Failed
}

/** @param {unknown} value */
function busySeconds(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : DEFAULT_BUSY_SECONDS
}

const isOk = (status) => typeof status === 'number' && status >= 200 && status < 300

/** A failure that discards everything the reader holds. */
const DISCARDING = new Set([PositionedReadFailureKind.Stale, PositionedReadFailureKind.Denied, PositionedReadFailureKind.Unavailable])

class ReadFailure extends Error {
  /** @param {string} kind @param {string} operation @param {number} [retryAfterSeconds] */
  constructor(kind, operation, retryAfterSeconds) {
    super(`positioned read ${operation} failed: ${kind}`)
    this.kind = kind
    this.operation = operation
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds
  }
}

const sameTransport = (a, b) => !!a && !!b && a.kind === b.kind && (a.transcriptId ?? null) === (b.transcriptId ?? null) && (a.sessionId ?? null) === (b.sessionId ?? null)
const partitionRequest = (section) => (section === undefined
  ? { kind: TranscriptSegmentPartitionKind.Main }
  : { kind: TranscriptSegmentPartitionKind.History, sectionIndex: section })
const samePartition = (served, requested) => served?.kind === requested.kind && (served?.sectionIndex ?? undefined) === (requested.sectionIndex ?? undefined)

/**
 * @typedef {{ status: number, retryAfterSeconds?: number, body: unknown }} PositionedHostResponse
 * @typedef {object} PositionedReadTransport  host-owned I/O; each method takes (request, AbortSignal)
 * @property {(request: object, signal: AbortSignal) => Promise<PositionedHostResponse>} directory
 * @property {(request: object, signal: AbortSignal) => Promise<PositionedHostResponse>} segment
 * @property {(request: object, signal: AbortSignal) => Promise<PositionedHostResponse>} window
 * @property {(request: object, signal: AbortSignal) => Promise<PositionedHostResponse>} [header]
 * @property {(request: object, signal: AbortSignal) => Promise<PositionedHostResponse>} [locate]
 * @typedef {object} PositionedTarget
 * @property {{ kind: string, transcriptId?: string, sessionId?: string }} transport  the read identity every context must carry
 * @property {number} [turn]   a deep link's recorded index
 * @property {{ reference: string, kind?: string }} [entry]  a carried entry reference (hosts with a locator)
 * @typedef {object} PositionedReadFailure  why the read has nothing new to show, and what the reader can do
 * @property {PositionedReadFailureKindValue} kind
 * @property {string} operation          the transport method whose answer failed
 * @property {number} [retryAfterSeconds] busy only: the wait before the reader tries again
 * @typedef {object} PositionedReaderOptions
 * @property {PositionedReadTransport} transport
 * @property {PositionedTarget} target
 * @property {PositionedLandingValue} landing  the host's deep-link rule
 * @property {number} [residency]  resident segments before the oldest visited one is evicted; defaults to the reader's own
 */

/** Refuse options a reader cannot run with, naming what to pass instead. */
function validateReaderOptions(options) {
  const { transport, target, landing, residency = DEFAULT_RESIDENCY } = options ?? {}
  if (!transport || typeof transport.directory !== 'function' || typeof transport.segment !== 'function' || typeof transport.window !== 'function') {
    throw new TypeError('createPositionedReader refused the transport: it needs directory, segment and window functions that each take (request, AbortSignal) and resolve { status, body }. Pass the host transport for this transcript.')
  }
  if (!isPositionedLanding(landing)) {
    throw new TypeError(`createPositionedReader refused landing ${String(landing)}: pass PositionedLanding.Exact or PositionedLanding.Snapped, the host's deep-link rule.`)
  }
  if (!target?.transport || typeof target.transport.kind !== 'string') {
    throw new TypeError('createPositionedReader refused the target: it needs target.transport, the read identity ({ kind, transcriptId | sessionId }) every response context must carry.')
  }
  if (!Number.isInteger(residency) || residency < 1) {
    throw new TypeError(`createPositionedReader refused residency ${String(residency)}: pass a positive whole number of segments, or omit it for the reader's default.`)
  }
}

/** The stand-in a hook reads before its effect has created a reader: loading, nothing held. */
const IDLE_SNAPSHOT = Object.freeze({ status: PositionedReadStatus.Loading, header: null, context: null, directory: null, windows: { default: null, target: null }, fetchSet: null, landing: null, segments: new Map(), history: new Map(), failure: null, usageScopes: undefined })
const idle = () => Promise.resolve()
const IDLE_READER = Object.freeze({
  getSnapshot: () => IDLE_SNAPSHOT,
  subscribe: () => () => {},
  start: idle, retry: idle, loadSegment: idle, loadPosition: idle, openSection: idle, closeSection() {}, visit() {}, setPins() {}, dispose() {},
})

/**
 * Create one reader for one transcript. Nothing is requested until `start()`.
 * @param {PositionedReaderOptions} options
 */
export function createPositionedReader(options) {
  validateReaderOptions(options)
  const { transport, target, landing, residency = DEFAULT_RESIDENCY } = options

  const listeners = new Set()
  let controller = new AbortController()
  let generation = 0
  let visitClock = 0
  /** @type {any} */
  let state

  const reset = () => {
    state = {
      status: PositionedReadStatus.Loading,
      header: null,
      context: null,
      directory: null,
      directoryPages: 1,
      pageRefetched: false,
      windows: { default: null, target: null },
      fetchSet: null,
      landing: null,
      segments: new Map(),
      history: new Map(),
      pins: { focus: [], selection: [], openControl: [] },
      failure: null,
      failed: [],
      usageScopes: undefined,
    }
  }
  reset()

  let snapshot = freeze()
  function freeze() {
    return Object.freeze({
      status: state.status,
      header: state.header,
      context: state.context,
      directory: state.directory,
      windows: state.windows,
      fetchSet: state.fetchSet,
      landing: state.landing,
      segments: new Map(state.segments),
      history: new Map(state.history),
      failure: state.failure,
      usageScopes: state.usageScopes,
    })
  }
  function emit() {
    state.usageScopes = usageOf(state.directory?.usagePresent, state.segments)
    for (const section of state.history.values()) section.usageScopes = usageOf(section.usagePresent, section.segments)
    snapshot = freeze()
    for (const listener of listeners) listener()
  }

  function settleReady() {
    if (state.status === PositionedReadStatus.Ready) return
    state.status = PositionedReadStatus.Ready
    emit()
  }

  /* ── one request ──────────────────────────────────────────────────────────── */

  /** Send one request, map its status, parse its body and check its read context. */
  async function read(operation, request, parser, check, scope) {
    const signal = scope ? AbortSignal.any([controller.signal, scope]) : controller.signal
    const mine = generation
    let response
    try {
      response = await transport[operation](request, signal)
    } catch (cause) {
      if (signal.aborted || mine !== generation) throw new ReadFailure('aborted', operation)
      throw new ReadFailure(PositionedReadFailureKind.Network, operation)
    }
    if (signal.aborted || mine !== generation) throw new ReadFailure('aborted', operation)
    const status = response?.status
    if (!isOk(status)) {
      const kind = failureKindOfStatus(status)
      throw new ReadFailure(kind, operation, kind === PositionedReadFailureKind.Busy ? busySeconds(response?.retryAfterSeconds) : undefined)
    }
    const parsed = parser.safeParse(response.body)
    if (!parsed.success) throw new ReadFailure(PositionedReadFailureKind.Malformed, operation)
    if (check && !check(parsed.data)) throw new ReadFailure(PositionedReadFailureKind.Malformed, operation)
    return parsed.data
  }

  /** A response context must carry the target's transport, and, once one is established, the same
      revision and representation. A disagreement is a malformed answer: discarded, never installed. */
  function contextMatches(context) {
    if (!sameTransport(context?.transport, target.transport)) return false
    if (state.context && (context.revision !== state.context.revision || context.representation !== state.context.representation)) return false
    return true
  }
  function establish(context) {
    if (!state.context) state.context = context
  }

  /** Record a failure. A discarding kind drops every loaded row; the rest keep what is loaded. */
  function fail(error, retry) {
    if (!(error instanceof ReadFailure) || error.kind === 'aborted') return
    if (DISCARDING.has(error.kind)) {
      const kind = error.kind
      controller.abort()
      controller = new AbortController()
      generation += 1
      reset()
      state.status = PositionedReadStatus.Failed
      state.failure = { kind, operation: error.operation }
      emit()
      return
    }
    if (!state.failure) state.failure = { kind: error.kind, operation: error.operation, ...(error.retryAfterSeconds !== undefined ? { retryAfterSeconds: error.retryAfterSeconds } : {}) }
    if (retry) state.failed.push(retry)
    if (state.status === PositionedReadStatus.Loading && state.segments.size === 0) state.status = PositionedReadStatus.Failed
    emit()
  }

  /* ── the open: header, directory and windows concurrently, then exactly F ─── */

  async function start() {
    const mine = generation
    const main = partitionRequest()
    const tasks = []
    if (typeof transport.header === 'function') tasks.push(loadHeader())
    tasks.push(loadDirectory(1))
    const defaultWindow = loadWindow('default', { partition: main })
    const targetWindow = Number.isInteger(target.turn) ? loadWindow('target', { partition: main, turn: target.turn }) : Promise.resolve(null)
    tasks.push(defaultWindow, targetWindow)
    const [w_d, w_t] = await Promise.all([defaultWindow, targetWindow])
    if (mine !== generation || !w_d) return
    if (Number.isInteger(target.turn) && !w_t) return
    land(w_d, w_t)
    await requestFetchSet(w_d, w_t)
    await Promise.all(tasks)
    if (mine === generation && state.status === PositionedReadStatus.Loading && !state.failure) { state.status = PositionedReadStatus.Ready; emit() }
  }

  async function loadHeader() {
    try {
      const header = await read('header', {}, zTranscriptContentHeader, (body) => !state.context || (body.revision === state.context.revision && body.representation === state.context.representation))
      state.header = header
      emit()
      if (target.entry && typeof transport.locate === 'function') await locate(header)
    } catch (error) { fail(error, () => loadHeader()) }
  }

  async function loadDirectory(page) {
    const partition = partitionRequest()
    try {
      const directory = await read('directory', { partition, page }, zPositionedDirectory, (body) => contextMatches(body.context) && samePartition(body.partition, partition))
      establish(directory.context)
      if (page === 1) {
        state.directory = usableDirectory(directory)
        const pages = directory.directoryPerPage ? Math.ceil(directory.context.totalSegments / directory.directoryPerPage) : 1
        state.directoryPages = pages
        emit()
        for (let next = 2; next <= pages; next += 1) if (!(await loadDirectoryPage(next))) break
      }
      return directory
    } catch (error) { fail(error, () => loadDirectory(page)) }
    return null
  }

  /** A later directory page extends the refs. A page past the last (404) means the directory moved:
      the page index is discarded and page one is read again; the directory is never shown complete
      while a page is missing. */
  async function loadDirectoryPage(page) {
    const partition = partitionRequest()
    try {
      const directory = await read('directory', { partition, page }, zPositionedDirectory, (body) => contextMatches(body.context) && samePartition(body.partition, partition))
      const usable = usableDirectory(directory)
      state.directory = { ...state.directory, segments: [...state.directory.segments, ...usable.segments] }
      emit()
      return true
    } catch (error) {
      if (error instanceof ReadFailure && error.kind === PositionedReadFailureKind.Denied && !state.pageRefetched) {
        state.pageRefetched = true
        state.directory = null
        emit()
        await loadDirectory(1)
        return false
      }
      /* a later page past the last a second time is a paging failure, never a denial of the transcript */
      const pagingError = error instanceof ReadFailure && error.kind === PositionedReadFailureKind.Denied ? new ReadFailure(PositionedReadFailureKind.Failed, 'directory') : error
      fail(pagingError, () => loadDirectoryPage(page))
      return false
    }
  }

  async function loadWindow(slot, request) {
    try {
      const window = await read('window', withEcho(request), zPositionedWindow, (body) => contextMatches(body.context) && samePartition(body.partition, request.partition))
      establish(window.context)
      state.windows = { ...state.windows, [slot]: window }
      return window
    } catch (error) { fail(error, () => restart()) }
    return null
  }

  /** The landing the host's rule picks, with both positions the window reported. */
  function land(w_d, w_t) {
    const window = w_t ?? w_d
    const requested = window.requestedPosition
    const position = landing === PositionedLanding.Exact && requested !== undefined ? requested : window.anchorPosition
    state.landing = Object.freeze({
      mode: landing,
      requestedAnchor: window.requestedAnchor,
      anchorTurn: window.anchorTurn,
      requestedPosition: requested,
      anchorPosition: window.anchorPosition,
      anchorSegment: window.anchorSegment,
      position,
      snapped: w_t != null && position !== requested,
    })
  }

  /** Exactly F, each ordinal once, the target's run first and its anchor segment before the rest. */
  async function requestFetchSet(w_d, w_t) {
    const order = []
    const add = (ordinal) => { if (!order.includes(ordinal)) order.push(ordinal) }
    if (w_t) { add(w_t.anchorSegment); for (const ordinal of w_t.segments) add(ordinal) }
    else add(w_d.anchorSegment)
    for (const ordinal of w_d.segments) add(ordinal)
    state.fetchSet = Object.freeze([...order])
    emit()
    await Promise.all(order.map((ordinal) => loadSegment(ordinal)))
  }

  /* ── segments: install, visit, evict ──────────────────────────────────────── */

  const inFlight = new Map()
  /** Read one segment of the main partition (or of an open history section) unless it is resident. */
  function loadSegment(ordinal, section) {
    const segments = section === undefined ? state.segments : state.history.get(section)?.segments
    if (!segments) return Promise.resolve()
    if (segments.has(ordinal)) { touch(segments.get(ordinal)); emit(); return Promise.resolve() }
    const key = `${section ?? 'main'}:${ordinal}`
    if (inFlight.has(key)) return inFlight.get(key)
    const partition = partitionRequest(section)
    const signal = section === undefined ? undefined : state.history.get(section)?.abort.signal
    const run = (async () => {
      try {
        const body = await readScoped('segment', withEcho({ partition, index: ordinal }), zPositionedSegment, (payload) => contextMatches(payload.context) && samePartition(payload.partition, partition) && payload.index === ordinal, signal)
        installSegment(ordinal, body, section)
      } catch (error) {
        if (section === undefined) fail(error, () => loadSegment(ordinal))
        else failSection(section, error)
      } finally {
        inFlight.delete(key)
      }
    })()
    inFlight.set(key, run)
    return run
  }

  /** A section read also stops when its section closes: the transport sees the abort, and an answer
      that still arrives is dropped. */
  function readScoped(operation, request, parser, check, sectionSignal) {
    return read(operation, request, parser, check, sectionSignal)
  }

  function installSegment(ordinal, body, section) {
    const cooked = adaptTranscript(body, undefined, undefined, { payloadMode: 'segment', context: body.context, session: state.header?.sessionHeader })
    const record = {
      index: ordinal,
      partition: positionedPartitionId(body.partition),
      byteLength: body.byteLength,
      hasOlder: body.hasOlder,
      hasNewer: body.hasNewer,
      turns: cooked.turns,
      wireTurns: body.rows.map((row) => row.turn),
      nativeMetadata: body.nativeMetadata,
      visited: 0,
    }
    touch(record)
    if (section === undefined) {
      state.segments.set(ordinal, record)
    } else {
      const open = state.history.get(section)
      if (!open) return
      open.segments.set(ordinal, record)
    }
    evict()
    emit()
  }

  function touch(record) {
    visitClock += 1
    record.visited = visitClock
  }

  /** The ordinals nothing may evict: the landing segment, its neighbours, and what the reader is
      focused on, has selected or has a control open in. An open history section is pinned whole. */
  function pinnedMain() {
    const pinned = new Set()
    const landed = landingSegment()
    if (landed !== undefined) pinned.add(landed)
    if (landed !== undefined) for (const neighbour of [landed - 1, landed + 1]) pinned.add(neighbour)
    for (const ordinal of state.pins.focus) pinned.add(ordinal)
    for (const ordinal of state.pins.selection) pinned.add(ordinal)
    for (const ordinal of state.pins.openControl) pinned.add(ordinal)
    return pinned
  }
  /** An open history section is pinned whole while it stays open. */
  const sectionPinned = (section) => section.open === true

  /** The segment that holds the landing row, from the directory's position ranges. */
  function landingSegment() {
    const position = state.landing?.position
    if (!Number.isInteger(position)) return undefined
    const ref = state.directory?.segments.find((item) => item.sourceFirstPosition <= position && position <= item.sourceLastPosition)
    return ref?.index ?? state.landing?.anchorSegment
  }

  /** Evict the oldest-visited unpinned segments until the resident count is within the budget. Open
      history sections count toward it and are never evicted while open. */
  function evict() {
    const pinned = pinnedMain()
    let resident = state.segments.size
    for (const section of state.history.values()) resident += section.segments.size
    if (resident <= residency) return
    const candidates = []
    for (const record of state.segments.values()) if (!pinned.has(record.index)) candidates.push({ record, from: state.segments })
    for (const section of state.history.values()) {
      if (sectionPinned(section)) continue
      for (const record of section.segments.values()) candidates.push({ record, from: section.segments })
    }
    candidates.sort((a, b) => a.record.visited - b.record.visited)
    for (const { record, from } of candidates) {
      if (resident <= residency) break
      from.delete(record.index)
      resident -= 1
    }
  }

  /* ── history sections: opened on demand, aborted and released on close ────── */

  async function openSection(section) {
    const existing = state.history.get(section)
    if (existing?.open && existing.status !== PositionedReadStatus.Failed) return
    existing?.abort.abort()
    const meta = state.directory?.history?.find((item) => item.index === section)
    const record = { open: true, status: PositionedReadStatus.Loading, directory: null, segments: new Map(), abort: new AbortController(), failure: null, usagePresent: meta?.usagePresent, usageScopes: undefined }
    state.history.set(section, record)
    emit()
    const partition = partitionRequest(section)
    try {
      const [directory, window] = await Promise.all([
        readScoped('directory', { partition, page: 1 }, zPositionedDirectory, (body) => contextMatches(body.context) && samePartition(body.partition, partition), record.abort.signal),
        readScoped('window', withEcho({ partition }), zPositionedWindow, (body) => contextMatches(body.context) && samePartition(body.partition, partition), record.abort.signal),
      ])
      if (state.history.get(section) !== record) return
      record.directory = usableDirectory(directory)
      record.usagePresent = directory.usagePresent
      emit()
      await Promise.all(window.segments.map((ordinal) => loadSegment(ordinal, section)))
      if (state.history.get(section) === record && record.status === PositionedReadStatus.Loading) { record.status = PositionedReadStatus.Ready; emit() }
    } catch (error) { failSection(section, error) }
  }

  function failSection(section, error) {
    const record = state.history.get(section)
    if (!record || !(error instanceof ReadFailure) || error.kind === 'aborted') return
    if (DISCARDING.has(error.kind) && error.kind !== PositionedReadFailureKind.Denied) { fail(error); return }
    record.status = PositionedReadStatus.Failed
    record.failure = { kind: error.kind, operation: error.operation }
    if (error.kind === PositionedReadFailureKind.Denied) record.segments.clear()
    emit()
  }

  function closeSection(section) {
    const record = state.history.get(section)
    if (!record) return
    record.abort.abort()
    state.history.delete(section)
    emit()
  }

  /* ── a carried entry reference: the locator's position becomes the landing ── */

  async function locate(header) {
    try {
      const match = await read('locate', { reference: target.entry.reference, revision: header.revision, representation: header.representation, contentHash: header.contentHash ?? '' }, zTranscriptEntryMatch, (body) => contextMatches(body.context))
      state.landing = Object.freeze({ ...(state.landing ?? {}), mode: PositionedLanding.Exact, position: match.position, anchorSegment: match.segmentOrdinal, snapped: false })
      emit()
      await loadSegment(match.segmentOrdinal)
    } catch (error) {
      /* no match keeps the general link: the reader stays at the default landing */
      if (error instanceof ReadFailure && error.kind !== PositionedReadFailureKind.Denied) fail(error, () => locate(header))
    }
  }

  /* ── helpers ──────────────────────────────────────────────────────────────── */

  /** Every segment and window read after the context is known echoes its revision and representation. */
  function withEcho(request) {
    return state.context ? { ...request, revision: state.context.revision, representation: state.context.representation } : request
  }

  function restart() {
    controller.abort()
    controller = new AbortController()
    generation += 1
    inFlight.clear()
    for (const section of state.history.values()) section.abort.abort()
    const pins = state.pins
    reset()
    state.pins = pins
    emit()
    return start()
  }

  return {
    start,
    /** @returns {ReturnType<typeof freeze>} */
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    /** Read a main-partition segment (a boundary's load-more, a scrubber seek). */
    loadSegment: (ordinal) => loadSegment(ordinal),
    /** Read the main segment holding a served position. */
    loadPosition(position) {
      const ref = state.directory?.segments.find((item) => item.sourceFirstPosition <= position && position <= item.sourceLastPosition)
      return ref ? loadSegment(ref.index) : Promise.resolve()
    },
    /** Mark a resident segment as just read, so it is the last to be evicted. */
    visit(ordinal) {
      const record = state.segments.get(ordinal)
      if (record) { touch(record); emit() }
    },
    /** What the reader is holding on to: focused, selected, or with a control open. Each named class
        replaces its own ordinals; a class not named keeps its pins. */
    setPins(next = {}) {
      const pins = { ...state.pins }
      if (next.focus) pins.focus = [...next.focus]
      if (next.selection) pins.selection = [...next.selection]
      if (next.openControl) pins.openControl = [...next.openControl]
      state.pins = pins
    },
    openSection,
    closeSection,
    /** Retry: a stale, denied or unavailable read reloads from the start; any other failure re-runs
        the reads that failed and keeps everything loaded. */
    retry() {
      const failure = state.failure
      if (!failure) return Promise.resolve()
      if (DISCARDING.has(failure.kind) || state.segments.size === 0) return restart()
      const again = state.failed.splice(0)
      const mine = generation
      state.failure = null
      emit()
      return Promise.all(again.map((run) => run())).then(() => {
        /* the reads that failed have now answered: with nothing failing again, the read is settled */
        if (mine === generation && !state.failure) settleReady()
      })
    },
    dispose() {
      controller.abort()
      generation += 1
      for (const section of state.history.values()) section.abort.abort()
      listeners.clear()
    },
  }
}

/** A directory whose conversation positions break the shared rule keeps its refs and loses only
    those positions: they are optional, and an unusable one is dropped, not trusted. */
function usableDirectory(directory) {
  if (isPositionedDirectoryPositionsValid(directory)) return directory
  return {
    ...directory,
    context: { ...directory.context, totalConversationTurns: undefined },
    segments: directory.segments.map(({ conversationTurns: _dropped, ...ref }) => ref),
  }
}

/** Usage over the rows in hand, one sequential pass, only when the directory says usage is present. */
function usageOf(presence, segments) {
  if (presence !== TranscriptUsagePresence.Present) return undefined
  const accumulator = createUsageAccumulator()
  for (const record of [...segments.values()].sort((a, b) => a.index - b.index)) {
    for (const turn of record.wireTurns) accumulator.addTurn(turn)
  }
  return accumulator.finish()
}

/* ── the view the viewer reads ───────────────────────────────────────────────── */

/** The viewer's segment directory from a positioned directory. */
function directoryVM(directory) {
  if (!directory) return null
  const context = directory.context
  return {
    sessionId: context.contentSessionId ?? undefined,
    revision: context.revision,
    complete: true,
    totalTurns: context.totalTurns,
    totalSegments: context.totalSegments,
    ...(typeof context.totalConversationTurns === 'number' ? { totalConversationTurns: context.totalConversationTurns } : {}),
    segments: directory.segments.map((ref) => ({
      index: ref.index,
      byteLength: ref.byteLength,
      sourceFirstPosition: ref.sourceFirstPosition,
      sourceLastPosition: ref.sourceLastPosition,
      ...(ref.conversationTurns ? { conversationTurns: ref.conversationTurns } : {}),
    })),
  }
}

/** The viewer's loaded segments from the resident records. */
function segmentsVM(segments, directory) {
  const refs = new Map((directory?.segments ?? []).map((ref) => [ref.index, ref]))
  return [...segments.values()].sort((a, b) => a.index - b.index).map((record) => {
    const ref = refs.get(record.index)
    return {
      index: record.index,
      byteLength: record.byteLength,
      hasOlder: record.hasOlder,
      hasNewer: record.hasNewer,
      ...(ref ? { sourceFirstPosition: ref.sourceFirstPosition, sourceLastPosition: ref.sourceLastPosition } : {}),
      turns: record.turns,
    }
  })
}

/** History sections for the viewer: the closed count is the recorded one, qualified; the exact count
    appears once the section opens. Numbering, usage and native records stay in the section. */
function historyVM(directory, history, reopen) {
  return (directory?.history ?? []).map((meta) => {
    const open = history.get(meta.index)
    const turns = open ? [...open.segments.values()].sort((a, b) => a.index - b.index).flatMap((record) => record.turns) : []
    const exact = open?.directory ? open.directory.context.totalConversationTurns ?? open.directory.context.totalTurns : undefined
    const recorded = typeof meta.totalConversationTurns === 'number' ? meta.totalConversationTurns : undefined
    return {
      id: `earlier-${meta.index}`,
      section: meta.index,
      state: parseEarlierHistoryState(meta.state),
      turns,
      usageScopes: open?.usageScopes ?? [],
      nativeMetadata: open ? [...open.segments.values()].flatMap((record) => record.nativeMetadata ?? []) : undefined,
      countText: exact !== undefined ? POSITIONED_READ_COPY.historyExact(exact) : recorded !== undefined ? POSITIONED_READ_COPY.historyRecorded(recorded) : '',
      status: open ? open.status : PositionedReadStatus.Closed,
      failure: open?.failure ?? null,
      ...(open?.failure ? { retry: () => reopen(meta.index) } : {}),
    }
  })
}

/** The outline's prompts from the rows in hand: each top-level user row with words opens a task
    holding the rows after it, up to the next such row. Its number is the row's served one. */
function loadedTasks(turns) {
  const tasks = []
  let current = null
  for (const turn of turns) {
    const opens = turn.role === Role.User && (turn.depth ?? 0) === 0 && String(turn.displayContent ?? turn.content ?? '').trim() !== ''
    if (opens) {
      current = { id: `task-${turn.partition}-${turn.index}`, index: tasks.length + 1, prompt: turn.content ?? '', turnIndices: [] }
      if (turn.displayContent !== undefined) current.displayPrompt = turn.displayContent
      tasks.push(current)
    }
    if (current) current.turnIndices.push(turn.index)
  }
  return tasks
}

/**
 * @typedef {object} PositionedReadControls
 * @property {() => Promise<unknown>} retry  a stale, denied or unavailable read reloads; any other failure re-runs its reads
 * @property {(section: number) => void} openSection
 * @property {(section: number) => void} closeSection
 * @property {import('@peasant-labs/schema').TranscriptContentHeader | null} header
 * @property {{ mode: PositionedLandingValue, position?: number, requestedAnchor?: number, anchorTurn?: number, requestedPosition?: number, anchorPosition?: number, anchorSegment?: number, snapped: boolean } | null} landing
 * @typedef {object} PositionedTranscript
 * @property {Partial<import('./state-capabilities.js').TranscriptViewerBaseProps> & Pick<import('./state-capabilities.js').TranscriptViewerBaseProps, 'viewModel'>} viewerProps  every prop the viewer needs for this read; spread it onto TranscriptViewer
 * @property {PositionedReadControls} controls
 */

/**
 * The React binding: one reader per transcript and mount. A host spreads `viewerProps` onto
 * `TranscriptViewer` and keeps `controls` for its own chrome (the landing line, a retry).
 *
 * The reader is keyed by the target's identity and by the transport object, so the host must
 * memoise its transport (useMemo, or a module-level object): a transport created inline on every
 * render starts a new reader, and a new set of reads, on every render.
 * @param {PositionedReaderOptions & { session?: object }} options
 * @returns {PositionedTranscript}
 */
export function usePositionedTranscript(options) {
  const { transport, target, landing, residency, session } = options
  const targetKey = JSON.stringify([target?.transport, target?.turn ?? null, target?.entry?.reference ?? null, landing, residency ?? null])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the options are keyed by the target's identity, not by the option objects' identities
  const readerOptions = useMemo(() => ({ transport, target, landing, ...(residency !== undefined ? { residency } : {}) }), [targetKey, transport])
  /* Each mount of the effect creates, starts and disposes its own reader, so a remount (React
     StrictMode runs every effect twice in development) never restarts a disposed one. The
     options are checked here, during render, so a wrong option throws where the host renders. */
  useMemo(() => validateReaderOptions(readerOptions), [readerOptions])
  const [reader, setReader] = useState(null)
  useEffect(() => {
    const instance = createPositionedReader(readerOptions)
    setReader(instance)
    instance.start()
    return () => instance.dispose()
  }, [readerOptions])
  const live = reader ?? IDLE_READER
  const snapshot = useSyncExternalStore(live.subscribe, live.getSnapshot, live.getSnapshot)
  const [historyOpen, setHistoryOpen] = useState({})
  const historyOpenRef = useRef(historyOpen)
  historyOpenRef.current = historyOpen

  /* busy waits the server's Retry-After, then tries again on its own */
  const failure = snapshot.failure
  useEffect(() => {
    if (failure?.kind !== PositionedReadFailureKind.Busy) return undefined
    const handle = setTimeout(() => { live.retry() }, (failure.retryAfterSeconds ?? DEFAULT_BUSY_SECONDS) * 1000)
    return () => clearTimeout(handle)
  }, [failure, live])

  const onEarlierHistoryOpenChange = useCallback((next) => {
    setHistoryOpen((previous) => {
      const value = typeof next === 'function' ? next(previous) : next
      for (const [id, open] of Object.entries(value)) {
        const section = Number(id.replace('earlier-', ''))
        if (!Number.isInteger(section)) continue
        if (open && !previous[id]) live.openSection(section)
        if (!open && previous[id]) live.closeSection(section)
      }
      return value
    })
  }, [live])

  /* a section opened before this reader existed (or by the reader it replaced) opens on it too */
  useEffect(() => {
    if (!reader) return
    for (const [id, open] of Object.entries(historyOpenRef.current)) {
      const section = Number(id.replace('earlier-', ''))
      if (open && Number.isInteger(section)) reader.openSection(section)
    }
  }, [reader])

  /* the row the reader is on is a visit, and its segment is pinned while focused */
  const onActiveTurnChange = useCallback((position) => {
    const record = [...live.getSnapshot().segments.values()].find((item) => item.turns.some((turn) => turn.index === position))
    if (!record) return
    live.setPins({ focus: [record.index] })
    live.visit(record.index)
  }, [live])

  const header = snapshot.header
  const directory = useMemo(() => directoryVM(snapshot.directory), [snapshot.directory])
  const segments = useMemo(() => segmentsVM(snapshot.segments, snapshot.directory), [snapshot.segments, snapshot.directory])
  const earlierHistory = useMemo(() => historyVM(snapshot.directory, snapshot.history, live.openSection), [snapshot.directory, snapshot.history, live])
  const loadedTurns = useMemo(() => segments.flatMap((segment) => segment.turns), [segments])
  const integrity = useMemo(() => positionedIntegrity(header, loadedTurns), [header, loadedTurns])
  const viewModel = useMemo(() => ({
    session: {
      ...(header?.sessionHeader ?? {}),
      ...(session ?? {}),
      id: session?.id ?? snapshot.context?.contentSessionId ?? header?.sessionHeader?.id ?? '',
      /* a read that has nothing to show still names the page, so the heading is never empty */
      ...(session?.title === undefined && loadedTurns.length === 0 ? { title: POSITIONED_READ_COPY.untitled } : {}),
      harness: session?.harness ?? snapshot.context?.harness ?? header?.sessionHeader?.harness,
      model: session?.model ?? snapshot.context?.model ?? header?.sessionHeader?.model,
    },
    turns: [],
    toolCallsById: new Map(),
    diffs: [],
    files: [],
    tasks: loadedTasks(loadedTurns),
    highlights: [],
    filterIndex: { toolGroupCounts: {}, annotationsByTurn: {}, tags: [], tagCounts: {}, totalTurns: 0 },
    analytics: {},
    relationships: [],
    earlierHistory,
    ...(snapshot.usageScopes ? { usageScopes: snapshot.usageScopes } : {}),
  }), [header, session, snapshot.context, earlierHistory, snapshot.usageScopes, loadedTurns])

  const positionedRead = useMemo(() => ({ status: snapshot.status, failure, retry: live.retry }), [snapshot.status, failure, live])
  const viewerProps = useMemo(() => ({
    viewModel,
    directory: directory ?? { complete: true, totalSegments: 0, segments: [] },
    segments,
    onLoadSegment: live.loadSegment,
    onLoadWindow: live.loadPosition,
    earlierHistoryOpen: historyOpen,
    onEarlierHistoryOpenChange,
    onActiveTurnChange,
    /* the viewer marks a turn only when both hashes are present and equal; a positioned read's
       marks are already decided against the header's hash, so the one hash fills both */
    integrity: integrity.integrity,
    transcriptContentHash: integrity.contentHash,
    contentHash: integrity.contentHash,
    positionedRead,
    initialPosition: snapshot.landing && Number.isInteger(snapshot.landing.position) ? { kind: 'turn', turnIndex: snapshot.landing.position } : undefined,
  }), [viewModel, directory, segments, live, historyOpen, onEarlierHistoryOpenChange, onActiveTurnChange, integrity, positionedRead, snapshot.landing])
  const controls = useMemo(() => ({
    retry: live.retry,
    openSection: (section) => onEarlierHistoryOpenChange((previous) => ({ ...previous, [`earlier-${section}`]: true })),
    closeSection: (section) => onEarlierHistoryOpenChange((previous) => ({ ...previous, [`earlier-${section}`]: false })),
    header,
    landing: snapshot.landing,
  }), [live, onEarlierHistoryOpenChange, header, snapshot.landing])
  return { viewerProps, controls }
}

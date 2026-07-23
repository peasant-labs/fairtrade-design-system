// @ts-check

/** @typedef {import('./state-capabilities.js').TranscriptInitialPosition} TranscriptInitialPosition */
/** @typedef {'pending' | 'applied' | 'discarded'} TranscriptInitialPositionResult */

const RESULT_VALUES = new Set(['pending', 'applied', 'discarded'])
const INVALID_INITIAL_POSITION_ERROR = Symbol('fairtrade.invalid-initial-position')
const invalidInitialPositionErrors = new WeakSet()

/**
 * Render an untrusted value without invoking user-defined serialization,
 * getters, function properties, or object traversal. Diagnostics must never
 * replace the actionable boundary error with a formatter exception.
 *
 * @param {unknown} value
 * @returns {string}
 */
function safeDiagnosticValue(value) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value)
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'symbol') {
    try { return Symbol.prototype.toString.call(value) } catch { return '[symbol]' }
  }
  if (typeof value === 'function') return '[function]'
  try { return Array.isArray(value) ? '[array]' : '[object]' } catch { return '[object]' }
}

/**
 * @param {string} what
 * @param {string} why
 * @param {string} fix
 * @returns {TypeError}
 */
function invalidInitialPosition(what, why, fix) {
  const error = new TypeError([
    `What went wrong: ${what}.`,
    `Why it happened: ${why}.`,
    'Where it failed: @peasant-labs/fairtrade transcript initial-position boundary.',
    'When it failed: while normalizing a one-time transcript position before layout consumption.',
    'What it means for the caller: the position was rejected and no scrolling or selection side effect was performed.',
    `How to fix it: ${fix}.`,
  ].join(' '))
  Object.defineProperty(error, INVALID_INITIAL_POSITION_ERROR, { value: true })
  invalidInitialPositionErrors.add(error)
  return error
}

/**
 * Keep reflection over an untrusted container narrow and translate every trap
 * into the public actionable error without exposing native exception text.
 * Errors created by this module are branded and pass through unchanged.
 *
 * @template T
 * @param {string} operation
 * @param {() => T} inspect
 * @returns {T}
 */
function guardedInitialPositionReflection(operation, inspect) {
  try {
    return inspect()
  } catch (error) {
    if (typeof error === 'object' && error !== null && invalidInitialPositionErrors.has(error)) throw error
    throw invalidInitialPosition(
      `the position could not be safely inspected during ${operation}`,
      'the untrusted container interrupted reflection',
      'pass a plain object whose documented fields are own data properties',
    )
  }
}

/**
 * Build one coherent snapshot from the reported own keys. Each key's
 * descriptor is inspected exactly once; accessors and keys without a matching
 * descriptor are rejected without invoking user code.
 *
 * @param {Record<PropertyKey, unknown>} record
 * @param {readonly string[]} ownKeys
 * @returns {Map<string, unknown>}
 */
function initialPositionDataMap(record, ownKeys) {
  const inspect = () => {
    const fields = new Map()
    for (const key of ownKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(record, key)
      if (descriptor === undefined) {
        throw invalidInitialPosition(
          `${key} was reported without an own descriptor`,
          'the own-key and descriptor views of the untrusted container disagree',
          `report ${key} only when it has an exact own data descriptor`,
        )
      }
      if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw invalidInitialPosition(
          `${key} is an accessor rather than an own data property`,
          'reading an accessor could execute untrusted code during validation',
          `define ${key} as an own data property`,
        )
      }
      fields.set(key, descriptor.value)
    }
    return fields
  }
  return guardedInitialPositionReflection('descriptor map construction', inspect)
}

/**
 * @param {Map<string, unknown>} dataFields
 * @returns {unknown}
 */
function initialPositionKind(dataFields) {
  if (!dataFields.has('kind')) {
    throw invalidInitialPosition('kind is missing from the reported own keys', 'the position union cannot be selected without an own kind data field', "report an own kind data field containing 'top' or 'turn'")
  }
  return dataFields.get('kind')
}

/**
 * Fail-closed normalization for the public one-time positioning contract.
 * Only exact own-key shapes are accepted.
 *
 * @param {unknown} value
 * @returns {TranscriptInitialPosition | null}
 */
export function normalizeTranscriptInitialPosition(value) {
  if (value == null) return null
  if (typeof value !== 'object' || guardedInitialPositionReflection('array classification', () => Array.isArray(value))) {
    throw invalidInitialPosition('the position is not an object', 'only the top and turn object shapes are supported', "pass { kind: 'top' } or { kind: 'turn', turnIndex: 0 }")
  }
  const prototype = guardedInitialPositionReflection('prototype inspection', () => Object.getPrototypeOf(value))
  if (prototype !== Object.prototype && prototype !== null) {
    throw invalidInitialPosition('the position has a non-plain prototype', 'class instances and inherited state can hide unvalidated fields', 'pass a plain object containing only the documented own keys')
  }

  const record = /** @type {Record<PropertyKey, unknown>} */ (value)
  const ownKeys = guardedInitialPositionReflection('own-key inspection', () => Reflect.ownKeys(record))
  if (ownKeys.some((key) => typeof key !== 'string')) {
    throw invalidInitialPosition('the position contains a symbol key', 'symbol keys are outside the serialized public contract', 'remove symbol keys and use only documented string keys')
  }
  const dataFields = initialPositionDataMap(record, /** @type {string[]} */ (ownKeys))
  const kind = initialPositionKind(dataFields)
  if (kind !== 'top' && kind !== 'turn') {
    throw invalidInitialPosition(`the kind ${safeDiagnosticValue(kind)} is unknown`, 'the position union is closed', "use kind 'top' or kind 'turn'")
  }
  const allowed = kind === 'top' ? new Set(['kind', 'requestKey']) : new Set(['kind', 'turnIndex', 'requestKey'])
  const extras = [...dataFields.keys()].filter((key) => !allowed.has(key))
  const missing = kind === 'turn' && !dataFields.has('turnIndex') ? ['turnIndex'] : []
  if (extras.length || missing.length) {
    throw invalidInitialPosition(`the ${kind} position has an inexact key set (extra: ${extras.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'})`, 'unknown or missing fields would make host intent ambiguous', `use exactly ${[...allowed].join(', ')} with requestKey omitted when unnecessary`)
  }

  const requestKey = dataFields.get('requestKey')
  if (requestKey !== undefined && (typeof requestKey !== 'string' || requestKey.trim().length === 0 || requestKey.includes('\u0000'))) {
    throw invalidInitialPosition('requestKey is malformed', 'requestKey must be a nonempty string without the token delimiter', 'supply a stable nonblank request identity or omit requestKey')
  }
  if (kind === 'top') return requestKey === undefined ? { kind: 'top' } : { kind: 'top', requestKey: /** @type {string} */ (requestKey) }

  const turnIndex = dataFields.get('turnIndex')
  if (!Number.isSafeInteger(turnIndex) || /** @type {number} */ (turnIndex) < 0) {
    throw invalidInitialPosition(`turnIndex ${safeDiagnosticValue(turnIndex)} is not a safe nonnegative integer`, 'turn identities are sparse integer identities rather than array offsets or arbitrary numbers', 'supply the exact safe nonnegative turn identity from the transcript wire')
  }
  return requestKey === undefined
    ? { kind: 'turn', turnIndex: /** @type {number} */ (turnIndex) }
    : { kind: 'turn', turnIndex: /** @type {number} */ (turnIndex), requestKey: /** @type {string} */ (requestKey) }
}

/**
 * Pure precedence transition used by the React hook. Keeping this outside the
 * hook makes explicit/fallback/legacy ownership executable without copying the
 * controller into consumer tests.
 *
 * @param {{
 *   initialPosition: unknown,
 *   fallbackInitialPosition: unknown,
 *   legacyInitialPosition: unknown,
 *   explicitUsed: boolean,
 *   fallbackUsed: boolean,
 * }} input
 * @returns {{explicitUsed: boolean, fallbackUsed: boolean, position: TranscriptInitialPosition | null}}
 */
export function resolveTranscriptInitialPosition(input) {
  const explicitUsed = input.explicitUsed || input.initialPosition !== undefined
  const fallbackUsed = input.fallbackUsed || (!explicitUsed && input.fallbackInitialPosition !== undefined)
  const position = input.initialPosition !== undefined
    ? normalizeTranscriptInitialPosition(input.initialPosition)
    : explicitUsed
      ? null
      : input.fallbackInitialPosition !== undefined
        ? normalizeTranscriptInitialPosition(input.fallbackInitialPosition)
        : fallbackUsed
          ? null
          : normalizeTranscriptInitialPosition(input.legacyInitialPosition)
  return { explicitUsed, fallbackUsed, position }
}

/**
 * Pure authoritative/readiness decision shared by both transcript viewers.
 * Side effects remain in each renderer, but only this function decides when a
 * request is pending, terminally absent, or ready to apply.
 *
 * @param {TranscriptInitialPosition} position
 * @param {{
 *   authoritativeTurnIndices: readonly number[],
 *   renderedTurnIndices: readonly number[],
 *   viewReady: boolean,
 *   scrollerReady: boolean,
 *   targetReady: boolean,
 * }} state
 * @returns {TranscriptInitialPositionResult}
 */
export function transcriptInitialPositionReadiness(position, state) {
  if (position.kind === 'turn' && !state.authoritativeTurnIndices.includes(position.turnIndex)) return 'discarded'
  if (position.kind === 'turn' && !state.renderedTurnIndices.includes(position.turnIndex)) return 'pending'
  if (!state.viewReady || !state.scrollerReady) return 'pending'
  if (position.kind === 'turn' && !state.targetReady) return 'pending'
  return 'applied'
}

/**
 * @param {string | undefined} sessionId
 * @param {TranscriptInitialPosition | null} position
 * @returns {string | null}
 */
export function transcriptInitialPositionToken(sessionId, position) {
  if (position == null) return null
  return JSON.stringify([
    sessionId ?? '',
    position.kind,
    position.kind === 'turn' ? position.turnIndex : null,
    position.requestKey ?? '',
  ])
}

/**
 * @param {unknown} result
 * @returns {asserts result is TranscriptInitialPositionResult}
 */
export function assertTranscriptInitialPositionResult(result) {
  if (!RESULT_VALUES.has(/** @type {string} */ (result))) {
    throw invalidInitialPosition(`the layout consumer returned ${safeDiagnosticValue(result)}`, 'apply must report pending, applied, or discarded', 'return pending while readiness is incomplete, applied after positioning, or discarded after authoritative absence')
  }
}

/**
 * @param {string | null} consumedToken
 * @param {string | null} nextToken
 */
export function shouldApplyTranscriptInitialPosition(consumedToken, nextToken) {
  return nextToken != null && consumedToken !== nextToken
}

/**
 * @param {string | null} consumedToken
 * @param {string | null} nextToken
 * @param {TranscriptInitialPositionResult} result
 * @returns {string | null}
 */
export function advanceTranscriptInitialPositionConsumption(consumedToken, nextToken, result) {
  assertTranscriptInitialPositionResult(result)
  if (nextToken == null) return null
  return result === 'applied' || result === 'discarded' ? nextToken : consumedToken
}

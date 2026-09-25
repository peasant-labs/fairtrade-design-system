// Fairtrade-owned adapter factory with one injected lifecycle driver.
//
// The adapter wraps a single caller-supplied driver, never a hardcoded host:
// start brings the managed service up, readiness marks it ready, and teardown
// releases it exactly once. A partial start failure runs reset before stop so
// no service is left running, and teardown stays safe on success, failure,
// and timeout paths through try/finally ordering. Opaque handles carry exact
// run membership, capabilities satisfy the shared product requirements, and
// the lifecycle trace follows the declared, acquired, ready, released order.
// Host-contract values load only through the sole source route; this module
// holds no second relative path into the private child.
//
// Injected driver contract (declared where a driver author reads it, in
// assertDriver): async start, async stop, async reset, a sync isRunning
// probe, and a stop and a reset that are both safe to call when the driver
// is not running. A start that failed before the service came up leaves the
// driver not running, and the failure path cleans that partial start with
// reset before stop anyway; a driver rejecting either there would replace the
// start diagnostic with a cleanup failure, so the failure path reports the
// cleanup failure beside the start diagnostic instead of letting it win.
// Teardown never repeats the failure path's stop, so the start diagnostic is
// what a maintainer still reads.

import { importFairtestSource } from '../fairtest-source.mjs'
import {
  PRODUCT_ACTION_NAME,
  PRODUCT_TARGET_ID,
  productDeclarationInput,
  selectProductTarget,
} from './fairtrade-targets.mjs'

const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

let contractCache = null

/**
 * Load the shared host-contract modules through the sole source route.
 * @returns {Promise<object>} targets, lifecycle, handles, kinds, resolution
 */
async function loadContract() {
  if (!contractCache) {
    const [targets, lifecycle, handles, kinds, resolution] = await Promise.all([
      importFairtestSource('src/host-contract/targets.mjs'),
      importFairtestSource('src/host-contract/lifecycle.mjs'),
      importFairtestSource('src/host-contract/handles.mjs'),
      importFairtestSource('src/host-contract/kinds.mjs'),
      importFairtestSource('src/host-contract/resolution.mjs'),
    ])
    contractCache = { targets, lifecycle, handles, kinds, resolution }
  }
  return contractCache
}

/**
 * Assert the run id is a usable lowercase handle namespace.
 * @param {unknown} runId candidate run id
 */
function assertRunId(runId) {
  if (typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId)) {
    throw new Error(
      `fairtrade adapter: invalid value ${JSON.stringify(runId)} for field "runId" at path adapter.runId; ` +
      'repair: use a lowercase run id up to 64 characters for "runId".',
    )
  }
}

/**
 * Assert the injected driver offers the required lifecycle surface: an async
 * start, an async stop, an async reset, and a sync isRunning probe. The stop
 * and the reset must both be safe to call when the driver is not running,
 * because a start that failed before the service came up leaves the driver not
 * running and the failure path still cleans that partial start; a stop or reset
 * that rejects there would replace the start diagnostic with a cleanup failure.
 * @param {unknown} driver candidate lifecycle driver
 */
function assertDriver(driver) {
  if (!driver || typeof driver !== 'object') {
    throw new Error(
      'fairtrade adapter: missing driver for field "driver" at path adapter.driver; ' +
      'repair: inject a driver with async start, stop, reset and a sync isRunning probe for "driver"; ' +
      'stop and reset must be safe to call when the driver is not running.',
    )
  }
  for (const method of ['start', 'stop', 'reset', 'isRunning']) {
    if (typeof driver[method] !== 'function') {
      throw new Error(
        `fairtrade adapter: driver is missing "${method}" for field "driver" at path adapter.driver.${method}; ` +
        `repair: provide async start, stop, reset and a sync isRunning probe on "driver"; ` +
        'stop and reset must be safe to call when the driver is not running.',
      )
    }
  }
}

/**
 * Race a driver promise against a timeout. The late driver settlement stays
 * observed by the race, so no rejection escapes unhandled.
 * @param {Promise<unknown>} promise driver promise
 * @param {number} timeoutMs timeout in milliseconds
 * @param {string} message timeout diagnostic
 * @returns {Promise<unknown>} the driver result before the deadline
 */
function runWithTimeout(promise, timeoutMs, message) {
  let timer = null
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message)
      error.isAdapterTimeout = true
      reject(error)
    }, timeoutMs)
    if (timer && typeof timer.unref === 'function') {
      timer.unref()
    }
  })
  return Promise.race([promise, guard]).finally(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })
}

/**
 * Create a Fairtrade product adapter around one injected lifecycle driver.
 * @param {object} [options] adapter options
 * @param {string} options.runId owning run id used for handle membership
 * @param {object} options.driver injected lifecycle driver
 * @param {string} [options.targetId] registered product target id
 * @param {number} [options.createdAtMs] identity creation time in whole ms
 * @param {string[]} [options.capabilities] declared capability inventory
 * @param {string[]} [options.fixtures] named fixtures served
 * @param {string[]} [options.actions] named actions offered
 * @returns {Promise<object>} the frozen adapter
 */
export async function createFairtradeAdapter(options = {}) {
  const contract = await loadContract()
  const settings = options ?? {}
  const {
    runId,
    driver,
    targetId = PRODUCT_TARGET_ID,
    createdAtMs = Date.now(),
    capabilities,
    fixtures,
    actions,
  } = settings
  assertRunId(runId)
  assertDriver(driver)

  const target = selectProductTarget(targetId)
  const declaredCapabilities = capabilities ?? [...contract.targets.PRODUCT_CAPABILITIES]
  const validatedCapabilities = contract.targets.validateCapabilityList(
    [...declaredCapabilities],
    'product',
    'fairtrade adapter',
    'adapter.capabilities',
  )
  const declaration = contract.targets.createTargetDeclaration(
    productDeclarationInput({
      createdAtMs,
      capabilities: [...validatedCapabilities],
      ...(fixtures === undefined ? {} : { fixtures }),
      ...(actions === undefined ? {} : { actions }),
    }),
  )

  const stages = ['declared']
  const state = {
    started: false,
    ready: false,
    released: false,
    counter: 0,
    stops: 0,
    resets: 0,
    live: new Set(),
    revoked: new Set(),
  }

  /**
   * Run reset before stop so a partial start leaves no service running. Both
   * always run, and a rejecting one is reported to the caller instead of
   * thrown from here: this is the one place a driver is cleaned while it may
   * not be running, so it is where the declared requirement that stop and
   * reset are safe on an idle driver is relied upon, and the start diagnostic
   * is what a maintainer must still read whether or not the cleanup itself
   * failed. The returned failure is appended to that diagnostic.
   * @returns {Promise<unknown>} the cleanup failure, or undefined when clean
   */
  async function resetBeforeStop() {
    let cleanup = undefined
    try {
      await driver.reset()
      state.resets += 1
    } catch (error) {
      cleanup = error
    }
    try {
      await driver.stop()
      state.stops += 1
    } catch (error) {
      cleanup = cleanup === undefined ? error : cleanup
    }
    return cleanup
  }

  /**
   * Return the validated lifecycle trace for the current stages.
   * @returns {object} the frozen lifecycle trace
   */
  function lifecycleTrace() {
    return contract.lifecycle.validateLifecycleTrace({ stages: [...stages] }, 'fairtrade adapter')
  }

  /**
   * Start the managed service. On failure or timeout the partial start is
   * cleaned with reset before stop and an actionable error is thrown.
   * @param {object} [callOptions] start options
   * @param {number} [callOptions.timeoutMs] start deadline in milliseconds
   * @returns {Promise<object>} the frozen start receipt
   */
  async function start(callOptions = {}) {
    if (state.released) {
      throw new Error(
        'fairtrade adapter: start after release for field "state" at path adapter.lifecycle; ' +
        'repair: create a fresh adapter instead of restarting a released one.',
      )
    }
    if (state.started) {
      throw new Error(
        'fairtrade adapter: duplicate start for field "state" at path adapter.lifecycle; ' +
        'repair: call start once per adapter and use teardown before restarting.',
      )
    }
    const timeoutMs = callOptions?.timeoutMs
    try {
      if (timeoutMs === undefined) {
        await driver.start()
      } else {
        if (!Number.isInteger(timeoutMs) || timeoutMs < 0) {
          throw new Error(
            `fairtrade adapter: invalid value ${JSON.stringify(timeoutMs)} for field "timeoutMs" at path adapter.start; ` +
            'repair: use a non-negative integer for "timeoutMs" or omit it.',
          )
        }
        await runWithTimeout(
          driver.start(),
          timeoutMs,
          `fairtrade adapter: driver start timed out after ${timeoutMs}ms for field "timeoutMs" at path adapter.start; ` +
          'repair: raise "timeoutMs" or fix driver readiness before retrying.',
        )
      }
    } catch (error) {
      const cleanup = await resetBeforeStop()
      const cleanupNote = cleanup === undefined
        ? ''
        : `; cleanup after the failed start also failed for field "driver" at path adapter.start, caused by ${cleanup instanceof Error ? cleanup.message : String(cleanup)}`
      if (error && error.isAdapterTimeout) {
        const timeout = new Error(`${error.message}${cleanupNote}`)
        timeout.isAdapterTimeout = true
        throw timeout
      }
      const cause = error instanceof Error ? error.message : String(error)
      throw new Error(
        `fairtrade adapter: driver start failed for field "driver" at path adapter.start; ` +
        `repair: fix the injected driver start and retry; caused by ${cause}${cleanupNote}.`,
      )
    }
    state.started = true
    stages.push('acquired')
    return Object.freeze({ started: true, runId, targetId: target.id })
  }

  /**
   * Report readiness for a started adapter and mark the ready stage once.
   * @returns {Promise<object>} the frozen readiness receipt
   */
  async function readiness() {
    if (!state.started) {
      throw new Error(
        'fairtrade adapter: readiness before start for field "state" at path adapter.lifecycle; ' +
        'repair: call start before readiness.',
      )
    }
    if (state.released) {
      throw new Error(
        'fairtrade adapter: readiness after release for field "state" at path adapter.lifecycle; ' +
        'repair: create a fresh adapter instead of reusing a released one.',
      )
    }
    const detail = typeof driver.readiness === 'function' ? await driver.readiness() : {}
    if (!state.ready) {
      state.ready = true
      stages.push('ready')
    }
    return Object.freeze({ ready: true, runId, targetId: target.id, detail })
  }

  /**
   * Release the managed service. The first call stops once, revokes every
   * minted handle, and records release; later calls are no-ops that report it.
   * A run whose start never acquired the service releases nothing, so its
   * trace stays a leading run of the canonical stages instead of recording
   * "released" behind a missing "acquired". Its stop is not repeated: the
   * failure path already stopped the driver, so a second stop would call a
   * driver that is not running and would surface a cleanup failure where the
   * start failure is what a maintainer needs to read. A run that did acquire
   * the service stops here, exactly once, before its handles are revoked.
   * @returns {Promise<object>} the frozen teardown receipt
   */
  async function teardown() {
    if (state.released) {
      return Object.freeze({ released: true, noop: true, stops: state.stops })
    }
    state.released = true
    try {
      if (state.started) {
        await driver.stop()
        state.stops += 1
      }
    } finally {
      for (const token of state.live) {
        state.revoked.add(token)
      }
      state.live.clear()
      if (state.started) {
        stages.push('released')
      }
    }
    return Object.freeze({ released: true, noop: false, stops: state.stops })
  }

  /**
   * Mint an opaque handle bound to this adapter run.
   * @returns {object} the frozen opaque handle
   */
  function mintHandle() {
    if (!state.started) {
      throw new Error(
        'fairtrade adapter: handle mint before start for field "state" at path adapter.lifecycle; ' +
        'repair: call start before minting a handle.',
      )
    }
    if (state.released) {
      throw new Error(
        'fairtrade adapter: handle mint after release for field "handle" at path adapter.handle; ' +
        'repair: mint handles only while the adapter run is active.',
      )
    }
    state.counter += 1
    const handle = contract.handles.validateOpaqueHandle(
      { token: `${runId}-handle-${state.counter}`, revoked: false },
      'fairtrade adapter',
    )
    state.live.add(handle.token)
    return handle
  }

  /**
   * Require a live handle minted by this adapter run. Foreign and revoked
   * handles fail with an actionable diagnostic.
   * @param {unknown} handle candidate opaque handle
   * @returns {object} the validated opaque handle
   */
  function requireHandle(handle) {
    const valid = contract.handles.validateOpaqueHandle(handle, 'fairtrade adapter')
    if (valid.revoked || state.revoked.has(valid.token)) {
      throw new Error(
        'fairtrade adapter: revoked handle for field "revoked" at path handle.revoked; ' +
        'repair: mint a fresh handle before teardown and never reuse a revoked one.',
      )
    }
    if (!valid.token.startsWith(`${runId}-handle-`) || !state.live.has(valid.token)) {
      throw new Error(
        `fairtrade adapter: foreign handle ${JSON.stringify(valid.token)} for field "token" at path handle.token; ` +
        'repair: use a handle minted by this adapter run for "token".',
      )
    }
    return valid
  }

  /**
   * Perform a registered named action and return its validated result.
   * @param {unknown} name action name requested by the caller
   * @param {object} [actionOptions] action options
   * @param {number} [actionOptions.observedAtMs] result time in whole ms
   * @returns {Promise<object>} the frozen named action result
   */
  async function performAction(name, actionOptions = {}) {
    if (name !== PRODUCT_ACTION_NAME) {
      throw new Error(
        `fairtrade adapter: unknown action ${JSON.stringify(name)} for field "action" at path adapter.action; ` +
        `repair: use one of ${PRODUCT_ACTION_NAME} for "action".`,
      )
    }
    if (!state.started) {
      throw new Error(
        'fairtrade adapter: action before start for field "state" at path adapter.lifecycle; ' +
        'repair: call start before performing an action.',
      )
    }
    if (state.released) {
      throw new Error(
        'fairtrade adapter: action after release for field "state" at path adapter.lifecycle; ' +
        'repair: create a fresh adapter instead of reusing a released one.',
      )
    }
    const observedAtMs = actionOptions?.observedAtMs ?? Date.now()
    return contract.resolution.validateNamedResult(
      { name, completed: true, observedAtMs },
      'fairtrade adapter',
      'adapter.actionResult',
    )
  }

  return Object.freeze({
    runId,
    targetId: target.id,
    declaration,
    capabilities: validatedCapabilities,
    start,
    readiness,
    teardown,
    mintHandle,
    requireHandle,
    performAction,
    lifecycleTrace,
    isRunning: () => driver.isRunning(),
    stats: () => Object.freeze({ stops: state.stops, resets: state.resets }),
  })
}

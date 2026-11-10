// @ts-check

// Fairtest runtime constants: the single owner of every runtime value the
// Fairtest host shares.
//
// Three families, one declaration site each:
//
// 1. The loopback origin. This module is the ONE declaration site for the
//    Fairtest loopback host and port. Both consumers read these exports: the
//    row-scoped producer binds its static driver to them, and
//    playwright.fairtest.config.mjs builds use.baseURL from them. Neither
//    module may re-declare a host, a port, or a base URL literal: a second
//    declaration is a value production code does not read, so a change made
//    there would silently do nothing (the `config-port-owner-single-declaration`
//    case in the product fixture family proves the single owner).
//
// 2. The render viewport. The viewport is a product-EVIDENCE parameter, not a
//    cosmetic one: the rendered-root predicate intersects each active root
//    against the stage's visible box to decide the `clipped` unrendered mode,
//    and both record.json and provenance.json name this value as the render
//    viewport. The config, the row, the negative mutations, and the
//    config-shape case therefore all read it here.
//
// 3. The scratch-port range. Every throwaway loopback listener the suites open
//    takes its port from this module, so no suite holds a port literal and two
//    suites running in one `node --test` invocation cannot name the same
//    scratch port. A purpose names a fixed offset from one base, and
//    claimScratchPort hands out the declared port only after verifying it is
//    free, so a port another process already holds is stepped over instead of
//    being blamed on an unrelated case.
//
// Plain values only: no service, no host state, no filesystem, so every import
// of this module stays side-effect free. The only side effect anywhere is the
// short-lived probe claimScratchPort binds to answer "is this port free",
// which it closes again before returning.
import net from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Absolute repository root derived from this file's own location, so the
 * declared origins need no working-directory assumption.
 * @type {string}
 */
export const FAIRTEST_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Loopback host for every Fairtest-served surface. Never a wildcard or named
 * listener: the validation origin is loopback-only so it can never be reached
 * off-host. Override the PORT with FAIRTEST_APP_PORT; the host is fixed.
 * @type {string}
 */
export const FAIRTEST_APP_HOST = '127.0.0.1'

/**
 * Default loopback port for the built app. The Fairtest Playwright config uses
 * it for use.baseURL, and the local dev/bridge driver uses it when no explicit
 * port is passed. Mounted rows pass port 0 so each worker gets an OS-assigned
 * port. Override with FAIRTEST_APP_PORT.
 * @type {number}
 */
export const FAIRTEST_APP_PORT = Number(process.env.FAIRTEST_APP_PORT || 5189)

/**
 * The one declared loopback base URL: the config's use.baseURL and the local
 * dev driver's default. A mounted row reads the running driver's baseUrl
 * instead, because each worker owns an ephemeral port.
 * @type {string}
 */
export const FAIRTEST_APP_BASE_URL = `http://${FAIRTEST_APP_HOST}:${FAIRTEST_APP_PORT}`

/**
 * Default loopback port for the built Storybook artifact. The component
 * producer uses it when no explicit port is passed; mounted component rows pass
 * port 0 for an OS-assigned worker port. It is deliberately distinct from the
 * app port and from the broad journey catalog's Storybook port, so a local
 * component driver can never attach to an unrelated already-running server.
 * The host is the same fixed loopback host, so the component origin shares one
 * host declaration. Override with FAIRTEST_STORYBOOK_PORT.
 * @type {number}
 */
export const FAIRTEST_STORYBOOK_PORT = Number(process.env.FAIRTEST_STORYBOOK_PORT || 6018)

/**
 * The one render viewport every Fairtest surface measures at. The mounted row
 * pins the page to it, the runner config declares it as the default, the
 * negative mutations open their pages at it, and the config-shape case
 * compares the runner's declared value against this one, so a fourth
 * declaration cannot appear beside it without turning that case red.
 * @type {{ readonly width: number, readonly height: number }}
 */
export const PRODUCT_VIEWPORT = Object.freeze({ width: 1280, height: 720 })

/**
 * The mounted-row worker budget. Each Playwright worker owns an ephemeral
 * loopback listener, so parallel rows never share an origin and a foreign local
 * server cannot occupy a worker's port. The run root is still one immutable
 * envelope: every row writes a row-keyed producer directory, so no worker
 * overwrites another worker's subtree. Override with
 * FAIRTEST_MOUNTED_WORKERS; the runner config reads this value. The
 * config-shape fixture pins FAIRTEST_DEFAULT_MOUNTED_WORKERS, so running the
 * product contract with an override is expected to disagree with the fixture.
 * @type {number}
 */
export const FAIRTEST_DEFAULT_MOUNTED_WORKERS = 4

export const FAIRTEST_MOUNTED_WORKERS = (() => {
  const raw = Number(process.env.FAIRTEST_MOUNTED_WORKERS || FAIRTEST_DEFAULT_MOUNTED_WORKERS)
  if (!Number.isInteger(raw) || raw < 1) {
    throw new Error(
      `fairtest runtime: invalid worker budget ${JSON.stringify(process.env.FAIRTEST_MOUNTED_WORKERS)} for field "FAIRTEST_MOUNTED_WORKERS" at path runtime.workers; ` +
      'repair: use a positive integer worker count, or unset the variable for the declared default.',
    )
  }
  return raw
})()

/**
 * Every purpose a suite may open a throwaway loopback listener for, in a
 * fixed order. A purpose is a named scratch-port slot, not a free-form label:
 * an unknown purpose is refused instead of silently taking an offset nobody
 * reserved.
 * @type {readonly string[]}
 */
export const FAIRTEST_SCRATCH_PURPOSES = Object.freeze([
  'adapter-squatter',
  'adapter-absent-dist',
  'adapter-out-of-root',
  'adapter-host-refusal',
  'mutation-dom-absence',
  'mutation-stale-served-asset',
  'mutation-blank-active-view',
  'mutation-unrendered-active-view',
  'mutation-component-root-states',
  'mutation-component-provenance',
])

/**
 * First port of the owned scratch range. Each purpose takes a fixed offset
 * from it, so the declared ports are distinct by construction; the range is
 * overridable so a busy machine can move the whole block.
 * @type {number}
 */
export const FAIRTEST_SCRATCH_PORT_BASE = Number(process.env.FAIRTEST_SCRATCH_PORT_BASE || 5210)

/**
 * How many consecutive ports past the declared one claimScratchPort may step
 * over before it gives up. A wide enough walk to survive a second suite
 * holding one or two slots, and narrow enough to stay inside the owned range
 * rather than wandering into a port this module does not own.
 * @type {number}
 */
const FAIRTEST_SCRATCH_PORT_SPAN = 64

/**
 * The declared scratch port for one purpose: the owned base plus that
 * purpose's fixed offset. Pure and synchronous, so a caller that only needs
 * to know which port a purpose owns (a diagnostic, a squatter, a case
 * assertion) never binds anything.
 * @param {string} purpose one of FAIRTEST_SCRATCH_PURPOSES
 * @returns {number} the declared loopback port for the purpose
 */
export function fairtestScratchPort(purpose) {
  const offset = FAIRTEST_SCRATCH_PURPOSES.indexOf(purpose)
  if (offset < 0) {
    throw new Error(
      `fairtest runtime: unknown scratch purpose ${JSON.stringify(purpose)} for field "purpose" at path runtime.scratch.purpose; ` +
      `repair: use one of ${FAIRTEST_SCRATCH_PURPOSES.join(', ')} for "purpose".`,
    )
  }
  return FAIRTEST_SCRATCH_PORT_BASE + offset
}

/**
 * Take a scratch loopback port for one purpose. The declared port is used
 * when it is free; otherwise the first free port above it inside the owned
 * range is used, so two suites running concurrently never bind the same port
 * and a suite never inherits an EADDRINUSE it cannot explain. Nothing is left
 * bound: the probe is closed before the lease is returned, so the caller
 * still owns the exclusive bind of the port it is handed.
 * @param {string} purpose one of FAIRTEST_SCRATCH_PURPOSES
 * @returns {Promise<{ purpose: string, host: string, port: number, declaredPort: number, offset: number }>} the leased port and how far it sat from the declared one
 */
export async function claimScratchPort(purpose) {
  const declaredPort = fairtestScratchPort(purpose)
  for (let offset = 0; offset < FAIRTEST_SCRATCH_PORT_SPAN; offset += 1) {
    const port = declaredPort + offset
    if (port > 65535) break
    if (await loopbackPortFree(port)) {
      return Object.freeze({ purpose, host: FAIRTEST_APP_HOST, port, declaredPort, offset })
    }
  }
  throw new Error(
    `fairtest runtime: no free scratch port for ${JSON.stringify(purpose)} for field "port" at path runtime.scratch.port; ` +
    `tried ${declaredPort} through ${declaredPort + FAIRTEST_SCRATCH_PORT_SPAN - 1} on ${FAIRTEST_APP_HOST}; ` +
    'repair: free the owned scratch range or move it with FAIRTEST_SCRATCH_PORT_BASE.',
  )
}

/**
 * Report whether a loopback port can be bound right now, by binding and
 * immediately releasing a throwaway listener. Used only by claimScratchPort.
 * @param {number} port loopback port to probe
 * @returns {Promise<boolean>} true when the port accepted a listener
 */
function loopbackPortFree(port) {
  return new Promise((settle) => {
    const probe = net.createServer()
    probe.once('error', () => settle(false))
    probe.listen(port, FAIRTEST_APP_HOST, () => {
      probe.close(() => settle(true))
    })
  })
}

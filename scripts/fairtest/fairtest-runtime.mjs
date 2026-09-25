// Fairtest runtime constants: the single owner of the loopback origin the
// mounted rows and the Fairtest Playwright config share.
//
// This module is the ONE declaration site for the Fairtest loopback host and
// port. Both consumers read these exports: the row-scoped producer binds its
// static driver to them, and playwright.fairtest.config.mjs builds use.baseURL
// from them. Neither module may re-declare a host, a port, or a base URL
// literal: a second declaration is a value production code does not read, so a
// change made there would silently do nothing (the `config-port-owner` case in
// the product fixture family proves the single owner).
//
// Plain constants only: no service, no host state, no filesystem, so every
// import of this module stays side-effect free.
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
 * Fixed loopback port for the built app, shared by the mounted rows and the
 * Fairtest Playwright config. Override with FAIRTEST_APP_PORT.
 * @type {number}
 */
export const FAIRTEST_APP_PORT = Number(process.env.FAIRTEST_APP_PORT || 5189)

/**
 * The one loopback base URL both consumers derive: the driver's served origin
 * and the runner's use.baseURL.
 * @type {string}
 */
export const FAIRTEST_APP_BASE_URL = `http://${FAIRTEST_APP_HOST}:${FAIRTEST_APP_PORT}`

// @ts-check

// Fairtrade-owned mounted component producer: browser-bearing host runtime and
// durable artifact writer for the built Storybook story target.
//
// This module never invents selectors, theme semantics, or proof vocabulary.
// Every one of those comes from fairtrade-component-target.mjs (app-owned
// component registry and its story entries), from fairtest-runtime.mjs (the
// single loopback owner this module and the runner config read), and from the
// shared host contract through the sole source route. It holds no story
// knowledge of its own: a story row is a COMPONENT_STORIES entry. It writes
// exactly the SAME six artifact class names the product row writes, from the
// one shared constant in fairtest-artifacts.mjs (which product-producer.mjs only
// re-exports), into a `producer/<rowPrefix>-<theme>/` row directory so one
// verifier reads both kinds with one closed set.
//
// Row sequence per story entry and theme (dark, light): serve the direct
// iframe, wait for a genuine mount (real root children, a settled render
// lifecycle with no error phase, the layout's ready-state body classes, a
// hidden error display, and an empty error stack), observe the normalized
// theme, wait for the declared before-facts, read the declared computed
// styles, perform the story's ONE trusted action when it has one, wait for the
// declared after-facts and the measured floors, capture the mounted root,
// snapshot the ARIA tree, run a plain serious-violations axe gate tied to the
// proven state, and collect the iframe.html served-build provenance.
//
// Fail-closed: any missing, contradictory, or unproven part throws an
// actionable error naming the missing part, the selector or path, and the
// repair. A failing row never writes a passing record.

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { join, resolve } from 'node:path'
import { importFairtestSource } from '../fairtest-source.mjs'
import { FAIRTEST_APP_HOST, FAIRTEST_STORYBOOK_PORT, PRODUCT_VIEWPORT } from './fairtest-runtime.mjs'
import { fairtestPath } from './fairtest-paths.mjs'
import { assertProductThemeObservation, observeProductTheme } from './fairtrade-targets.mjs'
import { AXE_RESULT_FIELDS, scanAxe, seriousViolations } from '../journey/lib/assertions.mjs'
import {
  COMPONENT_A11Y_POLICY,
  COMPONENT_ACTION_TIMEOUT_MS,
  COMPONENT_DEFAULT_STORY,
  COMPONENT_LAYOUT_BODY_CLASSES,
  COMPONENT_MIN_ARIA_CHARS,
  COMPONENT_MIN_SCREENSHOT_BYTES,
  COMPONENT_MOUNT_TIMEOUT_MS,
  COMPONENT_PROVENANCE_SOURCE,
  COMPONENT_RENDER_PHASES,
  COMPONENT_SELECTORS,
  COMPONENT_STORIES,
  assertComponentMounted,
  buildComponentProof,
  componentA11yPoint,
  componentGateReceiptFields,
  componentThemeSetup,
} from './fairtrade-component-target.mjs'
import { ARTIFACT_CLASSES, PRODUCT_ONLY_FIELDS, assertServedDigestsMatchRunRoot } from './fairtest-artifacts.mjs'
import { requireEnvelopeForRun, resolveRunId, resolveRunRoot } from './run-envelope-contract.mjs'

const kindsContract = await importFairtestSource('src/host-contract/kinds.mjs')
const valuesContract = await importFairtestSource('src/core/values.mjs')

const ROW_THEMES = Object.freeze(['dark', 'light'])
const STORYBOOK_ROOT = fairtestPath('storybookRoot')

/**
 * The six durable artifact classes a component row writes. It is the SAME
 * constant the product row writes, re-declared under the component name so a
 * consumer of the component module reads the one shared set rather than a
 * second six-element literal.
 * @type {readonly string[]}
 */
export const COMPONENT_ARTIFACT_CLASSES = ARTIFACT_CLASSES

// Drift guard: the component artifact set is the one neutral shared set, by
// reference and by the exact six-name length. A component row that started
// emitting a seventh or a renamed class would turn this red at import time
// rather than silently diverge from the one verifier contract.
if (COMPONENT_ARTIFACT_CLASSES !== ARTIFACT_CLASSES || COMPONENT_ARTIFACT_CLASSES.length !== 6) {
  throw new Error(
    'component producer: component artifact classes drifted from the shared set for field "artifactClasses" at path artifacts; ' +
    'repair: reuse ARTIFACT_CLASSES unchanged so one verifier reads both kinds.',
  )
}

/**
 * Exact field set of the record.json accessibility block. The page-wide census
 * is never one of these names: it lives under `pageWide`, so an unqualified
 * `blocking` or `violations` count cannot be read as a verdict.
 * @type {readonly string[]}
 */
export const COMPONENT_A11Y_RECORD_FIELDS = Object.freeze([
  'policy',
  'gatedScope',
  'scopeRoot',
  'scopedAfter',
  'gate',
  'pageWide',
])

/**
 * Exact field set of the informational page-wide census inside the record
 * accessibility block, mirroring the product record shape.
 * @type {readonly string[]}
 */
export const COMPONENT_A11Y_PAGE_WIDE_FIELDS = Object.freeze([
  'scope',
  'root',
  'informational',
  'violations',
  'blocking',
  'blockingIds',
  'incomplete',
  'passes',
])

/**
 * Scope labels shared by the component accessibility evidence, declared once.
 * @type {{ gated: string, page: string, pageRoot: string }}
 */
const COMPONENT_A11Y_SCOPES = Object.freeze({
  gated: 'component-root',
  page: 'page',
  pageRoot: 'document',
})

/**
 * Resolve the immutable component run root for the current run through the ONE
 * run-envelope resolver, then require the envelope to belong to this run
 * before the row touches its subtree. The resolver requires an absolute path
 * whose final segment names FAIRTEST_RUN_ID and the envelope must name the
 * same run and project, so a foreign or mismatched root fails before any
 * component row directory is created.
 * @returns {string} the resolved run root
 */
export function resolveComponentRunRoot() {
  const root = resolveRunRoot()
  requireEnvelopeForRun(root, resolveRunId(), 'component producer')
  return root
}

/**
 * Row directory for a component theme row inside a run root. The directory
 * name is the row key: the story entry's row prefix and the theme.
 * @param {string} runRoot immutable run root
 * @param {string} theme dark or light row theme
 * @param {import('./fairtrade-component-target.mjs').ComponentStory} [story] story entry, defaults to the disclosure story
 * @returns {string} the row directory path
 */
export function componentRowDir(runRoot, theme, story = COMPONENT_DEFAULT_STORY) {
  if (!ROW_THEMES.includes(theme)) {
    throw new Error(
      `component producer: unknown row theme ${JSON.stringify(theme)} for field "theme" at path row.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  if (!COMPONENT_STORIES.includes(story)) {
    throw new Error(
      `component producer: unregistered story ${JSON.stringify(story && story.key)} for field "story" at path row.story; ` +
      `repair: pass one of the registered component stories ${COMPONENT_STORIES.map((entry) => entry.key).join(', ')}.`,
    )
  }
  return join(runRoot, 'producer', `${story.rowPrefix}-${theme}`)
}

/**
 * Refuse a row directory that already carries one of the six artifact classes.
 * Module-private: prepareComponentRowDir is the only way the row can reach this
 * refusal, so freshness can never be validated after a write has overwritten a
 * previous run's bytes.
 * @param {string} rowDir row directory
 * @returns {void}
 */
function refuseStaleComponentSubtree(rowDir) {
  for (const name of COMPONENT_ARTIFACT_CLASSES) {
    if (existsSync(join(rowDir, name))) {
      throw new Error(
        `component producer: stale artifact ${JSON.stringify(name)} for field "artifact" at path run.rowDir/${name}; ` +
        `found a previous run subtree at ${JSON.stringify(rowDir)}; ` +
        'repair: use a fresh FAIRTEST_RUN_ROOT per run instead of reusing a previous run root.',
      )
    }
  }
}

/**
 * Prepare one component theme row's run directory: validate freshness FIRST,
 * then create the directory, and hand the row the prepared paths. This is the
 * one seam a component row goes through, so the freshness refusal happens
 * before any artifact write can reach a previous run subtree.
 * @param {object} input preparation inputs
 * @param {string} input.runRoot immutable run root
 * @param {string} input.theme dark or light row theme
 * @param {import('./fairtrade-component-target.mjs').ComponentStory} [input.story] story entry, defaults to the disclosure story
 * @returns {{ runRoot: string, rowDir: string }} the prepared paths for the row
 */
export function prepareComponentRowDir(input) {
  const hasStory = !!input && typeof input === 'object' && Object.hasOwn(input, 'story')
  valuesContract.assertExactFields(input, hasStory ? ['runRoot', 'theme', 'story'] : ['runRoot', 'theme'], 'component producer', 'producer.rowPreparation')
  const { runRoot, theme, story = COMPONENT_DEFAULT_STORY } = /** @type {{ runRoot: string, theme: string, story?: import('./fairtrade-component-target.mjs').ComponentStory }} */ (input)
  const rowDir = componentRowDir(runRoot, theme, story)
  refuseStaleComponentSubtree(rowDir)
  mkdirSync(rowDir, { recursive: true })
  return Object.freeze({ runRoot: resolve(runRoot), rowDir })
}

/**
 * The loopback static Storybook driver createComponentStaticDriver returns:
 * the adapter lifecycle surface plus the served base URL and tree metadata.
 * @typedef {object} StaticComponentDriver
 * @property {() => Promise<void>} start
 * @property {() => Promise<void>} stop
 * @property {() => Promise<void>} reset
 * @property {() => boolean} isRunning
 * @property {() => Promise<{ ready: boolean, host: string, port: number }>} readiness
 * @property {() => { stops: number }} stats
 * @property {string} baseUrl
 * @property {number} port
 * @property {string} host
 * @property {string} staticRoot
 */

/**
 * Create a loopback static driver serving the exact built Storybook artifact
 * from storybook-static/. Narrower than the product driver: it refuses a
 * missing build with a "run pnpm build-storybook first" repair, and its
 * readiness probe requires the iframe document and the built index. Satisfies
 * the adapter's declared driver contract: stop is safe on an idle driver.
 * @param {object} [options] driver options
 * @param {number} [options.port] fixed loopback port
 * @param {string} [options.host] loopback host, always the declared owner
 * @param {string} [options.staticRoot] built Storybook root served over HTTP
 * @returns {StaticComponentDriver} the injected lifecycle driver for createAdapter
 */
export function createComponentStaticDriver(options = {}) {
  const port = options.port ?? FAIRTEST_STORYBOOK_PORT
  const host = options.host ?? FAIRTEST_APP_HOST
  const staticRoot = options.staticRoot ?? STORYBOOK_ROOT
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `component producer: invalid port ${JSON.stringify(port)} for field "port" at path driver.port; ` +
      'repair: use the fixed loopback port owned by scripts/fairtest/fairtest-runtime.mjs for "port".',
    )
  }
  if (host !== FAIRTEST_APP_HOST) {
    throw new Error(
      `component producer: non-loopback host ${JSON.stringify(host)} for field "host" at path driver.host; ` +
      `repair: bind the built Storybook artifact to ${FAIRTEST_APP_HOST} for "host".`,
    )
  }
  /** @type {Record<string, string>} */
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json; charset=utf-8',
  }
  /** @type {import('node:http').Server | null} */
  let server = null
  let running = false
  let stops = 0

  async function start() {
    if (running) {
      throw new Error(
        'component producer: duplicate driver start for field "state" at path driver.lifecycle; ' +
        'repair: start the driver once per adapter and stop it before restarting.',
      )
    }
    if (!existsSync(join(staticRoot, 'iframe.html')) || !existsSync(join(staticRoot, 'index.json'))) {
      throw new Error(
        `component producer: built Storybook artifact is missing for field "storybook" at path driver.staticRoot; ` +
        `looked for ${JSON.stringify(join(staticRoot, 'iframe.html'))} and ${JSON.stringify(join(staticRoot, 'index.json'))}; ` +
        'repair: run pnpm build-storybook before the mounted component row so storybook-static/ holds the exact built story.',
      )
    }
    server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', `http://${host}:${port}`)
        let pathname = decodeURIComponent(url.pathname)
        if (pathname === '/') pathname = '/iframe.html'
        const file = join(staticRoot, pathname)
        const resolved = resolve(file)
        if (resolved !== resolve(staticRoot) && !resolved.startsWith(`${resolve(staticRoot)}/`)) {
          res.writeHead(403)
          res.end('forbidden')
          return
        }
        const data = readFileSync(resolved)
        const ext = resolved.slice(resolved.lastIndexOf('.'))
        res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
        res.end(data)
      } catch {
        res.writeHead(404)
        res.end('not found')
      }
    })
    await new Promise((responseResolve, responseReject) => {
      const activeServer = /** @type {import('node:http').Server} */ (server)
      activeServer.on('error', responseReject)
      activeServer.listen(port, host, () => {
        activeServer.removeListener('error', responseReject)
        responseResolve(undefined)
      })
    }).catch((error) => {
      server = null
      const cause = error instanceof Error ? error.message : String(error)
      throw new Error(
        `component producer: driver start failed for field "port" at path driver.start; ` +
        `could not listen on ${host}:${port}; caused by ${cause}; ` +
        'repair: free the fixed loopback port or stop the previous adapter run before retrying.',
      )
    })
    running = true
  }

  async function stop() {
    if (!running || !server) return
    const current = server
    server = null
    running = false
    stops += 1
    current.closeAllConnections()
    await new Promise((responseResolve) => current.close(() => responseResolve(undefined)))
  }

  async function reset() {
    return
  }

  function isRunning() {
    return running
  }

  async function readiness() {
    if (!running) {
      throw new Error(
        'component producer: readiness before start for field "state" at path driver.readiness; ' +
        'repair: start the driver before reporting readiness.',
      )
    }
    const body = await fetchText(`http://${host}:${port}/iframe.html`)
    if (!body || !body.includes(`id="${COMPONENT_SELECTORS.root.replace(/^#/, '')}"`)) {
      throw new Error(
        'component producer: readiness probe found no story root for field "ready" at path driver.readiness; ' +
        'repair: rebuild storybook-static/ with pnpm build-storybook so the served iframe carries the story root.',
      )
    }
    return { ready: true, host, port }
  }

  return {
    start,
    stop,
    reset,
    isRunning,
    readiness,
    stats: () => ({ stops }),
    baseUrl: `http://${host}:${port}`,
    port,
    host,
    staticRoot,
  }
}

/**
 * Fetch text over HTTP from the running loopback server.
 * @param {string} url loopback URL to read
 * @returns {Promise<string>} the served text
 */
function fetchText(url) {
  return new Promise((responseResolve, responseReject) => {
    http.get(url, (res) => {
      if (res.statusCode !== 200) {
        responseReject(new Error(`unexpected status ${res.statusCode}`))
        res.resume()
        return
      }
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { text += chunk })
      res.on('end', () => responseResolve(text))
    }).on('error', responseReject)
  })
}

/**
 * Fetch raw bytes over HTTP from the running loopback server.
 * @param {string} url loopback URL to read
 * @returns {Promise<Buffer>} the served bytes
 */
function fetchBytes(url) {
  return new Promise((responseResolve, responseReject) => {
    http.get(url, (res) => {
      if (res.statusCode !== 200) {
        responseReject(new Error(`unexpected status ${res.statusCode}`))
        res.resume()
        return
      }
      const chunks = /** @type {Buffer[]} */ ([])
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => responseResolve(Buffer.concat(chunks)))
    }).on('error', responseReject)
  })
}

/**
 * Hash bytes with sha256 and return the hex digest.
 * @param {Buffer|string} data bytes to hash
 * @returns {string} hex digest
 */
function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Read the integration commit SHA and dirty state from the worktree that
 * produced the built Storybook artifact.
 * @returns {{ commit: string, dirty: boolean }} commit and dirty state
 */
function readWorktreeState() {
  let commit = 'unknown'
  let dirty = true
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `component producer: cannot read the integration commit for field "commit" at path provenance.commit; caused by ${cause}; ` +
      'repair: run the mounted row inside the fairtrade worktree so git rev-parse HEAD resolves.',
    )
  }
  try {
    const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
    dirty = status.trim().length > 0
  } catch {
    dirty = true
  }
  return { commit, dirty }
}

/**
 * Fail-closed check that one axe scan carries exactly the shared compact
 * report field set.
 * @param {unknown} scan compact axe report
 * @param {string} path record path of the scan
 */
function assertComponentAxeScanShape(scan, path) {
  valuesContract.assertExactFields(scan, AXE_RESULT_FIELDS, 'component producer', path)
  if (!Array.isArray(/** @type {Record<string, any>} */ (scan).violations)) {
    throw new Error(
      `component producer: malformed accessibility scan for field "violations" at path ${path}; ` +
      'repair: keep the shared axe primitive wired so every scan returns its violation list.',
    )
  }
}

/**
 * Summarize one scoped scan into the compact receipt the record accessibility
 * block carries beside its gate decision.
 * @param {{ violations: { id: string }[], incomplete: unknown[], passes: number }} scan compact scoped scan report
 * @returns {{ violations: number, ids: string[], incomplete: unknown[], passes: number }} the scoped summary
 */
function summarizeScopedScan(scan) {
  return {
    violations: scan.violations.length,
    ids: scan.violations.map((entry) => entry.id),
    incomplete: [...scan.incomplete],
    passes: scan.passes,
  }
}

/**
 * Inputs buildComponentGateReceipt derives the plain serious-violations
 * receipt from.
 * @typedef {object} ComponentGateReceiptInput
 * @property {{ violations: { id: string }[] }} scan compact scoped scan report
 * @property {string} observedTheme theme the page rendered when the scan ran
 * @property {import('./fairtrade-component-target.mjs').ComponentStory} story story entry the scan belongs to
 * @property {boolean} tie whether the story's gate tie fact held when the scan finished
 */

/**
 * Build the plain serious-violations gate receipt for the mounted component
 * scope. There is no baseline and no delta: the receipt is a pass exactly when
 * the scoped scan reports no serious or critical violation. `observedTheme` and
 * the story's tie field (`ariaExpanded` for the disclosure story) are the
 * observed ties to the moment the scan was taken.
 * @param {ComponentGateReceiptInput} input receipt inputs
 * @returns {Readonly<Record<string, string | number | boolean>>} the frozen gate receipt
 */
function buildComponentGateReceipt({ scan, observedTheme, story, tie } = /** @type {ComponentGateReceiptInput} */ ({})) {
  valuesContract.assertExactFields({ scan, observedTheme, story, tie }, ['scan', 'observedTheme', 'story', 'tie'], 'component producer', 'a11y.gate')
  const serious = seriousViolations(scan)
  return Object.freeze({
    policy: COMPONENT_A11Y_POLICY,
    point: componentA11yPoint(story),
    observedTheme,
    [story.gateTie.field]: tie,
    result: serious.length === 0 ? 'pass' : 'fail',
    measured: scan.violations.length,
  })
}

/**
 * Assemble the record.json accessibility block from the page-wide scan and the
 * gated component-root scan. The gated population is the qualified one and the
 * page-wide population is nested under `pageWide` with an explicit
 * `informational: true` marker, so a reader keying off a bare `blocking` count
 * cannot find it at the top level.
 * @param {object} input assembled accessibility evidence
 * @param {object} input.pageWide compact page-wide scan report
 * @param {object} input.scoped compact component-root scan report
 * @param {object} input.gate gate receipt
 * @returns {object} the record accessibility block
 */
export function buildComponentAccessibilityEvidence(input) {
  valuesContract.assertExactFields(input, ['pageWide', 'scoped', 'gate'], 'component producer', 'record.accessibility')
  const { pageWide, scoped, gate } = /** @type {Record<string, any>} */ (input)
  const blocking = seriousViolations(pageWide)
  return {
    policy: COMPONENT_A11Y_POLICY,
    gatedScope: COMPONENT_A11Y_SCOPES.gated,
    scopeRoot: COMPONENT_SELECTORS.root,
    scopedAfter: summarizeScopedScan(scoped),
    gate: { ...gate },
    pageWide: {
      scope: COMPONENT_A11Y_SCOPES.page,
      root: COMPONENT_A11Y_SCOPES.pageRoot,
      informational: true,
      violations: pageWide.violations.length,
      blocking: blocking.length,
      blockingIds: blocking.map((/** @type {{ id: string }} */ entry) => entry.id),
      incomplete: [...pageWide.incomplete],
      passes: pageWide.passes,
    },
  }
}

/**
 * Verifier-facing reader for a record.json accessibility block. The verdict is
 * the gate receipt and nothing else; the page-wide census is informational and
 * is never a verdict input. An unqualified page-wide count, a mislabeled scope
 * or root, a foreign policy, a receipt taken at the wrong point or theme, a
 * collapsed state, or a scoped count contradicting its own receipt all fail
 * closed.
 * @param {object} accessibility the record.json accessibility block
 * @param {import('./fairtrade-component-target.mjs').ComponentStory} [story] story entry the row drove, defaults to the disclosure story; it names the receipt's point and tie field
 * @returns {{ policy: string, gatedScope: string, scopeRoot: string, result: string, gate: object }} the frozen verdict read from the gate receipt
 */
export function readComponentAccessibilityVerdict(accessibility, story = COMPONENT_DEFAULT_STORY) {
  valuesContract.assertExactFields(accessibility, COMPONENT_A11Y_RECORD_FIELDS, 'component producer', 'record.accessibility')
  const record = /** @type {Record<string, any>} */ (accessibility)
  if (record.policy !== COMPONENT_A11Y_POLICY) {
    throw new Error(
      `component producer: unknown accessibility policy ${JSON.stringify(record.policy)} for field "policy" at path record.accessibility.policy; ` +
      `repair: record the app-owned policy ${JSON.stringify(COMPONENT_A11Y_POLICY)} for "policy".`,
    )
  }
  if (record.gatedScope !== COMPONENT_A11Y_SCOPES.gated) {
    throw new Error(
      `component producer: mislabeled gated scope ${JSON.stringify(record.gatedScope)} for field "gatedScope" at path record.accessibility.gatedScope; ` +
      `the verdict is only attributable to the declared gated scope ${JSON.stringify(COMPONENT_A11Y_SCOPES.gated)}; ` +
      'repair: name the gated component-root scope so the verdict cannot be read as page-wide.',
    )
  }
  if (record.scopeRoot !== COMPONENT_SELECTORS.root) {
    throw new Error(
      `component producer: mislabeled scope root ${JSON.stringify(record.scopeRoot)} for field "scopeRoot" at path record.accessibility.scopeRoot; ` +
      `the gate covered the declared root ${JSON.stringify(COMPONENT_SELECTORS.root)}; ` +
      'repair: record the selector the gate covered for "scopeRoot".',
    )
  }
  const receipt = record.gate
  valuesContract.assertExactFields(receipt, componentGateReceiptFields(story), 'component producer', 'record.accessibility.gate')
  if (receipt.policy !== COMPONENT_A11Y_POLICY) {
    throw new Error(
      `component producer: foreign gate receipt policy ${JSON.stringify(receipt.policy)} for field "policy" at path record.accessibility.gate.policy; ` +
      `repair: record the policy the gate actually ran under for "policy".`,
    )
  }
  if (receipt.point !== componentA11yPoint(story)) {
    throw new Error(
      `component producer: unknown gate observation point ${JSON.stringify(receipt.point)} for field "point" at path record.accessibility.gate.point; ` +
      `repair: name the declared component observation point for the receipt.`,
    )
  }
  if (receipt.observedTheme !== 'dark' && receipt.observedTheme !== 'light') {
    throw new Error(
      `component producer: invalid observed theme ${JSON.stringify(receipt.observedTheme)} for field "observedTheme" at path record.accessibility.gate.observedTheme; ` +
      'repair: record the theme the page rendered when the scan was taken.',
    )
  }
  const tieField = story.gateTie.field
  if (receipt[tieField] !== true) {
    throw new Error(
      `component producer: accessibility scan was not taken on the proven ${JSON.stringify(story.gateTie.expectation.name)} state for field "${tieField}" at path record.accessibility.gate.${tieField}; ` +
      `got ${JSON.stringify(receipt[tieField])}; ` +
      `repair: scan the component while ${JSON.stringify(story.gateTie.expectation.name)} holds.`,
    )
  }
  if (receipt.result !== 'pass' && receipt.result !== 'fail') {
    throw new Error(
      `component producer: unknown gate result ${JSON.stringify(receipt.result)} for field "result" at path record.accessibility.gate.result; ` +
      'repair: record the gate decision as pass or fail for "result".',
    )
  }
  valuesContract.assertIntegerInRange(receipt.measured, 'measured', 'record.accessibility.gate.measured', { min: 0, max: Number.MAX_SAFE_INTEGER })
  const scoped = record.scopedAfter
  valuesContract.assertExactFields(scoped, ['violations', 'ids', 'incomplete', 'passes'], 'component producer', 'record.accessibility.scopedAfter')
  valuesContract.assertIntegerInRange(scoped.violations, 'violations', 'record.accessibility.scopedAfter.violations', { min: 0, max: Number.MAX_SAFE_INTEGER })
  valuesContract.assertStringList(scoped.ids, 'ids', 'record.accessibility.scopedAfter.ids')
  valuesContract.assertStringList(scoped.incomplete, 'incomplete', 'record.accessibility.scopedAfter.incomplete')
  if (scoped.violations !== receipt.measured) {
    throw new Error(
      `component producer: scoped measurement contradicts the gate receipt for field "violations" at path record.accessibility.scopedAfter.violations; ` +
      `scopedAfter measured ${JSON.stringify(scoped.violations)} while the gate receipt recorded ${JSON.stringify(receipt.measured)}; ` +
      'repair: record the scoped measurement the gate receipt was computed from.',
    )
  }
  const pageWide = record.pageWide
  valuesContract.assertExactFields(pageWide, COMPONENT_A11Y_PAGE_WIDE_FIELDS, 'component producer', 'record.accessibility.pageWide')
  if (pageWide.informational !== true) {
    throw new Error(
      `component producer: page-wide census is not marked informational for field "informational" at path record.accessibility.pageWide.informational; ` +
      'repair: set informational to true so the page-wide counts can never be read as a verdict.',
    )
  }
  for (const count of ['violations', 'blocking', 'passes']) {
    valuesContract.assertIntegerInRange(pageWide[count], count, `record.accessibility.pageWide.${count}`, { min: 0, max: Number.MAX_SAFE_INTEGER })
  }
  valuesContract.assertStringList(pageWide.blockingIds, 'blockingIds', 'record.accessibility.pageWide.blockingIds')
  valuesContract.assertStringList(pageWide.incomplete, 'incomplete', 'record.accessibility.pageWide.incomplete')
  return Object.freeze({
    policy: record.policy,
    gatedScope: record.gatedScope,
    scopeRoot: record.scopeRoot,
    result: receipt.result === 'pass' ? 'pass' : 'fail',
    gate: Object.freeze({ ...receipt }),
  })
}

/**
 * Resolve the served asset references an iframe.html carries. Both relative
 * `./` references and root-absolute `/assets/` references resolve against the
 * served Storybook root; absolute/external, `data:`, and fragment references
 * are skipped. This is the ONE resolver the producer and the negative
 * mutation suite read, so a relative reference the built iframe carries can
 * never be silently dropped from provenance.
 * @param {unknown} servedHtml served iframe.html text
 * @returns {string[]} the sorted run-root-relative asset references
 */
export function resolveComponentProvenanceRefs(servedHtml) {
  if (typeof servedHtml !== 'string' || servedHtml.length === 0) {
    throw new Error(
      'component producer: missing served iframe.html for field "servedHtml" at path provenance.servedHtml; ' +
      'repair: read the served iframe.html before resolving its asset references.',
    )
  }
  const refs = new Set()
  for (const match of servedHtml.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const raw = match[1]
    if (/^(?:[a-z]+:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('#')) continue
    const relative = raw.replace(/^\.\//, '').replace(/^\//, '')
    if (relative.length === 0) continue
    refs.add(relative)
  }
  return [...refs].sort()
}

/**
 * Inputs collectComponentServedAssets reads the served iframe and its assets
 * from.
 * @typedef {object} ComponentServedAssetsInput
 * @property {string} baseUrl running loopback base URL
 * @property {string} servedHtml served iframe.html text just read over HTTP
 * @property {string} [label] owning producer used in diagnostics
 */

/**
 * Read the served iframe.html bytes plus every served asset file it references
 * over real HTTP, keyed by run-root-relative path, and fail closed when the
 * served document references no asset file at all. This is the shared served
 * asset collector the row-scoped provenance reads and the negative mutation
 * suite drives, so relative references are resolved (not dropped) and external
 * documentation links never become a fetched asset.
 * @param {object} input collection inputs
 * @param {string} input.baseUrl running loopback base URL
 * @param {string} input.servedHtml served iframe.html text just read over HTTP
 * @param {string} [input.label] owning producer used in diagnostics
 * @returns {Promise<{ refs: string[], assetDigests: Record<string, string> }>} the resolved refs and their digests
 */
export async function collectComponentServedAssets({ baseUrl, servedHtml, label = 'component producer' } = /** @type {ComponentServedAssetsInput} */ ({})) {
  const assetDigests = /** @type {Record<string, string>} */ ({})
  assetDigests['iframe.html'] = sha256(servedHtml)
  const refs = resolveComponentProvenanceRefs(servedHtml)
  if (refs.length === 0) {
    throw new Error(
      `${label}: served iframe.html references no asset files for field "assetDigests" at path provenance.assetDigests; ` +
      'repair: rebuild storybook-static/ with pnpm build-storybook so the served iframe references its hashed asset bundle.',
    )
  }
  for (const ref of refs) {
    /** @type {Buffer | null} */
    let bytes = null
    try {
      bytes = await fetchBytes(`${baseUrl}/${ref}`)
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error)
      throw new Error(
        `${label}: cannot read served asset ${JSON.stringify(ref)} for field "assetDigests" at path provenance.assetDigests; caused by ${cause}; ` +
        'repair: keep the loopback service running while provenance is collected and rebuild storybook-static/ if the asset is missing.',
      )
    }
    assetDigests[ref] = sha256(bytes)
  }
  return Object.freeze({ refs, assetDigests })
}

/**
 * Collect served-build provenance for the built Storybook artifact over real
 * HTTP: the served iframe.html bytes plus every served asset file the iframe
 * references, compared against the run's own built Storybook tree before
 * anything is written. Relative `./` references are resolved as well as
 * `/assets/` references; external documentation links are skipped.
 * @param {object} input provenance inputs
 * @param {string} input.baseUrl running loopback base URL
 * @param {string} input.servedHtml served iframe.html text just read over HTTP
 * @param {{ width: number, height: number }} input.viewport explicit viewport
 * @param {object} input.targetIdentity component-branch target identity
 * @param {object[]} input.themeObservations normalized theme observations covered by the run
 * @param {string} input.storyId story id the row mounted
 * @returns {Promise<object>} the provenance record
 */
async function collectComponentProvenance({ baseUrl, servedHtml, viewport, targetIdentity, themeObservations, storyId }) {
  const { assetDigests } = await collectComponentServedAssets({ baseUrl, servedHtml })
  const { commit, dirty } = readWorktreeState()
  // The comparison reads storybook-static/, so the receipt names that tree, not
  // the product run root: servedFrom and root can never disagree.
  const comparison = assertServedDigestsMatchRunRoot({
    assetDigests,
    distRoot: STORYBOOK_ROOT,
    label: 'component producer',
    against: COMPONENT_PROVENANCE_SOURCE.root,
  })
  const provenance = {
    source: COMPONENT_PROVENANCE_SOURCE.source,
    root: COMPONENT_PROVENANCE_SOURCE.root,
    commit,
    dirty,
    assetDigests,
    servedFrom: comparison.against,
    commitCorrespondence: comparison.commitCorrespondence,
    viewport: { ...viewport },
    targetIdentity: { ...targetIdentity },
    themeObservations: themeObservations.map((entry) => ({ ...entry })),
    storyId,
    servedUrl: baseUrl,
    producedAtMs: Date.now(),
  }
  const written = Object.keys(provenance).sort()
  const declared = [...COMPONENT_PROVENANCE_SOURCE.fields].sort()
  if (JSON.stringify(written) !== JSON.stringify(declared)) {
    throw new Error(
      `component producer: provenance record carries ${JSON.stringify(written)} for field "provenance" at path provenance.fields; ` +
      `the registry declares ${JSON.stringify(declared)}; ` +
      'repair: keep provenance.json to the declared field set in COMPONENT_PROVENANCE_SOURCE.fields.',
    )
  }
  return provenance
}

/**
 * Assert the row's observation times are real clock readings in observation
 * order, never assembly-order offsets. A row whose mount reading is not after
 * its row start, or whose theme reading precedes the mount (or interaction
 * precedes the theme), is synthetic and fails closed. The one guard the
 * producer calls and the verifier-facing evidence reader drives.
 * @param {object} input observation times for the row
 * @param {number} input.rowStartedAtMs clock reading when the row began
 * @param {number} input.mount observedAtMs recorded for the mounted root
 * @param {number} input.theme observedAtMs recorded for the theme observation
 * @param {number} [input.interaction] observedAtMs recorded for the named interaction; a story row without an action records none
 * @returns {void}
 */
export function assertComponentObservationTimes(input) {
  const withInteraction = !!input && typeof input === 'object' && Object.hasOwn(input, 'interaction')
  const wanted = withInteraction ? ['rowStartedAtMs', 'mount', 'theme', 'interaction'] : ['rowStartedAtMs', 'mount', 'theme']
  valuesContract.assertExactFields(input, wanted, 'component producer', 'producer.observationTimes')
  const times = /** @type {Record<string, number>} */ (/** @type {unknown} */ (input))
  for (const key of wanted) {
    if (!Number.isInteger(times[key]) || times[key] < 0) {
      throw new Error(
        `component producer: invalid observation time ${JSON.stringify(times[key])} for field "${key}" at path producer.observationTimes.${key}; ` +
        'repair: record whole milliseconds since the epoch for every observed part.',
      )
    }
  }
  const { rowStartedAtMs, mount, theme } = times
  const interaction = withInteraction ? times.interaction : theme
  if (!(rowStartedAtMs < mount && mount <= theme && theme <= interaction)) {
    throw new Error(
      'component producer: observation times are not in observation order for field "observationTimes" at path producer.observationTimes; ' +
      `row ${rowStartedAtMs}, mount ${mount}, theme ${theme}, interaction ${interaction}; ` +
      'repair: read the clock at each observation instead of synthesizing offsets.',
    )
  }
}

/**
 * Assert the mounted-root ARIA snapshot clears the component measured floor.
 * The product's 50-character shell floor does not transfer; this reads the
 * component floor from the target registry. The one guard the producer calls
 * and the negative mutation suite drives.
 * @param {unknown} snapshot mounted-root aria snapshot text
 * @param {number} [floor] the story's measured floor, defaults to the disclosure story's
 * @returns {void}
 */
export function assertComponentAriaFloor(snapshot, floor = COMPONENT_MIN_ARIA_CHARS) {
  if (typeof snapshot !== 'string' || snapshot.trim().length < floor) {
    throw new Error(
      'component producer: empty ARIA snapshot for field "aria" at path evidence.aria; ' +
      `snapshot holds ${(typeof snapshot === 'string' ? snapshot.trim().length : 0)} characters, below the component floor ${floor}; ` +
      'repair: keep the mounted component expanded so its accessible tree is non-trivial.',
    )
  }
}

/**
 * Assert a mounted-root screenshot file clears the component measured byte
 * floor. The product's 8000-byte full-page floor does not transfer to an
 * element capture; this reads the component floor from the target registry.
 * The one guard the producer calls and the negative mutation suite drives.
 * @param {unknown} bytes screenshot byte count
 * @param {string} [path] screenshot path used in the diagnostic
 * @param {number} [floor] the story's measured floor, defaults to the disclosure story's
 * @returns {void}
 */
export function assertComponentScreenshotFloor(bytes, path = 'screenshot.png', floor = COMPONENT_MIN_SCREENSHOT_BYTES) {
  if (!Number.isInteger(bytes) || /** @type {number} */ (bytes) < floor) {
    throw new Error(
      'component producer: blank screenshot for field "screenshot" at path evidence.screenshot; ' +
      `wrote ${JSON.stringify(bytes)} bytes to ${JSON.stringify(path)}, below the component floor ${floor}; ` +
      'repair: keep the mounted component expanded and rendered so the capture is non-blank.',
    )
  }
}

/**
 * Read a row directory and refuse any entry outside the one shared six-class
 * artifact set. This is the closed-set reader: an extra class (an invented
 * seventh, a leftover scratch file) is a real defect the completeness guard
 * alone never saw, because a presence loop over the six cannot notice an
 * unexpected member. The returned set is the declared six, in declared order.
 * @param {string} rowDir row directory
 * @returns {readonly string[]} the frozen declared artifact class list
 */
export function readComponentArtifactSet(rowDir) {
  const entries = readdirSync(rowDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
  const unknown = entries.filter((name) => !COMPONENT_ARTIFACT_CLASSES.includes(name)).sort()
  if (unknown.length > 0) {
    throw new Error(
      `component producer: unknown artifact class ${JSON.stringify(unknown[0])} for field "artifact" at path artifactClasses; ` +
      `the row writes exactly ${JSON.stringify([...COMPONENT_ARTIFACT_CLASSES])}; ` +
      `repair: remove the extra artifact ${JSON.stringify(unknown[0])} from ${JSON.stringify(rowDir)} so one verifier reads the closed six-class set.`,
    )
  }
  return Object.freeze([...COMPONENT_ARTIFACT_CLASSES])
}

/**
 * Assert a row directory ends with the complete shared six-class artifact set
 * and nothing else. The closed-set reader refuses an extra class first, then
 * this loop refuses a missing one by name. The same set the product row writes,
 * so one verifier reads both kinds.
 * @param {string} rowDir row directory
 * @returns {void}
 */
export function assertComponentArtifactSet(rowDir) {
  readComponentArtifactSet(rowDir)
  for (const name of COMPONENT_ARTIFACT_CLASSES) {
    if (!existsSync(join(rowDir, name))) {
      throw new Error(
        `component producer: missing artifact ${JSON.stringify(name)} for field "artifact" at path run.rowDir/${name}; ` +
        'repair: keep the six artifact writes intact so every row ends with the complete set.',
      )
    }
  }
}

/**
 * Wait for a genuine mounted story root on the page and refuse a missing one
 * with the producer's own actionable diagnostic. Attachment is not a mount: the
 * static iframe ships an empty root, and a removed root never gains children.
 * This is the one mount-wait boundary the row calls and the real-DOM
 * root-state proof drives, so a regression in this failure branch is observed.
 * @param {import('@playwright/test').Page} page live page
 * @param {string} url direct iframe URL the page was sent to, used in the diagnostic
 * @param {number} [timeout] mount wait budget in ms, defaults to the component registry's budget
 * @returns {Promise<void>} resolves when real root children are present
 */
export async function requireComponentMountedRoot(page, url, timeout = COMPONENT_MOUNT_TIMEOUT_MS) {
  try {
    await page.waitForFunction(
      (selector) => {
        const root = document.querySelector(selector)
        return !!root && root.childElementCount > 0
      },
      COMPONENT_SELECTORS.root,
      { timeout },
    )
  } catch {
    throw new Error(
      `component producer: missing mounted root for field "root" at path proof.root; ` +
      `selector ${JSON.stringify(COMPONENT_SELECTORS.root)} never rendered children within ${timeout}ms at ${JSON.stringify(url)}; ` +
      'repair: rebuild storybook-static/ and keep the story root mounted with real children on the direct iframe target.',
    )
  }
}

/**
 * Record the Storybook render lifecycle phases in the page, from before any
 * story script runs. Installed as an init script, so it runs in the page and
 * references nothing outside its argument: it waits for the preview channel,
 * then appends every render phase the channel reports to one array the row
 * reads back.
 * @param {{ channelGlobal: string, event: string, recorderGlobal: string }} signal the declared render lifecycle signal
 * @returns {void}
 */
function recordComponentRenderPhases(signal) {
  const host = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis))
  const phases = /** @type {string[]} */ ([])
  host[signal.recorderGlobal] = phases
  const hook = () => {
    const channel = /** @type {{ on: (event: string, listener: (payload: { newPhase?: string }) => void) => void } | undefined} */ (host[signal.channelGlobal])
    if (!channel) {
      setTimeout(hook, 10)
      return
    }
    channel.on(signal.event, (event) => phases.push(String(event && event.newPhase)))
  }
  hook()
}

/**
 * Wait until the story's render lifecycle settles (its play function, when it
 * has one, has finished) and refuse a story whose lifecycle reported an error
 * phase on the way: a play function that threw leaves a mounted root behind,
 * so the root alone cannot tell a finished story from a broken one.
 * @param {import('@playwright/test').Page} page live page
 * @param {import('./fairtrade-component-target.mjs').ComponentStory} story story entry
 * @returns {Promise<string[]>} the recorded render phases
 */
async function requireComponentRenderSettled(page, story) {
  try {
    await page.waitForFunction(
      (signal) => {
        const phases = /** @type {string[] | undefined} */ ((/** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis)))[signal.recorderGlobal])
        return !!phases && (phases.includes(signal.settled) || phases.some((phase) => signal.errors.includes(phase)))
      },
      { recorderGlobal: COMPONENT_RENDER_PHASES.recorderGlobal, settled: COMPONENT_RENDER_PHASES.settled, errors: [...COMPONENT_RENDER_PHASES.errors] },
      { timeout: COMPONENT_MOUNT_TIMEOUT_MS },
    )
  } catch {
    throw new Error(
      `component producer: story ${JSON.stringify(story.storyId)} never finished rendering for field "renderPhases" at path proof.root; ` +
      `the ${JSON.stringify(COMPONENT_RENDER_PHASES.event)} channel reported no ${JSON.stringify(COMPONENT_RENDER_PHASES.settled)} phase within ${COMPONENT_MOUNT_TIMEOUT_MS}ms; ` +
      'repair: rebuild storybook-static/ and keep the story render and its play function terminating.',
    )
  }
  const phases = await page.evaluate((recorderGlobal) => [.../** @type {string[]} */ ((/** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis)))[recorderGlobal] || [])], COMPONENT_RENDER_PHASES.recorderGlobal)
  const errored = phases.filter((phase) => COMPONENT_RENDER_PHASES.errors.includes(phase))
  if (errored.length > 0) {
    throw new Error(
      `component producer: story ${JSON.stringify(story.storyId)} reported the render phase ${JSON.stringify(errored[0])} for field "renderPhases" at path proof.root; ` +
      `recorded phases ${JSON.stringify(phases)}; ` +
      'repair: fix the story or its play function so it renders without throwing; a mounted root left behind by a failed play is not a mounted story.',
    )
  }
  return phases
}

/**
 * One observed fact: its declared name, whether it held, and what was read.
 * @typedef {object} ComponentFactObservation
 * @property {string} name
 * @property {boolean} holds
 * @property {Record<string, unknown>} observed
 */

/**
 * Read one declared fact inside the story root through the runner's own
 * locators: the element a selector finds, or the element an accessible role
 * and name finds, then the declared count, selector match, attribute value,
 * text, texts, or focus. The fact holds when every declared part matches.
 * @param {import('@playwright/test').Page} page live page
 * @param {import('./fairtrade-component-target.mjs').ComponentExpectation} expectation declared fact
 * @returns {Promise<ComponentFactObservation>} the observation
 */
async function readComponentFact(page, expectation) {
  const root = page.locator(COMPONENT_SELECTORS.root)
  const role = expectation.role
  const found = role
    ? root.getByRole(/** @type {Parameters<import('@playwright/test').Locator['getByRole']>[0]} */ (role.role), { name: role.name, exact: role.exact !== false })
    : root.locator(/** @type {string} */ (expectation.selector))
  const count = await found.count()
  const first = found.first()
  /** @type {Record<string, unknown>} */
  const observed = { count }
  let holds = expectation.count === undefined || count === expectation.count
  const needsElement = expectation.matches !== undefined || expectation.attribute !== undefined || expectation.text !== undefined || expectation.focused !== undefined
  if (needsElement && count === 0) {
    return { name: expectation.name, holds: false, observed }
  }
  if (expectation.matches !== undefined) {
    observed.matches = await first.evaluate((element, selector) => element.matches(selector), expectation.matches)
    holds = holds && observed.matches === true
  }
  if (expectation.attribute !== undefined) {
    observed.value = await first.getAttribute(expectation.attribute)
    holds = holds && observed.value === expectation.value
  }
  if (expectation.text !== undefined) {
    observed.text = ((await first.textContent()) || '').trim()
    holds = holds && observed.text === expectation.text
  }
  if (expectation.texts !== undefined) {
    observed.texts = (await found.allTextContents()).map((text) => text.trim())
    holds = holds && JSON.stringify(observed.texts) === JSON.stringify([...expectation.texts])
  }
  if (expectation.focused !== undefined) {
    observed.focused = await first.evaluate((element) => element === element.ownerDocument.activeElement)
    holds = holds && observed.focused === expectation.focused
  }
  return { name: expectation.name, holds, observed }
}

/**
 * Wait for each declared fact in order, polling until it holds or the action
 * budget runs out, and refuse the row naming the first fact that never held,
 * what it declared, and what was read.
 * @param {import('@playwright/test').Page} page live page
 * @param {import('./fairtrade-component-target.mjs').ComponentStory} story story entry
 * @param {readonly import('./fairtrade-component-target.mjs').ComponentExpectation[]} expectations declared facts
 * @param {string} phase before or after, used in the record path
 * @returns {Promise<ComponentFactObservation[]>} the observations, in declared order
 */
async function requireComponentFacts(page, story, expectations, phase) {
  const observations = []
  for (const expectation of expectations) {
    const deadline = Date.now() + COMPONENT_ACTION_TIMEOUT_MS
    let reading = await readComponentFact(page, expectation)
    while (!reading.holds && Date.now() < deadline) {
      await page.waitForTimeout(50)
      reading = await readComponentFact(page, expectation)
    }
    if (!reading.holds) {
      const { name, ...declared } = expectation
      throw new Error(
        `component producer: story ${JSON.stringify(story.storyId)} fact ${JSON.stringify(name)} did not hold ${phase} the interaction for field "${phase}" at path record.facts.${phase}.${name}; ` +
        `declared ${JSON.stringify(declared)} observed ${JSON.stringify(reading.observed)}; ` +
        `repair: keep the story showing ${JSON.stringify(name)} as the story registry declares it, or re-measure the story and update its registry entry.`,
      )
    }
    observations.push(reading)
  }
  return observations
}

/**
 * Normalize a computed style or token value for comparison: one quote style
 * and one separator spacing.
 * @param {unknown} value raw value
 * @returns {string} the normalized value
 */
function normalizeComponentStyleValue(value) {
  return String(value ?? '').replace(/'/g, '"').replace(/\s*,\s*/g, ', ').trim()
}

/**
 * Read and assert a story's declared computed-style probes plus the two theme
 * tokens every story row records, refusing an unthemed or off-token value by
 * name.
 * @param {import('@playwright/test').Page} page live page
 * @param {import('./fairtrade-component-target.mjs').ComponentStory} story story entry
 * @returns {Promise<Record<string, string | null>>} the recorded computed styles
 */
async function requireComponentStyles(page, story) {
  const readings = await page.evaluate(({ root, probes }) => {
    const scope = document.querySelector(root)
    const rootStyle = getComputedStyle(document.documentElement)
    return {
      probes: probes.map((probe) => {
        const element = scope ? scope.querySelector(probe.selector) : null
        return {
          value: element ? String((/** @type {Record<string, unknown>} */ (/** @type {unknown} */ (getComputedStyle(element))))[probe.property]) : null,
          token: probe.token ? rootStyle.getPropertyValue(probe.token).trim() : null,
        }
      }),
      ink: (rootStyle.getPropertyValue('--ink') || '').trim(),
      canvas: (rootStyle.getPropertyValue('--canvas') || '').trim(),
    }
  }, { root: COMPONENT_SELECTORS.root, probes: story.computed.map((probe) => ({ selector: probe.selector, property: probe.property, token: probe.token ?? null })) })
  /** @type {Record<string, string | null>} */
  const computedStyles = {}
  story.computed.forEach((probe, index) => {
    const { value, token } = readings.probes[index]
    computedStyles[probe.name] = value
    const refuse = (/** @type {string} */ what) => {
      throw new Error(
        `component producer: story ${JSON.stringify(story.storyId)} ${what} for field "computedStyles.${probe.name}" at path evidence.computedStyles.${probe.name}; ` +
        `selector ${JSON.stringify(probe.selector)} resolved ${probe.property} ${JSON.stringify(value)}; ` +
        'repair: keep the mounted component themed by design tokens so the recorded computed styles are real.',
      )
    }
    if (!value) refuse('carries an unthemed computed style')
    if (probe.equals !== undefined && value !== probe.equals) refuse(`resolves a computed style other than ${JSON.stringify(probe.equals)}`)
    if (probe.includes !== undefined && !String(value).includes(probe.includes)) refuse(`resolves a computed style without ${JSON.stringify(probe.includes)}`)
    if (probe.token !== undefined && (!token || normalizeComponentStyleValue(value) !== normalizeComponentStyleValue(token))) refuse(`resolves a computed style other than the ${probe.token} token ${JSON.stringify(token)}`)
  })
  if (!readings.ink || !readings.canvas) {
    throw new Error(
      'component producer: unthemed computed tokens for field "computedStyles" at path evidence.computedStyles; ' +
      `resolved --ink ${JSON.stringify(readings.ink)} --canvas ${JSON.stringify(readings.canvas)}; ` +
      'repair: keep the mounted surface themed by design tokens so the resolved custom properties are non-empty.',
    )
  }
  return { ...computedStyles, ink: readings.ink, canvas: readings.canvas }
}

/**
 * Perform a story's one named action with trusted input: a click on the
 * declared target, or focus on the declared target and one key press.
 * @param {import('@playwright/test').Page} page live page
 * @param {import('./fairtrade-component-target.mjs').ComponentStory} story story entry
 * @param {NonNullable<import('./fairtrade-component-target.mjs').ComponentStory['action']>} action the named action
 * @returns {Promise<void>}
 */
async function performComponentAction(page, story, action) {
  const target = await readComponentFact(page, action.target)
  if (!target.holds) {
    throw new Error(
      `component producer: named interaction target is missing for field "interaction" at path proof.interaction; ` +
      `story ${JSON.stringify(story.storyId)} action ${JSON.stringify(action.name)} target ${JSON.stringify(action.target.name)} observed ${JSON.stringify(target.observed)}; ` +
      'repair: keep the action target rendered exactly once inside the story root.',
    )
  }
  const root = page.locator(COMPONENT_SELECTORS.root)
  const role = action.target.role
  const locator = (role
    ? root.getByRole(/** @type {Parameters<import('@playwright/test').Locator['getByRole']>[0]} */ (role.role), { name: role.name, exact: role.exact !== false })
    : root.locator(/** @type {string} */ (action.target.selector))).first()
  try {
    if (action.kind === 'key') {
      await locator.focus({ timeout: COMPONENT_ACTION_TIMEOUT_MS })
      await page.keyboard.press(action.key)
    } else {
      await locator.click({ timeout: COMPONENT_ACTION_TIMEOUT_MS })
    }
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `component producer: named interaction did not complete for field "interaction" at path proof.interaction; ` +
      `${action.kind} on ${JSON.stringify(action.target.name)} in story ${JSON.stringify(story.storyId)} failed: ${cause}; ` +
      'repair: keep the action target reachable and interactive in the mounted component.',
    )
  }
}

/**
 * Capture one component story row on the real built Storybook artifact and
 * write its six durable artifacts. The page must already belong to a browser
 * owned by the Playwright runner; the loopback service must already be ready.
 *
 * Row sequence: serve the direct iframe, wait for real root children and for
 * the render lifecycle to settle, prove the mount for the story's layout,
 * observe the normalized theme, wait for the declared before-facts, read the
 * declared computed styles, perform the one named action when the story has
 * one, wait for the declared after-facts, apply the story's measured floors,
 * then read the gate tie, capture the root, snapshot its ARIA tree, run the
 * scoped serious-violations scan, and read the tie again, so the receipt is
 * tied to the state the scan saw.
 * @param {import('@playwright/test').Page} page Playwright page for the row
 * @param {string} theme dark or light row theme
 * @param {object} [options] row options
 * @param {string} [options.runRoot] immutable run root (defaults to FAIRTEST_RUN_ROOT)
 * @param {string} [options.baseUrl] running loopback base URL
 * @param {number} [options.createdAtMs] identity creation time in whole ms
 * @param {import('./fairtrade-component-target.mjs').ComponentStory} [options.story] registered story entry, defaults to the disclosure story
 * @returns {Promise<object>} row summary with proof, provenance, accessibility evidence and its verdict, observation times, the recorded root measurement, and artifact paths
 */
export async function captureComponentRow(page, theme, options = {}) {
  if (!ROW_THEMES.includes(theme)) {
    throw new Error(
      `component producer: unknown row theme ${JSON.stringify(theme)} for field "theme" at path row.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  const story = options.story ?? COMPONENT_DEFAULT_STORY
  const runRoot = resolve(options.runRoot ?? resolveComponentRunRoot())
  const baseUrl = options.baseUrl || `http://${FAIRTEST_APP_HOST}:${FAIRTEST_STORYBOOK_PORT}`
  const createdAtMs = options.createdAtMs ?? Date.now()
  if (!Number.isInteger(createdAtMs) || createdAtMs < 0) {
    throw new Error(
      `component producer: invalid creation time ${JSON.stringify(createdAtMs)} for field "createdAtMs" at path row.createdAtMs; ` +
      'repair: use whole milliseconds since the epoch for "createdAtMs".',
    )
  }
  const setup = componentThemeSetup(theme, story)
  requireEnvelopeForRun(runRoot, resolveRunId(), 'component producer')
  const { rowDir } = prepareComponentRowDir({ runRoot, theme, story })
  if (!existsSync(join(STORYBOOK_ROOT, 'iframe.html'))) {
    throw new Error(
      'component producer: built Storybook artifact is missing for field "storybook" at path row.storybook; ' +
      `looked for ${JSON.stringify(join(STORYBOOK_ROOT, 'iframe.html'))}; ` +
      'repair: run pnpm build-storybook before the mounted component row so storybook-static/ holds the exact built story.',
    )
  }

  const rowStartedAtMs = Date.now()
  await page.setViewportSize({ ...PRODUCT_VIEWPORT })
  await page.addInitScript(recordComponentRenderPhases, {
    channelGlobal: COMPONENT_RENDER_PHASES.channelGlobal,
    event: COMPONENT_RENDER_PHASES.event,
    recorderGlobal: COMPONENT_RENDER_PHASES.recorderGlobal,
  })
  const url = `${baseUrl}${setup.url}`
  await page.goto(url, { waitUntil: 'networkidle' })

  // Wait for real children in the story root. Attachment is not a mount: the
  // static iframe ships an empty #storybook-root. Then wait for the render
  // lifecycle to settle, so a play function has finished before any reading.
  await requireComponentMountedRoot(page, url)
  const renderPhases = await requireComponentRenderSettled(page, story)

  const observedBefore = await page.evaluate((selectors) => {
    const root = document.querySelector(selectors.root)
    const errEl = document.querySelector(selectors.errorDisplay)
    const stack = document.querySelector(selectors.errorStack)
    return {
      rootChildCount: root ? root.childElementCount : 0,
      bodyClass: document.body.className,
      errorDisplay: errEl ? getComputedStyle(errEl).display : 'none',
      errorStackText: ((stack ? stack.textContent : '') || '').trim(),
      rawTheme: document.documentElement.getAttribute('data-theme'),
    }
  }, COMPONENT_SELECTORS)

  const mounted = assertComponentMounted({
    rootChildCount: observedBefore.rootChildCount,
    bodyClass: observedBefore.bodyClass,
    errorDisplay: observedBefore.errorDisplay,
    errorStackText: observedBefore.errorStackText,
  }, COMPONENT_LAYOUT_BODY_CLASSES[story.layout])
  const mountObservedAtMs = Date.now()

  const themeObservation = observeProductTheme({
    expected: theme,
    renderedAttribute: observedBefore.rawTheme,
    source: 'component-producer:documentElement:data-theme',
    observedAtMs: Date.now(),
  })
  assertProductThemeObservation(themeObservation)
  kindsContract.validateThemeObservation(themeObservation, 'component producer')
  const themeObservedAtMs = themeObservation.observedAtMs

  const factsBefore = await requireComponentFacts(page, story, story.before, 'before')
  const computedStyles = await requireComponentStyles(page, story)

  if (story.action) {
    await performComponentAction(page, story, story.action)
  }
  const factsAfter = await requireComponentFacts(page, story, story.after, 'after')

  const observedAfter = await page.evaluate((selectors) => {
    const root = document.querySelector(selectors.root)
    const rect = root ? root.getBoundingClientRect() : null
    return {
      descendants: root ? root.querySelectorAll('*').length : -1,
      textLength: root ? (root.textContent || '').trim().length : -1,
      box: rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null,
    }
  }, COMPONENT_SELECTORS)
  const moment = story.action ? 'after the interaction' : 'after the mount'
  if (observedAfter.descendants < story.floors.descendants) {
    throw new Error(
      `component producer: blank mounted component for field "root" at path proof.root; ` +
      `the mounted root holds ${observedAfter.descendants} descendants ${moment}, below the component floor ${story.floors.descendants}; ` +
      'repair: keep the mounted component non-blank so the root carries real descendants.',
    )
  }
  if (observedAfter.textLength < story.floors.textLength) {
    throw new Error(
      `component producer: blank mounted component for field "root" at path proof.root; ` +
      `the mounted root holds ${observedAfter.textLength} text characters ${moment}, below the component floor ${story.floors.textLength}; ` +
      'repair: keep the mounted component non-blank so the root carries real text.',
    )
  }
  if (!observedAfter.box || observedAfter.box.width <= 0 || observedAfter.box.height <= 0) {
    throw new Error(
      `component producer: unrendered mounted root for field "root" at path proof.root; box ${JSON.stringify(observedAfter.box)}; ` +
      'repair: keep the mounted component laid out with a rendered box.',
    )
  }

  const interactionObservedAtMs = Date.now()
  assertComponentObservationTimes(story.action
    ? { rowStartedAtMs, mount: mountObservedAtMs, theme: themeObservedAtMs, interaction: interactionObservedAtMs }
    : { rowStartedAtMs, mount: mountObservedAtMs, theme: themeObservedAtMs })

  // The capture, the snapshot, and the gated scan all belong to the state the
  // after-facts proved, so the tie is read on both sides of them: a state that
  // ends before the scan finishes is refused instead of recorded.
  const tieBefore = await readComponentFact(page, story.gateTie.expectation)
  const screenshotPath = join(rowDir, 'screenshot.png')
  await page.locator(COMPONENT_SELECTORS.root).screenshot({ path: screenshotPath })
  const ariaSnapshot = await page.locator(COMPONENT_SELECTORS.root).ariaSnapshot()
  const scopedAfter = await scanAxe(page, { root: COMPONENT_SELECTORS.root })
  assertComponentAxeScanShape(scopedAfter, 'evidence.axe.scopedAfter')
  const tieAfter = await readComponentFact(page, story.gateTie.expectation)
  if (!tieBefore.holds || !tieAfter.holds) {
    throw new Error(
      `component producer: story ${JSON.stringify(story.storyId)} left the ${JSON.stringify(story.gateTie.expectation.name)} state during the evidence capture for field ${JSON.stringify(story.gateTie.field)} at path record.accessibility.gate.${story.gateTie.field}; ` +
      `observed ${JSON.stringify(tieBefore.observed)} before and ${JSON.stringify(tieAfter.observed)} after the capture; ` +
      'repair: keep the proven state stable for the capture, the snapshot, and the scan.',
    )
  }
  const pageWide = await scanAxe(page)
  assertComponentAxeScanShape(pageWide, 'evidence.axe.pageWide')
  const gate = buildComponentGateReceipt({ scan: scopedAfter, observedTheme: themeObservation.observed, story, tie: tieAfter.holds })

  assertComponentAriaFloor(ariaSnapshot, story.floors.ariaChars)
  assertComponentScreenshotFloor(statSync(screenshotPath).size, screenshotPath, story.floors.screenshotBytes)

  const accessibility = buildComponentAccessibilityEvidence({ pageWide, scoped: scopedAfter, gate })
  const accessibilityVerdict = readComponentAccessibilityVerdict(accessibility, story)
  if (accessibilityVerdict.result !== 'pass') {
    throw new Error(
      `component producer: accessibility verdict reads ${JSON.stringify(accessibilityVerdict.result)} for field "accessibility" at path record.accessibility.gate; ` +
      `the scoped scan over ${JSON.stringify(COMPONENT_SELECTORS.root)} in story ${JSON.stringify(story.storyId)} reports ${gate.measured} violations: ${JSON.stringify(seriousViolations(scopedAfter).map((/** @type {{ id: string, impact: string | null, nodes: unknown }} */ entry) => `${entry.id} (${entry.impact}) at ${JSON.stringify(entry.nodes)}`))}; ` +
      'repair: fix the scoped component violation instead of relying on the informational page-wide census.',
    )
  }

  const proof = buildComponentProof({
    rowTheme: theme,
    identity: { kind: 'component', id: story.targetId, createdAtMs },
    root: { mounted: true, observedAtMs: mountObservedAtMs },
    themeObservation: { ...themeObservation },
    ...(story.action ? { interaction: { name: story.action.name, completed: true, observedAtMs: interactionObservedAtMs } } : {}),
  })

  const servedHtml = await fetchText(`${baseUrl}/iframe.html`)
  const provenance = await collectComponentProvenance({
    baseUrl,
    servedHtml,
    viewport: { ...PRODUCT_VIEWPORT },
    targetIdentity: { kind: 'component', id: story.targetId, createdAtMs },
    themeObservations: [{ ...themeObservation }],
    storyId: story.storyId,
  })

  const record = {
    target: story.targetId,
    story: story.key,
    kind: 'component',
    rowTheme: theme,
    storyId: story.storyId,
    url: setup.url,
    root: {
      selector: COMPONENT_SELECTORS.root,
      children: observedBefore.rootChildCount,
      descendants: observedAfter.descendants,
      textLength: observedAfter.textLength,
      box: observedAfter.box,
    },
    renderPhases: [...renderPhases],
    interaction: story.action
      ? { name: story.action.name, kind: story.action.kind, completed: true, observedAtMs: interactionObservedAtMs }
      : null,
    facts: {
      before: factsBefore.map((entry) => ({ name: entry.name, observed: entry.observed })),
      after: factsAfter.map((entry) => ({ name: entry.name, observed: entry.observed })),
    },
    theme: { ...themeObservation },
    computedStyles,
    viewport: { ...PRODUCT_VIEWPORT },
    accessibility,
    producedAtMs: Date.now(),
  }

  // A component record must never claim the product-only shell fields. This is
  // the app-owned half of the shared cross-kind contract; the shared resolver
  // is the other half and both must stay true. The list comes from the shared
  // contract through fairtest-artifacts.mjs, never re-spelled here.
  for (const productOnly of PRODUCT_ONLY_FIELDS) {
    if (productOnly in record) {
      throw new Error(
        `component producer: component record claims the product-only field ${JSON.stringify(productOnly)} for field "${productOnly}" at path record.${productOnly}; ` +
        'repair: keep the component record to the component proof fields only.',
      )
    }
  }

  writeFileSync(join(rowDir, 'record.json'), `${JSON.stringify(record, null, 2)}\n`)
  writeFileSync(join(rowDir, 'aria.json'), `${JSON.stringify({ target: story.targetId, rowTheme: theme, storyId: story.storyId, snapshot: ariaSnapshot }, null, 2)}\n`)
  writeFileSync(join(rowDir, 'axe.json'), `${JSON.stringify({ target: story.targetId, rowTheme: theme, policy: COMPONENT_A11Y_POLICY, scopeRoot: COMPONENT_SELECTORS.root, gate: { ...gate }, pageWide: { scope: COMPONENT_A11Y_SCOPES.page, root: COMPONENT_A11Y_SCOPES.pageRoot, informational: true, ...pageWide } }, null, 2)}\n`)
  writeFileSync(join(rowDir, 'provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`)
  writeFileSync(join(rowDir, 'resolution.json'), `${JSON.stringify(proof, null, 2)}\n`)

  assertComponentArtifactSet(rowDir)

  return {
    theme,
    story: story.key,
    rowDir,
    proof,
    provenance,
    accessibility,
    accessibilityVerdict,
    mounted,
    root: {
      children: observedBefore.rootChildCount,
      descendants: observedAfter.descendants,
      textLength: observedAfter.textLength,
      box: observedAfter.box,
    },
    observationTimes: Object.freeze({
      rowStartedAtMs,
      mount: mountObservedAtMs,
      theme: themeObservedAtMs,
      interaction: interactionObservedAtMs,
    }),
    artifacts: COMPONENT_ARTIFACT_CLASSES.map((name) => join(rowDir, name)),
  }
}

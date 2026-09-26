// Fairtrade-owned mounted component producer: browser-bearing host runtime and
// durable artifact writer for the built Storybook story target.
//
// This module never invents selectors, theme semantics, or proof vocabulary.
// Every one of those comes from fairtrade-component-target.mjs (app-owned
// component registry), from fairtest-runtime.mjs (the single loopback owner
// this module and the runner config read), and from the shared host contract
// through the sole source route. It writes exactly the SAME six artifact class
// names the product row writes, from the one shared constant in
// fairtest-artifacts.mjs (which product-producer.mjs only re-exports), into a
// `producer/component-<theme>/` row directory so one verifier reads both kinds
// with one closed set.
//
// Row sequence per theme (dark, light): serve the direct iframe, wait for a
// genuine mount (real root children, the ready-state body classes, a hidden
// error display, and an empty error stack), observe the normalized theme,
// perform ONE trusted click on the disclosure control, verify the expanded
// count/rows/ARIA and the computed tokens, run a plain serious-violations axe
// gate, snapshot the ARIA tree, capture the mounted root, and collect the
// iframe.html served-build provenance.
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
import { FAIRTEST_APP_HOST, FAIRTEST_REPO_ROOT, FAIRTEST_STORYBOOK_PORT, PRODUCT_VIEWPORT } from './fairtest-runtime.mjs'
import { assertProductThemeObservation, observeProductTheme } from './fairtrade-targets.mjs'
import { AXE_RESULT_FIELDS, scanAxe, seriousViolations } from '../journey/lib/assertions.mjs'
import {
  COMPONENT_A11Y_GATE_RECEIPT_FIELDS,
  COMPONENT_A11Y_POINTS,
  COMPONENT_A11Y_POLICY,
  COMPONENT_ACTION_NAME,
  COMPONENT_ACTION_TIMEOUT_MS,
  COMPONENT_COLLAPSED_LABEL,
  COMPONENT_MIN_ARIA_CHARS,
  COMPONENT_MIN_ROOT_DESCENDANTS,
  COMPONENT_MIN_ROOT_TEXT_LENGTH,
  COMPONENT_MIN_SCREENSHOT_BYTES,
  COMPONENT_MOUNT_TIMEOUT_MS,
  COMPONENT_PROVENANCE_SOURCE,
  COMPONENT_ROW_COUNT,
  COMPONENT_ROW_TEXTS,
  COMPONENT_SELECTORS,
  COMPONENT_STORY_ID,
  COMPONENT_TARGET_ID,
  assertComponentMounted,
  buildComponentProof,
  componentThemeSetup,
} from './fairtrade-component-target.mjs'
import { ARTIFACT_CLASSES, PRODUCT_ONLY_FIELDS, assertServedDigestsMatchRunRoot } from './fairtest-artifacts.mjs'
import { requireEnvelopeForRun, resolveRunId, resolveRunRoot } from './run-envelope-contract.mjs'

const kindsContract = await importFairtestSource('src/host-contract/kinds.mjs')
const valuesContract = await importFairtestSource('src/core/values.mjs')

const ROW_THEMES = Object.freeze(['dark', 'light'])
const STORYBOOK_ROOT = join(FAIRTEST_REPO_ROOT, 'storybook-static')

/**
 * The six durable artifact classes a component row writes. It is the SAME
 * constant the product row writes, re-declared under the component name so a
 * consumer of the component module reads the one shared set rather than a
 * second six-element literal.
 * @type {string[]}
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
 * @type {string[]}
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
 * @type {string[]}
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
 * Row directory for a component theme row inside a run root.
 * @param {string} runRoot immutable run root
 * @param {string} theme dark or light row theme
 * @returns {string} the row directory path
 */
export function componentRowDir(runRoot, theme) {
  if (!ROW_THEMES.includes(theme)) {
    throw new Error(
      `component producer: unknown row theme ${JSON.stringify(theme)} for field "theme" at path row.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  return join(runRoot, 'producer', `component-${theme}`)
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
 * @returns {{ runRoot: string, rowDir: string }} the prepared paths for the row
 */
export function prepareComponentRowDir(input = {}) {
  valuesContract.assertExactFields(input, ['runRoot', 'theme'], 'component producer', 'producer.rowPreparation')
  const { runRoot, theme } = /** @type {Record<string, string>} */ (input)
  const rowDir = componentRowDir(runRoot, theme)
  refuseStaleComponentSubtree(rowDir)
  mkdirSync(rowDir, { recursive: true })
  return Object.freeze({ runRoot: resolve(runRoot), rowDir })
}

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
 * @returns {object} the injected lifecycle driver for createFairtradeAdapter
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
      server.on('error', responseReject)
      server.listen(port, host, () => {
        server.removeListener('error', responseReject)
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
      const chunks = []
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
 * @param {object} scan compact scoped scan report
 * @returns {{ violations: number, ids: string[], incomplete: string[], passes: number }} the scoped summary
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
 * Build the plain serious-violations gate receipt for the mounted component
 * scope. There is no baseline and no delta: the receipt is a pass exactly when
 * the scoped scan reports no serious or critical violation. `observedTheme` and
 * `ariaExpanded` are the observed ties to the moment the scan was taken.
 * @param {object} input receipt inputs
 * @param {object} input.scan compact scoped scan report
 * @param {string} input.observedTheme theme the page rendered when the scan ran
 * @param {boolean} input.ariaExpanded expanded state the click left
 * @returns {object} the frozen gate receipt
 */
function buildComponentGateReceipt({ scan, observedTheme, ariaExpanded } = {}) {
  valuesContract.assertExactFields({ scan, observedTheme, ariaExpanded }, ['scan', 'observedTheme', 'ariaExpanded'], 'component producer', 'a11y.gate')
  const serious = seriousViolations(scan)
  return Object.freeze({
    policy: COMPONENT_A11Y_POLICY,
    point: COMPONENT_A11Y_POINTS[0],
    observedTheme,
    ariaExpanded,
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
export function buildComponentAccessibilityEvidence(input = {}) {
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
      blockingIds: blocking.map((entry) => entry.id),
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
 * @returns {{ policy: string, gatedScope: string, scopeRoot: string, result: string, gate: object }} the frozen verdict read from the gate receipt
 */
export function readComponentAccessibilityVerdict(accessibility) {
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
  valuesContract.assertExactFields(receipt, COMPONENT_A11Y_GATE_RECEIPT_FIELDS, 'component producer', 'record.accessibility.gate')
  if (receipt.policy !== COMPONENT_A11Y_POLICY) {
    throw new Error(
      `component producer: foreign gate receipt policy ${JSON.stringify(receipt.policy)} for field "policy" at path record.accessibility.gate.policy; ` +
      `repair: record the policy the gate actually ran under for "policy".`,
    )
  }
  if (receipt.point !== COMPONENT_A11Y_POINTS[0]) {
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
  if (receipt.ariaExpanded !== true) {
    throw new Error(
      `component producer: accessibility scan was not taken on the expanded disclosure for field "ariaExpanded" at path record.accessibility.gate.ariaExpanded; ` +
      `got ${JSON.stringify(receipt.ariaExpanded)}; ` +
      'repair: scan the component after the disclosure expands.',
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
export async function collectComponentServedAssets({ baseUrl, servedHtml, label = 'component producer' } = {}) {
  const assetDigests = {}
  assetDigests['iframe.html'] = sha256(servedHtml)
  const refs = resolveComponentProvenanceRefs(servedHtml)
  if (refs.length === 0) {
    throw new Error(
      `${label}: served iframe.html references no asset files for field "assetDigests" at path provenance.assetDigests; ` +
      'repair: rebuild storybook-static/ with pnpm build-storybook so the served iframe references its hashed asset bundle.',
    )
  }
  for (const ref of refs) {
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
 * @returns {Promise<object>} the provenance record
 */
async function collectComponentProvenance({ baseUrl, servedHtml, viewport, targetIdentity, themeObservations }) {
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
    storyId: COMPONENT_STORY_ID,
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
 * @param {number} input.interaction observedAtMs recorded for the named interaction
 * @returns {void}
 */
export function assertComponentObservationTimes(input = {}) {
  valuesContract.assertExactFields(input, ['rowStartedAtMs', 'mount', 'theme', 'interaction'], 'component producer', 'producer.observationTimes')
  const times = /** @type {Record<string, number>} */ (/** @type {unknown} */ (input))
  for (const key of ['rowStartedAtMs', 'mount', 'theme', 'interaction']) {
    if (!Number.isInteger(times[key]) || times[key] < 0) {
      throw new Error(
        `component producer: invalid observation time ${JSON.stringify(times[key])} for field "${key}" at path producer.observationTimes.${key}; ` +
        'repair: record whole milliseconds since the epoch for every observed part.',
      )
    }
  }
  const { rowStartedAtMs, mount, theme, interaction } = times
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
 * @returns {void}
 */
export function assertComponentAriaFloor(snapshot) {
  if (typeof snapshot !== 'string' || snapshot.trim().length < COMPONENT_MIN_ARIA_CHARS) {
    throw new Error(
      'component producer: empty ARIA snapshot for field "aria" at path evidence.aria; ' +
      `snapshot holds ${(typeof snapshot === 'string' ? snapshot.trim().length : 0)} characters, below the component floor ${COMPONENT_MIN_ARIA_CHARS}; ` +
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
 * @returns {void}
 */
export function assertComponentScreenshotFloor(bytes, path = 'screenshot.png') {
  if (!Number.isInteger(bytes) || bytes < COMPONENT_MIN_SCREENSHOT_BYTES) {
    throw new Error(
      'component producer: blank screenshot for field "screenshot" at path evidence.screenshot; ' +
      `wrote ${JSON.stringify(bytes)} bytes to ${JSON.stringify(path)}, below the component floor ${COMPONENT_MIN_SCREENSHOT_BYTES}; ` +
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
 * @returns {string[]} the frozen declared artifact class list
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
 * Capture one component theme row on the real built Storybook artifact and
 * write its six durable artifacts. The page must already belong to a browser
 * owned by the Playwright runner; the loopback service must already be ready.
 * @param {import('@playwright/test').Page} page Playwright page for the row
 * @param {string} theme dark or light row theme
 * @param {object} [options] row options
 * @param {string} [options.runRoot] immutable run root (defaults to FAIRTEST_RUN_ROOT)
 * @param {string} [options.baseUrl] running loopback base URL
 * @param {number} [options.createdAtMs] identity creation time in whole ms
 * @returns {Promise<object>} row summary with proof, provenance, accessibility evidence and its verdict, observation times, the recorded root measurement, and artifact paths
 */
export async function captureComponentRow(page, theme, options = {}) {
  if (!ROW_THEMES.includes(theme)) {
    throw new Error(
      `component producer: unknown row theme ${JSON.stringify(theme)} for field "theme" at path row.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  const runRoot = resolve(options.runRoot ?? resolveComponentRunRoot())
  const baseUrl = options.baseUrl || `http://${FAIRTEST_APP_HOST}:${FAIRTEST_STORYBOOK_PORT}`
  const createdAtMs = options.createdAtMs ?? Date.now()
  if (!Number.isInteger(createdAtMs) || createdAtMs < 0) {
    throw new Error(
      `component producer: invalid creation time ${JSON.stringify(createdAtMs)} for field "createdAtMs" at path row.createdAtMs; ` +
      'repair: use whole milliseconds since the epoch for "createdAtMs".',
    )
  }
  const setup = componentThemeSetup(theme)
  requireEnvelopeForRun(runRoot, resolveRunId(), 'component producer')
  const { rowDir } = prepareComponentRowDir({ runRoot, theme })
  if (!existsSync(join(STORYBOOK_ROOT, 'iframe.html'))) {
    throw new Error(
      'component producer: built Storybook artifact is missing for field "storybook" at path row.storybook; ' +
      `looked for ${JSON.stringify(join(STORYBOOK_ROOT, 'iframe.html'))}; ` +
      'repair: run pnpm build-storybook before the mounted component row so storybook-static/ holds the exact built story.',
    )
  }

  const rowStartedAtMs = Date.now()
  await page.setViewportSize({ ...PRODUCT_VIEWPORT })
  const url = `${baseUrl}${setup.url}`
  await page.goto(url, { waitUntil: 'networkidle' })

  // Wait for real children in the story root. Attachment is not a mount: the
  // static iframe ships an empty #storybook-root.
  await requireComponentMountedRoot(page, url)

  const observedBefore = await page.evaluate((selectors) => {
    const root = document.querySelector(selectors.root)
    const errEl = document.querySelector(selectors.errorDisplay)
    const stack = document.querySelector(selectors.errorStack)
    const trigger = document.querySelector(selectors.trigger)
    const toggle = document.querySelector(selectors.toggle)
    const label = document.querySelector(selectors.label)
    const style = trigger ? getComputedStyle(trigger) : null
    const countStyle = document.querySelector(selectors.count)
    return {
      rootChildCount: root ? root.childElementCount : 0,
      bodyClass: document.body.className,
      errorDisplay: errEl ? getComputedStyle(errEl).display : 'none',
      errorStackText: ((stack ? stack.textContent : '') || '').trim(),
      rawTheme: document.documentElement.getAttribute('data-theme'),
      ariaExpanded: toggle ? toggle.getAttribute('aria-expanded') : null,
      labelText: label ? (label.textContent || '').trim() : null,
      rowsPresent: !!document.querySelector(selectors.rows),
      computed: {
        fontFamily: style ? style.fontFamily : null,
        fontSize: style ? style.fontSize : null,
        borderRadius: style ? style.borderRadius : null,
        minHeight: style ? style.minHeight : null,
      },
      tokenInk: (getComputedStyle(document.documentElement).getPropertyValue('--ink') || '').trim(),
      tokenCanvas: (getComputedStyle(document.documentElement).getPropertyValue('--canvas') || '').trim(),
      tabularNumbers: countStyle ? getComputedStyle(countStyle).fontVariantNumeric : null,
    }
  }, COMPONENT_SELECTORS)

  const mounted = assertComponentMounted({
    rootChildCount: observedBefore.rootChildCount,
    bodyClass: observedBefore.bodyClass,
    errorDisplay: observedBefore.errorDisplay,
    errorStackText: observedBefore.errorStackText,
  })
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

  if (observedBefore.ariaExpanded !== 'false' || observedBefore.rowsPresent) {
    throw new Error(
      `component producer: disclosure did not start collapsed for field "interaction" at path proof.interaction; ` +
      `aria-expanded ${JSON.stringify(observedBefore.ariaExpanded)} and rows present ${JSON.stringify(observedBefore.rowsPresent)}; ` +
      'repair: keep the story collapsed before the named interaction and render the rows only while expanded.',
    )
  }
  if (observedBefore.labelText !== COMPONENT_COLLAPSED_LABEL) {
    throw new Error(
      `component producer: unexpected collapsed label ${JSON.stringify(observedBefore.labelText)} for field "label" at path proof.interaction; ` +
      `repair: keep ${JSON.stringify(COMPONENT_COLLAPSED_LABEL)} on the collapsed control.`,
    )
  }
  if (!observedBefore.computed.fontFamily || !observedBefore.computed.fontSize || !observedBefore.computed.borderRadius || !observedBefore.computed.minHeight) {
    throw new Error(
      'component producer: unthemed computed tokens for field "computedStyles" at path evidence.computedStyles; ' +
      `resolved fontFamily ${JSON.stringify(observedBefore.computed.fontFamily)} fontSize ${JSON.stringify(observedBefore.computed.fontSize)} radius ${JSON.stringify(observedBefore.computed.borderRadius)} minHeight ${JSON.stringify(observedBefore.computed.minHeight)}; ` +
      'repair: keep the mounted component themed by design tokens so the resolved computed styles are non-empty.',
    )
  }
  if (!observedBefore.tokenInk || !observedBefore.tokenCanvas) {
    throw new Error(
      'component producer: unthemed computed tokens for field "computedStyles" at path evidence.computedStyles; ' +
      `resolved --ink ${JSON.stringify(observedBefore.tokenInk)} --canvas ${JSON.stringify(observedBefore.tokenCanvas)}; ` +
      'repair: keep the mounted surface themed by design tokens so the resolved custom properties are non-empty.',
    )
  }
  // Tabular numbers on counts are a design-system invariant the record carries.
  // Asserting it here means a drift in the count selector (which would null the
  // reading) or a dropped tabular rule fails the row instead of shipping a
  // blank token field under a green run.
  if (typeof observedBefore.tabularNumbers !== 'string' || !observedBefore.tabularNumbers.includes('tabular-nums')) {
    throw new Error(
      'component producer: non-tabular count for field "computedStyles.fontVariantNumeric" at path evidence.computedStyles.fontVariantNumeric; ' +
      `selector ${JSON.stringify(COMPONENT_SELECTORS.count)} resolved font-variant-numeric ${JSON.stringify(observedBefore.tabularNumbers)}; ` +
      'repair: keep the count element tabular so counts align and the recorded token evidence is real.',
    )
  }

  const toggle = page.locator(COMPONENT_SELECTORS.toggle)
  try {
    await toggle.first().click({ timeout: COMPONENT_ACTION_TIMEOUT_MS })
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `component producer: named interaction did not complete for field "interaction" at path proof.interaction; ` +
      `click on ${JSON.stringify(COMPONENT_SELECTORS.toggle)} failed: ${cause}; ` +
      'repair: keep the disclosure toggle clickable in the mounted component.',
    )
  }
  try {
    await page.waitForFunction(
      (toggleSelector) => {
        const el = document.querySelector(toggleSelector)
        return !!el && el.getAttribute('aria-expanded') === 'true'
      },
      COMPONENT_SELECTORS.toggle,
      { timeout: COMPONENT_ACTION_TIMEOUT_MS },
    )
  } catch {
    throw new Error(
      `component producer: disclosure did not expand for field "interaction" at path proof.interaction; ` +
      'repair: the named interaction must flip aria-expanded to true on the toggle.',
    )
  }

  const observedAfter = await page.evaluate((selectors) => {
    const root = document.querySelector(selectors.root)
    const toggle = document.querySelector(selectors.toggle)
    const rows = document.querySelector(selectors.rows)
    const rowTexts = rows ? [...document.querySelectorAll(selectors.rowItem)].map((item) => (item.textContent || '').trim()) : []
    const rect = root ? root.getBoundingClientRect() : null
    return {
      ariaExpanded: toggle ? toggle.getAttribute('aria-expanded') : null,
      rowsPresent: !!rows,
      rowCount: rowTexts.length,
      rowTexts,
      descendants: root ? root.querySelectorAll('*').length : -1,
      textLength: root ? (root.textContent || '').trim().length : -1,
      box: rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null,
    }
  }, COMPONENT_SELECTORS)

  if (observedAfter.ariaExpanded !== 'true') {
    throw new Error(
      `component producer: aria wiring did not flip for field "interaction" at path proof.interaction; aria-expanded is ${JSON.stringify(observedAfter.ariaExpanded)}; ` +
      'repair: the named interaction must leave the toggle expanded.',
    )
  }
  if (!observedAfter.rowsPresent) {
    throw new Error(
      `component producer: revealed rows are absent for field "interaction" at path proof.interaction; selector ${JSON.stringify(COMPONENT_SELECTORS.rows)} is missing after the interaction; ` +
      'repair: render the rows while expanded under the declared rows id.',
    )
  }
  if (observedAfter.rowCount !== COMPONENT_ROW_COUNT || JSON.stringify(observedAfter.rowTexts) !== JSON.stringify([...COMPONENT_ROW_TEXTS])) {
    throw new Error(
      `component producer: revealed rows drifted for field "interaction" at path proof.interaction; ` +
      `observed ${observedAfter.rowCount} rows ${JSON.stringify(observedAfter.rowTexts)}; expected ${COMPONENT_ROW_COUNT} rows ${JSON.stringify([...COMPONENT_ROW_TEXTS])}; ` +
      'repair: keep the disclosed rows exactly as the component declares them.',
    )
  }
  if (observedAfter.descendants < COMPONENT_MIN_ROOT_DESCENDANTS) {
    throw new Error(
      `component producer: blank mounted component for field "root" at path proof.root; ` +
      `the mounted root holds ${observedAfter.descendants} descendants after the interaction, below the component floor ${COMPONENT_MIN_ROOT_DESCENDANTS}; ` +
      'repair: keep the mounted component non-blank so the root carries real descendants.',
    )
  }
  if (observedAfter.textLength < COMPONENT_MIN_ROOT_TEXT_LENGTH) {
    throw new Error(
      `component producer: blank mounted component for field "root" at path proof.root; ` +
      `the mounted root holds ${observedAfter.textLength} text characters after the interaction, below the component floor ${COMPONENT_MIN_ROOT_TEXT_LENGTH}; ` +
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
  assertComponentObservationTimes({ rowStartedAtMs, mount: mountObservedAtMs, theme: themeObservedAtMs, interaction: interactionObservedAtMs })

  const scopedAfter = await scanAxe(page, { root: COMPONENT_SELECTORS.root })
  assertComponentAxeScanShape(scopedAfter, 'evidence.axe.scopedAfter')
  const pageWide = await scanAxe(page)
  assertComponentAxeScanShape(pageWide, 'evidence.axe.pageWide')
  const gate = buildComponentGateReceipt({ scan: scopedAfter, observedTheme: themeObservation.observed, ariaExpanded: observedAfter.ariaExpanded === 'true' })

  const ariaSnapshot = await page.locator(COMPONENT_SELECTORS.root).ariaSnapshot()
  assertComponentAriaFloor(ariaSnapshot)

  const screenshotPath = join(rowDir, 'screenshot.png')
  await page.locator(COMPONENT_SELECTORS.root).screenshot({ path: screenshotPath })
  assertComponentScreenshotFloor(statSync(screenshotPath).size, screenshotPath)

  const accessibility = buildComponentAccessibilityEvidence({ pageWide, scoped: scopedAfter, gate })
  const accessibilityVerdict = readComponentAccessibilityVerdict(accessibility)
  if (accessibilityVerdict.result !== 'pass') {
    throw new Error(
      `component producer: accessibility verdict reads ${JSON.stringify(accessibilityVerdict.result)} for field "accessibility" at path record.accessibility.gate; ` +
      `the scoped scan reports ${gate.measured} violations over ${JSON.stringify(COMPONENT_SELECTORS.root)}; ` +
      'repair: fix the scoped component violation instead of relying on the informational page-wide census.',
    )
  }

  const proof = buildComponentProof({
    rowTheme: theme,
    identity: { kind: 'component', id: COMPONENT_TARGET_ID, createdAtMs },
    root: { mounted: true, observedAtMs: mountObservedAtMs },
    themeObservation: { ...themeObservation },
    interaction: { name: COMPONENT_ACTION_NAME, completed: true, observedAtMs: interactionObservedAtMs },
  })

  const servedHtml = await fetchText(`${baseUrl}/iframe.html`)
  const provenance = await collectComponentProvenance({
    baseUrl,
    servedHtml,
    viewport: { ...PRODUCT_VIEWPORT },
    targetIdentity: { kind: 'component', id: COMPONENT_TARGET_ID, createdAtMs },
    themeObservations: [{ ...themeObservation }],
  })

  const record = {
    target: COMPONENT_TARGET_ID,
    kind: 'component',
    rowTheme: theme,
    storyId: COMPONENT_STORY_ID,
    url: setup.url,
    root: {
      selector: COMPONENT_SELECTORS.root,
      children: observedBefore.rootChildCount,
      descendants: observedAfter.descendants,
      textLength: observedAfter.textLength,
      box: observedAfter.box,
    },
    interaction: {
      name: COMPONENT_ACTION_NAME,
      from: 'collapsed',
      to: 'expanded',
      completed: true,
      observedAtMs: interactionObservedAtMs,
      ariaExpandedBefore: observedBefore.ariaExpanded,
      ariaExpandedAfter: observedAfter.ariaExpanded,
      rowCount: observedAfter.rowCount,
      rowTexts: [...observedAfter.rowTexts],
    },
    theme: { ...themeObservation },
    computedStyles: {
      fontFamily: observedBefore.computed.fontFamily,
      fontSize: observedBefore.computed.fontSize,
      borderRadius: observedBefore.computed.borderRadius,
      minHeight: observedBefore.computed.minHeight,
      fontVariantNumeric: observedBefore.tabularNumbers,
      ink: observedBefore.tokenInk,
      canvas: observedBefore.tokenCanvas,
    },
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
  writeFileSync(join(rowDir, 'aria.json'), `${JSON.stringify({ target: COMPONENT_TARGET_ID, rowTheme: theme, storyId: COMPONENT_STORY_ID, snapshot: ariaSnapshot }, null, 2)}\n`)
  writeFileSync(join(rowDir, 'axe.json'), `${JSON.stringify({ target: COMPONENT_TARGET_ID, rowTheme: theme, policy: COMPONENT_A11Y_POLICY, scopeRoot: COMPONENT_SELECTORS.root, gate: { ...gate }, pageWide: { scope: COMPONENT_A11Y_SCOPES.page, root: COMPONENT_A11Y_SCOPES.pageRoot, informational: true, ...pageWide } }, null, 2)}\n`)
  writeFileSync(join(rowDir, 'provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`)
  writeFileSync(join(rowDir, 'resolution.json'), `${JSON.stringify(proof, null, 2)}\n`)

  assertComponentArtifactSet(rowDir)

  return {
    theme,
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

// Fairtrade-owned mounted product producer: browser-bearing host runtime and
// durable raw artifact writer for the built graph product target.
//
// This module never invents routes, selectors, theme semantics, or proof
// vocabulary. Every one of those comes from fairtrade-targets.mjs (app-owned
// target registry), from fairtest-runtime.mjs (the single loopback origin
// owner both this module and the Fairtest Playwright config read), and from
// the shared host contract through the sole source route. It holds no
// product class-name literal, no shell id selector, and no product display
// label of its own: the shell root, the section item, the active-state class,
// and the action label all come from the registry. The caller supplies the
// Playwright page; this module performs the row-scoped observation sequence
// and writes exactly six artifact classes per theme row into an immutable run
// root.
//
// Row sequence per theme (dark, light): serve the row route, wait for genuine
// mount (selector readiness, never a fixed sleep alone), observe chrome, body,
// exact route, initial active section, mounted view, and normalized theme
// AFTER mount and BEFORE interaction, perform ONE trusted click on the map
// section, observe the active section transition analytics to map plus the
// updated mounted view, then build the proof through buildProductProof.
//
// The representative body is measured on the ACTIVE view, never on the view
// container: the graph shell keeps a permanently mounted hidden changes view
// inside that container, and on the real built surface that hidden sibling
// alone carries 188 descendants and 804 characters, so a container-scoped
// floor would be satisfied by a blank active section. Container totals are
// still read and recorded, explicitly labelled as container totals.
//
// A PRESENT active view is not a RENDERED one, so counting nodes and text is
// not enough. measureProductView reads, per active root, the computed display,
// visibility, and effective opacity, the root's own box, and the box left
// after every clipping ancestor up to the mounted stage; a root in one of the
// PRODUCT_UNRENDERED_MODES is refused by name and excluded from the rendered
// population. assertProductActiveViewMounted is the single app-owned rendered
// predicate: it runs at the pre-action and the post-action observation point
// on the same rendered population, applies the floors to that population
// alone, and returns the accepted triple the record then carries. Every
// observedAtMs value in resolution.json is the real clock reading taken
// at the observation it names: rowStartedAtMs when the row begins, one
// captured reading for the chrome, body, and route parts read by the
// pre-interaction observation (the product tuple, then the shared active-view
// measurement), the theme reading, then the action reading.
// assertProductObservationTimes fails the row closed if those times ever
// degrade into assembly-order offsets again.
//
// Accessibility evidence reading rule (see readProductAccessibilityVerdict
// for the authoritative statement): the verdict comes from the gate receipts
// over the gated product-view scope alone. The page-wide census is
// informational, stays nested under accessibility.pageWide, and is never a
// verdict input.
//
// Fail-closed: any missing, contradictory, or unproven part throws an
// actionable error naming the missing part, the selector or path, and the
// repair. A failing row never writes a passing record.

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { importFairtestSource } from '../fairtest-source.mjs'
import { FAIRTEST_APP_BASE_URL, FAIRTEST_APP_HOST, FAIRTEST_APP_PORT, FAIRTEST_REPO_ROOT, PRODUCT_VIEWPORT } from './fairtest-runtime.mjs'
import {
  PRODUCT_ACTION_LABEL,
  PRODUCT_ACTION_NAME,
  PRODUCT_ACTION_TO_SECTION,
  PRODUCT_A11Y_BASELINE,
  PRODUCT_A11Y_GATE_POINT_SLOTS,
  PRODUCT_A11Y_GATE_RECEIPT_FIELDS,
  PRODUCT_A11Y_POINT_LABELS,
  PRODUCT_A11Y_POINT_SECTIONS,
  PRODUCT_A11Y_POINTS,
  PRODUCT_A11Y_POLICY,
  PRODUCT_A11Y_SCOPE_ROOT,
  PRODUCT_INITIAL_SECTION,
  PRODUCT_PROVENANCE_SOURCE,
  PRODUCT_SELECTORS,
  PRODUCT_TARGET_ID,
  PRODUCT_UNRENDERED_MODES,
  PRODUCT_UNRENDERED_REFUSAL_FIELDS,
  assertProductAxeBaselineDelta,
  assertProductThemeObservation,
  buildProductProof,
  observeProductTheme,
  productRouteForTheme,
  productThemeRow,
} from './fairtrade-targets.mjs'
import { AXE_RESULT_FIELDS, scanAxe, seriousViolations } from '../journey/lib/assertions.mjs'

const kindsContract = await importFairtestSource('src/host-contract/kinds.mjs')
// Generic value validation (records, fields, counts, strings, id lists) is a
// browser-neutral mechanism the private child already owns. This module
// consumes it through the sole source route instead of re-declaring a second
// copy with its own plain-record semantics and its own diagnostic wording.
const valuesContract = await importFairtestSource('src/core/values.mjs')

/**
 * The six durable artifact classes every product row writes. Exact set, no
 * silent extras. The verifier owns completeness against this list.
 * @type {string[]}
 */
export const PRODUCT_ARTIFACT_CLASSES = Object.freeze([
  'record.json',
  'aria.json',
  'axe.json',
  'screenshot.png',
  'provenance.json',
  'resolution.json',
])

/**
 * Minimum descendant element count inside the RENDERED active view (the
 * non-hidden children of the view container that render) that counts as a
 * non-blank representative body. Measured on the rendered active view, never
 * on the container and never on an unrendered root: the graph shell keeps a
 * permanently mounted hidden changes view inside the container, and on the
 * real built surface that hidden sibling alone contributes 188 descendants,
 * far above this floor, so a container-scoped measurement cannot tell a blank
 * active section from a rendered one. The rendered active analytics view
 * carries 646 descendants on the real built surface and the rendered active
 * map root 298, so the floor is wide on purpose: anything below it is
 * unproven body content, not a close call.
 * @type {number}
 */
export const PRODUCT_MIN_BODY_DESCENDANTS = 20

/**
 * Minimum trimmed text length inside the RENDERED active view that counts as
 * non-blank body content. Observed rendered-view contributions are 1223
 * characters at analytics and 1195 at the code map; a blank or unrendered
 * active section contributes near zero once the permanently mounted hidden
 * changes view and every unrendered root are excluded.
 * @type {number}
 */
export const PRODUCT_MIN_BODY_TEXT_LENGTH = 200

/**
 * The three selectors one active-view measurement reads: the view container,
 * the active view inside it, and the mounted stage the active view must still
 * intersect to count as rendered. Derived from the app-owned selector bundle,
 * never a second literal triple.
 * @type {{ container: string, activeView: string, stage: string }}
 */
export const PRODUCT_VIEW_SELECTORS = Object.freeze({
  container: PRODUCT_SELECTORS.body,
  activeView: PRODUCT_SELECTORS.activeView,
  stage: PRODUCT_SELECTORS.sectionView,
})

/**
 * Scope labels shared by axe.json and the record.json accessibility block,
 * declared once so the two artifacts can never drift into different words.
 * The gate covers the product view; the census covers the whole document.
 * @type {{ gated: string, page: string, pageRoot: string }}
 */
const PRODUCT_A11Y_SCOPES = Object.freeze({
  gated: 'product-view',
  page: 'page',
  pageRoot: 'document',
})

/**
 * Exact field set of the record.json accessibility block. The page-wide
 * census is never one of these names: it lives under `pageWide`, so an
 * unqualified `blocking` or `violations` count cannot be read as a verdict.
 * @type {string[]}
 */
export const PRODUCT_A11Y_RECORD_FIELDS = Object.freeze([
  'policy',
  'gatedScope',
  'scopeRoot',
  'scopedBefore',
  'scopedAfter',
  'gate',
  'pageWide',
])

/**
 * Exact field set of the informational page-wide census inside the record
 * accessibility block, mirroring the axe.json pageWide nesting.
 * @type {string[]}
 */
export const PRODUCT_A11Y_PAGE_WIDE_FIELDS = Object.freeze([
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
 * Observation points carrying a gate receipt, in record order.
 * @type {string[]}
 */
export const PRODUCT_A11Y_GATE_POINTS = Object.freeze(['before', 'after'])

/**
 * The product parts whose observedAtMs is one captured reading of the single
 * pre-interaction evaluate, in record order.
 * @type {string[]}
 */
export const PRODUCT_PRE_ACTION_PARTS = Object.freeze(['chrome', 'body', 'route'])

/**
 * Mount wait budget per selector in milliseconds.
 * @type {number}
 */
const PRODUCT_MOUNT_TIMEOUT_MS = 15000

/**
 * Post-click settle budget for the active section transition in milliseconds.
 * @type {number}
 */
const PRODUCT_ACTION_TIMEOUT_MS = 10000

const ROW_THEMES = Object.freeze(['dark', 'light'])
const DIST_ROOT = join(FAIRTEST_REPO_ROOT, 'dist')

/**
 * Resolve the immutable run root for the current run. The root must be
 * provided through FAIRTEST_RUN_ROOT and must be an absolute path.
 * @returns {string} the resolved run root
 */
export function resolveProductRunRoot() {
  const root = process.env.FAIRTEST_RUN_ROOT || ''
  if (!root) {
    throw new Error(
      'product producer: missing run root for field "FAIRTEST_RUN_ROOT" at path run.root; ' +
      'repair: run with FAIRTEST_RUN_ROOT=<run-root> pointing at a fresh absolute directory.',
    )
  }
  if (!isAbsolute(root)) {
    throw new Error(
      `product producer: invalid run root ${JSON.stringify(root)} for field "FAIRTEST_RUN_ROOT" at path run.root; ` +
      'repair: use an absolute directory path for FAIRTEST_RUN_ROOT.',
    )
  }
  return resolve(root)
}

/**
 * Row directory for a theme row inside a run root.
 * @param {string} runRoot immutable run root
 * @param {string} theme dark or light row theme
 * @returns {string} the row directory path
 */
export function productRowDir(runRoot, theme) {
  if (!ROW_THEMES.includes(theme)) {
    throw new Error(
      `product producer: unknown row theme ${JSON.stringify(theme)} for field "theme" at path row.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  return join(runRoot, 'producer', `product-${theme}`)
}

/**
 * Refuse a row directory that already carries one of the six artifact
 * classes. A rerun must use a fresh run root, never silently append into a
 * previous run subtree. Module-private on purpose: prepareProductRowDir is the
 * only way the row can reach this refusal, so freshness can never be
 * validated after a write has already overwritten a previous run's bytes.
 * @param {string} rowDir row directory
 * @returns {void}
 */
function refuseStaleRunSubtree(rowDir) {
  for (const name of PRODUCT_ARTIFACT_CLASSES) {
    if (existsSync(join(rowDir, name))) {
      throw new Error(
        `product producer: stale artifact ${JSON.stringify(name)} for field "artifact" at path run.rowDir/${name}; ` +
        `found a previous run subtree at ${JSON.stringify(rowDir)}; ` +
        'repair: use a fresh FAIRTEST_RUN_ROOT per run instead of reusing a previous run root.',
      )
    }
  }
}

/**
 * Prepare one theme row's run directory: validate freshness FIRST, then
 * create the directory, and hand the row the prepared paths. This is the one
 * seam every row goes through, and it is the executable form of the ordering
 * the run-root guard rests on: the freshness refusal happens before the row
 * directory is created and therefore before any artifact write can reach a
 * previous run subtree.
 *
 * The `observe` step hook reports the boundary each step just crossed so the
 * ordering is observed through this real function instead of being read out
 * of the row's source text. Production callers pass nothing; the fixture
 * family passes a recorder and asserts the validation boundary comes first
 * and that a refused row directory is left exactly as it was found.
 * @param {object} input preparation inputs
 * @param {string} input.runRoot immutable run root
 * @param {string} input.theme dark or light row theme
 * @param {(step: 'validated' | 'created') => void} [input.observe] step boundary observer
 * @returns {{ runRoot: string, rowDir: string }} the prepared paths for the row
 */
export function prepareProductRowDir(input = {}) {
  const observeStep = Object.hasOwn(input, 'observe') ? input.observe : null
  assertProductRecordFields(
    input,
    observeStep === null ? ['runRoot', 'theme'] : ['runRoot', 'theme', 'observe'],
    'rowPreparation',
    'producer.rowPreparation',
    'pass the immutable run root and the row theme to prepare the row directory',
  )
  if (observeStep !== null && typeof observeStep !== 'function') {
    throw new Error(
      `product producer: invalid step observer ${JSON.stringify(observeStep)} for field "observe" at path producer.rowPreparation.observe; ` +
      'repair: pass a function that receives the validated and created boundaries, or omit it.',
    )
  }
  const observe = observeStep ?? (() => {})
  const { runRoot, theme } = /** @type {Record<string, string>} */ (input)
  const rowDir = productRowDir(runRoot, theme)
  refuseStaleRunSubtree(rowDir)
  observe('validated')
  mkdirSync(rowDir, { recursive: true })
  observe('created')
  return Object.freeze({ runRoot: resolve(runRoot), rowDir })
}

/**
 * Create a loopback static driver serving the exact built app from dist/.
 * The driver starts one http server on the fixed loopback port owned by
 * fairtest-runtime.mjs and reports readiness over real HTTP. It refuses to
 * serve any resolved path outside distRoot (403) and refuses to bind a
 * non-loopback host, so the validation origin is loopback-only and can never
 * read a file beyond the served root. It satisfies the adapter's declared
 * driver contract: stop is safe to call when the driver is not running,
 * which is how a start that failed before the server listened is cleaned up
 * and released.
 * @param {object} [options] driver options
 * @param {number} [options.port] fixed loopback port
 * @param {string} [options.host] loopback host, always the declared owner
 * @param {string} [options.distRoot] built app root served over HTTP
 * @returns {object} the injected lifecycle driver for createFairtradeAdapter
 */
export function createProductStaticDriver(options = {}) {
  const port = options.port ?? FAIRTEST_APP_PORT
  const host = options.host ?? FAIRTEST_APP_HOST
  const distRoot = options.distRoot ?? DIST_ROOT
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `product producer: invalid port ${JSON.stringify(port)} for field "port" at path driver.port; ` +
      'repair: use the fixed loopback port owned by scripts/fairtest/fairtest-runtime.mjs for "port".',
    )
  }
  if (host !== FAIRTEST_APP_HOST) {
    throw new Error(
      `product producer: non-loopback host ${JSON.stringify(host)} for field "host" at path driver.host; ` +
      `repair: bind the built app to ${FAIRTEST_APP_HOST} for "host".`,
    )
  }
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.woff2': 'font/woff2',
  }
  let server = null
  let running = false
  let stops = 0

  async function start() {
    if (running) {
      throw new Error(
        'product producer: duplicate driver start for field "state" at path driver.lifecycle; ' +
        'repair: start the driver once per adapter and stop it before restarting.',
      )
    }
    if (!existsSync(join(distRoot, 'index.html'))) {
      throw new Error(
        `product producer: built app is missing for field "dist" at path driver.distRoot; ` +
        `looked for ${JSON.stringify(join(distRoot, 'index.html'))}; ` +
        'repair: run pnpm build before the mounted row so dist/ holds the exact built app.',
      )
    }
    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://${host}:${port}`)
        let pathname = decodeURIComponent(url.pathname)
        if (pathname === '/') pathname = '/index.html'
        const file = join(distRoot, pathname)
        const resolved = resolve(file)
        if (resolved !== resolve(distRoot) && !resolved.startsWith(`${resolve(distRoot)}/`)) {
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
        `product producer: driver start failed for field "port" at path driver.start; ` +
        `could not listen on ${host}:${port}; caused by ${cause}; ` +
        'repair: free the fixed loopback port or stop the previous adapter run before retrying.',
      )
    })
    running = true
  }

  async function stop() {
    if (!running || !server) {
      stops += 0
      return
    }
    const current = server
    server = null
    running = false
    stops += 1
    // A served page keeps keep-alive sockets open, and a bare close() waits
    // for them, so a stopped driver can hold the fixed loopback port after it
    // reported itself stopped. Dropping the lingering sockets makes "stopped"
    // mean the port is actually free, which is what the next bounded session
    // on the same port depends on.
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
        'product producer: readiness before start for field "state" at path driver.readiness; ' +
        'repair: start the driver before reporting readiness.',
      )
    }
    const body = await fetchText(`http://${host}:${port}/index.html`)
    if (!body || (!body.includes('id="root"'))) {
      throw new Error(
        'product producer: readiness probe found no app mount point for field "ready" at path driver.readiness; ' +
        'repair: rebuild dist/ with pnpm build so the served index.html carries the app root.',
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
    distRoot,
  }
}

/**
 * Fetch text over HTTP from the running loopback server. Served bytes are
 * the provenance source of truth, never the on-disk copy alone.
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
 * produced dist/. Best effort git probe with fail-closed diagnostics.
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
      `product producer: cannot read the integration commit for field "commit" at path provenance.commit; caused by ${cause}; ` +
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
 * Compare the digests the row read over HTTP against the bytes the run's own
 * build tree holds on disk, so the recorded provenance is a MEASURED
 * correspondence instead of a bare list of hashes.
 *
 * What this proves: every recorded digest is the digest of the same bytes the
 * run root's built tree contains, so a served origin that was not this run's
 * build (an unrelated server already holding the port, a stale copy, a mutated
 * file) fails closed instead of producing a record whose digests describe
 * something other than what the row looked at.
 *
 * What this does NOT prove, and must not be read as proving: that the built
 * tree was produced from the recorded commit. dist/ is gitignored, so
 * `commit` and `dirty` describe the worktree the build ran in, not the bytes.
 * Binding those bytes to a commit needs a build digest recorded in source,
 * which is the verifier's comparison, not the producer's. The record says so in
 * `commitCorrespondence` rather than implying more.
 * @param {object} input comparison inputs
 * @param {Record<string, string>} input.assetDigests digests the row read over HTTP, keyed by run-root-relative path
 * @param {string} input.distRoot the run's built tree on disk
 * @returns {object} the comparison receipt naming what was compared
 */
export function assertServedDigestsMatchRunRoot({ assetDigests, distRoot } = {}) {
  const compared = Object.keys(assetDigests).sort()
  if (compared.length === 0) {
    throw new Error(
      'product producer: empty served digest set for field "assetDigests" at path provenance.assetDigests; ' +
      'repair: record at least the served index.html digest before comparing the served bytes to the built tree.',
    )
  }
  for (const relative of compared) {
    const onDiskPath = join(distRoot, relative)
    let onDisk
    try {
      onDisk = readFileSync(onDiskPath)
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error)
      throw new Error(
        `product producer: served asset ${JSON.stringify(relative)} is missing from the run build tree for field "assetDigests" at path provenance.assetDigests; ` +
        `looked for ${JSON.stringify(onDiskPath)}; caused by ${cause}; ` +
        'repair: rebuild dist/ so the served origin and the built tree are the same tree.',
      )
    }
    const onDiskDigest = sha256(onDisk)
    if (onDiskDigest !== assetDigests[relative]) {
      throw new Error(
        `product producer: served bytes differ from the run build tree for field "assetDigests" at path provenance.assetDigests; ` +
        `${JSON.stringify(relative)} served digest ${JSON.stringify(assetDigests[relative])} but ${JSON.stringify(onDiskPath)} holds ${JSON.stringify(onDiskDigest)}; ` +
        'repair: serve the exact built tree (rebuild dist/ and make sure no other server holds the loopback port).',
      )
    }
  }
  return Object.freeze({
    against: 'run-root-dist',
    entries: Object.freeze(compared),
    commitCorrespondence: 'verifier-owned',
  })
}

/**
 * Collect served-build provenance over real HTTP: the served index.html
 * bytes plus every served asset file the page actually references, compared
 * against the run's own built tree before anything is written.
 * @param {object} input provenance inputs
 * @param {string} input.baseUrl running loopback base URL
 * @param {string} input.servedHtml served index.html text just read over HTTP
 * @param {{ width: number, height: number }} input.viewport explicit viewport
 * @param {object} input.targetIdentity product-branch target identity
 * @param {object[]} input.themeObservations normalized theme observations covered by the run
 * @returns {Promise<object>} the provenance record (unfrozen, caller freezes on write)
 */
async function collectServedProvenance({ baseUrl, servedHtml, viewport, targetIdentity, themeObservations }) {
  const assetDigests = {}
  assetDigests['index.html'] = sha256(servedHtml)
  const refs = new Set()
  for (const match of servedHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    refs.add(match[1])
  }
  if (refs.size === 0) {
    throw new Error(
      'product producer: served index.html references no asset files for field "assetDigests" at path provenance.assetDigests; ' +
      'repair: rebuild dist/ with pnpm build so the served page references its hashed asset bundle.',
    )
  }
  for (const ref of [...refs].sort()) {
    let bytes = null
    try {
      bytes = await fetchBytes(`${baseUrl}${ref}`)
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error)
      throw new Error(
        `product producer: cannot read served asset ${JSON.stringify(ref)} for field "assetDigests" at path provenance.assetDigests; caused by ${cause}; ` +
        'repair: keep the loopback service running while provenance is collected and rebuild dist/ if the asset is missing.',
      )
    }
    assetDigests[ref.replace(/^\//, '')] = sha256(bytes)
  }
  const { commit, dirty } = readWorktreeState()
  const comparison = assertServedDigestsMatchRunRoot({ assetDigests, distRoot: DIST_ROOT })
  const provenance = {
    source: PRODUCT_PROVENANCE_SOURCE.source,
    root: PRODUCT_PROVENANCE_SOURCE.root,
    commit,
    dirty,
    assetDigests,
    servedFrom: comparison.against,
    commitCorrespondence: comparison.commitCorrespondence,
    viewport: { ...viewport },
    targetIdentity: { ...targetIdentity },
    themeObservations: themeObservations.map((entry) => ({ ...entry })),
    servedUrl: baseUrl,
    producedAtMs: Date.now(),
  }
  // The record carries exactly the fields the registry declares, so the
  // declaration stays the owner of the shape instead of a comment beside it.
  const written = Object.keys(provenance).sort()
  const declared = [...PRODUCT_PROVENANCE_SOURCE.fields].sort()
  if (JSON.stringify(written) !== JSON.stringify(declared)) {
    throw new Error(
      `product producer: provenance record carries ${JSON.stringify(written)} for field "provenance" at path provenance.fields; ` +
      `the registry declares ${JSON.stringify(declared)}; ` +
      'repair: keep provenance.json to the declared field set in PRODUCT_PROVENANCE_SOURCE.fields.',
    )
  }
  return provenance
}

/**
 * Scope guard: the primary accessibility scan stays inside the product view
 * root owned by the target registry, never a second literal copy.
 */
if (PRODUCT_A11Y_SCOPE_ROOT !== PRODUCT_SELECTORS.sectionView) {
  throw new Error(
    'product producer: accessibility scope drifted for field "scopeRoot" at path evidence.axe.scopeRoot; ' +
    `got ${JSON.stringify(PRODUCT_A11Y_SCOPE_ROOT)} but the target registry declares ${JSON.stringify(PRODUCT_SELECTORS.sectionView)}; ` +
    'repair: scope the primary scan to PRODUCT_SELECTORS.sectionView instead of a second literal.',
  )
}

/**
 * Fail-closed check that one axe scan carries exactly the shared compact
 * report field set. The shape has ONE owner: the shared journey assertion
 * primitive, which declares the field set once. The row never re-maps a scan
 * result, so a field added to the shared primitive lands in both the
 * page-wide and the scoped entries of axe.json, and a scan that arrives with
 * a different shape fails here instead of being recorded as evidence no
 * verifier can compare.
 * @param {unknown} scan compact axe report
 * @param {string} part observed part the scan belongs to
 * @param {string} path record path of the scan
 * @returns {asserts scan is Record<string, unknown>} the validated scan
 */
export function assertProductAxeScanShape(scan, part, path) {
  assertProductRecordFields(
    scan,
    AXE_RESULT_FIELDS,
    'axeScan',
    path,
    'record the compact scan the shared axe primitive returned, with no second local mapping',
  )
  const report = /** @type {Record<string, any>} */ (scan)
  if (!Array.isArray(report.violations)) {
    throw new Error(
      `product producer: malformed accessibility scan for field "violations" at path ${path}; ` +
      `part ${JSON.stringify(part)}; ` +
      'repair: keep the shared axe primitive wired so every scan returns its violation list.',
    )
  }
}

/**
 * Run axe-core over one root on the current page through the shared journey
 * primitive. The row never builds its own axe builder: the shared primitive
 * owns the compact report shape for the page-wide and the scoped scans alike,
 * so both entries in axe.json are produced by one owner.
 * @param {import('@playwright/test').Page} page Playwright page for the row
 * @param {string} part observed part the scan belongs to
 * @param {string} [root] scope root, always the product view root when given
 * @returns {Promise<object>} the compact scan report
 */
async function scanProductViewAxe(page, part, root = PRODUCT_A11Y_SCOPE_ROOT) {
  const scan = await scanAxe(page, { root })
  assertProductAxeScanShape(scan, part, root ? 'evidence.axe.scoped' : 'evidence.axe.pageWide')
  return scan
}

/**
 * Summarize a compact scan for the baseline-delta gate: one triple per
 * violation with the node count instead of the raw target lists.
 * @param {object} scan compact scan report
 * @returns {{ id: string, impact: string, nodeCount: number }[]} measured triples
 */
function summarizeAxeForGate(scan) {
  return scan.violations.map((entry) => ({
    id: entry.id,
    impact: entry.impact,
    nodeCount: entry.nodes.length,
  }))
}

/**
 * Assert a record holds exactly the declared fields, routing the check itself
 * to the private child and owning only the product wording. The child's
 * assertExactFields decides plain-record membership and which member is
 * missing or unknown; this wrapper adds the product repair hint so a reader
 * of the record still gets an actionable fix beside the child's own reason.
 * @param {unknown} value candidate record
 * @param {string[]} fields the exact declared field set
 * @param {string} field product field name used in diagnostics
 * @param {string} path value path used in diagnostics
 * @param {string} repair repair hint appended to the diagnostic
 * @returns {asserts value is Record<string, unknown>}
 */
function assertProductRecordFields(value, fields, field, path, repair) {
  try {
    valuesContract.assertExactFields(value, fields, 'product producer', path)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`${reason} product repair for field "${field}": ${repair}.`)
  }
}

/**
 * Assert a non-negative whole count, routing the range check to the private
 * child and owning only the product wording.
 * @param {unknown} value candidate count
 * @param {string} field product field name used in diagnostics
 * @param {string} path value path used in diagnostics
 * @param {string} repair repair hint appended to the diagnostic
 * @returns {asserts value is number}
 */
function assertProductCount(value, field, path, repair) {
  try {
    valuesContract.assertIntegerInRange(value, field, path, { min: 0, max: Number.MAX_SAFE_INTEGER })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`${reason} product repair: ${repair}.`)
  }
}

/**
 * Measure the mounted view in the live page: the active view and the view
 * container that also holds the permanently mounted hidden changes view. Runs
 * inside the page (the runner serializes this function), so it references
 * nothing outside its argument and repeats its geometry inline.
 *
 * A PRESENT active view is not a RENDERED one. For every active root the
 * measurement reads the computed display and visibility, the effective
 * opacity (the root's own opacity times every ancestor's up to the view
 * container, because a parent at zero hides a child that computes as visible),
 * the root's own box, and the box that is left after intersecting that root
 * with the mounted stage and with every clipping ancestor between the two. A
 * root whose display is none, whose visibility is hidden or collapsed, whose
 * effective opacity is zero, whose own box is empty, or whose visible area
 * does not intersect the stage is refused by the declared mode name and is
 * EXCLUDED from the rendered population the floors are applied to. Only
 * rendering roots contribute descendants and text, so an unrendered active
 * view with its full content still fails closed.
 *
 * "Intersects the stage" is deliberately the stage's VISIBLE box, not its
 * scrollable content: the row's evidence is a 1280x720 capture of the mounted
 * surface, so a root that lies entirely below the stage's fold renders
 * nothing a user or a verifier of this row can see, and counting it would put
 * a number in record.json that no capture supports. The measured rendered and
 * total root counts are both recorded, so that split stays legible: on the real
 * map section the visible root and the root below the fold are 298 and 455
 * descendants respectively, and the record says so instead of reporting one
 * unqualified total.
 *
 * Both halves are returned because the guard needs the container totals to
 * say plainly why they are not the measurement the floors apply to, and the
 * record needs the rendered/total split to stay legible.
 * @param {{ container: string, activeView: string, stage: string }} selectors app-owned view selectors
 * @returns {object} the measured view with the rendered population, the per-root refusals, and the container totals
 */
export function measureProductView(selectors) {
  const container = document.querySelector(selectors.container)
  const stage = document.querySelector(selectors.stage)
  const roots = [...document.querySelectorAll(selectors.activeView)]
  const stageRect = stage ? stage.getBoundingClientRect() : null
  const refusals = []
  let rendered = 0
  let descendants = 0
  let textLength = 0
  for (const root of roots) {
    const rect = root.getBoundingClientRect()
    const style = getComputedStyle(root)
    let opacity = 1
    for (let node = root; node; node = node.parentElement) {
      opacity *= Number.parseFloat(getComputedStyle(node).opacity || '1')
      if (node === container) break
    }
    const clips = []
    for (let node = root.parentElement; node; node = node.parentElement) {
      const parent = getComputedStyle(node)
      if (parent.overflowX !== 'visible' || parent.overflowY !== 'visible') {
        clips.push(node.getBoundingClientRect())
      }
      if (node === container) break
    }
    const left = clips.reduce((edge, box) => Math.max(edge, box.left), rect.left)
    const top = clips.reduce((edge, box) => Math.max(edge, box.top), rect.top)
    const right = clips.reduce((edge, box) => Math.min(edge, box.right), rect.right)
    const bottom = clips.reduce((edge, box) => Math.min(edge, box.bottom), rect.bottom)
    const intersectsStage = !!stageRect
      && left < stageRect.right && right > stageRect.left
      && top < stageRect.bottom && bottom > stageRect.top
    const width = Math.round(rect.width)
    const height = Math.round(rect.height)
    const visibleWidth = intersectsStage ? Math.max(0, Math.min(right, stageRect.right) - Math.max(left, stageRect.left)) : 0
    const visibleHeight = intersectsStage ? Math.max(0, Math.min(bottom, stageRect.bottom) - Math.max(top, stageRect.top)) : 0
    let mode = ''
    if (style.display === 'none') mode = 'display-none'
    else if (style.visibility === 'hidden' || style.visibility === 'collapse') mode = 'visibility-hidden'
    else if (opacity <= 0) mode = 'opacity-zero'
    else if (width <= 0 || height <= 0) mode = 'zero-size'
    else if (!intersectsStage || visibleWidth <= 0 || visibleHeight <= 0) mode = 'clipped'
    if (mode) {
      refusals.push({
        mode,
        display: style.display,
        visibility: style.visibility,
        opacity: Math.round(opacity * 1000) / 1000,
        width,
        height,
        intersectsStage,
      })
      continue
    }
    rendered += 1
    descendants += root.querySelectorAll('*').length
    textLength += (root.textContent || '').trim().length
  }
  return {
    activeView: {
      roots: roots.length,
      rendered,
      descendants,
      textLength,
      refusals,
    },
    container: {
      descendants: container ? container.querySelectorAll('*').length : -1,
      textLength: ((container ? container.textContent : '') || '').trim().length,
    },
  }
}

/**
 * Fail-closed guard for the mounted ACTIVE view, and the single app-owned
 * rendered predicate the row runs at BOTH observation points (before the
 * named action and after it). The floors apply to the RENDERED population
 * alone, for two independent reasons:
 *
 * 1. The view container also holds the permanently mounted hidden changes
 *    view: on the real built surface that hidden sibling alone carries 188
 *    descendants and 804 text characters, far above both floors, so a
 *    container-scoped check cannot tell a blank active section from a
 *    rendered one.
 * 2. An active view can hold its full content and still not be rendered
 *    (display none, hidden visibility, zero opacity, an empty box, or a box
 *    clipped away from the mounted stage). Counting nodes and text cannot see
 *    that, so roots in a declared unrendered mode are refused by name and
 *    excluded from the population the floors are measured on.
 *
 * A row with no rendering root, too few rendered descendants, or too little
 * rendered text fails closed naming the measured numbers, the floors, the
 * per-root refusal with its computed style and box, the container totals it
 * is not reading, and the repair. The accepted triple is returned so the
 * record is built from exactly the population the guard measured.
 * @param {object} observed measured view from measureProductView
 * @param {object} context product context for the diagnostic
 * @param {string} context.label short name for the blank condition
 * @param {string} context.part observed part the guard protects
 * @param {string} context.path record path of the observed part
 * @param {string} context.repair repair hint naming the section to keep mounted
 * @returns {{ roots: number, rendered: number, descendants: number, textLength: number }} the accepted rendered measurement
 */
export function assertProductActiveViewMounted(observed, context = {}) {
  assertProductRecordFields(
    context,
    ['label', 'part', 'path', 'repair'],
    'activeViewContext',
    'producer.activeViewContext',
    'name the observed part, its record path, and the repair for a blank active view',
  )
  const { label, part, path, repair } = /** @type {Record<string, string>} */ (context)
  assertProductRecordFields(
    observed,
    ['activeView', 'container'],
    'viewObservation',
    `producer.viewObservation.${part}`,
    'measure both the active view and the view container before observing the part',
  )
  const measurement = /** @type {Record<string, any>} */ (observed)
  assertProductRecordFields(
    measurement.activeView,
    ['roots', 'rendered', 'descendants', 'textLength', 'refusals'],
    'activeView',
    `producer.activeView.${part}`,
    'record how many active roots render, how many are refused, and the rendered descendants and text characters',
  )
  assertProductRecordFields(
    measurement.container,
    ['descendants', 'textLength'],
    'container',
    `producer.viewContainer.${part}`,
    'record the view container totals beside the active view measurement',
  )
  const { roots, rendered, descendants, textLength, refusals } = measurement.activeView
  for (const refusal of refusals) {
    assertProductRecordFields(
      refusal,
      PRODUCT_UNRENDERED_REFUSAL_FIELDS,
      'unrenderedRoot',
      `producer.activeView.${part}.refusals`,
      'record the unrendered mode with the measured display, visibility, opacity, box, and stage intersection',
    )
    if (typeof refusal.mode !== 'string' || !PRODUCT_UNRENDERED_MODES.includes(refusal.mode)) {
      throw new Error(
        `product producer: unknown unrendered mode ${JSON.stringify(refusal.mode)} for field "mode" at path producer.activeView.${part}.refusals.mode; ` +
        `repair: use one of ${[...PRODUCT_UNRENDERED_MODES].join(', ')} for "mode".`,
      )
    }
    for (const dimension of ['width', 'height']) {
      assertProductCount(refusal[dimension], dimension, `producer.activeView.${part}.refusals.${dimension}`, 'record the measured box dimension of the refused root')
    }
    if (typeof refusal.intersectsStage !== 'boolean') {
      throw new Error(
        `product producer: invalid stage intersection ${JSON.stringify(refusal.intersectsStage)} for field "intersectsStage" at path producer.activeView.${part}.refusals.intersectsStage; ` +
        'repair: record whether the refused root still intersects the mounted stage.',
      )
    }
  }
  if (rendered >= 1 && descendants >= PRODUCT_MIN_BODY_DESCENDANTS && textLength >= PRODUCT_MIN_BODY_TEXT_LENGTH) {
    return Object.freeze({ roots, rendered, descendants, textLength })
  }
  const refused = refusals.length > 0
    ? `${refusals.length} of them render nothing: ${refusals.map((refusal) => `${refusal.mode} (display ${refusal.display}, visibility ${refusal.visibility}, opacity ${refusal.opacity}, box ${refusal.width}x${refusal.height}, intersects the mounted stage ${refusal.intersectsStage})`).join('; ')}. `
    : ''
  throw new Error(
    `product producer: ${label} for field ${JSON.stringify(part)} at path ${path}; ` +
    `active view ${JSON.stringify(PRODUCT_VIEW_SELECTORS.activeView)} has ${roots} roots of which ${rendered} render, with ${descendants} rendered descendants and ${textLength} rendered text characters; ` +
    `floor is one rendering root with ${PRODUCT_MIN_BODY_DESCENDANTS} descendants and ${PRODUCT_MIN_BODY_TEXT_LENGTH} characters; ` +
    `${refused}` +
    `the container ${JSON.stringify(PRODUCT_VIEW_SELECTORS.container)} totals ${measurement.container.descendants} descendants and ${measurement.container.textLength} characters, ` +
    'which include the permanently mounted hidden changes view and are never read as the active view; ' +
    `repair: ${repair}.`,
  )
}

/**
 * Assert a recorded body or view block carries the RENDERED active-view
 * measurement the rendered guard accepted, not a container total and not a
 * re-measured number. This is the record-truthfulness contract: a verifier
 * reading `descendants` must be reading the population a floor was applied
 * to. The recorded number is taken from the measurement, then required to
 * equal the guard's returned triple, and required to differ from the
 * container total whenever the two populations differ, so swapping the
 * recorded values back to container totals fails here before the record is
 * written.
 * @param {object} input recorded-block inputs
 * @param {object} input.record the recorded block about to be written
 * @param {object} input.accepted the triple assertProductActiveViewMounted returned
 * @param {object} input.observation the measured view the guard decided on
 * @param {string} input.part observed part the block belongs to
 * @param {string} input.path record path of the block
 * @param {string} input.descendantsField recorded field carrying the descendant count
 * @param {string} input.textField recorded field carrying the text length
 * @returns {void}
 */
function assertProductRecordedActiveView(input = {}) {
  assertProductRecordFields(
    input,
    ['record', 'accepted', 'observation', 'part', 'path', 'rootField', 'renderedField', 'descendantsField', 'textField'],
    'recordedActiveView',
    'producer.recordedActiveView',
    'pass the recorded block, the accepted rendered measurement, and the four recorded field names it carries them under',
  )
  const { record, accepted, observation, part, path } = /** @type {Record<string, any>} */ (input)
  const measured = observation.activeView
  const fields = [
    ['roots', input.rootField],
    ['rendered', input.renderedField],
    ['descendants', input.descendantsField],
    ['textLength', input.textField],
  ]
  for (const [measuredField, field] of fields) {
    const recorded = record[/** @type {string} */ (field)]
    if (recorded !== measured[measuredField] || recorded !== accepted[measuredField]) {
      throw new Error(
        `product producer: recorded ${part} measurement contradicts the rendered guard for field ${JSON.stringify(field)} at path ${path}.${field}; ` +
        `recorded ${JSON.stringify(recorded)} but the ${measuredField} the guard accepted on the rendered active view is ${JSON.stringify(accepted[measuredField])} and the observation measured ${JSON.stringify(measured[measuredField])}; ` +
        `the container totals ${JSON.stringify(observation.container.descendants)} descendants and ${JSON.stringify(observation.container.textLength)} characters are a different population that no floor was applied to; ` +
        `repair: record the rendered active-view ${measuredField} the guard returned for "${field}".`,
      )
    }
  }
  const containerTotal = observation.container.descendants
  if (accepted.descendants !== containerTotal && record[/** @type {string} */ (input.descendantsField)] === containerTotal) {
    throw new Error(
      `product producer: recorded ${part} descendants are the container total for field ${JSON.stringify(input.descendantsField)} at path ${path}.${input.descendantsField}; ` +
      `recorded ${JSON.stringify(containerTotal)}, which is the view container total, not the ${JSON.stringify(accepted.descendants)} rendered descendants the floors were applied to; ` +
      'repair: record the rendered active-view descendant count beside the container total, never the container total under the unqualified name.',
    )
  }
}

/**
 * Build the record.json body block from the rendered measurement the guard
 * accepted. The unqualified `descendants` and `textLength` names carry the
 * RENDERED active-view numbers the floors were applied to; the container
 * totals stay beside them under explicitly labelled names, and the rendered
 * and total root counts are both recorded so the split is legible.
 * @param {object} input body-block inputs
 * @param {object} input.accepted triple returned by assertProductActiveViewMounted
 * @param {object} input.observation the measured view the guard decided on
 * @param {{ width: number, height: number } | null} input.box the container box
 * @returns {object} the frozen recorded body block
 */
export function buildProductBodyRecord({ accepted, observation, box } = {}) {
  assertProductRecordFields({ accepted, observation, box }, ['accepted', 'observation', 'box'], 'bodyRecord', 'record.body', 'pass the accepted rendered measurement, the observed view, and the container box')
  const record = {
    selector: PRODUCT_SELECTORS.body,
    activeViewSelector: PRODUCT_SELECTORS.activeView,
    activeRoots: observation.activeView.roots,
    renderedRoots: observation.activeView.rendered,
    descendants: observation.activeView.descendants,
    textLength: observation.activeView.textLength,
    box,
    containerDescendants: observation.container.descendants,
    containerTextLength: observation.container.textLength,
  }
  assertProductRecordedActiveView({
    record,
    accepted,
    observation,
    part: 'body',
    path: 'record.body',
    rootField: 'activeRoots',
    renderedField: 'renderedRoots',
    descendantsField: 'descendants',
    textField: 'textLength',
  })
  return Object.freeze(record)
}

/**
 * Build the record.json view block the same way as the body block: the
 * post-action unqualified counts are the rendered active view's, with the
 * container totals labelled beside them.
 * @param {object} input view-block inputs
 * @param {object} input.accepted triple returned by assertProductActiveViewMounted
 * @param {object} input.observation the measured view the guard decided on
 * @param {number} input.stageDescendantsAfter descendants of the mounted stage
 * @returns {object} the frozen recorded view block
 */
export function buildProductViewRecord({ accepted, observation, stageDescendantsAfter } = {}) {
  assertProductRecordFields({ accepted, observation, stageDescendantsAfter }, ['accepted', 'observation', 'stageDescendantsAfter'], 'viewRecord', 'record.view', 'pass the accepted rendered measurement, the observed view, and the stage descendant count')
  const record = {
    selector: PRODUCT_SELECTORS.sectionView,
    activeViewSelector: PRODUCT_SELECTORS.activeView,
    stageDescendantsAfter,
    viewRootsAfter: observation.activeView.roots,
    renderedRootsAfter: observation.activeView.rendered,
    viewDescendantsAfter: observation.activeView.descendants,
    viewTextLengthAfter: observation.activeView.textLength,
    containerDescendantsAfter: observation.container.descendants,
    containerTextLengthAfter: observation.container.textLength,
  }
  assertProductRecordedActiveView({
    record,
    accepted,
    observation,
    part: 'view',
    path: 'record.view',
    rootField: 'viewRootsAfter',
    renderedField: 'renderedRootsAfter',
    descendantsField: 'viewDescendantsAfter',
    textField: 'viewTextLengthAfter',
  })
  return Object.freeze(record)
}

/**
 * Summarize one scoped product-view scan into the compact receipt the record
 * accessibility block carries beside its gate decision.
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
 * Assemble the record.json accessibility block from the two scan scopes and
 * the two gate receipts.
 *
 * Shape contract, mirrored from axe.json: the gated product-view population is
 * the qualified one (`gatedScope`, `scopeRoot`, `scopedBefore`, `scopedAfter`,
 * `gate`), and the page-wide population is nested under `pageWide` with an
 * explicit `informational: true` marker. A reader keying off the bare field
 * name `blocking` therefore cannot find it at the top level and cannot read a
 * page-wide count as an accepted failure. The page-wide blocking count is
 * informational census only: the verdict belongs to the gate receipts, which
 * are the sole inputs to readProductAccessibilityVerdict.
 * @param {object} input assembled accessibility evidence
 * @param {object} input.pageWide compact page-wide scan report
 * @param {object} input.scopedBefore compact scoped scan before the action
 * @param {object} input.scopedAfter compact scoped scan after the action
 * @param {object} input.gateBefore gate receipt at the initial point
 * @param {object} input.gateAfter gate receipt at the after-action point
 * @returns {object} the record accessibility block
 */
export function buildProductAccessibilityEvidence(input = {}) {
  const wanted = ['pageWide', 'scopedBefore', 'scopedAfter', 'gateBefore', 'gateAfter']
  assertProductRecordFields(
    input,
    wanted,
    'accessibility',
    'record.accessibility',
    'pass the page-wide scan, both scoped scans, and both gate receipts',
  )
  const { pageWide, scopedBefore, scopedAfter, gateBefore, gateAfter } = /** @type {Record<string, any>} */ (input)
  const blocking = seriousViolations(pageWide)
  return {
    policy: PRODUCT_A11Y_POLICY,
    gatedScope: PRODUCT_A11Y_SCOPES.gated,
    scopeRoot: PRODUCT_A11Y_SCOPE_ROOT,
    scopedBefore: summarizeScopedScan(scopedBefore),
    scopedAfter: summarizeScopedScan(scopedAfter),
    gate: {
      before: { ...gateBefore },
      after: { ...gateAfter },
    },
    pageWide: {
      scope: PRODUCT_A11Y_SCOPES.page,
      root: PRODUCT_A11Y_SCOPES.pageRoot,
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
 * Verifier-facing reader for a record.json accessibility block. This is the
 * single supported way to read the row's accessibility verdict.
 *
 * The reading rule, in order:
 *   1. The verdict is the gate receipts and nothing else. `gate.before` and
 *      `gate.after` are the baseline-delta decisions taken over the gated
 *      product-view scope; the verdict is `pass` only when both read `pass`.
 *   2. `gatedScope` and `scopeRoot` state which population those receipts
 *      cover, so the verdict is never attributed to the whole document. They
 *      are compared against the app-owned declarations, not merely required to
 *      be non-empty: a record that mislabels its scope or its root is a
 *      contradiction, not a readable label.
 *   3. `scopedBefore` and `scopedAfter` are the measured populations the gate
 *      compared against the declared baseline: evidence of what was measured,
 *      not an independent verdict. Each receipt must name the app-owned policy
 *      and the observation point its slot carries, and each scoped
 *      `violations` count must equal its own receipt's `measured`, so no half
 *      of the record can contradict the other beside a `pass`.
 *   4. Each receipt's `observedSection` is the section the page actually
 *      showed when its scan was taken. It is the one value in the block that
 *      can contradict a receipt's own point name, so it is compared against
 *      the section the app declares for that point: a receipt handed the other
 *      slot's scan reads a section that point does not render, and the row is
 *      refused. (A receipt whose point was merely re-read from the declaration
 *      would have proved nothing, which is why that comparison is not the
 *      rule here.)
 *   5. `pageWide` is an informational census over the whole document. Its
 *      `violations`, `blocking`, and `blockingIds` counts are never read into
 *      the verdict: a page-wide `blocking: 7` beside a passing gate means
 *      seven serious-or-worse violations exist somewhere in the documentation
 *      page, not that seven failures were accepted. The counts stay nested
 *      and carry `informational: true` so that reading stays unambiguous.
 *
 * An unqualified page-wide count (a bare `violations`, `blocking`,
 * `blockingIds`, `incomplete`, or `passes` at the top level of the block) is
 * the ambiguous shape this reader refuses: it fails closed and names the
 * field instead of guessing which population it belongs to.
 * @param {object} accessibility the record.json accessibility block
 * @returns {{ policy: string, gatedScope: string, scopeRoot: string, result: string, points: { before: object, after: object } }} the frozen verdict read from the gate receipts
 */
export function readProductAccessibilityVerdict(accessibility) {
  assertProductRecordFields(
    accessibility,
    PRODUCT_A11Y_RECORD_FIELDS,
    'accessibility',
    'record.accessibility',
    'keep the page-wide census nested under pageWide so only the gate receipts are unqualified verdict inputs',
  )
  const record = /** @type {Record<string, any>} */ (accessibility)
  if (record.policy !== PRODUCT_A11Y_POLICY) {
    throw new Error(
      `product producer: unknown accessibility policy ${JSON.stringify(record.policy)} for field "policy" at path record.accessibility.policy; ` +
      `repair: record the app-owned policy ${JSON.stringify(PRODUCT_A11Y_POLICY)} for "policy".`,
    )
  }
  // Rules 2 and 3 are claims about WHICH population a verdict covers, so a
  // label that does not match the app-owned declaration is a contradiction,
  // not a free-form string. Validating shape alone let a record claiming
  // gatedScope "page" over root "body" read as a pass over the gated view.
  if (record.gatedScope !== PRODUCT_A11Y_SCOPES.gated) {
    throw new Error(
      `product producer: mislabeled gated scope ${JSON.stringify(record.gatedScope)} for field "gatedScope" at path record.accessibility.gatedScope; ` +
      `the verdict is only attributable to the declared gated scope ${JSON.stringify(PRODUCT_A11Y_SCOPES.gated)}; ` +
      `repair: name the gated scope ${JSON.stringify(PRODUCT_A11Y_SCOPES.gated)} so the verdict cannot be read as page-wide.`,
    )
  }
  if (record.scopeRoot !== PRODUCT_A11Y_SCOPE_ROOT) {
    throw new Error(
      `product producer: mislabeled scope root ${JSON.stringify(record.scopeRoot)} for field "scopeRoot" at path record.accessibility.scopeRoot; ` +
      `the gate covered the declared root ${JSON.stringify(PRODUCT_A11Y_SCOPE_ROOT)}; ` +
      `repair: record the selector the gate covered for "scopeRoot" instead of an unrelated root.`,
    )
  }
  const gate = record.gate
  assertProductRecordFields(
    gate,
    PRODUCT_A11Y_GATE_POINTS,
    'gate',
    'record.accessibility.gate',
    'record one gate receipt per observation point',
  )
  for (const point of PRODUCT_A11Y_GATE_POINTS) {
    const receipt = gate[point]
    const slot = `record.accessibility.gate.${point}`
    assertProductRecordFields(
      receipt,
      PRODUCT_A11Y_GATE_RECEIPT_FIELDS,
      'gate',
      slot,
      'record the baseline-delta gate receipt for both observation points',
    )
    if (receipt.policy !== PRODUCT_A11Y_POLICY) {
      throw new Error(
        `product producer: foreign gate receipt policy ${JSON.stringify(receipt.policy)} for field "policy" at path ${slot}.policy; ` +
        `the receipt must carry the app-owned policy ${JSON.stringify(PRODUCT_A11Y_POLICY)}; ` +
        `repair: record the policy the gate actually ran under for "policy".`,
      )
    }
    const declaredPoint = PRODUCT_A11Y_GATE_POINT_SLOTS[point]
    if (!PRODUCT_A11Y_POINTS.includes(/** @type {string} */ (receipt.point))) {
      throw new Error(
        `product producer: unknown gate observation point ${JSON.stringify(receipt.point)} for field "point" at path ${slot}.point; ` +
        `expected one of ${JSON.stringify([...PRODUCT_A11Y_POINTS])}; ` +
        `repair: name a declared observation point for the gate.${point} receipt.`,
      )
    }
    // The slot-to-point mapping is the reader's own, so comparing a receipt's
    // point name against it proved nothing: the row fills gate.before from that
    // same map. What CAN contradict is the section the page actually showed
    // when the scan was taken, so that is what the reader compares, and a
    // receipt handed the other slot's scan is refused.
    const declaredLabel = PRODUCT_A11Y_POINT_LABELS[declaredPoint]
    if (receipt.point !== declaredPoint || receipt.observedSection !== declaredLabel) {
      throw new Error(
        `product producer: mismatched gate observation point ${JSON.stringify(receipt.point)} for field "observedSection" at path ${slot}.observedSection; ` +
        `gate.${point} carries the ${JSON.stringify(declaredPoint)} measurement, whose section ${JSON.stringify(PRODUCT_A11Y_POINT_SECTIONS[declaredPoint])} renders as ${JSON.stringify(declaredLabel)}, but the receipt names ${JSON.stringify(receipt.point)} observed as ${JSON.stringify(receipt.observedSection)}; ` +
        `repair: take the scan at the ${JSON.stringify(declaredPoint)} observation point with the ${JSON.stringify(declaredLabel)} section active, and read the active section text beside the scan.`,
      )
    }
    if (receipt.result !== 'pass' && receipt.result !== 'fail') {
      throw new Error(
        `product producer: unknown gate result ${JSON.stringify(receipt.result)} for field "result" at path ${slot}.result; ` +
        'repair: record the gate decision as pass or fail for "result".',
      )
    }
    assertProductCount(receipt.measured, 'measured', `${slot}.measured`, 'record how many scoped violations the gate measured for "measured"')
    assertProductCount(receipt.baseline, 'baseline', `${slot}.baseline`, 'record how many baseline entries the gate compared for "baseline"')
    const scopedName = point === 'before' ? 'scopedBefore' : 'scopedAfter'
    const scopedPath = `record.accessibility.${scopedName}`
    const scoped = record[scopedName]
    assertProductRecordFields(
      scoped,
      ['violations', 'ids', 'incomplete', 'passes'],
      scopedName,
      scopedPath,
      'record the scoped measurement the gate compared against the baseline',
    )
    assertProductCount(
      scoped.violations,
      'violations',
      `${scopedPath}.violations`,
      'record the measured scoped violation count for "violations"',
    )
    valuesContract.assertStringList(scoped.ids, 'ids', `${scopedPath}.ids`)
    valuesContract.assertStringList(scoped.incomplete, 'incomplete', `${scopedPath}.incomplete`)
    // The receipt's measured count and the scoped measurement beside it
    // describe the same population at the same point. A record where they
    // disagree is self-contradictory, so the reader refuses instead of
    // reading one half and discarding the other.
    if (scoped.violations !== receipt.measured) {
      throw new Error(
        `product producer: scoped measurement contradicts the gate receipt for field "violations" at path ${scopedPath}.violations; ` +
        `${scopedName} measured ${JSON.stringify(scoped.violations)} while the gate receipt at ${slot}.measured recorded ${JSON.stringify(receipt.measured)}; ` +
        'repair: record the scoped measurement the gate receipt was computed from, never a second count beside it.',
      )
    }
  }
  const pageWide = record.pageWide
  assertProductRecordFields(
    pageWide,
    PRODUCT_A11Y_PAGE_WIDE_FIELDS,
    'pageWide',
    'record.accessibility.pageWide',
    'nest the page-wide census under pageWide with the informational marker',
  )
  if (pageWide.informational !== true) {
    throw new Error(
      `product producer: page-wide census is not marked informational for field "informational" at path record.accessibility.pageWide.informational; ` +
      `got ${JSON.stringify(pageWide.informational)}; ` +
      'repair: set informational to true so the page-wide counts can never be read as a verdict.',
    )
  }
  valuesContract.assertNonEmptyString(pageWide.scope, 'scope', 'record.accessibility.pageWide.scope')
  valuesContract.assertNonEmptyString(pageWide.root, 'root', 'record.accessibility.pageWide.root')
  for (const count of ['violations', 'blocking', 'passes']) {
    assertProductCount(pageWide[count], count, `record.accessibility.pageWide.${count}`, `record the observed page-wide ${count} count`)
  }
  valuesContract.assertStringList(pageWide.blockingIds, 'blockingIds', 'record.accessibility.pageWide.blockingIds')
  valuesContract.assertStringList(pageWide.incomplete, 'incomplete', 'record.accessibility.pageWide.incomplete')

  // The verdict reads the gate receipts only. The page-wide census above is
  // validated as evidence and then deliberately not consulted.
  const pass = PRODUCT_A11Y_GATE_POINTS.every((point) => record.gate[point].result === 'pass')
  return Object.freeze({
    policy: record.policy,
    gatedScope: record.gatedScope,
    scopeRoot: record.scopeRoot,
    result: pass ? 'pass' : 'fail',
    points: Object.freeze({
      before: Object.freeze({ ...record.gate.before }),
      after: Object.freeze({ ...record.gate.after }),
    }),
  })
}

/**
 * Assert the row's observation times are real clock readings in observation
 * order, never assembly-order offsets.
 *
 * The rule: chrome, body, and route are read by one pre-interaction
 * observation window, so they share the single reading captured immediately
 * after that window closes; the theme reading follows, and the action reading
 * follows the theme. A row whose part times disagree with each other, or that
 * claim to have observed something at or before its own row start, is
 * synthetic and fails closed.
 * @param {object} input observation times for the row
 * @param {number} input.rowStartedAtMs clock reading when the row began
 * @param {number} input.chrome observedAtMs recorded for the chrome part
 * @param {number} input.body observedAtMs recorded for the body part
 * @param {number} input.route observedAtMs recorded for the route part
 * @param {number} input.theme observedAtMs recorded for the theme observation
 * @param {number} input.action observedAtMs recorded for the named action
 * @returns {void}
 */
export function assertProductObservationTimes(input = {}) {
  const wanted = ['rowStartedAtMs', ...PRODUCT_PRE_ACTION_PARTS, 'theme', 'action']
  assertProductRecordFields(
    input,
    wanted,
    'observationTimes',
    'producer.observationTimes',
    'pass the row start reading plus one reading per observed part',
  )
  const times = /** @type {Record<string, number>} */ (/** @type {unknown} */ (input))
  for (const key of wanted) {
    if (!Number.isInteger(times[key]) || times[key] < 0) {
      throw new Error(
        `product producer: invalid observation time ${JSON.stringify(times[key])} for field "${key}" at path producer.observationTimes.${key}; ` +
        'repair: record whole milliseconds since the epoch for every observed part.',
      )
    }
  }
  for (const part of PRODUCT_PRE_ACTION_PARTS) {
    if (times[part] !== times.chrome) {
      throw new Error(
        `product producer: pre-action part ${JSON.stringify(part)} claims its own observation time ${JSON.stringify(times[part])} while the shared pre-interaction observation was read at ${JSON.stringify(times.chrome)} for field "${part}" at path resolution.${part}.observedAtMs; ` +
        'repair: capture one clock reading immediately after the pre-interaction observation and use it for chrome, body, and route instead of synthesizing per-part offsets.',
      )
    }
  }
  for (const part of PRODUCT_PRE_ACTION_PARTS) {
    if (times[part] <= times.rowStartedAtMs) {
      throw new Error(
        `product producer: part ${JSON.stringify(part)} claims observation time ${JSON.stringify(times[part])} at or before the row start ${JSON.stringify(times.rowStartedAtMs)} for field "${part}" at path resolution.${part}.observedAtMs; ` +
        'repair: capture the clock reading at the observation itself, after the evaluate that read the part, instead of offsetting it from the row start.',
      )
    }
  }
  const ordered = [['chrome', 'theme'], ['theme', 'action']]
  for (const [earlier, later] of ordered) {
    if (times[later] < times[earlier]) {
      throw new Error(
        `product producer: ${JSON.stringify(later)} observation time ${JSON.stringify(times[later])} precedes the ${JSON.stringify(earlier)} observation ${JSON.stringify(times[earlier])} for field "${later}" at path resolution.${later}.observedAtMs; ` +
        'repair: read the clock at each observation so the recorded times stay in observation order.',
      )
    }
  }
}

/**
 * Capture one product theme row on the real built surface and write its six
 * durable artifacts. The page must already belong to a browser owned by the
 * Playwright runner; the loopback service must already be ready.
 *
 * Three fail-closed invariants run inside the row, so none of these defects
 * can reach durable evidence again: prepareProductRowDir validates the run
 * subtree is fresh before the row creates it, and therefore before any
 * artifact write; assertProductObservationTimes rejects observation times
 * that are synthesized from the row start instead of read at the
 * observation; and readProductAccessibilityVerdict rejects an accessibility
 * block whose own reading rule does not report a pass. The accessibility
 * verdict comes from the gate receipts over the gated product-view scope; the
 * page-wide census stays nested and informational. The recorded body and view
 * blocks are built from the rendered measurements the single
 * assertProductActiveViewMounted predicate returned, so the record carries
 * the population the floors were applied to and not a container total.
 *
 * That predicate is reached through one seam, options.assertActiveViewMounted,
 * which defaults to the real function. The row calls it exactly twice, once per
 * observation point, and the summary reports the call sequence the row actually
 * made, so a caller can inject a recorder and observe that both call sites
 * still run at the declared pre-action and post-action points. Deleting either
 * call site shortens the reported sequence, which is what the
 * mounted-row-guard-calls case and the mounted journey both assert.
 * @param {import('@playwright/test').Page} page Playwright page for the row
 * @param {string} theme dark or light row theme
 * @param {object} [options] row options
 * @param {string} [options.runRoot] immutable run root (defaults to FAIRTEST_RUN_ROOT)
 * @param {string} [options.baseUrl] running loopback base URL
 * @param {number} [options.createdAtMs] identity creation time in whole ms
 * @param {(observed: object, context: object) => object} [options.assertActiveViewMounted] rendered-active-view guard, defaults to the real predicate
 * @returns {Promise<object>} row summary with proof, provenance, accessibility evidence and its verdict, real observation times, the recorded rendered measurements, the rendered-view guard call sequence, and artifact paths
 */
export async function captureProductRow(page, theme, options = {}) {
  if (!ROW_THEMES.includes(theme)) {
    throw new Error(
      `product producer: unknown row theme ${JSON.stringify(theme)} for field "theme" at path row.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  if (options.assertActiveViewMounted !== undefined && typeof options.assertActiveViewMounted !== 'function') {
    throw new Error(
      `product producer: invalid rendered-view guard ${JSON.stringify(options.assertActiveViewMounted)} for field "assertActiveViewMounted" at path row.assertActiveViewMounted; ` +
      'repair: omit the option to use the real rendered-active-view predicate, or pass a function with the same contract.',
    )
  }
  // The one seam the rendered-view predicate is reached through. The default is
  // the real function; a caller may substitute a recorder to observe the call
  // sites without changing what the row decides.
  const activeViewGuard = options.assertActiveViewMounted ?? assertProductActiveViewMounted
  const activeViewGuardCalls = []
  const runRoot = resolve(options.runRoot ?? resolveProductRunRoot())
  const baseUrl = options.baseUrl || FAIRTEST_APP_BASE_URL
  const createdAtMs = options.createdAtMs ?? Date.now()
  if (!Number.isInteger(createdAtMs) || createdAtMs < 0) {
    throw new Error(
      `product producer: invalid creation time ${JSON.stringify(createdAtMs)} for field "createdAtMs" at path row.createdAtMs; ` +
      'repair: use whole milliseconds since the epoch for "createdAtMs".',
    )
  }
  const row = productThemeRow(theme)
  // Freshness first, then the row directory. The run-root guard is reachable
  // only through this preparation seam, so no artifact write can land in a
  // previous run subtree before the guard has refused it.
  const { rowDir } = prepareProductRowDir({ runRoot, theme })
  if (!existsSync(join(DIST_ROOT, 'index.html'))) {
    throw new Error(
      'product producer: built app is missing for field "dist" at path row.dist; ' +
      `looked for ${JSON.stringify(join(DIST_ROOT, 'index.html'))}; ` +
      'repair: run pnpm build before the mounted row so dist/ holds the exact built app.',
    )
  }

  const rowStartedAtMs = Date.now()
  await page.setViewportSize({ ...PRODUCT_VIEWPORT })
  const url = `${baseUrl}${row.route}`
  await page.goto(url, { waitUntil: 'networkidle' })

  /**
   * Wait for one selector and name it in fail-closed diagnostics.
   * @param {string} selector selector to wait for
   * @param {string} part observed part name
   */
  async function requireMounted(selector, part) {
    try {
      await page.waitForSelector(selector, { timeout: PRODUCT_MOUNT_TIMEOUT_MS, state: 'attached' })
    } catch {
      throw new Error(
        `product producer: missing ${part} for field "${part}" at path proof.${part}; ` +
        `selector ${JSON.stringify(selector)} never attached within ${PRODUCT_MOUNT_TIMEOUT_MS}ms at ${JSON.stringify(url)}; ` +
        `repair: rebuild dist/ and keep the ${part} selector ${JSON.stringify(selector)} mounted on the product path.`,
      )
    }
  }

  await requireMounted(PRODUCT_SELECTORS.chrome, 'chrome')
  await requireMounted(PRODUCT_SELECTORS.sectionNav, 'section')
  await requireMounted(PRODUCT_SELECTORS.sectionView, 'view')
  await requireMounted(PRODUCT_SELECTORS.body, 'body')

  const before = await page.evaluate((selectors) => {
    const query = (name) => document.querySelector(selectors[name])
    const bar = query('chrome')
    const view = query('body')
    const stage = query('sectionView')
    const active = document.querySelector(selectors.activeSection)
    const barRect = bar ? bar.getBoundingClientRect() : null
    const viewRect = view ? view.getBoundingClientRect() : null
    return {
      rawTheme: document.documentElement.getAttribute('data-theme'),
      chromeChildren: bar ? bar.childElementCount : -1,
      chromeTextLength: ((bar ? bar.textContent : '') || '').trim().length,
      chromeBox: barRect ? { width: Math.round(barRect.width), height: Math.round(barRect.height) } : null,
      bodyChildren: view ? view.childElementCount : -1,
      bodyBox: viewRect ? { width: Math.round(viewRect.width), height: Math.round(viewRect.height) } : null,
      stagePresent: !!stage,
      stageDescendants: stage ? stage.querySelectorAll('*').length : -1,
      activeText: active ? (active.textContent || '').trim() : null,
      activeHasClass: !!document.querySelector(selectors.activeSectionItem),
      location: location.pathname + location.search + location.hash,
      computed: {
        viewBackground: view ? getComputedStyle(view).backgroundColor : null,
        ink: (getComputedStyle(document.documentElement).getPropertyValue('--ink') || '').trim(),
        canvas: (getComputedStyle(document.documentElement).getPropertyValue('--canvas') || '').trim(),
      },
    }
  }, PRODUCT_SELECTORS)
  // The representative body is the RENDERED active view, measured by the one
  // shared in-page measurement the named blank-active-view and
  // unrendered-active-view mutations also drive. The container totals it
  // returns include the permanently mounted hidden changes view and are
  // recorded beside the measurement for contrast only.
  const activeBefore = await page.evaluate(measureProductView, PRODUCT_VIEW_SELECTORS)

  // One real clock reading for everything that evaluate just read. Nothing
  // below derives a part time from the row start: the timestamp names the
  // observation, not the assembly order.
  const partsObservedAtMs = Date.now()

  if (!before.chromeBox || before.chromeBox.width <= 0 || before.chromeBox.height <= 0 || before.chromeChildren < 1) {
    throw new Error(
      `product producer: empty persistent chrome for field "chrome" at path proof.chrome; ` +
      `selector ${JSON.stringify(PRODUCT_SELECTORS.chrome)} has ${before.chromeChildren} children and box ${JSON.stringify(before.chromeBox)}; ` +
      `repair: keep the persistent chrome mounted and non-empty on the product path.`,
    )
  }
  if (!before.bodyBox || before.bodyBox.width <= 0 || before.bodyBox.height <= 0) {
    throw new Error(
      `product producer: unrendered representative body for field "body" at path proof.body; ` +
      `selector ${JSON.stringify(PRODUCT_SELECTORS.body)} has box ${JSON.stringify(before.bodyBox)}; ` +
      'repair: keep the analytics dashboard laid out with a rendered box instead of a collapsed section.',
    )
  }
  const acceptedBefore = activeViewGuard(activeBefore, {
    label: 'blank representative body',
    part: 'body',
    path: 'proof.body',
    repair: `keep the ${PRODUCT_INITIAL_SECTION} dashboard mounted and rendered with non-trivial content instead of a blank section`,
  })
  activeViewGuardCalls.push('body@proof.body')
  if (before.location !== row.route) {
    throw new Error(
      `product producer: route mismatch for field "route" at path proof.route; ` +
      `observed ${JSON.stringify(before.location)} but the row declares ${JSON.stringify(row.route)}; ` +
      'repair: navigate to the exact row route before observing the product tuple.',
    )
  }
  if (before.activeText !== PRODUCT_INITIAL_SECTION) {
    throw new Error(
      `product producer: unexpected initial section ${JSON.stringify(before.activeText)} for field "activeSection" at path proof.activeSection; ` +
      `repair: start the proof from ${JSON.stringify(PRODUCT_INITIAL_SECTION)} for the initial section.`,
    )
  }
  if (!before.stagePresent || before.stageDescendants < 1) {
    throw new Error(
      `product producer: missing mounted view for field "view" at path proof.view; ` +
      `selector ${JSON.stringify(PRODUCT_SELECTORS.sectionView)} present ${before.stagePresent} with ${before.stageDescendants} descendants; ` +
      'repair: keep the tabpanel mount with the active view on the product path.',
    )
  }
  if (!before.computed.ink || !before.computed.canvas) {
    throw new Error(
      'product producer: unthemed computed tokens for field "computedStyles" at path evidence.computedStyles; ' +
      `resolved --ink ${JSON.stringify(before.computed.ink)} --canvas ${JSON.stringify(before.computed.canvas)}; ` +
      'repair: keep the mounted surface themed by design tokens so the resolved custom properties are non-empty.',
    )
  }

  const themeObservation = observeProductTheme({
    expected: theme,
    renderedAttribute: before.rawTheme,
    source: 'product-producer:documentElement:data-theme',
    observedAtMs: Date.now(),
  })
  const themeObservedAtMs = themeObservation.observedAtMs
  assertProductThemeObservation(themeObservation)
  kindsContract.validateThemeObservation(themeObservation, 'product producer')

  // scanProductViewAxe already ran the one shape assertion over this scan, so
  // there is no second guard here: a scan that arrives without a violation list
  // is refused inside the scan call with the scan's own path, and a decorative
  // re-check after it could only ever be unreachable.
  const scopedBefore = await scanProductViewAxe(page, 'scopedBefore')

  const mapButton = page.locator(`${PRODUCT_SELECTORS.sectionNav} ${PRODUCT_SELECTORS.sectionItem}`, { hasText: PRODUCT_ACTION_LABEL })
  try {
    await mapButton.first().click({ timeout: PRODUCT_ACTION_TIMEOUT_MS })
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `product producer: named action did not complete for field "action" at path proof.action; ` +
      `click on the ${JSON.stringify(PRODUCT_ACTION_LABEL)} section failed: ${cause}; ` +
      `repair: keep the ${JSON.stringify(PRODUCT_ACTION_TO_SECTION)} section button clickable in ${JSON.stringify(PRODUCT_SELECTORS.sectionNav)}.`,
    )
  }
  try {
    await page.waitForFunction(
      (selectors) => {
        const el = document.querySelector(selectors.activeSection);
        return !!el && el.textContent.trim().toLowerCase().includes(selectors.actionLabel);
      },
      { activeSection: PRODUCT_SELECTORS.activeSection, actionLabel: PRODUCT_ACTION_LABEL.toLowerCase() },
      { timeout: PRODUCT_ACTION_TIMEOUT_MS },
    )
  } catch {
    throw new Error(
      `product producer: active section did not become ${JSON.stringify(PRODUCT_ACTION_TO_SECTION)} for field "activeSection" at path proof.activeSection; ` +
      'repair: selecting the map section must mark its button with the shell active class and aria-current="page".',
    )
  }

  const after = await page.evaluate((selectors) => {
    const active = document.querySelector(selectors.activeSection)
    const stage = document.querySelector(selectors.sectionView)
    return {
      activeText: active ? (active.textContent || '').trim() : null,
      activeHasClass: !!document.querySelector(selectors.activeSectionItem),
      stageDescendants: stage ? stage.querySelectorAll('*').length : -1,
      location: location.pathname + location.search + location.hash,
    }
  }, PRODUCT_SELECTORS)
  // Same shared rendered active-view measurement and the same single rendered
  // predicate as the pre-interaction read, so the post-action floor is never
  // satisfied by the hidden changes view or by an unrendered map view.
  const activeAfter = await page.evaluate(measureProductView, PRODUCT_VIEW_SELECTORS)

  if (!after.activeText || !after.activeText.toLowerCase().includes(PRODUCT_ACTION_LABEL) || !after.activeHasClass) {
    throw new Error(
      `product producer: unproven section transition for field "activeSection" at path proof.activeSection; ` +
      `active button reads ${JSON.stringify(after.activeText)} with active class ${after.activeHasClass}; ` +
      'repair: the named action must leave the map button active with aria-current="page".',
    )
  }
  if (activeAfter.container.descendants < 1) {
    throw new Error(
      `product producer: unmounted view container after the action for field "view" at path proof.view; ` +
      `selector ${JSON.stringify(PRODUCT_SELECTORS.body)} carries ${activeAfter.container.descendants} descendants; ` +
      'repair: keep the map view mounted inside the view container after the section switch.',
    )
  }
  const acceptedAfter = activeViewGuard(activeAfter, {
    label: 'blank mounted view after the action',
    part: 'view',
    path: 'proof.view',
    repair: `keep the ${PRODUCT_ACTION_TO_SECTION} view mounted and rendered with non-trivial content after the section switch`,
  })
  activeViewGuardCalls.push('view@proof.view')

  const actionObservedAtMs = Date.now()
  assertProductObservationTimes({
    rowStartedAtMs,
    chrome: partsObservedAtMs,
    body: partsObservedAtMs,
    route: partsObservedAtMs,
    theme: themeObservedAtMs,
    action: actionObservedAtMs,
  })
  const proof = buildProductProof({
    rowTheme: theme,
    identity: { kind: 'product', id: PRODUCT_TARGET_ID, createdAtMs },
    chrome: { observed: true, observedAtMs: partsObservedAtMs },
    body: { observed: true, observedAtMs: partsObservedAtMs },
    route: { observed: true, observedAtMs: partsObservedAtMs },
    activeSection: { observed: true, observedAtMs: actionObservedAtMs },
    view: { observed: true, observedAtMs: actionObservedAtMs },
    themeObservation: { ...themeObservation },
    initialSection: PRODUCT_INITIAL_SECTION,
    activeSectionId: PRODUCT_ACTION_TO_SECTION,
    action: { name: PRODUCT_ACTION_NAME, completed: true, observedAtMs: actionObservedAtMs },
  })

  const pageWide = await scanAxe(page)
  // assertProductAxeScanShape is the single owner of the compact-report shape
  // for every scan this row records, page-wide included; the page-wide scan has
  // no root to scope through scanProductViewAxe, so it calls the shared
  // assertion directly and carries no second local guard.
  assertProductAxeScanShape(pageWide, 'pageWide', 'evidence.axe.pageWide')
  const scopedAfter = await scanProductViewAxe(page, 'scopedAfter')
  const axeRecord = {
    target: PRODUCT_TARGET_ID,
    rowTheme: theme,
    policy: PRODUCT_A11Y_POLICY,
    scopeRoot: PRODUCT_A11Y_SCOPE_ROOT,
    baseline: {
      policy: PRODUCT_A11Y_BASELINE.policy,
      scopeRoot: PRODUCT_A11Y_BASELINE.scopeRoot,
      points: Object.fromEntries(PRODUCT_A11Y_POINTS.map((point) => [
        point,
        PRODUCT_A11Y_BASELINE.points[point].map((entry) => ({ ...entry, themes: [...entry.themes] })),
      ])),
    },
    scoped: {
      scope: PRODUCT_A11Y_SCOPES.gated,
      root: PRODUCT_A11Y_SCOPE_ROOT,
      // declaredSection is the label the registry predicts; observedSection is
      // what the page showed. They are named apart so a reader can never take
      // the prediction for the observation.
      before: { declaredSection: PRODUCT_A11Y_POINT_SECTIONS[PRODUCT_A11Y_GATE_POINT_SLOTS.before], observedSection: before.activeText, ...scopedBefore },
      after: { declaredSection: PRODUCT_A11Y_POINT_SECTIONS[PRODUCT_A11Y_GATE_POINT_SLOTS.after], observedSection: after.activeText, ...scopedAfter },
    },
    pageWide: { scope: PRODUCT_A11Y_SCOPES.page, root: PRODUCT_A11Y_SCOPES.pageRoot, ...pageWide },
  }
  const axePath = join(rowDir, 'axe.json')
  writeFileSync(axePath, `${JSON.stringify(axeRecord, null, 2)}\n`)
  // The section each receipt carries is read from the page, not copied from the
  // declaration: the initial slot is gated against the section the pre-action
  // observation read, and the after-action slot against the section the
  // post-action observation read. Two scans swapped therefore produce two
  // receipts that name a section their point does not render, and the
  // verifier-facing reader refuses them.
  const gateBefore = assertProductAxeBaselineDelta({
    point: PRODUCT_A11Y_GATE_POINT_SLOTS.before,
    observedSection: before.activeText,
    measured: summarizeAxeForGate(scopedBefore),
    baseline: PRODUCT_A11Y_BASELINE.points[PRODUCT_A11Y_GATE_POINT_SLOTS.before].map((entry) => ({ ...entry })),
    artifactPath: axePath,
  })
  const gateAfter = assertProductAxeBaselineDelta({
    point: PRODUCT_A11Y_GATE_POINT_SLOTS.after,
    observedSection: after.activeText,
    measured: summarizeAxeForGate(scopedAfter),
    baseline: PRODUCT_A11Y_BASELINE.points[PRODUCT_A11Y_GATE_POINT_SLOTS.after].map((entry) => ({ ...entry })),
    artifactPath: axePath,
  })

  const ariaSnapshot = await page.locator(PRODUCT_SELECTORS.shell).ariaSnapshot()
  if (!ariaSnapshot || ariaSnapshot.trim().length < 50) {
    throw new Error(
      'product producer: empty ARIA snapshot for field "aria" at path evidence.aria; ' +
      'repair: keep the in-use shell mounted so its accessible tree is non-trivial.',
    )
  }

  const screenshotPath = join(rowDir, 'screenshot.png')
  await page.screenshot({ path: screenshotPath })
  const screenshotBytes = statSync(screenshotPath).size
  if (screenshotBytes < 8000) {
    throw new Error(
      `product producer: blank screenshot for field "screenshot" at path evidence.screenshot; ` +
      `wrote ${screenshotBytes} bytes to ${JSON.stringify(screenshotPath)}; ` +
      'repair: keep the mounted product view rendered so the capture is non-blank.',
    )
  }

  // The record a verifier reads is assembled once, then read back through the
  // one supported reader: a row can never write accessibility evidence whose
  // own reading rule reports anything but a pass.
  const accessibility = buildProductAccessibilityEvidence({
    pageWide,
    scopedBefore,
    scopedAfter,
    gateBefore,
    gateAfter,
  })
  const accessibilityVerdict = readProductAccessibilityVerdict(accessibility)
  if (accessibilityVerdict.result !== 'pass') {
    throw new Error(
      `product producer: accessibility verdict reads ${JSON.stringify(accessibilityVerdict.result)} for field "accessibility" at path record.accessibility.gate; ` +
      `the gated receipts read before ${JSON.stringify(accessibilityVerdict.points.before.result)} and after ${JSON.stringify(accessibilityVerdict.points.after.result)} over ${JSON.stringify(accessibilityVerdict.scopeRoot)}; ` +
      'repair: fix the gated product-view violation instead of relying on the informational page-wide census under record.accessibility.pageWide.',
    )
  }

  const servedHtml = await fetchText(`${baseUrl}/index.html`)
  const provenance = await collectServedProvenance({
    baseUrl,
    servedHtml,
    viewport: { ...PRODUCT_VIEWPORT },
    targetIdentity: { kind: 'product', id: PRODUCT_TARGET_ID, createdAtMs },
    themeObservations: [{ ...themeObservation }],
  })

  const record = {
    target: PRODUCT_TARGET_ID,
    kind: 'product',
    rowTheme: theme,
    route: row.route,
    observedRoute: before.location,
    initialSection: PRODUCT_INITIAL_SECTION,
    activeSectionBefore: before.activeText,
    activeSectionAfter: after.activeText,
    interaction: {
      name: PRODUCT_ACTION_NAME,
      from: PRODUCT_INITIAL_SECTION,
      to: PRODUCT_ACTION_TO_SECTION,
      completed: true,
      observedAtMs: actionObservedAtMs,
    },
    theme: { ...themeObservation },
    chrome: {
      selector: PRODUCT_SELECTORS.chrome,
      children: before.chromeChildren,
      box: before.chromeBox,
    },
    // The recorded body numbers are the RENDERED active view's, so a verifier
    // reading record.json sees the population the floors were applied to. The
    // container totals stay beside them, explicitly labelled, because they
    // include the permanently mounted hidden changes view, and the
    // rendered/total root split is recorded so an unrendered root could never
    // hide inside an unqualified count.
    body: buildProductBodyRecord({ accepted: acceptedBefore, observation: activeBefore, box: before.bodyBox }),
    view: buildProductViewRecord({ accepted: acceptedAfter, observation: activeAfter, stageDescendantsAfter: after.stageDescendants }),
    computedStyles: { ...before.computed },
    viewport: { ...PRODUCT_VIEWPORT },
    accessibility,
    producedAtMs: Date.now(),
  }

  writeFileSync(join(rowDir, 'record.json'), `${JSON.stringify(record, null, 2)}\n`)
  writeFileSync(join(rowDir, 'aria.json'), `${JSON.stringify({ target: PRODUCT_TARGET_ID, rowTheme: theme, snapshot: ariaSnapshot }, null, 2)}\n`)
  writeFileSync(join(rowDir, 'provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`)
  writeFileSync(join(rowDir, 'resolution.json'), `${JSON.stringify(proof, null, 2)}\n`)

  for (const name of PRODUCT_ARTIFACT_CLASSES) {
    if (!existsSync(join(rowDir, name))) {
      throw new Error(
        `product producer: missing artifact ${JSON.stringify(name)} for field "artifact" at path run.rowDir/${name}; ` +
        'repair: keep the six artifact writes intact so every row ends with the complete set.',
      )
    }
  }

  return {
    theme,
    rowDir,
    proof,
    provenance,
    accessibility,
    accessibilityVerdict,
    // The rendered measurements the recorded body and view blocks carry, so a
    // consumer of this summary compares the same triple the record was built
    // from instead of re-deriving it.
    body: acceptedBefore,
    view: acceptedAfter,
    observationTimes: Object.freeze({
      rowStartedAtMs,
      parts: partsObservedAtMs,
      theme: themeObservedAtMs,
      action: actionObservedAtMs,
    }),
    // The rendered-view guard call sequence this row actually made, in order:
    // the pre-action body point and the post-action view point. A consumer can
    // compare it against the declared pair, and an injected recorder sees
    // exactly the same two calls.
    activeViewGuards: Object.freeze([...activeViewGuardCalls]),
    artifacts: PRODUCT_ARTIFACT_CLASSES.map((name) => join(rowDir, name)),
  }
}

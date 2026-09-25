// Fairtrade-owned mounted product producer: browser-bearing host runtime and
// durable raw artifact writer for the built graph product target.
//
// This module never invents routes, selectors, theme semantics, or proof
// vocabulary. Every one of those comes from fairtrade-targets.mjs (app-owned
// target registry) and the shared host contract through the sole source
// route. The caller supplies the Playwright page; this module performs the
// row-scoped observation sequence and writes exactly six artifact classes
// per theme row into an immutable run root.
//
// Row sequence per theme (dark, light): serve the row route, wait for genuine
// mount (selector readiness, never a fixed sleep alone), observe chrome, body,
// exact route, initial active section, mounted view, and normalized theme
// AFTER mount and BEFORE interaction, perform ONE trusted click on the map
// section, observe the active section transition analytics to map plus the
// updated mounted view, then build the proof through buildProductProof.
//
// Fail-closed: any missing, contradictory, or unproven part throws an
// actionable error naming the missing part, the selector or path, and the
// repair. A failing row never writes a passing record.

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AxeBuilder } from '@axe-core/playwright'
import { importFairtestSource } from '../fairtest-source.mjs'
import {
  PRODUCT_ACTION_NAME,
  PRODUCT_ACTION_TO_SECTION,
  PRODUCT_A11Y_BASELINE,
  PRODUCT_A11Y_POINT_SECTIONS,
  PRODUCT_A11Y_POLICY,
  PRODUCT_A11Y_SCOPE_ROOT,
  PRODUCT_INITIAL_SECTION,
  PRODUCT_PROVENANCE_SOURCE,
  PRODUCT_SELECTORS,
  PRODUCT_TARGET_ID,
  assertProductAxeBaselineDelta,
  assertProductThemeObservation,
  buildProductProof,
  observeProductTheme,
  productRouteForTheme,
  productThemeRow,
} from './fairtrade-targets.mjs'
import { DEFAULT_AXE_TAGS, scanAxe, seriousViolations } from '../journey/lib/assertions.mjs'

const kindsContract = await importFairtestSource('src/host-contract/kinds.mjs')

/**
 * Fixed loopback port for the built app. Mirrors the port owned by the
 * Fairtest Playwright config; the config is the owner, this default keeps
 * direct producer use on the same port. Override with FAIRTEST_APP_PORT.
 * @type {number}
 */
export const FAIRTEST_PRODUCT_PORT = Number(process.env.FAIRTEST_APP_PORT || 5189)

/**
 * Loopback host for the built app. Never a wildcard listener.
 * @type {string}
 */
export const FAIRTEST_PRODUCT_HOST = '127.0.0.1'

/**
 * Explicit viewport every product row renders at. Recorded in provenance.
 * @type {{ width: number, height: number }}
 */
export const PRODUCT_VIEWPORT = Object.freeze({ width: 1280, height: 720 })

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
 * Minimum descendant element count inside .iu-view that counts as a
 * non-blank representative body. The analytics dashboard renders hundreds of
 * nodes (834 descendants observed on the real built surface); a blank or
 * failed mount renders near zero. The margin is wide on purpose: anything
 * below this floor is unproven body content, not a close call.
 * @type {number}
 */
export const PRODUCT_MIN_BODY_DESCENDANTS = 20

/**
 * Minimum trimmed text length inside .iu-view that counts as non-blank
 * body content. The real dashboard carries about 2000 characters; a blank
 * section carries near zero.
 * @type {number}
 */
export const PRODUCT_MIN_BODY_TEXT_LENGTH = 200

/**
 * Mount wait budget per selector in milliseconds.
 * @type {number}
 */
export const PRODUCT_MOUNT_TIMEOUT_MS = 15000

/**
 * Post-click settle budget for the active section transition in milliseconds.
 * @type {number}
 */
export const PRODUCT_ACTION_TIMEOUT_MS = 10000

const ROW_THEMES = Object.freeze(['dark', 'light'])
const DIST_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist')

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
 * Assert the row directory is fresh: none of the six artifact classes may
 * already exist. A rerun must use a fresh run root, never silently append
 * into a previous run subtree.
 * @param {string} rowDir row directory
 */
function assertRowDirFresh(rowDir) {
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
 * Create a loopback static driver serving the exact built app from dist/.
 * The driver starts one http server on the fixed loopback port, reports
 * readiness over real HTTP, and stops exactly once (second stop is a safe
 * no-op so adapter teardown stays idempotent).
 * @param {object} [options] driver options
 * @param {number} [options.port] fixed loopback port
 * @param {string} [options.host] loopback host, always 127.0.0.1
 * @param {string} [options.distRoot] built app root served over HTTP
 * @returns {object} the injected lifecycle driver for createFairtradeAdapter
 */
export function createProductStaticDriver(options = {}) {
  const port = options.port ?? FAIRTEST_PRODUCT_PORT
  const host = options.host ?? FAIRTEST_PRODUCT_HOST
  const distRoot = options.distRoot ?? DIST_ROOT
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `product producer: invalid port ${JSON.stringify(port)} for field "port" at path driver.port; ` +
      'repair: use the fixed loopback port owned by the Fairtest config for "port".',
    )
  }
  if (host !== '127.0.0.1') {
    throw new Error(
      `product producer: non-loopback host ${JSON.stringify(host)} for field "host" at path driver.host; ` +
      'repair: bind the built app to 127.0.0.1 for "host".',
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
 * Collect served-build provenance over real HTTP: the served index.html
 * bytes plus every served asset file the page actually references.
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
  return {
    source: PRODUCT_PROVENANCE_SOURCE.source,
    root: PRODUCT_PROVENANCE_SOURCE.root,
    commit,
    dirty,
    assetDigests,
    viewport: { ...viewport },
    targetIdentity: { ...targetIdentity },
    themeObservations: themeObservations.map((entry) => ({ ...entry })),
    servedUrl: baseUrl,
    producedAtMs: Date.now(),
  }
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
 * Run axe-core scoped to one root on the current page and return the same
 * compact JSON-serializable shape as the shared page-wide scanAxe, so both
 * scopes stay comparable in the row artifact. Built here in the producer
 * because the shared assertion helper owns only the page-wide scan.
 * @param {import('@playwright/test').Page} page Playwright page for the row
 * @param {string} rootSelector scope root, always the product view root
 * @param {string[]} [tags] axe tags, pinned to the shared default
 * @returns {Promise<object>} the compact scoped report
 */
async function scanAxeAtRoot(page, rootSelector, tags = DEFAULT_AXE_TAGS) {
  const results = await new AxeBuilder({ page }).withTags(tags).include(rootSelector).analyze()
  return {
    tags: [...tags],
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
    incomplete: results.incomplete.map((v) => v.id),
    passes: results.passes.length,
  }
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
 * Capture one product theme row on the real built surface and write its six
 * durable artifacts. The page must already belong to a browser owned by the
 * Playwright runner; the loopback service must already be ready.
 * @param {import('@playwright/test').Page} page Playwright page for the row
 * @param {string} theme dark or light row theme
 * @param {object} [options] row options
 * @param {string} [options.runRoot] immutable run root (defaults to FAIRTEST_RUN_ROOT)
 * @param {string} [options.baseUrl] running loopback base URL
 * @param {number} [options.createdAtMs] identity creation time in whole ms
 * @returns {Promise<object>} row summary with proof, provenance, and artifact paths
 */
export async function captureProductRow(page, theme, options = {}) {
  if (!ROW_THEMES.includes(theme)) {
    throw new Error(
      `product producer: unknown row theme ${JSON.stringify(theme)} for field "theme" at path row.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  const runRoot = resolve(options.runRoot ?? resolveProductRunRoot())
  const baseUrl = options.baseUrl || `http://${FAIRTEST_PRODUCT_HOST}:${FAIRTEST_PRODUCT_PORT}`
  const createdAtMs = options.createdAtMs ?? Date.now()
  if (!Number.isInteger(createdAtMs) || createdAtMs < 0) {
    throw new Error(
      `product producer: invalid creation time ${JSON.stringify(createdAtMs)} for field "createdAtMs" at path row.createdAtMs; ` +
      'repair: use whole milliseconds since the epoch for "createdAtMs".',
    )
  }
  const row = productThemeRow(theme)
  const rowDir = productRowDir(runRoot, theme)
  mkdirSync(rowDir, { recursive: true })
  assertRowDirFresh(rowDir)
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
    const descendants = view ? view.querySelectorAll('*').length : -1
    return {
      rawTheme: document.documentElement.getAttribute('data-theme'),
      chromeChildren: bar ? bar.childElementCount : -1,
      chromeTextLength: ((bar ? bar.textContent : '') || '').trim().length,
      chromeBox: barRect ? { width: Math.round(barRect.width), height: Math.round(barRect.height) } : null,
      bodyChildren: view ? view.childElementCount : -1,
      bodyDescendants: descendants,
      bodyTextLength: ((view ? view.textContent : '') || '').trim().length,
      bodyBox: viewRect ? { width: Math.round(viewRect.width), height: Math.round(viewRect.height) } : null,
      stagePresent: !!stage,
      stageDescendants: stage ? stage.querySelectorAll('*').length : -1,
      activeText: active ? (active.textContent || '').trim() : null,
      activeHasClass: !!document.querySelector('.iu-subnav-item.active'),
      location: location.pathname + location.search + location.hash,
      computed: {
        viewBackground: view ? getComputedStyle(view).backgroundColor : null,
        ink: (getComputedStyle(document.documentElement).getPropertyValue('--ink') || '').trim(),
        canvas: (getComputedStyle(document.documentElement).getPropertyValue('--canvas') || '').trim(),
      },
    }
  }, PRODUCT_SELECTORS)

  if (!before.chromeBox || before.chromeBox.width <= 0 || before.chromeBox.height <= 0 || before.chromeChildren < 1) {
    throw new Error(
      `product producer: empty persistent chrome for field "chrome" at path proof.chrome; ` +
      `selector ${JSON.stringify(PRODUCT_SELECTORS.chrome)} has ${before.chromeChildren} children and box ${JSON.stringify(before.chromeBox)}; ` +
      `repair: keep the persistent chrome mounted and non-empty on the product path.`,
    )
  }
  if (
    before.bodyDescendants < PRODUCT_MIN_BODY_DESCENDANTS ||
    before.bodyTextLength < PRODUCT_MIN_BODY_TEXT_LENGTH ||
    !before.bodyBox || before.bodyBox.width <= 0 || before.bodyBox.height <= 0
  ) {
    throw new Error(
      `product producer: blank representative body for field "body" at path proof.body; ` +
      `selector ${JSON.stringify(PRODUCT_SELECTORS.body)} has ${before.bodyDescendants} descendants, ` +
      `${before.bodyTextLength} text characters, box ${JSON.stringify(before.bodyBox)}; ` +
      `floor is ${PRODUCT_MIN_BODY_DESCENDANTS} descendants and ${PRODUCT_MIN_BODY_TEXT_LENGTH} characters; ` +
      'repair: keep the analytics dashboard mounted with non-trivial content instead of a blank section.',
    )
  }
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
  assertProductThemeObservation(themeObservation)
  kindsContract.validateThemeObservation(themeObservation, 'product producer')

  const scopedBefore = await scanAxeAtRoot(page, PRODUCT_A11Y_SCOPE_ROOT)
  if (!scopedBefore || !Array.isArray(scopedBefore.violations)) {
    throw new Error(
      'product producer: missing scoped accessibility scan for field "scopedBefore" at path evidence.axe.scoped.before; ' +
      `selector ${JSON.stringify(PRODUCT_A11Y_SCOPE_ROOT)} returned no compact report; ` +
      'repair: keep the product-view scoped scan wired at the initial observation point.',
    )
  }

  const mapButton = page.locator(`${PRODUCT_SELECTORS.sectionNav} .iu-subnav-item`, { hasText: 'code map' })
  try {
    await mapButton.first().click({ timeout: PRODUCT_ACTION_TIMEOUT_MS })
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    throw new Error(
      `product producer: named action did not complete for field "action" at path proof.action; ` +
      `click on the map section failed: ${cause}; ` +
      `repair: keep the ${JSON.stringify(PRODUCT_ACTION_TO_SECTION)} section button clickable in ${JSON.stringify(PRODUCT_SELECTORS.sectionNav)}.`,
    )
  }
  try {
    await page.waitForFunction(
      (expected) => {
        const el = document.querySelector('.iu-subnav-item[aria-current="page"]');
        return !!el && el.textContent.trim().toLowerCase().includes(expected);
      },
      'code map',
      { timeout: PRODUCT_ACTION_TIMEOUT_MS },
    )
  } catch {
    throw new Error(
      `product producer: active section did not become ${JSON.stringify(PRODUCT_ACTION_TO_SECTION)} for field "activeSection" at path proof.activeSection; ` +
      `repair: selecting the map section must mark its button .active with aria-current="page".`,
    )
  }

  const after = await page.evaluate((selectors) => {
    const active = document.querySelector(selectors.activeSection)
    const stage = document.querySelector(selectors.sectionView)
    const view = document.querySelector(selectors.body)
    return {
      activeText: active ? (active.textContent || '').trim() : null,
      activeHasClass: !!document.querySelector('.iu-subnav-item.active'),
      stageDescendants: stage ? stage.querySelectorAll('*').length : -1,
      viewDescendants: view ? view.querySelectorAll('*').length : -1,
      viewTextLength: ((view ? view.textContent : '') || '').trim().length,
      location: location.pathname + location.search + location.hash,
    }
  }, PRODUCT_SELECTORS)

  if (!after.activeText || !after.activeText.toLowerCase().includes('code map') || !after.activeHasClass) {
    throw new Error(
      `product producer: unproven section transition for field "activeSection" at path proof.activeSection; ` +
      `active button reads ${JSON.stringify(after.activeText)} with active class ${after.activeHasClass}; ` +
      `repair: the named action must leave the map button active with aria-current="page".`,
    )
  }
  if (after.viewDescendants < PRODUCT_MIN_BODY_DESCENDANTS || after.viewTextLength < PRODUCT_MIN_BODY_TEXT_LENGTH) {
    throw new Error(
      `product producer: blank mounted view after the action for field "view" at path proof.view; ` +
      `view has ${after.viewDescendants} descendants and ${after.viewTextLength} text characters; ` +
      'repair: keep the map view mounted with non-trivial content after the section switch.',
    )
  }

  const actionObservedAtMs = Date.now()
  const proof = buildProductProof({
    rowTheme: theme,
    identity: { kind: 'product', id: PRODUCT_TARGET_ID, createdAtMs },
    chrome: { observed: true, observedAtMs: rowStartedAtMs },
    body: { observed: true, observedAtMs: rowStartedAtMs + 1 },
    route: { observed: true, observedAtMs: rowStartedAtMs + 2 },
    activeSection: { observed: true, observedAtMs: actionObservedAtMs },
    view: { observed: true, observedAtMs: actionObservedAtMs },
    themeObservation: { ...themeObservation },
    initialSection: PRODUCT_INITIAL_SECTION,
    activeSectionId: PRODUCT_ACTION_TO_SECTION,
    action: { name: PRODUCT_ACTION_NAME, completed: true, observedAtMs: actionObservedAtMs },
  })

  const pageWide = await scanAxe(page)
  if (!pageWide || !Array.isArray(pageWide.violations)) {
    throw new Error(
      'product producer: missing accessibility scan for field "pageWide" at path evidence.axe.pageWide; ' +
      'repair: keep the page-wide axe scan wired so every row records its violations, incomplete, and pass counts.',
    )
  }
  const scopedAfter = await scanAxeAtRoot(page, PRODUCT_A11Y_SCOPE_ROOT)
  if (!scopedAfter || !Array.isArray(scopedAfter.violations)) {
    throw new Error(
      'product producer: missing scoped accessibility scan for field "scopedAfter" at path evidence.axe.scoped.after; ' +
      `selector ${JSON.stringify(PRODUCT_A11Y_SCOPE_ROOT)} returned no compact report; ` +
      'repair: keep the product-view scoped scan wired at the post-interaction observation point.',
    )
  }
  const blocking = seriousViolations(pageWide)

  const axeRecord = {
    target: PRODUCT_TARGET_ID,
    rowTheme: theme,
    policy: PRODUCT_A11Y_POLICY,
    scopeRoot: PRODUCT_A11Y_SCOPE_ROOT,
    baseline: {
      policy: PRODUCT_A11Y_BASELINE.policy,
      scopeRoot: PRODUCT_A11Y_BASELINE.scopeRoot,
      points: {
        initial: PRODUCT_A11Y_BASELINE.points.initial.map((entry) => ({ ...entry, themes: [...entry.themes] })),
        'after-action': PRODUCT_A11Y_BASELINE.points['after-action'].map((entry) => ({ ...entry, themes: [...entry.themes] })),
      },
    },
    scoped: {
      scope: 'product-view',
      root: PRODUCT_A11Y_SCOPE_ROOT,
      before: { section: PRODUCT_A11Y_POINT_SECTIONS.initial, ...scopedBefore },
      after: { section: PRODUCT_A11Y_POINT_SECTIONS['after-action'], ...scopedAfter },
    },
    pageWide: { scope: 'page', root: 'document', ...pageWide },
  }
  const axePath = join(rowDir, 'axe.json')
  writeFileSync(axePath, `${JSON.stringify(axeRecord, null, 2)}\n`)
  const gateBefore = assertProductAxeBaselineDelta({
    point: 'initial',
    measured: summarizeAxeForGate(scopedBefore),
    baseline: PRODUCT_A11Y_BASELINE.points.initial.map((entry) => ({ ...entry })),
    artifactPath: axePath,
  })
  const gateAfter = assertProductAxeBaselineDelta({
    point: 'after-action',
    measured: summarizeAxeForGate(scopedAfter),
    baseline: PRODUCT_A11Y_BASELINE.points['after-action'].map((entry) => ({ ...entry })),
    artifactPath: axePath,
  })

  const ariaSnapshot = await page.locator('#inuse').ariaSnapshot()
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
    body: {
      selector: PRODUCT_SELECTORS.body,
      descendants: before.bodyDescendants,
      textLength: before.bodyTextLength,
      box: before.bodyBox,
    },
    view: {
      selector: PRODUCT_SELECTORS.sectionView,
      stageDescendantsAfter: after.stageDescendants,
      viewDescendantsAfter: after.viewDescendants,
    },
    computedStyles: { ...before.computed },
    viewport: { ...PRODUCT_VIEWPORT },
    accessibility: {
      policy: PRODUCT_A11Y_POLICY,
      scopeRoot: PRODUCT_A11Y_SCOPE_ROOT,
      violations: pageWide.violations.length,
      blocking: blocking.length,
      blockingIds: blocking.map((entry) => entry.id),
      incomplete: pageWide.incomplete,
      passes: pageWide.passes,
      scopedBefore: {
        violations: scopedBefore.violations.length,
        ids: scopedBefore.violations.map((entry) => entry.id),
        incomplete: scopedBefore.incomplete,
        passes: scopedBefore.passes,
      },
      scopedAfter: {
        violations: scopedAfter.violations.length,
        ids: scopedAfter.violations.map((entry) => entry.id),
        incomplete: scopedAfter.incomplete,
        passes: scopedAfter.passes,
      },
      gate: { before: { ...gateBefore }, after: { ...gateAfter } },
    },
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
    artifacts: PRODUCT_ARTIFACT_CLASSES.map((name) => join(rowDir, name)),
  }
}

// Fairtrade-owned named negative component mutations for the mounted
// Storybook story.
//
// Each mutation proves one real defect of the component proof fails at its
// OWNING boundary with an actionable diagnostic (what broke, where, and the
// repair). Every mutation drives the real producer/registry path, never a mock
// of the boundary:
//
// - missing / empty / error root: the raw mount observation the row reads is
//   presented in the static-empty and Storybook-load-error states the built
//   iframe really ships, and assertComponentMounted (the owning mount guard
//   over the app-owned selector registry) refuses each by name. The real-DOM
//   absence proof (proveComponentRootStatesRealPath) additionally drives the
//   live served story in ONE bounded browser session, so an attached-but-empty
//   or removed root genuinely fails the mount wait and the error page the
//   load-error path writes into the root is refused.
// - wrong / contradictory theme: a literal "dark" rendered value and an
//   expected/observed contradiction are observed through observeProductTheme,
//   which rejects before any capture or evidence work. The present-EMPTY dark
//   Storybook state is the healthy control, not a failure.
// - missing / non-completing interaction: an absent action name is refused by
//   the app-owned action registry, and an incomplete named result is refused
//   through the shared component resolver, so the named expand-disclosure
//   action cannot be claimed without reaching its terminal state.
// - product-shaped record: a product-only field on the app-owned component
//   proof input is refused by the shared exact-field membership before the
//   component resolver is reached.
// - cross-kind (both directions): a component record handed to the product
//   full-shell resolver and a product record handed to the component resolver
//   each fail through the real shared contract, driving both directions.
// - stale run root / stale artifact: a previous run subtree is refused by the
//   producer's own freshness guard before any artifact write can reach it.
// - missing artifact: a row directory that lost one of the shared six classes
//   is refused by the producer's completeness guard.
// - provenance relative / external: the real served-asset collector is driven
//   over throwaway served bytes, so a relative reference the collector must
//   fetch and a document that references external documentation links are both
//   decided by the collector, never by a second resolver.
// - screenshot / aria floor: the MEASURED component floors (not the product
//   floors) refuse a collapsed element capture and a folded ARIA snapshot.
// - digest mismatch: the recorded provenance digests are compared against the
//   run's own built Storybook tree over real served bytes.
//
// Every mutation is idempotent, leaves no residue between runs, and never
// weakens the producer's own fail-closed behavior. Host-contract values load
// only through the sole source route; this module holds no second relative
// path into the private child.
//
// App-structure and runtime ownership: the story URL and selectors come from
// the app-owned component registry (componentStoryUrl, COMPONENT_SELECTORS),
// the render viewport comes from the runtime constant owner (PRODUCT_VIEWPORT),
// and every throwaway listener takes its port from the same owner
// (claimScratchPort). This module declares no URL, selector, viewport, or port
// of its own.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { importFairtestSource } from '../fairtest-source.mjs'
import { FAIRTEST_APP_HOST, FAIRTEST_REPO_ROOT, PRODUCT_VIEWPORT, claimScratchPort } from './fairtest-runtime.mjs'
import { observeProductTheme } from './fairtrade-targets.mjs'
import {
  COMPONENT_ACTION_NAME,
  COMPONENT_SELECTORS,
  COMPONENT_STORY_ID,
  COMPONENT_TARGET_ID,
  assertComponentMounted,
  buildComponentProof,
  componentStoryUrl,
} from './fairtrade-component-target.mjs'
import {
  COMPONENT_ARTIFACT_CLASSES,
  assertComponentArtifactSet,
  assertComponentAriaFloor,
  assertComponentScreenshotFloor,
  collectComponentServedAssets,
  componentRowDir,
  createComponentStaticDriver,
  prepareComponentRowDir,
  requireComponentMountedRoot,
  resolveComponentProvenanceRefs,
} from './component-producer.mjs'
import { assertServedDigestsMatchRunRoot } from './fairtest-artifacts.mjs'

const STORYBOOK_ROOT = join(FAIRTEST_REPO_ROOT, 'storybook-static')
const CONFIG_REL = 'playwright.fairtest.config.mjs'
const CONFIG_PATH = join(FAIRTEST_REPO_ROOT, CONFIG_REL)

const resolutionContract = await importFairtestSource('src/host-contract/resolution.mjs')

/**
 * The named negative component mutations. Exact set, frozen.
 * @type {string[]}
 */
export const COMPONENT_MUTATION_NAMES = Object.freeze([
  'missing-root',
  'empty-root',
  'error-display-root',
  'wrong-theme',
  'contradictory-theme',
  'missing-interaction',
  'non-completing-interaction',
  'product-shaped-record',
  'cross-kind-product-shell',
  'cross-kind-product-record',
  'stale-run-root',
  'stale-artifact',
  'missing-artifact',
  'provenance-relative-unresolved',
  'provenance-external-link',
  'screenshot-floor',
  'aria-floor',
  'digest-mismatch',
])

/**
 * Owning boundary each mutation must fail at. The boundary names the module
 * and field that reject the defect, never a blanket gate.
 * @type {Record<string, string>}
 */
export const COMPONENT_MUTATION_BOUNDARIES = Object.freeze({
  'missing-root': 'fairtrade-component-target.assertComponentMounted at mount.root',
  'empty-root': 'fairtrade-component-target.assertComponentMounted at mount.rootChildCount',
  'error-display-root': 'fairtrade-component-target.assertComponentMounted at mount.errorDisplay',
  'wrong-theme': 'fairtrade-targets.observeProductTheme at theme.renderedAttribute before evidence finalization',
  'contradictory-theme': 'fairtrade-targets.observeProductTheme at theme.observed before evidence finalization',
  'missing-interaction': 'fairtrade-component-target.getComponentAction at target.action',
  'non-completing-interaction': 'shared host contract through fairtrade-component-target.buildComponentProof at resolution.interaction.completed',
  'product-shaped-record': 'fairtrade-component-target.buildComponentProof at proof.view before the shared component resolver',
  'cross-kind-product-shell': 'shared host contract through resolution.validateProductResolution at resolution.kind',
  'cross-kind-product-record': 'shared host contract through resolution.validateComponentResolution at resolution.chrome',
  'stale-run-root': 'component-producer.prepareComponentRowDir at run.rowDir through refuseStaleComponentSubtree',
  'stale-artifact': 'component-producer.prepareComponentRowDir at run.rowDir through refuseStaleComponentSubtree',
  'missing-artifact': 'component-producer.assertComponentArtifactSet at run.rowDir',
  'provenance-relative-unresolved': 'component-producer.collectComponentServedAssets at provenance.assetDigests over real served bytes',
  'provenance-external-link': 'component-producer.resolveComponentProvenanceRefs at provenance.assetDigests',
  'screenshot-floor': 'component-producer.assertComponentScreenshotFloor at evidence.screenshot',
  'aria-floor': 'component-producer.assertComponentAriaFloor at evidence.aria',
  'digest-mismatch': 'fairtest-artifacts.assertServedDigestsMatchRunRoot at provenance.assetDigests over real served bytes',
})

/**
 * The exact journeys the one-project Fairtest config may match. Two explicit
 * journey paths, never the broad catalog. Declared once so the config guard
 * and the mutation suite read the same list.
 * @type {string[]}
 */
export const COMPONENT_CONFIG_TEST_MATCH = Object.freeze(['**/product.journey.mjs', '**/component.journey.mjs'])

const HEALTHY_MOUNT = Object.freeze({
  rootChildCount: 1,
  bodyClass: 'sb-main-centered sb-show-main',
  errorDisplay: 'none',
  errorStackText: '',
})

const HEALTHY_THEME = Object.freeze({
  expected: 'dark',
  observed: 'dark',
  source: 'component-mutations',
  observedAtMs: 1000,
})

/**
 * A valid component proof input the proof-level mutations subtract from.
 * @param {object} [overrides] fields to replace
 * @returns {object} a complete valid component proof input
 */
function validComponentProofInput(overrides = {}) {
  return {
    rowTheme: 'dark',
    identity: { kind: 'component', id: COMPONENT_TARGET_ID, createdAtMs: 1000 },
    root: { mounted: true, observedAtMs: 2000 },
    themeObservation: { ...HEALTHY_THEME },
    interaction: { name: COMPONENT_ACTION_NAME, completed: true, observedAtMs: 3000 },
    ...overrides,
  }
}

/**
 * A valid component resolution record, for the cross-kind direction that
 * presents a component record to the product resolver.
 * @returns {object} the frozen-by-resolver component record
 */
function validComponentRecord() {
  return {
    kind: 'component',
    identity: { kind: 'component', id: COMPONENT_TARGET_ID, createdAtMs: 1000 },
    root: { mounted: true, observedAtMs: 2000 },
    theme: { ...HEALTHY_THEME },
  }
}

/**
 * A valid product resolution record, for the cross-kind direction that
 * presents a product record to the component resolver.
 * @returns {object} the product record
 */
function validProductRecord() {
  const part = { observed: true, observedAtMs: 2000 }
  return {
    kind: 'product',
    identity: { kind: 'product', id: 'fairtrade-graph-product', createdAtMs: 1000 },
    chrome: { ...part },
    body: { ...part },
    route: { ...part },
    activeSection: { ...part },
    view: { ...part },
    theme: { ...HEALTHY_THEME },
  }
}

/**
 * Run the static-empty root mutation: the built iframe ships an empty
 * #storybook-root, so attachment is not a mount. The owning mount guard
 * refuses zero children by name.
 * @returns {never} always throws
 */
function mutateEmptyRoot() {
  return assertComponentMounted({ ...HEALTHY_MOUNT, rootChildCount: 0 })
}

/**
 * Run the missing root mutation: no mount observation at all. A blanket
 * mounted flag or an unobserved root cannot satisfy the guard.
 * @returns {never} always throws
 */
function mutateMissingRoot() {
  return assertComponentMounted(null)
}

/**
 * Run the error-display root mutation: the Storybook load-error path writes
 * its message into the story root and reveals the error display, so a
 * non-empty root alone is not a mount. The owning guard refuses the visible
 * error display.
 * @returns {never} always throws
 */
function mutateErrorDisplayRoot() {
  return assertComponentMounted({ ...HEALTHY_MOUNT, rootChildCount: 1, errorDisplay: 'block', errorStackText: 'Error: could not load story' })
}

/**
 * Run the wrong-theme mutation: a literal rendered value outside the closed
 * theme vocabulary is refused by the shared normalization.
 * @returns {never} always throws
 */
function mutateWrongTheme() {
  return observeProductTheme({ expected: 'dark', renderedAttribute: 'dark', source: 'component-mutations:wrong-theme', observedAtMs: 1000 })
}

/**
 * Run the contradictory-theme mutation: the light row renders the dark value,
 * so the theme observation rejects the contradiction before evidence work.
 * @returns {never} always throws
 */
function mutateContradictoryTheme() {
  return observeProductTheme({ expected: 'light', renderedAttribute: '', source: 'component-mutations:contradictory-theme', observedAtMs: 1000 })
}

/**
 * Run the missing-interaction mutation: the named action is absent, so the
 * app-owned action registry rejects it before the result is validated.
 * @returns {never} always throws
 */
function mutateMissingInteraction() {
  return buildComponentProof(validComponentProofInput({ interaction: { name: undefined, completed: true, observedAtMs: 3000 } }))
}

/**
 * Run the non-completing-interaction mutation: the named action reached no
 * terminal state, so the shared component resolver rejects the incomplete
 * result.
 * @returns {never} always throws
 */
function mutateNonCompletingInteraction() {
  return buildComponentProof(validComponentProofInput({ interaction: { name: COMPONENT_ACTION_NAME, completed: false, observedAtMs: 3000 } }))
}

/**
 * Run the product-shaped-record mutation: a product-only field on the
 * app-owned component proof input is refused by the shared exact-field
 * membership.
 * @returns {never} always throws
 */
function mutateProductShapedRecord() {
  return buildComponentProof(validComponentProofInput({ view: { observed: true, observedAtMs: 4000 } }))
}

/**
 * Run the cross-kind product-shell mutation: a valid component record handed
 * to the product full-shell resolver is a cross-kind resolution and fails
 * through the real shared contract.
 * @returns {never} always throws
 */
function mutateCrossKindProductShell() {
  return resolutionContract.validateProductResolution(validComponentRecord(), 'component mutations')
}

/**
 * Run the cross-kind product-record mutation: a valid product record handed
 * to the component resolver carries product-only fields and fails through the
 * real shared contract.
 * @returns {never} always throws
 */
function mutateCrossKindProductRecord() {
  return resolutionContract.validateComponentResolution(validProductRecord(), 'component mutations')
}

/**
 * Make a throwaway scratch directory that is always removed.
 * @returns {{ root: string, cleanup: () => void }} the scratch handle
 */
function scratchDir() {
  const root = mkdtempSync(join(tmpdir(), 'fairtest-component-mutation-'))
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

/**
 * Run the stale-run-root mutation: a fresh component row refuses a run root
 * that already carries a previous run subtree, before any artifact write.
 * @returns {never} always throws
 */
function mutateStaleRunRoot() {
  const scratch = scratchDir()
  try {
    const runRoot = scratch.root
    prepareComponentRowDir({ runRoot, theme: 'dark' })
    writeFileSync(join(componentRowDir(runRoot, 'dark'), 'record.json'), '{}\n')
    return prepareComponentRowDir({ runRoot, theme: 'dark' })
  } finally {
    scratch.cleanup()
  }
}

/**
 * Run the stale-artifact mutation: one of the shared six classes surviving
 * from a previous run makes the run root stale and the freshness guard refuses
 * it by the artifact name.
 * @returns {never} always throws
 */
function mutateStaleArtifact() {
  const scratch = scratchDir()
  try {
    const runRoot = scratch.root
    prepareComponentRowDir({ runRoot, theme: 'light' })
    writeFileSync(join(componentRowDir(runRoot, 'light'), 'screenshot.png'), 'stale')
    return prepareComponentRowDir({ runRoot, theme: 'light' })
  } finally {
    scratch.cleanup()
  }
}

/**
 * Run the missing-artifact mutation: a row directory that lost one of the
 * shared six classes is refused by the completeness guard.
 * @returns {never} always throws
 */
function mutateMissingArtifact() {
  const scratch = scratchDir()
  try {
    const runRoot = scratch.root
    const { rowDir } = prepareComponentRowDir({ runRoot, theme: 'dark' })
    for (const name of COMPONENT_ARTIFACT_CLASSES) {
      if (name === 'aria.json') continue
      writeFileSync(join(rowDir, name), '{}')
    }
    return assertComponentArtifactSet(rowDir)
  } finally {
    scratch.cleanup()
  }
}

/**
 * Fetch served text over HTTP from a throwaway loopback driver. The request
 * never reuses a pooled connection: this suite stops and restarts a throwaway
 * driver on the same fixed port, so a kept-alive socket to the previous server
 * would surface as a socket error instead of the collector's own diagnostic.
 * @param {string} url loopback URL to read
 * @returns {Promise<string>} the served text
 */
function fetchServedText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { agent: false }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`unexpected status ${res.statusCode}`))
        res.resume()
        return
      }
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { text += chunk })
      res.on('end', () => resolve(text))
    }).on('error', reject)
  })
}

/**
 * Serve a throwaway Storybook byte tree carrying one iframe.html over a
 * throwaway loopback port. Used only by the provenance mutations so the real
 * served-asset collector is driven against bytes this module controls. The
 * driver and the scratch tree are released by the caller.
 * @param {string} iframeHtml served iframe.html body
 * @param {number} port loopback port
 * @returns {{ driver: object, scratch: { root: string, cleanup: () => void } }} the driver and scratch handle
 */
function serveIframeBytes(iframeHtml, port) {
  const scratch = scratchDir()
  writeFileSync(join(scratch.root, 'iframe.html'), iframeHtml)
  writeFileSync(join(scratch.root, 'index.json'), '{}\n')
  const driver = createComponentStaticDriver({ port, host: FAIRTEST_APP_HOST, staticRoot: scratch.root })
  return { driver, scratch }
}

/**
 * Run the relative-reference mutation: a relative `./` reference the built
 * iframe really carries is resolved and fetched by the real served-asset
 * collector, so an unresolved relative reference fails closed at the fetch
 * boundary.
 * @param {object} [options] mutation options
 * @param {number} [options.port] loopback port override
 * @returns {Promise<never>} always throws
 */
async function mutateProvenanceRelativeUnresolved({ port } = {}) {
  const loopback = await (port === undefined ? claimScratchPort('mutation-component-provenance') : { port })
  const { driver, scratch } = serveIframeBytes('<script src="./missing-relative-asset.js"></script>\n', loopback.port)
  try {
    await driver.start()
    const servedHtml = await fetchServedText(`${driver.baseUrl}/iframe.html`)
    if (!resolveComponentProvenanceRefs(servedHtml).includes('missing-relative-asset.js')) {
      throw new Error(
        'component mutations: relative reference was unresolved for field "assetDigests" at path provenance.assetDigests; ' +
        'repair: keep relative `./` references resolved by the shared served-asset collector.',
      )
    }
    return await collectComponentServedAssets({ baseUrl: driver.baseUrl, servedHtml })
  } finally {
    await driver.stop()
    scratch.cleanup()
  }
}

/**
 * Run the external-link mutation: an iframe.html that references only external
 * documentation links resolves to no asset file, so the real served-asset
 * collector fails closed instead of pulling a documentation URL in.
 * @param {object} [options] mutation options
 * @param {number} [options.port] loopback port override
 * @returns {Promise<never>} always throws
 */
async function mutateProvenanceExternalLink({ port } = {}) {
  const loopback = await (port === undefined ? claimScratchPort('mutation-component-provenance') : { port })
  const externalHtml = '<a href="https://storybook.js.org/docs">docs</a>\n'
  const resolved = resolveComponentProvenanceRefs(externalHtml)
  if (resolved.length !== 0) {
    throw new Error(
      'component mutations: external documentation link became an asset reference for field "assetDigests" at path provenance.assetDigests; ' +
      `resolved ${JSON.stringify(resolved)}; ` +
      'repair: skip absolute external links so only local asset references are fetched.',
    )
  }
  const { driver, scratch } = serveIframeBytes(externalHtml, loopback.port)
  try {
    await driver.start()
    const servedHtml = await fetchServedText(`${driver.baseUrl}/iframe.html`)
    return await collectComponentServedAssets({ baseUrl: driver.baseUrl, servedHtml })
  } finally {
    await driver.stop()
    scratch.cleanup()
  }
}

/**
 * Run the screenshot-floor mutation: the measured collapsed element capture
 * (3233 bytes) is below the component floor and is refused. The product's
 * 8000-byte full-page floor is deliberately not consulted.
 * @returns {never} always throws
 */
function mutateScreenshotFloor() {
  return assertComponentScreenshotFloor(3233, 'screenshot.png')
}

/**
 * Run the aria-floor mutation: the folded snapshot (33 characters) is below
 * the component floor and is refused. The product's 50-character shell floor
 * is deliberately not consulted.
 * @returns {never} always throws
 */
function mutateAriaFloor() {
  return assertComponentAriaFloor('- button "orphan sessions 2 show"')
}

/**
 * Run the digest-mismatch mutation: recorded provenance digests that disagree
 * with the run's own built Storybook tree fail closed over the real comparison.
 * @returns {never} always throws
 */
function mutateDigestMismatch() {
  return assertServedDigestsMatchRunRoot({
    assetDigests: { 'iframe.html': '0'.repeat(64) },
    distRoot: STORYBOOK_ROOT,
    label: 'component producer',
  })
}

/**
 * Assert the one-project Fairtest config matches exactly the product and
 * component journeys and never the full catalog. Shared by the mutation suite
 * and the verifier-facing evidence reader.
 * @param {object} config parsed Playwright config
 * @returns {object} the frozen receipt
 */
export function assertComponentRunnerConfigMatchesJourneys(config) {
  const testMatch = config?.testMatch
  if (JSON.stringify(testMatch) !== JSON.stringify([...COMPONENT_CONFIG_TEST_MATCH])) {
    throw new Error(
      `component mutations: runner config testMatch ${JSON.stringify(testMatch)} for field "testMatch" at path ${CONFIG_REL}.testMatch; ` +
      `expected exactly ${JSON.stringify([...COMPONENT_CONFIG_TEST_MATCH])}; ` +
      'repair: match the two explicit journey paths and never a glob or the full catalog.',
    )
  }
  for (const pattern of testMatch) {
    if (pattern.includes('storybook-smoke') || !pattern.endsWith('.journey.mjs')) {
      throw new Error(
        `component mutations: runner config testMatch ${JSON.stringify(pattern)} for field "testMatch" at path ${CONFIG_REL}.testMatch; ` +
        'repair: keep the full-catalog story smoke out of the one-project Fairtest config.',
      )
    }
  }
  if (config.webServer !== undefined) {
    throw new Error(
      `component mutations: runner config declares a webServer for field "webServer" at path ${CONFIG_REL}.webServer; ` +
      'repair: let the adapter own the service lifecycle instead of attaching to an unrelated server.',
    )
  }
  const projects = config.projects
  if (!Array.isArray(projects) || projects.length !== 1 || projects[0]?.name !== 'fairtest') {
    throw new Error(
      `component mutations: runner config projects ${JSON.stringify(projects)} for field "projects" at path ${CONFIG_REL}.projects; ` +
      'repair: keep exactly one project named fairtest and bind theme from the row key.',
    )
  }
  return Object.freeze({ testMatch: Object.freeze([...testMatch]), project: 'fairtest' })
}

/**
 * Read the one-project Fairtest config and assert it matches exactly the two
 * journeys. @returns {Promise<object>} the frozen receipt
 */
export async function readAndAssertComponentRunnerConfig() {
  const module = await import(pathToFileURL(CONFIG_PATH).href)
  return assertComponentRunnerConfigMatchesJourneys(module.default ?? module)
}

/**
 * Run one named mutation by name. Every named mutation must throw; a return
 * means the owning boundary let a real defect through.
 * @param {string} name mutation name from COMPONENT_MUTATION_NAMES
 * @param {object} [options] per-mutation options forwarded to the runner
 * @returns {Promise<unknown>} never resolves: the mutation must throw
 */
export async function runComponentMutation(name, options = {}) {
  switch (name) {
    case 'missing-root':
      return mutateMissingRoot()
    case 'empty-root':
      return mutateEmptyRoot()
    case 'error-display-root':
      return mutateErrorDisplayRoot()
    case 'wrong-theme':
      return mutateWrongTheme()
    case 'contradictory-theme':
      return mutateContradictoryTheme()
    case 'missing-interaction':
      return mutateMissingInteraction()
    case 'non-completing-interaction':
      return mutateNonCompletingInteraction()
    case 'product-shaped-record':
      return mutateProductShapedRecord()
    case 'cross-kind-product-shell':
      return mutateCrossKindProductShell()
    case 'cross-kind-product-record':
      return mutateCrossKindProductRecord()
    case 'stale-run-root':
      return mutateStaleRunRoot()
    case 'stale-artifact':
      return mutateStaleArtifact()
    case 'missing-artifact':
      return mutateMissingArtifact()
    case 'provenance-relative-unresolved':
      return mutateProvenanceRelativeUnresolved(options)
    case 'provenance-external-link':
      return mutateProvenanceExternalLink(options)
    case 'screenshot-floor':
      return mutateScreenshotFloor()
    case 'aria-floor':
      return mutateAriaFloor()
    case 'digest-mismatch':
      return mutateDigestMismatch()
    default:
      throw new Error(
        `component mutations: unknown mutation ${JSON.stringify(name)} for field "mutation" at path mutation.name; ` +
        `repair: use one of ${COMPONENT_MUTATION_NAMES.join(', ')} for "mutation".`,
      )
  }
}

/**
 * Read the mount observation the row reads on the live served story.
 * @param {import('@playwright/test').Page} page live page
 * @returns {Promise<object>} the raw mount observation
 */
async function readMountObservation(page) {
  return page.evaluate((selectors) => {
    const root = document.querySelector(selectors.root)
    const errEl = document.querySelector(selectors.errorDisplay)
    const stack = document.querySelector(selectors.errorStack)
    return {
      rootChildCount: root ? root.childElementCount : 0,
      bodyClass: document.body ? document.body.className : '',
      errorDisplay: errEl ? getComputedStyle(errEl).display : 'none',
      errorStackText: ((stack ? stack.textContent : '') || '').trim(),
    }
  }, COMPONENT_SELECTORS)
}

/**
 * Run the three real mount states against the live served Storybook in ONE
 * bounded browser session: a removed root (the mount wait observes nothing to
 * attach to), a static-empty root (attachment is not a mount), and the
 * load-error page the error path writes into the root. The served bytes are
 * never modified; only the live page is. The browser and service are released
 * in finally blocks.
 * @param {object} [options] proof options
 * @param {number} [options.port] loopback port override, defaults to the claimed scratch port
 * @returns {Promise<object[]>} per-state refusal evidence
 */
export async function proveComponentRootStatesRealPath({ port } = {}) {
  const { chromium } = await import('@playwright/test')
  const loopback = await (port === undefined ? claimScratchPort('mutation-component-root-states') : { port })
  const driver = createComponentStaticDriver({ port: loopback.port, host: FAIRTEST_APP_HOST, staticRoot: STORYBOOK_ROOT })
  await driver.start()
  const browser = await chromium.launch()
  const evidence = []
  try {
    const page = await browser.newPage({ viewport: { ...PRODUCT_VIEWPORT } })
    try {
      const url = `${driver.baseUrl}${componentStoryUrl(COMPONENT_STORY_ID, 'dark')}`

      // 1. Removed root: the producer's own mount wait observes nothing to
      // attach to. Drive the real boundary (requireComponentMountedRoot) so the
      // producer's actionable missing-root diagnostic is exercised, not a
      // re-declared predicate that would report Playwright's generic timeout.
      await page.goto(url, { waitUntil: 'networkidle' })
      await requireComponentMountedRoot(page, url)
      await page.evaluate((selector) => document.querySelector(selector)?.remove(), COMPONENT_SELECTORS.root)
      let removedDiagnostic = null
      try {
        await requireComponentMountedRoot(page, url, 1000)
      } catch (error) {
        removedDiagnostic = error instanceof Error ? error.message : String(error)
      }
      if (!removedDiagnostic || !removedDiagnostic.includes('missing mounted root')) {
        throw new Error(
          'component mutations: removed root did not reach the producer mount guard for field "root" at path proof.root; ' +
          `got ${JSON.stringify(removedDiagnostic)}; ` +
          'repair: keep the removal evaluate intact so the mount wait observes a genuinely missing root and fails closed.',
        )
      }
      evidence.push(Object.freeze({ state: 'missing-root', refused: true, diagnostic: removedDiagnostic }))

      // 2. Static-empty root: present but with zero children.
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForFunction((selector) => {
        const root = document.querySelector(selector)
        return !!root && root.childElementCount > 0
      }, COMPONENT_SELECTORS.root, { timeout: 15000 })
      await page.evaluate((selector) => document.querySelector(selector)?.replaceChildren(), COMPONENT_SELECTORS.root)
      const emptyObs = await readMountObservation(page)
      let emptyDiagnostic = null
      try {
        assertComponentMounted(emptyObs)
      } catch (error) {
        emptyDiagnostic = error instanceof Error ? error.message : String(error)
      }
      if (!emptyDiagnostic || !emptyDiagnostic.includes('empty mounted root')) {
        throw new Error(
          'component mutations: static-empty root cleared the mount guard for field "rootChildCount" at path mount; ' +
          `got ${JSON.stringify(emptyDiagnostic)}; ` +
          'repair: require real children so a statically empty root is never a mount.',
        )
      }
      evidence.push(Object.freeze({ state: 'empty-root', refused: true, diagnostic: emptyDiagnostic }))

      // 3. Load-error page written into the root: the error display is shown
      // and the error stack is non-empty, so a non-empty root is refused.
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForFunction((selector) => {
        const root = document.querySelector(selector)
        return !!root && root.childElementCount > 0
      }, COMPONENT_SELECTORS.root, { timeout: 15000 })
      await page.evaluate((selectors) => {
        const root = document.querySelector(selectors.root)
        if (root) root.innerHTML = '<p style="color: red">Could not load story</p>'
        const errEl = document.querySelector(selectors.errorDisplay)
        if (errEl) errEl.style.display = 'block'
        const stack = document.querySelector(selectors.errorStack)
        if (stack) stack.textContent = 'Error: could not load story'
      }, COMPONENT_SELECTORS)
      const errorObs = await readMountObservation(page)
      let errorDiagnostic = null
      try {
        assertComponentMounted(errorObs)
      } catch (error) {
        errorDiagnostic = error instanceof Error ? error.message : String(error)
      }
      if (!errorDiagnostic || !errorDiagnostic.includes('error display')) {
        throw new Error(
          'component mutations: load-error root cleared the mount guard for field "errorDisplay" at path mount; ' +
          `got ${JSON.stringify(errorDiagnostic)}; ` +
          'repair: keep the load-error signals so an error page written into the root is never a mount.',
        )
      }
      evidence.push(Object.freeze({ state: 'error-display-root', refused: true, diagnostic: errorDiagnostic }))
    } finally {
      await page.close()
    }
  } finally {
    await browser.close()
    await driver.stop()
  }
  return evidence
}

/**
 * The closed six-name artifact contract. This is an independent literal, not an
 * alias of the shared set: comparing the component set to itself could never
 * fail, so the check is against this declared contract. A renamed or
 * substituted class (same length, same reference) passes the import-time
 * length/reference guard in component-producer.mjs but fails here.
 * @type {string[]}
 */
const EXPECTED_ARTIFACT_CLASSES = Object.freeze([
  'record.json',
  'aria.json',
  'axe.json',
  'screenshot.png',
  'provenance.json',
  'resolution.json',
])

/**
 * Assert the component artifact class set is exactly the closed six names the
 * one verifier reads for both kinds. Shared by the mutation suite and the
 * verifier-facing evidence reader.
 * @returns {object} the frozen receipt
 */
export function assertComponentArtifactParity() {
  if (JSON.stringify([...COMPONENT_ARTIFACT_CLASSES]) !== JSON.stringify([...EXPECTED_ARTIFACT_CLASSES])) {
    throw new Error(
      `component mutations: component artifact classes ${JSON.stringify([...COMPONENT_ARTIFACT_CLASSES])} for field "artifactClasses" at path artifacts; ` +
      `the closed six-class contract is ${JSON.stringify([...EXPECTED_ARTIFACT_CLASSES])}; ` +
      'repair: keep the one shared six-class set so a single verifier reads both kinds.',
    )
  }
  return Object.freeze({ classes: Object.freeze([...COMPONENT_ARTIFACT_CLASSES]), count: COMPONENT_ARTIFACT_CLASSES.length })
}

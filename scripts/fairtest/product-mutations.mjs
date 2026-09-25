// Fairtrade-owned named negative product mutations for the mounted graph surface.
//
// Each mutation proves one real defect fails at its OWNING product boundary
// with an actionable diagnostic (what broke, where, why, and the repair).
// Every mutation drives the real producer path, never a mock of the boundary:
//
// - missing chrome / body / section / view: the observation input for that
//   part is removed before the proof is built, so buildProductProof (the
//   owning proof boundary over the shared product resolver) rejects it.
//   Form: observation-input removal. The same selectors are the ones the
//   passing mounted row observes on the real served app, and
//   proveDomAbsenceRealPath additionally shows the live tree genuinely
//   missing each element (removed in place on the real served bytes) so the
//   producer wait observes nothing to attach to.
// - blank active view: the inverse case the absence proof cannot reach. The
//   real served app is opened in a real browser, the ACTIVE view's children
//   are emptied in place while the permanently mounted hidden changes view
//   stays attached, and the producer's own shared measurement plus its
//   active-view floor guard decide the result. Absence cannot hide a blank
//   view; only an active-view-scoped floor can, so the guard is measured
//   healthy first and then on the emptied tree.
// - unrendered active view: a PRESENT active view with its full content that
//   renders nothing. The same real served app is driven in ONE bounded
//   browser session: one stylesheet per declared unrendered mode
//   (display none, hidden visibility, zero opacity, an empty box, and a box
//   clipped away from the mounted stage) is installed on the active view in
//   turn, the producer's own shared measurement reports the mode per root,
//   and the producer's single rendered predicate must refuse each one. The
//   healthy measurement is taken first, so a refusal can only come from the
//   rendering check. Node and text counts are untouched by every one of these
//   modes, which is the whole point: counting alone cannot see them.
// - wrong theme: a contradictory rendered value is observed through
//   observeProductTheme, which rejects before any capture or evidence work.
//   Form: real observation call with a contradicted rendered attribute.
// - unregistered action: the name is offered to the real Fairtrade adapter
//   (performAction) and to the real target registry (getProductAction); both
//   reject outside the app-owned registry. The injected driver is never
//   reached, which is exactly the fail-closed order: registry before runtime.
// - cross-kind proof: a component-shaped identity is presented to the
//   product proof builder and rejected by the shared contract.
//   Form: real buildProductProof call with a foreign-branch identity.
// - stale served asset: a THROWAWAY COPY of dist/ is served over real HTTP
//   through the real static driver while the recorded provenance digests come
//   from the real dist/ tree. The served index.html digest no longer matches
//   the recorded one, so the provenance comparison fails closed. The real
//   dist/ is never modified; the copy is removed in a finally block.
//
// Every mutation is idempotent, leaves no residue between runs, and never
// weakens the producer's own fail-closed behavior. No second browser oracle,
// Storybook run, Puppeteer catalog, or component target is added here.
// Host-contract values load only through the sole source route; this module
// holds no second relative path into the private child.

import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importFairtestSource } from '../fairtest-source.mjs'
import { createFairtradeAdapter } from './fairtrade-adapter.mjs'
import { FAIRTEST_APP_HOST, FAIRTEST_REPO_ROOT } from './fairtest-runtime.mjs'
import {
  PRODUCT_SELECTORS,
  PRODUCT_UNRENDERED_MODES,
  buildProductProof,
  getProductAction,
  observeProductTheme,
} from './fairtrade-targets.mjs'
import {
  PRODUCT_VIEW_SELECTORS,
  assertProductActiveViewMounted,
  createProductStaticDriver,
  measureProductView,
} from './product-producer.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIST_ROOT = join(FAIRTEST_REPO_ROOT, 'dist')

const kindsContract = await importFairtestSource('src/host-contract/kinds.mjs')
const resolutionContract = await importFairtestSource('src/host-contract/resolution.mjs')

/**
 * The ten named negative product mutations. Exact set, frozen.
 * @type {string[]}
 */
export const PRODUCT_MUTATION_NAMES = Object.freeze([
  'missing-chrome',
  'missing-body',
  'missing-section',
  'missing-view',
  'blank-active-view',
  'unrendered-active-view',
  'wrong-theme',
  'unregistered-action',
  'cross-kind-proof',
  'stale-served-asset',
])

/**
 * Owning boundary each mutation must fail at. The boundary names the module
 * and field that reject the defect, never a blanket gate.
 * @type {object}
 */
export const PRODUCT_MUTATION_BOUNDARIES = Object.freeze({
  'missing-chrome': 'fairtrade-targets.buildProductProof at proof.chrome through resolution.chrome',
  'missing-body': 'fairtrade-targets.buildProductProof at proof.body through resolution.body',
  'missing-section': 'fairtrade-targets.buildProductProof at proof.activeSection through resolution.activeSection',
  'missing-view': 'fairtrade-targets.buildProductProof at proof.view through resolution.view',
  'blank-active-view': 'product-producer.assertProductActiveViewMounted at proof.body on the shared active-view measurement',
  'unrendered-active-view': 'product-producer.assertProductActiveViewMounted at proof.body on the rendered-root predicate of the shared measurement',
  'wrong-theme': 'fairtrade-targets.observeProductTheme at theme.observed before evidence finalization',
  'unregistered-action': 'fairtrade-adapter.performAction at adapter.action and fairtrade-targets.getProductAction at target.action',
  'cross-kind-proof': 'shared host contract through fairtrade-targets.buildProductProof at path proof.identity',
  'stale-served-asset': 'product-mutations.servedProvenanceDigestMatch at provenance.assetDigests over real served bytes',
})

/**
 * The declared unrendered modes and the stylesheet that produces each one on
 * the real built surface. Every rule is assembled from the app-owned selector
 * registry, never from a class literal here, and every rule leaves the active
 * view's own box and its node and text counts intact, so a refusal can only
 * come from the rendering predicate. The clipped mode takes the view container
 * out of flow and pushes it off the mounted stage: the active root keeps its
 * full content and a non-zero box, but none of it survives inside the stage.
 * @type {Record<string, string>}
 */
export const PRODUCT_UNRENDERED_RULES = Object.freeze({
  'display-none': `${PRODUCT_SELECTORS.activeView} { display: none !important; }`,
  'visibility-hidden': `${PRODUCT_SELECTORS.activeView} { visibility: hidden !important; }`,
  'opacity-zero': `${PRODUCT_SELECTORS.activeView} { opacity: 0 !important; }`,
  'zero-size': `${PRODUCT_SELECTORS.activeView} { width: 0 !important; height: 0 !important; overflow: hidden !important; }`,
  clipped: `${PRODUCT_SELECTORS.body} { position: absolute !important; top: -4000px !important; }`,
})

/**
 * Build a valid proof input the mutations subtract from. Times are fixed so
 * the mutation diagnostics stay deterministic.
 * @param {object} [overrides] fields to replace on the valid input
 * @returns {object} a complete valid proof input
 */
export function validMutationProofInput(overrides = {}) {
  return {
    rowTheme: 'dark',
    identity: { kind: 'product', id: 'mutation-probe', createdAtMs: 1000 },
    chrome: { observed: true, observedAtMs: 1000 },
    body: { observed: true, observedAtMs: 1001 },
    route: { observed: true, observedAtMs: 1002 },
    activeSection: { observed: true, observedAtMs: 1003 },
    view: { observed: true, observedAtMs: 1004 },
    themeObservation: { expected: 'dark', observed: 'dark', source: 'product-mutations', observedAtMs: 1000 },
    initialSection: 'analytics',
    activeSectionId: 'analytics',
    ...overrides,
  }
}

/**
 * Hash bytes with sha256 and return the hex digest. Same construction the
 * producer uses for served provenance, kept local so this module never
 * depends on the producer's private helpers.
 * @param {Buffer|string} data bytes to hash
 * @returns {string} hex digest
 */
function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Fetch raw bytes over HTTP from a running loopback server. The request never
 * reuses a pooled connection: this suite stops and restarts a throwaway driver
 * on the same fixed port, and a kept-alive socket to the previous server would
 * surface as a socket hang up instead of the digest being compared.
 * @param {string} url loopback URL to read
 * @returns {Promise<Buffer>} the served bytes
 */
function fetchBytes(url) {
  return new Promise((responseResolve, responseReject) => {
    http.get(url, { agent: false }, (res) => {
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
 * Digest the recorded index.html of a built-app root on disk.
 * @param {string} root built-app root holding index.html
 * @returns {string} hex digest of the recorded bytes
 */
export function digestRecordedIndexHtml(root) {
  const file = join(root, 'index.html')
  if (!existsSync(file)) {
    throw new Error(
      'product mutations: built app is missing for field "dist" at path mutation.distRoot; ' +
      `looked for ${JSON.stringify(file)}; ` +
      'repair: run pnpm build before the mutation suite so dist/ holds the exact built app.',
    )
  }
  return sha256(readFileSync(file))
}

/**
 * Compare recorded provenance digests against bytes served over real HTTP
 * from a candidate root. A mismatch fails closed with the recorded digest,
 * the served digest, and the repair. Matching digests return a frozen pass
 * receipt.
 * @param {object} input comparison inputs
 * @param {string} input.recordedDigest digest recorded from the built tree
 * @param {string} input.servedDigest digest read over HTTP from the served tree
 * @param {string} input.servedUrl serving origin the bytes were read from
 * @returns {object} frozen pass receipt when the digests match
 */
export function servedProvenanceDigestMatch({ recordedDigest, servedDigest, servedUrl } = {}) {
  if (typeof recordedDigest !== 'string' || recordedDigest.length === 0) {
    throw new Error(
      'product mutations: missing recorded digest for field "recordedDigest" at path provenance.assetDigests; ' +
      'repair: record the sha256 of the built dist/index.html before comparing served bytes.',
    )
  }
  if (recordedDigest !== servedDigest) {
    throw new Error(
      'product mutations: stale served asset for field "assetDigests" at path provenance.assetDigests; ' +
      `recorded index.html digest ${JSON.stringify(recordedDigest)} but the server at ${JSON.stringify(servedUrl)} ` +
      `served digest ${JSON.stringify(servedDigest)}; ` +
      'repair: rebuild dist/ with pnpm build and serve the exact built tree instead of a stale copy.',
    )
  }
  return Object.freeze({ result: 'pass', servedUrl })
}

/**
 * Run the missing-chrome mutation: the persistent chrome observation is
 * removed before the proof is built, so the owning proof boundary rejects
 * it. Never a blanket mounted flag: the diagnostic names the chrome part.
 */
export function mutateMissingChrome() {
  const input = validMutationProofInput()
  delete input.chrome
  return buildProductProof(input)
}

/**
 * Run the missing-body mutation: the representative body observation is
 * removed before the proof is built. The rejection names the body part, so
 * a blanket mounted boolean could never satisfy this boundary.
 */
export function mutateMissingBody() {
  const input = validMutationProofInput()
  delete input.body
  return buildProductProof(input)
}

/**
 * Run the missing-section mutation: the active-section observation is
 * removed before the proof is built, so the owning proof boundary rejects
 * it.
 */
export function mutateMissingSection() {
  const input = validMutationProofInput()
  delete input.activeSection
  return buildProductProof(input)
}

/**
 * Run the missing-view mutation: the mounted-view observation is removed
 * before the proof is built, so the owning proof boundary rejects it.
 */
export function mutateMissingView() {
  const input = validMutationProofInput()
  delete input.view
  return buildProductProof(input)
}

/**
 * Run the blank-active-view mutation against the real served app in a real
 * browser. The healthy active view is measured first and must clear the
 * producer's own floor guard, so the emptied measurement is the only thing
 * that can fail. Then the active view's children are emptied in place while
 * the permanently mounted hidden changes view stays attached inside the same
 * container, and the same shared measurement plus the same guard decide again.
 * The hidden sibling's own counts (188 descendants, 804 characters on the
 * real built surface) are exactly what a container-scoped floor would have
 * read, so this case is the one that distinguishes the two.
 * @param {object} [options] mutation options
 * @param {number} [options.port] fixed loopback port for the proof service
 * @returns {Promise<never>} always throws with the producer's blank-view diagnostic
 */
export async function mutateBlankActiveView({ port = 5195 } = {}) {
  const { chromium } = await import('@playwright/test')
  const driver = createProductStaticDriver({ port, host: FAIRTEST_APP_HOST, distRoot: DIST_ROOT })
  await driver.start()
  const browser = await chromium.launch()
  const context = {
    label: 'blank representative body',
    part: 'body',
    path: 'proof.body',
    repair: 'keep the analytics dashboard mounted with non-trivial content instead of a blank section',
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    try {
      await page.goto(`${driver.baseUrl}/?app=graph&fb=off&theme=none#inuse`, { waitUntil: 'networkidle' })
      await page.waitForSelector(PRODUCT_SELECTORS.activeView, { timeout: 15000, state: 'attached' })
      const healthy = await page.evaluate(measureProductView, PRODUCT_VIEW_SELECTORS)
      assertProductActiveViewMounted(healthy, context)
      const emptiedRoots = await page.evaluate((selector) => {
        const roots = [...document.querySelectorAll(selector)]
        for (const root of roots) root.replaceChildren()
        return roots.length
      }, PRODUCT_SELECTORS.activeView)
      if (emptiedRoots < 1) {
        throw new Error(
          'product mutations: blank-active-view probe emptied no active view root for field "roots" at path producer.activeView.body; ' +
          'repair: keep the empty evaluate intact so the probe empties the real active view.',
        )
      }
      const emptied = await page.evaluate(measureProductView, PRODUCT_VIEW_SELECTORS)
      assertProductActiveViewMounted(emptied, context)
    } finally {
      await page.close()
    }
  } finally {
    await browser.close()
    await driver.stop()
  }
  throw new Error(
    'product mutations: emptied active view unexpectedly cleared the floor for field "activeView" at path producer.activeView.body; ' +
    'repair: keep the floors scoped to the active view so the hidden changes view cannot satisfy them.',
  )
}

/**
 * Run the unrendered-active-view mutation against the real served app in ONE
 * bounded browser session. A present-but-unrendered active view keeps every
 * node and every character it had, so the only thing that can refuse it is the
 * producer's rendered predicate. The healthy page is measured first and must
 * clear that predicate, then one stylesheet per declared unrendered mode is
 * installed in turn, the shared measurement is taken again, and the single
 * predicate must refuse every mode by name with the measured display,
 * visibility, opacity, box, and stage intersection. The browser, the page, the
 * service, and each stylesheet are released as the loop advances, so one
 * launch covers all five declared modes and nothing is left installed.
 * @param {object} [options] mutation options
 * @param {number} [options.port] fixed loopback port for the proof service
 * @returns {Promise<never>} always throws with the producer's unrendered-view diagnostic
 */
export async function mutateUnrenderedActiveView({ port = 5202 } = {}) {
  const { chromium } = await import('@playwright/test')
  const driver = createProductStaticDriver({ port, host: FAIRTEST_APP_HOST, distRoot: DIST_ROOT })
  await driver.start()
  const browser = await chromium.launch()
  const context = {
    label: 'unrendered representative body',
    part: 'body',
    path: 'proof.body',
    repair: 'keep the analytics dashboard laid out and rendered instead of present but invisible',
  }
  const refused = []
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    try {
      await page.goto(`${driver.baseUrl}/?app=graph&fb=off&theme=none#inuse`, { waitUntil: 'networkidle' })
      await page.waitForSelector(PRODUCT_SELECTORS.activeView, { timeout: 15000, state: 'attached' })
      const healthy = await page.evaluate(measureProductView, PRODUCT_VIEW_SELECTORS)
      assertProductActiveViewMounted(healthy, context)
      for (const mode of PRODUCT_UNRENDERED_MODES) {
        await page.addStyleTag({ content: PRODUCT_UNRENDERED_RULES[mode] })
        const measured = await page.evaluate(measureProductView, PRODUCT_VIEW_SELECTORS)
        let message = null
        try {
          assertProductActiveViewMounted(measured, context)
        } catch (error) {
          message = error instanceof Error ? error.message : String(error)
        }
        if (!message) {
          throw new Error(
            `product mutations: unrendered-active-view probe left the ${mode} active view clearing the floor for field "mode" at path producer.activeView.body.refusals; ` +
            'repair: keep the rendered predicate so a present but unrendered active view fails closed.',
          )
        }
        if (!message.includes(mode)) {
          throw new Error(
            `product mutations: unrendered-active-view probe refused the ${mode} active view without naming the mode for field "mode" at path producer.activeView.body.refusals; got ${message}; ` +
            'repair: report the measured unrendered mode beside the computed style and box so the diagnostic names the refusal.',
          )
        }
        refused.push(Object.freeze({
          mode,
          roots: measured.activeView.roots,
          rendered: measured.activeView.rendered,
          message: message.split('\n')[0],
        }))
        // A real reload, never a same-document navigation: the row route keeps
        // its hash, so navigating to it again would leave the previous
        // mode's stylesheet installed and the next mode would be measured on
        // top of it.
        await page.reload({ waitUntil: 'networkidle' })
        await page.waitForSelector(PRODUCT_SELECTORS.activeView, { timeout: 15000, state: 'attached' })
      }
    } finally {
      await page.close()
    }
  } finally {
    await browser.close()
    await driver.stop()
  }
  throw new Error(
    `product mutations: unrendered active view refused at the owning boundary for field "mode" at path producer.activeView.body.refusals; ` +
    `the shared measurement reported ${JSON.stringify(refused.map((entry) => ({ mode: entry.mode, roots: entry.roots, rendered: entry.rendered })))}; ` +
    'repair: keep the rendered-root predicate so a present but unrendered active view fails closed while every mode stays named in the diagnostic.',
  )
}

/**
 * Run the wrong-theme mutation: the light row renders the dark value, so
 * the theme observation rejects the contradiction before any capture or
 * evidence work.
 */
export function mutateWrongTheme() {
  return observeProductTheme({
    expected: 'light',
    renderedAttribute: '',
    source: 'product-mutations:wrong-theme',
    observedAtMs: 1000,
  })
}

/**
 * Create a never-started lifecycle driver. The unregistered-action mutation
 * fails in the adapter registry before any lifecycle call, so this driver
 * only satisfies the adapter's shape check and is never started.
 * @returns {object} the inert injected driver
 */
function inertDriver() {
  return {
    start: async () => {},
    stop: async () => {},
    reset: async () => {},
    isRunning: () => false,
  }
}

/**
 * Run the unregistered-action mutation against the real adapter and the
 * real target registry. Both reject the name outside the app-owned registry.
 * @returns {Promise<never>} always throws
 */
export async function mutateUnregisteredAction() {
  getProductAction('select-changes-section')
  const adapter = await createFairtradeAdapter({
    runId: 'mutation-probe-action',
    driver: inertDriver(),
    createdAtMs: 1000,
  })
  await adapter.performAction('select-changes-section', { observedAtMs: 2000 })
  await adapter.teardown()
}

/**
 * Run the cross-kind mutation: a component-shaped identity is presented as
 * a product proof, so the shared contract rejects it.
 */
export function mutateCrossKindProof() {
  return buildProductProof(validMutationProofInput({
    identity: { kind: 'component', id: 'mutation-cross-kind', createdAtMs: 1000 },
  }))
}

/**
 * Run the stale-served-asset mutation against the real producer path. A
 * throwaway copy of the real dist/ is mutated, served over real HTTP
 * through the real static driver, and compared against the recorded digest
 * of the real tree. The served digest differs, so the provenance comparison
 * fails closed. The real dist/ is never modified and the copy is removed in
 * a finally block.
 * @param {object} [options] mutation options
 * @param {number} [options.port] fixed loopback port for the throwaway service
 * @returns {Promise<never>} always throws with the stale-asset diagnostic
 */
export async function mutateStaleServedAsset({ port = 5197 } = {}) {
  const recordedDigest = digestRecordedIndexHtml(DIST_ROOT)
  const scratch = mkdtempSync(join(tmpdir(), 'fairtest-mutation-stale-'))
  let driver = null
  try {
    cpSync(DIST_ROOT, scratch, { recursive: true })
    const copyIndex = join(scratch, 'index.html')
    writeFileSync(copyIndex, `${readFileSync(copyIndex, 'utf8')}\n<!-- fairtest stale-asset mutation probe -->\n`)
    driver = createProductStaticDriver({ port, host: FAIRTEST_APP_HOST, distRoot: scratch })
    await driver.start()
    const servedBytes = await fetchBytes(`${driver.baseUrl}/index.html`)
    const servedDigest = sha256(servedBytes)
    servedProvenanceDigestMatch({ recordedDigest, servedDigest, servedUrl: driver.baseUrl })
    throw new Error(
      'product mutations: stale copy unexpectedly matches for field "assetDigests" at path provenance.assetDigests; ' +
      'repair: keep the mutation marker write intact so the throwaway copy stays stale.',
    )
  } finally {
    if (driver) {
      await driver.stop()
    }
    rmSync(scratch, { recursive: true, force: true })
  }
}

/**
 * Run one named mutation by name. Every named mutation must throw; a return
 * means the owning boundary let a real defect through.
 * @param {string} name mutation name from PRODUCT_MUTATION_NAMES
 * @param {object} [options] per-mutation options forwarded to the runner
 * @returns {Promise<unknown>} never resolves: the mutation must throw
 */
export async function runProductMutation(name, options = {}) {
  switch (name) {
    case 'missing-chrome':
      return mutateMissingChrome()
    case 'missing-body':
      return mutateMissingBody()
    case 'missing-section':
      return mutateMissingSection()
    case 'missing-view':
      return mutateMissingView()
    case 'blank-active-view':
      return mutateBlankActiveView(options)
    case 'unrendered-active-view':
      return mutateUnrenderedActiveView(options)
    case 'wrong-theme':
      return mutateWrongTheme()
    case 'unregistered-action':
      return mutateUnregisteredAction(options)
    case 'cross-kind-proof':
      return mutateCrossKindProof()
    case 'stale-served-asset':
      return mutateStaleServedAsset(options)
    default:
      throw new Error(
        `product mutations: unknown mutation ${JSON.stringify(name)} for field "mutation" at path mutation.name; ` +
        `repair: use one of ${PRODUCT_MUTATION_NAMES.join(', ')} for "mutation".`,
      )
  }
}

/**
 * Prove the real DOM path fails when a part element is genuinely absent.
 * Serves the real dist/ on a throwaway loopback port, attaches each product
 * selector on the live tree, removes the element in place, and shows the
 * producer wait observes nothing to attach to. Returns the per-part wait
 * diagnostics. The browser and service are released in a finally block and
 * no tracked source or dist/ byte is modified.
 * @param {object} [options] proof options
 * @param {number} [options.port] fixed loopback port for the proof service
 * @returns {Promise<object[]>} per-part absence evidence
 */
export async function proveDomAbsenceRealPath({ port = 5196 } = {}) {
  const { chromium } = await import('@playwright/test')
  const driver = createProductStaticDriver({ port, host: FAIRTEST_APP_HOST, distRoot: DIST_ROOT })
  await driver.start()
  const browser = await chromium.launch()
  const evidence = []
  try {
    const parts = [
      ['chrome', PRODUCT_SELECTORS.chrome],
      ['section', PRODUCT_SELECTORS.sectionNav],
      ['view', PRODUCT_SELECTORS.sectionView],
      ['body', PRODUCT_SELECTORS.body],
    ]
    for (const [part, selector] of parts) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
      try {
        await page.goto(`${driver.baseUrl}/?app=graph&fb=off&theme=none#inuse`, { waitUntil: 'networkidle' })
        await page.waitForSelector(selector, { timeout: 15000, state: 'attached' })
        await page.evaluate((sel) => {
          document.querySelector(sel)?.remove()
        }, selector)
        let message = null
        try {
          await page.waitForSelector(selector, { timeout: 1500, state: 'attached' })
        } catch (error) {
          message = error instanceof Error ? error.message : String(error)
        }
        if (!message) {
          throw new Error(
            `product mutations: removed ${part} element still attaches for field "${part}" at path proof.${part}; ` +
            `selector ${JSON.stringify(selector)} resolved after removal; ` +
            'repair: keep the removal evaluate intact so the absence proof observes a genuinely missing element.',
          )
        }
        evidence.push(Object.freeze({ part, selector, attachedBefore: true, attachedAfter: false, waitDiagnostic: message }))
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
    await driver.stop()
  }
  // The shared theme observation shape stays valid through the sole source
  // route, so this proof never invents a second vocabulary: one read keeps
  // the contract import live.
  kindsContract.validateThemeObservation(
    { expected: 'dark', observed: 'dark', source: 'product-mutations:dom-absence', observedAtMs: 1000 },
    'product mutations',
  )
  resolutionContract.validateObservedPart({ observed: true, observedAtMs: 1000 }, 'product mutations', 'resolution.chrome')
  return evidence
}

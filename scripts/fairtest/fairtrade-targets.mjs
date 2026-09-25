// Fairtrade-owned product target metadata for the mounted graph surface.
//
// Plain data plus pure functions only. This module names the single built
// product route per theme row, the persistent chrome and representative body
// selectors, the section navigation model, the one named section action, the
// normalized theme rows, and the served-build provenance source contract.
// Nothing here starts a service, reads host state, or touches host globals,
// so every export stays inspectable without a run.

import { importFairtestSource } from '../fairtest-source.mjs'

/**
 * Identifier of the single product target covered by this module.
 * @type {string}
 */
export const PRODUCT_TARGET_ID = 'fairtrade-graph-product'

/**
 * Host kind of the product target. Membership is always checked against the
 * shared closed vocabulary, never against a local copy.
 * @type {string}
 */
export const PRODUCT_TARGET_KIND = 'product'

/**
 * Section the graph surface renders before any action.
 * @type {string}
 */
export const PRODUCT_INITIAL_SECTION = 'analytics'

/**
 * The single named action the product target offers.
 * @type {string}
 */
export const PRODUCT_ACTION_NAME = 'select-map-section'

/**
 * Section the named action starts from.
 * @type {string}
 */
export const PRODUCT_ACTION_FROM_SECTION = 'analytics'

/**
 * Section the named action selects.
 * @type {string}
 */
export const PRODUCT_ACTION_TO_SECTION = 'map'

/**
 * Product-only selector bundle. Keys name the observed part, values are the
 * selectors the row-scoped producer queries on the real built surface.
 * @type {object}
 */
export const PRODUCT_SELECTORS = Object.freeze({
  chrome: '.iu-bar',
  body: '.iu-view',
  sectionNav: 'nav[aria-label="peasant sections"]',
  activeSection: 'nav[aria-label="peasant sections"] .iu-subnav-item[aria-current="page"]',
  sectionView: '#inuse-stage[role="tabpanel"]',
})

/**
 * Opaque handle names for the separately observed product parts.
 * @type {object}
 */
export const PRODUCT_HANDLES = Object.freeze({
  chrome: 'chrome',
  body: 'body',
  section: 'section',
  view: 'view',
})

/**
 * Section ids the graph surface may report as active.
 * @type {string[]}
 */
export const PRODUCT_SECTIONS = Object.freeze(['analytics', 'changes', 'map'])

/**
 * Named fixtures the product target serves.
 * @type {string[]}
 */
export const PRODUCT_FIXTURES = Object.freeze(['product-theme-rows', 'product-section-select'])

/**
 * Named actions the product target offers.
 * @type {string[]}
 */
export const PRODUCT_ACTIONS = Object.freeze([PRODUCT_ACTION_NAME])

/**
 * Served-build provenance source contract. Declares where the row-scoped
 * producer reads commit, dirtiness, asset digests, viewport, target identity,
 * and theme observations from; the producer fills the values per run.
 * @type {object}
 */
export const PRODUCT_PROVENANCE_SOURCE = Object.freeze({
  source: 'built-app',
  root: 'dist',
  entries: Object.freeze(['index.html', 'assets']),
  fields: Object.freeze(['commit', 'dirty', 'assetDigests', 'viewport', 'targetIdentity', 'themeObservations']),
})

const PRODUCT_ACTION = Object.freeze({
  name: PRODUCT_ACTION_NAME,
  from: PRODUCT_ACTION_FROM_SECTION,
  to: PRODUCT_ACTION_TO_SECTION,
})

const PRODUCT_TARGET_RECORD = Object.freeze({
  id: PRODUCT_TARGET_ID,
  kind: PRODUCT_TARGET_KIND,
  initialSection: PRODUCT_INITIAL_SECTION,
  selectors: PRODUCT_SELECTORS,
  handles: PRODUCT_HANDLES,
  sections: PRODUCT_SECTIONS,
  fixtures: PRODUCT_FIXTURES,
  actions: PRODUCT_ACTIONS,
  action: PRODUCT_ACTION,
  provenanceSource: PRODUCT_PROVENANCE_SOURCE,
})

/**
 * Target registry keyed by target id. This module declares exactly one
 * product target.
 * @type {object}
 */
export const PRODUCT_TARGET_REGISTRY = Object.freeze({
  [PRODUCT_TARGET_ID]: PRODUCT_TARGET_RECORD,
})

/**
 * Return the frozen target record for a registered id.
 * @param {unknown} id target id requested by the caller
 * @returns {object} the frozen product target record
 */
export function selectProductTarget(id) {
  if (typeof id !== 'string' || !Object.hasOwn(PRODUCT_TARGET_REGISTRY, id)) {
    throw new Error(
      `fairtrade targets: unknown target ${JSON.stringify(id)} for field "id" at path target.id; ` +
      `repair: use one of ${Object.keys(PRODUCT_TARGET_REGISTRY).join(', ')} for "id".`,
    )
  }
  return PRODUCT_TARGET_REGISTRY[id]
}

/**
 * Return the frozen named action for a registered action name.
 * @param {unknown} name action name requested by the caller
 * @returns {object} the frozen product action record
 */
export function getProductAction(name) {
  if (name !== PRODUCT_ACTION_NAME) {
    throw new Error(
      `fairtrade targets: unknown action ${JSON.stringify(name)} for field "action" at path target.action; ` +
      `repair: use one of ${PRODUCT_ACTION_NAME} for "action".`,
    )
  }
  return PRODUCT_ACTION
}

/**
 * Normalize a rendered data-theme attribute value to a theme name. An absent
 * or empty value is the dark surface; the light surface carries the light
 * value. Anything else fails with an actionable diagnostic.
 * @param {unknown} rawAttributeValue raw attribute value, absent as nullish
 * @returns {string} dark or light
 */
export function normalizeRenderedTheme(rawAttributeValue) {
  if (rawAttributeValue === undefined || rawAttributeValue === null || rawAttributeValue === '') {
    return 'dark'
  }
  if (rawAttributeValue === 'light') {
    return 'light'
  }
  throw new Error(
    `fairtrade targets: unexpected rendered theme ${JSON.stringify(rawAttributeValue)} for field "renderedAttribute" at path theme.renderedAttribute; ` +
    `repair: render dark as an absent or empty data-theme value and light as data-theme="light".`,
  )
}

/**
 * Build the product route for a theme row. Dark rows request the bare theme
 * value; light rows request the light value. The query and hash stay
 * app-owned data in this layer.
 * @param {unknown} theme dark or light row theme
 * @returns {string} the product route for the row
 */
export function productRouteForTheme(theme) {
  if (theme === 'dark') {
    return '/?app=graph&fb=off&theme=none#inuse'
  }
  if (theme === 'light') {
    return '/?app=graph&fb=off&theme=light#inuse'
  }
  throw new Error(
    `fairtrade targets: unknown row theme ${JSON.stringify(theme)} for field "theme" at path route.theme; ` +
    'repair: use one of dark, light for "theme".',
  )
}

/**
 * Return the normalized row record for a theme: theme name, route, expected
 * rendered attribute marker, and initial section.
 * @param {unknown} theme dark or light row theme
 * @returns {object} the frozen theme row record
 */
export function productThemeRow(theme) {
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error(
      `fairtrade targets: unknown row theme ${JSON.stringify(theme)} for field "theme" at path row.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  return Object.freeze({
    theme,
    route: productRouteForTheme(theme),
    expectedAttribute: theme === 'light' ? 'light' : '',
    initialSection: PRODUCT_INITIAL_SECTION,
  })
}

/**
 * Build the raw target declaration input for the product target. Capability
 * contents stay caller-owned: pass the shared product inventory so the closed
 * vocabulary is never duplicated here.
 * @param {object} [input] declaration inputs
 * @param {number} input.createdAtMs creation time in whole milliseconds
 * @param {string[]} input.capabilities declared capability inventory
 * @param {string[]} [input.fixtures] named fixtures served
 * @param {string[]} [input.actions] named actions offered
 * @returns {object} the frozen declaration input
 */
export function productDeclarationInput({ createdAtMs, capabilities, fixtures = PRODUCT_FIXTURES, actions = PRODUCT_ACTIONS } = {}) {
  if (!Number.isInteger(createdAtMs) || createdAtMs < 0 || createdAtMs > 9007199254740991) {
    throw new Error(
      `fairtrade targets: invalid value ${JSON.stringify(createdAtMs)} for field "createdAtMs" at path target.identity.createdAtMs; ` +
      'repair: use an integer from 0 to 9007199254740991 for "createdAtMs".',
    )
  }
  if (!Array.isArray(capabilities) || capabilities.length === 0 || capabilities.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(
      'fairtrade targets: invalid capabilities for field "capabilities" at path target.capabilities; ' +
      'repair: provide the shared product capability inventory for "capabilities".',
    )
  }
  return Object.freeze({
    kind: PRODUCT_TARGET_KIND,
    identity: Object.freeze({ kind: PRODUCT_TARGET_KIND, id: PRODUCT_TARGET_ID, createdAtMs }),
    capabilities: Object.freeze([...capabilities]),
    fixtures: Object.freeze([...fixtures]),
    actions: Object.freeze([...actions]),
  })
}

/**
 * Prove the product target against the shared contract through the sole
 * source route: kind membership in the closed vocabulary, capability
 * inventory validation, and declaration validation.
 * @param {object} [input] validation inputs
 * @param {number} input.createdAtMs creation time in whole milliseconds
 * @returns {Promise<object>} the frozen contract receipt
 */
export async function validateProductTargetContract({ createdAtMs } = {}) {
  const kinds = await importFairtestSource('src/host-contract/kinds.mjs')
  const contractTargets = await importFairtestSource('src/host-contract/targets.mjs')
  if (!kinds.HOST_KINDS.includes(PRODUCT_TARGET_KIND)) {
    throw new Error(
      `fairtrade targets: kind ${JSON.stringify(PRODUCT_TARGET_KIND)} is outside the shared vocabulary for field "kind" at path target.kind; ` +
      `repair: use one of ${[...kinds.HOST_KINDS].join(', ')} for "kind".`,
    )
  }
  const capabilities = contractTargets.validateCapabilityList(
    [...contractTargets.PRODUCT_CAPABILITIES],
    PRODUCT_TARGET_KIND,
    'fairtrade targets',
    'target.capabilities',
  )
  const declaration = contractTargets.createTargetDeclaration(
    productDeclarationInput({ createdAtMs, capabilities: [...capabilities] }),
  )
  return Object.freeze({ kind: PRODUCT_TARGET_KIND, capabilities, declaration })
}

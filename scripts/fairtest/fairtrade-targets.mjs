// @ts-check

// Fairtrade-owned product target metadata for the mounted graph surface.
//
// Plain data plus pure functions only. This module names the product route
// registry (one entry per demo route a mounted row drives, each with its app,
// query, section navigation, initial section, named action, and optional
// page-level notice), the persistent chrome and representative body selectors,
// the section navigation model, the registered section actions, the normalized
// theme rows, and the served-build provenance source contract. Nothing here
// starts a service, reads host state, or touches host globals, so every export
// stays inspectable without a run.

import { importFairtestSource } from '../fairtest-source.mjs'
import { fairtestRelative } from './fairtest-paths.mjs'

const kindsContract = await importFairtestSource('src/host-contract/kinds.mjs')
const targetsContract = await importFairtestSource('src/host-contract/targets.mjs')
const resolutionContract = await importFairtestSource('src/host-contract/resolution.mjs')
const valuesContract = await importFairtestSource('src/core/values.mjs')

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
const PRODUCT_TARGET_KIND = 'product'

/**
 * Section the graph surface renders before any action. The local app's
 * section registry opens on home.
 * @type {string}
 */
export const PRODUCT_INITIAL_SECTION = 'home'

/**
 * The named action the graph routes offer: one press on the settings item in
 * the section navigation.
 * @type {string}
 */
export const PRODUCT_ACTION_NAME = 'select-settings-section'

/**
 * Section the named action starts from.
 * @type {string}
 */
const PRODUCT_ACTION_FROM_SECTION = 'home'

/**
 * Section the named action selects.
 * @type {string}
 */
export const PRODUCT_ACTION_TO_SECTION = 'settings'

/**
 * Display label the section navigation renders for PRODUCT_ACTION_TO_SECTION.
 * A section id and its rendered label may be different strings on the real
 * surface (the route-only map section reads "code map"), so the row carries
 * the rendered label from here instead of repeating the product copy in the
 * producer.
 * @type {string}
 */
export const PRODUCT_ACTION_LABEL = 'settings'

/**
 * Accessible name of the graph app's section navigation.
 * @type {string}
 */
const PRODUCT_NAV_LABEL = 'peasant sections'

/**
 * Build the product-only selector bundle for one demo app's section
 * navigation. Keys name the observed part, values are the selectors the
 * row-scoped producer queries on the real built surface. The bundle is the
 * single declared source of app structure: the producer derives every product
 * selector it touches from these keys and holds no `iu-` class or `#inuse`
 * selector literal of its own. Only the navigation's accessible name differs
 * between demo apps, so a route entry names it and the rest is shared.
 * @param {unknown} navLabel accessible name of the section navigation
 * @returns {Readonly<{ shell: string, chrome: string, body: string, activeView: string, sectionNav: string, sectionItem: string, activeSectionItem: string, activeSection: string, sectionView: string }>} the frozen selector bundle
 */
export function productSelectorsFor(navLabel) {
  if (typeof navLabel !== 'string' || navLabel.trim().length === 0 || navLabel.includes('"')) {
    throw new Error(
      `fairtrade targets: invalid section navigation label ${JSON.stringify(navLabel)} for field "navLabel" at path route.navLabel; ` +
      'repair: name the accessible label the section navigation renders, without quotes, for "navLabel".',
    )
  }
  const sectionNav = `nav[aria-label="${navLabel}"]`
  const sectionItem = '.iu-subnav-item'
  return Object.freeze({
    // The in-use shell root. The ARIA snapshot the row records is taken from
    // this root so the snapshot covers the whole product shell, not one part.
    shell: '#inuse',
    chrome: '.iu-bar',
    body: '.iu-view',
    // The active view inside the view container. The container also holds the
    // permanently mounted hidden changes view, so the container alone can never
    // stand in for the active view: only the children the shell is not hiding
    // carry the section the row is proving. One selector, summed over every
    // active child, so a section rendering more than one root is measured whole.
    activeView: '.iu-view > :not([hidden])',
    sectionNav,
    // The section-item class and the active-state class the shell toggles, kept
    // as their own keys so the row never re-spells them inline. activeSection is
    // derived from the two so the nav-scoped active query and the two class
    // probes cannot drift apart.
    sectionItem,
    activeSectionItem: `${sectionItem}.active`,
    activeSection: `${sectionNav} ${sectionItem}[aria-current="page"]`,
    sectionView: '#inuse-stage[role="tabpanel"]',
  })
}

/**
 * The graph app's selector bundle.
 */
export const PRODUCT_SELECTORS = productSelectorsFor(PRODUCT_NAV_LABEL)

/**
 * Drift guard: the nav-scoped active-section query is assembled from the nav,
 * the section-item class, and the shell's own active marker, so the item key,
 * the active-state key, and this query can never disagree about what "the
 * active section button" means.
 */
if (PRODUCT_SELECTORS.activeSection !== `${PRODUCT_SELECTORS.sectionNav} ${PRODUCT_SELECTORS.sectionItem}[aria-current="page"]`) {
  throw new Error(
    'fairtrade targets: active-section selector drifted for field "activeSection" at path target.selectors.activeSection; ' +
    `got ${JSON.stringify(PRODUCT_SELECTORS.activeSection)}; ` +
    'repair: derive the active-section query from the sectionNav, sectionItem, and active-marker keys instead of a second literal.',
  )
}
if (!PRODUCT_SELECTORS.activeSectionItem.startsWith(`${PRODUCT_SELECTORS.sectionItem}.`)) {
  throw new Error(
    'fairtrade targets: active-section item drifted for field "activeSectionItem" at path target.selectors.activeSectionItem; ' +
    `got ${JSON.stringify(PRODUCT_SELECTORS.activeSectionItem)}; ` +
    `repair: express the active state as the section item class ${JSON.stringify(PRODUCT_SELECTORS.sectionItem)} plus the shell's active class.`,
  )
}

/**
 * Opaque handle names for the separately observed product parts.
 * @type {object}
 */
const PRODUCT_HANDLES = Object.freeze({
  chrome: 'chrome',
  body: 'body',
  section: 'section',
  view: 'view',
})

/**
 * Section ids the graph surface may report as active: the local app's section
 * registry, home and settings in the navigation, analytics, changes, and the
 * code map by route only.
 * @type {readonly string[]}
 */
const PRODUCT_SECTIONS = Object.freeze(['home', 'settings', 'analytics', 'changes', 'map'])

/**
 * Named fixtures the product target serves.
 * @type {readonly string[]}
 */
const PRODUCT_FIXTURES = Object.freeze(['product-theme-rows', 'product-section-select'])

/**
 * Named actions the product target offers.
 * @type {readonly string[]}
 */
const PRODUCT_ACTIONS = Object.freeze([PRODUCT_ACTION_NAME])

/**
 * Served-build provenance source contract. Declares where the row-scoped
 * producer reads commit, dirtiness, asset digests, viewport, target identity,
 * and theme observations from; the producer fills the values per run.
 */
export const PRODUCT_PROVENANCE_SOURCE = Object.freeze({
  source: 'built-app',
  root: fairtestRelative('distRoot'),
  entries: Object.freeze(['index.html', 'assets']),
  // `servedFrom` names the tree the recorded digests were compared against and
  // `commitCorrespondence` names who owns the remaining comparison: the row can
  // prove the served bytes are this run's built bytes, but binding those bytes
  // to a commit is the verifier's comparison, so the record says so rather than
  // letting `commit` read as a digest-level claim it is not.
  fields: Object.freeze(['source', 'root', 'commit', 'dirty', 'assetDigests', 'servedFrom', 'commitCorrespondence', 'viewport', 'targetIdentity', 'themeObservations', 'servedUrl', 'producedAtMs']),
})

const PRODUCT_ACTION = Object.freeze({
  name: PRODUCT_ACTION_NAME,
  from: PRODUCT_ACTION_FROM_SECTION,
  to: PRODUCT_ACTION_TO_SECTION,
  label: PRODUCT_ACTION_LABEL,
})

/**
 * Every registered section action keyed by name. A route entry names one of
 * these; the proof builder and the adapter accept only a registered name.
 * @type {Readonly<Record<string, { name: string, from: string, to: string, label: string }>>}
 */
const PRODUCT_ACTION_REGISTRY = Object.freeze({
  [PRODUCT_ACTION_NAME]: PRODUCT_ACTION,
})

if (JSON.stringify(Object.keys(PRODUCT_ACTION_REGISTRY)) !== JSON.stringify([...PRODUCT_ACTIONS])) {
  throw new Error(
    'fairtrade targets: action registry drifted from the declared actions for field "actions" at path target.actions; ' +
    'repair: register exactly the declared product actions.',
  )
}

/**
 * One page-level notice a route renders between the section navigation and
 * the view container, and the evidence the row records for it.
 * @typedef {object} ProductNotice
 * @property {string} name notice name recorded in the row
 * @property {string} selector the notice root
 * @property {string} status the live-region message inside the notice root
 * @property {readonly string[]} absent selectors that must not render inside the notice root
 * @property {readonly { name: string, selector: string, property: string, equals?: string, token?: string }[]} computed computed-style evidence read inside the notice root
 */

/**
 * The local app's offline banner: a section with a role=status message, the
 * start command in a mono code chip, and no wifi glyph (the internet is fine;
 * the local app is not running). The command's font family must resolve to
 * the mono token and its text keeps its case.
 * @type {ProductNotice}
 */
export const PRODUCT_OFFLINE_NOTICE = Object.freeze({
  name: 'local-offline',
  selector: 'section.cx-offline',
  status: '[role="status"]',
  absent: Object.freeze(['.lucide-wifi-off']),
  computed: Object.freeze([
    Object.freeze({ name: 'commandFontFamily', selector: 'code.cx-cmd-code', property: 'fontFamily', token: '--font-mono' }),
    Object.freeze({ name: 'commandTextTransform', selector: 'code.cx-cmd-code', property: 'textTransform', equals: 'none' }),
  ]),
})

/**
 * One product route a mounted row drives: the row-key prefix, the demo app and
 * extra query parameters, the section navigation's accessible name and the
 * selector bundle derived from it, the section vocabulary, the initial section
 * and its rendered label, the registered action, and an optional page-level
 * notice. Another demo app is one more entry with its own app id and
 * navigation label; nothing in the producer changes.
 * @typedef {object} ProductRoute
 * @property {string} key row-key prefix; rows are `<key>-<theme>`
 * @property {string} app demo app id served in the `app` query parameter
 * @property {readonly (readonly [string, string])[]} params extra query parameters, in order
 * @property {string} navLabel accessible name of the section navigation
 * @property {ReturnType<typeof productSelectorsFor>} selectors selector bundle for this navigation
 * @property {readonly string[]} sections section ids the route may report as active
 * @property {string} initialSection section the route opens on
 * @property {string} initialLabel label the navigation renders for the initial section
 * @property {{ name: string, from: string, to: string, label: string }} action the registered named action
 * @property {ProductNotice | null} notice page-level notice the route renders, or null
 */

/**
 * Declare one product route, deriving the selector bundle from the navigation
 * label and resolving the action through the registry, so an entry that names
 * an unregistered action or an initial section the action does not start from
 * cannot be constructed.
 * @param {{ key: string, app: string, params?: (readonly [string, string])[], navLabel: string, sections: readonly string[], initialSection: string, initialLabel: string, action: string, notice?: ProductNotice | null }} input route declaration
 * @returns {ProductRoute} the frozen route entry
 */
function defineProductRoute(input) {
  const action = getProductAction(input.action)
  if (action.from !== input.initialSection || !input.sections.includes(input.initialSection) || !input.sections.includes(action.to)) {
    throw new Error(
      `fairtrade targets: route ${JSON.stringify(input.key)} does not start where its action starts for field "initialSection" at path route.initialSection; ` +
      `the route opens on ${JSON.stringify(input.initialSection)} and action ${JSON.stringify(action.name)} goes from ${JSON.stringify(action.from)} to ${JSON.stringify(action.to)}; ` +
      'repair: open the route on the section its action starts from, and list both sections in the route vocabulary.',
    )
  }
  return Object.freeze({
    key: input.key,
    app: input.app,
    params: Object.freeze((input.params ?? []).map((pair) => /** @type {readonly [string, string]} */ (Object.freeze([pair[0], pair[1]])))),
    navLabel: input.navLabel,
    selectors: productSelectorsFor(input.navLabel),
    sections: Object.freeze([...input.sections]),
    initialSection: input.initialSection,
    initialLabel: input.initialLabel,
    action,
    notice: input.notice ?? null,
  })
}

/**
 * The product routes the mounted product rows drive, in row order. The first
 * entry is the default route: the graph app opens on home and the named action
 * selects settings. The second is the same app with the local offline banner
 * rendered above the home body.
 * @type {readonly ProductRoute[]}
 */
export const PRODUCT_ROUTES = Object.freeze([
  defineProductRoute({
    key: 'product',
    app: 'graph',
    navLabel: PRODUCT_NAV_LABEL,
    sections: PRODUCT_SECTIONS,
    initialSection: PRODUCT_INITIAL_SECTION,
    initialLabel: PRODUCT_INITIAL_SECTION,
    action: PRODUCT_ACTION_NAME,
  }),
  defineProductRoute({
    key: 'product-offline',
    app: 'graph',
    params: [['local', 'offline']],
    navLabel: PRODUCT_NAV_LABEL,
    sections: PRODUCT_SECTIONS,
    initialSection: PRODUCT_INITIAL_SECTION,
    initialLabel: PRODUCT_INITIAL_SECTION,
    action: PRODUCT_ACTION_NAME,
    notice: PRODUCT_OFFLINE_NOTICE,
  }),
])

/**
 * The default product route: the first registry entry.
 * @type {ProductRoute}
 */
export const PRODUCT_DEFAULT_ROUTE = PRODUCT_ROUTES[0]

// Drift guard: the default route's selector bundle is the exported bundle, so
// the registry and the row can never read two different graph navigations.
if (PRODUCT_DEFAULT_ROUTE.selectors.sectionNav !== PRODUCT_SELECTORS.sectionNav || new Set(PRODUCT_ROUTES.map((route) => route.key)).size !== PRODUCT_ROUTES.length) {
  throw new Error(
    'fairtrade targets: product route registry drifted for field "routes" at path target.routes; ' +
    'repair: keep the first route on the graph navigation and give every route its own key.',
  )
}

/**
 * Return the registered product route for a key.
 * @param {unknown} key route key requested by the caller
 * @returns {ProductRoute} the frozen route entry
 */
export function selectProductRoute(key) {
  const route = PRODUCT_ROUTES.find((entry) => entry.key === key)
  if (!route) {
    throw new Error(
      `fairtrade targets: unknown product route ${JSON.stringify(key)} for field "route" at path row.route; ` +
      `repair: use one of ${PRODUCT_ROUTES.map((entry) => entry.key).join(', ')} for "route".`,
    )
  }
  return route
}

/**
 * The ways an active view can be PRESENT in the DOM and still not RENDERED.
 * Every name here is a fail-closed reason the row reports for the active
 * view: a root in one of these modes is excluded from the rendered
 * population the floors are applied to, so an unrendered active view can
 * never satisfy a count, a text-length, or a screenshot floor. Declared in
 * the app-owned registry because the modes are named product evidence
 * vocabulary: the in-page measurement reports them, the guard refuses on
 * them, and the record carries the rendered/total split beside them.
 * @type {readonly string[]}
 */
export const PRODUCT_UNRENDERED_MODES = Object.freeze([
  'display-none',
  'visibility-hidden',
  'opacity-zero',
  'zero-size',
  'clipped',
])

/**
 * Exact field set of one per-root unrendered refusal the in-page measurement
 * reports. The measured computed style and box travel with the mode, so a
 * verifier reads why a root was excluded and not only that it was.
 * @type {readonly string[]}
 */
export const PRODUCT_UNRENDERED_REFUSAL_FIELDS = Object.freeze([
  'mode',
  'display',
  'visibility',
  'opacity',
  'width',
  'height',
  'intersectsStage',
])

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
 * The one product target as a validated value: its kind, id, capability
 * inventory, fixtures, and actions, plus the app-owned surface metadata. The
 * capability inventory is validated against the shared product vocabulary and
 * required subset at declaration, so a product target missing a required
 * capability cannot be constructed. The adapter reads the declaration input
 * and the registered action from these fields rather than branching on kind.
 */
export const PRODUCT_TARGET = Object.freeze({
  ...PRODUCT_TARGET_RECORD,
  ...targetsContract.createTargetValue({
    kind: PRODUCT_TARGET_KIND,
    id: PRODUCT_TARGET_ID,
    capabilities: [...targetsContract.PRODUCT_CAPABILITIES],
    fixtures: PRODUCT_FIXTURES,
    actions: PRODUCT_ACTIONS,
  }, 'fairtrade targets'),
})

/**
 * Target registry keyed by target id. This module declares exactly one
 * product target.
 */
export const PRODUCT_TARGET_REGISTRY = Object.freeze({
  [PRODUCT_TARGET_ID]: PRODUCT_TARGET,
})

/**
 * The frozen product target record selectProductTarget returns. Only the
 * fields consumers read are named; the shared target-value fields are owned
 * by the contract module.
 * @typedef {object} ProductTargetRecord
 * @property {string} id
 * @property {string} kind
 * @property {string} initialSection
 * @property {typeof PRODUCT_SELECTORS} selectors
 * @property {readonly string[]} sections
 * @property {object} handles
 * @property {readonly string[]} fixtures
 * @property {readonly string[]} actions
 * @property {{ name: string, from: string, to: string, label: string }} action
 * @property {object} provenanceSource
 */

/**
 * The declaration input productDeclarationInput returns.
 * @typedef {object} ProductDeclarationInput
 * @property {string} kind
 * @property {{ kind: string, id: string, createdAtMs: number }} identity
 * @property {readonly string[]} capabilities
 * @property {readonly string[]} fixtures
 * @property {readonly string[]} actions
 */

/**
 * Arguments productDeclarationInput accepts: the creation time, the shared
 * capability inventory, and the optional named fixtures and actions.
 * @typedef {object} ProductDeclarationInputArgs
 * @property {number} createdAtMs creation time in whole milliseconds
 * @property {string[]} capabilities declared capability inventory
 * @property {readonly string[]} [fixtures] named fixtures served
 * @property {readonly string[]} [actions] named actions offered
 */

/**
 * Arguments validateProductTargetContract accepts.
 * @typedef {object} ProductTargetContractInput
 * @property {number} createdAtMs creation time in whole milliseconds
 */

/**
 * The contract receipt validateProductTargetContract returns.
 * @typedef {object} ProductTargetContractReceipt
 * @property {string} kind
 * @property {readonly string[]} capabilities
 * @property {ProductDeclarationInput} declaration
 */

/**
 * Return the frozen target record for a registered id.
 * @param {unknown} id target id requested by the caller
 * @returns {ProductTargetRecord} the frozen product target record
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
 * @returns {{ name: string, from: string, to: string, label: string }} the frozen product action record
 */
export function getProductAction(name) {
  if (typeof name !== 'string' || !Object.hasOwn(PRODUCT_ACTION_REGISTRY, name)) {
    throw new Error(
      `fairtrade targets: unknown action ${JSON.stringify(name)} for field "action" at path target.action; ` +
      `repair: use one of ${Object.keys(PRODUCT_ACTION_REGISTRY).join(', ')} for "action".`,
    )
  }
  return PRODUCT_ACTION_REGISTRY[name]
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
 * value; light rows request the light value; the route entry's own query
 * parameters follow the theme. The query and hash stay app-owned data in this
 * layer.
 * @param {unknown} theme dark or light row theme
 * @param {ProductRoute} [route] route entry, defaults to the default route
 * @returns {string} the product route for the row
 */
export function productRouteForTheme(theme, route = PRODUCT_DEFAULT_ROUTE) {
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error(
      `fairtrade targets: unknown row theme ${JSON.stringify(theme)} for field "theme" at path route.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  const extra = route.params.map(([name, value]) => `&${name}=${value}`).join('')
  return `/?app=${route.app}&fb=off&theme=${theme === 'light' ? 'light' : 'none'}${extra}#inuse`
}

/**
 * Return the normalized row record for a theme: theme name, route, expected
 * rendered attribute marker, and initial section.
 * @param {unknown} theme dark or light row theme
 * @param {ProductRoute} [route] route entry, defaults to the default route
 * @returns {{ theme: string, route: string, expectedAttribute: string, initialSection: string }} the frozen theme row record
 */
export function productThemeRow(theme, route = PRODUCT_DEFAULT_ROUTE) {
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error(
      `fairtrade targets: unknown row theme ${JSON.stringify(theme)} for field "theme" at path row.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  return Object.freeze({
    theme,
    route: productRouteForTheme(theme, route),
    expectedAttribute: theme === 'light' ? 'light' : '',
    initialSection: route.initialSection,
  })
}

/**
 * Build the raw target declaration input for the product target. Capability
 * contents stay caller-owned: pass the shared product inventory so the closed
 * vocabulary is never duplicated here.
 * @param {object} input declaration inputs
 * @param {number} input.createdAtMs creation time in whole milliseconds
 * @param {string[]} input.capabilities declared capability inventory
 * @param {readonly string[]} [input.fixtures] named fixtures served
 * @param {readonly string[]} [input.actions] named actions offered
 * @returns {ProductDeclarationInput} the frozen declaration input
 */
export function productDeclarationInput({ createdAtMs, capabilities, fixtures = PRODUCT_FIXTURES, actions = PRODUCT_ACTIONS } = /** @type {ProductDeclarationInputArgs} */ ({})) {
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
 * @param {object} input validation inputs
 * @param {number} input.createdAtMs creation time in whole milliseconds
 * @returns {Promise<ProductTargetContractReceipt>} the frozen contract receipt
 */
export async function validateProductTargetContract({ createdAtMs } = /** @type {ProductTargetContractInput} */ ({})) {
  if (!kindsContract.HOST_KINDS.includes(PRODUCT_TARGET_KIND)) {
    throw new Error(
      `fairtrade targets: kind ${JSON.stringify(PRODUCT_TARGET_KIND)} is outside the shared vocabulary for field "kind" at path target.kind; ` +
      `repair: use one of ${[...kindsContract.HOST_KINDS].join(', ')} for "kind".`,
    )
  }
  const capabilities = targetsContract.validateCapabilityList(
    [...targetsContract.PRODUCT_CAPABILITIES],
    PRODUCT_TARGET_KIND,
    'fairtrade targets',
    'target.capabilities',
  )
  const declaration = targetsContract.createTargetDeclaration(
    productDeclarationInput({ createdAtMs, capabilities: [...capabilities] }),
  )
  return Object.freeze({ kind: PRODUCT_TARGET_KIND, capabilities, declaration })
}

/**
 * Row-scoped theme setup descriptor: the theme the row serves, the raw
 * attribute value the row must render before any interaction (absent or
 * empty for dark, the light value for light), and the route that serves
 * it. The route query value is the app-owned setup mechanism: the
 * pre-paint inline script sets the light value only when the light query
 * value is present and otherwise leaves the attribute absent.
 * @param {unknown} theme dark or light row theme
 * @returns {{ theme: string, expectedAttribute: string, route: string }} the frozen setup descriptor for the row
 */
export function productThemeSetup(theme) {
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error(
      `fairtrade targets: unknown row theme ${JSON.stringify(theme)} for field "theme" at path setup.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  return Object.freeze({
    theme,
    expectedAttribute: theme === 'light' ? 'light' : '',
    route: productRouteForTheme(theme),
  })
}

/**
 * Reject project-name-only theme inference. The row theme always comes
 * from the explicit row key, never from a runner project name, so any
 * helper that would derive it from a project name must fail instead of
 * guessing.
 * @param {unknown} projectName candidate runner project name
 * @returns {never} always throws
 */
export function productThemeFromProjectName(projectName) {
  throw new Error(
    'fairtrade targets: project-name theme inference is forbidden for field "project" at path theme.project; ' +
    `got ${JSON.stringify(projectName)}; ` +
    'repair: bind the theme from the explicit row key (dark or light) instead of deriving it from the project name.',
  )
}

/**
 * The validated theme observation both observeProductTheme and
 * assertProductThemeObservation return.
 * @typedef {object} ProductThemeObservation
 * @property {string} expected theme the row was asked to render
 * @property {string} observed theme the host reports as rendered
 * @property {string} source note naming where the read came from
 * @property {number} observedAtMs observation time in whole milliseconds
 */

/**
 * Validate a theme observation and reject contradictions. Both names must
 * be known theme names and the rendered name must equal the expected one;
 * a missing record, an unknown name, or an expected/observed mismatch
 * fails here, before any capture or evidence work.
 * @param {unknown} observation candidate theme observation
 * @returns {import('./fairtrade-targets.mjs').ProductThemeObservation} the frozen validated theme observation
 */
export function assertProductThemeObservation(observation) {
  if (observation === null || observation === undefined) {
    throw new Error(
      'fairtrade targets: missing theme observation for field "themeObservation" at path proof.themeObservation; ' +
      'repair: read the rendered value after mount and before interaction, then observe it with the expected row theme.',
    )
  }
  const validated = kindsContract.validateThemeObservation(observation, 'fairtrade targets')
  if (validated.expected !== validated.observed) {
    throw new Error(
      'fairtrade targets: contradictory theme observation for field "observed" at path theme.observed; ' +
      `expected ${JSON.stringify(validated.expected)} but rendered ${JSON.stringify(validated.observed)}; ` +
      'repair: serve the row route for the expected theme and read the rendered value after mount and before interaction.',
    )
  }
  return validated
}

/**
 * @typedef {object} ProductThemeObservationInput
 * @property {string} expected theme the row was asked to render
 * @property {unknown} renderedAttribute raw rendered attribute value, absent as nullish
 * @property {string} source caller-owned note naming where the read came from
 * @property {number} observedAtMs read time in whole milliseconds
 */

/**
 * Observe the rendered theme for a row. The raw attribute value is read
 * from the mounted tree after mount and before any interaction, then
 * normalized through the shared rendered-theme rule (absent or empty is
 * dark, the light value is light) and persisted with the expected theme,
 * the source note, and the read time. Contradictions fail before the
 * record is built.
 * @param {object} input observation inputs, validated field by field at runtime
 * @returns {import('./fairtrade-targets.mjs').ProductThemeObservation} the frozen validated theme observation
 */
export function observeProductTheme(input = /** @type {ProductThemeObservationInput} */ ({})) {
  valuesContract.assertExactFields(input, ['expected', 'renderedAttribute', 'source', 'observedAtMs'], 'fairtrade targets', 'theme')
  const { expected, renderedAttribute, source, observedAtMs } = /** @type {Record<string, unknown>} */ (input)
  if (expected !== 'dark' && expected !== 'light') {
    throw new Error(
      `fairtrade targets: unknown row theme ${JSON.stringify(expected)} for field "expected" at path theme.expected; ` +
      'repair: use one of dark, light for "expected".',
    )
  }
  const observed = normalizeRenderedTheme(renderedAttribute)
  return assertProductThemeObservation({ expected, observed, source, observedAtMs })
}

/**
 * Expected field set of the app-owned product proof record, so fixtures
 * can be checked for exact membership with no silent extras. The base
 * fields cover a proof without a named action; the extended set adds the
 * completed action result.
 * @type {{ kind: string, fields: readonly string[], fieldsWithAction: readonly string[], partFields: readonly string[], themeFields: readonly string[], actionFields: readonly string[], identityFields: readonly string[] }}
 */
export const PRODUCT_PROOF_RECORD_SCHEMA = Object.freeze({
  kind: 'product',
  fields: Object.freeze(['kind', 'identity', 'chrome', 'body', 'route', 'activeSection', 'view', 'theme']),
  fieldsWithAction: Object.freeze(['kind', 'identity', 'chrome', 'body', 'route', 'activeSection', 'view', 'theme', 'action']),
  partFields: Object.freeze(['observed', 'observedAtMs']),
  themeFields: Object.freeze(['expected', 'observed', 'source', 'observedAtMs']),
  actionFields: Object.freeze(['name', 'completed', 'observedAtMs']),
  identityFields: Object.freeze(['kind', 'id', 'createdAtMs']),
})

/**
 * Assemble the app-owned product proof record from separately observed
 * parts and validate it through the shared product resolver. The row
 * theme must equal the observed theme, every one of the five parts must
 * be separately observed (a blanket mounted flag is rejected), the
 * initial section must be one a registered route opens on, and a completed
 * named action must come from the app-owned action registry, start from that
 * initial section, and leave the active section on the action target. Component-shaped and cross-kind records
 * fail through the shared validator. The returned record is frozen.
 * @param {object} input proof inputs, validated field by field at runtime
 * @returns {import('../fairtest-source.mjs').ProductResolution} the frozen validated product resolution
 */
export function buildProductProof(input = /** @type {object} */ ({})) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) {
    throw new Error(
      'fairtrade targets: missing product proof input for field "proof" at path proof; ' +
      'repair: observe chrome, body, route, active section, view, and theme before building the proof.',
    )
  }
  if (Object.hasOwn(input, 'mounted')) {
    throw new Error(
      'fairtrade targets: blanket mounted flag is not an observation for field "mounted" at path proof.mounted; ' +
      'repair: observe chrome, body, route, activeSection, and view separately instead of trusting a mounted boolean.',
    )
  }
  const wantInputFields = Object.hasOwn(input, 'action')
    ? ['rowTheme', 'identity', 'chrome', 'body', 'route', 'activeSection', 'view', 'themeObservation', 'initialSection', 'activeSectionId', 'action']
    : ['rowTheme', 'identity', 'chrome', 'body', 'route', 'activeSection', 'view', 'themeObservation', 'initialSection', 'activeSectionId']
  valuesContract.assertExactFields(input, wantInputFields, 'fairtrade targets', 'proof')
  const record = /** @type {Record<string, unknown>} */ (input)
  if (record.rowTheme !== 'dark' && record.rowTheme !== 'light') {
    throw new Error(
      `fairtrade targets: unknown row theme ${JSON.stringify(record.rowTheme)} for field "rowTheme" at path proof.rowTheme; ` +
      'repair: use one of dark, light for "rowTheme".',
    )
  }
  const identity = targetsContract.validateTargetIdentity(record.identity, 'product', 'fairtrade targets')
  const theme = assertProductThemeObservation(record.themeObservation)
  if (record.rowTheme !== theme.expected) {
    throw new Error(
      'fairtrade targets: row setup does not match the theme observation for field "rowTheme" at path proof.rowTheme; ' +
      `expected ${JSON.stringify(theme.expected)} but the row declares ${JSON.stringify(record.rowTheme)}; ` +
      'repair: serve the row route for the observed theme before building the proof.',
    )
  }
  const parts = /** @type {Record<string, object>} */ ({})
  for (const part of resolutionContract.PRODUCT_ONLY_FIELDS) {
    parts[part] = resolutionContract.validateObservedPart(record[part], 'fairtrade targets', `resolution.${part}`)
  }
  const initialSections = [...new Set(PRODUCT_ROUTES.map((route) => route.initialSection))]
  if (!initialSections.includes(/** @type {string} */ (record.initialSection))) {
    throw new Error(
      `fairtrade targets: unexpected initial section ${JSON.stringify(record.initialSection)} for field "initialSection" at path proof.initialSection; ` +
      `repair: start the proof from ${initialSections.map((section) => JSON.stringify(section)).join(', ')} for "initialSection".`,
    )
  }
  const sections = [...new Set(PRODUCT_ROUTES.flatMap((route) => route.sections))]
  if (!sections.includes(/** @type {string} */ (record.activeSectionId))) {
    throw new Error(
      `fairtrade targets: unknown active section ${JSON.stringify(record.activeSectionId)} for field "activeSectionId" at path proof.activeSectionId; ` +
      `repair: use one of ${sections.join(', ')} for "activeSectionId".`,
    )
  }
  let action = null
  if (Object.hasOwn(input, 'action')) {
    const candidate = /** @type {Record<string, unknown>} */ (record.action)
    const registered = getProductAction(candidate?.name)
    action = resolutionContract.validateNamedResult(record.action, 'fairtrade targets', 'resolution.action')
    if (record.initialSection !== registered.from) {
      throw new Error(
        `fairtrade targets: action ${JSON.stringify(registered.name)} starts from ${JSON.stringify(registered.from)} for field "initialSection" at path proof.initialSection; ` +
        `got ${JSON.stringify(record.initialSection)}; ` +
        `repair: open the row on the ${JSON.stringify(registered.from)} section before completing the named action.`,
      )
    }
    if (record.activeSectionId !== registered.to) {
      throw new Error(
        `fairtrade targets: action ${JSON.stringify(registered.name)} expects the active section ${JSON.stringify(registered.to)} for field "activeSectionId" at path proof.activeSectionId; ` +
        `got ${JSON.stringify(record.activeSectionId)}; ` +
        `repair: select the ${JSON.stringify(registered.to)} section before completing the named action.`,
      )
    }
  } else if (record.activeSectionId !== record.initialSection) {
    throw new Error(
      'fairtrade targets: active section drifted without a named action for field "activeSectionId" at path proof.activeSectionId; ' +
      `got ${JSON.stringify(record.activeSectionId)}; ` +
      `repair: keep the active section on ${JSON.stringify(record.initialSection)} until the named action completes.`,
    )
  }
  const candidate = /** @type {Record<string, unknown>} */ ({ kind: 'product', identity, ...parts, theme })
  if (action) {
    candidate.action = action
  }
  return resolutionContract.validateProductResolution(candidate, 'fairtrade targets')
}

/**
 * Name of the app-owned product accessibility policy. The row gates the
 * scoped product-view scan against a declared violation baseline instead
 * of absolute zero (the pre-existing product defect is recorded, not
 * fixed here) and instead of no gate at all (a record that never fails
 * cannot catch a regression).
 * @type {string}
 */
export const PRODUCT_A11Y_POLICY = 'product-view-baseline-delta'

/**
 * Root the primary accessibility scan is scoped to. Taken from the
 * existing product selector bundle, never a second literal copy.
 * @type {string}
 */
export const PRODUCT_A11Y_SCOPE_ROOT = PRODUCT_SELECTORS.sectionView

/**
 * Observation points carrying a scoped product-view scan: after the
 * initial mount (the route's initial section) and after the named section
 * action completes (the action's target section).
 * @type {readonly string[]}
 */
export const PRODUCT_A11Y_POINTS = Object.freeze(['initial', 'after-action'])

/**
 * Exact field set of the gate receipt assertProductAxeBaselineDelta returns
 * and the record.json accessibility block carries under gate.<slot>. Declared
 * once here, by the policy owner, so the reader that consumes the receipt
 * never hardcodes a second copy of the record shape: a receipt that grows or
 * loses a field turns the browser-free gate case red instead of silently
 * changing the durable contract. `observedSection` is in the set because it is
 * the receipt's only OBSERVED tie to a moment in the row: `point` names which
 * slot the receipt fills, and only the section the page actually showed can
 * prove the scan came from that slot.
 * @type {readonly string[]}
 */
export const PRODUCT_A11Y_GATE_RECEIPT_FIELDS = Object.freeze(['policy', 'point', 'observedSection', 'result', 'measured', 'baseline'])

/**
 * Record gate slots mapped to the app-owned observation point each slot
 * carries, in record order. A verifier reading gate.before is reading the
 * initial measurement and gate.after the after-action measurement; the reader
 * refuses a receipt that claims a different point for its slot.
 */
export const PRODUCT_A11Y_GATE_POINT_SLOTS = Object.freeze({
  before: PRODUCT_A11Y_POINTS[0],
  after: PRODUCT_A11Y_POINTS[1],
})

/**
 * Section id rendered at each scoped observation point of one route.
 * @param {ProductRoute} [route] route entry, defaults to the default route
 * @returns {Readonly<{ initial: string, 'after-action': string }>} the section id per point
 */
export function productA11yPointSections(route = PRODUCT_DEFAULT_ROUTE) {
  return Object.freeze({ initial: route.initialSection, 'after-action': route.action.to })
}

/**
 * The active-section TEXT the live page shows at each scoped observation point
 * of one route, which is what a gate receipt's observedSection is read from.
 * It is declared beside the section ids because the two need not be the same
 * string: the route-only map section's item reads "code map" while the
 * section it activates is "map", so a comparison against the section id would
 * refuse a correct row.
 * @param {ProductRoute} [route] route entry, defaults to the default route
 * @returns {Readonly<{ initial: string, 'after-action': string }>} the rendered label per point
 */
export function productA11yPointLabels(route = PRODUCT_DEFAULT_ROUTE) {
  return Object.freeze({ initial: route.initialLabel, 'after-action': route.action.label })
}

/**
 * Section id rendered at each scoped observation point of the default route.
 */
export const PRODUCT_A11Y_POINT_SECTIONS = productA11yPointSections()

/**
 * The active-section text the live page shows at each scoped observation point
 * of the default route.
 */
export const PRODUCT_A11Y_POINT_LABELS = productA11yPointLabels()

/**
 * Axe impact severity rank, least to most severe. A measured impact above
 * the declared rank for the same violation id fails the row closed.
 * @type {Record<string, number>}
 */
const PRODUCT_A11Y_IMPACT_RANK = Object.freeze({
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
})

/**
 * One declared accessibility baseline violation entry.
 * @typedef {object} ProductA11yBaselineEntry
 * @property {string} id axe rule id observed on the real built surface
 * @property {string} impact declared axe impact name
 * @property {number} nodes declared violating node count
 * @property {readonly string[]} themes row themes the entry was observed in
 */

/**
 * Declared product-view accessibility baseline, keyed by observation point.
 * @typedef {object} ProductA11yBaseline
 * @property {string} policy baseline policy name
 * @property {string} scopeRoot selector root the scan is scoped to
 * @property {Record<string, readonly ProductA11yBaselineEntry[]>} points declared entries keyed by observation point
 */

/**
 * Declared product-view violation baseline, measured on the real built
 * dist/ in both row themes and on every registered route (the default graph
 * route and the offline-banner route reported identical sets): the home
 * point and the settings point both scan clean inside the product view, the
 * offline banner included. Improvement (a violation that disappears) never
 * fails; anything beyond this baseline does.
 * @type {ProductA11yBaseline}
 */
export const PRODUCT_A11Y_BASELINE = Object.freeze({
  policy: PRODUCT_A11Y_POLICY,
  scopeRoot: PRODUCT_A11Y_SCOPE_ROOT,
  points: Object.freeze({
    initial: Object.freeze([]),
    'after-action': Object.freeze([]),
  }),
})

/**
 * Validate one baseline entry shape: exact fields, a ranked impact, a
 * non-negative integer node count, and a non-empty theme inventory drawn
 * from the closed row vocabulary.
 * @param {unknown} entry candidate baseline entry
 * @param {string} point observation point the entry belongs to
 * @returns {ProductA11yBaselineEntry} the validated entry
 */
function validateProductAxeBaselineEntry(entry, point) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(
      `fairtrade targets: missing accessibility baseline entry for field "entry" at path a11y.baseline.${point}; ` +
      'repair: declare each baseline violation with exactly id, impact, nodes, and themes.',
    )
  }
  valuesContract.assertExactFields(entry, ['id', 'impact', 'nodes', 'themes'], 'fairtrade targets', `a11y.baseline.${point}`)
  const candidate = /** @type {Record<string, unknown>} */ (entry)
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    throw new Error(
      `fairtrade targets: invalid violation id ${JSON.stringify(candidate.id)} for field "id" at path a11y.baseline.${point}.id; ` +
      'repair: use the axe rule id observed on the real built surface for "id".',
    )
  }
  if (!Object.hasOwn(PRODUCT_A11Y_IMPACT_RANK, /** @type {string} */ (candidate.impact))) {
    throw new Error(
      `fairtrade targets: unknown impact ${JSON.stringify(candidate.impact)} for field "impact" at path a11y.baseline.${point}.impact; ` +
      `repair: use one of ${Object.keys(PRODUCT_A11Y_IMPACT_RANK).join(', ')} for "impact".`,
    )
  }
  if (!Number.isInteger(candidate.nodes) || /** @type {number} */ (candidate.nodes) < 0) {
    throw new Error(
      `fairtrade targets: invalid node count ${JSON.stringify(candidate.nodes)} for field "nodes" at path a11y.baseline.${point}.nodes; ` +
      'repair: record the measured violating node count as a non-negative integer for "nodes".',
    )
  }
  if (!Array.isArray(candidate.themes) || candidate.themes.length === 0 || candidate.themes.some((theme) => theme !== 'dark' && theme !== 'light')) {
    throw new Error(
      `fairtrade targets: invalid theme inventory ${JSON.stringify(candidate.themes)} for field "themes" at path a11y.baseline.${point}.themes; ` +
      'repair: list every row theme the entry was observed in using dark and light for "themes".',
    )
  }
  return /** @type {ProductA11yBaselineEntry} */ (candidate)
}

/**
 * One frozen gate receipt the record.json accessibility block carries under
 * gate.<slot>. Declared as a named shape so a reader that consumes the
 * receipt types its slots instead of re-deriving the field list.
 * @typedef {object} ProductA11yGateReceipt
 * @property {string} policy
 * @property {string} point
 * @property {string} observedSection
 * @property {string} result
 * @property {number} measured
 * @property {number} baseline
 */

/**
 * Gate a scoped product-view scan against the declared baseline,
 * failing closed when the measurement exceeds it. A violation id absent
 * from the baseline (a new violation), a node count above the declared
 * count, or an impact more severe than declared each fail with a
 * diagnostic naming the rule, the observed triple, the declared
 * baseline, the artifact path, and the repair. A baseline violation
 * that disappears (improvement) never fails.
 * @param {object} input gate inputs
 * @param {string} input.point observation point the measurement belongs to
 * @param {{ id: string, impact: string | null, nodeCount: number }[]} input.measured scoped violations just observed
 * @param {object[]} [input.baseline] declared entries, defaults to the app-owned baseline for the point
 * @param {string} input.observedSection the section the live page showed when the scan was taken, read from the DOM beside the scan
 * @param {string} input.artifactPath row axe.json path the full result was written to
 * @returns {ProductA11yGateReceipt} the frozen gate receipt on pass
 */
export function assertProductAxeBaselineDelta(input) {
  const wantsBaseline = !!input && typeof input === 'object' && Object.hasOwn(input, 'baseline')
  valuesContract.assertExactFields(
    input,
    wantsBaseline ? ['point', 'measured', 'observedSection', 'artifactPath', 'baseline'] : ['point', 'measured', 'observedSection', 'artifactPath'],
    'fairtrade targets',
    'a11y.gate',
  )
  const record = /** @type {Record<string, unknown>} */ (input)
  if (!PRODUCT_A11Y_POINTS.includes(/** @type {string} */ (record.point))) {
    throw new Error(
      `fairtrade targets: unknown accessibility point ${JSON.stringify(record.point)} for field "point" at path a11y.gate.point; ` +
      `repair: use one of ${[...PRODUCT_A11Y_POINTS].join(', ')} for "point".`,
    )
  }
  const point = /** @type {string} */ (record.point)
  // The section a scan ran against is an OBSERVED value read from the live page
  // beside the scan, not a label copied from the declaration. Without it the
  // receipt's point name was the only thing tying a scan to a moment in the
  // row, so a receipt could be handed the other scan with nothing in the
  // record able to contradict it.
  if (typeof record.observedSection !== 'string' || record.observedSection.trim().length === 0) {
    throw new Error(
      `fairtrade targets: missing observed section for field "observedSection" at path a11y.gate.observedSection; ` +
      `the scan at point ${JSON.stringify(point)} was handed with no section read from the page; ` +
      'repair: read the active section text beside the scan and pass it as "observedSection".',
    )
  }
  const observedSection = record.observedSection
  const declared = record.baseline ?? PRODUCT_A11Y_BASELINE.points[point]
  if (!Array.isArray(declared)) {
    throw new Error(
      `fairtrade targets: missing accessibility baseline for field "baseline" at path a11y.gate.baseline; ` +
      'repair: pass the declared per-point baseline entries for "baseline".',
    )
  }
  const baseline = declared.map((entry) => validateProductAxeBaselineEntry(entry, point))
  if (!Array.isArray(record.measured) || record.measured.some((entry) => !entry || typeof entry !== 'object')) {
    throw new Error(
      `fairtrade targets: missing scoped measurement for field "measured" at path a11y.gate.measured; ` +
      'repair: pass the scoped product-view violations observed at this point for "measured".',
    )
  }
  const measured = /** @type {Record<string, unknown>[]} */ (record.measured)
  const artifactPath = /** @type {string} */ (record.artifactPath)
  const baselineById = new Map(baseline.map((entry) => [entry.id, entry]))
  for (const entry of measured) {
    valuesContract.assertExactFields(entry, ['id', 'impact', 'nodeCount'], 'fairtrade targets', 'a11y.gate.measured')
    const observed = `id ${JSON.stringify(entry.id)} with impact ${JSON.stringify(entry.impact)} over ${JSON.stringify(entry.nodeCount)} nodes`
    const declaredText = `baseline ${JSON.stringify(baseline.map(({ id, impact, nodes }) => ({ id, impact, nodes })))}`
    const known = baselineById.get(/** @type {string} */ (entry.id))
    if (!known) {
      throw new Error(
        `fairtrade targets: accessibility gate new-violation for field "id" at path a11y.gate.measured; ` +
        `observed ${observed} at point ${JSON.stringify(point)} but the declared ${declaredText} names no such id; ` +
        `full result is recorded at ${JSON.stringify(artifactPath)}; ` +
        'repair: fix the new product-view violation, or re-measure both themes on the built dist/ and re-declare the baseline.',
      )
    }
    if (/** @type {number} */ (entry.nodeCount) > /** @type {number} */ (known.nodes)) {
      throw new Error(
        `fairtrade targets: accessibility gate increased-nodes for field "nodeCount" at path a11y.gate.measured; ` +
        `observed ${observed} at point ${JSON.stringify(point)} but the declared ${declaredText} allows ${JSON.stringify(known.nodes)} nodes; ` +
        `full result is recorded at ${JSON.stringify(artifactPath)}; ` +
        'repair: fix the spread of the product-view violation, or re-measure both themes on the built dist/ and re-declare the baseline.',
      )
    }
    const seen = PRODUCT_A11Y_IMPACT_RANK[/** @type {string} */ (entry.impact)] ?? 0
    const allowed = PRODUCT_A11Y_IMPACT_RANK[/** @type {string} */ (known.impact)] ?? 0
    if (seen > allowed) {
      throw new Error(
        `fairtrade targets: accessibility gate escalated-impact for field "impact" at path a11y.gate.measured; ` +
        `observed ${observed} at point ${JSON.stringify(point)} but the declared ${declaredText} caps impact at ${JSON.stringify(known.impact)}; ` +
        `full result is recorded at ${JSON.stringify(artifactPath)}; ` +
        'repair: fix the escalated product-view violation, or re-measure both themes on the built dist/ and re-declare the baseline.',
      )
    }
  }
  return Object.freeze({
    policy: PRODUCT_A11Y_POLICY,
    point,
    observedSection,
    result: 'pass',
    measured: Object.freeze(measured.length),
    baseline: Object.freeze(baseline.length),
  })
}

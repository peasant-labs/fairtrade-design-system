// Fairtrade-owned product target metadata for the mounted graph surface.
//
// Plain data plus pure functions only. This module names the single built
// product route per theme row, the persistent chrome and representative body
// selectors, the section navigation model, the one named section action, the
// normalized theme rows, and the served-build provenance source contract.
// Nothing here starts a service, reads host state, or touches host globals,
// so every export stays inspectable without a run.

import { importFairtestSource } from '../fairtest-source.mjs'

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
  // The active view inside the view container. The container also holds the
  // permanently mounted hidden changes view, so the container alone can never
  // stand in for the active view: only the children the shell is not hiding
  // carry the section the row is proving. One selector, summed over every
  // active child, so a section rendering more than one root is measured whole.
  activeView: '.iu-view > :not([hidden])',
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
 * @returns {object} the frozen setup descriptor for the row
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
 * Validate a theme observation and reject contradictions. Both names must
 * be known theme names and the rendered name must equal the expected one;
 * a missing record, an unknown name, or an expected/observed mismatch
 * fails here, before any capture or evidence work.
 * @param {unknown} observation candidate theme observation
 * @returns {object} the frozen validated theme observation
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
 * Observe the rendered theme for a row. The raw attribute value is read
 * from the mounted tree after mount and before any interaction, then
 * normalized through the shared rendered-theme rule (absent or empty is
 * dark, the light value is light) and persisted with the expected theme,
 * the source note, and the read time. Contradictions fail before the
 * record is built.
 * @param {object} [input] observation inputs
 * @param {string} input.expected theme the row was asked to render
 * @param {unknown} input.renderedAttribute raw rendered attribute value, absent as nullish
 * @param {string} input.source caller-owned note naming where the read came from
 * @param {number} input.observedAtMs read time in whole milliseconds
 * @returns {object} the frozen validated theme observation
 */
export function observeProductTheme(input = {}) {
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
 * @type {object}
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
 * initial section must be the analytics section, and a completed named
 * action must come from the app-owned action registry with the active
 * section on the action target. Component-shaped and cross-kind records
 * fail through the shared validator. The returned record is frozen.
 * @param {object} [input] proof inputs
 * @param {string} input.rowTheme dark or light row theme
 * @param {object} input.identity product-branch identity
 * @param {object} input.chrome separately observed persistent chrome
 * @param {object} input.body separately observed representative body
 * @param {object} input.route separately observed route
 * @param {object} input.activeSection separately observed active section
 * @param {object} input.view separately observed mounted view
 * @param {object} input.themeObservation validated theme observation
 * @param {string} input.initialSection section rendered before any action
 * @param {string} input.activeSectionId section id active when the proof completes
 * @param {object} [input.action] optional completed named action result
 * @returns {object} the frozen validated product resolution
 */
export function buildProductProof(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
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
  const parts = {}
  for (const part of resolutionContract.PRODUCT_ONLY_FIELDS) {
    parts[part] = resolutionContract.validateObservedPart(record[part], 'fairtrade targets', `resolution.${part}`)
  }
  if (record.initialSection !== PRODUCT_INITIAL_SECTION) {
    throw new Error(
      `fairtrade targets: unexpected initial section ${JSON.stringify(record.initialSection)} for field "initialSection" at path proof.initialSection; ` +
      `repair: start the proof from ${JSON.stringify(PRODUCT_INITIAL_SECTION)} for "initialSection".`,
    )
  }
  if (!PRODUCT_SECTIONS.includes(/** @type {string} */ (record.activeSectionId))) {
    throw new Error(
      `fairtrade targets: unknown active section ${JSON.stringify(record.activeSectionId)} for field "activeSectionId" at path proof.activeSectionId; ` +
      `repair: use one of ${[...PRODUCT_SECTIONS].join(', ')} for "activeSectionId".`,
    )
  }
  let action = null
  if (Object.hasOwn(input, 'action')) {
    const candidate = /** @type {Record<string, unknown>} */ (record.action)
    const registered = getProductAction(candidate?.name)
    action = resolutionContract.validateNamedResult(record.action, 'fairtrade targets', 'resolution.action')
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
  const candidate = { kind: 'product', identity, ...parts, theme }
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
 * initial mount (section analytics) and after the named map interaction
 * completes (section map).
 * @type {string[]}
 */
export const PRODUCT_A11Y_POINTS = Object.freeze(['initial', 'after-action'])

/**
 * Exact field set of the gate receipt assertProductAxeBaselineDelta returns
 * and the record.json accessibility block carries under gate.<slot>. Declared
 * once here, by the policy owner, so the reader that consumes the receipt
 * never hardcodes a second copy of the record shape: a receipt that grows or
 * loses a field turns the browser-free gate case red instead of silently
 * changing the durable contract.
 * @type {string[]}
 */
export const PRODUCT_A11Y_GATE_RECEIPT_FIELDS = Object.freeze(['policy', 'point', 'result', 'measured', 'baseline'])

/**
 * Record gate slots mapped to the app-owned observation point each slot
 * carries, in record order. A verifier reading gate.before is reading the
 * initial measurement and gate.after the after-action measurement; the reader
 * refuses a receipt that claims a different point for its slot.
 * @type {object}
 */
export const PRODUCT_A11Y_GATE_POINT_SLOTS = Object.freeze({
  before: PRODUCT_A11Y_POINTS[0],
  after: PRODUCT_A11Y_POINTS[1],
})

/**
 * Section rendered at each scoped observation point.
 * @type {object}
 */
export const PRODUCT_A11Y_POINT_SECTIONS = Object.freeze({
  initial: PRODUCT_INITIAL_SECTION,
  'after-action': PRODUCT_ACTION_TO_SECTION,
})

/**
 * Axe impact severity rank, least to most severe. A measured impact above
 * the declared rank for the same violation id fails the row closed.
 * @type {object}
 */
export const PRODUCT_A11Y_IMPACT_RANK = Object.freeze({
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
})

/**
 * Declared product-view violation baseline, measured on the real built
 * dist/ in both row themes (dark and light reported identical sets):
 * the analytics point scans clean, the map point carries the one
 * pre-existing critical aria-required-children violation over three
 * nodes inside the product view. Improvement (a violation that
 * disappears) never fails; anything beyond this baseline does.
 * @type {object}
 */
export const PRODUCT_A11Y_BASELINE = Object.freeze({
  policy: PRODUCT_A11Y_POLICY,
  scopeRoot: PRODUCT_A11Y_SCOPE_ROOT,
  points: Object.freeze({
    initial: Object.freeze([]),
    'after-action': Object.freeze([
      Object.freeze({
        id: 'aria-required-children',
        impact: 'critical',
        nodes: 3,
        themes: Object.freeze(['dark', 'light']),
      }),
    ]),
  }),
})

/**
 * Validate one baseline entry shape: exact fields, a ranked impact, a
 * non-negative integer node count, and a non-empty theme inventory drawn
 * from the closed row vocabulary.
 * @param {unknown} entry candidate baseline entry
 * @param {string} point observation point the entry belongs to
 * @returns {object} the validated entry
 */
export function validateProductAxeBaselineEntry(entry, point) {
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
  return candidate
}

/**
 * Gate a scoped product-view scan against the declared baseline,
 * failing closed when the measurement exceeds it. A violation id absent
 * from the baseline (a new violation), a node count above the declared
 * count, or an impact more severe than declared each fail with a
 * diagnostic naming the rule, the observed triple, the declared
 * baseline, the artifact path, and the repair. A baseline violation
 * that disappears (improvement) never fails.
 * @param {object} [input] gate inputs
 * @param {string} input.point observation point the measurement belongs to
 * @param {{ id: string, impact: string, nodeCount: number }[]} input.measured scoped violations just observed
 * @param {object[]} [input.baseline] declared entries, defaults to the app-owned baseline for the point
 * @param {string} input.artifactPath row axe.json path the full result was written to
 * @returns {object} the frozen gate receipt on pass
 */
export function assertProductAxeBaselineDelta(input = {}) {
  const wantsBaseline = !!input && typeof input === 'object' && Object.hasOwn(input, 'baseline')
  valuesContract.assertExactFields(
    input,
    wantsBaseline ? ['point', 'measured', 'artifactPath', 'baseline'] : ['point', 'measured', 'artifactPath'],
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
    result: 'pass',
    measured: Object.freeze(measured.length),
    baseline: Object.freeze(baseline.length),
  })
}

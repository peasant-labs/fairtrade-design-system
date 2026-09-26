// Fairtrade-owned component target metadata for the mounted Storybook story.
//
// Plain data plus pure functions only. This module names the single direct
// Storybook iframe target, the real mount signals a mounted story must show,
// the component selector bundle, the one named component action, the normalized
// theme rows, the measured component floors, and the served-build provenance
// source contract. Nothing here starts a service, reads host state, or touches
// host globals, so every export stays inspectable without a run.
//
// The component proof record is the shared component branch of the host
// resolution union: kind, identity, a mounted root, the normalized theme
// observation, and an optional completed interaction. A component record can
// never claim the product-only chrome, body, route, active section, or view
// fields: the shared component resolver refuses them, and this module builds
// only the component branch, so no product-shaped field can be smuggled in
// through the app-owned builder.

import { importFairtestSource } from '../fairtest-source.mjs'
import { assertProductThemeObservation } from './fairtrade-targets.mjs'

const kindsContract = await importFairtestSource('src/host-contract/kinds.mjs')
const targetsContract = await importFairtestSource('src/host-contract/targets.mjs')
const resolutionContract = await importFairtestSource('src/host-contract/resolution.mjs')
const valuesContract = await importFairtestSource('src/core/values.mjs')

/**
 * Identifier of the single component target covered by this module.
 * @type {string}
 */
export const COMPONENT_TARGET_ID = 'fairtrade-sgd-story'

/**
 * The one Storybook story the component target mounts directly.
 * @type {string}
 */
export const COMPONENT_STORY_ID = 'components-sessiongroupdisclosure--playground'

/**
 * The single named action the component target offers: one press on the
 * disclosure control reveals the rows and flips the aria wiring.
 * @type {string}
 */
export const COMPONENT_ACTION_NAME = 'expand-disclosure'

/**
 * Component selector bundle. Keys name the observed part, values are the
 * selectors the row-scoped producer queries on the real built story. This
 * bundle is the single declared source of component structure: the producer
 * derives every component selector it touches from these keys and holds no
 * sgd class, root id, or Storybook chrome selector literal of its own.
 * @type {object}
 */
export const COMPONENT_SELECTORS = Object.freeze({
  // The Storybook story root. It exists statically and empty, so attachment
  // alone is never a mount proof; the row requires real children.
  root: '#storybook-root',
  trigger: '.sgd-trigger',
  toggle: '[data-testid="session-group-disclosure-toggle"]',
  label: '[data-testid="session-group-disclosure-label"]',
  count: '.sgd-count',
  rows: '#sgd-story-rows',
  rowItem: '#sgd-story-rows li',
  // The two Storybook load-error signals. The load-error path writes its text
  // into the story root, so a non-empty root alone is not proof either: the
  // error display must stay hidden and the error stack must stay empty.
  errorDisplay: '.sb-errordisplay',
  errorStack: '#error-stack',
})

/**
 * Storybook's ready-state body classes. The story styles only under
 * `.sb-show-main.sb-main-centered`, so this pair is the rendered marker the
 * static and error states do not carry. Declared here, never repeated in a
 * producer.
 * @type {string[]}
 */
export const COMPONENT_MOUNT_BODY_CLASSES = Object.freeze(['sb-main-centered', 'sb-show-main'])

/**
 * The disclosure control's text while folded. The component and the existing
 * component journey share this one declared string.
 * @type {string}
 */
export const COMPONENT_COLLAPSED_LABEL = 'orphan sessions 2'

/**
 * The rows the disclosure reveals, in render order. The one action must leave
 * exactly these rows; the row count and the texts are both asserted.
 * @type {string[]}
 */
export const COMPONENT_ROW_TEXTS = Object.freeze([
  'Recover the unreadable parent chain',
  'Audit the orphan ancestry',
])

/**
 * How many rows the action reveals. Derived from the declared texts so the
 * count and the texts can never disagree.
 * @type {number}
 */
export const COMPONENT_ROW_COUNT = COMPONENT_ROW_TEXTS.length

/**
 * Minimum descendant element count inside the mounted story root after the
 * interaction that counts as a non-blank mounted component. Measured expanded
 * on the real built story: 12 descendants (8 collapsed). The floor stays below
 * the measured expanded value and above a static/empty root.
 * @type {number}
 */
export const COMPONENT_MIN_ROOT_DESCENDANTS = 10

/**
 * Minimum trimmed text length inside the mounted story root after the
 * interaction that counts as non-blank component content. Measured expanded:
 * 81 characters (21 collapsed). The floor sits between the two, so the
 * collapsed state cannot satisfy the post-interaction floor.
 * @type {number}
 */
export const COMPONENT_MIN_ROOT_TEXT_LENGTH = 60

/**
 * Minimum trimmed character count of the mounted-root ARIA snapshot after the
 * interaction. Measured expanded: 142 characters (33 collapsed). This is a
 * component MEASURED floor: the product's 50-character shell floor does not
 * transfer to a mounted component and is deliberately not reused.
 * @type {number}
 */
export const COMPONENT_MIN_ARIA_CHARS = 100

/**
 * Minimum byte count of the mounted-root screenshot after the interaction.
 * Measured expanded element capture: 9688 bytes (collapsed 3233). The product's
 * 8000-byte full-page floor does not transfer to an element capture of a
 * mounted component, so this is a component MEASURED floor. The primary
 * non-blank proof stays the root box, descendants, and text length.
 * @type {number}
 */
export const COMPONENT_MIN_SCREENSHOT_BYTES = 6000

/**
 * Mount wait budget per selector in milliseconds.
 * @type {number}
 */
export const COMPONENT_MOUNT_TIMEOUT_MS = 15000

/**
 * Post-click settle budget for the disclosure expansion in milliseconds.
 * @type {number}
 */
export const COMPONENT_ACTION_TIMEOUT_MS = 10000

/**
 * Served-build provenance source contract. Declares where the row-scoped
 * producer reads commit, dirtiness, asset digests, viewport, target identity,
 * theme observations, and the story id from; the producer fills the values per
 * run. Mirrors the product provenance source, plus `storyId`.
 * @type {object}
 */
export const COMPONENT_PROVENANCE_SOURCE = Object.freeze({
  source: 'built-storybook',
  root: 'storybook-static',
  entries: Object.freeze(['iframe.html', 'assets']),
  fields: Object.freeze(['source', 'root', 'commit', 'dirty', 'assetDigests', 'servedFrom', 'commitCorrespondence', 'viewport', 'targetIdentity', 'themeObservations', 'storyId', 'servedUrl', 'producedAtMs']),
})

/**
 * Name of the app-owned component accessibility policy. The component surface
 * is measured clean in both themes, so the row gates on a plain
 * serious-violations check with no baseline and no delta machinery.
 * @type {string}
 */
export const COMPONENT_A11Y_POLICY = 'component-serious-violations-gate'

/**
 * The single observation point carrying a component gate receipt.
 * @type {string[]}
 */
export const COMPONENT_A11Y_POINTS = Object.freeze(['after-interaction'])

/**
 * Exact field set of a component gate receipt, so the reader that consumes it
 * never hardcodes a second copy of the record shape. `observedTheme` and
 * `ariaExpanded` are the receipt's observed ties to the moment the scan was
 * taken: the theme the page rendered and the expanded state the click left.
 * @type {string[]}
 */
export const COMPONENT_A11Y_GATE_RECEIPT_FIELDS = Object.freeze(['policy', 'point', 'observedTheme', 'ariaExpanded', 'result', 'measured'])

/**
 * Named fixtures the component target serves.
 * @type {string[]}
 */
const COMPONENT_FIXTURES = Object.freeze(['component-theme-rows', 'component-disclosure-expand'])

/**
 * Named actions the component target offers.
 * @type {string[]}
 */
const COMPONENT_ACTIONS = Object.freeze([COMPONENT_ACTION_NAME])

const COMPONENT_ACTION = Object.freeze({
  name: COMPONENT_ACTION_NAME,
  storyId: COMPONENT_STORY_ID,
})

const COMPONENT_TARGET_RECORD = Object.freeze({
  id: COMPONENT_TARGET_ID,
  kind: 'component',
  storyId: COMPONENT_STORY_ID,
  selectors: COMPONENT_SELECTORS,
  fixtures: COMPONENT_FIXTURES,
  actions: COMPONENT_ACTIONS,
  action: COMPONENT_ACTION,
  provenanceSource: COMPONENT_PROVENANCE_SOURCE,
})

/**
 * Target registry keyed by target id. This module declares exactly one
 * component target.
 * @type {object}
 */
export const COMPONENT_TARGET_REGISTRY = Object.freeze({
  [COMPONENT_TARGET_ID]: COMPONENT_TARGET_RECORD,
})

/**
 * Return the frozen target record for a registered component id.
 * @param {unknown} id target id requested by the caller
 * @returns {object} the frozen component target record
 */
export function selectComponentTarget(id) {
  if (typeof id !== 'string' || !Object.hasOwn(COMPONENT_TARGET_REGISTRY, id)) {
    throw new Error(
      `fairtrade component targets: unknown target ${JSON.stringify(id)} for field "id" at path target.id; ` +
      `repair: use one of ${Object.keys(COMPONENT_TARGET_REGISTRY).join(', ')} for "id".`,
    )
  }
  return COMPONENT_TARGET_REGISTRY[id]
}

/**
 * Return the frozen named action for a registered action name.
 * @param {unknown} name action name requested by the caller
 * @returns {object} the frozen component action record
 */
export function getComponentAction(name) {
  if (name !== COMPONENT_ACTION_NAME) {
    throw new Error(
      `fairtrade component targets: unknown action ${JSON.stringify(name)} for field "action" at path target.action; ` +
      `repair: use one of ${COMPONENT_ACTION_NAME} for "action".`,
    )
  }
  return COMPONENT_ACTION
}

/**
 * Build the direct iframe route for a component theme row. The dark row carries
 * no globals parameter and the light row carries the light global, exactly the
 * shape the existing component journey sends. The shared journey story-URL
 * shape is pinned against this function by the component target test, so the
 * two can never drift.
 * @param {unknown} story story id
 * @param {unknown} theme dark or light row theme
 * @returns {string} the direct iframe path for the row
 */
export function componentStoryUrl(story, theme) {
  if (typeof story !== 'string' || story.length === 0) {
    throw new Error(
      `fairtrade component targets: invalid story ${JSON.stringify(story)} for field "story" at path story.id; ` +
      'repair: pass the named component story id for "story".',
    )
  }
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error(
      `fairtrade component targets: unknown row theme ${JSON.stringify(theme)} for field "theme" at path row.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  const globals = theme === 'light' ? '&globals=theme:light' : ''
  return `/iframe.html?id=${story}&viewMode=story${globals}`
}

/**
 * Return the normalized row record for a theme. The single theme descriptor is
 * componentThemeSetup; this row record only adds the story id, so the two can
 * never describe different URLs or expected attributes.
 * @param {unknown} theme dark or light row theme
 * @returns {object} the frozen theme row record
 */
export function componentThemeRow(theme) {
  return Object.freeze({ ...componentThemeSetup(theme), storyId: COMPONENT_STORY_ID })
}

/**
 * Row-scoped theme setup descriptor. Theme setup owns the URL/global and the
 * expected raw attribute; reduced motion is inherited from the one-project
 * runner config and is deliberately not re-declared here.
 * @param {unknown} theme dark or light row theme
 * @returns {object} the frozen setup descriptor for the row
 */
export function componentThemeSetup(theme) {
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error(
      `fairtrade component targets: unknown row theme ${JSON.stringify(theme)} for field "theme" at path setup.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  return Object.freeze({
    theme,
    expectedAttribute: theme === 'light' ? 'light' : '',
    url: componentStoryUrl(COMPONENT_STORY_ID, theme),
  })
}

/**
 * Reject project-name-only theme inference. The row theme always comes from
 * the explicit row key, never from a runner project name.
 * @param {unknown} projectName candidate runner project name
 * @returns {never} always throws
 */
export function componentThemeFromProjectName(projectName) {
  throw new Error(
    'fairtrade component targets: project-name theme inference is forbidden for field "project" at path theme.project; ' +
    `got ${JSON.stringify(projectName)}; ` +
    'repair: bind the theme from the explicit row key (dark or light) instead of deriving it from the project name.',
  )
}

/**
 * Fail-closed mount-signal guard. A statically present but empty root is not a
 * mount; a Storybook load-error page writes its message into the root, so a
 * non-empty root is not a mount either. Both are refused by name.
 * @param {object} [input] raw mount observations read from the iframe
 * @param {number} input.rootChildCount story root childElementCount
 * @param {string} input.bodyClass current body className
 * @param {string} input.errorDisplay computed display of the error display
 * @param {string} input.errorStackText trimmed #error-stack text
 * @returns {object} the frozen mount observation
 */
export function assertComponentMounted(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(
      'fairtrade component targets: missing mount observation for field "mount" at path mount; ' +
      'repair: read the story root child count, the body class, and the two error signals before proving a mount.',
    )
  }
  valuesContract.assertExactFields(input, ['rootChildCount', 'bodyClass', 'errorDisplay', 'errorStackText'], 'fairtrade component targets', 'mount')
  const { rootChildCount, bodyClass, errorDisplay, errorStackText } = /** @type {Record<string, unknown>} */ (input)
  if (!Number.isInteger(rootChildCount) || /** @type {number} */ (rootChildCount) < 1) {
    throw new Error(
      `fairtrade component targets: empty mounted root for field "rootChildCount" at path mount.rootChildCount; ` +
      `selector ${JSON.stringify(COMPONENT_SELECTORS.root)} holds ${JSON.stringify(rootChildCount)} children; ` +
      'repair: wait for the story root to render real children before proving a mount, never accept a statically empty root.',
    )
  }
  for (const bodyToken of COMPONENT_MOUNT_BODY_CLASSES) {
    if (typeof bodyClass !== 'string' || !bodyClass.split(/\s+/).includes(bodyToken)) {
      throw new Error(
        `fairtrade component targets: story not in its ready state for field "bodyClass" at path mount.bodyClass; ` +
        `body class ${JSON.stringify(bodyClass)} is missing ${JSON.stringify(bodyToken)}; ` +
        'repair: wait for the ready-state body classes before proving a mount, never accept the Storybook load shell.',
      )
    }
  }
  if (errorDisplay !== 'none') {
    throw new Error(
      `fairtrade component targets: story error display is visible for field "errorDisplay" at path mount.errorDisplay; ` +
      `computed display is ${JSON.stringify(errorDisplay)}; ` +
      `repair: keep ${JSON.stringify(COMPONENT_SELECTORS.errorDisplay)} hidden so the story did not fall back to a load error.`,
    )
  }
  if (typeof errorStackText !== 'string' || errorStackText.trim().length > 0) {
    throw new Error(
      `fairtrade component targets: story load error is present for field "errorStackText" at path mount.errorStackText; ` +
      `selector ${JSON.stringify(COMPONENT_SELECTORS.errorStack)} holds ${JSON.stringify(errorStackText)}; ` +
      'repair: fix the story load error instead of recording a mounted root the error page wrote into.',
    )
  }
  return Object.freeze({ mounted: true, rootChildCount, bodyClass, errorDisplay, errorStackText })
}

/**
 * Build the raw target declaration input for the component target. Capability
 * contents stay caller-owned: pass the shared component inventory so the
 * closed vocabulary is never duplicated here.
 * @param {object} [input] declaration inputs
 * @param {number} input.createdAtMs creation time in whole milliseconds
 * @param {string[]} input.capabilities declared capability inventory
 * @param {string[]} [input.fixtures] named fixtures served
 * @param {string[]} [input.actions] named actions offered
 * @returns {object} the frozen declaration input
 */
export function componentDeclarationInput({ createdAtMs, capabilities, fixtures = COMPONENT_FIXTURES, actions = COMPONENT_ACTIONS } = {}) {
  if (!Number.isInteger(createdAtMs) || createdAtMs < 0 || createdAtMs > 9007199254740991) {
    throw new Error(
      `fairtrade component targets: invalid value ${JSON.stringify(createdAtMs)} for field "createdAtMs" at path target.identity.createdAtMs; ` +
      'repair: use an integer from 0 to 9007199254740991 for "createdAtMs".',
    )
  }
  if (!Array.isArray(capabilities) || capabilities.length === 0 || capabilities.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(
      'fairtrade component targets: invalid capabilities for field "capabilities" at path target.capabilities; ' +
      'repair: provide the shared component capability inventory for "capabilities".',
    )
  }
  return Object.freeze({
    kind: 'component',
    identity: Object.freeze({ kind: 'component', id: COMPONENT_TARGET_ID, createdAtMs }),
    capabilities: Object.freeze([...capabilities]),
    fixtures: Object.freeze([...fixtures]),
    actions: Object.freeze([...actions]),
  })
}

/**
 * Prove the component target against the shared contract through the sole
 * source route: kind membership in the closed vocabulary, capability inventory
 * validation on the component branch, and declaration validation.
 * @param {object} [input] validation inputs
 * @param {number} input.createdAtMs creation time in whole milliseconds
 * @returns {Promise<object>} the frozen contract receipt
 */
export async function validateComponentTargetContract({ createdAtMs } = {}) {
  if (!kindsContract.HOST_KINDS.includes('component')) {
    throw new Error(
      'fairtrade component targets: kind "component" is outside the shared vocabulary for field "kind" at path target.kind; ' +
      `repair: use one of ${[...kindsContract.HOST_KINDS].join(', ')} for "kind".`,
    )
  }
  const capabilities = targetsContract.validateCapabilityList(
    [...targetsContract.COMPONENT_CAPABILITIES],
    'component',
    'fairtrade component targets',
    'target.capabilities',
  )
  const declaration = targetsContract.createTargetDeclaration(
    componentDeclarationInput({ createdAtMs, capabilities: [...capabilities] }),
  )
  return Object.freeze({ kind: 'component', capabilities, declaration })
}

/**
 * Expected field set of the app-owned component proof record, so fixtures can
 * be checked for exact membership with no silent extras. The base fields cover
 * a proof without a named interaction; the extended set adds the completed
 * interaction result. The product-only parts are deliberately absent.
 * @type {object}
 */
export const COMPONENT_PROOF_RECORD_SCHEMA = Object.freeze({
  kind: 'component',
  fields: Object.freeze(['kind', 'identity', 'root', 'theme']),
  fieldsWithInteraction: Object.freeze(['kind', 'identity', 'root', 'theme', 'interaction']),
  rootFields: Object.freeze(['mounted', 'observedAtMs']),
  themeFields: Object.freeze(['expected', 'observed', 'source', 'observedAtMs']),
  interactionFields: Object.freeze(['name', 'completed', 'observedAtMs']),
  identityFields: Object.freeze(['kind', 'id', 'createdAtMs']),
})

/**
 * Assemble the app-owned component proof record from separately observed parts
 * and validate it through the shared component resolver. The row theme must
 * equal the observed theme; the root must be separately observed as mounted
 * (a blanket mounted boolean with no observation is refused); a completed named
 * interaction must come from the app-owned action registry. A product-shaped
 * record fails through the shared validator. The returned record is frozen.
 * @param {object} [input] proof inputs
 * @param {string} input.rowTheme dark or light row theme
 * @param {object} input.identity component-branch identity
 * @param {object} input.root separately observed mounted root
 * @param {object} input.themeObservation validated theme observation
 * @param {object} [input.interaction] optional completed named interaction result
 * @returns {object} the frozen validated component resolution
 */
export function buildComponentProof(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(
      'fairtrade component targets: missing component proof input for field "proof" at path proof; ' +
      'repair: observe the mounted root and the theme before building the proof.',
    )
  }
  if (Object.hasOwn(input, 'mounted')) {
    throw new Error(
      'fairtrade component targets: blanket mounted flag is not an observation for field "mounted" at path proof.mounted; ' +
      'repair: observe the root separately instead of trusting a mounted boolean.',
    )
  }
  const wantInputFields = Object.hasOwn(input, 'interaction')
    ? ['rowTheme', 'identity', 'root', 'themeObservation', 'interaction']
    : ['rowTheme', 'identity', 'root', 'themeObservation']
  valuesContract.assertExactFields(input, wantInputFields, 'fairtrade component targets', 'proof')
  const record = /** @type {Record<string, unknown>} */ (input)
  if (record.rowTheme !== 'dark' && record.rowTheme !== 'light') {
    throw new Error(
      `fairtrade component targets: unknown row theme ${JSON.stringify(record.rowTheme)} for field "rowTheme" at path proof.rowTheme; ` +
      'repair: use one of dark, light for "rowTheme".',
    )
  }
  const identity = targetsContract.validateTargetIdentity(record.identity, 'component', 'fairtrade component targets')
  const theme = assertProductThemeObservation(record.themeObservation)
  if (record.rowTheme !== theme.expected) {
    throw new Error(
      'fairtrade component targets: row setup does not match the theme observation for field "rowTheme" at path proof.rowTheme; ' +
      `expected ${JSON.stringify(theme.expected)} but the row declares ${JSON.stringify(record.rowTheme)}; ` +
      'repair: serve the row theme before building the proof.',
    )
  }
  const root = resolutionContract.validateMountedRoot(record.root, 'fairtrade component targets', 'resolution.root')
  const candidate = { kind: 'component', identity, root, theme }
  if (Object.hasOwn(input, 'interaction')) {
    const registered = getComponentAction(/** @type {Record<string, unknown>} */ (record.interaction)?.name)
    candidate.interaction = resolutionContract.validateNamedResult(record.interaction, 'fairtrade component targets', 'resolution.interaction')
    if (candidate.interaction.name !== registered.name) {
      throw new Error(
        `fairtrade component targets: interaction ${JSON.stringify(candidate.interaction.name)} is not the registered ${JSON.stringify(registered.name)} for field "name" at path resolution.interaction.name; ` +
        'repair: complete the registered component interaction before building the proof.',
      )
    }
  }
  return resolutionContract.validateComponentResolution(candidate, 'fairtrade component targets')
}

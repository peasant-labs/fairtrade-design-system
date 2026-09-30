// @ts-check

// Fairtrade-owned component target metadata for the mounted Storybook story.
//
// Plain data plus pure functions only. This module names the direct Storybook
// iframe target, the story registry (one entry per mounted story row: its row
// key, story id, layout, the observations it must show before and after its
// optional named action, its computed-style evidence, and its measured
// floors), the real mount signals a mounted story must show, the component
// selector bundle, the named component actions, the normalized theme rows, and
// the served-build provenance source contract. Nothing here starts a service, reads host state, or touches
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
import { fairtestRelative } from './fairtest-paths.mjs'

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
 * @type {readonly string[]}
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
 * @type {readonly string[]}
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
 */
export const COMPONENT_PROVENANCE_SOURCE = Object.freeze({
  source: 'built-storybook',
  root: fairtestRelative('storybookRoot'),
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
 * The observation points a component gate receipt may carry: after the named
 * interaction for a story row with an action, after the mount for a story row
 * without one.
 * @type {readonly string[]}
 */
export const COMPONENT_A11Y_POINTS = Object.freeze(['after-interaction', 'after-mount'])

/**
 * Exact field set of a component gate receipt, so the reader that consumes it
 * never hardcodes a second copy of the record shape. `observedTheme` and
 * `ariaExpanded` are the receipt's observed ties to the moment the scan was
 * taken: the theme the page rendered and the expanded state the click left.
 * @type {readonly string[]}
 */
export const COMPONENT_A11Y_GATE_RECEIPT_FIELDS = Object.freeze(['policy', 'point', 'observedTheme', 'ariaExpanded', 'result', 'measured'])

/**
 * Storybook ready-state body classes per story layout. The shared show-main
 * marker plus the layout's own main class, which the static and error states
 * do not carry.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const COMPONENT_LAYOUT_BODY_CLASSES = Object.freeze({
  centered: COMPONENT_MOUNT_BODY_CLASSES,
  fullscreen: Object.freeze(['sb-main-fullscreen', 'sb-show-main']),
})

/**
 * Storybook render lifecycle signal the row waits on before it observes a
 * story: the preview channel's render-phase event and the phase that follows
 * a finished play function. A story whose play function throws reports one of
 * the error phases on the way, which the row refuses.
 */
export const COMPONENT_RENDER_PHASES = Object.freeze({
  channelGlobal: '__STORYBOOK_ADDONS_CHANNEL__',
  event: 'storyRenderPhaseChanged',
  recorderGlobal: '__FAIRTEST_RENDER_PHASES__',
  settled: 'completed',
  errors: Object.freeze(['errored', 'aborted']),
})

/**
 * One observable fact about a mounted story, read from the element a selector
 * or an accessible role and exact name finds inside the story root. Exactly one
 * of the value fields is declared per fact.
 * @typedef {object} ComponentExpectation
 * @property {string} name what the fact is, used in the record and diagnostics
 * @property {string} [selector] element selector inside the story root
 * @property {{ role: string, name: string, exact?: boolean }} [role] element found by role and accessible name
 * @property {string} [matches] selector the found element must also match
 * @property {string} [attribute] attribute read on the first match, with `value`
 * @property {string | null} [value] expected attribute value; null means the attribute is absent
 * @property {string} [text] expected trimmed text of the first match
 * @property {readonly string[]} [texts] expected trimmed texts of every match, in order
 * @property {number} [count] expected match count
 * @property {boolean} [focused] whether the first match must hold focus
 */

/**
 * One computed-style probe a story row records and asserts. `equals` compares
 * the computed value exactly, `includes` requires a substring, `token` requires
 * the value to resolve to the named design token, and `nonEmpty` requires any
 * resolved value.
 * @typedef {object} ComponentStyleProbe
 * @property {string} name record field the value is written under
 * @property {string} selector element selector inside the story root
 * @property {string} property computed-style property name
 * @property {string} [equals]
 * @property {string} [includes]
 * @property {string} [token]
 * @property {boolean} [nonEmpty]
 */

/**
 * One mounted story row: the row key prefix, the proof identity, the story and
 * its layout, the facts it must show before its optional named action and
 * after it, the fact the accessibility receipt ties to the moment of the scan,
 * the computed-style evidence, and the measured floors. The row is data: the
 * producer reads every field and holds no story knowledge of its own.
 * @typedef {object} ComponentStory
 * @property {string} key registry key
 * @property {string} rowPrefix row-key prefix; rows are `<rowPrefix>-<theme>`
 * @property {string} targetId proof identity id
 * @property {string} storyId built Storybook story id
 * @property {string} layout Storybook layout, a COMPONENT_LAYOUT_BODY_CLASSES key
 * @property {readonly ComponentExpectation[]} before facts that hold before the action
 * @property {{ name: string, kind: 'click', target: ComponentExpectation } | { name: string, kind: 'key', target: ComponentExpectation, key: string } | null} action the named action, or null
 * @property {readonly ComponentExpectation[]} after facts that hold after the action, in order
 * @property {{ field: string, expectation: ComponentExpectation }} gateTie the receipt field and the fact it reads at scan time
 * @property {readonly ComponentStyleProbe[]} computed computed-style evidence
 * @property {{ descendants: number, textLength: number, ariaChars: number, screenshotBytes: number }} floors measured non-blank floors after the action
 */

/**
 * The disclosure story: collapsed with its count label, one press reveals the
 * rows and flips the aria wiring. Its row keys stay `component-dark` and
 * `component-light`, and its receipt keeps the `ariaExpanded` tie.
 * @type {ComponentStory}
 */
const DISCLOSURE_STORY = Object.freeze({
  key: 'session-group-disclosure',
  rowPrefix: 'component',
  targetId: COMPONENT_TARGET_ID,
  storyId: COMPONENT_STORY_ID,
  layout: 'centered',
  before: Object.freeze([
    Object.freeze({ name: 'toggle-collapsed', selector: COMPONENT_SELECTORS.toggle, attribute: 'aria-expanded', value: 'false' }),
    Object.freeze({ name: 'rows-absent', selector: COMPONENT_SELECTORS.rows, count: 0 }),
    Object.freeze({ name: 'collapsed-label', selector: COMPONENT_SELECTORS.label, text: COMPONENT_COLLAPSED_LABEL }),
  ]),
  action: Object.freeze({ name: COMPONENT_ACTION_NAME, kind: 'click', target: Object.freeze({ name: 'toggle', selector: COMPONENT_SELECTORS.toggle, count: 1 }) }),
  after: Object.freeze([
    Object.freeze({ name: 'toggle-expanded', selector: COMPONENT_SELECTORS.toggle, attribute: 'aria-expanded', value: 'true' }),
    Object.freeze({ name: 'rows-present', selector: COMPONENT_SELECTORS.rows, count: 1 }),
    Object.freeze({ name: 'row-texts', selector: COMPONENT_SELECTORS.rowItem, texts: COMPONENT_ROW_TEXTS }),
  ]),
  gateTie: Object.freeze({ field: 'ariaExpanded', expectation: Object.freeze({ name: 'toggle-expanded', selector: COMPONENT_SELECTORS.toggle, attribute: 'aria-expanded', value: 'true' }) }),
  computed: Object.freeze([
    Object.freeze({ name: 'fontFamily', selector: COMPONENT_SELECTORS.trigger, property: 'fontFamily', nonEmpty: true }),
    Object.freeze({ name: 'fontSize', selector: COMPONENT_SELECTORS.trigger, property: 'fontSize', nonEmpty: true }),
    Object.freeze({ name: 'borderRadius', selector: COMPONENT_SELECTORS.trigger, property: 'borderRadius', nonEmpty: true }),
    Object.freeze({ name: 'minHeight', selector: COMPONENT_SELECTORS.trigger, property: 'minHeight', nonEmpty: true }),
    // Tabular numbers on counts are a design-system invariant the record carries.
    Object.freeze({ name: 'fontVariantNumeric', selector: COMPONENT_SELECTORS.count, property: 'fontVariantNumeric', includes: 'tabular-nums' }),
  ]),
  floors: Object.freeze({
    descendants: COMPONENT_MIN_ROOT_DESCENDANTS,
    textLength: COMPONENT_MIN_ROOT_TEXT_LENGTH,
    ariaChars: COMPONENT_MIN_ARIA_CHARS,
    screenshotBytes: COMPONENT_MIN_SCREENSHOT_BYTES,
  }),
})

const TRANSCRIPT_SEARCH_TRIGGER = Object.freeze({ name: 'search-trigger', role: Object.freeze({ role: 'button', name: 'search this transcript ⌘F' }), matches: '.txn-search-trigger', count: 1 })
const TRANSCRIPT_SEARCH_FOCUSED = Object.freeze({ name: 'search-input-focused', selector: '.txn-search-input', focused: true })
const OFFLINE_RETRY_BUSY = Object.freeze({ name: 'retry-busy', selector: '.cx-offline-retry', attribute: 'aria-busy', value: 'true' })
const DIGEST_LIST = 'ul[role="listbox"][aria-label="sessions"]'
const DIGEST_SECOND_SELECTED = Object.freeze({ name: 'second-option-selected', selector: `${DIGEST_LIST} > li[role="option"]:nth-of-type(2)`, attribute: 'aria-selected', value: 'true' })
const STATS_PAIRS = Object.freeze({ name: 'pairs', selector: 'ul.sst[aria-label="your sessions in numbers"] > li.sst-pair', count: 6 })
const PUBLISH_BAR_ACTIONS = Object.freeze({ name: 'bar-actions', selector: '.pub-bar .pub-bar-action', count: 6 })
const PUBLISH_BAR_UPDATE = Object.freeze({ name: 'update-action', role: Object.freeze({ role: 'button', name: 'update' }), matches: '.pub-bar-action', count: 1 })
const ACCESS_NAMED_REMOVE = Object.freeze({ name: 'named-remove', role: Object.freeze({ role: 'button', name: 'remove Acme Platform' }), matches: '.pub-access-remove', count: 1 })
const ACCESS_KEEP = Object.freeze({ name: 'keep-pending-removal', role: Object.freeze({ role: 'button', name: 'keep ML Reading Group' }), matches: '.pub-access-keep', count: 1 })
const SETTING_GROUPS_ONE_OPEN = Object.freeze({ name: 'one-open-group', selector: 'details.srow-group[open]', count: 1 })
const SETTING_GROUPS_BOTH_OPEN = Object.freeze({ name: 'both-groups-open', selector: 'details.srow-group[open]', count: 2 })
const PUBLISH_DIALOG_OFF = Object.freeze({ name: 'publish-off', role: Object.freeze({ role: 'button', name: 'publish to 2 collectives' }), matches: '.pub-primary:disabled', count: 1 })
const PUBLISH_DIALOG_RESCAN_ON = Object.freeze({ name: 'rescan-on', role: Object.freeze({ role: 'button', name: 're-scan' }), matches: '.pub-rescan:enabled', count: 1 })

/**
 * The mounted story rows, in row order. Floors are measured on the real built
 * Storybook after each row's action, in both themes, and sit below the
 * measurement and above a blank root: the host-owned transcript header measured
 * 552 descendants, 1577 characters, a 4225-character ARIA snapshot, and a
 * 219151-byte capture with search open; the offline banner 35, 191, 374, and
 * 23828 while retrying; the digest split 49, 335, 909, and 43029 with the
 * second session selected; the stats strip 20, 85, 209, and 9884.
 * @type {readonly ComponentStory[]}
 */
export const COMPONENT_STORIES = Object.freeze([
  DISCLOSURE_STORY,
  Object.freeze({
    key: 'transcript-header',
    rowPrefix: 'component-transcript-header',
    targetId: 'fairtrade-transcript-header-story',
    storyId: 'in-use-transcript-transcriptviewer--host-owned-header',
    layout: 'fullscreen',
    before: Object.freeze([
      Object.freeze({ name: 'host-publish-action', role: Object.freeze({ role: 'button', name: 'publish' }), count: 1 }),
      Object.freeze({ name: 'no-share-menu', role: Object.freeze({ role: 'button', name: 'share' }), count: 0 }),
      Object.freeze({ name: 'no-more-menu', role: Object.freeze({ role: 'button', name: 'more actions' }), count: 0 }),
      TRANSCRIPT_SEARCH_TRIGGER,
      Object.freeze({ name: 'search-closed', selector: '.txn-search-input', count: 0 }),
    ]),
    action: Object.freeze({ name: 'open-transcript-search', kind: 'click', target: TRANSCRIPT_SEARCH_TRIGGER }),
    after: Object.freeze([
      Object.freeze({ name: 'search-textbox', role: Object.freeze({ role: 'textbox', name: 'search transcript' }), matches: '.txn-search-input', count: 1 }),
      TRANSCRIPT_SEARCH_FOCUSED,
    ]),
    gateTie: Object.freeze({ field: 'searchOpen', expectation: TRANSCRIPT_SEARCH_FOCUSED }),
    computed: Object.freeze([]),
    floors: Object.freeze({ descendants: 400, textLength: 1200, ariaChars: 3000, screenshotBytes: 150000 }),
  }),
  Object.freeze({
    key: 'offline-banner',
    rowPrefix: 'component-offline-banner',
    targetId: 'fairtrade-offline-banner-story',
    storyId: 'in-use-connectionstate--offline-banner',
    layout: 'fullscreen',
    before: Object.freeze([
      Object.freeze({ name: 'banner', selector: 'section.cx-offline', count: 1 }),
      Object.freeze({ name: 'status-message', selector: 'section.cx-offline [role="status"]', count: 1 }),
      Object.freeze({ name: 'start-command', selector: 'code.cx-cmd-code .cx-cmd-text', text: 'peasant web start' }),
      Object.freeze({ name: 'no-wifi-glyph', selector: 'section.cx-offline .lucide-wifi-off', count: 0 }),
      Object.freeze({ name: 'retry-idle', selector: '.cx-offline-retry', attribute: 'aria-busy', value: null }),
      Object.freeze({ name: 'retry-label', role: Object.freeze({ role: 'button', name: 'try again' }), matches: '.cx-offline-retry', count: 1 }),
    ]),
    action: Object.freeze({ name: 'retry-local-connection', kind: 'click', target: Object.freeze({ name: 'retry', role: Object.freeze({ role: 'button', name: 'try again' }), matches: '.cx-offline-retry', count: 1 }) }),
    after: Object.freeze([
      OFFLINE_RETRY_BUSY,
      Object.freeze({ name: 'retrying-label', role: Object.freeze({ role: 'button', name: 'trying again' }), matches: '.cx-offline-retry', count: 1 }),
      Object.freeze({ name: 'no-wifi-glyph', selector: 'section.cx-offline .lucide-wifi-off', count: 0 }),
    ]),
    gateTie: Object.freeze({ field: 'retryBusy', expectation: OFFLINE_RETRY_BUSY }),
    computed: Object.freeze([
      Object.freeze({ name: 'commandFontFamily', selector: 'code.cx-cmd-code', property: 'fontFamily', token: '--font-mono' }),
      Object.freeze({ name: 'commandTextTransform', selector: 'code.cx-cmd-code', property: 'textTransform', equals: 'none' }),
    ]),
    floors: Object.freeze({ descendants: 25, textLength: 140, ariaChars: 280, screenshotBytes: 15000 }),
  }),
  Object.freeze({
    key: 'digest-split',
    rowPrefix: 'component-digest-split',
    targetId: 'fairtrade-digest-split-story',
    storyId: 'components-promptdigest--split',
    layout: 'centered',
    before: Object.freeze([
      Object.freeze({ name: 'session-options', selector: `${DIGEST_LIST} > li[role="option"]`, count: 2 }),
      Object.freeze({ name: 'first-option-selected', selector: `${DIGEST_LIST} > li[role="option"]:nth-of-type(1)`, attribute: 'aria-selected', value: 'true' }),
    ]),
    action: Object.freeze({ name: 'select-next-session', kind: 'key', key: 'j', target: Object.freeze({ name: 'session-list', selector: DIGEST_LIST, count: 1 }) }),
    after: Object.freeze([
      DIGEST_SECOND_SELECTED,
      Object.freeze({ name: 'first-option-released', selector: `${DIGEST_LIST} > li[role="option"]:nth-of-type(1)`, attribute: 'aria-selected', value: 'false' }),
    ]),
    gateTie: Object.freeze({ field: 'nextOptionSelected', expectation: DIGEST_SECOND_SELECTED }),
    computed: Object.freeze([
      Object.freeze({ name: 'optionLabelFontSize', selector: `${DIGEST_LIST} .pd-split-option-label`, property: 'fontSize', equals: '16px' }),
    ]),
    floors: Object.freeze({ descendants: 35, textLength: 250, ariaChars: 650, screenshotBytes: 30000 }),
  }),
  Object.freeze({
    key: 'stats-strip',
    rowPrefix: 'component-stats-strip',
    targetId: 'fairtrade-stats-strip-story',
    storyId: 'components-statsstrip--many-pairs',
    layout: 'centered',
    before: Object.freeze([STATS_PAIRS]),
    action: null,
    after: Object.freeze([]),
    gateTie: Object.freeze({ field: 'pairsRendered', expectation: STATS_PAIRS }),
    computed: Object.freeze([
      Object.freeze({ name: 'valueFontVariantNumeric', selector: 'ul.sst .sst-value', property: 'fontVariantNumeric', includes: 'tabular-nums' }),
    ]),
    // one short line of text: a blank capture of this box compresses to about 430 bytes, and the
    // real strip measures about 5 KB on the CI renderer and 10 KB on macOS.
    floors: Object.freeze({ descendants: 15, textLength: 60, ariaChars: 150, screenshotBytes: 2500 }),
  }),
  Object.freeze({
    key: 'publish-bar',
    rowPrefix: 'component-publish-bar',
    targetId: 'fairtrade-publish-bar-story',
    storyId: 'in-use-publish--bar-states',
    layout: 'centered',
    before: Object.freeze([PUBLISH_BAR_ACTIONS, PUBLISH_BAR_UPDATE]),
    action: null,
    after: Object.freeze([]),
    gateTie: Object.freeze({ field: 'barActions', expectation: PUBLISH_BAR_ACTIONS }),
    computed: Object.freeze([
      Object.freeze({ name: 'labelFontFamily', selector: '.pub-state', property: 'fontFamily', token: '--font-mono' }),
      Object.freeze({ name: 'actionBorderRadius', selector: '.pub-bar-action', property: 'borderRadius', equals: '0px' }),
    ]),
    floors: Object.freeze({ descendants: 30, textLength: 150, ariaChars: 200, screenshotBytes: 6000 }),
  }),
  Object.freeze({
    key: 'access-list',
    rowPrefix: 'component-access-list',
    targetId: 'fairtrade-access-list-story',
    storyId: 'in-use-publish--access',
    layout: 'centered',
    before: Object.freeze([ACCESS_NAMED_REMOVE, ACCESS_KEEP]),
    action: null,
    after: Object.freeze([]),
    gateTie: Object.freeze({ field: 'namedRemove', expectation: ACCESS_NAMED_REMOVE }),
    computed: Object.freeze([
      Object.freeze({ name: 'nameFontSize', selector: '.pub-access-name', property: 'fontSize', equals: '16px' }),
    ]),
    floors: Object.freeze({ descendants: 15, textLength: 80, ariaChars: 150, screenshotBytes: 6000 }),
  }),
  Object.freeze({
    key: 'setting-groups',
    rowPrefix: 'component-setting-groups',
    targetId: 'fairtrade-setting-groups-story',
    storyId: 'in-use-settings--groups',
    layout: 'centered',
    before: Object.freeze([SETTING_GROUPS_ONE_OPEN]),
    action: Object.freeze({ name: 'open-collapsed-group', kind: 'click', target: Object.freeze({ name: 'collapsed-summary', selector: 'details.srow-group:not([open]) > summary', count: 1 }) }),
    after: Object.freeze([SETTING_GROUPS_BOTH_OPEN]),
    gateTie: Object.freeze({ field: 'bothGroupsOpen', expectation: SETTING_GROUPS_BOTH_OPEN }),
    computed: Object.freeze([
      Object.freeze({ name: 'helpFontSize', selector: '.srow-help', property: 'fontSize', equals: '16px' }),
      Object.freeze({ name: 'labelKeepsCase', selector: '.srow-label', property: 'textTransform', equals: 'none' }),
    ]),
    floors: Object.freeze({ descendants: 20, textLength: 60, ariaChars: 100, screenshotBytes: 6000 }),
  }),
  Object.freeze({
    key: 'publish-dialog',
    rowPrefix: 'component-publish-dialog',
    targetId: 'fairtrade-publish-dialog-story',
    storyId: 'in-use-publish--popup-scan-failed',
    layout: 'fullscreen',
    before: Object.freeze([PUBLISH_DIALOG_OFF, PUBLISH_DIALOG_RESCAN_ON]),
    action: null,
    after: Object.freeze([]),
    gateTie: Object.freeze({ field: 'publishOff', expectation: PUBLISH_DIALOG_OFF }),
    computed: Object.freeze([
      Object.freeze({ name: 'bodyLineFontSize', selector: '.pub-line', property: 'fontSize', equals: '16px' }),
      Object.freeze({ name: 'panelBorderRadius', selector: '.dialog-wide', property: 'borderRadius', equals: '0px' }),
    ]),
    floors: Object.freeze({ descendants: 60, textLength: 350, ariaChars: 800, screenshotBytes: 15000 }),
  }),
])

/**
 * The disclosure story, the default registry entry every single-story helper
 * reads when no story is named.
 * @type {ComponentStory}
 */
export const COMPONENT_DEFAULT_STORY = DISCLOSURE_STORY

// Drift guard: row prefixes and registry keys are unique, every layout has
// declared ready-state classes, and every story gates on one tie field.
if (
  new Set(COMPONENT_STORIES.map((story) => story.rowPrefix)).size !== COMPONENT_STORIES.length
  || new Set(COMPONENT_STORIES.map((story) => story.key)).size !== COMPONENT_STORIES.length
  || COMPONENT_STORIES.some((story) => !Object.hasOwn(COMPONENT_LAYOUT_BODY_CLASSES, story.layout))
) {
  throw new Error(
    'fairtrade component targets: story registry drifted for field "stories" at path target.stories; ' +
    'repair: give every story its own key and row prefix and a declared Storybook layout.',
  )
}

/**
 * Return the registered story for a key.
 * @param {unknown} key story key requested by the caller
 * @returns {ComponentStory} the frozen story entry
 */
export function selectComponentStory(key) {
  const story = COMPONENT_STORIES.find((entry) => entry.key === key)
  if (!story) {
    throw new Error(
      `fairtrade component targets: unknown story ${JSON.stringify(key)} for field "story" at path row.story; ` +
      `repair: use one of ${COMPONENT_STORIES.map((entry) => entry.key).join(', ')} for "story".`,
    )
  }
  return story
}

/**
 * The accessibility observation point a story's gate receipt carries.
 * @param {ComponentStory} [story] story entry, defaults to the disclosure story
 * @returns {string} after-interaction for a story with an action, after-mount otherwise
 */
export function componentA11yPoint(story = COMPONENT_DEFAULT_STORY) {
  return story.action ? COMPONENT_A11Y_POINTS[0] : COMPONENT_A11Y_POINTS[1]
}

/**
 * Exact field set of one story's gate receipt: the shared fields with the
 * story's own tie field in the place the disclosure story's `ariaExpanded`
 * holds, so the disclosure receipt keeps its declared shape.
 * @param {ComponentStory} [story] story entry, defaults to the disclosure story
 * @returns {readonly string[]} the receipt field set
 */
export function componentGateReceiptFields(story = COMPONENT_DEFAULT_STORY) {
  return Object.freeze(COMPONENT_A11Y_GATE_RECEIPT_FIELDS.map((field) => (field === 'ariaExpanded' ? story.gateTie.field : field)))
}

/**
 * Named fixtures the component target serves.
 * @type {readonly string[]}
 */
const COMPONENT_FIXTURES = Object.freeze(['component-theme-rows', 'component-disclosure-expand'])

/**
 * Named actions the component target offers.
 * @type {readonly string[]}
 */
const COMPONENT_ACTIONS = Object.freeze(COMPONENT_STORIES.flatMap((story) => (story.action ? [story.action.name] : [])))

/**
 * Every registered component action keyed by name, each bound to the story it
 * runs on.
 * @type {Readonly<Record<string, { name: string, storyId: string }>>}
 */
const COMPONENT_ACTION_REGISTRY = Object.freeze(Object.fromEntries(
  COMPONENT_STORIES.flatMap((story) => (story.action ? [[story.action.name, Object.freeze({ name: story.action.name, storyId: story.storyId })]] : [])),
))

const COMPONENT_ACTION = COMPONENT_ACTION_REGISTRY[COMPONENT_ACTION_NAME]

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
 * The one component target as a validated value: its kind, id, capability
 * inventory, fixtures, and actions, plus the app-owned surface metadata. The
 * capability inventory is validated against the shared component vocabulary
 * and required subset at declaration, so a component target missing a required
 * capability cannot be constructed. The adapter reads the declaration input
 * and the registered action from these fields rather than branching on kind.
 */
export const COMPONENT_TARGET = Object.freeze({
  ...COMPONENT_TARGET_RECORD,
  ...targetsContract.createTargetValue({
    kind: 'component',
    id: COMPONENT_TARGET_ID,
    capabilities: [...targetsContract.COMPONENT_CAPABILITIES],
    fixtures: COMPONENT_FIXTURES,
    actions: COMPONENT_ACTIONS,
  }, 'fairtrade component targets'),
})

/**
 * Target registry keyed by target id. This module declares exactly one
 * component target.
 */
export const COMPONENT_TARGET_REGISTRY = Object.freeze({
  [COMPONENT_TARGET_ID]: COMPONENT_TARGET,
})

/**
 * The frozen component target record selectComponentTarget returns.
 * @typedef {object} ComponentTargetRecord
 * @property {string} id
 * @property {string} kind
 * @property {string} storyId
 * @property {typeof COMPONENT_SELECTORS} selectors
 * @property {readonly string[]} fixtures
 * @property {readonly string[]} actions
 * @property {{ name: string, storyId: string }} action
 * @property {object} provenanceSource
 */

/**
 * The declaration input componentDeclarationInput returns.
 * @typedef {object} ComponentDeclarationInput
 * @property {string} kind
 * @property {{ kind: string, id: string, createdAtMs: number }} identity
 * @property {readonly string[]} capabilities
 * @property {readonly string[]} fixtures
 * @property {readonly string[]} actions
 */

/**
 * Arguments componentDeclarationInput accepts: the creation time, the shared
 * capability inventory, and the optional named fixtures and actions.
 * @typedef {object} ComponentDeclarationInputArgs
 * @property {number} createdAtMs creation time in whole milliseconds
 * @property {string[]} capabilities declared capability inventory
 * @property {readonly string[]} [fixtures] named fixtures served
 * @property {readonly string[]} [actions] named actions offered
 */

/**
 * Arguments validateComponentTargetContract accepts.
 * @typedef {object} ComponentTargetContractInput
 * @property {number} createdAtMs creation time in whole milliseconds
 */

/**
 * The contract receipt validateComponentTargetContract returns.
 * @typedef {object} ComponentTargetContractReceipt
 * @property {string} kind
 * @property {readonly string[]} capabilities
 * @property {ComponentDeclarationInput} declaration
 */

/**
 * Return the frozen target record for a registered component id.
 * @param {unknown} id target id requested by the caller
 * @returns {ComponentTargetRecord} the frozen component target record
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
 * @returns {{ name: string, storyId: string }} the frozen component action record
 */
export function getComponentAction(name) {
  if (typeof name !== 'string' || !Object.hasOwn(COMPONENT_ACTION_REGISTRY, name)) {
    throw new Error(
      `fairtrade component targets: unknown action ${JSON.stringify(name)} for field "action" at path target.action; ` +
      `repair: use one of ${Object.keys(COMPONENT_ACTION_REGISTRY).join(', ')} for "action".`,
    )
  }
  return COMPONENT_ACTION_REGISTRY[name]
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
 * @param {ComponentStory} [story] story entry, defaults to the disclosure story
 * @returns {{ theme: string, expectedAttribute: string, url: string, storyId: string }} the frozen theme row record
 */
export function componentThemeRow(theme, story = COMPONENT_DEFAULT_STORY) {
  return Object.freeze({ ...componentThemeSetup(theme, story), storyId: story.storyId })
}

/**
 * Row-scoped theme setup descriptor. Theme setup owns the URL/global and the
 * expected raw attribute; reduced motion is inherited from the one-project
 * runner config and is deliberately not re-declared here.
 * @param {unknown} theme dark or light row theme
 * @param {ComponentStory} [story] story entry, defaults to the disclosure story
 * @returns {{ theme: string, expectedAttribute: string, url: string }} the frozen setup descriptor for the row
 */
export function componentThemeSetup(theme, story = COMPONENT_DEFAULT_STORY) {
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error(
      `fairtrade component targets: unknown row theme ${JSON.stringify(theme)} for field "theme" at path setup.theme; ` +
      'repair: use one of dark, light for "theme".',
    )
  }
  return Object.freeze({
    theme,
    expectedAttribute: theme === 'light' ? 'light' : '',
    url: componentStoryUrl(story.storyId, theme),
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
 * @param {object} input raw mount observations read from the iframe
 * @param {number} input.rootChildCount story root childElementCount
 * @param {string} input.bodyClass current body className
 * @param {string} input.errorDisplay computed display of the error display
 * @param {string} input.errorStackText trimmed #error-stack text
 * @param {readonly string[]} [bodyClasses] ready-state body classes of the story layout, defaults to the centered layout
 * @returns {{ mounted: boolean, rootChildCount: number, bodyClass: string, errorDisplay: string, errorStackText: string }} the frozen mount observation
 */
export function assertComponentMounted(input, bodyClasses = COMPONENT_MOUNT_BODY_CLASSES) {
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
  for (const bodyToken of bodyClasses) {
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
  return Object.freeze({ mounted: true, rootChildCount: /** @type {number} */ (rootChildCount), bodyClass: /** @type {string} */ (bodyClass), errorDisplay, errorStackText })
}

/**
 * Build the raw target declaration input for the component target. Capability
 * contents stay caller-owned: pass the shared component inventory so the
 * closed vocabulary is never duplicated here.
 * @param {object} input declaration inputs
 * @param {number} input.createdAtMs creation time in whole milliseconds
 * @param {string[]} input.capabilities declared capability inventory
 * @param {readonly string[]} [input.fixtures] named fixtures served
 * @param {readonly string[]} [input.actions] named actions offered
 * @returns {ComponentDeclarationInput} the frozen declaration input
 */
export function componentDeclarationInput({ createdAtMs, capabilities, fixtures = COMPONENT_FIXTURES, actions = COMPONENT_ACTIONS } = /** @type {ComponentDeclarationInputArgs} */ ({})) {
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
 * @param {object} input validation inputs
 * @param {number} input.createdAtMs creation time in whole milliseconds
 * @returns {Promise<ComponentTargetContractReceipt>} the frozen contract receipt
 */
export async function validateComponentTargetContract({ createdAtMs } = /** @type {ComponentTargetContractInput} */ ({})) {
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
 * @type {{ kind: string, fields: readonly string[], fieldsWithInteraction: readonly string[], rootFields: readonly string[], themeFields: readonly string[], interactionFields: readonly string[], identityFields: readonly string[] }}
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
 * @param {object} input proof inputs, validated field by field at runtime
 * @returns {import('../fairtest-source.mjs').ComponentResolution} the frozen validated component resolution
 */
export function buildComponentProof(input) {
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
  const candidate = /** @type {Record<string, unknown>} */ ({ kind: 'component', identity, root, theme })
  if (Object.hasOwn(input, 'interaction')) {
    const registered = getComponentAction(/** @type {Record<string, unknown>} */ (record.interaction)?.name)
    const interaction = resolutionContract.validateNamedResult(record.interaction, 'fairtrade component targets', 'resolution.interaction')
    candidate.interaction = interaction
    if (interaction.name !== registered.name) {
      throw new Error(
        `fairtrade component targets: interaction ${JSON.stringify(interaction.name)} is not the registered ${JSON.stringify(registered.name)} for field "name" at path resolution.interaction.name; ` +
        'repair: complete the registered component interaction before building the proof.',
      )
    }
  }
  return resolutionContract.validateComponentResolution(candidate, 'fairtrade component targets')
}

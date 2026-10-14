// @ts-check

// Neutral capture-case document: the closed case matrix a capture pass runs and
// a sheet plan reads.
//
// One document declares the ordered state set, the viewport widths, the theme
// names, and the surfaces. Each surface carries the page path it lives on, the
// region selector that clips the full-surface shot, the probe and focus
// entries, and the shared host kind the captured row declares. Every field is
// caller-owned data: no origin, port, route name, or product threshold is
// invented here. It executes no page code and names no runner, document
// object, or scheme address.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord, isPlainRecord } from '../core/values.mjs'
import { loadSingleDocument } from '../core/fixtures.mjs'
import { THEME_NAMES, assertHostKind } from '../host-contract/kinds.mjs'

const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const MAX_WIDTH = 100000

/**
 * Optional probe flags a capture case may declare beside its name and
 * selector. `hover` marks a probe whose hover treatment is also captured;
 * `stateLabel` records the adjacent state-label color in the read.
 * @type {readonly string[]}
 */
export const CAPTURE_PROBE_OPTION_FIELDS = freezeRecord(['hover', 'stateLabel'])

/**
 * @typedef {object} CaptureProbe
 * @property {string} name caller-owned probe name
 * @property {string} selector selector the probe reads
 * @property {boolean} [hover] capture the hover treatment as well
 * @property {boolean} [stateLabel] record the adjacent state-label color
 */

/**
 * @typedef {object} CaptureFocus
 * @property {string} name caller-owned focus representative name
 * @property {string} selector selector the representative reads
 */

/**
 * @typedef {object} CaptureSurface
 * @property {string} id caller-owned surface id
 * @property {string} kind shared host kind, component or product
 * @property {string} path page path the surface lives on
 * @property {string} query query string without a leading marker, possibly empty
 * @property {string} hash fragment including its marker, possibly empty
 * @property {string} root region selector the full-surface shot clips to
 * @property {CaptureProbe[]} probes probes this surface captures
 * @property {CaptureFocus[]} focus keyboard focus representatives, possibly none
 */

/**
 * @typedef {object} CaptureCases
 * @property {string[]} states ordered state ids, for example before then after
 * @property {number[]} widths viewport widths
 * @property {string[]} themes theme names
 * @property {CaptureSurface[]} surfaces capture surfaces
 */

/**
 * @typedef {object} CaptureRowTarget
 * @property {string} state state id
 * @property {string} surface surface id
 * @property {string} kind shared host kind
 * @property {number} width viewport width
 * @property {string} theme theme name
 * @property {string} key row key
 */

/**
 * Assert a caller-owned name matches the shared lowercase name pattern.
 * @param {unknown} value
 * @param {string} field field name used in diagnostics
 * @param {string} where value path used in diagnostics
 * @returns {asserts value is string}
 */
function assertName(value, field, where) {
  assertNonEmptyString(value, field, where)
  if (!NAME_PATTERN.test(value)) {
    throw new Error(
      `invalid value ${JSON.stringify(value)} for field "${field}" at path ${where}; ` +
      `repair: use a lowercase name up to 64 characters for "${field}".`,
    )
  }
}

/**
 * Validate the ordered state list.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {string[]}
 */
function validateStates(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}: expected a non-empty state list at path cases.states; repair: declare the ordered state ids in cases.states.`)
  }
  const seen = new Set()
  /** @type {string[]} */
  const states = []
  for (const [index, entry] of value.entries()) {
    const where = `cases.states[${index}]`
    assertName(entry, 'states', where)
    if (seen.has(entry)) {
      throw new Error(`${label}: duplicate state ${JSON.stringify(entry)} at path ${where}; repair: list every state id once in cases.states.`)
    }
    seen.add(entry)
    states.push(entry)
  }
  return states
}

/**
 * Validate the viewport width list.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {number[]}
 */
function validateWidths(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}: expected a non-empty width list at path cases.widths; repair: declare the viewport widths in cases.widths.`)
  }
  const seen = new Set()
  /** @type {number[]} */
  const widths = []
  for (const [index, entry] of value.entries()) {
    const where = `cases.widths[${index}]`
    assertIntegerInRange(entry, 'widths', where, { min: 1, max: MAX_WIDTH })
    if (seen.has(entry)) {
      throw new Error(`${label}: duplicate width ${JSON.stringify(entry)} at path ${where}; repair: list every width once in cases.widths.`)
    }
    seen.add(entry)
    widths.push(entry)
  }
  return widths
}

/**
 * Validate the theme name list against the shared closed theme vocabulary.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {string[]}
 */
function validateThemes(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}: expected a non-empty theme list at path cases.themes; repair: declare the theme names in cases.themes.`)
  }
  const seen = new Set()
  /** @type {string[]} */
  const themes = []
  for (const [index, entry] of value.entries()) {
    const where = `cases.themes[${index}]`
    if (!/** @type {readonly string[]} */ (THEME_NAMES).includes(/** @type {string} */ (entry))) {
      throw new Error(
        `${label}: invalid value ${JSON.stringify(entry)} for field "themes" at path ${where}; ` +
        `repair: use one of ${THEME_NAMES.join(', ')} for "themes".`,
      )
    }
    if (seen.has(entry)) {
      throw new Error(`${label}: duplicate theme ${JSON.stringify(entry)} at path ${where}; repair: list every theme once in cases.themes.`)
    }
    seen.add(entry)
    themes.push(entry)
  }
  return themes
}

/**
 * Validate one probe entry.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @param {string} where value path used in diagnostics
 * @returns {CaptureProbe}
 */
function validateProbe(value, label, where) {
  /** @type {string[]} */
  const fields = ['name', 'selector']
  if (isPlainRecord(value)) {
    for (const option of CAPTURE_PROBE_OPTION_FIELDS) if (option in value) fields.push(option)
  }
  assertExactFields(value, fields, label, where)
  const record = /** @type {Record<string, unknown>} */ (value)
  assertName(record.name, 'probes[].name', `${where}.name`)
  assertNonEmptyString(record.selector, 'selector', `${where}.selector`)
  for (const option of CAPTURE_PROBE_OPTION_FIELDS) {
    if (option in record && typeof record[option] !== 'boolean') {
      throw new Error(
        `${label}: invalid value ${JSON.stringify(record[option])} for field "${option}" at path ${where}.${option}; ` +
        `repair: use a boolean for "${option}".`,
      )
    }
  }
  return /** @type {CaptureProbe} */ (freezeRecord(record))
}

/**
 * Validate one keyboard focus representative entry.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @param {string} where value path used in diagnostics
 * @returns {CaptureFocus}
 */
function validateFocus(value, label, where) {
  assertExactFields(value, ['name', 'selector'], label, where)
  const record = /** @type {Record<string, unknown>} */ (value)
  assertName(record.name, 'focus[].name', `${where}.name`)
  assertNonEmptyString(record.selector, 'selector', `${where}.selector`)
  return /** @type {CaptureFocus} */ (freezeRecord(record))
}

/**
 * Validate a named list, requiring unique names.
 * @param {unknown} value
 * @param {string} field field name used in diagnostics
 * @param {string} label owning document used in diagnostics
 * @param {string} where value path used in diagnostics
 * @param {boolean} allowEmpty true when an empty list is accepted
 * @returns {unknown[]}
 */
function assertNameList(value, field, label, where, allowEmpty) {
  if (!Array.isArray(value)) {
    throw new Error(`${label}: invalid ${field} list at path ${where}; repair: provide a list of ${field} entries.`)
  }
  if (value.length === 0 && !allowEmpty) {
    throw new Error(`${label}: missing ${field} entries at path ${where}; repair: declare at least one ${field} entry.`)
  }
  const seen = new Set()
  for (const entry of value) {
    const name = isPlainRecord(entry) ? /** @type {string} */ (entry.name) : entry
    if (seen.has(name)) {
      throw new Error(`${label}: duplicate ${field} name ${JSON.stringify(name)} at path ${where}; repair: give every ${field} entry a unique name.`)
    }
    seen.add(name)
  }
  return value
}

/**
 * Validate one capture surface.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @param {string} where value path used in diagnostics
 * @returns {CaptureSurface}
 */
function validateSurface(value, label, where) {
  assertExactFields(value, ['id', 'kind', 'path', 'query', 'hash', 'root', 'probes', 'focus'], label, where)
  const record = /** @type {Record<string, unknown>} */ (value)
  assertName(record.id, 'surfaces[].id', `${where}.id`)
  assertHostKind(record.kind, `${where}.kind`)
  assertNonEmptyString(record.path, 'path', `${where}.path`)
  if (!/** @type {string} */ (record.path).startsWith('/')) {
    throw new Error(
      `${label}: invalid value ${JSON.stringify(record.path)} for field "path" at path ${where}.path; ` +
      'repair: start the surface path with a leading slash.',
    )
  }
  if (typeof record.query !== 'string') {
    throw new Error(`${label}: invalid value ${JSON.stringify(record.query)} for field "query" at path ${where}.query; repair: provide a query string, possibly empty.`)
  }
  if (typeof record.hash !== 'string') {
    throw new Error(`${label}: invalid value ${JSON.stringify(record.hash)} for field "hash" at path ${where}.hash; repair: provide a hash string with its marker, possibly empty.`)
  }
  if (record.hash.length > 0 && !record.hash.startsWith('#')) {
    throw new Error(`${label}: invalid value ${JSON.stringify(record.hash)} for field "hash" at path ${where}.hash; repair: start a non-empty hash with the fragment marker.`)
  }
  assertNonEmptyString(record.root, 'root', `${where}.root`)
  if (!Array.isArray(record.probes) || record.probes.length === 0) {
    throw new Error(`${label}: expected a non-empty probe list at path ${where}.probes; repair: declare at least one probe.`)
  }
  assertNameList(record.probes, 'probe', label, `${where}.probes`, false)
  assertNameList(record.focus, 'focus', label, `${where}.focus`, true)
  const probes = record.probes.map((entry, index) => validateProbe(entry, label, `${where}.probes[${index}]`))
  const focus = /** @type {unknown[]} */ (record.focus).map((entry, index) => validateFocus(entry, label, `${where}.focus[${index}]`))
  return freezeRecord({
    id: record.id,
    kind: record.kind,
    path: record.path,
    query: record.query,
    hash: record.hash,
    root: record.root,
    probes,
    focus,
  })
}

/**
 * Validate the ordered surface list.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {CaptureSurface[]}
 */
function validateSurfaces(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}: expected a non-empty surface list at path cases.surfaces; repair: declare the capture surfaces in cases.surfaces.`)
  }
  const seen = new Set()
  /** @type {CaptureSurface[]} */
  const surfaces = []
  for (const [index, entry] of value.entries()) {
    const where = `cases.surfaces[${index}]`
    const id = isPlainRecord(entry) ? entry.id : undefined
    if (seen.has(id)) {
      throw new Error(`${label}: duplicate surface ${JSON.stringify(id)} at path ${where}.id; repair: give every surface a unique id.`)
    }
    seen.add(id)
    surfaces.push(validateSurface(entry, label, where))
  }
  return surfaces
}

/**
 * Validate an unknown value as a capture-case document and return a frozen
 * copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {CaptureCases}
 */
export function validateCaptureCases(value, label) {
  assertExactFields(value, ['states', 'widths', 'themes', 'surfaces'], label, 'cases')
  const record = /** @type {Record<string, unknown>} */ (value)
  const states = validateStates(record.states, label)
  const widths = validateWidths(record.widths, label)
  const themes = validateThemes(record.themes, label)
  const surfaces = validateSurfaces(record.surfaces, label)
  return freezeRecord({ states, widths, themes, surfaces })
}

/**
 * Parse exactly one capture-case document from text and validate it.
 * @param {string} source raw YAML text
 * @param {string} label owning file used in diagnostics
 * @returns {CaptureCases}
 */
export function loadCaptureCases(source, label) {
  return validateCaptureCases(loadSingleDocument(source, label), label)
}

/**
 * Build the caller-owned row key for one surface, width, and theme.
 * @param {string} surface surface id
 * @param {number} width viewport width
 * @param {string} theme theme name
 * @returns {string}
 */
export function captureRowKey(surface, width, theme) {
  assertNonEmptyString(surface, 'surface', 'rowKey.surface')
  assertIntegerInRange(width, 'width', 'rowKey.width', { min: 1, max: MAX_WIDTH })
  if (!/** @type {readonly string[]} */ (THEME_NAMES).includes(theme)) {
    throw new Error(`invalid value ${JSON.stringify(theme)} for field "theme" at path rowKey.theme; repair: use one of ${THEME_NAMES.join(', ')} for "theme".`)
  }
  return `${surface}--${width}--${theme}`
}

/**
 * Expand one case document into the ordered row targets one state produces:
 * every surface, then every width, then every theme. The caller (the app-owned
 * policy and the verifier) reads the same list, so the required row inventory
 * and the producer row keys cannot drift.
 * @param {CaptureCases} document capture-case document
 * @param {string} state state id to expand
 * @returns {CaptureRowTarget[]}
 */
export function captureRowTargets(document, state) {
  const cases = validateCaptureCases(document, 'cases')
  if (!cases.states.includes(state)) {
    throw new Error(`invalid value ${JSON.stringify(state)} for field "state" at path cases.state; repair: use one of ${cases.states.join(', ')} for "state".`)
  }
  /** @type {CaptureRowTarget[]} */
  const targets = []
  for (const surface of cases.surfaces) {
    for (const width of cases.widths) {
      for (const theme of cases.themes) {
        targets.push(freezeRecord({
          state,
          surface: surface.id,
          kind: surface.kind,
          width,
          theme,
          key: captureRowKey(surface.id, width, theme),
        }))
      }
    }
  }
  return freezeRecord(targets)
}

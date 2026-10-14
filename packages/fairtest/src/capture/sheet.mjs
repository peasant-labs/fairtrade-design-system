// @ts-check

// Neutral sheet plan and renderer.
//
// A sheet plan is the deterministic composition of certified capture records
// across two states: for every declared width, then theme, then state, one
// labeled column, and one row per captured target. The default order interleaves
// each before column beside its own after column, and every column is labeled
// with its width, theme, and state.
//
// A cell resolves to a shot reference, an explicit unshootable reason, or a
// distinct missing marker. The renderer turns a plan into one escaped HTML
// document string; the bytes it embeds are supplied by the caller, so this
// module performs no file or page I/O and names no runner, document object, or
// scheme address.

import { assertExactFields, assertIntegerInRange, assertNonEmptyString, freezeRecord, isPlainRecord } from '../core/values.mjs'
import { assertArtifactDigest } from '../evidence/digest.mjs'
import { validateCaptureCases } from './cases.mjs'
import { validateCaptureRecord } from './record.mjs'

const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

/**
 * Default sheet column order: widths outermost, then themes, then states, so
 * each before column sits immediately beside its own after column.
 * @type {string}
 */
export const DEFAULT_SHEET_ORDER = 'width-theme-state'

/**
 * Cell statuses. `shot` means a certified shot reference exists, `unshootable`
 * means the record carries an explicit reason, and `missing` means no record
 * resolved the reference at all.
 * @type {readonly string[]}
 */
export const SHEET_CELL_STATUSES = freezeRecord(['shot', 'unshootable', 'missing'])

/**
 * @typedef {object} SheetColumn
 * @property {string} key column key
 * @property {number} width viewport width
 * @property {string} theme theme name
 * @property {string} state state id
 * @property {string} label rendered column label naming width, theme, and state
 */

/**
 * @typedef {object} SheetCell
 * @property {string} column column key
 * @property {string} target target name
 * @property {string} kind target kind
 * @property {string} status one of SHEET_CELL_STATUSES
 * @property {string | null} file shot file, or null
 * @property {string | null} sha256 shot digest, or null
 * @property {string | null} reason unshootable reason, or null
 */

/**
 * @typedef {object} SheetRow
 * @property {string} label row label, the target name
 * @property {string} kind target kind
 * @property {SheetCell[]} cells one cell per column
 */

/**
 * @typedef {object} Sheet
 * @property {string} id sheet id
 * @property {string} surface surface id
 * @property {string} file sheet png path
 * @property {SheetRow[]} rows sheet rows
 */

/**
 * @typedef {object} SheetPlan
 * @property {string} order sheet column order
 * @property {string[]} states ordered state ids
 * @property {SheetColumn[]} columns sheet columns
 * @property {Sheet[]} sheets sheets, one per surface
 */

/**
 * @typedef {object} SheetManifestEntry
 * @property {string} id sheet id
 * @property {string} surface surface id
 * @property {string} file sheet png path
 * @property {string} sha256 lowercase 64-character hex SHA-256 digest of the sheet bytes
 */

/**
 * @typedef {object} SheetManifest
 * @property {number} version sheet manifest version
 * @property {string} order sheet column order
 * @property {{ state: string, runId: string }[]} runIds the two certified run ids
 * @property {SheetManifestEntry[]} sheets sheet entries
 */

/**
 * One captured row's target entries, keyed by kind and name.
 * @param {import('./record.mjs').CaptureRecord} record capture record
 * @param {string} name target name
 * @param {string} kind target kind
 * @returns {import('./record.mjs').CaptureTarget | undefined}
 */
function findTarget(record, name, kind) {
  return record.targets.find((entry) => entry.target === name && entry.kind === kind)
}

/**
 * Build one missing cell.
 * @param {SheetColumn} column column
 * @param {string} name target name
 * @param {string} kind target kind
 * @returns {SheetCell}
 */
function missingCell(column, name, kind) {
  return freezeRecord({ column: column.key, target: name, kind, status: 'missing', file: null, sha256: null, reason: null })
}

/**
 * Resolve one cell from its record and target.
 * @param {SheetColumn} column column
 * @param {import('./record.mjs').CaptureRecord | undefined} record capture record, when one exists
 * @param {string} name target name
 * @param {string} kind target kind
 * @returns {SheetCell}
 */
function resolveCell(column, record, name, kind) {
  if (!record) return missingCell(column, name, kind)
  const entry = findTarget(record, name, kind)
  if (!entry) return missingCell(column, name, kind)
  if (entry.shot !== null) {
    return freezeRecord({ column: column.key, target: name, kind, status: 'shot', file: entry.shot.file, sha256: entry.shot.sha256, reason: null })
  }
  return freezeRecord({ column: column.key, target: name, kind, status: 'unshootable', file: null, sha256: null, reason: /** @type {import('./record.mjs').CaptureUnshootable} */ (entry.unshootable).reason })
}

/**
 * Plan the contact sheets from a certified case document and its records. The
 * default column order is width, then theme, then state.
 * @param {object} input plan inputs
 * @param {unknown} input.cases capture-case document
 * @param {unknown[]} input.records certified capture records for every state
 * @returns {SheetPlan}
 */
export function planSheets(input) {
  assertExactFields(input, ['cases', 'records'], 'plan', 'plan')
  const record = /** @type {Record<string, unknown>} */ (input)
  const cases = validateCaptureCases(record.cases, 'cases')
  if (!Array.isArray(record.records)) {
    throw new Error('plan: invalid value for field "records" at path plan.records; repair: provide the certified capture records for every state.')
  }
  const records = record.records.map((entry, index) => validateCaptureRecord(entry, `plan.records[${index}]`))

  /** @type {SheetColumn[]} */
  const columns = []
  for (const width of cases.widths) {
    for (const theme of cases.themes) {
      for (const state of cases.states) {
        columns.push(freezeRecord({ key: `${width}-${theme}-${state}`, width, theme, state, label: `${width} ${theme} / ${state}` }))
      }
    }
  }

  const byScope = new Map()
  for (const entry of records) {
    byScope.set(`${entry.state}|${entry.surface}|${entry.width}|${entry.theme}`, entry)
  }

  /** @type {Sheet[]} */
  const sheets = []
  for (const surface of cases.surfaces) {
    /** @type {{ name: string, kind: string }[]} */
    const targets = []
    for (const probe of surface.probes) targets.push({ name: probe.name, kind: 'probe' })
    for (const probe of surface.probes) if (probe.hover) targets.push({ name: probe.name, kind: 'hover' })
    for (const focus of surface.focus) targets.push({ name: focus.name, kind: 'focus' })
    targets.push({ name: 'surface', kind: 'surface' })

    /** @type {SheetRow[]} */
    const rows = []
    for (const target of targets) {
      /** @type {SheetCell[]} */
      const cells = []
      for (const column of columns) {
        const entry = byScope.get(`${column.state}|${surface.id}|${column.width}|${column.theme}`)
        cells.push(resolveCell(column, entry, target.name, target.kind))
      }
      rows.push(freezeRecord({ label: target.name, kind: target.kind, cells }))
    }
    sheets.push(freezeRecord({ id: `sheet-${surface.id}`, surface: surface.id, file: `sheets/sheet-${surface.id}.png`, rows }))
  }

  return freezeRecord({ order: DEFAULT_SHEET_ORDER, states: [...cases.states], columns, sheets })
}

/**
 * Escape text for safe inclusion in an HTML text or attribute position.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeSheetText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Render one sheet of a plan as a deterministic, escaped HTML document string.
 * Shot cells must resolve to a caller-supplied image; an unresolved shot cell
 * fails closed rather than rendering as a silent blank.
 * @param {unknown} plan sheet plan
 * @param {string} sheetId sheet id to render
 * @param {Record<string, string>} images shot file to data-URI image map
 * @param {string} [title] sheet caption
 * @returns {string}
 */
export function renderSheetDocument(plan, sheetId, images, title = 'capture contact sheet') {
  const validated = /** @type {SheetPlan} */ (plan)
  if (!isPlainRecord(validated) || !Array.isArray(validated.sheets) || !Array.isArray(validated.columns)) {
    throw new Error('sheet: invalid plan at path sheet.plan; repair: render a plan produced by planSheets.')
  }
  const sheet = validated.sheets.find((entry) => entry.id === sheetId)
  if (!sheet) {
    throw new Error(`sheet: unknown sheet ${JSON.stringify(sheetId)} at path sheet.id; repair: render one of ${validated.sheets.map((entry) => entry.id).join(', ')}.`)
  }
  if (!isPlainRecord(images)) {
    throw new Error('sheet: invalid image map at path sheet.images; repair: provide shot bytes keyed by shot file.')
  }
  const header = `<tr><th></th>${validated.columns.map((column) => `<th style="font:11px sans-serif;border-left:2px solid #666">${escapeSheetText(column.label)}</th>`).join('')}</tr>`
  const rows = sheet.rows.map((row) => {
    const label = `<td style="font:12px monospace;white-space:nowrap">${escapeSheetText(row.label)}<br>${escapeSheetText(row.kind)}</td>`
    const cells = row.cells.map((cell) => {
      if (cell.status === 'shot') {
        const image = cell.file === null ? undefined : images[cell.file]
        if (typeof image !== 'string' || image.length === 0) {
          throw new Error(
            `sheet: no image for shot ${JSON.stringify(cell.file)} at path sheet.images; ` +
            'repair: supply the shot bytes for every shot cell before rendering the sheet.',
          )
        }
        return `<td style="border:1px solid #999"><img src="${escapeSheetText(image)}" style="max-width:170px;max-height:90px;display:block"></td>`
      }
      if (cell.status === 'unshootable') {
        return `<td style="border:1px solid #888;background:#e8e8e8;font:9px sans-serif;color:#444;max-width:170px">unshootable — ${escapeSheetText(cell.reason)}</td>`
      }
      return `<td style="border:1px solid #f00;font:10px sans-serif">missing (${escapeSheetText(cell.kind)} reference with no record)</td>`
    }).join('')
    return `<tr>${label}${cells}</tr>`
  }).join('')
  return `<html><body style="margin:6px;background:#ddd"><table style="border-collapse:collapse"><caption style="font:14px sans-serif">${escapeSheetText(title)}</caption>${header}${rows}</table></body></html>`
}

/**
 * Validate an unknown value as a sheet manifest and return a frozen copy.
 * @param {unknown} value
 * @param {string} label owning document used in diagnostics
 * @returns {SheetManifest}
 */
export function validateSheetManifest(value, label) {
  assertExactFields(value, ['version', 'order', 'runIds', 'sheets'], label, 'manifest')
  const record = /** @type {Record<string, unknown>} */ (value)
  assertIntegerInRange(record.version, 'version', 'manifest.version', { min: 1, max: 1 })
  if (record.order !== DEFAULT_SHEET_ORDER) {
    throw new Error(`invalid value ${JSON.stringify(record.order)} for field "order" at path manifest.order; repair: use ${JSON.stringify(DEFAULT_SHEET_ORDER)} for "order".`)
  }
  if (!Array.isArray(record.runIds) || record.runIds.length === 0) {
    throw new Error(`${label}: expected a non-empty run id list at path manifest.runIds; repair: name the certified run id for every state.`)
  }
  const seenStates = new Set()
  const runIds = record.runIds.map((entry, index) => {
    const where = `manifest.runIds[${index}]`
    assertExactFields(entry, ['state', 'runId'], label, where)
    const item = /** @type {Record<string, unknown>} */ (entry)
    assertNonEmptyString(item.state, 'state', `${where}.state`)
    assertNonEmptyString(item.runId, 'runId', `${where}.runId`)
    if (!NAME_PATTERN.test(/** @type {string} */ (item.runId))) {
      throw new Error(`${label}: invalid value ${JSON.stringify(item.runId)} for field "runId" at path ${where}.runId; repair: use a lowercase run id up to 64 characters.`)
    }
    if (seenStates.has(item.state)) {
      throw new Error(`${label}: duplicate state ${JSON.stringify(item.state)} at path ${where}.state; repair: name every state once.`)
    }
    seenStates.add(item.state)
    return freezeRecord({ state: item.state, runId: item.runId })
  })
  if (!Array.isArray(record.sheets) || record.sheets.length === 0) {
    throw new Error(`${label}: expected a non-empty sheet list at path manifest.sheets; repair: name every composed sheet and its digest.`)
  }
  const seenIds = new Set()
  const sheets = record.sheets.map((entry, index) => {
    const where = `manifest.sheets[${index}]`
    assertExactFields(entry, ['id', 'surface', 'file', 'sha256'], label, where)
    const item = /** @type {Record<string, unknown>} */ (entry)
    assertNonEmptyString(item.id, 'id', `${where}.id`)
    assertNonEmptyString(item.surface, 'surface', `${where}.surface`)
    assertNonEmptyString(item.file, 'file', `${where}.file`)
    assertArtifactDigest(item.sha256, `${where}.sha256`)
    if (seenIds.has(item.id)) {
      throw new Error(`${label}: duplicate sheet ${JSON.stringify(item.id)} at path ${where}.id; repair: name every sheet once.`)
    }
    seenIds.add(item.id)
    return freezeRecord({ id: item.id, surface: item.surface, file: item.file, sha256: item.sha256 })
  })
  return freezeRecord({ version: 1, order: DEFAULT_SHEET_ORDER, runIds, sheets })
}

/**
 * Assert a manifest names exactly the plan's sheets and states. Returns the
 * frozen manifest.
 * @param {unknown} plan sheet plan
 * @param {unknown} manifest sheet manifest
 * @param {string} [label] owning document used in diagnostics
 * @returns {SheetManifest}
 */
export function assertSheetManifestMatchesPlan(plan, manifest, label = 'manifest') {
  const validatedPlan = /** @type {SheetPlan} */ (plan)
  if (!isPlainRecord(validatedPlan) || !Array.isArray(validatedPlan.sheets) || !Array.isArray(validatedPlan.states)) {
    throw new Error(`${label}: invalid plan at path manifest.plan; repair: pass a plan produced by planSheets.`)
  }
  const validated = validateSheetManifest(manifest, label)
  const planIds = validatedPlan.sheets.map((entry) => entry.id)
  const manifestIds = validated.sheets.map((entry) => entry.id)
  const missing = planIds.filter((id) => !manifestIds.includes(id))
  const extra = manifestIds.filter((id) => !planIds.includes(id))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`${label}: sheet inventory mismatch at path manifest.sheets; expected ${JSON.stringify(planIds)} observed ${JSON.stringify(manifestIds)} missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}; repair: name every planned sheet once.`)
  }
  const manifestStates = validated.runIds.map((entry) => entry.state)
  if (JSON.stringify(manifestStates) !== JSON.stringify(validatedPlan.states)) {
    throw new Error(`${label}: state inventory mismatch at path manifest.runIds; expected ${JSON.stringify(validatedPlan.states)} observed ${JSON.stringify(manifestStates)}; repair: name the certified run id for every state in plan order.`)
  }
  if (validated.order !== validatedPlan.order) {
    throw new Error(`${label}: sheet order mismatch at path manifest.order; expected ${JSON.stringify(validatedPlan.order)} observed ${JSON.stringify(validated.order)}; repair: keep the manifest order equal to the plan order.`)
  }
  return validated
}

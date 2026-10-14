// @ts-check

// Capture-sheet contract tests. Every behavioral case lives in the named
// capture-sheet YAML family with a required-name manifest; this file owns no
// case data. Composes the real child sheet plan and renderer without a browser,
// service, runner, or network.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { assertExactFields, checkRequiredNames, loadSingleDocument } from '../src/core/index.mjs'
import { artifactDigest } from '../src/evidence/index.mjs'
import { DEFAULT_SHEET_ORDER, assertSheetManifestMatchesPlan, planSheets, renderSheetDocument, validateSheetManifest } from '../src/capture/index.mjs'

const TESTDATA = new URL('../testdata/', import.meta.url)
const CORPUS = 'capture-sheet.yaml'
const MANIFEST = 'capture-sheet.manifest.yaml'
const CHECKS = ['order', 'cells', 'escaping', 'render', 'manifest', 'plan']
const PLAN_MUTATIONS = ['duplicate-record', 'uncovered-target']
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])

/** @param {string} relative @returns {string} */
function readSource(relative) {
  return readFileSync(new URL(relative, TESTDATA), 'utf8')
}

/** @param {string} relative @returns {Record<string, unknown>} */
function readFamily(relative) {
  return /** @type {Record<string, unknown>} */ (loadSingleDocument(readSource(relative), relative))
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {string} label
 */
function validateManifest(manifest, label) {
  for (const field of ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations']) {
    assert.ok(field in manifest, `${label}: manifest is missing ${field}`)
  }
  const names = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(names).size, names.length, `${label}: required case names must be unique`)
  assert.equal(manifest.expectedCaseCount, names.length, `${label}: case count must equal the required-name inventory`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${label}: mutation count must equal the mutation inventory`)
  checkRequiredNames(mutations.map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredMutationNames), label)
  for (const mutation of mutations) {
    assert.ok(MUTATION_KINDS.has(String(mutation.kind)), `${label}: mutation ${String(mutation.name)} names an unknown kind`)
    if (mutation.kind === 'trailing-document') assert.equal(mutation.target, 'document', `${label}: trailing-document targets the document`)
    else assert.ok(names.includes(String(mutation.target)), `${label}: mutation ${String(mutation.name)} targets an unknown case`)
  }
}

/**
 * @param {Record<string, unknown>} corpus
 * @param {string} label
 */
function validateFamilyShape(corpus, label) {
  assertExactFields(corpus, ['expectedCaseCount', 'matrix', 'records', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (corpus.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no cases at path cases; repair: restore the named cases list.`)
  for (const [index, entry] of cases.entries()) {
    if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
      throw new Error(`${label}: case ${index} is missing its required name at path cases[${index}].name; repair: restore the required case name.`)
    }
    if (!CHECKS.includes(/** @type {string} */ (entry.check))) {
      throw new Error(`${label}: case "${entry.name}" names an unknown discriminator ${JSON.stringify(entry.check)} for field "check" at path cases[${index}].check; repair: use one of ${CHECKS.join(', ')} for "check".`)
    }
    const fields = entry.check === 'order'
      ? ['name', 'check', 'expectedKeys', 'expectedLabels']
      : entry.check === 'cells'
        ? ['name', 'check', 'expectedCells']
        : entry.check === 'escaping'
          ? ['name', 'check', 'reason', 'expectedFragments', 'mustNotContain']
          : entry.check === 'plan'
            ? ['name', 'check', 'mutation', 'expectedDiagnostic']
            : ['name', 'check', 'expectedDiagnostic']
    assertExactFields(entry, fields, label, `cases[${index}]`)
    if (entry.check === 'plan' && !PLAN_MUTATIONS.includes(/** @type {string} */ (entry.mutation))) {
      throw new Error(`${label}: case "${entry.name}" names an unknown plan mutation ${JSON.stringify(entry.mutation)} for field "mutation" at path cases[${index}].mutation; repair: use one of ${PLAN_MUTATIONS.join(', ')} for "mutation".`)
    }
  }
}

/**
 * @param {Record<string, unknown>[]} cases
 * @param {Record<string, unknown>} mutation
 */
function applyMutation(cases, mutation) {
  if (mutation.kind === 'duplicate-name') {
    const donor = cases.find((entry) => entry.name !== mutation.target) ?? cases[0]
    cases.push({ ...structuredClone(donor), name: mutation.target })
    return
  }
  if (mutation.kind === 'delete-record') {
    const index = cases.findIndex((entry) => entry.name === mutation.target)
    assert.notEqual(index, -1, `unknown mutation target ${String(mutation.target)}`)
    cases.splice(index, 1)
    return
  }
  const target = cases.find((entry) => entry.name === mutation.target)
  assert.ok(target, `unknown mutation target ${String(mutation.target)}`)
  const segments = String(mutation.field).split('.')
  if (mutation.kind === 'delete-field') {
    delete target[segments[segments.length - 1]]
    return
  }
  if (mutation.kind === 'rename-field') {
    const last = segments[segments.length - 1]
    const value = target[last]
    delete target[last]
    target[String(mutation.newField)] = value
    return
  }
  target[segments[segments.length - 1]] = structuredClone(mutation.value)
}

/**
 * The host kind a matrix surface declares.
 * @param {Record<string, unknown>} matrix
 * @param {string} surfaceId
 * @returns {string}
 */
function surfaceKind(matrix, surfaceId) {
  const surfaces = /** @type {Record<string, unknown>[]} */ (matrix.surfaces)
  const surface = surfaces.find((entry) => entry.id === surfaceId)
  return surface ? String(surface.kind) : 'component'
}

/**
 * Build one certified record from a fixture record spec.
 * @param {Record<string, unknown>} matrix
 * @param {Record<string, unknown>} spec
 * @param {string | null} [reasonOverride] reason to force on every unshootable target
 * @returns {Record<string, unknown>}
 */
function toRecord(matrix, spec, reasonOverride = null) {
  const state = String(spec.state)
  const surface = String(spec.surface)
  const width = Number(spec.width)
  const theme = String(spec.theme)
  const key = `${surface}--${width}--${theme}`
  const targets = /** @type {Record<string, unknown>[]} */ (spec.targets).map((target) => {
    if (target.shot === true) {
      const file = `shots/${state}/${key}-${String(target.name)}.png`
      return { target: target.name, kind: target.kind, selector: `.${String(target.name)}`, read: null, contrast: null, shot: { file, sha256: artifactDigest(`SHOT:${file}`) }, unshootable: null }
    }
    return {
      target: target.name,
      kind: target.kind,
      selector: `.${String(target.name)}`,
      read: null,
      contrast: null,
      shot: null,
      unshootable: { reason: reasonOverride ?? String(target.unshootable) },
    }
  })
  return {
    state,
    surface,
    kind: surfaceKind(matrix, surface),
    width,
    theme,
    observedTheme: theme,
    observedAtMs: 1000,
    servedAssets: [{ asset: '/assets/index-a.js', sha256: artifactDigest('/assets/index-a.js') }],
    targets,
  }
}

/**
 * Build the sheet plan from the fixture matrix and records.
 * @param {Record<string, unknown>} corpus
 * @param {string | null} [reasonOverride] reason to force on every unshootable target
 * @returns {{ plan: import('../src/capture/sheet.mjs').SheetPlan, images: Record<string, string> }}
 */
function buildPlan(corpus, reasonOverride = null) {
  const matrix = /** @type {Record<string, unknown>} */ (corpus.matrix)
  const records = /** @type {Record<string, unknown>[]} */ (corpus.records).map((spec) => toRecord(matrix, spec, reasonOverride))
  const plan = planSheets({ cases: matrix, records })
  /** @type {Record<string, string>} */
  const images = {}
  for (const sheet of plan.sheets) {
    for (const row of sheet.rows) {
      for (const cell of row.cells) {
        if (cell.status === 'shot' && cell.file !== null) images[cell.file] = 'data:image/png;base64,AAAA'
      }
    }
  }
  return { plan, images }
}

/**
 * Find one cell by sheet, row label, row kind, and column key.
 * @param {Record<string, unknown>} plan
 * @param {string} sheetId
 * @param {string} rowLabel
 * @param {string} rowKind
 * @param {string} columnKey
 * @returns {Record<string, unknown>}
 */
function findCell(plan, sheetId, rowLabel, rowKind, columnKey) {
  const sheets = /** @type {Record<string, unknown>[]} */ (plan.sheets)
  const sheet = sheets.find((entry) => entry.id === sheetId)
  assert.ok(sheet, `missing sheet ${sheetId}`)
  const rows = /** @type {Record<string, unknown>[]} */ (sheet.rows)
  const row = rows.find((entry) => entry.label === rowLabel && entry.kind === rowKind)
  assert.ok(row, `missing row ${rowLabel}/${rowKind}`)
  const cells = /** @type {Record<string, unknown>[]} */ (row.cells)
  const cell = cells.find((entry) => entry.column === columnKey)
  assert.ok(cell, `missing cell ${rowLabel} at ${columnKey}`)
  return cell
}

describe('capture sheet fixture', () => {
  const manifest = readFamily(MANIFEST)
  const corpus = readFamily(CORPUS)

  it('loads the fixture and matches the required case inventory', () => {
    validateManifest(manifest, MANIFEST)
    validateFamilyShape(corpus, CORPUS)
    checkRequiredNames(/** @type {Record<string, unknown>[]} */ (corpus.cases).map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
  })

  it('orders columns width then theme then state and pairs each before beside its after', () => {
    const { plan } = buildPlan(corpus)
    const orderCase = /** @type {Record<string, unknown>[]} */ (corpus.cases).find((entry) => entry.check === 'order')
    assert.ok(orderCase, 'the order case must exist')
    const columns = /** @type {Record<string, unknown>[]} */ (plan.columns)
    assert.equal(plan.order, DEFAULT_SHEET_ORDER, 'the plan must declare the default order')
    assert.deepEqual(columns.map((column) => column.key), orderCase.expectedKeys, 'the column keys must follow width, theme, state')
    assert.deepEqual(columns.map((column) => column.label), orderCase.expectedLabels, 'every column must be labeled width, theme, and state')
    for (let index = 0; index < columns.length; index += 2) {
      const first = columns[index]
      const second = columns[index + 1]
      assert.equal(first.width, second.width, 'a paired column must share its width')
      assert.equal(first.theme, second.theme, 'a paired column must share its theme')
      assert.deepEqual([first.state, second.state], ['before', 'after'], 'each before column must sit immediately beside its after column')
    }
  })

  it('resolves every cell to a shot, an unshootable reason, or a missing marker', () => {
    const { plan } = buildPlan(corpus)
    const cellsCase = /** @type {Record<string, unknown>[]} */ (corpus.cases).find((entry) => entry.check === 'cells')
    assert.ok(cellsCase, 'the cells case must exist')
    for (const expected of /** @type {Record<string, unknown>[]} */ (cellsCase.expectedCells)) {
      const cell = findCell(plan, 'sheet-alpha', String(expected.row), String(expected.kind), String(expected.column))
      assert.equal(cell.status, expected.status, `${String(expected.row)} at ${String(expected.column)} must resolve to ${String(expected.status)}`)
      if (expected.status === 'unshootable') assert.equal(cell.reason, expected.reason, 'an unshootable cell must carry its explicit reason')
      if (expected.status === 'shot') assert.ok(typeof cell.file === 'string' && cell.file.length > 0, 'a shot cell must name its file')
      if (expected.status === 'missing') assert.equal(cell.reason, null, 'a missing cell must carry no reason')
    }
  })

  it('escapes markup in a rendered sheet document', () => {
    const escapingCase = /** @type {Record<string, unknown>[]} */ (corpus.cases).find((entry) => entry.check === 'escaping')
    assert.ok(escapingCase, 'the escaping case must exist')
    const { plan, images } = buildPlan(corpus, String(escapingCase.reason))
    const html = renderSheetDocument(plan, 'sheet-alpha', images, 'alpha sheet')
    for (const fragment of /** @type {string[]} */ (escapingCase.expectedFragments)) {
      assert.ok(html.includes(fragment), `the rendered sheet must contain the escaped fragment ${JSON.stringify(fragment)}`)
    }
    for (const forbidden of /** @type {string[]} */ (escapingCase.mustNotContain)) {
      assert.ok(!html.includes(forbidden), `the rendered sheet must not contain ${JSON.stringify(forbidden)}`)
    }
    assert.ok(html.includes('unshootable'), 'an unshootable cell must render its neutral marker')
  })

  it('fails closed when a shot cell has no image', () => {
    const renderCase = /** @type {Record<string, unknown>[]} */ (corpus.cases).find((entry) => entry.check === 'render')
    assert.ok(renderCase, 'the render case must exist')
    const { plan } = buildPlan(corpus)
    let message = null
    try {
      renderSheetDocument(plan, 'sheet-alpha', {}, 'alpha sheet')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, 'a shot cell without an image must fail instead of rendering blank')
    for (const fragment of /** @type {string[]} */ (renderCase.expectedDiagnostic)) {
      assert.ok(message.includes(fragment), `the render diagnostic must contain ${JSON.stringify(fragment)}; got ${message}`)
    }
  })

  it('fails closed on a duplicate record scope and an uncovered record target', () => {
    const matrix = /** @type {Record<string, unknown>} */ (corpus.matrix)
    const baseRecords = /** @type {Record<string, unknown>[]} */ (corpus.records).map((spec) => toRecord(matrix, spec))
    for (const entry of /** @type {Record<string, unknown>[]} */ (corpus.cases)) {
      if (entry.check !== 'plan') continue
      let message = null
      try {
        const records = structuredClone(baseRecords)
        if (entry.mutation === 'duplicate-record') {
          records.push(structuredClone(baseRecords[0]))
        } else {
          const targets = /** @type {Record<string, unknown>[]} */ (records[0].targets)
          targets.push({ target: 'rogue', kind: 'probe', selector: '.rogue', read: null, contrast: null, shot: { file: 'shots/rogue.png', sha256: artifactDigest('rogue') }, unshootable: null })
        }
        planSheets({ cases: matrix, records })
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${String(entry.name)}: a bad record set passed the plan instead of failing`)
      for (const fragment of /** @type {string[]} */ (entry.expectedDiagnostic)) {
        assert.ok(message.includes(fragment), `${String(entry.name)}: diagnostic is missing ${JSON.stringify(fragment)}; got ${message}`)
      }
    }
  })

  it('fails every named corpus mutation for its intended field', () => {
    const cases = /** @type {Record<string, unknown>[]} */ (corpus.cases)
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          loadSingleDocument(`${readSource(CORPUS).trimEnd()}\n---\norphan: true\n`, CORPUS)
        } else {
          const mutated = structuredClone(cases)
          applyMutation(mutated, mutation)
          validateFamilyShape({ ...corpus, cases: mutated }, CORPUS)
          checkRequiredNames(mutated.map((entry) => String(entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${String(mutation.name)}: mutated input passed validation instead of failing`)
      assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${String(mutation.name)}: diagnostic names the wrong field; got ${message}`)
      assert.ok(message.includes('at path'), `${String(mutation.name)}: diagnostic is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `${String(mutation.name)}: diagnostic is missing repair guidance: ${message}`)
    }
  })
})

describe('capture sheet manifest', () => {
  const corpus = readFamily(CORPUS)

  it('validates a manifest that names both run ids and every sheet digest', () => {
    const { plan } = buildPlan(corpus)
    const manifest = validateSheetManifest({
      version: 1,
      order: DEFAULT_SHEET_ORDER,
      runIds: [{ state: 'before', runId: 'capture-before' }, { state: 'after', runId: 'capture-after' }],
      sheets: [{ id: 'sheet-alpha', surface: 'alpha', file: 'sheets/sheet-alpha.png', sha256: artifactDigest('sheet-bytes') }],
    }, 'manifest')
    assert.equal(manifest.sheets.length, 1, 'the manifest must name the composed sheet')
    assert.deepEqual(Object.keys(plan.sheets[0]), ['id', 'surface', 'file', 'rows'], 'a planned sheet must carry exactly id, surface, file, and rows')
    assertSheetManifestMatchesPlan(plan, manifest, 'manifest')
  })

  it('fails manifest mismatches with actionable diagnostics', () => {
    const manifestCase = /** @type {Record<string, unknown>[]} */ (corpus.cases).find((entry) => entry.check === 'manifest')
    assert.ok(manifestCase, 'the manifest case must exist')
    const fragments = /** @type {Record<string, string[]>} */ (manifestCase.expectedDiagnostic)
    const { plan } = buildPlan(corpus)
    const good = {
      version: 1,
      order: DEFAULT_SHEET_ORDER,
      runIds: [{ state: 'before', runId: 'capture-before' }, { state: 'after', runId: 'capture-after' }],
      sheets: plan.sheets.map((sheet) => ({ id: sheet.id, surface: sheet.surface, file: sheet.file, sha256: artifactDigest(sheet.file) })),
    }
    assertSheetManifestMatchesPlan(plan, good, 'manifest')
    /** @param {() => unknown} run @param {string[]} expected @param {string} name */
    const expectFailure = (run, expected, name) => {
      let message = null
      try {
        run()
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${name}: mismatched manifest passed instead of failing`)
      for (const fragment of expected) assert.ok(message.includes(fragment), `${name}: diagnostic is missing ${JSON.stringify(fragment)}; got ${message}`)
    }
    expectFailure(
      () => assertSheetManifestMatchesPlan(plan, { ...good, sheets: [{ id: 'sheet-other', surface: 'other', file: 'sheets/sheet-other.png', sha256: artifactDigest('other') }] }, 'manifest'),
      fragments.inventory,
      'inventory',
    )
    expectFailure(
      () => assertSheetManifestMatchesPlan(plan, { ...good, runIds: [{ state: 'after', runId: 'capture-after' }, { state: 'before', runId: 'capture-before' }] }, 'manifest'),
      fragments.stateOrder,
      'state-order',
    )
    expectFailure(
      () => assertSheetManifestMatchesPlan(plan, { ...good, order: 'state-theme-width' }, 'manifest'),
      fragments.order,
      'order',
    )
  })
})

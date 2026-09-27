#!/usr/bin/env node
// @ts-check

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { loadSingleDocument } from './fairtest-single-document.mjs'
import { fairtestRelative } from './fairtest/fairtest-paths.mjs'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const CORPUS_REL = fairtestRelative('promotionCorpus')
const MANIFEST_REL = fairtestRelative('promotionManifest')

const ANSWER_FIELDS = ['subject', 'necessity', 'productionPath', 'cost', 'lifetime', 'concurrency', 'ciParity', 'evidence', 'mutation', 'exitCondition']
const RECORD_FIELDS = ['name', 'answers', 'lowerLayer', 'decision', 'executionPolicy', 'exitCondition']
const LOWER_LAYER_RESULTS = ['promote', 'retain']
const DECISION_VERDICTS = ['approve', 'reject']
const MUTATION_KINDS = ['delete-field', 'blank-field', 'rename-field', 'unknown-field', 'bad-enum', 'duplicate-name', 'delete-record', 'trailing-document']

/**
 * @typedef {{ name: string, kind: string, target: string, expectedField: string, field?: string, newField?: string, value?: string, style?: string }} PromotionMutation
 * @typedef {{ name: string, answers: Record<string, string>, lowerLayer: { result: string, detail: string }, decision: { verdict: string, rationale: string }, executionPolicy: Record<string, string>, exitCondition: string }} PromotionRecord
 * @typedef {{ records: PromotionRecord[] }} PromotionCorpus
 * @typedef {{ expectedRecordCount: number, requiredRecordNames: string[], expectedMutationCount: number, requiredMutationNames: string[], mutations: PromotionMutation[] }} PromotionManifest
 */

const corpusSource = readFileSync(resolve(ROOT, CORPUS_REL), 'utf8')
const manifestSource = readFileSync(resolve(ROOT, MANIFEST_REL), 'utf8')
const manifest = /** @type {PromotionManifest} */ (loadSingleDocument(manifestSource, MANIFEST_REL))
validateManifest(manifest)
const corpus = /** @type {PromotionCorpus} */ (loadSingleDocument(corpusSource, CORPUS_REL))
validateRecords(corpus, CORPUS_REL)
checkRequiredNames(corpus.records.map((record) => record.name), manifest.requiredRecordNames, CORPUS_REL)
// A legal leading `---` start marker is still exactly one document.
loadSingleDocument(`---\n${corpusSource}`, CORPUS_REL)
runMutations(corpusSource, corpus, manifest)

console.log(`promotion records: all ${corpus.records.length} named records passed and all ${manifest.mutations.length} named mutations failed for their intended field.`)

/** @param {string} source @param {PromotionCorpus} parsed @param {PromotionManifest} manifestValue */
function runMutations(source, parsed, manifestValue) {
  for (const mutation of manifestValue.mutations) {
    let message = null
    try {
      if (mutation.kind === 'trailing-document') {
        const trailing = mutation.style === 'end-marker'
          ? `${source.trimEnd()}\n...\n---\norphan: true\n`
          : `${source.trimEnd()}\n---\norphan: true\n`
        loadSingleDocument(trailing, CORPUS_REL)
      } else {
        const records = structuredClone(parsed.records)
        applyMutation(records, mutation)
        validateRecords({ records }, CORPUS_REL)
        checkRequiredNames(records.map((record) => record.name), manifestValue.requiredRecordNames, CORPUS_REL)
      }
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, `${mutation.name}: mutated input passed validation instead of failing`)
    assert.ok(message.includes(mutation.expectedField), `${mutation.name}: diagnostic names the wrong field; expected ${mutation.expectedField}, received ${message}`)
    assert.ok(message.includes('at path'), `${mutation.name}: diagnostic is missing path context: ${message}`)
    assert.ok(message.includes('repair:'), `${mutation.name}: diagnostic is missing repair guidance: ${message}`)
  }
}

/** @param {PromotionRecord[]} records @param {PromotionMutation} mutation */
function applyMutation(records, mutation) {
  if (mutation.kind === 'duplicate-name') {
    const donor = records.find((record) => record.name !== mutation.target) ?? records[0]
    const copy = structuredClone(donor)
    copy.name = mutation.target
    records.push(copy)
    return
  }
  if (mutation.kind === 'delete-record') {
    const index = records.findIndex((record) => record.name === mutation.target)
    assert.notEqual(index, -1, `${mutation.name}: unknown mutation target ${mutation.target}`)
    records.splice(index, 1)
    return
  }
  const record = records.find((item) => item.name === mutation.target)
  assert.ok(record, `${mutation.name}: unknown mutation target ${mutation.target}`)
  const segments = /** @type {string} */ (mutation.field).split('.')
  if (mutation.kind === 'delete-field') {
    deletePath(record, segments, mutation)
    return
  }
  if (mutation.kind === 'blank-field') {
    setPath(record, segments, '   ', mutation)
    return
  }
  if (mutation.kind === 'rename-field') {
    const value = getPath(record, segments, mutation)
    deletePath(record, segments, mutation)
    setPath(record, /** @type {string} */ (mutation.newField).split('.'), value, mutation)
    return
  }
  if (mutation.kind === 'unknown-field' || mutation.kind === 'bad-enum') {
    setPath(record, segments, mutation.value, mutation)
    return
  }
  throw new Error(`${mutation.name}: unsupported mutation kind ${mutation.kind}`)
}

/** @param {PromotionManifest} value */
function validateManifest(value) {
  checkKeys(value, ['expectedRecordCount', 'requiredRecordNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'manifest', MANIFEST_REL)
  assert.equal(value.expectedRecordCount, 7, 'manifest: expectedRecordCount guard')
  assert.equal(value.expectedMutationCount, 13, 'manifest: expectedMutationCount guard')
  assert.deepEqual([...value.requiredRecordNames].sort(), ['example-browser-free-boundary', 'example-mounted-component-proof', 'example-mounted-product-proof', 'fairtest-path-resolution-guard', 'fairtest-raw-path-literal-guard', 'fairtest-target-dispatch-guard', 'fairtest-type-program-coverage-guard'], 'manifest: required record inventory')
  assert.equal(value.mutations.length, value.expectedMutationCount, 'manifest: mutation inventory count')
  checkRequiredNames(value.mutations.map((item) => item.name), value.requiredMutationNames, MANIFEST_REL)
  for (const [index, mutation] of value.mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'blank-field'].includes(mutation.kind)) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-enum'].includes(mutation.kind)) fields.push('field', 'value')
    if (mutation.kind === 'trailing-document' && mutation.style !== undefined) fields.push('style')
    checkKeys(mutation, fields, `manifest mutation ${index}`, MANIFEST_REL)
    assert.ok(MUTATION_KINDS.includes(mutation.kind), `manifest mutation ${index}: unknown kind ${mutation.kind}`)
    assert.ok(typeof mutation.expectedField === 'string' && mutation.expectedField.length, `manifest mutation ${index}: expectedField must name the intended field`)
    if (mutation.kind === 'trailing-document') {
      assert.equal(mutation.target, 'document', `manifest mutation ${index}: trailing-document targets the document`)
      if (mutation.style !== undefined) {
        assert.equal(mutation.style, 'end-marker', `manifest mutation ${index}: unknown trailing style ${mutation.style}`)
      }
    } else {
      assert.ok(value.requiredRecordNames.includes(mutation.target), `manifest mutation ${index}: unknown target ${mutation.target}`)
    }
  }
}

/** @param {PromotionCorpus} value @param {string} label */
function validateRecords(value, label) {
  checkKeys(value, ['records'], 'document', label)
  assert.ok(Array.isArray(value.records) && value.records.length, `${label}: document holds no promotion records at path records; repair: restore the named records list in ${CORPUS_REL}.`)
  const seen = new Set()
  for (const [index, record] of value.records.entries()) {
    const path = `records[${index}]`
    checkKeys(record, RECORD_FIELDS, `record ${index}`, label, path)
    checkText(record.name, `record ${index}`, 'name', `${path}.name`, 'use the required record name from the manifest')
    if (seen.has(record.name)) fail(`document: duplicate record name "${record.name}" at path ${path}.name; repair: give every record a unique required name and update the manifest inventory.`)
    seen.add(record.name)
    const tag = `record "${record.name}"`
    checkKeys(record.answers, ANSWER_FIELDS.map((field) => field), tag, label, `${path}.answers`, 'answers')
    for (const field of ANSWER_FIELDS) {
      checkText(record.answers[field], tag, `answers.${field}`, `${path}.answers.${field}`, `restore the "${field}" answer to the ten-question checklist`)
    }
    checkKeys(record.lowerLayer, ['result', 'detail'], tag, label, `${path}.lowerLayer`, 'lowerLayer')
    if (!LOWER_LAYER_RESULTS.includes(record.lowerLayer.result)) {
      fail(`${tag}: invalid value ${JSON.stringify(record.lowerLayer.result)} for field "lowerLayer.result" at path ${path}.lowerLayer.result; repair: use one of ${LOWER_LAYER_RESULTS.join(', ')}.`)
    }
    checkText(record.lowerLayer.detail, tag, 'lowerLayer.detail', `${path}.lowerLayer.detail`, 'name the lower-layer check and its outcome')
    checkKeys(record.decision, ['verdict', 'rationale'], tag, label, `${path}.decision`, 'decision')
    if (!DECISION_VERDICTS.includes(record.decision.verdict)) {
      fail(`${tag}: invalid value ${JSON.stringify(record.decision.verdict)} for field "decision.verdict" at path ${path}.decision.verdict; repair: use one of ${DECISION_VERDICTS.join(', ')}.`)
    }
    checkText(record.decision.rationale, tag, 'decision.rationale', `${path}.decision.rationale`, 'state why the elaborate test is approved or refused')
    checkKeys(record.executionPolicy, ['runner', 'budget', 'cleanup'], tag, label, `${path}.executionPolicy`, 'executionPolicy')
    for (const field of ['runner', 'budget', 'cleanup']) {
      checkText(record.executionPolicy[field], tag, `executionPolicy.${field}`, `${path}.executionPolicy.${field}`, `restore the "${field}" execution policy`)
    }
    checkText(record.exitCondition, tag, 'exitCondition', `${path}.exitCondition`, 'state the simplification or deletion trigger')
  }
}

/** @param {unknown} value @param {string[]} fields @param {string} tag @param {string} label @param {string} [path] @param {string} [prefix] */
function checkKeys(value, fields, tag, label, path = '', prefix = '') {
  const where = path ? ` at path ${path}` : ''
  const named = prefix ? `${prefix} ` : ''
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${tag}: ${named}object is missing or malformed${where} in ${label}; repair: restore the ${named}object with exactly: ${fields.join(', ')}.`)
  }
  /** @param {string} field @returns {string} */
  const dotted = (field) => (prefix ? `${prefix}.${field}` : field)
  for (const field of fields) {
    if (!(field in value)) fail(`${tag}: missing required field "${dotted(field)}"${where}; repair: restore "${dotted(field)}" in ${label}.`)
  }
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) fail(`${tag}: unknown field "${dotted(key)}"${where}; repair: remove "${dotted(key)}" from ${label}.`)
  }
}

/** @param {unknown} value @param {string} tag @param {string} field @param {string} path @param {string} repair */
function checkText(value, tag, field, path, repair) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${tag}: missing or invalid field "${field}" at path ${path}; repair: ${repair}.`)
  }
}

/** @param {string[]} actual @param {string[]} required @param {string} label */
function checkRequiredNames(actual, required, label) {
  assert.equal(new Set(actual).size, actual.length, `${label}: record names unique`)
  assert.equal(new Set(required).size, required.length, `${label}: required names unique`)
  for (const name of required) {
    if (!actual.includes(name)) fail(`document: required record inventory mismatch at path records in ${label}; missing required record "${name}"; repair: restore the "${name}" record or update the manifest required names.`)
  }
  for (const name of actual) {
    if (!required.includes(name)) fail(`document: required record inventory mismatch at path records in ${label}; unknown record "${name}"; repair: remove the "${name}" record or register it in the manifest required names.`)
  }
}

/** @param {Record<string, unknown>} root @param {string[]} segments @param {PromotionMutation} mutation @returns {unknown} */
function getPath(root, segments, mutation) {
  let node = root
  for (const segment of segments) {
    if (!node || typeof node !== 'object' || !(segment in node)) {
      throw new Error(`${mutation.name}: mutation field ${mutation.field} is absent from ${mutation.target}`)
    }
    node = /** @type {Record<string, unknown>} */ (node[segment])
  }
  return node
}

/** @param {Record<string, unknown>} root @param {string[]} segments @param {unknown} value @param {PromotionMutation} mutation */
function setPath(root, segments, value, mutation) {
  let node = root
  for (const segment of segments.slice(0, -1)) {
    if (!node[segment] || typeof node[segment] !== 'object') node[segment] = {}
    node = /** @type {Record<string, unknown>} */ (node[segment])
  }
  node[segments[segments.length - 1]] = value
}

/** @param {Record<string, unknown>} root @param {string[]} segments @param {PromotionMutation} mutation */
function deletePath(root, segments, mutation) {
  const parent = segments.length === 1 ? root : getPath(root, segments.slice(0, -1), mutation)
  delete /** @type {Record<string, unknown>} */ (parent)[segments[segments.length - 1]]
}

/** @param {string} message @returns {never} */
function fail(message) {
  throw new Error(message)
}

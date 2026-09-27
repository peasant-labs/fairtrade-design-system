#!/usr/bin/env node
// @ts-check

// Fairtest path-owner guard.
//
// Two guards keep scripts/fairtest/fairtest-paths.mjs the single owner of the
// repo-relative locations the harness names:
//
//   1. the raw-literal path guard walks every module under scripts/fairtest/
//      and the Fairtest root guards, and refuses a bare string literal that
//      equals a declared root or a repo-relative path under one, outside the
//      owner. Test modules are covered too, except the fixture carriers the
//      owner declares in FAIRTEST_FIXTURE_TEST_MODULES. The scanner lexes the
//      module so a path mentioned inside a comment is not a bare literal, and
//      it treats a substitution-free template as its text, so a path cannot
//      hide behind a backtick either; a new hardcoded path under a declared
//      root is caught.
//   2. the path-resolution guard proves every declared location resolves to an
//      absolute path inside FAIRTEST_REPO_ROOT, and that traversal, absolute,
//      empty, dot-segment, windows, and unknown-name inputs are refused with
//      the repository's path-context repair idiom.
//
// Every literal case, resolution case, and mutation lives in
// scripts/testdata/fairtest-paths.yaml plus its required-name manifest; this
// file owns no case data. Browser-free: node builtins plus the declared yaml
// developer dependency only. The three named mutations are behavioural: one
// plants a raw literal in a scratch module, one plants the same literal in a
// scratch test module to prove test modules are scanned, and the third feeds an
// escaping candidate to the resolver.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative as relativePath, resolve, sep } from 'node:path'
import { loadSingleDocument } from '../fairtest-single-document.mjs'
import { FAIRTEST_REPO_ROOT } from './fairtest-runtime.mjs'
import {
  FAIRTEST_FIXTURE_TEST_MODULES,
  FAIRTEST_PATHS,
  FAIRTEST_PATH_ROOTS,
  assertFairtestPathInside,
  fairtestPath,
  fairtestRelative,
  resolveFairtestRepoPath,
} from './fairtest-paths.mjs'

const HARNESS_DIR = join(FAIRTEST_REPO_ROOT, 'scripts', 'fairtest')
const OWNER_MODULE = 'fairtest-paths.mjs'
const GUARD_MODULE = 'assert-fairtest-paths.mjs'
const OWNED_MODULES = [OWNER_MODULE, GUARD_MODULE]
const ROOT_GUARDS = [
  join(FAIRTEST_REPO_ROOT, 'scripts', 'assert-fairtest-boundary.mjs'),
  join(FAIRTEST_REPO_ROOT, 'scripts', 'fairtest-runner-inventory.mjs'),
  join(FAIRTEST_REPO_ROOT, 'scripts', 'fairtest-surface-manifest.mjs'),
  join(FAIRTEST_REPO_ROOT, 'scripts', 'fairtest-source.mjs'),
]
const CORPUS_REL = fairtestRelative('pathsCorpus')
const MANIFEST_REL = fairtestRelative('pathsManifest')
const LITERAL_EXPECT = ['detected', 'clean']
const RESOLUTION_OPERATIONS = ['resolve-name', 'resolve-candidate']
const RESOLUTION_EXPECT = ['inside', 'refused']
const MUTATION_KINDS = ['plant-raw-literal', 'plant-test-literal', 'plant-escape']

/**
 * @typedef {object} LiteralCase
 * @property {string} name
 * @property {string} source
 * @property {string} expect
 * @property {string} expectedLiteral
 */

/**
 * @typedef {object} ResolutionCase
 * @property {string} name
 * @property {string} operation
 * @property {string} target
 * @property {string} expect
 * @property {string} expectedDiagnostic
 */

/**
 * @typedef {object} PathsCorpus
 * @property {LiteralCase[]} literalCases
 * @property {ResolutionCase[]} resolutionCases
 */

/**
 * @typedef {object} PathsMutation
 * @property {string} name
 * @property {string} kind
 * @property {string} [literal]
 * @property {string} [candidate]
 * @property {string} expectedDiagnostic
 */

/**
 * @typedef {object} PathsManifest
 * @property {number} expectedLiteralCaseCount
 * @property {string[]} requiredLiteralCaseNames
 * @property {number} expectedResolutionCaseCount
 * @property {string[]} requiredResolutionCaseNames
 * @property {number} expectedMutationCount
 * @property {string[]} requiredMutationNames
 * @property {PathsMutation[]} mutations
 */

/**
 * @typedef {object} StringLiteral
 * @property {number} line
 * @property {string} value
 */

/**
 * Find every string literal in a module source. The scanner tracks code,
 * comments, and template literals (including nested `${...}` expressions), so
 * a path named inside a comment is not returned. A substitution-free template
 * is treated as its text: `` `scripts/testdata/x.yaml` `` is one literal just
 * like `'scripts/testdata/x.yaml'`, so a path cannot hide behind a backtick. A
 * template that carries a substitution keeps its text opaque and only its
 * `${...}` expressions are scanned as code.
 * @param {string} source module source
 * @returns {StringLiteral[]} the string literals in source order
 */
export function findStringLiterals(source) {
  /** @type {StringLiteral[]} */
  const found = []
  let index = 0
  let line = 1
  const length = source.length
  /** @type {Array<{ kind: 'code', braces: number } | { kind: 'template', text: string, substituted: boolean, startLine: number }>} */
  const contexts = [{ kind: 'code', braces: 0 }]
  while (index < length) {
    const character = source[index]
    const top = contexts[contexts.length - 1]
    if (top.kind === 'template') {
      if (character === '\\') { top.text += source[index + 1] ?? ''; index += 2; continue }
      if (character === '\n') { line += 1; top.text += '\n'; index += 1; continue }
      if (character === '`') {
        contexts.pop()
        if (!top.substituted) found.push({ line: top.startLine, value: top.text })
        index += 1
        continue
      }
      if (character === '$' && source[index + 1] === '{') {
        top.substituted = true
        contexts.push({ kind: 'code', braces: 0 })
        index += 2
        continue
      }
      top.text += character
      index += 1
      continue
    }
    if (character === '\n') { line += 1; index += 1; continue }
    if (character === '/' && source[index + 1] === '/') {
      while (index < length && source[index] !== '\n') index += 1
      continue
    }
    if (character === '/' && source[index + 1] === '*') {
      index += 2
      while (index < length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') line += 1
        index += 1
      }
      index += 2
      continue
    }
    if (character === "'" || character === '"') {
      const startLine = line
      let value = ''
      index += 1
      while (index < length) {
        const inner = source[index]
        if (inner === '\\') { value += source[index + 1] ?? ''; index += 2; continue }
        if (inner === character) { index += 1; break }
        if (inner === '\n') line += 1
        value += inner
        index += 1
      }
      found.push({ line: startLine, value })
      continue
    }
    if (character === '`') { contexts.push({ kind: 'template', text: '', substituted: false, startLine: line }); index += 1; continue }
    if (character === '{') { top.braces += 1; index += 1; continue }
    if (character === '}') {
      if (top.braces > 0) top.braces -= 1
      else if (contexts.length > 1) contexts.pop()
      index += 1
      continue
    }
    index += 1
  }
  return found
}

/**
 * Report whether a literal value is a raw inventory path literal: a declared
 * root, or a repo-relative path under one.
 * @param {string} value
 * @returns {boolean}
 */
export function isInventoryPathLiteral(value) {
  return FAIRTEST_PATH_ROOTS.some((root) => value === root || value.startsWith(`${root}/`))
}

/**
 * Return every raw inventory path literal in a module source.
 * @param {string} source module source
 * @returns {StringLiteral[]} the offending literals
 */
export function findRawPathLiterals(source) {
  return findStringLiterals(source).filter((entry) => isInventoryPathLiteral(entry.value))
}

/**
 * Assert none of the named files carries a raw inventory path literal outside
 * the owner. `*.test.mjs` and `*.type-test.mjs` modules are scanned too, so a
 * new test that hardcodes a location under a declared root fails here; the only
 * exempt test modules are the fixture carriers the owner declares in
 * FAIRTEST_FIXTURE_TEST_MODULES.
 * @param {string[]} files absolute module paths
 * @returns {number} the number of modules scanned
 */
export function assertNoRawPathLiteralsIn(files) {
  /** @type {string[]} */
  const violations = []
  let scanned = 0
  for (const file of files) {
    const name = basename(file)
    if (OWNED_MODULES.includes(name)) continue
    if (FAIRTEST_FIXTURE_TEST_MODULES.includes(name)) continue
    scanned += 1
    for (const hit of findRawPathLiterals(readFileSync(file, 'utf8'))) {
      violations.push(`${relativePath(FAIRTEST_REPO_ROOT, file).split(sep).join('/')}:${hit.line} ${JSON.stringify(hit.value)}`)
    }
  }
  if (violations.length > 0) {
    throw new Error(
      'fairtest paths: raw inventory path literal outside scripts/fairtest/fairtest-paths.mjs for field "path" at path path-literal; ' +
      `${violations.join('; ')}; ` +
      'repair: read the location from fairtest-paths.mjs instead of spelling the path.',
    )
  }
  return scanned
}

/**
 * Assert no module under a directory carries a raw inventory path literal
 * outside the owner.
 * @param {string} directory absolute directory
 * @returns {number} the number of modules scanned
 */
export function assertNoRawPathLiterals(directory) {
  return assertNoRawPathLiteralsIn(walkModules(directory))
}

/**
 * Every `.mjs` module under a directory, recursively, sorted.
 * @param {string} directory absolute directory
 * @returns {string[]} absolute module paths
 */
function walkModules(directory) {
  /** @type {string[]} */
  const found = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...walkModules(absolute))
    else if (entry.isFile() && entry.name.endsWith('.mjs')) found.push(absolute)
  }
  return found.sort()
}

const corpusSource = readFileSync(resolve(FAIRTEST_REPO_ROOT, CORPUS_REL), 'utf8')
const manifestSource = readFileSync(resolve(FAIRTEST_REPO_ROOT, MANIFEST_REL), 'utf8')
const manifest = /** @type {PathsManifest} */ (loadSingleDocument(manifestSource, MANIFEST_REL))
const corpus = validateCorpus(loadSingleDocument(corpusSource, CORPUS_REL), CORPUS_REL)
validateManifest(manifest)
checkRequiredNames(corpus.literalCases.map((entry) => entry.name), manifest.requiredLiteralCaseNames, CORPUS_REL, 'literal case')
checkRequiredNames(corpus.resolutionCases.map((entry) => entry.name), manifest.requiredResolutionCaseNames, CORPUS_REL, 'resolution case')
// A legal leading `---` start marker is still exactly one document.
loadSingleDocument(`---\n${corpusSource}`, CORPUS_REL)

const scanned = assertNoRawPathLiteralsIn([...walkModules(HARNESS_DIR), ...ROOT_GUARDS])
assertDeclaredLocationsInside()
runLiteralCases(corpus)
runResolutionCases(corpus)
runMutations(manifest)

console.log(
  `fairtest paths: ${scanned} modules scanned with no raw inventory path literal, ` +
  `${Object.keys(FAIRTEST_PATHS).length} declared locations resolved inside the repository root, ` +
  `${corpus.literalCases.length} literal cases and ${corpus.resolutionCases.length} resolution cases behaved, ` +
  `all ${manifest.mutations.length} named mutations failed for their intended reason.`,
)

/**
 * Guard B over the whole inventory: every declared location resolves to an
 * absolute path inside the repository root.
 */
function assertDeclaredLocationsInside() {
  for (const name of Object.keys(FAIRTEST_PATHS)) {
    const resolved = fairtestPath(name)
    assertFairtestPathInside(resolved, `fairtestPaths.${name}`)
    assert.ok(isAbsolute(resolved), `${CORPUS_REL}: declared location "${name}" did not resolve to an absolute path; got ${JSON.stringify(resolved)}`)
  }
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {PathsCorpus}
 */
function validateCorpus(value, label) {
  checkKeys(value, ['literalCases', 'resolutionCases'], 'document', label)
  const corpus = /** @type {PathsCorpus} */ (value)
  assert.ok(Array.isArray(corpus.literalCases) && corpus.literalCases.length > 0, `${label}: document holds no literal cases at path literalCases; repair: restore the named literal case list in ${label}.`)
  assert.ok(Array.isArray(corpus.resolutionCases) && corpus.resolutionCases.length > 0, `${label}: document holds no resolution cases at path resolutionCases; repair: restore the named resolution case list in ${label}.`)
  for (const [index, entry] of corpus.literalCases.entries()) {
    const path = `literalCases[${index}]`
    checkKeys(entry, ['name', 'source', 'expect', 'expectedLiteral'], `literal case ${index}`, label, path)
    checkText(entry.name, `literal case ${index}`, 'name', `${path}.name`, 'use the required literal case name from the manifest')
    checkText(entry.source, `literal case "${entry.name}"`, 'source', `${path}.source`, 'restore the module source snippet this case scans')
    if (!LITERAL_EXPECT.includes(entry.expect)) {
      fail(`${label}: invalid value ${JSON.stringify(entry.expect)} for field "expect" at path ${path}.expect; repair: use one of ${LITERAL_EXPECT.join(', ')}.`)
    }
    if (entry.expect === 'detected') {
      checkText(entry.expectedLiteral, `literal case "${entry.name}"`, 'expectedLiteral', `${path}.expectedLiteral`, 'name the literal the scanner must report')
    }
  }
  for (const [index, entry] of corpus.resolutionCases.entries()) {
    const path = `resolutionCases[${index}]`
    checkKeys(entry, ['name', 'operation', 'target', 'expect', 'expectedDiagnostic'], `resolution case ${index}`, label, path)
    checkText(entry.name, `resolution case ${index}`, 'name', `${path}.name`, 'use the required resolution case name from the manifest')
    if (!RESOLUTION_OPERATIONS.includes(entry.operation)) {
      fail(`${label}: invalid value ${JSON.stringify(entry.operation)} for field "operation" at path ${path}.operation; repair: use one of ${RESOLUTION_OPERATIONS.join(', ')}.`)
    }
    if (!RESOLUTION_EXPECT.includes(entry.expect)) {
      fail(`${label}: invalid value ${JSON.stringify(entry.expect)} for field "expect" at path ${path}.expect; repair: use one of ${RESOLUTION_EXPECT.join(', ')}.`)
    }
    if (entry.expect === 'refused') {
      checkText(entry.expectedDiagnostic, `resolution case "${entry.name}"`, 'expectedDiagnostic', `${path}.expectedDiagnostic`, 'name the diagnostic fragment the refusal must carry')
    }
  }
  return corpus
}

/**
 * @param {PathsManifest} value
 */
function validateManifest(value) {
  checkKeys(value, ['expectedLiteralCaseCount', 'requiredLiteralCaseNames', 'expectedResolutionCaseCount', 'requiredResolutionCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'manifest', MANIFEST_REL)
  assert.equal(value.expectedLiteralCaseCount, value.requiredLiteralCaseNames.length, `${MANIFEST_REL}: expectedLiteralCaseCount must equal requiredLiteralCaseNames.length`)
  assert.equal(value.expectedResolutionCaseCount, value.requiredResolutionCaseNames.length, `${MANIFEST_REL}: expectedResolutionCaseCount must equal requiredResolutionCaseNames.length`)
  assert.equal(value.expectedMutationCount, value.requiredMutationNames.length, `${MANIFEST_REL}: expectedMutationCount must equal requiredMutationNames.length`)
  assert.equal(value.expectedMutationCount, value.mutations.length, `${MANIFEST_REL}: mutation count must equal expectedMutationCount`)
  for (const [index, mutation] of value.mutations.entries()) {
    const fields = ['name', 'kind', 'expectedDiagnostic']
    if (mutation.kind === 'plant-raw-literal' || mutation.kind === 'plant-test-literal') fields.push('literal')
    if (mutation.kind === 'plant-escape') fields.push('candidate')
    checkKeys(mutation, fields, `manifest mutation ${index}`, MANIFEST_REL)
    if (!MUTATION_KINDS.includes(mutation.kind)) {
      fail(`${MANIFEST_REL}: unknown mutation kind ${JSON.stringify(mutation.kind)} at path manifest.mutations[${index}].kind; repair: use one of ${MUTATION_KINDS.join(', ')}.`)
    }
    if (mutation.kind === 'plant-raw-literal' || mutation.kind === 'plant-test-literal') {
      assert.equal(mutation.expectedDiagnostic, mutation.literal, `${MANIFEST_REL}: mutation ${mutation.name} expectedDiagnostic must equal the planted literal`)
    }
  }
}

/**
 * @param {PathsCorpus} corpus
 */
function runLiteralCases(corpus) {
  for (const entry of corpus.literalCases) {
    const hits = findRawPathLiterals(entry.source)
    if (entry.expect === 'detected') {
      assert.ok(hits.some((hit) => hit.value === entry.expectedLiteral), `${CORPUS_REL}: literal case "${entry.name}" did not report ${JSON.stringify(entry.expectedLiteral)}; got ${JSON.stringify(hits.map((hit) => hit.value))}`)
    } else {
      assert.equal(hits.length, 0, `${CORPUS_REL}: literal case "${entry.name}" is expected clean but reported ${JSON.stringify(hits.map((hit) => hit.value))}`)
    }
  }
}

/**
 * @param {PathsCorpus} corpus
 */
function runResolutionCases(corpus) {
  for (const entry of corpus.resolutionCases) {
    if (entry.expect === 'inside') {
      const resolved = entry.operation === 'resolve-name' ? fairtestPath(entry.target) : resolveFairtestRepoPath(entry.target)
      assertFairtestPathInside(resolved, `fairtestPaths.${entry.name}`)
      assert.ok(isAbsolute(resolved), `${CORPUS_REL}: resolution case "${entry.name}" did not resolve to an absolute path; got ${JSON.stringify(resolved)}`)
    } else {
      let message = null
      try {
        if (entry.operation === 'resolve-name') fairtestPath(entry.target)
        else resolveFairtestRepoPath(entry.target)
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${CORPUS_REL}: resolution case "${entry.name}" resolved instead of failing`)
      assert.ok(message.includes(entry.expectedDiagnostic), `${CORPUS_REL}: resolution case "${entry.name}" diagnostic does not name ${entry.expectedDiagnostic}; got ${message}`)
      assert.ok(message.includes('at path'), `${CORPUS_REL}: resolution case "${entry.name}" diagnostic is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `${CORPUS_REL}: resolution case "${entry.name}" diagnostic is missing repair guidance: ${message}`)
    }
  }
}

/**
 * @param {PathsManifest} manifestValue
 */
function runMutations(manifestValue) {
  for (const mutation of manifestValue.mutations) {
    let message = null
    try {
      if (mutation.kind === 'plant-raw-literal' || mutation.kind === 'plant-test-literal') {
        const directory = mkdtempSync(join(tmpdir(), 'fairtest-paths-literal-'))
        try {
          const file = mutation.kind === 'plant-test-literal' ? 'planted.test.mjs' : 'planted.mjs'
          writeFileSync(join(directory, file), `const DIST_ROOT = join(FAIRTEST_REPO_ROOT, '${mutation.literal}')\n`)
          assertNoRawPathLiterals(directory)
        } finally {
          rmSync(directory, { recursive: true, force: true })
        }
      } else {
        resolveFairtestRepoPath(/** @type {string} */ (mutation.candidate))
      }
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, `${mutation.name}: mutated input passed validation instead of failing`)
    assert.ok(message.includes(mutation.expectedDiagnostic), `${mutation.name}: diagnostic does not name ${mutation.expectedDiagnostic}; received ${message}`)
    assert.ok(message.includes('at path'), `${mutation.name}: diagnostic is missing path context: ${message}`)
    assert.ok(message.includes('repair:'), `${mutation.name}: diagnostic is missing repair guidance: ${message}`)
  }
}

/**
 * @param {unknown} value
 * @param {string[]} fields
 * @param {string} tag
 * @param {string} label
 * @param {string} [path]
 */
function checkKeys(value, fields, tag, label, path = '') {
  const where = path ? ` at path ${path}` : ''
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label}: ${tag}: object is missing or malformed${where}; repair: restore the object with exactly: ${fields.join(', ')}.`)
  }
  const record = /** @type {Record<string, unknown>} */ (value)
  for (const field of fields) {
    if (!(field in record)) fail(`${label}: ${tag}: missing required field "${field}"${where}; repair: restore "${field}".`)
  }
  for (const key of Object.keys(record)) {
    if (!fields.includes(key)) fail(`${label}: ${tag}: unknown field "${key}"${where}; repair: remove "${key}".`)
  }
}

/**
 * @param {unknown} value
 * @param {string} tag
 * @param {string} field
 * @param {string} path
 * @param {string} repair
 */
function checkText(value, tag, field, path, repair) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${CORPUS_REL}: ${tag}: missing or invalid field "${field}" at path ${path}; repair: ${repair}.`)
  }
}

/**
 * @param {string[]} actual
 * @param {string[]} required
 * @param {string} label
 * @param {string} noun
 */
function checkRequiredNames(actual, required, label, noun) {
  assert.ok(Array.isArray(required), `${label}: required ${noun} names must be a list`)
  for (const name of required) {
    if (!actual.includes(name)) fail(`${label}: required ${noun} inventory mismatch at path document; missing "${name}"; repair: restore the "${name}" ${noun} or update the manifest required names.`)
  }
  for (const name of actual) {
    if (!required.includes(name)) fail(`${label}: required ${noun} inventory mismatch at path document; unknown "${name}"; repair: register the "${name}" ${noun} in the manifest required names or remove it.`)
  }
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  throw new Error(message)
}

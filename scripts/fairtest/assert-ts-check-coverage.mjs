#!/usr/bin/env node
// @ts-check

// Fairtest type-program coverage guard.
//
// Proves the Fairtest type program (tsconfig.fairtest.json) cannot silently
// lose coverage or acquire an escape hatch:
//   1. every covered `.mjs` carries `// @ts-check` unless it is a byte-vendored
//      body, with an actionable diagnostic naming the file and the repair;
//   2. the vendored allowlist equals the set of files carrying the vendored
//      banner, by exact membership, so it can neither grow nor shrink;
//   3. the files this guard walks under the covered roots equal the files the
//      tsc program actually contains under those roots, compared against
//      `tsc --listFiles`, so a narrowed include glob cannot reduce coverage;
//   4. no covered file carries a refused suppression directive (named in the
//      corpus), and explicit-`any` type positions match the recorded
//      justification ledger in scripts/testdata/fairtest-ts-program.yaml.
//
// Every covered root, root script, vendored body, refused directive, mutation
// probe, acknowledged `any` count, and mutation lives in that corpus plus its
// required-name manifest; this file owns no case data and runs browser-free (node builtins, the pinned typescript, and
// the declared yaml developer dependency only).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative as relativePath, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSingleDocument } from '../fairtest-single-document.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CORPUS_REL = 'scripts/testdata/fairtest-ts-program.yaml'
const MANIFEST_REL = 'scripts/testdata/fairtest-ts-program.manifest.yaml'
const RULES = ['pragma', 'vendored', 'escape', 'program']
const MUTATION_KINDS = new Set([
  'remove-pragma',
  'add-vendored-banner',
  'remove-vendored-banner',
  'plant-directive',
  'plant-any',
  'drop-any-count',
  'drop-from-program',
])
const ANY_TAGS = /@(type|param|returns|typedef|template|extends|implements|satisfies|property)\b/g

/**
 * @typedef {object} AnyEntry
 * @property {string} file
 * @property {number} count
 */
/**
 * @typedef {object} Corpus
 * @property {string} compilerConfig
 * @property {string} pragmaMarker
 * @property {string[]} coveredRoots
 * @property {string[]} rootScripts
 * @property {string} vendoredMarker
 * @property {string[]} vendoredBodies
 * @property {string[]} refusedDirectives
 * @property {string} anyProbe
 * @property {AnyEntry[]} acknowledgedAny
 */
/**
 * @typedef {object} SourceFile
 * @property {string} path
 * @property {string} source
 */
/**
 * @typedef {object} Model
 * @property {SourceFile[]} files
 * @property {string[]} walk
 * @property {string[]} vendored
 * @property {string} pragmaMarker
 * @property {string} vendoredMarker
 * @property {string[]} refusedDirectives
 * @property {string} anyProbe
 * @property {Map<string, number>} anyLedger
 * @property {string[]} program
 */

/**
 * @typedef {object} Manifest
 * @property {number} expectedVendoredCount
 * @property {string[]} requiredVendoredBodies
 * @property {string[]} requiredCoveredRoots
 * @property {string[]} requiredRootScripts
 * @property {number} expectedAnyFileCount
 * @property {number} expectedAnyOccurrenceCount
 * @property {string[]} requiredAnyFiles
 * @property {number} expectedMutationCount
 * @property {string[]} requiredMutationNames
 * @property {Array<Record<string, unknown>>} mutations
 */

const corpusSource = readFileSync(resolve(ROOT, CORPUS_REL), 'utf8')
const manifestSource = readFileSync(resolve(ROOT, MANIFEST_REL), 'utf8')
const manifest = /** @type {Manifest} */ (loadSingleDocument(manifestSource, MANIFEST_REL))
const corpus = validateCorpus(loadSingleDocument(corpusSource, CORPUS_REL), CORPUS_REL)
validateManifest(manifest, corpus.refusedDirectives)
checkRequiredNames(corpus.coveredRoots, manifest.requiredCoveredRoots, CORPUS_REL, 'covered root')
checkRequiredNames(corpus.rootScripts, manifest.requiredRootScripts, CORPUS_REL, 'root script')
checkRequiredNames(corpus.vendoredBodies, manifest.requiredVendoredBodies, CORPUS_REL, 'vendored body')
checkRequiredNames(corpus.acknowledgedAny.map((entry) => entry.file), manifest.requiredAnyFiles, CORPUS_REL, 'acknowledged any file')
loadSingleDocument(`---\n${corpusSource}`, CORPUS_REL)

const model = buildModel(corpus)
checkVendored(model)
checkPragma(model)
checkEscapeHatches(model)
model.program = listProgramFiles(corpus, ROOT)
checkProgramParity(model)
runMutations(model, manifest)

console.log(
  `type-program coverage: ${model.walk.length} covered files walked, ${model.walk.length - model.vendored.length} checked with ${corpus.pragmaMarker}, ` +
    `${model.vendored.length} vendored bodies exempt, ${totalAcknowledgedAny(model)} acknowledged explicit-any positions across ${model.anyLedger.size} files, ` +
    `program parity exact, all ${manifest.mutations.length} named mutations failed for their intended reason.`,
)

export { validateCorpus, validateManifest }

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {Corpus}
 */
function validateCorpus(value, label) {
  checkKeys(value, ['compilerConfig', 'pragmaMarker', 'coveredRoots', 'rootScripts', 'vendoredMarker', 'vendoredBodies', 'refusedDirectives', 'anyProbe', 'acknowledgedAny'], 'corpus', label)
  const corpus = /** @type {Corpus} */ (value)
  checkText(corpus.compilerConfig, 'corpus', 'compilerConfig', 'document.compilerConfig', 'name the Fairtest tsconfig')
  checkText(corpus.pragmaMarker, 'corpus', 'pragmaMarker', 'document.pragmaMarker', 'name the per-file check pragma')
  checkText(corpus.vendoredMarker, 'corpus', 'vendoredMarker', 'document.vendoredMarker', 'name the vendored banner marker')
  checkText(corpus.anyProbe, 'corpus', 'anyProbe', 'document.anyProbe', 'name the explicit-any mutation probe')
  checkStringList(corpus.coveredRoots, 'corpus', 'coveredRoots', label)
  checkStringList(corpus.rootScripts, 'corpus', 'rootScripts', label)
  checkStringList(corpus.vendoredBodies, 'corpus', 'vendoredBodies', label)
  checkStringList(corpus.refusedDirectives, 'corpus', 'refusedDirectives', label)
  assert.ok(Array.isArray(corpus.acknowledgedAny), `${label}: "acknowledgedAny" must be a list at path document.acknowledgedAny; repair: restore the required-name ledger.`)
  for (const [index, entry] of corpus.acknowledgedAny.entries()) {
    checkKeys(entry, ['file', 'count'], `acknowledgedAny[${index}]`, label)
    checkText(entry.file, `acknowledgedAny[${index}]`, 'file', `document.acknowledgedAny[${index}].file`, 'name the file carrying the recorded any justification')
    if (!Number.isInteger(entry.count) || entry.count < 1) {
      fail(`${label}: invalid count ${JSON.stringify(entry.count)} for field "count" at path document.acknowledgedAny[${index}].count; repair: record a positive integer count.`)
    }
  }
  return corpus
}

/**
 * @param {unknown} value
 * @param {string[]} [refusedDirectives]
 * @param {string} [label]
 */
function validateManifest(value, refusedDirectives = [], label = MANIFEST_REL) {
  checkKeys(
    value,
    ['expectedVendoredCount', 'requiredVendoredBodies', 'requiredCoveredRoots', 'requiredRootScripts', 'expectedAnyFileCount', 'expectedAnyOccurrenceCount', 'requiredAnyFiles', 'expectedMutationCount', 'requiredMutationNames', 'mutations'],
    'manifest',
    label,
  )
  const manifestValue = /** @type {Record<string, unknown>} */ (value)
  assert.ok(Array.isArray(manifestValue.mutations), `${label}: "mutations" must be a list at path manifest.mutations; repair: restore the named mutation inventory.`)
  const requiredVendoredBodies = /** @type {unknown[]} */ (manifestValue.requiredVendoredBodies)
  const requiredAnyFiles = /** @type {unknown[]} */ (manifestValue.requiredAnyFiles)
  const requiredMutationNames = /** @type {unknown[]} */ (manifestValue.requiredMutationNames)
  const mutations = /** @type {Array<Record<string, unknown>>} */ (manifestValue.mutations)
  checkRequiredNamesList(manifestValue.requiredCoveredRoots, `${label}: requiredCoveredRoots`, 'covered root')
  checkRequiredNamesList(manifestValue.requiredRootScripts, `${label}: requiredRootScripts`, 'root script')
  checkRequiredNamesList(manifestValue.requiredVendoredBodies, `${label}: requiredVendoredBodies`, 'vendored body')
  checkRequiredNamesList(manifestValue.requiredAnyFiles, `${label}: requiredAnyFiles`, 'any file')
  checkRequiredNamesList(manifestValue.requiredMutationNames, `${label}: requiredMutationNames`, 'mutation')
  assert.equal(manifestValue.expectedVendoredCount, requiredVendoredBodies.length, `${label}: expectedVendoredCount must equal the vendored inventory`)
  assert.equal(manifestValue.expectedAnyFileCount, requiredAnyFiles.length, `${label}: expectedAnyFileCount must equal the any-file inventory`)
  assert.equal(manifestValue.expectedMutationCount, requiredMutationNames.length, `${label}: expectedMutationCount must equal the mutation inventory`)
  assert.equal(manifestValue.expectedMutationCount, mutations.length, `${label}: mutation count must equal expectedMutationCount`)
  checkRequiredNames(mutations.map((entry) => String(entry.name)), manifestValue.requiredMutationNames, label, 'mutation')
  for (const [index, mutation] of mutations.entries()) {
    const record = mutation
    const fields = ['name', 'rule', 'kind', 'target', 'expectedDiagnostic']
    if (record.kind === 'plant-directive') fields.push('value')
    checkKeys(mutation, fields, `manifest mutation ${index}`, label)
    if (!RULES.includes(/** @type {string} */ (record.rule))) fail(`${label}: unknown rule ${JSON.stringify(record.rule)} at path manifest.mutations[${index}].rule; repair: use one of ${RULES.join(', ')}.`)
    if (typeof record.kind !== 'string' || !MUTATION_KINDS.has(record.kind)) fail(`${label}: unknown kind ${JSON.stringify(record.kind)} at path manifest.mutations[${index}].kind; repair: use a declared mutation kind.`)
    if (record.kind === 'plant-directive' && !refusedDirectives.includes(/** @type {string} */ (record.value))) {
      fail(`${label}: plant-directive must name one of the refused directives (${refusedDirectives.join(', ')}) at path manifest.mutations[${index}].value; repair: set the refused directive.`)
    }
    checkText(record.target, `manifest mutation ${index}`, 'target', `manifest.mutations[${index}].target`, 'name the mutated file or program entry', label)
    checkText(record.expectedDiagnostic, `manifest mutation ${index}`, 'expectedDiagnostic', `manifest.mutations[${index}].expectedDiagnostic`, 'name the diagnostic the mutation must produce', label)
  }
}

/**
 * @param {Corpus} corpus
 * @returns {Model}
 */
function buildModel(corpus) {
  const walk = walkCoveredFiles(corpus)
  const files = walk.map((path) => ({ path, source: readFileSync(resolve(ROOT, path), 'utf8') }))
  const anyLedger = new Map(corpus.acknowledgedAny.map((entry) => [entry.file, entry.count]))
  return { files, walk, vendored: [...corpus.vendoredBodies].sort(), pragmaMarker: corpus.pragmaMarker, vendoredMarker: corpus.vendoredMarker, refusedDirectives: [...corpus.refusedDirectives], anyProbe: corpus.anyProbe, anyLedger, program: [] }
}

/**
 * @param {Corpus} corpus
 * @returns {string[]}
 */
function walkCoveredFiles(corpus) {
  const found = new Set()
  for (const root of corpus.coveredRoots) {
    const absolute = resolve(ROOT, root)
    let stat
    try {
      stat = statSync(absolute)
    } catch {
      fail(`${CORPUS_REL}: covered root ${root} is missing at path document.coveredRoots; repair: restore ${root} or remove it from the covered roots.`)
    }
    if (!stat.isDirectory()) fail(`${CORPUS_REL}: covered root ${root} is not a directory at path document.coveredRoots; repair: name a directory.`)
    walkDirectory(absolute, found)
  }
  for (const script of corpus.rootScripts) {
    const absolute = resolve(ROOT, script)
    try {
      if (!statSync(absolute).isFile()) throw new Error('not a file')
    } catch {
      fail(`${CORPUS_REL}: root script ${script} is missing or not a file at path document.rootScripts; repair: restore ${script} or remove it from the root scripts.`)
    }
    found.add(script)
  }
  return [...found].sort()
}

/**
 * @param {string} directory
 * @param {Set<string>} found
 */
function walkDirectory(directory, found) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) {
      walkDirectory(absolute, found)
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      found.add(relativePath(ROOT, absolute).split(sep).join('/'))
    }
  }
}

/**
 * @param {Model} model
 */
function checkVendored(model) {
  const derived = deriveVendored(model.files, model.vendoredMarker).sort()
  const declared = [...model.vendored].sort()
  const missing = declared.filter((path) => !derived.includes(path))
  const extra = derived.filter((path) => !declared.includes(path))
  if (missing.length || extra.length) {
    const details = [
      ...missing.map((path) => `vendored body ${path} carries no vendored banner`),
      ...extra.map((path) => `file ${path} carries the vendored banner but is not in the vendored allowlist`),
    ]
    fail(`vendored allowlist mismatch at path document.vendoredBodies; ${details.join('; ')}; repair: add the file to the allowlist or restore/remove the banner so the allowlist equals the banner-carriers exactly.`)
  }
}

/**
 * @param {SourceFile[]} files
 * @param {string} marker
 * @returns {string[]}
 */
function deriveVendored(files, marker) {
  return files.filter((file) => leadingBlockComment(file.source).includes(marker)).map((file) => file.path)
}

/**
 * @param {string} source
 * @returns {string}
 */
function leadingBlockComment(source) {
  const match = source.match(/^\s*\/\*([\s\S]*?)\*\//)
  return match ? match[1] : ''
}

/**
 * @param {Model} model
 */
function checkPragma(model) {
  const vendored = new Set(model.vendored)
  const violations = []
  for (const file of model.files) {
    if (vendored.has(file.path)) continue
    const lines = file.source.split('\n')
    const firstLine = lines[0] === undefined ? '' : lines[0]
    const pragmaLine = firstLine.startsWith('#!') ? lines[1] : firstLine
    if ((pragmaLine ?? '').trim() !== model.pragmaMarker) {
      violations.push(`${file.path} is missing the ${model.pragmaMarker} pragma as its first non-shebang line`)
    }
  }
  if (violations.length) {
    fail(`type-check coverage gap at path document.coveredRoots; ${violations.join('; ')}; repair: add ${model.pragmaMarker} as the first non-shebang line, or register the file as a byte-vendored body if it is one.`)
  }
}

/**
 * @param {Model} model
 */
function checkEscapeHatches(model) {
  const vendored = new Set(model.vendored)
  const violations = []
  for (const file of model.files) {
    if (vendored.has(file.path)) continue
    for (const directive of model.refusedDirectives) {
      if (file.source.includes(directive)) violations.push(`${file.path} carries the refused ${directive} directive`)
    }
    const actual = countExplicitAny(file.source)
    const expected = model.anyLedger.get(file.path) ?? 0
    if (actual !== expected) {
      violations.push(`${file.path} holds ${actual} explicit-any type positions but the recorded justification is ${expected}`)
    }
  }
  if (violations.length) {
    fail(`escape hatch at path document.acknowledgedAny; ${violations.join('; ')}; repair: remove the directive, or record/remove the exact explicit-any justification in ${CORPUS_REL}.`)
  }
}

/**
 * Count explicit `any` tokens inside JSDoc type expressions, balancing braces so
 * nested object types are read whole. Prose `any` (e.g. "any file") is ignored.
 * @param {string} source
 * @returns {number}
 */
function countExplicitAny(source) {
  let count = 0
  for (const line of source.split('\n')) {
    let tag
    ANY_TAGS.lastIndex = 0
    while ((tag = ANY_TAGS.exec(line)) !== null) {
      const brace = line.indexOf('{', tag.index + tag[0].length)
      if (brace === -1) continue
      let depth = 0
      let end = -1
      for (let index = brace; index < line.length; index += 1) {
        if (line[index] === '{') depth += 1
        else if (line[index] === '}') {
          depth -= 1
          if (depth === 0) {
            end = index
            break
          }
        }
      }
      if (end === -1) continue
      const expression = line.slice(brace + 1, end)
      const hits = expression.match(/\bany\b/g)
      if (hits) count += hits.length
      ANY_TAGS.lastIndex = end
    }
  }
  return count
}

/**
 * @param {Corpus} corpus
 * @param {string} root
 * @returns {string[]}
 */
function listProgramFiles(corpus, root) {
  const require = createRequire(import.meta.url)
  const tsc = require.resolve('typescript/lib/tsc.js')
  const result = spawnSync(process.execPath, [tsc, '-p', corpus.compilerConfig, '--listFiles', '--pretty', 'false'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.error) fail(`could not run tsc for ${corpus.compilerConfig} at path document.compilerConfig; repair: install the pinned typescript devDependency. ${result.error.message}`)
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const prefix = `${root}${sep}`
  const inScope = new Set()
  for (const raw of output.split('\n')) {
    const line = raw.trim()
    if (!line.startsWith(prefix)) continue
    if (line.includes('error TS')) continue
    const rel = relativePath(root, line).split(sep).join('/')
    if (inCoveredScope(rel, corpus)) inScope.add(rel)
  }
  if (!inScope.size) fail(`tsc reported no program files for ${corpus.compilerConfig} at path document.compilerConfig; repair: restore the include globs and the covered roots.`)
  return [...inScope].sort()
}

/**
 * @param {string} rel
 * @param {Corpus} corpus
 * @returns {boolean}
 */
function inCoveredScope(rel, corpus) {
  if (corpus.rootScripts.includes(rel)) return true
  return corpus.coveredRoots.some((root) => rel === root || rel.startsWith(`${root}/`))
}

/**
 * @param {Model} model
 */
function checkProgramParity(model) {
  const walk = new Set(model.walk)
  const program = new Set(model.program)
  const unwalked = [...program].filter((path) => !walk.has(path)).sort()
  const uncovered = [...walk].filter((path) => !program.has(path)).sort()
  if (unwalked.length || uncovered.length) {
    const details = [
      ...uncovered.map((path) => `${path} is walked but absent from the tsc program`),
      ...unwalked.map((path) => `${path} is in the tsc program but not walked`),
    ]
    fail(`type-program coverage scope drift at path document.coveredRoots; ${details.join('; ')}; repair: keep the tsconfig.fairtest.json include globs, the guard walk, and the covered roots in exact agreement.`)
  }
}

/**
 * @param {Model} model
 * @param {Record<string, unknown>} manifestValue
 */
function runMutations(model, manifestValue) {
  for (const mutation of /** @type {Array<Record<string, unknown>>} */ (manifestValue.mutations)) {
    let message = null
    try {
      const candidate = applyMutation(model, mutation)
      runRule(/** @type {string} */ (mutation.rule), candidate)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, `${mutation.name}: mutated input passed validation instead of failing`)
    assert.ok(message.includes(/** @type {string} */ (mutation.expectedDiagnostic)), `${mutation.name}: diagnostic does not name ${mutation.expectedDiagnostic}; received ${message}`)
    assert.ok(message.includes('at path'), `${mutation.name}: diagnostic is missing path context: ${message}`)
    assert.ok(message.includes('repair:'), `${mutation.name}: diagnostic is missing repair guidance: ${message}`)
  }
}

/**
 * @param {string} rule
 * @param {Model} model
 */
function runRule(rule, model) {
  if (rule === 'pragma') checkPragma(model)
  else if (rule === 'vendored') checkVendored(model)
  else if (rule === 'escape') checkEscapeHatches(model)
  else if (rule === 'program') checkProgramParity(model)
  else fail(`unknown rule ${rule} at path manifest.mutations[].rule; repair: use one of ${RULES.join(', ')}.`)
}

/**
 * @param {Model} model
 * @param {Record<string, unknown>} mutation
 * @returns {Model}
 */
function applyMutation(model, mutation) {
  const candidate = structuredClone(model)
  candidate.anyLedger = new Map(model.anyLedger)
  const target = /** @type {string} */ (mutation.target)
  const find = () => {
    const file = candidate.files.find((entry) => entry.path === target)
    assert.ok(file, `${mutation.name}: unknown mutation target ${target}`)
    return file
  }
  switch (mutation.kind) {
    case 'remove-pragma': {
      const file = find()
      file.source = file.source
        .split('\n')
        .filter((line) => line.trim() !== model.pragmaMarker)
        .join('\n')
      return candidate
    }
    case 'add-vendored-banner': {
      find().source = `/* canonical copy consumers vendor */\n${find().source}`
      return candidate
    }
    case 'remove-vendored-banner': {
      const file = find()
      file.source = file.source.split(model.vendoredMarker).join('')
      return candidate
    }
    case 'plant-directive': {
      find().source = `${find().source}\n// ${String(mutation.value)}\n`
      return candidate
    }
    case 'plant-any': {
      find().source = `${find().source}\n${candidate.anyProbe}\nconst __probe = null\n`
      return candidate
    }
    case 'drop-any-count': {
      const current = candidate.anyLedger.get(target) ?? 0
      assert.ok(current > 0, `${mutation.name}: target ${target} has no recorded justification to drop`)
      candidate.anyLedger.set(target, current - 1)
      return candidate
    }
    case 'drop-from-program': {
      assert.ok(candidate.program.includes(target), `${mutation.name}: target ${target} is not in the program set`)
      candidate.program = candidate.program.filter((path) => path !== target)
      return candidate
    }
    default:
      throw new Error(`${mutation.name}: unsupported mutation kind ${String(mutation.kind)}`)
  }
}

/**
 * @param {Model} model
 * @returns {number}
 */
function totalAcknowledgedAny(model) {
  let total = 0
  for (const count of model.anyLedger.values()) total += count
  return total
}

/**
 * @param {unknown} value
 * @param {string[]} fields
 * @param {string} tag
 * @param {string} label
 * @param {string} [path]
 * @param {string} [prefix]
 */
function checkKeys(value, fields, tag, label, path = '', prefix = '') {
  const where = path ? ` at path ${path}` : ''
  const named = prefix ? `${prefix} ` : ''
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label}: ${tag}: ${named}object is missing or malformed${where}; repair: restore the ${named}object with exactly: ${fields.join(', ')}.`)
  }
  const record = /** @type {Record<string, unknown>} */ (value)
  const dotted = (/** @type {string} */ field) => (prefix ? `${prefix}.${field}` : field)
  for (const field of fields) {
    if (!(field in record)) fail(`${label}: ${tag}: missing required field "${dotted(field)}"${where}; repair: restore "${dotted(field)}".`)
  }
  for (const key of Object.keys(record)) {
    if (!fields.includes(key)) fail(`${label}: ${tag}: unknown field "${dotted(key)}"${where}; repair: remove "${dotted(key)}".`)
  }
}

/**
 * @param {unknown} value
 * @param {string} tag
 * @param {string} field
 * @param {string} path
 * @param {string} repair
 */
function checkText(value, tag, field, path, repair, label = CORPUS_REL) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${label}: ${tag}: missing or invalid field "${field}" at path ${path}; repair: ${repair}.`)
  }
}

/**
 * @param {unknown} value
 * @param {string} tag
 * @param {string} field
 * @param {string} label
 */
function checkStringList(value, tag, field, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || !entry.length)) {
    fail(`${label}: ${tag}: expected a non-empty string list at path document.${field}; repair: restore the ${field} list.`)
  }
}

/**
 * @param {unknown} value
 * @param {string} tag
 * @param {string} noun
 */
function checkRequiredNamesList(value, tag, noun) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || !entry.length)) {
    fail(`${tag}: expected a non-empty string list of ${noun} names; repair: restore the required ${noun} inventory.`)
  }
  assert.equal(new Set(value).size, value.length, `${tag}: ${noun} names must be unique`)
}

/**
 * @param {string[]} actual
 * @param {unknown} required
 * @param {string} label
 * @param {string} noun
 */
function checkRequiredNames(actual, required, label, noun) {
  assert.ok(Array.isArray(required), `${label}: required ${noun} names must be a list`)
  const requiredList = /** @type {string[]} */ (required)
  for (const name of requiredList) {
    if (!actual.includes(name)) fail(`${label}: required ${noun} inventory mismatch at path document; missing "${name}"; repair: restore the "${name}" ${noun} or update the manifest required names.`)
  }
  for (const name of actual) {
    if (!requiredList.includes(name)) fail(`${label}: required ${noun} inventory mismatch at path document; unknown "${name}"; repair: register the "${name}" ${noun} in the manifest required names or remove it.`)
  }
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  throw new Error(message)
}

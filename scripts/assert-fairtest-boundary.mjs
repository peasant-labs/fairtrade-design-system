#!/usr/bin/env node
// Fairtest package, pack, and source-isolation boundary guard.
//
// Proves the published root package stays free of Fairtest coupling, the
// private child stays source-only, the packed artifact carries no Fairtest
// path, the child source carries no browser, live-handle, endpoint, or
// undeclared-dependency leakage, and scripts/fairtest-source.mjs remains
// the only repository-local source route. Every boundary case, forbidden
// manifest, and mutation lives in scripts/testdata/fairtest-boundary.yaml
// plus its required-name manifest; this file owns no case data. The
// authoritative external-root proof runs as a subprocess through the child
// isolation test. Browser-free: node builtins plus the declared yaml
// developer dependency only. No service, runner, or network is required.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative as relativePath, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { resolveFairtestSource } from './fairtest-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS_REL = 'scripts/testdata/fairtest-boundary.yaml'
const MANIFEST_REL = 'scripts/testdata/fairtest-boundary.manifest.yaml'
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])
const CHECKS = ['root-package', 'child-package', 'pack-path', 'source-route']
const CHILD_REL = join('packages', 'fairtest')
const ROUTE_MARKER = 'packages/fairtest'
const ROUTE_EXTENSIONS = new Set(['.mjs', '.js', '.cjs'])

/** @param {string} source @param {string} label @returns {Record<string, unknown>} */
function loadSingleDocument(source, label) {
  if (source.trim().length === 0) {
    throw new Error(`${label}: empty fixture source at path document; repair: restore the single YAML document in ${label}.`)
  }
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  if (documents.length !== 1) {
    throw new Error(`${label}: expected exactly one YAML document at path document; repair: remove everything from the trailing --- marker so ${label} holds exactly one document.`)
  }
  const [document] = documents
  if (document.errors.length > 0) {
    throw new Error(`${label}: invalid YAML at path document; ${document.errors.map((entry) => entry.message).join('; ')}; repair: fix the YAML syntax in ${label}.`)
  }
  const parsed = document.toJS()
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label}: document root must be a record at path document; repair: restore the mapping root in ${label}.`)
  }
  return /** @type {Record<string, unknown>} */ (parsed)
}

/** @param {unknown} value */
function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** @param {unknown} value @param {string} label @param {string} path */
function assertFragmentList(value, label, path) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`${label}: expected a non-empty string list at path ${path}; repair: restore the diagnostic fragment list at ${path}.`)
  }
}

/** @param {Record<string, unknown>} manifest @param {string} label */
function validateManifest(manifest, label) {
  assertExactFieldsShallow(manifest, ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], label, 'manifest')
  const cases = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  if (new Set(cases).size !== cases.length) {
    throw new Error(`${label}: required case names must be unique at path manifest.requiredCaseNames; repair: list every required case name once.`)
  }
  if (manifest.expectedCaseCount !== cases.length) {
    throw new Error(`${label}: case count must equal the required-name inventory at path manifest.expectedCaseCount; repair: align expectedCaseCount with requiredCaseNames.`)
  }
  if (manifest.expectedMutationCount !== mutations.length) {
    throw new Error(`${label}: mutation count must equal the mutation inventory at path manifest.expectedMutationCount; repair: align expectedMutationCount with mutations.`)
  }
  checkRequiredNames(mutations.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredMutationNames), label)
  for (const [index, mutation] of mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('value')
    assertExactFieldsShallow(mutation, fields, label, `manifest.mutations[${index}]`)
    if (!MUTATION_KINDS.has(/** @type {string} */ (mutation.kind))) {
      throw new Error(`${label}: mutation ${index} names an unknown kind at path manifest.mutations[${index}].kind; repair: use one of ${[...MUTATION_KINDS].join(', ')}.`)
    }
    if (mutation.kind === 'trailing-document') {
      if (mutation.target !== 'document') {
        throw new Error(`${label}: mutation ${index} trailing-document must target the document at path manifest.mutations[${index}].target; repair: target "document".`)
      }
    } else if (!cases.includes(/** @type {string} */ (mutation.target))) {
      throw new Error(`${label}: mutation ${index} targets an unknown case at path manifest.mutations[${index}].target; repair: target one of the required case names.`)
    }
  }
}

/** @param {unknown} value @param {string[]} fields @param {string} label @param {string} path */
function assertExactFieldsShallow(value, fields, label, path) {
  if (!isRecord(value)) {
    throw new Error(`${label}: expected a record at path ${path}; repair: restore the mapping at ${path}.`)
  }
  const actual = Object.keys(/** @type {Record<string, unknown>} */ (value)).sort()
  const wanted = [...fields].sort()
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label}: exact field mismatch at path ${path}; got [${actual.join(', ')}] want [${wanted.join(', ')}]; repair: restore the exact field set at ${path}.`)
  }
}

/** @param {unknown[]} actual @param {string[]} required @param {string} label */
function checkRequiredNames(actual, required, label) {
  const seen = new Set()
  for (const name of actual) {
    if (seen.has(name)) {
      throw new Error(`${label}: duplicate case name ${JSON.stringify(name)} at path cases; repair: remove the duplicated case record.`)
    }
    seen.add(name)
  }
  for (const name of required) {
    if (!actual.includes(name)) {
      throw new Error(`${label}: missing required name ${JSON.stringify(name)} at path requiredCaseNames; repair: restore the required record.`)
    }
  }
  for (const name of actual) {
    if (!required.includes(/** @type {string} */ (name))) {
      throw new Error(`${label}: unknown name ${JSON.stringify(name)} at path requiredCaseNames; repair: remove the undeclared record or extend the manifest.`)
    }
  }
}

/** @param {Record<string, unknown>} value */
function validateFamilyShape(value) {
  const label = CORPUS_REL
  assertExactFieldsShallow(value, ['expectedCaseCount', 'cases', 'requiredChildScripts', 'forbiddenPackFragments', 'allowedRouteFiles', 'forbiddenSourcePatterns', 'isolationProbes'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error(`${label}: document holds no cases at path cases; repair: restore the named cases list.`)
  }
  for (const [index, entry] of cases.entries()) {
    if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
      throw new Error(`${label}: case ${index} is missing its required name at path cases[${index}].name; repair: restore the required case name.`)
    }
    if (!CHECKS.includes(/** @type {string} */ (entry.check))) {
      throw new Error(`${label}: case "${entry.name}" names an unknown discriminator ${JSON.stringify(entry.check)} for field "check" at path cases[${index}].check; repair: use one of ${CHECKS.join(', ')} for "check".`)
    }
    const path = `cases[${index}]`
    if (entry.check === 'root-package' || entry.check === 'child-package') {
      assertExactFieldsShallow(entry, ['name', 'check', 'expectValid', 'expected'], label, path)
      if (!isRecord(entry.expected)) {
        throw new Error(`${label}: case "${entry.name}" must declare an expected record at path ${path}.expected; repair: restore the expected package pin.`)
      }
    } else if (entry.check === 'pack-path') {
      assertExactFieldsShallow(entry, ['name', 'check', 'path', 'expectAllowed', ...(entry.expectAllowed ? [] : ['expectedErrorContains'])], label, path)
    } else {
      assertExactFieldsShallow(entry, ['name', 'check', 'spec', 'expectAllowed', ...(entry.expectAllowed ? [] : ['expectedErrorContains'])], label, path)
    }
    if ('expectedErrorContains' in entry) assertFragmentList(entry.expectedErrorContains, label, `${path}.expectedErrorContains`)
  }
  assertFragmentList(value.requiredChildScripts, label, 'requiredChildScripts')
  assertFragmentList(value.forbiddenPackFragments, label, 'forbiddenPackFragments')
  assertFragmentList(value.allowedRouteFiles, label, 'allowedRouteFiles')
  const patterns = /** @type {Record<string, unknown>[]} */ (value.forbiddenSourcePatterns)
  if (!Array.isArray(patterns) || patterns.length === 0) {
    throw new Error(`${label}: expected a non-empty pattern list at path forbiddenSourcePatterns; repair: restore the forbidden source patterns.`)
  }
  for (const [index, entry] of patterns.entries()) {
    assertExactFieldsShallow(entry, ['name', 'pattern'], label, `forbiddenSourcePatterns[${index}]`)
    try {
      new RegExp(/** @type {string} */ (entry.pattern))
    } catch {
      throw new Error(`${label}: invalid pattern at path forbiddenSourcePatterns[${index}].pattern; repair: restore a valid pattern.`)
    }
  }
  const probes = /** @type {Record<string, unknown>[]} */ (value.isolationProbes)
  if (!Array.isArray(probes) || probes.length === 0) {
    throw new Error(`${label}: expected a non-empty probe list at path isolationProbes; repair: restore the isolation probes.`)
  }
  for (const [index, probe] of probes.entries()) {
    assertExactFieldsShallow(probe, ['name', 'snippet'], label, `isolationProbes[${index}]`)
  }
}

/** @param {string} packedPath @param {string[]} fragments @returns {string | null} matched fragment or null */
function forbiddenPackMatch(packedPath, fragments) {
  return fragments.find((fragment) => packedPath.includes(fragment)) ?? null
}

/** @param {string[]} fragments @param {string} packedPath @param {string} path */
function assertPackPathAllowed(fragments, packedPath, path) {
  const matched = forbiddenPackMatch(packedPath, fragments)
  if (matched) {
    throw new Error(`pack path ${JSON.stringify(packedPath)} is forbidden by manifest fragment ${JSON.stringify(matched)} at path ${path}; repair: keep Fairtest source, tests, and manifests out of the published tarball.`)
  }
}

/** @param {string[]} fragments @param {string} packedPath @param {string} path */
function assertPackPathRejected(fragments, packedPath, path) {
  const matched = forbiddenPackMatch(packedPath, fragments)
  if (!matched) {
    throw new Error(`pack path ${JSON.stringify(packedPath)} passed the forbidden manifest at path ${path}; repair: extend forbiddenPackFragments so the child path stays unpacked.`)
  }
  assertPackPathAllowed(fragments, packedPath, path)
}

/** @param {string[]} fragments @param {Record<string, unknown>} entry @param {number} index */
function runPackCase(fragments, entry, index) {
  const path = `cases[${index}]`
  const packedPath = /** @type {string} */ (entry.path)
  if (entry.expectAllowed) {
    assertPackPathAllowed(fragments, packedPath, path)
    return
  }
  let message = null
  try {
    assertPackPathRejected(fragments, packedPath, path)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (!message) {
    throw new Error(`case "${entry.name}" passed validation instead of failing at path ${path}; repair: restore the forbidden pack path.`)
  }
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, /** @type {string} */ (entry.name))
}

/** @param {Record<string, unknown>} entry @param {number} index */
function runRouteCase(entry, index) {
  const path = `cases[${index}]`
  const spec = /** @type {string} */ (entry.spec)
  const name = /** @type {string} */ (entry.name)
  if (entry.expectAllowed) {
    try {
      resolveFairtestSource(spec)
    } catch (error) {
      throw new Error(`${CORPUS_REL}: case "${name}" failed to resolve at path ${path}.spec; ${error instanceof Error ? error.message : String(error)}; repair: restore the allowed child-relative spec.`)
    }
    return
  }
  let message = null
  try {
    const resolved = resolveFairtestSource(spec)
    throw new Error(`${CORPUS_REL}: case "${name}" resolved to ${resolved} at path ${path}.spec; repair: keep escapes and bare specifiers rejected by the source route.`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
    if (!/rejected|escapes|not allowed/.test(message)) {
      throw new Error(`${CORPUS_REL}: case "${name}" failed for the wrong reason at path ${path}.spec; got ${message}; repair: restore the intended rejection.`)
    }
    assert.ok(message.includes('at path'), `${CORPUS_REL}: case "${name}" production diagnostic is missing path context at path ${path}.spec; got ${message}; repair: name the spec path in the source-route rejection.`)
    assert.ok(message.includes('repair:'), `${CORPUS_REL}: case "${name}" production diagnostic is missing repair guidance at path ${path}.spec; got ${message}; repair: append a repair hint to the source-route rejection.`)
  }
  expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
}

/** @param {string[]} fragments @param {string} message @param {string} name */
function expectFragments(fragments, message, name) {
  for (const fragment of fragments) {
    assert.ok(message.includes(fragment), `${name}: diagnostic is missing ${JSON.stringify(fragment)}; got ${message}`)
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
    assert.notEqual(index, -1, `unknown mutation target ${mutation.target}`)
    cases.splice(index, 1)
    return
  }
  const target = cases.find((entry) => entry.name === mutation.target)
  assert.ok(target, `unknown mutation target ${mutation.target}`)
  const segments = /** @type {string} */ (mutation.field).split('.')
  if (mutation.kind === 'delete-field') {
    let node = target
    for (const segment of segments.slice(0, -1)) node = /** @type {Record<string, unknown>} */ (node[segment])
    delete node[segments.at(-1)]
    return
  }
  if (mutation.kind === 'rename-field') {
    let node = target
    for (const segment of segments.slice(0, -1)) node = /** @type {Record<string, unknown>} */ (node[segment])
    const last = segments.at(-1)
    const value = node[last]
    delete node[last]
    node[/** @type {string} */ (mutation.newField)] = value
    return
  }
  let node = target
  for (const segment of segments.slice(0, -1)) {
    if (!isRecord(node[segment])) node[segment] = {}
    node = /** @type {Record<string, unknown>} */ (node[segment])
  }
  node[segments.at(-1)] = structuredClone(mutation.value)
}

/** @param {string} directory @param {string} [base] @returns {Map<string, string[]>} relative path plus matched lines */
function filesReferencingChild(directory, base = directory) {
  const hits = new Map()
  let entries = []
  try {
    entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))
  } catch {
    return hits
  }
  for (const entry of entries) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      for (const [relative, lines] of filesReferencingChild(absolute, base)) hits.set(relative, lines)
      continue
    }
    if (!ROUTE_EXTENSIONS.has(extname(entry.name))) continue
    const text = readFileSync(absolute, 'utf8')
    if (text.includes(ROUTE_MARKER)) {
      const relative = relativePath(base, absolute).split(sep).join('/')
      hits.set(relative, text.split('\n').filter((line) => line.includes(ROUTE_MARKER)))
    }
  }
  return hits
}

/** @returns {{ file: string, text: string }[]} */
function childSources() {
  const entries = []
  for (const dir of ['core', 'host-contract', 'evidence']) {
    const directory = join(ROOT, CHILD_REL, 'src', dir)
    for (const name of readdirSync(directory).filter((entry) => entry.endsWith('.mjs')).sort()) {
      entries.push({ file: `src/${dir}/${name}`, text: readFileSync(join(directory, name), 'utf8') })
    }
  }
  return entries
}

function main() {
  const corpusSource = readFileSync(join(ROOT, CORPUS_REL), 'utf8')
  const manifestSource = readFileSync(join(ROOT, MANIFEST_REL), 'utf8')
  const manifest = loadSingleDocument(manifestSource, MANIFEST_REL)
  validateManifest(manifest, MANIFEST_REL)
  const parsed = loadSingleDocument(corpusSource, CORPUS_REL)
  validateFamilyShape(parsed)
  const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
  const manifestCases = /** @type {string[]} */ (manifest.requiredCaseNames)
  assert.equal(cases.length, manifest.expectedCaseCount, `${CORPUS_REL}: case count must match the manifest at path expectedCaseCount; repair: align the cases list with the manifest.`)
  checkRequiredNames(cases.map((entry) => entry.name), manifestCases, CORPUS_REL)

  const fragments = /** @type {string[]} */ (parsed.forbiddenPackFragments)
  const requiredScripts = /** @type {string[]} */ (parsed.requiredChildScripts)

  // Executable boundary cases against the real tree.
  const rootManifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const childManifest = JSON.parse(readFileSync(join(ROOT, CHILD_REL, 'package.json'), 'utf8'))
  cases.forEach((entry, index) => {
    const path = `cases[${index}]`
    if (entry.check === 'root-package') {
      const expected = /** @type {Record<string, unknown>} */ (entry.expected)
      assert.equal(rootManifest.name, expected.name, `${CORPUS_REL}: root package name drifted at path ${path}; repair: keep the published name exact.`)
      assert.equal(rootManifest.version, expected.version, `${CORPUS_REL}: root package version drifted at path ${path}; repair: keep the published version exact.`)
    } else if (entry.check === 'child-package') {
      const expected = /** @type {Record<string, unknown>} */ (entry.expected)
      assert.equal(childManifest.name, expected.name, `${CORPUS_REL}: child package name drifted at path ${path}; repair: keep the private child name exact.`)
      assert.equal(childManifest.private, expected.private, `${CORPUS_REL}: child package must stay private at path ${path}; repair: restore private true.`)
    } else if (entry.check === 'pack-path') {
      runPackCase(fragments, entry, index)
    } else {
      runRouteCase(entry, index)
    }
  })

  // Executable fixture mutations: every mutation must fail for its field.
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  for (const mutation of mutations) {
    let message = null
    try {
      if (mutation.kind === 'trailing-document') {
        loadSingleDocument(`${corpusSource.trimEnd()}\n---\norphan: true\n`, CORPUS_REL)
      } else {
        const mutated = structuredClone(cases)
        applyMutation(mutated, mutation)
        validateFamilyShape({ ...parsed, cases: mutated })
        checkRequiredNames(mutated.map((entry) => entry.name), manifestCases, CORPUS_REL)
      }
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, `${CORPUS_REL}: mutation "${mutation.name}" passed validation instead of failing`)
    assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${CORPUS_REL}: mutation "${mutation.name}" names the wrong field; got ${message}`)
    assert.ok(message.includes('at path'), `${CORPUS_REL}: mutation "${mutation.name}" is missing path context: ${message}`)
    assert.ok(message.includes('repair:'), `${CORPUS_REL}: mutation "${mutation.name}" is missing repair guidance: ${message}`)
  }

  // Root package surface: no Fairtest in exports, files, or dependencies.
  const surface = JSON.stringify({ exports: rootManifest.exports, files: rootManifest.files })
  assert.ok(!/fairtest/i.test(surface), `fairtest boundary: root exports/files reference Fairtest at path package.json; repair: keep the published surface free of the private child.`)
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const names = Object.keys(rootManifest[field] ?? {})
    assert.ok(!names.some((name) => /fairtest/i.test(name)), `fairtest boundary: root ${field} depends on Fairtest at path package.json; repair: keep the published runtime free of the private child.`)
  }
  for (const key of ['publishConfig', 'files', 'exports']) {
    assert.ok(!(key in childManifest), `fairtest boundary: child package must not gain ${key} at path packages/fairtest/package.json; repair: keep the child source-only.`)
  }
  checkRequiredNames(Object.keys(childManifest.scripts ?? {}), requiredScripts, 'packages/fairtest/package.json scripts')

  // Static packed-surface allowlist: files[] plus every exports target.
  const staticPacked = new Set()
  for (const entry of rootManifest.files ?? []) staticPacked.add(String(entry))
  for (const entry of Object.values(rootManifest.exports ?? {})) {
    if (typeof entry === 'string') staticPacked.add(entry.replace(/^\.\//, ''))
    else for (const value of Object.values(/** @type {Record<string, unknown>} */ (entry))) {
      if (typeof value === 'string') staticPacked.add(value.replace(/^\.\//, ''))
    }
  }
  for (const packedPath of staticPacked) {
    assertPackPathAllowed(fragments, packedPath, 'package.json files/exports')
  }

  // Sole repository-local source route.
  const allowedRoutes = /** @type {string[]} */ (parsed.allowedRouteFiles)
  const scriptsDir = join(ROOT, 'scripts')
  const hits = filesReferencingChild(scriptsDir)
  const actual = [...hits.keys()].map((name) => `scripts/${name}`).sort()
  assert.deepEqual(actual, [...allowedRoutes].sort(), `fairtest boundary: source-route inventory drifted at path scripts; got [${actual.join(', ')}]; repair: route every child source import through scripts/fairtest-source.mjs.`)
  // A planted second route in a scratch directory must be flagged, including
  // a nested subdirectory route and a non-.mjs source extension.
  const scratch = mkdtempSync(join(tmpdir(), 'fairtest-route-probe-'))
  try {
    writeFileSync(join(scratch, 'second-route.mjs'), `import x from '../packages/fairtest/src/core/values.mjs'\nconsole.log(x)\n`)
    const nested = join(scratch, 'journey')
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, 'nested-route.mjs'), `import x from '../../packages/fairtest/src/core/values.mjs'\nconsole.log(x)\n`)
    writeFileSync(join(scratch, 'legacy-route.cjs'), `require('../packages/fairtest/src/core/values.mjs')\n`)
    const planted = filesReferencingChild(scratch)
    assert.ok(planted.has('second-route.mjs'), 'fairtest boundary: planted second route passed undetected; repair: keep the route detector literal exact.')
    assert.ok(planted.has('journey/nested-route.mjs'), 'fairtest boundary: planted nested route passed undetected; repair: keep the route scan recursive across scripts/.')
    assert.ok(planted.has('legacy-route.cjs'), 'fairtest boundary: planted .cjs route passed undetected; repair: keep the route scan covering .mjs, .js, and .cjs.')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }

  // Leakage scans over the real child source.
  const sources = childSources()
  const patterns = /** @type {Record<string, unknown>[]} */ (parsed.forbiddenSourcePatterns)
  for (const { file, text } of sources) {
    for (const entry of patterns) {
      const pattern = new RegExp(/** @type {string} */ (entry.pattern))
      assert.ok(!pattern.test(text), `fairtest boundary: ${file} matches forbidden pattern ${(/** @type {string} */ (entry.name))} at path ${file}; repair: move that material to the app-owned host.`)
    }
  }
  for (const probe of /** @type {Record<string, unknown>[]} */ (parsed.isolationProbes)) {
    const snippet = /** @type {string} */ (probe.snippet)
    const joined = sources.map((entry) => entry.text).join('\n')
    assert.ok(!joined.includes(snippet), `fairtest boundary: child source contains probe ${(/** @type {string} */ (probe.name))} at path packages/fairtest/src; repair: move that material to the app-owned host.`)
    let message = null
    try {
      assertExactFieldsShallow({ alpha: 'x', beta: 'y', [snippet]: 'injected' }, ['alpha', 'beta'], 'probe', 'case.value')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message && message.includes(snippet), `fairtest boundary: probe "${probe.name}" injection passed instead of failing; repair: keep exact-field validation strict.`)
  }

  // Authoritative external-root proof through the child isolation test.
  try {
    execFileSync('node', ['--test', join(CHILD_REL, 'test', 'isolation.test.mjs')], { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })
  } catch (error) {
    throw new Error(`fairtest boundary: child isolation test failed at path packages/fairtest/test/isolation.test.mjs; ${error instanceof Error ? error.message : String(error)}; repair: run node --test packages/fairtest/test/isolation.test.mjs for the failing assertion.`)
  }

  console.log(
    `fairtest boundary: all ${cases.length} cases, ${mutations.length} mutations, ${sources.length} child modules, and the external-root isolation proof passed with ${fragments.length} forbidden pack fragments.`,
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

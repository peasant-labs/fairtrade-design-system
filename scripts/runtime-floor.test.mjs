#!/usr/bin/env node
/* Keep Fairtrade's declared and automated Node support aligned with the pinned
 * schema package. The schema lock entry is the dependency contract; the
 * manifest inventories every workflow that sets up Node, so a new build path
 * cannot silently bypass this guard. */

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const PACKAGE_PATH = 'package.json'
const LOCKFILE_PATH = 'pnpm-lock.yaml'
const NODE_VERSION_PATH = '.node-version'
const SCHEMA_PACKAGE = '@peasant-labs/schema'
const fixture = loadFixture(resolve(HERE, 'testdata/runtime-floor.yaml'))
const packageJson = parsePackageJson(readFileSync(resolve(ROOT, PACKAGE_PATH), 'utf8'), PACKAGE_PATH)
const lockfile = readFileSync(resolve(ROOT, LOCKFILE_PATH), 'utf8')
const workflowSources = new Map(discoverWorkflowSources())
const nodeVersionSource = readFileSync(resolve(ROOT, NODE_VERSION_PATH), 'utf8')

validateRuntimeFloor({ fixture, packageJson, lockfile, workflowSources, nodeVersionSource })

for (const mutation of fixture.mutations) {
  const mutated = applyMutation({ mutation, packageJson, lockfile, workflowSources, nodeVersionSource })
  assert.throws(
    () => validateRuntimeFloor({ fixture, ...mutated }),
    new RegExp(mutation.expectedError),
    `${mutation.name}: runtime floor mutation must be rejected`,
  )
}

const schemaVersion = readSchemaVersion(packageJson)
const schemaNodeFloor = readSchemaNodeFloor(lockfile, schemaVersion)
console.log(`runtime floor: ${SCHEMA_PACKAGE}@${schemaVersion} requires Node ${schemaNodeFloor}; package, .node-version, and ${fixture.workflows.length} Node workflows meet the floor; ${fixture.mutations.length} fixture mutations rejected`)

function validateRuntimeFloor({ fixture: config, packageJson: manifest, lockfile: lock, workflowSources: sources, nodeVersionSource: nodeVersion }) {
  const schemaVersion = readSchemaVersion(manifest)
  const schemaNodeFloor = readSchemaNodeFloor(lock, schemaVersion)
  const packageNodeFloor = readExactNodeFloor(manifest.engines?.node, 'package.json engines.node')
  assert.equal(packageNodeFloor, schemaNodeFloor, `package.json engines.node must match ${SCHEMA_PACKAGE} Node floor ${schemaNodeFloor}`)

  const checkedInNodeVersion = readExactNodeVersion(nodeVersion, NODE_VERSION_PATH)
  assert.ok(checkedInNodeVersion >= schemaNodeFloor, `${NODE_VERSION_PATH} Node ${checkedInNodeVersion} is below schema minimum ${schemaNodeFloor}`)

  const expectedPaths = config.workflows.map((workflow) => workflow.path).sort()
  assert.deepEqual([...sources.keys()].sort(), expectedPaths, 'runtime floor fixture must inventory every workflow using actions/setup-node')
  for (const workflow of config.workflows) {
    const source = sources.get(workflow.path)
    assert.ok(source, `${workflow.path} is listed in the runtime floor fixture but was not discovered`)
    const versions = [...source.matchAll(/^\s*node-version:\s*['"]?(\d+)['"]?\s*$/gm)].map((match) => Number(match[1]))
    assert.equal(versions.length, workflow.setupNodeCount, `${workflow.path} setup-node count must match the fixture`)
    for (const version of versions) {
      assert.ok(version >= schemaNodeFloor, `${workflow.path} Node ${version} is below schema minimum ${schemaNodeFloor}`)
    }
  }
}

function discoverWorkflowSources() {
  const directory = resolve(ROOT, '.github/workflows')
  return readdirSync(directory).sort()
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => {
      const path = `.github/workflows/${file}`
      return [path, readFileSync(resolve(ROOT, path), 'utf8')]
    })
    .filter(([, source]) => source.includes('actions/setup-node@'))
}

function readSchemaVersion(manifest) {
  const version = manifest.dependencies?.[SCHEMA_PACKAGE]
  assert.ok(typeof version === 'string' && version.length > 0, `package.json dependencies.${SCHEMA_PACKAGE} must contain one exact schema version`)
  return version
}

function readSchemaNodeFloor(lock, version) {
  const anchor = `  '${SCHEMA_PACKAGE}@${version}':`
  const start = lock.indexOf(anchor)
  assert.ok(start >= 0, `pnpm-lock.yaml must contain the exact ${anchor} package entry derived from package.json`)
  const end = lock.indexOf('\n\n', start)
  assert.ok(end >= 0, `${anchor} must be separated from the next pnpm lock package entry`)
  const entry = lock.slice(start, end)
  const match = entry.match(/^ {4}engines: \{node: '>=([0-9]+)'\}$/m)
  assert.ok(match, `${anchor} must declare an exact >=major Node engine`)
  return Number(match[1])
}

function readExactNodeFloor(value, label) {
  const match = typeof value === 'string' && value.match(/^>=([0-9]+)$/)
  assert.ok(match, `${label} must be an exact >=major Node engine range`)
  return Number(match[1])
}

function readExactNodeVersion(source, label) {
  const match = source.match(/^(\d+)\s*$/)
  assert.ok(match, `${label} must contain one exact major Node version`)
  return Number(match[1])
}

function applyMutation({ mutation, packageJson: manifest, lockfile: lock, workflowSources: sources, nodeVersionSource: nodeVersion }) {
  const mutatedWorkflowSources = new Map(sources)
  if (mutation.operation === 'remove') {
    assert.ok(mutatedWorkflowSources.has(mutation.path), `${mutation.name}: workflow removal target must be discovered before mutation`)
    mutatedWorkflowSources.delete(mutation.path)
    return { packageJson: manifest, lockfile: lock, workflowSources: mutatedWorkflowSources, nodeVersionSource: nodeVersion }
  }

  const schemaVersion = readSchemaVersion(manifest)
  const schemaNodeFloor = readSchemaNodeFloor(lock, schemaVersion)
  const packageNodeFloor = readExactNodeFloor(manifest.engines?.node, 'package.json engines.node')
  assert.equal(packageNodeFloor, schemaNodeFloor, `${mutation.name}: package.json engines.node must match the schema Node floor before mutation`)
  assert.ok(Math.min(packageNodeFloor, schemaNodeFloor) > 1, `${mutation.name}: runtime floors must be greater than one to derive a valid below-floor major`)
  const belowFloor = Math.min(packageNodeFloor, schemaNodeFloor) - 1

  if (mutation.operation === 'unsupported-range') {
    assert.equal(mutation.path, PACKAGE_PATH, `${mutation.name}: unsupported range mutation must target package.json`)
    const mutatedPackageJson = clonePackageJson(manifest)
    mutatedPackageJson.engines = { ...mutatedPackageJson.engines, node: `^${packageNodeFloor}` }
    return { packageJson: mutatedPackageJson, lockfile: lock, workflowSources: mutatedWorkflowSources, nodeVersionSource: nodeVersion }
  }

  if (mutation.operation !== 'below-floor') throw new Error(`${mutation.name}: unsupported runtime floor mutation operation ${JSON.stringify(mutation.operation)}`)
  if (mutation.path === PACKAGE_PATH) {
    const mutatedPackageJson = clonePackageJson(manifest)
    mutatedPackageJson.engines = { ...mutatedPackageJson.engines, node: `>=${belowFloor}` }
    return { packageJson: mutatedPackageJson, lockfile: lock, workflowSources: mutatedWorkflowSources, nodeVersionSource: nodeVersion }
  }
  if (mutation.path === LOCKFILE_PATH) {
    return { packageJson: manifest, lockfile: replaceSchemaNodeFloor(lock, schemaVersion, belowFloor, mutation.name), workflowSources: mutatedWorkflowSources, nodeVersionSource: nodeVersion }
  }
  if (mutation.path === NODE_VERSION_PATH) {
    return { packageJson: manifest, lockfile: lock, workflowSources: mutatedWorkflowSources, nodeVersionSource: replaceNodeVersion(nodeVersion, belowFloor, mutation.name) }
  }
  const source = mutatedWorkflowSources.get(mutation.path)
  assert.ok(source, `${mutation.name}: workflow mutation target must be discovered before mutation`)
  mutatedWorkflowSources.set(mutation.path, replaceWorkflowNodeVersion(source, mutation.occurrence, belowFloor, mutation.name))
  return { packageJson: manifest, lockfile: lock, workflowSources: mutatedWorkflowSources, nodeVersionSource: nodeVersion }
}

function clonePackageJson(manifest) {
  return JSON.parse(JSON.stringify(manifest))
}

function replaceSchemaNodeFloor(lock, version, nextFloor, name) {
  const anchor = `  '${SCHEMA_PACKAGE}@${version}':`
  const start = lock.indexOf(anchor)
  assert.ok(start >= 0, `${name}: schema lock mutation could not find the exact ${anchor} package entry`)
  const end = lock.indexOf('\n\n', start)
  assert.ok(end >= 0, `${name}: schema lock mutation package entry has no terminating separator`)
  const entry = lock.slice(start, end)
  const match = entry.match(/^( {4}engines: \{node: ')>=([0-9]+)('\})$/m)
  assert.ok(match, `${name}: schema lock mutation requires an exact >=major Node engine line`)
  const replacement = `${match[1]}>=${nextFloor}${match[3]}`
  return lock.slice(0, start) + entry.replace(match[0], replacement) + lock.slice(end)
}

function replaceNodeVersion(source, nextVersion, name) {
  const matches = [...source.matchAll(/^(\d+)\s*$/gm)]
  assert.equal(matches.length, 1, `${name}: .node-version must contain exactly one major version line, received ${matches.length}`)
  const match = matches[0]
  return source.slice(0, match.index) + String(nextVersion) + source.slice(match.index + match[0].length)
}

function replaceWorkflowNodeVersion(source, occurrence, nextVersion, name) {
  const matches = [...source.matchAll(/^(\s*node-version:\s*['"]?)(\d+)(['"]?\s*)$/gm)]
  assert.ok(Number.isInteger(occurrence) && occurrence >= 1 && occurrence <= matches.length, `${name}: workflow Node occurrence ${occurrence} is outside the ${matches.length}-occurrence setup-node inventory`)
  const match = matches[occurrence - 1]
  const replacement = `${match[1]}${nextVersion}${match[3]}`
  return source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length)
}

function parsePackageJson(source, label) {
  try {
    return JSON.parse(source)
  } catch (error) {
    throw new Error(`${label} must remain valid JSON while applying a runtime floor mutation: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function loadFixture(path) {
  const source = readFileSync(path, 'utf8')
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length > 0 || (source.match(/^---\s*$/gm) ?? []).length > 0) throw new Error('runtime floor fixture must be one strict YAML document with unique keys')
  const value = document.toJS()
  assert.deepEqual(Object.keys(value ?? {}).sort(), ['expectedMutationCount', 'mutations', 'workflows'], 'runtime floor fixture fields')
  assert.ok(Array.isArray(value.workflows) && value.workflows.length > 0, 'runtime floor must inventory workflows')
  assert.equal(new Set(value.workflows.map((workflow) => workflow.path)).size, value.workflows.length, 'runtime floor workflow paths must be unique')
  for (const [index, workflow] of value.workflows.entries()) {
    assert.deepEqual(Object.keys(workflow ?? {}).sort(), ['path', 'setupNodeCount'], `runtime floor workflow ${index} fields`)
    assert.ok(typeof workflow.path === 'string' && /\.ya?ml$/.test(workflow.path), `runtime floor workflow ${index} path`)
    assert.ok(Number.isInteger(workflow.setupNodeCount) && workflow.setupNodeCount > 0, `runtime floor workflow ${index} setup-node count`)
  }
  assert.ok(Array.isArray(value.mutations) && value.mutations.length === value.expectedMutationCount && value.mutations.length > 0, 'runtime floor mutations must match expectedMutationCount')
  assert.equal(new Set(value.mutations.map((mutation) => mutation?.name)).size, value.mutations.length, 'runtime floor mutation names must be unique')
  const mutablePaths = new Set([PACKAGE_PATH, LOCKFILE_PATH, NODE_VERSION_PATH, ...value.workflows.map((workflow) => workflow.path)])
  for (const [index, mutation] of value.mutations.entries()) {
    const operation = mutation?.operation
    const path = mutation?.path
    assert.ok(['below-floor', 'unsupported-range', 'remove'].includes(operation), `runtime floor mutation ${index} operation must be below-floor, unsupported-range, or remove`)
    const workflowBelowFloor = operation === 'below-floor' && typeof path === 'string' && path.startsWith('.github/workflows/')
    const fields = workflowBelowFloor
      ? ['expectedError', 'name', 'occurrence', 'operation', 'path']
      : ['expectedError', 'name', 'operation', 'path']
    assert.deepEqual(Object.keys(mutation ?? {}).sort(), fields, `runtime floor mutation ${index} fields`)
    for (const field of fields) {
      if (field === 'occurrence') assert.ok(Number.isInteger(mutation[field]) && mutation[field] > 0, `runtime floor mutation ${index} occurrence must be a positive integer`)
      else assert.ok(typeof mutation[field] === 'string' && mutation[field].length > 0, `runtime floor mutation ${index} ${field} must be a non-empty string`)
    }
    assert.ok(mutablePaths.has(path), `runtime floor mutation ${index} path must be a known mutable path`)
    if (operation === 'below-floor') assert.ok([PACKAGE_PATH, LOCKFILE_PATH, NODE_VERSION_PATH, ...value.workflows.map((workflow) => workflow.path)].includes(path), `runtime floor mutation ${index} below-floor path must be mutable`)
    if (operation === 'unsupported-range') assert.equal(path, PACKAGE_PATH, `runtime floor mutation ${index} unsupported-range path`)
    if (operation === 'remove') assert.ok(value.workflows.some((workflow) => workflow.path === path), `runtime floor mutation ${index} removal path must be an inventoried workflow`)
  }
  return value
}

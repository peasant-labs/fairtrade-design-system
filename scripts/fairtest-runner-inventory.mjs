#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { loadSingleDocument } from './fairtest-single-document.mjs'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const CORPUS_REL = 'scripts/testdata/fairtest-runner-inventory.yaml'
const MANIFEST_REL = 'scripts/testdata/fairtest-runner-inventory.manifest.yaml'

const COMMAND_FIELDS = ['name', 'invocation', 'owner', 'stage', 'runner']
const RUNNER_FIELDS = ['name', 'owner', 'model', 'themeBinding', 'ciOracle']
const GUIDANCE_FIELDS = ['path', 'owner', 'topic']
const ALLOWED_OWNERS = ['promotion-guardrails', 'fairtest-core', 'product-proof', 'component-proof', 'evidence-ci', 'local-bridge', 'existing']
const COMMAND_STAGES = ['browser-free', 'pre-service', 'process', 'mounted', 'verify', 'local-only']
const COMMAND_RUNNERS = ['none', 'child-contract', 'playwright-one-project', 'process-only', 'local-bridge']
const RUNNER_MODELS = ['one-project-row-scoped', 'existing-catalog', 'focused-compat', 'local-attach']
const THEME_BINDINGS = ['row-key', 'none']
const GUIDANCE_TOPICS = ['promotion', 'runner-inventory', 'terminology', 'workflow']
const CI_ORACLES = ['fairtest-mounted-rows', 'playwright-required-catalog']
const MUTATION_KINDS = ['delete-field', 'rename-field', 'unknown-field', 'bad-enum', 'stale-name', 'duplicate-name', 'delete-record', 'trailing-document', 'stale-guidance-content']

const corpusSource = readFileSync(resolve(ROOT, CORPUS_REL), 'utf8')
const manifestSource = readFileSync(resolve(ROOT, MANIFEST_REL), 'utf8')
const manifest = loadSingleDocument(manifestSource, MANIFEST_REL)
validateManifest(manifest)
const corpus = loadSingleDocument(corpusSource, CORPUS_REL)
validateInventory(corpus, CORPUS_REL)
checkRequiredNames(corpus.commands.map((command) => command.name), manifest.requiredCommandNames, CORPUS_REL, 'command')
checkRequiredNames(corpus.runners.map((runner) => runner.name), manifest.requiredRunnerNames, CORPUS_REL, 'runner')
checkRequiredNames(corpus.guidance.map((guide) => guide.path), manifest.requiredGuidancePaths, CORPUS_REL, 'guidance file')
checkGuidanceFragmentRefs(corpus, manifest)
checkGuidanceContent(readGuidanceEntries(ROOT, corpus), corpus.forbiddenGuidanceFragments, CORPUS_REL)
// A legal leading `---` start marker is still exactly one document.
loadSingleDocument(`---\n${corpusSource}`, CORPUS_REL)
runMutations(corpusSource, corpus, manifest)

console.log(`runner inventory: all ${corpus.commands.length} commands, ${corpus.runners.length} runners, and ${corpus.guidance.length} guidance files passed with all ${corpus.forbiddenGuidanceFragments.length} forbidden guidance fragments absent and all ${manifest.mutations.length} named mutations failing for their intended field.`)

export const REQUIRED_COMMAND_NAMES = manifest.requiredCommandNames
export const REQUIRED_RUNNER_NAMES = manifest.requiredRunnerNames
export const REQUIRED_GUIDANCE_PATHS = manifest.requiredGuidancePaths
export const REQUIRED_MUTATION_NAMES = manifest.requiredMutationNames
export const ALLOWED_COMMAND_OWNERS = ALLOWED_OWNERS
export const INVENTORY = corpus

function runMutations(source, parsed, manifestValue) {
  const fragments = parsed.forbiddenGuidanceFragments
  for (const mutation of manifestValue.mutations) {
    let message = null
    try {
      if (mutation.kind === 'trailing-document') {
        const trailing = mutation.style === 'end-marker'
          ? `${source.trimEnd()}\n...\n---\norphan: true\n`
          : `${source.trimEnd()}\n---\norphan: true\n`
        loadSingleDocument(trailing, CORPUS_REL)
      } else if (mutation.kind === 'stale-guidance-content') {
        const [, guidePath] = splitTarget(mutation)
        const entry = fragments.find((item) => item.name === mutation.fragment)
        assert.ok(entry, `${mutation.name}: unknown guidance fragment ${mutation.fragment}`)
        const original = readFileSync(resolve(ROOT, guidePath), 'utf8')
        checkGuidanceContent([{ path: guidePath, text: `${original}\nstale-guidance probe: ${entry.fragment}\n` }], fragments, CORPUS_REL)
      } else {
        const inventory = structuredClone(parsed)
        applyMutation(inventory, mutation)
        validateInventory(inventory, CORPUS_REL)
        checkRequiredNames(inventory.commands.map((command) => command.name), manifestValue.requiredCommandNames, CORPUS_REL, 'command')
        checkRequiredNames(inventory.runners.map((runner) => runner.name), manifestValue.requiredRunnerNames, CORPUS_REL, 'runner')
        checkRequiredNames(inventory.guidance.map((guide) => guide.path), manifestValue.requiredGuidancePaths, CORPUS_REL, 'guidance file')
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

function applyMutation(inventory, mutation) {
  const [family, identity] = splitTarget(mutation)
  if (mutation.kind === 'duplicate-name') {
    const records = inventory[family]
    const donor = records.find((record) => identityOf(family, record) !== identity) ?? records[0]
    const copy = structuredClone(donor)
    setIdentity(family, copy, identity)
    records.push(copy)
    return
  }
  if (mutation.kind === 'delete-record') {
    const records = inventory[family]
    const index = records.findIndex((record) => identityOf(family, record) === identity)
    assert.notEqual(index, -1, `${mutation.name}: unknown mutation target ${mutation.target}`)
    records.splice(index, 1)
    return
  }
  const record = inventory[family].find((item) => identityOf(family, item) === identity)
  assert.ok(record, `${mutation.name}: unknown mutation target ${mutation.target}`)
  if (mutation.kind === 'stale-name') {
    setIdentity(family, record, mutation.value)
    return
  }
  const segments = mutation.field.split('.')
  if (mutation.kind === 'delete-field') {
    deletePath(record, segments, mutation)
    return
  }
  if (mutation.kind === 'rename-field') {
    const value = getPath(record, segments, mutation)
    deletePath(record, segments, mutation)
    setPath(record, mutation.newField.split('.'), value, mutation)
    return
  }
  if (mutation.kind === 'unknown-field' || mutation.kind === 'bad-enum') {
    setPath(record, segmentsFor(mutation, family), mutation.value, mutation)
    return
  }
  throw new Error(`${mutation.name}: unsupported mutation kind ${mutation.kind}`)
}

function segmentsFor(mutation, family) {
  if (mutation.kind === 'stale-name') return [family === 'guidance' ? 'path' : 'name']
  return mutation.field.split('.')
}

function splitTarget(mutation) {
  const index = mutation.target.indexOf(':')
  assert.notEqual(index, -1, `${mutation.name}: mutation target ${mutation.target} must use family:identity form`)
  return [mutation.target.slice(0, index), mutation.target.slice(index + 1)]
}

function identityOf(family, record) {
  return family === 'guidance' ? record.path : record.name
}

function setIdentity(family, record, identity) {
  if (family === 'guidance') record.path = identity
  else record.name = identity
}

function validateManifest(value) {
  checkKeys(value, ['expectedCommandCount', 'requiredCommandNames', 'expectedRunnerCount', 'requiredRunnerNames', 'expectedGuidanceCount', 'requiredGuidancePaths', 'expectedGuidanceFragmentCount', 'requiredGuidanceFragmentNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], 'manifest', MANIFEST_REL)
  assert.equal(value.expectedCommandCount, 17, 'manifest: expectedCommandCount guard')
  assert.equal(value.expectedRunnerCount, 4, 'manifest: expectedRunnerCount guard')
  assert.equal(value.expectedGuidanceCount, 5, 'manifest: expectedGuidanceCount guard')
  assert.equal(value.expectedGuidanceFragmentCount, 5, 'manifest: expectedGuidanceFragmentCount guard')
  assert.equal(value.expectedMutationCount, 18, 'manifest: expectedMutationCount guard')
  assert.deepEqual([...value.requiredCommandNames].sort(), ['fairtest dev', 'test:adapter', 'test:bridge-contract', 'test:core', 'test:evidence', 'test:fairtest:compat', 'test:fairtest:init', 'test:fairtest:inventory', 'test:fairtest:list:ci', 'test:fairtest:list:local', 'test:fairtest:mounted', 'test:fairtest:preflight', 'test:fairtest:process', 'test:fairtest:promotion', 'test:fairtest:select', 'test:fairtest:selection-receipt', 'test:fairtest:verify'], 'manifest: required command inventory')
  assert.deepEqual([...value.requiredRunnerNames].sort(), ['agent-browser-optional-attach', 'fairtest-mounted-rows', 'playwright-required-catalog', 'puppeteer-focused-compat'], 'manifest: required runner inventory')
  assert.deepEqual([...value.requiredGuidancePaths].sort(), ['.github/workflows/ci.yml', 'AGENTS.md', 'CONTRIBUTING.md', 'docs/testing/test-promotion.md', 'scripts/journey/README.md'], 'manifest: required guidance inventory')
  assert.deepEqual([...value.requiredGuidanceFragmentNames].sort(), ['stale-agent-browser-oracle', 'stale-project-name-theme', 'stale-puppeteer-catalog', 'stale-two-project-model', 'stale-two-projects-plural'], 'manifest: required guidance fragment inventory')
  assert.equal(value.mutations.length, value.expectedMutationCount, 'manifest: mutation inventory count')
  checkRequiredNames(value.mutations.map((item) => item.name), value.requiredMutationNames, MANIFEST_REL, 'mutation')
  for (const [index, mutation] of value.mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field'].includes(mutation.kind)) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-enum'].includes(mutation.kind)) fields.push('field', 'value')
    if (mutation.kind === 'stale-name') fields.push('value')
    if (mutation.kind === 'stale-guidance-content') fields.push('fragment')
    if (mutation.kind === 'trailing-document' && mutation.style !== undefined) fields.push('style')
    checkKeys(mutation, fields, `manifest mutation ${index}`, MANIFEST_REL)
    assert.ok(MUTATION_KINDS.includes(mutation.kind), `manifest mutation ${index}: unknown kind ${mutation.kind}`)
    assert.ok(typeof mutation.expectedField === 'string' && mutation.expectedField.length, `manifest mutation ${index}: expectedField must name the intended field`)
    if (mutation.kind === 'trailing-document') {
      assert.equal(mutation.target, 'document', `manifest mutation ${index}: trailing-document targets the document`)
      if (mutation.style !== undefined) {
        assert.equal(mutation.style, 'end-marker', `manifest mutation ${index}: unknown trailing style ${mutation.style}`)
      }
    } else if (mutation.kind === 'stale-guidance-content') {
      const [family, identity] = splitTarget(mutation)
      assert.equal(family, 'guidance', `manifest mutation ${index}: stale-guidance-content targets a guidance file`)
      assert.ok(value.requiredGuidancePaths.includes(identity), `manifest mutation ${index}: unknown target ${mutation.target}`)
      assert.ok(typeof mutation.fragment === 'string' && mutation.fragment.length, `manifest mutation ${index}: fragment must name a forbidden guidance fragment`)
    } else {
      const [family, identity] = splitTarget(mutation)
      assert.ok(['commands', 'runners', 'guidance'].includes(family), `manifest mutation ${index}: unknown family ${family}`)
      const required = family === 'commands' ? value.requiredCommandNames : family === 'runners' ? value.requiredRunnerNames : value.requiredGuidancePaths
      assert.ok(required.includes(identity), `manifest mutation ${index}: unknown target ${mutation.target}`)
    }
  }
}

function validateInventory(value, label) {
  checkKeys(value, ['commands', 'runners', 'guidance', 'forbiddenGuidanceFragments'], 'document', label)
  assert.ok(Array.isArray(value.commands) && value.commands.length, `${label}: document holds no commands at path commands; repair: restore the named command list in ${CORPUS_REL}.`)
  assert.ok(Array.isArray(value.runners) && value.runners.length, `${label}: document holds no runners at path runners; repair: restore the named runner list in ${CORPUS_REL}.`)
  assert.ok(Array.isArray(value.guidance) && value.guidance.length, `${label}: document holds no guidance at path guidance; repair: restore the named guidance list in ${CORPUS_REL}.`)
  const seenCommands = new Set()
  for (const [index, command] of value.commands.entries()) {
    const path = `commands[${index}]`
    checkKeys(command, COMMAND_FIELDS, `command ${index}`, label, path)
    checkText(command.name, `command ${index}`, 'name', `${path}.name`, 'use the required command name from the manifest')
    checkText(command.invocation, `command "${command.name}"`, 'invocation', `${path}.invocation`, 'restore the exact pnpm invocation for the command')
    checkText(command.owner, `command "${command.name}"`, 'owner', `${path}.owner`, 'restore the owning area for the command')
    checkText(command.stage, `command "${command.name}"`, 'stage', `${path}.stage`, 'restore the execution stage for the command')
    checkText(command.runner, `command "${command.name}"`, 'runner', `${path}.runner`, 'restore the runner source for the command')
    if (seenCommands.has(command.name)) fail(`document: duplicate command name "${command.name}" at path ${path}.name; repair: give every command a unique required name and update the manifest inventory.`)
    seenCommands.add(command.name)
    if (!ALLOWED_OWNERS.includes(command.owner)) {
      fail(`command "${command.name}": invalid owner ${JSON.stringify(command.owner)} for field "owner" at path ${path}.owner; expected one of ${ALLOWED_OWNERS.join(', ')}; repair: restore the owning area named in the plan.`)
    }
    if (!COMMAND_STAGES.includes(command.stage)) {
      fail(`command "${command.name}": invalid value ${JSON.stringify(command.stage)} for field "stage" at path ${path}.stage; expected one of ${COMMAND_STAGES.join(', ')}; repair: restore the execution stage for the command.`)
    }
    if (!COMMAND_RUNNERS.includes(command.runner)) {
      fail(`command "${command.name}": invalid value ${JSON.stringify(command.runner)} for field "runner" at path ${path}.runner; expected one of ${COMMAND_RUNNERS.join(', ')}; repair: restore the runner source for the command.`)
    }
    if (!command.invocation.includes(command.name)) {
      fail(`command "${command.name}": invocation ${JSON.stringify(command.invocation)} for field "invocation" at path ${path}.invocation does not contain the command name; repair: restore the exact pnpm invocation that runs "${command.name}".`)
    }
  }
  const seenRunners = new Set()
  for (const [index, runner] of value.runners.entries()) {
    const path = `runners[${index}]`
    checkKeys(runner, RUNNER_FIELDS, `runner ${index}`, label, path)
    checkText(runner.name, `runner ${index}`, 'name', `${path}.name`, 'use the required runner name from the manifest')
    checkText(runner.owner, `runner "${runner.name}"`, 'owner', `${path}.owner`, 'restore the owning area for the runner')
    checkText(runner.model, `runner "${runner.name}"`, 'model', `${path}.model`, 'restore the runner model for the runner')
    checkText(runner.themeBinding, `runner "${runner.name}"`, 'themeBinding', `${path}.themeBinding`, 'restore the theme binding for the runner')
    if (seenRunners.has(runner.name)) fail(`document: duplicate runner name "${runner.name}" at path ${path}.name; repair: give every runner a unique required name and update the manifest inventory.`)
    seenRunners.add(runner.name)
    if (!ALLOWED_OWNERS.includes(runner.owner)) {
      fail(`runner "${runner.name}": invalid owner ${JSON.stringify(runner.owner)} for field "owner" at path ${path}.owner; expected one of ${ALLOWED_OWNERS.join(', ')}; repair: restore the owning area named in the plan.`)
    }
    if (!RUNNER_MODELS.includes(runner.model)) {
      fail(`runner "${runner.name}": invalid value ${JSON.stringify(runner.model)} for field "model" at path ${path}.model; expected one of ${RUNNER_MODELS.join(', ')}; repair: use the required one-project row-scoped mounted runner, keep the existing catalog entry, or mark the source focused-compat or local-attach.`)
    }
    if (!THEME_BINDINGS.includes(runner.themeBinding)) {
      fail(`runner "${runner.name}": invalid value ${JSON.stringify(runner.themeBinding)} for field "themeBinding" at path ${path}.themeBinding; expected one of ${THEME_BINDINGS.join(', ')}; repair: bind mounted rows by row key and keep other sources unbound.`)
    }
    if (typeof runner.ciOracle !== 'boolean') {
      fail(`runner "${runner.name}": invalid value ${JSON.stringify(runner.ciOracle)} for field "ciOracle" at path ${path}.ciOracle; expected true or false; repair: mark only the required mounted rows and the existing catalog as CI oracles.`)
    }
    if (runner.ciOracle && !CI_ORACLES.includes(runner.name)) {
      fail(`runner "${runner.name}": forbidden CI oracle ${JSON.stringify(runner.ciOracle)} for field "ciOracle" at path ${path}.ciOracle; expected false for "${runner.name}"; repair: keep focused compatibility and optional attach sources out of required CI.`)
    }
  }
  const seenGuidance = new Set()
  for (const [index, guide] of value.guidance.entries()) {
    const path = `guidance[${index}]`
    checkKeys(guide, GUIDANCE_FIELDS, `guidance ${index}`, label, path)
    checkText(guide.path, `guidance ${index}`, 'path', `${path}.path`, 'use the required guidance path from the manifest')
    checkText(guide.owner, `guidance "${guide.path}"`, 'owner', `${path}.owner`, 'restore the owning area for the guidance file')
    checkText(guide.topic, `guidance "${guide.path}"`, 'topic', `${path}.topic`, 'restore the topic for the guidance file')
    if (seenGuidance.has(guide.path)) fail(`document: duplicate guidance file "${guide.path}" at path ${path}.path; repair: list every guidance file once and update the manifest inventory.`)
    seenGuidance.add(guide.path)
    if (!ALLOWED_OWNERS.includes(guide.owner)) {
      fail(`guidance "${guide.path}": invalid owner ${JSON.stringify(guide.owner)} for field "owner" at path ${path}.owner; expected one of ${ALLOWED_OWNERS.join(', ')}; repair: restore the owning area named in the plan.`)
    }
    if (!GUIDANCE_TOPICS.includes(guide.topic)) {
      fail(`guidance "${guide.path}": invalid value ${JSON.stringify(guide.topic)} for field "topic" at path ${path}.topic; expected one of ${GUIDANCE_TOPICS.join(', ')}; repair: restore the topic for the guidance file.`)
    }
  }
  validateGuidanceFragments(value.forbiddenGuidanceFragments, label)
}

function validateGuidanceFragments(fragments, label) {
  if (!Array.isArray(fragments) || fragments.length === 0) {
    fail(`${label}: document holds no forbidden guidance fragments at path forbiddenGuidanceFragments; repair: restore the named stale-guidance fragment list in ${CORPUS_REL}.`)
  }
  const seen = new Set()
  for (const [index, entry] of fragments.entries()) {
    const path = `forbiddenGuidanceFragments[${index}]`
    checkKeys(entry, ['name', 'fragment'], `guidance fragment ${index}`, label, path)
    checkText(entry.name, `guidance fragment ${index}`, 'name', `${path}.name`, 'use the required fragment name from the manifest')
    checkText(entry.fragment, `guidance fragment "${entry.name}"`, 'fragment', `${path}.fragment`, 'restore the stale phrase this fragment forbids')
    if (seen.has(entry.name)) fail(`document: duplicate guidance fragment name "${entry.name}" at path ${path}.name; repair: give every forbidden fragment a unique required name and update the manifest inventory.`)
    seen.add(entry.name)
  }
}

function checkGuidanceFragmentRefs(corpus, manifestValue) {
  checkRequiredNames(corpus.forbiddenGuidanceFragments.map((entry) => entry.name), manifestValue.requiredGuidanceFragmentNames, CORPUS_REL, 'guidance fragment')
  const fragments = new Map(corpus.forbiddenGuidanceFragments.map((entry) => [entry.name, entry.fragment]))
  for (const mutation of manifestValue.mutations) {
    if (mutation.kind !== 'stale-guidance-content') continue
    assert.ok(fragments.has(mutation.fragment), `${mutation.name}: unknown guidance fragment ${mutation.fragment}`)
    assert.equal(mutation.expectedField, fragments.get(mutation.fragment), `${mutation.name}: expectedField must equal the forbidden fragment text`)
  }
}

function readGuidanceEntries(root, corpus) {
  return corpus.guidance.map((guide) => {
    try {
      return { path: guide.path, text: readFileSync(resolve(root, guide.path), 'utf8') }
    } catch {
      fail(`guidance "${guide.path}": required guidance file is missing or unreadable at path guidance-content:${guide.path}; repair: restore ${guide.path} in the checkout.`)
    }
  })
}

function checkGuidanceContent(entries, fragments, label) {
  for (const { path, text } of entries) {
    const lower = text.toLowerCase()
    for (const entry of fragments) {
      if (lower.includes(entry.fragment.toLowerCase())) {
        fail(`guidance "${path}": stale forbidden fragment ${JSON.stringify(entry.fragment)} from fragment "${entry.name}" for field "guidance-content" at path guidance-content:${path} in ${label}; repair: remove the stale runner guidance from ${path} and keep the one-project row-scoped mounted runner, focused puppeteer compat, and local-only attach wording.`)
      }
    }
  }
}

function checkKeys(value, fields, tag, label, path = '', prefix = '') {
  const where = path ? ` at path ${path}` : ''
  const named = prefix ? `${prefix} ` : ''
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${tag}: ${named}object is missing or malformed${where} in ${label}; repair: restore the ${named}object with exactly: ${fields.join(', ')}.`)
  }
  const dotted = (field) => (prefix ? `${prefix}.${field}` : field)
  for (const field of fields) {
    if (!(field in value)) fail(`${tag}: missing required field "${dotted(field)}"${where}; repair: restore "${dotted(field)}" in ${label}.`)
  }
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) fail(`${tag}: unknown field "${dotted(key)}"${where}; repair: remove "${dotted(key)}" from ${label}.`)
  }
}

function checkText(value, tag, field, path, repair) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${tag}: missing or invalid field "${field}" at path ${path}; repair: ${repair}.`)
  }
}

function checkRequiredNames(actual, required, label, kind) {
  assert.equal(new Set(actual).size, actual.length, `${label}: ${kind} names unique`)
  assert.equal(new Set(required).size, required.length, `${label}: required ${kind} names unique`)
  for (const name of actual) {
    if (!required.includes(name)) fail(`document: required ${kind} inventory mismatch at path ${kind === 'guidance file' ? 'guidance' : `${kind}s`} in ${label}; unknown ${kind} "${name}" with observed value "${name}"; repair: remove the "${name}" ${kind} or register it in the manifest required names.`)
  }
  for (const name of required) {
    if (!actual.includes(name)) fail(`document: required ${kind} inventory mismatch at path ${kind === 'guidance file' ? 'guidance' : `${kind}s`} in ${label}; missing required ${kind} "${name}"; repair: restore the "${name}" ${kind} or update the manifest required names.`)
  }
}

function getPath(root, segments, mutation) {
  let node = root
  for (const segment of segments) {
    if (!node || typeof node !== 'object' || !(segment in node)) {
      throw new Error(`${mutation.name}: mutation field ${mutation.field} is absent from ${mutation.target}`)
    }
    node = node[segment]
  }
  return node
}

function setPath(root, segments, value, mutation) {
  let node = root
  for (const segment of segments.slice(0, -1)) {
    if (!node[segment] || typeof node[segment] !== 'object') node[segment] = {}
    node = node[segment]
  }
  node[segments.at(-1)] = value
}

function deletePath(root, segments, mutation) {
  const parent = segments.length === 1 ? root : getPath(root, segments.slice(0, -1), mutation)
  delete parent[segments.at(-1)]
}

function fail(message) {
  throw new Error(message)
}

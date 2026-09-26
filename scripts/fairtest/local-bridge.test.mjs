// Local bridge contract tests. Every behavioral case lives in the named
// local-bridge YAML family with a required-name manifest; this file owns no
// case data except the small structural units and their named source
// mutations. It imports the real child source through the sole source route
// and runs browser-free with node builtins plus the shared fixture helpers. No
// browser, runner, service, or network is required.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { importFairtestSource, resolveFairtestSource } from '../fairtest-source.mjs'
import { FAIRTEST_REPO_ROOT } from './fairtest-runtime.mjs'
import * as dev from './fairtest-dev.mjs'

const core = await importFairtestSource('src/core/index.mjs')
const local = await importFairtestSource('src/bridge/local.mjs')
const LOCAL_SOURCE_REL = 'src/bridge/local.mjs'

const HERE = resolve(FAIRTEST_REPO_ROOT, 'scripts', 'fairtest')
const CORPUS = 'local-bridge.testdata.yaml'
const MANIFEST = 'local-bridge.testdata.manifest.yaml'
const DEV_COMMAND_REL = 'scripts/fairtest/fairtest-dev.mjs'
const DEV_COMMAND = 'node scripts/fairtest/fairtest-dev.mjs'
const LOCAL_TEST_COMMAND = 'node --test scripts/fairtest/local-bridge.test.mjs'
const CHECKS = ['identity', 'declaration', 'scenario', 'provenance', 'readout', 'readiness', 'cleanup']
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])

/** @param {string} relative @returns {Record<string, unknown>} */
function readFamily(relative) {
  return /** @type {Record<string, unknown>} */ (core.loadSingleDocument(readFileSync(resolve(HERE, relative), 'utf8'), relative))
}

/** @param {string} relative @returns {string} */
function readSource(relative) {
  return readFileSync(resolve(HERE, relative), 'utf8')
}

/** @param {unknown} value */
function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * The exact extra payload field each check carries. One declaration site, read
 * by the shape validator and by the behavioral runner so an added check cannot
 * be described by one and executed by another.
 * @type {Record<string, string[]>}
 */
const CHECK_FIELDS = Object.freeze({
  identity: ['identity'],
  declaration: ['identity', 'capabilities'],
  scenario: ['scenario'],
  provenance: ['provenance'],
  readout: ['readout'],
  readiness: ['identity', 'readiness'],
  cleanup: ['identity', 'cleanup'],
})

/** @param {Record<string, unknown>} manifest @param {string} label */
function validateManifest(manifest, label) {
  core.assertExactFields(manifest, ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], label, 'manifest')
  const cases = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(cases).size, cases.length, `${label}: required case names must be unique`)
  assert.equal(manifest.expectedCaseCount, cases.length, `${label}: case count must equal the required-name inventory`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${label}: mutation count must equal the mutation inventory`)
  core.checkRequiredNames(mutations.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredMutationNames), label)
  for (const [index, mutation] of mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('value')
    core.assertExactFields(mutation, fields, label, `manifest.mutations[${index}]`)
    assert.ok(MUTATION_KINDS.has(/** @type {string} */ (mutation.kind)), `${label}: mutation ${index} names an unknown kind`)
    if (mutation.kind === 'trailing-document') {
      assert.equal(mutation.target, 'document', `${label}: mutation ${index} trailing-document targets the document`)
    } else {
      assert.ok(cases.includes(/** @type {string} */ (mutation.target)), `${label}: mutation ${index} targets an unknown case`)
    }
  }
}

/** @param {Record<string, unknown>} value */
function validateFamilyShape(value) {
  const label = CORPUS
  core.assertExactFields(value, ['expectedCaseCount', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no cases at path cases; repair: restore the named cases list.`)
  for (const [index, entry] of cases.entries()) {
    if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
      throw new Error(`${label}: case ${index} is missing its required name at path cases[${index}].name; repair: restore the required case name.`)
    }
    if (!CHECKS.includes(/** @type {string} */ (entry.check))) {
      throw new Error(`${label}: case "${entry.name}" names an unknown discriminator ${JSON.stringify(entry.check)} for field "check" at path cases[${index}].check; repair: use one of ${CHECKS.join(', ')} for "check".`)
    }
    const path = `cases[${index}]`
    const payload = CHECK_FIELDS[/** @type {string} */ (entry.check)]
    if (entry.expectValid) {
      core.assertExactFields(entry, ['name', 'check', ...payload, 'expectValid'], label, path)
    } else {
      core.assertExactFields(entry, ['name', 'check', ...payload, 'expectValid', 'expectedErrorContains'], label, path)
      const fragments = entry.expectedErrorContains
      if (!Array.isArray(fragments) || fragments.length === 0 || fragments.some((fragment) => typeof fragment !== 'string' || fragment.length === 0)) {
        throw new Error(`${label}: expected a non-empty string list at path ${path}.expectedErrorContains; repair: restore the diagnostic fragment list at ${path}.expectedErrorContains.`)
      }
    }
  }
}

/** @param {string[]} fragments @param {string} message @param {string} name */
function expectFragments(fragments, message, name) {
  for (const fragment of fragments) {
    assert.ok(message.includes(fragment), `${name}: diagnostic is missing ${JSON.stringify(fragment)}; got ${message}`)
  }
}

/** @param {Record<string, unknown>} entry */
function runCase(entry) {
  const name = /** @type {string} */ (entry.name)
  let message = null
  try {
    let created = null
    if (entry.check === 'identity') created = local.validateLocalInvocationIdentity(entry.identity, name)
    else if (entry.check === 'declaration') created = local.createLocalBridgeDeclaration(entry.identity, entry.capabilities)
    else if (entry.check === 'scenario') created = local.validateLocalScenario(entry.scenario, name)
    else if (entry.check === 'provenance') created = local.validateLocalProvenance(entry.provenance, name)
    else if (entry.check === 'readout') created = local.validateLocalReadout(entry.readout, name)
    else if (entry.check === 'readiness') created = local.validateLocalReadiness(entry.readiness, entry.identity, name)
    else created = local.validateLocalCleanup(entry.cleanup, entry.identity, name)
    assert.ok(created && Object.isFrozen(created), `${name}: local bridge record must be frozen`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid local bridge record failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid local bridge record passed validation`)
    expectFragments(/** @type {string[]} */ (entry.expectedErrorContains), message, name)
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

describe('local bridge contract fixture family', () => {
  const source = readSource(CORPUS)
  const manifest = readFamily(MANIFEST)
  const parsed = readFamily(CORPUS)

  it('holds a valid manifest inventory', () => {
    validateManifest(manifest, MANIFEST)
  })

  it('holds exact fields and required names', () => {
    validateFamilyShape(parsed)
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    assert.equal(cases.length, manifest.expectedCaseCount, `${CORPUS}: case count must match the manifest`)
    core.checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
  })

  it('executes every behavioral case', () => {
    for (const entry of /** @type {Record<string, unknown>[]} */ (parsed.cases)) runCase(entry)
  })

  it('fails every executable mutation for its intended field', () => {
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          core.loadSingleDocument(`${source.trimEnd()}\n---\norphan: true\n`, CORPUS)
        } else {
          const cases = structuredClone(/** @type {Record<string, unknown>[]} */ (parsed.cases))
          applyMutation(cases, mutation)
          validateFamilyShape({ ...parsed, cases })
          core.checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
          for (const entry of cases) runCase(entry)
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${CORPUS}: mutation "${mutation.name}" passed validation instead of failing`)
      assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${CORPUS}: mutation "${mutation.name}" names the wrong field; got ${message}`)
      assert.ok(message.includes('at path'), `${CORPUS}: mutation "${mutation.name}" is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `${CORPUS}: mutation "${mutation.name}" is missing repair guidance: ${message}`)
    }
  })
})

describe('local bridge command declaration', () => {
  const pkg = JSON.parse(readSource('../../package.json'))
  const inventory = /** @type {Record<string, unknown>} */ (core.loadSingleDocument(readSource('../testdata/fairtest-runner-inventory.yaml'), 'fairtest-runner-inventory.yaml'))

  it('declares the dev and local-bridge test scripts and the inventory rows', () => {
    assert.equal(pkg.scripts?.fairtest, DEV_COMMAND, `${DEV_COMMAND_REL}: package script "fairtest" must run this command; repair: declare "fairtest" as ${JSON.stringify(DEV_COMMAND)}.`)
    assert.equal(pkg.scripts?.['test:fairtest:local-bridge'], LOCAL_TEST_COMMAND, `package.json: the local bridge test command must be declared; repair: declare "test:fairtest:local-bridge" as ${JSON.stringify(LOCAL_TEST_COMMAND)}.`)
    const devRows = /** @type {Record<string, unknown>[]} */ (inventory.commands).filter((row) => row.name === 'fairtest dev')
    assert.equal(devRows.length, 1, 'runner inventory: "fairtest dev" must be declared exactly once; repair: restore the local-only dev command row.')
    assert.equal(devRows[0].stage, 'local-only', 'runner inventory: "fairtest dev" must stay local-only; repair: keep the interactive dev command out of required CI.')
    assert.equal(devRows[0].runner, 'local-bridge', 'runner inventory: "fairtest dev" must use the local-bridge runner source.')
    assert.equal(devRows[0].owner, 'local-bridge', 'runner inventory: "fairtest dev" must be owned by the local-bridge area.')
    const testRows = /** @type {Record<string, unknown>[]} */ (inventory.commands).filter((row) => row.name === 'test:fairtest:local-bridge')
    assert.equal(testRows.length, 1, 'runner inventory: "test:fairtest:local-bridge" must be declared exactly once; repair: register the local bridge test command row.')
  })

  it('selects the exact mounted-proof target ids rather than a second registry', () => {
    assert.equal(dev.devTargetSpec('product').targetId, 'fairtrade-graph-product', 'the product local bridge must reuse the mounted product target id')
    assert.equal(dev.devTargetSpec('component').targetId, 'fairtrade-sgd-story', 'the component local bridge must reuse the mounted component target id')
    assert.deepEqual(dev.DEV_REQUIRED_CI_MOUNT.status, 'local-only', 'fairtest dev must declare itself local-only')
    assert.ok(dev.DEV_REQUIRED_CI_MOUNT.reason.length > 0, 'the local-only status must state why it is not in required CI')
  })

  it('keeps the dev command out of every required CI workflow', () => {
    for (const workflow of ['ci.yml']) {
      const text = readFileSync(resolve(FAIRTEST_REPO_ROOT, '.github', 'workflows', workflow), 'utf8')
      assert.ok(!text.includes('fairtest dev'), `.github/workflows/${workflow}: interactive local dev must never be a required CI step`)
    }
  })

  it('prints the attach instruction only when asked and never invokes the tool', () => {
    const lines = dev.attachInstruction('synthetic/route')
    assert.ok(lines.join('\n').includes('agent-browser'), 'the optional attach instruction must name the already-installed tool')
    assert.ok(!lines.join('\n').includes('--target'), 'the attach instruction must stay a plain attach hint, not a command rerun')
    assert.deepEqual(dev.parseDevArgs(['dev', '--target=product']).attach, false, 'attach must default off so the bridge is useful without the optional tool')
    assert.equal(dev.parseDevArgs(['dev', '--target=product', '--attach']).attach, true, '--attach must opt in to the instruction')
  })
})

describe('local bridge source isolation', () => {
  const devSource = readSource('fairtest-dev.mjs')
  const localSource = readFileSync(resolveFairtestSource(LOCAL_SOURCE_REL), 'utf8')

  it('keeps the command loopback-only and free of an agent-browser import or invocation', () => {
    assert.ok(devSource.includes('host: FAIRTEST_APP_HOST'), 'the dev command must bind the shared loopback host')
    assert.ok(!/0\.0\.0\.0|['"]::['"]/.test(devSource), 'the dev command must never bind a wildcard interface')
    assert.ok(!/(?:import|from)\s*['"][^'"]*agent-browser[^'"]*['"]/.test(devSource), 'the dev command must not import agent-browser')
    assert.ok(!/(?:spawn|spawnSync|exec|execFile|execFileSync|execSync)\s*\([^)]*agent-browser/.test(devSource), 'the dev command must not invoke agent-browser')
  })

  it('keeps the neutral local contract free of a runner, endpoint, or app literal', () => {
    assert.ok(!/playwright|puppeteer|jsdom|storybook|agent-browser/i.test(localSource), `${'local.mjs'}: the neutral local contract must not name a runner`)
    assert.ok(!/https?:\/\/|localhost|127\.0\.0\.1/.test(localSource), 'local.mjs: the neutral local contract must not name an endpoint literal')
    assert.ok(!/\bwindow\b|\bnavigator\b|\bglobalThis\b/.test(localSource), 'local.mjs: the neutral local contract must not name a page global')
  })

  it('fails every source mutation for its intended field', () => {
    const mutations = [
      {
        name: 'removing the fairtest package script leaves the local bridge undeclared',
        run: () => {
          const mutated = structuredClone(devPackage())
          delete mutated.scripts.fairtest
          guardPackageDeclaration(mutated)
        },
        expected: 'scripts.fairtest',
      },
      {
        name: 'moving the dev command out of the local-only stage breaks the local-only guard',
        run: () => {
          const mutated = structuredClone(devInventory())
          const row = /** @type {Record<string, unknown>[]} */ (mutated.commands).find((entry) => entry.name === 'fairtest dev')
          row.stage = 'mounted'
          guardInventoryDeclaration(mutated)
        },
        expected: 'stage',
      },
      {
        name: 'injecting an agent-browser invocation breaks the no-invocation guard',
        run: () => guardNoAgentBrowserInvocation(`${devSource}\nspawnSync('agent-browser', [])\n`),
        expected: 'agent-browser',
      },
      {
        name: 'replacing the loopback host with a wildcard breaks the loopback-only guard',
        run: () => guardLoopbackOnly(devSource.replace('host: FAIRTEST_APP_HOST', "host: '0.0.0.0'")),
        expected: 'host',
      },
      {
        name: 'injecting an endpoint literal into the neutral contract breaks the neutrality guard',
        run: () => guardNeutralLocalSource(`${localSource}\nconst endpoint = 'localhost'\n`),
        expected: 'endpoint literal',
      },
    ]
    for (const mutation of mutations) {
      let message = null
      try {
        mutation.run()
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `source mutation "${mutation.name}" passed its guard instead of failing`)
      assert.ok(message.includes(mutation.expected), `source mutation "${mutation.name}" names the wrong field; got ${message}`)
      assert.ok(message.includes('at path'), `source mutation "${mutation.name}" is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `source mutation "${mutation.name}" is missing repair guidance: ${message}`)
    }
  })

  function devPackage() {
    return JSON.parse(readSource('../../package.json'))
  }

  function devInventory() {
    return /** @type {Record<string, unknown>} */ (core.loadSingleDocument(readSource('../testdata/fairtest-runner-inventory.yaml'), 'fairtest-runner-inventory.yaml'))
  }

  function guardPackageDeclaration(pkg) {
    if (pkg.scripts?.fairtest !== DEV_COMMAND) {
      throw new Error(`package.json: missing dev command for field "scripts.fairtest" at path package.json.scripts.fairtest; observed ${JSON.stringify(pkg.scripts?.fairtest)}; repair: declare "fairtest" as ${JSON.stringify(DEV_COMMAND)}.`)
    }
    if (pkg.scripts?.['test:fairtest:local-bridge'] !== LOCAL_TEST_COMMAND) {
      throw new Error(`package.json: missing local bridge test command for field "scripts.test:fairtest:local-bridge" at path package.json.scripts.test:fairtest:local-bridge; repair: declare it as ${JSON.stringify(LOCAL_TEST_COMMAND)}.`)
    }
  }

  function guardInventoryDeclaration(inventory) {
    const row = /** @type {Record<string, unknown>[]} */ (inventory.commands).find((entry) => entry.name === 'fairtest dev')
    if (!row) {
      throw new Error('runner inventory: missing dev command row for field "commands" at path scripts/testdata/fairtest-runner-inventory.yaml.commands; repair: restore the local-only dev command row.')
    }
    if (row.stage !== 'local-only' || row.runner !== 'local-bridge') {
      throw new Error(`runner inventory: dev command stage drifted for field "stage" at path scripts/testdata/fairtest-runner-inventory.yaml.commands; observed ${JSON.stringify(row.stage)}/${JSON.stringify(row.runner)}; repair: keep "fairtest dev" local-only with the local-bridge runner source.`)
    }
  }

  function guardNoAgentBrowserInvocation(text) {
    if (/(?:spawn|spawnSync|exec|execFile|execFileSync|execSync)\s*\([^)]*agent-browser/.test(text)) {
      throw new Error(`${DEV_COMMAND_REL}: the dev command invokes agent-browser for field "agent-browser" at path ${DEV_COMMAND_REL}; repair: never spawn, import, or install agent-browser from Fairtest.`)
    }
  }

  function guardLoopbackOnly(text) {
    if (/0\.0\.0\.0|['"]::['"]/.test(text)) {
      throw new Error(`${DEV_COMMAND_REL}: non-loopback host for field "host" at path ${DEV_COMMAND_REL}; repair: bind FAIRTEST_APP_HOST only.`)
    }
    if (!text.includes('host: FAIRTEST_APP_HOST')) {
      throw new Error(`${DEV_COMMAND_REL}: missing loopback bind for field "host" at path ${DEV_COMMAND_REL}; repair: pass FAIRTEST_APP_HOST to the declared driver.`)
    }
  }

  function guardNeutralLocalSource(text) {
    if (/https?:\/\/|localhost|127\.0\.0\.1/.test(text)) {
      throw new Error(`local.mjs: endpoint literal for field "endpoint literal" at path ${LOCAL_SOURCE_REL}; repair: keep hosts and URLs caller-owned in the app-owned command.`)
    }
  }
})

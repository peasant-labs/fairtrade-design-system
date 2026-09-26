// Bridge contract tests. Every behavioral case lives in the named
// bridge-contract YAML family with a required-name manifest; this file owns
// no case data except small structural unit asserts. Imports the real child
// source (the shared host-contract bridge plus the local and process
// invocation contracts) and runs browser-free with node builtins plus the
// declared yaml dependency. No service, runner, process, or network is
// required. The CI-wiring guard reads the required workflow text only.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'
import { assertExactFields, checkRequiredNames, loadSingleDocument } from '../src/core/index.mjs'
import {
  BRIDGE_CAPABILITIES,
  BRIDGE_IDENTITY_KINDS,
  BRIDGE_REQUIRED_CAPABILITIES,
  BRIDGE_SIGNALS,
  assertBridgeKind,
  createBridgeDeclaration,
  requiresBridgeCapability,
  validateBridgeCleanup,
  validateBridgeDeclaration,
  validateBridgeIdentity,
  validateBridgeReadiness,
  validateCoreIdentityForBridge,
} from '../src/host-contract/index.mjs'
import * as localBridge from '../src/bridge/local.mjs'
import * as processBridge from '../src/bridge/process.mjs'

const TESTDATA = new URL('../testdata/', import.meta.url)
const CONTRACT_DIR = new URL('../src/host-contract/', import.meta.url)
const WORKFLOWS_DIR = new URL('../../../.github/workflows/', import.meta.url)
const CHILD_MANIFEST = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])
const CORPUS = 'bridge-contract.yaml'
const MANIFEST = 'bridge-contract.manifest.yaml'

/**
 * The exact extra payload field each check carries. One declaration site, read
 * by the shape validator and by the behavioral runner so an added check cannot
 * be described by one and executed by another.
 * @type {Record<string, string[]>}
 */
const CHECK_FIELDS = Object.freeze({
  identity: ['identity'],
  declaration: ['declaration'],
  readiness: ['readiness'],
  cleanup: ['cleanup'],
  'local-identity': ['identity'],
  'process-identity': ['identity'],
  'local-readout': ['readout'],
  'process-readiness': ['identity', 'readiness'],
  'process-receipt': ['receipt'],
})
const CHECKS = Object.keys(CHECK_FIELDS)

/** @returns {Record<string, unknown>} */
function readFamily(relative) {
  return /** @type {Record<string, unknown>} */ (loadSingleDocument(readFileSync(new URL(relative, TESTDATA), 'utf8'), relative))
}

function readSource(relative) {
  return readFileSync(new URL(relative, TESTDATA), 'utf8')
}

/** @param {unknown} value */
function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** @param {Record<string, unknown>} manifest @param {string} label */
function validateManifest(manifest, label) {
  assertExactFields(manifest, ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], label, 'manifest')
  const cases = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(cases).size, cases.length, `${label}: required case names must be unique`)
  assert.equal(manifest.expectedCaseCount, cases.length, `${label}: case count must equal the required-name inventory`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${label}: mutation count must equal the mutation inventory`)
  checkRequiredNames(mutations.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredMutationNames), label)
  for (const [index, mutation] of mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('value')
    assertExactFields(mutation, fields, label, `manifest.mutations[${index}]`)
    assert.ok(MUTATION_KINDS.has(/** @type {string} */ (mutation.kind)), `${label}: mutation ${index} names an unknown kind`)
    if (mutation.kind === 'trailing-document') {
      assert.equal(mutation.target, 'document', `${label}: mutation ${index} trailing-document targets the document`)
    } else {
      assert.ok(cases.includes(/** @type {string} */ (mutation.target)), `${label}: mutation ${index} targets an unknown case`)
    }
  }
}

/** @param {Record<string, unknown>} value @param {string} label @param {number} index */
function checkCaseName(value, label, index) {
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new Error(`${label}: case ${index} is missing its required name at path cases[${index}].name; repair: restore the required case name.`)
  }
}

/** @param {Record<string, unknown>} value */
function validateFamilyShape(value) {
  const label = CORPUS
  assertExactFields(value, ['expectedCaseCount', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no cases at path cases; repair: restore the named cases list.`)
  for (const [index, entry] of cases.entries()) {
    checkCaseName(entry, label, index)
    if (!CHECKS.includes(/** @type {string} */ (entry.check))) {
      throw new Error(`${label}: case "${entry.name}" names an unknown discriminator ${JSON.stringify(entry.check)} for field "check" at path cases[${index}].check; repair: use one of ${CHECKS.join(', ')} for "check".`)
    }
    const path = `cases[${index}]`
    const payload = CHECK_FIELDS[/** @type {string} */ (entry.check)]
    if (entry.expectValid) {
      assertExactFields(entry, ['name', 'check', ...payload, 'expectValid'], label, path)
    } else {
      assertExactFields(entry, ['name', 'check', ...payload, 'expectValid', 'expectedErrorContains'], label, path)
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
    if (entry.check === 'identity') {
      created = validateBridgeIdentity(entry.identity, name)
      assertBridgeKind(created.kind, 'probe')
    } else if (entry.check === 'declaration') {
      created = validateBridgeDeclaration(entry.declaration, name)
    } else if (entry.check === 'readiness') {
      created = validateBridgeReadiness(entry.readiness, name)
    } else if (entry.check === 'cleanup') {
      created = validateBridgeCleanup(entry.cleanup, name)
    } else if (entry.check === 'local-identity') {
      created = localBridge.validateLocalInvocationIdentity(entry.identity, name)
    } else if (entry.check === 'process-identity') {
      created = processBridge.validateProcessInvocationIdentity(entry.identity, name)
    } else if (entry.check === 'local-readout') {
      created = localBridge.validateLocalReadout(entry.readout, name)
    } else if (entry.check === 'process-readiness') {
      created = processBridge.validateProcessReadiness(entry.readiness, entry.identity, name)
    } else {
      created = processBridge.validateProcessCleanupReceipt(entry.receipt, name)
    }
    assert.ok(Object.isFrozen(created), `${name}: bridge record must be frozen`)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (entry.expectValid) {
    assert.equal(message, null, `${name}: valid bridge record failed: ${message}`)
  } else {
    assert.ok(message, `${name}: invalid bridge record passed validation`)
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

describe('bridge contract fixture family', () => {
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
    checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
  })

  it('executes every behavioral case', () => {
    for (const entry of /** @type {Record<string, unknown>[]} */ (parsed.cases)) runCase(entry)
  })

  it('fails every executable mutation for its intended field', () => {
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          loadSingleDocument(`${source.trimEnd()}\n---\norphan: true\n`, CORPUS)
        } else {
          const cases = structuredClone(/** @type {Record<string, unknown>[]} */ (parsed.cases))
          applyMutation(cases, mutation)
          validateFamilyShape({ ...parsed, cases })
          checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), CORPUS)
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

describe('bridge contract structural units', () => {
  it('pins the bridge command to this contract test', () => {
    assert.ok(
      String(CHILD_MANIFEST.scripts?.['test:bridge-contract'] ?? '').includes('test/bridge-contract.test.mjs'),
      'test:bridge-contract must run the bridge contract test file',
    )
  })

  it('imports the real bridge source and stays Node-only', () => {
    for (const fn of [assertBridgeKind, createBridgeDeclaration, requiresBridgeCapability, validateBridgeCleanup, validateBridgeDeclaration, validateBridgeIdentity, validateBridgeReadiness, validateCoreIdentityForBridge]) {
      assert.equal(typeof fn, 'function', 'host-contract barrel must export every bridge validator')
    }
    for (const fn of [localBridge.validateLocalInvocationIdentity, localBridge.validateLocalReadout]) {
      assert.equal(typeof fn, 'function', 'the local bridge contract must export its identity and readout validators')
    }
    for (const fn of [processBridge.validateProcessInvocationIdentity, processBridge.validateProcessReadiness, processBridge.validateProcessCleanupReceipt]) {
      assert.equal(typeof fn, 'function', 'the process bridge contract must export its identity, readiness, and receipt validators')
    }
    assert.deepEqual([...processBridge.PROCESS_CASE_IDS], ['process-normal-stop', 'process-partial-start', 'process-bounded-timeout', 'process-sigterm-interruption'])
    assert.deepEqual([...BRIDGE_IDENTITY_KINDS], ['local', 'process'])
    assert.deepEqual([...BRIDGE_SIGNALS], ['completed', 'terminated', 'interrupted'])
    assert.ok(BRIDGE_CAPABILITIES.includes('report-readiness') && BRIDGE_REQUIRED_CAPABILITIES.includes('cleanup-process'), 'bridge capabilities must share the readiness and cleanup vocabulary')
    assert.equal(typeof window, 'undefined', 'contract must not load a window global')
    assert.equal(typeof document, 'undefined', 'contract must not load a document global')
  })

  it('answers capability questions from validated declarations only', () => {
    const declaration = createBridgeDeclaration({
      kind: 'process',
      identity: { kind: 'process', id: 'bridge-process-a', createdAtMs: 1000 },
      capabilities: ['describe-target', 'report-readiness', 'cleanup-process'],
    })
    assert.equal(requiresBridgeCapability(declaration, 'report-readiness'), true)
    assert.equal(requiresBridgeCapability(declaration, 'observe-route'), false)
    assert.throws(() => requiresBridgeCapability({ ...declaration, capabilities: [] }, 'report-readiness'), /capabilities.*at path.*repair:/s, 'capability questions must revalidate the declaration')
  })

  it('keeps bridge identities distinct from core identities', () => {
    const coreIdentity = validateCoreIdentityForBridge({ kind: 'run', id: 'contract-row-a', createdAtMs: 1000 }, 'probe')
    assert.equal(coreIdentity.kind, 'run')
    assert.throws(() => validateBridgeIdentity(coreIdentity, 'probe'), /bridge kind.*at path.*repair:/s, 'core identity must fail the bridge kind check')
  })

  it('carries no runner, live handle, endpoint, or address literal', () => {
    for (const entry of readdirSync(CONTRACT_DIR).filter((name) => name.endsWith('.mjs')).sort()) {
      if (entry !== 'bridge.mjs') continue
      const text = readFileSync(new URL(entry, CONTRACT_DIR), 'utf8')
      assert.ok(!/playwright|puppeteer|jsdom|storybook|agent-browser/i.test(text), `${entry}: source names a runner`)
      assert.ok(!/\bwindow\b|\bnavigator\b|\bglobalThis\b/.test(text), `${entry}: source names a page global`)
      assert.ok(!/localhost|127\.0\.0\.1|https?:\/\//.test(text), `${entry}: source names an endpoint literal`)
      assert.ok(!/:\d{4}(?!\d)/.test(text), `${entry}: source pins a numeric channel literal`)
    }
  })
})

// ── CI wiring guard ─────────────────────────────────────────────────────
//
// Required CI owns exactly one Fairtest process invocation: the process-only
// command, after the selection receipt and before the mounted producer. No
// workflow may carry the interactive dev command, its attach hint, or an
// agent-browser path. The guard reads the real workflow text; the named source
// mutations below move the step or plant an interactive command so the guard
// is proven to fail for its intended field.

const CI_WORKFLOW = 'ci.yml'
const PROCESS_STEP_NAME = 'Fairtest process lifecycle'
const SELECTION_STEP_NAME = 'Fairtest inventory and selection (browser-free, before services)'
const MOUNTED_STEP_NAME = 'Fairtest mounted product producer'
const PROCESS_COMMAND = 'pnpm test:fairtest:process'
const PROCESS_ENV_FIELD = 'FAIRTEST_CI_PROCESS'

/**
 * Forbidden interactive or attach fragments a required workflow must never
 * carry. The dev command, its attach hint, and any agent-browser path all stay
 * local-only.
 * @type {Array<{ name: string, pattern: RegExp }>}
 */
const FORBIDDEN_WORKFLOW_PATTERNS = Object.freeze([
  Object.freeze({ name: 'interactive-dev-command', pattern: /fairtest dev\b/ }),
  Object.freeze({ name: 'interactive-dev-invocation', pattern: /pnpm\s+fairtest(?:\s|$)/ }),
  Object.freeze({ name: 'attach-flag', pattern: /--attach\b/ }),
  Object.freeze({ name: 'agent-browser-path', pattern: /agent-browser/i }),
])

/** @param {string} field @param {string} path @param {string} detail @returns {never} */
function wiringFail(field, path, detail) {
  throw new Error(`${detail} for field "${field}" at path ${path}; repair: keep the process-only step after the selection receipt, before the mounted producer, and keep every interactive or attach command out of required CI.`)
}

/** @param {unknown} doc @param {string} label @returns {Record<string, unknown>[]} */
function gatesSteps(doc, label) {
  const steps = /** @type {Record<string, any>} */ (doc)?.jobs?.gates?.steps
  if (!Array.isArray(steps) || steps.length === 0) {
    wiringFail('steps', `${label}.jobs.gates.steps`, `${label}: the gates job steps are missing`)
  }
  return steps
}

/** @param {Record<string, unknown>[]} steps @param {string} name @returns {number} */
function stepIndex(steps, name) {
  return steps.findIndex((entry) => entry?.name === name)
}

/**
 * Assert the process-only command is wired exactly once, after the selection
 * receipt and before the mounted producer, with the explicit CI entry point.
 * @param {unknown} doc parsed workflow document
 * @param {string} [label] workflow path used in diagnostics
 * @returns {void}
 */
function assertProcessWiring(doc, label = `.github/workflows/${CI_WORKFLOW}`) {
  const steps = gatesSteps(doc, label)
  const processMatches = steps.filter((entry) => entry?.name === PROCESS_STEP_NAME)
  if (processMatches.length !== 1) {
    wiringFail('steps', `${label}.jobs.gates.steps`, `${label}: expected exactly one process-only step ${JSON.stringify(PROCESS_STEP_NAME)} observed ${processMatches.length}`)
  }
  const processIndex = stepIndex(steps, PROCESS_STEP_NAME)
  const processStep = /** @type {Record<string, any>} */ (steps[processIndex])
  if (String(processStep.run ?? '').trim() !== PROCESS_COMMAND) {
    wiringFail('run', `${label}.jobs.gates.steps[${processIndex}].run`, `${label}: the process step must run exactly ${JSON.stringify(PROCESS_COMMAND)} with retries 0`)
  }
  if (String(processStep.env?.[PROCESS_ENV_FIELD] ?? '') !== '1') {
    wiringFail(PROCESS_ENV_FIELD, `${label}.jobs.gates.steps[${processIndex}].env.${PROCESS_ENV_FIELD}`, `${label}: the process step must carry the explicit CI entry point ${JSON.stringify(PROCESS_ENV_FIELD)}: 1`)
  }
  const selectionIndex = stepIndex(steps, SELECTION_STEP_NAME)
  if (selectionIndex < 0) {
    wiringFail('steps', `${label}.jobs.gates.steps`, `${label}: missing the selection receipt step ${JSON.stringify(SELECTION_STEP_NAME)}`)
  }
  if (!String(/** @type {Record<string, any>} */ (steps[selectionIndex]).run ?? '').includes('pnpm test:fairtest:selection-receipt')) {
    wiringFail('run', `${label}.jobs.gates.steps[${selectionIndex}].run`, `${label}: the process step must follow the selection receipt command`)
  }
  if (processIndex <= selectionIndex) {
    wiringFail('steps', `${label}.jobs.gates.steps`, `${label}: the process step must run after the selection receipt`)
  }
  const mountedIndex = stepIndex(steps, MOUNTED_STEP_NAME)
  if (mountedIndex < 0) {
    wiringFail('steps', `${label}.jobs.gates.steps`, `${label}: missing the mounted producer step ${JSON.stringify(MOUNTED_STEP_NAME)}`)
  }
  if (processIndex >= mountedIndex) {
    wiringFail('steps', `${label}.jobs.gates.steps`, `${label}: the process step must run before the mounted producer`)
  }
}

/**
 * Assert one workflow source carries no interactive, attach, or agent-browser
 * command.
 * @param {string} name workflow file name
 * @param {string} text workflow source
 * @returns {void}
 */
function assertNoInteractiveWorkflowCommand(name, text) {
  for (const { name: patternName, pattern } of FORBIDDEN_WORKFLOW_PATTERNS) {
    if (pattern.test(text)) {
      wiringFail('command', `.github/workflows/${name}`, `.github/workflows/${name}: forbidden ${patternName} ${JSON.stringify(pattern.source)}`)
    }
  }
}

/** @returns {string[]} */
function workflowFiles() {
  return readdirSync(WORKFLOWS_DIR).filter((name) => /\.ya?ml$/.test(name)).sort()
}

describe('bridge CI wiring', () => {
  const ciSource = readFileSync(new URL(CI_WORKFLOW, WORKFLOWS_DIR), 'utf8')
  const ciDoc = loadSingleDocument(ciSource, CI_WORKFLOW)

  it('wires only the process-only command after the selection receipt', () => {
    assertProcessWiring(ciDoc)
    for (const name of workflowFiles()) {
      assertNoInteractiveWorkflowCommand(name, readFileSync(new URL(name, WORKFLOWS_DIR), 'utf8'))
    }
  })

  it('fails every workflow mutation for its intended field', () => {
    const mutations = [
      {
        name: 'moving the process step before the selection receipt breaks the ordering guard',
        run: () => assertProcessWiring(moveProcessBeforeSelection(ciDoc)),
        expected: 'steps',
      },
      {
        name: 'removing the CI-process entry point breaks the process entry-point guard',
        run: () => assertProcessWiring(withoutProcessEnv(ciDoc)),
        expected: PROCESS_ENV_FIELD,
      },
      {
        name: 'planting an interactive dev command breaks the no-interactive-command guard',
        run: () => assertNoInteractiveWorkflowCommand(CI_WORKFLOW, `${ciSource}\n      - run: pnpm fairtest dev -- --target=product\n`),
        expected: 'command',
      },
      {
        name: 'planting an agent-browser path breaks the no-agent-browser guard',
        run: () => assertNoInteractiveWorkflowCommand(CI_WORKFLOW, `${ciSource}\n      - run: agent-browser open http://127.0.0.1:5180\n`),
        expected: 'command',
      },
    ]
    for (const mutation of mutations) {
      let message = null
      try {
        mutation.run()
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `workflow mutation "${mutation.name}" passed its guard instead of failing`)
      assert.ok(message.includes(mutation.expected), `workflow mutation "${mutation.name}" names the wrong field; got ${message}`)
      assert.ok(message.includes('at path'), `workflow mutation "${mutation.name}" is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `workflow mutation "${mutation.name}" is missing repair guidance: ${message}`)
    }
  })

  /** @param {unknown} doc @returns {unknown} */
  function moveProcessBeforeSelection(doc) {
    const clone = /** @type {Record<string, any>} */ (structuredClone(doc))
    const steps = gatesSteps(clone, 'mutation')
    const processIndex = stepIndex(steps, PROCESS_STEP_NAME)
    const selectionIndex = stepIndex(steps, SELECTION_STEP_NAME)
    const [processStep] = steps.splice(processIndex, 1)
    steps.splice(selectionIndex, 0, processStep)
    return clone
  }

  /** @param {unknown} doc @returns {unknown} */
  function withoutProcessEnv(doc) {
    const clone = /** @type {Record<string, any>} */ (structuredClone(doc))
    const steps = gatesSteps(clone, 'mutation')
    const processStep = steps[stepIndex(steps, PROCESS_STEP_NAME)]
    if (processStep?.env) delete processStep.env[PROCESS_ENV_FIELD]
    return clone
  }
})

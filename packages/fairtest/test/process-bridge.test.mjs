// @ts-check

// Process bridge tests: the four real OS process cases for the CI process
// supervisor, plus the neutral process contract and its named fixture family.
//
// This is the `test:fairtest:process` entry point. It refuses to run outside
// the explicit CI process invocation, requires a protected run root, then
// drives the real supervisor as an OS subprocess: one full run that supervises
// all four cases and writes a durable cleanup receipt, a negative that kills the
// supervisor before it observes a case, and a negative that refuses an
// unprotected run root. Every observed PID, process group, port, signal, reap,
// and listener postcondition is checked, and no temporary fixture, child, or
// listener is left behind.
//
// Import path note: this suite lives in the private child package but drives the
// app-owned supervisor exactly as CI does, through the same entry point and the
// same run-envelope contract, rather than importing app internals.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import * as processContract from '../src/bridge/process.mjs'
import { assertExactFields, checkRequiredNames, loadSingleDocument } from '../src/core/index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..')
const SUPERVISOR = join(REPO_ROOT, 'scripts', 'fairtest', 'process-supervisor.mjs')
const INIT = join(REPO_ROOT, 'scripts', 'fairtest', 'init-fairtest.mjs')
const SUPERVISOR_SOURCE_REL = 'scripts/fairtest/process-supervisor.mjs'
const NEUTRAL_SOURCE_REL = 'packages/fairtest/src/bridge/process.mjs'
const CASES_CORPUS = join(REPO_ROOT, 'scripts', 'testdata', 'fairtest-process-cases.yaml')
const CASES_MANIFEST = join(REPO_ROOT, 'scripts', 'testdata', 'fairtest-process-cases.manifest.yaml')
const RECEIPT_REL = 'guards/process-cleanup.json'
const ARMED = 'FAIRTEST_PROCESS_ARMED'
const MUTATION_KINDS = new Set(['delete-record', 'duplicate-name', 'rename-field', 'delete-field', 'unknown-field', 'bad-value', 'trailing-document'])

// The command refuses any non-CI invocation before a single test is registered.
if (process.env.FAIRTEST_CI_PROCESS !== '1') {
  console.error(
    'fairtest process: refused non-CI invocation for field "FAIRTEST_CI_PROCESS" at path process.ci; ' +
    `observed ${JSON.stringify(process.env.FAIRTEST_CI_PROCESS)}; ` +
    'repair: run only as FAIRTEST_CI_PROCESS=1 FAIRTEST_RUN_ROOT=<run-root> pnpm test:fairtest:process.',
  )
  process.exit(2)
}

const OUTER_RUN_ROOT = process.env.FAIRTEST_RUN_ROOT
if (typeof OUTER_RUN_ROOT !== 'string' || OUTER_RUN_ROOT.length === 0) {
  console.error(
    'fairtest process: missing run root for field "FAIRTEST_RUN_ROOT" at path process.run.root; ' +
    'repair: run with FAIRTEST_CI_PROCESS=1 FAIRTEST_RUN_ROOT=<absolute-run-root> pnpm test:fairtest:process.',
  )
  process.exit(2)
}
const OUTER_RUN_ID = (process.env.FAIRTEST_RUN_ID || basename(resolve(OUTER_RUN_ROOT))).trim()

/** @param {string} relative @returns {string} */
function readRepo(relative) {
  return readFileSync(join(REPO_ROOT, relative), 'utf8')
}

/** @returns {Record<string, unknown>} */
function readFamily(path) {
  return /** @type {Record<string, unknown>} */ (loadSingleDocument(readFileSync(path, 'utf8'), basename(path)))
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
  assertExactFields(manifest, ['expectedCaseCount', 'requiredCaseNames', 'expectedMutationCount', 'requiredMutationNames', 'mutations'], label, 'manifest')
  const cases = /** @type {string[]} */ (manifest.requiredCaseNames)
  const mutations = /** @type {Record<string, unknown>[]} */ (manifest.mutations)
  assert.equal(new Set(cases).size, cases.length, `${label}: required case names must be unique at path manifest.requiredCaseNames; repair: list every name once.`)
  assert.equal(manifest.expectedCaseCount, cases.length, `${label}: case count must equal the required-name inventory at path manifest.expectedCaseCount; repair: align it with requiredCaseNames.`)
  assert.equal(manifest.expectedMutationCount, mutations.length, `${label}: mutation count must equal the mutation inventory at path manifest.expectedMutationCount; repair: align it with mutations.`)
  checkRequiredNames(mutations.map((entry) => entry.name), /** @type {string[]} */ (manifest.requiredMutationNames), label)
  for (const [index, mutation] of mutations.entries()) {
    const fields = ['name', 'kind', 'target', 'expectedField']
    if (['delete-field', 'unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('field')
    if (mutation.kind === 'rename-field') fields.push('field', 'newField')
    if (['unknown-field', 'bad-value'].includes(/** @type {string} */ (mutation.kind))) fields.push('value')
    assertExactFields(mutation, fields, label, `manifest.mutations[${index}]`)
    assert.ok(MUTATION_KINDS.has(/** @type {string} */ (mutation.kind)), `${label}: mutation ${index} names an unknown kind at path manifest.mutations[${index}].kind; repair: use one of ${[...MUTATION_KINDS].join(', ')}.`)
    if (mutation.kind === 'trailing-document') {
      assert.equal(mutation.target, 'document', `${label}: mutation ${index} trailing-document must target the document at path manifest.mutations[${index}].target; repair: target "document".`)
    } else {
      assert.ok(cases.includes(/** @type {string} */ (mutation.target)), `${label}: mutation ${index} targets an unknown case at path manifest.mutations[${index}].target; repair: target a required case name.`)
    }
  }
}

/** @param {Record<string, unknown>} value */
function validateFamilyShape(value) {
  const label = basename(CASES_CORPUS)
  assertExactFields(value, ['expectedCaseCount', 'cases'], label, 'document')
  const cases = /** @type {Record<string, unknown>[]} */ (value.cases)
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no cases at path cases; repair: restore the named cases list.`)
  for (const [index, entry] of cases.entries()) {
    if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
      throw new Error(`${label}: case ${index} is missing its required name at path cases[${index}].name; repair: restore the required case name.`)
    }
    assertExactFields(entry, [...processContract.PROCESS_CASE_SPEC_FIELDS], label, `cases[${index}]`)
  }
}

/** @param {Record<string, unknown>} entry */
function runCase(entry) {
  const spec = processContract.validateProcessCaseSpec(entry, /** @type {string} */ (entry.name))
  assert.ok(Object.isFrozen(spec), `${entry.name}: validated case spec must be frozen`)
  assert.equal(spec.name, entry.name, `${entry.name}: case name must round-trip`)
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

/** @param {number} pid @returns {boolean} */
function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return /** @type {NodeJS.ErrnoException} */ (error).code === 'EPERM'
  }
}

/** @param {number} port @returns {Promise<boolean>} */
function portFree(port) {
  return new Promise((settle) => {
    const probe = net.createServer()
    probe.once('error', () => settle(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => settle(true)))
  })
}

/** @param {number} pgid @returns {void} */
function killGroup(pgid) {
  try {
    process.kill(-pgid, 'SIGKILL')
  } catch {
    // already gone
  }
}

/** @param {{ ciProcess?: string | null, runRoot?: string, runId?: string, extra?: Record<string, string> }} [options] @returns {Record<string, string | undefined>} */
function supervisorEnv({ ciProcess = '1', runRoot, runId, extra = {} } = {}) {
  const env = { ...process.env, ...extra }
  if (ciProcess === null) delete env.FAIRTEST_CI_PROCESS
  else env.FAIRTEST_CI_PROCESS = ciProcess
  if (runRoot === undefined) delete env.FAIRTEST_RUN_ROOT
  else env.FAIRTEST_RUN_ROOT = runRoot
  if (runId === undefined) delete env.FAIRTEST_RUN_ID
  else env.FAIRTEST_RUN_ID = runId
  return env
}

/**
 * Spawn one node script and collect its output. `onLine` sees each stdout line
 * as it arrives so a caller can interrupt the live supervisor.
 * @param {string} script absolute script path
 * @param {{ args?: string[], env?: Record<string, string | undefined>, timeoutMs?: number, onLine?: (line: string, child: import('node:child_process').ChildProcess) => void }} [options]
 * @returns {Promise<{ code: number | null, signal: string | null, stdout: string, stderr: string, timedOut: boolean }>}
 */
function spawnNode(script, options = {}) {
  const { args = [], env = process.env, timeoutMs = 90000, onLine = null } = options
  return new Promise((settle) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: REPO_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let buffer = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      try {
        child.kill('SIGKILL')
      } catch {
        // already gone
      }
    }, timeoutMs)
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      if (!onLine) return
      buffer += chunk
      let index = buffer.indexOf('\n')
      while (index >= 0) {
        onLine(buffer.slice(0, index), child)
        buffer = buffer.slice(index + 1)
        index = buffer.indexOf('\n')
      }
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      settle({ code: null, signal: null, stdout, stderr: `${stderr}${error.message}`, timedOut })
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      settle({ code, signal, stdout, stderr, timedOut })
    })
  })
}

/**
 * Create a fresh temporary parent directory holding one run root whose final
 * segment is the run id.
 * @returns {{ parent: string, runRoot: string, runId: string }}
 */
function makeRunRoot() {
  const parent = mkdtempSync(join(tmpdir(), 'fairtest-process-root-'))
  const runId = `process-run-${randomBytes(4).toString('hex')}`
  return { parent, runRoot: join(parent, runId), runId }
}

/** @param {string} runRoot @param {string} runId @returns {Promise<void>} */
async function ensureEnvelope(runRoot, runId) {
  if (existsSync(join(runRoot, 'guards', 'run-envelope.json'))) return
  mkdirSync(dirname(runRoot), { recursive: true })
  const result = await spawnNode(INIT, { env: supervisorEnv({ runRoot, runId }) })
  assert.equal(result.code, 0, `init must create the protected run envelope; stderr=${result.stderr}`)
}

describe('process supervisor real OS cases', () => {
  it('supervises the four real process cases and writes a complete durable receipt', async () => {
    await ensureEnvelope(resolve(OUTER_RUN_ROOT), OUTER_RUN_ID)
    const armedGroups = []
    const result = await spawnNode(SUPERVISOR, {
      args: ['--all', '--await-interrupt'],
      env: supervisorEnv({ runRoot: resolve(OUTER_RUN_ROOT), runId: OUTER_RUN_ID }),
      onLine: (line, child) => {
        if (!line.startsWith(ARMED)) return
        const parts = line.trim().split(' ')
        armedGroups.push(Number(parts[parts.length - 2]) || 0)
        if (parts[1] === 'process-sigterm-interruption') child.kill('SIGTERM')
      },
    })
    try {
      assert.equal(result.code, 0, `supervisor must exit clean after the four cases; stdout=${result.stdout}\nstderr=${result.stderr}`)
      const receiptPath = join(resolve(OUTER_RUN_ROOT), RECEIPT_REL)
      assert.ok(existsSync(receiptPath), `the durable receipt must exist at ${RECEIPT_REL}`)
      const parsed = JSON.parse(readFileSync(receiptPath, 'utf8'))
      const receipt = processContract.validateProcessCleanupReceipt(parsed, 'process receipt')
      assert.equal(receipt.runId, OUTER_RUN_ID, 'the receipt must name the run id the root carries')
      assert.deepEqual(
        receipt.cases.map((entry) => entry.caseId).sort(),
        [...processContract.PROCESS_CASE_IDS].sort(),
        'the receipt must name exactly the four process cases',
      )
      const specs = /** @type {Record<string, unknown>[]} */ (readFamily(CASES_CORPUS).cases)
      for (const spec of specs) {
        const record = receipt.cases.find((entry) => entry.caseId === spec.name)
        assert.ok(record, `the receipt must carry case ${spec.name}`)
        assert.equal(record.outcome, spec.outcome, `${spec.name}: outcome postcondition`)
        assert.equal(record.deadlineExceeded, spec.deadlineExceeded, `${spec.name}: deadline postcondition`)
        assert.equal(record.reaped, true, `${spec.name}: the process group must be reaped`)
        assert.equal(record.portReleased, true, `${spec.name}: the isolated port must be released`)
        assert.ok(record.pid > 0, `${spec.name}: the declared pid must be recorded`)
        assert.equal(record.processGroup, String(record.pid), `${spec.name}: the process group is the declared pid`)
        assert.equal(await portFree(record.port), true, `${spec.name}: no listener may survive on port ${record.port}`)
        assert.equal(isAlive(record.pid), false, `${spec.name}: no orphan may survive for pid ${record.pid}`)
      }
      for (const pgid of armedGroups) {
        assert.equal(isAlive(pgid), false, `armed process group ${pgid} must not survive the run`)
      }
      const byId = Object.fromEntries(receipt.cases.map((entry) => [entry.caseId, entry]))
      assert.equal(byId['process-normal-stop'].signal, 'completed', 'a clean stop records the completed signal')
      assert.equal(byId['process-partial-start'].outcome, 'readiness-failed', 'a partial start records the readiness failure')
      assert.equal(byId['process-bounded-timeout'].signal, 'terminated', 'a bounded timeout records a terminated signal')
      assert.equal(byId['process-sigterm-interruption'].signal, 'interrupted', 'an external interruption records the interrupted signal')
    } finally {
      for (const pgid of armedGroups) killGroup(pgid)
    }
  })

  it('does not credit cleanup to a supervisor killed before it observed a case', async () => {
    const { parent, runRoot, runId } = makeRunRoot()
    await ensureEnvelope(runRoot, runId)
    let armedGroup = 0
    const result = await spawnNode(SUPERVISOR, {
      args: ['--all'],
      env: supervisorEnv({ runRoot, runId, extra: { FAIRTEST_PROCESS_FIXTURE_PARENT: parent } }),
      onLine: (line, child) => {
        if (line.startsWith(ARMED)) {
          const parts = line.trim().split(' ')
          armedGroup = Number(parts[parts.length - 2]) || 0
          child.kill('SIGKILL')
        }
      },
    })
    try {
      assert.ok(result.signal === 'SIGKILL' || result.code !== 0, 'a killed supervisor must not report success')
      assert.equal(existsSync(join(runRoot, RECEIPT_REL)), false, 'a supervisor killed before observing every case must write no durable receipt')
    } finally {
      if (armedGroup > 0) killGroup(armedGroup)
      rmSync(parent, { recursive: true, force: true })
    }
  })

  it('refuses an unprotected run root before starting any service', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'fairtest-process-unprotected-'))
    const runRoot = join(parent, 'process-run-unprotected')
    mkdirSync(runRoot, { recursive: true })
    const result = await spawnNode(SUPERVISOR, {
      args: ['--all'],
      env: supervisorEnv({ runRoot, runId: 'process-run-unprotected' }),
    })
    try {
      assert.notEqual(result.code, 0, 'an unprotected run root must be refused')
      assert.ok(/run-envelope|FAIRTEST_RUN_ROOT/.test(result.stderr), `the refusal must name the run-envelope field; got ${result.stderr}`)
      assert.ok(result.stderr.includes('repair:'), 'the refusal must carry a repair step')
      assert.ok(!result.stdout.includes(ARMED), 'no child may be armed before the run root is protected')
      assert.equal(existsSync(join(runRoot, RECEIPT_REL)), false, 'no receipt may be written for an unprotected root')
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })

  it('refuses to run outside the CI process entry point', async () => {
    const { parent, runRoot, runId } = makeRunRoot()
    await ensureEnvelope(runRoot, runId)
    const result = await spawnNode(SUPERVISOR, {
      args: ['--all'],
      env: supervisorEnv({ ciProcess: null, runRoot, runId }),
    })
    try {
      assert.notEqual(result.code, 0, 'a non-CI invocation must be refused')
      assert.ok(result.stderr.includes('FAIRTEST_CI_PROCESS'), `the refusal must name the CI field; got ${result.stderr}`)
      assert.ok(result.stderr.includes('repair:'), 'the refusal must carry a repair step')
      assert.ok(!result.stdout.includes(ARMED), 'no child may be armed for a non-CI invocation')
      assert.equal(existsSync(join(runRoot, RECEIPT_REL)), false, 'no receipt may be written for a non-CI invocation')
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })
})

describe('neutral process contract', () => {
  const validIdentity = {
    purpose: 'process',
    runId: 'process-run-a',
    invocationId: 'process-invoke-a',
    project: 'fairtest',
    processCaseId: 'process-normal-stop',
    createdAtMs: 1000,
  }
  const validLimits = { readinessDeadlineMs: 1000, supervisorDeadlineMs: 5000, outerDeadlineMs: 8000, graceMs: 250 }
  const validRecord = {
    caseId: 'process-normal-stop',
    scenario: 'normal',
    outcome: 'stopped',
    signal: 'completed',
    reaped: true,
    portReleased: true,
    pid: 4242,
    port: 5311,
    processGroup: '4242',
    deadlineExceeded: false,
    observedAtMs: 6000,
  }

  it('accepts a process identity and refuses local or producer identities', () => {
    const identity = processContract.createProcessInvocationIdentity(validIdentity)
    assert.ok(Object.isFrozen(identity), 'a process identity must be frozen')
    assert.equal(identity.processCaseId, 'process-normal-stop')
    assert.throws(
      () => processContract.validateProcessInvocationIdentity({ ...validIdentity, purpose: 'local' }, 'probe'),
      /purpose.*at path.*repair:/s,
      'a local purpose must be refused at the purpose field',
    )
    assert.throws(
      () => processContract.validateProcessInvocationIdentity({ key: 'product-dark', kind: 'product', theme: 'dark' }, 'probe'),
      /purpose.*at path.*repair:/s,
      'a producer evidence row must be refused',
    )
    assert.throws(
      () => processContract.validateProcessInvocationIdentity({ ...validIdentity, processCaseId: 'process-unknown' }, 'probe'),
      /processCaseId.*at path.*repair:/s,
      'an unknown process case id must be refused',
    )
  })

  it('declares a process bridge and binds readiness and cleanup to it', () => {
    const declaration = processContract.createProcessBridgeDeclaration(validIdentity, ['report-readiness', 'cleanup-process'])
    assert.equal(declaration.kind, 'process', 'the declaration must be on the process branch')
    const readiness = processContract.validateProcessReadiness(
      { identityId: 'process-invoke-a', host: 'synthetic-loopback', port: 5311, ready: true, observedAtMs: 2000 },
      validIdentity,
      'probe',
    )
    assert.equal(readiness.identityId, 'process-invoke-a')
    assert.throws(
      () => processContract.validateProcessReadiness(
        { identityId: 'process-other', host: 'synthetic-loopback', port: 5311, ready: true, observedAtMs: 2000 },
        validIdentity,
        'probe',
      ),
      /identityId.*at path.*repair:/s,
      'a readiness record for another participant must be refused',
    )
    const cleanup = processContract.validateProcessCleanup(
      { identityId: 'process-invoke-a', signal: 'interrupted', reaped: true, portReleased: true, observedAtMs: 3000 },
      validIdentity,
      'probe',
    )
    assert.equal(cleanup.signal, 'interrupted')
  })

  it('keeps the outer fail-safe strictly longer than the internal deadline', () => {
    const limits = processContract.validateProcessLimits(validLimits, 'probe')
    assert.ok(Object.isFrozen(limits), 'limits must be frozen')
    assert.throws(
      () => processContract.validateProcessLimits({ ...validLimits, outerDeadlineMs: validLimits.supervisorDeadlineMs }, 'probe'),
      /outerDeadlineMs.*at path.*repair:/s,
      'an outer fail-safe equal to the internal deadline must be refused',
    )
    assert.throws(
      () => processContract.validateProcessLimits({ ...validLimits, readinessDeadlineMs: validLimits.supervisorDeadlineMs + 1 }, 'probe'),
      /readinessDeadlineMs.*at path.*repair:/s,
      'a readiness window outside the internal deadline must be refused',
    )
  })

  it('refuses a partial case set or an unknown field in a durable receipt', () => {
    const full = processContract.createProcessCleanupReceipt({
      version: 1,
      runId: 'process-run-a',
      project: 'fairtest',
      purpose: 'process',
      invocationId: 'process-invoke-a',
      cases: processContract.PROCESS_CASE_IDS.map((caseId) => ({ ...validRecord, caseId })),
      observedAtMs: 9000,
    })
    assert.equal(full.cases.length, 4)
    assert.throws(
      () => processContract.validateProcessCleanupReceipt({ ...full, cases: full.cases.slice(0, 3) }, 'probe'),
      /cases.*at path.*repair:/s,
      'a partial case set must be refused so a killed supervisor is not credited',
    )
    assert.throws(
      () => processContract.validateProcessCaseReceipt({ ...validRecord, signal: 'exploded' }, 'probe'),
      /signal.*at path.*repair:/s,
      'an unknown signal must be refused',
    )
    assert.throws(
      () => processContract.validateProcessCaseReceipt({ ...validRecord, outcome: 'exploded' }, 'probe'),
      /outcome.*at path.*repair:/s,
      'an unknown outcome must be refused',
    )
  })
})

describe('process fixture family', () => {
  const source = readFileSync(CASES_CORPUS, 'utf8')
  const manifest = readFamily(CASES_MANIFEST)
  const parsed = readFamily(CASES_CORPUS)

  it('holds a valid manifest inventory', () => {
    validateManifest(manifest, basename(CASES_MANIFEST))
  })

  it('holds exact fields and required names', () => {
    validateFamilyShape(parsed)
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    assert.equal(cases.length, manifest.expectedCaseCount, `${basename(CASES_CORPUS)}: case count must match the manifest`)
    checkRequiredNames(cases.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), basename(CASES_CORPUS))
  })

  it('executes every declared case spec', () => {
    for (const entry of /** @type {Record<string, unknown>[]} */ (parsed.cases)) runCase(entry)
  })

  it('fails every executable mutation for its intended field', () => {
    const cases = /** @type {Record<string, unknown>[]} */ (parsed.cases)
    for (const mutation of /** @type {Record<string, unknown>[]} */ (manifest.mutations)) {
      let message = null
      try {
        if (mutation.kind === 'trailing-document') {
          loadSingleDocument(`${source.trimEnd()}\n---\norphan: true\n`, basename(CASES_CORPUS))
        } else {
          const mutated = structuredClone(cases)
          applyMutation(mutated, mutation)
          validateFamilyShape({ ...parsed, cases: mutated })
          checkRequiredNames(mutated.map((entry) => /** @type {string} */ (entry.name)), /** @type {string[]} */ (manifest.requiredCaseNames), basename(CASES_CORPUS))
          for (const entry of mutated) runCase(entry)
        }
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      assert.ok(message, `${basename(CASES_CORPUS)}: mutation "${mutation.name}" passed validation instead of failing`)
      assert.ok(message.includes(/** @type {string} */ (mutation.expectedField)), `${basename(CASES_CORPUS)}: mutation "${mutation.name}" names the wrong field; got ${message}`)
      assert.ok(message.includes('at path'), `${basename(CASES_CORPUS)}: mutation "${mutation.name}" is missing path context: ${message}`)
      assert.ok(message.includes('repair:'), `${basename(CASES_CORPUS)}: mutation "${mutation.name}" is missing repair guidance: ${message}`)
    }
  })
})

describe('process supervisor declaration and isolation', () => {
  const supervisorSource = readRepo(SUPERVISOR_SOURCE_REL)
  const neutralSource = readRepo(NEUTRAL_SOURCE_REL)
  const pkg = JSON.parse(readRepo('package.json'))
  const inventory = /** @type {Record<string, unknown>} */ (loadSingleDocument(readRepo('scripts/testdata/fairtest-runner-inventory.yaml'), 'fairtest-runner-inventory.yaml'))

  it('declares the single process command and its inventory row', () => {
    assert.equal(pkg.scripts?.['test:fairtest:process'], 'node --test packages/fairtest/test/process-bridge.test.mjs', 'package.json: the process command must be declared exactly once')
    const rows = /** @type {Record<string, unknown>[]} */ (inventory.commands).filter((row) => row.name === 'test:fairtest:process')
    assert.equal(rows.length, 1, 'runner inventory: "test:fairtest:process" must be declared exactly once')
    assert.equal(rows[0].stage, 'process', 'runner inventory: the process command must stay in the process stage')
    assert.equal(rows[0].runner, 'process-only', 'runner inventory: the process command must use the process-only runner source')
    assert.equal(rows[0].owner, 'local-bridge', 'runner inventory: the process command must be owned by the local-bridge area')
  })

  it('keeps the supervisor loopback-only, browser-free, and on the sole source route', () => {
    assert.ok(supervisorSource.includes("PROCESS_HOST = '127.0.0.1'"), 'the supervisor must bind the loopback host')
    assert.ok(!/0\.0\.0\.0|['"]::['"]/.test(supervisorSource), 'the supervisor must never bind a wildcard interface')
    assert.ok(!/(?:import|from)\s*['"][^'"]*agent-browser[^'"]*['"]/.test(supervisorSource), 'the supervisor must not import agent-browser')
    assert.ok(!/(?:spawn|spawnSync|exec|execFile|execFileSync|execSync)\s*\([^)]*agent-browser/.test(supervisorSource), 'the supervisor must not invoke agent-browser')
    assert.ok(!/playwright|puppeteer|jsdom|storybook/i.test(supervisorSource), 'the supervisor must not name a browser runner')
    assert.ok(supervisorSource.includes("importFairtestSource('src/bridge/process.mjs')"), 'the supervisor must import the neutral contract through the sole source route')
    assert.ok(!supervisorSource.includes('packages/fairtest'), 'the supervisor must not name a second source route')
    assert.ok(supervisorSource.includes('assertCiProcess(process.env)'), 'the supervisor must refuse a non-CI invocation')
    assert.ok(supervisorSource.includes('requireEnvelopeForRun(root, runId'), 'the supervisor must require a protected run root before any service starts')
  })

  it('keeps the neutral process contract free of a runner, endpoint, or page global', () => {
    assert.ok(!/playwright|puppeteer|jsdom|storybook|agent-browser/i.test(neutralSource), `${NEUTRAL_SOURCE_REL}: the neutral contract must not name a runner`)
    assert.ok(!/https?:\/\/|localhost|127\.0\.0\.1/.test(neutralSource), `${NEUTRAL_SOURCE_REL}: the neutral contract must not name an endpoint literal`)
    assert.ok(!/\bwindow\b|\bnavigator\b|\bglobalThis\b/.test(neutralSource), `${NEUTRAL_SOURCE_REL}: the neutral contract must not name a page global`)
  })

  it('fails every source mutation for its intended field', () => {
    const mutations = [
      {
        name: 'injecting an agent-browser invocation breaks the no-invocation guard',
        run: () => guardNoAgentBrowserInvocation(`${supervisorSource}\nspawnSync('agent-browser', [])\n`),
        expected: 'agent-browser',
      },
      {
        name: 'replacing the loopback host with a wildcard breaks the loopback-only guard',
        run: () => guardLoopbackOnly(supervisorSource.replace("PROCESS_HOST = '127.0.0.1'", "PROCESS_HOST = '0.0.0.0'")),
        expected: 'host',
      },
      {
        name: 'dropping the CI-process guard breaks the entry-point guard',
        run: () => guardCiProcessCall(supervisorSource.replace('assertCiProcess(process.env)', '() => {}')),
        expected: 'FAIRTEST_CI_PROCESS',
      },
      {
        name: 'dropping the protected-run resolution breaks the run-root guard',
        run: () => guardProtectedRun(supervisorSource.replace('requireEnvelopeForRun(root, runId', 'void (root, runId')),
        expected: 'run-envelope',
      },
      {
        name: 'injecting a page global into the neutral contract breaks neutrality',
        run: () => guardNeutralProcessSource(`${neutralSource}\nconst captured = window\n`),
        expected: 'page global',
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

  function guardNoAgentBrowserInvocation(text) {
    if (/(?:spawn|spawnSync|exec|execFile|execFileSync|execSync)\s*\([^)]*agent-browser/.test(text)) {
      throw new Error(`${SUPERVISOR_SOURCE_REL}: the supervisor invokes agent-browser for field "agent-browser" at path ${SUPERVISOR_SOURCE_REL}; repair: never spawn, import, or install agent-browser from Fairtest.`)
    }
  }

  function guardLoopbackOnly(text) {
    if (/0\.0\.0\.0|['"]::['"]/.test(text)) {
      throw new Error(`${SUPERVISOR_SOURCE_REL}: non-loopback host for field "host" at path ${SUPERVISOR_SOURCE_REL}; repair: bind PROCESS_HOST only.`)
    }
    if (!text.includes("PROCESS_HOST = '127.0.0.1'")) {
      throw new Error(`${SUPERVISOR_SOURCE_REL}: missing loopback bind for field "host" at path ${SUPERVISOR_SOURCE_REL}; repair: keep the loopback host declaration.`)
    }
  }

  function guardCiProcessCall(text) {
    if (!text.includes('assertCiProcess(process.env)')) {
      throw new Error(`${SUPERVISOR_SOURCE_REL}: missing CI-process refusal for field "FAIRTEST_CI_PROCESS" at path ${SUPERVISOR_SOURCE_REL}; repair: call assertCiProcess before resolving the run root.`)
    }
  }

  function guardProtectedRun(text) {
    if (!text.includes('requireEnvelopeForRun(root, runId')) {
      throw new Error(`${SUPERVISOR_SOURCE_REL}: missing protected-run check for field "run-envelope" at path ${SUPERVISOR_SOURCE_REL}; repair: require the run envelope before starting any child.`)
    }
  }

  function guardNeutralProcessSource(text) {
    if (/\bwindow\b|\bnavigator\b|\bglobalThis\b/.test(text)) {
      throw new Error(`${NEUTRAL_SOURCE_REL}: page global for field "page global" at path ${NEUTRAL_SOURCE_REL}; repair: keep page globals out of the neutral contract.`)
    }
  }
})

describe('durable receipt path', () => {
  it('declares the receipt under the guards subtree with a single owner', () => {
    const contractSource = readRepo('scripts/fairtest/run-envelope-contract.mjs')
    assert.ok(
      contractSource.includes('PROCESS_CLEANUP_RECEIPT_REL = `${GUARDS_DIR}/process-cleanup.json`'),
      'run-envelope-contract.mjs: the process receipt path must be declared once under guards/',
    )
    assert.ok(readRepo(SUPERVISOR_SOURCE_REL).includes('PROCESS_CLEANUP_RECEIPT_REL'), 'the supervisor must read the declared receipt path rather than re-spelling it')
  })

  it('reads the protected run envelope the process stage shares', async () => {
    await ensureEnvelope(resolve(OUTER_RUN_ROOT), OUTER_RUN_ID)
    const envelope = JSON.parse(readFileSync(join(resolve(OUTER_RUN_ROOT), 'guards', 'run-envelope.json'), 'utf8'))
    assert.equal(envelope.runId, OUTER_RUN_ID, 'the protected envelope must name the run id the root carries')
    assert.equal(envelope.project, 'fairtest', 'the protected envelope must carry the fairtest project')
  })
})

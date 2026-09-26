#!/usr/bin/env node
// Fairtest CI process supervisor: the sole process-lifecycle owner.
//
// Invocation contract (required CI or an explicit local reproduction):
//   FAIRTEST_CI_PROCESS=1 FAIRTEST_RUN_ROOT=<run-root> pnpm test:fairtest:process
//
// The command refuses to run as an interactive/dev path: without
// FAIRTEST_CI_PROCESS=1 it exits before resolving a run root or starting any
// child, and it requires a protected run root (the immutable run envelope that
// belongs to the run id) before service startup. It supervises four real OS
// process cases, each in its own isolated process group on its own isolated
// loopback port: a normal start/stop, a partial start that never reports
// readiness, a bounded timeout, and a signal interruption. Every case is
// bounded by an internal deadline and an outer fail-safe that stays strictly
// longer than it, stops with TERM then KILL after an explicit grace window,
// reaps the whole group including descendants, checks the declared PID and
// port, and cleans its temporary fixtures in a finally step.
//
// It writes one durable cleanup receipt, guards/process-cleanup.json, only
// after all four cases were observed. A supervisor killed before it observed a
// case therefore writes no receipt, and the receipt validator refuses a
// partial case set, so a killed supervisor is never credited with cleanup it
// did not observe. The neutral identity, deadline, and receipt contract lives
// in the private child package and is imported through the sole source route.
//
// This module is app-owned and browser-free. It imports no browser, runner, or
// agent-browser package and never installs or invokes one.
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { importFairtestSource } from '../fairtest-source.mjs'
import { FAIRTEST_REPO_ROOT } from './fairtest-runtime.mjs'
import {
  FAIRTEST_PROJECT,
  PROCESS_CLEANUP_RECEIPT_REL,
  requireEnvelopeForRun,
  resolveRunRootFor,
  writeJsonAtomic,
} from './run-envelope-contract.mjs'

const processContract = await importFairtestSource('src/bridge/process.mjs')
const core = await importFairtestSource('src/core/index.mjs')

/**
 * The run-root-relative process case fixture family this supervisor reads.
 * @type {string}
 */
export const PROCESS_CASES_REL = 'scripts/testdata/fairtest-process-cases.yaml'

/**
 * The loopback host every supervised child binds. Never a wildcard interface.
 * @type {string}
 */
export const PROCESS_HOST = '127.0.0.1'

/**
 * The one readiness token a fixture child prints once it is serving. The
 * supervisor never treats a bare listener as ready, so a partial start that
 * binds the port but never reports readiness fails closed.
 * @type {string}
 */
export const PROCESS_READY_TOKEN = 'FAIRTEST_PROCESS_READY'

/**
 * The one-line stdout markers the supervisor prints. `ARMED` names the isolated
 * process group before any wait so an external orchestrator can interrupt a
 * live case (and clean up after a killed supervisor); `RECORD` carries one
 * observed case receipt for single-case runs.
 * @type {{ armed: string, record: string }}
 */
export const PROCESS_STDOUT_MARKERS = Object.freeze({
  armed: 'FAIRTEST_PROCESS_ARMED',
  record: 'FAIRTEST_PROCESS_RECORD',
})

/** @param {number} ms @returns {Promise<void>} */
function sleep(ms) {
  return new Promise((settle) => setTimeout(settle, ms))
}

/**
 * Refuse any invocation that is not the explicit CI process entry point. This
 * is what keeps an interactive or dev shell from starting supervised children.
 * @param {Record<string, string | undefined>} env environment to read
 * @returns {void}
 */
export function assertCiProcess(env) {
  if (env.FAIRTEST_CI_PROCESS !== '1') {
    throw new Error(
      `fairtest process: refused non-CI invocation for field "FAIRTEST_CI_PROCESS" at path process.ci; ` +
      `observed ${JSON.stringify(env.FAIRTEST_CI_PROCESS)}; ` +
      'repair: run the process supervisor only as FAIRTEST_CI_PROCESS=1 FAIRTEST_RUN_ROOT=<run-root> pnpm test:fairtest:process; it is never an interactive or dev path.',
    )
  }
}

/**
 * Resolve the protected run root before any service starts. The run envelope
 * must exist and belong to the run id the root names, so an unprotected or
 * foreign root fails before a single child is spawned. The invocation contract
 * carries only FAIRTEST_RUN_ROOT, so the run id is the root's final segment
 * unless FAIRTEST_RUN_ID is set explicitly.
 * @param {Record<string, string | undefined>} env environment to read
 * @returns {{ root: string, runId: string }}
 */
export function resolveProcessRun(env) {
  const raw = typeof env.FAIRTEST_RUN_ROOT === 'string' ? env.FAIRTEST_RUN_ROOT : ''
  if (!raw) {
    throw new Error(
      'fairtest process: missing run root for field "FAIRTEST_RUN_ROOT" at path process.run.root; ' +
      'repair: run with FAIRTEST_CI_PROCESS=1 FAIRTEST_RUN_ROOT=<absolute-run-root> pnpm test:fairtest:process.',
    )
  }
  const explicit = typeof env.FAIRTEST_RUN_ID === 'string' ? env.FAIRTEST_RUN_ID.trim() : ''
  const runId = explicit || basename(resolve(raw))
  const root = resolveRunRootFor(raw, runId)
  requireEnvelopeForRun(root, runId, 'fairtest process')
  return { root, runId }
}

/**
 * Parse the supervisor arguments. `--all` (the default) supervises the whole
 * case family and writes the durable receipt; `--case=<id>` supervises exactly
 * one case and reports its observed record without writing the durable receipt.
 * `--await-interrupt` makes the interruption case wait for an external SIGTERM
 * instead of self-signaling.
 * @param {string[]} args command arguments
 * @returns {{ mode: string, caseId: string | null, awaitInterrupt: boolean }}
 */
export function parseProcessArgs(args) {
  let mode = 'all'
  let caseId = null
  let awaitInterrupt = false
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--') continue
    if (arg === '--all') mode = 'all'
    else if (arg === '--await-interrupt') awaitInterrupt = true
    else if (arg.startsWith('--case=')) {
      mode = 'case'
      caseId = arg.slice('--case='.length)
    } else if (arg === '--case' && index + 1 < args.length) {
      mode = 'case'
      caseId = args[index + 1]
      index += 1
    } else {
      throw new Error(
        `fairtest process: unknown argument ${JSON.stringify(arg)} for field "args" at path process.args; ` +
        'repair: run with --all, or --case=<process-case-id>, optionally --await-interrupt.',
      )
    }
  }
  if (mode === 'case' && !processContract.PROCESS_CASE_IDS.includes(caseId)) {
    throw new Error(
      `fairtest process: unknown process case ${JSON.stringify(caseId)} for field "case" at path process.args; ` +
      `repair: use one of ${processContract.PROCESS_CASE_IDS.join(', ')} for --case.`,
    )
  }
  return { mode, caseId, awaitInterrupt }
}

/**
 * Read and validate the process case fixture family. Every case is validated by
 * the neutral contract and the observed case set must equal the declared four,
 * so a missing or extra case fails before any child starts.
 * @param {string} repoRoot repository root
 * @returns {object[]} the four validated, frozen case specs
 */
export function loadProcessCases(repoRoot) {
  const path = join(repoRoot, PROCESS_CASES_REL)
  let source
  try {
    source = readFileSync(path, 'utf8')
  } catch (error) {
    throw new Error(
      `fairtest process: cannot read the process case family for field "cases" at path ${PROCESS_CASES_REL}; ` +
      `caused by ${error instanceof Error ? error.message : String(error)}; ` +
      'repair: restore the named process case family so the supervisor has four declared cases.',
    )
  }
  const document = core.loadSingleDocument(source, PROCESS_CASES_REL)
  if (!Array.isArray(document.cases)) {
    throw new Error(
      `fairtest process: missing process cases for field "cases" at path ${PROCESS_CASES_REL}.cases; ` +
      'repair: restore the four named process case records.',
    )
  }
  const specs = document.cases.map((entry, index) => processContract.validateProcessCaseSpec(entry, `${PROCESS_CASES_REL} cases[${index}]`))
  const ids = specs.map((spec) => spec.name)
  const missing = processContract.PROCESS_CASE_IDS.filter((id) => !ids.includes(id))
  if (missing.length > 0 || ids.length !== processContract.PROCESS_CASE_IDS.length) {
    throw new Error(
      `fairtest process: incomplete process case set for field "cases" at path ${PROCESS_CASES_REL}.cases; ` +
      `expected exactly ${JSON.stringify([...processContract.PROCESS_CASE_IDS])} observed ${JSON.stringify(ids)} missing ${JSON.stringify(missing)}; ` +
      'repair: restore all four named process cases.',
    )
  }
  return specs
}

/**
 * Report whether a process id is still alive.
 * @param {number} pid process id
 * @returns {boolean} true when the process exists
 */
export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return /** @type {NodeJS.ErrnoException} */ (error).code === 'EPERM'
  }
}

/**
 * Signal every process in one isolated group. A negative pid signals the whole
 * group, so descendants are reached alongside the direct child.
 * @param {number} pgid process group id (the direct child's pid)
 * @param {NodeJS.Signals} signal signal to deliver
 * @returns {void}
 */
export function signalGroup(pgid, signal) {
  try {
    process.kill(-pgid, signal)
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ESRCH') throw error
  }
}

/**
 * Report whether a loopback port is free by binding and releasing it.
 * @param {number} port loopback port
 * @returns {Promise<boolean>} true when the port can be bound
 */
export function isPortFree(port) {
  return new Promise((settle) => {
    const probe = net.createServer()
    probe.once('error', () => settle(false))
    probe.listen(port, PROCESS_HOST, () => probe.close(() => settle(true)))
  })
}

/**
 * Claim an isolated loopback port by binding port 0 and reading the assigned
 * port, then releasing it. One caller owns the returned port for one case.
 * @returns {Promise<number>} the isolated port
 */
export function claimIsolatedPort() {
  return new Promise((settle, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, PROCESS_HOST, () => {
      const address = probe.address()
      const port = address && typeof address === 'object' ? address.port : 0
      probe.close(() => settle(port))
    })
  })
}

/**
 * Wait for a process to exit, bounded by a real deadline.
 * @param {import('node:child_process').ChildProcess} child child process
 * @param {number} deadlineMs maximum wait
 * @returns {Promise<boolean>} true when the child exited in time
 */
function waitForExit(child, deadlineMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true)
  return new Promise((settle) => {
    const timer = setTimeout(() => finish(false), deadlineMs)
    const finish = (exited) => {
      clearTimeout(timer)
      child.off('exit', onExit)
      settle(exited)
    }
    const onExit = () => finish(true)
    child.once('exit', onExit)
  })
}

/**
 * The generated fixture child. It is written to a throwaway directory for the
 * duration of one run and removed in a finally step. It binds the isolated
 * port, spawns one descendant in its own process group, and prints the
 * readiness token unless the scenario is a partial start.
 * @type {string}
 */
export const PROCESS_CHILD_FIXTURE = `import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:net'

const scenario = process.env.FAIRTEST_PROCESS_SCENARIO
const port = Number(process.env.FAIRTEST_PROCESS_PORT)
const host = process.env.FAIRTEST_PROCESS_HOST
const grandchildPidFile = process.env.FAIRTEST_PROCESS_GRANDCHILD_PID_FILE

// A descendant in the same process group proves whole-group reaping.
const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1 << 30)'], { stdio: 'ignore' })
if (grandchildPidFile) writeFileSync(grandchildPidFile, String(descendant.pid))

if (scenario === 'timeout') {
  // Ignore TERM so only the grace window followed by KILL can stop this child.
  process.on('SIGTERM', () => {})
}

const server = createServer(() => {})
server.listen(port, host, () => {
  if (scenario !== 'partial-start') {
    process.stdout.write('${PROCESS_READY_TOKEN} ' + port + '\\n')
  }
})
setInterval(() => {}, 1 << 30)
`

/**
 * Wait for the fixture child to report readiness inside a real deadline. A
 * bare listener is not readiness: the token must arrive AND the port must
 * accept a connection.
 * @param {import('node:child_process').ChildProcess} child child process
 * @param {number} port declared port
 * @param {number} deadlineMs maximum wait
 * @returns {Promise<boolean>} true when readiness was observed
 */
async function waitForReady(child, port, deadlineMs) {
  let tokenSeen = false
  const onData = (chunk) => {
    if (String(chunk).includes(PROCESS_READY_TOKEN)) tokenSeen = true
  }
  child.stdout?.on('data', onData)
  const start = Date.now()
  try {
    while (Date.now() - start < deadlineMs) {
      if (tokenSeen && (await isPortFree(port)) === false) return true
      await sleep(25)
    }
    return false
  } finally {
    child.stdout?.off('data', onData)
  }
}

/**
 * Stop one isolated process group: TERM first, then KILL after the explicit
 * grace window, then a best-effort final reap of any descendant.
 * @param {import('node:child_process').ChildProcess} child child process
 * @param {number} graceMs grace window in milliseconds
 * @returns {Promise<void>}
 */
async function stopGroup(child, graceMs) {
  const pgid = child.pid
  if (pgid === undefined) return
  signalGroup(pgid, 'SIGTERM')
  if (!(await waitForExit(child, graceMs))) {
    signalGroup(pgid, 'SIGKILL')
    await waitForExit(child, graceMs)
  }
  // The leader may be gone while a descendant survives; KILL the group again.
  signalGroup(pgid, 'SIGKILL')
  await sleep(30)
}

/** @type {{ signalResolver: ((signal: string) => void) | null, pending: string | null }} */
const interruptState = { signalResolver: null, pending: null }

/** @param {string} signal @returns {void} */
function handleInterrupt(signal) {
  interruptState.pending = signal
  const resolver = interruptState.signalResolver
  interruptState.signalResolver = null
  if (resolver) resolver(signal)
}

process.on('SIGTERM', () => handleInterrupt('interrupted'))
process.on('SIGINT', () => handleInterrupt('interrupted'))

/**
 * Wait for the supervisor's own interruption inside a real deadline.
 * @param {number} deadlineMs maximum wait
 * @returns {Promise<string | null>} the interruption signal, or null on timeout
 */
function waitForInterrupt(deadlineMs) {
  if (interruptState.pending) return Promise.resolve(interruptState.pending)
  return new Promise((settle) => {
    const timer = setTimeout(() => {
      interruptState.signalResolver = null
      settle(null)
    }, deadlineMs)
    interruptState.signalResolver = (signal) => {
      clearTimeout(timer)
      settle(signal)
    }
  })
}

/**
 * Run one supervised case and return its observed receipt entry. The child is
 * started in its own isolated process group on an isolated port, its readiness
 * and deadline are enforced, it is stopped with TERM then KILL after the grace
 * window, and its PID, descendant, process group, and port postconditions are
 * checked. Temporary files are always removed in a finally step.
 * @param {object} spec validated case spec
 * @param {{ fixtureRoot: string, childScript: string, awaitInterrupt: boolean }} context run context
 * @returns {Promise<object>} the observed case receipt entry
 */
export async function runProcessCase(spec, context) {
  const port = await claimIsolatedPort()
  const grandchildPidFile = join(context.fixtureRoot, `${spec.name}-descendant.pid`)
  const child = spawn(process.execPath, [context.childScript], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      FAIRTEST_PROCESS_SCENARIO: spec.scenario,
      FAIRTEST_PROCESS_PORT: String(port),
      FAIRTEST_PROCESS_HOST: PROCESS_HOST,
      FAIRTEST_PROCESS_GRANDCHILD_PID_FILE: grandchildPidFile,
    },
  })
  const pgid = child.pid
  console.log(`${PROCESS_STDOUT_MARKERS.armed} ${spec.name} ${pgid} ${port}`)
  context.onArmed?.(pgid)
  const spawnedAtMs = Date.now()
  let ready = false
  let outcome = spec.outcome
  let signal = 'terminated'
  let deadlineExceeded = false
  try {
    ready = await waitForReady(child, port, spec.limits.readinessDeadlineMs)
    if (!spec.expectReady) {
      // A partial start that never reports readiness is torn down here.
      outcome = 'readiness-failed'
    } else if (!ready) {
      outcome = 'readiness-failed'
    } else if (spec.scenario === 'timeout') {
      const remaining = spawnedAtMs + spec.limits.supervisorDeadlineMs - Date.now()
      if (remaining > 0) await sleep(remaining)
      deadlineExceeded = true
      outcome = 'deadline-exceeded'
    } else if (spec.scenario === 'interruption') {
      if (!context.awaitInterrupt) {
        setTimeout(() => process.kill(process.pid, 'SIGTERM'), 50)
      }
      const interrupted = await waitForInterrupt(Math.max(1, spawnedAtMs + spec.limits.supervisorDeadlineMs - Date.now()))
      if (interrupted) {
        outcome = 'interrupted'
        signal = 'interrupted'
      } else {
        deadlineExceeded = true
        outcome = 'deadline-exceeded'
      }
    } else {
      signal = 'completed'
    }
  } finally {
    await stopGroup(child, spec.limits.graceMs)
  }
  let descendantPid = 0
  try {
    descendantPid = Number(readFileSync(grandchildPidFile, 'utf8').trim()) || 0
  } catch {
    descendantPid = 0
  }
  const reaped = !isProcessAlive(pgid) && (descendantPid === 0 || !isProcessAlive(descendantPid))
  const portReleased = await isPortFree(port)
  return processContract.validateProcessCaseReceipt(
    {
      caseId: spec.name,
      scenario: spec.scenario,
      outcome,
      signal,
      reaped,
      portReleased,
      pid: pgid,
      port,
      processGroup: String(pgid),
      deadlineExceeded,
      observedAtMs: Date.now(),
    },
    `fairtest process ${spec.name}`,
  )
}

/**
 * Run one case under the outer fail-safe deadline, which must stay strictly
 * longer than the case's internal supervisor deadline. The fail-safe force-kills
 * the isolated group if the internal deadline somehow failed to bound the case.
 * @param {object} spec validated case spec
 * @param {{ fixtureRoot: string, childScript: string, awaitInterrupt: boolean }} context run context
 * @returns {Promise<object>} the observed case receipt entry
 */
async function runCaseUnderFailSafe(spec, context) {
  let activeGroup = 0
  const failSafe = setTimeout(() => {
    if (activeGroup > 0) signalGroup(activeGroup, 'SIGKILL')
  }, spec.limits.outerDeadlineMs)
  try {
    return await runProcessCase(spec, { ...context, onArmed: (pgid) => { activeGroup = pgid } })
  } finally {
    clearTimeout(failSafe)
  }
}

/**
 * Build, validate, and write the durable cleanup receipt for one run. The
 * receipt is written atomically and only after every case was observed.
 * @param {{ root: string, runId: string, invocationId: string, cases: object[] }} input receipt inputs
 * @returns {object} the frozen receipt
 */
export function writeProcessCleanupReceipt(input) {
  const receipt = processContract.createProcessCleanupReceipt({
    version: processContract.PROCESS_RECEIPT_VERSION,
    runId: input.runId,
    project: FAIRTEST_PROJECT,
    purpose: processContract.PROCESS_INVOCATION_PURPOSE,
    invocationId: input.invocationId,
    cases: input.cases,
    observedAtMs: Date.now(),
  })
  writeJsonAtomic(join(input.root, PROCESS_CLEANUP_RECEIPT_REL), receipt)
  return receipt
}

/**
 * Report whether every observed case met its declared postcondition.
 * @param {object[]} records observed case receipt entries
 * @param {object[]} specs declared case specs
 * @returns {string[]} one diagnostic per unmet postcondition
 */
export function checkPostconditions(records, specs) {
  const failures = []
  for (const spec of specs) {
    const record = records.find((entry) => entry.caseId === spec.name)
    if (!record) {
      failures.push(`${spec.name}: no observed case record`)
      continue
    }
    if (record.outcome !== spec.outcome) failures.push(`${spec.name}: outcome expected ${spec.outcome} observed ${record.outcome}`)
    if (spec.expectReady && record.outcome === 'readiness-failed') failures.push(`${spec.name}: readiness was expected but the case failed readiness`)
    if (!spec.expectReady && record.outcome !== 'readiness-failed') failures.push(`${spec.name}: readiness was not expected so the case must fail readiness, observed ${record.outcome}`)
    if (record.deadlineExceeded !== spec.deadlineExceeded) failures.push(`${spec.name}: deadlineExceeded expected ${spec.deadlineExceeded} observed ${record.deadlineExceeded}`)
    if (!record.reaped) failures.push(`${spec.name}: process group ${record.processGroup} was not reaped`)
    if (!record.portReleased) failures.push(`${spec.name}: port ${record.port} was not released`)
    if (record.pid <= 0) failures.push(`${spec.name}: no observed pid`)
  }
  return failures
}

/**
 * Run the supervisor. Resolves the protected run before any service starts,
 * supervises the declared cases, checks their postconditions, and writes the
 * durable receipt for a full run.
 * @param {string[]} args command arguments
 * @returns {Promise<number>} the process exit code
 */
async function main(args) {
  const options = parseProcessArgs(args)
  assertCiProcess(process.env)
  const { root, runId } = resolveProcessRun(process.env)
  const specs = loadProcessCases(FAIRTEST_REPO_ROOT)
  // The fixture parent is overridable so a caller (a test, a CI job) can own the
  // throwaway directory a supervisor killed without running its finally leaves
  // behind. The default is the system temporary directory.
  const fixtureParent = process.env.FAIRTEST_PROCESS_FIXTURE_PARENT || tmpdir()
  const fixtureRoot = mkdtempSync(join(fixtureParent, 'fairtest-process-'))
  const childScript = join(fixtureRoot, 'child.mjs')
  writeFileSync(childScript, PROCESS_CHILD_FIXTURE)
  const selected = options.mode === 'case' ? specs.filter((spec) => spec.name === options.caseId) : specs
  const records = []
  try {
    for (const spec of selected) {
      const record = await runCaseUnderFailSafe(spec, { fixtureRoot, childScript, awaitInterrupt: options.awaitInterrupt })
      records.push(record)
      if (options.mode === 'case') {
        console.log(`${PROCESS_STDOUT_MARKERS.record} ${JSON.stringify(record)}`)
      } else {
        console.log(`  case       ${record.caseId} outcome=${record.outcome} signal=${record.signal} reaped=${record.reaped} portReleased=${record.portReleased}`)
      }
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
  if (options.mode === 'case') {
    const failures = checkPostconditions(records, selected)
    for (const failure of failures) console.error(`fairtest process: postcondition failed; ${failure}`)
    return failures.length === 0 ? 0 : 1
  }
  const invocationId = `process-${runId}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64)
  const receipt = writeProcessCleanupReceipt({ root, runId, invocationId, cases: records })
  const failures = checkPostconditions(records, specs)
  console.log('fairtest process: supervised the four process cases and wrote the durable cleanup receipt')
  console.log(`  run root   ${root}`)
  console.log(`  run id     ${runId}`)
  console.log(`  receipt    ${join(root, PROCESS_CLEANUP_RECEIPT_REL)}`)
  console.log(`  cases      ${receipt.cases.map((entry) => entry.caseId).join(', ')}`)
  for (const failure of failures) console.error(`fairtest process: postcondition failed; ${failure}`)
  return failures.length === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

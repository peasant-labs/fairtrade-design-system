#!/usr/bin/env node
// @ts-check

// Parallel lane runner for the library gate.
//
// `package.json` keeps the single ordered source of truth in `test:lib:serial`.
// This runner expands every nested `pnpm <script>` leaf, classifies each leaf
// into a lane, and executes the lanes concurrently with a bounded global
// budget. It preserves each leaf command exactly as written, so a gate cannot
// disappear by being re-expressed here.
//
// Why lanes rather than one flat pool: the library gate mixes cheap Node
// fixtures, Vite-plus-jsdom mounts, mutation orchestrators that spawn their own
// child processes, a timing benchmark, and package commands that share the pnpm
// store. A flat pool either starves the fast gates or overcommits memory. The
// lane budget and the weighted global semaphore bound both.
//
// Usage:
//   node scripts/run-test-lib.mjs                 # keep going, report every failure
//   node scripts/run-test-lib.mjs --fail-fast     # stop scheduling after the first failure
//   node scripts/run-test-lib.mjs --lane pure     # one lane, for local debugging
//   node scripts/run-test-lib.mjs --list          # print the expanded lanes and exit
//   node scripts/run-test-lib.mjs --json out.json # write a machine-readable report
//
// CI sets CI=1, so the default there is fail-fast. Local runs keep going by
// default because a maintainer usually wants the whole failure set in one run.

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_SCRIPT = 'test:lib:serial'
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

/**
 * Lane budgets. `concurrency` bounds how many leaves of this lane may run at
 * once. `weight` is the global memory budget each leaf consumes; the weighted
 * semaphore below keeps two heavy lanes from stacking on a small runner.
 * @type {Readonly<Record<string, { concurrency: number, weight: number, timeoutMs: number }>>}
 */
export const LANES = Object.freeze({
  contract: { concurrency: 2, weight: 1, timeoutMs: 300_000 },
  guard: { concurrency: 3, weight: 1, timeoutMs: 300_000 },
  pure: { concurrency: 6, weight: 1, timeoutMs: 600_000 },
  ssr: { concurrency: 3, weight: 1, timeoutMs: 600_000 },
  mounted: { concurrency: 2, weight: 3, timeoutMs: 600_000 },
  mutation: { concurrency: 3, weight: 2, timeoutMs: 900_000 },
  // These gates temporarily rewrite a tracked source file and restore it.
  // They hold the whole global budget so no other reader can observe the
  // half-applied mutation; the serial chain had the same ordering by accident.
  'source-mutation': { concurrency: 1, weight: 8, timeoutMs: 600_000 },
  pack: { concurrency: 1, weight: 1, timeoutMs: 300_000 },
  // The benchmark asserts absolute timing ceilings, so it holds the whole
  // budget exactly like the old serial chain ran it alone.
  bench: { concurrency: 1, weight: 8, timeoutMs: 600_000 },
  vitest: { concurrency: 1, weight: 1, timeoutMs: 600_000 },
})

export const GLOBAL_WEIGHT = 8

const MUTATION_RE = /parts-mutations\.mjs|\.mutations\.mjs/
const PACK_RE = /packed-tarball|assert-pack-contents/
const CONTRACT_RE = /^tsc(?:\s|$)/
const BENCH_RE = /code-map-ranking-bench/
const VITEST_RE = /^vitest(?:\s|$)/
const GUARD_RE = /contrast|css-token-lint|breakpoint-scale|assert-structured-shiki|assert-package-provenance|design-decisions\.mjs|port-record/
export const SOURCE_MUTATION_RE = /timeline-a11y\.test\.mjs|timeline-ghosts\.test\.mjs|timeline-highlight\.test\.mjs/
const MOUNTED_RE = /withMountedSource|from ['"]jsdom['"]|import\(['"]jsdom['"]\)|createServer\(|react-dom\/client/
const SSR_RE = /renderToStaticMarkup|react-dom\/server/

/**
 * Split one script body into top-level `&&` commands. The repository's scripts
 * never nest `&&` inside quotes, so a plain split is the declared grammar.
 * @param {string} text script body
 * @returns {string[]} commands
 */
export function splitCommands(text) {
  return text.split(' && ').map((part) => part.trim()).filter(Boolean)
}

/**
 * Expand one script into leaf commands. A bare `pnpm <script>` is a composite
 * and is expanded recursively; everything else is a leaf. The leaf keeps the
 * script name that introduced it so the report names a gate a maintainer
 * recognizes.
 * @param {string} name script name
 * @param {string[]} stack recursion guard
 * @returns {{ command: string, script: string | null, via: string[] }[]} leaves
 */
export function expandScript(name, stack = []) {
  if (stack.includes(name)) {
    throw new Error(`test:lib runner: script cycle at ${[...stack, name].join(' -> ')} for field "scripts" at path package.json; repair: break the pnpm script cycle.`)
  }
  const text = PKG.scripts?.[name]
  if (typeof text !== 'string') {
    throw new Error(`test:lib runner: missing script ${JSON.stringify(name)} for field "scripts" at path package.json; repair: declare the script or remove the reference.`)
  }
  const leaves = []
  for (const part of splitCommands(text)) {
    const match = /^pnpm (?:run )?([\w.:-]+)$/.exec(part)
    if (match && typeof PKG.scripts?.[match[1]] === 'string') {
      leaves.push(...expandScript(match[1], [...stack, name]))
      continue
    }
    leaves.push({ command: part, script: name === SOURCE_SCRIPT ? null : name, via: [...stack, name] })
  }
  return leaves
}

/**
 * Classify one leaf command into its lane. Classification reads the real test
 * file's imports, so a mount that starts using jsdom moves lanes without a
 * second hand list. The explicit command patterns come first because a
 * mutation orchestrator and a pack command also mention Node files.
 * @param {string} command leaf command
 * @returns {string} lane name
 */
export function classify(command) {
  if (CONTRACT_RE.test(command)) return 'contract'
  if (PACK_RE.test(command)) return 'pack'
  if (BENCH_RE.test(command)) return 'bench'
  if (MUTATION_RE.test(command)) return 'mutation'
  if (VITEST_RE.test(command)) return 'vitest'
  if (GUARD_RE.test(command)) return 'guard'
  if (SOURCE_MUTATION_RE.test(command)) return 'source-mutation'
  const files = [...command.matchAll(/(?:node|tsc) (?:--test )?([^\s]+)/g)]
    .map((match) => match[1])
    .filter((file) => existsSync(join(ROOT, file)))
  for (const file of files) {
    const text = readFileSync(join(ROOT, file), 'utf8')
    if (MOUNTED_RE.test(text)) return 'mounted'
    if (SSR_RE.test(text)) return 'ssr'
  }
  return 'pure'
}

/**
 * Expand and classify the whole gate, then deduplicate by exact command. Two
 * commands are the same gate even if a nested composite and the outer chain
 * both name them; running the second copy cannot add coverage.
 * @returns {{ command: string, label: string, lane: string }[]} gates
 */
export function buildGates() {
  const seen = new Set()
  const gates = []
  for (const leaf of expandScript(SOURCE_SCRIPT)) {
    if (seen.has(leaf.command)) continue
    seen.add(leaf.command)
    gates.push({
      command: leaf.command,
      label: leaf.script || leaf.command,
      lane: classify(leaf.command),
    })
  }
  return gates
}

/**
 * Weighted counting semaphore. A caller reserves memory weight before a gate
 * starts and releases it when the gate exits. Waiters are woken in FIFO order
 * and retried in a loop, so a large reservation can wait behind a small one
 * without deadlocking.
 */
export class WeightedSemaphore {
  /** @param {number} capacity total weight */
  constructor(capacity) {
    this.capacity = capacity
    this.used = 0
    /** @type {(() => void)[]} */
    this.waiters = []
  }

  /** @param {number} weight weight to reserve @returns {Promise<void>} */
  async acquire(weight) {
    if (!Number.isInteger(weight) || weight < 1 || weight > this.capacity) {
      throw new Error(`test:lib runner: invalid reservation weight ${JSON.stringify(weight)} for field "weight" at path lanes.weight; repair: use an integer between 1 and the global budget ${this.capacity}.`)
    }
    while (this.used + weight > this.capacity) {
      await new Promise((resolveWaiter) => this.waiters.push(resolveWaiter))
    }
    this.used += weight
  }

  /** @param {number} weight weight to release @returns {void} */
  release(weight) {
    this.used -= weight
    const waiters = this.waiters.splice(0)
    for (const resolveWaiter of waiters) resolveWaiter()
  }
}

/**
 * Kill a detached child's whole process group, so a timed-out mutation
 * orchestrator cannot leave its Vite child running.
 * @param {import('node:child_process').ChildProcess} child child to kill
 * @returns {void}
 */
function killTree(child) {
  if (!child.pid) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    // The group may already be gone; the SIGKILL fallback still runs.
  }
  const timer = setTimeout(() => {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      // Already gone.
    }
  }, 5000)
  timer.unref()
}

/**
 * Execute one gate as a child process, streaming prefixed lines.
 * @param {{ command: string, label: string, lane: string }} gate gate to run
 * @param {{ timeoutMs: number }} lane lane budget
 * @param {{ children: Set<import('node:child_process').ChildProcess> }} state run state
 * @returns {Promise<{ status: number | null, signal: NodeJS.Signals | null, timedOut: boolean, stderr: string[] }>} result
 */
function execute(gate, lane, state) {
  return new Promise((resolveResult) => {
    const child = spawn(gate.command, {
      cwd: ROOT,
      shell: true,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        // A leaf may name a local binary directly (`vitest run`). The shell
        // does not inherit pnpm's PATH injection, so add the workspace bin
        // directory explicitly.
        PATH: `${join(ROOT, 'node_modules', '.bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    state.children.add(child)
    const stderr = []
    let timedOut = false
    let settled = false
    const prefix = `[${gate.lane}]`
    const finish = (status, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      state.children.delete(child)
      resolveResult({ status, signal, timedOut, stderr })
    }
    const timer = setTimeout(() => {
      timedOut = true
      killTree(child)
      // Wait for the real exit so a source-mutation gate's finally block can
      // restore its tracked file. This is only a last-resort release if the
      // child ignores SIGKILL or the shell layer never reports an exit.
      const hardStop = setTimeout(() => finish(124, 'SIGKILL'), 6000)
      hardStop.unref()
    }, lane.timeoutMs)
    if (child.stdout) {
      createInterface({ input: child.stdout }).on('line', (line) => {
        process.stdout.write(`${prefix} ${line}\n`)
      })
    }
    if (child.stderr) {
      createInterface({ input: child.stderr }).on('line', (line) => {
        if (stderr.length < 40) stderr.push(line)
        process.stderr.write(`${prefix} ${line}\n`)
      })
    }
    child.once('error', (error) => {
      stderr.push(error instanceof Error ? error.message : String(error))
      finish(1, null)
    })
    child.once('exit', (status, signal) => finish(status, signal))
  })
}

/**
 * Run one lane's gates with its own concurrency budget.
 * @param {string} laneName lane name
 * @param {{ command: string, label: string, lane: string }[]} gates lane gates
 * @param {{ semaphore: WeightedSemaphore, failFast: boolean, aborted: boolean, results: any[], children: Set<import('node:child_process').ChildProcess> }} state run state
 * @returns {Promise<void>}
 */
async function runLane(laneName, gates, state) {
  const lane = LANES[laneName]
  let index = 0
  const worker = async () => {
    while (true) {
      if (state.aborted && state.failFast) return
      const gate = gates[index]
      index += 1
      if (!gate) return
      await state.semaphore.acquire(lane.weight)
      const started = performance.now()
      try {
        if (state.aborted && state.failFast) return
        process.stdout.write(`\n▶ ${gate.label} [${laneName}] ${gate.command}\n`)
        const result = await execute(gate, lane, state)
        const durationMs = Math.round(performance.now() - started)
        const ok = result.status === 0 && !result.timedOut
        state.results.push({ ...gate, ...result, durationMs, ok })
        const elapsed = `${(durationMs / 1000).toFixed(1)}s`
        process.stdout.write(`${ok ? '✔' : '✖'} ${gate.label} [${laneName}] ${elapsed}\n`)
        if (!ok) {
          state.failed = true
          if (state.failFast) state.aborted = true
        }
      } finally {
        state.semaphore.release(lane.weight)
      }
    }
  }
  await Promise.all(Array.from({ length: lane.concurrency }, () => worker()))
}

/**
 * Parse the small CLI surface.
 * @param {string[]} argv process arguments
 * @returns {{ failFast: boolean, lane: string | null, list: boolean, json: string | null }} options
 */
function parseArgs(argv) {
  const options = {
    failFast: Boolean(process.env.CI),
    lane: null,
    list: false,
    json: null,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    // pnpm forwards the `--` separator it was invoked with; it is not an
    // option. Accept it so `pnpm test:lib -- --lane pure` works as documented.
    if (arg === '--') continue
    if (arg === '--fail-fast') options.failFast = true
    else if (arg === '--keep-going') options.failFast = false
    else if (arg === '--lane') options.lane = argv[++index] ?? null
    else if (arg === '--list') options.list = true
    else if (arg === '--json') options.json = argv[++index] ?? null
    else if (arg === '--help' || arg === '-h') {
      console.log('usage: node scripts/run-test-lib.mjs [--fail-fast|--keep-going] [--lane <name>] [--list] [--json <path>]')
      process.exit(0)
    } else {
      throw new Error(`test:lib runner: unknown argument ${JSON.stringify(arg)} for field "argv" at path cli.argv; repair: run --help for the supported flags.`)
    }
  }
  return options
}

/**
 * Hash every file under src/ so a run can prove no gate left a tracked source
 * mutation behind. A timed-out source-mutation gate can be killed before its
 * `finally` restore runs, which would silently poison every later gate.
 * @param {string} directory directory to walk
 * @param {Map<string, string>} snapshot accumulator
 * @returns {Map<string, string>} path-to-digest snapshot
 */
function collectSourceSnapshot(directory, snapshot) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) collectSourceSnapshot(path, snapshot)
    else if (entry.isFile()) snapshot.set(path, createHash('sha256').update(readFileSync(path)).digest('hex'))
  }
  return snapshot
}

/**
 * Compare two source snapshots and return the changed relative paths.
 * @param {Map<string, string>} before snapshot before the run
 * @param {Map<string, string>} after snapshot after the run
 * @returns {string[]} changed, added, or removed paths
 */
function sourceDifferences(before, after) {
  const differences = []
  for (const [path, digest] of before) {
    if (!after.has(path)) differences.push(`removed ${path}`)
    else if (after.get(path) !== digest) differences.push(`modified ${path}`)
  }
  for (const path of after.keys()) if (!before.has(path)) differences.push(`added ${path}`)
  return differences.sort()
}

/**
 * Run the gate.
 * @returns {Promise<number>} process exit code
 */
async function main() {
  const options = parseArgs(process.argv.slice(2))
  const gates = buildGates()
  if (options.lane) {
    const known = Object.keys(LANES)
    if (!known.includes(options.lane)) {
      throw new Error(`test:lib runner: unknown lane ${JSON.stringify(options.lane)} for field "lane" at path cli.lane; repair: use one of ${known.join(', ')}.`)
    }
    gates.splice(0, gates.length, ...gates.filter((gate) => gate.lane === options.lane))
  }
  const lanes = Object.keys(LANES).filter((lane) => gates.some((gate) => gate.lane === lane))
  if (options.list) {
    console.log(`test:lib: ${gates.length} unique gates across ${lanes.length} lanes`)
    for (const lane of lanes) {
      console.log(`\n[${lane}] ${LANES[lane].concurrency} at a time, weight ${LANES[lane].weight}`)
      for (const gate of gates.filter((entry) => entry.lane === lane)) console.log(`  ${gate.label} :: ${gate.command}`)
    }
    return 0
  }
  const state = {
    semaphore: new WeightedSemaphore(GLOBAL_WEIGHT),
    failFast: options.failFast,
    aborted: false,
    failed: false,
    results: /** @type {any[]} */ ([]),
    children: /** @type {Set<import('node:child_process').ChildProcess>} */ (new Set()),
  }
  const shutdown = () => {
    for (const child of state.children) killTree(child)
    process.exitCode = 130
    const timer = setTimeout(() => process.exit(130), 2000)
    timer.unref()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  const sourceBefore = collectSourceSnapshot(join(ROOT, 'src'), new Map())
  const started = performance.now()
  console.log(`test:lib: ${gates.length} unique gates, ${lanes.length} lanes, ${options.failFast ? 'fail-fast' : 'keep-going'}`)
  await Promise.all(lanes.map((lane) => runLane(lane, gates.filter((gate) => gate.lane === lane), state)))
  const durationMs = Math.round(performance.now() - started)
  const sourceAfter = collectSourceSnapshot(join(ROOT, 'src'), new Map())
  const sourceChanges = sourceDifferences(sourceBefore, sourceAfter)
  if (sourceChanges.length > 0) {
    state.failed = true
    state.results.push({
      label: 'source-tree-guard',
      lane: 'source-mutation',
      command: 'snapshot src/ before and after the gate',
      ok: false,
      status: 1,
      timedOut: false,
      durationMs: 0,
      stderr: sourceChanges,
    })
  }
  const failed = state.results.filter((result) => !result.ok)
  const skipped = gates.length - state.results.length
  console.log(`\ntest:lib: ${state.results.length} of ${gates.length} gates in ${(durationMs / 1000).toFixed(1)}s, ${failed.length} failed${skipped > 0 ? `, ${skipped} not scheduled` : ''}`)
  for (const result of state.results) {
    console.log(`  ${result.ok ? 'PASS' : 'FAIL'} ${result.label} [${result.lane}] ${(result.durationMs / 1000).toFixed(1)}s :: ${result.command}`)
  }
  if (!state.failFast && skipped > 0) {
    state.failed = true
    console.error(`\ntest:lib: ${skipped} gates were not scheduled in keep-going mode; the runner must execute every gate when fail-fast is off.`)
  }
  if (failed.length > 0) {
    console.error('\ntest:lib failed gates:')
    for (const result of failed) {
      console.error(`  ${result.label} [${result.lane}] status ${String(result.status)}${result.timedOut ? ' (timed out)' : ''}: ${result.command}`)
      for (const line of result.stderr.slice(0, 12)) console.error(`    ${line}`)
    }
  }
  if (options.json) {
    writeFileSync(resolve(options.json), `${JSON.stringify({ durationMs, gates: state.results }, null, 2)}\n`)
  }
  return state.failed ? 1 : 0
}

const isEntryPoint = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href
if (isEntryPoint) {
  main().then(
    (code) => {
      process.exitCode = code
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    },
  )
}

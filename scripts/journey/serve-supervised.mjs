#!/usr/bin/env node
/* Supervise one journey webServer so a mid-run death is visible.
 *
 * Playwright starts each webServer, waits for its URL exactly once, and then
 * stops watching it. A server that dies mid-run therefore leaves the remaining
 * journeys failing on net::ERR_CONNECTION_REFUSED, and the job log with no exit
 * code, no signal, and no retained output: the failure reads as a suite
 * failure even when the server was killed from outside the suite.
 *
 * This wrapper runs the declared server command unchanged as its child and:
 *   - forwards the child's stderr to its own, which Playwright prefixes with
 *     the webServer name and writes to the job log as it arrives;
 *   - keeps the tail of both streams in a trace file next to the run artifacts;
 *   - on an unexpected child exit, prints one actionable block naming the
 *     server, the port, how the child died (exit code or signal), the last
 *     retained lines, and where the full trace lives, then exits non-zero.
 *
 * The child stays in the wrapper's process group, so Playwright's teardown
 * kill removes both and no process is orphaned.
 *
 * Usage:
 *   node scripts/journey/serve-supervised.mjs \
 *     --name <label> --port <port> --command '<server command>'
 *
 * `--command` carries the server command line verbatim and is run exactly as
 * Playwright would have run it, so the wrapper never changes what the server
 * does. Single-quote it in the caller so the shell hands it over unsplit.
 */
import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { dirname, resolve } from 'node:path'

const TAIL_LINES = 24

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = argv.indexOf(name)
  return at !== -1 && argv[at + 1] ? argv[at + 1] : fallback
}

const name = flag('--name', 'journey webServer')
const port = flag('--port', '')
const command = flag('--command', '')
if (!command) {
  process.stderr.write(
    'serve-supervised: nothing to run.\n' +
      '  what failed: the wrapper needs the server command in --command.\n' +
      "  how to fix: node scripts/journey/serve-supervised.mjs --name <label> --port <port> --command '<server command>'\n",
  )
  process.exit(2)
}

const tracePath = resolve(
  flag('--trace', `scripts/journey/.artifacts/journey-server-${port || name.replace(/\W+/g, '-')}.log`),
)
const servedURL = port ? `http://localhost:${port}` : 'its URL'

mkdirSync(dirname(tracePath), { recursive: true })
const trace = createWriteStream(tracePath, { flags: 'w' })
trace.write(`# ${name}: ${command}\n`)

const tail = []
const retain = (line) => {
  tail.push(line)
  if (tail.length > TAIL_LINES) tail.shift()
}

const child = spawn(command, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })

const pipe = (stream, channel, surface) => {
  const lines = createInterface({ input: stream })
  lines.on('line', (line) => {
    retain(`[${channel}] ${line}`)
    trace.write(`[${channel}] ${line}\n`)
    if (surface) process.stderr.write(line + '\n')
  })
}
pipe(child.stdout, 'stdout', false)
// stderr goes to the wrapper's stderr so Playwright keeps writing it to the job
// log live; stdout stays in the trace only, matching the config's stdout policy.
pipe(child.stderr, 'stderr', true)

let stopping = false
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    stopping = true
    child.kill(signal)
  })
}

/** Flush the trace before exiting, so the file never loses its last lines. */
const finish = (code, report) => {
  trace.end(() => {
    if (report) process.stderr.write(report)
    process.exit(code)
  })
}

child.on('error', (error) => {
  finish(
    127,
    `[journey webServer] ${name} could not start: ${error.message}\n` +
      `[journey webServer] command: ${command}\n` +
      `[journey webServer] how to fix: confirm the command exists on PATH for the journey run.\n`,
  )
})

child.on('close', (code, signal) => {
  trace.write(`[wrapper] child closed: code=${code} signal=${signal}\n`)
  if (stopping) {
    // Playwright's teardown kill; this is the expected end of a journey run.
    finish(code ?? 0, '')
    return
  }
  const how = signal ? `signal ${signal}` : `exit code ${code}`
  const lines = [
    `[journey webServer] ${name} stopped mid-run (${how}).`,
    `[journey webServer] everything that follows on ${servedURL} now fails with net::ERR_CONNECTION_REFUSED: the process serving it is gone.`,
    `[journey webServer] Playwright starts each webServer once and never restarts it, and a test retry cannot reconnect, so the journeys against ${servedURL} cannot pass after this point.`,
  ]
  if (signal === 'SIGKILL' || (code === null && !signal)) {
    lines.push(
      `[journey webServer] a SIGKILL with no output is an external kill (out of memory or a stopped container), not a suite failure: re-run the job and check the runner for the reason.`,
    )
  }
  lines.push(
    `[journey webServer] last retained output:`,
    ...(tail.length ? tail.map((line) => `[journey webServer]   ${line}`) : ['[journey webServer]   (none: the server wrote nothing before it died)']),
    `[journey webServer] full trace: ${tracePath}`,
  )
  finish(code ?? 1, lines.join('\n') + '\n')
})

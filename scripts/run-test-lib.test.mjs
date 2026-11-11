import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import {
  GLOBAL_WEIGHT,
  LANES,
  SOURCE_MUTATION_RE,
  WeightedSemaphore,
  buildGates,
  classify,
  countExecuted,
  expandScript,
  splitCommands,
} from './run-test-lib.mjs'
import { scanSource, scanTestFiles } from './test-lib-source-scan.mjs'
import { assertExactNames, loadStrictYaml } from './mounted-parts.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

test('the serial chain matches the required-name gate inventory', () => {
  const fixture = YAML.parse(readFileSync(join(HERE, 'testdata', 'test-lib-gates.yaml'), 'utf8'))
  const leaves = expandScript('test:lib:serial')
  assert.equal(leaves.length, fixture.expectedLeafCount, `the serial chain expanded to ${leaves.length} leaves; the required inventory records ${fixture.expectedLeafCount}`)
  const gates = buildGates()
  assert.equal(gates.length, fixture.expectedGateCount, `the deduped chain has ${gates.length} gates; the required inventory records ${fixture.expectedGateCount}`)
  const commands = gates.map((gate) => gate.command)
  assert.equal(new Set(commands).size, commands.length, 'buildGates must deduplicate exact commands')
  assert.equal(new Set(fixture.requiredGateCommands).size, fixture.requiredGateCommands.length, 'the required inventory must not repeat a command')
  assert.deepEqual([...commands].sort(), [...fixture.requiredGateCommands].sort(), `the gate inventory changed; add or remove the command in ${join('scripts', 'testdata', 'test-lib-gates.yaml')}`)
  for (const gate of gates) {
    assert.ok(LANES[gate.lane], `gate ${JSON.stringify(gate.command)} has unknown lane ${JSON.stringify(gate.lane)}`)
  }
})

test('the runner covers the required gates in the required lanes', () => {
  const gates = new Map(buildGates().map((gate) => [gate.command, gate.lane]))
  const expected = new Map([
    ['node --test scripts/release-guard.test.mjs', 'pure'],
    ['node scripts/timeline-a11y.test.mjs', 'source-mutation'],
    ['node scripts/timeline-ghosts.test.mjs', 'source-mutation'],
    ['node scripts/timeline-highlight.test.mjs', 'source-mutation'],
    ['node scripts/code-map-ranking-bench.mjs', 'bench'],
    ['vitest run', 'vitest'],
    ['tsc -p tsconfig.contract.json', 'contract'],
    ['node scripts/parts-mutations.mjs scripts/page-headings.test.mjs scripts/testdata/page-headings.manifest.yaml', 'mutation'],
    ['node scripts/packed-tarball-roundtrip.test.mjs', 'pack'],
    ['node scripts/assert-pack-contents.mjs', 'pack'],
    ['node --test scripts/run-test-lib.test.mjs', 'pure'],
  ])
  for (const [command, lane] of expected) {
    assert.equal(gates.get(command), lane, `expected ${JSON.stringify(command)} in lane ${lane}, observed ${JSON.stringify(gates.get(command))}`)
  }
})

test('every tracked-source writer is in the exclusive source-mutation lane', () => {
  const manifest = YAML.parse(readFileSync(join(HERE, 'testdata', 'test-lib-source-mutations.manifest.yaml'), 'utf8'))
  const scanned = scanTestFiles(ROOT)
  const files = scanned.map((entry) => entry.file).sort()
  assert.equal(files.length, manifest.expectedSourceMutationFileCount, `the scanner found ${files.length} tracked-source writers; the manifest records ${manifest.expectedSourceMutationFileCount}`)
  assert.deepEqual(files, [...manifest.requiredSourceMutationFiles].sort(), `the source-writing test inventory changed; update ${join('scripts', 'testdata', 'test-lib-source-mutations.manifest.yaml')}`)
  for (const entry of scanned) {
    assert.ok(entry.sites.length > 0, `${entry.file} must report at least one write site`)
    for (const site of entry.sites) assert.ok(site.line > 0 && site.callee.length > 0, `${entry.file} must report a callee and line for every site`)
    assert.equal(classify(`node ${entry.file}`), 'source-mutation', `${entry.file} must hold the whole global budget while it rewrites tracked source`)
    assert.ok(SOURCE_MUTATION_RE.test(`node ${entry.file}`), `${entry.file} must match SOURCE_MUTATION_RE`)
  }
})

test('the tracked-source scanner reads every supported write form', () => {
  const fixture = YAML.parse(readFileSync(join(HERE, 'testdata', 'test-lib-source-mutations.yaml'), 'utf8'))
  const manifest = YAML.parse(readFileSync(join(HERE, 'testdata', 'test-lib-source-mutations.manifest.yaml'), 'utf8'))
  assert.equal(fixture.scannerCases.length, manifest.expectedScannerCaseCount)
  assert.deepEqual(fixture.scannerCases.map((entry) => entry.name).sort(), [...manifest.requiredScannerCaseNames].sort())
  for (const testCase of fixture.scannerCases) {
    const sites = scanSource(testCase.source)
    assert.equal(sites.length > 0, testCase.expected, `${testCase.name}: expected ${testCase.expected ? 'a tracked write' : 'no tracked write'}, saw ${JSON.stringify(sites)}`)
  }
})

test('the summary counts gates, not the synthetic source guard', () => {
  assert.deepEqual(countExecuted([{ ok: true }, { ok: false }, { ok: false, synthetic: true }], 2), { executed: 2, skipped: 0 })
  assert.deepEqual(countExecuted([{ ok: true }, { ok: false, synthetic: true }], 2), { executed: 1, skipped: 1 })
  assert.deepEqual(countExecuted([], 147), { executed: 0, skipped: 147 })
})

test('SIGINT stops scheduling, reports the interruption, and exits 130', async () => {
  const child = spawn(process.execPath, ['scripts/run-test-lib.mjs', '--lane', 'contract'], {
    cwd: ROOT,
    env: { ...process.env, CI: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  /** @type {string} */
  let output = ''
  child.stdout.on('data', (chunk) => { output += String(chunk) })
  child.stderr.on('data', (chunk) => { output += String(chunk) })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`the runner never started a gate:\n${output}`)), 15_000)
    child.stdout.on('data', () => {
      if (!output.includes('▶ ')) return
      clearTimeout(timer)
      resolve(undefined)
    })
    child.once('exit', () => {
      clearTimeout(timer)
      reject(new Error(`the runner exited before a gate started:\n${output}`))
    })
  })
  child.kill('SIGINT')
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`the runner did not exit after SIGINT:\n${output}`))
    }, 20_000)
    child.once('close', (status) => {
      clearTimeout(timer)
      resolve(status)
    })
  })
  assert.equal(code, 130, `the interrupted run must exit 130; output:\n${output}`)
  assert.match(output, /INT|interrupted/, `the summary must name the interruption; output:\n${output}`)
  assert.doesNotMatch(output, /tracked source changed/, `the interrupted run must leave src/ clean; output:\n${output}`)
})

test('lane weights stay inside the global budget', () => {
  assert.equal(LANES['source-mutation'].weight, GLOBAL_WEIGHT)
  assert.equal(LANES.bench.weight, GLOBAL_WEIGHT)
  for (const [name, lane] of Object.entries(LANES)) {
    assert.ok(lane.weight >= 1 && lane.weight <= GLOBAL_WEIGHT, `${name} weight ${lane.weight} must be between 1 and ${GLOBAL_WEIGHT}`)
  }
})

// Tests mounted-parts.mjs here to avoid moving the library gate inventory.
test('mounted reports stop only at the expected mutation diagnostic', () => {
  const fixture = loadStrictYaml('scripts/testdata/mounted-report.yaml')
  assert.equal(fixture.cases.length, fixture.expectedCaseCount)
  assertExactNames(fixture.cases.map((entry) => entry.name), fixture.requiredCaseNames, 'mounted report cases')
  for (const entry of fixture.cases) {
    const env = { ...process.env }
    delete env.FAIRTRADE_PARTS_MUTATION
    if (entry.mutation !== null) env.FAIRTRADE_PARTS_MUTATION = entry.mutation
    const source = `import { createReport } from './scripts/mounted-parts.mjs';
      const { check, finish } = createReport('fixture gate');
      for (const message of ${JSON.stringify(entry.checks)}) { console.log('ran: ' + message); check(${Boolean(entry.passed)}, message) }
      finish('done');`
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: ROOT, env, encoding: 'utf8', timeout: 60_000 })
    assert.equal(result.error, undefined, entry.name)
    assert.equal(result.status, entry.status ?? 1, `${entry.name}: ${result.stderr}`)
    // The harness prints before each check: ran counts attempts, paired with exact stderr.
    assert.equal(result.stdout.split('\n').filter((line) => line.startsWith('ran: ')).length, entry.ran, entry.name)
    const expectedError = entry.failures.length ? `fixture gate failed:\n${entry.failures.map((message) => `- ${message}`).join('\n')}\n` : ''
    assert.equal(result.stderr, expectedError, entry.name)
    if (entry.status === 0) assert.match(result.stdout, new RegExp(`fixture gate: ${entry.ran} checks passed; done\\n$`), entry.name)
  }
})

test('splitCommands keeps the declared top-level grammar', () => {
  assert.deepEqual(splitCommands('node a.mjs && node b.mjs'), ['node a.mjs', 'node b.mjs'])
  assert.deepEqual(splitCommands('  node a.mjs  '), ['node a.mjs'])
  assert.deepEqual(splitCommands(''), [])
})

test('the weighted semaphore refuses a reservation larger than the budget', async () => {
  const semaphore = new WeightedSemaphore(2)
  await semaphore.acquire(1)
  await semaphore.acquire(1)
  await assert.rejects(() => semaphore.acquire(3), /invalid reservation weight/)
  semaphore.release(1)
  semaphore.release(1)
  assert.equal(semaphore.used, 0)
})

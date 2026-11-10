import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
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
  expandScript,
  splitCommands,
} from './run-test-lib.mjs'

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
  const fixture = YAML.parse(readFileSync(join(HERE, 'testdata', 'test-lib-source-mutations.yaml'), 'utf8'))
  const required = [...fixture.sourceMutationGates].sort()
  const scanned = readdirSync(HERE)
    .filter((name) => name.endsWith('.test.mjs'))
    .filter((name) => {
      const source = readFileSync(join(HERE, name), 'utf8')
      // Only the in-place writers use these exact first arguments. A scratch
      // copy (datatable-host-boundary) and this scanner itself must not join
      // the exclusive lane. A new in-place writer with a new constant updates
      // the required-name fixture and this pattern in the same change.
      return /writeFileSync\((?:realPath|CODE_MAP_STATE_PATH)\b/.test(source)
    })
    .sort()
  assert.deepEqual(scanned, required, `the source-writing test inventory changed; update ${join('scripts', 'testdata', 'test-lib-source-mutations.yaml')}`)
  for (const name of required) {
    assert.equal(classify(`node scripts/${name}`), 'source-mutation', `${name} must hold the whole global budget while it rewrites tracked source`)
    assert.ok(SOURCE_MUTATION_RE.test(`node scripts/${name}`), `${name} must match SOURCE_MUTATION_RE`)
  }
})

test('lane weights stay inside the global budget', () => {
  assert.equal(LANES['source-mutation'].weight, GLOBAL_WEIGHT)
  assert.equal(LANES.bench.weight, GLOBAL_WEIGHT)
  for (const [name, lane] of Object.entries(LANES)) {
    assert.ok(lane.weight >= 1 && lane.weight <= GLOBAL_WEIGHT, `${name} weight ${lane.weight} must be between 1 and ${GLOBAL_WEIGHT}`)
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

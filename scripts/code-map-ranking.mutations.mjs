#!/usr/bin/env node
/* Source mutations prove each normative ranking fixture guard can redden. */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { build } from 'vite'
import YAML from 'yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_PATH = resolve(HERE, '../src/ui/graph/ranking.js')
const GRAPH_MAP_PATH = resolve(HERE, '../src/mockups/inuse/GraphMap.jsx')
const GRAPH_DIR = resolve(HERE, '../src/ui/graph')
const source = readFileSync(SOURCE_PATH, 'utf8')
const graphMapSource = readFileSync(GRAPH_MAP_PATH, 'utf8')
const sourceSnapshot = { graph: snapshotDirectory(GRAPH_DIR), graphMap: snapshotFile(GRAPH_MAP_PATH) }
const fixture = parseOne(readFileSync(resolve(HERE, 'testdata/code-map-ranking.yaml'), 'utf8'), 'code-map ranking fixture')
const manifest = parseOne(readFileSync(resolve(HERE, 'testdata/code-map-ranking.manifest.yaml'), 'utf8'), 'code-map ranking manifest')

const literalNode = fixture.literalPin.node
const dataMutation = {
  name: 'removing the unattributable hunk exercises the hunk-clears state gate',
  run: async () => {
    const mod = await import(SOURCE_PATH + `?data-mutation=${Date.now()}`)
    const cleared = { ...literalNode, changedRegionCount: literalNode.attributedRegionCount }
    assert.notEqual(mod.debtState(cleared), fixture.literalPin.expectDebtState ?? 'partial-read')
    assert.equal(mod.debtState(cleared), 'reviewed')
  },
}

const sourceMutations = [
  mutation('changing coverage cap reddens the literal debt magnitude', 'export const COVERAGE_CAP = 0.9', 'export const COVERAGE_CAP = 1.0', (mod) => assertLiteralPin(mod)),
  mutation('checking unavailable before zero edits reddens zero-edit priority', "  if (node.agentEditedCount === 0) return 'none'\n  if (node.readAttribution === 'unavailable') return 'unknown'", "  if (node.readAttribution === 'unavailable') return 'unknown'\n  if (node.agentEditedCount === 0) return 'none'", (mod) => assertDebtCase(mod, 'unavailable attribution with zero agent edits stays none and has no agent-wrote tag')),
  mutation('dropping no-recorded-read state branch reddens unread state', "  if (node.readCount === 0) return 'no-recorded-read'", "  if (node.readCount === 0) return 'partial-read'", (mod) => assertDebtCase(mod, 'unread scores full debt')),
  mutation('weakening full unread debt reddens unread magnitude', "  if (state === 'no-recorded-read') return 1", "  if (state === 'no-recorded-read') return 0.5", (mod) => assertDebtCase(mod, 'unread scores full debt')),
  mutation('dropping mechanical partial fallback reddens mechanical state', "  return 'partial-read' // mechanical fallback: read>0, edited>0, no hunk relationship", "  return 'reviewed' // mechanical fallback: read>0, edited>0, no hunk relationship", (mod) => assertDebtCase(mod, 'partial-read mechanical fallback below floor')),
  mutation('changing mechanical debt ratio reddens mechanical magnitude', '    return clamp01(1 - mechanical)', '    return clamp01(1 - mechanical / 2)', (mod) => assertDebtCase(mod, 'partial-read mechanical fallback below floor')),
  mutation('dropping whole-file reviewed clear reddens reviewed state', '  if (fileReviewed || clears) return \'reviewed\'', '  if (clears) return \'reviewed\'', (mod) => assertDebtCase(mod, 'reviewed state clears via whole-file read state')),
  mutation('dropping unavailable state reddens unknown debt', "  if (node.readAttribution === 'unavailable') return 'unknown'", "  if (node.readAttribution === 'unavailable') return 'none'", (mod) => assertDebtCase(mod, 'unknown state when read attribution is unavailable')),
  mutation('dropping hunk partial branch reddens partial hunk coverage', "  if (node.attributedRegionCount > 0 && node.reviewedRegionCount > 0) return 'partial-read'", "  if (node.attributedRegionCount > 0 && node.reviewedRegionCount > 0) return 'reviewed'", (mod) => assertDebtCase(mod, 'partial hunk coverage maps to partial-read')),
  mutation('dropping hunk clear branch reddens fully reviewed hunks', '  const clears = node.attributedRegionCount > 0 && hunkFrac === 1 && !hasUnattributed', '  const clears = false', (mod) => assertDebtCase(mod, 'all attributable hunks reviewed clears via hunkClears')),
  mutation('dropping viewed state reddens viewed-only debt', "  if (node.readState === 'viewed') return 'viewed'", "  if (false) return 'viewed'", (mod) => assertDebtCase(mod, 'viewed-only softened state scores DEBT_VIEWED')),

  mutation('changing fully-attributed path copy reddens its hover guard', '    if (!hasUnattributed) return `${n} of ${m} changed regions reviewed`', '    if (!hasUnattributed) return `${n} of ${m} regions checked`', (mod) => assertHoverCase(mod, 'hover hunk-linked fully attributed')),
  mutation('changing unattributed-gap path copy reddens its hover guard', '    return `${n} of ${m} attributed regions reviewed; ${k} regions could not be attributed`', '    return `${n} of ${m} changed regions reviewed`', (mod) => assertHoverCase(mod, 'hover hunk-linked with unattributed gap')),
  mutation('adding a fabricated count reddens mechanical path copy', "  return 'some sessions that edited this file were read; per-region coverage is not available'", "  return '1 of 2 regions reviewed'", (mod) => assertHoverCase(mod, 'hover mechanical fallback has no region count')),

  mutation('changing no-recorded-read honesty copy reddens its tooltip', '    return `No read evidence was recorded for sessions that edited this file. ${HONESTY_PROMPT}`', '    return `Nobody read this file. ${HONESTY_PROMPT}`', (mod) => assertTooltipCase(mod, 'no-recorded-read tooltip is an evidence prompt')),
  mutation('changing viewed honesty copy reddens its tooltip', '    return `A view was recorded, but no explicit review was recorded. ${HONESTY_PROMPT}`', '    return `This file was not reviewed. ${HONESTY_PROMPT}`', (mod) => assertTooltipCase(mod, 'viewed tooltip distinguishes a view from explicit review')),
  mutation('dropping partial prompt framing reddens its tooltip', '    return detail ? `${detail}. ${HONESTY_PROMPT}` : HONESTY_PROMPT', '    return detail', (mod) => assertTooltipCase(mod, 'partial tooltip keeps path evidence and prompt framing')),
  mutation('changing unknown evidence copy reddens its tooltip', '    return `No read events were recorded for the sessions that edited this file, so its read state is unknown. ${HONESTY_PROMPT}`', '    return `This file was not read. ${HONESTY_PROMPT}`', (mod) => assertTooltipCase(mod, 'unknown tooltip explains missing recorded read events')),

  mutation('dropping no-recorded-read scent derivation reddens that scent', "  if (state === 'no-recorded-read') tags.push('agent wrote: no recorded read')", "  if (false) tags.push('agent wrote: no recorded read')", (mod) => assertScent(mod, 'agent wrote: no recorded read')),
  mutation('dropping viewed scent derivation reddens that scent', "  else if (state === 'viewed') tags.push('agent wrote: viewed, not reviewed')", "  else if (false) tags.push('agent wrote: viewed, not reviewed')", (mod) => assertScent(mod, 'agent wrote: viewed, not reviewed')),
  mutation('dropping unknown scent derivation reddens that scent', "  else if (state === 'unknown') tags.push('agent wrote: read state unknown')", "  else if (false) tags.push('agent wrote: read state unknown')", (mod) => assertScent(mod, 'agent wrote: read state unknown')),
  mutation('raising churn threshold reddens heavy-churn scent', '    if (ratio >= HEAVY_CHURN_QUANTILE && tags.length < 2)', '    if (ratio > 1 && tags.length < 2)', (mod) => assertScent(mod, 'heavy churn')),
  mutation('dropping active-session comparison reddens edited-session scent', '  if (context.hoveredOrSelectedSessionId && node.recentSessionId === context.hoveredOrSelectedSessionId && tags.length < 2)', '  if (false)', (mod) => assertScent(mod, 'edited this session')),
  mutation('raising effort threshold reddens high-effort scent', '  if (node.effortDensity >= HIGH_EFFORT_DENSITY && tags.length < 2)', '  if (node.effortDensity > 1 && tags.length < 2)', (mod) => assertScent(mod, 'high effort density')),
  mutation('dropping near-focus distance reddens focus scent', '    if (dist !== null && dist <= FOCUS_DISTANCE_THRESHOLD && tags.length < 2)', '    if (false)', (mod) => assertScent(mod, 'near your focus')),

  mutation('changing touch DOI weight reddens exact intrinsic terms', '  touch: 0.35,', '  touch: 0.34,', (mod) => assertRankingCase(mod, 'each DOI weight contributes its pinned intrinsic value')),
  mutation('changing effort DOI weight reddens exact intrinsic terms', '  effortDensity: 0.25,', '  effortDensity: 0.24,', (mod) => assertRankingCase(mod, 'each DOI weight contributes its pinned intrinsic value')),
  mutation('changing debt DOI weight reddens exact intrinsic terms', '  debt: 0.25,', '  debt: 0.24,', (mod) => assertRankingCase(mod, 'each DOI weight contributes its pinned intrinsic value')),
  mutation('changing recency DOI weight reddens exact intrinsic terms', '  recency: 0.15,', '  recency: 0.14,', (mod) => assertRankingCase(mod, 'each DOI weight contributes its pinned intrinsic value')),
  mutation('changing degenerate normalization reddens all-equal DOI', '  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return values.map(() => 0)', '  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return values.map(() => 1)', (mod) => assertRankingCase(mod, 'doi degenerate all-equal payload yields zero for every row')),
  mutation('reversing node-id tie break reddens DOI ties', '    return b.doi - a.doi || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)', '    return b.doi - a.doi || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)', (mod) => assertRankingCase(mod, 'doi ties break by nodeId ascending')),
  mutation('dropping debt-mode boost reddens debt ordering', "  const boosted = rankMode === 'debt' ? 'debt' : 'touch'", "  const boosted = 'touch'", (mod) => assertRankingCase(mod, 'debt rank mode boosts the debt term')),
  mutation('dropping debt category partition reddens known-before-unknown ordering', "    if (rankMode === 'debt') {", '    if (false) {', (mod) => assertRankingCase(mod, 'debt rank mode partitions known debt before unknown before clear regardless of residual terms')),
  mutation('changing churn-mode boost reddens churn ordering', "  const boosted = rankMode === 'debt' ? 'debt' : 'touch'", "  const boosted = 'debt'", (mod) => assertRankingCase(mod, 'churn rank mode boosts touch without debt partitioning')),
  mutation('dropping active session from re-derivation reddens session filtering', '        hoveredOrSelectedSessionId: options.hoveredOrSelectedSessionId,', '        hoveredOrSelectedSessionId: null,', (mod) => assertRankingCase(mod, 'rankMapNodes derives edited-this-session through active session context')),
  mutation('dropping contract validation accepts unknown read-attribution state', '  assertRankingContractValues(nodes)', '  void nodes', (mod) => assertAdapterCase(mod, 'unknown read-attribution state fails closed at the ranking adapter')),
  mutation('dropping contract validation accepts unknown read-state grade', '  assertRankingContractValues(nodes)', '  void nodes', (mod) => assertAdapterCase(mod, 'unknown read-state grade fails closed at the ranking adapter')),

  mutation('changing rank floor reddens floor gating', 'export const RANK_FLOOR = 5', 'export const RANK_FLOOR = 6', (mod) => assertGatingCase(mod, 'threshold gating floors at five rows')),
  mutation('changing rank cap reddens cap gating', 'export const RANK_CAP = 25', 'export const RANK_CAP = 24', (mod) => assertGatingCase(mod, 'threshold gating caps at twenty-five rows')),
  mutation('dropping expanded bypass reddens show-all gating', '  const visible = options.expanded ? rows : capped', '  const visible = capped', (mod) => assertGatingCase(mod, 'show-all bypasses threshold and cap then reports no overflow')),
  mutation('dropping debt priority from gate hides known debt', "  const requiredDebtIds = options.rankMode === 'debt'", '  const requiredDebtIds = false', (mod) => assertGatingCase(mod, 'debt gating keeps low-scoring known debt ahead of thresholded unknown rows')),
  mutation('changing threshold multiplier reddens threshold gating', '  const threshold = Math.max(0.25, 0.5 * maxDOI)', '  const threshold = Math.max(0.25, 0.4 * maxDOI)', (mod) => assertGatingCase(mod, 'threshold uses half of max DOI before applying the floor')),
]

const graphMapMutation = {
  name: 'adding interaction state to intrinsic memo dependencies reddens computation split',
  find: '  }), [state.rankMode])\n  const debouncedScentFilter',
  replace: '  }), [state.rankMode, state.hoveredSessionId])\n  const debouncedScentFilter',
}

const mutationNames = [dataMutation.name, ...sourceMutations.map((item) => item.name), graphMapMutation.name]
assert.equal(manifest.expectedMutationCount, mutationNames.length, 'manifest expectedMutationCount must match executed mutations')
assert.deepEqual(manifest.mutationNames, mutationNames, 'manifest mutation names must match execution order')

const mutationRoot = mkdtempSync(join(tmpdir(), 'fairtrade-code-map-ranking-'))
try {
  symlinkSync(resolve(HERE, '..', 'node_modules'), join(mutationRoot, 'node_modules'), 'dir')
  await dataMutation.run()
  console.log(`PASS: ${dataMutation.name}`)

  for (const [index, item] of sourceMutations.entries()) {
    const occurrences = source.split(item.find).length - 1
    if (occurrences !== 1) throw new Error(`${item.name}: mutation target must occur exactly once, received ${occurrences}`)
    const outDir = join(mutationRoot, `${String(index).padStart(2, '0')}-${item.name.replace(/[^a-z0-9]+/gi, '-')}`)
    let killed = false
    try {
      await build({
        root: resolve(HERE, '..'),
        configFile: false,
        logLevel: 'silent',
        plugins: [inMemorySourcePlugin(new Map([[SOURCE_PATH, source.replace(item.find, item.replace)]]))],
        build: {
          outDir,
          emptyOutDir: true,
          lib: { entry: SOURCE_PATH, formats: ['es'], fileName: () => 'mutant.mjs' },
          rollupOptions: { external: ['@peasant-labs/schema'] },
          minify: false,
        },
      })
      const mod = await import(resolve(outDir, 'mutant.mjs') + `?mutation=${index}-${Date.now()}`)
      try {
        item.assertMutant(mod)
      } catch {
        killed = true
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
    if (!killed) throw new Error(`${item.name}: mutation survived its fixture assertion`)
    console.log(`PASS: ${item.name}`)
  }

  const occurrences = graphMapSource.split(graphMapMutation.find).length - 1
  if (occurrences !== 1) throw new Error(`${graphMapMutation.name}: mutation target must occur exactly once, received ${occurrences}`)
  const mutated = graphMapSource.replace(graphMapMutation.find, graphMapMutation.replace)
  let killed = false
  try {
    assertSplitSource(mutated)
  } catch {
    killed = true
  }
  if (!killed) throw new Error(`${graphMapMutation.name}: mutation survived its fixture assertion`)
  console.log(`PASS: ${graphMapMutation.name}`)
} finally {
  rmSync(mutationRoot, { recursive: true, force: true })
  assertSourceSnapshots(sourceSnapshot)
  assertNoMutationResidue()
}

console.log(`code-map ranking mutations: ${mutationNames.length} guard-specific mutations killed`)

function inMemorySourcePlugin(sources) {
  const normalized = new Map([...sources].map(([path, text]) => [normalize(path), text]))
  return {
    name: 'in-memory-code-map-ranking-mutation',
    enforce: 'pre',
    load(id) {
      return normalized.get(normalize(id.split('?')[0])) ?? null
    },
  }
}

function snapshotFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function snapshotDirectory(directory) {
  const snapshot = new Map()
  collectFiles(directory, snapshot)
  return snapshot
}

function collectFiles(directory, snapshot) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) collectFiles(path, snapshot)
    else if (entry.isFile()) snapshot.set(path, snapshotFile(path))
    else throw new Error(`code-map ranking mutation snapshot found a non-regular source entry at ${path}`)
  }
}

function assertSourceSnapshots(before) {
  const differences = []
  const afterGraph = snapshotDirectory(GRAPH_DIR)
  for (const [path, hash] of before.graph) {
    if (!afterGraph.has(path)) differences.push(`removed ${path}`)
    else if (afterGraph.get(path) !== hash) differences.push(`modified ${path}`)
  }
  for (const path of afterGraph.keys()) if (!before.graph.has(path)) differences.push(`added ${path}`)
  const afterGraphMap = snapshotFile(GRAPH_MAP_PATH)
  if (afterGraphMap !== before.graphMap) differences.push(`modified ${GRAPH_MAP_PATH}`)
  if (differences.length > 0) throw new Error(`code-map ranking mutation changed source files: ${differences.sort().join(', ')}`)
}

function assertNoMutationResidue() {
  const residue = []
  for (const root of [resolve(HERE, '../src'), resolve(HERE, '../dist'), HERE]) {
    if (existsSync(root)) collectResidue(root, residue)
  }
  if (residue.length > 0) throw new Error(`code-map ranking mutation residue remains beneath src/dist or scripts: ${residue.sort().join(', ')}`)
}

function collectResidue(directory, residue) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.name.includes('ranking.mutant')) residue.push(path)
    if (entry.isDirectory()) collectResidue(path, residue)
  }
}

function mutation(name, find, replace, assertMutant) {
  return { name, find, replace, assertMutant }
}

function assertDebtCase(mod, name) {
  const testCase = findCase(fixture.debtCases, name)
  const state = mod.debtState(testCase.node)
  assert.equal(state, testCase.expectDebtState)
  assert.equal(mod.debt(testCase.node, state), testCase.expectDebt)
  assert.equal(mod.coverage(testCase.node), testCase.expectCoverage)
  assert.equal(mod.hunkClears(testCase.node), testCase.expectHunkClears)
  if (testCase.expectScentTags) assert.deepEqual(mod.scentTagsFor(testCase.node, state), testCase.expectScentTags)
}

function assertHoverCase(mod, name) {
  const testCase = findCase(fixture.hoverCases, name)
  assert.equal(mod.partialReadHoverText(testCase.node), testCase.expectHover)
}

function assertTooltipCase(mod, name) {
  const testCase = findCase(fixture.tooltipCases, name)
  const state = mod.debtState(testCase.node)
  assert.equal(mod.debtHoverText(testCase.node, state), testCase.expectTooltip)
}

function assertScent(mod, tag) {
  const derivation = fixture.scentExhaustiveness.derivations.find((candidate) => candidate.tag === tag)
  if (!derivation) throw new Error(`missing scent derivation ${tag}`)
  const context = { ...(derivation.context ?? {}) }
  if (context.parentOf) context.parentOf = new Map(Object.entries(context.parentOf))
  const tags = mod.scentTagsFor(derivation.node, mod.debtState(derivation.node), context)
  assert.ok(tags.includes(tag))
}

function assertRankingCase(mod, name) {
  const testCase = findCase(fixture.rankingCases, name)
  const rows = mod.rankMapNodes(testCase.nodes, testCase.options)
  if (testCase.expectOrder) assert.deepEqual(rows.map((row) => row.id), testCase.expectOrder)
  if (testCase.expectAllDOIZero) assert.ok(rows.every((row) => row.doi === 0))
  if (testCase.expectDOI) assert.deepEqual(Object.fromEntries(rows.map((row) => [row.id, row.doi])), testCase.expectDOI)
}

function assertGatingCase(mod, name) {
  const testCase = findCase(fixture.gatingCases, name)
  let rows = testCase.rows
  if (testCase.nodes) rows = mod.rankMapNodes(testCase.nodes, testCase.rankOptions)
  if (!rows) {
    const nodes = Array.from({ length: testCase.count }, (_, index) => {
      const id = `n${String(index).padStart(3, '0')}`
      return testCase.doi === 'uniform-high'
        ? { id, name: id, touchCount: 0, effortDensity: 0, agentEditedCount: 1, readCount: 0, readAttribution: 'complete', readState: 'none', changedRegionCount: 0, attributedRegionCount: 0, reviewedRegionCount: 0 }
        : { id, name: id, touchCount: 0, effortDensity: 0, agentEditedCount: 0, readCount: 0, readAttribution: 'complete', readState: 'none', changedRegionCount: 0, attributedRegionCount: 0, reviewedRegionCount: 0 }
    })
    rows = mod.rankMapNodes(nodes)
  }
  const gated = mod.gateRankedRows(rows, testCase.options)
  if (testCase.expectVisibleCount !== undefined) assert.equal(gated.visible.length, testCase.expectVisibleCount)
  if (testCase.expectOverflowCount !== undefined) assert.equal(gated.overflowCount, testCase.expectOverflowCount)
  if (testCase.expectVisibleIds) assert.deepEqual(gated.visible.map((row) => row.id), testCase.expectVisibleIds)
}

function assertAdapterCase(mod, name) {
  const testCase = findCase(fixture.adapterCases, name)
  assert.throws(() => mod.rankMapNodesIntrinsic([testCase.node]))
}

function assertLiteralPin(mod) {
  const state = mod.debtState(literalNode)
  assert.equal(mod.debt(literalNode, state), fixture.literalPin.expectDebtLiteral)
}

function assertSplitSource(text) {
  const testCase = fixture.splitCases[0]
  for (const needle of testCase.sourceMustContain) assert.ok(text.includes(needle))
}

function findCase(cases, name) {
  const testCase = cases.find((candidate) => candidate.name === name)
  if (!testCase) throw new Error(`mutation fixture is missing ${JSON.stringify(name)}`)
  return testCase
}

function parseOne(text, label) {
  const documents = YAML.parseAllDocuments(text, { strict: true, uniqueKeys: true })
  const errors = documents.flatMap((document) => document.errors)
  if (errors.length) throw new Error(`${label} has invalid strict YAML or a duplicate key: ${errors.map((error) => error.message).join('; ')}`)
  if (documents.length !== 1) throw new Error(`${label} must contain exactly one YAML document`)
  return documents[0].toJS()
}

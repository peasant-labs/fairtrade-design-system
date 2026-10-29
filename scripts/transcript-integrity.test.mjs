#!/usr/bin/env node
/* Gate for the pure integrity view and the cooked turn's source position.
   integrityView decides whether the badge draws and which wire positions are marked; the adapter
   must give every main turn its position in payload.turns so a served position can find its turn.
   Cases: scripts/testdata/transcript-integrity.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-integrity;
   mutations: pnpm test:transcript-integrity:mutations */
import { loadFixturePair, assertExactNames, assertFields, withMountedSource, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-integrity.yaml'
const MANIFEST = 'scripts/testdata/transcript-integrity.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  viewCases: 'requiredViewCaseNames',
  adapterCases: 'requiredAdapterCaseNames',
})
for (const row of fixture.viewCases) assertFields(row, ['name', 'expect'], `${FIXTURE} ${row.name}`, ['integrity', 'malformed', 'transcriptContentHash', 'contentHash'])
for (const row of fixture.adapterCases) assertFields(row, ['name', 'builder', 'expect'], `${FIXTURE} ${row.name}`, ['options', 'earlierUndefined'])

const wireBase = {
  id: 'integrity', harness: 'claude-code', startTime: '2026-09-20T10:00:00Z', endTime: '2026-09-20T10:05:00Z',
  durationMins: 5, totalTokens: 0, tokensIn: 0, tokensOut: 0, toolCallCount: 0, outcome: 'resolved',
}
const turn = (index, role, content, extra = {}) => ({ index, role, content, timestamp: '2026-09-20T10:01:00Z', depth: 0, ...extra })
const BUILDERS = {
  plain: () => [turn(0, 'user', 'first prompt'), turn(1, 'assistant', 'first answer'), turn(2, 'user', 'second prompt')],
  metadataBetween: () => [turn(0, 'user', 'first prompt'), turn(1, 'system', 'custom-title: a name'), turn(2, 'assistant', 'an answer')],
  repeatedIndex: () => [turn(5, 'user', 'first prompt'), turn(5, 'assistant', 'an answer')],
  unknownTimestamp: () => [turn(0, 'user', 'first prompt'), turn(1, 'assistant', 'flagged answer', { timestamp: '0001-01-01T00:00:00Z' }), turn(2, 'user', 'second prompt')],
  earlierHistory: () => [turn(0, 'user', 'first prompt')],
}

/* the service name is assembled so the word never appears in fairtrade source */
const SERVICE_NAME = ['scr', 'y'].join('')

const report = createReport('transcript integrity')

await withMountedSource(async ({ load }) => {
  const { integrityView, INTEGRITY_COPY } = await load('/src/ui/transcript/integrity.js')
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')

  const show = (value) => JSON.stringify(value) ?? 'undefined'
  for (const row of fixture.viewCases) {
    const integrities = row.malformed ?? [row.integrity]
    for (const integrity of integrities) {
      const got = integrityView(integrity, row.transcriptContentHash, row.contentHash)
      const view = got === null ? null : { positions: [...got.positions] }
      report.check(show(view) === show(row.expect), `${row.name}: integrity ${show(integrity)} expected ${show(row.expect)}, received ${show(view)}`)
    }
  }

  for (const row of fixture.adapterCases) {
    const build = BUILDERS[row.builder]
    if (!build) throw new Error(`${FIXTURE} ${row.name}: unknown builder ${row.builder}`)
    const payload = { ...wireBase, turnCount: 0, turns: build() }
    if (row.earlierUndefined) payload.earlierHistory = [{ state: 'uncertain_unresolved', turns: [turn(0, 'user', 'older prompt'), turn(1, 'assistant', 'older answer')] }]
    const vm = adaptTranscript(payload, undefined, undefined, row.options)
    const pairs = vm.turns.map((t) => [t.index, t.sourcePosition])
    report.check(show(pairs) === show(row.expect), `${row.name}: expected ${show(row.expect)}, received ${show(pairs)}`)
    if (row.earlierUndefined) {
      const earlier = vm.earlierHistory?.[0]?.turns ?? []
      report.check(earlier.length > 0, `${row.name}: the fixture must cook at least one earlier turn`)
      report.check(earlier.every((t) => t.sourcePosition === undefined), `${row.name}: earlier history turns must have no source position`)
    }
  }

  assertExactNames(Object.keys(INTEGRITY_COPY), manifest.requiredCopyKeys, 'INTEGRITY_COPY keys')
  report.check(Object.isFrozen(INTEGRITY_COPY), 'INTEGRITY_COPY must be frozen')
  const values = Object.entries(INTEGRITY_COPY)
  report.check(values.every(([, v]) => typeof v === 'string' && v.length > 0), 'every INTEGRITY_COPY value must be a non-empty string')
  for (const [key, value] of values) {
    report.check(!/[\u00b7\u2014\u2013]/.test(value), `copy has no middle dot or em dash: ${key}`)
    report.check(!/token|timestamp|hash|parent|chain|usage|duration|commit|rule \w+|version/i.test(value) && !new RegExp(SERVICE_NAME, 'i').test(value), `copy names no rule or field: ${key}`)
  }
})

report.finish('every view case, adapter case and copy string passed')

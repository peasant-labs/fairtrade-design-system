// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import YAML from 'yaml'
import TranscriptViewer from '../../src/ui/transcript/TranscriptViewer.jsx'
import { adaptTranscript } from '../../src/ui/transcript/adapter.js'
import { buildDirectory, makeSegments } from '../../scripts/transcript-segment-fixture.mjs'

// The standalone gate and this mounted gate consume the same named cases and
// segment constructor, so the reader-facing evidence has one fixture source.
const fixture = YAML.parse(readFileSync(resolve(process.cwd(), 'scripts/testdata/transcript-segments.yaml'), 'utf8'))
const selected = (family, name) => {
  const row = fixture[family].find(item => item.name === fixture.vitestSelection[name])
  if (!row) throw new Error(`transcript segment fixture: missing selected ${family} case ${name}`)
  return row
}
const directoryFor = row => fixture.directories.find(def => def.name === row.directory)
const capabilities = { canEdit: false, canLabel: false, canContribute: true, canChangeVisibility: false, canExport: true }
const text = node => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
const viewModel = (extra = {}) => ({
  session: { id: 'sess_segment_fixture', title: 'a segmented transcript', harness: 'claude-code' },
  turns: [], toolCallsById: new Map(), diffs: [], files: [], tasks: [], highlights: [],
  filterIndex: { annotationsByTurn: {}, toolGroupCounts: {} }, analytics: {}, ...extra,
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let container = null
let root = null

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount())
    root = null
  }
  if (container) {
    container.remove()
    container = null
  }
})

async function mount(element) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root.render(element) })
  return container
}

const viewer = (props, extra) => <TranscriptViewer viewModel={viewModel(extra)} capabilities={capabilities} presentation="ledger" {...props} />
const descriptor = row => ({ sessionId: 'sess_segment_fixture', revision: '7', ...row.window })

describe('TranscriptViewer segment evidence under Vitest', () => {
  const held = selected('mountCases', 'heldWindow')
  it(held.name, async () => {
    const def = directoryFor(held)
    const mounted = await mount(viewer({ directory: buildDirectory(def), segments: makeSegments(def, held.loaded), window: descriptor(held), onLoadSegment: () => {} }))
    expect([...mounted.querySelectorAll('.txn-held-window')].map(text)).toEqual(held.expect.heldCaptions)
    expect([...mounted.querySelectorAll('[data-segment-boundary]')].map(node => node.dataset.segmentBoundary)).toEqual(held.expect.boundarySides)
    expect([...mounted.querySelectorAll('.txn-segboundary-caption')].map(text)).toEqual(held.expect.captions)
    expect(mounted.querySelectorAll('.txn-action-continuation')).toHaveLength(held.expect.continuationCount)
    expect([...mounted.querySelectorAll('[data-segment-boundary], .txn-held-window')].map(node => node.hasAttribute('data-segment-boundary') ? 'boundary' : 'held')).toEqual(held.expect.heldOrder)
  })

  const failed = selected('recoveryCases', 'failedWindow')
  it(failed.name, async () => {
    const def = directoryFor(failed)
    const directory = buildDirectory(def)
    const load = vi.fn().mockRejectedValueOnce(new Error('failed fetch')).mockResolvedValue(undefined)
    const props = { directory, segments: makeSegments(def, failed.loaded), window: descriptor(failed), onLoadSegment: load }
    const mounted = await mount(viewer(props))
    const failure = mounted.querySelector('.txn-held-window[role="alert"]')
    expect(text(failure)).toContain(failed.failureCopy)
    expect(text(failure?.querySelector('button'))).toBe(failed.retryCopy)
    expect(mounted.querySelector(`#turn-${failed.restoredTurn}`)).not.toBeNull()
    expect(mounted.querySelector('[data-segment-boundary]')).not.toBeNull()
    await act(async () => { failure.querySelector('button').click() })
    expect(load.mock.calls.map(call => call[0])).toEqual(failed.requests)
    const complete = [...new Set([...failed.loaded, ...failed.window.segments])]
    await act(async () => { root.render(viewer({ ...props, segments: makeSegments(def, complete) })) })
    expect(mounted.querySelector(`#turn-${failed.window.anchorTurn}`)).not.toBeNull()
    expect(mounted.querySelector('.txn-held-window[role="alert"]')).toBeNull()
  })

  for (const row of fixture.historyCases) {
    it(row.name, async () => {
      const payload = { ...fixture.historyPayload, earlierHistory: [{ state: row.state, turns: [] }] }
      const cooked = adaptTranscript(payload)
      expect(cooked.earlierHistory[0].state.wire).toBe(row.state)
      expect(Object.isFrozen(cooked.earlierHistory[0].state)).toBe(true)
      const mounted = await mount(<TranscriptViewer viewModel={cooked} capabilities={capabilities} earlierHistoryOpen={{ [cooked.earlierHistory[0].id]: true }} />)
      expect(text(mounted.querySelector('.txn-earlier .txn-context-status'))).toBe(row.label)
      expect(text(mounted.querySelector('.txn-earlier .txn-context-note'))).toBe(row.explanation)
    })
  }
  for (const row of fixture.unknownHistoryInvalidCases) {
    it(row.name, () => {
      expect(() => adaptTranscript({ ...fixture.historyPayload, earlierHistory: [row.section] })).toThrow(/earlier evidence validation/)
    })
  }

  const phase = selected('phaseCases', 'phase')
  it(phase.name, async () => {
    const def = directoryFor(phase)
    const mounted = await mount(viewer({ directory: buildDirectory(def), segments: makeSegments(def, phase.loaded) }, { analytics: { phases: [phase.phase] } }))
    expect(text(mounted.querySelector('.txn-phase .rng'))).toBe(phase.caption)
    const captions = [...mounted.querySelectorAll('.txn-segboundary-caption')].map(text)
    expect(captions.length).toBeGreaterThan(0)
    for (const caption of captions) expect(caption).not.toMatch(/\bturns?\s+\d|\b\d[\d,]*\s+turns?\b/i)
  })
})

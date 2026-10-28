#!/usr/bin/env node
/* Mounted-source gate for how the transcript treats session records and times: Claude Code's
   session metadata records are not turns (a real system turn and another harness's text stay),
   an unknown timestamp (missing, zero, epoch, Go zero-time) is no time in the cooked model and
   shows no "ago" label in the mounted turn, the session duration reads in the one short format,
   and the user-turn steps list leaves out a zero duration. It cooks the REAL adapter and mounts
   the REAL TranscriptViewer.
   Cases: scripts/testdata/transcript-session-records.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-session-records; mutations: node scripts/parts-mutations.mjs
   scripts/transcript-session-records.test.mjs scripts/testdata/transcript-session-records.manifest.yaml. */
import { loadFixturePair, withMountedSource, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-session-records.yaml'
const MANIFEST = 'scripts/testdata/transcript-session-records.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })
const report = createReport('transcript session records')

const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()

await withMountedSource(async ({ load, mount, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const cook = (row) => adaptTranscript({
    ...fixture.payload,
    ...(row.harness ? { harness: row.harness } : {}),
    ...(row.turns ? { turns: row.turns, turnCount: row.turns.length } : {}),
  })
  const viewer = (vm) => React.createElement(TranscriptViewer, { viewModel: vm, capabilities: CAPABILITIES, presentation: 'classic' })

  for (const row of fixture.cases) {
    const name = row.name
    const vm = cook(row)
    if (row.kind === 'turns') {
      const indices = vm.turns.map((turn) => turn.index)
      report.check(same(indices, row.expected), `${name}: cooked turns must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(indices)}`)
    } else if (row.kind === 'times') {
      const times = Object.fromEntries(vm.turns.map((turn) => [String(turn.index), turn.timestamp ?? null]))
      report.check(same(times, row.expected), `${name}: cooked times must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(times)}`)
    } else if (row.kind === 'session') {
      const times = { startTime: vm.session.startTime, endTime: vm.session.endTime }
      report.check(same(times, row.expected), `${name}: session times must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(times)}`)
    } else if (row.kind === 'meta-duration') {
      const mounted = await mount(viewer(vm))
      const items = [...mounted.container.querySelectorAll('.txn-meta .metaitem')].map(text)
      report.check(items.includes(row.expected), `${name}: meta duration must read ${JSON.stringify(row.expected)}, received ${JSON.stringify(items)}`)
      report.check(!items.some((item) => /\d\.\d{3,}/.test(item)), `${name}: meta duration must never show raw fractional minutes, received ${JSON.stringify(items)}`)
      await mounted.unmount()
    } else if (row.kind === 'turn-time') {
      const mounted = await mount(viewer(vm))
      const card = mounted.container.querySelector(`article[data-turn="${row.turn}"]`)
      report.check(!!card, `${name}: turn ${row.turn} must render`)
      const label = card?.querySelector('.txn-turntime') ? text(card.querySelector('.txn-turntime')) : null
      report.check(label === row.expected, `${name}: turn ${row.turn} time must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(label)}`)
      const agoLabels = [...mounted.container.querySelectorAll('.txn-turntime')].map(text).filter((value) => /\d{4,}d ago/.test(value))
      report.check(agoLabels.length === 0, `${name}: no turn may show "ago" math on an unknown time, received ${JSON.stringify(agoLabels)}`)
      await mounted.unmount()
    } else if (row.kind === 'steps') {
      const mounted = await mount(viewer(vm))
      const labels = [...mounted.container.querySelectorAll('.swf-dur')].map(text)
      const zero = labels.filter((value) => value === '0s').length
      report.check(mounted.container.querySelectorAll('.swf-item').length > 0, `${name}: the steps list must render its user turns`)
      report.check(zero === row.expected.zeroLabels, `${name}: step durations must leave out zero, received ${JSON.stringify(labels)}`)
      await mounted.unmount()
    } else if (row.kind === 'user-content') {
      const cooked = vm.turns.find((turn) => turn.index === row.turn)
      const recorded = row.turns.find((turn) => turn.index === row.turn)?.content
      report.check(cooked?.content === recorded, `${name}: the recorded content must stay as recorded, received ${JSON.stringify(cooked?.content)}`)
      const displayed = cooked ? (cooked.displayContent ?? cooked.content) : null
      report.check(displayed === row.expected.shown, `${name}: the shown prompt must be ${JSON.stringify(row.expected.shown)}, received ${JSON.stringify(displayed)}`)
      const mounted = await mount(viewer(vm))
      const shown = text(mounted.container.querySelector(`article[data-turn="${row.turn}"]`))
      report.check(shown.includes(row.expected.shown), `${name}: the mounted turn must show ${JSON.stringify(row.expected.shown)}, received ${JSON.stringify(shown)}`)
      for (const hidden of row.expected.hidden) {
        report.check(!shown.includes(hidden), `${name}: the mounted turn must not show ${JSON.stringify(hidden)}, received ${JSON.stringify(shown)}`)
      }
      // the trace outline lists the task this prompt opens, and the highlights open on it
      const outline = text(mounted.container.querySelector('.txn-ol-waterfall'))
      const opener = row.expected.shown.split(/\s+/).slice(0, 3).join(' ')
      report.check(outline.includes(opener), `${name}: the trace outline must list ${JSON.stringify(opener)}, received ${JSON.stringify(outline)}`)
      const request = vm.highlights.find((highlight) => highlight.kind === 'request')?.sub ?? ''
      for (const hidden of row.expected.hidden) {
        report.check(!outline.includes(hidden), `${name}: the trace outline must not show ${JSON.stringify(hidden)}`)
        report.check(!request.includes(hidden), `${name}: the initial-request highlight must not show ${JSON.stringify(hidden)}`)
      }
      await mounted.unmount()
    } else {
      throw new Error(`${FIXTURE}: unknown case kind ${row.kind}`)
    }
  }
})

report.finish(`${fixture.cases.length} cases over session metadata records, unknown times, the session duration, the steps list and the shown prompt.`)

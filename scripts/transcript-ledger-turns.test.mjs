#!/usr/bin/env node
/* Mounted-source gate for the ledger presentation's turns. The summary rows import the pure
   work-summary helpers directly and assert the counts and both labels; the mount rows cook the
   REAL adapter and mount the REAL TranscriptViewer, then assert what a reader reaches: classic
   keeps the flat tool rows, the ledger presentation groups a turn's tools into one panel with
   its computed summary and working per-tool disclosures, a system turn becomes a compact row
   with a working disclosure and its copy-anchor, a turn's thinking disclosure survives, and a
   turn without tools renders no panel at all.
   Cases: scripts/testdata/transcript-ledger-turns.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-ledger-turns;
   mutations: node scripts/parts-mutations.mjs scripts/transcript-ledger-turns.test.mjs
   scripts/testdata/transcript-ledger-turns.manifest.yaml */
import { loadFixturePair, assertExactNames, assertFields, withMountedSource, click, createReport } from './mounted-parts.mjs'
import { workSummary, workCountLabel, workMetaLabel } from '../src/ui/transcript/work-summary.js'

const FIXTURE = 'scripts/testdata/transcript-ledger-turns.yaml'
const MANIFEST = 'scripts/testdata/transcript-ledger-turns.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, {
  summaryCases: 'requiredSummaryNames',
  cases: 'requiredCaseNames',
})

/* every summary row lists every expected field, so a new count cannot slip in unasserted. */
const SUMMARY_FIELDS = ['calls', 'commands', 'files', 'edits', 'failed', 'durationMs']
for (const row of fixture.summaryCases) {
  assertFields(row, ['name', 'tools', 'expected', 'countLabel', 'metaLabel'], `${FIXTURE} ${row.name}`)
  assertExactNames(Object.keys(row.expected), SUMMARY_FIELDS, `${FIXTURE} ${row.name} expected`)
}
for (const row of fixture.cases) assertFields(row, ['name', 'kind'], `${FIXTURE} ${row.name}`)

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()

const report = createReport('transcript ledger turns')

/* ── the pure summary: no DOM, the same helpers the panel uses ───────────────── */
for (const row of fixture.summaryCases) {
  const summary = workSummary(row.tools)
  const actual = Object.fromEntries(SUMMARY_FIELDS.map((field) => [field, summary[field]]))
  report.check(same(actual, row.expected), `${row.name}: summary must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
  const countLabel = workCountLabel(summary)
  report.check(countLabel === row.countLabel, `${row.name}: count must read ${JSON.stringify(row.countLabel)}, received ${JSON.stringify(countLabel)}`)
  const metaLabel = workMetaLabel(summary)
  report.check(metaLabel === row.metaLabel, `${row.name}: meta must read ${JSON.stringify(row.metaLabel)}, received ${JSON.stringify(metaLabel)}`)
}

const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }

await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const vm = adaptTranscript(fixture.payload)
  const toolsTurn = vm.turns.find((turn) => turn.index === 1)
  const tools = toolsTurn?.toolCalls ?? []
  if (tools.length !== 4) throw new Error(`${FIXTURE}: the payload must cook turn 1 with 4 tool calls, received ${tools.length}`)
  const summary = workSummary(tools)
  const expectedCount = workCountLabel(summary)
  const expectedMeta = workMetaLabel(summary)
  const toolLessTurns = [3, 5]
  for (const index of toolLessTurns) {
    const turn = vm.turns.find((entry) => entry.index === index)
    if (!turn || (turn.toolCalls ?? []).length !== 0) throw new Error(`${FIXTURE}: turn ${index} must cook with no tool calls`)
  }

  const copied = []
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (value) => { copied.push(value); return Promise.resolve() } },
  })

  const mountViewer = (presentation) => mount(React.createElement(TranscriptViewer, {
    viewModel: vm,
    capabilities: CAPABILITIES,
    presentation,
  }))

  for (const row of fixture.cases) {
    if (row.kind === 'classic') {
      const mounted = await mountViewer(undefined)
      const workPanels = mounted.container.querySelectorAll('.txn-work')
      report.check(workPanels.length === 0, `${row.name}: the classic surface must render no work panel, received ${workPanels.length}`)
      const rows = mounted.container.querySelectorAll('#turn-1 .txn-toolcall')
      report.check(rows.length === tools.length, `${row.name}: the classic surface must draw ${tools.length} flat tool rows, received ${rows.length}`)
      report.check(mounted.container.querySelectorAll('.txn-roleico').length === 0, `${row.name}: the classic surface must keep the role label as it was, with no role well`)
      report.check(!!mounted.container.querySelector('#turn-2 .txn-turn .txn-turnhead'), `${row.name}: a system turn keeps its classic card head`)
      report.check(mounted.container.querySelector('#turn-2 .txn-systemrow') === null, `${row.name}: the classic surface must render no system row`)
      await mounted.unmount()
    } else if (row.kind === 'ledger-panel') {
      const mounted = await mountViewer('ledger')
      const workPanels = mounted.container.querySelectorAll('.txn-work')
      report.check(workPanels.length === 1, `${row.name}: exactly one work panel must render for the turn with tools, received ${workPanels.length}`)
      const count = workPanels[0]?.querySelector('.txn-work-count')
      report.check(text(count) === expectedCount, `${row.name}: the count must read ${JSON.stringify(expectedCount)}, received ${JSON.stringify(text(count))}`)
      const meta = workPanels[0]?.querySelector('.txn-work-meta')
      report.check(text(meta) === expectedMeta, `${row.name}: the meta must read ${JSON.stringify(expectedMeta)}, received ${JSON.stringify(text(meta))}`)
      report.check(meta?.classList.contains('tnum'), `${row.name}: the meta figures must be tabular`)
      const rows = workPanels[0]?.querySelectorAll('.txn-work-rows .txn-toolcall') ?? []
      report.check(rows.length === tools.length, `${row.name}: the panel must hold all ${tools.length} tool rows, received ${rows.length}`)
      const article = mounted.container.querySelector('#turn-1.txn-turnwrap-ledger')
      report.check(!!article, `${row.name}: the turn wrapper must carry the ledger turn class`)
      report.check(!!article?.querySelector('.txn-turn.txn-turn-ledger'), `${row.name}: the ledger turn must drop the classic card, keeping the ledger card class`)
      report.check(!!article?.querySelector('.txn-turnhead-ledger .txn-roleico'), `${row.name}: the ledger head must lead with the square role well`)
      report.check(!!article?.querySelector('.txn-rolelabel'), `${row.name}: the ledger head must still name the role`)
      await mounted.unmount()
    } else if (row.kind === 'ledger-disclosure') {
      const mounted = await mountViewer('ledger')
      const panel = mounted.container.querySelector('#turn-1 .txn-work')
      const rowButton = panel?.querySelector('.txn-toolcall .txn-tc-head')
      report.check(!!rowButton, `${row.name}: the panel must draw a tool row`)
      report.check(rowButton?.getAttribute('aria-expanded') === 'false', `${row.name}: a tool row must start collapsed`)
      if (rowButton) await mounted.act(() => click(window, rowButton))
      await mounted.settle()
      const open = panel?.querySelector('.txn-toolcall .txn-tc-head')
      report.check(open?.getAttribute('aria-expanded') === 'true', `${row.name}: the clicked row must stay open`)
      report.check(!!panel?.querySelector('.txn-toolcall .txn-tcbody'), `${row.name}: the clicked row must reveal its body`)
      if (open) await mounted.act(() => click(window, open))
      await mounted.settle()
      const closed = panel?.querySelector('.txn-toolcall .txn-tc-head')
      report.check(closed?.getAttribute('aria-expanded') === 'false', `${row.name}: clicking the open row must collapse it`)
      await mounted.unmount()
    } else if (row.kind === 'system') {
      const mounted = await mountViewer('ledger')
      const rowEl = mounted.container.querySelector('#turn-2 .txn-systemrow')
      report.check(!!rowEl, `${row.name}: the system turn must render a system row`)
      report.check(mounted.container.querySelector('#turn-2 .txn-turn') === null, `${row.name}: the system turn must not also render a classic card`)
      const head = rowEl?.querySelector('.txn-systemrow-head')
      const body = rowEl?.querySelector('.txn-systemrow-body')
      report.check(head?.getAttribute('aria-expanded') === 'false', `${row.name}: the row must start collapsed`)
      report.check(body?.hasAttribute('hidden') === true, `${row.name}: the collapsed row must hide the recorded text`)
      const systemTurn = vm.turns.find((turn) => turn.index === 2)
      const preview = text(rowEl?.querySelector('.txn-systemrow-preview'))
      report.check(preview === text({ textContent: systemTurn?.content }), `${row.name}: the preview must read the recorded text on one line, received ${JSON.stringify(preview)}`)
      report.check(text(rowEl?.querySelector('.txn-systemrow-label')) === 'system', `${row.name}: the row must name the system role`)
      if (head) await mounted.act(() => click(window, head))
      await mounted.settle()
      const expanded = rowEl?.querySelector('.txn-systemrow-head')
      report.check(expanded?.getAttribute('aria-expanded') === 'true', `${row.name}: clicking the row must reveal the recorded text`)
      report.check(rowEl?.querySelector('.txn-systemrow-body')?.hasAttribute('hidden') === false, `${row.name}: clicking the row must reveal the recorded text`)
      const anchor = rowEl?.querySelector('.txn-systemrow-head-row .txn-anchor')
      report.check(!!anchor, `${row.name}: the row must carry the turn's copy-anchor beside the disclosure`)
      report.check(anchor?.getAttribute('aria-label') === 'copy link to turn ' + systemTurn?.label, `${row.name}: the anchor must name the turn it copies`)
      const before = copied.length
      if (anchor) await mounted.act(() => click(window, anchor))
      await mounted.settle()
      report.check(copied.length === before + 1 && copied[before] === '#turn-2', `${row.name}: the anchor must copy the turn link, received ${JSON.stringify(copied.slice(before))}`)
      /* the copied marker clears on a 1.5s timer; let it fire while the mounted window still exists */
      await mounted.settle(1600)
      await mounted.unmount()
    } else if (row.kind === 'thinking') {
      const mounted = await mountViewer('ledger')
      const toggle = mounted.container.querySelector('#turn-4 .txn-thinking-toggle')
      report.check(!!toggle, `${row.name}: a turn with thinking must keep its thinking disclosure`)
      if (toggle) await mounted.act(() => click(window, toggle))
      await mounted.settle()
      const body = mounted.container.querySelector('#turn-4 .txn-thinking-body')
      report.check(/check the fixture/.test(text(body)), `${row.name}: opening the disclosure must reveal the thinking text, received ${JSON.stringify(text(body))}`)
      await mounted.unmount()
    } else if (row.kind === 'no-tools') {
      const mounted = await mountViewer('ledger')
      const total = mounted.container.querySelectorAll('.txn-work').length
      report.check(total === 1, `${row.name}: only the turn with tools carries a panel, received ${total}`)
      for (const index of toolLessTurns) {
        report.check(mounted.container.querySelector(`#turn-${index} .txn-work`) === null, `${row.name}: the tool-less turn ${index} must render no panel`)
      }
      report.check(!!mounted.container.querySelector('#turn-1 .txn-work'), `${row.name}: the turn with tools keeps its panel`)
      await mounted.unmount()
    } else {
      throw new Error(`${FIXTURE}: unknown case kind ${JSON.stringify(row.kind)}`)
    }
  }
})

report.finish(`${fixture.summaryCases.length} summary rows and ${fixture.cases.length} mounted cases.`)

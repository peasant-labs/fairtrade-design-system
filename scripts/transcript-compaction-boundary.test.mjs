#!/usr/bin/env node
/* Mounted-source gate for the producer's context-compaction boundary. It checks the pure
   notice parser, cooks the REAL adapter, and mounts the REAL TranscriptViewer through vite:
   the canonical notices become their own boundary row at the recorded position, with a
   trigger, a pre/post or one-sided token delta, and a duration when recorded; the recorded
   notice stays behind a focusable disclosure; and an ordinary system message, an
   unrecognized tail, or a control record is never reclassified.
   Cases: scripts/testdata/transcript-compaction-boundary.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-compaction-boundary;
   mutations: node scripts/parts-mutations.mjs scripts/transcript-compaction-boundary.test.mjs
   scripts/testdata/transcript-compaction-boundary.manifest.yaml */
import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-compaction-boundary.yaml'
const MANIFEST = 'scripts/testdata/transcript-compaction-boundary.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, {
  parserCases: 'requiredParserNames',
  cases: 'requiredCaseNames',
})
const report = createReport('transcript compaction boundaries')

const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }
const TOOL_GROUPS = ['edits', 'bash', 'read', 'search', 'fetch', 'tasks', 'other']
const SYSTEM_ON = {
  categories: { prompts: true, responses: true, thinking: true, toolcalls: true, system: true },
  toolGroups: Object.fromEntries(TOOL_GROUPS.map((id) => [id, true])),
  tags: { errors: false, retries: false, revert: false },
  views: { hidden: true, expandAll: false, compact: false },
  checkpoint: 'all',
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()

/** The descriptor fields in one stable order so the fixture can compare the whole shape. */
const shape = (notice) => notice === undefined ? null : {
  label: notice.label,
  ...(notice.trigger !== undefined ? { trigger: notice.trigger } : {}),
  ...(notice.preTokens !== undefined ? { preTokens: notice.preTokens } : {}),
  ...(notice.postTokens !== undefined ? { postTokens: notice.postTokens } : {}),
  ...(notice.durationMs !== undefined ? { durationMs: notice.durationMs } : {}),
  text: notice.text,
}

await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const { parseCompactionNotice } = await load('/src/ui/transcript/compaction.js')

  const cook = (row) => adaptTranscript({
    ...fixture.payload,
    ...(row.harness ? { harness: row.harness } : {}),
    ...(row.turns ? { turns: row.turns, turnCount: row.turns.length } : {}),
  })
  const viewer = (vm) => mount(React.createElement(TranscriptViewer, {
    viewModel: vm,
    capabilities: CAPABILITIES,
    presentation: 'ledger',
    filters: SYSTEM_ON,
  }))
  const article = (container, index) => container.querySelector(`article[data-turn="${index}"]`)

  /* ── the pure parser ─────────────────────────────────────────────────────── */
  for (const row of fixture.parserCases) {
    const actual = shape(parseCompactionNotice(row.input))
    report.check(same(actual, row.expected), `${row.name}: expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
  }

  for (const row of fixture.cases) {
    const name = row.name
    if (row.kind === 'descriptor' || row.kind === 'not-compaction' || row.kind === 'control-record') {
      const vm = cook(row)
      const turn = vm.turns.find((entry) => entry.index === row.turn)
      if (row.kind === 'descriptor') {
        const actual = shape(turn?.compaction)
        report.check(same(actual, row.expected), `${name}: turn ${row.turn} compaction must read ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
      } else {
        report.check(turn?.compaction === undefined, `${name}: the recorded text must not cook a compaction boundary, received ${JSON.stringify(turn?.compaction)}`)
        if (row.kind === 'control-record') {
          report.check(turn?.controlKind === row.controlKind && turn?.isControl === true, `${name}: the control record must keep kind ${JSON.stringify(row.controlKind)}, received ${JSON.stringify({ kind: turn?.controlKind, isControl: turn?.isControl })}`)
        }
      }
    } else if (row.kind === 'position') {
      const vm = cook(row)
      const indices = vm.turns.map((turn) => turn.index)
      report.check(same(indices, row.expected), `${name}: cooked turns must keep the recorded order ${JSON.stringify(row.expected)}, received ${JSON.stringify(indices)}`)
      const before = vm.turns.find((turn) => turn.index === row.before)
      const after = vm.turns.find((turn) => turn.index === row.after)
      report.check(before?.role === 'assistant' && after?.role === 'system', `${name}: the boundary must sit between the same neighbouring turns, received ${JSON.stringify([before?.role, after?.role])}`)
    } else if (row.kind === 'group') {
      const mounted = await viewer(cook(row))
      const group = mounted.container.querySelector('.txn-systemgroup')
      const members = [...(group?.querySelectorAll('article[data-turn]') ?? [])].map((entry) => Number(entry.dataset.turn))
      report.check(same(members, row.members), `${name}: the group must hold the same members, expected ${JSON.stringify(row.members)}, received ${JSON.stringify(members)}`)
      report.check(text(group?.querySelector('.txn-systemgroup-summary')) === row.summary, `${name}: the group summary must keep the boundary in the unclassified bucket, expected ${JSON.stringify(row.summary)}, received ${JSON.stringify(text(group?.querySelector('.txn-systemgroup-summary')))}`)
      const chip = group?.querySelector('.txn-systemgroup-chip[data-facet-kind="unclassified"] .txn-systemgroup-chip-count')
      report.check(text(chip) === String(row.unclassified), `${name}: the unclassified facet must count ${row.unclassified}, received ${JSON.stringify(text(chip))}`)
      await mounted.unmount()
    } else if (row.kind === 'mounted') {
      const mounted = await viewer(cook(row))
      const card = article(mounted.container, row.turn)
      report.check(!!card?.querySelector('.txn-compaction'), `${name}: turn ${row.turn} must render a compaction boundary`)
      report.check(!card?.querySelector('.txn-systemrow') && !card?.querySelector('.txn-control-row'), `${name}: a boundary must not also render a system row or a control row`)
      report.check(text(card?.querySelector('.txn-compaction-label')) === row.expected.label, `${name}: the label must read ${JSON.stringify(row.expected.label)}, received ${JSON.stringify(text(card?.querySelector('.txn-compaction-label')))}`)
      const trigger = card?.querySelector('.txn-compaction-trigger')
      if (row.expected.trigger !== undefined) {
        report.check(text(trigger) === `(${row.expected.trigger})`, `${name}: the trigger must print as recorded, expected ${JSON.stringify(`(${row.expected.trigger})`)}, received ${JSON.stringify(text(trigger))}`)
      } else {
        report.check(!trigger, `${name}: a boundary without a trigger must print none`)
      }
      const delta = card?.querySelector('.txn-compaction-delta')
      if (row.expected.noDelta) {
        report.check(!delta, `${name}: a boundary without counts must print no delta`)
      } else if (row.expected.deltaSide) {
        report.check(!!delta && text(delta).includes(`tokens ${row.expected.deltaSide}`), `${name}: the delta must say tokens ${row.expected.deltaSide}, received ${JSON.stringify(text(delta))}`)
        report.check(!card?.querySelector('.txn-compaction-arrow'), `${name}: a one-sided count must not draw an arrow`)
      } else {
        report.check(!!delta && text(delta).includes(row.expected.pre) && text(delta).includes(row.expected.post) && /tokens/.test(text(delta)), `${name}: the token delta must read pre to post, received ${JSON.stringify(text(delta))}`)
        report.check(card?.querySelector('.txn-compaction-delta')?.classList.contains('tnum'), `${name}: the token delta must carry tabular figures`)
        report.check(card?.querySelectorAll('.txn-compaction-count.tnum').length === 2, `${name}: both token counts must carry tabular figures`)
      }
      if (row.expected.duration !== undefined) {
        report.check(text(card?.querySelector('.txn-compaction-duration')) === row.expected.duration, `${name}: the duration must read ${JSON.stringify(row.expected.duration)}, received ${JSON.stringify(text(card?.querySelector('.txn-compaction-duration')))}`)
        report.check(card?.querySelector('.txn-compaction-duration')?.classList.contains('tnum'), `${name}: the duration must carry tabular figures`)
      } else {
        report.check(!card?.querySelector('.txn-compaction-duration'), `${name}: a boundary without a duration must print none`)
      }
      await mounted.unmount()
    } else if (row.kind === 'disclosure') {
      const mounted = await viewer(cook(row))
      const card = article(mounted.container, row.turn)
      const head = card?.querySelector('.txn-compaction-head')
      const body = card?.querySelector('.txn-compaction-body')
      report.check(head?.tagName === 'BUTTON' && head?.tabIndex === 0 && head?.disabled !== true, `${name}: the boundary row must be a focusable button`)
      report.check(head?.getAttribute('aria-expanded') === 'false', `${name}: the boundary must start collapsed, received ${JSON.stringify(head?.getAttribute('aria-expanded'))}`)
      report.check(body?.hidden === true, `${name}: the recorded notice must start hidden`)
      const controls = head?.getAttribute('aria-controls')
      report.check(!!controls && !!mounted.container.querySelector(`[id="${controls}"]`), `${name}: aria-controls must name the mounted body, received ${JSON.stringify(controls)}`)
      const accessible = head?.getAttribute('aria-label') ?? ''
      report.check(accessible.includes('context compacted') && accessible.includes('auto') && accessible.includes('168,104 tokens before') && accessible.includes('24,000 tokens after'), `${name}: the accessible name must state the boundary and both sides, received ${JSON.stringify(accessible)}`)
      await mounted.act(() => click(window, head))
      report.check(head?.getAttribute('aria-expanded') === 'true', `${name}: expanding must set aria-expanded true`)
      report.check(body?.hidden === false, `${name}: expanding must reveal the recorded notice`)
      report.check(text(body) === row.expected, `${name}: the body must show the recorded notice verbatim, expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(text(body))}`)
      await mounted.unmount()
    } else if (row.kind === 'ordinary') {
      const mounted = await viewer(cook(row))
      const card = article(mounted.container, row.turn)
      report.check(!!card?.querySelector('.txn-systemrow'), `${name}: an ordinary system message must keep the system row`)
      report.check(!card?.querySelector('.txn-compaction'), `${name}: an ordinary system message must not render a boundary`)
      await mounted.unmount()
    } else if (row.kind === 'control-row') {
      const mounted = await viewer(cook(row))
      const card = article(mounted.container, row.turn)
      report.check(!!card?.querySelector('.txn-control-row'), `${name}: a producer control record must keep the control row`)
      report.check(!card?.querySelector('.txn-compaction'), `${name}: a producer control record must not render a boundary`)
      report.check(text(card?.querySelector('.txn-control-kind')) === row.controlKind, `${name}: the control kind must stay ${JSON.stringify(row.controlKind)}, received ${JSON.stringify(text(card?.querySelector('.txn-control-kind')))}`)
      await mounted.unmount()
    } else {
      throw new Error(`${FIXTURE}: unknown case kind ${row.kind}`)
    }
  }
})

report.finish(`${fixture.parserCases.length} parser cases and ${fixture.cases.length} cooked and mounted cases over context-compaction boundaries.`)

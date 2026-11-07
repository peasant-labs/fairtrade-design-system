#!/usr/bin/env node
/* Mounted-source gate for system-entry grouping and control rows. It cooks the REAL adapter,
   mounts the REAL TranscriptViewer through vite, and asserts what a reader reaches: the default
   hides system entries; a run of two or more visible system entries folds into one group whose
   owner renders in place and whose closed members are inert; a search hit or an initial position
   can land on a hidden member without writing the reader's filters; a closed group is one
   keyboard stop; and a producer-classified control record renders as a compact row, never a card,
   with its recorded value's case intact.
   Cases: scripts/testdata/transcript-system-groups.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-system-groups;
   mutations: node scripts/parts-mutations.mjs scripts/transcript-system-groups.test.mjs
   scripts/testdata/transcript-system-groups.manifest.yaml */
import { readFileSync } from 'node:fs'
import { ROOT, loadFixturePair, assertExactNames, assertFields, withMountedSource, click, keydown, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-system-groups.yaml'
const MANIFEST = 'scripts/testdata/transcript-system-groups.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  cases: 'requiredCaseNames',
  summaryCases: 'requiredSummaryNames',
})

const report = createReport('transcript system groups')
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

assertExactNames(fixture.cases.map((row) => row.name), manifest.requiredCaseNames, `${FIXTURE} cases`)
for (const row of fixture.cases) assertFields(row, ['name', 'kind'], `${FIXTURE} ${row.name}`, ['groups', 'members', 'expected', 'query', 'turn'])

const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }
const TOOL_GROUPS = ['edits', 'bash', 'read', 'search', 'fetch', 'tasks', 'other']
const filtersWith = (overrides = {}) => ({
  categories: { prompts: true, responses: true, thinking: true, toolcalls: true, system: true, ...(overrides.categories ?? {}) },
  toolGroups: Object.fromEntries(TOOL_GROUPS.map((id) => [id, true])),
  tags: { errors: false, retries: false, revert: false },
  views: { hidden: true, expandAll: false, compact: false },
  checkpoint: 'all',
})
const SYSTEM_ON = filtersWith()

let css = readFileSync(`${ROOT}/src/index.css`, 'utf8')
const mutation = process.env.FAIRTRADE_PARTS_MUTATION ? JSON.parse(process.env.FAIRTRADE_PARTS_MUTATION) : null
if (mutation?.file === 'src/index.css') {
  if (css.split(mutation.find).length !== 2) throw new Error('the CSS mutation must match exactly once')
  css = css.replace(mutation.find, mutation.replace)
}

await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const { systemGroupSummary } = await load('/src/ui/transcript/system-summary.js')
  const { systemGroups } = await load('/src/ui/transcript/system-groups.js')

  const vm = adaptTranscript(fixture.payload)
  const unclassified = adaptTranscript(fixture.unclassifiedPayload)
  const systemOnly = adaptTranscript(fixture.systemOnlyPayload)

  /* ── the pure summary ────────────────────────────────────────────────────── */
  for (const row of fixture.summaryCases) {
    const members = row.kinds.map((kind) => ({ controlKind: kind }))
    const actual = systemGroupSummary(members)
    report.check(actual === row.expected, `${row.name}: summary must read ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
    if (row.name !== 'summary_plus_more') {
      for (const kind of row.kinds) {
        report.check(actual.includes(kind), `${row.name}: summary must keep the recorded kind ${JSON.stringify(kind)} verbatim, received ${JSON.stringify(actual)}`)
      }
    }
  }

  /* ── mounted helpers ─────────────────────────────────────────────────────── */
  async function mountCase(viewModel, { filters = SYSTEM_ON, controlled = true, ...props } = {}) {
    if (!controlled) {
      return mount(React.createElement(TranscriptViewer, { viewModel, capabilities: CAPABILITIES, presentation: 'ledger', ...props }))
    }
    const changes = []
    function Harness() {
      const [state, setState] = React.useState(filters)
      return React.createElement(TranscriptViewer, {
        viewModel,
        capabilities: CAPABILITIES,
        presentation: 'ledger',
        filters: state,
        onFiltersChange: (next) => { changes.push(next); setState(next) },
        ...props,
      })
    }
    const mounted = await mount(React.createElement(Harness))
    mounted.changes = changes
    return mounted
  }
  const article = (container, index) => container.querySelector(`#turn-${index}`)
  const inGroup = (container, index) => article(container, index)?.closest('.txn-systemgroup') ?? null
  const groupHead = (container) => container.querySelector('.txn-systemgroup-head')
  const isInert = (node) => !!node?.closest('[inert]')

  for (const row of fixture.cases) {
    const name = row.name
    if (row.kind === 'classification') {
      const mounted = await mountCase(vm)
      const rows = [...mounted.container.querySelectorAll('.txn-control-row')]
      report.check(rows.length === 4, `${name}: expected four control rows (the group and the singleton), received ${rows.length}`)
      const kinds = [...mounted.container.querySelectorAll('.txn-control-kind')].map(text)
      report.check(same(kinds, ['mode', 'permission-mode', 'custom-title', 'agent-name']), `${name}: control kinds must be recorded verbatim, received ${JSON.stringify(kinds)}`)
      for (const index of [1, 2, 3]) report.check(!!article(mounted.container, index)?.querySelector('.txn-control-row'), `${name}: turn ${index} must render a control row`)
      report.check(!article(mounted.container, 1)?.querySelector('.txn-turn.txn-turn-ledger'), `${name}: a control row must not also render a card`)
      await mounted.unmount()
    } else if (row.kind === 'system-row') {
      const mounted = await mountCase(vm)
      report.check(!!article(mounted.container, 5)?.querySelector('.txn-systemrow'), `${name}: an unclassified system turn must render a system row`)
      report.check(!article(mounted.container, 5)?.querySelector('.txn-control-row'), `${name}: an unclassified system turn must not render a control row`)
      await mounted.unmount()
    } else if (row.kind === 'downgrade') {
      report.check(unclassified.turns.every((turn) => turn.isControl !== true && turn.controlKind === undefined), `${name}: a payload without controlKind must classify nothing as a control record`)
      const mounted = await mountCase(unclassified)
      report.check(mounted.container.querySelectorAll('.txn-control-row').length === 0, `${name}: no control row may render without a producer kind`)
      report.check(mounted.container.querySelectorAll('.txn-systemrow').length === 1, `${name}: the unclassified system turn must render an ordinary system row`)
      await mounted.unmount()
    } else if (row.kind === 'group-count') {
      const mounted = await mountCase(vm)
      const groups = mounted.container.querySelectorAll('.txn-systemgroup')
      report.check(groups.length === row.groups, `${name}: expected ${row.groups} group, received ${groups.length}`)
      report.check(groups[0]?.querySelectorAll('.txn-systemgroup-rows article[data-turn]').length === row.members - 1, `${name}: expected ${row.members - 1} folded members beside the owner, received ${groups[0]?.querySelectorAll('.txn-systemgroup-rows article[data-turn]').length}`)
      await mounted.unmount()
    } else if (row.kind === 'singleton') {
      const mounted = await mountCase(vm)
      report.check(!inGroup(mounted.container, 5), `${name}: a run of one must not be grouped`)
      report.check(!inGroup(mounted.container, 7), `${name}: another singleton must not be grouped`)
      await mounted.unmount()
    } else if (row.kind === 'split') {
      const mounted = await mountCase(vm)
      report.check(mounted.container.querySelectorAll('.txn-systemgroup').length === 1, `${name}: a prose turn between runs must leave two separate runs, only one of which folds`)
      report.check(!!inGroup(mounted.container, 1) && !inGroup(mounted.container, 5), `${name}: the run before the prose turn is grouped and the singleton after is not`)
      await mounted.unmount()
    } else if (row.kind === 'hidden-merge') {
      /* A hidden separator no longer splits a run: grouping reads the VISIBLE set, so hiding the
         assistant turn joins the two system runs into one group. Grouping over every turn would
         keep them apart and fail here. */
      const mounted = await mountCase(vm, { filters: filtersWith({ categories: { responses: false } }) })
      const groups = mounted.container.querySelectorAll('.txn-systemgroup')
      report.check(groups.length === 1, `${name}: the hidden separator must leave one run, received ${groups.length} groups`)
      report.check(!!inGroup(mounted.container, 5), `${name}: the second run must join the group once the separator is hidden`)
      await mounted.unmount()
    } else if (row.kind === 'owner') {
      const mounted = await mountCase(vm)
      const owner = article(mounted.container, 1)
      const head = groupHead(mounted.container)
      report.check(owner?.parentElement?.classList.contains('txn-systemgroup'), `${name}: the owner must render in place directly under the group`)
      report.check(head?.nextElementSibling === owner, `${name}: the group head must sit immediately above the owner`)
      /* each member is mounted exactly once, inside its group */
      for (const index of [1, 2, 3]) {
        report.check(mounted.container.querySelectorAll(`article[data-turn="${index}"]`).length === 1, `${name}: turn ${index} must mount exactly once`)
      }
      await mounted.unmount()
    } else if (row.kind === 'inert') {
      const mounted = await mountCase(vm)
      for (const index of [2, 3]) {
        report.check(isInert(article(mounted.container, index)), `${name}: a closed group's member ${index} must be inert`)
      }
      report.check(!isInert(article(mounted.container, 1)), `${name}: the owner is never inert`)
      await mounted.unmount()
    } else if (row.kind === 'mounted-summary') {
      const mounted = await mountCase(vm)
      const head = text(mounted.container.querySelector('.txn-systemgroup-summary'))
      report.check(head === row.expected, `${name}: the group head must read ${JSON.stringify(row.expected)}, received ${JSON.stringify(head)}`)
      await mounted.unmount()
    } else if (row.kind === 'search-reveal') {
      const mounted = await mountCase(vm, { filters: filtersWith({ categories: { system: false } }), search: row.query, showSearchTrigger: true })
      report.check(!article(mounted.container, row.turn), `${name}: the system turn must be absent before the reveal`)
      const trigger = mounted.container.querySelector('.txn-search-trigger')
      report.check(!!trigger, `${name}: the viewer must offer the search trigger`)
      if (trigger) await mounted.act(() => click(window, trigger))
      await mounted.settle()
      report.check(!!article(mounted.container, row.turn), `${name}: the search hit must reveal the hidden system turn`)
      report.check(mounted.changes.length === 0, `${name}: the reveal must not write the reader's filters, received ${mounted.changes.length} changes`)
      const checkbox = [...mounted.container.querySelectorAll('.txn-catlist .txn-checkrow')].find((el) => text(el.querySelector('.txn-cr-label')) === 'system')?.querySelector('input[type="checkbox"]')
      report.check(checkbox?.checked === false, `${name}: the system category must stay unchecked after the reveal`)
      await mounted.unmount()
    } else if (row.kind === 'member-landing' || row.kind === 'initial-position') {
      const mounted = await mountCase(vm, { initialPosition: { kind: 'turn', turnIndex: row.turn } })
      await mounted.settle()
      const head = groupHead(mounted.container)
      report.check(head?.getAttribute('aria-expanded') === 'true', `${name}: landing on a grouped member must open its group`)
      report.check(!isInert(article(mounted.container, row.turn)), `${name}: the landed member must not stay inert`)
      await mounted.unmount()
    } else if (row.kind === 'keyboard') {
      const selections = []
      function KeyboardHarness() {
        const [filters, setFilters] = React.useState(SYSTEM_ON)
        const [active, setActive] = React.useState(0)
        return React.createElement(TranscriptViewer, {
          viewModel: vm,
          capabilities: CAPABILITIES,
          presentation: 'ledger',
          filters,
          onFiltersChange: setFilters,
          activeTurn: active,
          onActiveTurnChange: (index) => { selections.push(index); setActive(index) },
        })
      }
      const mounted = await mount(React.createElement(KeyboardHarness))
      const press = (key) => mounted.act(() => keydown(window, mounted.container.querySelector('.txn-stream'), key))
      await press('j')
      await press('j')
      report.check(same(selections, [1, 4]), `${name}: a closed group is one stop, so the steps must be 1 then 4, received ${JSON.stringify(selections)}`)
      /* opening the group adds its members to the same list */
      await mounted.act(() => click(window, groupHead(mounted.container)))
      await mounted.settle()
      await press('k')
      report.check(selections[selections.length - 1] === 3, `${name}: opening the group must add member 3 as the next stop, received ${JSON.stringify(selections)}`)
      await mounted.unmount()
    } else if (row.kind === 'control-css') {
      const headRule = css.match(/\.txn-control-head\s*\{[^}]*\}/)?.[0] ?? ''
      report.check(/background:\s*transparent/.test(headRule), `${name}: a control head must draw no ground`)
      report.check(/border:\s*0/.test(headRule), `${name}: a control head must draw no border`)
      report.check(!/\.txn-control-(row|head|head-row|value|kind|time)\s*\{[^}]*border-radius/.test(css), `${name}: the control row family must not draw a radius`)
      const mounted = await mountCase(vm)
      report.check(article(mounted.container, 1)?.querySelector('.txn-control-time')?.classList.contains('tnum'), `${name}: the control time must carry tabular figures`)
      await mounted.unmount()
    } else if (row.kind === 'control-case') {
      const payload = {
        id: 'control-case',
        harness: 'claude-code',
        turns: [{ index: 0, role: 'system', content: 'Permission Mode: Auto', controlKind: 'permission-mode', depth: 0 }],
      }
      const mounted = await mountCase(adaptTranscript(payload))
      const value = text(mounted.container.querySelector('.txn-control-value'))
      report.check(value === 'Permission Mode: Auto', `${name}: the recorded value must keep its case, received ${JSON.stringify(value)}`)
      report.check(/\.txn-control-value\s*\{[^}]*text-transform:\s*none/.test(css), `${name}: the value must opt out of any lowercase chrome transform`)
      await mounted.unmount()
    } else if (row.kind === 'control-line') {
      const payload = {
        id: 'control-line',
        harness: 'claude-code',
        turns: [
          { index: 0, role: 'system', content: 'x'.repeat(160), controlKind: 'mode', depth: 0 },
          { index: 1, role: 'system', content: 'x'.repeat(161), controlKind: 'mode', depth: 0 },
          { index: 2, role: 'system', content: 'first line\nsecond line', controlKind: 'mode', depth: 0 },
        ],
      }
      const mounted = await mountCase(adaptTranscript(payload))
      const rowOf = (index) => article(mounted.container, index)?.querySelector('.txn-control-row')
      report.check(!rowOf(0)?.querySelector('.txn-control-head'), `${name}: a 160-character value must read as one line with no disclosure`)
      report.check(!!rowOf(1)?.querySelector('.txn-control-head[aria-expanded="false"]'), `${name}: a 161-character value must disclose`)
      report.check(!!rowOf(2)?.querySelector('.txn-control-head'), `${name}: a multi-line value must disclose`)
      await mounted.unmount()
    } else if (row.kind === 'empty-state') {
      const mounted = await mountCase(systemOnly, { controlled: false })
      const empty = mounted.container.querySelector('.empty')
      report.check(!!empty && text(empty).includes('2 system entries are hidden by the system filter.'), `${name}: the empty state must name how many system entries are hidden, received ${JSON.stringify(text(empty))}`)
      const button = mounted.container.querySelector('.txn-empty-show-system')
      report.check(!!button && !button.closest('[hidden]'), `${name}: the empty state must offer a visible reveal control`)
      report.check(text(button) === 'show system entries', `${name}: the reveal control must name what it shows`)
      if (button) await mounted.act(() => click(window, button))
      await mounted.settle()
      report.check(mounted.container.querySelectorAll('.txn-systemgroup, .txn-systemrow, .txn-control-row').length > 0, `${name}: the control must reveal the hidden records`)
      await mounted.unmount()
    } else if (row.kind === 'empty-no-affordance') {
      const payload = { id: 'empty-no-system', harness: 'claude-code', turns: [{ index: 0, role: 'user', content: 'the only turn', depth: 0 }] }
      const mounted = await mountCase(adaptTranscript(payload), { filters: filtersWith({ categories: { prompts: false } }) })
      const empty = mounted.container.querySelector('.empty')
      report.check(!!empty, `${name}: the reading pane must be empty`)
      report.check(!mounted.container.querySelector('.txn-empty-show-system'), `${name}: nothing hidden means no reveal control`)
      report.check(text(empty).includes('every turn is filtered out.'), `${name}: the generic empty sentence must remain`, )
      await mounted.unmount()
    } else {
      throw new Error(`${FIXTURE}: unknown case kind ${row.kind}`)
    }
  }

  /* the pure grouping, independent of a mount: the run shapes the fixture declares */
  const cooked = vm.turns
  const grouped = systemGroups(cooked)
  report.check(grouped.get(1)?.members.length === 3 && grouped.get(2)?.owner.index === 1, 'systemGroups: a run of three is one group owned by its first member')
  report.check(!grouped.has(5) && !grouped.has(7), 'systemGroups: a singleton is not a group')
})

report.finish(`${fixture.cases.length} mounted cases and ${fixture.summaryCases.length} summary cases over system-entry grouping.`)

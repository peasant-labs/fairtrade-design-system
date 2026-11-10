#!/usr/bin/env node
/* Gate for the per-kind facet on a system-entry group head.

   The regression this locks down: a run of system entries is several kinds of harness
   bookkeeping at once, so a reader who wants one kind (mode, permission-mode, a compaction
   notice) has only the all-or-nothing system category. The facet answers that inside the
   group, and this gate asserts what a reader reaches:
     • the kinds are DERIVED from the group's own members, never a hard-coded vocabulary,
       and a member the producer did not classify is reachable through the unclassified bucket;
     • the group owner always renders; only the folded members 2..N follow the facet;
     • counts are computed before the facet's own selection, so narrowing never zeroes a
       sibling;
     • the facet controls are NOT nested inside the disclosure button, so both are separately
       reachable, and each chip is a keyboard-reachable pressed-state toggle;
     • the selection is ephemeral: it never writes the reader's filters and a new session
       starts unfiltered.
   Cases: scripts/testdata/system-group-facet.yaml (+ .manifest.yaml).
   Run: pnpm test:system-group-facet */
import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/system-group-facet.yaml'
const MANIFEST = 'scripts/testdata/system-group-facet.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, {
  cases: 'requiredCaseNames',
  mountedCases: 'requiredMountedCaseNames',
})

const report = createReport('system group facet')
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const asMember = (kind) => (kind == null ? {} : { controlKind: kind })
const asKey = (kind) => (kind == null ? 'unclassified' : kind)

const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }
const TOOL_GROUPS = ['edits', 'bash', 'read', 'search', 'fetch', 'tasks', 'other']
const SYSTEM_ON = {
  categories: { prompts: true, responses: true, thinking: true, toolcalls: true, system: true },
  toolGroups: Object.fromEntries(TOOL_GROUPS.map((id) => [id, true])),
  tags: { errors: false, retries: false, revert: false },
  views: { hidden: true, expandAll: false, compact: false },
  checkpoint: 'all',
}

await withMountedSource(async ({ load, mount, window, React }) => {
  const facet = await load('/src/ui/transcript/system-group-facet.js')
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')

  const vm = adaptTranscript(fixture.payload)
  const singleKind = adaptTranscript(fixture.singleKindPayload)
  const other = adaptTranscript(fixture.otherPayload)

  /* ── the pure helpers ────────────────────────────────────────────────────── */
  for (const row of fixture.cases) {
    if (row.kind === 'kinds') {
      const kinds = facet.systemGroupFacetKinds(row.members.map(asMember))
      report.check(same(kinds, row.expected), `${row.name}: expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(kinds)}`)
    } else if (row.kind === 'unclassified') {
      report.check(facet.systemGroupFacetKey({}) === 'unclassified', `${row.name}: an unclassified member must fall into the unclassified bucket`)
      report.check(facet.systemGroupFacetKey({ controlKind: '   ' }) === 'unclassified', `${row.name}: a blank producer kind must not become a bucket of its own`)
      report.check(facet.systemGroupFacetKey({ controlKind: 'mode' }) === 'mode', `${row.name}: a recorded kind must be its own bucket`)
      const kinds = facet.systemGroupFacetKinds([{}, { controlKind: 'mode' }])
      report.check(kinds.find((kind) => kind.id === 'unclassified')?.label === 'unclassified', `${row.name}: the bucket reads "unclassified"`)
    } else if (row.kind === 'counts') {
      const kinds = facet.systemGroupFacetKinds(row.members.map(asMember))
      const filtered = facet.filterSystemGroupMembers(row.members.map(asMember), row.selection)
      report.check(filtered.length === row.members.length - 1, `${row.name}: one kind off must filter exactly one member, received ${filtered.length}`)
      report.check(same(kinds, row.expected), `${row.name}: the kinds list must be computed before the selection; expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(kinds)}`)
    } else if (row.kind === 'toggle') {
      const next = facet.toggleSystemGroupFacet(row.selection, row.id)
      report.check(same(next, row.expected), `${row.name}: expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(next)}`)
    } else if (row.kind === 'filter') {
      const kept = facet.filterSystemGroupMembers(row.members.map(asMember), row.selection ?? {}).map((member) => facet.systemGroupFacetKey(member))
      report.check(same(kept, row.expected.map(asKey)), `${row.name}: expected ${JSON.stringify(row.expected.map(asKey))}, received ${JSON.stringify(kept)}`)
    } else {
      throw new Error(`${FIXTURE}: unknown case kind ${row.kind}`)
    }
  }

  /* ── the mounted facet ───────────────────────────────────────────────────── */
  function Harness({ viewModel }) {
    const [filters, setFilters] = React.useState(SYSTEM_ON)
    return React.createElement(TranscriptViewer, {
      viewModel,
      capabilities: CAPABILITIES,
      presentation: 'ledger',
      filters,
      onFiltersChange: (next) => { Harness.changes.push(next); setFilters(next) },
    })
  }
  Harness.changes = []

  const article = (container, index) => container.querySelector(`#turn-${index}`)
  const chips = (container) => [...container.querySelectorAll('.txn-systemgroup-chip')]
  const chipFor = (container, id) => container.querySelector(`.txn-systemgroup-chip[data-facet-kind="${id}"]`)
  const groupHead = (container) => container.querySelector('.txn-systemgroup-head')

  for (const row of fixture.mountedCases) {
    const name = row.name
    if (row.kind === 'facet_offers_present_kinds') {
      const mounted = await mount(React.createElement(Harness, { viewModel: vm }))
      const labels = chips(mounted.container).map((chip) => text(chip.querySelector('.txn-systemgroup-chip-label')))
      report.check(same(labels, row.expected), `${name}: expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(labels)}`)
      const counts = chips(mounted.container).map((chip) => text(chip.querySelector('.txn-systemgroup-chip-count')))
      report.check(counts.every((count) => count === '1'), `${name}: every present kind holds one member here, received ${JSON.stringify(counts)}`)
      report.check(chips(mounted.container).every((chip) => chip.getAttribute('aria-pressed') === 'true'), `${name}: a group starts showing every kind`)
      await mounted.unmount()
    } else if (row.kind === 'owner_always_renders') {
      const mounted = await mount(React.createElement(Harness, { viewModel: vm }))
      for (const chip of chips(mounted.container)) await mounted.act(() => click(window, chip))
      await mounted.settle()
      report.check(!!article(mounted.container, 1), `${name}: the group owner must render even when every kind is filtered out`)
      for (const index of [2, 3, 4]) report.check(!article(mounted.container, index), `${name}: folded member ${index} must leave the fold when its kind is off`)
      report.check(!!mounted.container.querySelector('.txn-systemgroup-owner article[data-turn="1"]'), `${name}: the owner must keep its in-place slot`)
      await mounted.unmount()
    } else if (row.kind === 'folded_members_filter') {
      const mounted = await mount(React.createElement(Harness, { viewModel: vm }))
      await mounted.act(() => click(window, chipFor(mounted.container, 'permission-mode')))
      await mounted.settle()
      report.check(!article(mounted.container, 2), `${name}: the permission-mode member must leave the fold`)
      for (const index of [1, 3, 4]) report.check(!!article(mounted.container, index), `${name}: member ${index} must stay in the fold`)
      await mounted.unmount()
    } else if (row.kind === 'counts_ignore_facet_selection') {
      const mounted = await mount(React.createElement(Harness, { viewModel: vm }))
      const before = chips(mounted.container).map((chip) => text(chip.querySelector('.txn-systemgroup-chip-count')))
      await mounted.act(() => click(window, chipFor(mounted.container, 'permission-mode')))
      await mounted.settle()
      const after = chips(mounted.container).map((chip) => text(chip.querySelector('.txn-systemgroup-chip-count')))
      report.check(same(after, before), `${name}: the sibling counts must not collapse when one kind is off; expected ${JSON.stringify(before)}, received ${JSON.stringify(after)}`)
      report.check(chips(mounted.container).length === before.length, `${name}: filtering a kind must not remove its chip`)
      await mounted.unmount()
    } else if (row.kind === 'facet_controls_not_nested_in_disclosure') {
      const mounted = await mount(React.createElement(Harness, { viewModel: vm }))
      const head = groupHead(mounted.container)
      const facetGroup = mounted.container.querySelector('.txn-systemgroup-facet')
      report.check(!!facetGroup, `${name}: the group must offer a facet`)
      report.check(!head?.contains(facetGroup), `${name}: the facet must not live inside the disclosure button`)
      report.check(facetGroup?.closest('button') === null, `${name}: a button inside a button is not a reachable control`)
      report.check(head?.querySelectorAll('button').length === 0, `${name}: the disclosure button must contain no nested control`)
      report.check(chips(mounted.container).every((chip) => chip.tagName === 'BUTTON'), `${name}: every facet control must be its own button`)
      await mounted.unmount()
    } else if (row.kind === 'selection_never_writes_filters') {
      Harness.changes.length = 0
      const mounted = await mount(React.createElement(Harness, { viewModel: vm }))
      await mounted.act(() => click(window, chipFor(mounted.container, 'mode')))
      await mounted.settle()
      report.check(Harness.changes.length === 0, `${name}: an ephemeral facet must not write onFiltersChange, received ${Harness.changes.length} changes`)
      report.check(chipFor(mounted.container, 'mode')?.getAttribute('aria-pressed') === 'false', `${name}: the chip must report the filtered state`)
      await mounted.unmount()
    } else if (row.kind === 'selection_resets_on_session_change') {
      const mounted = await mount(React.createElement(Harness, { viewModel: vm }))
      await mounted.act(() => click(window, chipFor(mounted.container, 'mode')))
      await mounted.settle()
      report.check(chipFor(mounted.container, 'mode')?.getAttribute('aria-pressed') === 'false', `${name}: the first session must hold the narrowed facet`)
      await mounted.rerender(React.createElement(Harness, { viewModel: other }))
      await mounted.settle()
      report.check(chips(mounted.container).length > 0, `${name}: the next session must still offer its facet`)
      report.check(chips(mounted.container).every((chip) => chip.getAttribute('aria-pressed') === 'true'), `${name}: a new session must start unfiltered`)
      await mounted.unmount()
    } else if (row.kind === 'single_kind_group_offers_no_facet') {
      const mounted = await mount(React.createElement(Harness, { viewModel: singleKind }))
      report.check(!!groupHead(mounted.container), `${name}: a run of system entries must still group`)
      report.check(!mounted.container.querySelector('.txn-systemgroup-facet'), `${name}: one kind is not a choice, so no facet renders`)
      await mounted.unmount()
    } else if (row.kind === 'facet_keyboard_and_aria') {
      const mounted = await mount(React.createElement(Harness, { viewModel: vm }))
      const facetGroup = mounted.container.querySelector('.txn-systemgroup-facet')
      report.check(facetGroup?.getAttribute('role') === 'group', `${name}: the facet must be a named group`)
      report.check(facetGroup?.getAttribute('aria-label') === 'system entry kinds', `${name}: the group must name what it filters`)
      for (const chip of chips(mounted.container)) {
        report.check(chip.tagName === 'BUTTON' && chip.getAttribute('type') === 'button', `${name}: a chip must be a real button`)
        report.check(chip.disabled !== true, `${name}: a chip with a count must stay reachable`)
        report.check(chip.getAttribute('aria-pressed') != null, `${name}: a chip must report its pressed state`)
        report.check(chip.getAttribute('tabindex') !== '-1', `${name}: a chip must stay in the tab order`)
      }
      await mounted.unmount()
    } else {
      throw new Error(`${FIXTURE}: unknown mounted case kind ${row.kind}`)
    }
  }
})

report.finish(`${fixture.cases.length} pure cases and ${fixture.mountedCases.length} mounted cases over the system-group facet.`)

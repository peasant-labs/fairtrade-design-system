#!/usr/bin/env node
/* Mounted-source gate for system-entry grouping and control rows. It cooks the REAL adapter,
   mounts the REAL TranscriptViewer through vite, and asserts what a reader reaches: the default
   hides system entries; a run of two or more visible system entries folds into one group whose
   owner renders in place, at the same inset as its folded siblings, and whose closed members are
   inert; a search hit or an initial position can land on a hidden member without writing the
   reader's filters; a closed group is one keyboard stop; a producer-classified control record
   renders as a compact row, never a card, with its recorded value's case intact and the leading
   phrase that repeats its kind dropped; the "user turns" navigator lists conversation turns only;
   and every turn count reports conversation turns, while the system filter still reveals the
   entries.
   Cases: scripts/testdata/transcript-system-groups.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-system-groups;
   mutations: node scripts/parts-mutations.mjs scripts/transcript-system-groups.test.mjs
   scripts/testdata/transcript-system-groups.manifest.yaml */
import { readFileSync } from 'node:fs'
import { isConversationTurn } from '@peasant-labs/schema'
import { ROOT, loadFixturePair, assertExactNames, assertFields, withMountedSource, click, keydown, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-system-groups.yaml'
const MANIFEST = 'scripts/testdata/transcript-system-groups.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  cases: 'requiredCaseNames',
  summaryCases: 'requiredSummaryNames',
  controlValueCases: 'requiredControlValueNames',
})

const report = createReport('transcript system groups')
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

assertExactNames(fixture.cases.map((row) => row.name), manifest.requiredCaseNames, `${FIXTURE} cases`)
for (const row of fixture.cases) assertFields(row, ['name', 'kind'], `${FIXTURE} ${row.name}`, ['groups', 'members', 'expected', 'query', 'turn', 'count'])
assertExactNames(fixture.controlValueCases.map((row) => row.name), manifest.requiredControlValueNames, `${FIXTURE} control values`)
for (const row of fixture.controlValueCases) assertFields(row, ['name', 'kind', 'value', 'expected'], `${FIXTURE} ${row.name}`)

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

/* jsdom performs no layout, so an offset is read from the declarations that apply to each
   box: the inline-start insets a row sits behind between its group and itself. Two rows in
   the same column produce the same list; a row that loses (or gains) an inset does not.
   Comments are stripped first: one written between rules would otherwise lead the next
   rule's selector list. */
const rulesCss = css.replace(/\/\*[\s\S]*?\*\//g, '')
function inlineStartDeclarations(element) {
  const selectorsFor = [...element.classList].map((name) => `.${name}`)
  const declarations = []
  for (const rule of rulesCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = rule[1].split(',').map((selector) => selector.trim())
    if (!selectors.some((selector) => selectorsFor.includes(selector))) continue
    const declared = rule[2].match(/(?:^|;)\s*padding-inline-start\s*:\s*([^;]+)/)
    if (declared) declarations.push(declared[1].trim())
  }
  return declarations
}
function inlineStartPath(element, stopAt) {
  const path = []
  for (let node = element; node && node !== stopAt; node = node.parentElement) path.push(...inlineStartDeclarations(node))
  return path
}

await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const { systemGroupSummary } = await load('/src/ui/transcript/system-summary.js')
  const { systemGroups } = await load('/src/ui/transcript/system-groups.js')
  const { controlValueRemainder } = await load('/src/ui/transcript/control-value.js')

  const vm = adaptTranscript(fixture.payload)
  const unclassified = adaptTranscript(fixture.unclassifiedPayload)
  const systemOnly = adaptTranscript(fixture.systemOnlyPayload)
  const singleSystemOnly = adaptTranscript(fixture.singleSystemOnlyPayload)
  const leadingControl = adaptTranscript(fixture.leadingControlPayload)

  /* jsdom has no layout, so give every recorded turn a distinct position in its
     stream and record each scroll request. A landing that targets the wrong turn
     then reads as a different number instead of a silent 0. */
  Object.defineProperty(window.HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get() { return this.dataset.turn == null ? 0 : Number(this.dataset.turn) * 100 + 12 },
  })
  const scrolls = []
  window.HTMLElement.prototype.scrollTo = function (options) {
    if (options?.top != null) {
      this.scrollTop = options.top
      scrolls.push(options.top)
    }
  }

  /* ── the pure summary ────────────────────────────────────────────────────── */
  for (const row of fixture.summaryCases) {
    const members = row.kinds.map((kind) => ({ controlKind: kind }))
    const actual = systemGroupSummary(members)
    report.check(actual === row.expected, `${row.name}: summary must read ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
    if (row.name !== 'summary_plus_more') {
      for (const kind of row.kinds) {
        if (kind == null) continue
        report.check(actual.includes(kind), `${row.name}: summary must keep the recorded kind ${JSON.stringify(kind)} verbatim, received ${JSON.stringify(actual)}`)
      }
    }
  }

  /* ── the pure control value ──────────────────────────────────────────────── */
  for (const row of fixture.controlValueCases) {
    const actual = controlValueRemainder(row.kind, row.value)
    report.check(actual === row.expected, `${row.name}: expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
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
      const ownerBox = owner?.parentElement
      const head = groupHead(mounted.container)
      report.check(ownerBox?.classList.contains('txn-systemgroup-owner'), `${name}: the owner must render in place in the group's inset column`)
      report.check(ownerBox?.parentElement?.classList.contains('txn-systemgroup'), `${name}: the owner's inset box must sit directly under the group`)
      report.check(head?.closest('.txn-systemgroup-headrow')?.nextElementSibling === ownerBox, `${name}: the group head must sit immediately above the owner`)
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
      /* the ratified group noun is user-facing copy: a change back to "system records" must fail here */
      const label = text(mounted.container.querySelector('.txn-systemgroup-label'))
      report.check(label === 'system entries', `${name}: the group noun must be "system entries", received ${JSON.stringify(label)}`)
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
      scrolls.length = 0
      const mounted = await mountCase(vm, { initialPosition: { kind: 'turn', turnIndex: row.turn } })
      await mounted.settle(20)
      const head = groupHead(mounted.container)
      report.check(head?.getAttribute('aria-expanded') === 'true', `${name}: landing on a grouped member must open its group`)
      const landed = article(mounted.container, row.turn)
      report.check(!!landed && !isInert(landed), `${name}: the landed member must be mounted and not inert`)
      /* the owner is the run's first member and sits directly under the head; the
         landed article must be the member the position named, never the owner. */
      const ownerRow = head?.closest('.txn-systemgroup-headrow')?.nextElementSibling?.querySelector('article[data-turn]')
      report.check(!!ownerRow && ownerRow !== landed, `${name}: the landed member must not be the run's owner`)
      const target = scrolls.at(-1)
      report.check(target === row.turn * 100, `${name}: the landing must scroll to the member's own anchor (turn:${row.turn}), received ${JSON.stringify(scrolls)}`)
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
    } else if (row.kind === 'group-navigation-count') {
      const mounted = await mountCase(vm, { footer: { progress: true } })
      const stream = mounted.container.querySelector('.txn-stream')
      /* the pinned bar and the footer progress only mount once the stream is
         scrolled past the sticky threshold; that same list feeds the minimap. */
      await mounted.act(() => {
        stream.scrollTop = 60
        stream.dispatchEvent(new window.Event('scroll', { bubbles: true }))
      })
      await mounted.settle(20)
      const progress = text(mounted.container.querySelector('.txn-progress'))
      report.check(progress === row.expected, `${name}: a closed group is one progress count, expected ${JSON.stringify(row.expected)}, received ${JSON.stringify(progress)}`)
      const ticks = mounted.container.querySelectorAll('.txn-minimap-seg').length
      report.check(ticks === row.count, `${name}: a closed group is one minimap tick, expected ${row.count} ticks, received ${ticks}`)
      await mounted.unmount()
    } else if (row.kind === 'owner-inset') {
      const mounted = await mountCase(vm)
      const group = mounted.container.querySelector('.txn-systemgroup')
      const owner = article(mounted.container, 1)
      const member = article(mounted.container, 2)
      /* jsdom has no layout: an "offset" is the declarations a row sits behind between its
         group and itself. The owner must sit behind the same inline-start inset as a member,
         so the run reads as one column instead of a row at the edge and the rest indented. */
      const ownerPath = inlineStartPath(owner, group)
      const memberPath = inlineStartPath(member, group)
      report.check(ownerPath.length > 0, `${name}: the owner row must sit behind an inline-start inset`)
      report.check(same(ownerPath, memberPath), `${name}: the owner row must share the folded members' inline-start inset, owner=${JSON.stringify(ownerPath)} member=${JSON.stringify(memberPath)}`)
      report.check(ownerPath.every((value) => !/^0(?:px)?$/.test(value)), `${name}: the shared inset must not collapse to zero, received ${JSON.stringify(ownerPath)}`)
      await mounted.unmount()
    } else if (row.kind === 'navigator') {
      const mounted = await mountCase(leadingControl)
      const cards = [...mounted.container.querySelectorAll('.txn-rail-left .txn-rail-turn')]
      const prompts = cards.map((card) => text(card.querySelector('.txn-rail-turn-copy')))
      report.check(same(prompts, ['run the checks']), `${name}: the navigator must list only the conversation's own turns, received ${JSON.stringify(prompts)}`)
      report.check(cards.length === 1 && text(cards[0].querySelector('.txn-rail-turn-top b')) === '#2', `${name}: the sole card must still carry the user turn's own label, received ${JSON.stringify(cards.map((card) => text(card)))}`)
      report.check(cards.every((card) => !text(card).includes('mode')), `${name}: a system entry must never become a navigator card`)
      report.check(leadingControl.tasks.length === 1, `${name}: the cooked task list must drop the bookkeeping-only span, received ${leadingControl.tasks.length}`)
      report.check(leadingControl.tasks.every((task) => leadingControl.turns.find((turn) => turn.index === task.turnIndices[0])?.role !== 'system'), `${name}: every navigator task must open on a conversation turn`)
      await mounted.unmount()
    } else if (row.kind === 'counts') {
      const tabText = (container) => text([...container.querySelectorAll('[role="tab"]')].find((button) => text(button).startsWith('full trace')))
      const traceText = (container) => text(container.querySelector('.txn-trace-count'))
      const conversation = vm.turns.filter(isConversationTurn).length
      const expectedTab = `full trace ${conversation}`
      const expectedTrace = `${conversation} turns`
      /* the ratified rule: system entries are not turns. With the system filter off (the
         default reading) the count is still the conversation's; turning the filter on
         reveals the entries without inflating any turn count. */
      const off = await mountCase(vm, { filters: filtersWith({ categories: { system: false } }) })
      report.check(tabText(off.container) === expectedTab, `${name}: the tab must count conversation turns with system off, expected ${JSON.stringify(expectedTab)}, received ${JSON.stringify(tabText(off.container))}`)
      report.check(traceText(off.container) === expectedTrace, `${name}: the sub-header must count conversation turns with system off, expected ${JSON.stringify(expectedTrace)}, received ${JSON.stringify(traceText(off.container))}`)
      await off.unmount()
      const on = await mountCase(vm)
      report.check(tabText(on.container) === expectedTab, `${name}: the tab must count conversation turns with system on, expected ${JSON.stringify(expectedTab)}, received ${JSON.stringify(tabText(on.container))}`)
      report.check(traceText(on.container) === expectedTrace, `${name}: the sub-header must count conversation turns with system on, expected ${JSON.stringify(expectedTrace)}, received ${JSON.stringify(traceText(on.container))}`)
      await on.unmount()
      /* a narrowed reading still states its share of the CONVERSATION, never of every entry */
      const narrowed = await mountCase(vm, { filters: filtersWith({ categories: { prompts: false } }) })
      const visibleConversation = vm.turns.filter((turn) => isConversationTurn(turn) && turn.role !== 'user').length
      const expectedNarrowed = `${visibleConversation} of ${conversation} turns`
      report.check(traceText(narrowed.container) === expectedNarrowed, `${name}: a narrowed reading must state its share of the conversation, expected ${JSON.stringify(expectedNarrowed)}, received ${JSON.stringify(traceText(narrowed.container))}`)
      await narrowed.unmount()
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
      const head = mounted.container.querySelector('.txn-control-row')
      /* the kind is printed once, and the remainder keeps the recorded case: "Auto", never "auto" */
      report.check(text(head?.querySelector('.txn-control-kind')) === 'permission-mode', `${name}: the kind must be printed once, received ${JSON.stringify(text(head?.querySelector('.txn-control-kind')))}`)
      const value = text(head?.querySelector('.txn-control-value'))
      report.check(value === 'Auto', `${name}: the recorded value must keep its case beside the kind, received ${JSON.stringify(value)}`)
      report.check(/\.txn-control-value\s*\{[^}]*text-transform:\s*none/.test(css), `${name}: the value must opt out of any lowercase chrome transform`)
      await mounted.unmount()
    } else if (row.kind === 'control-value') {
      const payload = {
        id: 'control-value',
        harness: 'claude-code',
        turns: [
          { index: 0, role: 'system', content: 'mode: normal', controlKind: 'mode', depth: 0 },
          { index: 1, role: 'system', content: 'permission mode: auto', controlKind: 'permission-mode', depth: 0 },
          { index: 2, role: 'system', content: 'atis-latch', controlKind: 'atis-latch', depth: 0 },
          { index: 3, role: 'system', content: 'session title: Peasant Session', controlKind: 'custom-title', depth: 0 },
        ],
      }
      const mounted = await mountCase(adaptTranscript(payload))
      const rowOf = (index) => article(mounted.container, index)?.querySelector('.txn-control-row')
      const kindOf = (index) => text(rowOf(index)?.querySelector('.txn-control-kind'))
      const valueOf = (index) => text(rowOf(index)?.querySelector('.txn-control-value'))
      report.check(kindOf(0) === 'mode' && valueOf(0) === 'normal', `${name}: a value that repeats the kind must print it once, received ${JSON.stringify([kindOf(0), valueOf(0)])}`)
      report.check(kindOf(1) === 'permission-mode' && valueOf(1) === 'auto', `${name}: "permission mode: auto" must print as its kind plus "auto", received ${JSON.stringify([kindOf(1), valueOf(1)])}`)
      report.check(kindOf(2) === 'atis-latch' && rowOf(2)?.querySelector('.txn-control-value') == null, `${name}: a value equal to its kind must print the kind alone, received ${JSON.stringify(valueOf(2))}`)
      report.check(kindOf(3) === 'custom-title' && valueOf(3) === 'session title: Peasant Session', `${name}: a value that does not name its kind must stay verbatim, received ${JSON.stringify([kindOf(3), valueOf(3)])}`)
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
    } else if (row.kind === 'empty-state-singular') {
      const mounted = await mountCase(singleSystemOnly, { controlled: false })
      const empty = mounted.container.querySelector('.empty')
      report.check(!!empty && text(empty).includes('1 system entry is hidden by the system filter.'), `${name}: the empty state must use the singular sentence for one hidden entry, received ${JSON.stringify(text(empty))}`)
      const button = mounted.container.querySelector('.txn-empty-show-system')
      report.check(!!button && !button.closest('[hidden]'), `${name}: the empty state must offer a visible reveal control`)
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

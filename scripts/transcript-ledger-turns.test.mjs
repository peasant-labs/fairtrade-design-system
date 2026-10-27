#!/usr/bin/env node
/* Mounted-source gate for the ledger presentation's turns. The summary rows import the pure
   work-summary helpers directly and assert the counts and both labels; the mount rows cook the
   REAL adapter and mount the REAL TranscriptViewer, then assert what a reader reaches: classic
   keeps the flat tool rows and its full head, the ledger presentation groups a turn's tools into
   one panel with its literal computed summary and working per-tool disclosures, leads with a
   role-only head, renders a system turn as a compact row with a working disclosure and its
   copy-anchor, opens that row when search reveals it, marks a change of role with a rule, keeps a
   turn's thinking disclosure, and leaves a turn without tools with no panel at all.
   Cases: scripts/testdata/transcript-ledger-turns.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-ledger-turns;
   mutations: node scripts/parts-mutations.mjs scripts/transcript-ledger-turns.test.mjs
   scripts/testdata/transcript-ledger-turns.manifest.yaml */
import { loadFixturePair, assertExactNames, assertFields, withMountedSource, click, createReport } from './mounted-parts.mjs'
import { workSummary, workCountLabel, workMetaLabel, workActionsLabel } from '../src/ui/transcript/work-summary.js'

const FIXTURE = 'scripts/testdata/transcript-ledger-turns.yaml'
const MANIFEST = 'scripts/testdata/transcript-ledger-turns.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  summaryCases: 'requiredSummaryNames',
  thinkingDurationCases: 'requiredThinkingDurationNames',
  cases: 'requiredCaseNames',
})

/* the fixture's behaviour axis is pinned too: a case cannot be re-pointed at a cheaper assertion
   while its name stays in the manifest. */
assertExactNames(
  fixture.cases.map((row) => `${row.name}: ${row.kind}`),
  Object.entries(manifest.requiredCaseKinds).map(([name, kind]) => `${name}: ${kind}`),
  `${MANIFEST} case kinds`,
)

/* every summary row lists every expected field, so a new count cannot slip in unasserted. */
const SUMMARY_FIELDS = ['calls', 'commands', 'files', 'edits', 'failed', 'durationMs']
for (const row of fixture.summaryCases) {
  assertFields(row, ['name', 'tools', 'expected', 'countLabel', 'metaLabel', 'actionsLabel'], `${FIXTURE} ${row.name}`)
  assertExactNames(Object.keys(row.expected), SUMMARY_FIELDS, `${FIXTURE} ${row.name} expected`)
}
for (const row of fixture.cases) assertFields(row, ['name', 'kind'], `${FIXTURE} ${row.name}`, ['headingLevel', 'turn', 'preview', 'revealedTurn', 'closedTurn', 'input', 'keyboardSteps', 'manualScrollExpected'])
assertExactNames(Object.keys(fixture.mountedSummary), ['panel', 'grouped', 'afterUser'], `${FIXTURE} mountedSummary`)
if (typeof fixture.revealQuery !== 'string' || fixture.revealQuery.length === 0) throw new Error(`${FIXTURE}: revealQuery must be a non-empty string`)

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
/* an idref may be a React useId value, which is not a plain CSS identifier. */
const byId = (container, id) => (id ? [...container.querySelectorAll('[id]')].find((node) => node.id === id) ?? null : null)

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
  const actionsLabel = workActionsLabel(summary)
  report.check(actionsLabel === row.actionsLabel, `${row.name}: the action block header must read ${JSON.stringify(row.actionsLabel)}, received ${JSON.stringify(actionsLabel)}`)
}

assertExactNames(Object.keys(fixture.mountedThinking), ['kind', 'words', 'duration'], `${FIXTURE} mountedThinking`)
for (const row of fixture.thinkingDurationCases) assertFields(row, ['name', 'turn', 'expected'], `${FIXTURE} ${row.name}`, ['previous'])

/* canLabel on, so the classic head's built-in label affordance exists to prove the ledger head drops it */
const CAPABILITIES = { canEdit: false, canLabel: true, canContribute: false, canChangeVisibility: false, canExport: false }
const HOST_ACTION = 'host action'

await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript, thinkingDurationMs } = await load('/src/ui/transcript/adapter.js')
  /* the thinking-time rule, through the loaded adapter so a mutation of it is the one under test */
  for (const row of fixture.thinkingDurationCases) {
    const actual = thinkingDurationMs(row.previous, row.turn) ?? null
    report.check(actual === row.expected, `${row.name}: the thinking time must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
  }
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const vm = adaptTranscript(fixture.payload)
  const toolsTurn = vm.turns.find((turn) => turn.index === 1)
  const tools = toolsTurn?.toolCalls ?? []
  if (tools.length !== 5) throw new Error(`${FIXTURE}: the payload must cook turn 1 with 5 tool calls, received ${tools.length}`)
  if (!toolsTurn?.tokens) throw new Error(`${FIXTURE}: the payload must cook turn 1 with a token count`)
  if (!toolsTurn?.effectiveModel) throw new Error(`${FIXTURE}: the payload must cook turn 1 with its observed model`)
  const systemTurn = vm.turns.find((turn) => turn.index === 2)
  if (!systemTurn) throw new Error(`${FIXTURE}: the payload must cook the system turn 2`)
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

  const mountViewer = (presentation, extra = {}) => mount(React.createElement(TranscriptViewer, {
    viewModel: vm,
    capabilities: CAPABILITIES,
    presentation,
    ...extra,
  }))

  for (const row of fixture.cases) {
    if (row.kind === 'classic') {
      const mounted = await mountViewer(undefined, { savedLabels: { 1: { outcome: 'good' } } })
      const workPanels = mounted.container.querySelectorAll('.txn-work')
      report.check(workPanels.length === 0, `${row.name}: the classic surface must render no work panel, received ${workPanels.length}`)
      const rows = mounted.container.querySelectorAll('#turn-1 .txn-toolcall')
      report.check(rows.length === tools.length, `${row.name}: the classic surface must draw ${tools.length} flat tool rows, received ${rows.length}`)
      report.check(mounted.container.querySelectorAll('.txn-roleico').length === 0, `${row.name}: the classic surface must keep the role label as it was, with no role well`)
      report.check(!!mounted.container.querySelector('#turn-2 .txn-turn .txn-turnhead'), `${row.name}: a system turn keeps its classic card head`)
      report.check(mounted.container.querySelector('#turn-2 .txn-systemrow') === null, `${row.name}: the classic surface must render no system row`)
      const classicHead = mounted.container.querySelector('#turn-1 .txn-turnhead')
      for (const selector of ['.txn-turn-disclosure', '.txn-labelbtn', '.txn-turnmodel', '.txn-tokbadge', '.chip-err']) {
        report.check(!!classicHead?.querySelector(selector), `${row.name}: the classic head must keep ${selector}`)
      }
      report.check(!!mounted.container.querySelector('#turn-1 .txn-savedchips'), `${row.name}: the classic turn must keep its saved-label chip`)
      await mounted.unmount()
    } else if (row.kind === 'ledger-panel') {
      const mounted = await mountViewer('ledger')
      const workPanels = [mounted.container.querySelector('#turn-1 .txn-modelactions')].filter(Boolean)
      report.check(workPanels.length === 1, `${row.name}: the turn with tools must carry one model-actions block, received ${workPanels.length}`)
      const head = workPanels[0]?.querySelector('.txn-modelactions-head')
      report.check(!!head, `${row.name}: the block names the work in one line`)
      const headText = text(head?.querySelector('.txn-modelactions-summary'))
      report.check(headText === fixture.mountedSummary.panel, `${row.name}: the block header must read ${JSON.stringify(fixture.mountedSummary.panel)}, received ${JSON.stringify(headText)}`)
      report.check(head?.querySelector('.txn-tc-chev') === null, `${row.name}: the summary line carries no chevron`)
      const toggle = workPanels[0]?.querySelector('.txn-modelactions-head')
      report.check(toggle?.getAttribute('aria-expanded') === 'true', `${row.name}: the action list starts expanded`)
      report.check(workPanels[0]?.querySelector('.txn-tcbody, .txn-thinking-body') === null, `${row.name}: showing the list must not open action contents`)
      const rows = workPanels[0]?.querySelectorAll('.txn-modelactions-rows .txn-toolcall') ?? []
      report.check(rows.length === tools.length, `${row.name}: the open block must hold all ${tools.length} tool rows, received ${rows.length}`)
      report.check(rows[0]?.querySelector('.txn-tc-chev') === null, `${row.name}: a ledger row carries no chevron`)
      /* a child left open must not keep the block open: the head closes and reopens it */
      const firstRowButton = rows[0]?.querySelector('.txn-tc-head')
      if (firstRowButton) await mounted.act(() => click(window, firstRowButton))
      await mounted.settle()
      report.check(!!workPanels[0]?.querySelector('.txn-tcbody'), `${row.name}: opening a child reveals its body`)
      if (toggle) await mounted.act(() => click(window, toggle))
      await mounted.settle()
      report.check((workPanels[0]?.querySelectorAll('.txn-modelactions-rows').length ?? 0) === 0, `${row.name}: the head must close a block whose child is open`)
      if (toggle) await mounted.act(() => click(window, toggle))
      await mounted.settle()
      report.check((workPanels[0]?.querySelectorAll('.txn-modelactions-rows').length ?? 0) === 1, `${row.name}: the head must reopen it after a close`)
      const article = mounted.container.querySelector('#turn-1.txn-turnwrap-ledger')
      report.check(!!article, `${row.name}: the turn wrapper must carry the ledger turn class`)
      report.check(!!article?.querySelector('.txn-turn.txn-turn-ledger'), `${row.name}: the ledger turn must drop the classic card, keeping the ledger card class`)
      report.check(!!article?.querySelector('.txn-turnhead-ledger .txn-roleico'), `${row.name}: the ledger head must lead with the square role well`)
      report.check(!!article?.querySelector('.txn-rolelabel'), `${row.name}: the ledger head must still name the role`)
      await mounted.unmount()
    } else if (row.kind === 'ledger-head') {
      const mounted = await mountViewer('ledger', { savedLabels: { 1: { outcome: 'good' } } })
      const article = mounted.container.querySelector('#turn-1.txn-turnwrap-ledger')
      const head = article?.querySelector('.txn-turnhead-ledger')
      const well = head?.querySelector('.txn-roleico')
      const label = head?.querySelector('.txn-rolelabel')
      report.check(text(label) === 'assistant', `${row.name}: the role label must read the role word, received ${JSON.stringify(text(label))}`)
      report.check(!!well && well.nextElementSibling === label, `${row.name}: the square role well must precede the role label`)
      report.check(text(head?.querySelector('.txn-turnnum')) === '#' + toolsTurn.label, `${row.name}: the head must carry the turn number, received ${JSON.stringify(text(head?.querySelector('.txn-turnnum')))}`)
      report.check(text(head?.querySelector('.txn-turntime')).length > 0, `${row.name}: the head must carry the turn time`)
      report.check(!!head?.querySelector('.txn-anchor'), `${row.name}: the head must keep the copy anchor`)
      for (const selector of ['.txn-turn-disclosure', '.txn-labelbtn', '.txn-turnmodel', '.txn-tokbadge', '.chip-err']) {
        report.check(head?.querySelector(selector) === null, `${row.name}: the ledger head must omit the built-in ${selector} control`)
      }
      report.check(article?.querySelector('.txn-savedchips') === null, `${row.name}: the ledger turn must omit the saved-label chip`)
      await mounted.unmount()
    } else if (row.kind === 'host-actions') {
      const mounted = await mountViewer('ledger', {
        renderTurnActions: () => React.createElement('span', { className: 'host-action' }, HOST_ACTION),
      })
      const turnAction = mounted.container.querySelector('#turn-1 .txn-turnhead-ledger .host-action')
      report.check(text(turnAction) === HOST_ACTION, `${row.name}: a host action must survive on a ledger turn head`)
      const userAction = mounted.container.querySelector('#turn-0 .txn-turnhead-ledger .host-action')
      report.check(text(userAction) === HOST_ACTION, `${row.name}: a host action must survive on a ledger user turn head`)
      const systemAction = mounted.container.querySelector('#turn-2 .txn-systemrow-head-row .host-action')
      report.check(text(systemAction) === HOST_ACTION, `${row.name}: a host action must survive on a ledger system row`)
      report.check(!!mounted.container.querySelector('#turn-2 .txn-systemrow-head-row .txn-anchor'), `${row.name}: the system row must keep the copy anchor beside the host action`)
      await mounted.unmount()
    } else if (row.kind === 'system-controlled') {
      const { default: SystemRow } = await load('/src/ui/transcript/SystemRow.jsx')
      const states = []
      const mounted = await mount(React.createElement(SystemRow, {
        turn: systemTurn,
        open: false,
        onToggle: (next) => states.push(next),
      }))
      const head = mounted.container.querySelector('.txn-systemrow-head')
      report.check(head?.getAttribute('aria-expanded') === 'false', `${row.name}: a controlled row must render the host's state`)
      if (head) await mounted.act(() => click(window, head))
      await mounted.settle()
      report.check(states.length === 1 && states[0] === true, `${row.name}: the host must receive the next disclosure state, received ${JSON.stringify(states)}`)
      report.check(mounted.container.querySelector('.txn-systemrow-head')?.getAttribute('aria-expanded') === 'false', `${row.name}: a controlled row must not change its own state`)
      await mounted.unmount()
    } else if (row.kind === 'system-reveal') {
      const mounted = await mountViewer('ledger', { search: fixture.revealQuery, showSearchTrigger: true })
      const trigger = mounted.container.querySelector('.txn-search-trigger')
      report.check(!!trigger, `${row.name}: the viewer must offer the search trigger the reveal path runs through`)
      if (trigger) await mounted.act(() => click(window, trigger))
      await mounted.settle()
      const head = mounted.container.querySelector(`#turn-${row.revealedTurn} .txn-systemrow-head`)
      report.check(head?.getAttribute('aria-expanded') === 'true', `${row.name}: the revealed system row must open`)
      report.check(mounted.container.querySelector(`#turn-${row.revealedTurn} .txn-systemrow-body`)?.hasAttribute('hidden') === false, `${row.name}: the revealed system row must show its recorded text`)
      /* the reveal lands on the matched turn only: another system turn stays collapsed */
      const other = mounted.container.querySelector(`#turn-${row.closedTurn} .txn-systemrow-head`)
      report.check(other?.getAttribute('aria-expanded') === 'false', `${row.name}: the unrevealed system row must stay collapsed`)
      await mounted.unmount()
    } else if (row.kind === 'system-preview') {
      const mounted = await mountViewer('ledger')
      const rowEl = mounted.container.querySelector(`#turn-${row.turn} .txn-systemrow`)
      const preview = text(rowEl?.querySelector('.txn-systemrow-preview'))
      report.check(preview === row.preview, `${row.name}: the preview must read the rendered words ${JSON.stringify(row.preview)}, received ${JSON.stringify(preview)}`)
      for (const marker of ['](', '**', '`', '~~', '<b>']) {
        report.check(!preview.includes(marker), `${row.name}: the preview must not print the Markdown source ${JSON.stringify(marker)}`)
      }
      /* the body is unchanged: a system turn that is Markdown still renders as Markdown */
      const link = mounted.container.querySelector(`#turn-${row.turn} .txn-systemrow-body a.txn-md-link`)
      report.check(text(link) === 'fixture guide', `${row.name}: the body must keep the rendered link text, received ${JSON.stringify(text(link))}`)
      report.check(link?.getAttribute('href') === 'https://example.test/guide', `${row.name}: the body must keep the rendered link destination`)
      report.check(!!mounted.container.querySelector(`#turn-${row.turn} .txn-systemrow-body code.txn-inlinecode`), `${row.name}: the body must keep the rendered inline code`)
      await mounted.unmount()
    } else if (row.kind === 'turn-rules') {
      /* the body rule separates a change of role; the sidebar cards carry their own rhythm */
      const expectedRules = vm.turns.filter((turn, i) => i > 0 && vm.turns[i - 1].role !== turn.role).length
      if (expectedRules < 1) throw new Error(`${FIXTURE}: the payload must cook at least one role change`)
      const ledgerMount = await mountViewer('ledger')
      const rules = ledgerMount.container.querySelectorAll('.txn-turn-rule')
      report.check(rules.length === expectedRules, `${row.name}: the ledger must draw one rule at each role change (${expectedRules}), received ${rules.length}`)
      const firstWrap = ledgerMount.container.querySelector('#turn-0.txn-turnwrap-ledger')?.parentElement
      report.check(!!firstWrap && firstWrap.querySelector('.txn-turn-rule') === null, `${row.name}: the ledger must draw no rule before the first turn`)
      for (const rule of rules) report.check(rule.tagName === 'HR' && rule.getAttribute('aria-hidden') === 'true', `${row.name}: each rule must be a decorative hr`)
      await ledgerMount.unmount()
      const classicMount = await mountViewer(undefined)
      report.check(classicMount.container.querySelectorAll('.txn-turn-rule').length === 0, `${row.name}: the classic surface must draw no role rules`)
      await classicMount.unmount()
    } else if (row.kind === 'ledger-disclosure') {
      const mounted = await mountViewer('ledger')
      const panel = mounted.container.querySelector('#turn-1 .txn-modelactions')
      const rowButton = panel?.querySelector('.txn-toolcall .txn-tc-head')
      report.check(!!rowButton, `${row.name}: the panel must draw a tool row`)
      report.check(rowButton?.getAttribute('aria-expanded') === 'false', `${row.name}: a tool row must start collapsed`)
      if (rowButton) await mounted.act(() => click(window, rowButton))
      await mounted.settle()
      const open = panel?.querySelector('.txn-toolcall .txn-tc-head')
      report.check(open?.getAttribute('aria-expanded') === 'true', `${row.name}: the clicked row must stay open`)
      report.check(!!panel?.querySelector('.txn-toolcall .txn-tcbody'), `${row.name}: the clicked row must reveal its body`)
      const input = panel?.querySelector('.txn-toolcall .txn-term')
      report.check(text(input?.previousElementSibling) === 'input', `${row.name}: Bash must label its command input`)
      report.check(text(input?.querySelector('.mono')) === row.input, `${row.name}: Bash input must preserve the recorded command`)
      report.check(!!input && input.querySelector('svg') === null, `${row.name}: Bash input must contain no icon`)
      report.check(text(input?.querySelector('.txn-term-prompt')) === '$', `${row.name}: Bash input keeps its dollar prompt`)
      if (open) await mounted.act(() => click(window, open))
      await mounted.settle()
      const closed = panel?.querySelector('.txn-toolcall .txn-tc-head')
      report.check(closed?.getAttribute('aria-expanded') === 'false', `${row.name}: clicking the open row must collapse it`)
      await mounted.unmount()
    } else if (row.kind === 'turn-keys') {
      const selections = []
      const mounted = await mountViewer('ledger', { onActiveTurnChange: index => selections.push(index) })
      const container = mounted.container
      const stream = container.querySelector('.txn-stream')
      // A short scroller cannot align its last cards with the reading line. Its clamped
      // scroll feedback must not replace the turn the reader explicitly requested.
      Object.defineProperty(stream, 'clientHeight', { configurable: true, value: 300 })
      Object.defineProperty(stream, 'scrollHeight', { configurable: true, value: 450 })
      for (const el of container.querySelectorAll('.txn-stream [data-turn]')) {
        Object.defineProperty(el, 'offsetTop', { configurable: true, value: Number(el.getAttribute('data-turn')) * 100 })
      }
      stream.scrollTo = ({ top }) => {
        stream.scrollTop = Math.max(0, Math.min(150, top))
        stream.dispatchEvent(new window.Event('scroll'))
      }
      for (const step of row.keyboardSteps) {
        await mounted.act(() => {
          for (const key of step.keys) window.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
        })
        await mounted.settle(20)
        report.check(selections.at(-1) === step.expected, `${row.name}: the burst must select ${step.expected}, received ${selections.at(-1)}`)
      }
      await mounted.act(() => {
        stream.dispatchEvent(new window.WheelEvent('wheel', { bubbles: true }))
        stream.scrollTop = 0
        stream.dispatchEvent(new window.Event('scroll'))
      })
      report.check(selections.at(-1) === row.manualScrollExpected, `${row.name}: manual scrolling must restore reading-line selection`)
      await mounted.unmount()
    } else if (row.kind === 'turn-selection') {
      const selections = []
      const mounted = await mountViewer('ledger', { onActiveTurnChange: (index) => selections.push(index) })
      const container = mounted.container
      const stream = container.querySelector('.txn-stream')
      const before = stream.scrollTop
      await mounted.act(() => click(window, container.querySelector(`#turn-${row.turn} .txn-body`)))
      report.check(selections.at(-1) === row.turn, `${row.name}: clicking the prose must select its own turn`)
      report.check(container.querySelectorAll('.txn-turn-ledger.txn-active').length === 1 && !!container.querySelector(`#turn-${row.turn} .txn-active`), `${row.name}: the amber active class must move to that one card`)
      report.check(stream.scrollTop === before, `${row.name}: selecting a card must not jump the reader`)
      const selectionCount = selections.length
      const actionHead = container.querySelector('.txn-modelactions-head')
      if (actionHead) await mounted.act(() => click(window, actionHead))
      report.check(selections.length === selectionCount, `${row.name}: the action block must not select its hosting turn`)
      const copy = container.querySelector('#turn-1 .txn-anchor')
      await mounted.act(() => copy?.focus())
      report.check(selections.at(-1) === 1, `${row.name}: focusing a card control must also select its turn`)
      await mounted.unmount()
    } else if (row.kind === 'compact-actions') {
      const mounted = await mountViewer('ledger')
      const container = mounted.container
      const panel = () => container.querySelector('#turn-1 .txn-modelactions')
      const list = () => panel()?.querySelector('.txn-modelactions-rows')
      const compact = container.querySelector('[role="switch"][aria-label="compact mode"]')
      report.check(!!list(), `${row.name}: the action list starts expanded`)
      report.check(panel()?.querySelector('.txn-tcbody, .txn-thinking-body') === null, `${row.name}: action contents must start closed`)
      // Collapse an open child along with the list, so no child holds the list open.
      const firstAction = panel()?.querySelector('.txn-toolcall .txn-tc-head')
      if (firstAction) await mounted.act(() => click(window, firstAction))
      report.check(!!panel()?.querySelector('.txn-tcbody'), `${row.name}: opening one action must reveal its contents`)
      await mounted.act(() => click(window, compact))
      await mounted.settle()
      report.check(list() === null && panel()?.querySelector('.txn-modelactions-head')?.getAttribute('aria-expanded') === 'false', `${row.name}: compact mode must collapse the action list`)
      const compactHead = panel()?.querySelector('.txn-modelactions-head')
      if (compactHead) await mounted.act(() => click(window, compactHead))
      await mounted.settle()
      report.check(!!list() && panel()?.querySelector('.txn-tcbody, .txn-thinking-body') === null, `${row.name}: compact mode must still let the reader open just the list`)
      await mounted.act(() => click(window, compact))
      await mounted.settle()
      report.check(!!list() && panel()?.querySelector('.txn-tcbody, .txn-thinking-body') === null, `${row.name}: leaving compact mode restores the list without opening contents`)
      const expandAll = container.querySelector('[role="switch"][aria-label="expand all tool calls"]')
      await mounted.act(() => click(window, expandAll))
      report.check(!!panel()?.querySelector('.txn-tcbody'), `${row.name}: expand all still opens action contents`)
      await mounted.act(() => click(window, compact))
      await mounted.settle()
      report.check(list() === null, `${row.name}: compact mode must collapse the list even with expand all enabled`)
      await mounted.unmount()
    } else if (row.kind === 'system-filter') {
      const mounted = await mountViewer('ledger')
      const container = mounted.container
      const systemCheck = () => [...container.querySelectorAll('.txn-catlist .txn-checkrow')].find((el) => text(el.querySelector('.txn-cr-label')) === 'system')
      const checkbox = () => systemCheck()?.querySelector('input[type="checkbox"]')
      const visibleIndices = () => [...container.querySelectorAll('.txn-stream [data-turn]')].map((el) => Number(el.getAttribute('data-turn')))
      const baseline = visibleIndices()
      const systemTurns = vm.turns.filter((turn) => turn.role === 'system')
      report.check(checkbox()?.checked === true, `${row.name}: system must start checked`)
      report.check(text(systemCheck()?.querySelector('.txn-cr-count')) === String(systemTurns.length), `${row.name}: the badge must count system turns`)
      if (checkbox()) await mounted.act(() => click(window, checkbox()))
      await mounted.settle()
      report.check(container.querySelector('.txn-stream .txn-systemrow') === null, `${row.name}: the unchecked system category must hide every system row`)
      report.check(same(visibleIndices(), baseline.filter((index) => !systemTurns.some((turn) => turn.index === index))), `${row.name}: hiding system must preserve every other turn`)
      report.check(text(container.querySelector('.txn-clear')) === 'clear (1)', `${row.name}: hiding system must count as one active filter`)
      if (checkbox()) await mounted.act(() => click(window, checkbox()))
      await mounted.settle()
      report.check(same(visibleIndices(), baseline), `${row.name}: checking system must restore the original turn order`)
      if (checkbox()) await mounted.act(() => click(window, checkbox()))
      await mounted.act(() => click(window, container.querySelector('.txn-clear')))
      await mounted.settle()
      report.check(checkbox()?.checked === true && same(visibleIndices(), baseline), `${row.name}: clear must restore system turns and its checked state`)
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
      const article = mounted.container.querySelector('#turn-2.txn-turnwrap-ledger')
      const heading = byId(mounted.container, article?.getAttribute('aria-labelledby'))
      report.check(!!heading, `${row.name}: the article's aria-labelledby must resolve to its hidden heading`)
      report.check(text(heading) === `system turn ${systemTurn.label}`, `${row.name}: the hidden heading must name the role and turn, received ${JSON.stringify(text(heading))}`)
      const controlled = byId(mounted.container, head?.getAttribute('aria-controls'))
      report.check(controlled === body, `${row.name}: the disclosure's aria-controls must resolve to the recorded-text body`)
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
      report.check(copied.length === before + 1 && copied[before] === '#turn-' + systemTurn?.index, `${row.name}: the anchor must copy the turn link, received ${JSON.stringify(copied.slice(before))}`)
      /* the copied marker clears on a 1.5s timer; let it fire while the mounted window still exists */
      await mounted.settle(1600)
      await mounted.unmount()
    } else if (row.kind === 'heading-level') {
      const mounted = await mountViewer('ledger', { headingLevel: row.headingLevel })
      /* the composite's turns sit two heading levels below its own page level */
      const turnHeadingLevel = row.headingLevel + 2
      const article = mounted.container.querySelector('#turn-2.txn-turnwrap-ledger')
      const heading = byId(mounted.container, article?.getAttribute('aria-labelledby'))
      report.check(!!heading, `${row.name}: the article's aria-labelledby must resolve`)
      report.check(heading?.tagName === 'H' + turnHeadingLevel, `${row.name}: the turn heading must sit two levels under the page, expected H${turnHeadingLevel}, received ${heading?.tagName}`)
      report.check(text(heading) === `system turn ${systemTurn.label}`, `${row.name}: the heading must keep the role and turn`)
      await mounted.unmount()
    } else if (row.kind === 'detail-turns') {
      /* only a turn with words gets a card; a tool-only or thinking-only turn is inline detail */
      const bare = {
        ...vm,
        turns: vm.turns.map((t) => (t.index === toolsTurn.index ? { ...t, content: '', displayContent: '' } : t)),
      }
      const mounted = await mountViewer('ledger', { viewModel: bare })
      const article = mounted.container.querySelector(`#turn-${toolsTurn.index}.txn-turnwrap-ledger`)
      report.check(!!article, `${row.name}: the tool turn must still mount`)
      report.check(article?.querySelector('.txn-turnhead-ledger') === null, `${row.name}: a turn with no words must draw no card head`)
      report.check(article?.querySelector('.txn-roleico') === null, `${row.name}: a turn with no words must draw no role well`)
      /* its work folds into the block after the user turn's first prose turn, turn 3 */
      report.check(article?.querySelector('.txn-modelactions, .txn-work') === null, `${row.name}: a wordless turn before the first prose turn draws no work of its own`)
      const block = mounted.container.querySelector('#turn-3 .txn-modelactions')
      report.check(!!block, `${row.name}: its work must render in the block after the first prose turn`)
      report.check(!!block?.querySelector('.txn-modelactions-head'), `${row.name}: the block names the run`)
      report.check(!!block?.querySelector('.txn-modelactions-rows'), `${row.name}: the action list starts expanded`)
      const heading = byId(mounted.container, article?.getAttribute('aria-labelledby'))
      report.check(!!heading && heading.classList.contains('txn-turn-heading'), `${row.name}: the article keeps its heading for assistive tech`)
      await mounted.unmount()
    } else if (row.kind === 'model-actions') {
      /* One user turn: prose with tools (1), a system row (2), a second prose turn with a command
         of its own (3) and a thinking-only turn (4). Then a second user turn (5) whose model turns
         have no prose (7, 8), so its block sits on the first of them. */
      const tool = toolsTurn.toolCalls[0]
      const wordlessTool = (t, index) => ({ ...t, index, identity: `grouped-turn-${index}`, label: String(index), content: '', displayContent: '', thinking: undefined, toolCalls: [{ ...tool, id: `grouped-${index}` }] })
      const grouped = {
        ...vm,
        turns: [
          ...vm.turns.map((t) => {
            if (t.index === 3) return { ...t, toolCalls: [{ ...tool, id: 'grouped-3' }] }
            if (t.index === 5) return { ...t, role: 'user' }
            return t
          }),
          wordlessTool(toolsTurn, 7),
          wordlessTool(toolsTurn, 8),
        ],
      }
      const totalTools = grouped.turns.reduce((sum, t) => sum + (t.toolCalls?.length ?? 0), 0)
      const mounted = await mountViewer('ledger', { viewModel: grouped })
      const container = mounted.container
      report.check(container.querySelectorAll('.txn-work').length === 0, `${row.name}: no ledger turn keeps a work row of its own beside the block`)
      const block = container.querySelector('#turn-1 .txn-modelactions')
      report.check(!!block, `${row.name}: the user turn's block must sit after its first prose turn`)
      for (const index of [3, 4]) {
        report.check(container.querySelector(`#turn-${index} .txn-modelactions`) === null, `${row.name}: turn ${index} folds its work into the first prose turn's block`)
      }
      report.check(!!container.querySelector('#turn-3 .txn-turnhead-ledger'), `${row.name}: the second prose turn keeps its card`)
      const header = text(block?.querySelector('.txn-modelactions-summary'))
      report.check(header === fixture.mountedSummary.grouped, `${row.name}: the block header must read ${JSON.stringify(fixture.mountedSummary.grouped)}, received ${JSON.stringify(header)}`)
      report.check(!!block?.querySelector('.txn-modelactions-rows'), `${row.name}: the action list starts expanded`)
      const rows = block?.querySelectorAll('.txn-modelactions-rows .txn-toolcall') ?? []
      report.check(rows.length === 6, `${row.name}: the block folds every tool from the user turn, received ${rows.length}`)
      const think = block?.querySelector('.txn-thinking-toggle')
      report.check(!!think, `${row.name}: the user turn's thinking comes with it`)
      if (think) await mounted.act(() => click(window, think))
      await mounted.settle()
      report.check(/check the fixture/.test(text(block?.querySelector('.txn-thinking-body'))), `${row.name}: the thinking text is the user turn's own`)
      /* the next user turn starts a new block */
      const next = container.querySelector('#turn-7 .txn-modelactions')
      report.check(!!next, `${row.name}: a user turn starts a new block, on its first turn with work when it has no prose`)
      report.check(container.querySelector('#turn-8 .txn-modelactions') === null, `${row.name}: the later wordless turn folds into that block`)
      const nextHeader = text(next?.querySelector('.txn-modelactions-summary'))
      report.check(nextHeader === fixture.mountedSummary.afterUser, `${row.name}: the second block header must read ${JSON.stringify(fixture.mountedSummary.afterUser)}, received ${JSON.stringify(nextHeader)}`)
      const shown = container.querySelectorAll('.txn-toolcall').length
      report.check(shown === totalTools, `${row.name}: every tool renders once, expected ${totalTools}, received ${shown}`)
      await mounted.unmount()
    } else if (row.kind === 'thinking') {
      const mounted = await mountViewer('ledger')
      /* turn 4's thinking is part of its user turn's block, after turn 1 */
      report.check(mounted.container.querySelector('#turn-4 .txn-thinking-toggle') === null, `${row.name}: the thinking turn draws no thinking line of its own`)
      const toggle = mounted.container.querySelector('#turn-1 .txn-thinking-toggle')
      report.check(!!toggle, `${row.name}: a turn with thinking must keep its thinking disclosure`)
      /* the thinking row has the tool-call shape: kind, word count, time */
      report.check(toggle?.classList.contains('tc-head') && toggle?.closest('.txn-toolcall') === null, `${row.name}: thinking must use the tool-row head without counting as a tool call`)
      report.check(text(toggle?.querySelector('.kind')) === fixture.mountedThinking.kind, `${row.name}: the row must name its kind ${JSON.stringify(fixture.mountedThinking.kind)}, received ${JSON.stringify(text(toggle?.querySelector('.kind')))}`)
      report.check(!!toggle?.querySelector('.kind svg'), `${row.name}: the row must lead with its kind icon`)
      report.check(text(toggle?.querySelector('.path')) === fixture.mountedThinking.words, `${row.name}: the row must list ${JSON.stringify(fixture.mountedThinking.words)}, received ${JSON.stringify(text(toggle?.querySelector('.path')))}`)
      report.check(text(toggle?.querySelector('.right .txn-tc-dur')) === fixture.mountedThinking.duration, `${row.name}: the row must show the time spent ${JSON.stringify(fixture.mountedThinking.duration)}, received ${JSON.stringify(text(toggle?.querySelector('.right .txn-tc-dur')))}`)
      if (toggle) await mounted.act(() => click(window, toggle))
      await mounted.settle()
      const body = mounted.container.querySelector('#turn-1 .txn-thinking-body')
      report.check(!!body?.querySelector('.txn-thinking-box'), `${row.name}: opening Think must put its text in an output box`)
      report.check(/check the fixture/.test(text(body)), `${row.name}: opening the disclosure must reveal the thinking text, received ${JSON.stringify(text(body))}`)
      await mounted.unmount()
    } else if (row.kind === 'no-tools') {
      const mounted = await mountViewer('ledger')
      const total = mounted.container.querySelectorAll('.txn-modelactions').length
      report.check(total === 1, `${row.name}: the payload's one user turn carries one block, received ${total}`)
      for (const index of toolLessTurns) {
        report.check(mounted.container.querySelector(`#turn-${index} .txn-modelactions`) === null, `${row.name}: the tool-less turn ${index} must render no block`)
      }
      report.check(!!mounted.container.querySelector('#turn-1 .txn-modelactions'), `${row.name}: the turn with tools keeps its block`)
      await mounted.unmount()
    } else {
      throw new Error(`${FIXTURE}: unknown case kind ${JSON.stringify(row.kind)}`)
    }
  }
})

report.finish(`${fixture.summaryCases.length} summary rows and ${fixture.cases.length} mounted cases.`)

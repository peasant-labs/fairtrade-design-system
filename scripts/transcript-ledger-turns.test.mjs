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
import { workSummary, workCountLabel, workMetaLabel } from '../src/ui/transcript/work-summary.js'

const FIXTURE = 'scripts/testdata/transcript-ledger-turns.yaml'
const MANIFEST = 'scripts/testdata/transcript-ledger-turns.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  summaryCases: 'requiredSummaryNames',
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
  assertFields(row, ['name', 'tools', 'expected', 'countLabel', 'metaLabel'], `${FIXTURE} ${row.name}`)
  assertExactNames(Object.keys(row.expected), SUMMARY_FIELDS, `${FIXTURE} ${row.name} expected`)
}
for (const row of fixture.cases) assertFields(row, ['name', 'kind'], `${FIXTURE} ${row.name}`, ['headingLevel', 'turn', 'preview', 'revealedTurn', 'closedTurn'])
assertExactNames(Object.keys(fixture.mountedSummary), ['countLabel', 'metaLabel'], `${FIXTURE} mountedSummary`)
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
}

/* canLabel on, so the classic head's built-in label affordance exists to prove the ledger head drops it */
const CAPABILITIES = { canEdit: false, canLabel: true, canContribute: false, canChangeVisibility: false, canExport: false }
const HOST_ACTION = 'host action'

await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
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
      const workPanels = mounted.container.querySelectorAll('.txn-work')
      report.check(workPanels.length === 1, `${row.name}: exactly one work panel must render for the turn with tools, received ${workPanels.length}`)
      const head = workPanels[0]?.querySelector('.txn-work-head')
      report.check(!!head, `${row.name}: the ledger names the work in one summary line`)
      report.check(text(head?.querySelector('.txn-work-count')) === fixture.mountedSummary.countLabel, `${row.name}: the count must read ${JSON.stringify(fixture.mountedSummary.countLabel)}`)
      report.check(text(head?.querySelector('.txn-work-meta')) === fixture.mountedSummary.metaLabel, `${row.name}: the meta must read ${JSON.stringify(fixture.mountedSummary.metaLabel)}`)
      report.check(head?.querySelector('.txn-tc-chev') === null, `${row.name}: the summary line carries no chevron`)
      const toggle = workPanels[0]?.querySelector('.txn-work-toggle')
      report.check(toggle?.getAttribute('aria-expanded') === 'false', `${row.name}: the summary line starts closed`)
      report.check((workPanels[0]?.querySelectorAll('.txn-work-rows').length ?? 0) === 0, `${row.name}: a closed summary draws no rows`)
      if (toggle) await mounted.act(() => click(window, toggle))
      await mounted.settle()
      const rows = workPanels[0]?.querySelectorAll('.txn-work-rows .txn-toolcall') ?? []
      report.check(rows.length === tools.length, `${row.name}: the open panel must hold all ${tools.length} tool rows, received ${rows.length}`)
      report.check(rows[0]?.querySelector('.txn-tc-chev') === null, `${row.name}: a ledger row carries no chevron`)
      /* a child left open must not keep the panel open: the head closes and reopens it */
      const firstRowButton = rows[0]?.querySelector('.txn-tc-head')
      if (firstRowButton) await mounted.act(() => click(window, firstRowButton))
      await mounted.settle()
      report.check(!!workPanels[0]?.querySelector('.txn-tcbody'), `${row.name}: opening a child reveals its body`)
      if (toggle) await mounted.act(() => click(window, toggle))
      await mounted.settle()
      report.check((workPanels[0]?.querySelectorAll('.txn-work-rows').length ?? 0) === 0, `${row.name}: the head must close a panel whose child is open`)
      if (toggle) await mounted.act(() => click(window, toggle))
      await mounted.settle()
      report.check((workPanels[0]?.querySelectorAll('.txn-work-rows').length ?? 0) === 1, `${row.name}: the head must reopen it after a close`)
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
      const panel = mounted.container.querySelector('#turn-1 .txn-work')
      const panelToggle = panel?.querySelector('.txn-work-toggle')
      if (panelToggle) await mounted.act(() => click(window, panelToggle))
      await mounted.settle()
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
      const block = article?.querySelector('.txn-modelactions')
      report.check(!!block, `${row.name}: its work must render as one model-actions block`)
      report.check(!!block?.querySelector('.txn-modelactions-head'), `${row.name}: the block names the run`)
      report.check(block?.querySelector('.txn-modelactions-rows') === null, `${row.name}: the block starts closed`)
      const heading = byId(mounted.container, article?.getAttribute('aria-labelledby'))
      report.check(!!heading && heading.classList.contains('txn-turn-heading'), `${row.name}: the article keeps its heading for assistive tech`)
      await mounted.unmount()
    } else if (row.kind === 'model-actions') {
      /* a run of wordless turns shares one quiet block, carried after the run */
      const grouped = {
        ...vm,
        turns: vm.turns.map((t) => (t.index === 4 || t.index === 5 ? { ...t, content: '', displayContent: '' } : t)),
      }
      const mounted = await mountViewer('ledger', { viewModel: grouped })
      const blocks = mounted.container.querySelectorAll('.txn-modelactions')
      report.check(blocks.length === 1, `${row.name}: the run must share one block, received ${blocks.length}`)
      const block = blocks[0]
      report.check(block?.closest('#turn-5') !== null, `${row.name}: the block must sit after the run, on its last turn`)
      report.check(text(block?.querySelector('.txn-modelactions-label')) === 'model actions', `${row.name}: the block must name the run`)
      report.check(block?.querySelector('.txn-modelactions-rows') === null, `${row.name}: the block starts closed`)
      await mounted.act(() => click(window, block.querySelector('.txn-modelactions-head')))
      await mounted.settle()
      const rows = block.querySelectorAll('.txn-modelactions-rows .txn-toolcall')
      report.check(rows.length === 0, `${row.name}: a run with no tools draws no tool rows, received ${rows.length}`)
      const think = block.querySelector('.txn-thinking-toggle')
      report.check(!!think, `${row.name}: the run's thinking comes with it`)
      if (think) await mounted.act(() => click(window, think))
      await mounted.settle()
      report.check(/check the fixture/.test(text(block.querySelector('.txn-thinking-body'))), `${row.name}: the thinking text is the run's own`)
      await mounted.unmount()
    } else if (row.kind === 'thinking') {
      const mounted = await mountViewer('ledger')
      const blockToggle = mounted.container.querySelector('#turn-4 .txn-modelactions-head')
      if (blockToggle) await mounted.act(() => click(window, blockToggle))
      await mounted.settle()
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

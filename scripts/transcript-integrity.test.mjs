#!/usr/bin/env node
/* Gate for the pure integrity view and the cooked turn's source position.
   integrityView decides whether the badge draws and which wire positions are marked; the adapter
   must give every main turn its position in payload.turns so a served position can find its turn.
   Cases: scripts/testdata/transcript-integrity.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-integrity;
   mutations: pnpm test:transcript-integrity:mutations */
import { readFileSync } from 'node:fs'
import { loadFixturePair, assertExactNames, assertFields, withMountedSource, click, keydown, createReport, ROOT } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-integrity.yaml'
const MANIFEST = 'scripts/testdata/transcript-integrity.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  viewCases: 'requiredViewCaseNames',
  adapterCases: 'requiredAdapterCaseNames',
  badgeCases: 'requiredBadgeCaseNames',
  turnCases: 'requiredTurnCaseNames',
  groupCases: 'requiredGroupCaseNames',
  cssCases: 'requiredCssCaseNames',
})
for (const row of fixture.viewCases) assertFields(row, ['name', 'expect'], `${FIXTURE} ${row.name}`, ['integrity', 'malformed', 'transcriptContentHash', 'contentHash'])
for (const row of fixture.badgeCases) assertFields(row, ['name', 'kind'], `${FIXTURE} ${row.name}`, ['props'])
for (const row of fixture.turnCases) assertFields(row, ['name', 'turn', 'presentation', 'flagged'], `${FIXTURE} ${row.name}`, ['markWithin', 'headingTail', 'noMark'])
for (const row of fixture.groupCases) assertFields(row, ['name', 'flaggedTurns', 'expect'], `${FIXTURE} ${row.name}`)
for (const row of fixture.cssCases) assertFields(row, ['name', 'selector', 'includes'], `${FIXTURE} ${row.name}`)
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
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
const byId = (container, id) => (id ? [...container.querySelectorAll('[id]')].find((node) => node.id === id) ?? null : null)
/* the stylesheet is read as text, so a production mutation of it is applied here, as the vite transform does for modules */
const MUTATION = process.env.FAIRTRADE_PARTS_MUTATION ? JSON.parse(process.env.FAIRTRADE_PARTS_MUTATION) : null
const CSS_SOURCE = (() => {
  const source = readFileSync(`${ROOT}/src/index.css`, 'utf8')
  return MUTATION?.file === 'src/index.css' ? source.replace(MUTATION.find, MUTATION.replace) : source
})()
/** The declaration text of the first rule whose selector is exactly `selector`. */
function ruleBody(selector) {
  const start = CSS_SOURCE.search(new RegExp(`^[ \\t]*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`, 'm'))
  if (start === -1) return null
  const open = CSS_SOURCE.indexOf('{', start)
  return CSS_SOURCE.slice(open + 1, CSS_SOURCE.indexOf('}', open))
}
for (const row of fixture.cssCases) {
  const body = ruleBody(row.selector)
  report.check(body !== null, `${row.name}: the rule ${row.selector} must exist`)
  for (const part of row.includes) report.check(body !== null && body.includes(part), `${row.name}: ${row.selector} must declare ${part}`)
}

await withMountedSource(async (ctx) => {
  const { load } = ctx
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

  const { default: IntegrityBadge } = await load('/src/ui/transcript/IntegrityBadge.jsx')
  const { default: TurnCard } = await load('/src/ui/transcript/TurnCard.jsx')
  const { ModelActions } = await load('/src/ui/transcript/WorkGroup.jsx')
  const { mount, window, React } = ctx
  const h = React.createElement

  for (const row of fixture.badgeCases) {
    const props = { ...(row.props ?? {}) }
    const mounted = await mount(h('div', null, h(IntegrityBadge, props), h('button', { type: 'button', id: 'outside' }, 'outside')))
    const root = mounted.container.querySelector('.txn-integrity')
    const badge = root?.querySelector('button.txn-integrity-badge')
    const panel = root?.querySelector('.txn-integrity-panel')
    const label = `${row.name}`
    report.check(!!root && !!badge && !!panel, `${label}: the badge button and the panel must both render`)
    if (!root || !badge || !panel) { await mounted.unmount(); continue }
    if (row.kind === 'structure') {
      report.check([...root.children].map((n) => n.className.split(' ')[0]).join(',') === 'txn-integrity-badge,txn-integrity-panel,txn-sr', `${label}: DOM order must be badge, panel, status`)
      report.check(root.querySelectorAll('button').length === 1, `${label}: the badge is the one control, with no separate help button`)
      report.check(badge.getAttribute('type') === 'button' && badge.getAttribute('aria-label') === INTEGRITY_COPY.helpName && badge.getAttribute('title') === INTEGRITY_COPY.helpName, `${label}: the badge is a button named by helpName`)
      const parts = [...badge.children].map((n) => (n.tagName.toLowerCase() === 'svg' ? `svg:${n.getAttribute('aria-hidden')}` : `${n.className}:${text(n)}`))
      const expectedParts = ['svg:true', `txn-integrity-label:${INTEGRITY_COPY.badgeLabel}`, 'svg:true']
      report.check(show(parts) === show(expectedParts), `${label}: the badge reads warning glyph, label, help glyph, received ${show(parts)}`)
      report.check(badge.firstElementChild?.classList.contains('txn-integrity-warn') && badge.lastElementChild?.classList.contains('txn-integrity-q'), `${label}: the warning glyph leads and the help glyph follows`)
      report.check(INTEGRITY_COPY.helpName.toLowerCase().includes(INTEGRITY_COPY.badgeLabel.toLowerCase()), `${label}: the accessible name contains the visible label`)
      report.check(badge.getAttribute('aria-expanded') === 'false', `${label}: the badge starts closed`)
      report.check(byId(mounted.container, badge.getAttribute('aria-controls')) === panel && panel.hidden, `${label}: aria-controls resolves to the hidden panel`)
      report.check(panel.classList.contains('menu-pop') && panel.classList.contains('menu-float') && panel.getAttribute('data-align') === 'end' && panel.getAttribute('role') === 'region', `${label}: the panel is the shared floating menu surface, a region`)
      report.check(byId(mounted.container, panel.getAttribute('aria-labelledby')) === panel.querySelector('h2'), `${label}: the region is named by its heading`)
      const status = root.querySelector('[role="status"]')
      report.check(status === root.lastElementChild && text(status) === '', `${label}: the visually hidden status is the last child and is empty on first paint`)
      await mounted.settle(150)
      report.check(text(status) === INTEGRITY_COPY.statusText, `${label}: the status reads statusText once the badge has settled`)
    } else if (row.kind === 'toggle') {
      const before = window.document.activeElement
      await mounted.act(() => click(window, badge))
      report.check(badge.getAttribute('aria-expanded') === 'true' && !panel.hidden, `${label}: a click opens the panel`)
      report.check(window.document.activeElement === before, `${label}: opening never moves focus`)
      await mounted.act(() => click(window, badge))
      report.check(badge.getAttribute('aria-expanded') === 'false' && panel.hidden, `${label}: a second click closes it`)
    } else if (row.kind === 'hover') {
      for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'focusin']) {
        await mounted.act(() => { badge.dispatchEvent(new window.Event(type, { bubbles: true })) })
      }
      badge.focus()
      await mounted.settle(50)
      report.check(panel.hidden && badge.getAttribute('aria-expanded') === 'false', `${label}: hover and focus open nothing`)
    } else if (row.kind === 'escape-button') {
      badge.focus()
      await mounted.act(() => click(window, badge))
      await mounted.act(() => keydown(window, badge, 'Escape'))
      report.check(panel.hidden && badge.getAttribute('aria-expanded') === 'false', `${label}: Escape on the badge closes the panel`)
      report.check(window.document.activeElement === badge, `${label}: focus stays on the badge`)
    } else if (row.kind === 'escape-panel') {
      await mounted.act(() => click(window, badge))
      /* the panel holds no control, so the test makes its heading focusable to put focus inside */
      const heading = panel.querySelector('h2')
      heading.setAttribute('tabindex', '-1')
      heading.focus()
      await mounted.act(() => keydown(window, heading, 'Escape'))
      report.check(panel.hidden, `${label}: Escape inside the panel closes it`)
      report.check(window.document.activeElement === badge, `${label}: focus returns to the badge`)
    } else if (row.kind === 'outside-pointer') {
      const outside = mounted.container.querySelector('#outside')
      outside.focus()
      await mounted.act(() => click(window, badge))
      await mounted.act(() => { panel.dispatchEvent(new window.Event('pointerdown', { bubbles: true })) })
      report.check(!panel.hidden, `${label}: a pointer down inside the panel keeps it open`)
      await mounted.act(() => { outside.dispatchEvent(new window.Event('pointerdown', { bubbles: true })) })
      report.check(panel.hidden, `${label}: a pointer down outside closes the panel`)
      report.check(window.document.activeElement === outside, `${label}: closing from outside does not move focus`)
    } else if (row.kind === 'panel-order') {
      const parts = [...panel.children].map((n) => `${n.tagName.toLowerCase()}:${text(n)}`)
      const expected = [`h2:${INTEGRITY_COPY.panelHeading}`, `p:${INTEGRITY_COPY.panelBody}`, `p:${INTEGRITY_COPY.panelOtherTools}`]
      report.check(show(parts) === show(expected), `${label}: panel order must be ${show(expected)}, received ${show(parts)}`)
      report.check(root.querySelector('a') === null, `${label}: the panel carries no link, even when a host passes one`)
    } else if (row.kind === 'heading-level') {
      const heading = panel.querySelector(`h${props.headingLevel}`)
      report.check(!!heading && byId(mounted.container, panel.getAttribute('aria-labelledby')) === heading, `${label}: the panel heading is an h${props.headingLevel} that names the region`)
    } else throw new Error(`${FIXTURE} ${row.name}: unknown badge kind ${row.kind}`)
    await mounted.unmount()
  }

  const turnVm = adaptTranscript(fixture.turnPayload)
  const turnOf = (index) => {
    const found = turnVm.turns.find((t) => t.index === index)
    if (!found) throw new Error(`${FIXTURE}: the turn payload must cook turn ${index}`)
    return found
  }
  for (const row of fixture.turnCases) {
    const mounted = await mount(h(TurnCard, { turn: turnOf(row.turn), presentation: row.presentation, flagged: row.flagged, headingLevel: 3 }))
    const article = mounted.container.querySelector('article')
    const marks = mounted.container.querySelectorAll('.txn-integrity-mark')
    report.check(article?.classList.contains('is-flagged') === row.flagged, `${row.name}: the article ${row.flagged ? 'must' : 'must not'} carry is-flagged`)
    const heading = mounted.container.querySelector('.txn-turn-heading')
    const tail = heading?.querySelector('.txn-sr')
    if (row.flagged) {
      report.check(text(tail) === INTEGRITY_COPY.turnName.trim() || text(tail) === INTEGRITY_COPY.turnName, `${row.name}: the heading must end with the hidden turnName`)
      report.check(heading?.textContent.endsWith(INTEGRITY_COPY.turnName), `${row.name}: the heading text must end with turnName, received ${show(heading?.textContent)}`)
      report.check(marks.length === 1, `${row.name}: exactly one visible mark, received ${marks.length}`)
      const mark = marks[0]
      report.check(mark?.getAttribute('aria-hidden') === 'true' && text(mark) === INTEGRITY_COPY.turnMark && mark.querySelector('svg')?.getAttribute('aria-hidden') === 'true', `${row.name}: the mark is aria-hidden and reads turnMark`)
      report.check(!!mark && !!mounted.container.querySelector(row.markWithin)?.contains(mark), `${row.name}: the mark must sit inside ${row.markWithin}`)
      if (row.markWithin.includes('.txn-turnwork')) report.check(mark?.parentElement?.firstElementChild === mark, `${row.name}: the mark leads its work block`)
    } else {
      report.check(marks.length === 0 && tail === null, `${row.name}: an unflagged turn draws no mark and no hidden tail`)
    }
    await mounted.unmount()
  }

  for (const row of fixture.groupCases) {
    const turns = [turnOf(1), turnOf(3)]
    const positions = new Set(row.flaggedTurns.map((i) => turnOf(i).sourcePosition))
    const mounted = await mount(h(ModelActions, { turns, flaggedPositions: positions }))
    const rows = [...mounted.container.querySelectorAll('.txn-modelactions-turn')]
    const flaggedRows = rows.filter((r) => r.classList.contains('is-flagged'))
    report.check(flaggedRows.length === row.expect.flaggedRows, `${row.name}: flagged rows must be ${row.expect.flaggedRows}, received ${flaggedRows.length}`)
    report.check(flaggedRows.every((r) => r.firstElementChild?.classList.contains('txn-integrity-mark') && text(r.firstElementChild) === INTEGRITY_COPY.turnMark), `${row.name}: a flagged row leads with the mark`)
    const summaryMark = mounted.container.querySelector('.txn-modelactions-head .txn-integrity-mark')
    const wantGroupMark = row.expect.groupMark ? INTEGRITY_COPY.groupMark : null
    report.check((summaryMark ? text(summaryMark) : null) === wantGroupMark, `${row.name}: the summary mark must read ${show(wantGroupMark)}, received ${show(summaryMark ? text(summaryMark) : null)}`)
    if (row.expect.groupMark) {
      const head = mounted.container.querySelector('.txn-modelactions-head')
      await mounted.act(() => click(window, head))
      report.check(head.getAttribute('aria-expanded') === 'false' && !!head.querySelector('.txn-integrity-mark'), `${row.name}: the group mark stays visible while the group is collapsed`)
    }
    await mounted.unmount()
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

#!/usr/bin/env node
/* Mounted-source gate for the integrity props of the transcript viewer. Every case mounts the
   REAL viewer (adaptTranscript -> TranscriptViewer) through vite and asserts which integrity
   controls reach the DOM: the badge on the title's line (the one control, which opens its panel,
   and never in the header's actions row; a condensed header folds it away with the title), the hidden
   status line, the marks on the listed turns and the work group, and nothing at all for an absent
   or malformed value. The interaction rows drive the badge with a pointer and the keyboard. Every
   string is read from INTEGRITY_COPY, so rewording a value there needs no edit here.
   Cases: scripts/testdata/transcript-integrity-viewer.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-integrity-viewer;
   mutations: pnpm test:transcript-integrity-viewer:mutations */
import { readFileSync } from 'node:fs'
import { loadFixturePair, assertExactNames, assertFields, withMountedSource, click, keydown, createReport, ROOT } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-integrity-viewer.yaml'
const MANIFEST = 'scripts/testdata/transcript-integrity-viewer.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  cases: 'requiredCaseNames',
  outlineCases: 'requiredOutlineCaseNames',
  interactions: 'requiredInteractionNames',
})
if (fixture.foldedProseCase?.name !== manifest.requiredFoldedProseCaseName) throw new Error(`${FIXTURE}: foldedProseCase must be named ${JSON.stringify(manifest.requiredFoldedProseCaseName)}`)
if (fixture.thinkingCase?.name !== manifest.requiredThinkingCaseName) throw new Error(`${FIXTURE}: thinkingCase must be named ${JSON.stringify(manifest.requiredThinkingCaseName)}`)

/* a name alone does not protect a meaning: every row's kind is pinned by name too. */
function assertKindMap(rows, required, label) {
  const expected = required ?? {}
  for (const row of rows) {
    if (!(row.name in expected)) throw new Error(`${label}: ${JSON.stringify(row.name)} has no required kind`)
    if (row.kind !== expected[row.name]) throw new Error(`${label}: ${JSON.stringify(row.name)} must run kind ${JSON.stringify(expected[row.name])}, received ${JSON.stringify(row.kind)}`)
  }
  assertExactNames(rows.map((row) => row.name), Object.keys(expected), `${label} kinds`)
}
assertKindMap(fixture.cases, manifest.requiredCaseKinds, FIXTURE)
assertKindMap(fixture.interactions, manifest.requiredInteractionKinds, FIXTURE)

/* the stylesheet is read as text, so a production mutation of it is applied here, as the vite transform does for modules */
const MUTATION = process.env.FAIRTRADE_PARTS_MUTATION ? JSON.parse(process.env.FAIRTRADE_PARTS_MUTATION) : null
const CSS_SOURCE = (() => {
  const source = readFileSync(`${ROOT}/src/index.css`, 'utf8')
  return MUTATION?.file === 'src/index.css' ? source.replace(MUTATION.find, MUTATION.replace) : source
})()
/** The selectors of every rule in the integrity block that draws a dashed edge. */
function outlineSelectors() {
  const start = CSS_SOURCE.indexOf('/* ---- integrity flag')
  if (start === -1) throw new Error('index.css: the integrity block must exist')
  const block = CSS_SOURCE.slice(start)
  const selectors = []
  for (const match of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!match[2].includes('dashed')) continue
    for (const part of match[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',')) selectors.push(part.trim())
  }
  if (selectors.length === 0) throw new Error('index.css: the integrity block must declare a dashed outline')
  return selectors
}

const CONTROL_NAMES = ['badge', 'badge-shown', 'panel', 'status-text', 'mark-1', 'mark-2', 'mark-3', 'mark-4', 'mark-7', 'group-row-2', 'group-head', 'earlier-mark']
for (const row of fixture.cases) {
  assertFields(row, ['name', 'kind', 'props', 'present', 'absent'], `${FIXTURE} ${row.name}`)
  assertExactNames([...row.present, ...row.absent], CONTROL_NAMES, `${FIXTURE} ${row.name} controls`)
}
for (const row of fixture.outlineCases) assertFields(row, ['name', 'kind', 'flagged', 'outlines'], `${FIXTURE} ${row.name}`)
for (const row of fixture.interactions) assertFields(row, ['name', 'kind'], `${FIXTURE} ${row.name}`)

const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: true, canChangeVisibility: false, canExport: true }
const FILTERS = {
  categories: { prompts: true, responses: true, thinking: true, toolcalls: true },
  toolGroups: { edits: true, bash: true, read: true, search: true, fetch: true, tasks: true, other: true },
  tags: { errors: false, retries: false, revert: false },
  views: { hidden: false, expandAll: false, compact: false },
  checkpoint: 'all',
}
const SERVED_HASH = 'sha256:served'
const OTHER_HASH = 'sha256:other'

const report = createReport('transcript integrity viewer')
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
const byId = (container, id) => (id ? [...container.querySelectorAll('[id]')].find((node) => node.id === id) ?? null : null)

const SETTLE_MS = 150 /* past the badge's announce delay */

await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const { INTEGRITY_COPY } = await load('/src/ui/transcript/integrity.js')
  const vm = adaptTranscript(fixture.payload)
  const positions = vm.turns.map((turn) => [turn.index, turn.sourcePosition])
  if (JSON.stringify(positions) !== JSON.stringify([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [7, 7]])) {
    throw new Error(`${FIXTURE}: the payload must cook to seven main turns at positions 0 to 5 and 7, received ${JSON.stringify(positions)}`)
  }
  if (!vm.earlierHistory?.[0]?.id) throw new Error(`${FIXTURE}: the payload must cook one earlier-history section`)
  const earlierOpen = { [vm.earlierHistory[0].id]: true }

  const articleOf = (container, index) => container.querySelector(`#turn-${index}`)
  const flaggedName = (article) => {
    const heading = article?.getAttribute('aria-labelledby') ? [...article.querySelectorAll('[id]')].find((node) => node.id === article.getAttribute('aria-labelledby')) : null
    return (heading?.textContent ?? '').endsWith(INTEGRITY_COPY.turnName)
  }
  const CONTROLS = {
    'badge': (root) => {
      /* on the title's line: the title, then the badge, inside the header's details; never in the actions row */
      const badge = root.querySelector('.txn-header .txn-header-details > .txn-title-row > .txn-title + .txn-integrity:last-child > button.txn-integrity-badge')
      const ok = badge && root.querySelector('.txn-header .txn-actions .txn-integrity') === null && root.querySelectorAll('.txn-integrity').length === 1 && badge.closest('.txn-integrity').querySelectorAll('button').length === 1 && badge.getAttribute('aria-label') === INTEGRITY_COPY.helpName && badge.getAttribute('aria-expanded') === 'false' && text(badge) === INTEGRITY_COPY.badgeLabel
      return ok ? badge : null
    },
    'badge-shown': (root) => {
      const badge = CONTROLS.badge(root)
      return badge && !badge.closest('[inert], [aria-hidden="true"], [hidden]') ? badge : null
    },
    'panel': (root) => {
      const panel = root.querySelector('.txn-integrity-panel')
      return panel && !panel.hidden ? panel : null
    },
    'status-text': (root) => {
      const status = root.querySelector('.txn-integrity .txn-sr[role="status"]')
      return status && text(status) !== '' ? status : null
    },
    'group-row-2': (root) => [...root.querySelectorAll('.txn-modelactions-turn.is-flagged')].find((row) => /pnpm test|bash/i.test(row.textContent)) ?? null,
    'group-head': (root) => root.querySelector('.txn-modelactions-head .txn-integrity-mark'),
    'earlier-mark': (root) => root.querySelector('.txn-earlier .txn-integrity-mark'),
  }
  for (const index of [1, 2, 3, 4, 7]) {
    CONTROLS[`mark-${index}`] = (root) => {
      const article = articleOf(root, index)
      const mark = article?.querySelector('.txn-integrity-mark')
      return mark && flaggedName(article) ? mark : null
    }
  }

  /* the stream reports a long scroll and moves past the sticky threshold, so the header condenses */
  async function condense(mounted) {
    const stream = mounted.container.querySelector('.txn-stream')
    Object.defineProperty(stream, 'scrollHeight', { configurable: true, get: () => 6000 })
    Object.defineProperty(stream, 'clientHeight', { configurable: true, get: () => 400 })
    await mounted.act(() => {
      stream.scrollTop = 240
      stream.dispatchEvent(new window.Event('scroll', { bubbles: false }))
    })
  }

  async function mountViewer(props = {}, { condensed = false } = {}) {
    const { hashes, integrity, toolcalls, ...rest } = props
    const filters = toolcalls === false ? { ...FILTERS, categories: { ...FILTERS.categories, toolcalls: false } } : undefined
    const viewerProps = {
      viewModel: vm,
      capabilities: CAPABILITIES,
      presentation: 'ledger',
      earlierHistoryOpen: earlierOpen,
      ...(integrity !== undefined ? { integrity } : {}),
      ...(hashes ? { transcriptContentHash: SERVED_HASH, contentHash: hashes === 'same' ? SERVED_HASH : OTHER_HASH } : {}),
      ...(filters ? { filters } : {}),
      ...rest,
    }
    const mounted = await mount(React.createElement(TranscriptViewer, viewerProps))
    if (condensed) await condense(mounted)
    await mounted.settle(SETTLE_MS)
    return mounted
  }
  const viewerElement = (props) => React.createElement(TranscriptViewer, { viewModel: vm, capabilities: CAPABILITIES, presentation: 'ledger', earlierHistoryOpen: earlierOpen, ...props })

  for (const row of fixture.cases) {
    const { condensed, zen, presentation, ...props } = row.props
    const mounted = await mountViewer({ ...props, ...(zen ? { zen } : {}), presentation: row.kind }, { condensed })
    if (condensed) report.check(!!mounted.container.querySelector('.txn-app-condensed'), `${row.name}: the fixture must condense the header`)
    for (const name of row.present) report.check(!!CONTROLS[name](mounted.container), `${row.name}: ${name} must be present`)
    for (const name of row.absent) report.check(!CONTROLS[name](mounted.container), `${row.name}: ${name} must be absent`)
    await mounted.unmount()
  }

  /* the outline: the rule's own selectors, run against the mounted viewer */
  const selectors = outlineSelectors()
  for (const row of fixture.outlineCases) {
    const mounted = await mountViewer({ integrity: { flagged_turns: row.flagged }, hashes: 'same', presentation: row.kind })
    const edges = new Set()
    for (const selector of selectors) for (const node of mounted.container.querySelectorAll(selector)) edges.add(node)
    report.check(edges.size === row.outlines, `${row.name}: expected ${row.outlines} outlined elements, received ${edges.size} (${[...edges].map((node) => node.className).join(' | ')})`)
    await mounted.unmount()
  }

  {
    const { name, payload, flagged, outlines } = fixture.foldedProseCase
    const foldedVm = adaptTranscript(payload)
    const mounted = await mount(React.createElement(TranscriptViewer, { viewModel: foldedVm, capabilities: CAPABILITIES, presentation: 'ledger', integrity: { flagged_turns: flagged }, transcriptContentHash: SERVED_HASH, contentHash: SERVED_HASH }))
    await mounted.settle(SETTLE_MS)
    report.check(!!mounted.container.querySelector('#turn-1 .txn-modelactions'), `${name}: the fixture must fold turn 2's action into turn 1's group`)
    const edges = new Set()
    for (const selector of selectors) for (const node of mounted.container.querySelectorAll(selector)) edges.add(node)
    report.check(edges.size === outlines, `${name}: expected ${outlines} outlined elements, received ${edges.size} (${[...edges].map((node) => node.className).join(' | ')})`)
    await mounted.unmount()
  }

  {
    const { name, payload, flagged, group, row } = fixture.thinkingCase
    const thinkingVm = adaptTranscript(payload)
    const mounted = await mount(React.createElement(TranscriptViewer, { viewModel: thinkingVm, capabilities: CAPABILITIES, presentation: 'ledger', integrity: { flagged_turns: flagged }, transcriptContentHash: SERVED_HASH, contentHash: SERVED_HASH }))
    await mounted.settle(SETTLE_MS)
    const owner = mounted.container.querySelector(`#turn-${group}`)
    const bare = owner?.querySelector('.txn-modelactions-bare')
    report.check(!!bare, `${name}: the fixture must fold turn ${row} into a thinking-only group`)
    const rowNode = bare?.querySelector('.txn-modelactions-turn.is-flagged')
    report.check(!!rowNode?.querySelector('.txn-integrity-mark'), `${name}: the flagged turn's thinking must lead with a mark`)
    const thinkingMark = rowNode?.querySelector('.txn-integrity-mark')
    report.check(!!thinkingMark && text(thinkingMark) === INTEGRITY_COPY.turnMark && thinkingMark.getAttribute('aria-hidden') !== 'true', `${name}: the mark must be readable, not hidden`)
    await mounted.unmount()
  }

  const FLAGGED = { integrity: { flagged_turns: [1, 3] }, transcriptContentHash: SERVED_HASH, contentHash: SERVED_HASH }
  const helpOf = (container) => container.querySelector('.txn-integrity > button.txn-integrity-badge')
  const panelOf = (container) => container.querySelector('.txn-integrity .txn-integrity-panel')

  for (const row of fixture.interactions) {
   try {
    if (row.kind === 'help-click') {
      const mounted = await mount(viewerElement(FLAGGED))
      await mounted.settle(SETTLE_MS)
      const help = helpOf(mounted.container)
      const panel = panelOf(mounted.container)
      report.check(!!help && !!panel && panel.hidden && help.getAttribute('aria-expanded') === 'false', `${row.name}: the panel starts closed`)
      await mounted.act(() => click(window, help))
      report.check(help.getAttribute('aria-expanded') === 'true' && !panel.hidden, `${row.name}: a click opens the panel`)
      await mounted.act(() => click(window, help))
      report.check(help.getAttribute('aria-expanded') === 'false' && panel.hidden, `${row.name}: a second click hides it`)
      await mounted.unmount()
    } else if (row.kind === 'help-keyboard') {
      const mounted = await mount(viewerElement(FLAGGED))
      await mounted.settle(SETTLE_MS)
      const help = helpOf(mounted.container)
      const panel = panelOf(mounted.container)
      help.focus()
      /* jsdom runs no default action, so Enter and Space reach the button as the click a browser sends */
      await mounted.act(() => { keydown(window, help, 'Enter'); click(window, help) })
      report.check(!panel.hidden, `${row.name}: Enter opens the panel`)
      await mounted.act(() => { keydown(window, help, ' '); click(window, help) })
      report.check(panel.hidden, `${row.name}: Space closes the panel`)
      await mounted.act(() => click(window, help))
      /* the panel holds no control, so the test makes its heading focusable to put focus inside */
      const heading = panel.querySelector('h1, h2, h3, h4, h5, h6')
      heading.setAttribute('tabindex', '-1')
      heading.focus()
      await mounted.act(() => keydown(window, heading, 'Escape'))
      report.check(panel.hidden, `${row.name}: Escape inside the panel hides it`)
      report.check(window.document.activeElement === help, `${row.name}: Escape returns focus to the badge, received ${window.document.activeElement?.tagName}`)
      await mounted.unmount()
    } else if (row.kind === 'escape-outside') {
      const mounted = await mount(viewerElement(FLAGGED))
      await mounted.settle(SETTLE_MS)
      const help = helpOf(mounted.container)
      const panel = panelOf(mounted.container)
      await mounted.act(() => click(window, help))
      const title = mounted.container.querySelector('.txn-title')
      title.setAttribute('tabindex', '-1')
      title.focus()
      report.check(!panel.hidden && window.document.activeElement === title, `${row.name}: the panel is open and focus sits outside the badge`)
      await mounted.act(() => keydown(window, title, 'Escape'))
      report.check(panel.hidden, `${row.name}: Escape with focus outside the badge hides the panel`)
      report.check(window.document.activeElement === help, `${row.name}: focus returns to the badge, received ${window.document.activeElement?.tagName}`)
      await mounted.act(() => keydown(window, title, 'Escape'))
      report.check(panel.hidden && window.document.activeElement === help, `${row.name}: a later Escape changes nothing once closed`)
      await mounted.unmount()
    } else if (row.kind === 'outside-pointer') {
      const mounted = await mount(viewerElement(FLAGGED))
      await mounted.settle(SETTLE_MS)
      const help = helpOf(mounted.container)
      const panel = panelOf(mounted.container)
      await mounted.act(() => click(window, help))
      const title = mounted.container.querySelector('.txn-title')
      title.setAttribute('tabindex', '-1')
      title.focus()
      await mounted.act(() => { title.dispatchEvent(new window.Event('pointerdown', { bubbles: true })) })
      report.check(panel.hidden, `${row.name}: a pointer down on the title hides the panel`)
      report.check(window.document.activeElement === title, `${row.name}: focus stays where it was`)
      await mounted.unmount()
    } else if (row.kind === 'badge-control') {
      const mounted = await mount(viewerElement(FLAGGED))
      await mounted.settle(SETTLE_MS)
      const root = mounted.container.querySelector('.txn-integrity')
      const badge = helpOf(mounted.container)
      const panel = panelOf(mounted.container)
      report.check(!!badge && badge.tagName === 'BUTTON' && badge.getAttribute('aria-label') === INTEGRITY_COPY.helpName && byId(mounted.container, badge.getAttribute('aria-controls')) === panel, `${row.name}: the badge is a button named by helpName that controls the panel`)
      const focusable = [...root.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter((node) => !node.closest('[hidden]'))
      report.check(focusable.length === 1 && focusable[0] === badge, `${row.name}: the badge must be the only focusable element while closed, received ${focusable.length}`)
      for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']) {
        await mounted.act(() => { badge.dispatchEvent(new window.Event(type, { bubbles: true })) })
      }
      await mounted.settle(50)
      report.check(panel.hidden && badge.getAttribute('aria-expanded') === 'false', `${row.name}: hovering the badge opens nothing`)
      await mounted.unmount()
    } else if (row.kind === 'panel-copy') {
      /* the panel reads the same whether or not any turn is marked: heading, body, other tools */
      const expected = [INTEGRITY_COPY.panelHeading, INTEGRITY_COPY.panelBody, INTEGRITY_COPY.panelOtherTools]
      const checkPanel = (panel, label) => {
        const parts = [...(panel?.children ?? [])].map((node) => text(node))
        report.check(JSON.stringify(parts) === JSON.stringify(expected), `${row.name}: ${label} must read ${JSON.stringify(expected)}, received ${JSON.stringify(parts)}`)
      }
      for (const [label, props] of [
        ['a viewer with marked turns', FLAGGED],
        ['a viewer with the badge only', { ...FLAGGED, contentHash: OTHER_HASH }],
        ['a viewer on another tab', { ...FLAGGED, activeTab: 'files' }],
      ]) {
        const mounted = await mount(viewerElement(props))
        await mounted.settle(SETTLE_MS)
        checkPanel(panelOf(mounted.container), label)
        await mounted.unmount()
      }
    } else if (row.kind === 'no-link') {
      /* the panel links nowhere: a host that still passes the old link prop draws no link */
      const mounted = await mount(viewerElement({ ...FLAGGED, integrityHelpHref: 'https://example.test/ignored' }))
      await mounted.settle(SETTLE_MS)
      report.check(mounted.container.querySelector('.txn-integrity a') === null, `${row.name}: the badge and its panel carry no link`)
      await mounted.unmount()
    } else if (row.kind === 'plain-thinking') {
      /* without integrity a thinking-only group is exactly its thinking blocks, as before the props existed */
      const thinkingVm = adaptTranscript(fixture.thinkingCase.payload)
      const mounted = await mount(React.createElement(TranscriptViewer, { viewModel: thinkingVm, capabilities: CAPABILITIES, presentation: 'ledger' }))
      await mounted.settle(SETTLE_MS)
      const bare = mounted.container.querySelector(`#turn-${fixture.thinkingCase.group} .txn-modelactions-bare`)
      report.check(!!bare && bare.children.length > 0, `${row.name}: the fixture must render a thinking-only group`)
      report.check(!!bare && [...bare.children].every((child) => child.classList.contains('txn-thinking')), `${row.name}: the group's children must be the .txn-thinking blocks directly`)
      report.check(mounted.container.querySelector('.txn-modelactions-turn') === null, `${row.name}: no row wrapper without a flag`)
      await mounted.unmount()
    } else if (row.kind === 'late-arrival') {
      const mounted = await mount(viewerElement({}))
      await mounted.settle(SETTLE_MS)
      report.check(mounted.container.querySelector('.txn-integrity') === null, `${row.name}: the fixture starts without a badge`)
      let insertions = 0
      const observer = new window.MutationObserver((records) => {
        for (const record of records) {
          if (record.target.matches?.('.txn-integrity .txn-sr[role="status"]')) insertions += [...record.addedNodes].filter((node) => node.nodeType === 3).length
          else if (record.type === 'characterData' && record.target.parentElement?.matches('.txn-integrity .txn-sr[role="status"]')) insertions += 1
        }
      })
      observer.observe(mounted.container, { childList: true, subtree: true, characterData: true })
      await mounted.rerender(viewerElement(FLAGGED))
      await mounted.settle(SETTLE_MS)
      observer.disconnect()
      report.check(insertions === 1, `${row.name}: the status text must be inserted exactly once, received ${insertions}`)
      const status = mounted.container.querySelector('.txn-integrity .txn-sr[role="status"]')
      report.check(!!status && text(status) === INTEGRITY_COPY.statusText, `${row.name}: status-text must appear and equal statusText`)
      report.check(mounted.container.querySelectorAll('[role="status"]').length >= 1 && mounted.container.querySelectorAll('.txn-integrity .txn-sr[role="status"]').length === 1, `${row.name}: exactly one integrity status line`)
      await mounted.unmount()
    } else if (row.kind === 'status-after-mount') {
      /* the status is inserted after the first paint, so a live region that exists empty reports it */
      const container = window.document.createElement('div')
      window.document.body.appendChild(container)
      const { createRoot } = await import('react-dom/client')
      const { act } = await import('react')
      const root = createRoot(container)
      let atCommit = null
      const observer = new window.MutationObserver(() => {
        const status = container.querySelector('.txn-integrity .txn-sr[role="status"]')
        if (status && atCommit === null) atCommit = text(status)
      })
      observer.observe(container, { childList: true, subtree: true })
      await act(async () => { root.render(viewerElement(FLAGGED)); await new Promise((done) => setTimeout(done, SETTLE_MS)) })
      observer.disconnect()
      report.check(atCommit === '', `${row.name}: the status line must be empty when it first enters the DOM, received ${JSON.stringify(atCommit)}`)
      const status = container.querySelector('.txn-integrity .txn-sr[role="status"]')
      await act(async () => { await new Promise((done) => setTimeout(done, SETTLE_MS)) })
      report.check(text(status) === INTEGRITY_COPY.statusText, `${row.name}: the status line must read statusText after mount`)
      await act(async () => root.unmount())
      container.remove()
    } else if (row.kind === 'fold-closes') {
      /* the stream scrolls under an open panel: the header folds the badge away, and the panel closes with it */
      const mounted = await mount(viewerElement(FLAGGED))
      await mounted.settle(SETTLE_MS)
      const help = helpOf(mounted.container)
      const panel = panelOf(mounted.container)
      await mounted.act(() => click(window, help))
      report.check(!panel.hidden, `${row.name}: the panel is open before the header condenses`)
      await condense(mounted)
      await mounted.settle(SETTLE_MS)
      report.check(!!mounted.container.querySelector('.txn-app-condensed'), `${row.name}: the fixture must condense the header`)
      report.check(panel.hidden && help.getAttribute('aria-expanded') === 'false', `${row.name}: condensing the header closes the open panel`)
      await mounted.unmount()
    } else {
      throw new Error(`${FIXTURE}: unknown interaction kind ${JSON.stringify(row.kind)}`)
    }
   } catch (error) {
    if (String(error?.message).includes('unknown interaction kind')) throw error
    /* a missing control is a named failure of this row, not a crash of the gate */
    report.check(false, `${row.name}: ${error?.message ?? error}`)
   }
  }
})

report.finish(`${fixture.cases.length} control combinations, ${fixture.outlineCases.length} outline cases and ${fixture.interactions.length} interactions.`)

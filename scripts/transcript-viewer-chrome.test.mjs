#!/usr/bin/env node
/* Mounted-source gate for the TranscriptViewer header chrome a host controls: showTail,
   showOutcome, showSearchTrigger, the pullRequests slot, the removed chat-with-trace item and the
   `prompts` meta label. It mounts the REAL viewer (adaptTranscript -> TranscriptViewer) for every
   fixtured combination and asserts each named control is present or absent, then drives the
   search trigger and reads the label for every count case.
   Cases: scripts/testdata/transcript-viewer-chrome.yaml (+ .manifest.yaml).
   Run: pnpm test:transcript-viewer-chrome; mutations: pnpm test:transcript-viewer-chrome:mutations. */
import { loadFixturePair, assertExactNames, assertFields, withMountedSource, click, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-viewer-chrome.yaml'
const MANIFEST = 'scripts/testdata/transcript-viewer-chrome.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, {
  cases: 'requiredCaseNames',
  interactions: 'requiredInteractionNames',
  promptLabels: 'requiredPromptLabelNames',
})
if (fixture.defaultsCase?.name !== manifest.requiredDefaultsCase) throw new Error(`${FIXTURE}: defaultsCase must be named ${JSON.stringify(manifest.requiredDefaultsCase)}`)

/* the closed control set: name -> how a user finds it in the mounted header. */
const CONTROLS = {
  'host-actions': (root) => root.querySelector('.txn-actions [data-host-action]'),
  'share-menu': (root) => [...root.querySelectorAll('.txn-actions .menu-trigger')].find((node) => node.textContent.trim().startsWith('share')),
  'more-menu': (root) => root.querySelector('.txn-actions .menu-trigger[aria-label="more actions"]'),
  'outcome-chip': (root) => root.querySelector('.txn-meta .chip.chip-ok, .txn-meta .chip.chip-warn, .txn-meta .chip.chip-err'),
  'search-trigger': (root) => root.querySelector('.txn-search-trigger'),
  'pull-request-slot': (root) => root.querySelector('.txn-header .txn-prs [data-host-prs]'),
}
const CONTROL_NAMES = Object.keys(CONTROLS)
for (const row of [fixture.defaultsCase, ...fixture.cases]) {
  assertFields(row, ['name', 'present', 'absent'], `${FIXTURE} ${row.name}`, ['props'])
  assertExactNames([...row.present, ...row.absent], CONTROL_NAMES, `${FIXTURE} ${row.name} controls`)
}

const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: true, canChangeVisibility: false, canExport: true }

function payload(extra = {}) {
  return {
    id: 'viewer-chrome',
    harness: 'claude-code',
    startTime: '2026-09-20T10:00:00Z',
    endTime: '2026-09-20T10:42:00Z',
    durationMins: 42,
    totalTokens: 1200,
    tokensIn: 800,
    tokensOut: 400,
    turnCount: 2,
    toolCallCount: 0,
    outcome: 'resolved',
    inputSubmissionCount: 4,
    turns: [
      { index: 0, role: 'user', content: 'the ingest test flakes on CI about 1 in 5 runs', timestamp: '2026-09-20T10:00:00Z', depth: 0 },
      { index: 1, role: 'assistant', content: 'I will run it 50 times to reproduce it.', timestamp: '2026-09-20T10:01:00Z', depth: 0 },
    ],
    ...extra,
  }
}

const report = createReport('transcript viewer chrome')

await withMountedSource(async ({ load, mount, window, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const hostAction = React.createElement('button', { type: 'button', 'data-host-action': '' }, 'publish')
  const hostPrs = React.createElement('ul', { 'data-host-prs': '' }, React.createElement('li', null, 'acme/ingest-api #42'))
  const viewer = (props, extra) => React.createElement(TranscriptViewer, {
    viewModel: adaptTranscript(payload(extra)), capabilities: CAPABILITIES, headerActions: hostAction, ...props,
  })

  const expectControls = (row, container) => {
    for (const name of row.present) report.check(!!CONTROLS[name](container), `${row.name}: ${name} must be present`)
    for (const name of row.absent) report.check(!CONTROLS[name](container), `${row.name}: ${name} must be absent`)
  }

  {
    const mounted = await mount(viewer({}))
    expectControls(fixture.defaultsCase, mounted.container)
    report.check(!mounted.container.querySelector('.txn-tabbar'), `${fixture.defaultsCase.name}: the tab strip must stay unwrapped without the trigger`)
    await mounted.unmount()
  }

  for (const row of fixture.cases) {
    const { pullRequests, ...flags } = row.props
    const mounted = await mount(viewer({ ...flags, pullRequests: pullRequests ? hostPrs : undefined }))
    expectControls(row, mounted.container)
    await mounted.unmount()
  }

  for (const row of fixture.interactions) {
    if (row.kind === 'trigger-click') {
      const mounted = await mount(viewer({ showTail: false, showSearchTrigger: true }))
      const trigger = CONTROLS['search-trigger'](mounted.container)
      report.check(!mounted.container.querySelector('.txn-search'), `${row.name}: the search bar must start closed`)
      if (trigger) await mounted.act(() => click(window, trigger))
      await mounted.settle()
      const input = mounted.container.querySelector('.txn-search .txn-search-input')
      report.check(!!input, row.name)
      report.check(!!input && mounted.document.activeElement === input, `${row.name}: focus must move into the search field`)
      await mounted.unmount()
    } else if (row.kind === 'trigger-name') {
      const mounted = await mount(viewer({ showSearchTrigger: true }))
      const trigger = CONTROLS['search-trigger'](mounted.container)
      const name = trigger?.textContent.replace(/\s+/g, ' ').trim()
      report.check(name === row.expectedName, `${row.name}: expected ${JSON.stringify(row.expectedName)}, received ${JSON.stringify(name)}`)
      report.check(trigger?.getAttribute('aria-keyshortcuts')?.includes('Meta+F'), `${row.name}: aria-keyshortcuts must name Meta+F`)
      await mounted.unmount()
    } else if (row.kind === 'more-menu-items') {
      const mounted = await mount(viewer({ capabilities: row.capabilities, moreOpen: true }))
      const items = [...mounted.container.querySelectorAll('.txn-more-pop .menu-item .menu-text')].map((node) => node.textContent.trim())
      report.check(JSON.stringify(items) === JSON.stringify(row.expectedItems), `${row.name}: expected ${JSON.stringify(row.expectedItems)}, received ${JSON.stringify(items)}`)
      report.check(!mounted.container.textContent.includes('chat with trace'), `${row.name}: chat with trace must not render`)
      await mounted.unmount()
    } else if (row.kind === 'more-menu-absent') {
      const mounted = await mount(viewer({ capabilities: row.capabilities }))
      report.check(!CONTROLS['more-menu'](mounted.container), row.name)
      report.check(!!CONTROLS['share-menu'](mounted.container), `${row.name}: the share menu still renders`)
      await mounted.unmount()
    } else {
      throw new Error(`${FIXTURE}: unknown interaction kind ${JSON.stringify(row.kind)}`)
    }
  }

  for (const row of fixture.promptLabels) {
    const extra = row.absent ? { inputSubmissionCount: undefined } : { inputSubmissionCount: row.value }
    const mounted = await mount(viewer({}, extra))
    const items = [...mounted.container.querySelectorAll('.txn-meta .metaitem')].map((node) => node.textContent.replace(/\s+/g, ' ').trim())
    report.check(items.includes(row.expected), `${row.name}: expected a meta item ${JSON.stringify(row.expected)}, received ${JSON.stringify(items)}`)
    report.check(!items.some((text) => text.includes('input submission')), `${row.name}: the meta row must not say input submissions`)
    await mounted.unmount()
  }
})

report.finish(`${fixture.cases.length + 1} chrome combinations, ${fixture.interactions.length} interactions and ${fixture.promptLabels.length} label cases.`)

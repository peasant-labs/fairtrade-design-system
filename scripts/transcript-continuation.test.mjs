import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'

const { fixture } = loadFixturePair('scripts/testdata/transcript-continuation.yaml', 'scripts/testdata/transcript-continuation.manifest.yaml', { cases: 'requiredCases', assertions: 'requiredAssertions' })
const report = createReport('transcript continuation')
await withMountedSource(async ({ load, mount, window, React }) => {
  globalThis.IntersectionObserver = class {
    constructor(callback) { this.callback = callback }
    observe() { this.callback([{ isIntersecting: true }]) }
    disconnect() {}
  }
  const { default: Viewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { scrubberTicks, regionBoundaries, loadedRegions } = await load('/src/ui/transcript/segments.js')
  const payload = { id: 'preview', harness: 'claude-code', turns: [
    { index: 0, role: 'user', content: 'hello' },
    { index: 1, role: 'assistant', content: 'hello back' },
  ] }
  const vm = adaptTranscript(payload, undefined, undefined, { tail: 'incomplete' })
  report.check(vm.turns.every(turn => !turn.isFinal), 'incomplete tail omits final marker')
  report.check(vm.highlights.find(item => item.id === 'hl-final')?.title === 'latest loaded response', 'incomplete tail names latest response')
  report.check(adaptTranscript(payload).highlights.find(item => item.id === 'hl-final')?.title === 'final response', 'complete tail keeps final response')
  const ref = { index: 0, firstTurn: 0, lastTurn: 1, byteLength: 20, conversationTurns: { before: 0, count: 2 } }
  const directory = { complete: false, segments: [ref] }
  const segments = [{ ...ref, turns: vm.turns }]
  report.check(scrubberTicks(directory)[0].valueText === 'turns 1–2 loaded so far', 'scrubber names loaded prefix')
  report.check(regionBoundaries(directory, loadedRegions(directory, segments)).length === 0, 'open directory has no trailing boundary')
  const caps = { canEdit: false, canLabel: false, canContribute: true, canChangeVisibility: false, canExport: false }
  for (const row of fixture.cases) {
    let calls = 0
    const continuation = { state: row.state, notice: row.notice, onLoadMore: () => { calls++ } }
    const mounted = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: caps, directory, segments, continuation, allowClipboard: false }))
    report.check(calls === 0, `${row.name}: mount fires nothing`)
    const scope = mounted.container.querySelector('[data-transcript-continuation]')
    report.check(mounted.container.textContent.includes(row.label), `${row.name}: position label`)
    report.check(!mounted.container.querySelector('.txn-anchor'), `${row.name}: no turn copy`)
    const button = scope?.querySelector('button')
    if (row.button) {
      report.check(button?.textContent.trim() === row.button, `${row.name}: button label`)
      report.check(button?.disabled === (row.state === 'loading'), `${row.name}: disabled state`)
      await mounted.act(() => { window.dispatchEvent(new window.Event('resize')); mounted.container.querySelector('.txn-stream')?.dispatchEvent(new window.Event('scroll')) })
      report.check(calls === 0, `${row.name}: scroll and resize fire nothing`)
      if (row.state === 'more') {
        await mounted.act(() => click(window, button))
        report.check(calls === 1, `${row.name}: activation requests once`)
      }
    } else {
      report.check(!button && scope?.textContent.includes(row.notice), `${row.name}: notice replaces button`)
    }
    await mounted.unmount()
  }
  const diagramTurns = vm.turns.map(turn => turn.role === 'assistant' ? { ...turn, content: '```mermaid\nflowchart LR\nA --> B\n```' } : turn)
  const diagramSegments = [{ ...ref, turns: diagramTurns }]
  const mounted = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: caps, directory, segments: diagramSegments, continuation: { state: 'more', onLoadMore() {} }, allowClipboard: false }))
  report.check(mounted.container.querySelectorAll('[role=tab]').length >= 5, 'every-tab-stays-with-incomplete-tail')
  report.check(mounted.container.textContent.includes('view diagram') && !mounted.container.textContent.includes('copy source'), 'no-clipboard-in-preview: Mermaid copy hidden')
  const share = [...mounted.container.querySelectorAll('button')].find(button => button.textContent.trim().startsWith('share'))
  if (share) await mounted.act(() => click(window, share))
  report.check(!mounted.container.textContent.includes('copy link'), 'no-clipboard-in-preview: share copy hidden')
  await mounted.unmount()
  const complete = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: caps, directory: { ...directory, complete: true, totalSegments: 1, totalTurns: 2 }, segments, continuation: { state: 'end' }, activeTab: 'highlights' }))
  report.check(complete.container.textContent.includes('final response'), 'complete-tail-keeps-final-response: segment highlights')
  await complete.unmount()
  const legacy = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: caps }))
  report.check(!legacy.container.querySelector('[data-transcript-continuation]') && !!legacy.container.querySelector('.txn-anchor'), 'no-continuation-prop-is-unchanged')
  await legacy.unmount()
})
report.finish('manual continuation, open directory, and tail')

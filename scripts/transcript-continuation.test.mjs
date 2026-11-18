import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'

const { fixture } = loadFixturePair('scripts/testdata/transcript-continuation.yaml', 'scripts/testdata/transcript-continuation.manifest.yaml', { cases: 'requiredCases', assertions: 'requiredAssertions' })
const report = createReport('transcript continuation')
const observed = new Set()
const check = (name, passed) => { observed.add(name); report.check(passed, name) }
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
    { index: 0, role: 'user', depth: 0, entryType: 'text', content: 'hello' },
    { index: 1, role: 'assistant', depth: 0, entryType: 'text', content: 'hello back' },
  ] }
  const vm = adaptTranscript(payload, undefined, undefined, { tail: 'incomplete' })
  check('incomplete-tail-has-no-final-marker', vm.turns.every(turn => !Object.hasOwn(turn, 'isFinal')))
  check('incomplete-tail-names-latest-loaded-response', vm.highlights.find(item => item.id === 'hl-final')?.title === 'latest loaded response')
  check('complete-tail-keeps-final-response', adaptTranscript(payload).highlights.find(item => item.id === 'hl-final')?.title === 'final response')
  const ref = { index: 0, firstTurn: 0, lastTurn: 1, byteLength: 20, conversationTurns: { before: 0, count: 2 } }
  const directory = { complete: false, segments: [ref] }
  const segments = [{ ...ref, turns: vm.turns }]
  report.check(scrubberTicks(directory)[0].valueText === 'turns 1–2 loaded so far', 'scrubber names loaded prefix')
  check('open-directory-draws-no-trailing-segment-boundary', regionBoundaries(directory, loadedRegions(directory, segments)).length === 0)
  const manyRefs = Array.from({ length: 240 }, (_, index) => ({ index, firstTurn: index, lastTurn: index, byteLength: 1 }))
  const ticks = scrubberTicks({ complete: false, totalSegments: 999, segments: manyRefs })
  check('open-directory-scrubber-samples-loaded-refs', ticks.length === 200 && ticks.every(tick => manyRefs.some(ref => ref.index === tick.index)) && ticks.at(-1).index === 239)
  const fortyEightTurns = Array.from({ length: fixture.loadedRange.count }, (_, index) => ({ ...vm.turns[index % 2], index, identity: `main:${index}`, label: String(index + 1) }))
  const fortyEightRef = { ...ref, lastTurn: 47, conversationTurns: { before: 0, count: 48 } }
  const range = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: {}, directory: { complete: false, segments: [fortyEightRef] }, segments: [{ ...fortyEightRef, turns: fortyEightTurns }], continuation: { state: 'more', onLoadMore() {} } }))
  report.check(range.container.querySelector('.txn-trace-count')?.textContent === fixture.loadedRange.caption, 'open-directory-labels-say-loaded-so-far: exact forty-eight range')
  check('open-directory-scope-says-loaded-part', range.container.textContent.includes('in the loaded part of the session'))
  await range.unmount()
  const caps = { canEdit: false, canLabel: false, canContribute: true, canChangeVisibility: false, canExport: false }
  const traceBadge = container => [...container.querySelectorAll('[role=tab]')].find(tab => tab.textContent.includes('full trace'))?.querySelector('.cnt')?.textContent.trim()
  const openBadge = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: caps, directory, segments, continuation: { state: 'more', onLoadMore() {} } }))
  check('trace-tab-counts-loaded-turns-while-open', traceBadge(openBadge.container) === String(fixture.tabCounts.loaded))
  const completedDirectory = { ...directory, complete: true, totalTurns: fixture.tabCounts.total, totalConversationTurns: fixture.tabCounts.total, totalSegments: 1 }
  await openBadge.rerender(React.createElement(Viewer, { viewModel: vm, capabilities: caps, directory: completedDirectory, segments, continuation: { state: 'end' } }))
  check('trace-tab-count-agrees-with-header-when-complete', traceBadge(openBadge.container) === String(fixture.tabCounts.total) && openBadge.container.querySelector('.txn-trace-count')?.textContent.trim() === `${fixture.tabCounts.total} turns`)
  await openBadge.unmount()
  const wholeBadge = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: caps }))
  check('whole-payload-trace-tab-count-unchanged', traceBadge(wholeBadge.container) === String(fixture.tabCounts.loaded))
  await wholeBadge.unmount()
  for (const row of fixture.cases) {
    let calls = 0
    const continuation = { state: row.state, notice: row.notice, onLoadMore: () => { calls++ } }
    const caseDirectory = row.complete ? { ...directory, complete: true, totalSegments: 1, totalTurns: 2, totalConversationTurns: 2 } : directory
    const mounted = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: caps, directory: caseDirectory, segments, continuation, allowClipboard: false }))
    report.check(calls === 0, `${row.name}: mount fires nothing`)
    if (row.state === 'more') check('mount-fires-nothing', calls === 0)
    const scope = mounted.container.querySelector('[data-transcript-continuation]')
    if (row.state === 'end' || row.state === 'cut') {
      const name = row.state === 'end' ? 'ended-directory-drops-loaded-so-far' : 'cut-directory-drops-loaded-so-far'
      check(name, mounted.container.querySelector('.txn-trace-count')?.textContent.trim() === row.label && !mounted.container.textContent.includes('loaded so far') && scrubberTicks(caseDirectory)[0].valueText === 'turns 1–2 of 2')
    }
    report.check(mounted.container.textContent.includes(row.label), `${row.name}: position label`)
    report.check(!mounted.container.querySelector('.txn-anchor'), `${row.name}: no turn copy`)
    const button = scope?.querySelector('button')
    if (row.button) {
      report.check(button?.textContent.trim() === row.button, `${row.name}: button label`)
      report.check(button?.disabled === (row.state === 'loading'), `${row.name}: disabled state`)
      await mounted.act(() => { window.dispatchEvent(new window.Event('resize')) })
      if (row.state === 'more') check('resize-fires-nothing', calls === 0)
      await mounted.act(() => { const stream = mounted.container.querySelector('.txn-stream'); stream.scrollTop = stream.scrollHeight; stream.dispatchEvent(new window.Event('scroll')) })
      if (row.state === 'more') check('reaching-the-end-fires-nothing', calls === 0)
      report.check(calls === 0, `${row.name}: scroll and resize fire nothing`)
      if (row.state === 'more') {
        check('more-draws-load-control', !!button && button.getAttribute('aria-label') === 'load more of this session')
        check('load-more-by-keyboard', button.tagName === 'BUTTON' && button.type === 'button' && !button.disabled)
        await mounted.act(() => click(window, button))
        check('one-activation-fires-one-load', calls === 1)
        check('load-more-fires-only-on-activation', calls === 1)
      }
    } else {
      report.check(!button && scope?.textContent.includes(row.notice), `${row.name}: notice replaces button`)
    }
    await mounted.unmount()
  }
  const diagramTurns = vm.turns.map(turn => turn.role === 'assistant' ? { ...turn, content: '```mermaid\nflowchart LR\nA --> B\n```' } : turn)
  const diagramSegments = [{ ...ref, turns: diagramTurns }]
  const mounted = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: caps, directory, segments: diagramSegments, continuation: { state: 'more', onLoadMore() {} }, allowClipboard: false }))
  check('every-tab-stays-with-incomplete-tail', mounted.container.querySelectorAll('[role=tab]').length >= 5)
  const noMermaidCopy = mounted.container.textContent.includes('view diagram') && !mounted.container.textContent.includes('copy source')
  const share = [...mounted.container.querySelectorAll('button')].find(button => button.textContent.trim().startsWith('share'))
  if (share) await mounted.act(() => click(window, share))
  check('no-clipboard-in-preview', noMermaidCopy && !mounted.container.textContent.includes('copy link') && !mounted.container.querySelector('.txn-anchor'))
  await mounted.unmount()
  const complete = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: caps, directory: { ...directory, complete: true, totalSegments: 1, totalTurns: 2 }, segments, continuation: { state: 'end' }, activeTab: 'highlights' }))
  report.check(complete.container.textContent.includes('final response'), 'complete-tail-keeps-final-response: segment highlights')
  await complete.unmount()
  const completeDir = { ...directory, complete: true, totalSegments: 1, totalTurns: 2, totalConversationTurns: 2 }
  check('complete-directory-labels-say-of-total', scrubberTicks(completeDir)[0].valueText === 'turns 1–2 of 2')
  const retained = [{ ...segments[0], hasNewer: true }]
  const noTrailingBoundary = regionBoundaries(completeDir, loadedRegions(completeDir, retained)).length === 0
  check('complete-directory-is-unchanged', scrubberTicks({ ...completeDir, complete: undefined })[0].valueText === scrubberTicks(completeDir)[0].valueText)
  let loads = 0
  const props = { viewModel: vm, capabilities: caps, directory, segments: [{ ...segments[0], hasNewer: true }], continuation: { state: 'more', onLoadMore: () => { loads++ } } }
  const transition = await mount(React.createElement(Viewer, props))
  check('short-segment-draws-like-any-segment', transition.container.querySelectorAll('[data-turn-index]').length > 0 || transition.container.textContent.includes('hello back'))
  const finalProps = { ...props, directory: completeDir, continuation: { state: 'end', notice: 'session ended' } }
  await transition.rerender(React.createElement(Viewer, finalProps))
  check('complete-is-authoritative-over-last-has-newer', noTrailingBoundary && !transition.container.querySelector('[data-segment-boundary="newer"]'))
  check('final-frame-without-segment-ends-the-load-control', loads === 0 && !transition.container.querySelector('[data-transcript-continuation] button') && transition.container.querySelector('[data-transcript-continuation]')?.textContent.includes('session ended'))
  await transition.unmount()
  const legacy = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: caps }))
  check('no-continuation-prop-is-unchanged', !legacy.container.querySelector('[data-transcript-continuation]') && !!legacy.container.querySelector('.txn-anchor'))
  await legacy.unmount()
})
for (const { name } of fixture.assertions) report.check(observed.has(name), `${name}: named assertion executed`)
report.finish('manual continuation, open directory, and tail')

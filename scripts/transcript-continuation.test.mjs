import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'
import { Role } from '@peasant-labs/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { TranscriptContinuationState, TranscriptContinuationLabels, TranscriptTail } from '../src/ui/transcript/continuation-values.js'

const FIXTURE = 'scripts/testdata/transcript-continuation.yaml'
const MANIFEST = 'scripts/testdata/transcript-continuation.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCases', assertions: 'requiredAssertions' })
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
  const publicUI = await load('/src/ui/index.js')
  check('continuation-values-are-exported', publicUI.TranscriptContinuationState?.More === TranscriptContinuationState.More && publicUI.TranscriptTail?.Incomplete === TranscriptTail.Incomplete && publicUI.TranscriptContinuationLabels?.LoadMore === TranscriptContinuationLabels.LoadMore)
  let refusal
  try {
    renderToStaticMarkup(React.createElement(Viewer, { viewModel: { session: {}, turns: [] }, capabilities: {}, continuation: { state: fixture.unknownState } }))
  } catch (error) { refusal = error }
  check('unknown-continuation-state-throws', refusal instanceof TypeError && refusal.message.includes(fixture.unknownState) && Object.values(TranscriptContinuationState).every(state => refusal.message.includes(state)))
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
  await range.act(() => { const stream = range.container.querySelector('.txn-stream'); stream.scrollTop = 300; stream.dispatchEvent(new window.Event('scroll')) })
  const minimap = range.container.querySelector('.txn-sticky .txn-minimap')
  check('preview-timeline-is-the-minimap-over-loaded-turns', !!minimap && minimap.querySelectorAll('.txn-minimap-seg').length === 48 && minimap.getAttribute('aria-valuemax') === '47' && !range.container.querySelector('.txn-sticky .txn-scrub'))
  const nextRef = { index: 1, firstTurn: 48, lastTurn: 49, byteLength: 20, conversationTurns: { before: 48, count: 2 } }
  const nextTurns = vm.turns.map((turn, index) => ({ ...turn, index: index + 48, identity: `main:${index + 48}`, label: String(index + 49) }))
  await range.rerender(React.createElement(Viewer, { viewModel: vm, capabilities: {}, directory: { complete: false, segments: [fortyEightRef, nextRef] }, segments: [{ ...fortyEightRef, turns: fortyEightTurns }, { ...nextRef, turns: nextTurns }], continuation: { state: 'more', onLoadMore() {} } }))
  check('preview-minimap-grows-when-a-segment-appends', range.container.querySelectorAll('.txn-sticky .txn-minimap-seg').length === 50 && range.container.querySelector('.txn-minimap')?.getAttribute('aria-valuemax') === '49')
  check('open-directory-scope-says-loaded-part', range.container.textContent.includes('in the loaded part of the session'))
  await range.unmount()
  const windowed = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: {}, directory, segments }))
  await windowed.act(() => { const stream = windowed.container.querySelector('.txn-stream'); stream.scrollTop = 300; stream.dispatchEvent(new window.Event('scroll')) })
  const scrubber = windowed.container.querySelector('.txn-sticky .txn-scrub-segments')
  check('windowed-segment-read-keeps-segment-ticks', !!scrubber && !windowed.container.querySelector('.txn-sticky .txn-minimap'))
  check('open-directory-scrubber-draws-no-caption', !!scrubber && scrubber.textContent.trim() === '')
  await windowed.unmount()
  const caps = { canEdit: false, canLabel: false, canContribute: true, canChangeVisibility: false, canExport: false }
  const traceBadge = container => container.querySelector('[role=tab][id$="-trace"] .cnt')?.textContent.trim()
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
    if (row.state === TranscriptContinuationState.More) check('mount-fires-nothing', calls === 0)
    const scope = mounted.container.querySelector('[data-transcript-continuation]')
    if (row.state === TranscriptContinuationState.End || row.state === TranscriptContinuationState.Cut) {
      const name = row.state === TranscriptContinuationState.End ? 'ended-directory-drops-loaded-so-far' : 'cut-directory-drops-loaded-so-far'
      check(name, mounted.container.querySelector('.txn-trace-count')?.textContent.trim() === row.label && !mounted.container.textContent.includes('loaded so far') && scrubberTicks(caseDirectory)[0].valueText === 'turns 1–2 of 2')
    }
    report.check(mounted.container.textContent.includes(row.label), `${row.name}: position label`)
    report.check(!mounted.container.querySelector('.txn-anchor'), `${row.name}: no turn copy`)
    const button = scope?.querySelector('button')
    if (row.button) {
      report.check(button?.textContent.trim() === row.button, `${row.name}: button label`)
      report.check(button?.disabled === (row.state === TranscriptContinuationState.Loading), `${row.name}: disabled state`)
      await mounted.act(() => { window.dispatchEvent(new window.Event('resize')) })
      if (row.state === TranscriptContinuationState.More) check('resize-fires-nothing', calls === 0)
      await mounted.act(() => { const stream = mounted.container.querySelector('.txn-stream'); stream.scrollTop = stream.scrollHeight; stream.dispatchEvent(new window.Event('scroll')) })
      if (row.state === TranscriptContinuationState.More) check('reaching-the-end-fires-nothing', calls === 0)
      report.check(calls === 0, `${row.name}: scroll and resize fire nothing`)
      if (row.state === TranscriptContinuationState.More) {
        check('more-draws-load-control', !!button && button.getAttribute('aria-label') === TranscriptContinuationLabels.LoadMore)
        check('load-more-by-keyboard', button instanceof window.HTMLButtonElement && !button.disabled)
        await mounted.act(() => click(window, button))
        check('one-activation-fires-one-load', calls === 1)
        check('load-more-fires-only-on-activation', calls === 1)
      }
    } else {
      report.check(!button && scope?.textContent.includes(row.notice), `${row.name}: notice replaces button`)
    }
    await mounted.unmount()
  }
  const diagramTurns = vm.turns.map(turn => turn.role === Role.Assistant ? { ...turn, content: '```mermaid\nflowchart LR\nA --> B\n```' } : turn)
  const diagramSegments = [{ ...ref, turns: diagramTurns }]
  const mounted = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: caps, directory, segments: diagramSegments, continuation: { state: 'more', onLoadMore() {} }, allowClipboard: false, showTail: true, shareOpen: true }))
  check('every-tab-stays-with-incomplete-tail', mounted.container.querySelectorAll('[role=tab]').length >= 5)
  const noMermaidCopy = mounted.container.textContent.includes('view diagram') && !mounted.container.textContent.includes('copy source')
  const shareMenu = mounted.container.querySelector('[role="menu"][aria-label="share"]')
  check('no-clipboard-in-preview', !!shareMenu && noMermaidCopy && !shareMenu.textContent.includes('copy link') && !mounted.container.querySelector('.txn-anchor'))
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

  const { previewSourceBytes } = await load('/src/ui/transcript/segments.js')
  const { partial, appended, complete: fullBytes, invalidDirectories } = fixture.hollowTail
  const partialDir = { complete: false, segments: [fortyEightRef], sourceBytesLoaded: partial.sourceBytesLoaded, sourceBytesTotal: partial.sourceBytesTotal }
  const appendedDir = { complete: false, segments: [fortyEightRef, nextRef], sourceBytesLoaded: appended.sourceBytesLoaded, sourceBytesTotal: appended.sourceBytesTotal }
  const fullDir = { complete: true, totalSegments: 2, totalTurns: 50, totalConversationTurns: 50, segments: [fortyEightRef, nextRef], sourceBytesLoaded: fullBytes.sourceBytesLoaded, sourceBytesTotal: fullBytes.sourceBytesTotal }
  let active = 0
  const ControlledPreview = ({ dir, segs, theme }) => {
    const [turn, setTurn] = React.useState(0)
    active = turn
    return React.createElement(Viewer, {
      viewModel: vm,
      capabilities: {},
      theme,
      directory: dir,
      segments: segs,
      activeTurn: turn,
      onActiveTurnChange: setTurn,
      continuation: { state: dir.complete ? 'end' : 'more', onLoadMore() {} },
    })
  }
  const lightHollow = await mount(React.createElement(ControlledPreview, { theme: 'light', dir: partialDir, segs: [{ ...fortyEightRef, turns: fortyEightTurns }] }))
  await lightHollow.act(() => { const stream = lightHollow.container.querySelector('.txn-stream'); stream.scrollTop = 300; stream.dispatchEvent(new window.Event('scroll')) })
  const lightSlider = lightHollow.container.querySelector('.txn-sticky .txn-minimap')
  const lightLoadedEl = lightSlider?.querySelector('.txn-minimap-loaded')
  const lightTailEl = lightSlider?.querySelector('.txn-minimap-tail')
  const lightValueText = lightSlider?.getAttribute('aria-valuetext') ?? ''
  report.check(!!lightLoadedEl && !!lightTailEl && lightLoadedEl.style.width === partial.loadedPct && lightValueText.includes(partial.valueTextSuffix), 'preview-hollow-tail-partial-progress: light theme')
  await lightHollow.unmount()

  const hollow = await mount(React.createElement(ControlledPreview, { dir: partialDir, segs: [{ ...fortyEightRef, turns: fortyEightTurns }] }))
  await hollow.act(() => { const stream = hollow.container.querySelector('.txn-stream'); stream.scrollTop = 300; stream.dispatchEvent(new window.Event('scroll')) })
  const slider = hollow.container.querySelector('.txn-sticky .txn-minimap')
  const loadedEl = slider?.querySelector('.txn-minimap-loaded')
  const tailEl = slider?.querySelector('.txn-minimap-tail')
  const valueText = slider?.getAttribute('aria-valuetext') ?? ''
  check('preview-hollow-tail-partial-progress', !!loadedEl && !!tailEl && loadedEl.style.width === partial.loadedPct && valueText.includes(partial.valueTextSuffix) && slider.querySelectorAll('.txn-minimap-seg').length === 48)
  slider.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 24, right: 400, bottom: 24, x: 0, y: 0, toJSON() {} })
  const pointer = (type, clientX) => slider.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY: 12 }))
  await hollow.act(() => { pointer('pointerdown', 200) })
  const atBoundary = slider.getAttribute('aria-valuenow') === '47' && slider.querySelector('.txn-minimap-cursor')?.style.left === '50%'
  await hollow.act(() => { pointer('pointerdown', 360) })
  const clampedHollow = slider.getAttribute('aria-valuenow') === '47' && slider.querySelector('.txn-minimap-cursor')?.style.left === '50%' && active === 47
  await hollow.act(() => { pointer('pointerdown', 100); pointer('pointermove', 320); pointer('pointerup', 320) })
  const dragClamped = slider.getAttribute('aria-valuenow') === '47' && slider.querySelector('.txn-minimap-cursor')?.style.left === '50%'
  await hollow.act(() => { pointer('pointerdown', 100) })
  const insideLoaded = slider.getAttribute('aria-valuenow') === '24' && parseFloat(slider.querySelector('.txn-minimap-cursor')?.style.left) < 50
  await hollow.act(() => { slider.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })) })
  const keyStep = slider.getAttribute('aria-valuenow') === '25' && active === 25
  check('preview-hollow-tail-seek-boundary-and-never-hollow', atBoundary && clampedHollow && dragClamped && insideLoaded && keyStep)
  await hollow.rerender(React.createElement(ControlledPreview, { dir: appendedDir, segs: [{ ...fortyEightRef, turns: fortyEightTurns }, { ...nextRef, turns: nextTurns }] }))
  const shrunk = hollow.container.querySelector('.txn-minimap-loaded')?.style.width === appended.loadedPct && (hollow.container.querySelector('.txn-minimap')?.getAttribute('aria-valuetext') ?? '').includes(appended.valueTextSuffix)
  check('preview-hollow-tail-shrinks-on-append', shrunk)
  const trackedAfterAppend = hollow.container.querySelector('.txn-minimap')?.getAttribute('aria-valuenow') === '25' && active === 25
  await hollow.act(() => { hollow.container.querySelector('.txn-minimap').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })) })
  const keyEnd = hollow.container.querySelector('.txn-minimap')?.getAttribute('aria-valuenow') === '49' && active === 49
  check('preview-minimap-active-position-tracks-after-append', trackedAfterAppend && keyEnd)
  await hollow.rerender(React.createElement(ControlledPreview, { dir: fullDir, segs: [{ ...fortyEightRef, turns: fortyEightTurns }, { ...nextRef, turns: nextTurns }] }))
  const removed = !hollow.container.querySelector('.txn-minimap-tail') && !hollow.container.querySelector('.txn-minimap-loaded') && !(hollow.container.querySelector('.txn-minimap')?.getAttribute('aria-valuetext') ?? '').includes('source loaded') && hollow.container.querySelector('.txn-minimap-cursor')?.style.left === '100%'
  check('preview-hollow-tail-removed-on-completion', removed)
  await hollow.unmount()
  const invalidDropped = invalidDirectories.every((bad) => previewSourceBytes(bad) === null)
  const badMounted = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: {}, directory: { complete: false, segments: [fortyEightRef], ...invalidDirectories[2] }, segments: [{ ...fortyEightRef, turns: fortyEightTurns }], continuation: { state: 'more', onLoadMore() {} } }))
  await badMounted.act(() => { const stream = badMounted.container.querySelector('.txn-stream'); stream.scrollTop = 300; stream.dispatchEvent(new window.Event('scroll')) })
  check('preview-hollow-tail-invalid-bytes-fail-closed', invalidDropped && !badMounted.container.querySelector('.txn-minimap-tail') && !badMounted.container.querySelector('.txn-minimap-loaded'))
  await badMounted.unmount()
  const noBytesMounted = await mount(React.createElement(Viewer, { viewModel: vm, capabilities: {}, directory: { complete: false, segments: [fortyEightRef] }, segments: [{ ...fortyEightRef, turns: fortyEightTurns }], continuation: { state: 'more', onLoadMore() {} } }))
  await noBytesMounted.act(() => { const stream = noBytesMounted.container.querySelector('.txn-stream'); stream.scrollTop = 300; stream.dispatchEvent(new window.Event('scroll')) })
  check('preview-hollow-tail-preserves-no-bytes-behavior', previewSourceBytes({ complete: false, segments: [fortyEightRef] }) === null && !noBytesMounted.container.querySelector('.txn-minimap-tail') && noBytesMounted.container.querySelectorAll('.txn-minimap-seg').length === 48)
  await noBytesMounted.unmount()
})
for (const { name } of fixture.assertions) report.check(observed.has(name), `${name}: named assertion executed`)
report.finish('manual continuation, open directory, and tail')

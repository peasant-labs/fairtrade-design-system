import { loadFixturePair, withMountedSource, createReport, click } from './mounted-parts.mjs'

const { fixture } = loadFixturePair('scripts/testdata/publish-recovery.yaml', 'scripts/testdata/publish-recovery.manifest.yaml', { cases: 'requiredCaseNames', transitions: 'requiredTransitionNames' })
const report = createReport('publish prerequisite recovery')
await withMountedSource(async ({ load, mount, React, window }) => {
  const { PublishDialog } = await load('/src/ui/Publish.jsx')
  const propsFor = (row, calls) => ({
    open: true, state: 'stopped', title: 'Recorded session', onClose() {},
    scan: row.scan, access: row.audience ? [{ id: 'readers', name: 'Readers' }] : [],
    onRecover: row.callback === 'recover' || row.callback === 'both' ? () => calls.push('recover') : undefined,
    onRetry: row.callback === 'retry' || row.callback === 'both' ? () => calls.push('retry') : undefined,
    onPublish: () => calls.push('publish'),
  })
  const primary = (mounted) => mounted.container.querySelector('.dlg-foot .btn-primary')
  // Capture the actual React handler installed on the production button so stale/direct
  // invocation is exercised independently of the browser's disabled-button suppression.
  const handler = (button) => Object.entries(button).find(([key]) => key.startsWith('__reactProps$'))?.[1]?.onClick
  for (const row of fixture.cases) {
    const calls = []
    const mounted = await mount(React.createElement(PublishDialog, propsFor(row, calls)))
    const button = primary(mounted)
    report.check(button?.disabled === !row.allowed, `${row.name}: actual recovery/retry button readiness`)
    await mounted.act(() => click(window, button))
    report.check(JSON.stringify(calls) === JSON.stringify(row.allowed ? [row.callback] : []), `${row.name}: callback exclusivity on click`)
    calls.length = 0
    await mounted.act(() => handler(button)())
    report.check(JSON.stringify(calls) === JSON.stringify(row.allowed ? [row.callback] : []), `${row.name}: direct callback guard`)
    if (row.refused) {
      report.check(!!mounted.container.querySelector('[role="alert"]') && !mounted.container.textContent.includes('all redacted'), `${row.name}: explicit review refusal remains visible`)
    }
    await mounted.unmount()
  }
  for (const row of fixture.transitions) {
    const initial = fixture.cases.find(item => item.name === row.initial)
    const next = fixture.cases.find(item => item.name === row.next)
    if (!initial || !next) throw new Error(`${row.name}: transition must reference fixture cases`)
    const oldCalls = []
    const calls = []
    const mounted = await mount(React.createElement(PublishDialog, propsFor(initial, oldCalls)))
    const staleClick = handler(primary(mounted))
    await mounted.rerender(React.createElement(PublishDialog, { ...propsFor(next, calls), open: row.open ?? true, state: row.state ?? 'stopped' }))
    await mounted.act(() => staleClick())
    report.check(oldCalls.length === 0, `${row.name}: old callback is never invoked`)
    report.check(JSON.stringify(calls) === JSON.stringify(row.expected ? [row.expected] : []), `${row.name}: latest committed action guard`)
    await mounted.unmount()
    calls.length = 0
    await mounted.act(() => staleClick())
    report.check(calls.length === 0, `${row.name}: unmounted callback is inert`)
  }
})
report.finish('read/sign-in recovery is separate from strict publication retry, including stale callbacks')

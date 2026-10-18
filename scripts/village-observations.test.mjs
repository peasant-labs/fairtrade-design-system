import { loadFixturePair, assertExactNames, withMountedSource, click, createReport } from './mounted-parts.mjs'
import { renderToStaticMarkup } from 'react-dom/server'

const { fixture, manifest } = loadFixturePair('scripts/testdata/village-observations.yaml', 'scripts/testdata/village-observations.manifest.yaml', {cases: 'requiredCaseNames', controlledCases:'requiredControlledNames', activationCases:'requiredActivationNames', fetchCases:'requiredFetchNames', invalidCases:'requiredInvalidNames', containmentCases:'requiredContainmentNames', containmentMotions:'requiredContainmentMotionNames'})
assertExactNames([fixture.update.name], manifest.requiredUpdateNames, 'evidence update fixture')
assertExactNames([fixture.scroll.name], manifest.requiredScrollNames, 'persistent tools fixture')
assertExactNames(fixture.containmentCollectiveIds, manifest.requiredContainmentCollectiveIds, 'bounded host collective inventory')
const report = createReport('village observations')
await withMountedSource(async ({ load, mount, window, React }) => {
  const { default: Component } = await load('/src/ui/VillageObservations.jsx')
  const ui = await load('/src/ui/index.js')
  const graph = await load('/src/ui/graph/index.js')
  report.check(ui.VillageObservations === Component && graph.VillageObservations === Component, 'both public barrels export the same presentation')
  report.check(renderToStaticMarkup(React.createElement(Component, fixture.base)).includes('Acme Platform'), 'presentation supports SSR')
  for (const row of fixture.invalidCases) {
    let message = ''
    try { renderToStaticMarkup(React.createElement(Component, {...fixture.base, ...row.props})) } catch (error) { message = error.message }
    report.check(message.includes(row.diagnostic), `${row.name}: actionable controlled selection error`)
  }
  for (const row of fixture.controlledCases) {
    const calls = []
    let fetches = 0
    const props = {...fixture.base, view: 'history', [row.control]: row.initial, onFetch: () => fetches++,
      onViewChange: (id) => calls.push(['view', id]), onCategoryChange: (id) => calls.push(['category', id])}
    const mounted = await mount(React.createElement(Component, props))
    const list = mounted.container.querySelector(`[aria-label="${row.panel}"]`)
    const button = [...list.querySelectorAll('button')].find((node) => node.textContent === row.label)
    await mounted.act(() => click(window, button))
    report.check(JSON.stringify(calls) === JSON.stringify([[row.callback, row.target]]), `${row.name}: exact once selection identity`)
    report.check(list.querySelector('[aria-selected=true]').textContent === (row.control === 'view' ? 'catalog' : 'remote attempts'), `${row.name}: controlled selection waits for host`)
    await mounted.rerender(React.createElement(Component, {...props, [row.control]:row.target}))
    report.check(mounted.container.querySelector(`[aria-label="${row.panel}"] [aria-selected=true]`).textContent === row.label, `${row.name}: host rerender selects target`)
    report.check(fetches === 0 && calls.length === 1, `${row.name}: mount and host rerender perform no fetch or unsolicited selection`)
    await mounted.unmount()
  }
  for (const row of fixture.activationCases) {
    const mounted = await mount(React.createElement(Component, {...fixture.base, view:'history', categories:fixture.base.categories.map((category) => ({...category, loading:row.loading})), onPageChange:row.handler ? () => {} : undefined}))
    report.check(mounted.container.querySelector('.vobs-pager').hasAttribute('inert') === row.blocked, `${row.name}: native inert state protects the page controls`)
    await mounted.unmount()
  }
  for (const row of fixture.fetchCases) {
    let calls = 0
    const props = {...fixture.base, onFetch:row.handler ? () => calls++ : undefined, fetching:row.fetching, fetchDisabled:row.disabled}
    const mounted = await mount(React.createElement(Component, props))
    const button = mounted.container.querySelector('.vobs-header button')
    report.check(button.disabled === row.blocked, `${row.name}: native fetch availability`)
    await mounted.rerender(React.createElement(Component, {...props, status:'new status'}))
    report.check(calls === 0, `${row.name}: no fetch on initial mount or rerender`)
    await mounted.act(() => click(window, button))
    report.check(calls === (row.blocked ? 0 : 1), `${row.name}: explicit fetch only once when enabled`)
    await mounted.unmount()
  }
  for (const row of fixture.cases) {
    const calls = []
    const props = { ...row.props['<<'], ...row.props }
    delete props['<<']
    const mounted = await mount(React.createElement(Component, { ...props,
      onFetch: () => calls.push('fetch'), onTrack: (id, tracking) => calls.push([id, tracking]),
      onPageChange: (id, page) => calls.push([id, page]), onRestart: (id) => calls.push(id),
    }))
    const root = mounted.container
    const visible = [...root.querySelectorAll('p,strong,dd,button,[role=status]')].filter((node) => !node.closest('[hidden]')).map((node) => node.textContent).join(' ')
    for (const text of row.text) report.check(visible.includes(text), `${row.name}: visible ${text}`)
    for (const text of row.absent ?? []) report.check(!root.textContent.includes(text), `${row.name}: no private ${text}`)
    report.check(!root.textContent.includes('[object Object]'), `${row.name}: typed fields render as text`)
    const fetch = [...root.querySelectorAll('button')].find((node) => node.textContent === 'fetch metadata')
    report.check(fetch.disabled === !!(props.fetching || props.fetchDisabled), `${row.name}: fetch availability`)
    if (!fetch.disabled) { await mounted.act(() => click(window, fetch)); report.check(calls.includes('fetch'), `${row.name}: actual fetch callback`) }
    await mounted.unmount()
  }
  const calls = []
  const element = (status) => React.createElement(Component, { ...fixture.base, status, onPageChange: (id, page) => calls.push([id, page]) })
  const mounted = await mount(element('before'))
  const press = async (label) => {
    const button = [...mounted.container.querySelectorAll('button')].find((node) => !node.closest('[hidden]') && (node.textContent.trim() === label || node.getAttribute('aria-label') === label))
    report.check(!!button, `mounted control ${label}`)
    if (button) await mounted.act(() => click(window, button))
  }
  await press('history')
  await press('next page')
  await press('confirmed receipts')
  await press('next page')
  report.check(JSON.stringify(calls) === JSON.stringify(fixture.pagingCalls), 'page callbacks carry independent category identity')
  await mounted.rerender(element('new diagnostics; old receipt page unchanged'))
  report.check(mounted.container.querySelector('[aria-label="history categories"] [role=tab][aria-selected=true]')?.textContent === 'confirmed receipts', 'report updates preserve selected evidence category')
  await mounted.unmount()
  {
    const calls = []
    const before = fixture.base.categories.map((category) => ({...category, page:fixture.update.beforePages[category.id]}))
    const props = {...fixture.base, view:'history', categories:before,
      onPageChange: (...args) => calls.push(['page', ...args]), onRestart:(id) => calls.push(['restart',id]), onCategoryChange:(id)=>calls.push(['category',id])}
    const mounted = await mount(React.createElement(Component, props))
    const tab = [...mounted.container.querySelectorAll('[aria-label="history categories"] button')].find((node)=>node.textContent==='confirmed receipts')
    await mounted.act(()=>click(window,tab)); calls.length = 0
    const after = fixture.update.order.map((id)=>id==='operation-diagnostics' ? fixture.update.diagnostic : before.find((category)=>category.id===id))
    await mounted.rerender(React.createElement(Component,{...props, categories:after, domains:fixture.update.domains}))
    report.check(mounted.container.querySelector('[aria-label="history categories"] [aria-selected=true]').textContent==='confirmed receipts', `${fixture.update.name}: selected category remains by identity`)
    const panel = [...mounted.container.querySelectorAll('.vobs-history > .tabpanel')].find((node)=>!node.hidden)
    report.check(panel.textContent.includes('receipt-1') && panel.querySelector('[aria-current=page]')?.textContent==='3', `${fixture.update.name}: receipt row and page preserved`)
    report.check(panel.textContent.includes('2026-10-17T12:00:00Z') && panel.textContent.includes('2026-10-15T09:00:00Z'), `${fixture.update.name}: independently changed and retained domain dates`)
    report.check(mounted.container.textContent.includes('diagnostic-new') || mounted.container.textContent.includes('new diagnostic'), `${fixture.update.name}: actual new diagnostic payload supplied`)
    report.check(calls.length===0, `${fixture.update.name}: no unsolicited page, restart or category callbacks`)
    const attempts = mounted.container.querySelectorAll('.vobs-history > .tabpanel')[2]
    report.check(attempts.textContent.includes('Historical Collective') && attempts.querySelector('[aria-current=page]')?.textContent==='2', `${fixture.update.name}: unchanged attempts retain page and row`)
    const diagnosticsTab = [...mounted.container.querySelectorAll('[aria-label="history categories"] button')].find((node)=>node.textContent==='operation diagnostics')
    await mounted.act(()=>click(window,diagnosticsTab))
    const diagnosticsPanel = [...mounted.container.querySelectorAll('.vobs-history > .tabpanel')].find((node)=>!node.hidden)
    const expected = fixture.update.expect
    const diagnostic = diagnosticsPanel.querySelector(`[data-evidence-id="${expected.diagnosticId}"]`)
    report.check(diagnostic?.querySelector('p')?.textContent === expected.outcome, 'updated diagnostics: exact visible outcome')
    report.check(diagnostic?.querySelector('time')?.textContent === expected.occurredAt && diagnostic?.querySelector('time')?.getAttribute('datetime') === expected.occurredAt, 'updated diagnostics: exact visible occurred timestamp')
    report.check(diagnosticsPanel.querySelector('.vobs-summary')?.textContent === expected.summary, 'updated diagnostics: exact visible summary including total')
    report.check(JSON.stringify([...diagnosticsPanel.querySelectorAll('.pgn-num')].map((node)=>node.textContent)) === JSON.stringify(expected.pageLabels), 'updated diagnostics: exact visible page count and labels')
    report.check(JSON.stringify(calls) === JSON.stringify([['category','operation-diagnostics']]), 'updated diagnostics: only the explicit category selection emits a callback')
    await mounted.unmount()
  }
})
report.finish('presentation states, public exports, SSR and real callbacks')

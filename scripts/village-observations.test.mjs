import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'
import { renderToStaticMarkup } from 'react-dom/server'

const { fixture } = loadFixturePair('scripts/testdata/village-observations.yaml', 'scripts/testdata/village-observations.manifest.yaml')
const report = createReport('village observations')
await withMountedSource(async ({ load, mount, window, React }) => {
  const { default: Component } = await load('/src/ui/VillageObservations.jsx')
  const ui = await load('/src/ui/index.js')
  const graph = await load('/src/ui/graph/index.js')
  report.check(ui.VillageObservations === Component && graph.VillageObservations === Component, 'both public barrels export the same presentation')
  report.check(renderToStaticMarkup(React.createElement(Component, fixture.base)).includes('Acme Platform'), 'presentation supports SSR')
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
})
report.finish('presentation states, public exports, SSR and real callbacks')

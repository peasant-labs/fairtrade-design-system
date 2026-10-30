import { loadFixturePair, withMountedSource, createReport, click } from './mounted-parts.mjs'
const { fixture } = loadFixturePair('scripts/testdata/change-annotation-capabilities.yaml', 'scripts/testdata/change-annotation-capabilities.manifest.yaml')
const report = createReport('change annotation capabilities')
await withMountedSource(async ({ load, mount, React, window }) => {
  const ChangeDetail = (await load('/src/ui/graph/ChangeDetail.jsx')).default
  for (const row of fixture.cases) {
    let removed = false
    let saved = ''
    const mounted = await mount(React.createElement(ChangeDetail, {
      payload: fixture.payload, annotation: row.annotation,
      onSaveAnnotation: row.save ? value => { saved = value } : undefined,
      onRemoveAnnotation: row.remove ? () => { removed = true } : undefined,
    }))
    const query = selector => mounted.container.querySelector(selector)
    report.check(!![...mounted.container.querySelectorAll('.gmp-detail-sechead')].find(node => node.textContent === 'your annotation') === row.section, `${row.name}: section availability`)
    report.check(!!query('.gmp-annot-add') === row.save, `${row.name}: editing requires save capability`)
    report.check(!!query('.gmp-annot-x') === (!!row.annotation && row.remove), `${row.name}: removing requires remove capability`)
    if (row.annotation) report.check(query('.gmp-annot-chip')?.textContent.includes(row.annotation), `${row.name}: saved value retained`)
    if (row.remove) {
      await mounted.act(() => click(window, query('.gmp-annot-x')))
      report.check(removed, `${row.name}: remove dispatches to host`)
    }
    if (row.save) {
      await mounted.act(() => click(window, query('.gmp-annot-add')))
      const input = query('input[aria-label="annotation value"]')
      await mounted.act(() => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'checked')
        input.dispatchEvent(new window.Event('input', { bubbles: true }))
      })
      await mounted.act(() => query('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
      report.check(saved === 'checked', `${row.name}: save dispatches to host`)
      report.check(!query('.gmp-annot-pop'), `${row.name}: successful form closes`)
    }
    await mounted.unmount()
  }
})
report.finish('host-owned annotation capabilities')

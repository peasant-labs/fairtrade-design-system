#!/usr/bin/env node
import { loadFixturePair, assertFields, withMountedSource, createReport } from './mounted-parts.mjs'

/** @typedef {{selector: string, text?: string, absent?: string, disabled?: boolean, count?: number}} Probe */
/** @typedef {{name: string, module: string, component: string, query?: string, props?: object, probes: Probe[]}} TruthRow */
/** @returns {TruthRow[]} */
function loadTruthRows() {
  const { fixture } = loadFixturePair('scripts/testdata/demo-truth.yaml', 'scripts/testdata/demo-truth.manifest.yaml')
  for (const row of fixture.cases) {
    assertFields(row, ['name', 'module', 'component', 'probes'], row.name, ['query', 'props'])
    for (const probe of row.probes) assertFields(probe, ['selector'], row.name, ['text', 'absent', 'disabled', 'count'])
  }
  return fixture.cases
}

const report = createReport('demo truth')
await withMountedSource(async ({ load, mount, window, React }) => {
  for (const row of loadTruthRows()) {
    window.history.replaceState(null, '', `/${row.query ?? ''}`)
    const module = await load(row.module)
    const mounted = await mount(React.createElement(module[row.component], row.props ?? {}))
    for (const probe of row.probes) {
      const nodes = [...window.document.body.querySelectorAll(probe.selector)]
      const text = nodes.map(node => node.textContent.replace(/\s+/g, ' ').trim()).join('\n')
      if (probe.count != null) report.check(nodes.length === probe.count, `${row.name}: ${probe.selector} count expected ${probe.count}, received ${nodes.length}`)
      if (probe.text != null) report.check(text.includes(probe.text), `${row.name}: ${probe.selector} must contain ${JSON.stringify(probe.text)}; received ${JSON.stringify(text)}`)
      if (probe.absent != null) report.check(!text.includes(probe.absent), `${row.name}: ${probe.selector} must not contain ${JSON.stringify(probe.absent)}`)
      if (probe.disabled != null) report.check(nodes.length > 0 && nodes.every(node => node.matches(':disabled') === probe.disabled), `${row.name}: ${probe.selector} disabled expected ${probe.disabled}`)
    }
    await mounted.unmount()
  }
})
report.finish('all required mounted demo rows.')

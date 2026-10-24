#!/usr/bin/env node
/* Mounted-source gate for the code map navigator's line counts: a measured count reads "N lines", a
   measured 0 reads "0 lines", and a host that says the counts were not measured (lineCounts:
   'unknown') gets no line count in any row instead of a false 0, through the navigator itself and
   through CodeMapComposition's navigator presentation.
   Cases: scripts/testdata/code-map-line-counts.yaml (+ .manifest.yaml).
   Run: pnpm test:code-map-line-counts; mutations: pnpm test:code-map-line-counts:mutations. */
import { loadFixturePair, withMountedSource, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/code-map-line-counts.yaml'
const MANIFEST = 'scripts/testdata/code-map-line-counts.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })
const report = createReport('code map line counts')
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()

await withMountedSource(async ({ load, mount, React }) => {
  const { default: CodeMapNavigator } = await load('/src/ui/graph/CodeMapNavigator.jsx')
  const { default: CodeMapComposition } = await load('/src/ui/graph/CodeMapComposition.jsx')
  for (const row of fixture.cases) {
    const element = row.component === 'composition'
      ? React.createElement(CodeMapComposition, { payload: fixture.payload, ...row.props })
      : React.createElement(CodeMapNavigator, { payload: fixture.payload, grain: 'project', ...row.props })
    const mounted = await mount(element)
    for (const [id, expected] of Object.entries(row.expected)) {
      const item = [...mounted.container.querySelectorAll('[role="treeitem"]')].find((node) => text(node.querySelector('.gmp-navigator-path')) === id)
      const meta = item ? [...item.querySelectorAll('.gmp-navigator-meta > span')].map(text) : null
      report.check(JSON.stringify(meta) === JSON.stringify(expected), `${row.name}: row ${id} must read ${JSON.stringify(expected)}, received ${JSON.stringify(meta)}`)
    }
    await mounted.unmount()
  }
})

report.finish(`${fixture.cases.length} cases over measured, zero and unmeasured line counts.`)

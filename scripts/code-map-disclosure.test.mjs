#!/usr/bin/env node
/* Mounted-source gate for the code map navigator's disclosures: a folder the grain opens starts open
   ("hide children", chevron down) and its disclosure really hides and shows its children, so the
   chevron never says "collapsed" over visible children; a folder past the grain's depth gets a working
   disclosure that opens it. It mounts the REAL CodeMapNavigator.
   Cases: scripts/testdata/code-map-disclosure.yaml (+ .manifest.yaml).
   Run: pnpm test:code-map-disclosure; mutations: pnpm test:code-map-disclosure:mutations. */
import { loadFixturePair, withMountedSource, createReport, click } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/code-map-disclosure.yaml'
const MANIFEST = 'scripts/testdata/code-map-disclosure.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })
const report = createReport('code map disclosure')
const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim()

await withMountedSource(async ({ load, mount, window, React }) => {
  const { default: CodeMapNavigator } = await load('/src/ui/graph/CodeMapNavigator.jsx')
  for (const row of fixture.cases) {
    const mounted = await mount(React.createElement(CodeMapNavigator, { payload: fixture.payload, grain: row.grain }))
    const wrapFor = (name) => [...mounted.container.querySelectorAll('.gmp-navigator-row-wrap')].find((wrap) => text(wrap.querySelector('.gmp-navigator-path')) === name)
    for (const name of row.press) {
      const button = wrapFor(name)?.querySelector('.gmp-navigator-disclosure')
      report.check(!!button, `${row.name}: ${name} must have a disclosure to press`)
      if (button) await mounted.act(() => click(window, button))
    }
    const rows = [...mounted.container.querySelectorAll('.gmp-navigator-path')].map(text)
    report.check(JSON.stringify(rows) === JSON.stringify(row.rows), `${row.name}: rows must be ${JSON.stringify(row.rows)}, received ${JSON.stringify(rows)}`)
    const disclosures = Object.fromEntries(Object.keys(row.disclosures).map((name) => {
      const button = wrapFor(name)?.querySelector('.gmp-navigator-disclosure')
      return [name, button ? [button.getAttribute('aria-expanded'), button.getAttribute('aria-label')] : null]
    }))
    report.check(JSON.stringify(disclosures) === JSON.stringify(row.disclosures), `${row.name}: disclosures must be ${JSON.stringify(row.disclosures)}, received ${JSON.stringify(disclosures)}`)
    await mounted.unmount()
  }
})

report.finish(`${fixture.cases.length} cases over grain-opened and drillable folders.`)

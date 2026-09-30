#!/usr/bin/env node
/* Mounted-source gate for the local app's section registry. It asserts LOCAL_APP_SECTIONS equals
   the fixture entry by entry and in order, that GraphAppShell and GraphSectionNav list only the
   inNav entries (and still list every entry of a list with no inNav field), that the deprecated
   GRAPH_APP_SECTIONS alias keeps its value, and that the graph demo opens on home and mounts a
   non-empty body for every entry, the route-only ones through ?section=<id>.
   Cases: scripts/testdata/app-sections.yaml (+ .manifest.yaml).
   Run: pnpm test:app-sections; mutations: pnpm test:app-sections:mutations. */
import { loadFixturePair, assertExactNames, withMountedSource, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/app-sections.yaml'
const MANIFEST = 'scripts/testdata/app-sections.manifest.yaml'
const { fixture, manifest } = loadFixturePair(FIXTURE, MANIFEST, { entries: 'requiredCaseNames' })
assertExactNames(fixture.demo.bodies.map((body) => body.name), manifest.requiredBodyNames, `${FIXTURE} demo bodies`)
assertExactNames(fixture.deprecatedAlias.map((entry) => entry.id), manifest.requiredAliasIds, `${FIXTURE} deprecated alias`)

const report = createReport('app sections')
const navLabels = (root) => [...root.querySelectorAll('nav .iu-subnav-item')].map((node) => node.textContent.trim())

await withMountedSource(async ({ load, mount, window, React }) => {
  const shell = await load('/src/ui/inuse/InUseShell.jsx')
  const graphBarrel = await load('/src/ui/graph/index.js')
  const uiBarrel = await load('/src/ui/index.js')

  const registry = shell.LOCAL_APP_SECTIONS
  report.check(Object.isFrozen(registry), 'LOCAL_APP_SECTIONS must be frozen')
  report.check(registry.length === fixture.entries.length, `LOCAL_APP_SECTIONS must hold exactly ${fixture.entries.length} entries, found ${registry.length}`)
  fixture.entries.forEach((expected, index) => {
    const actual = registry[index] ?? {}
    const same = actual.id === expected.id && actual.label === expected.label && actual.inNav === expected.inNav && Object.keys(actual).length === 3
    report.check(same, `LOCAL_APP_SECTIONS entry ${expected.name} at position ${index}: expected ${JSON.stringify({ id: expected.id, label: expected.label, inNav: expected.inNav })}, received ${JSON.stringify(actual)}`)
  })
  report.check(graphBarrel.LOCAL_APP_SECTIONS === registry && uiBarrel.LOCAL_APP_SECTIONS === registry, 'LOCAL_APP_SECTIONS must be exported from the ui and graph barrels')
  report.check(JSON.stringify(shell.GRAPH_APP_SECTIONS) === JSON.stringify(fixture.deprecatedAlias), `the deprecated GRAPH_APP_SECTIONS alias changed value: ${JSON.stringify(shell.GRAPH_APP_SECTIONS)}`)
  report.check(graphBarrel.GRAPH_APP_SECTIONS === shell.GRAPH_APP_SECTIONS, 'GRAPH_APP_SECTIONS must stay exported from the graph barrel')

  const inNav = fixture.entries.filter((entry) => entry.inNav).map((entry) => entry.label)
  for (const [name, element] of [
    ['GraphSectionNav', React.createElement(shell.GraphSectionNav, { activeId: 'home' })],
    ['GraphAppShell', React.createElement(shell.GraphAppShell, { activeId: 'home' }, React.createElement('p', null, 'body'))],
  ]) {
    const mounted = await mount(element)
    const labels = navLabels(mounted.container)
    report.check(JSON.stringify(labels) === JSON.stringify(inNav), `${name} must list exactly the inNav entries ${JSON.stringify(inNav)}, received ${JSON.stringify(labels)}`)
    await mounted.unmount()
  }
  {
    const mounted = await mount(React.createElement(shell.GraphSectionNav, { sections: shell.GRAPH_APP_SECTIONS, activeId: 'changes' }))
    const labels = navLabels(mounted.container)
    const legacy = fixture.deprecatedAlias.map((entry) => entry.label)
    report.check(JSON.stringify(labels) === JSON.stringify(legacy), `a list with no inNav field keeps rendering every entry; expected ${JSON.stringify(legacy)}, received ${JSON.stringify(labels)}`)
    await mounted.unmount()
  }

  const { default: GraphApp } = await load('/src/mockups/inuse/GraphApp.jsx')
  {
    window.history.replaceState(null, '', '/?app=graph#inuse')
    const mounted = await mount(React.createElement(GraphApp, { theme: 'dark' }))
    const current = mounted.container.querySelector('nav .iu-subnav-item[aria-current="page"]')?.textContent.trim()
    report.check(current === fixture.demo.initialSection, `the demo must open on home; the current nav item is ${JSON.stringify(current)}`)
    report.check(JSON.stringify(navLabels(mounted.container)) === JSON.stringify(fixture.demo.navLabels), `the demo nav must list ${JSON.stringify(fixture.demo.navLabels)}`)
    await mounted.unmount()
  }
  for (const body of fixture.demo.bodies) {
    window.history.replaceState(null, '', `/?app=graph&section=${body.section}#inuse`)
    const mounted = await mount(React.createElement(GraphApp, { theme: 'dark' }))
    await mounted.settle(20)
    const visible = [...mounted.container.querySelectorAll('.iu-view > :not([hidden])')].map((node) => node.textContent).join(' ')
    report.check(visible.includes(body.text), `${body.name}: selecting ${body.section} must mount a body reading ${JSON.stringify(body.text)}`)
    const listed = fixture.entries.find((entry) => entry.id === body.section)?.inNav
    report.check(listed || !!mounted.container.querySelector('.iu-subnav-back'), `${body.name}: a route-only section must offer back`)
    await mounted.unmount()
  }
})

report.finish(`${fixture.entries.length} registry entries, the deprecated alias, both nav components and ${fixture.demo.bodies.length} demo bodies.`)

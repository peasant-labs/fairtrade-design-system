#!/usr/bin/env node
/* Mounted-source gate for the small page parts the local and village pages share. Each family's
   cases live in scripts/testdata/village-parts.yaml (+ .manifest.yaml); the gate mounts the REAL
   component per case and checks what a user meets.
   Run: pnpm test:village-parts; mutations: pnpm test:village-parts:mutations. */
import { loadFixturePair, withMountedSource, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/village-parts.yaml'
const MANIFEST = 'scripts/testdata/village-parts.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { statsStrip: 'requiredStatsStripNames' })
const report = createReport('village parts')
const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim()

await withMountedSource(async ({ load, mount, React }) => {
  const ui = await load('/src/ui/index.js')

  for (const row of fixture.statsStrip) {
    const mounted = await mount(React.createElement(ui.StatsStrip, { items: row.items, label: 'summary' }))
    const list = mounted.container.querySelector('ul.sst')
    report.check(!!list === row.expected.rendered, `${row.name}: rendered must be ${row.expected.rendered}`)
    const pairs = [...(list?.querySelectorAll('li.sst-pair') ?? [])].map(text)
    report.check(JSON.stringify(pairs) === JSON.stringify(row.expected.pairs), `${row.name}: pairs expected ${JSON.stringify(row.expected.pairs)}, received ${JSON.stringify(pairs)}`)
    for (const value of list?.querySelectorAll('.sst-value') ?? []) report.check(value.classList.contains('tnum'), `${row.name}: every value uses tabular numbers`)
    if (list) report.check(list.getAttribute('aria-label') === 'summary', `${row.name}: the strip is a named list`)
    await mounted.unmount()
  }
})

report.finish(`${fixture.statsStrip.length} StatsStrip cases.`)

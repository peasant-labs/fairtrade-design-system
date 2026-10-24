#!/usr/bin/env node
/* Mounted-source gate for page heading levels: Explore and TranscriptViewer draw their title as an h2
   by default and, with headingLevel 1, as the page's h1 with every heading under it one level up, so
   a host that mounts either as its whole page gets one h1 and no skipped level without a visually
   hidden heading. An invalid level fails loudly. It mounts the REAL composites.
   Cases: scripts/testdata/page-headings.yaml (+ .manifest.yaml).
   Run: pnpm test:page-headings; mutations: pnpm test:page-headings:mutations. */
import { loadFixturePair, withMountedSource, createReport } from './mounted-parts.mjs'
import { renderToStaticMarkup } from 'react-dom/server'

const FIXTURE = 'scripts/testdata/page-headings.yaml'
const MANIFEST = 'scripts/testdata/page-headings.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames', invalid: 'requiredInvalidNames' })
const report = createReport('page headings')
const CAPABILITIES = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }

await withMountedSource(async ({ load, mount, React }) => {
  const { adaptTranscript } = await load('/src/ui/transcript/adapter.js')
  const { default: TranscriptViewer } = await load('/src/ui/transcript/TranscriptViewer.jsx')
  const { default: Explore } = await load('/src/ui/commons/Explore.jsx')
  const element = (row) => row.component === 'viewer'
    ? React.createElement(TranscriptViewer, { viewModel: adaptTranscript(fixture.payload), capabilities: CAPABILITIES, ...row.props })
    : React.createElement(Explore, { ...row.props })
  for (const row of fixture.cases) {
    const mounted = await mount(element(row))
    const headings = [...mounted.container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => `${h.tagName}.${h.className.split(' ')[0]}`)
    report.check(JSON.stringify(headings) === JSON.stringify(row.headings), `${row.name}: headings must be ${JSON.stringify(row.headings)}, received ${JSON.stringify(headings)}`)
    await mounted.unmount()
  }
  for (const row of fixture.invalid) {
    let message = ''
    try { renderToStaticMarkup(element(row)) } catch (error) { message = error.message }
    report.check(message.includes(row.diagnostic), `${row.name}: must fail with ${JSON.stringify(row.diagnostic)}, received ${JSON.stringify(message)}`)
  }
})

report.finish(`${fixture.cases.length} heading structures and ${fixture.invalid.length} refused levels.`)

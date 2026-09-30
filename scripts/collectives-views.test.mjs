#!/usr/bin/env node
/* Mounted-source gate for the shipped collectives views (src/ui/commons/Collectives.jsx) with the
   data a host sends, not the demo's: the collectives list with rows shaped like village's, a
   collective in the earlier `{ name, description }` shape and in the full shape, and a
   collective's settings. It checks what a user reads (text, table columns, select values), that
   no demo fact or demo link appears, and what the controls call.
   Cases: scripts/testdata/collectives-views.yaml (+ .manifest.yaml).
   Run: pnpm test:collectives-views; mutations: pnpm test:collectives-views:mutations. */
import { loadFixturePair, withMountedSource, click, createReport, assertFields } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/collectives-views.yaml'
const MANIFEST = 'scripts/testdata/collectives-views.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })
const report = createReport('collectives views')
const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim() ?? ''
const VIEWS = ['CollectivesView', 'CollectiveDetailView', 'CollectiveSettingsView']
for (const row of fixture.cases) {
  assertFields(row, ['name', 'view', 'data', 'expect'], `collectives views case ${row.name}`, ['open', 'press', 'hrefs'])
  assertFields(row.expect, [], `collectives views case ${row.name} expect`, ['text', 'absentText', 'columns', 'selects', 'links', 'buttons', 'absentButtons'])
  if (!VIEWS.includes(row.view)) throw new Error(`collectives views case ${row.name}: unknown view ${row.view}`)
}

/* a select's accessible name: its aria-label, its aria-labelledby text, or its <label>. */
function selectName(node, document) {
  if (node.getAttribute('aria-label')) return node.getAttribute('aria-label')
  const labelledBy = node.getAttribute('aria-labelledby')
  if (labelledBy) return labelledBy.split(/\s+/).map((id) => text(document.getElementById(id))).join(' ')
  const label = node.closest('label') ?? (node.id ? document.querySelector(`label[for="${node.id}"]`) : null)
  return text(label?.querySelector('.label') ?? label)
}

await withMountedSource(async ({ load, mount, window, React }) => {
  const views = await load('/src/ui/commons/Collectives.jsx')
  const shipped = await load('/src/ui/commons/Manage.jsx')
  for (const name of VIEWS) report.check(shipped[name] === views[name], `the commons entry ships ${name} from src/ui/commons/Collectives.jsx`)

  for (const row of fixture.cases) {
    const calls = []
    const record = (name) => (...args) => { calls.push([name, ...args.filter((arg) => arg === null || typeof arg !== 'object')]) }
    const actions = Object.fromEntries(['onCreateCollective', 'onOpenCollective', 'onOpenTranscript', 'onOpenPullRequest', 'onSettings', 'onContribute'].map((name) => [name, record(name)]))
    const data = row.hrefs ? { ...row.data, hrefFor: (kind, id) => `/${kind}${id === undefined ? '' : `/${id}`}` } : row.data
    let mounted
    try {
      mounted = await mount(React.createElement(views[row.view], { data, actions }))
    } catch (error) {
      report.check(false, `${row.name}: the view must render; it threw ${error.message}`)
      continue
    }
    const root = mounted.container
    const doc = mounted.document
    if (row.open) {
      const opener = [...root.querySelectorAll('button')].find((node) => text(node) === row.open)
      report.check(!!opener, `${row.name}: a ${row.open} button must exist`)
      if (opener) await mounted.act(() => click(window, opener))
    }
    const body = text(root)
    const { expect } = row
    for (const line of expect.text ?? []) report.check(body.includes(line), `${row.name}: the view must show ${JSON.stringify(line)}`)
    for (const line of expect.absentText ?? []) report.check(!body.toLowerCase().includes(line.toLowerCase()), `${row.name}: the view must not show ${JSON.stringify(line)}`)
    if (expect.columns) {
      const columns = [...root.querySelectorAll('table thead th')].map(text)
      report.check(JSON.stringify(columns) === JSON.stringify(expect.columns), `${row.name}: columns expected ${JSON.stringify(expect.columns)}, received ${JSON.stringify(columns)}`)
    }
    for (const [name, want] of Object.entries(expect.selects ?? {})) {
      const select = [...root.querySelectorAll('select')].find((node) => selectName(node, doc) === name)
      report.check(!!select, `${row.name}: a select named ${JSON.stringify(name)} must render`)
      if (!select) continue
      const values = [...select.querySelectorAll('option')].map((option) => option.value)
      if (want.values) report.check(JSON.stringify(values) === JSON.stringify(want.values), `${row.name}: ${name} values expected ${JSON.stringify(want.values)}, received ${JSON.stringify(values)}`)
      if (want.selected) report.check(select.value === want.selected, `${row.name}: ${name} must show ${JSON.stringify(want.selected)}, received ${JSON.stringify(select.value)}`)
    }
    if (expect.links) {
      const links = [...root.querySelectorAll('a[href]')].map((node) => node.getAttribute('href')).filter((href) => !href.startsWith('#'))
      report.check(JSON.stringify(links) === JSON.stringify(expect.links), `${row.name}: links expected ${JSON.stringify(expect.links)}, received ${JSON.stringify(links)}`)
    }
    const buttons = [...root.querySelectorAll('button')].map((node) => node.getAttribute('aria-label') ?? text(node))
    for (const name of expect.buttons ?? []) report.check(buttons.includes(name), `${row.name}: a button named ${JSON.stringify(name)} must exist`)
    for (const name of expect.absentButtons ?? []) report.check(!buttons.includes(name), `${row.name}: no button may be named ${JSON.stringify(name)}`)
    for (const step of row.press ?? []) {
      calls.length = 0
      const control = [...root.querySelectorAll('button, a')].find((node) => (node.getAttribute('aria-label') ?? text(node)) === step.name)
      report.check(!!control, `${row.name}: a control named ${JSON.stringify(step.name)} must render`)
      if (control) await mounted.act(() => click(window, control))
      report.check(JSON.stringify(calls) === JSON.stringify(step.calls), `${row.name}: ${step.name} must call ${JSON.stringify(step.calls)}, received ${JSON.stringify(calls)}`)
    }
    await mounted.unmount()
  }
})

report.finish(`${fixture.cases.length} cases over the three shipped views.`)

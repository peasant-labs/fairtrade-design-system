#!/usr/bin/env node
/* Mounted-source gate for the village pages of the in-use commons demo. It mounts the REAL
   CommonsApp at each fixtured ?commons=<view> and checks the page's facts: its nav, its text,
   its buttons and switches, the sign-in provider set, and that no select offers `public`.
   Cases: scripts/testdata/commons-demo-pages.yaml (+ .manifest.yaml).
   Run: pnpm test:commons-demo-pages; mutations: pnpm test:commons-demo-pages:mutations. */
import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/commons-demo-pages.yaml'
const MANIFEST = 'scripts/testdata/commons-demo-pages.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { pages: 'requiredPageNames' })
const report = createReport('commons demo pages')
const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim() ?? ''

/* the accessible name a user hears: aria-label, else aria-labelledby, else the visible text. */
function nameOf(node, document) {
  if (node.getAttribute('aria-label')) return node.getAttribute('aria-label')
  const labelledBy = node.getAttribute('aria-labelledby')
  if (labelledBy) return labelledBy.split(/\s+/).map((id) => text(document.getElementById(id))).join(' ')
  if (node.id) {
    const label = document.querySelector(`label[for="${node.id}"]`)
    if (label) return text(label)
  }
  return text(node)
}

await withMountedSource(async ({ load, mount, window, React }) => {
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } })
  const { default: CommonsApp } = await load('/src/mockups/inuse/CommonsApp.jsx')
  for (const page of fixture.pages) {
    window.history.replaceState(null, '', `/?app=commons&commons=${page.view}#inuse`)
    const mounted = await mount(React.createElement(CommonsApp, { theme: 'dark' }))
    const root = mounted.container
    const doc = mounted.document
    const buttons = () => [...root.querySelectorAll('button')].map((node) => nameOf(node, doc))
    if (page.open) {
      const opener = [...root.querySelectorAll('button')].find((node) => nameOf(node, doc).trim() === page.open)
      report.check(!!opener, `${page.name}: the ${page.open} button must exist`)
      if (opener) await mounted.act(() => click(window, opener))
    }
    const body = text(root)
    if (page.nav) {
      const nav = [...root.querySelectorAll('nav[aria-label="village sections"] .iu-subnav-item:not(.iu-subnav-end)')].map(text)
      report.check(JSON.stringify(nav) === JSON.stringify(page.nav), `${page.name}: nav expected ${JSON.stringify(page.nav)}, received ${JSON.stringify(nav)}`)
    }
    if (page.account) report.check(text(root.querySelector('nav[aria-label="village sections"] .iu-subnav-end')) === page.account, `${page.name}: the nav ends with the account link ${page.account}`)
    for (const line of page.text ?? []) report.check(body.includes(line), `${page.name}: the page must show ${JSON.stringify(line)}`)
    for (const line of page.absentText ?? []) report.check(!body.toLowerCase().includes(line.toLowerCase()), `${page.name}: the page must not show ${JSON.stringify(line)}`)
    for (const name of page.buttons ?? []) report.check(buttons().some((label) => label === name || label.startsWith(name)), `${page.name}: a button named ${JSON.stringify(name)} must exist`)
    for (const name of page.absentButtons ?? []) report.check(!buttons().some((label) => label.toLowerCase().startsWith(name)), `${page.name}: no button may be named ${JSON.stringify(name)}`)
    if (page.providers) {
      const providers = [...root.querySelectorAll('.si-split-primary, .si-menu-item')].map((node) => text(node).replace(/^continue with /, '').toLowerCase())
      report.check(JSON.stringify(providers) === JSON.stringify(page.providers), `${page.name}: providers expected ${JSON.stringify(page.providers)}, received ${JSON.stringify(providers)}`)
    }
    if (page.switches) {
      const switches = [...root.querySelectorAll('[role="switch"]')].map((node) => nameOf(node, doc))
      report.check(JSON.stringify(switches) === JSON.stringify(page.switches), `${page.name}: switches expected ${JSON.stringify(page.switches)}, received ${JSON.stringify(switches)}`)
    }
    for (const banned of page.selectOptions ?? []) {
      const options = [...root.querySelectorAll('select option')].map((node) => text(node).toLowerCase())
      report.check(options.length > 0 && !options.includes(banned), `${page.name}: no select may offer ${JSON.stringify(banned)}; options ${JSON.stringify(options)}`)
    }
    await mounted.unmount()
  }
})

report.finish(`${fixture.pages.length} pages.`)

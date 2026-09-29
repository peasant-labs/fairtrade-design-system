#!/usr/bin/env node
/* Mounted-source gate for PromptDigest's split layout: the session list (labels as recorded, one
   tab stop, aria-selected plus the marker class), the j/k and arrow keys with their text-field and
   modifier guards, controlled selection, the reading pane (prompts, collapsed sessions, the leading
   entry), that every chain item lands in exactly one pane, and that the stacked layout is untouched.
   Cases: scripts/testdata/prompt-digest-split.yaml (+ .manifest.yaml).
   Run: pnpm test:prompt-digest-split; mutations: pnpm test:prompt-digest-split:mutations. */
import { loadFixturePair, withMountedSource, keydown, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/prompt-digest-split.yaml'
const MANIFEST = 'scripts/testdata/prompt-digest-split.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })
const report = createReport('prompt digest split')
const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim()
const itemHref = (item) => `https://village.example/transcripts/${item.transcriptId}${item.turnIndex == null ? '' : `#turn-${item.turnIndex}`}`

const digestFor = (name) => {
  const items = fixture.chains[name]
  if (!items) throw new Error(`${FIXTURE}: unknown chain ${JSON.stringify(name)}`)
  return { header: fixture.header, skills: [], items }
}

await withMountedSource(async ({ load, mount, window, React }) => {
  const { default: PromptDigest } = await load('/src/ui/PromptDigest.jsx')
  const field = window.document.createElement('input')
  field.type = 'text'
  window.document.body.appendChild(field)

  const selectedIndex = (root) => [...root.querySelectorAll('[role="option"]')].findIndex((node) => node.getAttribute('aria-selected') === 'true')

  for (const row of fixture.cases) {
    const calls = []
    const props = { digest: digestFor(row.chain), itemHref, layout: 'split', ...(row.props ?? {}), onSelect: (index) => calls.push(index) }
    const mounted = await mount(React.createElement(PromptDigest, props))
    const root = mounted.container
    const list = root.querySelector('ul[role="listbox"]')

    if (row.empty) {
      report.check(!list, `${row.name}: an empty chain renders no list`)
      report.check(text(root.querySelector('.pd-split-empty')) === row.empty, `${row.name}: expected ${JSON.stringify(row.empty)}`)
      await mounted.unmount()
      continue
    }

    const trail = []
    for (const step of row.keys ?? []) {
      const init = Object.fromEntries((step.modifiers ?? []).map((modifier) => [modifier, true]))
      await mounted.act(() => {
        if (step.target === 'list') { list.focus(); keydown(window, list, step.key, init) }
        else if (step.target === 'field') { field.focus(); keydown(window, field, step.key, init) }
        else { window.document.body.focus?.(); keydown(window, window.document.body, step.key, init) }
      })
      trail.push(selectedIndex(root))
    }
    if (row.trail) report.check(JSON.stringify(trail) === JSON.stringify(row.trail), `${row.name}: selection trail expected ${JSON.stringify(row.trail)}, received ${JSON.stringify(trail)}`)
    if (row.expectedSelectCalls) report.check(JSON.stringify(calls) === JSON.stringify(row.expectedSelectCalls), `${row.name}: onSelect calls expected ${JSON.stringify(row.expectedSelectCalls)}, received ${JSON.stringify(calls)}`)

    const options = [...root.querySelectorAll('[role="option"]')].map((node) => ({
      label: text(node.querySelector('.pd-split-option-label')),
      count: text(node.querySelector('.pd-split-option-count')),
    }))
    report.check(JSON.stringify(options) === JSON.stringify(row.options), `${row.name}: options expected ${JSON.stringify(row.options)}, received ${JSON.stringify(options)}`)
    report.check(list?.getAttribute('tabindex') === '0' && root.querySelectorAll('[role="option"][tabindex]').length === 0, `${row.name}: the list must be one tab stop`)
    const index = selectedIndex(root)
    report.check(index === row.selected, `${row.name}: selected option expected ${row.selected}, received ${index}`)
    const marked = [...root.querySelectorAll('.pd-split-option-on')]
    report.check(marked.length === 1 && marked[0].getAttribute('aria-selected') === 'true', `${row.name}: exactly the selected option carries the marker`)
    report.check(list?.getAttribute('aria-activedescendant') === marked[0]?.id, `${row.name}: aria-activedescendant must name the selected option`)

    const pane = root.querySelector('.pd-split-pane')
    report.check(text(pane?.querySelector('.pd-split-pane-title')) === row.pane.title, `${row.name}: pane title expected ${JSON.stringify(row.pane.title)}, received ${JSON.stringify(text(pane?.querySelector('.pd-split-pane-title')))}`)
    const prompts = [...(pane?.querySelectorAll('.pd-prompt-text') ?? [])].map(text)
    report.check(JSON.stringify(prompts) === JSON.stringify(row.pane.prompts), `${row.name}: pane prompts expected ${JSON.stringify(row.pane.prompts)}, received ${JSON.stringify(prompts)}`)
    if (row.pane.collapsed) report.check(text(pane?.querySelector('.pd-split-collapsed'))?.startsWith(row.pane.collapsed), `${row.name}: a collapsed session states ${JSON.stringify(row.pane.collapsed)}`)
    if (row.pane.link) report.check(text(pane?.querySelector('a.pd-split-open')) === row.pane.link, `${row.name}: the pane links out with ${JSON.stringify(row.pane.link)}`)
    await mounted.unmount()
  }

  /* every non-boundary chain item lands in exactly one pane: walk every entry and collect. */
  for (const name of Object.keys(fixture.chains).filter((key) => fixture.chains[key].length > 0)) {
    const items = fixture.chains[name]
    const mounted = await mount(React.createElement(PromptDigest, { digest: digestFor(name), itemHref, layout: 'split' }))
    const list = mounted.container.querySelector('ul[role="listbox"]')
    const seen = []
    const count = mounted.container.querySelectorAll('[role="option"]').length
    for (let i = 0; i < count; i += 1) {
      const pane = mounted.container.querySelector('.pd-split-pane')
      for (const node of pane.querySelectorAll('.pd-prompt-text, .pd-skill-text, .pd-sha')) seen.push(text(node))
      await mounted.act(() => { list.focus(); keydown(window, list, 'ArrowDown') })
    }
    const expected = items.filter((item) => item.kind !== 'session').map((item) => (item.kind === 'commit' ? item.commitSha.slice(0, 7) : item.text))
    report.check(JSON.stringify([...seen].sort()) === JSON.stringify([...expected].sort()), `${name}: every chain item must show in exactly one pane; expected ${JSON.stringify(expected)}, received ${JSON.stringify(seen)}`)
    await mounted.unmount()
  }

  /* the stacked layout is the default and renders the one chain unchanged. */
  {
    const digest = digestFor('many-sessions')
    const mounted = await mount(React.createElement(PromptDigest, { digest, itemHref }))
    const chain = mounted.container.querySelector('section.pd > ul.pd-chain')
    const sessions = digest.items.filter((item) => item.kind === 'session').length
    const prompts = digest.items.filter((item) => item.kind === 'prompt').length
    report.check(!mounted.container.querySelector('.pd-split') && !!chain && chain.children.length === sessions + prompts && !mounted.container.querySelector('.pd-layout-split'), 'the stacked layout must render the one chain unchanged')
    await mounted.unmount()
  }
  field.remove()
})

report.finish(`${fixture.cases.length} split cases, item coverage over ${Object.keys(fixture.chains).length - 1} chains and the stacked default.`)

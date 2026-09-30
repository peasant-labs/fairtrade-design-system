#!/usr/bin/env node
/* Mounted-source gate for RepoPicker: search, select all and clear on the visible repositories,
   the running count, both owner identity kinds, an empty result, and the saved difference.
   Cases: scripts/testdata/repo-picker.yaml (+ .manifest.yaml).
   Run: pnpm test:repo-picker; mutations: pnpm test:repo-picker:mutations. */
import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/repo-picker.yaml'
const MANIFEST = 'scripts/testdata/repo-picker.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames', groupedCases: 'requiredGroupedNames' })
const report = createReport('repo picker')
const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim() ?? ''

await withMountedSource(async ({ load, mount, window, React }) => {
  const { RepoPicker } = await load('/src/ui/index.js')
  for (const row of fixture.cases) {
    const saved = []
    const mounted = await mount(React.createElement(RepoPicker, { open: true, onClose: () => {}, owners: fixture.owners, initialSelected: fixture.initialSelected, onSave: (diff) => saved.push(diff) }))
    const root = mounted.container
    const buttonNamed = (name) => [...root.querySelectorAll('button')].find((button) => text(button) === name || text(button).startsWith(name))
    for (const step of row.steps) {
      const [kind, arg] = step.split(/:(.*)/s)
      await mounted.act(() => {
        if (kind === 'search') {
          const input = root.querySelector('input[type="search"]')
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, arg)
          input.dispatchEvent(new window.Event('input', { bubbles: true }))
        } else if (kind === 'toggle') {
          const box = [...root.querySelectorAll('.rpk-repo-row')].find((label) => text(label.querySelector('.rpk-repo-name')) === arg)?.querySelector('input')
          if (!box) throw new Error(`${row.name}: no visible repository ${arg}`)
          click(window, box)
        } else if (kind === 'select-all') click(window, buttonNamed('select all'))
        else if (kind === 'clear') click(window, buttonNamed('clear'))
        else if (kind === 'save') click(window, root.querySelector('.rpk-foot .btn-primary'))
        else throw new Error(`${FIXTURE}: unknown step ${JSON.stringify(step)}`)
      })
    }
    const expected = row.expected
    const visible = [...root.querySelectorAll('.rpk-repo-name')].map(text)
    if (expected.visible) report.check(JSON.stringify(visible) === JSON.stringify(expected.visible), `${row.name}: visible expected ${JSON.stringify(expected.visible)}, received ${JSON.stringify(visible)}`)
    if (expected.count) report.check(text(root.querySelector('.rpk-count')) === expected.count, `${row.name}: count expected ${JSON.stringify(expected.count)}, received ${JSON.stringify(text(root.querySelector('.rpk-count')))}`)
    if (expected.save) report.check(text(root.querySelector('.rpk-foot .btn-primary')) === expected.save, `${row.name}: save label expected ${JSON.stringify(expected.save)}, received ${JSON.stringify(text(root.querySelector('.rpk-foot .btn-primary')))}`)
    if (expected.owners) {
      // the heading's accessible text: the decorative mark (aria-hidden) is not part of it
      const spoken = (head) => { const copy = head.cloneNode(true); copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove()); return text(copy) }
      const owners = [...root.querySelectorAll('.rpk-owner-head')].map(spoken)
      report.check(JSON.stringify(owners) === JSON.stringify(expected.owners), `${row.name}: owners expected ${JSON.stringify(expected.owners)}, received ${JSON.stringify(owners)}`)
    }
    if (expected.ownerMarks) {
      const marks = [...root.querySelectorAll('.rpk-owner-head')].map((head) => (head.querySelector('.lucide-building-2') ? 'organisation icon' : head.querySelector('.av, .rpk-owner-avatar') ? 'avatar' : 'none'))
      report.check(JSON.stringify(marks) === JSON.stringify(expected.ownerMarks), `${row.name}: owner marks expected ${JSON.stringify(expected.ownerMarks)}, received ${JSON.stringify(marks)}`)
    }
    if (expected.empty) report.check(text(root.querySelector('.rpk-empty')) === expected.empty, `${row.name}: empty expected ${JSON.stringify(expected.empty)}`)
    if (expected.saved) report.check(JSON.stringify(saved) === JSON.stringify([expected.saved]), `${row.name}: saved expected ${JSON.stringify([expected.saved])}, received ${JSON.stringify(saved)}`)
    await mounted.unmount()
  }

  const { GroupedMultiSelect } = await load('/src/ui/index.js')
  for (const row of fixture.groupedCases) {
    let selected = []
    const mounted = await mount(React.createElement(GroupedMultiSelect, { groups: fixture.groupedGroups, searchable: row.searchable, ariaLabel: 'projects', onChange: (next) => { selected = [...next] } }))
    const root = mounted.container
    for (const step of row.steps) {
      const [kind, arg] = step.split(/:(.*)/s)
      await mounted.act(() => {
        if (kind === 'search') {
          const input = root.querySelector('.gms-search input')
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, arg)
          input.dispatchEvent(new window.Event('input', { bubbles: true }))
        } else if (kind === 'select-all') click(window, root.querySelector('.gms-selectall'))
        else if (kind === 'clear') click(window, root.querySelector('.gms-clear'))
        else throw new Error(`${FIXTURE}: unknown step ${JSON.stringify(step)}`)
      })
    }
    const expected = row.expected
    if (expected.groups) {
      const groups = [...root.querySelectorAll('.gms-group-label')].map(text)
      report.check(JSON.stringify(groups) === JSON.stringify(expected.groups), `${row.name}: groups expected ${JSON.stringify(expected.groups)}, received ${JSON.stringify(groups)}`)
    }
    if (expected.items) {
      const items = [...root.querySelectorAll('.gms-item-label')].map(text)
      report.check(JSON.stringify(items) === JSON.stringify(expected.items), `${row.name}: items expected ${JSON.stringify(expected.items)}, received ${JSON.stringify(items)}`)
    }
    report.check(JSON.stringify([...selected].sort()) === JSON.stringify([...expected.selected].sort()), `${row.name}: selected expected ${JSON.stringify(expected.selected)}, received ${JSON.stringify(selected)}`)
    report.check(!!root.querySelector('.gms-search') === row.searchable && !!root.querySelector('.gms-clear') === row.searchable, `${row.name}: the search field and clear render only when searchable`)
    await mounted.unmount()
  }
})

report.finish(`${fixture.cases.length} picker cases and ${fixture.groupedCases.length} grouped search cases.`)

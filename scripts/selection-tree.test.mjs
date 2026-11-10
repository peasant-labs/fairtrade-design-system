#!/usr/bin/env node
/* Mounted gate for SelectionTree. Cases live in scripts/testdata/selection-tree.yaml.
   The component under test is the barrel export, the same path a host imports. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createReport, loadFixturePair, withMountedSource } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/selection-tree.yaml'
const MANIFEST = 'scripts/testdata/selection-tree.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })
const report = createReport('selection tree')
const source = readFileSync(resolve('src/ui/SelectionTree.jsx'), 'utf8')

await withMountedSource(async ({ load, mount, window, React }) => {
  const ui = await load('/src/ui/index.js')
  const { SelectionTree, SELECTION_TREE_PROPS } = ui

  for (const row of fixture.cases) {
    if (row.steps) {
      for (const [index, step] of row.steps.entries()) {
        const emitted = await renderAndToggle(mount, window, React, SelectionTree, step)
        report.check(
          JSON.stringify(emitted) === JSON.stringify([step.expectIds]),
          `${row.name} step ${index + 1}: expected ids ${JSON.stringify(step.expectIds)}, received ${JSON.stringify(emitted)}`,
        )
        report.check(
          !step.expectIds.some((id) => id.startsWith('project-') || id.startsWith('group-') || id.startsWith('branch-')),
          `${row.name} step ${index + 1}: the reported set must be session ids, not group ids`,
        )
      }
      continue
    }

    const emitted = []
    const props = {
      nodes: row.nodes,
      ariaLabel: 'sessions',
      onSelectionChange: (ids) => { emitted.push([...ids]) },
      ...(row.paging ?? {}),
    }
    if (row.value) props.value = row.value
    const mounted = await mount(React.createElement(SelectionTree, props))
    const root = mounted.container
    const expected = row.expect

    if (expected.kinds) {
      const kinds = [...root.querySelectorAll('[data-kind]')].map((node) => node.getAttribute('data-kind'))
      report.check(JSON.stringify(kinds) === JSON.stringify(expected.kinds), `${row.name}: kinds expected ${JSON.stringify(expected.kinds)}, received ${JSON.stringify(kinds)}`)
    }
    if (expected.labels) {
      const labels = [...root.querySelectorAll('.st-label')].map((node) => node.textContent)
      report.check(JSON.stringify(labels) === JSON.stringify(expected.labels), `${row.name}: labels expected ${JSON.stringify(expected.labels)}, received ${JSON.stringify(labels)}`)
    }
    if (expected.absent) {
      const text = root.textContent ?? ''
      for (const label of expected.absent) {
        report.check(!text.includes(label), `${row.name}: dropped label ${JSON.stringify(label)} must not render`)
      }
    }
    if (expected.states) {
      for (const [id, state] of Object.entries(expected.states)) {
        const rowEl = root.querySelector(`[data-node-id="${id}"]`)
        const input = rowEl?.querySelector('input[type="checkbox"]')
        report.check(rowEl?.getAttribute('data-state') === state.state, `${row.name}: ${id} state expected ${state.state}, received ${rowEl?.getAttribute('data-state')}`)
        report.check(input?.checked === state.checked, `${row.name}: ${id} checked expected ${state.checked}, received ${input?.checked}`)
        report.check(input?.indeterminate === state.mixed, `${row.name}: ${id} mixed expected ${state.mixed}, received ${input?.indeterminate}`)
        report.check(input?.getAttribute('aria-checked') === (state.mixed ? 'mixed' : state.checked ? 'true' : 'false'), `${row.name}: ${id} aria-checked does not match the host state`)
      }
    }
    if (expected.locked) {
      for (const id of expected.locked) {
        const input = root.querySelector(`[data-node-id="${id}"] input[type="checkbox"]`)
        report.check(input?.disabled === true, `${row.name}: ${id} checkbox must be disabled`)
        report.check((root.querySelector(`[data-node-id="${id}"]`)?.textContent ?? '').includes(expected.announced), `${row.name}: ${id} must announce ${expected.announced}`)
      }
    }
    if (expected.counts) {
      for (const [id, count] of Object.entries(expected.counts)) {
        const text = root.querySelector(`[data-node-id="${id}"] .st-count`)?.textContent ?? ''
        report.check(text.includes(count), `${row.name}: ${id} count expected ${count}, received ${JSON.stringify(text)}`)
      }
    }
    if (expected.unknownKind !== undefined) {
      report.check(root.querySelector('.st')?.getAttribute('data-unknown-kind') === String(expected.unknownKind), `${row.name}: unknown kind count expected ${expected.unknownKind}`)
    }
    if (expected.unknownState !== undefined) {
      report.check(root.querySelector('.st')?.getAttribute('data-unknown-state') === String(expected.unknownState), `${row.name}: unknown state count expected ${expected.unknownState}`)
    }
    if (expected.diagnostic) {
      report.check(root.querySelector('.st-diagnostic')?.textContent === expected.diagnostic, `${row.name}: diagnostic expected ${JSON.stringify(expected.diagnostic)}, received ${JSON.stringify(root.querySelector('.st-diagnostic')?.textContent)}`)
    }
    if (expected.labelCase) {
      const label = root.querySelector('.st-label')
      const css = readFileSync(resolve('src/ui/SelectionTree.css'), 'utf8')
      report.check(label?.textContent === 'IngestPipeline', `${row.name}: label must keep IngestPipeline`)
      report.check(css.includes('.st-label') && css.includes('text-transform: none') && !css.includes('text-transform: lowercase'), `${row.name}: label css must not lowercase user content`)
    }
    if (expected.forbiddenProps) {
      report.check(
        JSON.stringify([...SELECTION_TREE_PROPS]) === JSON.stringify(['nodes', 'value', 'onSelectionChange', 'ariaLabel']),
        `${row.name}: the public prop list gained a paging prop`,
      )
      for (const name of expected.forbiddenProps) {
        report.check(!SELECTION_TREE_PROPS.includes(name), `${row.name}: ${name} must not be a SelectionTree prop`)
        report.check(!new RegExp(`\\b${name}\\b`).test(source.split('function SelectionTree')[1]?.split('{')[0] ?? ''), `${row.name}: ${name} must not be a destructured prop`)
      }
    }
    if (expected.noStorage) {
      report.check(!source.includes('localStorage') && !source.includes('sessionStorage'), `${row.name}: the tree must not store a second copy`)
    }
    if (row.toggle) {
      await fireChange(mounted, window, row.toggle)
    }
    if (expected.emitted) {
      report.check(JSON.stringify(emitted) === JSON.stringify(expected.emitted), `${row.name}: emitted expected ${JSON.stringify(expected.emitted)}, received ${JSON.stringify(emitted)}`)
    }
    if (expected.emittedIds) {
      report.check(JSON.stringify(emitted) === JSON.stringify([expected.emittedIds]), `${row.name}: emitted ids expected ${JSON.stringify(expected.emittedIds)}, received ${JSON.stringify(emitted)}`)
    }
    await mounted.unmount()
  }
})

report.finish(`${fixture.cases.length} selection tree cases.`)

/**
 * @param {Function} mount
 * @param {Window} window
 * @param {typeof import('react')} React
 * @param {Function} SelectionTree
 * @param {{ nodes: unknown, value?: unknown, toggle: string, paging?: object }} step
 */
async function renderAndToggle(mount, window, React, SelectionTree, step) {
  /** @type {string[][]} */
  const emitted = []
  const props = {
    nodes: step.nodes,
    ariaLabel: 'sessions',
    onSelectionChange: (ids) => { emitted.push([...ids]) },
  }
  if (step.value) props.value = step.value
  const mounted = await mount(React.createElement(SelectionTree, props))
  await fireChange(mounted, window, step.toggle)
  await mounted.unmount()
  return emitted
}

/**
 * @param {{ act: Function, container: Element }} mounted
 * @param {Window} window
 * @param {string} id
 */
async function fireChange(mounted, window, id) {
  const input = mounted.container.querySelector(`[data-node-id="${id}"] input[type="checkbox"]`)
  if (!input) throw new Error(`selection tree: no checkbox for ${id}`)
  // React delivers a checkbox onChange from the click, which is what a
  // pointer does. jsdom does not also flip the checked bit; the handler
  // reads the host state, not the event.
  input.focus()
  await mounted.act(() => {
    input.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

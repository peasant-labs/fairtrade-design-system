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
  const { SelectionTree } = ui

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

    if (row.rerender) {
      const emitted = []
      const onSelectionChange = (ids) => emitted.push([...ids])
      const mounted = await mount(React.createElement(SelectionTree, { nodes: row.nodes, value: row.value, onSelectionChange }))
      await mounted.rerender(React.createElement(SelectionTree, { nodes: row.rerender.nodes, value: row.rerender.value, onSelectionChange }))
      await fireChange(mounted, window, row.rerender.toggle)
      report.check(JSON.stringify(emitted) === JSON.stringify([row.rerender.expectIds]), `${row.name}: host selection after rescan`)
      await mounted.unmount()
      continue
    }

    const emitted = []
    const previews = []
    const props = {
      nodes: row.nodes,
      value: row.value ?? [],
      ariaLabel: 'sessions',
      onSelectionChange: (ids) => { emitted.push([...ids]) },
      ...(row.paging ?? {}),
    }
    if (row.value) props.value = row.value
    if (row.preview) {
      props.onPreview = (id) => { previews.push(id) }
      if (row.preview.previewId) props.previewId = row.preview.previewId
    }
    const mounted = await mount(React.createElement(SelectionTree, props))
    const root = mounted.container
    const expected = row.expect

    if (expected.kinds) {
      const kinds = [...root.querySelectorAll('[data-kind]')].map((node) => node.getAttribute('data-kind'))
      report.check(JSON.stringify(kinds) === JSON.stringify(expected.kinds), `${row.name}: kinds expected ${JSON.stringify(expected.kinds)}, received ${JSON.stringify(kinds)}`)
    }
    if (expected.depths) {
      const depths = [...root.querySelectorAll('[data-node-id]')].map((node) => Number(node.getAttribute('data-depth')))
      report.check(JSON.stringify(depths) === JSON.stringify(expected.depths), `${row.name}: nesting depth`)
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
        report.check((input?.getAttribute('aria-label') ?? '').includes(expected.announced), `${row.name}: ${id} accessible name must announce ${expected.announced}`)
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
      const params = source.match(/function SelectionTree\s*\(([\s\S]*?)\)\s*\{/)?.[1] ?? null
      report.check(params !== null, `${row.name}: cannot read parameter list`)
      for (const name of expected.forbiddenProps) {
        report.check(params !== null && !new RegExp(`\\b${name}\\b`).test(params), `${row.name}: ${name} must not be a destructured prop`)
      }
    }
    if (expected.noStorage) {
      report.check(!source.includes('localStorage') && !source.includes('sessionStorage'), `${row.name}: the tree must not store a second copy`)
    }
    if (expected.facts) {
      for (const [id, facts] of Object.entries(expected.facts)) {
        const rowEl = root.querySelector(`[data-node-id="${id}"] > .st-row`)
        // The tally is the phrase as drawn: the kind, the colon, the number, the noun.
        const text = (rowEl?.querySelector(':scope > .st-facts > .st-tally')?.textContent ?? '')
          .replace(/\s+/g, ' ').trim()
        report.check(text === facts, `${row.name}: ${id} facts expected ${JSON.stringify(facts)}, received ${JSON.stringify(text)}`)
      }
    }
    if (expected.pressed) {
      for (const [id, pressed] of Object.entries(expected.pressed)) {
        const rowEl = root.querySelector(`[data-node-id="${id}"] > .st-row`)
        const title = rowEl?.querySelector(':scope > button.st-title')
        report.check(title?.getAttribute('aria-pressed') === String(pressed), `${row.name}: ${id} title aria-pressed expected ${pressed}, received ${title?.getAttribute('aria-pressed')}`)
        report.check((rowEl?.getAttribute('data-previewed') === 'true') === pressed, `${row.name}: ${id} row mark expected ${pressed ? 'present' : 'absent'}`)
      }
      // The mark is the selection inset (a shape at the row's start), not a fill alone.
      const css = readFileSync(resolve('src/ui/SelectionTree.css'), 'utf8')
      const rule = css.match(/\.st-row\[data-previewed\]::before\s*\{([^}]*)\}/)?.[1] ?? ''
      report.check(/box-shadow:\s*inset var\(--stroke-emphasis\)/.test(rule), `${row.name}: the previewed row must carry the selection inset, not colour alone`)
    }
    if (expected.titleNames) {
      for (const [id, name] of Object.entries(expected.titleNames)) {
        const title = root.querySelector(`[data-node-id="${id}"] > .st-row > button.st-title`)
        report.check(title?.getAttribute('aria-label') === name, `${row.name}: ${id} title name expected ${JSON.stringify(name)}, received ${JSON.stringify(title?.getAttribute('aria-label'))}`)
        report.check(title?.closest('label') === null, `${row.name}: ${id} title must sit outside the checkbox label`)
      }
    }
    if (expected.checkboxNames) {
      for (const [id, name] of Object.entries(expected.checkboxNames)) {
        const input = root.querySelector(`[data-node-id="${id}"] > .st-row input[type="checkbox"]`)
        report.check(input?.getAttribute('aria-label') === name, `${row.name}: ${id} checkbox name expected ${JSON.stringify(name)}, received ${JSON.stringify(input?.getAttribute('aria-label'))}`)
      }
    }
    if (expected.titleButtons !== undefined) {
      const count = root.querySelectorAll('button.st-title').length
      report.check(count === expected.titleButtons, `${row.name}: title buttons expected ${expected.titleButtons}, received ${count}`)
    }
    if (row.rail) {
      // The connector is measured after a frame; jsdom has no layout, so it counts anchors.
      await mounted.settle(20)
      const rail = root.querySelector('svg.st-rail')
      const anchors = Number(rail?.getAttribute('data-anchor-count'))
      report.check(anchors === expected.anchors, `${row.name}: rail anchors expected ${expected.anchors}, received ${anchors}`)
      report.check(root.querySelectorAll('svg.st-rail .st-rail__path').length === 1, `${row.name}: one connector path is drawn`)
      report.check(rail?.getAttribute('aria-hidden') === 'true', `${row.name}: the rail must be hidden from assistive technology`)
      if (expected.railHidden) {
        report.check(rail?.querySelector('[role], [aria-label], title, text') === null, `${row.name}: the rail must carry no name or text`)
        const css = readFileSync(resolve('src/ui/SelectionTree.css'), 'utf8')
        report.check(/\.st-rail\s*\{[^}]*pointer-events:\s*none/.test(css), `${row.name}: the rail must take no pointer events`)
      }
      if (row.rail.fold) {
        const caret = root.querySelector(`[data-node-id="${row.rail.fold}"] > .st-row > .st-disclosure`)
        await mounted.act(() => caret.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })))
        await mounted.settle(20)
        const folded = Number(root.querySelector('svg.st-rail')?.getAttribute('data-anchor-count'))
        report.check(folded === expected.foldedAnchors, `${row.name}: rail anchors after folding ${row.rail.fold} expected ${expected.foldedAnchors}, received ${folded}`)
        report.check(root.querySelectorAll(`[data-node-id="${row.rail.fold}"] .st-children`).length === 0, `${row.name}: a folded row mounts no children`)
      }
    }
    if (row.preview?.click) {
      const target = root.querySelector(`[data-node-id="${row.preview.target}"] > .st-row`)
      const control = row.preview.click === 'title'
        ? target?.querySelector(':scope > button.st-title')
        : target?.querySelector('input[type="checkbox"]')
      if (!control) throw new Error(`selection tree: no ${row.preview.click} for ${row.preview.target}`)
      control.focus()
      await mounted.act(() => control.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })))
    }
    if (row.labelClick) {
      const label = root.querySelector(`[data-node-id="${row.labelClick}"] > .st-row .st-label`)
      if (!label) throw new Error(`selection tree: no label for ${row.labelClick}`)
      await mounted.act(() => label.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })))
    }
    if (expected.previews) {
      report.check(JSON.stringify(previews) === JSON.stringify(expected.previews), `${row.name}: previews expected ${JSON.stringify(expected.previews)}, received ${JSON.stringify(previews)}`)
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
    value: step.value ?? [],
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

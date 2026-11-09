#!/usr/bin/env node
/* Mounted-source gate for the canonical transcript library table core and its
   saved view (fairtrade#229 PR-2). It loads the REAL component through vite's
   ssrLoadModule, mounts it into jsdom, and asserts what a reader reaches: the
   caption and table role, host columns, group headers and their toggles, the one
   compact continuation row, the end-of-page continues marker, multi-membership
   row rendering, the required row key, the numbered pager, the column and
   group-by pickers, their keyboard behaviour and announced state, and that the
   controlled table writes neither storage nor history.

   Cases: scripts/testdata/transcript-library-table.yaml (+ .manifest.yaml).
   Run: pnpm test:datatable (this gate is one leg).
   Mutations: node scripts/parts-mutations.mjs scripts/transcript-library-table.render.test.mjs scripts/testdata/transcript-library-table.manifest.yaml */
import assert from 'node:assert/strict'
import { keydown, loadFixturePair, withMountedSource } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-library-table.yaml'
const MANIFEST = 'scripts/testdata/transcript-library-table.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, {
  cases: 'requiredCaseNames',
  helpers: 'requiredHelperNames',
  refusals: 'requiredRefusalNames',
})

/* One runtime call per refusal kind. Kept beside the fixture so a case cannot name
   a branch the gate never executes. */
const REFUSALS = {
  'align-unknown-wire': ({ parseColumnAlign }) => parseColumnAlign('middle'),
  'align-unknown-member': ({ parseColumnAlign }) => parseColumnAlign({ wire: 'middle', label: 'middle' }),
  'align-not-a-value': ({ parseColumnAlign }) => parseColumnAlign(42),
  'group-rows-not-array': ({ groupBy, groupPageRows }) => groupPageRows('nope', groupBy, () => [], (id) => id, null),
  'group-keys-not-function': ({ groupBy, groupPageRows }) => groupPageRows([], groupBy, 'nope', (id) => id, null),
  'group-label-not-function': ({ groupBy, groupPageRows }) => groupPageRows([], groupBy, () => [], 'nope', null),
  'group-by-not-member': ({ groupPageRows }) => groupPageRows([], {}, () => [], (id) => id, null),
  'group-keys-not-array': ({ groupBy, groupPageRows }) => groupPageRows([{ projects: ['alpha'] }], groupBy, () => 'nope', (id) => id, null),
  'group-key-empty': ({ groupBy, groupPageRows }) => groupPageRows([{ projects: ['alpha'] }], groupBy, () => [''], (id) => id, null),
  'group-label-not-string': ({ groupBy, groupPageRows }) => groupPageRows([{ projects: ['alpha'] }], groupBy, (row) => row.projects, () => 42, null),
  'keys-for-rows-not-array': ({ groupKeysFor }) => groupKeysFor('nope', () => []),
  'keys-for-not-function': ({ groupKeysFor }) => groupKeysFor([], 'nope'),
  'keys-for-keys-not-array': ({ groupKeysFor }) => groupKeysFor([{ projects: ['alpha'] }], () => 'nope'),
  'keys-for-key-empty': ({ groupKeysFor }) => groupKeysFor([{ projects: ['alpha'] }], () => ['']),
  'keys-for-key-number': ({ groupKeysFor }) => groupKeysFor([{ projects: ['alpha'] }], () => [3]),
}

await withMountedSource(async ({ load, mount, React, window }) => {
  const { TranscriptLibraryTable } = await load('/src/ui/TranscriptLibraryTable.jsx')
  const { groupKeysFor, groupPageRows } = await load('/src/ui/groupPageRows.js')
  const { closed } = await load('/src/ui/closed-value.js')
  const { ColumnAlign, parseColumnAlign } = await load('/src/ui/table/column-align.js')

  const ALIGN = {
    start: ColumnAlign.Start,
    end: ColumnAlign.End,
    center: ColumnAlign.Center,
    decimal: ColumnAlign.Decimal,
  }
  const groupBy = closed(fixture.groupBy.wire, fixture.groupBy.label)
  const groupByOptions = fixture.groupByOptions.map((option) => closed(option.wire, option.label))
  const groupKeys = (row) => row.projects
  const columns = fixture.columns.map((def) => columnFor(def, closed, ALIGN))
  const columnsById = new Map(columns.map((column) => [column.id.wire, column]))

  // The controlled table must never read or write the host's storage or history.
  // Replace both with recorders for the whole run, then assert the record is empty
  // after every mount and interaction.
  const writes = []
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem(key) { writes.push(['getItem', key]); return null },
      setItem(...args) { writes.push(['setItem', ...args]) },
      removeItem(...args) { writes.push(['removeItem', ...args]) },
      clear() { writes.push(['clear']) },
      key() { return null },
      get length() { return 0 },
    },
  })
  for (const name of ['pushState', 'replaceState']) {
    Object.defineProperty(window.history, name, {
      configurable: true,
      value: (...args) => writes.push([name, ...args]),
    })
  }
  const startHref = window.location.href

  for (const row of fixture.cases) {
    assert.equal(typeof row.name, 'string', `${FIXTURE}: every case needs a name`)
    assert.ok(Array.isArray(row.rows), `${row.name}: rows must be a list`)
    assert.ok(row.omitRowKey || row.omitViewCallback || row.omitPageSizeCallback || Array.isArray(row.expectedRows), `${row.name}: expectedRows must be a list`)

    const calls = { labels: [], pages: [], sizes: [], views: [] }
    const elementFor = (viewSpec) => React.createElement(TranscriptLibraryTable, {
      caption: fixture.caption,
      rows: row.rows,
      ...(row.omitRowKey ? {} : { rowKey: (transcript) => transcript.key }),
      columns: row.columns === 'align' ? fixture.alignColumns.map((def) => columnFor(def, closed, ALIGN)) : columns,
      groupBy,
      groupByOptions,
      groupKeys,
      groupLabel: (id) => {
        calls.labels.push(id)
        return id
      },
      nextGroupKeys: row.nextGroupKeys ?? null,
      continuedGroupKeys: row.continuedGroupKeys ?? null,
      page: row.page ?? null,
      ...(row.omitViewCallback ? {} : { onViewStateChange: (view) => calls.views.push(view) }),
      viewState: viewFor(viewSpec ?? row.view, groupBy, groupByOptions, columnsById, closed),
      onPageChange: (index) => calls.pages.push(index),
      ...(row.omitPageSizeCallback ? {} : { onPageSizeChange: (size) => calls.sizes.push(size) }),
    })

    if (row.omitRowKey || row.omitViewCallback || row.omitPageSizeCallback) {
      await assert.rejects(
        () => mount(elementFor(row.view)),
        (error) => {
          assert.ok(String(error?.message).includes(row.expectedError), `${row.name}: expected ${JSON.stringify(row.expectedError)}, received ${String(error?.message)}`)
          return true
        },
        `${row.name}: ${row.omitViewCallback ? 'a saved view without a change callback' : row.omitPageSizeCallback ? 'a paged table without a page-size callback' : 'a missing rowKey'} must be refused`,
      )
      console.log(`passes: ${row.name}`)
      continue
    }

    const mounted = await mount(elementFor(row.view))
    try {
      const { container, document } = mounted
      const table = container.querySelector('table')
      assert.ok(table, `${row.name}: the table element must mount`)
      assert.equal(table.querySelector('caption')?.textContent, fixture.caption, `${row.name}: the caption names the table`)

      assert.deepEqual(renderedRows(container), row.expectedRows, `${row.name}: rendered grouping order and text`)
      if (row.expectedRenderedRows !== undefined) {
        assert.equal(container.querySelectorAll('tbody tr[data-row-kind="row"]').length, row.expectedRenderedRows, `${row.name}: rendered row count`)
      }
      if (row.expectedRowKeys) {
        assert.deepEqual(renderedRowKeys(container), row.expectedRowKeys, `${row.name}: every rendered row is keyed by rowKey`)
      }
      if (row.expectedLabels) {
        assert.deepEqual(calls.labels, row.expectedLabels, `${row.name}: groupLabel receives the qualified id exactly once per group`)
      }
      if (row.expectedAlignClasses) {
        const headers = [...container.querySelectorAll('thead th')]
        const cells = [...container.querySelectorAll('tbody tr[data-row-kind="row"]')][0].querySelectorAll('td')
        row.expectedAlignClasses.forEach((expected, index) => {
          assert.equal(headers[index]?.className, expected.header, `${row.name}: header ${index} alignment`)
          assert.equal(cells[index]?.className, expected.cell, `${row.name}: cell ${index} alignment`)
        })
      }
      if (row.expectColumns) {
        assert.deepEqual(headerLabels(container), row.expectColumns, `${row.name}: the saved view decides which columns render`)
      }
      if (row.expectedExpanded) {
        assert.deepEqual(expandedStates(container), row.expectedExpanded, `${row.name}: every group toggle announces its expanded state`)
      }
      if (row.expectScrollRegion) {
        const region = container.querySelector('.tbl-scroll')
        assert.ok(region, `${row.name}: the table keeps its scroll region`)
        assert.equal(region.getAttribute('role'), 'region', `${row.name}: the scroll region has the region role`)
        assert.equal(region.getAttribute('aria-label'), fixture.caption, `${row.name}: the scroll region is named by the caption`)
        assert.equal(region.getAttribute('tabindex'), '0', `${row.name}: the scroll region is keyboard focusable`)
      }
      if (row.expectPickers === false) {
        assert.equal(container.querySelectorAll('.libt-pick').length, 0, `${row.name}: no saved view means no pickers to report to`)
      }
      if (row.expectGroupByLabel) {
        assert.equal(container.querySelector('.libt-pick-btn')?.textContent, row.expectGroupByLabel, `${row.name}: the group-by trigger names the current grouping`)
      }
      if (row.expectNoPager) {
        assert.equal(container.querySelector('.pgn'), null, `${row.name}: a null page hides the numbered pager`)
      } else {
        assert.ok(container.querySelector('.pgn'), `${row.name}: a paged table renders the numbered pager`)
        assert.equal(container.querySelector('[role="status"]')?.textContent, row.expectedPage, `${row.name}: the pager names the page and page count`)
      }
      if (row.changePageSize !== undefined) {
        const select = container.querySelector('select[aria-label="page size"]')
        assert.ok(select, `${row.name}: the pager renders the page-size control`)
        await mounted.act(() => {
          select.value = String(row.changePageSize)
          select.dispatchEvent(new window.Event('change', { bubbles: true }))
        })
        assert.deepEqual(calls.sizes, row.expectedPageSizeChanges, `${row.name}: the page-size control reports the chosen size`)
        assert.deepEqual(calls.pages, [], `${row.name}: a page-size change leaves the page alone`)
      }
      if (row.click) {
        const target = container.querySelector(row.click)
        assert.ok(target, `${row.name}: ${row.click} must mount`)
        await mounted.act(() => target.click())
        assert.deepEqual(calls.pages, [row.expectedPageChange], `${row.name}: the numbered pager reports the 1-based page it navigates to`)
      }
      if (row.clickColumn) {
        await openPicker(container, mounted, 'columns', row.name)
        const target = pickerChoice(container, 'columns', row.clickColumn)
        assert.ok(target, `${row.name}: the column ${row.clickColumn} must have a picker row`)
        await mounted.act(() => target.click())
      }
      if (row.clickGroupBy) {
        await openPicker(container, mounted, 'group by', row.name)
        const target = pickerChoice(container, 'group by', row.clickGroupBy)
        assert.ok(target, `${row.name}: the grouping ${row.clickGroupBy} must have a picker row`)
        await mounted.act(() => target.click())
      }
      if (row.clickGroup) {
        const target = [...container.querySelectorAll('.libt-group-toggle')]
          .find((button) => button.querySelector('.libt-group-label')?.textContent?.startsWith(row.clickGroup))
        assert.ok(target, `${row.name}: the group ${row.clickGroup} must have a toggle`)
        await mounted.act(() => target.click())
      }
      if (row.expectedViewChanges) {
        assert.deepEqual(viewWires(calls.views), row.expectedViewChanges, `${row.name}: the table reports the composed view it was given`)
      }
      if (row.keyboard) {
        await assertKeyboard(window, container, document, mounted, row.name)
      }
      if (row.rerenderView) {
        await mounted.rerender(elementFor(row.rerenderView))
        if (row.expectedExpandedAfter) {
          assert.deepEqual(expandedStates(container), row.expectedExpandedAfter, `${row.name}: the collapsed group announces collapsed`)
        }
        if (row.expectedRenderedRowsAfter !== undefined) {
          assert.equal(container.querySelectorAll('tbody tr[data-row-kind="row"]').length, row.expectedRenderedRowsAfter, `${row.name}: a collapsed group renders no rows`)
        }
      }
      assert.deepEqual(writes, [], `${row.name}: the table must not write localStorage or history`)
      assert.equal(window.location.href, startHref, `${row.name}: the table must not change the URL`)
      console.log(`passes: ${row.name}`)
    } finally {
      await mounted.unmount()
    }
  }

  for (const helper of fixture.helpers) {
    assert.ok(Array.isArray(helper.rows) && Array.isArray(helper.expected), `${helper.name}: needs rows and expected`)
    assert.deepEqual(groupKeysFor(helper.rows, groupKeys), helper.expected, `${helper.name}: bare, de-duplicated, first-appearance order`)
    console.log(`passes: ${helper.name}`)
  }

  // The exported parsers and the grouping helpers refuse at their boundaries at
  // RUNTIME, not only in a type test: each case names the TypeError it must raise.
  for (const refusal of fixture.refusals) {
    const runner = REFUSALS[refusal.kind]
    assert.ok(runner, `${refusal.name}: unknown refusal kind ${JSON.stringify(refusal.kind)}`)
    assert.throws(
      () => runner({ groupBy, groupKeys, closed, parseColumnAlign, groupPageRows, groupKeysFor }),
      (error) => {
        assert.equal(error?.name, 'TypeError', `${refusal.name}: refusal must be a TypeError`)
        assert.ok(String(error?.message).includes(refusal.expectedError), `${refusal.name}: expected ${JSON.stringify(refusal.expectedError)}, received ${String(error?.message)}`)
        return true
      },
      `${refusal.name}: must refuse`,
    )
    console.log(`passes: ${refusal.name}`)
  }
})

/**
 * The fixture's column ids are host closed-set members; build them with the real
 * `closed` factory so the gate exercises the same member shape a host passes.
 *
 * @param {{ id: string, label: string, align: string, numeric?: boolean }} def
 * @param {(wire: string, label: string) => object} closed
 * @param {Record<string, object>} align
 */
function columnFor(def, closed, align) {
  return {
    id: closed(def.id, def.id),
    label: def.label,
    align: align[def.align],
    numeric: def.numeric === true,
    render: (row) => (def.id === 'turns' || def.id === 'end' || def.id === 'decimal' ? row.turns : row.title),
  }
}

/**
 * Compose the saved view a host would pass: the URL grouping and the device
 * columns and open groups. Unknown wires are kept as members so the table's own
 * fallback is what the case exercises.
 *
 * @param {{ groupBy: string, visibleColumns?: string[], open?: string[] } | undefined} spec
 * @param {object} defaultGroupBy
 * @param {readonly object[]} options
 * @param {Map<string, object>} columnsById
 * @param {(wire: string, label: string) => object} closed
 */
function viewFor(spec, defaultGroupBy, options, columnsById, closed) {
  if (!spec) return null
  return {
    groupBy: options.find((option) => option.wire === spec.groupBy) ?? closed(spec.groupBy, spec.groupBy),
    visibleColumns: (spec.visibleColumns ?? []).map((wire) => columnsById.get(wire)?.id ?? closed(wire, wire)),
    open: spec.open,
  }
}

/**
 * Open one picker's disclosure so its choices mount, the way a keyboard user
 * reaches them.
 *
 * @param {HTMLElement} container
 * @param {{ act: (step: () => void) => Promise<void> }} mounted
 * @param {string} picker
 * @param {string} name
 */
async function openPicker(container, mounted, picker, name) {
  const trigger = [...container.querySelectorAll('.libt-pick-btn')]
    .find((entry) => entry.textContent?.startsWith(picker))
  assert.ok(trigger, `${name}: the ${picker} picker must mount`)
  await mounted.act(() => trigger.click())
}

/**
 * The picker choice whose visible label is exactly `label`, inside the picker
 * whose trigger text starts with `picker`.
 *
 * @param {HTMLElement} container
 * @param {string} picker
 * @param {string} label
 */
function pickerChoice(container, picker, label) {
  const group = [...container.querySelectorAll('.libt-pick')]
    .find((entry) => entry.querySelector('.libt-pick-btn')?.textContent?.startsWith(picker))
  const choice = [...(group?.querySelectorAll('.libt-pick-row') ?? [])]
    .find((entry) => entry.querySelector('.libt-pick-label')?.textContent === label)
  return choice?.querySelector('input') ?? null
}

/**
 * Prove the two pickers are keyboard reachable and announce their state: each
 * trigger is a real button with `aria-expanded`, each choice is a native checkbox
 * or radio inside a named group, and Escape closes a panel and returns focus to
 * its trigger.
 *
 * @param {Window} window
 * @param {HTMLElement} container
 * @param {Document} document
 * @param {{ act: (step: () => void) => Promise<void> }} mounted
 * @param {string} name
 */
async function assertKeyboard(window, container, document, mounted, name) {
  const triggers = [...container.querySelectorAll('.libt-pick-btn')]
  assert.equal(triggers.length, 2, `${name}: the column and group-by pickers both render`)
  for (const trigger of triggers) {
    assert.equal(trigger.tagName, 'BUTTON', `${name}: a picker trigger is a real button`)
    assert.ok(trigger.tabIndex >= 0, `${name}: a picker trigger is in the tab order`)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false', `${name}: a closed picker announces collapsed`)
    assert.equal(trigger.getAttribute('aria-controls'), null, `${name}: a closed picker names no panel`)
    await mounted.act(() => trigger.click())
    assert.equal(trigger.getAttribute('aria-expanded'), 'true', `${name}: an open picker announces expanded`)
    assert.ok(trigger.getAttribute('aria-controls'), `${name}: an open picker points at the panel it controls`)
  }
  const panels = [...container.querySelectorAll('.libt-pick-panel')]
  assert.deepEqual(panels.map((panel) => panel.getAttribute('role')), ['radiogroup', 'group'], `${name}: each panel names its choice model`)
  for (const panel of panels) {
    const choices = [...panel.querySelectorAll('input')]
    assert.ok(choices.length > 0, `${name}: every picker offers a choice`)
    for (const choice of choices) assert.ok(['checkbox', 'radio'].includes(choice.type), `${name}: a choice is a native checkbox or radio, so its state is announced`)
  }
  await mounted.act(() => keydown(window, panels[0], 'Escape'))
  assert.equal(container.querySelectorAll('.libt-pick-panel').length, 1, `${name}: Escape closes the focused picker`)
  assert.equal(document.activeElement, triggers[0], `${name}: Escape returns focus to the trigger`)
}

/**
 * @param {HTMLElement} container
 * @returns {{ kind: string | null, text: string }[]}
 */
function renderedRows(container) {
  return [...container.querySelectorAll('tbody tr[data-row-kind]')].map((tr) => ({
    kind: tr.getAttribute('data-row-kind'),
    text: (tr.querySelector('th, td')?.textContent ?? '').trim().replace(/\s+/g, ' '),
  }))
}

/**
 * @param {HTMLElement} container
 * @returns {(string | null)[]}
 */
function renderedRowKeys(container) {
  return [...container.querySelectorAll('tbody tr[data-row-kind="row"]')].map((tr) => tr.getAttribute('data-row-key'))
}

/** @param {HTMLElement} container @returns {string[]} */
function headerLabels(container) {
  return [...container.querySelectorAll('thead th')].map((th) => th.textContent.trim())
}

/** @param {HTMLElement} container @returns {boolean[]} */
function expandedStates(container) {
  return [...container.querySelectorAll('.libt-group-toggle')].map((button) => button.getAttribute('aria-expanded') === 'true')
}

/**
 * @param {{ groupBy: { wire: string }, visibleColumns: readonly { wire: string }[], open: readonly string[] }[]} views
 * @returns {{ groupBy: string, visibleColumns: string[], open: string[] }[]}
 */
function viewWires(views) {
  return views.map((view) => ({
    groupBy: view.groupBy.wire,
    visibleColumns: view.visibleColumns.map((id) => id.wire),
    open: view.open == null ? null : [...view.open],
  }))
}

#!/usr/bin/env node
/* Mounted-source gate for the canonical transcript library table core
   (fairtrade#229 PR-2). It loads the REAL component through vite's
   ssrLoadModule, mounts it into jsdom, and asserts what a reader reaches: the
   caption and table role, host columns, group headers, the one compact
   continuation row, the end-of-page continues marker, multi-membership row
   rendering, the required row key, and the numbered pager.

   Cases: scripts/testdata/transcript-library-table.yaml (+ .manifest.yaml).
   Run: pnpm test:datatable (this gate is one leg).
   Mutations: node scripts/parts-mutations.mjs scripts/transcript-library-table.render.test.mjs scripts/testdata/transcript-library-table.manifest.yaml */
import assert from 'node:assert/strict'
import { loadFixturePair, withMountedSource } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/transcript-library-table.yaml'
const MANIFEST = 'scripts/testdata/transcript-library-table.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, {
  cases: 'requiredCaseNames',
  helpers: 'requiredHelperNames',
})

await withMountedSource(async ({ load, mount, React }) => {
  const { TranscriptLibraryTable } = await load('/src/ui/TranscriptLibraryTable.jsx')
  const { groupKeysFor } = await load('/src/ui/groupPageRows.js')
  const { closed } = await load('/src/ui/closed-value.js')
  const { ColumnAlign } = await load('/src/ui/table/column-align.js')

  const ALIGN = {
    start: ColumnAlign.Start,
    end: ColumnAlign.End,
    center: ColumnAlign.Center,
    decimal: ColumnAlign.Decimal,
  }
  const groupBy = closed(fixture.groupBy.wire, fixture.groupBy.label)
  const groupKeys = (row) => row.projects

  for (const row of fixture.cases) {
    assert.equal(typeof row.name, 'string', `${FIXTURE}: every case needs a name`)
    assert.ok(Array.isArray(row.rows), `${row.name}: rows must be a list`)
    assert.ok(row.omitRowKey || Array.isArray(row.expectedRows), `${row.name}: expectedRows must be a list`)

    const calls = { labels: [], pages: [] }
    const element = React.createElement(TranscriptLibraryTable, {
      caption: fixture.caption,
      rows: row.rows,
      ...(row.omitRowKey ? {} : { rowKey: (transcript) => transcript.key }),
      columns: columnsFor(row.columns, fixture, closed, ALIGN),
      groupBy,
      groupKeys,
      groupLabel: (id) => {
        calls.labels.push(id)
        return id
      },
      nextGroupKeys: row.nextGroupKeys ?? null,
      continuedGroupKeys: row.continuedGroupKeys ?? null,
      page: row.page ?? null,
      onPageChange: (index) => calls.pages.push(index),
    })

    if (row.omitRowKey) {
      await assert.rejects(
        () => mount(element),
        (error) => {
          assert.ok(String(error?.message).includes(row.expectedError), `${row.name}: expected ${JSON.stringify(row.expectedError)}, received ${String(error?.message)}`)
          return true
        },
        `${row.name}: a missing rowKey must be refused`,
      )
      console.log(`passes: ${row.name}`)
      continue
    }

    const mounted = await mount(element)
    try {
      const { container } = mounted
      const table = container.querySelector('table[role="table"]')
      assert.ok(table, `${row.name}: the table must expose role="table"`)
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
      if (row.expectNoPager) {
        assert.equal(container.querySelector('.pgn'), null, `${row.name}: a null page hides the numbered pager`)
      } else {
        assert.ok(container.querySelector('.pgn'), `${row.name}: a paged table renders the numbered pager`)
        assert.equal(container.querySelector('[role="status"]')?.textContent, row.expectedPage, `${row.name}: the pager names the page and page count`)
      }
      if (row.click) {
        const target = container.querySelector(row.click)
        assert.ok(target, `${row.name}: ${row.click} must mount`)
        await mounted.act(() => target.click())
        assert.deepEqual(calls.pages, [row.expectedPageChange], `${row.name}: the numbered pager reports the 1-based page it navigates to`)
      }
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
})

/**
 * The fixture's column ids are host closed-set members; build them with the real
 * `closed` factory so the gate exercises the same member shape a host passes.
 *
 * @param {'default' | 'align' | undefined} selector
 * @param {{ columns: object[], alignColumns: object[] }} fixture
 * @param {(wire: string, label: string) => object} closed
 * @param {Record<string, object>} align
 */
function columnsFor(selector, fixture, closed, align) {
  const defs = selector === 'align' ? fixture.alignColumns : fixture.columns
  return defs.map((def) => ({
    id: closed(def.id, def.id),
    label: def.label,
    align: align[def.align],
    numeric: def.numeric === true,
    render: (row) => (def.id === 'turns' || def.id === 'end' || def.id === 'decimal' ? row.turns : row.title),
  }))
}

/**
 * @param {HTMLElement} container
 * @returns {{ kind: string | null, text: string }[]}
 */
function renderedRows(container) {
  return [...container.querySelectorAll('tbody tr[data-row-kind]')].map((tr) => ({
    kind: tr.getAttribute('data-row-kind'),
    text: (tr.querySelector('th, td')?.textContent ?? '').trim(),
  }))
}

/**
 * @param {HTMLElement} container
 * @returns {(string | null)[]}
 */
function renderedRowKeys(container) {
  return [...container.querySelectorAll('tbody tr[data-row-kind="row"]')].map((tr) => tr.getAttribute('data-row-key'))
}

import assert from 'node:assert/strict'
import { withMountedSource } from './mounted-parts.mjs'
import { loadDataTableFixtures } from './datatable-fixtures.mjs'

const fixtures = loadDataTableFixtures()
await withMountedSource(async ({ load, mount, React }) => {
  const { default: DataTable } = await load('/src/ui/DataTable.jsx')
  for (const row of [...fixtures.cases, ...fixtures.actions]) {
    const calls = { search: [], filters: [], pagination: [], sort: [], selection: [] }
    const mounted = await mount(React.createElement(DataTable, {
      columns: fixtures.columns, rows: row.rows ?? fixtures.rows, ...row.props,
      onSearchChange: (v) => calls.search.push(v), onColumnFiltersChange: (v) => calls.filters.push(v),
      onPaginationChange: (v) => calls.pagination.push(v), onSortChange: (v) => calls.sort.push(v), onSelectionChange: (v) => calls.selection.push(v),
    }))
    const container = mounted.container
    const titles = () => [...container.querySelectorAll('tbody .tbl-row')].map((r) => r.querySelector('.tbl-td').textContent)
    try {
      if (row.selector) {
        const target = container.querySelector(row.selector)
        assert.ok(target, `${row.name}: interaction target must mount`)
        await mounted.act(() => target.click())
        assert.deepEqual(calls[row.callback], [row.expectedValue], `${row.name}: public callback`)
      } else {
        assert.equal(container.querySelector('[role=status]').textContent, row.expectedCount, row.name)
        if (row.props.defaultSelectedKeys) assert.equal(container.querySelectorAll('.is-selected').length, row.props.defaultSelectedKeys.length)
      }
      assert.deepEqual(titles(), row.expectedTitles, row.name)
      if (row.props.disabled) {
        const scroll = container.querySelector('.tbl-scroll')
        assert.equal(scroll.tabIndex, 0, `${row.name}: keyboard scroll target`)
        assert.equal(scroll.getAttribute('role'), 'region', `${row.name}: named region`)
        assert.ok(scroll.getAttribute('aria-label'), `${row.name}: accessible name`)
        assert.equal(scroll.closest('fieldset[disabled]'), null, `${row.name}: no disabled ancestor`)
        for (const control of container.querySelectorAll('input, button')) {
          assert.equal(control.disabled, true, `${row.name}: table actions stay disabled`)
        }
      }
      console.log(`passes: ${row.name}`)
    } finally { await mounted.unmount() }
  }
})

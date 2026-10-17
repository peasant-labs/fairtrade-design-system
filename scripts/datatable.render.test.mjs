import assert from 'node:assert/strict'
import { withMountedSource } from './mounted-parts.mjs'
import { loadDataTableFixtures } from './datatable-fixtures.mjs'

const fixtures = loadDataTableFixtures()
await withMountedSource(async ({ load, mount, React }) => {
  const { default: DataTable } = await load('/src/ui/DataTable.jsx')
  const { DataTableToolbar, DataTablePaginationControls } = await load('/src/ui/DataTableControls.jsx')
  for (const row of [...fixtures.cases, ...fixtures.actions]) {
    const calls = { search: [], filters: [], pagination: [], sort: [], selection: [] }
    const mounted = await mount(React.createElement(DataTable, {
      columns: fixtures.columns, rows: row.rows ?? fixtures.rows, ...row.props,
      onSearchChange: (v) => calls.search.push(v), onColumnFiltersChange: (v) => calls.filters.push(v),
      onPaginationChange: (v) => calls.pagination.push(v), onSortChange: (v) => calls.sort.push(v), onSelectionChange: (v) => calls.selection.push(v),
      ...(row.controls === false ? {} : {
        toolbar: (controls) => React.createElement(DataTableToolbar, {
          ...controls,
          ...(row.searchOnly ? { columnFilters: undefined } : {}),
          ...(row.filtersOnly ? { search: undefined } : {}),
        }, row.customAction ? React.createElement('button', { type: 'button' }, row.customAction) : null),
        footer: (controls) => React.createElement(DataTablePaginationControls, controls),
      }),
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
        assert.equal(container.querySelector('[role=status]')?.textContent ?? '', row.expectedCount, row.name)
        if (row.props.defaultSelectedKeys) assert.equal(container.querySelectorAll('.is-selected').length, row.props.defaultSelectedKeys.length)
      }
      assert.deepEqual(titles(), row.expectedTitles, row.name)
      if (row.controls === false) {
        assert.equal(container.querySelector('.tbl-tools,.tbl-chips'), null, `${row.name}: no implicit toolbar`)
        if (!row.props.pagination && !row.props.defaultPagination) assert.equal(container.querySelector('.tbl-footer'), null, `${row.name}: no implicit pager`)
        assert.equal(container.querySelector('.tbl-scroll').style.maxHeight, '', `${row.name}: no implicit height bound`)
      }
      if (row.searchOnly) {
        assert.equal(container.querySelectorAll('input[type=search]').length, 1, `${row.name}: opted-in search`)
        assert.equal(container.querySelector('.tbl-filters'), null, `${row.name}: filters remain absent`)
      }
      if (row.filtersOnly) {
        assert.equal(container.querySelector('input[type=search]'), null, `${row.name}: search remains absent`)
        assert.ok(container.querySelector('.tbl-filters'), `${row.name}: opted-in filters`)
      }
      if (row.customAction) assert.ok([...container.querySelectorAll('button')].some((button) => button.textContent === row.customAction), `${row.name}: importer action mounts`)
      if (row.props.maxHeight) assert.equal(container.querySelector('.tbl-scroll').style.maxHeight, row.props.maxHeight, `${row.name}: explicit height bound`)
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

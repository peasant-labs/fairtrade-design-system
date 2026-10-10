import assert from 'node:assert/strict'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { loadDataTableFixtures } from './datatable-fixtures.mjs'

const fixtures = loadDataTableFixtures()
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>')
const saved = new Map()
for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}
const server = await createServer({ configFile: false, appType: 'custom', logLevel: 'silent', plugins: [react()], server: { middlewareMode: true } })
try {
  const { default: DataTable } = await server.ssrLoadModule('/src/ui/DataTable.jsx')
  const container = document.getElementById('root')
  for (const row of [...fixtures.cases, ...fixtures.actions]) {
    const root = createRoot(container)
    const calls = { search: [], filters: [], pagination: [], sort: [], selection: [] }
    const titles = () => [...container.querySelectorAll('tbody .tbl-row')].map((r) => r.querySelector('.tbl-td').textContent)
    try {
      await act(async () => root.render(React.createElement(DataTable, {
        columns: fixtures.columns, rows: row.rows ?? fixtures.rows, ...row.props,
        onSearchChange: (v) => calls.search.push(v), onColumnFiltersChange: (v) => calls.filters.push(v),
        onPaginationChange: (v) => calls.pagination.push(v), onSortChange: (v) => calls.sort.push(v), onSelectionChange: (v) => calls.selection.push(v),
      })))
      if (row.selector) {
        const target = container.querySelector(row.selector)
        assert.ok(target, `${row.name}: interaction target must mount`)
        await act(async () => target.click())
        assert.deepEqual(calls[row.callback], [row.expectedValue], `${row.name}: public callback`)
      } else {
        assert.equal(container.querySelector('[role=status]').textContent, row.expectedCount, row.name)
        if (row.props.defaultSelectedKeys) assert.equal(container.querySelectorAll('.is-selected').length, row.props.defaultSelectedKeys.length)
      }
      assert.deepEqual(titles(), row.expectedTitles, row.name)
      console.log(`passes: ${row.name}`)
    } finally { await act(async () => root.unmount()) }
  }
} finally {
  await server.close()
  dom.window.close()
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}

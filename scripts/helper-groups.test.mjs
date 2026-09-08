import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import YAML from 'yaml'

/** @typedef {{id: string, scope: string, count: number, pages: string[][]}} GroupFixture */
/** @typedef {{name: string, owner?: string, ownerStatus?: string, groups: GroupFixture[], expectedRows: string[], expectedText: string[], select?: string, expectedSelected?: string[], status?: string, paginate?: boolean}} GroupCase */
/** @returns {{rows: Record<string, object>, cases: GroupCase[]}} */
function loadFixtures() {
  const doc = YAML.parseDocument(readFileSync('scripts/testdata/helper_group_listing.yaml', 'utf8'), { uniqueKeys: true })
  assert.deepEqual(doc.errors, [])
  const data = doc.toJS()
  const names = data.cases.map((item) => item.name)
  assert.equal(new Set(names).size, names.length, 'fixture names must be unique')
  assert.deepEqual([...names].sort(), [...data.requiredNames].sort(), 'required fixture name membership')
  for (const item of data.cases) {
    assert.ok(item.owner ? data.rows[item.owner] : item.ownerStatus, `${item.name}: owner or explicit context required`)
    assert.ok(item.groups.length && item.expectedText.length, `${item.name}: non-vacuous group and text oracle`)
    assert.equal(new Set(item.groups.map((group) => group.id)).size, item.groups.length)
    for (const group of item.groups) {
      assert.ok(group.id && group.scope && Number.isSafeInteger(group.count))
      assert.equal(group.pages.flat().length, group.count, 'fixture count is saved identity total')
      for (const id of group.pages.flat()) assert.equal(data.rows[id]?.id, id)
    }
  }
  return data
}

const fixtures = loadFixtures()
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://fairtrade.invalid/' })
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
  navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node })) {
  Object.defineProperty(globalThis, key, { configurable: true, value })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true }, logLevel: 'silent' })
try {
  const { HelperGroup, HelperGroupListItem, HelperThreadRow } = await server.ssrLoadModule('/src/ui/index.js')
  assert.equal(typeof HelperGroup, 'function', 'production public barrel export')
  for (const fixture of fixtures.cases) {
    const requests = [], opened = [], selected = [], refreshed = []
    const container = document.getElementById('root')
    const root = createRoot(container)
    let settle
    function Host() {
      const [pages, setPages] = React.useState({})
      settle = (request) => setPages((previous) => ({ ...previous, [request.groupId]: { page: request.page, status: fixture.status || 'ready' } }))
      const row = (id) => React.createElement(HelperThreadRow, { ...fixtures.rows[id],
        href: `/transcripts/${id}`, onOpen: (identity, event) => { event.preventDefault(); opened.push(identity) },
        onSelect: (identity, checked) => { if (checked) selected.push(identity); else selected.splice(selected.indexOf(identity), 1) },
      }, React.createElement('span', { className: 'route-status' }, `status for ${id}`))
      return React.createElement(React.Fragment, null, fixture.groups.map((group) => {
        const state = pages[group.id] || { page: 1, status: 'idle' }
        return React.createElement(HelperGroupListItem, { key: group.id, owner: fixture.owner ? row(fixture.owner) : undefined, ownerStatus: fixture.ownerStatus },
          React.createElement(HelperGroup, {
            groupId: group.id, memberScope: group.scope, helperThreadCount: group.count,
            page: state.page, limit: group.pages[0].length, total: group.count, status: state.status,
            members: group.pages[state.page - 1], getMemberKey: (id) => id, renderMember: row,
            onRefreshList: () => refreshed.push(group.id),
            onRequestPage: (request) => {
              requests.push(request)
              setPages((previous) => ({ ...previous, [group.id]: { ...state, status: 'loading' } }))
            },
          }))
      }))
    }
    const click = async (element) => {
      assert.ok(element, `${fixture.name}: mounted action exists`)
      await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })))
    }
    await act(async () => root.render(React.createElement(Host)))
    try {
      assert.equal(requests.length, 0, 'mount must not fetch or select')
      for (const trigger of container.querySelectorAll('.helper-group-trigger')) {
        assert.equal(trigger.getAttribute('aria-expanded'), 'false')
        assert.equal(document.getElementById(trigger.getAttribute('aria-controls')).hidden, true)
        trigger.focus()
        await click(trigger)
        assert.equal(document.activeElement, trigger, 'expansion preserves keyboard focus')
        const request = requests.at(-1)
        const group = fixture.groups.find((item) => item.id === request.groupId)
        assert.deepEqual(request, { groupId: group.id, memberScope: group.scope, page: 1, limit: group.pages[0].length })
        assert.ok(container.textContent.includes('loading saved helper threads'))
        await act(async () => settle(request))
      }
      if (fixture.paginate) {
        const next = [...container.querySelectorAll('.helper-group-action')].find((button) => button.textContent.includes('next helpers'))
        next.focus()
        await click(next)
        assert.equal(document.activeElement, next, 'loading does not drop pager focus')
        const request = requests.at(-1)
        assert.equal(request.page, 2)
        await act(async () => settle(request))
        assert.ok(document.activeElement.classList.contains('helper-group-page-heading'), 'completed requested page receives focus')
      }
      assert.deepEqual([...container.querySelectorAll('.helper-group-members [data-thread-id]')].map((row) => row.dataset.threadId), fixture.expectedRows, fixture.name)
      for (const text of fixture.expectedText) assert.ok(container.textContent.includes(text), `${fixture.name}: ${text}`)
      assert.equal(container.querySelectorAll('.helper-group-trigger input,.helper-group-context input').length, 0, 'no aggregate or context selection')
      for (const id of fixture.expectedRows) {
        const member = [...container.querySelectorAll('.helper-group-members [data-thread-id]')].find((row) => row.dataset.threadId === id)
        assert.ok(member.textContent.includes(`status for ${id}`), 'route data retained')
        assert.equal(member.querySelector('a').getAttribute('href'), `/transcripts/${id}`)
        await click(member.querySelector('a'))
      }
      assert.deepEqual(opened, fixture.expectedRows, 'individual open identity')
      if (fixture.select) {
        await click(container.querySelector(`.helper-group-members [data-thread-id="${fixture.select}"] input`))
        assert.deepEqual(selected, fixture.expectedSelected, 'explicit individual selection only')
      }
      if (fixture.status === 'scope_expired') {
        await click(container.querySelector('.helper-group-action'))
        assert.deepEqual(refreshed, fixture.groups.map((group) => group.id))
        assert.equal(requests.length, fixture.groups.length, 'expiry cannot fetch broader members')
      }
      if (fixture.status === 'error') {
        const original = requests.at(-1)
        await click(container.querySelector('.helper-group-action'))
        assert.deepEqual(requests.at(-1), original, 'retry preserves exact request scope')
      }
      console.log(`PASS ${fixture.name}`)
    } finally { await act(async () => root.unmount()) }
  }
} finally { await server.close(); dom.window.close() }

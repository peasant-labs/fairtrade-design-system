import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import YAML from 'yaml'

/** @typedef {{id: string, scope: string, count: number, members: string[]}} GroupFixture */
/** @typedef {{name: string, owner?: string, ownerStatus?: string, ordinaryChild?: string, groups: GroupFixture[], expectedRows: string[], expectedText: string[], select?: string, expectedSelected?: string[], scopeExpired?: boolean, update?: {id: string, turnCount: number}}} GroupCase */
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
      assert.equal(group.members.length, group.count, 'fixture count is saved identity total')
      for (const id of group.members) assert.equal(data.rows[id]?.id, id)
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
    const opened = [], selected = [], refreshed = []
    const container = document.getElementById('root')
    const root = createRoot(container)
    let updateRow
    function Host() {
      const [rowUpdates, setRowUpdates] = React.useState({})
      const [liveExpired, setLiveExpired] = React.useState(!!fixture.scopeExpired)
      updateRow = (update) => setRowUpdates((previous) => ({ ...previous, [update.id]: update }))
      const row = (id) => React.createElement(HelperThreadRow, { ...fixtures.rows[id], ...rowUpdates[id],
        href: `/transcripts/${id}`, onOpen: (identity, event) => { event.preventDefault(); opened.push(identity) },
        onSelect: (identity, checked) => { if (checked) selected.push(identity); else selected.splice(selected.indexOf(identity), 1) },
      }, React.createElement('span', { className: 'route-status' }, `status for ${id}`),
      fixture.ordinaryChild && id === fixture.owner ? React.createElement('button', {
        type: 'button', className: 'ordinary-child-exit', onClick: () => opened.push(fixture.ordinaryChild),
      }, 'open ordinary child') : null)
      return React.createElement(React.Fragment, null, fixture.groups.map((group) =>
        React.createElement(HelperGroupListItem, { key: group.id, owner: fixture.owner ? row(fixture.owner) : undefined, ownerStatus: fixture.ownerStatus },
          React.createElement(HelperGroup, {
            groupId: group.id, memberScope: group.scope, helperThreadCount: group.count,
            members: group.members, getMemberKey: (id) => id, renderMember: row,
            scopeExpired: liveExpired, onRefreshList: () => { refreshed.push(group.id); setLiveExpired(false) },
          }))))
    }
    const click = async (element) => {
      assert.ok(element, `${fixture.name}: mounted action exists`)
      await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })))
    }
    const press = async (element, key) => {
      element.focus()
      assert.equal(document.activeElement, element, `${fixture.name}: keyboard target receives focus`)
      await act(async () => element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
      await act(async () => element.dispatchEvent(new dom.window.KeyboardEvent('keyup', { key, bubbles: true, cancelable: true })))
      await click(element)
    }
    await act(async () => root.render(React.createElement(Host)))
    let settled = false
    try {
      assert.deepEqual(opened, [], 'mount must not navigate')
      assert.deepEqual(selected, [], 'mount must not select')
      if (!fixture.owner) assert.equal(container.querySelector('[data-thread-id]'), null, 'context cannot fabricate a hidden owner row')
      else assert.equal(container.querySelector('[data-thread-id]').dataset.threadId, fixture.owner, 'ordinary owner stays above its group')
      const triggers = [...container.querySelectorAll('.helper-group-trigger')]
      assert.equal(triggers.length, fixture.groups.length, 'one collapsed disclosure per group')
      for (const [index, trigger] of triggers.entries()) {
        assert.equal(trigger.getAttribute('aria-expanded'), 'false')
        assert.equal(document.getElementById(trigger.getAttribute('aria-controls')).hidden, true)
        // Alternate keyboard entry across groups so both Enter and Space paths are exercised.
        if (index % 2) await press(trigger, 'Enter')
        else await click(trigger)
        assert.equal(trigger.getAttribute('aria-expanded'), 'true')
        assert.equal(document.activeElement, trigger, 'expansion preserves keyboard focus')
      }
      if (fixture.update) await act(async () => updateRow(fixture.update))
      assert.deepEqual([...container.querySelectorAll('.helper-group-members [data-thread-id]')].map((row) => row.dataset.threadId), fixture.expectedRows, fixture.name)
      for (const text of fixture.expectedText) assert.ok(container.textContent.includes(text), `${fixture.name}: ${text}`)
      assert.equal(container.querySelectorAll('.helper-group-trigger input,.helper-group-context input').length, 0, 'no aggregate or context selection')
      for (const id of fixture.expectedRows) {
        const member = [...container.querySelectorAll('.helper-group-members [data-thread-id]')].find((row) => row.dataset.threadId === id)
        assert.ok(member.querySelector('.helper-thread-marker'), 'inset marker language on every member row')
        assert.ok(member.textContent.includes(`status for ${id}`), 'route data retained')
        assert.equal(member.querySelector('a').getAttribute('href'), `/transcripts/${id}`)
        await click(member.querySelector('a'))
      }
      assert.deepEqual(opened, fixture.expectedRows, 'individual open identity')
      if (fixture.ordinaryChild) {
        await click(container.querySelector('.ordinary-child-exit'))
        assert.equal(opened.at(-1), fixture.ordinaryChild, 'retained ordinary child exit invokes its original callback')
      }
      if (fixture.select) {
        await click(container.querySelector(`.helper-group-members [data-thread-id="${fixture.select}"] input`))
        assert.deepEqual(selected, fixture.expectedSelected, 'explicit individual selection only')
      }
      if (fixture.scopeExpired) {
        // Fail-closed honesty is asserted on a fresh mount: expired scope hides
        // members until the host refreshes the originating list.
        await act(async () => root.unmount())
        settled = true
        const fresh = createRoot(container)
        const reopened = [], reselected = [], rerequested = []
        function ExpiredHost() {
          const [liveExpired, setLiveExpired] = React.useState(true)
          return React.createElement(React.Fragment, null, fixture.groups.map((group) =>
            React.createElement(HelperGroupListItem, { key: group.id, ownerStatus: fixture.ownerStatus },
              React.createElement(HelperGroup, {
                groupId: group.id, memberScope: group.scope, helperThreadCount: group.count,
                members: group.members, getMemberKey: (id) => id,
                renderMember: (id) => React.createElement(HelperThreadRow, { ...fixtures.rows[id],
                  href: `/transcripts/${id}`,
                  onOpen: (identity, event) => { event.preventDefault(); reopened.push(identity) },
                  onSelect: (identity, checked) => { if (checked) reselected.push(identity) },
                }),
                scopeExpired: liveExpired,
                onRefreshList: () => { rerequested.push(group.id); setLiveExpired(false) },
              }))))
        }
        await act(async () => fresh.render(React.createElement(ExpiredHost)))
        try {
          for (const trigger of container.querySelectorAll('.helper-group-trigger')) await click(trigger)
          assert.equal(container.querySelector('.helper-group-members'), null, 'expired scope hides stale member actions')
          assert.deepEqual(reopened, [], 'expired scope opens nothing')
          assert.deepEqual(reselected, [], 'expired scope selects nothing')
          for (const action of container.querySelectorAll('.helper-group-action')) await click(action)
          assert.deepEqual(rerequested, fixture.groups.map((group) => group.id), 'refresh stays scoped to the originating list')
          assert.deepEqual([...container.querySelectorAll('.helper-group-members [data-thread-id]')].map((row) => row.dataset.threadId), fixture.expectedRows, 'refresh restores the exact scope')
        } finally { await act(async () => fresh.unmount()) }
        console.log(`PASS ${fixture.name}`)
        continue
      }
      console.log(`PASS ${fixture.name}`)
    } finally { if (!settled) await act(async () => root.unmount()) }
  }

  // Display-only parity: with selection and navigation both absent, member rows
  // render the inset marker, verbatim title, and counts with no interactive chrome.
  for (const fixture of fixtures.cases) {
    if (fixture.scopeExpired) continue
    const container = document.getElementById('root')
    const root = createRoot(container)
    await act(async () => root.render(React.createElement(React.Fragment, null,
      fixture.groups.flatMap((group) => group.members.map((id) =>
        React.createElement(HelperThreadRow, { key: id, ...fixtures.rows[id] }))))))
    try {
      for (const id of new Set(fixture.groups.flatMap((group) => group.members))) {
        const member = container.querySelector(`[data-thread-id="${id}"]`)
        assert.ok(member, `${fixture.name}: display-only row renders for ${id}`)
        assert.ok(member.querySelector('.helper-thread-marker'), 'inset marker without interactive props')
        assert.equal(member.querySelector('input'), null, 'no checkbox without onSelect')
        assert.equal(member.querySelector('a,button'), null, 'no navigation without href/onOpen')
        assert.ok(member.querySelector('.helper-thread-title').textContent.includes(fixtures.rows[id].title), 'verbatim title without navigation')
      }
      console.log(`PASS ${fixture.name} display-only`)
    } finally { await act(async () => root.unmount()) }
  }
} finally { await server.close(); dom.window.close() }

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import YAML from 'yaml'
import { installHarnessGuard } from './harness-guard.mjs'

/** @typedef {{id: string, scope: string, count: number, members: string[]}} GroupFixture */
/** @typedef {{name: string, owner?: string, ownerStatus?: string, ordinaryChild?: string, groups: GroupFixture[], expectedRows: string[], expectedLabels: string[], expectedText: string[], select?: string, expectedSelected?: string[], expectedSelectedLabel?: string, scopeExpired?: boolean, update?: {id: string, turnCount: number}}} GroupCase */
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
    assert.ok(Array.isArray(item.expectedLabels) && item.expectedLabels.length === item.groups.length, `${item.name}: one closed-control label per group`)
    assert.equal(new Set(item.groups.map((group) => group.id)).size, item.groups.length)
    for (const group of item.groups) {
      assert.ok(group.id && group.scope && Number.isSafeInteger(group.count))
      assert.equal(group.members.length, group.count, 'fixture count is saved identity total')
      for (const id of group.members) assert.equal(data.rows[id]?.id, id)
    }
    if (item.scopeExpired) assert.deepEqual(item.expectedRows, [], `${item.name}: an expired scope reveals nothing`)
    else assert.deepEqual(item.expectedRows, item.groups.flatMap((group) => group.members), `${item.name}: revealed rows are the group members in order`)
    if (item.select) {
      assert.ok(item.expectedSelected?.length && item.expectedSelected.includes(item.select), `${item.name}: selection oracle names the picked row`)
      assert.ok(item.expectedSelectedLabel?.includes('selected'), `${item.name}: closed control must state the hidden selection count`)
    }
  }
  return data
}

installHarnessGuard({ label: 'helper groups runtime suite' })

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
      // Selection is host state, exactly as a real share/review picker holds
      // it: the group only counts it, the rows render it.
      const [selectedIDs, setSelectedIDs] = React.useState([])
      const [liveExpired, setLiveExpired] = React.useState(!!fixture.scopeExpired)
      updateRow = (update) => setRowUpdates((previous) => ({ ...previous, [update.id]: update }))
      const onSelect = (identity, checked) => {
        if (checked) selected.push(identity)
        else selected.splice(selected.indexOf(identity), 1)
        setSelectedIDs((previous) => checked ? [...new Set([...previous, identity])] : previous.filter((value) => value !== identity))
      }
      const row = (id) => React.createElement(HelperThreadRow, { ...fixtures.rows[id], ...rowUpdates[id],
        selected: selectedIDs.includes(id),
        href: `/transcripts/${id}`, onOpen: (identity, event) => { event.preventDefault(); opened.push(identity) },
        onSelect,
      }, React.createElement('span', { className: 'route-status' }, `status for ${id}`),
      fixture.ordinaryChild && id === fixture.owner ? React.createElement('button', {
        type: 'button', className: 'ordinary-child-exit', onClick: () => opened.push(fixture.ordinaryChild),
      }, 'open ordinary child') : null)
      return React.createElement(React.Fragment, null, fixture.groups.map((group) =>
        React.createElement(HelperGroupListItem, { key: group.id, owner: fixture.owner ? row(fixture.owner) : undefined, ownerStatus: fixture.ownerStatus },
          React.createElement(HelperGroup, {
            groupId: group.id,
            // A refresh hands the group a new scope token, exactly as the demo does.
            memberScope: liveExpired ? group.scope : `${group.scope}-refreshed`,
            helperThreadCount: group.count,
            members: group.members, getMemberKey: (id) => id, renderMember: row,
            isMemberSelected: (id) => selectedIDs.includes(id),
            scopeExpired: liveExpired, onRefreshList: () => { refreshed.push(group.id); setLiveExpired(false) },
          }))))
    }
    const click = async (element) => {
      assert.ok(element, `${fixture.name}: mounted action exists`)
      // A real browser focuses a button on mousedown; jsdom does not emulate
      // that default action, so focus explicitly to keep the harness faithful.
      element.focus()
      await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })))
    }
    const press = async (element, key) => {
      element.focus()
      assert.ok(document.activeElement === element, `${fixture.name}: keyboard target receives focus`)
      await act(async () => element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
      await act(async () => element.dispatchEvent(new dom.window.KeyboardEvent('keyup', { key, bubbles: true, cancelable: true })))
      await click(element)
    }
    await act(async () => root.render(React.createElement(Host)))
    try {
      assert.deepEqual(opened, [], 'mount must not navigate')
      assert.deepEqual(selected, [], 'mount must not select')
      // The owner slot is a direct child of .helper-group-item; member rows live
      // inside .helper-group-nested and only exist while their group is open, so
      // an ownerless result must have no direct-child thread row, not merely none.
      const ownerRow = container.querySelector('.helper-group-item > [data-thread-id]')
      if (!fixture.owner) assert.ok(ownerRow === null, 'context cannot fabricate a hidden owner row')
      else assert.equal(ownerRow.dataset.threadId, fixture.owner, 'ordinary owner stays above its group')
      const triggers = [...container.querySelectorAll('.helper-group-trigger')]
      assert.equal(triggers.length, fixture.groups.length, 'one collapsed disclosure per group')
      // The closed control states its count; the members it holds do not exist.
      assert.deepEqual([...container.querySelectorAll('.helper-group-count')].map((element) => element.textContent),
        fixture.expectedLabels, 'closed control states its count')
      assert.equal(container.querySelectorAll('.helper-group-nested [data-thread-id]').length, 0, 'members exist only while expanded')
      assert.equal(container.querySelectorAll('.helper-thread-marker').length, 0, 'no subagent-inset marker anywhere')
      for (const [index, trigger] of triggers.entries()) {
        assert.equal(trigger.getAttribute('aria-expanded'), 'false')
        assert.equal(trigger.querySelector('.helper-group-show').textContent, 'show', 'closed control offers show')
        assert.equal(document.getElementById(trigger.getAttribute('aria-controls')), null, 'closed control reveals nothing')
        assert.equal(trigger.firstElementChild.tagName.toLowerCase(), 'svg', 'chevron leads the control')
        if (index % 2) await press(trigger, 'Enter')
        else await click(trigger)
        assert.equal(trigger.getAttribute('aria-expanded'), 'true')
        assert.ok(document.activeElement === trigger, 'expansion preserves keyboard focus')
        assert.equal(trigger.querySelector('.helper-group-show').textContent, 'hide', 'open control offers hide')
      }
      if (fixture.update) await act(async () => updateRow(fixture.update))
      const memberRows = [...container.querySelectorAll('.helper-group-members [data-thread-id]')]
      assert.deepEqual(memberRows.map((row) => row.dataset.threadId), fixture.expectedRows, fixture.name)
      for (const row of memberRows) {
        assert.ok(row.querySelector('.helper-thread-facts'), 'open member states its facts line')
        assert.ok(row.querySelector('.helper-thread-sep'), 'facts are middot separated')
        assert.equal(row.querySelector('.helper-thread-marker'), null, 'no inset marker on a member row')
        assert.ok(row.textContent.includes(`status for ${row.dataset.threadId}`), 'route data retained')
        assert.equal(row.querySelector('a').getAttribute('href'), `/transcripts/${row.dataset.threadId}`)
      }
      for (const text of fixture.expectedText) assert.ok(container.textContent.includes(text), `${fixture.name}: ${text}`)
      assert.equal(container.querySelectorAll('.helper-group-trigger input,.helper-group-context input').length, 0, 'no aggregate or context selection')
      for (const row of memberRows) await click(row.querySelector('a'))
      assert.deepEqual(opened, fixture.expectedRows, 'individual open identity')
      if (fixture.ordinaryChild) {
        await click(container.querySelector('.ordinary-child-exit'))
        assert.equal(opened.at(-1), fixture.ordinaryChild, 'retained ordinary child exit invokes its original callback')
      }
      if (fixture.select) {
        const groupIndex = fixture.groups.findIndex((group) => group.members.includes(fixture.select))
        const trigger = triggers[groupIndex]
        await click(container.querySelector(`.helper-group-members [data-thread-id="${fixture.select}"] input`))
        assert.deepEqual(selected, fixture.expectedSelected, 'explicit individual selection only')
        // Closing the control keeps the selection stated on it, and the members
        // it holds cease to exist until it is reopened.
        await click(trigger)
        assert.equal(trigger.getAttribute('aria-expanded'), 'false')
        assert.equal(container.querySelectorAll('.helper-group-members [data-thread-id]').length, 0, 'collapsed members are gone')
        assert.equal(trigger.querySelector('.helper-group-count').textContent, fixture.expectedSelectedLabel, 'closed control states the hidden selection')
        await click(trigger)
        assert.ok(container.querySelector(`.helper-group-members [data-thread-id="${fixture.select}"] input`).checked, 'reopening retains the selection')
      }
      if (fixture.scopeExpired) {
        // Fail-closed honesty: an expired scope renders no stale member actions,
        // opens nothing, and refreshes only the originating list.
        assert.ok(container.querySelector('.helper-group-members') === null, 'expired scope hides stale member actions')
        assert.deepEqual(opened, [], 'expired scope opens nothing')
        assert.deepEqual(selected, [], 'expired scope selects nothing')
        for (const action of container.querySelectorAll('.helper-group-action')) await click(action)
        assert.deepEqual(refreshed, fixture.groups.map((group) => group.id), 'refresh stays scoped to the originating list')
        // The refreshed scope is a new token, so the disclosure remounts closed.
        const refreshedTrigger = container.querySelector('.helper-group-trigger')
        assert.equal(refreshedTrigger.getAttribute('aria-expanded'), 'false', 'refreshed scope resets disclosure')
        assert.equal(refreshedTrigger.querySelector('.helper-group-count').textContent, fixture.expectedLabels[0], 'refreshed control states the restored count')
        await click(refreshedTrigger)
        assert.deepEqual([...container.querySelectorAll('.helper-group-members [data-thread-id]')].map((row) => row.dataset.threadId), ['G2'], 'refresh restores the exact scope')
      }
      console.log(`PASS ${fixture.name}`)
    } finally { await act(async () => root.unmount()) }
  }

  // Display-only parity: with selection and navigation both absent, member rows
  // render the ordinary row anatomy, verbatim title, and counts with no
  // interactive chrome and no inset marker.
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
        assert.ok(member.querySelector('.helper-thread-facts'), 'facts line without interactive props')
        assert.ok(member.querySelector('.helper-thread-marker') === null, 'no inset marker in display-only rows')
        assert.ok(member.querySelector('.helper-thread-sep'), 'display-only facts keep their separators')
        assert.ok(member.querySelector('input') === null, 'no checkbox without onSelect')
        assert.ok(member.querySelector('a,button') === null, 'no navigation without href/onOpen')
        assert.ok(member.querySelector('.helper-thread-title').textContent.includes(fixtures.rows[id].title), 'verbatim title without navigation')
      }
      console.log(`PASS ${fixture.name} display-only`)
    } finally { await act(async () => root.unmount()) }
  }
} finally { await server.close(); dom.window.close() }

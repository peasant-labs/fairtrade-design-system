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
/** @typedef {{collapsed: number, expanded: number}} AnchorCounts */
/** @typedef {{name: string, owner?: string, ownerStatus?: string, ordinaryChild?: string, groups: GroupFixture[], expectedRows: string[], expectedLabels: string[], expectedText: string[], expectedAnchorCounts: AnchorCounts, select?: string, expectedSelected?: string[], expectedSelectedLabel?: string, scopeExpired?: boolean, update?: {id: string, turnCount: number}}} GroupCase */
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
    // The rail oracle: every MOUNTED checkbox is an anchor. The owner row has
    // one when the fixture has an owner; each group contributes its members
    // once expanded, and an expired scope reveals none.
    const ownerAnchors = item.owner ? 1 : 0
    const mountedMembers = item.scopeExpired ? 0 : item.expectedRows.length
    assert.deepEqual(item.expectedAnchorCounts, { collapsed: ownerAnchors, expanded: ownerAnchors + mountedMembers },
      `${item.name}: rail anchors trace exactly the mounted row checkboxes`)
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
    const anchorCount = () => [...container.querySelectorAll('.helper-tree-rail')]
      .reduce((total, rail) => total + Number(rail.dataset.anchorCount), 0)
    const mountedRowIDs = () => [...container.querySelectorAll('.helper-tree [data-thread-id]')].map((row) => row.dataset.threadId)
    await act(async () => root.render(React.createElement(Host)))
    try {
      assert.deepEqual(opened, [], 'mount must not navigate')
      assert.deepEqual(selected, [], 'mount must not select')
      // ONE tree per rendered result item, tracing its mounted checkboxes with
      // ONE connector: the owner anchors the tree, and a collapsed group
      // reveals nothing, so only the owner checkbox is an anchor.
      const trees = [...container.querySelectorAll('.helper-tree')]
      assert.equal(trees.length, fixture.groups.length, 'one tree container per rendered result item')
      assert.equal(container.querySelectorAll('.helper-tree-rail').length, trees.length, 'one connector per tree')
      const collapsedPerTree = trees.map((tree) => Number(tree.querySelector('.helper-tree-rail').dataset.anchorCount))
      const ownerAnchorsPerTree = fixture.groups.map(() => fixture.owner ? 1 : 0)
      assert.deepEqual(collapsedPerTree, ownerAnchorsPerTree, 'collapsed anchors are the mounted owner checkboxes')
      assert.equal(anchorCount(), fixture.expectedAnchorCounts.collapsed, 'collapsed anchors are the mounted checkboxes')
      assert.equal(container.querySelectorAll('.helper-tree-rail__path').length,
        ownerAnchorsPerTree.filter((count) => count > 0).length, 'collapsed rail is present exactly when an anchor is')
      // The owner slot is the tree root: a direct child of .helper-tree-rows
      // that is not inside a nested list. Member rows live inside
      // .helper-tree-children and only exist while their group is open, so an
      // ownerless result must have no root thread row, not merely none.
      const ownerRow = container.querySelector('.helper-tree-rows > .helper-tree-row > [data-thread-id]')
      if (!fixture.owner) assert.ok(ownerRow === null, 'context cannot fabricate a hidden owner row')
      else assert.equal(ownerRow.dataset.threadId, fixture.owner, 'ordinary owner anchors the tree')
      const triggers = [...container.querySelectorAll('.helper-group-trigger')]
      assert.equal(triggers.length, fixture.groups.length, 'one collapsed disclosure per group')
      assert.equal(container.querySelectorAll('.helper-tree-children').length, fixture.groups.length, 'each group is one nested list')
      // The closed control states its count; the members it holds do not exist.
      assert.deepEqual([...container.querySelectorAll('.helper-group-count')].map((element) => element.textContent),
        fixture.expectedLabels, 'closed control states its count')
      assert.equal(container.querySelectorAll('.helper-group-members [data-thread-id]').length, 0, 'members exist only while expanded')
      assert.equal(container.querySelectorAll('.helper-thread-marker').length, 0, 'no subagent-inset marker anywhere')
      for (const [index, trigger] of triggers.entries()) {
        assert.equal(trigger.getAttribute('aria-expanded'), 'false')
        assert.equal(trigger.querySelector('.helper-group-show').textContent, 'show', 'closed control offers show')
        assert.equal(document.getElementById(trigger.getAttribute('aria-controls')), null, 'closed control reveals nothing')
        assert.equal(trigger.firstElementChild.tagName.toLowerCase(), 'svg', 'chevron leads the control')
        assert.equal(trigger.closest('.helper-tree-children') !== null, true, 'the chip sits indented inside the tree')
        if (index % 2) await press(trigger, 'Enter')
        else await click(trigger)
        assert.equal(trigger.getAttribute('aria-expanded'), 'true')
        assert.ok(document.activeElement === trigger, 'expansion preserves keyboard focus')
        assert.equal(trigger.querySelector('.helper-group-show').textContent, 'hide', 'open control offers hide')
      }
      if (fixture.update) await act(async () => updateRow(fixture.update))
      const memberRows = [...container.querySelectorAll('.helper-group-members [data-thread-id]')]
      assert.deepEqual(memberRows.map((row) => row.dataset.threadId), fixture.expectedRows, fixture.name)
      // The rail redraws over the rows that are actually mounted: the owner
      // anchor plus each revealed member, and nothing else.
      const expandedPerTree = fixture.groups.map((group) =>
        (fixture.owner ? 1 : 0) + (fixture.scopeExpired ? 0 : group.members.length))
      assert.deepEqual(trees.map((tree) => Number(tree.querySelector('.helper-tree-rail').dataset.anchorCount)), expandedPerTree, 'expanded anchors per tree')
      assert.equal(anchorCount(), fixture.expectedAnchorCounts.expanded, 'expanded anchors are the mounted checkboxes')
      for (const row of memberRows) {
        assert.ok(row.querySelector('.helper-thread-facts'), 'open member states its facts line')
        assert.ok(row.querySelector('.helper-thread-sep'), 'facts are middot separated')
        assert.equal(row.querySelector('.helper-thread-marker'), null, 'no inset marker on a member row')
        assert.equal(row.closest('li.helper-tree-row') !== null, true, 'each member is one tree row')
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
      // The owner checkbox governs the owner's OWN turns only: ticking it never
      // widens to a member, and the chip does not claim a member selection.
      if (fixture.owner && fixture.expectedRows.length) {
        const ownerInput = ownerRow.querySelector('input[type="checkbox"]')
        await click(ownerInput)
        assert.deepEqual(selected, [fixture.owner], 'owner checkbox selects only the owner row')
        assert.equal(ownerInput.checked, true)
        for (const memberInput of container.querySelectorAll('.helper-group-members input[type="checkbox"]')) {
          assert.equal(memberInput.checked, false, 'owner selection never widens to a member')
        }
        await click(ownerInput)
        assert.deepEqual(selected, [], 'owner checkbox toggles back off')
        assert.equal(ownerInput.checked, false)
      }
      if (fixture.select) {
        const groupIndex = fixture.groups.findIndex((group) => group.members.includes(fixture.select))
        const trigger = triggers[groupIndex]
        await click(container.querySelector(`.helper-group-members [data-thread-id="${fixture.select}"] input`))
        assert.deepEqual(selected, fixture.expectedSelected, 'explicit individual selection only')
        // Every checkbox matches the selected set: picking a member never
        // checks the owner or a sibling.
        for (const input of container.querySelectorAll('.helper-tree input[type="checkbox"]')) {
          const rowID = input.closest('[data-thread-id]').dataset.threadId
          assert.equal(input.checked, fixture.expectedSelected.includes(rowID), `checked state matches the selected set for ${rowID}`)
        }
        // Closing the control keeps the selection stated on it, and the members
        // it holds cease to exist until it is reopened.
        await click(trigger)
        assert.equal(trigger.getAttribute('aria-expanded'), 'false')
        assert.equal(container.querySelectorAll('.helper-group-members [data-thread-id]').length, 0, 'collapsed members are gone')
        assert.equal(trigger.querySelector('.helper-group-count').textContent, fixture.expectedSelectedLabel, 'closed control states the hidden selection')
        const stillMounted = fixture.expectedRows.filter((id) => !fixture.groups[groupIndex].members.includes(id)).length
        assert.equal(anchorCount(), (fixture.owner ? 1 : 0) + stillMounted, 'collapsed members drop out of the rail')
        await click(trigger)
        assert.ok(container.querySelector(`.helper-group-members [data-thread-id="${fixture.select}"] input`).checked, 'reopening retains the selection')
        assert.equal(anchorCount(), fixture.expectedAnchorCounts.expanded, 'reopening restores the traced anchors')
      }
      if (fixture.scopeExpired) {
        // Fail-closed honesty: an expired scope renders no stale member actions,
        // opens nothing, and refreshes only the originating list.
        assert.ok(container.querySelector('.helper-group-members') === null, 'expired scope hides stale member actions')
        assert.equal(anchorCount(), fixture.expectedAnchorCounts.expanded, 'expired scope holds the collapsed anchors')
        assert.deepEqual(opened, [], 'expired scope opens nothing')
        assert.deepEqual(selected, [], 'expired scope selects nothing')
        for (const action of container.querySelectorAll('.helper-group-action')) await click(action)
        assert.deepEqual(refreshed, fixture.groups.map((group) => group.id), 'refresh stays scoped to the originating list')
        // The refreshed scope is a new token, so the disclosure remounts closed.
        const refreshedTrigger = container.querySelector('.helper-group-trigger')
        assert.equal(refreshedTrigger.getAttribute('aria-expanded'), 'false', 'refreshed scope resets disclosure')
        assert.equal(refreshedTrigger.querySelector('.helper-group-count').textContent, fixture.expectedLabels[0], 'refreshed control states the restored count')
        assert.equal(anchorCount(), fixture.expectedAnchorCounts.collapsed, 'refreshed tree is back to its collapsed anchors')
        await click(refreshedTrigger)
        assert.deepEqual([...container.querySelectorAll('.helper-group-members [data-thread-id]')].map((row) => row.dataset.threadId), ['G2'], 'refresh restores the exact scope')
        assert.equal(anchorCount(), 1, 'refreshed member is traced')
      }
      const finallyMounted = fixture.scopeExpired
        ? fixture.groups.flatMap((group) => group.members)
        : fixture.expectedRows
      assert.deepEqual(mountedRowIDs(), [fixture.owner, ...finallyMounted].filter(Boolean), 'the tree holds exactly the owner and the mounted members')
      console.log(`PASS ${fixture.name}`)
    } finally { await act(async () => root.unmount()) }
  }

  // Display-only parity: with selection and navigation both absent, member rows
  // render the ordinary row anatomy, verbatim title, and counts with no
  // interactive chrome, no inset marker, and nothing for a rail to trace.
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

  // A display-only TREE mounts the same owner + group composition with both
  // optional behaviors off. The chip still expands, the members still render,
  // and the connector draws nothing because there is no checkbox to trace.
  for (const fixture of fixtures.cases) {
    if (fixture.scopeExpired || !fixture.groups.length) continue
    const container = document.getElementById('root')
    const root = createRoot(container)
    const row = (id) => React.createElement(HelperThreadRow, fixtures.rows[id])
    await act(async () => root.render(React.createElement(React.Fragment, null, fixture.groups.map((group) =>
      React.createElement(HelperGroupListItem, { key: group.id, owner: fixture.owner ? row(fixture.owner) : undefined, ownerStatus: fixture.ownerStatus },
        React.createElement(HelperGroup, {
          groupId: group.id, memberScope: group.scope, helperThreadCount: group.count,
          members: group.members, getMemberKey: (id) => id, renderMember: row,
        }))))))
    try {
      const rails = [...container.querySelectorAll('.helper-tree-rail')]
      assert.deepEqual(rails.map((rail) => rail.getAttribute('data-anchor-count')), fixture.groups.map(() => '0'),
        `${fixture.name}: no checkbox means no anchor`)
      assert.equal(container.querySelector('.helper-tree-rail__path'), null, 'display-only tree paints no connector')
      for (const trigger of [...container.querySelectorAll('.helper-group-trigger')]) {
        trigger.focus()
        await act(async () => trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })))
        assert.equal(trigger.getAttribute('aria-expanded'), 'true', 'display-only chip still expands')
      }
      assert.deepEqual([...container.querySelectorAll('.helper-group-members [data-thread-id]')].map((row) => row.dataset.threadId), fixture.expectedRows)
      assert.equal(container.querySelectorAll('.helper-tree input[type="checkbox"]').length, 0, 'display-only tree carries no checkboxes')
      assert.equal(container.querySelectorAll('.helper-tree a, .helper-tree button.helper-thread-open').length, 0, 'display-only tree carries no navigation')
      assert.deepEqual([...container.querySelectorAll('.helper-tree-rail')].map((rail) => rail.getAttribute('data-anchor-count')), fixture.groups.map(() => '0'),
        'expanded display-only tree still has nothing to trace')
      console.log(`PASS ${fixture.name} display-only tree`)
    } finally { await act(async () => root.unmount()) }
  }
} finally { await server.close(); dom.window.close() }

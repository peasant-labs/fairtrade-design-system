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
/** @typedef {{toggle: string, expectedSelected: string[], expectedOwnerState?: 'checked'|'unchecked'|'partial'}} SelectionStep */
/** @typedef {{name: string, owner?: string, ownerStatus?: string, ordinaryChild?: string, groups: GroupFixture[], expectedRows: string[], expectedLabels: string[], expectedText: string[], expectedAnchorCounts: AnchorCounts, selectionScript?: SelectionStep[], select?: string, expectedSelected?: string[], expectedSelectedLabel?: string, scopeExpired?: boolean, update?: {id: string, turnCount: number}}} GroupCase */
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
    // The selection oracle is a named ordered script, one step per toggle, each
    // stating the exact selected set afterwards. An owner-anchored tree must
    // state the rolled-up owner checkbox too; an ownerless tree has no rollup.
    const selectable = new Set([item.owner, ...item.groups.flatMap((group) => group.members)].filter(Boolean))
    for (const step of item.selectionScript || []) {
      assert.ok(selectable.has(step.toggle), `${item.name}: selection step toggles a mounted row`)
      assert.ok(Array.isArray(step.expectedSelected), `${item.name}: selection step states its selected set`)
      for (const id of step.expectedSelected) assert.ok(selectable.has(id), `${item.name}: expected selection names a mounted row`)
      if (item.owner) assert.ok(step.expectedOwnerState, `${item.name}: owner-anchored steps state the owner rollup`)
      else assert.ok(!step.expectedOwnerState, `${item.name}: an ownerless tree has no owner rollup`)
    }
    // The rail oracle: every MOUNTED checkbox is an anchor. The owner row has
    // one when the fixture has an owner; each group contributes its members
    // once expanded, and an expired scope reveals none.
    const ownerAnchors = item.owner ? 1 : 0
    const mountedMembers = item.scopeExpired ? 0 : item.expectedRows.length
    assert.deepEqual(item.expectedAnchorCounts, { collapsed: ownerAnchors, expanded: ownerAnchors + mountedMembers },
      `${item.name}: rail anchors trace exactly the mounted row checkboxes`)
    // A paging case carries the host page size and the nested group a member owns.
    // The nested group holds its own full authorized set, hangs inside a first-page
    // member of a top-level group, and pages on the same host limit.
    if (item.paging) {
      assert.ok(Number.isSafeInteger(item.paging.limit) && item.paging.limit >= 1,
        `${item.name}: paging limit is a positive integer`)
      assert.ok(item.groups.every((group) => group.count > item.paging.limit),
        `${item.name}: every paged top-level group holds more than one page`)
      assert.ok(Array.isArray(item.nested) && item.nested.length, `${item.name}: a paging case mounts the nested group`)
    } else {
      assert.equal(item.nested, undefined, `${item.name}: only a paging case nests a group`)
    }
    for (const entry of item.nested || []) {
      const nested = entry.group
      const host = item.groups.find((group) => group.members.includes(entry.owner))
      assert.ok(host && host.members.slice(0, item.paging.limit).includes(entry.owner),
        `${item.name}: nested owner ${entry.owner} is mounted on the first page of a top-level group`)
      assert.ok(nested?.id && nested.scope && Number.isSafeInteger(nested.count), `${item.name}: nested group summary required`)
      assert.equal(nested.members.length, nested.count, `${item.name}: nested count is the saved identity total`)
      for (const id of nested.members) assert.equal(data.rows[id]?.id, id)
      assert.ok(item.paging.limit < nested.count, `${item.name}: the nested group pages too`)
    }
    if (item.select) {
      assert.ok(item.expectedSelected?.length && item.expectedSelected.includes(item.select), `${item.name}: selection oracle names the picked row`)
      assert.ok(item.expectedSelectedLabel?.includes('selected'), `${item.name}: closed control must state the hidden selection count`)
    }
  }
  // The configured-selection oracle: the saved manual pick seeds the tree, the
  // owner cycle restores it, and a switch to a different tree resets to that
  // tree's configured selection.
  const configured = data.configured
  assert.ok(configured?.seed && configured?.switch, 'configured-selection oracle required')
  assert.notEqual(configured.seed.owner, configured.switch.owner, 'the configured switch is a different tree')
  for (const tree of [configured.seed, configured.switch]) {
    assert.ok(tree.groups?.length, 'a configured tree holds at least one group')
    for (const group of tree.groups) {
      assert.equal(group.members.length, group.count, 'configured count is saved identity total')
      for (const id of group.members) assert.equal(data.rows[id]?.id, id)
    }
  }
  const seedIDs = new Set([configured.seed.owner, ...configured.seed.groups.flatMap((group) => group.members)])
  assert.ok(configured.seed.initialSelectedIds?.length, 'the configured seed states its saved pick')
  for (const id of configured.seed.initialSelectedIds) assert.ok(seedIDs.has(id), 'the configured seed picks a mounted row')
  for (const step of configured.steps) {
    assert.ok(step.expectedSelected?.length && step.expectedOwnerState, 'configured steps state the selected set and owner rollup')
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
  const { HelperGroup, HelperGroupListItem, HelperThreadRow, useHelperSelection,
    helperOwnerState, helperSelectionIds, helperOwnerToggle, helperMemberToggle, HELPER_OWNER_STATE } = await server.ssrLoadModule('/src/ui/index.js')
  assert.equal(typeof HelperGroup, 'function', 'production public barrel export')
  assert.equal(typeof useHelperSelection, 'function', 'production selection policy hook export')
  assert.equal(typeof helperOwnerToggle, 'function', 'production owner-toggle reducer export')
  assert.equal(typeof helperMemberToggle, 'function', 'production member-toggle reducer export')
  assert.equal(typeof helperSelectionIds, 'function', 'production displayed-selection helper export')
  assert.equal(typeof helperOwnerState, 'function', 'production owner-rollup export')
  assert.equal(HELPER_OWNER_STATE.PARTIAL, 'partial', 'production owner-rollup vocabulary export')
  for (const fixture of fixtures.cases) {
    const opened = [], refreshed = []
    const container = document.getElementById('root')
    const root = createRoot(container)
    let updateRow
    function Host() {
      const [rowUpdates, setRowUpdates] = React.useState({})
      // Selection is host state, exactly as a real share/review picker holds
      // it. The DS owns the cascade/rollup policy; the host owns the state and
      // renders it back through the real rows.
      const memberIds = React.useMemo(() => fixture.owner
        ? [...new Set(fixture.groups.flatMap((group) => group.members))] : [], [])
      const selection = useHelperSelection({ ownerId: fixture.owner, memberIds })
      const [liveExpired, setLiveExpired] = React.useState(!!fixture.scopeExpired)
      updateRow = (update) => setRowUpdates((previous) => ({ ...previous, [update.id]: update }))
      const row = (id) => React.createElement(HelperThreadRow, { ...fixtures.rows[id], ...rowUpdates[id],
        // The owner row states the tree rollup; a member states only itself.
        selected: id === fixture.owner ? selection.ownerState === HELPER_OWNER_STATE.CHECKED : selection.isSelected(id),
        indeterminate: id === fixture.owner && selection.ownerState === HELPER_OWNER_STATE.PARTIAL,
        href: `/transcripts/${id}`, onOpen: (identity, event) => { event.preventDefault(); opened.push(identity) },
        onSelect: selection.onSelect,
      }, React.createElement('span', { className: 'route-status' }, `status for ${id}`),
      fixture.ordinaryChild && id === fixture.owner ? React.createElement('button', {
        type: 'button', className: 'ordinary-child-exit', onClick: () => opened.push(fixture.ordinaryChild),
      }, 'open ordinary child') : null)
      return React.createElement(React.Fragment, null,
        React.createElement('p', { className: 'selection-status', role: 'status' }, selection.selectedIds.join(',')),
        fixture.groups.map((group) =>
          React.createElement(HelperGroupListItem, { key: group.id, owner: fixture.owner ? row(fixture.owner) : undefined, ownerStatus: fixture.ownerStatus },
            React.createElement(HelperGroup, {
              groupId: group.id,
              // A refresh hands the group a new scope token, exactly as the demo does.
              memberScope: liveExpired ? group.scope : `${group.scope}-refreshed`,
              helperThreadCount: group.count,
              members: group.members, getMemberKey: (id) => id, renderMember: row,
              isMemberSelected: (id) => selection.isSelected(id),
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
    // The host's own selection, read back exactly as the demo states it.
    const selectionStatus = () => container.querySelector('.selection-status').textContent.split(',').filter(Boolean)
    await act(async () => root.render(React.createElement(Host)))
    try {
      assert.deepEqual(opened, [], 'mount must not navigate')
      assert.deepEqual(selectionStatus(), [], 'mount must not select')
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
      const triggers = [...container.querySelectorAll('.sgd-trigger')]
      assert.equal(triggers.length, fixture.groups.length, 'one collapsed disclosure per group')
      assert.equal(container.querySelectorAll('.helper-tree-children').length, fixture.groups.length, 'each group is one nested list')
      // The closed control states its count; the members it holds do not exist.
      assert.deepEqual([...container.querySelectorAll('.sgd-count')].map((element) => element.textContent),
        fixture.expectedLabels, 'closed control states its count')
      assert.equal(container.querySelectorAll('.helper-group-members [data-thread-id]').length, 0, 'members exist only while expanded')
      assert.equal(container.querySelectorAll('.helper-thread-marker').length, 0, 'no subagent-inset marker anywhere')
      for (const [index, trigger] of triggers.entries()) {
        assert.equal(trigger.getAttribute('aria-expanded'), 'false')
        assert.equal(trigger.querySelector('.sgd-show').textContent, 'show', 'closed control offers show')
        assert.equal(document.getElementById(trigger.getAttribute('aria-controls')), null, 'closed control reveals nothing')
        assert.equal(trigger.firstElementChild.tagName.toLowerCase(), 'svg', 'chevron leads the control')
        assert.equal(trigger.closest('.helper-tree-children') !== null, true, 'the chip sits indented inside the tree')
        if (index % 2) await press(trigger, 'Enter')
        else await click(trigger)
        assert.equal(trigger.getAttribute('aria-expanded'), 'true')
        assert.ok(document.activeElement === trigger, 'expansion preserves keyboard focus')
        assert.equal(trigger.querySelector('.sgd-show').textContent, 'hide', 'open control offers hide')
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
      assert.equal(container.querySelectorAll('.sgd-trigger input,.helper-group-context input').length, 0, 'no aggregate or context selection')
      for (const row of memberRows) await click(row.querySelector('a'))
      assert.deepEqual(opened, fixture.expectedRows, 'individual open identity')
      if (fixture.ordinaryChild) {
        await click(container.querySelector('.ordinary-child-exit'))
        assert.equal(opened.at(-1), fixture.ordinaryChild, 'retained ordinary child exit invokes its original callback')
      }
      // Explicit individual selection runs first, then clears its pick, so the
      // named state-machine script below starts from the same clean tree as every
      // other case. A member pick touches only that member and rolls the owner up.
      if (fixture.select) {
        const groupIndex = fixture.groups.findIndex((group) => group.members.includes(fixture.select))
        const trigger = triggers[groupIndex]
        await click(container.querySelector(`.helper-group-members [data-thread-id="${fixture.select}"] input`))
        assert.deepEqual(selectionStatus().sort(), [...fixture.expectedSelected].sort(), 'explicit individual selection only')
        // Every checkbox matches the selected set: picking a member never
        // checks the owner or a sibling. The owner states the rollup, so it is
        // cleanly checked only when the whole tree is selected.
        const treeIDs = [fixture.owner, ...fixture.groups.flatMap((group) => group.members)].filter(Boolean)
        for (const input of container.querySelectorAll('.helper-tree input[type="checkbox"]')) {
          const rowID = input.closest('[data-thread-id]').dataset.threadId
          if (rowID === fixture.owner) {
            const whole = treeIDs.every((id) => fixture.expectedSelected.includes(id))
            assert.equal(input.checked, whole, `owner is cleanly checked only when the whole tree is selected`)
            assert.equal(input.indeterminate, !whole && fixture.expectedSelected.length > 0, 'owner rolls the tree up to mixed')
          } else {
            assert.equal(input.checked, fixture.expectedSelected.includes(rowID), `checked state matches the selected set for ${rowID}`)
          }
        }
        // Closing the control keeps the selection stated on it, and the members
        // it holds cease to exist until it is reopened.
        await click(trigger)
        assert.equal(trigger.getAttribute('aria-expanded'), 'false')
        assert.equal(container.querySelectorAll('.helper-group-members [data-thread-id]').length, 0, 'collapsed members are gone')
        assert.equal(trigger.querySelector('.sgd-count').textContent, fixture.expectedSelectedLabel, 'closed control states the hidden selection')
        const stillMounted = fixture.expectedRows.filter((id) => !fixture.groups[groupIndex].members.includes(id)).length
        assert.equal(anchorCount(), (fixture.owner ? 1 : 0) + stillMounted, 'collapsed members drop out of the rail')
        await click(trigger)
        assert.ok(container.querySelector(`.helper-group-members [data-thread-id="${fixture.select}"] input`).checked, 'reopening retains the selection')
        assert.equal(anchorCount(), fixture.expectedAnchorCounts.expanded, 'reopening restores the traced anchors')
        await click(container.querySelector(`.helper-group-members [data-thread-id="${fixture.select}"] input`))
        assert.deepEqual(selectionStatus(), [], 'explicit selection cleared before the cycle script')
      }
      // The canonical two-state cycle, exercised through the real mounted rows and
      // the exported host hook: one named fixture step per toggle, each stating
      // the exact selected set and the owner rollup afterwards.
      if (fixture.selectionScript) assert.deepEqual(selectionStatus(), [], `${fixture.name}: clean selection before the script`)
      for (const step of fixture.selectionScript || []) {
        await click(container.querySelector(`.helper-tree [data-thread-id="${step.toggle}"] input[type="checkbox"]`))
        // Selection is a set; insertion order is not part of the contract.
        assert.deepEqual(selectionStatus().sort(), [...step.expectedSelected].sort(),
          `${fixture.name}: selected set after toggling ${step.toggle}`)
        if (!fixture.owner) continue
        const ownerInput = ownerRow.querySelector('input[type="checkbox"]')
        assert.equal(ownerInput.checked, step.expectedOwnerState === 'checked',
          `${fixture.name}: owner checked after toggling ${step.toggle}`)
        assert.equal(ownerInput.indeterminate, step.expectedOwnerState === 'partial',
          `${fixture.name}: owner mixed after toggling ${step.toggle}`)
        assert.equal(ownerInput.getAttribute('aria-checked'), step.expectedOwnerState === 'partial' ? 'mixed' : null,
          `${fixture.name}: owner mixed state is exposed to assistive technology`)
      }
      if (fixture.scopeExpired) {
        // Fail-closed honesty: an expired scope renders no stale member actions,
        // opens nothing, and refreshes only the originating list.
        assert.ok(container.querySelector('.helper-group-members') === null, 'expired scope hides stale member actions')
        assert.equal(anchorCount(), fixture.expectedAnchorCounts.expanded, 'expired scope holds the collapsed anchors')
        assert.deepEqual(opened, [], 'expired scope opens nothing')
        assert.deepEqual(selectionStatus(), [], 'expired scope selects nothing')
        for (const action of container.querySelectorAll('.helper-group-action')) await click(action)
        assert.deepEqual(refreshed, fixture.groups.map((group) => group.id), 'refresh stays scoped to the originating list')
        // The refreshed scope is a new token, so the disclosure remounts closed.
        const refreshedTrigger = container.querySelector('.sgd-trigger')
        assert.equal(refreshedTrigger.getAttribute('aria-expanded'), 'false', 'refreshed scope resets disclosure')
        assert.equal(refreshedTrigger.querySelector('.sgd-count').textContent, fixture.expectedLabels[0], 'refreshed control states the restored count')
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

  // The pure reducer replay: the same named script drives the exported
  // helperOwnerToggle and helperMemberToggle with no DOM, so the policy is
  // verifiable on its own and the mounted suite above proves the hook applies
  // exactly it.
  for (const fixture of fixtures.cases) {
    if (!fixture.selectionScript) continue
    const memberIds = fixture.owner ? [...new Set(fixture.groups.flatMap((group) => group.members))] : []
    let state = { allActive: false, manual: new Set() }
    for (const step of fixture.selectionScript) {
      if (step.toggle === fixture.owner) {
        state = helperOwnerToggle(state)
      } else {
        const before = helperSelectionIds(state, fixture.owner, memberIds)
        state = helperMemberToggle(state, fixture.owner, memberIds, step.toggle, !before.includes(step.toggle))
      }
      const displayed = helperSelectionIds(state, fixture.owner, memberIds)
      assert.deepEqual(displayed.slice().sort(), [...step.expectedSelected].sort(),
        `${fixture.name}: reducer selected set after toggling ${step.toggle}`)
      if (fixture.owner) {
        assert.equal(helperOwnerState(fixture.owner, memberIds, (id) => displayed.includes(id)), step.expectedOwnerState,
          `${fixture.name}: reducer owner rollup after toggling ${step.toggle}`)
      }
    }
    console.log(`PASS ${fixture.name} reducer`)
  }

  // The configured-selection oracle: the saved manual pick seeds the tree, the
  // owner cycle restores it, and a scenario switch to a different tree resets to
  // that tree's configured selection instead of carrying the pick over.
  {
    const { seed, switch: next, steps } = fixtures.configured
    const container = document.getElementById('root')
    const root = createRoot(container)
    let active = seed
    const memberIdsOf = (tree) => [...new Set(tree.groups.flatMap((group) => group.members))]
    const click = async (element) => {
      assert.ok(element, 'configured selection action exists')
      element.focus()
      await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })))
    }
    function ConfiguredHost() {
      const selection = useHelperSelection({
        ownerId: active.owner, memberIds: memberIdsOf(active), initialSelectedIds: active.initialSelectedIds || [],
      })
      const row = (id) => React.createElement(HelperThreadRow, { ...fixtures.rows[id],
        selected: id === active.owner ? selection.ownerState === HELPER_OWNER_STATE.CHECKED : selection.isSelected(id),
        indeterminate: id === active.owner && selection.ownerState === HELPER_OWNER_STATE.PARTIAL,
        onSelect: selection.onSelect })
      return React.createElement(React.Fragment, null,
        React.createElement('p', { className: 'selection-status', role: 'status' }, selection.selectedIds.join(',')),
        active.groups.map((group) => React.createElement(HelperGroupListItem, { key: group.id, owner: row(active.owner) },
          React.createElement(HelperGroup, {
            groupId: group.id, memberScope: group.scope, helperThreadCount: group.count,
            members: group.members, getMemberKey: (id) => id, renderMember: row,
          }))))
    }
    const status = () => container.querySelector('.selection-status').textContent.split(',').filter(Boolean)
    const ownerInput = () => container.querySelector('.helper-tree-rows > .helper-tree-row input[type="checkbox"]')
    await act(async () => root.render(React.createElement(ConfiguredHost)))
    try {
      assert.deepEqual(status().sort(), [...seed.initialSelectedIds].sort(), 'the configured selection seeds the manual state')
      assert.equal(ownerInput().indeterminate, true, 'a configured partial tree rolls the owner up to mixed')
      for (const step of steps) {
        await click(container.querySelector(`.helper-tree [data-thread-id="${step.toggle}"] input[type="checkbox"]`))
        assert.deepEqual(status().sort(), [...step.expectedSelected].sort(), `configured: selected set after toggling ${step.toggle}`)
        assert.equal(ownerInput().checked, step.expectedOwnerState === 'checked', `configured: owner checked after toggling ${step.toggle}`)
        assert.equal(ownerInput().indeterminate, step.expectedOwnerState === 'partial', `configured: owner mixed after toggling ${step.toggle}`)
      }
      active = next
      await act(async () => root.render(React.createElement(ConfiguredHost)))
      assert.deepEqual(status(), [], 'switching trees resets to the new configured selection')
      assert.equal(ownerInput().checked, false, 'the new tree owner starts unchecked')
      assert.equal(ownerInput().indeterminate, false, 'the new tree owner starts clean')
      console.log('PASS configured selection seed and reset')
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
      for (const trigger of [...container.querySelectorAll('.sgd-trigger')]) {
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

  // The canonical memberFooter slot: the host's paging controls render inside the
  // OPEN body, immediately after the member rows (or the empty notice), and never
  // while the group is folded or scope-expired. A host that passes nothing keeps
  // exactly the DOM it had before the slot existed.
  {
    const container = document.getElementById('root')
    const root = createRoot(container)
    const click = async (element) => {
      assert.ok(element, 'footer case action exists')
      element.focus()
      await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })))
    }
    const row = (id) => React.createElement(HelperThreadRow, fixtures.rows[id])
    const slot = () => React.createElement('span', { className: 'slot-marker' }, 'page 1 of 2')
    const group = (caseName, props) => React.createElement('div', { 'data-case': caseName },
      React.createElement(HelperGroupListItem, { owner: row('P1') },
        React.createElement(HelperGroup, {
          groupId: `hg_footer_${caseName}`, memberScope: `footer-${caseName}`,
          helperThreadCount: 2, members: ['G1', 'G2'], getMemberKey: (id) => id, renderMember: row, ...props,
        })))
    await act(async () => root.render(React.createElement(React.Fragment, null,
      group('open', { memberFooter: slot() }),
      group('absent', {}),
      group('expired', { scopeExpired: true, onRefreshList: () => {}, memberFooter: slot() }),
      group('empty', { helperThreadCount: 0, members: [], memberFooter: slot() }))))
    try {
      assert.equal(container.querySelectorAll('.slot-marker').length, 0, 'a folded group renders no paging slot')
      for (const trigger of [...container.querySelectorAll('.sgd-trigger')]) await click(trigger)
      const caseOf = (name) => container.querySelector(`[data-case="${name}"]`)
      const bodyOf = (name) => caseOf(name).querySelector('.helper-group-body')
      // Open: the slot is the body's last element, right after the rows it pages.
      const openBody = bodyOf('open')
      assert.equal(openBody.children[0].className, 'helper-group-members', 'the open body leads with the member rows')
      assert.equal(openBody.children[1].className, 'helper-group-footer', 'the paging slot follows the rows inside the body')
      assert.ok(openBody.children[1].querySelector('.slot-marker'), 'the slot holds the host paging content')
      assert.equal(openBody.lastElementChild.classList.contains('helper-group-footer'), true, 'the slot is the last thing in the open body')
      // Absent: nothing is added when the host passes no slot.
      assert.equal(caseOf('absent').querySelector('.helper-group-footer'), null, 'no slot prop adds no slot element')
      // Expired: fail-closed keeps only the refresh control it already had.
      assert.ok(bodyOf('expired').querySelector('.helper-group-action'), 'the expired body keeps its refresh control')
      assert.equal(caseOf('expired').querySelector('.helper-group-footer'), null, 'a scope-expired group renders no paging slot')
      // Empty: the slot follows the no-saved-helpers notice, so an out-of-range
      // page still has somewhere canonical to land.
      const emptyBody = bodyOf('empty')
      assert.equal(emptyBody.children[0].className, 'helper-group-notice', 'the empty body leads with the no-saved-helpers notice')
      assert.equal(emptyBody.children[1].className, 'helper-group-footer', 'the paging slot follows the empty notice')
      assert.ok(emptyBody.children[1].querySelector('.slot-marker'), 'an empty page still has the canonical paging slot')
      assert.equal(container.querySelectorAll('.slot-marker').length, 2, 'only the non-expired groups mount the slot')
      console.log('PASS member footer slot placement and gating')
    } finally { await act(async () => root.unmount()) }
  }

  // Two independent live paging states in ONE tree: the owner P1's group and the
  // nested group G1 owns each keep their own host page state and render their own
  // previous/next into the memberFooter slot. Paging one never moves the other, and
  // the nested page survives its owning row leaving and returning to the parent page.
  {
    const pagingCase = fixtures.cases.find((item) => item.name === 'two-live-paging-states')
    const { limit } = pagingCase.paging
    const parent = pagingCase.groups[0]
    const nested = pagingCase.nested[0].group
    const container = document.getElementById('root')
    const root = createRoot(container)
    const click = async (element) => {
      assert.ok(element, 'paging action exists')
      element.focus()
      await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })))
    }
    const pages = { [parent.id]: 1, [nested.id]: 1 }
    const pageCount = (group) => Math.ceil(group.count / limit)
    const footer = (group) => React.createElement('span', { className: 'paging-slot', 'data-footer': group.id },
      React.createElement('span', { className: 'page-indicator' }, `page ${pages[group.id]} of ${pageCount(group)}`),
      React.createElement('button', { type: 'button', className: 'page-prev',
        onClick: () => { pages[group.id] = Math.max(1, pages[group.id] - 1); setVersion((n) => n + 1) } }, 'previous'),
      React.createElement('button', { type: 'button', className: 'page-next',
        onClick: () => { pages[group.id] = Math.min(pageCount(group), pages[group.id] + 1); setVersion((n) => n + 1) } }, 'next'))
    let setVersion
    function row(id) {
      const owns = id === pagingCase.nested[0].owner ? nested : null
      return React.createElement(HelperThreadRow, fixtures.rows[id], owns ? React.createElement(HelperGroup, {
        groupId: owns.id, memberScope: owns.scope, helperThreadCount: owns.count,
        members: owns.members.slice((pages[owns.id] - 1) * limit, pages[owns.id] * limit),
        getMemberKey: (key) => key, renderMember: row, memberFooter: footer(owns),
      }) : null)
    }
    function PagingHost() {
      const [, bump] = React.useState(0)
      setVersion = bump
      return React.createElement(HelperGroupListItem, { owner: row(pagingCase.owner) },
        React.createElement(HelperGroup, {
          groupId: parent.id, memberScope: parent.scope, helperThreadCount: parent.count,
          members: parent.members.slice((pages[parent.id] - 1) * limit, pages[parent.id] * limit),
          getMemberKey: (id) => id, renderMember: row, memberFooter: footer(parent),
        }))
    }
    const rootOf = (id) => `.helper-group[data-group-id="${id}"]`
    const bodyOf = (id) => container.querySelector(`${rootOf(id)} > .sgd > .helper-group-body`)
    // Scope the controls to THIS group's own footer: a nested group's footer
    // lives inside the parent's member list, so a body-wide query would find the
    // deeper group's page indicator first.
    const footerOf = (id) => container.querySelector(`${rootOf(id)} > .sgd > .helper-group-body > .helper-group-footer`)
    const rowsOf = (id) => [...container.querySelectorAll(
      `${rootOf(id)} > .sgd > .helper-group-body > .helper-group-members > li > [data-thread-id]`)].map((row) => row.dataset.threadId)
    const indicator = (id) => footerOf(id).querySelector('.page-indicator').textContent
    const slice = (group, page) => group.members.slice((page - 1) * limit, page * limit)
    await act(async () => root.render(React.createElement(PagingHost)))
    try {
      await click(container.querySelector(`${rootOf(parent.id)} .sgd-trigger`))
      assert.equal(indicator(parent.id), `page 1 of ${pageCount(parent)}`)
      assert.deepEqual(rowsOf(parent.id), slice(parent, 1))
      await click(container.querySelector(`${rootOf(nested.id)} .sgd-trigger`))
      assert.equal(indicator(nested.id), `page 1 of ${pageCount(nested)}`)
      assert.deepEqual(rowsOf(nested.id), slice(nested, 1))
      // Paging the nested group leaves the parent page and rows untouched.
      await click(footerOf(nested.id).querySelector('.page-next'))
      assert.equal(indicator(nested.id), `page 2 of ${pageCount(nested)}`)
      assert.deepEqual(rowsOf(nested.id), slice(nested, 2))
      assert.equal(indicator(parent.id), `page 1 of ${pageCount(parent)}`, 'nested paging leaves the parent page')
      assert.deepEqual(rowsOf(parent.id), slice(parent, 1))
      // Paging the parent moves only the parent; the nested group unmounts with G1.
      await click(footerOf(parent.id).querySelector('.page-next'))
      assert.equal(indicator(parent.id), `page 2 of ${pageCount(parent)}`)
      assert.deepEqual(rowsOf(parent.id), slice(parent, 2))
      assert.equal(container.querySelector(rootOf(nested.id)), null, 'nested group unmounts with its owning row')
      // Returning remounts the nested group; its host page state was never reset.
      await click(footerOf(parent.id).querySelector('.page-prev'))
      assert.deepEqual(rowsOf(parent.id), slice(parent, 1))
      await click(container.querySelector(`${rootOf(nested.id)} .sgd-trigger`))
      assert.equal(indicator(nested.id), `page 2 of ${pageCount(nested)}`, 'the parent page never reset the nested page')
      assert.deepEqual(rowsOf(nested.id), slice(nested, 2))
      console.log('PASS two independent live paging states')
    } finally { await act(async () => root.unmount()) }
  }
} finally { await server.close(); dom.window.close() }

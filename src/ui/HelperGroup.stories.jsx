import HelperGroupsDemo from '../mockups/inuse/HelperGroupsDemo.jsx'
import { expect, userEvent, within, waitFor } from 'storybook/test'

export default {
  title: 'lists/helper groups',
  component: HelperGroupsDemo,
  parameters: { layout: 'padded' },
}

export const OwnerRetained = {
  args: { scenario: 'three-independent-counts' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /2 helper threads/ })
    const label = canvas.getByTestId('helper-group-label')
    const tree = canvasElement.querySelector('.helper-tree')
    const rail = canvasElement.querySelector('.helper-tree-rail')
    await expect(tree).not.toBeNull()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(label).toHaveTextContent('2 helper threads')
    await expect(within(trigger).getByText('show')).toBeVisible()
    // The owner row anchors the collapsed tree: one checkbox, one rail stub.
    await waitFor(() => expect(rail).toHaveAttribute('data-anchor-count', '1'))
    // Members exist only while the control is open.
    await expect(canvas.queryByRole('checkbox', { name: /\(G1\)/ })).toBeNull()
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(within(trigger).getByText('hide')).toBeVisible()
    // The rail traces the owner plus both revealed members, nothing else.
    await waitFor(() => expect(rail).toHaveAttribute('data-anchor-count', '3'))
    await userEvent.click(canvas.getByRole('checkbox', { name: /\(G2\)/ }))
    await expect(canvas.getByText('selected transcripts: G2')).toBeVisible()
    // A member pick never widens up or across; the owner states the mixed
    // rollup (checked is false, the accessible mixed state is set).
    const owner = canvas.getByRole('checkbox', { name: /\(P1\)/ })
    await expect(owner).not.toBeChecked()
    await expect(owner).toHaveAttribute('aria-checked', 'mixed')
    await expect(owner.indeterminate).toBe(true)
    await expect(canvas.getByRole('checkbox', { name: /\(G1\)/ })).not.toBeChecked()
    // Closing the control leaves the selection stated on it, never silent.
    await userEvent.click(trigger)
    await expect(label).toHaveTextContent('2 helper threads, 1 selected')
    await expect(canvas.queryByRole('checkbox', { name: /\(G2\)/ })).toBeNull()
    // The collapsed tree is back to its single owner anchor.
    await waitFor(() => expect(rail).toHaveAttribute('data-anchor-count', '1'))
  },
}
export const HelperOnlySearch = {
  args: { scenario: 'helper-only-search' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /1 helper thread/ })
    const label = canvas.getByTestId('helper-group-label')
    // Count one singularizes; one member reveals as an ordinary row.
    await expect(label).toHaveTextContent('1 helper thread')
    await expect(label).not.toHaveTextContent('1 helper threads')
    await userEvent.click(trigger)
    await expect(canvas.getByRole('link', { name: 'Review Parser' })).toBeVisible()
    // An ownerless result traces only the member it reveals.
    await waitFor(() => expect(canvasElement.querySelector('.helper-tree-rail')).toHaveAttribute('data-anchor-count', '1'))
  },
}
export const UnknownOwners = { args: { scenario: 'unresolved-independent' } }
export const IdenticalHelpers = { args: { scenario: 'identical-independent-helpers' } }
export const TrunkAppend = { args: { scenario: 'trunk-append' } }
export const TrunkReplacement = { args: { scenario: 'trunk-replacement' } }
export const UnavailableOwner = { args: { scenario: 'unavailable-owner' } }
export const ExpiredQuery = {
  args: { scenario: 'scope-expired' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /1 helper thread/ }))
    await expect(canvas.getByText(/no broader results were loaded/)).toBeVisible()
    await expect(canvasElement.querySelector('.helper-group-members')).toBeNull()
    // Nothing is mounted to trace, so the fail-closed tree paints no connector.
    await waitFor(() => expect(canvasElement.querySelector('.helper-tree-rail')).toHaveAttribute('data-anchor-count', '0'))
  },
}
export const NestedOwner = {
  args: { scenario: 'measured-zero' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /1 helper thread/ }))
    // G1 is an ordinary row that itself owns this group; G2 sits one level in.
    const owner = canvas.getByRole('checkbox', { name: /\(G1\)/ })
    // Both rows state 0 input submissions, so scope the fact to its own row.
    const member = canvasElement.querySelector('[data-thread-id="G2"]')
    await expect(within(member).getByText('0 input submissions')).toBeVisible()
    await waitFor(() => expect(canvasElement.querySelector('.helper-tree-rail')).toHaveAttribute('data-anchor-count', '2'))
    // The owner cascades: ticking G1 selects G1 and the helper member under it.
    await userEvent.click(owner)
    await expect(owner).toBeChecked()
    await expect(owner).not.toHaveAttribute('aria-checked', 'mixed')
    await expect(canvas.getByRole('checkbox', { name: /\(G2\)/ })).toBeChecked()
    await expect(canvas.getByText('selected transcripts: G1, G2')).toBeVisible()
  },
}
export const OwnerCascade = {
  args: { scenario: 'three-independent-counts' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /2 helper threads/ }))
    const owner = canvas.getByRole('checkbox', { name: /\(P1\)/ })
    const g1 = canvas.getByRole('checkbox', { name: /\(G1\)/ })
    const g2 = canvas.getByRole('checkbox', { name: /\(G2\)/ })
    // The repro sequence: with nothing selected, pick a helper, then the owner.
    // The owner press selects the whole tree; the next press RESTORES the manual
    // pick instead of clearing it, so the helper the viewer chose first survives
    // and the owner reads partial.
    await userEvent.click(g1)
    await expect(canvas.getByText('selected transcripts: G1')).toBeVisible()
    await expect(owner).toHaveAttribute('aria-checked', 'mixed')
    await userEvent.click(owner)
    await expect(owner).toBeChecked()
    await expect(g1).toBeChecked()
    await expect(g2).toBeChecked()
    await expect(canvas.getByText('selected transcripts: P1, G1, G2')).toBeVisible()
    await userEvent.click(owner)
    await expect(owner).not.toBeChecked()
    await expect(owner).toHaveAttribute('aria-checked', 'mixed')
    await expect(owner.indeterminate).toBe(true)
    await expect(g1).toBeChecked()
    await expect(g2).not.toBeChecked()
    await expect(canvas.getByText('selected transcripts: G1')).toBeVisible()
    // Check the owner again, then edit a member while the whole tree is in the
    // all-selection. Unticking G2 writes the manual side to all-but-G2, so the
    // owner press after that restores all-but-G2 rather than a bare clear.
    await userEvent.click(owner)
    await expect(g2).toBeChecked()
    await userEvent.click(g2)
    await expect(g2).not.toBeChecked()
    await expect(g1).toBeChecked()
    await expect(owner).toHaveAttribute('aria-checked', 'mixed')
    await expect(canvas.getByText('selected transcripts: P1, G1')).toBeVisible()
    await userEvent.click(owner)
    await expect(g2).toBeChecked()
    await expect(canvas.getByText('selected transcripts: P1, G1, G2')).toBeVisible()
    await userEvent.click(owner)
    await expect(g2).not.toBeChecked()
    await expect(g1).toBeChecked()
    await expect(owner).toHaveAttribute('aria-checked', 'mixed')
    await expect(canvas.getByText('selected transcripts: P1, G1')).toBeVisible()
  },
}
export const UnknownInputs = { args: { scenario: 'unknown-input-count' } }
export const OrdinaryChildExit = { args: { scenario: 'ordinary-child-exit' } }
export const TwoLivePagingStates = {
  args: { scenario: 'two-live-paging-states' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = (id) => canvasElement.querySelector(`[data-group-id="${id}"] > .sgd > .helper-group-body`)
    const ownRows = (id) => [...canvasElement.querySelectorAll(
      `[data-group-id="${id}"] > .sgd > .helper-group-body > .helper-group-members > li > [data-thread-id]`)]
      .map((row) => row.dataset.threadId)
    const paging = (id) => body(id).querySelector(`.helper-group-footer > [data-helper-paging="${id}"]`)
    const indicator = (id) => paging(id).querySelector('.helper-demo-page').textContent
    // The owner's group opens on its first page. The paging controls sit in the
    // group's canonical footer slot, after the rows they page.
    await userEvent.click(canvas.getByRole('button', { name: /4 helper threads/ }))
    await expect(indicator('hg_paged_parent')).toBe('page 1 of 2')
    await expect(ownRows('hg_paged_parent')).toEqual(['G1', 'G3'])
    await expect(body('hg_paged_parent').lastElementChild.classList.contains('helper-group-footer')).toBe(true)
    await expect(paging('hg_paged_parent').querySelector('[data-helper-prev]').disabled).toBe(true)
    // G1 owns the nested group: opening it reveals the second independent page state.
    await userEvent.click(canvasElement.querySelector('[data-group-id="hg_paged_nested"] .sgd-trigger'))
    await expect(indicator('hg_paged_nested')).toBe('page 1 of 2')
    await expect(ownRows('hg_paged_nested')).toEqual(['G2', 'G5'])
    // Paging the nested group leaves the parent exactly where it was.
    await userEvent.click(paging('hg_paged_nested').querySelector('[data-helper-next]'))
    await expect(indicator('hg_paged_nested')).toBe('page 2 of 2')
    await expect(ownRows('hg_paged_nested')).toEqual(['G7'])
    await expect(paging('hg_paged_nested').querySelector('[data-helper-next]').disabled).toBe(true)
    await expect(indicator('hg_paged_parent')).toBe('page 1 of 2')
    await expect(ownRows('hg_paged_parent')).toEqual(['G1', 'G3'])
    // Paging the parent moves only the parent; the nested group's controlling row
    // leaves the mounted page, and when it returns the host page is still page 2.
    await userEvent.click(paging('hg_paged_parent').querySelector('[data-helper-next]'))
    await expect(indicator('hg_paged_parent')).toBe('page 2 of 2')
    await expect(ownRows('hg_paged_parent')).toEqual(['G4', 'G6'])
    await expect(canvasElement.querySelector('[data-group-id="hg_paged_nested"]')).toBeNull()
    await userEvent.click(paging('hg_paged_parent').querySelector('[data-helper-prev]'))
    await expect(indicator('hg_paged_parent')).toBe('page 1 of 2')
    await userEvent.click(canvasElement.querySelector('[data-group-id="hg_paged_nested"] .sgd-trigger'))
    await expect(indicator('hg_paged_nested')).toBe('page 2 of 2')
    await expect(ownRows('hg_paged_nested')).toEqual(['G7'])
  },
}
export const DisplayOnly = {
  args: { scenario: 'three-independent-counts', plain: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /2 helper threads/ })
    await userEvent.click(trigger)
    await expect(canvas.getAllByText('Review Parser')).toHaveLength(2)
    await expect(canvas.queryByRole('checkbox')).toBeNull()
    await expect(canvas.queryByRole('link')).toBeNull()
    // No checkboxes means nothing to trace: the tree paints no connector.
    await expect(canvasElement.querySelector('.helper-tree')).not.toBeNull()
    await waitFor(() => expect(canvasElement.querySelector('.helper-tree-rail')).toHaveAttribute('data-anchor-count', '0'))
    await expect(canvasElement.querySelector('.helper-tree-rail__path')).toBeNull()
  },
}

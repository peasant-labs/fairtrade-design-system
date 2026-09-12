import HelperGroupsDemo from '../mockups/inuse/HelperGroupsDemo.jsx'
import { expect, userEvent, within } from 'storybook/test'

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
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(label).toHaveTextContent('2 helper threads')
    await expect(within(trigger).getByText('show')).toBeVisible()
    // Members exist only while the control is open.
    await expect(canvas.queryByRole('checkbox', { name: /\(G1\)/ })).toBeNull()
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(within(trigger).getByText('hide')).toBeVisible()
    await userEvent.click(canvas.getByRole('checkbox', { name: /\(G2\)/ }))
    await expect(canvas.getByText('selected transcripts: G2')).toBeVisible()
    await expect(canvas.getByRole('checkbox', { name: /\(P1\)/ })).not.toBeChecked()
    await expect(canvas.getByRole('checkbox', { name: /\(G1\)/ })).not.toBeChecked()
    // Closing the control leaves the selection stated on it, never silent.
    await userEvent.click(trigger)
    await expect(label).toHaveTextContent('2 helper threads, 1 selected')
    await expect(canvas.queryByRole('checkbox', { name: /\(G2\)/ })).toBeNull()
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
  },
}
export const UnknownOwners = { args: { scenario: 'unresolved-independent' } }
export const IdenticalHelpers = { args: { scenario: 'identical-independent-helpers' } }
export const TrunkAppend = { args: { scenario: 'trunk-append' } }
export const TrunkReplacement = { args: { scenario: 'trunk-replacement' } }
export const UnavailableOwner = { args: { scenario: 'unavailable-owner' } }
export const ExpiredQuery = { args: { scenario: 'scope-expired' } }
export const NestedOwner = { args: { scenario: 'measured-zero' } }
export const UnknownInputs = { args: { scenario: 'unknown-input-count' } }
export const OrdinaryChildExit = { args: { scenario: 'ordinary-child-exit' } }
export const DisplayOnly = {
  args: { scenario: 'three-independent-counts', plain: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /2 helper threads/ })
    await userEvent.click(trigger)
    await expect(canvas.getAllByText('Review Parser')).toHaveLength(2)
    await expect(canvas.queryByRole('checkbox')).toBeNull()
    await expect(canvas.queryByRole('link')).toBeNull()
  },
}

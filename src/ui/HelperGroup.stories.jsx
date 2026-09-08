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
    const trigger = canvas.getByRole('button', { name: /guardian reviews/ })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(canvas.getByRole('checkbox', { name: /\(G2\)/ }))
    await expect(canvas.getByText('selected transcripts: G2')).toBeVisible()
    await expect(canvas.getByRole('checkbox', { name: /\(P1\)/ })).not.toBeChecked()
    await expect(canvas.getByRole('checkbox', { name: /\(G1\)/ })).not.toBeChecked()
  },
}
export const HelperOnlySearch = { args: { scenario: 'helper-only-search' } }
export const UnknownOwners = { args: { scenario: 'unresolved-independent' } }
export const UnavailableOwner = { args: { scenario: 'unavailable-owner' } }
export const ExpiredQuery = { args: { scenario: 'scope-expired' } }
export const FailedMembers = { args: { scenario: 'member-error' } }
export const MemberPaging = { args: { scenario: 'focus-pagination' } }
export const UnknownInputs = { args: { scenario: 'unknown-input-count' } }
export const LoadingMembers = { args: { scenario: 'loading-members' } }

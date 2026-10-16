import YAML from 'yaml'
import source from '../../scripts/testdata/village-observations.yaml?raw'
import VillageObservations from './VillageObservations.jsx'
import { frame } from './story-frame.jsx'
import { expect, userEvent, within } from 'storybook/test'

const fixture = YAML.parse(source, { merge: true })
export default { title: 'in use/Village observations', component: VillageObservations, decorators: frame('wide') }
export const IndependentResults = {
  args: fixture.base,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: 'history', exact: true }))
    await expect(canvas.getByText('Historical Collective')).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'confirmed receipts' }))
    await expect(canvas.getByText('submitted; approval not confirmed')).toBeVisible()
  },
}
export const NeverFetched = { args: fixture.cases.find((row) => row.name === 'never-fetched').props }
export const HiddenEvidence = { args: fixture.cases.find((row) => row.name === 'hidden-dated-evidence').props }
export const LongContent = { args: fixture.cases.find((row) => row.name === 'long-content').props }
export const PagingConflict = { args: fixture.cases.find((row) => row.name === 'selected-page-conflict').props }

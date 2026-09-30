import { expect, userEvent, within } from 'storybook/test'
import OverflowList from './OverflowList.jsx'

/* components/OverflowList: the first items, then +N for the rest ("#42, #45 +2"). */
const links = (numbers) => numbers.map((n) => <a key={n} href={`#pr-${n}`} className="mono">#{n}</a>)
const meta = { title: 'components/OverflowList', component: OverflowList, tags: ['autodocs'], args: { label: 'pull requests', noun: ['pull request', 'pull requests'], limit: 2 } }
export default meta

export const OverTheLimit = {
  name: 'over the limit',
  args: { items: links([42, 45, 51, 60]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'show 2 more pull requests' }))
    await expect(canvas.getByText('#60')).toBeVisible()
  },
}
export const AtTheLimit = { name: 'at the limit', args: { items: links([42, 45]) } }
export const One = { args: { items: links([42]) } }
export const None = { args: { items: [], empty: <span className="mono">none</span> } }

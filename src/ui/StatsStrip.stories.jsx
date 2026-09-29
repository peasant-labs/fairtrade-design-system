import { expect, within } from 'storybook/test'
import StatsStrip from './StatsStrip.jsx'
import { frame } from './story-frame.jsx'

/* StatsStrip: one inline row of stat pairs, tabular values, spacing between pairs. Pairs read
   value-first unless a pair asks for label-first. Nothing renders for no pairs. */
const meta = {
  title: 'components/StatsStrip',
  component: StatsStrip,
  tags: ['autodocs'],
  decorators: frame('wide'),
  args: {
    label: 'your sessions in numbers',
    items: [
      { value: 1284, label: 'sessions' },
      { value: 7, label: 'projects' },
      { value: 38, label: 'published' },
      { value: 23, label: 'this week' },
      { label: 'longest streak', value: '3 wk', order: 'label-first' },
      { label: 'median session', value: '34m', order: 'label-first' },
    ],
  },
}
export default meta

export const ManyPairs = {
  name: 'many pairs',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('list', { name: 'your sessions in numbers' })
    await expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    await expect(canvas.getByText('1,284')).toHaveClass('tnum')
    await expect(within(list).getAllByRole('listitem')[4]).toHaveTextContent('longest streak 3 wk')
  },
}

export const OnePair = {
  name: 'one pair',
  args: { label: 'collective', items: [{ value: 248, label: 'transcripts' }] },
}

export const Empty = {
  args: { items: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.sst')).toBeNull()
  },
}

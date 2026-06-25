import { expect, within } from 'storybook/test'
import Scorecard from './Scorecard.jsx'
import { frame } from '../story-frame.jsx'

/* Scorecard story (exported as TranscriptScorecard). Renders the cooked ScorecardBandVM[] from
   vm.analytics.scorecardBands; render-when-present (empty bands → nothing). */

const bands = [
  { id: 'token', label: 'token efficiency', band: 'watch', value: '8% retry tokens', detail: '1,300 tokens spent on the retry after typecheck' },
  { id: 'prompt', label: 'prompt quality', band: 'ok', value: 'spec 72/100', detail: 'has examples · no explicit constraints' },
  { id: 'loop', label: 'loop efficiency', band: 'good', value: '1 max error streak', detail: 'recovered in 1 turn' },
]

const meta = {
  title: 'in use/transcript/TranscriptScorecard',
  component: Scorecard,
  tags: ['autodocs'],
  decorators: frame('wide'),
}
export default meta

export const Default = {
  args: { bands },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText('how this session went')).toBeInTheDocument()
    expect(canvas.getByText('token efficiency')).toBeInTheDocument()
    expect(canvas.getByText('watch')).toBeInTheDocument()
  },
}

export const Empty = { args: { bands: [] } }

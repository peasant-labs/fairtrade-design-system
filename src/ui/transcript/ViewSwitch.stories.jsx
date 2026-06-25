import ViewSwitch from './ViewSwitch.jsx'
import { frame } from '../story-frame.jsx'

/* ViewSwitch story (exported as TranscriptViewSwitch). A labelled on/off switch for the filters
   rail "view options". Controlled — the caller owns `on`. */

const meta = {
  title: 'in use/transcript/TranscriptViewSwitch',
  component: ViewSwitch,
  tags: ['autodocs'],
  decorators: frame('panel'),
}
export default meta

export const On = { args: { label: 'expand all tool calls', on: true } }
export const Off = { args: { label: 'compact mode', on: false } }

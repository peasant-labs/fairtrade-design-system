import CheckRow from './CheckRow.jsx'
import { frame } from '../story-frame.jsx'

/* CheckRow story (exported as TranscriptCheckRow). A single controlled filter row with an
   optional trailing match count. */

const meta = {
  title: 'in use/transcript/TranscriptCheckRow',
  component: CheckRow,
  tags: ['autodocs'],
  decorators: frame('panel'),
}
export default meta

export const Checked = { args: { checked: true, count: 6, children: 'responses' } }
export const Unchecked = { args: { checked: false, count: 2, children: 'thinking' } }
export const Disabled = { args: { checked: false, disabled: true, count: 0, children: 'fetch' } }

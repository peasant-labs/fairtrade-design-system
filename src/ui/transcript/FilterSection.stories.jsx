import FilterSection from './FilterSection.jsx'
import CheckRow from './CheckRow.jsx'
import { frame } from '../story-frame.jsx'

/* FilterSection story (exported as TranscriptFilterSection). A collapsible titled section; the
   open/closed state is local disclosure UI seeded by defaultOpen. */

const meta = {
  title: 'in use/transcript/TranscriptFilterSection',
  component: FilterSection,
  tags: ['autodocs'],
  decorators: frame('panel'),
}
export default meta

export const Open = {
  args: {
    title: 'outcome',
    defaultOpen: true,
    children: (
      <>
        <CheckRow checked>errors</CheckRow>
        <CheckRow>retries</CheckRow>
        <CheckRow>re-edit</CheckRow>
      </>
    ),
  },
}

export const Collapsed = {
  args: { title: 'view options', defaultOpen: false, children: <CheckRow>compact mode</CheckRow> },
}

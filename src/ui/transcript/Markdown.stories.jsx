import Markdown from './Markdown.jsx'
import { frame } from '../story-frame.jsx'

/* Markdown story. CSF3, title 'in use/transcript/Markdown'. The transcript's minimal inline
   renderer: **bold** + `code`, plain text otherwise. Content keeps its case; the .txn-body /
   .txn-inlinecode rules come from src/index.css. */

const meta = {
  title: 'in use/transcript/TranscriptMarkdown',
  component: Markdown,
  tags: ['autodocs'],
  decorators: frame('panel'),
  argTypes: { text: { control: 'text' } },
}
export default meta

export const Default = {
  args: {
    text: 'Reading the current renderer before extracting it. The **TurnRow** lives under `src/canvas/` — I should read it before moving anything.',
  },
}

export const Plain = {
  args: { text: 'no markup here, just plain transcript prose that keeps its case.' },
}

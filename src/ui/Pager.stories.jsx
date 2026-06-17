import Pager from './Pager.jsx'

/* CSF3: a Playground driven by argTypes plus one named story per meaningful state.
   classes + tokens come from src/index.css via .storybook/preview.jsx; the theme
   toolbar flips data-theme. the simple prev/next pager — prev/next icon buttons
   flanking a "page x / y" label, disabling at the ends. */
const meta = {
  title: 'components/Pager',
  component: Pager,
  tags: ['autodocs'],
  argTypes: {
    page: { control: { type: 'number', min: 1 } },
    total: { control: { type: 'number', min: 1 } },
    label: { control: 'text' },
    onPrev: { action: 'prev' },
    onNext: { action: 'next' },
    onChange: { action: 'change' },
  },
  args: { page: 3, total: 8, label: 'transcript pages' },
}
export default meta

export const Playground = {}

export const Middle = { args: { page: 4, total: 12, label: 'collective transcripts' } }

export const AtStart = { args: { page: 1, total: 8, label: 'redaction queue' } }

export const AtEnd = { args: { page: 8, total: 8, label: 'redaction queue' } }

export const SinglePage = { args: { page: 1, total: 1, label: 'claude-code sessions' } }

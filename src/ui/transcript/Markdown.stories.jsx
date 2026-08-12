import Markdown from './Markdown.jsx'
import { frame } from '../story-frame.jsx'

/* Markdown story. CSF3, title 'in use/transcript/TranscriptMarkdown'. The example keeps
   transcript content's original case while exercising the same structured output that consumers
   receive from the public component. */

const structuredMarkdown = `## Turn Summary

The **TurnRow** keeps CamelCase content and visible
source newlines beside \`inlineCode\`.

- unordered item
- [x] completed task
- [ ] pending task

1. ordered item
2. another ordered item

| File | Status |
| --- | --- |
| src/TurnRow.jsx | Ready |
| src/Markdown.jsx | Reviewed |

\`\`\`js
const Result = "OriginalCase"
return Result
\`\`\``

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

export const Structured = {
  decorators: frame('wide'),
  args: { text: structuredMarkdown },
}

export const Narrow = {
  decorators: frame('narrow'),
  args: { text: structuredMarkdown },
}

export const Plain = {
  args: { text: 'no markup here, just plain transcript prose that keeps its case.' },
}

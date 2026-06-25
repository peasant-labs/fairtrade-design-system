import LabelPopover from './LabelPopover.jsx'

/* LabelPopover story (exported as TranscriptLabelPopover). The per-turn labelling overlay; in the
   composite it renders ONLY when capabilities.canLabel is true. It draws its own full-bleed scrim,
   so no story frame. */

const meta = {
  title: 'in use/transcript/TranscriptLabelPopover',
  component: LabelPopover,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta

export const New = { args: { turnId: 4 } }
export const Existing = { args: { turnId: 4, current: { outcome: 'bad', flag: 'retry-loop' } } }

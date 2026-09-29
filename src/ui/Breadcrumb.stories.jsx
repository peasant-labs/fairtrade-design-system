import { expect, within } from 'storybook/test'
import Breadcrumb, { Steps } from './Breadcrumb.jsx'
import { frame } from './story-frame.jsx'
import { Home, Users, FileText } from 'lucide-react'

/* CSF3: a Playground driven by argTypes plus one named story per meaningful state.
   classes + tokens come from src/index.css via .storybook/preview.jsx; the theme
   toolbar flips data-theme. Breadcrumb is the primary export; Steps (the wizard
   sibling) is shown via render functions under one meta/title. */
const meta = {
  title: 'components/Breadcrumb',
  component: Breadcrumb,
  decorators: frame('wide'),
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    items: { control: 'object' },
  },
  args: {
    label: 'breadcrumb',
    items: [
      { label: 'commons', href: '#' },
      { label: 'collectives', href: '#' },
      { label: 'climate-justice-coalition' },
    ],
  },
}
export default meta

function ForwardingLink({ href, className, children, ...rest }) {
  return <a {...rest} href={href} className={className} data-custom-link="custom-link">{children}</a>
}

export const Playground = {}

export const MixedCaseContent = {
  args: {
    items: [
      { label: 'Village', href: '#village' },
      { label: 'Collectives', href: '#collectives' },
      { label: 'AI Research Team' },
    ],
  },
}

export const ChromeItems = {
  args: {
    items: [
      { label: 'Village', href: '#village', chrome: true },
      { label: 'Collectives', href: '#collectives', chrome: true },
      { label: 'AI Research Team' },
    ],
  },
}

export const CustomLinkForwarding = {
  args: {
    LinkComponent: ForwardingLink,
    items: [
      { label: 'village', href: '#village' },
      { label: 'collectives', href: '#collectives' },
      { label: 'AI Research Team' },
    ],
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'collectives' })
    expect(link).toHaveAttribute('href', '#collectives')
    expect(link).toHaveAttribute('class', 'link')
    expect(link).toHaveAttribute('data-custom-link', 'custom-link')
  },
}

export const WithIcons = {
  args: {
    items: [
      { label: 'home', href: '#', icon: Home },
      { label: 'collectives', href: '#', icon: Users },
      { label: 'intake transcript', icon: FileText },
    ],
  },
}

export const SingleCurrent = {
  args: {
    items: [{ label: 'transcripts' }],
  },
}

export const DeepPath = {
  args: {
    items: [
      { label: 'commons', href: '#' },
      { label: 'collectives', href: '#' },
      { label: 'climate-justice-coalition', href: '#' },
      { label: 'transcripts', href: '#' },
      { label: 'claude-code session 0418', href: '#' },
      { label: 'redaction review' },
    ],
  },
}

export const LongLabel = {
  args: {
    items: [
      { label: 'commons', href: '#' },
      { label: 'collectives', href: '#' },
      { label: 'climate-justice-coalition-of-the-greater-bay-area-working-group' },
    ],
  },
}

/* Steps sibling — the step wizard. State reads from icon/number, never color alone:
   done shows a Check, cur is the active step, todo shows its 1-based index. */
export const StepsWizard = {
  render: () => (
    <Steps
      steps={[
        { label: 'upload transcript', status: 'done' },
        { label: 'redact identities', status: 'done' },
        { label: 'assign collective', status: 'cur' },
        { label: 'publish to commons', status: 'todo' },
      ]}
    />
  ),
}

export const StepsFirst = {
  render: () => (
    <Steps
      steps={[
        { label: 'connect provider', status: 'cur' },
        { label: 'import gemini-cli logs', status: 'todo' },
        { label: 'review redaction', status: 'todo' },
      ]}
    />
  ),
}

export const StepsComplete = {
  render: () => (
    <Steps
      steps={[
        { label: 'upload transcript', status: 'done' },
        { label: 'redact identities', status: 'done' },
        { label: 'publish to commons', status: 'done' },
      ]}
    />
  ),
}

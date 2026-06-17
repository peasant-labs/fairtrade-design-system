import EmptyState from './EmptyState.jsx'
import Button from './Button.jsx'
import { Compass, Inbox, Users, ShieldAlert, Plus, Search } from 'lucide-react'

/* CSF3: a Playground driven by argTypes plus one named story per meaningful state.
   classes + tokens come from src/index.css via .storybook/preview.jsx. EmptyState is
   left-aligned by design and renders the `.empty` markup (ringed icon, h3, p, action). */
const meta = {
  title: 'feedback/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    icon: { control: false },
    title: { control: 'text' },
    message: { control: 'text' },
    action: { control: false },
  },
  args: {
    icon: Inbox,
    title: 'no transcripts yet',
    message: 'nothing has been published to this collective. import a session from claude-code or gemini-cli to get started.',
  },
}
export default meta

export const Playground = {}

export const Default = {
  args: {
    icon: Inbox,
    title: 'no transcripts yet',
    message: 'nothing has been published to this collective. import a session from claude-code or gemini-cli to get started.',
  },
}

export const WithAction = {
  args: {
    icon: Plus,
    title: 'start your first collective',
    message: 'collectives bundle related transcripts under a shared redaction policy.',
    action: (
      <Button variant="primary" icon={Plus}>
        new collective
      </Button>
    ),
  },
}

export const NoMessage = {
  args: {
    icon: Compass,
    title: 'pick a transcript to explore',
    message: undefined,
  },
}

export const NoResults = {
  args: {
    icon: Search,
    title: 'no matches for "redaction"',
    message: 'no transcripts in the commons matched your filters. try a broader query or clear the provider filter.',
    action: (
      <Button variant="ghost">clear filters</Button>
    ),
  },
}

export const NoMembers = {
  args: {
    icon: Users,
    title: 'this collective is empty',
    message: 'invite contributors so they can publish and review transcripts together.',
    action: (
      <Button variant="secondary" icon={Plus}>
        invite contributors
      </Button>
    ),
  },
}

export const ErrorState = {
  args: {
    icon: ShieldAlert,
    title: 'redaction pass failed',
    message: 'we could not finish scanning this transcript for secrets. nothing was published. retry when you are ready.',
    action: (
      <Button variant="danger">retry redaction</Button>
    ),
  },
}

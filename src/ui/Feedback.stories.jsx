import { Skeleton, Progress, Spinner, Toast, FeedbackPanel } from './Feedback.jsx'
import BrandMark from './BrandMark.jsx'
import { frame } from './story-frame.jsx'
import { UploadCloud, Inbox } from 'lucide-react'

/* feedback surfaces from sections/36-states.html: skeleton, progress, spinner, toast and
   inline panel. each pairs an icon with a label and wires the right live region. classes +
   tokens come from src/index.css via .storybook/preview.jsx; the theme toolbar flips
   data-theme. Spinner is the primary export; siblings are storied via render fns. */
const meta = {
  title: 'feedback/Feedback',
  component: Spinner,
  tags: ['autodocs'],
  decorators: frame('panel'),
  argTypes: {
    children: { control: 'text' },
  },
  args: { children: 'syncing transcripts' },
}
export default meta

// ── Spinner (primary export) ───────────────────────────────────────────────
export const Playground = {}

export const SpinnerDefault = {
  render: () => <Spinner>fetching collective feed</Spinner>,
}

// ── Skeleton ───────────────────────────────────────────────────────────────
export const SkeletonLoading = {
  render: () => <Skeleton label="loading transcript" lines={3} />,
}

export const SkeletonNoAvatar = {
  render: () => <Skeleton label="loading rows" avatar={false} lines={4} />,
}

// ── Progress ───────────────────────────────────────────────────────────────
export const ProgressBar = {
  render: () => <Progress value={62} label="redacting names" />,
}

export const ProgressEmpty = {
  render: () => <Progress value={0} label="queued for review" />,
}

export const ProgressComplete = {
  render: () => <Progress value={100} label="published to commons" />,
}

// ── Toast ──────────────────────────────────────────────────────────────────
export const ToastOk = {
  render: () => (
    <div aria-live="polite">
      <Toast
        variant="ok"
        title={
          <>
            <BrandMark name="claude" /> claude-code published
          </>
        }
        onClose={() => {}}
      >
        shared to the collective.
      </Toast>
    </div>
  ),
}

export const ToastError = {
  render: () => (
    <div aria-live="assertive">
      <Toast
        variant="err"
        title={
          <>
            <BrandMark name="gemini" /> gemini-cli redaction failed
          </>
        }
        onClose={() => {}}
      >
        2 names still exposed in the session.
      </Toast>
    </div>
  ),
}

export const ToastCustomIcon = {
  render: () => (
    <div aria-live="polite">
      <Toast variant="ok" title="upload complete" icon={UploadCloud} onClose={() => {}}>
        38 transcripts added to the shared archive.
      </Toast>
    </div>
  ),
}

// ── FeedbackPanel ──────────────────────────────────────────────────────────
export const PanelEmpty = {
  render: () => (
    <FeedbackPanel variant="empty" icon={Inbox} title="no transcripts yet">
      publish your first session to share it with the collective.
    </FeedbackPanel>
  ),
}

export const PanelLoading = {
  render: () => (
    <FeedbackPanel variant="loading">gathering sessions from the commons.</FeedbackPanel>
  ),
}

export const PanelError = {
  render: () => (
    <FeedbackPanel variant="error">
      couldn't reach the provider. retry in a moment.
    </FeedbackPanel>
  ),
}

// ── prop coverage ────────────────────────────────────────────────────────────
export const ProgressNoPct = {
  render: () => <Progress value={45} label="importing" showPct={false} />,
}

export const SkeletonAvatarOnly = {
  render: () => <Skeleton label="loading profile" avatar lines={0} />,
}

export const SpinnerCustomIcon = {
  render: () => <Spinner icon={UploadCloud}>uploading</Spinner>,
}

export const ToastNoClose = {
  render: () => (
    <div aria-live="polite">
      <Toast variant="ok" title="saved">
        no dismiss button on this toast.
      </Toast>
    </div>
  ),
}

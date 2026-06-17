import Card, { CardImg, Row, MetaItem } from './Card.jsx'
import { Clock, MessageSquare, ScissorsLineDashed, Users, Star, FileText } from 'lucide-react'

/* card & row primitives storied: the default export is the bare <Card/> surface; CardImg, Row and
   MetaItem are shown via render fns under one meta/title. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. the thumb is a plain placeholder node,
   not an image import — it's decorative imagery the caller slots in. */

/* a small aria-hidden specimen standing in for an <AsciiImage/> thumbnail */
const Thumb = ({ label = 'claude-code' }) => (
  <pre
    aria-hidden="true"
    style={{
      margin: 0,
      padding: '1.25rem',
      fontFamily: 'var(--mono, monospace)',
      fontSize: '0.7rem',
      lineHeight: 1.15,
      letterSpacing: '0.04em',
      color: 'var(--ink-3, #888)',
      background:
        'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(128,128,128,0.08) 6px, rgba(128,128,128,0.08) 12px)',
    }}
  >
    {`░▒▓█ ${label} █▓▒░
▓▒░·   transcript   ·░▒▓
░·  ▟▙ ▟▙ ▟▙ ▟▙ ▟▙  ·░`}
  </pre>
)

const meta = {
  title: 'components/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    link: { control: 'boolean' },
    className: { control: 'text' },
    children: { control: false },
  },
  args: {
    link: false,
    children: (
      <div className="card-body">
        <h3>migrating the redaction pipeline</h3>
        <p className="desc">
          a pairing session walking through pii scrubbing before a transcript joins the commons.
        </p>
      </div>
    ),
  },
}
export default meta

/* bare Card surface — controls drive link + className */
export const Playground = {}

/* the whole card rendered as a single anchor target */
export const AsLink = {
  args: {
    link: true,
    href: '#',
    children: (
      <div className="card-body">
        <h3>onboarding a new collective</h3>
        <p className="desc">click anywhere — the entire surface is one target.</p>
      </div>
    ),
  },
}

/* imagery-on-top variant: the primary composed card */
export const Imagery = {
  render: () => (
    <CardImg
      href="#"
      thumb={<Thumb label="claude-code" />}
      head={
        <>
          <span className="grow">claude-code</span>
          <MessageSquare size={14} aria-hidden="true" />
        </>
      }
      title="refactoring the consent ledger"
      desc="a long pairing run untangling who agreed to what before the transcript was shared back to the commons."
      bullets={['scope: 14 files touched', 'redacted: 3 secrets, 1 email', 'reviewed by riverbend collective']}
      foot={
        <>
          <span className="avatar" aria-hidden="true">rc</span>
          <span className="grow">riverbend collective</span>
          <MetaItem icon={Clock} value="42m" />
          <MetaItem icon={MessageSquare} value="118" />
        </>
      }
    />
  ),
}

/* a redacted-heavy transcript card */
export const Redacted = {
  render: () => (
    <CardImg
      href="#"
      thumb={<Thumb label="gemini-cli" />}
      head={
        <>
          <span className="grow">gemini-cli</span>
          <ScissorsLineDashed size={14} aria-hidden="true" />
        </>
      }
      title="incident replay — payment outage"
      desc="shared with heavy redaction; account ids and tokens scrubbed before this entered the commons."
      bullets={['redacted: 22 spans', 'visibility: collective-only', 'retention: 90 days']}
      foot={
        <>
          <span className="avatar" aria-hidden="true"> on</span>
          <span className="grow">on-call guild</span>
          <MetaItem icon={ScissorsLineDashed} value="22" />
          <MetaItem icon={Clock} value="1h 06m" />
        </>
      }
    />
  ),
}

/* minimal card: title + desc only, no thumb / bullets / foot */
export const Minimal = {
  render: () => (
    <CardImg
      link={false}
      title="a quiet pairing session"
      desc="just a title and a summary — every other slot is optional."
    />
  ),
}

/* a single dense-list row with a flexible label column and tabular metadata */
export const DenseRow = {
  render: () => (
    <Row>
      <span className="avatar" aria-hidden="true">cc</span>
      <span className="grow">tuning the retrieval prompt</span>
      <MetaItem icon={Clock} value="08m" />
      <MetaItem icon={MessageSquare} value="34" />
    </Row>
  ),
}

/* stacked rows collapse their shared border automatically (.row + .row) */
export const RowList = {
  render: () => (
    <div>
      <Row>
        <span className="avatar" aria-hidden="true">cc</span>
        <span className="grow">migrating the redaction pipeline</span>
        <MetaItem icon={Users}>riverbend collective</MetaItem>
        <MetaItem icon={Clock} value="42m" />
      </Row>
      <Row>
        <span className="avatar" aria-hidden="true">gc</span>
        <span className="grow">incident replay — payment outage</span>
        <MetaItem icon={Users}>on-call guild</MetaItem>
        <MetaItem icon={Clock} value="1h 06m" />
      </Row>
      <Row>
        <span className="avatar" aria-hidden="true">cc</span>
        <span className="grow">tuning the retrieval prompt</span>
        <MetaItem icon={Users}>commons stewards</MetaItem>
        <MetaItem icon={Clock} value="08m" />
      </Row>
    </div>
  ),
}

/* the metaitem family: icon-only count, icon + label, a bare tabular value, and a mono variant */
export const MetaItems = {
  render: () => (
    <Row>
      <MetaItem icon={MessageSquare} value="118" />
      <MetaItem icon={Star}>featured</MetaItem>
      <MetaItem icon={FileText} value="14">files</MetaItem>
      <span className="grow" />
      <MetaItem className="mono" value="t-0042">id</MetaItem>
    </Row>
  ),
}

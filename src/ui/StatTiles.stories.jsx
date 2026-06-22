import { FileText, Coins, Users, MessagesSquare, Clock, Lock, GitPullRequest, UserCog } from 'lucide-react'
import { StatTile, StatGrid, GovTile, ProviderBars } from './StatTiles.jsx'
import { frame } from './story-frame.jsx'

/* StatTiles stories. CSF3 under 'in use/' — the governance + KPI surface of a collective hub,
   the same four facts village renders at the top of a collective: a KPI row (StatGrid), three
   governance tiles (GovTile), and a provider distribution (ProviderBars). All numbers are
   pre-formatted USER CONTENT. classes + tokens come from StatTiles.css (imported by the component)
   and src/index.css via .storybook/preview.jsx; the theme toolbar flips data-theme. */

// The collective's headline metrics, pre-formatted the way the product would (compact M/K, etc.).
const KPI_TILES = [
  { key: 'transcripts', label: 'transcripts', value: '1,284', icon: FileText },
  { key: 'tokens', label: 'tokens', value: '4.2M', icon: Coins },
  { key: 'contributors', label: 'contributors', value: '38', icon: Users },
  { key: 'turns', label: 'turns', value: '9,610', icon: MessagesSquare },
  { key: 'duration', label: 'avg duration', value: '14m', sub: 'per session', icon: Clock },
]

// Provider mix, caller pre-sorted high → low. Values are the raw counts behind each share.
const PROVIDERS = [
  { label: 'claude-code', value: 62 },
  { label: 'gemini-cli', value: 18 },
  { label: 'codex', value: 11 },
  { label: 'opencode', value: 6 },
  { label: 'cursor', value: 3 },
]

const meta = {
  title: 'in use/StatTiles',
  component: StatTile,
  parameters: { layout: 'centered' },
}

export default meta

/** The KPI row — a StatGrid of five tiles, the avg-duration tile carrying a sub line. */
export const KPIs = {
  decorators: frame('wide'),
  render: () => <StatGrid tiles={KPI_TILES} />,
}

/** Governance — three GovTiles: access (scarce → amber), contributions, your role. */
export const Governance = {
  decorators: frame('wide'),
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-4)' }}>
      <GovTile label="access" value="members only" icon={Lock} tone="amber" />
      <GovTile label="contributions" value="curated" icon={GitPullRequest} tone="olive" />
      <GovTile label="your role" value="contributor" icon={UserCog} tone="teal" />
    </div>
  ),
}

/** Provider distribution — labeled monochrome bars, read by length + label + the written %. */
export const ProviderDistribution = {
  decorators: frame('panel'),
  render: () => <ProviderBars data={PROVIDERS} total={100} />,
}

/** A single KPI tile, for reference at its natural size. */
export const SingleTile = {
  decorators: frame('narrow'),
  render: () => <StatTile label="transcripts" value="1,284" icon={FileText} />,
}

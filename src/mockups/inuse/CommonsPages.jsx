import { useMemo, useState } from 'react'
import { MoreHorizontal, Search, Download, Pencil, Eye } from 'lucide-react'
import {
  CopyIconButton,
  DataTable,
  Input,
  Menu,
  OverflowList,
  ProviderIcon,
  Segmented,
  SettingGroup,
  SettingRow,
  SignInProviders,
  StatsStrip,
  TranscriptViewer,
} from '../../ui'
import {
  COLLECTIVE,
  HOME_STATS,
  LINKED_REPOS,
  MY_COLLECTIVES,
  MY_TRANSCRIPTS,
  REPO_OWNERS,
  TRANSCRIPT_PULL_REQUESTS,
  VIEWER,
  WHO_CAN_PUBLISH,
  WHO_CAN_READ,
} from './village-fixture.js'
import {
  CollectivesView as ShippedCollectivesView,
  CollectiveDetailView as ShippedCollectiveDetailView,
  CollectiveSettingsView as ShippedCollectiveSettingsView,
} from '../../ui/commons/Collectives.jsx'

/* The village pages of the in-use commons demo: sign-in, your home, the collectives list, a
   collective, its settings, your settings, and the transcript page. The list, the collective and
   its settings render the shipped views (src/ui/commons/Collectives.jsx) with the demo's data.
   Nothing here fetches. Recorded names keep their case; chrome is lowercase. */

const demoWrite = () => new Promise((resolve) => setTimeout(resolve, 700))
const harnessName = (harness) => String(harness).replace(/-/g, ' ')
const demoHref = (view) => `?app=commons&commons=${view}#inuse`

function prLinks(numbers, onOpen) {
  return numbers.map((number) => (
    <a key={number} className="cmg-pr-link tnum" href={demoHref('pull-request')} onClick={(event) => { if (onOpen) { event.preventDefault(); onOpen(number) } }}>{number}</a>
  ))
}

/* ── sign-in ─────────────────────────────────────────────────────────────── */

/** The sign-in page: GitHub only, and the handle is the GitHub login. */
export function SignInPage({ onSignIn }) {
  return (
    <div className="iu-page cmg-signin">
      <div className="cmg-signin-card">
        <p className="cmg-signin-brand mono">village</p>
        <h2 className="iu-page-title" data-chrome-heading>the agent sessions behind your team&apos;s pull requests</h2>
        <p className="iu-page-sub">peasant records your AI coding sessions on your machine. village keeps the ones you publish, shared with your collectives, and links them to pull requests.</p>
        <SignInProviders onSignIn={onSignIn} />
        <ul className="cmg-signin-notes">
          <li>first time here? your handle is your GitHub login. change it later in your profile.</li>
          <li>using the cli? <code className="mono">peasant village login</code> uses the same GitHub sign-in.</li>
        </ul>
      </div>
    </div>
  )
}

/* ── home ────────────────────────────────────────────────────────────────── */

/** Your home: your transcripts, who can read each one, their pull requests, and your collectives. */
export function VillageHome({ onNavigate }) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')
  const rows = useMemo(() => MY_TRANSCRIPTS.filter((row) =>
    (scope === 'all' || row.sharedWith.includes(scope)) && (!query.trim() || row.title.toLowerCase().includes(query.trim().toLowerCase()))), [query, scope])
  const columns = [
    {
      key: 'title',
      label: 'title',
      width: '20rem',
      render: (_, row) => (
        <span className="iu-session">
          <ProviderIcon harness={row.harness} accent />
          <span className="iu-session-text">
            <a className="iu-session-title" href={demoHref('transcript-detail')} onClick={(event) => { event.preventDefault(); onNavigate?.('transcript-detail') }}>{row.title}</a>
            <span className="iu-session-sub">{harnessName(row.harness)} · {row.project} · {row.branch}</span>
          </span>
        </span>
      ),
    },
    { key: 'sharedWith', label: 'shared with', render: (_, row) => <span className="cmg-shared">{row.sharedWith.map((name) => <span key={name}>{name}{row.waiting ? ' · waiting' : ''}</span>)}</span> },
    { key: 'pullRequests', label: 'pull requests', render: (_, row) => <OverflowList items={prLinks(row.pullRequests, () => onNavigate?.('pull-request'))} label="pull requests" noun={['pull request', 'pull requests']} empty={<span className="cmg-none">none</span>} /> },
    { key: 'when', label: 'when' },
  ]
  return (
    <div className="iu-page">
      <header className="iu-page-head">
        <h2 className="iu-page-title" data-chrome-heading>your transcripts</h2>
        <p className="iu-page-sub">sessions you published from peasant. only the collectives you picked can read each one.</p>
      </header>
      <StatsStrip items={HOME_STATS} label="your transcripts in numbers" />
      <div className="cmg-home">
        <div className="cmg-home-main">
          <div className="iu-page-search" role="search">
            <Input label="search your transcripts" type="search" iconLeft={Search} placeholder="search your transcripts" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="iu-page-toolbar">
            <Segmented label="shared with" className="cmg-scope" value={scope} onChange={setScope} options={[{ value: 'all', label: 'all' }, ...MY_COLLECTIVES.map((c) => ({ value: c.name, label: c.name }))]} />
          </div>
          <DataTable caption="transcripts you published" columns={columns} rows={rows} rowKey={(row) => row.id} />
          <div className="iu-page-foot">
            <span className="iu-page-count"><span className="tnum">{rows.length}</span> of <span className="tnum">38</span> transcripts</span>
            <button type="button" className="btn btn-secondary btn-sm">show 20 more</button>
          </div>
        </div>
        <aside className="cmg-rail" aria-label="your collectives">
          <section className="cmg-rail-box">
            <div className="cmg-rail-head">
              <h3 className="cmg-rail-title">your collectives</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate?.('collectives')}>view all</button>
            </div>
            <ul className="cmg-rail-list">
              {MY_COLLECTIVES.map((collective) => (
                <li key={collective.id}>
                  <button type="button" className="cmg-rail-link" onClick={() => onNavigate?.('collective-detail')}>{collective.name}</button>
                  <span className="cmg-rail-meta">{collective.role} · <span className="tnum">{collective.members}</span> members</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="cmg-rail-box">
            <h3 className="cmg-rail-title">waiting for approval</h3>
            <ul className="cmg-rail-list">
              {MY_TRANSCRIPTS.filter((row) => row.waiting).map((row) => (
                <li key={row.id}>
                  <span className="cmg-rail-name">{row.title}</span>
                  <span className="cmg-rail-meta">the owner of {row.sharedWith[0]} approves each transcript before members can read it. {row.when}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

/* ── the shipped collectives views, with the demo's data ─────────────────── */

/* the demo's destinations for the shipped views' links */
const DEMO_VIEW = { collectives: 'collectives', collective: 'collective-detail', settings: 'collective-settings', transcript: 'transcript-detail', 'pull-request': 'pull-request', account: 'account' }
const demoHrefFor = (kind) => (DEMO_VIEW[kind] ? demoHref(DEMO_VIEW[kind]) : undefined)
const demoNoop = () => {}

/** The collectives list (the shipped CollectivesView) with the demo's collectives. */
export function CollectivesView({ data = {}, actions = {} } = {}) {
  return (
    <ShippedCollectivesView
      data={{
        collectives: MY_COLLECTIVES.map((c) => ({ ...c, mode: c.joining === 'verified only' ? 'verified_only' : c.joining })),
        linkedOrgs: ['acme'],
        caption: 'your collectives',
        whoCanPublish: WHO_CAN_PUBLISH,
        whoCanRead: WHO_CAN_READ,
        ...data,
      }}
      actions={{ onSearchCollectives: demoNoop, ...actions }}
    />
  )
}

/** A collective (the shipped CollectiveDetailView) with the demo's collective. */
export function CollectiveDetailView({ data = {}, actions = {} } = {}) {
  return (
    <ShippedCollectiveDetailView
      data={{ collective: COLLECTIVE, owners: REPO_OWNERS, linkedRepos: LINKED_REPOS, hrefFor: demoHrefFor, ...data }}
      actions={{ onReview: demoNoop, onLinkRepos: demoNoop, onShowMore: demoNoop, ...actions }}
    />
  )
}

/** A collective's settings (the shipped CollectiveSettingsView) with the demo's collective. */
export function CollectiveSettingsView({ data = {}, actions = {} } = {}) {
  return (
    <ShippedCollectiveSettingsView
      data={{ collective: COLLECTIVE, owners: REPO_OWNERS, linkedRepos: LINKED_REPOS, showOnPullRequests: true, whoCanPublish: WHO_CAN_PUBLISH, whoCanRead: WHO_CAN_READ, hrefFor: demoHrefFor, ...data }}
      actions={{ onCommit: () => demoWrite(), onInvite: demoNoop, onRemoveMember: demoNoop, onRoleChange: demoNoop, onLinkRepos: demoNoop, onTransferOwnership: demoNoop, onDelete: demoNoop, ...actions }}
    />
  )
}

/* ── your settings ───────────────────────────────────────────────────────── */

/** Your settings: profile, automatic pull request linking (off by default), connections. */
export function AccountSettingsView({ actions = {} } = {}) {
  const write = (key) => (value) => (actions.onCommit ? actions.onCommit(key, value) : demoWrite())
  return (
    <>
      <div className="iu-page cmg-settings">
        <header className="iu-page-head">
          <h2 className="iu-page-title" data-chrome-heading>your settings</h2>
          <p className="iu-page-sub">switches apply right away. text changes when you press edit.</p>
        </header>
        <SettingGroup label="profile" defaultOpen>
          <SettingRow label="handle" control="text" value={VIEWER.handle} onCommit={write('handle')} />
          <SettingRow label="discoverable profile" help="on: your handle shows on your transcripts and in member lists. off: you show as anon." control="switch" value onCommit={write('discoverable')} />
        </SettingGroup>
        <SettingGroup label="pull requests" defaultOpen>
          <SettingRow
            label="link my transcripts to my pull requests automatically"
            help="off: comment /peasant attach on a pull request. on: when you open a pull request in a repo that one of your collectives links, your transcripts that trace its commits are linked. who can read them does not change."
            control="switch"
            value={false}
            onCommit={write('autoLink')}
          />
        </SettingGroup>
        <SettingGroup label="connections" defaultOpen count={2} noun={['connection', 'connections']}>
          <div className="srow">
            <span className="srow-text-col"><span className="srow-label">github · {VIEWER.login}</span><span className="srow-help">you sign in to village with this account.</span></span>
            <button type="button" className="btn btn-secondary btn-sm">sign out</button>
          </div>
          <div className="srow">
            <span className="srow-text-col"><span className="srow-label">peasant on 1 computer</span><span className="srow-help">it can publish as you. last used 12m ago.</span></span>
            <button type="button" className="btn btn-secondary btn-sm">sign out everywhere</button>
          </div>
        </SettingGroup>
        <SettingGroup label="danger zone" defaultOpen count={null}>
          <div className="srow">
            <span className="srow-help">delete your village account. this cannot be undone.</span>
            <button type="button" className="btn btn-danger btn-sm">delete account</button>
          </div>
        </SettingGroup>
      </div>
    </>
  )
}

/* ── the transcript page ─────────────────────────────────────────────────── */

const TRANSCRIPT_URL = 'https://village.peasantlabs.org/transcripts/3f9c0a17'
const TRANSCRIPT_CAPS = { canEdit: false, canLabel: false, canContribute: false, canChangeVisibility: false, canExport: false }

function PullRequestList({ onOpen }) {
  const [all, setAll] = useState(false)
  const shown = all ? TRANSCRIPT_PULL_REQUESTS : TRANSCRIPT_PULL_REQUESTS.slice(0, 3)
  return (
    <section className="cmg-transcript-prs" aria-label="pull requests">
      <p className="cmg-section-title">pull requests <span className="tnum cmg-count">{TRANSCRIPT_PULL_REQUESTS.length}</span></p>
      <ul className="cmg-pr-list">
        {shown.map((pr) => (
          <li key={pr.id}>
            <a className="cmg-pr-link mono" href={demoHref('pull-request')} onClick={(event) => { event.preventDefault(); onOpen?.() }}>{pr.repo} <span className="tnum">#{pr.number}</span></a>
            <span className="cmg-none">{pr.state}{pr.traced ? ` · ${pr.traced}` : ''}</span>
          </li>
        ))}
      </ul>
      {!all && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll(true)}>show all {TRANSCRIPT_PULL_REQUESTS.length}</button>}
    </section>
  )
}

/** The village transcript page: the link, a copy button and more; the pull requests it traces. */
export function VillageTranscriptView({ viewModel, theme, onNavigate }) {
  const actions = (
    <span className="cmg-transcript-actions">
      <a className="cmg-transcript-link mono" href={TRANSCRIPT_URL}>{TRANSCRIPT_URL.replace(/^https:\/\//, '')}</a>
      <CopyIconButton value={TRANSCRIPT_URL} label="copy link" />
      <Menu icon={MoreHorizontal} ariaLabel="more" size="sm" align="end" items={[
        { label: 'manage access: Acme Platform, Acme Company', icon: Eye },
        { label: 'edit title', icon: Pencil },
        { label: 'download markdown', icon: Download },
      ]} />
    </span>
  )
  return (
    <TranscriptViewer
      viewModel={viewModel}
      theme={theme}
      capabilities={TRANSCRIPT_CAPS}
      showTail={false}
      showOutcome={false}
      headerActions={actions}
      breadcrumb={[{ label: 'home', href: demoHref('home') }, { label: viewModel.session.title }]}
      pullRequests={<PullRequestList onOpen={() => onNavigate?.('pull-request')} />}
    />
  )
}

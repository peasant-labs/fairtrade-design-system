import { useId, useMemo, useState } from 'react'
import { FolderGit2, MoreHorizontal, Plus, Search, Settings, Download, Pencil, Eye, Upload, ClipboardCheck } from 'lucide-react'
import {
  Avatar,
  Breadcrumb,
  CopyIconButton,
  DataTable,
  Input,
  Menu,
  OverflowList,
  PolicySelect,
  ProviderIcon,
  RepoPicker,
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

/* The village pages of the in-use commons demo: sign-in, your home, the collectives list, a
   collective, its settings, your settings, and the transcript page. The list, the collective and
   its settings are also the shipped CollectivesView, CollectiveDetailView and
   CollectiveSettingsView (src/ui/commons/Manage.jsx re-exports them), so every value a host
   supplies arrives through `data` and every write goes out through `actions`; the defaults are demo
   data. Nothing here fetches. Recorded names keep their case; chrome is lowercase. */

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
        <h2 className="iu-page-title">the agent sessions behind your team&apos;s pull requests</h2>
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
        <h2 className="iu-page-title">your transcripts</h2>
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

/* ── collectives list (shipped as CollectivesView) ────────────────────────── */

const JOINING_LABEL = { open: 'open', verified_only: 'verified only', curated: 'curated' }

/**
 * The collectives list: your collectives in a table, the create form, and a search for others.
 * `data`: collectives, linkedOrgs, title, deck, createLabel, createBusy; `actions`:
 * onCreateCollective({ name, purpose, mode, access, org }), onOpenCollective(id),
 * onSearchCollectives(query).
 */
export function CollectivesView({ data = {}, actions = {} } = {}) {
  const {
    collectives = MY_COLLECTIVES.map((c) => ({ ...c, mode: c.joining === 'verified only' ? 'verified_only' : c.joining })),
    linkedOrgs = ['acme'],
    title = 'collectives',
    deck = 'a collective is a group that can read the transcripts its members publish to it. link your repositories so pull requests find them.',
    createLabel = 'new collective',
    createBusy = false,
  } = data
  const { onCreateCollective, onOpenCollective, onSearchCollectives } = actions
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [mode, setMode] = useState('open')
  const [access, setAccess] = useState('members_only')
  const [org, setOrg] = useState('')
  const [query, setQuery] = useState('')
  const hintId = useId()

  const columns = [
    { key: 'name', label: 'name', render: (_, c) => <button type="button" className="cmg-table-link" onClick={() => onOpenCollective?.(c.id)}>{c.name}</button> },
    { key: 'role', label: 'your role' },
    { key: 'members', label: 'members', align: 'right' },
    { key: 'transcripts', label: 'transcripts', align: 'right', render: (value) => (typeof value === 'number' ? value.toLocaleString('en-US') : value) },
    { key: 'org', label: 'github org', render: (_, c) => (c.org ? <span className="mono">{c.org}{c.repos ? ` · ${c.repos} open` : ''}</span> : <span className="cmg-none">nothing linked</span>) },
    { key: 'mode', label: 'joining', render: (value) => JOINING_LABEL[value] ?? value },
  ]

  return (
    <>
      <div className="iu-page">
        <header className="iu-page-head">
          <div className="iu-page-titlerow">
            <h2 className="iu-page-title">{title}</h2>
            <button type="button" className={'btn btn-sm ' + (showForm ? 'btn-secondary' : 'btn-primary')} aria-expanded={showForm} onClick={() => setShowForm((open) => !open)}>
              <Plus size={14} aria-hidden="true" /> {showForm ? 'close' : createLabel}
            </button>
          </div>
          <p className="iu-page-sub">{deck}</p>
        </header>

        {showForm && (
          <section className="cmg-form card" aria-labelledby={`${hintId}-form`}>
            <h3 id={`${hintId}-form`} className="cmg-sub">create a collective</h3>
            <div className="cmg-form-grid">
              <label className="cmg-field"><span className="label">name</span><input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="cmg-field cmg-field-wide"><span className="label">purpose</span><textarea className="input" rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
              <div className="cmg-field"><PolicySelect variant="select" label="who can publish" name="who-can-publish" value={mode} onChange={setMode} options={WHO_CAN_PUBLISH.map((o) => ({ ...o, rationale: o.help }))} /></div>
              <div className="cmg-field"><PolicySelect variant="select" label="who can read" name="who-can-read" value={access} onChange={setAccess} options={WHO_CAN_READ} /></div>
              <label className="cmg-field">
                <span className="label">github org (optional)</span>
                <span className="select-wrap">
                  <select className="select" value={org} onChange={(e) => setOrg(e.target.value)}>
                    <option value="">not linked</option>
                    {linkedOrgs.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </span>
              </label>
            </div>
            <div className="cmg-form-foot">
              <button type="button" className="btn btn-sm btn-primary" disabled={!name.trim() || createBusy} aria-describedby={hintId} onClick={() => onCreateCollective?.({ name, purpose, mode, access, org })}>{createBusy ? 'creating' : 'create collective'}</button>
              <span id={hintId} className="cmg-form-hint mono">{WHO_CAN_PUBLISH.find((o) => o.value === mode)?.help}</span>
            </div>
          </section>
        )}

        <div className="cmg-section">
          <DataTable caption={`your collectives ${collectives.length}`} columns={columns} rows={collectives} rowKey={(c) => c.id} />
          <p className="cmg-note">in a curated collective, each transcript you publish waits for the owner to approve it.</p>
        </div>

        <section className="cmg-section" aria-labelledby={`${hintId}-find`}>
          <h3 className="cmg-section-title" id={`${hintId}-find`}>find a collective</h3>
          <p className="cmg-note">search by collective name or github org.</p>
          <form className="cmg-find" role="search" onSubmit={(event) => { event.preventDefault(); onSearchCollectives?.(query) }}>
            <Input label="collective or github org" type="search" iconLeft={Search} placeholder="ML Reading Group or acme" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="submit" className="btn btn-secondary">search</button>
          </form>
        </section>
      </div>
    </>
  )
}

/* ── a collective (shipped as CollectiveDetailView) ──────────────────────── */

function MembersSummary({ members, count }) {
  const shown = members.slice(0, 2).map((m) => m.handle)
  const others = count - shown.length
  return <span className="cmg-members-text">{shown.join(', ')}{others > 0 ? ` and ${others} others` : ''}</span>
}

/**
 * A collective: its purpose, three boxes that say who can read, who can publish and your role, one
 * stats line, its transcripts with their pull requests, and a rail with the github org and the
 * members. `data`: collective (the COLLECTIVE shape); `actions`: onSettings, onContribute,
 * onReview, onOpenTranscript(id), onOpenPullRequest(number), onLinkRepos({ add, remove }).
 */
export function CollectiveDetailView({ data = {}, actions = {} } = {}) {
  const { collective = COLLECTIVE, owners = REPO_OWNERS, linkedRepos = LINKED_REPOS } = data
  const { onSettings, onContribute, onReview, onOpenTranscript, onOpenPullRequest, onLinkRepos } = actions
  const [picking, setPicking] = useState(false)
  const [linked, setLinked] = useState(collective.org?.linked ?? 0)
  const titleId = useId()
  const columns = [
    {
      key: 'title',
      label: 'title',
      width: '18rem',
      render: (_, row) => (
        <span className="iu-session">
          <ProviderIcon harness={row.harness} accent />
          <span className="iu-session-text">
            <a className="iu-session-title" href={demoHref('transcript-detail')} onClick={(event) => { if (onOpenTranscript) { event.preventDefault(); onOpenTranscript(row.id) } }}>{row.title}</a>
            <span className="iu-session-sub">{harnessName(row.harness)} · <span className="tnum">{row.turns}</span> turns</span>
          </span>
        </span>
      ),
    },
    { key: 'author', label: 'author', render: (value) => <span className="mono">{value}</span> },
    {
      key: 'pullRequests',
      label: 'pull requests',
      render: (_, row) => (row.pullRequests.length
        ? <span className="cmg-prs"><OverflowList items={prLinks(row.pullRequests, onOpenPullRequest)} label="pull requests" noun={['pull request', 'pull requests']} />{row.repo && <span className="cmg-none mono">{row.repo}</span>}</span>
        : <span className="cmg-none">not linked</span>),
    },
    { key: 'when', label: 'when' },
  ]
  const policies = [
    { key: 'read', title: 'who can read', text: collective.whoCanRead },
    { key: 'publish', title: 'who can publish', text: collective.whoCanPublish },
    { key: 'role', title: 'your role', text: collective.yourRole },
  ]
  return (
    <>
      <div className="iu-page">
        <div className="cmg-crumb-content"><Breadcrumb items={[{ label: 'collectives', href: demoHref('collectives') }, { label: collective.name }]} /></div>
        <header className="iu-page-head">
          <div className="iu-page-titlerow">
            <h2 className="iu-page-title iu-page-title-content" id={titleId}>{collective.name}</h2>
            <span className="cmg-actions">
              {collective.role === 'owner' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSettings?.()}><Settings size={14} aria-hidden="true" /> settings</button>}
              <Menu icon={MoreHorizontal} ariaLabel="more" size="sm" align="end" items={[
                { label: 'publish several transcripts', icon: Upload, onSelect: () => onContribute?.() },
                { label: 'review transcripts', icon: ClipboardCheck, onSelect: () => onReview?.() },
              ]} />
            </span>
          </div>
          <p className="iu-page-sub">{collective.purpose}</p>
        </header>

        <ul className="cmg-policies" aria-label="how this collective works">
          {policies.map((policy) => (
            <li key={policy.key} className="cmg-policy">
              <h3 className="cmg-policy-title">{policy.title}</h3>
              <p className="cmg-policy-text">{policy.text}</p>
            </li>
          ))}
        </ul>
        <StatsStrip items={collective.stats} label={`${collective.name} in numbers`} />

        <div className="cmg-home">
          <div className="cmg-home-main">
            <DataTable caption={`transcripts ${collective.stats[0].value}`} columns={columns} rows={collective.transcripts} rowKey={(row) => row.id} />
            <div className="iu-page-foot">
              <span className="iu-page-count">showing <span className="tnum">{collective.transcripts.length}</span> of <span className="tnum">{collective.stats[0].value}</span></span>
              <button type="button" className="btn btn-secondary btn-sm">show more</button>
            </div>
          </div>
          <aside className="cmg-rail" aria-label="github orgs and members">
            <section className="cmg-rail-box">
              <h3 className="cmg-rail-title">github orgs</h3>
              {collective.org ? (
                <p className="cmg-rail-line">
                  <FolderGit2 aria-hidden="true" /> <span className="mono">{collective.org.login}</span> · <span className="tnum">{linked}</span> of <span className="tnum">{collective.org.total}</span> repos linked
                  {collective.role === 'owner' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>manage</button>}
                </p>
              ) : <p className="cmg-rail-line cmg-none">nothing linked</p>}
              <p className="cmg-note">a collective links one github org today.</p>
            </section>
            <section className="cmg-rail-box">
              <h3 className="cmg-rail-title">members <span className="tnum cmg-count">{collective.memberCount}</span></h3>
              <p className="cmg-note">{collective.memberBreakdown}</p>
              <MembersSummary members={collective.members} count={collective.memberCount} />
            </section>
          </aside>
        </div>
      </div>
      <RepoPicker
        open={picking}
        onClose={() => setPicking(false)}
        owners={owners}
        initialSelected={linkedRepos}
        title={`link repositories from ${collective.org?.login ?? 'github'}`}
        description={`pull requests in linked repos show the transcripts published to ${collective.name}.`}
        onSave={(diff) => {
          onLinkRepos?.(diff)
          setLinked((n) => n + diff.add.length - diff.remove.length)
          setPicking(false)
        }}
      />
    </>
  )
}

/* ── a collective's settings (shipped as CollectiveSettingsView) ─────────── */

/**
 * A collective's settings, saved per field. `data`: collective; `actions`: onCommit(key, value)
 * (the one write per change; reject to fail), onInvite(handle), onRemoveMember(handle),
 * onRoleChange(handle, role), onLinkRepos({ add, remove }), onTransferOwnership, onDelete.
 */
export function CollectiveSettingsView({ data = {}, actions = {} } = {}) {
  const { collective = COLLECTIVE, owners = REPO_OWNERS, linkedRepos = LINKED_REPOS, showOnPullRequests = true } = data
  const write = (key) => (value) => (actions.onCommit ? actions.onCommit(key, value) : demoWrite())
  const [picking, setPicking] = useState(false)
  const [invite, setInvite] = useState('')
  const sections = ['general', 'access', 'members', 'github orgs', 'pull requests', 'danger zone']
  const anchor = (name) => `cmg-settings-${name.replace(/ /g, '-')}`
  return (
    <>
      <div className="iu-page cmg-settings">
        <div className="cmg-crumb-content"><Breadcrumb items={[{ label: 'collectives', href: demoHref('collectives') }, { label: collective.name, href: demoHref('collective-detail') }, { label: 'settings' }]} /></div>
        <header className="iu-page-head">
          <h2 className="iu-page-title"><span className="iu-page-title-content">{collective.name}</span> · settings</h2>
          <p className="iu-page-sub">changes save right away.</p>
        </header>
        <nav className="cmg-settings-nav" aria-label="settings sections">
          {sections.map((name) => <a key={name} href={`#${anchor(name)}`}>{name}</a>)}
        </nav>

        <SettingGroup label="general" defaultOpen id={anchor('general')}>
          <SettingRow label="name" control="text" value={collective.name} onCommit={write('name')} />
          <SettingRow label="purpose" control="text" value={collective.purpose} onCommit={write('purpose')} />
        </SettingGroup>

        <SettingGroup label="access" defaultOpen id={anchor('access')}>
          <SettingRow label="who can publish" help="open: anyone can join and publish. verified only: only members of the acme github org. curated: you approve each transcript." control="select" value="open" options={WHO_CAN_PUBLISH} onCommit={write('whoCanPublish')} />
          <SettingRow label="who can read" help="members read and publish. contributors publish, and read only if who can read allows it." control="select" value="members_only" options={WHO_CAN_READ} onCommit={write('whoCanRead')} />
        </SettingGroup>

        <SettingGroup label="members" defaultOpen count={collective.memberCount} noun={['member', 'members']} id={anchor('members')}>
          <form className="srow cmg-invite" onSubmit={(event) => { event.preventDefault(); actions.onInvite?.(invite); setInvite('') }}>
            <Input label="invite by github username" value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="bob-ai" />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={!invite.trim()}>invite</button>
          </form>
          <ul className="cmg-member-list" aria-label="members">
            {collective.members.map((member) => (
              <li key={member.handle} className="cmg-member">
                <Avatar name={member.name} size="sm" />
                <span className="cmg-member-id"><span className="mono">{member.handle}</span> <span className="cmg-member-name">{member.name}</span></span>
                {member.role === 'owner' ? <span className="cmg-none mono">owner · you</span> : (
                  <>
                    <span className="select-wrap cmg-member-role">
                      <select className="select" aria-label={`role for ${member.handle}`} defaultValue={member.role} onChange={(event) => actions.onRoleChange?.(member.handle, event.target.value)}>
                        <option value="member">member</option>
                        <option value="contributor">contributor</option>
                      </select>
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm" aria-label={`remove ${member.handle}`} onClick={() => actions.onRemoveMember?.(member.handle)}>remove</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <SettingRow label="when a member leaves" help="what happens to the transcripts they published here." control="select" value="they-choose" options={[{ value: 'they-choose', label: 'they choose' }, { value: 'keep', label: 'keep them here' }, { value: 'remove', label: 'take them out' }]} onCommit={write('memberLeaves')} />
        </SettingGroup>

        <SettingGroup label="github orgs" defaultOpen count={1} noun={['org', 'orgs']} id={anchor('github orgs')}>
          <div className="srow">
            <span className="srow-text-col">
              <span className="srow-label">{collective.org?.login ?? 'no org linked'}</span>
              <span className="srow-help"><span className="tnum">{collective.org?.linked ?? 0}</span> of <span className="tnum">{collective.org?.total ?? 0}</span> repos linked. a collective links one github org today.</span>
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPicking(true)}>manage</button>
          </div>
        </SettingGroup>

        <SettingGroup label="pull requests" defaultOpen count={1} id={anchor('pull requests')}>
          <SettingRow
            label="show transcripts on pull requests"
            help="adds a peasant / prompts comment and check on pull requests in this collective's repos, listing which commits have transcripts. it never blocks merging."
            control="switch"
            value={showOnPullRequests}
            onCommit={write('showOnPullRequests')}
          />
          <p className="srow-note">automatic linking is now a personal setting, in <a className="link" href={demoHref('account')}>your settings</a>.</p>
        </SettingGroup>

        <SettingGroup label="danger zone" defaultOpen count={null} id={anchor('danger zone')}>
          <div className="srow">
            <span className="srow-help">give the owner role to another member. you stay on as a member.</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => actions.onTransferOwnership?.()}>transfer ownership</button>
          </div>
          <div className="srow">
            <span className="srow-help">delete {collective.name} for all {collective.memberCount} members. this cannot be undone.</span>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => actions.onDelete?.()}>delete collective</button>
          </div>
        </SettingGroup>
      </div>
      <RepoPicker open={picking} onClose={() => setPicking(false)} owners={owners} initialSelected={linkedRepos} title={`link repositories from ${collective.org?.login ?? 'github'}`} onSave={(diff) => { actions.onLinkRepos?.(diff); setPicking(false) }} />
    </>
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
          <h2 className="iu-page-title">your settings</h2>
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

import { useId, useState } from 'react'
import { FolderGit2, MoreHorizontal, Plus, Search, Settings, Upload, ClipboardCheck } from 'lucide-react'
import {
  Avatar,
  Breadcrumb,
  DataTable,
  Input,
  Menu,
  OverflowList,
  PolicySelect,
  ProviderIcon,
  RepoPicker,
  SettingGroup,
  SettingRow,
  StatsStrip,
} from '../index.js'

/* The village collectives views: the collectives list, a collective, and its settings. Every
   value arrives through `data` and every write goes out through `actions`; nothing here fetches
   and nothing is demo data. A value the host does not give is left out, not stated. Links render
   as links only when the host's `hrefFor` names a destination; with only a callback they render
   as buttons. Recorded names keep their case; chrome is lowercase. */

/**
 * @typedef {object} PolicyChoice
 * @property {string} value
 * @property {string} label - lowercase chrome.
 * @property {string} [help] - one line on what the choice means.
 */

/**
 * @typedef {object} CollectiveRow
 * @property {string} id
 * @property {string} name - kept in its case.
 * @property {string|null} [role] - the viewer's role; empty when they only see the collective.
 * @property {number} [members]
 * @property {number|string} [transcripts]
 * @property {string|null} [org] - the linked github org; null says nothing is linked. Leave it
 *           undefined on every row and the github org column is left out.
 * @property {string|null} [repos] - beside the org ("2 of 14 repos").
 * @property {string} [mode] - how members join: `open`, `verified_only` or `curated`.
 * @property {string|null} [desc] - a line under the name.
 * @property {string|null} [since] - a line under the role ("member for 5mo").
 */

/**
 * @typedef {(kind: 'collectives'|'collective'|'transcript'|'pull-request'|'account', id?: string) => (string|undefined)} HrefFor
 */

/**
 * The fields a settings change writes, passed to `onCommit` with the new value.
 * @typedef {'name'|'purpose'|'mode'|'access'|'memberLeaves'|'showOnPullRequests'} CollectiveSettingKey
 */

const DEFAULT_WHO_CAN_PUBLISH = Object.freeze([
  { value: 'open', label: 'open', help: 'anyone can join and publish. transcripts are approved automatically.' },
  { value: 'verified_only', label: 'verified only', help: 'only members of the linked github org can join and publish.' },
  { value: 'curated', label: 'curated', help: 'the owner approves each transcript before it appears.' },
])
const DEFAULT_WHO_CAN_READ = Object.freeze([
  { value: 'members_only', label: 'members only' },
  { value: 'contributors', label: 'members and contributors' },
])
const JOINING_LABEL = { open: 'open', verified_only: 'verified only', curated: 'curated' }

const harnessName = (harness) => String(harness).replace(/-/g, ' ')

/* a destination the host names renders as a link; a callback alone renders as a button. */
function Target({ href, onOpen, className, children }) {
  if (href) {
    // a plain click goes through the host's callback; a modified click (a new tab) stays a link
    const onClick = (event) => {
      if (!onOpen || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      onOpen()
    }
    return <a className={className} href={href} onClick={onClick}>{children}</a>
  }
  if (onOpen) return <button type="button" className={`${className} cmg-link-button`} onClick={onOpen}>{children}</button>
  return <span className={className}>{children}</span>
}

function prTargets(numbers, onOpen, hrefFor) {
  return numbers.map((number) => (
    <Target key={number} className="cmg-pr-link tnum" href={hrefFor?.('pull-request', number)} onOpen={onOpen ? () => onOpen(number) : undefined}>{number}</Target>
  ))
}

/* ── collectives list ─────────────────────────────────────────────────────── */

/**
 * The collectives list: the collectives in a table, the create form, and (with
 * `onSearchCollectives`) a search for others.
 *
 * @param {object} [props]
 * @param {object} [props.data]
 * @param {CollectiveRow[]} [props.data.collectives]
 * @param {string[]} [props.data.linkedOrgs] - github orgs a new collective can link.
 * @param {string} [props.data.title='collectives']
 * @param {string} [props.data.deck]
 * @param {string} [props.data.crumb] - a breadcrumb above the title.
 * @param {string} [props.data.caption='collectives'] - the table caption, before the count.
 * @param {string} [props.data.createLabel='new collective']
 * @param {boolean} [props.data.createBusy]
 * @param {PolicyChoice[]} [props.data.whoCanPublish] - the create form's join choices.
 * @param {PolicyChoice[]} [props.data.whoCanRead] - the create form's read choices.
 * @param {object} [props.actions]
 * @param {(collective: { name: string, purpose: string, mode: string, access: string, org: string }) => void} [props.actions.onCreateCollective]
 * @param {(id: string) => void} [props.actions.onOpenCollective]
 * @param {(query: string) => void} [props.actions.onSearchCollectives]
 */
export function CollectivesView({ data = {}, actions = {} } = {}) {
  const {
    collectives = [],
    linkedOrgs = [],
    title = 'collectives',
    deck = 'a collective is a group that can read the transcripts its members publish to it. link your repositories so pull requests find them.',
    crumb,
    caption = 'collectives',
    createLabel = 'new collective',
    createBusy = false,
    whoCanPublish = DEFAULT_WHO_CAN_PUBLISH,
    whoCanRead = DEFAULT_WHO_CAN_READ,
  } = data
  const { onCreateCollective, onOpenCollective, onSearchCollectives } = actions
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [mode, setMode] = useState(whoCanPublish[0]?.value ?? '')
  const [access, setAccess] = useState(whoCanRead[0]?.value ?? '')
  const [org, setOrg] = useState('')
  const [query, setQuery] = useState('')
  const hintId = useId()
  const showOrg = collectives.some((row) => row.org !== undefined)

  const columns = [
    {
      key: 'name',
      label: 'name',
      render: (_, c) => (
        <span className="cmg-cell-stack">
          <button type="button" className="cmg-table-link" onClick={() => onOpenCollective?.(c.id)}>{c.name}</button>
          {c.desc ? <span className="cmg-cell-desc">{c.desc}</span> : null}
        </span>
      ),
    },
    {
      key: 'role',
      label: 'your role',
      render: (value, c) => (
        <span className="cmg-cell-stack">
          <span>{value}</span>
          {c.since ? <span className="cmg-cell-sub">{c.since}</span> : null}
        </span>
      ),
    },
    { key: 'members', label: 'members', align: 'right' },
    { key: 'transcripts', label: 'transcripts', align: 'right', render: (value) => (typeof value === 'number' ? value.toLocaleString('en-US') : value) },
    ...(showOrg ? [{ key: 'org', label: 'github org', render: (_, c) => (c.org ? <span className="mono">{c.org}{c.repos ? ` · ${c.repos} open` : ''}</span> : <span className="cmg-none">nothing linked</span>) }] : []),
    { key: 'mode', label: 'joining', render: (value) => JOINING_LABEL[value] ?? value },
  ]

  return (
    <div className="iu-page">
      {crumb ? <div className="cmg-crumb"><Breadcrumb items={[{ label: crumb, chrome: true }]} /></div> : null}
      <header className="iu-page-head">
        <div className="iu-page-titlerow">
          <h2 className="iu-page-title" data-chrome-heading>{title}</h2>
          <button type="button" className={'btn btn-sm ' + (showForm ? 'btn-secondary' : 'btn-primary')} aria-expanded={showForm} onClick={() => setShowForm((open) => !open)}>
            <Plus size={14} aria-hidden="true" /> {showForm ? 'close' : createLabel}
          </button>
        </div>
        {deck ? <p className="iu-page-sub">{deck}</p> : null}
      </header>

      {showForm && (
        <section className="cmg-form card" aria-labelledby={`${hintId}-form`}>
          <h3 id={`${hintId}-form`} className="cmg-sub">create a collective</h3>
          <div className="cmg-form-grid">
            <label className="cmg-field"><span className="label">name</span><input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="cmg-field cmg-field-wide"><span className="label">purpose</span><textarea className="input" rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
            <div className="cmg-field"><PolicySelect variant="select" label="who can publish" name="who-can-publish" value={mode} onChange={setMode} options={whoCanPublish.map((o) => ({ ...o, rationale: o.help }))} /></div>
            <div className="cmg-field"><PolicySelect variant="select" label="who can read" name="who-can-read" value={access} onChange={setAccess} options={whoCanRead} /></div>
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
            <span id={hintId} className="cmg-form-hint mono">{whoCanPublish.find((o) => o.value === mode)?.help}</span>
          </div>
        </section>
      )}

      <div className="cmg-section">
        <DataTable caption={`${caption} ${collectives.length}`} columns={columns} rows={collectives} rowKey={(c) => c.id} />
        {collectives.some((row) => row.mode === 'curated') ? <p className="cmg-note">in a curated collective, each transcript you publish waits for the owner to approve it.</p> : null}
      </div>

      {onSearchCollectives && (
        <section className="cmg-section" aria-labelledby={`${hintId}-find`}>
          <h3 className="cmg-section-title" id={`${hintId}-find`}>find a collective</h3>
          <p className="cmg-note">search by collective name or github org.</p>
          <form className="cmg-find" role="search" onSubmit={(event) => { event.preventDefault(); onSearchCollectives(query) }}>
            <Input label="collective or github org" type="search" iconLeft={Search} placeholder="collective name or github org" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="submit" className="btn btn-secondary">search</button>
          </form>
        </section>
      )}
    </div>
  )
}

/* ── a collective ─────────────────────────────────────────────────────────── */

function MembersSummary({ members, count }) {
  const shown = members.slice(0, 2).map((m) => m.handle)
  const others = count - shown.length
  if (shown.length === 0) return null
  return <span className="cmg-members-text">{shown.join(', ')}{others > 0 ? ` and ${others} others` : ''}</span>
}

/* a collective in the shape the views read, with every nested list defaulted. The earlier shape
   `{ name, description, linkedGithubOrg }` still renders. A count or an org the host does not give
   stays undefined and is left out; `org: null` says nothing is linked. */
function collectiveOf(collective = {}) {
  const earlierOrg = typeof collective.linkedGithubOrg === 'string' && collective.linkedGithubOrg ? { login: collective.linkedGithubOrg.replace(/^@/, '') } : undefined
  return {
    ...collective,
    name: collective.name ?? '',
    purpose: collective.purpose ?? collective.description ?? undefined,
    stats: collective.stats ?? [],
    transcripts: collective.transcripts ?? [],
    members: collective.members ?? [],
    memberCount: collective.memberCount ?? collective.members?.length,
    org: collective.org !== undefined ? collective.org : earlierOrg,
  }
}

/**
 * @typedef {object} CollectiveData
 * @property {string} [id]
 * @property {string} name - kept in its case.
 * @property {string|null} [purpose]
 * @property {string|null} [description] - the earlier name for `purpose`.
 * @property {string|null} [linkedGithubOrg] - the earlier name for `org.login`.
 * @property {string} [role] - the viewer's role; `owner` shows the settings button.
 * @property {string} [whoCanRead] - the policy in words, for the collective page.
 * @property {string} [whoCanPublish] - the policy in words, for the collective page.
 * @property {string} [yourRole] - the viewer's role in words.
 * @property {string} [mode] - the join policy value, for settings (`open`, `verified_only`, `curated`).
 * @property {string} [access] - the read policy value, for settings (`members_only`, `contributors`).
 * @property {string} [memberLeaves] - what happens to a leaving member's transcripts, for settings.
 * @property {{ value: number|string, label: string }[]} [stats]
 * @property {number} [transcriptCount] - every transcript, when `transcripts` holds one page of them.
 * @property {{ login: string, linked?: number, total?: number } | null} [org] - null says nothing is linked; left out, the line is left out.
 * @property {string} [memberBreakdown]
 * @property {{ id: string, title: string, harness: string, turns?: number, author?: string, pullRequests?: string[], repo?: string|null, when?: string }[]} [transcripts]
 * @property {{ handle: string, name?: string, role: string }[]} [members]
 * @property {number} [memberCount]
 */

/**
 * A collective: its purpose, the boxes that say who can read, who can publish and your role, one
 * stats line, its transcripts with their pull requests, and a rail with the github org and the
 * members.
 *
 * @param {object} [props]
 * @param {object} [props.data]
 * @param {CollectiveData} [props.data.collective]
 * @param {object[]} [props.data.owners] - RepoPicker owners, for linking repositories.
 * @param {string[]} [props.data.linkedRepos]
 * @param {HrefFor} [props.data.hrefFor] - where a link goes; without it links render as buttons.
 * @param {object} [props.actions]
 * @param {() => void} [props.actions.onSettings]
 * @param {() => void} [props.actions.onContribute]
 * @param {() => void} [props.actions.onReview]
 * @param {(id: string) => void} [props.actions.onOpenTranscript]
 * @param {(number: string) => void} [props.actions.onOpenPullRequest]
 * @param {(diff: { add: string[], remove: string[] }) => void} [props.actions.onLinkRepos]
 * @param {() => void} [props.actions.onShowMore] - shows the next transcripts; omit it and no button renders.
 */
export function CollectiveDetailView({ data = {}, actions = {} } = {}) {
  const { owners = [], linkedRepos = [], hrefFor } = data
  const collective = collectiveOf(data.collective)
  const { onSettings, onContribute, onReview, onOpenTranscript, onOpenPullRequest, onLinkRepos, onShowMore } = actions
  const [picking, setPicking] = useState(false)
  const titleId = useId()
  const total = collective.transcriptCount ?? collective.transcripts.length
  const columns = [
    {
      key: 'title',
      label: 'title',
      width: '18rem',
      render: (_, row) => (
        <span className="iu-session">
          <ProviderIcon harness={row.harness} accent />
          <span className="iu-session-text">
            <Target className="iu-session-title" href={hrefFor?.('transcript', row.id)} onOpen={onOpenTranscript ? () => onOpenTranscript(row.id) : undefined}>{row.title}</Target>
            <span className="iu-session-sub">{harnessName(row.harness)}{typeof row.turns === 'number' ? <> · <span className="tnum">{row.turns}</span> turns</> : null}</span>
          </span>
        </span>
      ),
    },
    { key: 'author', label: 'author', render: (value) => <span className="mono">{value}</span> },
    {
      key: 'pullRequests',
      label: 'pull requests',
      render: (_, row) => (row.pullRequests?.length
        ? <span className="cmg-prs"><OverflowList items={prTargets(row.pullRequests, onOpenPullRequest, hrefFor)} label="pull requests" noun={['pull request', 'pull requests']} />{row.repo && <span className="cmg-none mono">{row.repo}</span>}</span>
        : <span className="cmg-none">not linked</span>),
    },
    { key: 'when', label: 'when' },
  ]
  const policies = [
    { key: 'read', title: 'who can read', text: collective.whoCanRead },
    { key: 'publish', title: 'who can publish', text: collective.whoCanPublish },
    { key: 'role', title: 'your role', text: collective.yourRole },
  ].filter((policy) => policy.text)
  return (
    <>
      <div className="iu-page">
        <div className="cmg-crumb"><Breadcrumb items={[{ label: 'collectives', href: hrefFor?.('collectives'), chrome: true }, { label: collective.name }]} /></div>
        <header className="iu-page-head">
          <div className="iu-page-titlerow">
            <h2 className="iu-page-title" id={titleId}>{collective.name}</h2>
            <span className="cmg-actions">
              {collective.role === 'owner' && onSettings && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSettings()}><Settings size={14} aria-hidden="true" /> settings</button>}
              {(onContribute || onReview) && (
                <Menu icon={MoreHorizontal} ariaLabel="more" size="sm" align="end" items={[
                  ...(onContribute ? [{ label: 'publish several transcripts', icon: Upload, onSelect: () => onContribute() }] : []),
                  ...(onReview ? [{ label: 'review transcripts', icon: ClipboardCheck, onSelect: () => onReview() }] : []),
                ]} />
              )}
            </span>
          </div>
          {collective.purpose ? <p className="iu-page-sub">{collective.purpose}</p> : null}
        </header>

        {policies.length > 0 && (
          <ul className="cmg-policies" aria-label="how this collective works">
            {policies.map((policy) => (
              <li key={policy.key} className="cmg-policy">
                <h3 className="cmg-policy-title">{policy.title}</h3>
                <p className="cmg-policy-text">{policy.text}</p>
              </li>
            ))}
          </ul>
        )}
        <StatsStrip items={collective.stats} label={`${collective.name} in numbers`} />

        <div className="cmg-home">
          <div className="cmg-home-main">
            <DataTable caption={`transcripts ${total}`} columns={columns} rows={collective.transcripts} rowKey={(row) => row.id} />
            {total > collective.transcripts.length && (
              <div className="iu-page-foot">
                <span className="iu-page-count">showing <span className="tnum">{collective.transcripts.length}</span> of <span className="tnum">{total}</span></span>
                {onShowMore && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onShowMore()}>show more</button>}
              </div>
            )}
          </div>
          <aside className="cmg-rail" aria-label="github orgs and members">
            <section className="cmg-rail-box">
              <h3 className="cmg-rail-title">github orgs</h3>
              {collective.org ? (
                <p className="cmg-rail-line">
                  <FolderGit2 aria-hidden="true" /> <span className="mono">{collective.org.login}</span>
                  {typeof collective.org.total === 'number' ? <> · <span className="tnum">{collective.org.linked ?? 0}</span> of <span className="tnum">{collective.org.total}</span> repos linked</> : null}
                  {collective.role === 'owner' && onLinkRepos && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>manage</button>}
                </p>
              ) : collective.org === null ? <p className="cmg-rail-line cmg-none">nothing linked</p> : null}
              <p className="cmg-note">a collective links one github org today.</p>
            </section>
            <section className="cmg-rail-box">
              <h3 className="cmg-rail-title">members{typeof collective.memberCount === 'number' ? <> <span className="tnum cmg-count">{collective.memberCount}</span></> : null}</h3>
              {collective.memberBreakdown ? <p className="cmg-note">{collective.memberBreakdown}</p> : null}
              <MembersSummary members={collective.members} count={collective.memberCount ?? collective.members.length} />
            </section>
          </aside>
        </div>
      </div>
      {onLinkRepos && (
        <RepoPicker
          open={picking}
          onClose={() => setPicking(false)}
          owners={owners}
          initialSelected={linkedRepos}
          title={`link repositories from ${collective.org?.login ?? 'github'}`}
          description={`pull requests in linked repos show the transcripts published to ${collective.name}.`}
          onSave={(diff) => {
            // the host owns the linked count; it arrives back through data.collective.org
            onLinkRepos(diff)
            setPicking(false)
          }}
        />
      )}
    </>
  )
}

/* ── a collective's settings ──────────────────────────────────────────────── */

/* what happens to a leaving member's transcripts, on the wire's TranscriptDeletionPolicy values */
const DEFAULT_MEMBER_LEAVES = Object.freeze([
  { value: 'user_choice', label: 'they choose' },
  { value: 'mandatory', label: 'take them out' },
])

/* a select shows the host's value; a value it does not give (or one outside the choices) shows as
   not set, never as the first choice */
function choicesFor(value, choices) {
  return choices.some((choice) => choice.value === value) ? choices : [{ value: '', label: 'not set', disabled: true }, ...choices]
}
const shownValue = (value, choices) => (choices.some((choice) => choice.value === value) ? value : '')

/**
 * A collective's settings, saved per field. The selects show the collective's own `mode`,
 * `access` and `memberLeaves` values, or `not set` when the host does not give one. Each change
 * calls `onCommit` with the field it writes (`mode`, `access`, `memberLeaves`, ...) and the value.
 *
 * @param {object} [props]
 * @param {object} [props.data]
 * @param {CollectiveData} [props.data.collective]
 * @param {object[]} [props.data.owners] - RepoPicker owners, for linking repositories.
 * @param {string[]} [props.data.linkedRepos]
 * @param {boolean} [props.data.showOnPullRequests]
 * @param {PolicyChoice[]} [props.data.whoCanPublish]
 * @param {PolicyChoice[]} [props.data.whoCanRead]
 * @param {PolicyChoice[]} [props.data.memberLeavesChoices] - defaults to the wire's `user_choice` and `mandatory`.
 * @param {HrefFor} [props.data.hrefFor]
 * @param {object} [props.actions]
 * @param {(key: CollectiveSettingKey, value: unknown) => Promise<unknown>} [props.actions.onCommit] - the one write per change; reject to fail.
 * @param {(handle: string) => void} [props.actions.onInvite]
 * @param {(handle: string) => void} [props.actions.onRemoveMember]
 * @param {(handle: string, role: string) => void} [props.actions.onRoleChange]
 * @param {(diff: { add: string[], remove: string[] }) => void} [props.actions.onLinkRepos]
 * @param {() => void} [props.actions.onTransferOwnership]
 * @param {() => void} [props.actions.onDelete]
 */
export function CollectiveSettingsView({ data = {}, actions = {} } = {}) {
  const { owners = [], linkedRepos = [], showOnPullRequests = false, whoCanPublish = DEFAULT_WHO_CAN_PUBLISH, whoCanRead = DEFAULT_WHO_CAN_READ, memberLeavesChoices = DEFAULT_MEMBER_LEAVES, hrefFor } = data
  const collective = collectiveOf(data.collective)
  const write = (key) => (value) => (actions.onCommit ? actions.onCommit(key, value) : Promise.resolve())
  const [picking, setPicking] = useState(false)
  const [invite, setInvite] = useState('')
  const danger = Boolean(actions.onTransferOwnership || actions.onDelete)
  const sections = ['general', 'access', 'members', 'github orgs', 'pull requests', ...(danger ? ['danger zone'] : [])]
  const anchor = (name) => `cmg-settings-${name.replace(/ /g, '-')}`
  const helpOf = (choices) => choices.filter((choice) => choice.help).map((choice) => `${choice.label}: ${choice.help}`).join(' ')
  const accountHref = hrefFor?.('account')
  return (
    <>
      <div className="iu-page cmg-settings">
        <div className="cmg-crumb"><Breadcrumb items={[{ label: 'collectives', href: hrefFor?.('collectives'), chrome: true }, { label: collective.name, href: hrefFor?.('collective', collective.id) }, { label: 'settings', chrome: true }]} /></div>
        <header className="iu-page-head">
          <h2 className="iu-page-title">{collective.name} · settings</h2>
          <p className="iu-page-sub">changes save right away.</p>
        </header>
        <nav className="cmg-settings-nav" aria-label="settings sections">
          {sections.map((name) => <a key={name} href={`#${anchor(name)}`}>{name}</a>)}
        </nav>

        <SettingGroup label="general" defaultOpen id={anchor('general')}>
          <SettingRow label="name" control="text" value={collective.name} onCommit={write('name')} />
          <SettingRow label="purpose" control="text" value={collective.purpose ?? ''} onCommit={write('purpose')} />
        </SettingGroup>

        <SettingGroup label="access" defaultOpen id={anchor('access')}>
          <SettingRow label="who can publish" help={helpOf(whoCanPublish)} control="select" value={shownValue(collective.mode, whoCanPublish)} options={choicesFor(collective.mode, whoCanPublish)} onCommit={write('mode')} />
          <SettingRow label="who can read" help="members read and publish. contributors publish, and read only if who can read allows it." control="select" value={shownValue(collective.access, whoCanRead)} options={choicesFor(collective.access, whoCanRead)} onCommit={write('access')} />
        </SettingGroup>

        <SettingGroup label="members" defaultOpen count={collective.memberCount ?? null} noun={['member', 'members']} id={anchor('members')}>
          {actions.onInvite && (
            <form className="srow cmg-invite" onSubmit={(event) => { event.preventDefault(); actions.onInvite(invite); setInvite('') }}>
              <Input label="invite by github username" value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="github username" />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={!invite.trim()}>invite</button>
            </form>
          )}
          <ul className="cmg-member-list" aria-label="members">
            {collective.members.map((member) => (
              <li key={member.handle} className="cmg-member">
                <Avatar name={member.name ?? member.handle} size="sm" />
                <span className="cmg-member-id"><span className="mono">{member.handle}</span> {member.name ? <span className="cmg-member-name">{member.name}</span> : null}</span>
                {member.role === 'owner' ? <span className="cmg-none mono">owner</span> : (
                  <>
                    <span className="select-wrap cmg-member-role">
                      <select className="select" aria-label={`role for ${member.handle}`} defaultValue={member.role} onChange={(event) => actions.onRoleChange?.(member.handle, event.target.value)}>
                        <option value="member">member</option>
                        <option value="contributor">contributor</option>
                      </select>
                    </span>
                    {actions.onRemoveMember && <button type="button" className="btn btn-ghost btn-sm" aria-label={`remove ${member.handle}`} onClick={() => actions.onRemoveMember(member.handle)}>remove</button>}
                  </>
                )}
              </li>
            ))}
          </ul>
          <SettingRow label="when a member leaves" help="what happens to the transcripts they published here." control="select" value={shownValue(collective.memberLeaves, memberLeavesChoices)} options={choicesFor(collective.memberLeaves, memberLeavesChoices)} onCommit={write('memberLeaves')} />
        </SettingGroup>

        <SettingGroup label="github orgs" defaultOpen count={collective.org === undefined ? null : collective.org ? 1 : 0} noun={['org', 'orgs']} id={anchor('github orgs')}>
          <div className="srow">
            <span className="srow-text-col">
              <span className="srow-label">{collective.org ? collective.org.login : collective.org === null ? 'no org linked' : 'github org'}</span>
              <span className="srow-help">
                {typeof collective.org?.total === 'number' ? <><span className="tnum">{collective.org.linked ?? 0}</span> of <span className="tnum">{collective.org.total}</span> repos linked. </> : null}
                a collective links one github org today.
              </span>
            </span>
            {actions.onLinkRepos && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPicking(true)}>manage</button>}
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
          <p className="srow-note">automatic linking is now a personal setting, in {accountHref ? <a className="link" href={accountHref}>your settings</a> : 'your settings'}.</p>
        </SettingGroup>

        {danger && (
          <SettingGroup label="danger zone" defaultOpen count={null} id={anchor('danger zone')}>
            {actions.onTransferOwnership && (
              <div className="srow">
                <span className="srow-help">give the owner role to another member. you stay on as a member.</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => actions.onTransferOwnership()}>transfer ownership</button>
              </div>
            )}
            {actions.onDelete && (
              <div className="srow">
                <span className="srow-help">delete {collective.name} for {typeof collective.memberCount === 'number' ? <>all <span className="tnum">{collective.memberCount}</span> members</> : 'all its members'}. this cannot be undone.</span>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => actions.onDelete()}>delete collective</button>
              </div>
            )}
          </SettingGroup>
        )}
      </div>
      {actions.onLinkRepos && (
        <RepoPicker open={picking} onClose={() => setPicking(false)} owners={owners} initialSelected={linkedRepos} title={`link repositories from ${collective.org?.login ?? 'github'}`} onSave={(diff) => { actions.onLinkRepos(diff); setPicking(false) }} />
      )}
    </>
  )
}

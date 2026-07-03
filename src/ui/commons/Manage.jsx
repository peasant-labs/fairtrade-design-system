import { useMemo, useState } from 'react'
import {
  ChevronRight,
  Eye,
  EyeOff,
  FolderGit2,
  Lock,
  LogOut,
  Settings,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { GovTile, ModerationQueue, ProviderBars, RoleRoster, StatGrid, Tag } from '../../ui'
import { formatProvider, providerLabel } from './providers.js'

const EMPTY_COLLECTIVE = {
  name: '',
  description: null,
  linkedGithubOrg: null,
  acceptanceMode: '',
  dataAccess: '',
  role: '',
  memberSince: null,
}

const EMPTY_STATS = {
  transcripts: '0',
  projects: '0 providers',
  tokens: '0',
  turns: '0 turns',
  contributors: '0 members',
  hours: '0 total',
}

const EMPTY_DATA = {
  collective: EMPTY_COLLECTIVE,
  providerShare: [],
  pendingReview: [],
  members: [],
  redactions: [],
  browseRows: [],
  roleOptions: [],
  initialRole: '',
  initialShowRedaction: false,
  initialBrowseGated: false,
  stats: EMPTY_STATS,
}

/* the four collective roles, in the fixed display order the demo's role switcher and the
   production read-only role indicator both use (owner outranks member outranks contributor
   outranks the unauthenticated/non-member "guest" view). */
const COLLECTIVE_VIEW_ROLES = ['owner', 'member', 'contributor', 'guest']

/* PROVIDER_LABEL / formatProvider / providerLabel now live in ./providers.js (a dependency-free
   leaf module) so both this shipped component and the demo (mockups/inuse/CommonsManage.jsx) can
   import the same one without CommonsManage.jsx importing back from Manage.jsx -- Manage.jsx
   already re-exports the demo's views FROM CommonsManage.jsx below, so that reverse edge would
   close an ESM cycle. Re-exported here for any external caller that imported these from Manage.jsx
   before this split. */
export { PROVIDER_LABEL, formatProvider, providerLabel } from './providers.js'

function formatDate(iso) {
  if (!iso) return 'unknown'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

export function Manage({
  data = EMPTY_DATA,
  actions = {},
  demoRoleSwitcher = false,
} = {}) {
  const {
    collective = EMPTY_COLLECTIVE,
    providerShare = [],
    pendingReview = [],
    members = [],
    redactions = [],
    browseRows = [],
    roleOptions = [],
    initialRole = '',
    initialShowRedaction = false,
    initialBrowseGated = false,
    stats = EMPTY_STATS,
  } = data || EMPTY_DATA

  const {
    onRoleChange,
    onJoin,
    onLeave,
    onSettings,
    onContribute,
    onToggleBrowse,
  } = actions || {}

  const [role, setRole] = useState(initialRole || collective.role || '')
  const [showRedaction, setShowRedaction] = useState(Boolean(initialShowRedaction))
  const [browseGated, setBrowseGated] = useState(Boolean(initialBrowseGated))

  const visibleRole = role || collective.role || 'guest'
  const isOwner = visibleRole === 'owner'
  const isGuest = visibleRole === 'guest'
  const hasRoleSwitcher = demoRoleSwitcher && roleOptions.length > 0

  const roleButtons = useMemo(
    () => (hasRoleSwitcher ? roleOptions : []),
    [hasRoleSwitcher, roleOptions],
  )

  const toggleRole = (next) => {
    setRole(next)
    onRoleChange?.(next)
  }

  const toggleBrowse = () => {
    setBrowseGated((current) => {
      const next = !current
      onToggleBrowse?.(next)
      return next
    })
  }

  const handleSettings = () => onSettings?.()

  return (
    <div className="cmg-root">
      <div className="cmg-detail">
        <header className="cmg-d-hero">
          <div className="crumb cmg-crumb">
            village <ChevronRight size={13} aria-hidden="true" /> collectives{' '}
            <ChevronRight size={13} aria-hidden="true" />
            <span className="cur">{collective.name || 'collective'}</span>
          </div>
          <div className="cmg-d-hero-row">
            <div>
              <h2 className="cmg-title">{collective.name || 'collective'}</h2>
              <p className="cmg-deck">
                {collective.description || 'shared collective governance'}
              </p>
              <span className="cmg-orgpill mono">
                <FolderGit2 size={13} aria-hidden="true" />{' '}
                {collective.linkedGithubOrg || 'not linked'}
              </span>
            </div>

            <div className="cmg-d-actions btn-row">
              {hasRoleSwitcher ? (
                <div className="cmg-roleswitch" role="group" aria-label="view as role">
                  {roleButtons.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="cmg-roleseg"
                      aria-pressed={role === item}
                      onClick={() => toggleRole(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : (
                /* production (non-demo) role indicator: the four collective roles, matching the
                   demo's role-switcher layout, with the viewer's OWN role highlighted -- but
                   read-only (no click handler / aria-pressed toggling another role), since a real
                   viewer has exactly one role and switching it here would let them preview other
                   roles' capabilities, which a prior review correctly flagged as the production
                   surface leaking the demo's role-switcher CAPABILITY, not just its look. */
                <div className="cmg-roleswitch" role="group" aria-label="your role">
                  {COLLECTIVE_VIEW_ROLES.map((item) => (
                    <span
                      key={item}
                      className="cmg-roleseg"
                      aria-current={visibleRole === item ? 'true' : undefined}
                      data-active={visibleRole === item || undefined}
                      style={{ cursor: 'default' }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}

              {isGuest ? (
                <button type="button" className="btn btn-sm btn-primary" onClick={() => onJoin?.()}>
                  <UserPlus size={14} aria-hidden="true" /> join as contributor
                </button>
              ) : null}

              {(visibleRole === 'member' || visibleRole === 'contributor') && onContribute ? (
                <button type="button" className="btn btn-sm btn-primary" onClick={() => onContribute?.()}>
                  <ShieldAlert size={14} aria-hidden="true" /> contribute
                </button>
              ) : null}

              {(visibleRole === 'member' || visibleRole === 'contributor') && onLeave ? (
                <button type="button" className="btn btn-sm btn-danger" onClick={() => onLeave?.()}>
                  <LogOut size={14} aria-hidden="true" /> leave
                </button>
              ) : null}

              {isOwner && onSettings ? (
                <button type="button" className="btn btn-sm btn-secondary" onClick={handleSettings}>
                  <Settings size={14} aria-hidden="true" /> settings
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <div className="cmg-tiles">
          <GovTile label="contributions" value={collective.acceptanceMode || 'open'} tone="teal" />
          <GovTile label="access" value={collective.dataAccess || 'members only'} tone="amber" />
          <GovTile label="your role" value={visibleRole} />
        </div>

        <StatGrid
          tiles={[
            { key: 'transcripts', label: 'transcripts', value: stats.transcripts, sub: `across ${stats.projects}` },
            { key: 'tokens', label: 'tokens', value: stats.tokens, sub: stats.turns },
            { key: 'contributors', label: 'contributors', value: stats.contributors, sub: stats.hours },
          ]}
        />

        <div className="cmg-d-grid">
          <main className="cmg-d-main">
            {providerShare.length > 0 ? (
              <section className="card cmg-share" aria-labelledby="cmg-share-h">
                <h3 id="cmg-share-h" className="cmg-sub">provider share</h3>
                <ProviderBars
                  label="provider share"
                  total={100}
                  data={providerShare.map((item) => ({ label: providerLabel(item.id), value: item.pct }))}
                />
              </section>
            ) : null}

            {pendingReview.length > 0 ? (
              /* containment wrapper matching sections-react/70-governance.jsx's own gov specimens
                 (every ModerationQueue/RoleRoster/DangerZone example there is wrapped identically):
                 a wide item title/detail can otherwise overflow its card and bleed past the page
                 edge instead of scrolling internally. */
              <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                <ModerationQueue
                  title="pending review"
                  emptyLabel="no shares awaiting review."
                  items={pendingReview.map((item) => ({
                    id: item.id,
                    kind: 'share',
                    who: item.title || 'untitled transcript',
                    detail: `by ${item.by || 'anon'}`,
                  }))}
                />
              </div>
            ) : null}

            {redactions.length > 0 ? (
              <section className="card cmg-redact-sec" aria-labelledby="cmg-redact-h">
                <div className="cmg-queue-head">
                  <h3 id="cmg-redact-h" className="cmg-sub">
                    <ShieldAlert size={15} aria-hidden="true" /> redaction review
                  </h3>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    aria-expanded={showRedaction}
                    onClick={() => setShowRedaction((current) => !current)}
                  >
                    {showRedaction ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                    {showRedaction ? 'hide' : 'show'}
                  </button>
                </div>
                {showRedaction ? (
                  <div className="cmg-redact-list">
                    {redactions.map((item) => (
                      <article key={item.id} className="cmg-redact">
                        <div className="cmg-redact-head">
                          <span className="cmg-redact-badges">
                            <Tag>{String(item.catLabel || item.cat || 'item').toLowerCase()}</Tag>
                          </span>
                          <span className="cmg-redact-file mono">{item.file || 'unknown'}</span>
                        </div>
                        <p className="cmg-redact-summary mono">{item.summary || 'redaction review item'}</p>
                        <div className="callout cmg-redact-note">
                          <ShieldAlert size={16} aria-hidden="true" />
                          <div>{item.tip || 'review this redaction item before exposing it.'}</div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="card cmg-browser" aria-labelledby="cmg-browser-h">
              <div className="cmg-queue-head">
                <h3 id="cmg-browser-h" className="cmg-sub">data</h3>
                <button type="button" className="btn btn-sm btn-ghost" aria-pressed={browseGated} onClick={toggleBrowse}>
                  {browseGated ? <Lock size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                  {browseGated ? 'gated view' : 'open view'}
                </button>
              </div>

              {browseGated ? (
                <div className="empty cmg-locked">
                  <span className="ring"><Lock size={20} aria-hidden="true" /></span>
                  <h3>data access restricted</h3>
                  <p>this collective is members-only. join as a full member to browse the dataset.</p>
                  {isGuest ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => onJoin?.()}>
                      <UserPlus size={14} aria-hidden="true" /> join as contributor
                    </button>
                  ) : null}
                </div>
              ) : browseRows.length > 0 ? (
                <table className="dtable cmg-dtable">
                  <thead>
                    <tr>
                      <th scope="col">title</th>
                      <th scope="col">contributor</th>
                      <th scope="col">provider</th>
                      <th scope="col" className="cmg-num">turns</th>
                      <th scope="col" className="cmg-num">tokens</th>
                      <th scope="col">date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {browseRows.map((row) => (
                      <tr key={`${row.title}-${row.contributor}`}>
                        <td>{row.title || 'untitled transcript'}</td>
                        <td className="mono">{row.contributor || 'anon'}</td>
                        <td>
                          {/* prefer the canonical brand label derived from providerId (the raw wire
                              slug) over a caller-supplied `provider` string -- village's adapter
                              passes the raw slug through both fields, so trusting `row.provider`
                              directly showed "claude-code"/"gemini-cli" verbatim in this table even
                              though the provider-share box above it was already humanized. */}
                          <FolderGit2 size={12} aria-hidden="true" /> {row.providerId ? providerLabel(row.providerId) : (row.provider || formatProvider(row.providerId))}
                        </td>
                        <td className="cmg-num tnum">{row.turns || '0'}</td>
                        <td className="cmg-num tnum">{row.tokens || '0'}</td>
                        <td className="mono tnum">{row.date || formatDate(null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty cmg-locked">
                  <span className="ring"><Users size={20} aria-hidden="true" /></span>
                  <h3>no data yet</h3>
                  <p>this collective has no visible transcripts to browse.</p>
                </div>
              )}
            </section>
          </main>

          {members.length > 0 ? (
            <aside className="sidebar cmg-d-rail" aria-label="collective sidebar">
              {/* containment wrapper matching sections-react/70-governance.jsx's RoleRoster
                 specimen: a long handle/name/role row can otherwise bleed the roster past the
                 rail's edge instead of scrolling internally. */}
              <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                <RoleRoster
                  title="members"
                  roles={['member', 'contributor']}
                  members={members.map((member) => ({
                    handle: member.handle || member.githubUsername || '@unknown',
                    name: member.name || member.displayName || member.githubUsername || 'unknown',
                    role: member.role || 'member',
                    owner: member.role === 'owner',
                  }))}
                />
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export {
  PublishView,
  CollectivesView,
  CollectiveDetailView,
  CollectiveSettingsView,
  ContributeView,
} from '../../mockups/inuse/CommonsManage.jsx'

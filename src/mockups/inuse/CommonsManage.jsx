import { useId, useMemo, useState } from 'react'
import {
  Upload,
  Copy,
  Check,
  X,
  Plus,
  Users,
  ChevronRight,
  ChevronDown,
  Hash,
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Settings,
  LogOut,
  UserPlus,
  FolderGit2,
  ExternalLink,
  GitBranch,
  CircleDot,
  Lock,
  ArrowRight,
} from 'lucide-react'
import { providerLabel } from '../../ui/commons/providers.js'
import {
  StatGrid,
  GovTile,
  ProviderBars,
  ModerationQueue,
  RoleRoster,
  ConsentDialog,
  PolicySelect,
  Input,
  Textarea,
  Select,
  Switch,
  RadioGroup,
  DangerZone,
  ConfirmInline,
  Tag,
  ProviderIcon,
} from '../../ui'

/* ============================================================================
   COMMONS MANAGE — the publish / collectives / governance half of Village
   ("peasant"). four self-contained views, each fills its container (the host
   window body clips + scrolls). all interaction is real useState; chrome is
   lowercase, real content (titles, commands, handles) keeps its case. new CSS
   is .cmg-* only; reuses .card/.chip/.btn/.dtable/.callout/.check-box/.diff/
   .dl/.sidebar/.empty/.select/.input/.crumb/.tnum etc.
============================================================================ */

/* small copyable command block with $ prompt + Copy→Check (transient "copied"). */
function CommandBlock({ cmd, note }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    try {
      navigator.clipboard?.writeText(cmd)
    } catch {
      /* clipboard unavailable in sandbox; still flash the confirmation */
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="cmg-cmd">
      <code className="cmg-cmd-text mono">
        <span className="cmg-cmd-prompt" aria-hidden="true">$ </span>
        {cmd}
      </code>
      <button type="button" className="btn btn-sm btn-secondary cmg-cmd-copy" onClick={copy} aria-label={copied ? 'copied' : 'copy command'}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied ? 'copied' : 'copy'}
      </button>
      {note ? <span className="cmg-cmd-note mono">{note}</span> : null}
    </div>
  )
}

/* ============================================================================
   1) PUBLISH VIEW — the CLI-first publishing dashboard
============================================================================ */
const RECENT_PUBLISHES = [
  { id: 'a1', provider: 'claude-code', title: 'Debugging auth middleware with Claude Code', visibility: 'public', date: 'Jun 15', turns: 64, project: 'village' },
  { id: 'a2', provider: 'gemini-cli', title: 'Optimizing N+1 query issues using Gemini CLI', visibility: 'shared', date: 'Jun 14', turns: 31, project: 'api-server' },
  { id: 'a3', provider: 'claude-code', title: 'Greenfield React app setup', visibility: 'private', date: 'Jun 12', turns: 47, project: 'frontend-app' },
  { id: 'a4', provider: 'opencode', title: 'Multi-agent debugging session', visibility: 'public', date: 'Jun 10', turns: 128, project: 'platform' },
]

const IMPORT_STEPS = [
  { n: 1, title: 'install the cli', cmd: 'go install github.com/peasant-labs/peasant/cmd/peasant@latest' },
  { n: 2, title: 'sign in', cmd: 'peasant login', note: 'opens a browser OAuth flow; stores ~/.config/peasant/credentials.json' },
  { n: 3, title: 'run the setup wizard', cmd: 'peasant kickstart' },
  { n: 4, title: 'push your transcripts', cmd: 'peasant village push --dry-run --visibility public' },
]

function VisibilityEye({ v, names }) {
  const map = {
    public: { Icon: Eye, label: 'visible to everyone', cls: '' },
    shared: { Icon: Users, label: names ? `shared with: ${names}` : 'shared with collectives', cls: 'cmg-eye-shared' },
    private: { Icon: EyeOff, label: 'only visible to you', cls: 'cmg-eye-private' },
  }
  const { Icon, label, cls } = map[v] || map.private
  return (
    <span className={'cmg-eye ' + cls} title={label}>
      <Icon size={14} aria-hidden="true" />
      <span className="cmg-sr">{label}</span>
    </span>
  )
}

export function PublishView() {
  const [showGS, setShowGS] = useState(true)
  const [importOpen, setImportOpen] = useState(false)

  return (
    <div className="cmg-root">
      <div className="cmg-page">
        <div className="crumb cmg-crumb">
          village <ChevronRight size={13} aria-hidden="true" /> <span className="cur">publish</span>
        </div>
        <header className="cmg-head">
          <div>
            <h2 className="cmg-title">publishing dashboard</h2>
            <p className="cmg-deck">push transcripts from the peasant cli to the village.</p>
          </div>
        </header>

        {showGS && (
          <section className="cmg-gs card" aria-labelledby="cmg-gs-h">
            <div className="cmg-gs-head">
              <span className="cmg-gs-h-l">
                <Terminal size={16} aria-hidden="true" className="cmg-gs-ico" />
                <h3 id="cmg-gs-h" className="cmg-sub">getting started</h3>
              </span>
              <button type="button" className="btn btn-sm btn-icon btn-ghost" onClick={() => setShowGS(false)} aria-label="dismiss getting started">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="cmg-gs-body">
              <div className="cmg-step">
                <span className="cmg-step-n tnum" aria-hidden="true">1</span>
                <div className="cmg-step-main">
                  <div className="cmg-step-title">run the setup wizard</div>
                  <p className="cmg-step-desc">connects github, discovers agent transcripts, configures providers (Claude Code / OpenCode), sets your redaction level.</p>
                  <CommandBlock cmd="peasant kickstart" />
                </div>
              </div>
              <div className="cmg-step">
                <span className="cmg-step-n tnum" aria-hidden="true">2</span>
                <div className="cmg-step-main">
                  <div className="cmg-step-title">push transcripts</div>
                  <p className="cmg-step-desc">auto-redaction runs before upload. add --dry-run to preview, or --visibility public to override.</p>
                  <CommandBlock cmd="peasant village push" note="--dry-run preview · --visibility public override" />
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="cmg-recent card" aria-labelledby="cmg-recent-h">
          <div className="cmg-recent-head">
            <h3 id="cmg-recent-h" className="cmg-sub">recent publishes</h3>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setImportOpen(true)}>
              <Upload size={14} aria-hidden="true" /> import
            </button>
          </div>
          {RECENT_PUBLISHES.length === 0 ? (
            <div className="cmg-recent-empty mono">no transcripts published yet.</div>
          ) : (
            <ul className="cmg-pub-list">
              {RECENT_PUBLISHES.map((p) => (
                <li key={p.id} className="cmg-pub-row">
                  <span className="cmg-pub-prov"><ProviderMark id={p.provider} /></span>
                  <span className="cmg-pub-title">{p.title}</span>
                  <span className="cmg-pub-meta mono">{p.project}</span>
                  <span className="cmg-pub-meta mono tnum"><Hash size={13} aria-hidden="true" /> {p.turns}</span>
                  <VisibilityEye v={p.visibility} />
                  <span className="cmg-pub-date mono tnum">{p.date}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {importOpen && (
        <div className="cmg-scrim" role="presentation" onClick={() => setImportOpen(false)}>
          <div
            className="cmg-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cmg-import-h"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && setImportOpen(false)}
          >
            <div className="cmg-dlg-head">
              <h3 id="cmg-import-h" className="cmg-sub">how to import transcripts</h3>
              <button type="button" className="btn btn-sm btn-icon btn-ghost" onClick={() => setImportOpen(false)} aria-label="close dialog">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="cmg-dlg-body">
              <p className="cmg-dlg-intro mono">transcripts are imported through the peasant cli, not the web ui. follow these steps from a terminal:</p>
              <ol className="cmg-import-steps">
                {IMPORT_STEPS.map((s) => (
                  <li key={s.n} className="cmg-step">
                    <span className="cmg-step-n tnum" aria-hidden="true">{s.n}</span>
                    <div className="cmg-step-main">
                      <div className="cmg-step-title">{s.title}</div>
                      <CommandBlock cmd={s.cmd} note={s.note} />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="cmg-dlg-foot">
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setImportOpen(false)}>close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   2) COLLECTIVES VIEW — list/grid of collectives + create form
============================================================================ */
const ACCEPTANCE_MODES = [
  { value: 'open', short: 'Open', label: 'open', rationale: 'anyone can share. contributions are auto-approved.' },
  { value: 'verified_only', short: 'Verified only', label: 'verified only', rationale: 'sharing requires an org affiliation.' },
  { value: 'curated', short: 'Curated', label: 'curated', rationale: 'the owner must approve each share before it appears.' },
]
const ACCESS_POLICIES = [
  { value: 'members_only', short: 'Members only', label: 'members only', rationale: 'full members can browse the collected data.' },
  { value: 'contributors', short: 'Contributors', label: 'contributors', rationale: 'anyone who contributes can browse the data.' },
  { value: 'public', short: 'Public', label: 'public', rationale: 'anyone at all can browse the dataset.' },
]
const LINKED_ORGS = ['@anthropic-labs', '@data-collective', '@openai-research']

const COLLECTIVES = [
  { id: 'c1', name: 'AI Research Team', desc: 'Sharing transcripts related to AI research', members: 12, transcripts: 248, mode: 'open', role: 'owner', since: 'Member for 5mo' },
  { id: 'c2', name: 'Verified Contributors', desc: 'Only verified org members can share here', members: 7, transcripts: 96, mode: 'verified_only', role: 'member', since: 'Member for 2mo' },
  { id: 'c3', name: 'Curated Showcase', desc: 'Owner-approved transcripts only', members: 21, transcripts: 54, mode: 'curated', role: 'contributor', since: 'Joined today' },
]

function ModeBadge({ mode }) {
  const m = ACCEPTANCE_MODES.find((x) => x.value === mode)
  const cls = mode === 'open' ? 'chip-ok' : mode === 'curated' ? 'chip-warn' : ''
  return <span className={'chip ' + cls}>{m ? m.short.toLowerCase() : mode}</span>
}

export function CollectivesView({ data = {}, actions = {} } = {}) {
  const {
    collectives = COLLECTIVES,
    linkedOrgs = LINKED_ORGS,
    title = 'collectives',
    deck = 'groups that govern shared data together.',
    crumb = 'collectives',
    createLabel = 'new collective',
    createBusy = false,
  } = data
  const { onCreateCollective, onOpenCollective } = actions

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [mode, setMode] = useState('open')
  const [access, setAccess] = useState('members_only')
  const [org, setOrg] = useState('')
  const uid = useId()

  const createCollective = () => onCreateCollective?.({ name, purpose, mode, access, org })

  return (
    <div className="cmg-root">
      <div className="cmg-page">
        <div className="crumb cmg-crumb">
          village <ChevronRight size={13} aria-hidden="true" /> <span className="cur">{crumb}</span>
        </div>
        <header className="cmg-head">
          <div>
            <h2 className="cmg-title">{title}</h2>
            <p className="cmg-deck">{deck}</p>
          </div>
          <button
            type="button"
            className={'btn btn-sm ' + (showForm ? 'btn-secondary' : 'btn-primary')}
            aria-expanded={showForm}
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
            {showForm ? 'cancel' : createLabel}
          </button>
        </header>

        {showForm && (
          <section className="cmg-form card" aria-labelledby="cmg-form-h">
            <h3 id="cmg-form-h" className="cmg-sub">create a collective</h3>
            <div className="cmg-form-grid">
              <label className="cmg-field">
                <span className="label">name</span>
                <input className="input" type="text" placeholder="AI Research Collective" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="cmg-field cmg-field-wide">
                <span className="label">purpose</span>
                <textarea className="input" rows={2} placeholder="What does this collective do?" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              </label>
              <div className="cmg-field">
                <PolicySelect
                  variant="select"
                  label="acceptance mode"
                  name="acceptance-mode"
                  value={mode}
                  onChange={setMode}
                  options={ACCEPTANCE_MODES}
                />
              </div>
              <div className="cmg-field">
                <PolicySelect
                  variant="select"
                  label="data access policy"
                  name="data-access"
                  value={access}
                  onChange={setAccess}
                  options={ACCESS_POLICIES}
                />
              </div>
              <label className="cmg-field">
                <span className="label">link to github org (optional)</span>
                <div className="select-wrap">
                  <select className="select" value={org} onChange={(e) => setOrg(e.target.value)}>
                    <option value="">Not linked</option>
                    {linkedOrgs.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <ChevronDown className="lucide" aria-hidden="true" />
                </div>
              </label>
            </div>
            <div className="cmg-form-foot">
              <button type="button" className="btn btn-sm btn-primary" disabled={!name.trim() || createBusy} aria-describedby={uid} onClick={createCollective}>{createBusy ? 'creating…' : 'create collective'}</button>
              <span id={uid} className="cmg-form-hint mono">
                {ACCEPTANCE_MODES.find((m) => m.value === mode)?.rationale}
              </span>
            </div>
          </section>
        )}

        <ul className="cmg-grid">
          {collectives.map((c) => (
            <li key={c.id}>
              <button type="button" className="card cmg-col-card" onClick={() => onOpenCollective?.(c.id)}>
                <span className="cmg-col-ico" aria-hidden="true"><Users size={18} /></span>
                <span className="cmg-col-main">
                  <span className="cmg-col-head">
                    <span className="cmg-col-name">{c.name}</span>
                    <ModeBadge mode={c.mode} />
                  </span>
                  <span className="cmg-col-desc">{c.desc}</span>
                  <span className="cmg-col-foot mono">
                    <span className="cmg-col-role">{c.role}</span>
                    {c.since ? <>
                      <span className="cmg-dot" aria-hidden="true">·</span>
                      <span>{c.since}</span>
                    </> : null}
                    {c.members != null ? <><span className="cmg-dot" aria-hidden="true">·</span><span className="tnum">{c.members} members</span></> : null}
                    {c.transcripts != null ? <><span className="cmg-dot" aria-hidden="true">·</span><span className="tnum">{c.transcripts} transcripts</span></> : null}
                  </span>
                </span>
                <ChevronRight size={16} aria-hidden="true" className="cmg-col-chev" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ============================================================================
   3) COLLECTIVE DETAIL VIEW — governance hub + review queue + redaction review
============================================================================ */
const ROLES = ['owner', 'member', 'contributor', 'guest']

const PROVIDER_SHARE = [
  { id: 'claude-code', pct: 58 },
  { id: 'gemini-cli', pct: 24 },
  { id: 'opencode', pct: 12 },
  { id: 'codex', pct: 6 },
]

const PENDING_REVIEW = [
  { id: 'p1', provider: 'claude-code', title: 'Building a REST API from scratch', by: '@alice-dev' },
  { id: 'p2', provider: 'gemini-cli', title: 'Refactoring database queries with Gemini', by: 'anon' },
  { id: 'p3', provider: 'opencode', title: 'Multi-agent debugging session', by: '@bob-ai' },
]

const MEMBERS = [
  { handle: '@alice-dev', name: 'Alice Developer', role: 'owner', n: 84 },
  { handle: '@bob-ai', name: 'Bob AI', role: 'member', n: 37 },
  { handle: '@charlie-ml', name: 'Charlie ML', role: 'member', n: 22 },
  { handle: 'anon', name: 'anonymous', role: 'contributor', n: 9 },
]

const REDACTIONS = [
  {
    id: 'r1',
    cat: 'CREDENTIAL',
    catLabel: 'Credential',
    catTone: 'chip-err',
    tip: 'A secret, token, key, or password.',
    confidence: 96,
    line: 142,
    file: 'internal/aws/client.go',
    original: 'AWS_SECRET = "AKIA4F8X2Q9ZJ7K1MN3P"',
    replacement: 'AWS_SECRET = "[REDACTED:credential]"',
    summary: 'AWS access key detected',
  },
  {
    id: 'r2',
    cat: 'PII',
    catLabel: 'PII',
    catTone: 'chip-warn',
    tip: 'Personally identifiable information (name, email, phone).',
    confidence: 62,
    line: 318,
    file: 'cmd/notify/main.go',
    original: 'to := "alice.developer@example.com"',
    replacement: 'to := "[REDACTED:pii]"',
    summary: 'email address detected',
  },
  {
    id: 'r3',
    cat: 'PATH',
    catLabel: 'Path',
    catTone: '',
    tip: 'A local filesystem path.',
    confidence: 88,
    line: 12,
    file: 'config/dev.yaml',
    original: 'home: /Users/pigeonzow/Documents/GitHub/Neurondle',
    replacement: 'home: [REDACTED:path]',
    summary: 'local path detected',
  },
]

/* one redaction-review item: line-numbered diff (strike original -> highlighted
   replacement) + category/confidence badges + sticky keep/expose opt-out. */
function RedactionItem({ item }) {
  const [exposed, setExposed] = useState(false)
  const low = item.confidence < 70
  return (
    <div className={'cmg-redact' + (exposed ? ' cmg-redact-exposed' : '') + (low && !exposed ? ' cmg-redact-low' : '')}>
      <div className="cmg-redact-head">
        <span className="cmg-redact-badges">
          <span className={'chip ' + item.catTone} title={item.tip}>{item.catLabel.toLowerCase()}</span>
          <span className={'chip ' + (low ? 'chip-warn' : '')}>
            {low ? <AlertTriangle size={13} aria-hidden="true" /> : null}
            <span className="tnum">{item.confidence}%</span> confidence
          </span>
          {exposed ? <span className="chip chip-err">un-redacted</span> : null}
        </span>
        <span className="cmg-redact-file mono">{item.file}</span>
      </div>
      <p className="cmg-redact-summary mono">{item.summary}</p>
      <div className="diff cmg-redact-diff">
        <div className="dl ctx">
          <span className="rail" />
          <span className="gut tnum">{item.line - 1}</span>
          <span className="sign" />
          <span className="t">{'func configure() {'}</span>
        </div>
        <div className="dl del">
          <span className="rail" />
          <span className="gut tnum">{item.line}</span>
          <span className="sign">−</span>
          <span className="t cmg-strike">{item.original}</span>
        </div>
        <div className="dl add">
          <span className="rail" />
          <span className="gut tnum">{item.line}</span>
          <span className="sign">+</span>
          <span className="t">{item.replacement}</span>
        </div>
        <div className="dl ctx">
          <span className="rail" />
          <span className="gut tnum">{item.line + 1}</span>
          <span className="sign" />
          <span className="t">{'}'}</span>
        </div>
      </div>
      <div className="cmg-redact-foot">
        {exposed ? (
          <span className="cmg-redact-warn mono"><AlertTriangle size={13} aria-hidden="true" /> this content will be exposed</span>
        ) : (
          <span className="cmg-redact-safe mono"><ShieldCheck size={13} aria-hidden="true" /> redacted (safe default)</span>
        )}
        {exposed ? (
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setExposed(false)}>
            <EyeOff size={14} aria-hidden="true" /> redact
          </button>
        ) : (
          <button type="button" className="btn btn-sm btn-danger" onClick={() => setExposed(true)}>
            <Eye size={14} aria-hidden="true" /> opt out
          </button>
        )}
      </div>
    </div>
  )
}

export function CollectiveDetailView({ data = {}, actions = {} } = {}) {
  const {
    collective = { name: 'AI Research Team', description: 'Sharing transcripts related to AI research', linkedGithubOrg: '@anthropic-labs' },
    providerShare = PROVIDER_SHARE,
    pendingReview = PENDING_REVIEW,
    members = MEMBERS,
    redactions = REDACTIONS,
    browseRows = [
      { title: 'Building a REST API from scratch', contributor: '@alice-dev', providerId: 'claude-code', provider: 'Claude Code', turns: '64', tokens: '182K', date: 'Jun 15' },
      { title: 'Debugging auth middleware', contributor: 'anon', providerId: 'gemini-cli', provider: 'Gemini', turns: '31', tokens: '94K', date: 'Jun 14' },
      { title: 'Greenfield React app setup', contributor: '@bob-ai', providerId: 'opencode', provider: 'OpenCode', turns: '47', tokens: '121K', date: 'Jun 12' },
    ],
    roleOptions = ROLES,
    initialRole = 'owner',
    initialShowRedaction = true,
    initialBrowseGated = false,
    targetCollective = TARGET_COLLECTIVE,
    stats = { transcripts: '248', projects: '31 projects', tokens: '4.2M', turns: '18.4K turns', contributors: '12', hours: '63h total' },
  } = data
  const { onRoleChange, onJoin, onLeave, onSettings, onToggleBrowse, onContribute } = actions

  const [role, setRole] = useState(initialRole) // role switcher to demo capability gating
  const [showRedaction, setShowRedaction] = useState(initialShowRedaction)
  const [browseGated, setBrowseGated] = useState(initialBrowseGated)

  const isOwner = role === 'owner'
  const isGuest = role === 'guest'
  const setRoleAndNotify = (next) => { setRole(next); onRoleChange?.(next) }
  const toggleBrowse = () => { setBrowseGated((g) => { const next = !g; onToggleBrowse?.(next); return next }) }

  return (
    <div className="cmg-root">
      <div className="cmg-detail">
        {/* hero + action cluster */}
        <header className="cmg-d-hero">
          <div className="crumb cmg-crumb">
            village <ChevronRight size={13} aria-hidden="true" /> collectives <ChevronRight size={13} aria-hidden="true" /> <span className="cur">{collective.name}</span>
          </div>
          <div className="cmg-d-hero-row">
            <div>
              <h2 className="cmg-title">{collective.name}</h2>
              <p className="cmg-deck">{collective.description}</p>
              <span className="cmg-orgpill mono"><FolderGit2 size={13} aria-hidden="true" /> {collective.linkedGithubOrg || 'not linked'}</span>
            </div>
            <div className="cmg-d-actions btn-row">
              {/* role switcher: demo the capability-gated action cluster */}
              <div className="cmg-roleswitch" role="group" aria-label="view as role">
                {roleOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="cmg-roleseg"
                    aria-pressed={role === r}
                    onClick={() => setRoleAndNotify(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {isGuest && <button type="button" className="btn btn-sm btn-primary" onClick={() => onJoin?.()}><UserPlus size={14} aria-hidden="true" /> join as contributor</button>}
              {(role === 'member' || role === 'contributor') && <button type="button" className="btn btn-sm btn-primary" onClick={() => onContribute?.()}><Upload size={14} aria-hidden="true" /> contribute</button>}
              {(role === 'member' || role === 'contributor') && <button type="button" className="btn btn-sm btn-danger" onClick={() => onLeave?.()}><LogOut size={14} aria-hidden="true" /> leave</button>}
              {isOwner && <button type="button" className="btn btn-sm btn-secondary" onClick={() => onSettings?.()}><Settings size={14} aria-hidden="true" /> settings</button>}
            </div>
          </div>
        </header>

        {/* governance facts (kit GovTile) + KPI metrics (kit StatGrid) */}
        <div className="cmg-tiles">
          <GovTile label="contributions" value={collective.acceptanceMode || 'open'} tone="teal" />
          <GovTile label="access" value={collective.dataAccess || 'members only'} tone="amber" />
          <GovTile label="your role" value={role} />
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
            {/* provider share bars (kit ProviderBars — monochrome by design) */}
            <section className="card cmg-share" aria-labelledby="cmg-share-h">
              <h3 id="cmg-share-h" className="cmg-sub">provider share</h3>
              <ProviderBars
                label="provider share"
                total={100}
                data={providerShare.map((p) => ({ label: providerLabel(p.id), value: p.pct }))}
              />
            </section>

            {/* curated owner review queue (kit ModerationQueue — owns its own resolve + count + empty state).
                overflow/maxWidth wrapper matches every gov specimen in sections-react/70-governance.jsx: a
                wide item title/detail can otherwise bleed past the card edge instead of scrolling internally. */}
            {isOwner && (
              <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                <ModerationQueue
                  title="pending review"
                  emptyLabel="no shares awaiting review."
                  items={pendingReview.map((q) => ({
                    id: q.id,
                    kind: 'share',
                    who: q.title,
                    detail: `by ${q.by}`,
                  }))}
                />
              </div>
            )}

            {/* redaction review snippet */}
            <section className="card cmg-redact-sec" aria-labelledby="cmg-redact-h">
              <div className="cmg-queue-head">
                <h3 id="cmg-redact-h" className="cmg-sub"><ShieldAlert size={15} aria-hidden="true" /> redaction review</h3>
                <button type="button" className="btn btn-sm btn-ghost" aria-expanded={showRedaction} onClick={() => setShowRedaction((s) => !s)}>
                  {showRedaction ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                  {showRedaction ? 'hide' : 'show'}
                </button>
              </div>
              {showRedaction && (
                <>
                  <div className="callout cmg-redact-note">
                    <ShieldAlert size={16} aria-hidden="true" />
                    <div>safe by default: every detected item stays redacted unless you opt out per item. there is no bulk accept.</div>
                  </div>
                  <div className="cmg-redact-list">
                    {redactions.map((r) => (
                      <RedactionItem key={r.id} item={r} />
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* data browser, gated */}
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
                  {isGuest && <button type="button" className="btn btn-sm btn-primary"><UserPlus size={14} aria-hidden="true" /> join as contributor</button>}
                </div>
              ) : (
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
                      <tr key={row.title}>
                        <td>{row.title}</td>
                        <td className="mono">{row.contributor}</td>
                        <td><ProviderIcon harness={row.providerId} /> {providerLabel(row.providerId)}</td>
                        <td className="cmg-num tnum">{row.turns}</td>
                        <td className="cmg-num tnum">{row.tokens}</td>
                        <td className="mono tnum">{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </main>

          {/* right rail: members + pending member requests */}
          <aside className="sidebar cmg-d-rail" aria-label="collective sidebar">
            {/* pending member requests (kit ModerationQueue, kind 'member' — icon+word actions).
                overflow/maxWidth wrapper matches sections-react/70-governance.jsx's own specimen. */}
            {isOwner && (
              <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                <ModerationQueue
                  title="pending requests"
                  emptyLabel="no pending requests."
                  items={[{ id: 'dana-codes', kind: 'member', who: '@dana-codes' }]}
                />
              </div>
            )}
            {/* members roster (kit RoleRoster — owner row locked; member/contributor roles only).
                overflow/maxWidth wrapper matches sections-react/70-governance.jsx's own specimen. */}
            <div style={{ overflow: 'auto', maxWidth: '100%' }}>
              <RoleRoster
                title="members"
                roles={['member', 'contributor']}
                members={members.map((m) => ({
                  handle: m.handle,
                  name: m.name,
                  role: m.role,
                  owner: m.role === 'owner',
                }))}
              />
            </div>
            <div className="sb-sec">
              <div className="sb-head"><FolderGit2 size={14} aria-hidden="true" style={{ verticalAlign: '-0.16em', marginRight: 6 }} /> linked repositories</div>
              <div className="cmg-repo-note callout">
                <CircleDot size={16} aria-hidden="true" />
                <div>{collective.linkedGithubOrg ? `linked to ${collective.linkedGithubOrg}.` : 'the github connection isn\'t set up. an admin must register the github app to overlay commit timelines.'}</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   3b) COLLECTIVE SETTINGS VIEW - the governance form surface
========================================================================== */

export function CollectiveSettingsView() {
  const [name, setName] = useState('AI Research Team')
  const [description, setDescription] = useState('Sharing transcripts related to AI research')
  const [acceptanceMode, setAcceptanceMode] = useState('curated')
  const [dataAccess, setDataAccess] = useState('members_only')
  const [displayMembers, setDisplayMembers] = useState(true)
  const [deletionPolicy, setDeletionPolicy] = useState('user_choice')
  const [saved, setSaved] = useState(false)

  const roster = [
    { id: 'alice-dev', handle: '@alice-dev', name: 'Alice Developer', role: 'owner', owner: true },
    { id: 'bob-ai', handle: '@bob-ai', name: 'Bob AI', role: 'member', owner: false },
    { id: 'charlie-ml', handle: '@charlie-ml', name: 'Charlie ML', role: 'contributor', owner: false },
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="cmg-root cmg-settings">
      <div className="cmg-detail">
        <div className="crumb cmg-crumb">
          village <ChevronRight size={13} aria-hidden="true" /> collectives <ChevronRight size={13} aria-hidden="true" />
          <span className="cur">settings</span>
        </div>

        <header className="cmg-d-hero">
          <div className="cmg-d-hero-row">
            <div>
              <h2 className="cmg-title">collective settings</h2>
              <p className="cmg-deck">edit how this collective accepts contributions and shares data.</p>
            </div>
            <Tag>settings</Tag>
          </div>
        </header>

        <div className="cmg-d-grid">
          <main className="cmg-d-main">
            <form className="card cmg-settings-form" onSubmit={handleSubmit}>
              <div className="cmg-queue-head">
                <h3 className="cmg-sub">general</h3>
                {saved ? <span className="chip chip-ok">saved</span> : null}
              </div>

              <div className="cmg-settings-stack">
                <Input label="Name" id="cmg-name" value={name} onChange={(e) => setName(e.target.value)} required />
                <Textarea label="Description" id="cmg-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                <Select
                  label="Acceptance mode"
                  id="cmg-acceptance"
                  value={acceptanceMode}
                  onChange={(e) => setAcceptanceMode(e.target.value)}
                  options={[
                    { value: 'open', label: 'open - anyone can share, auto-approved' },
                    { value: 'verified_only', label: 'verified only - requires org affiliation' },
                    { value: 'curated', label: 'curated - owner must approve each share' },
                  ]}
                />
                <Select
                  label="Data access"
                  id="cmg-access"
                  value={dataAccess}
                  onChange={(e) => setDataAccess(e.target.value)}
                  options={[
                    { value: 'members_only', label: 'members only - full members can browse data' },
                    { value: 'contributors', label: 'contributors - anyone who contributes can browse' },
                    { value: 'public', label: 'public - anyone can browse the dataset' },
                  ]}
                />
                {/* .sw-stack (src/index.css): label on its own top line, the hint directly beneath
                    it, then the switch + its on/off marker sharing a third line (round 5 UAT --
                    revises round 2's single-line-everything: the user tried that, then asked for
                    the label and hint each back on their own line, keeping only the switch +
                    state marker paired on one line). Round 7 fix: the label is rendered HERE,
                    outside <Switch> (not via its `label` prop), paired to the switch via an
                    explicit id + htmlFor -- letting .sw-field's own internal <label> render
                    instead put the label inside the SAME grid columns as the switch/state, which
                    (being much wider) inflated those columns and pushed the state marker far from
                    the switch. .sw-toggle-row wraps just <Switch> in a real flex row so the
                    switch + its on/off marker size and gap independently of the label's width. */}
                <div className="sw-stack">
                  <label htmlFor="cmg-display-members" className="sw-label">Show the members card on the collective page</label>
                  <span className="sw-hint">When off, only owners can see the member list.</span>
                  <div className="sw-toggle-row">
                    <Switch
                      id="cmg-display-members"
                      checked={displayMembers}
                      onChange={(checked) => setDisplayMembers(checked)}
                    />
                  </div>
                </div>
                <RadioGroup
                  name="cmg-deletion-policy"
                  ariaLabel="Transcript retention on leave"
                  value={deletionPolicy}
                  onChange={setDeletionPolicy}
                  options={[
                    {
                      value: 'user_choice',
                      label: (
                        <span className="flex flex-col gap-0.5">
                          <span className="font-mono text-[14px] text-ink-2 lowercase">User&apos;s choice</span>
                          <span className="muted lowercase">Each leaving member decides whether to retract their contributions.</span>
                        </span>
                      ),
                    },
                    {
                      value: 'mandatory',
                      label: (
                        <span className="flex flex-col gap-0.5">
                          <span className="font-mono text-[14px] text-ink-2 lowercase">Mandatory</span>
                          <span className="muted lowercase">All of a leaving member&apos;s contributions are auto-retracted.</span>
                        </span>
                      ),
                    },
                  ]}
                />

                <div className="flex items-center gap-3">
                  <button type="submit" className="btn btn-sm btn-primary">save changes</button>
                  <ConfirmInline label="reset form" onConfirm={() => setSaved(false)} />
                </div>
              </div>
            </form>

            <DangerZone title="danger zone">
              <p className="mono">deleting this collective removes the governance settings and member roster.</p>
              <ConfirmInline label="delete collective" confirmLabel="delete" onConfirm={() => setSaved(false)} />
            </DangerZone>
          </main>

          <aside className="sidebar cmg-d-rail" aria-label="settings sidebar">
            {/* overflow/maxWidth wrapper matches sections-react/70-governance.jsx's RoleRoster specimen. */}
            <div style={{ overflow: 'auto', maxWidth: '100%' }}>
              <RoleRoster
                title="members"
                roles={['member', 'contributor']}
                members={roster}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   4) CONTRIBUTE VIEW — project-grouped tri-state selection + confirm step
============================================================================ */
const PROJECTS = [
  {
    id: 'village',
    name: 'village',
    branch: 'fix/auth-middleware',
    transcripts: [
      { id: 'v1', provider: 'claude-code', title: 'Debugging auth middleware with Claude Code', date: 'Jun 15', visibility: 'public' },
      { id: 'v2', provider: 'claude-code', title: 'Add OAuth provider split-button', date: 'Jun 11', visibility: 'private' },
    ],
  },
  {
    id: 'api-server',
    name: 'api-server',
    branch: 'perf/query-optimization',
    transcripts: [
      { id: 'a1', provider: 'gemini-cli', title: 'Optimizing N+1 query issues using Gemini CLI', date: 'Jun 14', visibility: 'private' },
      { id: 'a2', provider: 'gemini-cli', title: 'Index audit on the events table', date: 'Jun 09', visibility: 'public' },
    ],
  },
  {
    id: 'frontend-app',
    name: 'frontend-app',
    branch: 'main',
    transcripts: [
      { id: 'f1', provider: 'opencode', title: 'Greenfield React app setup', date: 'Jun 12', visibility: 'private' },
    ],
  },
]

const TARGET_COLLECTIVE = { name: 'AI Research Team', members: 12 }

export function ContributeView() {
  const [selected, setSelected] = useState(() => new Set(['v1']))
  const [open, setOpen] = useState(() => new Set(PROJECTS.map((p) => p.id)))
  const [confirming, setConfirming] = useState(false)

  const idToTx = useMemo(() => {
    const m = {}
    PROJECTS.forEach((p) => p.transcripts.forEach((t) => (m[t.id] = { ...t, project: p.name })))
    return m
  }, [])

  function toggleTx(id) {
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function projectState(p) {
    const ids = p.transcripts.map((t) => t.id)
    const on = ids.filter((id) => selected.has(id)).length
    if (on === 0) return 'none'
    if (on === ids.length) return 'all'
    return 'some'
  }
  function toggleProject(p) {
    const st = projectState(p)
    setSelected((s) => {
      const next = new Set(s)
      p.transcripts.forEach((t) => (st === 'all' ? next.delete(t.id) : next.add(t.id)))
      return next
    })
  }
  function toggleOpen(id) {
    setOpen((o) => {
      const next = new Set(o)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedList = [...selected].map((id) => idToTx[id]).filter(Boolean)
  const privateCount = selectedList.filter((t) => t.visibility === 'private').length

  return (
    <div className="cmg-root">
      <div className="cmg-page">
        <div className="crumb cmg-crumb">
          village <ChevronRight size={13} aria-hidden="true" /> AI Research Team <ChevronRight size={13} aria-hidden="true" /> <span className="cur">contribute</span>
        </div>
        <header className="cmg-head">
          <div>
            <h2 className="cmg-title">contribute to AI Research Team</h2>
            <p className="cmg-deck">select your own transcripts to share with this collective.</p>
          </div>
        </header>

        <section className="card cmg-contribute" aria-label="your transcripts by project">
          {PROJECTS.map((p) => {
            const st = projectState(p)
            const isOpen = open.has(p.id)
            return (
              <div key={p.id} className="cmg-proj">
                <div className="cmg-proj-head">
                  <label className="check cmg-proj-check">
                    <input
                      type="checkbox"
                      className="check-box"
                      checked={st === 'all'}
                      ref={(el) => el && (el.indeterminate = st === 'some')}
                      onChange={() => toggleProject(p)}
                      aria-label={`select all in ${p.name}`}
                    />
                  </label>
                  <button type="button" className="cmg-proj-toggle" aria-expanded={isOpen} onClick={() => toggleOpen(p.id)}>
                    {isOpen ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                    <span className="cmg-proj-name mono">{p.name}</span>
                    <span className="cmg-proj-branch mono"><GitBranch size={12} aria-hidden="true" /> {p.branch}</span>
                    <span className="cmg-proj-cnt mono tnum">{p.transcripts.length}</span>
                  </button>
                </div>
                {isOpen && (
                  <ul className="cmg-tx-list">
                    {p.transcripts.map((t) => (
                      <li key={t.id} className="cmg-tx-row">
                        <label className="check cmg-tx-check">
                          <input
                            type="checkbox"
                            className="check-box"
                            checked={selected.has(t.id)}
                            onChange={() => toggleTx(t.id)}
                            aria-label={`select ${t.title}`}
                          />
                        </label>
                        <span className="cmg-pub-prov"><ProviderMark id={t.provider} /></span>
                        <span className="cmg-tx-title">{t.title}</span>
                        <VisibilityEye v={t.visibility} />
                        <span className="cmg-tx-date mono tnum">{t.date}</span>
                        <button type="button" className="btn btn-sm btn-icon btn-ghost" aria-label={`preview ${t.title}`}><ExternalLink size={14} aria-hidden="true" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </section>

        <div className="cmg-contribute-foot">
          <span className="cmg-sel-count mono">
            <span className="tnum">{selected.size}</span> selected
            {privateCount > 0 ? <span className="cmg-sel-warn"> · <span className="tnum">{privateCount}</span> private</span> : null}
          </span>
          <button type="button" className="btn btn-sm btn-primary" disabled={selected.size === 0} onClick={() => setConfirming(true)}>
            <Upload size={14} aria-hidden="true" /> contribute {selected.size} transcript{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>

      {/* contribute-confirm (kit ConsentDialog — focus-trap/esc/scrim/return-focus for free).
          consent gate is required only when private transcripts flip to shared. */}
      <ConsentDialog
        open={confirming}
        title={<>make {privateCount > 1 ? 'these' : 'this'} visible?</>}
        intro={
          privateCount > 0 ? (
            <p>
              <span className="tnum">{privateCount}</span> private transcript{privateCount === 1 ? '' : 's'} will become visible to members
              of <b>{TARGET_COLLECTIVE.name}</b>. visibility will change from private to shared.
            </p>
          ) : (
            <p>contributing {selected.size} already-visible transcript{selected.size === 1 ? '' : 's'}. no visibility change.</p>
          )
        }
        axes={[
          {
            icon: Eye,
            key: 'visibility',
            value: privateCount > 0 ? 'private → shared' : 'unchanged',
            scope: privateCount > 0 ? `${privateCount} transcript${privateCount === 1 ? '' : 's'} newly exposed` : 'no visibility change',
            tone: privateCount > 0 ? 'reveal' : 'open',
          },
          {
            icon: Users,
            key: 'shared with',
            value: TARGET_COLLECTIVE.name,
            scope: `${TARGET_COLLECTIVE.members} members can see it`,
            tone: 'open',
          },
        ]}
        requireConsent={privateCount > 0}
        confirmLabel={privateCount > 0 ? 'contribute & make visible' : 'contribute'}
        confirmIcon={ArrowRight}
        onCancel={() => setConfirming(false)}
        onConfirm={() => setConfirming(false)}
      >
        <ul className="cmg-confirm-list">
          {selectedList.slice(0, 5).map((t) => (
            <li key={t.id} className="cmg-confirm-tx">
              <ProviderMark id={t.provider} />
              <span className="cmg-confirm-title">{t.title}</span>
              <VisibilityEye v={t.visibility} />
            </li>
          ))}
          {selectedList.length > 5 ? <li className="cmg-confirm-more mono">…and {selectedList.length - 5} more</li> : null}
        </ul>
      </ConsentDialog>
    </div>
  )
}

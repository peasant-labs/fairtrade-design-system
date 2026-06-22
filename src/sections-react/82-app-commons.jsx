import { useRef, useState } from 'react'
import {
  Users, Eye, ShieldCheck, UserCheck, LogOut, Share2, Settings,
  Lock, ListChecks, UserCog, FileText, MessageSquare, Hash, Clock, Coins,
} from 'lucide-react'
import {
  ConsentDialog,
  GovTile, StatGrid, ProviderBars,
  ModerationQueue, RoleRoster,
  PolicySelect,
  VisibilitySegmented,
} from '../ui'

/* 82-app-commons: ONE assembled "app shell" — the village collective hub, rebuilt entirely
   from fairtrade components. it composes the governance / KPI / roster / moderation pieces the
   way village/frontend/src/app/groups/[id]/page.tsx lays them out: a hero with join/leave/
   contribute/settings actions (join opens the identity-reveal ConsentDialog), a row of GovTiles,
   a StatGrid of KPI tiles, then a two-column body — left a data note + ProviderBars, right a
   ModerationQueue of pending member requests + a RoleRoster. the owner's data-access PolicySelect
   and a transcript's VisibilitySegmented sit in the body as the live governance controls.

   chrome is all-lowercase; user content (the collective name "Harvest Moon", handles, org logins)
   keeps its case. layout is a token-driven CSS grid that collapses to one column well before 360px;
   wide rows are wrapped in overflow:auto. no <h1>, no always-on motion, tokens-only inline styles. */

/* ── small layout primitives (tokens only) ──────────────────────────────────── */

/* a bordered, square panel with a hairline header bar — the village "card" shape. */
function Panel({ title, count, children, style }) {
  return (
    <section
      style={{ border: 'var(--bd)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', minWidth: 0, ...style }}
    >
      {title != null && (
        <header
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)',
            padding: 'var(--sp-3)', borderBottom: 'var(--bd)', background: 'var(--surface-2)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink-2)' }}>{title}</span>
          {count != null && (
            <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)' }}>{count}</span>
          )}
        </header>
      )}
      <div style={{ minWidth: 0 }}>{children}</div>
    </section>
  )
}

/* a mono eyebrow label (lowercase chrome). */
function Eyebrow({ children }) {
  return (
    <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'lowercase', letterSpacing: '0.02em', color: 'var(--ink-3)' }}>
      {children}
    </span>
  )
}

/* ── content (the seed data for the hub) ─────────────────────────────────────── */

const GOV_TILES = [
  { key: 'access', label: 'access', value: 'members only', tone: 'amber', icon: Lock },
  { key: 'contributions', label: 'contributions', value: 'curated', icon: ListChecks },
  { key: 'role', label: 'your role', value: 'contributor', icon: UserCog },
]

const KPI_TILES = [
  { key: 'transcripts', label: 'transcripts', value: '1,284', sub: 'shared with the commons', icon: FileText },
  { key: 'tokens', label: 'tokens', value: '4.2M', sub: 'across all sessions', icon: Hash },
  { key: 'contributors', label: 'contributors', value: '38', sub: 'members & guests', icon: Users },
  { key: 'turns', label: 'turns', value: '9,610', sub: 'user ↔ assistant', icon: MessageSquare },
  { key: 'avg', label: 'avg session', value: '14m', sub: 'median wall-clock', icon: Clock },
]

const PROVIDERS = [
  { label: 'claude-code', value: 642 },
  { label: 'codex', value: 318 },
  { label: 'gemini-cli', value: 214 },
  { label: 'opencode', value: 110 },
]

const PENDING = [
  { id: 'p1', kind: 'member', who: 'mirelle-k', detail: '@orchard-collective · 24 transcripts', when: '2h ago' },
  { id: 'p2', kind: 'member', who: 'tobias.fenn', detail: '@hearthworks · 6 transcripts', when: '5h ago' },
  { id: 'p3', kind: 'member', who: 'q-Anwar', detail: 'no org · 51 transcripts', when: '1d ago' },
]

const MEMBERS = [
  { handle: 'rowan-frost', name: 'Rowan Frost', role: 'owner', owner: true, org: '@harvest-moon' },
  { handle: 'sol.delacroix', name: 'Sol Delacroix', role: 'member', org: '@orchard-collective' },
  { handle: 'mira_wen', name: 'Mira Wen', role: 'contributor', org: '@hearthworks' },
  { handle: 'dabrowski', name: 'Jan Dąbrowski', role: 'guest' },
]

/* the identity-reveal join axes — faithful to village's JoinConsentDialog: joining reveals your
   profile to OWNERS ONLY (to review membership); other members still see you as anon. */
const JOIN_AXES = [
  {
    icon: Eye,
    tone: 'reveal',
    key: 'identity',
    value: <>your profile — handle, name &amp; avatar — becomes visible</>,
    scope: 'to owners only, to review membership',
  },
  {
    icon: Users,
    key: 'to other members',
    value: <>you still appear as anon</>,
    scope: 'no handle, name, or avatar shown',
  },
]

const DATA_ACCESS_OPTIONS = [
  { value: 'members_only', label: 'members only', rationale: 'only full members can browse the commons data.' },
  { value: 'contributors', label: 'contributors', rationale: 'contribute transcripts to unlock browsing.' },
  { value: 'public', label: 'public', rationale: 'anyone with the link can browse — nothing gated.' },
]

/* ── the assembled hub ───────────────────────────────────────────────────────── */

function CommonsHub() {
  const [joinOpen, setJoinOpen] = useState(false)
  const [access, setAccess] = useState('members_only')
  const [visibility, setVisibility] = useState('shared')
  const joinTriggerRef = useRef(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', padding: 'var(--sp-5)' }}>
      {/* ── hero: name + purpose + counts, then the actions row ── */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 'var(--sp-4)',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', flex: '1 1 16rem' }}>
          {/* collective name — USER CONTENT, case preserved; display font, NOT an <h1>. */}
          <h3
            style={{
              margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'var(--fs-lg)', lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--ink-strong)',
            }}
          >
            Harvest Moon
          </h3>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', maxWidth: '52ch' }}>
            a commons for agent-assisted harvest tooling — shared transcripts, curated, members-only.
          </p>
          <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-3)' }}>
            38 members · 1,284 transcripts
          </span>
        </div>

        {/* actions: join (primary, opens the consent dialog) + leave / contribute / settings ghosts. */}
        <div role="group" aria-label="collective actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', flex: '0 0 auto' }}>
          <button
            type="button"
            ref={joinTriggerRef}
            className="btn btn-primary"
            onClick={() => setJoinOpen(true)}
          >
            <UserCheck size={16} aria-hidden="true" /> join
          </button>
          <button type="button" className="btn btn-ghost">
            <LogOut size={16} aria-hidden="true" /> leave
          </button>
          <button type="button" className="btn btn-ghost">
            <Share2 size={16} aria-hidden="true" /> contribute
          </button>
          <button type="button" className="btn btn-ghost">
            <Settings size={16} aria-hidden="true" /> settings
          </button>
        </div>
      </div>

      {/* ── governance tiles ── */}
      <div
        style={{
          display: 'grid', gap: 'var(--sp-3)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 11rem), 1fr))',
        }}
      >
        {GOV_TILES.map((t) => (
          <GovTile key={t.key} label={t.label} value={t.value} tone={t.tone} icon={t.icon} />
        ))}
      </div>

      {/* ── KPI tiles ── */}
      <StatGrid tiles={KPI_TILES} />

      {/* ── two-column body: left (data + providers) / right sidebar (moderation + roster) ── */}
      <div
        style={{
          display: 'grid', gap: 'var(--sp-5)', alignItems: 'start',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 30rem), 1fr))',
        }}
      >
        {/* left: a short data note + provider distribution + the owner's data-access control. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', minWidth: 0 }}>
          <Panel title="provider distribution">
            <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '13px', lineHeight: 1.5, color: 'var(--ink-2)', maxWidth: '52ch' }}>
                of <span className="tnum">1,284</span> shared transcripts, claude-code leads the commons; the bars
                are read by length and the written percentage, never by colour.
              </p>
              {/* wide control — keep it from overflowing the page on narrow viewports. */}
              <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                <ProviderBars data={PROVIDERS} />
              </div>
            </div>
          </Panel>

          {/* the owner's data-access setting — a governance PolicySelect (settings control). */}
          <Panel title="settings · data access">
            <div style={{ padding: 'var(--sp-4)' }}>
              <PolicySelect
                label="data access"
                name="commons-data-access"
                hint="who can browse the commons data."
                options={DATA_ACCESS_OPTIONS}
                value={access}
                onChange={setAccess}
              />
            </div>
          </Panel>

          {/* a transcript's visibility — the segmented control, server-owns "shared". */}
          <Panel title="transcript · visibility">
            <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <Eyebrow>refactor the ingest loader · shared with the commons</Eyebrow>
              <VisibilitySegmented
                value={visibility}
                onChange={setVisibility}
                sharedNote="shared with Harvest Moon — choose private or public to override."
              />
            </div>
          </Panel>
        </div>

        {/* right sidebar: pending member requests (moderation) + the member roster. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', minWidth: 0 }}>
          <ModerationQueue title="pending requests" items={PENDING} />
          <RoleRoster members={MEMBERS} title="members" />
        </div>
      </div>

      {/* the join consent dialog — rendered CLOSED; the hero "join" trigger opens it. */}
      <ConsentDialog
        open={joinOpen}
        returnFocusRef={joinTriggerRef}
        labelId="commons-join-title"
        title={<>join <span className="cns-name">Harvest Moon</span>?</>}
        intro={
          <>
            <p>
              you&apos;re currently <span className="cns-em">not discoverable</span>, so your handle is
              hidden across the commons.
            </p>
            <p>
              joining reveals your profile to the collective&apos;s <span className="cns-em">owners</span> —
              they need it to review your membership and contributions. other members still see you as anon.
            </p>
          </>
        }
        axes={JOIN_AXES}
        summaryCaption="what crosses the boundary"
        confirmLabel="reveal profile & join"
        confirmIcon={UserCheck}
        consentLabel="i understand and consent to revealing my profile to owners"
        onCancel={() => setJoinOpen(false)}
        onConfirm={() => setJoinOpen(false)}
      />
    </div>
  )
}

export function CommonsAppSection() {
  return (
    <section className="band" id="app-commons">
      <h2 className="label">rebuilt: the commons</h2>
      <div className="sub">a whole collective-hub page, assembled from the system</div>
      <p className="prose">
        village&apos;s collective hub — a hero with join / contribute / settings, governance tiles, KPI tiles, a
        provider distribution, a moderation queue and a member roster — rebuilt end to end from fairtrade
        components. the join action opens the identity-reveal consent dialog; the owner&apos;s data-access policy
        and a transcript&apos;s visibility are live controls. all chrome is lowercase; collective names and handles
        keep their case.
      </p>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">village · collective hub</span></div>
        <div className="specimen-body" style={{ padding: 0 }}>
          <CommonsHub />
        </div>
      </div>
      <div className="callout" style={{ marginTop: 'var(--sp-6)' }}>
        <ShieldCheck size={16} aria-hidden="true" />
        <div>
          one assembled page, one design language: square chrome, hairlines, the 4/8 spacing scale, amber scarce
          (the one toned governance value). every state pairs a word with its glyph — approvals, visibility, the
          consent gate — so nothing rides on colour alone.
        </div>
      </div>
    </section>
  )
}

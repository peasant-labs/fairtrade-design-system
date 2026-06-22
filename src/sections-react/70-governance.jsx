import { useRef, useState } from 'react'
import { Eye, Users, Globe, Share2, Archive, UserCheck, ShieldCheck } from 'lucide-react'
import {
  ConsentDialog,
  ConsentSummary,
  PolicySelect,
  ModerationQueue,
  ApprovalBar,
  RoleRoster,
  ConfirmInline,
  DangerZone,
  VisibilityEye,
  VisibilitySegmented,
  ScopeChip,
  FocusedModeToggle,
  RedactionReview,
  WhereDoesThisGo,
} from '../ui'

/* 70-governance: the "in use" governance & consent family on one doc band. each specimen copies
   its component's primary story example (props + realistic village/peasant data) so it renders the
   way the storybook does. every demo is rendered inert/closed by default — the ConsentDialog opens
   only on a real trigger click (the story's stateful wrapper), the moderation/roster controls drive
   local state, and nothing auto-opens or animates. wide/interactive demos are wrapped so they can
   never push the page into horizontal overflow at 360px. chrome stays lowercase; user content
   (handles, collective names, transcript titles, code) keeps its own case. */

/* the join-consent axes, verbatim from ConsentDialog's Join story: joining reveals your profile to
   owners only; other members still see you as anon. */
const JOIN_AXES = [
  {
    icon: Eye,
    tone: 'reveal',
    key: 'identity',
    value: (
      <>your profile — <span className="cns-mono">handle</span>, name &amp; avatar — becomes visible</>
    ),
    scope: 'to owners only, to review membership',
  },
  {
    icon: Users,
    key: 'to other members',
    value: <>you still appear as <span className="cns-mono">anon</span></>,
    scope: 'no handle, name, or avatar shown',
  },
]

/* the bare ConsentSummary axes block — all four governance axes at once, copied from the Summary
   story so the aligned-columns layout reads without the surrounding dialog. */
const SUMMARY_AXES = [
  {
    icon: Eye,
    tone: 'reveal',
    key: 'identity',
    value: <>profile revealed to <span className="cns-mono">owners</span></>,
    scope: 'others still see you as anon',
  },
  {
    icon: Globe,
    tone: 'open',
    key: 'data access',
    value: 'public — anyone can browse the dataset',
    scope: 'no membership required',
  },
  {
    icon: Share2,
    tone: 'reveal',
    key: 'contribution',
    value: <><span className="cns-mono">private</span> → <span className="cns-mono">shared</span></>,
    scope: 'the full record is shared',
  },
  {
    icon: Archive,
    tone: 'restricted',
    key: 'retention',
    value: 'mandatory — auto-retracted on leave',
    scope: 'set by the collective',
  },
]

/* the join dialog behind a real trigger: closed by default, opens on click, focus returns to the
   trigger on close. this is the ConsentDialog Join story's stateful wrapper, trimmed to the showcase. */
function ConsentDialogDemo() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(null)
  const triggerRef = useRef(null)
  return (
    <div className="btn-row" style={{ flexWrap: 'wrap', alignItems: 'center', gap: 'var(--sp-3)' }}>
      <button
        type="button"
        ref={triggerRef}
        className="btn btn-primary"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <UserCheck aria-hidden="true" /> join collective
      </button>
      {done && <span className="cns-list-more">{done}</span>}
      <ConsentDialog
        open={open}
        returnFocusRef={triggerRef}
        labelId="ds-gov-join-title"
        title={<>join <span className="cns-name">soil-and-syntax</span>?</>}
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
        consentLabel="i understand and consent to revealing my profile to owners"
        confirmLabel="reveal profile & join"
        confirmIcon={UserCheck}
        onCancel={() => setOpen(false)}
        onConfirm={() => { setOpen(false); setDone('joined — profile revealed to owners') }}
      />
    </div>
  )
}

/* the data-access radio policy, verbatim from PolicySelect's DataAccess story. */
const DATA_ACCESS = [
  { value: 'members_only', label: 'members only', rationale: 'full members can browse data' },
  { value: 'contributors', label: 'contributors', rationale: 'anyone who contributes can browse' },
  { value: 'public', label: 'public', rationale: 'anyone can browse the dataset' },
]

/* member-join requests for the moderation queue, verbatim from ModerationQueue's MemberRequests
   story — handles + the org each is requesting from. case preserved (user content). */
const MEMBER_REQUESTS = [
  { id: 'm1', kind: 'member', who: '@dinah-okafor', detail: 'Sequoia Robotics', when: '8m ago' },
  { id: 'm2', kind: 'member', who: '@yuki.tanaka', detail: 'Lattice AI', when: '1h ago' },
  { id: 'm3', kind: 'member', who: '@PriyaN', detail: 'Foundry Collective', when: '3h ago' },
]

/* the collective roster, verbatim from RoleRoster's Roster story: an owner-locked row above four
   members in mixed roles, two carrying an org chip. role changes + removes drive local state. */
const MEMBERS = [
  { handle: '@harvest-moon', name: 'Mara Olsson', role: 'owner', owner: true, org: 'peasant-labs' },
  { handle: '@tildeswim', name: 'Jun Park', role: 'member', org: 'peasant-labs' },
  { handle: '@root-and-branch', name: 'Avery Cole', role: 'member', org: 'commons-wg' },
  { handle: '@field-notes', name: 'Sam Devi', role: 'contributor', org: 'commons-wg' },
  { handle: '@late-frost', name: 'Robin Ek', role: 'guest' },
]

/* the live roster — role + remove are wired to local state so the controls behave in the doc. */
function RoleRosterDemo() {
  const [members, setMembers] = useState(MEMBERS)
  return (
    <RoleRoster
      members={members}
      onRole={(m, role) =>
        setMembers((list) => list.map((x) => (x.handle === m.handle ? { ...x, role } : x)))
      }
      onRemove={(m) => setMembers((list) => list.filter((x) => x.handle !== m.handle))}
    />
  )
}

/* the visibility segmented control is fully controlled — a small wrapper owns the value so the
   private | public choice is live, exactly as VisibilityControl's Segmented story drives it. */
function VisibilitySegmentedDemo() {
  const [value, setValue] = useState('public')
  return <VisibilitySegmented value={value} onChange={setValue} label="visibility" />
}

function ScopeChipDemo() {
  const [scope, setScope] = useState('file')
  return <ScopeChip scope={scope} onChange={setScope} />
}

function FocusedModeDemo() {
  const [on, setOn] = useState(false)
  return <FocusedModeToggle on={on} onToggle={setOn} />
}

/* the redaction matches, verbatim from Redaction's Default story: an api-key + email + bearer-token,
   the email pre-toggled "kept" (un-redacted) so the loud warning treatment is visible. the secret +
   redacted forms are code — mono, never lowercased. */
const MATCHES = [
  {
    id: 'r1',
    category: 'api-key',
    confidence: 0.98,
    before: 'const STRIPE_KEY = "sk_live_4eC39HqLyjWDarjtT1zdp7dc"',
    after: 'const STRIPE_KEY = "sk_live_••••••••••••••••••••dc"',
    kept: false,
  },
  {
    id: 'r2',
    category: 'email',
    confidence: 0.91,
    before: '// reported by alex.rivera@example.com on the 0.4 rollout',
    after: '// reported by ‹redacted-email› on the 0.4 rollout',
    kept: true,
  },
  {
    id: 'r3',
    category: 'bearer-token',
    confidence: 0.87,
    before: 'Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc"',
    after: 'Authorization: "Bearer ‹redacted-token›"',
    kept: false,
  },
]

/* the safe-by-default review surface — level + each match's keep/revert are controlled, so the
   parent owns the state per Redaction's Default story. */
function RedactionReviewDemo() {
  const [level, setLevel] = useState('standard')
  const [matches, setMatches] = useState(MATCHES)
  return (
    <RedactionReview
      level={level}
      onLevel={setLevel}
      matches={matches}
      onToggle={(id, kept) =>
        setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, kept } : m)))
      }
      scanned={12}
      total={12}
    />
  )
}

export function GovernanceSection() {
  return (
    <section className="band" id="ds-governance">
      <h2 className="label">governance &amp; consent</h2>
      <div className="sub">name what crosses the boundary, before it crosses</div>
      <p className="prose">governance is the moment a thing changes hands — identity revealed, data shared, a member admitted, a secret about to leave the machine. these surfaces make that moment legible: a consent dialog states exactly what crosses the boundary and to whom, policies carry a one-line rationale, approvals resolve in place as an audit trail, and a redaction review keeps the safe choice the default. state never rides on color alone, and an action this consequential never rides on a single reflexive click.</p>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>consent summary &amp; dialog</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>consent summary (axes block)</span>
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <ConsentSummary caption="governance axes" axes={SUMMARY_AXES} />
          </div>
          <span className="label" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>consent dialog (opens on click)</span>
          <ConsentDialogDemo />
          <div className="note">the dialog is closed until you press the trigger. it opens a real modal: focus is trapped inside, esc and the scrim close it, the amber primary stays disabled until you consent, and focus returns to the trigger.</div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>policy select</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <PolicySelect
              label="data access policy"
              name="ds-gov-data-access"
              variant="radio"
              options={DATA_ACCESS}
              defaultValue="members_only"
            />
          </div>
          <div className="note">a radiogroup where every option carries a one-line rationale. the marker is a drawn dot (filled when chosen), so selection never reads by color alone; arrow keys move between rows per the WAI-ARIA radiogroup pattern.</div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>moderation queue &amp; approval bar</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>member requests</span>
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <ModerationQueue
              title="pending requests"
              items={MEMBER_REQUESTS}
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
          <span className="label" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>approval bar (sticky)</span>
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <ApprovalBar
              subject={<>pending share to <strong>Harvest Moon</strong></>}
              onApprove={() => {}}
              onReject={() => {}}
            />
          </div>
          <div className="note">approve / reject resolve optimistically in place — the row swaps for an olive "approved" or clay "rejected" pill and stays as an audit trail, never removed. the action and the word stay together, so the outcome never rides on color alone.</div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>role roster, inline confirm &amp; danger zone</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>role roster</span>
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <RoleRosterDemo />
          </div>
          <span className="label" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>inline confirm</span>
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <ConfirmInline label="remove member" confirmLabel="remove" onConfirm={() => {}} />
          </div>
          <span className="label" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>danger zone</span>
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <DangerZone title="danger zone">
              <p>Deleting this collective permanently removes it and all of its membership. Shared transcripts remain owned by their authors. This cannot be undone.</p>
              <ConfirmInline label="delete collective" confirmLabel="delete" onConfirm={() => {}} />
            </DangerZone>
          </div>
          <div className="note">owner rows are locked — a lock glyph + "owner" text, no remove. destructive actions swap to an inline "remove? [yes] [cancel]" in place (never a modal that reflows the row), and the danger zone is fronted by a warning glyph + the word so the framing never rides on the clay border alone.</div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>visibility &amp; scope controls</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>visibility eye (hover / focus for the mode)</span>
          <div className="btn-row" style={{ gap: 'var(--sp-6)', alignItems: 'center', marginBottom: 'var(--sp-6)' }}>
            <VisibilityEye visibility="public" />
            <VisibilityEye visibility="private" />
            <VisibilityEye visibility="shared" sharedWith="AI Research Team" />
          </div>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>visibility segmented</span>
          <div style={{ overflow: 'auto', maxWidth: '100%', marginBottom: 'var(--sp-6)' }}>
            <VisibilitySegmentedDemo />
          </div>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>scope chip</span>
          <div style={{ overflow: 'auto', maxWidth: '100%', marginBottom: 'var(--sp-6)' }}>
            <ScopeChipDemo />
          </div>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>focused-mode toggle</span>
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <FocusedModeDemo />
          </div>
          <div className="note">every mode pairs a glyph with its word, and the segmented / scope / focus selections carry aria-pressed — so the active choice reads the same for AT and sighted users, never on color alone. the shared eye names the exact group verbatim.</div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>redaction review &amp; transparency</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>redaction review</span>
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <RedactionReviewDemo />
          </div>
          <span className="label" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>where does this go?</span>
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <WhereDoesThisGo
              destination="https://commons.fairtrade.dev/share"
              sent={['session title', 'redacted transcript', 'your handle']}
              private={['raw transcript', 'file contents', 'api keys']}
            />
          </div>
          <div className="note">redaction is safe by default: the opt-out controls are never hidden behind a click. a before→after reads as a del→add pair with a redundant −/+ glyph; "kept" means un-redacted, so it shouts with a warning icon + "will be sent". the transparency panel names the destination and splits what gets sent from what stays private before anything leaves the machine.</div>
        </div>
      </div>

      <div className="callout" style={{ marginTop: 'var(--sp-6)' }}><ShieldCheck aria-hidden="true" /><div>governance is consequential and reversible-ish, so it is gated, named, and legible without color: a consent dialog states what crosses the boundary, approvals leave an audit trail, and the safe redaction choice is the default.</div></div>
    </section>
  )
}

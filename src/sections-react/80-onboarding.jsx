import { useRef, useState } from 'react'
import { Compass } from 'lucide-react'
import {
  Tour,
  Explainer,
  Term,
  ConnectionPill,
  TeachingEmptyState,
  CliSteps,
  CommandBlock,
  SignInProviders,
  HandleClaim,
  FacetRail,
} from '../ui'

/* 80-onboarding: the teach-and-onboard families in their doc band — the guided Tour,
   the teach-in-place Explainer + Term, the local-program ConnectionState pills + teaching
   empty, the CLI getting-started steps, the SignIn front door, and the faceted FacetRail.
   each specimen copies its component's primary story so it renders verbatim; the Tour stays
   CLOSED until its trigger is clicked (it locks body scroll + portals when open, so it must
   never auto-open). chrome is lowercase; user content (handles, commands) keeps its case.
   specimens scroll rather than overflow at narrow widths. */

/* the three placeholder targets the tour spotlights — copied from Tour.stories' Scene. */
const TOUR_TARGETS = [
  { id: 'ds-tour-target-search', label: 'search', hint: 'find anything across the commons' },
  { id: 'ds-tour-target-compose', label: 'compose', hint: 'start a new contribution' },
  { id: 'ds-tour-target-account', label: 'account', hint: 'your identity & consents' },
]

const TOUR_STEPS = [
  {
    anchorId: 'ds-tour-target-search',
    title: 'search the commons',
    body: (
      <>
        start here. <span className="tour-mono">search</span> spans every collective you can
        see — transcripts, decisions, contributions — without revealing who&apos;s asking.
      </>
    ),
  },
  {
    anchorId: 'ds-tour-target-compose',
    title: 'compose a contribution',
    body: (
      <>
        when you&apos;re ready to give something back, <span className="tour-mono">compose</span>{' '}
        opens a draft. nothing crosses a boundary until you explicitly consent.
      </>
    ),
  },
  {
    anchorId: 'ds-tour-target-account',
    title: 'your account',
    body: (
      <>
        <span className="tour-mono">account</span> is where your identity and every consent you&apos;ve
        granted live — review, revoke, or stay anon at any time.
      </>
    ),
  },
]

/* the tour scene: placeholder targets + a "take the tour" trigger. the tour starts CLOSED and
   only mounts (locking body scroll + portaling) once the trigger is pressed; outcome + focus
   return mirror the story wiring. */
function TourScene() {
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const triggerRef = useRef(null)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          flexWrap: 'wrap',
          marginBottom: 'var(--sp-4)',
        }}
      >
        {TOUR_TARGETS.map((t) => (
          <div
            key={t.id}
            id={t.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-1)',
              minWidth: 160,
              padding: 'var(--sp-3) var(--sp-4)',
              border: 'var(--bd)',
              background: 'var(--surface-2)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-label)',
                textTransform: 'lowercase',
                color: 'var(--ink)',
              }}
            >
              {t.label}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', color: 'var(--ink-3)' }}>
              {t.hint}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        ref={triggerRef}
        className="btn btn-primary"
        onClick={() => { setOutcome(null); setOpen(true) }}
      >
        take the tour
      </button>

      {outcome && (
        <p style={{ marginTop: 'var(--sp-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--ink-3)' }}>
          {outcome}
        </p>
      )}

      <Tour
        steps={TOUR_STEPS}
        open={open}
        onClose={() => { setOpen(false); setOutcome('tour skipped'); triggerRef.current?.focus() }}
        onFinish={() => { setOpen(false); setOutcome('tour finished'); triggerRef.current?.focus() }}
      />
    </div>
  )
}

/* the local-program teaching empty — copied from ConnectionState.stories' INGEST_TEACH. */
const INGEST_TEACH = (
  <TeachingEmptyState
    icon={Compass}
    title="no ai work recorded yet"
    body="run the command below in your terminal. it scans this computer for your ai coding conversations — claude code, codex, and others — and shows what it finds here."
    command="peasant ingest"
  />
)

/* the real peasant getting-started flow — copied from CliOnboard.stories' PEASANT_STEPS. */
const PEASANT_STEPS = [
  {
    title: 'install',
    body: 'Install the peasant CLI with Homebrew. It runs entirely on this machine — nothing is uploaded until you choose to.',
    command: 'brew install peasant-labs/tap/peasant',
  },
  {
    title: 'ingest your transcripts',
    body: 'Scan this computer for your AI coding conversations — Claude Code, Codex, and others — and record them locally.',
    command: 'peasant ingest',
  },
  {
    title: 'open the dashboard',
    body: 'Launch the terminal dashboard to browse what was found, review each session, and set its redaction level.',
    command: 'peasant tui',
  },
  {
    title: 'contribute to the commons',
    body: 'Push the transcripts you have approved to the village, with redaction applied. You stay in control of what leaves.',
    command: 'peasant village push',
  },
]

/* the five agent providers fairtrade indexes — copied from FacetRail.stories. */
const FACET_PROVIDERS = [
  { slug: 'claude-code', count: 184 },
  { slug: 'gemini-cli', count: 92 },
  { slug: 'codex', count: 57 },
  { slug: 'opencode', count: 31 },
  { slug: 'cursor', count: 18 },
]

/* ~12 topic tags with varied counts so every weight bucket is exercised. */
const FACET_TOPICS = [
  { tag: 'refactor', count: 148 },
  { tag: 'bug', count: 121 },
  { tag: 'tests', count: 97 },
  { tag: 'css', count: 76 },
  { tag: 'storybook', count: 64 },
  { tag: 'a11y', count: 52 },
  { tag: 'tokens', count: 41 },
  { tag: 'migration', count: 33 },
  { tag: 'docs', count: 22 },
  { tag: 'deploy', count: 14 },
  { tag: 'perf', count: 9 },
  { tag: 'flaky', count: 4 },
]

/* a stateful host so the rail behaves like the real wiring — copied from FacetRail.stories'
   StatefulRail, resting with a couple of facets on so the active count + clear-all show. */
function StatefulRail() {
  const [order, setOrder] = useState('recent')
  const [activeProviders, setActiveProviders] = useState(() => new Set(['claude-code']))
  const [activeTopics, setActiveTopics] = useState(() => new Set(['tests']))

  const toggle = (set, key) => {
    const next = new Set(set)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  }

  return (
    <FacetRail
      order={order}
      onOrder={setOrder}
      providers={FACET_PROVIDERS}
      activeProviders={activeProviders}
      onProvider={(slug) => setActiveProviders((s) => toggle(s, slug))}
      topics={FACET_TOPICS}
      activeTopics={activeTopics}
      onTopic={(tag) => setActiveTopics((s) => toggle(s, tag))}
      onClear={() => {
        setActiveProviders(new Set())
        setActiveTopics(new Set())
      }}
    />
  )
}

/* every specimen body scrolls rather than pushing the page wide at 360px. */
const SPECIMEN_FIT = { overflow: 'auto', maxWidth: '100%' }
const H3 = { marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }

export function OnboardingSection() {
  return (
    <section className="band" id="ds-onboarding">
      <h2 className="label">onboarding &amp; teaching</h2>
      <div className="sub">how the product introduces itself</div>
      <p className="prose">first contact is a teaching moment. a guided tour spotlights the surface one anchor at a time; an explainer answers &ldquo;what am i looking at?&rdquo; in place; connection pills and a teaching empty turn a blank screen into a next step; the cli steps and the sign-in front door get a new person from install to a claimed handle. chrome stays lowercase, but handles and commands keep their own case.</p>

      <h3 className="label" style={H3}>tour</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={SPECIMEN_FIT}>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>guided spotlight (closed until you take it)</span>
          <TourScene />
          <div className="note">the tour stays closed until &ldquo;take the tour&rdquo; is pressed; opening it dims everything but the current anchor, traps focus, and esc returns focus to the trigger.</div>
        </div>
      </div>

      <h3 className="label" style={H3}>explainer &amp; term</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={SPECIMEN_FIT}>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>teach in place — never a modal</span>
          <Explainer title="what am i looking at?" defaultOpen>
            <p>
              this is a <Term def="every square is one file; its size is the file's line count, its fill the test coverage.">code-map</Term>{' '}
              of the repository — one square per file, sized by length and shaded by how well it&apos;s tested.
            </p>
            <p>
              hover a square to trace it back to its module:{' '}
              <Term def="the ability to follow a file back to the change, author, and reasoning that produced it.">traceability</Term>{' '}
              runs both ways. the heavier the fill, the higher the{' '}
              <Term def="the share of a file's lines exercised by the test suite, 0 to 100 percent.">coverage</Term>.
            </p>
          </Explainer>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--fs-body)',
              lineHeight: 1.6,
              color: 'var(--ink-2)',
              margin: 'var(--sp-4) 0 0',
            }}
          >
            a contribution enters the{' '}
            <Term def="the shared, public pool of transcripts everyone can learn from.">commons</Term>{' '}
            only after you{' '}
            <Term def="removing names, secrets, and anything sensitive before the data leaves your machine.">redact</Term>{' '}
            it locally — nothing is uploaded until you confirm. each example carries{' '}
            <Term def="short tags that let others find the right examples by task, tool, or outcome.">labels</Term>{' '}
            so the collective stays searchable.
          </p>
        </div>
      </div>

      <h3 className="label" style={H3}>connection state</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={SPECIMEN_FIT}>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>local-program pills (state reads without color)</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
            <ConnectionPill status="live" />
            <ConnectionPill status="connecting" />
            <ConnectionPill status="disconnected" />
          </div>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>teaching empty (connected, nothing recorded yet)</span>
          {INGEST_TEACH}
        </div>
      </div>

      <h3 className="label" style={H3}>cli onboard</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={SPECIMEN_FIT}>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>getting-started steps (install → ingest → tui → push)</span>
          <CliSteps steps={PEASANT_STEPS} />
          <span className="label" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>a single command block</span>
          <CommandBlock command="peasant village push" />
        </div>
      </div>

      <h3 className="label" style={H3}>sign in</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={SPECIMEN_FIT}>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>provider split button (github + the rest in a menu)</span>
          <div style={{ marginBottom: 'var(--sp-6)' }}>
            <SignInProviders />
          </div>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>handle claim (live validation, case preserved)</span>
          <HandleClaim suggestedFrom="octocat" />
        </div>
      </div>

      <h3 className="label" style={H3}>facet rail</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={SPECIMEN_FIT}>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>faceted filter rail (order, providers, topic cloud)</span>
          <StatefulRail />
        </div>
      </div>
    </section>
  )
}

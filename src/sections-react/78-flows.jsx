import { Boxes, MessagesSquare, ListTree, Filter } from 'lucide-react'
import {
  StepWizard,
  StepIndicator,
  RailShell,
  RailSection,
  SplitRail,
  GroupedMultiSelect,
} from '../ui'

/* 78-flows: the doc band for the "in use" flow/shell composites — the multi-step wizard +
   its rail, the canvas + sticky-rail app-shell (and its dual-rail variant), and the grouped
   tri-state multi-select. each specimen COPIES the component's primary story so it renders the
   same working example. all chrome is lowercase; user content (project + session titles) keeps
   its case. specimens are width/height-bounded so nothing overflows the page at 360px. */

/* ── StepWizard: the four-step "contribute to the commons" flow + the rail alone ──────── */

const WIZARD_STEPS = [
  { id: 'choose', label: 'choose' },
  { id: 'labels', label: 'labels' },
  { id: 'redact', label: 'redact' },
  { id: 'submit', label: 'submit' },
]

/* ── RailShell: the shared node-inspector rail (copied from the RailShell story) ──────── */

/* a tall placeholder canvas so the sticky rail has something to hold against as the bounded
   wrapper scrolls — stand-in for a real code-map / graph / table surface. */
function PlaceholderCanvas({ rows = 12 }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-4)',
        border: 'var(--bd)',
        background: 'var(--surface)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--fs-label)',
          textTransform: 'lowercase',
          color: 'var(--ink-3)',
        }}
      >
        canvas
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            height: 'var(--sp-7)',
            border: 'var(--bd)',
            background: i % 3 === 0 ? 'var(--surface-2)' : 'var(--canvas)',
          }}
        />
      ))}
    </div>
  )
}

/* the rail payload: a "node" detail section over a collapsible "conversations that built this"
   section — the two things a canvas-node inspector shows. */
function NodeRail() {
  return (
    <>
      <RailSection title="node" icon={Boxes} meta="file">
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 'var(--sp-1) var(--sp-3)',
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-label)',
          }}
        >
          <dt style={{ color: 'var(--ink-4)' }}>path</dt>
          <dd style={{ margin: 0, color: 'var(--ink)' }}>src/ui/RailShell.jsx</dd>
          <dt style={{ color: 'var(--ink-4)' }}>lines</dt>
          <dd style={{ margin: 0, color: 'var(--ink)' }}>284</dd>
          <dt style={{ color: 'var(--ink-4)' }}>coverage</dt>
          <dd style={{ margin: 0, color: 'var(--amber)' }}>72%</dd>
        </dl>
      </RailSection>

      <RailSection
        title="conversations that built this"
        icon={MessagesSquare}
        meta="3"
        collapsible
        defaultOpen
      >
        <ul
          style={{
            display: 'grid',
            gap: 'var(--sp-2)',
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}
        >
          {[
            ['port the rail shell from peasant', '2h ago'],
            ['make the bottom-sheet expand', 'yesterday'],
            ['split-rail for outline + filters', '3d ago'],
          ].map(([what, when]) => (
            <li
              key={what}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 'var(--sp-3)',
              }}
            >
              <span style={{ color: 'var(--ink)' }}>{what}</span>
              <span
                style={{
                  flex: 'none',
                  color: 'var(--ink-4)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-micro)',
                }}
              >
                {when}
              </span>
            </li>
          ))}
        </ul>
      </RailSection>
    </>
  )
}

/* ── GroupedMultiSelect: three projects with session-shaped items (copied from its story) ──
   titles are user content — verbatim case, never lowercased. */

const GMS_GROUPS = [
  {
    id: 'ingest-pipeline',
    label: 'ingest-pipeline',
    items: [
      { id: 'ip-1', label: 'Parse raw event stream into typed records', meta: '42 turns · jun 3', tokens: 2040 },
      { id: 'ip-2', label: 'Backfill historical partitions from S3', meta: '18 turns · jun 5', tokens: 1180 },
      { id: 'ip-3', label: 'Dedupe on idempotency key before write', meta: '27 turns · jun 9', tokens: 1620 },
      { id: 'ip-4', label: 'Add dead-letter queue for poison messages', meta: '31 turns · jun 12', tokens: 3290 },
    ],
  },
  {
    id: 'auth-service',
    label: 'auth-service',
    items: [
      { id: 'as-1', label: 'Rotate signing keys without downtime', meta: '22 turns · jun 4', tokens: 1530 },
      { id: 'as-2', label: 'Rate-limit the token endpoint per client', meta: '15 turns · jun 8', tokens: 980 },
      { id: 'as-3', label: 'Migrate sessions to httpOnly cookies', meta: '38 turns · jun 14', tokens: 2710 },
    ],
  },
  {
    id: 'docs-site',
    label: 'docs-site',
    items: [
      { id: 'ds-1', label: 'Rewrite the quickstart for the new CLI', meta: '12 turns · jun 6', tokens: 760 },
      { id: 'ds-2', label: 'Add dark-mode tokens to the theme', meta: '9 turns · jun 11', tokens: 540 },
    ],
  },
]

/* one project fully selected (ingest-pipeline → all four), one partial (auth-service → one),
   so the tri-state cascade reads check / dash / empty against believable numbers. */
const GMS_SEEDED = new Set(['ip-1', 'ip-2', 'ip-3', 'ip-4', 'as-1'])

export function FlowsSection() {
  return (
    <section className="band" id="ds-flows">
      <h2 className="label">flows &amp; shells</h2>
      <div className="sub">the multi-step + app-shell composites</div>
      <p className="prose">
        these are the assembled surfaces: a guided wizard with a reachability gate, the canvas
        beside a sticky inspector rail, and a grouped tri-state picker for choosing what to
        contribute. each gates its own progress: a step stays visible but locked until earned, a
        rail folds to a bottom-sheet only when the container is narrow, and a group cascades its
        selection to every session beneath it. chrome is lowercase; project and session titles keep
        their own case.
      </p>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>step wizard &amp; indicator</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={{ overflow: 'auto', maxWidth: '100%' }}>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>step indicator (rail alone, mixed states)</span>
          {/* the rail in mixed states: 2 complete (olive + check), 1 current (amber), 1 locked
              (hairline + dim, aria-disabled). controlled — onJump is a no-op here. */}
          <StepIndicator
            steps={WIZARD_STEPS}
            current="redact"
            completed={new Set(['choose', 'labels'])}
            reachable={new Set(['choose', 'labels', 'redact'])}
            onJump={() => {}}
            aria-label="contribute progress"
          />

          <span className="label" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>step wizard (interactive: working back / continue)</span>
          {/* the full flow: four steps, placeholder bodies, working continue/back. continue marks
              the step complete and unlocks the next; the gate keeps a future step visible but locked. */}
          <StepWizard
            steps={WIZARD_STEPS}
            aria-label="contribute to the commons"
            onComplete={() => {}}
          >
            <p>pick the transcripts you want to contribute to the commons.</p>
            <p>apply labels so others can find the right examples.</p>
            <p>review and redact anything sensitive before it leaves your machine.</p>
            <p>submit your contribution. thank you for feeding the collective.</p>
          </StepWizard>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>rail shell</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={{ overflow: 'auto', maxWidth: '100%' }}>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>canvas + sticky inspector rail</span>
          {/* bounded-height wrapper so the canvas scrolls and the rail stays sticky against it. the
              wrapper is at a normal (wide) width so the shell stays two-column, not the bottom-sheet. */}
          <div style={{ height: 380, overflow: 'auto', border: 'var(--bd)' }}>
            <RailShell
              toolbar={<span>node · src/ui/RailShell.jsx</span>}
              rail={<NodeRail />}
              sheetTitle="node details"
              sheetMeta="3"
            >
              <PlaceholderCanvas />
            </RailShell>
          </div>
          <div className="note">the main column scrolls while the 320px rail card stays sticky beside it; below the breakpoint the rail folds into a fixed bottom-sheet so it never compromises the desktop layout.</div>

          <span className="label" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>split rail (outline / filters, each collapsible)</span>
          {/* the dual-rail variant on its own: an outline tree on the left, filters on the right,
              each independently collapsible — side by side on desktop, stacks on mobile. */}
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <SplitRail
              leftTitle="outline"
              leftIcon={ListTree}
              leftMeta="6"
              rightTitle="filters"
              rightIcon={Filter}
              left={
                <ul
                  style={{
                    display: 'grid',
                    gap: 'var(--sp-1)',
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--fs-label)',
                    color: 'var(--ink)',
                  }}
                >
                  {['shell', '  toolbar', '  canvas', '  rail', '    node', '    history'].map((n) => (
                    <li key={n} style={{ whiteSpace: 'pre' }}>{n}</li>
                  ))}
                </ul>
              }
              right={
                <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  {['only tested files', 'changed this week', 'owned by me'].map((label) => (
                    <label
                      key={label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-2)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--fs-label)',
                        color: 'var(--ink-2)',
                      }}
                    >
                      <input type="checkbox" />
                      {label}
                    </label>
                  ))}
                </div>
              }
            />
          </div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>grouped multi-select</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body" style={{ overflow: 'auto', maxWidth: '100%' }}>
          <span className="label" style={{ marginBottom: 'var(--sp-3)' }}>tri-state project → session tree</span>
          {/* default: all groups expanded; ingest-pipeline fully selected (check), auth-service
              partial (dash). the cascade flips every session under a group; the toolbar tallies
              count + tokens. uncontrolled — defaultValue seeds the selection. */}
          <GroupedMultiSelect
            groups={GMS_GROUPS}
            defaultValue={GMS_SEEDED}
            defaultOpen={['ingest-pipeline', 'auth-service', 'docs-site']}
            tokenLabel="tokens"
          />
          <div className="note">a group box reads check when all its sessions are selected, a dash when some are; toggling the group cascades to every session beneath it.</div>
        </div>
      </div>
    </section>
  )
}

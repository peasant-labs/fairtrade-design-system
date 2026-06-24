import { expect, within } from 'storybook/test'
import {
  Phase,
  PhaseDivider,
  TaskBoundary,
  CheckpointMarker,
  TurnContextBar,
} from './TranscriptMarkers.jsx'
import { frame } from './story-frame.jsx'

/* TranscriptMarkers stories. CSF3. the orientation layer between turns — a sticky
   per-phase header (Phase + PhaseDivider), horizontal "user turn N" / git-commit
   dividers (TaskBoundary / CheckpointMarker), and a sticky prompt strip
   (TurnContextBar). tokens come from src/index.css via .storybook/preview.jsx;
   the theme toolbar flips data-theme so the backdrop blur + amber accents
   re-theme live. realistic peasant-labs transcript data throughout. */
const meta = {
  title: 'in use/TranscriptMarkers',
  component: TaskBoundary,
  tags: ['autodocs'],
  decorators: frame('wide'),
  parameters: { layout: 'padded' },
}
export default meta

/* a filler "turn" so the sticky behaviour is visible on scroll — purely demo
   chrome, not part of the component family. content keeps its natural case. */
function FillerTurn({ role, text }) {
  const isUser = role === 'user'
  return (
    <div
      style={{
        border: 'var(--bd)',
        background: isUser ? 'var(--surface-2)' : 'var(--surface)',
        borderLeft: `2px solid ${isUser ? 'var(--teal)' : 'var(--mauve)'}`,
        padding: 'var(--sp-3) var(--sp-4)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--fs-micro)',
          letterSpacing: '0.06em',
          color: isUser ? 'var(--teal)' : 'var(--mauve)',
          marginBottom: 'var(--sp-2)',
        }}
      >
        {isUser ? 'user' : 'subagent'}
      </div>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', maxWidth: '60ch' }}>{text}</p>
    </div>
  )
}

/* ── Phases — two <Phase> sections with sticky dividers + filler turns ────────
   scroll the canvas: each PhaseDivider pins below the nav while its phase is on
   screen, then hands the pinned slot to the next phase. amber marks the active
   phase. */
export const Phases = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Phase label="planning" range="turns 1–3" active stickyTop={0}>
        <FillerTurn role="user" text="Read the harvest-ledger schema and tell me where the per-plot yield gets aggregated before it hits the co-op report." />
        <FillerTurn role="subagent" text="The aggregation happens in ledger/rollup.py. Daily plot yields fold into weekly co-op totals via accumulate_plot_yields(). I'll trace the call sites." />
        <FillerTurn role="user" text="Good. Now sketch a migration that adds a fallow flag per plot without breaking the existing rollup." />
        <TaskBoundary turn={1} duration="2m 14s" tools={6} files={3} ins={48} del={12} />
      </Phase>

      <Phase label="implementation" range="turns 4–7" stickyTop={0}>
        <FillerTurn role="user" text="Apply the fallow-flag migration and update accumulate_plot_yields() to skip fallow plots." />
        <FillerTurn role="subagent" text="Added the migration, gated the rollup on plot.fallow, and backfilled the flag as false for the 1,204 existing plots." />
        <CheckpointMarker
          hash="9f3c1ab7e2"
          message="feat(ledger): skip fallow plots in weekly co-op rollup"
          time="4m ago"
          files={4}
          ins={132}
          del={37}
        />
        <FillerTurn role="user" text="Run the rollup tests and show me the first failure if there is one." />
        <FillerTurn role="subagent" text="All 38 rollup tests pass; the fallow-skip case is covered by test_rollup_excludes_fallow." />
        <TaskBoundary turn={2} duration="5m 02s" tools={14} files={4} ins={132} del={37} />
      </Phase>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // both sticky phase headers render with their ranges.
    await expect(canvas.getByText('planning')).toBeInTheDocument()
    await expect(canvas.getByText('implementation')).toBeInTheDocument()
    await expect(canvas.getByText('turns 1–3')).toBeInTheDocument()
    // the active phase is flagged for assistive tech (not colour-only).
    const planning = canvas.getByText('planning').closest('button')
    await expect(planning).toHaveAttribute('aria-current', 'true')
    // a commit message keeps its natural case (user content, never lowercased).
    await expect(
      canvas.getByText('feat(ledger): skip fallow plots in weekly co-op rollup'),
    ).toBeInTheDocument()
  },
}

/* ── TaskBoundary — the "user turn N" divider with full churn ────────────────── */
export const TaskBoundaryDivider = {
  name: 'TaskBoundary',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <TaskBoundary turn={2} duration="5m 02s" tools={14} files={4} ins={132} del={37} />
      <TaskBoundary turn={3} duration="48s" tools={2} files={1} ins={9} del={0} />
      <TaskBoundary turn={4} tools={0} files={0} ins={0} del={0} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the churn renders with real +/− glyphs, add/del split.
    await expect(canvas.getByText('+132')).toBeInTheDocument()
    await expect(canvas.getByText('−37')).toBeInTheDocument()
    // pluralization is handled (1 file, not 1 files).
    await expect(canvas.getByText('1 file')).toBeInTheDocument()
  },
}

/* ── CheckpointMarker — an inline git-commit marker between turns ────────────── */
export const Checkpoint = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <CheckpointMarker
        hash="9f3c1ab7e2"
        message="feat(ledger): skip fallow plots in weekly co-op rollup"
        time="4m ago"
        files={4}
        ins={132}
        del={37}
      />
      <CheckpointMarker
        hash="2b80d4f"
        message="fix: round co-op share to the nearest sack, not bushel"
        time="just now"
        files={1}
        ins={3}
        del={3}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the hash is truncated to a 7-char short sha.
    await expect(canvas.getByText('9f3c1ab')).toBeInTheDocument()
    // the commit message keeps its case.
    await expect(
      canvas.getByText('fix: round co-op share to the nearest sack, not bushel'),
    ).toBeInTheDocument()
  },
}

/* ── TurnContextBar — the sticky prompt strip with a next jump ───────────────── */
export const TurnContext = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <TurnContextBar
        ordinal={2}
        prompt="Apply the fallow-flag migration and update accumulate_plot_yields() to skip fallow plots, then run the rollup tests."
        onNext={() => {}}
        onJump={() => {}}
      />
      {/* no next jump (the last turn) and a longer prompt to show truncation. */}
      <TurnContextBar
        ordinal={7}
        prompt="Finally, regenerate the co-op report PDF for the spring quarter and confirm the fallow plots are excluded from every per-village subtotal as well as the grand total at the bottom of page three."
        onJump={() => {}}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the eyebrow names the active turn; the "next" affordance is present.
    await expect(canvas.getByText('next')).toBeInTheDocument()
    // the prompt is echoed verbatim (case preserved — user content).
    await expect(
      canvas.getByText(/Apply the fallow-flag migration/),
    ).toBeInTheDocument()
  },
}

/* ── Divider — the bare sticky PhaseDivider, standalone ──────────────────────── */
export const Divider = {
  name: 'PhaseDivider (standalone)',
  render: () => (
    <PhaseDivider label="verification" range="turns 8–9" active stickyTop={0} onClick={() => {}} />
  ),
}

import {
  PhaseDivider,
  Phase,
  TaskBoundary,
  CheckpointMarker,
  TurnContextBar,
  StepsWaterfall,
  EvidenceCaption,
  EvidenceTarget,
  ProviderIcon,
  ProviderTag,
  ProviderName,
  AccentLegend,
} from '../ui'

/* 76-transcript-ext: the transcript-orientation doc band. specimens copy each
   component's primary story example verbatim so they render the same here as in
   storybook. sticky pieces (Phase / PhaseDivider, TurnContextBar) live inside a
   short fixed-height scroll wrapper so position:sticky pins to that wrapper, not
   the page — they never hijack page scroll. chrome is lowercased; user content
   (prompts, commit messages) keeps its case. tokens-only inline styles. */

/* the five coding-agent harnesses, in the component's canonical order. inlined
   here (rather than imported HARNESSES) so this file only touches the ../ui
   barrel surface. */
const HARNESSES = ['claude-code', 'gemini-cli', 'codex', 'opencode', 'cursor']

/* a short scroll viewport so the sticky phase header pins to THIS box, not the
   page. fixed height + overflow:auto contains the sticky context entirely. */
const STICKY_WRAP = {
  maxHeight: 280,
  overflow: 'auto',
  maxWidth: '100%',
  border: 'var(--bd)',
  background: 'var(--surface-2)',
}

/* default specimen overflow guard: nothing escapes the page at 360px. */
const FLOW = { overflow: 'auto', maxWidth: '100%' }

/* a filler turn so the sticky phase divider has something to scroll past inside
   the wrapper — demo chrome only, copied from the TranscriptMarkers story. */
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

/* the six-task worked session from the StepsWaterfall Default story. */
const TASKS = [
  { id: 't1', index: 1, prompt: 'Refactor the ingest loader so it streams instead of buffering the whole file', durationMs: 134_000, turns: 9, outcome: 'ok' },
  { id: 't2', index: 2, prompt: 'Add a null-guard around the typecheck pass', durationMs: 22_000, turns: 2, outcome: 'ok' },
  { id: 't3', index: 3, prompt: 'Wire the stream into the pipeline and run the smoke test', durationMs: 88_000, turns: 6, outcome: 'error', error: 'test failed' },
  { id: 't4', index: 4, prompt: 'Back out the buffering path and re-run the smoke test', durationMs: 41_000, turns: 4, outcome: 'ok' },
  { id: 't5', index: 5, prompt: 'Add the sqlite pending store behind the loader', durationMs: 7_400, turns: 1, outcome: 'ok' },
  { id: 't6', index: 6, prompt: 'Write the changelog entry and bump the schema to v3', durationMs: 63_000, turns: 5, outcome: 'ok' },
]

/* the EvidenceCaption recap fragments — bracketed parts are jump targets. copied
   from the EvidenceCaption Default story. */
const FRAGMENTS = [
  { text: 'Claude converted the' },
  { text: 'eager loader', anchorId: 'tx-ec-files', label: 'the changed files' },
  { text: 'to a' },
  { text: 'channel-backed stream', anchorId: 'tx-ec-diff', label: 'the diff' },
  { text: 'after' },
  { text: 'one retry loop', anchorId: 'tx-ec-signals', label: 'the work signals' },
  { text: ', touching' },
  { text: '8 files', anchorId: 'tx-ec-files', label: 'the changed files' },
  { text: '.' },
]

export function TranscriptExtSection() {
  return (
    <section className="band" id="ds-transcript-ext">
      <h2 className="label">transcript orientation</h2>
      <div className="sub">the markers that tell you where you are in a long run</div>
      <p className="prose">a recorded session is read across phases, task boundaries and checkpoints, not just turn by turn. this band collects the orientation layer: the dividers that pin where you are, the waterfall that shows where the time went, the recap that links a sentence back to its proof, and the provider marks that tag which harness produced the run. chrome stays lowercase; prompts and commit messages keep their original case.</p>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>task boundary &amp; checkpoint</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div style={{ ...FLOW, display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            <TaskBoundary turn={2} duration="5m 02s" tools={14} files={4} ins={132} del={37} />
            <CheckpointMarker
              hash="9f3c1ab7e2"
              message="feat(ledger): skip fallow plots in weekly co-op rollup"
              time="4m ago"
              files={4}
              ins={132}
              del={37}
            />
          </div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>turn context bar</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          {/* sticky strip — pinned inside this short scroll box, never the page. */}
          <div style={STICKY_WRAP}>
            <TurnContextBar
              ordinal={2}
              prompt="Apply the fallow-flag migration and update accumulate_plot_yields() to skip fallow plots, then run the rollup tests."
              onNext={() => {}}
              onJump={() => {}}
              stickyTop={0}
            />
            <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <FillerTurn role="subagent" text="Added the migration, gated the rollup on plot.fallow, and backfilled the flag as false for the 1,204 existing plots." />
              <FillerTurn role="subagent" text="All 38 rollup tests pass; the fallow-skip case is covered by test_rollup_excludes_fallow." />
              <FillerTurn role="user" text="Good. Now regenerate the co-op report PDF and confirm the fallow plots are excluded from the grand total." />
            </div>
          </div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>phase divider</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          {/* the bare standalone divider — no sticky context needed here. */}
          <div style={{ ...FLOW, marginBottom: 'var(--sp-5)' }}>
            <PhaseDivider label="verification" range="turns 8–9" active stickyTop={0} onClick={() => {}} />
          </div>
          {/* the sticky <Phase> wrapper, contained in a short scroll box so its
              pinned header never hijacks page scroll. scroll inside to see it pin. */}
          <div style={STICKY_WRAP}>
            <Phase label="planning" range="turns 1–3" active stickyTop={0}>
              <FillerTurn role="user" text="Read the harvest-ledger schema and tell me where the per-plot yield gets aggregated before it hits the co-op report." />
              <FillerTurn role="subagent" text="The aggregation happens in ledger/rollup.py — daily plot yields fold into weekly co-op totals via accumulate_plot_yields(). I'll trace the call sites." />
              <FillerTurn role="user" text="Good. Now sketch a migration that adds a fallow flag per plot without breaking the existing rollup." />
              <TaskBoundary turn={1} duration="2m 14s" tools={6} files={3} ins={48} del={12} />
            </Phase>
            <Phase label="implementation" range="turns 4–7" stickyTop={0}>
              <FillerTurn role="user" text="Apply the fallow-flag migration and update accumulate_plot_yields() to skip fallow plots." />
              <FillerTurn role="subagent" text="Added the migration, gated the rollup on plot.fallow, and backfilled the flag as false for the 1,204 existing plots." />
            </Phase>
          </div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>steps waterfall</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div style={FLOW}>
            <StepsWaterfall tasks={TASKS} totalMs={372_000} onJump={() => {}} />
          </div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>evidence caption</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div style={FLOW}>
            <EvidenceCaption fragments={FRAGMENTS} onJump={() => {}} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
              <EvidenceTarget id="tx-ec-files" eyebrow="files">
                8 files changed across the loader and its callers — the table below lists each path with its
                added and removed line counts.
              </EvidenceTarget>
              <EvidenceTarget id="tx-ec-diff" eyebrow="diff">
                The loader's synchronous fetch was replaced with a channel-backed stream: a producer goroutine
                feeds a buffered channel that the consumer ranges over, so back-pressure is bounded.
              </EvidenceTarget>
              <EvidenceTarget id="tx-ec-signals" eyebrow="signals">
                One request took several attempts — the first stream returned a partial read, the retry loop
                re-opened the channel and completed cleanly. No other tasks needed a retry.
              </EvidenceTarget>
            </div>
          </div>
        </div>
      </div>

      <h3 className="label" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-2)' }}>provider marks, tags &amp; accent legend</h3>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
          <div style={FLOW}>
            <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>marks</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
              {HARNESSES.map((harness) => (
                <div key={harness} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                  {/* the informative mark, then the same mark tinted with its provider accent (copied from the Marks story) */}
                  <ProviderIcon harness={harness} label size={18} />
                  <ProviderIcon harness={harness} accent size={18} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-label)', color: 'var(--ink-3)' }}>{harness}</span>
                </div>
              ))}
            </div>

            <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>tags</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', marginBottom: 'var(--sp-6)' }}>
              {HARNESSES.map((harness) => (
                <ProviderTag key={harness} harness={harness} accent />
              ))}
            </div>

            <span className="label" style={{ marginBottom: 'var(--sp-2)' }}>accent legend</span>
            <AccentLegend />
          </div>
        </div>
      </div>
    </section>
  )
}

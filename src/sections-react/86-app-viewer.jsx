import { Clock, GitBranch, Hash, User } from 'lucide-react'
import {
  ProviderTag,
  AccentLegend,
  Phase,
  TaskBoundary,
  CheckpointMarker,
  TurnContextBar,
  StepsWaterfall,
  ToolCallRenderer,
  EvidenceCaption,
  EvidenceTarget,
} from '../ui'

/* 86-app-viewer: ONE assembled "app shell" — the real transcript reading view, composed from the
   in-use families rather than re-hand-rolled. the showcase is that the provider family, the
   transcript markers, the tool renderers, the duration waterfall and the evidence recap snap
   together into a working reading surface, and the per-provider accent (claude-code → amber) drives
   the assistant side throughout.

   layout: a sticky-ish reading column on the left (header → context bar → bounded scroll of phases,
   turns, tool calls, a task boundary, a checkpoint) and a right rail (the waterfall + the evidence
   recap that jumps into the rail's proof blocks). the rail collapses under the reading column on
   narrow screens via a one-column grid; every sticky piece lives INSIDE a bounded overflow:auto box
   so nothing ever pins to (or hijacks) the page.

   rules honored: all-lowercase chrome; user content (the title, prompts, code, commit message) keeps
   its case; no <h1>; tokens-only inline styles; no always-on animation; square + hairline; amber is
   scarce (the provider accent + the longest waterfall task only). */

// the harness drives the assistant accent — claude-code → amber (PROVIDER_ACCENT).
const HARNESS = 'claude-code'
const ASSISTANT = 'var(--amber)' // the provider accent for claude-code
const USER = 'var(--teal)' // the system-fixed user side

// the active user prompt, echoed verbatim by the context bar and opening the run. USER CONTENT.
const ACTIVE_PROMPT =
  'Refactor the ingest loader into a stream so sessions process at constant memory. Keep the tests green.'

/* one role-accented turn block: a left rail in the role accent, a role glyph + label + tabular turn
   number (role is carried by glyph AND word, never tint alone), then the body (case preserved). */
function Turn({ role, n, children }) {
  const isUser = role === 'user'
  const accent = isUser ? USER : ASSISTANT
  return (
    <div
      style={{
        border: 'var(--bd)',
        borderLeft: `2px solid ${accent}`,
        background: isUser ? 'var(--surface-2)' : 'var(--surface)',
        padding: 'var(--sp-3) var(--sp-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          marginBottom: 'var(--sp-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--fs-micro)',
          letterSpacing: '0.06em',
          color: accent,
        }}
      >
        {isUser ? (
          <User size={13} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <ProviderTag harness={HARNESS} accent />
        )}
        <span>{isUser ? 'user' : 'assistant'}</span>
        <span className="tnum" style={{ marginLeft: 'auto', color: 'var(--ink-4)' }}>
          turn {n}
        </span>
      </div>
      {/* body reads at reading size in the proportional face; never lowercased. */}
      <div style={{ fontSize: 'var(--fs-body)', lineHeight: 1.55, color: 'var(--ink)' }}>
        {children}
      </div>
    </div>
  )
}

// the tool calls each assistant turn made — realistic claude-code transcript shapes for ToolCallRenderer.
const READ_LOADER = {
  kind: 'read',
  name: 'Read',
  duration: 40,
  status: 'ok',
  args: {
    file: 'packages/ingest/loader.go:1-6',
    excerpt: ['package ingest', '', 'import (', '\t"io"', '\t"os"', ')'].join('\n'),
  },
}
const EDIT_STREAM = {
  kind: 'edit',
  name: 'Edit',
  duration: 120,
  status: 'ok',
  args: {
    file: 'packages/ingest/loader.go',
    old: 'buf, err := io.ReadAll(f)\nreturn parse(buf)',
    new: 'defer f.Close()\nreturn parseStream(bufio.NewReader(f))',
  },
}
const BASH_RACE = {
  kind: 'bash',
  name: 'Bash',
  duration: 8400,
  status: 'ok',
  args: {
    command: 'go test -race ./packages/ingest/...',
    output: 'ok  \tgithub.com/peasant/ingest\t8.213s',
    exitCode: 0,
  },
}

// the per-task duration waterfall (what happened, in what order). the longest task earns the amber.
const TASKS = [
  { id: 'turn-1', index: 1, prompt: ACTIVE_PROMPT, durationMs: 134_000, turns: 9, outcome: 'ok' },
  {
    id: 'turn-5',
    index: 2,
    prompt: 'Add a null-guard on the index access under strict mode, then re-run',
    durationMs: 41_000,
    turns: 4,
    outcome: 'ok',
  },
  {
    id: 'turn-9',
    index: 3,
    prompt: 'Wire the stream into the session pipeline and run the smoke test',
    durationMs: 88_000,
    turns: 6,
    outcome: 'ok',
  },
]

// the evidence recap: bracketed fragments jump to the EvidenceTargets in the rail. user content case.
const RECAP = [
  { text: 'Claude converted the' },
  { text: 'eager loader', anchorId: 'av-diff', label: 'the streaming edit' },
  { text: 'into a' },
  { text: 'channel-backed stream', anchorId: 'av-diff', label: 'the streaming edit' },
  { text: ', proved it with the' },
  { text: 'race detector', anchorId: 'av-tests', label: 'the race-detector run' },
  { text: ', and landed it in' },
  { text: 'one commit', anchorId: 'av-commit', label: 'the checkpoint commit' },
  { text: '.' },
]

export function ViewerAppSection() {
  return (
    <section className="band" id="app-viewer">
      <h2 className="label">rebuilt: the transcript viewer</h2>
      <div className="sub">the in-use families, assembled into one working reading view</div>
      <p className="prose">
        every piece the system ships for reading a recorded session — the provider chip, the phase
        and task markers, the tool-call renderers, the duration waterfall and the click-to-evidence
        recap — composed into a single transcript reading view, with the per-provider accent
        (claude-code → amber) painting the assistant side throughout.
      </p>

      <div className="specimen">
        <div className="specimen-bar">
          <span className="specimen-cap">transcript · claude-code</span>
        </div>
        <div className="specimen-body" style={{ padding: 0, overflowX: 'clip' }}>
          {/* two columns on wide screens; collapses to one (rail under reading column) at 720px and
              below via auto-fit minmax with a 100% fallback — no horizontal overflow at 360px. */}
          <div
            style={{
              display: 'grid',
              /* single column: stack reading over the rail. a 2-col auto-fit track grew to the wide
                 code/waterfall min-content and overflowed the page; stacking + per-column overflow is
                 overflow-safe at every width. */
              gridTemplateColumns: '1fr',
              alignItems: 'start',
            }}
          >
            {/* ── reading column ─────────────────────────────────────────────── */}
            <div style={{ borderBottom: 'var(--bd)', minWidth: 0, overflowX: 'auto' }}>
              {/* header: provider tag + run meta on a thin amber (provider accent) left rail. */}
              <div
                style={{
                  borderLeft: `2px solid ${ASSISTANT}`,
                  borderBottom: 'var(--bd)',
                  padding: 'var(--sp-4)',
                  background: 'var(--surface-2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 'var(--sp-3)',
                    marginBottom: 'var(--sp-2)',
                  }}
                >
                  <ProviderTag harness={HARNESS} accent />
                  <span
                    className="tnum"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--sp-1)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--fs-micro)',
                      color: 'var(--ink-3)',
                    }}
                  >
                    <GitBranch size={12} strokeWidth={1.75} aria-hidden="true" /> 18 turns
                  </span>
                  <span
                    className="tnum"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--sp-1)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--fs-micro)',
                      color: 'var(--ink-3)',
                    }}
                  >
                    <Hash size={12} strokeWidth={1.75} aria-hidden="true" /> 42,318 tokens
                  </span>
                  <span
                    className="tnum"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--sp-1)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--fs-micro)',
                      color: 'var(--ink-3)',
                    }}
                  >
                    <Clock size={12} strokeWidth={1.75} aria-hidden="true" /> 2h 14m
                  </span>
                </div>
                {/* the transcript title is user content — keep its case, never an <h1>. */}
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--fs-md)',
                    fontWeight: 700,
                    color: 'var(--ink-strong)',
                    lineHeight: 1.25,
                  }}
                >
                  Refactor the ingest loader into a stream
                </div>
              </div>

              {/* the bounded scroll area: every sticky piece (TurnContextBar, PhaseDivider) pins to
                  THIS box's top (stickyTop=0), so it can never pin to or hijack the page. */}
              <div style={{ maxHeight: '34rem', overflow: 'auto', overflowX: 'hidden' }}>
                <TurnContextBar ordinal={1} prompt={ACTIVE_PROMPT} stickyTop={0} onJump={() => {}} />

                <div style={{ padding: 'var(--sp-4)', display: 'grid', gap: 'var(--sp-4)' }}>
                  <Phase label="streaming refactor" range="turns 1–8" active stickyTop={0}>
                    <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
                      <Turn role="user" n={1}>
                        Refactor the ingest loader into a stream so sessions process at constant
                        memory. Keep the tests green.
                      </Turn>
                      <Turn role="assistant" n={2}>
                        I'll convert <b>loadAll</b> into a streaming reader so sessions are processed
                        one at a time. Reading the eager loader, then swapping it for a channel-backed
                        stream.
                        <div style={{ marginTop: 'var(--sp-3)' }}>
                          <ToolCallRenderer tool={READ_LOADER} />
                          <ToolCallRenderer tool={EDIT_STREAM} />
                        </div>
                      </Turn>
                      <Turn role="assistant" n={3}>
                        The race detector is green; wiring the stream into the session pipeline next.
                        <div style={{ marginTop: 'var(--sp-3)' }}>
                          <ToolCallRenderer tool={BASH_RACE} />
                        </div>
                      </Turn>
                    </div>
                    <CheckpointMarker
                      hash="a3f9c1ab7e2"
                      message="feat(ingest): stream the loader at constant memory"
                      time="4m ago"
                      files={2}
                      ins={64}
                      del={18}
                    />
                  </Phase>

                  <Phase label="hardening" range="turns 9–14" stickyTop={0}>
                    <TaskBoundary turn={2} duration="0h 41m" tools={7} files={2} ins={28} del={9} />
                    <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
                      <Turn role="user" n={5}>
                        Add a null-guard on the index access under strict mode, then re-run.
                      </Turn>
                      <Turn role="assistant" n={6}>
                        Guarded the index access and re-ran the suite — all 38 ingest tests pass under
                        <span style={{ fontFamily: 'var(--font-mono)' }}> -race</span>.
                      </Turn>
                    </div>
                  </Phase>
                </div>
              </div>
            </div>

            {/* ── right rail: the waterfall + the evidence recap (proof blocks) ─── */}
            <div style={{ minWidth: 0, overflowX: 'auto', display: 'grid', gap: 'var(--sp-5)', padding: 'var(--sp-4)' }}>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--fs-micro)',
                    letterSpacing: '0.06em',
                    color: 'var(--ink-3)',
                    marginBottom: 'var(--sp-3)',
                  }}
                >
                  what happened, in order
                </div>
                <StepsWaterfall tasks={TASKS} totalMs={263_000} onJump={() => {}} />
              </div>

              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--fs-micro)',
                    letterSpacing: '0.06em',
                    color: 'var(--ink-3)',
                    marginBottom: 'var(--sp-3)',
                  }}
                >
                  recap
                </div>
                <EvidenceCaption fragments={RECAP} onJump={() => {}} />

                <div style={{ display: 'grid', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
                  <EvidenceTarget id="av-diff" eyebrow="diff">
                    The loader's <span style={{ fontFamily: 'var(--font-mono)' }}>io.ReadAll</span>{' '}
                    fetch was replaced with a channel-backed stream: a producer feeds a buffered
                    channel the consumer ranges over, so memory stays bounded.
                  </EvidenceTarget>
                  <EvidenceTarget id="av-tests" eyebrow="tests">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>go test -race</span> ran green
                    across the ingest package — 38 tests, no data races reported.
                  </EvidenceTarget>
                  <EvidenceTarget id="av-commit" eyebrow="commit">
                    Landed as one checkpoint:{' '}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>a3f9c1a</span> feat(ingest):
                    stream the loader at constant memory.
                  </EvidenceTarget>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* the per-provider accent system, documented once: mark + name + swatch (never color alone). */}
      <h3 className="label">per-provider accent</h3>
      <p className="prose" style={{ marginTop: 0 }}>
        the assistant side is the agent, and the agent is the provider — so its accent varies by
        harness. claude-code wears amber here; the legend spells out the full map, and reads correctly
        with the color stripped (mark and name carry the identity, the swatch only decorates).
      </p>
      <div className="specimen">
        <div className="specimen-bar">
          <span className="specimen-cap">accent legend</span>
        </div>
        <div className="specimen-body">
          <AccentLegend />
        </div>
      </div>
    </section>
  )
}

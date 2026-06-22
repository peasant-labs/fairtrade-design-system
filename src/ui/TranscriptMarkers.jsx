/* ───────────────────────────────────────────────────────────────────────────
   TranscriptMarkers — fairtrade "in use" component family
   ─────────────────────────────────────────────────────────────────────────
   the navigation / orientation layer that sits BETWEEN turns in a transcript,
   modelled on transcript-browser's PhaseDivider / TaskBoundary / CheckpointMarker
   / TurnContextBar. four self-contained pieces that share one CSS file:

     <Phase label range>{turns}</Phase>
       a per-phase <section>. its first child is a <PhaseDivider>, rendered
       position:sticky, so the browser pins that header for exactly as long as a
       turn of this phase is on screen — when the next <Phase> scrolls up, the
       pinned slot is handed to ITS divider automatically. zero scroll math.

     <PhaseDivider label range stickyTop active />
       the sticky inline section header itself (mono label + turn-range, backdrop
       blur). usually you render <Phase>, which wires this for you; exposed
       standalone for custom layouts.

     <TaskBoundary turn duration tools files ins del />
       a horizontal "user turn N" divider: a rule + a chip carrying duration /
       tool count / files / +ins −del churn (tabular, add/del coloured, +/− glyphs).

     <CheckpointMarker hash message time files ins del />
       an inline git-commit marker between turns (commit icon + short hash + the
       commit message, dim) — the message is CONTENT, never lowercased.

     <TurnContextBar prompt ordinal onNext nextLabel stickyTop />
       a sticky strip echoing the active user turn's prompt (truncated) + a
       "next" jump button. the prompt is CONTENT, never lowercased.

   tokens only — no raw hex; raw px only for local hairline geometry with no
   token. square corners (radius 0). chrome (labels/units) is lowercased; user
   content (prompts, commit messages) keeps its case. transitions are gated
   behind prefers-reduced-motion: no-preference. every count is tabular. classes
   are namespaced `tm2-` (NOTE: `tm-` belongs to Treemap). all styling lives in
   TranscriptMarkers.css.
   ─────────────────────────────────────────────────────────────────────────── */
import { GitCommit, CheckCircle2, CornerDownLeft, Layers } from 'lucide-react'
import './TranscriptMarkers.css'

/* collapse runs of whitespace so a multi-line prompt reads as one truncated row. */
function oneLine(s) {
  return String(s ?? '').trim().replace(/\s+/g, ' ')
}

/* a churn fragment: +ins / −del, add/del coloured, tabular, with real +/− glyphs.
   returns null when there's nothing to show so callers can drop it cleanly. */
function Churn({ ins = 0, del = 0 }) {
  const a = Number(ins) || 0
  const d = Number(del) || 0
  if (a <= 0 && d <= 0) return null
  return (
    <span className="tm2-churn tnum">
      <span className="tm2-churn-add">+{a}</span>
      <span className="tm2-churn-sep" aria-hidden="true">/</span>
      <span className="tm2-churn-del">−{d}</span>
    </span>
  )
}

/* ───────────────────────────────────────────────────────────────────────────
   PhaseDivider — the sticky inline section header.
   rendered as the first child of a <Phase> <section>; position:sticky pins it
   while a turn of its phase is on screen. `range` is chrome (e.g. "turns 1–4").
   ─────────────────────────────────────────────────────────────────────────── */
export function PhaseDivider({
  label,
  range,
  active = false,
  stickyTop = 'var(--nav-h)',
  onClick,
  className = '',
  ...rest
}) {
  return (
    <div
      className={`tm2-phase${className ? ` ${className}` : ''}`}
      style={{ top: stickyTop }}
      {...rest}
    >
      <button
        type="button"
        className="tm2-phase-btn"
        onClick={onClick}
        title={range ? `${label} · ${range}` : label}
        data-active={active ? 'true' : undefined}
        aria-current={active ? 'true' : undefined}
      >
        <Layers className="lucide tm2-phase-icon" size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className="tm2-eyebrow tm2-phase-label">{label}</span>
        {range && <span className="tm2-phase-range tnum">{range}</span>}
      </button>
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────────────────
   Phase — a per-phase <section> wrapper that makes the sticky divider work.
   the divider is the FIRST child, so it pins relative to this section's box and
   un-pins exactly when the section scrolls past. children are the phase's turns.
   ─────────────────────────────────────────────────────────────────────────── */
export function Phase({
  label,
  range,
  active = false,
  stickyTop = 'var(--nav-h)',
  onLabelClick,
  children,
  className = '',
  ...rest
}) {
  return (
    <section
      className={`tm2-phase-section${className ? ` ${className}` : ''}`}
      aria-label={range ? `${label}, ${range}` : label}
      {...rest}
    >
      <PhaseDivider
        label={label}
        range={range}
        active={active}
        stickyTop={stickyTop}
        onClick={onLabelClick}
      />
      <div className="tm2-phase-body">{children}</div>
    </section>
  )
}

/* ───────────────────────────────────────────────────────────────────────────
   TaskBoundary — a horizontal "user turn N" divider with a summary chip.
   marks the moment the agent finished and the user picked the thread back up.
   ─────────────────────────────────────────────────────────────────────────── */
export function TaskBoundary({
  turn,
  duration,
  tools,
  files,
  ins = 0,
  del = 0,
  className = '',
  ...rest
}) {
  const toolCount = Number(tools) || 0
  const fileCount = Number(files) || 0
  return (
    <div
      className={`tm2-marker tm2-marker--task${className ? ` ${className}` : ''}`}
      role="separator"
      aria-label={`user turn ${turn}`}
      {...rest}
    >
      <span className="tm2-marker-rule" aria-hidden="true" />
      <div className="tm2-marker-chip">
        <CheckCircle2 className="lucide tm2-marker-icon" size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className="tm2-eyebrow tm2-marker-eyebrow">
          user turn <span className="tnum tm2-marker-ord">{turn}</span>
        </span>
        {duration && <span className="tm2-marker-meta tnum">{duration}</span>}
        {toolCount > 0 && (
          <span className="tm2-marker-meta tnum">
            {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
          </span>
        )}
        {fileCount > 0 && (
          <span className="tm2-marker-meta tnum">
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </span>
        )}
        <Churn ins={ins} del={del} />
      </div>
      <span className="tm2-marker-rule" aria-hidden="true" />
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────────────────
   CheckpointMarker — an inline git-commit marker placed between turns.
   the short hash + the commit message (CONTENT: keeps its case) + dim metadata.
   ─────────────────────────────────────────────────────────────────────────── */
export function CheckpointMarker({
  hash,
  message,
  time,
  files,
  ins = 0,
  del = 0,
  className = '',
  ...rest
}) {
  const short = String(hash ?? '').slice(0, 7)
  const fileCount = Number(files) || 0
  return (
    <div
      className={`tm2-marker tm2-marker--commit${className ? ` ${className}` : ''}`}
      role="separator"
      aria-label={`commit ${short}${message ? `: ${message}` : ''}`}
      {...rest}
    >
      <span className="tm2-marker-rule" aria-hidden="true" />
      <div className="tm2-marker-chip">
        <GitCommit className="lucide tm2-marker-icon" size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className="tm2-eyebrow tm2-marker-eyebrow">commit</span>
        {short && <code className="tm2-marker-hash tnum">{short}</code>}
        {/* the commit message is user content — NOT lowercased. */}
        {message && (
          <span className="tm2-marker-message" title={message}>
            {message}
          </span>
        )}
        {fileCount > 0 && (
          <span className="tm2-marker-meta tnum">
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </span>
        )}
        <Churn ins={ins} del={del} />
        {time && <span className="tm2-marker-meta tnum">{time}</span>}
      </div>
      <span className="tm2-marker-rule" aria-hidden="true" />
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────────────────
   TurnContextBar — a sticky strip echoing the active user turn's prompt.
   the prompt is CONTENT (keeps its case, truncated to one line); the eyebrow +
   "next" affordance are chrome. pins below the nav by default.
   ─────────────────────────────────────────────────────────────────────────── */
export function TurnContextBar({
  prompt,
  ordinal,
  onNext,
  nextLabel = 'next',
  stickyTop = 'var(--nav-h)',
  onJump,
  className = '',
  ...rest
}) {
  const text = oneLine(prompt)
  return (
    <div
      className={`tm2-contextbar${className ? ` ${className}` : ''}`}
      role="region"
      aria-label="current user turn"
      style={{ top: stickyTop }}
      {...rest}
    >
      <div className="tm2-contextbar-inner">
        <button
          type="button"
          className="tm2-contextbar-main"
          onClick={onJump}
          title={text}
          disabled={!onJump}
        >
          {ordinal != null && (
            <span className="tm2-eyebrow tm2-contextbar-eyebrow">
              user turn <span className="tnum tm2-contextbar-ord">{ordinal}</span>
            </span>
          )}
          {text && (
            <>
              <span className="tm2-contextbar-dot" aria-hidden="true">·</span>
              {/* the prompt is user content — NOT lowercased. */}
              <span className="tm2-contextbar-prompt">{text}</span>
            </>
          )}
        </button>

        {onNext && (
          <button type="button" className="tm2-eyebrow tm2-contextbar-next" onClick={onNext}>
            <span>{nextLabel}</span>
            <CornerDownLeft className="lucide tm2-contextbar-next-icon" size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

export default TaskBoundary

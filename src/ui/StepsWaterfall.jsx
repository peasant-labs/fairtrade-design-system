import { useMemo, useState } from 'react'
import { ListTree, ChevronDown, TriangleAlert } from 'lucide-react'
import './StepsWaterfall.css'

/* StepsWaterfall — a "what happened, in what order, how long" per-task timeline, ported in intent
   from peasant's StepsWaterfall. One row per TASK (a user prompt and the work until the next): a
   mono index (#1), the prompt (truncated, body font, CASE PRESERVED — it is user content), a turn/
   tool count, a horizontal DURATION BAR sized by its share of the longest task, and the formatted
   duration. Rows are buttons that call onJump(id) (e.g. scroll to that prompt turn).

   DESTINCT from an event-dot timeline: the signal is DURATION, drawn as a monochrome bar whose
   width tracks the task's length and whose intensity is a color-mix of --ink-strong over --surface
   (never hue). The single sanctioned accent is amber, scarce — it marks the longest task. Error
   tasks carry a clay marker + the word "error" + an icon, so the failure never rides on colour
   alone (WCAG 1.4.1). tokens only, hairline, mono, calm, square (radius 0). */

/** Human-readable ms duration: "4.2s", "42s", "2m 14s", "1.5h". Tabular-friendly, no leading zeros. */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const s = Math.round(ms / 1000)
  if (s < 10) return `${(ms / 1000).toFixed(1)}s`
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`
  const h = Math.floor(m / 60)
  const remM = m % 60
  return remM ? `${h}h ${remM}m` : `${h}h`
}

/** Collapse whitespace + truncate to n chars with an ellipsis. Pure display — value unchanged. */
function shorten(text, n) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

/**
 * @typedef {object} Task
 * @property {string} id - stable key; passed back to onJump (e.g. the prompt turn id).
 * @property {number} [index] - the displayed task number (#1). Falls back to row order + 1.
 * @property {string} prompt - the user prompt that opened the task (USER CONTENT — case preserved).
 * @property {number} durationMs - how long the task took, in ms (drives the bar + the label).
 * @property {number} [tools] - tool calls in the task (shown as "n tools" when no `turns`).
 * @property {number} [turns] - assistant turns in the task (shown as "n turns").
 * @property {'ok'|'error'} [outcome] - 'error' draws the clay marker + the "error" word/icon.
 * @property {string} [error] - a short error label; shown in place of "error" when present.
 */

/**
 * StepsWaterfall — render `tasks` as a duration waterfall: a header (total + count + collapse-all)
 * over a list of selectable rows, each with a monochrome duration bar.
 *
 * @param {object} props
 * @param {Task[]} props.tasks - the tasks, in order; one row each.
 * @param {(id: string) => void} [props.onJump] - called with a task id when its row is chosen.
 * @param {number} [props.totalMs] - total session time; defaults to the sum of task durations.
 * @param {boolean} [props.defaultCollapsed=false] - start with the rows collapsed.
 * @param {string} [props.label='steps by duration'] - accessible name for the list (lowercase chrome).
 * @param {string} [props.className] - extra classes appended to the root.
 */
export default function StepsWaterfall({
  tasks = [],
  onJump,
  totalMs,
  defaultCollapsed = false,
  label = 'steps by duration',
  className = '',
  ...rest
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  // The longest task drives the bar scale (and earns the scarce amber emphasis). Total falls back
  // to the sum of durations when the caller does not pass an explicit session total.
  const { maxMs, sumMs, maxId } = useMemo(() => {
    let maxMs = 0
    let sumMs = 0
    let maxId = null
    for (const t of tasks) {
      const d = Math.max(0, t.durationMs || 0)
      sumMs += d
      if (d > maxMs) {
        maxMs = d
        maxId = t.id
      }
    }
    return { maxMs, sumMs, maxId }
  }, [tasks])

  const total = Number.isFinite(totalMs) ? totalMs : sumMs
  const cls = ['swf', className].filter(Boolean).join(' ')

  if (tasks.length === 0) {
    return (
      <div className={cls} {...rest}>
        <p className="swf-empty">no steps to show.</p>
      </div>
    )
  }

  return (
    <div className={cls} {...rest}>
      {/* Header: total duration + task count + a collapse-all toggle. */}
      <div className="swf-head">
        <span className="swf-head-meta">
          <span className="swf-head-total tnum">{formatDuration(total)}</span>
          <span className="swf-head-sep" aria-hidden="true">·</span>
          <span className="swf-head-count tnum">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </span>

        <button
          type="button"
          className="swf-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls="swf-list"
          title="show or hide the per-task duration rows"
        >
          <ListTree className="swf-toggle-ic" aria-hidden="true" />
          {collapsed ? 'expand all' : 'collapse all'}
          <ChevronDown
            className={`swf-toggle-chev${collapsed ? '' : ' swf-toggle-chev-open'}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {!collapsed && (
        <ul className="swf-list" id="swf-list" aria-label={label}>
          {tasks.map((task, i) => (
            <StepRow
              key={task.id}
              task={task}
              n={task.index ?? i + 1}
              maxMs={maxMs}
              longest={task.id === maxId && maxMs > 0}
              onJump={onJump}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/** One task: the index, prompt, turn/tool count, the monochrome duration bar, and the duration. */
function StepRow({ task, n, maxMs, longest, onJump }) {
  const duration = Math.max(0, task.durationMs || 0)
  const isError = task.outcome === 'error' || Boolean(task.error)
  // Bar width is the task's share of the longest task; a 2% floor keeps tiny tasks visible.
  const widthPct = maxMs > 0 ? Math.max(2, (duration / maxMs) * 100) : 0
  // Intensity (mono) tracks the same share — longer tasks read both wider AND darker.
  const intensity = maxMs > 0 ? duration / maxMs : 0

  const count =
    task.turns != null
      ? `${task.turns} ${task.turns === 1 ? 'turn' : 'turns'}`
      : task.tools != null
        ? `${task.tools} ${task.tools === 1 ? 'tool' : 'tools'}`
        : null

  const rowCls = [
    'swf-row',
    longest && 'swf-row-longest',
    isError && 'swf-row-error',
  ]
    .filter(Boolean)
    .join(' ')

  const errorLabel = task.error || 'error'
  const ariaLabel = `step ${n}: ${shorten(task.prompt, 60)}, ${formatDuration(duration)}${
    isError ? `, ${errorLabel}` : ''
  }`

  return (
    <li className="swf-item">
      <button type="button" className={rowCls} onClick={() => onJump?.(task.id)} aria-label={ariaLabel}>
        <span className="swf-index tnum" aria-hidden="true">
          #{n}
        </span>

        <span className="swf-prompt" title={task.prompt}>
          {/* USER CONTENT — never lowercase the prompt. */}
          {shorten(task.prompt, 120) || '(untitled step)'}
        </span>

        {isError && (
          <span className="swf-error">
            <TriangleAlert className="swf-error-ic" aria-hidden="true" />
            {errorLabel}
          </span>
        )}

        {count && <span className="swf-count tnum">{count}</span>}

        {/* Monochrome duration bar: width ∝ share of the longest, intensity color-mixed over surface.
            Decorative — the duration value beside it carries the same fact for AT. */}
        <span className="swf-bar" aria-hidden="true">
          <span
            className="swf-bar-fill"
            style={{ width: `${widthPct}%`, '--swf-mix': `${Math.round(14 + intensity * 68)}%` }}
            data-error={isError || undefined}
          />
        </span>

        <span className="swf-dur tnum">{formatDuration(duration)}</span>
      </button>
    </li>
  )
}

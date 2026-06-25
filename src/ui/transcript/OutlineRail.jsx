import {
  Pencil, FileText, Play, Flag, AlertTriangle, GitCommitHorizontal, Sparkles,
  RefreshCw, RotateCcw, CornerDownRight, ChevronRight,
} from 'lucide-react'
import StepsWaterfall from '../StepsWaterfall.jsx'

/* OutlineRail — the left rail's per-tab outline, lifted verbatim from the canonical mockup
   (src/mockups/inuse/TranscriptApp.jsx:1691). DUMB: it reads the cooked slices off the
   `TranscriptViewModel` (files / highlights / annotations / tasks) and never parses wire.
   Each tab projects a different slice:
     • diffs       → edited files by churn
     • files       → every touched file, by name
     • highlights  → vm.highlights (BACKS the highlights tab)
     • annotations → the cooked friction annotations, grouped by kind
     • trace       → the per-task duration waterfall (StepsWaterfall)
   Exported as `TranscriptOutlineRail`. */

/** @typedef {import('./view-model.js').TranscriptViewModel} TranscriptViewModel */
/** @typedef {import('./view-model.js').AnnotationVM} AnnotationVM */

/* highlight kind → glyph (the cooked HighlightVM carries a semantic `kind`, not a component). */
const HIGHLIGHT_ICON = { request: Play, phase: Flag, error: AlertTriangle, checkpoint: GitCommitHorizontal, final: Sparkles }

/* annotation kind → label + glyph + tooltip (mirrors the mockup's ANNOTATION_META). */
const ANNOTATION_META = {
  error: { label: 'error', icon: AlertTriangle, tip: 'a tool returned an error or a non-zero exit code' },
  retry: { label: 'retry', icon: RefreshCw, tip: 'the same tool ran 3+ times within 5 turns' },
  revert: { label: 'reverted edit', icon: RotateCcw, tip: 'a file was edited again after an earlier change' },
  subagent: { label: 'subagent', icon: CornerDownRight, tip: 'a Task spawned a nested subagent at depth > 0' },
}
const ANNOTATION_ORDER = ['error', 'retry', 'revert', 'subagent']

/**
 * @param {object} props
 * @param {TranscriptViewModel} props.viewModel
 * @param {import('./state-capabilities.js').TranscriptTab} props.tab
 * @param {(turnIndex: number) => void} [props.onJump]
 */
export default function OutlineRail({ viewModel, tab, onJump = () => {} }) {
  const files = viewModel?.files ?? []
  const highlights = viewModel?.highlights ?? []
  /* the cooked friction annotations: prefer the analytics-derived patterns, else the per-turn
     annotations flattened off the turns (both are AnnotationVM). */
  const annotations =
    viewModel?.analytics?.patternAnnotations ?? (viewModel?.turns ?? []).flatMap((t) => t.annotations ?? [])

  if (tab === 'diffs') {
    return (
      <ul className="txn-outline">
        {files.filter((f) => f.edited).sort((a, b) => b.adds + b.dels - (a.adds + a.dels)).map((f) => (
          <li key={f.path}>
            <button type="button" className="txn-ol-row" onClick={() => onJump(f.turn ?? 0)}>
              <Pencil size={13} aria-hidden="true" />
              <span className="txn-ol-leaf mono">{f.leaf}</span>
              <span className="txn-churn tnum"><span className="txn-churn-add">+{f.adds}</span> <span className="txn-churn-del">−{f.dels}</span></span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  if (tab === 'files') {
    return (
      <ul className="txn-outline">
        {[...files].sort((a, b) => a.leaf.localeCompare(b.leaf)).map((f) => (
          <li key={f.path}>
            <button type="button" className="txn-ol-row" onClick={() => onJump(f.turn ?? 0)}>
              <FileText size={13} aria-hidden="true" />
              <span className="txn-ol-leaf mono">{f.leaf}</span>
              <span className="txn-ol-meta tnum">{f.reads}r {f.edits}e {f.writes}w</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  if (tab === 'highlights') {
    return (
      <ul className="txn-outline">
        {highlights.map((h) => {
          const Icon = HIGHLIGHT_ICON[h.kind] ?? ChevronRight
          const isStatic = h.kind === 'checkpoint'
          return (
            <li key={h.id}>
              <button type="button" className="txn-ol-row" disabled={isStatic} onClick={() => !isStatic && onJump(h.turn)}>
                <Icon size={13} aria-hidden="true" className={h.err ? 'txn-ol-err' : ''} />
                <span className="txn-ol-leaf">{h.title}</span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  if (tab === 'annotations') {
    return (
      <div className="txn-outline-grouped">
        {ANNOTATION_ORDER.map((kind) => {
          const items = annotations.filter((a) => a.kind === kind)
          if (!items.length) return null
          const meta = ANNOTATION_META[kind]
          const Icon = meta.icon
          return (
            <div key={kind} className="txn-ol-group">
              <div className="txn-ol-grouphead" title={meta.tip}><Icon size={13} aria-hidden="true" /> {meta.label} <span className="chipx-count">{items.length}</span></div>
              <ul className="txn-outline">
                {items.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="txn-ol-row" onClick={() => onJump(a.turn)}>
                      <span className="txn-ol-leaf tnum">turn {a.turn}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    )
  }

  /* trace → the per-task duration trail. Map each cooked TaskGroupVM onto a StepsWaterfall row;
     `id` is the first turn of the task so onJump scrolls there (stays on the trace tab). */
  const waterfallTasks = (viewModel?.tasks ?? []).map((t) => ({
    id: String(t.turnIndices?.[0] ?? t.index),
    index: t.index,
    prompt: t.prompt,
    durationMs: t.durationMs ?? 0,
    tools: t.tools,
    outcome: t.outcome,
    error: t.error,
  }))
  return (
    <StepsWaterfall
      className="txn-ol-waterfall"
      tasks={waterfallTasks}
      label="user turns by duration"
      onJump={(id) => onJump(Number(id))}
    />
  )
}

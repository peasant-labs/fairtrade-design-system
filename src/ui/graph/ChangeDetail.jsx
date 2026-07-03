import { useRef, useState } from 'react'
import {
  TriangleAlert,
  RotateCw,
  Coins,
  ChevronDown,
  ChevronRight,
  Tag,
  Check,
  MessageSquare,
  FileDiff,
  Hash,
  CornerDownRight,
  X,
  Box,
  Share2,
  FileText,
} from 'lucide-react'
import DiffView from '../DiffView.jsx'

/* ChangeDetail — the lifted "one line of work, told in full" surface, lifted from the demo
   GraphMap.jsx ChangeDetailView and parameterised onto the cooked ChangeDetailPayload: a
   deterministic caption with clickable proof-jump fragments, a signal band, the lines-of-work
   totals, per-file LAZY diffs (the separate ChangeDiffPayload, fetched on expand) with per-hunk
   conversation attribution rendered onto the kit <DiffView>, and an inline annotation chip + popover.

   tokens only, square, hairline, lowercase chrome, both themes free. amber is scarce (the proof
   jump + the open annotation), red (--danger) only on rule-break signals. */

const STATUS_LABEL = { M: 'changed', A: 'added', D: 'deleted', R: 'renamed' }
const STATUS_TONE = { A: 'chip-ok', M: '', D: 'chip-err', R: 'chip-warn' }
const KIND_TO_TYPE = { context: 'ctx', add: 'add', del: 'del' }

/** branch → an editorial title ("feat/map-review-contribute" → "Map review contribute"). */
function titleFromBranch(branch) {
  const leaf = branch.split('/').pop() ?? branch
  const words = leaf.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const fmtTokens = (n) => (n >= 1000 ? `≈${(n / 1000).toFixed(1)}k` : String(n))

/**
 * Map one wire ChangeDiffPayload hunk onto the kit <DiffView> hunk shape, deriving the
 * old/new gutter line numbers from oldStart/newStart + position (the wire carries only kind+text).
 * @param {import('./types.js').DiffHunkPayload} h
 */
function toKitHunk(h) {
  let oldNo = h.oldStart
  let newNo = h.newStart
  const lines = h.lines.map((l) => {
    const type = KIND_TO_TYPE[l.kind] ?? 'ctx'
    const row =
      type === 'add'
        ? { type, newNo: newNo++, text: l.text }
        : type === 'del'
          ? { type, oldNo: oldNo++, text: l.text }
          : { type, oldNo: oldNo++, newNo: newNo++, text: l.text }
    return row
  })
  // Prefer the wire's git hunk header (carries the function-context, e.g.
  // "@@ -211,3 +211,3 @@ func (p *Pipeline) Run"); fall back to a numeric range.
  const header = h.header ?? `-${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines}`
  return { header, lines }
}

/** One file's lazy diff: closed by default; opens to fetch + render hunks with per-hunk attribution. */
function DiffFile({ file, diff, open, onToggle }) {
  const status = file.status
  const convos = diff ? new Set(diff.hunks.map((h) => h.sessionId).filter(Boolean)).size : null
  return (
    <div className="gmp-file">
      <button type="button" className="gmp-file-head" aria-expanded={open} onClick={onToggle}>
        {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        <span className="mono gmp-file-path">{file.path}</span>
        <span className={'chip gmp-file-status ' + (STATUS_TONE[status] ?? '')}>{STATUS_LABEL[status] ?? status}</span>
        {convos != null && convos > 0 && (
          <span className="gmp-file-convos metaitem">
            <MessageSquare size={13} aria-hidden="true" /> <span className="tnum">{convos}</span>
          </span>
        )}
      </button>
      {open && (
        <div className="gmp-file-body">
          {!diff ? (
            <p className="gmp-diff-state mono">loading diff…</p>
          ) : diff.error ? (
            <p className="gmp-diff-state gmp-diff-error mono">{diff.error}</p>
          ) : diff.binary ? (
            <p className="gmp-diff-state mono">binary file — no textual diff.</p>
          ) : diff.hunks.length === 0 ? (
            <p className="gmp-diff-state mono">no line changes.</p>
          ) : (
            diff.hunks.map((h, i) => (
              <div key={i} className="gmp-hunk">
                {h.sessionTitle && (
                  <div className="gmp-hunk-attrib">
                    <CornerDownRight size={13} aria-hidden="true" />
                    <span className="gmp-hunk-from">from</span>
                    <span className="gmp-hunk-link">{h.sessionTitle}</span>
                    {h.sessionId && <span className="mono gmp-hunk-hash">{h.sessionId.slice(0, 7)}</span>}
                  </div>
                )}
                <DiffView file="" hunks={[toKitHunk(h)]} className="gmp-hunk-diff" />
                {diff.truncated && i === diff.hunks.length - 1 && (
                  <p className="gmp-diff-state mono">diff truncated (file exceeds the size cap).</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/**
 * @param {object} props
 * @param {import('./types.js').ChangeDetailPayload} props.payload  the cooked change-detail payload
 * @param {(file: import('./types.js').FileChangePayload) => import('./types.js').ChangeDiffPayload | null | undefined} [props.getDiff]
 *   resolve the lazy per-file diff (the separate ChangeDiffPayload) for an opened file; return
 *   null/undefined while loading, or a ChangeDiffPayload whose host-side `error` sentinel is set
 *   (with empty hunks) when the fetch failed — the surface then renders an error row, not a spinner
 * @param {string} [props.title]  editorial title; default derived from the branch name
 * @param {string} [props.annotation]  the saved user label (host-owned)
 * @param {(value: string) => void} [props.onSaveAnnotation]
 * @param {() => void} [props.onRemoveAnnotation]
 * @param {() => void} [props.onOpenMap]    the "see this work on the code map" exit (host owns the route)
 * @param {() => void} [props.onShare]      the "share … conversations" exit (host owns share UX)
 * @param {() => void} [props.onCopyRecap]  the "copy recap" exit (host owns the clipboard recap)
 * @param {Record<string, boolean>} [props.initialOpenFiles]  files open on first render (path → open?)
 */
export default function ChangeDetail({
  payload,
  getDiff,
  title,
  annotation = '',
  onSaveAnnotation,
  onRemoveAnnotation,
  onOpenMap,
  onShare,
  onCopyRecap,
  initialOpenFiles = {},
}) {
  const [openFiles, setOpenFiles] = useState(initialOpenFiles)
  const [jumpTarget, setJumpTarget] = useState(/** @type {string | null} */ (null))
  const [annotOpen, setAnnotOpen] = useState(false)
  const [annotDraft, setAnnotDraft] = useState('')
  const fileRefs = useRef(/** @type {Record<string, HTMLElement | null>} */ ({}))
  const scrollRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  const displayTitle = title ?? titleFromBranch(payload.branch)
  const conversations = payload.work.length
  const newConn = payload.newEdges.length
  const removedConn = payload.removedEdges.length

  const toggleFile = (path) => setOpenFiles((o) => ({ ...o, [path]: !o[path] }))

  function jumpTo(fragKey, filePath) {
    setJumpTarget(fragKey)
    if (filePath) {
      setOpenFiles((o) => ({ ...o, [filePath]: true }))
      const el = fileRefs.current[filePath]
      const scroller = scrollRef.current
      if (el && scroller) {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        scroller.scrollTo({ top: el.offsetTop - 12, behavior: reduce ? 'auto' : 'smooth' })
      }
    }
  }

  function saveAnnotation(e) {
    e.preventDefault()
    const v = annotDraft.trim()
    if (v) onSaveAnnotation?.(v)
    setAnnotOpen(false)
    setAnnotDraft('')
  }

  const firstFilePath = payload.files[0]?.path

  return (
    <div className="gmp-root gmp-detail-root" ref={scrollRef}>
      <div className="gmp-detail-head">
        <div className="crumb">
          review <ChevronRight size={13} aria-hidden="true" /> {payload.defaultBranch}{' '}
          <ChevronRight size={13} aria-hidden="true" /> <span className="cur">{payload.branch}</span>
        </div>
        <div className="gmp-detail-title">{displayTitle}</div>

        {/* deterministic caption with clickable proof-jump fragments. ("requests" is dropped —
            no wire backing; see the ChangeDetailPayload delta table.) */}
        <p className="gmp-caption">
          this line of work touched{' '}
          <button type="button" className={'gmp-frag' + (jumpTarget === 'files' ? ' gmp-frag-on' : '')} onClick={() => jumpTo('files', firstFilePath)}>
            {payload.filesChanged} files
          </button>{' '}
          across{' '}
          <button type="button" className={'gmp-frag' + (jumpTarget === 'conversations' ? ' gmp-frag-on' : '')} onClick={() => jumpTo('conversations')}>
            {conversations} conversations
          </button>
          , reshaping{' '}
          <button type="button" className={'gmp-frag' + (jumpTarget === 'conn' ? ' gmp-frag-on' : '')} onClick={() => jumpTo('conn')}>
            +{newConn}/−{removedConn} connections
          </button>
          .
        </p>
        <span className="gmp-caption-hint mono">click any number to jump to its proof</span>
      </div>

      {/* signal band — recurring frictions + the rule-break count (neutral facts, never a verdict). */}
      {(payload.frictions.length > 0 || payload.violations.length > 0) && (
        <div className="gmp-signals">
          {payload.frictions.map((f, i) => (
            <span key={i} className="gmp-signal">
              <RotateCw size={14} aria-hidden="true" /> {f.label} · <span className="mono">{f.file}</span> <b className="tnum">{f.count}×</b> across {f.sessions} conversations
            </span>
          ))}
          {payload.violations.length > 0 && (
            <span className="gmp-signal gmp-signal-warn">
              <TriangleAlert size={14} aria-hidden="true" /> <b className="tnum">{payload.violations.length}</b> rule breaks
            </span>
          )}
        </div>
      )}

      {/* lines-of-work totals */}
      <div className="gmp-totals">
        <span className="metaitem tnum">
          <FileDiff size={14} aria-hidden="true" /> {payload.filesChanged} files touched
        </span>
        <span className="metaitem tnum">
          <span className="gmp-add">+{newConn}</span>/<span className="gmp-del">−{removedConn}</span> connections
        </span>
        <span className="metaitem tnum">
          <Hash size={14} aria-hidden="true" /> ai wrote {fmtTokens(payload.outputTokens)} tokens
        </span>
        {payload.costUsd != null && (
          <span className="metaitem tnum">
            <Coins size={14} aria-hidden="true" /> est. spend ${payload.costUsd.toFixed(2)}
          </span>
        )}
      </div>

      {/* files changed with lazy per-file diffs */}
      <div className="gmp-detail-sec">
        <div className="sb-head gmp-detail-sechead">files changed · click a path to open its diff</div>
        <div className="gmp-files">
          {payload.files.map((f) => (
            <div key={f.path} ref={(el) => { fileRefs.current[f.path] = el }}>
              <DiffFile
                file={f}
                diff={openFiles[f.path] ? getDiff?.(f) : undefined}
                open={!!openFiles[f.path]}
                onToggle={() => toggleFile(f.path)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* inline annotation chip + popover (host-owned value) */}
      <div className="gmp-detail-sec">
        <div className="sb-head gmp-detail-sechead">your annotation</div>
        <div className="gmp-annot">
          {annotation && (
            <span className="gmp-label-chip gmp-annot-chip">
              <Tag size={12} aria-hidden="true" /> {annotation}
              <button type="button" className="gmp-annot-x" aria-label="remove annotation" onClick={() => onRemoveAnnotation?.()}>
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          )}
          <button type="button" className="gmp-annot-add" aria-expanded={annotOpen} onClick={() => setAnnotOpen((o) => !o)}>
            <Tag size={13} aria-hidden="true" /> {annotation ? 'change label' : 'add a label'}
          </button>
          {annotOpen && (
            <form className="gmp-annot-pop" onSubmit={saveAnnotation}>
              <span className="label">user.custom_label</span>
              <input
                className="input"
                type="text"
                autoFocus
                value={annotDraft}
                onChange={(e) => setAnnotDraft(e.target.value)}
                placeholder="e.g. good handoff"
                aria-label="annotation value"
              />
              <div className="gmp-annot-pop-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAnnotOpen(false)}>cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">
                  <Check size={13} aria-hidden="true" /> save
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* exits — the host owns each destination; dispatch via optional chaining so an
          un-wired host renders them inert rather than throwing. */}
      <div className="gmp-exits">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenMap?.()}>
          <Box size={14} aria-hidden="true" /> see this work on the code map
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onShare?.()}>
          <Share2 size={14} aria-hidden="true" /> share {conversations} conversations…
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCopyRecap?.()}>
          <FileText size={14} aria-hidden="true" /> copy recap
        </button>
        <code className="gmp-gitdiff mono">git diff {payload.defaultBranch}...{payload.branch}</code>
      </div>
      <p className="gmp-boundary mono">
        shows what changed and the recorded work behind it, not whether the change is correct or secure.
      </p>
    </div>
  )
}

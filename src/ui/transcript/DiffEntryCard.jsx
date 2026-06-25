import { FilePlus2, Pencil, ArrowRight } from 'lucide-react'

/* DiffEntryCard + DiffHunks — the Diffs-tab file-change card and the shared unified-diff hunk
   renderer, lifted verbatim from the canonical mockup (src/mockups/inuse/TranscriptApp.jsx
   :1665 and the inline `.txn-diff` rows the edit ToolBody + DiffEntryCard both draw). DUMB:
   both render the cooked `DiffEntryVM` / `DiffHunkVM[]` the adapter produced; neither parses
   wire.

   The adapter's dependency-free LCS diff is faithful to npm `diff`: content ending in a
   newline yields a TRAILING EMPTY line per hunk. DiffHunks TRIMS that empty line for visual
   parity — the same trim TB's primitives/DiffView.tsx:39 applied. */

/** @typedef {import('./view-model.js').DiffEntryVM} DiffEntryVM */
/** @typedef {import('./view-model.js').DiffHunkVM} DiffHunkVM */

/**
 * Render cooked diff hunks as the canonical `.txn-diff` rows. The mockup draws a single
 * `.diff` block per change, so hunks are flattened into one row list; each hunk's trailing
 * empty line (the LCS newline artifact) is trimmed first.
 * @param {object} props
 * @param {DiffHunkVM[]} [props.hunks]
 */
export function DiffHunks({ hunks }) {
  const list = Array.isArray(hunks) ? hunks : []
  const lines = list.flatMap((h) => {
    const ls = h.lines ?? []
    return ls.length > 0 && ls[ls.length - 1].text === '' ? ls.slice(0, -1) : ls
  })
  return (
    <div className="diff txn-diff">
      {lines.map((d, i) => (
        <div className={'dl ' + d.sign} key={i}>
          <span className="rail" />
          <span className="gut tnum">{d.oldNo ?? ''}</span>
          <span className="gut tnum">{d.newNo ?? ''}</span>
          <span className="sign">{d.sign === 'add' ? '+' : d.sign === 'del' ? '−' : ''}</span>
          <span className="t">{d.text}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * One Diffs-tab card: a file/turn label, the +adds/−dels churn, a jump affordance, and the
 * rendered diff hunks. Consumes a cooked `DiffEntryVM` (an entry of `vm.diffs`).
 * @param {object} props
 * @param {DiffEntryVM} [props.entry]
 * @param {boolean} [props.byTurn]      label by turn index instead of file path
 * @param {() => void} [props.onJump]
 */
export default function DiffEntryCard({ entry, byTurn = false, onJump }) {
  if (!entry) return null
  // A write (pure additions, no deletions) reads as a new file; otherwise an edit. The cooked
  // DiffEntryVM carries no tool name/kind, so classify off the diff shape itself.
  const isWrite =
    entry.dels === 0 && entry.hunks.every((h) => (h.lines ?? []).every((l) => l.sign === 'add'))
  const Icon = isWrite ? FilePlus2 : Pencil
  return (
    <div className="txn-diffentry">
      <div className="txn-de-head">
        <Icon size={14} aria-hidden="true" />
        <span className="mono txn-de-label">{byTurn ? `turn ${entry.turn}` : entry.path}</span>
        <span className="txn-churn tnum">
          <span className="txn-churn-add">+{entry.adds}</span> <span className="txn-churn-del">−{entry.dels}</span>
        </span>
        <button type="button" className="txn-jump" onClick={onJump}>
          jump to turn <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>
      <DiffHunks hunks={entry.hunks} />
    </div>
  )
}

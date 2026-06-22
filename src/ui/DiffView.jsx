import { useState } from 'react'
import { Plus, Minus, Eye, EyeOff } from 'lucide-react'
import './DiffView.css'

/* DiffView: a unified hunk diff renderer, the React port of peasant's review DiffView +
   session-detail RedactionDiffView. structured hunks (a `@@ … @@` header row, then lines),
   a left old/new line-number gutter (tabular, --ink-4), a sign gutter carrying a REDUNDANT
   +/− glyph so add/del never rides on color alone, add/del row backgrounds (--add-bg /
   --del-bg) each with a 3px left rail (--add-rail / --del-rail), and NO syntax highlighting.

   the redaction variant (variant="redaction") reads the same chassis as a before→after: a
   "del" line carries the original secret, the paired "add" line its redacted form, with a
   small category·confidence badge and a per-match keep/revert affordance. classes are
   namespaced dv-; tokens + the dv-* rules live in DiffView.css. */

const SIGN = { add: '+', del: '−', ctx: ' ' }

/** churn summary for a file header: total +adds / −dels across every hunk line. */
function churn(hunks) {
  let adds = 0
  let dels = 0
  for (const h of hunks) {
    for (const l of h.lines) {
      if (l.type === 'add') adds++
      else if (l.type === 'del') dels++
    }
  }
  return { adds, dels }
}

/**
 * one diff line row: old/new number gutters, the redundant sign glyph, then the code text.
 * code content is NEVER lowercased (the .dv-text cell opts out of the lowercase chrome).
 */
function DiffLine({ line }) {
  const { type, oldNo, newNo, text } = line
  const Glyph = type === 'add' ? Plus : type === 'del' ? Minus : null
  return (
    <div className={`dv-line dv-${type}`} role="row">
      <span className="dv-rail" aria-hidden="true" />
      <span className="dv-num dv-num-old tnum" role="cell">
        {oldNo ?? ''}
      </span>
      <span className="dv-num dv-num-new tnum" role="cell">
        {newNo ?? ''}
      </span>
      <span className="dv-sign" role="cell" aria-hidden="true">
        {Glyph ? <Glyph aria-hidden="true" /> : null}
      </span>
      <span className="dv-text" role="cell">
        {/* a non-breaking space keeps an empty line's row height; SIGN is read by AT */}
        <span className="dv-sr">{type === 'add' ? 'added: ' : type === 'del' ? 'removed: ' : ''}</span>
        {text || ' '}
      </span>
    </div>
  )
}

/**
 * a redaction match rendered as a del→add pair on the unified chassis: the original secret
 * (del) struck through, its redacted replacement (add), a category·confidence badge, and a
 * keep/revert button. "kept" un-redacts the match (the original leaves as-is) and is flagged.
 */
function RedactionMatch({ match }) {
  const { category, confidence, original, replacement, oldNo, newNo } = match
  const [kept, setKept] = useState(false)
  const low = confidence < 0.7
  // 0.98 -> "0.98"; keep two decimals, tabular, mono — matches the "api-key · 0.98" spec.
  const conf = confidence.toFixed(2)

  return (
    <div className={`dv-match${kept ? ' dv-match-kept' : ''}`}>
      <div className="dv-match-head">
        <span className={`dv-badge${low ? ' dv-badge-low' : ''}`}>
          <span className="dv-badge-cat">{category}</span>
          <span className="dv-badge-dot" aria-hidden="true">·</span>
          <span className="dv-badge-conf tnum">{conf}</span>
        </span>
        {kept && (
          <span className="dv-kept-flag">
            <EyeOff aria-hidden="true" />
            un-redacted
          </span>
        )}
        <button
          type="button"
          className="dv-keep"
          aria-pressed={kept}
          onClick={() => setKept((v) => !v)}
        >
          {kept ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
          {kept ? 'revert' : 'keep'}
        </button>
      </div>

      {/* the before→after pair: the original (del) is what would leave the machine; the
          replacement (add) is the safe redacted form. when kept, the original wins back. */}
      <div className="dv-match-pair" role="rowgroup">
        <div className={`dv-line dv-del${kept ? ' dv-line-muted' : ''}`} role="row">
          <span className="dv-rail" aria-hidden="true" />
          <span className="dv-num dv-num-old tnum" role="cell">{oldNo ?? ''}</span>
          <span className="dv-num dv-num-new tnum" role="cell" />
          <span className="dv-sign" role="cell" aria-hidden="true"><Minus aria-hidden="true" /></span>
          <span className="dv-text" role="cell">
            <span className="dv-sr">original: </span>
            <span className="dv-strike">{original}</span>
          </span>
        </div>
        <div className={`dv-line dv-add${kept ? ' dv-line-muted' : ''}`} role="row">
          <span className="dv-rail" aria-hidden="true" />
          <span className="dv-num dv-num-old tnum" role="cell" />
          <span className="dv-num dv-num-new tnum" role="cell">{newNo ?? ''}</span>
          <span className="dv-sign" role="cell" aria-hidden="true"><Plus aria-hidden="true" /></span>
          <span className="dv-text" role="cell">
            <span className="dv-sr">redacted to: </span>
            {replacement}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * DiffView — a unified hunk diff. two shapes, one chassis:
 *
 *  default:    pass `hunks` = [{ header, lines: [{ type:'add'|'del'|'ctx', oldNo, newNo, text }] }].
 *              renders a file header (path + +N/−N churn) then each hunk's `@@` row and lines.
 *
 *  redaction:  variant="redaction", pass `matches` = [{ category, confidence, original,
 *              replacement, oldNo, newNo }]. each match is a del→add pair with a category·
 *              confidence badge and a per-match keep/revert button.
 *
 * @param {object} props
 * @param {string} props.file - the file path shown in the header (mono, not lowercased)
 * @param {Array<{header?:string, lines:Array<{type:'add'|'del'|'ctx', oldNo?:number|string, newNo?:number|string, text:string}>}>} [props.hunks] - structured hunks (default variant)
 * @param {Array<{category:string, confidence:number, original:string, replacement:string, oldNo?:number|string, newNo?:number|string}>} [props.matches] - redaction matches (redaction variant)
 * @param {'default'|'redaction'} [props.variant='default']
 * @param {string} [props.className]
 */
export default function DiffView({
  file,
  hunks = [],
  matches = [],
  variant = 'default',
  className = '',
  ...rest
}) {
  const isRedaction = variant === 'redaction'
  const stats = isRedaction ? null : churn(hunks)

  const cls = ['dv', isRedaction && 'dv-redaction', className].filter(Boolean).join(' ')

  return (
    <figure className={cls} {...rest}>
      {/* file header — the one display-font line; path is content, so it keeps its case. */}
      <figcaption className="dv-head">
        <span className="dv-file">{file}</span>
        {isRedaction ? (
          <span className="dv-churn">
            <span className="dv-churn-r tnum">{matches.length}</span>
            <span className="dv-churn-label">redacted</span>
          </span>
        ) : (
          <span className="dv-churn">
            <span className="dv-churn-add tnum">+{stats.adds}</span>
            <span className="dv-churn-del tnum">−{stats.dels}</span>
          </span>
        )}
      </figcaption>

      {isRedaction ? (
        <div className="dv-body dv-matches">
          {matches.length === 0 ? (
            <p className="dv-empty">no sensitive content detected — safe to share as-is.</p>
          ) : (
            matches.map((m, i) => <RedactionMatch key={m.id ?? i} match={m} />)
          )}
        </div>
      ) : (
        <div className="dv-body" role="table" aria-label={`diff of ${file}`}>
          {hunks.length === 0 ? (
            <p className="dv-empty">no line changes.</p>
          ) : (
            hunks.map((h, hi) => (
              <div className="dv-hunk" key={hi} role="rowgroup">
                {/* hunk header — orientation, not a content line. lowercased chrome aside
                    from the literal `@@ … @@` range, which stays verbatim. */}
                <div className="dv-hunk-head" role="row">
                  <span className="dv-hunk-at" aria-hidden="true">@@</span>
                  <span className="dv-hunk-range tnum">{h.header}</span>
                  <span className="dv-hunk-at" aria-hidden="true">@@</span>
                </div>
                {h.lines.map((l, li) => (
                  <DiffLine key={li} line={l} />
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </figure>
  )
}

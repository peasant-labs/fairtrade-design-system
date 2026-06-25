import { useMemo } from 'react'

/* Markdown — the transcript's minimal inline renderer: **bold** + `code`, plain text
   otherwise. Lifted verbatim from the canonical mockup (src/mockups/inuse/TranscriptApp.jsx
   :643): the chrome stays minimal and the content keeps its case (search highlighting is the
   caller's concern). DUMB: it renders the cooked `TurnVM.content` string the adapter already
   produced (thinking already extracted) — it never parses wire and holds no transcript types. */

/**
 * @param {object} props
 * @param {string} [props.text]   the cooked markdown body (e.g. `TurnVM.content`)
 */
export default function Markdown({ text }) {
  const safe = typeof text === 'string' ? text : ''
  const parts = useMemo(() => {
    /** @type {{ t: 'text' | 'b' | 'code', v: string }[]} */
    const out = []
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
    let last = 0
    /** @type {RegExpExecArray | null} */
    let m
    while ((m = re.exec(safe))) {
      if (m.index > last) out.push({ t: 'text', v: safe.slice(last, m.index) })
      const tok = m[0]
      if (tok.startsWith('**')) out.push({ t: 'b', v: tok.slice(2, -2) })
      else out.push({ t: 'code', v: tok.slice(1, -1) })
      last = m.index + tok.length
    }
    if (last < safe.length) out.push({ t: 'text', v: safe.slice(last) })
    return out
  }, [safe])
  return (
    <div className="body txn-body">
      {parts.map((p, i) =>
        p.t === 'b' ? (
          <b key={i}>{p.v}</b>
        ) : p.t === 'code' ? (
          <code key={i} className="txn-inlinecode">{p.v}</code>
        ) : (
          <span key={i}>{p.v}</span>
        ),
      )}
    </div>
  )
}

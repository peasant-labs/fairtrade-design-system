import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

/* TaskBody — the task / subagent tool-call body, lifted verbatim from the canonical mockup
   (src/mockups/inuse/TranscriptApp.jsx:495). DUMB: it renders the cooked `ToolCallVM` (the
   parsed `args` / `output` the adapter produced); it never parses wire. Each key/value row is
   render-when-present, so a sparse wire task (the Go `Task` args carry only a subagent +
   description) degrades cleanly instead of drawing empty cells. */

/** @typedef {import('./view-model.js').ToolCallVM} ToolCallVM */

/** @param {unknown} v @returns {Record<string, unknown> | undefined} */
function rec(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? /** @type {Record<string, unknown>} */ (v)
    : undefined
}
/** @param {unknown} v @returns {string | undefined} */
function str(v) {
  return typeof v === 'string' ? v : undefined
}

/**
 * @param {object} props
 * @param {ToolCallVM} [props.tool]
 */
export default function TaskBody({ tool }) {
  const [open, setOpen] = useState(false)
  if (!tool) return null
  const a = rec(tool.args)
  const agent = str(a?.subagent_type) ?? str(a?.subagent) ?? str(a?.agent)
  const status = str(a?.status) ?? (tool.isError ? 'failed' : 'done')
  const task = str(a?.description) ?? str(a?.task) ?? tool.preview
  const owner = str(a?.owner)
  const promptBody = str(a?.prompt)
  const result = str(tool.output) ?? ''
  return (
    <div className="txn-tcbody">
      <dl className="txn-kv">
        {agent && (
          <div>
            <dt>agent</dt>
            <dd className="mono">{agent}</dd>
          </div>
        )}
        {status && (
          <div>
            <dt>status</dt>
            <dd>{status}</dd>
          </div>
        )}
        {task && (
          <div>
            <dt>task</dt>
            <dd>{task}</dd>
          </div>
        )}
        {owner && (
          <div>
            <dt>owner</dt>
            <dd className="mono">{owner}</dd>
          </div>
        )}
      </dl>
      {promptBody && <div className="txn-fetch-md">{promptBody}</div>}
      <button
        type="button"
        className="txn-details-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />} result
      </button>
      {open && <pre className="txn-code">{result}</pre>}
    </div>
  )
}

import { Terminal, Clock, Globe } from 'lucide-react'
import { DiffHunks } from './DiffEntryCard.jsx'
import TaskBody from './TaskBody.jsx'

/* ToolBody — the per-kind tool-call body, lifted verbatim from the canonical mockup
   (src/mockups/inuse/TranscriptApp.jsx:400). DUMB: it dispatches on the cooked
   `ToolCallVM.group` to one of the six lifted renderers — read / edit / bash / grep (search) /
   webfetch (fetch) / task — plus a catch-all, each reading the parsed `args` / `output` the
   adapter already cooked. It NEVER parses wire / calls JSON.parse on a wire string.

   Dispatch keys off `group` (not `kind`): the cooked ToolGroup set maps one-to-one onto the
   six renderers (`edits` covers edit+write, `tasks` has no `ToolCallKind` equivalent). */

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
/** @param {unknown} v @returns {number | undefined} */
function num(v) {
  return typeof v === 'number' ? v : undefined
}
/** humanize a duration in ms → "820ms" / "1.4s". @param {number | undefined} ms @returns {string} */
function fmtDuration(ms) {
  if (ms == null) return ''
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

/** read: file path + an optional line meta, then the excerpt. @param {{ tool: ToolCallVM }} props */
function ReadBody({ tool }) {
  const a = rec(tool.args)
  const path = tool.filePath ?? str(a?.file_path) ?? str(a?.path) ?? ''
  const excerpt = str(tool.output) ?? ''
  const offset = num(a?.offset)
  const limit = num(a?.limit)
  const lineMeta =
    offset != null && limit != null
      ? `${offset}–${offset + limit - 1}`
      : excerpt
        ? String(excerpt.split('\n').length)
        : ''
  return (
    <div className="txn-tcbody">
      <div className="txn-code-head">
        <span className="mono txn-code-path">{path}</span>
        {lineMeta && <span className="txn-code-meta tnum">lines {lineMeta}</span>}
      </div>
      <pre className="txn-code">{excerpt}</pre>
    </div>
  )
}

/** edit / write: path + churn, then the cooked diff hunks. @param {{ tool: ToolCallVM }} props */
function EditBody({ tool }) {
  const a = rec(tool.args)
  const path = tool.filePath ?? str(a?.file_path) ?? str(a?.path) ?? ''
  return (
    <div className="txn-tcbody">
      <div className="txn-diff-head">
        <span className="mono txn-code-path">{path}</span>
        <span className="txn-churn tnum">
          <span className="txn-churn-add">+{tool.adds ?? 0}</span> <span className="txn-churn-del">−{tool.dels ?? 0}</span>
        </span>
      </div>
      <DiffHunks hunks={tool.diff} />
    </div>
  )
}

/** bash: optional description, the command, an exit/duration eyebrow, then stdout. @param {{ tool: ToolCallVM }} props */
function BashBody({ tool }) {
  const a = rec(tool.args)
  const description = str(a?.description)
  const command = str(a?.command) ?? ''
  const stdout = str(tool.output) ?? ''
  const exit = tool.exitCode ?? 0
  const failed = tool.exitCode != null && tool.exitCode !== 0
  const duration = fmtDuration(tool.durationMs)
  return (
    <div className="txn-tcbody">
      {description && <div className="txn-tc-desc">{description}</div>}
      <div className="txn-term">
        <span className="txn-term-prompt">
          <Terminal size={13} aria-hidden="true" /> $
        </span>
        <span className="mono">{command}</span>
      </div>
      <div className="txn-out-eyebrow">
        <span>stdout</span>
        <span className="txn-out-badges">
          {duration && (
            <span className="txn-durbadge tnum">
              <Clock size={12} aria-hidden="true" /> {duration}
            </span>
          )}
          <span
            className={'txn-exitbadge tnum' + (failed ? ' txn-exit-failed' : '')}
            title={'exit code ' + exit}
          >
            exit {exit}
          </span>
        </span>
      </div>
      <pre className="txn-code">{stdout}</pre>
    </div>
  )
}

/** grep / search: pattern + scope (+ optional type), match count, then the results. @param {{ tool: ToolCallVM }} props */
function GrepBody({ tool }) {
  const a = rec(tool.args)
  const pattern = str(a?.pattern) ?? str(a?.query) ?? ''
  const scope = str(a?.path) ?? str(a?.glob) ?? '.'
  const glob = str(a?.type)
  const results = str(tool.output) ?? ''
  const matches = Array.isArray(tool.output)
    ? tool.output.length
    : results
      ? results.split('\n').filter((l) => l.trim() !== '').length
      : 0
  return (
    <div className="txn-tcbody">
      <div className="txn-grep-meta">
        <code className="txn-grep-pat mono">{pattern}</code>
        <span className="txn-grep-in">
          in <span className="mono">{scope}</span>
        </span>
        {glob && <span className="txn-grep-type tnum">type={glob}</span>}
        <span className="txn-grep-n tnum">{matches} matches</span>
      </div>
      <pre className="txn-code">{results}</pre>
    </div>
  )
}

/** webfetch / fetch: the url, an optional prompt, then the fetched markdown. @param {{ tool: ToolCallVM }} props */
function WebFetchBody({ tool }) {
  const a = rec(tool.args)
  const url = str(a?.url) ?? ''
  const prompt = str(a?.prompt)
  const result = str(tool.output) ?? ''
  return (
    <div className="txn-tcbody">
      <a className="link txn-url" href={url} target="_blank" rel="noreferrer">
        <Globe size={13} aria-hidden="true" /> {url}
      </a>
      {prompt && <div className="txn-tc-desc">{prompt}</div>}
      <div className="txn-fetch-md">{result}</div>
    </div>
  )
}

/** default catch-all: pretty-printed args + the result. @param {{ tool: ToolCallVM }} props */
function DefaultBody({ tool }) {
  const result = str(tool.output) ?? (tool.output != null ? JSON.stringify(tool.output, null, 2) : '')
  return (
    <div className="txn-tcbody">
      <div className="txn-out-eyebrow">
        <span>arguments</span>
      </div>
      <pre className="txn-code">{JSON.stringify(tool.args ?? {}, null, 2)}</pre>
      <div className="txn-out-eyebrow">
        <span>result</span>
      </div>
      <pre className="txn-code">{result || '—'}</pre>
    </div>
  )
}

/**
 * @param {object} props
 * @param {ToolCallVM} [props.tool]
 */
export default function ToolBody({ tool }) {
  if (!tool) return null
  switch (tool.group) {
    case 'read':
      return <ReadBody tool={tool} />
    case 'edits':
      return <EditBody tool={tool} />
    case 'bash':
      return <BashBody tool={tool} />
    case 'search':
      return <GrepBody tool={tool} />
    case 'fetch':
      return <WebFetchBody tool={tool} />
    case 'tasks':
      return <TaskBody tool={tool} />
    default:
      return <DefaultBody tool={tool} />
  }
}

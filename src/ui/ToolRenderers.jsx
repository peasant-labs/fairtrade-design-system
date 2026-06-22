import { useState } from 'react'
import {
  FileText,
  Pencil,
  FilePlus2,
  Terminal,
  Search,
  Bot,
  Globe,
  Wrench,
  Plus,
  Minus,
  Check,
  CircleAlert,
  ChevronRight,
} from 'lucide-react'
import './ToolRenderers.css'

/* ToolRenderers: the agent transcript's set of tool-call renderers, the React port of
   peasant's canvas/tool-renderers/ (rendererFor + the per-tool ReadRenderer / EditRenderer /
   … / DefaultRenderer). one <ToolCall> is the chassis: a collapsed row is a real <button>
   (aria-expanded) carrying the tool icon + name + an arg preview + duration + a status word
   (never color alone — an icon AND the word "ok"/"error"); expanding reveals the tool-specific
   body. <ToolCall> dispatches on `tool.kind` to one of eight small body renderers:

     read     file path + line range, then a numbered excerpt (line numbers tabular)
     edit     a tiny unified diff (old→new) with a redundant +/− rail per line
     write    path + line count, then a content preview block
     bash     a `$ command` block + an output block + an exit code (failure in clay, icon+word)
     grep     pattern + scope, then match lines with file:line in --ink-4
     task     a subagent spawn (agent name + status + a nested task line), mauve-keyed
     webfetch a url + a fetched title/snippet
     default  the catch-all: tool name + pretty-printed JSON args

   ALL code/args/output is var(--font-mono) (line numbers tabular-nums); chrome is lowercased
   but code CONTENT is NEVER lowercased (the .trx-code cells opt out). square corners (radius 0),
   tokens only — spacing, borders, icons, the diff palette (the add and del tokens), surfaces, ink,
   rules, and the earth accents (mauve task, clay error, teal webfetch). transitions only under
   the prefers-reduced-motion no-preference query.
   classes are namespaced `trx-`; the trx-* rules live in ToolRenderers.css. */

// each kind → its collapsed-row lucide icon. unknown kinds fall through to the wrench.
const KIND_ICON = {
  read: FileText,
  edit: Pencil,
  write: FilePlus2,
  bash: Terminal,
  grep: Search,
  task: Bot,
  webfetch: Globe,
}

/** trim + single-line + bound a string for the collapsed-row arg preview. */
function preview(s, max = 64) {
  if (!s) return ''
  const oneLine = String(s).replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? oneLine.slice(0, max - 1) + '…' : oneLine
}

/** last path segment, for a compact filename label. */
function basename(path) {
  if (!path) return ''
  const trimmed = String(path).replace(/\/+$/, '')
  const i = trimmed.lastIndexOf('/')
  return i === -1 ? trimmed : trimmed.slice(i + 1)
}

/** humanize a duration in ms → "820ms" / "1.4s" (tabular-friendly, no locale surprises). */
function fmtDuration(ms) {
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** the one-line arg preview shown collapsed, derived per kind from the tool's args. */
function argPreview(tool) {
  const a = tool.args ?? {}
  switch (tool.kind) {
    case 'read':
    case 'write':
      return a.file ?? a.file_path ?? ''
    case 'edit':
      return a.file ?? a.file_path ?? ''
    case 'bash':
      return a.command ?? ''
    case 'grep':
      return a.pattern ?? ''
    case 'task':
      return a.subagent ?? a.subagent_type ?? a.description ?? ''
    case 'webfetch':
      return a.url ?? ''
    default:
      return preview(JSON.stringify(a))
  }
}

/* ── status pill ──────────────────────────────────────────────────────────────
   status is NEVER color-only: ok = a check glyph + the word "ok"; error = an alert
   glyph + the word "error". the glyph is decorative (aria-hidden); the word carries it. */
function StatusPill({ status }) {
  const isError = status === 'error'
  const Glyph = isError ? CircleAlert : Check
  return (
    <span className={`trx-status${isError ? ' trx-status-error' : ' trx-status-ok'}`}>
      <Glyph aria-hidden="true" />
      <span className="trx-status-word">{isError ? 'error' : 'ok'}</span>
    </span>
  )
}

/* ── read ──────────────────────────────────────────────────────────────────────
   file path + an optional line range, then the excerpt as numbered code rows. line
   numbers are tabular (.tnum); code content keeps its case. */
function ReadBody({ tool }) {
  const a = tool.args ?? {}
  const path = a.file ?? a.file_path ?? '(unknown)'
  // a "stream.go:1-40" suffix on the path is the range; else fall back to offset/limit args.
  const m = /:(\d+)-(\d+)$/.exec(path)
  const cleanPath = m ? path.slice(0, m.index) : path
  const range = m
    ? `lines ${m[1]}–${m[2]}`
    : a.offset != null || a.limit != null
      ? `lines ${a.offset ?? 1}–${(a.offset ?? 1) + (a.limit ?? 1) - 1}`
      : null
  const startNo = m ? Number(m[1]) : (a.offset ?? 1)
  const lines = a.excerpt ? String(a.excerpt).split('\n') : []

  return (
    <div className="trx-body">
      <FileLine path={cleanPath} meta={range} />
      {lines.length > 0 && (
        <div className="trx-codeblock">
          {lines.map((line, i) => (
            <div className="trx-coderow" key={i}>
              <span className="trx-lineno tnum" aria-hidden="true">
                {startNo + i}
              </span>
              <span className="trx-code">{line || ' '}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── edit ──────────────────────────────────────────────────────────────────────
   a tiny unified diff: the old_string rendered as del rows, the new_string as add rows,
   each with a redundant +/− glyph rail so add/del never rides on color (matches DiffView). */
function EditBody({ tool }) {
  const a = tool.args ?? {}
  const path = a.file ?? a.file_path ?? '(unknown)'
  const oldLines = a.old != null ? String(a.old).split('\n') : []
  const newLines = a.new != null ? String(a.new).split('\n') : []

  return (
    <div className="trx-body">
      <FileLine path={path} meta={`+${newLines.length} −${oldLines.length}`} />
      <div className="trx-diff" role="table" aria-label={`diff of ${path}`}>
        {oldLines.map((line, i) => (
          <DiffRow key={`d${i}`} type="del" text={line} />
        ))}
        {newLines.map((line, i) => (
          <DiffRow key={`a${i}`} type="add" text={line} />
        ))}
        {oldLines.length === 0 && newLines.length === 0 && (
          <p className="trx-empty">no diff available.</p>
        )}
      </div>
    </div>
  )
}

/** one diff row: a +/− glyph rail (redundant cue) then the code text, never lowercased. */
function DiffRow({ type, text }) {
  const Glyph = type === 'add' ? Plus : Minus
  return (
    <div className={`trx-diffrow trx-diff-${type}`} role="row">
      <span className="trx-diff-rail" aria-hidden="true" />
      <span className="trx-diff-sign" role="cell" aria-hidden="true">
        <Glyph aria-hidden="true" />
      </span>
      <span className="trx-code trx-diff-text" role="cell">
        <span className="trx-sr">{type === 'add' ? 'added: ' : 'removed: '}</span>
        {text || ' '}
      </span>
    </div>
  )
}

/* ── write ──────────────────────────────────────────────────────────────────────
   path + a line count, then the full content as a plain mono preview block (no numbers). */
function WriteBody({ tool }) {
  const a = tool.args ?? {}
  const path = a.file ?? a.file_path ?? '(unknown)'
  const content = a.content ?? ''
  const lineCount = content ? content.split('\n').length : 0

  return (
    <div className="trx-body">
      <FileLine path={path} meta={content ? `${lineCount} lines` : null} />
      {content && (
        <pre className="trx-pre trx-code">{content}</pre>
      )}
    </div>
  )
}

/* ── bash ──────────────────────────────────────────────────────────────────────
   a `$ command` block, then the stdout block, then the exit code. a non-zero exit (or
   an error status) reads in clay with an icon + the word "failed" — never color alone. */
function BashBody({ tool }) {
  const a = tool.args ?? {}
  const command = a.command ?? ''
  const output = a.output ?? ''
  const exitCode = a.exitCode ?? a.exit_code ?? (tool.status === 'error' ? 1 : 0)
  const failed = tool.status === 'error' || exitCode !== 0

  return (
    <div className="trx-body">
      <div className="trx-bash-cmd">
        <Terminal aria-hidden="true" className="trx-bash-prompt" />
        <pre className="trx-code">{command}</pre>
      </div>
      {output.trim() && (
        <div className="trx-bash-out">
          <div className="trx-bash-out-head">
            <span className="trx-eyebrow">stdout</span>
          </div>
          <pre className="trx-pre trx-code">{output}</pre>
        </div>
      )}
      <div className={`trx-exit${failed ? ' trx-exit-failed' : ''}`}>
        {failed && <CircleAlert aria-hidden="true" className="trx-exit-icon" />}
        <span className="trx-eyebrow">exit</span>
        <span className="trx-exit-num tnum">{exitCode}</span>
        <span className="trx-exit-word">{failed ? 'failed' : 'ok'}</span>
      </div>
    </div>
  )
}

/* ── grep ──────────────────────────────────────────────────────────────────────
   the pattern (verbatim, in a code chip) + the scope, then the match lines: each line's
   file:line locator reads in --ink-4, the matched text in --ink. */
function GrepBody({ tool }) {
  const a = tool.args ?? {}
  const pattern = a.pattern ?? ''
  const scope = a.path ?? a.glob ?? '.'
  const matches = Array.isArray(a.matches) ? a.matches : []

  return (
    <div className="trx-body">
      <div className="trx-grepline">
        <span className="trx-grep-label">pattern</span>
        <code className="trx-code trx-grep-pattern">{pattern || '(empty)'}</code>
        <span className="trx-grep-label">in</span>
        <span className="trx-grep-scope trx-code">{scope}</span>
        <span className="trx-grep-count">
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </span>
      </div>
      {matches.length > 0 && (
        <div className="trx-codeblock">
          {matches.map((mt, i) => (
            <div className="trx-greprow" key={i}>
              <span className="trx-grep-loc trx-code">
                {mt.file}:<span className="tnum">{mt.line}</span>
              </span>
              <span className="trx-code trx-grep-text">{mt.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── task ──────────────────────────────────────────────────────────────────────
   a subagent spawn: the agent name + its status, then the nested task line (the thing it
   was asked to do). keyed in --mauve, the agent accent, so spawns read as their own lane. */
function TaskBody({ tool }) {
  const a = tool.args ?? {}
  const agent = a.subagent ?? a.subagent_type ?? 'agent'
  const taskStatus = a.taskStatus ?? a.status ?? (tool.status === 'error' ? 'failed' : 'done')
  const description = a.description ?? ''
  const prompt = a.prompt ?? ''

  return (
    <div className="trx-body trx-task">
      <div className="trx-task-head">
        <Bot aria-hidden="true" className="trx-task-icon" />
        <span className="trx-task-agent">{agent}</span>
        <span className="trx-task-status">{taskStatus}</span>
      </div>
      <div className="trx-task-line">
        <ChevronRight aria-hidden="true" className="trx-task-arrow" />
        <span className="trx-task-desc">{description || preview(prompt, 120)}</span>
      </div>
      {prompt.trim() && description && (
        <p className="trx-task-prompt">{preview(prompt, 200)}</p>
      )}
    </div>
  )
}

/* ── webfetch ───────────────────────────────────────────────────────────────────
   the url (a real link, opens in a new tab), then the fetched title + a snippet of body. */
function WebFetchBody({ tool }) {
  const a = tool.args ?? {}
  const url = a.url ?? ''
  const title = a.title ?? ''
  const snippet = a.snippet ?? a.result ?? ''

  return (
    <div className="trx-body">
      <div className="trx-webfetch-head">
        <Globe aria-hidden="true" className="trx-webfetch-icon" />
        {url ? (
          <a
            className="trx-code trx-webfetch-url"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {url}
          </a>
        ) : (
          <span className="trx-webfetch-empty">no url</span>
        )}
      </div>
      {title && <p className="trx-webfetch-title">{title}</p>}
      {snippet.trim() && <p className="trx-webfetch-snippet">{snippet}</p>}
    </div>
  )
}

/* ── default ────────────────────────────────────────────────────────────────────
   the catch-all for tools without a dedicated layout: the tool name + pretty-printed
   JSON args as a mono block. */
function DefaultBody({ tool }) {
  const argsText = JSON.stringify(tool.args ?? {}, null, 2)
  return (
    <div className="trx-body">
      <div className="trx-default-head">
        <span className="trx-eyebrow">arguments</span>
      </div>
      <pre className="trx-pre trx-code">{argsText}</pre>
    </div>
  )
}

/** shared file header row used by read / edit / write — path (content, keeps its case)
    + an optional meta note (line range, churn, line count). */
function FileLine({ path, meta }) {
  return (
    <div className="trx-fileline">
      <span className="trx-fileline-path trx-code">{path}</span>
      {meta && <span className="trx-fileline-meta">{meta}</span>}
    </div>
  )
}

// kind → body renderer; anything unmapped lands on DefaultBody (the catch-all).
const BODY_BY_KIND = {
  read: ReadBody,
  edit: EditBody,
  write: WriteBody,
  bash: BashBody,
  grep: GrepBody,
  task: TaskBody,
  webfetch: WebFetchBody,
}

/**
 * ToolCall — one collapsible tool-call row that dispatches on `tool.kind` to its body.
 *
 * Collapsed, the row is a real <button> (carries aria-expanded / aria-controls): a tool icon,
 * the tool name, a one-line arg preview, the duration, and a status word (icon + "ok"/"error",
 * never color alone). Activating it toggles real open/closed state and reveals the
 * kind-specific body. An unknown kind keeps the generic wrench icon + the DefaultBody.
 *
 * @param {object} props
 * @param {{kind:string, name:string, args?:object, duration?:number, status?:'ok'|'error'}} props.tool
 * @param {boolean} [props.defaultOpen=false]  initial open state.
 * @param {string} [props.className]
 */
export default function ToolCall({ tool, defaultOpen = false, className = '', ...rest }) {
  const [open, setOpen] = useState(defaultOpen)
  const Icon = KIND_ICON[tool.kind] ?? Wrench
  const Body = BODY_BY_KIND[tool.kind] ?? DefaultBody
  const status = tool.status ?? 'ok'
  const bodyId = `trx-body-${tool.name}-${tool.kind}`
  const previewText = argPreview(tool)

  const cls = ['trx', `trx-kind-${tool.kind}`, open && 'trx-open', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls} {...rest}>
      {/* the whole collapsed row is the toggle target — a real button, well past the 24px floor. */}
      <button
        type="button"
        className="trx-row"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight aria-hidden="true" className="trx-chevron" />
        <Icon aria-hidden="true" className="trx-tool-icon" />
        <span className="trx-tool-name">{tool.name}</span>
        {previewText && <span className="trx-tool-preview trx-code">{preview(previewText)}</span>}
        {tool.duration != null && (
          <span className="trx-tool-dur tnum">{fmtDuration(tool.duration)}</span>
        )}
        <StatusPill status={status} />
      </button>

      {open && (
        <div className="trx-panel" id={bodyId}>
          <Body tool={tool} />
        </div>
      )}
    </div>
  )
}

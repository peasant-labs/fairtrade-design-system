import { useState } from 'react'
import BrandMark from './BrandMark.jsx'
import {
  ChevronRight,
  ChevronDown,
  User,
  CornerDownRight,
  Wrench,
  Settings2,
  Brain,
  Clock,
  Coins,
  Terminal,
  BookOpen,
  Search,
  Pencil,
  FilePlus2,
  ListChecks,
  Globe,
  GitCommitHorizontal,
  AlertTriangle,
} from 'lucide-react'

/* timeline (.tl-*): a NEW tier-2 component, so it ships its own namespaced css
   (the .tl-* block appended to index.css) but reuses the existing tokens, fonts,
   borders, focus-ring, chip + diff (.dl/.rail/.gut/.sign/.t) chassis exactly like
   the acc / bs / is families. it is the VERTICAL sibling of the horizontal Steps
   wizard: one continuous spine down the left edge, with phase dividers, role-tinted
   turn nodes, collapsible thinking + tool calls, subagent insets and commit
   checkpoints strung along it, read top to bottom. role is carried by a glyph + a
   visible label, never tint alone; amber stays the scarce accent (assistant only).
   every collapsible is a real <button aria-expanded> whose body lazy-mounts on open.
   the data shape mirrors TranscriptApp's TURNS/PHASES so the same mock feeds both. */

/* the assistant role leads with the real claude mark (the shared BrandMark, single source
   of truth for provider logos). decorative here: the visible "claude" label names the role. */
function ClaudeMark() {
  return <BrandMark name="claude" />
}

/* tool kind -> leading glyph (mirrors TranscriptApp's TOOL_ICON) */
const TOOL_ICON = {
  read: BookOpen,
  grep: Search,
  edit: Pencil,
  write: FilePlus2,
  bash: Terminal,
  task: ListChecks,
  webfetch: Globe,
  default: Wrench,
}

const fmtTokens = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n))

/**
 * @typedef {Object} Thinking
 * @property {number} words   word count shown next to the toggle (tabular)
 * @property {string} text    the reasoning text (kept in original case)
 */

/**
 * @typedef {Object} Tool
 * @property {string} id
 * @property {'read'|'grep'|'edit'|'write'|'bash'|'task'|'webfetch'|string} kind  switch for the built-in renderer
 * @property {string} name          content-case label e.g. 'Read' (NEVER lowercased)
 * @property {string} preview       one-line summary shown while collapsed
 * @property {string} [duration]    e.g. '4.1s' (tabular)
 * @property {number} [exit]        bash exit code; !== 0 surfaces an error pill + tints the dot
 *   kind-specific payload: read{path,lines,excerpt} · grep{pattern,scope,glob,matches,results}
 *   · edit{path,adds,dels,hunk[]} · bash{command,description,stdout,exit,duration}
 *   · webfetch{url,prompt,result} · task{agent,status,task,owner,promptBody,result}
 *   · default{args,result}
 */

/**
 * @typedef {Object} TimelineItem
 * @property {string} id
 * @property {'turn'|'phase'|'checkpoint'} kind         node type on the spine
 *
 * @property {'user'|'assistant'|'subagent'|'tool'|'system'} [role]  (kind: turn)
 * @property {string} [label]        turn label e.g. '2a' (tabular)
 * @property {number} [depth]        0 = main thread; > 0 = subagent inset
 * @property {string} [subagent]     subagent name when depth > 0
 * @property {string} [time]         relative, e.g. '8m ago'
 * @property {string} [longTime]     absolute, used for title=
 * @property {string} [body]         the turn text (passed to renderBody)
 * @property {Thinking} [thinking]   collapsible reasoning block
 * @property {Tool[]} [tools]        collapsible tool calls
 * @property {{in:number,out:number}} [tokens]
 * @property {boolean} [error]       turn surfaced a tool error
 * @property {boolean} [final]       marks the last assistant turn; caps the spine below it
 *
 * @property {string} [phaseLabel]   (kind: phase) e.g. 'debugging'
 * @property {React.ComponentType<any>} [icon]  lucide phase icon
 * @property {string} [range]        'turns 3–4 · 1 error'
 *
 * @property {string} [hash]         (kind: checkpoint) commit hash
 * @property {string} [msg]          commit message
 * @property {{files:number,adds:number,dels:number}} [stat]
 */

/* role -> glyph component + tint class + visible label fragment. tint never carries
   meaning on its own, the glyph + label do; assistant is the only amber node. */
const ROLE_META = {
  user: { cls: 'tl-item--user', glyph: User, label: 'user' },
  assistant: { cls: 'tl-item--assistant', glyph: ClaudeMark, label: 'claude' },
  subagent: { cls: 'tl-item--subagent', glyph: CornerDownRight, label: 'subagent' },
  tool: { cls: 'tl-item--tool', glyph: Wrench, label: 'tool' },
  system: { cls: 'tl-item--system', glyph: Settings2, label: 'system' },
}

/* ---------------------------------------------------------------- thinking block */
/**
 * ThinkingBlock — a collapsible reasoning panel. Controlled when `open`/`onToggle`
 * are passed, otherwise it self-manages. Header is a real <button aria-expanded>;
 * the body lazy-mounts on open so collapsed reasoning is absent from the a11y tree.
 *
 * @param {Object} props
 * @param {Thinking} props.block            the reasoning block (words + text)
 * @param {boolean} [props.open]            controlled open state
 * @param {() => void} [props.onToggle]     controlled toggle handler
 */
export function ThinkingBlock({ block, open: openProp, onToggle }) {
  const [openState, setOpenState] = useState(false)
  const controlled = openProp != null
  const open = controlled ? openProp : openState
  const toggle = () => (controlled ? onToggle?.() : setOpenState((o) => !o))
  return (
    <div className="tl-thinking">
      <button type="button" className="tl-thinking-toggle" aria-expanded={open} onClick={toggle}>
        {open ? <ChevronDown className="lucide" aria-hidden="true" /> : <ChevronRight className="lucide" aria-hidden="true" />}
        <Brain className="lucide" aria-hidden="true" />
        <span>thinking</span>
        <span className="tl-thinking-wc tnum">{block.words}w</span>
      </button>
      {open && (
        <div className="tl-thinking-body">
          <em>{block.text}</em>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- per-tool renderers */
/* the built-in dispatch used when no renderTool prop is supplied. distilled from
   TranscriptApp's ToolBody; the edit case reuses the existing .dl/.rail/.gut/.sign/.t
   diff renderer verbatim (zero new diff css). content keeps its original case. */
function ToolBody({ tool }) {
  if (tool.kind === 'read') {
    return (
      <div className="tl-tool-body">
        <dl className="tl-kv">
          <dt>path</dt>
          <dd className="mono">{tool.path}</dd>
          {tool.lines && (
            <>
              <dt>lines</dt>
              <dd className="tnum">{tool.lines}</dd>
            </>
          )}
        </dl>
        {tool.excerpt && <pre className="tl-code">{tool.excerpt}</pre>}
      </div>
    )
  }
  if (tool.kind === 'grep') {
    return (
      <div className="tl-tool-body">
        <dl className="tl-kv">
          <dt>pattern</dt>
          <dd className="mono">{tool.pattern}</dd>
          <dt>scope</dt>
          <dd className="mono">{tool.scope}</dd>
          {tool.glob && (
            <>
              <dt>type</dt>
              <dd className="mono">{tool.glob}</dd>
            </>
          )}
          <dt>matches</dt>
          <dd className="tnum">{tool.matches}</dd>
        </dl>
        {tool.results && <pre className="tl-code">{tool.results}</pre>}
      </div>
    )
  }
  if (tool.kind === 'edit') {
    return (
      <div className="tl-tool-body">
        <dl className="tl-kv">
          <dt>path</dt>
          <dd className="mono">{tool.path}</dd>
          <dt>churn</dt>
          <dd className="tnum">
            <span className="tl-churn-add">+{tool.adds}</span> <span className="tl-churn-del">−{tool.dels}</span>
          </dd>
        </dl>
        <div className="diff tl-diff">
          {tool.hunk.map((d, i) => (
            <div className={'dl ' + d.sign} key={i}>
              <span className="rail" />
              <span className="gut tnum">{d.sign === 'del' ? d.a : d.b}</span>
              <span className="sign">{d.sign === 'add' ? '+' : d.sign === 'del' ? '−' : ''}</span>
              <span className="t">{d.t}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (tool.kind === 'bash') {
    const failed = tool.exit !== 0
    return (
      <div className="tl-tool-body">
        {tool.description && (
          <dl className="tl-kv">
            <dt>note</dt>
            <dd>{tool.description}</dd>
          </dl>
        )}
        <div className="tl-term">
          <Terminal className="lucide" aria-hidden="true" /> <span className="mono">$ {tool.command}</span>
        </div>
        <div className="tl-out-row">
          <span>stdout</span>
          <span className="tl-out-badges">
            {tool.duration && (
              <span className="tl-durbadge tnum">
                <Clock className="lucide" aria-hidden="true" /> {tool.duration}
              </span>
            )}
            <span className={'chip tnum' + (failed ? ' chip-err' : '')} title={'exit code ' + tool.exit}>
              {failed && <AlertTriangle className="lucide" aria-hidden="true" />} exit {tool.exit}
            </span>
          </span>
        </div>
        {tool.stdout && <pre className="tl-code">{tool.stdout}</pre>}
      </div>
    )
  }
  if (tool.kind === 'webfetch') {
    return (
      <div className="tl-tool-body">
        <a className="link tl-url" href={tool.url} target="_blank" rel="noreferrer">
          <Globe className="lucide" aria-hidden="true" /> {tool.url}
        </a>
        {tool.prompt && <div className="tl-fetch-prompt">{tool.prompt}</div>}
        {tool.result && <div className="tl-fetch-md">{tool.result}</div>}
      </div>
    )
  }
  if (tool.kind === 'task') {
    return <TaskBody tool={tool} />
  }
  /* default catch-all: pretty args + result */
  return (
    <div className="tl-tool-body">
      <div className="tl-out-row"><span>arguments</span></div>
      <pre className="tl-code">{JSON.stringify(tool.args || {}, null, 2)}</pre>
      <div className="tl-out-row"><span>result</span></div>
      <pre className="tl-code">{tool.result || 'no result'}</pre>
    </div>
  )
}

function TaskBody({ tool }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="tl-tool-body">
      <dl className="tl-kv">
        <dt>agent</dt>
        <dd className="mono">{tool.agent}</dd>
        <dt>status</dt>
        <dd>{tool.status}</dd>
        <dt>task</dt>
        <dd>{tool.task}</dd>
        {tool.owner && (
          <>
            <dt>owner</dt>
            <dd className="mono">{tool.owner}</dd>
          </>
        )}
      </dl>
      {tool.promptBody && <div className="tl-fetch-md">{tool.promptBody}</div>}
      {tool.result && (
        <>
          <button type="button" className="tl-thinking-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronDown className="lucide" aria-hidden="true" /> : <ChevronRight className="lucide" aria-hidden="true" />}
            <span>result</span>
          </button>
          {open && <pre className="tl-code">{tool.result}</pre>}
        </>
      )}
    </div>
  )
}

/**
 * ToolCall — one collapsible tool call. Controlled when `open`/`onToggle` are passed
 * (lets a host own expand-all), otherwise self-managed. Header is a real
 * <button aria-expanded>; the body lazy-mounts on open. `renderTool` overrides the
 * built-in body dispatch.
 *
 * @param {Object} props
 * @param {Tool} props.tool
 * @param {number} [props.index]                     position, passed to renderTool
 * @param {boolean} [props.open]                     controlled open state
 * @param {() => void} [props.onToggle]              controlled toggle handler
 * @param {(tool: Tool, i: number) => React.ReactNode} [props.renderTool]  custom body renderer
 */
export function ToolCall({ tool, index = 0, open: openProp, onToggle, renderTool }) {
  const [openState, setOpenState] = useState(false)
  const controlled = openProp != null
  const open = controlled ? openProp : openState
  const toggle = () => (controlled ? onToggle?.() : setOpenState((o) => !o))
  const Icon = TOOL_ICON[tool.kind] || TOOL_ICON.default
  const failed = tool.kind === 'bash' && tool.exit != null && tool.exit !== 0
  return (
    <div className="tl-tool">
      <button type="button" className="tl-tool-head" aria-expanded={open} onClick={toggle}>
        {open ? <ChevronDown className="lucide tl-tool-chev" aria-hidden="true" /> : <ChevronRight className="lucide tl-tool-chev" aria-hidden="true" />}
        <span className="tl-tool-kind">
          <Icon className="lucide" aria-hidden="true" /> {tool.name}
        </span>
        <span className="tl-tool-prev mono">{tool.preview}</span>
        <span className="tl-tool-right">
          {tool.duration && <span className="tnum">{tool.duration}</span>}
          {failed && (
            <span className="chip chip-err tnum">
              <AlertTriangle className="lucide" aria-hidden="true" /> exit {tool.exit}
            </span>
          )}
        </span>
      </button>
      {open && (renderTool ? renderTool(tool, index) : <ToolBody tool={tool} />)}
    </div>
  )
}

/* ---------------------------------------------------------------- one node */
/**
 * TimelineItem — renders one node on the spine, switching on `kind`. Owns the
 * decorative dot, the role glyph + head meta and the body slot. Exported so a host
 * can map its own array and compose custom containers.
 *
 * @param {Object} props
 * @param {TimelineItem} props.item
 * @param {(tool: Tool, i: number) => React.ReactNode} [props.renderTool]
 * @param {(item: TimelineItem) => React.ReactNode} [props.renderBody]
 */
export function TimelineItem({ item, renderTool, renderBody }) {
  if (item.kind === 'phase') {
    const Icon = item.icon
    return (
      <li className="tl-item tl-item--phase">
        <span className="tl-dot" aria-hidden="true" />
        <div className="tl-phase">
          <span className="tl-phase-lbl">
            {Icon ? <Icon className="lucide" aria-hidden="true" /> : null}
            {item.phaseLabel}
          </span>
          {item.range && <span className="tl-phase-rng tnum">{item.range}</span>}
        </div>
      </li>
    )
  }

  if (item.kind === 'checkpoint') {
    return (
      <li className="tl-item tl-item--checkpoint">
        <span className="tl-dot" aria-hidden="true" />
        <div className="tl-cp">
          <GitCommitHorizontal className="lucide" aria-hidden="true" />
          {item.hash && <span className="tl-cp-hash mono">{item.hash}</span>}
          {item.msg && <span className="tl-cp-msg">{item.msg}</span>}
          {item.stat && (
            <span className="tl-cp-stat tnum">
              {item.stat.files} files +{item.stat.adds} −{item.stat.dels}
            </span>
          )}
        </div>
      </li>
    )
  }

  /* kind: turn */
  const isSub = item.depth != null && item.depth > 0
  const roleKey = isSub ? 'subagent' : item.role || 'assistant'
  const meta = ROLE_META[roleKey] || ROLE_META.assistant
  const Glyph = meta.glyph
  const tokens = item.tokens

  return (
    <li
      className={
        'tl-item ' + meta.cls + (item.error ? ' tl-item--error' : '') + (item.final ? ' tl-item--final' : '')
      }
    >
      <span className={'tl-dot' + (item.error ? ' tl-dot--error' : '')} aria-hidden="true" />
      <div className="tl-card">
        <div className="tl-head">
          <span className="tl-role">
            <Glyph className="lucide" aria-hidden="true" />
            {meta.label}
            {isSub && item.subagent ? ' ' + item.subagent : ''}
          </span>
          {isSub && <span className="tl-depth tnum">depth {item.depth}</span>}
          {item.label && <span className="tl-num tnum">#{item.label}</span>}
          {item.time && (
            <span className="tl-time tnum" title={item.longTime}>
              {item.time}
            </span>
          )}
          {item.error && (
            <span className="chip chip-err tnum">
              <AlertTriangle className="lucide" aria-hidden="true" /> error
            </span>
          )}
          {tokens && (
            <span className="tl-tokens tnum" title={fmtTokens(tokens.in) + ' in, ' + fmtTokens(tokens.out) + ' out'}>
              <Coins className="lucide" aria-hidden="true" /> {fmtTokens(tokens.in + tokens.out)}
            </span>
          )}
        </div>

        {renderBody ? renderBody(item) : item.body ? <div className="tl-body">{item.body}</div> : null}

        {item.thinking && <ThinkingBlock block={item.thinking} />}

        {item.tools &&
          item.tools.map((t, i) => (
            <ToolCall key={t.id} tool={t} index={i} renderTool={renderTool} />
          ))}
      </div>
    </li>
  )
}

/**
 * Timeline — a vertical spine for a whole session: phase dividers, role-tinted
 * turn nodes, collapsible thinking + tool calls, subagent insets and commit
 * checkpoints, read top to bottom. The vertical sibling of the horizontal Steps
 * wizard; they share no geometry. Role is carried by glyph + label, never tint
 * alone; the spine stays continuous even through subagent insets.
 *
 * Emits `<ol class="tl" aria-label>` — turns are an ordered list so DOM order
 * equals visual order equals conversation order. Renders an EmptyState-style
 * `.empty` block when `items` is empty.
 *
 * @param {Object} props
 * @param {TimelineItem[]} [props.items=[]]                           ordered top->bottom event stream
 * @param {(tool: Tool, i: number) => React.ReactNode} [props.renderTool]  per-tool body override
 * @param {(item: TimelineItem) => React.ReactNode} [props.renderBody]     per-role body override
 * @param {boolean} [props.dense=false]                              compact rhythm for sidebars
 * @param {string} [props.ariaLabel='conversation timeline']         label for the <ol> landmark
 */
export default function Timeline({ items = [], renderTool, renderBody, dense = false, ariaLabel = 'conversation timeline' }) {
  if (!items.length) {
    return (
      <div className="empty">
        <span className="ring" aria-hidden="true">
          <Clock className="lucide" aria-hidden="true" />
        </span>
        <h3>no turns to display</h3>
        <p>this session has no recorded turns yet. once a turn lands it threads onto the spine here.</p>
      </div>
    )
  }
  return (
    <ol className={'tl' + (dense ? ' tl--dense' : '')} aria-label={ariaLabel}>
      {items.map((item) => (
        <TimelineItem key={item.id} item={item} renderTool={renderTool} renderBody={renderBody} />
      ))}
    </ol>
  )
}

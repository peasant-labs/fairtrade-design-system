import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  ShieldCheck,
  Flag,
  User,
  FileText,
  FilePlus2,
  Search,
  FileSearch,
  Pencil,
  Terminal,
  Brain,
  Check,
  Copy,
  GitCommitHorizontal,
  Sparkles,
  ListTree,
  LayoutList,
  SlidersHorizontal,
  ListChecks,
  CornerDownRight,
  Share2,
  Users,
  Link as LinkIcon,
  MoreHorizontal,
  Download,
  MessageSquareText,
  Globe,
  BookOpen,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Play,
  X,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowRight,
  List,
  Network,
  Plus,
  Minus,
  Maximize,
  TrendingUp,
  TrendingDown,
  Wrench,
  Filter as FilterIcon,
} from 'lucide-react'
import { StepsWaterfall, ProviderIcon, PROVIDER_ACCENT } from '../../ui'

/* ============================================================================
   TranscriptApp — full transcript-browser demo inside the qud identity.
   one self-contained component. owns its own session mock + every bit of
   interactive state. namespace txn- for new chrome; reuses turn, toolcall,
   diff, tabs, chip, btn, menu, canvas, node, sidebar, check-box, sw, empty.
   chrome stays lowercase; transcript content + code keep their case.
============================================================================ */

/* ---- the brand mark (svg symbol is document-global, defined in 00-defs.html) ---- */
function ClaudeMark({ size = 14 }) {
  return (
    <svg className="brand" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <use href="#b-claude" />
    </svg>
  )
}

/* the session's coding-agent harness (peasant bestiary wire value). the ASSISTANT side IS the
   provider, so its icon + accent are keyed off this one value via the ProviderIcon family. the system
   default stays user=teal / assistant=amber; claude-code's PROVIDER_ACCENT is amber, so the default
   session looks identical — switch this to gemini-cli / codex / opencode / cursor and the assistant
   re-accents (teal / olive / mauve / clay) for free. */
const HARNESS = 'claude-code'

/* ---- the recorded session, baked in (sess_demo_0001 / transcript-browser) ---- */
const TURNS = [
  {
    id: 0,
    role: 'user',
    label: '1',
    userTurn: 1,
    time: '8m ago',
    longTime: 'jun 17, 2026 · 09:12',
    phase: 'exploration',
    tokens: { in: 280, out: 0 },
    body:
      'Port the transcript canvas into the shared package. Start by reading the existing renderer before extracting it.',
  },
  {
    id: 1,
    role: 'assistant',
    label: '1a',
    time: '8m ago',
    longTime: 'jun 17, 2026 · 09:12',
    phase: 'exploration',
    tokens: { in: 1840, out: 920 },
    thinking: {
      words: 84,
      text:
        'The renderer lives under web/src/components/session-detail/v2/canvas. I should read TurnRow.tsx first to understand how role glyphs + tool calls compose, then trace rendererFor to see the per-tool dispatch before I move anything into packages/browser.',
    },
    body:
      'Let me look at the current renderer before extracting it. I will read **TurnRow.tsx** and find where `rendererFor` is wired so the move preserves the per-tool dispatch.',
    tools: [
      {
        id: 't1a',
        kind: 'read',
        name: 'Read',
        preview: 'web/src/components/session-detail/v2/canvas/TurnRow.tsx',
        path: 'web/src/components/session-detail/v2/canvas/TurnRow.tsx',
        lines: '1–40',
        excerpt:
          'export function TurnRow({ turn, depth }: TurnRowProps) {\n  const Glyph = roleGlyph(turn.role)\n  const tokens = formatTokens(turn.usage)\n  return (\n    <div className="turn-row" data-depth={depth}>\n      <RoleGlyph as={Glyph} provider={turn.provider} />\n      <TurnHeader label={turn.label} time={turn.time} />\n      <Markdown source={turn.content} />\n      <ToolCallList calls={turn.toolCalls} />\n    </div>\n  )\n}',
      },
    ],
  },
  {
    id: 2,
    role: 'assistant',
    label: '1b',
    time: '8m ago',
    longTime: 'jun 17, 2026 · 09:13',
    phase: 'exploration',
    tokens: { in: 2100, out: 640 },
    body: 'Now locate every call site of `rendererFor` so the dispatch table comes across intact.',
    tools: [
      {
        id: 't2a',
        kind: 'grep',
        name: 'Grep',
        preview: "rendererFor  ·  web/src  ·  4 matches",
        pattern: 'rendererFor',
        scope: 'web/src',
        glob: '*.ts',
        matches: 4,
        results:
          'web/src/canvas/rendererFor.ts:12   export function rendererFor(kind: ToolKind) {\nweb/src/canvas/ToolCallRow.tsx:31   const Renderer = rendererFor(call.kind)\nweb/src/canvas/index.ts:4          export { rendererFor } from "./rendererFor"\nweb/src/session-detail/v2/canvas/TurnRow.tsx:58  rendererFor(call.kind)',
      },
    ],
  },
  {
    id: 3,
    role: 'user',
    label: '2',
    userTurn: 2,
    time: '6m ago',
    longTime: 'jun 17, 2026 · 09:15',
    phase: 'debugging',
    tokens: { in: 90, out: 0 },
    body: 'Looks right. Run a typecheck across the workspace before you start moving files.',
  },
  {
    id: 4,
    role: 'assistant',
    label: '2a',
    time: '6m ago',
    longTime: 'jun 17, 2026 · 09:15',
    phase: 'debugging',
    error: true,
    tokens: { in: 2400, out: 1180 },
    body: 'Running the workspace typecheck first. It surfaces a strict-mode error in the tasks helper.',
    tools: [
      {
        id: 't4a',
        kind: 'bash',
        name: 'Bash',
        preview: 'pnpm -r typecheck',
        command: 'pnpm -r typecheck',
        description: 'workspace-wide typescript check',
        stdout:
          'packages/browser typecheck$ tsc -p tsconfig.json --noEmit\nsrc/lib/tasks.ts(48,9): error TS2532: Object is possibly \'undefined\'.\n   46 |   const groups = groupByTask(turns)\n   47 |   const first = groups[0]\n>  48 |   return first.turns[0].index\n      |          ^^^^^\nELIFECYCLE  Command failed with exit code 2.',
        duration: '4.1s',
        exit: 2,
      },
    ],
  },
  {
    id: 5,
    role: 'assistant',
    label: '2b',
    time: '5m ago',
    longTime: 'jun 17, 2026 · 09:16',
    phase: 'implementation',
    tokens: { in: 2600, out: 1320 },
    thinking: {
      words: 41,
      text:
        '`groups[0]` is possibly undefined under noUncheckedIndexedAccess. Guard it and return null for the empty case so the caller can fall back to turn 0.',
    },
    body: 'The index access is unguarded under strict mode. Adding a null-guard so the empty-task case falls through cleanly.',
    tools: [
      {
        id: 't5a',
        kind: 'edit',
        name: 'Edit',
        preview: 'packages/browser/src/lib/tasks.ts',
        path: 'packages/browser/src/lib/tasks.ts',
        adds: 3,
        dels: 1,
        hunk: [
          { sign: 'ctx', a: '46', b: '46', t: '  const groups = groupByTask(turns)' },
          { sign: 'del', a: '47', b: '', t: '  const first = groups[0]' },
          { sign: 'add', a: '', b: '47', t: '  const first = groups[0]' },
          { sign: 'add', a: '', b: '48', t: '  if (!first || first.turns.length === 0) return null' },
          { sign: 'add', a: '', b: '49', t: '  return first.turns[0]!.index' },
          { sign: 'del', a: '48', b: '', t: '  return first.turns[0].index' },
        ],
      },
    ],
  },
  {
    id: 6,
    role: 'assistant',
    label: '2c',
    time: '4m ago',
    longTime: 'jun 17, 2026 · 09:17',
    phase: 'implementation',
    tokens: { in: 1900, out: 980 },
    body: 'Verifying the fix: the workspace typechecks clean now, so I will commit the canvas port.',
    tools: [
      {
        id: 't6a',
        kind: 'bash',
        name: 'Bash',
        preview: 'pnpm -r typecheck',
        command: 'pnpm -r typecheck',
        stdout:
          'packages/browser typecheck$ tsc -p tsconfig.json --noEmit\nweb typecheck$ tsc -p tsconfig.json --noEmit\n\n  3 packages checked, 0 errors',
        duration: '5.6s',
        exit: 0,
      },
    ],
    checkpoint: {
      hash: '9f3c1ad',
      msg: 'feat(canvas): port TurnRow + tool renderers',
      files: 7,
      adds: 312,
      dels: 24,
    },
  },
  {
    id: 7,
    role: 'assistant',
    label: '2d',
    depth: 1,
    subagent: 'docs-writer',
    time: '3m ago',
    longTime: 'jun 17, 2026 · 09:18',
    phase: 'implementation',
    tokens: { in: 1700, out: 1140 },
    body: 'Spawned a subagent to document the props/callback/capability contract for the extracted package.',
    tools: [
      {
        id: 't7a',
        kind: 'task',
        name: 'Task',
        preview: 'docs-writer · document the props/callback contract',
        agent: 'docs-writer',
        status: 'completed',
        task: 'Document the props/callback/capability contract',
        owner: 'main',
        promptBody:
          'Write the README contract section for `<SessionDetail>`: every prop, every host callback (onDownload, linkBuilder, renderTurnActions), and the capability flags that gate the action menu.',
        result: 'Drafted README.md contract section (78 lines). Documented 14 props, 3 callbacks, 4 capability flags.',
      },
    ],
  },
  {
    id: 8,
    role: 'assistant',
    label: '2e',
    time: 'just now',
    longTime: 'jun 17, 2026 · 09:19',
    phase: 'implementation',
    final: true,
    tokens: { in: 980, out: 720 },
    body:
      'All packages typecheck and build. The canvas now lives in `packages/browser` and `web` consumes it through the shared export.',
    tools: [
      {
        id: 't8a',
        kind: 'bash',
        name: 'Bash',
        preview: 'pnpm -r build && pnpm -r typecheck',
        command: 'pnpm -r build && pnpm -r typecheck',
        stdout:
          'packages/browser build$ tsup\n  ESM dist/index.mjs 41.2 KB\n  CJS dist/index.js  43.9 KB\nweb build$ vite build\n  ✓ built in 6.41s\n\n  3 packages built, 0 errors',
        duration: '12.0s',
        exit: 0,
      },
    ],
  },
]

/* phases drawn between turn ranges */
const PHASES = [
  { id: 'exploration', label: 'exploration', icon: FileSearch, from: 0, to: 2 },
  { id: 'debugging', label: 'debugging', icon: AlertTriangle, from: 3, to: 4, errors: 1 },
  { id: 'implementation', label: 'implementation', icon: Pencil, from: 5, to: 8 },
]

/* the per-task duration trail for the trace outline (StepsWaterfall), matching the documented
   app-viewer's "what happened, in order" timeline. id is the user turn's TURNS id so onJump reuses
   jumpTo(id). prompt is USER CONTENT (case preserved). userTurn 2 carried the typecheck error, so it
   reads as an error task (clay spine + the word "error", never colour alone). durations come from the
   existing rail meta line (5m / 3m). */
const TRACE_TASKS = TURNS.filter((t) => t.userTurn).map((t) => ({
  id: t.id,
  index: t.userTurn,
  prompt: t.body,
  durationMs: t.userTurn === 1 ? 300_000 : 180_000,
  tools: 3,
  outcome: t.userTurn === 2 ? 'error' : 'ok',
  error: t.userTurn === 2 ? 'typecheck failed' : undefined,
}))

/* the touched files index (Files tab) */
const FILES = [
  { path: 'packages/browser/src/lib/tasks.ts', leaf: 'tasks.ts', edits: 1, reads: 0, writes: 0, adds: 4, dels: 2, edited: true, turn: 5 },
  { path: 'web/src/components/session-detail/v2/canvas/TurnRow.tsx', leaf: 'TurnRow.tsx', edits: 0, reads: 1, writes: 0, adds: 0, dels: 0, edited: false, turn: 1 },
  { path: 'packages/browser/src/canvas/rendererFor.ts', leaf: 'rendererFor.ts', edits: 0, reads: 0, writes: 0, adds: 0, dels: 0, edited: false, turn: 2 },
  { path: 'packages/browser/src/canvas/ToolCallRow.tsx', leaf: 'ToolCallRow.tsx', edits: 0, reads: 0, writes: 0, adds: 0, dels: 0, edited: false, turn: 2 },
  { path: 'packages/browser/src/canvas/index.ts', leaf: 'index.ts', edits: 0, reads: 0, writes: 0, adds: 0, dels: 0, edited: false, turn: 2 },
  { path: 'packages/browser/README.md', leaf: 'README.md', edits: 0, reads: 0, writes: 1, adds: 78, dels: 0, edited: true, turn: 7 },
  { path: 'packages/browser/src/index.ts', leaf: 'index.ts', edits: 0, reads: 0, writes: 0, adds: 12, dels: 0, edited: false, turn: 8 },
]

/* auto-detected annotations (errors / retries / reverts / subagents) */
const ANNOTATIONS = [
  { id: 'a1', turn: 4, role: 'assistant', type: 'error', label: 'pnpm -r typecheck · exit 2', preview: "src/lib/tasks.ts(48,9): error TS2532: Object is possibly 'undefined'." },
  { id: 'a2', turn: 5, role: 'assistant', type: 'revert', label: 'tasks.ts edited after a failed run', preview: 'strict-mode index guard added to the same file the typecheck flagged' },
  { id: 'a3', turn: 7, role: 'assistant', type: 'subagent', label: 'docs-writer · depth 1', preview: 'Task spawned a subagent to document the package contract' },
]

const ANNOTATION_META = {
  error: { label: 'error', icon: AlertTriangle, chip: 'chip-err', tip: 'a tool returned an error or a non-zero exit code' },
  retry: { label: 'retry', icon: RefreshCw, chip: 'chip-warn', tip: 'the same tool ran 3+ times within 5 turns' },
  revert: { label: 'reverted edit', icon: RotateCcw, chip: 'chip-warn', tip: 'a file was edited again after an earlier change' },
  subagent: { label: 'subagent', icon: CornerDownRight, chip: '', tip: 'a Task spawned a nested subagent at depth > 0' },
}

/* highlights = curated key moments */
const HIGHLIGHTS = [
  { id: 'h1', kind: 'request', turn: 0, icon: Play, title: 'initial request', sub: 'Port the transcript canvas into the shared package…', time: '8m ago' },
  { id: 'h2', kind: 'phase', turn: 3, icon: Flag, title: 'debugging begins', sub: 'turn 2 · 1 error in this phase', tag: 'debugging' },
  { id: 'h3', kind: 'error', turn: 4, icon: AlertTriangle, title: 'pnpm -r typecheck failed', sub: '1 failed · exit 2', err: true },
  { id: 'h4', kind: 'checkpoint', turn: 6, icon: GitCommitHorizontal, title: '9f3c1ad', sub: 'feat(canvas): port TurnRow + tool renderers', stat: '+312 −24 · 7 files' },
  { id: 'h5', kind: 'final', turn: 8, icon: Sparkles, title: 'final response', sub: 'All packages typecheck and build…', tokens: '1.7k' },
]

/* tool-group breakdown for the Filters rail */
const TOOL_GROUPS = [
  { id: 'edits', label: 'file edits', icon: Pencil, count: 1 },
  { id: 'bash', label: 'bash', icon: Terminal, count: 3 },
  { id: 'read', label: 'read', icon: BookOpen, count: 1 },
  { id: 'search', label: 'search', icon: Search, count: 1 },
  { id: 'fetch', label: 'fetch', icon: Globe, count: 0 },
  { id: 'tasks', label: 'tasks', icon: ListChecks, count: 1 },
  { id: 'other', label: 'other', icon: Wrench, count: 0 },
]

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

/* ---------------------------------------------------------------- thinking block */
function Thinking({ block }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="txn-thinking">
      <button type="button" className="txn-thinking-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
        <Brain size={14} aria-hidden="true" />
        <i>thinking</i>
        <span className="txn-thinking-wc tnum">{block.words}w</span>
      </button>
      {open && <div className="txn-thinking-body"><em>{block.text}</em></div>}
    </div>
  )
}

/* ---------------------------------------------------------------- per-tool renderers */
function ToolBody({ tool }) {
  if (tool.kind === 'read') {
    return (
      <div className="txn-tcbody">
        <div className="txn-code-head">
          <span className="mono txn-code-path">{tool.path}</span>
          <span className="txn-code-meta tnum">lines {tool.lines}</span>
        </div>
        <pre className="txn-code">{tool.excerpt}</pre>
      </div>
    )
  }
  if (tool.kind === 'edit') {
    return (
      <div className="txn-tcbody">
        <div className="txn-diff-head">
          <span className="mono txn-code-path">{tool.path}</span>
          <span className="txn-churn tnum">
            <span className="txn-churn-add">+{tool.adds}</span> <span className="txn-churn-del">−{tool.dels}</span>
          </span>
        </div>
        <div className="diff txn-diff">
          {tool.hunk.map((d, i) => (
            <div className={'dl ' + d.sign} key={i}>
              <span className="rail" />
              <span className="gut tnum">{d.a}</span>
              <span className="gut tnum">{d.b}</span>
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
      <div className="txn-tcbody">
        {tool.description && <div className="txn-tc-desc">{tool.description}</div>}
        <div className="txn-term">
          <span className="txn-term-prompt"><Terminal size={13} aria-hidden="true" /> $</span>
          <span className="mono">{tool.command}</span>
        </div>
        <div className="txn-out-eyebrow">
          <span>stdout</span>
          <span className="txn-out-badges">
            {tool.duration && <span className="txn-durbadge tnum"><Clock size={12} aria-hidden="true" /> {tool.duration}</span>}
            <span className={'txn-exitbadge tnum' + (failed ? ' txn-exit-failed' : '')} title={'exit code ' + tool.exit}>
              exit {tool.exit}
            </span>
          </span>
        </div>
        <pre className="txn-code">{tool.stdout}</pre>
      </div>
    )
  }
  if (tool.kind === 'grep') {
    return (
      <div className="txn-tcbody">
        <div className="txn-grep-meta">
          <code className="txn-grep-pat mono">{tool.pattern}</code>
          <span className="txn-grep-in">in <span className="mono">{tool.scope}</span></span>
          {tool.glob && <span className="txn-grep-type tnum">type={tool.glob}</span>}
          <span className="txn-grep-n tnum">{tool.matches} matches</span>
        </div>
        <pre className="txn-code">{tool.results}</pre>
      </div>
    )
  }
  if (tool.kind === 'webfetch') {
    return (
      <div className="txn-tcbody">
        <a className="link txn-url" href={tool.url} target="_blank" rel="noreferrer">
          <Globe size={13} aria-hidden="true" /> {tool.url}
        </a>
        <div className="txn-tc-desc">{tool.prompt}</div>
        <div className="txn-fetch-md">{tool.result}</div>
      </div>
    )
  }
  if (tool.kind === 'task') {
    return <TaskBody tool={tool} />
  }
  /* default catch-all: pretty args + result */
  return (
    <div className="txn-tcbody">
      <div className="txn-out-eyebrow"><span>arguments</span></div>
      <pre className="txn-code">{JSON.stringify(tool.args || {}, null, 2)}</pre>
      <div className="txn-out-eyebrow"><span>result</span></div>
      <pre className="txn-code">{tool.result || '—'}</pre>
    </div>
  )
}

function TaskBody({ tool }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="txn-tcbody">
      <dl className="txn-kv">
        <div><dt>agent</dt><dd className="mono">{tool.agent}</dd></div>
        <div><dt>status</dt><dd>{tool.status}</dd></div>
        <div><dt>task</dt><dd>{tool.task}</dd></div>
        <div><dt>owner</dt><dd className="mono">{tool.owner}</dd></div>
      </dl>
      <div className="txn-fetch-md">{tool.promptBody}</div>
      <button type="button" className="txn-details-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />} result
      </button>
      {open && <pre className="txn-code">{tool.result}</pre>}
    </div>
  )
}

function ToolCall({ tool, open, onToggle }) {
  const Icon = TOOL_ICON[tool.kind] || TOOL_ICON.default
  const failed = tool.kind === 'bash' && tool.exit !== 0
  return (
    <div className="toolcall txn-toolcall">
      <button type="button" className="tc-head txn-tc-head" aria-expanded={open} onClick={onToggle}>
        {open ? <ChevronDown size={13} aria-hidden="true" className="txn-tc-chev" /> : <ChevronRight size={13} aria-hidden="true" className="txn-tc-chev" />}
        <span className="kind"><Icon size={14} aria-hidden="true" /> {tool.name}</span>
        <span className="path mono">{tool.preview}</span>
        <span className="right">
          {tool.duration && <span className="tnum txn-tc-dur">{tool.duration}</span>}
          {failed && <span className="chip chip-err txn-pill"><AlertTriangle size={12} aria-hidden="true" /> exit 2</span>}
        </span>
      </button>
      {open && <ToolBody tool={tool} />}
    </div>
  )
}

/* ---------------------------------------------------------------- turn card */
const ROLE_GLYPH = {
  user: 'user',
  assistant: 'asst',
  tool: 'tool',
  system: 'system',
}

function TurnCard({ turn, active, openTools, toggleTool, onCopyAnchor, copied, registerRef, onLabel, savedLabel, compact, expandAll }) {
  const isUser = turn.role === 'user'
  const isSub = turn.depth && turn.depth > 0
  const roleLabel = isSub ? 'subagent · ' + turn.subagent : turn.role === 'assistant' ? HARNESS : turn.role
  // the assistant IS the agent → its accent is the provider accent (PROVIDER_ACCENT[HARNESS]), falling
  // back to the system fixed assistant amber. a token var so it re-themes; fed to the ProviderIcon
  // (accent prop) and the rolelabel colour. user stays teal / subagent mauve (their .user/.sub CSS).
  const asstAccent = PROVIDER_ACCENT[HARNESS] ? `var(--${PROVIDER_ACCENT[HARNESS]})` : 'var(--amber)'

  const head = (
    <div className="txn-turnhead">
      <span className="txn-rolelabel" style={turn.role === 'assistant' && !isSub ? { color: asstAccent } : undefined}>
        {turn.role === 'assistant' && !isSub ? <ProviderIcon harness={HARNESS} accent /> : isSub ? <CornerDownRight size={14} aria-hidden="true" /> : isUser ? <User size={14} aria-hidden="true" /> : <Wrench size={14} aria-hidden="true" />}
        {roleLabel}
      </span>
      {isSub && <span className="txn-depth tnum">depth {turn.depth}</span>}
      <span className="txn-turnnum tnum">#{turn.label}</span>
      <span className="txn-turntime" title={turn.longTime}>{turn.time}</span>
      <button
        type="button"
        className="txn-anchor"
        aria-label={'copy link to turn ' + turn.label}
        title="copy link to this turn"
        onClick={() => onCopyAnchor(turn.id)}
      >
        {copied ? <Check size={13} aria-hidden="true" /> : <LinkIcon size={13} aria-hidden="true" />}
      </button>
      {onLabel && (
        <button type="button" className="txn-labelbtn" onClick={() => onLabel(turn.id)}>
          label
        </button>
      )}
      {turn.error && <span className="chip chip-err txn-pill"><AlertTriangle size={12} aria-hidden="true" /> error</span>}
      <span className="txn-tokbadge tnum" title={fmtTokens(turn.tokens.in) + ' in · ' + fmtTokens(turn.tokens.out) + ' out'}>
        <Coins size={12} aria-hidden="true" /> {fmtTokens(turn.tokens.in + turn.tokens.out)}
      </span>
    </div>
  )

  const body = (
    <>
      {savedLabel && (
        <div className="txn-savedchips">
          <span className={'chip ' + (savedLabel.outcome === 'bad' ? 'chip-err' : savedLabel.outcome === 'good' ? 'chip-ok' : '')} title={'saved label · ' + savedLabel.outcome}>
            {savedLabel.outcome}{savedLabel.flag ? ' · ' + savedLabel.flag : ''}
          </span>
        </div>
      )}
      <Markdown text={turn.body} />
      {turn.thinking && <Thinking block={turn.thinking} />}
      {turn.tools &&
        turn.tools.map((t) => (
          <ToolCall key={t.id} tool={t} open={expandAll || !!openTools[t.id]} onToggle={() => toggleTool(t.id)} />
        ))}
    </>
  )

  const cardClass =
    'turn txn-turn ' +
    (isUser ? 'user' : isSub ? 'sub' : 'asst') +
    (active ? ' txn-active' : '') +
    (compact ? ' txn-compact' : '')

  return (
    <div className="txn-turnwrap" ref={(el) => registerRef(turn.id, el)} data-turn={turn.id} id={'turn-' + turn.id}>
      {isSub ? (
        <div className="subtask txn-subtask">
          <div className="subtask-head">
            <CornerDownRight size={13} aria-hidden="true" /> <span className="who">{turn.subagent}</span> subagent
          </div>
          <div className={cardClass}>
            {head}
            {body}
          </div>
          <div className="subtask-foot">
            <span className="elbow"><CornerDownRight size={13} aria-hidden="true" /> returned to claude</span>
          </div>
        </div>
      ) : (
        <div className={cardClass}>
          {head}
          {body}
        </div>
      )}
      {turn.checkpoint && (
        <div className="marker txn-checkpoint">
          <span className="r" />
          <span className="mc">
            <GitCommitHorizontal size={14} aria-hidden="true" />
            <span className="hash mono">{turn.checkpoint.hash}</span>
            <span className="txn-cp-msg">{turn.checkpoint.msg}</span>
            <span className="txn-cp-stat tnum">+{turn.checkpoint.adds} −{turn.checkpoint.dels} · {turn.checkpoint.files} files</span>
          </span>
          <span className="r" />
        </div>
      )}
    </div>
  )
}

/* a tiny markdown-ish renderer: **bold** + `code`, plain text otherwise (chrome
   stays minimal; the content keeps its case). search highlight handled by caller. */
function Markdown({ text }) {
  const parts = useMemo(() => {
    const out = []
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
    let last = 0
    let m
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) })
      const tok = m[0]
      if (tok.startsWith('**')) out.push({ t: 'b', v: tok.slice(2, -2) })
      else out.push({ t: 'code', v: tok.slice(1, -1) })
      last = m.index + tok.length
    }
    if (last < text.length) out.push({ t: 'text', v: text.slice(last) })
    return out
  }, [text])
  return (
    <div className="body txn-body">
      {parts.map((p, i) =>
        p.t === 'b' ? <b key={i}>{p.v}</b> : p.t === 'code' ? <code key={i} className="txn-inlinecode">{p.v}</code> : <span key={i}>{p.v}</span>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- trajectory graph (hand-rolled svg) */
function TrajectoryGraph({ turns, activeTurn, onSelect }) {
  const [zoom, setZoom] = useState(1)
  const [hover, setHover] = useState(null)
  const W = 520
  const laneX = 150
  const subLaneX = 320
  const rowH = 92
  const top = 28
  const H = top + turns.length * rowH

  const nodes = turns.map((t, i) => ({
    t,
    i,
    x: t.depth ? subLaneX : laneX,
    y: top + i * rowH,
  }))

  return (
    <div className="txn-graphwrap">
      <div className="canvas txn-canvas" role="img" aria-label="trajectory graph of the session">
        <div className="txn-graph-scroll">
          <svg
            className="txn-graph-svg"
            viewBox={`0 0 ${W} ${H}`}
            width={W * zoom}
            height={H * zoom}
            style={{ display: 'block' }}
          >
            {/* sequential edges down the main rail */}
            {nodes.slice(0, -1).map((n, i) => {
              const next = nodes[i + 1]
              return (
                <line
                  key={'e' + i}
                  x1={n.t.depth ? subLaneX : laneX}
                  y1={n.y + 30}
                  x2={next.t.depth ? subLaneX : laneX}
                  y2={next.y}
                  stroke="var(--rule-strong)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
            {/* subagent lane header */}
            <line x1={subLaneX} y1={top} x2={subLaneX} y2={H - 20} stroke="var(--rule)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={subLaneX} y={18} className="txn-graph-lane" textAnchor="middle">subagent · docs-writer · d1</text>

            {nodes.map((n) => {
              const isUser = n.t.role === 'user'
              const sel = activeTurn === n.t.id
              const hot = hover === n.t.id
              const fill = sel ? 'color-mix(in srgb, var(--amber) 14%, var(--surface-2))' : 'var(--surface-2)'
              return (
                <g key={n.t.id} transform={`translate(${n.x - 64}, ${n.y})`}>
                  <rect
                    width="128"
                    height="60"
                    fill={fill}
                    stroke={sel ? 'var(--amber)' : n.t.error ? 'var(--clay)' : 'var(--rule-strong)'}
                    strokeWidth={sel || hot ? 1.5 : 1}
                    vectorEffect="non-scaling-stroke"
                    className="txn-graph-node"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelect(n.t.id)}
                    onMouseEnter={() => setHover(n.t.id)}
                    onMouseLeave={() => setHover((h) => (h === n.t.id ? null : h))}
                  />
                  <text x="8" y="16" className="txn-graph-role">{isUser ? 'you' : n.t.depth ? 'subagent' : 'claude'}</text>
                  <text x="120" y="16" textAnchor="end" className="txn-graph-num">#{n.t.label}</text>
                  <text x="8" y="33" className="txn-graph-prev">{(n.t.body || '').slice(0, 22)}…</text>
                  <text x="8" y="50" className="txn-graph-meta">
                    {(n.t.tools ? n.t.tools.length : 0)} tools · {fmtTokens(n.t.tokens.in + n.t.tokens.out)}
                  </text>
                  {n.t.error && <rect x="0" y="0" width="3" height="60" fill="var(--clay)" />}
                </g>
              )
            })}

            {/* tool pill cluster beside turns with tools */}
            {nodes.filter((n) => n.t.tools && n.t.tools.length && !n.t.depth).map((n) => (
              <g key={'tp' + n.t.id} transform={`translate(${laneX + 74}, ${n.y + 6})`}>
                {n.t.tools.slice(0, 2).map((tool, ti) => (
                  <g key={tool.id} transform={`translate(0, ${ti * 22})`}>
                    <rect width="86" height="18" fill="var(--surface)" stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    <text x="6" y="13" className="txn-graph-tool">{tool.name.toLowerCase()}</text>
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </div>

        {/* zoom / fit / reset controls — reuse .canvas-ctrls */}
        <div className="canvas-ctrls">
          <button type="button" aria-label="zoom in" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.2).toFixed(2)))}><Plus size={14} aria-hidden="true" /></button>
          <button type="button" aria-label="zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))}><Minus size={14} aria-hidden="true" /></button>
          <button type="button" aria-label="fit view" onClick={() => setZoom(1)}><Maximize size={14} aria-hidden="true" /></button>
          <button type="button" aria-label="reset" onClick={() => setZoom(1)}><RefreshCw size={14} aria-hidden="true" /></button>
        </div>

        {/* minimap */}
        <div className="minimap" aria-hidden="true">
          {nodes.map((n, i) => (
            <i key={n.t.id} style={{ left: n.t.depth ? '60%' : '24%', top: (i / nodes.length) * 100 + 4 + '%', width: '20%', height: '7%', background: n.t.error ? 'var(--clay)' : activeTurn === n.t.id ? 'var(--amber)' : 'var(--ink-5)' }} />
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="txn-graph-legend" aria-hidden="true">
        <span><span className="txn-leg-glyph" style={{ background: 'var(--teal)' }} /> you</span>
        <span><span className="txn-leg-glyph" style={{ background: 'var(--amber)' }} /> claude</span>
        <span><span className="txn-leg-glyph" style={{ background: 'var(--mauve)' }} /> subagent</span>
        <span><span className="txn-leg-glyph txn-leg-tool" /> tool</span>
        <span><span className="txn-leg-glyph" style={{ background: 'var(--clay)' }} /> error</span>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- scorecard */
const SCORECARD = [
  {
    id: 'token',
    icon: Coins,
    label: 'token efficiency',
    headline: '8% retry tokens',
    band: 'watch',
    flags: ['1,300 tokens spent on the retry after typecheck', 'context window 42% used', 'output survival 88%'],
    delta: { dir: 'down', text: '4 pts below your median' },
  },
  {
    id: 'prompt',
    icon: FileText,
    label: 'prompt quality',
    headline: 'spec 72/100',
    band: 'ok',
    flags: ['has examples', 'no explicit constraints', 'signal-to-noise 64%'],
    delta: { dir: 'up', text: '6 pts above your median' },
  },
  {
    id: 'loop',
    icon: RefreshCw,
    label: 'loop efficiency',
    headline: '1 max error streak',
    band: 'ok',
    flags: ['1 revert detected', 'no retry loops', 'recovered in 1 turn'],
    delta: { dir: 'up', text: '2 pts above your median' },
  },
]

const BAND_META = {
  ok: { label: 'on track', chip: 'chip-ok' },
  watch: { label: 'watch', chip: 'chip-warn' },
  off: { label: 'off track', chip: 'chip-err' },
}

function Scorecard() {
  return (
    <div className="txn-scorecard">
      <div className="txn-sc-head">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>how this session went</span>
      </div>
      <div className="txn-sc-grid">
        {SCORECARD.map((s) => {
          const Icon = s.icon
          const band = BAND_META[s.band]
          const Trend = s.delta.dir === 'up' ? TrendingUp : TrendingDown
          return (
            <div className="txn-sc-card" key={s.id}>
              <div className="txn-sc-axis">
                <Icon size={14} aria-hidden="true" /> {s.label}
              </div>
              <div className="txn-sc-headline">{s.headline}</div>
              <span className={'chip txn-sc-band ' + band.chip}>{band.label}</span>
              <ul className="txn-sc-flags">
                {s.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className={'txn-sc-delta ' + (s.delta.dir === 'up' ? 'txn-up' : 'txn-down')}>
                <Trend size={13} aria-hidden="true" /> {s.delta.text}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================================
   MAIN
============================================================================ */
const TABS = [
  { id: 'highlights', label: 'highlights', count: HIGHLIGHTS.length },
  { id: 'trace', label: 'full trace', count: TURNS.length },
  { id: 'diffs', label: 'diffs', count: 1 },
  { id: 'files', label: 'files', count: FILES.length },
  { id: 'annotations', label: 'annotations', count: ANNOTATIONS.length },
]

const CATEGORIES = [
  { id: 'prompts', label: 'prompts', count: 2 },
  { id: 'responses', label: 'responses', count: 6 },
  { id: 'thinking', label: 'thinking', count: 2 },
  { id: 'toolcalls', label: 'tool calls', count: 5 },
]

export default function TranscriptApp({ theme = 'dark' }) {
  const [tab, setTab] = useState('trace')
  const [viewMode, setViewMode] = useState('list') // list | graph
  const [openTools, setOpenTools] = useState({ t1a: true, t4a: true, t5a: true })
  const [activeTurn, setActiveTurn] = useState(0)
  const [copiedTurn, setCopiedTurn] = useState(null)
  const [savedLabels, setSavedLabels] = useState({}) // turnId -> {outcome, flag}
  const [labelFor, setLabelFor] = useState(null) // turnId open in popover

  /* roving keyboard nav for the top tab strip, self-contained (this was previously supplied
     by a global delegated tablist effect in App.jsx that has since been removed). arrows wrap,
     home/end jump, and focus follows selection - matching the shared ui/Tabs component. */
  const tabRefs = useRef({})
  const onTabKey = (e) => {
    const ids = TABS.map((t) => t.id)
    const i = ids.indexOf(tab)
    if (i < 0) return
    let j = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % ids.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + ids.length) % ids.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = ids.length - 1
    else return
    e.preventDefault()
    setTab(ids[j])
    tabRefs.current[ids[j]]?.focus()
  }

  /* action menu state */
  const [shareOpen, setShareOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  /* filters */
  const [cats, setCats] = useState({ prompts: true, responses: true, thinking: true, toolcalls: true })
  const [toolGroups, setToolGroups] = useState(() => Object.fromEntries(TOOL_GROUPS.map((g) => [g.id, true])))
  const [toolGroupsOpen, setToolGroupsOpen] = useState(true)
  const [tags, setTags] = useState({ errors: false, retries: false, revert: false })
  const [views, setViews] = useState({ hidden: true, expandAll: false, compact: false })
  const [checkpointOpen, setCheckpointOpen] = useState(false)
  const [checkpoint, setCheckpoint] = useState('all')

  /* diffs tab */
  const [diffMode, setDiffMode] = useState('file') // file | turn
  const [diffGroupsOpen, setDiffGroupsOpen] = useState({ 'packages/browser/src/lib/tasks.ts': true })

  /* files tab sort */
  const [fileSort, setFileSort] = useState({ key: 'path', dir: 'asc' })

  /* search overlay */
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matchIdx, setMatchIdx] = useState(0)

  /* sticky condensed header */
  const [sticky, setSticky] = useState(false)

  const turnRefs = useRef({})
  const scrollRef = useRef(null)
  const searchInputRef = useRef(null)
  const draggingRef = useRef(false)

  const registerRef = useCallback((id, el) => {
    if (el) turnRefs.current[id] = el
  }, [])

  const toggleTool = (id) => setOpenTools((o) => ({ ...o, [id]: !o[id] }))

  /* filtered turn set (categories OR-ish at the turn level; tags AND) */
  const visibleTurns = useMemo(() => {
    return TURNS.filter((t) => {
      if (t.role === 'user' && !cats.prompts) return false
      if (t.role === 'assistant' && !cats.responses) return false
      if (tags.errors && !t.error && !(t.tools && t.tools.some((x) => x.kind === 'bash' && x.exit !== 0))) return false
      if (checkpoint !== 'all') {
        // scope to turns up to & including the checkpoint turn
        if (t.id > 6) return false
      }
      return true
    })
  }, [cats, tags, checkpoint])

  const filtersActive =
    (cats.prompts ? 0 : 1) +
    (cats.responses ? 0 : 1) +
    (cats.thinking ? 0 : 1) +
    (cats.toolcalls ? 0 : 1) +
    (tags.errors ? 1 : 0) +
    (tags.retries ? 1 : 0) +
    (tags.revert ? 1 : 0) +
    Object.values(toolGroups).filter((v) => !v).length

  /* search matches: simple substring across turn bodies + tool previews */
  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const found = []
    for (const t of TURNS) {
      if ((t.body || '').toLowerCase().includes(q)) found.push({ turn: t.id, where: 'body' })
      for (const tool of t.tools || []) {
        const hay = [tool.preview, tool.stdout, tool.results, tool.excerpt, tool.result].filter(Boolean).join(' ').toLowerCase()
        if (hay.includes(q)) found.push({ turn: t.id, where: tool.id })
      }
    }
    return found
  }, [query])

  /* scroll the active match into view */
  useEffect(() => {
    if (!searchOpen || matches.length === 0) return
    const m = matches[Math.min(matchIdx, matches.length - 1)]
    const el = turnRefs.current[m.turn]
    const sc = scrollRef.current
    if (el && sc) {
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      sc.scrollTo({ top: el.offsetTop - 12, behavior: reduce ? 'auto' : 'smooth' })
      setActiveTurn(m.turn)
    }
  }, [matchIdx, matches, searchOpen])

  /* global cmd/ctrl+F + j/k nav */
  useEffect(() => {
    function onKey(e) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setSearchOpen(true)
        setTab('trace')
        setTimeout(() => searchInputRef.current?.focus(), 0)
        return
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        return
      }
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      if (searchOpen || typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (tab !== 'trace' || viewMode !== 'list') return
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        stepTurn(1)
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        stepTurn(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen, tab, viewMode, activeTurn, visibleTurns])

  function jumpTo(id, { switchTab = true } = {}) {
    if (switchTab && tab !== 'trace') setTab('trace')
    setViewMode('list')
    setActiveTurn(id)
    requestAnimationFrame(() => {
      const el = turnRefs.current[id]
      const sc = scrollRef.current
      if (el && sc) {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        sc.scrollTo({ top: el.offsetTop - 12, behavior: reduce ? 'auto' : 'smooth' })
      }
    })
  }

  function stepTurn(dir) {
    const ids = visibleTurns.map((t) => t.id)
    const cur = ids.indexOf(activeTurn)
    const next = Math.max(0, Math.min(ids.length - 1, cur + dir))
    jumpTo(ids[next], { switchTab: false })
  }

  function copyAnchor(id) {
    setCopiedTurn(id)
    if (navigator.clipboard) navigator.clipboard.writeText('https://transcripts.peasant.dev/sess_dem#turn-' + id).catch(() => {})
    setTimeout(() => setCopiedTurn((c) => (c === id ? null : c)), 1500)
  }

  function copyLink() {
    setCopiedLink(true)
    if (navigator.clipboard) navigator.clipboard.writeText('https://transcripts.peasant.dev/sess_dem').catch(() => {})
    setTimeout(() => setCopiedLink(false), 1500)
  }

  function saveLabel(outcome, flag) {
    if (labelFor == null) return
    setSavedLabels((m) => ({ ...m, [labelFor]: { outcome, flag } }))
    setLabelFor(null)
  }

  /* scroll handler: drives sticky reveal + active turn. the scrubber bracket now
     tracks the active turn (turn-index space), so no scroll-fraction is needed. */
  function onScroll() {
    const sc = scrollRef.current
    if (!sc) return
    setSticky(sc.scrollTop > 56)
    // active turn = the last turn whose top has crossed the 40% threshold line
    let best = visibleTurns[0]?.id ?? 0
    for (const t of visibleTurns) {
      const el = turnRefs.current[t.id]
      if (el && el.offsetTop - sc.scrollTop <= sc.clientHeight * 0.4) best = t.id
    }
    setActiveTurn(best)
  }

  /* scrubber drag (click-to-seek + draggable bracket). the track is in turn-index
     space — ticks sit at i/(N-1) — so map the cursor to the NEAREST tick and scroll
     that turn to the top of the viewport. this keeps the mouse, the bracket and the
     active turn in lockstep (the old version seeked by raw scroll fraction, which
     never matched the evenly-spaced ticks). */
  function seekScrub(clientX, track) {
    const rect = track.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const last = TURNS.length - 1
    const idx = last > 0 ? Math.round(frac * last) : 0
    const id = TURNS[idx].id
    const el = turnRefs.current[id]
    const sc = scrollRef.current
    if (el && sc) {
      sc.scrollTo({ top: el.offsetTop - 12, behavior: 'auto' })
      setActiveTurn(id)
    }
  }

  const progress = useMemo(() => {
    const idx = visibleTurns.findIndex((t) => t.id === activeTurn)
    return { cur: Math.max(1, idx + 1), total: visibleTurns.length }
  }, [activeTurn, visibleTurns])

  /* sorted files for the Files tab */
  const sortedFiles = useMemo(() => {
    const arr = [...FILES]
    arr.sort((a, b) => {
      let cmp = 0
      if (fileSort.key === 'path') cmp = a.path.localeCompare(b.path)
      else cmp = a.adds + a.dels - (b.adds + b.dels)
      return fileSort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [fileSort])

  const editedFiles = FILES.filter((f) => f.edited)

  /* turns containing edits for the Diffs tab */
  const diffTurns = TURNS.filter((t) => t.tools && t.tools.some((x) => x.kind === 'edit'))

  return (
    <div className={'txn-app' + (theme === 'light' ? ' txn-light' : '')}>
      {/* ===================== HEADER ===================== */}
      <header className="txn-header">
        <div className="txn-header-top">
          <nav className="crumb txn-crumb" aria-label="breadcrumb">
            <a className="link" href="#">sessions</a>
            <ChevronRight size={13} aria-hidden="true" />
            <a className="link" href="#">transcript-browser</a>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="cur">sess_dem</span>
          </nav>

          {/* ===== ACTION MENU ===== */}
          <div className="txn-actions">
            <div className="menu-anchor">
              <button
                type="button"
                className="btn btn-secondary btn-sm menu-trigger"
                aria-expanded={shareOpen}
                aria-haspopup="menu"
                onClick={() => { setShareOpen((o) => !o); setMoreOpen(false) }}
              >
                <Share2 size={14} aria-hidden="true" /> share
                <ChevronDown size={13} aria-hidden="true" className="menu-caret" />
              </button>
              {shareOpen && (
                <div className="menu-pop menu-float" data-align="end" role="menu" aria-label="share">
                  <ul className="menu-list">
                    <li><button type="button" className="menu-item" role="menuitem" onClick={() => setShareOpen(false)}><Users size={14} aria-hidden="true" /><span className="menu-text">contribute</span></button></li>
                    <li>
                      <button type="button" className="menu-item" role="menuitem" onClick={copyLink}>
                        {copiedLink ? <Check size={14} aria-hidden="true" /> : <LinkIcon size={14} aria-hidden="true" />}
                        <span className="menu-text">{copiedLink ? 'copied' : 'copy link'}</span>
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="menu-anchor">
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-icon menu-trigger"
                aria-label="more actions"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => { setMoreOpen((o) => !o); setShareOpen(false) }}
              >
                <MoreHorizontal size={14} aria-hidden="true" />
              </button>
              {moreOpen && (
                <div className="menu-pop menu-float txn-more-pop" data-align="end" role="menu" aria-label="more actions">
                  <ul className="menu-list">
                    <li><button type="button" className="menu-item" role="menuitem" onClick={() => setMoreOpen(false)}><Pencil size={14} aria-hidden="true" /><span className="menu-text">edit</span></button></li>
                    <li role="separator"><hr className="menu-sep" /></li>
                    <li className="menu-cap">download</li>
                    <li><button type="button" className="menu-item" role="menuitem" onClick={() => setMoreOpen(false)}><Download size={14} aria-hidden="true" /><span className="menu-text">json</span></button></li>
                    <li><button type="button" className="menu-item" role="menuitem" onClick={() => setMoreOpen(false)}><Download size={14} aria-hidden="true" /><span className="menu-text">jsonl</span></button></li>
                    <li><button type="button" className="menu-item" role="menuitem" onClick={() => setMoreOpen(false)}><Download size={14} aria-hidden="true" /><span className="menu-text">markdown</span></button></li>
                    <li role="separator"><hr className="menu-sep" /></li>
                    <li><button type="button" className="menu-item" role="menuitem" onClick={() => setMoreOpen(false)}><MessageSquareText size={14} aria-hidden="true" /><span className="menu-text">chat with trace</span></button></li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <h2 className="txn-title" title="Port the transcript canvas into the shared package">
          Port the transcript canvas into the shared package
        </h2>

        {/* ===== METADATA CHIPS ===== */}
        <div className="txn-meta chips">
          <span className="chip chip-ok" title="resolved · typecheck + build green, committed">
            <ShieldCheck size={14} aria-hidden="true" /> resolved
          </span>
          <span className="chip"><span className="g-claude"><ClaudeMark /></span> claude code</span>
          <span className="chip mono">claude-opus-4-7</span>
          <span className="metaitem"><User size={14} aria-hidden="true" /> Dev</span>
          <span className="metaitem" title="started 8 minutes ago"><Clock size={14} aria-hidden="true" /> <b className="tnum">8m</b></span>
          <span className="metaitem"><ListTree size={14} aria-hidden="true" /> <b className="tnum">8</b> turns</span>
          <span className="metaitem"><Wrench size={14} aria-hidden="true" /> <b className="tnum">5</b> tools</span>
          <span className="metaitem" title="12.2k in · 6.2k out"><Coins size={14} aria-hidden="true" /> <b className="tnum">18.4k</b> tokens</span>
          <span className="metaitem"><GitCommitHorizontal size={14} aria-hidden="true" /> <b className="tnum">1</b> commit</span>
          <span className="metaitem"><FileText size={14} aria-hidden="true" /> <b className="tnum">7</b> files</span>
          <span className="metaitem txn-churn-meta tnum"><span className="txn-churn-add">+312</span> <span className="txn-churn-del">−24</span></span>
        </div>
      </header>

      {/* ===================== TAB STRIP ===================== */}
      <div className="tabs txn-tabs" role="tablist" aria-label="session views" onKeyDown={onTabKey}>
        {TABS.map((t) => {
          const on = tab === t.id
          return (
            <button
              key={t.id}
              ref={(el) => (tabRefs.current[t.id] = el)}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              className={'tab txn-tab' + (on ? ' active' : '')}
              onClick={() => setTab(t.id)}
            >
              {t.label} <span className="cnt tnum">{t.count}</span>
            </button>
          )
        })}
      </div>

      {/* ===================== BODY ===================== */}
      {/* split layout matching the viewer's railLayout="split": outline (user turns) left, transcript
         centre, filters right. */}
      <div className="txn-body-grid">
        {/* ---- LEFT: outline / user turns ---- */}
        <aside className="txn-rail txn-rail-left" aria-label="user turns outline">
          <div className="txn-rail-head"><LayoutList size={13} aria-hidden="true" /> user turns</div>
          <div className="txn-rail-body">
            <OutlineRail tab={tab} activeTurn={activeTurn} onJump={jumpTo} />
          </div>
        </aside>

        {/* ---- CENTER ---- */}
        <main className="txn-center" role="tabpanel" aria-label={tab}>
          {tab === 'trace' && (
            <div className={'txn-trace' + (sticky && viewMode === 'list' ? ' txn-trace-pinned' : '')}>
              {/* tier 1 — condensed scrubber header, pinned ABOVE the turns bar
                  (revealed once you scroll past the full header). it overlays the top
                  strip of .txn-trace; the turns bar reserves space beneath it. */}
              {sticky && viewMode === 'list' && (
                <div className="txn-sticky">
                  <span className="g-claude"><ClaudeMark /></span>
                  <span className="txn-sticky-title">transcript-browser</span>
                  <span className="txn-sticky-model mono">claude-opus-4-7</span>
                  <Scrubber turns={TURNS} active={activeTurn} onSeek={seekScrub} draggingRef={draggingRef} />
                </div>
              )}
              {/* tier 2 — the turns bar (count + list/graph toggle) */}
              <div className="txn-trace-head">
                <span className="txn-trace-count tnum">
                  {visibleTurns.length === TURNS.length ? `${TURNS.length} turns` : `${visibleTurns.length} of ${TURNS.length} turns`}
                </span>
                <div className="bs-seg txn-viewtoggle" role="group" aria-label="view mode">
                  <button type="button" className="bs-seg-opt" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>
                    <List size={14} aria-hidden="true" /> list
                  </button>
                  <button type="button" className="bs-seg-opt" aria-pressed={viewMode === 'graph'} onClick={() => setViewMode('graph')}>
                    <Network size={14} aria-hidden="true" /> graph
                  </button>
                </div>
              </div>

              {viewMode === 'graph' ? (
                <TrajectoryGraph turns={TURNS} activeTurn={activeTurn} onSelect={(id) => setActiveTurn(id)} />
              ) : (
                <div className="txn-streamwrap">
                {/* tier 3 — per-phase stickies pin at the top of the scroller, which
                    already sits below tiers 1+2, so they need no extra offset */}
                <div className="txn-stream" ref={scrollRef} onScroll={onScroll} tabIndex={-1}>
                  {visibleTurns.length === 0 && (
                    <div className="empty"><div className="ring"><FilterIcon size={20} aria-hidden="true" /></div><h3>no turns to display</h3><p>every turn is filtered out. clear a filter to bring them back.</p></div>
                  )}
                  {visibleTurns.map((t, i) => {
                    const prev = visibleTurns[i - 1]
                    const phase = PHASES.find((p) => t.id >= p.from && t.id <= p.to)
                    const showPhase = views.hidden && phase && (!prev || PHASES.find((p) => prev.id >= p.from && prev.id <= p.to)?.id !== phase.id)
                    const showTask = t.role === 'user' && t.userTurn
                    return (
                      <div key={t.id}>
                        {showPhase && (
                          <div className="phase txn-phase">
                            <span className="lbl"><phase.icon size={14} aria-hidden="true" /> {phase.label}</span>
                            <span className="rng tnum">turns {phase.from}–{phase.to}{phase.errors ? ` · ${phase.errors} error` : ''}</span>
                          </div>
                        )}
                        {showTask && (
                          <div className="txn-taskboundary">
                            <span className="txn-tb-chip">user turn {t.userTurn}</span>
                            <span className="txn-tb-meta tnum">
                              {t.userTurn === 1 ? '5m · 3 tools · 5 files' : '3m · 3 tools · 2 files · +316 −25'}
                            </span>
                          </div>
                        )}
                        <TurnCard
                          turn={t}
                          active={activeTurn === t.id}
                          openTools={openTools}
                          toggleTool={toggleTool}
                          onCopyAnchor={copyAnchor}
                          copied={copiedTurn === t.id}
                          registerRef={registerRef}
                          onLabel={(id) => setLabelFor(id)}
                          savedLabel={savedLabels[t.id]}
                          compact={views.compact}
                          expandAll={views.expandAll}
                        />
                      </div>
                    )
                  })}
                </div>
                </div>
              )}
            </div>
          )}

          {tab === 'highlights' && (
            <div className="txn-highlights">
              <Scorecard />
              <div className="txn-hl-cards">
                {HIGHLIGHTS.map((h) => {
                  const Icon = h.icon
                  const isStatic = h.kind === 'checkpoint'
                  return (
                    <button
                      key={h.id}
                      type="button"
                      className={'txn-hl-card' + (isStatic ? ' txn-hl-static' : '')}
                      disabled={isStatic}
                      onClick={() => !isStatic && jumpTo(h.turn)}
                    >
                      <span className={'txn-hl-ico' + (h.err ? ' txn-hl-err' : '')}>
                        {h.kind === 'final' ? <ClaudeMark /> : <Icon size={15} aria-hidden="true" />}
                      </span>
                      <span className="txn-hl-text">
                        <span className="txn-hl-title">{h.title}{h.tag && <span className="txn-hl-tag">{h.tag}</span>}</span>
                        <span className="txn-hl-sub">{h.sub}</span>
                        {h.stat && <span className="txn-hl-stat tnum">{h.stat}</span>}
                      </span>
                      <span className="txn-hl-side">
                        {h.err && <span className="chip chip-err txn-pill"><AlertTriangle size={12} aria-hidden="true" /> failed</span>}
                        {h.tokens && <span className="txn-tokbadge tnum"><Coins size={12} aria-hidden="true" /> {h.tokens}</span>}
                        {h.time && <span className="txn-hl-time">{h.time}</span>}
                        {!isStatic && <ChevronRight size={14} aria-hidden="true" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'diffs' && (
            <div className="txn-diffs">
              <div className="txn-diffs-head">
                <span className="txn-diffs-count tnum">1 edit across 1 file</span>
                <div className="bs-seg" role="group" aria-label="group diffs by">
                  <button type="button" className="bs-seg-opt" aria-pressed={diffMode === 'file'} onClick={() => setDiffMode('file')}>by file</button>
                  <button type="button" className="bs-seg-opt" aria-pressed={diffMode === 'turn'} onClick={() => setDiffMode('turn')}>by turn</button>
                </div>
              </div>

              {diffMode === 'file' ? (
                <div className="txn-filegroup" id="diff-file-tasks">
                  <button
                    type="button"
                    className="txn-fg-head"
                    aria-expanded={!!diffGroupsOpen['packages/browser/src/lib/tasks.ts']}
                    onClick={() => setDiffGroupsOpen((m) => ({ ...m, 'packages/browser/src/lib/tasks.ts': !m['packages/browser/src/lib/tasks.ts'] }))}
                  >
                    {diffGroupsOpen['packages/browser/src/lib/tasks.ts'] ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                    <Pencil size={14} aria-hidden="true" />
                    <span className="mono txn-fg-path">packages/browser/src/lib/tasks.ts</span>
                    <span className="chipx-count">1 edit</span>
                    <span className="txn-churn tnum"><span className="txn-churn-add">+3</span> <span className="txn-churn-del">−1</span></span>
                  </button>
                  {diffGroupsOpen['packages/browser/src/lib/tasks.ts'] && (
                    <DiffEntryCard turn={TURNS[5]} tool={TURNS[5].tools[0]} onJump={() => jumpTo(5)} />
                  )}
                </div>
              ) : (
                <div className="txn-difflist">
                  {diffTurns.map((t) => (
                    <DiffEntryCard key={t.id} turn={t} tool={t.tools.find((x) => x.kind === 'edit')} byTurn onJump={() => jumpTo(t.id)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'files' && (
            <div className="txn-files">
              <table className="dtable txn-filetable">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="txn-sort" onClick={() => setFileSort((s) => ({ key: 'path', dir: s.key === 'path' && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                        file {fileSort.key === 'path' ? (fileSort.dir === 'asc' ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />) : null}
                      </button>
                    </th>
                    <th className="txn-files-churn-col">
                      <button type="button" className="txn-sort" onClick={() => setFileSort((s) => ({ key: 'churn', dir: s.key === 'churn' && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                        lines +/− {fileSort.key === 'churn' ? (fileSort.dir === 'asc' ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />) : null}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiles.map((f) => (
                    <tr key={f.path} className="txn-filerow" onClick={() => (f.edited ? setTab('diffs') : jumpTo(f.turn))} title={f.edited ? 'jump to diffs' : 'jump to last read'}>
                      <td>
                        <span className="txn-file-cell">
                          {f.edited ? <Pencil size={13} aria-hidden="true" /> : <FileText size={13} aria-hidden="true" />}
                          <span className="mono txn-file-path">…/{f.leaf}</span>
                          <span className="txn-file-counts tnum">{f.reads ? `${f.reads}r ` : ''}{f.edits ? `${f.edits}e ` : ''}{f.writes ? `${f.writes}w` : ''}</span>
                        </span>
                      </td>
                      <td className="txn-files-churn-col">
                        {f.adds || f.dels ? (
                          <span className="txn-churn tnum"><span className="txn-churn-add">+{f.adds}</span> <span className="txn-churn-del">−{f.dels}</span></span>
                        ) : (
                          <span className="txn-readonly tnum" title="read-only, no edits">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'annotations' && (
            <div className="txn-annotations">
              <p className="txn-anno-intro">auto-detected friction moments: tool errors and non-zero exits, retry loops, edits that re-touch a file, and subagent spawns. click a row to jump to the turn.</p>
              {ANNOTATIONS.map((a) => {
                const meta = ANNOTATION_META[a.type]
                const Icon = meta.icon
                return (
                  <button key={a.id} type="button" className="txn-anno-row" onClick={() => jumpTo(a.turn)}>
                    <span className="txn-anno-turn tnum">turn {a.turn} · assistant</span>
                    <span className={'chip txn-pill ' + meta.chip} title={meta.tip}><Icon size={12} aria-hidden="true" /> {meta.label}</span>
                    <span className="txn-anno-label">{a.label}</span>
                    <span className="txn-anno-preview mono">{a.preview}</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          )}
        </main>

        {/* ---- RIGHT: filters ---- */}
        <aside className="txn-rail txn-rail-right" aria-label="filters">
          <div className="txn-rail-head">
            <SlidersHorizontal size={13} aria-hidden="true" /> filters
            {filtersActive > 0 && <span className="chipx-count unread tnum">{filtersActive}</span>}
          </div>
          <div className="txn-rail-body">
            <FiltersRail
                tab={tab}
                cats={cats}
                setCats={setCats}
                toolGroups={toolGroups}
                setToolGroups={setToolGroups}
                toolGroupsOpen={toolGroupsOpen}
                setToolGroupsOpen={setToolGroupsOpen}
                tags={tags}
                setTags={setTags}
                views={views}
                setViews={setViews}
                checkpoint={checkpoint}
                setCheckpoint={setCheckpoint}
                checkpointOpen={checkpointOpen}
                setCheckpointOpen={setCheckpointOpen}
                filtersActive={filtersActive}
                onClear={() => {
                  setCats({ prompts: true, responses: true, thinking: true, toolcalls: true })
                  setToolGroups(Object.fromEntries(TOOL_GROUPS.map((g) => [g.id, true])))
                  setTags({ errors: false, retries: false, revert: false })
                }}
                onJumpStart={() => jumpTo(visibleTurns[0]?.id ?? 0, { switchTab: false })}
                onJumpLatest={() => jumpTo(visibleTurns[visibleTurns.length - 1]?.id ?? 0, { switchTab: false })}
              />
          </div>
        </aside>
      </div>

      {/* ===================== OVERLAYS ===================== */}
      {searchOpen && (
        <div className="txn-search">
          <Search size={15} aria-hidden="true" className="txn-search-ico" />
          <input
            ref={searchInputRef}
            className="txn-search-input"
            placeholder="search across turns, tool args, and results…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setMatchIdx(0) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); setMatchIdx((i) => (matches.length ? (e.shiftKey ? (i - 1 + matches.length) % matches.length : (i + 1) % matches.length) : 0)) }
              if (e.key === 'Escape') setSearchOpen(false)
            }}
            aria-label="search transcript"
          />
          <span className="txn-search-count tnum">{matches.length ? `${matchIdx + 1}/${matches.length}` : '0 matches'}</span>
          <button type="button" className="txn-search-nav" aria-label="previous match" disabled={!matches.length} onClick={() => setMatchIdx((i) => (i - 1 + matches.length) % matches.length)}><ChevronUp size={14} aria-hidden="true" /></button>
          <button type="button" className="txn-search-nav" aria-label="next match" disabled={!matches.length} onClick={() => setMatchIdx((i) => (i + 1) % matches.length)}><ChevronDown size={14} aria-hidden="true" /></button>
          <kbd className="kbd-key txn-search-esc">esc</kbd>
          <button type="button" className="txn-search-x" aria-label="close search" onClick={() => setSearchOpen(false)}><X size={14} aria-hidden="true" /></button>
        </div>
      )}

      {/* progress indicator */}
      {tab === 'trace' && viewMode === 'list' && visibleTurns.length > 0 && (
        <div className="txn-progress tnum" aria-hidden="true">{progress.cur} of {progress.total}</div>
      )}

      {/* per-turn label popover */}
      {labelFor != null && (
        <LabelPopover
          turnId={labelFor}
          current={savedLabels[labelFor]}
          onSave={saveLabel}
          onClose={() => setLabelFor(null)}
        />
      )}

      {/* a hint strip so the search affordance is discoverable */}
      <div className="txn-hint">
        <kbd className="kbd-key">⌘</kbd><kbd className="kbd-key">f</kbd> search · <kbd className="kbd-key">j</kbd>/<kbd className="kbd-key">k</kbd> step turns
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- scrubber */
/* the scrubber lives in turn-index space: every tick sits at i/(N-1) of the
   track. the bracket and the active highlight must share that space, and a
   click must map back to a turn — otherwise the indicator drifts from the
   mouse and from the active turn (it used raw scroll fraction before). */
function Scrubber({ turns, active, onSeek, draggingRef }) {
  const trackRef = useRef(null)
  const last = turns.length - 1
  const activeIdx = Math.max(0, turns.findIndex((t) => t.id === active))
  /* the bracket follows the active turn, exactly co-located with its tick. */
  const bracketPct = last > 0 ? (activeIdx / last) * 100 : 0

  function down(e) {
    draggingRef.current = true
    if (trackRef.current) onSeek(e.clientX, trackRef.current)
  }
  useEffect(() => {
    function move(e) {
      if (draggingRef.current && trackRef.current) onSeek(e.clientX, trackRef.current)
    }
    function up() { draggingRef.current = false }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [onSeek, draggingRef])
  return (
    <div
      className="txn-scrub"
      ref={trackRef}
      role="slider"
      aria-label="position in transcript"
      aria-valuemin={1}
      aria-valuemax={turns.length}
      aria-valuenow={activeIdx + 1}
      aria-valuetext={'turn ' + (activeIdx + 1) + ' of ' + turns.length}
      tabIndex={0}
      onMouseDown={down}
    >
      {turns.map((t, i) => (
        <span
          key={t.id}
          className={'txn-scrub-tick' + (t.role === 'user' ? ' txn-tick-user' : '') + (t.error ? ' txn-tick-err' : '') + (active === t.id ? ' txn-tick-on' : '')}
          style={{ left: (last > 0 ? (i / last) * 100 : 0) + '%' }}
        />
      ))}
      <span className="txn-scrub-bracket" style={{ left: bracketPct + '%' }} aria-hidden="true" />
    </div>
  )
}

/* ---------------------------------------------------------------- diff entry card (Diffs tab) */
function DiffEntryCard({ turn, tool, byTurn, onJump }) {
  const Icon = tool.kind === 'write' ? FilePlus2 : Pencil
  return (
    <div className="txn-diffentry">
      <div className="txn-de-head">
        <Icon size={14} aria-hidden="true" />
        <span className="mono txn-de-label">{byTurn ? `turn ${turn.id}` : tool.path}</span>
        <span className="txn-churn tnum"><span className="txn-churn-add">+{tool.adds}</span> <span className="txn-churn-del">−{tool.dels}</span></span>
        <button type="button" className="txn-jump" onClick={onJump}>jump to turn <ArrowRight size={13} aria-hidden="true" /></button>
      </div>
      <div className="diff txn-diff">
        {tool.hunk.map((d, i) => (
          <div className={'dl ' + d.sign} key={i}>
            <span className="rail" />
            <span className="gut tnum">{d.a}</span>
            <span className="gut tnum">{d.b}</span>
            <span className="sign">{d.sign === 'add' ? '+' : d.sign === 'del' ? '−' : ''}</span>
            <span className="t">{d.t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- outline rail */
function OutlineRail({ tab, activeTurn, onJump }) {
  if (tab === 'diffs') {
    return (
      <ul className="txn-outline">
        {FILES.filter((f) => f.edited).sort((a, b) => b.adds + b.dels - (a.adds + a.dels)).map((f) => (
          <li key={f.path}>
            <button type="button" className="txn-ol-row" onClick={() => onJump(f.turn)}>
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
        {[...FILES].sort((a, b) => a.leaf.localeCompare(b.leaf)).map((f) => (
          <li key={f.path}>
            <button type="button" className="txn-ol-row" onClick={() => onJump(f.turn)}>
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
        {HIGHLIGHTS.map((h) => {
          const Icon = h.icon
          return (
            <li key={h.id}>
              <button type="button" className="txn-ol-row" disabled={h.kind === 'checkpoint'} onClick={() => h.kind !== 'checkpoint' && onJump(h.turn)}>
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
    const groups = ['error', 'retry', 'revert', 'subagent']
    return (
      <div className="txn-outline-grouped">
        {groups.map((g) => {
          const items = ANNOTATIONS.filter((a) => a.type === g)
          if (!items.length) return null
          const meta = ANNOTATION_META[g]
          const Icon = meta.icon
          return (
            <div key={g} className="txn-ol-group">
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
  /* trace -> the per-task duration trail (StepsWaterfall), matching the documented app-viewer's
     "what happened, in order" timeline. onJump stays on the trace tab (no tab switch). */
  return (
    <StepsWaterfall
      className="txn-ol-waterfall"
      tasks={TRACE_TASKS}
      label="user turns by duration"
      onJump={(id) => onJump(id, { switchTab: false })}
    />
  )
}

/* ---------------------------------------------------------------- filters rail */
function FilterSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="txn-fsec">
      <button type="button" className="txn-fsec-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />} {title}
      </button>
      {open && <div className="txn-fsec-body">{children}</div>}
    </div>
  )
}

function CheckRow({ checked, onChange, children, count }) {
  return (
    <label className="txn-checkrow">
      <input type="checkbox" className="check-box" checked={checked} onChange={onChange} />
      <span className="txn-cr-label">{children}</span>
      {count != null && <span className="txn-cr-count tnum">{count}</span>}
    </label>
  )
}

function FiltersRail({
  tab, cats, setCats, toolGroups, setToolGroups, toolGroupsOpen, setToolGroupsOpen,
  tags, setTags, views, setViews, checkpoint, setCheckpoint, checkpointOpen, setCheckpointOpen,
  filtersActive, onClear, onJumpStart, onJumpLatest,
}) {
  if (tab !== 'trace' && tab !== 'highlights') {
    return <div className="txn-filter-ph">filters are not available for this view yet.</div>
  }
  if (tab === 'highlights') {
    return (
      <div className="txn-filters">
        <FilterSection title="outcome">
          <CheckRow checked={tags.errors} onChange={() => setTags((t) => ({ ...t, errors: !t.errors }))}>errors</CheckRow>
          <CheckRow checked={tags.retries} onChange={() => setTags((t) => ({ ...t, retries: !t.retries }))}>retries</CheckRow>
          <CheckRow checked={tags.revert} onChange={() => setTags((t) => ({ ...t, revert: !t.revert }))}>re-edit</CheckRow>
        </FilterSection>
      </div>
    )
  }
  return (
    <div className="txn-filters">
      <div className="txn-filters-top">
        <span className="txn-filters-cap">categories</span>
        {filtersActive > 0 && (
          <button type="button" className="txn-clear" onClick={onClear}>clear ({filtersActive})</button>
        )}
      </div>

      <div className="txn-catlist">
        <CheckRow checked={cats.prompts} onChange={() => setCats((c) => ({ ...c, prompts: !c.prompts }))} count={CATEGORIES[0].count}>prompts</CheckRow>
        <CheckRow checked={cats.responses} onChange={() => setCats((c) => ({ ...c, responses: !c.responses }))} count={CATEGORIES[1].count}>responses</CheckRow>
        <CheckRow checked={cats.thinking} onChange={() => setCats((c) => ({ ...c, thinking: !c.thinking }))} count={CATEGORIES[2].count}>thinking</CheckRow>
        <div className="txn-toolcat">
          <CheckRow checked={cats.toolcalls} onChange={() => setCats((c) => ({ ...c, toolcalls: !c.toolcalls }))} count={CATEGORIES[3].count}>
            <button type="button" className="txn-toolcat-toggle" aria-expanded={toolGroupsOpen} onClick={(e) => { e.preventDefault(); setToolGroupsOpen((o) => !o) }}>
              tool calls {toolGroupsOpen ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
            </button>
          </CheckRow>
          {toolGroupsOpen && (
            <div className="txn-toolgroups">
              {TOOL_GROUPS.map((g) => {
                const Icon = g.icon
                return (
                  <label key={g.id} className="txn-checkrow txn-subcheck">
                    <input type="checkbox" className="check-box" checked={toolGroups[g.id]} disabled={g.count === 0} onChange={() => setToolGroups((m) => ({ ...m, [g.id]: !m[g.id] }))} />
                    <span className="txn-cr-label"><Icon size={13} aria-hidden="true" /> {g.label}</span>
                    <span className="txn-cr-count tnum">{g.count}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="txn-filter-divider" />
      <span className="txn-filters-cap">semantic tags</span>
      <div className="txn-catlist">
        <CheckRow checked={tags.errors} onChange={() => setTags((t) => ({ ...t, errors: !t.errors }))}>
          <AlertTriangle size={13} aria-hidden="true" className="txn-tag-err" /> errors
        </CheckRow>
        <CheckRow checked={tags.retries} onChange={() => setTags((t) => ({ ...t, retries: !t.retries }))}>
          <RefreshCw size={13} aria-hidden="true" /> retries
        </CheckRow>
        <CheckRow checked={tags.revert} onChange={() => setTags((t) => ({ ...t, revert: !t.revert }))}>
          <RotateCcw size={13} aria-hidden="true" /> re-edit
        </CheckRow>
      </div>

      <div className="txn-filter-divider" />
      <span className="txn-filters-cap">checkpoints</span>
      <div className="txn-cp-select">
        <button type="button" className="select txn-cp-trigger" aria-expanded={checkpointOpen} aria-haspopup="listbox" onClick={() => setCheckpointOpen((o) => !o)}>
          <span className="mono">{checkpoint === 'all' ? 'all checkpoints (1)' : '9f3c1ad · port TurnRow'}</span>
          <ChevronDown size={13} aria-hidden="true" />
        </button>
        {checkpointOpen && (
          <div className="menu-pop txn-cp-pop" role="listbox">
            <button type="button" role="option" aria-selected={checkpoint === 'all'} className="txn-cp-opt" onClick={() => { setCheckpoint('all'); setCheckpointOpen(false) }}>all checkpoints (1)</button>
            <button type="button" role="option" aria-selected={checkpoint === '9f3c1ad'} className="txn-cp-opt" onClick={() => { setCheckpoint('9f3c1ad'); setCheckpointOpen(false) }}>
              <span className="mono txn-cp-hash">9f3c1ad</span>
              <span className="txn-cp-detail">port TurnRow · 4m ago · 7 files</span>
            </button>
          </div>
        )}
      </div>

      <div className="txn-filter-divider" />
      <span className="txn-filters-cap">view options</span>
      <div className="txn-views">
        <ViewSwitch label="show hidden indicators" on={views.hidden} onToggle={() => setViews((v) => ({ ...v, hidden: !v.hidden }))} />
        <ViewSwitch label="expand all tool calls" on={views.expandAll} onToggle={() => setViews((v) => ({ ...v, expandAll: !v.expandAll }))} />
        <ViewSwitch label="compact mode" on={views.compact} onToggle={() => setViews((v) => ({ ...v, compact: !v.compact }))} />
      </div>

      <div className="txn-filter-divider" />
      <span className="txn-filters-cap">jump to</span>
      <div className="txn-jumprow">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onJumpStart}><ArrowUpToLine size={14} aria-hidden="true" /> start</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onJumpLatest}><ArrowDownToLine size={14} aria-hidden="true" /> latest</button>
      </div>
    </div>
  )
}

function ViewSwitch({ label, on, onToggle }) {
  return (
    <div className="txn-viewsw">
      <button type="button" role="switch" aria-checked={on} className="sw" onClick={onToggle} aria-label={label} />
      <span className="txn-viewsw-label">{label}</span>
      <span className="txn-viewsw-state">{on ? 'on' : 'off'}</span>
    </div>
  )
}

/* ---------------------------------------------------------------- label popover */
function LabelPopover({ turnId, current, onSave, onClose }) {
  const [outcome, setOutcome] = useState(current?.outcome || 'neutral')
  const [flag, setFlag] = useState(current?.flag || '')
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [onClose])
  const OUTCOMES = [['good', 'good'], ['neutral', 'neutral'], ['bad', 'bad']]
  const FLAGS = [['', 'none'], ['error', 'error'], ['retry-loop', 'retry loop'], ['revert', 'revert'], ['highlight', 'highlight']]
  return (
    <div className="txn-label-scrim">
      <div className="pop-card txn-label-pop" ref={ref}>
        <div className="pop-head">
          <Flag size={14} aria-hidden="true" />
          <span className="pop-title">label turn {turnId}</span>
        </div>
        <div className="pop-body">
          <div>
            <span className="txn-label-cap">outcome</span>
            <div className="bs-seg txn-label-seg">
              {OUTCOMES.map(([v, l]) => (
                <button key={v} type="button" className="bs-seg-opt" aria-pressed={outcome === v} onClick={() => setOutcome(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="txn-label-cap">flag</span>
            <div className="txn-label-flags">
              {FLAGS.map(([v, l]) => (
                <button key={v || 'none'} type="button" className={'chip txn-label-flag' + (flag === v ? ' txn-flag-on' : '')} aria-pressed={flag === v} onClick={() => setFlag(v)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="pop-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave(outcome, flag)}>save label</button>
        </div>
      </div>
    </div>
  )
}

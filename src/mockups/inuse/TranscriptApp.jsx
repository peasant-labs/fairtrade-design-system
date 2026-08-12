import { useMemo, useState } from 'react'
// the only lucide glyphs the demo itself draws are the rewired trajectory-graph zoom controls;
// every transcript glyph now lives inside the lifted /ui components.
import { Plus, Minus, Maximize, RefreshCw } from 'lucide-react'
import {
  TranscriptViewer,
  adaptTranscript,
  GraphTurnNode,
  GraphToolNode,
  GraphSubagentBranch,
  GraphLegend,
} from '../../ui'

/* ============================================================================
   TranscriptApp — the canonical transcript demo, now a CONSUMER of the lifted
   fairtrade /ui components (no inline transcript components remain). It owns its
   baked-in session fixtures, projects them into the canonical wire payload, feeds
   them through the ONE adapter (adaptTranscript) → TranscriptViewModel, and renders
   the composite <TranscriptViewer> + the rewired trajectory graph. The demo proves
   the lift by construction: the SAME components transcript-browser consumes render it.
============================================================================ */

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
    tokens: { in: 280, out: 0 },
    body:
      'Port the transcript canvas into the shared package. Start by reading the existing renderer before extracting it.',
  },
  {
    id: 1,
    role: 'assistant',
    label: '1a',
    model: 'Turn/Explicit-V2',
    time: '8m ago',
    longTime: 'jun 17, 2026 · 09:12',
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
    tokens: { in: 90, out: 0 },
    body: 'Looks right. Run a typecheck across the workspace before you start moving files.',
  },
  {
    id: 4,
    role: 'assistant',
    label: '2a',
    model: 'Turn/Explicit-V4',
    time: '6m ago',
    longTime: 'jun 17, 2026 · 09:15',
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
    model: 'Turn/Explicit-V5',
    time: '5m ago',
    longTime: 'jun 17, 2026 · 09:16',
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
    model: 'Subagent/Research-V1',
    subagent: 'docs-writer',
    time: '3m ago',
    longTime: 'jun 17, 2026 · 09:18',
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
  { id: 'exploration', label: 'exploration', from: 0, to: 2 },
  { id: 'debugging', label: 'debugging', from: 3, to: 4, errors: 1 },
  { id: 'implementation', label: 'implementation', from: 5, to: 8 },
]

/* the per-task duration trail for the trace outline (StepsWaterfall), the transcript-viewer's
   "what happened, in order" timeline. id is the user turn's TURNS id so onJump reuses
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

/* highlights = curated key moments */
const HIGHLIGHTS = [
  { id: 'h1', kind: 'request', turn: 0, title: 'initial request', sub: 'Port the transcript canvas into the shared package…', time: '8m ago' },
  { id: 'h2', kind: 'phase', turn: 3, title: 'debugging begins', sub: 'turn 2 · 1 error in this phase', tag: 'debugging' },
  { id: 'h3', kind: 'error', turn: 4, title: 'pnpm -r typecheck failed', sub: '1 failed · exit 2', err: true },
  { id: 'h4', kind: 'checkpoint', turn: 6, title: '9f3c1ad', sub: 'feat(canvas): port TurnRow + tool renderers', stat: '+312 −24 · 7 files' },
  { id: 'h5', kind: 'final', turn: 8, title: 'final response', sub: 'All packages typecheck and build…', tokens: '1.7k' },
]

/* ============================================================================
   TrajectoryGraph — the demo's trajectory graph, REWIRED to consume the lifted
   fairtrade graph node visuals (GraphTurnNode / GraphToolNode / GraphSubagentBranch
   / GraphLegend) instead of its old hand-rolled <rect>/<text> SVG nodes.

   This is the canonical ANCHOR for the graph node-visual snapshot oracle: the demo
   renders the SAME node-visual components transcript-browser plugs into its @xyflow
   engine, so the aesthetic is shared by construction. Graph LAYOUT is explicitly
   carved out of pixel-parity (the engine topology lives in transcript-browser, not
   fairtrade) — only the node VISUALS are graded, via the GraphNodes storybook story.

   Rendered through the composite TranscriptViewer's `graphSlot` render-prop: the
   composite owns no graph engine, so it hands this a cooked context
   ({ viewModel, activeTurn, onSelectTurn }) and renders whatever this returns.
============================================================================ */
function TrajectoryGraph({ viewModel, activeTurn, onSelectTurn }) {
  const [zoom, setZoom] = useState(1)
  const turns = viewModel?.turns ?? []
  return (
    <div className="txn-graphwrap">
      <div className="canvas txn-canvas" role="img" aria-label="trajectory graph of the session">
        <div className="txn-graph-scroll">
          <div
            className="txn-graph-flow"
            style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 18, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            {turns.map((t) => {
              const isSub = (t.depth ?? 0) > 0
              const tools = t.toolCalls ?? []
              const card = (
                <button
                  type="button"
                  className="txn-graph-nodebtn"
                  style={{ display: 'block', width: isSub ? 300 : 320, marginLeft: isSub ? 48 : 0, padding: 0, border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onClick={() => onSelectTurn(t.index)}
                >
                  <GraphTurnNode
                    role={t.role}
                    agentName={t.agentName}
                    turnNumber={t.label}
                    contentPreview={(t.content || '').replace(/\s+/g, ' ').trim().slice(0, 56)}
                    toolCount={tools.length}
                    totalTokens={(t.tokens?.in ?? 0) + (t.tokens?.out ?? 0)}
                    tokensIn={t.tokens?.in}
                    tokensOut={t.tokens?.out}
                    hasError={t.isError}
                    isSelected={activeTurn === t.index}
                    provider={t.accent}
                  />
                </button>
              )
              return (
                <div key={t.index} className="txn-graph-row" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {isSub && <GraphSubagentBranch agentName={t.agentName ?? 'subagent'} depth={t.depth ?? 1} />}
                  {card}
                  {!isSub && tools.length > 0 && (
                    <div style={{ width: 220, marginLeft: 96 }}>
                      <GraphToolNode
                        tools={tools.map((tc) => ({ id: tc.id, name: tc.name, kind: tc.kind, filePath: tc.filePath, preview: tc.preview, isError: tc.isError, exitCode: tc.exitCode }))}
                        totalDurationMs={tools.reduce((s, tc) => s + (tc.durationMs ?? 0), 0)}
                        hasError={tools.some((tc) => tc.isError)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* zoom / fit / reset controls — reuse the canvas control chrome */}
        <div className="canvas-ctrls">
          <button type="button" aria-label="zoom in" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.2).toFixed(2)))}><Plus size={14} aria-hidden="true" /></button>
          <button type="button" aria-label="zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))}><Minus size={14} aria-hidden="true" /></button>
          <button type="button" aria-label="fit view" onClick={() => setZoom(1)}><Maximize size={14} aria-hidden="true" /></button>
          <button type="button" aria-label="reset" onClick={() => setZoom(1)}><RefreshCw size={14} aria-hidden="true" /></button>
        </div>
      </div>

      {/* the lifted legend (the shared node-visual aesthetic) */}
      <GraphLegend className="txn-graph-legend" />
    </div>
  )
}
/* ---------------------------------------------------------------- scorecard */
const SCORECARD = [
  {
    id: 'token',
    label: 'token efficiency',
    headline: '8% retry tokens',
    band: 'watch',
    flags: ['1,300 tokens spent on the retry after typecheck', 'context window 42% used', 'output survival 88%'],
    delta: { dir: 'down', text: '4 pts below your median' },
  },
  {
    id: 'prompt',
    label: 'prompt quality',
    headline: 'spec 72/100',
    band: 'ok',
    flags: ['has examples', 'no explicit constraints', 'signal-to-noise 64%'],
    delta: { dir: 'up', text: '6 pts above your median' },
  },
  {
    id: 'loop',
    label: 'loop efficiency',
    headline: '1 max error streak',
    band: 'ok',
    flags: ['1 revert detected', 'no retry loops', 'recovered in 1 turn'],
    delta: { dir: 'up', text: '2 pts above your median' },
  },
]

/* ============================================================================
   MAIN — TranscriptApp: the canonical demo, refactored to CONSUME the lifted
   fairtrade /ui components. It projects its editorial fixtures into the
   canonical wire payload, feeds them through the ONE adapter (adaptTranscript) ->
   TranscriptViewModel, and renders the composite <TranscriptViewer> + the rewired
   trajectory graph (graphSlot). Parity by construction: the SAME lifted components
   transcript-browser will consume render this demo.

   Editorial overlay: a curated demo carries DISPLAY values a real wire payload
   cannot (relative times, the short title, per-tool one-line previews, the
   editorial diff hunk, the touched-file index, the curated highlights, the rich
   scorecard). These are overlaid onto the cooked VM render-when-present. The
   adapter still owns the STRUCTURAL cooking: turn labels/accents/depth, tool
   parsing + classification, the filter index, git normalisation + commit anchoring.
============================================================================ */

/* map a turn id -> a monotonic RFC3339 timestamp (drives commit anchoring only; the
   VISIBLE time is the editorial `time` overlaid below, never this absolute value). */
const TS_BASE = Date.parse('2026-06-17T09:12:00Z')
const turnTimestamp = (id) => new Date(TS_BASE + id * 60_000).toISOString()

/* a demo tool fixture -> canonical ToolCallDetail (JSON-encoded arguments/result). */
function toolToWire(tool) {
  let args = {}
  let result = ''
  let toolKind
  let filePath
  let exitCode
  let isError = false
  let durationMs

  const secs = (d) => (typeof d === 'string' && /([\d.]+)s/.test(d) ? Math.round(parseFloat(d) * 1000) : undefined)

  switch (tool.kind) {
    case 'read':
      args = { file_path: tool.path, offset: 1, limit: 40 }
      result = JSON.stringify(tool.excerpt ?? '')
      toolKind = 'read'
      filePath = tool.path
      break
    case 'grep':
      args = { pattern: tool.pattern, path: tool.scope, type: tool.glob }
      result = JSON.stringify(tool.results ?? '')
      toolKind = 'search'
      break
    case 'bash':
      args = { command: tool.command, ...(tool.description ? { description: tool.description } : {}) }
      result = JSON.stringify(tool.stdout ?? '')
      toolKind = 'execute'
      exitCode = tool.exit
      isError = tool.exit !== 0
      durationMs = secs(tool.duration)
      break
    case 'edit': {
      // reconstruct the pre/post text from the editorial hunk so the wire carries REAL edit content
      // and the adapter's LCS diff path runs on it. (The demo still overlays the editorial hunk for
      // display — see buildMockupVM — because its rewritten-line-as-del+add is an editorial
      // representation an LCS would render as context; TB shows the LCS hunk.)
      const hunk = Array.isArray(tool.hunk) ? tool.hunk : []
      const oldText = hunk.filter((d) => d.sign === 'ctx' || d.sign === 'del').map((d) => d.t).join('\n')
      const newText = hunk.filter((d) => d.sign === 'ctx' || d.sign === 'add').map((d) => d.t).join('\n')
      args = { file_path: tool.path, old_string: oldText, new_string: newText }
      result = JSON.stringify('ok')
      toolKind = 'edit'
      filePath = tool.path
      break
    }
    case 'task':
      args = { subagent_type: tool.agent, status: tool.status, description: tool.task, owner: tool.owner, prompt: tool.promptBody }
      result = JSON.stringify(tool.result ?? '')
      toolKind = 'other'
      break
    case 'webfetch':
      args = { url: tool.url, prompt: tool.prompt }
      result = JSON.stringify(tool.result ?? '')
      toolKind = 'fetch'
      break
    default:
      args = {}
      result = JSON.stringify(tool.result ?? '')
  }

  const wire = { id: tool.id, name: tool.name, arguments: JSON.stringify(args), result }
  if (toolKind) wire.toolKind = toolKind
  if (filePath) wire.filePath = filePath
  if (exitCode != null) wire.exitCode = exitCode
  if (isError) wire.isError = true
  if (durationMs != null) wire.durationMs = durationMs
  return wire
}

/* a demo turn -> canonical TurnDetail. */
function turnToWire(t) {
  // Fold the demo's tool-sibling thinking into the turn content as a <thinking>…</thinking> block so the
  // ADAPTER (not a VM overlay) extracts ThinkingVM back out. SCOPE — this <thinking> fold is a FORWARD/DEMO
  // convention that peasant does NOT emit today: the backend suppresses the redundant tool-sibling thinking
  // entry (transcript.go:154,164) and keeps its text in the parent's ContentPreview, so the adapter's
  // inline-thinking path does not fire in production — it is render-when-present pending a backend
  // follow-up. (STANDALONE thinking — a separate entryType=thinking turn — IS production-grounded, so a
  // real consumer renders that today.) No current regression either way: TB never rendered inline thinking.
  const content = t.thinking ? `<thinking>${t.thinking.text}</thinking>\n${t.body ?? ''}` : (t.body ?? '')
  const wire = {
    index: t.id,
    role: t.role,
    content,
    timestamp: turnTimestamp(t.id),
    depth: t.depth ?? 0,
  }
  if (t.model) wire.model = t.model
  if (t.thinking) wire.hasThinking = true
  if (t.tools) wire.toolCalls = t.tools.map(toolToWire)
  if (t.subagent) wire.agentName = t.subagent
  if (t.tokens) { wire.tokensIn = t.tokens.in; wire.tokensOut = t.tokens.out }
  return wire
}

/* the canonical wire payload (folded turns + nested gitContext for the checkpoint). */
function buildWire() {
  const checkpoint = TURNS.find((t) => t.checkpoint)?.checkpoint
  const payload = {
    id: 'sess_dem',
    harness: HARNESS,
    startTime: turnTimestamp(0),
    endTime: turnTimestamp(8),
    durationMins: 8,
    totalTokens: 18400,
    tokensIn: 12200,
    tokensOut: 6200,
    turnCount: 8,
    toolCallCount: 5,
    project: 'transcript-browser',
    model: 'Session/Default-V3',
    outcome: 'resolved',
    turns: TURNS.map(turnToWire),
    scorecard: { outcome: 'resolved' },
  }
  if (checkpoint) {
    payload.gitContext = {
      branch: 'lift/transcript-canvas',
      user: 'Dev',
      commits: [
        {
          hash: checkpoint.hash,
          message: checkpoint.msg,
          authorName: 'Dev',
          // ~30s after the checkpoint turn (id 6) so the adapter anchors it to that turn
          timestamp: new Date(TS_BASE + 6 * 60_000 + 30_000).toISOString(),
          filesChanged: checkpoint.files,
          insertions: checkpoint.adds,
          deletions: checkpoint.dels,
        },
      ],
    }
  }
  return payload
}

/* precomputed analytics that reproduce the editorial fixtures EXACTLY (phases /
   scorecard / annotations / tasks are curated, not mechanically derivable). The
   adapter embeds a precomputed analytics block as-is when supplied. */
function buildAnalytics() {
  const phases = PHASES.map((p, i) => {
    const vm = { id: `phase-${i + 1}`, label: p.label, from: p.from, to: p.to, icon: p.id }
    if (p.errors) vm.errors = p.errors
    return vm
  })

  // The scorecard STRUCTURE (icon + flag list + trend) is now emitted by the shared analytics
  // (assessScorecard), so a real app's DERIVED bands render the rich card too. The demo's specific
  // band/flag/trend COPY is editorial illustration — session-specific narrative ("after typecheck",
  // "recovered in 1 turn", "N pts below your median") that threshold logic can't reproduce — so it
  // is supplied here via the adapter's precomputed-analytics input (a documented editorial residual).
  const scorecardBands = SCORECARD.map((s) => ({
    id: s.id,
    label: s.label,
    band: s.band,
    value: s.headline,
    icon: s.id, // 'token' | 'prompt' | 'loop' -> the Scorecard's axis-icon map
    flags: s.flags,
    delta: s.delta,
  }))

  const patternAnnotations = ANNOTATIONS.map((a) => ({
    id: a.id,
    kind: a.type,
    turn: a.turn,
    label: a.label,
    preview: a.preview,
  }))

  const taskGroups = TRACE_TASKS.map((t, i) => {
    const next = TRACE_TASKS[i + 1]
    const turnIndices = TURNS.filter((x) => x.id >= t.id && (!next || x.id < next.id)).map((x) => x.id)
    const vm = {
      id: `task-${t.index}`,
      index: t.index,
      prompt: t.prompt,
      turnIndices,
      durationMs: t.durationMs,
      tools: t.tools,
      outcome: t.outcome,
      // the editorial per-task churn/file summary the task boundary chip shows
      stat: t.index === 1 ? '5 files' : '2 files · +316 −25',
    }
    if (t.error) vm.error = t.error
    return vm
  })

  return { phases, scorecardBands, patternAnnotations, taskGroups }
}

/* a demo diff hunk row {sign,a,b,t} -> cooked DiffLineVM. */
function mkDiffLine(d) {
  const line = { sign: d.sign, text: d.t }
  if (d.a) line.oldNo = d.a
  if (d.b) line.newNo = d.b
  return line
}

/* the cooked VM. The adapter DERIVES the structure + every wire-derivable display value (turn
   labels/accents/depth, tool kind/group/preview, diffs, the touched-file set, the filter index,
   git, commit anchoring). What remains overlaid below is ONLY genuine editorial curation a real
   wire cannot carry — each is a DOCUMENTED RESIDUAL (with why-non-derivable + the real-app gap):
     • title         — no wire title field (the composite derives a fallback from the first prompt).
     • turn time     — "Nm ago" is non-deterministic; the demo pins a stable label (TurnCard derives
                       it from the timestamp for a real app).
     • task preview  — a curated shortening of the wire description (makePreview derives "agent · description").
     • diff hunk     — the demo draws the rewritten line as del+add; the adapter's LCS (run on the real
                       reconstructed args) renders it as context, so a real app shows the LCS hunk.
     • files         — the demo's index includes grep-result + attributed files NO tool call carries a
                       path for; buildFiles derives only the tool-path-touched files, so a real app
                       shows FEWER files (a real, documented "leaner TB" gap, not a masked one).
     • highlights    — a curated key-moment set + copy; buildHighlights derives a FULLER set for a real app. */
function buildMockupVM() {
  const base = adaptTranscript(buildWire(), [], buildAnalytics())
  const srcById = Object.fromEntries(TURNS.map((t) => [t.id, t]))

  const turns = base.turns.map((tv) => {
    const src = srcById[tv.index]
    const out = { ...tv }
    if (src?.time) out.time = src.time
    if (src?.longTime) out.timeTitle = src.longTime
    // NOTE: thinking is NOT overlaid — the adapter derives ThinkingVM from turn content. STANDALONE
    // thinking (entryType=thinking turn) is PRODUCTION-GROUNDED: a real consumer renders it today. The
    // demo's INLINE tool-sibling thinking rides the adapter's render-when-present <thinking> fold path
    // (see turnToWire + the adapter) — a FORWARD/DEMO convention peasant does NOT emit yet, so it does
    // not fire in production (no regression). Neither case is a VM overlay.
    out.toolCalls = tv.toolCalls.map((tc) => {
      const st = (src?.tools ?? []).find((x) => x.id === tc.id)
      const o = { ...tc }
      // makePreview now DERIVES the read/edit/grep/bash head previews from the wire (matching the
      // canonical reference); only the task preview is a curated shortening of the wire description,
      // so it is the lone preview overlaid here.
      if (st?.kind === 'task' && st.preview) o.preview = st.preview
      if (st?.kind === 'edit' && Array.isArray(st.hunk)) {
        o.diff = [{ lines: st.hunk.map(mkDiffLine) }]
        o.adds = st.adds
        o.dels = st.dels
      }
      return o
    })
    return out
  })

  // the editorial touched-file index (the demo lists files no single tool call carries a path for)
  const files = FILES.map((f) => ({
    path: f.path,
    leaf: f.leaf,
    reads: f.reads,
    writes: f.writes,
    edits: f.edits,
    deletes: 0,
    adds: f.adds,
    dels: f.dels,
    edited: f.edited,
    turn: f.turn,
  }))

  // the editorial diff hunk (the demo's del+add representation; an LCS diff would differ)
  const editSrc = TURNS.find((t) => t.id === 5)?.tools?.[0]
  const diffs = editSrc
    ? [{
        path: editSrc.path,
        leaf: 'tasks.ts',
        adds: editSrc.adds,
        dels: editSrc.dels,
        hunks: [{ lines: editSrc.hunk.map(mkDiffLine) }],
        turn: 5,
        toolCallId: editSrc.id,
      }]
    : base.diffs

  // the curated highlights backing the highlights tab
  const highlights = HIGHLIGHTS.map((h) => {
    const vm = { id: h.id, kind: h.kind, turn: h.turn, title: h.title }
    if (h.sub) vm.sub = h.sub
    if (h.stat) vm.stat = h.stat
    if (h.time) vm.time = h.time
    if (h.tokens) vm.tokens = h.tokens
    if (h.err) vm.err = true
    if (h.tag) vm.tag = h.tag
    return vm
  })

  return {
    ...base,
    session: { ...base.session, title: 'Port the transcript canvas into the shared package' },
    turns,
    files,
    diffs,
    highlights,
  }
}

/* the permission surface the demo grants (REQUIRED by the composite, no default). */
const CAPABILITIES = {
  canEdit: true,
  canExport: true,
  canContribute: true,
  canChangeVisibility: false,
  canLabel: true,
}

export default function TranscriptApp({ theme = 'dark' }) {
  const vm = useMemo(buildMockupVM, [])
  // seed the same three tool calls expanded as the canonical demo (the rest default closed).
  const [openTools, setOpenTools] = useState({ t1a: true, t4a: true, t5a: true })
  return (
    <TranscriptViewer
      viewModel={vm}
      theme={theme}
      capabilities={CAPABILITIES}
      openTools={openTools}
      onOpenToolsChange={setOpenTools}
      graphSlot={({ viewModel: gvm, activeTurn, onSelectTurn }) => (
        <TrajectoryGraph viewModel={gvm} activeTurn={activeTurn} onSelectTurn={onSelectTurn} />
      )}
    />
  )
}

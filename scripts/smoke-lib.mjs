#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'

/* react-markdown's browser build decodes character references through a tiny DOM helper at module
   evaluation time. These package smokes import the built browser-facing exports in Node, so provide
   the same minimal DOM before loading them. */
const importDom = new JSDOM('<!doctype html><html><body></body></html>')
for (const [key, value] of Object.entries({ window: importDom.window, document: importDom.window.document, navigator: importDom.window.navigator })) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
const [ui, icons, graph, commons, analytics] = await Promise.all([
  import('../dist/lib/ui.js'),
  import('../dist/lib/icons.js'),
  import('../dist/lib/graph.js'),
  import('../dist/lib/commons.js'),
  import('../dist/lib/analytics.js'),
])

// Types-emit assertion (runs after `tsc -p tsconfig.lib.json`). tsconfig.lib has
// noEmitOnError:false, so a silent declaration-emit failure (bad include glob,
// wrong outDir) would ship a package whose ./ui + ./icons "types" paths 404 —
// runtime fine, types broken. The exports map points ./ui types -> index.d.ts
// and ./icons types -> icons.d.ts, so assert both exist and are non-empty.
const TYPES = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'lib', 'types')
const typeFailures = []
// index.d.ts/icons.d.ts back ./ui + ./icons; graph/commons back the per-surface
// ./graph + ./commons entries (their "types" targets in package.json exports).
for (const decl of ['index.d.ts', 'icons.d.ts', 'graph/index.d.ts', 'commons/index.d.ts', 'analytics/index.d.ts']) {
  const p = join(TYPES, decl)
  if (!existsSync(p)) typeFailures.push(`${decl}: missing from dist/lib/types (tsc did not emit it)`)
  else if (statSync(p).size === 0) typeFailures.push(`${decl}: present but empty in dist/lib/types`)
}
if (typeFailures.length) {
  throw new Error(
    [
      'fairtrade smoke failed in scripts/smoke-lib.mjs: declaration-emit assertion failed after tsc.',
      'What went wrong: a "types" target named in package.json exports is missing/empty:',
      ...typeFailures.map((f) => `  - ${f}`),
      'Why it matters: consumers resolving @peasant-labs/fairtrade/ui or /icons types would hit a 404 type path.',
      'How to fix: check tsconfig.lib.json include/exclude + outDir and re-run pnpm build:lib.',
    ].join('\n'),
  )
}

const chartData = [{ label: 'a', count: 1 }, { label: 'b', count: 2 }]
const diffHunks = [
  {
    header: '@@ -1,1 +1,1 @@',
    lines: [
      { type: 'del', oldNo: 1, text: 'old line' },
      { type: 'add', newNo: 1, text: 'new line' },
    ],
  },
]
const commits = [{ id: 'abc123', lane: 0, message: 'initial package smoke', session: true, time: 'now' }]
const steps = [{ id: 'one', label: 'one' }, { id: 'two', label: 'two' }]
const timelineItem = { id: 't1', kind: 'turn', role: 'user', label: '1', body: 'hello' }
const timelineTool = { id: 'tool1', kind: 'read', name: 'Read', preview: 'src/index.css', path: 'src/index.css' }
const rendererTool = { kind: 'read', status: 'ok', args: { file: 'src/index.css', excerpt: ':root {}' }, durationMs: 1 }

// transcript rendering primitives: cooked TranscriptViewModel fixtures so the smoke renders the
// real render path (the dumb components read these cooked shapes; they never parse wire).
const txnReadTool = { id: 'r1', name: 'Read', kind: 'read', group: 'read', preview: 'TurnRow.tsx', filePath: 'src/canvas/TurnRow.tsx', args: { file_path: 'src/canvas/TurnRow.tsx' }, output: 'export function TurnRow() {}' }
const txnBashTool = { id: 'b1', name: 'Bash', kind: 'execute', group: 'bash', preview: 'pnpm -r typecheck', exitCode: 0, durationMs: 820, args: { command: 'pnpm -r typecheck' }, output: 'ok' }
const txnTaskTool = { id: 'k1', name: 'Task', kind: 'other', group: 'tasks', preview: 'verify exports', args: { subagent_type: 'researcher', description: 'verify exports', prompt: 'check exports resolve' }, output: 'done' }
const txnDiffEntry = { path: 'src/lib/tasks.ts', leaf: 'tasks.ts', adds: 1, dels: 0, turn: 5, toolCallId: 't5a', hunks: [{ lines: [{ sign: 'ctx', oldNo: '1', newNo: '1', text: 'const a = 1' }, { sign: 'add', newNo: '2', text: 'const b = 2' }, { sign: 'add', text: '' }] }] }
const txnTurn = { index: 2, role: 'assistant', label: '2', depth: 0, provider: 'claude-code', content: 'Reading **TurnRow** before extracting it.', thinking: { text: 'read first', words: 2 }, toolCalls: [txnReadTool], annotations: [], tokens: { in: 2100, out: 640 }, timestamp: '2026-06-17T09:13:00Z' }
const txnUserTurn = { index: 0, role: 'user', label: '1', depth: 0, content: 'Port the transcript canvas into the shared package.', toolCalls: [], annotations: [], tokens: { in: 280, out: 0 } }

// a fully-populated cooked TranscriptViewModel + a complete capability surface, so the composite
// TranscriptViewer + the rails/scrubber/scorecard render their real production path in the smoke.
const txnViewModel = {
  session: {
    id: 'sess_demo_0001', harness: 'claude-code', startTime: '', endTime: '', durationMins: 8,
    totalTokens: 18400, tokensIn: 12200, tokensOut: 6200, turnCount: 2, toolCallCount: 1,
    project: 'transcript-browser', model: 'claude-opus-4-7', outcome: 'resolved',
    git: { branch: 'main', insertions: 312, deletions: 24, commits: [{ hash: '9f3c1ad0', shortHash: '9f3c1ad', message: 'port TurnRow + tool renderers', turn: 2, adds: 312, dels: 24, files: 7 }] },
  },
  turns: [txnUserTurn, txnTurn],
  toolCallsById: new Map([[txnReadTool.id, txnReadTool]]),
  diffs: [txnDiffEntry],
  files: [{ path: 'src/lib/tasks.ts', leaf: 'tasks.ts', reads: 0, writes: 0, edits: 1, deletes: 0, adds: 3, dels: 1, edited: true, turn: 2 }],
  tasks: [{ id: 'task-0', index: 1, prompt: 'Port the transcript canvas into the shared package.', turnIndices: [0], durationMs: 300000, tools: 1, outcome: 'ok' }],
  highlights: [{ id: 'h1', kind: 'request', turn: 0, title: 'initial request', sub: 'Port the transcript canvas…', time: '8m ago' }],
  filterIndex: { toolGroupCounts: { edits: 1, bash: 0, read: 1, search: 0, fetch: 0, tasks: 0, other: 0 }, annotationsByTurn: {}, tags: [], tagCounts: {}, totalTurns: 2 },
  analytics: {
    phases: [{ id: 'exploration', label: 'exploration', from: 0, to: 1 }],
    scorecardBands: [{ id: 'token', label: 'token efficiency', band: 'watch', value: '8% retry tokens', detail: '1,300 tokens spent on the retry' }],
    patternAnnotations: [{ id: 'a1', kind: 'error', turn: 1, label: 'pnpm -r typecheck · exit 2', preview: 'error TS2532' }],
  },
}
const txnCaps = { canEdit: true, canLabel: true, canContribute: true, canChangeVisibility: true, canExport: true }
const txnFilters = { categories: { prompts: true, responses: true, thinking: true, toolcalls: true }, toolGroups: { edits: true, bash: true, read: true, search: true, fetch: true, tasks: true, other: true }, tags: { errors: false, retries: false, revert: false }, views: { hidden: true, expandAll: false, compact: false }, checkpoint: 'all' }

const sampleProps = {
  ChartBar: { data: chartData, xKey: 'label', series: [{ key: 'count', name: 'count' }], title: 'bars' },
  ChartLine: { data: chartData, xKey: 'label', series: [{ key: 'count', name: 'count' }], title: 'line' },
  CommandPalette: {
    open: true,
    onClose: () => {},
    onTheme: () => {},
    sections: [{ id: 'tokens', label: 'tokens' }],
  },
  CommitGraph: { commits },
  DataTable: {
    columns: [{ key: 'name', label: 'name', sortable: true }],
    rows: [{ id: 'a', name: 'alpha' }],
    caption: 'sample table',
  },
  DiffView: { file: 'sample.diff', hunks: diffHunks },
  ProviderIcon: { harness: 'antigravity', label: true },
  ProviderName: { harness: 'antigravity' },
  ProviderTag: { harness: 'antigravity' },
  Field: { label: 'field', children: ({ id }) => React.createElement('input', { id }) },
  StepIndicator: { steps, current: 'one' },
  StepWizard: { steps, children: ['first', 'second'] },
  Tabs: { tabs: [{ id: 'a', label: 'alpha', content: 'alpha panel' }] },
  ThinkingBlock: { block: { words: 4, text: 'sample thought' } },
  TimelineItem: { item: timelineItem },
  Timeline: { items: [timelineItem] },
  ToolCall: { tool: timelineTool },
  ToolCallRenderer: { tool: rendererTool },
  GraphTurnNode: {
    role: 'assistant',
    turnNumber: 1,
    contentPreview: 'sample turn',
    toolCount: 2,
    totalTokens: 1200,
    provider: 'claude-code',
  },
  GraphToolNode: { tools: [{ id: 't1', name: 'Read', preview: 'src/index.css' }], totalDurationMs: 120 },
  GraphSubagentBranch: { agentName: 'docs-writer', depth: 1 },
  // transcript rendering primitives (Transcript* public-export convention)
  TranscriptMarkdown: { text: 'a **bold** word and `code`.' },
  TranscriptThinking: { block: { words: 3, text: 'weighing the options' } },
  TranscriptToolCall: { tool: txnReadTool, open: true },
  TranscriptToolBody: { tool: txnBashTool },
  TranscriptTaskBody: { tool: txnTaskTool },
  TranscriptDiffHunks: { hunks: txnDiffEntry.hunks },
  TranscriptDiffEntryCard: { entry: txnDiffEntry },
  TranscriptTurnCard: { turn: txnTurn, expandAll: true },
  // transcript composite + view chrome (consume the cooked TranscriptViewModel)
  TranscriptViewer: { viewModel: txnViewModel, capabilities: txnCaps },
  TranscriptOutlineRail: { viewModel: txnViewModel, tab: 'trace' },
  TranscriptFiltersRail: { tab: 'trace', filters: txnFilters, counts: { categories: { prompts: 1, responses: 1, thinking: 1, toolcalls: 1 }, toolGroups: txnViewModel.filterIndex.toolGroupCounts }, checkpoints: txnViewModel.session.git.commits },
  TranscriptFilterSection: { title: 'outcome', children: 'rows' },
  TranscriptCheckRow: { checked: true, count: 2, children: 'errors' },
  TranscriptViewSwitch: { label: 'compact mode', on: true },
  TranscriptScrubber: { turns: txnViewModel.turns, active: 0 },
  TranscriptScorecard: { bands: txnViewModel.analytics.scorecardBands },
  TranscriptLabelPopover: { turnId: 0, current: { outcome: 'good', flag: 'clean' } },
}

const expectedExports = [
  'Button',
  'Card',
  'BrandMark',
  'ProviderIcon',
  'DiffView',
  'CommitGraph',
  'ChartBar',
  'ChartLine',
  'DataTable',
  'Timeline',
  'ToolCallRenderer',
  // transcript rendering primitives + composite (barrel presence; Transcript* convention)
  'TranscriptTurnCard',
  'TranscriptThinking',
  'TranscriptMarkdown',
  'TranscriptToolCall',
  'TranscriptToolBody',
  'TranscriptTaskBody',
  'TranscriptDiffEntryCard',
  'TranscriptDiffHunks',
  'TranscriptViewer',
  'TranscriptOutlineRail',
  'TranscriptFiltersRail',
  'TranscriptFilterSection',
  'TranscriptCheckRow',
  'TranscriptViewSwitch',
  'TranscriptScrubber',
  'TranscriptScorecard',
  'TranscriptLabelPopover',
]

const failures = []
for (const name of expectedExports) {
  if (!(name in ui)) failures.push(`${name}: missing from dist/lib/ui.js`)
}

let rendered = 0
for (const [name, value] of Object.entries(ui)) {
  if (typeof value !== 'function' || !/^[A-Z]/.test(name)) continue
  try {
    const props = sampleProps[name] ?? {}
    renderToStaticMarkup(React.createElement(value, props))
    rendered += 1
  } catch (error) {
    failures.push(`${name}: ${error?.message?.split('\n')[0] ?? error}`)
  }
}

// ./icons passthrough: confirm the externalized lucide-react re-export resolves
// and surfaces named icons + createLucideIcon for consumers that tree-shake them.
const expectedIcons = ['Code2', 'createLucideIcon']
for (const name of expectedIcons) {
  if (!(name in icons)) {
    failures.push(`${name}: missing from dist/lib/icons.js (lucide-react passthrough re-export)`)
  }
}
const iconCount = Object.keys(icons).length
if (iconCount < 100) {
  failures.push(`dist/lib/icons.js re-exported only ${iconCount} symbols; expected the full lucide-react surface (>100)`)
}

// Per-surface entries (./graph, ./commons): confirm each surface bundle resolves
// and surfaces its canonical enum-value arrays (the runtime exports that anchor
// the contract). Empty here would mean a broken per-surface entry import.
const surfaceChecks = [
  ['graph', graph, ['MAP_NODE_KINDS', 'CHANGE_BINDINGS', 'EDGE_VIOLATION_KINDS', 'FILE_CHANGE_STATUSES', 'DIFF_LINE_KINDS']],
  ['commons', commons, ['TRANSCRIPT_VISIBILITIES', 'ACCEPTANCE_MODES', 'DATA_ACCESS_POLICIES', 'TRANSCRIPT_DELETION_POLICIES', 'COLLECTIVE_ROLES']],
  ['analytics', analytics, ['ANALYTICS_SESSION_OUTCOMES', 'PROJECT_OVERVIEW_SECTION_KEYS']],
]
for (const name of ['CODE_MAP_STATE_VERSION', 'createCodeMapState', 'reduceCodeMapState', 'deriveCodeMapView']) {
  if (!(name in graph)) failures.push(`${name}: missing from dist/lib/graph.js (code-map state runtime export)`)
}
for (const [surface, mod, names] of surfaceChecks) {
  for (const name of names) {
    if (!(name in mod)) {
      failures.push(`${name}: missing from dist/lib/${surface}.js (per-surface entry export)`)
    } else if (!Array.isArray(mod[name]) || mod[name].length === 0) {
      failures.push(`${name}: not a non-empty frozen array in dist/lib/${surface}.js`)
    }
  }
}

if (failures.length) {
  throw new Error(
    [
      'fairtrade smoke failed in scripts/smoke-lib.mjs after building dist/lib/ui.js.',
      'What went wrong: one or more documented UI exports are missing or failed server render.',
      'Why it matters: consumers importing @peasant-labs/fairtrade/ui could hit broken package exports.',
      'Fix: inspect the named export/component below, update sampleProps when a component requires new mandatory props, or repair the export/build.',
      '',
      failures.join('\n'),
    ].join('\n'),
  )
}

console.log(`fairtrade smoke: imported ${Object.keys(ui).length} symbols; rendered ${rendered} component exports; ./icons re-exported ${iconCount} lucide symbols`)

#!/usr/bin/env node
/* ───────────────────────────────────────────────────────────────────────────
   smoke-transcript-ui — behavioral smoke for the lifted transcript primitives
   ─────────────────────────────────────────────────────────────────────────
   fairtrade has NO unit-test runner; its convention is node smoke scripts. This
   one imports the PRODUCTION render primitives from the BUILT bundle
   (dist/lib/ui.js — the exact surface consumers import) and asserts per-unit
   BEHAVIOR, not just "renders without throwing":

     • each of the six tool renderers emits its distinctive cooked markup
       (read path / edit diff-head / bash term+exit / grep meta / webfetch url /
       task kv) plus the catch-all;
     • DiffHunks TRIMS the trailing empty LCS line (3 cooked lines → 2 rows);
     • Thinking renders the cooked word-count badge; TurnCard composes the
       cooked content (markdown), thinking, and tool calls;
     • the tool-call row is exported as `TranscriptToolCall`, distinct from the
       Timeline `ToolCall` (no duplicate export of an existing /ui symbol).

   Every assertion is written to BITE: breaking the corresponding production
   behavior turns its line red. Requires a prior `vite build` (same as
   smoke-lib.mjs); `build:lib` runs it after the bundle exists.

   Run: `node scripts/smoke-transcript-ui.mjs` (or `pnpm smoke:transcript-ui`).
   ─────────────────────────────────────────────────────────────────────────── */

import React from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import * as ui from '../dist/lib/ui.js'

const h = React.createElement
/** Render a primitive to static markup; a missing/undefined export or a render throw yields ''
    so the relevant assertion fails CLEANLY (red) instead of crashing the whole smoke.
    @param {import('react').ElementType} Comp @param {object} props */
const html = (Comp, props) => {
  try {
    return render(h(Comp, props))
  } catch {
    return ''
  }
}

/** @type {{id:string, desc:string, ok:boolean}[]} */
const results = []
/** @param {string} id @param {string} desc @param {boolean} cond */
function assert(id, desc, cond) {
  results.push({ id, desc, ok: !!cond })
}

/* ── cooked ToolCallVM / TurnVM / DiffEntryVM fixtures ───────────────────────── */
const readTool = { id: 'r', name: 'Read', kind: 'read', group: 'read', preview: 'TurnRow.tsx', filePath: 'a/TurnRow.tsx', args: { file_path: 'a/TurnRow.tsx', offset: 1, limit: 2 }, output: 'line1\nline2' }
const editTool = { id: 'e', name: 'Edit', kind: 'edit', group: 'edits', preview: 'x.ts', filePath: 'a/x.ts', adds: 1, dels: 1, args: { file_path: 'a/x.ts' }, diff: [{ lines: [{ sign: 'del', oldNo: '1', text: 'old' }, { sign: 'add', newNo: '1', text: 'new' }] }] }
const bashTool = { id: 'b', name: 'Bash', kind: 'execute', group: 'bash', preview: 'pnpm tc', exitCode: 2, isError: true, durationMs: 4200, args: { command: 'pnpm tc' }, output: 'err TS2532' }
const grepTool = { id: 'g', name: 'Grep', kind: 'search', group: 'search', preview: '"foo"', args: { pattern: 'foo', path: 'src', type: 'ts' }, output: 'a.ts:1\nb.ts:2' }
const webfetchTool = { id: 'w', name: 'WebFetch', kind: 'fetch', group: 'fetch', preview: 'url', args: { url: 'https://react.dev/useMemo', prompt: 'sum' }, output: 'cached body' }
const taskTool = { id: 'k', name: 'Task', kind: 'other', group: 'tasks', preview: 'verify', args: { subagent_type: 'researcher', description: 'verify', prompt: 'go' }, output: 'done' }
const otherTool = { id: 'o', name: 'Todo', kind: 'other', group: 'other', preview: 'todos', args: { a: 1 }, output: 'noop' }
const assistantTurn = { index: 2, role: 'assistant', label: '2', depth: 0, provider: 'claude-code', content: 'Reading the **renderer** first.', thinking: { text: 'reason', words: 7 }, toolCalls: [readTool], annotations: [], tokens: { in: 2100, out: 640 }, timestamp: 'now' }
const diffEntry = { path: 'a/x.ts', leaf: 'x.ts', adds: 1, dels: 1, turn: 5, hunks: editTool.diff }
// a hunk whose final line is the trailing empty LCS artifact (content ending in \n)
const trimHunks = [{ lines: [{ sign: 'add', newNo: '1', text: 'a' }, { sign: 'add', newNo: '2', text: 'b' }, { sign: 'add', text: '' }] }]

/* ── Markdown ────────────────────────────────────────────────────────────────── */
{
  const out = html(ui.TranscriptMarkdown, { text: 'a **bold** and `code` here' })
  assert('MD-bold', 'Markdown renders **bold** as semantic <strong>', /<strong>bold<\/strong>/.test(out))
  assert('MD-code', 'Markdown renders `code` as txn-inlinecode', /<code[^>]*txn-inlinecode[^>]*>code<\/code>/.test(out))
}

/* ── Thinking ────────────────────────────────────────────────────────────────── */
{
  const out = html(ui.TranscriptThinking, { block: { text: 'reasoning', words: 7 } })
  assert('TH-badge', 'Thinking renders the cooked word-count badge (7w)', out.includes('7w') && out.includes('txn-thinking'))
}

/* ── ToolBody: the six renderers + catch-all (dispatch on cooked ToolCallVM.group) */
{
  assert('TOOLBODY-read', 'read body emits the code path header', html(ui.TranscriptToolBody, { tool: readTool }).includes('txn-code-path'))
  assert('TOOLBODY-edit', 'edit body emits the diff head + churn', html(ui.TranscriptToolBody, { tool: editTool }).includes('txn-diff-head'))
  const bash = html(ui.TranscriptToolBody, { tool: bashTool })
  assert('TOOLBODY-bash', 'bash body emits the terminal block + exit code', bash.includes('txn-term') && bash.includes('exit 2'))
  const grep = html(ui.TranscriptToolBody, { tool: grepTool })
  assert('TOOLBODY-grep', 'grep body emits the grep meta + match count', grep.includes('txn-grep-meta') && grep.includes('2 matches'))
  // MANDATED: webfetch has no mockup fixture; this is its render anchor.
  const wf = html(ui.TranscriptToolBody, { tool: webfetchTool })
  assert('TOOLBODY-webfetch', 'webfetch body emits the url as a txn-url link', wf.includes('txn-url') && wf.includes('react.dev/useMemo'))
  const task = html(ui.TranscriptToolBody, { tool: taskTool })
  assert('TOOLBODY-task', 'task body emits the kv list + cooked agent', task.includes('txn-kv') && task.includes('researcher'))
  assert('TOOLBODY-default', 'catch-all body emits the arguments eyebrow', html(ui.TranscriptToolBody, { tool: otherTool }).includes('arguments'))
}

/* ── DiffHunks: the trailing-empty trim (MANDATED) ───────────────────────────── */
{
  const out = html(ui.TranscriptDiffHunks, { hunks: trimHunks })
  const rows = (out.match(/class="dl /g) || []).length
  assert('DIFF-trim', 'DiffHunks trims the trailing empty LCS line (3 cooked lines → 2 rows)', rows === 2)
}

/* ── ToolCall (controlled disclosure) ────────────────────────────────────────── */
{
  assert('TC-open', 'ToolCall reveals the body when open', html(ui.TranscriptToolCall, { tool: readTool, open: true }).includes('txn-tcbody'))
  assert('TC-collapsed', 'ToolCall hides the body when collapsed', !html(ui.TranscriptToolCall, { tool: readTool, open: false }).includes('txn-tcbody'))
  assert('TC-failpill', 'ToolCall shows the exit pill for a failed bash', /exit 2/.test(html(ui.TranscriptToolCall, { tool: bashTool, open: false })))
}

/* ── TurnCard (composite over a cooked TurnVM) ───────────────────────────────── */
{
  const out = html(ui.TranscriptTurnCard, { turn: assistantTurn, expandAll: true })
  assert('TURN-num', 'TurnCard renders the turn number', out.includes('#2'))
  assert('TURN-md', 'TurnCard renders the cooked content via Markdown', /<strong>renderer<\/strong>/.test(out))
  assert('TURN-thinking', 'TurnCard renders thinking from the cooked turn', out.includes('txn-thinking') && out.includes('7w'))
  assert('TURN-tool', 'TurnCard composes the tool call (open via expandAll)', out.includes('txn-toolcall') && out.includes('txn-tcbody'))
}

/* ── TaskBody (render-when-present rows) ──────────────────────────────────────── */
{
  const out = html(ui.TranscriptTaskBody, { tool: taskTool })
  assert('TASK-agent', 'TaskBody renders the agent from cooked args.subagent_type', out.includes('researcher'))
}

/* ── DiffEntryCard (consumes a cooked DiffEntryVM) ───────────────────────────── */
{
  const byPath = html(ui.TranscriptDiffEntryCard, { entry: diffEntry })
  assert('DE-label', 'DiffEntryCard labels by path + renders churn', byPath.includes('a/x.ts') && byPath.includes('+1'))
  const byTurn = html(ui.TranscriptDiffEntryCard, { entry: diffEntry, byTurn: true })
  assert('DE-byturn', 'DiffEntryCard labels by turn when byTurn', byTurn.includes('turn 5'))
}

/* ── export distinctness + the Transcript* public-export rename ──────────────────
   Every transcript primitive now carries the collision-safe `Transcript*` convention;
   the old bare names must be GONE from the barrel and the prefixed ones present. */
{
  assert(
    'EXPORT-distinct',
    'TranscriptToolCall is exported and distinct from the Timeline ToolCall',
    typeof ui.TranscriptToolCall === 'function' && typeof ui.ToolCall === 'function' && ui.TranscriptToolCall !== ui.ToolCall,
  )
  assert(
    'RENAME-took',
    'the Transcript* rename is applied (bare TurnCard/Markdown exports gone; prefixed ones present)',
    ui.TurnCard === undefined && ui.Markdown === undefined && typeof ui.TranscriptTurnCard === 'function' && typeof ui.TranscriptMarkdown === 'function',
  )
}

/* ── the composite TranscriptViewer: a cooked VM + a full capability surface ──────
   The headline component. A fully-populated VM exercises every surface; gating uses a
   capability flipped between the two renders. */
const vmTurns = [
  { index: 0, role: 'user', label: '1', depth: 0, content: 'Port the transcript canvas into the shared package.', toolCalls: [], annotations: [], tokens: { in: 280, out: 0 } },
  assistantTurn, // index 2, label '2', has thinking + a read tool
]
const vm = {
  session: {
    id: 'sess_dem', harness: 'claude-code', startTime: '', endTime: '', durationMins: 8,
    totalTokens: 18400, tokensIn: 12200, tokensOut: 6200, turnCount: 2, toolCallCount: 1,
    project: 'transcript-browser', model: 'claude-opus-4-7', outcome: 'resolved',
    git: { branch: 'main', insertions: 312, deletions: 24, commits: [{ hash: '9f3c1ad0', shortHash: '9f3c1ad', message: 'port TurnRow + tool renderers', turn: 2, adds: 312, dels: 24, files: 7 }] },
  },
  turns: vmTurns,
  toolCallsById: new Map([[readTool.id, readTool]]),
  diffs: [diffEntry],
  files: [{ path: 'a/x.ts', leaf: 'x.ts', reads: 0, writes: 0, edits: 1, deletes: 0, adds: 1, dels: 1, edited: true, turn: 2 }],
  tasks: [{ id: 't0', index: 1, prompt: 'Port the transcript canvas into the shared package.', turnIndices: [0], durationMs: 300000, tools: 1, outcome: 'ok' }],
  highlights: [{ id: 'h1', kind: 'request', turn: 0, title: 'initial request', sub: 'Port the transcript canvas…', time: '8m ago' }],
  filterIndex: { toolGroupCounts: { edits: 1, bash: 0, read: 1, search: 0, fetch: 0, tasks: 0, other: 0 }, annotationsByTurn: {}, tags: [], tagCounts: {}, totalTurns: 2 },
  analytics: {
    phases: [{ id: 'exploration', label: 'exploration', from: 0, to: 2 }],
    scorecardBands: [{ id: 'token', label: 'token efficiency', band: 'watch', value: '8% retry tokens', detail: '1,300 tokens spent on the retry' }],
    patternAnnotations: [{ id: 'a1', kind: 'error', turn: 2, label: 'pnpm -r typecheck · exit 2', preview: 'error TS2532' }],
  },
}
const allCaps = { canEdit: true, canLabel: true, canContribute: true, canChangeVisibility: true, canExport: true }
const composite = (props) => html(ui.TranscriptViewer, props)
const streamPreludeFixture = YAML.parse(
  readFileSync(new URL('./testdata/transcript-stream-prelude.yaml', import.meta.url), 'utf8'),
)

/* ── composite renders every surface from the single VM ──────────────────────────── */
{
  const out = composite({ viewModel: vm, capabilities: allCaps })
  assert('VIEWER-default-trace', 'TranscriptViewer state-default tab is trace → renders the turn cards from vm.turns', out.includes('txn-turn') && out.includes('#1'))
  assert('VIEWER-landmark-safe', 'TranscriptViewer uses a tabpanel section instead of nesting a second main landmark in its host', out.includes('<section class="txn-center" role="tabpanel"') && !out.includes('<main'))
  assert('VIEWER-rails', 'TranscriptViewer assembles the left outline + right filters rails', out.includes('txn-rail-left') && out.includes('txn-rail-right'))
  assert('VIEWER-checkpoint', 'composite draws a CheckpointMarker between turns from session.git.commits', out.includes('txn-checkpoint') && out.includes('9f3c1ad'))
  const hl = composite({ viewModel: vm, capabilities: allCaps, activeTab: 'highlights' })
  assert('VIEWER-scorecard', 'highlights tab renders the Scorecard from analytics bands', hl.includes('txn-scorecard') && hl.includes('how this session went'))
  assert('VIEWER-highlights', 'highlights tab renders the non-empty vm.highlights surface', hl.includes('txn-hl-card') && hl.includes('initial request'))
  const anno = composite({ viewModel: vm, capabilities: allCaps, activeTab: 'annotations' })
  assert('VIEWER-annotations', 'annotations tab renders the cooked pattern annotations', anno.includes('txn-anno-row') && anno.includes('typecheck'))
}

/* ── host controls live inside the list scroller, never in the graph branch ────── */
{
  const prelude = h(
    streamPreludeFixture.element,
    { 'data-testid': streamPreludeFixture.testId },
    streamPreludeFixture.text,
  )
  const trace = composite({ viewModel: vm, capabilities: allCaps, streamPrelude: prelude })
  const graph = composite({
    viewModel: vm,
    capabilities: allCaps,
    viewMode: 'graph',
    streamPrelude: prelude,
    graphSlot: () => h('div', null, 'graph'),
  })
  const streamStart = trace.indexOf('class="txn-stream"')
  const preludeAt = trace.indexOf(streamPreludeFixture.text)
  const firstTurnAt = trace.indexOf('class="txn-turn')
  assert(
    'VIEWER-stream-prelude-order',
    'host transcript controls render inside the stream before the first turn',
    streamStart >= 0 && preludeAt > streamStart && firstTurnAt > preludeAt,
  )
  assert(
    'VIEWER-stream-prelude-graph-omitted',
    'host transcript controls are omitted from graph mode',
    !graph.includes(streamPreludeFixture.text),
  )
}

/* ── state defaults: theme defaults dark; graph mode needs a graphSlot ───────────── */
{
  const dark = composite({ viewModel: vm, capabilities: allCaps })
  const light = composite({ viewModel: vm, capabilities: allCaps, theme: 'light' })
  assert('STATE-theme-default-dark', 'theme defaults to dark (no txn-light on the root)', !/class="txn-app[^"]*txn-light/.test(dark))
  assert('STATE-theme-light', 'theme=light applies the txn-light root class', /class="txn-app[^"]*txn-light/.test(light))
  const graph = composite({ viewModel: vm, capabilities: allCaps, viewMode: 'graph', graphSlot: () => h('div', { className: 'my-graph-engine' }, 'xyflow') })
  assert('STATE-graphslot', 'graph viewMode renders the consumer graphSlot (no @xyflow dep in the composite)', graph.includes('my-graph-engine'))
}

/* ── capabilities-gating: every gated affordance/callback must be ABSENT when its flag is false ──
   The authz surface. Each capability gates an affordance + its callback; flip the flag off and the
   affordance is gone (so the callback can never fire). Each pair BITES both ways (the -off catches a
   future un-gating regression; the -on sibling proves the -off isn't trivially passing).

   `canLabel` gates an INLINE affordance (the per-turn label button), observable directly. The other
   four gate items inside the share/more action menus, so they are rendered with the relevant
   disclosure open (shareOpen/moreOpen are controllable view-state) — that is how the static markup
   observes them; each menu item carries its label in a `menu-text` span. */
{
  const withLabel = composite({ viewModel: vm, capabilities: { ...allCaps, canLabel: true } })
  const noLabel = composite({ viewModel: vm, capabilities: { ...allCaps, canLabel: false } })
  assert('CAP-label-on', 'canLabel:true wires the per-turn label affordance', withLabel.includes('txn-labelbtn'))
  assert('CAP-label-off', 'canLabel:false removes the label affordance, so onLabel can never fire', !noLabel.includes('txn-labelbtn'))

  // render the relevant action menu OPEN, with the cap on vs off, and check the gated menu item.
  const share = (cap) => composite({ viewModel: vm, capabilities: { ...allCaps, ...cap }, shareOpen: true })
  const more = (cap) => composite({ viewModel: vm, capabilities: { ...allCaps, ...cap }, moreOpen: true })

  assert('CAP-contribute-on', 'canContribute:true shows the contribute action in the open share menu', share({ canContribute: true }).includes('menu-text">contribute<'))
  assert('CAP-contribute-off', 'canContribute:false removes the contribute action, so onContribute can never fire', !share({ canContribute: false }).includes('menu-text">contribute<'))

  assert('CAP-visibility-on', 'canChangeVisibility:true shows the visibility action in the open share menu', share({ canChangeVisibility: true }).includes('menu-text">visibility<'))
  assert('CAP-visibility-off', 'canChangeVisibility:false removes the visibility action, so onChangeVisibility can never fire', !share({ canChangeVisibility: false }).includes('menu-text">visibility<'))

  assert('CAP-edit-on', 'canEdit:true shows the edit action in the open more menu', more({ canEdit: true }).includes('menu-text">edit<'))
  assert('CAP-edit-off', 'canEdit:false removes the edit action, so onEdit can never fire', !more({ canEdit: false }).includes('menu-text">edit<'))

  assert('CAP-export-on', 'canExport:true shows the download actions in the open more menu', more({ canExport: true }).includes('menu-text">json<'))
  assert('CAP-export-off', 'canExport:false removes the download actions, so onExport can never fire', !more({ canExport: false }).includes('menu-text">json<'))
}

/* ── rails / scrubber / scorecard standalone (assembly path for peasant/village shells) ── */
{
  const ol = html(ui.TranscriptOutlineRail, { viewModel: vm, tab: 'highlights' })
  assert('RAIL-outline-hl', 'OutlineRail highlights tab lists vm.highlights', ol.includes('initial request'))
  const fr = html(ui.TranscriptFiltersRail, { tab: 'trace', counts: { categories: { prompts: 1, responses: 1, thinking: 1, toolcalls: 1 }, toolGroups: vm.filterIndex.toolGroupCounts } })
  assert('RAIL-filters-groups', 'FiltersRail renders the cooked tool-call group rows', fr.includes('file edits') && fr.includes('bash'))
  const scrub = html(ui.TranscriptScrubber, { turns: vm.turns, active: 0 })
  const ticks = (scrub.match(/txn-scrub-tick/g) || []).length
  assert('RAIL-scrubber-ticks', 'Scrubber renders one tick per turn in turn-index space', ticks === vm.turns.length)
  assert('SC-bands', 'Scorecard renders a verdict card from analytics bands', html(ui.TranscriptScorecard, { bands: vm.analytics.scorecardBands }).includes('txn-sc-card'))
  assert('SC-empty', 'Scorecard renders nothing when there are no bands (render-when-present)', html(ui.TranscriptScorecard, { bands: [] }) === '')
}

/* ── structural widening: adapter-cooked checkpoint churn + turn-anchor (full path) ──
   A churn-bearing commit fixture, run through the REAL adapter, must cook per-commit
   churn onto CommitVM and anchor the commit to the nearest turn at/before its commitTime;
   the composite then draws the +adds −dels · N files stat at that turn (mockup parity). */
{
  const wire = {
    id: 's-cp', harness: 'claude-code',
    startTime: '2026-06-17T09:12:00Z', endTime: '2026-06-17T09:19:00Z',
    durationMins: 7, totalTokens: 100, tokensIn: 60, tokensOut: 40, turnCount: 2, toolCallCount: 0,
    turns: [
      { index: 0, role: 'user', content: 'Port the transcript canvas.', timestamp: '2026-06-17T09:12:00Z', depth: 0 },
      { index: 1, role: 'assistant', content: 'Committed the port.', timestamp: '2026-06-17T09:17:00Z', depth: 0, entryType: 'text' },
    ],
    gitContext: {
      branch: 'main',
      commits: [{ hash: '9f3c1ad0beef', message: 'port TurnRow + tool renderers', commitTime: Date.parse('2026-06-17T09:17:30Z'), filesChanged: 7, insertions: 312, deletions: 24 }],
    },
  }
  const cookedVM = ui.adaptTranscript(wire)
  const commit = cookedVM.session.git.commits[0]
  assert('ADAPT-commit-churn', 'adapter cooks per-commit churn onto CommitVM (adds/dels/files)', commit.adds === 312 && commit.dels === 24 && commit.files === 7)
  assert('ADAPT-commit-anchor', 'adapter anchors the commit to the nearest turn at/before commitTime (turn 1)', commit.turn === 1)
  const cpOut = composite({ viewModel: cookedVM, capabilities: allCaps })
  assert('VIEWER-checkpoint-stat', 'composite draws the checkpoint churn stat (+312 −24 · 7 files) at the anchored turn', cpOut.includes('txn-cp-stat') && cpOut.includes('+312') && cpOut.includes('7 files'))
}

/* ── structural widening: TaskBoundary renders the cooked per-task churn/files stat ──── */
{
  const vmTaskStat = { ...vm, tasks: [{ id: 't0', index: 1, prompt: 'Port the transcript canvas.', turnIndices: [0], durationMs: 300000, tools: 1, stat: '2 files · +316 −25' }] }
  const out = composite({ viewModel: vmTaskStat, capabilities: allCaps })
  assert('VIEWER-taskboundary-stat', 'TaskBoundary renders the cooked per-task churn/files stat in .txn-tb-meta', out.includes('txn-tb-meta') && out.includes('+316') && out.includes('2 files'))
}

/* ── report ──────────────────────────────────────────────────────────────────── */
const fails = results.filter((r) => !r.ok)
for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.id + ' — ' + r.desc)
if (fails.length) {
  console.error(
    [
      '',
      `transcript-ui behavioral smoke FAILED: ${fails.length}/${results.length} assertion(s) red.`,
      'What went wrong: a lifted transcript primitive no longer produces its expected cooked markup.',
      'Why it matters: the dumb render contract (markup/dispatch/trim) the parity oracle depends on has drifted.',
      'Where: ' + fails.map((f) => f.id).join(', '),
      'How to fix: inspect the named primitive in src/ui/transcript/ and restore the asserted behavior.',
    ].join('\n'),
  )
  process.exit(1)
}
console.log(`\ntranscript-ui behavioral smoke: all ${results.length} assertions passed across ${new Set(results.map((r) => r.id.split('-')[0])).size} primitives.`)

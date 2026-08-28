#!/usr/bin/env node
/* ───────────────────────────────────────────────────────────────────────────
   smoke-transcript — adapter + analytics smoke over representative fixtures
   ─────────────────────────────────────────────────────────────────────────
   fairtrade has NO unit-test runner; its convention is node smoke scripts. This
   one imports the PRODUCTION transcript adapter + shared analytics util directly
   from source (the same `src/ui/transcript/*` modules the lib build bundles and
   consumers import) and exercises them end-to-end over fixtures that include the
   git-PRESENT (nested TS shape), git-FLAT (Go shape), and git-ABSENT cases.

   Run: `node scripts/smoke-transcript.mjs` (or `pnpm smoke:transcript`).
   ─────────────────────────────────────────────────────────────────────────── */

// Import the production data modules DIRECTLY (not the sub-barrel): the sub-barrel now also
// re-exports the lifted JSX render primitives, and Node cannot load `.jsx` from source
// (ERR_UNKNOWN_FILE_EXTENSION). adapter.js + analytics.js are the same production source modules the
// lib build bundles, so this node-run data smoke stays faithful while staying JSX-free.
import { adaptTranscript } from '../src/ui/transcript/adapter.js'
import {
  computeTasks,
  computeTurnLabels,
  buildTaskWaterfall,
  annotateTranscript,
  computePersonalMedians,
  assessScorecard,
} from '../src/ui/transcript/analytics.js'

/** @type {string[]} */
const failures = []
/** @param {boolean} cond @param {string} msg */
function check(cond, msg) {
  if (!cond) failures.push(msg)
}

/* ── Shared turn stream: user/assistant/subagent + thinking + 6 tool kinds ──── */
const TURNS = [
  { index: 0, role: 'user', content: 'Port the transcript canvas into the shared package. Read the renderer first.', timestamp: '2026-06-17T09:12:00Z', depth: 0, tokensIn: 280, tokensOut: 0 },
  { index: 1, role: 'assistant', content: 'The renderer lives under canvas/. I should read TurnRow.tsx before moving anything.', timestamp: '2026-06-17T09:12:30Z', depth: 0, entryType: 'thinking', hasThinking: true, tokensIn: 1840, tokensOut: 920 },
  {
    index: 2, role: 'assistant', content: 'Reading the current renderer before extracting it.', timestamp: '2026-06-17T09:13:00Z', depth: 0, entryType: 'tool_use', tokensIn: 2100, tokensOut: 640,
    toolCalls: [
      { id: 't2a', name: 'Read', arguments: '{"file_path":"src/canvas/TurnRow.tsx"}', result: '"export function TurnRow() {}"', toolKind: 'read', filePath: 'src/canvas/TurnRow.tsx' },
      { id: 't2b', name: 'Grep', arguments: '{"pattern":"rendererFor","path":"src"}', result: '"4 matches"', toolKind: 'search' },
    ],
  },
  { index: 3, role: 'user', content: 'Looks right. Run a typecheck across the workspace before moving files.', timestamp: '2026-06-17T09:15:00Z', depth: 0, tokensIn: 90, tokensOut: 0 },
  {
    index: 4, role: 'assistant', content: 'Running the workspace typecheck first.', timestamp: '2026-06-17T09:15:30Z', depth: 0, entryType: 'tool_use', tokensIn: 2400, tokensOut: 1180,
    toolCalls: [
      { id: 't4a', name: 'Bash', arguments: '{"command":"pnpm -r typecheck"}', result: '"tasks.ts(47,9): error TS2532"', toolKind: 'execute', exitCode: 2, isError: true },
    ],
  },
  {
    index: 5, role: 'assistant', content: 'Fixing the strict-mode error in the tasks helper.', timestamp: '2026-06-17T09:16:00Z', depth: 0, entryType: 'tool_use', tokensIn: 2200, tokensOut: 700,
    toolCalls: [
      { id: 't5a', name: 'Edit', arguments: '{"file_path":"src/lib/tasks.ts","old_string":"const first = groups[0]\\n  return first.turns[0].index","new_string":"const first = groups[0]\\n  if (!first) return null\\n  return first.turns[0].index"}', result: '"ok"', toolKind: 'edit', filePath: 'src/lib/tasks.ts' },
    ],
  },
  {
    index: 6, role: 'assistant', content: 'Adding the new module.', timestamp: '2026-06-17T09:16:30Z', depth: 0, entryType: 'tool_use', tokensIn: 1200, tokensOut: 500,
    toolCalls: [
      { id: 't6a', name: 'Write', arguments: '{"file_path":"src/lib/adapter.ts","content":"export function adapt() {}\\nexport const x = 1\\n"}', result: '"ok"', toolKind: 'edit', filePath: 'src/lib/adapter.ts' },
    ],
  },
  {
    index: 7, role: 'assistant', content: 'Delegating the verification sweep.', timestamp: '2026-06-17T09:17:00Z', depth: 1, agentName: 'researcher', entryType: 'tool_use', tokensIn: 800, tokensOut: 300,
    toolCalls: [
      { id: 't7a', name: 'Task', arguments: '{"description":"verify exports","subagent_type":"researcher"}', result: '"done"', toolKind: 'other' },
    ],
  },
  { index: 8, role: 'assistant', content: 'All packages typecheck and build. The canvas now lives in the shared package.', timestamp: '2026-06-17T09:18:00Z', depth: 0, entryType: 'text', stopReason: 'end_turn', tokensIn: 900, tokensOut: 1700 },
]

const SCORECARD = {
  specQualityScore: 30, signalDensity: 25, m7SpecHasExamples: false,
  m4ConsecutiveErrorMax: 5, withinSessionReverts: 4,
  retryTokensWasted: 300, totalTokens: 1000, m5ContextUtilizationPct: 80, outcome: 'partial',
}

function base() {
  return {
    id: 's-smoke', harness: 'claude-code', startTime: '2026-06-17T09:12:00Z', endTime: '2026-06-17T09:18:00Z',
    durationMins: 6, totalTokens: 16280, tokensIn: 11810, tokensOut: 6470, turnCount: TURNS.length, toolCallCount: 6,
    project: 'fairtrade', model: 'claude-opus-4', workingDirectory: '/repo', outcome: 'partial',
    turns: TURNS.map((t) => ({ ...t, toolCalls: t.toolCalls ? t.toolCalls.map((c) => ({ ...c })) : undefined })),
    scorecard: SCORECARD,
  }
}

/* git-PRESENT: nested TS gitContext shape (user + per-commit churn) */
const gitPresent = {
  ...base(),
  gitContext: {
    branch: 'lift/transcript', user: 'dev', email: 'dev@peasant.dev', remote: 'origin', workingDirectory: '/repo', startCommit: 'aaa',
    commits: [
      { hash: '9f3c1ad0', message: 'feat(canvas): port TurnRow + tool renderers', timestamp: '2026-06-17T09:16:00Z', filesChanged: 7, insertions: 312, deletions: 24 },
    ],
  },
}
/* git-FLAT: Go runtime shape (flat branch/remote, no gitContext) */
const gitFlat = { ...base(), gitBranch: 'main', gitRemote: 'git@github.com:peasant-labs/fairtrade.git' }
/* git-ABSENT: no git signal at all */
const gitAbsent = base()

/* ════════════════════════════════════════════════════════════════════════════
   (A) git-PRESENT — the fully-populated surface
   ════════════════════════════════════════════════════════════════════════════ */
const vm = adaptTranscript(gitPresent)

// toolCallsById is a Map, parsed once, sharing identity with turns.
check(vm.toolCallsById instanceof Map, 'A: toolCallsById must be a Map')
check(vm.toolCallsById.size === 6, `A: expected 6 indexed tool calls, got ${vm.toolCallsById.size}`)

// SOLE-parse guarantee: cooked tool calls expose PARSED args, never the raw wire string.
for (const tc of vm.toolCallsById.values()) {
  check(typeof tc.arguments === 'undefined', `A: ToolCallVM ${tc.id} must not carry the raw wire 'arguments' string`)
  check(tc.args !== undefined, `A: ToolCallVM ${tc.id} must carry parsed 'args'`)
  check(typeof tc.preview === 'string' && tc.preview.length > 0, `A: ToolCallVM ${tc.id} must have a preview`)
}
const readVm = vm.toolCallsById.get('t2a')
check(!!readVm && readVm.kind === 'read' && readVm.group === 'read', 'A: Read tool must classify as read/read')
check(readVm?.preview === 'src/canvas/TurnRow.tsx', `A: Read preview should be the located file path, got ${readVm?.preview}`)

// thinking sourced from the entryType=thinking turn (content moved into thinking).
const thinkingTurn = vm.turns.find((t) => t.index === 1)
check(!!thinkingTurn?.thinking && thinkingTurn.thinking.text.length > 0, 'A: turn 1 thinking must be sourced from content')
check(thinkingTurn?.content === '', 'A: thinking turn content must be emptied once extracted')
check((thinkingTurn?.thinking?.words ?? 0) > 0, 'A: thinking must carry a word count')

// subagent nesting via depth.
const sub = vm.turns.find((t) => t.index === 7)
check(sub?.depth === 1 && sub?.agentName === 'researcher' && sub?.provider === undefined, 'A: subagent turn must keep depth/agentName without fabricating a provider accent')
check(vm.turns.find((turn) => turn.role === 'assistant' && turn.depth === 0)?.provider === gitPresent.harness, 'A: top-level assistant must preserve the canonical payload harness')

// labels: "1", "1a"… "2", "2a"… (two user prompts → two tasks)
check(vm.turns[0].label === '1' && vm.turns[3].label === '2', `A: task labels wrong (${vm.turns[0].label}/${vm.turns[3].label})`)

// every turn carries an annotations array (never undefined).
check(vm.turns.every((t) => Array.isArray(t.annotations)), 'A: every TurnVM.annotations must be an array')

// diffs: the Edit + Write produce hunks with cooked +/- lines.
check(vm.diffs.length === 2, `A: expected 2 diff entries (edit+write), got ${vm.diffs.length}`)
const editDiff = vm.diffs.find((d) => d.path === 'src/lib/tasks.ts')
check(!!editDiff && editDiff.hunks[0].lines.some((l) => l.sign === 'add'), 'A: edit diff must contain an added line')
check(!!editDiff && editDiff.hunks[0].lines.some((l) => l.sign === 'ctx'), 'A: edit diff must keep shared context lines (real LCS)')
check((editDiff?.adds ?? 0) > 0, 'A: edit diff must report insertions')

// files rollup: a.ts read+edit, adapter.ts write.
check(vm.files.length >= 3, `A: expected ≥3 files, got ${vm.files.length}`)
const tasksFile = vm.files.find((f) => f.path === 'src/lib/tasks.ts')
check(!!tasksFile && tasksFile.edits === 1 && tasksFile.edited, 'A: tasks.ts must show one edit and edited=true')

// tasks: two user-prompt spans.
check(vm.tasks.length === 2, `A: expected 2 task groups, got ${vm.tasks.length}`)
check(vm.tasks[1].outcome === 'error', 'A: second task (typecheck failure) must have error outcome')

// highlights back the HIGHLIGHTS tab and are non-empty across kinds.
check(vm.highlights.length > 0, 'A: highlights must be non-empty')
const kinds = new Set(vm.highlights.map((h) => h.kind))
check(kinds.has('request') && kinds.has('error') && kinds.has('final') && kinds.has('checkpoint'), `A: highlights missing kinds (got ${[...kinds].join(',')})`)

// git cluster cooked render-when-present from the nested shape.
check(!!vm.session.git, 'A: session.git must be present when gitContext is present')
check(vm.session.git?.branch === 'lift/transcript', 'A: git.branch must come from gitContext.branch')
check(vm.session.git?.author === 'dev', 'A: git.author must come from gitContext.user')
check((vm.session.git?.commits?.length ?? 0) === 1, 'A: git.commits must be cooked')
check(vm.session.git?.filesChanged === 7 && vm.session.git?.insertions === 312 && vm.session.git?.deletions === 24, 'A: git churn must sum per-commit')
check(vm.session.git?.commits?.[0].shortHash === '9f3c1ad', 'A: commit shortHash must be the 7-char prefix')

// analytics render-when-present.
check(!!vm.analytics, 'A: analytics block must be present')
check((vm.analytics?.phases?.length ?? 0) > 0, 'A: analytics.phases must be derived')
check((vm.analytics?.patternAnnotations?.length ?? 0) > 0, 'A: analytics.patternAnnotations must be derived')
check(vm.analytics?.patternAnnotations?.some((a) => a.kind === 'error') ?? false, 'A: error pattern must be detected for the failed Bash')
check(vm.analytics?.patternAnnotations?.some((a) => a.kind === 'subagent') ?? false, 'A: subagent pattern must be detected for Task')
check((vm.analytics?.scorecardBands?.length ?? 0) > 0, 'A: analytics.scorecardBands must be derived from the scorecard')
const loopBand = vm.analytics?.scorecardBands?.find((b) => b.id === 'loop')
check(loopBand?.band === 'bad', `A: loop band must be 'bad' (5 consecutive errors), got ${loopBand?.band}`)

// filter index: tool-group counts + annotation tags.
check(vm.filterIndex.totalTurns === vm.turns.length, 'A: filterIndex.totalTurns must match turn count')
check(vm.filterIndex.toolGroupCounts.edits === 2, `A: expected 2 edit-group calls (Edit+Write), got ${vm.filterIndex.toolGroupCounts.edits}`)
check(vm.filterIndex.tags.includes('errors'), 'A: filterIndex.tags must surface the error tag')

/* determinism — the projection is pure (screenshot-stable). */
const serialize = (m) => JSON.stringify({ turns: m.turns, diffs: m.diffs, files: m.files, tasks: m.tasks, highlights: m.highlights, filterIndex: m.filterIndex, analytics: m.analytics, session: m.session })
check(serialize(adaptTranscript(gitPresent)) === serialize(vm), 'A: adaptTranscript must be deterministic for identical input')

/* ════════════════════════════════════════════════════════════════════════════
   (B) git-FLAT (Go runtime) + (C) git-ABSENT — clean degrade
   ════════════════════════════════════════════════════════════════════════════ */
const vmFlat = adaptTranscript(gitFlat)
check(vmFlat.session.git?.branch === 'main', 'B: flat gitBranch must cook into session.git.branch')
check((vmFlat.session.git?.commits?.length ?? 0) === 0, 'B: flat Go wire carries no commits')
check(vmFlat.session.git?.filesChanged === undefined, 'B: flat Go wire has no churn cluster')

const vmAbsent = adaptTranscript(gitAbsent)
check(vmAbsent.session.git === undefined, 'C: session.git must be omitted entirely when no git signal is present')
// core arrays remain present (never undefined) even with no git.
check(Array.isArray(vmAbsent.diffs) && Array.isArray(vmAbsent.files) && Array.isArray(vmAbsent.tasks) && Array.isArray(vmAbsent.highlights), 'C: core arrays must stay present without git')
check(vmAbsent.highlights.every((h) => h.kind !== 'checkpoint'), 'C: no checkpoint highlights without commits')

/* empty session must not throw and must yield empty-but-present core arrays. */
const empty = adaptTranscript({ id: 'e', harness: 'codex', startTime: 't', endTime: 't', durationMins: 0, totalTokens: 0, tokensIn: 0, tokensOut: 0, turnCount: 0, toolCallCount: 0, turns: [] })
check(empty.turns.length === 0 && empty.tasks.length === 0 && empty.diffs.length === 0, 'C: empty payload yields empty-but-present arrays')

/* ════════════════════════════════════════════════════════════════════════════
   (D) back-compat analytics helpers (re-exported verbatim by the transcript-browser migration)
   ════════════════════════════════════════════════════════════════════════════ */
const rawTasks = computeTasks(TURNS)
check(rawTasks.length === 2 && rawTasks[0].prompt.startsWith('Port the transcript'), 'D: computeTasks must split on top-level user prompts')
check(rawTasks[1].hasErrors === true, 'D: computeTasks must flag the error task')

const labels = computeTurnLabels(TURNS)
check(labels[0] === '1' && labels[1] === '1a' && labels[3] === '2', `D: computeTurnLabels wrong (${labels.slice(0, 4).join(',')})`)

const wf = buildTaskWaterfall(rawTasks)
check(wf.length === 2 && Math.abs(wf.reduce((s, x) => s + x.widthPct, 0) - 100) < 0.001, 'D: waterfall widths must sum to 100%')

const patterns = annotateTranscript(TURNS)
check(patterns.some((p) => p.type === 'error') && patterns.some((p) => p.type === 'subagent'), 'D: annotateTranscript must detect error + subagent')

const medians = computePersonalMedians([
  { totalTokens: 1000, retryTokensWasted: 300, specQualityScore: 60, withinSessionReverts: 2 },
  { totalTokens: 1000, retryTokensWasted: 100, specQualityScore: 40, withinSessionReverts: 4 },
])
check(medians.retryShare !== undefined && medians.specQualityScore === 50, `D: computePersonalMedians wrong (${JSON.stringify(medians)})`)

const bands = assessScorecard(SCORECARD, medians)
check(bands.length === 3, `D: assessScorecard must return three axis bands, got ${bands.length}`)
check(bands.find((b) => b.id === 'prompt')?.band === 'bad', 'D: low spec quality must band prompt as bad')

/* ── Report ──────────────────────────────────────────────────────────────────── */
if (failures.length) {
  throw new Error(
    [
      'fairtrade transcript smoke FAILED in scripts/smoke-transcript.mjs.',
      'What went wrong: the production adapter/analytics produced an unexpected projection for one or more fixtures.',
      'Why it matters: every lifted transcript component renders the cooked TranscriptViewModel; a wrong projection breaks all consumers (mockup, peasant, village).',
      'Where: adaptTranscript / computeAnalytics in src/ui/transcript/{adapter,analytics}.js, exercised over the git-present/flat/absent fixtures here.',
      'How to fix: reconcile the failing assertion below against the view-model contract (src/ui/transcript/view-model.js) and the schema/develop Go wire.',
      '',
      ...failures.map((f) => `  ✘ ${f}`),
    ].join('\n'),
  )
}

const total = adaptTranscript(gitPresent)
console.log(
  `fairtrade transcript smoke OK: adapted ${total.turns.length} turns / ${total.toolCallsById.size} tool calls → ` +
    `${total.diffs.length} diffs, ${total.files.length} files, ${total.tasks.length} tasks, ${total.highlights.length} highlights, ` +
    `${total.analytics?.phases?.length ?? 0} phases, ${total.analytics?.scorecardBands?.length ?? 0} scorecard bands; ` +
    'git present/flat/absent all degrade correctly; back-compat helpers green.',
)

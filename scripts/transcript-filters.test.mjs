#!/usr/bin/env node
/* Filter-evaluation contract for the transcript filters rail.

   The regression this locks down: eleven of the rail's fourteen controls —
   `thinking`, `tool calls`, all seven tool groups, `retries` and `re-edit` —
   rendered, counted and toggled while `visibleTurns` read only `prompts`,
   `responses` and `tags.errors`. Unchecking them changed nothing on screen, and
   the `tool calls` umbrella left every child checked because the umbrella and
   the group map were independent state.

   Every case below asserts on the OBSERVABLE outcome (which turns survive, what
   the boxes read), not on internal shape, so the rules can be reimplemented
   without rewriting the test.

   Run: `node scripts/transcript-filters.test.mjs` (wired into build:lib). */

import assert from 'node:assert/strict'
import {
  categoryCounts,
  kindsOf,
  cascadeToolGroups,
  matchesFilters,
  setToolCalls,
  toggleToolGroup,
  toolGroupsState,
} from '../src/ui/transcript/filters.js'
import { TOOL_GROUPS } from '../src/ui/transcript/view-model.js'

const allGroups = (on) => Object.fromEntries(TOOL_GROUPS.map((id) => [id, on]))

/** A filter state with everything visible — the viewer's DEFAULT_FILTERS. */
const OPEN = Object.freeze({
  categories: { prompts: true, responses: true, thinking: true, toolcalls: true },
  toolGroups: allGroups(true),
  tags: { errors: false, retries: false, revert: false },
  views: { hidden: true, expandAll: false, compact: false },
  checkpoint: 'all',
})

/* One turn of each kind the adapter emits, plus two COMPOUND turns (7, 8): some
   harnesses fold a thinking preamble or a tool call into the same turn as text,
   and the adapter keeps them together. A compound turn stays visible while any
   kind it carries is still wanted. */
const TURNS = [
  { index: 0, role: 'user', content: 'do the thing', toolCalls: [] },
  { index: 1, role: 'assistant', content: 'on it', toolCalls: [] },
  { index: 2, role: 'assistant', content: '', thinking: 'hmm', toolCalls: [] },
  { index: 3, role: 'assistant', content: '', toolCalls: [{ id: 'a', group: 'bash', isError: false }] },
  { index: 4, role: 'assistant', content: '', toolCalls: [{ id: 'b', group: 'edits', isError: false }] },
  { index: 5, role: 'assistant', content: '', toolCalls: [{ id: 'c', group: 'read', isError: true }] },
  { index: 6, role: 'system', content: 'session notice', toolCalls: [] },
  { index: 7, role: 'assistant', content: 'after some thought', thinking: 'hmm', toolCalls: [] },
  { index: 8, role: 'assistant', content: 'let me edit', toolCalls: [{ id: 'd', group: 'edits', isError: false }] },
]

const ANNOTATIONS = { 3: [{ kind: 'retry' }], 4: [{ kind: 'revert' }], 5: [{ kind: 'error' }] }

const visible = (filters, ctx = { annotationsByTurn: ANNOTATIONS }) =>
  TURNS.filter((t) => matchesFilters(t, filters, ctx)).map((t) => t.index)

const withCategories = (patch) => ({ ...OPEN, categories: { ...OPEN.categories, ...patch } })
const withTags = (patch) => ({ ...OPEN, tags: { ...OPEN.tags, ...patch } })

const failures = []
const check = (name, fn) => {
  try {
    fn()
  } catch (err) {
    failures.push(`${name}: ${err.message}`)
  }
}

/* ── categories partition the trace ──────────────────────────────────────────── */

check('each turn reports every kind it carries', () => {
  assert.deepEqual(TURNS.map((t) => kindsOf(t)), [
    ['prompts'], ['responses'], ['thinking'], ['toolcalls'], ['toolcalls'], ['toolcalls'], [],
    ['responses', 'thinking'], ['responses', 'toolcalls'],
  ])
})

check('an open filter shows every turn', () => {
  assert.deepEqual(visible(OPEN), [0, 1, 2, 3, 4, 5, 6, 7, 8])
})

check('unchecking prompts hides only user turns', () => {
  assert.deepEqual(visible(withCategories({ prompts: false })), [1, 2, 3, 4, 5, 6, 7, 8])
})

check('unchecking responses hides text responses but KEEPS tool + thinking turns', () => {
  // The pre-fix predicate matched `role === 'assistant'`, which took 3, 4 and 5
  // with it and made the tool-call checkbox unobservable.
  assert.deepEqual(visible(withCategories({ responses: false })), [0, 2, 3, 4, 5, 6, 7, 8])
})

check('unchecking thinking hides standalone thinking turns, not a reply that thought first', () => {
  assert.deepEqual(visible(withCategories({ thinking: false })), [0, 1, 3, 4, 5, 6, 7, 8])
})

check('unchecking tool calls hides tool-only turns, not text that accompanies a call', () => {
  assert.deepEqual(visible(withCategories({ toolcalls: false })), [0, 1, 2, 6, 7, 8])
})

check('system turns survive every category being off', () => {
  const none = withCategories({ prompts: false, responses: false, thinking: false, toolcalls: false })
  assert.deepEqual(visible(none), [6])
})

check('a compound turn hides only when every kind it carries is unwanted', () => {
  assert.deepEqual(visible(withCategories({ responses: false, thinking: false })), [0, 3, 4, 5, 6, 8])
  assert.deepEqual(visible(withCategories({ responses: false, toolcalls: false })), [0, 2, 6, 7])
})

check('category counts are turn-based; a compound turn counts under each kind it carries', () => {
  const counts = categoryCounts(TURNS)
  assert.deepEqual(counts, { prompts: 1, responses: 3, thinking: 2, toolcalls: 4 })
})

/* ── tool groups narrow tool turns ───────────────────────────────────────────── */

check('a single tool group narrows to its own turns', () => {
  assert.deepEqual(visible({ ...OPEN, toolGroups: { ...allGroups(false), bash: true } }), [0, 1, 2, 3, 6, 7, 8])
})

check('tool groups do not affect non-tool turns', () => {
  const noGroups = { ...OPEN, toolGroups: allGroups(false) }
  assert.deepEqual(visible(noGroups), [0, 1, 2, 6, 7, 8])
})

check('a group absent from the map counts as enabled', () => {
  assert.deepEqual(visible({ ...OPEN, toolGroups: {} }), [0, 1, 2, 3, 4, 5, 6, 7, 8])
})

/* ── semantic tags narrow everything ─────────────────────────────────────────── */

check('no tag checked keeps every turn', () => {
  assert.deepEqual(visible(OPEN), [0, 1, 2, 3, 4, 5, 6, 7, 8])
})

check('retries narrows to retry-annotated turns', () => {
  assert.deepEqual(visible(withTags({ retries: true })), [3])
})

check('re-edit narrows to revert-annotated turns', () => {
  assert.deepEqual(visible(withTags({ revert: true })), [4])
})

check('errors still matches the turn-level flag it always did', () => {
  assert.deepEqual(visible(withTags({ errors: true })), [5])
})

check('two tags checked are a union, not an intersection', () => {
  assert.deepEqual(visible(withTags({ retries: true, revert: true })), [3, 4])
})

/* ── checkpoint scoping ──────────────────────────────────────────────────────── */

check('a checkpoint anchor scopes to a prefix', () => {
  const seen = TURNS.filter((t) => matchesFilters(t, OPEN, { annotationsByTurn: ANNOTATIONS, checkpointTurn: 3 }))
  assert.deepEqual(seen.map((t) => t.index), [0, 1, 2, 3])
})

/* ── the umbrella and its children are one decision ──────────────────────────── */

const counts = { edits: 1, bash: 1, read: 1, search: 0, fetch: 0, tasks: 0, other: 0 }

check('unchecking the umbrella unchecks every child', () => {
  const next = setToolCalls(OPEN, false)
  assert.equal(next.categories.toolcalls, false)
  for (const id of TOOL_GROUPS) assert.equal(next.toolGroups[id], false, `${id} should be off`)
})

check('re-checking the umbrella re-checks every child', () => {
  const next = setToolCalls(setToolCalls(OPEN, false), true)
  assert.equal(next.categories.toolcalls, true)
  for (const id of TOOL_GROUPS) assert.equal(next.toolGroups[id], true, `${id} should be on`)
})

check('unchecking the last live group turns the umbrella off', () => {
  let f = OPEN
  for (const id of ['edits', 'bash', 'read']) f = toggleToolGroup(f, id, counts)
  assert.equal(f.categories.toolcalls, false)
})

check('re-checking any group turns the umbrella back on', () => {
  let f = setToolCalls(OPEN, false)
  f = toggleToolGroup(f, 'bash', counts)
  assert.equal(f.categories.toolcalls, true)
  assert.equal(f.toolGroups.bash, true)
})

check('a click under a legacy unchecked umbrella enables that one group only', () => {
  // Filter state persisted before the cascade existed: umbrella off over an
  // all-true map. The rail shows every child unchecked; the user's click on
  // `bash` must yield bash alone, not the other six.
  const legacy = { ...OPEN, categories: { ...OPEN.categories, toolcalls: false }, toolGroups: allGroups(true) }
  const next = toggleToolGroup(legacy, 'bash', counts)
  assert.equal(next.categories.toolcalls, true)
  assert.deepEqual(next.toolGroups, { ...allGroups(false), bash: true })
})

check('a partial selection reports mixed', () => {
  assert.equal(toolGroupsState(allGroups(true), counts), true)
  assert.equal(toolGroupsState(allGroups(false), counts), false)
  assert.equal(toolGroupsState({ ...allGroups(true), bash: false }, counts), 'mixed')
})

check('groups with zero matches never hold the umbrella in mixed', () => {
  // search/fetch/tasks/other are disabled in the rail; if they counted, a user
  // could never resolve the tri-state.
  const onlyLiveOn = { ...allGroups(false), edits: true, bash: true, read: true }
  assert.equal(toolGroupsState(onlyLiveOn, counts), true)
})

check('cascade writes every group, including ones with no matches', () => {
  assert.deepEqual(cascadeToolGroups(true), allGroups(true))
  assert.deepEqual(cascadeToolGroups(false), allGroups(false))
})

/* ── the rail and the trace agree ────────────────────────────────────────────── */

check('umbrella off hides exactly the tool-only turns its badge counted', () => {
  const off = setToolCalls(OPEN, false)
  const hidden = TURNS.filter((t) => !matchesFilters(t, off, { annotationsByTurn: ANNOTATIONS }))
  const toolOnly = TURNS.filter((t) => kindsOf(t).length === 1 && kindsOf(t)[0] === 'toolcalls')
  assert.equal(hidden.length, toolOnly.length)
  assert.equal(categoryCounts(TURNS).toolcalls, toolOnly.length + 1) // + the compound text+tool turn
})

if (failures.length) {
  console.error(`transcript-filters: ${failures.length} failing case(s)\n`)
  for (const f of failures) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('transcript-filters: all cases pass')

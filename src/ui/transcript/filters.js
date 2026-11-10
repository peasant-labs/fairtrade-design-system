/* Transcript filter evaluation — the ONE place the filters rail's state is turned
   into a visible-turn decision.

   Previously this lived inline in TranscriptViewer's `visibleTurns` useMemo and
   read only three of the rail's fourteen controls (`prompts`, `responses`,
   `tags.errors`). The other eleven — `thinking`, `toolcalls`, all seven
   `toolGroups`, `retries` and `re-edit` — were rendered, counted, and toggled
   while changing nothing on screen. Extracting the predicate keeps the rail and
   the trace provably reading the same rules, and makes them testable without a
   DOM.

   THE UNIT IS THE PART, NOT THE TURN. A turn is the folded assistant message:
   its text, an optional thinking block, and zero or more tool calls, which the
   harness recorded as separate entries (OpenCode literally calls them parts).
   Each category names a PART kind, so unchecking it removes that part wherever
   it lives: `tool calls` off drops the tool cards from inside a text turn and
   the turn keeps its text; a group off drops only that group's calls; a turn
   leaves the trace only when none of its parts survive. Deciding at the turn
   level instead (keep or drop whole) cannot honour the label on the ordinary
   Claude Code shape, where nearly every assistant turn is text plus tool calls:
   `tool calls` off would either delete the text too or do nothing.

   System turns have their own category and are HIDDEN by default: harness bookkeeping is
   not conversation, so the reader opts into it. ABSENT MEANS HIDDEN: a filter object that
   carries no `system` key — saved before the category existed, or supplied by a host that
   only overrides other dimensions — follows the documented default rather than silently
   revealing the bookkeeping. Only an explicit `true` shows the entries.

   The reader's choice outlives one page: a host persists the versioned INTENT this module
   defines ({@link normalizeFilterIntent} / {@link applyFilterIntent} /
   {@link encodeFilterIntent}) in its own local store. The intent is a deviation map from
   this default, never the resolved filter object, so a reader who never touched the toggle
   keeps following the default. */

import { TOOL_GROUPS } from './view-model.js'

/**
 * The canonical filter state every consumer starts from. Complete (every category,
 * every tool group, every tag, every view) because the viewer's controllable state
 * does not merge a partial object: a host that supplies filters owns every key.
 * Deep-frozen so a handler cannot mutate the default through a spread-by-reference.
 *
 * `system` is FALSE: system entries are harness bookkeeping, not conversation, and a
 * reader reveals them from the rail when they want the evidence.
 */
export const DEFAULT_TRANSCRIPT_FILTERS = Object.freeze({
  categories: Object.freeze({ prompts: true, responses: true, thinking: true, toolcalls: true, system: false }),
  toolGroups: Object.freeze(
    /** @type {Record<ToolGroup, boolean>} */ (Object.fromEntries(TOOL_GROUPS.map((id) => [id, true]))),
  ),
  tags: Object.freeze({ errors: false, retries: false, revert: false }),
  views: Object.freeze({ hidden: true, expandAll: false, compact: false }),
  checkpoint: 'all',
})

/* ── the versioned filter-intent contract ──────────────────────────────────────
   A host that remembers the reader's choice across visits stores the INTENT below, not
   the resolved filters. Today the only remembered dimension is `categories.system`, and
   the shape is CLOSED: `{version: 1, system?: boolean}`. Everything else — checkpoints,
   views, tool groups, tags — is session state that must never be persisted, so encoding
   never emits it and normalizing drops it.

   Absence means "follow the documented default" (system entries hidden). That is why a
   pre-toggle saved state cannot turn the bookkeeping on, and why a reader who never
   touched the toggle keeps following future default changes. An explicit `false` is kept
   as written: it distinguishes a reader who deliberately hid the entries from one who
   never expressed a choice, which matters if this default is ever revisited.

   A version this module does not know is not interpreted: it normalizes to the version-1
   shape with no dimensions, so a newer host's state degrades to the current default
   instead of guessing at fields it cannot read. */

/** The only intent version this module reads or writes. @type {number} */
export const FILTER_INTENT_VERSION = 1

/**
 * The persisted reader intent: a closed, versioned deviation map. `system` is present
 * only when the reader expressed that toggle, and absent means the documented default.
 * @typedef {object} FilterIntent
 * @property {number} version  the intent contract version (1)
 * @property {boolean} [system] explicit `categories.system`; absent follows the default
 */

/**
 * Normalize a value read back from a host's local store into the closed intent shape.
 * Unknown keys are dropped, a non-object or an unknown version degrades to no dimensions,
 * and a non-boolean `system` is ignored. Never throws: stored state is untrusted input.
 *
 * @param {unknown} raw
 * @returns {FilterIntent}
 */
export function normalizeFilterIntent(raw) {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : null
  /** @type {FilterIntent} */
  const intent = { version: FILTER_INTENT_VERSION }
  if (!record || record.version !== FILTER_INTENT_VERSION) return intent
  if (typeof record.system === 'boolean') intent.system = record.system
  return intent
}

/**
 * Merge a stored intent onto a filter state. Only `categories.system` is resolved: absent
 * means the documented default (hidden), explicit `true` reveals the entries, explicit
 * `false` hides them. Every other dimension of `base` passes through untouched, and no
 * view or checkpoint value ever comes from stored state.
 *
 * @param {TranscriptFilters} [base]
 * @param {unknown} rawIntent
 * @returns {TranscriptFilters}
 */
export function applyFilterIntent(base = DEFAULT_TRANSCRIPT_FILTERS, rawIntent) {
  const { system } = normalizeFilterIntent(rawIntent)
  return {
    ...base,
    categories: { ...base.categories, system: system === true },
  }
}

/**
 * Encode the reader's current choice as the intent a host stores. Only a deviation from
 * the documented default is carried: the entries are revealed (`{version: 1, system: true}`)
 * or the intent says nothing and the reader keeps following the default. Checkpoints,
 * views, tool groups and tags are never encoded.
 *
 * @param {TranscriptFilters} [filters]
 * @returns {FilterIntent}
 */
export function encodeFilterIntent(filters = DEFAULT_TRANSCRIPT_FILTERS) {
  /** @type {FilterIntent} */
  const intent = { version: FILTER_INTENT_VERSION }
  if (filters.categories?.system === true) intent.system = true
  return intent
}

/**
 * How many filter choices deviate from {@link DEFAULT_TRANSCRIPT_FILTERS}: the number
 * the rail's "clear (N)" badge shows. Tool groups count only while `tool calls` is on,
 * because the umbrella has already cascaded every group off and counting those would
 * report eight active filters for one click.
 *
 * @param {TranscriptFilters} [filters]
 * @returns {number}
 */
export function filtersActive(filters = DEFAULT_TRANSCRIPT_FILTERS) {
  const defaults = DEFAULT_TRANSCRIPT_FILTERS
  let count = 0
  for (const key of ['prompts', 'responses', 'thinking', 'toolcalls', 'system']) {
    // `system` is the one category whose documented default is off, so absence reads as
    // off rather than as a deviation.
    const on = key === 'system' ? filters.categories?.system === true : filters.categories?.[key] !== false
    if (on !== defaults.categories[key]) count += 1
  }
  if (filters.categories?.toolcalls !== false) {
    for (const id of TOOL_GROUPS) {
      if ((filters.toolGroups?.[id] !== false) !== defaults.toolGroups[id]) count += 1
    }
  }
  for (const key of ['errors', 'retries', 'revert']) {
    if (!!filters.tags?.[key] !== defaults.tags[key]) count += 1
  }
  return count
}

/** Filter-state tag key → the `AnnotationVM.kind` the adapter emits for it. */
const TAG_KIND = { errors: 'error', retries: 'retry', revert: 'revert' }

/** @typedef {import('./view-model.js').TurnVM} TurnVM */
/** @typedef {import('./view-model.js').ToolGroup} ToolGroup */
/** @typedef {import('./state-capabilities.js').TranscriptFilters} TranscriptFilters */

/** @typedef {'prompts' | 'responses' | 'thinking' | 'toolcalls' | 'system'} Category */

/**
 * Every part kind a cooked turn carries, in rail order. Empty for turns no
 * category governs. A turn with text and tool calls reports
 * both; the rail badges count turns per kind from this.
 *
 * @param {TurnVM} turn
 * @returns {Category[]}
 */
export function kindsOf(turn) {
  if (turn.role === 'user') return ['prompts']
  if (turn.role === 'system') return ['system']
  if (turn.role !== 'assistant') return []
  /** @type {Category[]} */
  const kinds = []
  if ((turn.content ?? '').trim() !== '') kinds.push('responses')
  if (turn.thinking) kinds.push('thinking')
  if (turn.toolCalls && turn.toolCalls.length > 0) kinds.push('toolcalls')
  // An assistant turn with none of the three (empty content, no thinking, no
  // calls) is still a response slot; keep it under `responses` so it cannot
  // become unfilterable.
  return kinds.length ? kinds : ['responses']
}

/**
 * Semantic tags NARROW: with none checked every turn passes; with one or more
 * checked a turn must carry at least one of them. `annotationsByTurn` is the
 * adapter's index (`vm.filterIndex.annotationsByTurn`).
 *
 * @param {TurnVM} turn
 * @param {{ errors?: boolean, retries?: boolean, revert?: boolean }} tags
 * @param {Record<number, {kind?: string}[]>} annotationsByTurn
 */
export function passesTags(turn, tags, annotationsByTurn) {
  const wanted = Object.keys(TAG_KIND).filter((k) => tags[k]).map((k) => TAG_KIND[k])
  if (wanted.length === 0) return true

  // `errors` keeps its pre-existing turn-level source (a turn or one of its
  // calls flagged in the wire) so wiring the other two cannot change what the
  // one already-working tag matched.
  if (tags.errors && (turn.isError || (turn.toolCalls ?? []).some((x) => x.isError))) return true

  const anns = annotationsByTurn?.[turn.index] ?? []
  return anns.some((a) => a.kind != null && wanted.includes(a.kind))
}

/**
 * The per-turn projection: the turn with every hidden part removed, or `null`
 * when nothing would be left to render. Tags narrow at the turn level, the
 * checkpoint anchor scopes to a prefix, and then each part is kept or dropped
 * by its own category (tool calls also by their group). System turns are governed
 * by their own category, shown only by an explicit `true`.
 *
 * The returned object keeps `index`, `role`, labels and annotations, so
 * anchors, jumps and the outline resolve against it exactly as against the
 * original; only `content`, `thinking` and `toolCalls` change.
 *
 * @param {TurnVM} turn
 * @param {TranscriptFilters} filters
 * @param {object} [ctx]
 * @param {Record<number, {kind?: string}[]>} [ctx.annotationsByTurn]
 * @param {number | null} [ctx.checkpointTurn]  inclusive upper turn index, or null
 * @returns {TurnVM | null}
 */
export function projectTurn(turn, filters, ctx = {}) {
  const { categories, toolGroups = {}, tags = {} } = filters
  const { annotationsByTurn = {}, checkpointTurn = null } = ctx

  if (checkpointTurn != null && turn.index > checkpointTurn) return null
  if (!passesTags(turn, tags, annotationsByTurn)) return null

  if (turn.role === 'user') return categories.prompts ? turn : null
  if (turn.role === 'system') return categories.system === true ? turn : null
  if (turn.role !== 'assistant') return turn

  const hasText = (turn.content ?? '').trim() !== ''
  const hasThinking = !!turn.thinking
  const calls = turn.toolCalls ?? []

  const keepText = hasText && categories.responses
  const keepThinking = hasThinking && categories.thinking
  const keptCalls = categories.toolcalls ? calls.filter((tc) => toolGroups[tc.group] !== false) : []

  // A bare assistant slot (no text, thinking or calls) is governed by `responses`.
  if (!hasText && !hasThinking && calls.length === 0) return categories.responses ? turn : null
  if (!keepText && !keepThinking && keptCalls.length === 0) return null

  const unchanged = keepText === hasText && keepThinking === hasThinking && keptCalls.length === calls.length
  if (unchanged) return turn
  return {
    ...turn,
    content: keepText ? turn.content : '',
    displayContent: keepText ? turn.displayContent : '',
    thinking: keepThinking ? turn.thinking : undefined,
    toolCalls: keptCalls,
  }
}

/**
 * Whether any part of the turn survives the filters. Equivalent to
 * `projectTurn(...) !== null`; kept as the yes/no form for callers that only
 * need membership.
 *
 * @param {TurnVM} turn
 * @param {TranscriptFilters} filters
 * @param {Parameters<typeof projectTurn>[2]} [ctx]
 * @returns {boolean}
 */
export function matchesFilters(turn, filters, ctx = {}) {
  return projectTurn(turn, filters, ctx) !== null
}

/**
 * Turn-based category counts for the rail badges: each badge counts the turns
 * that carry its part kind. A turn with text and tool calls is counted under
 * both, so the badges can sum to more than the turn count; each promises
 * "this many turns contain this".
 * (The previous `toolcalls` badge counted tool CALLS, which only coincidentally
 * matches the turn count when every turn carries exactly one.)
 *
 * @param {TurnVM[]} turns
 * @returns {Record<Category, number>}
 */
export function categoryCounts(turns) {
  const counts = { prompts: 0, responses: 0, thinking: 0, toolcalls: 0, system: 0 }
  for (const turn of turns) {
    for (const kind of kindsOf(turn)) counts[kind] += 1
  }
  return counts
}

/**
 * Tri-state for the `tool calls` umbrella: `true` when every group with matches
 * is on, `false` when all are off, `'mixed'` otherwise. Groups with a zero count
 * are IGNORED — the rail disables them, so a permanently-unreachable group must
 * not hold the umbrella in a mixed state the user cannot resolve.
 *
 * @param {Partial<Record<ToolGroup, boolean>>} toolGroups
 * @param {Partial<Record<ToolGroup, number>>} [counts]
 * @returns {true | false | 'mixed'}
 */
export function toolGroupsState(toolGroups, counts = {}) {
  const live = TOOL_GROUPS.filter((id) => (counts[id] ?? 0) > 0)
  if (live.length === 0) return true
  const on = live.filter((id) => toolGroups[id] !== false)
  if (on.length === live.length) return true
  if (on.length === 0) return false
  return 'mixed'
}

/**
 * The umbrella cascade: setting `tool calls` writes every selectable group to
 * match. Groups with no matches are written too, so re-checking the umbrella
 * cannot leave a hidden `false` behind that would suppress a group the moment a
 * different session gives it matches.
 *
 * @param {boolean} next
 * @returns {Record<ToolGroup, boolean>}
 */
export function cascadeToolGroups(next) {
  return /** @type {Record<ToolGroup, boolean>} */ (
    Object.fromEntries(TOOL_GROUPS.map((id) => [id, next]))
  )
}

/**
 * Toggling ONE group re-derives the umbrella, so the pair is never contradictory
 * (all seven off while `tool calls` still reads checked). Unchecking the last
 * live group turns the umbrella off; checking any group turns it back on.
 *
 * A state whose umbrella is already off is normalised first: every group is
 * treated as off, whatever the map says. That covers filter state persisted by
 * a consumer before the cascade existed (`toolcalls: false` over an all-true
 * map), where the rail shows every child unchecked and the user's click on ONE
 * child must enable that one, not the other six.
 *
 * @param {TranscriptFilters} filters
 * @param {ToolGroup} id
 * @param {Partial<Record<ToolGroup, number>>} [counts]
 * @returns {TranscriptFilters}
 */
export function toggleToolGroup(filters, id, counts = {}) {
  const base = filters.categories?.toolcalls === false ? cascadeToolGroups(false) : { ...filters.toolGroups }
  const toolGroups = { ...base, [id]: base[id] === false }
  return {
    ...filters,
    toolGroups,
    categories: { ...filters.categories, toolcalls: toolGroupsState(toolGroups, counts) !== false },
  }
}

/**
 * Setting the umbrella cascades to the groups in the same update, so the rail
 * never renders a checked child under an unchecked parent.
 *
 * @param {TranscriptFilters} filters
 * @param {boolean} next
 * @returns {TranscriptFilters}
 */
export function setToolCalls(filters, next) {
  return {
    ...filters,
    categories: { ...filters.categories, toolcalls: next },
    toolGroups: cascadeToolGroups(next),
  }
}

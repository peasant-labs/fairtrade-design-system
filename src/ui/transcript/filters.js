/* Transcript filter evaluation — the ONE place the filters rail's state is turned
   into a visible-turn decision.

   Previously this lived inline in TranscriptViewer's `visibleTurns` useMemo and
   read only three of the rail's fourteen controls (`prompts`, `responses`,
   `tags.errors`). The other eleven — `thinking`, `toolcalls`, all seven
   `toolGroups`, `retries` and `re-edit` — were rendered, counted, and toggled
   while changing nothing on screen. Extracting the predicate keeps the rail and
   the trace provably reading the same rules, and makes them testable without a
   DOM.

   CATEGORIES ARE NOT DISJOINT. Peasant's wire today emits mostly one kind per
   cooked turn, but some harnesses and editor extensions fold several into one
   compound turn: an assistant reply that opens with a thinking block, or text
   that accompanies a tool call. The adapter keeps those together (it extracts a
   leading <thinking> into `turn.thinking` and leaves the rest in `content`), so a
   turn carries a SET of kinds. A turn stays visible while ANY kind it carries is
   still wanted: unchecking `thinking` hides standalone thinking turns, not the
   text reply that happened to think first. `responses` means turns with TEXT
   content; before this module it matched `role === 'assistant'`, which swallowed
   tool and thinking turns and made the `toolcalls` checkbox unobservable.

   System turns are deliberately unfiltered: the rail offers no control for them,
   and silently dropping them would hide session-level notices with no way back. */

import { TOOL_GROUPS } from './view-model.js'

/** Filter-state tag key → the `AnnotationVM.kind` the adapter emits for it. */
const TAG_KIND = { errors: 'error', retries: 'retry', revert: 'revert' }

/** @typedef {import('./view-model.js').TurnVM} TurnVM */
/** @typedef {import('./view-model.js').ToolGroup} ToolGroup */
/** @typedef {import('./state-capabilities.js').TranscriptFilters} TranscriptFilters */

/** @typedef {'prompts' | 'responses' | 'thinking' | 'toolcalls'} Category */

/**
 * Every category a cooked turn belongs to, in rail order. Empty for turns no
 * category governs (system notices). Compound turns return more than one: an
 * assistant reply with a thinking preamble is both `thinking` and `responses`;
 * text alongside a tool call is both `responses` and `toolcalls`.
 *
 * @param {TurnVM} turn
 * @returns {Category[]}
 */
export function kindsOf(turn) {
  if (turn.role === 'user') return ['prompts']
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
 * True when a tool turn survives the tool-group narrowing: at least one of its
 * calls is in a group that is still enabled. An absent entry counts as enabled,
 * matching the rail's `toolGroups[id] ?? true` default for a fresh filter state.
 *
 * @param {TurnVM} turn
 * @param {Partial<Record<ToolGroup, boolean>>} toolGroups
 */
export function passesToolGroups(turn, toolGroups) {
  const calls = turn.toolCalls ?? []
  if (calls.length === 0) return true
  return calls.some((tc) => toolGroups[tc.group] !== false)
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
 * The full per-turn decision. A governed turn survives while at least one of
 * the kinds it carries is still wanted; for its `toolcalls` kind that also means
 * at least one call sits in an enabled tool group. Tags narrow everything, and
 * the checkpoint anchor scopes to a prefix. System turns (no kinds) always pass
 * the category stage.
 *
 * @param {TurnVM} turn
 * @param {TranscriptFilters} filters
 * @param {object} [ctx]
 * @param {Record<number, {kind?: string}[]>} [ctx.annotationsByTurn]
 * @param {number | null} [ctx.checkpointTurn]  inclusive upper turn index, or null
 * @returns {boolean}
 */
export function matchesFilters(turn, filters, ctx = {}) {
  const { categories, toolGroups = {}, tags = {} } = filters
  const { annotationsByTurn = {}, checkpointTurn = null } = ctx

  if (checkpointTurn != null && turn.index > checkpointTurn) return false

  const kinds = kindsOf(turn)
  const wanted = kinds.some((k) => categories[k] && (k !== 'toolcalls' || passesToolGroups(turn, toolGroups)))
  if (kinds.length > 0 && !wanted) return false

  return passesTags(turn, tags, annotationsByTurn)
}

/**
 * Turn-based category counts for the rail badges: each badge counts the turns
 * that carry its kind. A compound turn is counted under every kind it carries,
 * so the four badges can sum to more than the governed turn count; what each
 * badge promises is "this many turns contain this", not "this many will hide".
 * (The previous `toolcalls` badge counted tool CALLS, which only coincidentally
 * matches the turn count when every turn carries exactly one.)
 *
 * @param {TurnVM[]} turns
 * @returns {Record<Category, number>}
 */
export function categoryCounts(turns) {
  const counts = { prompts: 0, responses: 0, thinking: 0, toolcalls: 0 }
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

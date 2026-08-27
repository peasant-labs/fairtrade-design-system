/* Transcript filter evaluation — the ONE place the filters rail's state is turned
   into a visible-turn decision.

   Previously this lived inline in TranscriptViewer's `visibleTurns` useMemo and
   read only three of the rail's fourteen controls (`prompts`, `responses`,
   `tags.errors`). The other eleven — `thinking`, `toolcalls`, all seven
   `toolGroups`, `retries` and `re-edit` — were rendered, counted, and toggled
   while changing nothing on screen. Extracting the predicate keeps the rail and
   the trace provably reading the same rules, and makes them testable without a
   DOM.

   CATEGORIES ARE DISJOINT. The adapter emits one kind per cooked turn — a turn
   is a prompt, a text response, a thinking block, or a tool call, never two — so
   each category owns a partition of the trace and unchecking one cannot silently
   take another's turns with it. `responses` therefore means TEXT responses; tool
   calls belong to `toolcalls` alone. (Before this module, `responses` matched
   `role === 'assistant'`, which swallowed tool and thinking turns and made the
   `toolcalls` checkbox unobservable even once it was wired.)

   System turns are deliberately unfiltered: the rail offers no control for them,
   and silently dropping them would hide session-level notices with no way back. */

import { TOOL_GROUPS } from './view-model.js'

/** Filter-state tag key → the `FilterIndexVM` tag id the adapter emits. */
const TAG_IDS = { errors: 'errors', retries: 'retries', revert: 're-edit' }

/** @typedef {import('./view-model.js').TurnVM} TurnVM */
/** @typedef {import('./view-model.js').ToolGroup} ToolGroup */
/** @typedef {import('./state-capabilities.js').TranscriptFilters} TranscriptFilters */

/**
 * Which category a cooked turn belongs to, or `undefined` for turns no category
 * governs (system notices). Order matters only in that the checks are mutually
 * exclusive for adapter output; tool calls are tested first because a turn
 * carrying them is a tool turn regardless of any incidental content.
 *
 * @param {TurnVM} turn
 * @returns {'prompts' | 'responses' | 'thinking' | 'toolcalls' | undefined}
 */
export function categoryOf(turn) {
  if (turn.role === 'user') return 'prompts'
  if (turn.toolCalls && turn.toolCalls.length > 0) return 'toolcalls'
  if (turn.thinking) return 'thinking'
  if (turn.role === 'assistant') return 'responses'
  return undefined
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
  const wanted = Object.keys(TAG_IDS).filter((k) => tags[k])
  if (wanted.length === 0) return true

  // `errors` keeps its pre-existing turn-level source (a turn or one of its
  // calls flagged in the wire) so wiring the other two cannot change what the
  // one already-working tag matched.
  if (tags.errors && (turn.isError || (turn.toolCalls ?? []).some((x) => x.isError))) return true

  const anns = annotationsByTurn?.[turn.index] ?? []
  return anns.some((a) => wanted.some((k) => tagKindMatches(a.kind, k)))
}

/** @param {string | undefined} kind @param {string} tagKey */
function tagKindMatches(kind, tagKey) {
  if (tagKey === 'errors') return kind === 'error'
  if (tagKey === 'retries') return kind === 'retry'
  if (tagKey === 'revert') return kind === 'revert'
  return false
}

/**
 * The full per-turn decision. Categories gate by kind, tool groups narrow tool
 * turns, tags narrow everything, and the checkpoint anchor scopes to a prefix.
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

  const category = categoryOf(turn)
  if (category && !categories[category]) return false
  if (category === 'toolcalls' && !passesToolGroups(turn, toolGroups)) return false

  return passesTags(turn, tags, annotationsByTurn)
}

/**
 * Turn-based, disjoint category counts for the rail badges — each badge counts
 * the turns ITS checkbox controls, so the four sum to the governed turns rather
 * than overlapping. (The previous `toolcalls` badge counted tool CALLS, which
 * only coincidentally matches the turn count when every turn carries exactly
 * one.)
 *
 * @param {TurnVM[]} turns
 * @returns {{prompts: number, responses: number, thinking: number, toolcalls: number}}
 */
export function categoryCounts(turns) {
  const counts = { prompts: 0, responses: 0, thinking: 0, toolcalls: 0 }
  for (const turn of turns) {
    const category = categoryOf(turn)
    if (category) counts[category] += 1
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
 * @param {TranscriptFilters} filters
 * @param {ToolGroup} id
 * @param {Partial<Record<ToolGroup, number>>} [counts]
 * @returns {TranscriptFilters}
 */
export function toggleToolGroup(filters, id, counts = {}) {
  const toolGroups = { ...filters.toolGroups, [id]: filters.toolGroups?.[id] === false }
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

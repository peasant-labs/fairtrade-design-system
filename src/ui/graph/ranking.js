// @ts-check
import { assertRankingContractValues } from './graphContractPolicy.js'

/*
   graph/ranking: the ranked entry list's scoring, debt and scent-tag machinery
   Pure, client-side, fixture-testable. These functions consume a caller-supplied
   `RankInputNode[]` shaped from MapGraphPayload node fields, including the
   published read-state scalars on MapNode (ReadState, ChangedRegionCount,
   AttributedRegionCount, ReviewedRegionCount). The debt formula below is pure
   over exactly those four scalars, with no per-hunk wire data required.
   Read-state scalar values are validated against the published schema contract
   at the ranking boundary.

   Two constant objects anchor every derived number: DOI_WEIGHTS (the degree-
   of-interest term weights) and the comprehension-debt constants (DEBT_VIEWED,
   COVERAGE_CAP) declared beside it.
 */

/** @typedef {import('@peasant-labs/schema').ReadAttributionState} ReadAttributionState */
/** @typedef {import('@peasant-labs/schema').ReadStateGrade} ReadStateGrade */
/** @typedef {'relevance'|'debt'|'churn'} RankMode */
/** @typedef {'unknown'|'none'|'reviewed'|'partial-read'|'viewed'|'no-recorded-read'} DebtState */

/**
 * One node's ranking-relevant scalars. Every field is read-only input; nothing
 * here is mutated. `lastTouchMs` and `parent` are optional client-side hints
 * hints. An absent value means "no recency/tree-focus
 * signal", never a fabricated 0.
 * @typedef {object} RankInputNode
 * @property {string} id
 * @property {string} name
 * @property {number} touchCount
 * @property {number} effortDensity - 0..1
 * @property {number} agentEditedCount
 * @property {number} readCount
 * @property {ReadAttributionState} readAttribution
 * @property {ReadStateGrade} readState - composed effective read-state grade for the CURRENT content version
 * @property {number} changedRegionCount - total changed regions (Hall)
 * @property {number} attributedRegionCount - attributed regions (H, M)
 * @property {number} reviewedRegionCount - reviewed-of-attributed regions (N)
 * @property {number} [lastTouchMs]
 * @property {string|null} [parent]
 * @property {string|null} [recentSessionId] - the session that most recently edited this node, if known
 */

/** @typedef {{id:string, name:string, doi:number, debtState:DebtState, debt:number, coverage:number, hunkClears:boolean, scentTags:string[], hoverText:string|null}} RankedRow */
/** @typedef {{node:RankInputNode, intrinsic:number, debtState:DebtState, debt:number, coverage:number, hunkClears:boolean, hoverText:string|null}} IntrinsicRankedNode */
/** @typedef {{rankMode:RankMode, rows:IntrinsicRankedNode[], parentOf:Map<string,string|null>, maxTouch:number}} IntrinsicRanking */

/** DOI (degree-of-interest) term weights. Sum to 1.0 and are fixture-pinned. */
export const DOI_WEIGHTS = Object.freeze({
  touch: 0.35,
  effortDensity: 0.25,
  debt: 0.25,
  recency: 0.15,
})

/** Comprehension-debt constants, declared beside DOI_WEIGHTS per the frozen contract. */
export const DEBT_VIEWED = 0.5
export const COVERAGE_CAP = 0.9

/** Recency half-life, days. */
export const RECENCY_HALF_LIFE_DAYS = 14

/** Threshold-gating constants. */
export const RANK_FLOOR = 5
export const RANK_CAP = 25

/**
 * The seven-member scent-tag closed set. Exhaustiveness is enforced by
 * `code-map-ranking.yaml`'s guard: every member must have at least one
 * derivation case, so a future eighth tag without a case reddens.
 * @type {readonly string[]}
 */
export const SCENT_TAGS = Object.freeze([
  'agent wrote: no recorded read',
  'agent wrote: viewed, not reviewed',
  'agent wrote: read state unknown',
  'heavy churn',
  'edited this session',
  'high effort density',
  'near your focus',
])

const HEAVY_CHURN_QUANTILE = 0.75
const HIGH_EFFORT_DENSITY = 0.75
const FOCUS_DISTANCE_THRESHOLD = 1
const RANK_MODES = new Set(['relevance', 'debt', 'churn'])
const HONESTY_PROMPT = 'Use this as a prompt to inspect recorded evidence, not as a verdict about the reader.'

/**
 * Comprehension-debt state resolution over MapNode scalars only (no per-hunk
 * wire data required; the formula is pure over ReadState plus the three
 * region-coverage counts).
 * @param {RankInputNode} node
 * @returns {DebtState}
 */
export function debtState(node) {
  if (node.agentEditedCount === 0) return 'none'
  if (node.readAttribution === 'unavailable') return 'unknown'
  const hasUnattributed = node.changedRegionCount > node.attributedRegionCount
  const hunkFrac = node.attributedRegionCount > 0 ? node.reviewedRegionCount / node.attributedRegionCount : 0
  const clears = node.attributedRegionCount > 0 && hunkFrac === 1 && !hasUnattributed
  const fileReviewed = node.readState === 'reviewed' || node.readState === 'reviewed_in_detail'
  if (fileReviewed || clears) return 'reviewed'
  if (node.attributedRegionCount > 0 && node.reviewedRegionCount > 0) return 'partial-read'
  if (node.readState === 'viewed') return 'viewed'
  if (node.readCount === 0) return 'no-recorded-read'
  return 'partial-read' // mechanical fallback: read>0, edited>0, no hunk relationship
}

/**
 * Comprehension-debt magnitude. `state` must be the value `debtState(node)` returned for
 * the SAME node (kept as a parameter, not recomputed, so callers that already
 * branched on `debtState` never pay for or risk re-deriving it differently).
 * @param {RankInputNode} node @param {DebtState} state
 * @returns {number}
 */
export function debt(node, state) {
  if (state === 'no-recorded-read') return 1
  if (state === 'partial-read') {
    if (node.attributedRegionCount > 0) {
      const c = coverage(node)
      const mechanical = node.agentEditedCount > 0 ? node.readCount / node.agentEditedCount : 0
      return clamp01(1 - Math.max(c, mechanical))
    }
    const mechanical = node.agentEditedCount > 0 ? node.readCount / node.agentEditedCount : 0
    return clamp01(1 - mechanical)
  }
  if (state === 'viewed') return DEBT_VIEWED
  return 0 // "reviewed", "none", "unknown"
}

/** `coverage`: an unattributable hunk caps it strictly below 1 (COVERAGE_CAP). @param {RankInputNode} node */
export function coverage(node) {
  const hasUnattributed = node.changedRegionCount > node.attributedRegionCount
  const hunkFrac = node.attributedRegionCount > 0 ? node.reviewedRegionCount / node.attributedRegionCount : 0
  return clamp01(hasUnattributed ? Math.min(hunkFrac, COVERAGE_CAP) : hunkFrac)
}

/** `hunkClears`: the named state gate, never shadowed by a fallback. @param {RankInputNode} node */
export function hunkClears(node) {
  const hasUnattributed = node.changedRegionCount > node.attributedRegionCount
  const hunkFrac = node.attributedRegionCount > 0 ? node.reviewedRegionCount / node.attributedRegionCount : 0
  return node.attributedRegionCount > 0 && hunkFrac === 1 && !hasUnattributed
}

/**
 * The path-conditioned partial-read hover copy. Returns null
 * for every non-`partial-read` state. Callers only call this after checking
 * `debtState(node) === 'partial-read'`.
 * @param {RankInputNode} node
 * @returns {string|null}
 */
export function partialReadHoverText(node) {
  if (debtState(node) !== 'partial-read') return null
  const attributed = node.attributedRegionCount
  if (attributed > 0 && node.reviewedRegionCount > 0) {
    const n = node.reviewedRegionCount
    const m = attributed
    const hasUnattributed = node.changedRegionCount > attributed
    if (!hasUnattributed) return `${n} of ${m} changed regions reviewed`
    const k = node.changedRegionCount - attributed
    return `${n} of ${m} attributed regions reviewed; ${k} regions could not be attributed`
  }
  return 'some sessions that edited this file were read; per-region coverage is not available'
}

/**
 * State-specific honesty copy for every visible debt tag. The copy describes
 * recorded evidence and always remains a prompt, never a claim about a person.
 * @param {RankInputNode} node
 * @param {DebtState} state
 * @returns {string|null}
 */
export function debtHoverText(node, state) {
  if (state === 'no-recorded-read') {
    return `No read evidence was recorded for sessions that edited this file. ${HONESTY_PROMPT}`
  }
  if (state === 'viewed') {
    return `A view was recorded, but no explicit review was recorded. ${HONESTY_PROMPT}`
  }
  if (state === 'unknown') {
    return `No read events were recorded for the sessions that edited this file, so its read state is unknown. ${HONESTY_PROMPT}`
  }
  if (state === 'partial-read') {
    const detail = partialReadHoverText(node)
    return detail ? `${detail}. ${HONESTY_PROMPT}` : HONESTY_PROMPT
  }
  return null
}

/**
 * Up to two scent tags per row, including the softened `viewed`
 * treatment and the multi-state debt vocabulary. The `partial-read` state
 * reuses the strong/softened tag with the path-conditioned hover. No new
 * tag for the partial state.
 * @param {RankInputNode} node @param {DebtState} state @param {{focusId?:string|null, parentOf?:Map<string,string|null>, distanceToFocus?:number|null, maxTouch?:number, hoveredOrSelectedSessionId?:string|null}} [context]
 * @returns {string[]}
 */
export function scentTagsFor(node, state, context = {}) {
  const tags = []
  if (state === 'no-recorded-read') tags.push('agent wrote: no recorded read')
  else if (state === 'unknown') tags.push('agent wrote: read state unknown')
  else if (state === 'viewed') tags.push('agent wrote: viewed, not reviewed')
  else if (state === 'partial-read') tags.push('agent wrote: viewed, not reviewed')

  if (context.hoveredOrSelectedSessionId && node.recentSessionId === context.hoveredOrSelectedSessionId && tags.length < 2) {
    tags.push('edited this session')
  }
  if (context.maxTouch && context.maxTouch > 0) {
    const ratio = node.touchCount / context.maxTouch
    if (ratio >= HEAVY_CHURN_QUANTILE && tags.length < 2) tags.push('heavy churn')
  }
  if (node.effortDensity >= HIGH_EFFORT_DENSITY && tags.length < 2) tags.push('high effort density')
  if (context.focusId && context.parentOf) {
    const dist = context.distanceToFocus === undefined
      ? treeDistance(node.id, context.focusId, context.parentOf)
      : context.distanceToFocus
    if (dist !== null && dist <= FOCUS_DISTANCE_THRESHOLD && tags.length < 2) tags.push('near your focus')
  }
  return tags.slice(0, 2)
}

/**
 * Tree distance between two node ids via their common ancestor (null = unrelated / not in tree).
 * @param {string} a @param {string} b @param {Map<string, string|null>} parentOf
 * @returns {number|null}
 */
function treeDistance(a, b, parentOf) {
  if (a === b) return 0
  const ancestorsA = ancestorChain(a, parentOf)
  const ancestorsB = ancestorChain(b, parentOf)
  const depthA = new Map(ancestorsA.map((id, index) => [id, index]))
  for (const [index, id] of ancestorsB.entries()) {
    if (depthA.has(id)) return (depthA.get(id) ?? 0) + index
  }
  return null
}

/** @param {string} id @param {Map<string, string|null>} parentOf @returns {string[]} */
function ancestorChain(id, parentOf) {
  const chain = [id]
  let cursor = parentOf.get(id) ?? null
  let guard = 0
  while (cursor && guard < 10_000) {
    chain.push(cursor)
    cursor = parentOf.get(cursor) ?? null
    guard += 1
  }
  return chain
}

/**
 * min-max normalize a numeric series into 0..1; the degenerate all-equal case yields 0 for every element.
 * @param {number[]} values @returns {number[]}
 */
function minMaxNormalize(values) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return values.map(() => 0)
  return values.map((v) => (v - min) / (max - min))
}

/** @param {RankInputNode} node @param {number} nowMs @returns {number} */
function recency(node, nowMs) {
  if (node.lastTouchMs == null || !Number.isFinite(nowMs)) return 0
  const ageMs = Math.max(0, nowMs - node.lastTouchMs)
  const halfLifeMs = RECENCY_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000
  return clamp01(Math.pow(0.5, ageMs / halfLifeMs))
}

/** @param {number} n @returns {number} */
function clamp01(n) {
  // Rounded to 1e-9 to avoid binary floating-point dust (e.g. 1 - 0.9 producing
  // 0.09999999999999998) so fixtures can pin exact decimal literals instead of
  // re-deriving them. The coverage-cap fixture pins its expected debt as a literal.
  return Math.round(Math.max(0, Math.min(1, n)) * 1e9) / 1e9
}

/**
 * Reweights DOI_WEIGHTS for a rank mode: `debt`/`churn` raise their own term to 0.7 and rescale the rest to share 0.3.
 * @param {RankMode} rankMode @returns {Record<string, number>}
 */
function weightsForMode(rankMode) {
  if (rankMode === 'relevance') return DOI_WEIGHTS
  const boosted = rankMode === 'debt' ? 'debt' : 'touch'
  const rest = /** @type {(keyof typeof DOI_WEIGHTS)[]} */ (Object.keys(DOI_WEIGHTS).filter((key) => key !== boosted))
  const restSum = rest.reduce((sum, key) => sum + DOI_WEIGHTS[key], 0)
  const scale = restSum > 0 ? 0.3 / restSum : 0
  /** @type {Record<string, number>} */
  const weights = { [boosted]: 0.7 }
  for (const key of rest) weights[key] = DOI_WEIGHTS[key] * scale
  return weights
}

/**
 * Debt mode is categorical before it is scalar: known debt is actionable,
 * unknown is honest missing evidence, and clear/no-debt rows come last.
 * @param {DebtState} state
 */
function debtRankGroup(state) {
  if (state === 'no-recorded-read' || state === 'partial-read' || state === 'viewed') return 0
  if (state === 'unknown') return 1
  return 2
}

/**
 * Computes only payload/rank-mode intrinsic terms. A caller can memoize this
 * object by node-array identity and rank mode; focus, filter, hover and session
 * selection belong exclusively to `deriveRankedRows` below.
 * @param {RankInputNode[]} nodes
 * @param {{rankMode?: RankMode, nowMs?: number}} [options]
 * @returns {IntrinsicRanking}
 */
export function rankMapNodesIntrinsic(nodes, options = {}) {
  const rankMode = options.rankMode ?? 'relevance'
  if (!RANK_MODES.has(rankMode)) throw actionable('compute intrinsic ranking', 'rankMode', `value ${JSON.stringify(rankMode)} is unsupported`, 'use relevance, debt, or churn')
  assertRankingContractValues(nodes)
  const nowMs = options.nowMs ?? Date.now()
  const weights = weightsForMode(rankMode)
  const parentOf = new Map(nodes.map((n) => [n.id, n.parent ?? null]))
  const maxTouch = nodes.reduce((max, n) => Math.max(max, n.touchCount), 0)
  const touchNorm = minMaxNormalize(nodes.map((n) => Math.log1p(Math.max(0, n.touchCount))))
  const rows = nodes.map((node, index) => {
    const state = debtState(node)
    const debtValue = debt(node, state)
    const intrinsic = weights.touch * touchNorm[index]
      + weights.effortDensity * clamp01(node.effortDensity)
      + weights.debt * debtValue
      + weights.recency * recency(node, nowMs)
    return {
      node,
      intrinsic,
      debtState: state,
      debt: debtValue,
      coverage: coverage(node),
      hunkClears: hunkClears(node),
      hoverText: debtHoverText(node, state),
    }
  })

  return { rankMode, rows, parentOf, maxTouch }
}

/**
 * Applies focus distance, active-session scent, sort, and filter to memoized
 * intrinsic terms. Ties break by node id; all-equal intrinsic terms stay 0.
 * @param {IntrinsicRanking} intrinsicRanking
 * @param {{focusId?: string|null, scentFilter?: string|null, hoveredOrSelectedSessionId?: string|null}} [options]
 * @returns {RankedRow[]}
 */
export function deriveRankedRows(intrinsicRanking, options = {}) {
  if (options.scentFilter != null && !SCENT_TAGS.includes(options.scentFilter)) {
    throw actionable('derive ranked rows', 'scentFilter', `value ${JSON.stringify(options.scentFilter)} is unsupported`, `use null or one of ${SCENT_TAGS.join(', ')}`)
  }
  const { rankMode, parentOf, maxTouch } = intrinsicRanking
  const focusDistances = options.focusId ? deriveFocusDistances(options.focusId, parentOf) : null
  const rows = intrinsicRanking.rows.map((intrinsicRow) => {
    const { node } = intrinsicRow
    let distance = 0
    if (options.focusId) {
      const dist = focusDistances?.get(node.id) ?? null
      distance = dist !== null ? Math.min(1, dist / 4) * 0.5 : 0
    }
    return {
      id: node.id,
      name: node.name,
      doi: clamp01(intrinsicRow.intrinsic - distance),
      debtState: intrinsicRow.debtState,
      debt: intrinsicRow.debt,
      coverage: intrinsicRow.coverage,
      hunkClears: intrinsicRow.hunkClears,
      scentTags: scentTagsFor(node, intrinsicRow.debtState, {
        focusId: options.focusId,
        parentOf,
        distanceToFocus: focusDistances?.get(node.id) ?? null,
        maxTouch,
        hoveredOrSelectedSessionId: options.hoveredOrSelectedSessionId,
      }),
      hoverText: intrinsicRow.hoverText,
    }
  })

  rows.sort((a, b) => {
    if (rankMode === 'debt') {
      const groupOrder = debtRankGroup(a.debtState) - debtRankGroup(b.debtState)
      if (groupOrder !== 0) return groupOrder
    }
    return b.doi - a.doi || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  })

  const scentFilter = options.scentFilter
  return scentFilter ? rows.filter((row) => row.scentTags.includes(scentFilter)) : rows
}

/** @param {string} focusId @param {Map<string,string|null>} parentOf */
function deriveFocusDistances(focusId, parentOf) {
  /** @type {Map<string,string[]>} */
  const adjacent = new Map()
  for (const [id, parent] of parentOf) {
    if (!adjacent.has(id)) adjacent.set(id, [])
    if (!parent) continue
    const parentNeighbors = adjacent.get(parent) ?? []
    parentNeighbors.push(id)
    adjacent.set(parent, parentNeighbors)
    adjacent.get(id)?.push(parent)
  }
  /** @type {Map<string,number>} */
  const distances = new Map()
  if (!adjacent.has(focusId)) return distances
  const queue = [focusId]
  distances.set(focusId, 0)
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index]
    const nextDistance = (distances.get(id) ?? 0) + 1
    for (const neighbor of adjacent.get(id) ?? []) {
      if (distances.has(neighbor)) continue
      distances.set(neighbor, nextDistance)
      queue.push(neighbor)
    }
  }
  return distances
}

/** Compatibility composition of the public two-phase ranking API.
 * @param {RankInputNode[]} nodes
 * @param {{rankMode?: RankMode, focusId?: string|null, scentFilter?: string|null, hoveredOrSelectedSessionId?: string|null, nowMs?: number}} [options]
 */
export function rankMapNodes(nodes, options = {}) {
  const intrinsic = rankMapNodesIntrinsic(nodes, options)
  return deriveRankedRows(intrinsic, options)
}

/**
 * Threshold gating: show `DOI >= max(0.25, 0.5*maxDOI)`, floor 5, cap 25,
 * then a single "show all N files" expander. Deterministic, fixture-pinnable.
 * In debt mode, known debt is included before thresholded unknown/clear rows,
 * so threshold and cap gating cannot hide actionable evidence behind unknowns.
 * @param {RankedRow[]} rows @param {{expanded?: boolean, rankMode?:RankMode}} [options]
 * @returns {{visible: RankedRow[], total: number, overflowCount: number}}
 */
export function gateRankedRows(rows, options = {}) {
  const maxDOI = rows.reduce((max, row) => Math.max(max, row.doi), 0)
  const threshold = Math.max(0.25, 0.5 * maxDOI)
  const thresholdIds = new Set(rows.filter((row) => row.doi >= threshold).map((row) => row.id))
  const requiredDebtIds = options.rankMode === 'debt'
    ? new Set(rows.filter((row) => debtRankGroup(row.debtState) === 0).map((row) => row.id))
    : new Set()
  let gated = rows.filter((row) => thresholdIds.has(row.id) || requiredDebtIds.has(row.id))
  if (gated.length < RANK_FLOOR) gated = rows.slice(0, Math.min(RANK_FLOOR, rows.length))
  const capped = gated.slice(0, RANK_CAP)
  const visible = options.expanded ? rows : capped
  return { visible, total: rows.length, overflowCount: options.expanded ? 0 : Math.max(0, rows.length - capped.length) }
}

/** @param {string} operation @param {string} where @param {string} why @param {string} fix */
function actionable(operation, where, why, fix) {
  return new Error(`Code map ranking ${operation} failed: what went wrong: invalid ${where}; why: ${why}; where: src/ui/graph/ranking.js ${where}; when: ${operation}; what it means: the ranked list cannot be derived safely; how to fix: ${fix}.`)
}

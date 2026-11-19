// @ts-check
import { UsageScope, UsageCompleteness } from '@peasant-labs/schema'

export const TOKEN_FIELDS = Object.freeze({ input: 'input', output: 'output', cacheRead: 'cache read', cacheWrite: 'cache write', cacheWrite1h: 'cache write 1h (subset)', reasoning: 'reasoning (subset)', totalTokens: 'total tokens' })
export const COST_FIELDS = Object.freeze({ input: 'input', output: 'output', cacheRead: 'cache read', cacheWrite: 'cache write', total: 'total' })

/** Parse one recorded decimal string into an exact coefficient and decimal scale.
 * @param {string} value @returns {{ coefficient: bigint, scale: number }} */
function decimalOf(value) {
  const [mantissa, exponent = '0'] = value.toLowerCase().split('e')
  const [whole, fraction = ''] = mantissa.split('.')
  return { coefficient: BigInt(whole + fraction), scale: fraction.length - Number(exponent) }
}

/** Spell an exact sum at its scale, exactly as the recorded-cost display always has.
 * @param {bigint} sum @param {number} scale @returns {string} */
function spellDecimal(sum, scale) {
  const digits = sum.toString().padStart(scale + 1, '0')
  return scale ? (digits.slice(0, -scale) + '.' + digits.slice(-scale)).replace(/\.?0+$/, '') || '0' : digits
}

/**
 * One running exact decimal sum. A single value keeps its recorded spelling; more than one is summed
 * at the largest scale seen, rescaling the running sum when a finer value arrives, so the result is
 * the same as summing every value at once and no list of values is kept.
 */
function createDecimalSum() {
  let count = 0
  /** @type {string | undefined} */
  let first
  let sum = 0n
  let scale = 0
  return {
    /** @param {string} value */
    add(value) {
      count += 1
      if (count === 1) first = value
      const part = decimalOf(value)
      const target = Math.max(scale, part.scale, 0)
      if (target > scale) { sum *= 10n ** BigInt(target - scale); scale = target }
      sum += part.coefficient * 10n ** BigInt(scale - part.scale)
    },
    get count() { return count },
    /** @returns {string} */
    finish() { return count === 1 ? /** @type {string} */ (first) : spellDecimal(sum, scale) },
  }
}

/**
 * The incremental usage accumulator: feed it turns one at a time, in any partition order, and finish
 * once. It keeps per-scope, per-field running state only: no owner list, no turn list and no spread,
 * so a session with any number of usage owners never builds an argument list from them. The result is
 * exactly `aggregateUsage` over the same turns.
 * @returns {{ addTurn(turn: import('@peasant-labs/schema').TurnDetail): unknown, finish(): import('./view-model.js').UsageScopeVM[] }}
 */
export function createUsageAccumulator() {
  /** @type {Map<string, { owners: number, tokens: Map<string, { known: number, sum: bigint }>, cost: Map<string, ReturnType<typeof createDecimalSum>> }>} */
  const scopes = new Map()
  /** @param {import('@peasant-labs/schema').UsageDetail | null | undefined} owner */
  const addOwner = (owner) => {
    if (owner == null) return
    let state = scopes.get(owner.scope)
    if (!state) {
      state = { owners: 0, tokens: new Map(), cost: new Map() }
      for (const field of Object.keys(TOKEN_FIELDS)) state.tokens.set(field, { known: 0, sum: 0n })
      for (const field of Object.keys(COST_FIELDS)) state.cost.set(field, createDecimalSum())
      scopes.set(owner.scope, state)
    }
    state.owners += 1
    const tokens = /** @type {Record<string, string|number>|null|undefined} */ (owner.tokens)
    for (const [field, entry] of state.tokens) {
      const value = tokens?.[field]
      if (value == null) continue
      entry.known += 1
      entry.sum += BigInt(value)
    }
    const cost = /** @type {Record<string, string|number>|null|undefined} */ (owner.cost)
    for (const [field, entry] of state.cost) {
      const value = cost?.[field]
      if (value != null) entry.add(String(value))
    }
  }
  const accumulator = {
    /** @param {import('@peasant-labs/schema').TurnDetail} turn */
    addTurn(turn) {
      addOwner(turn?.usage)
      for (const tool of turn?.toolCalls ?? []) addOwner(tool.usage)
      return accumulator
    },
    finish() {
      return Object.values(UsageScope).flatMap((scope) => {
        const state = scopes.get(scope)
        if (!state) return []
        /** @param {number} known @returns {import('@peasant-labs/schema').UsageCompleteness} */
        const completeness = (known) => (!known ? UsageCompleteness.Unknown : known === state.owners ? UsageCompleteness.Complete : UsageCompleteness.Partial)
        const tokens = Object.entries(TOKEN_FIELDS).map(([field, label]) => {
          const entry = /** @type {{ known: number, sum: bigint }} */ (state.tokens.get(field))
          if (entry.known && entry.sum > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`Detailed usage aggregate failed in Fairtrade adaptTranscript during ${scope} ${field} summation: the known token sum exceeds the JS-safe contract bound; no trustworthy total can be displayed. Reduce the session scope or repair the producer accounting and retry.`)
          return { label, value: entry.known ? String(entry.sum) : 'unknown', completeness: completeness(entry.known) }
        })
        const cost = Object.entries(COST_FIELDS).map(([field, label]) => {
          const entry = /** @type {ReturnType<typeof createDecimalSum>} */ (state.cost.get(field))
          return { label, value: entry.count ? entry.finish() : 'unknown', completeness: completeness(entry.count) }
        })
        return [{ scope, ownerCount: state.owners, tokens, cost }]
      })
    },
  }
  return accumulator
}

/** The whole-list form: one sequential pass through the accumulator.
 * @param {import('@peasant-labs/schema').TurnDetail[]} turns
 * @returns {import('./view-model.js').UsageScopeVM[]} */
export function aggregateUsage(turns) {
  const accumulator = createUsageAccumulator()
  for (const turn of turns) accumulator.addTurn(turn)
  return accumulator.finish()
}

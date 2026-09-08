// @ts-check
import { UsageScope } from '@peasant-labs/schema'

export const TOKEN_FIELDS = Object.freeze({ input: 'input', output: 'output', cacheRead: 'cache read', cacheWrite: 'cache write', cacheWrite1h: 'cache write 1h (subset)', reasoning: 'reasoning (subset)', totalTokens: 'total tokens' })
export const COST_FIELDS = Object.freeze({ input: 'input', output: 'output', cacheRead: 'cache read', cacheWrite: 'cache write', total: 'total' })

/** Sum recorded decimal strings without binary floating arithmetic or currency rounding.
 * @param {string[]} values @returns {string} */
function sumCosts(values) {
  if (values.length === 1) return values[0]
  const parts = values.map((value) => {
    const [mantissa, exponent = '0'] = value.toLowerCase().split('e')
    const [whole, fraction = ''] = mantissa.split('.')
    return { coefficient: BigInt(whole + fraction), scale: fraction.length - Number(exponent) }
  })
  const scale = Math.max(0, ...parts.map((part) => part.scale))
  const sum = parts.reduce((total, part) => total + part.coefficient * 10n ** BigInt(scale - part.scale), 0n)
  const digits = sum.toString().padStart(scale + 1, '0')
  return scale ? (digits.slice(0, -scale) + '.' + digits.slice(-scale)).replace(/\.?0+$/, '') || '0' : digits
}

/** @param {import('@peasant-labs/schema').TurnDetail[]} turns
 * @returns {import('./view-model.js').UsageScopeVM[]} */
export function aggregateUsage(turns) {
  const owners = turns.flatMap((turn) => [turn.usage, ...(turn.toolCalls ?? []).map((tool) => tool.usage)])
    .filter((owner) => owner != null)
  return Object.values(UsageScope).flatMap((scope) => {
    const scoped = owners.filter((owner) => owner.scope === scope)
    if (!scoped.length) return []
    /** @param {'tokens'|'cost'} kind @param {Record<string, string>} fields
     * @returns {import('./view-model.js').UsageFieldVM[]} */
    const aggregate = (kind, fields) => Object.entries(fields).map(([field, label]) => {
      const known = scoped.map((owner) => /** @type {Record<string, string|number>|null|undefined} */ (owner[kind])?.[field]).filter((value) => value != null)
      let value = 'unknown'
      if (known.length && kind === 'cost') value = sumCosts(known.map(String))
      if (known.length && kind === 'tokens') {
        const sum = known.reduce((total, item) => total + BigInt(item), 0n)
        if (sum > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`Detailed usage aggregate failed in Fairtrade adaptTranscript during ${scope} ${field} summation: the known token sum exceeds the JS-safe contract bound; no trustworthy total can be displayed. Reduce the session scope or repair the producer accounting and retry.`)
        value = String(sum)
      }
      return { label, value, completeness: !known.length ? 'unknown' : known.length === scoped.length ? 'complete' : 'partial' }
    })
    return [{ scope, ownerCount: scoped.length, tokens: aggregate('tokens', TOKEN_FIELDS), cost: aggregate('cost', COST_FIELDS) }]
  })
}

// @ts-check
/* Pure presentation formatters used by the analytics surface. Kept internal:
   the public surface is the metric functions + the components. A token count is the library's one
   compact count (../format.js); the pair formatters below match precision across a typical and
   tail pair on the same units. */
import { formatCount } from '../format.js'

/**
 * Compact token count, the library's one count format: 1234 → "1.2k", 62_000 → "62k",
 * 1_234_567 → "1.2M", 66_731_500_000 → "66.7B". A negative count is not a count and reads "—".
 * @param {number | null | undefined} n
 * @returns {string}
 */
export function formatTokens(n) {
  if (n == null || !Number.isFinite(n) || n < 0) return '—'
  return formatCount(n)
}

/**
 * Round a number to at most 1 decimal place, dropping a trailing ".0".
 * @param {number | null | undefined} n
 * @returns {string}
 */
export function formatNumber(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/**
 * Percentage from a [0,1] rate: 0.4231 → "42%".
 * @param {number | null | undefined} rate
 * @returns {string}
 */
export function formatRate(rate) {
  if (rate == null || !Number.isFinite(rate)) return '—'
  return `${Math.round(rate * 100)}%`
}

/**
 * Minutes → human duration: 90 → "1h 30m", 45 → "45m".
 * @param {number | null | undefined} mins
 * @returns {string}
 */
export function formatDuration(mins) {
  if (mins == null || !Number.isFinite(mins) || mins < 0) return '—'
  const total = Math.round(mins)
  if (total < 60) return `${total}m`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/**
 * Shorten a `YYYY-MM-DD` week key to `MM-DD` for compact axis ticks.
 * @param {string} week
 * @returns {string}
 */
export function shortWeek(week) {
  return week.length >= 10 ? week.slice(5) : week
}

/**
 * Format a median/p90 pair of plain numbers with MATCHED precision (the
 * identical-precision rule: "8.0, 19.2", never "8, 19.2"; two integers stay
 * "12, 27"). Nulls render "—" individually.
 * @param {number | null | undefined} a
 * @param {number | null | undefined} b
 * @returns {[string, string]}
 */
export function formatNumberPair(a, b) {
  /** @type {number[]} */
  const finite = []
  for (const v of [a, b]) if (typeof v === 'number' && Number.isFinite(v)) finite.push(v)
  const fractional = finite.some((v) => !Number.isInteger(Math.round(v * 10) / 10))
  const one = (/** @type {number | null | undefined} */ v) => {
    if (v == null || !Number.isFinite(v)) return '—'
    const r = Math.round(v * 10) / 10
    return fractional ? r.toFixed(1) : String(Math.round(r))
  }
  return [one(a), one(b)]
}

/**
 * Format a median/p90 pair of token counts with a SHARED unit and matched
 * precision ("10.5k, 23.0k", "62k, 106k"). Unit is picked from the larger
 * value; nulls render "—" individually.
 * @param {number | null | undefined} a
 * @param {number | null | undefined} b
 * @returns {[string, string]}
 */
export function formatTokenPair(a, b) {
  /** @type {number[]} */
  const finite = []
  for (const v of [a, b]) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) finite.push(v)
  if (finite.length === 0) return ['—', '—']
  const max = Math.max(...finite)
  /** @type {[number, string]} the units of the one count format, picked from the larger value */
  const [div, unit] = max >= 1e12 ? [1e12, 'T'] : max >= 1e9 ? [1e9, 'B'] : max >= 1e6 ? [1e6, 'M'] : max >= 1000 ? [1000, 'k'] : [1, '']
  const decimals = finite.some((v) => !Number.isInteger(Math.round((v / div) * 10) / 10)) ? 1 : 0
  const one = (/** @type {number | null | undefined} */ v) => {
    if (v == null || !Number.isFinite(v) || v < 0) return '—'
    return `${(v / div).toFixed(decimals)}${unit}`
  }
  return [one(a), one(b)]
}

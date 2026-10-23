// @ts-check
/* The one number format for every numeric display in fairtrade (usage panels, analytics, meta rows,
   graph labels, tables). Each formatter takes a number, a numeric string (wire costs and token sums
   arrive as exact decimal strings) or a bigint, and returns display text:
     formatCount    compact: "999", "1.2k", "66.7M", "66.7B", "1.2T" (k lowercase, larger units upper)
     formatInteger  exact and grouped: "272,000"
     formatCost     US dollars at cents: "$0.30", "$1,234.56", "<$0.01" for a positive amount under a
                    cent; recorded float noise ("0.30000000000000004") never reaches the screen
     formatDecimal  fixed places: "0.99"
   A missing or unreadable value (null, undefined, NaN, an infinity, a non-numeric string) reads
   "—", never "NaN", "0" or an empty cell. Rounding happens here, for display only: callers keep and
   sum the exact recorded values. */

/** What every formatter shows for a missing or unreadable value. */
export const MISSING_NUMBER = '—'

const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const CENTS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * A finite number from a number, a numeric string or a bigint, or undefined.
 * @param {unknown} value
 * @returns {number | undefined}
 */
function toFinite(value) {
  let n = Number.NaN
  if (typeof value === 'number') n = value
  else if (typeof value === 'bigint') n = Number(value)
  else if (typeof value === 'string' && value.trim() !== '') n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Compact count, one decimal at most: 999 → "999", 1234 → "1.2k", 66_731_500_000 → "66.7B".
 * @param {unknown} value
 * @returns {string}
 */
export function formatCount(value) {
  const n = toFinite(value)
  if (n === undefined) return MISSING_NUMBER
  return COMPACT.format(n).replace(/K$/, 'k')
}

/**
 * Exact grouped integer: 272000 → "272,000". A bigint or a string of digits stays exact past the
 * JS-safe range; any other value is rounded.
 * @param {unknown} value
 * @returns {string}
 */
export function formatInteger(value) {
  if (typeof value === 'bigint') return GROUPED.format(value)
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return GROUPED.format(BigInt(value.trim()))
  const n = toFinite(value)
  return n === undefined ? MISSING_NUMBER : GROUPED.format(Math.round(n))
}

/**
 * A cost in US dollars at cents: "$0.30", "$1,234.56", "$0.00" for zero, "<$0.01" for a positive
 * amount under one cent. Accepts the recorded decimal string as it arrives.
 * @param {unknown} value
 * @returns {string}
 */
export function formatCost(value) {
  const n = toFinite(value)
  if (n === undefined) return MISSING_NUMBER
  if (n > 0 && n < 0.01) return '<$0.01'
  return (n < 0 ? '-$' : '$') + CENTS.format(Math.abs(n))
}

/**
 * A decimal at fixed places: 0.99 → "0.99", 0.5 with 2 places → "0.50".
 * @param {unknown} value
 * @param {number} places
 * @returns {string}
 */
export function formatDecimal(value, places) {
  const n = toFinite(value)
  return n === undefined ? MISSING_NUMBER : n.toFixed(places)
}

/**
 * Calendar dates are stable across host locales; date-only inputs stay on their UTC day.
 * @param {string | number | Date} value
 * @returns {string}
 */
export function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).toLowerCase()
}

// @ts-check
/* Pure summary-statistics helpers. No React, no I/O. */

/** @typedef {import('./types.js').MedianP90} MedianP90 */

/**
 * Linear-interpolated percentile over a numeric array. `p` is in [0, 1].
 * Non-finite values are dropped first. Returns `null` for an empty input.
 * @param {number[]} values
 * @param {number} p
 * @returns {number | null}
 */
export function percentile(values, p) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (xs.length === 0) return null
  if (xs.length === 1) return xs[0]
  const clamped = Math.min(1, Math.max(0, p))
  const rank = clamped * (xs.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return xs[lo]
  const frac = rank - lo
  return xs[lo] + (xs[hi] - xs[lo]) * frac
}

/**
 * Median of a numeric array (50th percentile). `null` for an empty input.
 * @param {number[]} values
 * @returns {number | null}
 */
export function median(values) {
  return percentile(values, 0.5)
}

/**
 * Compute the median and p90 of a distribution in a single pass-pair. Useful
 * for "typical vs. tail" framing (e.g. duration, tokens) per metric.
 * @param {number[]} values
 * @returns {MedianP90}
 */
export function medianAndP90(values) {
  const finite = values.filter((v) => Number.isFinite(v))
  return {
    count: finite.length,
    median: median(finite),
    p90: percentile(finite, 0.9),
  }
}

// @ts-check
/* turnNav — vim-style keyboard-navigation index math for the trace list.
   ─────────────────────────────────────────────────────────────────────────
   `nextNavTurn` is the pure index math for moving between visible turns:
   given the ordered list of visible turn indices, the current anchor, and a
   direction (+1 = down/next, -1 = up/prev), it returns the turn to move to.
   It clamps at both ends (no wrap) and snaps to the first/last turn when
   there is no current anchor. Kept pure + framework-free so a host can
   drive j/k (or ArrowDown/ArrowUp) navigation, or unit-test the math,
   without wiring a DOM keydown listener through this module. ───────────── */

/**
 * Resolve the next visible turn index for a keyboard-nav step.
 *
 * @param {readonly number[]} turnIndices  ordered visible turn indices (display order)
 * @param {number | undefined} current     the current anchor turn (typically the top visible turn)
 * @param {1 | -1} dir                     +1 = down/next, -1 = up/prev
 * @returns {number | undefined}           the turn to move to; `undefined` when there are no turns
 */
export function nextNavTurn(turnIndices, current, dir) {
  if (turnIndices.length === 0) return undefined
  const firstLast = dir > 0 ? turnIndices[0] : turnIndices[turnIndices.length - 1]
  if (current === undefined) return firstLast
  const pos = turnIndices.indexOf(current)
  if (pos === -1) return firstLast
  const next = pos + dir
  if (next < 0 || next >= turnIndices.length) return turnIndices[pos] // clamp, no wrap
  return turnIndices[next]
}

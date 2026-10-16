/** Find the last ordered turn at or before the reading line, reading logarithmically
 * many offsets. Re-read live offsets so expanded tools and wrapping need no cache.
 * @param {{index: number}[]} turns
 * @param {(index: number) => number} topOf
 * @param {number} readingLine
 * @returns {number}
 */
export function turnAtReadingLine(turns, topOf, readingLine) {
  let low = 0
  let high = turns.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (topOf(turns[mid].index) <= readingLine) low = mid + 1
    else high = mid
  }
  return turns[Math.max(0, low - 1)]?.index ?? 0
}

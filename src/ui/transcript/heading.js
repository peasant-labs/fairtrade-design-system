// @ts-check

/**
 * Resolve the viewer's title level without changing other page composites.
 * @param {unknown} level
 * @returns {1|2|3|4}
 */
export function transcriptHeadingLevel(level) {
  if (level === undefined) return 2
  if (level === 1 || level === 2 || level === 3 || level === 4) return level
  throw new TypeError('TranscriptViewer: headingLevel must be 1, 2, 3, or 4; pass the level immediately below the host heading.')
}

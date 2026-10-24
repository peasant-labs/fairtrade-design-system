// @ts-check
/* heading levels for a composite that can be the whole page. A host that mounts it as its page passes
   headingLevel 1, so the composite's own title is the page's h1 and every heading under it moves up
   one level with it; the default 2 keeps the composite a section of a host page. */

/** The page-title levels a composite accepts. */
export const PAGE_HEADING_LEVELS = Object.freeze([1, 2])

/**
 * @param {unknown} level - the composite's `headingLevel` prop.
 * @param {string} component - the composite's name, for the error.
 * @returns {1|2}
 */
export function pageHeadingLevel(level, component) {
  if (level === undefined) return 2
  if (level === 1 || level === 2) return level
  throw new TypeError(`${component}: headingLevel must be 1 (the composite is the page) or 2 (a section of a host page), received ${JSON.stringify(level)}.`)
}

/**
 * The tag for a heading drawn `depth` levels under the composite's title (0 is the title itself).
 * @param {1|2} pageLevel
 * @param {number} depth
 * @returns {'h1'|'h2'|'h3'|'h4'|'h5'|'h6'}
 */
export function headingTag(pageLevel, depth) {
  return /** @type {'h1'|'h2'|'h3'|'h4'|'h5'|'h6'} */ (`h${Math.min(6, pageLevel + depth)}`)
}

// @ts-check
/* The id of one earlier-history section: `earlier-N`, where N is the section's index. The adapter's
   view model, the viewer's open state and the positioned reader's hook all build and read the id
   here, so they never disagree about which section an id names. */

const ID_PATTERN = /^earlier-(0|[1-9][0-9]*)$/

/**
 * The id of history section `section`.
 * @param {number} section
 * @returns {string}
 */
export function historySectionId(section) {
  if (!Number.isInteger(section) || section < 0) {
    throw new TypeError(`historySectionId refused section ${String(section)}: a history section index is a whole number from 0. Pass the section's served sectionIndex, or its place in earlierHistory.`)
  }
  return `earlier-${section}`
}

/**
 * The section index an id names, or undefined when the value is not a history section id. Only the
 * exact form `historySectionId` builds is read: no sign, no leading zero, nothing before or after.
 * @param {unknown} id
 * @returns {number | undefined}
 */
export function parseHistorySectionId(id) {
  if (typeof id !== 'string') return undefined
  const match = ID_PATTERN.exec(id)
  return match ? Number(match[1]) : undefined
}

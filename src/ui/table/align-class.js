// @ts-check
/* one alignment mapping for every table surface.

   Both table families (the data-table primitive and the transcript library table)
   turn an alignment into the same cell class. Keeping the mapping in one module is
   what stops the two from drifting: decimal is right-aligned with tabular figures,
   exactly like right, and the `tbl-decimal` class belongs to the `DecimalValue`
   span only. A surface that wants decimal points to line up renders `DecimalValue`
   inside the right-aligned cell; it never puts that class on the cell. */

/**
 * @param {string} base the cell or header class.
 * @param {'left' | 'right' | 'center' | 'decimal'} align
 * @returns {string}
 */
export function alignClass(base, align) {
  if (align === 'right' || align === 'decimal') return `${base} tbl-right`
  if (align === 'center') return `${base} tbl-center`
  return base
}

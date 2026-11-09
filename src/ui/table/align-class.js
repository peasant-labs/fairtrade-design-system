// @ts-check
/* one alignment mapping for every table surface.

   Both table families (the data-table primitive and the transcript library table)
   turn an alignment into the same cell class. Keeping the mapping in one module is
   what stops the two from drifting: `Decimal` right-aligns with tabular numbers.
   A decimal-point span is `DataTable`'s own; this module does not export one, and
   the decimal span class never goes on a cell. */

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

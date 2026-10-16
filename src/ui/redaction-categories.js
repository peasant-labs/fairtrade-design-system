import { isRedactionCategory } from '@peasant-labs/schema'

/** @param {unknown} matches */
export function hasKnownRedactionCategories(matches) {
  return Array.isArray(matches) && matches.every((match) => isRedactionCategory(match?.category))
}

/**
 * Audited JS projection of github.com/peasant-labs/redact/category_string.go:
 * Category.String maps wire categories to these exact rendered labels.
 * Unknown input is never a trusted category or a display-label fallback.
 */
export const REDACTION_CATEGORY_LABELS = Object.freeze({
  secrets: 'CREDENTIAL',
  pii: 'PII',
  paths: 'PATH',
  project: 'INTERNAL',
})

/** @typedef {'secrets'|'pii'|'paths'|'project'} RedactionCategory */
/** @param {unknown} category */
export function redactionCategoryLabel(category) {
  return typeof category === 'string' && Object.hasOwn(REDACTION_CATEGORY_LABELS, category)
    ? REDACTION_CATEGORY_LABELS[category]
    : null
}

/** @param {unknown} matches */
export function hasKnownRedactionCategories(matches) {
  return Array.isArray(matches) && matches.every((match) => redactionCategoryLabel(match?.category) !== null)
}

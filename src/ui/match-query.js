/* the one search rule the pickers share: a case-insensitive substring match on the item's own
   text, after trimming the query. an empty query matches everything. recorded text is never
   lowercased for display; only the comparison folds case. */
export function matchesQuery(text, query) {
  const needle = String(query ?? '').trim().toLowerCase()
  if (!needle) return true
  return String(text ?? '').toLowerCase().includes(needle)
}

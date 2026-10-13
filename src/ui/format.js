/** Compact counts use one decimal place and lowercase magnitude suffixes. */
export function formatCount(value) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value).toLowerCase()
}

/** Calendar dates are stable across host locales; date-only inputs stay on their UTC day. */
export function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).toLowerCase()
}

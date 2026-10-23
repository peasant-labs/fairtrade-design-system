// @ts-check
/* time — pure, framework-agnostic time-formatting helpers for the session
   header, turn timestamps and every duration the transcript shows. One duration
   format and one relative-time rule, so a figure reads the same everywhere; an
   unknown time (missing, zero, epoch or Go zero-time) never renders. ───────── */

/**
 * Is this a real recorded time? A missing, unparseable, zero, epoch or Go zero-time value
 * ("0001-01-01T00:00:00Z") is unknown: nothing may render it, and no "ago" math runs on it.
 *
 * @param {string | null | undefined} iso
 * @returns {boolean}
 */
export function isKnownTime(iso) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t > 0
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * A short calendar date in lowercase chrome: "oct 14" this year, "oct 14, 2025" another year.
 *
 * @param {number} t      epoch millis
 * @param {number} now    epoch millis
 * @returns {string}
 */
function formatShortDate(t, now) {
  const d = new Date(t)
  const day = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return d.getFullYear() === new Date(now).getFullYear() ? day : `${day}, ${d.getFullYear()}`
}

/**
 * Human-readable relative time: "just now", "3m ago", "2h ago", "4d ago"; past a week it reads as
 * a date ("oct 14", or "oct 14, 2025" in another year). An unknown time reads as nothing.
 *
 * @param {string} iso        an ISO 8601 timestamp
 * @param {number} [now]      reference "now" in epoch millis (defaults to `Date.now()`; pass explicitly for deterministic tests)
 * @returns {string}
 */
export function formatRelative(iso, now = Date.now()) {
  if (!isKnownTime(iso)) return ''
  const t = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.round((now - t) / 1000))
  if (diffSec < 45) return 'just now'
  if (diffSec < 90) return '1m ago'
  const min = Math.round(diffSec / 60)
  if (min < 45) return `${min}m ago`
  if (min < 90) return '1h ago'
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  if (hr < 36) return '1d ago'
  const d = Math.round(hr / 24)
  if (d <= 7) return `${d}d ago`
  return formatShortDate(t, now)
}

/**
 * The one duration format: human and short. "12s", "4m 30s", "4m", "1h 12m", "1h"; under a
 * second "<1s"; zero, negative or unknown reads as nothing, so a caller hides the figure.
 *
 * @param {number | null | undefined} seconds
 * @returns {string}
 */
export function formatDurationSeconds(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return ''
  if (seconds < 1) return '<1s'
  const s = Math.round(seconds)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`
  const h = Math.floor(m / 60)
  const remM = m % 60
  return remM ? `${h}h ${remM}m` : `${h}h`
}

/**
 * A duration in minutes, in the one format: 4.5 -> "4m 30s", 76 -> "1h 16m", 0 -> "".
 *
 * @param {number | null | undefined} mins
 * @returns {string}
 */
export function formatDurationMins(mins) {
  if (mins == null || !Number.isFinite(mins)) return ''
  return formatDurationSeconds(mins * 60)
}

/**
 * A duration in milliseconds: a tool call reads "820ms" or "1.4s" while short, then the one
 * format ("1m 15s"); zero or unknown reads as nothing.
 *
 * @param {number | null | undefined} ms
 * @returns {string}
 */
export function formatDurationMs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 10000) return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`
  return formatDurationSeconds(ms / 1000)
}

/**
 * "Jan 12, 4:23 PM" — long datetime for tooltips.
 *
 * @param {string} iso
 * @returns {string}
 */
export function formatDateLong(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (!isFinite(d.getTime())) return iso
  // a zero, epoch or Go zero-time value is unknown, never a date
  if (d.getTime() <= 0) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

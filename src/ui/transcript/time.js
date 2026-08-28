// @ts-check
/* time — pure, framework-agnostic time-formatting helpers for the session
   header and turn timestamps. Ported verbatim (behaviour-for-behaviour) from
   transcript-browser's `lib/time.ts`, itself ported from peasant's
   `session-detail/v2/lib/time.ts`. ───────────────────────────────────────── */

/**
 * Human-readable relative time: "3m ago", "2h ago", "4d ago", "Jan 12".
 *
 * @param {string} iso        an ISO 8601 timestamp
 * @param {number} [now]      reference "now" in epoch millis (defaults to `Date.now()`; pass explicitly for deterministic tests)
 * @returns {string}
 */
export function formatRelative(iso, now = Date.now()) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!isFinite(t)) return ''
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
  if (d < 14) return `${d}d ago`
  if (d < 60) return `${Math.round(d / 7)}w ago`
  if (d < 365) return `${Math.round(d / 30)}mo ago`
  return `${Math.round(d / 365)}y ago`
}

/**
 * A duration expressed in minutes → "1h 16m" / "9m" / "42s".
 *
 * @param {number | undefined} mins
 * @returns {string}
 */
export function formatDurationMins(mins) {
  if (mins == null || !isFinite(mins) || mins < 0) return ''
  if (mins < 1) {
    const sec = Math.round(mins * 60)
    return sec === 0 ? '<1s' : `${sec}s`
  }
  if (mins < 60) return `${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins - h * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
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
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

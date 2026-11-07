/* system-summary — the copy on one collapsed system-entry group's head.

   The group's noun is "system entries", and the count clause under it says how many
   entries the group holds and which recorded kinds they are.
   Kind text is emitted VERBATIM: the recorded value is evidence, and the lowercase
   chrome rule applies to chrome, never to what a producer recorded. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/** At most four kind clauses before a `+N more` tail, so the head stays one line. */
const MAX_KIND_CLAUSES = 4

/**
 * The summary under a system-entry group head: `6 entries: 4 mode, 2 attachment`.
 * A member without a producer kind is a plain system message and is named `system`.
 * Kinds sort by count (descending) then by name, so the head is stable across renders.
 *
 * @param {TurnVM[]} [members]
 * @returns {string}
 */
export function systemGroupSummary(members = []) {
  const counts = new Map()
  for (const member of members) {
    const kind = member?.controlKind || 'system'
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  const clauses = [...counts.entries()].sort(([a, an], [b, bn]) => (bn - an) || a.localeCompare(b))
  const shown = clauses.slice(0, MAX_KIND_CLAUSES)
  const hidden = clauses.length - shown.length
  const detail = shown.map(([kind, count]) => `${count} ${kind}`).join(', ')
  return `${plural(members.length, 'entry', 'entries')}${detail ? `: ${detail}` : ''}${hidden > 0 ? `, +${hidden} more` : ''}`
}

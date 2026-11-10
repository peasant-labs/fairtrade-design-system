/* system-group-facet — the per-kind filter a system-entry group's head offers.

   A run of system entries is often several kinds of harness bookkeeping at once (mode,
   permission-mode, attachments, compact notices). The group head names them; this facet
   lets the reader keep one kind visible inside that group without touching the rail.

   Three rules decide the shape:
     • the kind list is DERIVED from the group's own members, never a hard-coded vocabulary,
       so a producer's new control kind is facet-able the moment it is served;
     • a member the producer did not classify falls into the unclassified bucket (compaction
       notices and plain system messages), which keeps them reachable;
     • counts are computed over the group's members BEFORE this facet's own selection, so
       narrowing to one kind never reports its siblings as empty.

   The selection is ephemeral and keyed by group id: it is reader state for one reading, not
   a persisted preference, and a different run (a new group id) starts unfiltered. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/** The bucket id for members without a producer `controlKind`. */
export const UNCLASSIFIED_SYSTEM_KIND = 'unclassified'

/**
 * The facet key one member belongs to: its producer kind, or the unclassified bucket.
 * @param {TurnVM} [member]
 * @returns {string}
 */
export function systemGroupFacetKey(member) {
  const kind = typeof member?.controlKind === 'string' ? member.controlKind.trim() : ''
  return kind === '' ? UNCLASSIFIED_SYSTEM_KIND : kind
}

/**
 * The kinds actually present in a group, with their unfiltered counts. Sorted by count
 * (descending) then by kind so the row is stable across renders. The label is the recorded
 * kind verbatim (a recorded value is evidence; only the unclassified bucket is chrome).
 *
 * @param {TurnVM[]} [members]
 * @returns {Array<{ id: string, label: string, count: number }>}
 */
export function systemGroupFacetKinds(members = []) {
  const counts = new Map()
  for (const member of members) {
    const id = systemGroupFacetKey(member)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([a, an], [b, bn]) => (bn - an) || a.localeCompare(b))
    .map(([id, count]) => ({ id, label: id === UNCLASSIFIED_SYSTEM_KIND ? 'unclassified' : id, count }))
}

/**
 * Whether a kind is selected in the facet's current selection. Absent means selected: a
 * group starts showing every kind, and only an explicit `false` narrows it.
 *
 * @param {Record<string, boolean> | undefined} selection
 * @param {string} id
 * @returns {boolean}
 */
export function systemGroupFacetSelected(selection, id) {
  return selection?.[id] !== false
}

/**
 * One kind flipped on or off. Every other kind keeps its state, so narrowing to one kind
 * leaves its siblings selected-but-unmatched rather than clearing them.
 *
 * @param {Record<string, boolean> | undefined} selection
 * @param {string} id
 * @returns {Record<string, boolean>}
 */
export function toggleSystemGroupFacet(selection, id) {
  return { ...selection, [id]: selection?.[id] === false }
}

/**
 * The members the facet still shows. The group OWNER is not special-cased here: the viewer
 * always renders the owner in place and applies this to the folded members 2..N, which is
 * why a group can never lose its one laid-out row.
 *
 * @param {TurnVM[]} [members]
 * @param {Record<string, boolean> | undefined} [selection]
 * @returns {TurnVM[]}
 */
export function filterSystemGroupMembers(members = [], selection = {}) {
  return members.filter((member) => systemGroupFacetSelected(selection, systemGroupFacetKey(member)))
}

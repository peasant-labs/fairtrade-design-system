/* system-groups — runs of consecutive visible system turns, as one navigation unit.

   Consecutive system turns are harness bookkeeping: the ledger folds a run of two or
   more into one collapsible group instead of drawing an identical row per record. A
   run of one is not a group (there is nothing to fold). The group is derived from
   what the reader can currently see, so a hidden turn splits a run and a filter change
   regroups without any stored state. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/**
 * @typedef {object} SystemGroupVM
 * @property {string} id            stable key for the run (its owner's turn index)
 * @property {TurnVM} owner         the first member; it renders in place, outside the collapsible
 * @property {TurnVM[]} members     every member in turn order, owner first
 */

/**
 * Group runs of two or more consecutive visible system turns.
 *
 * @param {TurnVM[]} [visibleTurns]
 * @returns {Map<number, SystemGroupVM>} member turn index → its group; a non-system
 *          turn and a singleton system turn are absent
 */
export function systemGroups(visibleTurns = []) {
  /** @type {Map<number, SystemGroupVM>} */
  const byMember = new Map()
  /** @type {TurnVM[]} */
  let run = []
  const flush = () => {
    if (run.length >= 2) {
      /** @type {SystemGroupVM} */
      const group = { id: `system-group-${run[0].index}`, owner: run[0], members: run }
      for (const member of run) byMember.set(member.index, group)
    }
    run = []
  }
  for (const turn of visibleTurns) {
    if (turn?.role === 'system') run.push(turn)
    else flush()
  }
  flush()
  return byMember
}

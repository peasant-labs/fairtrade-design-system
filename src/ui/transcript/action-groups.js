/** Stable source user boundaries, followed by visibility projection. No hidden part is restored.
 * @param {import('./view-model.js').TurnVM[]} turns
 * @param {import('./view-model.js').TurnVM[]} visibleTurns
 */
export function actionGroups(turns, visibleTurns) {
  const visible = new Map(visibleTurns.map(turn => [turn.index, turn]))
  const groups = new Map()
  const folded = new Set()
  const locations = new Map()
  let members = []
  const flush = () => {
    const work = members.filter(turn => turn.toolCalls?.length || turn.thinking)
    const anchor = members.find(turn => String(turn.displayContent ?? turn.content ?? '').trim() !== '')
    const owner = anchor ?? work[0]
    if (owner && work.length) {
      groups.set(owner.index, work)
      for (const turn of work) {
        if (turn.index !== owner.index) folded.add(turn.index)
        locations.set(turn.index, { owner: owner.index, where: turn.toolCalls?.[0]?.id ?? 'thinking' })
      }
    }
    members = []
  }
  for (const source of turns) {
    if (source.role === 'user') { flush(); continue }
    const turn = visible.get(source.index)
    if (turn && turn.role !== 'system') members.push(turn)
  }
  flush()
  return { groups, folded, locations }
}

/** Runs follow the source prose, not the filtered projection, so a hidden turn never moves a
 * later action forward. Each prose turn starts its own run; a wordless turn appends to the
 * current run; a user turn closes it; a system turn stays where it is and does not split it.
 * A run without a renderable prose anchor keeps its work at the run's first visible work turn,
 * and a run with no work draws no block. No hidden part is restored.
 * @param {import('./view-model.js').TurnVM[]} turns
 * @param {import('./view-model.js').TurnVM[]} visibleTurns
 */
export function actionGroups(turns, visibleTurns) {
  const visible = new Map(visibleTurns.map(turn => [turn.index, turn]))
  const groups = new Map()
  const folded = new Set()
  const locations = new Map()
  const prose = turn => String(turn.displayContent ?? turn.content ?? '').trim() !== ''
  let run = []
  const flush = () => {
    const members = run.map(turn => visible.get(turn.index)).filter(turn => turn != null)
    const work = members.filter(turn => turn.toolCalls?.length || turn.thinking)
    const anchor = run.find(turn => prose(turn))
    const rendered = anchor ? visible.get(anchor.index) : undefined
    const owner = (rendered && prose(rendered) ? rendered : undefined) ?? work[0]
    if (owner && work.length) {
      groups.set(owner.index, work)
      for (const turn of work) {
        if (turn.index !== owner.index) folded.add(turn.index)
        locations.set(turn.index, { owner: owner.index, where: turn.toolCalls?.[0]?.id ?? 'thinking' })
      }
    }
    run = []
  }
  for (const source of turns) {
    if (source.role === 'user') { flush(); continue }
    if (source.role === 'system') continue
    if (prose(source)) flush()
    run.push(source)
  }
  flush()
  return { groups, folded, locations }
}

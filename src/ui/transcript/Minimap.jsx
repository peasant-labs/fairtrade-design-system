/* TranscriptMinimap — the whole-transcript position strip in the pinned trace header of the
   ledger presentation. DUMB: it renders one segment per cooked `TurnVM` the reader can currently
   see (the viewer passes its already-filtered `visibleTurns`), marks the active one with
   `aria-current`, and reports a click as a turn index through `onJump`. It parses no wire and
   holds no state.

   Segment KIND is a semantic role, not a hue choice: a user turn, a tool-running turn (a system
   turn, or an assistant turn carrying tool calls), or everything else. The CSS pairs the colour
   with the accessible name, so colour never carries the meaning alone. Exported as
   `TranscriptMinimap`. */

/** @typedef {import('./view-model.js').TurnVM} TurnVM */

/** the segment kind of a cooked turn: user prompt, tool work, or agent prose. */
function segmentKind(turn) {
  if (turn.role === 'user') return 'user'
  if (turn.role === 'system' || (turn.toolCalls?.length ?? 0) > 0) return 'tool'
  return 'agent'
}

/**
 * @param {object} props
 * @param {TurnVM[]} [props.turns]        the turns the reader can currently see, in turn order
 * @param {number} [props.activeTurn]     the active TURN INDEX (TurnVM.index)
 * @param {(turnIndex: number) => void} [props.onJump]
 * @param {string} [props.label]          accessible name for the navigation landmark
 */
export default function TranscriptMinimap({
  turns = [],
  activeTurn,
  onJump = () => {},
  label = 'transcript timeline',
}) {
  return (
    <nav className="txn-minimap" aria-label={label}>
      {turns.map((turn) => (
        <button
          key={turn.identity ?? turn.index}
          type="button"
          className={'txn-minimap-seg txn-minimap-' + segmentKind(turn)}
          data-jump={turn.index}
          aria-current={turn.index === activeTurn ? 'true' : undefined}
          aria-label={'jump to ' + turn.role + ' turn ' + turn.label}
          onClick={() => onJump(turn.index)}
        />
      ))}
    </nav>
  )
}

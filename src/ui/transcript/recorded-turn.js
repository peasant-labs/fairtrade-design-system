// @ts-check
/* The index a turn is addressed by outside one read: its recorded index. A whole-document turn's
   index is its recorded index. A positioned row's index is its served position, which can move
   between revisions, so it is addressed by the recorded index the server sent and has no address
   without one. The copy link and saved labels both key on this value. */

/**
 * @param {{ index: number, position?: number, recordedIndex?: number }} turn
 * @returns {number | undefined}
 */
export function recordedTurnIndex(turn) {
  return turn.position === undefined ? turn.index : turn.recordedIndex
}

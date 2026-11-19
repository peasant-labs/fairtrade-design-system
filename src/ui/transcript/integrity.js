import { MAIN_PARTITION_ID } from './adapter.js'

/**
 * Pure view of a transcript's served integrity flag. The host passes the served value as it
 * arrived, the detail response's content hash, and the content hash of the rendered content.
 * Nothing here knows how the flag was decided.
 */

/** @typedef {import('@peasant-labs/schema').VillageTranscriptIntegrity} VillageTranscriptIntegrity */

/**
 * Every string the integrity badge, its help panel and the flagged-turn mark show. This object is
 * the single place to edit that wording: change a value here and every surface follows. The tests
 * read the strings from this object rather than repeating them, so a reworded value needs no test
 * edit. They do guard that the key set stays the same, that no value names a rule, a field or the
 * service behind the check, and that no value uses an em dash or a middle dot. The badge's
 * accessible name (helpName) must contain its visible label (badgeLabel).
 */
export const INTEGRITY_COPY = Object.freeze({
  badgeLabel: 'suspicious transcript',
  helpName: 'what does suspicious transcript mean?',
  panelHeading: 'about this flag',
  panelBody: 'This transcript has likely been edited after it was recorded, according to our automated detection systems.',
  panelOtherTools: 'Custom tools, plugins or hooks used during the session can create false positives.',
  statusText: 'This transcript has been flagged by an automated check and was likely modified after initially recorded.',
  turnMark: 'flagged',
  turnName: ', flagged by an automated check',
  groupMark: 'includes a flagged turn',
})

/**
 * @param {unknown} integrity  the served integrity value; its presence is the flag
 * @param {unknown} transcriptContentHash  the detail response's transcript content hash
 * @param {unknown} contentHash  the hash of the rendered content, when the host has one
 * @returns {{ positions: ReadonlySet<number> } | null} null draws nothing; otherwise the badge
 *   draws, and positions are marked only when both hashes are non-empty and equal
 */
export function integrityView(integrity, transcriptContentHash, contentHash) {
  if (integrity === null || typeof integrity !== 'object' || Array.isArray(integrity)) return null
  const flagged = /** @type {Partial<VillageTranscriptIntegrity>} */ (integrity).flagged_turns
  if (!Array.isArray(flagged)) return null
  const bound = typeof transcriptContentHash === 'string' && transcriptContentHash !== '' && transcriptContentHash === contentHash
  /** @type {Set<number>} */
  const positions = new Set()
  if (bound) for (const position of flagged) if (Number.isInteger(position) && position >= 0) positions.add(position)
  return { positions }
}

/**
 * The integrity props for a positioned read. The header's marks are `(position, turn)` pairs in the
 * served main partition: a mark lands on the loaded row at that position only when the row carries
 * that recorded index, so a mark can never sit on another row. Marks are decided only when the header
 * carries `contentHash`; without it the badge draws alone and no row is marked.
 * @param {{ flaggedTurns?: { position: number, turn?: number }[], contentHash?: string } | null | undefined} header
 * @param {{ position?: number, recordedIndex?: number, partition?: string }[]} turns  the loaded rows
 * @returns {{ integrity: { flagged_turns: number[] } | null, contentHash: string }}
 */
export function positionedIntegrity(header, turns) {
  const pairs = header?.flaggedTurns
  if (!Array.isArray(pairs)) return { integrity: null, contentHash: '' }
  const contentHash = typeof header?.contentHash === 'string' ? header.contentHash : ''
  /** @type {Map<number, { recordedIndex?: number }>} */
  const byPosition = new Map()
  for (const turn of turns) {
    if (turn.partition === MAIN_PARTITION_ID && Number.isInteger(turn.position)) byPosition.set(/** @type {number} */ (turn.position), turn)
  }
  /** @type {number[]} */
  const flagged = []
  for (const pair of pairs) {
    const row = byPosition.get(pair.position)
    if (row && row.recordedIndex === pair.turn) flagged.push(pair.position)
  }
  return { integrity: { flagged_turns: flagged }, contentHash }
}

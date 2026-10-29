/**
 * Pure view of a transcript's served integrity flag. The host passes the served value as it
 * arrived, the detail response's content hash, and the content hash of the rendered content.
 * Nothing here knows how the flag was decided.
 */

/** @typedef {import('@peasant-labs/schema').VillageTranscriptIntegrity} VillageTranscriptIntegrity */

/** Every string the integrity badge, its help panel and the flagged-turn mark show. */
export const INTEGRITY_COPY = Object.freeze({
  badgeLabel: 'flagged',
  helpName: 'what does flagged mean?',
  panelHeading: 'about this flag',
  panelBody: "This transcript has likely been edited after it was recorded: an automated check found that the session's own records don't line up.",
  panelHighlights: "Turns marked flagged are where the check found the records don't line up.",
  panelBestEffort: 'The check follows fixed rules and does its best, but it can be wrong. A flag is not proof.',
  panelOtherTools: 'Custom tools, plugins or hooks used during the session can also cause this, without anyone editing the transcript.',
  panelNoVerify: 'A transcript without a flag is not proven unedited. The check can miss changes.',
  helpLink: 'how the check works',
  statusText: 'This transcript has been flagged by an automated check.',
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

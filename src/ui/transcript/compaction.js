/* compaction - the producer's context-compaction boundary, cooked once.

   The canonical wire does not carry a part type or compact metadata today, so the
   only compaction signal fairtrade receives is the notice peasant already serves as
   a system turn's content. These are the exact one-line previews
   `claudeCompactBoundaryPreview` emits:

     Context compacted
     Context compacted (auto)
     Context compacted (auto): 168104 -> 24000 tokens
     Context compacted: 120000 -> 40000 tokens in 1200ms
     Context compacted: 120000 tokens before
     Context compacted: 120000 tokens after
     Conversation compacted

   The match is deliberately narrow. The trimmed text must begin, case-sensitively,
   with `Context compacted` or `Conversation compacted`; an optional parenthesized
   trigger may follow; and a colon tail must be one of the canonical count forms.
   A system message that merely mentions compaction, or that adds an unrecognized
   tail, stays an ordinary system row. The adapter calls this once; components render
   the descriptor and never parse. */

const BOUNDARY_NOTICE = /^(Context|Conversation) compacted(?: \(([a-z][a-z-]*)\))?(?:: (?:(\d[\d,]*) -> (\d[\d,]*) tokens(?: in (\d+)ms)?|(\d[\d,]*) tokens before|(\d[\d,]*) tokens after))?$/

/** @param {string | undefined} digits @returns {number | undefined} */
function countOf(digits) {
  if (digits === undefined) return undefined
  const value = Number(digits.replaceAll(',', ''))
  return Number.isFinite(value) ? value : undefined
}

/**
 * Cook one system turn's recorded content into a compaction descriptor, or undefined
 * when the text is not the producer's boundary notice.
 *
 * @param {string | undefined | null} content the recorded turn content
 * @returns {import('./view-model.js').CompactionVM | undefined}
 */
export function parseCompactionNotice(content) {
  if (typeof content !== 'string') return undefined
  const match = BOUNDARY_NOTICE.exec(content.trim())
  if (!match) return undefined
  const [, base, trigger, pre, post, durationMs, before, after] = match
  /** @type {import('./view-model.js').CompactionVM} */
  const notice = {
    label: base === 'Conversation' ? 'conversation compacted' : 'context compacted',
    text: content,
  }
  if (trigger !== undefined) notice.trigger = trigger
  const preTokens = countOf(pre ?? before)
  const postTokens = countOf(post ?? after)
  if (preTokens !== undefined) notice.preTokens = preTokens
  if (postTokens !== undefined) notice.postTokens = postTokens
  const duration = countOf(durationMs)
  if (duration !== undefined) notice.durationMs = duration
  return notice
}

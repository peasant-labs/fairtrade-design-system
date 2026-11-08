/* control-value — the recorded value a control row shows beside its producer kind.

   Harnesses record the kind INSIDE the value as often as not: "mode: normal",
   "Permission Mode: Auto", or a bare "atis-latch". Rendering the kind and then the
   whole value repeats it ("mode  mode: normal"). The row drops ONLY the leading
   phrase that names the kind; every other recorded byte stays verbatim, and a value
   that does not name the kind is returned untouched.

   Matching is comparison-only, never a rewrite: it folds case and treats hyphens,
   underscores and spaces as the same separator, because a producer writes
   "permission-mode" as a kind and "permission mode: auto" as a value. What the row
   prints is always a slice of the recorded text. */

const SEPARATORS = /[\s_-]+/g

/* the kind as a match pattern: its literal characters except any run of separators. */
function phrasePattern(kind) {
  return kind
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(SEPARATORS, '[\\s_-]+')
}

/**
 * The recorded value with its leading kind phrase removed; the recorded bytes
 * otherwise, verbatim. Returns '' when the value names the kind and nothing else,
 * so the row renders the kind once instead of printing it twice.
 * @param {string | undefined | null} kind  the producer's `controlKind`
 * @param {string | undefined | null} value the recorded value
 * @returns {string}
 */
export function controlValueRemainder(kind, value) {
  const recorded = typeof value === 'string' ? value : ''
  const phrase = typeof kind === 'string' ? kind.trim() : ''
  if (!recorded || !phrase) return recorded
  /* the phrase must end at a boundary: the value's end, a separator, or the ":" the
     harnesses write after it. Without that, "model: x" would match the kind "mode". */
  const match = recorded.match(new RegExp(`^\\s*${phrasePattern(phrase)}(?:\\s*:\\s*|\\s+|$)`, 'i'))
  if (!match) return recorded
  return recorded.slice(match[0].length)
}

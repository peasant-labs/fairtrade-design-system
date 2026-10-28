/** Local disclosure identity; the recorded ID itself is never changed. */
export function toolStateKey(turnIndex, tool) {
  return tool.id || `\u0000tool:${turnIndex}:${tool.sourceIndex}`
}

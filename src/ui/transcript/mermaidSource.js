/* Mermaid owns the grammar. This small preflight rejects active content and configuration,
   not diagram types. The parsed model is also checked before the renderer touches the DOM. */
export function safeMermaidSource(source) {
  if (typeof source !== 'string' || source.length > 8192) return false
  // Only attribute-free line breaks are inert. Keep all other tags visible to
  // the existing rejection rule; a space avoids joining adjacent tokens.
  const inspected = source.replace(/<br\s*\/?>/gi, ' ')
  return !/(?:^\s*---\s*$|%%\s*\{|<\s*\/?[a-z!][^>]*>|&(?:#\d+|#x[\da-f]+|[a-z]+);|(?:https?:|data:|javascript:|file:|\/\/)|\b(?:click|callback)\s|\burl\s*\(|!\s*\[|[\"'](?:__proto__|constructor|prototype)[\"']\s*:|\b(?:fa|fab|fas|far):|\b(?:classDef|style|linkStyle)\s)/im.test(inspected)
}

/* Flowchart image nodes are loaded by Mermaid's live renderer before SVG is returned.
   Inspect the native DB, including nodes exposed by getData and getVertices, before draw. */
export function safeMermaidModel(diagram) {
  const db = diagram?.db
  if (!db) return false
  const seen = new WeakSet()
  let visited = 0
  function check(value, depth = 0) {
    if (!value || typeof value !== 'object') return true
    if (depth > 30 || ++visited > 10000) return false
    if (seen.has(value)) return true
    seen.add(value)
    const entries = value instanceof Map ? [...value.entries()] : value instanceof Set ? [...value].map((item, i) => [i, item]) : Array.isArray(value) ? value.map((item, i) => [i, item]) : Object.entries(value)
    for (const [key, item] of entries) {
      if (typeof key === 'string' && /^(?:img|image|icon|href|link|callback|clickEvent)$/i.test(key) && item) return false
      if (!check(item, depth + 1)) return false
    }
    return true
  }
  for (const method of ['getData', 'getVertices', 'getActors']) {
    if (typeof db[method] === 'function') {
      const value = db[method]()
      // getData includes site configuration; inspect its diagram content, not configuration.
      if (method === 'getData' && value && typeof value === 'object') {
        const { config: _config, ...content } = value
        if (!check(content)) return false
      } else if (!check(value)) return false
    }
  }
  const { config: _config, ...state } = db
  return check(state)
}

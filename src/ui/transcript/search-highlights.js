export function searchExpression(query) {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
}

// Join inline text within a block, but never join unrelated paragraphs or controls.
export function renderedSearchRanges(root, query) {
  if (!root || !query.trim()) return []
  const needle = searchExpression(query)
  const doc = root.ownerDocument
  // Detached documents may not have a browsing context; SHOW_TEXT is the DOM-standard bit 4.
  const walker = doc.createTreeWalker(root, doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4)
  const groups = new Map()
  const ranges = []
  while (walker.nextNode()) {
    const node = walker.currentNode
    const parent = node.parentElement
    if (!parent || parent.closest('[hidden], [inert], [aria-hidden="true"]') || !parent.getClientRects().length) continue
    const block = parent.closest('p, pre, button, li, td, th, h1, h2, h3, h4, h5, h6, .txn-thinking-box')
    const key = block && root.contains(block) ? block : parent
    const group = groups.get(key) ?? { text: '', nodes: [] }
    group.nodes.push({ node, start: group.text.length, end: group.text.length + node.data.length })
    group.text += node.data
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    needle.lastIndex = 0
    let match
    while ((match = needle.exec(group.text)) !== null) {
      const start = group.nodes.find(part => part.end > match.index)
      const end = group.nodes.find(part => part.end >= match.index + match[0].length)
      if (!start || !end) continue
      const range = root.ownerDocument.createRange()
      range.setStart(start.node, match.index - start.start)
      range.setEnd(end.node, match.index + match[0].length - end.start)
      ranges.push(range)
    }
  }
  return ranges
}

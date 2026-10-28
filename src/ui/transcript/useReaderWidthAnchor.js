import { useEffect, useLayoutEffect, useRef } from 'react'

// Resolve the same character after React replaces a text node. Do not guess if its
// immediate text context changed or the source is no longer mounted.
function restoreRange(a) {
  const walker = a.target.ownerDocument.createTreeWalker(a.target, NodeFilter.SHOW_TEXT)
  let remaining = a.textOffset
  let node
  while ((node = walker.nextNode())) {
    if (remaining <= node.length) {
      if (node.data.slice(Math.max(0, remaining - 12), remaining + 12) !== a.context) return false
      const range = node.ownerDocument.createRange()
      range.setStart(node, remaining); range.collapse(true)
      a.node = node; a.offset = remaining; a.range = range
      return true
    }
    remaining -= node.length
  }
  return false
}

export default function useReaderWidthAnchor({ readerPx, scrollRef, activeTurnRef, turnRefs, actionRefs, actionLayout, visibleTurns, ledger, sessionId, tab, viewMode, onSettle }) {
  const anchor = useRef(null)
  const frame = useRef(null)
  const expectedScroll = useRef(null)
  const finishing = useRef(false)
  const reconciled = useRef(false)
  function clear() {
    anchor.current = null
    finishing.current = false
    reconciled.current = false
    expectedScroll.current = null
    if (frame.current != null) cancelAnimationFrame(frame.current)
    frame.current = null
  }
  function begin() {
    clear()
    const stream = scrollRef.current
    const index = activeTurnRef.current
    const turn = visibleTurns.find(item => item.index === index)
    const location = ledger && !String(turn?.displayContent ?? turn?.content ?? '').trim() ? actionLayout.locations.get(index) : null
    const target = location ? actionRefs.current.get(`${index}:${location.where}`) : turnRefs.current[index]
    if (!stream || !target?.isConnected) return
    const view = stream.getBoundingClientRect(), box = target.getBoundingClientRect()
    const top = Math.max(view.top, box.top), bottom = Math.min(view.bottom, box.bottom)
    const left = Math.max(view.left, box.left), right = Math.min(view.right, box.right)
    if (bottom <= top || right <= left) return
    const y = Math.max(top + 1, Math.min(bottom - 1, view.top + view.height * 0.4))
    const doc = stream.ownerDocument
    for (const fraction of [0.5, 0.25, 0.75]) {
      const x = left + (right - left) * fraction
      const pos = doc.caretPositionFromPoint?.(x, y)
      const old = !pos && doc.caretRangeFromPoint?.(x, y)
      const node = pos?.offsetNode ?? old?.startContainer
      const offset = pos?.offset ?? old?.startOffset
      if (node?.nodeType !== 3 || !target.contains(node) || offset > node.length) continue
      const range = doc.createRange()
      range.setStart(node, offset); range.collapse(true)
      const rect = range.getBoundingClientRect()
      if (rect.height && rect.top >= view.top && rect.top < view.bottom) {
        const before = doc.createRange()
        before.selectNodeContents(target); before.setEnd(node, offset)
        anchor.current = { index, target, node, offset, y: rect.top, range,
          textOffset: before.toString().length, context: node.data.slice(Math.max(0, offset - 12), offset + 12) }
        schedule()
        return
      }
    }
    if (box.top >= view.top && box.top < view.bottom) {
      anchor.current = { index, target, y: box.top }
      schedule()
      return
    }
    const visible = (doc.elementsFromPoint?.((left + right) / 2, y) ?? []).find(el => target.contains(el) && el !== target && el.getBoundingClientRect().top >= view.top)
    if (visible) { anchor.current = { index, target: visible, y: visible.getBoundingClientRect().top }; schedule() }
  }
  function compensate() {
    const a = anchor.current, stream = scrollRef.current
    if (!a || !stream) return
    if (!a.target.isConnected || !stream.contains(a.target)) { clear(); return }
    if (a.node && (!a.node.isConnected || !a.target.contains(a.node)) && !restoreRange(a)) { clear(); return }
    if (a.node && (a.offset > a.node.length || a.node.data.slice(Math.max(0, a.offset - 12), a.offset + 12) !== a.context)) { clear(); return }
    const y = a.range ? a.range.getBoundingClientRect().top : a.target.getBoundingClientRect().top
    const delta = y - a.y
    if (Math.abs(delta) > 0.5) { stream.scrollTop += delta; expectedScroll.current = stream.scrollTop }
  }
  function tick() {
    frame.current = null
    if (!anchor.current) return
    compensate()
    const header = scrollRef.current?.closest('.txn-app')?.querySelector('.txn-header')
    const moving = header?.getAnimations?.({ subtree: true }).some(a => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime))
    if (finishing.current && !moving) {
      if (reconciled.current) { clear(); return }
      reconciled.current = true
      onSettle()
    }
    frame.current = requestAnimationFrame(tick)
  }
  function schedule() { if (anchor.current && frame.current == null) frame.current = requestAnimationFrame(tick) }
  function finish() { finishing.current = true; schedule() }
  useLayoutEffect(() => { compensate() }, [readerPx])
  useEffect(() => {
    return () => { clear(); expectedScroll.current = null }
  }, [sessionId, tab, viewMode])
  function skipScroll(stream) {
    if (expectedScroll.current != null && Math.abs(stream.scrollTop - expectedScroll.current) < 1) { expectedScroll.current = null; return true }
    if (anchor.current) clear()
    return false
  }
  function ensure() { if (!anchor.current) begin() }
  return { begin, ensure, finish, clear, skipScroll }
}

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { renderedSearchRanges } from './search-highlights.js'

// React owns the overlay, not the transcript DOM. This works without the optional CSS Highlight API
// and never changes, wraps, or interprets untrusted transcript content.
export default function SearchHighlights({ scrollRef, query, enabled, revision }) {
  const [rects, setRects] = useState([])
  useEffect(() => {
    const sc = scrollRef.current
    if (!enabled || !query.trim() || !sc) { setRects([]); return undefined }
    let frame = 0
    let dirty = true
    let ranges = []
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (dirty) {
          const roots = sc.querySelectorAll('.txn-body, .txn-thinking-box, .txn-toolcall')
          ranges = [...roots].flatMap(root => renderedSearchRanges(root, query))
          dirty = false
        }
        const color = getComputedStyle(sc).getPropertyValue('--amber-fill').trim()
        const boxes = []
        for (const range of ranges) {
          const clip = sc.getBoundingClientRect()
          let left = clip.left, right = clip.right, top = clip.top, bottom = clip.bottom
          for (let el = range.startContainer.parentElement; el && el !== sc; el = el.parentElement) {
            const style = getComputedStyle(el)
            const box = el.getBoundingClientRect()
            if (/auto|scroll|hidden|clip/.test(style.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right) }
            if (/auto|scroll|hidden|clip/.test(style.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom) }
          }
          for (const rect of range.getClientRects()) {
            const x = Math.max(left, rect.left), y = Math.max(top, rect.top)
            const width = Math.min(right, rect.right) - x, height = Math.min(bottom, rect.bottom) - y
            if (width > 0 && height > 0) boxes.push({ left: x, top: y, width, height, backgroundColor: color })
          }
        }
        setRects(boxes)
      })
    }
    update()
    const observer = new MutationObserver(() => { dirty = true; update() })
    observer.observe(sc, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden', 'class', 'style'] })
    const app = sc.closest('.txn-app')
    if (app) observer.observe(app, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    resize?.observe(sc)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { observer.disconnect(); resize?.disconnect(); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); cancelAnimationFrame(frame) }
  }, [scrollRef, query, enabled, revision])
  if (typeof document === 'undefined' || !enabled) return null
  return createPortal(<div className="txn-search-highlights" aria-hidden="true">{rects.map((rect, index) => <span className="txn-search-highlight" key={index} style={rect} />)}</div>, document.body)
}

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { renderedSearchRanges } from './search-highlights.js'

// React owns the overlay, not the transcript DOM. This works without the optional CSS Highlight API
// and never changes, wraps, or interprets untrusted transcript content.
export default function SearchHighlights({ scrollRef, query, enabled, revision, selected }) {
  const [rects, setRects] = useState([])
  useEffect(() => {
    const sc = scrollRef.current
    if (!enabled || !query.trim() || !sc) { setRects([]); return undefined }
    let frame = 0
    let dirty = true
    let groups = []
    const innerScrolled = new Set()
    const measureBins = (block, ranges) => {
      const origin = block.getBoundingClientRect()
      const bins = []
      for (let i = 0; i < ranges.length; i += 64) {
        const batch = ranges.slice(i, i + 64)
        let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
        for (const range of batch) {
          const rect = range.getBoundingClientRect()
          left = Math.min(left, rect.left - origin.left); right = Math.max(right, rect.right - origin.left)
          top = Math.min(top, rect.top - origin.top); bottom = Math.max(bottom, rect.bottom - origin.top)
        }
        bins.push({ ranges: batch, left, right, top, bottom })
      }
      return bins
    }
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (dirty) {
          const roots = sc.querySelectorAll('.txn-body, .txn-thinking-box, .txn-toolcall')
          groups = [...roots].flatMap(root => {
            const byBlock = new Map()
            for (const range of renderedSearchRanges(root, query)) {
              const parent = range.startContainer.parentElement
              const block = parent.closest('p, pre, button, li, td, th, h1, h2, h3, h4, h5, h6, .txn-thinking-box') ?? root
              if (!byBlock.has(block)) byBlock.set(block, [])
              byBlock.get(block).push(range)
            }
            return [...byBlock].map(([block, ranges]) => ({ block, ranges, bins: measureBins(block, ranges) }))
          })
          dirty = false
        } else if (innerScrolled.size) {
          for (const group of groups) {
            if ([...innerScrolled].some(el => el.contains(group.block) || group.block.contains(el))) group.bins = measureBins(group.block, group.ranges)
          }
        }
        innerScrolled.clear()
        const color = getComputedStyle(sc).getPropertyValue('--amber-fill').trim()
        const outline = getComputedStyle(sc).getPropertyValue('--ink-strong').trim()
        const boxes = []
        const clip = sc.getBoundingClientRect()
        for (const { block, bins } of groups) {
          const blockRect = block.getBoundingClientRect()
          if (blockRect.bottom <= clip.top || blockRect.top >= clip.bottom) continue
          for (const bin of bins) {
            if (blockRect.top + bin.bottom <= clip.top || blockRect.top + bin.top >= clip.bottom || blockRect.left + bin.right <= clip.left || blockRect.left + bin.left >= clip.right) continue
            for (const range of bin.ranges) {
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
                if (width > 0 && height > 0) boxes.push({ left: x, top: y, width, height, backgroundColor: `color-mix(in srgb, ${color} 35%, transparent)`, outlineColor: outline, current: !!selected && range.startContainer === selected.startContainer && range.startOffset === selected.startOffset && range.endContainer === selected.endContainer && range.endOffset === selected.endOffset })
              }
            }
          }
        }
        setRects(previous => JSON.stringify(previous) === JSON.stringify(boxes) ? previous : boxes)
      })
    }
    update()
    const observer = new MutationObserver(() => { dirty = true; update() })
    observer.observe(sc, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden', 'class', 'style'] })
    const app = sc.closest('.txn-app')
    if (app) observer.observe(app, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { dirty = true; update() })
    resize?.observe(sc)
    const onScroll = event => { if (event.target?.nodeType && event.target !== sc && sc.contains(event.target)) innerScrolled.add(event.target); update() }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', update)
    return () => { observer.disconnect(); resize?.disconnect(); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', update); cancelAnimationFrame(frame) }
  }, [scrollRef, query, enabled, revision, selected])
  if (typeof document === 'undefined' || !enabled) return null
  return createPortal(<div className="txn-search-highlights" aria-hidden="true">{rects.map(({ current, ...rect }, index) => <span className={'txn-search-highlight' + (current ? ' is-current' : '')} key={index} style={rect} />)}</div>, document.body)
}

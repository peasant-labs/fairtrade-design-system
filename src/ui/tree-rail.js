import { useCallback, useEffect, useRef, useState } from 'react'

/* The measured tree connector, shared by every fairtrade tree that draws one: the helper tree
   (HelperGroupListItem) and the selection tree (SelectionTree). One idiom, one implementation.

   A tree registers each MOUNTED row element with its depth. After any change the tree schedules a
   measure: the centre of each registered row's checkbox becomes an anchor, each depth is snapped
   to one column, and one continuous path is traced through the anchors from top to bottom. A row
   the host never mounted (a folded row's children, for one) is never traced, and a row without a
   checkbox is not an anchor. The connector carries no meaning the rows and their checkboxes do not
   already carry, so the tree draws it in an SVG that is hidden from assistive technology and takes
   no pointer events. */

/** How far the connector reaches past its first and last anchor, in measured px. */
export const RAIL_CAP = 6

/**
 * Composes ONE continuous path through the ordered checkbox anchors. Between
 * adjacent rows the lone horizontal step sits at the DEEPER row's y (always an
 * indentation gutter, never across a row's title), and the vertical changes
 * column exactly once, so at any y there is exactly one vertical segment. The
 * path opens and closes with a single cap collinear with the first/last
 * segment.
 * @param {ReadonlyArray<{ x: number, y: number, depth: number }>} anchors top to bottom
 * @returns {string} the SVG path data, or '' with no anchor
 */
export function buildRailPath(anchors) {
  if (anchors.length === 0) return ''
  const first = anchors[0]
  const parts = [`M ${first.x} ${first.y - RAIL_CAP}`, `L ${first.x} ${first.y}`]
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1]
    const cur = anchors[i]
    if (cur.x === prev.x) {
      parts.push(`L ${cur.x} ${cur.y}`)
    } else if (cur.depth > prev.depth) {
      // Descending: fall at the parent column to the child row, then step in.
      parts.push(`L ${prev.x} ${cur.y}`, `L ${cur.x} ${cur.y}`)
    } else {
      // Ascending: step out at the deeper (previous) row, then fall to the row.
      parts.push(`L ${cur.x} ${prev.y}`, `L ${cur.x} ${cur.y}`)
    }
  }
  const last = anchors[anchors.length - 1]
  parts.push(`L ${last.x} ${last.y + RAIL_CAP}`)
  return parts.join(' ')
}

/**
 * The anchors of the registered rows, measured against the tree container: the centre of each
 * mounted row checkbox, top to bottom, with each depth snapped to ONE column (its median x) so
 * every vertical at a given depth is exactly aligned. A registration whose element left the page
 * is dropped here.
 * @param {Element} container the element the connector is drawn over
 * @param {Map<Element, number>} rows registered row elements and their depths
 * @returns {Array<{ x: number, y: number, depth: number }>}
 */
export function measureRailAnchors(container, rows) {
  const containerRect = container.getBoundingClientRect()
  const anchors = []
  for (const [element, depth] of rows) {
    // A row that unmounted left its registration behind; drop it rather than
    // trace a node that is no longer on the page.
    if (!element.isConnected || !container.contains(element)) {
      rows.delete(element)
      continue
    }
    const input = element.querySelector('input[type="checkbox"]')
    if (!input) continue // no checkbox, no anchor
    const rect = input.getBoundingClientRect()
    anchors.push({
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top + rect.height / 2 - containerRect.top,
      depth,
    })
  }
  // Anchors arrive in registration order, which is mount order; the path is
  // traced top to bottom, so order them by where they actually sit.
  anchors.sort((a, b) => a.y - b.y)
  const byDepth = new Map()
  for (const anchor of anchors) {
    const xs = byDepth.get(anchor.depth) ?? []
    xs.push(anchor.x)
    byDepth.set(anchor.depth, xs)
  }
  for (const [depth, xs] of byDepth) {
    const sorted = xs.slice().sort((a, b) => a - b)
    const column = sorted[Math.floor(sorted.length / 2)]
    for (const anchor of anchors) if (anchor.depth === depth) anchor.x = column
  }
  return anchors
}

/**
 * The connector state for one tree. Attach `containerRef` to the element the SVG is drawn over,
 * register every mounted row with `register(element, depth)` (and `unregister` it on unmount),
 * and call `scheduleMeasure` after anything that can move a row. Mount, a container resize and a
 * window resize re-measure on their own.
 * @returns {{
 *   containerRef: import('react').RefObject<HTMLElement | null>,
 *   register: (element: Element, depth: number) => void,
 *   unregister: (element: Element) => void,
 *   scheduleMeasure: () => void,
 *   railPath: string,
 *   anchorCount: number,
 * }}
 */
export function useMeasuredRail() {
  const containerRef = useRef(null)
  const rowsRef = useRef(new Map())
  const frameRef = useRef(0)
  const timerRef = useRef(0)
  const [railPath, setRailPath] = useState('')
  const [anchorCount, setAnchorCount] = useState(0)

  const register = useCallback((element, depth) => { rowsRef.current.set(element, depth) }, [])
  const unregister = useCallback((element) => { rowsRef.current.delete(element) }, [])

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const anchors = measureRailAnchors(container, rowsRef.current)
    setRailPath(buildRailPath(anchors))
    setAnchorCount(anchors.length)
  }, [])

  const scheduleMeasure = useCallback(() => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRef.current)
    if (typeof clearTimeout === 'function') clearTimeout(timerRef.current)
    if (typeof requestAnimationFrame === 'function') {
      frameRef.current = requestAnimationFrame(measure)
      // A throttled tab (backgrounded, or one of several stories polled at once)
      // can starve rAF, which would leave the rail unmeasured; one bounded
      // timeout guarantees the connector is drawn either way. Measuring twice is
      // harmless: the path is derived from where the rows actually sit.
      timerRef.current = setTimeout(measure, 250)
    } else {
      measure()
    }
  }, [measure])

  useEffect(() => {
    scheduleMeasure()
    const container = containerRef.current
    const observer = typeof ResizeObserver !== 'undefined' && container ? new ResizeObserver(scheduleMeasure) : null
    observer?.observe(container)
    window.addEventListener('resize', scheduleMeasure)
    return () => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRef.current)
      if (typeof clearTimeout === 'function') clearTimeout(timerRef.current)
      observer?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [scheduleMeasure])

  return { containerRef, register, unregister, scheduleMeasure, railPath, anchorCount }
}

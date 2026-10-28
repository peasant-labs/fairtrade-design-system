import React from 'react'

const TAGS = new Set(['svg', 'g', 'defs', 'marker', 'path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'text', 'tspan', 'title', 'desc', 'symbol'])
const ATTRS = new Set(['id', 'class', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform', 'text-anchor', 'dominant-baseline', 'marker-start', 'marker-end', 'marker-mid', 'refX', 'refY', 'markerWidth', 'markerHeight', 'orient', 'preserveAspectRatio', 'stroke-dasharray', 'stroke-width', 'fill', 'stroke', 'font-size', 'font-family', 'markerUnits', 'dy', 'dx', 'font-style', 'font-weight', 'alignment-baseline', 'fill-rule', 'clip-rule'])
const RENAME = { class: 'className', 'text-anchor': 'textAnchor', 'dominant-baseline': 'dominantBaseline', 'marker-start': 'markerStart', 'marker-end': 'markerEnd', 'marker-mid': 'markerMid', 'stroke-dasharray': 'strokeDasharray', 'stroke-width': 'strokeWidth', 'font-size': 'fontSize', 'font-family': 'fontFamily' }

/* Parse as XML, never insert the compiler's SVG into the live document. */
export function mermaidSvg(svg, prefix) {
  if (typeof svg !== 'string' || svg.length > 500000) throw new Error('diagram exceeds output limit')
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('invalid diagram')
  const ids = new Map()
  let count = 0
  function collect(el) {
    if (++count > 4000) throw new Error('diagram exceeds element limit')
    if (el.localName === 'style' || el.localName === 'filter') return
    if (!TAGS.has(el.localName) || el.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('unsupported diagram element')
    const value = el.getAttribute('id')
    if (value) {
      if (!/^[\w:.-]{1,160}$/.test(value) || ids.has(value)) throw new Error('invalid diagram id')
      ids.set(value, `${prefix}-${ids.size}`)
    }
    for (const child of el.children) collect(child)
  }
  collect(root)
  function convert(el, key) {
    if (el.localName === 'style' || el.localName === 'filter') return null
    const props = { key }
    for (const attr of el.attributes) {
      const name = attr.name; let value = attr.value
      if (name === 'style' && /url\s*\(|expression\s*\(|@import|javascript:/i.test(value)) throw new Error('unsafe diagram style')
      if (name === 'xmlns' || name === 'xmlns:xlink' || name === 'style' || name.startsWith('aria-') || name === 'role' || name === 'filter' || name === 'name' || name.startsWith('data-')) continue
      if (!ATTRS.has(name) || /[<>\u0000-\u001f]/.test(value) || value.length > 50000) throw new Error('unsupported diagram attribute')
      if (name === 'id') value = ids.get(value)
      else if (name.startsWith('marker-')) {
        const match = /^url\(#([\w:.-]+)\)$/.exec(value)
        if (!match || !ids.has(match[1])) throw new Error('invalid diagram reference')
        value = `url(#${ids.get(match[1])})`
      } else if (/url\s*\(|javascript:|https?:|data:/i.test(value)) throw new Error('unsafe diagram value')
      if (name === 'fill' || name === 'stroke' || name === 'font-family' || name === 'font-size') continue
      props[RENAME[name] || name] = value
    }
    if (el === root) { props.role = 'img'; props['aria-labelledby'] = `${prefix}-title ${prefix}-description`; const width = Number((el.getAttribute('viewBox') || '').trim().split(/\s+/)[2]); if (!Number.isFinite(width) || width <= 0 || width > 20000) throw new Error('invalid diagram size'); props.width = width; const height = Number((el.getAttribute('viewBox') || '').trim().split(/\s+/)[3]); if (!Number.isFinite(height) || height <= 0 || height > 20000) throw new Error('invalid diagram size'); props.height = height }
    const children = Array.from(el.childNodes).map((child, index) => child.nodeType === 3 ? child.nodeValue : child.nodeType === 1 ? convert(child, index) : null)
    if (el === root) children.unshift(React.createElement('title', { key: 'title', id: `${prefix}-title` }, 'mermaid diagram'), React.createElement('desc', { key: 'description', id: `${prefix}-description` }, 'Diagram generated from the source. Use view source to read the original text.'))
    return React.createElement(el.localName, props, ...children)
  }
  return convert(root, 0)
}

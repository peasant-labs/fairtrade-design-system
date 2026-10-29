import { cloneElement, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { safeMermaidSource, safeMermaidModel } from './mermaidSource.js'
import { mermaidSvg } from './mermaidSvg.jsx'

let serial = 0
let renderQueue = Promise.resolve()
let pending = 0
const MAX_PENDING = 16

export default function MermaidBlock({ source }) {
  const host = useRef(null)
  const stage = useRef(null)
  const [view, setView] = useState('source')
  const [diagram, setDiagram] = useState(null)
  const [status, setStatus] = useState('')
  const [copied, setCopied] = useState(false)
  const safe = safeMermaidSource(source)
  useEffect(() => {
    if (view !== 'diagram') return
    if (!safe) { setView('source'); setStatus('diagram syntax not supported; showing source'); return }
    if (pending >= MAX_PENDING) {
      setView('source')
      setStatus('too many diagrams waiting; try again')
      return
    }
    let active = true
    pending++
    setStatus('loading diagram')
    const run = async () => {
      const element = host.current
      if (!active || !element) return
      const { fontFamily, fontSize } = getComputedStyle(element)
      const { default: mermaid } = await import('mermaid')
      if (!active || !element.isConnected) return
      // Load only faces needed by this diagram, not unrelated document fonts.
      // A failed optional face uses the same fallback stack in layout and SVG.
      let fontTimeout
      try {
        await Promise.race([
          document.fonts.load(`${fontSize} ${fontFamily}`, source).catch(() => {}),
          new Promise((_, reject) => { fontTimeout = setTimeout(() => reject(new Error('diagram font load timed out')), 5000) }),
        ])
      } finally { clearTimeout(fontTimeout) }
      if (!active || !element.isConnected) return
      mermaid.initialize({ startOnLoad: false, logLevel: 'fatal', securityLevel: 'strict', suppressErrorRendering: true, htmlLabels: false, themeVariables: { fontSize, fontFamily }, flowchart: { htmlLabels: false }, sequence: { useMaxWidth: false }, journey: { textPlacement: 'tspan' }, fontFamily, maxTextSize: 8192 })
      const parsed = await mermaid.mermaidAPI.getDiagramFromText(source)
      if (!safeMermaidModel(parsed)) throw new Error('diagram contains unsupported active content')
      const id = `ftmermaid${++serial}`
      const result = await mermaid.render(id, source)
      return mermaidSvg(result.svg, id)
    }
    const current = renderQueue.then(run, run).finally(() => { pending-- })
    renderQueue = current.catch(() => {})
    current.then(value => { if (active && value) { setDiagram({ source, value }); setStatus('') } }, () => { if (active) { setView('source'); setStatus('diagram unavailable; showing source') } })
    return () => { active = false }
  }, [safe, source, view])
  useLayoutEffect(() => {
    const svg = stage.current?.querySelector('svg')
    if (!svg || diagram?.source !== source) return
    // Measure the sanitized, styled SVG after its actual host font loaded.
    // Preserve Mermaid's own viewport (including marker clearance) and extend
    // it only when rendered ink escapes; physical size stays one CSS pixel per unit.
    const box = svg.viewBox.baseVal
    let x = box.x, y = box.y, right = box.x + box.width, bottom = box.y + box.height
    const rootMatrix = svg.getCTM()?.inverse()
    if (!rootMatrix) return
    // Text metrics can change with the host font. Keep the compiler's geometry
    // and marker clearance: gantt intentionally draws its today line off-canvas.
    for (const element of svg.querySelectorAll('text, .node')) {
      const matrix = element.getCTM()
      if (!matrix) continue
      const transform = rootMatrix.multiply(matrix), ink = element.getBBox()
      const stroke = element.matches('.node') ? Math.max(0, ...[...element.querySelectorAll('rect, polygon, circle, ellipse')].map(shape => parseFloat(getComputedStyle(shape).strokeWidth) || 0)) / 2 : 0
      for (const tx of [ink.x - stroke, ink.x + ink.width + stroke]) for (const ty of [ink.y - stroke, ink.y + ink.height + stroke]) {
        const point = new DOMPoint(tx, ty).matrixTransform(transform)
        x = Math.min(x, point.x); y = Math.min(y, point.y)
        right = Math.max(right, point.x); bottom = Math.max(bottom, point.y)
      }
    }
    const width = right - x, height = bottom - y
    if (![x, y, width, height].every(Number.isFinite) || width > 20000 || height > 20000) {
      setView('source'); setStatus('diagram unavailable; showing source'); return
    }
    // SVGAnimatedRect stores float32 values; ignore subpixel round-trip noise.
    if (x < box.x - 0.01 || y < box.y - 0.01 || width > box.width + 0.01 || height > box.height + 0.01) {
      setDiagram({ source, value: cloneElement(diagram.value, { viewBox: `${x} ${y} ${width} ${height}`, width, height }) })
    }
  }, [diagram, source, view])
  const showDiagram = () => {
    if (!safe) { setStatus('diagram syntax not supported; showing source'); return }
    setView('diagram')
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(source); setCopied(true) } catch { setStatus('copy unavailable; select the source to copy') }
  }
  return <section className="txn-mermaid" ref={host}>
    <div className="txn-mermaid-toolbar"><span>mermaid / diagram</span><div>
      <button type="button" onClick={() => { setView('source'); setStatus('') }} aria-pressed={view === 'source'}>view source</button>
      <button type="button" onClick={showDiagram} aria-pressed={view === 'diagram'}>view diagram</button>
      <button type="button" onClick={copy}>{copied ? 'copied' : 'copy source'}</button>
    </div></div>
    {view === 'diagram' && safe && diagram?.source === source ? <div className="txn-mermaid-stage" ref={stage} role="region" aria-label="diagram" tabIndex={0}>{diagram.value}</div> : <pre className="txn-mermaid-source"><code>{source}</code></pre>}
    {status && <p role="status">{status}</p>}
  </section>
}

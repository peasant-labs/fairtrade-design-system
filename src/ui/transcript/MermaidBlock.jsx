import { useEffect, useState } from 'react'
import { canonicalMermaid } from './mermaidSource.js'
import { mermaidSvg } from './mermaidSvg.jsx'

let serial = 0
let renderQueue = Promise.resolve()
let pending = 0
const MAX_PENDING = 16

export default function MermaidBlock({ source }) {
  const [view, setView] = useState('source')
  const [diagram, setDiagram] = useState(null)
  const [status, setStatus] = useState('')
  const [copied, setCopied] = useState(false)
  const canonical = canonicalMermaid(source)
  useEffect(() => {
    if (view !== 'diagram' || !canonical) return
    if (pending >= MAX_PENDING) {
      setView('source')
      setStatus('too many diagrams waiting; try again')
      return
    }
    let active = true
    pending++
    setStatus('loading diagram')
    const run = async () => {
      const { default: mermaid } = await import('mermaid')
      mermaid.initialize({ startOnLoad: false, logLevel: 'fatal', securityLevel: 'strict', suppressErrorRendering: true, htmlLabels: false, themeVariables: { fontSize: '16px' }, flowchart: { htmlLabels: false }, sequence: { useMaxWidth: false }, fontFamily: 'Atkinson Hyperlegible', maxTextSize: 8192 })
      const id = `ftmermaid${++serial}`
      const result = await mermaid.render(id, canonical)
      return mermaidSvg(result.svg, id)
    }
    const current = renderQueue.then(run, run).finally(() => { pending-- })
    renderQueue = current.catch(() => {})
    current.then(value => { if (active) { setDiagram(value); setStatus('') } }, () => { if (active) { setView('source'); setStatus('diagram unavailable; showing source') } })
    return () => { active = false }
  }, [canonical, view])
  const showDiagram = () => {
    if (!canonical) { setStatus('diagram syntax not supported; showing source'); return }
    setView('diagram')
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(source); setCopied(true) } catch { setStatus('copy unavailable; select the source to copy') }
  }
  return <section className="txn-mermaid">
    <div className="txn-mermaid-toolbar"><span>mermaid / {canonical?.startsWith('sequenceDiagram') ? 'sequence' : 'flowchart'}</span><div>
      <button type="button" onClick={() => { setView('source'); setStatus('') }} aria-pressed={view === 'source'}>view source</button>
      <button type="button" onClick={showDiagram} aria-pressed={view === 'diagram'}>view diagram</button>
      <button type="button" onClick={copy}>{copied ? 'copied' : 'copy source'}</button>
    </div></div>
    {view === 'diagram' && diagram ? <div className="txn-mermaid-stage" role="region" aria-label="diagram" tabIndex={0}>{diagram}</div> : <pre className="txn-mermaid-source"><code>{source}</code></pre>}
    {status && <p role="status">{status}</p>}
  </section>
}

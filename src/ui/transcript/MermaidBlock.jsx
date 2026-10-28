import { useEffect, useState } from 'react'
import { safeMermaidSource, safeMermaidModel } from './mermaidSource.js'
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
      const { default: mermaid } = await import('mermaid')
      mermaid.initialize({ startOnLoad: false, logLevel: 'fatal', securityLevel: 'strict', suppressErrorRendering: true, htmlLabels: false, themeVariables: { fontSize: '16px' }, flowchart: { htmlLabels: false }, sequence: { useMaxWidth: false }, journey: { textPlacement: 'tspan' }, fontFamily: 'Atkinson Hyperlegible', maxTextSize: 8192 })
      const parsed = await mermaid.mermaidAPI.getDiagramFromText(source)
      if (!safeMermaidModel(parsed)) throw new Error('diagram contains unsupported active content')
      const id = `ftmermaid${++serial}`
      const result = await mermaid.render(id, source)
      return mermaidSvg(result.svg, id)
    }
    const current = renderQueue.then(run, run).finally(() => { pending-- })
    renderQueue = current.catch(() => {})
    current.then(value => { if (active) { setDiagram({ source, value }); setStatus('') } }, () => { if (active) { setView('source'); setStatus('diagram unavailable; showing source') } })
    return () => { active = false }
  }, [safe, source, view])
  const showDiagram = () => {
    if (!safe) { setStatus('diagram syntax not supported; showing source'); return }
    setView('diagram')
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(source); setCopied(true) } catch { setStatus('copy unavailable; select the source to copy') }
  }
  return <section className="txn-mermaid">
    <div className="txn-mermaid-toolbar"><span>mermaid / diagram</span><div>
      <button type="button" onClick={() => { setView('source'); setStatus('') }} aria-pressed={view === 'source'}>view source</button>
      <button type="button" onClick={showDiagram} aria-pressed={view === 'diagram'}>view diagram</button>
      <button type="button" onClick={copy}>{copied ? 'copied' : 'copy source'}</button>
    </div></div>
    {view === 'diagram' && safe && diagram?.source === source ? <div className="txn-mermaid-stage" role="region" aria-label="diagram" tabIndex={0}>{diagram.value}</div> : <pre className="txn-mermaid-source"><code>{source}</code></pre>}
    {status && <p role="status">{status}</p>}
  </section>
}

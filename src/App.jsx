import { useEffect, useRef, useState } from 'react'
import {
  MessageSquarePlus,
  MessagesSquare,
  X,
  Crosshair,
  Clipboard,
  Download,
  Trash2,
  Check,
  Eye,
  Clock,
  GitBranch,
  BadgeCheck,
  Users,
  User,
  FileText,
  Link2,
} from 'lucide-react'
import galleryHtml from './gallery.html?raw'
import { AsciiArt, Halftone, GlyphField, drawMoon, drawWaves } from './effects.jsx'

const [GAL_TOP, GAL_REST] = galleryHtml.split('<!--HERO-->')
const [GAL_MID, GAL_BOTTOM] = GAL_REST.split('<!--CARDS-->')
const KEY = 'pds_feedback_v1'
const isHttp = /^https?:$/.test(location.protocol)
const fbOff = /[?&]fb=off/.test(location.search)

/* ---- target description helpers (same logic the static tool used) ---- */
function selectorFor(el) {
  if (el.id) return '#' + el.id
  const parts = []
  let node = el,
    guard = 0
  while (node && node.nodeType === 1 && node !== document.body && guard++ < 6) {
    let part = node.tagName.toLowerCase()
    if (node.classList.length) part += '.' + Array.prototype.slice.call(node.classList, 0, 3).join('.')
    const parent = node.parentElement
    if (parent) {
      const same = Array.prototype.filter.call(parent.children, (c) => c.tagName === node.tagName)
      if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')'
    }
    parts.unshift(part)
    if (node.id) {
      parts[0] = '#' + node.id
      break
    }
    node = parent
  }
  return parts.join(' > ')
}
function sectionOf(el) {
  let p = el
  while (p && p !== document.body) {
    if (p.matches && p.matches('section.band')) {
      const l = p.querySelector(':scope > .label')
      return l ? l.textContent.trim() : ''
    }
    if (p.matches && p.matches('.group')) {
      const h = p.querySelector('h2')
      return h ? h.textContent.trim() : ''
    }
    p = p.parentElement
  }
  return ''
}
function describe(el) {
  const cls = el.classList.length ? '.' + Array.prototype.join.call(el.classList, '.') : ''
  return {
    selector: selectorFor(el),
    label: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls,
    section: sectionOf(el),
    text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70),
  }
}
function mdOf(e) {
  let s = '## ' + (e.section || 'page') + '  (' + e.ts + ', ' + e.theme + ')\n'
  s += '**target:** `' + e.selector + '`\n'
  if (e.text) s += '**text:** ' + e.text + '\n'
  s += '**comment:** ' + e.comment + '\n\n---\n'
  return s
}
function stamp() {
  const d = new Date(),
    p = (n) => (n < 10 ? '0' : '') + n
  return (
    d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
  )
}

/* hero with the imagery baked into the identity: ascii focal art, halftone
   amber inset, glyph-grid texture behind. (kept effects from the references) */
function Hero({ theme }) {
  return (
    <section className="hero hero-fx">
      <div className="hero-bg" aria-hidden="true"><GlyphField rows={11} repeat={46} /></div>
      <div className="hero-main">
        <div className="hero-copy">
          <span className="label">// a commons for redacted agent transcripts</span>
          <h1>receipts for <span className="hl">agentic work</span>, kept low to the ground.</h1>
          <p>ingest your sessions locally, redact them, and share what's worth sharing. browse the commons, gather into collectives, attest to what mattered.</p>
          <div className="btn-row">
            <button className="btn btn-primary">explore the commons</button>
            <button className="btn btn-secondary">publish a transcript</button>
          </div>
        </div>
        <div className="hero-art framed">
          <AsciiArt cols={96} aspect={0.62} className="hero-ascii" />
          <div className="hero-inset framed"><Halftone cols={26} accent theme={theme} /></div>
        </div>
      </div>
    </section>
  )
}

/* provider brand marks (svg symbols live in the gallery blob, document-global) */
const Claude = () => (<span className="g-claude"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-claude" /></svg></span>)
const Gemini = () => (<span className="g-gemini"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-gemini" /></svg></span>)

/* cards & rows, ref-01 style: ascii/halftone thumbnail on top + '>' bullet metadata */
function Cards({ theme }) {
  return (
    <section className="band">
      <span className="label">cards &amp; rows</span>
      <div className="sub">list and grid surfaces, imagery on top</div>
      <div className="grid-cards">
        <a className="card card-img">
          <div className="card-thumb"><AsciiArt draw={drawMoon} cols={112} aspect={0.46} className="thumb-ascii" /></div>
          <div className="card-body">
            <div className="card-head"><span className="metaitem"><Claude /> claude-code</span><Eye size={14} style={{ color: 'var(--ink-3)' }} /></div>
            <h3>refactor ingest pipeline to stream</h3>
            <p className="desc">converted the eager loader into a channel-backed stream so sessions process at constant memory.</p>
            <ul className="bullets">
              <li>streaming reader, constant memory</li>
              <li>race detector green</li>
            </ul>
            <div className="card-foot"><span className="avatar">v</span><span className="metaitem"><Clock /> <b className="tnum">2h 14m</b></span><span className="metaitem"><GitBranch /> <b className="tnum">18</b></span><span className="metaitem"><BadgeCheck /> <b className="tnum">3</b></span></div>
          </div>
        </a>
        <a className="card card-img">
          <div className="card-thumb"><Halftone draw={drawWaves} cols={58} accent theme={theme} /></div>
          <div className="card-body">
            <div className="card-head"><span className="metaitem"><Users /> desert-archivists</span></div>
            <h3>desert archivists</h3>
            <p className="desc">a shared shelf for redacted transcripts about data pipelines and ingestion.</p>
            <ul className="bullets">
              <li>verified-only acceptance</li>
              <li>redaction review required</li>
            </ul>
            <div className="card-foot"><span className="metaitem"><User /> <b className="tnum">24</b> members</span><span className="metaitem"><FileText /> <b className="tnum">118</b> transcripts</span><span className="metaitem"><Link2 /> linked</span></div>
          </div>
        </a>
      </div>
      <div>
        <div className="row"><span className="metaitem"><Claude /> claude-code</span><span className="grow mono">add fts5 search index</span><span className="metaitem mono">2026-06-12</span><span className="metaitem"><Clock /> 41m</span><span className="avatar">v</span></div>
        <div className="row"><span className="metaitem"><Gemini /> gemini-cli</span><span className="grow mono">tune redaction rules</span><span className="metaitem mono">2026-06-11</span><span className="metaitem"><Clock /> 1h 03m</span><span className="avatar">a</span></div>
      </div>
    </section>
  )
}

export default function App() {
  /* theme (toggled by the gallery's .theme-btn via click delegation) */
  const [theme, setTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  )
  useEffect(() => {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
  }, [theme])

  /* paint the gallery's lucide icons (UMD loaded in index.html) once mounted */
  useEffect(() => {
    let n = 0
    const t = setInterval(() => {
      if (window.lucide) {
        window.lucide.createIcons()
        clearInterval(t)
      } else if (++n > 60) clearInterval(t)
    }, 40)
    return () => clearInterval(t)
  }, [])

  /* feedback state */
  const [entries, setEntries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || []
    } catch {
      return []
    }
  })
  const [panelOpen, setPanelOpen] = useState(false)
  const [armed, setArmed] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [targetDesc, setTargetDesc] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const targetRef = useRef(null)
  const hiRef = useRef(null)
  const tagRef = useRef(null)
  const taRef = useRef(null)
  const toastTimer = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(entries))
    } catch {}
  }, [entries])

  function toast(m) {
    setToastMsg(m)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 2800)
  }

  function galleryClick(e) {
    if (e.target.closest && e.target.closest('.theme-btn')) setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  /* annotate mode: document listeners live only while armed */
  useEffect(() => {
    if (!armed) return
    document.body.classList.add('fbk-arming')
    // skip structural wrappers / anything covering (nearly) the whole viewport
    const badTarget = (el) => {
      if (!el || el.nodeType !== 1) return true
      const t = el.tagName
      if (t === 'HTML' || t === 'BODY' || el.id === 'root') return true
      if (el.classList && el.classList.contains('pds-root')) return true
      const r = el.getBoundingClientRect()
      return r.width >= innerWidth * 0.97 && r.height >= innerHeight * 0.92
    }
    const onMove = (e) => {
      const el = e.target
      if (!el || (el.closest && el.closest('[data-fb]')) || badTarget(el)) {
        if (hiRef.current) hiRef.current.classList.remove('on')
        if (tagRef.current) tagRef.current.style.display = 'none'
        return
      }
      const r = el.getBoundingClientRect()
      const hi = hiRef.current,
        tag = tagRef.current
      if (hi) {
        hi.style.left = r.left + 'px'
        hi.style.top = r.top + 'px'
        hi.style.width = r.width + 'px'
        hi.style.height = r.height + 'px'
        hi.classList.add('on')
      }
      const d = describe(el)
      if (tag) {
        tag.textContent = (d.section ? d.section + ' / ' : '') + d.label
        tag.style.left = r.left + 'px'
        tag.style.top = Math.max(2, r.top - 19) + 'px'
        tag.style.display = 'block'
      }
    }
    const onClick = (e) => {
      if ((e.target.closest && e.target.closest('[data-fb]')) || badTarget(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      targetRef.current = e.target
      const d = describe(e.target)
      setTargetDesc((d.section ? d.section + '  ' : '') + d.selector)
      setArmed(false)
      setComposeOpen(true)
      setTimeout(() => taRef.current && taRef.current.focus(), 30)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setArmed(false)
    }
    const onScroll = () => {
      if (hiRef.current) hiRef.current.classList.remove('on')
      if (tagRef.current) tagRef.current.style.display = 'none'
    }
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.body.classList.remove('fbk-arming')
      if (hiRef.current) hiRef.current.classList.remove('on')
      if (tagRef.current) tagRef.current.style.display = 'none'
      document.removeEventListener('mousemove', onMove, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [armed])

  function toggleAnnotate() {
    setPanelOpen(false)
    setArmed((a) => !a)
  }

  function saveComment() {
    const v = (taRef.current?.value || '').trim()
    if (!v) {
      taRef.current && taRef.current.focus()
      return
    }
    const el = targetRef.current
    if (!el) {
      setComposeOpen(false)
      return
    }
    const d = describe(el)
    const entry = { selector: d.selector, section: d.section, text: d.text, comment: v, theme, ts: stamp() }
    setEntries((prev) => [...prev, entry])
    if (isHttp) {
      fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: mdOf(entry) }),
      })
        .then((r) => {
          if (r && r.ok) toast('saved to feedback.md')
          else throw 0
        })
        .catch(() => toast('saved locally; server not writing - use copy md'))
    } else {
      toast('saved locally - use copy md or .md to write feedback.md')
    }
    setComposeOpen(false)
    targetRef.current = null
    setArmed(true) // keep selecting for the next element
  }
  function cancelCompose() {
    setComposeOpen(false)
    targetRef.current = null
  }

  function copyMd() {
    if (!entries.length) return toast('nothing to copy')
    const md = '# feedback\n\n' + entries.map(mdOf).join('\n')
    if (navigator.clipboard)
      navigator.clipboard.writeText(md).then(
        () => toast('copied ' + entries.length + ' to clipboard'),
        () => toast('copy failed')
      )
    else toast('clipboard unavailable - use .md')
  }
  function downloadMd() {
    if (!entries.length) return toast('nothing to save')
    const md = '# feedback\n\n' + entries.map(mdOf).join('\n')
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'feedback.md'
    a.click()
    URL.revokeObjectURL(url)
    toast('downloaded feedback.md - move it into the repo folder')
  }
  function clearAll() {
    if (confirm('clear all local feedback?')) {
      setEntries([])
      toast('cleared')
    }
  }
  function removeAt(i) {
    setEntries((prev) => prev.filter((_, j) => j !== i))
  }
  function locate(i) {
    const e = entries[i]
    let el = null
    try {
      el = document.querySelector(e.selector)
    } catch {}
    if (el) {
      setPanelOpen(false)
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('fbk-flash')
      setTimeout(() => el.classList.remove('fbk-flash'), 1400)
    } else toast('could not find that element now')
  }

  return (
    <>
      <div className="pds-root" onClick={galleryClick}>
        <div dangerouslySetInnerHTML={{ __html: GAL_TOP }} />
        <Hero theme={theme} />
        <div dangerouslySetInnerHTML={{ __html: GAL_MID }} />
        <Cards theme={theme} />
        <div dangerouslySetInnerHTML={{ __html: GAL_BOTTOM }} />
        <footer className="foot"><div className="foot-in"><svg className="logo" width="15" height="15" viewBox="0 0 32 32"><use href="#logo" /></svg> <b>peasant design system</b> <span className="right"><span>one identity, three apps</span> <a href="https://github.com/peasant-labs/peasant-design-system">github</a></span></div></footer>
      </div>

      {!fbOff && (
        <>
          <div className="fbk-dock" data-fb>
            <button className="fbk-list-btn" data-fb aria-label="feedback list" onClick={() => setPanelOpen((o) => !o)}>
              <MessagesSquare /> <span className="cnt">{entries.length}</span>
            </button>
            <button
              className={'fbk-launch' + (armed ? ' armed' : '')}
              data-fb
              aria-label={armed ? 'stop selecting' : 'select an element to comment on'}
              onClick={toggleAnnotate}
            >
              {armed ? (
                <><Crosshair /> selecting <span className="cnt">esc</span></>
              ) : (
                <><MessageSquarePlus /> feedback</>
              )}
            </button>
          </div>

          <div ref={hiRef} className="fbk-hi" data-fb />
          <div ref={tagRef} className="fbk-tag" data-fb />

          <aside className={'fbk-panel' + (panelOpen ? ' open' : '')} data-fb>
            <div className="fbk-ph">
              <span>
                <MessagesSquare /> feedback
              </span>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                data-fb
                aria-label="close"
                onClick={() => {
                  setPanelOpen(false)
                  setArmed(false)
                }}
              >
                <X />
              </button>
            </div>
            <div className="fbk-status" data-fb>
              <span className="dot" style={{ background: isHttp ? 'var(--olive)' : 'var(--amber)' }} />
              {isHttp
                ? 'local server on - comments auto-save to feedback.md'
                : 'file:// mode - use copy md or .md, then paste into feedback.md'}
            </div>
            <div className="fbk-actions" data-fb>
              <button className="btn btn-secondary btn-sm" data-fb onClick={copyMd}>
                <Clipboard /> copy md
              </button>
              <button className="btn btn-secondary btn-sm" data-fb onClick={downloadMd}>
                <Download /> .md
              </button>
              <button className="btn btn-ghost btn-sm" data-fb onClick={clearAll}>
                <Trash2 /> clear
              </button>
            </div>
            <div className="fbk-list" data-fb>
              {entries.length === 0 ? (
                <div className="fbk-empty">no feedback yet. click "feedback" (bottom-right), then click any element.</div>
              ) : (
                entries.map((e, i) => (
                  <div className="fbk-item" data-fb key={i}>
                    <div className="sc">{e.section || 'page'}</div>
                    <div className="tg">{e.selector}</div>
                    <div className="cm">{e.comment}</div>
                    <div className="ix">
                      <button data-fb onClick={() => locate(i)}>
                        locate
                      </button>
                      <button data-fb onClick={() => removeAt(i)}>
                        remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          <div className={'fbk-compose' + (composeOpen ? ' open' : '')} data-fb>
            <div className="fbk-ch" data-fb>
              <Crosshair /> new feedback
            </div>
            <div className="fbk-cb" data-fb>
              <div className="fbk-target" data-fb>
                {targetDesc}
              </div>
              <textarea
                ref={taRef}
                className="input"
                data-fb
                rows={3}
                placeholder="what should change here?"
                onKeyDown={(ev) => {
                  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
                    ev.preventDefault()
                    saveComment()
                  } else if (ev.key === 'Escape') {
                    cancelCompose()
                  }
                }}
              />
            </div>
            <div className="fbk-cf" data-fb>
              <button className="btn btn-ghost btn-sm" data-fb onClick={cancelCompose}>
                cancel
              </button>
              <button className="btn btn-primary btn-sm" data-fb onClick={saveComment}>
                <Check /> save
              </button>
            </div>
          </div>

          {toastMsg && (
            <div className="fbk-toast show" data-fb>
              {toastMsg}
            </div>
          )}
        </>
      )}
    </>
  )
}

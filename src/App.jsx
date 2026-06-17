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
import { AsciiImage, AsciiVideo } from './effects.jsx'
/* imagery: a runtime-sampled ascii video of the wheat in the hero (src/assets/wheat.mp4);
   classic chiaroscuro peasant portraits (lit subject on a dark ground) rendered through
   the image->ascii filter on the cards, like the inspiration reference */
import wheatVid from './assets/wheat.mp4'
import peasantWoman from './img/peasant-woman.jpg'
import peasantMan from './img/peasant-man.jpg'

/* the page is composed from per-section html partials (src/sections, injected as raw
   markup) interleaved with the few react sections that need the imagery effects. each
   partial owns one section so it can be edited in isolation. */
import defsHtml from './sections/00-defs.html?raw'
import navHtml from './sections/01-nav.html?raw'
import startHtml from './sections/10-start.html?raw'
import groupFoundationsHtml from './sections/15-group-foundations.html?raw'
import principlesHtml from './sections/20-principles.html?raw'
import voiceHtml from './sections/22-voice.html?raw'
import colorHtml from './sections/24-color.html?raw'
import typeHtml from './sections/26-type.html?raw'
import spacingHtml from './sections/28-spacing.html?raw'
import iconsHtml from './sections/30-icons.html?raw'
import motionHtml from './sections/32-motion.html?raw'
import controlsHtml from './sections/34-controls.html?raw'
import groupComponentsHtml from './sections/40-group-components.html?raw'
import badgesHtml from './sections/42-badges.html?raw'
import trailsHtml from './sections/44-trails.html?raw'
import conversationHtml from './sections/48-conversation.html?raw'
import canvasHtml from './sections/50-canvas.html?raw'
import formsHtml from './sections/52-forms.html?raw'
import groupUsingHtml from './sections/60-group-using.html?raw'
import a11yHtml from './sections/62-a11y.html?raw'
import tokensHtml from './sections/64-tokens.html?raw'
import resourcesHtml from './sections/66-resources.html?raw'

const KEY = 'pds_feedback_v1'
const isHttp = /^https?:$/.test(location.protocol)
const fbOff = /[?&]fb=off/.test(location.search)

/* on-this-page rail / scroll-spy model. ids match the section[id] in the partials and
   the react sections; group rows anchor to the group openers and drive the nav active
   state. */
const RAIL = [
  { kind: 'link', id: 'start', label: 'start here' },
  { kind: 'group', id: 'foundations', label: 'foundations' },
  { kind: 'link', id: 'principles', label: 'principles' },
  { kind: 'link', id: 'voice', label: 'voice' },
  { kind: 'link', id: 'color', label: 'color' },
  { kind: 'link', id: 'typography', label: 'typography' },
  { kind: 'link', id: 'spacing', label: 'spacing & layout' },
  { kind: 'link', id: 'icons', label: 'iconography' },
  { kind: 'link', id: 'motion', label: 'motion' },
  { kind: 'link', id: 'controls', label: 'controls' },
  { kind: 'group', id: 'components', label: 'components' },
  { kind: 'link', id: 'badges', label: 'badges & states' },
  { kind: 'link', id: 'trails', label: 'trails & tabs' },
  { kind: 'link', id: 'cards', label: 'cards & rows' },
  { kind: 'link', id: 'conversation', label: 'conversation' },
  { kind: 'link', id: 'canvas', label: 'canvas & dialog' },
  { kind: 'link', id: 'forms', label: 'forms & empty' },
  { kind: 'group', id: 'using', label: 'using the system' },
  { kind: 'link', id: 'a11y', label: 'accessibility' },
  { kind: 'link', id: 'tokens', label: 'tokens' },
  { kind: 'link', id: 'resources', label: 'resources' },
]
/* id -> owning group id (null before the first group, i.e. the intro on-ramp) */
const GROUP_OF = (() => {
  const m = {}
  let g = null
  for (const r of RAIL) {
    if (r.kind === 'group') g = r.id
    m[r.id] = g
  }
  return m
})()

/* ---- target description helpers (same logic the static feedback tool used) ---- */
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

/* a raw-html partial dropped transparently into the flow (display:contents wrapper) */
const Raw = ({ html }) => <div className="contents" dangerouslySetInnerHTML={{ __html: html }} />

/* section 1 — full-screen brand splash: the wheat video sampled to ascii + the wordmark */
function Hero() {
  return (
    <section className="hero framed" id="top">
      <AsciiVideo src={wheatVid} cols={300} boost={2.05} contrast={1.5} fps={24} smooth={6} waveAmp={0} className="hero-video" />
      <div className="hero-brand"><span className="hero-brand-word">fairtrade</span></div>
      <a className="hero-scroll" href="#intro" aria-label="scroll">scroll</a>
    </section>
  )
}

/* section 2 — the value proposition */
function Intro() {
  return (
    <section className="intro" id="intro">
      <div className="intro-in">
        <h1>receipts for <span className="hl">agentic work</span>,<br />kept low to the ground.</h1>
        <p>ingest your sessions locally, redact them, and share what's worth sharing.</p>
        <div className="btn-row">
          <button className="btn btn-primary">explore the commons</button>
          <button className="btn btn-secondary">publish a transcript</button>
        </div>
      </div>
    </section>
  )
}

/* the sticky on-this-page rail (left of the content column on wide viewports) */
function Rail({ active }) {
  return (
    <nav className="page-rail" aria-label="on this page">
      <div className="rail-head">on this page</div>
      <ul className="rail-list">
        {RAIL.map((r) =>
          r.kind === 'group' ? (
            <li key={r.id} className="rail-group">
              <a href={'#' + r.id}>{r.label}</a>
            </li>
          ) : (
            <li key={r.id}>
              <a
                className={'rail-link' + (active === r.id ? ' active' : '')}
                href={'#' + r.id}
                aria-current={active === r.id ? 'true' : undefined}
              >
                {r.label}
              </a>
            </li>
          )
        )}
      </ul>
    </nav>
  )
}

/* provider brand marks (svg symbols live in the defs partial, document-global) */
const Claude = () => (<span className="g-claude"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-claude" /></svg></span>)
const Gemini = () => (<span className="g-gemini"><svg className="brand" width="14" height="14" viewBox="0 0 24 24"><use href="#b-gemini" /></svg></span>)

/* cards & rows, ref-01 style: ascii/halftone thumbnail on top + bullet metadata */
function Cards({ theme }) {
  return (
    <section className="band" id="cards">
      <span className="label">cards &amp; rows</span>
      <div className="sub">list and grid surfaces, imagery on top</div>
      <p className="prose">cards carry a transcript or a collective at a glance: a peasant portrait rendered through the ascii filter, a title, a short summary, and tabular metadata. rows are the compact form for dense lists.</p>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
      <div className="grid-cards">
        <a className="card card-img">
          <div className="card-thumb"><AsciiImage src={peasantWoman} cols={224} aspect={0.6} isolated contrast={1.18} gamma={0.78} black={0.22} white={0.86} vignette={0.16} ink="#ece7dd" theme={theme} className="thumb-ascii" /></div>
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
          <div className="card-thumb"><AsciiImage src={peasantMan} cols={224} aspect={0.6} isolated contrast={1.12} gamma={0.74} black={0.12} white={0.6} vignette={0.16} ink="#ece7dd" theme={theme} className="thumb-ascii" /></div>
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
        </div>
      </div>
      <div className="cmp">
        <div className="cmp-card cmp-do"><div className="cmp-tag"><Check size={14} /> do</div><div className="cmp-body"><p>lead a card with one provider mark, a clear title, and tabular metrics.</p></div><div className="cmp-note">imagery sits on top, metadata stays scannable and aligned.</div></div>
        <div className="cmp-card cmp-dont"><div className="cmp-tag"><X size={14} /> don't</div><div className="cmp-body"><p>crowd the foot with more than five metrics or color-only status.</p></div><div className="cmp-note">keep to a handful of metrics; status carries an icon and a label.</div></div>
      </div>
      <div className="callout"><BadgeCheck size={16} /><div>the whole card is one target; the ascii thumbnail is decorative and the title carries the meaning; counts and durations are tabular.</div></div>
    </section>
  )
}

export default function App() {
  /* theme (toggled by the nav .theme-btn via click delegation) */
  const [theme, setTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  )
  useEffect(() => {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
  }, [theme])

  /* paint the partials' lucide icons (UMD loaded in index.html) once mounted */
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

  /* scroll-spy: track the active section for the rail + the active group for the nav */
  const [active, setActive] = useState('start')
  useEffect(() => {
    const ids = RAIL.map((r) => r.id)
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (!els.length) return
    const vis = new Map()
    const io = new IntersectionObserver(
      (ents) => {
        ents.forEach((e) => vis.set(e.target.id, e.isIntersecting))
        const firstId = ids.find((id) => vis.get(id))
        if (firstId) setActive(firstId)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const grp = GROUP_OF[active]
    document.querySelectorAll('.nav-links a[data-spy]').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-spy') === grp)
    })
  }, [active])

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

  /* delegated clicks inside the page: theme toggle + copy-token affordances */
  function rootClick(e) {
    const t = e.target
    if (t.closest && t.closest('.theme-btn')) {
      setTheme((x) => (x === 'light' ? 'dark' : 'light'))
      return
    }
    const copy = t.closest && t.closest('[data-copy]')
    if (copy) {
      const v = copy.getAttribute('data-copy')
      if (navigator.clipboard) navigator.clipboard.writeText(v).catch(() => {})
      copy.classList.add('copied')
      setTimeout(() => copy.classList.remove('copied'), 1200)
      toast('copied ' + v)
    }
  }

  /* annotate mode: document listeners live only while armed */
  useEffect(() => {
    if (!armed) return
    document.body.classList.add('fbk-arming')
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
    setArmed(true)
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

  /* scroll-reveal: fade/lift each section in as it enters the viewport */
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const targets = Array.from(document.querySelectorAll('.intro, .band, .group, .card-img'))
    targets.forEach((t) => t.classList.add('reveal'))
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) } }),
      { threshold: 0.06, rootMargin: '0px 0px -6% 0px' }
    )
    targets.forEach((t) => io.observe(t))
    return () => io.disconnect()
  }, [])

  return (
    <>
      <div className="pds-root" onClick={rootClick}>
        <Raw html={defsHtml} />
        <Raw html={navHtml} />
        <Hero />
        <Intro />
        <div className="docs">
          <Rail active={active} />
          <main className="docs-main">
            <Raw html={startHtml} />
            <Raw html={groupFoundationsHtml} />
            <Raw html={principlesHtml} />
            <Raw html={voiceHtml} />
            <Raw html={colorHtml} />
            <Raw html={typeHtml} />
            <Raw html={spacingHtml} />
            <Raw html={iconsHtml} />
            <Raw html={motionHtml} />
            <Raw html={controlsHtml} />
            <Raw html={groupComponentsHtml} />
            <Raw html={badgesHtml} />
            <Raw html={trailsHtml} />
            <Cards theme={theme} />
            <Raw html={conversationHtml} />
            <Raw html={canvasHtml} />
            <Raw html={formsHtml} />
            <Raw html={groupUsingHtml} />
            <Raw html={a11yHtml} />
            <Raw html={tokensHtml} />
            <Raw html={resourcesHtml} />
          </main>
        </div>
        <footer className="foot"><div className="foot-in"><svg className="logo" width="15" height="15" viewBox="0 0 32 32"><use href="#logo" /></svg> <b>fairtrade design system</b> <span className="right"><span>one identity, three apps</span> <a href="https://github.com/peasant-labs/peasant-design-system">github</a></span></div></footer>
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

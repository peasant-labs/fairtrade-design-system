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
import { AsciiImage, AsciiRoots, AsciiSoil, AsciiSoilField, AsciiVideo } from './effects.jsx'
import CommandPalette from './CommandPalette.jsx'
import Dialog from './Dialog.jsx'
import InUseShell from './mockups/inuse/InUseShell.jsx'
import { DataTableSection, PaginationSection, AccordionSection, TimelineSection, ToastSection, DateRangeSection } from './ComponentSections.jsx'
import { GroupOpener, StartSection, MotionSection, PrinciplesSection, VoiceSection, ResourcesSection } from './DocSections.jsx'
/* imagery: a runtime-sampled ascii video of the wheat in the hero (src/assets/wheat.mp4);
   classic chiaroscuro peasant portraits (lit subject on a dark ground) rendered through
   the image->ascii filter on the cards, like the inspiration reference */
import wheatVid from './assets/wheat.mp4'
import peasantWoman from './img/peasant-woman.jpg'
import peasantMan from './img/peasant-man.jpg'

/* the page renders from per-section components (roadmap #1): one file per section under
   src/sections-react, mirroring the old partial names, interleaved with the react sections
   that need the imagery effects. each file owns one section so it can be edited in isolation. */
import { Defs } from './sections-react/00-defs.jsx'
import { NavBar } from './sections-react/01-nav.jsx'
import { ColorSection } from './sections-react/24-color.jsx'
import { TypographySection } from './sections-react/26-type.jsx'
import { SpacingSection } from './sections-react/28-spacing.jsx'
import { IconsSection } from './sections-react/30-icons.jsx'
import { ControlsSection } from './sections-react/34-controls.jsx'
import { StatesSection } from './sections-react/36-states.jsx'
import { BadgesSection } from './sections-react/42-badges.jsx'
import { ConversationSection } from './sections-react/48-conversation.jsx'
import { CanvasSection } from './sections-react/50-canvas.jsx'
import { FormsSection } from './sections-react/52-forms.jsx'
import { A11ySection } from './sections-react/62-a11y.jsx'
import { TokensSection } from './sections-react/64-tokens.jsx'
import { TrailsSection } from './sections-react/44-trails.jsx'
import { OverlaysSection } from './sections-react/54-overlays.jsx'

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
  { kind: 'link', id: 'states', label: 'states' },
  { kind: 'group', id: 'components', label: 'components' },
  { kind: 'link', id: 'badges', label: 'badges & states' },
  { kind: 'link', id: 'trails', label: 'trails & tabs' },
  { kind: 'link', id: 'cards', label: 'cards & rows' },
  { kind: 'link', id: 'conversation', label: 'conversation' },
  { kind: 'link', id: 'timeline', label: 'timeline' },
  { kind: 'link', id: 'canvas', label: 'canvas & dialog' },
  { kind: 'link', id: 'forms', label: 'forms & empty' },
  { kind: 'link', id: 'overlays', label: 'overlays' },
  { kind: 'link', id: 'data-table', label: 'data table' },
  { kind: 'link', id: 'pagination', label: 'pagination' },
  { kind: 'link', id: 'accordion', label: 'accordion' },
  { kind: 'link', id: 'toast', label: 'toast host' },
  { kind: 'link', id: 'date-range', label: 'date range' },
  { kind: 'group', id: 'using', label: 'using the system' },
  { kind: 'link', id: 'a11y', label: 'accessibility' },
  { kind: 'link', id: 'tokens', label: 'tokens' },
  { kind: 'link', id: 'resources', label: 'resources' },
  { kind: 'group', id: 'inuse', label: 'in use' },
  { kind: 'link', id: 'inuse-stage', label: 'live demos' },
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

/* icon a11y: name icon-only copy buttons from the token they copy, and hide every
   decorative glyph from assistive tech (meaning is carried by adjacent text or a
   labelled parent button). a belt-and-suspenders pass over the whole tree on mount. */
function labelIconA11y() {
  const root = document.querySelector('.pds-root')
  if (!root) return
  root.querySelectorAll('.copy-token:not([aria-label])').forEach((b) => {
    const v = b.getAttribute('data-copy')
    if (v) b.setAttribute('aria-label', 'copy ' + v)
  })
  root.querySelectorAll('svg.lucide, svg.brand, svg.logo').forEach((s) => {
    s.setAttribute('aria-hidden', 'true')
    s.setAttribute('focusable', 'false')
  })
}

/* sections 1+2, ONE continuous piece so there is a single wheat video and the roots come straight out of
   it: screen 1 is only the wheat video (the crop); screen 2 is the roots growing out of the video's base
   into "fairtrade" (the system font, full width at the bottom). no second/duplicate video. the video
   emits a one-time density profile of its bottom edge (`onColumns`); the roots seed their bases at those
   densest wheat columns and draw a dense seam band, so each strand visibly descends from real wheat. */
function Hero() {
  const [seeds, setSeeds] = useState(null)
  const [returning, setReturning] = useState(false)
  const growRef = useRef(null)
  // returning visitor (2nd visit onward): surface a quiet skip-to-docs affordance so they can bypass the splash
  useEffect(() => {
    try {
      if (localStorage.getItem('ft-seen')) setReturning(true)
      else localStorage.setItem('ft-seen', '1')
    } catch {}
  }, [])
  // grow the roots downward (a clip-path reveal) the first time the brand section scrolls into view
  useEffect(() => {
    const el = growRef.current
    if (!el) return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.add('grown'); return }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { el.classList.add('grow'); io.disconnect() }
    }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  // strong snapping across the full-screen top zone (crop -> roots -> philosophy): any wheel gesture advances
  // exactly one section so you never rest half-way between them. below philosophy the docs scroll natively.
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let busy = false, timer = 0
    const onWheel = (e) => {
      const crop = document.querySelector('.hero-crop'), roots = document.getElementById('brand'), philos = document.getElementById('manifesto')
      if (!crop || !roots || !philos) return
      const y = window.scrollY
      if (y > philos.offsetTop + window.innerHeight * 0.5) return // in the docs / in-use: leave scroll native
      e.preventDefault()
      // keep the cooldown alive as long as the gesture (incl. trackpad momentum) keeps firing wheels, so a
      // single gesture advances AT MOST ONE section - you can never skip past one
      clearTimeout(timer); timer = setTimeout(() => { busy = false }, 550)
      if (busy || Math.abs(e.deltaY) < 2) return
      busy = true
      const els = [crop, roots, philos]
      let idx = 0, best = Infinity
      els.forEach((el, i) => { const d = Math.abs(el.offsetTop - y); if (d < best) { best = d; idx = i } })
      const target = idx + (e.deltaY > 0 ? 1 : -1)
      if (target < 0) { busy = false; return }
      if (target >= els.length) { document.getElementById('start')?.scrollIntoView({ behavior: 'smooth' }); return }
      els[target].scrollIntoView({ behavior: 'smooth' })
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => { window.removeEventListener('wheel', onWheel); clearTimeout(timer) }
  }, [])
  const toDocs = () => document.getElementById('start')?.scrollIntoView({ behavior: 'smooth' })
  return (
    <section className="hero" id="top">
      {returning && <button className="hero-skip" type="button" onClick={toDocs}>skip to documentation</button>}
      <div className="hero-crop">
        <AsciiVideo src={wheatVid} cols={300} boost={2.05} contrast={1.5} fps={24} smooth={6} waveAmp={0} onColumns={setSeeds} className="hero-bg" />
      </div>
      <div className="hero-grow" id="brand" ref={growRef}>
        <div className="hero-soil-bg" aria-hidden="true">
          <AsciiSoilField cols={300} seed={9} className="hero-soil-field" />
        </div>
        <div className="hero-soil-band" aria-hidden="true">
          <AsciiSoil cols={300} rows={9} seed={5} className="hero-soil-art" />
        </div>
        <div className="hero-roots-wrap" aria-hidden="true">
          <AsciiRoots cols={300} bases={18} seed={11} density={1.2} spread={0.7} ramp fill fan seeds={seeds} className="hero-roots" />
        </div>
        <div className="hero-foot">
          <div className="hero-word" role="img" aria-label="fairtrade">fairtrade</div>
        </div>
      </div>
    </section>
  )
}

/* section 3 - philosophy: a short centered statement; the whole dark ground is tiled with ascii
   portraits (hidden context - the chat transcripts behind the code) that a cursor-following spotlight
   reveals on hover, including behind the text. no reveal on touch (it stays minimal). */
/* a dense tiled field of portraits that REPEATS edge to edge with generous overlap, so the spotlight
   always lands on art (no vignette fade, no gaps between rows/cols). */
const PHILOS_GRID = { cols: 6, rows: 5 }
const PHILOS_SRC = [peasantWoman, peasantMan]
const PHILOS_ARTS = (() => {
  const out = []
  const { cols, rows } = PHILOS_GRID
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      out.push({
        key: i,
        src: PHILOS_SRC[(r + c) % 2],
        cols: 54,
        contrast: (r + c) % 2 ? 1.14 : 1.22,
        gamma: (r + c) % 2 ? 0.74 : 0.8,
        style: {
          top: `${(r * 100) / rows - 3}%`,
          left: `${(c * 100) / cols - 1.5}%`,
          width: `${100 / cols + 9}%`,
          height: `${100 / rows + 14}%`,
        },
      })
    }
  }
  return out
})()
const OFF = -800 // spotlight parked off-screen (no reveal)
function Philosophy({ theme }) {
  const secRef = useRef(null)
  const sp = useRef({ x: OFF, y: OFF, tx: OFF, ty: OFF, vx: 0, vy: 0, active: false, raf: 0 })

  // the spotlight is a pure delayed follow (an exponential low-pass, NOT a spring): each frame it eases a
  // fraction of the way toward the cursor, so it TRAILS the pointer with a steady lag and never overshoots
  // or bounces. it glides back off-screen the moment the cursor leaves the section, so it never gets stuck.
  useEffect(() => {
    const s = sp.current
    const el = secRef.current
    const tick = () => {
      const ease = 0.05 // smaller = more delay/lag behind the cursor (no bounce)
      s.x += (s.tx - s.x) * ease
      s.y += (s.ty - s.y) * ease
      if (el) {
        el.style.setProperty('--mx', s.x + 'px')
        el.style.setProperty('--my', s.y + 'px')
      }
      s.raf = requestAnimationFrame(tick)
    }
    s.raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(s.raf)
  }, [])

  // reveal the statement (fade + rise) the first time the section scrolls into view
  useEffect(() => {
    const el = secRef.current
    if (!el) return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.add('reveal'); return }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { el.classList.add('reveal'); io.disconnect() }
    }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const s = sp.current
    s.tx = e.clientX - r.left
    s.ty = e.clientY - r.top
    if (!s.active) { s.active = true; s.x = s.tx; s.y = s.ty } // first entry: start at the cursor
  }
  const onLeave = () => { const s = sp.current; s.active = false; s.tx = OFF; s.ty = OFF } // glide off -> reveal clears

  return (
    <section className="philos" id="manifesto" ref={secRef} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="philos-arts" aria-hidden="true">
        {PHILOS_ARTS.map((a) => (
          <div key={a.key} className="philos-art-tile" style={a.style}>
            <AsciiImage src={a.src} cols={a.cols} fit isolated contrast={a.contrast} gamma={a.gamma} black={0.16} white={0.82} theme={theme} />
          </div>
        ))}
      </div>
      <div className="philos-text">
        <h1 className="philos-lead">legible before clever, restrained before decorated.</h1>
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
      <h2 className="label">cards &amp; rows</h2>
      <div className="sub">list and grid surfaces, imagery on top</div>
      <p className="prose">cards carry a transcript or a collective at a glance: a peasant portrait rendered through the ascii filter, a title, a short summary, and tabular metadata. rows are the compact form for dense lists.</p>
      <div className="specimen">
        <div className="specimen-bar"><span className="specimen-cap">example</span></div>
        <div className="specimen-body">
      <div className="grid-cards">
        <a className="card card-img">
          <div className="card-thumb"><AsciiImage src={peasantWoman} cols={224} aspect={0.6} isolated contrast={1.18} gamma={0.78} black={0.22} white={0.86} vignette={0.16} theme={theme} className="thumb-ascii" /></div>
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
          <div className="card-thumb"><AsciiImage src={peasantMan} cols={224} aspect={0.6} isolated contrast={1.12} gamma={0.74} black={0.12} white={0.6} vignette={0.16} theme={theme} className="thumb-ascii" /></div>
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

  /* icon a11y on mount. the page now renders entirely from components with lucide-react, so
     there are no <i data-lucide> placeholders left to paint and no MutationObserver is needed. */
  useEffect(() => { labelIconA11y() }, [])

  /* scroll-spy: the active rail item is the LAST section whose top has crossed a fold line below
     the nav - deterministic, unlike the prior IntersectionObserver band that got stuck early.
     rAF-throttled because it reads layout rects + calls setState. */
  const [active, setActive] = useState('start')
  useEffect(() => {
    const ids = RAIL.map((r) => r.id)
    let raf = 0
    const spy = () => {
      raf = 0
      const y = window.scrollY
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 56
      const line = navH + 120
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top - line <= 0) current = id
        else break
      }
      if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) current = ids[ids.length - 1]
      setActive(current)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(spy) }
    spy()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  /* header gating by zone: the page header is HIDDEN over the top splash + philosophy, SHOWN across
     the documentation (from "start here" onward), and HIDDEN again over the in-use stage (whose own
     sticky top banner replaces it). its own direct scroll listener so it never thrashes. */
  useEffect(() => {
    const nav = document.querySelector('.nav')
    if (!nav) return
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 56
    const apply = () => {
      const y = window.scrollY
      const line = y + navH + 4
      const start = document.getElementById('start')
      const inuse = document.getElementById('inuse')
      const startTop = start ? start.getBoundingClientRect().top + y : Infinity
      const inuseTop = inuse ? inuse.getBoundingClientRect().top + y : Infinity
      const inDocs = line >= startTop && line < inuseTop
      nav.classList.toggle('nav--hidden', !inDocs)
    }
    apply()
    window.addEventListener('scroll', apply, { passive: true })
    window.addEventListener('resize', apply, { passive: true })
    return () => { window.removeEventListener('scroll', apply); window.removeEventListener('resize', apply) }
  }, [])
  useEffect(() => {
    const grp = GROUP_OF[active]
    document.querySelectorAll('.nav-links a[data-spy]').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-spy') === grp)
    })
  }, [active])

  /* the nav storybook link points at the deployed copy (relative `storybook/`, nested in
     dist/ by the deploy workflow) in production; in dev there is no built storybook under
     the vite server, so retarget it to the storybook dev server (pnpm storybook on 6006). */
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const a = document.querySelector('.sb-link')
    if (a) a.setAttribute('href', 'http://localhost:6006')
  }, [])

  /* command palette (the nav "search ⌘k" control + the ⌘k / ctrl-k shortcut) */
  const [paletteOpen, setPaletteOpen] = useState(false)
  /* the interactive modal dialog (the canvas section's live specimen) */
  const [dialogOpen, setDialogOpen] = useState(false)
  const dialogTriggerRef = useRef(null)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* (the trails tablist is now the self-managed <Tabs> component; the in-use mockup tablists
     manage their own roving keyboard nav, so the old global delegated tablist effect is gone.) */

  /* (the overlays dropdown is now the self-managed <Menu> component; the in-use mockup menus
     manage their own open/close state, so the old global delegated menu effect is gone.) */

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
    if (t.closest && t.closest('.navctl.bx')) {
      setPaletteOpen(true)
      return
    }
    const dlgTrigger = t.closest && t.closest('[data-open-dialog]')
    if (dlgTrigger) {
      dialogTriggerRef.current = dlgTrigger // dialog returns focus here on close
      setDialogOpen(true)
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
    const targets = Array.from(document.querySelectorAll('.philos, .band, .group, .card-img'))
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
        <Defs />
        <NavBar />
        <Hero />
        <Philosophy theme={theme} />
        <div className="docs">
          <Rail active={active} />
          <main className="docs-main">
            <StartSection />
            <GroupOpener id="foundations" title="foundations" sub="principles, type, color and controls" />
            <PrinciplesSection />
            <VoiceSection />
            <ColorSection />
            <TypographySection />
            <SpacingSection />
            <IconsSection />
            <MotionSection />
            <ControlsSection />
            <StatesSection />
            <GroupOpener id="components" title="components" sub="everything we build with, ported from peasant, village & the transcript viewer" />
            <BadgesSection />
            <TrailsSection />
            <Cards theme={theme} />
            <ConversationSection />
            <TimelineSection />
            <CanvasSection />
            <FormsSection />
            <OverlaysSection />
            <DataTableSection />
            <PaginationSection />
            <AccordionSection />
            <ToastSection />
            <DateRangeSection />
            <GroupOpener id="using" title="using the system" sub="how to build on it without breaking it" />
            <A11ySection />
            <TokensSection />
            <ResourcesSection />
          </main>
        </div>
        <InUseShell theme={theme} />
        <footer className="foot"><div className="foot-in"><svg className="logo" width="15" height="15" viewBox="0 0 32 32"><use href="#logo" /></svg> <b>fairtrade design system</b> <span className="right"><span>one identity, three apps</span> <a href="https://github.com/peasant-labs/peasant-design-system">github</a></span></div></footer>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onTheme={() => setTheme((x) => (x === 'light' ? 'dark' : 'light'))}
        sections={RAIL.filter((r) => r.kind === 'link')}
      />

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        returnFocusRef={dialogTriggerRef}
        title="join collective"
        labelId="join-dlg-title"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setDialogOpen(false)}>cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setDialogOpen(false); toast('joined desert-archivists') }}
            >
              <Users size={14} aria-hidden="true" /> reveal &amp; join
            </button>
          </>
        }
      >
        <div className="callout">
          <Eye size={16} aria-hidden="true" />
          <div>joining <b style={{ color: 'var(--ink-strong)' }}>desert-archivists</b> reveals your profile to its members. your shared transcripts stay redacted.</div>
        </div>
        <label className="check"><input type="checkbox" className="check-box" /> i understand and consent</label>
      </Dialog>

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

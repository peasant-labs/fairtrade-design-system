import { useEffect, useRef, useState } from 'react'
import {
  X,
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
import ToastProvider, { useToast } from './ui/ToastHost.jsx'
import FeedbackTool from './FeedbackTool.jsx'
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
  const [grown, setGrown] = useState(false) // drives the roots/soil growth-morph (set when the brand section scrolls in)
  const growRef = useRef(null)
  // returning visitor (2nd visit onward): surface a quiet skip-to-docs affordance so they can bypass the splash
  useEffect(() => {
    try {
      if (localStorage.getItem('ft-seen')) setReturning(true)
      else localStorage.setItem('ft-seen', '1')
    } catch {}
  }, [])
  // grow the roots + soil downward (a morphing reveal, see useGrowMorph) the first time the brand section
  // scrolls into view; the soil-bg fade + wordmark wipe still ride the .grow class. reduced-motion paints
  // it all at once (grown=true, but useGrowMorph stays static under reduce).
  useEffect(() => {
    const el = growRef.current
    if (!el) return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.add('grown'); setGrown(true); return }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { el.classList.add('grow'); setGrown(true); io.disconnect() }
    }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  // move through the splash (crop / brand / philosophy) and on into the docs with ONE gesture per stop. a
  // wheel notch or a trackpad flick advances exactly one stop and smooth-scrolls there - no half-screen drag,
  // no waiting for inertia to settle (that lag was the "too much effort" feel). the stops are the three
  // splash sections PLUS the docs top (#start), so philosophy snaps down into the docs; once at the docs top,
  // scrolling down releases into free scroll, so it can never lock. a directional scroll-stop snap stays as
  // the touch / keyboard / safety fallback, and reduced-motion disables all of it. positions are ABSOLUTE
  // (rect.top + scrollY) so the stops share one coordinate space.
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let cooldownUntil = 0, timer = 0, lastY = window.scrollY, dir = 1
    const tops = () => {
      const splash = [document.querySelector('.hero-crop'), document.getElementById('brand'), document.getElementById('manifesto')].filter(Boolean)
      if (splash.length < 3) return null
      const y = window.scrollY
      const arr = splash.map((el) => Math.round(el.getBoundingClientRect().top + y))
      // #start (the docs top) is a FOURTH stop, so philosophy snaps DOWN into the docs with one more
      // gesture instead of releasing straight to free scroll. unlike the splash sections (which cancel the
      // nav's scroll-padding), the docs sit below the now-visible sticky nav, so its anchor is offset by
      // --nav-h to land exactly where an anchor link / the scroll-spy do.
      const docsTop = document.getElementById('start')
      if (docsTop) {
        const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 56
        arr.push(Math.round(docsTop.getBoundingClientRect().top + y) - navH)
      }
      return arr
    }
    const floorIndex = (t, y) => { let c = 0; for (let i = 0; i < t.length; i++) if (y >= t[i] - 2) c = i; return c }
    const go = (target) => { cooldownUntil = performance.now() + 650; window.scrollTo({ top: target, behavior: 'smooth' }) }

    const onWheel = (e) => {
      const t = tops(); if (!t) return
      const vh = window.innerHeight, y = window.scrollY
      if (y > t[t.length - 1] + vh * 0.35) return // in / below the docs top: native free scroll through the docs
      if (Math.abs(e.deltaY) < 1) return
      const down = e.deltaY > 0
      const cur = floorIndex(t, y)
      const into = (y - t[cur]) / vh
      if (down && cur >= t.length - 1) return // at the docs top, downward -> release into free scroll
      if (!down && cur <= 0 && into < 0.04) return // at the very top, upward -> nothing above
      e.preventDefault() // we own this gesture now
      if (performance.now() < cooldownUntil) return // absorb the rest of the flick / inertia; one advance per gesture
      if (down) go(t[Math.min(cur + 1, t.length - 1)])
      else go(into > 0.04 ? t[cur] : t[Math.max(0, cur - 1)]) // unaligned: settle to this top first, else go up one
    }

    // touch / keyboard / safety: after scrolling pauses, finish the move with a low-threshold directional
    // snap (a small swipe still advances). respects the wheel cooldown so it never double-fires.
    const snap = () => {
      if (performance.now() < cooldownUntil) return
      const t = tops(); if (!t) return
      const vh = window.innerHeight, y = window.scrollY
      if (y > t[t.length - 1] + vh * 0.5 || y < t[0] - 4) return
      const cur = floorIndex(t, y)
      if (dir > 0 && cur >= t.length - 1) return // at the docs top scrolling down: release, don't pull back
      const into = (y - t[cur]) / vh
      let ti = cur
      if (dir > 0) ti = into > 0.08 && cur < t.length - 1 ? cur + 1 : cur
      else ti = into < 0.92 ? cur : Math.min(cur + 1, t.length - 1)
      if (Math.abs(t[ti] - y) > 4) go(t[ti])
    }
    const onScroll = () => {
      const y = window.scrollY
      if (y !== lastY) { dir = y > lastY ? 1 : -1; lastY = y }
      clearTimeout(timer); timer = setTimeout(snap, 200)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('wheel', onWheel); window.removeEventListener('scroll', onScroll); clearTimeout(timer) }
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
          <AsciiSoil cols={300} rows={18} seed={5} grow={grown} growMs={1500} className="hero-soil-art" />
        </div>
        <div className="hero-roots-wrap" aria-hidden="true">
          <AsciiRoots cols={300} bases={18} seed={11} density={1.2} spread={0.7} ramp fill fan trunk={0.34} seeds={seeds} grow={grown} growMs={2900} className="hero-roots" />
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

/* RailSpy owns the scroll-spy `active` state so a section change re-renders ONLY the rail (a handful of
   <a>s) and toggles the nav group marker via the DOM - it never re-renders the page. this used to live in
   AppShell, so every scroll that crossed a section boundary re-rendered the ENTIRE documentation tree
   (thousands of nodes): a heavy full-tree storm, several-fold worse under dev-mode React, that made
   scrolling and interacting (e.g. sweeping the comment tool) janky and could stall slower machines. */
function RailSpy() {
  /* the active rail item is the LAST section whose top has crossed a fold line below the nav -
     deterministic, unlike the prior IntersectionObserver band that got stuck early. rAF-throttled
     because it reads layout rects + calls setState. */
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
  // mirror the active section onto the nav's group marker via the DOM (no React render of the nav).
  useEffect(() => {
    const grp = GROUP_OF[active]
    document.querySelectorAll('.nav-links a[data-spy]').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-spy') === grp)
    })
  }, [active])
  return <Rail active={active} />
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
        <a className="card card-img" href="#cards">
          <div className="card-thumb"><AsciiImage src={peasantWoman} cols={224} fit isolated contrast={1.18} gamma={0.78} black={0.22} white={0.86} vignette={0.16} theme={theme} className="thumb-ascii" /></div>
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
        <a className="card card-img" href="#cards">
          <div className="card-thumb"><AsciiImage src={peasantMan} cols={224} fit isolated contrast={1.12} gamma={0.74} black={0.12} white={0.6} vignette={0.16} theme={theme} className="thumb-ascii" /></div>
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
      <div style={{ marginTop: 'var(--sp-5)' }}>
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

function AppShell() {
  /* the system toast host (mounted by <App> below). copy + save confirmations route
     through it so they read as real toasts, not the old feedback-only bubble. */
  const notify = useToast()
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

  /* the scroll-spy + active-rail state now live in <RailSpy/> (rendered in the docs grid) so a section
     change re-renders only the rail, not this whole tree. */

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

  /* snap the in-use stage to fill the viewport when the reader scrolls DOWN into it. with the footer
     gone, #inuse is the page's last 100svh block, so once it aligns to the top the sticky app-switcher
     bar pins and the stage's own internal scroll takes over - which is what makes the demo's tabs and
     headers stay put (they were never sticking because the section never settled at the top). this is
     a scroll-stop snap (fires after scrolling pauses), directional so an upward exit is never trapped,
     and disabled under reduced-motion. it is independent of the splash wheel-snap, which releases into
     free scroll well above here. */
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer = 0, lastY = window.scrollY, dir = 1, cooldownUntil = 0
    const trySnap = () => {
      if (performance.now() < cooldownUntil) return
      const inuse = document.getElementById('inuse')
      if (!inuse) return
      const r = inuse.getBoundingClientRect()
      const vh = window.innerHeight
      // entering on the way down, with the section top in the upper 60% of the viewport
      if (dir > 0 && r.top > 4 && r.top < vh * 0.6) {
        cooldownUntil = performance.now() + 700
        window.scrollTo({ top: Math.round(r.top + window.scrollY), behavior: 'smooth' })
      }
    }
    const onScroll = () => {
      const y = window.scrollY
      if (y !== lastY) { dir = y > lastY ? 1 : -1; lastY = y }
      clearTimeout(timer); timer = setTimeout(trySnap, 180)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer) }
  }, [])

  /* the nav storybook link points at the deployed copy (relative `storybook/`, nested in
     dist/ by the deploy workflow) in production; in dev there is no built storybook under
     the vite server, so retarget it to the storybook dev server (pnpm storybook on 6006). */
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const a = document.querySelector('a.sb-link')
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
      notify.ok(v + ' is on the clipboard.', { title: 'copied' })
    }
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
          <RailSpy />
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
              onClick={() => { setDialogOpen(false); notify.ok('joined desert-archivists.', { title: 'joined' }) }}
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

      {!fbOff && <FeedbackTool />}
    </>
  )
}

/* mount the system toast host once at the very root, so copy + save confirmations
   (and any future imperative toast.ok / toast.err) surface through the real toast
   surface rather than a bespoke bubble. */
export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  )
}

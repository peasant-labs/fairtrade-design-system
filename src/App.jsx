import { memo, useEffect, useRef, useState } from 'react'
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
import { AsciiImage, AsciiVideo, AsciiWordmark } from './effects.jsx'
import { paintIcons } from './icons.js'
import CommandPalette from './CommandPalette.jsx'
import Dialog from './Dialog.jsx'
import InUseShell from './mockups/inuse/InUseShell.jsx'
import { DataTableSection, PaginationSection, AccordionSection } from './ComponentSections.jsx'
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
import statesHtml from './sections/36-states.html?raw'
import groupComponentsHtml from './sections/40-group-components.html?raw'
import badgesHtml from './sections/42-badges.html?raw'
import trailsHtml from './sections/44-trails.html?raw'
import conversationHtml from './sections/48-conversation.html?raw'
import canvasHtml from './sections/50-canvas.html?raw'
import formsHtml from './sections/52-forms.html?raw'
import overlaysHtml from './sections/54-overlays.html?raw'
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
  { kind: 'link', id: 'states', label: 'states' },
  { kind: 'group', id: 'components', label: 'components' },
  { kind: 'link', id: 'badges', label: 'badges & states' },
  { kind: 'link', id: 'trails', label: 'trails & tabs' },
  { kind: 'link', id: 'cards', label: 'cards & rows' },
  { kind: 'link', id: 'conversation', label: 'conversation' },
  { kind: 'link', id: 'canvas', label: 'canvas & dialog' },
  { kind: 'link', id: 'forms', label: 'forms & empty' },
  { kind: 'link', id: 'overlays', label: 'overlays' },
  { kind: 'link', id: 'data-table', label: 'data table' },
  { kind: 'link', id: 'pagination', label: 'pagination' },
  { kind: 'link', id: 'accordion', label: 'accordion' },
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

/* a raw-html partial dropped transparently into the flow (display:contents wrapper). memoized so it
   renders exactly once: the html prop is a stable module import, and re-rendering would make React
   reset innerHTML and clobber the lucide svgs that createIcons painted into it (which also detaches
   any captured DOM refs - that broke the dialog's focus-return). */
const Raw = memo(({ html }) => <div className="contents" dangerouslySetInnerHTML={{ __html: html }} />)

/* icon a11y: name icon-only copy buttons from the token they copy, and hide every
   decorative glyph from assistive tech (meaning is carried by adjacent text or a
   labelled parent button). runs after lucide paints the partials' <i data-lucide>. */
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

/* section 1 - full-screen brand splash: the wheat video sampled to ascii, the wordmark drawn in
   wheat-ramp glyphs anchored bottom-right (no container, no alpha), a descending-grain scroll cue */
function Hero() {
  return (
    <section className="hero" id="top">
      <AsciiVideo src={wheatVid} cols={300} boost={2.05} contrast={1.5} fps={24} smooth={6} waveAmp={0} className="hero-video" />
      <div className="hero-mark">
        <AsciiWordmark text="fairtrade" gap={1} className="hero-wordmark" />
      </div>
      <a className="hero-scroll" href="#intro" aria-label="scroll to the value proposition">
        <span className="hsc-grain" aria-hidden="true"><b>:</b><b>*</b><b>x</b><b>#</b><b>@</b></span>
        <span className="hsc-chevron" aria-hidden="true">&#9661;</span>
        <span className="hsc-label">scroll</span>
        <span className="hsc-key" aria-hidden="true">&#8595; / space</span>
      </a>
    </section>
  )
}

/* section 2 - the value proposition, composed with a framed ascii portrait (P3) */
function Intro({ theme }) {
  return (
    <section className="intro" id="intro">
      <div className="intro-in">
        <div className="intro-copy">
          <h1>receipts for <span className="hl">agentic work</span>,<br />kept low to the ground.</h1>
          <p>ingest your sessions locally, redact them, and share what's worth sharing.</p>
          <div className="btn-row">
            <button className="btn btn-primary">explore the commons</button>
            <button className="btn btn-secondary">publish a transcript</button>
          </div>
        </div>
        <figure className="intro-art framed" aria-hidden="true">
          <AsciiImage src={peasantWoman} cols={150} aspect={1.18} isolated contrast={1.18} gamma={0.78} black={0.22} white={0.86} vignette={0.18} ink="#ece7dd" theme={theme} className="intro-art-ascii" />
        </figure>
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

  /* paint the partials' lucide icons (bundled, no CDN), then apply icon a11y. a MutationObserver
     re-paints if any <i data-lucide> placeholder ever re-appears, so icons never silently vanish. */
  useEffect(() => {
    const repaint = () => { paintIcons(); labelIconA11y() }
    repaint()
    const root = document.querySelector('.pds-root')
    if (!root) return
    let queued = false
    const obs = new MutationObserver(() => {
      if (queued) return
      if (!root.querySelector('i[data-lucide]')) return
      queued = true
      requestAnimationFrame(() => { queued = false; repaint() })
    })
    obs.observe(root, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

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

  /* nav reveal - its OWN direct scroll listener (no rAF, no setState), so it is immune to the
     re-render churn of the scroll-spy and processes every scroll event in order. an 8px deadzone
     kills jitter; once hidden it stays hidden until a clear up-scroll, so it never thrashes. */
  useEffect(() => {
    const nav = document.querySelector('.nav')
    if (!nav) return
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 56
    let lastY = window.scrollY
    const onNav = () => {
      const y = window.scrollY
      if (y < navH * 2) { nav.classList.remove('nav--hidden'); lastY = y; return }
      if (Math.abs(y - lastY) < 8) return
      nav.classList.toggle('nav--hidden', y > lastY) // down -> hide, up -> show
      lastY = y
    }
    window.addEventListener('scroll', onNav, { passive: true })
    return () => window.removeEventListener('scroll', onNav)
  }, [])
  useEffect(() => {
    const grp = GROUP_OF[active]
    document.querySelectorAll('.nav-links a[data-spy]').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-spy') === grp)
    })
  }, [active])

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

  /* wire the static ARIA tablists (trails section) for click + arrow-key selection with a roving
     tabindex, toggling the matching tabpanel. partials are memoized, so this runs once. */
  useEffect(() => {
    const lists = [...document.querySelectorAll('.tabs[role="tablist"]')]
    const cleanups = []
    lists.forEach((list) => {
      const tabs = [...list.querySelectorAll('[role="tab"]')]
      const select = (tab) => {
        tabs.forEach((t) => {
          const on = t === tab
          t.setAttribute('aria-selected', on ? 'true' : 'false')
          t.tabIndex = on ? 0 : -1
          t.classList.toggle('active', on)
          const panel = document.getElementById(t.getAttribute('aria-controls'))
          if (panel) panel.hidden = !on
        })
      }
      const onClick = (e) => {
        const tab = e.target.closest('[role="tab"]')
        if (tab && list.contains(tab)) { select(tab); tab.focus() }
      }
      const onKey = (e) => {
        const i = tabs.indexOf(document.activeElement)
        if (i < 0) return
        let j = i
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length
        else if (e.key === 'Home') j = 0
        else if (e.key === 'End') j = tabs.length - 1
        else return
        e.preventDefault(); select(tabs[j]); tabs[j].focus()
      }
      list.addEventListener('click', onClick)
      list.addEventListener('keydown', onKey)
      cleanups.push(() => { list.removeEventListener('click', onClick); list.removeEventListener('keydown', onKey) })
    })
    return () => cleanups.forEach((c) => c())
  }, [])

  /* wire the static dropdown menus ([data-menu-trigger]): click/Down opens, arrows move between
     enabled items, Esc/Tab/outside-click close, focus returns to the trigger. */
  useEffect(() => {
    const triggers = [...document.querySelectorAll('[data-menu-trigger]')]
    const cleanups = []
    triggers.forEach((trigger) => {
      const menu = document.getElementById(trigger.getAttribute('aria-controls'))
      if (!menu) return
      const items = () => [...menu.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')]
      let isOpen = false
      const setOpen = (v, which) => {
        isOpen = v
        trigger.setAttribute('aria-expanded', v ? 'true' : 'false')
        menu.hidden = !v
        if (v) {
          const its = items()
          ;(which === 'last' ? its[its.length - 1] : its[0])?.focus()
        }
      }
      const close = (returnFocus) => { setOpen(false); if (returnFocus) trigger.focus() }
      const onTriggerClick = (e) => { e.preventDefault(); isOpen ? close(true) : setOpen(true, 'first') }
      const onTriggerKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true, 'first') }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true, 'last') }
      }
      const onMenuKey = (e) => {
        const its = items()
        const i = its.indexOf(document.activeElement)
        if (e.key === 'Escape') { e.preventDefault(); close(true) }
        else if (e.key === 'ArrowDown') { e.preventDefault(); its[(i + 1) % its.length]?.focus() }
        else if (e.key === 'ArrowUp') { e.preventDefault(); its[(i - 1 + its.length) % its.length]?.focus() }
        else if (e.key === 'Home') { e.preventDefault(); its[0]?.focus() }
        else if (e.key === 'End') { e.preventDefault(); its[its.length - 1]?.focus() }
        else if (e.key === 'Tab') close(false)
      }
      const onMenuClick = (e) => { if (e.target.closest('[role="menuitem"]:not([aria-disabled="true"])')) close(true) }
      const onDocDown = (e) => { if (isOpen && !menu.contains(e.target) && !trigger.contains(e.target)) close(false) }
      trigger.addEventListener('click', onTriggerClick)
      trigger.addEventListener('keydown', onTriggerKey)
      menu.addEventListener('keydown', onMenuKey)
      menu.addEventListener('click', onMenuClick)
      document.addEventListener('mousedown', onDocDown)
      cleanups.push(() => {
        trigger.removeEventListener('click', onTriggerClick)
        trigger.removeEventListener('keydown', onTriggerKey)
        menu.removeEventListener('keydown', onMenuKey)
        menu.removeEventListener('click', onMenuClick)
        document.removeEventListener('mousedown', onDocDown)
      })
    })
    return () => cleanups.forEach((c) => c())
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
        <Intro theme={theme} />
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
            <Raw html={statesHtml} />
            <Raw html={groupComponentsHtml} />
            <Raw html={badgesHtml} />
            <Raw html={trailsHtml} />
            <Cards theme={theme} />
            <Raw html={conversationHtml} />
            <Raw html={canvasHtml} />
            <Raw html={formsHtml} />
            <Raw html={overlaysHtml} />
            <DataTableSection />
            <PaginationSection />
            <AccordionSection />
            <Raw html={groupUsingHtml} />
            <Raw html={a11yHtml} />
            <Raw html={tokensHtml} />
            <Raw html={resourcesHtml} />
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

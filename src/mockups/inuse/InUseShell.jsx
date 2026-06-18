import { useEffect, useRef, useState } from 'react'
import { ScrollText, Users, Waypoints, Maximize2, Minimize2 } from 'lucide-react'
import TranscriptApp from './TranscriptApp.jsx'
import CommonsApp from './CommonsApp.jsx'
import GraphApp from './GraphApp.jsx'

/* the "in use" full-screen showcase: a full-viewport immersive stage that hosts the three sibling apps.
   a sticky top app-switcher banner REPLACES the page header (same height) and carries the brand mark + a
   keyboard-accessible tablist for the three apps (click, or keys 1/2/3) with a guarded crossfade; an expand
   control drops the whole section into true browser fullscreen. below the banner the stage fills the rest of
   the viewport and renders the active app full-bleed. each app owns its internal navigation so every feature
   stays reachable. */

const APPS = [
  { id: 'transcript', mark: 'transcript-browser', icon: ScrollText },
  { id: 'commons', mark: 'village', icon: Users },
  { id: 'graph', mark: 'peasant', icon: Waypoints },
]

export default function InUseShell({ theme }) {
  const [app, setApp] = useState('transcript')
  const [full, setFull] = useState(false)
  const sectionRef = useRef(null)
  const tabRefs = useRef({})

  /* track real fullscreen so the expand control + class stay in sync (Esc, browser ui, etc.) */
  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === sectionRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFull = () => {
    const el = sectionRef.current
    if (!el) return
    if (document.fullscreenElement === el) document.exitFullscreen?.()
    else el.requestFullscreen?.().catch(() => {})
  }

  /* 1/2/3 switch apps when focus is inside the section and you are not typing in a field */
  const onKeyDown = (e) => {
    const t = e.target
    if (t && (/(INPUT|TEXTAREA|SELECT)/.test(t.tagName) || t.isContentEditable)) return
    const i = { '1': 0, '2': 1, '3': 2 }[e.key]
    if (i != null) { e.preventDefault(); setApp(APPS[i].id) }
  }

  /* arrow-key roving across the tablist (focus follows selection, wraps, home/end) */
  const onTabKeyDown = (e) => {
    const ids = APPS.map((a) => a.id)
    const i = ids.indexOf(app)
    if (i < 0) return
    let j = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % ids.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + ids.length) % ids.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = ids.length - 1
    else return
    e.preventDefault()
    setApp(ids[j])
    tabRefs.current[ids[j]]?.focus()
  }

  const active = APPS.find((a) => a.id === app)

  return (
    <section
      className={'iu' + (full ? ' iu-is-full' : '')}
      id="inuse"
      aria-label="the design system in use"
      ref={sectionRef}
      onKeyDown={onKeyDown}
    >
      {/* sticky top app-switcher banner: sits exactly where the page header would, visually replacing it */}
      <div className="iu-bar">
        <div className="iu-bar-brand">
          <svg className="logo" width="18" height="18" viewBox="0 0 32 32" aria-hidden="true"><use href="#logo" /></svg>
          <span>fairtrade</span>
        </div>

        <div
          className="iu-switch"
          role="tablist"
          aria-label="apps"
          aria-orientation="horizontal"
          onKeyDown={onTabKeyDown}
        >
          {APPS.map((a, i) => {
            const Icon = a.icon
            const on = a.id === app
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={'iu-tab-' + a.id}
                aria-selected={on ? 'true' : 'false'}
                aria-controls="inuse-stage"
                tabIndex={on ? 0 : -1}
                ref={(el) => { tabRefs.current[a.id] = el }}
                className={'iu-opt' + (on ? ' iu-opt-on' : '')}
                onClick={() => setApp(a.id)}
              >
                <span className="iu-opt-ico"><Icon size={16} aria-hidden="true" /></span>
                <span className="iu-opt-label">{a.mark}</span>
                <span className="iu-opt-key" aria-hidden="true">{i + 1}</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="iu-bar-full"
          onClick={toggleFull}
          aria-label={full ? 'exit fullscreen' : 'expand to fullscreen'}
        >
          {full ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
          <span className="iu-bar-full-label">{full ? 'exit' : 'expand'}</span>
        </button>
      </div>

      {/* the stage fills the rest of the viewport and renders the active app full-bleed */}
      <div
        className="iu-stage"
        id="inuse-stage"
        role="tabpanel"
        aria-labelledby={'iu-tab-' + active.id}
        tabIndex={-1}
      >
        <div className="iu-screen" key={app}>
          {app === 'transcript' && <TranscriptApp theme={theme} />}
          {app === 'commons' && <CommonsApp theme={theme} />}
          {app === 'graph' && <GraphApp theme={theme} />}
        </div>
      </div>
    </section>
  )
}

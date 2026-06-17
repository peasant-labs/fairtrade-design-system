import { useEffect, useRef, useState } from 'react'
import { ScrollText, Users, Waypoints, Maximize2, Minimize2 } from 'lucide-react'
import TranscriptApp from './TranscriptApp.jsx'
import CommonsApp from './CommonsApp.jsx'
import GraphApp from './GraphApp.jsx'

/* the "in use" full-screen showcase: a full-bleed terminal-style workspace window that hosts the three
   sibling apps. a left app-rail switches between them (click, or keys 1/2/3) with a guarded crossfade; an
   expand button drops the window into true browser fullscreen. each app renders inside with its OWN internal
   navigation so every feature is reachable. this replaces the three small inline mockups. */

const APPS = [
  { id: 'transcript', mark: 'transcript-browser', gloss: 'read one session, end to end', icon: ScrollText },
  { id: 'commons', mark: 'village', gloss: 'the shared commons', icon: Users },
  { id: 'graph', mark: 'peasant', gloss: 'local analytics & code map', icon: Waypoints },
]

export default function InUseShell({ theme }) {
  const [app, setApp] = useState('transcript')
  const [full, setFull] = useState(false)
  const winRef = useRef(null)
  const stageRef = useRef(null)

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === winRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFull = () => {
    const el = winRef.current
    if (!el) return
    if (document.fullscreenElement === el) document.exitFullscreen?.()
    else el.requestFullscreen?.().catch(() => {})
  }

  /* 1/2/3 switch apps when the stage has focus and you are not typing in a field */
  const onKeyDown = (e) => {
    const t = e.target
    if (t && (/(INPUT|TEXTAREA|SELECT)/.test(t.tagName) || t.isContentEditable)) return
    const i = { '1': 0, '2': 1, '3': 2 }[e.key]
    if (i != null) { e.preventDefault(); setApp(APPS[i].id) }
  }

  const active = APPS.find((a) => a.id === app)

  return (
    <section className="iu" id="inuse" aria-label="the design system in use" ref={stageRef} onKeyDown={onKeyDown}>
      <div className="iu-head">
        <h2 className="iu-title">in use</h2>
        <p className="iu-gloss">the design system running the three apps it builds: a live, full-screen preview of each. switch apps in the rail, or press <span className="kbd">1</span> <span className="kbd">2</span> <span className="kbd">3</span>.</p>
      </div>

      <div className={'iu-win' + (full ? ' is-full' : '')} id="inuse-stage" ref={winRef}>
        <nav className="iu-rail" aria-label="switch app">
          <div className="iu-rail-brand"><svg className="logo" width="16" height="16" viewBox="0 0 32 32"><use href="#logo" /></svg> <span>fairtrade</span></div>
          <ul className="iu-applist" role="tablist" aria-label="apps" aria-orientation="vertical">
            {APPS.map((a, i) => {
              const Icon = a.icon
              const on = a.id === app
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on ? 'true' : 'false'}
                    className={'iu-app' + (on ? ' active' : '')}
                    onClick={() => setApp(a.id)}
                  >
                    <span className="iu-app-ico"><Icon size={18} aria-hidden="true" /></span>
                    <span className="iu-app-txt">
                      <span className="iu-app-mark">{a.mark}</span>
                      <span className="iu-app-gloss">{a.gloss}</span>
                    </span>
                    <span className="iu-app-key" aria-hidden="true">{i + 1}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="iu-rail-foot">one identity, three apps</div>
        </nav>

        <div className="iu-main">
          <div className="iu-titlebar">
            <span className="iu-tb-app">{active.mark}</span>
            <span className="iu-tb-tag">live demo</span>
            <button type="button" className="iu-tb-full" onClick={toggleFull} aria-label={full ? 'exit fullscreen' : 'expand to fullscreen'}>
              {full ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
              <span>{full ? 'exit' : 'expand'}</span>
            </button>
          </div>
          <div className="iu-body" key={app}>
            {app === 'transcript' && <TranscriptApp theme={theme} />}
            {app === 'commons' && <CommonsApp theme={theme} />}
            {app === 'graph' && <GraphApp theme={theme} />}
          </div>
        </div>
      </div>
    </section>
  )
}

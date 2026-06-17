import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { MapView, ChangesView, ChangeDetailView } from './GraphMap.jsx'
import { AnalyticsView } from './GraphAnalytics.jsx'

/* peasant (graph) demo parent: internal nav over the code-map, the analytics dashboard, and the changes
   git-graph. change-detail opens from a commit click (onNavigate) with a back affordance. */

const PRIMARY = [
  { id: 'map', label: 'code map' },
  { id: 'analytics', label: 'analytics' },
  { id: 'changes', label: 'changes' },
]
const BACK_TO = { 'change-detail': 'changes' }

export default function GraphApp({ theme }) {
  const [view, setView] = useState('map')
  const onNavigate = (v) => setView(v)
  const back = BACK_TO[view]

  return (
    <div className="iu-app-root">
      <nav className="iu-subnav" aria-label="peasant sections">
        {back ? (
          <button type="button" className="iu-subnav-back" onClick={() => setView(back)}>
            <ChevronLeft size={14} aria-hidden="true" /> back
          </button>
        ) : null}
        {PRIMARY.map((p) => (
          <button
            key={p.id}
            type="button"
            className={'iu-subnav-item' + (view === p.id || BACK_TO[view] === p.id ? ' active' : '')}
            aria-current={view === p.id ? 'page' : undefined}
            onClick={() => setView(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <div className="iu-view">
        {view === 'map' && <MapView theme={theme} onNavigate={onNavigate} />}
        {view === 'analytics' && <AnalyticsView theme={theme} onNavigate={onNavigate} />}
        {view === 'changes' && <ChangesView theme={theme} onNavigate={onNavigate} />}
        {view === 'change-detail' && <ChangeDetailView theme={theme} onNavigate={onNavigate} />}
      </div>
    </div>
  )
}

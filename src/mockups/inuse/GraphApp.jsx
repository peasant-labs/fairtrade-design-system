import { useState } from 'react'
import { GraphAppShell, GRAPH_APP_SECTIONS } from '../../ui/inuse/InUseShell.jsx'
import { assertTimelineNavigationAction } from '../../ui/graph/timelineNavigation.js'
import { MapView, ChangesView, ChangeDetailView, SessionDestinationView, TimelineView } from './GraphMap.jsx'
import { AnalyticsView } from './GraphAnalytics.jsx'

/* peasant (graph) demo parent: internal nav over the code-map, the analytics dashboard, and the changes
   git-graph. change-detail opens from a commit click (onNavigate) with a back affordance. */

const PRIMARY = GRAPH_APP_SECTIONS
const BACK_TO = { 'change-detail': 'changes', 'session-detail': 'changes' }

export default function GraphApp({ theme }) {
  const [view, setView] = useState(PRIMARY[0]?.id ?? 'changes')
  const [sessionAction, setSessionAction] = useState(null)
  const onAppNavigate = (v) => setView(v)
  const onTimelineNavigate = (action) => {
    assertTimelineNavigationAction(action)
    if (action.type === 'open-change') setView('change-detail')
    else if (action.type === 'open-session') {
      setSessionAction(action)
      setView('session-detail')
    } else if (action.type === 'open-map') setView('map')
    else if (action.type === 'show-older') setView('changes')
  }
  const back = BACK_TO[view]

  return (
    <GraphAppShell
      sections={PRIMARY}
      activeId={view}
      activePrimaryId={BACK_TO[view] ?? view}
      backTo={back}
      onSectionChange={setView}
    >
      {view === 'map' && (
        <>
          <MapView theme={theme} onNavigate={onAppNavigate} />
          {/* The fidelity oracle for the timeline + ranked-list primitives: the
              git+session timeline + ranked entry list + insight panel, composed
              directly (no new nav route; the "code map" section registry is unchanged). */}
          <TimelineView theme={theme} />
        </>
      )}
      {view === 'analytics' && <AnalyticsView theme={theme} onNavigate={onAppNavigate} />}
      <div hidden={view !== 'changes'} aria-hidden={view !== 'changes'}>
        <ChangesView theme={theme} onNavigate={onTimelineNavigate} />
      </div>
      {view === 'change-detail' && <ChangeDetailView theme={theme} onNavigate={onAppNavigate} />}
      {view === 'session-detail' && sessionAction && <SessionDestinationView sessionAction={sessionAction} />}
    </GraphAppShell>
  )
}

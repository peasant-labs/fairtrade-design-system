import { useState } from 'react'
import { GraphAppShell, GRAPH_APP_SECTIONS } from '../../ui/inuse/InUseShell.jsx'
import { MapView, ChangesView, ChangeDetailView } from './GraphMap.jsx'
import { AnalyticsView } from './GraphAnalytics.jsx'

/* peasant (graph) demo parent: internal nav over the code-map, the analytics dashboard, and the changes
   git-graph. change-detail opens from a commit click (onNavigate) with a back affordance. */

const PRIMARY = GRAPH_APP_SECTIONS
const BACK_TO = { 'change-detail': 'changes' }

export default function GraphApp({ theme }) {
  const [view, setView] = useState(PRIMARY[0]?.id ?? 'changes')
  const onNavigate = (v) => setView(v)
  const back = BACK_TO[view]

  return (
    <GraphAppShell
      sections={PRIMARY}
      activeId={view}
      activePrimaryId={BACK_TO[view] ?? view}
      backTo={back}
      onSectionChange={setView}
    >
      {view === 'map' && <MapView theme={theme} onNavigate={onNavigate} />}
      {view === 'analytics' && <AnalyticsView theme={theme} onNavigate={onNavigate} />}
      {view === 'changes' && <ChangesView theme={theme} onNavigate={onNavigate} />}
      {view === 'change-detail' && <ChangeDetailView theme={theme} onNavigate={onNavigate} />}
    </GraphAppShell>
  )
}

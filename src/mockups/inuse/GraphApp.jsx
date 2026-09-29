import { useState } from 'react'
import { GraphAppShell, LOCAL_APP_SECTIONS } from '../../ui/inuse/InUseShell.jsx'
import { LocalOfflineBanner } from '../../ui/ConnectionState.jsx'
import { assertTimelineNavigationAction } from '../../ui/graph/timelineNavigation.js'
import { MapView, ChangesView, ChangeDetailView, SessionDestinationView, TimelineView } from './GraphMap.jsx'
import { AnalyticsView } from './GraphAnalytics.jsx'
import { HomeView, SettingsView } from './LocalHome.jsx'

/* peasant (local app) demo parent. The section registry opens on home; home and settings are in
   the nav, while analytics, changes and code map are reached by route only: `?section=<id>` opens
   one directly, and the changes timeline still links into the code map. change-detail opens from a
   commit click (onNavigate) with a back affordance. `?local=offline` shows the page-level notice
   for a stopped local app above the section body. */

const SECTIONS = LOCAL_APP_SECTIONS
const SECTION_IDS = new Set(SECTIONS.map((section) => section.id))
const BACK_TO = {
  'change-detail': 'changes',
  'session-detail': 'changes',
  ...Object.fromEntries(SECTIONS.filter((section) => !section.inNav).map((section) => [section.id, 'home'])),
}

function initialSection() {
  const requested = new URLSearchParams(window.location.search).get('section')
  return requested && SECTION_IDS.has(requested) ? requested : SECTIONS[0].id
}

function OfflineNotice() {
  const [retrying, setRetrying] = useState(false)
  const [checkedAt, setCheckedAt] = useState(() => new Date('2026-09-28T14:32:05'))
  const retry = () => {
    setRetrying(true)
    setTimeout(() => {
      setRetrying(false)
      setCheckedAt(new Date())
    }, 1200)
  }
  return <LocalOfflineBanner onRetry={retry} retrying={retrying} checkedAt={checkedAt} />
}

export default function GraphApp({ theme }) {
  const [view, setView] = useState(initialSection)
  const [sessionAction, setSessionAction] = useState(null)
  const offline = new URLSearchParams(window.location.search).get('local') === 'offline'
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
  const primary = back && !SECTIONS.find((section) => section.id === back)?.inNav ? BACK_TO[back] : back

  return (
    <GraphAppShell
      sections={SECTIONS}
      activeId={view}
      activePrimaryId={primary ?? view}
      backTo={back}
      onSectionChange={setView}
      notice={offline ? <OfflineNotice /> : null}
    >
      {view === 'home' && <HomeView />}
      {view === 'settings' && <SettingsView />}
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

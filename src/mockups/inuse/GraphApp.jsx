import { useState } from 'react'
import { GraphAppShell, LOCAL_APP_SECTIONS, LocalAppSection } from '../../ui/inuse/InUseShell.jsx'
import { LocalOfflineBanner } from '../../ui/ConnectionState.jsx'
import { closed } from '../../ui/closed-value.js'
import { assertTimelineNavigationAction } from '../../ui/graph/timelineNavigation.js'
import { MapView, ChangesView, ChangeDetailView, SessionDestinationView, TimelineView } from './GraphMap.jsx'
import { AnalyticsView } from './GraphAnalytics.jsx'
import { HomeView, SettingsView } from './LocalHome.jsx'
import LocalVillage from './LocalVillage.jsx'
import KickstartView from './LocalKickstart.jsx'

/* peasant (local app) demo parent. The section registry opens on home; home and settings are in
   the nav, while online (id village), analytics, changes and code map are reached by route only:
   `?section=<id>` opens one directly with a back to home, and the changes timeline still links
   into the code map. change-detail opens from a
   commit click (onNavigate) with a back affordance. `?local=offline` shows the page-level notice
   for a stopped local app above the section body. `?view=kickstart` opens the setup wizard, which
   peasant serves at /kickstart outside the section registry, with a back to settings. */

const SECTIONS = LOCAL_APP_SECTIONS
const SECTION_IDS = new Set(SECTIONS.map((section) => section.id))
const DemoRouteView = Object.freeze({
  Kickstart: closed('kickstart', 'kickstart'),
  ChangeDetail: closed('change-detail', 'change detail'),
  SessionDetail: closed('session-detail', 'session detail'),
})
const BACK_TO = {
  [DemoRouteView.ChangeDetail.wire]: LocalAppSection.Changes.id,
  [DemoRouteView.SessionDetail.wire]: LocalAppSection.Changes.id,
  [DemoRouteView.Kickstart.wire]: LocalAppSection.Settings.id,
  ...Object.fromEntries(SECTIONS.filter((section) => !section.inNav).map((section) => [section.id, LocalAppSection.Home.id])),
}

/* views reached by route only that are not sections: the registry stays unchanged. */
const ROUTE_VIEWS = new Set([DemoRouteView.Kickstart.wire])

function initialSection() {
  const view = new URLSearchParams(window.location.search).get('view')
  if (view && ROUTE_VIEWS.has(view)) return view
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
    if (action.type === 'open-change') setView(DemoRouteView.ChangeDetail.wire)
    else if (action.type === 'open-session') {
      setSessionAction(action)
      setView(DemoRouteView.SessionDetail.wire)
    } else if (action.type === 'open-map') setView(LocalAppSection.Map.id)
    else if (action.type === 'show-older') setView(LocalAppSection.Changes.id)
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
      navEnd={view === DemoRouteView.Kickstart.wire ? <h2 className="iu-ks-page-title">set up peasant</h2> : null}
    >
      {view === LocalAppSection.Home.id && <HomeView offline={offline} />}
      {view === LocalAppSection.Village.id && <LocalVillage />}
      {view === LocalAppSection.Settings.id && <SettingsView />}
      {view === DemoRouteView.Kickstart.wire && <KickstartView theme={theme} />}
      {view === LocalAppSection.Map.id && (
        <>
          <MapView theme={theme} onNavigate={onAppNavigate} />
          {/* The fidelity oracle for the timeline + ranked-list primitives: the
              git+session timeline + ranked entry list + insight panel, composed
              directly (no new nav route; the "code map" section registry is unchanged). */}
          <TimelineView theme={theme} />
        </>
      )}
      {view === LocalAppSection.Analytics.id && <AnalyticsView theme={theme} onNavigate={onAppNavigate} />}
      <div hidden={view !== LocalAppSection.Changes.id} aria-hidden={view !== LocalAppSection.Changes.id}>
        <ChangesView theme={theme} onNavigate={onTimelineNavigate} />
      </div>
      {view === DemoRouteView.ChangeDetail.wire && <ChangeDetailView theme={theme} onNavigate={onAppNavigate} />}
      {view === DemoRouteView.SessionDetail.wire && sessionAction && <SessionDestinationView sessionAction={sessionAction} />}
    </GraphAppShell>
  )
}

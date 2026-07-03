import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { TranscriptDetailView, ProfileView, getExploreFixture } from './CommonsExplore.jsx'
import { Explore } from '../../ui/commons/index.js'
import { PublishView, CollectivesView, CollectiveDetailView, CollectiveSettingsView, ContributeView } from './CommonsManage.jsx'

/* village (commons) demo parent: an internal nav over the browse + governance views built by the team.
   primary tabs reach the top-level surfaces; detail/contribute views open via onNavigate from clicks and
   carry a back affordance. each view is self-contained and accepts { theme, onNavigate }. */

const PRIMARY = [
  { id: 'explore', label: 'explore' },
  { id: 'collectives', label: 'collectives' },
  { id: 'publish', label: 'publish' },
  { id: 'profile', label: 'profile' },
]
/* detail views know which primary tab to return to */
const BACK_TO = {
  'transcript-detail': 'explore',
  'collective-detail': 'collectives',
  'collective-settings': 'collective-detail',
  contribute: 'collectives',
}

export default function CommonsApp({ theme }) {
  const [view, setView] = useState(() => {
    const initial = new URLSearchParams(window.location.search).get('commons')
    if (initial === 'collectives') return 'collectives'
    if (initial === 'collective-detail') return 'collective-detail'
    return initial === 'collective-settings' ? 'collective-settings' : 'explore'
  })
  const onNavigate = (v) => setView(v)
  const back = BACK_TO[view]

  return (
    <div className="iu-app-root">
      <nav className="iu-subnav" aria-label="village sections">
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
        {view === 'explore' && <Explore data={getExploreFixture()} />}
        {view === 'transcript-detail' && <TranscriptDetailView theme={theme} onNavigate={onNavigate} />}
        {view === 'profile' && <ProfileView theme={theme} onNavigate={onNavigate} />}
        {view === 'publish' && <PublishView theme={theme} onNavigate={onNavigate} />}
        {view === 'collectives' && (
          <CollectivesView
            theme={theme}
            onNavigate={onNavigate}
            actions={{ onOpenCollective: () => setView('collective-detail') }}
          />
        )}
        {view === 'collective-detail' && (
          <CollectiveDetailView
            theme={theme}
            onNavigate={onNavigate}
            actions={{
              onSettings: () => setView('collective-settings'),
              onContribute: () => setView('contribute'),
            }}
          />
        )}
        {view === 'collective-settings' && <CollectiveSettingsView theme={theme} onNavigate={onNavigate} />}
        {view === 'contribute' && <ContributeView theme={theme} onNavigate={onNavigate} />}
      </div>
    </div>
  )
}

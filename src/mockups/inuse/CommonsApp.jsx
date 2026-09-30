import { useMemo, useState } from 'react'
import { ChevronLeft, CircleUserRound } from 'lucide-react'
import { TranscriptDetailView, ProfileView, getExploreFixture } from './CommonsExplore.jsx'
import { Explore } from '../../ui/commons/index.js'
import { PublishView, ContributeView } from './CommonsManage.jsx'
import HelperGroupsDemo from './HelperGroupsDemo.jsx'
import { PullRequestView } from './CommonsPullRequest.jsx'
import {
  AccountSettingsView,
  CollectiveDetailView,
  CollectiveSettingsView,
  CollectivesView,
  SignInPage,
  VillageHome,
  VillageTranscriptView,
} from './CommonsPages.jsx'
import { demoTranscriptViewModel } from './TranscriptApp.jsx'

/* village (commons) demo parent. The nav is home and collectives, with an account link at its end.
   Detail pages open from clicks (onNavigate) and carry a back affordance. `?commons=<view>` opens a
   view directly. The earlier pages (explore, the publishing dashboard, the profile, bulk
   contribute and the older transcript page) leave the nav but keep their routes. */

const PRIMARY = [
  { id: 'home', label: 'home' },
  { id: 'collectives', label: 'collectives' },
]
/* detail views know which primary tab to return to */
const BACK_TO = {
  'transcript-detail': 'home',
  'pull-request': 'home',
  'collective-detail': 'collectives',
  'collective-settings': 'collective-detail',
  account: 'home',
  contribute: 'collective-detail',
  explore: 'home',
  'explore-transcript': 'explore',
  publish: 'home',
  profile: 'home',
}
const VIEWS = new Set(['signin', ...PRIMARY.map((p) => p.id), ...Object.keys(BACK_TO)])
const primaryOf = (view) => {
  let current = view
  while (current && !PRIMARY.some((p) => p.id === current)) current = BACK_TO[current]
  return current
}

export default function CommonsApp({ theme }) {
  const params = new URLSearchParams(window.location.search)
  const helperExample = params.get('helpers')
  const [view, setView] = useState(() => {
    const initial = params.get('commons')
    if (helperExample) return 'explore'
    return VIEWS.has(initial) ? initial : 'home'
  })
  const transcriptVm = useMemo(() => {
    const vm = demoTranscriptViewModel()
    return { ...vm, session: { ...vm.session, title: 'Fix flaky ingest test' } }
  }, [])
  const onNavigate = (v) => setView(v)
  const back = BACK_TO[view]
  const primary = primaryOf(view)

  if (view === 'signin') {
    return (
      <div className="iu-app-root">
        <div className="iu-view"><SignInPage onSignIn={() => setView('home')} /></div>
      </div>
    )
  }

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
            className={'iu-subnav-item' + (primary === p.id ? ' active' : '')}
            aria-current={view === p.id ? 'page' : undefined}
            onClick={() => setView(p.id)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={'iu-subnav-item iu-subnav-end' + (view === 'account' ? ' active' : '')}
          aria-current={view === 'account' ? 'page' : undefined}
          onClick={() => setView('account')}
        >
          <CircleUserRound size={14} aria-hidden="true" /> @alice-dev
        </button>
      </nav>
      <div className="iu-view">
        {view === 'home' && <VillageHome onNavigate={onNavigate} />}
        {view === 'collectives' && <CollectivesView actions={{ onOpenCollective: () => setView('collective-detail') }} />}
        {view === 'collective-detail' && (
          <CollectiveDetailView actions={{
            onSettings: () => setView('collective-settings'),
            onContribute: () => setView('contribute'),
            onOpenTranscript: () => setView('transcript-detail'),
            onOpenPullRequest: () => setView('pull-request'),
          }} />
        )}
        {view === 'collective-settings' && <CollectiveSettingsView />}
        {view === 'account' && <AccountSettingsView />}
        {view === 'transcript-detail' && <VillageTranscriptView viewModel={transcriptVm} theme={theme} onNavigate={onNavigate} />}
        {view === 'pull-request' && <PullRequestView />}
        {view === 'explore' && (helperExample
          ? <HelperGroupsDemo scenario={helperExample} />
          : <Explore data={getExploreFixture()} />)}
        {view === 'explore-transcript' && <TranscriptDetailView theme={theme} onNavigate={onNavigate} />}
        {view === 'profile' && <ProfileView theme={theme} onNavigate={onNavigate} />}
        {view === 'publish' && <PublishView theme={theme} onNavigate={onNavigate} />}
        {view === 'contribute' && <ContributeView theme={theme} onNavigate={onNavigate} />}
      </div>
    </div>
  )
}

import { ScrollText, Users, Waypoints } from 'lucide-react'
import Shell from '../../ui/inuse/InUseShell.jsx'
import TranscriptApp from './TranscriptApp.jsx'
import CommonsApp from './CommonsApp.jsx'
import GraphApp from './GraphApp.jsx'

/* the "in use" full-screen showcase: a full-viewport immersive stage that hosts the three sibling apps.
   a sticky top app-switcher banner REPLACES the page header (same height) and carries the brand mark + a
   keyboard-accessible tablist for the three apps (click, or keys 1/2/3) with a guarded crossfade. below the
   banner the stage fills the rest of the viewport and renders the active app full-bleed. each app owns its
   internal navigation so every feature stays reachable. */

const APPS = [
  { id: 'transcript', mark: 'transcript-browser', icon: ScrollText },
  { id: 'commons', mark: 'village', icon: Users },
  { id: 'graph', mark: 'peasant', icon: Waypoints },
]

export default function InUseShell({ theme }) {
  const initialApp = new URLSearchParams(window.location.search).get('app')
  return (
    <Shell
      apps={APPS}
      defaultApp={initialApp === 'commons' || initialApp === 'graph' ? initialApp : undefined}
      renderApp={(app) => (
        <>
          {app === 'transcript' && <TranscriptApp theme={theme} />}
          {app === 'commons' && <CommonsApp theme={theme} />}
          {app === 'graph' && <GraphApp theme={theme} />}
        </>
      )}
    />
  )
}

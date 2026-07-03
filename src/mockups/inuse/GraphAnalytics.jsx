/* MOCKUP - GRAPH / ANALYTICS (namespace .gan-*).
   The in-use analytics view renders the REAL <ProjectOverview> from the
   in-repo analytics surface (src/ui/analytics/, shipped as
   @peasant-labs/fairtrade/analytics) over a deterministic demo fixture — so
   this demo and the consuming apps exercise byte-identical composition +
   metric code, not two parallel implementations. Styling comes from the
   .gan-* rules in src/index.css (shipped to consumers as analytics.css). */

import { ProjectOverview } from '../../ui/analytics/index.js'
import { SAMPLE_SESSIONS } from '../../ui/analytics/fixtures.js'

/* The surface's canonical fixture, branded with the demo's project key. The
   fixture is the hand-checkable source of truth for every number on screen
   (e.g. the donut's "unknown" bucket comes from s7's absent outcome) — the
   demo must not fork its own copy and drift. */
const ANALYTICS_SESSIONS = SAMPLE_SESSIONS.map((session) => ({
  ...session,
  projectKey: 'peasant-labs/peasant',
}))

const ANALYTICS_PAYLOAD = { sessions: ANALYTICS_SESSIONS }

export function AnalyticsView({ theme }) {
  void theme // re-themes via fairtrade tokens; prop kept for parity with the other in-use views

  return (
    <ProjectOverview
      payload={ANALYTICS_PAYLOAD}
      title="project overview"
      subtitle="peasant-labs/peasant · 3 contributors · 8 sessions across 3 weeks"
      contributorLimit={10}
      footnote="every tile and every chart paints from design tokens, so the whole dashboard re-themes light/dark live. hover any bar, slice, point or area to read its value."
    />
  )
}

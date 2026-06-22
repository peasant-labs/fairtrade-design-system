import { useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import FacetRail from './FacetRail.jsx'

/* CSF3 stories for the faceted filter rail. tokens + chrome come from
   src/index.css via .storybook/preview.jsx; the theme toolbar flips data-theme.
   each story is stateful — a thin wrapper holds the order / activeProviders /
   activeTopics state so toggling a facet actually re-renders the rail, the way
   a real search page would wire it. Default rests with a couple of facets on;
   AllActive turns everything on (and shows the running count saturate); the
   play() test toggles a provider off→on and asserts the "N active" indicator
   tracks it. */

const meta = {
  title: 'in use/FacetRail',
  component: FacetRail,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
}
export default meta

/* the five agent providers fairtrade indexes, each with a session count. */
const PROVIDERS = [
  { slug: 'claude-code', count: 184 },
  { slug: 'gemini-cli', count: 92 },
  { slug: 'codex', count: 57 },
  { slug: 'opencode', count: 31 },
  { slug: 'cursor', count: 18 },
]

/* ~12 topic tags with deliberately varied usage counts so the weight buckets
   (1..4) are all exercised — the cloud should read big→small by count, not hue. */
const TOPICS = [
  { tag: 'refactor', count: 148 },
  { tag: 'bug', count: 121 },
  { tag: 'tests', count: 97 },
  { tag: 'css', count: 76 },
  { tag: 'storybook', count: 64 },
  { tag: 'a11y', count: 52 },
  { tag: 'tokens', count: 41 },
  { tag: 'migration', count: 33 },
  { tag: 'docs', count: 22 },
  { tag: 'deploy', count: 14 },
  { tag: 'perf', count: 9 },
  { tag: 'flaky', count: 4 },
]

/* a stateful host so the stories behave like the real wiring: it owns order +
   the two active sets and threads the toggle handlers into FacetRail. toggling
   a member of a Set clones it (so React sees a new reference and re-renders). */
function StatefulRail({
  initialOrder = 'recent',
  initialProviders = [],
  initialTopics = [],
}) {
  const [order, setOrder] = useState(initialOrder)
  const [activeProviders, setActiveProviders] = useState(
    () => new Set(initialProviders),
  )
  const [activeTopics, setActiveTopics] = useState(() => new Set(initialTopics))

  const toggle = (set, key) => {
    const next = new Set(set)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  }

  return (
    <FacetRail
      order={order}
      onOrder={setOrder}
      providers={PROVIDERS}
      activeProviders={activeProviders}
      onProvider={(slug) => setActiveProviders((s) => toggle(s, slug))}
      topics={TOPICS}
      activeTopics={activeTopics}
      onTopic={(tag) => setActiveTopics((s) => toggle(s, tag))}
      onClear={() => {
        setActiveProviders(new Set())
        setActiveTopics(new Set())
      }}
    />
  )
}

/* the canonical rail: order=recent, all five providers with counts, the full
   topic cloud, and a couple of facets pre-selected so the active count + the
   sticky clear-all are both visible at rest. */
export const Default = {
  render: () => (
    <StatefulRail
      initialOrder="recent"
      initialProviders={['claude-code']}
      initialTopics={['tests']}
    />
  ),
}

/* nothing selected — the rail at zero. the footer shows "0 active" and the
   clear-all is gated away (it only appears once a facet is on). */
export const Empty = {
  render: () => <StatefulRail />,
}

/* everything on: order=tokens, every provider + every topic active. the running
   count saturates and each active facet carries its non-color signal (the
   provider checks, the filled topic chips). */
export const AllActive = {
  render: () => (
    <StatefulRail
      initialOrder="tokens"
      initialProviders={PROVIDERS.map((p) => p.slug)}
      initialTopics={TOPICS.map((t) => t.tag)}
    />
  ),
}

/* play test: start with one provider (claude-code) active → "1 active". toggle
   a second provider (codex) on and assert the indicator climbs to 2 and the new
   row reads pressed; then toggle it back off and assert it returns to 1. */
export const TogglesProvider = {
  render: () => <StatefulRail initialProviders={['claude-code']} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const count = () => canvas.getByTestId('fr-active-n')

    // rests at one active facet; the clear-all is present because something is on.
    await expect(count()).toHaveTextContent('1')
    const clear = canvas.getByRole('button', { name: /clear all/i })
    await expect(clear).toBeInTheDocument()

    // codex starts unpressed.
    const codex = canvas.getByRole('button', { name: /codex/i })
    await expect(codex).toHaveAttribute('aria-pressed', 'false')

    // toggling it on flips aria-pressed and bumps the running count to 2.
    await userEvent.click(codex)
    await waitFor(() => expect(codex).toHaveAttribute('aria-pressed', 'true'))
    await waitFor(() => expect(count()).toHaveTextContent('2'))

    // toggling it back off returns the count to 1.
    await userEvent.click(codex)
    await waitFor(() => expect(codex).toHaveAttribute('aria-pressed', 'false'))
    await waitFor(() => expect(count()).toHaveTextContent('1'))
  },
}

/* Trajectory-graph legend — a thin ENGINE-side wrapper over the design system's
   presentation-only `GraphLegend` (the accent-swatch key).

   It maps the host's provider into the legend `items` so the assistant swatch and
   label match the provider used on the turn cards, and passes the
   `.tb-graph-legend` overlay class through for POSITIONING only; the swatch
   layout and typography stay owned by `GraphLegend`. The canonical set is
   you / agent / subagent / tool / error.

   Named `TrajectoryGraphLegend` because the visual it wraps is already exported
   as `GraphLegend`; both ship from this package, so the wrapper carries the
   engine-scoped name. */

import { GraphLegend } from '../GraphLegend.jsx'
import { providerDisplayName } from '../../../provider-policy.js'

/**
 * @typedef {object} TrajectoryGraphLegendProps
 * @property {import('@peasant-labs/schema').Harness} [provider]
 *   canonical harness; sets the assistant swatch accent + label to match the turn cards
 * @property {string} [className]
 */

/**
 * @param {TrajectoryGraphLegendProps} props
 * @returns {JSX.Element}
 */
export function TrajectoryGraphLegend({ provider, className = '' }) {
  const agentLabel = (provider && providerDisplayName(provider).toLocaleLowerCase('en-US')) || 'agent'
  const cls = ['tb-graph-legend', className].filter(Boolean).join(' ')
  return (
    <GraphLegend
      className={cls}
      items={[
        { kind: 'user', label: 'you' },
        { kind: 'assistant', label: agentLabel, provider },
        { kind: 'subagent', label: 'subagent' },
        { kind: 'tool', label: 'tool' },
        { kind: 'error', label: 'error' },
      ]}
    />
  )
}

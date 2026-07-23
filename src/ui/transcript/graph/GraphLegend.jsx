/* GraphLegend — the trajectory-graph key VISUAL (presentation-only): a row of
   tiny accent swatches naming each node kind. Lifted from the mockup's
   `.txn-graph-legend`. Color is never the sole signal — every swatch is paired
   with a lowercase word — so the legend reads in full monochrome too.

   Each item carries a `kind` (which selects the swatch accent) and a `label`
   (the word). Assistant items may pass a `provider` so the swatch matches the
   per-provider accent used on the turn cards. The default set mirrors the
   mockup: you · agent · subagent · tool · error. */

import { providerAccent } from '../../provider-policy.js'

/**
 * One legend entry.
 * @typedef {object} GraphLegendItem
 * @property {'user' | 'assistant' | 'subagent' | 'tool' | 'error' | (string & {})} kind
 *   the node kind this swatch stands for; selects the accent
 * @property {string} label                    the lowercase word shown beside the swatch
 * @property {import('@peasant-labs/schema').Harness} [provider] canonical harness → assistant swatch accent
 */

/**
 * @typedef {object} GraphLegendProps
 * @property {GraphLegendItem[]} [items]       legend entries (defaults to GRAPH_LEGEND_ITEMS)
 * @property {string} [className]
 */

/** The canonical legend set, in display order — mirrors the mockup's legend. */
export const GRAPH_LEGEND_ITEMS = Object.freeze([
  { kind: 'user', label: 'you' },
  { kind: 'assistant', label: 'agent' },
  { kind: 'subagent', label: 'subagent' },
  { kind: 'tool', label: 'tool' },
  { kind: 'error', label: 'error' },
])

/** Map a legend item to its accent token, mirroring GraphTurnNode's accents.
 *  `tool` has no fill (a hairline swatch), so it returns null. */
function swatchToken({ kind, provider }) {
  switch (kind) {
    case 'user':
      return 'teal'
    case 'assistant':
      return provider === undefined ? 'amber' : providerAccent(provider)
    case 'subagent':
      return 'mauve'
    case 'error':
      return 'clay'
    default:
      return null
  }
}

/**
 * The trajectory-graph legend visual.
 * @param {GraphLegendProps} props
 * @returns {JSX.Element}
 */
export function GraphLegend({ items = GRAPH_LEGEND_ITEMS, className = '' }) {
  const cls = ['ft-graph-legend', className].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      {items.map((item) => {
        const token = swatchToken(item)
        const style = token ? { background: `var(--${token})` } : undefined
        return (
          <span className="ft-graph-legend-item" key={item.kind + ':' + item.label}>
            <span
              className="ft-graph-legend-glyph"
              data-kind={item.kind}
              style={style}
              aria-hidden="true"
            />
            <span>{item.label}</span>
          </span>
        )
      })}
    </div>
  )
}

export default GraphLegend

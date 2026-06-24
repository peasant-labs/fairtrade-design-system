import './StatTiles.css'

/* StatTiles — the governance / KPI surface of a collective hub, ported in intent from village's
   collective-detail page (its governance tiles + KPI tiles + provider distribution bars). Four
   pieces that compose into the top of an overview:

     StatTile     a square hairline KPI tile: a small mono eyebrow label, one big display-font
                  tabular number, an optional sub line. the metric, stated plainly.
     StatGrid     an auto-fit grid of tiles (min ~160px) — the KPI row.
     GovTile      a governance variant: label + value + icon, the value carrying an optional,
                  scarce earth-tone accent (access / contributions / your-role).
     ProviderBars labeled horizontal distribution bars — provider name + a MONOCHROME bar
                  (width ∝ value/total) + a % (tabular). read by weight + label, never colour.

   DESIGN_SYSTEM (fairtrade): tokens only, hairline, square (radius 0), mono/display type, calm.
   Bars are a single ink weight — a color-mix of --ink-strong over --surface, NOT a hue ramp — so
   a row is told apart by its length + its written value, never by colour (neuroinclusive: the bar
   is labelled with its own %, and carries an accessible name; nothing rides on colour alone). The
   one sanctioned accent is amber, scarce, reserved for a "scarce"-toned governance value. Namespaced
   `st-`. Motion only behind prefers-reduced-motion: no-preference; focus uses focus-visible only. */

/** The earth-tone accents a GovTile value may carry. Anything else (or omitted) reads as plain ink. */
const GOV_TONES = new Set(['amber', 'teal', 'olive', 'clay', 'mauve'])

/**
 * StatTile — one KPI: a mono eyebrow label, a big tabular display number, an optional sub line.
 *
 * @param {object} props
 * @param {string} props.label - the metric name (lowercase chrome; e.g. "transcripts").
 * @param {React.ReactNode} props.value - the headline figure (USER CONTENT — pre-formatted, e.g. "4.2M").
 * @param {React.ReactNode} [props.sub] - an optional secondary line under the value (e.g. "9,610 turns").
 * @param {React.ComponentType<{className?: string}>} [props.icon] - optional lucide icon for the label row.
 * @param {string} [props.className] - extra classes appended to the root.
 */
export function StatTile({ label, value, sub, icon: Icon, className = '', ...rest }) {
  const cls = ['st-tile', className].filter(Boolean).join(' ')
  return (
    <div className={cls} {...rest}>
      <p className="st-eyebrow">
        {Icon && <Icon className="st-eyebrow-ic" aria-hidden="true" />}
        {label}
      </p>
      <p className="st-value tnum">{value}</p>
      {sub != null && sub !== '' && <p className="st-sub tnum">{sub}</p>}
    </div>
  )
}

/**
 * @typedef {object} TileSpec
 * @property {string} key - stable key for the tile.
 * @property {string} label - the metric name.
 * @property {React.ReactNode} value - the headline figure.
 * @property {React.ReactNode} [sub] - optional sub line.
 * @property {React.ComponentType<{className?: string}>} [icon] - optional label icon.
 */

/**
 * StatGrid — a responsive grid of StatTiles with a STABLE, capped column count (1→4 across
 * breakpoints) so tiles keep equal widths and their eyebrows wrap consistently. The grid keys
 * off its own width via a thin query-container wrapper (an element cannot query a container it
 * establishes itself), so it stays correct wherever it is dropped — not just at the page width.
 *
 * @param {object} props
 * @param {TileSpec[]} props.tiles - the KPI tiles to render, in order.
 * @param {string} [props.className] - extra classes appended to the grid.
 */
export function StatGrid({ tiles = [], className = '', ...rest }) {
  const cls = ['st-grid', className].filter(Boolean).join(' ')
  return (
    <div className="st-grid-wrap">
      <div className={cls} {...rest}>
        {tiles.map(({ key, label, value, sub, icon }) => (
          <StatTile key={key ?? label} label={label} value={value} sub={sub} icon={icon} />
        ))}
      </div>
    </div>
  )
}

/**
 * GovTile — a governance fact: a mono eyebrow label, an icon, and a value that may carry one
 * scarce earth-tone accent (e.g. amber for a "members only" / scarce policy). The value is mono,
 * not the big display number — governance reads as a stated setting, not a metric.
 *
 * @param {object} props
 * @param {string} props.label - the governance dimension (e.g. "access", "your role").
 * @param {React.ReactNode} props.value - the setting (USER CONTENT — e.g. "members only", "contributor").
 * @param {React.ComponentType<{className?: string}>} [props.icon] - optional lucide icon for the label row.
 * @param {'amber'|'teal'|'olive'|'clay'|'mauve'} [props.tone] - optional earth-tone accent on the value.
 * @param {string} [props.className] - extra classes appended to the root.
 */
export function GovTile({ label, value, icon: Icon, tone, className = '', ...rest }) {
  const toned = tone && GOV_TONES.has(tone) ? tone : null
  const cls = ['st-gov', className].filter(Boolean).join(' ')
  return (
    <div className={cls} {...rest}>
      <p className="st-eyebrow">
        {Icon && <Icon className="st-eyebrow-ic" aria-hidden="true" />}
        {label}
      </p>
      <p className="st-gov-value" data-tone={toned || undefined}>
        {value}
      </p>
    </div>
  )
}

/**
 * @typedef {object} ProviderDatum
 * @property {string} label - provider name (USER CONTENT — case preserved; e.g. "claude-code").
 * @property {number} value - this provider's count.
 */

/**
 * ProviderBars — a labeled horizontal distribution. Each row is a provider name, a monochrome bar
 * whose width is its share of `total`, and a tabular %. Bars are one ink weight (no per-row hue):
 * the eye reads length + label + the written %, so the distribution survives greyscale and AT.
 *
 * @param {object} props
 * @param {ProviderDatum[]} props.data - the providers, in the order to display (caller pre-sorts).
 * @param {number} [props.total] - the denominator for the shares; defaults to the sum of values.
 * @param {string} [props.label='provider distribution'] - accessible name for the list (lowercase chrome).
 * @param {string} [props.className] - extra classes appended to the root.
 */
export function ProviderBars({
  data = [],
  total,
  label = 'provider distribution',
  className = '',
  ...rest
}) {
  const sum = data.reduce((acc, d) => acc + (d.value || 0), 0)
  const denom = total ?? sum
  const cls = ['st-bars', className].filter(Boolean).join(' ')

  if (data.length === 0) {
    return (
      <div className={cls} {...rest}>
        <p className="st-bars-empty">no providers to show.</p>
      </div>
    )
  }

  return (
    <div className={cls} role="list" aria-label={label} {...rest}>
      {data.map((d) => {
        const raw = denom > 0 ? (d.value / denom) * 100 : 0
        const pct = Math.round(raw)
        // A non-zero share never renders as an invisible sliver — floor the drawn width at 1%.
        const fillW = raw > 0 ? Math.max(raw, 1) : 0
        return (
          <div
            className="st-bar-row"
            role="listitem"
            key={d.label}
            // The bar is labelled by its value, so the percentage is never colour-only.
            aria-label={`${d.label}: ${pct}%`}
          >
            <span className="st-bar-name" title={d.label}>
              {d.label}
            </span>
            <span className="st-bar-track" aria-hidden="true">
              <span className="st-bar-fill" style={{ width: `${fillW}%` }} />
            </span>
            <span className="st-bar-pct tnum">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

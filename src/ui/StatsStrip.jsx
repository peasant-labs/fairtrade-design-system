import './StatsStrip.css'

/* StatsStrip (.sst-*) — one inline row of stat pairs, each a value and its label: the summary
   line above a list ("1,284 sessions  7 projects  38 published  longest streak 3 wk"). It is the
   quiet alternative to stat tiles: no boxes, no big numerals, one line that wraps at narrow
   widths. Values are tabular. The host formats every value (counts, durations, sizes); a bare
   number is grouped with the en-US thousands separator. Pairs read value-first by default
   ("1,284 sessions"); `order: 'label-first'` suits a phrase such as "longest streak 3 wk".
   Separation is spacing plus a 1px hairline, never a middot glyph. Nothing renders for no pairs. */

const formatValue = (value) => (typeof value === 'number' ? value.toLocaleString('en-US') : value)

/**
 * @typedef {object} StatsStripItem
 * @property {string} label - lowercase chrome naming the value ("sessions", "longest streak").
 * @property {string | number} value - the host-formatted value; a number is grouped (1284 -> 1,284).
 * @property {'value-first' | 'label-first'} [order='value-first'] - reading order of the pair.
 */

/**
 * @param {object} props
 * @param {StatsStripItem[]} props.items - the pairs, in reading order.
 * @param {string} [props.label='summary'] - the list's accessible name.
 * @param {string} [props.className]
 */
export default function StatsStrip({ items, label = 'summary', className = '', ...rest }) {
  if (!Array.isArray(items) || items.length === 0) return null
  const cls = ['sst', className].filter(Boolean).join(' ')
  return (
    <ul className={cls} aria-label={label} {...rest}>
      {items.map((item, index) => {
        const value = <span className="sst-value tnum">{formatValue(item.value)}</span>
        const name = <span className="sst-label">{item.label}</span>
        return (
          <li key={`${item.label}-${index}`} className="sst-pair">
            {item.order === 'label-first' ? <>{name} {value}</> : <>{value} {name}</>}
          </li>
        )
      })}
    </ul>
  )
}

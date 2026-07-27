import { MapNode, IntensityScope } from '../Intensity.jsx'
import ScentTag from './ScentTag.jsx'
import './timelinePrimitives.css'

/* RankedRow is one row of the ranked entry list: name, a DOI meter (the
   existing Intensity `MapNode` square, reused rather than a bespoke gauge),
   scent tags, and tabular meta. Selecting a row is the caller's job (onSelect);
   this component only renders + reports the gesture, per the frozen-elsewhere
   reducer contract (`open-in-map`-family action lives in the caller). */

/**
 * @param {object} props
 * @param {import('./ranking.js').RankedRow} props.row
 * @param {number} props.loc - lines of code, feeds the reused `MapNode` size class.
 * @param {boolean} [props.selected]
 * @param {(id: string) => void} [props.onSelect]
 * @param {string} [props.className]
 */
export default function RankedRow({ row, loc = 0, selected = false, onSelect, className = '', ...rest }) {
  const cls = ['tlp-ranked-row', selected && 'tlp-ranked-row-sel', className].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={cls}
      aria-pressed={selected}
      onClick={() => onSelect?.(row.id)}
      {...rest}
    >
      {/* MapNode needs the `--ir-*` ramp custom properties, which only
           IntensityScope defines. MapNode does not self-scope them (only
          Intensity.jsx's own Heatmap/RampLegend do). Without this wrapper the
          fill + text colors resolve to `initial` (invisible text). */}
      <IntensityScope className="tlp-ranked-doi-scope">
        <MapNode label={row.name} loc={loc} recorded={row.doi} total={1} selected={selected} as="span" className="tlp-ranked-doi" />
      </IntensityScope>
      <span className="tlp-ranked-name" title={row.name}>{row.name}</span>
      <span className="tlp-ranked-tags" aria-label="comprehension signals">
        {row.scentTags.map((tag) => (
          <ScentTag key={tag} tag={tag} hoverText={tag.startsWith('agent wrote:') ? row.hoverText ?? undefined : undefined} />
        ))}
      </span>
      <span className="tlp-ranked-doi-val tnum" aria-hidden="true">{row.doi.toFixed(2)}</span>
    </button>
  )
}

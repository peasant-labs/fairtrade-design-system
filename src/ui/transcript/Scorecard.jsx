import { ShieldCheck, Coins, FileText, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

/* Scorecard — the "how this session went" verdict grid on the highlights tab, lifted from the
   canonical mockup (src/mockups/inuse/TranscriptApp.jsx:827). DUMB + render-when-present: it
   renders the cooked `ScorecardBandVM[]` the analytics util derived (`vm.analytics.scorecardBands`)
   and returns null when there are none, so the highlights tab degrades to just its cards. Each
   band carries a display `band` verdict → a token chip; `value` is the headline.

   The per-axis chrome is RENDER-WHEN-PRESENT, so the SAME component covers both shapes:
     • the lean analytics shape (id/label/band/value/detail) — a single `detail` sub-line;
     • the richer curated shape (+ `icon`/`flags`/`delta`) — the axis glyph, the per-axis flag
       LIST, and the trend-vs-median delta the canonical mockup draws.
   A consumer (the demo, or a backend that computes the nicety) supplies the rich fields; TB's
   leaner derived bands omit them and degrade to the headline + band chip + `detail`. */

/** @typedef {import('./view-model.js').ScorecardBandVM} ScorecardBandVM */

/* cooked band id → verdict label + token chip (no raw colour; the word carries the meaning). */
const BAND_META = {
  good: { label: 'on track', chip: 'chip-ok' },
  ok: { label: 'on track', chip: 'chip-ok' },
  watch: { label: 'watch', chip: 'chip-warn' },
  bad: { label: 'off track', chip: 'chip-err' },
}

/* semantic axis-icon key → glyph (mirrors the mockup's per-axis icons). */
const AXIS_ICON = { token: Coins, prompt: FileText, loop: RefreshCw }

/**
 * @param {object} props
 * @param {ScorecardBandVM[]} [props.bands]   the cooked scorecard bands (vm.analytics.scorecardBands)
 */
export default function Scorecard({ bands = [] }) {
  if (!bands || bands.length === 0) return null
  return (
    <div className="txn-scorecard">
      <div className="txn-sc-head">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>how this session went</span>
      </div>
      <div className="txn-sc-grid">
        {bands.map((s) => {
          const meta = BAND_META[s.band] ?? { label: s.band, chip: '' }
          const Icon = s.icon ? AXIS_ICON[s.icon] : null
          const Trend = s.delta ? (s.delta.dir === 'up' ? TrendingUp : TrendingDown) : null
          return (
            <div className="txn-sc-card" key={s.id}>
              <div className="txn-sc-axis">{Icon && <Icon size={14} aria-hidden="true" />} {s.label}</div>
              {s.value != null && <div className="txn-sc-headline">{s.value}</div>}
              <span className={'chip txn-sc-band ' + meta.chip}>{meta.label}</span>
              {s.flags && s.flags.length > 0 ? (
                <ul className="txn-sc-flags">
                  {s.flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : s.detail ? (
                <ul className="txn-sc-flags">
                  <li>{s.detail}</li>
                </ul>
              ) : null}
              {s.delta && Trend && (
                <div className={'txn-sc-delta ' + (s.delta.dir === 'up' ? 'txn-up' : 'txn-down')}>
                  <Trend size={13} aria-hidden="true" /> {s.delta.text}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

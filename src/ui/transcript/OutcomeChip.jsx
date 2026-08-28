import { ShieldCheck, CircleDot, AlertTriangle } from 'lucide-react'

/* OutcomeChip — the reusable component form of the session-outcome chip
   TranscriptViewer renders inline in its header (`session.outcome && <span
   className="chip chip-ok">…`). Maps every outcome/label string shape a
   backend may emit — `SessionOutcome` (`resolved`/`partial`/`failed`),
   annotation outcome values (`resolved`/`not_resolved`), and the binary
   label (`positive`/`negative`) — onto one normalised tone + icon + label,
   riding the existing `.chip`/`.chip-ok`/`.chip-warn`/`.chip-err` chassis
   (tokens only, no hardcoded colour). Renders nothing for an unknown/absent
   outcome. ──────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} OutcomeVisual
 * @property {React.ElementType} icon
 * @property {'ok' | 'warn' | 'err'} chipTone
 * @property {string} label
 */

/** @type {Record<string, OutcomeVisual>} */
const OUTCOME_VISUALS = {
  resolved: { icon: ShieldCheck, chipTone: 'ok', label: 'resolved' },
  positive: { icon: ShieldCheck, chipTone: 'ok', label: 'resolved' },
  partial: { icon: CircleDot, chipTone: 'warn', label: 'partial' },
  failed: { icon: AlertTriangle, chipTone: 'err', label: 'not resolved' },
  not_resolved: { icon: AlertTriangle, chipTone: 'err', label: 'not resolved' },
  negative: { icon: AlertTriangle, chipTone: 'err', label: 'not resolved' },
}

/**
 * Render a session outcome as a semantically-toned chip. Renders nothing for
 * an unknown / absent outcome, so a caller can gate on the element rather than
 * pre-checking the value (matching the prior inline `session.outcome &&` guard).
 *
 * @param {object} props
 * @param {string} [props.outcome]     outcome / label string — see `OUTCOME_VISUALS`
 * @param {string} [props.className]   extra classes appended after the chip classes
 */
export default function TranscriptOutcomeChip({ outcome, className = '' }) {
  const visual = outcome ? OUTCOME_VISUALS[outcome] : undefined
  if (!visual) return null
  const Icon = visual.icon
  const cls = ['chip', `chip-${visual.chipTone}`, className].filter(Boolean).join(' ')
  return (
    <span className={cls} title={`outcome · ${visual.label}`}>
      <Icon size={14} aria-hidden="true" /> {visual.label}
    </span>
  )
}

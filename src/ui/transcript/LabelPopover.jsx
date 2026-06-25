import { useEffect, useRef, useState } from 'react'
import { Flag } from 'lucide-react'

/* LabelPopover — the per-turn labelling overlay, lifted verbatim from the canonical mockup
   (src/mockups/inuse/TranscriptApp.jsx:1917). DUMB: the outcome/flag selections are local form
   state (seeded from `current`); on save it reports the cooked `SavedLabel` back through
   `onSave(outcome, flag)`. Closes on outside-click or Escape. The composite renders this ONLY
   when `capabilities.canLabel` is true, so a labelling action can never fire without the
   capability. Exported as `TranscriptLabelPopover`. */

/** @typedef {import('./state-capabilities.js').SavedLabel} SavedLabel */

const OUTCOMES = [['good', 'good'], ['neutral', 'neutral'], ['bad', 'bad']]
const FLAGS = [['', 'none'], ['error', 'error'], ['retry-loop', 'retry loop'], ['revert', 'revert'], ['highlight', 'highlight']]

/**
 * @param {object} props
 * @param {number} [props.turnId]                                  the turn index being labelled
 * @param {SavedLabel} [props.current]                             the existing label, if any
 * @param {(outcome: SavedLabel['outcome'], flag: string) => void} [props.onSave]
 * @param {Function} [props.onClose]
 */
export default function LabelPopover({ turnId, current, onSave = () => {}, onClose = () => {} }) {
  const [outcome, setOutcome] = useState(current?.outcome || 'neutral')
  const [flag, setFlag] = useState(current?.flag || '')
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [onClose])
  return (
    <div className="txn-label-scrim">
      <div className="pop-card txn-label-pop" ref={ref}>
        <div className="pop-head">
          <Flag size={14} aria-hidden="true" />
          <span className="pop-title">label turn {turnId}</span>
        </div>
        <div className="pop-body">
          <div>
            <span className="txn-label-cap">outcome</span>
            <div className="bs-seg txn-label-seg">
              {OUTCOMES.map(([v, l]) => (
                <button key={v} type="button" className="bs-seg-opt" aria-pressed={outcome === v} onClick={() => setOutcome(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="txn-label-cap">flag</span>
            <div className="txn-label-flags">
              {FLAGS.map(([v, l]) => (
                <button key={v || 'none'} type="button" className={'chip txn-label-flag' + (flag === v ? ' txn-flag-on' : '')} aria-pressed={flag === v} onClick={() => setFlag(v)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="pop-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave(outcome, flag)}>save label</button>
        </div>
      </div>
    </div>
  )
}

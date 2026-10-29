import { useId, useState } from 'react'
import { Circle, CircleCheck, Loader } from 'lucide-react'

/* a real, accessible toggle (the interactive version of the .sw-field specimen in
   sections/36-states.html). a button role="switch" with aria-checked carries the
   state; the track's inverted fill and the thumb's side show it without colour. State
   words are omitted by default so labels stay fixed when toggled. The optional .sw-state
   marker remains available for hosts that explicitly request it. Space,
   Enter, and click toggle. supports controlled (checked + onChange) and uncontrolled
   (defaultChecked). reuses the .sw / .sw-field / .sw-label / .sw-state styles; inline progress stays
   inside the control. note: the control class is .sw (the swatch chip elsewhere is .swc). */

/**
 * @typedef {Object} SwitchProps
 * @property {boolean} [checked]        controlled on/off state; pair with onChange.
 * @property {boolean} [defaultChecked=false] initial state when uncontrolled.
 * @property {(next: boolean) => void} [onChange] called with the next state on toggle.
 * @property {boolean} [disabled=false] real `disabled` attribute (dim, not focusable).
 * @property {boolean} [busy=false]     sets aria-busy and shows progress without moving the label.
 * @property {React.ReactNode} [label]  text rendered in the associated .sw-label.
 * @property {string} [onText='on']     state-marker text shown when checked.
 * @property {string} [offText='off']   state-marker text shown when unchecked.
 * @property {React.ComponentType<{size?: number}>} [stateIcon] override icon for the
 *           .sw-state marker; defaults to CircleCheck (on) / Circle (off).
 * @property {string} [id]              id for the control; links the label's `for`.
 * @property {boolean} [stateMarker=false] show the on/off word beside the switch; off where the
 *           host already says the state (a settings row).
 */

/**
 * @param {SwitchProps} props
 */
export default function Switch({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  busy = false,
  label,
  onText = 'on',
  offText = 'off',
  stateIcon: StateIcon,
  id,
  stateMarker = false,
}) {
  const [internal, setInternal] = useState(defaultChecked)
  const isControlled = checked !== undefined
  const on = isControlled ? checked : internal

  const autoId = useId()
  const swId = id ?? autoId

  const toggle = () => {
    if (disabled || busy) return
    const next = !on
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  // Space and Enter both activate a button, so a native click handler covers
  // keyboard toggling, no extra keydown wiring needed (matches the source button).
  // busy swaps to a spinning Loader so the affordance matches the 36-states specimen;
  // the spin is gated under prefers-reduced-motion in CSS (.sw-busy-spin).
  const Icon = busy ? Loader : (StateIcon ?? (on ? CircleCheck : Circle))

  return (
    <div className="sw-field">
      <button
        type="button"
        className="sw"
        role="switch"
        id={swId}
        aria-checked={on}
        aria-busy={busy || undefined}
        disabled={disabled}
        onClick={toggle}
      >
        {busy && !stateMarker && <span className="sw-busy-indicator" aria-hidden="true"><Loader className="sw-busy-spin" /></span>}
      </button>
      {label != null && (
        <label className="sw-label" htmlFor={swId}>
          {label}
        </label>
      )}
      {/* Hosts that supply their own label also own the surrounding save status. */}
      {!stateMarker && label != null && <span className="sr-only" role="status">{busy ? 'updating' : ''}</span>}
      {stateMarker && (
        <span className="sw-state" aria-live={busy ? 'polite' : undefined}>
          <Icon className={busy ? 'sw-busy-spin' : undefined} aria-hidden="true" />{' '}
          {on ? onText : offText}
        </span>
      )}
    </div>
  )
}

import { useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import './PolicySelect.css'

/* governance policy selector: a labelled enum control where every option carries a one-line
   rationale, modelled on village's collective create/settings forms (acceptance mode, data
   access, transcript retention on leave). two variants:

     radio  — a vertical radio group, each row a square marker (filled ● / empty ○) + a bold
              mono label + a dim one-line rationale beneath. roving-tabindex + arrow-key nav
              per the WAI-ARIA radiogroup pattern; the container is role=radiogroup, each row
              role=radio with aria-checked. the marker is the native, non-colour selection cue
              (a drawn dot, not just amber) so selection never reads by colour alone (WCAG 1.4.1).
     select — a styled native <select> at one control height with a trailing decorative chevron;
              the chosen option's rationale shows beneath the control.

   both support controlled (value + onChange) and uncontrolled (defaultValue) use. all classes
   are namespaced pol-; every dimension/colour comes from a token in src/index.css. */

/**
 * @typedef {Object} PolicyOption
 * @property {string} value                 the value submitted / matched when selected.
 * @property {import('react').ReactNode} label     the bold option label (mono).
 * @property {import('react').ReactNode} [rationale] one-line plain-prose explanation (body font).
 * @property {boolean} [disabled]           native disabled state for this option.
 */

/**
 * @typedef {Object} PolicySelectProps
 * @property {import('react').ReactNode} label   the field label above the control (mono, lowercase chrome).
 * @property {string} name                       form name; the shared radio group name in the radio variant.
 * @property {string} [value]                    controlled selected value; pair with onChange.
 * @property {string} [defaultValue]             initial value for uncontrolled use.
 * @property {(value: string) => void} [onChange] called with the next value on selection.
 * @property {PolicyOption[]} options            the choices to render (each {value,label,rationale}).
 * @property {'radio'|'select'} [variant='radio'] layout: a rationale-per-row radio group, or a native select.
 * @property {import('react').ReactNode} [hint]  optional one-line helper beneath the label.
 * @property {string} [id]                       id for the control / radiogroup; auto-generated when omitted.
 */

/**
 * A governance policy selector. See PolicySelectProps.
 * @param {PolicySelectProps} props
 */
export default function PolicySelect({
  label,
  name,
  value,
  defaultValue,
  onChange,
  options = [],
  variant = 'radio',
  hint,
  id,
}) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue)
  const selected = isControlled ? value : internal

  const autoId = useId()
  const fieldId = id ?? autoId
  const labelId = `${fieldId}-label`
  const hintId = hint != null ? `${fieldId}-hint` : undefined

  const select = (next) => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  return (
    <div className="pol">
      <span className="pol-label" id={labelId}>
        {label}
      </span>
      {hint != null && (
        <span className="pol-hint" id={hintId}>
          {hint}
        </span>
      )}
      {variant === 'select' ? (
        <SelectVariant
          name={name}
          fieldId={fieldId}
          labelId={labelId}
          hintId={hintId}
          options={options}
          selected={selected}
          onSelect={select}
        />
      ) : (
        <RadioVariant
          name={name}
          labelId={labelId}
          hintId={hintId}
          options={options}
          selected={selected}
          onSelect={select}
        />
      )}
    </div>
  )
}

/* radio variant — a role=radiogroup of role=radio rows. roving tabindex: only the checked row
   (or the first enabled row, if none is checked yet) is tabbable; arrow keys move selection to
   the next/previous enabled row and focus it, matching the native radiogroup keyboard contract. */
function RadioVariant({ name, labelId, hintId, options, selected, onSelect }) {
  const rowsRef = useRef([])

  const enabledIndices = options
    .map((o, i) => (o.disabled ? -1 : i))
    .filter((i) => i !== -1)

  const checkedIndex = options.findIndex((o) => o.value === selected && !o.disabled)
  // the single tab stop: the checked row, else the first enabled row (WAI-ARIA roving tabindex).
  const tabbableIndex = checkedIndex !== -1 ? checkedIndex : (enabledIndices[0] ?? -1)

  const moveTo = (index) => {
    const opt = options[index]
    if (!opt || opt.disabled) return
    onSelect(opt.value)
    rowsRef.current[index]?.focus()
  }

  const handleKeyDown = (e, index) => {
    const pos = enabledIndices.indexOf(index)
    if (pos === -1) return
    let nextPos = null
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextPos = (pos + 1) % enabledIndices.length
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        nextPos = (pos - 1 + enabledIndices.length) % enabledIndices.length
        break
      case ' ':
      case 'Enter':
        e.preventDefault()
        onSelect(options[index].value)
        return
      default:
        return
    }
    e.preventDefault()
    moveTo(enabledIndices[nextPos])
  }

  return (
    <div
      className="pol-radios"
      role="radiogroup"
      aria-labelledby={labelId}
      aria-describedby={hintId}
    >
      {options.map((opt, index) => {
        const checked = opt.value === selected && !opt.disabled
        const rationaleId = opt.rationale != null ? `${name}-${opt.value}-why` : undefined
        return (
          <div
            key={opt.value}
            ref={(el) => {
              rowsRef.current[index] = el
            }}
            className="pol-row"
            role="radio"
            aria-checked={checked}
            aria-disabled={opt.disabled || undefined}
            aria-describedby={rationaleId}
            data-checked={checked || undefined}
            data-disabled={opt.disabled || undefined}
            tabIndex={!opt.disabled && index === tabbableIndex ? 0 : -1}
            onClick={() => !opt.disabled && onSelect(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {/* the marker IS the non-colour cue: a filled square dot when checked, hollow when not */}
            <span className="pol-marker" aria-hidden="true">
              <span className="pol-marker-dot" />
            </span>
            <span className="pol-text">
              <span className="pol-opt-label">{opt.label}</span>
              {opt.rationale != null && (
                <span className="pol-rationale" id={rationaleId}>
                  {opt.rationale}
                </span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* select variant — a styled native <select> (one control height, hairline border) plus the
   chosen option's rationale beneath. native options can't carry rich rationale, so the rationale
   line lives below the control and tracks the current selection. */
function SelectVariant({ name, fieldId, labelId, hintId, options, selected, onSelect }) {
  const current = options.find((o) => o.value === selected)
  const rationaleId = current?.rationale != null ? `${fieldId}-why` : undefined
  const describedBy = [hintId, rationaleId].filter(Boolean).join(' ') || undefined

  return (
    <>
      <div className="pol-select-wrap">
        <select
          id={fieldId}
          name={name}
          className="pol-select"
          value={selected ?? ''}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          onChange={(e) => onSelect(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pol-caret" aria-hidden="true" />
      </div>
      {current?.rationale != null && (
        <span className="pol-rationale pol-select-rationale" id={rationaleId}>
          {current.rationale}
        </span>
      )}
    </>
  )
}

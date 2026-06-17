import { useState } from 'react'

/* checkbox + radio, ported from the controls / states canvas specimens. the styled box and dot ARE
   the native inputs (appearance:none; the .check-box / .is-radio-dot ::after pseudo-element draws the
   tick and the dot), so we never render a custom box element — only the real <input>. disabled styling
   comes from the CSS :has(:disabled) selectors off the native attribute. all support controlled
   (checked/value + onChange) and uncontrolled (defaultChecked/defaultValue) use. */

/**
 * @typedef {Object} CheckboxProps
 * @property {boolean} [checked]        controlled checked state (pair with onChange)
 * @property {boolean} [defaultChecked] initial state for uncontrolled use (default false)
 * @property {(checked: boolean, event: import('react').ChangeEvent<HTMLInputElement>) => void} [onChange]
 * @property {boolean} [disabled]       native disabled attribute (default false)
 * @property {import('react').ReactNode} [children] label text (rendered as passed, not lowercased)
 */

/**
 * A single checkbox: <label class="check"> wrapping the styled <input type="checkbox" class="check-box">.
 * @param {CheckboxProps & import('react').InputHTMLAttributes<HTMLInputElement>} props
 */
export default function Checkbox({ checked, defaultChecked = false, onChange, disabled = false, children, ...rest }) {
  const isControlled = checked !== undefined
  const [internal, setInternal] = useState(defaultChecked)
  const value = isControlled ? checked : internal

  const handleChange = (e) => {
    if (!isControlled) setInternal(e.target.checked)
    onChange?.(e.target.checked, e)
  }

  return (
    <label className="check">
      <input
        type="checkbox"
        className="check-box"
        checked={value}
        disabled={disabled}
        onChange={handleChange}
        {...rest}
      />{' '}
      {children}
    </label>
  )
}

/**
 * @typedef {Object} RadioProps
 * @property {string} [name]            shared group name (so only one in a group is selectable)
 * @property {string} [value]           the value submitted / matched when this radio is selected
 * @property {boolean} [checked]        controlled checked state (pair with onChange)
 * @property {boolean} [defaultChecked] initial state for uncontrolled use (default false)
 * @property {(event: import('react').ChangeEvent<HTMLInputElement>) => void} [onChange]
 * @property {boolean} [disabled]       native disabled attribute (default false)
 * @property {import('react').ReactNode} [children] label text (rendered as passed, not lowercased)
 */

/**
 * A single radio: <label class="is-radio"> wrapping the styled <input type="radio" class="is-radio-dot">.
 * Usually rendered by RadioGroup, but exported for standalone use.
 * @param {RadioProps & import('react').InputHTMLAttributes<HTMLInputElement>} props
 */
export function Radio({ name, value, checked, defaultChecked, onChange, disabled = false, children, ...rest }) {
  return (
    <label className="is-radio">
      <input
        type="radio"
        className="is-radio-dot"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={onChange}
        {...rest}
      />{' '}
      {children}
    </label>
  )
}

/**
 * @typedef {Object} RadioOption
 * @property {string} value
 * @property {import('react').ReactNode} label
 * @property {boolean} [disabled]
 */

/**
 * @typedef {Object} RadioGroupProps
 * @property {string} name              shared name for every radio in the group (required for single-select)
 * @property {string} [value]          controlled selected value (pair with onChange)
 * @property {string} [defaultValue]   initial selected value for uncontrolled use
 * @property {(value: string, event: import('react').ChangeEvent<HTMLInputElement>) => void} [onChange]
 * @property {RadioOption[]} options    the choices to render
 * @property {string} [ariaLabel]      accessible label for the role=radiogroup container
 */

/**
 * A group of radios: <div class="is-radios" role="radiogroup"> of <label class="is-radio"> rows.
 * Only one option is selectable because every input shares `name`.
 * @param {RadioGroupProps & import('react').HTMLAttributes<HTMLDivElement>} props
 */
export function RadioGroup({ name, value, defaultValue, onChange, options = [], ariaLabel, ...rest }) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue)
  const selected = isControlled ? value : internal

  const handleChange = (e) => {
    if (!isControlled) setInternal(e.target.value)
    onChange?.(e.target.value, e)
  }

  return (
    <div className="is-radios" role="radiogroup" aria-label={ariaLabel} {...rest}>
      {options.map((opt) => (
        <Radio
          key={opt.value}
          name={name}
          value={opt.value}
          checked={selected === opt.value}
          disabled={opt.disabled}
          onChange={handleChange}
        >
          {opt.label}
        </Radio>
      ))}
    </div>
  )
}

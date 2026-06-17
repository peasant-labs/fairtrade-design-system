import { useState } from 'react'

/* button + button-group + segmented control. emits the exact .btn / .btn-* / .bs-* markup the
   controls + states canvas sections use, so index.css styles it with zero new css. one shared
   height per size, square, hairline, amber scarce. lowercase ui text is enforced by the .btn class
   itself (text-transform), so children passed in are never force-lowercased in js. */

/**
 * @typedef {'primary'|'secondary'|'ghost'|'danger'} ButtonVariant
 * @typedef {'md'|'sm'} ButtonSize
 */

const VARIANT_CLASS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

/**
 * a single control. icon-only when there are no text children (renders .btn-icon).
 * loading swaps the leading icon for the .bs-spin ring and sets aria-busy; pressed turns it into a
 * toggle (.bs-toggle + aria-pressed). renders as a <button> or, with as="a", a real <a>.
 *
 * @param {object} props
 * @param {ButtonVariant} [props.variant='secondary'] - visual treatment
 * @param {ButtonSize} [props.size='md'] - md = 36px, sm = 28px (.btn-sm)
 * @param {React.ElementType} [props.icon] - lucide component rendered before the label
 * @param {React.ElementType} [props.iconRight] - lucide component rendered after the label
 * @param {boolean} [props.loading=false] - shows the .bs-spin ring + aria-busy="true"
 * @param {boolean} [props.disabled=false] - native disabled (button) / aria-disabled (anchor)
 * @param {boolean} [props.pressed] - toggle button: when defined adds .bs-toggle + aria-pressed
 * @param {'button'|'a'} [props.as='button'] - element to render
 * @param {string} [props.className] - extra classes appended after the computed ones
 * @param {React.ReactNode} [props.children] - the label; omit for an icon-only button
 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  pressed,
  as = 'button',
  className,
  children,
  ...rest
}) {
  const hasLabel = children != null && children !== false && children !== ''
  const iconSize = size === 'sm' ? 14 : 15
  const isToggle = pressed !== undefined

  const cls = [
    'btn',
    VARIANT_CLASS[variant] || VARIANT_CLASS.secondary,
    size === 'sm' && 'btn-sm',
    !hasLabel && 'btn-icon',
    isToggle && 'bs-toggle',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const leading = loading ? (
    <span className="bs-spin" aria-hidden="true" />
  ) : Icon ? (
    <Icon size={iconSize} aria-hidden="true" />
  ) : null

  const inner = (
    <>
      {leading}
      {children}
      {IconRight && <IconRight size={iconSize} aria-hidden="true" />}
    </>
  )

  if (as === 'a') {
    return (
      <a
        className={cls}
        aria-busy={loading || undefined}
        aria-pressed={isToggle ? pressed : undefined}
        aria-disabled={disabled || undefined}
        {...rest}
      >
        {inner}
      </a>
    )
  }

  return (
    <button
      className={cls}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-pressed={isToggle ? pressed : undefined}
      {...rest}
    >
      {inner}
    </button>
  )
}

/**
 * groups a set of related buttons into one track with shared seams (.bs-group). pass real Button
 * children. carries role="group"; give it an aria-label naming the action set.
 *
 * @param {object} props
 * @param {string} [props.label] - aria-label for the group (recommended)
 * @param {string} [props.className] - extra classes appended after .bs-group
 * @param {React.ReactNode} props.children - the buttons in the group
 */
export function ButtonGroup({ label, className, children, ...rest }) {
  const cls = ['bs-group', className].filter(Boolean).join(' ')
  return (
    <div className={cls} role="group" aria-label={label} {...rest}>
      {children}
    </div>
  )
}

/**
 * @typedef {object} SegmentedOption
 * @property {string} value - the option's value, compared against the control's value
 * @property {string} label - the option's lowercase label text
 * @property {React.ElementType} [icon] - lucide component shown before the label
 */

/**
 * a segmented control (.bs-seg): a single track of mutually-exclusive options. the selected option
 * carries aria-pressed="true" and the amber fill, so the choice never rides on color alone.
 * controlled (value + onChange) or uncontrolled (defaultValue).
 *
 * @param {object} props
 * @param {SegmentedOption[]} props.options - the choices
 * @param {string} [props.value] - controlled selected value
 * @param {string} [props.defaultValue] - initial value when uncontrolled
 * @param {(value: string) => void} [props.onChange] - called with the next value on select
 * @param {string} [props.label] - aria-label for the group (recommended)
 * @param {string} [props.className] - extra classes appended after .bs-seg
 */
export function Segmented({ options = [], value, defaultValue, onChange, label, className, ...rest }) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue ?? options[0]?.value)
  const current = isControlled ? value : internal

  const select = (next) => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  const cls = ['bs-seg', className].filter(Boolean).join(' ')

  return (
    <div className={cls} role="group" aria-label={label} {...rest}>
      {options.map((opt) => {
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            className="bs-seg-opt"
            aria-pressed={current === opt.value}
            onClick={() => select(opt.value)}
          >
            {Icon && <Icon aria-hidden="true" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

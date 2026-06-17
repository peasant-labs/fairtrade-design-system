import { useState } from 'react'
import { Check, X } from 'lucide-react'

/* chip family — the React port of the badges/states specimens. all variants ride the existing
   parametric .chip chassis (26px box, hairline, lowercase mono) plus the additive chipx-* depth;
   ZERO new css. icons are lucide component refs and inherit .chip .lucide sizing from index.css. */

/**
 * @typedef {'ok'|'warn'|'err'} ChipTone
 * @typedef {'sm'} ChipSize
 */

/**
 * a static chip: an icon names the thing, a short label confirms it, color reinforces. wraps
 * `<span class="chip">` with the parametric tone / size modifiers and an optional real x-button.
 * @param {object} props
 * @param {ChipTone} [props.tone] - semantic tone -> .chip-ok / .chip-warn / .chip-err (default: none)
 * @param {ChipSize} [props.size] - 'sm' -> .chip-sm dense box (default: none)
 * @param {React.ElementType} [props.icon] - leading lucide icon component ref (e.g. icon={Hash})
 * @param {boolean} [props.removable=false] - render a real .chipx-x button with an X icon
 * @param {() => void} [props.onRemove] - called when the x-button is clicked
 * @param {string} [props.removeLabel] - aria-label for the x-button (default: `remove ${children}`)
 * @param {string} [props.className] - extra classes appended after the chip classes
 * @param {React.ReactNode} props.children - the chip label / content (not force-lowercased)
 */
export default function Chip({
  tone,
  size,
  icon: Icon,
  removable = false,
  onRemove,
  removeLabel,
  className = '',
  children,
  ...rest
}) {
  const cls = [
    'chip',
    tone && `chip-${tone}`,
    size === 'sm' && 'chip-sm',
    removable && 'chip-removable',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const label =
    removeLabel || (typeof children === 'string' ? `remove ${children}` : 'remove')

  return (
    <span className={cls} {...rest}>
      {Icon && <Icon aria-hidden="true" />}
      {Icon ? ' ' : null}
      {children}
      {removable && (
        <button type="button" className="chipx-x" aria-label={label} onClick={onRemove}>
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  )
}

/**
 * a filter / toggle chip: a real `<button class="chip chip-toggle" aria-pressed>`. selected shows a
 * leading check (.chipx-tick, revealed by css) and an amber fill; the css carries the rest. supports
 * controlled (pressed + onChange) and uncontrolled (defaultPressed) use.
 * @param {object} props
 * @param {boolean} [props.pressed] - controlled pressed state
 * @param {boolean} [props.defaultPressed=false] - initial pressed state when uncontrolled
 * @param {(next: boolean) => void} [props.onChange] - called with the next pressed state on click
 * @param {React.ElementType} [props.icon] - leading icon shown when NOT pressed (e.g. icon={Filter})
 * @param {string} [props.className] - extra classes appended after the chip classes
 * @param {React.ReactNode} props.children - the toggle label (not force-lowercased)
 */
export function FilterChip({
  pressed,
  defaultPressed = false,
  onChange,
  icon: Icon,
  className = '',
  children,
  ...rest
}) {
  const isControlled = pressed !== undefined
  const [internal, setInternal] = useState(defaultPressed)
  const on = isControlled ? pressed : internal

  const toggle = () => {
    const next = !on
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  const cls = ['chip', 'chip-toggle', className].filter(Boolean).join(' ')

  return (
    <button type="button" className={cls} aria-pressed={on} onClick={toggle} {...rest}>
      {/* tick is always present; css hides it unless aria-pressed="true" */}
      <Check className="chipx-tick" aria-hidden="true" />
      {!on && Icon && <Icon aria-hidden="true" />}
      {' '}
      {children}
    </button>
  )
}

/**
 * a status dot ALWAYS paired with a label, so status never rides on color alone. renders the small
 * filled .chipx-dot square (tinted via the --c color var) followed by the required label text.
 * by default it ships inside a `.chip` chassis to match the specimen; pass bare to drop the wrapper.
 * @param {object} props
 * @param {string} props.label - the status word (required; names the state) — not force-lowercased
 * @param {string} [props.color] - css color for the dot, written to style="--c:..." (default: token fallback)
 * @param {boolean} [props.bare=false] - omit the surrounding .chip wrapper, render dot + label only
 * @param {string} [props.className] - extra classes appended after the chip class (ignored when bare)
 */
export function StatusDot({ label, color, bare = false, className = '', ...rest }) {
  const dot = <span className="chipx-dot" style={color ? { '--c': color } : undefined} />
  if (bare) {
    return (
      <>
        {dot}
        {' '}
        {label}
      </>
    )
  }
  const cls = ['chip', className].filter(Boolean).join(' ')
  return (
    <span className={cls} {...rest}>
      {dot}
      {' '}
      {label}
    </span>
  )
}

/**
 * a numeric notification count: a trailing pill of tabular digits (.chipx-count). neutral by default;
 * .unread flips it to the scarce amber. tnum keeps digits tabular.
 * @param {object} props
 * @param {number|string} props.count - the value to display
 * @param {boolean} [props.unread=false] - amber unread treatment -> .unread
 * @param {string} [props.className] - extra classes appended after the count classes
 */
export function CountBadge({ count, unread = false, className = '', ...rest }) {
  const cls = ['chipx-count', unread && 'unread', 'tnum', className].filter(Boolean).join(' ')
  return (
    <span className={cls} {...rest}>
      {count}
    </span>
  )
}

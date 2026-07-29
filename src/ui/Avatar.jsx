import { useState } from 'react'
import { X } from 'lucide-react'
import BrandMark from './BrandMark.jsx'

/* small identity primitives ported from the avatar / kbd / tag specimen (src/sections/54-overlays.html).
   they emit the exact existing classes (.avatar / .av-* / .av-group / .kbd-key / .kbd-chord / .tag)
   so the styles in src/index.css apply with zero new css. */

/**
 * @typedef {'sm' | 'md' | 'lg'} AvatarSize
 */

/**
 * a single avatar tile: initials, or a photo with the initials as the fallback beneath it.
 * the base .avatar is 18px (inline meta); size scales it up for standalone use.
 *
 * @param {object} props
 * @param {string} props.name - the person's name; used as the accessible label and to derive initials when none are given.
 * @param {string} [props.initials] - explicit initials to render; defaults to the first letters of `name`.
 * @param {AvatarSize} [props.size] - one of 'sm' | 'md' | 'lg' (24 / 32 / 44px). omit for the bare 18px base.
 * @param {string} [props.src] - optional photo url; when set the tile becomes an .av-img with the photo over the initials.
 * @param {boolean} [props.more] - render the amber "+N overflow" tile (.av-more); `initials` carries the "+5" text.
 * @param {string} [props.className] - extra class names appended after the avatar classes.
 */
export function Avatar({ name, initials, size, src, more = false, className = '', ...rest }) {
  const [imgFailed, setImgFailed] = useState(false)
  const text = initials ?? deriveInitials(name)
  const showImg = src && !imgFailed
  const classes = [
    'avatar',
    size && `av-${size}`,
    showImg && 'av-img',
    more && 'av-more',
    className,
  ].filter(Boolean).join(' ')

  // with a photo the tile is role=img with the name on it, the <img> alt is empty (decorative duplicate),
  // and the initials sit beneath as the visible fallback (matches the specimen markup).
  if (showImg) {
    return (
      <span className={classes} role="img" aria-label={name} {...rest}>
        <img src={src} alt="" onError={() => setImgFailed(true)} />
        <span aria-hidden="true">{text}</span>
      </span>
    )
  }
  return (
    <span className={classes} aria-label={name} {...rest}>
      {text}
    </span>
  )
}

export default Avatar

/**
 * a stacked, overlapping run of avatars with an optional +N overflow tile.
 * pass <Avatar> children directly; the .av-group nth-child rules handle overlap + z-order.
 *
 * @param {object} props
 * @param {string} props.label - accessible name for the group (e.g. "9 contributors").
 * @param {React.ReactNode} props.children - the <Avatar> tiles (include an `more` avatar last for overflow).
 * @param {string} [props.className] - extra class names appended after .av-group.
 */
export function AvatarGroup({ label, children, className = '', ...rest }) {
  return (
    <div
      className={['av-group', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * a real <kbd> styled as a single keyboard key. accepts text children or a lucide icon (e.g. icon={ArrowUp}).
 * the CSS sizes the icon (.kbd-key .lucide), so render it plainly.
 *
 * @param {object} props
 * @param {React.ComponentType} [props.icon] - a lucide icon component reference, rendered in place of text.
 * @param {string} [props.label] - accessible name for an icon-only key (the glyph is aria-hidden, so a bare icon key would otherwise announce empty).
 * @param {React.ReactNode} [props.children] - the key label (e.g. "esc", "enter", "K").
 * @param {string} [props.className] - extra class names appended after .kbd-key.
 */
export function Kbd({ icon: Icon, label, children, className = '', ...rest }) {
  const a11y = Icon && label ? { 'aria-label': label } : {}
  return (
    <kbd className={['kbd-key', className].filter(Boolean).join(' ')} {...a11y} {...rest}>
      {Icon ? <Icon aria-hidden="true" /> : children}
    </kbd>
  )
}

/**
 * a keyboard chord: several <Kbd> keys joined by a faint, aria-hidden "+" that is not itself a key.
 * the spoken form lives in `label` (e.g. "command k"); the visible "+" is decorative.
 *
 * @param {object} props
 * @param {string} props.label - the accessible spelling of the chord (e.g. "control shift p").
 * @param {React.ReactNode} props.children - the <Kbd> keys to join.
 * @param {string} [props.className] - extra class names appended after .kbd-chord.
 */
export function KbdChord({ label, children, className = '', ...rest }) {
  const keys = Array.isArray(children) ? children.filter(Boolean) : [children]
  return (
    <span
      className={['kbd-chord', className].filter(Boolean).join(' ')}
      aria-label={label}
      {...rest}
    >
      {keys.map((key, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span className="kbd-plus" aria-hidden="true">+</span>}
          {key}
        </span>
      ))}
    </span>
  )
}

/**
 * a tag / label token. may carry a leading swatch dot (color pairs with the word, never color alone),
 * a leading lucide icon, a selected (amber) state, and an optional dismiss button.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - the tag label (sentence/case passed in is preserved; chrome is lowercased by CSS).
 * @param {string} [props.brand] - a provider/company name (claude, gemini, openai, cursor, opencode, strike, or an alias).
 *        When the tag names a company, pass this instead of `icon`: it leads with the real brand mark, never a generic glyph.
 * @param {React.ComponentType} [props.icon] - a lucide icon component reference rendered before the label (ignored when `brand` is set).
 * @param {string} [props.dot] - a color value for the leading swatch dot (set as --tag-c).
 * @param {boolean} [props.selected] - apply the amber .tag-on state.
 * @param {() => void} [props.onRemove] - when set, render a real, labelled remove button (.tag-x).
 * @param {string} [props.removeLabel] - accessible label for the remove button; falls back to "remove tag".
 * @param {string} [props.className] - extra class names appended after .tag.
 */
export function Tag({ children, brand, icon: Icon, dot, selected = false, onRemove, removeLabel, className = '', ...rest }) {
  const classes = ['tag', selected && 'tag-on', className].filter(Boolean).join(' ')
  return (
    <span className={classes} {...rest}>
      {dot && <span className="tag-dot" style={{ '--tag-c': dot }} />}
      {brand ? <BrandMark name={brand} /> : Icon && <Icon aria-hidden="true" />}
      {children}
      {onRemove && (
        <button
          type="button"
          className="tag-x"
          aria-label={removeLabel || 'remove tag'}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  )
}

// derive up-to-two uppercase initials from a name ("Veil Tinker" -> "VT").
function deriveInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

/* card & row primitives, ref-01 style: an optional ascii/halftone thumbnail on top, a title, a short
   summary, bullet metadata and a tabular foot. mirrors the markup in src/App.jsx's Cards() and the
   conversation partial exactly: .card / .card-img / .card-thumb / .card-body / .card-head / .desc /
   .bullets / .card-foot and the .row + .metaitem + .avatar + .grow row family. emits NO new classes and
   needs ZERO new CSS — the existing src/index.css styles all of this. the whole card is a single target;
   the thumbnail is decorative imagery passed in as children, the title carries the meaning. */

/**
 * @typedef {Object} CardProps
 * @property {React.ReactNode} [children] - card contents (slotted, e.g. a <CardImg/> or arbitrary markup).
 * @property {boolean} [link=false] - render the card as an <a> (one big target) instead of a <div>.
 * @property {string} [className] - extra classes appended after the base `card`.
 */

/**
 * Base card surface. Pass `link` to render as an <a> (the ref-01 cards are a single anchor target).
 * Slot content via children, or compose with <CardImg/> for the imagery-on-top variant.
 * @param {CardProps & React.HTMLAttributes<HTMLElement>} props
 */
export default function Card({ children, link = false, className, ...rest }) {
  const Tag = link ? 'a' : 'div'
  return (
    <Tag className={['card', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  )
}

/**
 * @typedef {Object} CardImgProps
 * @property {React.ReactNode} [thumb] - decorative imagery rendered inside `.card-thumb` (e.g. an <AsciiImage/>).
 * @property {React.ReactNode} [head] - the `.card-head` row (provider mark + label, trailing icon).
 * @property {React.ReactNode} [title] - the card title; rendered inside an <h3> when provided.
 * @property {React.ReactNode} [desc] - the short summary; rendered inside `<p class="desc">` when provided.
 * @property {React.ReactNode[]} [bullets] - bullet metadata; rendered as `<ul class="bullets"><li>…`.
 * @property {React.ReactNode} [foot] - the `.card-foot` row (avatar + tabular metaitems).
 * @property {boolean} [link=true] - render as an <a> (the whole card is one target); set false for a <div>.
 * @property {string} [className] - extra classes appended after `card card-img`.
 * @property {React.ReactNode} [children] - extra body content appended after the slots, if any.
 */

/**
 * Imagery-on-top card: `.card.card-img` with a `.card-thumb` slot and a `.card-body` carrying the
 * head, title, desc, bullets and foot. Provide imagery via `thumb` (decorative — caller passes the
 * already-aria-hidden specimen, e.g. <AsciiImage/>). All text slots are optional.
 * @param {CardImgProps & React.HTMLAttributes<HTMLElement>} props
 */
export function CardImg({
  thumb,
  head,
  title,
  desc,
  bullets,
  foot,
  link = true,
  className,
  children,
  ...rest
}) {
  const Tag = link ? 'a' : 'div'
  return (
    <Tag className={['card', 'card-img', className].filter(Boolean).join(' ')} {...rest}>
      {thumb != null && <div className="card-thumb">{thumb}</div>}
      <div className="card-body">
        {head != null && <div className="card-head">{head}</div>}
        {title != null && <h3>{title}</h3>}
        {desc != null && <p className="desc">{desc}</p>}
        {bullets != null && bullets.length > 0 && (
          <ul className="bullets">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
        {children}
        {foot != null && <div className="card-foot">{foot}</div>}
      </div>
    </Tag>
  )
}

/**
 * @typedef {Object} RowProps
 * @property {React.ReactNode} [children] - row contents: metaitems, a `.grow` label, an avatar, etc.
 * @property {string} [className] - extra classes appended after the base `row`.
 */

/**
 * Compact dense-list row. The base `.row` styles the surface, border and hover; stacked rows collapse
 * their shared border automatically (`.row + .row`). Use a child with the `grow` class for the
 * flexible label column.
 * @param {RowProps & React.HTMLAttributes<HTMLDivElement>} props
 */
export function Row({ children, className, ...rest }) {
  return (
    <div className={['row', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
}

/**
 * @typedef {Object} MetaItemProps
 * @property {React.ComponentType<{ size?: number }>} [icon] - leading icon component reference (e.g. icon={Clock}).
 * @property {number} [iconSize] - explicit lucide size; omit to let the CSS (`--ic-sm`) size it (the default).
 * @property {React.ReactNode} [value] - emphasised tabular value, rendered as `<b class="tnum">` before the children.
 * @property {React.ReactNode} [children] - the trailing label / units.
 * @property {string} [className] - extra classes appended after the base `metaitem` (e.g. `mono`).
 */

/**
 * A single piece of card / row metadata: an optional leading icon, an optional bold tabular value and a
 * label. The icon and a `<b>` value pick up `.metaitem` styling (icon sized via `--ic-sm`, `<b>` tinted).
 * Decorative icon gets aria-hidden. Pass `value` for counts/durations so they render in the tnum face.
 * @param {MetaItemProps & React.HTMLAttributes<HTMLSpanElement>} props
 */
export function MetaItem({ icon: Icon, iconSize, value, children, className, ...rest }) {
  return (
    <span className={['metaitem', className].filter(Boolean).join(' ')} {...rest}>
      {Icon && <Icon {...(iconSize != null ? { size: iconSize } : {})} aria-hidden="true" />}
      {value != null && <b className="tnum">{value}</b>}
      {children}
    </span>
  )
}

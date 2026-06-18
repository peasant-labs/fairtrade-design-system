/**
 * @typedef {import('react').ReactNode} ReactNode
 * @typedef {import('react').ComponentType<{ size?: number, 'aria-hidden'?: boolean }>} IconComponent
 */

/**
 * EmptyState — left-aligned empty/zero-state block: a ringed icon, title,
 * message, and an optional action slot. Emits the exact `.empty` markup the
 * existing `src/index.css` styles (left-aligned by design).
 *
 * @param {object} props
 * @param {IconComponent} [props.icon] - lucide-react icon component reference (e.g. `Compass`); rendered decoratively inside the `.ring`. The CSS sizes `.ring .lucide` to --ic-lg (18px).
 * @param {ReactNode} props.title - short heading, rendered by the `as` element (default `h3`).
 * @param {ReactNode} [props.message] - supporting copy, rendered in `p`. Omitted if not provided.
 * @param {ReactNode} [props.action] - optional action slot (e.g. a button). Takes precedence over `children`.
 * @param {ReactNode} [props.children] - fallback action slot, used only when `action` is not provided.
 * @param {keyof JSX.IntrinsicElements} [props.as='h3'] - heading element/level for the title, so the component can fit the surrounding heading outline (e.g. `h2`).
 * @returns {JSX.Element}
 */
export default function EmptyState({ icon: Icon, title, message, action, children, as: Heading = 'h3' }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="ring">
          <Icon aria-hidden="true" />
        </div>
      )}
      <Heading>{title}</Heading>
      {message && <p>{message}</p>}
      {action ?? children}
    </div>
  );
}

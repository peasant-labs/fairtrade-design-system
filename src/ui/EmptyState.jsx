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
 * @param {IconComponent} [props.icon] - lucide-react icon component reference (e.g. `Compass`); rendered decoratively inside the `.ring`. The CSS sizes `.ring .lucide` to 20px.
 * @param {ReactNode} props.title - short heading, rendered in `h3`.
 * @param {ReactNode} [props.message] - supporting copy, rendered in `p`. Omitted if not provided.
 * @param {ReactNode} [props.action] - optional action slot (e.g. a button). Falls back to `children`.
 * @param {ReactNode} [props.children] - alternative to `action` for the action slot.
 * @returns {JSX.Element}
 */
export default function EmptyState({ icon: Icon, title, message, action, children }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="ring">
          <Icon size={20} aria-hidden="true" />
        </div>
      )}
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action ?? children}
    </div>
  );
}

/* ChartCard — a titled card wrapping a chart (or any content) on the analytics
   surface. The chart itself is passed as `children`, usually one of the shared
   chart primitives (ChartBar / ChartLine). Paints from fairtrade tokens; carries
   no chart logic of its own.

   A string `aside` renders as the mono summary figure in the card head
   (`.gan-card-figure`); a node `aside` (e.g. a segmented control) renders
   unwrapped so it can bring its own chrome. */

/**
 * @param {Object} props
 * @param {string} props.title Card heading (lowercase chrome by convention).
 * @param {import('react').ComponentType<{ className?: string, 'aria-hidden'?: boolean | 'true' | 'false' }>} [props.icon]
 *   Lucide icon component rendered inline before the title.
 * @param {import('react').ReactNode} [props.subtitle] One-line description under the title.
 * @param {import('react').ReactNode} [props.aside] Right-aligned head slot (summary figure or control).
 * @param {import('react').ReactNode} props.children Card body (the chart).
 * @param {string} [props.className]
 */
export default function ChartCard({ title, icon: Icon, subtitle, aside, children, className }) {
  return (
    <section className={['gan-card', className].filter(Boolean).join(' ')}>
      <div className="gan-card-head">
        <div className="gan-card-titles">
          <h3 className="gan-card-title">
            {Icon != null ? <Icon className="lucide" aria-hidden="true" /> : null}
            {title}
          </h3>
          {subtitle != null ? <span className="gan-card-sub">{subtitle}</span> : null}
        </div>
        {aside != null ? (
          typeof aside === 'string' ? (
            <span className="gan-card-figure tnum">{aside}</span>
          ) : (
            aside
          )
        ) : null}
      </div>
      <div className="gan-card-body">{children}</div>
    </section>
  )
}

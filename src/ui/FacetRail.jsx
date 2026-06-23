import { useId } from 'react'
import { ArrowDownWideNarrow, Cpu, Tags, Check, X } from 'lucide-react'
import './FacetRail.css'

/* ───────────────────────────────────────────────────────────────────────────
   FacetRail — fairtrade "in use" component (faceted filter rail)
   ─────────────────────────────────────────────────────────────────────────
   modeled on village's FilterSidebar: an order section over a provider
   checklist over a topics tag-cloud, with a sticky "clear all" + running
   "N active" count. a ~260px hairline rail meant to sit beside a search /
   results surface.

   neuroinclusive posture: every active facet carries a non-color signal (a
   check glyph or aria-pressed=true + a filled chip), targets are >=24px, the
   focus ring is the global 3px var(--focus-ring) offset 2, and the only
   transitions are gated behind prefers-reduced-motion: no-preference (in the
   .css). chrome is lowercase mono; counts use tabular-nums. classes are
   namespaced `fr-`. amber is the scarce accent — reserved for the active
   facet fill, never decoration.
   ─────────────────────────────────────────────────────────────────────────── */

/* the order options. labels stay lowercase here so they need no transform in
   prose and read identically to the rendered chrome. */
const ORDER_OPTIONS = [
  { value: 'recent', label: 'recent' },
  { value: 'turns', label: 'most turns' },
  { value: 'tokens', label: 'most tokens' },
]

/* split a provider list into [tag, count]. a provider is either a bare slug
   string or { slug|value|name, count } — so callers can pass either shape. */
function normalizeProvider(p) {
  if (typeof p === 'string') return { slug: p, count: undefined }
  return { slug: p.slug ?? p.value ?? p.name, count: p.count }
}

/* ── one provider row ─────────────────────────────────────────────────────────
   a full-width aria-pressed toggle: a square mark, the slug, then the count.
   active = aria-pressed true + a check glyph + the amber fill (three signals,
   not color alone). */
function ProviderRow({ slug, count, active, onToggle }) {
  return (
    <button
      type="button"
      className="fr-provider"
      aria-pressed={active}
      onClick={onToggle}
    >
      <span className="fr-provider-mark" aria-hidden="true">
        {active ? <Check className="lucide" strokeWidth={2.5} /> : null}
      </span>
      <span className="fr-provider-name">{slug}</span>
      {count != null && (
        <span className="fr-count" aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  )
}

/* ── one topic chip ───────────────────────────────────────────────────────────
   a square chip at one uniform size (magnitude is carried by the count, not the
   chip size). active flips aria-pressed + fills it amber + shows the count in the
   on-amber ink. */
function TopicChip({ tag, count, active, onToggle }) {
  return (
    <button
      type="button"
      className="fr-topic"
      aria-pressed={active}
      onClick={onToggle}
    >
      <span className="fr-topic-tag">{tag}</span>
      <span className="fr-count" aria-hidden="true">
        {count}
      </span>
    </button>
  )
}

/* ── the rail ─────────────────────────────────────────────────────────────────
   order (radiogroup) · provider (checklist of aria-pressed rows) · topics (a
   tag-cloud). a sticky footer surfaces the running active count and a "clear
   all" that only appears when something is active. */
export default function FacetRail({
  order = 'recent',
  onOrder,
  providers = [],
  activeProviders = new Set(),
  onProvider,
  topics = [],
  activeTopics = new Set(),
  onTopic,
  onClear,
  className = '',
  ...rest
}) {
  const orderName = useId()

  const rows = providers.map(normalizeProvider)

  // every selected facet counts toward the running total + the clear gate.
  const activeCount = activeProviders.size + activeTopics.size
  const hasActive = activeCount > 0

  return (
    <aside
      className={`fr-rail ${className}`.trim()}
      aria-label="filters"
      {...rest}
    >
      {/* order — a radiogroup; the picked option carries the dot + amber rule */}
      <section className="fr-section" role="radiogroup" aria-label="order">
        <h3 className="fr-heading">
          <ArrowDownWideNarrow className="lucide fr-heading-ico" aria-hidden="true" />
          <span className="fr-heading-text">order</span>
        </h3>
        <div className="fr-orders">
          {ORDER_OPTIONS.map((opt) => {
            const selected = order === opt.value
            return (
              <label key={opt.value} className="fr-order">
                <input
                  type="radio"
                  className="fr-order-input"
                  name={orderName}
                  value={opt.value}
                  checked={selected}
                  onChange={() => onOrder?.(opt.value)}
                />
                <span className="fr-order-dot" aria-hidden="true" />
                <span className="fr-order-label">{opt.label}</span>
              </label>
            )
          })}
        </div>
      </section>

      {/* provider — a checklist of toggle rows */}
      <section className="fr-section" aria-label="provider">
        <h3 className="fr-heading"><Cpu className="lucide fr-heading-ico" aria-hidden="true" /><span className="fr-heading-text">provider</span></h3>
        <div className="fr-providers" role="group" aria-label="providers">
          {rows.map(({ slug, count }) => (
            <ProviderRow
              key={slug}
              slug={slug}
              count={count}
              active={activeProviders.has(slug)}
              onToggle={() => onProvider?.(slug)}
            />
          ))}
        </div>
      </section>

      {/* topics — a uniform-size tag cloud (count carries magnitude, not size) */}
      {topics.length > 0 && (
        <section className="fr-section" aria-label="topics">
          <h3 className="fr-heading"><Tags className="lucide fr-heading-ico" aria-hidden="true" /><span className="fr-heading-text">topics</span></h3>
          <div className="fr-topics" role="group" aria-label="topics">
            {topics.map(({ tag, count }) => (
              <TopicChip
                key={tag}
                tag={tag}
                count={count}
                active={activeTopics.has(tag)}
                onToggle={() => onTopic?.(tag)}
              />
            ))}
          </div>
        </section>
      )}

      {/* sticky footer: running count + the clear-all (gated on any active) */}
      <footer className="fr-foot">
        <span className="fr-active" aria-live="polite">
          <span className="fr-active-n" data-testid="fr-active-n">
            {activeCount}
          </span>{' '}
          active
        </span>
        {hasActive && (
          <button type="button" className="fr-clear" onClick={() => onClear?.()}>
            <X className="lucide" aria-hidden="true" />
            clear all
          </button>
        )}
      </footer>
    </aside>
  )
}

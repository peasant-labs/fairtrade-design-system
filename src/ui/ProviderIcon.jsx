/* ───────────────────────────────────────────────────────────────────────────
   ProviderIcon — fairtrade "in use" component family
   ─────────────────────────────────────────────────────────────────────────
   the provider family for a transcript / session browser. every coding-agent
   session is produced by a canonical @peasant-labs/schema Harness. this file
   turns that one wire value into the three things the UI needs:

     1. <ProviderIcon harness />  — the right REAL brand mark, single-color.
     2. <ProviderTag  harness />  — a square hairline chip = mark + the harness
        slug as a lowercase mono label.
     3. <ProviderName harness /> + providerAccent() + <AccentLegend />  — the
        per-provider accent the real app paints the ASSISTANT side with.

   ── the two rules this family exists to enforce ──────────────────────────────
   • NEVER a generic glyph. peasant/village's ProviderIcon fell back to lucide's
     <Code2> for codex AND cursor — two different providers wearing one identical
     stand-in mark, identifying neither. fairtrade leads with the company's REAL
     mark (via BrandMark, the single source of truth) so claude-code looks like
     Claude and codex looks like OpenAI. the mark is ALWAYS paired with the
     provider's name (nominative fair use — never implying endorsement).
   • NEVER identify a provider by color alone (WCAG 1.4.1 / neuroinclusive). the
     accent is decoration ON TOP of the mark + name, never the sole signal. the
     legend spells this out: mark, name, AND swatch — remove the swatch and you
   can still tell the providers apart.

   ── how this DIVERGES from the base system ───────────────────────────────────
   the design system fixes turn color as user = teal / assistant = amber (a
   two-color speaker contrast). but in the real transcript browser the ASSISTANT
   is the agent, and the agent IS the provider — so the assistant accent varies
   BY provider. providerAccent() is the single public seam for that override: one earth
   token each, drawn from the system's --amber/--teal/--olive/--mauve/--clay so
   the family re-themes for free under [data-theme] and never invents a hue.

   tokens only — no raw hex/px. classes namespaced `pv-`. single-color marks
   inherit currentColor. static-first: the one transition is gated behind
   prefers-reduced-motion: no-preference (handled in the .css).
   ─────────────────────────────────────────────────────────────────────────── */

import BrandMark from './BrandMark.jsx'
import {
  PROVIDER_ACCENTS,
  PROVIDER_HARNESSES,
  assertHarness,
  providerAccent,
  providerBrand,
  providerDisplayName,
} from './provider-policy.js'
import './ProviderIcon.css'

/** ProviderIcon — the real brand mark for a harness, single-color via currentColor. */
/** @typedef {import('@peasant-labs/schema').Harness} Harness */

/* Derive the display inventory from the canonical runtime object. Do not use a
   parallel list: schema additions must make this surface fail until every
   display policy below is explicitly completed. */
/** @type {readonly Harness[]} */
export const HARNESSES = PROVIDER_HARNESSES

/* ── the per-provider accent map (the documented divergence) ──────────────────
   each harness → ONE earth token. amber (the scarce emphasis color) goes to the
   primary/default agent. Google harnesses deliberately share teal; Strike uses
   warm clay to echo its official gold bolt without spending amber. The mark and
   written harness name remain the identity, never color alone. consumers
   call providerAccent(h) to tint the assistant side of a turn, a session row's
   rail, a breakdown bar, etc. the VALUES are token names (not hex) so the
   mapping re-themes with the rest of the system. */
/**
 * @deprecated Use providerAccent(harness), which validates present values at
 * the canonical schema boundary before returning an accent.
 * @type {Readonly<Record<Harness, 'amber'|'teal'|'olive'|'mauve'|'clay'>>}
 */
export const PROVIDER_ACCENT = PROVIDER_ACCENTS

/* Resolve a validated Harness to its total CSS custom-property mapping, e.g.
   var(--amber). A single helper keeps every accent-bearing piece aligned. */
function accentVar(harness) {
  return `var(--${providerAccent(harness)})`
}

/**
 * ProviderIcon — the real brand mark for a harness, single-color via currentColor.
 *
 * decorative by default (it is paired with a name in every composite below). pass
 * `label` to make a STANDALONE mark informative (role="img" + the provider name).
 * pass `accent` to tint the mark with its provider accent instead of inheriting
 * the surrounding text color — but remember the accent is never the sole signal.
 *
 * @param {object} props
 * @param {Harness} props.harness
 * @param {number} [props.size] explicit px; omit to inherit the contextual icon size.
 * @param {boolean} [props.accent] tint with PROVIDER_ACCENT[harness] (default: currentColor).
 * @param {boolean|string} [props.label] true → the provider name as aria-label; a string overrides.
 * @param {string} [props.className] extra classes appended after `pv-icon`.
 * @returns {JSX.Element}
 */
export function ProviderIcon({ harness, size, accent = false, label, className = '', ...rest }) {
  assertHarness(harness, 'ProviderIcon render in src/ui/ProviderIcon.jsx')
  const brand = providerBrand(harness)
  const classes = ['pv-icon', className].filter(Boolean).join(' ')
  const style = accent ? { color: accentVar(harness) } : undefined
  const resolvedLabel = label === true ? providerDisplayName(harness) : label
  return (
    <span className={classes} style={style} {...rest}>
      <BrandMark name={brand} size={size} label={resolvedLabel} />
    </span>
  )
}

/**
 * ProviderTag — a square hairline chip: the real mark + the lowercase harness slug.
 *
 * the system's chip look (mono, hairline border, radius 0, lowercase chrome). the
 * mark sits to the left of the slug so the chip is never color-only: even fully
 * monochrome it names the provider in words. pass `accent` to tint the mark.
 *
 * @param {object} props
 * @param {Harness} props.harness
 * @param {boolean} [props.accent] tint the mark with the provider accent (default: ink).
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export function ProviderTag({ harness, accent = false, className = '', ...rest }) {
  assertHarness(harness, 'ProviderTag render in src/ui/ProviderIcon.jsx')
  const classes = ['pv-tag', className].filter(Boolean).join(' ')
  return (
    <span className={classes} {...rest}>
      <ProviderIcon harness={harness} accent={accent} />
      <span className="pv-tag-label">{harness}</span>
    </span>
  )
}

/**
 * ProviderName — mark + the harness slug as a plain inline label (no chip border).
 *
 * the in-prose form: use it inline in a sentence or a table cell. pass `accent` to
 * tint BOTH the mark and the slug with the provider accent (the slug gets a
 * non-color cue regardless — it is real text, so it is readable mono-color too).
 *
 * @param {object} props
 * @param {Harness} props.harness
 * @param {boolean} [props.accent] tint mark + label with the provider accent.
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export function ProviderName({ harness, accent = false, className = '', ...rest }) {
  assertHarness(harness, 'ProviderName render in src/ui/ProviderIcon.jsx')
  const classes = ['pv-name', className].filter(Boolean).join(' ')
  const style = accent ? { color: accentVar(harness) } : undefined
  return (
    <span className={classes} style={style} {...rest}>
      <ProviderIcon harness={harness} />
      <span className="pv-name-label">{harness}</span>
    </span>
  )
}

/**
 * AccentLegend — the per-provider accent map, documented as a UI.
 *
 * one row per harness across four aligned columns: the real mark, the provider
 * name, the accent swatch, then its token name written out. the swatch sits after
 * the mark + name on purpose — they already identify the provider, so the legend
 * reads correctly with the color stripped (the neuroinclusive rule made visible),
 * and the swatch keeps its own column so the colors line up down the list.
 *
 * @param {object} props
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export function AccentLegend({ className = '', ...rest }) {
  const classes = ['pv-legend', className].filter(Boolean).join(' ')
  return (
    <ul className={classes} {...rest}>
      {HARNESSES.map((harness) => {
        const token = providerAccent(harness)
        return (
          <li key={harness} className="pv-legend-row">
            <ProviderIcon harness={harness} accent className="pv-legend-mark" />
            <span className="pv-legend-name">{harness}</span>
            {/* swatch + token are direct grid children (the row is display:contents),
                so each lands on its own track and the swatches share one left edge. */}
            <span
              className="pv-swatch"
              style={{ background: `var(--${token})` }}
              aria-hidden="true"
            />
            <span className="pv-legend-token">{token}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default ProviderIcon

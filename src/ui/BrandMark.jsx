/* BrandMark - the single source of truth for provider/company logos in the component
   library. The rule (see DESIGN.md): whenever the UI names a company or provider, it
   leads with that company's REAL brand mark, never a generic stand-in glyph (a robot, a
   git fork, an eye). One real mark identifies the provider at a glance; a generic glyph
   identifies nothing.

    Claude, Gemini, OpenAI, opencode, Cursor and GitHub path geometry originates from Simple Icons
   (https://simpleicons.org, CC0). Strike's path is copied unchanged from the official project favicon at
   https://github.com/jonathanung/strike-cli-web/blob/9e9550487b0306958baeff83a8ddfe483c42aa7d/public/favicon.svg.
   The canonical Strike project is Apache-2.0 licensed at https://github.com/jonathanung/strike,
   and the project has granted permission for this use of its brand mark. The mark is used only for
   nominative provider identification. Geometry is INLINED
   here (not referenced via <use href="#b-*">) so the component is self-contained and renders in
   Storybook and in any app without the document-global <symbol> sheet. Marks recolor via currentColor
   (single-color theming only) and re-theme for free under [data-theme]. They are kept small,
   single-color, undistorted, and paired with the provider's name, never implying endorsement.

   The path data lives in ./brand-geometry.js, a plain module the share card draws from as well.

   a11y: a mark next to a visible text label is decorative (default: aria-hidden, focusable=false).
   A mark that stands alone AS the identity must pass `label` to become informative
   (role="img" + aria-label). Always focusable=false so it never tab-traps in IE/Edge legacy. */
import { BRAND_FILL_RULE, BRAND_PATHS, brandViewBox, resolveBrand } from './brand-geometry.js'

export { resolveBrand }

/* human names for the informative (label-bearing) case, so a standalone mark announces the
   company rather than a slug. */
const BRAND_NAME = {
  github: 'GitHub',
  claude: 'Claude',
  gemini: 'Gemini',
  openai: 'OpenAI',
  cursor: 'Cursor',
  opencode: 'opencode',
  strike: 'Strike',
  pi: 'Pi',
}

/**
 * BrandMark - a single-color, currentColor-tinted company/provider logo.
 *
 * @param {object} props
 * @param {'claude'|'gemini'|'openai'|'cursor'|'opencode'|'strike'|'anthropic'|'google'|'codex'|string} props.name
 *        the company/product; aliases resolve (anthropic->claude, google->gemini, codex->openai).
 * @param {number} [props.size] explicit px size; omit to inherit the contextual icon-token size
 *        from the `.brand` rules in src/index.css (so a mark in a chip/tag/button matches its neighbours).
 * @param {string} [props.label] when set, the mark is INFORMATIVE: role="img" + this aria-label.
 *        omit when a visible text label already names the provider (the mark is then decorative).
 * @param {string} [props.className] extra classes appended after `.brand`.
 * @returns {JSX.Element|null} null when `name` does not resolve to a known mark.
 */
export default function BrandMark({ name, size, label, className = '', ...rest }) {
  const key = resolveBrand(name)
  if (!key) return null
  const classes = ['brand', className].filter(Boolean).join(' ')
  const sizeProps = size != null ? { width: size, height: size, style: { width: size, height: size } } : {}
  const a11y = label
    ? { role: 'img', 'aria-label': label === true ? BRAND_NAME[key] : label, focusable: 'false' }
    : { 'aria-hidden': 'true', focusable: 'false' }
  return (
    <svg className={classes} viewBox={brandViewBox(key)} {...sizeProps} {...a11y} {...rest} data-brand={key}>
      <path d={BRAND_PATHS[key]} fillRule={BRAND_FILL_RULE[key]} />
    </svg>
  )
}

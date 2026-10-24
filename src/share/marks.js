// @ts-check
/* The marks the share card draws, as plain path data so an image renderer (satori, behind Next's
   ImageResponse) can draw them as inline SVG: the wheat logo and the provider brand marks are
   re-exported from the geometry BrandMark and the page's #logo symbol use, never copied; the
   person icon for the "user" label is lucide's `User` (ISC, lucide.dev), the icon the transcript
   viewer's user turns carry, and the padlock on the card for a transcript that is not public is
   lucide's `Lock`. */
export { BRAND_FILL_RULE, BRAND_PATHS, WHEAT_LOGO, brandViewBox, resolveBrand } from '../ui/brand-geometry.js'

/* lucide `user`: a 24x24 stroke drawing (round caps and joins, no fill) */
export const USER_ICON = Object.freeze({
  viewBox: '0 0 24 24',
  strokeWidth: 2,
  path: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2',
  circle: Object.freeze({ cx: 12, cy: 7, r: 4 }),
})

/* lucide `lock`: a 24x24 stroke drawing (round caps and joins, no fill), the body and the shackle */
export const LOCK_ICON = Object.freeze({
  viewBox: '0 0 24 24',
  strokeWidth: 2,
  rect: Object.freeze({ x: 3, y: 11, width: 18, height: 11, rx: 2 }),
  path: 'M7 11V7a5 5 0 0 1 10 0v4',
})

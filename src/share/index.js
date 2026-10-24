// @ts-check
/* The share card entry, consumed as `@peasant-labs/fairtrade/share`: the transcript share card for
   link previews and pages, its data, its link text and the faces it is drawn in. The entry loads no
   hook and no react-dom, so a server image route can draw it with satori (Next's ImageResponse).

   Fonts: `SHARE_CARD_FONTS[].file` is a bare file name. A consumer reads the bytes of
   `@peasant-labs/fairtrade/share/fonts/<file>` and hands them to its renderer under `name`, `weight`
   and `style`.

   Scripts: the faces cover Latin text. A prompt in CJK or with emoji still lays out (each such
   character is measured wide, so the clamp holds), but satori draws a character none of its fonts
   has as an empty box (.notdef). A consumer that wants those glyphs drawn passes its own fonts for
   them to the renderer beside SHARE_CARD_FONTS (satori's `fonts`, or its `loadAdditionalAsset`
   for emoji). */
/** @typedef {import('./data.js').ShareCardData} ShareCardData */
/** @typedef {import('./fonts.js').ShareCardFont} ShareCardFont */

export { ShareCard, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHTS } from './ShareCard.jsx'
export { shareCardFromPayload, shareCardDescription, shareCardAlt, shareCardModelLabel, formatShareCount } from './data.js'
export { SHARE_CARD_FONTS, SHARE_CARD_BODY_FONT, SHARE_CARD_MONO_FONT } from './fonts.js'

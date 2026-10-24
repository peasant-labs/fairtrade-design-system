// @ts-check
/* The faces the share card is drawn in, as static TTF files in ./fonts. An image renderer such as
   satori (Next's ImageResponse) cannot read woff2 or variable fonts, so these are static instances:
   Atkinson Hyperlegible 400 and 700 as released (google/fonts ofl/atkinsonhyperlegible), and
   Atkinson Hyperlegible Mono instanced from its variable font at wght 400 and 700
   (google/fonts ofl/atkinsonhyperlegiblemono, fontTools varLib.instancer --static), both from
   google/fonts commit 95f4904fc8bcf26d3420fe315560c96417c6dec7. SIL OFL 1.1: the license text for
   each family sits beside the files. `file` is the bare file name; a consumer reads the bytes and
   hands them to its renderer under `name`. */

/** @typedef {{ name: string, weight: 400 | 700, style: 'normal', file: string }} ShareCardFont */

/** The family names the card's styles ask for. */
export const SHARE_CARD_BODY_FONT = 'Atkinson Hyperlegible'
export const SHARE_CARD_MONO_FONT = 'Atkinson Hyperlegible Mono'

/** @type {ReadonlyArray<ShareCardFont>} */
export const SHARE_CARD_FONTS = Object.freeze([
  { name: SHARE_CARD_BODY_FONT, weight: 400, style: 'normal', file: 'AtkinsonHyperlegible-Regular.ttf' },
  { name: SHARE_CARD_BODY_FONT, weight: 700, style: 'normal', file: 'AtkinsonHyperlegible-Bold.ttf' },
  { name: SHARE_CARD_MONO_FONT, weight: 400, style: 'normal', file: 'AtkinsonHyperlegibleMono-Regular.ttf' },
  { name: SHARE_CARD_MONO_FONT, weight: 700, style: 'normal', file: 'AtkinsonHyperlegibleMono-Bold.ttf' },
])

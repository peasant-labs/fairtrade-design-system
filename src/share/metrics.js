// @ts-check
/* Advance widths of Atkinson Hyperlegible Regular (./fonts/AtkinsonHyperlegible-Regular.ttf), in
   thousandths of an em (the face's units per em is 1000), for printable ASCII (U+0020 to U+007E)
   and Latin-1 (U+00A0 to U+00FF). The share card uses them to wrap its prompt in code. Generated
   once from the face's hmtx table with fontTools:
     python3 -c "from fontTools.ttLib import TTFont; f = TTFont(path); cmap = f.getBestCmap();
                 print([f['hmtx'][cmap[c]][0] for c in codepoints])"
   Regenerate if the font file changes. */

/** U+0020 to U+007E */
const ASCII = [
  280, 281, 301, 655, 594, 927, 705, 160, 300, 300, 433, 602, 205, 368, 205, 377,
  648, 402, 549, 574, 614, 583, 598, 510, 615, 598, 205, 205, 553, 602, 553, 520,
  780, 626, 619, 656, 673, 567, 548, 710, 690, 414, 510, 627, 539, 820, 689, 727,
  601, 753, 618, 596, 558, 690, 589, 840, 623, 595, 607, 315, 377, 315, 552, 396,
  268, 526, 566, 500, 564, 539, 311, 560, 546, 278, 254, 490, 239, 841, 546, 552,
  566, 576, 340, 471, 324, 536, 441, 654, 461, 429, 460, 319, 233, 319, 555,
]

/** U+00A0 to U+00FF */
const LATIN_1 = [
  280, 281, 500, 586, 580, 595, 233, 530, 425, 798, 371, 562, 602, 348, 798, 382,
  352, 579, 382, 383, 268, 555, 508, 235, 291, 256, 381, 562, 826, 812, 868, 520,
  626, 626, 626, 626, 626, 626, 998, 656, 567, 567, 567, 567, 414, 414, 414, 414,
  712, 689, 727, 727, 727, 727, 727, 528, 727, 690, 690, 690, 690, 595, 576, 597,
  526, 526, 526, 526, 526, 526, 874, 500, 539, 539, 539, 539, 278, 278, 278, 278,
  567, 546, 552, 552, 552, 552, 552, 602, 552, 536, 536, 536, 536, 429, 566, 429,
]

/** the ellipsis, U+2026 */
export const ELLIPSIS_ADVANCE = 696

/**
 * The advance of one character in thousandths of an em, or null when it is outside the table.
 * @param {number} codePoint
 * @returns {number | null}
 */
export function bodyAdvance(codePoint) {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return ASCII[codePoint - 0x20]
  if (codePoint >= 0xa0 && codePoint <= 0xff) return LATIN_1[codePoint - 0xa0]
  return null
}

/* plain-text.js — the reader-facing text behind a Markdown source string, for one-line previews.

   A preview must read as prose, not as source: a row that surfaces `see [the guide](https://…)`
   would spell out punctuation the rendered body never shows. This is a preview shaper, not a
   parser. It never renders anything and never becomes a trust boundary: the body still renders
   through Markdown.jsx, which stays the one place untrusted transcript text becomes DOM.

   Deliberately lossy, and only for display: link and image destinations are dropped (a preview is
   not a navigation affordance), inline markers are unwrapped, and line-leading block markers are
   removed so a heading or list reads as its words. */

/* a link or image keeps only its text: `![alt](src)` / `[text](href "title")` */
const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g
const LINK = /\[([^\]]*)\]\([^)]*\)/g
/* an autolink keeps the address it displays */
const AUTOLINK = /<((?:https?:\/\/|mailto:)[^>\s]+)>/g
/* inline code keeps its content, whatever backtick run delimits it */
const INLINE_CODE = /(`+)([^`]*?)\1/g
/* emphasis, strong, and strike unwrap to their content. The `_` forms require a non-word
   neighbour on both sides so a snake_case identifier or a `__dunder__` is left alone. */
const STRIKE = /~~(?=\S)([\s\S]*?\S)~~/g
const STRONG_STAR = /\*\*(?=\S)([\s\S]*?\S)\*\*/g
const STRONG_UNDERSCORE = /(?<!\w)__(?=\S)([\s\S]*?\S)__(?!\w)/g
const EMPHASIS_STAR = /(?<!\w)\*(?=\S)([^*]*?\S)\*(?!\w)/g
const EMPHASIS_UNDERSCORE = /(?<!\w)_(?=\S)([^_]*?\S)_(?!\w)/g
/* a fenced-code delimiter line carries no words */
const FENCE = /^[ \t]*(?:`{3,}|~{3,}).*$/gm
/* a thematic break carries no words */
const THEMATIC_BREAK = /^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm
/* one line-leading block marker: heading, blockquote, bullet, or ordered-list number */
const BLOCK_MARKER = /^[ \t]{0,3}(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d{1,9}[.)][ \t]+)/gm
/* an HTML tag is markup, never text (raw HTML stays text in Markdown.jsx, so it is dropped here) */
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g
const HTML_COMMENT = /<!--[\s\S]*?-->/g

/**
 * The readable text of a Markdown source string, collapsed to one line.
 *
 * @param {unknown} content the recorded or display Markdown
 * @returns {string}
 */
export function plainTextPreview(content) {
  let text = String(content ?? '')
  text = text.replace(HTML_COMMENT, '')
  text = text.replace(FENCE, '')
  text = text.replace(THEMATIC_BREAK, '')
  /* nested block markers (`> - item`) need more than one pass before the words start */
  for (let pass = 0; pass < 4; pass += 1) {
    const next = text.replace(BLOCK_MARKER, '')
    if (next === text) break
    text = next
  }
  text = text.replace(AUTOLINK, '$1')
  text = text.replace(IMAGE, '$1')
  text = text.replace(LINK, '$1')
  text = text.replace(INLINE_CODE, '$2')
  text = text.replace(STRIKE, '$1')
  text = text.replace(STRONG_STAR, '$1')
  text = text.replace(STRONG_UNDERSCORE, '$1')
  text = text.replace(EMPHASIS_STAR, '$1')
  text = text.replace(EMPHASIS_UNDERSCORE, '$1')
  text = text.replace(HTML_TAG, '')
  return text.replace(/\s+/g, ' ').trim()
}

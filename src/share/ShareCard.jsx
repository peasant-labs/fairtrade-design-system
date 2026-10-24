/* ShareCard: the image a link preview shows for a village transcript, 1200 wide and 600 (X) or
   630 (everyone else) high. The same element is drawn two ways: by satori (Next's ImageResponse)
   on the server, and by React DOM where a page shows the card. satori reads a flexbox subset of
   inline styles only, so this component uses no class names, no stylesheet, no hooks and no
   line-clamp: every element with more than one child is display flex, the marks are inline SVG
   path data (./marks.js), and the prompt is cut to three lines in code. Colours are the dark
   theme's token values, read from the token file; the card is an image, so it has one theme.

   Layout: a top row (wheat logo and "peasant" on the left, the harness chip on the right), then
   the stats column (prompts and tokens tiles) beside the first prompt, drawn as a user turn. A
   card without figures drops the stats column and the prompt takes the full width. A null card
   (a transcript that is not public) draws the generic card, which names nothing about it. At 630
   high the extra 30px of background is split between the top and the bottom. */
import { color, font } from '../../public/tokens.json'
import { formatShareCount } from './data.js'
import { BRAND_FILL_RULE, BRAND_PATHS, USER_ICON, WHEAT_LOGO, brandViewBox, resolveBrand } from './marks.js'

/** @typedef {import('./data.js').ShareCardData} ShareCardData */

export const SHARE_CARD_WIDTH = 1200
/** X's large card is 2:1; every other platform gets 1.91:1, the same card with more background */
export const SHARE_CARD_HEIGHTS = Object.freeze([600, 630])

const dark = (role) => color[role].$value
const C = {
  canvas: dark('surface'),
  tile: dark('surface-2'),
  rule: dark('rule'),
  inkStrong: dark('ink-strong'),
  ink: dark('ink'),
  ink3: dark('ink-3'),
  teal: dark('teal'),
  amber: dark('amber'),
}
/* a user turn's background, as the transcript draws it: teal at 7% over the surface */
const TURN_TINT = mix(C.teal, C.canvas, 0.07)
const BODY = font['font-body'].$value
const MONO = font['font-mono'].$value

/* geometry, in px at 1200 wide */
const PAD_Y = 56
const PAD_X = 64
const RULE = 2
const TOP_ROW = 64
const BODY_GAP = 40
const STATS_W = 300
const COLUMN_GAP = 32
const EDGE = 4
const TURN_PAD_LEFT = 36
const TURN_PAD_RIGHT = 40
const PROMPT_SIZE = 44
const PROMPT_LINE = 1.4
const PROMPT_LINES = 3
const CHIP_SIZE = 34
const CHIP_CHARS = 32

/* The prompt clamp. satori ignores line-clamp, so the prompt is cut in code: it is wrapped into
   lines of the layout's width (narrower beside the stats column than at full width) with each
   character counted at the widest advance of its class in the body face, in em, and cut where a
   fourth line would start, leaving room for the ellipsis on the third. Words wrap whole and a
   word longer than a line breaks inside, as the renderers do with word-break: break-word.
   Characters outside the face (CJK, emoji) count as a full em and a little more. Over-counting
   only cuts a little early; the render gate holds every case to three drawn lines. */
const CONTENT_W = SHARE_CARD_WIDTH - 2 * PAD_X
const LINE_EM = {
  stats: (CONTENT_W - STATS_W - COLUMN_GAP - EDGE - TURN_PAD_LEFT - TURN_PAD_RIGHT) / PROMPT_SIZE,
  full: (CONTENT_W - EDGE - TURN_PAD_LEFT - TURN_PAD_RIGHT) / PROMPT_SIZE,
}
const ELLIPSIS = '…'
const ELLIPSIS_EM = 0.7
/* the widest advance in each class of Atkinson Hyperlegible Regular, in em */
const CHAR_EM = [
  [/^ $/, 0.28],
  [/^['`,.:;|lji!()"f[\]{}t]$/, 0.33],
  [/^[-r/\\_1Iy*vzxskc7J?]$/, 0.52],
  [/^[@MWm%]$/, 0.93],
  [/^[wCDNHU#&GOQ]$/, 0.76],
  [/^[a-z]$/, 0.58],
  [/^[\x21-\x7e]$/, 0.66],
  [/^[\u00a0-\u10ff]$/, 1.06],
]
const OTHER_EM = 1.1

/** @param {string} grapheme @returns {number} its width in em, rounded up */
function charEm(grapheme) {
  for (const [pattern, em] of CHAR_EM) if (pattern.test(grapheme)) return em
  return OTHER_EM
}

/** @param {string} text @returns {string[]} user-perceived characters */
function graphemes(text) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment)
  }
  return Array.from(text)
}

/**
 * The prompt as drawn: whitespace collapsed to single spaces, and cut with an ellipsis where it
 * would run past three lines of the layout.
 * @param {string} prompt
 * @param {boolean} fullWidth true when there is no stats column
 * @returns {string}
 */
export function sharePromptText(prompt, fullWidth) {
  const flat = String(prompt ?? '').replace(/\s+/g, ' ').trim()
  const lineEm = fullWidth ? LINE_EM.full : LINE_EM.stats
  const chars = graphemes(flat)
  const widths = chars.map(charEm)
  /** @type {{ width: number, items: number[] }[]} */
  const lines = [{ width: 0, items: [] }]
  let line = lines[0]
  const place = (index) => { line.items.push(index); line.width += widths[index] }
  const wrap = () => { line = { width: 0, items: [] }; lines.push(line) }
  let i = 0
  while (i < chars.length && lines.length <= PROMPT_LINES) {
    if (chars[i] === ' ') {
      // a space that would end a line is dropped there
      if (line.width > 0 && line.width + widths[i] <= lineEm) place(i)
      i += 1
      continue
    }
    let end = i
    let word = 0
    while (end < chars.length && chars[end] !== ' ') word += widths[end++]
    if (line.width > 0 && line.width + word > lineEm) wrap()
    for (; i < end; i += 1) {
      if (line.width > 0 && line.width + widths[i] > lineEm) wrap()
      place(i)
    }
  }
  if (lines.length <= PROMPT_LINES && i >= chars.length) return flat
  const last = lines[PROMPT_LINES - 1]
  while (last.items.length > 0 && last.width + ELLIPSIS_EM > lineEm) last.width -= widths[/** @type {number} */ (last.items.pop())]
  const kept = lines.slice(0, PROMPT_LINES).flatMap((row) => row.items)
  const through = kept.length > 0 ? kept[kept.length - 1] + 1 : 0
  // the ellipsis follows the last word, not a trailing space or comma
  return chars.slice(0, through).join('').replace(/[\s,;:]+$/, '') + ELLIPSIS
}

/** @param {string} text @param {number} max @returns {string} at most `max` characters */
function shorten(text, max) {
  const chars = graphemes(text)
  return chars.length > max ? chars.slice(0, max - 1).join('').trimEnd() + ELLIPSIS : text
}

/** Blend two token colours, `amount` of `top` over `base`, as an rgb() value. */
function mix(top, base, amount) {
  const rgb = (value) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16))
  const [a, b] = [rgb(top), rgb(base)]
  return `rgb(${a.map((channel, i) => Math.round(channel * amount + b[i] * (1 - amount))).join(', ')})`
}

function WheatLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox={WHEAT_LOGO.viewBox} aria-hidden="true" focusable="false">
      {WHEAT_LOGO.paths.map((d) => (
        <path key={d} d={d} fill="none" stroke={C.amber} strokeWidth={WHEAT_LOGO.strokeWidth} strokeLinecap="round" />
      ))}
    </svg>
  )
}

function Mark({ brand, size }) {
  const key = resolveBrand(brand ?? '')
  if (!key) return null
  return (
    <svg width={size} height={size} viewBox={brandViewBox(key)} aria-hidden="true" focusable="false">
      <path d={BRAND_PATHS[key]} fill={C.ink} fillRule={BRAND_FILL_RULE[key]} />
    </svg>
  )
}

function PersonIcon({ size }) {
  const stroke = { fill: 'none', stroke: C.teal, strokeWidth: USER_ICON.strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg width={size} height={size} viewBox={USER_ICON.viewBox} aria-hidden="true" focusable="false">
      <path d={USER_ICON.path} {...stroke} />
      <circle cx={USER_ICON.circle.cx} cy={USER_ICON.circle.cy} r={USER_ICON.circle.r} {...stroke} />
    </svg>
  )
}

function Frame({ height, children, center = false }) {
  const extra = (height - 600) / 2
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: center ? 'center' : 'flex-start',
        alignItems: center ? 'center' : 'stretch',
        boxSizing: 'border-box',
        width: SHARE_CARD_WIDTH,
        height,
        padding: `${PAD_Y + extra}px ${PAD_X}px`,
        backgroundColor: C.canvas,
        color: C.ink,
        fontFamily: MONO,
      }}
    >
      {children}
    </div>
  )
}

function StatTile({ label, value, last }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flexGrow: 1,
        flexBasis: 0,
        padding: '0 28px',
        backgroundColor: C.tile,
        border: `${RULE}px solid ${C.rule}`,
        borderTopWidth: last ? 0 : RULE,
      }}
    >
      <div style={{ display: 'flex', fontSize: 32, lineHeight: 1.2, color: C.ink3 }}>{label}</div>
      <div style={{ display: 'flex', marginTop: 12, fontSize: 84, lineHeight: 1, fontWeight: 700, color: C.inkStrong }}>{value}</div>
    </div>
  )
}

function UserTurn({ prompt, fullWidth }) {
  const text = sharePromptText(prompt, fullWidth)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        flexBasis: 0,
        overflow: 'hidden',
        padding: `32px ${TURN_PAD_RIGHT}px 32px ${TURN_PAD_LEFT}px`,
        backgroundColor: TURN_TINT,
        borderLeft: `${EDGE}px solid ${C.teal}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 32, lineHeight: 1, color: C.teal }}>
        <PersonIcon size={32} />
        <span>user</span>
      </div>
      <div
        key="prompt"
        style={{
          display: 'flex',
          flexShrink: 0,
          marginTop: 24,
          fontFamily: BODY,
          fontSize: PROMPT_SIZE,
          lineHeight: PROMPT_LINE,
          color: C.inkStrong,
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  )
}

function PublicCard({ card, height }) {
  const figures = card.figures
  return (
    <Frame height={height}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: TOP_ROW }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <WheatLogo size={44} />
          <span style={{ fontSize: 40, lineHeight: 1, fontWeight: 700, color: C.inkStrong }}>peasant</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            height: TOP_ROW,
            padding: '0 20px',
            border: `${RULE}px solid ${C.rule}`,
            fontSize: CHIP_SIZE,
            lineHeight: 1,
            color: C.ink,
          }}
        >
          <Mark brand={card.brand} size={CHIP_SIZE} />
          <span>{shorten(card.chip, CHIP_CHARS)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexGrow: 1, gap: COLUMN_GAP, marginTop: BODY_GAP }}>
        {figures ? (
          <div style={{ display: 'flex', flexDirection: 'column', width: STATS_W, flexShrink: 0 }}>
            <StatTile label="prompts" value={formatShareCount(figures.prompts)} />
            <StatTile label="tokens" value={formatShareCount(figures.tokens)} last />
          </div>
        ) : null}
        <UserTurn prompt={card.firstPrompt} fullWidth={!figures} />
      </div>
    </Frame>
  )
}

function GenericCard({ height }) {
  return (
    <Frame height={height} center>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <WheatLogo size={72} />
        <span style={{ fontSize: 64, lineHeight: 1, fontWeight: 700, color: C.inkStrong }}>peasant labs</span>
      </div>
      <div style={{ display: 'flex', marginTop: 36, fontSize: 36, lineHeight: 1.2, color: C.ink3 }}>visibility not public, click to see</div>
    </Frame>
  )
}

/**
 * The share card for a transcript link preview.
 * @param {object} props
 * @param {ShareCardData | null} props.card the card data, or null for a transcript that is not public
 * @param {600 | 630} [props.height] 600 for X's 2:1 card (the default), 630 for every other platform
 */
export function ShareCard({ card, height = 600 }) {
  const h = height === 630 ? 630 : 600
  return card ? <PublicCard card={card} height={h} /> : <GenericCard height={h} />
}

export default ShareCard

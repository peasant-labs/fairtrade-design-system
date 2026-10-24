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
import { color, font, other, space, typography } from '../../public/tokens.json'
import { formatShareCount } from './data.js'
import { BRAND_FILL_RULE, BRAND_PATHS, LOCK_ICON, USER_ICON, WHEAT_LOGO, brandViewBox, resolveBrand } from './marks.js'
import { ELLIPSIS_ADVANCE, MONO_BOLD_ADVANCE, bodyAdvance } from './metrics.js'

/** @typedef {import('./data.js').ShareCardData} ShareCardData */

export const SHARE_CARD_WIDTH = 1200
/** X's large card is 2:1; every other platform gets 1.91:1, the same card with more background */
export const SHARE_CARD_HEIGHTS = Object.freeze([600, 630])

const dark = (role) => color[role].$value
/** a token value with its colour references read as the dark theme's colours */
const token = (name) => other[name].$value.replace(/var\(--([\w-]+)\)/g, (_, role) => dark(role))
const C = {
  canvas: dark('surface'),
  surface2: dark('surface-2'),
  inkStrong: dark('ink-strong'),
  ink2: dark('ink-2'),
  ink3: dark('ink-3'),
  teal: dark('teal'),
  amber: dark('amber'),
}
/* the styles fairtrade draws these parts with: a stat tile (.st-tile, .st-eyebrow, .st-value), a
   user turn (.txn-turn, .turn.user, .txn-rolelabel), a chip (.chip) and body prose (p) */
const HAIRLINE = token('bd')
const CHIP_BORDER = token('bd-strong')
const TEAL_EDGE = `${token('stroke-emphasis')} solid ${C.teal}`
/* a user turn's background, as the transcript draws it: teal at 7% over the surface */
const TURN_TINT = mix(C.teal, C.canvas, 0.07)
const EYEBROW_TRACKING = '0.08em'
const PROSE_TRACKING = token('tracking-prose')
const PROSE_WORD_SPACING = token('word-spacing-prose')
const SP = (step) => space[`sp-${step}`].$value
const BODY_LINE = Number(typography['lh-body'].$value)
const BODY = font['font-body'].$value
const MONO = font['font-mono'].$value

/* geometry, in px at 1200 wide */
const PAD_Y = 56
const PAD_X = 64
const BODY_GAP = 40
const STATS_W = 300
const COLUMN_GAP = 32
const HAIRLINE_W = parseFloat(HAIRLINE)
const EDGE_W = parseFloat(token('stroke-emphasis'))
const TURN_PAD_Y = 28
const TURN_PAD_X = 32
const PROMPT_SIZE = 44
const PROMPT_LINE = 1.3
const PROMPT_LINES = 3
const CHIP_SIZE = 34
/* a stat tile: its padding, and the number's approved size */
const TILE_PAD_Y = 16
const TILE_PAD_X = 28
const VALUE_SIZE = 84
/* the tile's content box: the column less the padding and the hairline either side */
const TILE_CONTENT_W = STATS_W - 2 * TILE_PAD_X - 2 * HAIRLINE_W
const CHIP_CHARS = 32

/* The prompt's lines. satori has no line-clamp and no word-spacing, so the card lays the prompt
   out itself: it wraps the text into lines of the layout's width (narrower beside the stats
   column than at full width) and draws each line as a row, a word to a node and a space to a
   node of a fixed width. Each character's advance is read from the body face (./metrics.js), plus
   the prose letter-spacing; a space adds the prose word-spacing too, which is how a browser draws
   fairtrade's prose. Words wrap whole, and a word longer than a line breaks inside, as the
   renderers do. Where a fourth line would start the text is cut: the cut backs off to the last
   word end on the third line that leaves room for the ellipsis; only a third line that is one
   unbroken run is cut inside it. A character outside the table (CJK, emoji, a combining
   sequence) counts as OTHER_ADVANCE, wider than any glyph in the face, so a fallback font cannot
   push a line past its width. Widths are in thousandths of an em. */
const CONTENT_W = SHARE_CARD_WIDTH - 2 * PAD_X
const TURN_CHROME = EDGE_W + HAIRLINE_W + 2 * TURN_PAD_X
/* a line's width less a small margin for kerning and rounding in the renderers */
const lineUnits = (px) => Math.floor(((px - 2) / PROMPT_SIZE) * 1000)
const LINE_UNITS = {
  stats: lineUnits(CONTENT_W - STATS_W - COLUMN_GAP - TURN_CHROME),
  full: lineUnits(CONTENT_W - TURN_CHROME),
}
const ems = (value) => Math.round(parseFloat(value) * 1000)
const TRACKING_UNITS = ems(PROSE_TRACKING)
const SPACE_UNITS = /** @type {number} */ (bodyAdvance(0x20)) + TRACKING_UNITS + ems(PROSE_WORD_SPACING)
/** a space as drawn, in px: the face's space, the prose letter-spacing and word-spacing */
const SPACE_PX = (SPACE_UNITS / 1000) * PROMPT_SIZE
const ELLIPSIS = '…'
const OTHER_ADVANCE = 1100

/** @param {string} grapheme @returns {number} its advance with the prose letter-spacing, in thousandths of an em */
function advance(grapheme) {
  if (grapheme === ' ') return SPACE_UNITS
  const points = Array.from(grapheme)
  const known = points.length === 1 ? bodyAdvance(/** @type {number} */ (points[0].codePointAt(0))) : null
  return (known ?? OTHER_ADVANCE) + TRACKING_UNITS
}

/** @param {string} text @returns {string[]} user-perceived characters */
function graphemes(text) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment)
  }
  return Array.from(text)
}

/**
 * @typedef {object} PromptLine
 * @property {string} text the line as drawn, single spaces between its words
 * @property {boolean} breakSpace true when the line ends where the prompt has a space (the space is drawn zero wide)
 */

/**
 * The prompt as drawn: whitespace collapsed to single spaces, wrapped into the layout's lines, and
 * cut with an ellipsis where it would run past three of them.
 * @param {string} prompt
 * @param {boolean} fullWidth true when there is no stats column
 * @returns {PromptLine[]}
 */
export function sharePromptLines(prompt, fullWidth) {
  const flat = String(prompt ?? '').replace(/\s+/g, ' ').trim()
  const limit = fullWidth ? LINE_UNITS.full : LINE_UNITS.stats
  const chars = graphemes(flat)
  const widths = chars.map(advance)
  /** @type {{ width: number, items: number[] }[]} each line's width and the indices it holds */
  const lines = [{ width: 0, items: [] }]
  let line = lines[0]
  const place = (index) => { line.items.push(index); line.width += widths[index] }
  const wrap = () => { line = { width: 0, items: [] }; lines.push(line) }
  let i = 0
  while (i < chars.length && lines.length <= PROMPT_LINES) {
    let end = i
    let word = 0
    while (end < chars.length && chars[end] !== ' ') word += widths[end++]
    // the space before a word counts only when the word stays on the same line
    const gap = line.items.length > 0 && chars[i - 1] === ' ' ? widths[i - 1] : 0
    if (line.items.length > 0 && line.width + gap + word > limit) wrap()
    else if (gap) place(i - 1)
    for (; i < end; i += 1) {
      if (line.items.length > 0 && line.width + widths[i] > limit) wrap()
      place(i)
    }
    i = end + 1
  }
  const whole = lines.length <= PROMPT_LINES && i >= chars.length
  const kept = lines.slice(0, PROMPT_LINES).filter((each) => each.items.length > 0)
  const drawn = kept.map((each, k) => {
    const next = kept[k + 1]
    return {
      text: each.items.map((index) => chars[index]).join(''),
      breakSpace: next !== undefined && chars[next.items[0] - 1] === ' ',
    }
  })
  if (whole) return drawn
  const last = lines[PROMPT_LINES - 1]
  drawn[PROMPT_LINES - 1] = { text: cut(chars, widths, last, limit), breakSpace: false }
  return drawn
}

/** The third line, cut so the ellipsis fits: at its last word end that leaves room, else inside the run. */
function cut(chars, widths, last, limit) {
  const room = limit - ELLIPSIS_ADVANCE - TRACKING_UNITS
  let width = 0
  let wordEnd = -1
  let charEnd = -1
  for (const index of last.items) {
    width += widths[index]
    if (width > room) break
    if (chars[index] === ' ') continue
    charEnd = index
    if (chars[index + 1] === ' ') wordEnd = index
  }
  const from = last.items[0]
  // a third line with no room at all holds the ellipsis alone
  const through = wordEnd >= 0 ? wordEnd + 1 : charEnd >= 0 ? charEnd + 1 : from
  // the ellipsis follows the last word, not a trailing comma or colon
  return chars.slice(from, through).join('').replace(/[\s,;:]+$/, '') + ELLIPSIS
}

/** @param {string} text @param {number} max @returns {string} at most `max` characters */
function shorten(text, max) {
  const chars = graphemes(text)
  return chars.length > max ? chars.slice(0, max - 1).join('').trimEnd() + ELLIPSIS : text
}

/**
 * The size a tile number is drawn at: the approved 84px, or smaller when the number would run
 * past its tile at 84px. The numbers' face is monospaced, so a number's width is its character
 * count times one advance. Only the size changes; the number stays rounded as the page rounds it.
 * @param {string} value
 * @returns {number} px
 */
function shareValueSize(value) {
  const chars = graphemes(value).length
  if (chars === 0) return VALUE_SIZE
  return Math.min(VALUE_SIZE, Math.floor(TILE_CONTENT_W / ((chars * MONO_BOLD_ADVANCE) / 1000)))
}

/** Blend two token colours, `amount` of `top` over `base`, as an rgb() value. */
function mix(top, base, amount) {
  const rgb = (value) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16))
  const [a, b] = [rgb(top), rgb(base)]
  return `rgb(${a.map((channel, i) => Math.round(channel * amount + b[i] * (1 - amount))).join(', ')})`
}

function WheatLogo({ size, nodeKey }) {
  return (
    <svg key={nodeKey} width={size} height={size} viewBox={WHEAT_LOGO.viewBox} aria-hidden="true" focusable="false">
      {WHEAT_LOGO.paths.map((d) => (
        <path key={d} d={d} fill="none" stroke={C.amber} strokeWidth={WHEAT_LOGO.strokeWidth} strokeLinecap="round" />
      ))}
    </svg>
  )
}

function Mark({ brand, size, fill }) {
  const key = resolveBrand(brand ?? '')
  if (!key) return null
  return (
    <svg width={size} height={size} viewBox={brandViewBox(key)} aria-hidden="true" focusable="false">
      <path d={BRAND_PATHS[key]} fill={fill} fillRule={BRAND_FILL_RULE[key]} />
    </svg>
  )
}

const LUCIDE_STROKE = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' }

function PersonIcon({ size }) {
  const stroke = { ...LUCIDE_STROKE, strokeWidth: USER_ICON.strokeWidth }
  return (
    <svg width={size} height={size} viewBox={USER_ICON.viewBox} aria-hidden="true" focusable="false">
      <path d={USER_ICON.path} {...stroke} />
      <circle cx={USER_ICON.circle.cx} cy={USER_ICON.circle.cy} r={USER_ICON.circle.r} {...stroke} />
    </svg>
  )
}

function LockIcon({ size }) {
  const stroke = { ...LUCIDE_STROKE, strokeWidth: LOCK_ICON.strokeWidth }
  const { x, y, width, height, rx } = LOCK_ICON.rect
  return (
    <svg key="lock" width={size} height={size} viewBox={LOCK_ICON.viewBox} aria-hidden="true" focusable="false">
      <rect x={x} y={y} width={width} height={height} rx={rx} ry={rx} {...stroke} />
      <path d={LOCK_ICON.path} {...stroke} />
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
        color: C.inkStrong,
        fontFamily: MONO,
      }}
    >
      {children}
    </div>
  )
}

/* a stat tile as fairtrade draws one (.st-tile): a hairline box on the surface, the tracked mono
   eyebrow over the figure; the figure is bold, the owner's choice for the card, and drawn at 84px
   unless it is too wide for the tile at that size (shareValueSize) */
function StatTile({ label, value }) {
  return (
    <div
      key={`stat-${label}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: SP(1),
        flexGrow: 1,
        flexBasis: 0,
        padding: `${TILE_PAD_Y}px ${TILE_PAD_X}px`,
        border: HAIRLINE,
        backgroundColor: C.canvas,
      }}
    >
      <div key={`eyebrow-${label}`} style={{ display: 'flex', fontSize: 32, lineHeight: 1.3, letterSpacing: EYEBROW_TRACKING, color: C.ink3 }}>
        {label}
      </div>
      <div key={`value-${label}`} style={{ display: 'flex', marginTop: 6, fontSize: shareValueSize(value), lineHeight: 1, fontWeight: 700, color: C.inkStrong }}>
        {value}
      </div>
    </div>
  )
}

/* The prompt, a row a line: a word to a node keyed w<n>, a space to a node keyed s<n> drawn one
   prose space wide (a space where the line breaks is kept zero wide, as a browser hangs it). */
function Prompt({ prompt, fullWidth }) {
  const lines = sharePromptLines(prompt, fullWidth)
  let n = 0
  const space = (width) => {
    const key = `s${n++}`
    return <span key={key} style={{ display: 'flex', flexShrink: 0, width, overflow: 'hidden' }}>{' '}</span>
  }
  return (
    <div
      key="prompt"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        fontFamily: BODY,
        fontSize: PROMPT_SIZE,
        lineHeight: PROMPT_LINE,
        letterSpacing: PROSE_TRACKING,
        wordSpacing: PROSE_WORD_SPACING,
        color: C.inkStrong,
      }}
    >
      {lines.map((line, row) => {
        const pieces = []
        line.text.split(' ').forEach((word, index) => {
          if (index > 0) pieces.push(space(SPACE_PX))
          pieces.push(<span key={`w${n++}`} style={{ display: 'flex', flexShrink: 0 }}>{word}</span>)
        })
        if (line.breakSpace) pieces.push(space(0))
        return (
          <div key={`line-${row}`} style={{ display: 'flex' }}>
            {pieces}
          </div>
        )
      })}
    </div>
  )
}

/* the first prompt as fairtrade draws a user turn (.txn-turn.user): a hairline box with the teal
   edge on the turn tint, the bold teal "user" label over the prose */
function UserTurn({ prompt, fullWidth }) {
  return (
    <div
      key="turn"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flexGrow: 1,
        flexBasis: 0,
        overflow: 'hidden',
        padding: `${TURN_PAD_Y}px ${TURN_PAD_X}px`,
        border: HAIRLINE,
        borderLeft: TEAL_EDGE,
        backgroundColor: TURN_TINT,
      }}
    >
      <div
        key="role"
        style={{ display: 'flex', alignItems: 'center', gap: SP(2), marginBottom: 14, fontSize: 32, lineHeight: 1.5, fontWeight: 700, color: C.teal }}
      >
        <PersonIcon size={32} />
        <span>user</span>
      </div>
      <Prompt prompt={prompt} fullWidth={fullWidth} />
    </div>
  )
}

function PublicCard({ card, height }) {
  const figures = card.figures
  return (
    <Frame height={height}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <WheatLogo size={44} />
          <span style={{ fontSize: 40, lineHeight: 1, fontWeight: 700, color: C.inkStrong }}>peasant</span>
        </div>
        <div
          key="chip"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 18px',
            border: CHIP_BORDER,
            fontSize: CHIP_SIZE,
            lineHeight: BODY_LINE,
            color: C.ink2,
          }}
        >
          <Mark brand={card.brand} size={CHIP_SIZE} fill={C.ink2} />
          <span>{shorten(card.chip, CHIP_CHARS)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexGrow: 1, gap: COLUMN_GAP, marginTop: BODY_GAP }}>
        {figures ? (
          <div key="stats" style={{ display: 'flex', flexDirection: 'column', gap: SP(5), width: STATS_W, flexShrink: 0 }}>
            <StatTile label="prompts" value={formatShareCount(figures.prompts)} />
            <StatTile label="tokens" value={formatShareCount(figures.tokens)} />
          </div>
        ) : null}
        <UserTurn prompt={card.firstPrompt} fullWidth={!figures} />
      </div>
    </Frame>
  )
}

/* the card for a transcript that is not public: the mark, and a tag (.tag) that says only that
   its visibility is limited, drawn large enough to read on a phone timeline */
function GenericCard({ height }) {
  return (
    <Frame height={height} center>
      <div key="mark" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
        <WheatLogo size={118} nodeKey="logo" />
        <span key="wordmark" style={{ fontSize: 100, lineHeight: 1, fontWeight: 700, color: C.inkStrong }}>peasant labs</span>
      </div>
      <div
        key="chip"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          marginTop: 44,
          padding: '16px 30px',
          border: CHIP_BORDER,
          backgroundColor: C.surface2,
          fontSize: 54,
          lineHeight: 1.3,
          fontWeight: 400,
          color: C.ink2,
        }}
      >
        <LockIcon size={50} />
        <span>limited visibility</span>
      </div>
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

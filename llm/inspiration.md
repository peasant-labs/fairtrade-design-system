# inspiration

deep visual analysis of the reference images collected for the retro-terminal / caves-of-qud
design system. our identity: amber + ink on a near-black canvas (dark is default, plus a pure-white
light theme), atkinson hyperlegible mono for chrome and atkinson hyperlegible for prose, vector
icons only, all-lowercase ui chrome, tokens like `--amber #cba35c`, `--ink`, `--canvas`,
`--teal` / `--olive` / `--clay` / `--mauve`, and a 4/8 spacing scale.

## the unifying idea

every one of these references does the same trick: it takes a photo or a smooth gradient and
re-renders it as something built out of a grid of small marks. ascii characters, dot-matrix dots,
halftone circles, dither stipple, repeated glyphs. the source image is still legible, but it has
been forced through a coarse cell grid and quantized down to a few tones. nothing here is
photographic. everything has been "typed out."

that maps onto the terminal identity almost too neatly. a terminal is a grid of character cells in
one or two colors. so the natural way to put imagery into this system is not to drop in a jpeg, it
is to render that jpeg as if a terminal drew it: luminance sampled per cell, mapped to a glyph or a
dot or one of our palette tones. the result reads as native to the system rather than pasted on
top of it.

three families of technique recur:

- imagery turned into marks on a grid: ascii art, dot-matrix, halftone, dither (refs 01, 02, 03,
  06, 08, and the mp4 stills).
- glyph-grid as texture: rows of repeated mono symbols used as surface or pattern, not as content
  (refs 03, 04, 05).
- duotone / engraving photo treatment: a real photo crushed to two tones so it sits inside a
  restricted palette (refs 07, 08).

all three are monochrome-or-duotone, all three are grid-aligned, all three are cheap to theme
because they only ever reference two or three colors. that is the whole reason they fit: they are
already token-shaped.

## catalog

### 01 — dark green cards, paintings as ascii/dither art

three cards on near-black. each card holds a classical painting (a face, a figure, an eye) that has
been rendered as low-contrast ascii / dither art, tinted a deep desaturated green. headings are set
in mono and uppercase ("predictive analysis risk control", "real-time data. live systems.",
"observes. learns. evolves."). body copy sits below in a smaller mono face, and feature lists use a
`>` prefix as the bullet.

- technique: image to ascii/dither, rendered as monochrome marks, then tinted a single hue. the
  art lives inside the card as a contained tile, not bleeding to the edges.
- palette: near-black field, one deep green for the art, off-white text. effectively duotone per
  card.
- layout: three equal cards in a row, generous gutters, lots of negative space above and below.
  heading / art / paragraph / `>` list is the repeated vertical rhythm.
- maps to us: this is the card pattern almost verbatim. swap the green for our `--amber` (or a
  per-card accent from `--teal` / `--olive` / `--clay` / `--mauve`), keep `>` bullets, keep the
  mono uppercase-to-lowercase headings.

### 02 — faq accordion with ascii mountain

a faq block on near-black. a small boxed "faq" tag sits next to a `//` comment marker and the
question "got a question in mind?". each accordion row is a question prefixed with `>` (and `v`
when open), separated by dashed hairline rules. lower left repeats the `//` marker for "still
stuck?". to the right, a mountain is rendered as scanline / ascii art fading into the background. a
single green button ("contact support") is the only saturated element.

- technique: `//` and `>` borrowed straight from code as ui markers. the mountain is image to
  scanline-ascii, low contrast, used as a quiet anchor in the right column rather than a focal
  image.
- palette: near-black, dim grey text, dashed grey rules, one green accent for the cta. almost
  monochrome.
- layout: two columns. left is the functional accordion, right is the decorative ascii art. dashed
  rules do the dividing instead of boxes.
- maps to us: our accordion / faq pattern. `//` becomes a section comment marker in mono, `>` and
  `v` are the row affordances, dashed hairlines use `--ink` at low alpha, the lone cta uses
  `--amber`. the ascii mountain is exactly the kind of restrained decorative art we allow off to
  the side, never under text.

### 03 — phone mockups, cream + brown duotone, heavy cp437

three iphone screens in a strict cream-and-dark-brown duotone. dense cp437 / ascii dot-matrix art
fills each: a glyph portrait, a checkerboard-bordered "1_error" panel with a `[online]` tag and a
"search" field, a snowflake-like radial dot burst, and stacked sensor readouts ("pm2.5 lug/m'",
"flow 875m'/h", "sensor sec pid", numeric columns). checkerboard borders frame panels. big display
letters ("eve", "u") punctuate the grids.

- technique: the most maximal example of glyph-grid as both content and texture. dot-matrix
  portraits, checkerboard (alternating filled/empty cells) used as a border motif, monospace data
  readouts treated as decoration.
- palette: two colors only, cream paper and dark brown. proves the duotone constraint can carry an
  entire dense layout.
- layout: full-bleed phone canvases, everything snapped to a visible character grid, hard edges, no
  rounded softness.
- maps to us: the "data readout" surfaces (sensor rows, code-like ids) are our dashboard / status
  language. the duotone here is the direct analog of our two themes: cream-on-brown is the light
  theme mood, invert it for amber-on-near-black dark. checkerboard borders are a good restrained
  frame motif. caution: this is denser than our restraint rules allow over reading text, so borrow
  the surfaces, not the density.

### 04 — black mailer bag with glyph rows + ctrl shift booklet

a matte black poly mailer printed with neat rows of repeated symbols, one glyph per row:
`+  *  &  ^  %  $  #  @  !`. each row is evenly spaced, monochrome white on black, like a type
specimen. beside it, a "ctrl shift" booklet whose cover is a soft iridescent gradient with the
words "curiosity / taste / craft / experimentation / thoughtfulness" set small in the corner.

- technique: glyph-grid as pure texture. a single symbol tiled across a row, rows stacked, used as
  surface ornament. the gradient booklet is the one place smooth color is allowed, as contrast
  against all the hard glyph grids.
- palette: black and white for the glyph field, then a full iridescent gradient for the booklet
  cover. high contrast pairing of "system" and "spectrum".
- layout: type-specimen logic. equal rows, equal tracking, the symbol set itself is the content.
- maps to us: this is the cleanest brief for our glyph-grid background pattern. one mono glyph
  repeated on a grid in `--ink` at low alpha over `--canvas`. the iridescent gradient is not us
  (we hold the line on flat tone), but the idea of one warm accent moment against an otherwise
  monochrome system is exactly our `--amber` against ink.

### 05 — keyboard poster under holographic glyph-rain

a vertical poster. a black mechanical keyboard photographed straight-on, sitting under a dense
overlay of falling glyph columns (`#`, cjk-like characters, `+`) lit in iridescent rainbow. the
glyph-rain is heaviest at the top and rains down over and behind the keyboard. "ctrl shift"
set small at the lower left over a fine-print paragraph.

- technique: digital-rain (matrix-style falling glyph columns) composited over a real photo, with
  an iridescent gradient mapped across the glyphs. this is the static cousin of the animated mp4
  field.
- palette: black base, full-spectrum holographic glyphs, the keyboard photo near-monochrome
  underneath.
- layout: poster, photo as anchor, glyph field as atmosphere on top, tiny type as the only
  "ui" element.
- maps to us: the falling-glyph structure is the reference for our animated dot-field / digital
  rain, but we strip the rainbow. ours falls in `--amber` (and maybe a second column tint from
  `--teal`) over near-black, dark-theme only, motion gated behind prefers-reduced-motion. we keep
  it behind a hero image, never over reading text.

### 06 — "in-depth research while you sleep" landing page

a clean dark landing page. small lowercase nav ("pulse.io", "pricing", "about us", "blog") on a
near-black bar with one pill button ("book a demo"). centered serif-ish display headline "in-depth
research while you sleep", a one-line mono subhead, a cta. the centerpiece is a large rectangular
block of ascii art, faint white characters on black, reading as an abstract data texture.

- technique: image-to-ascii used as the hero centerpiece rather than a photo. low contrast, fine
  mono characters, sits centered as the single focal object on the page.
- palette: near-black canvas, off-white text, the ascii block in dim white. near-monochrome with a
  faint vignette.
- layout: classic centered hero. nav / headline / subhead / cta / ascii-art block stacked, lots of
  air, the ascii block doing all the visual work.
- maps to us: this is our hero pattern almost exactly. centered lowercase mono chrome, one cta in
  `--amber`, and an ascii-art hero rendered from a source image in `--ink`/`--amber` on
  `--canvas`. the restraint here (one big quiet ascii block, nothing else loud) is the mood we want.

### 07 — coinbase-style marketing screens with engraving textures

a grid of marketing screen mockups, mostly light theme. tiny `[crypto trading]` bracket tags above
headings, big bold display headings, stat rows ("$145b+", "100+ countries"), feature lists with
small vector icons. the recurring texture move: a faint wireframe / engraving globe behind one
panel, and a fine line-engraving of a face on another. these textures are subtle, low contrast,
sitting behind or beside the copy.

- technique: duotone / engraving photo treatment. a globe as a thin wireframe, a portrait as fine
  engraved lines, both desaturated and low-contrast so they read as paper texture, not as images.
- palette: mostly white-theme (white paper, near-black text, a blue accent), with the engravings in
  faint grey. the few dark panels invert to near-black with light text.
- layout: editorial marketing blocks. bracket tag / heading / supporting copy / stats or icon list.
  textures are backgrounds, never foreground.
- maps to us: the bracket-tag label (`[crypto trading]`) is a good mono chrome device, becomes
  `[label]` in lowercase. the engraving-as-quiet-texture approach is how we treat any photo: crush
  it to a duotone (`--ink` shadows, `--amber` or `--teal` highlights) and keep it faint. this ref
  also proves the system survives a true-white light theme, which is one of our hard requirements.

### 08 — space / astronomy set

four panels. top left: a halftone dot-matrix moon (the moon rendered entirely as dots whose size
tracks brightness) with "earth. moon. mars. and beyond." top right: a clean vector line-drawing of
a space shuttle ("atlantis") with a small "flight information" data table, on a faint grid. bottom
left: three moons in a row, each a halftone/duotone photo with a caption. bottom right: a real rocket
launch photo, near-monochrome, with "from earth to infinity. the journey starts with velastra."

- technique: a clean survey of three of our techniques side by side. halftone dot-matrix (the
  moon), vector line-art with a data table (the shuttle), and duotone photo (the moons and the
  rocket). the line-art sits on a faint background grid.
- palette: black and white throughout, occasional warm-grey duotone on the moon photos. disciplined
  monochrome.
- layout: a four-up grid, each cell a different treatment, unified by the shared palette and the
  recurring small mono data labels.
- maps to us: the halftone moon is the canonical dot-matrix recipe. the shuttle is our vector-icon
  and data-table language (vector icons only is one of our rules). the faint background grid is a
  good system surface. everything here is already two-tone, so it themes by swapping black/white for
  `--ink`/`--canvas` and adding `--amber` as the single accent.

### ascii-mp4 stills a + b — animated dot-field / digital rain

two stills from an animated phone mockup. a field of small white squares of varying brightness on a
black screen, organized in columns that read as falling / flowing, like rain or a data stream.
between still a and still b the field has shifted (the bright cells have moved), confirming it
animates. big lowercase display headlines below ("meet your intelligent space", "built around your
flow") with pill buttons ("continue", "get started").

- technique: an animated dot-field. a grid of cells where each cell's brightness changes over time,
  with brightness tending to fall down each column so it reads as motion. this is the dynamic
  version of the dot-matrix / digital-rain idea, done with plain squares instead of glyphs.
- palette: pure black screen, white cells at varying opacity. strict monochrome, which is why the
  motion reads cleanly.
- layout: onboarding screen. animated field fills the top two thirds, headline and single cta
  anchor the bottom. lots of black breathing room.
- maps to us: this is the reference for our animated dot-field, dark-theme only. cells in `--amber`
  at varying alpha over near-black, falling per column, on a canvas element. it must have a static
  prefers-reduced-motion fallback (render one frame) and must never sit under reading text, only as
  a hero / onboarding atmosphere.

## techniques

concrete recipes, tuned to our tokens. all of them resolve color from css variables so they theme
automatically, and all of them quantize to two or three tones so contrast stays controllable.

### a. image to ascii art

turn a source image into mono characters on a grid.

- downsample the image to a low cell grid. pick columns by target width, e.g. 80–120 cells wide for
  a hero, 30–50 for a card tile.
- correct for cell aspect: monospace cells are taller than they are wide (roughly 1:2 width:height),
  so sample with vertical steps about twice the horizontal step, or the image comes out squashed.
  in practice: `cellH = cellW * 2`.
- for each cell, average the luminance of the pixels under it. luminance `= 0.2126r + 0.7152g +
  0.0722b`, on 0..1.
- map luminance to a character from a ramp ordered light to dark. a short ramp reads cleaner than a
  long one: ` .:-=+*#%@` (light to dark) works, and you can hand-pick a ramp that biases toward our
  glyph vocabulary (`. : > / # @`). on dark theme invert the ramp (dark canvas means high luminance
  should map to denser/brighter glyphs).
- render into a `<pre>` with our mono face (atkinson hyperlegible mono), `line-height: 1` and a
  fixed `font-size`, color `var(--ink)` on `var(--canvas)` for a flat look, or `var(--amber)` for
  an accent piece. set `aria-hidden="true"` and provide a real `alt`/caption on the source so it
  stays accessible.
- key params: cell width (detail vs weight), ramp length and contents (texture character),
  contrast/gamma pre-pass (push midtones so the ramp uses its full range).

### b. dot-matrix / halftone

cell luminance to dot radius (the moon in ref 08, the portraits in ref 03).

- lay a grid over the image at a chosen cell size (e.g. 8px or 12px cells).
- per cell, average luminance as above.
- map luminance to a dot radius: brighter cell to bigger dot on dark theme (dots are the light), or
  darker cell to bigger dot on light theme (dots are the ink). clamp radius to `0 .. cellSize/2`
  so dots never collide.
- draw filled circles centered in each cell. canvas `arc()` for the dynamic case, or generate an
  svg of `<circle>`s for a crisp static asset.
- color: dots in `var(--amber)` or `var(--ink)`, background `var(--canvas)`. one tone only.
- variants: square cells instead of circles gives the cp437 / ref-03 look; offsetting alternating
  rows by half a cell gives a classic halftone screen.
- key params: cell size (coarseness), radius curve (linear vs gamma), dot shape (circle vs square),
  row offset (straight grid vs halftone).

### c. animated dot-field / digital rain (the mp4)

per-column falling brightness on a canvas (the mp4 stills, ref 05).

- set up a grid of cells over a canvas sized to its container, devicePixelRatio-aware.
- give each column a phase and a falling "head" position. each frame, advance the head down the
  column and wrap at the bottom. cells near the head are brightest, brightness decays with distance
  above the head (a short trail), so each column reads as a falling streak.
- optionally add low-amplitude per-cell noise so the field shimmers instead of marching in lockstep.
- draw each cell as a small square (mp4 look) or a glyph (matrix look) at alpha proportional to its
  brightness. color is `var(--amber)` resolved once via `getComputedStyle`; a small fraction of
  columns can use `var(--teal)` for variation.
- dark theme only. on light theme, do not render the field (or render a single faint static frame),
  because bright cells on white have nowhere to glow.
- prefers-reduced-motion: render exactly one frame and stop the loop. expose the same visual as a
  static dot-field so reduced-motion users still get the texture, just frozen.
- never place it under reading text. it lives behind a hero or fills an onboarding panel, with text
  in a separate region or over a solid scrim.
- key params: cell size, fall speed, trail length, shimmer amount, column density, frame throttle
  (cap at ~24–30fps to keep it calm and cheap).

### d. duotone photo

map a photo to two tones with svg filters (the engravings in ref 07, the moons and rocket in ref
08).

- desaturate first: `feColorMatrix type="saturate" values="0"` to get luminance.
- then remap that grayscale to a two-color gradient with `feComponentTransfer`: drive the r/g/b
  channels with `feFuncR/G/B` so shadows land on `--ink` and highlights land on `--amber` (or
  `--teal`). using `type="table"` with two stops per channel gives a clean two-point duotone;
  add a middle stop for a three-tone version.
- because css variables cannot be read inside an svg filter directly, generate the `tableValues`
  from the resolved token colors in js (read the rgb of `--ink` and `--amber`, normalize to 0..1,
  feed them in), or maintain one filter per theme and toggle which filter the image references.
- keep it faint when it is texture (ref 07 engravings): low `opacity` or composited behind copy
  with a scrim. keep it full strength when it is the subject (ref 08 rocket).
- light theme: shadows to `--ink`, highlights to `--canvas` (paper), so a photo reads as an
  engraving on white. dark theme: shadows to `--canvas` (near-black), highlights to `--amber`.
- key params: the two/three endpoint colors per theme, midpoint position (controls how much of the
  image is shadow vs highlight), overall opacity when used as texture.

### e. glyph-grid texture

repeated mono glyphs as a tiled background (ref 04 mailer, ref 03 borders).

- cheapest version: a repeating css background. render one glyph (or a short row like
  `+ * & ^ % $ #`) into a small tile (svg or a data-uri) and `background-repeat`. tile size sets the
  density.
- or a single-element css approach: a `repeating-linear-gradient` or a `<pre>` filled with one
  glyph, sized to the container, color `var(--ink)` at low alpha (e.g. 6–12%) over `var(--canvas)`.
- checkerboard border (ref 03): alternate filled and empty cells along an edge; a
  `repeating-conic-gradient` or a tiled 2x2 svg does this with no markup.
- always low contrast and behind content, never competing with it. it is wallpaper, not signage.
- themes by token: the glyph color is `var(--ink)` (dark theme: faint warm grey on near-black;
  light theme: faint grey on paper). the accent variant uses `var(--amber)` at very low alpha for a
  warmer surface.
- key params: glyph choice (from our vocabulary), tile size (density), alpha (must stay faint
  enough that text over it still passes AA), grid offset.

### f. scanline / crt overlay

a low-opacity horizontal-line overlay for atmosphere (the scanline mountain in ref 02, the general
terminal mood).

- a fixed or absolutely-positioned overlay element with a `repeating-linear-gradient` of thin
  transparent-to-faint-`--ink` horizontal lines, 2–4px period, very low alpha (3–6%),
  `pointer-events: none`.
- optional very slow vertical drift of the lines for a "rolling" crt feel, but only as motion that
  is gated.
- dark theme only. on a pure-white light theme, scanlines either vanish or turn into dirt, so do not
  render them there.
- prefers-reduced-motion: drop any drift animation; a static faint overlay is fine, animated roll is
  not.
- never over reading text. apply it to chrome, hero panels, and decorative surfaces, or keep its
  alpha low enough that text contrast over it still passes AA (verify, do not assume).
- key params: line period, line alpha, drift speed (or none), z-index relative to content (always
  below text, or low enough alpha to be safe).

## what to build into the design system

prioritized by whether the effect earns its place as a real system primitive or is decorative
sugar. our hard rules govern all of it: real restraint, readability never sacrificed, no decorative
cruft over reading text, AA contrast in both themes, every effect token-themed and theme-aware.

build now (these earn their place):

1. image-to-ascii (technique a). the single most on-identity effect and directly useful for hero
   art (ref 06) and card tiles (ref 01). flat, static, themeable, accessible behind `aria-hidden`
   plus a real caption. ship it as a build-time asset generator so pages serve static markup, not a
   client-side render.
2. duotone photo (technique d). this is how every real photograph enters the system. without it,
   photos break the palette. must ship per-theme (ink/amber dark, ink/paper light) and is the thing
   that proves the light theme works (ref 07). high priority.
3. glyph-grid texture (technique e). our quiet background surface. cheap, pure css, faint, fully
   token-themed. it is the "this is a terminal" wallpaper. low risk, high identity payoff.
4. dot-matrix / halftone (technique b). a strong static alternative to ascii for imagery that wants
   to stay photographic-ish (the moon in ref 08). build the static svg generator now; it shares the
   luminance-sampling code with technique a.

build later / behind a flag (decorative, must be optional and gated):

5. animated dot-field / digital rain (technique c). striking for a hero or onboarding (mp4 stills,
   ref 05), but it is motion and it is dark-theme only. only ship with a static reduced-motion
   fallback baked in, never under text, and only in a couple of designated atmosphere slots. it is a
   garnish, not a primitive.
6. scanline / crt overlay (technique f). pure atmosphere. dark-theme only, very low alpha,
   reduced-motion-gated, never over reading text. lowest priority. include it only if it stays
   invisible enough to never threaten contrast; cut it the moment it does.

do not build:

- iridescent / holographic gradients (refs 04, 05). off-identity. we hold flat tone and let
  `--amber` be the single warm moment against ink.
- maximal cp437 density (ref 03) over or near reading content. borrow its data-readout surfaces and
  checkerboard borders, not its density. density fights readability and our restraint rule.

guardrails for every effect above: resolve all colors from tokens (no hard-coded hex), provide a
light-theme behavior (render, invert, or skip, but decide explicitly), verify AA contrast for any
text that sits over or near the effect in both themes, gate all motion behind
prefers-reduced-motion, and keep decorative art out from under prose. when in doubt, the effect
loses and the reading experience wins.

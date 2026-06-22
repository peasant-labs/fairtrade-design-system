import { useEffect, useMemo, useRef, useState } from 'react'

/* read a themed token color at draw time (canvas can't use css vars directly) */
function readVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/* canvas glyphs/dots BAKE the themed ink colour in at draw time (a canvas can't reference a css var), so
   they must redraw when the theme flips. threading a `theme` prop forced a React re-render of the WHOLE page
   on every toggle (a long freeze); instead every canvas subscribes to ONE shared MutationObserver on
   <html data-theme> and redraws itself imperatively - no React render, no prop, so the page can stay static. */
const themeSubs = new Set()
let themeMO = null
function onThemeChange(fn) {
  themeSubs.add(fn)
  if (!themeMO && typeof MutationObserver === 'function' && typeof document !== 'undefined') {
    themeMO = new MutationObserver(() => { for (const f of themeSubs) f() })
    themeMO.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }
  return () => themeSubs.delete(fn)
}

/* ----------------------------------------------------------------------
   imagery source = a real public-domain peasant / crop painting, rendered
   through the terminal filters (image -> ascii / halftone). all sources
   live in src/img and are passed in as a bundled url via the `src` prop;
   the filters sample luminance per cell and map it to a glyph or a dot.
   (the old procedural moon/waves were retired - the only imagery in the
   system is now crops and peasants.)
---------------------------------------------------------------------- */

/* load an image url into an <img>; re-render the filter once it is ready */
function useImage(src) {
  const [img, setImg] = useState(null)
  useEffect(() => {
    if (!src) { setImg(null); return }
    const im = new Image()
    im.decoding = 'async'
    im.onload = () => setImg(im)
    im.src = src
    return () => { im.onload = null }
  }, [src])
  return img
}

/* measured advance/height ratio of the mono cell (a glyph is ~0.6x as wide
   as it is tall at line-height 1). without this the image is squished. */
function monoCellAR() {
  try {
    const cx = document.createElement('canvas').getContext('2d')
    cx.font = '200px "Atkinson Hyperlegible Mono", ui-monospace, monospace'
    const r = cx.measureText('M').width / 200
    if (r > 0.4 && r < 0.85) return r
  } catch {}
  return 0.6
}

/* draw an image into a cols x rows sampling grid WITHOUT distortion. the grid
   pixels are square but each is later displayed as a cell of aspect `cellAR`
   (width/height), so we fit against the DISPLAYED box, not the raw grid.
   cover = center-crop to fill; contain = fit whole image inside, centered. */
function drawFit(img, ctx, w, h, contain, cellAR = 1) {
  const iw = img.naturalWidth, ih = img.naturalHeight, ir = iw / ih
  const dr = (w * cellAR) / h            // aspect of the grid as it will display
  ctx.clearRect(0, 0, w, h)
  if (contain) {
    let dw, dh
    if (ir > dr) { dw = w; dh = (w * cellAR) / ir }   // fit width
    else { dh = h; dw = (h * ir) / cellAR }           // fit height
    ctx.drawImage(img, 0, 0, iw, ih, (w - dw) / 2, (h - dh) / 2, dw, dh)
  } else {
    let sw, sh, sx, sy
    if (ir > dr) { sh = ih; sw = sh * dr; sx = (iw - sw) / 2; sy = 0 }
    else { sw = iw; sh = sw / dr; sx = 0; sy = (ih - sh) / 2 }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
  }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }

/* sample a loaded image into a cols x rows DENSITY grid (0 = empty cell ->
   canvas shows through, 1 = full ink/dot). auto-levels (stretch min..max) +
   contrast + gamma so a dim old painting uses the full range.
   - `light` flips tone so dark theme (bright glyph on near-black) and light
     theme (dark glyph on paper) both read positive.
   - `invert` is an artistic negative: ink lands on the DARK subject instead
     of the bright ground, so a dark figure (the sower, the gleaners) becomes
     the solid focal mass instead of vanishing into the canvas.
   - `vignette` fades density toward the edges so the busy background recedes
     and the main element is framed, never bleeding edge-to-edge. */
function sampleImage(img, cols, rows, { gamma = 1, contrast = 1, light = false, invert = false, vignette = 0, isolated = false, contain = false, cellAR = 1, black = 0, white = 1 } = {}) {
  const c = document.createElement('canvas'); c.width = cols; c.height = rows
  const ctx = c.getContext('2d', { willReadFrequently: true })
  drawFit(img, ctx, cols, rows, contain, cellAR)
  const d = ctx.getImageData(0, 0, cols, rows).data
  const n = cols * rows
  const lum = new Float32Array(n), alpha = new Float32Array(n)
  let mn = 1, mx = 0
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255
    const l = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255
    lum[i] = l; alpha[i] = a
    if (!isolated || a > 0.45) { if (l < mn) mn = l; if (l > mx) mx = l }  // levels over the subject
  }
  const span = Math.max(1e-3, mx - mn)
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2, maxd = Math.hypot(cx, cy) || 1
  for (let i = 0; i < n; i++) {
    let v = (lum[i] - mn) / span            // auto-levels
    if (black > 0 || white < 1) v = (v - black) / Math.max(1e-3, white - black)  // levels: crush dim ground (black), gain up the lit subject (white)
    v = (v - 0.5) * contrast + 0.5          // contrast around mid grey
    v = Math.pow(clamp01(v), gamma)         // gamma  (v: 1 = bright source)
    // density of ink/dots in this cell.
    //  isolated = ink the bright SUBJECT in both themes (bg already removed);
    //  invert   = ink the dark subject in both themes (line art / dark figures);
    //  else       positive, theme-flipped.
    let D = isolated ? v : invert ? 1 - v : (light ? 1 - v : v)
    if (isolated) D *= alpha[i] < 0.4 ? 0 : alpha[i]   // drop the transparent background
    if (vignette > 0) {                     // fade the periphery to empty
      const x = i % cols, y = (i / cols) | 0
      const dist = Math.hypot(x - cx, y - cy) / maxd
      D *= 1 - vignette * smoothstep(0.5, 1.02, dist)
    }
    lum[i] = clamp01(D)
  }
  return lum
}

/* ---- filter: image -> ascii art (mono <pre>, theme-colored via css) ---- */
const RAMP = " .'^\",:;Il!i~+_-?]}1)|/tfjrnuvcXYUJCLQ0OZmwqpdbkhao*#MW&8%B@"
export function AsciiArt({ src, cols = 84, aspect = 0.5, gamma = 0.9, contrast = 1.18, invert = false, vignette = 0, isolated = false, contain = false, black = 0, white = 1, wave = false, waveAmp = 4, waveLen = 1.7, waveSpeed = 0.5, theme, className = '', style }) {
  const ref = useRef(null)
  const img = useImage(src)
  useEffect(() => {
    const pre = ref.current; if (!pre || !img) return
    const rows = Math.max(1, Math.round(cols * aspect))
    const light = theme === 'light' || document.documentElement.getAttribute('data-theme') === 'light'
    const lum = sampleImage(img, cols, rows, { gamma, contrast, light, invert, vignette, isolated, contain, black, white, cellAR: monoCellAR() })
    const lastr = RAMP.length - 1
    const lines = []
    for (let y = 0; y < rows; y++) {
      let row = ''
      for (let x = 0; x < cols; x++) row += RAMP[Math.min(lastr, Math.floor(lum[y * cols + x] * lastr))]
      lines.push(row)
    }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!wave || reduce) { pre.textContent = lines.join('\n'); return }
    // continuous wind: each row slides sideways by two layered traveling sines so the
    // whole background field drifts and ripples like wind through it (the crop video
    // itself stays still). runs at a calm ~18fps.
    const TAU = Math.PI * 2
    let raf = 0, last = 0
    const tick = (now) => {
      if (now - last >= 1000 / 18) {
        last = now
        const t = now / 1000
        let out = ''
        for (let y = 0; y < lines.length; y++) {
          const u = y / lines.length
          const off = Math.round(
            waveAmp * Math.sin(u * waveLen * TAU - t * waveSpeed * TAU) +
            waveAmp * 0.5 * Math.sin(u * waveLen * 2.3 * TAU - t * waveSpeed * 1.7 * TAU + 1.3)
          )
          const ln = lines[y]
          if (off > 0) out += ' '.repeat(off) + ln.slice(0, Math.max(0, ln.length - off))
          else if (off < 0) out += ln.slice(-off) + ' '.repeat(-off)
          else out += ln
          out += '\n'
        }
        pre.textContent = out
      }
      raf = requestAnimationFrame(tick)
    }
    pre.textContent = lines.join('\n')
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [img, cols, aspect, gamma, contrast, invert, vignette, isolated, contain, black, white, wave, waveAmp, waveLen, waveSpeed, theme])
  return <pre ref={ref} className={'ascii ' + className} style={style} aria-hidden="true" />
}

/* ---- filter: image -> ascii art rendered to a CANVAS (not a <pre>). text lines of
   tiny glyphs get snapped to device pixels by the browser, which shows up as periodic
   horizontal banding; drawing the same glyph grid onto a canvas removes that entirely
   and stays crisp at any DPR. one fillText per row (mono advance == cell width). ---- */
export function AsciiImage({ src, cols = 120, aspect = 0.6, fit = false, gamma = 0.9, contrast = 1.18, invert = false, vignette = 0, isolated = false, contain = false, black = 0, white = 1, ink, theme, className = '', style }) {
  const ref = useRef(null)
  const img = useImage(src)
  useEffect(() => {
    const cv = ref.current; if (!cv || !img) return
    const draw = () => {
      const light = theme === 'light' || document.documentElement.getAttribute('data-theme') === 'light'
      const cellAR = monoCellAR()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const rect = cv.getBoundingClientRect()
      const W = Math.max(1, Math.round(rect.width)), H = Math.max(1, Math.round(rect.height))
      // `fit`: derive rows from the MEASURED box so the displayed grid aspect == the box aspect
      // (no horizontal stretch). otherwise rows come from the `aspect` prop, as before.
      const rows = fit ? Math.max(1, Math.round((cols * cellAR * H) / W)) : Math.max(1, Math.round(cols * aspect))
      const lum = sampleImage(img, cols, rows, { gamma, contrast, light, invert, vignette, isolated, contain, black, white, cellAR })
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const cw = W / cols, ch = H / rows
      ctx.fillStyle = ink || (light ? '#0d0c09' : '#f8f5ed')
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
      // size the font OFF THE ROW HEIGHT (not the column width). a glyph's ink only fills ~0.7 of its em, so
      // an em == cell-height left a ~0.3-cell blank strip between every row of ink; at this tiny font size
      // that strip beats against the device-pixel grid and shows up as periodic horizontal lines. drawing the
      // em slightly TALLER than the cell (FILL) overlaps the ink row-to-row and closes those seams, then a
      // per-row horizontal squeeze (sx) keeps each glyph's advance == cw so the row still spans exactly W
      // (no horizontal stretch). FILL must be >=~1.5: a glyph's ink is only ~0.66 of its em, so a smaller
      // overlap leaves a ~0.2*ch empty strip per row that scales with backing size and re-bands at high DPR.
      const FILL = 1.6
      const fs = ch * FILL
      const sx = cw / (fs * cellAR) // squeeze so the taller glyph's advance still equals the column width
      ctx.font = `${fs.toFixed(2)}px "Atkinson Hyperlegible Mono", ui-monospace, monospace`
      const lastr = RAMP.length - 1
      for (let y = 0; y < rows; y++) {
        let row = ''
        for (let x = 0; x < cols; x++) row += RAMP[Math.min(lastr, Math.floor(lum[y * cols + x] * lastr))]
        ctx.save()
        ctx.translate(0, (y + 0.5) * ch)
        ctx.scale(sx, 1)
        ctx.fillText(row, 0, 0)
        ctx.restore()
      }
    }
    // draw LAZILY (only when the canvas is on/near screen) so a long page or a freshly-mounted in-use app
    // doesn't sample dozens of off-screen canvases up front; redraw on a theme flip, deferred to next-visible
    // when off-screen. this is also why the draw reads `light` itself rather than a prop - by the time it runs
    // (on visibility) the parent has already applied data-theme.
    let onScreen = false, dirty = true
    const flush = () => { if (onScreen && dirty) { draw(); dirty = false } }
    const io = new IntersectionObserver((es) => { onScreen = !!es[0]?.isIntersecting; flush() }, { rootMargin: '300px' })
    io.observe(cv)
    const unsub = onThemeChange(() => { dirty = true; flush() })
    return () => { io.disconnect(); unsub() }
  }, [img, cols, aspect, fit, gamma, contrast, invert, vignette, isolated, contain, black, white, ink, theme])
  return <canvas ref={ref} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }} aria-hidden="true" />
}

/* ---- filter: image -> halftone dot-matrix (cell luminance -> dot radius) ---- */
export function Halftone({ src, cols = 42, accent = true, gamma = 0.9, contrast = 1.18, invert = false, vignette = 0, isolated = false, contain = false, theme, className = '', style }) {
  const ref = useRef(null)
  const img = useImage(src)
  useEffect(() => {
    const cv = ref.current; if (!cv || !img) return
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const rect = cv.getBoundingClientRect()
      const W = Math.max(1, Math.round(rect.width)), H = Math.max(1, Math.round(rect.height))
      cv.width = W * dpr; cv.height = H * dpr
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const cell = W / cols, rows = Math.max(1, Math.round(H / cell))
      const light = theme === 'light' || document.documentElement.getAttribute('data-theme') === 'light'
      const lum = sampleImage(img, cols, rows, { gamma, contrast, light, invert, vignette, isolated, contain })
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = readVar(accent ? '--amber' : '--ink-strong', '#cba35c')
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const r = lum[y * cols + x] * cell * 0.62
        if (r > 0.35) { ctx.beginPath(); ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, r, 0, 7); ctx.fill() }
      }
    }
    // lazy draw + theme-flip redraw (see AsciiImage for the rationale)
    let onScreen = false, dirty = true
    const flush = () => { if (onScreen && dirty) { draw(); dirty = false } }
    const io = new IntersectionObserver((es) => { onScreen = !!es[0]?.isIntersecting; flush() }, { rootMargin: '300px' })
    io.observe(cv)
    const unsub = onThemeChange(() => { dirty = true; flush() })
    return () => { io.disconnect(); unsub() }
  }, [img, cols, accent, gamma, contrast, invert, vignette, isolated, contain, theme])
  return <canvas ref={ref} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }} />
}

/* ---- the wordmark, drawn from scratch as a hand-authored block bitmap font (NOT
   sampled from an OS font, which is what made the letters wobble). glyphs are
   PROPORTIONAL (each its own width), 9 rows tall, upright 1px stems; every set pixel
   is emitted as TWO full blocks "██" so cells read near-square at line-height 1.
   tight, even spacing via a single-column gap. only "fairtrade"'s letters exist. ---- */
const GLYPH_H = 9
const GLYPHS = {
  f: ['.██', '.█.', '.█.', '███', '.█.', '.█.', '.█.', '.█.', '.█.'],
  a: ['....', '....', '....', '.███', '...█', '████', '█..█', '█..█', '████'],
  i: ['.', '█', '.', '█', '█', '█', '█', '█', '█'],
  r: ['..', '..', '..', '██', '██', '█.', '█.', '█.', '█.'],
  t: ['...', '.█.', '.█.', '███', '.█.', '.█.', '.█.', '.█.', '.██'],
  d: ['...█', '...█', '...█', '████', '█..█', '█..█', '█..█', '█..█', '████'],
  e: ['....', '....', '....', '.███', '█..█', '████', '█...', '█...', '████'],
  ' ': ['..', '..', '..', '..', '..', '..', '..', '..', '..'],
}
export function AsciiText({ text, gap = 1, className = '', style }) {
  const blank = GLYPHS[' ']
  const chars = text.toLowerCase().split('').map((c) => GLYPHS[c] || blank)
  const lines = []
  for (let r = 0; r < GLYPH_H; r++) {
    let line = ''
    for (let g = 0; g < chars.length; g++) {
      const row = chars[g][r]
      for (let x = 0; x < row.length; x++) line += row[x] === '█' ? '██' : '  '
      if (g < chars.length - 1) line += '  '.repeat(gap)
    }
    lines.push(line)
  }
  return <pre className={'ascii ' + className} style={style} role="img" aria-label={text}>{lines.join('\n')}</pre>
}

/* ---- the wordmark drawn in WHEAT-RAMP glyphs (not solid blocks). reuses the hand-authored
   block bitmap font above, but every "on" pixel is rendered as a pair of dense grain glyphs
   pulled from the wheat-video ramp (so the name reads as if drawn in the wheat field behind it),
   and "off" pixels stay blank. the per-cell glyph is chosen by a stable hash of (glyph,x,row) so
   it never reshuffles between renders. no container, no alpha - colour + glow carry it. ---- */
const WHEAT = '@#%&8B0OQ#@%8&#@' // dense end of VID_RAMP, weighted to the solid grains for legibility
export function AsciiWordmark({ text, gap = 1, className = '', style }) {
  const blank = GLYPHS[' ']
  const chars = text.toLowerCase().split('').map((c) => GLYPHS[c] || blank)
  const lines = []
  for (let r = 0; r < GLYPH_H; r++) {
    let line = ''
    for (let g = 0; g < chars.length; g++) {
      const row = chars[g][r]
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '█') {
          const h = (g * 131 + x * 17 + r * 7) >>> 0
          line += WHEAT[h % WHEAT.length] + WHEAT[(h * 3 + 1) % WHEAT.length]
        } else line += '  '
      }
      if (g < chars.length - 1) line += '  '.repeat(gap)
    }
    lines.push(line)
  }
  return <pre className={'ascii ' + className} style={style} role="img" aria-label={text}>{lines.join('\n')}</pre>
}

/* ---- procedural ascii ROOT SYSTEM read as a NODE GRAPH (analogy to the peasant code-map). a few
   crop bases at the very top edge (so the roots connect straight to the plant above) send strands
   straight down, drifting + branching as they go; every junction + base is a NODE glyph (O), wired by
   edge glyphs (| / \). deterministic (seeded) so it never reshuffles; theme-colored via .ascii. ---- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* a one-shot GROWTH-MORPH reveal for a procedural <pre> (the roots, the soil band): the grid fills from the
   top down over `growMs`, and the rows behind the growing front shimmer through ramp glyphs before settling
   to their final form - so the ascii reads as it FORMS, descending like the plant, instead of a flat clip
   wipe. it is NOT a straight horizontal front: columns are grouped into BRANCHES (spatially-smoothed bands)
   that each get their own START position (`off`, so some branches sprout higher/lower) AND their own DESCENT
   RATE (`rate`, so some branches visibly trail behind / grow slower), the way real roots push down unevenly.
   the shimmer band (`feather`) trails well behind the front - the longer it is, the more each cell LAGS the
   descent and the more glyph morphs it churns through before resolving. paints `lines` imperatively
   (textContent) so it never reflows. honours reduced-motion and only animates when `grow` flips true;
   otherwise paints the final grid at once. `lines` MUST be a stable reference (memoise it). */
function useGrowMorph(ref, lines, { grow = false, growMs = 1600, ramp = ROOT_RAMP, fps = 30, jitter = 6, feather = 8, minRate = 0.72 } = {}) {
  useEffect(() => {
    const pre = ref.current; if (!pre) return
    const final = lines.join('\n')
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!grow || reduce) { pre.textContent = final; return }
    const R = lines.length, lastr = ramp.length - 1
    let W = 0; for (const l of lines) if (l.length > W) W = l.length
    // STABLE per-column noise, smoothed over a wide kernel so neighbouring columns share a value - they read
    // as BRANCHES (bands), not per-pixel fuzz. normalised to [0,1] so every band set spans its full range.
    const bands = (passes, kernel) => {
      let a = new Array(W); for (let x = 0; x < W; x++) a[x] = Math.random() * 2 - 1
      for (let p = 0; p < passes; p++) {
        const b = new Array(W)
        for (let x = 0; x < W; x++) { let s = 0, n = 0
          for (let d = -kernel; d <= kernel; d++) { const i = x + d; if (i >= 0 && i < W) { s += a[i]; n++ } }
          b[x] = s / n }
        a = b
      }
      let mn = Infinity, mx = -Infinity
      for (const v of a) { if (v < mn) mn = v; if (v > mx) mx = v }
      const span = (mx - mn) || 1
      return a.map((v) => (v - mn) / span)
    }
    const off = bands(3, 2).map((v) => (v * 2 - 1) * jitter)                  // start stagger: +- jitter rows
    const rate = bands(4, 3).map((v) => 1 - Math.pow(v, 1.5) * (1 - minRate)) // 1.0 (lead) .. minRate (slow branches)
    const FEATHER = Math.max(3, Math.round(feather)) // rows of shimmer trailing the front (the descent "lag")
    // the slowest branch still has to fill to the bottom by p=1, so size the travel by minRate (no end-pop).
    const SPAN = (R + jitter + FEATHER + 2) / minRate
    let raf = 0, startT = 0, lastFrame = 0
    const tick = (now) => {
      if (!startT) startT = now
      if (now - lastFrame >= 1000 / fps) {
        lastFrame = now
        const p = Math.min(1, (now - startT) / growMs)
        // LINEAR descent. an ease-out front front-loaded the motion so hard that the fill finished at ~45% of
        // growMs and then sat idle (the roots looked done at 2.5s of a 4.8s grow); linear spreads the growth
        // evenly across the whole growMs, so a slower growMs actually reads as a slower descent.
        const front = p * SPAN
        const rows = new Array(R)
        for (let y = 0; y < R; y++) {
          const ln = lines[y]
          let row = ''
          for (let x = 0; x < ln.length; x++) {
            const ef = front * rate[x] + off[x] // this branch's front: slower branches trail, staggered start
            if (y > ef) { row += ' '; continue } // not yet grown to this depth in this branch
            const c = ln[x]
            const settle = (ef - y) / FEATHER // 0 right at the front -> >=1 once settled past the feather band
            // shimmer high across the whole (long) feather band so a cell morphs through several ramp glyphs,
            // easing out only near the tail (1 - settle^2) instead of resolving the instant the front passes.
            row += c !== ' ' && settle < 1 && Math.random() < (1 - settle * settle) * 0.92 ? ramp[(Math.random() * (lastr + 1)) | 0] : c
          }
          rows[y] = row
        }
        pre.textContent = rows.join('\n')
        if (p >= 1) { pre.textContent = final; return } // settle to the final grid, stop
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ref, lines, grow, growMs, ramp, fps, jitter, feather, minRate])
}
/* `ramp`: draw the strands in the WHEAT-RAMP glyphs (same chars as AsciiVideo) so the roots blend
   seamlessly with the plant above; nodes get a dense grain glyph. otherwise use line glyphs.
   `seeds`: a per-column density profile sampled from the wheat video's bottom edge (passed down by the
   hero). when present, the root bases are placed at the DENSEST wheat columns (so every strand descends
   from real wheat, not a generic evenly-spaced point), and the top `overlap` band is drawn dense in
   wheat-ramp glyphs so the seam reads as one continuous plant -> roots before thinning to tendrils. */
const ROOT_RAMP = 'cvoxoO0Qcvx*+'
export function AsciiRoots({ cols = 220, rows = 64, seed = 7, density = 1, spread = 0.5, bases = 4, nodes = false, ramp = false, seeds = null, overlap = 0.16, fill = false, fan = false, trunk = 0.34, grow = false, growMs = 1700, className = '', style }) {
  // `fill`: derive the row count from the live container height so the roots fill it top-to-bottom (the
  // wordmark sits below in its own row; the roots own all the space above it). otherwise use the `rows` prop.
  const ref = useRef(null)
  const [autoRows, setAutoRows] = useState(rows)
  useEffect(() => {
    if (!fill) return
    const pre = ref.current, box = pre && pre.parentElement
    if (!box) return
    const measure = () => {
      const fs = parseFloat(getComputedStyle(pre).fontSize) || 9
      setAutoRows(Math.max(12, Math.round(box.clientHeight / fs)))
    }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(box)
    return () => ro.disconnect()
  }, [fill])
  const R = fill ? autoRows : rows
  // build the (deterministic) root grid into a STABLE array of strings, so the growth-morph below only
  // re-runs when the grid actually changes (props / measured rows / wheat seam profile), not every render.
  const lines = useMemo(() => {
    const grid = Array.from({ length: R }, () => new Array(cols).fill(' '))
    const rnd = mulberry32(seed)
    const mid = cols / 2
    const nodeGlyph = ramp ? '#' : 'O'
    const cell = (xi, y, drift) => {
      if (ramp) return ROOT_RAMP[((xi * 131 + y * 17) >>> 0) % ROOT_RAMP.length]
      return drift < 0.34 ? '\\' : drift > 0.74 ? '/' : '|'
    }
    // base positions: seed from the wheat's densest bottom columns when a profile is supplied (the seam),
    // else fall back to an even spread under the crop. each base carries a `strength` (its wheat density).
    let baseList = []
    if (seeds && seeds.length > 1) {
      let mxs = 0; for (const v of seeds) if (v > mxs) mxs = v
      const thresh = mxs * 0.06
      // active wheat span (trim the empty sky columns at each edge)
      let lo = 0, hi = seeds.length - 1
      while (lo < seeds.length && seeds[lo] < thresh) lo++
      while (hi > lo && seeds[hi] < thresh) hi--
      const span = Math.max(1, hi - lo)
      // bin the active span into `bases` equal slots and take the densest column in EACH slot, so the bases
      // span the full wheat width instead of clustering on the center-densest columns (which read as a cone)
      for (let b = 0; b < bases; b++) {
        const a0 = lo + Math.floor((b / bases) * span)
        const a1 = lo + Math.floor(((b + 1) / bases) * span)
        let best = -1, bestv = thresh
        for (let i = a0; i <= a1 && i < seeds.length; i++) if (seeds[i] >= bestv) { bestv = seeds[i]; best = i }
        if (best >= 0) baseList.push({ x: Math.round((best / (seeds.length - 1)) * (cols - 1)), strength: mxs > 0 ? bestv / mxs : 1 })
      }
    }
    for (let i = baseList.length; i < bases; i++) { // fill out (or fully build) an even spread
      const x = Math.round(mid + ((i + 0.5) / bases - 0.5) * cols * 0.6 + (rnd() - 0.5) * cols * 0.05)
      baseList.push({ x, strength: 0.7 })
    }
    // walkers: when `fan`, they START narrow near the centre and OPEN OUT toward their target column (spread
    // across the width) as they descend, so the root system is narrow at the top and fills the full width at
    // the bottom. otherwise they walk straight down with random drift.
    // `trunk` (fan only): the roots EMERGE already spread to this fraction of their full width, so the top
    // matches the plant's trunk instead of pinching to a point, then open out to the full span as they
    // descend. 0 = a single point (the old pinch), 1 = full width from the very top.
    const TRUNK = fan ? Math.max(0, Math.min(1, trunk)) : 0
    let walkers = []
    for (const b of baseList) {
      const tx = Math.max(0, Math.min(cols - 1, Math.round(b.x)))
      const x0 = fan ? mid + (tx - mid) * TRUNK + (rnd() - 0.5) * cols * 0.03 : tx
      walkers.push({ tx, x0, x: x0, jit: 0, bias: (rnd() - 0.5) * spread, strength: b.strength })
    }
    // draw the emergence row (y = 0) so the roots begin right at the soil line - one row higher than before,
    // when drawing started at y = 1 and left the very top line blank (the "begins one notch too low" gap).
    for (const w of walkers) {
      const xi = Math.round(w.x)
      if (xi >= 0 && xi < cols && grid[0][xi] === ' ') grid[0][xi] = nodes ? nodeGlyph : cell(xi, 0, rnd())
    }
    for (let y = 1; y < R; y++) {
      const next = []
      const depth = y / R
      for (const w of walkers) {
        if (fan) {
          const open = TRUNK + (1 - TRUNK) * Math.pow(depth, 1.35) // trunk width at the top -> full width lower down
          w.jit = (w.jit + (rnd() - 0.5) * 1.2) * 0.9
          w.x = mid + (w.tx - mid) * open + w.jit
        } else {
          const r = rnd() + w.bias * 0.4
          w.x += (r < 0.34 ? -1 : r > 0.74 ? 1 : 0) + w.bias * 0.5
        }
        const xi = Math.round(w.x)
        if (xi >= 0 && xi < cols && grid[y][xi] === ' ') grid[y][xi] = cell(xi, y, rnd())
        // branch most near the TOP, decaying with depth; each branch point is a node
        if (rnd() < density * 0.2 * (1 - depth) * (1 - depth) && walkers.length + next.length < cols * 0.5) {
          if (nodes && xi >= 0 && xi < cols) grid[y][xi] = nodeGlyph
          next.push({ tx: Math.max(0, Math.min(cols - 1, w.tx + (rnd() < 0.5 ? -1 : 1) * cols * 0.04)), x0: w.x0, x: w.x, jit: w.jit, bias: w.bias + (rnd() - 0.5) * spread, strength: w.strength })
        }
        // gentle taper so the field fills top-to-bottom (down to the wordmark) instead of dwindling to tendrils
        if (rnd() < 0.003 + 0.01 * depth && walkers.length + next.length > Math.max(2, bases - 1)) continue
        next.push(w)
      }
      walkers = next
    }
    return grid.map((r) => r.join(''))
  }, [cols, R, seed, density, spread, bases, nodes, ramp, seeds, overlap, fan, trunk])
  // the roots GROW down with a morphing front when the brand section scrolls in (reduced-motion: static).
  // the hero visual: WIDE branch variation (some strands trail far behind, very staggered sprout heights)
  // and a long shimmer lag so the tendrils churn through many glyphs over a long descent before settling.
  useGrowMorph(ref, lines, { grow, growMs, ramp: ROOT_RAMP, fps: 30, jitter: 14, feather: 24, minRate: 0.46 })
  return <pre ref={ref} className={'ascii ' + className} style={style} aria-hidden="true" />
}

/* a full-width band of soil/earth ascii that sits between the wheat (above) and the roots (below) so the
   plant -> ground -> roots transition reads as one continuous thing. densest through the middle, fading at
   the top edge (up into the plant) and the bottom edge (down into the descending roots). same glyph family
   as the wheat + roots so it is the same material. deterministic (seeded). theme-colored via .ascii. */
const SOIL_DENSE = '@#%&8B0OQ', SOIL_MID = 'oxcv*+=zn', SOIL_RAMP = SOIL_DENSE + SOIL_MID
export function AsciiSoil({ cols = 300, rows = 9, seed = 5, grow = false, growMs = 900, className = '', style }) {
  const ref = useRef(null)
  const lines = useMemo(() => {
    const rnd = mulberry32(seed)
    const out = []
    for (let y = 0; y < rows; y++) {
      const f = 1 - y / (rows - 1) // 1 at the top (packed, meeting the plant) -> 0 at the bottom (crumbling into the roots)
      let line = ''
      for (let x = 0; x < cols; x++) {
        if (rnd() > 0.1 + f * 0.82) { line += ' '; continue } // dense up top, progressively fewer grains toward the bottom
        line += rnd() < 0.4 + f * 0.35 ? SOIL_DENSE[(rnd() * SOIL_DENSE.length) | 0] : SOIL_MID[(rnd() * SOIL_MID.length) | 0]
      }
      out.push(line)
    }
    return out
  }, [cols, rows, seed])
  // the surface band forms as the section scrolls in (reduced-motion: static). it is a thin band, so the
  // stagger + lag stay moderate (a few clumps crumble ahead of the rest) but it still morphs for a while.
  useGrowMorph(ref, lines, { grow, growMs, ramp: SOIL_RAMP, fps: 30, jitter: 7, feather: 10, minRate: 0.56 })
  return <pre ref={ref} className={'ascii ' + className} style={style} aria-hidden="true" />
}

/* a DIM full-section ascii texture (same earthy glyph family as the soil/roots) that paints the whole roots
   section as a soil backdrop behind the roots and the wordmark. denser up near the top (the packed surface
   under the plant), crumbling sparser toward the bottom. kept very dim via CSS so the roots read on top of
   it. deterministic. `rows` is generous so the grid overflows and fills any section height (clipped). */
export function AsciiSoilField({ cols = 300, rows = 170, seed = 9, className = '', style }) {
  const rnd = mulberry32(seed)
  const lines = []
  for (let y = 0; y < rows; y++) {
    const f = Math.max(0, 1 - y / (rows * 0.55)) // packed near the top surface, thinning lower down
    const dens = 0.14 + f * 0.42
    let line = ''
    for (let x = 0; x < cols; x++) {
      if (rnd() > dens) { line += ' '; continue }
      line += rnd() < 0.4 ? SOIL_DENSE[(rnd() * SOIL_DENSE.length) | 0] : SOIL_MID[(rnd() * SOIL_MID.length) | 0]
    }
    lines.push(line)
  }
  return <pre className={'ascii ' + className} style={style} aria-hidden="true">{lines.join('\n')}</pre>
}

/* ---- ascii video, sampled from a (seamless, watermark-free) source video at
   RUNTIME. detail is just `cols` (decoupled from any baked file size); a rolling
   temporal average over the last `smooth` frames kills glyph boiling so it stays
   fluid. coloured via css. honours prefers-reduced-motion (samples one frame). ---- */
const VID_RAMP = " .,-:;=+*vcoxO0Q#%@"
export function AsciiVideo({ src, cols = 240, aspect = 0.4, fps = 12, smooth = 5, boost = 1.5, contrast = 1.22, gamma = 0.9, rate = 0.7, waveEvery = 8, waveDur = 3.4, waveAmp = 3.6, waveLen = 2, waveSpeed = 0.75, onColumns, className = '', style }) {
  const ref = useRef(null)
  const emitted = useRef(false)
  useEffect(() => {
    emitted.current = false
    const pre = ref.current; if (!pre || !src) return
    const rows = Math.max(1, Math.round(cols * aspect))
    const cv = document.createElement('canvas'); cv.width = cols; cv.height = rows
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    const video = document.createElement('video')
    video.src = src; video.muted = true; video.loop = true; video.playsInline = true
    video.setAttribute('muted', ''); video.setAttribute('playsinline', '')
    video.playbackRate = rate
    const hist = []
    const TAU = Math.PI * 2
    let raf = 0, last = 0
    const sample = (tMs = 0) => {
      try { ctx.drawImage(video, 0, 0, cols, rows) } catch { return }
      const d = ctx.getImageData(0, 0, cols, rows).data, n = cols * rows
      const lum = new Float32Array(n)
      for (let i = 0; i < n; i++) lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255
      hist.push(lum); if (hist.length > smooth) hist.shift()
      const lastc = VID_RAMP.length - 1
      // occasional sleek wave: a smooth in/out bump every `waveEvery`s drives a
      // sine that travels down the rows, nudging each row's sample column sideways.
      const t = tMs / 1000
      const ph = ((t % waveEvery) + waveEvery) % waveEvery
      const env = ph < waveDur ? Math.sin(Math.PI * ph / waveDur) : 0
      const k = waveAmp * env
      let out = ''
      for (let y = 0; y < rows; y++) {
        const off = k > 0.01 ? Math.round(k * Math.sin((y / rows) * waveLen * TAU - t * waveSpeed * TAU)) : 0
        for (let x = 0; x < cols; x++) {
          let sx = x + off; if (sx < 0) sx = 0; else if (sx >= cols) sx = cols - 1
          let s = 0; for (let h = 0; h < hist.length; h++) s += hist[h][y * cols + sx]
          let v = Math.pow(clamp01(((s / hist.length) * boost - 0.5) * contrast + 0.5), gamma)
          out += VID_RAMP[Math.min(lastc, Math.floor(v * lastc))]
        }
        out += '\n'
      }
      pre.textContent = out
      // one-time seam handoff: once the temporal average is warm, emit a per-column density profile of
      // the wheat's lower body (not just the dark bottom edge, which collapses the roots to center) so
      // the roots below can seed their bases at the densest stalk columns, spread across the real width.
      if (onColumns && !emitted.current && hist.length >= smooth) {
        const band = Math.max(1, Math.round(rows * 0.3))
        const prof = new Array(cols).fill(0)
        for (let x = 0; x < cols; x++) {
          let s = 0
          for (let y = rows - band; y < rows; y++) {
            let a = 0; for (let h = 0; h < hist.length; h++) a += hist[h][y * cols + x]
            s += Math.pow(clamp01(((a / hist.length) * boost - 0.5) * contrast + 0.5), gamma)
          }
          prof[x] = s / band
        }
        emitted.current = true
        onColumns(prof)
      }
    }
    let visible = true
    const loop = (now) => { if (now - last >= 1000 / fps) { if (video.readyState >= 2) sample(now); last = now } raf = requestAnimationFrame(loop) }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // run the sampler ONLY while the hero is on screen. the per-frame getImageData over cols*rows is the
    // page's heaviest steady cost, and it used to keep running at full rate even when the hero was scrolled
    // far off-screen (down in the docs / the in-use stage), starving the main thread so every click stuttered.
    // pause the video + stop sampling when off-screen, resume when it scrolls back into view.
    const play = () => { if (reduce || raf) return; video.play().catch(() => {}); raf = requestAnimationFrame(loop) }
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0 } video.pause() }
    const start = () => {
      if (reduce) {
        // reduced-motion: show a single still wheat frame (don't animate). seek into the
        // clip, then re-sample over a few frames until it's decoded so the hero is never
        // blank, and stop (no ongoing animation).
        try { video.currentTime = 2 } catch {}
        let tries = 0
        const grab = () => { if (video.readyState >= 2) sample(); if (++tries < 18) raf = requestAnimationFrame(grab) }
        raf = requestAnimationFrame(grab)
        return
      }
      sample(); if (visible) play()
    }
    if (video.readyState >= 2) start(); else video.addEventListener('loadeddata', start, { once: true })
    let io = null
    if (!reduce && typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver((ents) => { visible = !!ents[0]?.isIntersecting; if (visible) play(); else stop() }, { threshold: 0 })
      io.observe(pre)
    }
    return () => { io && io.disconnect(); if (raf) cancelAnimationFrame(raf); video.pause(); video.removeAttribute('src') }
  }, [src, cols, aspect, fps, smooth, boost, contrast, gamma, rate, waveEvery, waveDur, waveAmp, waveLen, waveSpeed, onColumns])
  return <pre ref={ref} className={'ascii ' + className} style={style} aria-hidden="true" />
}

/* ---- glyph-grid texture (refs 04/05): repeated mono glyphs as wallpaper ---- */
export function GlyphField({ rows = 7, repeat = 26, className = '' }) {
  const glyphs = '+*&^%$#@!~='.split('')
  const lines = []
  for (let r = 0; r < rows; r++) lines.push((glyphs[r % glyphs.length] + '  ').repeat(repeat))
  return <pre className={'glyph-field ' + className} aria-hidden="true">{lines.join('\n')}</pre>
}

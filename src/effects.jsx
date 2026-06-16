import { useEffect, useRef, useState } from 'react'

/* read a themed token color at draw time (canvas can't use css vars directly) */
function readVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
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
function sampleImage(img, cols, rows, { gamma = 1, contrast = 1, light = false, invert = false, vignette = 0, isolated = false, contain = false, cellAR = 1 } = {}) {
  const c = document.createElement('canvas'); c.width = cols; c.height = rows
  const ctx = c.getContext('2d', { willReadFrequently: true })
  drawFit(img, ctx, cols, rows, contain || isolated, cellAR)
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
export function AsciiArt({ src, cols = 84, aspect = 0.5, gamma = 0.9, contrast = 1.18, invert = false, vignette = 0, isolated = false, contain = false, theme, className = '', style }) {
  const ref = useRef(null)
  const img = useImage(src)
  useEffect(() => {
    const pre = ref.current; if (!pre || !img) return
    const rows = Math.max(1, Math.round(cols * aspect))
    const light = theme === 'light' || document.documentElement.getAttribute('data-theme') === 'light'
    const lum = sampleImage(img, cols, rows, { gamma, contrast, light, invert, vignette, isolated, contain, cellAR: monoCellAR() })
    let out = ''
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) out += RAMP[Math.min(RAMP.length - 1, Math.floor(lum[y * cols + x] * (RAMP.length - 1)))]
      out += '\n'
    }
    pre.textContent = out
  }, [img, cols, aspect, gamma, contrast, invert, vignette, isolated, contain, theme])
  return <pre ref={ref} className={'ascii ' + className} style={style} aria-hidden="true" />
}

/* ---- filter: image -> halftone dot-matrix (cell luminance -> dot radius) ---- */
export function Halftone({ src, cols = 42, accent = true, gamma = 0.9, contrast = 1.18, invert = false, vignette = 0, isolated = false, contain = false, theme, className = '', style }) {
  const ref = useRef(null)
  const img = useImage(src)
  useEffect(() => {
    const cv = ref.current; if (!cv || !img) return
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
  }, [img, cols, accent, gamma, contrast, invert, vignette, isolated, contain, theme])
  return <canvas ref={ref} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }} />
}

/* ---- glyph-grid texture (refs 04/05): repeated mono glyphs as wallpaper ---- */
export function GlyphField({ rows = 7, repeat = 26, className = '' }) {
  const glyphs = '+*&^%$#@!~='.split('')
  const lines = []
  for (let r = 0; r < rows; r++) lines.push((glyphs[r % glyphs.length] + '  ').repeat(repeat))
  return <pre className={'glyph-field ' + className} aria-hidden="true">{lines.join('\n')}</pre>
}

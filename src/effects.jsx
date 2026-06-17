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
export function AsciiImage({ src, cols = 120, aspect = 0.6, gamma = 0.9, contrast = 1.18, invert = false, vignette = 0, isolated = false, contain = false, black = 0, white = 1, ink, theme, className = '', style }) {
  const ref = useRef(null)
  const img = useImage(src)
  useEffect(() => {
    const cv = ref.current; if (!cv || !img) return
    const rows = Math.max(1, Math.round(cols * aspect))
    const light = theme === 'light' || document.documentElement.getAttribute('data-theme') === 'light'
    const cellAR = monoCellAR()
    const lum = sampleImage(img, cols, rows, { gamma, contrast, light, invert, vignette, isolated, contain, black, white, cellAR })
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rect = cv.getBoundingClientRect()
    const W = Math.max(1, Math.round(rect.width)), H = Math.max(1, Math.round(rect.height))
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const cw = W / cols, ch = H / rows
    ctx.fillStyle = ink || readVar('--ink-strong', light ? '#0d0c09' : '#f8f5ed')
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
    ctx.font = `${(cw / cellAR).toFixed(2)}px "Atkinson Hyperlegible Mono", ui-monospace, monospace`
    const lastr = RAMP.length - 1
    for (let y = 0; y < rows; y++) {
      let row = ''
      for (let x = 0; x < cols; x++) row += RAMP[Math.min(lastr, Math.floor(lum[y * cols + x] * lastr))]
      ctx.fillText(row, 0, (y + 0.5) * ch)
    }
  }, [img, cols, aspect, gamma, contrast, invert, vignette, isolated, contain, black, white, ink, theme])
  return <canvas ref={ref} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }} aria-hidden="true" />
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

/* ---- ascii video, sampled from a (seamless, watermark-free) source video at
   RUNTIME. detail is just `cols` (decoupled from any baked file size); a rolling
   temporal average over the last `smooth` frames kills glyph boiling so it stays
   fluid. coloured via css. honours prefers-reduced-motion (samples one frame). ---- */
const VID_RAMP = " .,-:;=+*vcoxO0Q#%@"
export function AsciiVideo({ src, cols = 240, aspect = 0.4, fps = 12, smooth = 5, boost = 1.5, contrast = 1.22, gamma = 0.9, rate = 0.7, waveEvery = 8, waveDur = 3.4, waveAmp = 3.6, waveLen = 2, waveSpeed = 0.75, className = '', style }) {
  const ref = useRef(null)
  useEffect(() => {
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
    }
    const tick = (now) => { if (now - last >= 1000 / fps) { if (video.readyState >= 2) sample(now); last = now } raf = requestAnimationFrame(tick) }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
      sample(); video.play().catch(() => {}); raf = requestAnimationFrame(tick)
    }
    if (video.readyState >= 2) start(); else video.addEventListener('loadeddata', start, { once: true })
    return () => { cancelAnimationFrame(raf); video.pause(); video.removeAttribute('src') }
  }, [src, cols, aspect, fps, smooth, boost, contrast, gamma, rate, waveEvery, waveDur, waveAmp, waveLen, waveSpeed])
  return <pre ref={ref} className={'ascii ' + className} style={style} aria-hidden="true" />
}

/* ---- glyph-grid texture (refs 04/05): repeated mono glyphs as wallpaper ---- */
export function GlyphField({ rows = 7, repeat = 26, className = '' }) {
  const glyphs = '+*&^%$#@!~='.split('')
  const lines = []
  for (let r = 0; r < rows; r++) lines.push((glyphs[r % glyphs.length] + '  ').repeat(repeat))
  return <pre className={'glyph-field ' + className} aria-hidden="true">{lines.join('\n')}</pre>
}

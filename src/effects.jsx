import { useEffect, useRef } from 'react'

/* read a themed token color at draw time (canvas effects can't use css vars directly) */
function readVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
const reduceMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/* ----------------------------------------------------------------------
   procedural source image: a cratered moon, drawn to a square canvas.
   keeps the demos self-contained (no bundled photo); any draw(ctx,w,h)
   or <img> could be swapped in for a real "turn this image into ascii".
---------------------------------------------------------------------- */
export function drawMoon(ctx, w, h) {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.45
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.06, cx, cy, r)
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#9a9a9a'); g.addColorStop(0.84, '#363636'); g.addColorStop(1, '#060606')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill()
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip()
  let s = 987654321
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let i = 0; i < 48; i++) {
    const a = rnd() * 7, d = Math.sqrt(rnd()) * r * 0.95, cr = rnd() * r * 0.11 + r * 0.02
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d
    const cg = ctx.createRadialGradient(x - cr * 0.3, y - cr * 0.3, 0, x, y, cr)
    cg.addColorStop(0, 'rgba(0,0,0,0.5)'); cg.addColorStop(0.65, 'rgba(0,0,0,0.18)'); cg.addColorStop(1, 'rgba(255,255,255,0.10)')
    ctx.fillStyle = cg
    ctx.beginPath(); ctx.arc(x, y, cr, 0, 7); ctx.fill()
  }
  ctx.restore()
}

/* sample a square source into a cols x rows luminance grid */
function sampleGrid(draw, cols, rows) {
  const sq = document.createElement('canvas'); sq.width = sq.height = 300
  draw(sq.getContext('2d'), 300, 300)
  const c = document.createElement('canvas'); c.width = cols; c.height = rows
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(sq, 0, 0, 300, 300, 0, 0, cols, rows)
  const d = ctx.getImageData(0, 0, cols, rows).data
  const lum = new Float32Array(cols * rows)
  for (let i = 0; i < cols * rows; i++) lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255
  return lum
}

/* ---- filter: image -> ascii art (mono <pre>, theme-colored) ---- */
const RAMP = " .'^\",:;Il!i~+_-?]}1)|/tfjrnuvcXYUJCLQ0OZmwqpdbkhao*#MW&8%B@"
export function AsciiArt({ draw = drawMoon, cols = 92, className = '', style }) {
  const ref = useRef(null)
  useEffect(() => {
    const pre = ref.current; if (!pre) return
    const rows = Math.round(cols * 0.5)
    const lum = sampleGrid(draw, cols, rows)
    let out = ''
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) out += RAMP[Math.min(RAMP.length - 1, Math.floor(lum[y * cols + x] * (RAMP.length - 1)))]
      out += '\n'
    }
    pre.textContent = out
  }, [draw, cols])
  return <pre ref={ref} className={'ascii ' + className} style={style} aria-hidden="true" />
}

/* ---- filter: image -> dot-matrix / halftone (cell luminance -> dot radius) ---- */
export function Halftone({ draw = drawMoon, cols = 46, accent = false, theme, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rect = cv.getBoundingClientRect()
    const W = Math.max(1, Math.round(rect.width)), H = Math.max(1, Math.round(rect.height))
    cv.width = W * dpr; cv.height = H * dpr
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cell = W / cols, rows = Math.max(1, Math.round(H / cell))
    const lum = sampleGrid(draw, cols, rows)
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = readVar(accent ? '--amber' : '--ink-strong', '#e9e5db')
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const r = lum[y * cols + x] * cell * 0.55
      if (r > 0.4) { ctx.beginPath(); ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, r, 0, 7); ctx.fill() }
    }
  }, [draw, cols, accent, theme])
  return <canvas ref={ref} className={className} style={{ width: '100%', height: '100%', display: 'block' }} />
}

/* ---- raw procedural source, drawn straight to a canvas ---- */
export function SourceCanvas({ draw = drawMoon, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rect = cv.getBoundingClientRect()
    const W = Math.max(1, Math.round(rect.width)), H = Math.max(1, Math.round(rect.height))
    cv.width = W * dpr; cv.height = H * dpr
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const sq = document.createElement('canvas'); sq.width = sq.height = 300; draw(sq.getContext('2d'), 300, 300)
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    const sz = Math.min(W, H); ctx.drawImage(sq, (W - sz) / 2, (H - sz) / 2, sz, sz)
  }, [draw])
  return <canvas ref={ref} className={className} style={{ width: '100%', height: '100%', display: 'block' }} />
}

/* ---- animated dot-field / digital-rain (the ascii.mp4 effect) ---- */
export function DotField({ theme, height = 200, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const reduce = reduceMotion()
    const ink = readVar('--ink-strong', '#e9e5db'), amber = readVar('--amber', '#cba35c')
    const ctx = cv.getContext('2d')
    let W = 1, H = 1, cols = 1, cell = 8, drops = [], raf = 0
    const reset = () => {
      const rect = cv.getBoundingClientRect()
      W = Math.max(1, Math.round(rect.width)); H = Math.max(1, Math.round(rect.height))
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(W / cell)
      drops = Array.from({ length: cols }, () => ({
        y: Math.random() * H, spd: 0.35 + Math.random() * 1.1, len: 5 + ((Math.random() * 16) | 0),
      }))
    }
    const frame = () => {
      ctx.clearRect(0, 0, W, H)
      const rows = Math.ceil(H / cell)
      for (let x = 0; x < cols; x++) {
        const dp = drops[x], headRow = Math.floor(dp.y / cell)
        for (let k = 0; k < dp.len; k++) {
          const ry = headRow - k; if (ry < 0 || ry > rows) continue
          const b = 1 - k / dp.len
          ctx.globalAlpha = b * b * 0.92
          ctx.fillStyle = k === 0 ? amber : ink
          const sz = Math.max(1, b * cell * 0.6)
          ctx.fillRect(x * cell + (cell - sz) / 2, ry * cell + (cell - sz) / 2, sz, sz)
        }
        if (!reduce) {
          dp.y += dp.spd * cell
          if (dp.y - dp.len * cell > H) { dp.y = -Math.random() * H * 0.5; dp.spd = 0.35 + Math.random() * 1.1; dp.len = 5 + ((Math.random() * 16) | 0) }
        }
      }
      ctx.globalAlpha = 1
      if (!reduce) raf = requestAnimationFrame(frame)
    }
    reset(); frame()
    const ro = new ResizeObserver(reset); ro.observe(cv)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [theme])
  return <canvas ref={ref} className={className} style={{ width: '100%', height, display: 'block' }} />
}

/* ---- glyph-grid texture (refs 04/05): repeated mono glyphs ---- */
export function GlyphField({ rows = 7, repeat = 26 }) {
  const glyphs = '+*&^%$#@!~='.split('')
  const lines = []
  for (let r = 0; r < rows; r++) lines.push((glyphs[r % glyphs.length] + '  ').repeat(repeat))
  return <pre className="glyph-field" aria-hidden="true">{lines.join('\n')}</pre>
}

/* ---- duotone filter defs (shadows -> ink, highlights -> amber/teal) ---- */
export function FxDefs() {
  return (
    <svg className="fx-defs" width="0" height="0" aria-hidden="true">
      <defs>
        <filter id="fx-duotone-amber" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.33 0.34 0.33 0 0 0.33 0.34 0.33 0 0 0.33 0.34 0.33 0 0 0 0 0 1 0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.03 0.80" />
            <feFuncG type="table" tableValues="0.03 0.64" />
            <feFuncB type="table" tableValues="0.02 0.36" />
          </feComponentTransfer>
        </filter>
        <filter id="fx-duotone-teal" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.33 0.34 0.33 0 0 0.33 0.34 0.33 0 0 0.33 0.34 0.33 0 0 0 0 0 1 0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.04 0.49" />
            <feFuncG type="table" tableValues="0.05 0.65" />
            <feFuncB type="table" tableValues="0.05 0.62" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  )
}

/* ---- the showcase section (portaled into the gallery before the footer) ---- */
export function ImageryShowcase({ theme }) {
  return (
    <section className="band">
      <span className="label">imagery &amp; filters</span>
      <div className="sub">turn any image into the system: ascii, dot-matrix, duotone. built-in, token-themed, theme-aware.</div>

      <div className="fx-grid">
        <figure className="fx-tile framed"><SourceCanvas /><figcaption className="fx-cap">source</figcaption></figure>
        <figure className="fx-tile framed fx-asciibox"><AsciiArt cols={92} /><figcaption className="fx-cap">ascii</figcaption></figure>
        <figure className="fx-tile framed"><Halftone cols={46} theme={theme} /><figcaption className="fx-cap">dot-matrix</figcaption></figure>
        <figure className="fx-tile framed"><SourceCanvas className="fx-duotone-amber" /><div className="fx-scan" /><figcaption className="fx-cap">duotone + scanlines</figcaption></figure>
      </div>

      <div className="fx-banner framed">
        <DotField theme={theme} height={220} />
        <div className="fx-banner-cap"><span className="prompt">&gt;</span> animated dot-field</div>
      </div>

      <div className="fx-two">
        <figure className="fx-tile framed"><Halftone cols={40} accent theme={theme} /><figcaption className="fx-cap">halftone, amber</figcaption></figure>
        <figure className="fx-tile framed fx-glyphbox"><GlyphField /><figcaption className="fx-cap">glyph grid</figcaption></figure>
      </div>
    </section>
  )
}

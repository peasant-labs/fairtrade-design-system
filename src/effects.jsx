import { useEffect, useRef } from 'react'

/* read a themed token color at draw time (canvas can't use css vars directly) */
function readVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/* ----------------------------------------------------------------------
   procedural source image: a cratered moon, drawn to a square canvas.
   keeps the demos self-contained; swap in any draw(ctx,w,h) or an <img>.
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

/* alternate source: a wave-interference field (fills the frame; good for wide thumbs) */
export function drawWaves(ctx, w, h) {
  const img = ctx.createImageData(w, h), d = img.data
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 0.5 + 0.5 * Math.sin(x * 0.05 + Math.sin(y * 0.045) * 3) * Math.cos(y * 0.038 - x * 0.012)
    const c = Math.max(0, Math.min(255, v * 255)) | 0
    const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = c; d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
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

/* ---- filter: image -> ascii art (mono <pre>, theme-colored via css) ---- */
const RAMP = " .'^\",:;Il!i~+_-?]}1)|/tfjrnuvcXYUJCLQ0OZmwqpdbkhao*#MW&8%B@"
export function AsciiArt({ draw = drawMoon, cols = 84, aspect = 0.5, className = '', style }) {
  const ref = useRef(null)
  useEffect(() => {
    const pre = ref.current; if (!pre) return
    const rows = Math.max(1, Math.round(cols * aspect))
    const lum = sampleGrid(draw, cols, rows)
    let out = ''
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) out += RAMP[Math.min(RAMP.length - 1, Math.floor(lum[y * cols + x] * (RAMP.length - 1)))]
      out += '\n'
    }
    pre.textContent = out
  }, [draw, cols, aspect])
  return <pre ref={ref} className={'ascii ' + className} style={style} aria-hidden="true" />
}

/* ---- filter: image -> halftone dot-matrix (cell luminance -> dot radius) ---- */
export function Halftone({ draw = drawMoon, cols = 42, accent = true, theme, className = '', style }) {
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
    ctx.fillStyle = readVar(accent ? '--amber' : '--ink-strong', '#cba35c')
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const r = lum[y * cols + x] * cell * 0.55
      if (r > 0.4) { ctx.beginPath(); ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, r, 0, 7); ctx.fill() }
    }
  }, [draw, cols, accent, theme])
  return <canvas ref={ref} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }} />
}

/* ---- glyph-grid texture (refs 04/05): repeated mono glyphs ---- */
export function GlyphField({ rows = 7, repeat = 26, className = '' }) {
  const glyphs = '+*&^%$#@!~='.split('')
  const lines = []
  for (let r = 0; r < rows; r++) lines.push((glyphs[r % glyphs.length] + '  ').repeat(repeat))
  return <pre className={'glyph-field ' + className} aria-hidden="true">{lines.join('\n')}</pre>
}

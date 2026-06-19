/* social-share + icon image generator. renders on-brand HTML templates through headless Chrome and
   screenshots them to public/, so the OG card and apple-touch-icon match the real dark-theme tokens
   (no hand-painted PNGs that drift from the design system).

   outputs:
     public/og-image.png         1200x630  open-graph / twitter summary_large_image card
     public/apple-touch-icon.png  180x180   the wheat-stalk brand mark on the dark canvas

   colors + fonts below are the REAL values read from src/index.css :root (dark, the default theme)
   and the @theme font stack - keep them in sync if the tokens move. usage: node scripts/gen-og.mjs */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(ROOT, 'public')
mkdirSync(PUBLIC, { recursive: true })

/* dark-theme tokens, verbatim from :root in src/index.css */
const T = {
  canvas: '#070706',
  surface: '#0e0e0c',
  inkStrong: '#f8f5ed',
  ink2: '#b8b3a4',
  ink3: '#9a9488',
  ink4: '#8a8478',
  rule: '#3c382f',
  amber: '#cba35c',
  // grid tint = rgba(203,163,92,.12) (the --grid token, amber at 12%)
  grid: 'rgba(203,163,92,0.12)',
  // display + mono face (the @theme --font-display / --font-mono stack)
  display: '"Atkinson Hyperlegible Mono", ui-monospace, Menlo, Consolas, monospace',
}

/* google-fonts link so the wordmark renders in the real display face, not a fallback. */
const FONT_LINK = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@400;500;700&display=swap" rel="stylesheet">`

/* the wheat stalk = the inline #logo brand mark (public/favicon.svg), drawn in amber on the dark canvas. */
function stalk(stroke) {
  return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <g stroke="${stroke}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <line x1="16" y1="28" x2="16" y2="6"/>
      <path d="M16 12 l-4.5 -3.2 M16 12 l4.5 -3.2"/>
      <path d="M16 17 l-4.5 -3.2 M16 17 l4.5 -3.2"/>
      <path d="M16 22 l-4.5 -3.2 M16 22 l4.5 -3.2"/>
    </g>
  </svg>`
}

/* 1200x630 OG card: dark canvas, faint amber grid + a thin top hairline, the wheat stalk mark beside a
   small lowercase kicker, the large "fairtrade" wordmark, one-line tagline, and a footer rule of the
   three sibling apps. ONE amber accent (the stalk + the underscore tick); everything else is earthy ink. */
const ogHtml = `<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1200px; height:630px; }
  body {
    font-family:${T.display};
    background:${T.canvas};
    color:${T.inkStrong};
    position:relative;
    overflow:hidden;
    /* faint amber grid, the --grid token, on the dark canvas */
    background-image:
      linear-gradient(${T.grid} 1px, transparent 1px),
      linear-gradient(90deg, ${T.grid} 1px, transparent 1px);
    background-size:40px 40px;
  }
  /* a thin amber hairline pinned to the very top edge - the single scarce accent rule */
  .topline { position:absolute; top:0; left:0; right:0; height:3px; background:${T.amber}; }
  .frame {
    position:absolute; inset:0;
    padding:80px 88px;
    display:flex; flex-direction:column; justify-content:space-between;
  }
  .kicker { display:flex; align-items:center; gap:16px; }
  .kicker svg { width:34px; height:48px; display:block; }
  .kicker .k { font-size:22px; font-weight:500; letter-spacing:0.18em; text-transform:lowercase; color:${T.ink3}; }
  .mid { display:flex; flex-direction:column; gap:26px; }
  .word { font-size:150px; line-height:0.9; font-weight:700; letter-spacing:-0.01em; color:${T.inkStrong}; }
  .word .tick { color:${T.amber}; }
  .tag { font-size:30px; line-height:1.35; font-weight:400; color:${T.ink2}; max-width:920px; }
  .foot { display:flex; align-items:center; gap:18px; font-size:21px; font-weight:500; color:${T.ink4}; }
  .foot .dot { color:${T.rule}; }
  .foot .here { color:${T.ink2}; }
</style></head>
<body>
  <div class="topline"></div>
  <div class="frame">
    <div class="kicker">
      ${stalk(T.amber)}
      <div class="k">open-source design system</div>
    </div>
    <div class="mid">
      <div class="word">fairtrade<span class="tick">_</span></div>
      <div class="tag">an open-source design system for building agent products of every kind. react + tailwind, dark-first, square, neuroinclusive, with a documented component library.</div>
    </div>
    <div class="foot">
      <span class="here">orchestration</span><span class="dot">/</span>
      <span class="here">analysis</span><span class="dot">/</span>
      <span class="here">transcripts</span><span class="dot">/</span>
      <span class="here">pr review</span>
    </div>
  </div>
</body></html>`

/* 180x180 apple-touch-icon: the wheat stalk centered on the dark canvas, matching favicon.svg. */
const iconHtml = `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:180px; height:180px; }
  body { background:${T.canvas}; display:flex; align-items:center; justify-content:center; }
  svg { width:96px; height:130px; display:block; }
</style></head>
<body>${stalk(T.amber)}</body></html>`

async function shoot(browser, html, width, height, out) {
  const page = await browser.newPage()
  // render at 2x for crisp text, capture as a data url, then downscale to the EXACT declared
  // dimensions (1200x630 / 180x180) so og:image:width/height match the file pixel-for-pixel and
  // no share-card validator flags a size mismatch. the 2x source keeps edges sharp after the scale.
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  await page.setContent(html, { waitUntil: 'networkidle0' })
  // give the web font a beat to swap in before the capture
  try { await page.evaluate(() => document.fonts && document.fonts.ready) } catch {}
  await new Promise((r) => setTimeout(r, 350))
  const hiRes = await page.screenshot({ encoding: 'base64', clip: { x: 0, y: 0, width, height } })
  const buf = await page.evaluate(async (dataUrl, w, h) => {
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    const out = c.toDataURL('image/png')
    return out.slice(out.indexOf(',') + 1)
  }, 'data:image/png;base64,' + hiRes, width, height)
  await writeFile(out, Buffer.from(buf, 'base64'))
  await page.close()
  console.log('wrote', out, `${width}x${height}`)
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
await shoot(browser, ogHtml, 1200, 630, resolve(PUBLIC, 'og-image.png'))
await shoot(browser, iconHtml, 180, 180, resolve(PUBLIC, 'apple-touch-icon.png'))
await browser.close()

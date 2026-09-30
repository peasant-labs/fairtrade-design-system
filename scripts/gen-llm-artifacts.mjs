#!/usr/bin/env node
/* LLM-friendliness generator. Emits two machine-readable artifacts straight from the existing
   single sources of truth, so an agent can consume the system without reading a 3000-line
   stylesheet or a runtime-only Storybook:

     public/tokens.json      design tokens in the W3C DTCG shape ($type/$value), both themes,
                             generated from the :root + [data-theme="light"] blocks in src/index.css.
     public/components.json  a component manifest (name, category, file, exported parts, props +
                             controls, stories, one-line doc), generated from src/ui.

   It also emits the package CSS/JSON artifacts staged under packages/tokens/ and copied into
   the root @peasant-labs/fairtrade package at build time:

     packages/tokens/tokens.css   the :root dark map + the [data-theme="light"] overrides, copied
                                  byte-faithfully from the same two blocks in src/index.css (values
                                  verbatim, incl. var()/clamp()/rgba() indirection). This IS the
                                  shipped CSS contract; downstream re-themes by swapping [data-theme].
     packages/tokens/base.css     the minimal global reset/base contract for package consumers.
     packages/tokens/tokens.json  the same DTCG document written to public/tokens.json, re-exported
                                  from the package so consumers get one token document.

   And the machine-readable layer of the design record:

     DESIGN.md (frontmatter only) colors, typography roles, radius, spacing and component tokens in
                                  the DESIGN.md format, resolved from the same two blocks; the
                                  authored prose below the frontmatter is left untouched.

   Run by `pnpm build` and checked fresh in CI (re-run, then `git diff --exit-code`). It reads
   values, never authors them: the CSS + the component files stay the only sources. usage: node scripts/gen-llm-artifacts.mjs */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const CSS = join(ROOT, 'src', 'index.css')
const UI = join(ROOT, 'src', 'ui')
const OUT = join(ROOT, 'public')
const TOKENS_PKG = join(ROOT, 'packages', 'tokens')

/* ---------- tokens (DTCG) ---------- */
// brace-matched extraction of a selector block (same approach as contrast.mjs).
function block(css, opener) {
  const start = css.indexOf(opener)
  if (start === -1) throw new Error('block not found: ' + opener)
  const open = css.indexOf('{', start)
  let depth = 0, i = open
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') { depth--; if (depth === 0) break }
  }
  const body = css.slice(open + 1, i)
  const map = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    map[m[1].slice(2)] = m[2].trim()
  }
  return map
}

const TYPE_GROUP = [
  [/^bp-/, 'breakpoint', 'dimension'],
  [/^sp-|^nav-h$|^control-h|^maxw$|^gutter$|^band-y$|^group-y$|^row-h-|^target-/, 'space', 'dimension'],
  [/^fs-|^ic-|^lh-/, 'typography', 'dimension'],
  [/^dur-|^ease-|^motion-/, 'motion', 'duration'],
  [/^z-/, 'z-index', 'number'],
  [/^font-/, 'font', 'fontFamily'],
]
function classify(name) {
  for (const [re, group, type] of TYPE_GROUP) if (re.test(name)) return { group, type }
  return { group: 'other', type: 'other' }
}
const isHex = (v) => /^#[0-9a-fA-F]{3,8}$/.test(v)

function buildTokens() {
  const css = readFileSync(CSS, 'utf8')
  const dark = block(css, ':root {')
  const light = block(css, '[data-theme="light"] {')
  const out = {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $description:
      'fairtrade design tokens, generated from src/index.css. dark is the default; light values are in $extensions["fairtrade.theme"].light. never hardcode a hex - reference a token. radius is 0 everywhere; spacing is the 4/8 scale.',
    color: {},
    space: {},
    typography: {},
    motion: {},
    font: {},
    breakpoint: {},
    'z-index': {},
    other: {},
  }
  for (const [name, value] of Object.entries(dark)) {
    const colorish = isHex(value)
    const { group, type } = colorish ? { group: 'color', type: 'color' } : classify(name)
    const token = { $type: type, $value: value }
    const lv = light[name]
    if (lv && lv !== value) token.$extensions = { 'fairtrade.theme': { light: lv } }
    out[group][name] = token
  }
  // drop empty groups
  for (const k of Object.keys(out)) if (out[k] && typeof out[k] === 'object' && !out[k].$type && Object.keys(out[k]).length === 0) delete out[k]
  return out
}

/* ---------- package token CSS (packages/tokens/tokens.css) ----------
   The shipped CSS contract for @peasant-labs/fairtrade/tokens.css. Reconstructs the two canonical
   blocks from the SAME maps the DTCG build reads, so values stay byte-faithful to src/index.css:
   the dark map under :root (every token), the light map under [data-theme="light"] (only the
   overrides, which is exactly what the source block declares). var()/clamp()/rgba() indirection is
   preserved verbatim, so the downstream token graph and the [data-theme] swap behave identically to
   the design-system app. One token per line keeps a stable, reviewable diff for gen:check. */
function emitVars(map) {
  return Object.entries(map)
    .map(([name, value]) => `  --${name}: ${value};`)
    .join('\n')
}
function buildTokensCss() {
  const css = readFileSync(CSS, 'utf8')
  const dark = block(css, ':root {')
  const light = block(css, '[data-theme="light"] {')
  return (
    '/* @peasant-labs/fairtrade/tokens.css — canonical design tokens.\n' +
    '   GENERATED from src/index.css by scripts/gen-llm-artifacts.mjs. Do not edit by hand;\n' +
    "   edit src/index.css and re-run `pnpm gen:check` (CI fails on drift).\n" +
    '   Dark is the default (:root); [data-theme="light"] overrides the themeable subset.\n' +
    '   Set data-theme="light" on a root element (e.g. <html>) to switch; omit it for dark. */\n' +
    ':root {\n' +
    emitVars(dark) +
    '\n}\n' +
    '[data-theme="light"] {\n' +
    emitVars(light) +
    '\n}\n'
  )
}

function buildBaseCss() {
  return (
    '/* @peasant-labs/fairtrade — base styles.\n' +
    '   GENERATED by scripts/gen-llm-artifacts.mjs. Import after tokens.css and before components.css.\n' +
    '   This is the consumer-safe base subset from src/index.css with Tailwind @apply resolved to\n' +
    '   token-backed CSS custom properties.\n' +
    '   Wrapped in `@layer base` so it matches the design-system cascade: an UNLAYERED `a { … --amber }`\n' +
    '   here would OUT-RANK the layered `@layer components .crumb a { … ink-3 }` (an unlayered rule beats\n' +
    '   any cascade layer regardless of specificity), turning every breadcrumb/chrome link amber. The base\n' +
    '   layer keeps the components layer winning. Do not unwrap. */\n' +
    '@layer base {\n' +
    'html { scroll-padding-top: var(--nav-h); overscroll-behavior-y: none; }\n' +
    'body {\n' +
    '  margin: 0;\n' +
    '  background: var(--canvas);\n' +
    '  color: var(--ink);\n' +
    '  font-family: var(--font-body);\n' +
    '  font-size: var(--fs-body);\n' +
    '  line-height: var(--lh-body);\n' +
    '  text-align: start;\n' +
    '  -webkit-font-smoothing: antialiased;\n' +
    '}\n' +
    '*, *::before, *::after { box-sizing: border-box; }\n' +
    'h1, h2, h3 {\n' +
    '  margin: 0;\n' +
    '  color: var(--ink-strong);\n' +
    '  font-family: var(--font-display);\n' +
    '  font-weight: 700;\n' +
    '  line-height: var(--lh-tight);\n' +
    '  text-transform: lowercase;\n' +
    '}\n' +
    'p { margin: 0; }\n' +
    'p, .turn .body, .empty p, .prose {\n' +
    '  letter-spacing: var(--tracking-prose);\n' +
    '  word-spacing: var(--word-spacing-prose);\n' +
    '  max-inline-size: var(--measure-prose);\n' +
    '}\n' +
    '.mono, code, pre, .tnum, .kbd, .bullets li, [data-tabular] {\n' +
    '  letter-spacing: 0;\n' +
    '  word-spacing: normal;\n' +
    '}\n' +
    'em, i { font-style: normal; font-weight: 600; }\n' +
    ':focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px; }\n' +
    'a { color: var(--amber); text-decoration: none; }\n' +
    'a.link, .prose a { text-decoration: underline dotted; text-underline-offset: 3px; }\n' +
    'a.link:hover, a.link:focus-visible, .prose a:hover { text-decoration-style: solid; }\n' +
    'section { max-width: var(--maxw); margin: 0 auto; padding: 0 var(--gutter); }\n' +
    '@media (prefers-reduced-motion: reduce) {\n' +
    '  html { scroll-behavior: auto; }\n' +
    '  *, *::before, *::after {\n' +
    '    animation-duration: .01ms !important;\n' +
    '    animation-iteration-count: 1 !important;\n' +
    '    transition-duration: .01ms !important;\n' +
    '  }\n' +
    '}\n' +
    '}\n' /* close @layer base */
  )
}

/* ---------- DESIGN.md frontmatter ----------
   DESIGN.md (repo root) is the one design record. Its YAML frontmatter follows the DESIGN.md format
   (name, description, colors, typography, rounded, spacing, components) and is GENERATED here from
   the same two token blocks, so every token VALUE in it is the value src/index.css ships. Only the
   frontmatter is rewritten; the authored body below it is kept byte for byte. Colors are the hex
   tokens (the same set as the tokens.json color group) in source order, dark first, each followed by
   a `-light` key when the light theme overrides it (a `-light` key is a frontmatter name, not a CSS
   custom property). The description, the typography roles (TYPE_ROLES) and the component entries
   (COMPONENTS) are AUTHORED here: they say which tokens a role or component uses, so a restyle in
   src/index.css must update them by hand. What the generator does guarantee is that each value
   resolves from a token (or is a literal weight or zero) and that every {group.name} reference
   resolves, so a renamed token or a dangling reference fails the build. */
const DESIGN = join(ROOT, 'DESIGN.md')
const tok = (name) => ({ token: name })
const TYPE_ROLES = [
  ['display', { fontFamily: tok('font-display'), fontSize: tok('fs-display'), fontWeight: 700, lineHeight: tok('lh-tight') }],
  ['headline', { fontFamily: tok('font-display'), fontSize: tok('fs-xl'), fontWeight: 700, lineHeight: tok('lh-tight') }],
  ['title', { fontFamily: tok('font-display'), fontSize: tok('fs-lg'), fontWeight: 700, lineHeight: tok('lh-tight') }],
  ['body', { fontFamily: tok('font-body'), fontSize: tok('fs-body'), fontWeight: 400, lineHeight: tok('lh-body'), letterSpacing: tok('tracking-prose') }],
  ['label', { fontFamily: tok('font-mono'), fontSize: tok('fs-label'), fontWeight: 400, letterSpacing: '0px' }],
  ['label-strong', { fontFamily: tok('font-mono'), fontSize: tok('fs-label'), fontWeight: 600, letterSpacing: '0px' }],
  ['field', { fontFamily: tok('font-body'), fontSize: tok('fs-body'), fontWeight: 400 }],
  ['code', { fontFamily: tok('font-mono'), fontSize: tok('fs-body'), fontWeight: 400, lineHeight: tok('lh-mono'), letterSpacing: '0px' }],
]
const control = { rounded: '{rounded.none}', height: tok('control-h') }
const COMPONENTS = [
  ['button-primary', { backgroundColor: '{colors.amber}', textColor: '{colors.on-amber}', typography: '{typography.label-strong}', ...control, padding: ['0', tok('sp-4')] }],
  ['button-primary-hover', { backgroundColor: '{colors.amber-bright}' }],
  ['button-secondary', { backgroundColor: 'transparent', textColor: '{colors.ink}', typography: '{typography.label}', ...control, padding: ['0', tok('sp-4')] }],
  ['button-secondary-hover', { textColor: '{colors.amber-bright}' }],
  ['button-ghost', { backgroundColor: 'transparent', textColor: '{colors.ink-3}', typography: '{typography.label}', ...control, padding: ['0', tok('sp-4')] }],
  ['button-ghost-hover', { backgroundColor: '{colors.surface-hover}', textColor: '{colors.ink}' }],
  ['button-danger', { backgroundColor: 'transparent', textColor: '{colors.clay}', typography: '{typography.label}', ...control, padding: ['0', tok('sp-4')] }],
  ['input', { backgroundColor: '{colors.canvas}', textColor: '{colors.ink}', typography: '{typography.field}', ...control, padding: ['0', tok('sp-3')] }],
  ['chip', { textColor: '{colors.ink-2}', typography: '{typography.label}', rounded: '{rounded.none}', height: tok('control-h-sm'), padding: ['0', tok('sp-3')] }],
  ['card', { backgroundColor: '{colors.surface}', rounded: '{rounded.none}', padding: tok('sp-4') }],
  ['dialog', { backgroundColor: '{colors.surface}', rounded: '{rounded.none}', width: tok('dialog-w') }],
]

function yamlScalar(value) {
  if (typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(value)) return String(value)
  return "'" + String(value).replace(/'/g, "''") + "'"
}

function buildDesignFrontmatter() {
  const css = readFileSync(CSS, 'utf8')
  const dark = block(css, ':root {')
  const light = block(css, '[data-theme="light"] {')
  const resolve = (v) => {
    if (Array.isArray(v)) return v.map(resolve).join(' ')
    if (v && typeof v === 'object') {
      if (!(v.token in dark)) throw new Error(`DESIGN.md frontmatter: unknown token --${v.token}`)
      return dark[v.token]
    }
    return v
  }
  const colors = []
  for (const [name, value] of Object.entries(dark)) {
    if (!isHex(value)) continue
    colors.push([name, value])
    if (light[name] && light[name] !== value) {
      if (name + '-light' in dark) throw new Error(`DESIGN.md frontmatter: --${name}-light is a token, so its light-theme key would collide`)
      colors.push([name + '-light', light[name]])
    }
  }
  const spacingNames = Object.keys(dark).filter((n) => /^sp-\d+$/.test(n))
  const known = {
    colors: new Set(colors.map(([n]) => n)),
    typography: new Set(TYPE_ROLES.map(([n]) => n)),
    rounded: new Set(['none']),
    spacing: new Set(spacingNames),
  }
  const checkRef = (v) => {
    if (typeof v !== 'string' || !v.includes('{')) return
    const m = v.match(/^\{([\w-]+)\.([\w-]+)\}$/)
    if (!m || !known[m[1]]?.has(m[2])) throw new Error(`DESIGN.md frontmatter: unknown reference ${v}`)
  }
  const lines = [
    '# GENERATED from src/index.css by scripts/gen-llm-artifacts.mjs. Do not edit this block by hand:',
    '# edit src/index.css and re-run the generator (CI gen:check fails on drift). Dark is the default',
    '# theme; a `-light` key carries the light theme value where it differs.',
    'name: fairtrade',
    'description: ' + yamlScalar('One square, token-driven design system for reading AI coding transcripts: two WCAG AA themes, neuroinclusive by default, amber as a scarce accent.'),
    'colors:',
    ...colors.map(([n, v]) => `  ${n}: ${yamlScalar(v)}`),
    'typography:',
  ]
  for (const [role, props] of TYPE_ROLES) {
    lines.push(`  ${role}:`)
    for (const [k, v] of Object.entries(props)) lines.push(`    ${k}: ${yamlScalar(resolve(v))}`)
  }
  lines.push('rounded:', `  none: ${yamlScalar('0px')}`, 'spacing:')
  for (const name of spacingNames) lines.push(`  ${name}: ${yamlScalar(dark[name])}`)
  lines.push('components:')
  for (const [name, props] of COMPONENTS) {
    lines.push(`  ${name}:`)
    for (const [k, v] of Object.entries(props)) {
      checkRef(v)
      lines.push(`    ${k}: ${yamlScalar(resolve(v))}`)
    }
  }
  return '---\n' + lines.join('\n') + '\n---\n'
}

function writeDesignFrontmatter() {
  const text = readFileSync(DESIGN, 'utf8')
  const close = text.startsWith('---\n') ? text.indexOf('\n---\n', 3) : -1
  if (close === -1) throw new Error('DESIGN.md must open with a YAML frontmatter block (---)')
  const body = text.slice(close + 5)
  writeFileSync(DESIGN, buildDesignFrontmatter() + body)
}

/* ---------- components manifest ---------- */
// pull a balanced { ... } that follows a `key:` in source (best-effort, brace-matched).
function balanced(src, fromIdx) {
  const open = src.indexOf('{', fromIdx)
  if (open === -1) return null
  let depth = 0, i = open
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) break }
  }
  return src.slice(open, i + 1)
}

function parseArgTypes(storySrc) {
  const at = storySrc.indexOf('argTypes:')
  if (at === -1) return {}
  const blk = balanced(storySrc, at)
  if (!blk) return {}
  const props = {}
  // top-level keys: `name: { ... }` or `'aria-label': { ... }`
  const re = /(?:^|[,{]\s*)['"]?([a-zA-Z][\w-]*)['"]?\s*:\s*\{/g
  let m
  while ((m = re.exec(blk))) {
    const key = m[1]
    const sub = balanced(blk, m.index + m[0].length - 1)
    if (!sub) continue
    const ctrl = sub.match(/control:\s*(?:\{\s*type:\s*)?['"]?([a-z-]+)['"]?/)
    const opts = sub.match(/options:\s*\[([^\]]*)\]/)
    const entry = {}
    if (ctrl) entry.control = ctrl[1]
    if (opts) entry.options = opts[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    props[key] = entry
  }
  return props
}

function firstDoc(jsxSrc) {
  // first JSDoc block's first sentence-ish line that names the component
  const m = jsxSrc.match(/\/\*\*([\s\S]*?)\*\//)
  if (!m) return ''
  const line = m[1].split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trim()).find((l) => l && /-|—/.test(l))
  return (line || '').replace(/\s+/g, ' ').slice(0, 180)
}

function buildComponents() {
  const barrel = readFileSync(join(UI, 'index.js'), 'utf8')
  const exportsByFile = {}
  for (const m of barrel.matchAll(/export\s+\{([^}]+)\}\s+from\s+'\.\/([\w.]+)\.jsx'/g)) {
    const names = m[1].split(',').map((s) => s.replace(/\bdefault as\b/, '').trim()).filter(Boolean)
    exportsByFile[m[2]] = names
  }
  const files = readdirSync(UI).filter((f) => f.endsWith('.stories.jsx'))
  const components = []
  for (const f of files.sort()) {
    const base = f.replace('.stories.jsx', '')
    const storySrc = readFileSync(join(UI, f), 'utf8')
    const title = (storySrc.match(/title:\s*['"]([^'"]+)['"]/) || [])[1] || base
    const category = title.includes('/') ? title.split('/')[0] : 'misc'
    const stories = [...storySrc.matchAll(/export\s+const\s+([A-Z]\w*)\s*=/g)].map((m) => m[1]).filter((n) => n !== 'default')
    let doc = ''
    try { doc = firstDoc(readFileSync(join(UI, base + '.jsx'), 'utf8')) } catch {}
    components.push({
      name: base,
      category,
      title,
      file: 'src/ui/' + base + '.jsx',
      exports: exportsByFile[base] || [base],
      doc,
      props: parseArgTypes(storySrc),
      stories,
    })
  }
  return {
    $description:
      'fairtrade component manifest, generated from src/ui. import from the barrel: import { Button } from "src/ui". every component is token-styled (classes in src/index.css) and works in both themes. props shows the Storybook-controllable props; full prop docs are the JSDoc in each file.',
    import: 'src/ui (barrel: src/ui/index.js)',
    count: components.length,
    components,
  }
}

const tokens = buildTokens()
const comps = buildComponents()
const tokensJson = JSON.stringify(tokens, null, 2) + '\n'
writeFileSync(join(OUT, 'tokens.json'), tokensJson)
writeFileSync(join(OUT, 'components.json'), JSON.stringify(comps, null, 2) + '\n')

// root fairtrade package artifacts: the CSS contract + the same DTCG doc.
const tokensCss = buildTokensCss()
writeFileSync(join(TOKENS_PKG, 'tokens.css'), tokensCss)
writeFileSync(join(TOKENS_PKG, 'tokens.json'), tokensJson)
writeFileSync(join(TOKENS_PKG, 'base.css'), buildBaseCss())

// the design record's machine-readable layer: DESIGN.md frontmatter, from the same token blocks.
writeDesignFrontmatter()

const nColor = Object.keys(tokens.color || {}).length
console.log(`llm artifacts: public/tokens.json (${nColor} colors + space/type/motion), public/components.json (${comps.count} components)`)
console.log(`token package: packages/tokens/tokens.css + tokens.json + base.css (from src/index.css)`)
console.log(`design record: DESIGN.md frontmatter (from src/index.css)`)

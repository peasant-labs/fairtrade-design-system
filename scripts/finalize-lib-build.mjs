#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'dist', 'lib')
const TOKENS = join(ROOT, 'packages', 'tokens')

mkdirSync(OUT, { recursive: true })

const copies = [
  ['tokens.css', 'tokens.css'],
  ['tokens.json', 'tokens.json'],
  ['base.css', 'base.css'],
  ['fonts.css', 'fonts.css'],
]
for (const [from, to] of copies) {
  copyFileSync(join(TOKENS, from), join(OUT, to))
}

// Emit-then-delete: the lib CSS build (vite.lib-css.config.js) is a two-config
// workaround for a Vite library-mode CSS limitation — it requires a dummy JS
// entry to coax the compiled stylesheet out, and the JS barrel build (vite.lib
// .config.js) separately emits its collected CSS. Both produce throwaway
// artifacts we discard here so only the explicit, self-contained components.css
// ships:
//   - ui-imports.css      : the JS barrel's collected CSS (superseded by the
//                           explicit components.css entry).
//   - components-entry.js : the dummy JS entry Vite needs to emit components.css.
const jsImportCss = join(OUT, 'ui-imports.css')
if (existsSync(jsImportCss)) rmSync(jsImportCss)

const cssEntry = join(OUT, 'components-entry.js')
if (existsSync(cssEntry)) rmSync(cssEntry)

// ./icons is a lucide-react passthrough; the Vite lib build externalizes
// lucide-react, so dist/lib/icons.js is a thin re-export. Emit a matching
// declaration so the "./icons" export resolves types for consumers. tsc runs
// after this script and does not clean dist/lib/types, so this file survives.
const TYPES = join(OUT, 'types')
mkdirSync(TYPES, { recursive: true })
writeFileSync(join(TYPES, 'icons.d.ts'), "export * from 'lucide-react'\n")

const required = ['ui.js', 'icons.js', 'tokens.css', 'base.css', 'components.css', 'tokens.json', 'fonts.css']
const missing = required.filter((file) => !existsSync(join(OUT, file)))
if (missing.length) {
  throw new Error(
    `fairtrade lib build failed in scripts/finalize-lib-build.mjs after Vite library/CSS builds: missing ${missing.join(', ')} in dist/lib. Consumers would not be able to import the documented @peasant-labs/fairtrade exports. Re-run pnpm build:lib and inspect the Vite output filenames.`,
  )
}

// Content assertions on the shipped CSS. existsSync alone cannot catch a CSS
// MISBUILD (an empty/stub components.css from a vite.lib-css regression) — that
// would still pass existsSync + the JS-only smoke (renderToStaticMarkup ignores
// CSS), shipping a visually-broken package every other gate calls green. The
// core requirement is "components.css fully styles every component with no
// consumer-side processing", so assert a byte-floor + that the compiled @layer
// block AND a sample of the 27 colocated component sheets are actually present.
const cssChecks = [
  {
    file: 'components.css',
    minBytes: 100_000, // healthy build is ~337KB; a stub sheet would be a few KB
    markers: ['@layer', 'cg-', 'dv-', 'rr-', 'ir-'], // @layer block + CommitGraph/DiffView/RoleRoster/Intensity colocated selectors
  },
  { file: 'base.css', minBytes: 200, markers: ['html', 'body'] },
]
const cssProblems = []
for (const { file, minBytes, markers } of cssChecks) {
  const path = join(OUT, file)
  const bytes = statSync(path).size
  if (bytes < minBytes) {
    cssProblems.push(`${file} is ${bytes} bytes, below the ${minBytes}-byte floor (likely a stub/empty CSS misbuild)`)
    continue
  }
  const text = readFileSync(path, 'utf8')
  const absent = markers.filter((m) => !text.includes(m))
  if (absent.length) cssProblems.push(`${file} (${bytes} bytes) is missing expected selectors/markers: ${absent.join(', ')}`)
}
if (cssProblems.length) {
  throw new Error(
    [
      'fairtrade lib build failed in scripts/finalize-lib-build.mjs: shipped CSS content assertion failed.',
      'What went wrong: the compiled stylesheet(s) under dist/lib do not look self-contained:',
      ...cssProblems.map((p) => `  - ${p}`),
      'Why it matters: a consumer importing tokens.css+base.css+components.css must get every component fully',
      'styled with no Tailwind/CSS processing (the published-package contract); a stub/partial sheet silently breaks that.',
      'Where/when: post-finalize, after the vite.lib-css.config.js build of src/lib-components.css.',
      'How to fix: re-run pnpm build:lib and inspect the vite.lib-css build output + src/lib-components.css imports.',
    ].join('\n'),
  )
}

// ── Post-lift cascade + layout contract (regressions caught at Impl UAT) ──────
// Two faults shipped GREEN through every other gate because they are pure CSS
// cascade/layout bugs the JS smokes (renderToStaticMarkup) cannot observe:
//   A) base.css MUST be wrapped in `@layer base { … }`. Shipped UNLAYERED, its
//      `a { color: var(--amber) }` out-cascades the layered
//      `@layer components .crumb a { … ink-3 }` (unlayered always beats any
//      layer), so every breadcrumb/chrome link renders amber for a consumer on
//      the documented tokens.css + base.css + components.css path.
//   B) components.css MUST size `.txn-graphslot` — the TranscriptViewer graph-
//      view container, sibling of `.txn-streamwrap` inside the `flex-column`
//      `.txn-trace` — with `flex:1; min-height:0`. Without it a fill-parent graph
//      engine (@xyflow, height:100%) resolves against a 0-height parent → 0px.
// These assert the actual SHIPPED bytes in dist/lib, so the published 0.0.3 is
// correct for every consumer regardless of any TB-side workaround.
const contractProblems = []

// strip CSS comments before structural checks — the base.css header comment itself
// quotes `a { … --amber }`/`.crumb a { … ink-3 }`, whose braces would otherwise be
// mistaken for unlayered rules sitting before the @layer opener.
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const baseCssText = stripComments(readFileSync(join(OUT, 'base.css'), 'utf8'))
const baseLayerIdx = baseCssText.search(/@layer\s+base\s*\{/)
if (baseLayerIdx === -1) {
  contractProblems.push(
    'base.css is NOT wrapped in `@layer base { … }`. Its bare `a { color: var(--amber) }` out-cascades the layered ' +
      '`@layer components .crumb a { … ink-3 }`, so every breadcrumb/chrome link renders amber for consumers on the ' +
      'documented tokens.css + base.css + components.css path. Fix: wrap buildBaseCss() output in `@layer base { … }` ' +
      'in scripts/gen-llm-artifacts.mjs, then re-run gen + rebuild.',
  )
} else if (baseCssText.slice(0, baseLayerIdx).includes('{')) {
  // a selector block appearing before the layer opens would be UNLAYERED and would still win the cascade.
  contractProblems.push(
    'base.css has a rule OUTSIDE `@layer base { … }` (a `{` appears before the layer opens). Any unlayered rule ' +
      'out-cascades @layer components. Fix: ensure buildBaseCss() wraps the ENTIRE body in `@layer base` in ' +
      'scripts/gen-llm-artifacts.mjs.',
  )
}

// `[^{}]*` (not `\s*`) tolerates lightningcss selector-grouping (e.g. `.a,.txn-graphslot{…}`)
// while staying inside a single selector list (it cannot cross a `{` or `}`).
const compCssText = stripComments(readFileSync(join(OUT, 'components.css'), 'utf8'))
const graphslotRule = compCssText.match(/\.txn-graphslot[^{}]*\{([^}]*)\}/)
if (!graphslotRule) {
  contractProblems.push(
    'components.css has no `.txn-graphslot { … }` rule. The TranscriptViewer graph-view container (sibling of ' +
      '`.txn-streamwrap` inside the flex-column `.txn-trace`) has no sizing, so a fill-parent graph engine (@xyflow) ' +
      'collapses to 0px. Fix: add `.txn-graphslot { flex: 1; min-height: 0 }` to the `@layer components` block in ' +
      'src/index.css (mirroring `.txn-streamwrap`) and rebuild.',
  )
} else if (!/flex/.test(graphslotRule[1]) || !/min-height/.test(graphslotRule[1])) {
  contractProblems.push(
    'components.css `.txn-graphslot` rule (' +
      graphslotRule[1].trim() +
      ') is missing flex/min-height sizing; it must mirror `.txn-streamwrap` (flex:1; min-height:0) so the graph view ' +
      'fills `.txn-trace`. Fix the rule in src/index.css `@layer components`.',
  )
}

if (contractProblems.length) {
  throw new Error(
    [
      'fairtrade lib build failed in scripts/finalize-lib-build.mjs: shipped-CSS cascade/layout contract FAILED.',
      'What went wrong (these ship green through JS smokes but break in a real browser):',
      ...contractProblems.map((p) => `  - ${p}`),
      'Where/when: post-finalize, asserting the bytes in dist/lib/base.css and dist/lib/components.css.',
    ].join('\n'),
  )
}

console.log(`fairtrade artifacts ready in ${OUT}`)

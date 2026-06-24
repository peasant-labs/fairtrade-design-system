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
// core AC (PROPOSAL-6) is "components.css fully styles every component with no
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
      'styled with no Tailwind/CSS processing (PROPOSAL-6 AC); a stub/partial sheet silently breaks that.',
      'Where/when: post-finalize, after the vite.lib-css.config.js build of src/lib-components.css.',
      'How to fix: re-run pnpm build:lib and inspect the vite.lib-css build output + src/lib-components.css imports.',
    ].join('\n'),
  )
}

console.log(`fairtrade artifacts ready in ${OUT}`)

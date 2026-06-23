#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
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

// CSS imported by the JS barrel is already included in the explicit components.css entry.
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

writeFileSync(
  join(OUT, 'README.md'),
  [
    '# @peasant-labs/fairtrade',
    '',
    'Generated package artifacts for the private fairtrade design-system library.',
    '',
    'Import CSS explicitly:',
    '',
    '```css',
    '@import "@peasant-labs/fairtrade/tokens.css";',
    '@import "@peasant-labs/fairtrade/base.css";',
    '@import "@peasant-labs/fairtrade/components.css";',
    '```',
    '',
    'Import React UI from `@peasant-labs/fairtrade/ui`.',
    '',
    'Import icons (lucide-react passthrough) from `@peasant-labs/fairtrade/icons`.',
    '',
  ].join('\n'),
)

console.log(`fairtrade artifacts ready in ${OUT}`)

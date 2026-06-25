#!/usr/bin/env node
/* tarball-install smoke
   The pre-publish proxy for "what npm actually serves": packs the REAL tarball,
   lays it out as a clean consumer in a temp dir, and imports every documented
   subpath through the package's own exports map. smoke-lib runs against the
   local dist BEFORE pack; this runs against the packed bytes. Had this existed,
   the dist-less 0.0.1 would have been caught directly.

   Runtime externals are symlinked from this repo's node_modules (Node follows
   the symlink realpath, so transitive deps resolve from the repo store) — no
   network install. Requires a prior `pnpm build:lib`. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

if (!existsSync(join(ROOT, 'dist', 'lib', 'ui.js'))) {
  throw new Error(
    'tarball smoke aborted in scripts/smoke-tarball.mjs: dist/lib/ui.js is missing. Run `pnpm build:lib` before `pnpm smoke:tarball`.',
  )
}

const tmp = mkdtempSync(join(tmpdir(), 'fairtrade-tarball-'))
try {
  // 1. Pack the real tarball (current dist; --ignore-scripts so we don't rebuild).
  const out = execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', tmp], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const tgz = join(tmp, JSON.parse(out)[0].filename)

  // 2. Lay out a clean consumer: extract the tarball under node_modules + symlink
  //    the runtime externals from this repo.
  const nm = join(tmp, 'node_modules')
  const pkgDir = join(nm, '@peasant-labs', 'fairtrade')
  mkdirSync(pkgDir, { recursive: true })
  execFileSync('tar', ['-xzf', tgz, '-C', pkgDir, '--strip-components=1'], { stdio: 'inherit' })

  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    const fromRepo = join(ROOT, 'node_modules', dep)
    if (!existsSync(fromRepo)) continue
    const target = join(nm, dep)
    mkdirSync(dirname(target), { recursive: true })
    symlinkSync(fromRepo, target, 'dir')
  }

  // 3. Run a REAL ESM consumer from the temp dir so Node's resolver applies the
  //    "import" condition (./ui + ./icons are conditional exports — a CJS
  //    require.resolve would not match them; a real `import` does). The consumer
  //    imports ./ui + ./icons and resolves every CSS/JSON subpath via the
  //    tarball's own exports map.
  const cssSubs = ['tokens.css', 'base.css', 'components.css', 'fonts.css', 'tokens.json']
  const consumer = join(tmp, 'consumer.mjs')
  writeFileSync(
    consumer,
    [
      "import * as ui from '@peasant-labs/fairtrade/ui'",
      "import * as icons from '@peasant-labs/fairtrade/icons'",
      "import { existsSync } from 'node:fs'",
      "import { fileURLToPath } from 'node:url'",
      'const failures = []',
      "if (Object.keys(ui).length === 0) failures.push('./ui imported but exported 0 symbols')",
      "if (Object.keys(icons).length === 0) failures.push('./icons imported but exported 0 symbols')",
      `for (const sub of ${JSON.stringify(cssSubs)}) {`,
      '  const spec = "@peasant-labs/fairtrade/" + sub',
      '  try {',
      '    const p = fileURLToPath(import.meta.resolve(spec))',
      '    if (!existsSync(p)) failures.push(sub + ": exports resolves to a missing file " + p)',
      '  } catch (e) { failures.push(sub + ": " + (e && e.message ? e.message.split("\\n")[0] : e)) }',
      '}',
      "if (failures.length) { console.error('CONSUMER_FAILURES:\\n' + failures.map(f => '  - ' + f).join('\\n')); process.exit(1) }",
      `console.log('consumer OK: ./ui=' + Object.keys(ui).length + ' symbols, ./icons=' + Object.keys(icons).length + ' symbols, ${cssSubs.length} CSS/JSON subpaths resolved')`,
    ].join('\n'),
  )

  try {
    const result = execFileSync('node', [consumer], { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    process.stdout.write(`  ${result.trim()}\n`)
  } catch (e) {
    throw new Error(
      [
        'fairtrade tarball smoke FAILED in scripts/smoke-tarball.mjs (ESM consumer importing the packed tarball):',
        (e.stderr || e.stdout || e.message || String(e)).trim(),
        'Why it matters: this is the published-artifact proxy — a consumer of the npm tarball would hit the same break.',
        'How to fix: re-run pnpm build:lib and keep package.json files[] <-> exports in sync, then re-run pnpm smoke:tarball.',
      ].join('\n'),
    )
  }
  console.log('fairtrade tarball smoke: ./ui + ./icons import and all CSS/JSON exports resolve from the packed tarball.')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

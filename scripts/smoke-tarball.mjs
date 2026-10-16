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
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { assertExactNames } from './css-source.mjs'

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

  const hostPackages = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ])
  for (const dep of hostPackages) {
    const fromRepo = join(ROOT, 'node_modules', dep)
    if (!existsSync(fromRepo)) continue
    const target = join(nm, dep)
    mkdirSync(dirname(target), { recursive: true })
    symlinkSync(fromRepo, target, 'dir')
  }
  if (existsSync(join(pkgDir, 'node_modules', 'react')) || existsSync(join(pkgDir, 'node_modules', 'react-dom'))) {
    throw new Error('fairtrade tarball smoke FAILED: the packed package contains a private React runtime. Fix: keep react and react-dom peer-only and external.')
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
  // Compile and execute through the packed /ui export, including same-name types.
  // This catches declaration emit dropping the type side of a JS re-export.
  const categoryFixture = YAML.parse(readFileSync(join(ROOT, 'scripts/testdata/redaction-labels.yaml'), 'utf8'))
  const categoryManifest = YAML.parse(readFileSync(join(ROOT, 'scripts/testdata/redaction-labels.manifest.yaml'), 'utf8'))
  assertExactNames(categoryFixture.categories.map(row => row.name), categoryManifest.requiredCategoryNames, 'packed category cases')
  assertExactNames(categoryFixture.unknown.map(row => row.name), categoryManifest.requiredUnknownNames, 'packed invalid category cases')
  assertExactNames(categoryFixture.invalidLabels.map(row => row.name), categoryManifest.requiredInvalidLabelNames, 'packed invalid label cases')
  assertExactNames(categoryFixture.exports, categoryManifest.requiredExportNames, 'packed category exports')
  assertExactNames(categoryFixture.frozen, categoryManifest.requiredFrozenNames, 'packed frozen exports')
  writeFileSync(join(tmp, 'redaction-categories.json'), JSON.stringify(categoryFixture))
  const recoveryFixture = YAML.parse(readFileSync(join(ROOT, 'scripts/testdata/publish-recovery.yaml'), 'utf8'))
  const recoveryManifest = YAML.parse(readFileSync(join(ROOT, 'scripts/testdata/publish-recovery.manifest.yaml'), 'utf8'))
  assertExactNames(recoveryFixture.cases.map(row => row.name), recoveryManifest.requiredCaseNames, 'packed recovery cases')
  writeFileSync(join(tmp, 'publish-recovery.json'), JSON.stringify(recoveryFixture))
  copyFileSync(join(ROOT, 'scripts/redaction-categories.consumer.mjs'), join(tmp, 'redaction-categories.mjs'))
  copyFileSync(join(ROOT, 'scripts/testdata/redaction-categories.consumer.ts'), join(tmp, 'redaction-categories.ts'))
  writeFileSync(join(tmp, 'package.json'), JSON.stringify({ type: 'module' }))
  execFileSync('node', [join(tmp, 'redaction-categories.mjs')], { cwd: tmp, stdio: 'inherit', timeout: 60_000 })
  execFileSync('node', [join(ROOT, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2020', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', join(tmp, 'redaction-categories.ts')], { cwd: tmp, stdio: 'inherit', timeout: 60_000 })
  console.log('fairtrade tarball smoke: ./ui + ./icons import and all CSS/JSON exports resolve from the packed tarball.')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

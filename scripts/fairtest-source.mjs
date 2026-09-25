#!/usr/bin/env node
// Sole repository-local route from Fairtrade app scripts to the private
// workspace source package. Every app-side import of child source goes
// through resolveFairtestSource or importFairtestSource; no other relative
// path into packages/fairtest may be added. Bare specifiers, absolute
// paths, traversal segments, and symlink escapes are rejected. Uses node
// builtins only and starts no service or browser.
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')

export const FAIRTEST_PACKAGE_NAME = '@peasant-labs/fairtest'
export const FAIRTEST_PACKAGE_ROOT = resolve(REPO_ROOT, 'packages', 'fairtest')
const ALLOWED_EXTENSIONS = new Set(['.mjs', '.js', '.cjs', '.json'])

function reject(spec, reason) {
  throw new Error(`fairtest source route: rejected ${JSON.stringify(spec)}: ${reason}.`)
}

export function resolveFairtestSource(spec) {
  if (typeof spec !== 'string' || spec.length === 0) reject(spec, 'module path must be a non-empty relative path')
  if (spec.includes('\0')) reject(spec, 'null bytes are not allowed')
  if (spec.includes('\\')) reject(spec, 'windows separators are not allowed; use posix slashes')
  if (spec.startsWith('/')) reject(spec, 'absolute paths are not allowed')
  if (/^[A-Za-z]:/.test(spec)) reject(spec, 'drive-qualified paths are not allowed')
  if (spec.includes(':')) reject(spec, 'bare specifiers and scheme-qualified paths are not allowed')
  if (spec.startsWith('@')) reject(spec, 'bare package specifiers are not allowed')
  const segments = spec.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      reject(spec, 'empty, current-directory, and parent-directory segments are not allowed')
    }
  }
  const joined = resolve(FAIRTEST_PACKAGE_ROOT, spec)
  let root
  try {
    root = realpathSync(FAIRTEST_PACKAGE_ROOT)
  } catch {
    reject(spec, 'workspace child packages/fairtest is missing')
  }
  let target
  try {
    target = realpathSync(joined)
  } catch {
    reject(spec, `no such module under ${FAIRTEST_PACKAGE_NAME}`)
  }
  if (target !== root && !target.startsWith(root + sep)) {
    reject(spec, 'resolved path escapes the workspace child')
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    reject(spec, 'module path must name a file inside the workspace child')
  }
  if (!ALLOWED_EXTENSIONS.has(extname(target))) {
    reject(spec, `extension must be one of ${[...ALLOWED_EXTENSIONS].join(', ')}`)
  }
  return target
}

export function importFairtestSource(spec) {
  return import(pathToFileURL(resolveFairtestSource(spec)).href)
}

export function readFairtestManifest() {
  const path = resolveFairtestSource('package.json')
  return JSON.parse(readFileSync(path, 'utf8'))
}

function check(name, fn, expectPass) {
  let message = null
  let value = null
  try {
    value = fn()
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  const behaved = expectPass ? message === null : message !== null
  console.log(`${behaved ? 'PASS' : 'FAIL'} ${name}${message ? ` :: ${message}` : ''}`)
  return { behaved, value }
}

function runSmoke() {
  const results = []
  const positive = check('resolve package.json inside the child', () => resolveFairtestSource('package.json'), true)
  results.push(positive.behaved)
  if (positive.behaved) {
    results.push(check('resolved path stays under the child root', () => {
      const root = realpathSync(FAIRTEST_PACKAGE_ROOT)
      if (positive.value !== root && !positive.value.startsWith(root + sep)) throw new Error('resolved outside the child root')
      return positive.value
    }, true).behaved)
    results.push(check('child manifest names the private workspace package', () => {
      const manifest = readFairtestManifest()
      if (manifest.name !== FAIRTEST_PACKAGE_NAME) throw new Error(`unexpected package name ${JSON.stringify(manifest.name)}`)
      if (manifest.private !== true) throw new Error('child package must stay private')
      return manifest.name
    }, true).behaved)
  }
  for (const spec of ['../package.json', '../../package.json', '/etc/hostname', 'node:fs', '@peasant-labs/fairtest', 'does-not-exist.mjs', './package.json/../..', 'test\\core.test.mjs']) {
    results.push(check(`reject ${spec}`, () => resolveFairtestSource(spec), false).behaved)
  }
  const failed = results.filter((ok) => !ok).length
  console.log(`fairtest source route smoke: ${results.length - failed}/${results.length} checks behaved.`)
  if (failed > 0) process.exitCode = 1
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (invoked === import.meta.url) {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === '--smoke') {
    runSmoke()
  } else if (args[0] === '--resolve' && typeof args[1] === 'string') {
    console.log(resolveFairtestSource(args[1]))
  } else {
    console.error('usage: node scripts/fairtest-source.mjs [--smoke | --resolve <relative-path>]')
    process.exitCode = 2
  }
}

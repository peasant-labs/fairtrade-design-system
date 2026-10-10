// Small shared helpers for the build-time CSS guards (css-token-lint.mjs,
// finalize-lib-build.mjs, css-guards.test.mjs): a block walker that yields every
// rule with its declarations and its enclosing at-rule context, the set of source
// sheets that ship in the package, and the strict fixture loader.
//
// The walker is deliberately small. It understands comments, strings, parentheses,
// nested blocks and statements; it does not validate CSS. That is all the guards need:
// they read selectors, property names and values, never a full syntax tree.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { SURFACE_BUNDLES } from './surface-namespaces.mjs'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Blank every comment but keep its newlines, so offsets and line numbers survive. */
export const blankComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

/**
 * Walk a stylesheet into blocks. Each block is `{ prelude, context, decls, line }`:
 * `prelude` is the selector list or at-rule prelude, `context` lists the enclosing
 * preludes from the outside in, and `decls` holds the block's own declarations as
 * `{ prop, value, line }` (nested blocks are reported separately). Statements outside
 * any block (`@import`, `@layer a, b;`) are returned in `statements`.
 *
 * @param {string} text
 * @returns {{ blocks: Array<{prelude: string, context: string[], decls: Array<{prop: string, value: string, line: number}>, line: number}>, statements: Array<{text: string, line: number}> }}
 */
export function walkCss(text) {
  const css = blankComments(text)
  const blocks = []
  const statements = []
  const stack = []
  let cur = ''
  let line = 1
  let depthParen = 0
  let quote = null
  const pushDecl = () => {
    const raw = cur.trim()
    if (!raw) return
    const lineOf = line - (cur.slice(cur.search(/\S|$/)).split('\n').length - 1)
    if (stack.length === 0) {
      statements.push({ text: raw.replace(/\s+/g, ' '), line: lineOf })
      return
    }
    const ci = raw.indexOf(':')
    if (raw.startsWith('@') || ci === -1) return
    stack[stack.length - 1].decls.push({
      prop: raw.slice(0, ci).trim().toLowerCase(),
      value: raw.slice(ci + 1).trim().replace(/\s+/g, ' '),
      line: lineOf,
    })
  }
  for (let i = 0; i < css.length; i++) {
    const c = css[i]
    if (c === '\n') line++
    if (quote) {
      if (c === '\\') { cur += c + (css[i + 1] ?? ''); i++; continue }
      if (c === quote) quote = null
      cur += c
      continue
    }
    if (c === '"' || c === "'") { quote = c; cur += c; continue }
    if (c === '(') depthParen++
    if (c === ')') depthParen = Math.max(0, depthParen - 1)
    if (depthParen > 0) { cur += c; continue }
    if (c === '{') {
      const prelude = cur.trim().replace(/\s+/g, ' ')
      const startLine = line - (cur.slice(cur.search(/\S|$/)).split('\n').length - 1)
      stack.push({ prelude, context: stack.map((f) => f.prelude), decls: [], line: startLine })
      cur = ''
      continue
    }
    if (c === ';') { pushDecl(); cur = ''; continue }
    if (c === '}') {
      pushDecl()
      cur = ''
      const frame = stack.pop()
      if (frame) blocks.push(frame)
      continue
    }
    cur += c
  }
  return { blocks, statements }
}

/** True when the block sits inside `@media (prefers-reduced-motion: no-preference)`. */
export const inMotionAllowed = (context) => context.some((p) => /^@media\b[^{]*prefers-reduced-motion\s*:\s*no-preference/.test(p))

/** True for a style rule (not an at-rule or a keyframe stop). */
export const isStyleRule = (block) =>
  !block.prelude.startsWith('@') && !block.context.some((p) => p.startsWith('@keyframes') || p.startsWith('@font-face'))

/**
 * Every source stylesheet that ships in the package: the four bundle entries
 * (src/lib-components.css and src/lib-<surface>.css per SURFACE_BUNDLES) plus every
 * local sheet they reach through `@import`. Derived, not listed, so a new imported
 * sheet is scanned the moment it ships.
 *
 * @returns {string[]} repo-relative paths, entry order then import order
 */
export function shippedSourceSheets() {
  const entries = ['src/lib-components.css', ...SURFACE_BUNDLES.map((b) => `src/lib-${b.surface}.css`)]
  const seen = new Set()
  const out = []
  const visit = (rel) => {
    if (seen.has(rel)) return
    seen.add(rel)
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) throw new Error(`css-source: ${rel} is imported by a shipped bundle but does not exist; fix the @import path`)
    out.push(rel)
    for (const { text } of walkCss(readFileSync(abs, 'utf8')).statements) {
      const m = text.match(/^@import\s+(?:url\()?\s*["']([^"']+)["']/)
      if (!m || !m[1].startsWith('.')) continue
      visit(relative(ROOT, resolve(dirname(abs), m[1])))
    }
  }
  for (const entry of entries) visit(entry)
  return out
}

/** Parse exactly one strict YAML mapping document with unique keys. */
export function loadStrictYaml(relativePath) {
  const source = readFileSync(join(ROOT, relativePath), 'utf8')
  const documents = YAML.parseAllDocuments(source, { strict: true, uniqueKeys: true })
  if (documents.length !== 1) throw new Error(`${relativePath}: expected exactly one YAML document`)
  const [document] = documents
  if (document.errors.length > 0) throw new Error(`${relativePath}: invalid YAML: ${document.errors.map((e) => e.message).join('; ')}`)
  const value = document.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${relativePath}: the document root must be a mapping`)
  return value
}

/** The names in `actual` must be unique and equal the required set exactly. */
export function assertExactNames(actual, required, label) {
  if (!Array.isArray(required) || required.some((n) => typeof n !== 'string' || n.length === 0)) {
    throw new Error(`${label}: the manifest must list non-empty names`)
  }
  const seen = new Set(actual)
  if (seen.size !== actual.length) throw new Error(`${label}: duplicate names`)
  const missing = required.filter((n) => !seen.has(n))
  const extra = actual.filter((n) => !required.includes(n))
  if (missing.length || extra.length) {
    throw new Error(`${label}: names differ from the required-name manifest; missing=${JSON.stringify(missing)} unexpected=${JSON.stringify(extra)}`)
  }
}

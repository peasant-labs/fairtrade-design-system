#!/usr/bin/env node
/* Breakpoint-scale guard for every stylesheet under src/.
   ────────────────────────────────────────────────────────────────────────────
   The documented scale is four token values (src/index.css): --bp-sm 480px,
   --bp-md 768px, --bp-lg 1024px, --bp-xl 1440px. CSS cannot read a var() in an
   @media prelude, so the numbers are repeated in every viewport query and this
   guard is the only thing that keeps them on the scale. It reads the four tokens
   and fails on any length in a viewport `@media` condition that is neither a
   scale px value nor a declared exception.

   Subject: viewport `@media` conditions and the media condition of an `@import`
   statement. A container query (`@container (width < 30rem)`) measures its own
   container, not the viewport, so its numbers follow the component's geometry and
   are out of scope here. The prelude test is case-insensitive, and a condition
   measured in any unit other than a lower-case `px` is reported rather than passed
   over: the tokens are px numbers, so the guard cannot check `90ch`, `16pt` or `5vw`.

   Checks (each violation names its check id):
     off-scale          a px width that is not one of the four scale values.
     boundary-minus-one a px width exactly one below a scale value (479/767/1023/
                        1439): the retired `max-width` habit. The single-sided
                        form names the boundary instead.
     descriptor-form    a viewport condition written with `min-width:` /
                        `max-width:` (or the height twins) instead of the
                        single-sided comparison form.
     inclusive-bound    an upper bound written `width <= Npx`, which includes N
                        and so behaves like the retired `max-width` form.
     non-scale-unit     a viewport condition measured in a unit other than px
                        (`rem`/`em`/`ch`/`pt`/`vw`, any case), which the px scale
                        cannot check.

   Declared exceptions live in scripts/testdata/breakpoints.yaml with their
   required names in breakpoints.manifest.yaml. The list only shrinks: an entry
   whose condition no longer raises a violation fails the guard, so a fixed
   query must leave the list. One fixture entry per (file, condition); the key is
   the file and the condition text, so an `@import` entry names the media condition
   after the imported url (`screen and (max-width: 719px)`), not the whole statement.

   Wired into `build:lib`; runnable standalone via `node scripts/breakpoint-scale.mjs`. */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, walkCss, loadStrictYaml, assertExactNames } from './css-source.mjs'

const TOKEN_SHEET = 'src/index.css'
const TOKEN_NAMES = ['--bp-sm', '--bp-md', '--bp-lg', '--bp-xl']
const FIXTURE = 'scripts/testdata/breakpoints.yaml'
const MANIFEST = 'scripts/testdata/breakpoints.manifest.yaml'
const EXCEPTION_FIELDS = ['name', 'file', 'condition', 'reason']

/** The scale the queries must use, read from the token block (never duplicated here). */
export function loadScale(css = readFileSync(join(ROOT, TOKEN_SHEET), 'utf8')) {
  const byName = {}
  for (const name of TOKEN_NAMES) {
    const m = css.match(new RegExp(`${name}\\s*:\\s*(\\d+(?:\\.\\d+)?)px\\s*;`))
    if (!m) {
      throw new Error(
        `${TOKEN_SHEET}: the breakpoint token ${name} is missing, or is not a px length. ` +
          `What went wrong: the guard reads the scale from the four --bp-* tokens and cannot derive it. ` +
          `How to fix: restore \`${name}: <px>;\` in that sheet's token block, or update ${TOKEN_NAMES.join(', ')} here and every viewport query together.`,
      )
    }
    byName[name] = Number(m[1])
  }
  const values = TOKEN_NAMES.map((n) => byName[n])
  if (new Set(values).size !== values.length) {
    throw new Error(`${TOKEN_SHEET}: the breakpoint tokens ${TOKEN_NAMES.join(', ')} must hold four distinct widths, got ${values.join(', ')}`)
  }
  return { byName, values: [...values].sort((a, b) => a - b) }
}

/* The unit group matches ANY alpha token, case-insensitively, so an upper-case `719PX` is read as a
   px length (and then checked against the scale) and `90ch` / `16pt` / `5vw` are read as units the
   guard cannot check, instead of escaping the scan entirely. */
const LENGTH = /(\d+(?:\.\d+)?)([a-z]+)\b/gi
const DESCRIPTOR = /\b(min-width|max-width|min-height|max-height)\s*:\s*(\d+(?:\.\d+)?)([a-z]+)\b/gi
const INCLUSIVE_UPPER = /\bwidth\s*<=\s*(\d+(?:\.\d+)?)([a-z]+)\b/gi

/** True for a prelude the guard lints as a viewport media query (case-insensitive: `@MEDIA` too). */
export const isViewportMedia = (prelude) => /^@media\b/i.test(prelude)

/**
 * The media condition an `@import` statement carries (the query list after the imported url), or
 * '' when the statement has none. A `layer()`/`supports()` clause, if present, stays in the returned
 * text: the guard only reads lengths from it, and the reported condition stays the bytes as written.
 *
 * @param {string} statement  one statement from walkCss (`@import …`, no trailing semicolon)
 * @returns {string}
 */
export function importCondition(statement) {
  const m = statement.match(/^@import\b([\s\S]*)$/i)
  if (!m) return ''
  let rest = m[1].trim()
  const url = rest.match(/^url\(\s*(?:["'][^"']*["']|[^)"']*)\s*\)\s*/i)
  const str = rest.match(/^["'][^"']*["']\s*/)
  if (url) rest = rest.slice(url[0].length)
  else if (str) rest = rest.slice(str[0].length)
  else return ''
  return rest.trim()
}

/**
 * Every violation in one viewport media condition. Exported so the case fixtures and
 * the mutation test feed synthetic preludes through the same code the build runs.
 *
 * @param {string} prelude  the `@media …` prelude as walkCss reports it, or the media condition of
 *                          an `@import` statement as importCondition returns it
 * @param {{values: number[], byName: Record<string, number>}} scale
 * @returns {Array<{check: string, message: string}>}
 */
export function lintViewportQuery(prelude, scale) {
  const out = []
  const boundaryFor = (n) => Object.entries(scale.byName).find(([, v]) => v === n + 1)

  for (const m of prelude.matchAll(DESCRIPTOR)) {
    out.push({
      check: 'descriptor-form',
      message: `\`${m[1]}: ${m[2]}${m[3]}\` is the retired descriptor form; write the single-sided comparison instead (e.g. \`(width < 768px)\`), or a band \`(480px <= width < 768px)\` when the rule truly targets one band`,
    })
  }

  for (const m of prelude.matchAll(INCLUSIVE_UPPER)) {
    out.push({
      check: 'inclusive-bound',
      message: `\`width <= ${m[1]}${m[2]}\` includes that width itself; the canonical upper bound is exclusive, so write \`(width < ${m[1]}${m[2]})\``,
    })
  }

  for (const m of prelude.matchAll(LENGTH)) {
    if (m[2].toLowerCase() !== 'px') {
      out.push({
        check: 'non-scale-unit',
        message: `\`${m[0]}\` measures a viewport condition in ${m[2]}; every condition names one of the four --bp-* px values (${scale.values.join(' / ')}), so write the px value, or declare the exception in ${FIXTURE} with its reason`,
      })
      continue
    }
    const value = Number(m[1])
    if (scale.values.includes(value)) continue
    const boundary = boundaryFor(value)
    if (boundary) {
      out.push({
        check: 'boundary-minus-one',
        message: `the width ${m[1]}px is exactly one below ${boundary[0]} (${value + 1}px); name the boundary itself, \`(width < ${value + 1}px)\``,
      })
      continue
    }
    out.push({
      check: 'off-scale',
      message: `${m[1]}px is not on the --bp-* scale (${scale.values.join(' / ')}); pick the band boundary the rule means, or declare the exception in ${FIXTURE} with its reason`,
    })
  }
  return out
}

/** Every stylesheet under src/, repo-relative and sorted. */
export function sourceSheets(dir = 'src') {
  const out = []
  for (const name of readdirSync(join(ROOT, dir)).sort()) {
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...sourceSheets(rel))
    else if (name.endsWith('.css')) out.push(rel)
  }
  return out
}

/** The declared exceptions, validated: a name, a file that exists, a reason. */
export function loadExceptions() {
  const doc = loadStrictYaml(FIXTURE)
  if (!Array.isArray(doc.exceptions)) throw new Error(`${FIXTURE}: \`exceptions\` must be a list (leave it empty when every query is on the scale)`)
  const manifest = loadStrictYaml(MANIFEST)
  for (const e of doc.exceptions) {
    const bad = Object.keys(e).filter((k) => !EXCEPTION_FIELDS.includes(k))
    const missing = EXCEPTION_FIELDS.filter((f) => typeof e[f] !== 'string' || !e[f])
    if (bad.length || missing.length) {
      throw new Error(`${FIXTURE}: entry ${JSON.stringify(e)} has unknown fields ${JSON.stringify(bad)} and missing/empty fields ${JSON.stringify(missing)}; every entry is {name, file, condition, reason}`)
    }
    if (!sourceSheets().includes(e.file)) {
      throw new Error(`${FIXTURE}: entry "${e.name}" names ${e.file}, which is not a stylesheet under src/; point it at the sheet that holds the condition`)
    }
  }
  assertExactNames(doc.exceptions.map((e) => e.name), manifest.requiredExceptionNames, `${MANIFEST} requiredExceptionNames`)
  return doc.exceptions
}

/**
 * The whole guard: lint every viewport media query under src/ (both `@media` blocks and the media
 * condition of an `@import` statement) against the scale, split into fresh violations and exceptions
 * that no longer apply. The build runs it with no arguments; the mutation test passes planted texts
 * through the same code path.
 */
export function checkBreakpoints(overrides = {}) {
  const scale = loadScale()
  const exceptions = loadExceptions()
  const exempt = new Set(exceptions.map((e) => `${e.file}\u0000${e.condition}`))
  const used = new Set()
  const fresh = []
  const report = (violations, file, line, condition) => {
    const key = `${file}\u0000${condition}`
    if (exempt.has(key)) {
      used.add(key)
      return
    }
    for (const v of violations) {
      fresh.push({ ...v, file, line, prelude: condition, message: `${file}:${line}  [${v.check}] \`${condition}\`: ${v.message}` })
    }
  }
  for (const file of sourceSheets()) {
    const text = overrides[file] ?? readFileSync(join(ROOT, file), 'utf8')
    const { blocks, statements } = walkCss(text)
    for (const block of blocks) {
      if (!isViewportMedia(block.prelude)) continue
      const violations = lintViewportQuery(block.prelude, scale)
      if (!violations.length) continue
      report(violations, file, block.line, block.prelude)
    }
    for (const statement of statements) {
      if (!/^@import\b/i.test(statement.text)) continue
      const condition = importCondition(statement.text)
      if (!condition) continue
      const violations = lintViewportQuery(condition, scale)
      if (!violations.length) continue
      report(violations, file, statement.line, condition)
    }
  }
  const stale = exceptions.filter((e) => !used.has(`${e.file}\u0000${e.condition}`))
  return { scale, exceptions, fresh, stale }
}

/** The guard report (null when clean), in the shipped-guard voice. */
export function runBreakpointGuard(overrides = {}) {
  const { exceptions, fresh, stale } = checkBreakpoints(overrides)
  if (!fresh.length && !stale.length) return { report: null, exceptions }
  const report = [
    'Breakpoint scale FAILED in scripts/breakpoint-scale.mjs.',
    ...(fresh.length
      ? ['What went wrong: a viewport @media condition is off the documented --bp-* scale:', ...fresh.map((v) => `  - ${v.message}`)]
      : []),
    ...(stale.length
      ? [`What went wrong: ${FIXTURE} lists exceptions that no longer raise a violation (the query was fixed); delete them:`, ...stale.map((e) => `  - ${JSON.stringify(e)}`)]
      : []),
    'Why it matters: the scale is the one vocabulary every surface adapts at, so a query on its own width breaks just above another boundary that the rest of the system already handled.',
    `Where: the file:line above, in the stylesheets under src/ (the shipped sheets and the presentation site's own sheet; the scale is read from ${TOKEN_SHEET}).`,
    'When: at build:lib and prepack, before the library bundles are emitted.',
    'How to fix: rewrite the condition with a --bp-* value (480 / 768 / 1024 / 1440), or add a {name, file, condition, reason} entry to ' +
      `${FIXTURE} plus its name in ${MANIFEST} for a rule that genuinely cannot use the scale.`,
  ].join('\n')
  return { report, exceptions }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const { report, exceptions } = runBreakpointGuard()
  if (report) throw new Error(report)
  console.log(`breakpoint scale: every viewport @media query under src/ sits on 480 / 768 / 1024 / 1440 (${exceptions.length} declared exception(s)).`)
}

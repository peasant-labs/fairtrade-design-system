// @ts-check

// Tracked-source writer scanner for the parallel library gate.
//
// A test that rewrites a file under src/ must run in the exclusive
// source-mutation lane: another gate reading the half-applied tree would see a
// mutation, not the production source. The previous scan matched two literal
// identifiers in scripts/*.test.mjs, so a new writer using a different constant
// or a join/resolve form could run concurrently with a reader.
//
// This scanner resolves the write target instead of matching a name:
//   - a string or template literal with a `src` path segment;
//   - an identifier assigned from such a literal or from a join/resolve call;
//   - a transitive alias, e.g. `realPath = resolve(GRAPH_DIR, file)` where
//     GRAPH_DIR already resolves under src/;
//   - either path argument of rename/copy, because the destination is the write.
// A scratch copy rooted at mkdtemp/tmpdir is deliberately not a tracked write,
// even when its copied subtree contains a `src/` segment. The scanner does not
// execute the module, so a computed target that no static assignment describes
// remains a documented limitation.

import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

/** @typedef {{ callee: string, line: number }} WriteSite */
/** @typedef {{ file: string, sites: WriteSite[] }} FileWrites */

const WRITE_CALLEES = /** @type {const} */ ([
  'writeFile',
  'writeFileSync',
  'appendFile',
  'appendFileSync',
  'rename',
  'renameSync',
  'copyFile',
  'copyFileSync',
])

// rename and copy write to their second argument; the others write to the first.
const DESTINATION_ARGUMENTS = new Map([
  ['writeFile', [0]],
  ['writeFileSync', [0]],
  ['appendFile', [0]],
  ['appendFileSync', [0]],
  ['rename', [0, 1]],
  ['renameSync', [0, 1]],
  ['copyFile', [0, 1]],
  ['copyFileSync', [0, 1]],
])

const BASE_REPO_IDENTIFIERS = new Set(['ROOT', 'HERE', 'FAIRTEST_REPO_ROOT'])
const SCRATCH_RE = /\b(?:mkdtempSync|mkdtemp|tmpdir)\s*\(/

// This test carries synthetic writer source in strings; the real repository
// scan must not read its own fixture text as a writer.
export const SCANNER_TEST_BASENAME = 'test-lib-source-scan.test.mjs'

/**
 * Skip a quoted string or template literal.
 * @param {string} source module source
 * @param {number} start index of the opening quote
 * @returns {number} index of the closing quote, or the end of the source
 */
function skipQuoted(source, start) {
  const quote = source[start]
  let index = start + 1
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2
      continue
    }
    if (source[index] === quote) return index
    index += 1
  }
  return source.length
}

/**
 * Read the argument list of a call whose opening parenthesis is at `open`.
 * @param {string} source module source
 * @param {number} open index of `(`
 * @returns {string[] | null} top-level argument expressions, or null when unbalanced
 */
function callArguments(source, open) {
  /** @type {string[]} */
  const args = []
  let depth = 0
  let start = open + 1
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]
    if (char === '"' || char === "'" || char === '`') {
      index = skipQuoted(source, index)
      continue
    }
    if (char === '(' || char === '[' || char === '{') {
      depth += 1
      continue
    }
    if (char === ')' || char === ']' || char === '}') {
      depth -= 1
      if (depth === 0 && char === ')') {
        args.push(source.slice(start, index))
        return args
      }
      continue
    }
    if (char === ',' && depth === 1) {
      args.push(source.slice(start, index))
      start = index + 1
    }
  }
  return null
}

/**
 * Read an assignment expression from after `=` to the statement end at depth 0.
 * @param {string} source module source
 * @param {number} from index after the `=`
 * @returns {string} expression text
 */
function assignmentExpression(source, from) {
  let depth = 0
  for (let index = from; index < source.length; index += 1) {
    const char = source[index]
    if (char === '"' || char === "'" || char === '`') {
      index = skipQuoted(source, index)
      continue
    }
    if (char === '(' || char === '[' || char === '{') depth += 1
    else if (char === ')' || char === ']' || char === '}') depth -= 1
    else if (depth === 0 && (char === ';' || char === '\n')) return source.slice(from, index)
  }
  return source.slice(from)
}

/**
 * Collect simple `const|let|var NAME = expression` assignments.
 * @param {string} source module source
 * @returns {Map<string, string>} name to expression
 */
function assignments(source) {
  /** @type {Map<string, string>} */
  const found = new Map()
  for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*/g)) {
    const name = match[1]
    const from = match.index + match[0].length
    const expression = assignmentExpression(source, from).trim()
    if (expression) found.set(name, expression)
  }
  return found
}

/**
 * Whether a literal in the expression names a `src` path segment.
 * @param {string} expression expression text
 * @returns {boolean} true when a string or template literal carries `src`
 */
function hasSrcLiteral(expression) {
  for (const match of expression.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    if (/(?:^|[/\\])src(?:[/\\]|$)/.test(match[2])) return true
  }
  return false
}

/**
 * Whether a literal is a path relative to the repository (or a src/ path).
 * @param {string} expression expression text
 * @returns {boolean} true when the literal is repository-rooted
 */
function relativeRepoLiteral(expression) {
  return /^(['"`])(?:\.{1,2}[/\\]|src[/\\])/.test(expression.trim())
}

/**
 * First argument of the first join/resolve call in an expression.
 * @param {string} expression expression text
 * @returns {string | null} first argument, or null when there is no call
 */
function firstJoinArgument(expression) {
  const match = /\b(?:join|resolve)\s*\(/.exec(expression)
  if (!match) return null
  const open = match.index + match[0].length - 1
  return callArguments(expression, open)?.[0] ?? null
}

/**
 * Whether an expression is rooted at the repository rather than a scratch dir.
 * @param {string} expression target expression
 * @param {Set<string>} repoIds identifiers known to be repository-rooted
 * @param {Set<string>} scratchIds identifiers known to be scratch roots
 * @returns {boolean} true when the path is repository-rooted
 */
function repoRooted(expression, repoIds, scratchIds) {
  const text = expression.trim()
  if (!text) return false
  const bare = /^[A-Za-z_$][\w$]*$/.exec(text)
  if (bare) return repoIds.has(bare[0])
  if (relativeRepoLiteral(text)) return true
  const first = firstJoinArgument(text)
  if (first === null) return false
  const argument = first.trim()
  const argumentIdentifier = /^[A-Za-z_$][\w$]*$/.exec(argument)
  if (argumentIdentifier) {
    if (scratchIds.has(argumentIdentifier[0])) return false
    return repoIds.has(argumentIdentifier[0])
  }
  if (SCRATCH_RE.test(argument)) return false
  return repoRooted(argument, repoIds, scratchIds)
}

/**
 * Whether an expression names any `src` segment, directly or through an alias.
 * @param {string} expression expression text
 * @param {Set<string>} srcIds identifiers known to resolve under src/
 * @returns {boolean} true when the expression names src/
 */
function namesSrc(expression, srcIds) {
  if (hasSrcLiteral(expression)) return true
  for (const match of expression.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
    if (srcIds.has(match[0])) return true
  }
  return false
}

/**
 * Resolve scratch-root identifiers from mkdtemp/tmpdir assignments.
 * @param {Map<string, string>} sources assignments
 * @returns {Set<string>} identifiers that are scratch roots
 */
function scratchIdentifiers(sources) {
  /** @type {Set<string>} */
  const scratch = new Set()
  let changed = true
  while (changed) {
    changed = false
    for (const [name, expression] of sources) {
      if (scratch.has(name)) continue
      const bare = /^[A-Za-z_$][\w$]*$/.exec(expression)
      if (SCRATCH_RE.test(expression) || (bare && scratch.has(bare[0]))) {
        scratch.add(name)
        changed = true
      }
    }
  }
  return scratch
}

/**
 * Resolve repository and src-rooted identifiers to a fixed point.
 * @param {Map<string, string>} sources assignments
 * @param {Set<string>} scratchIds scratch-root identifiers
 * @returns {{ repoIds: Set<string>, srcIds: Set<string> }} resolved identifiers
 */
function sourceIdentifiers(sources, scratchIds) {
  const repoIds = new Set(BASE_REPO_IDENTIFIERS)
  /** @type {Set<string>} */
  const srcIds = new Set()
  let changed = true
  while (changed) {
    changed = false
    for (const [name, expression] of sources) {
      if (scratchIds.has(name)) continue
      if (!repoIds.has(name) && repoRooted(expression, repoIds, scratchIds)) {
        repoIds.add(name)
        changed = true
      }
      if (!srcIds.has(name) && namesSrc(expression, srcIds) && repoRooted(expression, repoIds, scratchIds)) {
        srcIds.add(name)
        changed = true
      }
    }
  }
  return { repoIds, srcIds }
}

/**
 * Find write-family calls in one module and whether their target is src/.
 * @param {string} source module source
 * @returns {WriteSite[]} write sites that resolve under src/
 */
export function scanSource(source) {
  const sources = assignments(source)
  const scratchIds = scratchIdentifiers(sources)
  const { repoIds, srcIds } = sourceIdentifiers(sources, scratchIds)
  const isTarget = (expression) => namesSrc(expression, srcIds) && repoRooted(expression, repoIds, scratchIds)
  /** @type {WriteSite[]} */
  const sites = []
  const pattern = new RegExp(`\\b(?:${WRITE_CALLEES.join('|')})\\s*\\(`, 'g')
  for (const match of source.matchAll(pattern)) {
    const open = match.index + match[0].length - 1
    const args = callArguments(source, open)
    if (!args) continue
    const callee = /[A-Za-z_$][\w$]*/.exec(match[0])?.[0]
    if (!callee) continue
    const destinations = DESTINATION_ARGUMENTS.get(callee) ?? []
    if (destinations.some((index) => isTarget(args[index] ?? ''))) {
      sites.push({ callee, line: source.slice(0, match.index).split('\n').length })
    }
  }
  return sites
}

/**
 * Walk every test module under scripts/ and report the ones that write src/.
 * @param {string} root repository root
 * @returns {FileWrites[]} sorted file writes
 */
export function scanTestFiles(root) {
  /** @type {FileWrites[]} */
  const writes = []
  /** @param {string} directory directory to walk */
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.isFile()) continue
      if (!/\.test\.(?:mjs|js)$/.test(entry.name)) continue
      if (basename(entry.name) === SCANNER_TEST_BASENAME) continue
      const sites = scanSource(readFileSync(path, 'utf8'))
      if (sites.length === 0) continue
      writes.push({ file: relative(root, path).split('\\').join('/'), sites })
    }
  }
  walk(join(root, 'scripts'))
  return writes.sort((left, right) => left.file.localeCompare(right.file))
}

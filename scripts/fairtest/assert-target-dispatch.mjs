// @ts-check

// Source guard: no app module outside the target-declaration and
// view-construction modules may branch on the host kind. The adapter and every
// shared module read behaviour from the target value's own fields (kind, id,
// capabilities, fixtures, actions), so a branch on the host kind there would
// mean a second discriminator that can disagree with the target.
//
// The detector is token-based, not a single regex, so the ordinary evasions of
// a text match are caught: the reversed comparison `'product' === target.kind`,
// the bracket access `target['kind'] === 'product'`, a parenthesized operand
// `(target.kind) === 'product'`, the `switch (target.kind)` whose body cases a
// kind literal, the array-membership test
// `['product','component'].includes(target.kind)`, a comparison through an
// alias (`const k = target.kind; k === 'product'`), and the same through a
// destructuring rename (`const { kind: k } = target; k === 'product'`).
// Comments and string contents are skipped, so a kind branch named only in
// prose is not a hit.
//
// Best-effort source scan: it does NOT catch every equivalent branch. A kind
// literal assembled at runtime is invisible: concatenation
// (`kind === 'pro' + 'duct'`), a kind substituted into template text (a
// substituted template contributes only its expressions, so `pro` + `${'duct'}`
// never reads as `product`), and a kind array held in a variable and probed
// with `.includes`/`.has`/`.indexOf` (the only recognized membership test is an
// inline array literal of kind strings probed with `.includes`) all elude it.
// A destructuring rename in a parameter position (`function pick({ kind: k })`)
// also eludes it: the alias collector only follows `const`/`let`/`var`
// bindings, so a name bound in a parameter list is not tracked as `kind`.
// Narrowing the guarantee is the honest claim: it catches the ordinary
// evasions, not an adversarial rewrite.
//
// Allowlist: only the modules that genuinely need to read the host kind are
// exempt. The two declaration modules own the kind literals; `run-mounted.mjs`
// is the CLI dispatcher that picks the mounted row and its precondition text by
// kind. The producers write the kind into an artifact as data, the journeys
// assert on a written proof, and fairtest-dev reads the kind as data without
// branching on it, so none of them needs an exemption and all are scanned.
//
// Browser-free: node builtins plus the declared yaml dependency. The named
// mutations live in scripts/testdata/fairtest-dispatch.yaml plus its
// required-name manifest; this file owns no case data. Required CI names this
// guard as its own command (`pnpm test:fairtest:dispatch`) in the browser-free
// contracts step, so the mount is the workflow line itself rather than a shell
// chain this file has to parse.

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative as relativePath, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSingleDocument } from '../fairtest-single-document.mjs'
import { fairtestPath, fairtestRelative } from './fairtest-paths.mjs'

/**
 * App modules allowed to read the host kind: the two target-declaration modules
 * that own the kind literals, and the mounted CLI dispatcher that picks its row
 * and precondition text by kind. Everything else must read the target value's
 * fields instead.
 * @type {readonly string[]}
 */
export const DISPATCH_ALLOWED_MODULES = Object.freeze([
  'fairtrade-targets.mjs',
  'fairtrade-component-target.mjs',
  'run-mounted.mjs',
])

const KIND_LITERALS = Object.freeze(['product', 'component'])
const COMPARISON_OPERATORS = Object.freeze(['===', '==', '!==', '!='])

/**
 * @typedef {object} Token
 * @property {'ident' | 'string' | 'punct' | 'number'} type
 * @property {string} value
 * @property {number} start
 * @property {number} end
 */

/**
 * Tokenize module source into a flat stream. Comments are dropped; a
 * substitution-free template literal becomes one string token carrying its
 * text, and a `${...}` expression inside a template is tokenized as code.
 * @param {string} source module source
 * @returns {Token[]} the tokens in source order
 */
export function tokenize(source) {
  /** @type {Token[]} */
  const tokens = []
  let index = 0
  const length = source.length
  while (index < length) {
    const character = source[index]
    if (character === ' ' || character === '\t' || character === '\r' || character === '\n') { index += 1; continue }
    if (character === '/' && source[index + 1] === '/') {
      while (index < length && source[index] !== '\n') index += 1
      continue
    }
    if (character === '/' && source[index + 1] === '*') {
      index += 2
      while (index < length && !(source[index] === '*' && source[index + 1] === '/')) index += 1
      index += 2
      continue
    }
    if (character === "'" || character === '"') {
      const start = index
      let value = ''
      index += 1
      while (index < length) {
        const inner = source[index]
        if (inner === '\\') { value += source[index + 1] ?? ''; index += 2; continue }
        if (inner === character) { index += 1; break }
        value += inner
        index += 1
      }
      tokens.push({ type: 'string', value, start, end: index })
      continue
    }
    if (character === '`') { index = readTemplate(source, index, tokens); continue }
    if (/[A-Za-z_$]/.test(character)) {
      const start = index
      while (index < length && /[A-Za-z0-9_$]/.test(source[index])) index += 1
      tokens.push({ type: 'ident', value: source.slice(start, index), start, end: index })
      continue
    }
    if (/[0-9]/.test(character)) {
      const start = index
      while (index < length && /[0-9a-fA-FxX._]/.test(source[index])) index += 1
      tokens.push({ type: 'number', value: source.slice(start, index), start, end: index })
      continue
    }
    const three = source.slice(index, index + 3)
    const two = source.slice(index, index + 2)
    let punct
    if (three === '===' || three === '!==' || three === '...') punct = three
    else if (['==', '!=', '=>', '?.', '&&', '||', '??', '<=', '>='].includes(two)) punct = two
    else punct = character
    tokens.push({ type: 'punct', value: punct, start: index, end: index + punct.length })
    index += punct.length
  }
  return tokens
}

/**
 * Read a template literal starting at `start`, appending the code tokens of any
 * `${...}` expression. A substitution-free template contributes one string
 * token with its text; a substituted template contributes only its expressions.
 * @param {string} source module source
 * @param {number} start index of the opening backtick
 * @param {Token[]} tokens token sink
 * @returns {number} the index just past the closing backtick
 */
function readTemplate(source, start, tokens) {
  let index = start + 1
  const length = source.length
  let text = ''
  let substituted = false
  while (index < length) {
    const character = source[index]
    if (character === '\\') { text += source[index + 1] ?? ''; index += 2; continue }
    if (character === '`') {
      if (!substituted) tokens.push({ type: 'string', value: text, start, end: index + 1 })
      return index + 1
    }
    if (character === '$' && source[index + 1] === '{') {
      substituted = true
      let depth = 1
      let cursor = index + 2
      const expressionStart = cursor
      while (cursor < length && depth > 0) {
        if (source[cursor] === '{') depth += 1
        else if (source[cursor] === '}') { depth -= 1; if (depth === 0) break }
        cursor += 1
      }
      const inner = source.slice(expressionStart, cursor)
      for (const token of tokenize(inner)) {
        tokens.push({ ...token, start: token.start + expressionStart, end: token.end + expressionStart })
      }
      index = cursor + 1
      continue
    }
    text += character
    index += 1
  }
  return index
}

/** @param {Token | undefined} token @returns {boolean} */
function isKindLiteral(token) {
  return !!token && token.type === 'string' && KIND_LITERALS.includes(token.value)
}

/** @param {Token[]} tokens @param {number} openIndex @returns {number} matching close index or -1 */
function findMatch(tokens, openIndex) {
  const open = tokens[openIndex]?.value
  const close = open === '(' ? ')' : open === '[' ? ']' : open === '{' ? '}' : null
  if (!close) return -1
  let depth = 0
  for (let index = openIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === open) depth += 1
    else if (tokens[index].value === close) {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

/** @param {Token[]} tokens @param {number} closeIndex @param {string} open @param {string} close @returns {number} */
function findOpen(tokens, closeIndex, open, close) {
  let depth = 0
  for (let index = closeIndex; index >= 0; index -= 1) {
    if (tokens[index].value === close) depth += 1
    else if (tokens[index].value === open) {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

/**
 * Report whether the expression ending at `index` yields a host kind: a
 * member access whose property is `kind`, a bracket access `['kind']`, a bare
 * `kind` identifier, or an identifier bound to one of those as an alias.
 * @param {Token[]} tokens
 * @param {number} index
 * @param {Set<string>} aliases
 * @returns {boolean}
 */
function isKindExprEndingAt(tokens, index, aliases) {
  const token = tokens[index]
  if (!token || token.type === 'string') return false
  if (token.value === ')') {
    const open = findOpen(tokens, index, '(', ')')
    if (open === -1) return false
    return isKindExprEndingAt(tokens, index - 1, aliases) && kindExprStartAt(tokens, index - 1) === open + 1
  }
  if (token.value === ']') {
    return tokens[index - 1]?.type === 'string' && tokens[index - 1].value === 'kind' && tokens[index - 2]?.value === '['
  }
  return token.type === 'ident' && (token.value === 'kind' || aliases.has(token.value))
}

/**
 * The index of the first token of the member expression ending at `index`, so a
 * diagnostic can quote the whole `target.kind` / `target['kind']` operand.
 * @param {Token[]} tokens
 * @param {number} index
 * @returns {number}
 */
function kindExprStartAt(tokens, index) {
  let start = index
  if (tokens[index]?.value === ')') {
    const open = findOpen(tokens, index, '(', ')')
    if (open === -1) return index
    start = open
  } else if (tokens[index]?.value === ']') {
    const open = findOpen(tokens, index, '[', ']')
    if (open === -1) return index
    start = open
    if (tokens[start - 1]?.type === 'ident') start -= 1
  }
  while (start >= 2 && (tokens[start - 1].value === '.' || tokens[start - 1].value === '?.') && tokens[start - 2].type === 'ident') {
    start -= 2
  }
  return start
}

/**
 * Report whether the expression starting at `start` yields a host kind.
 * @param {Token[]} tokens
 * @param {number} start
 * @param {Set<string>} aliases
 * @returns {boolean}
 */
function isKindExprStartingAt(tokens, start, aliases) {
  if (!tokens[start]) return false
  return isKindExprEndingAt(tokens, kindExprEndFromStart(tokens, start), aliases)
}

/**
 * Collect identifiers bound to a host kind: `const k = target.kind`, plus
 * chains of such bindings, resolved to a fixed point.
 * @param {Token[]} tokens
 * @returns {Set<string>}
 */
function collectKindAliases(tokens) {
  const aliases = new Set()
  for (let pass = 0; pass <= tokens.length; pass += 1) {
    let changed = false
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]
      if (!(token.type === 'ident' && (token.value === 'const' || token.value === 'let' || token.value === 'var'))) continue
      const name = tokens[index + 1]
      if (!name) continue
      if (name.value === '{') {
        for (const bound of destructuredKindBindings(tokens, index + 1)) {
          if (!aliases.has(bound)) {
            aliases.add(bound)
            changed = true
          }
        }
        continue
      }
      if (name.type !== 'ident' || tokens[index + 2]?.value !== '=') continue
      if (aliases.has(name.value)) continue
      if (isKindExprStartingAt(tokens, index + 3, aliases)) {
        aliases.add(name.value)
        changed = true
      }
    }
    if (!changed) break
  }
  return aliases
}

/**
 * The local names a destructuring binding renames the host-kind property to:
 * `const { kind: k } = target` binds `k` (which is `target.kind`). The property
 * must be literally `kind`; the initializer is not required to be a kind
 * expression because the property name is itself the kind selector. Shorthand
 * `{ kind }` binds `kind`, which the detector already treats as a kind read.
 * @param {Token[]} tokens
 * @param {number} openBrace index of the `{`
 * @returns {string[]} the renamed local names
 */
function destructuredKindBindings(tokens, openBrace) {
  /** @type {string[]} */
  const names = []
  const close = findMatch(tokens, openBrace)
  if (close === -1) return names
  for (let index = openBrace + 1; index < close; index += 1) {
    if (tokens[index]?.type === 'ident' && tokens[index].value === 'kind' && tokens[index + 1]?.value === ':' && tokens[index + 2]?.type === 'ident') {
      names.push(tokens[index + 2].value)
      index += 2
    }
  }
  return names
}

/**
 * The index of the last token of the member chain starting at `start`, so an
 * alias initializer and a reversed comparison can be tested as a whole.
 * @param {Token[]} tokens
 * @param {number} start
 * @returns {number}
 */
function kindExprEndFromStart(tokens, start) {
  let end = start
  if (tokens[start]?.value === '(') {
    const close = findMatch(tokens, start)
    if (close !== -1) end = close
  } else if (tokens[start]?.value === '[') {
    const close = findMatch(tokens, start)
    if (close !== -1) end = close
  }
  while ((tokens[end + 1]?.value === '.' || tokens[end + 1]?.value === '?.') && tokens[end + 2]?.type === 'ident') {
    end += 2
  }
  while (tokens[end + 1]?.value === '[' && tokens[end + 2]?.type === 'string' && tokens[end + 3]?.value === ']') {
    end += 3
  }
  return end
}

/** @param {string} source @param {Token[]} tokens @param {number} start @param {number} end @returns {string} */
function sliceSource(source, tokens, start, end) {
  return source.slice(tokens[start].start, tokens[end].end)
}

/**
 * Return every host-kind branch expression in a source string.
 * @param {string} source module source
 * @returns {string[]} the matched branch expressions
 */
export function findTargetKindDispatch(source) {
  const tokens = tokenize(source)
  const aliases = collectKindAliases(tokens)
  /** @type {string[]} */
  const hits = []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.type === 'punct' && COMPARISON_OPERATORS.includes(token.value)) {
      const leftKind = isKindExprEndingAt(tokens, index - 1, aliases)
      const rightKind = isKindExprStartingAt(tokens, index + 1, aliases)
      if (leftKind && isKindLiteral(tokens[index + 1])) {
        hits.push(sliceSource(source, tokens, kindExprStartAt(tokens, index - 1), index + 1))
      } else if (rightKind && isKindLiteral(tokens[index - 1])) {
        hits.push(sliceSource(source, tokens, index - 1, kindExprEndFromStart(tokens, index + 1)))
      }
    }
    if (token.type === 'ident' && token.value === 'switch') {
      const switchHit = matchSwitch(tokens, index, aliases)
      if (switchHit !== -1) hits.push(sliceSource(source, tokens, index, switchHit))
    }
    if (token.type === 'ident' && token.value === 'includes' && tokens[index - 1]?.value === '.') {
      const includesHit = matchIncludes(tokens, index, aliases)
      if (includesHit) hits.push(sliceSource(source, tokens, includesHit.start, includesHit.end))
    }
  }
  return hits
}

/** @param {Token[]} tokens @param {number} switchIndex @param {Set<string>} aliases @returns {number} case-literal index or -1 */
function matchSwitch(tokens, switchIndex, aliases) {
  if (tokens[switchIndex + 1]?.value !== '(') return -1
  const closeParen = findMatch(tokens, switchIndex + 1)
  if (closeParen === -1) return -1
  let discriminant = false
  for (let index = switchIndex + 2; index < closeParen; index += 1) {
    if (isKindExprEndingAt(tokens, index, aliases)) discriminant = true
  }
  if (!discriminant) return -1
  let bodyOpen = -1
  for (let index = closeParen + 1; index < tokens.length; index += 1) {
    if (tokens[index].value === '{') { bodyOpen = index; break }
    if (tokens[index].value === ';' || tokens[index].value === '}') break
  }
  if (bodyOpen === -1) return -1
  const bodyClose = findMatch(tokens, bodyOpen)
  if (bodyClose === -1) return -1
  for (let index = bodyOpen + 1; index < bodyClose; index += 1) {
    if (tokens[index].value === 'case' && isKindLiteral(tokens[index + 1])) return index + 1
  }
  return -1
}

/** @param {Token[]} tokens @param {number} includesIndex @param {Set<string>} aliases @returns {{ start: number, end: number } | null} */
function matchIncludes(tokens, includesIndex, aliases) {
  const receiverEnd = includesIndex - 2
  if (tokens[receiverEnd]?.value !== ']') return null
  const receiverOpen = findOpen(tokens, receiverEnd, '[', ']')
  if (receiverOpen === -1) return null
  let hasKindLiteral = false
  for (let index = receiverOpen + 1; index < receiverEnd; index += 1) {
    if (isKindLiteral(tokens[index])) hasKindLiteral = true
  }
  if (!hasKindLiteral) return null
  if (tokens[includesIndex + 1]?.value !== '(') return null
  const argumentClose = findMatch(tokens, includesIndex + 1)
  if (argumentClose === -1) return null
  for (let index = includesIndex + 2; index < argumentClose; index += 1) {
    if (isKindExprEndingAt(tokens, index, aliases)) return { start: receiverOpen, end: argumentClose }
  }
  return null
}

/**
 * Assert no app module under the directory branches on the host kind outside
 * the allowed declaration and view-construction modules. The walk is
 * recursive, so a branch in a subdirectory is caught. Test and type-test files
 * are skipped: their `.kind === '…'` comparisons are fixture-mutation
 * discriminators, not host-kind dispatch.
 * @param {string} directory directory holding the app modules
 * @param {readonly string[]} [allowed] allowed module basenames
 * @returns {{ scanned: string[] }} the modules scanned
 */
export function assertNoTargetKindDispatch(directory, allowed = DISPATCH_ALLOWED_MODULES) {
  const violations = []
  const scanned = []
  for (const file of walkModules(directory)) {
    const name = basename(file)
    if (name === 'assert-target-dispatch.mjs' || allowed.includes(name) || name.endsWith('.test.mjs') || name.endsWith('.type-test.mjs')) continue
    const display = relativePath(directory, file).split(sep).join('/')
    scanned.push(display)
    const hits = findTargetKindDispatch(readFileSync(file, 'utf8'))
    if (hits.length > 0) {
      violations.push(`${display} branches on the host kind: ${hits.join(', ')}`)
    }
  }
  if (violations.length > 0) {
    throw new Error(
      'fairtest target dispatch: host-kind branch outside the declaration and view-construction modules at path dispatch; ' +
      `${violations.join('; ')}; ` +
      "repair: read the kind, id, capabilities, fixtures, and actions from the target value's own fields instead of branching on kind.",
    )
  }
  return { scanned }
}

/**
 * Every `.mjs` module under a directory, recursively, sorted.
 * @param {string} directory absolute directory
 * @returns {string[]} absolute module paths
 */
function walkModules(directory) {
  /** @type {string[]} */
  const found = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...walkModules(absolute))
    else if (entry.isFile() && entry.name.endsWith('.mjs')) found.push(absolute)
  }
  return found.sort()
}

/** @typedef {object} DispatchMutation
 * @property {string} name
 * @property {string} kind
 * @property {string} [source]
 * @property {boolean} [nested]
 * @property {string} expectedDiagnostic */

/**
 * Load the reach corpus and prove each detection form and each evasion
 * mutation. The guard owns no case data; every case and mutation comes from
 * scripts/testdata/fairtest-dispatch.yaml plus its required-name manifest.
 */
function runDispatchReach() {
  const corpusRel = fairtestRelative('dispatchCorpus')
  const manifestRel = fairtestRelative('dispatchManifest')
  const manifest = /** @type {{ expectedDetectionCaseCount: number, requiredDetectionCaseNames: string[], expectedMutationCount: number, requiredMutationNames: string[], mutations: DispatchMutation[] }} */ (loadSingleDocument(readFileSync(fairtestPath('dispatchManifest'), 'utf8'), manifestRel))
  const corpus = /** @type {{ detectionCases: { name: string, source: string, expect: string, expectedExpression: string }[] }} */ (loadSingleDocument(readFileSync(fairtestPath('dispatchCorpus'), 'utf8'), corpusRel))
  validateCorpus(corpus, corpusRel)
  validateManifest(manifest, manifestRel)
  const names = corpus.detectionCases.map((entry) => entry.name)
  assert.deepEqual([...names].sort(), [...manifest.requiredDetectionCaseNames].sort(), `${corpusRel}: detection case inventory mismatch`)
  assert.equal(names.length, manifest.expectedDetectionCaseCount, `${corpusRel}: detection case count must equal expectedDetectionCaseCount`)
  for (const entry of corpus.detectionCases) {
    const hits = findTargetKindDispatch(entry.source)
    if (entry.expect === 'detected') {
      assert.ok(
        hits.some((hit) => hit.includes(entry.expectedExpression)),
        `${corpusRel}: detection case "${entry.name}" did not report ${JSON.stringify(entry.expectedExpression)}; got ${JSON.stringify(hits)}`,
      )
    } else {
      assert.equal(hits.length, 0, `${corpusRel}: detection case "${entry.name}" is expected clean but reported ${JSON.stringify(hits)}`)
    }
  }
  for (const mutation of manifest.mutations) {
    let message = null
    try {
      const directory = mkdtempSync(join(tmpdir(), 'fairtest-dispatch-mutation-'))
      try {
        let target = directory
        if (mutation.nested) {
          target = join(directory, 'nested')
          mkdirSync(target, { recursive: true })
        }
        writeFileSync(join(target, 'planted.mjs'), /** @type {string} */ (mutation.source))
        assertNoTargetKindDispatch(directory)
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.ok(message, `${mutation.name}: mutated input passed validation instead of failing`)
    assert.ok(message.includes(mutation.expectedDiagnostic), `${mutation.name}: diagnostic does not name ${mutation.expectedDiagnostic}; received ${message}`)
    assert.ok(message.includes('at path'), `${mutation.name}: diagnostic is missing path context: ${message}`)
    assert.ok(message.includes('repair:'), `${mutation.name}: diagnostic is missing repair guidance: ${message}`)
  }
  return { detectionCases: corpus.detectionCases.length, mutations: manifest.mutations.length }
}

/** @param {unknown} value @param {string} label @returns {void} */
function validateCorpus(value, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label}: document root must be a record at path document`)
  const record = /** @type {Record<string, unknown>} */ (value)
  assert.deepEqual(Object.keys(record).sort(), ['detectionCases'], `${label}: exact field mismatch at path document`)
  const cases = record.detectionCases
  assert.ok(Array.isArray(cases) && cases.length > 0, `${label}: document holds no detection cases at path detectionCases; repair: restore the named case list.`)
  for (const [index, entry] of cases.entries()) {
    const path = `detectionCases[${index}]`
    assert.ok(entry && typeof entry === 'object' && !Array.isArray(entry), `${label}: detection case ${index} must be a record at path ${path}`)
    const fields = entry.expect === 'detected' ? ['name', 'source', 'expect', 'expectedExpression'] : ['name', 'source', 'expect']
    assert.deepEqual(Object.keys(entry).sort(), [...fields].sort(), `${label}: detection case ${index} exact field mismatch at path ${path}`)
    assert.ok(typeof entry.name === 'string' && entry.name.trim().length > 0, `${label}: detection case ${index} is missing a name at path ${path}.name`)
    assert.ok(typeof entry.source === 'string' && entry.source.length > 0, `${label}: detection case "${entry.name}" is missing source at path ${path}.source`)
    assert.ok(['detected', 'clean'].includes(entry.expect), `${label}: detection case "${entry.name}" has an unknown expect at path ${path}.expect`)
  }
}

/** @param {unknown} value @param {string} label @returns {void} */
function validateManifest(value, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label}: manifest root must be a record at path manifest`)
  const record = /** @type {Record<string, unknown>} */ (value)
  assert.deepEqual(
    Object.keys(record).sort(),
    ['expectedDetectionCaseCount', 'expectedMutationCount', 'mutations', 'requiredDetectionCaseNames', 'requiredMutationNames'],
    `${label}: exact field mismatch at path manifest`,
  )
  assert.equal(record.expectedDetectionCaseCount, /** @type {string[]} */ (record.requiredDetectionCaseNames).length, `${label}: expectedDetectionCaseCount must equal requiredDetectionCaseNames.length`)
  const mutations = /** @type {DispatchMutation[]} */ (record.mutations)
  assert.ok(Array.isArray(mutations) && mutations.length > 0, `${label}: manifest holds no mutations at path manifest.mutations`)
  assert.equal(record.expectedMutationCount, mutations.length, `${label}: expectedMutationCount must equal mutations.length`)
  assert.deepEqual(mutations.map((entry) => entry.name).sort(), [.../** @type {string[]} */ (record.requiredMutationNames)].sort(), `${label}: mutation name inventory mismatch`)
  for (const [index, mutation] of mutations.entries()) {
    const path = `mutations[${index}]`
    const fields = ['name', 'kind', 'source', 'expectedDiagnostic']
    if (mutation.nested) fields.push('nested')
    assert.deepEqual(Object.keys(mutation).sort(), [...fields].sort(), `${label}: mutation ${index} exact field mismatch at path ${path}`)
    assert.equal(mutation.kind, 'plant-source', `${label}: mutation "${mutation.name}" has an unknown kind at path ${path}.kind`)
    assert.ok(typeof mutation.expectedDiagnostic === 'string' && mutation.expectedDiagnostic.length > 0, `${label}: mutation "${mutation.name}" must name its diagnostic at path ${path}.expectedDiagnostic`)
  }
}

// CLI entry: required CI names `node scripts/fairtest/assert-target-dispatch.mjs`
// as its own `pnpm test:fairtest:dispatch` command, so the guard runs over its
// own harness directory from a clean checkout instead of only inside the
// product-contract suite. It exits non-zero on a forbidden host-kind branch,
// carrying the repository's `at path` context and `repair:` guidance, and it
// exercises the reach corpus on every run.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const { scanned } = assertNoTargetKindDispatch(dirname(fileURLToPath(import.meta.url)))
    const { detectionCases, mutations } = runDispatchReach()
    console.log(
      `fairtest target dispatch: ${scanned.length} app modules scanned with no host-kind branch outside the declaration and view-construction modules, ` +
      `${detectionCases} detection cases behaved, and all ${mutations} named mutations failed for their intended reason.`,
    )
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

// The shipped-CSS guards whose data lives in scripts/testdata/css-guards.yaml:
//
//   isolation  (run by scripts/finalize-lib-build.mjs on the emitted dist/lib bytes)
//              base.css and components.css carry no presentation-site selector, no bare
//              `section` content-column rule, no surface namespace owned by another
//              shipped sheet, and no remote font @import.
//   ownership  (run by scripts/css-token-lint.mjs on the source sheets)
//              each surface namespace that ships its own sheet (graph.css, analytics.css)
//              is declared in exactly that source sheet, and the rules that once diverged
//              between two copies are declared once.
//
// Both are pure over text so scripts/css-guards.test.mjs can plant a mutation in the real
// bytes and watch the same code fail.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, walkCss, isStyleRule, shippedSourceSheets, loadStrictYaml, assertExactNames } from './css-source.mjs'
import { ALL_SURFACE_NAMESPACES, ANALYTICS_NAMESPACES, GRAPH_NAMESPACES, findForeignNamespaces } from './surface-namespaces.mjs'

export const GUARDS_FIXTURE = 'scripts/testdata/css-guards.yaml'
export const GUARDS_MANIFEST = 'scripts/testdata/css-guards.manifest.yaml'

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Load the guard data and hold it to its required-name manifest. */
export function loadGuardSpec() {
  const spec = loadStrictYaml(GUARDS_FIXTURE)
  const manifest = loadStrictYaml(GUARDS_MANIFEST)
  const { isolation, ownership } = spec
  assertExactNames(isolation.presentationSelectors.map((s) => s.name), manifest.requiredPresentationSelectorNames, `${GUARDS_FIXTURE} presentationSelectors`)
  for (const s of isolation.presentationSelectors) {
    if (!!s.class === !!s.classPrefix) throw new Error(`${GUARDS_FIXTURE}: presentation selector ${s.name} needs exactly one of class / classPrefix`)
  }
  assertExactNames(isolation.files.map((f) => f.file), manifest.requiredIsolationFiles, `${GUARDS_FIXTURE} isolation.files`)
  // components.css: every surface namespace is either forbidden or hosted there on purpose.
  const components = isolation.files.find((f) => f.file === 'components.css')
  assertExactNames(
    [...components.forbiddenNamespaces, ...isolation.componentsHosted.map((h) => h.namespace)],
    [...ALL_SURFACE_NAMESPACES],
    `${GUARDS_FIXTURE} components.css forbidden + hosted namespaces`,
  )
  // every namespace with its own shipped sheet has exactly one owner sheet
  assertExactNames(ownership.owners.map((o) => o.namespace), [...GRAPH_NAMESPACES, ...ANALYTICS_NAMESPACES], `${GUARDS_FIXTURE} ownership.owners`)
  assertExactNames(ownership.owners.map((o) => o.namespace), manifest.requiredOwnerNamespaces, `${GUARDS_FIXTURE} ownership.owners (manifest)`)
  assertExactNames(ownership.singleSourcedRules.map((r) => r.name), manifest.requiredSingleSourcedRuleNames, `${GUARDS_FIXTURE} ownership.singleSourcedRules`)
  assertExactNames(spec.iconSizeLiterals.exemptElements.map((e) => e.element), manifest.requiredIconSizeExemptElements, `${GUARDS_FIXTURE} iconSizeLiterals.exemptElements`)
  return { spec, manifest }
}

const classPattern = (s) => new RegExp(s.class ? `\\.${escapeRe(s.class)}(?![\\w-])` : `\\.${escapeRe(s.classPrefix)}`)

/** A selector part that is the bare `section` element (optionally with pseudo-classes). */
const isBareSection = (part, element) => new RegExp(`^${escapeRe(element)}(?::[\\w-]+(?:\\([^)]*\\))?)*$`).test(part.trim())

/**
 * @param {Record<string, string>} emitted  file name (as listed in the fixture) → its text
 * @param {object} [spec]  the loaded guard data (defaults to the fixture)
 * @returns {string[]} problems, empty when isolated
 */
export function checkLibIsolation(emitted, spec = loadGuardSpec().spec) {
  const { files, presentationSelectors, bareSection, remoteFontImportFiles } = spec.isolation
  const problems = []
  for (const { file, forbiddenNamespaces } of files) {
    const text = emitted[file]
    if (text === undefined) { problems.push(`${file} was not handed to the isolation guard`); continue }
    const { blocks, statements } = walkCss(text)
    const selectors = blocks.filter(isStyleRule).map((b) => b.prelude)
    const joined = selectors.join('\n')
    for (const ns of findForeignNamespaces(joined, forbiddenNamespaces)) {
      problems.push(`${file} carries foreign surface namespace ${ns} (it ships in its own surface sheet)`)
    }
    for (const sel of presentationSelectors) {
      const hit = selectors.find((s) => classPattern(sel).test(s))
      if (hit) problems.push(`${file} carries presentation selector "${sel.name}" (${sel.class ? '.' + sel.class : '.' + sel.classPrefix + '*'}) in \`${hit}\``)
    }
    for (const s of selectors) {
      for (const part of s.split(',')) {
        if (bareSection.permitted.includes(part.trim())) continue
        if (isBareSection(part, bareSection.element)) problems.push(`${file} carries a bare ${bareSection.element} rule (\`${s}\`); only ${bareSection.permitted.join(', ')} may size a section`)
      }
    }
    if (remoteFontImportFiles.includes(file)) {
      const remote = statements.find((st) => /^@import\s+(?:url\()?\s*["']?https?:/i.test(st.text))
      if (remote) problems.push(`${file} carries a remote font @import (\`${remote.text}\`); apps load fonts with a <link> in the document head`)
    }
  }
  return problems
}

/**
 * @param {Record<string, string>} [overrides]  source path → replacement text (for mutation tests)
 * @param {object} [spec]
 * @returns {string[]} problems, empty when every owned rule has one source
 */
export function checkSourceOwnership(overrides = {}, spec = loadGuardSpec().spec) {
  const { owners, singleSourcedRules } = spec.ownership
  const problems = []
  const sheets = shippedSourceSheets()
  const blocksOf = new Map(sheets.map((f) => [f, walkCss(overrides[f] ?? readFileSync(join(ROOT, f), 'utf8')).blocks.filter(isStyleRule)]))
  for (const { namespace, sheet } of owners) {
    if (!blocksOf.has(sheet)) { problems.push(`owner sheet ${sheet} for ${namespace} is not a shipped source sheet`); continue }
    for (const [file, blocks] of blocksOf) {
      if (file === sheet) continue
      const hit = blocks.find((b) => findForeignNamespaces(b.prelude, [namespace]).length)
      if (hit) problems.push(`${file}:${hit.line} declares \`${hit.prelude}\`, but ${namespace} rules have one source: ${sheet}`)
    }
  }
  for (const { name, selector, sheet } of singleSourcedRules) {
    const n = (blocksOf.get(sheet) ?? []).filter((b) => b.prelude === selector && !b.context.some((c) => c.startsWith('@media'))).length
    if (n !== 1) problems.push(`${sheet} declares the ${name} rule \`${selector}\` ${n} times outside media queries; it must be declared exactly once`)
  }
  return problems
}

/** Every file under `dir` whose name ends with `ext`. */
function filesUnder(dir, ext) {
  const out = []
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...filesUnder(rel, ext))
    else if (name.endsWith(ext)) out.push(rel)
  }
  return out
}

/**
 * The app loads its fonts one way: a <link> in index.html's head. No stylesheet under src/
 * (the shipped sheets and the presentation sheet alike) may @import a remote font or the
 * deprecated fonts.css.
 *
 * @param {Record<string, string>} [overrides]  path → replacement text (for mutation tests)
 * @returns {string[]} problems
 */
export function checkAppFontPath(overrides = {}) {
  const problems = []
  const html = overrides['index.html'] ?? readFileSync(join(ROOT, 'index.html'), 'utf8')
  if (!/<link\b[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?family=Atkinson\+Hyperlegible[^"]*"[^>]*rel="stylesheet"|<link\b[^>]*rel="stylesheet"[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?family=Atkinson\+Hyperlegible/.test(html)) {
    problems.push('index.html has no <link rel="stylesheet"> for the Atkinson Hyperlegible faces; the app loads its fonts with a <link> in the head')
  }
  for (const file of filesUnder('src', '.css')) {
    const text = overrides[file] ?? readFileSync(join(ROOT, file), 'utf8')
    for (const st of walkCss(text).statements) {
      if (/^@import\b/.test(st.text) && (/https?:/i.test(st.text) || /fonts\.css/.test(st.text))) {
        problems.push(`${file}:${st.line} imports fonts in CSS (\`${st.text}\`); the app loads its fonts with a <link> in index.html`)
      }
    }
  }
  return problems
}

/** Every .jsx file under src/ (the library, the in-use demo and the presentation site). */
export const jsxSources = () => filesUnder('src', '.jsx')

/**
 * Lucide icons are sized by the icon tokens, so a numeric `size={n}` prop on a JSX element must
 * not drop below --ic-sm (read from the :root block of src/index.css, never restated here).
 * Elements whose `size` is not an icon size are exempted by name in the fixture.
 *
 * @param {Record<string, string>} [overrides]  source path → replacement text (for mutation tests)
 * @returns {string[]} problems
 */
export function checkIconSizeLiterals(overrides = {}, spec = loadGuardSpec().spec) {
  const exempt = new Set(spec.iconSizeLiterals.exemptElements.map((e) => e.element))
  const root = readFileSync(join(ROOT, 'src/index.css'), 'utf8')
  const m = root.match(/--ic-sm:\s*(\d+)px/)
  if (!m) return ['src/index.css declares no --ic-sm in px; the icon-size check cannot read the floor']
  const floor = Number(m[1])
  const problems = []
  for (const file of jsxSources()) {
    const text = overrides[file] ?? readFileSync(join(ROOT, file), 'utf8')
    for (const hit of text.matchAll(/<([\w.]+)\b[^<>]*?\bsize=\{(\d+)\}/g)) {
      if (Number(hit[2]) < floor && !exempt.has(hit[1])) {
        const line = text.slice(0, hit.index).split('\n').length
        problems.push(`${file}:${line} sizes an icon <${hit[1]} size={${hit[2]}}>, below --ic-sm (${floor}px); use ${floor}, the --ic-md or the --ic-lg value`)
      }
    }
  }
  return problems
}

/** Read the emitted files the isolation guard scans from dist/lib. */
export function readEmitted(spec = loadGuardSpec().spec) {
  return Object.fromEntries(spec.isolation.files.map(({ file }) => [file, readFileSync(join(ROOT, 'dist', 'lib', file), 'utf8')]))
}

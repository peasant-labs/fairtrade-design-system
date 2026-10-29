import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, walkCss, isStyleRule, shippedSourceSheets } from './css-source.mjs'
import { loadDenseTypeFixtures } from './dense-type-fixtures.mjs'

const spec = loadDenseTypeFixtures()
function sources(dir) {
  return readdirSync(join(ROOT, dir)).flatMap(name => {
    const path = `${dir}/${name}`
    return statSync(join(ROOT, path)).isDirectory() ? sources(path) : /\.(css|jsx?|mjs)$/.test(name) ? [path] : []
  })
}
const files = new Map(sources('src').map(path => [path, readFileSync(join(ROOT, path), 'utf8')]))
const deferred = new Set(spec.deferredConsumers)
function microRefs(tree) {
  return [...tree].flatMap(([file, text]) => {
    const css = walkCss(text).blocks.flatMap(block =>
      block.decls.filter(d => /var\(--fs-micro\b/.test(d.value)).map(() => `${file}:${block.prelude}`))
    const inline = [...text.matchAll(/(?:fontSize:\s*['"])(var\(--fs-micro[^'"]*)/g)].map(() => `${file}:inline`)
    return css.concat(inline)
  })
}
const hasDeclaration = tree => /--fs-micro\s*:/.test(tree.get('src/index.css'))
const allowed = ref => deferred.has(ref) || deferred.has(ref.split(':')[0])
function check(kind, tree) {
  if (kind === 'headingCase') {
    const body = tree.get('src/index.css').match(/h1, h2, h3\s*\{([^}]+)\}/)?.[1]
    const generated = walkCss(readFileSync(join(ROOT, 'packages/tokens/base.css'), 'utf8')).blocks.find(b => b.prelude === 'h1, h2, h3')
    return !body || /\blowercase\b/.test(body) || generated?.decls.some(d => d.prop === 'text-transform' && d.value === 'lowercase') ? ['unannotated headings must preserve source case'] : []
  }
  if (kind === 'ownedMicro') return microRefs(tree).filter(ref => !allowed(ref))
  if (kind === 'retirement') return hasDeclaration(tree) ? [] : microRefs(tree)
  return ['src/index.css', ...shippedSourceSheets()].filter(file => !deferred.has(file)).flatMap(file =>
    walkCss(tree.get(file) ?? '').blocks.filter(isStyleRule).flatMap(block => block.decls
      .filter(d => d.prop === 'font-size' && /^\d+(?:\.\d+)?px$/.test(d.value) && parseFloat(d.value) < 14)
      .map(d => `${file}:${block.prelude} ${d.value}`)))
}
for (const row of spec.source) {
  assert.deepEqual(check(row.kind, files), [], `${row.name}: restore the conversion register before building`)
  const changed = new Map(files)
  if (row.kind === 'headingCase') changed.set('src/index.css', changed.get('src/index.css').replace('h1, h2, h3 {', 'h1, h2, h3 { text-transform: lowercase;'))
  else if (row.kind === 'ownedMicro') changed.set('src/index.css', changed.get('src/index.css') + '\n.mutation { font-size: var(--fs-micro); }')
  else if (row.kind === 'retirement') {
    changed.set('src/index.css', changed.get('src/index.css').replace(/--fs-micro\s*:[^;]+;/, '') + '\n.mutation { font-size: var(--fs-micro); }')
  } else changed.set('src/index.css', changed.get('src/index.css') + '\n.mutation { font-size: 11px; }')
  assert.ok(check(row.kind, changed).length, `${row.mutation}: the inventory must reject the regression`)
  console.log(`PASS ${row.name}; killed ${row.mutation}`)
}
for (const row of spec.responsive) {
  const blocks = walkCss(files.get(row.file)).blocks.filter(block => block.prelude === row.selector)
  assert.ok(blocks.some(block => !block.context.some(c => c.startsWith('@media')) && block.decls.some(d => `${d.prop}: ${d.value}` === row.desktop)), `${row.name}: restore desktop columns`)
  assert.ok(blocks.some(block => block.context.includes(row.query) && block.decls.some(d => `${d.prop}: ${d.value}` === row.narrow)), `${row.name}: restore the narrow-width band override`)
  assert.ok(!blocks.some(block => block.context.some(c => /min-width/.test(c))), `${row.name}: use the single-sided band form`)
}
console.log(`Dense type inventory: ${microRefs(files).length} deferred consumers; retirement will require zero.`)

import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SOURCE_ROOTS = ['src', 'scripts']
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])
const forbiddenApi = ['code', 'To', 'Html'].join('')
const forbiddenInjection = ['dangerously', 'Set', 'Inner', 'HTML'].join('')

function sourceFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(path))
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path)
  }
  return files
}

const offenders = SOURCE_ROOTS.flatMap((path) => sourceFiles(join(ROOT, path)))
  .flatMap((path) => {
    const source = readFileSync(path, 'utf8')
    const relativePath = relative(ROOT, path)
    const forbidden = [forbiddenApi]
    if (relativePath.startsWith('src/ui/transcript/')) forbidden.push(forbiddenInjection)
    return forbidden.filter((value) => source.includes(value)).map((value) => `${relativePath} (${value})`)
  })

if (offenders.length) {
  throw new Error(
    `structured Shiki boundary failed: syntax-highlighter HTML serialization/injection is forbidden in Fairtrade (${offenders.join(', ')}). ` +
    'Use codeToHast() or codeToTokens() and render the structured result through React so transcript text remains escaped.',
  )
}

console.log('structured Shiki boundary passed: no HTML serialization API usage')

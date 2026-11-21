/* Rewrite a src/ui/transcript module's imports so a mutated copy of it can run from a temp
   directory. Every static relative import (`from './x.js'`, `from '../x.js'`) resolves against the
   module's real location, and the Schema package against its installed build. Rewriting every
   relative import, not a list of names, means a new import in the module needs no change here; a
   relative import the rewrite cannot place fails the run instead of failing as a missing module. */
const TRANSCRIPT_DIR = new URL('../src/ui/transcript/', import.meta.url)
const SCHEMA_ENTRY = new URL('../node_modules/@peasant-labs/schema/dist/index.js', import.meta.url).href

/** @param {string} source a module under src/ui/transcript @param {string} name its file name, for errors */
export function rewriteTranscriptImports(source, name) {
  const rewritten = source
    .replace(/(\bfrom\s+)'(\.\.?\/[^']+)'/g, (_, from, specifier) => `${from}'${new URL(specifier, TRANSCRIPT_DIR).href}'`)
    .replace(/(\bfrom\s+)'@peasant-labs\/schema'/g, (_, from) => `${from}'${SCHEMA_ENTRY}'`)
  const code = rewritten
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  const left = code.match(/^\s*import\s+(?:[^'"]*\s+from\s+)?['"]\.\.?\/[^'"]+['"]|\bimport\s*\(\s*['"]\.\.?\/[^'"]+['"]/m)
  if (left) throw new Error(`rewriteTranscriptImports left a relative import in ${name}: ${left[0].trim()}. A side-effect, dynamic or multi-line import is not rewritten here; write it as a single-line \`import { x } from './file.js'\` or extend scripts/transcript-module-artifact.mjs.`)
  return rewritten
}

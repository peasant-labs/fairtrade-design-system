import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'

const forbidden = new Set(['location', 'history', 'localStorage', 'URL', 'URLSearchParams'])

/** Scan the real component and every relative JS import, not stories or comments. */
export function assertDataTableHostBoundary(entry = resolve('src/ui/DataTable.jsx')) {
  const seen = new Set()
  function visit(file) {
    if (seen.has(file)) return
    seen.add(file)
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function walk(node) {
      const accessed = ts.isIdentifier(node) || ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && ts.isElementAccessExpression(node.parent))
      if (accessed && forbidden.has(node.text)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
        throw new Error(`DataTable host boundary: ${file}:${line + 1} accesses ${node.text}; the table must not access routing or storage. Pass state and callbacks from the host instead.`)
      }
      const module = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier :
        ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined
      if (module && ts.isStringLiteral(module) && module.text.startsWith('.')) {
        const path = resolve(dirname(file), module.text)
        if (!path.endsWith('.css')) {
          const imported = [path, `${path}.js`, `${path}.jsx`, `${path}/index.js`, `${path}/index.jsx`].find(existsSync)
          if (!imported) throw new Error(`DataTable host boundary: cannot resolve ${path} from ${file}; restore the internal module before checking routing isolation`)
          visit(imported)
        }
      }
      ts.forEachChild(node, walk)
    }
    walk(source)
  }
  visit(entry)
  return [...seen]
}

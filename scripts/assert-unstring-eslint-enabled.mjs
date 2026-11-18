import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'

async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await checkDirectory(path)
    } else if (entry.isFile() && /\.(?:js|jsx)$/.test(entry.name)) {
      const source = await readFile(path, 'utf8')
      const { ast } = tseslint.parser.parseForESLint(source, {
        filePath: path,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        comment: true,
      })
      for (const comment of ast.comments) {
        const directive = comment.value.trim().match(/^eslint-disable(?:-next-line|-line)?\b([\s\S]*)/)
        if (!directive) continue
        const rules = directive[1].split(/\s--(?:\s|$)/, 1)[0].replace(/^\s*\*\s*/gm, '').trim()
        if (!rules) {
          throw new Error(`${path}: bare ESLint disable directives also silence unstring/closed-set-literal; name the specific rule if a suppression is genuinely needed`)
        }
        if (/(?:^|[\s,])unstring\/closed-set-literal(?:$|[\s,])/.test(rules)) {
          throw new Error(`${path}: disabling unstring/closed-set-literal is forbidden; remove the directive`)
        }
      }
    }
  }
}

await checkDirectory(fileURLToPath(new URL('../src/ui/', import.meta.url)))

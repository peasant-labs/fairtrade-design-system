#!/usr/bin/env node
// Run the public command with inherited source-child variables. It must still execute
// the built export, mounted demo, and Mermaid security assertions, not the source-only corpus.
import { spawnSync } from 'node:child_process'

const result = spawnSync('pnpm', ['test:transcript-markdown'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  env: {
    ...process.env,
    FAIRTRADE_MARKDOWN_SOURCE_BASELINE: '1',
    FAIRTRADE_MARKDOWN_SOURCE_MUTATION: 'not valid JSON',
  },
})
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
const required = [
  'built-export assertions passed',
  'PASS mounted-inuse-turn',
  'PASS mermaid-reject-cmyk-linebreak-script',
  'PASS mermaid-svg-script',
  'PASS control-character-url-stays-inert-unsafe-href',
]
const missing = required.filter(marker => !output.includes(marker))
if (result.status !== 0 || result.signal || result.error || missing.length) {
  throw new Error(`public Markdown gate must ignore inherited source-child variables; status=${result.status}, signal=${result.signal}, spawn error=${result.error?.stack ?? 'none'}, missing=${JSON.stringify(missing)}; output:\n${output}`)
}
console.log('public Markdown gate ignores inherited source-child variables and runs built, mounted, and security checks')

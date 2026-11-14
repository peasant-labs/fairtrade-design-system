/* Shiki returns structured tokens. This module never caches source text: the only long-lived
   objects are the engine and a bounded set of language-registration promises. */

/* Bound the synchronous tokenizer's input and output in a reading pane. These conservative
   ceilings limit work, but cannot promise a wall-clock deadline for a JavaScript grammar. */
const MAX_CODE_UNITS = 8192
const MAX_LINE_UNITS = 1024
const MAX_LINES = 256
const MAX_TOKENS = 4096

const LANGUAGES = Object.freeze({
  ts: 'typescript', typescript: 'typescript',
  js: 'javascript', javascript: 'javascript',
  py: 'python', python: 'python',
  go: 'go', json: 'json',
  yaml: 'yaml', yml: 'yaml',
  bash: 'shellscript', sh: 'shellscript', shell: 'shellscript', zsh: 'shellscript',
  css: 'css', html: 'html',
})

const LOADERS = Object.freeze({
  typescript: () => import('@shikijs/langs/typescript'),
  javascript: () => import('@shikijs/langs/javascript'),
  python: () => import('@shikijs/langs/python'),
  go: () => import('@shikijs/langs/go'),
  json: () => import('@shikijs/langs/json'),
  yaml: () => import('@shikijs/langs/yaml'),
  shellscript: () => import('@shikijs/langs/bash'),
  css: () => import('@shikijs/langs/css'),
  html: () => import('@shikijs/langs/html'),
})

/* The theme is created by Shiki, not by transcript data. Only these exact values may become
   class names; no highlighter-supplied CSS or markup is forwarded into the DOM. */
const COLORS = Object.freeze({
  'var(--shiki-foreground)': 'txn-code-foreground',
  'var(--shiki-token-constant)': 'txn-code-constant',
  'var(--shiki-token-string)': 'txn-code-string',
  'var(--shiki-token-comment)': 'txn-code-comment',
  'var(--shiki-token-keyword)': 'txn-code-keyword',
  'var(--shiki-token-parameter)': 'txn-code-parameter',
  'var(--shiki-token-function)': 'txn-code-function',
  'var(--shiki-token-string-expression)': 'txn-code-string-expression',
  'var(--shiki-token-punctuation)': 'txn-code-punctuation',
  'var(--shiki-token-link)': 'txn-code-link',
})

let highlighterPromise
const loadedLanguages = new Map()

function highlighter() {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([import('@shikijs/core'), import('@shikijs/engine-javascript')])
      .then(([core, engine]) => core.createHighlighterCore({
        themes: [core.createCssVariablesTheme({ name: 'fairtrade' })],
        langs: [],
        engine: engine.createJavaScriptRegexEngine(),
      }))
      .catch((error) => { highlighterPromise = undefined; throw error })
  }
  return highlighterPromise
}

async function tokenize(source, language) {
  const engine = await highlighter()
  let registered = loadedLanguages.get(language)
  if (!registered) {
    registered = engine.loadLanguage(LOADERS[language]()).catch((error) => { loadedLanguages.delete(language); throw error })
    loadedLanguages.set(language, registered)
  }
  await registered
  return engine.codeToTokens(source, { lang: language, theme: 'fairtrade' }).tokens
}

function sourceLines(source) {
  const parts = source.split(/(\r\n|\r|\n)/)
  const lines = []
  for (let i = 0; i < parts.length; i += 2) lines.push({ text: parts[i], separator: parts[i + 1] ?? '' })
  return lines
}

/**
 * Refuse unexpected tokens, styles, line boundaries, or any text substitution. The original
 * source remains the fallback. Newline separators are taken from the input, never the tokenizer.
 * @param {string} source
 * @param {unknown} output
 * @returns {{content: string, className: string}[] | null}
 */
export function validateHighlight(source, output) {
  if (typeof source !== 'string' || !Array.isArray(output)) return null
  const lines = sourceLines(source)
  if (output.length !== lines.length) return null
  const result = []
  let count = 0
  for (let i = 0; i < lines.length; i++) {
    if (!Array.isArray(output[i])) return null
    let text = ''
    for (const token of output[i]) {
      if (!token || typeof token !== 'object' || typeof token.content !== 'string' ||
          typeof token.color !== 'string' || !Object.hasOwn(COLORS, token.color) || ++count > MAX_TOKENS) return null
      text += token.content
      result.push({ content: token.content, className: COLORS[token.color] })
    }
    if (text !== lines[i].text) return null
    if (lines[i].separator) result.push({ content: lines[i].separator, className: '' })
  }
  return result
}

/**
 * Highlight a small known-language block, or return null without changing its source.
 * Tokenization still runs on the main thread after the lazy modules load.
 * @param {string} source
 * @param {string} language
 * @param {(source: string, language: string) => Promise<unknown>} [run]
 * @returns {Promise<{content: string, className: string}[] | null>}
 */
export async function highlightCode(source, language, run = tokenize) {
  if (typeof source !== 'string' || typeof language !== 'string' || source.length > MAX_CODE_UNITS) return null
  const name = language.toLowerCase()
  if (!Object.hasOwn(LANGUAGES, name)) return null
  const lines = sourceLines(source)
  if (lines.length > MAX_LINES || lines.some((line) => line.text.length > MAX_LINE_UNITS)) return null
  try {
    return validateHighlight(source, await run(source, LANGUAGES[name]))
  } catch {
    return null
  }
}

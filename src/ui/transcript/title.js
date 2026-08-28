// @ts-check
/* title — session-detail header title helpers, shared between the hero title
   and the condensed sticky header so the two never diverge. Ported verbatim
   (behaviour-for-behaviour) from transcript-browser's `lib/title.ts`, itself
   ported from peasant's `session-detail/v2/lib/title.ts`. Pure, no app
   coupling. ─────────────────────────────────────────────────────────────────

   Real first-user prompts arrive in three rough shapes:
     1. Slash commands wrapped as
          <command-name>/mcp</command-name><command-message>…</command-message>
     2. XML-ish wrappers followed by the user's actual prose.
     3. Plain prose — possibly very long, possibly starting with a code block.

   `summarizePrompt` collapses each shape to a single short string suitable for
   an h1 that will be `truncate`d in CSS. ─────────────────────────────────── */

const PROMPT_SUMMARY_LIMIT = 80

/**
 * Produce a short, human-readable summary of a raw prompt. Heuristic, in order:
 *   1. Strip leading <system-reminder> blocks and leading fenced code blocks.
 *   2. Pull out a <command-name> (e.g. `/mcp`) if present, keep following prose.
 *   3. Strip remaining XML-ish tags, collapse whitespace, take the first sentence.
 *   4. Capitalize the first letter and cap at `limit` chars with `…`.
 *
 * @param {string | undefined} raw
 * @param {number} [limit]
 * @returns {string}
 */
export function summarizePrompt(raw, limit = PROMPT_SUMMARY_LIMIT) {
  if (!raw) return ''

  let working = stripLeadingNoise(raw)

  const { slashCommand, rest } = splitCommandWrapper(working)
  working = rest

  const detagged = working
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*[^>]*>/g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ') // collapse intra-line whitespace, keep \n
    .trim()

  if (!detagged) {
    return slashCommand ? cap(slashCommand, limit) : ''
  }

  const firstSentence = takeFirstSentence(detagged).replace(/\s+/g, ' ').trim()
  const capitalized = capitalize(firstSentence)

  return cap(capitalized, limit)
}

/**
 * Last path segment of a project string. `/Users/x/Projects/phaze` → `phaze`.
 * Falls back to the whole string if there's no separator. Returns `''` when the
 * input is empty/undefined.
 *
 * @param {string | undefined} project
 * @returns {string}
 */
export function projectLabel(project) {
  if (!project) return ''
  const trimmed = project.trim().replace(/[\\/]+$/, '')
  if (!trimmed) return ''
  const parts = trimmed.split(/[\\/]/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : trimmed
}

/**
 * Compose the session detail h1.
 *
 *   • {project}: {Summary}   — project + meaningful prompt
 *   • {project} · {shortId}  — project, no usable prompt
 *   • {shortId} — {Summary}  — no project, but a prompt
 *   • Session {shortId}      — nothing useful at all
 *
 * The full prompt text (or composed title) is returned alongside as a tooltip
 * string so `<h1 title=…>` can expose the raw prompt on hover.
 *
 * @param {object} args
 * @param {string} args.id
 * @param {string | undefined} args.project
 * @param {string | undefined} args.promptContent
 * @param {number} [args.limit]
 * @returns {{ title: string, tooltip: string }}
 */
export function composeSessionTitle(args) {
  const shortId = args.id.slice(0, 8)
  const proj = projectLabel(args.project)
  const summary = summarizePrompt(args.promptContent, args.limit)

  let title
  if (proj && summary) title = `${proj}: ${summary}`
  else if (proj) title = `${proj} · ${shortId}`
  else if (summary) title = `${shortId} — ${summary}`
  else title = `Session ${shortId}`

  const tooltip = (args.promptContent ?? title).trim() || title
  return { title, tooltip }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Drop leading <system-reminder> blocks and leading ``` fenced code blocks.
 * @param {string} raw
 * @returns {string}
 */
function stripLeadingNoise(raw) {
  let s = raw.replace(/^\s+/, '')
  while (true) {
    const m = s.match(/^<system-reminder>[\s\S]*?<\/system-reminder>\s*/i)
    if (!m) break
    s = s.slice(m[0].length)
  }
  const fence = s.match(/^```[\s\S]*?```\s*/)
  if (fence) s = s.slice(fence[0].length)
  return s
}

/**
 * If `raw` starts with one or more `<command-*>…</command-*>` wrapper tags,
 * extract the slash command from `<command-name>` and return the text that
 * follows the wrappers. Otherwise return the input untouched.
 *
 * @param {string} raw
 * @returns {{ slashCommand: string | null, rest: string }}
 */
function splitCommandWrapper(raw) {
  if (!/^\s*<command-[a-z-]+>/i.test(raw)) {
    return { slashCommand: null, rest: raw }
  }

  let slash = /** @type {string | null} */ (null)
  let message = ''
  let cursor = raw.replace(/^\s+/, '')
  const wrapperRe = /^<command-([a-z-]+)>([\s\S]*?)<\/command-\1>\s*/i

  while (true) {
    const m = cursor.match(wrapperRe)
    if (!m) break
    const tag = m[1].toLowerCase()
    const inner = m[2].trim()
    if (tag === 'name' && inner) {
      const name = inner.replace(/^\/+/, '')
      if (name) slash = `/${name}`
    } else if (tag === 'args' && inner && slash) {
      slash = `${slash} ${inner}`
    } else if (tag === 'message' && inner) {
      message = message ? `${message} ${inner}` : inner
    }
    cursor = cursor.slice(m[0].length)
  }

  const trailing = cursor.trim()
  const rest = message ? (trailing ? `${message} ${trailing}` : message) : trailing

  return { slashCommand: slash, rest }
}

/**
 * First sentence: terminate on `.`, `?`, `!`, or newline. Keep `?`/`!`.
 * @param {string} s
 * @returns {string}
 */
function takeFirstSentence(s) {
  let end = -1
  let terminator = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\n' || c === '.' || c === '?' || c === '!') {
      end = i
      terminator = c
      break
    }
  }
  if (end === -1) return s
  const body = s.slice(0, end).trim()
  if (!body) return s.trim()
  if (terminator === '?' || terminator === '!') return body + terminator
  return body
}

/**
 * @param {string} s
 * @returns {string}
 */
function capitalize(s) {
  if (!s) return s
  const first = s.charAt(0)
  if (first >= 'a' && first <= 'z') return first.toUpperCase() + s.slice(1)
  return s
}

/**
 * @param {string} s
 * @param {number} limit
 * @returns {string}
 */
function cap(s, limit) {
  if (s.length <= limit) return s
  return s.slice(0, limit - 1).trimEnd() + '…'
}

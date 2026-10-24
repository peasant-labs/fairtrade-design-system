// @ts-check
/* Share-card data: what the social card for a published transcript says, derived from the same
   session detail payload the transcript page renders. The prompt and token figures follow the
   page's header rules exactly (src/ui/transcript/TranscriptViewer.jsx), so the card and the page
   cannot disagree. Pure and React-free: it imports only plain modules, so a server can load it
   without a DOM. The brand comes from the provider policy's brand keys, which are the BrandMark
   keys; BrandMark itself is a component and stays out of this module. */
import { adaptTranscript } from '../ui/transcript/adapter.js'
import { PROVIDER_BRANDS, providerDisplayName } from '../ui/provider-policy.js'
import { unwrapUserQuery } from '../ui/transcript/title.js'
import { formatCount } from '../ui/format.js'

/**
 * @typedef {object} ShareCardData
 * @property {string} title transcript title
 * @property {string} harness the harness value as recorded
 * @property {string | null} brand BrandMark key, or null when the harness is not a known provider
 * @property {string} chip harness display name with the model in brackets, e.g. "Claude Code (Opus 5.5)"
 * @property {string} firstPrompt the published text of the first user turn, or the title when it has none
 * @property {{ prompts: number, tokens: number } | null} figures both figures or neither
 */

/* claude-<family>-<1-2 digits>(-<1-2 digits>)*, e.g. claude-opus-5-5, after one trailing -YYYYMMDD date is removed */
const MODEL_SHAPE = /^claude-([a-z]+)-(\d{1,2}(?:-\d{1,2})*)$/
/* the legacy shape, version first: claude-<1-2 digits>(-<1-2 digits>)*-<family>, e.g. claude-3-5-sonnet */
const LEGACY_MODEL_SHAPE = /^claude-(\d{1,2}(?:-\d{1,2})*)-([a-z]+)$/
const MODEL_DATE = /-\d{8}$/
const TITLE_LIMIT = 160

/** @param {unknown} harness @returns {boolean} */
const isProvider = (harness) => typeof harness === 'string' && Object.prototype.hasOwnProperty.call(PROVIDER_BRANDS, harness)

/** @param {string} model @returns {string} the short form, or the raw id when it has no known shape */
function shortModel(model) {
  const id = model.replace(MODEL_DATE, '')
  const current = MODEL_SHAPE.exec(id)
  const legacy = current ? null : LEGACY_MODEL_SHAPE.exec(id)
  if (!current && !legacy) return model
  const [family, version] = current ? [current[1], current[2]] : [/** @type {RegExpExecArray} */ (legacy)[2], /** @type {RegExpExecArray} */ (legacy)[1]]
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${version.replace(/-/g, '.')}`
}

/**
 * The chip label: the harness display name, then the model in brackets in short form. An unknown
 * harness shows its raw value; a missing model leaves the harness name alone.
 * @param {string | undefined} harness
 * @param {string | undefined} model
 * @returns {string}
 */
export function shareCardModelLabel(harness, model) {
  const name = isProvider(harness) ? providerDisplayName(/** @type {any} */ (harness)) : String(harness ?? '').trim()
  const short = typeof model === 'string' && model.trim() !== '' ? shortModel(model.trim()) : ''
  if (!short) return name || 'unknown harness'
  return name ? `${name} (${short})` : short
}

/** @param {number} n @returns {string} 84000 -> "84k", 1200000 -> "1.2M" */
export function formatShareCount(n) {
  return formatCount(n)
}

/** The page's title rule: a curated title, else the first prompt, else the id, bounded to 160 characters. */
function pageTitle(payload, vm) {
  const curated = typeof payload.title === 'string' && payload.title.trim() !== '' ? payload.title.trim() : undefined
  const session = vm.session
  const firstUser = vm.turns.find((turn) => turn.role === 'user')?.content
  const raw = curated ?? (session.hasNormalizedEvidence ? undefined : vm.tasks?.[0]?.prompt ?? firstUser) ?? session.id ?? 'transcript'
  const text = String(raw)
  // never slice through a surrogate pair
  const cut = (text.codePointAt(TITLE_LIMIT - 2) ?? 0) > 0xffff ? TITLE_LIMIT - 2 : TITLE_LIMIT - 1
  return text.length > TITLE_LIMIT ? text.slice(0, cut).trimEnd() + '…' : text
}

/**
 * The card data for a session detail payload, or null when the payload does not parse.
 * @param {unknown} payload
 * @returns {ShareCardData | null}
 */
export function shareCardFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  const wire = /** @type {any} */ (payload)
  if (typeof wire.harness !== 'string' || !Array.isArray(wire.turns)) return null
  let vm
  try {
    vm = adaptTranscript(wire)
  } catch {
    return null
  }
  const session = vm.session
  const title = pageTitle(wire, vm)
  const harness = typeof session.harness === 'string' ? session.harness : ''
  const brand = isProvider(harness) ? PROVIDER_BRANDS[/** @type {keyof typeof PROVIDER_BRANDS} */ (harness)] : null

  // the first user turn's text, read from the recorded turns: the page's noise filter drops an
  // empty turn, which would promote a later prompt to first. A first turn with no text
  // (attachments, tool results) falls back to the title.
  const first = wire.turns.find((turn) => turn?.role === 'user' && (turn.depth ?? 0) === 0)
  const recorded = typeof first?.content === 'string' ? first.content : ''
  const firstText = (session.harness === 'cursor' ? unwrapUserQuery(recorded) : recorded).trim()
  const firstPrompt = firstText || title

  // the page shows the prompt count when it was recorded, and the single token total only when
  // there are no usage scopes; the card shows both figures or neither
  const prompts = session.inputSubmissionCount
  const tokens = session.totalTokens
  const showTotal = !vm.usageScopes?.length && tokens != null
  const figures = prompts != null && showTotal ? { prompts: Number(prompts), tokens: Number(tokens) } : null

  return { title, harness, brand, chip: shareCardModelLabel(harness, session.model), firstPrompt, figures }
}

/** @param {ShareCardData} card @returns {string} */
export function shareCardDescription(card) {
  const ask = `What prompts produced "${card.title}"?`
  const tail = 'Read every prompt on village.'
  if (!card.figures) return `${ask} ${tail}`
  return `${ask} ${figureText(card.figures)} with ${card.chip}. ${tail}`
}

/** @param {ShareCardData} card @returns {string} */
export function shareCardAlt(card) {
  if (!card.figures) return `Share card: the first prompt of "${card.title}" with ${card.chip}`
  return `Share card: ${figureText(card.figures)} with ${card.chip}`
}

/** @param {{ prompts: number, tokens: number }} figures */
function figureText(figures) {
  return `${figures.prompts} ${figures.prompts === 1 ? 'prompt' : 'prompts'} and ${formatShareCount(figures.tokens)} tokens`
}

import { useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldHalf,
  Eye,
  EyeOff,
  AlertTriangle,
  Minus,
  Plus,
  ArrowRight,
  Lock,
  Send,
} from 'lucide-react'
import './Redaction.css'

/* Redaction: the "in use" safe-by-default review surface, modeled on peasant's
   RedactionStep / RedactionDiffView + the PushStep transparency panel. two composites,
   one philosophy — "safe by default, transparent before action, never color-only":

     <RedactionReview />   an availableLevels-constrained selector (segmented, aria-pressed), a scan
                           progress bar (role=progressbar), and a list of match cards. each card reads
                           a before→after pair on the same chassis as DiffView, with redundant glyphs
                           + an icon+word state (not color alone), a category·confidence badge, and an
                           individual keep/revert toggle. "kept" means UN-redacted — the secret would
                           leave as-is — so it is flagged with a warning state and an eye on the kept
                           original rather than a deletion cue.

     <WhereDoesThisGo />   the transparency panel shown before an outbound action: the
                           destination url + a two-column "what gets sent / what stays
                           private" split, each row an icon + label. calm, square, hairline.

   the secret + redacted forms are CODE -> var(--font-mono), NEVER lowercased. chrome (labels,
   buttons, captions) is lowercased prose. classes are namespaced rdx-; tokens + the rdx-* rules
   live in Redaction.css. */

// the three redaction levels, strongest-protection last. each carries an icon so the choice
// reads without color, plus a one-line description of what it strips (guidance prose).
const LEVELS = [
  { value: 'minimal', label: 'minimal', icon: ShieldHalf, desc: 'secrets & api keys only' },
  { value: 'standard', label: 'standard', icon: ShieldCheck, desc: 'secrets + pii + internal urls' },
  { value: 'maximum', label: 'maximum', icon: ShieldAlert, desc: 'every detected pattern, incl. paths' },
]

const LEVEL_VALUES = LEVELS.map(({ value }) => value)

function normalizeAvailableLevels(availableLevels) {
  if (availableLevels === undefined) return LEVELS

  const valid = Array.isArray(availableLevels)
    && availableLevels.length > 0
    && availableLevels.every((value) => LEVEL_VALUES.includes(value))
  if (!valid) {
    throw new TypeError(
      'What went wrong: availableLevels is invalid. Why: it is empty, is not an array, or contains an unknown level. Where: RedactionReview availableLevels prop. When: render validation before the level selector is created. What it means: the review cannot render safely because it could expose unsupported redaction choices. How to fix: pass a non-empty array containing only "minimal", "standard", and/or "maximum".',
    )
  }

  const requested = new Set(availableLevels)
  return LEVELS.filter(({ value }) => requested.has(value))
}

/**
 * the level selector — a segmented control of mutually-exclusive options. the selected option
 * carries aria-pressed="true" + the amber fill + a leading icon, so the choice never rides on
 * color alone. its description sits below as guidance prose.
 */
function LevelSelect({ levels, level, onLevel }) {
  const active = levels.find((option) => option.value === level) ?? levels[0]
  return (
    <div className="rdx-level">
      <span className="rdx-eyebrow" id="rdx-level-label">level</span>
      <div className="rdx-seg" role="group" aria-labelledby="rdx-level-label">
        {levels.map((opt) => {
          const Icon = opt.icon
          return (
            <button
              key={opt.value}
              type="button"
              className="rdx-seg-opt"
              aria-pressed={active.value === opt.value}
              onClick={() => onLevel?.(opt.value)}
            >
              <Icon aria-hidden="true" />
              {opt.label}
            </button>
          )
        })}
      </div>
      <p className="rdx-level-desc">{active.desc}</p>
    </div>
  )
}

/**
 * the scan progress bar — a real progressbar (role + aria-value*) with a tabular "scanned N /
 * total" head. neutral track; this is work completing, not a danger signal.
 */
function ScanProgress({ scanned, total }) {
  const safeTotal = Math.max(0, total)
  const safeScanned = Math.max(0, Math.min(scanned, safeTotal))
  const pct = safeTotal === 0 ? 100 : (safeScanned / safeTotal) * 100
  const done = safeScanned >= safeTotal
  return (
    <div className="rdx-scan">
      <div className="rdx-scan-head">
        <span className="rdx-scan-label">{done ? 'scanned' : 'scanning'}</span>
        <span className="rdx-scan-count tnum">
          {safeScanned} / {safeTotal}
        </span>
      </div>
      <div
        className="rdx-scan-track"
        role="progressbar"
        aria-valuenow={safeScanned}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-label={`scanned ${safeScanned} of ${safeTotal}`}
      >
        <div className="rdx-scan-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/**
 * a single match card. the before→after uses the DiffView chassis: while redacted, the original is
 * a struck deletion and the replacement is an addition. when kept, the original becomes neutral
 * with an eye cue and the unused replacement fades. glyphs keep every state legible without color.
 *
 * the per-match toggle opts OUT of redaction. "kept" = the secret leaves un-redacted, so the
 * whole card flips to a loud warning treatment (clay rail + wash + a "will be sent" icon+word).
 * controlled when `onToggle` is given (parent owns `kept`); otherwise self-manages local state.
 */
function MatchCard({ match, onToggle }) {
  const { id, category, confidence, before, secret, after, kept: keptProp } = match
  const isControlled = onToggle !== undefined
  const [internalKept, setInternalKept] = useState(Boolean(keptProp))
  const kept = isControlled ? Boolean(keptProp) : internalKept

  const toggle = () => {
    if (isControlled) onToggle?.(id, !kept)
    else setInternalKept((v) => !v)
  }

  // 0.98 -> "0.98": two decimals, tabular, mono. a low-confidence match (< 0.70) earns the
  // amber caution treatment on the badge — scarce by design.
  const conf = typeof confidence === 'number' ? confidence.toFixed(2) : confidence
  const low = typeof confidence === 'number' && confidence < 0.7

  return (
    <li className={`rdx-card${kept ? ' rdx-card-kept' : ''}`}>
      <div className="rdx-card-head">
        <span className={`rdx-badge${low ? ' rdx-badge-low' : ''}`}>
          {low && <AlertTriangle className="rdx-badge-warn" aria-hidden="true" />}
          <span className="rdx-badge-cat">{category}</span>
          <span className="rdx-badge-dot" aria-hidden="true">·</span>
          <span className="rdx-badge-conf tnum">{conf}</span>
          {low && <span className="rdx-sr"> (low confidence)</span>}
        </span>

        {/* the live state of THIS match — redacted (safe) or kept (will be sent). icon + word,
            never color alone. when kept, it shouts. */}
        {kept ? (
          <span className="rdx-state rdx-state-kept">
            <ShieldAlert aria-hidden="true" />
            will be sent
          </span>
        ) : (
          <span className="rdx-state rdx-state-safe">
            <ShieldCheck aria-hidden="true" />
            redacted
          </span>
        )}

        <button
          type="button"
          className="rdx-toggle"
          aria-pressed={kept}
          onClick={toggle}
        >
          {kept ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {kept ? 'revert' : 'keep'}
        </button>
      </div>

      {/* before -> after on the diff chassis. the secret + its redacted form are CODE: mono, never
          lowercased. removed originals use −; kept originals use an eye. the + glyph and state-aware
          sr labels carry the same meaning for AT and for color-blind readers. */}
      <div className="rdx-pair" role="group" aria-label="before and after redaction">
        <div className={`rdx-row rdx-row-del${kept ? ' rdx-row-muted' : ''}`}>
          <span className="rdx-rail" aria-hidden="true" />
          <span className="rdx-glyph" aria-hidden="true">
            {kept ? <Eye aria-hidden="true" /> : <Minus aria-hidden="true" />}
          </span>
          <span className="rdx-code">
            <span className="rdx-sr">
              {kept ? 'original secret (kept, will be sent): ' : 'original secret (removed): '}
            </span>
            <span className="rdx-strike">{before ?? secret}</span>
          </span>
        </div>
        <div className={`rdx-row rdx-row-add${kept ? ' rdx-row-muted' : ''}`}>
          <span className="rdx-rail" aria-hidden="true" />
          <span className="rdx-glyph" aria-hidden="true"><Plus aria-hidden="true" /></span>
          <span className="rdx-code">
            <span className="rdx-sr">
              {kept ? 'redacted form (not used): ' : 'redacted form (added): '}
            </span>
            {after}
          </span>
        </div>
      </div>
    </li>
  )
}

/**
 * RedactionReview — the safe-by-default review surface.
 *
 * @param {object} props
 * @param {'minimal'|'standard'|'maximum'} [props.level='standard'] - the selected redaction level
 * @param {readonly ('minimal'|'standard'|'maximum')[]} [props.availableLevels]
 *        - supported levels. choices use canonical order. one choice hides the selector; invalid or
 *          empty input throws an actionable TypeError before the review renders.
 * @param {(level: 'minimal'|'standard'|'maximum') => void} [props.onLevel]
 *        - called only with an available level on select
 * @param {Array<{id, category, confidence:number, before?:string, secret?:string, after:string, kept?:boolean}>} [props.matches]
 *        - the flagged matches. `before`/`secret` is the original (one or the other), `after` the
 *          redacted form. `kept` (controlled mode) = the user opted OUT, secret leaves as-is.
 * @param {(id: string, kept: boolean) => void} [props.onToggle] - called when a match is toggled;
 *        when given, the component is controlled (read `kept` off each match).
 * @param {number} [props.scanned] - sessions/files scanned so far (defaults to `total`: done).
 * @param {number} [props.total=0] - total to scan.
 * @param {string|boolean} [props.failure] - honest-failure banner text; truthy shows the banner.
 * @param {string} [props.className]
 */
export function RedactionReview({
  level = 'standard',
  availableLevels,
  onLevel,
  matches = [],
  onToggle,
  scanned,
  total = 0,
  failure,
  className = '',
  ...rest
}) {
  const levels = normalizeAvailableLevels(availableLevels)
  if (!levels.some((option) => option.value === level)) {
    throw new TypeError(
      `What went wrong: controlled level ${JSON.stringify(level)} is absent from availableLevels. Why: the owner supplied conflicting level state and supported choices. Where: RedactionReview level and availableLevels props. When: render validation before the active level is displayed. What it means: the review cannot render because it would show a different level from the controlled value. How to fix: include the controlled level in availableLevels or update level to one of: ${levels.map(({ value }) => value).join(', ')}.`,
    )
  }
  const scannedN = scanned ?? total
  const keptCount = matches.filter((m) => m.kept).length
  const cls = ['rdx', 'rdx-review', className].filter(Boolean).join(' ')

  return (
    <section className={cls} aria-label="redaction review" {...rest}>
      {/* control bar — the constrained selector appears only when multiple levels are available;
          scan progress stays visible. safe-by-default opt-out controls never hide behind a click. */}
      <div className="rdx-bar">
        {levels.length > 1 && <LevelSelect levels={levels} level={level} onLevel={onLevel} />}
        <ScanProgress scanned={scannedN} total={total} />
      </div>

      {/* honest-failure banner — a file that couldn't be fully scanned must not read as
          "all clear". say so plainly, with an alert icon (not color alone). */}
      {failure && (
        <div className="rdx-banner" role="alert">
          <AlertTriangle className="rdx-banner-icon" aria-hidden="true" />
          <p className="rdx-banner-text">
            {typeof failure === 'string'
              ? failure
              : 'some files could not be fully scanned. don’t treat an empty result as “all clear”.'}
          </p>
        </div>
      )}

      {/* the summary line — total flagged, and how many are kept (un-redacted). when anything is
          kept, the count carries the warning treatment so the risk is legible at a glance. */}
      <div className="rdx-summary">
        <span className="rdx-summary-total tnum">
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </span>
        {keptCount > 0 ? (
          <span className="rdx-summary-kept">
            <ShieldAlert aria-hidden="true" />
            <span className="tnum">{keptCount}</span> kept un-redacted
          </span>
        ) : (
          <span className="rdx-summary-safe">
            <ShieldCheck aria-hidden="true" />
            all redacted
          </span>
        )}
      </div>

      {matches.length === 0 ? (
        <p className="rdx-empty">no sensitive content detected. safe to share as-is.</p>
      ) : (
        <ul className="rdx-list">
          {matches.map((m, i) => (
            <MatchCard key={m.id ?? i} match={m} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * a single transparency row: an icon + a code/label. used in both columns of WhereDoesThisGo.
 * the `tone` picks the rail + icon ('send' = leaves the machine, 'private' = stays). label text
 * is content -> mono, not lowercased.
 */
function TransparencyRow({ icon: Icon, tone, children }) {
  return (
    <li className={`rdx-trow rdx-trow-${tone}`}>
      <Icon className="rdx-trow-icon" aria-hidden="true" />
      <span className="rdx-trow-label">{children}</span>
    </li>
  )
}

/**
 * WhereDoesThisGo — the transparency panel shown before an outbound action. the destination url,
 * then a two-column split: "what gets sent" (Send icon, add rail) vs "what stays private" (Lock
 * icon, neutral rail). calm, square, hairline. each column header pairs an icon with its word so
 * the two halves never read on color alone.
 *
 * @param {object} props
 * @param {string} props.destination - the outbound url (code -> mono, not lowercased)
 * @param {string[]} [props.sent] - the things that WILL be sent
 * @param {string[]} [props.private] - the things that stay on the machine
 * @param {string} [props.className]
 */
export function WhereDoesThisGo({
  destination,
  sent = [],
  private: stays = [],
  className = '',
  ...rest
}) {
  const cls = ['rdx', 'rdx-where', className].filter(Boolean).join(' ')
  return (
    <section className={cls} aria-label="where does this go" {...rest}>
      <header className="rdx-where-head">
        <Send className="rdx-where-head-icon" aria-hidden="true" />
        <h2 className="rdx-where-title">where does this go?</h2>
      </header>

      {/* the boundary line — one plain sentence at the boundary (guidance prose). */}
      <p className="rdx-where-note">
        nothing leaves your machine until you choose to send it. redacted by default.
      </p>

      {/* destination — the url is code: mono, not lowercased, breakable. */}
      <div className="rdx-where-dest">
        <span className="rdx-eyebrow">destination</span>
        <p className="rdx-where-url">
          <ArrowRight className="rdx-where-url-icon" aria-hidden="true" />
          {destination}
        </p>
      </div>

      <div className="rdx-where-split">
        <div className="rdx-where-col">
          <div className="rdx-where-col-head">
            <Send className="rdx-where-col-icon rdx-where-col-icon-sent" aria-hidden="true" />
            <span className="rdx-eyebrow">what gets sent</span>
          </div>
          <ul className="rdx-trows">
            {sent.map((item, i) => (
              <TransparencyRow key={i} icon={Send} tone="sent">
                {item}
              </TransparencyRow>
            ))}
          </ul>
        </div>

        <div className="rdx-where-col">
          <div className="rdx-where-col-head">
            <Lock className="rdx-where-col-icon rdx-where-col-icon-private" aria-hidden="true" />
            <span className="rdx-eyebrow">what stays private</span>
          </div>
          <ul className="rdx-trows">
            {stays.map((item, i) => (
              <TransparencyRow key={i} icon={Lock} tone="private">
                {item}
              </TransparencyRow>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default RedactionReview

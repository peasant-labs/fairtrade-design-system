import { useState } from 'react'
import {
  HardDrive,
  WifiOff,
  Loader,
  Plug,
  RotateCw,
  Copy,
  Check,
  Lock,
} from 'lucide-react'
import './ConnectionState.css'

/* ConnectionState: the "in use" local-program connection family, modeled on peasant's
   ConnectionState / ConnectionStatus + IngestTeach / BlankSlate. one philosophy — the program
   we talk to runs on THIS computer (no internet), so the copy leads with that; and a dropped
   socket must never read as "empty". three pieces, one voice:

     <ConnectionPill status />        the small, glanceable, always-on indicator: an icon + the
                                      word. status is never color-only — the word and the icon both
                                      carry it (no status dot — a color-only dot would break that
                                      rule). copy stays plain and local
                                      ("on this computer · no internet").

     <DataState ...>                  the discriminator. losing the connection is NOT the same as
                                      having no data: it renders a skeleton while loading, a calm
                                      "lost the local program" panel (with retry) on
                                      disconnected/error, the teaching `empty` slot when
                                      connected-but-empty, else children. one dropped socket can't
                                      masquerade as an empty result.

     <TeachingEmptyState ...>         an empty state that TEACHES the mechanism: a copy-able
                                      `$ command` chip (e.g. peasant ingest) with a copy button,
                                      and a one-line privacy note ("nothing leaves your machine").

   chrome (the pill word, the command chip, labels, buttons) is mono + lowercase; guidance prose
   is body. commands are CODE → mono, never lowercased by us. classes are namespaced cx-; tokens +
   the cx-* rules live in ConnectionState.css (imported here). */

// the three connection states, each pairing an icon + a word so the state reads without color.
// copy is local-first: the program is on this machine, no internet.
const STATUS = {
  live: {
    tone: 'live',
    icon: HardDrive,
    word: 'live',
    note: 'on this computer · no internet',
  },
  connecting: {
    tone: 'connecting',
    icon: Loader,
    word: 'connecting',
    note: 'reaching the local program…',
  },
  disconnected: {
    tone: 'disconnected',
    icon: WifiOff,
    word: 'disconnected',
    note: 'local program not reachable',
  },
}

/**
 * a tiny inline copy button — navigator.clipboard with a guard for environments where it is
 * undefined (it lives behind a secure context). on success it flips to a check + "copied" for a
 * beat. icon + word, never icon alone, so the action and its result read for everyone.
 */
function CopyChipButton({ value, label = 'copy' }) {
  const [copied, setCopied] = useState(false)
  const canCopy = typeof navigator !== 'undefined' && navigator.clipboard

  const onCopy = async () => {
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard write can reject (permissions / blur) — leave the label unchanged; the command
      // is visible in the chip, so the user can still select it by hand.
    }
  }

  if (!canCopy) return null

  return (
    <button
      type="button"
      className="cx-copy"
      onClick={onCopy}
      aria-label={copied ? 'copied to clipboard' : `${label} command to clipboard`}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span className="cx-copy-label">{copied ? 'copied' : label}</span>
    </button>
  )
}

/**
 * ConnectionPill — the small, glanceable connection indicator. a square hairline pill carrying an
 * icon and the word; the note ("on this computer · no internet") sits beside it as quiet mono
 * chrome. the state never rides on color alone: the icon and the word both encode it (no status
 * dot — a color-only dot would break that rule), and the whole pill is announced via role=status.
 * the per-tone icon color is a tint on top, only where color is welcome.
 *
 * @param {object} props
 * @param {'live'|'connecting'|'disconnected'} [props.status='live'] - the connection state.
 * @param {boolean} [props.showNote=true] - render the trailing "on this computer · no internet"
 *        style note. set false for the tightest, word-only pill.
 * @param {string} [props.className]
 */
export function ConnectionPill({ status = 'live', showNote = true, className = '', ...rest }) {
  const s = STATUS[status] ?? STATUS.live
  const Icon = s.icon
  const cls = ['cx-pill', `cx-pill-${s.tone}`, className].filter(Boolean).join(' ')

  return (
    <span className={cls} role="status" {...rest}>
      {/* no status dot: a color-only dot violates "meaning never on color alone". the icon + the
          word carry the state; the per-tone icon color is a tint on top, never the sole signal. */}
      <Icon className="cx-pill-icon" aria-hidden="true" />
      <span className="cx-pill-word">{s.word}</span>
      {showNote && <span className="cx-pill-note">{s.note}</span>}
    </span>
  )
}

/**
 * a calm "we lost the local program" panel — the content-area state for when a dropped (or never
 * established) connection is the reason the body is empty, so the user isn't left staring at an
 * endless skeleton. plain, square, hairline; an unplug icon (not color alone), a quiet explanation
 * that the program runs on this machine, and a retry button. announced via role=status.
 */
function DisconnectedPanel({ onRetry, title, body }) {
  return (
    <div className="cx-panel" role="status" aria-live="polite">
      <Plug className="cx-panel-icon" aria-hidden="true" />
      <div className="cx-panel-text">
        <p className="cx-panel-title">{title}</p>
        <p className="cx-panel-body">{body}</p>
      </div>
      {onRetry && (
        <button type="button" className="cx-retry" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          <span>retry</span>
        </button>
      )}
    </div>
  )
}

/** a few quiet skeleton bars for the loading state — work in progress, not a danger signal. */
function LoadingSkeleton({ rows = 3 }) {
  return (
    <div className="cx-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="cx-sr">loading…</span>
      {Array.from({ length: Math.max(1, rows) }).map((_, i) => (
        <span key={i} className="cx-skel-bar" aria-hidden="true" />
      ))}
    </div>
  )
}

/**
 * DataState — the discriminator between the states a data view can be in, so a dropped connection
 * never reads as "empty". precedence is deliberate:
 *
 *   loading                  → a skeleton (don't show "empty" before the answer is in).
 *   disconnected || error    → the calm lost-connection panel + retry (the key rule:
 *                              disconnected != empty — a lost socket is not zero results).
 *   empty                    → the teaching `empty` slot (connected, but genuinely nothing here).
 *   else                     → children (the real content).
 *
 * @param {object} props
 * @param {'live'|'connecting'|'disconnected'} [props.status] - the live connection status. when
 *        'disconnected', the lost-connection panel wins over `empty` even if `empty` is provided.
 * @param {boolean} [props.loading] - data is in flight; show the skeleton.
 * @param {boolean|string} [props.error] - an error occurred; truthy shows the lost-connection
 *        panel. a string overrides the panel body.
 * @param {boolean} [props.empty] - connected, request resolved, but there is nothing to show.
 * @param {import('react').ReactNode} [props.children] - the real content, shown when none of the
 *        above apply.
 * @param {import('react').ReactNode} [props.emptyState] - the teaching empty slot (e.g. a
 *        <TeachingEmptyState/>), rendered when `empty` is true.
 * @param {() => void} [props.onRetry] - retry handler for the lost-connection panel.
 * @param {number} [props.skeletonRows=3] - how many skeleton bars to show while loading.
 * @param {string} [props.className]
 */
export function DataState({
  status,
  loading = false,
  error = false,
  empty = false,
  children,
  emptyState,
  onRetry,
  skeletonRows = 3,
  className = '',
  ...rest
}) {
  const disconnected = status === 'disconnected' || Boolean(error)
  const cls = ['cx-state', className].filter(Boolean).join(' ')

  let inner
  if (loading) {
    inner = <LoadingSkeleton rows={skeletonRows} />
  } else if (disconnected) {
    // the panel body: a connection error string wins; otherwise the plain local-program copy.
    inner = (
      <DisconnectedPanel
        onRetry={onRetry}
        title="lost connection to the local program"
        body={
          typeof error === 'string'
            ? error
            : 'the peasant program on this computer may have stopped. nothing has left your machine. this returns on its own, or retry.'
        }
      />
    )
  } else if (empty) {
    inner = emptyState ?? null
  } else {
    inner = children
  }

  return (
    <div className={cls} {...rest}>
      {inner}
    </div>
  )
}

/**
 * TeachingEmptyState — an empty state that TEACHES the mechanism instead of just declaring the
 * absence. a leading icon, a title, a line of guidance, and a copy-able `$ command` chip (the
 * actual command to run, e.g. `peasant ingest`) with an inline copy button — then a short privacy
 * line, because the whole point is that this runs locally and nothing leaves the machine.
 *
 * @param {object} props
 * @param {import('react').ComponentType} [props.icon=HardDrive] - lucide icon for the heading.
 * @param {import('react').ReactNode} props.title - the short headline.
 * @param {import('react').ReactNode} [props.body] - a line of guidance prose (what the command
 *        does, in plain words).
 * @param {string} [props.command] - the command to teach, shown in a `$`-prefixed mono chip with a
 *        copy button. the `$` is decoration; only the command itself is copied.
 * @param {import('react').ReactNode} [props.privacy] - the privacy line. defaults to "nothing
 *        leaves your machine". pass null to omit.
 * @param {keyof JSX.IntrinsicElements} [props.as='h3'] - heading level for the title.
 * @param {string} [props.className]
 */
export function TeachingEmptyState({
  icon: Icon = HardDrive,
  title,
  body,
  command,
  privacy = 'nothing leaves your machine',
  as: Heading = 'h3',
  className = '',
  ...rest
}) {
  const cls = ['cx-teach', className].filter(Boolean).join(' ')

  return (
    <div className={cls} {...rest}>
      <div className="cx-teach-ring">
        <Icon aria-hidden="true" />
      </div>
      <Heading className="cx-teach-title">{title}</Heading>
      {body && <p className="cx-teach-body">{body}</p>}

      {command && (
        <div className="cx-cmd">
          {/* the command is CODE → mono, not lowercased by us. the `$` is a decorative prompt
              glyph; only the command itself is copied, so a paste runs cleanly. */}
          <code className="cx-cmd-code">
            <span className="cx-cmd-prompt" aria-hidden="true">$</span>
            <span className="cx-cmd-text">{command}</span>
          </code>
          <CopyChipButton value={command} />
        </div>
      )}

      {privacy && (
        <p className="cx-teach-privacy">
          <Lock className="cx-teach-privacy-icon" aria-hidden="true" />
          {privacy}
        </p>
      )}
    </div>
  )
}

export default ConnectionPill

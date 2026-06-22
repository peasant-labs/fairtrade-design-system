import { useCallback, useEffect, useState } from 'react'
import { Copy, Check, X } from 'lucide-react'
import './CliOnboard.css'

/* CliOnboard — a CLI-onboarding step list + a dismissible getting-started card, ported in intent
   from the peasant/village publish onboarding (numbered square markers + copy-able `$ command`
   blocks; the IngestTeach "run this in your terminal" voice). Three pieces:

     <CommandBlock>   a square `$ command` line + a copy button that flips to "copied".
     <CliSteps>       a numbered step list: amber square marker + title + body + optional command.
     <GettingStarted> a dismissible card wrapping <CliSteps>, persisting "dismissed" to localStorage.

   The command line is the signal, drawn in mono with a leading DIM `$` and the literal command in
   case (NEVER lowercase the command). The single sanctioned accent is amber, scarce — it tints the
   step number marker. Done/copied reads in olive AND the word "copied" + a check icon, so the state
   never rides on colour alone (WCAG 1.4.1). tokens only, hairline, mono, square (radius 0). Motion
   is gated behind prefers-reduced-motion: no-preference; focus uses focus-visible (3px ring). */

/** Write `text` to the clipboard, resolving false (not throwing) when no clipboard is available. */
async function copyToClipboard(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* permission denied / insecure context — fall through to the false return */
  }
  return false
}

/**
 * CommandBlock — a square `$ command` block: a mono command line with a leading dim `$`, and a copy
 * button that flips to an olive check + the word "copied" for ~1.5s.
 *
 * @param {object} props
 * @param {string} props.command - the literal shell command (case preserved — never lowercased).
 * @param {string} [props.label] - an accessible name for the copy button; defaults to the command.
 * @param {string} [props.className] - extra classes appended to the root.
 */
export function CommandBlock({ command, label, className = '', ...rest }) {
  const [copied, setCopied] = useState(false)

  // Reset the "copied" flag ~1.5s after a successful copy; the timer is cleared on unmount / re-copy.
  useEffect(() => {
    if (!copied) return undefined
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(command)
    if (ok) setCopied(true)
  }, [command])

  const cls = ['cli-cmd', className].filter(Boolean).join(' ')
  const name = label || command

  return (
    <div className={cls} {...rest}>
      <pre className="cli-cmd-line">
        <code>
          {/* the dim prompt sigil is chrome — not part of the command, and not selectable */}
          <span className="cli-cmd-sigil" aria-hidden="true">$ </span>
          {/* COMMAND — literal, case preserved; never lowercase it */}
          {command}
        </code>
      </pre>

      <button
        type="button"
        className={`cli-copy${copied ? ' cli-copy-done' : ''}`}
        onClick={onCopy}
        aria-label={copied ? `copied ${name}` : `copy ${name}`}
        title={copied ? 'copied' : 'copy command'}
      >
        {copied ? (
          <Check className="cli-copy-ic" aria-hidden="true" />
        ) : (
          <Copy className="cli-copy-ic" aria-hidden="true" />
        )}
        {/* icon AND word — the copied state is never colour-only */}
        <span className="cli-copy-word">{copied ? 'copied' : 'copy'}</span>
      </button>
    </div>
  )
}

/**
 * @typedef {object} CliStep
 * @property {string} title - the step heading (e.g. "install"). Chrome — rendered lowercase by CSS.
 * @property {string} [body] - optional prose explaining the step (body font, case preserved).
 * @property {string} [command] - optional shell command for the step, rendered as a CommandBlock.
 */

/**
 * CliSteps — a numbered step list: each step is a square amber-tinted number marker + a title + an
 * optional body + an optional CommandBlock, with a connector line running between the markers.
 *
 * @param {object} props
 * @param {CliStep[]} props.steps - the steps, in order; numbered from 1.
 * @param {string} [props.label='getting started'] - accessible name for the list (lowercase chrome).
 * @param {string} [props.className] - extra classes appended to the root.
 */
export function CliSteps({ steps = [], label = 'getting started', className = '', ...rest }) {
  const cls = ['cli-steps', className].filter(Boolean).join(' ')

  if (steps.length === 0) {
    return (
      <div className={cls} {...rest}>
        <p className="cli-empty">no steps to show.</p>
      </div>
    )
  }

  return (
    <ol className={cls} aria-label={label} {...rest}>
      {steps.map((step, i) => (
        <li className="cli-step" key={step.title ?? i}>
          {/* the square amber number marker — the scarce accent; the connector line runs from it */}
          <span className="cli-step-marker tnum" aria-hidden="true">
            {i + 1}
          </span>

          <div className="cli-step-main">
            <h3 className="cli-step-title">{step.title}</h3>
            {step.body && <p className="cli-step-body">{step.body}</p>}
            {step.command && <CommandBlock command={step.command} />}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Read the dismissed flag for `key`, guarded for environments with no window / blocked storage. */
function readDismissed(key) {
  if (typeof window === 'undefined' || !key) return false
  try {
    return window.localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

/** Persist the dismissed flag for `key`, guarded the same way as the read above. */
function writeDismissed(key) {
  if (typeof window === 'undefined' || !key) return
  try {
    window.localStorage.setItem(key, 'true')
  } catch {
    /* private mode / storage disabled — the card simply re-appears next load */
  }
}

/**
 * GettingStarted — a dismissible card wrapping <CliSteps>: a header (title + close button) over the
 * step list. Dismissing persists "dismissed" to localStorage under `storageKey`, so the card stays
 * gone across reloads; when no key is given it dismisses for the session only.
 *
 * @param {object} props
 * @param {string} [props.title='getting started'] - the card heading (lowercase chrome).
 * @param {CliStep[]} props.steps - the onboarding steps, passed through to CliSteps.
 * @param {string} [props.storageKey] - localStorage key the dismissed flag persists under.
 * @param {() => void} [props.onDismiss] - called after the card is dismissed.
 * @param {string} [props.className] - extra classes appended to the root.
 */
export function GettingStarted({
  title = 'getting started',
  steps = [],
  storageKey,
  onDismiss,
  className = '',
  ...rest
}) {
  // Start hidden, then reconcile against storage after mount — avoids a flash of a card the user
  // already dismissed (and keeps render deterministic where there is no window).
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (readDismissed(storageKey)) setDismissed(true)
  }, [storageKey])

  const onClose = useCallback(() => {
    writeDismissed(storageKey)
    setDismissed(true)
    onDismiss?.()
  }, [storageKey, onDismiss])

  if (dismissed) return null

  const cls = ['cli-card', className].filter(Boolean).join(' ')

  return (
    <section className={cls} aria-label={title} {...rest}>
      <header className="cli-card-head">
        <span className="cli-card-title">{title}</span>
        <button
          type="button"
          className="cli-card-close"
          onClick={onClose}
          aria-label="dismiss getting started"
          title="dismiss"
        >
          <X className="cli-card-close-ic" aria-hidden="true" />
        </button>
      </header>

      <div className="cli-card-body">
        <CliSteps steps={steps} label={title} />
      </div>
    </section>
  )
}

export default CliSteps

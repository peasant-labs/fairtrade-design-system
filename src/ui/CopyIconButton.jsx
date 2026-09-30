import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import './CopyIconButton.css'

/* CopyIconButton — an icon-only copy control for a link or a command sitting beside it. The
   accessible name says what it copies ("copy link"); after a copy the icon becomes a check and the
   name becomes "copied" for a moment, and a polite live region says "copied" once. It renders
   nothing when the page has no clipboard (an insecure context), so the value beside it stays the
   way to copy by hand. Square, the shared icon-button box, never smaller than the 24px target. */

const COPIED_MS = 1600

/**
 * @param {object} props
 * @param {string} props.value - the exact text written to the clipboard.
 * @param {string} props.label - the accessible name, a verb and an object ("copy link").
 * @param {() => void} [props.onCopied] - called after a successful write.
 * @param {'sm' | 'md'} [props.size='sm'] - `sm` uses the compact control height.
 * @param {string} [props.className]
 */
export default function CopyIconButton({ value, label, onCopied, size = 'sm', className = '', ...rest }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard
  if (!canCopy) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return // a rejected write (permissions, blur) leaves the control as it was
    }
    setCopied(true)
    onCopied?.()
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  const cls = ['btn', 'btn-secondary', 'btn-icon', size === 'sm' ? 'btn-sm' : '', 'cib', copied ? 'cib-copied' : '', className].filter(Boolean).join(' ')
  return (
    <>
      <button type="button" className={cls} aria-label={copied ? 'copied' : label} title={copied ? 'copied' : label} onClick={copy} {...rest}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
      <span className="cib-status" role="status">{copied ? 'copied' : ''}</span>
    </>
  )
}

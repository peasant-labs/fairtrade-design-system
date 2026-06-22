/* ───────────────────────────────────────────────────────────────────────────
   SignIn — fairtrade "in use" component family
   ─────────────────────────────────────────────────────────────────────────
   the two-step front door for an agent product, modeled on village's
   SignInProviders + /welcome:

     1. <SignInProviders />  — a multi-provider OAuth SPLIT BUTTON. one primary
        "continue with <provider>" action + a chevron that opens a keyboard-
        operable menu of the rest (gitlab, hugging face, codeberg, sourcehut),
        each row a real provider mark + its name.
     2. <HandleClaim />      — the post-OAuth handle-claim card. a mono @-prefixed
        input with LIVE validation (available / taken / invalid, each shown with
        an icon + a WORD, never color alone), suggestion chips, and a "claim
        handle" button disabled until the handle is valid.
     3. <OnboardingCard />   — the two composed into one onboarding flow specimen.

   ── the rules this family exists to enforce ─────────────────────────────────
   • REAL marks, never a stand-in glyph. BrandMark is the source of truth, but it
     only ships claude/gemini/openai/cursor/opencode — the OAuth providers
     (github/gitlab/huggingface/codeberg/sourcehut) are not coding agents, so we
     inline simple single-color square marks for them here (currentColor, the
     same geometry-from-Simple-Icons rule BrandMark documents). every mark is
     ALWAYS paired with the provider's name (nominative fair use, no endorsement).
   • NEVER color-only status. the validation state reads as an ICON + a WORD
     ("available", "taken", "checking…") so it survives with the hue stripped
     (WCAG 1.4.1 / neuroinclusive). amber is the scarce emphasis color; the
     "taken"/"invalid" states use --clay, but the icon + word carry the meaning.
   • the user's typed handle is NEVER lowercased — chrome is lowercase mono, the
     @handle keeps the case the person typed. validation normalizes a COPY only.

   ── a11y / neuroinclusive ──────────────────────────────────────────────────
   • the split-button menu: aria-expanded on the chevron, role="menu" +
     role="menuitem" rows, roving focus (arrow keys move, Home/End jump, Esc
     closes + returns focus to the trigger), and a click-outside close.
   • the live validation message is an aria-live region so a screen reader hears
     the state change; the field points at it via aria-describedby and flags
     aria-invalid when the handle is rejected.
   • every interactive target is >= var(--target-min) (24px); the focus ring is
     the global 3px var(--focus-ring) offset 2px (nothing here suppresses it).

   tokens only — no raw hex/px. classes namespaced `si-`. transitions live in the
   .css behind prefers-reduced-motion: no-preference.
   ─────────────────────────────────────────────────────────────────────────── */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, CircleAlert, CircleSlash, LoaderCircle } from 'lucide-react'
import './SignIn.css'

/* ── provider marks ──────────────────────────────────────────────────────────
   the five OAuth providers. these are NOT coding-agent harnesses, so BrandMark
   (claude/gemini/openai/cursor/opencode) does not cover them — we inline a
   simple single-color square mark per provider here. geometry from Simple Icons
   (CC0); single-color via currentColor so each mark re-themes for free and never
   invents a hue. the mark is decorative wherever a visible name sits beside it
   (aria-hidden); the wrapper supplies the label. */
function ProviderGlyph({ provider, className = '' }) {
  const path = PROVIDER_PATH[provider]
  if (!path) return null
  const viewBox = provider === 'huggingface' ? '0 0 95 88' : '0 0 24 24'
  const classes = ['si-glyph', className].filter(Boolean).join(' ')
  return (
    <svg className={classes} viewBox={viewBox} fill="currentColor" aria-hidden="true" focusable="false">
      {Array.isArray(path) ? path.map((d, i) => <path key={i} d={d} />) : <path d={path} />}
    </svg>
  )
}

/* the single-color path geometry for each OAuth provider (Simple Icons, CC0).
   inlined so the family is self-contained in Storybook + any app, the same way
   BrandMark inlines its marks. huggingface keeps two paths (face + hair) on a
   95x88 viewBox; the rest are single 24x24 paths. */
const PROVIDER_PATH = {
  github:
    'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.807 1.305 3.492.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  gitlab:
    'm23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.4619-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z',
  huggingface: [
    'M47.21 76.07c14.85 0 26.9-12.21 26.9-27.27 0-15.05-12.05-27.26-26.9-27.26-14.85 0-26.9 12.21-26.9 27.26 0 15.06 12.05 27.27 26.9 27.27z',
    'M81.7 47.83c2.05-1.39 3.34-3.7 3.34-6.3 0-4.22-3.4-7.65-7.62-7.65-1.79 0-3.42.63-4.71 1.66a23.97 23.97 0 0 0-2.13-3.55c-4.7-6.83-12.5-11.3-21.37-11.3-8.87 0-16.66 4.47-21.36 11.3a23.97 23.97 0 0 0-2.13 3.55 7.6 7.6 0 0 0-4.71-1.66c-4.22 0-7.62 3.43-7.62 7.65 0 2.6 1.29 4.91 3.34 6.3a26.94 26.94 0 0 0-.42 4.74c0 14.85 12.05 26.9 26.9 26.9 14.85 0 26.9-12.05 26.9-26.9 0-1.62-.14-3.2-.42-4.74h.01z',
  ],
  codeberg:
    'M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 .076 1.343l11.4-15.158A12 12 0 0 0 11.955.49zm.09 0a12 12 0 0 0-.474.185L23.924 13.832A12 12 0 0 0 24 12.49 12 12 0 0 0 12.045.49zM.378 15.512A12 12 0 0 0 12 23.51a12 12 0 0 0 11.622-7.998L12 6.207z',
  sourcehut:
    'M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 2.182a9.818 9.818 0 1 1 0 19.636 9.818 9.818 0 0 1 0-19.636z',
}

/* the canonical provider list the stories + consumers iterate. `id` is the wire
   value; `label` is the human name used in the menu rows + the primary action.
   the primary (first) provider is GitHub by default. */
export const PROVIDERS = [
  { id: 'github', label: 'GitHub' },
  { id: 'gitlab', label: 'GitLab' },
  { id: 'huggingface', label: 'Hugging Face' },
  { id: 'codeberg', label: 'Codeberg' },
  { id: 'sourcehut', label: 'SourceHut' },
]

/**
 * SignInProviders — a multi-provider OAuth split button.
 *
 * the first provider is the PRIMARY action ("continue with <label>"); the rest
 * live behind a chevron that opens a keyboard-operable menu. clicking the
 * primary or any menu row calls onSignIn(providerId).
 *
 * @param {object} props
 * @param {Array<{id:string,label:string}>} [props.providers] ordered; [0] is primary. defaults to PROVIDERS.
 * @param {(id:string)=>void} [props.onSignIn] called with the chosen provider id.
 * @param {string} [props.className]
 * @returns {JSX.Element|null}
 */
export function SignInProviders({ providers = PROVIDERS, onSignIn, className = '', ...rest }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const itemRefs = useRef([])
  const menuId = useId()

  const primary = providers[0]
  const rest_ = providers.slice(1)

  /* close on a click anywhere outside the split button. */
  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  /* when the menu opens, move focus to the first row so the keyboard user lands
     inside the menu (roving focus from there). */
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus()
  }, [open])

  const choose = (id) => {
    setOpen(false)
    triggerRef.current?.focus()
    onSignIn?.(id)
  }

  /* roving focus inside the open menu: arrows move, Home/End jump, Esc closes and
     returns focus to the chevron trigger, Tab closes (focus moves on naturally). */
  const onMenuKeyDown = (e) => {
    const count = rest_.length
    const current = itemRefs.current.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      itemRefs.current[(current + 1 + count) % count]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      itemRefs.current[(current - 1 + count) % count]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      itemRefs.current[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      itemRefs.current[count - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  if (!primary) return null
  const classes = ['si-split', className].filter(Boolean).join(' ')

  return (
    <div className={classes} ref={rootRef} {...rest}>
      <div className="si-split-row">
        <button type="button" className="si-split-primary" onClick={() => onSignIn?.(primary.id)}>
          <ProviderGlyph provider={primary.id} />
          <span className="si-split-label">continue with {primary.label}</span>
        </button>
        {rest_.length > 0 && (
          <button
            type="button"
            className="si-split-caret"
            aria-label="more sign-in providers"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            onClick={() => setOpen((v) => !v)}
            ref={triggerRef}
          >
            <ChevronDown className="si-caret-icon" aria-hidden="true" />
          </button>
        )}
      </div>

      {open && rest_.length > 0 && (
        <ul className="si-menu" role="menu" id={menuId} aria-label="other providers" onKeyDown={onMenuKeyDown}>
          {rest_.map((p, i) => (
            <li key={p.id} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="si-menu-item"
                ref={(el) => (itemRefs.current[i] = el)}
                onClick={() => choose(p.id)}
              >
                <ProviderGlyph provider={p.id} className="si-menu-mark" />
                <span className="si-menu-text">continue with {p.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── handle validation ───────────────────────────────────────────────────────
   the default validator mirrors a typical backend handle rule: 3–30 chars,
   alphanumeric with single internal hyphens, starting/ending alphanumeric. it
   validates a CASE-NORMALIZED copy but the displayed handle keeps its case.
   a small built-in "taken" set lets the stories show the taken state by typing;
   a real app passes its own async `validate`. */
const HANDLE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{1,28}[A-Za-z0-9]$/
const TAKEN = new Set(['admin', 'root', 'support', 'village', 'fairtrade'])

/* the validation outcome → its icon + word + tone class. tone is ONLY a tint on
   top of the icon+word, never the sole signal (neuroinclusive). */
const STATE_META = {
  idle: null,
  checking: { Icon: LoaderCircle, word: 'checking…', tone: 'si-state-checking', spin: true },
  available: { Icon: Check, word: 'available', tone: 'si-state-ok' },
  taken: { Icon: CircleSlash, word: 'taken', tone: 'si-state-bad' },
  invalid: { Icon: CircleAlert, word: 'invalid', tone: 'si-state-bad' },
}

/* the default (synchronous) validator. returns one of idle/available/taken/invalid
   plus a hint sentence for the invalid case. a consumer can pass `validate` to
   override (e.g. an async availability check that resolves to one of these). */
function defaultValidate(raw) {
  const handle = raw.trim()
  if (!handle) return { state: 'idle' }
  const normal = handle.toLowerCase()
  if (!HANDLE_RE.test(normal)) {
    return {
      state: 'invalid',
      hint: '3–30 characters: letters, numbers, and single hyphens, starting and ending alphanumeric.',
    }
  }
  if (TAKEN.has(normal)) return { state: 'taken', hint: `@${handle} is already claimed — try another.` }
  return { state: 'available' }
}

/* turn an arbitrary string into a handle-shaped suggestion: lowercase, non-alnum
   collapsed to single hyphens, trimmed to 30. used to seed the field + chips. */
function suggest(raw) {
  if (!raw) return ''
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '')
}

/**
 * HandleClaim — the post-OAuth handle-claim card.
 *
 * a mono @-prefixed input with live validation shown as an ICON + a WORD (never
 * color alone), one or two suggestion chips, and a "claim handle" button that
 * stays disabled until the handle validates as available. the typed handle keeps
 * its case; validation normalizes a copy.
 *
 * @param {object} props
 * @param {(handle:string)=>void} [props.onSubmit] called with the typed handle on claim.
 * @param {(raw:string)=>{state:'idle'|'available'|'taken'|'invalid'|'checking',hint?:string}} [props.validate]
 *        override the validator; defaults to the built-in handle rule + taken set.
 * @param {string} [props.initialValue] seed the field (kept verbatim, case preserved).
 * @param {string} [props.suggestedFrom] a provider username to derive suggestion chips from.
 * @param {string[]} [props.suggestions] explicit suggestion chips (overrides suggestedFrom).
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export function HandleClaim({
  onSubmit,
  validate,
  initialValue = '',
  suggestedFrom = '',
  suggestions,
  className = '',
  ...rest
}) {
  const [value, setValue] = useState(initialValue)
  const [touched, setTouched] = useState(false)
  const inputRef = useRef(null)
  const msgId = useId()
  const check = validate || defaultValidate

  /* derive the suggestion chips: explicit list wins, else one derived from the
     provider username (only if it differs from what's typed). */
  const chips = useMemo(() => {
    if (suggestions?.length) return suggestions.slice(0, 2)
    const seed = suggest(suggestedFrom)
    return seed && seed !== value.toLowerCase() ? [seed] : []
  }, [suggestions, suggestedFrom, value])

  const result = check(value)
  const state = result.state
  const meta = STATE_META[state]
  const valid = state === 'available'
  /* only surface the message once the field has been touched (don't shout at an
     empty, untouched field on first paint). */
  const showMsg = touched && state !== 'idle'

  const onChange = (e) => {
    setTouched(true)
    setValue(e.target.value) // NEVER lowercase the user's handle — case preserved.
  }

  const applyChip = (chip) => {
    setTouched(true)
    setValue(chip)
    inputRef.current?.focus()
  }

  const onFormSubmit = (e) => {
    e.preventDefault()
    if (!valid) return
    onSubmit?.(value.trim())
  }

  const classes = ['si-claim', className].filter(Boolean).join(' ')

  return (
    <form className={classes} onSubmit={onFormSubmit} noValidate {...rest}>
      <div className="si-claim-head">
        <span className="si-eyebrow">welcome</span>
        <h2 className="si-claim-title">claim your handle</h2>
        <p className="si-claim-note">
          your public handle on fairtrade — <span className="si-mono">/@your-handle</span>. it is independent of the
          account you signed in with.
        </p>
      </div>

      <label className="si-field">
        <span className="si-field-label">handle</span>
        <div className="si-input" data-invalid={showMsg && (state === 'invalid' || state === 'taken') ? '' : undefined}>
          <span className="si-input-at" aria-hidden="true">
            @
          </span>
          <input
            ref={inputRef}
            type="text"
            className="si-input-field"
            value={value}
            onChange={onChange}
            placeholder="your-handle"
            maxLength={30}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="handle"
            aria-describedby={showMsg ? msgId : undefined}
            aria-invalid={showMsg && (state === 'invalid' || state === 'taken') ? true : undefined}
          />
          {meta && touched && (
            <span className={['si-input-status', meta.tone].join(' ')} aria-hidden="true">
              <meta.Icon className={['si-status-icon', meta.spin ? 'si-spin' : ''].filter(Boolean).join(' ')} />
            </span>
          )}
        </div>
      </label>

      {/* the live status line: icon + WORD (+ hint), never color alone. announced
          to assistive tech via aria-live. */}
      <p
        id={msgId}
        className={['si-status', meta ? meta.tone : ''].filter(Boolean).join(' ')}
        role="status"
        aria-live="polite"
      >
        {showMsg && meta && (
          <>
            <meta.Icon
              className={['si-status-icon', meta.spin ? 'si-spin' : ''].filter(Boolean).join(' ')}
              aria-hidden="true"
            />
            <span className="si-status-word">{meta.word}</span>
            {result.hint && <span className="si-status-hint">{result.hint}</span>}
          </>
        )}
      </p>

      {chips.length > 0 && (
        <div className="si-suggest">
          <span className="si-suggest-label">try</span>
          {chips.map((chip) => (
            <button key={chip} type="button" className="si-chip" onClick={() => applyChip(chip)}>
              @{chip}
            </button>
          ))}
        </div>
      )}

      <button type="submit" className="si-claim-submit" disabled={!valid}>
        claim handle
      </button>
    </form>
  )
}

/**
 * OnboardingCard — the two steps composed into one onboarding specimen: the
 * provider split button up top, the handle-claim card below. a thin pass-through
 * wrapper so a consumer (and the combined story) can show the whole front door.
 *
 * @param {object} props
 * @param {Array<{id:string,label:string}>} [props.providers]
 * @param {(id:string)=>void} [props.onSignIn]
 * @param {(handle:string)=>void} [props.onSubmit]
 * @param {string} [props.suggestedFrom]
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export function OnboardingCard({ providers, onSignIn, onSubmit, suggestedFrom = 'octocat', className = '', ...rest }) {
  const classes = ['si-onboard', className].filter(Boolean).join(' ')
  return (
    <div className={classes} {...rest}>
      <div className="si-onboard-step">
        <span className="si-eyebrow">step 1 — sign in</span>
        <SignInProviders providers={providers} onSignIn={onSignIn} />
      </div>
      <div className="si-onboard-divider" aria-hidden="true" />
      <HandleClaim onSubmit={onSubmit} suggestedFrom={suggestedFrom} />
    </div>
  )
}

export default SignInProviders

import { useId, useState } from 'react'
import { Eye, EyeOff, Users, Globe, Lock, Focus } from 'lucide-react'
import './VisibilityControl.css'

/* VisibilityControl — the visibility + scope control family for fairtrade, modeled on village's
   VisibilityEye + the TranscriptEditDialog segmented control, and peasant's session-detail/v2
   scope chip / focused-mode. four pieces:

     <VisibilityEye />        a small Eye / EyeOff / Users glyph + a tooltip naming the exact mode.
     <VisibilitySegmented />  a private | public segmented control, one-line description under each,
                              with a "shared" override note when the server owns the state.
     <ScopeChip />            a chip set scoping a view to task | file | change (toggle group).
     <FocusedModeToggle />    a "focused" toggle — your prompts & the replies only.

   neuroinclusive contract: state NEVER rides on color alone — every mode pairs a glyph + the word,
   and the segmented / scope / focus selections carry aria-pressed so AT and sighted users read the
   same choice. chrome is lowercased; user content (a shared group name) is NEVER lowercased.
   all visual styling + tokens live in VisibilityControl.css. every class is namespaced vc-. */

// the three visibility modes. 'shared' is a server-managed state — the segmented control offers
// only private / public and surfaces a note to override it.
const MODE = {
  public: { Icon: Eye, word: 'public', noun: 'public' },
  private: { Icon: EyeOff, word: 'private', noun: 'private' },
  shared: { Icon: Users, word: 'shared', noun: 'shared' },
}

/* the exact tooltip text naming a mode — plain words, and for shared it names the group verbatim
   ("shared with: AI Research Team") so the destination is never a guess. the group name is user
   content, so it is left exactly as given (never lowercased). */
function visibilityTooltip(visibility, sharedWith) {
  if (visibility === 'shared') {
    return sharedWith ? `shared with: ${sharedWith}` : 'shared with a group'
  }
  if (visibility === 'public') return 'public — anyone with the link can view'
  return 'private — only you can view'
}

/**
 * VisibilityEye — a compact glyph that signals a transcript's visibility, with a tooltip naming the
 * exact mode on hover / focus. Eye = public, EyeOff = private, Users = shared. The glyph is paired
 * with a visually-hidden word so the state never reads on shape or color alone.
 *
 * @param {{ visibility?: 'public'|'private'|'shared', sharedWith?: string, size?: 'sm'|'md'|'lg' }} props
 */
export function VisibilityEye({ visibility = 'private', sharedWith, size = 'md' }) {
  const tipId = useId()
  const [open, setOpen] = useState(false)
  const mode = MODE[visibility] ?? MODE.private
  const { Icon } = mode
  const tooltip = visibilityTooltip(visibility, sharedWith)

  const show = () => setOpen(true)
  const hide = () => setOpen(false)
  const onKeyDown = (e) => { if (e.key === 'Escape' && open) setOpen(false) }

  return (
    <span
      className={`vc-eye vc-eye-${size}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-describedby={tipId}
    >
      <Icon className="vc-eye-icon" aria-hidden="true" />
      {/* the word the glyph carries, for AT + as the accessible name of the focusable anchor. */}
      <span className="vc-sr">{`visibility: ${mode.word}`}</span>
      {open && (
        <span className="vc-tip" role="tooltip" id={tipId}>{tooltip}</span>
      )}
    </span>
  )
}

// the two user-selectable visibility options for the segmented control (shared is server-managed).
const SEG_OPTIONS = [
  { value: 'private', Icon: Lock, label: 'private', desc: 'Only you can view this.' },
  { value: 'public', Icon: Globe, label: 'public', desc: 'Anyone with the link can view.' },
]

/**
 * VisibilitySegmented — a private | public segmented control with a one-line description under each
 * option, and an optional "shared" override note when the server owns the state. The pressed option
 * carries aria-pressed + a leading icon + the amber selected fill, so the choice is never color-only.
 *
 * @param {{ value?: 'public'|'private'|'shared', onChange?: (v:'public'|'private')=>void,
 *           sharedNote?: string, label?: string }} props
 */
export function VisibilitySegmented({
  value = 'private',
  onChange,
  sharedNote,
  label = 'visibility',
}) {
  const groupId = useId()
  // 'shared' selects neither private nor public — the note explains the override path.
  const isShared = value === 'shared'

  return (
    <div className="vc-seg-wrap" role="group" aria-labelledby={groupId}>
      <span className="vc-seg-label" id={groupId}>{label}</span>
      <div className="vc-seg">
        {SEG_OPTIONS.map(({ value: v, Icon, label: optLabel, desc }) => {
          const pressed = value === v
          return (
            <button
              key={v}
              type="button"
              className="vc-seg-opt"
              aria-pressed={pressed}
              onClick={() => onChange?.(v)}
            >
              <span className="vc-seg-opt-head">
                <Icon className="vc-seg-opt-icon" aria-hidden="true" />
                <span className="vc-seg-opt-word">{optLabel}</span>
              </span>
              <span className="vc-seg-opt-desc">{desc}</span>
            </button>
          )
        })}
      </div>
      {isShared && (
        <p className="vc-seg-note">
          <Users className="vc-seg-note-icon" aria-hidden="true" />
          <span>{sharedNote || 'shared with one or more groups — choose private or public to override.'}</span>
        </p>
      )}
    </div>
  )
}

// the default scope set for the chip group — peasant's session-detail/v2 viewer scoping
// (task / file / change). each carries the word it shows; selection rides on aria-pressed.
const DEFAULT_SCOPES = [
  { value: 'task', label: 'task' },
  { value: 'file', label: 'file' },
  { value: 'change', label: 'change' },
]

/**
 * ScopeChip — a small toggle group scoping a view to task / file / change (a chip set). One chip is
 * pressed at a time; the pressed chip carries aria-pressed + the selected fill, so the active scope
 * never reads on color alone.
 *
 * @param {{ scope?: string, onChange?: (v:string)=>void,
 *           options?: {value:string,label:string}[], label?: string }} props
 */
export function ScopeChip({ scope = 'task', onChange, options = DEFAULT_SCOPES, label = 'scope' }) {
  const groupId = useId()
  return (
    <div className="vc-scope" role="group" aria-labelledby={groupId}>
      <span className="vc-scope-label" id={groupId}>{label}</span>
      <div className="vc-scope-set">
        {options.map(({ value, label: chipLabel }) => {
          const pressed = scope === value
          return (
            <button
              key={value}
              type="button"
              className="vc-chip"
              aria-pressed={pressed}
              onClick={() => onChange?.(value)}
            >
              {chipLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * FocusedModeToggle — a single toggle button for "focused" mode (your prompts & the assistant's
 * replies only). Carries aria-pressed + an icon + the word, so the on / off state is never color-only.
 *
 * @param {{ on?: boolean, onToggle?: (next:boolean)=>void }} props
 */
export function FocusedModeToggle({ on = false, onToggle }) {
  return (
    <button
      type="button"
      className="vc-focus"
      aria-pressed={on}
      onClick={() => onToggle?.(!on)}
    >
      <Focus className="vc-focus-icon" aria-hidden="true" />
      <span className="vc-focus-word">focused</span>
      <span className="vc-focus-hint">prompts &amp; replies only</span>
    </button>
  )
}

export default VisibilitySegmented

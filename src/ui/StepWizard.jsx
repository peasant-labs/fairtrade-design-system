import { Children, Fragment, isValidElement, useId, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import Button from './Button.jsx'
import './StepWizard.css'

/* a multi-step wizard = a horizontal StepIndicator rail + a reachability-gated linear flow,
   modeled on peasant's StepIndicator + ShareWizardClient (choose → labels → redact → submit).
   the redaction-style gate is enforced by `reachable`, never by hiding steps: a future step stays
   visible but carries aria-disabled until it's been unlocked. step state never rides on color
   alone — current = amber fill + bold number, complete = olive + check glyph, future/locked =
   hairline + dim. lowercase chrome throughout; the scarce amber marks the one current step.

   three exports share one shell: StepIndicator is the rail alone, StepWizardFrame is the shell a
   host drives (the host owns the current step and the actions), and StepWizard is the shell with
   its own state (continue / back / submit). StepWizard is built on StepWizardFrame, so there is
   one set of shell markup. */

/**
 * @typedef {Object} WizardStep
 * @property {string} id     stable id for the step (aria wiring + completed/reachable sets)
 * @property {React.ReactNode} label  the step's lowercase chrome label, shown under its number
 */

/* where a step's label hangs under its marker. a label is wider than the 28px marker, so a label
   centred on the marker spills past it on both sides: the first label would leave the rail on the
   left and the last on the right. the first label therefore starts at its marker's left edge, the
   last ends at its marker's right edge, and the rest stay centred. a lone step has no neighbour
   to share with, so it starts at its marker and may take the whole rail. the geometry for each
   place is in StepWizard.css on the modifier class named here. */
const LABEL_PLACE = Object.freeze({
  only: 'only',
  start: 'start',
  middle: 'middle',
  end: 'end',
})

/**
 * The place of the step at `index` among `count` steps.
 * @param {number} index zero-based position of the step
 * @param {number} count how many steps the rail holds
 * @returns {string} one of the LABEL_PLACE values
 */
function labelPlace(index, count) {
  if (count <= 1) return LABEL_PLACE.only
  if (index === 0) return LABEL_PLACE.start
  if (index === count - 1) return LABEL_PLACE.end
  return LABEL_PLACE.middle
}

/**
 * The text a label reads as, for a label passed as a string, a number, or a node holding them.
 * @param {React.ReactNode} node
 * @returns {string}
 */
function textOf(node) {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return Children.toArray(node.props.children).map(textOf).join('')
  return ''
}

/**
 * The words of a label: the runs between whitespace. A label never breaks inside one, so a
 * hyphenated word ("auto-ingest") counts whole.
 * @param {React.ReactNode} label
 * @returns {string[]}
 */
function wordsOf(label) {
  return textOf(label).split(/\s+/).filter(Boolean)
}

/**
 * The longest word, in characters, among the labels at the given places. The labels are drawn in
 * the mono face, so a word's width is its character count in `ch`: the rail hands the stylesheet
 * these counts and the stylesheet decides, with no measuring, whether every word fits its share.
 * @param {ReadonlyArray<WizardStep>} steps
 * @param {ReadonlyArray<string>} places the LABEL_PLACE values to read
 * @returns {number}
 */
function longestWord(steps, places) {
  let longest = 0
  steps.forEach((step, index) => {
    if (!places.includes(labelPlace(index, steps.length))) return
    for (const word of wordsOf(step.label)) longest = Math.max(longest, [...word].length)
  })
  return longest
}

/**
 * A label as it is drawn: a string label is set word by word, each word unbreakable, with the
 * spaces between them as the only places it may wrap. A label passed as a node is drawn as given.
 * @param {React.ReactNode} label
 * @returns {React.ReactNode}
 */
function labelWords(label) {
  if (typeof label !== 'string') return label
  const words = wordsOf(label)
  // the space between two words sits outside both, so it stays the one place a line may break.
  return words.map((word, index) => (
    <Fragment key={index}>{index > 0 ? ' ' : null}<span className="swz-word">{word}</span></Fragment>
  ))
}

/**
 * The rail alone: numbered square markers joined by connector lines. Pure/controlled — it owns no
 * state. current = amber fill + bold near-black number + aria-current="step"; completed = olive +
 * check glyph (clickable to jump back); future/unreachable = hairline + --ink-4 + aria-disabled
 * (not clickable). Completed steps are always reachable.
 *
 * Labels stay inside the rail at any width and step count. The first label starts at the first
 * marker's left edge, the last ends at the last marker's right edge, and the others are centred
 * on their markers. Each label wraps between its words inside its own share of the rail, so
 * neighbours never overlap, and a label never breaks inside a word and is never cut with an
 * ellipsis. When any label's longest word does not fit that label's share, or the rail is too
 * narrow for its first and last labels to hold five characters, every label is hidden from sight
 * together and stays in the accessible name; the numbers carry the rail. A lone step may take the
 * whole rail and shows while its own longest word fits it; it hides with the rest when that word
 * does not. A label passed as a node is measured from its text.
 *
 * The rail is the container its label shares are measured against (`container-type: inline-size`),
 * so it needs a host with a definite inline size: a block, a grid track, or a flex item that has
 * a width. In a shrink-to-fit host (an inline-flex box, or an absolutely positioned box with
 * `width: auto`) it collapses to zero width.
 *
 * @param {Object} props
 * @param {ReadonlyArray<WizardStep>} props.steps        the ordered steps
 * @param {string} props.current            id of the active step
 * @param {ReadonlySet<string>} [props.completed]   ids of finished steps (olive + check, jump-back enabled)
 * @param {ReadonlySet<string>} [props.reachable]   ids the user may jump to (the gate). current + completed are implicitly reachable
 * @param {(id: string) => void} [props.onJump]  called with a step id when a reachable/complete marker is activated
 * @param {string} [props['aria-label']]    accessible name for the rail (default "progress")
 */
export function StepIndicator({
  steps,
  current,
  completed = new Set(),
  reachable = new Set(),
  onJump,
  'aria-label': ariaLabel = 'progress',
}) {
  // the label shares are arithmetic on the rail's width and its gap count; the rail carries the
  // count so the stylesheet can do that arithmetic (a lone step has no gap, but the share maths
  // never divides by zero). it also carries the longest word of its middle labels, of its first
  // and last labels, and of a lone label, in characters, so the stylesheet can hide every label
  // when a word does not fit (a lone label may take the whole rail).
  const railStyle = {
    '--swz-gaps': Math.max(steps.length - 1, 1),
    '--swz-word-middle': longestWord(steps, [LABEL_PLACE.middle]),
    '--swz-word-edge': longestWord(steps, [LABEL_PLACE.start, LABEL_PLACE.end]),
    '--swz-word-only': longestWord(steps, [LABEL_PLACE.only]),
  }
  return (
    <nav className="swz-rail" style={railStyle} aria-label={ariaLabel}>
      {steps.map((step, idx) => {
        const isCurrent = step.id === current
        const isComplete = completed.has(step.id)
        // a marker is navigable if it's done, or explicitly reachable — but never the current one.
        const canJump = !isCurrent && (isComplete || reachable.has(step.id))
        const isLocked = !isCurrent && !canJump

        const stateClass = isCurrent
          ? 'swz-step--current'
          : isComplete
            ? 'swz-step--complete'
            : canJump
              ? 'swz-step--reachable'
              : 'swz-step--locked'

        // the connector behind a marker reads "done" once the previous step is complete.
        const prevDone = idx > 0 && completed.has(steps[idx - 1].id)

        return (
          <div key={step.id} className="swz-cell" style={{ flex: idx === 0 ? '0 0 auto' : '1 1 0' }}>
            {idx > 0 && <span className={`swz-line${prevDone ? ' swz-line--done' : ''}`} aria-hidden="true" />}
            <button
              type="button"
              className={`swz-step ${stateClass}`}
              onClick={() => { if (canJump) onJump?.(step.id) }}
              disabled={isLocked}
              aria-current={isCurrent ? 'step' : undefined}
              aria-disabled={isLocked || undefined}
            >
              <span className="swz-mark">
                {isComplete
                  ? <Check className="swz-mark-check" size={14} aria-hidden="true" />
                  : idx + 1}
              </span>
              <span className={`swz-label swz-label--${labelPlace(idx, steps.length)}`}>{labelWords(step.label)}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}

/* this `swz-cell` only needs flex on the connectors; the first cell hugs its marker (no leading
   line), the rest share the remaining width so the rail spans its container evenly. */

/**
 * The shell a host drives. Controlled: the host decides the current step and what the footer's
 * actions do, so a server-driven flow renders the step the server chose without re-creating the
 * shell's markup. The frame is a head (the rail, plus anything the host adds under it), a body
 * (the children), and a foot with the host's start action, the "step n / m" count on the foot's
 * centre line, and the host's end action.
 *
 * The count names the current step by its position in `steps`. When `current` names no step the
 * count reads "step 0 / m" and no marker is current.
 *
 * @param {Object} props
 * @param {ReadonlyArray<WizardStep>} props.steps        the ordered steps (>= 1)
 * @param {string} props.current            id of the active step
 * @param {ReadonlySet<string>} [props.completed]   ids of finished steps
 * @param {ReadonlySet<string>} [props.reachable]   ids the user may jump to
 * @param {(id: string) => void} [props.onJump]  called with a step id when a reachable/complete marker is activated
 * @param {React.ReactNode} [props.head]    shown in the head, under the rail
 * @param {React.ReactNode} [props.footStart]  the foot's start slot (typically back)
 * @param {React.ReactNode} [props.footEnd]    the foot's end slot (typically the one primary action)
 * @param {React.HTMLAttributes<HTMLDivElement>} [props.bodyProps]  attributes for the body region (id, role, aria-label, tabIndex)
 * @param {string} [props.className]        extra class on the frame, for a host that sizes it
 * @param {React.ReactNode} [props.children]  the body
 * @param {string} [props['aria-label']]    accessible name for the frame (default "step wizard"); its rail is named "<aria-label> progress". last in this list on purpose: the
 *   declaration generator stops reading a destructured props list at a quoted name, so every prop after it would be lost to a TypeScript host.
 *   a host passes `aria-label` as a JSX attribute, which TypeScript does not check against the props type.
 */
export function StepWizardFrame({
  steps,
  current,
  completed,
  reachable,
  onJump,
  'aria-label': ariaLabel = 'step wizard',
  head,
  footStart,
  footEnd,
  bodyProps,
  className,
  children,
}) {
  const position = steps.findIndex((step) => step.id === current) + 1
  // React draws nothing for null, undefined or a boolean, so none of them earns a slot (and its margin).
  const hasHead = head != null && typeof head !== 'boolean'
  const { className: bodyClassName, ...bodyRest } = bodyProps ?? {}
  return (
    <section className={className ? `swz ${className}` : 'swz'} aria-label={ariaLabel}>
      <div className="swz-head">
        <StepIndicator
          steps={steps}
          current={current}
          completed={completed}
          reachable={reachable}
          onJump={onJump}
          aria-label={`${ariaLabel} progress`}
        />
        {hasHead && <div className="swz-head-slot">{head}</div>}
      </div>

      <div {...bodyRest} className={bodyClassName ? `swz-body ${bodyClassName}` : 'swz-body'}>
        {children}
      </div>

      <div className="swz-foot">
        <div className="swz-foot-start">{footStart}</div>
        <span className="swz-count">
          <span className="swz-sr-only">step {position} of {steps.length}</span>
          <span aria-hidden="true">
            step <span className="tnum">{position}</span> / <span className="tnum">{steps.length}</span>
          </span>
        </span>
        <div className="swz-foot-end">{footEnd}</div>
      </div>
    </section>
  )
}

/**
 * @typedef {Object} WizardBodyArgs
 * @property {WizardStep} step      the active step descriptor
 * @property {number} index         its zero-based position
 * @property {boolean} isLast       whether it's the final step
 * @property {(valid: boolean) => void} setValid  report whether the step may advance (gates continue)
 */

/**
 * Uncontrolled wizard: the rail + a per-step body slot + a sticky footer action bar.
 * Tracks current / completed / reachable internally. Continue advances, marks the step complete,
 * and unlocks the next step; on the last step its primary action reads "submit" and fires
 * onComplete. Back is enabled on every step except the first.
 *
 * Step bodies come from either `children` (an array, one node per step — index-aligned to `steps`)
 * or a `renderStep` render-prop called with {step, index, isLast, setValid}. A step is advanceable
 * unless its render-prop has reported setValid(false); plain-children bodies are always valid.
 *
 * @param {Object} props
 * @param {ReadonlyArray<WizardStep>} props.steps   the ordered steps (>= 1)
 * @param {(args: { completed: Set<string> }) => void} [props.onComplete]  fired when the last step's submit is activated
 * @param {(args: WizardBodyArgs) => React.ReactNode} [props.renderStep]   render-prop for the active step's body
 * @param {React.ReactNode[]} [props.children]  index-aligned step bodies (alternative to renderStep)
 * @param {string} [props.continueLabel='continue']  primary label for non-final steps
 * @param {string} [props.submitLabel='submit']      primary label for the final step
 * @param {string} [props.backLabel='back']          secondary (back) label
 * @param {string} [props['aria-label']]  accessible name for the wizard (default "step wizard"); its rail is named "<aria-label> progress"
 */
export default function StepWizard({
  steps,
  onComplete,
  renderStep,
  children,
  continueLabel = 'continue',
  submitLabel = 'submit',
  backLabel = 'back',
  'aria-label': ariaLabel,
}) {
  const baseId = useId()
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState(() => new Set())
  // the gate: ids the user may jump to. step 0 is reachable from the start; continue unlocks more.
  const [reachable, setReachable] = useState(() => new Set(steps.length ? [steps[0].id] : []))
  // per-step validity, keyed by step id. absence means "valid" (plain bodies never block).
  const [validity, setValidity] = useState(() => ({}))

  const current = steps[index]
  const isLast = index === steps.length - 1
  const stepValid = validity[current?.id] !== false

  const bodyArr = useMemo(
    () => (Array.isArray(children) ? children : children != null ? [children] : null),
    [children],
  )

  const setValid = (valid) => {
    setValidity((v) => (v[current.id] === valid ? v : { ...v, [current.id]: valid }))
  }

  const goTo = (id) => {
    const next = steps.findIndex((s) => s.id === id)
    if (next >= 0) setIndex(next)
  }

  const back = () => { if (index > 0) setIndex(index - 1) }

  const advance = () => {
    if (!stepValid) return
    // mark the current step complete (and thus permanently reachable).
    setCompleted((c) => new Set(c).add(current.id))
    if (isLast) {
      const done = new Set(completed).add(current.id)
      onComplete?.({ completed: done })
      return
    }
    // unlock + move to the next step.
    const next = steps[index + 1]
    setReachable((r) => new Set(r).add(next.id))
    setIndex(index + 1)
  }

  const body = renderStep
    ? renderStep({ step: current, index, isLast, setValid })
    : bodyArr?.[index] ?? null

  const panelId = `${baseId}-panel`

  return (
    <StepWizardFrame
      steps={steps}
      current={current?.id}
      completed={completed}
      reachable={reachable}
      onJump={goTo}
      aria-label={ariaLabel}
      bodyProps={{
        id: panelId,
        role: 'group',
        'aria-label': current ? `step ${index + 1}: ${current.label}` : undefined,
        tabIndex: -1,
      }}
      footStart={(
        <Button variant="ghost" onClick={back} disabled={index === 0}>
          {backLabel}
        </Button>
      )}
      footEnd={(
        <Button
          variant="primary"
          onClick={advance}
          disabled={!stepValid}
          aria-controls={panelId}
        >
          {isLast ? submitLabel : continueLabel}
        </Button>
      )}
    >
      <span className="swz-body-kicker">
        step {index + 1}: {current?.label}
      </span>
      {body}
    </StepWizardFrame>
  )
}

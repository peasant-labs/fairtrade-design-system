import { useId, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import Button from './Button.jsx'
import './StepWizard.css'

/* a multi-step wizard = a horizontal StepIndicator rail + a reachability-gated linear flow,
   modeled on peasant's StepIndicator + ShareWizardClient (choose → labels → redact → submit).
   the redaction-style gate is enforced by `reachable`, never by hiding steps: a future step stays
   visible but carries aria-disabled until it's been unlocked. step state never rides on color
   alone — current = amber fill + bold number, complete = olive + check glyph, future/locked =
   hairline + dim. lowercase chrome throughout; the scarce amber marks the one current step. */

/**
 * @typedef {Object} WizardStep
 * @property {string} id     stable id for the step (aria wiring + completed/reachable sets)
 * @property {React.ReactNode} label  the step's lowercase chrome label, shown under its number
 */

/**
 * The rail alone: numbered square markers joined by connector lines. Pure/controlled — it owns no
 * state. current = amber fill + bold near-black number + aria-current="step"; completed = olive +
 * check glyph (clickable to jump back); future/unreachable = hairline + --ink-4 + aria-disabled
 * (not clickable). Completed steps are always reachable.
 *
 * @param {Object} props
 * @param {WizardStep[]} props.steps        the ordered steps
 * @param {string} props.current            id of the active step
 * @param {Set<string>} [props.completed]   ids of finished steps (olive + check, jump-back enabled)
 * @param {Set<string>} [props.reachable]   ids the user may jump to (the gate). current + completed are implicitly reachable
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
  return (
    <nav className="sw-rail" aria-label={ariaLabel}>
      {steps.map((step, idx) => {
        const isCurrent = step.id === current
        const isComplete = completed.has(step.id)
        // a marker is navigable if it's done, or explicitly reachable — but never the current one.
        const canJump = !isCurrent && (isComplete || reachable.has(step.id))
        const isLocked = !isCurrent && !canJump

        const stateClass = isCurrent
          ? 'sw-step--current'
          : isComplete
            ? 'sw-step--complete'
            : canJump
              ? 'sw-step--reachable'
              : 'sw-step--locked'

        // the connector behind a marker reads "done" once the previous step is complete.
        const prevDone = idx > 0 && completed.has(steps[idx - 1].id)

        return (
          <div key={step.id} className="sw-cell" style={{ flex: idx === 0 ? '0 0 auto' : '1 1 0' }}>
            {idx > 0 && <span className={`sw-line${prevDone ? ' sw-line--done' : ''}`} aria-hidden="true" />}
            <button
              type="button"
              className={`sw-step ${stateClass}`}
              onClick={() => { if (canJump) onJump?.(step.id) }}
              disabled={isLocked}
              aria-current={isCurrent ? 'step' : undefined}
              aria-disabled={isLocked || undefined}
            >
              <span className="sw-mark">
                {isComplete
                  ? <Check className="sw-mark-check" size={14} aria-hidden="true" />
                  : idx + 1}
              </span>
              <span className="sw-label">{step.label}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}

/* this `sw-cell` only needs flex on the connectors; the first cell hugs its marker (no leading
   line), the rest share the remaining width so the rail spans its container evenly. */

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
 * @param {WizardStep[]} props.steps   the ordered steps (>= 1)
 * @param {(args: { completed: Set<string> }) => void} [props.onComplete]  fired when the last step's submit is activated
 * @param {(args: WizardBodyArgs) => React.ReactNode} [props.renderStep]   render-prop for the active step's body
 * @param {React.ReactNode[]} [props.children]  index-aligned step bodies (alternative to renderStep)
 * @param {string} [props.continueLabel='continue']  primary label for non-final steps
 * @param {string} [props.submitLabel='submit']      primary label for the final step
 * @param {string} [props.backLabel='back']          secondary (back) label
 * @param {string} [props['aria-label']]  accessible name for the rail
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
    <section className="sw" aria-label={ariaLabel ?? 'step wizard'}>
      <div className="sw-head">
        <StepIndicator
          steps={steps}
          current={current?.id}
          completed={completed}
          reachable={reachable}
          onJump={goTo}
          aria-label={ariaLabel ?? 'progress'}
        />
      </div>

      <div
        className="sw-body"
        id={panelId}
        role="group"
        aria-label={current ? `step ${index + 1}: ${current.label}` : undefined}
        tabIndex={-1}
      >
        <span className="sw-body-kicker">
          step {index + 1} — {current?.label}
        </span>
        {body}
      </div>

      <div className="sw-foot">
        <Button variant="ghost" onClick={back} disabled={index === 0}>
          {backLabel}
        </Button>
        <span className="sw-count" aria-hidden="true">
          {index + 1} / {steps.length}
        </span>
        <Button
          variant="primary"
          onClick={advance}
          disabled={!stepValid}
          aria-controls={panelId}
        >
          {isLast ? submitLabel : continueLabel}
        </Button>
      </div>
    </section>
  )
}

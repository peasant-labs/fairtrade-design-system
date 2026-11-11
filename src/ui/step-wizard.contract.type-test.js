// @ts-check
/* Contract type-test for the step wizard's public props. A TypeScript host (peasant) reads the
   props the declaration generator derives from the JSDoc in StepWizard.jsx, and that generator
   stops at a quoted prop name such as `props['aria-label']`: every prop listed after it vanishes
   from the type, and a host that passes a slot then fails to compile. This file imports the
   BARREL, as a host does, and assigns every prop a host passes to the derived props type, so a
   prop that is dropped from the type fails `pnpm test:contract`.

   Enforced by `pnpm test:contract` (tsc -p tsconfig.contract.json). */

import { StepIndicator, StepWizard, StepWizardFrame } from './index.js'

/** @type {Parameters<typeof StepWizardFrame>[0]} */
const frame = {
  steps: [{ id: 'choose', label: 'choose' }, { id: 'review', label: 'review' }],
  current: 'choose',
  completed: new Set(['choose']),
  reachable: /** @type {ReadonlySet<string>} */ (new Set(['choose', 'review'])),
  onJump: (id) => {
    /** @type {string} */
    const jumped = id
    void jumped
  },
  progressLabel: 'where you are',
  head: 'a note under the rail',
  footStart: 'back',
  footEnd: 'continue',
  bodyProps: { id: 'panel', role: 'group', tabIndex: -1 },
  className: 'host-frame',
  children: 'the body',
}
void frame

/** @type {Parameters<typeof StepWizardFrame>[0]} */
// @ts-expect-error - the current step is required: the host decides it
const withoutCurrent = { steps: [{ id: 'choose', label: 'choose' }] }
void withoutCurrent

/** @type {Parameters<typeof StepWizardFrame>[0]} */
// @ts-expect-error - a step needs an id, so the host's completed and reachable sets can name it
const stepWithoutId = { steps: [{ label: 'choose' }], current: 'choose' }
void stepWithoutId

/** @type {Parameters<typeof StepIndicator>[0]} */
const rail = { steps: [{ id: 'choose', label: 'choose' }], current: 'choose', reachable: new Set(['choose']) }
void rail

/** @type {Parameters<typeof StepWizard>[0]} */
const wizard = { steps: [{ id: 'choose', label: 'choose' }], onComplete: ({ completed }) => void completed.size }
void wizard

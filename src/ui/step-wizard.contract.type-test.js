// @ts-check
/* Contract type-test for the step wizard's public props. A TypeScript host (peasant) reads the
   props the declaration generator derives from the JSDoc in StepWizard.jsx, and that generator
   stops at a quoted prop name such as `props['aria-label']`: every prop listed after it vanishes
   from the type, and a host that passes a slot then fails to compile. This file imports the
   BARREL, as a host does, and assigns every prop a host passes to the derived props type, so a
   prop that is dropped from the type fails `pnpm test:contract`.

   Enforced by `pnpm test:contract` (tsc -p tsconfig.contract.json). */

import { GraphAppShell, StepIndicator, StepWizard, StepWizardFrame } from './index.js'
import { createElement } from 'react'

/** @type {Parameters<typeof StepWizardFrame>[0]} */
const frame = {
  steps: [{ id: 'choose', label: 'choose', shortLabel: 'pick' }, { id: 'review', label: 'review' }],
  current: 'choose',
  completed: new Set(['choose']),
  reachable: /** @type {ReadonlySet<string>} */ (new Set(['choose', 'review'])),
  onJump: (id) => {
    /** @type {string} */
    const jumped = id
    void jumped
  },
  head: 'a note under the rail',
  footStart: 'back',
  footEnd: 'continue',
  footerProgress: true,
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
const rail = { steps: [{ id: 'choose', label: 'choose', shortLabel: 'pick' }], current: 'choose', reachable: new Set(['choose']), singleLine: true }
void rail

/** @type {Parameters<typeof StepWizard>[0]} */
const wizard = { steps: [{ id: 'choose', label: 'choose' }], onComplete: ({ completed }) => void completed.size }
void wizard

// a host that keeps its steps in a readonly array (peasant's `readonly FrameStep[]`) passes them to all three.
/** @type {readonly { id: string, label: string }[]} */
const readonlySteps = [{ id: 'choose', label: 'choose' }, { id: 'review', label: 'review' }]

/** @type {Parameters<typeof StepWizardFrame>[0]} */
const readonlyFrame = { steps: readonlySteps, current: 'choose' }
void readonlyFrame

/** @type {Parameters<typeof StepIndicator>[0]} */
const readonlyRail = { steps: readonlySteps, current: 'choose' }
void readonlyRail

/** @type {Parameters<typeof StepWizardFrame>[0]} */
const nodeLabelFrame = { steps: [{ id: 'mixed', label: createElement('strong', null, 'Mixed Case'), shortLabel: 'brief' }], current: 'mixed', footerProgress: true }
void nodeLabelFrame

/** @type {Parameters<typeof StepWizardFrame>[0]} */
// @ts-expect-error - a short visual label is text, not a number
const invalidShortLabelFrame = { steps: [{ id: 'mixed', label: 'Mixed Case', shortLabel: 7 }], current: 'mixed', footerProgress: true }
void invalidShortLabelFrame

const shellWithTitle = () => GraphAppShell({ activeId: 'kickstart', activePrimaryId: undefined, onSectionChange: undefined, backTo: undefined, onBack: undefined, children: null, navEnd: createElement('h2', null, 'set up peasant') })
void shellWithTitle

/** @type {Parameters<typeof StepWizard>[0]} */
const readonlyWizard = { steps: readonlySteps }
void readonlyWizard

import { useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import StepWizard, { StepIndicator, StepWizardFrame } from './StepWizard.jsx'
import Button from './Button.jsx'
import { frame, FRAME_W } from './story-frame.jsx'

/* CSF3 stories for the multi-step wizard. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. Default drives a real "contribute
   to the commons" flow (choose → labels → redact → submit) with working next/back and a
   reachability gate; the Indicator story shows the rail alone in mixed states; Controlled shows a
   host driving the frame (the host owns the current step); LabelsInsideFrame measures every label
   against its rail for 1 to 10 steps, narrow and wide. */

const STEPS = [
  { id: 'choose', label: 'choose' },
  { id: 'labels', label: 'labels' },
  { id: 'redact', label: 'redact' },
  { id: 'submit', label: 'submit' },
]

const meta = {
  title: 'in use/StepWizard',
  component: StepWizard,
  tags: ['autodocs'],
}
export default meta

/* the full flow: four steps, placeholder bodies, working continue/back. continue marks the step
   complete and unlocks the next; the play test walks choose → labels and asserts the gate opens. */
export const Default = {
  decorators: frame('wide'),
  render: () => (
    <StepWizard
      steps={STEPS}
      aria-label="contribute to the commons"
      onComplete={() => {}}
    >
      <p>pick the transcripts you want to contribute to the commons.</p>
      <p>apply labels so others can find the right examples.</p>
      <p>review and redact anything sensitive before it leaves your machine.</p>
      <p>submit your contribution. thank you for feeding the collective.</p>
    </StepWizard>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // step 1 is current; the rest are visible. "labels" starts locked (aria-disabled).
    const labels = canvas.getByRole('button', { name: /labels/i })
    await expect(labels).toHaveAttribute('aria-disabled', 'true')

    // continue marks "choose" complete and unlocks "labels".
    await userEvent.click(canvas.getByRole('button', { name: 'continue' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: /labels/i })).toHaveAttribute('aria-current', 'step'))

    // back returns to a now-complete "choose" (a check glyph, jump-back enabled).
    await userEvent.click(canvas.getByRole('button', { name: 'back' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: /choose/i })).toHaveAttribute('aria-current', 'step'))
  },
}

/* the rail alone, in mixed states: 2 complete (olive + check), 1 current (amber), 1 locked
   (hairline + dim, aria-disabled). controlled — onJump is a no-op here. */
export const Indicator = {
  decorators: frame('wide'),
  render: () => (
    <StepIndicator
      steps={STEPS}
      current="redact"
      completed={new Set(['choose', 'labels'])}
      reachable={new Set(['choose', 'labels', 'redact'])}
      onJump={() => {}}
      aria-label="contribute progress"
    />
  ),
}

/* a host driving the frame. the host owns the current step and the footer actions (here a plain
   state hook; in an app it is whatever the server says the step is). three steps is the case that
   used to push the first label past the frame's left edge. */
const CONTROLLED_STEPS = [
  { id: 'choose', label: 'choose' },
  { id: 'labels', label: 'labels' },
  { id: 'review', label: 'review' },
]

function HostedWizard() {
  const [current, setCurrent] = useState('choose')
  const index = CONTROLLED_STEPS.findIndex((step) => step.id === current)
  const completed = new Set(CONTROLLED_STEPS.slice(0, index).map((step) => step.id))
  const reachable = new Set(CONTROLLED_STEPS.slice(0, index + 1).map((step) => step.id))
  const last = index === CONTROLLED_STEPS.length - 1
  return (
    <StepWizardFrame
      steps={CONTROLLED_STEPS}
      current={current}
      completed={completed}
      reachable={reachable}
      onJump={setCurrent}
      aria-label="set up the commons"
      head={<p className="swz-body-kicker">the host decides the step</p>}
      footStart={(
        <Button variant="ghost" disabled={index === 0} onClick={() => setCurrent(CONTROLLED_STEPS[index - 1].id)}>
          back
        </Button>
      )}
      footEnd={(
        <Button variant="primary" disabled={last} onClick={() => setCurrent(CONTROLLED_STEPS[index + 1].id)}>
          continue
        </Button>
      )}
    >
      <p>{CONTROLLED_STEPS[index].label}: the body is whatever the host renders for this step.</p>
    </StepWizardFrame>
  )
}

export const Controlled = {
  decorators: frame('panel'),
  render: () => <HostedWizard />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // the count is announced once, as words, and drawn as "step n / m".
    await expect(canvas.getByText('step 1 of 3')).toBeInTheDocument()
    await expect(canvasElement.querySelector('.swz-count [aria-hidden="true"]')).toHaveTextContent('step 1 / 3')
    await expect(canvas.getByRole('button', { name: /choose/i })).toHaveAttribute('aria-current', 'step')

    // the host's continue moves the step; the frame follows it.
    await userEvent.click(canvas.getByRole('button', { name: 'continue' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: /labels/i })).toHaveAttribute('aria-current', 'step'))
    await expect(canvas.getByText('step 2 of 3')).toBeInTheDocument()

    // a completed marker jumps back through onJump.
    await userEvent.click(canvas.getByRole('button', { name: /choose/i }))
    await waitFor(() => expect(canvas.getByRole('button', { name: /choose/i })).toHaveAttribute('aria-current', 'step'))
  },
}

/* ── labels inside the frame ───────────────────────────────────────────────────────────────────
   one frame for every step count from 1 to 10, at a narrow and a wide width. the play function
   measures each label against its own rail: inside it, anchored to its marker (the first starts at
   the first marker's left edge, the last ends at the last marker's right edge, the rest are centred),
   clear of its neighbours, and not clipped. a rail too narrow for its first and last labels to hold
   five characters hides all its labels from sight, and they stay in the accessible name: the play
   function asks for each marker by role and name, which leaves out anything hidden with `display` or
   `visibility`. the floor is written in characters of the label's own face, and the face is whatever
   monospace the host has (this story loads no font), so how many steps keep their labels differs
   between machines: the play function reads the stylesheet's own floor at the label and works the rule
   out for each frame, checks that floor against the rule as stated (an edge label's room against five
   characters), and two anchors hold in any face (up to three steps always show, ten steps on the narrow frame never do). narrow is a phone:
   ten 28px markers need about 280px of rail, so a narrower frame cannot hold ten steps at all. */
const MATRIX_LABELS = ['welcome', 'projects', 'sessions', 'redaction', 'review', 'license', 'collectives', 'share', 'confirm', 'done']
const MATRIX_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const MATRIX_WIDTHS = { narrow: 360, wide: FRAME_W.wide }
// true in every monospace face: three steps always have room, ten steps on the narrow frame never do
// (a share of about 27px against a floor of at least 30px, whatever the face).
const ALWAYS_SHOWN_UP_TO = 3
const NARROW_NEVER_SHOWN_AT = 10
const TOLERANCE = 0.5

function matrixSteps(count) {
  return MATRIX_LABELS.slice(0, count).map((label, index) => ({ id: `step-${index + 1}`, label }))
}

function MatrixFrame({ count, width }) {
  const steps = matrixSteps(count)
  const index = Math.floor((count - 1) / 2)
  // the foot is sticky, so each frame sits in a box that scrolls on its own: on a long page of
  // frames the feet would otherwise pin to the viewport. the box never overflows unless a label does.
  return (
    <div data-case-width={width} style={{ width: MATRIX_WIDTHS[width], maxWidth: '100%', overflow: 'auto' }}>
      <StepWizardFrame
        steps={steps}
        current={steps[index].id}
        completed={new Set(steps.slice(0, index).map((step) => step.id))}
        reachable={new Set(steps.slice(0, index + 1).map((step) => step.id))}
        aria-label={`${count} ${count === 1 ? 'step' : 'steps'}, ${width}`}
        bodyProps={{ style: { minHeight: 0 } }}
      >
        <span className="swz-body-kicker">{count} {count === 1 ? 'step' : 'steps'}</span>
      </StepWizardFrame>
    </div>
  )
}

function LabelMatrix() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 'var(--sp-5)', padding: 'var(--sp-5)', justifyContent: 'start' }}>
      {MATRIX_COUNTS.flatMap((count) => Object.keys(MATRIX_WIDTHS).map((width) => (
        <MatrixFrame key={`${count}-${width}`} count={count} width={width} />
      )))}
    </div>
  )
}

/** The place a label was given: the suffix of its `swz-label--<place>` class. */
function placeOf(label) {
  const modifier = [...label.classList].find((name) => name.startsWith('swz-label--'))
  return modifier ? modifier.slice('swz-label--'.length) : ''
}

/**
 * A length as the label sees it, in px. A probe is the only way to read one: a custom property that
 * holds a calc (the label floor) is not resolved until it is used as a length, and `ch` is the width
 * of a character of the label's own face.
 */
function measure(label, length) {
  const probe = document.createElement('span')
  probe.style.cssText = `position: absolute; visibility: hidden; width: ${length}`
  label.appendChild(probe)
  const width = probe.getBoundingClientRect().width
  probe.remove()
  return width
}

// the rule as the stylesheet states it: a rail shows its labels when its first and last labels, the
// tightest, can hold this many characters of the label's own face.
const EDGE_CHARACTERS = 5

/**
 * Whether a rail should show its labels, worked out two ways. `shown` follows the stylesheet's own
 * floor (`--swz-label-floor`, read at the label): the middle label's share against that floor.
 * `documented` follows the rule as stated: an edge label's room, half a marker plus half the share,
 * against five characters (one `ch`, read the same way). The two must agree, so a floor that drifts
 * from the stated rule fails here. Each is true, false, or null when it sits within half a pixel of
 * its line and rounding decides. A lone step always shows. A middle label's share is the distance
 * between neighbouring marker centres, less the gutter.
 */
function labelsShown(rail, label, count, gutter) {
  if (count === 1) return { shown: true, documented: true, edgeRoom: null }
  const marker = rail.querySelector('.swz-mark').getBoundingClientRect().width
  const share = (rail.getBoundingClientRect().width - marker) / (count - 1) - gutter
  const edgeRoom = (marker + share) / 2
  const decide = (room) => (Math.abs(room) <= TOLERANCE ? null : room > 0)
  return {
    shown: decide(share - measure(label, 'var(--swz-label-floor)')),
    documented: decide(edgeRoom - EDGE_CHARACTERS * measure(label, '1ch')),
    edgeRoom,
  }
}

/** Every way the labels of one frame break the rule, as readable lines. Empty when none. */
function labelProblems(section, width, gutter) {
  const name = section.getAttribute('aria-label')
  const problems = []
  const railElement = section.querySelector('.swz-rail')
  const rail = railElement.getBoundingClientRect()
  const cells = [...section.querySelectorAll('.swz-step')]
  const { shown, documented, edgeRoom } = labelsShown(railElement, cells[0].querySelector('.swz-label'), cells.length, gutter)
  const anchored = cells.length <= ALWAYS_SHOWN_UP_TO ? true : width === 'narrow' && cells.length === NARROW_NEVER_SHOWN_AT ? false : null
  const canvas = within(section)
  if (shown !== null && documented !== null && shown !== documented) {
    problems.push(`${name}: the stylesheet's floor ${shown ? 'shows' : 'hides'} the labels, but the stated rule ${documented ? 'shows' : 'hides'} them (edge labels have ${edgeRoom.toFixed(1)}px against ${EDGE_CHARACTERS} characters)`)
  }
  let previous = null
  cells.forEach((cell, index) => {
    const label = cell.querySelector('.swz-label')
    const box = label.getBoundingClientRect()
    const marker = cell.querySelector('.swz-mark').getBoundingClientRect()
    const place = placeOf(label)
    if (box.left < rail.left - TOLERANCE || box.right > rail.right + TOLERANCE) {
      problems.push(`${name}: label ${index + 1} (${place}) leaves its rail: label ${box.left.toFixed(1)}..${box.right.toFixed(1)}, rail ${rail.left.toFixed(1)}..${rail.right.toFixed(1)}`)
    }
    const expected = place === 'end' ? marker.right - box.right : place === 'middle' ? (marker.left + marker.right) / 2 - (box.left + box.right) / 2 : marker.left - box.left
    if (Math.abs(expected) > TOLERANCE) {
      problems.push(`${name}: label ${index + 1} is not anchored for its place (${place}): off by ${expected.toFixed(1)}px`)
    }
    const visible = box.width > 0 && box.height > 0
    // shown or hidden from sight, the label stays in its marker's accessible name. the role query
    // leaves out content hidden with display or visibility, so a label hidden that way is missing here.
    const text = label.textContent.trim()
    const named = canvas.queryAllByRole('button', { name: (accessibleName, element) => element === cell && accessibleName.includes(text) })
    if (named.length !== 1) {
      problems.push(`${name}: label ${index + 1} (${JSON.stringify(text)}) is not in its marker's accessible name`)
    }
    if (shown !== null && visible !== shown) {
      problems.push(`${name}: label ${index + 1} is ${visible ? 'shown' : 'hidden'} but the rail's share ${shown ? 'holds' : 'is under'} the floor at ${cells.length} steps`)
    }
    if (anchored !== null && visible !== anchored) {
      problems.push(`${name}: label ${index + 1} is ${visible ? 'shown' : 'hidden'} but ${cells.length} steps on the ${width} frame ${anchored ? 'always show' : 'never show'} their labels, in any face`)
    }
    if (visible) {
      if (label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1) {
        problems.push(`${name}: label ${index + 1} is clipped (${label.scrollWidth}x${label.scrollHeight} in ${label.clientWidth}x${label.clientHeight})`)
      }
      if (previous && box.left - previous.right < gutter - TOLERANCE) {
        problems.push(`${name}: label ${index + 1} sits ${(box.left - previous.right).toFixed(1)}px from the label before it, less than the ${gutter}px gutter`)
      }
      previous = box
    }
  })
  return problems
}

export const LabelsInsideFrame = {
  parameters: { layout: 'fullscreen' },
  render: () => <LabelMatrix />,
  play: async ({ canvasElement }) => {
    // the label shares depend on the mono face, so measure after it has loaded.
    await document.fonts.ready
    const gutter = parseFloat(getComputedStyle(canvasElement.querySelector('.swz-rail')).getPropertyValue('--swz-label-gutter'))
    await expect(gutter).toBeGreaterThan(0)
    const frames = [...canvasElement.querySelectorAll('[data-case-width]')]
    await expect(frames).toHaveLength(MATRIX_COUNTS.length * Object.keys(MATRIX_WIDTHS).length)
    const problems = frames.flatMap((holder) => labelProblems(holder.querySelector('.swz'), holder.getAttribute('data-case-width'), gutter))
    // one readable line per broken rule, so a failure names the frame, the label and the distance.
    if (problems.length > 0) throw new Error(`${problems.length} label problem(s):\n${problems.join('\n')}`)
  },
}

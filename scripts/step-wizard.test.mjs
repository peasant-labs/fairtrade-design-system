#!/usr/bin/env node
/* Mounted-source gate for the step wizard (StepIndicator, StepWizardFrame, StepWizard): the place
   each step's label is given under its marker for 1 to 10 steps (the first starts at the first
   marker, the last ends at the last marker, the rest are centred, a lone step starts), the gap
   count the rail hands the stylesheet for the label shares, the controlled frame's head, body and
   foot regions with the host's slots, the "step n / m" count in words and as drawn (0 when the
   current id names no step), the names the frame hands its regions, a marker that jumps or stays
   locked, and the uncontrolled wizard that is built on the frame. jsdom has no layout, so where a
   place puts the label (inside the rail, flush with its marker, clear of its neighbours) is
   measured in a browser, in the LabelsInsideFrame story and its Fairtest mounted row.
   Cases: scripts/testdata/step-wizard.yaml (+ .manifest.yaml).
   Run: node scripts/step-wizard.test.mjs; mutations: node scripts/parts-mutations.mjs
   scripts/step-wizard.test.mjs scripts/testdata/step-wizard.manifest.yaml. */
import { loadFixturePair, withMountedSource, click, createReport } from './mounted-parts.mjs'

const FIXTURE = 'scripts/testdata/step-wizard.yaml'
const MANIFEST = 'scripts/testdata/step-wizard.manifest.yaml'
const { fixture } = loadFixturePair(FIXTURE, MANIFEST, { cases: 'requiredCaseNames' })
const report = createReport('step wizard')

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const spoken = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null)
const placeOf = (label) => [...label.classList].find((name) => name.startsWith('swz-label--'))?.slice('swz-label--'.length) ?? null
const stepsOf = (count) => fixture.steps.slice(0, count)
const idSet = (ids) => new Set(ids ?? [])

await withMountedSource(async ({ load, mount, window, React }) => {
  const module = await load('/src/ui/StepWizard.jsx')
  const barrel = await load('/src/ui/index.js')
  const { StepIndicator, StepWizardFrame } = module
  const StepWizard = module.default
  report.check(
    barrel.StepIndicator === StepIndicator && barrel.StepWizardFrame === StepWizardFrame && barrel.StepWizard === StepWizard,
    'StepIndicator, StepWizardFrame and StepWizard must be exported from the ui barrel',
  )

  const frameProps = (row) => ({ steps: stepsOf(row.count), current: row.current, ...row.props })

  for (const row of fixture.cases) {
    const name = row.name
    if (row.kind === 'places') {
      const steps = stepsOf(row.count)
      const mounted = await mount(React.createElement(StepIndicator, { steps, current: steps[0].id }))
      const rail = mounted.container.querySelector('nav.swz-rail')
      const labels = [...(rail?.querySelectorAll('.swz-step .swz-label') ?? [])]
      const places = labels.map(placeOf)
      report.check(same(places, row.expected.places), `${name}: places must be ${JSON.stringify(row.expected.places)}, received ${JSON.stringify(places)}`)
      report.check(same(labels.map(spoken), steps.map((step) => step.label)), `${name}: every label must keep its text in step order`)
      const gaps = rail?.style.getPropertyValue('--swz-gaps')
      report.check(gaps === row.expected.gaps, `${name}: the rail must hand the stylesheet ${row.expected.gaps} gaps, received ${JSON.stringify(gaps)}`)
      await mounted.unmount()
    } else if (row.kind === 'regions') {
      const mounted = await mount(React.createElement(
        StepWizardFrame,
        { ...frameProps(row), head: 'head note', footStart: 'back slot', footEnd: 'continue slot', bodyProps: row.bodyProps },
        'the body',
      ))
      const frame = mounted.container.firstElementChild
      const body = frame?.querySelector(':scope > .swz-body')
      const actual = {
        order: [...(frame?.children ?? [])].map((region) => region.classList[0]),
        frame: { tag: frame?.tagName, label: frame?.getAttribute('aria-label'), classes: [...(frame?.classList ?? [])] },
        rail: { tag: frame?.querySelector(':scope > .swz-head > nav')?.tagName, label: frame?.querySelector(':scope > .swz-head > nav')?.getAttribute('aria-label') },
        head: spoken(frame?.querySelector(':scope > .swz-head > .swz-head-slot')),
        body: spoken(body),
        footStart: spoken(frame?.querySelector(':scope > .swz-foot > .swz-foot-start')),
        footEnd: spoken(frame?.querySelector(':scope > .swz-foot > .swz-foot-end')),
        bodyAttributes: { id: body?.id, role: body?.getAttribute('role'), label: body?.getAttribute('aria-label'), classes: [...(body?.classList ?? [])] },
      }
      report.check(same(actual, row.expected), `${name}: the regions must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
      await mounted.unmount()
    } else if (row.kind === 'count') {
      const mounted = await mount(React.createElement(StepWizardFrame, frameProps(row), null))
      const frame = mounted.container.firstElementChild
      const actual = {
        words: spoken(frame.querySelector('.swz-count > .swz-sr-only')),
        drawn: spoken(frame.querySelector('.swz-count > [aria-hidden="true"]')),
        currentMarkers: frame.querySelectorAll('[aria-current="step"]').length,
      }
      report.check(same(actual, row.expected), `${name}: the count must read ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
      await mounted.unmount()
    } else if (row.kind === 'names') {
      const mounted = await mount(React.createElement(StepWizardFrame, frameProps(row), null))
      const frame = mounted.container.firstElementChild
      const actual = { frame: frame.getAttribute('aria-label'), rail: frame.querySelector('nav')?.getAttribute('aria-label') }
      report.check(same(actual, row.expected), `${name}: the names must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
      await mounted.unmount()
    } else if (row.kind === 'jump') {
      const jumps = []
      const mounted = await mount(React.createElement(
        StepWizardFrame,
        { ...frameProps(row), completed: idSet(row.completed), reachable: idSet(row.reachable), onJump: (id) => jumps.push(id) },
        null,
      ))
      const steps = stepsOf(row.count)
      const buttons = [...mounted.container.querySelectorAll('.swz-step')]
      for (const id of row.clicks) await mounted.act(() => click(window, buttons[steps.findIndex((step) => step.id === id)]))
      const locked = buttons.flatMap((button, index) => (button.disabled && button.getAttribute('aria-disabled') === 'true' ? [steps[index].id] : []))
      const actual = { jumps, locked }
      report.check(same(actual, row.expected), `${name}: jumps and locked markers must be ${JSON.stringify(row.expected)}, received ${JSON.stringify(actual)}`)
      await mounted.unmount()
    } else if (row.kind === 'wizard') {
      const steps = stepsOf(row.count)
      const reported = []
      const bodies = steps.map((step) => React.createElement('p', { key: step.id }, `${step.label} body`))
      const mounted = await mount(React.createElement(StepWizard, { steps, onComplete: ({ completed }) => reported.push([...completed]) }, bodies))
      const read = () => {
        const frame = mounted.container.firstElementChild
        return {
          words: spoken(frame.querySelector('.swz-count > .swz-sr-only')),
          primary: spoken(frame.querySelector('.swz-foot-end button')),
          backDisabled: frame.querySelector('.swz-foot-start button')?.disabled,
        }
      }
      const press = async (selector) => {
        const target = mounted.container.querySelector(selector)
        report.check(target !== null, `${name}: the wizard must render ${selector}`)
        if (target) await mounted.act(() => click(window, target))
      }
      const check = (label, actual, expected) => report.check(same(actual, expected), `${name}: ${label} must read ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
      check('the first step', read(), row.expected.first)
      await press('.swz-foot-end button')
      check('the second step', read(), row.expected.second)
      await press('.swz-foot-end button')
      check('the last step', read(), row.expected.last)
      await press('.swz-foot-start button')
      check('back', { words: read().words }, row.expected.backTo)
      await press('.swz-foot-end button')
      await press('.swz-foot-end button')
      report.check(same(reported, [row.expected.completed]), `${name}: the last step must report completion with ${JSON.stringify([row.expected.completed])}, received ${JSON.stringify(reported)}`)
      await mounted.unmount()
    } else {
      throw new Error(`${FIXTURE}: unknown case kind ${row.kind}`)
    }
  }
})

report.finish(`${fixture.cases.length} cases over label places, the frame's regions, count and names, jumps, and the wizard built on the frame.`)

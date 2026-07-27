import React from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import YAML from 'yaml'
import fixtureSource from '../../../scripts/testdata/timeline-navigation-actions.yaml?raw'
import overflowFixtureSource from '../../../scripts/testdata/changes-overflow.yaml?raw'
import Changes from './Changes.jsx'

const fixtureDocument = YAML.parseDocument(fixtureSource, { strict: true, uniqueKeys: true })
if (fixtureDocument.errors.length > 0 || (fixtureSource.match(/^---\s*$/gm) ?? []).length > 0) {
  throw new Error('timeline-navigation-actions.yaml must be one strict YAML document with unique keys')
}
const fixture = fixtureDocument.toJS()
const overflowFixtureDocument = YAML.parseDocument(overflowFixtureSource, { strict: true, uniqueKeys: true })
if (overflowFixtureDocument.errors.length > 0 || (overflowFixtureSource.match(/^---\s*$/gm) ?? []).length > 0) {
  throw new Error('changes-overflow.yaml must be one strict YAML document with unique keys')
}
const overflowFixture = overflowFixtureDocument.toJS()

export default {
  title: 'in use/Changes',
  component: Changes,
  parameters: { layout: 'fullscreen' },
}

export const SemanticNavigationActions = {
  args: {
    onNavigate: fn(),
    onSelectChange: fn(),
    onOpenSession: fn(),
    onOpenMap: fn(),
    onShowOlder: fn(),
  },
  render: (args) => (
    <Changes
      {...args}
      payload={fixture.payload}
      projectLabel="peasant-labs/peasant"
      nowMs={1770001000000}
      hasMore
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    for (const [index, testCase] of fixture.cases.entries()) {
      await userEvent.click(controlFor(canvas, testCase.controlName))
      await expect(args.onNavigate).toHaveBeenCalledTimes(index + 1)
      await expect(args.onNavigate).toHaveBeenLastCalledWith(testCase.expectedAction)
    }
    await expect(args.onSelectChange).not.toHaveBeenCalled()
    await expect(args.onOpenSession).not.toHaveBeenCalled()
    await expect(args.onOpenMap).not.toHaveBeenCalled()
    await expect(args.onShowOlder).not.toHaveBeenCalled()
  },
}

export const LinkedSessionOverflow = {
  args: { onNavigate: fn() },
  render: (args) => {
    const testCase = overflowFixture.cases[0]
    return <Changes {...args} payload={testCase.payload} nowMs={1770001000000} />
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const testCase = overflowFixture.cases[0]
    const { expect: expectation } = testCase
    const disclosure = canvas.getByRole('button', { name: expectation.toggleLabel })
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByText(expectation.thirdSessionTitle)).not.toBeInTheDocument()
    await userEvent.click(disclosure)
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    const thirdSession = canvas.getByText(expectation.thirdSessionTitle).closest('button')
    if (!thirdSession) throw new Error('linked-session overflow fixture third session is not a button')
    await userEvent.click(thirdSession)
    await expect(args.onNavigate).toHaveBeenLastCalledWith(expectation.expectedNavigation)
    await userEvent.click(disclosure)
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByText(expectation.thirdSessionTitle)).not.toBeInTheDocument()
  },
}

export const LegacyCallbacksRemainCompatible = {
  args: {
    onSelectChange: fn(),
    onOpenSession: fn(),
    onOpenMap: fn(),
    onShowOlder: fn(),
  },
  render: (args) => (
    <Changes
      {...args}
      payload={fixture.payload}
      projectLabel="peasant-labs/peasant"
      nowMs={1770001000000}
      hasMore
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    for (const testCase of fixture.cases) {
      const callback = legacyCallback(args, testCase.legacyCallback)
      const priorCalls = callback.mock.calls.length
      await userEvent.click(controlFor(canvas, testCase.controlName))
      await expect(callback).toHaveBeenCalledTimes(priorCalls + 1)
      if (testCase.legacyCallback === 'select') {
        await expect(callback).toHaveBeenLastCalledWith(expect.objectContaining(testCase.legacyValue))
      } else if (testCase.legacyValue === null) {
        await expect(callback).toHaveBeenLastCalledWith()
      } else {
        await expect(callback).toHaveBeenLastCalledWith(testCase.legacyValue)
      }
    }
  },
}

function legacyCallback(args, kind) {
  if (kind === 'select') return args.onSelectChange
  if (kind === 'session') return args.onOpenSession
  if (kind === 'map') return args.onOpenMap
  if (kind === 'older') return args.onShowOlder
  throw new Error(`unsupported legacy callback kind: ${kind}`)
}

function controlFor(canvas, text) {
  const control = canvas.getByText(text, { exact: true }).closest('button')
  if (!control) throw new Error(`timeline fixture control is not a button: ${text}`)
  return control
}

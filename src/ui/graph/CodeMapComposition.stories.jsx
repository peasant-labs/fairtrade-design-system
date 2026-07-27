import React, { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import YAML from 'yaml'
import canonicalFixtureSource from '../../../scripts/testdata/code-map-canonical.yaml?raw'
import interactionFixtureSource from '../../../scripts/testdata/code-map-interactions.yaml?raw'
import MapCanvas from '../MapCanvas.jsx'
import CodeMap from './CodeMap.jsx'
import CodeMapComposition from './CodeMapComposition.jsx'
import { createCodeMapState } from './codeMapState.js'

const canonicalFixture = parseStrictFixture(canonicalFixtureSource, 'canonical code-map fixture')
const interactionFixture = parseStrictFixture(interactionFixtureSource, 'code-map interaction fixture')
const payload = interactionFixture.payload

const STATE_KEYS = [
  'expandedCommitSessions',
  'expandedGhostGroups',
  'expandedIds',
  'grain',
  'hoveredSessionId',
  'navigatorFilter',
  'navigatorFocusedId',
  'presentation',
  'rankMode',
  'scentFilter',
  'selectedId',
  'selectedSessionId',
  'version',
  'viewport',
]

function ControlledComposition({ onStateChange }) {
  const [state, setState] = useState(() => createCodeMapState({
    presentation: 'navigator',
    grain: 'file',
    expandedIds: ['internal', 'internal/ingest'],
  }))
  return (
    <CodeMapComposition
      payload={payload}
      state={state}
      onStateChange={(next) => {
        setState(next)
        onStateChange(next)
      }}
      rail={<p>selected code area details</p>}
      legend={false}
      height={420}
    />
  )
}

function LateHydrationHarness({ onStateChange }) {
  const [state, setState] = useState(() => createCodeMapState({ presentation: 'canvas' }))
  return (
    <>
      <button
        type="button"
        onClick={() => setState(createCodeMapState({
          presentation: 'canvas',
          grain: 'file',
          expandedIds: ['internal', 'internal/ingest'],
          viewport: { scale: 0.35, panX: 32, panY: -18 },
        }))}
      >
        hydrate minimum
      </button>
      <button type="button" onClick={() => setState(createCodeMapState({ presentation: 'canvas', grain: 'file', viewport: { scale: 2.4, panX: -12, panY: 9 } }))}>
        hydrate maximum
      </button>
      <button type="button" onClick={() => setState(createCodeMapState({ presentation: 'canvas', grain: 'file', viewport: null }))}>
        clear viewport
      </button>
      <CodeMapComposition
        payload={payload}
        state={state}
        selectedId="internal/ingest/pipeline.go"
        viewport={{ scale: 1.4, panX: 18, panY: -9 }}
        onStateChange={onStateChange}
        rail={<p>selected code area details</p>}
        legend={false}
        height={420}
      />
    </>
  )
}

function InteractionMatrixHarness({ surface, onStateChange, onSelect, onZoomChange, onExpand, onPresentationChange }) {
  const cases = interactionFixture.cases.filter((testCase) => testCase.surface === surface)
  const [activeCase, setActiveCase] = useState(cases[0])
  const [state, setState] = useState(() => createCodeMapState(cases[0].initialState))
  const [revision, setRevision] = useState(0)
  return (
    <>
      <div aria-label={`${surface} interaction cases`}>
        {cases.map((testCase) => (
          <button type="button" key={testCase.name} onClick={() => {
            setActiveCase(testCase)
            setState(createCodeMapState(testCase.initialState))
            setRevision((value) => value + 1)
          }}>load {testCase.name}</button>
        ))}
      </div>
      <output>active case: {activeCase.name}</output>
      {activeCase.owner !== 'legacy' ? (
        <output data-code-map-owner-state={JSON.stringify(state)}>
          owner state: {JSON.stringify(state)}
        </output>
      ) : null}
      {activeCase.owner === 'legacy' ? (
        <CodeMap
          key={revision}
          payload={payload}
          zoom={{ level: state.grain, expanded: state.expandedIds }}
          selectedId={state.selectedId}
          viewport={state.viewport}
          onSelect={onSelect}
          onZoomChange={onZoomChange}
          onExpand={onExpand}
          height={420}
        />
      ) : (
        <CodeMapComposition
          key={revision}
          payload={payload}
          state={state}
          onStateChange={(next) => {
            if (activeCase.owner !== 'reject') setState(next)
            onStateChange(next)
          }}
          onSelect={onSelect}
          onZoomChange={onZoomChange}
          onExpand={onExpand}
          onPresentationChange={onPresentationChange}
          rail={<p>selected code area details</p>}
          legend={false}
          height={420}
        />
      )}
    </>
  )
}

export default {
  title: 'in use/CodeMapComposition',
  component: CodeMapComposition,
  parameters: { layout: 'fullscreen' },
}

export const ControlledState = {
  args: { onStateChange: fn() },
  render: (args) => <ControlledComposition {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const internal = await canvas.findByRole('treeitem', { name: /^internal/i })

    await userEvent.click(internal)
    await expectOneFullState(args.onStateChange, { selectedId: 'internal', navigatorFocusedId: 'internal' })

    args.onStateChange.mockClear()
    internal.focus()
    await userEvent.keyboard('{ArrowDown}')
    await expectOneFullState(args.onStateChange, { navigatorFocusedId: 'internal/ingest' })

    args.onStateChange.mockClear()
    await userEvent.keyboard('{Enter}')
    await expectOneFullState(args.onStateChange, { selectedId: 'internal/ingest', navigatorFocusedId: 'internal/ingest' })

    args.onStateChange.mockClear()
    const filter = canvas.getByRole('textbox', { name: /filter code areas/i })
    await userEvent.type(filter, 'p')
    await expectOneFullState(args.onStateChange, { navigatorFilter: 'p' })

    args.onStateChange.mockClear()
    await userEvent.click(canvas.getByRole('button', { name: /open in map/i }))
    await expectOneFullState(args.onStateChange, { presentation: 'canvas', selectedId: 'internal/ingest' })

    args.onStateChange.mockClear()
    await userEvent.click(canvas.getByRole('radio', { name: 'overview' }))
    await expectOneFullState(args.onStateChange, { grain: 'project', expandedIds: [] })

    args.onStateChange.mockClear()
    const search = canvas.getByRole('textbox', { name: /find a node/i })
    await userEvent.type(search, 'pipeline')
    await userEvent.click(await canvas.findByRole('option', { name: /internal\/ingest\/pipeline\.go/i }))
    await expectOneFullState(args.onStateChange, {
      grain: 'file',
      selectedId: 'internal/ingest/pipeline.go',
      navigatorFocusedId: 'internal/ingest/pipeline.go',
    })

    args.onStateChange.mockClear()
    await userEvent.click(canvas.getByRole('button', { name: /back to browse/i }))
    await expectOneFullState(args.onStateChange, {
      presentation: 'navigator',
      selectedId: 'internal/ingest/pipeline.go',
    })
    await expect(canvas.findByText('internal/ingest/pipeline.go')).resolves.toBeInTheDocument()
  },
}

export const LateControlledHydration = {
  args: { onStateChange: fn() },
  render: (args) => <LateHydrationHarness {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvasElement.querySelector('[data-selected="true"]')).toBeNull()
    expect(canvasElement.querySelector('.mc-stage')?.getAttribute('style')).not.toContain('scale(1.4)')
    args.onStateChange.mockClear()
    await userEvent.click(canvas.getByRole('button', { name: /hydrate minimum/i }))
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'files' })).toHaveAttribute('aria-checked', 'true'))
    await waitFor(() => expect(stageTransform(canvasElement)).toBe('translate(32px, -18px) scale(0.35)'))
    expect(args.onStateChange).toHaveBeenCalledTimes(0)
    await userEvent.click(canvas.getByRole('button', { name: /hydrate maximum/i }))
    await waitFor(() => expect(stageTransform(canvasElement)).toBe('translate(-12px, 9px) scale(2.4)'))
    expect(args.onStateChange).toHaveBeenCalledTimes(0)
    await userEvent.click(canvas.getByRole('button', { name: /clear viewport/i }))
    // Clearing the viewport (canonical viewport → null) drops back to the
    // whole-graph auto-fit for the CURRENT visible set. "clear viewport"
    // rehydrates to grain 'file' with NO per-node expansions, so the file-grain
    // aggregation cap (CODE_MAP_GRAIN_DEPTH.file === 1 in codeMapState.js: a
    // folder stays a single aggregate box until explicitly expanded) frames the
    // aggregated top level: internal/ingest + web + solo's child, NOT every
    // file in the repo. This transform is that whole-graph fit at 900×420; it
    // differs from the pre-aggregation-cap value because the cap changed which
    // nodes are visible at file grain. The fit stays LOCAL (unpublished), so no
    // onStateChange fires (asserted below), matching the epoch rule that the
    // first fit before any canonical viewport exists is local-only.
    await waitFor(() => expect(stageTransform(canvasElement)).toBe('translate(0px, 32.3952px) scale(1.11694)'))
    expect(args.onStateChange).toHaveBeenCalledTimes(0)
  },
}

export const CanonicalHierarchyIgnoresRawParents = {
  render: () => {
    const fixture = canonicalFixture.hierarchyConflict
    const data = { nodes: fixture.nodes, edges: fixture.edges }
    return (
      <>
        <MapCanvas
          data={data}
          hierarchy={fixture.hierarchy}
          visibleIds={fixture.layoutVisibleIds}
          grain="files"
          ariaLabel="canonical hierarchy layout"
          height={320}
        />
        <MapCanvas
          data={data}
          hierarchy={fixture.hierarchy}
          visibleIds={fixture.resolutionVisibleIds}
          highlightedIds={fixture.highlightedIds}
          grain="files"
          ariaLabel="canonical hierarchy resolution"
          height={320}
        />
      </>
    )
  },
  play: async ({ canvasElement }) => {
    const fixture = canonicalFixture.hierarchyConflict
    const canvas = within(canvasElement)
    const layout = canvas.getByRole('application', { name: /canonical hierarchy layout/i })
    const child = within(layout).getByRole('button', { name: /^child: file/i })
    const sibling = within(layout).getByRole('button', { name: /^sibling: file/i })
    const other = within(layout).getByRole('button', { name: /^other: folder/i })
    expect(Number.parseFloat(child.style.top)).toBeGreaterThan(Number.parseFloat(other.style.top))
    expect(Number.parseFloat(child.style.left)).toBeLessThan(Number.parseFloat(sibling.style.left))

    const resolution = canvas.getByRole('application', { name: /canonical hierarchy resolution/i })
    const root = within(resolution).getByRole('button', { name: new RegExp(`^${fixture.expected.violationAncestor}: folder.*${fixture.expected.violationCount} violations`, 'i') })
    expect(root).toHaveAttribute('data-highlighted', 'true')
    expect(resolution.querySelectorAll('.mc-edge')).toHaveLength(1)
  },
}

export const ControlledNavigatorInteractions = {
  args: interactionSpies(),
  render: (args) => <InteractionMatrixHarness surface="navigator" {...args} />,
  play: async ({ args, canvasElement }) => {
    await runInteractionCases('navigator', args, canvasElement)
  },
}

export const ControlledCanvasInteractions = {
  args: interactionSpies(),
  render: (args) => <InteractionMatrixHarness surface="canvas" {...args} />,
  play: async ({ args, canvasElement }) => {
    await runInteractionCases('canvas', args, canvasElement)
  },
}

export const LegacyDefaultCodeMap = {
  args: { onZoomChange: fn() },
  render: (args) => <CodeMap payload={payload} onZoomChange={args.onZoomChange} height={420} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.queryByRole('button', { name: /pipeline\.go: file/i })).toBeNull()
    await userEvent.dblClick(canvas.getByRole('button', { name: /^ingest: folder/i }))
    await expect(canvas.findByRole('button', { name: /pipeline\.go: file/i })).resolves.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('radio', { name: 'overview' }))
    await waitFor(() => expect(canvas.queryByRole('button', { name: /^ingest: folder/i })).toBeNull())
  },
}

export const LegacyNavigatorFallback = {
  render: () => (
    <CodeMapComposition
      presentation="navigator"
      canvasSlot={<p>historical canvas content</p>}
      rail={<p>selected code area details</p>}
      legend={false}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).findByText('historical canvas content')).resolves.toBeInTheDocument()
  },
}

async function expectOneFullState(spy, expected) {
  // A single semantic gesture publishes its semantic proposal FIRST. When that
  // gesture ALSO changes the visible set (e.g. the search "reveal" expands
  // pipeline.go's ancestors to descend to file grain), the canvas auto-fit then
  // frames the revealed content and publishes that framing as a follow-on
  // viewport-only state change — the epoch's auto-fit-records-its-framing
  // behavior (MapCanvas.jsx `fit`/`fitToIds` publish on a visible-set change →
  // a `set-viewport` reduction; see codeMapState.js). So assert the semantic
  // proposal precisely, then require every extra emission to be a pure
  // viewport-framing delta (nothing but `viewport` changes). A select/focus/
  // filter/presentation gesture leaves the visible set untouched and emits
  // exactly one state.
  await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1))
  const state = spy.mock.calls[0][0]
  expect(Object.keys(state).sort()).toEqual(STATE_KEYS)
  expect(state).toEqual(expect.objectContaining(expected))
  // Give any follow-on auto-fit framing a beat to publish, then confirm the
  // published sequence carries exactly one semantic proposal (this state) and
  // that every extra is a viewport-only framing — never a second semantic emit.
  await waitFor(() => {
    const semantic = semanticProposals(spy.mock.calls.map((call) => call[0]))
    expect(semantic).toHaveLength(1)
  })
}

function interactionSpies() {
  return { onStateChange: fn(), onSelect: fn(), onZoomChange: fn(), onExpand: fn(), onPresentationChange: fn() }
}

async function runInteractionCases(surface, args, canvasElement) {
  const canvas = within(canvasElement)
  for (const testCase of interactionFixture.cases.filter((candidate) => candidate.surface === surface)) {
    try {
      await userEvent.click(canvas.getByRole('button', { name: `load ${testCase.name}` }))
      await waitFor(() => expect(canvas.getByText(`active case: ${testCase.name}`)).toBeInTheDocument())
      clearInteractionSpies(args)
      const beforeSnapshot = testCase.expectedBefore
        ? canvasDomSnapshot(canvasElement)
        : null
      if (testCase.expectedBefore) {
        expect(beforeSnapshot).toEqual(testCase.expectedBefore.dom)
        if (testCase.owner === 'reject') expect(readOwnerState(canvasElement)).toEqual(testCase.expectedBefore.ownerState)
        else expect(reduceLegacySemanticState(testCase.initialState, emptyLegacyCalls())).toEqual(testCase.expectedBefore.semanticState)
      }
      if (testCase.assertionsAt === 'before') {
        assertInteractionAria(testCase, canvas)
        assertInteractionStructure(testCase, canvas)
      }
      await executeInteraction(testCase, canvas)
      await waitFor(() => {
        // A gesture that changes the VISIBLE SET (an expand/reveal that adds to
        // expandedIds) makes the canvas re-fit and PUBLISH that framing as a
        // follow-on viewport-only state change — the epoch's auto-fit-records-
        // its-framing behavior (MapCanvas.jsx `fitToIds(..., publish=true)` in
        // the newly-opened descent-fit branch → CodeMap `publishAction` → a
        // `set-viewport` reduction). The fixtures describe the SEMANTIC
        // proposals of each gesture; strip any auto-fit framing follow-on (a
        // state that differs from its predecessor in `viewport` alone) before
        // matching, and separately require every stripped state to be a valid
        // framing (viewport-only delta, non-null viewport). A select-only
        // gesture leaves the visible set untouched and emits no framing.
        const publishedStates = args.onStateChange.mock.calls.map((call) => call[0])
        const actualStates = semanticProposals(publishedStates)
        try {
          expect(actualStates).toEqual(testCase.expectedStates)
        } catch (error) {
          throw new Error(`state proposals differ: expected ${JSON.stringify(testCase.expectedStates)}; received ${JSON.stringify(actualStates)} (raw ${JSON.stringify(publishedStates)})`, { cause: error })
        }
      })
      expect(args.onSelect.mock.calls).toEqual(testCase.expectedLegacy.select)
      expect(args.onZoomChange.mock.calls).toEqual(testCase.expectedLegacy.zoom)
      expect(args.onExpand.mock.calls).toEqual(testCase.expectedLegacy.expand)
      expect(args.onPresentationChange.mock.calls).toEqual(testCase.expectedLegacy.presentation)
      if (testCase.assertionsAt !== 'before') {
        assertInteractionAria(testCase, canvas)
        assertInteractionStructure(testCase, canvas)
      }
      if (testCase.expectedAfter) {
        let afterSnapshot
        await waitFor(() => {
          afterSnapshot = canvasDomSnapshot(canvasElement)
          expect(afterSnapshot).toEqual(testCase.expectedAfter.dom)
        })
        if (testCase.owner === 'reject') {
          expect(readOwnerState(canvasElement)).toEqual(testCase.expectedAfter.ownerState)
        } else {
          const actualLegacyCalls = {
            select: args.onSelect.mock.calls,
            zoom: args.onZoomChange.mock.calls,
            expand: args.onExpand.mock.calls,
            presentation: args.onPresentationChange.mock.calls,
          }
          expect(reduceLegacySemanticState(testCase.initialState, actualLegacyCalls)).toEqual(testCase.expectedAfter.semanticState)
        }
        expect(afterSnapshot.transform === beforeSnapshot.transform).toBe(testCase.expectedTransformRelation === 'same')
      }
    } catch (error) {
      throw new Error(`${testCase.name}: ${error.message}`, { cause: error })
    }
  }
}

/* Drop auto-fit viewport-framing follow-ons from a sequence of published states,
   leaving only the SEMANTIC proposals a gesture makes. A framing is a state that
   differs from its immediate predecessor in the `viewport` field alone — the
   canvas publishes one whenever a visible-set change (an expand/reveal) causes an
   auto-fit (see the note at the call site). Each stripped state is asserted to be
   a genuine framing (viewport-only delta, non-null viewport) so a real semantic
   double-emit can never be silently swallowed. */
function semanticProposals(states) {
  const semantic = []
  for (let index = 0; index < states.length; index += 1) {
    const previous = index === 0 ? null : states[index - 1]
    if (previous && isViewportOnlyDelta(previous, states[index])) {
      expect(states[index].viewport).not.toBeNull()
      continue
    }
    semantic.push(states[index])
  }
  return semantic
}

function isViewportOnlyDelta(before, after) {
  const nonViewportUnchanged = STATE_KEYS
    .filter((key) => key !== 'viewport')
    .every((key) => JSON.stringify(before[key]) === JSON.stringify(after[key]))
  return nonViewportUnchanged && JSON.stringify(before.viewport) !== JSON.stringify(after.viewport)
}

async function executeInteraction(testCase, canvas) {
  const { type, targets, keys } = testCase.action
  if (type === 'assert-only') return
  if (type === 'disclosure') {
    await userEvent.click(await findDisclosure(testCase.surface, targets[0], canvas))
    return
  }
  if (type === 'disclosure-key') {
    const disclosure = await findDisclosure(testCase.surface, targets[0], canvas)
    disclosure.focus()
    await userEvent.keyboard(keys[0] === 'Space' ? ' ' : `{${keys[0]}}`)
    return
  }
  if (type === 'key-sequence') {
    for (const [index, targetId] of targets.entries()) {
      const target = nodeFor(testCase.surface, targetId, canvas)
      target.focus()
      await userEvent.keyboard(keys[index] === 'Space' ? ' ' : `{${keys[index]}}`)
    }
    return
  }
  if (type === 'zoom-control') {
    const viewport = canvas.getByRole('application', { name: /code map/i }).querySelector('.mc-viewport')
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: Number(keys[0]) })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: Number(keys[1]) })
    await userEvent.click(canvas.getByRole('button', { name: targets[0] }))
    return
  }
  if (type === 'grain-control') {
    await userEvent.click(canvas.getByRole('radio', { name: targets[0] }))
    return
  }
  if (type === 'pan') {
    const viewport = canvas.getByRole('application', { name: /code map/i }).querySelector('.mc-viewport')
    const [startX, startY, endX, endY] = keys.map(Number)
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: viewport, coords: { clientX: startX, clientY: startY } },
      { target: viewport, coords: { clientX: endX, clientY: endY } },
      { keys: '[/MouseLeft]', target: viewport, coords: { clientX: endX, clientY: endY } },
    ])
    return
  }
  const action = type === 'double-click' ? userEvent.dblClick : userEvent.click
  for (const targetId of targets) await action(nodeFor(testCase.surface, targetId, canvas))
}

function canvasDomSnapshot(canvasElement) {
  const canvas = within(canvasElement)
  const application = canvas.getByRole('application', { name: /code map/i })
  const visibleIds = Array.from(application.querySelectorAll('.mc-node')).map(nodeIdForButton).sort()
  const pressedIds = Array.from(application.querySelectorAll('.mc-node[aria-pressed="true"]')).map(nodeIdForButton).sort()
  const disclosures = Array.from(application.querySelectorAll('.mc-node-disclosure'))
    .map((button) => {
      const node = button.previousElementSibling
      if (!node?.classList.contains('mc-node')) throw new Error('canvas disclosure must follow its node')
      return { id: nodeIdForButton(node), expanded: button.getAttribute('aria-expanded') === 'true' }
    })
    .sort((left, right) => left.id.localeCompare(right.id))
  const grainByLabel = { overview: 'project', folders: 'package', files: 'file' }
  const checkedGrain = canvas.getByRole('radio', { checked: true })
  // MapCanvas renders TWO aria-live status regions (see MapCanvas.jsx): the
  // roving-focus announce (id `${baseId}-live`, whose text names the focused
  // node's coverage/violations) and a SEPARATE folder-descent announce added for
  // the canvas breadcrumb feature (deliberately distinct so a discrete "what
  // changed" event never gets lost inside the ambient "what's focused" state).
  // Snapshot the FOCUS announce specifically — selecting it by its id suffix so
  // the second region cannot make getByRole('status') throw on "multiple
  // elements"; the second region is counted in `structure.statusCount` below.
  const status = application.querySelector('[role="status"][id$="-live"]')
  if (!status) throw new Error('focus-announce live region (role="status", id ending "-live") not found')
  const transform = application.querySelector('.mc-stage')?.style.transform ?? ''
  return {
    visibleIds,
    pressedIds,
    grain: grainByLabel[checkedGrain.textContent.trim()],
    disclosures,
    disclosureExpandedIds: disclosures.filter((item) => item.expanded).map((item) => item.id),
    transform,
    status: {
      role: status.getAttribute('role'),
      ariaLive: status.getAttribute('aria-live'),
      text: status.textContent,
    },
    structure: {
      applicationRole: application.getAttribute('role'),
      applicationLabel: application.getAttribute('aria-label'),
      roleDescription: application.getAttribute('aria-roledescription'),
      statusCount: application.querySelectorAll('[role="status"]').length,
    },
  }
}

function stageTransform(canvasElement) {
  return canvasElement.querySelector('.mc-stage')?.style.transform ?? ''
}

function readOwnerState(canvasElement) {
  const output = canvasElement.querySelector('output[data-code-map-owner-state]')
  if (!output) throw new Error('controlled interaction story is missing owner state output')
  const state = JSON.parse(output.getAttribute('data-code-map-owner-state'))
  expect(Object.keys(state).sort()).toEqual(STATE_KEYS)
  return state
}

function emptyLegacyCalls() {
  return { select: [], zoom: [], expand: [], presentation: [] }
}

function reduceLegacySemanticState(initialState, calls) {
  const semantic = {
    selectedId: initialState.selectedId,
    grain: initialState.grain,
    expandedIds: [...initialState.expandedIds],
  }
  for (const args of calls.select) semantic.selectedId = args[0]
  for (const args of calls.zoom) {
    semantic.grain = args[0].level
    semantic.expandedIds = [...args[0].expanded]
  }
  return semantic
}

function nodeIdForButton(button) {
  const label = button.getAttribute('aria-label') ?? ''
  const match = payload.nodes.find((node) => label.startsWith(`${node.name || node.id}:`))
  if (!match) throw new Error(`cannot map rendered node ${JSON.stringify(label)} to fixture payload`)
  return match.id
}

function assertInteractionAria(testCase, canvas) {
  for (const expected of testCase.expectedAria) {
    const disclosure = queryDisclosure(testCase.surface, expected.targetId, canvas)
    const semanticTarget = testCase.surface === 'canvas' && disclosure
      ? disclosure
      : nodeFor(testCase.surface, expected.targetId, canvas)
    expect(semanticTarget.getAttribute('aria-expanded')).toBe(expected.expanded === null ? null : String(expected.expanded))
    expect(!!disclosure).toBe(expected.disclosurePresent)
    if (disclosure) expect(disclosure.getAttribute('aria-disabled') === 'true').toBe(expected.disclosureDisabled)
  }
}

function assertInteractionStructure(testCase, canvas) {
  if (testCase.expectedStructure.length === 0) return
  const targetId = testCase.action.targets[0]
  const disclosure = targetId ? queryDisclosure(testCase.surface, targetId, canvas) : null
  const node = testCase.surface === 'canvas' && disclosure
    ? disclosure.previousElementSibling
    : targetId ? nodeFor(testCase.surface, targetId, canvas) : null
  for (const assertion of testCase.expectedStructure) {
    if (assertion === 'disclosure-outside-treeitem') expect(disclosure?.closest('[role="treeitem"]')).toBeNull()
    else if (assertion === 'disclosure-tabindex-minus-one') expect(disclosure).toHaveAttribute('tabindex', '-1')
    else if (assertion === 'one-roving-tree-tabstop') expect(node?.closest('[role="tree"]')?.querySelectorAll('[role="treeitem"][tabindex="0"]')).toHaveLength(1)
    else if (assertion === 'disclosure-outside-node') expect(node?.contains(disclosure)).toBe(false)
    else if (assertion === 'disclosure-sibling-node') {
      expect(node).toHaveClass('mc-node')
      expect(node?.parentElement).toBe(disclosure?.parentElement)
    }
    else throw new Error(`unknown structural assertion ${assertion}`)
  }
}

function nodeFor(surface, id, canvas) {
  const node = payload.nodes.find((candidate) => candidate.id === id)
  if (!node) throw new Error(`unknown fixture node ${id}`)
  const label = node.name || node.id
  return surface === 'navigator'
    ? canvas.getByRole('treeitem', { name: new RegExp(`^${escapeRegex(label)}`, 'i') })
    : canvas.getByRole('button', { name: new RegExp(`^${escapeRegex(label)}:`, 'i') })
}

function disclosureFor(surface, id, canvas) {
  const disclosure = queryDisclosure(surface, id, canvas)
  if (!disclosure) throw new Error(`missing ${surface} disclosure for ${id}`)
  return disclosure
}

async function findDisclosure(surface, id, canvas) {
  const node = payload.nodes.find((candidate) => candidate.id === id)
  const label = node?.name || id
  const name = new RegExp(`^(show|hide) children for ${escapeRegex(label)}$`, 'i')
  try {
    return await canvas.findByRole('button', { name })
  } catch (error) {
    const available = canvas.queryAllByRole('button')
      .map((button) => button.getAttribute('aria-label') || button.textContent?.trim())
      .filter(Boolean)
    throw new Error(`missing ${surface} disclosure for ${id}; available buttons: ${available.join(' | ')}`, { cause: error })
  }
}

function queryDisclosure(surface, id, canvas) {
  const node = payload.nodes.find((candidate) => candidate.id === id)
  const label = node?.name || id
  return canvas.queryByRole('button', { name: new RegExp(`^(show|hide) children for ${escapeRegex(label)}$`, 'i') })
}

function clearInteractionSpies(args) {
  args.onStateChange.mockClear()
  args.onSelect.mockClear()
  args.onZoomChange.mockClear()
  args.onExpand.mockClear()
  args.onPresentationChange.mockClear()
}

function parseStrictFixture(source, label) {
  const document = YAML.parseDocument(source, { strict: true, uniqueKeys: true })
  if (document.errors.length) throw new Error(`${label} is invalid: ${document.errors.map((error) => error.message).join('; ')}`)
  return document.toJS()
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

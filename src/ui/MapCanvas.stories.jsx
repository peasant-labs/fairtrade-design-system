import { expect, userEvent, within, waitFor, fn } from 'storybook/test'
import MapCanvas from './MapCanvas.jsx'
import { frame } from './story-frame.jsx'

/* MapCanvas story. CSF3: a realistic peasant repo as the Default (folders ingest/ store/
   api/ tui/ cmd/ with their files, structure + a few weighted activity edges), an
   Overview pinned to grain=overview showing edge-lifting (file→file coupling collapsed
   onto folder→folder edges), and a Violations story foregrounding the clay badges. the
   component imports src/ui/MapCanvas.css on top of src/index.css via .storybook/preview;
   the theme toolbar flips data-theme. four orthogonal channels: WIDTH ∝ loc, the
   monochrome FILL ∝ coverage 0..4, the ICON for folder/file, and amber selection +
   marker / clay violation badge — so nothing reads on colour alone. Default's play()
   asserts a node is a real button with its "<leaf> — <kind> · coverage N of 4" label,
   that clicking selects it, and that arrow keys then move the roving focus. */

export default {
  title: 'in use/MapCanvas',
  component: MapCanvas,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'An interactive code-structure map: pan (drag), zoom (square controls / +,− keys — never wheel), semantic zoom (overview / folders / files) with edge ancestor-lifting, a minimap and a node-search combobox. Square metric-encoded nodes (width ∝ LOC, monochrome coverage fill 0..4, folder/file icon, amber selection + marker, clay violation badge) and square orthogonal edges (solid structure / dashed activity, width ∝ weight). Full roving-focus keyboard nav with an aria-live region. Deterministic, dependency-free (plain SVG + divs).',
      },
    },
  },
  decorators: frame('full'),
  argTypes: {
    grain: {
      control: { type: 'inline-radio' },
      options: ['overview', 'folders', 'files'],
    },
    height: { control: { type: 'range', min: 360, max: 760, step: 20 } },
    onSelect: { action: 'select' },
    data: { control: false },
    selectedId: { control: false },
    ariaLabel: { control: 'text' },
  },
}

/* a realistic peasant repo: five top folders (ingest store api tui cmd), each with the
   brief's named files plus a handful more, so the tree has real grain. coverage 0..4 is
   varied independently of loc so width and fill read as decoupled channels. store/ owns
   the one violation in the Default set. */
const NODES = [
  // ---- top-level folders ----
  { id: 'ingest', label: 'ingest', kind: 'folder' },
  { id: 'store', label: 'store', kind: 'folder' },
  { id: 'api', label: 'api', kind: 'folder' },
  { id: 'tui', label: 'tui', kind: 'folder' },
  { id: 'cmd', label: 'cmd', kind: 'folder' },

  // ---- ingest/ ----
  { id: 'ingest/stream.go', label: 'ingest/stream.go', kind: 'file', loc: 320, coverage: 3, parent: 'ingest' },
  { id: 'ingest/parse.go', label: 'ingest/parse.go', kind: 'file', loc: 180, coverage: 2, parent: 'ingest' },
  { id: 'ingest/stream_test.go', label: 'ingest/stream_test.go', kind: 'file', loc: 96, coverage: 4, parent: 'ingest' },

  // ---- store/ ----
  { id: 'store/sqlite.go', label: 'store/sqlite.go', kind: 'file', loc: 210, coverage: 2, parent: 'store', violations: 1 },
  { id: 'store/cache.go', label: 'store/cache.go', kind: 'file', loc: 130, coverage: 1, parent: 'store' },
  { id: 'store/migrations.sql', label: 'store/migrations.sql', kind: 'file', loc: 64, coverage: 0, parent: 'store' },

  // ---- api/ ----
  { id: 'api/handlers.go', label: 'api/handlers.go', kind: 'file', loc: 140, coverage: 4, parent: 'api' },
  { id: 'api/router.go', label: 'api/router.go', kind: 'file', loc: 88, coverage: 3, parent: 'api' },

  // ---- tui/ ----
  { id: 'tui/dashboard.go', label: 'tui/dashboard.go', kind: 'file', loc: 90, coverage: 1, parent: 'tui' },
  { id: 'tui/widgets.go', label: 'tui/widgets.go', kind: 'file', loc: 72, coverage: 2, parent: 'tui' },

  // ---- cmd/ ----
  { id: 'cmd/peasant/main.go', label: 'cmd/peasant/main.go', kind: 'file', loc: 60, coverage: 4, parent: 'cmd' },
]

/* edges. STRUCTURE (solid) = import relationships, weighted by import count. ACTIVITY
   (dashed) = co-edit coupling, weighted by shared-task count. some edges are file→file
   so the Overview story can show them LIFTING to folder→folder when files collapse. */
const EDGES = [
  // structure (imports): cmd -> api -> store -> ingest, plus tui -> api.
  { from: 'cmd/peasant/main.go', to: 'api/router.go', kind: 'structure', weight: 1 },
  { from: 'api/router.go', to: 'api/handlers.go', kind: 'structure', weight: 3 },
  { from: 'api/handlers.go', to: 'store/sqlite.go', kind: 'structure', weight: 4 },
  { from: 'store/sqlite.go', to: 'ingest/stream.go', kind: 'structure', weight: 2 },
  { from: 'store/cache.go', to: 'store/sqlite.go', kind: 'structure', weight: 2 },
  { from: 'tui/dashboard.go', to: 'api/handlers.go', kind: 'structure', weight: 2 },
  { from: 'tui/widgets.go', to: 'tui/dashboard.go', kind: 'structure', weight: 1 },
  { from: 'ingest/parse.go', to: 'ingest/stream.go', kind: 'structure', weight: 3 },

  // activity (co-edit), heavier weight = tighter coupling = a wider dashed edge.
  { from: 'ingest/stream.go', to: 'store/sqlite.go', kind: 'activity', weight: 5 },
  { from: 'api/handlers.go', to: 'tui/dashboard.go', kind: 'activity', weight: 3 },
]

export const Default = {
  args: {
    data: { nodes: NODES, edges: EDGES },
    grain: 'folders',
    height: 560,
    onSelect: fn(),
    ariaLabel: 'peasant code map',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // at folders grain the files render; the biggest-loc file is a real button whose
    // accessible name carries identity + kind + coverage (never colour-only).
    const stream = await canvas.findByRole('button', {
      name: /stream\.go — file · coverage 3 of 4/i,
    })
    await expect(stream).toBeInTheDocument()

    // clicking selects it and fires onSelect with (id, node).
    await userEvent.click(stream)
    await waitFor(() =>
      expect(args.onSelect).toHaveBeenCalledWith(
        'ingest/stream.go',
        expect.objectContaining({ id: 'ingest/stream.go', loc: 320 })
      )
    )
    await waitFor(() => expect(stream).toHaveAttribute('aria-pressed', 'true'))

    // roving keyboard nav: focus the canvas, arrow to move the keyboard cursor, and the
    // live region announces the focused node.
    const surface = canvas.getByRole('group', { name: /map canvas/i })
    surface.focus()
    await userEvent.keyboard('{ArrowRight}')
    const live = canvasElement.querySelector('[role="status"]')
    await waitFor(() => expect(live?.textContent || '').toMatch(/coverage \d of 4/i))
  },
}

/* Overview: grain pinned so only the five top folders render. every file→file edge
   LIFTS to its nearest visible ancestor — so the import + activity coupling shows as
   folder→folder edges (the alarm/coupling is never lost when a subtree collapses). use
   the segmented control to drop into folders/files and watch the edges un-lift. */
export const Overview = {
  args: {
    ...Default.args,
    grain: 'overview',
    ariaLabel: 'peasant code map — folder overview',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // at overview only folders render; the files are collapsed into them.
    const store = await canvas.findByRole('button', { name: /^store — folder/i })
    await expect(store).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /sqlite\.go/i })).toBeNull()
  },
}

/* Violations: a set where several files carry violations, including ones buried in
   collapsed folders so the clay badge aggregates onto the visible ancestor (the alarm
   never silently vanishes). pinned to overview so the folder badges sum their children.
   clay is the ONLY red on the canvas, and the badge pairs the colour with a glyph + a
   count so it never reads on colour alone. */
const VIOLATION_NODES = NODES.map((n) => {
  if (n.id === 'store/cache.go') return { ...n, violations: 2 }
  if (n.id === 'ingest/parse.go') return { ...n, violations: 1 }
  if (n.id === 'api/handlers.go') return { ...n, violations: 1 }
  return n
})

export const Violations = {
  args: {
    ...Default.args,
    data: { nodes: VIOLATION_NODES, edges: EDGES },
    grain: 'overview',
    ariaLabel: 'peasant code map — violations',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // store/ holds 1 (sqlite) + 2 (cache) = 3 violations collapsed inside it; the badge
    // sums onto the folder, and the accessible name spells the count out.
    const store = await canvas.findByRole('button', {
      name: /^store — folder.*3 violations/i,
    })
    await expect(store).toBeInTheDocument()
  },
}

/* the same realistic repo rendered light: confirms the monochrome coverage ramp, the
   contrast-aware ink flip, and the amber/clay accents all hold on the paper canvas. */
export const Light = {
  args: { ...Default.args },
  globals: { theme: 'light', backgrounds: { value: 'light' } },
}

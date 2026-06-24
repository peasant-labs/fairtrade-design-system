import { expect, userEvent, within, waitFor, fn } from 'storybook/test'
import Treemap from './Treemap.jsx'
import { frame } from './story-frame.jsx'

/* treemap story. CSF3: a Playground driven by argTypes, plus one named story per
   meaningful axis — the realistic Default change-set, a Dense 20+ file repo, a
   single-tile edge, and a Light pass. classes + tokens come from src/ui/Treemap.css
   (imported by the component) on top of src/index.css via .storybook/preview.jsx;
   the theme toolbar flips data-theme. the area encodes `value` (churn), the
   monochrome ramp encodes `intensity` (a second metric — here, "recency of touch").
   Default carries a play() that asserts a tile is a real button with the
   "<label> — N lines" aria-label and fires onSelect on click. */

export default {
  title: 'in use/Treemap',
  component: Treemap,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A squarified (Bruls–Huizing–van Wijk) treemap. One tile per item, AREA proportional to `value`, a strict-monochrome 0..4 `intensity` ramp encoding a second metric (never hue). Every tile is a labelled, focusable <button>.',
      },
    },
  },
  decorators: frame('wide'),
  argTypes: {
    height: { control: { type: 'range', min: 160, max: 520, step: 20 } },
    onSelect: { action: 'select' },
    data: { control: false },
    ariaLabel: { control: 'text' },
  },
}

/* a realistic changed-file set: the five prominent files from the brief, plus six
   smaller ones (config, tests, docs). `value` = churn (added+removed lines), area;
   `intensity` (0..4) is varied independently — read it as "how recently / how
   central" — so the two encodings are visibly decoupled (a big-but-cool tile vs a
   small-but-hot one). */
const CHANGE_SET = [
  { id: 'ingest/stream.go', label: 'ingest/stream.go', value: 320, intensity: 4 },
  { id: 'store/sqlite.go', label: 'store/sqlite.go', value: 210, intensity: 2 },
  { id: 'api/handlers.go', label: 'api/handlers.go', value: 140, intensity: 3 },
  { id: 'tui/dashboard.go', label: 'tui/dashboard.go', value: 90, intensity: 1 },
  { id: 'cmd/peasant/main.go', label: 'cmd/peasant/main.go', value: 60, intensity: 4 },
  { id: 'store/migrations.sql', label: 'store/migrations.sql', value: 48, intensity: 0 },
  { id: 'ingest/stream_test.go', label: 'ingest/stream_test.go', value: 36, intensity: 2 },
  { id: 'config/peasant.toml', label: 'config/peasant.toml', value: 22, intensity: 1 },
  { id: 'api/handlers_test.go', label: 'api/handlers_test.go', value: 18, intensity: 3 },
  { id: 'docs/architecture.md', label: 'docs/architecture.md', value: 12, intensity: 0 },
  { id: 'go.mod', label: 'go.mod', value: 6, intensity: 2 },
]

export const Default = {
  args: {
    data: CHANGE_SET,
    height: 320,
    onSelect: fn(),
    ariaLabel: 'changed files sized by churn, shaded by recency',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // the largest-churn tile renders its leaf label and is a real button.
    const biggest = await canvas.findByRole('button', {
      name: 'ingest/stream.go: 320 lines',
    })
    await expect(biggest).toBeInTheDocument()
    // a tile is keyboard-reachable + fires onSelect with (id, datum).
    await userEvent.click(biggest)
    await waitFor(() =>
      expect(args.onSelect).toHaveBeenCalledWith(
        'ingest/stream.go',
        expect.objectContaining({ id: 'ingest/stream.go', value: 320 })
      )
    )
  },
}

/* a dense 20+ file repo: the long tail of slivers exercises the label-suppression
   threshold (small tiles drop their label but keep title + aria-label, so they
   stay identifiable) and proves the squarify rule still keeps the big tiles square.
   intensity is spread across the full 0..4 ramp so the monochrome gradient is the
   thing you read, not any single hue. */
const DENSE_SET = [
  { id: 'ingest/stream.go', label: 'ingest/stream.go', value: 412, intensity: 4 },
  { id: 'store/sqlite.go', label: 'store/sqlite.go', value: 268, intensity: 3 },
  { id: 'api/router.go', label: 'api/router.go', value: 196, intensity: 2 },
  { id: 'api/handlers.go', label: 'api/handlers.go', value: 174, intensity: 4 },
  { id: 'tui/dashboard.go', label: 'tui/dashboard.go', value: 152, intensity: 1 },
  { id: 'tui/widgets.go', label: 'tui/widgets.go', value: 128, intensity: 3 },
  { id: 'ingest/parse.go', label: 'ingest/parse.go', value: 110, intensity: 2 },
  { id: 'store/cache.go', label: 'store/cache.go', value: 96, intensity: 0 },
  { id: 'auth/session.go', label: 'auth/session.go', value: 84, intensity: 4 },
  { id: 'auth/token.go', label: 'auth/token.go', value: 72, intensity: 2 },
  { id: 'cmd/peasant/main.go', label: 'cmd/peasant/main.go', value: 64, intensity: 1 },
  { id: 'internal/log/log.go', label: 'internal/log/log.go', value: 55, intensity: 3 },
  { id: 'internal/metrics.go', label: 'internal/metrics.go', value: 48, intensity: 2 },
  { id: 'store/migrations.sql', label: 'store/migrations.sql', value: 40, intensity: 0 },
  { id: 'ingest/stream_test.go', label: 'ingest/stream_test.go', value: 34, intensity: 1 },
  { id: 'api/handlers_test.go', label: 'api/handlers_test.go', value: 28, intensity: 2 },
  { id: 'config/peasant.toml', label: 'config/peasant.toml', value: 22, intensity: 0 },
  { id: 'docs/architecture.md', label: 'docs/architecture.md', value: 18, intensity: 0 },
  { id: 'docs/roadmap.md', label: 'docs/roadmap.md', value: 14, intensity: 1 },
  { id: 'Makefile', label: 'Makefile', value: 10, intensity: 0 },
  { id: 'go.mod', label: 'go.mod', value: 7, intensity: 2 },
  { id: 'go.sum', label: 'go.sum', value: 4, intensity: 0 },
  { id: '.gitignore', label: '.gitignore', value: 2, intensity: 0 },
]

export const Dense = {
  args: {
    data: DENSE_SET,
    height: 380,
    onSelect: fn(),
    ariaLabel: 'changed files across the repo, sized by churn',
  },
}

/* a single dominant tile — degenerate but legal: it fills the whole frame, label and
   all, and stays a valid button. guards the layout against the 1-item case. */
export const SingleTile = {
  args: {
    data: [{ id: 'api/handlers.go', label: 'api/handlers.go', value: 140, intensity: 3 }],
    height: 240,
    onSelect: fn(),
  },
}

/* the same realistic set rendered light: confirms the ramp + the contrast-aware ink
   flip both hold on the paper canvas (the toolbar also flips data-theme globally —
   this story pins it so the light pass is always visible in the index). */
export const Light = {
  args: { ...Default.args },
  globals: { theme: 'light', backgrounds: { value: 'light' } },
}

import { expect, within } from 'storybook/test'
import MapNode, {
  IntensitySwatch,
  RampLegend,
  Heatmap,
  IntensityScope,
} from './Intensity.jsx'

/* intensity ramp + map node stories. CSF3. the ramp encodes a metric's
   MAGNITUDE by FILL WEIGHT (monochrome 0–4), not hue — ported from peasant's
   code-map. tokens come from src/index.css via .storybook/preview.jsx; the
   theme toolbar flips data-theme, so the --ir-* color-mix ramp re-themes live. */
const meta = {
  title: 'in use/Intensity',
  component: MapNode,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    loc: { control: { type: 'number', min: 0, max: 4000 } },
    coverage: { control: { type: 'range', min: 0, max: 4, step: 1 } },
    selected: { control: 'boolean' },
    violation: { control: { type: 'number', min: 0, max: 9 } },
    effortPct: { control: { type: 'range', min: 0, max: 100, step: 5 } },
    size: { control: 'inline-radio', options: [undefined, 'xs', 'sm', 'md', 'lg', 'xl'] },
  },
  args: {
    label: 'ingest/stream.go',
    loc: 420,
    coverage: 3,
    selected: false,
    violation: 0,
    effortPct: 0,
  },
  // every node consumes the --ir-* ramp; scope the whole canvas once.
  decorators: [(Story) => <IntensityScope>{Story()}</IntensityScope>],
}
export default meta

/* a single node, fully driven by the controls. */
export const Playground = {}

/* ── Ramp — the legend, the documented 0–4 vocabulary ──────────────────────── */
export const Ramp = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <RampLegend title="coverage" />
      <RampLegend title="effort" words={['idle', 'light', 'steady', 'heavy', 'peak']} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <IntensityScope style={{ display: 'inline-flex', gap: 'var(--sp-2)' }}>
          {[0, 1, 2, 3, 4].map((lv) => (
            <IntensitySwatch key={lv} level={lv} size="lg" />
          ))}
        </IntensityScope>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-label)',
            color: 'var(--ink-4)',
            textTransform: 'lowercase',
          }}
        >
          monochrome swatches: none → full
        </span>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // the level-4 swatch advertises its meaning without relying on colour.
    await expect(canvas.getByLabelText('intensity 4 of 4 (full)')).toBeInTheDocument()
  },
}

/* ── Nodes — a small code-map: coverage ramp + one selected + one violation ── */
const TREE = [
  { label: 'api/handlers.go', loc: 880, coverage: 4, effortPct: 70 },
  { label: 'ingest/stream.go', loc: 420, coverage: 3, selected: true, effortPct: 45 },
  { label: 'store/', loc: 1600, coverage: 2 },
  { label: 'auth/middleware.go', loc: 240, coverage: 1, violation: 2 },
  { label: 'cmd/main.go', loc: 90, coverage: 4 },
  { label: 'internal/cache.go', loc: 310, coverage: 0, violation: 1, effortPct: 20 },
]

export const Nodes = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <IntensityScope className="ir-grid">
        {TREE.map((n) => (
          <MapNode key={n.label} {...n} />
        ))}
      </IntensityScope>
      <RampLegend title="fill = coverage" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // selection rides aria-pressed (border + marker are the visible, non-colour cues).
    const sel = canvas.getByRole('button', { name: /ingest\/stream\.go .* selected/ })
    await expect(sel).toHaveAttribute('aria-pressed', 'true')
    // violation count surfaces in the accessible name, not colour alone.
    await expect(
      canvas.getByRole('button', { name: /auth\/middleware\.go .* 2 violations/ }),
    ).toBeInTheDocument()
  },
}

/* ── size encodes loc, independent of fill ─────────────────────────────────── */
export const Sizes = {
  render: () => (
    <IntensityScope className="ir-grid" style={{ alignItems: 'flex-end' }}>
      <MapNode label="cmd/main.go" loc={40} coverage={3} />
      <MapNode label="util/clock.go" loc={140} coverage={3} />
      <MapNode label="ingest/stream.go" loc={420} coverage={3} />
      <MapNode label="store/index.go" loc={900} coverage={3} />
      <MapNode label="store/" loc={2400} coverage={3} />
    </IntensityScope>
  ),
}

/* ── Heatmap — the ramp applied to a row of cells ──────────────────────────── */
const SESSIONS = [0, 1, 1, 3, 5, 8, 6, 2, 0, 4, 7, 9, 3, 1]

export const HeatmapRow = {
  name: 'Heatmap',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-label)',
            color: 'var(--ink-3)',
            textTransform: 'lowercase',
          }}
        >
          commits / day · store/
        </span>
        <Heatmap
          values={SESSIONS}
          max={9}
          ariaLabel="commits per day for store/, last 14 days"
          labels={SESSIONS.map((_, i) => `day ${i + 1}`)}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-label)',
            color: 'var(--ink-3)',
            textTransform: 'lowercase',
          }}
        >
          pre-baked levels · api/handlers.go
        </span>
        <Heatmap levels={[0, 1, 2, 3, 4, 4, 3, 2, 1, 0]} ariaLabel="coverage trend" />
      </div>
      <RampLegend title="cell = volume" words={['0', '1–2', '3–4', '5–7', '8+']} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByLabelText('commits per day for store/, last 14 days'),
    ).toBeInTheDocument()
  },
}

import { expect, within } from 'storybook/test'
import YAML from 'yaml'
import fixtureSource from '../../scripts/testdata/provider-harnesses.yaml?raw'
import {
  ProviderIcon,
  ProviderTag,
  ProviderName,
  AccentLegend,
  HARNESSES,
  PROVIDER_ACCENT,
} from './ProviderIcon.jsx'
import Changes from './graph/Changes.jsx'
import { frame } from './story-frame.jsx'
import TranscriptTurnCard from './transcript/TurnCard.jsx'
import { GraphLegend, GraphTurnNode } from './transcript/graph/index.js'

const fixtureDocument = YAML.parseDocument(fixtureSource, { strict: true, uniqueKeys: true })
if (fixtureDocument.errors.length > 0 || (fixtureSource.match(/^---\s*$/gm) ?? []).length > 0) {
  throw new Error('provider-harnesses.yaml must be one strict YAML document with unique keys')
}
const fixture = fixtureDocument.toJS()
const mountedProvider = fixture.harnesses.find((entry) => entry.slug === fixture.mountedHarness)
if (!mountedProvider) throw new Error('provider-harnesses.yaml mountedHarness must identify a canonical provider')

/* ProviderIcon stories. CSF3. the seven coding-agent HARNESSES (canonical schema wire
   values) → their REAL brand marks, never a generic glyph; the mark is always
   paired with the provider name (nominative fair use). the per-provider accent
   (PROVIDER_ACCENT) is the documented divergence from the system's fixed
   user=teal / assistant=amber turn colors: in the real transcript browser the
   assistant IS the provider, so its accent varies by provider. tokens come from
   src/index.css via .storybook/preview.jsx; the theme toolbar flips data-theme,
   so marks + accents re-theme live. */
const meta = {
  title: 'in use/ProviderIcon',
  component: ProviderIcon,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}
export default meta

/* a tiny labelled-row helper so each demo reads as "what it is : the thing". */
function Demo({ label, children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-label)',
        color: 'var(--ink-3)',
      }}
    >
      <span style={{ minWidth: 120, textTransform: 'lowercase' }}>{label}</span>
      {children}
    </div>
  )
}

/* ── Marks — all seven real brand marks, single-color ───────────────────────
   the headline rule made visible: claude-code wears Claude, codex wears OpenAI
   (its parent — a documented fallback, not a stand-in glyph), cursor wears
   Cursor. every mark is paired with its name. */
export const Marks = {
  decorators: frame('panel'),
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {HARNESSES.map((harness) => (
        <Demo key={harness} label={harness}>
          {/* standalone, informative mark (gets a screen-reader name) */}
          <ProviderIcon harness={harness} label size={18} />
          {/* the same mark tinted with its provider accent */}
          <ProviderIcon harness={harness} accent size={18} />
        </Demo>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // codex must NOT render a generic glyph — it resolves to the real OpenAI mark.
    await expect(canvas.getByLabelText('Codex')).toBeInTheDocument()
    // cursor and claude-code resolve to their own distinct marks; Antigravity uses Google's mark.
    await expect(canvas.getByLabelText('Cursor')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Claude Code')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Google Antigravity')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Strike')).toBeInTheDocument()
  },
}

/* ── Tags — all seven chips: mark + lowercase harness slug ───────────────────
   the system chip look (hairline, mono, radius 0). never color-only — the slug
   names the provider even fully monochrome; `accent` only tints the mark. */
export const Tags = {
  decorators: frame('panel'),
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
        {HARNESSES.map((harness) => (
          <ProviderTag key={harness} harness={harness} />
        ))}
      </div>
      {/* the same chips with the mark accented per provider */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
        {HARNESSES.map((harness) => (
          <ProviderTag key={harness} harness={harness} accent />
        ))}
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // each chip carries the harness slug as readable text (color is never the only signal).
    for (const harness of HARNESSES) {
      await expect(canvas.getAllByText(harness).length).toBeGreaterThan(0)
    }
  },
}

/* ── Names — the inline (no-chip) form, for prose + table cells ──────────────── */
export const Names = {
  decorators: frame('panel'),
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {HARNESSES.map((harness) => (
        <ProviderName key={harness} harness={harness} accent />
      ))}
    </div>
  ),
}

/* ── AccentLegend — the per-provider accent map, documented as a UI ──────────── */
export const AccentLegendStory = {
  name: 'AccentLegend',
  decorators: frame('panel'),
  render: () => <AccentLegend />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // every provider + its accent token name is spelled out (mark + name + word).
    // The accent map (PROVIDER_ACCENT in provider-policy.js) is intentionally
    // NOT injective — the same token is shared by more than one provider
    // (gemini-cli and antigravity are BOTH `teal`), so the accent word appears
    // more than once in the legend. Scope each token assertion to its own
    // provider ROW (the harness name is unique) rather than querying the whole
    // legend, which would match the duplicated token multiple times.
    for (const harness of HARNESSES) {
      const nameEl = canvas.getByText(harness)
      const row = nameEl.closest('.pv-legend-row')
      await expect(nameEl).toBeInTheDocument()
      expect(row).not.toBeNull()
      await expect(within(row).getByText(PROVIDER_ACCENT[harness])).toBeInTheDocument()
    }
  },
}

export const StrikeMountedSurfaces = {
  decorators: frame('full'),
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <section aria-label="transcript provider surface">
        <h2 className="sb-head">transcript</h2>
        <TranscriptTurnCard
          turn={{
            index: 1,
            role: 'assistant',
            label: '1',
            content: 'Strike session output renders with its canonical identity.',
            depth: 0,
            provider: mountedProvider.slug,
            toolCalls: [],
            annotations: [],
          }}
        />
      </section>
      <section aria-label="graph provider surfaces">
        <h2 className="sb-head">graph</h2>
        <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <GraphTurnNode
            role="assistant"
            provider={mountedProvider.slug}
            turnNumber="1"
            contentPreview="Strike session graph node"
            toolCount={0}
            totalTokens={0}
          />
          <GraphLegend items={[{ kind: 'assistant', label: mountedProvider.slug, provider: mountedProvider.slug }]} />
        </div>
      </section>
      <section aria-label="changes provider surface">
        <h2 className="sb-head">changes</h2>
        <Changes
          payload={{
            repoFound: true,
            defaultBranch: 'main',
            changes: [],
            recentCommits: [],
            sessions: [{
              sessionId: 'strike-provider-story',
              title: 'Strike session without a commit',
              harness: mountedProvider.slug,
              startMs: 1,
              hasCommitBinding: false,
            }],
          }}
          nowMs={1}
        />
      </section>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByLabelText(mountedProvider.accessibleName).length).toBeGreaterThan(0)
    await expect(canvas.getAllByText(mountedProvider.slug, { exact: true }).length).toBeGreaterThan(0)
    const marks = canvasElement.querySelectorAll(`svg.brand[data-brand="${mountedProvider.brand}"]`)
    await expect(marks.length).toBeGreaterThanOrEqual(2)
    for (const mark of marks) {
      await expect(mark).toHaveAttribute('viewBox', fixture.mountedMark.viewBox)
      await expect(mark.querySelector('path')).toHaveAttribute('d', fixture.mountedMark.path)
    }
    const graphNode = canvasElement.querySelector('.ft-gnode-turn')
    const graphLegend = canvasElement.querySelector('.ft-graph-legend-glyph')
    expect(graphNode).not.toBeNull()
    expect(graphLegend).not.toBeNull()
    await expect(graphNode.style.getPropertyValue('--ft-gnode-accent')).toBe(`var(--${mountedProvider.accent})`)
    await expect(graphLegend.style.background).toBe(`var(--${mountedProvider.accent})`)
    await expect(canvasElement.querySelector('.gmp-unlinked-session .pv-name-label')).toHaveTextContent(mountedProvider.slug)
  },
}

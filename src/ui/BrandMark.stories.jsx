import { expect, within } from 'storybook/test'
import YAML from 'yaml'
import fixtureSource from '../../scripts/testdata/provider-harnesses.yaml?raw'
import BrandMark from './BrandMark.jsx'
import { Tag } from './Avatar.jsx'

/* BrandMark story. The rule: name a company/provider, lead with its REAL mark, never a
   generic glyph. Marks recolor via currentColor (so they re-theme on the dark/light toggle)
   and size off the icon token in context. classes + tokens come from src/index.css. */

const fixtureDocument = YAML.parseDocument(fixtureSource, { strict: true, uniqueKeys: true })
if (fixtureDocument.errors.length > 0 || (fixtureSource.match(/^---\s*$/gm) ?? []).length > 0) {
  throw new Error('provider-harnesses.yaml must be one strict YAML document with unique keys')
}
const fixture = fixtureDocument.toJS()
if (!Array.isArray(fixture.brands) || fixture.brands.length !== fixture.expectedBrandCount) {
  throw new Error('BrandMark story fixture validation failed at scripts/testdata/provider-harnesses.yaml during Storybook load: brands does not match expectedBrandCount, so the gallery cannot prove the canonical brand inventory; restore every required brand row and its fixed count.')
}
if (!Array.isArray(fixture.aliases) || fixture.aliases.length !== fixture.expectedAliasCount) {
  throw new Error('BrandMark story fixture validation failed at scripts/testdata/provider-harnesses.yaml during Storybook load: aliases does not match expectedAliasCount, so alias resolution coverage is incomplete; restore every required alias row and its fixed count.')
}

const meta = {
  title: 'components/BrandMark',
  component: BrandMark,
  tags: ['autodocs'],
  argTypes: {
    name: { control: 'select', options: [...fixture.brands.map((entry) => entry.key), ...fixture.aliases.map((entry) => entry.name)] },
    size: { control: { type: 'number', min: 12, max: 64, step: 2 } },
    label: { control: 'text' },
  },
  args: { name: 'claude' },
  parameters: { layout: 'centered' },
}
export default meta

export const Playground = {}

/* the full set, each at the standalone icon-token size, paired with its lowercase name. */
export const Gallery = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', color: 'var(--ink)' }}>
      {fixture.brands.map((entry) => (
        <span
          key={entry.key}
          data-brand-case={entry.key}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}
        >
          <BrandMark name={entry.key} />
          {entry.key}
        </span>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const svgs = canvasElement.querySelectorAll('svg.brand')
    expect(svgs.length).toBe(fixture.expectedBrandCount)
    for (const entry of fixture.brands) {
      const row = canvasElement.querySelector(`[data-brand-case="${entry.key}"]`)
      expect(row).not.toBeNull()
      expect(within(row).getByText(entry.key)).toBeInTheDocument()
      expect(row.querySelector(`svg.brand[data-brand="${entry.key}"]`)).not.toBeNull()
    }
  },
}

/* every accepted product/company alias resolves through the shared behavior corpus. */
export const Aliases = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', color: 'var(--ink)' }}>
      {fixture.aliases.map((entry) => (
        <span key={entry.name} data-alias-case={entry.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>
          <BrandMark name={entry.name} />
          {entry.name} {String.fromCharCode(8594)} {entry.brand}
        </span>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const svgs = canvasElement.querySelectorAll('svg.brand')
    expect(svgs.length).toBe(fixture.expectedAliasCount)
    for (const entry of fixture.aliases) {
      const row = canvasElement.querySelector(`[data-alias-case="${entry.name}"]`)
      expect(row).not.toBeNull()
      expect(row.querySelector(`svg.brand[data-brand="${entry.brand}"]`)).not.toBeNull()
    }
  },
}

/* sizes scale crisply (vector). standalone use can override the contextual icon-token size. */
export const Sizes = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', color: 'var(--ink)' }}>
      {[16, 24, 32, 48].map((s) => (
        <BrandMark key={s} name="claude" size={s} />
      ))}
    </div>
  ),
}

/* in context: a mark leading a provider tag/chip. decorative here (the word names it). */
export const InTags = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Tag brand="claude">claude-code</Tag>
      <Tag brand="gemini">gemini-cli</Tag>
      <Tag brand="codex">codex-cli</Tag>
    </div>
  ),
}

/* informative: a mark that stands alone AS the identity needs an accessible name. */
export const Labelled = {
  args: { name: 'cursor', label: true, size: 32 },
  play: async ({ canvasElement }) => {
    const img = canvasElement.querySelector('svg[role="img"]')
    expect(img).not.toBeNull()
    expect(img.getAttribute('aria-label')).toBe('Cursor')
  },
}

/* unknown names render nothing (null) rather than a wrong/garbage glyph; the caller falls back
   to its own text. shown here beside a caption so the demo isn't a blank canvas. */
export const UnknownIsEmpty = {
  render: () => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--ink-3)' }}>
      <BrandMark name="not-a-provider" />
      an unknown name renders no mark
    </span>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('svg.brand')).toBeNull()
  },
}

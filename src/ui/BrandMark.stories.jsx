import { expect, within } from 'storybook/test'
import BrandMark from './BrandMark.jsx'
import { Tag } from './Avatar.jsx'

/* BrandMark story. The rule: name a company/provider, lead with its REAL mark, never a
   generic glyph. Marks recolor via currentColor (so they re-theme on the dark/light toggle)
   and size off the icon token in context. classes + tokens come from src/index.css. */

const ALL = ['claude', 'gemini', 'openai', 'cursor', 'opencode']

const meta = {
  title: 'components/BrandMark',
  component: BrandMark,
  tags: ['autodocs'],
  argTypes: {
    name: { control: 'select', options: [...ALL, 'anthropic', 'google', 'codex'] },
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
      {ALL.map((name) => (
        <span
          key={name}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}
        >
          <BrandMark name={name} />
          {name}
        </span>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    // every mark resolves to a real <svg class="brand">, none fall back to nothing.
    const svgs = canvasElement.querySelectorAll('svg.brand')
    expect(svgs.length).toBe(ALL.length)
  },
}

/* aliases resolve to the right mark: anthropic->claude, google->gemini, codex->openai. */
export const Aliases = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', color: 'var(--ink)' }}>
      {[
        ['anthropic', 'claude'],
        ['google', 'gemini'],
        ['codex', 'openai (fallback)'],
      ].map(([alias, resolves]) => (
        <span key={alias} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>
          <BrandMark name={alias} />
          {alias} {String.fromCharCode(8594)} {resolves}
        </span>
      ))}
    </div>
  ),
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

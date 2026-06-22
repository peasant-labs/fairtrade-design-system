import { expect, userEvent, within, waitFor } from 'storybook/test'
import { Boxes, GitBranch, ListTree, Filter, MessagesSquare } from 'lucide-react'
import RailShell, { RailSection, SplitRail } from './RailShell.jsx'

/* CSF3 stories for the canvas + sticky-rail app-shell. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. Default shows the two-column shell — a
   placeholder canvas as main beside a rail of two RailSections ("node" details + "conversations that
   built this"). Split shows the dual-rail (outline-left / filters-right) variant. MobileSheet forces
   the layout narrow (a width wrapper under the 880px breakpoint) so the rail folds into the fixed
   bottom-sheet, and its play test exercises the expand/collapse toggle. */

const meta = {
  title: 'in use/RailShell',
  component: RailShell,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
}
export default meta

/* a tall placeholder canvas so the sticky rail has something to hold against as the page scrolls —
   stand-in for a real code-map / graph / table surface. */
function PlaceholderCanvas({ rows = 14 }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-4)',
        border: 'var(--bd)',
        background: 'var(--surface)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--fs-label)',
          textTransform: 'lowercase',
          color: 'var(--ink-3)',
        }}
      >
        canvas
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            height: 'var(--sp-7)',
            border: 'var(--bd)',
            background: i % 3 === 0 ? 'var(--surface-2)' : 'var(--canvas)',
          }}
        />
      ))}
    </div>
  )
}

/* the rail payload shared by Default and MobileSheet: a "node" detail section over a collapsible
   "conversations that built this" section — the two things a canvas-node inspector shows. */
function NodeRail() {
  return (
    <>
      <RailSection title="node" icon={Boxes} meta="file">
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 'var(--sp-1) var(--sp-3)',
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-label)',
          }}
        >
          <dt style={{ color: 'var(--ink-4)' }}>path</dt>
          <dd style={{ margin: 0, color: 'var(--ink)' }}>src/ui/RailShell.jsx</dd>
          <dt style={{ color: 'var(--ink-4)' }}>lines</dt>
          <dd style={{ margin: 0, color: 'var(--ink)' }}>284</dd>
          <dt style={{ color: 'var(--ink-4)' }}>coverage</dt>
          <dd style={{ margin: 0, color: 'var(--amber)' }}>72%</dd>
        </dl>
      </RailSection>

      <RailSection
        title="conversations that built this"
        icon={MessagesSquare}
        meta="3"
        collapsible
        defaultOpen
      >
        <ul
          style={{
            display: 'grid',
            gap: 'var(--sp-2)',
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}
        >
          {[
            ['port the rail shell from peasant', '2h ago'],
            ['make the bottom-sheet expand', 'yesterday'],
            ['split-rail for outline + filters', '3d ago'],
          ].map(([what, when]) => (
            <li
              key={what}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 'var(--sp-3)',
              }}
            >
              <span style={{ color: 'var(--ink)' }}>{what}</span>
              <span
                style={{
                  flex: 'none',
                  color: 'var(--ink-4)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-micro)',
                }}
              >
                {when}
              </span>
            </li>
          ))}
        </ul>
      </RailSection>
    </>
  )
}

/* the canonical two-column shell: a placeholder canvas as main, a right-side rail holding the node
   inspector. on desktop the rail is a 320px sticky hairline card; the canvas scrolls beside it. */
export const Default = {
  render: () => (
    <div style={{ padding: 'var(--sp-5)' }}>
      <RailShell
        toolbar={<span>node · src/ui/RailShell.jsx</span>}
        rail={<NodeRail />}
        sheetTitle="node details"
        sheetMeta="3"
      >
        <PlaceholderCanvas />
      </RailShell>
    </div>
  ),
}

/* the rail on the left instead of the right — same content, mirrored column order. */
export const RailLeft = {
  render: () => (
    <div style={{ padding: 'var(--sp-5)' }}>
      <RailShell railSide="left" rail={<NodeRail />} sheetTitle="node details">
        <PlaceholderCanvas rows={10} />
      </RailShell>
    </div>
  ),
}

/* the dual-rail variant on its own: an outline tree on the left, filters on the right, each
   independently collapsible. side by side on desktop; stacks on mobile. */
export const Split = {
  render: () => (
    <div style={{ padding: 'var(--sp-5)', maxWidth: 720 }}>
      <SplitRail
        leftTitle="outline"
        leftIcon={ListTree}
        leftMeta="6"
        rightTitle="filters"
        rightIcon={Filter}
        left={
          <ul
            style={{
              display: 'grid',
              gap: 'var(--sp-1)',
              margin: 0,
              padding: 0,
              listStyle: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-label)',
              color: 'var(--ink)',
            }}
          >
            {['shell', '  toolbar', '  canvas', '  rail', '    node', '    history'].map(
              (n) => (
                <li key={n} style={{ whiteSpace: 'pre' }}>
                  {n}
                </li>
              ),
            )}
          </ul>
        }
        right={
          <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            {['only tested files', 'changed this week', 'owned by me'].map((label) => (
              <label
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-label)',
                  color: 'var(--ink-2)',
                }}
              >
                <input type="checkbox" />
                {label}
              </label>
            ))}
          </div>
        }
      />
    </div>
  ),
}

/* SplitRail used as the rail of a full shell — outline + filters beside the canvas. */
export const SplitInShell = {
  render: () => (
    <div style={{ padding: 'var(--sp-5)' }}>
      <RailShell
        toolbar={<span>graph · 42 nodes</span>}
        sheetTitle="panels"
        rail={
          <SplitRail
            leftTitle="outline"
            leftIcon={ListTree}
            rightTitle="filters"
            rightIcon={Filter}
            left={<div style={{ color: 'var(--ink-2)' }}>outline tree…</div>}
            right={<div style={{ color: 'var(--ink-2)' }}>filter controls…</div>}
          />
        }
      >
        <PlaceholderCanvas rows={8} />
      </RailShell>
    </div>
  ),
}

/* below the 880px breakpoint the rail folds into a fixed bottom-sheet: only a "details" toggle header
   (with a drag-handle) shows until tapped. the wrapper forces the narrow width so the sheet behavior
   is visible in the centered canvas; the play test taps the toggle and asserts the body opens, then
   collapses it again. */
export const MobileSheet = {
  render: () => (
    // force the shell narrow (under its 560px container query) so the rail folds to the bottom-sheet;
    // the wrapper is a bounded, height-capped viewport stand-in so the canvas scrolls and the sheet
    // pins to its bottom — exactly the compact-shell behavior, visible inside the centered story.
    <div
      style={{
        width: 380,
        maxWidth: '100%',
        height: 'min(520px, 80svh)',
        overflow: 'hidden',
        border: 'var(--bd)',
      }}
    >
      <RailShell
        toolbar={<span>node</span>}
        rail={<NodeRail />}
        sheetTitle="node details"
        sheetMeta="3"
      >
        <PlaceholderCanvas rows={8} />
      </RailShell>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: /node details/i })

    // the rail copy renders in BOTH the css-hidden desktop rail and the sheet, so query all matches
    // and judge by real visibility. collapsed: aria false and no rail copy is visible.
    const shown = () => canvas.getAllByText(/src\/ui\/RailShell\.jsx/i).filter((el) => el.checkVisibility())
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(shown().length).toBe(0))

    // tapping the header expands the sheet — aria flips and the node details show.
    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'true'))
    await waitFor(() => expect(shown().length).toBeGreaterThan(0))

    // collapse it again so the story rests in its documented (closed) state.
    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'false'))
  },
}

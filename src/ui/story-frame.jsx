/* story frame: one standardized set of demo widths so every component reads at a consistent,
   deliberate size in Storybook instead of shrinking to its own content width in the centered
   layout (the ragged-width problem). a story opts in with `decorators: frame('panel')`.

   the scale, matched to where each component actually lives in a product:
     narrow  280  a compact control column / inline rail
     panel   420  a side panel, detail rail, form, menu, dialog body
     wide    720  a main-content table, timeline, breadcrumb, command palette, date range
     full    100% fills the canvas (responsive components that should stretch)
   components whose natural size IS their content (Button, Chip, Tag, Avatar, Pager, Pagination)
   take no frame - they stay inline. */

export const FRAME_W = { narrow: 280, panel: 420, wide: 720, full: '100%' }

/**
 * frame(size) -> a CSF `decorators` array that wraps the story in a fixed-width, left-aligned box.
 * @param {'narrow'|'panel'|'wide'|'full'} size
 * @returns {Array<Function>}
 */
export function frame(size = 'panel') {
  const width = FRAME_W[size] ?? size
  const Frame = (Story) => (
    <div style={{ width, maxWidth: '100%' }}>
      <Story />
    </div>
  )
  return [Frame]
}

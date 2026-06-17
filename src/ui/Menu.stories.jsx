import { expect, userEvent, within, waitFor } from 'storybook/test'
import Menu from './Menu.jsx'
import { Copy, Download, Share2, Eye, EyeOff, Trash2, Archive } from 'lucide-react'

/* overlays/Menu - a self-contained accessible dropdown. the trigger is a .btn.menu-trigger
   with aria-haspopup="menu"; the popout is a role="menu" list of role="menuitem" rows. items
   carry an optional lucide icon, a kbd shortcut, a danger variant, and a disabled (aria-disabled,
   arrow-skipped) state. classes + tokens come from src/index.css via .storybook/preview.jsx. */
const meta = {
  title: 'overlays/Menu',
  component: Menu,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    align: { control: 'inline-radio', options: ['start', 'end'] },
    items: { control: false },
  },
  args: {
    label: 'transcript actions',
    align: 'start',
    items: [
      { label: 'copy link', icon: Copy, kbd: '⌘C' },
      { label: 'export markdown', icon: Download, kbd: '⌘E' },
      { label: 'share to collective', icon: Share2 },
      { label: 'redact selection', icon: EyeOff, disabled: true },
      { label: 'delete transcript', icon: Trash2, danger: true, kbd: '⌫' },
    ],
  },
}
export default meta

export const Playground = {}

export const Aligned = {
  args: { align: 'end', label: 'aligned end' },
}

export const Providers = {
  args: {
    label: 'route to provider',
    items: [
      { label: 'claude-code', icon: Eye, kbd: '1' },
      { label: 'gemini-cli', icon: Eye, kbd: '2' },
      { label: 'codex-cli', icon: Eye, kbd: '3', disabled: true },
    ],
  },
}

export const WithDangerItem = {
  args: {
    label: 'manage commons',
    items: [
      { label: 'archive transcript', icon: Archive },
      { label: 'unredact (audit)', icon: Eye, disabled: true },
      { label: 'purge from commons', icon: Trash2, danger: true, kbd: '⇧⌫' },
    ],
  },
}

export const Empty = {
  args: { label: 'no actions', items: [] },
}

// the important interaction: open the menu via the trigger, assert role=menu becomes visible,
// then drive the keyboard (ArrowDown -> first enabled item, ArrowDown again skips the disabled
// "redact selection" row) and Enter to choose, asserting the menu closes and focus returns to
// the trigger. scoped to the story canvas + deterministic via waitFor.
export const OpensAndSelects = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /transcript actions/i })

    await expect(trigger).toHaveAttribute('aria-expanded', 'false')

    // click opens the menu and focuses the first enabled item. the role=menu list lives inside
    // the .menu-pop popout which toggles the [hidden] attribute; under no-preference it plays the
    // menuIn entrance (opacity 0 -> 1), so toBeVisible() can be flaky mid-animation. assert the
    // popout is open (no longer [hidden], so display:none is gone) + aria-expanded instead.
    await userEvent.click(trigger)
    const menu = await canvas.findByRole('menu')
    await expect(menu).toBeInTheDocument()
    const popout = menu.closest('.menu-pop')
    await expect(popout).not.toHaveAttribute('hidden')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const firstItem = canvas.getByRole('menuitem', { name: /copy link/i })
    await waitFor(() => expect(firstItem).toHaveFocus())

    // disabled "redact selection" row is aria-disabled and must be skipped by arrows
    const disabledItem = canvas.getByRole('menuitem', { name: /redact selection/i })
    await expect(disabledItem).toHaveAttribute('aria-disabled', 'true')

    // ArrowDown: copy link -> export markdown
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() =>
      expect(canvas.getByRole('menuitem', { name: /export markdown/i })).toHaveFocus(),
    )

    // ArrowDown: export markdown -> share to collective; next ArrowDown skips the disabled
    // redact row and lands on the danger "delete transcript" row
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() =>
      expect(canvas.getByRole('menuitem', { name: /share to collective/i })).toHaveFocus(),
    )
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() =>
      expect(canvas.getByRole('menuitem', { name: /delete transcript/i })).toHaveFocus(),
    )
    await expect(disabledItem).not.toHaveFocus()

    // Enter chooses the focused row: the menu closes and focus returns to the trigger. closing
    // sets [hidden] back on the .menu-pop (display:none), which also removes role=menu from the
    // a11y tree - so assert the popout is hidden again rather than querying the (now-gone) role.
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(popout).toHaveAttribute('hidden'))
    await expect(canvas.queryByRole('menu')).not.toBeInTheDocument()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}

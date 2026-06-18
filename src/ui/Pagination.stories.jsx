import { useState } from 'react'
import { fn, expect, userEvent, within, waitFor } from 'storybook/test'
import Pagination from './Pagination.jsx'

/* numbered pagination: a row of page-number buttons with ellipsis truncation, flanked by
   lowercase prev/next controls. the current page carries aria-current="page". stories cover
   short and long ranges plus deriving the total from totalItems/pageSize. classes + tokens
   come from src/index.css via .storybook/preview.jsx. */
const meta = {
  title: 'components/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  argTypes: {
    page: { control: 'number' },
    defaultPage: { control: 'number' },
    total: { control: 'number' },
    totalItems: { control: 'number' },
    pageSize: { control: 'number' },
    siblingCount: { control: 'inline-radio', options: [0, 1, 2] },
    label: { control: 'text' },
    onChange: { action: 'page changed' },
  },
  args: { total: 5, defaultPage: 1, siblingCount: 1, label: 'transcript pages', onChange: fn() },
}
export default meta

export const Playground = {}

export const ShortRange = {
  args: { total: 5, defaultPage: 2, label: 'collective pages' },
}

export const LongRange = {
  args: { total: 24, defaultPage: 7, label: 'redaction queue pages' },
}

export const FromItems = {
  args: {
    total: undefined,
    totalItems: 137,
    pageSize: 10,
    defaultPage: 3,
    label: 'claude-code transcript pages',
  },
}

export const AtFirstPage = {
  args: { total: 12, defaultPage: 1, label: 'provider pages' },
}

export const AtLastPage = {
  args: { total: 12, defaultPage: 12, label: 'provider pages' },
}

export const WideWindow = {
  args: { total: 24, defaultPage: 12, siblingCount: 2, label: 'gemini-cli transcript pages' },
}

export const Collapsed = {
  // below 880px the prev/next labels collapse to icon-only square edge buttons. a narrow
  // viewport exercises that branch so the collapsed state is actually captured.
  args: { total: 12, defaultPage: 6, label: 'collapsed pages' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
}

export const Controlled = {
  // controlled mode: the parent owns `page` and updates it from onChange. clicking a
  // number must move the marker only because the parent re-renders with the new page.
  args: { total: 8, siblingCount: 2, label: 'controlled pages' },
  render: (args) => {
    const [p, setP] = useState(1)
    return (
      <Pagination
        {...args}
        page={p}
        onChange={(next) => {
          args.onChange(next)
          setP(next)
        }}
      />
    )
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    // page 1 starts current (controlled by the parent's state)
    expect(canvas.getByRole('button', { name: 'page 1' })).toHaveAttribute('aria-current', 'page')

    // click page 3 (visible at page 1 with siblingCount 2); the parent updates state, marker follows
    await userEvent.click(canvas.getByRole('button', { name: 'page 3' }))
    expect(args.onChange).toHaveBeenCalledWith(3)
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'page 3' })).toHaveAttribute('aria-current', 'page')
    })
    expect(canvas.getByRole('button', { name: 'page 1' })).not.toHaveAttribute('aria-current')
  },
}

export const ControlledFrozen = {
  // controlled mode where the parent ignores onChange: the marker must NOT move on click,
  // proving the component does not self-advance when `page` is supplied.
  args: { total: 8, siblingCount: 2, page: 3, label: 'controlled pages' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    // page 3 is current and stays current because the parent never updates `page`
    expect(canvas.getByRole('button', { name: 'page 3' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(canvas.getByRole('button', { name: 'page 5' }))
    expect(args.onChange).toHaveBeenCalledWith(5)
    expect(canvas.getByRole('button', { name: 'page 3' })).toHaveAttribute('aria-current', 'page')
    expect(canvas.getByRole('button', { name: 'page 5' })).not.toHaveAttribute('aria-current')
  },
}

export const ClickPage = {
  // siblingCount 2 keeps pages 3-5 (and 6 after the next-page click) rendered,
  // so the play interacts only with visible page buttons (no ellipsis truncation).
  args: { total: 9, defaultPage: 3, siblingCount: 2, label: 'commons pages' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    // page 3 starts current
    const current = canvas.getByRole('button', { name: 'page 3' })
    expect(current).toHaveAttribute('aria-current', 'page')

    // click page 5
    const target = canvas.getByRole('button', { name: 'page 5' })
    expect(target).not.toHaveAttribute('aria-current')
    await userEvent.click(target)

    // onChange fired with the new page
    expect(args.onChange).toHaveBeenCalledWith(5)

    // aria-current moved to page 5 (uncontrolled state updated)
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'page 5' })).toHaveAttribute('aria-current', 'page')
    })
    expect(canvas.getByRole('button', { name: 'page 3' })).not.toHaveAttribute('aria-current')

    // next advances to page 6
    await userEvent.click(canvas.getByRole('button', { name: 'next page' }))
    expect(args.onChange).toHaveBeenLastCalledWith(6)
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'page 6' })).toHaveAttribute('aria-current', 'page')
    })
  },
}

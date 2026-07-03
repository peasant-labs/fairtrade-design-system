/* Stories + interaction tests for the analytics dashboard. The play()
   functions port the surface's DOM interaction suite (the visible-section
   toggle and the weekly active|new metric toggle) so `sbsmoke` exercises them
   headlessly on every build — the section chips and the per-card series
   toggle are the dashboard's two stateful controls. */

import { expect, userEvent, waitFor, within } from 'storybook/test'
import { frame } from '../story-frame.jsx'
import { ProjectOverview } from './index.js'
import { SAMPLE_SESSIONS } from './fixtures.js'

export default {
  title: 'analytics/ProjectOverview',
  component: ProjectOverview,
  decorators: frame('full'),
}

const PAYLOAD = { sessions: SAMPLE_SESSIONS }

export const Overview = {
  args: {
    payload: PAYLOAD,
    title: 'project overview',
    contributorLimit: 10,
  },
}

export const SectionToggleHidesAndRestores = {
  args: { payload: PAYLOAD, title: 'project overview' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // All 8 sections start visible; the headline metrics list is on screen.
    await expect(canvas.getByRole('list', { name: 'headline metrics' })).toBeInTheDocument()

    // Toggling the "summary" chip hides the KPI list…
    await userEvent.click(canvas.getByRole('button', { name: 'summary section' }))
    await waitFor(() =>
      expect(canvas.queryByRole('list', { name: 'headline metrics' })).not.toBeInTheDocument(),
    )

    // …and toggling it again restores it.
    await userEvent.click(canvas.getByRole('button', { name: 'summary section' }))
    await waitFor(() =>
      expect(canvas.getByRole('list', { name: 'headline metrics' })).toBeInTheDocument(),
    )

    // The "new" section chip only affects the standalone new-contributors
    // card, never the weekly-active card.
    await userEvent.click(canvas.getByRole('button', { name: 'new section' }))
    await waitFor(() =>
      expect(canvas.queryByText('new contributors per week')).not.toBeInTheDocument(),
    )
    await expect(canvas.getByText('weekly active contributors')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'new section' }))
  },
}

export const WeeklyMetricToggleSwapsSeries = {
  args: { payload: PAYLOAD, title: 'project overview' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = within(canvas.getByRole('group', { name: 'series' }))

    // Starts on the active-contributor series.
    await expect(toggle.getByRole('button', { name: 'active' })).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByText('distinct contributors active each week')).toBeInTheDocument()
    await expect(canvas.getByText('7 active')).toBeInTheDocument()

    // Switching to "new" swaps the card's subtitle/aside/series without
    // touching its title or the standalone new-contributors card.
    await userEvent.click(toggle.getByRole('button', { name: 'new' }))
    await waitFor(() =>
      expect(canvas.getByText('first-ever appearance per week')).toBeInTheDocument(),
    )
    // "3 new" now shows twice: this card's aside AND the standalone
    // new-contributors card's aside (which never leaves the screen).
    await expect(canvas.getAllByText('3 new')).toHaveLength(2)
    await expect(canvas.getByText('weekly active contributors')).toBeInTheDocument()
    await expect(canvas.getByText('new contributors per week')).toBeInTheDocument()
  },
}

export const DonutHoverSwapsCenter = {
  args: { payload: PAYLOAD, title: 'project overview' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const svg = canvasElement.querySelector('.gan-donut-svg')

    // Resting state: the center shows the session total.
    await expect(within(svg).getByText('8')).toBeInTheDocument()
    await expect(within(svg).getByText('sessions')).toBeInTheDocument()

    // Hovering a legend row highlights it and swaps the center number/label
    // to that slice ("failed": 2 sessions in the fixture).
    const failedRow = canvas.getByText('failed').closest('li')
    await userEvent.hover(failedRow)
    await waitFor(() => expect(failedRow).toHaveClass('is-hot'))
    await expect(within(svg).getByText('2')).toBeInTheDocument()
    await expect(within(svg).getByText('failed')).toBeInTheDocument()

    // Leaving restores the resting total.
    await userEvent.unhover(failedRow)
    await waitFor(() => expect(within(svg).getByText('sessions')).toBeInTheDocument())
    await expect(within(svg).getByText('8')).toBeInTheDocument()
  },
}

export const HostHiddenSectionsStayDisabled = {
  args: {
    payload: PAYLOAD,
    title: 'project overview',
    sections: { contributorTable: false, newContributorVelocity: false },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // A host-hidden section's chip is disabled and its card absent.
    await expect(canvas.getByRole('button', { name: 'table section' })).toBeDisabled()
    await expect(canvas.queryByText('contributors', { selector: 'h3' })).not.toBeInTheDocument()

    // Hiding the new-contributor section also disables the weekly card's
    // "new" series option — a host-hidden section stays un-selectable.
    const toggle = within(canvas.getByRole('group', { name: 'series' }))
    await expect(toggle.getByRole('button', { name: 'new' })).toBeDisabled()
    await expect(toggle.getByRole('button', { name: 'active' })).toHaveAttribute('aria-pressed', 'true')
  },
}

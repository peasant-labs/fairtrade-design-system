import { expect, userEvent, within, waitFor } from 'storybook/test'
import Explainer, { Term } from './Explainer.jsx'
import { frame } from './story-frame.jsx'

/* CSF3 stories for the teach-in-place pair. classes + tokens come from src/index.css via
   .storybook/preview.jsx; the theme toolbar flips data-theme. Default opens a "what am i looking at?"
   box over a code-map, with <Term> glossary words woven into its prose; Inline shows the quieter
   ghost tone; Terms is a paragraph peppered with three definitions. Explainer teaches in place —
   never a modal, never a tour — so every story renders the box inline in normal page flow. */

const meta = {
  title: 'in use/Explainer',
  component: Explainer,
  tags: ['autodocs'],
  decorators: frame('panel'),
}
export default meta

/* the canonical box: open by default, explaining a code-map, with "traceability" and "coverage"
   defined inline. the play test collapses it via the toggle and asserts the prose hides + the
   toggle reports aria-expanded="false", then re-opens it. */
export const Default = {
  render: () => (
    <Explainer title="what am i looking at?" defaultOpen>
      <p>
        this is a <Term def="every square is one file; its size is the file's line count, its fill the test coverage.">code-map</Term>{' '}
        of the repository — one square per file, sized by length and shaded by how well it's tested.
      </p>
      <p>
        hover a square to trace it back to its module:{' '}
        <Term def="the ability to follow a file back to the change, author, and reasoning that produced it.">traceability</Term>{' '}
        runs both ways. the heavier the fill, the higher the{' '}
        <Term def="the share of a file's lines exercised by the test suite, 0 to 100 percent.">coverage</Term>.
      </p>
    </Explainer>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: /what am i looking at/i })

    // it starts open: aria-expanded true and the prose region is visible. (waitFor: the body opens
    // with a brief opacity 0->1 reveal, so assert visibility once that entrance settles, not mid-frame.)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(canvas.getByText(/one square per file/i)).toBeVisible())

    // collapsing hides the prose and flips aria-expanded.
    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'false'))
    await expect(canvas.queryByText(/one square per file/i)).not.toBeVisible()

    // re-open so the story rests in its documented state.
    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'true'))
  },
}

/* the quieter ghost: no fill, no frame — the toggle row alone carries it. for dense surfaces where
   a bordered panel would shout. starts collapsed, the way it sits one click away in a real layout. */
export const Inline = {
  render: () => (
    <Explainer title="about this view" tone="inline">
      <p>
        the <Term def="a saved unit of work — a set of related edits committed together.">commit</Term>{' '}
        list shows every change in reverse-chronological order. click a row to open its diff; the dot
        on the left marks commits that touched files you own.
      </p>
    </Explainer>
  ),
}

/* the inline companion on its own: a paragraph of body prose peppered with three glossary terms,
   each a dotted-underline trigger with a tooltip on hover/focus/tap. */
export const Terms = {
  render: () => (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-body)',
        lineHeight: 1.6,
        color: 'var(--ink-2)',
        margin: 0,
      }}
    >
      a contribution enters the{' '}
      <Term def="the shared, public pool of transcripts everyone can learn from.">commons</Term>{' '}
      only after you{' '}
      <Term def="removing names, secrets, and anything sensitive before the data leaves your machine.">redact</Term>{' '}
      it locally — nothing is uploaded until you confirm. each example carries{' '}
      <Term def="short tags that let others find the right examples by task, tool, or outcome.">labels</Term>{' '}
      so the collective stays searchable.
    </p>
  ),
}

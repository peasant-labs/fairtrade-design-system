import { useRef, useState } from 'react'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import Dialog from './Dialog.jsx'
import Button from './Button.jsx'

/* Dialog is controlled by `open` + `onClose`. every story uses a small stateful wrapper with a real
   trigger <button> (a plain element so the ref attaches; Button does not forward refs). focus
   returns to the trigger on close via returnFocusRef, so the play() test can open the dialog,
   assert role=dialog appears with focus inside, then press Escape and assert it is removed and
   focus is restored. classes + tokens come from src/index.css via .storybook/preview. */
const meta = {
  title: 'overlays/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    open: { control: false },
    onClose: { control: false },
    children: { control: false },
    footer: { control: false },
  },
  args: { title: 'redact transcript' },
}
export default meta

function DialogDemo({ title, body, triggerLabel = 'open dialog', footer }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const close = () => setOpen(false)
  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="btn btn-secondary"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      <Dialog
        open={open}
        onClose={close}
        title={title}
        returnFocusRef={triggerRef}
        footer={
          footer === null
            ? undefined
            : (footer ?? (
                <>
                  <Button variant="ghost" onClick={close}>cancel</Button>
                  <Button variant="primary" onClick={close}>save</Button>
                </>
              ))
        }
      >
        {body}
      </Dialog>
    </>
  )
}

export const Default = {
  render: (args) => (
    <DialogDemo
      title={args.title}
      body={
        <p>
          redaction removes the matched spans from the published transcript and from every
          collective mirror. this cannot be undone once the commons re-indexes.
        </p>
      }
    />
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /open dialog/i })

    await step('open the dialog', async () => {
      await userEvent.click(trigger)
      const dialog = await canvas.findByRole('dialog')
      await expect(dialog).toBeInTheDocument()
      await expect(dialog).toHaveAttribute('aria-modal', 'true')
      // focus lands inside the dialog (first focusable: the close button)
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    })

    await step('Escape closes it and restores focus to the trigger', async () => {
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
      await waitFor(() => expect(trigger).toHaveFocus())
    })
  },
}

export const WithLongBody = {
  render: (args) => (
    <DialogDemo
      title={args.title}
      body={
        <div>
          <p>
            this transcript was captured from <code>claude-code</code> on the{' '}
            <strong>fairtrade-commons</strong> collective. publishing it shares the full
            turn-by-turn exchange under the commons license.
          </p>
          <p>
            redacted spans (api keys, paths, names) are masked before indexing. the provider
            attribution (<code>gemini-cli</code>, <code>claude-code</code>) is preserved.
          </p>
          <p>contributors are credited by their collective handle, never by email.</p>
        </div>
      }
    />
  ),
}

export const Destructive = {
  args: { title: 'delete transcript' },
  render: (args) => {
    function Demo() {
      const [open, setOpen] = useState(false)
      const triggerRef = useRef(null)
      const close = () => setOpen(false)
      return (
        <>
          <button
            type="button"
            ref={triggerRef}
            className="btn btn-danger"
            onClick={() => setOpen(true)}
          >
            delete transcript
          </button>
          <Dialog
            open={open}
            onClose={close}
            title={args.title}
            returnFocusRef={triggerRef}
            footer={
              <>
                <Button variant="ghost" onClick={close}>keep it</Button>
                <Button variant="danger" onClick={close}>delete forever</Button>
              </>
            }
          >
            <p>
              this permanently removes the transcript from the commons and revokes every collective
              mirror. there is no recovery.
            </p>
          </Dialog>
        </>
      )
    }
    return <Demo />
  },
}

export const NoFooter = {
  args: { title: 'about this commons' },
  render: (args) => (
    <DialogDemo
      title={args.title}
      triggerLabel="open dialog"
      footer={null}
      body={
        <p>
          the fairtrade commons is a shared, attributed archive of model transcripts. close this
          dialog with Escape, the scrim, or the close control in the header.
        </p>
      }
    />
  ),
}

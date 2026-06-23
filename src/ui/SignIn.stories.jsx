import { useState } from 'react'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import { SignInProviders, HandleClaim, OnboardingCard, PROVIDERS } from './SignIn.jsx'
import { frame } from './story-frame.jsx'

/* SignIn stories. CSF3. the two-step front door for an agent product:
   a multi-provider OAuth SPLIT BUTTON (GitHub primary + the rest behind a
   keyboard-operable menu) and the post-OAuth HANDLE-CLAIM card (live validation
   shown as an icon + a WORD, never color alone; the typed handle keeps its
   case). tokens come from src/index.css via .storybook/preview.jsx; the theme
   toolbar flips data-theme so the whole family re-themes live. */
const meta = {
  title: 'in use/SignIn',
  component: SignInProviders,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}
export default meta

/* ── SplitButton — GitHub primary + 4 providers in the dropdown ───────────────
   the split button: a primary "continue with GitHub" action + a chevron that
   opens a menu of the other four (GitLab, Hugging Face, Codeberg, SourceHut),
   each a row with its real mark + name. play() opens the menu and asserts a
   provider row is shown + that choosing one fires onSignIn. */
export const SplitButton = {
  name: 'SplitButton',
  decorators: frame('panel'),
  args: { onSignIn: fn() },
  render: (args) => <SignInProviders {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    // the primary action names GitHub and is immediately clickable.
    await expect(canvas.getByText('continue with GitHub')).toBeInTheDocument()
    // open the dropdown via its chevron (aria-expanded flips, menu appears).
    const caret = canvas.getByRole('button', { name: 'more sign-in providers' })
    await expect(caret).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(caret)
    await waitFor(() => expect(caret).toHaveAttribute('aria-expanded', 'true'))
    // a provider row is shown in the open menu (the four non-primary providers).
    const menu = canvas.getByRole('menu')
    await expect(within(menu).getByText('continue with GitLab')).toBeInTheDocument()
    await expect(within(menu).getByText('continue with SourceHut')).toBeInTheDocument()
    // choosing a row fires onSignIn with that provider id and closes the menu.
    await userEvent.click(within(menu).getByText('continue with Codeberg'))
    await expect(args.onSignIn).toHaveBeenCalledWith('codeberg')
    await waitFor(() => expect(caret).toHaveAttribute('aria-expanded', 'false'))
  },
}

/* ── HandleClaim — live validation states ─────────────────────────────────────
   type to see the state change: an empty/short handle is "invalid", a reserved
   one ("admin", "village", "fairtrade") is "taken", anything else available. the
   state reads as an ICON + a WORD, never color alone, and the claim button stays
   disabled until the handle is available. the typed handle keeps its case.
   play() types a TAKEN handle (asserts "taken" + disabled button), then a free
   one (asserts "available" + enabled button + that case is preserved). */
export const HandleClaimStory = {
  name: 'HandleClaim',
  decorators: frame('panel'),
  args: { onSubmit: fn(), suggestedFrom: 'octocat' },
  render: (args) => <HandleClaim {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByLabelText('handle')
    const submit = canvas.getByRole('button', { name: 'claim handle' })
    // a reserved handle is reported "taken" (word, not just color) + stays disabled.
    await userEvent.type(input, 'village')
    await waitFor(() => expect(canvas.getByText('taken')).toBeInTheDocument())
    await expect(submit).toBeDisabled()
    // clear + type a free handle WITH mixed case — case must be preserved verbatim.
    await userEvent.clear(input)
    await userEvent.type(input, 'Octocat')
    await waitFor(() => expect(canvas.getByText('available')).toBeInTheDocument())
    await expect(input).toHaveValue('Octocat') // NOT lowercased
    await expect(submit).toBeEnabled()
  },
}

/* a tiny "checking…" validator to show the async/in-flight state in the picker. */
const STATE_DEMO = {
  available: () => ({ state: 'available' }),
  taken: () => ({ state: 'taken', hint: '@taken-handle is already claimed. try another.' }),
  invalid: () => ({ state: 'invalid', hint: '3–30 characters: letters, numbers, and single hyphens.' }),
  'checking…': () => ({ state: 'checking' }),
}

/* ── States — every validation state side by side (the static gallery) ──────── */
export const States = {
  decorators: frame('panel'),
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {Object.entries(STATE_DEMO).map(([name, validate]) => (
        <HandleClaim key={name} validate={validate} initialValue={`${name}-handle`} onSubmit={fn()} />
      ))}
    </div>
  ),
}

/* ── Combined — the whole onboarding card (split button + claim) ──────────────
   the front door as a consumer composes it: pick a provider up top, claim a
   handle below. play() opens the provider menu and asserts a row is shown. */
export const Combined = {
  name: 'Combined onboarding card',
  decorators: frame('panel'),
  render: () => {
    function Demo() {
      const [provider, setProvider] = useState(null)
      const [handle, setHandle] = useState(null)
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <OnboardingCard
            providers={PROVIDERS}
            suggestedFrom="octocat"
            onSignIn={setProvider}
            onSubmit={setHandle}
          />
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-label)',
              color: 'var(--ink-3)',
            }}
          >
            signed in with: {provider ?? '—'} · claimed: {handle ? `@${handle}` : '—'}
          </p>
        </div>
      )
    }
    return <Demo />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // open the provider menu and confirm a provider row is shown.
    const caret = canvas.getByRole('button', { name: 'more sign-in providers' })
    await userEvent.click(caret)
    await waitFor(() => expect(canvas.getByRole('menu')).toBeInTheDocument())
    const menu = canvas.getByRole('menu')
    await expect(within(menu).getByText('continue with Hugging Face')).toBeInTheDocument()
  },
}

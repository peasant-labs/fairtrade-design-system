# storybook — assessment + implementation plan

> Written 2026-06-16, after the tier-1 quality pass and tier-2 batch 1 (states + overlays + chips).
> TL;DR: **do not adopt full Storybook yet.** It would duplicate the showcase and there are almost no
> isolated components to put in it. Adopt it as a side effect of the tier-2.5 JSX component port, and
> optionally pilot it now on the handful of real React pieces. Concrete plan below.

## 1. honest assessment — is Storybook necessary?

**Not yet, and here is why.**

- **The architecture is static partials, not components.** Today the UI is one `index.css` token/class
  system rendered through ~22 raw HTML partials (`src/sections/*.html`) injected via
  `dangerouslySetInnerHTML`, plus a few React pieces (`Hero`, `Intro`, `Cards`, `CommandPalette`, the
  feedback tool, `effects.jsx`). There are no isolated, prop-driven components to render in isolation —
  which is the entire point of Storybook. You cannot meaningfully write `<Button variant="primary"/>`
  stories when the button is a `.btn.btn-primary` class on hand-written markup.
- **The showcase already IS the living documentation.** `App.jsx` + the partials render a single-page
  doc with, per family: overview → specimen → anatomy → do/don't → specs/tokens → a11y note, in two
  themes, with real states (after tier-2). That is what most teams build Storybook to get. Adding
  Storybook now means maintaining the same examples twice.
- **The backstops Storybook usually justifies are already covered or cheap here:** contrast/a11y is
  enforced by `scripts/contrast.mjs` (run in `pnpm build`) + the `aria-*` work; visual review is the
  screenshot-QA + puppeteer harness (`scripts/diag.mjs`). Storybook's marginal value today is low.

**When Storybook clearly pays off:** the moment the partials become real, prop-driven React components
(the deferred **tier-2.5 JSX port** in `IMPROVE.md`). Stories are how you'd then exercise each
component's prop/state matrix in isolation, run the a11y addon per story, and wire visual-regression.

**Recommendation:** treat Storybook as a *deliverable of* the JSX port, not a separate project. If the
owner wants value sooner, run the **pilot** (§4) on the existing React components only.

## 2. prerequisite — the component port (the real unlock)

Port each `src/sections/*.html` family to a typed React component with props for its variants/states,
keeping the exact `.class` names so `index.css` keeps styling them in place (zero visual change):

```
src/ui/
  Button.jsx        // variant: primary|secondary|ghost|danger; size: md|sm; icon?; loading?; disabled?
  Input.jsx         // state: default|error|disabled|readonly; helper?; error?
  Checkbox.jsx  Switch.jsx  Radio.jsx
  Chip.jsx          // tone, removable, selected, size  | Badge / StatusDot / CountBadge
  Card.jsx  Row.jsx
  Tabs.jsx  Breadcrumb.jsx  Steps.jsx  Pager.jsx
  Dialog.jsx        // + focus-trap / Esc / return-focus (the interactive bits item 8 deferred)
  Tooltip.jsx  Popover.jsx  Menu.jsx  CommandPalette.jsx (exists)
  Avatar.jsx  Kbd.jsx  Tag.jsx
  Skeleton.jsx  Progress.jsx  Toast.jsx  EmptyState.jsx
```

Each component reads from the tokens; no new colors. This is independently valuable (types, reuse,
real interactive states) and makes every story trivial.

## 3. full plan (do this WITH the port)

### 3.1 install (Vite builder — matches the stack)
```
pnpm add -D storybook @storybook/react-vite @storybook/addon-essentials \
  @storybook/addon-a11y @storybook/addon-themes @storybook/test
pnpm dlx storybook@latest init --builder vite --type react   # then prune the generated samples
```

### 3.2 `.storybook/preview.js`
- `import '../src/index.css'` so every story inherits the real tokens + classes.
- **Theme toolbar** via `@storybook/addon-themes` `withThemeByDataAttribute`:
  ```js
  themes: { dark: '', light: 'light' }, defaultTheme: 'dark',
  attributeName: 'data-theme',   // flips the same [data-theme="light"] the app uses
  ```
- **Backgrounds** locked to the two real canvases (`#070706`, `#fbfaf7`) so contrast reads true.
- **Viewports** addon with the project breakpoints (360 / 560 / 720 / 880 / 1100 / 1440) — the ones
  the responsive rules key off — so mobile regressions surface (this batch found real <400px overflow).
- Global `<a11y>` addon on; set `parameters.a11y.config` to flag contrast + names.

### 3.3 story structure (mirror the showcase IA, CSF3)
One `*.stories.jsx` per component, grouped to match the page:
```
Foundations/ (Color, Type, Spacing, Icons, Motion as MDX docs reading the tokens)
Controls/Button, Controls/Input, Controls/Checkbox, Controls/Switch ...
States/ (loading/disabled/error matrices)
Components/Card, Components/Tabs, Components/Dialog, Components/ConversationWindow ...
Overlays/Tooltip, Overlays/Menu, Overlays/CommandPalette, Overlays/Avatar ...
```
Each component: a `Playground` story (args = its props) + named stories for each meaningful state
(`Disabled`, `Loading`, `Error`, `Selected`). Example:
```jsx
export default { title: 'Controls/Button', component: Button,
  argTypes: { variant: { control: 'select', options: ['primary','secondary','ghost','danger'] } } }
export const Playground = { args: { children: 'publish transcript', variant: 'primary' } }
export const Loading  = { args: { children: 'publishing', loading: true } }
export const Disabled = { args: { children: 'publish transcript', disabled: true } }
```

### 3.4 quality wiring
- **a11y addon** runs axe per story — keeps the aria work honest as components evolve.
- **interaction tests** (`@storybook/test` + the play function) for the interactive ones: the command
  palette (cmd-k opens, arrows move, enter jumps), Dialog (Esc closes, focus returns), Menu, Switch.
- **visual regression**: Chromatic (hosted) or `@storybook/test-runner` + Playwright snapshots in CI,
  both themes via the theme globals. Reuses the breakpoints from §3.2.
- keep `scripts/contrast.mjs` as the token-level gate; Storybook a11y is the per-component gate.

### 3.5 keep ONE source of truth
Risk: Storybook + the showcase page drift. Mitigation: once components exist, **render the showcase
page FROM the same components** (the partials get replaced by `<Button/>` etc.), so the doc page and
the stories share one implementation. Storybook documents components; the page composes them.

## 4. optional pilot (value now, no port)
If the owner wants to try Storybook before the port, scope it to the existing React surface only:
- Stories for `CommandPalette` (interaction test for cmd-k/arrows/enter/esc), `Cards`, and the
  `effects.jsx` renderers (`AsciiImage`/`AsciiText`/`AsciiVideo` with arg controls for cols/contrast).
- This is ~1 day, proves the theme/a11y/viewport wiring, and informs the port — without duplicating the
  static specimens.

## 5. recommendation
1. **Now:** keep the showcase as the canonical doc; rely on the contrast gate + puppeteer harness.
   Optionally run the §4 pilot.
2. **Next (tier-2.5):** do the JSX component port; adopt full Storybook (§3) as part of it, with the
   a11y addon, theme/viewport globals, interaction tests, and visual regression in CI.
3. Do **not** stand up full Storybook against the static partials — it duplicates work and ages badly.

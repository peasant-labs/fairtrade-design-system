import '../src/index.css'
import { withThemeByDataAttribute } from '@storybook/addon-themes'

/* every story inherits the real tokens + classes from src/index.css. the theme toolbar flips the
   SAME [data-theme="light"] attribute the app uses, so components re-skin for free. the preview
   CANVAS follows that toggle too (a decorator paints html/body with var(--canvas)), so a light-theme
   story renders on the real warm-paper canvas instead of a black void - the old fixed dark background
   made every light capture read on the wrong canvas. viewports are the project breakpoints. a11y per story. */

/* paint the preview surface with the active theme's canvas token. runs on every render, so flipping
   the theme toolbar repaints; var(--canvas) resolves against the [data-theme] the theme decorator set. */
const withCanvas = (Story, context) => {
  if (typeof document !== 'undefined') {
    const c = 'var(--canvas)'
    document.documentElement.style.background = c
    document.body.style.background = c
    document.body.style.color = 'var(--ink)'
  }
  return <Story />
}

/** @type {import('@storybook/react-vite').Preview} */
const preview = {
  parameters: {
    layout: 'centered',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // the canvas is driven by the theme toggle (withCanvas), so the fixed-colour backgrounds addon
    // is disabled - it would otherwise paint a static dark surface under light-theme stories.
    backgrounds: { disable: true },
    viewport: {
      options: {
        xs: { name: 'xs · 360', styles: { width: '360px', height: '780px' } },
        sm: { name: 'sm · 560', styles: { width: '560px', height: '820px' } },
        md: { name: 'md · 720', styles: { width: '720px', height: '900px' } },
        lg: { name: 'lg · 1024', styles: { width: '1024px', height: '900px' } },
        xl: { name: 'xl · 1440', styles: { width: '1440px', height: '960px' } },
      },
    },
    a11y: { test: 'todo' },
  },
  decorators: [
    withCanvas,
    withThemeByDataAttribute({
      themes: { dark: '', light: 'light' },
      defaultTheme: 'dark',
      attributeName: 'data-theme',
    }),
  ],
}

export default preview

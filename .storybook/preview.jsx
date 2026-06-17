import '../src/index.css'
import { withThemeByDataAttribute } from '@storybook/addon-themes'

/* every story inherits the real tokens + classes from src/index.css. the theme toolbar
   flips the SAME [data-theme="light"] attribute the app uses, so components re-skin for
   free; backgrounds + viewports are locked to the two real canvases + the project breakpoints
   so contrast and responsive regressions read true. a11y (axe) runs per story. */

/** @type {import('@storybook/react-vite').Preview} */
const preview = {
  parameters: {
    layout: 'centered',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      options: {
        dark: { name: 'dark', value: '#070706' },
        light: { name: 'light', value: '#fbfaf7' },
      },
    },
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
  initialGlobals: {
    backgrounds: { value: 'dark' },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: { dark: '', light: 'light' },
      defaultTheme: 'dark',
      attributeName: 'data-theme',
    }),
  ],
}

export default preview

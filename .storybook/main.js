import { mergeConfig } from 'vite'

/** @type {import('@storybook/react-vite').StorybookConfig} */
const config = {
  // one *.stories.jsx per component, colocated under src/ui (+ any others under src)
  stories: ['../src/**/*.stories.@(js|jsx)'],
  // SB10 folds controls/actions/viewport/backgrounds/docs/toolbars into core;
  // only a11y (axe per story) and themes (the data-theme toggle) are separate.
  addons: ['@storybook/addon-a11y', '@storybook/addon-themes'],
  framework: { name: '@storybook/react-vite', options: {} },
  // when storybook is served under a subpath (e.g. /storybook on railway), build it with
  // SB_BASE=/storybook/ so the vite-built preview assets resolve there. unset (local dev /
  // root deploy) -> served at "/". the manager already uses relative asset paths.
  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, { base: process.env.SB_BASE || '/' })
  },
}

export default config

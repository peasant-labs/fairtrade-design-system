import tseslint from 'typescript-eslint'
import unstring from 'eslint-plugin-unstring'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    files: ['src/ui/**/*.{js,jsx}'],
    ignores: ['src/ui/**/*.stories.jsx', 'src/ui/story-frame.jsx', 'src/ui/**/*.test.{js,jsx}', 'src/ui/**/*.type-test.{js,jsx}', 'src/ui/**/*.spec.{js,jsx}'],
    linterOptions: { noInlineConfig: false, reportUnusedDisableDirectives: 'error' },
    languageOptions: {
      parser: tseslint.parser,
      sourceType: 'module',
      ecmaVersion: 'latest',
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { unstring, ...reactHooks.configs.flat.recommended.plugins },
    rules: {
      'unstring/closed-set-literal': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]

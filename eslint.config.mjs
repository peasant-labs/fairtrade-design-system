import tseslint from 'typescript-eslint'
import unstring from 'eslint-plugin-unstring'

// Report-only locally until findings are resolved; CI will run this once the rule is an error.
export default [
  {
    files: ['src/ui/**/*.{js,jsx}'],
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
    plugins: { unstring },
    rules: { 'unstring/closed-set-literal': 'warn' },
  },
]

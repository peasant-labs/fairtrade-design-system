// @ts-check

// The files the generated-artifact freshness gate checks. The list lives in
// one place so the checker, its test, and the generator's documentation cannot
// drift. `scripts/gen-llm-artifacts.mjs` writes every entry except
// packages/tokens/fonts.css: that file is authored, but it stays in the check
// because the previous git-diff gate covered it and a stale copy must still
// fail.
export const GENERATED_ARTIFACT_PATHS = Object.freeze([
  'public/tokens.json',
  'public/components.json',
  'packages/tokens/tokens.css',
  'packages/tokens/tokens.json',
  'packages/tokens/base.css',
  'packages/tokens/fonts.css',
  'DESIGN.md',
])

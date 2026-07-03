/* Leaf module — depends on nothing else in commons/, so both Manage.jsx (the shipped component)
   and mockups/inuse/CommonsManage.jsx (the demo) can import from here without creating an ESM
   cycle between those two files (Manage.jsx already re-exports the demo's views FROM
   CommonsManage.jsx at its bottom; CommonsManage.jsx importing back from Manage.jsx would close
   that into a real cycle -- order-fragile across downstream bundlers even when it happens to work
   today via definition-order + call-at-render-time). Single source of truth for provider display
   formatting; extracted out from Manage.jsx so both consumers point at the same leaf instead of
   one re-deriving it from the other. */

/* canonical human-facing provider names, so the provider-share bars and data-table rows read
   "Gemini" / "OpenCode", not a generic kebab-case reformat ("Gemini Cli" / "Opencode") that
   drifts from the design system's canonical provider names. Falls back to the generic reformat
   for a provider outside this set, so an unrecognised id still renders readable text instead of
   disappearing. */
export const PROVIDER_LABEL = {
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini',
  opencode: 'OpenCode',
  codex: 'Codex',
}

export function formatProvider(provider) {
  return String(provider || 'unknown')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function providerLabel(provider) {
  return PROVIDER_LABEL[provider] || formatProvider(provider)
}

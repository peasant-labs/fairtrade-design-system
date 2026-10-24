// @ts-check
/* The published AppSidebar account type carries every field a host passes: the handle, a link, a menu of
   items and a picture. `pnpm test:contract` fails here if the generated type drops one of them, as it did
   when a word in the handle's description began with an at sign and ended the typedef. */

/** @type {import('./AppSidebar.jsx').AppSidebarAccount} */
const withEverything = {
  handle: 'alicedev',
  href: '/settings/account',
  items: [{ label: 'profile', onSelect: () => {} }, { label: 'sign out', danger: true }],
  avatarUrl: 'https://example.com/alicedev.png',
}
void withEverything

/** @type {import('./AppSidebar.jsx').AppSidebarAccount} */
const handleOnly = { handle: 'mira' }
void handleOnly

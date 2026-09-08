# helper groups

Import `HelperGroup`, `HelperGroupListItem`, and `HelperThreadRow` from
`@peasant-labs/fairtrade/ui`, with the package's tokens, base, and components CSS.

These components render authorized list results. They do not parse a wire payload,
infer membership, fetch data, or hold a group selection. The host validates its
released schema read DTO, retains its original route-specific row, and supplies
fetching, routing, authorization, eligibility, and explicit selection callbacks.

## composition

- For a transcript item, pass the existing ordinary row as `HelperGroupListItem`'s
  `owner`. Its selection and ordinary child exits stay intact. Put its immediate
  `HelperGroup` children below it, in server order.
- For a context container, omit `owner` and pass its `ownerStatus`. The component
  renders honest context without a parent title, navigation, or checkbox. Key
  separate unknown-owner containers by their distinct backend group IDs.
- Copy `groupId`, `memberScope`, and `helperThreadCount` from the group summary.
  The displayed quantity is saved helper threads, never messages or review attempts.
- Pass the untouched member page as `members`. `getMemberKey(row)` returns the
  stable individual transcript ID. `renderMember(row)` can compose
  `HelperThreadRow` with the original row's status, usage, and existing actions as
  children. No universal row conversion discards collective, pending, share, sync,
  or search fields. If a helper itself owns helpers, render those immediate groups
  in that member's children, not under the root ancestor.

## host state and callbacks

`status` is `idle`, `loading`, `ready`, `error`, or `scope_expired`. Pass the server's
`page`, `limit`, and current authorized `total`; do not derive the total from the
number of loaded members. While loading or failed, stale member actions are hidden.

`onRequestPage({groupId, memberScope, page, limit})` fires when the user opens an
idle group, changes member page, or retries an error. It carries no extra filters.
Replay the exact returned scope through the host's member endpoint. Guard against
out-of-order responses and discard responses belonging to a replaced query token.
The component neither initiates a request on mount nor treats scope as authority.

On a scope-expiry response, set `status="scope_expired"`.
`onRefreshList()` must refresh the originating list with its original filters. Do
not fetch all group members as a fallback. A new scope resets uncontrolled
disclosure. Selection remains exclusively in host state and must be rechecked by
the mutation path; never add the parent or siblings when a helper is selected.

Disclosure defaults collapsed. For Back restoration, pass controlled `expanded`
and `onExpandedChange(boolean)` and restore/refetch the corresponding page in the
host. Opening retains trigger focus. A requested page moves focus to its page
heading only after that page becomes ready. Unrelated background updates do not
move focus.

`HelperThreadRow` accepts individual display props `id`, `title`, `provider`,
`inputSubmissionCount`, and `turnCount`. Titles remain verbatim. Absent input count
shows `unknown input submissions`; measured zero stays zero. No count is inferred.
An authorized `href` renders a real link. `onOpen(id, event)` can prevent its default
navigation for an SPA. Without an href, an `onOpen` callback renders a button;
without either, the title is noninteractive. `onSelect(id, checked)` is optional;
when present, `selected` and `selectionDisabled` control only that individual row.

## examples and verification

The mounted in-use demo is
`?app=commons&helpers=three-independent-counts#inuse`. Other named examples include
`helper-only-search`, `unresolved-independent`, `unavailable-owner`, `scope-expired`,
`member-error`, and `focus-pagination`. The same examples are in Storybook under
`lists/helper groups`. The demo's synthetic page callbacks are not a host backend
integration test.

Run `pnpm test:helper-groups` for fixture-backed public-barrel mounted callbacks.
After `pnpm build`, run `node scripts/helper-groups.probe.mjs` with `CHROME_PATH`
set to Chrome for exact built-demo keyboard, computed-style, and both-theme captures.

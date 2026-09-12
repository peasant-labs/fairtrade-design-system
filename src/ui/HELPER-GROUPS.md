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
- Pass the complete authorized member set for the exact scope as `members`.
  `getMemberKey(row)` returns the stable individual transcript ID.
  `renderMember(row)` renders one `HelperThreadRow` per member. The control
  mirrors the session-group disclosure the product already uses: full-width,
  a comfortable target, a leading chevron, the count in tabular mono, and
  `show`/`hide` on the trailing edge, indented under the row it hangs from.
  Member rows render only while the control is open, separated from it by a top
  rule, and use the same row anatomy as the owner row: title, a facts line with
  middot separators, an individual checkbox, host-authorized navigation.
  Compose the original row's status, usage, and existing actions as children.
  No universal row conversion discards collective, pending, share, sync, or
  search fields. If a helper itself owns helpers, render those immediate groups
  in that member's children, not under the root ancestor.

## host state and callbacks

The host owns fetching, paging, and error/loading presentation for its own list;
the group never fetches. Pass the members already resolved for `memberScope`
and keep `helperThreadCount` as the saved-thread total, not a page length. The
control states the count with the noun singularized ("1 helper thread"), and a
changed scope token resets uncontrolled disclosure; it never inherits the old
query's open state.

A group starts closed, so supply `isMemberSelected(row)` whenever
`renderMember` draws per-member checkboxes. The predicate lets the CLOSED
control append `, N selected` so a selection the viewer cannot see is never
silent. The group only counts the rows it holds; it never stores selection.

On a scope-expiry response, pass `scopeExpired` and keep `members` untouched.
The group renders no member rows fail-closed and offers only `onRefreshList()`,
which must refresh the originating list with its original filters. Do not fetch
all group members as a fallback. Selection remains exclusively in host state and
must be rechecked by the mutation path; never add the parent or siblings when
a helper is selected.

Disclosure defaults collapsed. For Back restoration, pass controlled `expanded`
and `onExpandedChange(boolean)`; the host restores disclosure from route state.
Opening retains trigger focus. Unrelated background updates do not move focus.

`HelperThreadRow` accepts individual display props `id`, `title`, `provider`,
`inputSubmissionCount`, and `turnCount`. Titles remain verbatim. Absent input
count shows `unknown input submissions`; measured zero stays zero; a count of
one singularizes (`1 input submission`, `1 turn`). No count is inferred.
An authorized `href` renders a real link. `onOpen(id, event)` can prevent its
default navigation for an SPA. Without an href, an `onOpen` callback renders a
button; without either, the title is noninteractive. `onSelect(id, checked)` is
optional; when present, `selected` and `selectionDisabled` control only that
individual row.

## examples and verification

The mounted in-use demo is
`?app=commons&helpers=three-independent-counts#inuse`. Other named examples include
`helper-only-search`, `unresolved-independent`, `identical-independent-helpers`,
`trunk-append`, `trunk-replacement`, `scope-expired`, `unavailable-owner`,
`measured-zero`, `unknown-input-count`, and `ordinary-child-exit`. The same
examples are in Storybook under `lists/helper groups`, plus a `plain`
display-only variant with selection and navigation both off. The demo's fixture
selection is not a host backend integration test.

Run `pnpm test:helper-groups` for fixture-backed public-barrel mounted callbacks.
After `pnpm build`, run `node scripts/helper-groups.probe.mjs` with `CHROME_PATH`
set to Chrome for exact built-demo keyboard, computed-style, and both-theme captures.

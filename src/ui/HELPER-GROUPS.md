# helper groups

Import `HelperGroup`, `HelperGroupListItem`, and `HelperThreadRow` from
`@peasant-labs/fairtrade/ui`, with the package's tokens, base, and components CSS.

These components render authorized list results. They do not parse a wire payload,
infer membership, fetch data, or hold a group selection. The host validates its
released schema read DTO, retains its original route-specific row, and supplies
fetching, routing, authorization, eligibility, and explicit selection callbacks.

## composition

- A `HelperGroupListItem` is ONE tree: the ordinary row a host retains as `owner`,
  then the immediate `HelperGroup` children that hang off it. Its selection and
  ordinary child exits stay intact. Keep distinct unresolved containers keyed by
  their distinct backend group IDs.
- The owner row anchors the tree: its checkbox, its verbatim title, and its mono
  facts line with middot separators. Ticking the owner is the tree's default
  auto-select: it selects the owner and every helper member disclosed under it;
  unticking the owner clears the owner and those members.
- Each `HelperGroup` steps ONE indent (`--sp-7`) inside the tree, and its count
  chip sits inside that step, between the owner row and the members it discloses.
  The chip carries no checkbox of its own and reads like the session-group
  disclosure the product already uses: full-width, a comfortable target, a leading
  chevron, the count in tabular mono, `, N selected` when members are selected,
  and `show`/`hide` on the trailing edge.
- Member rows render only while a chip is open, separated from it by a top rule.
  Each is a row like the owner's: title, middot facts, an individual checkbox, and
  host-authorized navigation. There is no left vertical rule and no corner glyph.
- ONE continuous connector (`.helper-tree-rail`) traces the centre of every
  MOUNTED row checkbox, so a row the host never mounted is never traced. It is
  measured from the mounted anchors after mount, expand/collapse, a row that gains
  or loses its checkbox, and resize; verticals run in the parent's column and a
  single square step lands in the indentation gutter. The connector carries no
  meaning the rows and checkboxes do not already carry.
- Copy `groupId`, `memberScope`, and `helperThreadCount` from the group summary.
  The displayed quantity is saved helper threads, never messages or review attempts.
- Pass the complete authorized member set for the exact scope as `members`.
  `getMemberKey(row)` returns the stable individual transcript ID.
  `renderMember(row)` renders one `HelperThreadRow` per member. Compose the
  original row's status, usage, and existing actions as children. No universal row
  conversion discards collective, pending, share, sync, or search fields.
- If a helper itself owns helpers, render those immediate groups in that member's
  own children, not under the root ancestor. The nested chip steps in again and
  the same connector continues through it at the deeper column.

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

## selection policy

`useHelperSelection` (exported from the same barrel) is the canonical policy for
a helper tree. Selection state stays host-owned: call the hook in the component
that owns the selection, then pass its `isSelected` and `onSelect` to the rows;
the owner row also reads `ownerState`. `helperOwnerState` exposes the same rollup
to a host that keeps its own state store.

- Ticking the owner cascades: it selects the owner and every helper member under
  it (the tree's default auto-select). Unticking the owner clears them.
- Ticking a member edits only that member. It never widens to the owner or to a
  sibling, and the owner's rolled-up state never writes back to a member, so a
  manual member choice survives every later owner re-render.
- The owner checkbox states the rollup: `checked` when the owner and every member
  are selected, `unchecked` when none are, and `partial` when they are mixed.
  Render `partial` through `HelperThreadRow`'s `indeterminate` prop, which draws
  the mixed mark and reports `aria-checked="mixed"`, so the state is never carried
  by the mark alone.

This mirrors the tri-state selection tree's parent-propagates / child-rolls-up
shape. It deliberately does NOT mirror the tree's keyboard select-all ring (select
all, unselect all, restore the baseline captured before the ring started, with a
manual edit invalidating the ring): the owner is one two-state checkbox with no
third press to restore a baseline, and the helper tree carries one checkbox per
row rather than a dedicated select-all key. The manual member edit still
supersedes the auto-select for the display rollup, exactly as a manual tree edit
invalidates the ring's baseline.

Display-only contexts leave `onSelect`, `href`, and `onOpen` off; every row then
renders as an ordinary row and, with no checkboxes mounted, no connector is drawn.

On a scope-expiry response, pass `scopeExpired` and keep `members` untouched.
The group renders no member rows fail-closed and offers only `onRefreshList()`,
which must refresh the originating list with its original filters. Do not fetch
all group members as a fallback. Selection remains exclusively in host state and
must be rechecked by the mutation path.

Disclosure defaults collapsed. For Back restoration, pass controlled `expanded`
and `onExpandedChange(boolean)`; the host restores disclosure from route state.
Opening retains trigger focus. Unrelated background updates do not move focus.

`HelperThreadRow` accepts individual display props `id`, `title`, `provider`,
`inputSubmissionCount`, and `turnCount`. Titles remain verbatim; they truncate
visually with the full text intact in the DOM. Absent input count shows
`unknown input submissions`; measured zero stays zero; a count of one
singularizes (`1 input submission`, `1 turn`). No count is inferred. An
authorized `href` renders a real link. `onOpen(id, event)` can prevent its
default navigation for an SPA. Without an href, an `onOpen` callback renders a
button; without either, the title is noninteractive. `onSelect(id, checked)` is
optional; when present, `selected`, `indeterminate`, and `selectionDisabled`
control only that individual row. A rolled-up owner passes `indeterminate` for
its mixed state; an ordinary member leaves it off.

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
The YAML fixtures carry the rail oracle per case (`expectedAnchorCounts`: the
mounted checkboxes while collapsed and while expanded), and the suite reads it
back through `data-anchor-count` on the mounted connector. After `pnpm build`,
run `node scripts/helper-groups.probe.mjs` with `CHROME_PATH` set to Chrome for
exact built-demo keyboard, computed-style, connector-geometry, and both-theme
captures.
